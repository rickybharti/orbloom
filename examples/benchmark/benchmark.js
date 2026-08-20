import "../../src/orb.css";
import "./benchmark.css";
import { createOrb, createOrbTheme } from "../../src/index.js";

const WARMUP_MS = 900;
const SAMPLE_MS = 3200;
const scenarios = Object.freeze([
  { name: "Compact · low", preset: "core-blue-01", quality: "low", diameter: 360, targetFps: 30, audio: 0 },
  { name: "Layered · balanced", preset: "core-teal-01", quality: "balanced", diameter: 360, targetFps: 45, audio: 0.55 },
  { name: "Layered · high", preset: "nebula-violet-01", quality: "high", diameter: 420, targetFps: 60, audio: 0.75 },
  { name: "Maximum render stress", preset: "core-teal-01", quality: "high", diameter: 800, targetFps: 60, audio: 0.85 },
]);

const elements = {
  button: document.querySelector("#run-benchmark"),
  status: document.querySelector("#benchmark-status"),
  scenarioName: document.querySelector("#scenario-name"),
  scenarioProgress: document.querySelector("#scenario-progress"),
  orbMotion: document.querySelector("#benchmark-orb-motion"),
  canvas: document.querySelector("#benchmark-orb"),
  environment: document.querySelector("#environment"),
  empty: document.querySelector("#empty-results"),
  results: document.querySelector("#result-list"),
  overall: document.querySelector("#overall-result"),
  json: document.querySelector("#benchmark-json"),
};

let controller = null;
let running = false;
let activeLongFrames = [];
let longFrameObserver = null;

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function percentile(values, amount) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * amount))];
}

function rounded(value, digits = 2) {
  return value === null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));
}

function createProbe(engine) {
  const renderTimes = [];
  const cpuTimes = [];
  const gpuTimes = [];
  const pendingQueries = [];
  const originalRender = engine.render.bind(engine);
  const gl = engine.gl;
  const timerExtension = gl.getExtension("EXT_disjoint_timer_query");
  let recording = false;

  function collectGpuQueries() {
    if (!timerExtension) return;
    const disjoint = gl.getParameter(timerExtension.GPU_DISJOINT_EXT);
    for (let index = pendingQueries.length - 1; index >= 0; index -= 1) {
      const query = pendingQueries[index];
      const available = timerExtension.getQueryObjectEXT(
        query,
        timerExtension.QUERY_RESULT_AVAILABLE_EXT,
      );
      if (!available && !disjoint) continue;
      if (available && !disjoint) {
        const nanoseconds = timerExtension.getQueryObjectEXT(
          query,
          timerExtension.QUERY_RESULT_EXT,
        );
        gpuTimes.push(nanoseconds / 1e6);
      }
      timerExtension.deleteQueryEXT(query);
      pendingQueries.splice(index, 1);
    }
  }

  engine.render = (now) => {
    let query = null;
    if (recording && timerExtension && pendingQueries.length < 90) {
      query = timerExtension.createQueryEXT();
      timerExtension.beginQueryEXT(timerExtension.TIME_ELAPSED_EXT, query);
    }
    const startedAt = performance.now();
    const rendered = originalRender(now);
    const endedAt = performance.now();
    if (query) {
      timerExtension.endQueryEXT(timerExtension.TIME_ELAPSED_EXT);
      pendingQueries.push(query);
    }
    collectGpuQueries();
    if (recording && rendered) {
      renderTimes.push(endedAt);
      cpuTimes.push(endedAt - startedAt);
    }
    return rendered;
  };

  return {
    cpuTimes,
    gpuTimes,
    renderTimes,
    timerQuerySupported: Boolean(timerExtension),
    start() {
      renderTimes.length = 0;
      cpuTimes.length = 0;
      gpuTimes.length = 0;
      recording = true;
    },
    async stop() {
      recording = false;
      for (let attempt = 0; attempt < 12 && pendingQueries.length; attempt += 1) {
        collectGpuQueries();
        if (pendingQueries.length) await sleep(25);
      }
    },
    destroy() {
      engine.render = originalRender;
      if (timerExtension) {
        for (const query of pendingQueries) timerExtension.deleteQueryEXT(query);
      }
    },
  };
}

function startRafProbe() {
  const timestamps = [];
  let frame = 0;
  let active = true;
  const sample = (timestamp) => {
    if (!active) return;
    timestamps.push(timestamp);
    frame = requestAnimationFrame(sample);
  };
  frame = requestAnimationFrame(sample);
  return () => {
    active = false;
    cancelAnimationFrame(frame);
    return timestamps;
  };
}

function intervals(timestamps) {
  return timestamps.slice(1).map((value, index) => value - timestamps[index]);
}

async function measureScenario(scenario, index) {
  controller?.destroy();
  elements.scenarioName.textContent = scenario.name;
  elements.scenarioProgress.textContent = `${index + 1} / ${scenarios.length}`;
  elements.status.textContent = `Warming up ${scenario.name}…`;
  elements.orbMotion.style.setProperty("--orb-diameter", `${scenario.diameter}px`);
  elements.orbMotion.style.width = `${scenario.diameter}px`;
  elements.orbMotion.style.height = `${scenario.diameter}px`;

  const longFrameStart = activeLongFrames.length;
  const heapBefore = performance.memory?.usedJSHeapSize ?? null;
  controller = createOrb(elements.canvas, {
    theme: createOrbTheme({ id: `performance-${index}`, preset: scenario.preset }),
    quality: scenario.quality,
    state: scenario.audio ? "speaking" : "idle",
    reducedMotion: false,
  });
  controller.setAudioLevel(scenario.audio);
  const probe = createProbe(controller.engine);
  await sleep(WARMUP_MS);

  elements.status.textContent = `Measuring ${scenario.name}… keep this tab visible`;
  const stopRafProbe = startRafProbe();
  probe.start();
  await sleep(SAMPLE_MS);
  await probe.stop();
  const rafTimestamps = stopRafProbe();
  controller.pause();

  const renderIntervals = intervals(probe.renderTimes);
  const rafIntervals = intervals(rafTimestamps);
  const durationSeconds = probe.renderTimes.length > 1
    ? (probe.renderTimes.at(-1) - probe.renderTimes[0]) / 1000
    : SAMPLE_MS / 1000;
  const effectiveFps = probe.renderTimes.length > 1
    ? (probe.renderTimes.length - 1) / durationSeconds
    : 0;
  const expectedInterval = 1000 / scenario.targetFps;
  const missedFrameRatio = renderIntervals.length
    ? renderIntervals.filter((value) => value > expectedInterval * 1.75).length / renderIntervals.length
    : 1;
  const cpuP95 = percentile(probe.cpuTimes, 0.95);
  const frameP95 = percentile(renderIntervals, 0.95);
  const longFrames = activeLongFrames.slice(longFrameStart);
  const pass = effectiveFps >= scenario.targetFps * 0.72
    && (frameP95 ?? Infinity) <= expectedInterval * 2.5
    && (cpuP95 ?? Infinity) <= Math.max(22, expectedInterval * 1.25)
    && missedFrameRatio <= 0.12;

  const result = {
    name: scenario.name,
    pass,
    preset: scenario.preset,
    quality: scenario.quality,
    targetFps: scenario.targetFps,
    effectiveFps: rounded(effectiveFps, 1),
    renderedFrames: probe.renderTimes.length,
    renderDiameter: controller.engine.renderDiameter,
    requestedDiameter: scenario.diameter,
    devicePixelRatio: controller.engine.devicePixelRatio,
    frameIntervalP95Ms: rounded(frameP95),
    frameIntervalP99Ms: rounded(percentile(renderIntervals, 0.99)),
    missedFramePercent: rounded(missedFrameRatio * 100, 1),
    cpuFrameP50Ms: rounded(percentile(probe.cpuTimes, 0.5), 3),
    cpuFrameP95Ms: rounded(cpuP95, 3),
    gpuTimerSupported: probe.timerQuerySupported,
    gpuFrameP50Ms: rounded(percentile(probe.gpuTimes, 0.5), 3),
    gpuFrameP95Ms: rounded(percentile(probe.gpuTimes, 0.95), 3),
    gpuSamples: probe.gpuTimes.length,
    browserRafP95Ms: rounded(percentile(rafIntervals, 0.95)),
    longAnimationFrames: longFrames.length,
    longestAnimationFrameMs: rounded(percentile(longFrames.map((entry) => entry.duration), 1)),
    heapDeltaBytes: heapBefore === null ? null : (performance.memory.usedJSHeapSize - heapBefore),
  };

  probe.destroy();
  controller.destroy();
  controller = null;
  return result;
}

function metric(label, value, warning = false) {
  const item = document.createElement("div");
  item.className = "metric";
  const name = document.createElement("small");
  name.textContent = label;
  const output = document.createElement("span");
  output.textContent = value;
  if (warning) output.className = "is-warning";
  item.append(name, output);
  return item;
}

function displayResult(result) {
  elements.empty.hidden = true;
  const row = document.createElement("article");
  row.className = "result-row";
  const header = document.createElement("header");
  const title = document.createElement("strong");
  title.textContent = result.name;
  const detail = document.createElement("span");
  detail.textContent = `${result.quality} · ${result.renderDiameter}px physical · ${result.pass ? "within budget" : "review"}`;
  header.append(title, detail);
  const metrics = document.createElement("div");
  metrics.className = "metric-grid";
  metrics.append(
    metric("Effective FPS", `${result.effectiveFps} / ${result.targetFps}`, !result.pass),
    metric("Frame p95", `${result.frameIntervalP95Ms ?? "—"} ms`),
    metric("CPU p95", `${result.cpuFrameP95Ms ?? "—"} ms`),
    metric("GPU p95", result.gpuFrameP95Ms === null ? "Unavailable" : `${result.gpuFrameP95Ms} ms`),
    metric("Missed frames", `${result.missedFramePercent}%`, result.missedFramePercent > 12),
    metric("Long frames", String(result.longAnimationFrames)),
    metric("rAF p95", `${result.browserRafP95Ms ?? "—"} ms`),
    metric("GPU samples", String(result.gpuSamples)),
  );
  row.append(header, metrics);
  elements.results.append(row);
}

function environmentItems() {
  const values = [
    ["User agent", navigator.userAgent],
    ["Viewport", `${innerWidth} × ${innerHeight}`],
    ["Device pixel ratio", String(devicePixelRatio)],
    ["CPU threads", String(navigator.hardwareConcurrency ?? "Unknown")],
    ["Device memory", navigator.deviceMemory ? `${navigator.deviceMemory} GB` : "Unavailable"],
    ["Long-frame API", PerformanceObserver.supportedEntryTypes.includes("long-animation-frame") ? "Available" : "Unavailable"],
  ];
  for (const [label, value] of values) {
    const wrapper = document.createElement("div");
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    wrapper.append(term, description);
    elements.environment.append(wrapper);
  }
}

async function runBenchmark() {
  if (running) return;
  running = true;
  window.__orbPerformanceComplete = false;
  window.__orbPerformanceResult = null;
  elements.button.disabled = true;
  elements.button.textContent = "Running…";
  elements.results.replaceChildren();
  elements.empty.hidden = false;
  elements.overall.textContent = "Running";
  elements.overall.removeAttribute("data-pass");
  activeLongFrames = [];
  const startedAt = performance.now();
  const results = [];

  try {
    for (let index = 0; index < scenarios.length; index += 1) {
      const result = await measureScenario(scenarios[index], index);
      results.push(result);
      displayResult(result);
      await sleep(180);
    }
    const pass = results.every((result) => result.pass);
    const summary = {
      pass,
      durationMs: Math.round(performance.now() - startedAt),
      environment: {
        userAgent: navigator.userAgent,
        viewport: [innerWidth, innerHeight],
        devicePixelRatio,
        hardwareConcurrency: navigator.hardwareConcurrency ?? null,
        deviceMemory: navigator.deviceMemory ?? null,
        longAnimationFrameApi: PerformanceObserver.supportedEntryTypes.includes("long-animation-frame"),
      },
      results,
    };
    window.__orbPerformanceResult = summary;
    window.__orbPerformanceComplete = true;
    elements.json.textContent = JSON.stringify(summary);
    elements.overall.textContent = pass ? "Within budget" : "Review required";
    elements.overall.dataset.pass = String(pass);
    elements.status.textContent = `Finished in ${(summary.durationMs / 1000).toFixed(1)} seconds.`;
  } catch (error) {
    window.__orbPerformanceResult = { pass: false, error: error.message, results };
    window.__orbPerformanceComplete = true;
    elements.json.textContent = JSON.stringify(window.__orbPerformanceResult);
    elements.overall.textContent = "Benchmark error";
    elements.overall.dataset.pass = "false";
    elements.status.textContent = error.message;
  } finally {
    running = false;
    elements.button.disabled = false;
    elements.button.textContent = "Run again";
    elements.scenarioName.textContent = "Benchmark complete";
  }
}

if (PerformanceObserver.supportedEntryTypes.includes("long-animation-frame")) {
  longFrameObserver = new PerformanceObserver((list) => {
    activeLongFrames.push(...list.getEntries());
  });
  longFrameObserver.observe({ type: "long-animation-frame", buffered: true });
}

environmentItems();
elements.button.addEventListener("click", runBenchmark);
window.addEventListener("pagehide", () => {
  controller?.destroy();
  longFrameObserver?.disconnect();
}, { once: true });

if (new URLSearchParams(location.search).get("autorun") === "1") runBenchmark();
