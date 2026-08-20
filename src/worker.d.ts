import type {
  OrbQuality,
  OrbState,
  ResolvedOrbVariant,
} from "./index.js";

export interface OrbWorkerInitMessage {
  readonly type: "init";
  readonly canvas: OffscreenCanvas;
  readonly diameter: number;
  readonly devicePixelRatio: number;
  readonly fixedTime?: number | null;
  readonly quality?: OrbQuality;
  readonly reducedMotion: boolean;
  readonly state?: OrbState;
  readonly timeOffset?: number;
  readonly variant: ResolvedOrbVariant;
}

export type OrbWorkerInputMessage =
  | OrbWorkerInitMessage
  | { readonly type: "resize"; readonly diameter: number; readonly devicePixelRatio: number }
  | { readonly type: "variant"; readonly variant: ResolvedOrbVariant }
  | { readonly type: "audio-level"; readonly value: number }
  | { readonly type: "active"; readonly value: boolean }
  | { readonly type: "quality"; readonly value: OrbQuality }
  | { readonly type: "state"; readonly value: OrbState }
  | { readonly type: "reduced-motion"; readonly value: boolean }
  | { readonly type: "destroy" };

export type OrbWorkerOutputMessage =
  | { readonly type: "ready" }
  | { readonly type: "error"; readonly message: string };
