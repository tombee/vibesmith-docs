---
title: 'Cookbook'
description: 'Short, code-forward R3F / WebGL recipes for problems that come up every game. Each entry is 1–2 pages: what to use, working code, caveats, when *not* to use it.'
---

Short, code-forward R3F / WebGL recipes for problems that come up
every game. Each entry is 1–2 pages: what to use, working code,
caveats, when *not* to use it.

Designed for AI coding agents *and* humans. Agents grep this dir
when planning scene-graph work; humans skim it when something
feels harder than it should.

## Conventions

- **Code first.** Working JSX/TS snippets, not pseudo-code.
- **Caveat-driven.** Each recipe has a "Watch out for" section —
  the failure modes that bite once you're in the weeds.
- **Game-agnostic.** Talk about *entities*, *props*, *characters*
  generically. Game-specific tone / lore / asset packs live in
  consumers' `docs/game/`, never here.
- **Cross-link [anti-patterns](../anti-patterns.md).** Every
  recipe should warn about the anti-pattern it's most often
  confused with.

## Index

### Rendering volume + perf

- [Instancing](instancing.md) — render hundreds/thousands of
  identical objects without melting the GPU.
- [Performance debugging](perf-debugging.md) — measure what's
  actually slow, attribute draw-call / triangle / shader budgets,
  and where to look in `gl.info`.

### Animation

- [Animations](animations.md) — GLTF skeletal animations,
  cross-fading clips, and tween / spring patterns for transforms
  that don't have authored animation data.

## Roadmap (not yet written)

These slots exist because the recipes are *needed* (real R3F
problems that bite consumers) but the entries are still pending.
Add as a consumer hits the gap; don't speculate.

- **Post-processing** — `@react-three/postprocessing` setup,
  effect ordering, performance cost vs. value.
- **Particles** — CPU points-cloud + GPU-instanced approaches;
  drei `<Sparkles>` as a starting point.
- **Asset loading + dispose** — preload patterns, instance vs.
  clone semantics, dispose-on-unmount lifecycle.
- **Custom shaders** — `ShaderMaterial` vs. `MeshStandardMaterial.onBeforeCompile`
  vs. drei `<MeshTransmissionMaterial>` patterns.
- **Camera shake / transitions** — `useFrame` priority for
  pre/post-render hooks; decay envelopes; cinematic transitions.
- **Physics** — `@react-three/rapier` setup; static vs. dynamic
  bodies; collision groups.

> **Adding a recipe:** create `docs/cookbook/<topic>.md` and add
> a line to the Index above (with a one-line hook). Keep it under
> 400 lines; split into linked sub-recipes if it grows.

## Related

- [Anti-patterns](../anti-patterns.md) — the failure modes these
  recipes route around.
- [Engine patterns](../reference/engine-patterns.md) — Unity-isms ↔
  Three / R3F translation guide.
- [Performance budgets](../reference/performance-budgets.md) — Tier 0
  budget table that recipes target.
- [WebGL constraints](../reference/webgl-constraints.md) — hard limits
  every recipe respects.
