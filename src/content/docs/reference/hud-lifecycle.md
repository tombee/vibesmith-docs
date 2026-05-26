---
title: 'HUD lifecycle — scene-scoped default + project-global persistent tier'
description: 'Authoritative spec for the vibesmith HUD lifecycle model. Two tiers: scene-scoped HUDs via <Hud id="..."> scene-graph nodes + defineSceneHud (the default), and project-global persistent HUDs via defineGlobalHud (defineHud deprecated alias for one release). Mount semantics, boot-scene fallback, snapshot interaction, schema reference, migration, end-to-end worked example.'
---

> **Framework. Game-agnostic.** Authoritative spec for the HUD
> lifecycle model. The *catalogue* of HUD surfaces (dialogue /
> status / hotbar / minimap / …) is documented elsewhere; this
> page specifies *how* they mount.

Two tiers, one of which is the default:

- **Scene-scoped** (default) — bound to a `<Hud id="…">` scene-
  graph node; mounts when the owning scene loads, unmounts when
  it unloads. The natural shape for HUD content that's
  contextual to a gameplay loop (player status, hotbar,
  dialogue presenter, mini-map, compass).
- **Project-global persistent** (explicit) — mounted on project
  open, unmounted on project close. The natural shape for
  splash, cross-scene loading transitions, persistent score
  bars, dev / debug overlays the developer wants visible across
  scene reloads.

Scene-scoped is the default because it's the cross-engine
default: Unity puts Canvases in scenes, Godot puts CanvasLayer +
Control nodes in scenes, Unreal binds widgets at the Level
level. Persistent UI in each of those engines is opt-in, named
explicitly, and exceptional. vibesmith follows the same shape —
naming the lifecycle question at the call site so a reader
(human or AI assistant) can answer "does this survive a scene
change?" without crawling the registry.

---

## Scene-scoped HUDs

### Scene schema

A scene-scoped HUD is a `<Hud id="…">` node in the scene tree —
sibling to meshes, lights, prefabs:

```json
{
  "id": "town",
  "nodes": [
    { "kind": "prefab", "id": "town-square", "ref": "@town/square" },
    { "kind": "hud", "id": "player-status" },
    { "kind": "hud", "id": "hotbar" }
  ]
}
```

The `id` matches the id passed to `defineSceneHud(...)`. Each
`<Hud>` node carries its own renderer-routing metadata; the
runtime dispatches `kind: "hud"` to the DOM HUD layer the same
way it dispatches `kind: "prefab"` to the Three subgraph
factory.

### Registration

```ts
import { defineSceneHud } from '@vibesmith/runtime';
import { PlayerStatus } from './ui/PlayerStatus';
import { Hotbar } from './ui/Hotbar';

defineSceneHud({ id: 'player-status', component: PlayerStatus });
defineSceneHud({ id: 'hotbar', component: Hotbar });
```

Mount order matches the scene-JSON declaration order. The runtime
maintains a per-scene HUD registry keyed by scene id; mounting a
new scene tears down every previous-scene HUD before mounting any
of the new scene's entries (per-sibling order is React's natural
sibling cleanup).

### Authoring discipline

- One `<Hud id="…">` per logical HUD surface. A "player status"
  HUD and a "hotbar" HUD are separate nodes — they have separate
  lifecycle, separate snapshot identity, and separate inspector
  rows.
- HUD ids are unique within a scene. Cross-scene duplication is
  fine (every gameplay scene can declare `player-status`).
- A `defineSceneHud({ id })` without a matching scene-JSON node
  is a no-op; a `<Hud id="…">` node without a matching
  registration mounts an empty placeholder + logs a missing-
  component diagnostic.

---

## Project-global persistent HUDs

### Registration

```ts
import { defineGlobalHud } from '@vibesmith/runtime';
import { SplashOverlay } from './ui/SplashOverlay';
import { DevPerfOverlay } from './ui/DevPerfOverlay';

defineGlobalHud({ id: 'splash', component: SplashOverlay });
defineGlobalHud({ id: 'dev-perf', component: DevPerfOverlay });
```

Global HUDs live in a single project-wide registry. They mount
on project open and unmount on project close; no scene change,
no scene-load error, no scenario restore unmounts them.

Mount order follows registration order, which is the order
`@vibesmith/runtime` loads the project's script modules. Cross-
script ordering is undefined; if order matters, register from a
single bootstrap module.

### When to use global vs scene

Use **global** when the HUD's lifecycle is independent of any
particular scene: splash chrome at boot, persistent debug
overlays a developer wants across scene reloads, cross-scene
loading transitions that bridge two scenes.

Use **scene-scoped** for everything else — including everything
in the in-game UI surface catalogue (dialogue, player status,
hotbar, mini-map, compass). When the gameplay loop the HUD
overlays ends, the HUD dies with it. This is the cross-engine
default and the AI-fluent default.

### `defineHud` (deprecated alias)

The legacy `defineHud({ id, component })` factory is preserved
as an alias of `defineGlobalHud` for one release. First call per
session logs a deprecation warning naming the replacement; the
alias is removed in the release after. See [Migration](#migration).

---

## Mount semantics

| Lifecycle event | Scene HUDs | Global HUDs |
|---|---|---|
| Project open | not mounted (no scene yet) | mounted in registration order |
| Boot-scene fallback mounts | boot-scene `<Hud>` entries mount | unaffected (already mounted) |
| Project scene loads | scene's `<Hud>` entries mount in declaration order | unaffected |
| Scene change (load new scene) | every previous-scene entry unmounts before any new-scene entry mounts (per-sibling order is React's natural sibling cleanup) | unaffected |
| Scene-load error | error scene mounts (per binary), its HUDs (if any) mount | unaffected |
| Scenario restore — same scene id | scene HUDs remount with restored state | unaffected |
| Scenario restore — different scene id | scene HUDs swap as on a scene change | unaffected |
| HMR — script edit | scene HUDs preserve mount state, component reloads | global HUDs preserve mount state, component reloads |
| Project close | scene HUDs unmount with their scene | global HUDs unmount (per-sibling order is React's natural sibling cleanup) |

### The boot-scene fallback

When no project scene is loaded — initial launch before the user
opens a scene, scene-load error, scene deleted out from under
the viewport — the binary mounts `vibesmith-boot.scene.json`.
The boot scene is owned by the binary, not the project; consumers
that ship their own boot scene override it via the project
manifest's `[scene]` block.

The viewport therefore *always* has a current scene. Code paths
that ask "what's mounted in the viewport?" have one answer
shape: a scene. HUD mount logic, hierarchy logic, scenario
logic, and inspector logic all stop branching on a no-scene
state.

Global HUDs sit above the boot scene exactly as they sit above
any project scene. Scene HUDs declared inside
`vibesmith-boot.scene.json` mount as scene HUDs against the boot
scene.

### Error states

- **Scene-load error.** Binary mounts its error scene (with its
  own optional `<Hud>` entries). Project-scene HUDs from the
  failed load are not mounted; global HUDs unaffected.
- **Missing registration.** `<Hud id="…">` with no
  `defineSceneHud` match mounts an empty placeholder + diagnostic.
- **Duplicate id within a scene.** Scene fails validation at load
  time (the scene schema rejects duplicate `kind: "hud"` ids
  within the same scene).
- **Duplicate `defineGlobalHud` id.** Last registration wins; a
  diagnostic is logged.

---

## Scenario interaction

HUD lifecycle is **deterministic** — same inputs always produce
the same mount/unmount sequence — and the lifecycle hooks the same
capture / restore plumbing as scene-graph nodes; no parallel
machinery.

What's deterministic today:

- **Scene-HUD mount order** matches scene-JSON declaration order.
  Identical scenes produce identical mount sequences across
  re-renders.
- **Scene change** unmounts every previous-scene entry before any
  new-scene entry mounts; per-sibling unmount order within the
  previous scene is React's natural sibling-cleanup order (forward
  declaration order at React 18 — the framework relies on React's
  guarantee, not a custom unmount scheduler). Two scenes that both
  declare `player-status` get separate host instances — the
  unmount-then-mount pair runs even when ids overlap.
- **Global-HUD mount order** matches registration order;
  registrations from a single bootstrap module are deterministic
  across runs.
- **Global HUDs persist** across scene changes — the global HUD
  overlay reads `registry.globalHuds` and re-renders only on
  registry mutations, not on scene swaps. On project close globals
  tear down via React's natural cleanup; the set of teardown events
  is complete (no HUD left mounted).

What the scenario envelope carries:

- `currentScenePath?: string` — the project-relative scene path
  the viewport was rendering at capture time. Populated by the
  binary's capture flow and threaded into the scenario via the
  `currentScenePath` capture input. Restore consults the field to
  decide whether to swap scenes before re-applying state — if the
  captured path differs from the currently-mounted scene, the
  binary requests the captured scene which triggers the normal
  scene-change unmount / remount cycle for the previous scene's
  HUDs. Absent field means restore leaves the active scene where
  it is (the common case when capture and restore happen on the
  same scene).

- `hudState?: { scene: [...], global: [...] }` — per-HUD render
  state, captured by walking the `registerHudState(...)` registry
  at capture time. Scene-HUD entries carry `{ sceneId, hudId,
  state }`; global-HUD entries carry `{ hudId, state }`. Capture
  order is deterministic — scene HUDs in scene-JSON declaration
  order; global HUDs in registration order. The field is
  **optional** — scenarios without per-HUD providers omit it
  entirely and remain backwards-compatible with the prior
  envelope shape.

### Per-HUD `registerHudState` hook

Consumers wire per-HUD state into the scenario envelope by
calling `registerHudState(...)` from inside their HUD components.
The registration is sync, returns a disposer, and matches the
existing single-channel state-provider factory shape:

```ts
import { registerHudState } from '@vibesmith/snapshot-driven-dev';

interface PlayerStatusState { coins: number }

function PlayerStatus(): ReactNode {
  const [coins, setCoins] = useState(0);
  useEffect(
    () =>
      registerHudState<PlayerStatusState>(
        'mygame/player-status',
        () => ({ coins }),
        {
          sceneId: 'town',                       // omit for global HUDs
          onRestore: (s) => setCoins(s.coins),   // drains restored state
        },
      ),
    [coins],
  );
  return <span>{coins}</span>;
}

defineSceneHud({ id: 'mygame/player-status', component: PlayerStatus });
```

  - **`capture: () => state`** — sync, called once per scenario
    capture (single-frame snapshot — providers must not round-trip
    to a backend).
  - **`onRestore?: (state) => void`** — sync, fires when a
    scenario restore arrives carrying matching state. The
    consumer drains the restored value into local React state
    (typically `setState(restored.coins)`). Optional — a
    read-only debug overlay that captures state but doesn't
    reapply on restore can omit it.
  - **`sceneId?: string`** — scene scope for scene HUDs (matches
    the scene id in the `<Hud id="…">` node owner). Omit for
    global HUDs.

### Restore semantics

Restore behaviour depends on the captured `currentScenePath`
versus the currently-mounted scene:

  - **Same scene id.** The scene HUD is already mounted; its
    `onRestore` callback fires synchronously and the consumer's
    `setState` drains the captured value into the live React tree
    without a remount. Global HUDs receive the same in-place
    restore.
  - **Different scene id.** The binary swaps scenes per the
    scenario's `currentScenePath`; scene A's HUDs unmount, scene
    B's HUDs mount. Restored state for HUDs without a live
    listener queues into a pending map and drains on each HUD's
    mount-time `registerHudState` call. Global HUDs are
    unaffected by the scene swap.
  - **Single-shot consumption.** Each pending restore drains
    exactly once. A later remount (HMR cycle, parent re-render)
    of the same HUD does **not** re-apply stale state.

### Backward compatibility

Scenarios without a `hudState` channel restore cleanly — the
absent field is treated as "no per-HUD state to seed." HUDs that
don't call `registerHudState` mount identically to the prior
behaviour; the channel is purely additive.

See [Scenario-driven dev](/vibesmith-docs/reference/scenario-driven-dev/)
for the broader scenario contract.

---

## Editor surfacing

The hierarchy panel surfaces both tiers with explicit tier
badges:

```
town  [scene]
├─ town-square  [prefab]
├─ player-status  [scene-hud]
└─ hotbar  [scene-hud]

(globals)
├─ splash  [global-hud]
└─ dev-perf  [global-hud]
```

Selection, inspection, and the selection outline reuse the
existing scene-graph machinery; a `<Hud>` node participates in
every editor surface a scene-graph node already participates in.
No parallel surface is added.

A dedicated UI workspace tab (Unity UI Builder / UE UMG Designer
style) is **deferred**. The trigger to revisit is responsive-
layout authoring, anchoring, or preview-with-design-time-data —
none of which are on the immediate critical path.

---

## Schema reference

### `<Hud>` scene-JSON node

```ts
{
  kind: 'hud';
  id: string;          // unique within the scene; matches defineSceneHud id
}
```

### `defineSceneHud`

```ts
import type { ComponentType } from 'react';

function defineSceneHud(spec: {
  id: string;
  component: ComponentType;
}): void;
```

Registers a React component against a `<Hud id="…">` node id.
Per-scene registry; same id may be defined in multiple scenes
with different components.

### `defineGlobalHud`

```ts
function defineGlobalHud(spec: {
  id: string;
  component: ComponentType;
}): void;
```

Registers a project-global persistent HUD. Single project-wide
registry; mounted on project open, unmounted on project close.

### `defineHud` (deprecated)

```ts
/** @deprecated use defineGlobalHud (alias removed next release) */
function defineHud(spec: {
  id: string;
  component: ComponentType;
}): void;
```

Forwards to `defineGlobalHud`. First call per session logs a
deprecation warning naming the replacement. Removed in the
release after.

All three surfaces live on `@vibesmith/runtime`.

---

## Hooks

A HUD component reads game state and dispatches intents by calling
two module-exported hooks from `@vibesmith/runtime`:

```ts
import { defineSceneHud, useHudGameState, useHudDispatch } from '@vibesmith/runtime';

interface GameState { coins: number }

function PlayerStatus() {
  const coins = useHudGameState((state) => (state as GameState | undefined)?.coins ?? 0);
  const dispatch = useHudDispatch();
  return (
    <button onClick={() => dispatch({ type: 'spend', amount: 1 })}>
      Coins: {coins}
    </button>
  );
}

defineSceneHud({ id: 'mygame/player-status', component: PlayerStatus });
```

### Signatures

```ts
function useHudGameState<T>(selector: (state: unknown) => T): T;
function useHudDispatch(): (intent: unknown) => void;
```

- **`useHudGameState(selector)`** — calls the selector against the
  binary's published game state. Until the project-state surface
  ships, the selector receives `undefined` (consumers supply the
  fallback). The contract stays stable as the underlying state
  pipe lands; consumer HUDs that already call the hook gain real
  behaviour without an API churn.
- **`useHudDispatch()`** — returns the intent-dispatch fn. The
  no-op stub today routes through the project's network adapter
  once that surface lands.

### Calling the hooks outside a registered HUD

The hooks throw a helpful error when called outside the
framework-managed mount path — the common cause is a HUD
component rendered directly from consumer JSX rather than
registered through `defineSceneHud` / `defineGlobalHud`. The
error message names the registration factories so the fix is
obvious.

---

## Migration

Consumers have up to two migrations depending on the shape of
their existing code:

1. **From `defineHud` to `defineGlobalHud`.** Rename
   `defineHud` → `defineGlobalHud`. No other change. The
   deprecation warning goes away. If the HUD makes more sense
   scene-scoped, add a `<Hud id="…">` node to the owning scene
   JSON and rename to `defineSceneHud` instead.

2. **From the deprecated `render` closure to `component` + hooks.**
   The previous `render: (hooks) => ReactNode` shape continues to
   work during the migration window but logs a one-time-per-session
   deprecation warning. Extract the closure body into a real
   component and call the [hooks](#hooks) inside it:

   ```ts
   // Before (deprecated):
   defineSceneHud({
     id: 'mygame/hotbar',
     render: ({ useGameState, useDispatch }) => {
       const slots = useGameState((s) => (s as { slots?: unknown[] } | undefined)?.slots ?? []);
       const dispatch = useDispatch();
       return <HotbarUI slots={slots} onSelect={(i) => dispatch({ type: 'select', i })} />;
     },
   });

   // After:
   import { useHudGameState, useHudDispatch } from '@vibesmith/runtime';

   function Hotbar() {
     const slots = useHudGameState((s) => (s as { slots?: unknown[] } | undefined)?.slots ?? []);
     const dispatch = useHudDispatch();
     return <HotbarUI slots={slots} onSelect={(i) => dispatch({ type: 'select', i })} />;
   }

   defineSceneHud({ id: 'mygame/hotbar', component: Hotbar });
   ```

The deprecated `defineHud` alias and the deprecated `render` field
each give one release of breathing room; the release after removes
them.

---

## Worked example

**`scenes/town.scene.json`**

```json
{
  "id": "town",
  "nodes": [
    { "kind": "prefab", "id": "town-square", "ref": "@town/square" },
    { "kind": "hud", "id": "player-status" },
    { "kind": "hud", "id": "hotbar" }
  ]
}
```

**`scripts/town.ts`**

```ts
import { defineSceneHud } from '@vibesmith/runtime';
import { PlayerStatus } from '../ui/PlayerStatus';
import { Hotbar } from '../ui/Hotbar';

defineSceneHud({ id: 'player-status', component: PlayerStatus });
defineSceneHud({ id: 'hotbar', component: Hotbar });
```

**`ui/PlayerStatus.tsx`** — scenario-aware HUD per
[`registerHudState`](#per-hud-registerhudstate-hook)

```tsx
import { useEffect, useState, type ReactNode } from 'react';
import { registerHudState } from '@vibesmith/snapshot-driven-dev';

interface PlayerStatusState {
  coins: number;
}

export function PlayerStatus(): ReactNode {
  const [coins, setCoins] = useState(0);
  useEffect(
    () =>
      registerHudState<PlayerStatusState>(
        'player-status',
        () => ({ coins }),
        {
          sceneId: 'town',
          onRestore: (s) => setCoins(s.coins),
        },
      ),
    [coins],
  );
  return <span data-testid="coins">{coins}</span>;
}
```

**`scripts/splash.ts`**

```ts
import { defineGlobalHud } from '@vibesmith/runtime';
import { SplashOverlay } from '../ui/SplashOverlay';

defineGlobalHud({ id: 'splash', component: SplashOverlay });
```

### What mounts when

1. **Project opens.** Binary mounts `vibesmith-boot.scene.json`
   (no project scene loaded yet). `splash` (global) mounts above
   it. The viewport shows: boot scene + splash overlay.
2. **User loads `town.scene.json`.** Boot scene unmounts, town
   scene mounts. `player-status` and `hotbar` (scene HUDs) mount
   in declaration order on top of the town scene. `splash`
   (global) is unaffected — still mounted above everything. The
   viewport shows: town scene + player-status + hotbar + splash.
3. **User dismisses splash** (via the SplashOverlay component's
   own logic — typically unmounting itself after first input).
   `splash` is still *registered*; it just renders null. Other
   HUDs unchanged.
4. **User loads `dungeon.scene.json`.** Town scene unmounts;
   `player-status` and `hotbar` unmount (per-sibling order is
   React's natural sibling cleanup — the framework promise is that
   *every* previous-scene HUD has unmounted before any
   dungeon-scene HUD mounts). Dungeon's `<Hud>` entries then mount
   in their declared order. `splash` is still registered and
   unaffected.
5. **User closes project.** All scene HUDs unmount with their
   scene; `splash` (global) unmounts; HUD registries clear.

---

## Cross-references

- [Engine patterns](/vibesmith-docs/reference/engine-patterns/)
  § UI / HUD — Unity / Unreal / Godot / vibesmith equivalence
  table for the four-way lifecycle shape.
- [Scenario-driven dev](/vibesmith-docs/reference/scenario-driven-dev/)
  — broader scenario contract; HUD lifecycle hooks the same
  capture / restore plumbing as scene-graph nodes.
