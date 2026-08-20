import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  AudioLevelCalibrator,
  createOrbTheme,
  orbVariantIds,
  resolveVariant,
} from "../src/index.js";
import { advanceOrbMotion, createOrbMotionState } from "../src/motion.js";

let randomState = 0x6d2b79f5;
function random() {
  randomState = Math.imul(randomState ^ (randomState >>> 15), 1 | randomState);
  randomState ^= randomState + Math.imul(randomState ^ (randomState >>> 7), 61 | randomState);
  return ((randomState ^ (randomState >>> 14)) >>> 0) / 4294967296;
}

function randomHexColor() {
  return `#${Math.floor(random() * 0x1000000).toString(16).padStart(6, "0").toUpperCase()}`;
}

const startedAt = performance.now();
let motionFrames = 0;
for (const id of orbVariantIds) {
  const variant = resolveVariant(id);
  const state = createOrbMotionState(variant.phase);
  let time = variant.phase * 31;
  for (let frame = 0; frame < 10000; frame += 1) {
    time += frame % 997 === 0 ? 0.4 : 1 / (30 + Math.floor(random() * 91));
    const speech = Math.sin(frame * 0.019 + variant.phase) > -0.45;
    const audioLevel = speech ? Math.pow(random(), 0.7) : random() * 0.03;
    advanceOrbMotion(state, time, audioLevel);
    for (const field of ["audioSmooth", "audioFast", "spinVel", "spin", "lastT"]) {
      assert.ok(Number.isFinite(state[field]), `${id}.${field} became non-finite`);
    }
    assert.ok(state.audioSmooth >= 0 && state.audioSmooth <= 1);
    assert.ok(state.audioFast >= 0 && state.audioFast <= 1);
    assert.ok(state.spinDir === 1 || state.spinDir === -1);
    motionFrames += 1;
  }
}

const calibrator = new AudioLevelCalibrator({ warmupSeconds: 0.35 });
let timestamp = 0;
let audioFrames = 0;
let maximumLevel = 0;
for (let frame = 0; frame < 100000; frame += 1) {
  timestamp += frame % 4093 === 0 ? 0.25 : 1 / (45 + Math.floor(random() * 76));
  const cycle = frame % 2400;
  let levelDb;
  if (cycle < 500) levelDb = -96 + random() * 4;
  else if (cycle < 900) levelDb = -48 + random() * 1.2;
  else if (cycle < 1900) levelDb = -35 + random() * 24;
  else levelDb = random() < 0.015 ? -3 : -80 + random() * 8;
  const level = calibrator.processDb(levelDb, timestamp);
  assert.ok(Number.isFinite(level));
  assert.ok(level >= 0 && level <= 1);
  for (const field of ["levelDb", "noiseFloorDb", "gateOpenDb", "gateCloseDb", "speechReferenceDb"]) {
    assert.ok(Number.isFinite(calibrator.last[field]), `${field} became non-finite`);
  }
  maximumLevel = Math.max(maximumLevel, level);
  audioFrames += 1;
}
assert.ok(maximumLevel > 0.9);

for (let iteration = 0; iteration < 200000; iteration += 1) {
  const id = iteration % 17 === 0
    ? `unknown-${iteration}`
    : orbVariantIds[Math.floor(random() * orbVariantIds.length)];
  const variant = resolveVariant(id);
  assert.ok(orbVariantIds.includes(variant.id));
  assert.ok(Object.isFrozen(variant));
}

let customThemes = 0;
for (let iteration = 0; iteration < 20000; iteration += 1) {
  const preset = orbVariantIds[Math.floor(random() * orbVariantIds.length)];
  const theme = createOrbTheme({
    preset,
    id: `generated-${iteration}`,
    seed: (random() - 0.5) * 100000,
    colors: {
      base: randomHexColor(),
      interior: randomHexColor(),
      accents: [randomHexColor(), randomHexColor(), randomHexColor()],
    },
    appearance: {
      detail: random(),
      glass: random(),
      glow: random() * 2,
      intensity: 0.25 + random() * 1.75,
    },
    motion: { drift: random() * 2, speed: random() * 2 },
    audioResponse: {
      brightness: random() * 2,
      motion: random() * 2,
      pulse: random() * 2,
    },
  });
  assert.equal(theme.sourceVariantId, preset);
  assert.ok(theme.phase >= 0 && theme.phase < Math.PI * 2);
  assert.ok(theme.lensStrength >= 0 && theme.lensStrength <= 1);
  assert.ok(Object.isFrozen(theme));
  assert.ok(Object.isFrozen(theme.accentColors));
  const customMotionState = createOrbMotionState(theme.phase);
  for (let frame = 0; frame < 10; frame += 1) {
    advanceOrbMotion(
      customMotionState,
      iteration / 60 + frame / 60,
      random(),
      theme.motion,
    );
  }
  assert.ok(Number.isFinite(customMotionState.spin));
  assert.ok(Number.isFinite(customMotionState.spinVel));
  customThemes += 1;
}

console.log(JSON.stringify({
  pass: true,
  motionFrames,
  audioFrames,
  variantResolutions: 200000,
  customThemes,
  maximumAudioLevel: Number(maximumLevel.toFixed(6)),
  durationMs: Number((performance.now() - startedAt).toFixed(1)),
}, null, 2));
