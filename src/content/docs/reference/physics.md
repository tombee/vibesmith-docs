---
title: 'Physics — the rigid-body contract, scene binding, and adapters'
description: 'Pluggable physics adapter contract. Declarative <PhysicsScene> + <RigidBody> R3F components, ctx.physics query + mutation surface on defineGameScript, scenario capture + replay, Rapier as the default reference adapter.'
---

> **Framework. Game-agnostic.** Physics is exposed to consumer
> projects as a single contract — game code talks to the
> framework's typed surface, never to a specific physics engine.
> Rapier ships as the default reference adapter; Cannon-es ships
> as the contract-test second-impl. Other engines (Havok-WASM,
> Jolt-WASM, native engines compiled to WebAssembly) are
> consumer-shipped adapters following the same contract.

The framework owns four things: the `definePhysics({ id, world,
step, raycast, query })` factory, the `<RigidBody>` scene-graph
component, the `ctx.physics` query + mutation surface, and the
scenario capture / replay format. The adapter owns the simulation
kernel.

---

## Quick start

```tsx
import { PhysicsScene, RigidBody } from '@vibesmith/physics';
import {
  adapter,
  config,
  initRapier,
} from '@vibesmith/physics-adapter-rapier';
import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';

function Game() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    initRapier().then(() => setReady(true));
  }, []);
  if (!ready) return null;
  return (
    <Canvas>
      <PhysicsScene adapter={adapter} config={config}>
        <RigidBody type="static">
          <mesh position={[0, -1, 0]}>
            <boxGeometry args={[50, 1, 50]} />
            <meshStandardMaterial color="gray" />
          </mesh>
        </RigidBody>

        <RigidBody
          type="dynamic"
          colliders="ball"
          mass={1}
          userData={{ entityId: 'ball-01' }}
        >
          <mesh position={[0, 5, 0]}>
            <sphereGeometry args={[0.5]} />
            <meshStandardMaterial color="orange" />
          </mesh>
        </RigidBody>

        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} />
      </PhysicsScene>
    </Canvas>
  );
}
```

That's enough to drop a ball on a static floor under gravity. The
adapter advances the simulation at a framework-owned fixed 60 Hz;
`<RigidBody>` reads back the dynamic body's transform onto its
parent `<group>` after each step batch.

If you scaffold your project with `vibesmith init` and register
the adapter via `definePhysics(...)` in your entry script, the
binary mounts `<PhysicsScene>` automatically — you only write
`<RigidBody>` declarations.

---

## `<PhysicsScene>`

One per R3F `<Canvas>`. Owns the world, the fixed-step
accumulator, the entity-id registry, and the read-back fan-out
that drives `<RigidBody>` transform updates.

```tsx
<PhysicsScene
  adapter={adapter}
  config={config}
  fixedHz={60}                  // optional, default 60
  maxSubstepsPerFrame={8}       // optional, default 8 (spiral-of-death cap)
>
  {/* … <RigidBody> children … */}
</PhysicsScene>
```

The component holds the world for the lifetime of the mount. On
unmount, the entity registry clears and the adapter's GC reclaims
the world. Re-mounts construct a fresh world; physics state does
not persist across remounts unless you capture and restore a
scenario.

### Fixed-step rate

Default 60 Hz. Override via `fixedHz` for game-feel tuning. The
framework owns the accumulator and feeds each substep into the
adapter as `step(world, fixedDt)`. Adapters never see variable
dt.

### Substep cap

`maxSubstepsPerFrame` (default 8) caps how many substeps the
accumulator runs in a single frame. Without it, a slow frame
(tab hidden, debugger paused) queues hundreds of substeps and
the resume frame collapses — the well-known spiral-of-death.
The cap converts excess wall-clock into simulation pause silently.

---

## `<RigidBody>`

Declarative wrapper that gives any subtree a body + collider.

```tsx
<RigidBody
  type="dynamic"                       // 'static' | 'kinematicPosition' | 'kinematicVelocity' | 'dynamic'
  colliders="cuboid"                   // 'cuboid' | 'ball' | 'capsule' | 'trimesh' | 'hull' | { shape } | false
  mass={1}
  linearDamping={0.05}
  angularDamping={0.05}
  gravityScale={1}
  ccd={false}
  lockedAxes={{ rotX: true, rotZ: true }}
  position={[0, 5, 0]}
  rotation={{ x: 0, y: 0, z: 0, w: 1 }}
  linearVelocity={{ x: 0, y: 0, z: 0 }}
  angularVelocity={{ x: 0, y: 0, z: 0 }}
  userData={{ entityId: 'crate-07' }}
>
  <mesh>
    <boxGeometry args={[1, 1, 1]} />
    <meshStandardMaterial color="orange" />
  </mesh>
</RigidBody>
```

### Body types

| Type | Who writes the transform | Honours forces | Use |
|------|--------------------------|----------------|-----|
| `static` | Author at construction; never updates. | No | Level geometry, walls, immovable colliders. |
| `kinematicPosition` | Game script via `ctx.physics.setBodyPose(...)`. | No | Animated platforms, scripted character controllers. |
| `kinematicVelocity` | Script writes a target velocity; engine integrates. | No | Velocity-driven hazards, smooth scripted motion. |
| `dynamic` | The engine. | Yes | Projectiles, debris, ragdolls — anything that obeys gravity + impulse. |

### Collider shape

The `colliders` prop accepts a string for a default shape (the
framework picks unit half-extents) or an explicit
`{ shape }` object for non-defaults / trimesh / hull. Pass
`false` to create a body without a collider (rare).

### Entity id

`userData.entityId` is the stable handle game code uses with
`ctx.physics.applyImpulse('crate-07', ...)`. Without it,
`<RigidBody>` still creates the body — but queries still see it
(via the body handle in their hit result), and you lose the
entity-id-keyed mutation surface.

---

## `ctx.physics` — queries + mutations from game scripts

`defineGameScript` ticks receive a `ctx.physics?: PhysicsHandle`.
It's present when a `<PhysicsScene>` is active; otherwise
undefined.

```ts
import { defineGameScript } from '@vibesmith/runtime';

defineGameScript({
  id: 'shooter',
  onTick(ctx, dt) {
    const physics = ctx.physics;
    if (!physics) return;

    const hit = physics.raycast(
      { x: 0, y: 1.5, z: 0 },
      { x: 0, y: 0, z: -1 },
      { maxDistance: 50 },
    );
    if (hit) {
      console.log(`hit ${hit.entityId} at ${hit.distance}`);
    }

    // Shove a crate.
    physics.applyImpulse('crate-07', { x: 5, y: 0, z: 0 });
  },
});
```

### Query surface

| Method | Returns |
|--------|---------|
| `raycast(origin, direction, opts?)` | `RaycastHit \| null` |
| `overlap(shape, opts?)` | `readonly QueryHit[]` |
| `shapeCast(cast, opts?)` | `ShapeCastHit \| null` |

Queries are read-only. The discriminated `ShapeQuery` covers
AABB and sphere overlap; `ShapeCast` covers cuboid + ball
shape-casts (other shapes fall back to a bounding ball on the
Rapier adapter).

### Mutation surface

| Method | What it does |
|--------|--------------|
| `applyImpulse(entityId, impulse, point?)` | One-shot velocity change. |
| `applyForce(entityId, force, point?)` | Per-step force; integrate continuously by calling each tick. |
| `setLinearVelocity(entityId, v)` | Overwrites linear velocity. |
| `setAngularVelocity(entityId, w)` | Overwrites angular velocity. |
| `setBodyPose(entityId, { position, rotation })` | Teleport. Use on `kinematicPosition` bodies; on `dynamic` bodies it desyncs the physics state and triggers a dev-warning. |

All mutation calls are entity-id-keyed. Unknown ids warn-once and
noop (a body may have unmounted last frame; throwing would make
scripts brittle to teardown ordering).

### Clock

`ctx.physics.stepIndex` is a monotonic step counter; `ctx.physics.fixedDt`
is the configured step rate. Read both for simulation-frequency-
independent logic.

---

## Frame order

Per frame the framework dispatches:

1. **Input + intent dispatch** — HUD events → game scripts.
2. **`defineGameScript` `onTick(ctx, dt)`** — game scripts run.
   This is where `ctx.physics` mutations should fire.
3. **Physics fixed-step substeps** — the accumulator dispatches
   zero or more `adapter.step(world, fixedDt)` calls.
4. **Transform read-back** — `<RigidBody>` reads dynamic +
   kinematicVelocity bodies' poses onto their parent `<group>`.
5. **R3F render** — canonical R3F frame.

Static + kinematicPosition bodies don't read back automatically;
the scene-tree write is authoritative for them.

---

## Scenario capture + replay

`Scenario` (per [scenario-driven-dev](scenario-driven-dev/)) gains
an optional `physics` field:

```ts
import type { Scenario } from '@vibesmith/scenario-driven-dev';

const scenario: Scenario = {
  schemaVersion: 1,
  meta: { /* … */ },
  game: { /* per-project shape */ },
  rngSeed: 42,
  clockMs: -1,
  physics: {
    adapterId: 'rapier',
    adapterVersion: '0.1.0',
    stepIndex: 1234,
    worldState: /* adapter-owned blob */,
    bodyCount: 17,
    pendingImpulseCount: 0,
  },
};
```

The framework refuses to restore a snapshot whose `adapterId` or
`adapterVersion` doesn't match the active adapter — same-adapter
+ same-version replay is the contract; cross-adapter / cross-
version is not.

### Determinism, in plain English

The framework promises:

- Same adapter version + same captured snapshot + same script
  inputs ⇒ same simulation trace, replayable to the step.
- Fixed timestep — no variable-dt drift across replays.
- RNG seed is part of the scenario — `rngSeed` carries through
  to any randomness the adapter or scripts consume.

The framework does **not** promise:

- Cross-engine determinism (Rapier ≠ Cannon-es).
- Cross-architecture determinism (float fused-multiply-add
  semantics differ across CPU microarchitectures).
- Cross-adapter-version determinism within an adapter.

---

## Adapter packages

`@vibesmith/physics-adapter-rapier` is the default. To use it,
register it in your project's entry script:

```ts
import { definePhysics } from '@vibesmith/runtime';
import { adapter, config, initRapier } from '@vibesmith/physics-adapter-rapier';

await initRapier();   // one-shot WASM init
definePhysics(config);
```

The binary picks up the registration on project open and mounts
`<PhysicsScene>` automatically with the registered adapter +
config. `<RigidBody>` declarations in the scene tree just work.

Other adapter packages (Cannon-es, Havok-WASM, Jolt-WASM) follow
the same shape — `adapter`, `config`, optional `init*()` for
async setup. All ship as separate `@vibesmith/physics-adapter-*`
packages outside the framework core.

---

## Tier-A discipline

Per the framework's abstraction discipline, **engine-native types
never leak into game code**. You import from `@vibesmith/physics`
(`<RigidBody>`, `<PhysicsScene>`, `PhysicsHandle` type) and from
`@vibesmith/runtime` (`definePhysics`, `ctx.physics`). Direct
imports from `@dimforge/rapier3d-compat`, `cannon-es`, or other
engine packages are confined to the adapter packages — game code
that reaches around the contract gets flagged by the
`dependency-boundary-critic` agent (when it lands).

This is the same shape `@vibesmith/networking` uses for transport
adapters: pick an engine, swap when reassess triggers fire, no
project-wide migration.
