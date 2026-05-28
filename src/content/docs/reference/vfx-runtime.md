---
title: 'VFX runtime — particles, emitters, and the CPU/GPU backend split'
description: 'Declarative <Particles> + <Emitter> scene-tree components over interchangeable CPU instanced-billboard and WebGPU-compute backends. useVfxRecipe pulls tuned effects from recipe-canon; ctx.vfx.spawn fires one-shots from scripts; per-tier capacity caps and scenario capture keep effects reproducible.'
---

> **Framework. Game-agnostic.** The VFX runtime exposes one
> consumer surface — `<Particles>` / `<Emitter>` and
> `ctx.vfx.spawn` — over two interchangeable backends. Game code
> never picks a backend; the runtime selects per the active
> renderer and rendering tier.

The framework owns the scene-tree components, the recipe-canon
hookup, the one-shot script surface, the per-tier capacity caps,
and the snapshot capture format. Backends own the simulation.

---

## When to use

Particle effects — bursts, trails, fire, smoke, magic. Two ways in:

- **Declarative** — a `<Particles>` system holding one or more
  `<Emitter>` children, authored in the scene tree.
- **Imperative** — `ctx.vfx.spawn(recipeId, transform)` from a
  `defineGameScript`, for fire-and-forget effects (hit sparks,
  pickups).

## Backend selection

One surface, two backends:

- **CPU instanced billboards** — broad compatibility (WebGL 2).
- **WebGPU compute** — high particle counts when the backend is
  available.

The runtime picks per the active renderer + tier. You don't choose
manually. Per-tier capacity caps keep budgets honest, so always set
`capacity` on the `<Particles>` root.

## Recipe-canon hookup

Prefer a tuned recipe over hand-tuning emitters.
`useVfxRecipe(id, overrides)` resolves a registered recipe into
emitter props:

```tsx
import { Particles, Emitter, useVfxRecipe } from '@vibesmith/vfx-runtime';

function Burst() {
  const { recipe } = useVfxRecipe('burst', { count: 64 });
  return (
    <Particles capacity={recipe.capacity} rngSeed={1}>
      {recipe.emitters.map((e, i) => (
        <Emitter key={i} {...e} />
      ))}
    </Particles>
  );
}
```

## Script one-shots

```ts
// In a defineGameScript:
const handle = ctx.vfx.spawn('hit-spark', transform, { color: 'warm' });
ctx.vfx.stop(handle, { fade: 0.3 });

if (ctx.vfx.has('hit-spark')) {
  /* recipe registered */
}
```

`VfxHandle` carries `{ id, emitting }`. `stop(handle, { fade })`
ends emission and fades existing particles.

## Tuning recipes — the VFX Inspector

Open a `.vfx.json` recipe from the files panel and the **VFX
Inspector** panel gives each emitter sliders / numeric inputs / a
colour picker for the tunable fields (`rate`, `lifetime`,
`initialSpeed`, `spread`, `gravity`, `drag`, `color`). It's the
particle-side analogue of the shader uniform rack.

Edits flow two ways:

- **Live** — scrubbing a control updates the running preview on
  the next frame (no save needed).
- **Saved** — a short debounce later, the change is written back
  to the recipe file. The write is deterministic: object keys keep
  a stable order, emitter order is preserved, and re-saving the
  same value is a no-op, so your recipe files only ever diff on
  the value you actually changed. Saving triggers a hot reload in
  every preview that uses the recipe.

## Determinism

Particle state is captured into snapshots (strict or sampled) so
effects reproduce on replay. Seed the system with `rngSeed` for
deterministic spawns.

## Editor panel

```sh
vibesmith add-extension vfx-workbench
```
