import assert from "node:assert/strict";
import test from "node:test";
import * as packageApi from "../src/index.js";

const expectedExports = [
  "AudioLevelCalibrator",
  "DEFAULT_VARIANT_ID",
  "OrbController",
  "OrbEngine",
  "attachAudioSource",
  "attachMicrophone",
  "audioCalibrationDefaults",
  "createOrb",
  "createOrbTheme",
  "measureRmsDb",
  "orbArchetypes",
  "orbCustomizationDefaults",
  "orbQualityProfiles",
  "orbStates",
  "orbVariantDefinitions",
  "orbVariantIds",
  "releaseAudioSource",
  "resolveVariant",
];

test("exports the complete public API", () => {
  assert.deepEqual(Object.keys(packageApi).sort(), expectedExports.sort());
});

test("resolves every immutable visual variant", () => {
  assert.equal(packageApi.orbVariantIds.length, 36);
  assert.equal(new Set(packageApi.orbVariantIds).size, 36);
  for (const id of packageApi.orbVariantIds) {
    const definition = packageApi.orbVariantDefinitions[id];
    const variant = packageApi.resolveVariant(id);
    assert.equal(variant.id, id);
    assert.equal(variant.accentColors.length, 3);
    assert.ok(packageApi.orbArchetypes.includes(variant.archetype));
    assert.ok(Number.isFinite(variant.phase));
    assert.ok(Object.isFrozen(definition));
    assert.ok(Object.isFrozen(variant));
  }
});

test("falls back safely for an unknown variant", () => {
  assert.equal(packageApi.resolveVariant("missing-variant").id, packageApi.DEFAULT_VARIANT_ID);
});

test("creates a frozen company theme without changing its source preset", () => {
  const source = packageApi.resolveVariant("nebula-violet-02");
  const theme = packageApi.createOrbTheme({
    preset: source.id,
    id: "company-primary",
    seed: -1,
    colors: {
      base: "#101820",
      interior: "#020408",
      accents: ["#0066FF", "#00D4FF", "#FFFFFF"],
    },
    appearance: { detail: 0.72, glass: 0.35, glow: 0.8, intensity: 0.9 },
    motion: { drift: 0.6, speed: 0.75 },
    audioResponse: { brightness: 1.2, motion: 0.55, pulse: 0.85 },
  });
  assert.equal(theme.id, "company-primary");
  assert.equal(theme.sourceVariantId, source.id);
  assert.equal(theme.archetype, source.archetype);
  assert.ok(theme.phase >= 0 && theme.phase < Math.PI * 2);
  assert.equal(theme.lensStrength, 0.35);
  assert.deepEqual(theme.appearance, { detail: 0.72, glow: 0.8, intensity: 0.9 });
  assert.deepEqual(theme.motion, { drift: 0.6, speed: 0.75 });
  assert.deepEqual(theme.audioResponse, { brightness: 1.2, motion: 0.55, pulse: 0.85 });
  assert.ok(Object.isFrozen(theme));
  assert.ok(Object.isFrozen(theme.appearance));
  assert.ok(Object.isFrozen(theme.motion));
  assert.ok(Object.isFrozen(theme.audioResponse));
  assert.deepEqual(packageApi.resolveVariant(source.id), source);
});

test("rejects malformed customization instead of silently producing a broken orb", () => {
  assert.throws(() => packageApi.createOrbTheme({ preset: "missing" }), RangeError);
  assert.throws(() => packageApi.createOrbTheme({ id: "Company Theme" }), TypeError);
  assert.throws(() => packageApi.createOrbTheme({ colors: { base: "blue" } }), TypeError);
  assert.throws(() => packageApi.createOrbTheme({ colors: { accents: ["#FFFFFF"] } }), TypeError);
  assert.throws(() => packageApi.createOrbTheme({ appearance: { detail: 2 } }), RangeError);
  assert.throws(() => packageApi.createOrbTheme({ motion: { speed: -1 } }), RangeError);
  assert.throws(() => packageApi.createOrbTheme({ audioResponse: { brightness: 3 } }), RangeError);
  assert.throws(() => packageApi.createOrbTheme({ unsupported: true }), TypeError);
});

test("publishes a small, immutable state and quality vocabulary", () => {
  assert.deepEqual(packageApi.orbStates, [
    "idle", "listening", "thinking", "speaking", "success", "error",
  ]);
  assert.deepEqual(Object.keys(packageApi.orbQualityProfiles), ["low", "balanced", "high"]);
  assert.ok(Object.isFrozen(packageApi.orbStates));
  assert.ok(Object.isFrozen(packageApi.orbQualityProfiles));
  assert.equal(packageApi.orbQualityProfiles.high.maxResolution, 1280);
});

test("measures RMS in dBFS after removing DC", () => {
  assert.equal(packageApi.measureRmsDb(new Float32Array(64).fill(0.5)), -120);
  const sine = Float32Array.from({ length: 4096 }, (_, index) => (
    Math.sin((index / 4096) * Math.PI * 2)
  ));
  assert.ok(Math.abs(packageApi.measureRmsDb(sine) + 3.0103) < 0.01);
});

test("calibrates speech and returns to silence", () => {
  const calibrator = new packageApi.AudioLevelCalibrator();
  let timestamp = 0;
  let peak = 0;
  for (let frame = 0; frame < 120; frame += 1) {
    timestamp += 1 / 60;
    peak = Math.max(peak, calibrator.processDb(-20, timestamp));
  }
  assert.ok(peak > 0.5);
  let level = peak;
  for (let frame = 0; frame < 120; frame += 1) {
    timestamp += 1 / 60;
    level = calibrator.processDb(-120, timestamp);
  }
  assert.equal(level, 0);
  assert.equal(calibrator.last.active, false);
});

test("keeps public defaults immutable", () => {
  assert.ok(Object.isFrozen(packageApi.audioCalibrationDefaults));
  assert.ok(Object.isFrozen(packageApi.orbCustomizationDefaults));
  assert.equal(packageApi.audioCalibrationDefaults.outputGamma, 1.6);
});

test("rejects unsafe audio calibration options", () => {
  assert.throws(() => new packageApi.AudioLevelCalibrator(null), TypeError);
  assert.throws(() => new packageApi.AudioLevelCalibrator({ unsupported: true }), TypeError);
  assert.throws(() => new packageApi.AudioLevelCalibrator({ outputGamma: 0 }), RangeError);
  assert.throws(() => new packageApi.AudioLevelCalibrator({ noiseWindowSeconds: Number.NaN }), RangeError);
  assert.throws(() => new packageApi.AudioLevelCalibrator({ closeMarginDb: 12 }), RangeError);
  assert.throws(() => new packageApi.AudioLevelCalibrator({ stableNoiseMinimumSeconds: 1 }), RangeError);
  assert.ok(Object.isFrozen(new packageApi.AudioLevelCalibrator().options));
});
