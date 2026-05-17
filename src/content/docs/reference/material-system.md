---
title: 'Material system — roles, tier capability, shader policy'
description: '> **Framework. Game-agnostic.** Pins the *material role* abstraction > (recipes say "stone-rough", the framework picks the concrete > material per tier),...'
---

> **Framework. Game-agnostic.** Pins the *material role* abstraction
> (recipes say "stone-rough", the framework picks the concrete
> material per tier), the per-tier material capability matrix, the
> texture-channel packing convention (asset pipeline ↔ material
> input contract), and the shader compilation + sharing policy.
> Sibling to [`prefab-system.md`](prefab-system.md) (which owns
> *content units*) and [`adaptive-rendering.md`](adaptive-rendering.md)
> (which owns *tier mechanics*).

Materials are where the most subtle perf footguns live. A scene with
500 unique `MeshStandardMaterial` instances compiles ~500 shader
variants, hitches the first frame each new variant renders, and
makes draw-call batching impossible. The framework's job is to make
the right thing easy: a small set of role-keyed shared material
instances, tier-appropriate features, and a stable texture-channel
convention so the asset pipeline drops in without per-asset glue.

---

## The role abstraction

Prefab recipes never reference Three.js material classes. They
reference *roles* — game-meaningful labels that the framework
resolves to a concrete material instance per tier.

```ts
// in a recipe (game-side, but framework-shape):
{
  "mesh": "assets/buildings/stone-wall.glb",
  "materials": {
    "wall": { "role": "stone-rough", "tint": "#a8a397" },
    "trim": { "role": "wood-painted", "tint": "#5b3a1f" }
  }
}
```

At load time the framework:
1. Looks up `stone-rough` in the per-game **material library**
   (`packages/content/data/materials.json`).
2. Picks the tier-appropriate **concrete material** (Lambert on LOW,
   Standard on MEDIUM/HIGH, Physical on ULTRA — or whatever the
   library specifies for that role + tier).
3. Returns a **shared instance** keyed by role + tint + tier. Three
   different walls all using `stone-rough` + the same tint share
   one material → one shader compile, one uniform-buffer binding.

Why this matters:
- **Same recipe runs at every tier** — no per-tier asset variants
  beyond what the asset pipeline already produces.
- **Material library is a flat catalogue** — easy to audit, easy
  for the director-pattern to surface ("what materials exist? show
  me previews"), trivial to add/remove a role.
- **Shader compile count is bounded** by role count × tier, not
  object count.

The role vocabulary is **game-side** — each consumer defines its
own palette of roles. The framework ships a small starter set
(`metal-painted`, `stone-rough`, `wood-painted`, `fabric-soft`,
`glass-clear`, `emissive-soft`, `unlit-ui`, `terrain-blend`) as
examples; a game can replace them entirely.

---

## Per-tier material capability matrix

Each tier has a budget for *what kinds of material features fit*.
The library declares per-role-per-tier which Three.js material
class to use; this table is the framework default that role entries
fall through to.

| Feature | LOW | MEDIUM | HIGH | ULTRA |
|---|---|---|---|---|
| Material class | `MeshLambertMaterial` or `MeshBasicMaterial` | `MeshStandardMaterial` | `MeshStandardMaterial` | `MeshPhysicalMaterial` |
| Albedo (base color map) | yes | yes | yes | yes |
| Normal map | optional | yes | yes | yes |
| Roughness + metalness (ORM) | no (flat) | yes (packed) | yes (packed) | yes (packed) |
| Ambient occlusion map | no | optional | yes | yes |
| Emissive map | no | optional | yes | yes |
| Clearcoat | no | no | optional | yes |
| Sheen (fabric) | no | no | no | yes |
| Iridescence | no | no | no | optional |
| Transmission (glass) | alpha-blend approx | alpha-blend approx | optional | yes |
| Anisotropy | no | no | no | yes |
| Subsurface (fake) | no | no | optional (cheap approx) | yes |
| Textures per material (max) | 2 | 4 | 6 | 8+ |
| Alpha mode | test only | test + limited blend | full | full + OIT where supported |

Numbers are framework defaults; the per-game material library
overrides any cell. A stylized-flat game might choose
`MeshBasicMaterial` (no lighting) on every tier — that's fine; the
library declares it explicitly per role.

The matrix interacts with `adaptive-rendering.md`'s tier slots:
**texture-fidelity slot** controls the *byte size* of the textures
that fill these material slots; the **material slot** here controls
*which slots even exist*.

**Backend constraint:** every material class in this table runs
on both WebGL 2 and WebGPU. A role can additionally declare a
`backendConstraint` field (`"webgpu" | "webgl2"`) on a per-tier
basis for materials that depend on compute or storage textures —
e.g., a procedural-displaced terrain material that uses a compute-
written heightmap. Constrained materials follow the Pattern B
gate from [`renderer-feature-matrix.md`](renderer-feature-matrix.md):
the role falls back to its sibling material when the active
backend doesn't support it. Most roles don't need this; the field
defaults absent (= both backends).

---

## The material library shape

`packages/content/data/materials.json`:

```json
{
  "roles": {
    "stone-rough": {
      "tiers": {
        "LOW": { "class": "MeshLambertMaterial", "maps": ["albedo"] },
        "MEDIUM": { "class": "MeshStandardMaterial", "maps": ["albedo", "normal", "orm"] },
        "HIGH": { "class": "MeshStandardMaterial", "maps": ["albedo", "normal", "orm", "ao"] },
        "ULTRA": { "class": "MeshStandardMaterial", "maps": ["albedo", "normal", "orm", "ao"] }
      },
      "assetPrefix": "materials/stone-rough/",
      "uvScale": [2, 2],
      "tintMode": "multiply"
    },
    "glass-clear": {
      "tiers": {
        "LOW": { "class": "MeshBasicMaterial", "transparent": true, "opacity": 0.5 },
        "MEDIUM": { "class": "MeshStandardMaterial", "transparent": true, "opacity": 0.5 },
        "HIGH": { "class": "MeshPhysicalMaterial", "transmission": 0.9, "ior": 1.5 },
        "ULTRA": { "class": "MeshPhysicalMaterial", "transmission": 0.95, "ior": 1.5, "thickness": 0.5 }
      },
      "assetPrefix": "materials/glass-clear/",
      "uvScale": [1, 1],
      "tintMode": "tint"
    }
  }
}
```

`assetPrefix` lets the asset pipeline drop tier-appropriate texture
variants under a predictable path; the runtime composes
`{assetPrefix}{tier}/{map}.ktx2` to find the right file. `tintMode`
lets the recipe-provided tint apply uniformly across roles (multiply
into albedo for opaque, tint the base color for transparent).

---

## Texture-channel packing convention

The asset pipeline outputs textures using a single packing
convention so every material expects the same slot layout. This is
the contract between [`asset-pipeline.md`](asset-pipeline.md) and
this doc.

| Map | Channels | Color space | Encoding |
|---|---|---|---|
| **Albedo** | RGB = base color, A = opacity (when alpha-tested) | sRGB | KTX2 / UASTC → BC7 (or ETC1S → BC1 on LOW) |
| **Normal** | RG = normal XY (reconstruct Z), B = unused (or detail mask), A = unused | Linear | KTX2 / UASTC → BC7 |
| **ORM** | R = AO, G = roughness, B = metalness, A = unused | Linear | KTX2 / UASTC → BC7 |
| **Emissive** | RGB = emissive color, A = mask | sRGB | KTX2 / UASTC → BC7 |
| **Detail** (optional) | RGB = detail normal/albedo blend | Linear or sRGB depending on use | KTX2 / UASTC → BC7 |

The **ORM packing** is the standard Unreal / Unity HDRP convention
and what virtually every PBR pipeline expects. The framework's
material library wires R→aoIntensity, G→roughness, B→metalness via
a shared `onBeforeCompile` hook on `MeshStandardMaterial` (Three.js
ships an AO map and metalness/roughness maps separately by default;
the hook reads them from one texture).

Source assets (in Blender / DCC) author each channel separately;
the asset pipeline packs to ORM at build time. Game-side artists
do not deal with packing manually.

---

## Shader compilation strategy

Three.js compiles shaders **lazily on first render** — the first
frame a material variant appears causes a synchronous compile
hitch (5-50ms typical, 500ms+ on slow Android). Without a
strategy, every scene change causes visible stutter as new
materials enter view.

Framework strategy:

1. **Precompile on scene load** — after a scene's assets are
   loaded but before the first frame renders, walk the scene and
   call `renderer.compileAsync(scene, camera)`. This is async and
   respects `KHR_parallel_shader_compile` where available.
2. **Detect and use `KHR_parallel_shader_compile`** — this
   extension lets shader compile happen on background driver
   threads. Listed as preferred in `renderer-configuration.md`
   capability gates.
3. **Variant warming** — for known runtime variants (skinning,
   shadow caster, depth-pre-pass, instanced), force-compile each
   variant at scene load by briefly instantiating one each.
4. **Persistent variant cache** — Three.js's `ProgramCache` keys by
   shader source; framework lifts this into a session-level cache
   so loading scene B after scene A reuses shared compiled shaders
   without re-walking.

The `FrameMonitor` from `adaptive-rendering.md` reports
**shader-compile frames** separately from steady-state frames so
the tier-shift loop doesn't downgrade based on compile hitches.

---

## Material sharing + caching

The runtime maintains a **material instance cache** keyed by
`role + tint + tier + uvScale + variantFlags`. First request creates
the instance; subsequent requests with the same key return the
cached instance.

```ts
// framework-internal:
function getMaterial(spec: MaterialSpec, tier: RenderTier): Material {
  const key = hashMaterialSpec(spec, tier);
  if (cache.has(key)) return cache.get(key)!;
  const mat = buildMaterial(spec, tier);
  cache.set(key, mat);
  return mat;
}
```

Variant flags include:
- `skinned` — skinned-mesh variants need different shader defines
- `instanced` — instanced-mesh variants need different attributes
- `castShadow` / `receiveShadow` — separate depth-only shader

The cache is **per-scene** (cleared on scene transition) but
**variant-shared within a scene**. This bounds memory while
maximising compile reuse.

**Telemetry**: the runtime logs the cache's unique-instance count.
A configurable threshold (`renderer-config.json` →
`materials.warnOnUniqueInstanceCount`, default `100`) triggers a
console warning when exceeded — almost always a sign that some
code is creating per-object materials instead of using the role
catalogue.

---

## Custom shader policy

Per [`adr/0005-dual-renderer-backend.md`](adr/0005-dual-renderer-backend.md),
the framework runs both WebGPU and WebGL 2; the canonical custom-
material path is **TSL** (Three Shader Language), which transpiles
to WGSL on WebGPU and GLSL ES 3.00 on WebGL 2. Raw GLSL
`ShaderMaterial` runs only on WebGL 2.

| Approach | When to use | Backend coverage | Coupling |
|---|---|---|---|
| **Material library role** (no shader code) | Default. Any visual that the role catalogue + parameters can express. | Both | Tier A (boundary-only) |
| **`NodeMaterial` + TSL** | Preferred for any custom material. Declarative, survives Three.js updates, runs on both backends from one source. | Both | Tier A (declarative, stable surface) |
| **`onBeforeCompile` hook on standard material** | Discouraged for new work — touches Three.js shader internals via GLSL injection, doesn't run on WebGPU. Keep only for legacy code yet to be ported to TSL. | WebGL 2 only | Tier B + WebGL-only |
| **Full `ShaderMaterial` / `RawShaderMaterial`** | Effects that need raw GLSL. The framework's default disallows this; require explicit project-level opt-in. | WebGL 2 only | Tier C + WebGL-only |

`renderer-config.json` → `materials.allowCustomShaders` gates
which approaches a build allows. The values are documented in
[`renderer-configuration.md`](renderer-configuration.md) § Custom
shader policy; the framework default is `"always-tsl"` (roles +
TSL `NodeMaterial` only; raw shaders are hard errors).

The `recipe-canon.md` retrieve-adapt-validate flow covers the
specific case where an AI-generated TSL recipe fails — the human
gate either adapts the recipe or falls back to a curated variant.
TSL gaps (idioms that don't yet have TSL equivalents) are tracked
in the recipe canon's `backendCoverage` metadata; the framework
skips backend-incompatible recipes when running on the affected
backend.

Custom shaders accumulate maintenance debt; the `shader-critic`
agent (see [`subagent-roster.md`](subagent-roster.md)) reviews
custom-shader additions for: TSL portability, varying-vector
budget against `webgl-constraints.md` limits, missing tier-degraded
variants.

---

## Skinning, instancing, and material variants

Three.js generates a **separate compiled shader** per combination of
material × skinning × instancing × shadow-pass. A naive scene with
one `MeshStandardMaterial` and three skinned characters in shadow
already compiles 4 variants: base, skinned, skinned-shadow,
shadow-only.

Framework discipline:

- **Skinned-mesh roles** are explicit in the material library
  (`"variants": ["skinned"]` in the role entry). Loading a skinned
  glTF assigns the skinned variant automatically; non-skinned
  meshes get the non-skinned variant. Variants share base shader
  source but differ in defines.
- **Instanced-mesh roles** similarly explicit. `InstancedMesh`
  rendering reuses one material across N instances — that's the
  point of instancing.
- **Per-instance color / variation** uses `InstancedBufferAttribute`
  on the mesh, not per-instance materials. The material library
  ships a `withInstanceColor: true` flag on roles that should
  enable this.

---

## Transparency policy

Transparency is the perf-budget destroyer most likely to surprise.
Framework defaults:

- **Prefer alpha test** (`alphaMap` + `alphaTest > 0`) over alpha
  blend wherever possible. Foliage, fences, hair: alpha test.
  Glass, smoke, particles: alpha blend.
- **Sort cost is real** — transparent objects can't be batched and
  must be sorted back-to-front. The draw-call budget in
  `webgl-constraints.md` assumes ≤10% transparent objects per
  frame on LOW, ≤25% on MEDIUM, no fixed limit on HIGH/ULTRA.
- **No order-independent transparency on WebGL 2** — WBOIT is
  possible but expensive; not framework-default. WebGPU opens the
  door but stays an ULTRA-tier consideration.
- **Premultiplied alpha** is the framework default (matches the
  default in `renderer-configuration.md` context options).

Material roles for transparent surfaces specify `"alphaMode":
"test" | "blend"`. The asset pipeline preserves this from the
source glTF's `alphaMode` field.

---

## Authoring surface — material library as a director surface

The material library is a candidate **director surface** (see
[`director-pattern.md`](director-pattern.md)): the in-browser dev
tooling surfaces:

- The current material catalogue with live preview thumbnails per
  tier
- Per-role draw-call / shader-compile counts from telemetry
- "Add a new role" workflow that generates the library entry +
  asset-pipeline expectation + tier fallback table via the
  AI-assisted director pipeline
- Per-role usage census across the loaded scene (which prefabs use
  which roles)

Deferred to v1; the **shape** of the library and the runtime are
v0 so the surface has something to surface.

---

## What this is not

- **Not a shader graph editor.** Authoring is via JSON role
  declarations + GLSL files for advanced cases. NodeMaterial is the
  programmatic graph; not a GUI.
- **Not a per-object material configurator.** Material variation
  happens via *role + parameter* (tint, UV scale), not per-object
  property tweaks. Per-object tweaks create cache misses.
- **Not a place for game-aesthetic decisions.** The framework
  declares *which features fit which tier*; the consuming game
  declares *what roles exist and what they look like*.
- **Not coupled to PBR.** A toon-shaded or flat-color game declares
  `MeshToonMaterial` or `MeshBasicMaterial` in its role library;
  the framework's tier matrix accommodates that.
- **Not a runtime material editor.** The library is loaded at boot
  and immutable for the session (HMR aside). Hot-swapping a role
  invalidates the material cache for that role.

---

## Build order

1. **Material library schema + Zod validation** in
   `@vibesmith/renderer` — v0
2. **`getMaterial(spec, tier)` cache + shared-instance lookup** —
   v0
3. **ORM packing convention enforcement in `@vibesmith/asset-pipeline`**
   (CLI subcommand `pack-orm`) — v0.5
4. **Scene `compileAsync` precompile pass** — v0.5
5. **`KHR_parallel_shader_compile` capability gate** wired into
   detection — v0.5
6. **Variant flag enumeration** (skinned, instanced, shadow) — v0.5
7. **Material unique-instance telemetry + threshold warning** — v1
8. **`materials.allowCustomShaders` policy enforcement** — v1
9. **`NodeMaterial` adoption track** — v1 (when Three.js NodeMaterial
   surface stabilises enough for `MeshStandardMaterial` parity)
10. **Material director surface** (catalogue preview + per-role
    usage + AI-assisted role authoring) — v1
11. **`shader-critic` agent** for custom-shader review — v1
12. **WebGPU TSL migration path** — v2 (when the ULTRA tier moves
    to WebGPU)

---

## Cross-references

- [`prefab-system.md`](prefab-system.md) — material roles are how
  prefab recipes reference materials without binding to a concrete
  Three.js class
- [`adaptive-rendering.md`](adaptive-rendering.md) — the tier
  table; this doc's capability matrix is the per-role-per-tier
  view of the same tiers
- [`asset-pipeline.md`](asset-pipeline.md) — texture packing
  convention (ORM, sRGB-vs-linear) is the contract between asset
  output and material input
- [`renderer-configuration.md`](renderer-configuration.md) — global
  material policy knobs (`allowCustomShaders`,
  `warnOnUniqueInstanceCount`, `precompileOnSceneLoad`)
- [`webgl-constraints.md`](webgl-constraints.md) — per-shader
  uniform / varying / texture-unit limits the role library must
  fit within
- [`engine-patterns.md`](engine-patterns.md) — Three.js / R3F
  patterns for material composition and instancing
- [`director-pattern.md`](director-pattern.md) — the material
  library as a future director surface
- [`subagent-roster.md`](subagent-roster.md) — `shader-critic` for
  custom-shader review
- [`abstraction-discipline.md`](abstraction-discipline.md) — Tier
  A/B/C boundaries for shader code
- [`renderer-feature-matrix.md`](renderer-feature-matrix.md) —
  per-feature backend support; where TSL gaps live
- [`adr/0005-dual-renderer-backend.md`](adr/0005-dual-renderer-backend.md)
  — TSL-first material authoring decision
- [`recipe-canon.md`](recipe-canon.md) — curated shader / VFX
  recipes; backend coverage metadata
