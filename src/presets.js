const archetypeIndices = Object.freeze({
  spiral: 0,
  nebula: 1,
  core: 2,
  "deep-field": 3,
});

const staticAmbientMotion = Object.freeze({
  enabled: false,
  verticalTravel: 0,
  scale: 1,
  durationSeconds: 0,
  delaySeconds: 0,
});

const defaultAmbientMotion = Object.freeze({
  enabled: true,
  verticalTravel: 8,
  scale: 1,
  durationSeconds: 7,
  delaySeconds: 0,
});

const defaultAppearance = Object.freeze({ detail: 1, glow: 1, intensity: 1 });
const defaultMotion = Object.freeze({ drift: 1, speed: 1 });
const defaultAudioResponse = Object.freeze({ brightness: 1, motion: 1, pulse: 1 });
const defaultInteriorColor = Object.freeze([0, 0, 0]);

function defineVariant({
  accentColors,
  ambientMotion = staticAmbientMotion,
  archetype,
  baseColor,
  lensStrength,
  phase,
  referenceDiameter = 264,
}) {
  return Object.freeze({
    accentColors: Object.freeze([...accentColors]),
    ambientMotion: Object.freeze({ ...ambientMotion }),
    archetype,
    baseColor,
    lensStrength: lensStrength ?? (referenceDiameter >= 48 ? 0.4 : 0),
    phase,
    referenceDiameter,
  });
}

export const DEFAULT_VARIANT_ID = "core-teal-01";

export const orbArchetypes = Object.freeze([
  "core",
  "spiral",
  "nebula",
  "deep-field",
]);

export const orbVariantDefinitions = Object.freeze({
  "core-teal-01": defineVariant({
    archetype: "core",
    phase: 4.6,
    baseColor: "#07262B",
    accentColors: ["#00C2A8", "#38E1FF", "#FFC65C"],
    referenceDiameter: 264,
    ambientMotion: { ...defaultAmbientMotion, verticalTravel: 10 },
  }),
  "spiral-pink-01": defineVariant({
    archetype: "spiral",
    phase: 6.05,
    baseColor: "#2A0F22",
    accentColors: ["#FF7ECB", "#D14FFF", "#FFDCF2"],
    referenceDiameter: 244,
    ambientMotion: {
      enabled: true,
      verticalTravel: 5,
      scale: 1.03,
      durationSeconds: 6.5,
      delaySeconds: 0,
    },
  }),
  "nebula-pink-01": defineVariant({
    archetype: "nebula",
    phase: 4.083,
    baseColor: "#241627",
    accentColors: ["#FFC9E0", "#E4A8FF", "#FFE9F4"],
    referenceDiameter: 186,
    ambientMotion: {
      enabled: true,
      verticalTravel: 5,
      scale: 1.03,
      durationSeconds: 7.8,
      delaySeconds: 0.4,
    },
  }),
  "spiral-cyan-01": defineVariant({
    archetype: "spiral",
    phase: 1.285,
    baseColor: "#0A1B2E",
    accentColors: ["#38BDF8", "#0E7BD1", "#CFF2FF"],
    referenceDiameter: 150,
    ambientMotion: {
      enabled: true,
      verticalTravel: 5,
      scale: 1.03,
      durationSeconds: 9.1,
      delaySeconds: 0.8,
    },
  }),
  "spiral-cyan-02": defineVariant({
    archetype: "spiral",
    phase: 2.502,
    baseColor: "#101B2E",
    accentColors: ["#7DBED4", "#6E8BFF", "#A24DFF"],
    referenceDiameter: 208,
    ambientMotion: { ...defaultAmbientMotion, verticalTravel: 9 },
  }),
  "nebula-violet-01": defineVariant({
    archetype: "nebula",
    phase: 1.995,
    baseColor: "#1C0A2B",
    accentColors: ["#A24DFF", "#FF4DD8", "#6E8BFF"],
    referenceDiameter: 260,
    ambientMotion: { ...defaultAmbientMotion, verticalTravel: 9 },
  }),
  "core-blue-01": defineVariant({
    archetype: "core",
    phase: 5.016,
    baseColor: "#131A2E",
    accentColors: ["#2563EB", "#FF2D87", "#FFD086"],
    referenceDiameter: 42,
    lensStrength: 0,
  }),
  "spiral-orange-01": defineVariant({
    archetype: "spiral",
    phase: 2.289,
    baseColor: "#5C4030",
    accentColors: ["#D86A3D", "#FFB873", "#FFE3C2"],
    referenceDiameter: 42,
    lensStrength: 0,
  }),
  "nebula-cyan-01": defineVariant({
    archetype: "nebula",
    phase: 0.432,
    baseColor: "#2E4250",
    accentColors: ["#7DBED4", "#C5A8E8", "#F4F4F8"],
    referenceDiameter: 42,
    lensStrength: 0,
  }),
  "core-cyan-01": defineVariant({
    archetype: "core",
    phase: 1.573,
    baseColor: "#0A2438",
    accentColors: ["#3DA5D9", "#5FC9D8", "#A6E5E5"],
    referenceDiameter: 42,
    lensStrength: 0,
  }),
  "core-lime-01": defineVariant({
    archetype: "core",
    phase: 1.542,
    baseColor: "#1A3A20",
    accentColors: ["#7BAE48", "#A8B85C", "#F4E4A8"],
    referenceDiameter: 42,
    lensStrength: 0,
  }),
  "nebula-orange-01": defineVariant({
    archetype: "nebula",
    phase: 0.108,
    baseColor: "#301608",
    accentColors: ["#FFB25C", "#FF7E45", "#FFE9CE"],
  }),
  "core-blue-02": defineVariant({
    archetype: "core",
    phase: 4.401,
    baseColor: "#0E1A34",
    accentColors: ["#5C8DFF", "#3452D9", "#DCE8FF"],
  }),
  "deep-field-cyan-01": defineVariant({
    archetype: "deep-field",
    phase: 5.402,
    baseColor: "#0F2024",
    accentColors: ["#5FB7C4", "#33808F", "#DDF4F7"],
  }),
  "deep-field-green-01": defineVariant({
    archetype: "deep-field",
    phase: 1.89,
    baseColor: "#0C2414",
    accentColors: ["#57D98A", "#2FA05C", "#DFFBE9"],
  }),
  "core-red-01": defineVariant({
    archetype: "core",
    phase: 1.577,
    baseColor: "#2A0A10",
    accentColors: ["#FF3B4E", "#B01C3A", "#FF9860"],
  }),
  "core-orange-01": defineVariant({
    archetype: "core",
    phase: 0.287,
    baseColor: "#301004",
    accentColors: ["#FF7A18", "#FFB340", "#FF4E2A"],
  }),
  "deep-field-blue-01": defineVariant({
    archetype: "deep-field",
    phase: 2.619,
    baseColor: "#0E1230",
    accentColors: ["#8FA8FF", "#5B6CFF", "#E8ECFF"],
  }),
  "nebula-blue-01": defineVariant({
    archetype: "nebula",
    phase: 0.484,
    baseColor: "#1B1E33",
    accentColors: ["#C7CFFF", "#9FB4E8", "#F2F4FF"],
  }),
  "spiral-violet-01": defineVariant({
    archetype: "spiral",
    phase: 5.961,
    baseColor: "#221434",
    accentColors: ["#C084FC", "#F0A6FF", "#FFD1EC"],
  }),
  "deep-field-yellow-01": defineVariant({
    archetype: "deep-field",
    phase: 2.497,
    baseColor: "#171310",
    accentColors: ["#E8C98A", "#B08A50", "#FFF2D8"],
  }),
  "core-yellow-01": defineVariant({
    archetype: "core",
    phase: 0.224,
    baseColor: "#2E1E04",
    accentColors: ["#FFD54A", "#FFB300", "#FFF3B0"],
  }),
  "core-orange-02": defineVariant({
    archetype: "core",
    phase: 4.701,
    baseColor: "#2E1408",
    accentColors: ["#FF8A4C", "#FFC24B", "#FF5E62"],
  }),
  "deep-field-teal-01": defineVariant({
    archetype: "deep-field",
    phase: 1.778,
    baseColor: "#0A2220",
    accentColors: ["#63D8C2", "#2E9E8C", "#DFFCF4"],
  }),
  "spiral-cyan-03": defineVariant({
    archetype: "spiral",
    phase: 3.465,
    baseColor: "#101632",
    accentColors: ["#4CC9F0", "#7B5CFF", "#B8F1FF"],
  }),
  "spiral-blue-01": defineVariant({
    archetype: "spiral",
    phase: 1.258,
    baseColor: "#141B26",
    accentColors: ["#7FA6C9", "#4A7196", "#DCE8F2"],
  }),
  "spiral-cyan-04": defineVariant({
    archetype: "spiral",
    phase: 0.825,
    baseColor: "#0E2030",
    accentColors: ["#4FC3F7", "#8BE38B", "#E1F7FF"],
  }),
  "nebula-red-01": defineVariant({
    archetype: "nebula",
    phase: 1.692,
    baseColor: "#2A1418",
    accentColors: ["#FF9DA0", "#FFC6A8", "#FFE8E0"],
  }),
  "deep-field-orange-01": defineVariant({
    archetype: "deep-field",
    phase: 2.167,
    baseColor: "#221408",
    accentColors: ["#D9A05B", "#A0693A", "#FFE0B8"],
  }),
  "core-lime-02": defineVariant({
    archetype: "core",
    phase: 3.431,
    baseColor: "#12240E",
    accentColors: ["#9BE84C", "#3ED598", "#EAFFC9"],
  }),
  "nebula-yellow-01": defineVariant({
    archetype: "nebula",
    phase: 1.461,
    baseColor: "#26200C",
    accentColors: ["#FFE08A", "#F4C14F", "#FFF8E0"],
  }),
  "spiral-orange-02": defineVariant({
    archetype: "spiral",
    phase: 1.878,
    baseColor: "#26160C",
    accentColors: ["#E88B4E", "#C9653A", "#F7D9B8"],
  }),
  "nebula-orange-02": defineVariant({
    archetype: "nebula",
    phase: 0.365,
    baseColor: "#251106",
    accentColors: ["#FFAD33", "#E86A2C", "#FFE2A8"],
  }),
  "deep-field-blue-02": defineVariant({
    archetype: "deep-field",
    phase: 0.757,
    baseColor: "#14161C",
    accentColors: ["#9AA6B8", "#5E6B80", "#E6ECF5"],
  }),
  "nebula-violet-02": defineVariant({
    archetype: "nebula",
    phase: 3.978,
    baseColor: "#1A1430",
    accentColors: ["#A78BFA", "#F0ABFC", "#E0E7FF"],
  }),
  "deep-field-teal-02": defineVariant({
    archetype: "deep-field",
    phase: 6.142,
    baseColor: "#0F1F24",
    accentColors: ["#5EEAD4", "#99F6E4", "#E0F2FE"],
  }),
});

export const orbVariantIds = Object.freeze(Object.keys(orbVariantDefinitions).sort());

function hexToRgb(hex) {
  return Object.freeze([
    Number.parseInt(hex.slice(1, 3), 16) / 255,
    Number.parseInt(hex.slice(3, 5), 16) / 255,
    Number.parseInt(hex.slice(5, 7), 16) / 255,
  ]);
}

export function resolveVariant(id = DEFAULT_VARIANT_ID) {
  const resolvedId = Object.hasOwn(orbVariantDefinitions, id) ? id : DEFAULT_VARIANT_ID;
  const definition = orbVariantDefinitions[resolvedId];
  return Object.freeze({
    id: resolvedId,
    phase: definition.phase,
    archetype: definition.archetype,
    archetypeIndex: archetypeIndices[definition.archetype],
    interiorColor: defaultInteriorColor,
    baseColor: hexToRgb(definition.baseColor),
    accentColors: Object.freeze(definition.accentColors.map(hexToRgb)),
    lensStrength: definition.lensStrength,
    appearance: defaultAppearance,
    motion: defaultMotion,
    audioResponse: defaultAudioResponse,
    ambientMotion: definition.ambientMotion,
    referenceDiameter: definition.referenceDiameter,
    renderProfile: definition.lensStrength > 0 ? "layered" : "compact",
  });
}
