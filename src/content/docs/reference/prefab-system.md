---
title: 'Prefab system — configurable, AI-modifiable units of content'
description: '> This doc names and unifies a pattern that already runs through several > other docs (recipes, generators, compositions, directors, theme system). > It is...'
---

> This doc names and unifies a pattern that already runs through several
> other docs (recipes, generators, compositions, directors, theme system).
> It is the noun for "the unit of reusable content in our dev experience"
> and the spec for the dev-tooling that lets us build, test, view, and
> AI-modify them.
>
> No new architecture is introduced here. Recipe → Generator →
> Composition → Renderer (from `scene-construction.md`) is still the
> pipeline; director surfaces (from `director-pattern.md`) are still the
> AI loop. **Prefab** is the package that bundles a recipe schema + a
> generator + a director surface + an AI brief + a preview, presented as
> a single first-class concept to authors.

---

## What a prefab is in this project

In Unity, a prefab is a saved object you drag into a scene; variants
override prop values. Familiar mental model — adopt it, then extend.

In our system, a **prefab** is the full bundle that lets a human or
an AI agent produce a *concrete instance* of a content type:

```
Prefab
├── Recipe schema  ── Zod schema declaring the prefab's parameters
├── Generator      ── pure (recipe, seed) → Composition function
├── Director surface ── recipe editor + intervention pipeline (per-type)
├── AI brief       ── prompt context for the type-specific director agent
├── Preview        ── thumbnail / variant grid / live render
└── Metadata       ── name, tags, theme affinity, provenance, version
```

A prefab is **always configurable** (its recipe parameters), **always
generatable** (its generator produces instances), and **always
AI-modifiable** (its director surface accepts feedback that maps to
recipe patches). These aren't optional features layered on — they're
the definition.

A *prefab instance* is the Composition output: a concrete arrangement
of entities, rendered to the scene, with provenance back to the source
prefab + seed + intervention history.

---

## Why "prefab" is the right name

- **Unity-familiar mental model.** Most contributors will read "prefab"
  and have a 90% accurate intuition immediately.
- **First-class dev surface.** "Prefab" is a noun authors can talk
  about. "Recipe / generator / composition" is internal vocabulary;
  prefab is the externally-visible thing.
- **Unifies otherwise-scattered concepts.** Buildings, NPCs, settlements,
  threads, voice cards, items, world objects — they're all prefabs in
  our system. Same anatomy, same tooling, different schemas.
- **Maps to the director loop directly.** "Modify this prefab via
  prompt" is the user's mental model; the system translates that into
  director-mode interventions.

Key difference from Unity prefabs: **ours are recipe-driven, not
instance-driven.** A Unity prefab is a saved instance you spawn copies
of; ours is a *parametric description* that generators turn into
instances. Variation lives in the recipe, not in per-instance overrides.

---

## Prefab anatomy (the six artifacts)

For a hypothetical `Building` prefab in `packages/content/prefabs/cottage/`:

```
packages/content/prefabs/cottage/
├── schema.ts        ── Recipe schema (Zod): footprint, roof, materials, …
├── generator.ts     ── (recipe, seed) → Composition function
├── director.md      ── AI brief for `cottage-director` subagent
├── preview.ts       ── How to render a thumbnail / variant grid
├── meta.json        ── name, tags, theme affinities, version, status
└── examples/        ── canonical seed instances for regression testing
    ├── camelot.json
    ├── midgard.json
    └── hinterlands.json
```

Every prefab type lives in a folder like this. The structure is
enforced by a `prefab-critic` subagent (when it lands) — a folder under
`prefabs/` without one of the six artifacts fails its PR check.

### Recipe schema

The parameters the prefab accepts. Zod-validated. Defines the
configuration surface.

```ts
// packages/content/prefabs/cottage/schema.ts
import { z } from 'zod';

export const CottageRecipe = z.object({
  id: z.string(),
  kind: z.literal('cottage'),
  seed: z.number().int(),
  footprint: z.object({
    width: z.number().min(3).max(8),
    depth: z.number().min(3).max(8),
  }),
  roof: z.enum(['gable', 'hip', 'shed']),
  materials: z.object({
    walls: z.string(),       // asset key
    roof: z.string(),
    door: z.string(),
  }),
  hasChimney: z.boolean().default(true),
  windowCount: z.number().int().min(0).max(6).default(2),
  theme: z.string().optional(),
});
export type CottageRecipe = z.infer<typeof CottageRecipe>;
```

### Generator

Pure function. Recipe + seed → Composition. Deterministic.

```ts
// packages/content/prefabs/cottage/generator.ts
export function generateCottage(
  recipe: CottageRecipe,
  ctx: GenContext,
): Composition {
  // … procedural composition using ctx.procgen + ctx.assets
}
```

### Director surface

Per-prefab-type director: selection modes, intervention levels, AI brief.

```ts
// packages/content/prefabs/cottage/director.ts
export const cottageDirector: DirectorSurface<CottageRecipe> = {
  type: 'cottage',
  interventions: [
    'composition-patch',     // move/delete an entity
    'recipe-patch',          // change footprint/roof/materials
    'seed-reroll',           // same recipe, new seed
    'generator-suggestion',  // propose code change
  ],
  agentBrief: './director.md',
  fieldEditors: { /* leva spec per recipe field */ },
};
```

### AI brief

Markdown file consumed by the type-specific director agent. Defines the
prompt context for AI modifications:

```markdown
# cottage-director brief

Recipes describe a single residential cottage in a the chosen asset pack-aesthetic world…

## Constraints
- Footprint: 3-8m on each axis (small/medium scale only — manors and
  taverns are separate prefabs)
- Roof types: gable / hip / shed; pitched, never flat
- Materials must be drawn from the asset manifest's `cottage-eligible` tag

## Tonal anchors
- the project's tonal register: a cottage is a small home for a small life
- Theme-specific material palettes (Theme-A ≠ Theme-B ≠ Theme-C)

## Common intervention shapes
- "make it bigger" → footprint +1-2m, possibly chimney removal
- "less generic" → vary window placement, add asymmetry to roof
- "doesn't fit this theme" → swap materials per theme palette
```

The director agent reads this brief plus the current recipe + composition
when processing user feedback.

### Preview

How to produce a thumbnail or live render of the prefab:

```ts
// packages/content/prefabs/cottage/preview.ts
export const cottagePreview: PrefabPreview<CottageRecipe> = {
  defaultRecipe: () => ({ /* a canonical "neutral" recipe */ }),
  cameraFraming: 'building-3q',   // standard framing preset
  variantGridSeeds: [1, 7, 42, 137, 1024],  // for "show me variations"
};
```

### Metadata

```json
{
  "name": "Building",
  "tags": ["residential", "small", "low-poly"],
  "realmAffinities": ["camelot", "hinterlands"],
  "status": "stable",
  "version": "1.0.0",
  "author": "system",
  "supersedes": null
}
```

---

## Prefab types — initial catalogue

What we'll have prefabs for, roughly in build order:

| Type | Parameters drive | First instance | Director agent |
|---|---|---|---|
| **Building** | Footprint, roof, materials, windows | `camelot.json` | `cottage-director` |
| **Building** | Footprint, anchor role, signage | `hinterlands-tavern.json` | inherits scene-director |
| **Building** | Multi-storey footprint, courtyard | tbd | inherits scene-director |
| **Building** | Footprint, steeple, denomination flavour | tbd | inherits scene-director |
| **NPC** | Voice card ref, archetype, equipment, behaviour | `hella.json` | `npc-director` |
| **Settlement** | Patches, anchors, population, threads | `example-village.json` | scene-director (already exists) |
| **Region** | Terrain, settlements, POIs, scatter | tbd | scene-director |
| **Thread** | Anchors, beats, branches, completion | `welcoming.json` | `thread-director` |
| **Voice card** | Register, vocabulary, quirks | `hella.json` | `voice-card-director` |
| **Dialogue corpus** | Slot variants, theme verdicts | `hella-corpus.json` | `dialogue-corpus-director` |
| **Item** | Stats, art, flavour, rarity | tbd | `item-director` |
| **World object** | Mesh, interaction, lifecycle | tbd | inherits scene-director |
| **Ambient marker** | Position, audio, particle, fade | tbd | scene-director |

Many directors are shared (the scene-director handles anything spatial);
specialists exist where the content type has its own grammar
(threads, voice cards, dialogue).

---

## Prefab composition (hierarchical embedding)

A prefab's recipe can reference other prefabs. The Settlement prefab's
recipe lists NPCs, Buildings, Landmarks — each a reference to another
prefab + a specific recipe variant + a placement.

```ts
// example-village recipe (simplified)
{
  kind: 'settlement',
  patches: { /* … */ },
  anchors: [
    {
      role: 'tavern',
      prefabRef: { type: 'tavern', recipe: 'hinterlands-tavern' },
      placement: 'center',
    },
    {
      role: 'cottage',
      prefabRef: { type: 'cottage', recipe: 'cottage-modest' },
      placement: 'ring',
      count: 5,
    },
  ],
  population: [
    {
      prefabRef: { type: 'npc', recipe: 'hella' },
      placement: 'tavern-doorstep',
    },
  ],
}
```

When the settlement generator runs, it `ctx.subGenerate('cottage',
recipe.anchors[1])` for each cottage, which produces a Composition; the
settlement composition flattens those into its entity list with
provenance attribution.

This is how Unity's prefab-of-prefabs nesting works, but in our system
it's just a recipe field referencing another recipe. No special
serialisation, no nested-prefab override system.

---

## Prefab inheritance / variants

Recipes can extend other recipes via a `parent` field:

```json
// camelot-cottage.json
{
  "parent": "cottage-base",
  "materials": {
    "walls": "synty/camelot/wattle-daub",
    "roof": "synty/camelot/thatch",
    "door": "synty/camelot/oak-plank"
  },
  "windowCount": 3
}
```

The recipe loader resolves inheritance at load time — apply parent
fields, then override with child fields. Validate the merged result
against the schema.

Inheritance is one level deep by default; deeper hierarchies need explicit
opt-in (avoid the Unity prefab-variant labyrinth).

---

## The AI-assisted loop (concrete user flow)

1. **User opens the prefab editor** for `Building`. Sees current recipe
   on the right, live preview on the left, variant grid below.
2. **User adjusts a slider** (window count: 2 → 4). Preview re-renders
   in <100ms (deterministic generator on a stable seed).
3. **User clicks a building in the preview** and types: *"this side of
   the cottage feels too plain — break it up with a small lean-to."*
4. **`cottage-director` agent** receives: selection (the entity clicked),
   feedback text, current recipe, current composition slice, the AI
   brief, available asset tags. Emits an intervention.
5. **Intervention applied + validated**: recipe patches `leanToSide:
   'east'` (or composition patch if simpler). Tier 0 checks pass. Theme
   Critic approves.
6. **Diff preview shows before/after side by side.** User clicks Accept.
7. **Recipe saved to disk**. New variant `cottage-with-lean-to.json` is
   either an in-place edit or a new variant depending on user intent
   (the editor asks).
8. **Provenance log appended** — recording the feedback that produced
   the change, for replay / audit / training-data-future.

This is the same loop the director-pattern doc describes. The prefab
system is its packaging — every prefab type has its own slice of this
loop, with its own director agent and editor surface.

---

## Dev tooling: the Prefab Browser

The most-used dev surface in this whole system. Looks like Unity's
Project panel cross-bred with a 3D asset browser.

```
┌──────────────┬──────────────────────────────┬─────────────┐
│ Prefab types │   Browser grid               │  Inspector  │
│              │   ┌──┐ ┌──┐ ┌──┐ ┌──┐         │ (selected   │
│ ▾ Buildings  │   │  │ │  │ │  │ │  │         │  prefab's   │
│   Building    │   └──┘ └──┘ └──┘ └──┘         │  recipe +   │
│   Building     │   ┌──┐ ┌──┐ ┌──┐ ┌──┐         │  metadata)  │
│   Building      │   │  │ │  │ │  │ │  │         │             │
│ ▾ NPCs       │   └──┘ └──┘ └──┘ └──┘         │             │
│   an example NPC      │                              │             │
│ ▾ Settlements│   ↑ thumbnails per variant   │             │
│   Settlement A │                              │             │
│ ▸ Threads    │                              │             │
│ ▸ Voices     │                              │             │
├──────────────┴──────────────────────────────┴─────────────┤
│ Search · Filter (theme, tag, status, author) · Sort       │
└────────────────────────────────────────────────────────────┘
```

Standard dev-tooling-ui.md conventions apply (three-panel layout,
Cmd-P palette, scrubbable numeric inputs, etc.).

Per-prefab actions (right-click or button row):
- **Open editor** (full-screen director surface)
- **Generate variant** (open editor with a forked recipe)
- **Variant grid** (5×5 seed shuffles for visual variance check)
- **Add to scene** (drop the prefab into the current scene at cursor)
- **Find references** (which scenes / parent prefabs use this)
- **History / provenance** (every intervention this prefab has been
  through)
- **AI: regenerate from prompt** (open a quick-action prompt, send to
  the type-specific director, preview result)

---

## Prefab testing

A prefab passes when:

1. **Schema validates** for every example recipe in `examples/`
2. **Generator is deterministic** — same `(recipe, seed)` produces
   identical Composition across runs (Tier 0 probe)
3. **Generator output passes per-type Tier 0 assertions** (no
   overlapping entities, walkable gaps, expected anchor count, tonal-
   flags clean, etc.)
4. **Variant grid renders cleanly** at the canonical seeds (smoke test
   that no seed crashes)
5. **Theme Critic approves** the canonical examples

Failing any of these blocks merging the prefab. The `prefab-critic`
subagent enforces.

---

## What this isn't

- **Not Unity prefab variants with override stacks.** We use recipe
  inheritance (one level by default); overrides are recipe field
  changes, not per-instance.
- **Not a runtime concept.** Players never see "prefab"; they see the
  generated world. Prefabs are an author-time abstraction.
- **Not a way to bypass the director discipline.** Every prefab edit
  still goes through the apply pipeline (validate → Tier 0 →
  Theme Critic → diff preview → accept).
- **Not coupled to Three.js or Colyseus.** Prefab data is JSON; rendering
  + sync are downstream concerns. (Per `abstraction-discipline.md`.)
- **Not a place for game balance.** Stats, costs, drop rates — those
  live in the item / skill / economy systems, not generic prefab fields.

---

## Build order

1. **Prefab folder convention + critic** (`prefab-critic` subagent that
   validates folder structure on PR) — week one
2. **Building prefab** as the first concrete instance (schema +
   generator + AI brief + 1 example). Validates the pattern.
3. **Prefab Browser dev surface** — lists prefab types, shows the
   cottage, opens its editor
4. **Scene-director extension** — handles "drop a cottage into the
   scene" via the prefab system, not as a one-off
5. **Settlement prefab** — first composing prefab; tests prefab-of-
   prefabs flow
6. **NPC + Voice card prefabs** — port from MyProject canon
7. **Thread prefab + Dialogue corpus prefab** — port and adapt
8. **Variant grid + AI quick-action prompt** in the browser
9. **Inheritance support** for recipe extension
10. **Asset director becomes a prefab director** for raw source assets
    (same UI, different content type)

---

## Cross-references

- `scene-construction.md` — the underlying Recipe → Generator →
  Composition → Renderer pipeline that prefabs use
- `director-pattern.md` — the AI loop every prefab's editor surface
  builds on
- `dev-tooling-ui.md` — UI conventions every prefab editor follows
- `in-game-ui.md` — separate concern; prefabs are dev-time, in-game UI
  is player-time
- `abstraction-discipline.md` — prefab data is JSON, decoupled from
  any specific engine
- `subagent-roster.md` — per-prefab-type director agents
- `material-system.md` — material roles named in prefab recipes;
  framework resolves to tier-appropriate concrete materials

---

## Top-level-mountable prefabs (issue #703)

`definePrefab({ id: "<owner>/<surface>", … })` is now a first-class
**scene-node-kind**. When the prefab's `id` matches the
`<owner>/<surface>` convention, `definePrefab` transparently
bridges into the `defineSceneNodeKind` registry, so scenes can mount
the prefab directly via the four-field shape:

```jsonc
// my-app/town.scene.json
{
  "version": 1,
  "name": "town",
  "nodes": [
    {
      "id": "main-house",
      "kind": "my-app/cottage",
      "params": { "stories": 2 },
      "transform": { "position": [10, 0, -5] }
    }
  ]
}
```

`defineSceneNodeKind` and the bridged `definePrefab` are the same
extension point — `defineSceneNodeKind` for engine-shaped reusable
content the framework or a consumer ships directly; `definePrefab`
for the same shape *plus* the author-time recipe / generator /
director / metadata bundle this doc enumerates above. Both end up in
the same scene-node-kind registry that the SceneRenderer dispatches
against.

**Bare-id prefabs (back-compat).** Existing `definePrefab({ id:
"cottage" })` calls keep working — the bridge skips registrations
whose id doesn't match the convention. Rename to
`<owner>/<surface>` to opt in. The doctor surface flags bare-id
prefabs as upgrade candidates.

**Canonical four-field shape.** Every custom kind a `.scene.json`
references conforms to:

- `id` — stable scene-node id (selection, hierarchy, MCP, snapshot all
  key on this; distinct from `kind`).
- `kind` — registry lookup against `defineSceneNodeKind` (or bridged
  `definePrefab`).
- `params` — per-instance parameter bag, Zod-validated at mount time
  against the registered kind's schema (defaults flow from
  `z.default()`).
- `transform` — canonical position / rotation / scale. The
  SceneRenderer wraps the kind's `renderJsx` output in a `<group>`
  with the transform; **the kind's `renderJsx` body never sees the
  transform as a prop** — keeps the editor's transform gizmo /
  Inspector / scene-accessor pipeline working uniformly across
  built-in and custom kinds.
- `children` — recursive `SceneNode[]`. Mounts as children of the
  transform-wrapping group, so parent transforms compound naturally.

**Editor integration.** The Add-Node menu lists every registered
scene-node-kind (consumer-shaped, grouped by owner segment) alongside
the built-in primitives; clicking adds the node to the active
`.scene.json` with the kind's Zod defaults. The Inspector renders
the kind's Zod `params` schema via `leva-from-zod` so per-instance
parameters are editable from the same surface that handles built-in
mesh / light / camera / script-parameter rows.

**IDE autocomplete.** The vibesmith-app emits
`.vibesmith/schemas/scene.schema.json` on every project-script load
+ hot-reload, with per-kind variants in the `SceneNode` union. Point
your IDE's JSON-schema setting at that file:

```jsonc
// .vscode/settings.json
{
  "json.schemas": [
    { "fileMatch": ["**/*.scene.json"], "url": "./.vibesmith/schemas/scene.schema.json" }
  ]
}
```

The schema regenerates every time a `defineSceneNodeKind` (or bridged
`definePrefab`) registration appears or disappears.

---

## Pure-data structural templates (issue #906)

The #703 bridge ran prefabs through the `defineSceneNodeKind` registry
— functional but the wrong shape for prefabs: it conflates *behavioural
rendering* (a React tree with hooks + R3F access) with *structural
composition* (parameterised arrangement of builtin primitives). Issue
#906 closes the gap with a pure-data `template` field that expands at
scene-load + HMR into real, addressable `SceneNode`s.

**The split.**

| Factory                | Shape       | When                                                                            |
| ---------------------- | ----------- | ------------------------------------------------------------------------------- |
| `defineGameScript`     | Behaviour   | Per-frame logic, input handlers, animation drivers (issue #907).                |
| `defineSceneNodeKind`  | Framework-internal | Custom kinds the framework ships (`hud-layer`, `mesh-instanced`, …).        |
| `definePrefab` (`template`) | Structure   | "A deck of N stacked cards" / "a status badge" / "a hand row" — pure layout. |
| `definePrefab` (`renderJsx`) | React-shaped (deprecated) | Legacy bridge — kept one release for back-compat, then removed.    |

**Authoring a prefab.**

```ts
import { definePrefab } from '@vibesmith/runtime';
import { z } from 'zod';

definePrefab({
  id: 'my-app/deck-stack',
  params: z.object({
    size: z.number().int().min(0),
    card_back: z.string().default('image:card-backs/default'),
    scale: z.number().default(0.5),
    layer_height: z.number().default(0.04),
  }),
  template: ({ size, card_back, scale, layer_height }) => {
    const visible = Math.min(size, 12);
    return {
      kind: 'group',
      children: [
        ...Array.from({ length: visible }, (_, i) => ({
          kind: 'mesh',
          transform: { position: [0, i * layer_height, 0] },
          geometry: { kind: 'plane', size: [5 * scale, 7 * scale] },
          material: { kind: 'standard', map: card_back },
        })),
        size > 0 && {
          kind: 'text-mesh',
          transform: { position: [0, visible * layer_height + 0.3, 0] },
          text: String(size),
          font_size: 3.2 * scale,
        },
      ].filter(Boolean),
    };
  },
});
```

**Mounting from `.scene.json`.**

```jsonc
{
  "version": 1,
  "name": "main",
  "nodes": [
    {
      "id": "p0-deck",
      "prefab": "my-app/deck-stack",
      "params": { "size": 37 },
      "transform": { "position": [-16, 0.05, 12] }
    }
  ]
}
```

At scene-load, `expandScenePrefabs` (in `@vibesmith/scene-renderer`)
runs once and replaces every `{ id, prefab, params?, transform?,
children? }` reference with the prefab's `template(params)` SceneNode
sub-tree. Downstream code — the SceneRenderer's `<Node>` walker, the
hierarchy panel, the selection bus, the MCP scene-tree resource —
sees a regular scene with no `prefab` variants left.

**Deterministic id derivation.** Each expanded node gets a stable id
derived from the consumer-side reference id + the template's tree
position:

- Root: `<consumer-id>` verbatim. The deck-stack reference above
  produces a root with `id: "p0-deck"`.
- Template node with explicit `id`: `<parent-id>/<id>`. Use this for
  nodes the consumer wants to address by a stable name regardless of
  sibling churn (e.g. `{ id: 'count', kind: 'text-mesh' }` →
  `p0-deck/count`).
- Sole same-kind sibling: `<parent-id>/<kind>`. The deck-stack's text
  badge is the only `text-mesh` at its depth, so it becomes
  `p0-deck/text-mesh`.
- N > 1 same-kind siblings: `<parent-id>/<kind>-<index>` where index
  is the 0-based position among same-kind siblings (declaration
  order). The 12 visible cards become `p0-deck/mesh-0`,
  `p0-deck/mesh-1`, …, `p0-deck/mesh-11`.

`<owner>/<surface>` kind ids have their internal slash sanitized to
`-` in the path segment (`acme/spawn-point` → `acme-spawn-point`) so
id paths stay flat.

Same template + same params → same id tree, every time. Selection +
snapshot determinism + MCP addressing all key on this.

**Cycle detection.** Templates can reference other prefabs (a
`hand-fan` template might recurse into `card` templates). The
expansion walks with a cycle-stack; a prefab whose template references
itself (directly or transitively) throws `PrefabExpansionError({ code:
'PREFAB_CYCLE', cyclePath })` with the chain that led to the cycle.

**Conditional emission.** A `template` body that returns `null` at the
top level contributes no nodes to the scene (handy for `visible: false`
opt-outs). Conditional child nodes go through `Array.filter(Boolean)`
on the children list — `false`/`null` entries vanish before expansion.

**HMR.** When a prefab's `template` re-registers (a project script
hot-reloads), the SceneRenderer's `useExpandedScene` hook re-runs the
expansion pass against the fresh template — no full scene remount.
The pure-data shape makes this cheap: no React re-mount, no R3F tree
churn, just a new SceneNode tree the renderer reconciles against the
previous one.

**Transform composition.** A consumer-side `transform` on the
prefab-reference node replaces the template root's transform — the
consumer controls where the expansion sits in world space, not the
template. Descendant transforms come from the template verbatim.

**Consumer-side `children`.** A `prefab` reference can carry its own
`children` array; the entries get appended to the expanded root's
children. This lets a consumer extend a prefab instance with extra
scene-nodes (a sticker, a debug label) without modifying the prefab.

**Error surface.** `expandScenePrefabs` throws
`PrefabExpansionError` with a machine-readable `code` field:

| `code`                              | When                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `PREFAB_NOT_FOUND`                  | Scene references a `prefab` id that isn't registered.                                       |
| `PREFAB_PARAMS_INVALID`             | Scene-JSON `params` failed Zod validation against the prefab's schema.                       |
| `PREFAB_CYCLE`                      | Template references itself (directly or transitively). `cyclePath` carries the chain.        |
| `PREFAB_NO_TEMPLATE`                | Scene references a prefab that declared only `renderJsx` (legacy bridge), not `template`.    |
| `PREFAB_TEMPLATE_RETURNED_INVALID`  | Template body threw or returned a malformed `PrefabTemplateNode`.                            |

Editor + standalone hosts catch these on the scene-load boundary +
surface them through the same `onLoadError` channel the existing
custom-kind dispatch uses.

**When to use `template` vs. `kind`.**

- **`template` (prefab):** the node is a *pure rearrangement* of
  builtin primitives or other prefabs. No hooks, no state, no
  per-frame logic. Decks, badges, status clusters, hand rows.
- **`kind` (custom kind via `defineSceneNodeKind`, framework-only
  after issue #907):** the node carries behaviour the framework
  ships — instanced batches, hud-layer portals, the future
  animation drivers. Consumer code reaches for `template` first;
  if the node needs per-frame work, that's a `defineGameScript`
  attached to a builtin mesh inside the template, not a custom
  kind.
