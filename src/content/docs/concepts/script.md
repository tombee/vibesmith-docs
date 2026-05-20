---
title: 'Script'
description: 'A script is a piece of code attached to an object in your scene that runs every frame. In vibesmith scripts are registered via defineGameScript and bound to scene nodes by id.'
---

A **script** is code that runs every frame on a part of your
[scene](scene) — typically attached to one object (a player
character, a moving platform, a camera follow rig). If the object
mounts, the script's `onMount` runs. If the frame ticks, the
script's `onTick` runs. If the object unmounts, the script's
`onUnmount` runs.

That's the whole loop.

## What a script looks like

Inside `scripts/project.ts`:

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

You give the script an `id` (`"spin-cube"`), define what it does
(`onTick` rotates the attached object), and **bind it to a scene
node** by setting `script="spin-cube"` on the JSX:

```tsx
<mesh script="spin-cube">
  <boxGeometry />
  <meshStandardMaterial color="orange" />
</mesh>
```

When the editor mounts that mesh, the runtime registers `spin-cube`
against the live Three.js object, and the cube starts rotating.

## Why is it just a function?

If you've come from Unity or Unreal, you might expect a script to
be a class you inherit from (`MonoBehaviour`, `AActor`). vibesmith
deliberately doesn't do that:

- **No class hierarchy to learn.** A script is a plain function.
  The framework calls it; it doesn't call up into a base class.
- **AI assistants read this better.** A plain function with named
  hooks is unambiguous to an AI reading your codebase — there's no
  invisible parent class smuggling behavior in.
- **TypeScript types do the work.** The `ctx` parameter is fully
  typed; your IDE / AI assistant tells you what's on it without
  having to know "what does `MonoBehaviour.OnTriggerEnter` mean."

## The lifecycle

| Hook | When it runs |
|------|--------------|
| `onMount` | Once when the object the script is attached to mounts. |
| `onTick` | Once per frame while the project is playing. `dt` is seconds since last frame. |
| `onIntent` | When an [intent](intent) is dispatched at this object. |
| `onUnmount` | Once when the object unmounts. |

You only define the hooks you need. A purely-visual rotator only
needs `onTick`. A character controller might use `onMount` +
`onTick` + `onIntent` + `onUnmount`.

## What can a script do?

Inside a hook, `ctx.object3D` is the live Three.js node — you can
mutate `position`, `rotation`, `scale` directly. `ctx.time` is
wall-clock seconds. `ctx.dispatch(intent)` sends an
[intent](intent) into the project's network adapter.

What it **shouldn't** do is reach across the scene to mutate
*other* objects. Scripts are per-object; if behavior is global
(turn off the lights, start a cutscene), prefer an [intent](intent)
or [signal](signal) so the change has a name.

## The deeper *why*

Scripts are the framework's only way to add per-frame behavior to
a scene. Everything else — animations, physics, audio — surfaces
through the same `ctx` object inside a script, so the script
becomes the place an AI assistant can reason about *all* the
moving parts of one object in one read.

## Next

- [Writing a game script](/vibesmith-docs/cookbook/writing-game-scripts/)
  — the working-code cookbook recipe.
- [Inspectable parameters](/vibesmith-docs/cookbook/inspectable-parameters/)
  — declare tweakable values that show up in the inspector panel.
- [Intent](intent) — how scripts react to player actions.
- [Engine patterns](/vibesmith-docs/reference/engine-patterns/) —
  Unity `MonoBehaviour` / Godot `Node._process` / Unreal
  `AActor::Tick` → vibesmith equivalents.
