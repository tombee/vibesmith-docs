---
title: 'HUD primitives — theme, screen anchor, world anchor'
description: 'The three HUD authoring primitives in @vibesmith/runtime: defineTheme (design tokens → CSS custom properties), HudAnchor (nine-preset screen-space layout with safe-area + per-axis inset), and WorldAnchor / WorldLabel / WorldAnchorList (world-to-screen projection for nameplates, damage numbers, waypoints, follow-the-card labels). Token-key + value-shape conventions, projection formula, behind / clamp policies, batched N-entry variant, error codes.'
---

The framework's HUD layout + theming surface. These three
primitives sit *below* the [HUD lifecycle model](/reference/hud-lifecycle/):
the lifecycle answers *when* a HUD mounts; these answer *how* its
content is themed and positioned once mounted. A `defineSceneHud`
body is a normal React tree that composes them.

All three are **DOM-overlay** primitives — the React tree above
the WebGL canvas. None touch the in-canvas R3F render pass.

Exported from `@vibesmith/runtime`.

## At a glance

| Primitive | Concern | Cross-engine analogue |
|-----------|---------|-----------------------|
| `defineTheme({ id, tokens })` | Design tokens → CSS custom properties | Unity USS variables · Godot `Theme` resource · Unreal Slate style set |
| `<HudAnchor edge inset safeArea>` | Screen-space corner / edge / centre placement | Unity `RectTransform` anchor presets · Godot `Control` anchors · Unreal Canvas Slot anchors |
| `<WorldAnchor target={vec3}>` | Project one 3D world position to a DOM node each frame | Unity World-Space Canvas · Unreal `UWidgetComponent` (World) · Godot `unproject_position` |
| `<WorldLabel target text>` | Text-bubble convenience over `WorldAnchor` | as above |
| `<WorldAnchorList entries renderItem>` | Project N world positions in one pass | as above, batched |

The `edge` enum, `target` shapes, and token keys are all chosen
so a single field flips unambiguously — an AI assistant editing a
HUD writes `edge="top-right"`, not an opaque anchor tuple.

## defineTheme — the token bridge

`defineTheme({ id, tokens })` registers a flat design-token map
and returns an opaque `Theme<T>`. `<ThemeProvider theme>` injects
the tokens as `--vbsm-*` CSS custom properties on a wrapper
element; `useThemeToken(key)` returns the `var(--vbsm-…)`
reference string. No CSS-in-JS dependency — plain custom-property
injection that CSS Modules, Tailwind arbitrary values, and inline
styles all consume identically.

```ts
const theme = defineTheme({
  id: 'mygame/dark',
  tokens: {
    'color/accent':   '#7c3aed',
    'color/surface':  '#1a1a2e',
    'font/display':   'Inter, ui-sans-serif, sans-serif',
    'radius/card':    '8px',
    'spacing/gutter': '16px',
  },
});
```

### Token-key convention

- Flat map, string keys only.
- Keys are slash-namespaced kebab-case: `color/accent`,
  `font/display`, `spacing/gutter` (regex
  `^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)+$`).
- Injected CSS var: `color/accent` → `--vbsm-color-accent`.
- Keys that miss the pattern throw `ThemeDefinitionError`
  (`THEME_INVALID_TOKEN_KEY`) at `defineTheme` time.

### Token-value shapes

- **Flat string** (default) — any CSS value passes through
  verbatim (`'#7c3aed'`, `'16px'`, `'Inter, sans-serif'`).
- **Single `GradientShape`** — one of `linear-gradient`,
  `radial-gradient`, `conic-gradient`; composed into a CSS
  gradient call at read time.
- **`GradientShape[]`** — a layered `background`; layers join
  with commas in CSS background-layer order (first entry = top
  layer).

```ts
'background/env': [
  { kind: 'radial-gradient', position: [50, 30], stops: [
    { color: 'rgba(124, 58, 237, 0.4)' },
    { color: 'transparent', position: 70 },
  ]},
],
```

`composeTokenValue(value)` is exported so tooling can render the
same CSS string outside React (preview swatches).

### Reading tokens

```tsx
function Card() {
  return (
    <div style={{
      background: useThemeToken('color/surface'),
      borderRadius: useThemeToken('radius/card'),
    }}>…</div>
  );
}
```

`useThemeToken` throws `ThemeDefinitionError` when called outside
a `<ThemeProvider>` (`THEME_NO_PROVIDER`) or for an unknown key
(`THEME_MISSING_TOKEN`) — a mistyped key surfaces immediately
rather than silently rendering the CSS initial value.
`makeUseThemeToken(theme)` returns a variant whose `key` is
narrowed to `keyof T` for compile-time checking.

### Active theme + auto-mount boundary

The runtime holds at most one *active* theme in a subscribable
store:

- `setActiveTheme(id)` — swap the active theme (light/dark,
  high-contrast). Throws if the id was never `defineTheme`'d.
- `getActiveThemeId()` / `subscribeActiveTheme(fn)` /
  `useActiveTheme()` — read + subscribe surfaces.
- `<ActiveThemeBoundary>` — chrome-root boundary that
  auto-mounts a `<ThemeProvider>` for the active theme. Uses
  `display: contents` so it never interrupts an ancestor's
  flex/grid sizing chain, and keeps a stable tree shape across
  theme presence so the subtree isn't unmounted on a theme swap.
- `clearThemeRegistry()` — reset on project close.

## HudAnchor — screen-space layout

CSS-only, DOM-only. Anchors children to one of the nine standard
preset positions inside a `position: relative | fixed` parent
(the HUD root). No dependency on `<ThemeProvider>`.

```tsx
<HudAnchor edge="bottom-left" inset={16} safeArea>
  <MiniMap />
</HudAnchor>
```

| Prop | Type | Notes |
|------|------|-------|
| `edge` | `'top-left' \| 'top-center' \| 'top-right' \| 'center-left' \| 'center' \| 'center-right' \| 'bottom-left' \| 'bottom-center' \| 'bottom-right'` | The nine RectTransform-style presets. |
| `inset` | `number \| { x?, y? }` | Distance (px) from the anchored edge(s). For `*-center` edges, an additional offset along the centre axis. Defaults to `0`. |
| `safeArea` | `boolean` | Adds `env(safe-area-inset-*)` to the anchored edges (notch / nav-bar). Defaults to `false`. |
| `pointerEvents` | `'auto' \| 'none'` | Wrapper default `'none'` so overlapping anchors don't block click-through; children always get `pointer-events: auto`. |
| `className` / `style` | — | Forwarded to the wrapper. |

Token composition is opt-in via `style` — drive `inset` from a
token by passing a CSS-var-backed inline style rather than
coupling the primitive to the theme context.

## WorldAnchor — world-to-screen projection

Projects a 3D world position into DOM pixel space each frame and
writes it via a direct `style.transform` ref mutation — no React
state, no per-frame re-render (the drei `<Html>` pattern). The
component re-renders only when its *props* change.

```tsx
import { useFrame, useThree } from '@react-three/fiber';

function Nameplate({ enemy }) {
  const { camera, viewport } = useThree();
  return (
    <WorldAnchor
      target={enemy.mesh}
      camera={camera}
      viewport={viewport}
      useFrame={useFrame}
      behind="hidden"
    >
      <NameplateHud name={enemy.name} hp={enemy.hp} />
    </WorldAnchor>
  );
}
```

The `camera` / `viewport` / `useFrame` triple is supplied by the
consumer rather than read from a global singleton, so the
primitive is testable without a real r3f scene.

| Prop | Type | Notes |
|------|------|-------|
| `target` | `[x,y,z] \| {x,y,z} \| Object3D` | An `Object3D` is tracked by its `.position` each frame. |
| `camera` | `ProjectionCamera` | `{ project(vec): vec }` — THREE.Camera-compatible. |
| `viewport` | `{ width, height }` | CSS pixels. |
| `useFrame` | `UseFrameFn` | r3f `useFrame`-compatible per-frame scheduler. |
| `offset` | `{ x?, y? }` | Pixel nudge after projection, before clamp. |
| `behind` | `'hidden' \| 'visible' \| 'fade'` | What to do when the point is behind the camera (NDC z > 1). `'hidden'` is the default. `'fade'` ramps opacity to 0 at z = 2. |
| `clamp` | `{ mode: 'off' \| 'edge' \| 'circle', radius? }` | Keep off-screen points on-screen. `'circle'` radius defaults to `min(w, h) * 0.4`. |

Projection formula:

```
ndc    = camera.project(target)
pixelX = (ndc.x * 0.5 + 0.5) * viewport.width
pixelY = (1 - (ndc.y * 0.5 + 0.5)) * viewport.height
behind = ndc.z > 1
```

The pure helpers (`projectToPixel`, `clampToEdge`,
`clampToCircle`, `behindFadeOpacity`, `resolveTargetPosition`)
are exported for reuse / testing.

### WorldLabel — text convenience wrapper

A thin text-bubble over `WorldAnchor` for nameplates, callouts,
debug overlays:

```tsx
<WorldLabel target={mesh} text={character.name} behind="hidden" />
```

Optional `themeToken` emits `data-theme-token="<id>"` so CSS can
target the label via `[data-theme-token="…"]`.

### WorldAnchorList — batched N-entry variant

For N > ~20 tracked positions (hit-testing layers, E2E `data-id`
hooks, damage numbers across a crowd), one `<WorldAnchorList>`
shares a single `useFrame` subscription and a single scratch
vector across the whole batch — one projection pass per frame, no
per-entry `Object3D` allocation, no per-frame re-render.

```tsx
<WorldAnchorList
  entries={positions}            // Map<id, target> or Record<id, target>
  camera={camera}
  viewport={viewport}
  useFrame={useFrame}
  renderItem={(id) => (
    <div data-entity-id={id}
         style={{ width: 32, height: 32, pointerEvents: 'auto' }}
         onPointerDown={() => selectEntity(id)} />
  )}
/>
```

The map's id strings drive stable React keys, so add / remove is
O(adds + removes) diff work. Pass `containerRef` instead of
`viewport` to let the list own a single `ResizeObserver`. Each
`renderItem` call receives the latest `WorldAnchorScreenRect`
(`{ x, y, z, isBehind, isOffscreen }`). Below ~10–20 entries,
prefer plain `<WorldAnchor>`. See the
[batching cookbook recipe](/cookbook/world-anchor-batching/) for
the full walkthrough.

## Composition

A typical world-space nameplate composes all three primitives —
`defineTheme` for colour / typography tokens, `<WorldAnchor>` for
placement, and the token bridge inside the rendered subtree:

```tsx
const ui = defineTheme({ id: 'mygame/ui', tokens: {
  'color/nameplate': '#e0e0ff',
  'font/nameplate':  'Inter, sans-serif',
}});

function Plate({ name }) {
  return (
    <span style={{
      color: useThemeToken('color/nameplate'),
      font:  useThemeToken('font/nameplate'),
    }}>{name}</span>
  );
}

// inside a scene HUD, under <ActiveThemeBoundary>:
<WorldAnchor target={mesh} camera={camera} viewport={viewport} useFrame={useFrame}>
  <Plate name={enemy.name} />
</WorldAnchor>
```

Screen-space chrome (action bars, status corners) uses
`<HudAnchor>` instead of `<WorldAnchor>` for the same token-driven
content.

## Errors

`ThemeDefinitionError` carries a machine-readable `code` for
typed editor diagnostics:

| Code | Raised by |
|------|-----------|
| `THEME_INVALID_ID` | `defineTheme` — id fails `<owner>/<surface>`. |
| `THEME_INVALID_TOKEN_KEY` | `defineTheme` — key fails the kebab-slash pattern. |
| `THEME_INVALID_TOKEN_VALUE` | `defineTheme` — malformed `GradientShape`. |
| `THEME_DUPLICATE_ID` | `defineTheme` — same id, different tokens. |
| `THEME_MISSING_TOKEN` | `useThemeToken` (unknown key) / `setActiveTheme` (unregistered id). |
| `THEME_NO_PROVIDER` | `useThemeToken` outside a `<ThemeProvider>`. |

`HudAnchor` and `WorldAnchor` do not throw — invalid props fall
back to defaults (`inset 0`, `behind 'hidden'`, `clamp 'off'`).
