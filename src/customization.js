import {
  DEFAULT_VARIANT_ID,
  orbVariantDefinitions,
  resolveVariant,
} from "./presets.js";

const TAU = Math.PI * 2;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const THEME_ID = /^[a-z][a-z0-9-]{0,63}$/;

const defaultAppearance = Object.freeze({
  detail: 1,
  glow: 1,
  intensity: 1,
});

const defaultMotion = Object.freeze({
  drift: 1,
  speed: 1,
});

const defaultAudioResponse = Object.freeze({
  brightness: 1,
  motion: 1,
  pulse: 1,
});

export const orbCustomizationDefaults = Object.freeze({
  appearance: defaultAppearance,
  audioResponse: defaultAudioResponse,
  motion: defaultMotion,
});

export const orbStates = Object.freeze([
  "idle",
  "listening",
  "thinking",
  "speaking",
  "success",
  "error",
]);

export const orbQualityProfiles = Object.freeze({
  low: Object.freeze({ frameRate: 30, maxPixelRatio: 1, maxResolution: 512 }),
  balanced: Object.freeze({ frameRate: 45, maxPixelRatio: 1.5, maxResolution: 896 }),
  high: Object.freeze({ frameRate: 60, maxPixelRatio: 2, maxResolution: 1280 }),
});

function requireObject(value, name) {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object.`);
  }
  return value;
}

function requireKnownKeys(value, keys, name) {
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) throw new TypeError(`${name}.${key} is not a supported option.`);
  }
}

function numberInRange(value, fallback, minimum, maximum, name) {
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new RangeError(`${name} must be between ${minimum} and ${maximum}.`);
  }
  return number;
}

function normalizeHexColor(value, fallback, name) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !HEX_COLOR.test(value)) {
    throw new TypeError(`${name} must use the #RRGGBB format.`);
  }
  return value.toUpperCase();
}

function hexToRgb(hex) {
  return Object.freeze([
    Number.parseInt(hex.slice(1, 3), 16) / 255,
    Number.parseInt(hex.slice(3, 5), 16) / 255,
    Number.parseInt(hex.slice(5, 7), 16) / 255,
  ]);
}

function normalizeSeed(value, fallback) {
  if (value === undefined) return fallback;
  const seed = Number(value);
  if (!Number.isFinite(seed)) throw new TypeError("seed must be a finite number.");
  return ((seed % TAU) + TAU) % TAU;
}

function freezeValues(values) {
  return Object.freeze({ ...values });
}

export function createOrbTheme(options = {}) {
  const input = requireObject(options, "options");
  requireKnownKeys(input, ["appearance", "audioResponse", "colors", "id", "motion", "preset", "seed"], "options");
  const preset = input.preset ?? DEFAULT_VARIANT_ID;
  if (typeof preset !== "string" || !Object.hasOwn(orbVariantDefinitions, preset)) {
    throw new RangeError(`preset must be one of the registered orb variant IDs.`);
  }
  const base = resolveVariant(preset);
  const colors = requireObject(input.colors, "colors");
  const appearance = requireObject(input.appearance, "appearance");
  const motion = requireObject(input.motion, "motion");
  const audioResponse = requireObject(input.audioResponse, "audioResponse");
  requireKnownKeys(colors, ["accents", "base", "interior"], "colors");
  requireKnownKeys(appearance, ["detail", "glass", "glow", "intensity"], "appearance");
  requireKnownKeys(motion, ["drift", "speed"], "motion");
  requireKnownKeys(audioResponse, ["brightness", "motion", "pulse"], "audioResponse");

  const id = input.id ?? `${preset}-custom`;
  if (typeof id !== "string" || !THEME_ID.test(id)) {
    throw new TypeError("id must start with a letter and contain only lowercase letters, numbers, or hyphens.");
  }
  const baseHex = normalizeHexColor(colors.base, orbVariantDefinitions[preset].baseColor, "colors.base");
  const interiorHex = normalizeHexColor(colors.interior, "#000000", "colors.interior");
  let accentHex = orbVariantDefinitions[preset].accentColors;
  if (colors.accents !== undefined) {
    if (!Array.isArray(colors.accents) || colors.accents.length !== 3) {
      throw new TypeError("colors.accents must contain exactly three #RRGGBB colors.");
    }
    accentHex = colors.accents.map((color, index) => (
      normalizeHexColor(color, undefined, `colors.accents[${index}]`)
    ));
  }

  const resolvedAppearance = freezeValues({
    detail: numberInRange(appearance.detail, 1, 0, 1, "appearance.detail"),
    glow: numberInRange(appearance.glow, 1, 0, 2, "appearance.glow"),
    intensity: numberInRange(appearance.intensity, 1, 0.25, 2, "appearance.intensity"),
  });
  const resolvedMotion = freezeValues({
    drift: numberInRange(motion.drift, 1, 0, 2, "motion.drift"),
    speed: numberInRange(motion.speed, 1, 0, 2, "motion.speed"),
  });
  const resolvedAudioResponse = freezeValues({
    brightness: numberInRange(audioResponse.brightness, 1, 0, 2, "audioResponse.brightness"),
    motion: numberInRange(audioResponse.motion, 1, 0, 2, "audioResponse.motion"),
    pulse: numberInRange(audioResponse.pulse, 1, 0, 2, "audioResponse.pulse"),
  });
  const glass = numberInRange(appearance.glass, base.lensStrength, 0, 1, "appearance.glass");

  return Object.freeze({
    ...base,
    id,
    sourceVariantId: preset,
    phase: normalizeSeed(input.seed, base.phase),
    interiorColor: hexToRgb(interiorHex),
    baseColor: hexToRgb(baseHex),
    accentColors: Object.freeze(accentHex.map(hexToRgb)),
    lensStrength: glass,
    renderProfile: glass > 0 ? "layered" : "compact",
    appearance: resolvedAppearance,
    motion: resolvedMotion,
    audioResponse: resolvedAudioResponse,
  });
}

export function resolveOrbQuality(value = "high") {
  if (typeof value !== "string" || !Object.hasOwn(orbQualityProfiles, value)) {
    throw new RangeError("quality must be low, balanced, or high.");
  }
  return orbQualityProfiles[value];
}

export function resolveOrbState(value = "idle") {
  if (!orbStates.includes(value)) {
    throw new RangeError(`state must be one of: ${orbStates.join(", ")}.`);
  }
  return value;
}
