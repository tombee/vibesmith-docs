---
title: 'Recipe canon — retrieve, adapt, validate for AI-hard creative work'
description: 'Curated, validated recipe library for the things AI struggles to generate from scratch — VFX, shaders, cutscenes, audio mixes. findRecipes / getRecipe / listRecipes retrieval, defineRecipe + registerRecipe authoring, AI brief + validation that keeps adapted output inside the quality envelope.'
---

> **Framework. Game-agnostic.** Recipe canon is the framework's
> retrieve-adapt-validate substrate. It closes the AI quality gap
> for specialised creative work — the recipe carries the vetted
> pattern, the AI adapts parameters, the validation keeps the
> result honest.

The framework owns the recipe schema, the registry, the retrieval
interface, and the validation contract. Recipe content is curated
per category.

---

## When to use

Reach for a recipe before hand-rolling anything AI finds hard:
VFX, shaders, cutscenes, audio mixes. Retrieving and adapting a
vetted recipe beats generating from zero.

## Retrieve → adapt → validate

1. **Retrieve** — `findRecipes(query)` returns ranked matches by
   `category` + `pipeline` + tags. `getRecipe(id)` looks one up;
   `listRecipes(filter?)` enumerates.
2. **Adapt** — apply overrides (count, colour, timing) for your
   case.
3. **Validate** — recipes carry an AI brief + validation so the
   adapted result stays inside the recipe's quality envelope.

```ts
import { findRecipes, getRecipe } from '@vibesmith/recipe-canon';

const matches = findRecipes('warm burst on hit');
const burst = getRecipe(matches[0].id);
```

## Register your own

```ts
import { defineRecipe, registerRecipe } from '@vibesmith/recipe-canon';

registerRecipe(
  defineRecipe({
    id: 'my-burst',
    category: 'vfx',
    pipeline: 'particles',
    intent: 'warm radial burst on hit confirm',
    provenance: { author: 'me' },
    license: 'MIT',
    // …recipe payload…
  }),
);
```

`defineRecipe` validates required fields (`category` / `pipeline` /
`intent` / `provenance` / `license`) and throws on a malformed
meta. `registerRecipe` adds it to the module-level registry.
Capability runtimes then resolve it — e.g. `useVfxRecipe(id)` for
particles, TSL recipes for shaders.

## Editor panel

```sh
vibesmith add-extension recipes
```
