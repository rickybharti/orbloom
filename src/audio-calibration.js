const DEFAULTS = Object.freeze({
  absoluteGateDb: -55,
  initialNoiseFloorDb: -60,
  minimumNoiseFloorDb: -96,
  maximumNoiseFloorDb: -24,
  openMarginDb: 11,
  closeMarginDb: 8,
  hangoverSeconds: 0.2,
  noiseWindowSeconds: 6,
  stableNoiseWindowSeconds: 0.6,
  stableNoiseMinimumSeconds: 0.3,
  stableNoiseDeviationDb: 1.25,
  stableNoiseCeilingDb: -28,
  noiseRiseSeconds: 3,
  stableNoiseRiseSeconds: 0.35,
  activeNoiseRiseSeconds: 12,
  noiseFallSeconds: 0.12,
  referenceWindowSeconds: 4,
  initialSpeechReferenceDb: -22,
  minimumSpeechReferenceDb: -32,
  maximumSpeechReferenceDb: -12,
  minimumSpeechRangeDb: 12,
  louderReferenceSeconds: 0.65,
  quieterReferenceSeconds: 1.4,
  referencePercentile: 0.95,
  outputGamma: 1.6,
  warmupSeconds: 0,
});

const DECIBEL_OPTIONS = [
  "absoluteGateDb",
  "initialNoiseFloorDb",
  "minimumNoiseFloorDb",
  "maximumNoiseFloorDb",
  "stableNoiseCeilingDb",
  "initialSpeechReferenceDb",
  "minimumSpeechReferenceDb",
  "maximumSpeechReferenceDb",
];

const POSITIVE_OPTIONS = [
  "noiseWindowSeconds",
  "stableNoiseWindowSeconds",
  "noiseRiseSeconds",
  "stableNoiseRiseSeconds",
  "activeNoiseRiseSeconds",
  "noiseFallSeconds",
  "referenceWindowSeconds",
  "minimumSpeechRangeDb",
  "louderReferenceSeconds",
  "quieterReferenceSeconds",
  "outputGamma",
];

const NON_NEGATIVE_OPTIONS = [
  "openMarginDb",
  "closeMarginDb",
  "hangoverSeconds",
  "stableNoiseMinimumSeconds",
  "stableNoiseDeviationDb",
  "warmupSeconds",
];

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function approach(current, target, deltaSeconds, timeConstant) {
  if (!(deltaSeconds > 0)) return current;
  return current + (target - current) * (1 - Math.exp(-deltaSeconds / timeConstant));
}

function percentile(values, fraction) {
  if (values.length === 0) return Number.NaN;
  const ordered = [...values].sort((left, right) => left - right);
  const index = (ordered.length - 1) * clamp(fraction, 0, 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const mix = index - lower;
  return ordered[lower] * (1 - mix) + ordered[upper] * mix;
}

function standardDeviation(values) {
  if (values.length < 2) return Number.POSITIVE_INFINITY;
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const variance = values.reduce((total, value) => {
    const difference = value - mean;
    return total + difference * difference;
  }, 0) / values.length;
  return Math.sqrt(variance);
}

function requireFiniteRange(options, name, minimum, maximum, minimumInclusive = true) {
  const value = options[name];
  const aboveMinimum = minimumInclusive ? value >= minimum : value > minimum;
  if (!Number.isFinite(value) || !aboveMinimum || value > maximum) {
    const lower = minimumInclusive ? "between" : "greater than";
    const upper = minimumInclusive ? ` and ${maximum}` : ` and no more than ${maximum}`;
    throw new RangeError(`${name} must be ${lower} ${minimum}${upper}.`);
  }
}

function normalizeOptions(options) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("Audio calibration options must be an object.");
  }
  for (const key of Object.keys(options)) {
    if (!Object.hasOwn(DEFAULTS, key)) {
      throw new TypeError(`${key} is not a supported audio calibration option.`);
    }
  }

  const normalized = { ...DEFAULTS, ...options };
  for (const name of DECIBEL_OPTIONS) requireFiniteRange(normalized, name, -120, 0);
  for (const name of POSITIVE_OPTIONS) requireFiniteRange(normalized, name, 0, 120, false);
  for (const name of NON_NEGATIVE_OPTIONS) requireFiniteRange(normalized, name, 0, 120);
  requireFiniteRange(normalized, "referencePercentile", 0, 1);

  if (normalized.minimumNoiseFloorDb > normalized.initialNoiseFloorDb
      || normalized.initialNoiseFloorDb > normalized.maximumNoiseFloorDb) {
    throw new RangeError("initialNoiseFloorDb must be between the minimum and maximum noise floor.");
  }
  if (normalized.minimumSpeechReferenceDb > normalized.initialSpeechReferenceDb
      || normalized.initialSpeechReferenceDb > normalized.maximumSpeechReferenceDb) {
    throw new RangeError("initialSpeechReferenceDb must be between the minimum and maximum speech reference.");
  }
  if (normalized.closeMarginDb > normalized.openMarginDb) {
    throw new RangeError("closeMarginDb must not exceed openMarginDb.");
  }
  if (normalized.stableNoiseMinimumSeconds > normalized.stableNoiseWindowSeconds) {
    throw new RangeError("stableNoiseMinimumSeconds must not exceed stableNoiseWindowSeconds.");
  }
  return Object.freeze(normalized);
}

export function measureRmsDb(samples) {
  if (!samples?.length) return -120;

  let mean = 0;
  for (let index = 0; index < samples.length; index += 1) mean += samples[index];
  mean /= samples.length;

  let energy = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const centered = samples[index] - mean;
    energy += centered * centered;
  }

  const rms = Math.sqrt(energy / samples.length);
  return clamp(20 * Math.log10(Math.max(rms, 1e-6)), -120, 0);
}

export class AudioLevelCalibrator {
  constructor(options = {}) {
    this.options = normalizeOptions(options);
    this.reset();
  }

  reset() {
    const { initialNoiseFloorDb, initialSpeechReferenceDb } = this.options;
    this.time = 0;
    this.lastTimestamp = null;
    this.noiseFloorDb = initialNoiseFloorDb;
    this.speechReferenceDb = initialSpeechReferenceDb;
    this.active = false;
    this.belowGateSeconds = 0;
    this.noiseLevels = [];
    this.speechLevels = [];
    this.last = Object.freeze({
      level: 0,
      levelDb: -120,
      noiseFloorDb: this.noiseFloorDb,
      gateOpenDb: this.options.absoluteGateDb,
      gateCloseDb: this.options.absoluteGateDb,
      speechReferenceDb: this.speechReferenceDb,
      active: false,
      stableNoise: false,
      warmingUp: this.options.warmupSeconds > 0,
    });
  }

  process(samples, timestampSeconds) {
    return this.processDb(measureRmsDb(samples), timestampSeconds);
  }

  processDb(levelDb, timestampSeconds) {
    const numericTimestamp = Number(timestampSeconds);
    const hasTimestamp = Number.isFinite(numericTimestamp);
    let deltaSeconds = 1 / 60;
    if (hasTimestamp && this.lastTimestamp !== null) {
      deltaSeconds = clamp(numericTimestamp - this.lastTimestamp, 1 / 240, 0.1);
    }
    if (hasTimestamp) this.lastTimestamp = numericTimestamp;
    this.time += deltaSeconds;

    const numericLevelDb = Number(levelDb);
    const measuredDb = clamp(Number.isFinite(numericLevelDb) ? numericLevelDb : -120, -120, 0);
    this.noiseLevels.push({ time: this.time, value: measuredDb });
    const noiseCutoff = this.time - this.options.noiseWindowSeconds;
    while (this.noiseLevels[0]?.time < noiseCutoff) this.noiseLevels.shift();

    const stableCutoff = this.time - this.options.stableNoiseWindowSeconds;
    const stableEntries = this.noiseLevels.filter((entry) => entry.time >= stableCutoff);
    const stableValues = stableEntries.map((entry) => entry.value);
    const stableDuration = stableEntries.length > 1
      ? stableEntries.at(-1).time - stableEntries[0].time
      : 0;
    const stableNoise = stableDuration >= this.options.stableNoiseMinimumSeconds
      && measuredDb <= this.options.stableNoiseCeilingDb
      && standardDeviation(stableValues) <= this.options.stableNoiseDeviationDb;

    const noiseTarget = clamp(
      percentile(this.noiseLevels.map((entry) => entry.value), 0.2),
      this.options.minimumNoiseFloorDb,
      this.options.maximumNoiseFloorDb,
    );
    const noiseTimeConstant = noiseTarget < this.noiseFloorDb
      ? this.options.noiseFallSeconds
      : stableNoise
        ? this.options.stableNoiseRiseSeconds
        : this.active
          ? this.options.activeNoiseRiseSeconds
          : this.options.noiseRiseSeconds;
    this.noiseFloorDb = approach(
      this.noiseFloorDb,
      noiseTarget,
      deltaSeconds,
      noiseTimeConstant,
    );

    const gateOpenDb = Math.max(
      this.options.absoluteGateDb,
      this.noiseFloorDb + this.options.openMarginDb,
    );
    const gateCloseDb = Math.max(
      this.options.absoluteGateDb - 3,
      this.noiseFloorDb + this.options.closeMarginDb,
    );

    if (this.active) {
      if (measuredDb >= gateCloseDb) {
        this.belowGateSeconds = 0;
      } else {
        this.belowGateSeconds += deltaSeconds;
        if (this.belowGateSeconds >= this.options.hangoverSeconds) {
          this.active = false;
          this.belowGateSeconds = 0;
        }
      }
    } else if (measuredDb >= gateOpenDb) {
      this.active = true;
      this.belowGateSeconds = 0;
    }

    if (this.active && !stableNoise && measuredDb >= gateOpenDb) {
      this.speechLevels.push({ time: this.time, value: measuredDb });
    }
    const speechCutoff = this.time - this.options.referenceWindowSeconds;
    while (this.speechLevels[0]?.time < speechCutoff) this.speechLevels.shift();

    if (this.speechLevels.length >= 12) {
      const minimumReference = Math.min(
        this.options.maximumSpeechReferenceDb,
        Math.max(
          this.options.minimumSpeechReferenceDb,
          gateOpenDb + this.options.minimumSpeechRangeDb,
        ),
      );
      const referenceTarget = clamp(
        percentile(
          this.speechLevels.map((entry) => entry.value),
          this.options.referencePercentile,
        ),
        minimumReference,
        this.options.maximumSpeechReferenceDb,
      );
      const referenceTimeConstant = referenceTarget > this.speechReferenceDb
        ? this.options.louderReferenceSeconds
        : this.options.quieterReferenceSeconds;
      this.speechReferenceDb = approach(
        this.speechReferenceDb,
        referenceTarget,
        deltaSeconds,
        referenceTimeConstant,
      );
    }

    const speechRangeDb = Math.max(
      this.options.minimumSpeechRangeDb,
      this.speechReferenceDb - gateOpenDb,
    );
    const normalized = clamp((measuredDb - gateOpenDb) / speechRangeDb, 0, 1);
    const warmingUp = this.time < this.options.warmupSeconds;
    const level = this.active && !stableNoise && !warmingUp
      ? Math.pow(normalized, this.options.outputGamma)
      : 0;

    this.last = Object.freeze({
      level,
      levelDb: measuredDb,
      noiseFloorDb: this.noiseFloorDb,
      gateOpenDb,
      gateCloseDb,
      speechReferenceDb: this.speechReferenceDb,
      active: this.active,
      stableNoise,
      warmingUp,
    });
    return level;
  }
}

export const audioCalibrationDefaults = DEFAULTS;
