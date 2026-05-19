---
title: 'Writing a game script'
description: 'How a project script registers behaviour via defineGameScript, what the GameScriptContext gives you, and how the lifecycle (mount → tick → unmount) sequences against R3F.'
---

For projects opened by the vibesmith desktop binary (folders with
`vibesmith.toml`), runtime behaviour lives in plain TypeScript
under `scripts/`. The starter wizard writes `scripts/project.ts`
already; this recipe explains what that file does, what you can
do inside it, and how the lifecycle ticks.

## The minimal script

The 3D starter ships this content as `scripts/project.ts`:

```ts
import { defineGameScript } from '@vibesmith/runtime';

defineGameScript({
  id: 'spin-cube',
  onTick: (ctx, dt) => {
    const obj = ctx.object3D as { rotation: { y: number } };
    obj.rotation.y += dt * 0.6;
  },
});
```

That's it. The binary dynamic-imports `scripts/project.ts` when
the project opens, the import side-effect registers `spin-cube`
in the runtime registry, and any scene node carrying
`script: "spin-cube"` ticks the `onTick` handler from R3F's frame
loop. The starter scene's `cube` node has that field set, so the
cube spins.

## The `defineGameScript` surface

```ts
defineGameScript({
  id: string,                                       // required, project-unique
  onMount?:   (ctx: GameScriptContext) => void | (() => void),
  onTick?:    (ctx: GameScriptContext, dtSeconds: number) => void,
  onIntent?:  (ctx: GameScriptContext, intent: unknown) => void,
  onUnmount?: (ctx: GameScriptContext) => void,
});
```

| Hook | When |
|------|------|
| `onMount` | Once when the scene node mounts. Return a teardown to skip `onUnmount`. |
| `onTick` | Per frame while the project is playing. `dt` is seconds since last frame. |
| `onIntent` | When an intent broadcast targets this object (today the bus is a noop; intent surface arrives in a later slice). |
| `onUnmount` | Once when the scene node unmounts, unless `onMount` returned a teardown. |

## `GameScriptContext`

```ts
interface GameScriptContext {
  object3D: unknown;     // the live THREE.Object3D the script is attached to
  readonly time: number; // wall-clock seconds; refreshed per frame
  dispatch: (intent: unknown) => void;
}
```

- **`object3D`** — the live Three.js node. Mutate `position` /
  `rotation` / `scale` directly. The type is `unknown` so projects
  don't need to pin their own copy of Three; cast inside the
  script: `ctx.object3D as Mesh`.
- **`time`** — monotonic seconds. Useful for time-based animation
  that doesn't drift from accumulated `dt`. Refreshed every frame
  before `onTick` fires.
- **`dispatch(intent)`** — sends an intent into the project's
  network adapter. Today this is wired to a noop until the
  intent-bus slice lands; the surface is stable so scripts can
  start adopting it.

## Lifecycle, concretely

```text
project open
  └─ binary dynamic-imports scripts/project.ts (side-effects register)
scene mounts
  └─ for each mesh node with `script: "<id>"`:
       └─ resolve config by id from runtime registry
            ├─ found    → createScriptRunner(config, ctx).mount()
            └─ missing  → warn in console + render the mesh statically
each frame
  └─ for each runner: tick(dt)
scene unmounts (or project closes)
  └─ for each runner: unmount()
```

The runner is idempotent — `mount()` / `unmount()` repeated calls
are noops. Re-mount after unmount is supported. If `onMount`
throws, the runner reverts to unmounted state + skips subsequent
ticks; if `onTick` throws, the error surfaces via the runner's
`onError` hook (the binary wires this to the developer console).

## What you can do inside a script

Today (PR #181):

- Mutate the bound `Object3D`'s transform.
- Mutate sibling objects via the scene tree (`ctx.object3D.parent?.getObjectByName("…")`).
- Read state from libraries your script imports — non-bundled
  npm packages you've added to `[deps]` (lodash, ulid, custom
  math libraries) resolve via the binary's bundled install flow.
- Call `dispatch(intent)` — surface is stable, today a noop.

Reasonable but not yet wired:

- Subscribe to keyboard / pointer input (planned via a typed
  `ctx.input` slice).
- React to other scripts' state changes (planned via an in-process
  message bus).
- Hot-reload edits to `scripts/project.ts` without closing +
  reopening the project (planned via Vite's `import.meta.hot`).

Don't:

- `import 'three'` or `import 'react'` from a script. The binary
  bundles them; the project shouldn't pin separate copies.
- Persist state across project sessions from inside the script.
  Save the value through a scenario or back-end adapter.
- Fight other systems for the same mutation slot. The starter
  script spins `rotation.y` — if you select the cube and drag the
  rotation gizmo's Y handle, the script will fight the gizmo. Use
  a different axis, or pause scripts when the gizmo is active (a
  later slice will add a play/pause toggle).

## Registering multiple scripts

Multiple `defineGameScript({ id: '…' })` calls in the same entry
script are fine — the registry holds all of them. Scene nodes
reference by id:

```ts
defineGameScript({ id: 'spin-cube', onTick: (ctx, dt) => { /* … */ } });
defineGameScript({ id: 'orbit-light', onTick: (ctx, dt) => { /* … */ } });
defineGameScript({ id: 'idle-camera-sway', onTick: (ctx, dt) => { /* … */ } });
```

And in the scene file:

```json
{
  "id": "cube",
  "kind": "mesh",
  "script": "spin-cube"
}
```

## How the binary runs your script

The binary's embedded Vite dev server serves `scripts/project.ts`
through the `/@fs/` route. The `@vibesmith/runtime` import resolves
via a Vite alias to the binary's bundled copy — projects don't
install the runtime themselves. On project close, the registry is
cleared so reopening starts fresh. Edits to `scripts/project.ts`
are picked up on next project open (full HMR is a follow-up).

## Errors

The binary surfaces script errors in two places:

- **Mount errors** (the entry-script import threw, or a factory
  threw inside the top-level call) → the viewport's error banner
  with the raw error in the "Technical details" disclosure. The
  scene doesn't mount.
- **Tick errors** (`onTick` threw mid-frame) → logged via
  `console.error`; the runner keeps ticking on subsequent frames
  (one bad frame doesn't kill the script). A future slice will
  surface these in a dedicated panel.

## See also

- [Quick start](/vibesmith-docs/getting-started/quick-start/) —
  scaffold a project and confirm the starter cube spins.
- [Project upgrade model](/vibesmith-docs/reference/project-upgrade-model/)
  — how `[deps]` reaches the binary's install flow.
- [Engine patterns](/vibesmith-docs/reference/engine-patterns/)
  — Unity-`MonoBehaviour`-ism translation; `defineGameScript`
  is the framework's analogue.
