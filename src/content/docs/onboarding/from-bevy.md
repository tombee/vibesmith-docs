---
title: 'From Bevy'
description: 'A Bevy-flavoured tour of vibesmith. ECS Component + System → defineGameScript. PluginGroup → extensions. RigidBody (bevy_rapier) → <RigidBody>. bevy_hanabi → <Particles>. AnimationPlayer → <Animator>. The vocabulary map plus a side-by-side rotating-cube walkthrough, with notes on the future Rust + Bevy native target.'
---

You've shipped projects in Bevy. You know ECS, queries, systems,
`PluginGroup`, `Commands`, `Startup` vs `Update` schedules. This
page maps that vocabulary onto vibesmith.

A note before the map: Bevy is named as vibesmith's canonical
*future* native engine target in
[Positioning](/vibesmith-docs/positioning/). Today the runtime is
TS + R3F on the web; the intelligence layer (canon, providers,
MCP, recipes, snapshots) is engine-portable in principle. If the
framework eventually ships a native runtime, Bevy is where the
proving-ground would sit. So: if you arrive from Bevy you're
**also our future audience** — feedback on the framework /
engine boundary is especially welcome.

## Five-minute landing

vibesmith and Bevy look superficially different (TypeScript vs
Rust; React tree vs ECS world) but share more shape than either
shares with Unity:

- Both are *data-first*: scene files are JSON / TS-as-data, not
  binary blobs.
- Both refuse visual scripting — the language is the language.
- Both embrace adapter contracts (Rapier as the canonical physics
  in both worlds, for example).
- Both expose a tight per-frame tick model and avoid magic
  per-frame reflection.

Where they differ:

- **No ECS at the framework runtime layer.** vibesmith's runtime
  is React + R3F: nodes are JSX components, not entities; state
  is captured by component-local hooks / refs / world-model
  stores, not by ECS components / queries. ECS is a *future
  Rust runtime concern*, not the current TS surface. See
  [`positioning.md`](/vibesmith-docs/positioning/) for the
  framework / engine split.
- **The build target is the web platform**, not a native binary.
  vibesmith opens project folders in a Tauri-wrapped editor, but
  the game itself runs on WebGL / WebGPU through Three.js.
- **AI assistance is a first-class authoring surface.** The
  framework expects you to drive it through Claude Code / Cursor
  / Codex CLI / Copilot via MCP, or via the in-editor BYOK chat
  panel.
- **The renderer is Three.js**, not wgpu directly. Less
  flexibility, more turnkey defaults, smaller AI surface area
  for shader-class work (mitigated by recipe-canon for the
  hard-to-generate cases).

## Vocabulary map

The Rosetta data lives at
[`/vibesmith-docs/engine-rosetta.json`](/vibesmith-docs/engine-rosetta.json).
Bevy-relevant entries:

| Bevy | vibesmith | What it is in vibesmith |
| --- | --- | --- |
| Component + system (`Startup` / `Update` / cleanup) | `defineGameScript({ id, onMount, onTick, onUnmount })` | Per-node lifecycle attached to a scene node via `script="<id>"`. The "system that runs on this entity" intuition translates; the "queries across entities" one mostly doesn't (you write it as a React context or a world-model store instead). See [Script](/vibesmith-docs/concepts/script/). |
| `RigidBody` + `Collider` (bevy_rapier) | `definePhysics` + `<RigidBody>` | The Rapier shape carries directly. Adapter contract; Cannon-es is the second-impl. |
| Rapier `QueryPipeline.cast_ray` | `ctx.physics.raycast` | Same idea. |
| Scene (.scn) + spawn helper | `definePrefab` | Closer to "scene asset + a generator script". See [Prefab](/vibesmith-docs/concepts/prefab/). |
| World + Entity hierarchy | Composition (`scene.json`) | The persisted *form* differs (JSON-as-tree vs ECS world), but the editor mounts both into a tree. |
| bevy_hanabi (community) | `<Particles>` + `<Emitter>` | CPU instanced-billboards (LOW / MEDIUM tier) + WebGPU-compute (HIGH / ULTRA tier) behind one consumer API. Recipe-canon driven. |
| `AnimationPlayer` + `AnimationGraph` | `<Animator>` + `ctx.animator(id)` | State machine + blend tree over Three's `AnimationMixer`. JSON / TS-as-data graphs. |
| AudioSource (bevy_audio) | `<AudioEmitter>` | Scene-tree audio source with 3D positional panning, fixed mixer bus hierarchy. Web Audio under the hood. |
| bevy_ui Node tree | `defineHud` | DOM overlay rendered above the R3F canvas — pure React + Tailwind, absolute-positioned. |
| bevy_replicon (community) | `defineNetworkAdapter` | Pluggable transport (Colyseus, WebSockets, WebRTC). Framework owns the wire-version + intent / state-delta / reconciliation shape. |
| bevy_save (community) | [Snapshot](/vibesmith-docs/concepts/snapshot/) | First-class in vibesmith — capture + replay is *the* iteration loop, not an opt-in plugin. HMR-preserved. |
| Asset (Asset / Handle) | [Recipes](/vibesmith-docs/concepts/recipe/) + [Capabilities](/vibesmith-docs/concepts/capability/) | Closest fit, with caveats: recipes hold curated patterns (VFX, shaders, cutscenes, mixes); capabilities abstract "things the framework can do" over providers. The Bevy Asset's role as a content handle is split across vibesmith's `assets/` folder (raw bytes) and the recipe / capability layer (curated patterns). |

## Walkthrough: rotate a cube

Bevy-101 vs vibesmith.

### Bevy (Rust)

```rust
use bevy::prelude::*;

#[derive(Component)]
struct SpinCube {
    degrees_per_second: f32,
}

fn spin_cubes(time: Res<Time>, mut q: Query<(&SpinCube, &mut Transform)>) {
    for (spin, mut transform) in &mut q {
        let radians = spin.degrees_per_second.to_radians();
        transform.rotate_y(radians * time.delta_seconds());
    }
}

fn setup(mut commands: Commands, mut meshes: ResMut<Assets<Mesh>>, mut materials: ResMut<Assets<StandardMaterial>>) {
    commands.spawn((
        PbrBundle {
            mesh: meshes.add(Cuboid::default()),
            material: materials.add(Color::ORANGE),
            ..default()
        },
        SpinCube { degrees_per_second: 90.0 },
    ));
    commands.spawn(DirectionalLightBundle { transform: Transform::from_xyz(5.0, 10.0, 5.0), ..default() });
}

fn main() {
    App::new()
        .add_plugins(DefaultPlugins)
        .add_systems(Startup, setup)
        .add_systems(Update, spin_cubes)
        .run();
}
```

ECS shape: a `SpinCube` component on the entity, a system that
queries `(SpinCube, Transform)` and rotates each match.

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

The biggest mental shift coming from Bevy: the *script* targets a
specific node; it's not a system that queries the world. If you
need "all entities with shape X do behaviour Y", the framework
pattern is **a React component that wraps the shape, with the
script attached inside it** — the JSX layer carries the
"selection" Bevy's queries carry. Cross-cutting concerns
(time-of-day, weather, music director) live in a
[world-model store](/vibesmith-docs/concepts/snapshot/) plus a
director script that owns the orchestration.

## What's intentionally different

- **No ECS at runtime.** Storage is React's component tree +
  refs + world-model stores. The framework explicitly does not
  ship a typed-archetype query layer in the TS runtime.
- **No `Commands.spawn` deferred entity creation.** Adding a
  thing to the scene is rendering a React component. Mutations
  are synchronous; React's reconciler handles the dispatch.
- **No system ordering DAG (`Stage` / `IntoSystemConfigs`
  `.after()` / `.before()`).** Order is JSX order + the React
  reconciliation pass. For per-frame priority within scripts
  that share a node, see the `priority` field on `useFrame` in
  [Engine patterns →
  Game loop and tick](/vibesmith-docs/reference/engine-patterns/#game-loop-and-tick).
- **No `PluginGroup`.** The closest concept is the
  [extension](/vibesmith-docs/concepts/extension/) — a panel /
  feature plugged into the editor. Extensions don't replace
  app-bootstrap ceremony; the binary handles that.
- **No `Res<T>` / `ResMut<T>` global resource pattern.** Per-
  scene shared state lives in React context; cross-scene state
  lives in `registerWorldModelStore`.
- **No `Handle<Mesh>` indirection.** Meshes hang directly off
  `<mesh><boxGeometry /></mesh>` etc. The browser is the
  asset-loader runtime; assets ride through `@vibesmith/assets`
  with a content-hash manifest.
- **No native build target — yet.** vibesmith's runtime is
  WebGL / WebGPU through Three.js on the browser / Tauri shell.
  If you need a native binary today, pick Bevy directly. The
  framework's *intelligence layer* is engine-portable in
  principle; the runtime story for native is a future-tense
  question.

## Why vibesmith is built on R3F instead of Bevy *today*

Worth covering explicitly, since you're the audience most
likely to ask:

- **AI fluency on idiomatic code.** Today the AI-coding-assistant
  ecosystem has an enormous training-data corpus for TS / React /
  R3F / Three.js. The corresponding corpus for Rust + Bevy is
  smaller and changing fast. The framework's whole bet hinges on
  the assistant being effective on the runtime code; today that
  means TS + R3F.
- **Web-first reach.** Indie devs need their game playable in a
  link; the browser is the only frictionless distribution
  channel at indie budget. WebGL / WebGPU through Three is the
  shortest path.
- **Bevy 1.0 hasn't landed.** Bevy's API surface is still
  iterating fast. Picking it as a load-bearing runtime today
  would lock the framework to a moving target.
- **Two parallel runtimes, not sequential succession.** When the
  native track opens, both run side-by-side. The R3F web target
  doesn't get deprecated; it's the efficient web choice
  indefinitely. See
  [Positioning](/vibesmith-docs/positioning/) for the
  long-form framing.

## Coming from Bevy, going to vibesmith — practical first steps

1. **Read [Positioning](/vibesmith-docs/positioning/) carefully.**
   The two-layer bet (narrow runtime / durable intelligence
   layer) and the Bevy-as-future-target framing are most
   relevant to you of any incoming audience.
2. **Skim the [Concepts](/vibesmith-docs/concepts/) pages.** Pay
   attention to [Script](/vibesmith-docs/concepts/script/) (the
   per-node lifecycle is the biggest mental shift from ECS) and
   [Snapshot](/vibesmith-docs/concepts/snapshot/) (closer to
   `bevy_save` than to anything else, but a first-class core
   primitive).
3. **Read [Engine patterns](/vibesmith-docs/reference/engine-patterns/).**
   The long-form Rosetta — covers the patterns we deliberately
   don't copy (across all the engines), with reasoning.
4. **Scaffold a project**: see
   [Quick start](/vibesmith-docs/getting-started/quick-start/).
   The scaffold's `main.tsx` already contains the rotating
   orange cube — the Bevy-101 task above is *already on screen*
   the first time you press Play.
5. **Install the [MCP integration](/vibesmith-docs/cookbook/install-mcp/)
   into your coding assistant.** The authoring loop assumes
   it.
6. **Read [Anti-patterns](/vibesmith-docs/anti-patterns/).** The
   "re-render in useFrame" trap and the "non-memoised JSX
   children" trap are the React equivalents of Bevy's
   "allocating in a per-frame system" anti-pattern; same hazard
   class, different surface.

## Cross-references

- [Positioning](/vibesmith-docs/positioning/) — the strategic
  bet + the Bevy-as-future-target framing.
- [Concepts](/vibesmith-docs/concepts/) — first-principles
  vocabulary.
- [Engine patterns](/vibesmith-docs/reference/engine-patterns/) —
  the full reference doc.
- [Principled non-features](/vibesmith-docs/principled-non-features/)
  — patterns we deliberately won't ship + reasoning.
- [Cookbook](/vibesmith-docs/cookbook/) — working code.
- [`engine-rosetta.json`](/vibesmith-docs/engine-rosetta.json) —
  the raw data your AI assistant can fetch.
