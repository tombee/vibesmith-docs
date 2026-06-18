---
title: 'Scene renderer — @vibesmith/scene-renderer'
description: 'Engine substrate for parsed *.scene.json content. parseScene, loadSceneFromUrl, and the <SceneNodes> / <SceneRenderer> / <SceneLoader> consumer surface that renders scenes — and runs their node scripts — in standalone browser builds.'
---

> **Framework. Game-agnostic.** The scene-renderer substrate
> mounts JSON-shaped scenes (`{ version, name, nodes[], chrome }`)
> the same way the editor binary does — but as a standalone
> package that consumer projects can import into their own
> standalone browser builds without dragging editor concerns
> (selection outlines, transform gizmo, magic-pen overlay,
> viewport picker, MCP accessor bridge) into the game bundle.

`@vibesmith/scene-renderer` is the engine substrate that mounts
parsed `.scene.json` content. Hoisted out of the editor binary so
the editor / game split matches every native-engine analogue —
Unity's `UnityEngine.SceneManagement` vs `UnityEditor.SceneView`,
Godot's runtime scene loader vs editor scene dock, Unreal's
`UWorld` vs `FLevelEditorViewportClient`.

## Surface status

Shipped: the parser + loader **and** three rendering components.
The substrate also **runs node scripts** — a scene mesh node with a
`script` binding (a `defineGameScript`) ticks each frame in a
standalone build, no editor required. The editor's play-state /
physics-coupled adapter (`<ScriptedMesh>`, `<LateUpdateScene>`) is
separate and renders via its own path, so node scripts never
double-run.

| Surface | What it exports |
|---------|-----------------|
| Parser + loader | `parseScene`, `loadSceneFromUrl`, all scene types, `SceneLoadError` |
| Canvas-less renderer | `<SceneNodes scene>` — renders the scene into a `<Canvas>` you own |
| Canvas-owning renderer | `<SceneRenderer scene>` — `<Canvas>` + `<SceneNodes>`, plus the editor's overlay slots (`overrideCamera`, `canvasChildren`, `onLoadError`, `onPick`, `canvasProps`) |
| Load-from-URL | `<SceneLoader source>` — fetch + parse + `<SceneRenderer>` |

## When to reach for this package

- You're mounting `.scene.json` files in a **standalone consumer
  build** (a published game, a marketing site, a launcher).
- You want the same parser the editor uses, without depending on
  the editor binary.
- You want the canonical loader for fetched scene files, with
  typed error codes so HTTP / network / JSON / schema failures
  are distinguishable.

If you're inside the editor binary (writing an extension panel,
authoring a viewport overlay), reach for the editor's internal
modules instead — they layer editor chrome on top of this
substrate.

## Surface — parser + loader

### `parseScene(raw): Scene`

The canonical Zod-validated parser. Throws `z.ZodError` on
validation failure; the message includes the failing path.

```ts
import { parseScene } from '@vibesmith/scene-renderer';

const scene = parseScene(rawJson);
// scene.version, scene.name, scene.nodes[], scene.chrome
```

The scene-file shape is documented at [Scene
construction](/reference/scene-construction/); the parser
implements that schema.

### `loadSceneFromUrl(url, options?): Promise<Scene>`

Fetch + parse + validate a scene from a URL. Returns the parsed
`Scene`; throws `SceneLoadError` on any failure.

```ts
import { loadSceneFromUrl, SceneLoadError } from '@vibesmith/scene-renderer';

try {
  const scene = await loadSceneFromUrl('/scenes/main.scene.json');
  // mount scene…
} catch (e) {
  if (e instanceof SceneLoadError) {
    switch (e.code) {
      case 'SCENE_LOAD_HTTP_FAILED':
        // e.status is the HTTP status (404, 500, …)
        break;
      case 'SCENE_LOAD_NETWORK_FAILED':
        // fetch threw (offline, CORS, …)
        break;
      case 'SCENE_LOAD_INVALID_JSON':
        // body wasn't valid JSON
        break;
      case 'SCENE_LOAD_INVALID_SCHEMA':
        // JSON didn't match the scene schema
        break;
    }
  }
  throw e;
}
```

**`options.fetch`** — injectable fetch impl. Defaults to global
`fetch`. Tests pass a stub; consumers in environments without
`fetch` (a custom runtime, a Node CLI) supply their own.

**`options.init`** — forwarded to `fetch`. Use to attach
`AbortSignal`, credentials, headers, etc. `method` is forced to
`GET`.

### `SceneLoadError`

Typed error with a machine-readable `code`. Subclass of `Error`;
safe to `console.error` directly.

| `code` | Cause |
|--------|-------|
| `SCENE_LOAD_HTTP_FAILED` | `fetch` returned `!ok` — `.status` carries the HTTP code |
| `SCENE_LOAD_NETWORK_FAILED` | `fetch` threw (offline, CORS, …) |
| `SCENE_LOAD_INVALID_JSON` | Body wasn't valid JSON |
| `SCENE_LOAD_INVALID_SCHEMA` | JSON didn't match the scene schema |

The error message includes the URL and the underlying reason in
every case.

### Types

`Scene`, `SceneNode`, `BuiltinSceneNode`, `CustomKindNode`,
`MeshNode`, `DirectionalLightNode`, `PerspectiveCameraNode`,
`HudNode`, `HudLayerNode`, `Transform`, `Vec3` — the full type
surface for code that walks parsed scenes.

### `kind: "hud-layer"` — R3F orthographic HUD layers

Built-in scene-node kind for *secondary R3F render passes* over
the main scene — the drei `<Hud>` portal pattern lifted into the
scene-as-data surface. A `<hud-layer>` JSON node references a
`defineSceneHudLayer({ id, params, priority?, renderJsx })`
registration; the SceneRenderer mounts each instance inside its
own `<Hud renderPriority>` portal, sorted ascending by priority.

Use for: an inventory card showcased at full size above the
main scene, a minimap with its own camera, a tutorial 3D arrow
that ignores world depth — anything 3D that needs its own
render pass without z-fighting the main scene.

Separate factory from `defineSceneHud` / `defineGlobalHud` (the
DOM-overlay tier). See the
[HUD lifecycle reference § R3F HUD layers](/vibesmith-docs/reference/hud-lifecycle/#r3f-hud-layers)
for the full surface + when to reach for which tier.

## Surface — the R3F renderers

Three components, layered. All mount camera + lights + built-in
mesh nodes (running their node `defineGameScript`s), dispatch
custom `kind` nodes against `lookupSceneNodeKind`, and host HUD
layers. Pick by who owns the `<Canvas>`.

### `<SceneNodes scene>` — the canvas-less primitive

Renders the scene's contents into a `<Canvas>` **you already
own**, so an authored scene composes with your own R3F (a custom
camera rig, a background shader, `<ProductionDefaults>`) in one
Canvas — no nested Canvas. Because it lives in a Canvas it didn't
create, it applies the authored `perspective-camera` node
imperatively; pass `applyCamera={false}` when your own controller
owns the camera.

```tsx
import { SceneNodes, parseScene } from '@vibesmith/scene-renderer';
import { Canvas } from '@react-three/fiber';
import { ProductionDefaults } from '@vibesmith/production-defaults';

const scene = parseScene(rawJson);

export function World() {
  return (
    <Canvas shadows>
      <ProductionDefaults tier="MEDIUM" backend="webgl" />
      <SceneNodes scene={scene} />
      {/* …your own meshes / effects as siblings… */}
    </Canvas>
  );
}
```

### `<SceneRenderer scene>` — owns the Canvas

A `<Canvas>` wrapped around `<SceneNodes>`. Reach for it when the
scene is the whole view. Exposes the editor's overlay slots
(`overrideCamera`, `canvasChildren`, `onPick`, `onLoadError`,
`canvasProps`) — selection outlines, transform gizmo, magic-pen,
grid, orbit controls all stay editor-side and compose through
`canvasChildren`.

```tsx
import { SceneRenderer } from '@vibesmith/scene-renderer';

export function App() {
  return <SceneRenderer scene={parsedScene} />;
}
```

### `<SceneLoader source>` — fetch + parse + render

`loadSceneFromUrl` + `<SceneRenderer>`. Use it for scenes fetched
at runtime (level loading, remote scenes). When the scene is
bundled (imported as JSON), prefer `parseScene(doc)` +
`<SceneNodes>` / `<SceneRenderer>` directly — no fetch, scene
validated at module load.

```tsx
import { SceneLoader } from '@vibesmith/scene-renderer';

export function App() {
  return <SceneLoader source="/scenes/main.scene.json" loadingFallback={<Splash />} />;
}
```

## Imports recap

```ts
import {
  // Parsers + loader
  parseScene,
  loadSceneFromUrl,
  SceneLoadError,
  // R3F renderers
  SceneNodes,
  SceneRenderer,
  SceneLoader,
  // Types
  type Scene,
  type SceneNode,
  type BuiltinSceneNode,
  type CustomKindNode,
  type MeshNode,
  type DirectionalLightNode,
  type PerspectiveCameraNode,
  type HudNode,
  type Transform,
  type Vec3,
  type SceneLoadErrorCode,
  type LoadSceneOptions,
} from '@vibesmith/scene-renderer';
```

The schema subpath is also available at
`@vibesmith/scene-renderer/schema` for code that only wants the
parser without pulling in the loader.

## See also

- [Scene construction](/reference/scene-construction/) — the
  scene-JSON shape this package parses.
- [Engine patterns](/reference/engine-patterns/) — where
  scene-mounting fits among the Unity / Godot / Unreal analogues.
- [Prefab system](/reference/prefab-system/) — sibling factory
  for reusable parametric sub-trees.
