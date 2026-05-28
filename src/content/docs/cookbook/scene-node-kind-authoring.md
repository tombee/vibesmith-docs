---
title: 'Scene-node-kind authoring rules'
description: 'Five rules every defineSceneNodeKind / defineInstancedKind registration must follow — one responsibility, pure renderJsx, children as scene-nodes, scene tree IS the state, no DOM. vibesmith doctor enforces the mechanical ones.'
---

`defineSceneNodeKind` (from `@vibesmith/runtime`) is the canonical
extension point for game content. Scene files reference kinds by
`kind` id; the scene-renderer mounts one R3F subtree per kind
instance. That makes a kind the unit Hierarchy / Inspector /
selection / MCP read from — so a fat kind degrades every
downstream surface. Five rules keep the unit honest.

`vibesmith doctor` enforces the mechanical ones via three checks
(`scene-node-kind-pure-render`,
`scene-node-kind-children-as-data`, `scene-node-kind-no-dom`).

## The five rules

### 1. One responsibility per kind

A kind renders **one visible thing** — one mesh, one light, one
emitter, one chrome element. If a kind iterates over a
collection inside `renderJsx`, the collection items want to be
scene-nodes themselves.

**Native-engine analog.** A MonoBehaviour (Unity) / Node script
(Godot) can't spawn and render its child entities inline —
children are GameObjects / Nodes in the scene, instantiated via
`Instantiate` / `add_child`, with their own Transform and
Components. vibesmith is shaped the same way: the scene IS the
state.

Symptoms of violation:

- Hierarchy panel shows fewer nodes than the viewport.
- Selection clicks something visible but the inspector lands on
  the wrong (or no) node.
- Snapshots replay correctly but selection-by-id from the MCP
  surface can't find the entity.

### 2. `renderJsx` is a pure function of `params`

Inputs flow in **only** via Zod-validated `params`. The function
body may use:

- React primitives that don't reach into runtime state:
  `useRef`, `useMemo`, `useCallback`, `useState` (for purely
  visual local state — a hover flash, an animation phase).
- R3F primitives: `useFrame`, `useThree`.

The function body **must not** read from:

- Zustand stores (`useFixture`, `useGameStore`, any consumer
  store hook).
- Context providers that carry runtime state (selection bus,
  authoring layer, MCP mirror).
- `useEffect` that consults runtime data outside the React tree
  (registry lookups, fetch, framework introspection APIs).

State enters via `params`; the authoring layer outside the kind
mutates `params` (via `manage_object`) or adds / removes / moves
scene-nodes (via `set_active_scene`, `create_object`,
`delete_object`, …). If a kind "needs to read state X", that
state belongs in the scene file as a `params` field on the kind.

### 3. Children are scene-nodes, not JSX

A unit on a battlefield is a scene-node whose `parentId` points
at the battlefield. The battlefield kind renders only the
battlefield. The unit kind renders only the unit.

**Wrong.** Battlefield kind takes `units: UnitData[]` and maps
to `<UnitMesh>` JSX inside `renderJsx`. Result: one hierarchy
node ("battlefield"), N viewport visuals, selection blind to N-1
of them.

**Right.** Battlefield kind takes the battlefield's own params
(size, theme). Each unit is a `node` entry in the scene JSON
with `kind: "acme/unit"` and `parentId: "<battlefield-id>"`. The
unit kind owns its own `renderJsx`. The hierarchy reflects N+1
nodes, every unit is independently selectable, and the AI
assistant can read each entity's shape from one place.

### 4. The scene tree IS the state

Dynamic state — which units exist, where cards live, what's in
a player's hand — is reflected as scene-nodes. State change
means the authoring layer adds / removes / moves scene-nodes
via the MCP surface (`create_object`, `delete_object`,
`manage_object`). The kind never spawns its own children inside
`renderJsx` based on a snapshot of external state.

This is the same shape every native engine takes —
`Instantiate` (Unity), `add_child` (Godot), `commands.spawn`
(Bevy) — ported to vibesmith.

### 5. No DOM in `renderJsx`

`renderJsx` returns R3F (Three.js) JSX. DOM elements (`<div>`,
`<button>`, `<input>`) belong in HUDs — `defineSceneHud` for
scene-scoped DOM, `defineGlobalHud` for project-global DOM. See
[HUD lifecycle](../reference/hud-lifecycle/).

Why: a kind that returns DOM bypasses the scene tree's selection
/ snapshot / determinism layer; the editor's hierarchy and
inspector both assume scene-tree nodes are R3F-shaped. DOM
overlays have their own lifecycle that doesn't conflict with
these contracts.

## Worked example — good kind vs bad kind

A battlefield with N units. The good shape leaves the
battlefield as one kind and lets each unit be its own kind. The
bad shape fuses them.

### Bad — fat kind that loops in `renderJsx`

```ts
// DON'T — collection iteration inside renderJsx. The hierarchy
// shows one "battlefield" node; the viewport shows N units;
// selection clicks units but lands on (or near) the battlefield.
import { defineSceneNodeKind } from '@vibesmith/runtime';
import { useFixture } from './state.js';
import { z } from 'zod';

defineSceneNodeKind({
  id: 'acme/battlefield',
  params: z.object({
    size: z.number().default(10),
  }),
  renderJsx: ({ size }) => {
    // Rule 2 violation — useFixture reads from a store.
    const units = useFixture((s) => s.units);
    return (
      <group>
        <mesh receiveShadow>
          <planeGeometry args={[size, size]} />
          <meshStandardMaterial color="#3a3a3a" />
        </mesh>
        {/* Rule 1 + 3 violation — collection of units inside JSX. */}
        {units.map((unit) => (
          <mesh key={unit.id} position={[unit.x, 0.5, unit.z]}>
            <boxGeometry />
            <meshStandardMaterial color={unit.color} />
          </mesh>
        ))}
      </group>
    );
  },
});
```

### Good — one kind per visible thing, scene tree carries state

```ts
// DO — battlefield is its own kind; each unit is its own kind;
// scene JSON parents units under the battlefield. Hierarchy
// reflects every entity; selection works; the assistant reads
// each kind's shape from one open file.
import { defineSceneNodeKind } from '@vibesmith/runtime';
import { z } from 'zod';

defineSceneNodeKind({
  id: 'acme/battlefield',
  params: z.object({
    size: z.number().default(10),
  }),
  renderJsx: ({ size }) => (
    <mesh receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial color="#3a3a3a" />
    </mesh>
  ),
});

defineSceneNodeKind({
  id: 'acme/unit',
  params: z.object({
    color: z.string().default('#888'),
  }),
  renderJsx: ({ color }) => (
    <mesh castShadow>
      <boxGeometry />
      <meshStandardMaterial color={color} />
    </mesh>
  ),
});
```

Scene JSON:

```json
{
  "version": 1,
  "name": "main",
  "nodes": [
    { "id": "field", "kind": "acme/battlefield", "params": { "size": 12 } },
    { "id": "unit-a", "kind": "acme/unit", "parentId": "field",
      "transform": { "position": [-2, 0.5, 0] }, "params": { "color": "#c44" } },
    { "id": "unit-b", "kind": "acme/unit", "parentId": "field",
      "transform": { "position": [2, 0.5, 0] }, "params": { "color": "#4cc" } }
  ]
}
```

### Many of the same thing? Use `defineInstancedKind`

If you're rendering many instances of the same geometry +
material (tiles, projectiles, foliage), reach for
[`defineInstancedKind`](../reference/engine-patterns/) instead.
Each entry stays a real scene-node (addressable, selectable,
snapshot-deterministic) but the renderer batches the draw call
into one `InstancedMesh`. Same rules apply — `updateInstance`
is your per-frame hook, not `renderJsx` loops.

## Doctor enforcement

`vibesmith doctor` runs three mechanical checks against every
project that ships a `vibesmith.toml`. Each check walks
`scripts/` + `src/` looking for `defineSceneNodeKind({...})` call
sites and inspects the literal `renderJsx` body via a tolerant
static scanner. Never executes consumer code.

| Check id                           | What it flags                                                                                                            | Rule |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---- |
| `scene-node-kind-pure-render`      | `renderJsx` calls a non-allowed hook (`useFixture`, `useGameStore`, any `useX` other than `useFrame` / `useThree` / `useRef` / `useMemo` / `useCallback` / `useState`). | 2 |
| `scene-node-kind-children-as-data` | `renderJsx` iterates over a collection (`.map(` / `Array.from(` inside the returned JSX) — children should be scene-nodes, not JSX. | 1, 3, 4 |
| `scene-node-kind-no-dom`           | `renderJsx` returns DOM elements (`<div>` / `<span>` / `<button>` / any other HTML tag). | 5 |

Each violation emits a `warn` line citing the kind id, the
source file, the rule, and a link back to this doc. Verdicts:

- All clean → `ok`, one line per check with the count of kinds
  scanned.
- Any violation → `warn`. Detail lists each offender; the fix
  is always *"refactor per the rule cited"*.
- The check never escalates to `fail` — early adopters need
  room to migrate; the warning is signal enough for CI to gate
  on, and the runtime keeps working either way.

## How to verify your kind works

After you've written or edited a kind, validate against the
running editor through the MCP surface
([visual-validation-for-agents](./visual-validation-for-agents/)):

1. Open the project in the vibesmith editor binary.
2. `mcp__vibesmith__pause()`.
3. `mcp__vibesmith__set_active_scene({ id: '<your-scene>' })`.
4. `mcp__vibesmith__viewport_screenshot({ width, height })`.
5. Inspect the screenshot + the editor's Hierarchy panel — every
   instance you expect to see should appear as its own node.

If your hierarchy node count doesn't match the viewport entity
count, you've hit a rule 1 / 3 / 4 violation; revisit the kind
and break the loop into scene-nodes.
