import { AudioLevelCalibrator } from "./audio-calibration.js";

const mediaGraphs = new WeakMap();

function isAnalyserNode(value) {
  return typeof AnalyserNode !== "undefined" && value instanceof AnalyserNode;
}

function canAnalyzeMediaElement(element) {
  try {
    if (element.crossOrigin === "anonymous" || element.crossOrigin === "use-credentials") return true;
    const source = element.currentSrc || element.src;
    if (!source) return false;
    return new URL(source, location.href).origin === location.origin;
  } catch {
    return false;
  }
}

function analyze(analyser, setLevel, calibrationOptions) {
  const samples = new Float32Array(analyser.fftSize);
  const byteSamples = typeof analyser.getFloatTimeDomainData === "function"
    ? null
    : new Uint8Array(analyser.fftSize);
  const calibrator = new AudioLevelCalibrator(calibrationOptions);
  let frame = 0;
  const update = () => {
    frame = requestAnimationFrame(update);
    if (byteSamples) {
      analyser.getByteTimeDomainData(byteSamples);
      for (let index = 0; index < samples.length; index += 1) {
        samples[index] = (byteSamples[index] - 128) / 128;
      }
    } else {
      analyser.getFloatTimeDomainData(samples);
    }
    setLevel(calibrator.process(samples, performance.now() / 1000));
  };
  frame = requestAnimationFrame(update);
  return () => {
    cancelAnimationFrame(frame);
    setLevel(0);
  };
}

export function attachAudioSource(source, setLevel, options = {}) {
  if (typeof setLevel !== "function") throw new TypeError("setLevel must be a function");
  const { calibration } = options;
  if (isAnalyserNode(source)) return analyze(source, setLevel, calibration);
  if (!(source instanceof HTMLMediaElement)) {
    throw new TypeError("Expected an HTMLMediaElement or AnalyserNode");
  }
  if (!canAnalyzeMediaElement(source)) {
    throw new Error("Cross-origin media requires a compatible CORS response before it can drive the orb.");
  }

  let graph = mediaGraphs.get(source);
  if (!graph) {
    const context = new AudioContext();
    const mediaSource = context.createMediaElementSource(source);
    const highPass = context.createBiquadFilter();
    const analyser = context.createAnalyser();
    const analysisMonitor = context.createGain();
    highPass.type = "highpass";
    highPass.frequency.value = 80;
    highPass.Q.value = 0.707;
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0;
    analysisMonitor.gain.value = 0;
    mediaSource.connect(context.destination);
    mediaSource.connect(highPass);
    highPass.connect(analyser);
    analyser.connect(analysisMonitor);
    analysisMonitor.connect(context.destination);
    graph = { analyser, analysisMonitor, context, highPass, mediaSource };
    mediaGraphs.set(source, graph);
  }
  graph.context.resume();
  return analyze(graph.analyser, setLevel, calibration);
}

export async function attachMicrophone(setLevel, options = {}) {
  if (typeof setLevel !== "function") throw new TypeError("setLevel must be a function");
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone capture is unavailable in this browser.");
  }
  const requestedConstraints = options.constraints ?? {
    audio: {
      echoCancellation: { ideal: true },
      noiseSuppression: { ideal: true },
      autoGainControl: { ideal: false },
      channelCount: { ideal: 1 },
    },
  };
  const stream = await navigator.mediaDevices.getUserMedia(requestedConstraints);
  const context = new AudioContext();
  const microphone = context.createMediaStreamSource(stream);
  const highPass = context.createBiquadFilter();
  const analyser = context.createAnalyser();
  const analysisMonitor = context.createGain();
  highPass.type = "highpass";
  highPass.frequency.value = 80;
  highPass.Q.value = 0.707;
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0;
  analysisMonitor.gain.value = 0;
  microphone.connect(highPass);
  highPass.connect(analyser);
  analyser.connect(analysisMonitor);
  analysisMonitor.connect(context.destination);
  await context.resume();
  const detach = analyze(analyser, setLevel, {
    warmupSeconds: 0.35,
    ...options.calibration,
  });
  return () => {
    detach();
    microphone.disconnect();
    highPass.disconnect();
    analyser.disconnect();
    analysisMonitor.disconnect();
    stream.getTracks().forEach((track) => track.stop());
    context.close();
  };
}

export function releaseAudioSource(element) {
  const graph = mediaGraphs.get(element);
  if (!graph) return;
  mediaGraphs.delete(element);
  graph.mediaSource.disconnect();
  graph.highPass.disconnect();
  graph.analyser.disconnect();
  graph.analysisMonitor.disconnect();
  graph.context.close();
}
