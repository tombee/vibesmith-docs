---
title: 'Animation runtime — state machine, blend trees, and the Animator scene-node'
description: 'Track N1 runtime engine: state graph + parameter store + blend tree + curve evaluator above Three.AnimationMixer. <Animator> scene-node component, ctx.animator(id) parameter bindings on defineGameScript, scenario serializer for deterministic replay.'
---

> **Framework. Game-agnostic.** Animation is exposed to consumer
> projects as a single declarative surface — `<Animator>` on a
> scene node + a state graph authored as data. The framework
> orchestrates Three's `AnimationMixer` underneath; consumers
> never write mixer-and-state-machine glue.

The framework owns four things: the **animation graph** (states,
transitions, blend trees, additive layers, parameters), the
**`<Animator>` scene-node component** that mounts the graph
against a `THREE.Object3D`, the **`ctx.animator(id)` parameter
binding** on `defineGameScript`, and the **scenario serializer**
that captures animator state for deterministic replay. Three's
clip / keyframe sampling stays underneath.

---

## Quick start

```tsx
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Animator } from '@vibesmith/animation-runtime/react';
import {
  defineAnimationGraph,
  blend1D,
  clipState,
} from '@vibesmith/animation-runtime';
import { defineGameScript } from '@vibesmith/runtime';
import { useMemo, useRef } from 'react';

const locomotionGraph = defineAnimationGraph({
  id: 'character',
  clips: {
    idle: 'character/idle',
    walk: 'character/walk',
    run: 'character/run',
    jump: 'character/jump',
  },
  parameters: {
    speed: { type: 'float', default: 0, range: [0, 1] },
    onGround: { type: 'bool', default: true },
  },
  states: [
    blend1D('locomotion', 'speed', [
      { at: 0.0, clip: 'idle' },
      { at: 0.5, clip: 'walk' },
      { at: 1.0, clip: 'run' },
    ]),
    clipState('airborne', 'jump'),
  ],
  transitions: (t) => [
    t.from('locomotion').to('airborne').when((p) => p.onGround.eq(false)).fade(0.15),
    t.from('airborne').to('locomotion').when((p) => p.onGround).fade(0.20),
  ],
  entry: 'locomotion',
});

defineGameScript({
  id: 'character-controller',
  onTick: (ctx, dt) => {
    const speed = readSpeed(ctx);
    const grounded = readGrounded(ctx);
    const animator = ctx.animator?.('character');
    if (!animator) return;
    animator.set('speed', speed);
    animator.set('onGround', grounded);
  },
});

function Character() {
  const { scene, animations } = useGLTF('/character.glb');
  const clips = useMemo(
    () => ({
      idle: animations.find((c) => c.name === 'Idle')!,
      walk: animations.find((c) => c.name === 'Walk')!,
      run: animations.find((c) => c.name === 'Run')!,
      jump: animations.find((c) => c.name === 'Jump')!,
    }),
    [animations],
  );
  return (
    <>
      <primitive object={scene} />
      <Animator object={scene} graph={locomotionGraph} clips={clips} />
    </>
  );
}
```

The character animates at 60Hz with idle→walk→run blending as
`speed` rises and crosses into the jump state when `onGround`
flips false. No `AnimationMixer.clipAction` calls, no manual
`crossFadeTo`, no per-frame weight bookkeeping.

---

## The two parts that matter

### The graph

A **graph** is the data the runtime evaluates. It lists:

- **`clips`** — a map from graph-local clip ids to asset paths
  (resolved by the consumer at `<Animator>` mount time).
- **`parameters`** — typed bag the consumer's `defineGameScript`
  writes to. Three kinds: `float` (with optional range),
  `bool`, `trigger` (one-shot signal consumed once).
- **`states`** — what the animator can be in. `clipState` plays
  one clip; `blend1D` maps a float parameter to a weighted blend
  across N clips. `blend2D` and additive layers ship in slice 4.
- **`transitions`** — `from` → `to` with a `when` predicate and
  a `fade` duration. Predicates use a method DSL since JS can't
  intercept `!` / `<`: `p.onGround`, `p.onGround.eq(false)`,
  `p.speed.lt(0.1)`, `p.speed.gt(0.5).and(p.onGround)`.
- **`entry`** — the state the animator starts in.

Graphs round-trip losslessly between the TypeScript factory and
JSON via the canonical schema (`vibesmith/animation-graph@1`).
`loadAnimationGraph(json)` parses the JSON form; saving the
factory output is `JSON.stringify(graph)`. Hand-authored JSON
accepts a sugar `when` form (`{ param: 'onGround', is: false }`
/ `{ trigger: 'attack' }`) that the loader expands to the
internal AST.

### The component

`<Animator>` is the scene-node surface. Place it as a sibling
of the mesh it animates:

```tsx
<group ref={characterRef}>
  <primitive object={skinnedMesh} />
  <Animator
    object={skinnedMesh}
    graph={locomotionGraph}
    clips={resolvedClips}
    parameters={{ speed, onGround }}
  />
</group>
```

Props:

- **`object`** — the `THREE.Object3D` the mixer drives. Usually
  a `SkinnedMesh` or a `Group` containing one.
- **`graph`** — the in-memory graph from
  `defineAnimationGraph(...)` or `loadAnimationGraph(json)`.
- **`clips`** — record or function mapping graph clip-ids to
  `THREE.AnimationClip` instances. Typically destructured from
  `useGLTF`'s `.animations` array.
- **`parameters`** *(optional)* — declarative writes applied on
  every render. Convenient for HUD-controlled sliders and dev
  panels; for per-frame writes, prefer `ctx.animator(id).set`
  in `defineGameScript`.

The component registers itself with the framework's animator
scheduler so `ctx.animator(id)` resolves and the scenario
snapshot probe can enumerate live animators by id.

---

## Parameter bindings via `defineGameScript`

The recommended write path is `ctx.animator(id).set` — it
mutates the parameter store without forcing a re-render, and
ties parameter writes to the same frame loop as input + physics.

```ts
defineGameScript({
  id: 'character-controller',
  onTick: (ctx, dt) => {
    const animator = ctx.animator?.('character');
    if (!animator) return;
    animator.set('speed', clamp01(currentSpeed(ctx)));
    animator.set('onGround', ctx.physics?.isGrounded(ctx.object3D) ?? true);
    if (justPressedAttack(ctx)) animator.trigger('attack');
  },
});
```

The handle:

| Method                      | What it does                                                 |
| --------------------------- | ------------------------------------------------------------ |
| `.set(name, value)`         | Write a float / bool parameter.                              |
| `.trigger(name)`            | Fire a trigger; consumed exactly once.                       |
| `.get(name)`                | Read current value.                                          |
| `.state()`                  | Read the current state id + blend factors + parameters.      |
| `.detach()`                 | Release; the framework auto-detaches on script unmount too.  |

Type errors are surfaced at `.set` time:
`animator.set('speed', true)` throws because `speed` is
declared `float`. The slice-3 type errors are runtime;
slice-3+ adds the `vibesmith gen anim-types` codegen step that
upgrades these to compile errors against the consumer's graph
declarations.

---

## Predicate authoring

Lambda predicates use a method-based DSL because JS operator
overloading is unavailable:

```ts
transitions: (t) => [
  // bare bool / trigger access
  t.from('idle').to('walking').when((p) => p.movePressed).fade(0.1),
  t.from('grounded').to('airborne').when((p) => p.onGround.eq(false)).fade(0.15),

  // comparisons
  t.from('walking').to('running').when((p) => p.speed.gt(0.7)).fade(0.2),

  // compounds
  t.from('any').to('crouch').when(
    (p) => p.crouchHeld.and(p.onGround)
  ).fade(0.1),
],
```

The supported set: `.eq` / `.neq` / `.lt` / `.lte` / `.gt` /
`.gte`, `.not()`, `.and(other)` / `.or(other)`, `.fired()`. For
richer predicates that don't fit the lambda shape, import
`whenExpr` and build the AST imperatively:

```ts
import { whenExpr } from '@vibesmith/animation-runtime';
{ from: 'a', to: 'b', when: whenExpr.lt('speed', 0.1), fade: 0.05 }
```

Anything beyond this subset belongs in `defineGameScript`
driving parameters — keep the graph declarative.

---

## Scenarios + replay

The animator's logical state (current state, blend factors,
parameter values, transition phase) lands in the scenario
snapshot via `registerAnimatorProbe` from `@vibesmith/r3f-probes`:

```ts
import { registerAnimatorProbe } from '@vibesmith/r3f-probes';

registerAnimatorProbe();
```

On scenario load, the framework restores the captured state
before the first tick and steps with `dt=0` so action weights
take effect on the first render. The determinism contract:
**same graph + same parameter sequence + same `dt` sequence ⇒
same output**. The graph evaluator has no internal RNG and no
wall-clock reads; transition timers tick from a stored phase
value.

Mid-clip exact-frame replay (frame-by-frame bug repros that
need the precise mixer time) is opt-in via the snapshot's
`captureClipTime: true` flag; default-off because the common
scenario use cases don't need it and it bloats the JSON.

---

## Blend trees

Three primitives cover locomotion + simple combat:

- **`blend1D(id, parameter, samples)`** — one float parameter
  selects a weighted mix across N clips. The canonical idle →
  walk → run blend by speed.
- **`blend2D(id, [paramX, paramY], samples)`** — two floats
  select a mix across a 2D sample grid. Sample points can be
  scattered freely; the runtime uses inverse-distance-squared
  weighting so authors don't need to triangulate by hand.
  Sitting exactly on a sample point pins it at weight 1.
- **`additive` layers** — curve recipes or additive clips that
  composite on top of the active base state. Recoil shakes,
  upper-body action over lower-body locomotion, parameter-driven
  procedural rotations.

## Curve recipes

Curves are framework-owned procedural samplers for transforms
that don't fit Three's clip system — lookat, recoil, lean, bob,
parameter-driven bone rotation. Register a curve once at startup
and reference it from any animation graph's additive layer:

```ts
import { defineCurve } from '@vibesmith/animation-runtime';

defineCurve('curves/recoil-shake', {
  duration: 0.4,            // triggered
  output: 'vec3',
  sample: ({ t, progress, params }) => {
    const intensity =
      typeof params.intensity === 'number' ? params.intensity : 1;
    const decay = 1 - progress;
    return [
      Math.sin(t * 60) * decay * intensity,
      0,
      Math.cos(t * 40) * decay * intensity * 0.5,
    ];
  },
});

defineCurve('curves/lean-into-turn', {
  duration: 'continuous',   // never auto-releases
  output: 'quat',
  sample: ({ params }) => {
    const steering =
      typeof params.steering === 'number' ? params.steering : 0;
    const angle = -steering * 0.35;
    const half = angle * 0.5;
    return [0, 0, Math.sin(half), Math.cos(half)];
  },
});
```

Two duration modes:

- **Triggered** (`duration: <seconds>`) — fires on a trigger
  parameter; auto-releases after `duration`. One-shot impulses.
- **Continuous** (`duration: 'continuous'`) — always evaluated
  while the layer is active; pure function of parameters.

The animator's evaluator surfaces the most-recent sample for
each active curve layer via `evaluator.readAdditiveCurveSamples()`.
Consumers apply the output to the bone / `Object3D` / material
uniform named in the layer spec.

## Worked example

`examples/animation-locomotion/` in the framework repo wires the
full primitive set against a single character:

- `animation/character.anim.ts` — graph with blend1D (idle →
  walk → run by speed), blend2D (strafe locomotion across a
  5-point grid), transitions (locomotion ⇄ strafe, locomotion →
  airborne when `onGround` flips false), and two additive curve
  layers (recoil + lean-into-turn).
- `recipes/curves.ts` — `defineCurve(...)` registrations for the
  layers the graph references.
- `scripts/character-controller.ts` — `defineGameScript` that
  reads input + physics and writes the animator parameters each
  tick via `ctx.animator?.('character-locomotion').set(...)`.

The companion fixture test
(`packages/animation-runtime/src/locomotion.fixture.test.ts`)
drives the same graph headlessly and asserts the primitive set
composes end-to-end (deterministic replay, snapshot round-trip).

## What's deferred

Sub-state-machines, avatar masks, and inverse-kinematics rigs
are explicit non-goals at this level — covered by escalation
paths in `engine-patterns.md` § "Animation state machine" until
two consumers converge on the same shape.

---

## Cookbook

See [`cookbook/animation-locomotion`](../cookbook/animation-locomotion)
for a fuller worked walk → run → jump pattern with a turn-in-place
sub-state. See `engine-patterns.md` § "Animation state machine"
for when to reach beyond the framework primitives.
