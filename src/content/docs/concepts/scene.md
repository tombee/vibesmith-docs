---
title: 'Scene'
description: 'A scene is what your game looks and behaves like right now. In vibesmith the canonical scene is a .scene.json file — a serialized tree of nodes the editor parses, renders, and lets you inspect, select, and edit.'
---

A **scene** is the world your game is showing right now — the
objects, lights, cameras, scripts, and behaviors that, together,
add up to *the thing on screen at this moment*.

If you've come from another engine, this much is familiar: a scene
is a **file** that holds a tree of nodes, and the runtime
instantiates the world *from* that file. In Unity it's a `.unity`
YAML scene; in Godot a `.tscn`; in Unreal a `.umap`. vibesmith's
equivalent is **`scenes/main.scene.json`** — JSON, because JSON is
the shape every AI assistant already reads, writes, and diffs.

## What a scene actually is

A scene in vibesmith is a **serialized node tree in a
`*.scene.json` file**. Open a project and the editor loads
`scenes/main.scene.json` (or a project-declared override), parses
it through a Zod schema, and renders one node per entry. Each node
has a stable `id`, a registered `kind`, an optional `transform`,
and optional `children`.

```jsonc
// scenes/main.scene.json
{
  "version": 1,
  "name": "main",
  "nodes": [
    {
      "id": "key-light",
      "kind": "directional-light",
      "transform": { "position": [5, 10, 5] },
      "intensity": 1.4
    },
    {
      "id": "spinning-cube",
      "kind": "mesh",
      "transform": { "position": [0, 0.5, 0] },
      "geometry": { "kind": "box" },
      "material": { "kind": "standard", "color": "#ffaa00" },
      "script": "spin-cube"
    }
  ]
}
```

That's the scene. The light, the cube, and the `spin-cube` script
attached to the cube via its `script` field. When the editor loads
this file, that becomes the running game — and because every node
is parsed data with a stable `id`, the cube is selectable in the
hierarchy, editable in the inspector, addressable by an AI
assistant over MCP, and round-trippable by a designer dragging a
gizmo (the gizmo writes the new `transform` back into the same
file).

## Why JSON, not a React tree?

It's tempting — especially coming from a React Three Fiber tutorial
— to write a scene as a `.tsx` component that returns `<mesh>` /
`<directionalLight>` JSX directly. **Don't.** A JSX-only scene with
no `.scene.json` twin is a [documented anti-pattern](/vibesmith-docs/anti-patterns/):
the world lives inside one React function whose positions and
parent relationships are JSX literals, so the inspector can't edit
it, selection has no stable id to address, the hierarchy panel
can't walk it, and snapshots have no scene-tree to track. Every
editor surface walks the *parsed* scene tree; an FC-mounted world
is invisible to all of them.

The canonical decision — *scene-as-data*, the file is the artifact,
the runtime is never the source of truth — is the same shape
Unity / Godot / Unreal all converge on:

1. **A serialized tree of nodes is canonical state.** The runtime
   instantiates from the file; it never owns the truth.
2. **Each node references a registered `kind`** (a builtin like
   `mesh` / `directional-light`, or a consumer-defined kind) and
   carries per-instance parameter overrides the inspector edits.
3. **Each node has a stable `id`** that survives reorder,
   recompile, and selection round-trip — so gizmo edits, AI edits,
   and hand-edits all land on the same node in the same file.

Behaviour doesn't go in the scene file as code; it goes in a
[script](script) registered with `defineGameScript` and attached to
a node by its `script` field (as `spin-cube` is above). The JSON
stays pure data; the code stays in `scripts/`.

## "The current scene" vs "a scene file"

When you read *"the scene"* in vibesmith docs, it usually means
**the currently-loaded scene tree** — what the editor is drawing
right now. When you read *"a scene file"*, it means **a
`*.scene.json` file you can load as a scene**.

A project can have many scene files (`scenes/menu.scene.json`,
`scenes/level-01.scene.json`, etc.); switching scenes is loading a
different JSON file. There's no `Scene` class to instantiate and no
`SceneManager.LoadScene` ceremony — scene switching reduces to
"point the runtime at a different file."

## Snapshots, not scene saves

If you want to launch the editor into *a particular state* of a
scene — the player at a specific position, an enemy mid-attack, a
particular inventory loadout — that's not a different scene file.
That's a [snapshot](snapshot). Same scene file, different captured
state.

## What a scene contains

- **Visible things** — meshes (`kind: "mesh"`), models loaded from
  `.glb` files, sprites, particle systems.
- **Lights and cameras** — `kind: "directional-light"`,
  `kind: "perspective-camera"`, ambient + environment maps.
- **Behavior** — [scripts](script) attached to nodes via a
  `"script": "<id>"` field. The cube's `"script": "spin-cube"` is
  how it knows to rotate.
- **Reusable composites** — a [prefab](prefab) referenced from a
  node via the `prefab` field, expanded into real addressable child
  nodes at load.
- **Helpers** — debug visualisations, grid overlays, gizmo handles.
  The editor adds many of these itself; you don't have to.

## Next

- [Script](script) — what `"script": "spin-cube"` actually does.
- [Snapshot](snapshot) — how to save + restore scene state.
- [How to extend vibesmith](/vibesmith-docs/reference/extending/) —
  *"I want to add X — which primitive?"* (builtins / scripts /
  prefabs, and the instanced-kind primitive for many of the same
  thing).
- [Engine patterns](/vibesmith-docs/reference/engine-patterns/) —
  Unity `Scene` / Godot scene tree / Unreal Level → vibesmith
  equivalents.
- [Scene construction](/vibesmith-docs/reference/scene-construction/)
  — the deeper *recipe → generator → composition* pipeline for
  AI-authored scenes.
