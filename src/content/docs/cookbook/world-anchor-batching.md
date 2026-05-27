---
title: 'Batching world-space anchors'
description: 'Project N world positions to DOM in one pass with WorldAnchorList — hit-testing layers, E2E selectors, debug overlays.'
---

`WorldAnchor` projects one 3D world position to one DOM element each
frame. That works great for a handful of nameplates / waypoints, but
once you have N entities to track — a hit-testing layer for mobile
pointer events, stable `data-id` hooks for E2E tests, debug overlays
across a crowd — N copies of `<WorldAnchor>` cost N React subtrees +
N `useFrame` subscriptions.

`WorldAnchorList` is the batched variant.

## When to use

- N > ~20 world-space DOM anchors driven from the same camera.
- The DOM nodes are mostly invisible (hit-testing, selectors, debug)
  or visually identical (same nameplate shape, just different ids).
- The set of tracked entities changes over time and you want
  cheap React diff on add / remove.

If you have a handful of one-off labels with different React subtrees
each, stay on `<WorldAnchor>` — the per-entity ergonomics are better
and the batching cost doesn't pay off below ~10–20 entries.

## The recipe

```tsx
import { useThree, useFrame } from '@react-three/fiber';
import { WorldAnchorList } from '@vibesmith/runtime';

interface HitTargetLayerProps {
  // id → world position; comes from the game's entity store
  positions: Map<string, [number, number, number]>;
  onSelect: (id: string) => void;
}

export function HitTargetLayer({ positions, onSelect }: HitTargetLayerProps) {
  const { camera, size } = useThree();
  return (
    <WorldAnchorList
      entries={positions}
      camera={camera}
      viewport={{ width: size.width, height: size.height }}
      useFrame={useFrame}
      renderItem={(id) => (
        <div
          data-entity-id={id}
          style={{
            width: 48,
            height: 48,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'auto',
            cursor: 'pointer',
          }}
          onPointerDown={() => onSelect(id)}
        />
      )}
    />
  );
}
```

- **One `useFrame` subscription** drives projection for every entry.
- **One scratch `Vec3` allocation** is reused across the batch.
- **Per-frame writes go straight to `style.transform`** via internal
  DOM refs — no React re-render per frame.
- **React keys are the ids in the Map**, so adding or removing
  entries triggers only the corresponding fiber-mount / unmount.

## Container-driven viewport (single ResizeObserver)

If your layer is mounted inside a sized container rather than the
window viewport, hand the list a `containerRef`. It installs a single
`ResizeObserver` for the whole batch and ignores the `viewport` prop:

```tsx
import { useRef } from 'react';

export function ContainedHitLayer({ positions }: { positions: Map<string, [number, number, number]> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { camera } = useThree();
  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}>
      <WorldAnchorList
        entries={positions}
        camera={camera}
        containerRef={containerRef}
        useFrame={useFrame}
        renderItem={(id) => <div data-entity-id={id} />}
      />
    </div>
  );
}
```

## Per-entry `screenRect`

The `renderItem` callback also receives the latest projection result:

```ts
renderItem={(id, rect) => (
  <div
    data-entity-id={id}
    data-offscreen={rect.isOffscreen ? '' : undefined}
    data-behind={rect.isBehind ? '' : undefined}
    style={{ opacity: rect.isBehind ? 0.3 : 1 }}
  />
)}
```

`rect` carries `{ x, y, z, isBehind, isOffscreen }` for the most
recent frame as of React commit time. Per-frame DOM writes still run
through `style.transform` regardless — `rect` is the once-per-render
readout for badges, debug overlays, and conditional styling.

## Behind-camera + clamp policies

Same shape as `WorldAnchor`:

```tsx
<WorldAnchorList
  entries={positions}
  camera={camera}
  viewport={viewport}
  useFrame={useFrame}
  behind="fade"             // 'visible' | 'hidden' | 'fade'
  clamp={{ mode: 'edge' }}  // keep entries on-screen at the viewport edge
  offset={{ y: -24 }}       // nudge each entry 24px up from its projection
  renderItem={(id) => <Nameplate id={id} />}
/>
```

Each entry's `display` / `opacity` / `transform` are written
independently, so the policy applies per entry without a per-entity
React node.

## Watch out for

- **Stable id strings.** React keys are the Map keys verbatim.
  Generating fresh `crypto.randomUUID()` ids on every render
  remounts every fiber and defeats the batching. Use the same id
  for the lifetime of the underlying entity.
- **Pointer events.** The wrapper has `pointer-events: none` so it
  doesn't block the canvas. Set `pointer-events: auto` on the
  inner element returned from `renderItem` if you want clicks.
- **Use `<WorldAnchor>` for one-offs.** Don't reach for the
  batched form below ~10–20 entries — you'll pay extra wrapper
  cost without recouping it.
- **No `Object3D` allocation per entry.** Pass `[x, y, z]` tuples
  or plain `{ x, y, z }` objects in the Map — the batched variant
  doesn't need a Three `Object3D` per entry, and creating one per
  game tick is exactly the cost the list exists to avoid.

## Related

- [`WorldAnchor`](https://github.com/tombee/vibesmith/blob/main/packages/runtime/src/world-anchor.tsx) — the per-entity variant; same projection / clamp / behind semantics.
- [Engine patterns](../reference/engine-patterns.md) — Unity-isms ↔ R3F translation guide.
- [Performance budgets](../reference/performance-budgets.md) — Tier 0 budget table the batching pays into.
