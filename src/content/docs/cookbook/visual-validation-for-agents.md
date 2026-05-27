---
title: 'Visual validation (for agents)'
description: 'Canonical workflow for AI coding agents to validate game state visually through the editor MCP surface — pause, navigate to a known state, screenshot at known dimensions. Do not reach for standalone vite, Playwright, or consumer-side mounts; there is no supported standalone runtime path.'
---

> **For AI coding agents.** This page is the canonical workflow
> for visually verifying a change you just made. Reach for any
> other path and you ship work against output that doesn't match
> the supported run mode.

## TL;DR

```ts
// 1. Open the project in the vibesmith editor binary.
// 2. Pause the simulation so subsequent captures land against a
//    deterministic frame.
await mcp__vibesmith__pause();

// 3. Navigate to the state you want to validate.
await mcp__vibesmith__set_active_scene({ id: 'scenes/board.scene.json' });
await mcp__vibesmith__set_fixture({ address: 'boards.opening', frame: 3 });

// 4. Capture at known dimensions — offscreen render, live
//    viewport size restored after.
const shot = await mcp__vibesmith__viewport_screenshot({
  width: 1280,
  height: 720,
});
// shot.base64 is the PNG; shot.width / shot.height echo back.

// 5. Drive input + advance the simulation deterministically.
await mcp__vibesmith__send_action({
  action: { type: 'card.click', cardId: 7 },
});
await mcp__vibesmith__step_frame({ count: 1 });

// 6. Capture the post-action state.
const after = await mcp__vibesmith__viewport_screenshot({
  width: 1280,
  height: 720,
});

// 7. Resume the live loop when done.
await mcp__vibesmith__set_play_mode({ playing: true });
```

## The seven MCP capabilities

The editor's MCP surface exposes seven Tier-1 tools that work as
a coherent visual-validation loop:

| Tool | What it does |
|---|---|
| `set_play_mode({ playing })` | Play or pause the editor simulation. The Unity-style Play button. |
| `pause()` | Convenience for `set_play_mode({ playing: false })`. |
| `step_frame({ count? })` | Advance `count` frames (default 1) while paused. |
| `set_active_scene({ id })` | Switch which scene the editor viewport mounts. |
| `set_fixture({ address, frame? })` | Load a fixture-factory registration and optionally seek to a frame. Dispatches `vibesmith.fixture.set` on the action bus. |
| `viewport_screenshot({ width, height, pause_before?, format? })` | Offscreen render at explicit dimensions. The render target is resized, drawn once, returned as base64, and the live viewport size restored. |
| `send_action({ action })` | Push a plain-object action onto the editor's in-process action bus. The action shape is consumer-defined; subscribers pattern-match. |

The capability descriptions in the MCP catalog cross-reference
each other and prescribe this workflow explicitly — read them on
first discovery.

## The four "do not" cases

Each of these alternatives looks superficially correct but
produces output against an unsupported run mode and screenshots
of a moving target:

1. **Do NOT `npx vite`** (or any standalone vite invocation) to
   spin up a runtime "just for a screenshot". There is no
   supported standalone runtime path; visual validation flows
   entirely through the editor MCP surface.

2. **Do NOT write Playwright harnesses against a standalone
   runtime.** The editor MCP screenshot is offscreen,
   deterministic, and dimension-stable — Playwright adds latency
   + a separate render path that doesn't match what ships. (The
   project's own *automated* test suite may use Playwright for
   regression coverage; that's a different concern from in-
   session agent validation.)

3. **Do NOT mount a consumer-side `<ProviderGate>` / `HudHost` /
   `<EditorShell>`** outside the editor to "make the page
   render". The editor owns the host shell; consumer code stays
   the consumer's own scene-graph + HUD components.

4. **Do NOT iterate with `vibesmith build` to verify state.**
   `vibesmith build` exists only for shipping the bundle; it is
   *not* a dev loop and does not host the MCP surface. Iteration
   is editor → save → editor refresh; verification is the MCP
   validation tools above.

## Why the editor owns this

The editor is the only surface where game state can be paused,
navigated to a specific moment, and inspected without restarting
from scratch — the same property the Unity Editor / Godot Editor
/ UE Editor expose to their authoring tools. The MCP wrapper
makes that property available to AI coding agents without giving
up determinism.

`viewport_screenshot` specifically uses an **offscreen render
detour**: it captures the live renderer's size + pixel ratio +
render target, resizes to the requested dimensions, draws one
frame against the live scene + camera, reads back the canvas
bytes, then restores everything. The editor panel size you see
is not disturbed; the screenshot dimensions are exactly what you
asked for regardless of the panel's CSS box.

## Fixture authoring (for consumers)

To make `set_fixture` work in your project, register fixture
factories at module level via
[`@vibesmith/fixtures`](/reference/fixtures):

```ts
import { defineFixtureFactory, registerFixtureFactory } from '@vibesmith/fixtures';

registerFixtureFactory(
  defineFixtureFactory({
    id: 'boards.opening',
    build: ({ frame = 0 }: { frame?: number } = {}) => ({
      turn: frame,
      // ... whatever your game-state shape is ...
    }),
  }),
);
```

Then a game script or test bridge subscribes to actions and
applies the fixture:

```ts
import { defineGameScript } from '@vibesmith/runtime';

defineGameScript({
  id: 'fixture-bridge',
  onMount: ({ ctx }) => {
    const bridge = (globalThis as any).__vibesmithValidationBridge;
    return bridge?.subscribeToActions((action: any) => {
      if (action.type !== 'vibesmith.fixture.set') return;
      // Look up the factory + apply.
      // The action carries `address` + `frame`.
    });
  },
});
```

`send_action({ action })` uses the same bus — your game-script
discriminator decides which actions matter to which subscriber.

## Background

This page was carved out as the canonical visual-validation
surface in [issue #892](https://github.com/tombee/vibesmith/issues/892).
Observed failure mode pre-892: agents reached for `npx vite` +
Playwright + consumer-side `<ProviderGate>` mounts when they
needed a screenshot, and shipped work against output that didn't
match the shipped bundle. The MCP capabilities here close that
gap by making the canonical path obviously the right path on
first MCP discovery.

See also:

- [Install vibesmith MCP](/cookbook/install-mcp/) — wire your
  coding assistant to the framework's MCP surface.
- [Anti-patterns](/anti-patterns/) — common mistakes the
  framework's coaching surface flags.
