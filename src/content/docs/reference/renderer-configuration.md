---
title: 'Renderer configuration — the consumer-facing config surface'
description: '> **Framework. Game-agnostic.** Pins what each consuming game wires > up about the renderer (vs what the framework picks for them). > Sits between...'
---

> **Framework. Game-agnostic.** Pins what each consuming game wires
> up about the renderer (vs what the framework picks for them).
> Sits between [`webgl-constraints.md`](webgl-constraints.md) (hard
> platform limits, not configurable) and
> [`adaptive-rendering.md`](adaptive-rendering.md) (tier mechanism,
> already game-overridable via `render-tiers.json`). This doc covers
> **everything else** — context-creation options, DPR policy,
> detection extension points, output pipeline, and the
> runtime-adjustment policy knobs.

The framework picks aggressive, opinionated defaults for every knob
on this page. A consumer that wants the defaults writes zero
configuration. Overrides land in
`packages/content/data/renderer-config.json` (per-consumer), parsed
through a Zod schema in `@vibesmith/renderer`, and merged on top of
the framework defaults at boot. Missing keys fall through.

---

## What's framework-fixed vs consumer-configurable

A four-bucket split. The first bucket is the only one the consumer
can't influence; the rest belong to the consumer.

| Bucket | Where it lives | Examples |
|---|---|---|
| **Platform-fixed** (not configurable) | `webgl-constraints.md` | WebGL 2 minimum guarantees, browser tab memory ceiling, draw-call submit overhead |
| **Tier-driven** (per-game override of the tier table) | `render-tiers.json` | Shadow technique, post-FX chain, particle density, frame target, dynamic-res range |
| **Renderer instance** (this doc) | `renderer-config.json` | WebGLRenderer construction args, DPR cap, output color space, tone mapping, detection bypass, runtime adjustment policy |
| **Detection extension** (this doc) | `renderer-config.json` + optional consumer code modules | GPU classification overrides, capability gates, boot probe scene, floor threshold |

The renderer-instance bucket exists because some choices are
*per-game*, not *per-device*: a kiosk build wants
`preserveDrawingBuffer: true` for screenshot capture on every
hardware tier; a Tauri shell wants `powerPreference:
'high-performance'` regardless of detected tier. These choices don't
belong in the tier table.

---

## WebGLRenderer construction options

Passed to `new THREE.WebGLRenderer({…})` once at boot. Cannot be
changed afterward without recreating the context. The framework
sets defaults that work for a typical full-window game; a consumer
overrides for embedded / kiosk / screenshot / power-sensitive
scenarios.

| Option | Framework default | When a consumer overrides |
|---|---|---|
| `antialias` | `false` | The post-FX chain owns AA (FXAA/SMAA in MEDIUM+, none in LOW). Override `true` only for tier configurations that skip post-FX entirely (rare — typically embedded marketing scenes). |
| `alpha` | `false` | Override `true` when the canvas is layered over HTML/CSS content (marketing pages, embeds, dashboards). Costs an extra blend pass. |
| `premultipliedAlpha` | `true` | Almost never overridden. Standard browser compositing assumption. |
| `preserveDrawingBuffer` | `false` | Override `true` for screenshot-share features or video-capture flows. Has real perf cost (~5-15%); never enable globally if the feature is only used in a "share" modal. |
| `powerPreference` | `'high-performance'` | Override `'low-power'` for ambient / idle-friendly embeds (dashboards, marketing). Override `'default'` for laptops on battery if telemetry shows thermal complaints. |
| `failIfMajorPerformanceCaveat` | `false` | Override `true` only if the consumer prefers an explicit error on software-rendered contexts over running the LOW tier on them. |
| `precision` | `'highp'` | Almost never overridden. Some old mobile GPUs report `highp` support but degrade gracefully; the framework relies on this. |
| `stencil` | `true` | Override `false` to save a small amount of VRAM if no post-FX effect uses the stencil buffer. |
| `depth` | `true` | Almost never overridden. |
| `logarithmicDepthBuffer` | `false` | Override `true` for very-large-world games where a single skinned mesh and a distant terrain coexist (z-fighting at far clip). Costs a fragment-shader instruction; not free. |

The framework wraps the construction in
`createRenderer(config: RendererConfig): RendererHandle` — consumers
never see the raw Three.js constructor. This is the
[abstraction-discipline](abstraction-discipline.md) boundary: the
renderer wrapper is Tier A; only it imports `three`.

---

## Device pixel ratio policy

Browsers expose `window.devicePixelRatio` (DPR). On modern retina
displays DPR is 2-4, which quadruples the fragment-shader workload
versus DPR 1. Letting the renderer use raw DPR is the single biggest
fillrate footgun on Mac and high-end Android.

Framework defaults:

| Tier | DPR clamp |
|---|---|
| LOW | min(DPR, 1.0) |
| MEDIUM | min(DPR, 1.5) |
| HIGH | min(DPR, 2.0) |
| ULTRA | min(DPR, 2.0); optional supersample multiplier in render-tier slot |

Consumer override (per-tier) lives in `renderer-config.json` under
`dpr.clamp`. Cases that override:

- **2D-heavy UI scenes** — bump the DPR clamp up; text crispness
  matters more than fragment cost.
- **Mobile-first games on small viewports** — drop the clamp to 1.0
  on MEDIUM as well; the viewport is small enough that supersampling
  is wasted.
- **Marketing embeds at fixed canvas size** — clamp to exact DPR for
  pixel-perfect screenshots.

Dynamic-resolution scaling (from `adaptive-rendering.md`) multiplies
the clamped DPR by the tier's `dynamic resolution range`. The clamp
sets the ceiling; dynamic-res sets the floor.

---

## Output pipeline — color and tone mapping

These are renderer-wide constants (not per-frame), so they live in
`renderer-config.json` rather than the tier table. Most games never
touch them; the framework defaults are chosen for the
low-poly-with-warm-light aesthetic the framework is calibrated for.

| Setting | Framework default | When a consumer overrides |
|---|---|---|
| `outputColorSpace` | `SRGBColorSpace` | Never (linear output requires a custom DOM compositor; out of scope). |
| `toneMapping` | `ACESFilmicToneMapping` | Override to `NoToneMapping` for UI-only / abstract games; `CineonToneMapping` for darker, more cinematic palettes; `NeutralToneMapping` (Three r158+) for stylized flat shading where ACES is too contrasty. |
| `toneMappingExposure` | `1.0` | Tune per-game to match the asset palette's apparent brightness. Typical range 0.7-1.3. |
| `shadowMap.type` | `PCFSoftShadowMap` (tier MEDIUM+) | Override to `VSMShadowMap` for stylized soft shadows on large surfaces; rarely worth the extra cost. |
| `useLegacyLights` | `false` | Stays `false`. The framework targets physically-based light intensities. |

The `shadowMap.type` interacts with the tier's shadow slot: if the
tier has `shadows: 'off'`, the type is irrelevant. The setting
declares *what kind* of shadow technique to use when shadows are on.

---

## Tier-detection extension points

The detection pipeline from `adaptive-rendering.md` (GPU
identification → capability check → benchmark) has four extension
points. Each consumer plugs in zero or more.

### 1. GPU classification overrides

The framework ships a base GPU-string → starting-tier table covering
common Apple Silicon, NVIDIA, AMD, Intel Iris, Adreno, Mali, and
Apple GPU variants. Consumers append entries via
`renderer-config.json`:

```json
{
  "gpuClassification": {
    "overrides": [
      { "match": "Apple M2", "tier": "HIGH" },
      { "match": "/Adreno 6[0-9]{2}/", "tier": "LOW" }
    ]
  }
}
```

Matches are first-win; framework defaults run last. Useful when a
consumer's content is heavier than the framework probe scene
suggests (push known-borderline GPUs down one tier preemptively).

### 2. Boot probe scene override

The framework default probe is a minimal generic test scene (one
instanced mesh field, one shadow caster, a tone-map post pass). A
consumer with heavier characteristic content (large open-world
terrain, dense crowds) can register a representative probe scene:

```json
{
  "detection": {
    "probeScene": "./src/renderer/probeScene.ts",
    "probeFrames": 30
  }
}
```

The module exports a `setupProbe(scene: THREE.Scene): void` function
the framework calls; framework owns the timing loop and result
interpretation. Probe must finish in <500ms total — heavier probes
make first-load worse for everyone.

### 3. Capability gates

Default gates: WebGL 2, half-float textures, anisotropic filtering,
depth textures, EXT_color_buffer_float. A consumer may add required
extensions:

```json
{
  "detection": {
    "requiredExtensions": ["WEBGL_compressed_texture_astc"],
    "preferredExtensions": ["KHR_parallel_shader_compile"]
  }
}
```

Required-missing = drop a tier (or fail the floor probe and show
the unsupported-device message). Preferred-missing = log to
telemetry, don't change behavior.

### 4. Floor threshold per game

Framework default: <50ms/frame on the probe scene is the floor; below
that, show the unsupported-device message. A consumer with a more
performance-tolerant gameplay shape (turn-based, slow-paced) may
lower the floor; an action / twitch-precision consumer may raise it.

```json
{
  "detection": {
    "floorThresholdMs": 80
  }
}
```

---

## Detection bypass

For environments where the hardware is known up front (Tauri desktop
shell on a specific minimum-spec machine, embedded kiosk, demo
station, CI / probe runner), detection is wasted time. Consumers
bypass it:

```json
{
  "detection": {
    "bypass": {
      "enabled": true,
      "forcedTier": "HIGH",
      "rationale": "Tauri shell ships to ≥M2 Macs; floor verified at build time"
    }
  }
}
```

The `rationale` field is mandatory; it's the durable answer to "why
isn't auto-detect running here?". Bypass disables capability gating
*for tier selection*, but capability checks for `requiredExtensions`
still run — a missing extension still blocks boot.

Bypass also disables the runtime adjustment loop unless
`detection.bypass.allowRuntimeAdjustment` is `true`. Most kiosk /
Tauri scenarios want it off (predictable visual budget); some
scenarios (open dev builds) want it on for measurement.

---

## Runtime adjustment policy

The `FrameMonitor` + tier-shift loop from `adaptive-rendering.md`
has policy knobs that some games want different. The framework
defaults work for a typical action / exploration game; turn-based
or slower games benefit from less-eager adjustment.

| Knob | Framework default | What it does |
|---|---|---|
| `windowFrames` | 60 | Rolling frame-time window for percentile calculation. |
| `percentile` | 95 | Which percentile of the window triggers tier changes. Lower = more lenient (fewer downgrades); higher = stricter. |
| `downgradeSustainedMs` | 3000 | How long the percentile must exceed the tier cap before downgrading. |
| `upgradeSustainedMs` | 30000 | How long it must sit below before considering upgrade. Long by design — upgrades are sticky. |
| `upgradeRequiresUserOptIn` | `true` | Auto-upgrades past the initially-detected tier require user opt-in. Override `false` only with caution; aggressive upgrade-then-downgrade flapping is a worse UX than staying at the conservative tier. |
| `indicatorVisibilityMs` | 2000 | How long the corner tier-change indicator stays on screen. |
| `hysteresisFrames` | 120 | After a tier change, this many frames must elapse before another tier change. Prevents oscillation. |

Override per-knob in `renderer-config.json` under `runtime.policy`.

---

## The full `renderer-config.json` shape

Authoritative shape (lives in `@vibesmith/renderer/schema.ts`,
Zod-validated; missing keys fall back to framework defaults):

```json
{
  "context": {
    "antialias": false,
    "alpha": false,
    "preserveDrawingBuffer": false,
    "powerPreference": "high-performance",
    "logarithmicDepthBuffer": false
  },
  "dpr": {
    "clamp": { "LOW": 1.0, "MEDIUM": 1.5, "HIGH": 2.0, "ULTRA": 2.0 }
  },
  "output": {
    "toneMapping": "ACESFilmic",
    "toneMappingExposure": 1.0,
    "shadowMapType": "PCFSoft"
  },
  "detection": {
    "probeScene": "./src/renderer/probeScene.ts",
    "probeFrames": 30,
    "requiredExtensions": [],
    "preferredExtensions": ["KHR_parallel_shader_compile"],
    "floorThresholdMs": 50,
    "bypass": {
      "enabled": false,
      "forcedTier": null,
      "rationale": null,
      "allowRuntimeAdjustment": true
    }
  },
  "gpuClassification": {
    "overrides": []
  },
  "runtime": {
    "policy": {
      "windowFrames": 60,
      "percentile": 95,
      "downgradeSustainedMs": 3000,
      "upgradeSustainedMs": 30000,
      "upgradeRequiresUserOptIn": true,
      "indicatorVisibilityMs": 2000,
      "hysteresisFrames": 120
    }
  },
  "materials": {
    "precompileOnSceneLoad": true,
    "allowCustomShaders": "always",
    "warnOnUniqueInstanceCount": 100
  }
}
```

The `materials.*` keys are global policy; the per-game material
library itself lives in `packages/content/data/materials.json` (see
[`material-system.md`](material-system.md)).

A consumer writes only the keys they want to override. The rest
falls through to the framework default. Schema-validated at boot;
invalid config fails fast with a clear error.

---

## What this is not

- **Not a graphics settings menu.** Same commitment as
  `adaptive-rendering.md` — these knobs are *consumer build-time*
  configuration, not player-facing toggles. Players still get the
  no-settings UX.
- **Not a place for game-specific content.** Asset paths, palettes,
  scene names, gameplay constants do not belong here. This config is
  about the *renderer instance*, not the *game*.
- **Not a tier replacement.** Tier-driven slots (shadows, post-FX,
  particle density) stay in `render-tiers.json`. This file is for
  renderer-instance settings that don't vary with tier.
- **Not a bypass for `webgl-constraints.md`.** The hard platform
  limits still apply; no config knob un-caps `MAX_TEXTURE_SIZE`.

---

## Build order

1. **`RendererConfig` type + Zod schema** in `@vibesmith/renderer` —
   v0
2. **`createRenderer(config)` wrapper** that consumes the config and
   instantiates the Three.js renderer — v0
3. **DPR clamp logic** wired through the tier slot system — v0.5
4. **GPU classification override merge** + first base table — v0.5
5. **Probe scene override registration** — v1
6. **Capability gate `requiredExtensions` enforcement** — v1
7. **Detection bypass + rationale telemetry** — v1
8. **Runtime adjustment policy knobs** wired through `FrameMonitor`
   — v1
9. **Schema validation error reporting** with actionable messages
   (which key, which file, expected shape) — v1

---

## Cross-references

- [`webgl-constraints.md`](webgl-constraints.md) — platform-fixed
  limits that bound every knob on this page
- [`adaptive-rendering.md`](adaptive-rendering.md) — the tier
  mechanism + `render-tiers.json` per-game tier overrides; this
  doc is the sibling for non-tier renderer config
- [`performance-budgets.md`](performance-budgets.md) — Tier 0
  budgets the configured renderer must hit
- [`abstraction-discipline.md`](abstraction-discipline.md) — why
  consumers configure through a typed schema, not raw Three.js
  imports
- [`engine-patterns.md`](engine-patterns.md) — the R3F patterns
  the renderer wrapper feeds into
- [`reproducibility.md`](reproducibility.md) — `renderer-config.json`
  is in git; same config from a clean clone = same renderer setup
