---
title: 'Scene construction with AI assistance'
description: 'How content is generated, rendered, inspected, and iterated on in this stack. Replaces the Unity `Recipe (ScriptableObject) → Composer (C#) → Scene View`...'
---

How content is generated, rendered, inspected, and iterated on in this
stack. Replaces the Unity `Recipe (ScriptableObject) → Composer (C#) →
Scene View` loop from MyProject.

This is the **first instance** of the general director pattern — see
`docs/director-pattern.md` for the surface-agnostic framework that
will also host thread / voice-card / dialogue / lore / asset /
constitution directors. Patterns established here generalize.

---

## Runtime status

The Recipe → Generator → Composition → Renderer pipeline is wired:

- **`defineGenerator({ id, version, generate })`** in
  `@vibesmith/runtime` registers a pure
  `(recipe, ctx) → Composition` fn. Duplicate ids rejected; the
  registry holds whatever a project boots with.
- **`<RecipeScene recipe={…} generatorId="…" seed={…} />`** in
  `@vibesmith/scene-construction` resolves the generator, builds
  the seeded `GeneratorContext`, runs it, Zod-validates the
  returned composition, and renders it via
  **`<CompositionRenderer>`**. A `fallback` slot surfaces
  `no-generator` / `generate-error` / `invalid-composition`
  states without crashing the tree.
- **`<CompositionRenderer composition={…} entityRenderers={…} />`**
  is the data → React translator. Built-in renderers ship for
  `mesh` (glTF + clone + transform), `group`, `light`
  (`props.kind` fans to ambient/directional/point/spot), and
  `instanced-mesh`. Consumer-specific types (`npc`, `audio`,
  `trigger`, `spawn`, `patch`) plug in via the `entityRenderers`
  map; everything else warns once. Parent / child reparenting
  via `entity.parent` is honoured.
- **`runGenerator(id, recipe, seed)`** is the headless dispatch
  helper — same path `<RecipeScene>` walks, exposed for
  server-side / probe Tier 0 use.

What stays consumer-side, per `scene-assembly.md`
§ "Responsibility split": the concrete generators themselves,
the recipe registry + file loader, the `AssetResolver` that maps
manifest keys to URLs, and the orchestrator that wires
sub-generators together. The dev-tooling surfaces below (scene
browser, variant grid, composition viewer, director mode) sit on
top of this runtime; they're separate slices.

---

## Four-layer split

```
Recipe (data)  →  Generator (pure fn)  →  Composition (data)  →  Renderer (React)
   │                    │                       │                       │
   │                    │                       │                       └─ R3F mounts entities
   │                    │                       └─ persisted JSON, diffable, replayable
   │                    └─ deterministic on (recipe, seed); testable; AI-author target
   └─ Zod-validated JSON; human or AI authored; gated by Theme Critic
```

The middle layer is the key separation from MyProject's Unity composers.
In Unity, the composer instantiated prefabs directly into the live scene
— rendered output and generated output were the same thing. Here we
split them:

- **Composition** is *data*. It can be saved, diffed, replayed,
  inspected without rendering, fed to LLM judges as JSON, and re-rendered
  with different visual treatments.
- **Renderer** is a thin React component that mounts entities. It owns
  nothing creative — just the visual treatment.

This split unlocks: deterministic re-runs, snapshot-based regression
tests on composition (no canvas needed), probe-pipeline Tier 0 checks
that don't render, server-side generation (compositions can be authored
on the server and shipped to clients pre-built), and clean rollback
(swap composition JSON to roll back content without code changes).

---

## Schemas (lives in `packages/content/`)

### Recipe — the input spec

One Zod schema per content type. Recipes are *what the author wants to
build*, often parametric.

```ts
// packages/content/schemas/village-recipe.ts
export const VillageRecipe = z.object({
  id: z.string(),
  kind: z.literal('village'),
  seed: z.number().int(),
  terrain: z.string(), // reference to a TerrainRecipe id
  patches: z.object({
    market: z.number().int().min(1).max(3),
    common: z.number().int().min(1).max(8),
    gate: z.number().int().min(0).max(2),
    farm: z.number().int().min(0).max(20),
  }),
  anchors: z.array(z.object({
    role: z.enum(['tavern', 'manor', 'chapel']),
    placement: z.enum(['centre', 'edge', 'auto']),
  })),
  population: z.array(NpcAnchor),
  threads: z.array(z.string()), // thread ids active in this village
});
export type VillageRecipe = z.infer<typeof VillageRecipe>;
```

Recipes live as JSON files: `packages/content/data/recipes/villages/example-village.json`.

### Composition — the output spec

One schema fits all generators. Composition is the flat list of entities
the renderer mounts.

```ts
// packages/content/schemas/composition.ts
export const Entity = z.object({
  id: z.string(),
  type: z.enum(['mesh', 'group', 'npc', 'light', 'audio', 'trigger', 'spawn', 'patch']),
  asset: z.string().optional(),  // manifest key — '.glb' lookup
  transform: z.object({
    position: z.tuple([z.number(), z.number(), z.number()]),
    rotation: z.tuple([z.number(), z.number(), z.number()]),
    scale: z.tuple([z.number(), z.number(), z.number()]).default([1, 1, 1]),
  }),
  parent: z.string().optional(),  // for hierarchical placement
  tags: z.array(z.string()).default([]),
  props: z.record(z.unknown()).default({}),  // type-specific extras
});

export const Composition = z.object({
  meta: z.object({
    recipeId: z.string(),
    seed: z.number(),
    generator: z.string(),
    generatorVersion: z.string(),
    timestamp: z.string(),
  }),
  entities: z.array(Entity),
  provenance: z.array(z.object({  // which generator made which entity, for select-and-regenerate
    entityId: z.string(),
    source: z.string(),
    seed: z.number().optional(),
  })),
});
```

Compositions are *cached* outputs of generators. They live in
`packages/content/data/generated/` and are gitignored by default
(rebuildable from recipe + seed) — though specific reviewed
compositions can be checked in for regression baselines.

### Asset manifest

Same shape as MyProject's manifest, in JSON:

```ts
export const AssetEntry = z.object({
  key: z.string(),                 // 'synty/polygon-town/SM_Bld_Cottage_01'
  path: z.string(),                // 'assets/synty/town/cottage_01.glb'
  bounds: z.object({ min: Vec3, max: Vec3 }),
  pivotOffset: Vec3,
  animations: z.array(z.string()),
  tags: z.array(z.string()),       // ['cottage', 'residential', 'low-poly']
  tonalFlags: z.array(z.string()),
  tonalNotes: z.string().optional(),
  thumbnailPath: z.string().optional(),
  geometricClass: z.enum(['box', 'L', 'cylinder', 'plane', 'irregular']),
  outwardFaceAxis: z.enum(['+X', '-X', '+Z', '-Z']).optional(),
});

export const AssetManifest = z.object({
  generatedAt: z.string(),
  entries: z.array(AssetEntry),
});
```

Built by `packages/asset-pipeline/scan.ts` which walks `.glb` files,
reads metadata, runs heuristics (geometric class from bounds aspect,
pivot inference from mesh data), and emits
`packages/content/data/asset-manifest.json`.

---

## Generators (lives in `packages/content/generators/`)

Pure functions. Deterministic on `(recipe, seed)`. No side effects, no
I/O, no DOM.

```ts
// packages/content/generators/village.ts
export function generateVillage(
  recipe: VillageRecipe,
  ctx: GenContext,
): Composition {
  const rng = ctx.rng;                          // seeded PRNG
  const assets = ctx.assets;                    // manifest queries
  const terrain = ctx.subGenerate('terrain', recipe.terrain);
  
  const patches = patchGraph(recipe.patches, rng);          // Voronoi + Lloyd
  const wards = recursiveBisect(patches, rng);              // longest-edge bisection
  const entities: Entity[] = [];

  for (const anchor of recipe.anchors) {
    const slot = pickPatch(patches, anchor.placement, rng);
    const dwelling = ctx.subGenerate('dwelling', {
      kind: 'tavern',
      footprint: slot.polygon,
      seed: rng.int(),
    });
    entities.push(...withParent(dwelling.entities, slot.id));
  }

  for (const npc of recipe.population) {
    entities.push({
      id: `npc-${npc.id}`,
      type: 'npc',
      asset: assets.matchByTags(['pawn', npc.archetype]).key,
      transform: { position: pickInPatch(slot, rng), ... },
      props: { voiceCardId: npc.voiceCard, threadId: npc.thread },
    });
  }

  return {
    meta: { recipeId: recipe.id, seed: recipe.seed, generator: 'village', ... },
    entities,
    provenance: [...],
  };
}
```

**`GenContext` provides:**

- `rng` — seeded PRNG (e.g. `seedrandom` / `mulberry32`)
- `assets` — manifest queries: `byTag`, `byGeometricClass`, `matching(pred)`
- `subGenerate(kind, recipe)` — recursive generator call (dwelling
  inside village, village inside region). Returns a composition; caller
  inlines its entities.
- `procgen` — algorithm library (Voronoi, Lloyd, recursive bisection,
  fBm noise, etc. — see below)

Generators are AI-codegen-friendly: pure functions with strict types,
well-defined inputs and outputs, no framework magic. Claude can write
or refine one from a spec without touching the rest of the stack.

---

## Procgen library (`packages/procgen/`)

Pure TS port of the algorithms catalogued in MyProject's `procgen-stack.md`:

- 2D primitives: Voronoi (Bowyer-Watson), Lloyd relaxation, recursive
  bisection, polygon ops (clip, offset, area, centroid)
- Patch graphs: roads-first / patches / wards
- Heightmaps: fBm Perlin, ridge noise, hydraulic erosion (later)
- Distribution: Poisson disk, rejection sampling, weighted random
- Pathfinding: A* on grids, Bezier path smoothing
- Hydrology: flux-based rivers (later, when Theme work returns)

No Three.js imports in this package. Pure data. Composable. Testable
with Vitest. Reuse across server-side region pre-bake and client-side
runtime generation.

---

## Renderer (`apps/client/src/renderer/`)

Single `<Composition>` component renders any composition by entity type.
Trivial fan-out:

```tsx
export function Composition({ data }: { data: Composition }) {
  return (
    <>
      {data.entities.map(e => <RenderEntity key={e.id} entity={e} />)}
    </>
  );
}

function RenderEntity({ entity }: { entity: Entity }) {
  switch (entity.type) {
    case 'mesh': return <MeshEntity entity={entity} />;
    case 'npc':  return <NpcEntity entity={entity} />;
    case 'light': return <LightEntity entity={entity} />;
    case 'patch': return <PatchEntity entity={entity} />;
    // ...
  }
}

function MeshEntity({ entity }: { entity: Entity }) {
  const { scene } = useGLTF(assetUrl(entity.asset));
  return (
    <primitive
      object={scene.clone()}
      position={entity.transform.position}
      rotation={entity.transform.rotation}
      scale={entity.transform.scale}
      userData={{ entityId: entity.id, tags: entity.tags }}
    />
  );
}
```

`userData.entityId` is the bridge for click-to-inspect (see Exploration
tools below).

---

## AI authoring pipeline

The writer→critic→bake loop from MyProject ports verbatim — only the
bake target changes:

```
                   ┌─────── recipe-writer subagent ────────┐
                   │ generates candidate recipe JSON       │
                   └───────────────┬───────────────────────┘
                                   ▼
                   ┌─────── theme-critic subagent ─────────┐
                   │ pass / flag / fail with per-axis verdict │
                   └───────────────┬───────────────────────┘
                                   ▼
                   ┌─────── main session bakes ────────────┐
                   │ writes survivors to                   │
                   │ packages/content/data/recipes/...     │
                   └───────────────┬───────────────────────┘
                                   ▼
                   ┌─────── HMR picks up change ───────────┐
                   │ generators re-run, scene updates       │
                   └───────────────────────────────────────┘
```

Subagents (`.claude/agents/recipe-writer.md`, `theme-critic.md`, etc.)
port from MyProject with the prompt updated for JSON-Zod output instead
of ScriptableObject YAML.

For larger batch authoring (e.g. seed a village with 13 NPC voice
cards), the orchestration lives in `scripts/author-batch.ts` calling
Claude Code subagents via Bash / Agent tool.

---

## Exploration tools (the "Scene View" replacement)

Lives in `apps/client/src/dev/`. Mounted only in dev builds. Five surfaces:

### 1. Scene browser — `/dev/scenes`

Lists all generator types and known recipes. Click a recipe → opens a
full-screen scene with controls.

```
┌──────────────────────────────────────────────────────────────┐
│ Dev / Scenes                                                 │
├──────────────────────────────────────────────────────────────┤
│ ▾ Villages              ▾ Dwellings        ▾ Regions         │
│   example-village           cottage             starter-region │
│   second-village          tavern              ...            │
│   ...                     manor                              │
│                           ...                                │
└──────────────────────────────────────────────────────────────┘
```

Per-scene controls (right rail, leva-bound):
- Seed slider (regenerates on change, no reload)
- Recipe field overrides (debounced regen)
- "Random seed" button
- "Save composition" button (downloads JSON)
- "Open in variant grid" button

### 2. Inspector overlay

Toggleable HUD (`~` key or button) in any dev scene:
- Top-down debug camera mode (orbit camera released)
- Click any entity in 3D → entity panel opens with id, type, asset key,
  transform, tags, provenance source, props
- Bounds visualizer (drei `<Bounds />`)
- Wireframe / axis / grid helper toggles
- Entity list (sortable by type / tag) with click-to-focus

leva drives the right rail; `useControls` per panel; `userData.entityId`
on Three objects bridges click → inspector state.

### 3. Variant grid — `/dev/variants/:generatorId/:recipeId`

Renders an `N × N` grid of seed variations side-by-side. Each cell is
its own R3F canvas (or sub-viewport with `<View>` from drei). For
variance / "does this generator produce diverse outputs?" checks.

3×3 default; configurable. Click a cell → opens that seed in the scene
browser.

### 4. Composition viewer — `/dev/composition/:filename`

Loads any saved composition JSON, renders it (no generator re-run),
shows side-by-side with the source JSON. For regression baselines and
"what did this look like a week ago?" diffing.

### 5. Probe gallery — `/dev/probes`

Lists probe runs (timestamped). Each probe shows captured screenshots,
Tier 0 findings JSON, optional Tier 1+ judge verdicts. The MyProject
probe-pipeline UI ported to React.

### Implementation size

Each dev surface is ~150-300 lines. Total dev tooling: ~1500 lines.
Built incrementally — Scene browser + Inspector overlay first, the rest
when needed.

---

## Iteration loop (vs Unity's Build menu)

| Step | Unity | WebGL |
|------|-------|-------|
| Edit recipe | Inspector form on ScriptableObject | JSON file in editor, or leva controls in scene browser |
| Trigger generation | `Pipeline → … → Build` menu | Automatic — generator re-runs on recipe HMR or seed change |
| Inspect output | Scene View + Hierarchy | `/dev/scenes/:id` + Inspector overlay |
| Iterate | Edit + Build + look + repeat | Edit + HMR + look + repeat (faster) |

Vite HMR < Unity domain reload by a factor of ~10x in practice. The
loop tightens significantly.

---

## Probe / evaluation pipeline

Two tiers fit the WebGL stack:

### Tier 0 — static (no rendering)

Pure-function checks on **composition spec**. No canvas needed; runs in
Vitest milliseconds. Examples:

- `entityCount(comp) === recipe.expectedCount`
- `noOverlapping(meshEntities)` — AABB overlap check
- `walkableGap(buildings) >= MIN_GAP`
- `themeFlagsClean(comp, manifest)` — no entity uses asset tagged with
  forbidden tonal flag
- `everyAnchorPlaced(comp, recipe.anchors)`

These should be exhaustive — most real defects are catchable here at
near-zero cost. Catches the "AI generated a village with no tavern"
class of bug deterministically.

### Tier 1+ — rendered (Playwright)

`packages/probes/run.ts`:
1. Spawn dev server
2. Playwright opens `/dev/scenes/:id?seed=:seed` headless
3. Wait for composition mount (signal via `window.__compositionReady`)
4. Capture canvas: `await page.locator('canvas').screenshot()`
5. Capture composition JSON: `await page.evaluate(() => window.__composition)`
6. Emit artifact bundle to `temp/probes/<probe>-<stamp>/`:
   `manifest.json`, `composition.json`, `frames/*.png`, `static_findings.json`

7. (optional, dev-triggered) `bin/judge-artifact.sh --latest` — feeds
   frames + composition to Claude vision API; lens fanout (vision /
   player / flow / a11y / l10n) per MyProject's tier-2 spec.

Same cost tiers as MyProject. Same "no LLM in CI" hard rule.

---

## Packages summary

```
packages/content/
  schemas/        — Zod schemas for recipe / composition / manifest / sub-types
  data/
    recipes/      — author-authored recipe JSON (git-tracked)
    generated/    — generator output cache (gitignored, regression baselines opted-in)
    asset-manifest.json
  generators/     — pure (recipe, seed) → composition functions
  index.ts        — loaders, validators, generator registry

packages/procgen/
  voronoi.ts, lloyd.ts, bisect.ts, noise.ts, poisson.ts, …
  (no Three, no React, no IO)

packages/asset-pipeline/
  fbx-to-glb.ts   — batch convert the chosen asset pack .fbx
  optimize.ts     — gltf-transform pipeline
  scan.ts         — emit asset-manifest.json with bounds, pivot, tags

packages/probes/
  capture.ts      — Playwright canvas + composition capture
  tier0/          — static checks on Composition
  judge.ts        — LLM judge invocation (dev-only)
  aggregate.ts    — issue-feed dedup (port from MyProject)

apps/client/src/
  renderer/       — <Composition>, <RenderEntity>, per-type entity components
  dev/
    scene-browser/
    inspector/
    variant-grid/
    composition-viewer/
    probe-gallery/
  game/           — actual gameplay scenes (assembled from recipes too)
```

---

## What's better than Unity here

- **Composition is data, not scene state.** Diffable, replayable,
  server-bakeable, regression-testable without rendering.
- **HMR > domain reload.** Iteration loop is faster.
- **Tier 0 checks are pure functions on data**, not PlayMode harness
  + ScreenCapture. Much cheaper, much faster, more checks possible.
- **Generators are pure typed functions.** AI writes / refines them
  one at a time, no Unity-MCP refresh dance.
- **No editor environment to maintain.** Browser is the editor.

## What's worse than Unity here

- **No native scene-tree manipulation.** Triplex helps if it's ever
  needed; AI-codegen workflow rarely is.
- **Per-asset thumbnail generation** has to be rebuilt (Playwright
  loads each asset in a viewer route → captures → writes alongside
  manifest entry). Doable, not free.
- **No instance overrides** the way Unity prefab variants allow. We
  pay for this via more explicit recipe parameters; arguably cleaner.

---

## Director mode — AI-assisted iteration in the scene explorer

The explorer isn't just an inspector. It is the cockpit for AI-directed
regeneration: select something, describe what's wrong (or what you
want), submit, get a patched scene back to review.

This is **design-time, not runtime** — the standing no-runtime-LLM rule
holds. The director loop lives in dev builds; baked output ships
static.

### Selection modes

User can target intervention at varying granularity:

- **Single entity** — click a mesh / NPC / light; selection = its entity id
- **Multi-select** — shift-click; selection = entity id set
- **3D region** — drag a box in top-down camera; selection = entities
  inside, plus the bbox itself
- **Screen rectangle** — drag on the rendered frame; selection = the
  captured pixel region (sent as image to the director) plus entities
  under the rect via raycast
- **Recipe field** — pick a field in the recipe JSON sidebar; selection
  = `{ recipePath: 'patches.farm' }`
- **Whole composition** — no selection, feedback applies to everything

Selection state is one object that gets sent verbatim to the director.

### Intervention levels

The director chooses (or the user forces) one of four levels:

| Level | What changes | Cost | When to use |
|---|---|---|---|
| **Composition patch** | Direct edits to composition JSON (move/rotate/delete/add entities). No regeneration. | Cheap, instant. | "Move this tavern 5m east"; "rotate this NPC to face the door"; small tweaks. |
| **Recipe patch + regen** | Edit recipe JSON, re-run generator from same seed. Most entities preserved if generator is stable. | One generator run. | "Add more farms"; "use a different building palette"; structural changes. |
| **Seed reroll** | Same recipe, new seed. Variance check. | One generator run. | "I don't like this specific arrangement, try another." |
| **Generator suggestion** | Director proposes a code change to the generator itself. Returned to user as a diff for review; never auto-applied. | Slow (commit-worthy). | "Buildings always face the same way; the generator should vary rotation by patch normal." |

Default mode: director picks. Override via a dropdown in the UI.

### The director agent

New subagent: `.claude/agents/scene-director.md`. Its brief:

> Given a selection, a written feedback line, the current composition
> JSON, the source recipe, the generator metadata, and the asset manifest
> summary, decide the lowest-cost intervention that satisfies the
> feedback. Emit one of:
>
> - `{ kind: 'composition-patch', operations: JsonPatch[] }`
> - `{ kind: 'recipe-patch', operations: JsonPatch[], regenerate: true }`
> - `{ kind: 'seed-reroll', seed: number }`
> - `{ kind: 'generator-suggestion', file: string, diff: string }`
> - `{ kind: 'clarify', question: string }`
>
> Never modify files directly. Never produce intervention output that
> would violate the constitution; prefer to `clarify` if unsure.

The director sees: composition (truncated to relevant entities if
large), recipe, generator signature + source (for the targeted
generator), asset manifest entries matching tags relevant to selection,
constitution rules from `docs/game/`, and any prior director
interventions in this session (for coherence across iterations).

The director outputs structured JSON; the main session validates and
applies.

### Apply pipeline

```
Director output
      │
      ▼
Validate
  - JSON schema valid?
  - referenced entity ids exist?
  - asset keys exist in manifest?
  - within recipe schema bounds (Zod)?
      │
      ▼
Apply (in memory first, not yet persisted)
  - Composition patch: jsonpatch on composition
  - Recipe patch: jsonpatch on recipe → run generator → produce new composition
  - Seed reroll: same recipe, new seed → generator → new composition
      │
      ▼
Tier 0 static checks on the new composition
  - No overlap, walkability, theme flags clean, anchors placed, …
      │
      ▼
Theme Critic gate (configurable: warn vs block)
      │
      ▼
Diff preview UI
  - Side-by-side 3D view: before / after
  - JSON diff of recipe + composition
  - Tier 0 findings (any new / resolved issues)
  - Accept / Reject / Edit-and-retry buttons
      │
      ▼
On accept:
  - Write recipe patch to packages/content/data/recipes/...
  - Composition cache invalidated; new composition optionally checked in
  - Provenance log appended (who, what, when, why, director output)
      │
      ▼
On reject:
  - Discard; optionally feed rejection back as "the director's first try was wrong because…"
```

### Provenance + anchors

The `composition.provenance[]` array exists for this loop. Each entity
records its source generator + seed. The director uses it to:

- Target the right generator when patching ("the tavern came from the
  `dwelling` generator with seed 42 — patch *that*")
- Preserve human-tweaked entities across regens (entities marked
  `provenance.source === 'human-edit'` are anchored)
- Roll back individual entities to a previous provenance generation

Anchors are user-controllable in the Inspector: right-click any entity
→ "Anchor (preserve across regens)." Anchored entities are sent to the
director as constraints, not as editable surface.

This is the live version of Unity's "Decompose / Mutate" stub from
MyProject — finally implemented because composition is data.

### Director UI in the explorer

New panel, opens with a hotkey (`d`) or button. Layout:

```
┌─ Selection ────────────────────────────────┐
│ 3 entities · 1 recipe field                │  <- click to focus in 3D
│ • building/tavern-01                       │
│ • building/cottage-04                      │
│ • npc/hella                                │
│ • recipe.patches.farm = 5                  │
└────────────────────────────────────────────┘

┌─ Feedback ─────────────────────────────────┐
│ ┌──────────────────────────────────────┐   │
│ │ Less uniform — vary building rotation │   │
│ │ and add a small market in the centre │   │
│ │ of these three.                       │   │
│ └──────────────────────────────────────┘   │
│                                            │
│ Mode: [Auto ▼]   [□ Include screenshot]    │
│                                            │
│ [        Submit to Director        ]       │
└────────────────────────────────────────────┘

┌─ Director output ──────────────────────────┐
│ Kind: recipe-patch + regen                 │
│ Reasoning: ▾                               │
│   Three buildings selected; vary placement │
│   via patches[2].rotationJitter += 0.3.    │
│   Market expressed as +1 to                │
│   patches.market in same ward.             │
│ Patch: ▾                                   │
│   { "op": "replace", "path":               │
│     "/patches/market", "value": 2 }, …     │
│ Tier 0: ✓ all checks pass                  │
│ Theme Critic: ✓ pass                       │
│                                            │
│ [ Accept ]  [ Reject ]  [ Tweak & retry ]  │
└────────────────────────────────────────────┘

┌─ Diff preview ─────────────────────────────┐
│  Before │  After   <- swipeable / overlay  │
│  ▢ ▢ ▢  │  ▢  ▢   .                        │
│         │  ◇  ▢                            │
└────────────────────────────────────────────┘
```

### Connection to Claude — two paths

**v0 (Claude Code as executor):**
- Director UI writes a task spec to `tmp/director-tasks/<id>.json`
- This Claude Code session (or a watching subagent) picks it up,
  responds with `tmp/director-results/<id>.json`
- Dev server file-watches the results directory and pushes to the UI
- No API key in client code. Zero extra cost beyond Claude Code Max.
- Works as long as Claude Code is running.

**v1 (direct API proxy):**
- Dev server has a `/api/director` POST endpoint
- Proxies to Anthropic API with the user's key (env var)
- Lower latency (no file-watching round trip)
- Works without Claude Code running (e.g., for design playtests)
- Add when v0 friction becomes real.

Start with v0. The plumbing is dead simple (write JSON, read JSON), no
network code, and reuses the user's existing Claude Code session as the
brain. The director-agent's prompt and tool surface lives in
`.claude/agents/scene-director.md` regardless.

### Director context budget

Concern: composition JSON can grow large. Mitigations:
- Always send selection-relevant slice, not whole composition. Entity
  set computed from selection bbox + manifest keys referenced.
- Recipe is usually small (KB-scale).
- Generator source: only the file(s) implicated by selection — usually
  one.
- Asset manifest: filtered to entries tagged similarly to selection.
- Prior interventions: cap to last 5 per session.

Typical director call: 5-20k tokens in, structured output back. Well
within Sonnet/Opus context limits with cache hits on the static parts
(generator source, schemas, manifest summary).

### Safety + rollback

- Every accepted intervention is logged in
  `packages/content/data/director-log.jsonl` with full context. Replay
  any session.
- Composition before/after pairs are saved to
  `packages/content/data/generated/director-history/<timestamp>-<id>/`
  for diffing later.
- Undo (Cmd-Z) reverts to the previous composition; full history
  navigable.
- Theme Critic gate is *configurable* (warn / block); some experimental
  iterations want it as warn-only. Default: block.

### What this unlocks

- Tight director-style iteration with single-engineer cadence: "I don't
  like this, change it" → seconds to result.
- AI does the *labour* of regenerating; human does *judgement*. The
  methodology bet in concrete UI form.
- Director output is a structured artifact, not chat — feeds back into
  the corpus as training data for future generator improvements.
- Generator-suggestion intervention level captures *meta-feedback*: when
  a recurring fix points at a generator bug, the director surfaces it
  as a code change.

---

## Roadmap (rough sequence)

1. Schemas (recipe, composition, manifest)
2. Asset pipeline scan → one the chosen asset pack `.glb` → manifest entry
3. Minimal generator (hut from a recipe → composition with one mesh)
4. `<Composition>` renderer + dev route to view it
5. Scene browser shell + leva seed/recipe controls
6. Procgen primitives (Voronoi + Lloyd + bisect first)
7. Village generator (port the MyProject one)
8. Inspector overlay
9. Probe Tier 0 (static checks)
10. Probe Tier 1 (Playwright capture + judge)
11. Variant grid + composition viewer (when iteration density justifies)
12. Director mode — selection + feedback UI + scene-director subagent +
    apply pipeline + diff preview (sequence after Inspector overlay)

---

## Scene-node-kind extension point (issue #703)

A `.scene.json` is a tree of nodes. Every node carries a `kind` string
that the SceneRenderer dispatches against — built-in `kind` values
(`mesh`, `directional-light`, `perspective-camera`, `hud`,
`hud-layer`) route through their strict schemas; consumer-registered
`<owner>/<surface>` kinds route through `lookupSceneNodeKind`.

Both ends of the dispatch share the **canonical four-field shape**:

```jsonc
{
  "id": "spawn-alpha",                  // stable scene-node id
  "kind": "my-app/spawn-point",         // registry lookup
  "params": { "team": "alpha" },        // per-instance, Zod-validated
  "transform": { "position": [0,0,0] }, // canonical TRS source
  "children": []                        // recursive SceneNode[]
}
```

`defineSceneNodeKind({ id, params, renderJsx })` is the primitive
consumer code registers against; `definePrefab({ id, params,
renderJsx, metadata })` is the shape consumers reach for when the
content unit also needs the prefab-system's author-time recipe /
generator / director / metadata bundle (see `prefab-system.md`). Both
end up in the same registry — the SceneRenderer doesn't care which
factory the registration came from.

**Transform discipline.** The kind's `renderJsx` body is pure on
`params` — it returns a React element tree, no transform props. The
SceneRenderer wraps the output in a `<group>` carrying
`node.transform`. Keeps the editor's transform gizmo / Inspector /
scene-accessor / snapshot pipeline working uniformly across built-in
and custom kinds (no special-casing per kind).

**Editor integration.** The Add-Node menu surfaces every registered
kind (grouped by owner segment); the Inspector renders the kind's
Zod `params` via `leva-from-zod`. `.vibesmith/schemas/scene.schema.json`
emits per-kind variants for IDE autocomplete.
