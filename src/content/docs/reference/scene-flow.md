---
title: 'Scene flow — ctx.scene'
description: 'Transition between scenes: active-scene swap with a four-phase lifecycle, additive scene loads, the modal scene stack, onSceneEnter/onSceneExit hooks, and typed scene-to-scene payloads.'
---

> **Framework. Game-agnostic.** Scene flow is the runtime substrate
> for moving between scenes — a title screen to a play scene, level to
> level, a pause menu over gameplay, a streamed sub-area. The shapes
> here work for any game.

`loadSceneFromUrl` decodes a single `.scene.json`. Scene flow is the
layer on top that **transitions between scenes**. Every engine ships
this — Unity `SceneManager.LoadSceneAsync`, Godot `change_scene_to`,
Unreal level streaming, Bevy `States`. A game can't have a title
screen and a play scene without it.

It's three orthogonal operations over one parsed-scene substrate:

- **Active-scene swap** — one live scene; `transitionTo` tears it down
  and mounts the next, through a four-phase lifecycle covered by a
  fade.
- **Additive load** — a scene layered *on top* of the active one,
  addressed by a handle (persistent HUD, streamed zone, overlay).
- **Modal stack** — a scene pushed *over* the active one without
  unloading it (pause menu), popped to resume.

## The four-phase lifecycle

```
active → unloading → loading → entering → active
```

| Phase | What happens |
|-------|--------------|
| `unloading` | The outgoing scene's `onSceneExit` fires; the fade-out half covers the swap. (Skipped on the first boot transition.) |
| `loading` | The target `.scene.json` is fetched + parsed. |
| `entering` | The target mounts; `onSceneEnter` fires; the fade-in half reveals it. |
| `active` | Steady state. |

A `transitionTo` issued while another is in flight **supersedes** it
(latest wins — a mashed title-screen button can't stack half-loaded
levels). A target that fails to load **rolls back** to the prior active
scene rather than stranding mid-load.

## `ctx.scene` runtime API

```ts
import { defineGameScript } from '@vibesmith/runtime';

defineGameScript({
  id: 'my-game/title-controller',
  onUpdate(ctx) {
    if (startPressed && ctx.scene) {
      void ctx.scene.transitionTo('scenes/level-1.scene.json', {
        payload: { seed: 0xC0FFEE },
      });
    }
  },
});
```

| Member | Effect |
|--------|--------|
| `transitionTo(ref, opts?)` | Swap the active scene. `opts.effect` (`{ kind: 'fade' \| 'none', durationSeconds }`, fade default); `opts.payload` (typed handoff). Resolves at `active`. |
| `push(ref, { payload? })` | Open a modal scene over the active one without unloading it. |
| `pop()` | Close the top modal scene; returns the popped entry or `null`. |
| `loadAdditive(ref)` | Layer a scene over the active one; returns a handle. |
| `unloadAdditive(handle)` | Unload an additive scene by handle. |
| `phase` / `activeRef` / `stack` | Read-only flow state. |

`ctx.scene` is `undefined` when no flow manager is wired — branch on it.

## Script hooks

`defineGameScript` gains `onSceneEnter(ctx)` (fires when the script's
scene becomes active — read the inbound payload via `ctx.scenePayload`)
and `onSceneExit(ctx)` (fires when the scene is swapped out or popped —
persist transient state, cancel in-flight work). Unlike `onStart`
(once per mount), `onSceneEnter` fires every time the scene becomes
active, so it's the right hook for per-entry setup (re-arm timers,
branch on the payload).

```ts
defineGameScript({
  id: 'my-game/level-loader',
  onSceneEnter(ctx) {
    const { seed } = (ctx.scenePayload as { seed?: number }) ?? {};
    if (seed !== undefined) reseedWorld(seed);
  },
  onSceneExit() {
    saveCheckpoint();
  },
});
```

## Typed payload handoff

`transitionTo(ref, { payload })` (and `push`) carry a typed value to
the incoming scene — "load level 3 with this seed". Narrow the type at
the call site; the payload must be JSON-serialisable (scenarios
round-trip it verbatim).

```ts
ctx.scene.transitionTo<{ level: number; seed: number }>('scenes/play.scene.json', {
  payload: { level: 3, seed: 42 },
});
```

## Additive scenes vs the modal stack

| | Additive | Modal stack |
|--|----------|-------------|
| Use | persistent HUD layer, streamed sub-area, overlay | pause menu, dialog scene |
| Addressed by | a returned handle (many can coexist) | LIFO stack (push/pop) |

A modal scene pushed via `push` keeps the active scene mounted
underneath, so `pop()` resumes it with no reload. Scene-scoped HUDs of
the pushed scene layer over the active scene's HUDs (see
[HUD lifecycle](./hud-lifecycle/)).

## Boot / entry scene

A project declares its entry scene via `vibesmith.toml [scene].boot`.
The flow manager drives boot → entry: the first transition starts from
the resting state, skips the unload half, and brings the entry scene to
`active`. With no project entry declared, the built-in boot scene is the
entry, so there's never a no-scene state to special-case.

## Scenario determinism

Scene flow is first-class [scenario](./scenario-driven-dev/) substrate.
A captured scenario records the active-scene ref, the modal stack, the
additive handles, the in-flight transition progress, and the payload;
restoring re-loads the active scene by ref and reconstructs the rest
byte-identically (re-capturing a restored flow yields an identical
scenario). Restore reconstructs state — it doesn't re-fire
`onSceneEnter` / `onSceneExit`.

## Driving it from an assistant

Per the [tiered MCP surface](./mcp-tiered-surface/), an AI assistant
can drive scene flow during authoring / QA:

| Surface | What |
|---------|------|
| `vibesmith.scene.transition-to` | Swap the **running game's** active scene through the real lifecycle (distinct from `set_active_scene`, which re-mounts the editor viewport for isolated validation). |
| `vibesmith.scene.list` | Enumerate the project's `.scene.json` files. |
| `vibesmith.scene.stack` | Read the live flow state, or push/pop a modal scene. |
| `vibesmith://scene/flow` | A resource — the live active scene + phase + stack + additive handles. |
| `scene.go-to` (cmd+P) | Hands the navigation intent to the chat panel. |

## See also

- [Scene renderer](./scene-renderer/) — the package the flow manager
  lives in; `loadSceneFromUrl` is its load path.
- [Engine patterns](./engine-patterns/) — where scene flow sits among
  the Unity / Godot / Unreal / Bevy analogues.
- [HUD lifecycle](./hud-lifecycle/) — scene-scoped vs global HUDs the
  modal stack pairs with.
