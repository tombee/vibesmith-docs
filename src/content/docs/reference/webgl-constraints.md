---
title: 'WebGL constraints — hard limits we design within'
description: '> **Framework. Game-agnostic.** Consolidates the WebGL / WebGPU > platform limits that shape every other framework decision > (`performance-budgets.md`,...'
---

> **Framework. Game-agnostic.** Consolidates the WebGL / WebGPU
> platform limits that shape every other framework decision
> (`performance-budgets.md`, `adaptive-rendering.md`,
> `engine-patterns.md`, `asset-pipeline.md`). When a budget feels
> arbitrary, the constraint behind it lives here.

The renderer runs in a browser. That delivers reach (no install,
mobile + Steam Deck Linux + desktop, Tauri shell trivially) but
imposes hard ceilings that don't exist for a native Unity build. We
plan around them rather than chasing per-platform exceptions.

---

## Render API choice — both backends, framework-managed

**Both WebGL 2 and WebGPU are first-class.** The framework defaults
to **WebGPU when available** and falls back to **WebGL 2**
automatically when the adapter is absent — no consumer code
change. Per [`adr/0005-dual-renderer-backend.md`](adr/0005-dual-renderer-backend.md):

- **WebGL 2** is the universal baseline. Available since 2018 on
  desktop, since iOS Safari 15 (Sept 2021) on mobile, in every
  WebView Tauri ever uses, on every modern Android.
- **WebGPU** is the framework default for new projects. Stable in
  Chrome / Edge / Firefox / Safari 26+, on Tauri's Windows +
  macOS 26+ + iOS 26+. Linux WebKitGTK and Android System WebView
  don't yet expose it — those silently fall back.

The choice happens at boot via the `[renderer]` table in
`vibesmith.toml` (see [`renderer-configuration.md`](renderer-configuration.md));
detection + fallback flow live in `@vibesmith/renderer`. Per-
feature support is in
[`renderer-feature-matrix.md`](renderer-feature-matrix.md). This
doc covers the **hard platform limits** both backends sit inside.

**What WebGL 2 cannot do** (these define the LOW/MEDIUM-tier
ceiling and the Tauri-Linux / Tauri-Android ceiling):

| Feature | WebGL 2 | WebGPU | Framework approach |
|---|---|---|---|
| Compute shaders | Not supported | Supported | Pattern A graceful-degrade or Pattern B feature gate per [feature matrix](renderer-feature-matrix.md) |
| Bindless textures | Not supported | Limited | Texture atlases / arrays for both |
| Indirect drawing | Limited (no MultiDrawIndirect) | Full | Pattern A for crowd / culling |
| Mesh shaders | Not supported | Not yet shipping | Conventional vertex pipeline; revisit when WebGPU ships |
| Ray tracing | Not supported | Not exposed | Screen-space approximations (SSAO, SSR) for both |
| Geometry shaders | Not supported | Not exposed | Instanced meshes + vertex displacement |
| Tessellation shaders | Not supported | Not exposed | Pre-tessellated LODs |
| Multi-thread rendering | Single GPU context, main-thread | Same single-context | Workers handle CPU work; rendering stays main-thread |
| 64-bit float in shaders | Not supported | Limited (`shader-f64` feature) | 32-bit float; pack high-precision values into pairs |
| Shared GPU memory across tabs | No | No | Each tab sandboxed; backgrounds throttled by browser |
| Storage textures | Not supported | Supported | Pattern B feature gate |
| Timestamp queries | Not supported | `timestamp-query` feature | `caps.timestampQuery` |

---

## Hard numeric limits (WebGL 2 minimums)

These are **guaranteed minimums** per the WebGL 2 spec. Real GPUs
often exceed them, but we design against the minimums to keep low-end
hardware playable. Queryable at runtime via `gl.getParameter()` —
see `apps/client/src/diagnostics/captureGpuInfo.ts` (planned).

| Limit | Guaranteed minimum | Typical desktop | Implication |
|---|---|---|---|
| `MAX_TEXTURE_SIZE` | 2048 px | 16384 px | Asset pipeline outputs ≤2048 for universal compat; larger sizes are HIGH/ULTRA-tier upgrades |
| `MAX_3D_TEXTURE_SIZE` | 256 | 2048 | Volume textures are constrained; we avoid them for now |
| `MAX_ARRAY_TEXTURE_LAYERS` | 256 | 2048 | Plenty for texture-array atlases |
| `MAX_CUBE_MAP_TEXTURE_SIZE` | 2048 | 16384 | Env probes / reflections capped accordingly |
| `MAX_RENDERBUFFER_SIZE` | 2048 | 16384 | Offscreen render targets sized within this |
| `MAX_DRAW_BUFFERS` | 4 | 8 | G-buffer style deferred is workable (4 attachments) |
| `MAX_COLOR_ATTACHMENTS` | 4 | 8 | Same as draw buffers |
| `MAX_VERTEX_ATTRIBS` | 16 | 16-32 | Compact vertex layout; we currently target ≤8 attribs per mesh |
| `MAX_VERTEX_UNIFORM_VECTORS` | 256 | 1024-4096 | Skinning palettes constrained — see § Skinning |
| `MAX_FRAGMENT_UNIFORM_VECTORS` | 224 | 1024-4096 | Material uniforms compact; prefer UBOs |
| `MAX_VARYING_VECTORS` | 15 | 30-32 | Vertex→fragment interpolants tight; one varying = one attribute slot |
| `MAX_TEXTURE_IMAGE_UNITS` | 16 | 16-32 | Per-shader texture binds capped |
| `MAX_COMBINED_TEXTURE_IMAGE_UNITS` | 32 | 64-192 | Across vertex + fragment |
| `MAX_UNIFORM_BUFFER_BINDINGS` | 24 | 36-84 | UBOs viable for per-frame / per-material data |
| `MAX_UNIFORM_BLOCK_SIZE` | 16 KB | 64 KB | Single UBO can't be huge; split per concern |
| `MAX_TRANSFORM_FEEDBACK_*` | varies | varies | We don't use TF (covered by R3F instancing) |

The runtime queries these on boot and routes the tier choice; an
adaptive renderer that demands more than the device offers degrades
visibly (missing reflections, smaller atlases) but doesn't crash.

---

## Hard numeric limits (WebGPU required minimums)

WebGPU specifies a different limit surface than WebGL 2 — limits
are queried per-adapter via `adapter.limits` and per-device via
`device.limits`, and consumers can declare `requiredLimits` at
device-creation time. These are the **required minimums** per the
WebGPU spec. Real adapters typically expose much more.

| Limit | Required minimum | Typical desktop | Implication |
|---|---|---|---|
| `maxTextureDimension2D` | 8192 | 16384 | Asset pipeline output ≤8K for WebGPU; ≤2K for the shared WebGL 2 path |
| `maxTextureDimension3D` | 2048 | 2048 | Volume textures viable on WebGPU; not on WebGL 2 |
| `maxTextureArrayLayers` | 256 | 2048 | Texture-array atlases comparable |
| `maxBindGroups` | 4 | 8 | Bind-group budget per draw |
| `maxBindGroupsPlusVertexBuffers` | 24 | 32 | |
| `maxBindingsPerBindGroup` | 1000 | 1000 | Per-group resource budget |
| `maxDynamicUniformBuffersPerPipelineLayout` | 8 | 8 | |
| `maxDynamicStorageBuffersPerPipelineLayout` | 4 | 8 | |
| `maxSampledTexturesPerShaderStage` | 16 | 16-128 | Per-shader texture binds |
| `maxStorageBuffersPerShaderStage` | 8 | 10-30 | Storage buffers (compute) per stage |
| `maxStorageTexturesPerShaderStage` | 4 | 4-8 | Storage-texture writes (Pattern B) |
| `maxUniformBuffersPerShaderStage` | 12 | 12 | UBO budget per stage |
| `maxUniformBufferBindingSize` | 64 KB | 64 KB | Larger than WebGL 2 (16 KB minimum) |
| `maxStorageBufferBindingSize` | 128 MB | 1 GB+ | Compute working sets |
| `maxVertexBuffers` | 8 | 8 | |
| `maxVertexAttributes` | 16 | 16 | Matches WebGL 2 |
| `maxComputeWorkgroupStorageSize` | 16 KB | 32 KB | Compute kernel shared memory |
| `maxComputeInvocationsPerWorkgroup` | 256 | 256-1024 | Compute kernel dispatch size |
| `maxComputeWorkgroupSizeX/Y/Z` | 256 / 256 / 64 | 1024 / 1024 / 64 | Compute kernel dims |
| `maxComputeWorkgroupsPerDimension` | 65535 | 65535+ | Dispatch grid dims |

Optional features (consumer opts in via `requiredFeatures`):

| Feature | When useful |
|---|---|
| `timestamp-query` | GPU-side profiling; surfaced via `caps.timestampQuery` |
| `texture-compression-bc` | Desktop-quality compressed textures |
| `texture-compression-etc2` | Mobile-quality compressed textures |
| `texture-compression-astc` | High-quality compressed textures (Apple Silicon) |
| `shader-f16` | Half-precision shader math |
| `indirect-first-instance` | Indirect drawing with base instance |
| `float32-filterable` | Linear filtering on f32 textures |

The framework queries these on adapter request; missing required
features fail boot the same way missing WebGL 2 extensions do.

---

## Memory ceilings

**Per-tab memory** is the real ceiling on session length. Browsers
enforce it inconsistently; we plan against the strictest case (iOS
Safari ~1 GB; mobile Android Chrome ~2-4 GB; desktop ~4-8 GB before
warnings). The MMO has to hold an active scene, audio, textures,
network state, and JS heap all within that envelope.

**Texture budget per tier** (calibrated rather than fixed — see
`performance-budgets.md`):

| Tier | Texture VRAM cap | Mesh memory cap | Asset mip choice |
|---|---|---|---|
| LOW (mobile, low-spec) | ~128 MB | ~64 MB | Half-res textures (max 1024), aggressive mip drops |
| MEDIUM (Steam Deck, mid PC) | ~256 MB | ~128 MB | Default mips (max 2048) |
| HIGH (modern desktop) | ~512 MB | ~256 MB | Full mips, optional 4K terrain textures |
| ULTRA (top-tier) | ~1 GB | ~512 MB | All ULTRA-only features (4K textures, dense foliage, etc.) |

Numbers are starting hypotheses; FrameMonitor calibrates against
actual draw timings. The asset pipeline outputs all four tier
variants from one source (KTX2 has tier-aware mip selection built
in); the runtime picks at load time.

**JS heap** typically stays under 200 MB even for large scenes
because we don't keep mesh geometry on the JS side after upload;
networking state is the dominant residual.

**Audio buffers** count toward the same envelope — decoded PCM is
expensive. We stream where possible, decode on demand, and unload
between scenes.

---

## Frame budget arithmetic

60 fps = **16.67 ms per frame**. 30 fps fallback = 33.3 ms.
Within that budget on a modern desktop GPU:

| Cost | Approximate budget |
|---|---|
| JS frame work (game logic, physics, interpolation) | ≤6 ms |
| Three.js scene update + culling | ≤2 ms |
| WebGL submit overhead (per draw call) | ~10 μs |
| GPU rasterization | depends on overdraw + shader cost |
| Tab switch / GC pause | should not appear in steady state |

The **draw-call ceiling** is therefore around **~600 per frame**
before submit overhead alone consumes half the budget — and that's
desktop. Mobile WebGL drivers add per-call cost (often ~50-100 μs).
The performance budget assumes ≤500 draw calls on LOW tier,
~1500 on HIGH tier, with instancing for repeated meshes
(`InstancedMesh` collapses N draw calls into 1).

**Triangle ceiling** is around **~1M visible per frame on LOW**,
~3-5M on HIGH. Above that, vertex transform cost stops being
draw-call bound and starts being raw shader cost.

---

## Skinning + animation constraints

`MAX_VERTEX_UNIFORM_VECTORS = 256` (guaranteed minimum) limits how
many bones a skinned mesh can have when bones are passed as uniforms.
Each bone consumes 4 vec4s (a 4x4 matrix). With overhead for other
uniforms, the practical cap is **~50 bones per skinned mesh** on
LOW tier hardware.

Three.js mitigates via:
- **Bone textures** — bone matrices uploaded as a texture rather than
  uniforms, bypassing the uniform limit. Adds a texture read per
  vertex but supports hundreds of bones.
- **Instanced skinned mesh** — N characters sharing one skeleton
  pose at one cost. Useful for crowds.

We use bone textures by default (Three.js's `useVertexTexture: true`
on `SkinnedMesh`).

---

## Browser quirks worth designing around

**iOS Safari**:
- Tighter memory cap (~1 GB per tab).
- Background-tab JS throttled aggressively; reconnect logic must
  expect long pauses.
- WebAudio requires user gesture before first sound.
- WebGL 2 enabled by default but some extensions missing.

**Chrome (desktop + Android)**:
- Most permissive. Reference implementation for testing.
- Background tabs throttled to 1 Hz timer after ~5 minutes.

**Firefox**:
- Generally good WebGL 2 support; occasional driver-specific bugs.
- WebGPU shipping in Nightly; not yet stable.

**Safari Mac**:
- Strict CORS for textures; asset CDN must serve correct headers.
- WebGPU shipping via Technology Preview.

**Mobile Chrome on Android**:
- Wide device variance. Thermal throttling is the dominant factor
  on long sessions — sustained perf often half of burst perf.

**Steam Deck**:
- Native Chromium-based browser (some users run Firefox/Brave).
- Touch + gamepad + keyboard + mouse all simultaneously possible.
- 1280x800 native display; render at native, no scaling tricks.
- Thermal envelope is real: sustained perf drops after ~10 min.

**Tauri 2.0 webview** (option if browser becomes load-bearing
limit):
- macOS / iOS: WKWebView
- Linux: WebKitGTK
- Windows: WebView2 (Chromium)
- Android: Android WebView (Chromium)
- Renders WebGL 2 universally; WebGPU patchier per platform.

---

## Input + interaction limits

**Pointer events** are the unified input layer (mouse + touch +
pen). Native API is reliable on all modern browsers.

**Gamepad API** works in all major browsers; Steam Deck reports as a
standard gamepad. Connection events fire on first input, not on
gamepad-plugged-in — keep a "press any button to connect" prompt
in mind.

**Pointer lock + fullscreen** require user gesture; some browsers
(notably iOS Safari) restrict pointer lock heavily on mobile.

**Keyboard** — international layouts vary. Use `event.code` for
position-based bindings (WASD), `event.key` for character-based.

**Touch** — multi-touch supported; gesture recognition we build
ourselves (Three.js doesn't ship it).

**Haptics** — limited on web; Gamepad API has rumble where
supported, mobile Vibration API exists but is unreliable.

---

## Network constraints from the browser

**WebSocket** is the transport for Colyseus. Browsers allow ~6
concurrent connections per origin, plenty for game + analytics +
asset CDN.

**WebRTC** is available if peer-to-peer state sync ever pays off;
we don't use it currently.

**HTTP/2 + HTTP/3** matter for asset loading speed; the CDN should
support both.

**Service Workers** can cache assets aggressively, enabling
offline / patch-on-launch flows; out of scope at v0.

---

## What this means for content

The asset pipeline (`asset-pipeline.md`) outputs that respect:
- Per-tier texture caps (KTX2 with tier-appropriate mips)
- Per-tier triangle caps (auto-LOD generation; Tier ULTRA gets the
  source mesh, LOW gets ~10-15% triangle count)
- Material slot caps (≤4 textures per material on LOW)
- Bone counts ≤50 per skinned mesh on LOW

Content authoring tools live within these — the prefab system's
generators emit compositions that already obey the budget.

---

## Reassessment triggers

Revisit this doc when:
- A target platform drops or adds capability (e.g. WebGPU goes
  universally stable; older mobile dies off enough to retire
  WebGL 1 fallbacks we never had to ship anyway)
- A budget assumption proves wrong in calibrated measurement (the
  performance-budgets doc is the source of truth for measured
  numbers; this doc covers the *constraints*, not the budgets)
- Three.js / R3F lifts a constraint via a new abstraction (e.g.
  GPU-driven culling, indirect draw via WebGPU)

---

## Cross-references

- [`performance-budgets.md`](performance-budgets.md) — measured
  budgets that derive from these constraints
- [`adaptive-rendering.md`](adaptive-rendering.md) — runtime tier
  selection within these limits
- [`asset-pipeline.md`](asset-pipeline.md) — per-tier asset
  variants that respect the caps
- [`engine-patterns.md`](engine-patterns.md) — Three.js / R3F
  patterns that work within the API surface
- [`cross-platform.md`](cross-platform.md) — mobile + Steam Deck +
  PC delivery context
- [`renderer-configuration.md`](renderer-configuration.md) — the
  consumer-facing knobs (context options, DPR, detection extension
  points) that live above these platform-fixed limits
- [`renderer-feature-matrix.md`](renderer-feature-matrix.md) —
  per-feature support on each backend + fallback patterns
- [`adr/0005-dual-renderer-backend.md`](adr/0005-dual-renderer-backend.md)
  — the dual-backend decision context
