---
title: 'Director pattern — AI-assisted content surfaces'
description: 'A *director surface* is an in-browser tool for inspecting, editing, and AI-regenerating a specific kind of content. Build one scaffold; reuse across content...'
---

A *director surface* is an in-browser tool for inspecting, editing, and
AI-regenerating a specific kind of content. Build one scaffold; reuse
across content types. Scene construction is the first instance; threads,
voice cards, dialogue corpora, lore, the canon graph are next.

This is the concrete shape of "methodology-is-product": an authoring
environment custom-built for an AI-augmented MMO pipeline, made out of
composable pieces tailored to the game we're actually building.

---

## What a director surface is

> **UI conventions** for any director surface (and all other dev /
> authoring surfaces in the project) follow [`dev-tooling-ui.md`](dev-tooling-ui.md):
> three-panel layout (hierarchy + viewport + inspector), Blender-style
> camera, Unity-style transform hotkeys, scrubbable numeric inputs,
> command palette via `Cmd-P`. Familiarity over invention.

Every director surface, regardless of content type, has the same six parts:

1. **Browser** — list / grid / graph view of all entities of this type.
   Filter, search, sort, click-through.
2. **Inspector** — focused view of one entity. Shows the data, its
   provenance, related entities, and (for content that renders to 3D)
   a live preview.
3. **Editor controls** — leva-bound knobs for the entity's schema
   fields; live-updates as you tweak.
4. **Selection model** — a typed selection state: which entities,
   which sub-fields, optional region / screenshot, current focus.
5. **Director input** — feedback textarea + intervention-level dropdown
   + submit. Hands selection + feedback to a content-type-specific
   subagent.
6. **Apply pipeline** — validate → in-memory apply → static checks →
   Theme Critic gate → diff preview → accept/reject → persist + log.

The content type plugs into the framework by providing:

- A Zod schema for the entity
- A list-view component (browser)
- A detail-view component (inspector)
- A list of intervention levels appropriate to the type
- A subagent definition (`.claude/agents/<type>-director.md`)
- Type-specific static checks (Tier 0 validators)
- Optional: a renderer (for content with visual output)
- Optional: a generator (for content authored from a recipe)

Everything else — selection state machine, leva bindings, JSON-patch
application, diff preview UI, Claude Code task IO, provenance log,
Theme Critic invocation, undo stack — is **shared framework code**.

---

## Instances we'll want

Rough catalogue. Each is a real authoring tool tailored to the MMO
methodology; together they are the IDE.

| Instance | What it directs | Selection modes | Intervention levels |
|---|---|---|---|
| **Scene director** (first, see `scene-construction.md`) | Recipes → compositions → 3D world | Entity / multi / region / rect / recipe-field / whole | composition-patch · recipe-patch+regen · seed-reroll · generator-suggestion |
| **Thread director** | Threads (quests): anchors, beats, hooks, resolution states, beat-dialogue lines | Beat / branch / anchor NPC / whole thread | line-rewrite · beat-restructure · branch-add · thread-regenerate · schema-suggestion |
| **Voice card director** | NPC voice cards: register tags, vocabulary, quirks, example lines | Field / example-line / whole card | line-rewrite · example-regenerate · field-tighten · card-regenerate |
| **Dialogue corpus director** | Per-NPC corpora of (slot, line) entries with theme-approval | Slot / entry / whole corpus | line-rewrite · slot-expand (generate more variants) · slot-cull · corpus-rebuild |
| **Lore director** | Canon-graph nodes: world rules, history, factions, places, items | Node / edge / cluster | property-edit · relationship-add · node-merge · rule-promote |
| **Asset director** | Asset manifest entries: tonal flags, geometric class, tags, thumbnails | Asset / tag / unflagged-set | re-tag · re-evaluate-tonality · thumbnail-regenerate · tag-vocabulary-suggest |
| **Constitution director** | Constitution patches: world rules with provenance back to the pattern that warranted promotion | Rule / cluster | rule-add · rule-refine · rule-deprecate · cross-rule-conflict-check |
| **Theme critic** (already exists in MyProject) | Validates content against constitution; no editing surface, but plugs into every other director as a gate | n/a | n/a |

Theme Critic is the cross-cutting checker that every director consults
on its way through the apply pipeline. Some directors (e.g. lore,
constitution) also feed *into* it.

---

## Shared framework primitives

These get built once in `packages/director-framework/` (or wherever the
extracted framework lives). Per-content-type instances import them.

### Selection state

```ts
type Selection<T extends string = string> = {
  type: T;                              // 'scene', 'thread', 'voice-card', etc.
  entities: string[];                   // entity ids in scope
  fields?: string[];                    // JSON pointer paths to specific fields
  region?: { bbox?: Bbox; rect?: Rect; screenshot?: Blob };
  focus?: string;                       // single entity to feature
};
```

One state shape works across all directors. Per-type extensions go in
`fields` / `region` / type-specific selection.

### Intervention envelope

```ts
type InterventionRequest = {
  surface: string;                      // 'scene' | 'thread' | ...
  selection: Selection;
  feedback: string;                     // user's prose
  mode: 'auto' | InterventionKind;
  context: {
    schema: string;                     // type id
    entitySlice: unknown;               // the relevant slice of the data
    relatedEntities?: unknown;
    history?: Intervention[];           // prior interventions this session
    constitution?: string;              // applicable constitution rules
  };
};

type InterventionResponse =
  | { kind: 'patch'; target: 'recipe' | 'composition' | 'entity'; ops: JsonPatch }
  | { kind: 'regenerate'; target: string; seed: number }
  | { kind: 'suggest-code'; file: string; diff: string }
  | { kind: 'clarify'; question: string };
```

Every director-subagent returns one of these. The framework knows how
to validate and apply each kind for any surface type.

### Apply pipeline

```
Validate (Zod, ref integrity)
  → Apply in memory
  → Static checks (Tier 0, surface-specific)
  → Theme Critic gate (configurable)
  → Diff preview UI (also generic; renders any two JSON blobs side-by-side
    + an optional surface-specific visual preview)
  → Accept / Reject / Tweak-and-retry
  → On accept: persist + provenance log
```

All shared. Per-surface plug-in points: Tier 0 validators registry,
visual preview component for diff view.

### Claude Code task IO (v0)

```ts
// Framework-side, surface-agnostic
function dispatchDirectorTask(req: InterventionRequest): Promise<InterventionResponse> {
  const id = ulid();
  fs.writeFileSync(`tmp/director-tasks/${id}.json`, JSON.stringify(req));
  return waitForResult(`tmp/director-results/${id}.json`);
}
```

Dev server watches the dirs; Claude Code session (with the
`<surface>-director` subagent) picks up tasks, runs them, writes
results. Same plumbing across every director.

### Provenance log

```jsonl
{"ts":"...","surface":"scene","selection":{...},"feedback":"...","response":{...},"applied":true,"compositionBefore":"path","compositionAfter":"path"}
{"ts":"...","surface":"thread","selection":{...},"feedback":"...","response":{...},"applied":false}
```

One log file across all surfaces, replayable, audit-trail for "why did
this content change?" debugging. Path: `packages/content/data/director-log.jsonl`.

### Undo / history

JSON patches are invertible. Framework maintains a stack of accepted
interventions per surface; `Cmd-Z` reverts the most recent.

### Hotkeys

Framework owns `d` (director), `i` (inspector), `~` (debug camera in
3D surfaces), `b` (browser back to list), `g` (variant grid).
Per-surface keys layered on top.

---

## Per-surface implementation cost

Once the framework is in place:

| Piece | Lines (estimate) |
|---|---|
| Zod schema | 20-100 |
| Browser component | 100-200 |
| Inspector + editor component | 200-400 |
| Tier 0 validators | 100-300 |
| Renderer (if visual) | 200-500 |
| Generator (if procedural) | 300-1000 (content-type specific) |
| Subagent definition | 50-200 (a Markdown file) |

So **a new director surface = ~1-2k lines + one subagent prompt**, on
top of a ~2-3k-line shared framework. Many surfaces, low marginal cost.

---

## Order of build-out

1. **Director framework** primitives (selection, envelope, apply
   pipeline, Claude Code task IO, provenance log, diff preview) — built
   while implementing the scene director, generalized after it works.
2. **Scene director** — first instance; pays back the framework cost.
3. **Thread director** — second instance; tests the abstraction. If the
   framework had to bend, this is where we find out.
4. **Voice card** + **Dialogue corpus** directors — port directly from
   MyProject's writer + theme-critic loop. These are the smallest
   directors (text-only, no rendering).
5. **Asset director** — replaces MyProject's asset thumbnail + tonal
   inspection workflow.
6. **Lore / canon graph director** — when the canon graph stack is
   re-stood-up post-migration.
7. **Constitution director** — last, because it depends on having enough
   content for patterns to emerge and warrant rule promotion.

The framework is paid off by surface #2. By surface #4, it dominates
custom-tool ROI in the codebase.

---

## Relationship to framework-as-product

The director framework is the most reusable thing in this whole stack.
Any AI-augmented content pipeline (game or not) could use it. It is the
canonical example of why framework is a product:

- Game-agnostic (any typed content schema works)
- Engine-agnostic (the framework is React + JSON; renderer plug-ins are
  per-surface)
- Methodology-defining (this is what "AI-driven generation with human
  judgement gates" looks like as a tool)

When framework extraction happens (see `STATUS.md`), this is the
flagship piece that moves.

---

## What this is not

- **Not runtime AI.** All director work is design-time. Baked output
  ships static. The runtime game has no LLM.
- **Not a replacement for code.** Generator suggestions return as diffs
  for human review. The director can change *content*; only humans
  (with Claude Code as an editor) change *code*.
- **Not an editor for everyone.** Director surfaces are dev-mode only.
  Players never see them. The shipped game is a normal game.
- **Not a single monolith.** Each surface is independently mountable;
  pick which ones to build per milestone. The framework is the
  invariant.
