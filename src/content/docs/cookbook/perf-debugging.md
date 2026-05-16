---
title: 'Performance debugging'
description: 'You can''t fix what you can''t measure. R3F + Three give you enough text-level instrumentation to attribute every frame without screenshots; FrameCapture (see...'
---

You can't fix what you can't measure. R3F + Three give you
enough text-level instrumentation to attribute every frame
without screenshots; FrameCapture (see
[qa-strategy.md](../reference/qa-strategy.md)) is the framework's
durable substrate, but for ad-hoc debugging the path is
shorter.

## First check: `gl.info`

`renderer.info` is Three's per-frame counter dump. Pull it from
`useThree`:

```tsx
import { useFrame, useThree } from '@react-three/fiber';

export function PerfReadout() {
  const { gl } = useThree();
  useFrame(() => {
    if (Math.random() < 0.01) {
      // log once every ~100 frames so console doesn't drown
      console.log({
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        points: gl.info.render.points,
        lines: gl.info.render.lines,
        frame: gl.info.render.frame,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        programs: gl.info.programs?.length,
      });
    }
  });
  return null;
}
```

What to look for:

- **`calls`** = draw calls per frame. Tier 0 budget per
  [performance-budgets.md](../reference/performance-budgets.md). >500 on a
  mid-spec laptop hits the GPU command-buffer ceiling.
- **`triangles`** = polygons rasterized. Browser GPUs handle
  ~1–2M comfortably; >5M is mobile-killer territory.
- **`programs`** = compiled shaders. Many distinct materials =
  many programs = compile stalls on first frame. Share materials.
- **`geometries`** / **`textures`** = leaks. Should be roughly
  stable after first load; growth-over-time means you're not
  disposing.

## React DevTools profiler

R3F components are React components. If frames are slow, run the
React Profiler and look for components re-rendering during
`useFrame`. Frequent culprits:

- Setting React state per frame (see
  [anti-patterns.md](../anti-patterns.md#2-setting-react-state-every-frame)).
- A parent passing new object literals as props every render,
  defeating memoization.
- Listening to a Zustand store with a selector that returns a
  new array/object reference each call.

## Three's stats panel

For a always-on FPS / ms readout:

```tsx
import { Stats } from '@react-three/drei';

// inside your <Canvas> tree (top-level), in dev only:
{import.meta.env.DEV && <Stats />}
```

Top-left of viewport. Click to cycle: FPS / ms / mem. Useful for
"is this regression?" gut-checks.

## `react-three/perf` (richer, optional)

`r3f-perf` gives a breakdown of GPU vs. CPU time, programs
compiled, materials reused, drawcalls — orders of magnitude more
detail than `<Stats>`. Install only when needed; it has its own
non-trivial cost.

```tsx
import { Perf } from 'r3f-perf';

{import.meta.env.DEV && <Perf position="top-right" />}
```

## Chrome DevTools Performance tab

For tracing *what the CPU is doing* (not just frame budget),
record a few seconds in Chrome's Performance tab. Look for:

- **Long tasks** in the main thread — usually a giant
  `useEffect` or `useMemo`. Defer to `requestIdleCallback` or
  split.
- **GC pauses** — sawtooth memory graph during gameplay. Means
  you're allocating per frame. See
  [anti-patterns.md](../anti-patterns.md#1-allocating-per-frame-in-useframe).
- **Render time vs. script time** — if script dominates, it's a
  React / game-logic issue; if render dominates, it's a draw-call
  / shader / overdraw issue.

## Attribution checklist

When you measure poor perf, attribute in this order before
optimizing:

1. **Where in the frame?** Stats / r3f-perf to split CPU vs. GPU.
2. **GPU-bound? Why?** `gl.info`: too many calls (instance!),
   too many triangles (LOD!), too many programs (share!),
   overdraw (post-processing order).
3. **CPU-bound? Why?** Chrome Performance: React re-renders
   (DevTools profiler), `useFrame` body cost, third-party
   libraries.
4. **Memory growing?** `gl.info.memory.geometries` /
   `.textures` rising over time → dispose leak.
5. **Frame stutter (not steady-low fps)?** Almost always GC.
   Allocation hunt.

## Watch out for

- **Stats accuracy** drops below 16ms — anything <60fps is fine
  to compare relatively, but absolute numbers near vsync are
  noisy.
- **DevTools open changes performance.** Always measure with
  devtools closed (or with the Performance tab tracing only;
  Console open in particular is expensive).
- **Production builds are 2–3× faster** than dev. Don't ship
  optimizations chasing dev-mode numbers; profile a production
  build.
- **`gl.info` is shared across `<Canvas>` instances** if you
  have multiple. Single Canvas is the recommendation
  ([anti-patterns.md](../anti-patterns.md#4-multiple-canvas-instances)).

## Related

- [Performance budgets](../reference/performance-budgets.md) — the numbers
  you measure against.
- [Anti-patterns](../anti-patterns.md) — the failure modes
  attribution surfaces.
- [QA strategy](../reference/qa-strategy.md) — FrameCapture JSON for
  durable regression tracking (vs. ad-hoc console logs).
- [Adaptive rendering](../reference/adaptive-rendering.md) — automatic
  tier scaling once you know your budget.
