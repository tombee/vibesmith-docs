---
title: 'Procgen — scale-fractal spatial composition capability extension'
description: 'Third instance of the capability extension pattern. Provides a scale-fractal substrate for spatial composition: per-scale generator registry, typed handoffs between adjacent scales (SiteContract upward + SeamContract sideways), deterministic seed chain...'
---

> **Framework. Game-agnostic.** Third instance of the capability
> extension pattern, sibling to
> [`asset-catalogue.md`](asset-catalogue.md) (first instance) and
> `recipe-canon.md` (second instance). Provides a
> *scale-fractal substrate* for spatial composition: a registry of
> per-scale generators, typed handoffs between adjacent scales
> (`SiteContract` upward + `SeamContract` sideways), a deterministic
> seed chain that lets any subtree regenerate without disturbing
> parents or siblings, and a refine loop the dev-shell exposes as
> "regenerate / refine with spec change / generate sub-feature here"
> on a selected node.
>
> **What this is not.** Not engine-specific (no Three.js / R3F /
> Bevy assumptions); not genre-specific (no medieval-overworld
> baked in); not settlement-shaped (settlement is one scale among
> many). The framework ships the registry + contracts + refine
> loop + a thin reference backend; the *algorithms* that populate
> each scale (Voronoi patches, A* / least-cost roads, BSP rooms,
> BFS dungeon trees, wave-function-collapse tilesets, graph
> grammars) live as content — recipes under a new
> `spatial-composition` category in `recipe-canon.md` — not as
> framework code. Consumers and the community ship algorithms;
> the framework keeps the substrate honest.
>
> **Prior art credit.** The polygonal-patch settlement generator
> family and BFS-tree dungeon generator family — the shapes this
> substrate is built to host — descend from the Procgen Arcana
> lineage[^1]. The substrate is intentionally generator-agnostic
> so WFC, graph-grammar, BSP, and L-system backends are equal
> citizens; none of those families is privileged in the contract.

[^1]: *Procgen Arcana* (Watabou — `https://watabou.itch.io/`) is the
public collection that popularised polygonal-patch settlement
generation and one-page dungeon generation in interactive form;
*Azgaar's Fantasy Map Generator*
(`https://azgaar.github.io/Fantasy-Map-Generator/`) is the
canonical Voronoi-cell world-map generator. Cited for prior-art
inspiration only — no coupling to either tool is implied; the
framework does not depend on them, link to them, or wrap them.

This extension is the third instance of the framework's capability
extension pattern. Read
`canon-substrate.md` and
`capabilities-and-providers.md`
first; this doc assumes their concepts (canon, stage runner,
capability/provider abstraction, validation shape, query layer,
status state machine).

---

## In one sentence

**A generator is a typed, scale-tagged, seed-deterministic function
that reads pinned-canon `SiteContract`s from its parent and any
`SeamContract`s its siblings publish, writes a structured composition
artifact at its own scale, and exposes a set of `refineVerbs` the
dev-shell surfaces as one-click regenerate-this-subtree handles
without disturbing parents or siblings.**

---

## The problem it closes

Spatial composition at multiple scales — realm → settlement → ward →
plot → building → room → dungeon, or whatever scale ladder a
consumer needs — is **AI-difficult-bits work** in the
[positioning](/positioning/) sense. Indie devs
without specialist procedural-content hires can't do it solo on
quality, and a generic AI can't do it on first attempt either: the
algorithms that get state-of-the-art results at each scale are
*different families* (Voronoi patches for region partition, A* /
least-cost paths for roads, BSP / WFC / graph grammars for
interiors, BFS trees for dungeons), and each lives in its own tool
with its own coordinate convention, its own RNG, its own export
format, and no parent-context handoff.

What's missing isn't the algorithms — those exist in good
implementations across the open-source landscape and in
research-grade reference projects. What's missing is the
substrate that lets a developer:

1. **Compose them across scales.** A settlement generator should
   start from a parent region's published terrain + climate +
   river-network as *input it cannot mutate*, not from scratch
   on its own assumptions. A building generator inside a plot
   should fit the plot's footprint + neighbour wall directions,
   not pick its own.
2. **Refine deterministically.** "Regenerate just this ward"
   should re-roll exactly that subtree's seed chain, leaving the
   rest of the world byte-identical. "Try a different spec at
   this plot" should swap the spec without touching the seed.
   "Generate a sub-feature here" should derive a child seed from
   the selected node and never collide with sibling seeds.
3. **Validate domain-specifically.** A generated layout that's
   structurally valid (no overlapping rooms) can still be
   *geometrically* wrong (impossible slope to the river), or
   *seam-invalid* (door opens onto a sibling region's cliff
   face), or *asset-infeasible* (no recipe in the project's
   catalogue fits the declared style). Three different critics,
   one queue.

The procgen extension is the substrate that lets all three happen
on the same artifact, with the same dev-shell workspace, against
the same canon. The algorithms remain content; the *composition*
becomes framework.

### Three illustrative consumer profiles

The same substrate hosts very different consumer needs. These are
illustrative — *not* canonical shapes the framework privileges.

**Profile A — 3D overworld with settlements (illustrative).**
A consumer building a 3D explorable world wants a default ladder
of `realm → region → settlement → ward → plot → building → room`.
The settlement scale uses a polygonal-patch generator family; the
building scale uses BSP-then-WFC for interiors; the realm scale
uses Voronoi-cell partition for region boundaries. Seven scales,
six generators (one shared between `realm` and `region`), one
seed chain.

**Profile B — 2D top-down roguelike (illustrative).**
A consumer building a 2D top-down dungeon-crawler doesn't need
`realm` / `region` / `settlement`. Their ladder is `floor →
interior → room → corridor`. Four scales, three generators. The
floor scale uses a BFS-tree dungeon generator; the room scale
uses a small WFC tileset; corridors are A* under sparse-graph
constraints. Same substrate, smaller ladder.

**Profile C — sci-fi station / vessel (illustrative).**
A consumer building a station / starship interior wants `sector →
deck → bay → room`. Four scales. Deck partitions use rectangular
BSP with explicit corridor channels; sectors use graph-grammar
adjacencies (engineering must connect to bridge via spine
corridor); rooms use WFC over a sci-fi tileset. Same substrate
again.

The ladder is **consumer-declared** in `vibesmith.toml`. The
framework ships sensible defaults but does not commit any
consumer to the seven-scale 3D ladder, the four-scale 2D ladder,
or the four-scale sci-fi ladder.

---

## What a generator is

```ts
defineGenerator({
  id: 'settlement.polygonal-patch.v1',
  scale: 'settlement',
  reads: ['region'],            // parent + sibling scales whose
                                // SiteContracts / SeamContracts
                                // this generator consumes
  writes: 'settlement',         // the scale this generator outputs
  refineVerbs: ['grow', 'infill', 'inflect', 'rebake'],
  terrainAuthority: 'inherit',  // 'inherit' | 'own' | 'shared'
  generate(ctx: GeneratorContext): GeneratorOutput { /* ... */ },
})
```

### Field-by-field

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | `string` (kebab-case, scale-prefixed, version-suffixed) | yes | Stable identity. `<scale>.<algorithm-family>.<vN>`. Version bumps for breaking generator changes; the recipe layer (specs) varies *parameters* without bumping the generator. |
| `scale` | `Scale` (consumer-declared enum) | yes | The scale this generator writes. One generator per `id` per scale; multiple generators per scale are allowed and compete (see `selectGenerator`). |
| `reads` | `Scale[]` | yes | The set of upstream + sibling scales the generator consumes. Used by the registry to compute dependency order and by the refine loop to compute the dirty subtree. |
| `writes` | `Scale` | yes | Always equal to `scale`. Declared explicitly so the registry can validate the contract without parsing `generate`. |
| `refineVerbs` | `RefineVerb[]` | yes | Subset of `'grow' \| 'infill' \| 'inflect' \| 'rebake'`. The dev-shell shows exactly the verbs declared. A generator that doesn't support `inflect` (e.g., a pure WFC backend) simply omits it. |
| `terrainAuthority` | `'inherit' \| 'own' \| 'shared'` | yes | Who owns terrain at this scale. `inherit` reads parent terrain unchanged. `own` writes terrain (region scale typically). `shared` reads parent terrain + may publish a refined heightfield child generators inherit. Exactly one generator per chain may be `own` per terrain layer. |
| `generate` | `(ctx) => GeneratorOutput` | yes | The pure-ish function the substrate calls. Pure modulo the RNG it gets from `ctx.rng` and the IO it does through `ctx.io` (read-only access to parent canon + write access to its own scale's draft node). |

### What a generator is *not*

- **Not a stage in a pipeline.** Generators are *one per scale per
  recipe*; the substrate composes them across scales by
  dependency order. A stage-runner (asset-catalogue shape) is
  fundamentally different — that's a single artifact moving
  through ingest → render → classify → embed.
- **Not a renderer.** Generators write structured composition
  data — patches, polygons, graph nodes, room rects, tile grids.
  Rendering happens downstream via the consumer's normal
  scene-construction pipeline against the generator's output.
- **Not a director.** A generator does not decide *what to
  build*; it accepts a `Spec` (a recipe-canon entry) and
  realises it. The director pattern
  ([`director-pattern.md`](director-pattern.md))
  composes specs *across* generators; that's a layer above this
  one.
- **Not a snapshot.** Generator output is canon (typically
  promoted to canon after critic gating); the snapshot system
  captures *state*. The two interact at the
  `canon-snapshot-at-bake` boundary (see § Snapshot integration).

---

## Scale ladder

The scale ladder is **consumer-declared** in `vibesmith.toml`:

```toml
[procgen]
scales = ["realm", "region", "settlement", "ward", "plot", "building", "room"]
```

The framework ships **three default ladders as recipes** under
the `spatial-composition.ladder` category — Profile A / B / C
above. Consumers pick one in the new-project wizard or hand-edit
the manifest; either way it's just a recipe ID.

### Default ladders (recipe-canon entries)

**Profile A — 3D-overworld ladder (default 3D template).**

| Scale | Typical extent | Default backend family |
|---|---|---|
| `realm` | 10⁵ – 10⁶ m | Voronoi-cell partition |
| `region` | 10⁴ – 10⁵ m | Voronoi-cell + heightfield |
| `settlement` | 10² – 10³ m | Polygonal-patch |
| `ward` | 10¹ – 10² m | Sub-patch + road graph |
| `plot` | 1 – 10 m | Rectangular partition |
| `building` | 1 – 10 m | BSP / WFC interior |
| `room` | 0.1 – 1 m | WFC / authored |

**Profile B — 2D-roguelike ladder (default 2D template).**

| Scale | Typical extent | Default backend family |
|---|---|---|
| `floor` | grid | BFS-tree dungeon |
| `interior` | grid sub-region | BSP |
| `room` | grid cells | WFC small tileset |
| `corridor` | grid path | A* sparse graph |

**Profile C — sci-fi-interior ladder (default vessel/station template).**

| Scale | Typical extent | Default backend family |
|---|---|---|
| `sector` | graph | Graph-grammar adjacencies |
| `deck` | rectangle | Rectangular BSP + spine corridor |
| `bay` | sub-rectangle | BSP |
| `room` | grid cells | WFC sci-fi tileset |

### Adding scales

Consumers may add scales. The substrate enforces only that the
ladder is a strict total order (every scale has at most one
parent scale, scales don't cycle). A consumer adding a `district`
scale between `region` and `settlement` simply lists it in
`[procgen].scales` and ships a generator that `reads: ['region']`
and `writes: 'district'` + bumps the settlement generator to
`reads: ['district']`. The default-ladder recipes don't update;
they're separate entries.

---

## Refine verbs

The refine verb set is **closed at v1** — four verbs, each with a
defined semantics the dev-shell maps to a one-click handle on the
selected node.

### `grow`

Extend the node's content **outward** without re-rolling its
existing content. Settlement: add a new ward at the edge of the
current patch boundary, leaving existing wards byte-identical.
Dungeon floor: append a corridor + room past a chosen door,
leaving the existing graph intact. Generators implementing
`grow` declare a *frontier* — the set of points where extension
is legal — and the dev-shell highlights the frontier when the
verb is selected.

### `infill`

Add detail **inward** to existing content without changing its
silhouette or its child-generator handoffs. Settlement: subdivide
an existing ward into finer plots without changing the ward
boundary. Building: insert internal partitions inside an existing
floor outline. Infill that would change a `SiteContract` the
node already published *fails the refine* and surfaces as a
critic warning (see § Critic ensemble integration); the user
chooses `rebake` if they want the contract to change.

### `inflect`

**Parameter sweep** at the current spec. Re-run the generator
with the same seed and same parent canon but a *different
parameter vector* drawn from the spec's declared parameter
ranges. The four-or-five-output variant slider in the dev-shell
is the canonical surface. Pure-WFC backends often can't support
`inflect` cleanly (parameters live inside the tileset, not the
generator); those generators omit the verb.

### `rebake`

**Re-roll** this node and everything below it from a new seed.
Parents are untouched; siblings are untouched; the entire
subtree replaces. This is the verb the dev-shell uses for
"regenerate" — the most common refine action. `rebake` reads the
*pinned parent canon* at the time of the bake, so re-baking a
ward weeks after the realm last changed still produces output
that's consistent with the realm-as-it-was-when-this-ward-was-pinned.

### Refine + the lineage chain

Every refine action emits a new canon node with `parent_entity_id`
pointing at the *previous* version, `modified_reason` recording
the verb, and (for `rebake`) `superseded_by` updated on the old
node. The lineage is queryable; reverting a refine is a canon
operation, not a generator operation.

---

## Site contracts + seam contracts

The typed handoffs between adjacent-scale generators are the
load-bearing primitive — they're what makes "regenerate this
subtree without disturbing parents" mean something precise.

### `SiteContract` (parent → child, upward publish)

When a node at scale `N` finalises, it publishes a `SiteContract`
upward — a typed declaration of what its bounding region looks
like from outside, what child sites exist within it, and what
external interfaces (roads, doors, seams) leave it.

```ts
type SiteContract = {
  scale: Scale
  bounds: Polygon                    // closed polygon in scale-local metres
  childSites: {                      // sub-nodes the next-scale-down generator picks up
    id: string
    scale: Scale                     // always one rung below this node's scale
    site: Polygon | Point | Cell     // shape depends on the child scale's convention
    spec: RecipeRef                  // the recipe (spec) the child should realise
    seed: number                     // derived from this node's seed + child index
  }[]
  externalSeams: {                   // edges that meet this node's siblings
    id: string
    edge: LineSegment | Curve        // expressed in this scale's coords
    kind: 'road' | 'wall' | 'water' | 'open' | string
    targetSiblingId?: string         // if known; sibling generators publish matching SeamContracts
  }[]
  terrain?: HeightfieldRef           // present only when terrainAuthority is 'own' or 'shared'
  metadata?: Record<string, JsonValue>
}
```

The child generator at scale `N-1` reads its `SiteContract`
entry (the `childSites[i]` shape its parent published) as **its
input contract**. The child cannot mutate the parent's
`SiteContract`. Anything the child needs from the parent that the
contract doesn't expose is a contract gap the parent generator
must fix; the child does not reach around.

### `SeamContract` (sibling → sibling, sideways publish)

Adjacent nodes at the same scale publish `SeamContract`s along
their shared edges. A settlement-A and settlement-B in the same
region declare what the road between them looks like at the
boundary: which side has the bridge, which has the gate, what
elevation the seam sits at.

```ts
type SeamContract = {
  selfId: string                     // this node
  peerId: string                     // the neighbouring node
  edge: LineSegment | Curve          // shared boundary in region-local coords
  payload: {                         // declared by the seam kind's schema
    kind: 'road' | 'water' | 'wall' | 'open' | string
    elevation?: number
    width?: number
    [key: string]: JsonValue
  }
}
```

Both peers publish; the substrate's seam-validator critic checks
that the two payloads are compatible (matching elevation,
matching width, matching kind). Mismatches surface as critic
warnings into the proactive-advice-queue.

### Coordinate convention

**One convention, used everywhere.**

- **Scale-local metres.** Coordinates inside a node are in
  metres relative to that node's bounding region — *not* relative
  to the parent. A 100m ward at settlement coordinates `(500,
  300)` exposes child-plot coordinates in `[0..100] × [0..100]`,
  not in `[500..600] × [300..400]`. The substrate handles the
  affine transform up the chain on read.
- **Origin at the SW corner.** Of the scale's extent.
  Unambiguous and matches the most common map convention.
- **Y-up.** Three-axis coordinates are `(x_east, y_up, z_south)`;
  two-axis coordinates are `(x_east, z_south)` — Y omitted because
  2D scales don't have one. *Not* (x, y) with z-up; the framework
  picks one convention and the procgen extension does not negotiate.

Renderers convert from the procgen convention to their own at
the scene-construction boundary, never inside a generator.

---

## Deterministic seed chain

Every node has a stable `seed: number`. The chain rules:

1. **Root seed** comes from the project (e.g.,
   `vibesmith.toml [procgen].rootSeed`) or from a snapshot's
   pinned root seed.
2. **Child seed** is derived from the parent seed + child index
   via a stable function: `derive(parentSeed, childIndex)`. The
   default implementation is a Park-Miller LCG step
   (`(48271 * seed) % 2147483647`) followed by a `child_index`
   mix. Park-Miller is chosen for: well-understood statistical
   properties at the scale of single-digit derivations per node;
   trivial cross-language implementation; zero dependencies; and
   the absence of cryptographic-strength requirements that would
   pull in heavier RNGs.
3. **Refine seeds.** `rebake` derives a *new* root for that
   subtree from the user's explicit re-roll request (typically
   `now()`-derived or user-typed). `grow` / `infill` / `inflect`
   keep the existing seed and derive new child seeds for the
   verbs' newly-created nodes only.
4. **Consumer override.** Consumers may swap the RNG via
   `[procgen].rng = "park-miller" | "xoshiro256**" | "<custom>"`
   in `vibesmith.toml`. The contract is just the
   `derive(parentSeed, childIndex) → number` shape; the substrate
   doesn't depend on the choice.

The full seed of any node is a function of the root seed + the
node's path in the scale tree + (for refined nodes) the refine
history. Two developers cloning the same project with the same
root seed produce byte-identical worlds.

---

## Specs as recipe-canon entries

The single load-bearing principle this extension imports from
prior work in the procgen-tools lineage:

> **Algorithm is code. Choices are data. Every choice is a
> recipe-canon entry.**

A generator's `id` selects the *algorithm family*. The `Spec` the
generator consumes is a `recipe-canon` entry under a new
`spatial-composition` category — same shape as
`recipe-canon.md`'s VFX / shader recipes.

### Three swap axes, three operations

| Swap | Operation | Example |
|---|---|---|
| **Backend swap** | Replace generator `id` for a given scale | Swap polygonal-patch for graph-grammar at `settlement` scale; spec stays the same. |
| **Spec swap** | Replace `Spec` recipe; generator unchanged | Swap a "coastal-trade-hub" spec for a "fortified-frontier" spec at the same settlement node; backend stays polygonal-patch. |
| **Pack override** | Project-local recipe replaces framework recipe of the same ID | Project ships its own `settlement.coastal-trade-hub` recipe in `.vibesmith/recipes/spatial-composition/`; the framework's curated one is shadowed for this project. Same shape as `recipe-canon.md` § Slice 3 project override layer. |

The procgen extension inherits the entire recipe-canon
project-override mechanism — no parallel system. A
`spatial-composition` recipe is just a recipe with a
new `category`.

### Why this matters

Without algorithm-vs-data separation, every change to a generated
world is a code change: re-runs require diff'ing TypeScript,
critics don't have stable inputs to gate against, AI assistants
can't propose alternatives without rewriting code. With the
separation: the project's *creative* surface is a set of
declarative recipes the AI surface can author, swap, and
critique; the *algorithmic* surface is a small set of
well-validated generators the framework + community ship and
version cautiously.

The lesson is import-only — the framework does not name a prior
project as the source of this principle, but it doesn't have to;
the separation is independently sound and is the same
discipline `recipe-canon.md` formalises for VFX / shader content.

---

## Backends + adapter tiers

The extension ships four backend tiers matching
`capabilities-and-providers.md`'s
priority order (local → free → pay-per-use → subscription).

### Tier 1 — `local` (TS-native algorithms)

The extension ships a thin reference backend per default ladder:
one `settlement.polygonal-patch.v1` generator written in
TypeScript, runnable in-process, with no external dependencies.
This proves the contract end-to-end and is the canonical example
generator new contributors port from. **Only one reference
generator ships in the framework**; everything else is content.

### Tier 2 — `json-ingest` (vendor-adapter)

The `json-ingest` backend is the same vendor-adapter pattern
[`asset-packs.md`](asset-packs.md) uses for third-party asset
packs: a generator that reads its output from a structured JSON
file produced by an external tool and adapts it into the
substrate's `SiteContract` shape. This is the integration path
for the Procgen-Arcana-lineage tools: the user exports JSON from
the external tool, the adapter ingests it, the substrate routes
it like any other generator's output. The adapter pattern is
generic; specific vendor adapters are content.

### Tier 3 — `headless-js` (escape hatch)

For external generators that ship as bundled `.js` (the most
common shape for in-browser procgen-tool output), the
`headless-js` backend runs the bundle in Node + jsdom and
captures its output. This is an escape hatch — slower, more
fragile, but means a consumer can integrate an external
generator that *doesn't* publish a stable JSON export by
scraping its browser output. Used sparingly; documented as a
last resort.

### Tier 4 — `llm-recipe` (AI-authored recipe + critic gallery)

The most ambitious tier: an LLM authors a `Spec` recipe from a
natural-language prompt, the substrate generates an N-seed
gallery (4 or 9 candidates) with the chosen backend, a critic
ensemble (geo-consistency + seam-validity + asset-feasibility)
scores each candidate, and the dev-shell presents the gallery
for the user to ratify. The user picks one; the chosen
candidate's spec promotes to project canon. AI authors the spec,
not the geometry; the geometry comes from a Tier-1/2/3 backend
the spec selects.

### Adapter contract sketch

```ts
type SpatialBackend = {
  kind: 'local' | 'json-ingest' | 'headless-js' | 'llm-recipe'
  invoke(spec: Spec, ctx: GeneratorContext): Promise<GeneratorOutput>
  // optional: declares non-default refine-verb support
  refineVerbs?: RefineVerb[]
}
```

The four tiers share one invocation surface; the choice between
them is per-spec (a spec's `backend` field names the tier and the
specific adapter inside that tier).

---

## Refine loop

The refine loop is the substrate's **user-visible value
proposition**: select a node in the dev-shell, click one of its
declared refine verbs, see the subtree update.

### Loop shape

1. **Selection.** User clicks a node in the Procgen workspace's
   map view or in the scale-ladder breadcrumb.
2. **Verb pick.** The dev-shell shows exactly the
   `refineVerbs` the selected node's generator declared. The
   verbs disabled at this node are visibly disabled (greyed,
   tooltip explains).
3. **Action.** User clicks `grow` / `infill` / `inflect` /
   `rebake`. For `inflect`, a small parameter-vector picker
   appears with sliders drawn from the spec's declared ranges.
4. **Dispatch.** The substrate computes the *dirty subtree* (the
   selected node + everything below it in scales the user's verb
   affects) and re-runs only that subtree's generators in
   dependency order.
5. **Critic gate.** Each new node passes through the critic
   ensemble (§ Critic ensemble integration). Critic verdicts
   surface in the proactive-advice-queue; *promotion to canon*
   is gated on `verdict: pass | flag` (a `fail` blocks
   promotion, leaving the new node as a `proposed_change`).
6. **Lineage update.** New nodes link to the previous nodes via
   the canon-substrate status state machine (see § Lineage and
   canon-substrate dependency below). Parents stay byte-identical.
7. **Render.** The dev-shell map view updates the affected
   subtree's render; siblings + parents are not redrawn.

### What doesn't happen

- **Parents do not regenerate.** A `rebake` of a ward does not
  re-run the settlement generator. The settlement's
  `SiteContract` is pinned at the time of the ward's previous
  bake; the new ward must fit the same contract.
- **Siblings do not regenerate.** A `rebake` of one ward does
  not touch sibling wards in the same settlement.
- **Pinned parent canon stays pinned.** Re-running a child
  generator weeks after the parent was last touched reads the
  parent canon *as-of the moment the parent was canon'd*, not
  the parent's live state. (If the user wants the child to pick
  up parent changes, they `rebake` the parent first, which
  cascades.)

### Lineage and the canon-substrate dependency

The refine loop's lineage tracking depends on a small extension
to `canon-substrate.md`: a per-node
**status state machine** with states
`draft / canon / proposed_change / expanded / modified / destroyed`
plus the fields `parent_entity_id` (predecessor node),
`superseded_by` (successor node), and `modified_reason` (free-form
string capturing which refine verb fired). This state machine is
shared with the rest of the substrate (it's useful for
asset-catalogue versioning, recipe-canon overrides, prefab
revisions). Adding it is a **separate sibling slice on
`canon-substrate.md`** that this Track
depends on; without it, the lineage chain has nowhere to live.

<!-- TODO: discuss — the canon-substrate status state machine
sibling slice needs its own Track (or an entry inside an
existing canon-substrate Track) before PG-1 slice 1 can land;
flagged here, not invented. -->

---

## Critic ensemble integration

Procgen registers **three domain critics** into the
proactive-advice-queue (Track V4 —
`proactive-advice-queue.md`).
The extension does not ship its own queue; advice flows into the
same channel as recipe-canon and asset-catalogue advice.

### `geo-consistency`

Checks whether the generated geometry is *internally consistent*:
no overlapping rooms inside a building, no road that crosses
itself, no plot whose interior is outside its declared bounds, no
heightfield with a slope > some configured threshold. Verdict
axes: `topology / scale / slope / overlap`. YAML envelope shape
matches the recipe-canon critics (see
`recipe-canon.md` § *Relationship to other
framework substrate* → `shader-critic` / `vfx-critic`).

### `seam-validity`

Checks the `SeamContract`s on a node's external edges against the
sibling nodes that share those edges. Mismatched elevation,
mismatched width, mismatched kind, or missing peer-side
`SeamContract` all flag. Verdict axes: `elevation /
width-match / kind-match / peer-present`.

### `asset-feasibility`

Checks whether the generated composition has a corresponding
asset path through the project's asset-catalogue. A
settlement-scale node declaring 12 buildings of style profile
`coastal-fortified` flags if the catalogue has no recipes
matching that style. Verdict axes: `recipe-coverage /
catalogue-coverage / style-match / budget-fit`.

### Promotion gating

Critic verdict gates the canon-substrate status transition.

- All three critics `pass` → node auto-promotes
  `proposed_change → canon`.
- One or more `flag` → node stays `proposed_change`; the dev-shell
  surfaces the flag in the inspector but the user can manually
  promote (the override is logged).
- One or more `fail` → node stays `proposed_change`; manual
  promotion still possible but the override is flagged in the
  proactive-advice-queue with higher prominence.

The same gating shape recipe-canon uses (Track A3 slices 6 / 7);
no new surface invented.

---

## Dev-shell workspace

The dev-shell gains a third top-level workspace, **Procgen**,
sibling of Scene + Canon per
`dev-shell-workspaces.md`.
The workspace contributes four panels in its default arrangement.

### `procgen-map` (centre, large)

The interactive map view. Shows the project's procgen tree at
the currently-selected zoom (`realm` extent down through whatever
scale the user has focused). Pan / zoom / click to select.
Selected node highlights; selected node's `bounds` polygon and
its `externalSeams` show as outlines. Render is generator-output-
driven (cells / polygons / room rects / tile grids), not
asset-driven; this is a *layout view*, not a scene preview.

### `procgen-breadcrumb` (top strip)

The scale-ladder breadcrumb. Shows `realm > region > settlement >
ward` etc. for the selected node's path. Clicking a breadcrumb
ancestor zooms out to that scale.

### `procgen-inspector` (right side)

The selected node's inspector. Shows:

- The node's `id`, `scale`, `seed`, generator `id`, current
  `Spec` recipe ID.
- The `SiteContract` it publishes (collapsed by default; expand
  to see the `childSites` list + `externalSeams` list).
- Critic verdicts (from `geo-consistency` / `seam-validity` /
  `asset-feasibility`).
- The lineage chain (link to `parent_entity_id`, list of
  `superseded_by` chains).
- Refine handles — one button per declared refine verb.

### `procgen-spec-picker` (right side, below inspector)

The spec picker. Shows the available `spatial-composition`
recipes that apply at the selected node's scale; clicking one
**swaps the spec without rebaking** (parameters change; seed
unchanged). The same panel surfaces "search recipes by
intent" — free-text against the recipe-canon retrieval surface
(`findRecipes({ category: 'spatial-composition', scale, intent })`).

### cmd+P quick actions

Four actions register with `quick-action-palette.md`:

| Action ID | Behaviour |
|---|---|
| `procgen.generate-from-prompt` | LLM authors a new `Spec` recipe from a natural-language prompt; substrate generates an N-seed gallery; user ratifies one. (Tier-4 `llm-recipe` backend.) |
| `procgen.refine-at-cursor` | LLM proposes a refine verb + parameter vector for the currently-selected node based on a prompt; substrate runs the verb; user accepts or rejects the diff. |
| `procgen.swap-spec` | LLM ranks `spatial-composition` recipes against a user prompt; user picks one; the spec swaps without rebaking. |
| `procgen.explain-this` | LLM explains the selected node's spec + generator + lineage in natural language. Read-only. |

All four route through `assembleBundle` for context per
the task-context contract;
the LLM calls go through the Tier-1 router per
[`mcp-tiered-surface.md`](mcp-tiered-surface.md).

---

## Snapshot integration

Procgen output is canon. Snapshots interact with that canon at
two well-defined points.

### Capture: `canon-snapshot-at-bake`

When a generator bakes a node, the snapshot system captures a
*pinned reference* to the parent canon at the moment of the
bake — not the parent canon's bytes, but a `(parent_node_id,
parent_version)` tuple. This is the `canon-snapshot-at-bake`
field on the new node.

### Replay: re-running a level reads pinned parent canon

Re-running a level (typically via `rebake` weeks after the
parent last changed) reads the pinned `(parent_node_id,
parent_version)` and resolves it through canon-substrate's
versioned lookup. The new node uses the *same parent context*
it would have used at the original bake — the generator is
deterministic against `(seed, parent_canon)`, and both are
pinned.

If the user wants the new node to see the parent's live state,
they `rebake` the parent first; the cascade re-pins. There is
**one canonical way to pick up parent changes** — rebake the
parent — and the substrate does not negotiate.

### Per-domain detail

- **`generate-from-prompt`** and other LLM-authored runs write
  the LLM's reasoning trace into the snapshot's provenance
  block per the
  scenario-driven-dev substrate;
  this is the cross-modal coherence the canon-substrate § *Cross-
  modal coherence* section names as the substrate's job.
- **Headless replay** of a procgen snapshot is the same shape
  as headless replay of any other snapshot; the substrate does
  not add a new replay surface.

---

## Cross-cutting

| Doc | Relationship |
|---|---|
| `canon-substrate.md` | Procgen output is canon; depends on the (separate-slice) status state machine extension |
| `recipe-canon.md` | `Spec`s are recipe-canon entries under a new `spatial-composition` category; reuses retrieval + project-override layers |
| `capabilities-and-providers.md` | Backend tier ladder mirrors the capability priority order (local → free → pay-per-use → subscription) |
| [`director-pattern.md`](director-pattern.md) | Refine loop's accept / reject / persist shape matches the director apply pipeline; LLM-authored spec generation is a director intervention |
| [`scene-construction.md`](scene-construction.md) | Renderers consume generator output at the scene-construction boundary; no procgen API leaks into render code |
| `quick-action-palette.md` | Four cmd+P actions register through this contract |
| `proactive-advice-queue.md` | Three domain critics register here; no separate queue |
| scenario-driven-dev | `canon-snapshot-at-bake` field per node; deterministic replay across rebake cycles |
| `dev-shell-workspaces.md` | "Procgen" workspace sibling of Scene + Canon |
| [`asset-packs.md`](asset-packs.md) | Vendor-adapter pattern reused for the `json-ingest` backend |
| [`kit-assembly.md`](kit-assembly.md) | Track PG-2 — extends `SiteContract` with typed `SlotContract` slots so an LLM-driven assembly director can dress procgen artifacts into prefab instances using validated modular kits |

---

## Open forks

Four design choices held open until first-implementation evidence
forces them.

### Fork 1 — TS-as-data vs. graph spec language

**Question.** Should `Spec` recipes be authored as TypeScript
factory functions (mirroring the `.recipe.ts` pattern in
`recipe-canon.md` § Slice 4) or as graph JSON
(mirroring the `.tsl.graph.json` pattern in
`tsl-shader-pipeline.md`)?

**Options.**

- **A.** TS-as-data, mirroring recipe-canon. Authors write
  `.recipe.ts` files; the loader registers them. Most idiomatic
  for the existing recipe-canon machinery.
- **B.** Graph JSON, mirroring TSL. Authors compose a graph of
  nodes (Voronoi-cells → road-graph → patch-classifier → ...)
  through a visual graph editor. Better for non-TS authors;
  worse for AI authoring (LLMs author TS more reliably than
  JSON graphs).
- **C.** Both — TS as the canonical authoring shape, JSON as
  the AI-output shape, with a roundtrip.

**Recommendation.** **A** for v1, deferring B until a graph
editor exists. Reuses the recipe-canon loader directly. JSON
shape can be added later without breaking TS authors.

**What's blocking the lock.** A first-implementation slice
(`pg-1:1` or `pg-1:2`) that exercises the recipe-canon loader
against a `spatial-composition` recipe — once that lands, this
fork closes.

### Fork 2 — RNG choice

**Question.** Is Park-Miller LCG the right v1 default, or should
the substrate ship `xoshiro256**` (better statistical properties
at the cost of more state)?

**Options.**

- **A.** Park-Miller. Simple, well-understood, single-`number`
  state, trivial cross-language port.
- **B.** Xoshiro256**. Better statistical properties; needs
  four `number`s of state (or `bigint` in JS).
- **C.** Pluggable, with Park-Miller as the default; consumers
  swap via `[procgen].rng`.

**Recommendation.** **C**. Ship Park-Miller as default, expose
the `derive` shape so swap is one config line.

**What's blocking the lock.** Any evidence that the LCG's
statistical properties bite a real consumer at the scale-tree
depth we ship. Until then, default-Park-Miller-with-swap holds.

### Fork 3 — Terrain authority API

**Question.** When a `region`-scale generator owns terrain and a
`settlement`-scale generator inside it wants to *modify* terrain
locally (a dock dug into a hillside; a tunnel under a ridge), how
does the substrate express that without giving the child write
access to the parent's heightfield?

**Options.**

- **A.** Terrain is immutable inheritance. Child generators read;
  they never write. Local terrain modifications must be expressed
  as *render-time geometry* (the dock is a mesh sitting on top of
  the inherited terrain), not as canon-time terrain edits.
- **B.** Two-layer terrain. Parent publishes a `baseHeightfield`;
  children may publish a `delta` layer; the renderer composes
  base + delta. The parent's canon is never mutated.
- **C.** Full mutation with version-bump. Child publishes a
  modified-region heightfield, the parent's canon version-bumps
  to record the child's edit, cascade rebakes flag.

**Recommendation.** **B** — two-layer terrain, deltas only —
because it preserves the "parents are never disturbed by
children" rule while allowing the common case (a dock, a
tunnel). C couples the cascade rebake to terrain edits; A is too
restrictive.

**What's blocking the lock.** First concrete consumer need for
local terrain modification. Holding **B** as the working
default; if no consumer needs it before PG-1 slice 5, we may
ship **A** and add **B** only when a real need surfaces.

### Fork 4 — Critic registration mechanism

**Question.** Do the three procgen critics
(`geo-consistency`, `seam-validity`, `asset-feasibility`) register
through the same `subagent-roster.md` pattern the recipe-canon
critics use (shipped as `.claude/agents/<name>.md` + a `scripts/`
invoker), or do they register as in-process
TS functions called directly by the refine loop?

**Options.**

- **A.** Subagent pattern (matches `shader-critic` /
  `vfx-critic`). Critics run as Claude Code subagents; verdicts
  are YAML envelopes. Slower per call but composable with the
  rest of the agent fleet.
- **B.** In-process TS. Critics run synchronously inside the
  refine loop. Fast, deterministic, but harder to compose with
  AI workflows that want to invoke the same critics ad-hoc.
- **C.** Both — the same critic logic ships as both a TS function
  the substrate calls and a subagent the AI surface calls.

**Recommendation.** **C** in the long run, **B** for v1. The
critic logic is small enough that duplicating it in two
invocation shapes is not a tax worth fighting; the in-process
shape is what the refine loop needs and the subagent shape is
what cmd+P actions and the proactive-advice-queue want.

**What's blocking the lock.** First slice that exercises a
critic from a refine loop (in-process) *and* from a cmd+P
action (subagent). Until both exist, hold the recommendation as
working hypothesis.

---

## Status

🔵 **specced — no code yet.** Build phases tracked under Track
PG-1 (substrate + first reference generator + JSON-ingest
adapter + dev-shell workspace + LLM-recipe + critic ensemble).
See `docs/roadmap/tracks/pg-1.toml` for the slice plan and
the framework roadmap Tier 2 for the prioritisation.

---

## Cross-references

- `canon-substrate.md` — the substrate
  this extension is the third instance of; status state machine
  extension is a load-bearing dependency.
- `capabilities-and-providers.md`
  — the capability + provider ladder this extension's backends
  match.
- `recipe-canon.md` — `Spec`s live as
  `spatial-composition` recipes; reuses retrieval + project-
  override layers.
- [`asset-catalogue.md`](asset-catalogue.md) — first capability
  extension; same data-vs-code separation, same dev-shell-
  extension shape.
- [`asset-packs.md`](asset-packs.md) — vendor-adapter pattern
  the `json-ingest` backend mirrors.
- [`kit-assembly.md`](kit-assembly.md) — Track PG-2; bridges
  PG-1 artifacts (extended with `SlotContract`) and validated
  modular kits into assembled prefab instances via an
  LLM-driven assembly director.
- [`director-pattern.md`](director-pattern.md) —
  apply-pipeline shape the refine loop mirrors at canon scale.
- [`scene-construction.md`](scene-construction.md)
  — downstream consumer of generator output.
- `quick-action-palette.md`
  — cmd+P actions register here.
- `proactive-advice-queue.md`
  — critic verdicts flow into the same queue as recipe-canon /
  asset-catalogue advice.
- scenario-driven-dev
  — `canon-snapshot-at-bake` field; deterministic replay.
- `dev-shell-workspaces.md`
  — new "Procgen" workspace.
- The framework roadmap — Track PG-1 prioritisation
  (Tier 2 row 16).
- ADR-0007 (procgen as capability extension)
  — the ADR that locks the extension-vs-runtime-package
  question.
