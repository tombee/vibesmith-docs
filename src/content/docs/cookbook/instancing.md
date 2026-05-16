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

## The drei way (recommended)

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

## The raw Three way

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

- [Performance debugging](perf-debugging.md) — verifying the
  draw-call reduction with `gl.info`.
- [Anti-patterns](../anti-patterns.md#1-allocating-per-frame-in-useframe)
- [Performance budgets](../reference/performance-budgets.md) — instance
  count vs. triangle budget calculus.
