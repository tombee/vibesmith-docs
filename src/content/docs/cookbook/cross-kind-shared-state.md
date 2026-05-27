---
title: 'Cross-kind shared state (WorldModelStore)'
description: 'Multiple scene-node kinds need to read the same computed state every frame — a layout pass, a hit-test, an overlay. registerWorldModelStore is the primitive; this recipe shows when to reach for it, how to wire publisher + subscribers, and the lifecycle rules that keep it HMR-safe.'
---

When two or more sibling subtrees in your scene need to read the
same computed state — a layout-engine output, a derived camera
transform, a NavMesh query result — you have three obvious
options:

1. **Prop-drill** through a common ancestor. Works for small
   trees, breaks once the kinds are top-level scene nodes
   mounted by the SceneRenderer (no shared React ancestor).
2. **A new global Zustand store** the consumer creates. Fine
   for purely game-internal state, but the inspector + MCP
   tools won't see it, and you've reinvented the wheel.
3. **`registerWorldModelStore`** — the framework primitive.
   One subscribable container, registered once, read from any
   kind via React's `useSyncExternalStore`. The inspector
   panel picks it up for free, and the AI assistant can read
   + write through the `world_model_*` MCP tools.

This recipe walks through option 3: one publisher kind that
computes layout positions, two subscriber kinds that read the
same `Map<entityId, Vec3>` in the same frame.

## When to use this (vs a plain Zustand store)

Use `registerWorldModelStore` when **any** of these hold:

- More than one scene-node kind needs to read the state.
- You want the world-model inspector panel to show it.
- You want your AI assistant to read or edit it via MCP.
- You want the state to participate in scenario capture /
  replay (the inspector + MCP-tooling pipeline understands
  registered stores; an unregistered Zustand singleton is
  invisible to it).

Use a plain consumer-local Zustand store when:

- The state is *internal* to one kind (a panel's expanded
  state, a hover highlight). No other kind reads it.
- The state should *not* surface in the inspector (transient
  UI state, internal caches).

The framework recommends Zustand-shaped stores but doesn't
require them — anything satisfying the `SubscribableStore<T>`
contract (`getState` / `setState` / `subscribe`) works.

## The shape

### 1. Define the store + register it

Put this in your project entry script (`scripts/project.ts` or
similar). Module side-effects register the store once, on
project open.

```ts
import { create } from 'zustand';
import { registerWorldModelStore } from '@vibesmith/runtime';
import { z } from 'zod';

/** What every consumer reads. Computed by the layout kind below. */
export interface EntityLayout {
  /** entityId → world position. */
  positions: Record<string, [number, number, number]>;
  /** Wall-clock seconds the layout was last recomputed. */
  computedAt: number;
}

export const useEntityLayout = create<EntityLayout>(() => ({
  positions: {},
  computedAt: 0,
}));

// Optional Zod schema — when supplied, the world-model
// inspector renders structured controls; without it, a
// read-only JSON tree. Skip the schema for opaque or
// large-volume state; supply it when authors should be
// able to scrub fields by hand.
registerWorldModelStore('game/entity-layout', useEntityLayout, {
  label: 'Entity layout',
  schema: z.object({
    positions: z.record(z.tuple([z.number(), z.number(), z.number()])),
    computedAt: z.number(),
  }),
});
```

### 2. Publish from one kind

The layout kind computes positions every frame and writes them
into the store. This is the *only* writer; subscribers below
are read-only.

```tsx
import { defineSceneNodeKind } from '@vibesmith/runtime';
import { useFrame } from '@react-three/fiber';
import { z } from 'zod';
import { useEntityLayout } from '../scripts/project';

defineSceneNodeKind({
  id: 'game/layout-engine',
  params: z.object({
    /** How many entities the layout solves for. */
    count: z.number().int().min(1).default(8),
  }),
  renderJsx: ({ count }) => <LayoutEngine count={count} />,
});

function LayoutEngine({ count }: { count: number }): null {
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const positions: Record<string, [number, number, number]> = {};
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + t * 0.5;
      positions[`e${i}`] = [Math.cos(angle) * 3, 0, Math.sin(angle) * 3];
    }
    useEntityLayout.setState({ positions, computedAt: t });
  });
  return null;
}
```

### 3. Subscribe from multiple kinds

Each subscriber kind reads the same store via
`useSyncExternalStore`. The hook handles re-rendering when
the snapshot identity changes; the cached snapshot returned
by `getState` keeps React from looping (see the
[`useSyncExternalStore` contract note](#why-the-snapshot-must-be-stable)
below).

```tsx
import { defineSceneNodeKind } from '@vibesmith/runtime';
import { useSyncExternalStore } from 'react';
import { z } from 'zod';
import { useEntityLayout, type EntityLayout } from '../scripts/project';

/** Render an instanced mesh at every entity position. */
defineSceneNodeKind({
  id: 'game/entity-renderer',
  params: z.object({}),
  renderJsx: () => <EntityRenderer />,
});

function EntityRenderer(): JSX.Element {
  const layout = useSyncExternalStore(
    (cb) => useEntityLayout.subscribe(cb),
    () => useEntityLayout.getState(),
    () => useEntityLayout.getState(),
  );
  return (
    <group>
      {Object.entries(layout.positions).map(([id, [x, y, z]]) => (
        <mesh key={id} position={[x, y, z]}>
          <sphereGeometry args={[0.2]} />
          <meshStandardMaterial color="orange" />
        </mesh>
      ))}
    </group>
  );
}

/** Render screen-space labels above each entity. */
defineSceneNodeKind({
  id: 'game/entity-labels',
  params: z.object({}),
  renderJsx: () => <EntityLabels />,
});

function EntityLabels(): JSX.Element {
  const layout = useSyncExternalStore(
    (cb) => useEntityLayout.subscribe(cb),
    () => useEntityLayout.getState(),
    () => useEntityLayout.getState(),
  );
  // Read positions for label placement; same source of truth as
  // EntityRenderer above. Both kinds see the same frame.
  return (
    <group>
      {Object.keys(layout.positions).map((id) => (
        <EntityLabel key={id} id={id} />
      ))}
    </group>
  );
}

function EntityLabel({ id }: { id: string }): JSX.Element {
  // ... your label rendering (Html drei helper, sprite, etc.)
  return <group userData={{ entity: id }} />;
}
```

The scene JSON mounts all three kinds as siblings:

```json
{
  "nodes": [
    { "id": "layout-1",   "kind": "game/layout-engine",  "params": { "count": 12 } },
    { "id": "renderer-1", "kind": "game/entity-renderer", "params": {} },
    { "id": "labels-1",   "kind": "game/entity-labels",   "params": {} }
  ]
}
```

The publisher and both subscribers see the same `positions`
map every frame. No prop chain, no shared ancestor, no
duplicated computation.

## Imperative reads from outside React

Game scripts, MCP tool handlers, and other non-React callers
read the same store synchronously via `getWorldModelStore`:

```ts
import { getWorldModelStore } from '@vibesmith/runtime';

const entry = getWorldModelStore('game/entity-layout');
if (entry) {
  const state = entry.store.getState() as EntityLayout;
  // raycast against state.positions, score a hit, dispatch an intent, …
}
```

Returns `null` if no store is registered under that id — a
typo-resistant boundary you can branch on.

## Why the snapshot must be stable

`useSyncExternalStore`'s third argument (the
`getServerSnapshot`) is called on every render to compare
identities via `Object.is`. If the store's `getState()`
returns a fresh reference on every call, React 18 detects the
churn and throws `getSnapshot should be cached until …`.

Zustand satisfies this by default — `useEntityLayout.getState()`
returns the *same* reference until a `setState` actually
mutates the store. If you roll your own subscribable store,
mirror this: hold the current state in a closure variable,
return the *same* reference until a mutation happens.

The framework's own `listWorldModelStores` enforces this
discipline too — it caches the entries array and only rebuilds
it when the entry set changes. Both directions of the
publish-subscribe edge need stable identity to avoid
re-render storms.

## Lifecycle: registration, HMR, kind unmount

### Where to register

Project entry script (`scripts/project.ts`). Side-effect at
module top level. The framework dynamic-imports your project
script on open; the `registerWorldModelStore` call runs once.

Do **not** call `registerWorldModelStore` inside a kind's
`renderJsx` or a React effect — that would re-register on every
mount and lose the single-source-of-truth guarantee. Stores
are project-scoped, not kind-scoped.

### HMR (script hot-reload)

`registerWorldModelStore` is **idempotent on the id** —
re-registering with the same id replaces the entry. When the
project script reloads (the editor watches for source changes
and re-bundles), the new registration drops in cleanly and
the inspector / MCP surface picks up the fresh entry. The
returned unregister fn is a no-op if the entry has already
been replaced, so leaking it across reloads is harmless.

Subscriber kinds keep their `useSyncExternalStore` hook
pointed at the Zustand store reference your project exports.
Because the store reference itself survives module reload (it
lives in a `create()` closure that the bundler re-evaluates,
producing a *new* store each time), you do have to re-fetch
the import after reload — practically: reload the page or use
React Fast Refresh for the subscriber components. The
framework's editor reload path handles this for you.

### Kind unmount / remount

When a SceneRenderer-mounted kind unmounts (scene swap,
hierarchy edit, scenario load), its `useSyncExternalStore`
subscription cleans up automatically — the
`useEntityLayout.subscribe(cb)` returns an unsubscribe fn
that React calls on effect teardown. The store itself
persists; the next mounted instance of the kind re-subscribes
from the current state.

This is the load-bearing reason to keep the store registered
at *project* scope, not kind scope. A kind that registered
its own store in `renderJsx` would drop the store every time
the kind unmounted, taking every other subscriber's state
with it.

## Watch out for

- **Don't register inside a render function.** As above —
  registration is a project-scope side-effect. Inside
  `renderJsx` you'd re-register on every mount + churn the
  inspector.
- **Don't mutate the snapshot in place.** Subscribers receive
  the live state reference; mutating it bypasses the
  subscribe path and other readers won't see the change. Use
  `store.setState({ ... })` with a fresh object.
- **Don't use the store as an event bus.** It's a *state*
  store — writes that don't change the snapshot identity
  won't notify subscribers. For one-shot signals between
  scripts, use the framework's intent / signal surface
  ([`ctx.dispatch`](/vibesmith-docs/concepts/intent/) /
  [`ctx.signal`](/vibesmith-docs/concepts/signal/)) rather
  than poking a counter in a registered store.
- **Don't put non-serialisable values in the store** (THREE
  objects, DOM nodes, function refs) if you want scenario
  capture / MCP read to work. Stick to JSON-shaped values;
  resolve handles on read.
- **One id per store.** Re-registering with the same id
  replaces the entry — fine for HMR, accidental on copy-paste.
  Use distinct ids like `game/entity-layout`,
  `game/inventory`, `game/quest-progress`.

## Related

- [Inspectable parameters](inspectable-parameters.md) —
  the same Zod-schema-as-source-of-truth pattern, applied to
  `defineGameScript` parameters.
- [Writing a game script](writing-game-scripts.md) — where
  the project entry script lives and how it's loaded.
- [Anti-patterns](../anti-patterns.md) — module-level globals
  vs registered stores.
