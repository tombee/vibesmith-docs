---
title: 'How to extend vibesmith'
description: 'Single canonical "I want to add X — which primitive?" answer for consumer projects. The three-primitive model — builtins + scripts + prefabs.'
---

> **Single canonical doc — *"I want to add X. Which primitive?"* —
> answering the question Unity / Godot / Unreal answer the same way:
> **builtins + scripts + prefabs**.**

vibesmith has three consumer extension primitives. Pick the right
one and downstream surfaces (Hierarchy, Inspector, selection,
snapshot, MCP) all work without further effort.

## The decision table

| Need                                                                              | Primitive                                          |
| --------------------------------------------------------------------------------- | -------------------------------------------------- |
| Textured plane, lit light, empty transform anchor, text label, camera             | **Builtin node kinds** (`mesh`, `directional-light`, `perspective-camera`, …) |
| Behaviour attached to a node — animation driver, state machine, interaction       | **`defineGameScript`** + `script: "<id>"` on the node |
| Reusable structural pattern — deck stack, hand fan, NPC body kit, badge composite | **`definePrefab`**                                 |
| Many of the *same* homogeneous thing — grass, rocks, debris, projectiles, units, scatter clutter (~20+ entries) | **`defineInstancedKind`** + the [recipe library](/vibesmith-docs/reference/recipe-canon/) |
| A genuinely new heterogeneous node type                                           | **Almost never.** Open a framework issue — it goes in builtins. |

The last row is the load-bearing one. Unity / Godot / Unreal don't
let consumers register new *heterogeneous* node types — the
node-type space is fixed by the engine, and every "I need a textured
plane" / "I need a card-flight driver" / "I need a deck stack" maps
onto one of the three primitives above. vibesmith follows the same
model. If you catch yourself reaching for `defineSceneNodeKind` (the
framework-internal factory that registers new heterogeneous node
types), step back to this table — almost always one of the three
primitives is the right answer.

The one consumer-facing kind factory is the **performance** case in
the second-to-last row: `defineInstancedKind` for *many of the same
homogeneous thing* (§4). It is not a way to register an arbitrary new
node type — it batches N entries that share one geometry + material
into a single GPU-instanced draw call while keeping each entry
independently addressable. Reach for it when you'd otherwise scatter
~20+ `mesh` nodes (or hand-roll a drei `<Instances>` block); reach
for the recipe library when the placement itself (scatter / crowd /
debris math) is the hard part.

## 1. Builtins

Built-in node kinds are the atoms scene JSON references by the
`kind` field. The framework ships the canonical set (`mesh`,
`directional-light`, `perspective-camera`, `hud`, `hud-layer`,
expanding over time). Each builtin has a strict Zod schema; the
SceneRenderer dispatches the matching React component for the kind.

```jsonc
// scenes/main.scene.json
{
  "version": 1,
  "name": "main",
  "nodes": [
    {
      "id": "card-1",
      "kind": "mesh",
      "geometry": { "kind": "plane", "size": [5, 7] },
      "material": { "kind": "standard", "color": "#ffaa00" }
    },
    {
      "id": "key-light",
      "kind": "directional-light",
      "transform": { "position": [5, 10, 5] },
      "intensity": 1.4
    }
  ]
}
```

The vocabulary (which kinds exist and what fields they take) lives
in the [engine-patterns](/reference/engine-patterns/) reference and
the per-kind schema pages. The schemas are emitted to
`.vibesmith/schemas/` so the AI assistant + the inspector both read
from the same source of truth.

**When you reach for a new builtin and it doesn't exist:** the
right move is to open a framework issue, not to register a new
top-level node type. The framework grows the builtin set
deliberately so the canon stays small and AI assistants get fluent
in the same vocabulary across every consumer project.

## 2. Scripts — `defineGameScript`

`defineGameScript` is the **MonoBehaviour analog** — code that
runs every frame on a node. The script is attached via the `script`
field on the scene-JSON node; the runtime resolves it at mount,
binds it to the node's `THREE.Object3D`, and runs the lifecycle
hooks.

```ts
// scripts/card-flight.ts
import { defineGameScript } from '@vibesmith/runtime';
import { z } from 'zod';

defineGameScript({
  id: 'my-game/card-flight',
  parameters: z.object({
    flightId: z.string(),
    durationSeconds: z.number().default(0.6),
  }),
  onStart: ({ object3D, parameters }) => {
    // Set initial pose; subscribe to an external clip; …
    void object3D;
    void parameters;
  },
  onUpdate: ({ object3D, parameters }, dt) => {
    // Advance the flight tick. `dt` is wall-clock seconds.
    void object3D;
    void parameters;
    void dt;
  },
  onDestroy: ({ object3D }) => {
    // Tear down subscriptions. Often unnecessary — the GC and
    // the framework handle the typical cases.
    void object3D;
  },
});
```

Attach the script in the scene JSON via `script` + optional
`scriptParameters`:

```jsonc
{
  "id": "card-1",
  "kind": "mesh",
  "geometry": { "kind": "plane", "size": [5, 7] },
  "material": { "kind": "standard", "color": "#ffaa00" },
  "script": "my-game/card-flight",
  "scriptParameters": { "flightId": "play-foo" }
}
```

Lifecycle hooks (Unity-named):

| Hook            | Fires                                                      |
| --------------- | ---------------------------------------------------------- |
| `onStart`       | Once on mount. Return a teardown to skip `onDestroy`.      |
| `onUpdate`      | Per render frame while in play mode. `dt` is wall-clock.   |
| `onFixedUpdate` | Per physics substep (when `<PhysicsScene>` is mounted).    |
| `onLateUpdate`  | After every script's `onUpdate` + physics readback.        |
| `onDestroy`     | Once on unmount.                                           |
| `onEnable`      | Whenever `scriptEnabled` flips to `true` (pool-friendly).  |
| `onDisable`     | Whenever `scriptEnabled` flips to `false`.                 |
| `onIntent`      | When an intent is broadcast on the project bus.            |

The `parameters` field is declared as a Zod schema. The schema
narrows `ctx.parameters` at the call site, drives the inspector's
*Layer B* parameter panel, and is surfaced to the AI assistant via
the `script.inspect` MCP tool — **one schema, three readers**.

`script` (and the related `scriptParameters` / `scriptEnabled`
fields) are lifted to every builtin node kind. A directional-light
can carry a flicker driver; a transform-anchor group can carry an
orbit script; a perspective camera can carry a follow-cam script.
**Behaviour goes on builtins; you don't register a new node type
per behaviour.**

## 3. Prefabs — `definePrefab`

`definePrefab` is the **reusable composition primitive** — a
parametric sub-tree that's mounted N times inside a parent scene.
Prefabs are the right move when:

- The same structural pattern appears more than once (a deck stack,
  a hand fan, an NPC outfit composite, a UI badge).
- The composition needs parameters (deck count, fan angle, badge
  variant).
- You want the assistant to author *instances* of the pattern via
  the prefab picker without re-deriving the shape every time.

A prefab declares a pure-data `template` ([#906](https://github.com/tombee/vibesmith/issues/906)):
a function from the resolved `params` to a `SceneNode`-shaped tree
the scene-renderer expands at scene-load + HMR into real,
addressable nodes. The template returns plain data (`kind` /
`prefab` / `params` / `transform` / `children`) — **no React, no
hooks, no side effects**. Behaviour belongs in a `defineGameScript`
the template references via a child node's `script` field.

```ts
// scripts/deck-stack.ts
import { definePrefab } from '@vibesmith/runtime';
import { z } from 'zod';

definePrefab({
  id: 'my-game/deck-stack',
  params: z.object({
    count: z.number().int().min(0).default(40),
    height: z.number().default(0.02),
  }),
  template: ({ count, height }) => ({
    kind: 'group',
    children: Array.from({ length: count }, (_, i) => ({
      kind: 'mesh',
      transform: { position: [0, i * height, 0] },
      geometry: { kind: 'plane', size: [5, 7] },
      material: { kind: 'standard', color: '#444' },
    })),
  }),
});
```

Reference the prefab from scene JSON via the `prefab` field — per
[#906](https://github.com/tombee/vibesmith/issues/906)
`expandScenePrefabs` replaces every `{ prefab, params?, transform?,
children? }` reference with the prefab's `template(params)` sub-tree
so the hierarchy panel, the selection bus, and the MCP scene-tree
resource all see real, addressable nodes:

```jsonc
{
  "id": "main-deck",
  "prefab": "my-game/deck-stack",
  "transform": { "position": [0, 0, 0] },
  "params": { "count": 30 }
}
```

The template must be **pure** on `params` — same params in, same
tree out, no side effects. The prefab's `params` schema drives the
inspector + the AI surface, just like a script's `parameters` schema
does.

> **`renderJsx` is the deprecated escape hatch.** A prefab may
> instead supply a React-shaped `renderJsx: (params) => ReactNode`
> for the rare case that genuinely needs a React tree (the
> [#901](https://github.com/tombee/vibesmith/issues/901) bridge
> shape). It is `@deprecated` — kept one release for back-compat,
> then removed — and `prefab`-field scene-JSON references require
> `template` (a `renderJsx`-only prefab fails expansion with
> `PREFAB_NO_TEMPLATE`). Reach for `template` first; structural
> composition is data, not rendering. See
> [Prefab system](prefab-system.md) § *Pure-data structural
> templates*.

## 4. Instanced kinds — `defineInstancedKind`

`defineInstancedKind` (from `@vibesmith/runtime`, sibling of the
framework-internal `defineSceneNodeKind`) is the **performance
primitive** for *many of the same homogeneous thing*: tiles, grass,
rocks, debris, projectiles, units, scatter clutter. You declare the
geometry / material / capacity **once**; the SceneRenderer collapses
every scene-node entry of that `kind` into a single
`THREE.InstancedMesh` — N entries = one draw call — while keeping
each entry **independently selectable / inspectable / MCP-addressable**
(it mounts an empty addressable placeholder per entry alongside the
shared mesh).

```ts
// scripts/grass.ts
import { Matrix4, MeshStandardMaterial, PlaneGeometry, Vector3 } from 'three';
import { z } from 'zod';
import { defineInstancedKind } from '@vibesmith/runtime';

defineInstancedKind({
  id: 'my-game/grass-blade',                 // <owner>/<surface>
  geometry: new PlaneGeometry(0.1, 0.6),
  material: new MeshStandardMaterial({ color: '#3b6b3b' }),
  maxInstances: 4096,                         // pre-allocated; doesn't grow
  params: z.object({
    position: z.tuple([z.number(), z.number(), z.number()]),
    rotation_y: z.number().default(0),
    scale: z.number().default(1),
  }),
  // Called once per entry per frame: stable slot, validated params,
  // a reusable Matrix4 you fill in place. Keep it deterministic so
  // snapshot scrubbing replays identically.
  updateInstance: (_slot, { position, rotation_y, scale }, m) => {
    m.makeRotationY(rotation_y)
      .scale(new Vector3(scale, scale, scale))
      .setPosition(position[0], position[1], position[2]);
  },
});
```

Every entry of the kind in scene JSON batches into the shared mesh:

```jsonc
// scenes/main.scene.json
{
  "nodes": [
    { "id": "blade-0", "kind": "my-game/grass-blade", "params": { "position": [0, 0, 0] } },
    { "id": "blade-1", "kind": "my-game/grass-blade", "params": { "position": [1, 0, 0] } }
  ]
}
```

**Use `defineInstancedKind` over `defineSceneNodeKind`** when the
content is homogeneous and there are ~20+ of it; use
`defineSceneNodeKind` (framework-internal) only for heterogeneous
one-off kinds. See
[engine patterns](/vibesmith-docs/reference/engine-patterns/) §
*Batched instanced kinds* for the full decision table + capacity /
slot-stability semantics + Unity / Godot / Unreal / Bevy equivalents.

**Don't hand-roll a drei `<Instances>` wrapper** for instanced scene
content. A `<Instances>` block is one opaque React node the
inspector / hierarchy / selection / MCP can't see into;
`defineInstancedKind` gives the same single draw call *and* keeps
every entry a real scene-tree node. The raw R3F paths
(`<Instances>`, raw `<instancedMesh>` + `setMatrixAt`) stay available
as an escape hatch for instancing that genuinely lives outside the
`.scene.json` — see the
[instancing cookbook](/vibesmith-docs/cookbook/instancing/).

**When the placement is the hard part** — Poisson scatter across an
area, a crowd field, debris distribution — reach for the curated
instanced recipes in
[recipe canon](/vibesmith-docs/reference/recipe-canon/)
(`vegetation-scatter` / `props-clutter` / `debris-rubble` /
`projectiles` / `crowd-agents` / `modular-kit`). Each ships a
deterministic, tier-aware `place(...)` reference fn; you supply the
geometry + material and wire it to `defineInstancedKind`.

## Worked example — full extension stack

A common case for an RPG-shaped consumer: an NPC stall with a
flickering torch and a per-NPC idle animation.

```jsonc
// scenes/market.scene.json
{
  "version": 1,
  "name": "market",
  "nodes": [
    {
      "id": "ground",
      "kind": "mesh",
      "geometry": { "kind": "plane", "size": [40, 40] },
      "material": { "kind": "standard", "color": "#5b4f3a" }
    },
    {
      "id": "stall-1",
      "kind": "my-game/market-stall",
      "transform": { "position": [4, 0, 0] },
      "params": { "owner": "blacksmith" }
    },
    {
      "id": "torch-light",
      "kind": "directional-light",
      "transform": { "position": [4, 6, 0] },
      "intensity": 0.8,
      "script": "my-game/torch-flicker",
      "scriptParameters": { "ampHz": 4.2 }
    },
    {
      "id": "blacksmith-npc",
      "kind": "mesh",
      "geometry": { "kind": "box", "size": [1, 2, 1] },
      "material": { "kind": "standard", "color": "#a07050" },
      "transform": { "position": [4, 1, -1] },
      "script": "my-game/npc-idle",
      "scriptParameters": { "swayAmp": 0.04 }
    }
  ]
}
```

Three primitives, three different jobs:

- **Builtins** (`mesh`, `directional-light`) — the textured plane,
  the cube body, the torch light.
- **`definePrefab("my-game/market-stall")`** — the reusable stall
  composite (awning + counter + sign post). Each scene that needs a
  stall mounts an instance.
- **`defineGameScript("my-game/torch-flicker")`** + **`defineGameScript("my-game/npc-idle")`** — behaviour drivers
  attached to the torch + the NPC, one shared idle script across
  every NPC, one shared flicker script across every torch.

Nothing in the example needed `defineSceneNodeKind`.

## Anti-patterns

These all reduce to the same shape and have the same fix.

### Don't invent a new node type for a textured plane

```ts
// DON'T
defineSceneNodeKind({
  id: 'my-game/card',
  params: z.object({ artwork: z.string() }),
  renderJsx: ({ artwork }) => (
    <mesh>
      <planeGeometry args={[5, 7]} />
      <meshStandardMaterial color="#fff" map={/* loaded artwork */} />
    </mesh>
  ),
});
```

The card is a builtin `mesh` with a texture map. There's no scene-
graph behaviour the kind adds over a `kind: "mesh"` node — just
boilerplate.

```jsonc
// DO
{
  "id": "card-1",
  "kind": "mesh",
  "geometry": { "kind": "plane", "size": [5, 7] },
  "material": { "kind": "standard", "color": "#fff", "map": "image:cards/foo" }
}
```

### Don't invent a new node type for a behaviour

```ts
// DON'T
defineSceneNodeKind({
  id: 'my-game/card-flight',
  params: z.object({ flightId: z.string() }),
  renderJsx: () => null,
});
```

A behaviour with no visible footprint of its own is a script, not a
node type. Attach it to the card mesh.

```ts
// DO
defineGameScript({
  id: 'my-game/card-flight',
  parameters: z.object({ flightId: z.string() }),
  onStart: (ctx) => { void ctx; },
  onUpdate: (ctx, dt) => { void ctx; void dt; },
});
```

```jsonc
{
  "id": "card-1",
  "kind": "mesh",
  "geometry": { "kind": "plane", "size": [5, 7] },
  "material": { "kind": "standard", "color": "#fff" },
  "script": "my-game/card-flight",
  "scriptParameters": { "flightId": "play-foo" }
}
```

### Don't invent a new node type for a structural composite

```ts
// DON'T
defineSceneNodeKind({
  id: 'my-game/deck-stack',
  params: z.object({ count: z.number().default(40) }),
  renderJsx: ({ count }) => (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} position={[0, i * 0.02, 0]}>
          <planeGeometry args={[5, 7]} />
          <meshStandardMaterial color="#444" />
        </mesh>
      ))}
    </group>
  ),
});
```

A composite whose pieces are real scene-graph entities (selectable,
inspectable, snapshot-deterministic) is a prefab. A
`renderJsx`-emits-N-elements shape flattens the hierarchy into one
React node while the viewport contains N — selection silently misses
N − 1 of them. The pure-data `template` expands into N real,
addressable scene nodes instead.

```ts
// DO
definePrefab({
  id: 'my-game/deck-stack',
  params: z.object({ count: z.number().int().min(0).default(40) }),
  template: ({ count }) => ({
    kind: 'group',
    children: Array.from({ length: count }, (_, i) => ({
      kind: 'mesh',
      transform: { position: [0, i * 0.02, 0] },
      geometry: { kind: 'plane', size: [5, 7] },
      material: { kind: 'standard', color: '#444' },
    })),
  }),
});
```

(For the case where you genuinely want N independently selectable
child meshes, scene JSON parents them under the prefab instance —
see [scene-construction](/reference/scene-construction/).)

### Don't import `defineSceneNodeKind` from `@vibesmith/runtime`

It isn't there. The factory lives on `@vibesmith/runtime/internal`
for framework-internal use only (adding new builtins, never
consumer-facing). Two surfaces catch a legacy import that hasn't
migrated:

- `vibesmith doctor`'s `scene-node-kind-consumer-import` check warns
  on the import at `vibesmith check`.
- The editor's project-script bundler fails the bundle with an
  actionable message — `defineSceneNodeKind is framework-internal …
  (see extending § Anti-patterns)` — so the migration path is clear
  at editor-open time rather than an opaque "No matching export"
  error.

This is a **hard rename, not a deprecation** — there is *no*
one-release re-export shim. Re-adding the symbol to the public
surface (even temporarily) would reopen the discoverability problem
the rename closed. The fix is always to migrate to one of the three
primitives.

```ts
// DON'T
import { defineSceneNodeKind } from '@vibesmith/runtime';

// DO — pick whichever of the three primitives the table above points at.
import { defineGameScript, definePrefab } from '@vibesmith/runtime';
```

> **Note:** `defineInstancedKind` (§4) *is* a public consumer-facing
> import from `@vibesmith/runtime` — the rename above is specific to
> `defineSceneNodeKind` (the framework-internal heterogeneous-kind
> factory), not the instanced performance primitive.

## Cross-references

- [engine-patterns](/reference/engine-patterns/) — Unity / Godot /
  Unreal ↔ vibesmith translation table; per-builtin vocabulary
  lives here. § *Batched instanced kinds* covers
  `defineInstancedKind`.
- [recipe-canon](/vibesmith-docs/reference/recipe-canon/) — the
  curated instanced-placement recipes (vegetation / props / debris /
  projectiles / crowds / kits) `defineInstancedKind` consumes.
- [scene-construction](/reference/scene-construction/) — Recipe →
  Generator → Composition → Renderer; how prefabs / scripts /
  builtins fit into the broader scene model.
- [prefab-system](/reference/prefab-system/) — deeper
  `definePrefab` reference (parameters, snapshot interaction,
  validation).
