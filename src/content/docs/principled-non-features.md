---
title: 'Principled non-features'
description: 'A short list of authoring affordances Vibesmith deliberately does not ship — visual JSX-rewrite, shadow scene files, drag-reference-onto-field, name-registry indirection, custom DSLs. Each one is named here so you know what to expect, why it is not there, and what the framework gives you instead.'
---

Vibesmith deliberately refuses some authoring affordances that
are familiar from heavyweight native engines (Unity, Godot,
Unreal) and from R3F-flavoured visual editors (Triplex,
Threlte Studio). They look like obvious wins; they are not, and
this page names them so you know what to expect.

The reasoning is one rule: **Vibesmith bets that AI coding
assistants are most useful on *idiomatic* code, so every
authoring feature has to leave your code at least as legible to
an AI assistant as it was before**. Affordances that would
require a less-legible code shape — generated decorators, shadow
scene files, registry-by-name indirection — lose that test even
when they would feel familiar.

The full framework-internal catalogue is in the framework repo's
[`principled-non-features.md`](https://github.com/tombee/vibesmith)
(growing append-only as new affordances surface in the
ecosystem). This page is the consumer-facing summary.

## No JSX rewrite

**You won't see this.** Drag a transform gizmo, your `.tsx` file
on disk silently updates with the new prop values. (Triplex's
and Threlte Studio's headline feature.)

**What Vibesmith does instead.** Edits that should persist go
through *recipe edits* — JSON files in `.vibesmith/recipes/`
that the dynamic scene loader picks up at runtime. The inspector
shows you the recipe diff before it lands, you commit it like
any other source change. Your JSX stays exactly as you wrote it.

For edits that *shouldn't* persist (transform tweaking during
iteration), the framework keeps them in memory and offers a
**"play-mode edit"** banner. Capture them to a
[scenario](/vibesmith-docs/reference/scenario-driven-dev/) if
they're worth replaying.

## No visual scripting

**You won't see this.** A node-graph editor where you wire
gameplay logic without writing code. (Unreal Blueprints, Unity
Bolt.)

**What Vibesmith does instead.** Game logic is idiomatic
TypeScript via
[`defineGameScript`](cookbook/writing-game-scripts.md). If you'd
otherwise reach for visual scripting because writing the
TypeScript feels hard, ask your AI coding assistant for the
edit — that's the affordance that replaces "designer-friendly
wiring" in Vibesmith's bet. The assistant is faster than
node-wiring and the output is code your next session can read.

## No drag-reference-onto-field

**You won't see this.** Drag a GameObject from the hierarchy
onto a `Transform target` field in another component to assign
a serialised reference. (Unity's headline ergonomic.)

**What Vibesmith does instead.** References are hand-typed
**string names in source code** — e.g.
`ctx.find('Player.Camera')`. To make this comfortable:

- The Vibesmith MCP surface gives your AI assistant cmd+P-style
  autocomplete over scene-object names.
- The hierarchy and scene-inspector panels double-click a node
  to insert its name at the cursor.
- Lint warnings fire when a name resolves to nothing in the
  active scene.

The string is in the source either way; your assistant resolves
it the same way the runtime does.

## No shadow scene file

**You won't see this.** A `scene.json` (or `.bsn`, or `.unity`)
sits alongside your JSX and is the *authoritative* description
the framework reads at runtime, with your JSX as a derived view.

**What Vibesmith does instead.** JSX + recipe JSON are the only
sources of truth. JSX describes hand-authored scene content;
recipe JSON describes procedural / parametric content the
dynamic loader resolves. There is no third file, and nothing in
the framework rewrites either one based on a visual edit.

## No name-registry indirection in your code

**You won't see this.** Framework primitives like
`<Prefab id="crate" mass={10}/>` where `"crate"` resolves to a
prefab definition in some other file you have to crawl to know
what `<Prefab id="crate"/>` actually contains.

**What Vibesmith does instead.** Prefabs are *typed-data
factories*. You import the prefab factory, call it with
parameters, render the returned JSX inline:

```tsx
import { crate } from './prefabs/crate';

function MyScene() {
  return (
    <>
      {crate({ mass: 10, material: 'wood' })}
      {crate({ mass: 5, material: 'metal' })}
    </>
  );
}
```

Your AI assistant reads the factory's parameters *and* its
render body in the file; no registry crawl, no string-name
resolution. The
[inspectable-parameters cookbook recipe](cookbook/inspectable-parameters.md)
walks through the same pattern for game scripts.

## How this list grows

Vibesmith periodically surveys what authoring features
Unity / Godot / Bevy / R3F editors are shipping and classifies
each against the AI-fluency test. Closures that pay for
themselves become roadmap items; closures that would tax AI
fluency get added to the framework's principled-non-features
catalogue. The list never shrinks opportunistically — closures
require fresh evidence that the original prediction was wrong.

## Cross-references

- [Positioning](positioning.md) — the strategic bet these
  refusals defend.
- [Engine patterns](reference/engine-patterns.md) —
  Unity-isms ↔ Vibesmith translation; the *what we do
  instead* row for each affordance above.
- [Inspectable parameters cookbook](cookbook/inspectable-parameters.md)
  — the data-shape coaching pattern in practice.
- [Scenario-driven dev](reference/scenario-driven-dev.md) —
  the capture mechanism that replaces "play-mode-save-state."
