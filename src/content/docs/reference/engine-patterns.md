---
title: 'Engine patterns — Unity-isms in Three.js + R3F'
description: 'Catalogue of game-engine patterns familiar from Unity and how they map onto Three.js + R3F. Two purposes: (1) translation guide when porting ideas from...'
---

Catalogue of game-engine patterns familiar from Unity and how they map
onto Three.js + R3F. Two purposes: (1) translation guide when porting
ideas from MyProject; (2) honest inventory of what Three doesn't give
us for free and we have to build or pull from the ecosystem.

Conventions:
- **Built-in** = comes with Three / R3F / drei out of the box
- **Library** = install a community package, minimal glue
- **Own** = code we write and maintain (with size estimate)

---

## Scene composition

**Unity:** GameObject hierarchy + Components. Prefabs as serialized
hierarchies. ScriptableObjects for shared data.

**Three.js + R3F:** Declarative JSX. The scene IS the React component
tree. A "prefab" is a React component returning a Three subgraph; a
"prefab variant" is just prop overrides.

```tsx
// MyProject's SettlementComposer maps to:
function Settlement({ recipe }: { recipe: SettlementRecipe }) {
  return (
    <>
      <Terrain recipe={recipe.terrain} />
      {recipe.buildings.map(b => <Building key={b.id} recipe={b} />)}
      {recipe.npcs.map(n => <NPC key={n.id} placement={n} />)}
    </>
  );
}
```

The recipe→composer pattern from MyProject ports near-verbatim. The
*data layer* changes (Zod-typed JSON instead of ScriptableObject).

**Status:** built-in.

---

## Game loop and tick

**Unity:** `Update()` per frame, `FixedUpdate()` at fixed timestep,
`LateUpdate()` after all Updates.

**R3F:** `useFrame((state, delta) => ...)` per render frame. **No
FixedUpdate equivalent.** No LateUpdate either, but `useFrame` accepts a
priority to order callbacks within a frame.

**Server tick (Colyseus):** authoritative ~0.6s tick (OSRS-shape). Client
*never* simulates canonical state — it interpolates between server-sent
snapshots.

**What we own:**
- **Fixed-timestep accumulator** at the top of the scene tree if we ever
  need deterministic client-side simulation (e.g. predicted projectile
  paths). Pattern:
  ```ts
  let accumulator = 0;
  const FIXED_DT = 1 / 30;
  useFrame((_, delta) => {
    accumulator += delta;
    while (accumulator >= FIXED_DT) {
      fixedTick(FIXED_DT);
      accumulator -= FIXED_DT;
    }
  });
  ```
- **Snapshot interpolation buffer** for incoming server state.
  ~100ms playback delay; renders interpolated state between two
  most-recent server ticks. Standard MMO client pattern; ~150 lines.
  Reference: Gabriel Gambetta's snapshot interpolation series.
- **System priorities** for `useFrame` ordering: input (-100), simulation
  (0), animation (50), camera (100). Use the second arg to `useFrame`.

**Size:** ~200 lines total for accumulator + interpolation + system
prioritization conventions.

---

## Animation state machine

**Unity:** Animator Controller — visual state machine + blend trees +
avatar masks + transition conditions.

**Three:** `AnimationMixer` + `AnimationAction` (crossfade primitives).
drei's `useAnimations` wraps the mixer ergonomically.

**What we own:**
- **`AnimationController`** class wrapping `useAnimations` with named
  states, crossfade durations, one-shot overlays that auto-return. ~100
  lines. AI codegen produces this from a spec in one shot.
- Per-character animation map (data, not code): which clips exist, which
  is idle, default crossfade times. Lives in `packages/content/`.

**Escalation paths:**
- **XState v5** if combat / dialogue grows interrupt/cancel/queue complex.
- **Avatar masks** (upper-body action while lower-body walks) — Three's
  `AnimationAction.weight` + manual bone targeting. Build when needed.

**Status:** own (small).

---

## Pathfinding (NavMesh)

**Unity:** `NavMeshAgent` + baked NavMesh.

**Three:** nothing built-in.

**Library:** `@recast-navigation/three` — Recast/Detour port to JS (WASM).
Same algorithm Unity uses under the hood. R3F bindings included.

Workflow:
1. Bake NavMesh from world geometry at world-gen time (or runtime in dev).
2. Query path with `navMesh.computePath(start, end)` on click-to-move.
3. Move agent along path; resync to server state on tick.

**Status:** library, minimal glue.

---

## Camera control

**Unity:** Cinemachine — free-look, framing transposer, virtual cameras.

**Three + drei:** `<OrbitControls />`, `<PerspectiveCamera />`,
`<CameraShake />`. Plenty for stock cases.

**OSRS-style follow camera:** drei doesn't ship this exact behaviour.
Pattern: lerp camera position toward `player.position + offset`,
look-at player, optional pitch/yaw control via mouse drag. ~30 lines.

**Status:** own (tiny).

---

## Physics

**Unity:** built-in PhysX (Rigidbody, Collider, CharacterController,
triggers).

**Three:** nothing built-in.

**Library:** `@react-three/rapier` (Rapier physics + R3F bindings).

**OSRS-style call:** for movement, no physics engine needed —
NavMesh-driven movement + raycasts handle it. Install Rapier only when
we hit physics-needing features: projectiles, ragdolls, dropped items
with bounce, destructible scenery.

**Status:** library, install when needed.

---

## Input

**Unity:** Input System with action maps, rebindable bindings, multi-device.

**Web:** raw `pointerdown` / `keydown` / Gamepad API.

**What we own:**
- **`InputActions` map** — named actions ("move", "interact", "openInventory")
  bound to keys / mouse / gamepad. JSON-defined, runtime-overridable for
  rebinding. ~150 lines including gamepad polling. Lives in
  `packages/shared/input/`.
- Hooks: `useAction('interact', () => ...)`, `useAxis('move')`.

**Status:** own (small).

---

## Coroutines / async sequences

**Unity:** `StartCoroutine` + `yield return`.

**JS:** `async`/`await` is the equivalent. Cancellation via
`AbortController.signal`; check between awaits.

**Pattern:**
```ts
async function playDialogue(line: string, signal: AbortSignal) {
  presenter.show(line);
  await wait(line.length * 50, signal);
  if (signal.aborted) return;
  presenter.fade();
}
```

**Helper:** small `wait(ms, signal)` utility that throws on abort. ~10 lines.

**Status:** own (trivial).

---

## Object pooling

**Unity:** `ObjectPool<T>` built-in (modern).

**Three:** nothing built-in.

**What we own:** generic pool utility for ~any reusable object — damage
numbers, projectiles, particle bursts, chat bubbles. ~50 lines.

```ts
class Pool<T> {
  constructor(private factory: () => T, private reset: (t: T) => void) {}
  acquire(): T { ... }
  release(t: T): void { ... }
}
```

**Status:** own (trivial).

---

## Zone streaming (additive scenes)

**Unity:** `SceneManager.LoadSceneAsync` additive.

**Three:** no built-in. Each zone is a `.glb` (or set of `.glb`s) loaded
via `useGLTF`; mount/unmount via React conditionals.

**What we own:**
- **`ZoneManager`** — tracks player position, computes nearby zone keys,
  triggers loads on entry-edge and unloads on exit-edge with hysteresis.
  Async via Suspense boundaries per zone.
- Asset cache strategy: rely on `useGLTF.preload` + browser HTTP cache
  for v0. Custom IndexedDB asset cache if quota becomes the bottleneck.

**Status:** own (medium — ~300 lines including hysteresis + cache).

---

## Particles + VFX

**Unity:** Shuriken particle system + VFX Graph.

**Three:** nothing built-in.

**Library:** `three.quarks` — TS port of Unity's Shuriken to Three.
Genuinely a Shuriken port; same mental model.

**Status:** library, deferred until VFX matter.

---

## Postprocessing

**Unity:** Post-processing stack (URP/HDRP).

**Library:** `@react-three/postprocessing` — bloom, depth-of-field,
SSAO, color grading, vignette. Declarative `<EffectComposer>`.

**Status:** library, deferred until visual polish phase.

---

## Audio

**Unity:** AudioSource + AudioListener + spatial.

**Three:** `PositionalAudio` + `AudioListener`. drei has
`<PositionalAudio />`. Web Audio API underneath.

**What we own:** `@vibesmith/audio-runtime` — scene-graph-aware
wrapper above WebAudio. `<AudioEmitter>` scene-node components,
camera-driven `AudioListener` sync, fixed five-bus mixer (master /
music / sfx / dialogue / ambient) with ducking, manifest-driven
buffer cache, recipe adapter, scenario capture + replay,
deferred-init autoplay gate. WebAudio nodes stay reachable via
`emitter.raw()`. See [Audio runtime](/reference/audio-runtime/).

**Status:** built-in wrapper.

---

## UI / HUD

**Unity:** UI Toolkit / UGUI.

**Web:** HTML/CSS/React. Strictly better for 2D UI.

**Status:** built-in (React + Tailwind).

---

## Timeline / cutscenes

**Unity:** Timeline asset.

**Library:** `theatre.js` — keyframed animation authoring with a Studio
GUI; outputs JSON sequences.

**Status:** library, deferred until cutscenes happen.

---

## Inspector / dev tooling

**Unity:** Editor + Inspector + Hierarchy panels.

**Stack:**
- `r3f-perf` → `<Perf />` overlay for FPS, drawcalls, GPU time
- `leva` → `useControls({...})` runtime property panels per-component
- `triplex` → visual JSX scene editor (optional, install if manual
  placement workflows demand it)
- React DevTools → scene as component tree

**Status:** library × 3, dev-only.

---

## Data assets

**Unity:** ScriptableObject.

**Our pick:** TS modules + Zod schemas + per-entity JSON files.

```ts
// packages/content/schemas/voice-card.ts
export const VoiceCard = z.object({
  id: z.string(),
  registerTags: z.array(z.string()),
  exampleLines: z.array(z.string()),
  ...
});
export type VoiceCard = z.infer<typeof VoiceCard>;

// packages/content/data/voice-cards/hella.json
{ "id": "hella", "registerTags": ["warm", "deadpan"], ... }
```

Validated at load time. AI-friendly. Diff-friendly. Survives engine pivots.

**Status:** own (schemas + loader, ~200 lines).

---

## Server-authoritative networking

**Unity (MyProject):** Mirror — tick-based, NetworkBehaviour, SyncVar.

**Colyseus equivalents:**
- `Room` ↔ Mirror's `NetworkManager` scene
- `Schema` state ↔ `SyncVar` (with delta encoding built in)
- `onMessage` ↔ `Command` RPCs
- `clock.setInterval` for tick loop
- `MapSchema<Player>` for per-player state

**Pattern:** client never holds canonical state. Subscribe to Colyseus
state changes → push into Zustand store → R3F components read from
store → render. Client predicts movement locally for responsiveness;
reconciles when server confirms.

**What we own:**
- **Snapshot interpolation buffer** (above, under Game loop).
- **Client-side prediction + reconciliation** for player movement. ~200 lines.
- **Lag compensation** in server hit-detection (later, when combat lands).

**Status:** library (Colyseus) + own (prediction/reconciliation).

---

## Profiling

**Unity:** Deep profiler, frame debugger.

**Web:**
- Chrome DevTools Performance tab (CPU + GPU traces)
- `r3f-perf` — in-game numbers
- Spector.js — WebGL frame capture, draw-call inspector

**Status:** library × 2 + browser devtools.

---

## Lighting

**Unity:** directional / point / spot / area lights; light probes;
lightmaps; reflection probes; URP/HDRP shadow cascades.

**Three:** `DirectionalLight`, `PointLight`, `SpotLight`,
`AmbientLight`, `HemisphereLight`. drei: `<Environment />` for IBL,
`<Sky />` for procedural sky, `<ContactShadows />`,
`<AccumulativeShadows />` for baked-feel ground shadows on static
scenes.

**Approach for target visual baseline:**
- One directional sun + hemisphere ambient + drei `<Environment>` (HDRI
  cubemap for subtle reflections) covers ~90% of scenes
- `PCFSoftShadowMap` for the sun; one shadow cascade, tuned bias
- No lightmap baking (skipping the Unity equivalent — matte materials +
  unlit-ish materials are fine without precomputed GI)

**Status:** built-in + drei. ~50 lines of setup in a `<SceneLighting>`
component shared across scenes; per-scene overrides via props.

---

## Skybox / environment

**Unity:** Skybox material + procedural sky.

**Three + drei:**
- `<Sky />` — procedural Hosek-Wilkie sky (sun position, turbidity)
- `<Stars />` — night-sky particles
- `<Cloud />` / `<Clouds />` — volumetric-ish cloud layers
- `<Environment files="..."  />` — HDRI environment map for image-based
  lighting + skybox

**Status:** built-in. Pick procedural for time-of-day variation, HDRI
for a fixed look.

---

## Terrain rendering

**Unity:** Terrain system — heightmap, splat maps, detail mesh, trees.

**Three:** nothing built-in. Build it:

- **Mesh:** `PlaneGeometry` subdivided to grid resolution + vertex
  displacement from heightmap (CPU on load, or GPU vertex shader)
- **Splat-mapped material:** custom shader sampling 4-8 ground textures
  weighted by per-vertex (or per-pixel) splat map; output blended
  diffuse. ~200 lines of GLSL.
- **Tiling:** chunked terrain at zone scale. Per-chunk mesh + draw
  call. Stitch via shared edge normals.
- **Detail mesh (grass, rocks):** instanced meshes scattered via
  Poisson-disk on terrain surface. drei has `<Instances>` for
  instanced rendering primitives.

**Status:** own (~400-600 lines including shader). Build alongside the
region generator that produces heightmaps. the chosen asset pack-pack-style "polygon
ground tiles" are a viable alternative for the cute aesthetic — no
heightmap, just tile placement. Pick at first zone.

---

## Vegetation / scatter

**Unity:** terrain trees + grass + Vegetation Studio packages.

**Three:** instanced meshes scattered by procgen rules. drei's
`<Instances>` + `<Instance>` makes it tractable. For grass: custom
shader on instanced quads / blades with wind via vertex shader. There
are MIT examples; pick one rather than writing from scratch.

**Procgen integration:** scatter rules live in the region generator
(MyProject's `RegionRecipe.scatterSpec` ports over). Output is just
more entities in the composition: `{ type: 'instanced-mesh', asset:
'tree-01', positions: [...] }`.

**Status:** own (~200 lines instancing wrappers) + lib (grass shader
when grass matters).

---

## Memory management

**Unity:** `Resources.UnloadUnusedAssets()` + GC. Mostly hands-off.

**Three:** **manual.** This is the single most-bitten Three pitfall.
Geometries, materials, textures all hold WebGL resources that must be
explicitly `.dispose()`'d when no longer used. Without discipline,
long-running MMO clients leak GPU memory until tab crash.

**Discipline:**
- Use `useGLTF` and `useTexture` from drei — they instance-count and
  dispose on last-unmount automatically
- For manual loaders, hold disposables in a `DisposeRegistry` scoped to
  the zone / scene; drain on unmount
- Never `new THREE.Material()` outside a `useMemo` + cleanup pair in
  React components
- For dynamic content (procgen meshes, edited compositions), the
  composition unmount lifecycle is the natural disposal trigger

**Tooling:**
- Chrome DevTools Memory tab catches Three GPU leaks indirectly
  (growing heap) — first signal
- `renderer.info.memory.{geometries,textures}` numbers — log in dev,
  any unbounded growth across zone transitions is a bug
- `r3f-perf` shows these live

**Status:** discipline + ~50-line DisposeRegistry util. Catch in code
review / Tier-0 long-run perf probe.

---

## Splines / paths

**Unity:** SplineContainer.

**Three:** `CatmullRomCurve3`, `CubicBezierCurve3`. drei has
`<CatmullRomLine>` for rendering.

For paths in scenes (roads, NPC patrol routes), generator emits an
array of control points; renderer / pathing system samples the spline.

**Status:** built-in.

---

## Localization (i18n)

**Unity:** Localization package.

**Web:** `i18next` + `react-i18next`. Standard, mature, widely
supported.

**Pattern:**
- String tables as JSON per locale in `packages/content/data/i18n/<lang>/<namespace>.json`
- Authoring locale: English. Other locales via translation pipeline
  (LLM-assisted batch translation + theme-critic per locale → bake).
- Locale-aware Theme Critic — the "warmth / register / tone" verdict
  applies per locale, not globally. culturally-specific humour translated to
  another culture may need re-anchoring.
- RTL support: Tailwind's `rtl:` variant + logical CSS properties.
- Pluralization: i18next's plural rule support.

**Aspect-ratio agnostic + mobile-first** (already a standing rule)
intersects with localization — German strings are ~30% longer than
English; designs must flex.

**Status:** library + ~150 lines of bootstrap. Defer the *content* of
localization until there's a game to localize.

---

## Telemetry + crash reporting

**Unity:** Unity Analytics, Crashlytics.

**Web:**
- **Crash / error reporting:** Sentry (web SDK). Source-map aware, ties
  errors to releases. Free tier covers solo dev volume.
- **Product analytics:** PostHog (self-hostable) or Plausible (simpler,
  hosted). Event tracking for "player progressed thread X", "player
  entered zone Y", "client FPS dropped below threshold".
- **Server logs:** structured logging via `pino` → log aggregator
  (later — Loki / Logtail / etc.).

**Status:** install when there's first external playtest. Free / cheap
SaaS tier; no work to build.

---

## Build + distribution pipeline

**Unity:** Cloud Build, IL2CPP, platform builds.

**Web:**
- `pnpm build` runs Vite production builds for `apps/client` and `apps/server`
- Client bundle → static assets (HTML, JS, WASM, KTX2, GLB) with
  content-hashed filenames; uploaded to CDN (Cloudflare Pages / R2)
- Server bundle → single Node entry point; deployed to a VM
  (Hetzner / Fly.io) or container (Fly.io Apps, Railway, Render)
- Asset CDN URLs baked into manifest at build time
- Environment configs via `.env.<environment>` + Vite's env handling
- Source maps uploaded to Sentry; not served to clients in prod

**Versioning:** semver on the client; server tracks min-client-version
and serves an upgrade prompt. Critical because MMO clients in the wild
diverge from server schema.

**Status:** standard web deploy. Defined in code from scaffold time —
see [`docs/reproducibility.md`](reproducibility.md) for the full
contract (justfile / Docker / Terraform / mise / drizzle-kit / CI).
Build infra structure first, populate when external playtest matters.

---

## Persistence / save system

**Unity:** PlayerPrefs, file I/O, scripted serialization.

**Our setup:**
- **Authoritative state is server-side.** Postgres is the cloud save.
  No client-side save files for player progress.
- **Client-local state** — settings, keybinds, recently-cached
  composition snapshots, draft chat messages — lives in IndexedDB via
  `idb-keyval`. Survives reloads, doesn't sync across devices unless
  the server replicates it.
- **Anonymous → authed transition** — client may start a session
  unauthed (browse around, play tutorial); on login, local progress
  migrates to server.

**Status:** server-side (Drizzle + Postgres handles it); ~50 lines of
IndexedDB wrappers for client-local prefs.

---

## Multiplayer matchmaking + lobby

**Unity:** UGS Matchmaker, Lobby.

**Colyseus:** built-in. `JoinOrCreate` with filter predicates handles
matchmaking; rooms expose metadata for a lobby browser if/when one is
built.

For OSRS-shape MMO with shared persistent world (one or few rooms per
shard, not many small lobbies), matchmaking is trivial: `joinRoom("world")`.

**Status:** library, near-zero glue.

---

## Things we don't need to think about

These exist in Unity, don't exist in our stack, and don't need replacement:

- **Asset bundles** — Vite handles asset bundling; HTTP/browser cache is
  the streaming primitive
- **Build platforms** — one platform (browser)
- **Player Settings, Quality Settings** — runtime config via JSON
- **Tags + Layers** — components and types are richer
- **GameObject.Find** — refs and store subscriptions are explicit
- **SendMessage** — typed events / store dispatch

---

## Summary: what we own vs install

**Own (small — total ~1500-2000 lines):**
- AnimationController (~100)
- Fixed-timestep + interpolation buffer (~200)
- Camera follow (~30)
- InputActions (~150)
- ObjectPool (~50)
- ZoneManager (~300)
- audio-runtime: emitter + mixer + listener-sync + autoplay gate (~400; see [Audio runtime](/reference/audio-runtime/))
- Content loader + Zod schemas (~200)
- Client prediction + reconciliation (~200)
- Misc glue (~300)

**Install:**
- three, @react-three/fiber, @react-three/drei (core)
- @recast-navigation/three (pathfinding)
- @react-three/rapier (physics, when needed)
- three.quarks (particles, when needed)
- @react-three/postprocessing (visual polish, when needed)
- theatre.js (cutscenes, when needed)
- r3f-perf + leva (dev tooling)
- colyseus.js (networking)
- react + tailwind + zustand (HUD)

The "own" total is well under what a single composer in MyProject grew
to. Three + R3F's "barebones" reputation overstates the gap; the
ecosystem fills most of it, and what's left is small enough to fit in a
single dev's head.
