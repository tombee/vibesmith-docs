---
title: 'From Godot'
description: 'A Godot-flavoured tour of vibesmith. Node._process → defineGameScript onTick. PackedScene → definePrefab. Signals → ctx.signal / onSignal. @export → Zod-typed parameters. AnimationTree → <Animator>. The vocabulary map plus a side-by-side rotating-cube walkthrough.'
---

You've shipped projects in Godot. You know the scene tree, `_ready`
/ `_process`, signals, `PackedScene`, the `@export` annotation, and
the AnimationTree node. This page maps that vocabulary onto
vibesmith so the framework feels less foreign on first read.

## Five-minute landing

Godot and vibesmith share more shape than either shares with Unity:

- Both are scene-tree-first. *Everything is a node.*
- Both ship a desktop editor that opens a project folder.
- Both expose a Play / Pause / Step toolbar over a live scene.
- Both lean on text-based scene files (Godot's `.tscn`,
  vibesmith's `.tsx` + `scene.json`). Diff-friendly. AI-readable.
- Both use a signal-like one-way notification pattern.

Where they diverge:

- **The scene tree is React + R3F**, not a built-in `SceneTree`
  class. Your scene file is `.tsx` and the JSX *is* the tree.
- **The language is TypeScript** (and you get React's component
  model for free), not GDScript. There's no inheritance ladder
  for scripts; you register them as factories.
- **There's no built-in physics yet** — the contract is
  `definePhysics` and the canonical adapters are Rapier
  (production) and Cannon-es (proof-of-second-impl).
- **AI assistance is a first-class authoring surface.** The
  framework expects you to drive it through Claude Code / Cursor
  / Codex CLI / Copilot via MCP, or via the in-editor BYOK chat
  panel.

If those four shifts feel manageable, the mapping below should
take care of the rest.

## Vocabulary map

The Rosetta data lives at
[`/vibesmith-docs/engine-rosetta.json`](/vibesmith-docs/engine-rosetta.json).
Godot-relevant entries:

| Godot | vibesmith | What it is in vibesmith |
| --- | --- | --- |
| `Node._ready / _process / _exit_tree` | `defineGameScript({ id, onMount, onTick, onUnmount })` | Per-node lifecycle. Mounts once, ticks per frame, unmounts when the node leaves the tree. Bound to a scene node by `script="<id>"`. See [Script](/vibesmith-docs/concepts/script/). |
| `RigidBody3D` / `CharacterBody3D` | `definePhysics` + `<RigidBody>` | Adapter contract — Rapier first-class, Cannon-es as second impl. `<RigidBody>` binds a node to a body; `ctx.physics` gives the script raycasts + queries. |
| `PhysicsDirectSpaceState3D.intersect_ray` | `ctx.physics.raycast` | Same idea, different surface. |
| `PackedScene` | `definePrefab` | Closest thing: a content unit with a recipe + generator + critic + AI brief + preview. Generative, not a frozen instance. See [Prefab](/vibesmith-docs/concepts/prefab/). |
| `SceneTree` (root of the running game) | Composition (`scene.json` mounted by the editor) | Scene-tree of nodes with transforms + script attachments + child references. Persisted as JSON, mounted as a React component. |
| `GPUParticles3D` / `CPUParticles3D` | `<Particles>` + `<Emitter>` | Same scene-tree shape; CPU instanced-billboards (LOW / MEDIUM) + WebGPU-compute (HIGH / ULTRA) behind one consumer API. |
| `AnimationTree` | `<Animator>` + `ctx.animator(id)` | State machine + blend tree over Three's `AnimationMixer`. JSON / TS-as-data graphs. |
| `AudioStreamPlayer3D` | `<AudioEmitter>` | 3D-positioned scene-tree audio source. Fixed mixer bus hierarchy (master / music / sfx / dialogue / ambient). |
| `Control` (CanvasLayer + Control) | `defineHud` | DOM overlay rendered above the R3F canvas — pure React + Tailwind, absolute-positioned. |
| `MultiplayerAPI` | `defineNetworkAdapter` | Pluggable transport (Colyseus / WS / WebRTC). Framework owns the wire-version + intent / state-delta / reconciliation shape. |
| Signals (`emit_signal` / `connect`) | `ctx.signal('x', payload)` / `ctx.onSignal('x', handler)` | Same one-way notification pattern; pub/sub across scripts. See [Signal](/vibesmith-docs/concepts/signal/). |
| `@export var foo: float = 0.5` | Zod-typed `parameters` on `defineGameScript` | One schema feeds the runtime, the inspector panel, **and** the AI assistant — no separate metadata layer. See [Inspectable parameters](/vibesmith-docs/cookbook/inspectable-parameters/). |
| Custom save resource | [Snapshot](/vibesmith-docs/concepts/snapshot/) | First-class capture + replay. Launch into any saved state; HMR-preserved across script edits. |
| Resource (.tres / .res — curated data) | [Recipes](/vibesmith-docs/concepts/recipe/) + [Capabilities](/vibesmith-docs/concepts/capability/) | Recipes hold curated patterns (VFX, shaders, cutscenes, mixes); capabilities abstract things the framework can do over providers. Less direct than the Godot Resource — there's no "I just want a typed data blob" container in vibesmith because TS interfaces + JSON already cover that. |

## Walkthrough: rotate a cube

The Godot-101 version vs vibesmith.

### Godot (GDScript)

```gdscript
# spin_cube.gd — attached to a MeshInstance3D node
extends Node

@export var degrees_per_second: float = 90.0

func _process(delta: float) -> void:
    var owner_node := get_parent()
    owner_node.rotation.y += deg_to_rad(degrees_per_second) * delta
```

In the editor: drag the script onto a `MeshInstance3D`. The
inspector shows `degrees_per_second` because of `@export`.

### vibesmith

```ts
// scripts/spin-cube.ts
import { defineGameScript } from '@vibesmith/runtime';
import { z } from 'zod';

export const spinCube = defineGameScript({
  id: 'spin-cube',
  parameters: z.object({
    degreesPerSecond: z.number().default(90),
  }),
  onTick(ctx, { delta, parameters }) {
    const radians = (parameters.degreesPerSecond * Math.PI) / 180;
    ctx.node.rotation.y += radians * delta;
  },
});
```

```tsx
// scenes/main.tsx
export default function MainScene() {
  return (
    <>
      <directionalLight position={[5, 10, 5]} />
      <mesh position={[0, 0.5, 0]} script="spin-cube">
        <boxGeometry />
        <meshStandardMaterial color="orange" />
      </mesh>
    </>
  );
}
```

Press Play in the editor. The cube rotates. The inspector exposes
`degreesPerSecond` because the Zod schema declared it.

## What's intentionally different

- **No `extends Node` ladder.** Scripts are factory registrations,
  not subclasses. No "extends" anywhere. Behaviour composes
  through the lifecycle methods + multiple scripts on a node, not
  through inheritance.
- **No `$NodePath` get-by-path indirection.** You hand a script
  *its own* node via `ctx.node`; child references are React
  refs. Path-string lookups force AI assistants to chase strings;
  React refs let them read structure.
- **No GDScript magic `_process`.** The lifecycle method is
  literally named `onTick`. No introspection-based dispatch.
- **No scene inheritance.** Variation is the script-parameters
  layer + composing smaller scene components together (React's
  ownership model handles most cases scene-inheritance handled in
  Godot). When you need a "specialised version of X", create a
  React component that wraps `X` with different parameters.
- **No `@onready var foo = $Bar` magic.** State that needs lazy
  init goes in `onMount`. Refs to other nodes are passed in via
  props on the scene tree.
- **No autoload singletons.** Cross-scene state lives in React
  context, in module-level signals, or in a registered
  world-model store. The framework offers
  `registerWorldModelStore` for the third case.
- **No visual shader editor (yet).** Shaders are
  [TSL (Three Shading Language)](/vibesmith-docs/reference/tsl-shader-pipeline/)
  — code-first with a node-graph counterpart on the same data
  shape. The full
  [Principled non-features](/vibesmith-docs/principled-non-features/)
  list explains the AI-fluency reasoning.

## Coming from Godot, going to vibesmith — practical first steps

1. **Skim the [Concepts](/vibesmith-docs/concepts/) pages.** Two
   are particularly worth a careful read for Godot refugees:
   [Signal](/vibesmith-docs/concepts/signal/) (very close to
   Godot signals; the differences matter) and
   [Snapshot](/vibesmith-docs/concepts/snapshot/) (no direct
   Godot equivalent).
2. **Read [Engine patterns](/vibesmith-docs/reference/engine-patterns/).**
   The long-form Rosetta — covers patterns we deliberately don't
   copy from any heavyweight engine + status of what's still owed.
3. **Scaffold a project**: see
   [Quick start](/vibesmith-docs/getting-started/quick-start/).
   The scaffold's `main.tsx` already contains the rotating
   orange cube — the Godot-101 task above is *already on screen*
   the first time you press Play.
4. **Install the [MCP integration](/vibesmith-docs/cookbook/install-mcp/)
   into your coding assistant** (Claude Code / Codex CLI /
   Copilot). The authoring surface assumes you have one.
5. **Read [Anti-patterns](/vibesmith-docs/anti-patterns/).** The
   12-entry list of R3F mistakes. The "useState in `useFrame`"
   trap will be unfamiliar if you've never written React + R3F.

## Cross-references

- [Concepts](/vibesmith-docs/concepts/) — first-principles
  vocabulary if a term felt fuzzy.
- [Engine patterns](/vibesmith-docs/reference/engine-patterns/) —
  the full reference doc.
- [Principled non-features](/vibesmith-docs/principled-non-features/)
  — what the framework deliberately won't ship.
- [Cookbook](/vibesmith-docs/cookbook/) — working code.
- [`engine-rosetta.json`](/vibesmith-docs/engine-rosetta.json) —
  the raw data your AI assistant can fetch.
