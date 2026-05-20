---
title: 'Intent'
description: 'An intent is a player action expressed as data — "press jump", "shoot", "open inventory". Scripts dispatch intents via ctx.dispatch and react to them via onIntent. The framework routes them through the network adapter so multiplayer and replay come along for free.'
---

An **intent** is **a player action expressed as data** — a "press
jump," a "fire weapon," an "open inventory," a "select unit." Not
the *result* of the action ("the player jumped"), but the *desire*
to do it.

vibesmith uses intents as the canonical surface between **player
input** and **game-logic [scripts](script)**. Why introduce a
named concept for "the player pressed a button"? Three reasons:

1. **Multiplayer comes along for free.** An intent is a wire-shape
   that travels naturally — keyboard input on machine A becomes a
   network packet that arrives at machine B as the same intent.
2. **Replays come along for free.** Capture the stream of intents
   that produced a play session; replay them against the same
   starting [snapshot](snapshot); you get an exact reproduction.
3. **AI agents speak the same language.** A bot, a tutorial
   ghost, an automated test all dispatch the same intent shape as
   a human pressing a key.

## How an intent looks

```ts
type JumpIntent = { kind: 'jump' };
type ShootIntent = { kind: 'shoot'; target: [number, number, number] };
type SelectIntent = { kind: 'select'; entityIds: string[] };
```

Intents are plain TypeScript values. No base class, no `Intent`
import — just a tagged object. Most projects use a discriminated
union (`type Intent = JumpIntent | ShootIntent | ...`) so scripts
can switch on `intent.kind` with full type-narrowing.

## Dispatching an intent

From inside a [script](script):

```ts
defineGameScript({
  id: 'player-controller',
  onTick: (ctx) => {
    if (someInputCondition) {
      ctx.dispatch({ kind: 'jump' });
    }
  },
});
```

`ctx.dispatch(intent)` sends the intent into the project's
**network adapter** (the small piece of code that knows how the
project shuttles intents between machines). Single-player projects
typically use a local "loopback" adapter that delivers intents
back into the local game loop immediately.

## Reacting to an intent

```ts
defineGameScript({
  id: 'jumpable',
  onIntent: (ctx, intent) => {
    if (intent.kind === 'jump') {
      // apply jump force, play sound, …
    }
  },
});
```

Every script attached to an object that's a valid target for the
intent receives `onIntent`. The network adapter decides *which*
objects are targets — for some intents that's "the player's
character," for others it's "every selected unit," for others it's
"the global game state."

## The network adapter

The piece that makes intents portable is the **network adapter** —
a small adapter that:

- accepts intents from `ctx.dispatch`,
- routes them locally and (for multiplayer projects) over the
  wire,
- delivers them to the right scripts via `onIntent`,
- optionally records them for replay.

The framework ships a loopback adapter for single-player work; a
Colyseus binding for multiplayer is on the cookbook + capability
roadmap.

## Why not just call a function?

You could write `player.jump()` directly from your input handler.
But then you lose:

- the wire shape (a function call doesn't serialise),
- the replay trail (no event log),
- the multiplayer story (a local function call can't cross
  machines),
- the AI-actor story (an AI can't dispatch a function call from
  outside the running game).

The intent is the canonical shape that gets all four properties
in one go.

## Intent vs signal

A short comparison with [signal](signal):

- **Intent** = "I want to do X" — a request that scripts can
  validate, refuse, modify before applying.
- **Signal** = "X happened" — a one-way notification, fire-and-forget.

If a player presses jump and falls through the world, the *intent*
("the player wants to jump") happened either way; the *signal*
("the player jumped") only fires if the engine actually applied
the jump.

## Next

- [Signal](signal) — the fire-and-forget complement.
- [Script](script) — how `onIntent` fits the lifecycle.
- [Engine patterns](/vibesmith-docs/reference/engine-patterns/) —
  Unity input events, Godot signals, Unreal input components →
  vibesmith equivalents.
