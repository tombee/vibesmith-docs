---
title: 'Kit-assembly — modular-kit assembly director bridging procgen + asset packs'
description: 'Bridge between procgen scale-fractal spatial artifacts (Track PG-1) and asset-packs modular-kit ingestion. Adds typed SlotContract + KitCapability contracts, a pack-modularity probe, and an LLM-driven assembly director that picks themed modules per slot...'
---

> **Framework. Game-agnostic.** The bridge between
> [`procgen.md`](procgen.md)'s scale-fractal spatial artifacts
> (Track PG-1) and [`asset-packs.md`](asset-packs.md)'s
> modular-kit ingestion (Track A2 kit-pack adapter sub-slice).
> Adds two typed contracts (`SlotContract` extending PG-1
> artifacts, `KitCapability` emitted by a pack-modularity probe),
> a pack-modularity probe that runs at pack-ingest time and fails
> loudly with an actionable error when a pack isn't modular
> enough, and an LLM-driven assembly director that picks themed
> modules per typed slot from an enumerated catalogue vocabulary
> and deterministically snap-assembles those modules into
> prefab instances downstream.
>
> **What this is not.** Not a procgen substrate
> ([`procgen.md`](procgen.md) owns scale-fractal composition);
> not a pack ingester ([`asset-packs.md`](asset-packs.md) owns
> vendor adapters + classification + style profiles); not
> engine-specific (no Three.js / R3F / Bevy assumptions); not
> vendor-specific (Synty-style modular kits are the reference
> workflow target per [`asset-packs.md`](asset-packs.md), but
> adapters for other modular vendors slot in via the same
> contract). The LLM stays in its strong region — constrained
> categorical selection over an enumerated catalogue vocabulary —
> and never invents geometry.

---

## Where this sits

Kit-assembly is the third leg of the
**procgen → catalogue → assembly** triangle.

- [`procgen.md`](procgen.md) (Track PG-1) emits typed spatial
  artifacts: `SiteContract`s + `SeamContract`s at each scale of
  the ladder. Buildings, plots, wards, settlements get composed
  as layout data — polygons, footprints, child-site lists,
  seams — *without* picking the meshes that realise them.
- [`asset-packs.md`](asset-packs.md) (Track A2's kit-pack adapter
  sub-slice) ingests Synty-shaped modular kits into the asset
  catalogue: per-pack style profile, kit-aware naming,
  instanced-render-ready manifest entries, palette/atlas
  conventions.
- **Kit-assembly** (this doc, Track PG-2) bridges the two. A
  spatial generator that wants its output dressed declares
  typed *slots* on its artifact (`SlotContract`). A kit-pack
  ingester runs a *modularity probe* and emits a `KitCapability`
  report — or fails ingest with an actionable error. An
  assembly director consumes both, hands an LLM
  `{ slot, eligibleModuleIds[], themeTags }` per slot, gets a
  categorical pick back, and deterministically snap-assembles
  the chosen modules into a prefab instance.

The triangle's closure is what makes the
`examples/stylized-mmo-foundation` tech demo possible:
PG-1 generates a settlement layout end-to-end + PG-2 dresses
every building into a coherent stylised scene + Track A2's
instanced-render manifest carries the result to runtime
without per-mesh draw-call blowup.

---

## In one sentence

**A kit-assembly generator is a typed, themed, seed-deterministic
function that reads a PG-1 spatial artifact + a validated
kit-pack capability report, has an LLM pick modules per typed
slot from the catalogue's enumerated vocabulary, then
deterministically snap-assembles those modules into a prefab
instance.**

---

## The problem it closes

Indies have procgen tools (Watabou-lineage settlement
generators, BSP / WFC / graph-grammar interior generators) +
modular asset packs (Synty-shaped POLYGON kits and similar)
but **no automated bridge between the two**. The bridge is
manual: a human reads the procgen output, picks modules by
eye, snaps them into place by hand, building by building.
At settlement scale that's hundreds of buildings; at MMO
scale that's the entire content pipeline.

Generic LLMs can't be trusted to invent geometry. They
hallucinate vertex coordinates, miscount UVs, and produce
meshes that look like meshes but don't survive a snap-grid
constraint. **Constrained categorical selection from a
catalogued + validated vocabulary is the LLM-tractable
shape**: hand the model the enumerated list of eligible
module IDs for a slot + the slot's theme tags, ask it to
pick, and route the pick through deterministic snap-assembly.
The model never sees geometry; it sees catalogue tokens.

The substrate this spec adds is the substrate that lets a
developer:

1. **Annotate spatial artifacts with typed slots.** A
   building generator publishes `wall` / `roof` / `door` /
   `window` / `prop-anchor` slots on its `SiteContract`. PG-1
   generators that don't want kit-assembly downstream simply
   don't publish slots; the field is additive.
2. **Validate pack modularity at ingest.** A pack that
   *claims* to be modular but has non-snapping pivots, misaligned
   grid, mismatched mating edges, or insufficient per-slot
   variant count fails the probe loudly with an actionable
   error. The substrate refuses to pretend a non-modular pack
   is modular, and refuses to silently produce broken
   assemblies downstream.
3. **Assemble deterministically.** Given `(seed, slot list,
   kit-capability report, theme profile)`, the director
   produces the same prefab instance every time. Refinements
   operate at slot-granularity without disturbing siblings —
   the same lineage-chain shape as PG-1's refine loop.

---

## The two new contracts

### `SlotContract` — typed slot on a PG-1 artifact

`SlotContract` extends PG-1's `SiteContract`. A spatial
generator at any scale that wants kit-assembly downstream
publishes a list of typed slots:

```ts
type SlotContract = {
  id: string                    // stable per parent site; used by lineage
  kind: SlotKind                // 'wall' | 'roof' | 'door' | 'window'
                                // | 'floor' | 'stair' | 'corner'
                                // | 'edge-trim' | 'prop-anchor' | string
  transform: Transform          // position + rotation in the parent
                                // site's scale-local metres (PG-1 convention)
  themeTags: string[]           // e.g. ['fortified', 'coastal', 'late-period']
                                // — pulled from the parent's spec + ancestor sites
  snapGrid: number              // grid size in metres the slot expects modules
                                // to snap to; must match the kit's declared grid
  requiredVariants?: number     // optional minimum variant count the assembly
                                // director should pick across; defaults to 1
  metadata?: Record<string, JsonValue>
}
```

PG-1 generators are **not required** to emit slots — only
generators that want kit-assembly downstream do. A PG-1
generator that writes only layout polygons (a map-view-only
artifact) ships without `slots`; the artifact remains valid
under PG-1's contract. Slot emission is the opt-in that
declares "this artifact is ready to be dressed."

A generator's slot list is what the assembly director walks.
Slots are independent: the director assembles each in
parallel, and refinements at one slot don't disturb
siblings.

### `KitCapability` — pack-modularity report

Emitted by the modularity probe at pack-ingest time. One
report per ingested pack. Surfaced via
`@vibesmith/asset-catalogue` query alongside the pack's
style profile.

```ts
type KitCapability = {
  packId: string
  snapGrid: number              // grid size in metres the pack's modules
                                // were authored against
  pivotConvention: 'corner-sw' | 'centre' | 'base-centre' | 'custom'
  supportedSlotKinds: SlotKind[]
  variantsPerKind: Record<SlotKind, number>  // count per kind, by theme cluster
  themeProfile: StyleProfileRef // points at the per-pack style profile per
                                // asset-packs.md
  atlasCoherence: 'single-atlas' | 'palette-shared' | 'mixed'
  modularity: ModularityVerdict
}

type ModularityVerdict =
  | { kind: 'clean' }
  | { kind: 'partial'; reasons: ModularityReason[] }
  | { kind: 'unsuitable'; reasons: ModularityReason[] }

type ModularityReason = {
  axis: 'snap-grid' | 'pivot-consistency' | 'edge-mating'
       | 'theme-coverage' | 'atlas-coherence' | 'pivot-predictability'
  detail: string                // human-readable + actionable
  affectedAssetIds?: string[]   // catalogue IDs the probe flagged
}
```

The assembly director queries the capability report when
matching slots to modules. A `partial` verdict downgrades
eligibility for affected slot kinds but doesn't block
assembly; an `unsuitable` verdict blocks the pack from
participating in kit-assembly entirely. The pack remains
usable as opaque art assets — non-modular consumers still
get atlas/palette/style profiles + R3F references via
`asset-packs.md`'s normal surfaces.

---

## The pack-modularity probe

The probe runs at pack-ingest time as part of the
`vendor-adapter` validation phase (see
[`asset-packs.md`](asset-packs.md) § The ingestion flow).
It executes alongside the existing ingest steps and emits
the `KitCapability` report (on success) or **fails ingest
loudly** with an actionable error message (on
`unsuitable`).

### Checks

| Check | What it measures | Failure shape |
|---|---|---|
| **Snap-point consistency** | Per-class pivot-position variance vs declared grid (walls, floors, roof segments share consistent socket points / pivot conventions). | `"<pack-id>: 60% of wall segments have non-snapping pivots (declared grid 4m, actual pivot variance 1.7m); cannot be used as a modular-assembly pack."` |
| **Grid alignment** | Tile bounding-boxes round to the declared snap grid within tolerance (default ε = 1cm). | `"<pack-id>: roof segment <asset-id> bounds (4.03m × 4.12m) do not align to declared 4m grid (tolerance 1cm)."` |
| **Edge-mating** | Declared mating edges actually weld within an epsilon when snapped on the grid (no visible seams, no overlapping vertices, no clipping). | `"<pack-id>: wall segment <asset-id-a> south edge does not mate with floor segment <asset-id-b> north edge (gap 8cm at y=0)."` |
| **Theme coverage** | Per-theme-cluster variant count meets the configured floor (default ≥ 3 wall variants, ≥ 2 roof variants, ≥ 2 door variants per cluster). | `"<pack-id>: theme cluster 'fortified' has 1 wall variant; minimum 3 required for assembly variety."` |
| **Pivot convention** | Pivots are predictable across the pack (one convention per kind — not corner-pivoted walls mixed with centre-pivoted walls). | `"<pack-id>: wall segments use inconsistent pivot convention (12 corner-sw, 7 centre, 3 base-centre); declare one in pack.toml [kit] pivotConvention."` |
| **Material/atlas coherence** | Modules share an atlas / palette texture so assembled prefabs aren't fragmented at runtime (per asset-packs.md's instanced-render-ready manifest requirement). | `"<pack-id>: 14 distinct material refs across 200 wall modules; instanced rendering needs ≤ 4 materials per kind."` |

### Failure shape

When the probe verdict is `unsuitable`, ingest **fails** with
the actionable error. The error is structured: an `axis`, a
human-readable `detail`, and the list of `affectedAssetIds`.
The error includes the **escape hatch**:

> *"To use this pack as a non-modular pack (atlas + classification +
> style profile only, no kit-assembly), set
> `[pack.modularity] = 'opaque'` in the project manifest. The pack
> will still ingest under asset-packs.md's normal flow; it just
> won't participate in kit-assembly."*

The framework refuses to silently produce broken assemblies.
A pack that *thinks* it's modular but isn't would otherwise
fail at assembly-time with confusing geometry errors; loud
failure at ingest time is the higher-leverage failure point.

### Capability matrix

The capability report is queryable by the assembly director
through a per-pack lookup (`getKitCapability(packId)`) and
across packs via a matrix (`findKitsBySlotKind(kind,
themeTags)`). The matrix shape mirrors
[`renderer-feature-matrix.md`](renderer-feature-matrix.md)'s
per-backend matrix shape: a 2-D lookup keyed by
`(slotKind, themeTag)` → `{ packId, eligibleModuleIds[] }`.
Consumers and the assembly director walk the matrix when
deciding which pack(s) feed which slots.

---

## The assembly director

```ts
defineKitAssemblyDirector({
  id: 'building.synty-style.v1',
  packs: ['pack:medieval-fortified', 'pack:medieval-civilian'],
  slotMatcher: ({ slot, packs }) => EligibilityList,
  themeProfile: 'fortified-coastal',
  llmProvider: 'configured',     // routed through the LLM-call capability
})
```

### Field-by-field

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | `string` (kebab-case, slot-domain-prefixed, version-suffixed) | yes | Stable identity. `<slot-domain>.<approach>.<vN>`. One director per `id`; multiple directors for the same domain may coexist and the spec picks one. |
| `packs` | `PackRef[]` | yes | The ordered list of kit packs the director queries. Pack ordering controls which pack a slot falls to first; the next pack in the list is the fallback when the first pack's eligibility list is empty. |
| `slotMatcher` | `(args) => EligibilityList` | yes | The per-slot eligibility function. Filters the pack's module catalogue down to the subset the LLM will pick from. Default implementation reads `KitCapability` + `themeTags` and returns intersected matches. |
| `themeProfile` | `string` (style-profile ref) | yes | The pack-derived style profile the director biases toward. Per [`asset-packs.md`](asset-packs.md). |
| `llmProvider` | `'configured'` \| `LlmProviderRef` | yes | Routed through Track A5's LLM-call capability (`llm-call-capability.md`). |

### The LLM contract — categorical pick only

The director hands the LLM **one structured message per
slot**:

```ts
type SlotPickRequest = {
  slot: SlotContract
  eligibleModuleIds: string[]    // the enumerated catalogue vocabulary the LLM picks from
  themeTags: string[]            // resolved from slot + parent site + project style profile
  contextHint?: string           // optional one-line generator-supplied context
                                 // e.g. "south-facing tavern wall, near road"
}

type SlotPickResponse = {
  pickedModuleId: string         // MUST be one of eligibleModuleIds — validated post-call
  microVariations?: {
    rotation?: 0 | 90 | 180 | 270     // grid-aligned only
    paletteIndex?: number             // pack-defined palette swatch
    decorationVariant?: string        // per-module-author decoration option
  }
  rationale?: string             // one-line; surfaced in lineage + dev-shell inspector
}
```

The LLM **never** sees raw geometry. It sees catalogue
tokens — module IDs + theme tags + an optional one-line
contextual hint. Its job is constrained categorical
selection: which module ID from the enumerated list best
matches the slot's theme. Micro-variations (rotation,
palette index, decoration variant) are the only continuous
axis, and even those are quantised to the kit author's
declared options.

If the LLM returns a `pickedModuleId` outside the
`eligibleModuleIds` set, the director rejects the pick and
either retries with a tightened prompt (one attempt) or
falls back to a deterministic default pick (most-recently-used
module of that kind in the same theme cluster). The director
never invents an out-of-set module.

### Deterministic snap-assembly

Once every slot has a pick, the director runs the
deterministic snap-assembly pass:

1. **Resolve module geometry.** Look up each
   `pickedModuleId` in the asset catalogue.
2. **Apply micro-variations.** Rotation, palette swap,
   decoration variant.
3. **Snap to grid.** Position the module at the slot's
   transform, snapped to the kit's declared grid.
4. **Validate mating edges.** Walk each module's declared
   mating edges; verify peer modules at neighbouring slots
   weld within ε (re-uses the modularity probe's
   edge-mating check, but at assembly time, on a single
   instance).
5. **Emit prefab instance.** Per
   [`prefab-system.md`](prefab-system.md). The
   output is a prefab-shaped artifact the rest of the
   framework consumes unmodified — no kit-assembly-specific
   downstream code.

The assembly pass is **pure**: same `(seed, slot list, picks,
kit capability)` → byte-identical prefab instance. The seed
is derived from the parent site's seed via PG-1's seed chain
(`derive(parentSeed, 'kit-assembly')`), so re-running an
assembly with the same upstream canon produces the same
output.

### Refine verbs

The director declares four refine verbs that compose with
[`director-pattern.md`](director-pattern.md)'s
apply pipeline:

| Verb | Behaviour |
|---|---|
| `swap-variant` | At a single slot, swap the picked module for another eligible module (LLM re-picks with the picked module excluded). Siblings untouched. |
| `regenerate-building` | Re-run all slots' LLM picks under a new seed; theme stays, snap-assembly re-runs. |
| `theme-match-stronger` | Tighten the theme filter (raise the score floor on `themeTags` match); LLM re-picks from a smaller eligibility list. |
| `kit-swap` | Replace one of the `packs` entries with a different pack; eligibility lists recompute; LLM re-picks across the new vocabulary. |

Refinements are lineage events on the assembled prefab
instance, recorded the same way PG-1 records refines on
spatial nodes (`parent_entity_id`, `modified_reason`,
`superseded_by`).

---

## In-engine output

The assembly director produces a **prefab-shaped artifact**
per [`prefab-system.md`](prefab-system.md). The
artifact is **instanced-render-aware** per Track INSTR and
[`renderer-feature-matrix.md`](renderer-feature-matrix.md):
modules sharing material refs collapse to instanced draw
calls at scene-construction time; the renderer-side surface
doesn't change.

The prefab instance carries:

- The per-slot module picks (catalogue refs by pack-qualified ID).
- The per-slot transforms (snap-aligned to grid).
- The pack capability + theme profile refs the assembly
  was authored against.
- The lineage chain (which director, which seed, which LLM
  picks, which refine history).

Downstream consumers see a regular prefab. No kit-assembly
API leaks into render code, scene construction, or runtime.

---

## Snapshot integration

Every assembly run is **seed-deterministic** and snapshot-
captureable per the
scenario-driven-dev substrate.

- **Capture.** A snapshot at assembly bake records
  `(parent_site_id, parent_version, director_id, seed,
  pack_capability_versions[], llm_picks[])`. The picks are
  recorded as catalogue refs, not as embedded geometry; the
  geometry resolves through the catalogue at replay time.
- **Replay.** Re-running the assembly from the snapshot
  reads pinned pack capability versions, replays the LLM
  picks *deterministically* (the picks are recorded, not
  re-generated), and produces a byte-identical prefab
  instance.
- **Refine + replay.** A refine action (`swap-variant`,
  `regenerate-building`, …) produces a new lineage node;
  the old snapshot still replays cleanly to the
  pre-refine state.

The LLM is **never re-invoked at replay time**. Picks are
canon; replay is deterministic.

---

## Slices

Track PG-2 ships six slices. See
`docs/roadmap/tracks/pg-2.toml` for the canonical slice plan.

1. **Pack-modularity probe + `KitCapability` report.** Implements
   the six probe checks against ingested packs. Emits the
   capability report on success; fails ingest loudly on
   `unsuitable`. Wires the escape hatch
   (`[pack.modularity] = 'opaque'`).
2. **`SlotContract` extension to PG-1 artifacts + reference
   generator.** Adds the `slots` field to PG-1's
   `SiteContract`. Updates the reference settlement generator
   (per PG-1 slice 2) to publish slots on its building
   sub-sites.
3. **`defineKitAssemblyDirector` substrate + LLM categorical-pick
   contract + deterministic snap-assembly.** The director
   registry + slot matcher + LLM call (Track A5) + snap-assembly
   pass + prefab emission.
4. **Refine loop + dev-shell director surface +
   `kit-assembly-critic` subagent.** Wires the four refine
   verbs into the dev-shell. Ships the critic as a sibling of
   `recipe-canon.md`'s shader / VFX critics.
5. **cmd+P quick action `kit.assemble-from-procgen` +
   recipe-canon seed.** Registers the quick action through
   `quick-action-palette.md`.
   Seeds the recipe-canon `kit-assembly` category with one
   reference recipe per major pack-theme combination shipped.
6. **Tech-demo wiring —
   `examples/stylized-mmo-foundation`.** PG-1 drives the
   settlement layout; PG-2 assembles every building. End-to-end
   exercise of both tracks together; the canonical Track REF
   artifact.

Slice dependencies are encoded in the TOML.

---

## Cross-references

- [`procgen.md`](procgen.md) — the upstream spatial substrate;
  PG-2 consumes its artifacts (extended with `SlotContract`)
  and inherits its seed chain.
- [`asset-packs.md`](asset-packs.md) — the modular-kit ingestion
  pipeline; PG-2's modularity probe runs as a `vendor-adapter`
  validation step; pack-derived style profiles drive PG-2's
  theme matching.
- [`asset-catalogue.md`](asset-catalogue.md) — the generic
  catalogue PG-2 queries for eligible module IDs.
- `recipe-canon.md` — kit-assembly recipes
  live as a new `kit-assembly` category; reuses retrieval +
  project-override layers.
- [`director-pattern.md`](director-pattern.md) —
  the assembly director is one instance of the broader director
  pattern; the apply pipeline + refine-verb shape matches.
- [`prefab-system.md`](prefab-system.md) — the
  output artifact shape; downstream consumers see a regular
  prefab.
- [`renderer-feature-matrix.md`](renderer-feature-matrix.md)
  — capability-matrix shape PG-2's `KitCapability` matrix
  mirrors.
- `llm-call-capability.md`
  — the LLM-call substrate the director routes through;
  budget tracking + provider routing live there.
- `quick-action-palette.md`
  — `kit.assemble-from-procgen` registers here.
- scenario-driven-dev
  — assembly is snapshot-captureable; LLM picks are canon, not
  re-generated at replay.
- `proactive-advice-queue.md`
  — `kit-assembly-critic` verdicts flow into the same queue
  as recipe-canon / procgen advice.
- [Positioning](/positioning/) — closes one
  of the AI-difficult-bits gaps the framework explicitly
  exists to address.
- The framework roadmap — Track PG-2 prioritisation
  (Tier 2 row 17).

---

## Status

🔵 **specced — no code yet.** Build phases tracked under Track
PG-2 (modularity probe + slot contract + director + refine
loop + cmd+P + tech-demo wiring). See
`docs/roadmap/tracks/pg-2.toml` for the slice plan and
the framework roadmap Tier 2 for the prioritisation.
Pairs with Track PG-1 in the
`examples/stylized-mmo-foundation` reference target.
