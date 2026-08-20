# Orbloom

A living, voice-reactive WebGL orb for the web.

Orbloom provides 36 deterministic visual variants, semantic product states, calibrated microphone and media response, transparent compositing, quality controls, reduced-motion handling, and an optional worker renderer. It is framework-neutral, ESM-only, and has no runtime dependencies.

## Install

Use the package manager already used by your application.

```bash
npm install orbloom
```

```bash
pnpm add orbloom
```

```bash
yarn add orbloom
```

## Quick start

```html
<div class="orb-motion">
  <div class="orb-shell">
    <div class="orb-clip">
      <canvas id="orb" class="orb-canvas" aria-label="Voice activity"></canvas>
      <div class="orb-fallback" aria-hidden="true"></div>
    </div>
    <div class="orb-chrome" aria-hidden="true"></div>
  </div>
</div>
```

```js
import { createOrb } from "orbloom";
import "orbloom/styles.css";

const orb = createOrb(document.querySelector("#orb"), {
  quality: "balanced",
  state: "idle",
  theme: "core-teal-01",
});

orb.setState("listening");

document.querySelector("#start-microphone").addEventListener("click", async () => {
  await orb.connectMicrophone();
  orb.setState("speaking");
});

window.addEventListener("pagehide", () => orb.destroy(), { once: true });
```

Microphone access requires HTTPS or localhost and must be requested from a user action. Audio stays in the browser; Orbloom does not upload or retain it.

## Custom themes

Use a tested preset as the procedural foundation, then adjust the company-facing controls.

```js
import { createOrb, createOrbTheme } from "orbloom";

const theme = createOrbTheme({
  preset: "nebula-violet-02",
  id: "company-primary",
  seed: 2.4,
  colors: {
    base: "#101820",
    interior: "#020408",
    accents: ["#0066FF", "#00D4FF", "#FFFFFF"],
  },
  appearance: {
    intensity: 0.9,
    detail: 0.72,
    glass: 0.35,
    glow: 0.8,
  },
  motion: {
    speed: 0.75,
    drift: 0.6,
  },
  audioResponse: {
    brightness: 1.2,
    motion: 0.55,
    pulse: 0.85,
  },
});

const orb = createOrb(document.querySelector("#orb"), { theme });
```

Unknown keys and invalid values throw instead of silently creating a broken render.

| Group | Parameter | Valid value | Effect |
| --- | --- | --- | --- |
| Root | `preset` | registered variant ID | Selects the coherent procedural structure to extend. |
| Root | `id` | lowercase letters, numbers, hyphens; 1–64 characters | Gives the theme a stable diagnostic name. |
| Root | `seed` | any finite number | Changes deterministic feature placement and starting phase. |
| Colors | `base` | `#RRGGBB` | Sets the dark body and primary interior color. |
| Colors | `interior` | `#RRGGBB` | Sets the color behind the internal gas and stars. |
| Colors | `accents` | exactly three `#RRGGBB` values | Colors dust, stars, aurora, and highlights. |
| Appearance | `intensity` | `0.25…2` | Changes overall rendered energy without changing geometry. |
| Appearance | `detail` | `0…1` | Controls fine grain, small stars, and pulsar detail. |
| Appearance | `glass` | `0…1` | Controls refraction and RGB dispersion; `0` selects the compact render path. |
| Appearance | `glow` | `0…2` | Controls rim, glint, voice highlight, and state emphasis. |
| Motion | `speed` | `0…2` | Multiplies procedural rotation speed. |
| Motion | `drift` | `0…2` | Controls slow speed variation around the base rotation. |
| Audio response | `brightness` | `0…2` | Controls voice-driven illumination. |
| Audio response | `motion` | `0…2` | Controls voice-driven acceleration and spin impulses. |
| Audio response | `pulse` | `0…2` | Controls voice-driven aurora and pulsar activity. |

Calling `createOrbTheme({ preset })` preserves that preset's visual and motion defaults. Shader constants stay internal so the public controls remain coherent and upgradeable.

## Variants

The default is `core-teal-01`. Unknown IDs resolve to the default. Read `orbVariantIds` at runtime for the complete frozen list.

| Family | IDs |
| --- | --- |
| Core | `core-blue-01`, `core-blue-02`, `core-cyan-01`, `core-lime-01`, `core-lime-02`, `core-orange-01`, `core-orange-02`, `core-red-01`, `core-teal-01`, `core-yellow-01` |
| Spiral | `spiral-blue-01`, `spiral-cyan-01`, `spiral-cyan-02`, `spiral-cyan-03`, `spiral-cyan-04`, `spiral-orange-01`, `spiral-orange-02`, `spiral-pink-01`, `spiral-violet-01` |
| Nebula | `nebula-blue-01`, `nebula-cyan-01`, `nebula-orange-01`, `nebula-orange-02`, `nebula-pink-01`, `nebula-red-01`, `nebula-violet-01`, `nebula-violet-02`, `nebula-yellow-01` |
| Deep field | `deep-field-blue-01`, `deep-field-blue-02`, `deep-field-cyan-01`, `deep-field-green-01`, `deep-field-orange-01`, `deep-field-teal-01`, `deep-field-teal-02`, `deep-field-yellow-01` |

## Product states

```js
orb.setState("listening");
orb.setState("thinking");
orb.setState("speaking");
orb.setState("success");
orb.setState("error");
orb.setState("idle");
```

| State | Visual meaning |
| --- | --- |
| `idle` | Neutral rendering and the default. |
| `listening` | Subtle accent-colored rim attention. |
| `thinking` | Slow internal color pulse. |
| `speaking` | Calibrated audio remains the primary signal. |
| `success` | Highlight-accent confirmation. |
| `error` | Restrained red error emphasis. |

State emphasis transitions over approximately 180 ms. Reduced motion applies the meaningful color change immediately without transitional movement.

## Audio

### Microphone

```js
const disconnect = await orb.connectMicrophone({
  constraints: {
    audio: {
      echoCancellation: { ideal: true },
      noiseSuppression: { ideal: true },
      autoGainControl: { ideal: false },
      channelCount: { ideal: 1 },
    },
  },
});

disconnect();
```

### Audio or video element

```js
const audio = document.querySelector("audio");
const disconnect = orb.attachAudioSource(audio);

await audio.play();
disconnect();
orb.releaseAudioSource(audio);
```

Cross-origin media must return compatible CORS headers. A media element's reusable Web Audio graph is released only when `releaseAudioSource(element)` is called.

### Existing analyser

```js
const disconnect = orb.attachAudioSource(analyserNode, {
  calibration: { outputGamma: 1.4 },
});
```

### Manual normalized input

```js
orb.setAudioLevel(0.65); // clamped to 0…1
```

The audio path uses an 80 Hz analysis-only high-pass filter, 1024-sample DC-removed RMS, dBFS conversion, adaptive room-noise estimation, a hysteretic speech gate, rolling speaker-level normalization, and a shaped output response. Microphone input starts with a 350 ms room-learning warm-up. The output drives existing brightness, pulse, and motion channels; it does not replace the orb's idle animation or geometry.

Advanced calibration is optional. Defaults work across ordinary speech, gain changes, silence, and stable background noise.

| Option | Default | Valid value |
| --- | ---: | --- |
| `absoluteGateDb` | `-55` | `-120…0` dBFS |
| `initialNoiseFloorDb` | `-60` | `-120…0` dBFS, between the floor limits |
| `minimumNoiseFloorDb` | `-96` | `-120…0` dBFS |
| `maximumNoiseFloorDb` | `-24` | `-120…0` dBFS |
| `openMarginDb` | `11` | `0…120`, at least `closeMarginDb` |
| `closeMarginDb` | `8` | `0…120`, no greater than `openMarginDb` |
| `hangoverSeconds` | `0.2` | `0…120` seconds |
| `noiseWindowSeconds` | `6` | greater than `0`, up to `120` seconds |
| `stableNoiseWindowSeconds` | `0.6` | greater than `0`, up to `120` seconds |
| `stableNoiseMinimumSeconds` | `0.3` | `0…stableNoiseWindowSeconds` |
| `stableNoiseDeviationDb` | `1.25` | `0…120` dB |
| `stableNoiseCeilingDb` | `-28` | `-120…0` dBFS |
| `noiseRiseSeconds` | `3` | greater than `0`, up to `120` seconds |
| `stableNoiseRiseSeconds` | `0.35` | greater than `0`, up to `120` seconds |
| `activeNoiseRiseSeconds` | `12` | greater than `0`, up to `120` seconds |
| `noiseFallSeconds` | `0.12` | greater than `0`, up to `120` seconds |
| `referenceWindowSeconds` | `4` | greater than `0`, up to `120` seconds |
| `initialSpeechReferenceDb` | `-22` | `-120…0` dBFS, between the reference limits |
| `minimumSpeechReferenceDb` | `-32` | `-120…0` dBFS |
| `maximumSpeechReferenceDb` | `-12` | `-120…0` dBFS |
| `minimumSpeechRangeDb` | `12` | greater than `0`, up to `120` dB |
| `louderReferenceSeconds` | `0.65` | greater than `0`, up to `120` seconds |
| `quieterReferenceSeconds` | `1.4` | greater than `0`, up to `120` seconds |
| `referencePercentile` | `0.95` | `0…1` |
| `outputGamma` | `1.6` | greater than `0`, up to `120` |
| `warmupSeconds` | `0` | `0…120` seconds; microphone defaults to `0.35` |

Supply calibration options through `connectMicrophone({ calibration })`, `attachAudioSource(source, { calibration })`, or directly to `new AudioLevelCalibrator(options)`.

## Controller API

`createOrb(canvas, options)` returns an `OrbController`. It owns renderer startup, resize observation, page and intersection visibility, reduced-motion preference, audio attachment, and cleanup.

### Options

| Option | Type | Default | Purpose |
| --- | --- | --- | --- |
| `theme` | variant ID or resolved theme | `core-teal-01` | Selects the visual definition. |
| `quality` | `low`, `balanced`, `high` | `high` | Limits frame rate, DPR, and render resolution. |
| `state` | product state | `idle` | Applies semantic visual emphasis. |
| `reducedMotion` | boolean or `user` | `user` | Forces motion on/off or follows the operating-system preference. |
| `fixedTime` | number or `null` | `null` | Freezes shader time for deterministic diagnostics. |
| `timeOffset` | number | random `0…4000` seconds | Selects the initial global animation phase. |
| `onError` | `(error) => void` | no-op | Receives WebGL restoration failures. |

### Methods

| Method | Purpose |
| --- | --- |
| `resize()` | Measures the canvas and applies quality-aware physical resolution. |
| `setTheme(theme)` | Changes to a variant ID or resolved custom theme. |
| `setState(state)` | Changes semantic product state. |
| `setQuality(quality)` | Changes the GPU budget. |
| `setAudioLevel(level)` | Supplies manual normalized activity. |
| `setReducedMotion(value)` | Forces or follows the user's motion preference. |
| `attachAudioSource(source, options)` | Attaches a media element or analyser and returns a disconnect function. |
| `connectMicrophone(options)` | Requests a microphone and resolves to a disconnect function. |
| `disconnectAudio()` | Detaches the active source and returns activity to zero. |
| `releaseAudioSource(element)` | Closes the cached Web Audio graph for a media element. |
| `pause()` / `resume()` | Controls scheduling without destroying GPU resources. |
| `destroy()` | Releases observers, audio, scheduling, and GPU resources. |

## Quality and sizing

| Quality | Frame rate | Maximum DPR | Maximum physical render diameter |
| --- | ---: | ---: | ---: |
| `low` | 30 | 1 | 512 px |
| `balanced` | 45 | 1.5 | 896 px |
| `high` | 60 | 2 | 1280 px |

`high` is the compatibility default. `balanced` is recommended for typical interfaces; `low` is intended for battery-sensitive or lower-end devices. The canvas observes its CSS size and keeps the render target within the selected profile.

Published CSS is component-scoped and does not style `html`, `body`, `:root`, generic elements, or application controls.

| Custom property | Default | Purpose |
| --- | --- | --- |
| `--orb-diameter` | `264px` | CSS diameter before viewport constraints. |
| `--orb-shell-blur` | `15.8px` | Glass-shell inset glow radius. |
| `--orb-motion-distance` | `-8px` | Ambient-motion midpoint translation. |
| `--orb-motion-scale` | `1` | Ambient-motion midpoint scale. |
| `--orb-motion-duration` | `7s` | Ambient-motion cycle duration. |
| `--orb-motion-delay` | `0s` | Ambient-motion cycle delay. |
| `--orb-entrance-delay` | `0s` | Optional entrance delay. |

## Transparency and backgrounds

Pixels outside the analytical sphere are transparent and use premultiplied alpha. Orbloom can sit over any background, but its edge highlights and tone balance are designed for dark neutral surfaces. Light or saturated backgrounds remain valid and will change the perceived contrast. Adjust the theme's interior color and glow, and style or omit `.orb-chrome`, to fit the host surface.

## Low-level renderer

Use `OrbEngine` only when the application wants to own resize, visibility, reduced motion, and cleanup itself.

```js
import { OrbEngine, resolveVariant } from "orbloom";

const renderer = new OrbEngine(canvas, {
  quality: "balanced",
  variant: resolveVariant("core-teal-01"),
});

renderer.resize(320, window.devicePixelRatio);
renderer.setAudioLevel(0.65);
renderer.start();
```

`OrbEngine` additionally provides `setVariant`, `setQuality`, `setState`, `setActive`, `setReducedMotion`, `render`, and `destroy`.

## Optional worker renderer

`orbloom/worker` is a module-worker entry for applications that explicitly manage an `OffscreenCanvas`. Resolve the subpath using the consuming bundler's worker URL convention; worker URL imports are not standardized across bundlers. The normal `createOrb` API deliberately uses the predictable main-thread path.

The first message must transfer the canvas:

```ts
import { resolveVariant } from "orbloom";
import type { OrbWorkerInputMessage, OrbWorkerOutputMessage } from "orbloom/worker";

declare const worker: Worker; // Created from your bundler-resolved orbloom/worker URL.
const offscreen = canvas.transferControlToOffscreen();
const message: OrbWorkerInputMessage = {
  type: "init",
  canvas: offscreen,
  diameter: 320,
  devicePixelRatio: window.devicePixelRatio,
  quality: "balanced",
  reducedMotion: false,
  state: "idle",
  variant: resolveVariant("core-teal-01"),
};

worker.postMessage(message, [offscreen]);
```

Input message types are `init`, `resize`, `variant`, `audio-level`, `active`, `quality`, `state`, `reduced-motion`, and `destroy`. Output messages are `ready` and `error`. The subpath exports TypeScript message types only; the JavaScript file itself runs as the worker global.

## Public exports

| Export | Purpose |
| --- | --- |
| `createOrb`, `OrbController` | Managed high-level lifecycle. |
| `OrbEngine` | Low-level WebGL renderer. |
| `createOrbTheme` | Validated company-facing customization. |
| `resolveVariant` | Resolves an ID to renderer-ready frozen values. |
| `DEFAULT_VARIANT_ID` | Stable default ID, `core-teal-01`. |
| `orbVariantIds` | Frozen list of all registered IDs. |
| `orbVariantDefinitions` | Frozen source definitions keyed by ID. |
| `orbArchetypes` | Frozen procedural family list. |
| `orbStates` | Frozen semantic state list. |
| `orbQualityProfiles` | Frozen quality limits. |
| `orbCustomizationDefaults` | Frozen public customization defaults. |
| `attachMicrophone` | Standalone microphone-to-level adapter. |
| `attachAudioSource` | Standalone media/analyser-to-level adapter. |
| `releaseAudioSource` | Releases a cached media graph. |
| `AudioLevelCalibrator` | Standalone adaptive voice normalizer. |
| `audioCalibrationDefaults` | Frozen calibration defaults. |
| `measureRmsDb` | DC-removed RMS-to-dBFS utility. |

Type declarations cover every public export and the worker message protocol.

## Rendering and browser requirements

The renderer uses WebGL 1 with an analytical sphere fragment shader, procedural interior detail, a refracted far surface in the layered profile, RGB lens displacement, and 2D-canvas composition. It does not require Three.js or another runtime graphics library.

The managed controller requires a modern ESM browser with WebGL 1, Canvas 2D, `requestAnimationFrame`, `ResizeObserver`, and standard DOM APIs. Microphone and media response additionally require Web Audio; microphone capture requires `mediaDevices.getUserMedia`. The optional worker path requires transferable `OffscreenCanvas` support. When reduced motion is requested, continuous and CSS ambient motion stop while meaningful state color remains visible.

## Development and verification

Orbloom development requires Node.js 22.12 or newer.

```bash
npm install
npm run dev
npm run verify
```

The development server exposes the interactive package showcase at `/examples/` and the real-device benchmark at `/examples/benchmark/`.

The release gate runs unit, synthetic audio, randomized stress, performance-floor, production-build, package-lint, type-resolution, clean-consumer, npm, pnpm, and modern Yarn checks. Additional compatibility and supply-chain checks are available:

```bash
npm run test:versions
npm run test:pack
npm audit --audit-level=low
npm audit signatures
```

The npm artifact contains only the runtime source, declarations, component CSS, this README, package metadata, and license. Demonstrations, tests, and generated builds are excluded.

## License

MIT © 2026 Ricky Bharti
