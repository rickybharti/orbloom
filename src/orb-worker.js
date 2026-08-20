import { OrbEngine } from "./orb-engine.js";

let engine;

self.addEventListener("message", (event) => {
  const { type } = event.data || {};

  try {
    if (type === "init") {
      engine = new OrbEngine(event.data.canvas, {
        fixedTime: event.data.fixedTime,
        quality: event.data.quality,
        state: event.data.state,
        variant: event.data.variant,
        timeOffset: event.data.timeOffset,
        onError: (error) => self.postMessage({ type: "error", message: error.message }),
      });
      engine.resize(event.data.diameter, event.data.devicePixelRatio);
      engine.setReducedMotion(event.data.reducedMotion);
      engine.start();
      self.postMessage({ type: "ready" });
      return;
    }

    if (!engine) return;
    if (type === "resize") engine.resize(event.data.diameter, event.data.devicePixelRatio);
    if (type === "variant") engine.setVariant(event.data.variant);
    if (type === "audio-level") engine.setAudioLevel(event.data.value);
    if (type === "active") engine.setActive(event.data.value);
    if (type === "quality") engine.setQuality(event.data.value);
    if (type === "state") engine.setState(event.data.value);
    if (type === "reduced-motion") engine.setReducedMotion(event.data.value);
    if (type === "destroy") {
      engine.destroy();
      engine = undefined;
      self.close();
    }
  } catch (error) {
    self.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
});
