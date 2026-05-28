---
title: 'Input substrate — action maps, rebinding, multi-device'
description: 'Track INP input substrate: defineInputMap (typed named actions, digital + analog-axis + dead-zone + WASD→Vec2 composite); keyboard / mouse / Gamepad API / touch adapters behind one poll/event surface; useAction / useActionState / useAxis hooks; ctx.input + the onInput hook on defineGameScript; user-scoped rebinds + chord-conflict detection; input-context stacking; recorded-input deterministic replay.'
---

> **Framework. Game-agnostic.** Input is exposed to consumer
> projects as a single declarative surface — named *actions*
> declared with `defineInputMap`, read through hooks
> (`useAction` / `useActionState` / `useAxis`) or script context
> (`ctx.input`). Keyboard, mouse, gamepad, and touch all fan into
> the same actions; rebinding and the input-context stack come for
> free. Raw `keydown` / `pointerdown` / Gamepad API access stays
> available — the substrate sits *beside* web events, it never
> forbids them.

`@vibesmith/input` is the input pillar every established native
engine ships. It turns device events into **named actions** so
gameplay code reads intent (`"jump"`, `"move"`, `"interact"`)
instead of hardware (`KeyW`, button 0, a stick axis). That
indirection is what makes rebinding, multi-device support, and
deterministic replay possible.

## Engine equivalents

| Unity | Godot | Unreal | Bevy |
|---|---|---|---|
| Input System (action maps, rebindable bindings, multi-device) | InputMap + `Input.is_action_pressed` | Enhanced Input (Input Actions + Input Mapping Contexts) | `bevy_input` + (community) `leafwing-input-manager` |

## Why a wrapper here (and not over `keydown`)

The framework doesn't wrap web standards that AI already writes
fluently. Input is the exception that earns its keep: action
mapping + rebinding + multi-device fan-in is genuine cross-device
*logic*, not a thin shim over `KeyboardEvent`. A raw `keydown`
handler can't answer "is the jump action held?" when jump might be
Space, a gamepad button, or a touch button, possibly rebound by
the player, possibly shadowed by an open menu. The substrate
answers that; raw events stay reachable for the cases it doesn't
cover (a drag-select marquee, a custom `pointermove` gesture).

## Declaring an input map

```ts
import { defineInputMap } from '@vibesmith/input';

export const onFoot = defineInputMap({
  id: 'on-foot',
  actions: {
    move: { kind: 'axis', dimension: '2d', deadZone: 0.15 },
    jump: { kind: 'digital' },
    interact: { kind: 'digital' },
  },
  bindings: {
    // A WASD → Vec2 composite is a first-class binding type.
    move: [
      {
        device: 'composite',
        contributions: [
          { source: 'KeyW', axis: 'y', sign: 1 },
          { source: 'KeyS', axis: 'y', sign: -1 },
          { source: 'KeyA', axis: 'x', sign: -1 },
          { source: 'KeyD', axis: 'x', sign: 1 },
        ],
      },
      // Same action, fed by a gamepad's left stick — multi-device fan-in.
      { device: 'gamepad', axes: [0, 1] },
      // …and a virtual thumb-stick on touch.
      { device: 'touch', control: 'move', controlKind: 'stick' },
    ],
    jump: [
      { device: 'keyboard', code: 'Space' },
      { device: 'gamepad', button: 0 },
      { device: 'touch', control: 'a', controlKind: 'button' },
    ],
    interact: [
      { device: 'keyboard', code: 'KeyE' },
      { device: 'gamepad', button: 2 },
    ],
  },
} as const);
```

Action names are typed `as const` at the call site, so
`useAction('interakt')` (typo) is a compile error and
`ctx.input.axis('move')` autocompletes.

### Action kinds

- **`digital`** — a button. Value is a `boolean`; the edge hooks
  (`useAction`, `onInput`) fire once on press / release.
- **`axis`** — analog.
  - `dimension: '1d'` → a `number` in `[-1, 1]` (a trigger, the
    mouse wheel).
  - `dimension: '2d'` → a `Vec2` (a stick, a WASD composite).
  - `deadZone` (`0..1`) is a radial dead-zone applied before
    normalisation — magnitudes inside it read zero; outside it the
    value is rescaled so there's no value cliff at the edge.

### Binding types

| `device` | shape | drives |
|---|---|---|
| `keyboard` | `{ code }` — a `KeyboardEvent.code` (layout-stable) | digital, or ±1 on an axis |
| `mouse` | `{ button }` — `MouseEvent.button` index | digital |
| `gamepad` | `{ button }` | digital (trigger past 0.5 reads as held) |
| `gamepad` | `{ axes, invertY? }` — one index (1D) or `[x, y]` (2D) | axis |
| `touch` | `{ control, controlKind }` | digital / axis (virtual overlay) |
| `composite` | `{ contributions, normalize? }` | 2D (WASD) or 1D axis |

Several bindings on one action **fan in** — a key, a stick, and a
touch control can all drive `"move"`; the strongest contributing
source wins each frame.

## React surface

Mount `<InputProvider>` inside your `<Canvas>`. It owns the
scene's input manager, attaches the device adapters, and drives the
per-frame input phase on a single `useFrame` slot at **priority
−100** (before gameplay `useFrame` callbacks, so a script reading
`useAxis('move')` sees a freshly polled value).

```tsx
import { InputProvider, useAction, useActionState, useAxis } from '@vibesmith/input/react';

function Player() {
  // Edge callback — fires once per press.
  useAction('jump', () => doJump());
  // Held boolean — re-renders only when it flips.
  const sprinting = useActionState('sprint');
  // Per-frame Vec2 — returned as a ref (no re-render churn).
  const move = useAxis('move');
  useFrame((_, dt) => {
    applyMovement(move.current, sprinting, dt);
  });
  return null;
}
```

In the vibesmith editor the provider is mounted automatically;
projects just declare maps + read them.

### Touch overlay

`<TouchOverlay>` renders a virtual stick + buttons as a DOM layer
over the canvas. It's **opt-in** and renders only on touch-capable
devices — desktop players never see thumb-sticks. It drives the
touch adapter, so its inputs fan into the same actions as keyboard
/ gamepad. Steam Deck and mobile are first-class; a
gamepad-presenting Steam Deck works through the gamepad adapter
with no extra wiring.

```tsx
<InputProvider>
  <YourScene />
  <TouchOverlay stickControl="move" buttons={[{ control: 'a', label: 'A' }]} />
</InputProvider>
```

## `ctx.input` + `onInput`

Game scripts read input two ways:

```ts
import { defineGameScript } from '@vibesmith/runtime';

defineGameScript({
  id: 'avatar',
  // Polled — read held state / axes each tick.
  onUpdate(ctx, dt) {
    const move = ctx.input?.axis('move') ?? { x: 0, y: 0 };
    if (ctx.input?.action('sprint')) { /* … */ }
  },
  // Edge-driven — fires once per discrete action edge, resolved
  // through the active input-context stack. The right place for
  // one-shot reactions (jump, cast, interact) where polling every
  // frame would risk a double-fire or a missed press.
  onInput(ctx, action, value) {
    if (action === 'jump' && value.kind === 'digital' && value.value) jump();
  },
});
```

`ctx.input` also drives the **input-context stack**:

```ts
ctx.input?.pushContext('menu', { exclusive: true }); // open a modal
ctx.input?.popContext();                              // close it
```

## Input-context stacking

A game is rarely in one input mode. On-foot, in a vehicle, and in
a modal menu each want their own bindings, and they nest. Push a
context to enter a mode, pop to leave; action resolution walks the
stack top-down, so the topmost context that binds an action wins
(Unreal's Input Mapping Contexts / Godot's action sets).

- A non-exclusive overlay (a HUD radial) only shadows the actions
  *it* binds — lower contexts still resolve the rest.
- An **exclusive** context (a text field, a full-screen map) blocks
  every action it doesn't bind, so movement keys don't leak through
  to the avatar while the player types.

## Rebinding

Bindings declared in `defineInputMap` are *defaults*. They're
runtime-overridable:

```ts
import { conflictsForRebind, setOverride, serializeOverrides } from '@vibesmith/input';

// Preview a collision before committing (two actions on one chord).
const clash = conflictsForRebind(onFoot.data, current, 'interact', [
  { device: 'keyboard', code: 'KeyF' },
]);
if (clash.length === 0) {
  const next = setOverride(current, 'on-foot', 'interact', [
    { device: 'keyboard', code: 'KeyF' },
  ]);
  manager.setOverrides(next);
  // Persist (user-scoped — see below).
  await saveRebinds(serializeOverrides(next));
}
```

Overrides are **user-scoped**: rebinds are a per-user preference,
not project content, so they persist next to the user config
(`input-rebinds.json`), never in the project repo.
`resolveRebindsPath({ platform, env, joinPath })` resolves the
per-OS location as a pure function (the binary supplies
`process.platform` / `process.env` / `path.join` and does the file
IO); `serializeOverrides` / `parseOverrides` own the codec (a
corrupt rebind file degrades to defaults rather than wedging boot).

**Chord-conflict detection** (`detectConflicts`,
`conflictsForRebind`) flags two actions sharing the same chord —
the classic rebind footgun. The substrate reports the conflict; the
UI surfaces it.

## Deterministic replay

Input state is captured per tick and replayed byte-identically.
Because action resolution is a pure function of `(map, bindings,
device-frame)` and the frame snapshot is canonicalised (sorted
keys), a recording replays bit-for-bit — the same recorded-input
replay contract the `player-controller.click-to-move` recipe
documents.

```ts
import { InputRecorder, InputReplayer } from '@vibesmith/input';

// Record:
const recorder = new InputRecorder();
recorder.capture(manager.snapshot()); // once per tick

// Replay:
const replayer = new InputReplayer(recorder.toRecording());
let frame = replayer.next();
while (frame) {
  manager.loadFrame(frame);
  // resolve actions identically to the live run…
  frame = replayer.next();
}
```

This is what makes input-driven scenes testable: a bug repro is a
recording, and a regression test is "replay this recording and
assert the trajectory".

## Architecture

```
device events ─┐
 keyboard ┐     │  ┌ DeviceFrameState ─┐   ┌ resolver (pure) ─┐
 mouse    ├─ adapters ──▶ (held keys + ├──▶│ action map +     │──▶ action values
 gamepad  │   (poll/    │  analog vals) │   │ bindings + frame │    (bool / num / Vec2)
 touch   ─┘    event)   └───────────────┘   └──────────────────┘
                                   ▲                  ▲
                          context stack        rebind overrides
```

Adapters are the only DOM-aware code; the resolver never sees a DOM
event, and the manager accepts a recorded frame as happily as a
live one. That seam is what carries portability, rebinding, and
deterministic replay.

## See also

- [engine-patterns](/reference/engine-patterns/) § Input — where
  this fits in the Unity / Godot / Unreal / Bevy map.
