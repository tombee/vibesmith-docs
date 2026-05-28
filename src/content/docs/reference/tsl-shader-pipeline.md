---
title: 'TSL shader pipeline — author once, compile to GLSL and WGSL'
description: 'Three Shading Language as the single shader-authoring substrate compiling to both WebGL 2 (GLSL) and WebGPU (WGSL). Code-first .tsl.ts + node-first .tsl.graph.json authoring shapes, recipe-canon TSL recipes, the tsl-preview editor panel, and renderer-feature-matrix gating for compute-only features.'
---

> **Framework. Game-agnostic.** TSL is the one shader-authoring
> substrate. Author the node graph once; the pipeline compiles it
> to GLSL for WebGL 2 and WGSL for WebGPU. Game code never
> hand-writes backend shader source.

The framework owns the compile pipeline, the graph schema, the
preview surface, and the recipe-canon integration.

---

## When to use

Any custom shader work — dissolve, rim-light, hologram,
scrolling-UV, toon. Don't hand-write GLSL/WGSL; the pipeline
targets both backends from one source.

## Authoring shapes

- **`.tsl.ts`** — code-first. Author the node graph in TypeScript.
  The recommended default for AI-authored shaders.
- **`.tsl.graph.json`** — node-first. The editor's graph format;
  `parseGraph` / `serializeGraph` / `validateGraph` round-trip it.
- **Inline** — reference a TSL node as a material role's shader
  via the material system's `TslRef`.

```ts
import { compile } from '@vibesmith/tsl-runtime';

const result = compile(myShaderNode, { backend: 'wgsl' });
// result.code → WGSL source; result.uniforms → typed uniform info
```

## Recipe-canon TSL recipes

Prefer a vetted shader recipe over authoring from scratch.
`@vibesmith/recipe-canon` ships TSL recipes — `dissolve`,
`fresnelRim`, `hologram`, `toon`, `hitFlash`, `scrollingUv`,
`iridescent`. Retrieve, adapt the uniforms, drop in.

## Backend gating

Compute-only features don't exist on WebGL 2. Consult the
[renderer feature matrix](/vibesmith-docs/reference/renderer-feature-matrix/)
and pick a policy: graceful-degrade, feature-gate, or
backend-required. The preview panel toggles backends so you can
verify both.

## Editor panel

```sh
vibesmith add-extension tsl-preview
```

The `tsl-preview` panel gives a preview canvas, uniform sliders,
hot-reload, and a backend toggle.
