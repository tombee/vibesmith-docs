---
title: 'Player controllers (click-to-move, ability bar, follow camera)'
description: 'Retrieve a game-agnostic controller recipe from recipe canon — click-to-move locomotion, a slotted ability bar, a third-person follow camera — and adapt its params + reference impl + snapshot contract into your game.'
---

vibesmith ships three **player-controller recipes** for the
controls almost every RPG-shaped game needs: terrain-aware
click-to-move locomotion, a slotted ability bar, and a
third-person follow camera. They follow the same *retrieve →
adapt → validate* flow as the shader, VFX, and UI recipes — your
AI assistant queries the recipe canon, adapts the recipe to your
feel, and the framework hands you a pure reference implementation
plus a snapshot contract.

:::caution[`@vibesmith/recipe-canon` is editor-tier — don't ship it]
The recipe canon (`findRecipes` / `getRecipe`, the reference
controller cores) is an **authoring-time** package: your AI
assistant uses it to *discover and retrieve* a controller while you
build, but it must **not** be imported into your shipped game
bundle. What runs in the game are the **runtime-tier** primitives
the recipes are built on:

- **third-person character + locomotion + camera-relative
  movement** → `createThirdPersonController` from
  `@vibesmith/animation-runtime/react`;
- **follow / orbit / cinematic camera** → `defineVirtualCamera` +
  `createCameraBrain` + `<CameraRig>` / `<VirtualCamera>` from
  `@vibesmith/camera`.

For the click-to-move and ability-bar *step cores*, copy the
adapted reference impl into your own project code rather than
importing the editor-tier package at runtime. The snippets below
show that runtime wiring.
:::

**The framework ships shape + reference; you tune feel.** Each
recipe carries a parameter schema, framework-shipped defaults, a
pure (renderer-agnostic, deterministic) reference impl, and the
snapshot capture/restore for its slice of player state. You wire
the impl to your renderer (raycast a click, apply a transform,
read pointer + scroll deltas) and dial in your own movement
speed, sensitivities, and damping.

## The three shipped recipes

| Recipe id | What it is |
|---|---|
| `player-controller.click-to-move` | Resolve a click to a walkable world point, path through the walkable mask, drive the avatar with slope-aware speed, emit idle/walk/run locomotion blend for the animator. |
| `player-controller.ability-bar` | N slotted abilities bound to `AbilityArtifact` canon ids; input bindings trigger casts, per-slot + optional global cooldowns gate recasts, mana/stamina costs deduct on cast. |
| `camera.follow-third-person` | Orbit yaw/pitch on drag, scroll to zoom within a clamped range, framerate-independent smooth-follow damping, occlusion-raycast pullback, optional cinematic auto-frame. |

## Retrieve a recipe (authoring time)

This runs while you build — in the editor, a one-off script, or
your AI assistant's hands — **not** in the shipped game. It reads
the editor-tier `@vibesmith/recipe-canon` to find and inspect a
controller's shape; you then adapt its reference core into runtime
code (see each section below).

```ts
import { findRecipes, getRecipe } from '@vibesmith/recipe-canon';

// By category — ranked, with a scoring breakdown.
const matches = findRecipes({
  category: 'player-controller',
  intent: 'click the ground and the character paths there',
});

// Or grab one by id.
const recipe = getRecipe('player-controller.click-to-move');
```

Every controller recipe carries:

- **`params`** — a Zod schema for the recipe's knobs
  (`movementSpeed`, `slopeSpeedCurve`, `slotCount`,
  `distanceRange`, …). Single source of truth your assistant +
  the editor read.
- **`defaults`** — framework-shipped default values the reference
  impl runs against unchanged. A sensible starting feel.
- **`reference`** — the pure reference-implementation factory.
  Engine-agnostic by construction (operates on plain state +
  params, no R3F/Three coupling) so the impl runs identically in
  a Node test, a headless probe, and a `useFrame` callback.
- **`snapshot`** — the player-state slice this recipe owns
  (`movement` / `abilityBar` / `camera`) plus the pure
  capture/restore pair.

```ts
if (recipe?.kind === 'controller') {
  recipe.controllerKind;   // 'click-to-move'
  recipe.params;           // a Zod schema
  recipe.defaults;         // default params
  recipe.reference;        // createClickToMoveController
  recipe.snapshot.key;     // 'movement'
}
```

## Click-to-move

Adapt the reference core into your project (e.g.
`src/controllers/click-to-move.ts`) — copy the pure step from the
recipe and tune it — then drive it from your tick loop. Don't
import `@vibesmith/recipe-canon` here: it's editor-tier and the
`createClickToMoveController` core has no runtime-tier re-export,
so a runtime import trips the `runtime → editor` package-tier
guard. The core consumes a *resolved* click (you raycast in your
renderer) and a terrain query (typically `ctx.terrain` from the
PG-4 terrain substrate, or a stub for tests):

```ts
// src/controllers/click-to-move.ts — your adapted copy of the recipe core.
import {
  createClickToMoveController,
  CLICK_TO_MOVE_DEFAULTS,
  type TerrainQuery,
} from './click-to-move-core';

const ctrl = createClickToMoveController({
  ...CLICK_TO_MOVE_DEFAULTS,
  movementSpeed: 5.5, // tune the feel
});

// In your tick (e.g. R3F useFrame):
const next = ctrl.tick(
  { click: resolvedClick /* or null */, terrain: ctx.terrain },
  dt,
);
avatar.position.set(...next.position);
avatar.rotation.y = next.yaw;
animator.set('speed', ctrl.blend()); // 0..1 locomotion blend for N1
```

The terrain query is the only PG-4 coupling — supply anything
shaped like `{ isWalkable(p), slopeAt(p) }`. Speed slows uphill +
frees downhill via the `slopeSpeedCurve`; pathing clamps off-mask
clicks back inside `pathingRadius`. No navmesh required at MMO
overland scale.

## Ability bar

Slots bind to your `AbilityArtifact` canon ids. The recipe owns
cooldowns + resource economics; you own the artifacts + the UI:

```ts
// src/controllers/ability-bar.ts — your adapted copy of the recipe core.
import {
  createAbilityBarController,
  ABILITY_BAR_DEFAULTS,
  cooldownFraction,
} from './ability-bar-core';

const bar = createAbilityBarController(ABILITY_BAR_DEFAULTS);
bar.bind(0, 'fireball');

// Input handler — map a key code to a slot, then cast.
const slot = bar.slotForKey(event.code);  // 'Digit1' → 0
if (slot != null) {
  const result = bar.cast(slot, (id) => myAbilityLookup(id));
  if (result.ok) playAbility(result.abilityId);
  else showCastError(result.reason); // 'on-cooldown' | 'insufficient-resource' | …
}

// Per-frame UI sweep:
bar.tick(dt);
const frac = cooldownFraction(bar.state.cooldowns[0], fullCooldown);
```

`cast` returns a typed failure reason on rejection (empty slot,
on cooldown, global cooldown, not enough resource) so your HUD
can speak to the player. An optional `globalCooldown` gates every
slot after any cast.

## Follow camera

The runtime camera lives in `@vibesmith/camera`. Define a
follow-third-person virtual camera, drop it into a `<CameraRig>`
(which owns the brain — priority arbitration + ease-blended
transitions + occlusion pullback), and the rig tracks the player
for you:

```tsx
import { CameraRig, VirtualCamera } from '@vibesmith/camera/react';
import { defineVirtualCamera } from '@vibesmith/camera';

const follow = defineVirtualCamera({
  id: 'game/follow',
  priority: 10,
  lens: { fov: 50 },
  body: { kind: 'orbit', target: 'player', distance: 6, pitch: 0.5 },
  aim: { kind: 'look-at', target: 'player' },
});

<CameraRig occlusion={{ enabled: true, minDistance: 1 }}>
  <VirtualCamera {...follow} />
</CameraRig>;
```

For a controllable third-person character — input-driven,
camera-relative movement plus the idle/walk/run locomotion blend —
reach for `createThirdPersonController` from
`@vibesmith/animation-runtime/react`, which activates the follow
vcam and steers movement relative to its yaw:

```ts
import { createThirdPersonController } from '@vibesmith/animation-runtime/react';

const controller = createThirdPersonController({
  input: moveAxis,    // useAxis('move') — { current: Vec2 }
  camera: ctx.camera, // the runtime camera handle — { activate(id), yaw() }
  params: { moveSpeed: 4.5, cameraId: 'game/follow' },
});
controller.activateCamera();
// each frame: controller.tick(dt) → controller.state.position / .yaw place the
// avatar; controller.movement feeds <AnimatedCharacter movement>.
```

The recipe's input-driven orbit/zoom/damping *solver* core stays
available for retrieval (adapt it into project code if you want the
PC-1 feel knobs) — but the resting follow camera is the vcam above.
Occlusion pullback springs the camera in to the first blocker
(never closer than `minDistance`) and back out smoothly once the
view clears.

## Snapshot contract

All three recipes contribute to a single
`PlayerControllerSnapshot` (`movement` / `abilityBar` / `camera`
slices). Each slice is plain JSON, so
`@vibesmith/snapshot-driven-dev` serialises it with no custom
codec, and replay is deterministic given recorded inputs:

```ts
// The capture/restore pair travels with the adapted core in your project.
import { captureMovement, restoreMovement } from './controllers/click-to-move-core';

const snap = captureMovement(ctrl.state);   // → JSON-serialisable
const restored = restoreMovement(snap);     // identical trajectory on replay
```

`createThirdPersonController` carries its own `capture()` /
`restore()` over its movement state, so the runtime third-person
path snapshots without any editor-tier import.

## Watch out for

- **Don't put the avatar transform inside the recipe.** The
  recipe owns the controller *state machine*; your scene owns the
  mesh. Apply `state.position` / `state.yaw` / `state.eye` to your
  object each tick — don't try to make the recipe hold a Three
  object.
- **Pass the same `dt` you pass everything else.** The camera
  damping + locomotion stepping are framerate-independent, but
  only if you feed a real frame delta (seconds), not a fixed
  guess.
- **Terrain query is yours to supply.** Click-to-move's only
  hard dependency is `{ isWalkable, slopeAt }`. Wire it to
  `ctx.terrain`, your own collision, or a flat stub — the recipe
  doesn't import the terrain package.
- **Tune feel via params, not by forking the impl.** Movement
  speed, sensitivities, damping, slot count, and the slope curve
  are all params. Reach for a fork only when you need genuinely
  different *behaviour* (e.g. A-star pathing instead of the
  straight-segment reference `planPath`).

## Related

- [Animation runtime](../reference/animation-runtime.md) — the
  runtime `createThirdPersonController` + `<AnimatedCharacter>` the
  third-person path is built on.
- [Camera system](../reference/camera-system.md) — the runtime
  `defineVirtualCamera` + `createCameraBrain` + `<CameraRig>` the
  follow camera is built on.
- [Animations](animations.md) — the `<Animator>` locomotion blend
  click-to-move drives.
- [UI recipes](ui-recipes.md) — the ability-bar HUD surface.
- [Recipe canon](../reference/recipe-canon.md) — the editor-tier
  retrieve-adapt-validate substrate you discover these recipes in.
