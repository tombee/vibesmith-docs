---
title: 'Instancing'
description: 'Render many copies of the same geometry as a single draw call. Mandatory once you have more than ~50 of the same object — trees, rocks, debris, projectiles,...'
---

Render many copies of the same geometry as a single draw call.
Mandatory once you have more than ~50 of the same object —
trees, rocks, debris, projectiles, prop clutter, NPC variants.

## When to use

- Same geometry, same material, many transforms.
- Per-instance variation is limited to: position, rotation,
  scale, color, and (with a custom shader) one or two extra
  attributes.

If you need per-object materials, per-object animations, or
deeply different geometry, instancing isn't the answer — split
into a small set of *types* and instance each type.

## The framework way — `defineInstancedKind` (start here)

Don't hand-roll a `<Instances>` wrapper or a raw `<instancedMesh>`
component for instanced content that belongs in your scene. The
framework primitive for *"N entities that share geometry +
material"* is **`defineInstancedKind`** from `@vibesmith/runtime` —
the instanced sibling of `defineSceneNodeKind`. You declare the
geometry / material / capacity **once**; the SceneRenderer collapses
every scene-node entry of that `kind` into a single
`THREE.InstancedMesh` (N entries = 1 draw call) while keeping each
entry **independently selectable, inspectable, and MCP-addressable**
in the scene tree. A hand-rolled `<Instances>` block is one opaque
React node the inspector, hierarchy, and selection can't see into.

```ts
// scripts/grass.ts
import { Matrix4, MeshStandardMaterial, PlaneGeometry, Vector3 } from 'three';
import { z } from 'zod';
import { defineInstancedKind } from '@vibesmith/runtime';

defineInstancedKind({
  id: 'acme/grass-blade',
  geometry: new PlaneGeometry(0.1, 0.6),
  material: new MeshStandardMaterial({ color: '#3b6b3b' }),
  maxInstances: 4096,
  params: z.object({
    position: z.tuple([z.number(), z.number(), z.number()]),
    rotation_y: z.number().default(0),
    scale: z.number().default(1),
  }),
  // Called once per entry per frame with a stable slot index, the
  // Zod-validated params, and a reusable Matrix4 you fill in place.
  updateInstance: (_slot, { position, rotation_y, scale }, m) => {
    m.makeRotationY(rotation_y)
      .scale(new Vector3(scale, scale, scale))
      .setPosition(position[0], position[1], position[2]);
  },
});
```

Then every entry of that `kind` in your [scene](/vibesmith-docs/concepts/scene/) JSON
batches into one draw call:

```jsonc
// scenes/main.scene.json
{
  "nodes": [
    { "id": "blade-0", "kind": "acme/grass-blade", "params": { "position": [0, 0, 0] } },
    { "id": "blade-1", "kind": "acme/grass-blade", "params": { "position": [1, 0, 0] } },
    { "id": "blade-2", "kind": "acme/grass-blade", "params": { "position": [2, 0, 0] } }
  ]
}
```

- `id` follows the `<owner>/<surface>` convention (same as scene-node
  kind / HUD / theme ids).
- `maxInstances` is pre-allocated at mount — Three's `InstancedMesh`
  doesn't grow — so pick the worst-case count. Overflow logs a
  one-time warning and the late entries stay un-rendered until
  earlier ones leave.
- `updateInstance` must be **deterministic** on `params` so snapshot
  scrubbing replays identically.

See the
[extending reference](/vibesmith-docs/reference/extending/) for
where `defineInstancedKind` sits among the consumer primitives, and
[engine patterns](/vibesmith-docs/reference/engine-patterns/) §
*Batched instanced kinds* for the `defineInstancedKind` vs
`defineSceneNodeKind` decision and the Unity / Godot / Unreal /
Bevy equivalents.

## The recipe way — curated instanced placement

For the common scatter / crowd cases, you don't even author the
placement by hand. The
[recipe library](/vibesmith-docs/reference/recipe-canon/) ships
production-shaped, tier-aware, snapshot-deterministic instanced
recipes — `vegetation-scatter`, `props-clutter`, `debris-rubble`,
`projectiles`, `crowd-agents`, `modular-kit` — each pairing a Zod
param schema (count / area / per-instance variation / seed), per-tier
instance caps wired to adaptive rendering, and a pure `place(...)`
reference fn. You supply the geometry + material (a kit-pack module,
a Synty tree, a character mesh) and wire the recipe's placement to
`defineInstancedKind`. Retrieve → adapt → validate beats hand-rolling
the scatter math:

```ts
import { findRecipes, getRecipe } from '@vibesmith/recipe-canon';

const matches = findRecipes('grass scatter across a meadow');
const scatter = getRecipe(matches[0].id); // e.g. 'vegetation-scatter'
```

## Escape hatches — raw R3F instancing

When you genuinely need instancing *outside* the scene-node model —
a transient effect that never belongs in the `.scene.json`, a
self-contained R3F component you're embedding, or an experiment —
the raw R3F paths below still work. Treat them as the escape hatch,
not the default: instances authored this way are **not** scene-tree
entries, so the inspector, hierarchy, selection, and MCP can't
address them.

### The drei way

`<Instances>` from `@react-three/drei` wraps the `InstancedMesh`
plumbing and lets you author instances declaratively.

```tsx
import { Instances, Instance } from '@react-three/drei';

export function PropClutter({ placements }: { placements: Placement[] }) {
  return (
    <Instances limit={placements.length} range={placements.length}>
      <boxGeometry />
      <meshStandardMaterial />
      {placements.map((p) => (
        <Instance
          key={p.id}
          position={[p.x, p.y, p.z]}
          rotation={[0, p.yaw, 0]}
          scale={p.scale}
          color={p.tint}
        />
      ))}
    </Instances>
  );
}
```

- `limit` is the maximum instance count the underlying buffer
  allocates; pick a number you won't exceed.
- `range` is how many of those instances are currently rendered;
  set to the live count.
- `color` is per-instance via `<Instance>`'s prop; drei sets up
  the instanced color attribute automatically.

### The raw Three way

When drei's declarative `<Instance>` doesn't cover your needs
(e.g. you want to push updates from `useFrame` without
re-rendering React), reach for `<instancedMesh>` directly.

```tsx
import { useRef, useEffect } from 'react';
import { InstancedMesh, Object3D } from 'three';
import { useFrame } from '@react-three/fiber';

const tmpObj = new Object3D(); // hoisted; reused every frame

export function FlockOfEntities({ count }: { count: number }) {
  const ref = useRef<InstancedMesh>(null!);

  useEffect(() => {
    for (let i = 0; i < count; i++) {
      tmpObj.position.set((i % 10) - 5, 0, Math.floor(i / 10) - 5);
      tmpObj.updateMatrix();
      ref.current.setMatrixAt(i, tmpObj.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  }, [count]);

  useFrame((_, dt) => {
    for (let i = 0; i < count; i++) {
      ref.current.getMatrixAt(i, tmpObj.matrix);
      tmpObj.matrix.decompose(tmpObj.position, tmpObj.quaternion, tmpObj.scale);
      tmpObj.rotation.y += dt;
      tmpObj.updateMatrix();
      ref.current.setMatrixAt(i, tmpObj.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <coneGeometry args={[0.3, 0.6, 8]} />
      <meshStandardMaterial color="orange" />
    </instancedMesh>
  );
}
```

Key points:

- **Hoist the `tmpObj`** outside the component (or at module
  scope). Reusing it avoids per-frame allocation — see the
  allocation anti-pattern in [anti-patterns.md](../anti-patterns.md#1-allocating-per-frame-in-useframe).
- **`instanceMatrix.needsUpdate = true`** every frame you mutate
  matrices. Forgetting this is the #1 silent failure.
- **The third `args` slot** is the max instance count. Allocate
  for your peak.

## Per-instance colors

Three supports per-instance colors via `instanceColor`. drei sets
this up automatically; for raw `<instancedMesh>`, attach a
`Float32Array` of `count * 3` and set `instanceColor.needsUpdate`.

## Watch out for

- **Frustum culling is per-mesh, not per-instance.** The whole
  instanced mesh is culled or kept as a unit. If your instances
  span a huge area, the GPU still processes off-screen ones —
  split into a grid of instanced meshes covering localized
  regions if this matters.
- **Shadow casting on instances** doubles the per-frame matrix
  work (one pass per light). Budget for it.
- **`InstancedMesh` does not support per-instance materials.**
  If two prop variants need different shaders, that's two
  `InstancedMesh`es, not one with a uniform branch.
- **Don't `setMatrixAt` every frame for static instances.** If
  positions are fixed, set once in `useEffect` and leave the
  buffer alone.

## When not to use

- Fewer than ~20 instances — overhead isn't worth it.
- Each instance needs unique animation — use individual meshes
  + skeletal animation instead.
- Instances are not visible at the same time (paged worlds) —
  load + unload meshes per region instead.

## Related

- [How to extend vibesmith](/vibesmith-docs/reference/extending/) —
  where `defineInstancedKind` sits among the consumer primitives.
- [Engine patterns](/vibesmith-docs/reference/engine-patterns/) §
  *Batched instanced kinds* — `defineInstancedKind` vs
  `defineSceneNodeKind` + Unity / Godot / Unreal / Bevy equivalents.
- [Recipe canon](/vibesmith-docs/reference/recipe-canon/) — the
  curated instanced-placement recipes (vegetation / props / debris /
  projectiles / crowds / kits).
- [Performance debugging](perf-debugging.md) — verifying the
  draw-call reduction with `gl.info`.
- [Anti-patterns](../anti-patterns.md#1-allocating-per-frame-in-useframe)
- [Performance budgets](../reference/performance-budgets.md) — instance
  count vs. triangle budget calculus.
