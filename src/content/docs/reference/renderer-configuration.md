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
> **everything else** — backend preference, context-creation
> options, DPR policy, detection extension points, output pipeline,
> runtime-adjustment policy knobs, and the custom-shader policy.
>
> Per [`adr/0005-dual-renderer-backend.md`](adr/0005-dual-renderer-backend.md),
> the framework defaults to WebGPU with WebGL 2 fallback and
> manages both backends symmetrically. Per-backend feature
> support lives in
> [`renderer-feature-matrix.md`](renderer-feature-matrix.md).

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
| **Platform-fixed** (not configurable) | `webgl-constraints.md` | WebGL 2 / WebGPU minimum guarantees, browser tab memory ceiling, draw-call submit overhead |
| **Backend preference** (this doc) | `vibesmith.toml` `[renderer]` | WebGPU / WebGL 2 selection, per-platform overrides |
| **Tier-driven** (per-game override of the tier table) | `render-tiers.json` | Shadow technique, post-FX chain, particle density, frame target, dynamic-res range |
| **Renderer instance** (this doc) | `renderer-config.json` | Renderer construction args, DPR cap, output color space, tone mapping, detection bypass, runtime adjustment policy, custom-shader policy |
| **Detection extension** (this doc) | `renderer-config.json` + optional consumer code modules | GPU classification overrides, capability gates, required features, boot probe scene, floor threshold |

The renderer-instance bucket exists because some choices are
*per-game*, not *per-device*: a kiosk build wants
`preserveDrawingBuffer: true` for screenshot capture on every
hardware tier; a Tauri shell wants `powerPreference:
'high-performance'` regardless of detected tier. These choices don't
belong in the tier table.

---

## Backend preference — the `[renderer]` table

Per [`adr/0005-dual-renderer-backend.md`](adr/0005-dual-renderer-backend.md),
the framework defaults to WebGPU with automatic WebGL 2 fallback.
The default behaves correctly on every platform without
configuration; consumers only set this table for explicit reasons.
Lives in **`vibesmith.toml`** (not `renderer-config.json`) because
it's a project-level identity choice that the project contract
documents and `vibesmith doctor` consults.

```toml
[renderer]
# Backend preference. Default "auto".
# - "auto" / "webgpu":  prefer WebGPU; fall back to WebGL 2 silently.
# - "webgpu-required":  refuse to boot without WebGPU. For kiosk /
#                       known-hardware builds. Boots to an
#                       unsupported-device message on non-WebGPU
#                       clients.
# - "webgl2":           force WebGL 2 even when WebGPU is available.
#                       Useful for: known mobile-WebGPU bugs in the
#                       consumer's content; legacy asset pipelines;
#                       debugging.
prefer = "auto"

# Optional per-platform overrides. Rarely needed — auto-fallback
# handles every platform correctly without this. Use only when
# you have a specific reason (a known content bug on one backend,
# a CI matrix constraint, etc.). Values: same as `prefer`.
[renderer.platform]
# tauri-linux   = "webgl2"
# tauri-android = "webgl2"
# browser       = "auto"
```

### When to override

| Value | Pick when |
|---|---|
| `"auto"` *(default)* | Almost always. Framework picks the best available backend per platform; falls back silently when an adapter is absent or rejects |
| `"webgpu-required"` | Building for known hardware where WebGPU is guaranteed (kiosk / demo / internal); want a clean failure mode on non-WebGPU clients |
| `"webgl2"` | Reproducing a WebGL-2-only consumer bug; capacity for known WebGPU mobile bugs your content triggers; legacy custom-shader code that hasn't migrated to TSL |

### Runtime detection flow

`@vibesmith/renderer.detectRenderer(config)` runs at boot:

1. Read `[renderer]` preference + platform overrides.
2. If preference allows WebGPU: probe `navigator.gpu`,
   `requestAdapter()`. If absent or rejects → fall back to WebGL 2.
3. If `"webgpu-required"` and WebGPU missing: return
   `{ kind: 'unsupported', reason }`. Boot screen shows the
   unsupported-device message.
4. If `"webgl2"`: skip the WebGPU probe entirely.
5. Cache the resolved backend in IndexedDB keyed by GPU string +
   project name + framework version. Re-probe when any key
   changes (or when `[renderer]` preference changes).

Probe cost is tens of ms; not a meaningful first-load delay.

### Dev-shell override

The dev shell exposes a backend toggle (`Ctrl+Shift+G` panel) that
forces a specific backend regardless of `vibesmith.toml`. Persists
in IndexedDB. **Triggers a full reload** to take effect. Used for
debugging ("does this repro on WebGL 2 too?"). Not a player-facing
option. Mid-session backend swap without reload is out of scope —
the context can't switch in place.

---

## Renderer construction options

Passed to Three.js's renderer constructor once at boot — to
`WebGPURenderer` on the WebGPU path, to `WebGLRenderer` on the
WebGL 2 path. Three.js's unified `WebGPURenderer` (`three/webgpu`)
accepts the same options on either backend and routes them
appropriately. Cannot be changed afterward without recreating the
context. The framework sets defaults that work for a typical
full-window game; a consumer overrides for embedded / kiosk /
screenshot / power-sensitive scenarios.

| Option | Framework default | Backends | When a consumer overrides |
|---|---|---|---|
| `antialias` | `false` | both | The post-FX chain owns AA (FXAA/SMAA in MEDIUM+, none in LOW). Override `true` only for tier configurations that skip post-FX entirely (rare — typically embedded marketing scenes). |
| `alpha` | `false` | both | Override `true` when the canvas is layered over HTML/CSS content (marketing pages, embeds, dashboards). Costs an extra blend pass. |
| `premultipliedAlpha` | `true` | both | Almost never overridden. Standard browser compositing assumption. |
| `preserveDrawingBuffer` | `false` | WebGL 2 only | Override `true` for screenshot-share features or video-capture flows. Has real perf cost (~5-15%); never enable globally if the feature is only used in a "share" modal. On WebGPU the equivalent is `canvas.toBlob()` after `render()`; the framework abstracts both via `handle.captureFrame()`. |
| `powerPreference` | `'high-performance'` | both | Override `'low-power'` for ambient / idle-friendly embeds (dashboards, marketing). Override `'default'` for laptops on battery if telemetry shows thermal complaints. |
| `failIfMajorPerformanceCaveat` | `false` | WebGL 2 only | Override `true` only if the consumer prefers an explicit error on software-rendered contexts over running the LOW tier on them. On WebGPU the adapter-request rejection serves the same role. |
| `precision` | `'highp'` | WebGL 2 only | Almost never overridden. Some old mobile GPUs report `highp` support but degrade gracefully; the framework relies on this. WebGPU's WGSL doesn't carry precision qualifiers. |
| `stencil` | `true` | both | Override `false` to save a small amount of VRAM if no post-FX effect uses the stencil buffer. |
| `depth` | `true` | both | Almost never overridden. |
| `logarithmicDepthBuffer` | `false` | both | Override `true` for very-large-world games where a single skinned mesh and a distant terrain coexist (z-fighting at far clip). Costs a fragment-shader instruction; not free. |
| `forceWebGL` | `false` | wrapper-level | Set `true` to instantiate `WebGLRenderer` directly even when WebGPU is available. Equivalent to `[renderer].prefer = "webgl2"`. Useful for in-code A/B testing. |

The framework wraps the construction in
`createRenderer(config: RendererConfig): RendererHandle` —
consumers never see the raw Three.js constructor. The handle
exposes a backend-normalised surface (`handle.renderer`,
`handle.backend`, `handle.capabilities`, `handle.info()`). This is
the [abstraction-discipline](abstraction-discipline.md) boundary:
the renderer wrapper is Tier A; only it imports `three` /
`three/webgpu`.

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

The framework gates per backend. WebGL 2 uses extension names;
WebGPU uses adapter `features` + `limits`.

**WebGL 2 default gates:** WebGL 2 itself, half-float textures,
anisotropic filtering, depth textures, `EXT_color_buffer_float`.
A consumer may add required + preferred extensions:

```json
{
  "detection": {
    "webgl2": {
      "requiredExtensions": ["WEBGL_compressed_texture_astc"],
      "preferredExtensions": ["KHR_parallel_shader_compile"]
    }
  }
}
```

**WebGPU default gates:** none beyond the minimum WebGPU adapter.
Consumers can require features (`timestamp-query`,
`texture-compression-bc`, `shader-f16`, etc.) or limits
(`maxTextureDimension2D`, `maxStorageBufferBindingSize`, etc.):

```json
{
  "detection": {
    "webgpu": {
      "requiredFeatures": ["timestamp-query"],
      "requiredLimits": {
        "maxTextureDimension2D": 16384,
        "maxStorageBufferBindingSize": 268435456
      },
      "preferredFeatures": ["texture-compression-bc", "shader-f16"]
    }
  }
}
```

Required-missing on the active backend = drop a tier (or fail the
floor probe and show the unsupported-device message).
Preferred-missing = log to telemetry, don't change behavior. The
two backend-specific blocks are independent — only the one
matching the resolved backend applies at boot.

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
*for tier selection*, but per-backend capability checks
(`requiredExtensions` on WebGL 2, `requiredFeatures` / `requiredLimits`
on WebGPU) still run — a missing required capability still blocks
boot.

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
    "floorThresholdMs": 50,
    "webgl2": {
      "requiredExtensions": [],
      "preferredExtensions": ["KHR_parallel_shader_compile"]
    },
    "webgpu": {
      "requiredFeatures": [],
      "preferredFeatures": ["texture-compression-bc", "shader-f16"],
      "requiredLimits": {},
      "preferredLimits": {}
    },
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
    "allowCustomShaders": "always-tsl",
    "warnOnUniqueInstanceCount": 100
  }
}
```

### Custom shader policy

The `materials.allowCustomShaders` value controls what shader
authoring the framework accepts. Per
[`renderer-feature-matrix.md`](renderer-feature-matrix.md), raw
GLSL `ShaderMaterial` doesn't run on WebGPU; the canonical custom
path is TSL.

| Value | Behaviour |
|---|---|
| `"always-tsl"` *(default)* | Custom materials must use `NodeMaterial` + TSL. Both backends produce identical output. Raw `ShaderMaterial` is a hard error at scene load. |
| `"raw-glsl-and-wgsl"` | Escape hatch. Consumer takes responsibility for their own dual implementation (or for using `[renderer].prefer = "webgl2"`). The framework warns when a `ShaderMaterial` is loaded on a WebGPU backend. |
| `"forbidden"` | No custom materials. Library roles only. Useful for tightly-controlled tier targets / kiosk builds. |

The policy is global per project; per-material exceptions are
discouraged. Move common patterns into the
[`recipe-canon.md`](recipe-canon.md) rather than scattering
escape-hatch usage.

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
6. **Backend detection** — `detectRenderer()` probes WebGPU,
   falls back to WebGL 2, persists choice — v0
7. **Capability gate enforcement** — per-backend
   (`requiredExtensions` on WebGL 2, `requiredFeatures` /
   `requiredLimits` on WebGPU) — v1
8. **Detection bypass + rationale telemetry** — v1
9. **Runtime adjustment policy knobs** wired through `FrameMonitor`
   — v1
10. **Schema validation error reporting** with actionable messages
    (which key, which file, expected shape) — v1
11. **Custom-shader policy enforcement** — TSL validation at
    scene load — v1

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
- [`renderer-feature-matrix.md`](renderer-feature-matrix.md) —
  per-feature support on each backend
- [`adr/0005-dual-renderer-backend.md`](adr/0005-dual-renderer-backend.md)
  — the dual-backend decision
- [`project-contract.md`](project-contract.md) — where the
  `[renderer]` table fits in `vibesmith.toml`
