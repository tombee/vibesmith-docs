---
title: 'Signal'
description: 'A signal is a one-way notification between scripts — "the door opened", "the boss died", "the level loaded". Fire-and-forget. Borrowed from Godot, sharpened for TypeScript and AI-readability.'
---

A **signal** is **a one-way notification** between scripts — *"the
door opened,"* *"the boss died,"* *"the player picked up an item."*
It says **something happened**. It doesn't say *who* should care
or *what* they should do about it.

If you've used Godot, this is exactly Godot's signals. We borrow
the name + semantics deliberately — they're the cleanest
established pattern for the "X happened" surface, and the
*[don't-invent-unless-markedly-better](/vibesmith-docs/positioning/)*
rule means we keep them rather than inventing a new word.

## Signal vs intent

The most useful comparison is with [intent](intent):

| | Intent | Signal |
|---|---|---|
| **Meaning** | "I want to do X" | "X happened" |
| **Direction** | request, validated, possibly refused | one-way notification, no refusal |
| **Used for** | player actions, AI agent actions, network input | side-effects, cross-script reactions, UI updates |
| **Replay shape** | the input stream | the output stream |

A jump *intent* is the player asking to jump; the resulting jump
*signal* fires if the engine actually applied the jump. The two
are not redundant — they're the two halves of the input/output
loop.

## Dispatching a signal

From inside a [script](script):

```ts
defineGameScript({
  id: 'door',
  onIntent: (ctx, intent) => {
    if (intent.kind === 'open') {
      // open the door, then notify the world
      ctx.signal({ kind: 'door-opened', doorId: ctx.entityId });
    }
  },
});
```

`ctx.signal(...)` broadcasts the signal to every script that has
subscribed to that signal's shape. No targeting; the publisher
doesn't know who's listening.

## Subscribing to a signal

```ts
defineGameScript({
  id: 'achievements-tracker',
  onMount: (ctx) => {
    return ctx.onSignal('door-opened', (signal) => {
      // unlock the "first door" achievement on first fire
    });
  },
});
```

`ctx.onSignal(kind, handler)` registers a subscription; the
returned function is the unsubscribe, which the framework calls
automatically on script unmount.

## Why both signals and intents?

Two surfaces because they answer different questions:

- An **intent** flows *into* the simulation — input, validation,
  possibly refusal. *"Try to do this."*
- A **signal** flows *out of* the simulation — telling everyone
  else *"this just happened."*

If you compressed them into one surface, you'd lose the ability
to model refusal (intents can be vetoed; signals can't) and the
ability to model "X happened by some other path" (signals fire
from animation triggers, physics callbacks, snapshot restores —
not just from intents).

## Signal naming

A signal's `kind` should describe **what happened**, not who
fired it. `door-opened` is good. `player-pressed-open-button` is
not — the button press is an intent, the door opening is the
signal.

The framework doesn't enforce this; it's the convention that
keeps the surface readable to AI assistants and to people new to
the codebase.

## Next

- [Intent](intent) — the input-side complement.
- [Script](script) — how `ctx.signal` and `ctx.onSignal` fit
  the lifecycle.
- [Engine patterns](/vibesmith-docs/reference/engine-patterns/) —
  Godot signals / Unity events / Unreal delegates → vibesmith
  signals.
