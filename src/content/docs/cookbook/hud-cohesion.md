---
title: "Don't forget the UI — make the HUD part of the game"
description: 'Make a DOM/React HUD cohere with the scene by default — interaction sound through the ui bus (useUiSound), game-feel transitions (HudTransition / useTween), and a palette derived from the lit scene (SceneThemeBridge) — all overridable, all reduced-motion-safe.'
---

You shipped the production floor — the
*rendered image* coheres: tone-mapped, anti-aliased, lit, a damped
camera. Then you drop a HUD on top and it reads as a **webpage pasted
over a game**: it's silent, it fades with the browser's linear easing,
and its palette has nothing to do with the scene behind it.

That's the same gap the production floor closed one layer down — and
the fix is the same shape: **defaults, not a rewrite.** The HUD stays a
[DOM overlay](../reference/hud-primitives/) (accessibility, font
rendering, and input tooling are real wins you keep). Three small
defaults from `@vibesmith/runtime` make it feel *part of the game*:

| Tell | Default | Surface |
| --- | --- | --- |
| Controls are silent | Interaction sound through the `ui` mixer bus | `useUiSound()` |
| Transitions ease like a webpage | Game-feel easing, reduced-motion-safe | `<HudTransition>` / `useTween()` |
| Palette unrelated to the scene | Colours derived from the lit scene | `<SceneThemeBridge>` |

Each is **mechanism, not personality**: silent until *you* supply a
sound, per-control opt-out, reduced-motion-safe, and every derived token
is overridable so a brand palette can pin what it owns.

## 1. Controls make game sound

Bind interaction sound through `useUiSound()` — it routes the `ui`
mixer bus, so the player's UI-volume / mute settings apply, and it's
**silent until you register a `ui/*` asset** (no asset ⇒ a no-op, never
a throw). Don't reach for `new Audio('/click.wav')`: that bypasses the
mixer entirely.

```tsx
import { useUiSound } from '@vibesmith/runtime';

function MenuButton({ children, onClick }) {
  const ui = useUiSound();
  return (
    <button {...ui.bind('confirm')} onClick={onClick}>
      {children}
    </button>
  );
}
```

`bind(kind)` wires `onClick` / `onPointerEnter` for the standard kinds
(`confirm`, `hover`, `back`, `error`); a control you want silent simply
doesn't bind.

## 2. Transitions ease with game feel

Use `<HudTransition>` for mount/menu transitions instead of a
browser-default `transition: opacity 0.2s`. It fades + lifts its
children in over a timeline-core easing,
and it's a **safe default**: under `prefers-reduced-motion`, SSR, or a
headless test it renders its children unwrapped — no motion, no extra
DOM. Opt a subtree out with `enabled={false}`.

```tsx
import { HudTransition } from '@vibesmith/runtime';

<HudTransition>
  <PausePanel />
</HudTransition>
```

For custom motion, `useTween(from, to, { durationMs, easing })` returns
the eased value each frame and snaps straight to `to` under reduced
motion; `useReducedMotion()` lets you branch your own. **Never animate
regardless of the reduced-motion preference** — a transition that
ignores it is a defect.

## 3. The palette tracks the lit scene

Derive the HUD's colours from the same `LightingArtifact` the scene
renders, so the chrome picks up the key light's hue and panel/text
contrast track the scene's brightness. Drop `<SceneThemeBridge>`
*inside* your existing `<ThemeProvider>` (fonts/radii inherit) and
*around* the HUD:

```tsx
import { ThemeProvider, SceneThemeBridge, useThemeToken } from '@vibesmith/runtime';

<ThemeProvider theme={appTheme}>
  <SceneThemeBridge lighting={outdoorDaylight}>
    <GameHud />   {/* useThemeToken('color/accent') tracks the key light */}
  </SceneThemeBridge>
</ThemeProvider>
```

It derives only `color/accent` / `color/surface` / `color/text` — the
three it can defend as "track the scene." **Fonts, radii, spacing, and
brand colours stay yours**, and any derived token is overridable:

```tsx
<SceneThemeBridge lighting={scene} overrides={{ 'color/accent': brand.purple }}>
```

Read colours through `useThemeToken('color/...')` rather than
hard-coding hex, so a theme or scene swap flows through.

## The boundary — mechanism, not personality

vibesmith owns the *production floor* (cohesion, contrast, game-feel
motion) but never your *art direction*. These defaults are neutral until
you supply content and overridable control-by-control — they make the
HUD belong to the game without dictating how your game looks or sounds.
The HUD stays a DOM overlay; pushing a *hero* element in-canvas (to
share the post grade) is a separate, tier-gated opt-in, not the default.

Run a candidate HUD through the `hud-cohesion-critic` (a maintainer
gate) to confirm it reaches for these defaults and keeps them
overridable + reduced-motion-safe.

## See also

- [HUD primitives](../reference/hud-primitives/) — `useUiSound`,
  `<HudTransition>` / `useTween`, `<SceneThemeBridge>`, and the theme /
  anchor primitives they build on.
- [UI recipes](./ui-recipes/) — game-agnostic inventory / dialogue /
  card-grid recipes to adapt into the themed HUD.
- [UI-heavy consumers](../reference/ui-heavy-consumers/) — the
  DOM-overlay stance, HUD lifecycle, and the skin/theme contract for
  UI-dense games.
