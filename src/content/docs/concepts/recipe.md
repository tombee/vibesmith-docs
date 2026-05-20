---
title: 'Recipe'
description: 'A recipe is a curated, AI-readable pattern for something hard to generate from scratch — a VFX effect, a shader, a building façade, an instanced crowd. The framework ships recipes; consumers add their own.'
---

A **recipe** is **a curated pattern for a specific creative
thing** — a fire VFX, a stylised water shader, a procedurally-
populated forest, a hit-confirm cutscene — written in a shape an
AI assistant can read, adapt, and validate against.

Recipes exist because **AI is great at adapting existing patterns
and bad at generating them from scratch**. If you ask an LLM to
write a flamethrower particle effect from nothing, you get
something plausible-looking that doesn't actually run. If you
give it three good flamethrower recipes and ask it to make a
*frost* version, you usually get something that runs.

That's the loop vibesmith bets on: **retrieve → adapt → validate**.

## What a recipe looks like

A recipe is a directory with:

- **the asset itself** (a `.tsl.ts` shader, a `.json` VFX
  description, a `.tsx` cutscene timeline, etc.),
- **metadata** — name, category, parameters, tags,
- **preview** — a rendered image or short clip so the editor's
  recipe browser shows it visually,
- **a brief** — natural-language description of what this recipe
  is, what it's good for, what variants make sense.

The framework ships some recipes; your project adds its own under
`recipes/`.

## Recipe canon, not "library"

The framework's bundled recipes are called the **recipe canon**.
"Canon" because the framework treats them as the reference set
the AI assistant retrieves from — the curated, validated baseline.
Your project can extend it; it can't *replace* it without
losing the validation guarantees.

## Categories you'll see

- **VFX** — particle effects, decals, screen-shake, hit confirms.
- **Shaders** — TSL (Three Shading Language) recipes that compile
  to both WebGL and WebGPU.
- **Audio mixes** — bus presets, footstep-pitch envelopes,
  reverb settings.
- **Cutscenes** — timeline-driven camera + animation + VFX +
  audio composites.
- **Instanced content** — crowds, vegetation, modular building
  kits.

## How a recipe gets used

Three entry points:

1. **`useVfxRecipe('fire')`** in a script — directly pulls a
   recipe into a running scene.
2. **`shader.generate-from-prompt`** from `cmd+P` — asks the AI
   to adapt a shader recipe to a description ("make this water
   look frozen").
3. **Author by example** — copy a recipe folder, tweak the
   parameters, save it as a new recipe in your project.

## Why this is load-bearing

The framework's positioning bets on **closing the
AI-difficult-bits quality gap**. Pure generation falls over on
specialised creative work — VFX, shaders, cutscenes, mixing —
because it requires deep domain knowledge and aesthetic
judgment. Recipes pull that knowledge into the loop as a
retrieval source.

If a recipe doesn't exist for what you're trying to build, write
one. The framework's value compounds with each curated entry.

## Next

- [Recipe canon](/vibesmith-docs/reference/) — the substrate +
  retrieve-adapt-validate flow (internal-only spec; reference
  doc owed).
- [Prefab](prefab) — recipes are the building blocks prefabs are
  built on.
- [Capability](capability) — the *thing the framework can do*
  layer that recipes sit alongside.
