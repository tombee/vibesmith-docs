---
title: 'Snapshot'
description: 'A snapshot is a captured, launchable, replayable game state. The unit of UX iteration, probe input, and bug repro. Not a save game; not a test fixture.'
---

A **snapshot** is **the state of your game at one specific
moment**, captured into a file you can launch back into. It's how
vibesmith lets you:

- iterate on a tricky moment of UX without playing through the
  game every time,
- give an AI assistant a concrete starting state to reason about,
- file a bug report that lands as a one-click repro on someone
  else's machine,
- write tests that hand the framework a known state and assert
  what happens next.

## What's in a snapshot?

A typical snapshot contains:

- **Which [scene](scene)** is loaded.
- **The exact pose** of every object in the scene (positions,
  rotations, scales).
- **The state of the running [scripts](script)** — health,
  cooldowns, inventory, anything the script's adapter knows how
  to serialise.
- **Subsystem state** that consumers have opted into — animator
  parameters, physics velocities, audio playback positions, etc.

Subsystems opt in by registering a `defineSnapshotAdapter`. Things
that *don't* register an adapter aren't in the snapshot. This is
deliberate: snapshots stay small and fast by default, and grow
only where the consumer needs determinism.

## What a snapshot is *not*

- **Not a save game.** Save games are a player-facing feature you
  build on top of snapshots if you want (the substrate is reusable;
  the persistence + slot UI is consumer-shaped). The framework
  itself uses snapshots for *dev* iteration, not player saves.
- **Not a test fixture.** Test fixtures are usually
  language-specific (`jest.fn()`, etc.). A snapshot is a portable
  JSON file with a strict wire contract — it can be replayed from
  TypeScript, from Python, from a curl command.
- **Not a screenshot.** "Snapshot" in some test frameworks means
  "captured pixel output." vibesmith snapshots are state, not
  pixels.

## Where snapshots show up

- **Editor "capture" button.** Pause the game at an interesting
  moment, hit capture, get a `.snapshot.json` in your repo.
- **`<Launcher snapshot={...} />` at startup.** The editor (or a
  test harness) can load directly into a snapshot instead of
  cold-booting the scene.
- **Bug reports.** A one-click bug report attaches the current
  snapshot, so the developer who picks the bug up can replay
  the exact state.
- **AI-assistant authoring.** An assistant can ask the framework
  to capture, mutate, and replay snapshots — "show me what happens
  if I scale this object 2x in this scene" becomes a snapshot
  mutation.

## The HMR superpower

Snapshots are preserved across hot-module reloads. Tweak a
script's tick function, save the file, and the editor
re-instantiates the scene **at the same captured state**. You
don't lose your place. This is one of the framework's biggest
wins for iteration speed — and it's why so much else in vibesmith
is built on top of snapshots.

## The hypothesis

Snapshots are vibesmith's bet that **state-as-data is more
useful than state-as-code-flow**. Most games hide their state
inside MonoBehaviours / Actors / nodes that you can't poke at
from outside. vibesmith pulls state out into a wire contract so
the editor, the AI assistant, the bug-report flow, and the test
harness can all read and write it directly.

## Next

- [Scenario-driven dev](/vibesmith-docs/reference/scenario-driven-dev/)
  — the deeper pattern + reference.
- [Bug reporting](/vibesmith-docs/reference/qa-strategy/) —
  how snapshots flow into the bug-report pipeline.
- [AI assistant](/vibesmith-docs/reference/ai-assistant/) —
  snapshot-authoring + mutation tasks the assistant uses.
