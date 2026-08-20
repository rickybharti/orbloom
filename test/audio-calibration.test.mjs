import assert from "node:assert/strict";
import test from "node:test";
import {
  AudioLevelCalibrator,
  measureRmsDb,
} from "../src/audio-calibration.js";
import {
  advanceOrbMotion,
  createOrbMotionState,
} from "../src/motion.js";

function processFrames(calibrator, levels, frameCount, startTime = 0) {
  const output = [];
  let time = startTime;
  for (let frame = 0; frame < frameCount; frame += 1) {
    time += 1 / 60;
    const levelDb = levels[frame % levels.length];
    output.push(calibrator.processDb(levelDb, time));
  }
  return { output, time };
}

function maximum(values) {
  return Math.max(...values);
}

test("measures AC energy while rejecting DC offset", () => {
  assert.equal(measureRmsDb(new Float32Array(1024).fill(0.4)), -120);
  const signal = Float32Array.from({ length: 4096 }, (_, index) => (
    0.3 + 0.5 * Math.sin(index / 16)
  ));
  assert.ok(Math.abs(measureRmsDb(signal) + 9.0309) < 0.05);
});

test("suppresses output during microphone warmup", () => {
  const calibrator = new AudioLevelCalibrator({ warmupSeconds: 0.35 });
  const early = processFrames(calibrator, [-19, -25, -21, -28], 20);
  assert.equal(maximum(early.output), 0);
  const ready = processFrames(calibrator, [-19, -25, -21, -28], 40, early.time);
  assert.ok(maximum(ready.output) > 0.2);
  assert.equal(calibrator.last.warmingUp, false);
});

test("opens for varied speech and closes after silence", () => {
  const calibrator = new AudioLevelCalibrator();
  const speech = processFrames(calibrator, [-18, -27, -21, -24, -16, -30], 180);
  assert.ok(maximum(speech.output) > 0.5);
  assert.equal(calibrator.last.active, true);
  const silence = processFrames(calibrator, [-120], 90, speech.time);
  assert.equal(silence.output.at(-1), 0);
  assert.equal(calibrator.last.active, false);
});

test("classifies steady background sound without sustained animation", () => {
  const calibrator = new AudioLevelCalibrator({ warmupSeconds: 0.35 });
  const noise = processFrames(calibrator, [-36], 240);
  assert.equal(noise.output.at(-1), 0);
  assert.equal(calibrator.last.stableNoise, true);
  assert.ok(calibrator.last.noiseFloorDb > -60);
});

test("keeps speech responsive after learning a room noise floor", () => {
  const calibrator = new AudioLevelCalibrator({ warmupSeconds: 0.35 });
  const room = processFrames(calibrator, [-43], 150);
  const speech = processFrames(calibrator, [-24, -31, -20, -27, -18, -29], 180, room.time);
  assert.ok(maximum(speech.output) > 0.45);
  assert.equal(calibrator.last.stableNoise, false);
});

test("preserves hysteresis through short gaps", () => {
  const calibrator = new AudioLevelCalibrator();
  const speech = processFrames(calibrator, [-18, -24], 60);
  const shortGap = processFrames(calibrator, [-90], 6, speech.time);
  assert.equal(calibrator.last.active, true);
  const longGap = processFrames(calibrator, [-90], 30, shortGap.time);
  assert.equal(longGap.output.at(-1), 0);
  assert.equal(calibrator.last.active, false);
});

test("drives bounded motion channels and settles after activity", () => {
  const calibrator = new AudioLevelCalibrator();
  const motion = createOrbMotionState(1.25);
  let time = 0;
  for (let frame = 0; frame < 180; frame += 1) {
    time += 1 / 60;
    const level = calibrator.processDb([-18, -27, -21, -24][frame % 4], time);
    advanceOrbMotion(motion, time, level);
  }
  assert.ok(motion.audioSmooth > 0.1);
  assert.ok(motion.audioFast > 0.1);
  assert.ok(Number.isFinite(motion.spin));

  for (let frame = 0; frame < 180; frame += 1) {
    time += 1 / 60;
    const level = calibrator.processDb(-120, time);
    advanceOrbMotion(motion, time, level);
  }
  assert.ok(motion.audioSmooth < 0.05);
  assert.ok(motion.audioFast < 0.05);
});
