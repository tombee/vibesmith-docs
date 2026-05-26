---
title: 'Scene renderer — @vibesmith/scene-renderer'
description: 'Engine substrate for parsed *.scene.json content. parseScene, loadSceneFromUrl, and the planned <SceneRenderer scene> consumer surface for standalone browser builds.'
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

## Slice status

The package is landing in two slices. This page documents both;
the live import surface tracks slice 1.

| Slice | What ships | Where |
|-------|-----------|-------|
| **1 (now)** | `parseScene`, `loadSceneFromUrl`, all scene types, `SceneLoadError` | `@vibesmith/scene-renderer` |
| **2 (follow-up)** | `<SceneRenderer scene>`, `<ScriptedMesh>`, `<LateUpdateScene>`, extension-point slots the editor composes overlays through | follow-up issue |

Consumer code that uses slice 1 today (`parseScene` + the loader)
keeps working unchanged when slice 2 lands — only
`<SceneRenderer>` becomes additionally available.

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

## Surface (slice 1)

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
`HudNode`, `Transform`, `Vec3` — the full type surface for code
that walks parsed scenes.

## Surface (slice 2, planned)

The follow-up slice will export the React/R3F renderer:

```tsx
import { SceneRenderer } from '@vibesmith/scene-renderer';

export function App() {
  return <SceneRenderer scene={parsedScene} />;
}
```

The renderer mounts camera + lights + built-in mesh nodes,
dispatches custom `kind` nodes against `lookupSceneNodeKind`,
and wires the script-tick driver (`<ScriptedMesh>`,
`<LateUpdateScene>`). Pure game runtime; ships in the game
bundle.

The editor consumes the same renderer with overlays composed via
extension-point slots (`playing`, `overrideCamera`,
`canvasChildren`, `onPick`, `onLoadError`) — selection outlines,
transform gizmo, magic-pen overlay, grid, orbit controls all stay
editor-side.

## Imports recap

```ts
import {
  // Parsers + loader
  parseScene,
  loadSceneFromUrl,
  SceneLoadError,
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
