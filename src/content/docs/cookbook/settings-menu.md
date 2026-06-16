---
title: 'Add a settings menu'
description: 'Configure video / sound / input settings with @vibesmith/settings — register the builtin groups, extend with your own, and render a menu off listSettings(). A sensible default you modify, extend, or replace.'
---

Players expect a settings screen with the controls they know from
every other game: a Quality preset, V-Sync, volume sliders, key
rebinds. `@vibesmith/settings` ships the **library** for that — the
schema, the persisted store, and the apply-wiring — with a sensible
default you tailor to your project. It does **not** ship a fixed
menu UI; rendering is your call.

## 1. Configure the settings

Register the builtin groups (video / audio / controls /
accessibility), declare which conditional graphics controls your
project actually uses, and extend with your own group.

```ts
import {
  createSettingsStore,
  defineSettings,
  listSettings,
  registerBuiltinSettings,
  z,
} from '@vibesmith/settings';

export function createProjectSettingsStore() {
  // Sensible default. `video.features` declares the conditional
  // graphics controls you support — omit one and its toggle
  // disappears from the menu (no dead toggles). Audio volumes are
  // derived from your registered mixer buses, not hardcoded.
  registerBuiltinSettings({
    video: { features: { shadows: true, postFx: true } },
  });

  // Extend with a project-specific group — `defineSettings` is the
  // single mechanism; replacing or dropping a builtin works the
  // same way.
  defineSettings({
    id: 'gameplay',
    label: 'Gameplay',
    schema: z.object({
      difficulty: z.enum(['story', 'normal', 'hard']),
      tutorialHints: z.boolean(),
    }),
    defaults: { difficulty: 'normal', tutorialHints: true },
  });

  return createSettingsStore();
}

export const groups = () => listSettings(); // drives the menu
```

## 2. Render a menu over it

`listSettings()` tells you what to draw; `useSettingsValue(store,
groupId)` binds a control to a group (validated + persisted on
write). A plain DOM/React menu is the idiomatic choice — the
framework's in-game UI is a DOM overlay.

```tsx
import { useSettingsValue } from '@vibesmith/settings/react';

function GraphicsPanel({ store }) {
  const [video, setVideo] = useSettingsValue(store, 'video');
  return (
    <>
      <select
        value={video.graphics.quality}
        onChange={(e) =>
          void setVideo({ graphics: { ...video.graphics, quality: e.target.value } })
        }
      >
        {['auto', 'LOW', 'MEDIUM', 'HIGH', 'ULTRA'].map((q) => (
          <option key={q} value={q}>{q}</option>
        ))}
      </select>
      <label>
        V-Sync
        <input type="checkbox" checked={video.vsync}
          onChange={() => void setVideo({ vsync: !video.vsync })} />
      </label>
      {/* Max FPS + Render Scale follow the same pattern. */}
    </>
  );
}
```

## The graphics panel mirrors Unity/Unreal

Lead with a **Quality** preset (`Auto / Low / Medium / High /
Ultra`) — it exposes the adaptive-rendering tiers, which are the
real budget authority — then layer individual overrides on top
(V-Sync, Max FPS, Render Scale, Shadows, Post-FX). Familiar names
mean players (and AI assistants) already know what each control
does.

A complete, runnable version lives in the framework repo at
`examples/settings-menu/` — copy it and restyle, or write your own
over the same store.

## Watch out for

- **Audio volumes follow your buses.** Register the audio group
  against your mixer's buses; adding a `voice` or `ui` bus yields a
  matching slider — don't hardcode a fixed list.
- **Graphics controls are conditional.** A shadows toggle only
  belongs in the menu if something casts shadows. Surface only what
  `video.features` declares — dead toggles read as broken.
- **It's a library, not a blessed UI.** Reuse the store + groups +
  `listSettings()`; the menu component is yours to own. Restyle it
  with the [design tokens](ui-recipes.md), or replace it entirely.

See also: [Make it look like a game](look-like-a-game.md).
