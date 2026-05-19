---
title: 'Asset packs — third-party bundles as canon-substrate seeds'
description: '> **Framework. Game-agnostic.** How the framework consumes prebuilt third-party asset packs (bulk-arriving collections from commercial vendors) and lights them up as first-class canon-substrate contributions....'
---

> **Framework. Game-agnostic.** How the framework consumes
> prebuilt third-party asset packs (bulk-arriving collections from
> commercial vendors: low-poly stylised kits, kit-bash packs,
> character packs) and lights them up as first-class
> canon-substrate contributions. Sits between
> [`asset-catalogue.md`](asset-catalogue.md) (the generic ingest →
> render → classify → embed → query pipeline), the
> [`capabilities-and-providers.md`](capabilities-and-providers.md)
> layer (the AI services that classify, embed, and later generate),
> and [`material-system.md`](material-system.md) (the role
> abstraction packs feed into).
>
> The end state: drop a vendor pack into the project, the framework
> ingests it, derives a style profile, classifies + embeds every
> asset, makes them queryable via R3F + MCP, and lets the AI
> generate new in-style assets on demand when something the project
> needs isn't in the pack.

## Reference workflow target — Synty-style modular kits

Synty's POLYGON 3D packs and INTERFACE/UI packs are the
**canonical reference workflow target** for this doc. Their
shape — modular kits, palette/atlas-driven, low-poly, hundreds
to thousands of meshes sharing a single palette texture,
consistent naming conventions, GLB/FBX for 3D and PNG sprites
for UI — is what every part of the asset-packs pipeline is built
to handle cleanly. The packs are designed for Unity and Unreal
but the underlying assets are pipeline-agnostic, and Synty-
compatible art is an explicit first-class supported workflow:
GLTF / GLB ingest is first-class, the classifier handles
palette / atlas conventions natively, and per-pack style
profiles derive style canon from Synty's palettes and naming.

Naming Synty here pins a concrete reference target; it does not
make Synty a load-bearing dependency. **The framework's bundled
adapter set stays vendor-neutral by name** — `generic-fbx`,
`glb-folder`, `atlas-palette-fbx`. A community or consumer-side
`synty-polygon` adapter could ship later; it just isn't bundled,
because the generic + palette-atlas adapters already cover the
shape.

## Why this gets its own doc

The asset catalogue's generic ingestion pipeline ([`asset-catalogue.md`](asset-catalogue.md))
handles one-asset-at-a-time. A vendor pack is a different shape of
input:

- **Bulk arrival.** Hundreds to thousands of assets in one drop;
  consistent vendor conventions; usually a one-time ingestion cost
  per pack.
- **Shared substrate.** A single atlas + palette texture
  referenced by most meshes; naive per-asset ingestion duplicates
  it N times. The pack is the natural deduplication unit.
- **Style attractor.** The whole pack is a coherent visual style.
  This is *exactly* what
  [`capabilities-and-providers.md`](capabilities-and-providers.md)'s
  style enrichment wants to bind to — packs are the most concrete
  source of project-level style data the framework will see.
- **Vendor idioms.** Each pack vendor has its own folder layout,
  naming convention, material setup, rig conventions, LOD scheme.
  These idioms repeat across packs from the same vendor. Pattern
  recognition pays off.
- **Licensing constraint.** Packs ship under commercial licenses
  that forbid redistribution and require attribution. The
  framework records this per-pack and propagates it to downstream
  artifacts; AI generation seeded from a pack inherits the
  provenance trail.

These concerns don't apply to the catalogue's other inputs (AI-
generated assets, hand-modelled work, ad-hoc downloads). They're
pack-specific and earn a focused design surface.

---

## What a "pack" is, exactly

A **pack** is a folder containing 3D assets + textures + metadata
that share authoring origin and visual style. The framework treats
the pack as a unit; individual assets inside inherit pack-level
properties.

Concretely, a pack:

- Lives in the project's `assets/packs/<pack-id>/` directory.
- Has a single `pack.toml` manifest at its root (written by the
  vendor adapter at ingestion time; consumer can edit).
- Contains one or more 3D asset files (FBX, GLB, OBJ, native DCC
  formats — pluggable via the catalogue's importer interface).
- May contain shared textures (atlases, palette images, normal
  maps) referenced by multiple meshes.
- May contain a documentation / license file (`README`,
  `LICENSE.txt`).

The framework's import flow normalises the pack to a canonical
internal shape; the original vendor layout stays untouched on
disk so updates from the vendor can be re-applied.

### `pack.toml` schema

Lives at `assets/packs/<pack-id>/pack.toml`. Written by the
vendor adapter; manually editable for overrides.

```toml
[pack]
# Required. Stable identifier (kebab-case). Used as catalogue
# namespace and import prefix. Cannot collide with another pack
# in the same project.
id = "low-poly-fantasy-pack"

# Required. Human-readable name shown in the catalogue UI.
name = "Low-Poly Fantasy Pack"

# Optional. Free-text vendor identity. Free-form, not validated
# against a list — vendor names are recorded for provenance but
# the framework remains vendor-agnostic.
vendor = "Vendor Studio Name"

# Optional. Pack version per the vendor's own scheme.
version = "1.7"

# Optional. ISO-8601 date the pack was added to the project.
ingested = "2026-05-17"

[license]
# Required. SPDX-style identifier where one exists, or a free-text
# tag the framework's license-policy layer recognises. The
# framework warns if this conflicts with project-level
# `[license].policy` in vibesmith.toml.
# Common values: "commercial-no-redistribute", "cc-by-4.0", "custom".
spdx = "commercial-no-redistribute"

# Optional but recommended. Human-readable license summary; the
# catalogue UI displays this verbatim near every asset from the
# pack.
summary = "Commercial use permitted in compiled games. Asset files may not be redistributed."

# Optional. Attribution string the framework appends to credits
# screens and provenance reports.
attribution = "Assets from Vendor Studio's Low-Poly Fantasy Pack"

[style]
# Optional but recommended — populated by the ingestion stage.
# The pack-derived style profile that becomes the basis for
# AI generation enrichment (per capabilities-and-providers.md §
# Style enrichment). All fields are heuristic at ingest time;
# the user can refine.
palette_atlas = "textures/palette.png"
polycount_p50 = 320
polycount_p95 = 1400
polycount_max = 4200
material_convention = "single-atlas"        # "single-atlas" | "per-asset" | "pbr"
naming_convention = "PascalCase_Snake"
up_axis = "Y"
units = "metres"

[layout]
# Optional. Folder-to-role mapping hints discovered at ingest.
# Used by the material role auto-assignment + the catalogue
# category bootstrap. Free-form; the framework only treats these
# as hints, never hard rules.
"buildings/*"   = "architecture"
"props/*"       = "prop"
"characters/*"  = "character"
"vegetation/*"  = "vegetation"
"environment/*" = "terrain"

[lods]
# Optional. LOD detection scheme used by the asset pipeline.
# "suffix" looks for _LOD0 / _LOD1 / _LOD2 suffixes;
# "subfolder" looks for an /LOD0/ /LOD1/ structure;
# "none" means single-LOD per asset.
scheme = "suffix"
suffixes = ["_LOD0", "_LOD1", "_LOD2"]
```

Every field after `[pack].id` / `name` is optional; the ingestion
flow populates as much as it can heuristically and writes back the
result.

---

## The vendor adapter

Each pack vendor has predictable idioms — folder layout, naming
convention, material setup, rig style. The framework formalises
these as **vendor adapters**. An adapter takes a raw vendor pack
on disk and writes a normalised `pack.toml` + an internal manifest
the catalogue can consume.

Adapters are **plugins**, not hardcoded vendor names:

- A `generic-fbx` adapter handles anything that's "a folder of
  FBX files with sibling textures" — the path-of-least-resistance
  default that works on most packs.
- Vendor-specific adapters override the generic when a vendor has
  enough idiomatic structure to detect: a known root-level marker
  file, a known palette-texture filename, a known folder-naming
  scheme. The framework auto-detects which adapter applies via a
  short probe on the pack's root.
- **The framework's bundled adapters are vendor-neutral by
  name**: `generic-fbx`, `glb-folder`, `unity-asset-bundle`,
  `atlas-palette-fbx`. The adapter set stays vendor-neutral so
  no single vendor becomes load-bearing, even though specific
  vendors (notably Synty — see § "Reference workflow target"
  above) are named in the docs as canonical workflow targets.
  Vendor-specific *configuration* lives in the consumer's
  project (palette-texture filenames, atlas conventions, kit
  prefixes), not in the framework's adapter code.
- Adapter plugins can live in:
  - The framework (curated set, ships with releases).
  - A community plugin (`@vibesmith-community/pack-adapter-*`,
    installed as a normal extension).
  - The consumer's project (`scripts/pack-adapters/*.ts`, picked
    up by the catalogue at boot).

### Adapter contract

```ts
import type { PackAdapter } from '@vibesmith/asset-catalogue';

export const myAdapter: PackAdapter = {
  id: 'atlas-palette-fbx',
  /** Quick probe — returns true if the adapter recognises the pack. */
  detect: async (root: string) => {
    return existsSync(join(root, 'textures/palette.png'))
      && globSync(join(root, '**/*.fbx')).length > 0;
  },
  /** Normalise the pack: derive pack.toml + write internal manifest. */
  ingest: async (root: string, ctx: IngestContext) => {
    const palette = await extractPalette(join(root, 'textures/palette.png'));
    const polycount = await scanPolycount(root);
    const naming = inferNamingConvention(root);
    // ...
    return {
      packToml: { /* derived fields */ },
      assetManifest: [/* asset-by-asset entries */],
    };
  },
};
```

The adapter's `detect()` is the discriminator the framework uses
to pick among multiple plausible adapters; the first-positive
adapter wins, with the user able to pin a specific adapter in
`pack.toml`'s `[pack].adapter` field if the default detection
chooses the wrong one.

---

## The ingestion flow, end-to-end

Builds on [`asset-catalogue.md`](asset-catalogue.md)'s generic
pipeline, with pack-specific pre- and post-stages:

```
detect-adapter → derive-pack-toml → dedupe-textures
                                  ↓
                          ingest (catalogue's generic stage)
                                  ↓
                          render (catalogue's stage)
                                  ↓
                          classify (catalogue's stage, scoped to pack taxonomy)
                                  ↓
                          embed (catalogue's stage)
                                  ↓
                          derive-style-profile → write [style] back to pack.toml
                                  ↓
                          register-pack-in-project-style
                                  ↓
                              done
```

Each pack-specific stage:

### detect-adapter

Walks `assets/packs/*/` looking for any pack that doesn't have
`pack.toml` yet. Runs each adapter's `detect()` against the pack
root; uses the first positive adapter. Writes the chosen
`adapter` field into the new `pack.toml` for reproducibility.

If no adapter matches, falls back to `generic-fbx` or `glb-folder`
based on file types present. If nothing matches at all, surfaces
a clear error in the catalogue UI with a "drop this in
`scripts/pack-adapters/` to make it work" hint.

### derive-pack-toml

The selected adapter runs its `ingest()` against the pack root.
The framework writes the result to `pack.toml` at the pack root
(not in `.vibesmith/` — the manifest belongs with the pack so it
travels with project moves and is version-controlled with the
project source).

Idempotent against re-runs: if `pack.toml` exists, only fields
the user hasn't manually edited are refreshed. User-edited fields
are detected via a `_managed: false` annotation or a side metadata
file in `.vibesmith/asset-catalogue/pack-overrides/`.

### dedupe-textures

Atlas + palette textures are the dominant memory cost in
modular-kit packs. Naive ingestion duplicates them per material;
this stage:

1. Computes content hashes of every texture in the pack.
2. Identifies which textures are shared across multiple meshes
   (the palette atlas is usually 5-50 meshes; smaller atlases
   maybe 2-10).
3. Records a single canonical entry per content hash in the
   catalogue's `texture` table, with `referenced_by` listing the
   meshes that point at it.
4. Rewrites the per-mesh GLB at asset-pipeline output time to
   reference the canonical texture by content-addressable path
   (per [`asset-storage.md`](asset-storage.md)).

This is what turns "1000-mesh pack with one 4K palette" from
"1000 × 4K texture allocations" into "1 texture, 1000 references".
The framework records the per-pack savings in the catalogue UI so
the user can see what dedup gained them.

### classify (scoped to pack taxonomy)

When the catalogue's classification stage runs against a freshly-
ingested pack, the prompt is **scoped to the pack** — categories
seen elsewhere in the pack constrain the VLM's vocabulary for
new assets within that pack. This produces a coherent taxonomy
inside one pack rather than letting the classifier drift between
adjacent meshes.

Cross-pack classification reconciliation is a separate stage that
runs once all packs are ingested.

### derive-style-profile

After classification + embedding, the framework derives a per-
pack style profile by analysing:

- **Palette** — k-means cluster the dominant colours from each
  mesh's atlased region; produce a per-pack swatch (4-12 colours).
- **Polycount distribution** — p50 / p95 / max across the pack.
- **Naming convention** — infer PascalCase / snake_case / etc.
- **Material convention** — single-atlas / per-asset / PBR.
- **Up-axis + units** — read from the source files.
- **Embedding centroid** — the mean visual embedding across the
  pack; used as a similarity anchor for future generation.

The result is written to `pack.toml`'s `[style]` section and into
the catalogue's `pack_style_profiles` table for fast retrieval.

### register-pack-in-project-style

The project's overall style profile (`canon/style.toml` per
[`canon-substrate.md`](canon-substrate.md)) gains a pointer to
each pack's profile. If the project has only one pack, that
pack's profile becomes the project style by default. If multiple
packs, the project profile becomes a **blend**:

```toml
# canon/style.toml — auto-generated, user-editable
[style.composition]
mode = "blend"  # "blend" | "primary-pack" | "custom"
packs = [
  { id = "low-poly-fantasy-pack", weight = 0.7 },
  { id = "low-poly-nature-pack",  weight = 0.3 },
]

[style.overrides]
# Manual overrides override pack-derived values.
palette_atlas = "textures/project-palette.png"  # custom blended atlas
```

The blend weights influence prompt construction during AI
generation — heavier-weighted packs contribute more to the
in-style anchor.

---

## R3F consumer API

The pack's contents become directly addressable from R3F code via
the existing catalogue query path, with a thin pack-aware
convenience layer.

### Reference by pack-qualified ID

```tsx
import { PackAsset } from '@vibesmith/asset-catalogue/r3f';

function Tavern() {
  return (
    <group>
      <PackAsset id="low-poly-fantasy-pack/buildings/Tavern_01" position={[0, 0, 0]} />
      <PackAsset id="low-poly-fantasy-pack/props/Barrel_03" position={[2, 0, 1]} />
    </group>
  );
}
```

`<PackAsset id="<pack-id>/<asset-path>">` resolves through the
catalogue, hands an instanced-shareable mesh + material to R3F,
and reuses the deduped pack texture. Multiple `<PackAsset>` of
the same `id` automatically batch via `InstancedMesh` when the
framework can prove they share material + geometry.

### Query-driven composition

```tsx
import { useCatalogueQuery } from '@vibesmith/asset-catalogue/r3f';

function PropClutter({ near }: { near: Vector3 }) {
  // Returns matching assets; consumers map → PackAsset instances.
  const assets = useCatalogueQuery({
    tags: ['rustic', 'medium-size'],
    categories: ['prop'],
    packId: 'low-poly-fantasy-pack',
    k: 8,
  });
  return assets.map((a, i) => (
    <PackAsset key={a.id} id={a.id} position={near.clone().offset(...)} />
  ));
}
```

`useCatalogueQuery()` is the same query layer exposed via MCP per
[`asset-catalogue.md`](asset-catalogue.md); the React hook is a
thin wrapper.

### Filter by license at render-site

```tsx
const assets = useCatalogueQuery({
  license: ['commercial-ok'],   // exclude non-commercial-only packs
  categories: ['character'],
});
```

For projects that mix packs with different commercial-use status,
the filter prevents the wrong-license asset from making it into a
build. The framework's release build can also fail-loud when any
non-commercial-licensed asset reaches the final bundle.

---

## Generation in pack style

Once a pack is ingested, the AI generation pipeline from
[`asset-catalogue.md`](asset-catalogue.md) § Generation pipeline
becomes pack-style-conformant by default. The flow:

1. **Agent identifies a gap.** Via the catalogue's `gaps()` query
   (e.g., "tavern scene needs a hanging-sign asset; none in the
   catalogue matches").
2. **Style binding.** The generation request reads the relevant
   pack's `[style]` profile — palette, polycount range, material
   convention, embedding centroid.
3. **Prompt construction.** Anchored to the pack's style
   descriptors + neighbouring assets' captions ("a hanging sign in
   the style of: rustic wooden, hand-painted, palette: warm beige
   / brown / muted teal, polycount ~600, single-atlas texture").
4. **LoRA selection.** The framework picks the pack's trained LoRA
   if one exists (see § Pack-specific LoRAs); else trains one
   on-demand via `image.train_style_adapter` then proceeds.
5. **Generate → lift → retopo → repalette → validate.** The
   standard catalogue generation pipeline runs; the repalette
   stage targets the pack's atlas explicitly.
6. **Provenance.** The generated asset is tagged
   `generated_from_pack: <pack-id>` in the catalogue. License
   metadata is inherited *with one nuance*: the framework records
   that the generation was *style-derived* from the pack but the
   generated output is the project's own work, not the vendor's.
   The pack's license terms apply to the *style influence*, not
   the output; the framework warns if the pack's license forbids
   style derivation (rare but real).
7. **Ingest into catalogue.** Becomes a first-class catalogue
   entry with a `pack_id: null` (since it's not from the pack) +
   `style_anchor_pack_id: <pack-id>` (since it was generated in
   that style).

The flow makes the framework's value proposition concrete: the
user buys one pack, the AI fills the gaps in the same style on
demand.

### Pack-specific LoRAs

Per [`2d-asset-presets.md`](2d-asset-presets.md) and the
`image.train_style_adapter` capability, a per-pack LoRA can be
trained from the pack's render-and-caption set produced during
ingestion. The framework stores trained LoRAs at
`.vibesmith/asset-catalogue/loras/<pack-id>.safetensors` and
selects them automatically during generation when the target
style binding references that pack.

Training a pack-specific LoRA is opt-in (it's a one-time GPU
cost). The framework recommends it at pack-ingestion completion
with a clear cost estimate ("training a LoRA on this pack will
take ~30 minutes locally / ~$2 via aggregator").

---

## License + provenance flow

Per [`capabilities-and-providers.md`](capabilities-and-providers.md)
§ Provenance and licensing. The pack flow adds:

- **Pack-level license** stored in `pack.toml` `[license]`.
- **Per-asset inheritance** — every asset from a pack inherits
  the pack's license terms; the catalogue surfaces them at every
  asset's metadata view.
- **Build-time validation** — the framework's release pipeline
  enforces license-compatibility against `vibesmith.toml`'s
  project-level license policy. A `commercial-no-redistribute`
  pack triggers a warning if the user attempts to commit the raw
  asset files to a public repo (the framework hooks
  `.gitignore`-style protection by default; opt-out is explicit).
- **Attribution rollup** — `vibesmith doctor --attribution`
  emits a credits-screen-ready attribution block by aggregating
  every used pack's `[license].attribution` string.

The framework does NOT prevent the user from committing
licensed pack files; it surfaces the implication and lets the
user choose. The default behaviour is "warn, don't block".

---

## Onboarding flow — seed a project from a pack

New users who already have one or more vendor packs should be
the framework's smoothest path to a populated project. The new-
project wizard ([`new-project-wizard.md`](new-project-wizard.md))
gains an optional **"Seed from pack"** step:

1. User selects "3D project" project type.
2. Wizard offers "Start empty" or "Seed from existing pack(s)".
3. On "Seed from pack", the wizard lets the user point at one or
   more pack folders.
4. The wizard creates the project + runs pack ingestion + opens
   the catalogue UI showing the populated project.
5. The default `scenes/main.scene.json` includes one mesh from
   the largest pack (replacing the cube-and-ground default).

This is the "from zero to navigable starter project in 5 minutes
with your real assets" flow.

---

## What this is not

- **Not a pack store / marketplace.** The framework is
  vendor-neutral; it doesn't host or sell packs. Users acquire
  packs through whatever channel they prefer.
- **Not a redistribution path.** Pack files stay in the user's
  project. The framework's distribution mechanism never bundles
  vendor assets.
- **Not a vendor-specific shim.** The framework's bundled
  adapters are pattern-keyed (`atlas-palette-fbx`,
  `glb-folder`), never vendor-keyed. Specific-vendor optimisations
  live in community / consumer-side adapter plugins.
- **Not a style enforcer.** Once a pack's style profile is
  derived, the user can override any field. The framework
  surfaces the derived defaults and respects user changes.
- **Not coupled to AI generation.** The pack ingestion + R3F
  consumer flow works fully without any AI provider configured.
  Generation in pack style is the high-end use case, not the
  baseline.

---

## Risks + open questions

- **Pack updates.** When a vendor ships a pack update (renamed
  asset, refactored folder, new variant), how does the framework
  preserve the existing classifications + embeddings that point
  at the old paths? Probably content-hash-keyed reattachment +
  surface the diff to the user for review. Needs prototyping.
- **Multi-pack reconciliation.** Two packs may classify the
  same concept differently ("Barrel" vs "WoodenCask"). A
  cross-pack reconciliation stage that proposes a unified
  vocabulary needs design; in the meantime, queries can fall
  back to embedding similarity instead of exact tag matches.
- **Adapter detection collisions.** If multiple adapters detect
  positive on a pack, the framework needs a deterministic
  tie-break (registration order + user override). Probably
  fine; flagged for v2 if it becomes a real problem.
- **License-data accuracy.** Pack license terms are
  human-readable text; the framework heuristically maps them to
  SPDX-style identifiers. Misclassification could create a
  false sense of compliance. The framework will surface its
  inference + ask for confirmation on first ingest.
- **Atlas regeneration.** When the framework dedupes textures,
  some downstream-rendering scenarios may want a per-tier
  variant of the atlas (LOW gets a smaller version). The
  asset-pipeline already produces tier variants for individual
  assets — applying that to shared atlases is well-defined but
  needs the ingestion stage to flag candidates.
- **Character rigs across packs.** Skinning conventions differ
  between vendors (humanoid bone counts, axis conventions, root-
  motion placement). The framework treats character packs as a
  special case until a generic rig-retargeting capability lands;
  early support is "characters work standalone within their
  pack, animation retargeting across packs is opt-in".

---

## Implementation outline

1. **Pack manifest schema** — Zod schema for `pack.toml`,
   ingestion + validation hooks, integration with
   `@vibesmith/asset-catalogue`.
2. **Adapter plugin contract** — interface, registration, probe-
   first detection, per-pack overrides.
3. **Reference adapters** — `generic-fbx`, `glb-folder`,
   `atlas-palette-fbx` ship with the framework.
4. **Texture dedup stage** — hash, identify shared, rewrite
   manifest references.
5. **Style-profile derivation** — palette extract, polycount
   stats, naming inference, embedding centroid.
6. **Pack-aware R3F surface** — `<PackAsset>` + `useCatalogueQuery`
   hook.
7. **New-project wizard "seed from pack" step.**
8. **Per-pack LoRA training opt-in** (integrates with the
   asset-catalogue Stage 8 LoRA training already specified).
9. **License inheritance + build-time validation.**
10. **Onboarding polish** — `vibesmith doctor --packs` health
    check that surfaces missing manifest fields, dedup
    opportunities, training opt-ins.

Most of this is greenfield. The catalogue (`asset-catalogue.md`)
work is the prerequisite; pack-specific additions are
straightforward once the substrate is in place.

---

## Reassessment triggers

Revisit this doc when:

- The first pack from a different vendor is ingested and the
  generic adapters' coverage gaps become visible.
- A consumer's pack composition (e.g., five packs blended)
  exposes the multi-pack style-profile arithmetic in anger.
- Pack updates from a vendor land and the re-ingestion preservation
  story gets exercised.
- A non-3D pack type emerges (audio packs, VFX packs, animation
  libraries) — the patterns here likely generalise but the
  specifics differ enough to consider a sibling doc.
- AI generation matures enough that the "generate in pack style"
  flow ships and the licensing-of-style-derivation question gets
  a real-world test.

---

## Cross-references

- [`asset-catalogue.md`](asset-catalogue.md) — the generic
  ingestion + classification + embedding + generation pipeline
  packs ride on.
- [`capabilities-and-providers.md`](capabilities-and-providers.md)
  — the AI capability surface generation consumes; style
  enrichment pulls from the pack-derived style profile.
- [`canon-substrate.md`](canon-substrate.md) — packs are the most
  concrete instance of the canon-as-moat principle; a pack-seeded
  catalogue is the substrate every other capability extension
  reads.
- [`material-system.md`](material-system.md) — pack adapters
  contribute candidate material library entries; the role
  abstraction stays game-side.
- [`asset-pipeline.md`](asset-pipeline.md) — per-tier asset
  variants get generated from pack assets the same as any other.
- [`asset-storage.md`](asset-storage.md) — content-addressable
  identity is what makes texture dedup safe.
- [`prefab-system.md`](prefab-system.md) — prefabs reference pack
  assets by pack-qualified ID; the prefab system's recipe-shape
  doesn't change.
- [`new-project-wizard.md`](new-project-wizard.md) — "seed from
  pack" is the wizard's third flow alongside empty 3D / empty 2D.
- [`2d-asset-presets.md`](2d-asset-presets.md) — the
  `image.train_style_adapter` workflow used to train per-pack
  LoRAs ships in both surfaces.
- [`ai-assistant.md`](ai-assistant.md) — MCP tools expose
  pack-scoped queries to the user's existing assistant.
