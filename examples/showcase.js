import "../src/orb.css";
import "./showcase.css";
import {
  attachAudioSource,
  attachMicrophone,
  createOrb,
  createOrbTheme,
  orbArchetypes,
  orbStates,
  orbVariantDefinitions,
  orbVariantIds,
  releaseAudioSource,
} from "../src/index.js";

const DEFAULT_PRESET = "core-teal-01";
const DEFAULT_VALUES = Object.freeze({
  state: "idle",
  quality: "high",
  motionPreference: "system",
  background: "midnight",
  diameter: 360,
  shellBlur: 15.8,
  appearance: Object.freeze({ detail: 1, glass: 0.4, glow: 1, intensity: 1 }),
  motion: Object.freeze({ drift: 1, speed: 1 }),
  audioResponse: Object.freeze({ brightness: 1, motion: 1, pulse: 1 }),
});

const elements = {
  controls: document.querySelector("#showcase-controls"),
  canvas: document.querySelector("#showcase-orb"),
  orbMotion: document.querySelector("#showcase-orb-motion"),
  stage: document.querySelector("#preview-stage"),
  stateControls: document.querySelector("#state-controls"),
  preset: document.querySelector("#preset"),
  quality: document.querySelector("#quality"),
  motionPreference: document.querySelector("#motion-preference"),
  background: document.querySelector("#background"),
  reset: document.querySelector("#reset-controls"),
  copy: document.querySelector("#copy-config"),
  configOutput: document.querySelector("#config-output"),
  rendererStatus: document.querySelector("#webgl-status"),
  playback: document.querySelector("#playback-button"),
  microphone: document.querySelector("#microphone-button"),
  audioFileButton: document.querySelector("#audio-file-button"),
  audioFile: document.querySelector("#audio-file"),
  audioPreview: document.querySelector("#audio-preview"),
  audioStatus: document.querySelector("#audio-status"),
  manualAudio: document.querySelector("#manual-audio"),
  signalValue: document.querySelector("#signal-value"),
  signalFill: document.querySelector("#signal-fill"),
  ambientFloat: document.querySelector("#ambient-float"),
};

const fieldIds = [
  "base-color",
  "interior-color",
  "accent-1",
  "accent-2",
  "accent-3",
  "intensity",
  "detail",
  "glass",
  "glow",
  "seed",
  "speed",
  "drift",
  "audio-brightness",
  "audio-motion",
  "audio-pulse",
  "diameter",
  "shell-blur",
  "float-distance",
  "float-scale",
  "float-duration",
];

for (const id of fieldIds) elements[id] = document.querySelector(`#${id}`);

let activeState = DEFAULT_VALUES.state;
let orb;
let microphoneActive = false;
let playbackPaused = false;
let audioDetach = null;
let audioObjectUrl = null;
let themeFrame = 0;

function titleCase(value) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function numberValue(id) {
  return Number(elements[id].value);
}

function buildPresetOptions() {
  for (const archetype of orbArchetypes) {
    const group = document.createElement("optgroup");
    group.label = titleCase(archetype);
    for (const id of orbVariantIds.filter((variantId) => orbVariantDefinitions[variantId].archetype === archetype)) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = `${titleCase(id)} · ${orbVariantDefinitions[id].referenceDiameter}px reference`;
      group.append(option);
    }
    elements.preset.append(group);
  }
}

function buildStateButtons() {
  for (const state of orbStates) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "segment-button";
    button.dataset.state = state;
    button.textContent = state;
    button.setAttribute("aria-pressed", String(state === activeState));
    button.addEventListener("click", () => setState(state));
    elements.stateControls.append(button);
  }
}

function setState(state) {
  activeState = state;
  orb?.setState(state);
  for (const button of elements.stateControls.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.state === state));
  }
  updateConfigOutput();
}

function currentThemeOptions() {
  return {
    id: "showcase-theme",
    preset: elements.preset.value,
    seed: numberValue("seed"),
    colors: {
      base: elements["base-color"].value,
      interior: elements["interior-color"].value,
      accents: [
        elements["accent-1"].value,
        elements["accent-2"].value,
        elements["accent-3"].value,
      ],
    },
    appearance: {
      intensity: numberValue("intensity"),
      detail: numberValue("detail"),
      glass: numberValue("glass"),
      glow: numberValue("glow"),
    },
    motion: {
      speed: numberValue("speed"),
      drift: numberValue("drift"),
    },
    audioResponse: {
      brightness: numberValue("audio-brightness"),
      motion: numberValue("audio-motion"),
      pulse: numberValue("audio-pulse"),
    },
  };
}

function currentConsumerConfig() {
  const reducedMotion = elements.motionPreference.value === "system"
    ? "user"
    : elements.motionPreference.value === "reduced";
  return {
    theme: currentThemeOptions(),
    state: activeState,
    quality: elements.quality.value,
    reducedMotion,
  };
}

function updateRangeOutputs() {
  const fixed = (id, digits = 2) => {
    document.querySelector(`#${id}-output`).value = numberValue(id).toFixed(digits);
  };
  fixed("intensity");
  fixed("detail");
  fixed("glass");
  fixed("glow");
  fixed("seed", 3);
  fixed("speed");
  fixed("drift");
  fixed("audio-brightness");
  fixed("audio-motion");
  fixed("audio-pulse");
  document.querySelector("#diameter-output").value = `${numberValue("diameter")}px`;
  document.querySelector("#shell-blur-output").value = `${numberValue("shell-blur").toFixed(1)}px`;
  document.querySelector("#float-distance-output").value = `${numberValue("float-distance")}px`;
  document.querySelector("#float-scale-output").value = numberValue("float-scale").toFixed(3);
  document.querySelector("#float-duration-output").value = `${numberValue("float-duration").toFixed(1)}s`;
}

function updateConfigOutput() {
  const wrapperCss = {
    "--orb-diameter": `${numberValue("diameter")}px`,
    "--orb-shell-blur": `${numberValue("shell-blur").toFixed(1)}px`,
    "--orb-motion-distance": `${-numberValue("float-distance")}px`,
    "--orb-motion-scale": numberValue("float-scale"),
    "--orb-motion-duration": `${numberValue("float-duration").toFixed(1)}s`,
  };
  elements.configOutput.textContent = [
    "const theme = createOrbTheme(",
    `${JSON.stringify(currentThemeOptions(), null, 2)}`,
    ");",
    "",
    "const orb = createOrb(canvas,",
    `${JSON.stringify({
      theme: "theme",
      state: activeState,
      quality: elements.quality.value,
      reducedMotion: currentConsumerConfig().reducedMotion,
    }, null, 2).replace('"theme": "theme"', '"theme": theme')}`,
    ");",
    "",
    "// Optional page-level CSS values used by this preview:",
    `${JSON.stringify(wrapperCss, null, 2)}`,
  ].join("\n");
}

function scheduleThemeUpdate() {
  updateRangeOutputs();
  updateConfigOutput();
  if (themeFrame) return;
  themeFrame = requestAnimationFrame(() => {
    themeFrame = 0;
    orb?.setTheme(createOrbTheme(currentThemeOptions()));
  });
}

function applyPreset(id, resetTuning = false) {
  const preset = orbVariantDefinitions[id];
  elements.preset.value = id;
  elements["base-color"].value = preset.baseColor;
  elements["interior-color"].value = "#000000";
  ["accent-1", "accent-2", "accent-3"].forEach((field, index) => {
    elements[field].value = preset.accentColors[index];
  });
  elements.glass.value = preset.lensStrength;
  elements.seed.value = preset.phase;
  elements.ambientFloat.checked = preset.ambientMotion.enabled;
  elements["float-distance"].value = preset.ambientMotion.verticalTravel;
  elements["float-scale"].value = preset.ambientMotion.scale;
  elements["float-duration"].value = preset.ambientMotion.durationSeconds || 7;
  elements.orbMotion.style.setProperty("--orb-motion-delay", `${preset.ambientMotion.delaySeconds}s`);

  if (resetTuning) {
    elements.intensity.value = DEFAULT_VALUES.appearance.intensity;
    elements.detail.value = DEFAULT_VALUES.appearance.detail;
    elements.glow.value = DEFAULT_VALUES.appearance.glow;
    elements.speed.value = DEFAULT_VALUES.motion.speed;
    elements.drift.value = DEFAULT_VALUES.motion.drift;
    elements["audio-brightness"].value = DEFAULT_VALUES.audioResponse.brightness;
    elements["audio-motion"].value = DEFAULT_VALUES.audioResponse.motion;
    elements["audio-pulse"].value = DEFAULT_VALUES.audioResponse.pulse;
  }
  applyLayoutControls();
  scheduleThemeUpdate();
}

function applyLayoutControls() {
  elements.stage.dataset.background = elements.background.value;
  elements.orbMotion.dataset.ambientMotion = String(elements.ambientFloat.checked);
  elements.orbMotion.style.setProperty("--orb-diameter", `${numberValue("diameter")}px`);
  elements.orbMotion.style.setProperty("--orb-shell-blur", `${numberValue("shell-blur")}px`);
  elements.orbMotion.style.setProperty("--orb-motion-distance", `${-numberValue("float-distance")}px`);
  elements.orbMotion.style.setProperty("--orb-motion-scale", numberValue("float-scale"));
  elements.orbMotion.style.setProperty("--orb-motion-duration", `${numberValue("float-duration")}s`);
  updateRangeOutputs();
}

function applyMotionPreference() {
  const choice = elements.motionPreference.value;
  elements.stage.dataset.motionSetting = choice;
  orb?.setReducedMotion(choice === "system" ? "user" : choice === "reduced");
  updateConfigOutput();
}

function setSignal(value) {
  const normalized = Math.max(0, Math.min(1, Number(value) || 0));
  orb?.setAudioLevel(normalized);
  const percentage = Math.round(normalized * 100);
  elements.signalValue.value = `${percentage}%`;
  elements.signalFill.style.width = `${percentage}%`;
}

function resetControls() {
  disconnectActiveAudio();
  elements.quality.value = DEFAULT_VALUES.quality;
  elements.motionPreference.value = DEFAULT_VALUES.motionPreference;
  elements.background.value = DEFAULT_VALUES.background;
  elements.diameter.value = DEFAULT_VALUES.diameter;
  elements["shell-blur"].value = DEFAULT_VALUES.shellBlur;
  elements.manualAudio.value = 0;
  document.querySelector("#manual-audio-output").value = "0%";
  setSignal(0);
  setState(DEFAULT_VALUES.state);
  applyPreset(DEFAULT_PRESET, true);
  orb?.setQuality(DEFAULT_VALUES.quality);
  if (playbackPaused) togglePlayback();
  applyMotionPreference();
  elements.audioStatus.textContent = "Defaults restored. Manual input is ready.";
}

function disconnectActiveAudio({ pauseMedia = true } = {}) {
  audioDetach?.();
  audioDetach = null;
  if (pauseMedia) elements.audioPreview.pause();
  microphoneActive = false;
  elements.microphone.textContent = "Use microphone";
  elements.microphone.setAttribute("aria-pressed", "false");
  setSignal(0);
}

async function toggleMicrophone() {
  if (microphoneActive) {
    disconnectActiveAudio();
    elements.audioStatus.textContent = "Microphone disconnected.";
    return;
  }

  disconnectActiveAudio();
  elements.microphone.disabled = true;
  elements.audioStatus.textContent = "Waiting for microphone permission…";
  try {
    audioDetach = await attachMicrophone(setSignal);
    microphoneActive = true;
    elements.microphone.textContent = "Stop microphone";
    elements.microphone.setAttribute("aria-pressed", "true");
    elements.audioStatus.textContent = "Microphone connected. Speak naturally after calibration.";
  } catch (error) {
    elements.audioStatus.textContent = `Microphone unavailable: ${error.message}`;
  } finally {
    elements.microphone.disabled = false;
  }
}

async function playAudioFile(file) {
  if (!file) return;
  disconnectActiveAudio();
  if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
  audioObjectUrl = URL.createObjectURL(file);
  elements.audioPreview.src = audioObjectUrl;
  audioDetach = attachAudioSource(elements.audioPreview, setSignal);
  elements.audioStatus.textContent = `Playing ${file.name}`;
  try {
    await elements.audioPreview.play();
  } catch (error) {
    elements.audioStatus.textContent = `Could not play the file: ${error.message}`;
  }
}

function togglePlayback() {
  playbackPaused = !playbackPaused;
  if (playbackPaused) orb.pause();
  else orb.resume();
  elements.orbMotion.dataset.playbackState = playbackPaused ? "paused" : "running";
  elements.playback.textContent = playbackPaused ? "Resume" : "Pause";
  elements.playback.setAttribute("aria-pressed", String(playbackPaused));
}

function bindEvents() {
  elements.preset.addEventListener("change", () => applyPreset(elements.preset.value));
  elements.quality.addEventListener("change", () => {
    orb.setQuality(elements.quality.value);
    updateConfigOutput();
  });
  elements.motionPreference.addEventListener("change", applyMotionPreference);
  elements.background.addEventListener("change", applyLayoutControls);
  elements.ambientFloat.addEventListener("change", applyLayoutControls);

  for (const id of fieldIds) {
    const element = elements[id];
    if (["diameter", "shell-blur", "float-distance", "float-scale", "float-duration"].includes(id)) {
      element.addEventListener("input", applyLayoutControls);
    } else {
      element.addEventListener("input", scheduleThemeUpdate);
    }
  }

  elements.manualAudio.addEventListener("input", () => {
    if (audioDetach) disconnectActiveAudio();
    const level = Number(elements.manualAudio.value);
    document.querySelector("#manual-audio-output").value = `${Math.round(level * 100)}%`;
    setSignal(level);
    elements.audioStatus.textContent = "Manual normalized signal is controlling the orb.";
  });

  elements.microphone.addEventListener("click", toggleMicrophone);
  elements.playback.addEventListener("click", togglePlayback);
  elements.audioFileButton.addEventListener("click", () => elements.audioFile.click());
  elements.audioFile.addEventListener("change", () => playAudioFile(elements.audioFile.files[0]));
  elements.audioPreview.addEventListener("ended", () => {
    audioDetach?.();
    audioDetach = null;
    elements.audioStatus.textContent = "Audio file finished.";
    setSignal(0);
  });
  elements.reset.addEventListener("click", resetControls);
  elements.copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(elements.configOutput.textContent);
      elements.copy.textContent = "Copied";
      setTimeout(() => { elements.copy.textContent = "Copy"; }, 1400);
    } catch {
      elements.configOutput.focus();
      elements.audioStatus.textContent = "Clipboard access was unavailable. Select the configuration manually.";
    }
  });

  window.addEventListener("pagehide", () => {
    disconnectActiveAudio();
    releaseAudioSource(elements.audioPreview);
    orb?.destroy();
    if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
  }, { once: true });
}

function start() {
  buildPresetOptions();
  buildStateButtons();
  elements.preset.value = DEFAULT_PRESET;
  elements.quality.value = DEFAULT_VALUES.quality;
  elements.motionPreference.value = DEFAULT_VALUES.motionPreference;
  elements.background.value = DEFAULT_VALUES.background;
  elements.diameter.value = DEFAULT_VALUES.diameter;
  elements["shell-blur"].value = DEFAULT_VALUES.shellBlur;
  applyPreset(DEFAULT_PRESET, true);

  let renderError = null;
  orb = createOrb(elements.canvas, {
    theme: createOrbTheme(currentThemeOptions()),
    state: activeState,
    quality: elements.quality.value,
    reducedMotion: "user",
    onError(error) {
      renderError = error;
      document.documentElement.classList.add("orb-no-webgl");
      elements.rendererStatus.textContent = "CSS fallback";
    },
  });
  elements.rendererStatus.textContent = renderError ? "CSS fallback" : "WebGL active";
  applyMotionPreference();
  bindEvents();
  updateRangeOutputs();
  updateConfigOutput();
}

start();
