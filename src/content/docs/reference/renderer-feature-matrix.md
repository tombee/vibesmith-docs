---
title: 'Renderer feature matrix — what works where, and how we fall back'
description: '> **Framework. Game-agnostic. Consumer-facing.** The exhaustive > answer to *"does feature X work on both backends?"* and, if not, > *"what does the framework do about it?"*....'
---

> **Framework. Game-agnostic. Consumer-facing.** The exhaustive
> answer to *"does feature X work on both backends?"* and, if not,
> *"what does the framework do about it?"*. Lives next to
> [`renderer-configuration.md`](renderer-configuration.md) (the
> *how-to-configure* surface) and below
> [`webgl-constraints.md`](webgl-constraints.md) (the hard
> platform limits both backends sit inside).
>
> Living document — gaps and edge cases land here as they're
> discovered. Per [`adr/0005-dual-renderer-backend.md`](adr/0005-dual-renderer-backend.md).

## The framework's commitment

For every feature listed below the framework guarantees one of
three outcomes when running on either backend:

- **Single implementation.** The feature works identically on both
  backends. The consumer writes one component / one material /
  one shader; Three.js + TSL handle the rest. No special handling.
- **Graceful degrade (Pattern A).** The feature exists on both
  backends with different *internal routes*. WebGPU path uses
  compute / indirect-draw / storage textures; WebGL 2 path uses
  CPU / transform feedback / reduced fidelity. The component API
  is identical; framework picks the route.
- **Feature gate (Pattern B).** The feature exists only on WebGPU.
  On WebGL 2 it's silently absent — the game still works without
  it. Consumers branch on `caps.<feature>` to opt in.

A fourth outcome — **backend requirement (Pattern C)** — is
reserved for the rare project that pins
`renderer.prefer = "webgpu-required"` and refuses to boot on
WebGL 2. Not a default; not how most features ship.

See [`adr/0005-dual-renderer-backend.md`](adr/0005-dual-renderer-backend.md)
for the decision context.

## How consumers consume this

The framework exposes a capability surface via `@vibesmith/renderer`:

```ts
import { useRendererCapabilities } from '@vibesmith/renderer';

function FancyEffect() {
  const caps = useRendererCapabilities();
  if (!caps.compute) return null;     // Pattern B feature gate
  return <VolumetricFog density={0.5} />;
}
```

**Rule of thumb:** branch on `caps.<capability>`, never on
`handle.backend`. The capability surface is the stable contract;
the backend identity is a transient implementation detail and
shouldn't leak into consumer code.

The capabilities currently surfaced (more added as features land):

| Capability | True when | Used by |
|---|---|---|
| `caps.compute` | WebGPU adapter active | Pattern A / B features that need compute shaders |
| `caps.indirectDraw` | WebGPU adapter active | GPU-driven culling, indirect crowd rendering |
| `caps.storageTextures` | WebGPU adapter active | Fluid / SDF / custom compute-output effects |
| `caps.timestampQuery` | WebGPU + `timestamp-query` feature | GPU-side profiling |
| `caps.parallelShaderCompile` | WebGL 2 + `KHR_parallel_shader_compile`, or always on WebGPU | Async material precompile |
| `caps.maxTextureSize` | platform-reported | Texture sizing decisions |
| `caps.maxComputeWorkgroupSize` | WebGPU adapter active | Compute kernel dispatch |

---

## Core rendering

| Feature | Outcome | Notes |
|---|---|---|
| Indexed mesh draw | Single impl | Universal |
| `InstancedMesh` | Single impl | Same API both backends |
| Skinned mesh | Single impl | WebGPU uses storage buffer; WebGL 2 uses bone texture. Both via Three.js; transparent |
| Morph targets | Single impl | |
| `OrthographicCamera` (2D-style) | Single impl | |
| `PerspectiveCamera` | Single impl | |
| Render-to-texture | Single impl | API differs internally; Three.js abstracts |
| Depth texture | Single impl | |
| Stencil buffer | Single impl | |
| MSAA | Single impl | |

## Materials

| Material | Outcome | Notes |
|---|---|---|
| `MeshBasicMaterial` | Single impl | |
| `MeshLambertMaterial` | Single impl | |
| `MeshStandardMaterial` (PBR) | Single impl | Identical output |
| `MeshPhysicalMaterial` | Single impl | Clearcoat, sheen, iridescence |
| `MeshToonMaterial` | Single impl | |
| `NodeMaterial` (TSL) | Single impl | **The canonical custom-material path** |
| `ShaderMaterial` (raw GLSL) | **Not supported on WebGPU** | Use `NodeMaterial` + TSL. Raw GLSL is gated behind `renderer-config.json`'s `allowCustomShaders: "raw-glsl-and-wgsl"` escape hatch |

**Framework policy:** consumers write custom materials in TSL via
`NodeMaterial`. Raw `ShaderMaterial` works only on WebGL 2 and
requires opt-in. See [`material-system.md`](material-system.md)
and [`renderer-configuration.md`](renderer-configuration.md)
§ Custom shader policy.

## Lighting + shadows

| Feature | Outcome | Notes |
|---|---|---|
| Ambient / hemisphere light | Single impl | |
| Directional + cascaded shadows | Single impl | |
| Point lights + cubemap shadows | Single impl | |
| Spot lights + perspective shadows | Single impl | |
| PCFSoft shadow filtering | Single impl | |
| VSM shadow filtering | Single impl | |
| Light probes / image-based lighting | Single impl | |
| Contact shadows / SSAO | Single impl | Via postprocessing v3+ |
| Real-time global illumination | Pattern B | Compute-driven; WebGPU only |

## Post-processing

Via `@react-three/postprocessing` v3+. Effects below mount inside
`<EffectComposer>`:

| Effect | Outcome | Notes |
|---|---|---|
| Tone mapping | Single impl | ACES / Cineon / Neutral |
| Bloom | Single impl | |
| SSAO | Single impl | |
| Colour grading (LUT) | Single impl | |
| FXAA / SMAA | Single impl | |
| Depth of field | Single impl | |
| Motion blur | Pattern A | WebGL 2 approximation; WebGPU does it properly |
| Volumetric / atmospheric fog | Pattern B | Compute-driven |
| Custom compute-based post-FX | Pattern B | |

## Particles + crowds

| Feature | Outcome | Notes |
|---|---|---|
| Sprite particles, small count (≤ ~5k) | Single impl | `InstancedMesh`; both backends |
| Compute particles, large count (10k+) | **Pattern A** | `<ComputeParticles>`; WebGPU uses compute shader, WebGL 2 caps fidelity to ~5k CPU particles |
| Crowd rendering, small (≤ ~200 chars) | Single impl | Skinned-instanced |
| Crowd rendering, large (≥ 1000 chars) | **Pattern A** | WebGL 2 uses billboard impostors; WebGPU uses indirect-draw |
| Trail / ribbon effects | Single impl | |

## Compute-only (WebGPU, Pattern B)

| Feature | Notes |
|---|---|
| GPU frustum culling | WebGL 2 uses CPU culling; this is the WebGPU upside |
| GPU occlusion culling | WebGPU only |
| Fluid simulation | Stable on WebGPU; no realistic WebGL 2 path |
| Cloth / soft-body simulation | Same |
| Procedural mesh generation in compute | WebGL 2 alternative: workers + JS |
| ML inference (gesture recognition, pose estimation, etc.) | WebGPU compute; not in scope for the render path, but uses the same adapter |

## Assets

| Format | Outcome | Notes |
|---|---|---|
| glTF (.glb / .gltf) | Single impl | Identical loader |
| KTX2 (UASTC / ETC1S) | Single impl | Transcode targets differ slightly per backend; loader picks |
| Draco-compressed meshes | Single impl | |
| Audio (PCM / OGG / WAV / etc.) | Single impl | Browser-handled; renderer-irrelevant |
| HDR environment maps | Single impl | |
| Compressed textures (BC / ETC / ASTC) | Single impl | WebGPU coverage broader; framework targets the intersection |

## Telemetry + probes

| Probe field | WebGL 2 source | WebGPU source | Normalised at |
|---|---|---|---|
| Draw call count | `gl.info.render.calls` | `renderer.info.render.drawCalls` | `handle.info()` |
| Triangle count | `gl.info.render.triangles` | renderer-side | `handle.info()` |
| Geometries count | `gl.info.memory.geometries` | renderer-side | `handle.info()` |
| Textures count | `gl.info.memory.textures` | renderer-side | `handle.info()` |
| Shader programs count | `gl.info.programs.length` | renderer-side | `handle.info()` |
| Frame time (wall clock) | consumer-supplied | consumer-supplied | unchanged |
| GPU timestamp queries | Not available | `caps.timestampQuery` if feature requested | optional |

`packages/r3f-probes/src/renderer-probe.ts` reads `handle.info()`
in the normalised form rather than raw `gl.info`. Telemetry
captures carry a `meta.renderingKind` of `webgl` or `webgpu`
(per the `RenderingKind` enum in
`@vibesmith/runtime-introspection`) so downstream tooling knows
which backend produced the data.

## Async shader compilation

| Backend | Mechanism | Behaviour |
|---|---|---|
| WebGL 2 | `KHR_parallel_shader_compile` (extension) | Async when extension present; serial otherwise |
| WebGPU | Built into pipeline creation | Always async |

The framework's material-precompile pass per
[`material-system.md`](material-system.md) uses async compilation
where available. No consumer-facing difference.

---

## Cookbook: choosing between Patterns A / B / C

When a feature lands that doesn't have a WebGL 2 equivalent, the
framework author picks one of the three patterns. This section is
the heuristic.

### Default to Pattern A (graceful degrade)

If the feature's visual identity *could* exist on WebGL 2 at
reduced fidelity, write both implementations and pick the route
inside the framework component. Consumer writes one component.

Use Pattern A when:
- The visual is recognisable on both backends (a particle is still
  a particle at 5k instead of 100k).
- The WebGL 2 implementation is finite — small enough to maintain.
- The framework intends to ship the feature in the default tier
  table for LOW/MEDIUM.

### Choose Pattern B (feature gate) when

- Building a WebGL 2 equivalent would be substantially more code
  than the feature itself (e.g., 64-slice fragment-shader fog vs
  a 200-line compute shader).
- The visual identity *requires* compute (a fluid sim that
  becomes "blue rectangles" on WebGL 2 isn't gracefully degraded
  — it's broken).
- The feature only ships in the ULTRA tier; LOW/MEDIUM never see
  it and the game doesn't depend on it.

### Choose Pattern C (backend requirement) only when

- The game's identity is a compute-driven simulation; without
  WebGPU there is no game.
- The project is kiosk / demo / internal-tooling and the hardware
  is fixed.

Pattern C is the **rarest** choice. Frameworks ship Pattern C
features only on explicit consumer opt-in via
`renderer.prefer = "webgpu-required"`.

### What never to do

- **Don't expose `handle.backend` to consumer code.** It's a leak
  of internal state. Use `caps.<capability>` instead.
- **Don't write per-backend forks in the consumer's game code.**
  If a feature needs different implementations per backend, that
  belongs inside a framework component, not in the consumer's
  source tree.
- **Don't add features to the default tier table that only work
  on WebGPU.** That breaks the WebGL 2 path silently. Use
  Pattern B + opt-in instead.

---

## Reassessment triggers

Refresh this matrix when:

1. **Three.js ships a feature with backend-specific behaviour.**
   Each new feature gets a row in the appropriate table.
2. **TSL closes a gap.** Idioms previously requiring raw
   GLSL/WGSL move to single-implementation.
3. **A consumer ships a Pattern A or B feature.** Reference
   implementations move into the framework's repository and get
   linked from the relevant row.
4. **A WebGPU-mobile reliability issue is confirmed.** Add the
   pattern + workaround to the row.

---

## Cross-references

- [`adr/0005-dual-renderer-backend.md`](adr/0005-dual-renderer-backend.md)
  — the decision behind this matrix.
- [`renderer-configuration.md`](renderer-configuration.md) — the
  `[renderer]` table and per-backend capability gates.
- [`webgl-constraints.md`](webgl-constraints.md) — platform
  limits both backends sit inside.
- [`adaptive-rendering.md`](adaptive-rendering.md) — tier
  mechanism (orthogonal to backend selection).
- [`material-system.md`](material-system.md) — TSL-first
  material authoring; per-tier capability matrix.
- [`qa-strategy.md`](qa-strategy.md) — Tier 0 probe pipeline
  runs probes against both backends.
