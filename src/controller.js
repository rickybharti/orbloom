import { attachAudioSource, attachMicrophone, releaseAudioSource } from "./audio.js";
import { OrbEngine } from "./orb-engine.js";
import { resolveVariant } from "./presets.js";

function requireCanvas(canvas) {
  if (typeof HTMLCanvasElement === "undefined" || !(canvas instanceof HTMLCanvasElement)) {
    throw new TypeError("createOrb requires an HTMLCanvasElement.");
  }
  return canvas;
}

function resolveTheme(theme) {
  if (theme === undefined || typeof theme === "string") return resolveVariant(theme);
  if (!theme || typeof theme !== "object" || !Array.isArray(theme.accentColors)) {
    throw new TypeError("theme must be a registered variant ID or a resolved orb theme.");
  }
  return theme;
}

export class OrbController {
  constructor(canvas, options = {}) {
    this.canvas = requireCanvas(canvas);
    this.destroyed = false;
    this.paused = false;
    this.visible = true;
    this.pageVisible = typeof document === "undefined" || document.visibilityState === "visible";
    this.audioDetach = null;
    this.reducedMotionSetting = options.reducedMotion ?? "user";
    this.motionPreference = typeof matchMedia === "function"
      ? matchMedia("(prefers-reduced-motion: reduce)")
      : null;
    this.engine = new OrbEngine(canvas, {
      fixedTime: options.fixedTime,
      onError: options.onError,
      quality: options.quality,
      state: options.state,
      timeOffset: options.timeOffset,
      variant: resolveTheme(options.theme),
    });
    this.handleVisibility = () => {
      this.pageVisible = document.visibilityState === "visible";
      this.updateActivity();
    };
    this.handleMotionPreference = (event) => {
      if (this.reducedMotionSetting === "user") this.engine.setReducedMotion(event.matches);
    };
    this.resizeObserver = typeof ResizeObserver === "function"
      ? new ResizeObserver(() => this.resize())
      : null;
    this.intersectionObserver = typeof IntersectionObserver === "function"
      ? new IntersectionObserver(([entry]) => {
        this.visible = entry.isIntersecting;
        this.updateActivity();
      })
      : null;
    this.resizeObserver?.observe(canvas);
    this.intersectionObserver?.observe(canvas);
    this.motionPreference?.addEventListener("change", this.handleMotionPreference);
    document.addEventListener("visibilitychange", this.handleVisibility);
    this.engine.setReducedMotion(this.shouldReduceMotion());
    this.resize();
    this.engine.start();
  }

  shouldReduceMotion() {
    if (typeof this.reducedMotionSetting === "boolean") return this.reducedMotionSetting;
    return Boolean(this.motionPreference?.matches);
  }

  resize() {
    const bounds = this.canvas.getBoundingClientRect();
    const diameter = Math.max(1, Math.min(
      bounds.width || this.canvas.clientWidth || 264,
      bounds.height || this.canvas.clientHeight || bounds.width || 264,
    ));
    this.engine.resize(diameter, globalThis.devicePixelRatio || 1);
  }

  updateActivity() {
    this.engine.setActive(!this.destroyed && !this.paused && this.visible && this.pageVisible);
  }

  setTheme(theme) {
    const resolved = resolveTheme(theme);
    this.engine.setVariant(resolved);
    return resolved;
  }

  setState(state) {
    this.engine.setState(state);
  }

  setQuality(quality) {
    this.engine.setQuality(quality);
  }

  setAudioLevel(level) {
    this.engine.setAudioLevel(level);
  }

  setReducedMotion(value) {
    if (value !== "user" && typeof value !== "boolean") {
      throw new TypeError("reducedMotion must be true, false, or user.");
    }
    this.reducedMotionSetting = value;
    this.engine.setReducedMotion(this.shouldReduceMotion());
  }

  attachAudioSource(source, options) {
    this.disconnectAudio();
    this.audioDetach = attachAudioSource(source, (level) => this.setAudioLevel(level), options);
    return () => this.disconnectAudio();
  }

  async connectMicrophone(options) {
    this.disconnectAudio();
    this.audioDetach = await attachMicrophone(
      (level) => this.setAudioLevel(level),
      options,
    );
    return () => this.disconnectAudio();
  }

  disconnectAudio() {
    this.audioDetach?.();
    this.audioDetach = null;
    this.setAudioLevel(0);
  }

  releaseAudioSource(element) {
    releaseAudioSource(element);
  }

  pause() {
    this.paused = true;
    this.updateActivity();
  }

  resume() {
    this.paused = false;
    this.updateActivity();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.disconnectAudio();
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.motionPreference?.removeEventListener("change", this.handleMotionPreference);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.engine.destroy();
  }
}

export function createOrb(canvas, options) {
  return new OrbController(canvas, options);
}
