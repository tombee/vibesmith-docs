---
title: 'Animations'
description: 'Two distinct problems, two distinct solutions:'
---

Two distinct problems, two distinct solutions:

1. **Authored skeletal / morph animations** baked into a GLTF
   asset (idle, walk, run, attack, …) → Three's `AnimationMixer`
   + drei's `useAnimations`.
2. **Procedural transforms** with no animation data (camera
   moves, UI tweens, entity reactions, easing-driven motion) →
   `useFrame` with lerp or a spring helper.

Don't mix the two — authored animations come from the asset
pipeline; procedural motion is your code.

## GLTF skeletal animations (drei `useAnimations`)

```tsx
import { useAnimations, useGLTF } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import type { Group } from 'three';

export function Character({ stance }: { stance: 'idle' | 'walk' | 'run' }) {
  const group = useRef<Group>(null!);
  const { scene, animations } = useGLTF('/models/character.glb');
  const { actions, mixer } = useAnimations(animations, group);

  useEffect(() => {
    const next = actions[stance];
    if (!next) return;
    const prev = mixer.existingAction(mixer._actions[0]?.getClip());
    next.reset().fadeIn(0.2).play();
    return () => {
      next.fadeOut(0.2);
    };
  }, [stance, actions, mixer]);

  return <primitive ref={group} object={scene} />;
}

useGLTF.preload('/models/character.glb');
```

Key points:

- **Always wrap the GLTF scene** in a `<group ref>` and pass that
  ref to `useAnimations`. The mixer needs a root.
- **`fadeIn` / `fadeOut`** for crossfading clips. Linear cuts
  read as broken even on stylized characters.
- **`useGLTF.preload`** at module scope so the asset is loaded
  before the component first mounts.

### Per-bone control (look-at, IK targets)

After `useAnimations` plays a clip, you can still mutate
individual bones in `useFrame` for things like head-look-at:

```tsx
useFrame(() => {
  const head = group.current.getObjectByName('Head');
  if (!head || !target.current) return;
  head.lookAt(target.current.position);
  // Authored animation runs first (mixer.update inside
  // useAnimations); your overrides apply after. Use a useFrame
  // priority > 0 if you need to guarantee this ordering.
});
```

## Lerp (cheap, no library)

For simple "ease to target" motion (camera follow, UI panel
slide, color fade), lerp inside `useFrame`:

```tsx
import { useFrame } from '@react-three/fiber';
import { MathUtils } from 'three';

const TARGET = [0, 5, 10] as const;

export function FollowCam() {
  useFrame((state, dt) => {
    state.camera.position.x = MathUtils.damp(state.camera.position.x, TARGET[0], 4, dt);
    state.camera.position.y = MathUtils.damp(state.camera.position.y, TARGET[1], 4, dt);
    state.camera.position.z = MathUtils.damp(state.camera.position.z, TARGET[2], 4, dt);
  });
  return null;
}
```

`MathUtils.damp(current, target, lambda, dt)` is frame-rate
independent. The `lambda` constant controls speed; higher =
snappier.

## Springs (when you need overshoot / bounce)

`maath/easing` (no JSX dep) or `@react-spring/three` (JSX
springs). For most cases `maath` is enough:

```tsx
import { damp3 } from 'maath/easing';

useFrame((state, dt) => {
  damp3(group.current.position, target, 0.25, dt);
});
```

`damp3` handles vector-valued damping in one call; same idea as
`MathUtils.damp` but for `[x, y, z]`.

For React-driven springs (UI panels, mount/unmount easing) reach
for `@react-spring/three` — it integrates with React state.
Don't use it for per-frame transforms; it allocates.

## Watch out for

- **Don't animate via React state.** Setting state every frame
  triggers re-renders — see [anti-patterns.md](../anti-patterns.md#2-setting-react-state-every-frame).
- **Mixer needs `update(dt)`** every frame. `useAnimations` does
  this for you; if you build the mixer manually, call
  `mixer.update(delta)` in `useFrame`.
- **GLTF re-use:** drei's `useGLTF` returns the *same* scene
  reference for the same URL. If you mount two characters from
  one GLTF, the second steals the first's bones. Use
  `SkeletonUtils.clone(scene)` to deep-clone.
- **Per-frame lambda values feel different at 30 fps vs. 120 fps**
  if you do raw `current += (target - current) * 0.1`. Use
  `MathUtils.damp` or `damp3` so frame rate doesn't change feel.
- **`fadeIn` while another clip is fading out** can leave both
  partially blended. Always stop the previous clip cleanly
  (`prev.fadeOut(dt)`).

## When not to use

- One-off motion that runs once and never again — just set the
  transform directly; no animation system needed.
- Highly synchronized motion across many entities (e.g. wave
  effects across a field of grass) — instanced mesh + GPU
  attribute is faster than per-entity `useFrame`.

## Related

- [Anti-patterns](../anti-patterns.md#2-setting-react-state-every-frame)
- [Engine patterns](../reference/engine-patterns.md) — Unity Animator ↔
  AnimationMixer mapping.
- [Performance debugging](perf-debugging.md) — measuring mixer
  cost on entity-dense scenes.
