---
title: 'Concepts'
description: 'First-principles explainers for the words vibesmith uses. What each concept is, why it exists, how it fits the rest of the framework. Written for newcomers — no engine background assumed.'
---

Every framework borrows vocabulary from somewhere — vibesmith borrows
from established game engines, web standards, React, and the
broader gamedev tradition. This section explains the **words**
without assuming you already know what a "scene" or a "prefab" is
from another engine.

If you're coming from Unity / Godot / Unreal / Bevy and want a
*mapping* instead of a first-principles read,
[Engine patterns](/vibesmith-docs/reference/engine-patterns/) has
the cross-engine Rosetta. Use that page when you already have a
mental model and need the translation.

This page is the other entry point — for **complete newcomers**
and for anyone who'd rather start from the question *"what is this
and why does it exist?"* than from a mapping table.

## Conventions

- **One concept per page.** Each entry is short (≤ ~1 screen) and
  link-out heavy.
- **No assumed engine background.** A reader who's never opened
  Unity should still be able to follow.
- **Plain language.** No "this is just X with extra steps."
  Concepts that genuinely simplify into something the reader
  already knows get said plainly; concepts that don't, don't.
- **Cross-linked to the reference docs.** Each concept page links
  to the matching [reference](/vibesmith-docs/reference/) entry
  for the API surface — concepts pages are *narrative*, reference
  pages are *contract*.

## Index

### The shape of a game

- [Scene](scene) — what your game looks like at one moment in time.
- [Script](script) — code that runs every frame on a part of the scene.
- [Prefab](prefab) — a reusable, generative content unit.

### State + iteration

- [Snapshot](snapshot) — a saved game state you can launch into.
- [Intent](intent) — a player action expressed as data.
- [Signal](signal) — a one-way notification between scripts.

### AI substrate

- [Recipe](recipe) — a curated, AI-readable pattern for something
  hard to generate from scratch.
- [Capability](capability) — a *thing the framework can do*
  (generate an image, embed text) abstracted over which service
  actually does it.
- [Provider](provider) — a concrete service that implements a
  capability (ComfyUI, Anthropic, OpenAI).

### Authoring surface

- [Extension](extension) — a panel or feature that plugs into the
  editor.

## Where to next

Once a concept clicks, jump to its **reference** entry for the
API surface, or to a **cookbook** recipe for working code.

- [Reference](/vibesmith-docs/reference/) — the per-API contract pages.
- [Cookbook](/vibesmith-docs/cookbook/) — working code snippets.
- [Engine patterns](/vibesmith-docs/reference/engine-patterns/) —
  the cross-engine Rosetta if you arrive from Unity / Godot /
  Unreal / Bevy.
