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
| A genuinely new node type                                                         | **Almost never.** Open a framework issue — it goes in builtins. |

That last row is the load-bearing one. Unity / Godot / Unreal don't
let consumers register new node types — the node-type space is
fixed by the engine, and every "I need a textured plane" / "I need
a card-flight driver" / "I need a deck stack" maps onto one of the
three primitives above. vibesmith follows the same model. If you
catch yourself reaching for `defineSceneNodeKind` (the framework-
internal factory that registers new node types), step back to this
table — almost always one of the three primitives is the right
answer.

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

```tsx
// scripts/deck-stack.tsx
import { definePrefab } from '@vibesmith/runtime';
import { z } from 'zod';

definePrefab({
  id: 'my-game/deck-stack',
  params: z.object({
    count: z.number().int().min(0).default(40),
    height: z.number().default(0.02),
  }),
  renderJsx: (params) => {
    const { count, height } = params as { count: number; height: number };
    const cards = Array.from({ length: count }, (_, i) => (
      <mesh key={i} position={[0, i * height, 0]}>
        <planeGeometry args={[5, 7]} />
        <meshStandardMaterial color="#444" />
      </mesh>
    ));
    return <group>{cards}</group>;
  },
});
```

Reference the prefab from scene JSON — the canonical reference path
is `kind: "<prefab-id>"` once the prefab's id matches the
`<owner>/<surface>` convention (the framework auto-bridges the
prefab into the scene-JSON dispatch registry):

```jsonc
{
  "id": "main-deck",
  "kind": "my-game/deck-stack",
  "transform": { "position": [0, 0, 0] },
  "params": { "count": 30 }
}
```

`renderJsx` must be **pure** on `params` — return only a React
element tree; no side effects, no registry mutations, no
subscriptions outside the returned tree. Side-effect lifecycles
belong inside the returned JSX (via standard React `useEffect`).
The prefab's `params` schema drives the inspector + the AI
surface, just like a script's `parameters` schema does.

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
inspectable, snapshot-deterministic) is a prefab. The
`renderJsx`-emits-N-elements anti-pattern flattens the hierarchy
into one node while the viewport contains N — selection silently
misses N − 1 of them.

```ts
// DO
definePrefab({
  id: 'my-game/deck-stack',
  params: z.object({ count: z.number().int().min(0).default(40) }),
  renderJsx: (params) => {
    const { count } = params as { count: number };
    return (
      <group>
        {Array.from({ length: count }, (_, i) => (
          <mesh key={i} position={[0, i * 0.02, 0]}>
            <planeGeometry args={[5, 7]} />
            <meshStandardMaterial color="#444" />
          </mesh>
        ))}
      </group>
    );
  },
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

## Cross-references

- [engine-patterns](/reference/engine-patterns/) — Unity / Godot /
  Unreal ↔ vibesmith translation table; per-builtin vocabulary
  lives here.
- [scene-construction](/reference/scene-construction/) — Recipe →
  Generator → Composition → Renderer; how prefabs / scripts /
  builtins fit into the broader scene model.
- [prefab-system](/reference/prefab-system/) — deeper
  `definePrefab` reference (parameters, snapshot interaction,
  validation).
