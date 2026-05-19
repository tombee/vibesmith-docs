---
title: 'Asset catalogue — searchable 3D asset library for AI agents'
description: 'First capability extension instance. SQLite-shaped store + ingest pipeline (scan → render → classify → embed → query). Stages dispatch through the capability layer; the query layer gives agents `find` / `similar_to` / `pairs` / `gaps` / `dedup` over the project library.'
---

> **Framework. Game-agnostic.** The asset catalogue is the first
> instance of vibesmith's capability-extension pattern. It turns
> a project's 3D asset library into a queryable substrate every AI
> surface — cmd+P quick actions, the chat panel, MCP-driven external
> assistants — can reason about. Search semantically, find what pairs
> with what, identify gaps before generating new content, deduplicate
> against what already exists.

## What it is

A consumer-facing capability extension shipping at
`@vibesmith/asset-catalogue`. It owns:

- **A SQLite-shaped store** for asset metadata. In-memory + JSON-file
  reference implementations ship with the framework; a SQLite-vec
  adapter is a pluggable third implementation of the same
  `CatalogueStore` interface.
- **A multi-stage ingest pipeline.** Each stage reads from the store,
  produces outputs, writes them back. Stages skip work when their
  `inputsHash` is unchanged.
  1. **Ingest** — walk source paths, hash file bytes, extract
     structural metadata via per-format `IngestImporter`s
     (GLB / FBX / OBJ / USDZ / Blend).
  2. **Render** — dispatch each asset through the `render.turntable`
     capability (typically Blender locally) for the turntable frames
     the VLM classifier sees.
  3. **Classify** — dispatch the montage through `image.classify`
     against the project's taxonomy; persist a structured
     `Classification` (category + tags + use-contexts +
     pairs-well-with + scale hint).
  4. **Embed** — generate description embeddings via `text.embed`.
     Visual + combined kinds reserved on the schema for follow-up
     adapters.
- **A query layer** — the canonical surface every consumer +
  external agent uses to ask the catalogue questions:
  `find(query, embedQuery)` (semantic + structured),
  `similar_to(assetId, k, kind)`, `pairs(assetId)`,
  `gaps(targetCount, includeCategories?)`,
  `dedup(assetId, threshold)`.
- **An R3F consumer API** — `<PackAsset assetId={...} />`,
  `<CatalogueProvider>`, `useCatalogueQuery(filters?)`,
  `useCatalogueSemanticQuery({ text, embedQuery })`.
- **A dev-shell panel** at `/dev/catalogue` for browsing + filtering.

## Why agents care

Without the catalogue, an AI agent asked to "build a tavern scene"
has to either generate everything from scratch (wasteful, off-style,
duplicates what already exists) or trust the human to pull the right
files manually (defeats the point of agentic workflows). With the
catalogue:

```
User: "Build me a tavern scene."
Agent: queries catalogue → identifies category coverage (has
chairs/tables/mugs, lacks fireplace/kegs/hanging signs) → for each
gap, constructs a style-matched prompt from neighbouring assets'
descriptors → generates only what's missing → validates → ingests.
```

The catalogue's `gaps()` and `pairs()` queries are what make this
more than random generation — the agent generates *what's needed
and missing*, in a style consistent with what's already there.

## Setup

The wizard's `Seed from pack` step is the easiest path:

```sh
vibesmith init my-project
# … wizard prompts …
# Seed catalogue from an asset pack? path|pack-id or blank to skip:
# /path/to/vendor-pack|fantasy-kit
```

This scaffolds `.vibesmith/asset-catalogue/config.toml` pointing at
the pack and auto-enables the `asset-catalogue` standard extension.
Without the wizard:

```sh
vibesmith add-extension asset-catalogue
# then create .vibesmith/asset-catalogue/config.toml manually.
```

After setup, populate the store:

```sh
vibesmith catalogue run            # all stages
vibesmith catalogue run classify   # just one
```

Stages require capability providers to be registered (Blender for
`render.turntable`, an LLM aggregator key for `image.classify` and
`text.embed`). See [Capabilities and providers](/reference/asset-packs/)
for the routing model.

## R3F surface

Publish a catalogue handle once at startup, then mount the provider:

```tsx
import { JsonFileCatalogueStore, createCatalogueHandle } from '@vibesmith/asset-catalogue';
import { CatalogueProvider, PackAsset } from '@vibesmith/asset-catalogue/r3f';
import { registerCatalogueHandle } from '@vibesmith/standard-extensions';

const store = await JsonFileCatalogueStore.open({
  path: '.vibesmith/asset-catalogue/catalogue.json',
});
const handle = createCatalogueHandle(store, {
  resolveSource: (record) => `/assets/${record.id}.glb`,
});
registerCatalogueHandle(handle);  // wires up the /dev/catalogue panel

function World() {
  return (
    <CatalogueProvider handle={handle}>
      <PackAsset assetId={someAssetId} position={[0, 0, 0]} />
    </CatalogueProvider>
  );
}
```

For browser-only previews (Storybook, scenario probes) skip the
file-backed store and feed an in-memory snapshot:

```ts
import { createHandleFromSnapshot } from '@vibesmith/asset-catalogue';

const handle = createHandleFromSnapshot(snapshot, { resolveSource });
```

## Query API examples

```ts
// Semantic search.
const hits = await handle.query.find(
  { text: 'medieval dockside prop', k: 20 },
  (text) => embedViaProvider(text),
);

// Find neighbours by visual similarity.
const similar = handle.query.similarTo(crateAssetId, 8);

// Identify gaps before generating.
const report = handle.query.gaps(10);
report.missingCategories.forEach(category => {
  console.log(`no assets in '${category}'`);
});

// Deduplicate a candidate against what exists.
const dupes = handle.query.dedup(candidateAssetId, 0.05);
if (dupes.length > 0) {
  console.log(`candidate is too close to existing ${dupes[0].asset.displayName}`);
}

// Pairs walk for scene composition.
const fitsAlongside = handle.query.pairs(tableAssetId);
```

## Storage shape

Tables (per `CatalogueSnapshot`):

- `assets` — content-hash id + structural metadata + multi-source-path
  attribution (the same asset content at multiple paths is one row).
- `renders` — turntable frames + ortho views + montage references.
- `classifications` — taxonomy-constrained category + tags +
  use-contexts + pairs-well-with + scale hint; `inputsHash` lets
  re-runs skip work.
- `embeddings` — one row per `(assetId, kind)`; kinds are
  `description` / `visual` / `combined`.
- `taxonomies` — versioned vocabulary the classifier prompts against.
- `palettes` — per-asset palette extraction.
- `generationRuns` — Phase 2 generation pipeline state.

Every adapter implements the same `CatalogueStore` interface, so a
SQLite-vec adapter can replace the JSON-file store without touching
any consumer code.

## What's deferred

- **Phase 2 generation pipeline** (2D LoRA → image-to-3D → cleanup →
  repalette → normalise → validate) is the natural follow-up. The
  `generation_runs` schema is already in place so when the pipeline
  lands, no migration is needed.
- **MCP-server `catalogue.*` tools** — the query layer is a typed JS
  surface; wrapping it as MCP tools for external agents lands
  alongside the next Tier-1 router budget rebalance.
- **GLB / FBX importer implementations** — the substrate ships the
  `IngestImporter` contract + a default file walker; concrete parsers
  ride on `@vibesmith/asset-pipeline`'s parsing knowledge in a
  follow-up.

## Cross-references

- [Asset packs](/reference/asset-packs/) — vendor packs are the
  catalogue's primary bulk-ingestion shape.
- [Performance budgets](/reference/performance-budgets/) — the
  catalogue's polycount metadata feeds the per-tier budget checks.
- [Scenario-driven dev](/reference/scenario-driven-dev/) — scenarios
  reference catalogue assets by id, so a scene captured today
  re-resolves cleanly months later.
