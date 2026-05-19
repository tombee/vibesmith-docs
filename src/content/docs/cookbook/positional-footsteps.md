---
title: 'Positional footsteps with mid-cycle pitch jitter'
description: 'Wire 3D footsteps from animation events through the audio runtime — manifest registration, R3F binding, listener sync, seeded pitch jitter for deterministic scenario replay.'
---

End-to-end recipe for 3D positional footsteps. Composes the
manifest layer, the emitter component, listener sync, and the
seeded RNG. Same shape works for any per-step or per-impact
sound — swap the manifest keys for `sfx.hit.metal.*`,
`sfx.click.*`, etc.

## The shape

1. **Manifest** carries the footstep variants (3 per surface
   type is typical — your ear catches dead-on repetition
   instantly).
2. **`<Footsteps>`** binds an animation event source to the
   audio runtime. Pass `getPosition` so it follows the carrying
   node; pass `rng` so the variant picker is scenario-deterministic.
3. **`<ListenerSync />`** on the camera, once per scene.
4. **Optional duck** so footsteps don't fight dialogue.

## Minimum-viable wiring

```tsx
import { Canvas } from '@react-three/fiber';
import { useAudio } from '@vibesmith/audio-runtime';
import { ListenerSync } from '@vibesmith/audio-runtime/r3f';
import { Footsteps } from '@vibesmith/audio-runtime/fixtures/footsteps-r3f';
import { useStepEvents } from './your-animation-bridge';

export function CharacterAudio({ rng }: { rng: () => number }) {
  const subscribe = useStepEvents();
  return (
    <Footsteps
      onStep={(cb) => subscribe(cb)}
      rng={rng}
      pitchJitterSemitones={1}
    />
  );
}

export function Scene() {
  const audio = useAudio();

  // optional: duck music under dialogue (one-liner)
  useEffect(() => {
    return audio.bus('dialogue').onPlay(() =>
      audio.bus('music').duck({
        targetDb: -12, attackMs: 200, holdMs: 0, releaseMs: 600,
      }),
    );
  }, [audio]);

  return (
    <Canvas>
      <ListenerSync />
      <Character>
        <CharacterAudio rng={Math.random} />
      </Character>
    </Canvas>
  );
}
```

The `Footsteps` component registers the bundled
`FOOTSTEP_MANIFEST` automatically on mount. If your project
already registers a manifest containing your own variants
(`sfx.footstep.grass.1`, `sfx.footstep.snow.1`, etc.), pass
`variantKeys` to point at them instead.

## Animation event source

The animation layer fires a callback every time the foot plants.
The shape:

```ts
// your-animation-bridge.ts
import { useEffect, useRef, useCallback } from 'react';

type StepCallback = () => void;

export function useStepEvents() {
  const subscribers = useRef(new Set<StepCallback>());
  // wire to your AnimationMixer's 'footstep' annotation
  // (Blender → NLA strip → marker) — the exact path depends on
  // your character pipeline.
  return useCallback((cb: StepCallback) => {
    subscribers.current.add(cb);
    return () => {
      subscribers.current.delete(cb);
    };
  }, []);
}
```

vibesmith's animation runtime (Track N1) exposes a parameter
binding for this — `ctx.animator(id).on('footstep', cb)` — when
the consumer adopts it. Until then, wire it from your existing
animation event source.

## Why seeded RNG matters

The variant picker (`Math.floor(rng() * variants.length)`) reads
from the RNG you pass in. Pass `Math.random` for live play; pass
`scenario.rng()` (from `@vibesmith/scenario-driven-dev`) for
scenario captures. Two launches of the same scenario then
produce the same footstep sequence — which is what
deterministic scenario replay needs.

## Inspecting the live audio

The dev shell's **Audio** panel lists every active emitter, its
bus, gain, and playback offset. Open it via `Window → Audio`.
Each footstep shows up briefly as a `sfx.footstep.stone.*` row;
the bus sliders below let you mute / solo for triage.

## Performance

A 320 ms one-shot fires + completes well within the LOW-tier
16-concurrent-emitter ceiling — typical use sits at 2 active
emitters mid-step. The decoded-buffer cache is hash-keyed:
three variants share three decoded buffers regardless of how
many characters are walking.

## Reference

- [Audio runtime](/reference/audio-runtime/) — the full
  framework substrate this cookbook entry uses.
