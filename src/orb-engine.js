import { advanceOrbMotion, createOrbMotionState } from "./motion.js";
import { resolveOrbQuality, resolveOrbState } from "./customization.js";
import { resolveVariant } from "./presets.js";
import {
  compactFragmentShaderSource,
  fragmentShaderSource,
  vertexShaderSource,
} from "./shaders.js";

const INTERNAL_SIZE = 1280;
const STATE_INDICES = Object.freeze({
  idle: 0,
  listening: 1,
  thinking: 2,
  speaking: 3,
  success: 4,
  error: 5,
});

function makeInternalCanvas() {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(INTERNAL_SIZE, INTERNAL_SIZE);
  }

  const canvas = document.createElement("canvas");
  canvas.width = INTERNAL_SIZE;
  canvas.height = INTERNAL_SIZE;
  return canvas;
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const reason = gl.getShaderInfoLog(shader) || "Unknown shader compile failure";
    gl.deleteShader(shader);
    throw new Error(reason);
  }

  return shader;
}

function createProgram(gl, fragmentSource) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.bindAttribLocation(program, 0, "aPosition");
  gl.bindAttribLocation(program, 1, "aTextureCoord");
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const reason = gl.getProgramInfoLog(program) || "Unknown shader link failure";
    gl.deleteProgram(program);
    throw new Error(reason);
  }

  return program;
}

export class OrbEngine {
  constructor(visibleCanvas, {
    fixedTime = null,
    onError = () => {},
    quality = "high",
    state = "idle",
    variant,
    timeOffset = 4000 * Math.random(),
  } = {}) {
    this.visibleCanvas = visibleCanvas;
    this.onError = onError;
    this.variant = variant ?? resolveVariant();
    this.quality = quality;
    this.qualityProfile = resolveOrbQuality(quality);
    this.state = resolveOrbState(state);
    this.internalCanvas = makeInternalCanvas();
    this.visibleContext = visibleCanvas.getContext("2d", { alpha: true });
    this.gl = this.internalCanvas.getContext("webgl", {
      premultipliedAlpha: true,
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
    });

    if (!this.visibleContext || !this.gl) {
      throw new Error("This browser could not create the required canvas contexts.");
    }

    this.batchExtension = this.gl.getExtension("ANGLE_instanced_arrays");
    this.compactPipeline = this.variant.lensStrength <= 0 && Boolean(this.batchExtension);
    this.program = null;
    this.locations = null;
    this.buffer = null;
    this.ready = false;
    this.diameter = 528;
    this.requestedDevicePixelRatio = 1;
    this.devicePixelRatio = 1;
    this.renderDiameter = 528;
    this.active = true;
    this.reducedMotion = false;
    this.destroyed = false;
    this.targetAudioLevel = 0;
    this.stateBlend = 1;
    this.lastStateFrameAt = null;
    this.motionState = createOrbMotionState(this.variant.phase);
    this.timeOffset = timeOffset;
    this.fixedTime = Number.isFinite(fixedTime) ? fixedTime : null;
    this.lastFrameAt = 0;
    this.timer = 0;
    this.frame = this.frame.bind(this);
    this.handleContextLost = this.handleContextLost.bind(this);
    this.handleContextRestored = this.handleContextRestored.bind(this);

    this.internalCanvas.addEventListener?.("webglcontextlost", this.handleContextLost);
    this.internalCanvas.addEventListener?.("webglcontextrestored", this.handleContextRestored);
    this.initializeGlResources();
    this.visibleContext.globalCompositeOperation = "copy";
  }

  initializeGlResources() {
    const gl = this.gl;
    const fragmentSource = this.compactPipeline
      ? compactFragmentShaderSource
      : fragmentShaderSource;
    this.program = createProgram(gl, fragmentSource);
    this.locations = this.getLocations();
    this.buffer = this.createQuad();
    this.gl.disable(this.gl.DEPTH_TEST);
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
    this.gl.enable(this.gl.SCISSOR_TEST);
    this.gl.useProgram(this.program);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
    this.gl.enableVertexAttribArray(this.locations.position);
    this.gl.vertexAttribPointer(this.locations.position, 2, this.gl.FLOAT, false, 16, 0);
    this.gl.enableVertexAttribArray(this.locations.textureCoord);
    this.gl.vertexAttribPointer(this.locations.textureCoord, 2, this.gl.FLOAT, false, 16, 8);
    this.visibleContext.globalCompositeOperation = "copy";
    this.setStaticUniforms();
    this.ready = true;
  }

  getLocations() {
    const gl = this.gl;
    const uniformNames = [
      "uResolution",
      "uInteriorColor",
      "uBaseColor",
      "uAccentPrimary",
      "uAccentSecondary",
      "uAccentHighlight",
      "uTime",
      "uSeed",
      "uAudioBrightness",
      "uAudioPulse",
      "uSpin",
      "uArchetype",
      "uGlass",
      "uVisualIntensity",
      "uDetail",
      "uGlow",
      "uState",
      "uStateBlend",
    ];
    const locations = {
      position: gl.getAttribLocation(this.program, "aPosition"),
      textureCoord: gl.getAttribLocation(this.program, "aTextureCoord"),
    };
    for (const name of uniformNames) {
      locations[name] = gl.getUniformLocation(this.program, name);
    }
    return locations;
  }

  createQuad() {
    const gl = this.gl;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1, 0, 1,
        1, -1, 1, 1,
        -1, 1, 0, 0,
        1, 1, 1, 0,
      ]),
      gl.STATIC_DRAW,
    );
    return buffer;
  }

  setStaticUniforms() {
    const gl = this.gl;
    const appearance = this.variant.appearance ?? { detail: 1, glow: 1, intensity: 1 };
    gl.useProgram(this.program);
    gl.uniform3f(this.locations.uInteriorColor, ...(this.variant.interiorColor ?? [0, 0, 0]));
    gl.uniform3f(this.locations.uBaseColor, ...this.variant.baseColor);
    gl.uniform3f(this.locations.uAccentPrimary, ...this.variant.accentColors[0]);
    gl.uniform3f(this.locations.uAccentSecondary, ...this.variant.accentColors[1]);
    gl.uniform3f(this.locations.uAccentHighlight, ...this.variant.accentColors[2]);
    gl.uniform1f(this.locations.uSeed, this.variant.phase);
    gl.uniform1f(this.locations.uArchetype, this.variant.archetypeIndex);
    gl.uniform1f(this.locations.uGlass, this.variant.lensStrength);
    gl.uniform1f(this.locations.uVisualIntensity, appearance.intensity);
    gl.uniform1f(this.locations.uDetail, appearance.detail);
    gl.uniform1f(this.locations.uGlow, appearance.glow);
  }

  resize(diameter, devicePixelRatio) {
    this.diameter = Math.max(1, Math.round(diameter));
    this.requestedDevicePixelRatio = Math.max(1, devicePixelRatio || 1);
    this.devicePixelRatio = Math.min(
      this.qualityProfile.maxPixelRatio,
      this.requestedDevicePixelRatio,
    );
    this.renderDiameter = Math.min(
      this.qualityProfile.maxResolution,
      Math.max(1, Math.round(this.diameter * this.devicePixelRatio)),
    );

    if (this.visibleCanvas.width !== this.renderDiameter) {
      this.visibleCanvas.width = this.renderDiameter;
    }
    if (this.visibleCanvas.height !== this.renderDiameter) {
      this.visibleCanvas.height = this.renderDiameter;
    }
    this.visibleContext.globalCompositeOperation = "copy";
    this.render(performance.now());
  }

  setAudioLevel(value) {
    this.targetAudioLevel = Math.min(1, Math.max(0, Number(value) || 0));
  }

  setVariant(variant) {
    this.variant = variant;
    this.motionState.phase = variant.phase;
    const useCompactPipeline = variant.lensStrength <= 0 && Boolean(this.batchExtension);
    if (useCompactPipeline !== this.compactPipeline) {
      if (this.buffer) this.gl.deleteBuffer(this.buffer);
      if (this.program) this.gl.deleteProgram(this.program);
      this.compactPipeline = useCompactPipeline;
      this.initializeGlResources();
    } else {
      this.setStaticUniforms();
    }
    this.render(performance.now());
  }

  setQuality(quality) {
    this.quality = quality;
    this.qualityProfile = resolveOrbQuality(quality);
    this.resize(this.diameter, this.requestedDevicePixelRatio);
  }

  setState(state) {
    this.state = resolveOrbState(state);
    this.stateBlend = this.reducedMotion ? 1 : 0;
    this.lastStateFrameAt = null;
    this.render(performance.now());
  }

  setActive(active) {
    this.active = Boolean(active);
    if (this.active) this.requestFrame();
  }

  setReducedMotion(reduced) {
    this.reducedMotion = Boolean(reduced);
    if (this.reducedMotion) this.stateBlend = 1;
    this.render(performance.now());
    if (!this.reducedMotion) this.requestFrame();
  }

  requestFrame() {
    if (this.destroyed || this.timer || !this.active || this.reducedMotion) return;
    if (typeof requestAnimationFrame === "function") {
      this.timer = requestAnimationFrame(this.frame);
    } else {
      this.timer = setTimeout(
        () => this.frame(performance.now()),
        1000 / this.qualityProfile.frameRate,
      );
    }
  }

  frame(now) {
    this.timer = 0;
    if (!this.active || this.destroyed || this.reducedMotion) return;
    const elapsed = now - this.lastFrameAt;
    const frameDuration = 1000 / this.qualityProfile.frameRate;
    if (elapsed < frameDuration) {
      this.requestFrame();
      return;
    }
    this.lastFrameAt = now - (elapsed % frameDuration);
    this.render(now);
    this.requestFrame();
  }

  render(now) {
    if (!this.ready) return false;
    const gl = this.gl;
    const time = this.fixedTime ?? now / 1000 + this.timeOffset;
    const audioResponse = this.variant.audioResponse ?? { brightness: 1, motion: 1, pulse: 1 };
    advanceOrbMotion(
      this.motionState,
      time,
      Math.min(1, this.targetAudioLevel * audioResponse.motion),
      this.variant.motion,
    );
    const stateDelta = this.lastStateFrameAt === null
      ? 0
      : Math.min(0.1, Math.max(0, (now - this.lastStateFrameAt) / 1000));
    this.lastStateFrameAt = now;
    this.stateBlend += (1 - this.stateBlend)
      * (stateDelta > 0 ? 1 - Math.exp(-stateDelta / 0.18) : 0);

    const viewportY = INTERNAL_SIZE - this.renderDiameter;
    gl.viewport(0, viewportY, this.renderDiameter, this.renderDiameter);
    gl.scissor(0, viewportY, this.renderDiameter, this.renderDiameter);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.uniform2f(this.locations.uResolution, this.renderDiameter, this.renderDiameter);
    gl.uniform1f(this.locations.uTime, time);
    gl.uniform1f(
      this.locations.uAudioBrightness,
      Math.min(1, this.motionState.audioSmooth * audioResponse.brightness),
    );
    gl.uniform1f(
      this.locations.uAudioPulse,
      Math.min(1, this.motionState.audioSmooth * audioResponse.pulse),
    );
    gl.uniform1f(this.locations.uSpin, this.motionState.spin);
    gl.uniform1f(this.locations.uState, STATE_INDICES[this.state]);
    gl.uniform1f(this.locations.uStateBlend, this.stateBlend);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    this.visibleContext.drawImage(
      this.internalCanvas,
      0,
      0,
      this.renderDiameter,
      this.renderDiameter,
      0,
      0,
      this.renderDiameter,
      this.renderDiameter,
    );
    return true;
  }

  start() {
    const now = performance.now();
    this.render(now);
    this.lastFrameAt = now;
    this.requestFrame();
  }

  handleContextLost(event) {
    event.preventDefault?.();
    this.ready = false;
  }

  handleContextRestored() {
    try {
      this.initializeGlResources();
      this.render(performance.now());
      this.requestFrame();
    } catch (error) {
      this.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  destroy() {
    this.destroyed = true;
    if (this.timer) {
      if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(this.timer);
      else clearTimeout(this.timer);
    }
    const gl = this.gl;
    this.internalCanvas.removeEventListener?.("webglcontextlost", this.handleContextLost);
    this.internalCanvas.removeEventListener?.("webglcontextrestored", this.handleContextRestored);
    if (this.buffer) gl.deleteBuffer(this.buffer);
    if (this.program) gl.deleteProgram(this.program);
  }
}
