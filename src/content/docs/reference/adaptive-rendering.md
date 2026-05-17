---
title: 'Adaptive rendering — auto-scaling across hardware tiers'
description: '> Framework-level rendering discipline. Engine- and game-agnostic. > Sits alongside [`performance-budgets.md`](performance-budgets.md) > (which defines hard...'
---

> Framework-level rendering discipline. Engine- and game-agnostic.
> Sits alongside [`performance-budgets.md`](performance-budgets.md)
> (which defines hard caps) and [`cross-platform.md`](cross-platform.md)
> (which defines platform targets). This doc covers **how the renderer
> adapts within those caps so players never have to think about
> graphics settings.**

## The commitment

Games built on this framework should play on **very low-spec hardware
through to providing a really impressive experience on top-end gaming
PCs** — automatically, with **no graphics-settings menu required**.

- A 4-year-old mid-tier Android phone gets a playable frame rate at
  reasonable visual fidelity
- A current flagship gaming PC gets the most-impressive ceiling
  achievable within the WebGL + low-poly constraints (we're not
  competing with photoreal AAA; we're delivering cohesive, polished,
  high-frame-rate atmosphere)
- Players in between get something matched to their hardware without
  ever opening a settings panel
- Advanced users *can* override the auto-detected tier, but the
  default is "boot the game, it picks the right tier, you play"

This is a framework concern, not a per-game one. Every game built on
the framework inherits the adaptive tier system; per-game choices
(palette, asset density, particle styles) plug into the tiers' budget
slots.

---

## The four-tier system

Tier 0/1/2/3 = LOW / MEDIUM / HIGH / ULTRA. Each tier is a *named
visual budget* that the renderer hits automatically.

| Tier | Reference hardware | Frame target | Resolution scale | Shadows | Post-FX | Particles |
|---|---|---|---|---|---|---|
| **LOW** | 4-yr-old mid-tier Android, low-end laptop | 30 FPS | 0.6-1.0x dynamic | None or single hard | None | 25% density |
| **MEDIUM** | Mid-tier mobile, modern budget laptop, Steam Deck | 60 FPS (30 floor) | 0.85-1.0x dynamic | PCF soft, 1 cascade | Tone-map + FXAA | 60% density |
| **HIGH** | Modern desktop w/ discrete GPU | 60 FPS | Native | PCF soft, 2 cascades | Tone-map + bloom + SSAO + colour grade | 100% density |
| **ULTRA** | High-end gaming PC (RTX 4070+, M-series Max+) | 120 FPS unlocked | Native, optional supersample | High-quality cascaded, contact shadows | Full post + DOF + atmospheric | 100% density + extras |

**Backend (WebGL 2 vs WebGPU) is orthogonal to tier.** Tier
captures *how much visual work* the device can handle; backend
captures *which graphics API is available*. A top-end Apple
Silicon Mac on older Safari hits ULTRA visually on WebGL 2; an
entry-level Chromebook with WebGPU support runs LOW on WebGPU.
Both axes select independently. The framework's backend
selection flow lives in
[`adr/0005-dual-renderer-backend.md`](adr/0005-dual-renderer-backend.md)
and the consumer-facing config is in
[`renderer-configuration.md`](renderer-configuration.md). What
each tier can *additionally* express on WebGPU (compute particles
at higher density, GPU-driven culling, volumetric effects) lives
in [`renderer-feature-matrix.md`](renderer-feature-matrix.md).

These numbers are *defaults*; per-game overrides land in
`packages/content/data/render-tiers.json`. The default table is the
opinionated framework baseline.

---

## Detection — initial tier selection

On first run, the client probes hardware capability and picks a tier
in <500ms:

1. **GPU identification** — `WEBGL_debug_renderer_info` extension
   returns the vendor + renderer strings ("Apple M2", "Adreno 750",
   "NVIDIA RTX 4070", "Intel Iris Xe"). A classification table maps
   known GPUs → starting tier.
2. **Capability check** — WebGPU available? Half-float textures?
   Anisotropic filtering? Max texture units? Cubemap support? Each
   missing feature can knock a tier down.
3. **Quick perf benchmark** — render a known-cost test scene (one
   instanced mesh field, one shadow caster, a tone-map post pass) for
   ~30 frames; measure frame time. If it overshoots the tier's
   budget, drop a tier.
4. **Persisted result** — cache the tier in IndexedDB keyed by GPU
   string + game version; re-probe only when game version bumps or
   GPU changes.

Unknown GPU? Start at MEDIUM and let the runtime feedback loop adjust.

---

## Runtime adjustment — frame-time feedback loop

Initial detection is best-effort; the runtime loop is what makes it
robust:

- A `FrameMonitor` tracks rolling 60-frame frame time
- If the **95th percentile** exceeds the tier's hard cap for >3s of
  sustained gameplay, **drop a tier** (smoothly — cross-fade post-FX
  off, scale dynamic-res down)
- If the 95th percentile sits **well below** the tier's target for
  >30s, consider **upgrading a tier** — but only after a stability
  window, and never automatically upgrade past the initially-detected
  tier without explicit user opt-in

Players never see a popup. Tier changes show as a tiny indicator in
the corner of the screen (auto-hides after 2s) describing the change.

Pause and zoom-to-detail (cinematic moments) can temporarily borrow
tier budget — dropping particle density on the world while a dialogue
close-up plays. Defer this kind of dynamic budget allocation to v1.

---

## What each budget slot controls

The tier table above is the user-facing surface; the framework
internally has finer-grained slots that the tier maps onto:

| Slot | Examples |
|---|---|
| **Texture fidelity** | KTX2 transcode target (UASTC → BC7 high vs ETC1S → BC1 low) |
| **Mesh LOD bias** | Distance multiplier for swapping to lower-detail meshes |
| **Shadow technique** | Off / hard / PCF-soft / cascaded |
| **Shadow resolution** | 512² / 1024² / 2048² / 4096² |
| **Post-processing chain** | Which effects mount in `<EffectComposer>` |
| **Particle density multiplier** | Multiplied against per-system base counts |
| **Crowd render path** | Per-character mesh / instanced impostors / billboards |
| **Dynamic resolution range** | Min/max scale the resolution can swing through |
| **Frame target** | Cap for the render loop (browser vsync handles enforcement) |
| **Anisotropic filtering** | 1x / 4x / 16x |
| **Mipmap LOD bias** | -1 / 0 / +1 |

Per-game overrides for any slot land in
`packages/content/data/render-tiers.json`. The shape:

```json
{
  "LOW": { "particles": 0.15, "shadows": "off", "frameTarget": 30 },
  "MEDIUM": { ... },
  "HIGH": { ... },
  "ULTRA": { ... }
}
```

Missing keys fall back to the framework defaults.

---

## "No graphics settings menu" — philosophy + escape hatch

**Default UX:** there is no graphics settings menu in the player-facing
options. The player sees gameplay options (controls, audio, language,
accessibility) — not "Shadows: Medium" dropdowns.

**Why:**
- Most players never optimise settings; defaults dominate their
  experience
- Settings menus invite micro-decisions players don't want to make
- Auto-adapt is robust; manual override is a fallback for power users
- The methodology bet treats the developer experience as the scarce
  resource, not the player's tweaking time

**Escape hatch for advanced users (lands in v1+):** a hidden "developer
settings" panel reachable via `Ctrl+Shift+G` (or equivalent) exposes
per-slot overrides. Persists to IndexedDB. Useful for:
- Players who want to lock a specific tier
- Devs / streamers / content creators
- Accessibility (force higher contrast, disable specific effects)
- Bug-report scenarios ("does this happen on LOW too?")

The panel is intentionally undocumented for end users. It's not
hidden as in obscured-for-security; it's hidden as in not-cluttering-
the-default-experience.

---

## Reach the low-spec floor

The LOW tier exists so that wide-bottom-of-market hardware works. The
floor (below which we shrug and show "your device may not be
supported") is roughly:

- WebGL 2 mandatory (universally supported since ~2018)
- Memory: ≥ 2 GB device RAM
- GPU: must complete the boot probe scene at < 50ms/frame
- Storage: ≥ 200 MB available for IndexedDB asset cache

Devices below the floor get an explanatory message at boot, not a
crash. We do not silently downgrade fidelity to "potato mode" trying
to keep them running — past LOW is unsupported.

---

## Reach the high-end ceiling

ULTRA is where the framework + game stack proves the upper bound is
*genuinely impressive*, within the constraints:

- 120+ FPS at native resolution
- Cascaded soft shadows everywhere, including on instanced grass / crowds
- Bloom + SSAO + colour grading + atmospheric fog + volumetric particles
- High-quality skybox / time-of-day lighting
- Dense, varied particle systems (dust motes, fireflies, leaves)
- Smooth crowd motion at full density (hundreds of NPCs visible)
- WebGPU compute for crowd / particle / cloth (when supported)
- Optional supersampling (1.25x → 1.5x render then downsample)

The point: "WebGL low-poly" isn't a ceiling on impressiveness — it's a
*stylistic constraint* that, executed at full quality with stable
high frame rate, reads as polish rather than limitation.

---

## Per-tier visual budget (concrete framework defaults)

Numbers a per-game `render-tiers.json` overrides; framework defaults
land here.

| Metric | LOW | MEDIUM | HIGH | ULTRA |
|---|---|---|---|---|
| Frame budget (95th percentile, ms) | 50 | 33 | 16.6 | 8.3 |
| Dynamic resolution range | 0.6-1.0 | 0.85-1.0 | 1.0 | 1.0-1.5 |
| Draw call ceiling | 80 | 200 | 500 | 1000 |
| Triangle ceiling (visible) | 100k | 400k | 1M | 2.5M |
| Shadow cascades | 0 | 1 | 2 | 4 |
| Shadow map res | — | 1024² | 2048² | 4096² |
| Post-FX chain | none | tone+FXAA | tone+bloom+SSAO+grade | full+DOF+atmos |
| Particle density | 0.25x | 0.6x | 1.0x | 1.0x+ |
| Texture transcode target | ETC1S/BC1 | UASTC/BC7 | UASTC/BC7 | UASTC/BC7 hi |
| Anisotropic filtering | 1x | 4x | 16x | 16x |
| Mesh LOD bias | +1 (favour low) | 0 | -0.5 (favour high) | -1 |
| Frame target | 30 | 60 | 60 | 120 unlocked |

These are reference defaults; calibrate after first probe runs on
real content.

---

## How it plugs into the code

A single `RenderTier` context propagates through the scene:

```tsx
// apps/client/src/render/RenderTierProvider.tsx
const tier = useDetectedTier();  // detection + runtime adjustment
return <RenderTierContext.Provider value={tier}>{children}</RenderTierContext.Provider>;
```

Components that respond to tier:

```tsx
function Lighting() {
  const tier = useRenderTier();
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        castShadow={tier.shadowCascades > 0}
        shadow-mapSize={[tier.shadowMapRes, tier.shadowMapRes]}
        // …
      />
      {tier.postFx.includes('bloom') && <Bloom />}
    </>
  );
}
```

The component-level pattern matters: each subsystem subscribes only to
the slots it consumes. Mesh components consume `tier.meshLodBias`;
particle systems consume `tier.particleDensity`; etc. Decoupled,
testable per slot.

---

## Tier 0 assertions for adaptive rendering

The probe pipeline (see [`qa-strategy.md`](qa-strategy.md)) exercises
each tier:

- **`tier-low-viable`** — boot the LOW tier in a mobile viewport,
  assert frame budget under 50ms p95 across a 30-second probe run
- **`tier-medium-viable`** — same for MEDIUM in desktop-chromium
- **`tier-detection-stable`** — boot 100 times against a fixed GPU
  string; assert tier selection is deterministic
- **`tier-no-flapping`** — runtime feedback loop must not oscillate
  (move down, move up, move down…) under stable conditions

These guard the "no settings menu" UX commitment — auto-detect must
be robust enough that the player never needs to intervene.

---

## What this is not

- **Not a graphics settings menu**, even an auto-applied one.
  Settings menus encourage tinkering; tier slots are invisible to the
  player by default.
- **Not infinite scalability.** LOW is the floor; ULTRA is the
  ceiling. Anything outside that envelope is unsupported.
- **Not photoreal targeting.** The WebGL + low-poly aesthetic ceiling
  is meaningfully below AAA-PBR-engine output, and we don't apologise.
  Within the aesthetic, ULTRA aims to be the most impressive instance
  of that aesthetic — not a partial step toward something it isn't.
- **Not a way to "fix" bad performance.** Tier slots adapt to
  hardware; they don't compensate for a game that's blown its draw-call
  budget across the board. `performance-budgets.md` keeps the overall
  cost in check; adaptive rendering distributes the remaining headroom
  intelligently.
- **Not coupled to the game's aesthetic choices.** Whether a game uses
  one low-poly pack, another, or bespoke assets, the tier
  system applies. Asset choice is game-side; tier mechanism is
  framework-side.

---

## Build order

1. **`RenderTier` type + `RenderTierProvider`** with framework default
   table — v0
2. **`useDetectedTier` hook** with GPU classification + capability
   probe — v0.5
3. **Boot benchmark scene** — v0.5
4. **Per-slot consumer hooks** (`useLightingForTier`, etc.) wired into
   client scenes — v0.5
5. **`FrameMonitor` + runtime tier adjustment** — v1
6. **Tier 0 probes** for tier viability + detection stability — v1
7. **Per-game `render-tiers.json` override** — v1 (lands when a game's
   content forces it)
8. **Developer settings panel** (`Ctrl+Shift+G` escape hatch) — v1
9. **Cinematic dynamic-budget borrowing** — v2 (when there are
   cinematics)
10. **Pattern A / B prefab features that exploit WebGPU compute**
    — v2 (compute particles, GPU-driven crowd path, volumetric
    fog). Backend selection itself is settled per
    [`adr/0005-dual-renderer-backend.md`](adr/0005-dual-renderer-backend.md);
    this step is the per-tier capability uplift inside that
    framework.

---

## Cross-references

- [`performance-budgets.md`](performance-budgets.md) — hard caps that
  bound every tier; failure budgets that the adaptive system never
  violates
- [`cross-platform.md`](cross-platform.md) — platform targets that
  map onto tiers (mobile → LOW or MEDIUM, Steam Deck → MEDIUM,
  desktop → HIGH or ULTRA)
- [`engine-patterns.md`](engine-patterns.md) — lighting / postprocessing /
  particles / memory patterns the tiers configure
- [`qa-strategy.md`](qa-strategy.md) — Tier 0 probe coverage for
  tier viability
- [`asset-pipeline.md`](asset-pipeline.md) — KTX2 transcode targets +
  LOD generation feed into the per-tier visual budget. The
  **build-time** per-tier optimize matrix (position/normal/texcoord
  quantize bits + Draco on/off) lives in `asset-pipeline.md` §
  "Per-tier optimize matrix"; it is co-defined with this doc's tier
  names — bumping one without the other invites drift
- [`renderer-configuration.md`](renderer-configuration.md) — sibling
  config surface for the non-tier renderer knobs (context options,
  DPR, detection extension points, runtime adjustment policy)
- [`material-system.md`](material-system.md) — per-role-per-tier
  material capability matrix; the material library names which
  Three.js material class + texture maps each role uses on each
  tier, slotting into this doc's tier framework
- [`renderer-feature-matrix.md`](renderer-feature-matrix.md) —
  per-feature backend support (orthogonal axis to tier)
- [`adr/0005-dual-renderer-backend.md`](adr/0005-dual-renderer-backend.md)
  — the WebGPU + WebGL 2 dual-backend decision
