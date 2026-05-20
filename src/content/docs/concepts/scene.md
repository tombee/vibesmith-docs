---
title: 'Scene'
description: 'A scene is what your game looks and behaves like right now. In vibesmith there is no Scene class — "the scene" is the current composition of objects, lights, cameras, and scripts the editor is showing you.'
---

A **scene** is the world your game is showing right now — the
objects, lights, cameras, scripts, and behaviors that, together,
add up to *the thing on screen at this moment*.

If you've come from another engine, you might be used to a `Scene`
being a single file you load with `SceneManager.LoadScene("Level1")`
or open from a project panel. vibesmith doesn't work that way:
there is **no `Scene` class**.

## What a scene actually is

A scene in vibesmith is just **a React component tree mounted
inside the editor's `<Canvas>`**. Open a project, and the editor
loads `scenes/main.tsx` (or whatever you've named it), which
exports a normal React component. The component renders a tree of
[React Three Fiber](https://r3f.docs.pmnd.rs/) JSX — `<mesh>`,
`<group>`, `<directionalLight>`, `<perspectiveCamera>` — plus any
custom components you've written.

```tsx
// scenes/main.tsx
export default function MainScene() {
  return (
    <>
      <directionalLight position={[5, 10, 5]} />
      <mesh position={[0, 0.5, 0]} script="spin-cube">
        <boxGeometry />
        <meshStandardMaterial color="orange" />
      </mesh>
    </>
  );
}
```

That's the scene. The cube, the light, and the script attached to
the cube. When the editor mounts this component, that becomes the
running game.

## Why no `Scene` class?

Three reasons:

1. **It's already React.** R3F gives us a scene-graph for free —
   the JSX tree *is* the scene. Inventing a parallel `Scene`
   container would duplicate React's job.
2. **No proprietary serialisation.** A scene is a `.tsx` file in
   your repo. Git diffs work. AI assistants read it. You can
   refactor it like any other component.
3. **Multiple scene patterns work.** You can render one scene
   component, swap between two, embed a sub-scene inside another,
   or compose scenes from smaller scene components. All of that
   is just React.

## "The current scene" vs "a scene file"

When you read *"the scene"* in vibesmith docs, it usually means
**the currently-mounted scene tree** — what the editor is drawing
right now. When you read *"a scene file"*, it means **a `.tsx`
component you can mount as a scene**.

A project can have many scene files (`scenes/menu.tsx`,
`scenes/level-01.tsx`, etc.) and switch between them at runtime
the same way any React app switches between routes.

## Snapshots, not scene saves

If you want to launch the editor into *a particular state* of a
scene — the player at a specific position, an enemy mid-attack,
a particular inventory loadout — that's not a different scene
file. That's a [snapshot](snapshot). Same scene file, different
captured state.

## What a scene contains

- **Visible things** — meshes (`<mesh>`), models loaded from
  `.glb` files, sprites, particle systems.
- **Lights and cameras** — `<directionalLight>`,
  `<perspectiveCamera>`, ambient + environment maps.
- **Behavior** — [scripts](script) attached to objects via a
  `script="<id>"` prop. The cube's `script="spin-cube"` is how
  it knows to rotate.
- **Helpers** — debug visualisations, grid overlays, gizmo
  handles. The editor adds many of these itself; you don't have
  to.

## Next

- [Script](script) — what `script="spin-cube"` actually does.
- [Snapshot](snapshot) — how to save + restore scene state.
- [Engine patterns](/vibesmith-docs/reference/engine-patterns/) —
  Unity `Scene` / Godot scene tree / Unreal Level → vibesmith
  equivalents.
- [Scene construction](/vibesmith-docs/reference/scene-construction/)
  — the deeper *recipe → generator → composition* pipeline for
  AI-authored scenes.
