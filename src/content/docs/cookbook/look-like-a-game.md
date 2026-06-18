---
title: 'Make it look like a game, not a web demo'
description: 'Mount the production-floor preset so a fresh scene boots with tone-mapping, a light rig + IBL, anti-aliasing, a damped camera, and an audio bed — the cohesion that separates a game from a raw WebGL canvas with HTML pasted on top.'
---

A bare React-Three-Fiber scene renders the opposite of what an
engine like Unity or Unreal gives you for free: linear-ish output
with no tone-mapping, one flat light, hard aliasing, silence, and a
DOM UI floating over the canvas. The result reads as a *cheap web
demo* — not because anything is missing in particular, but because
the image lacks **cohesion**. Engines ship an opinionated default
pipeline; this recipe gives your scene the same floor in one mount.

## Use the production-floor preset

`@vibesmith/production-defaults` composes the framework's existing
post-processing, lighting, camera, audio, and settings systems into
one opinionated — and fully overridable — default.

```tsx
import { ProductionDefaults } from '@vibesmith/production-defaults';

function World() {
  return (
    <>
      <ProductionDefaults resolveCameraTarget={resolveTarget} />
      <Scene />
    </>
  );
}
```

That single mount gives you:

- a **neutral-filmic post stack** — AgX tone-mapping + SMAA
  anti-aliasing + a touch of SSAO + gentle colour-grade + light
  vignette (tier-floored, so it degrades on weak GPUs);
- a **light rig + image-based lighting** so nothing is flat-lit;
- **tone-mapping exposure** set on the renderer;
- a **damped follow camera** instead of a naive orbit;
- an **ambient-bed audio slot** + listener sync;
- the **builtin settings groups** registered.

## It's a default, not a cage

Every pillar is an individually removable node. Want a raw or
stylised look? Drop the pieces you don't want — the preset is sugar
over the underlying artifacts, not a black box.

```tsx
// Keep the lighting + camera floor, but bring your own post stack:
<ProductionDefaults disabled={['postprocessing']} />
<MyCustomPostStack />

// Or retune a single pillar in place:
<ProductionDefaults camera={{ fov: 60, offset: [0, 3, 8] }} />
```

## Art direction vs the production floor

The line that keeps this from fighting your game: **the floor is
not art direction.** Tone-mapping, anti-aliasing, a light rig, and
camera damping don't encode a palette, a mood, or a named look —
they're *production quality*. Pick your art direction freely (swap
in one of the starter look-dev stacks, your own lighting rig, your
own grade); the floor just stops the output from reading as raw
WebGL while you do.

## Don't forget the UI

A themed HTML HUD still feels *pasted on* if it ignores the rendered
image. Three cheap wins:

- **Match typography + palette to your art direction** via the
  design tokens (`defineTheme` / `useThemeToken`), so the UI shares
  the scene's visual language.
- **Give interactions sound + motion** — wire confirm/hover SFX
  through the audio mixer and use game-feel easing on transitions,
  not browser defaults.
- **Push *hero* HUD elements in-canvas** (reticle, minimap, key
  callouts) via an in-canvas HUD layer so they share the post stack,
  instead of every pixel of UI living in a detached DOM overlay.

## Watch out for

- **Don't force it on a shipping scene.** The floor is the *default
  a scaffold inherits* and a path your AI assistant should take by
  default — not a runtime that can't be removed. A consumer who
  wants a flat or raw look deletes what they don't want.
- **The floor is tier-aware.** The neutral-filmic stack leans on
  effects valid at the `LOW` tier and gates the expensive ones
  (SSAO and up) — don't hard-pin a `HIGH`-tier effect on a budget
  device.
- **It is not a substitute for assets.** Cohesion makes good assets
  read as a game; it can't make box primitives look like one.

See also: [Add a settings menu](settings-menu.md) and the
[anti-patterns](../anti-patterns.md) catalogue.
