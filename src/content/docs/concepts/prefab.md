---
title: 'Prefab'
description: 'A vibesmith prefab is a generative content unit — a recipe + generator + critic + AI brief — that produces a scene composition. Not a Unity-style serialized GameObject template.'
---

A **prefab** in vibesmith is a *generative* content unit. It
bundles together:

- a **recipe** — the input specification (parameters, constraints,
  references),
- a **generator** — the code that turns the recipe into a
  [scene](scene) composition,
- an **AI brief** — natural-language guidance for the AI that
  produces the recipe,
- a **critic** — code that checks the result against the brief, and
- a **preview** — a rendered image or short clip the editor shows.

When you "use a prefab," you're not spawning a saved object — you
are running the generator over a recipe to produce **fresh
output**, which the framework then composes into your scene.

## A heads-up if you're coming from Unity / Unreal

This is the most common terminology collision in vibesmith. In
Unity / Unreal:

- **Unity prefab** = a GameObject template with serialised
  component values. You spawn it; you get an instance.
- **Unreal Blueprint Class** = same idea, different vocabulary.

In vibesmith:

- **prefab** = a *generative* template — the framework runs code
  to produce the output, optionally driven by an AI brief. The
  output isn't a "prefab instance" you can re-edit; it's a fresh
  composition each time.

If "a thing you place in the scene and re-use" is what you mean,
that's just **a regular React component in vibesmith**. The
framework calls those *components*; it reserves the word *prefab*
for the recipe-driven authoring loop.

## Why generative?

Three reasons:

1. **Closes the AI-authoring loop.** A prefab can be authored
   conversationally — "give me a Norse longboat with five rowers,
   ice on the prow, sails furled" — and the framework, with the
   recipe + generator + critic, can produce the composition
   without a human laying out every node.
2. **Variants are cheap.** Same recipe, different seed → different
   output. The same prefab generates dozens of shapes-of-the-same-thing
   without storing each one in your repo.
3. **The output stays in the consumer surface.** What ends up in
   your scene is plain React Three Fiber JSX — readable,
   diff-able, editable. The recipe doesn't lock you out.

## What's inside the framework, what's inside the consumer

The **substrate** (the prefab schema, the runtime loader, the
preview generator, the AI-brief contract) lives in vibesmith. The
**specific prefabs** (a particle effect, a building style, an
NPC archetype) are project-shaped — they live in your project's
`prefabs/` directory and reference your project's recipe canon.

## Next

- [Recipe](recipe) — the curated patterns prefabs are built on.
- [Director pattern](/vibesmith-docs/reference/director-pattern/)
  — the AI-assisted content authoring loop prefabs run inside.
- [Prefab system](/vibesmith-docs/reference/prefab-system/) —
  the contract + lifecycle reference.
- [Scene construction](/vibesmith-docs/reference/scene-construction/)
  — the recipe → generator → composition pipeline.
