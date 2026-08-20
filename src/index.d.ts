export type OrbArchetype = "core" | "spiral" | "nebula" | "deep-field";
export type OrbRenderProfile = "layered" | "compact";
export type OrbQuality = "low" | "balanced" | "high";
export type OrbState = "idle" | "listening" | "thinking" | "speaking" | "success" | "error";
export type RgbColor = readonly [number, number, number];

export interface OrbAppearance {
  readonly detail: number;
  readonly glow: number;
  readonly intensity: number;
}

export interface OrbMotion {
  readonly drift: number;
  readonly speed: number;
}

export interface OrbAudioResponse {
  readonly brightness: number;
  readonly motion: number;
  readonly pulse: number;
}

export interface AmbientMotion {
  readonly enabled: boolean;
  readonly verticalTravel: number;
  readonly scale: number;
  readonly durationSeconds: number;
  readonly delaySeconds: number;
}

export interface OrbVariantDefinition {
  readonly accentColors: readonly [string, string, string];
  readonly ambientMotion: AmbientMotion;
  readonly archetype: OrbArchetype;
  readonly baseColor: string;
  readonly lensStrength: number;
  readonly phase: number;
  readonly referenceDiameter: number;
}

export interface ResolvedOrbVariant {
  readonly id: string;
  readonly sourceVariantId?: string;
  readonly phase: number;
  readonly archetype: OrbArchetype;
  readonly archetypeIndex: 0 | 1 | 2 | 3;
  readonly interiorColor: RgbColor;
  readonly baseColor: RgbColor;
  readonly accentColors: readonly [RgbColor, RgbColor, RgbColor];
  readonly lensStrength: number;
  readonly ambientMotion: AmbientMotion;
  readonly referenceDiameter: number;
  readonly renderProfile: OrbRenderProfile;
  readonly appearance: OrbAppearance;
  readonly motion: OrbMotion;
  readonly audioResponse: OrbAudioResponse;
}

export interface OrbThemeOptions {
  readonly preset?: string;
  readonly id?: string;
  readonly seed?: number;
  readonly colors?: {
    readonly base?: string;
    readonly interior?: string;
    readonly accents?: readonly [string, string, string];
  };
  readonly appearance?: Partial<OrbAppearance> & { readonly glass?: number };
  readonly motion?: Partial<OrbMotion>;
  readonly audioResponse?: Partial<OrbAudioResponse>;
}

export interface OrbQualityProfile {
  readonly frameRate: number;
  readonly maxPixelRatio: number;
  readonly maxResolution: number;
}

export interface OrbEngineOptions {
  readonly fixedTime?: number | null;
  readonly onError?: (error: Error) => void;
  readonly quality?: OrbQuality;
  readonly state?: OrbState;
  readonly variant?: ResolvedOrbVariant;
  readonly timeOffset?: number;
}

export class OrbEngine {
  constructor(visibleCanvas: HTMLCanvasElement | OffscreenCanvas, options?: OrbEngineOptions);
  readonly visibleCanvas: HTMLCanvasElement | OffscreenCanvas;
  variant: ResolvedOrbVariant;
  quality: OrbQuality;
  state: OrbState;
  active: boolean;
  reducedMotion: boolean;
  destroyed: boolean;
  resize(diameter: number, devicePixelRatio: number): void;
  setAudioLevel(value: number): void;
  setVariant(variant: ResolvedOrbVariant): void;
  setQuality(quality: OrbQuality): void;
  setState(state: OrbState): void;
  setActive(active: boolean): void;
  setReducedMotion(reduced: boolean): void;
  render(now: number): boolean;
  start(): void;
  destroy(): void;
}

export interface AudioCalibrationOptions {
  readonly absoluteGateDb?: number;
  readonly initialNoiseFloorDb?: number;
  readonly minimumNoiseFloorDb?: number;
  readonly maximumNoiseFloorDb?: number;
  readonly openMarginDb?: number;
  readonly closeMarginDb?: number;
  readonly hangoverSeconds?: number;
  readonly noiseWindowSeconds?: number;
  readonly stableNoiseWindowSeconds?: number;
  readonly stableNoiseMinimumSeconds?: number;
  readonly stableNoiseDeviationDb?: number;
  readonly stableNoiseCeilingDb?: number;
  readonly noiseRiseSeconds?: number;
  readonly stableNoiseRiseSeconds?: number;
  readonly activeNoiseRiseSeconds?: number;
  readonly noiseFallSeconds?: number;
  readonly referenceWindowSeconds?: number;
  readonly initialSpeechReferenceDb?: number;
  readonly minimumSpeechReferenceDb?: number;
  readonly maximumSpeechReferenceDb?: number;
  readonly minimumSpeechRangeDb?: number;
  readonly louderReferenceSeconds?: number;
  readonly quieterReferenceSeconds?: number;
  readonly referencePercentile?: number;
  readonly outputGamma?: number;
  readonly warmupSeconds?: number;
}

export interface AudioCalibrationState {
  readonly level: number;
  readonly levelDb: number;
  readonly noiseFloorDb: number;
  readonly gateOpenDb: number;
  readonly gateCloseDb: number;
  readonly speechReferenceDb: number;
  readonly active: boolean;
  readonly stableNoise: boolean;
  readonly warmingUp: boolean;
}

export class AudioLevelCalibrator {
  constructor(options?: AudioCalibrationOptions);
  readonly options: Required<AudioCalibrationOptions>;
  readonly last: AudioCalibrationState;
  reset(): void;
  process(samples: ArrayLike<number>, timestampSeconds?: number): number;
  processDb(levelDb: number, timestampSeconds?: number): number;
}

export const audioCalibrationDefaults: Readonly<Required<AudioCalibrationOptions>>;
export function measureRmsDb(samples: ArrayLike<number>): number;
export interface AudioSourceOptions {
  readonly calibration?: AudioCalibrationOptions;
}

export interface MicrophoneOptions extends AudioSourceOptions {
  readonly constraints?: MediaStreamConstraints;
}

export function attachAudioSource(
  source: HTMLMediaElement | AnalyserNode,
  setLevel: (level: number) => void,
  options?: AudioSourceOptions,
): () => void;
export function attachMicrophone(
  setLevel: (level: number) => void,
  options?: MicrophoneOptions,
): Promise<() => void>;
export function releaseAudioSource(element: HTMLMediaElement): void;

export const DEFAULT_VARIANT_ID: "core-teal-01";
export const orbArchetypes: readonly OrbArchetype[];
export const orbVariantDefinitions: Readonly<Record<string, OrbVariantDefinition>>;
export const orbVariantIds: readonly string[];
export function resolveVariant(id?: string): ResolvedOrbVariant;

export const orbCustomizationDefaults: Readonly<{
  appearance: OrbAppearance;
  audioResponse: OrbAudioResponse;
  motion: OrbMotion;
}>;
export const orbQualityProfiles: Readonly<Record<OrbQuality, OrbQualityProfile>>;
export const orbStates: readonly OrbState[];
export function createOrbTheme(options?: OrbThemeOptions): ResolvedOrbVariant;

export interface CreateOrbOptions extends Omit<OrbEngineOptions, "variant"> {
  readonly theme?: string | ResolvedOrbVariant;
  readonly reducedMotion?: boolean | "user";
}

export class OrbController {
  constructor(canvas: HTMLCanvasElement, options?: CreateOrbOptions);
  readonly canvas: HTMLCanvasElement;
  readonly engine: OrbEngine;
  readonly destroyed: boolean;
  readonly paused: boolean;
  resize(): void;
  setTheme(theme: string | ResolvedOrbVariant): ResolvedOrbVariant;
  setState(state: OrbState): void;
  setQuality(quality: OrbQuality): void;
  setAudioLevel(level: number): void;
  setReducedMotion(value: boolean | "user"): void;
  attachAudioSource(source: HTMLMediaElement | AnalyserNode, options?: AudioSourceOptions): () => void;
  connectMicrophone(options?: MicrophoneOptions): Promise<() => void>;
  disconnectAudio(): void;
  releaseAudioSource(element: HTMLMediaElement): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}

export function createOrb(canvas: HTMLCanvasElement, options?: CreateOrbOptions): OrbController;
