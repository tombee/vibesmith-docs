---
title: 'Onboarding tours'
description: 'Per-engine onboarding tours. Pick the engine whose vocabulary you already speak — Unity, Godot, Unreal, or Bevy — and the tour maps it onto vibesmith primitives without making you translate twice.'
---

If you already have a mental model of how *a* game engine works,
pick the tour matching the engine whose vocabulary you speak. Each
tour starts from that engine's words and walks you through the
vibesmith equivalents in the order you're most likely to reach for
them.

If you're a complete newcomer to game engines, start with
[Concepts](/vibesmith-docs/concepts/) instead — those pages don't
assume any engine background.

## Pick your engine

- [**From Unity**](/vibesmith-docs/onboarding/from-unity/) —
  `MonoBehaviour`, prefabs, `[SerializeField]`, Animator, scenes,
  ScriptableObjects.
- [**From Godot**](/vibesmith-docs/onboarding/from-godot/) — nodes,
  `_process` / `_ready`, `PackedScene`, signals, `@export`, scene
  inheritance.
- [**From Unreal**](/vibesmith-docs/onboarding/from-unreal/) —
  `AActor` / `BeginPlay` / `Tick`, Blueprints, UPROPERTY, Niagara,
  Levels, GameInstance.
- [**From Bevy**](/vibesmith-docs/onboarding/from-bevy/) — ECS,
  systems, queries, `Startup` / `Update`, `Commands`, plugin
  registration.

## How the tours are structured

Each tour follows the same five sections so jumping between them
is easy:

1. **Five-minute landing** — what to expect, what doesn't translate.
2. **Vocabulary map** — a short table mapping the engine's
   primitives to vibesmith's, sourced from
   [`engine-rosetta.json`](/vibesmith-docs/engine-rosetta.json).
3. **Walkthrough: the same task in both** — picks one familiar
   workflow (attach a rotation script to a cube) and shows the
   two side-by-side.
4. **What's intentionally different** — deliberate deviations
   you'll hit early, with the reasoning.
5. **Where to go next** — the right cookbook recipe, the right
   reference doc, the right concept page.

## Where the data comes from

The mapping tables on each tour are extracted from a single source
of truth — `engine-rosetta.json` — which lives alongside the docs
site at
[`/vibesmith-docs/engine-rosetta.json`](/vibesmith-docs/engine-rosetta.json).
Each entry declares the source engine vibesmith borrowed the name
from (Unity, Godot, Unreal, Bevy, general, or vibesmith-original)
plus a `notes` field and a `deviations` array.

Coding assistants reading the framework can fetch the JSON
directly; it's listed on
[`llms.txt`](/vibesmith-docs/llms.txt) so the agent manifest
points there.

## "I'm coming from web dev, not a game engine"

If your background is React / Three.js / R3F — not a heavyweight
engine — skip the engine tours. The framework is **already what
you write**. Read:

- [Introduction](/vibesmith-docs/introduction/) — what the framework
  adds on top of R3F.
- [Quick start](/vibesmith-docs/getting-started/quick-start/) — the
  five-minute scaffold-and-run.
- [Engine patterns](/vibesmith-docs/reference/engine-patterns/) —
  the longer reference doc, with the patterns we deliberately
  don't copy from Unity.

## Why these four engines

Unity, Godot, Unreal, and Bevy cover the four points where the
incoming-developer population realistically clusters: the
established commercial standard (Unity), the dominant open-source
alternative (Godot), the AAA-rendering standard (Unreal), and the
forward-looking Rust-ECS contender (Bevy — also the canonical
future-engine target per
[positioning](/vibesmith-docs/positioning/)). If you arrive from
something else (Phaser, PlayCanvas, Defold, Heaps, MonoGame, …)
the closest tour above is usually a good substitute — Phaser sits
closest to Unity's `MonoBehaviour` per-object lifecycle, PlayCanvas
to Godot's node tree, and so on.
