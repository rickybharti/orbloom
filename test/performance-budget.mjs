import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  AudioLevelCalibrator,
  createOrbTheme,
  orbVariantIds,
  resolveVariant,
} from "../src/index.js";
import { advanceOrbMotion, createOrbMotionState } from "../src/motion.js";

function measure(name, iterations, minimumOpsPerSecond, operation) {
  const warmupIterations = Math.max(1000, Math.floor(iterations * 0.05));
  for (let index = 0; index < warmupIterations; index += 1) operation(index);

  const startedAt = performance.now();
  for (let index = 0; index < iterations; index += 1) operation(index);
  const durationMs = performance.now() - startedAt;
  const opsPerSecond = iterations / (durationMs / 1000);

  assert.ok(
    opsPerSecond >= minimumOpsPerSecond,
    `${name} fell below its regression floor: ${Math.round(opsPerSecond)} < ${minimumOpsPerSecond} ops/s`,
  );

  return {
    durationMs: Number(durationMs.toFixed(2)),
    iterations,
    minimumOpsPerSecond,
    opsPerSecond: Math.round(opsPerSecond),
  };
}

const motionState = createOrbMotionState(4.6);
const motion = measure("motion update", 750000, 100000, (index) => {
  advanceOrbMotion(motionState, index / 60, (index % 97) / 96, {
    drift: 0.8,
    speed: 1.1,
  });
});
assert.ok(Number.isFinite(motionState.spin));

const calibrator = new AudioLevelCalibrator({ warmupSeconds: 0 });
const audio = measure("audio calibration", 25000, 5000, (index) => {
  const cycle = index % 600;
  const levelDb = cycle < 180 ? -82 : -46 + (cycle % 47) * 0.72;
  calibrator.processDb(levelDb, index / 120);
});
assert.ok(calibrator.last.level >= 0 && calibrator.last.level <= 1);

const resolution = measure("variant resolution", 1000000, 250000, (index) => {
  resolveVariant(orbVariantIds[index % orbVariantIds.length]);
});

const themes = measure("custom theme creation", 50000, 10000, (index) => {
  createOrbTheme({
    id: `benchmark-${index}`,
    preset: orbVariantIds[index % orbVariantIds.length],
    seed: index * 0.017,
    appearance: {
      detail: (index % 101) / 100,
      glass: (index % 21) / 20,
      glow: (index % 41) / 20,
      intensity: 0.25 + (index % 36) * 0.05,
    },
  });
});

console.log(JSON.stringify({
  pass: true,
  benchmarkType: "deterministic CPU regression floors",
  runtime: process.version,
  results: { audio, motion, resolution, themes },
}, null, 2));
