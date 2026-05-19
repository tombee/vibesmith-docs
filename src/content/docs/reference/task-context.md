---
title: 'Task context — the contract every AI surface in vibesmith calls through'
description: 'TaskManifest schema, the v0 ~15-task core taxonomy, the context.assemble MCP surface, the TaskContextBundle wire format, and how to register your own tasks in the project namespace.'
---

> **Framework. Game-agnostic.** vibesmith does not ship its own
> chat agent. It ships a *contract* — `context.assemble(task_id,
> state_ref)` — that every AI surface (cmd+P quick actions, the
> first-party chat panel, proactive tips, external coding
> assistants over MCP) calls through. The contract owns: the task
> taxonomy, the slot manifest schema, the per-task token budget,
> and the bundle wire format every LLM adapter reshapes for its
> provider.

## What a task is

A **task** is a named, schema-declared unit of LLM work the
framework knows how to dispatch:

- **Stable ID** — `describe-asset`, `triage-bug`, etc. Optional
  dotted namespace prefix for extension- and consumer-shipped
  tasks (`game.draft-card-text`).
- **Manifest** — required + optional slot references, a declared
  token budget, a minimum LLM-adapter capability profile, and a
  brief one-line description.
- **Materialised per-call** via `context.assemble(task_id,
  state_ref)`. Each invocation gets a ULID-shaped `tsk_…`
  invocation id; the bundle the call returns is what every LLM
  adapter consumes.

Tasks borrow the *issue/ticket shape* familiar from Linear and
GitHub Issues but are framework-native: they describe *AI-call
shapes*, not the project-management state of work humans are
doing.

## v0 core taxonomy

The framework ships a curated v0 taxonomy. Each task declares a
hard token budget and the minimum LLM-adapter capability it
requires.

| Task | Brief | Budget |
|---|---|---|
| `describe-asset` | One-paragraph natural-language description of a selected asset | 4k |
| `caption-asset` | Short, naming-convention-aware caption for grids and lists | 3k |
| `suggest-recipe-for-selection` | Propose a recipe from recipe-canon that fits the current selection + scene | 6k |
| `draft-scenario` | Draft a new scenario from a selection / event / bug | 6k |
| `find-provider` | Recommend an LLM / 2D / 3D / audio provider for a workload class | 4k |
| `repair-perf-regression` | Diagnose a perf-budget violation and propose a patch | 8k |
| `synthesize-advice` | Synthesise a proactive tip from a background candidate | 2k |
| `explain-canon-drift` | Explain why a canon ref is dangling and what the user can do | 4k |
| `propose-prefab-part` | Fill a missing prefab-manifest slot with an AI-generated part | 6k |
| `repaint-asset` | Recolour / restyle an asset against a target palette | 4k |
| `name-this` | Suggest names for a selection following project naming conventions | 2k |
| `summarize-scene` | One-paragraph summary of the current scene state | 4k |
| `triage-bug` | Read a bug report + repro scenario, propose root-cause hypotheses | 12k |
| `lookup-pattern` | Generic Q&A over canon + knowledge packs + docs | 8k |
| `outline-acceptance-criteria` | Draft acceptance criteria for a feature brief | 4k |

Extension- and consumer-contributed tasks ship in their own
namespace (`asset-catalogue.describe-asset`,
`game.draft-card-text`) to keep the core set small + stable.

## The `context.*` MCP tools

Any MCP-speaking assistant — Claude Code, Codex CLI, Copilot,
your own Python orchestrator — reaches the contract through
three Tier-1 router tools:

```
context_list_tasks(category?)            # discover task ids + briefs
context_describe(task_id)                # full manifest + resolved slots
context_assemble(task_id, state_ref)     # materialise an invocation
```

`state_ref` is structured, not free-form:

```json
{ "kind": "selection" | "scene" | "panel" | "explicit", "payload": {...} }
```

`selection` / `scene` / `panel` defer to the dev shell's current
state. `explicit` lets external clients pass payload directly —
useful for headless tests + non-TS consumers driving the
framework over MCP.

## `TaskContextBundle` — the wire format

`context_assemble` returns a `TaskContextBundle` — the
normalised intermediate form every LLM adapter consumes. Shape:

```ts
{
  invocationId: 'tsk_01HZ...',    // ULID-shaped
  taskId: 'describe-asset',
  taskVersion: '0.1.0',
  assembledAt: '2026-05-17T19:00:00Z',
  stateRef: { kind, capturedAt, payload },
  slots: [
    {
      slotId: 'selection.asset',
      type: 'asset-ref',
      freshness: 'live' | 'cached' | 'snapshot',
      resolvedAt: '...',
      payload: {...},
      payloadTokens: 64,
      redactionApplied: 'license-restricted-bytes-only',
    },
    /* ...one entry per included slot, required first */
  ],
  knowledge: [...],               // knowledge-pack snippets
  links: [...],                   // dereferenced upstream sources
  budget: {
    declared: 4000,
    consumed: 312,
    dropped: [{ slotId, reason: 'budget-exhausted' | ... }],
  },
  output: { format: 'markdown' | 'text' | 'json', schema? },
  related: ['tsk_...'],           // related prior invocations
}
```

Each LLM adapter reshapes the bundle for its provider at the
adapter boundary — Anthropic cacheable XML, OpenAI JSON-mode,
Gemini multimodal, OpenAI-compatible markdown. Task code stays
provider-agnostic; surfaces never read individual slots to
compose their own prompt.

## Trying it from the dev shell

vibesmith ships the **Task Context Preview** standard extension
(`task-context-preview`). Enable it in `vibesmith.toml`:

```toml
[extensions]
enabled = [
  "scene-inspector",
  "performance",
  "task-context-preview",
]
```

The extension adds four cmd+P entries:

- **Task: summarize-scene (preview)** — dispatches against the
  current scene
- **Task: describe-asset (preview)** — dispatches against the
  current selection
- **Task: lookup-pattern (preview)** — dispatches against the
  active panel
- **Task: triage-bug (preview)** — dispatches a fixture
  bug-triage call

Each entry materialises a `TaskContextBundle` against demo
resolvers and renders it in the **Task Context** panel — JSON,
slot counts, dropped-slot reasons, declared vs consumed token
budget. The LLM call itself lands when the `llm-call` capability
extension does; until then, the bundle is the canary that
confirms the contract works end-to-end in the dev shell.

## Registering your own tasks

Consumer-contributed tasks live in `.vibesmith/tasks/manifests/`
as TOML files following the `TaskManifest` schema (exported from
`@vibesmith/content-schemas`):

```toml
id = "game.draft-card-text"
version = "0.1.0"
brief = "Draft display text for a card archetype"
category = "authoring"

[budget]
contextTokens = 6000
outputTokens = 400

[minCapability]
contextWindow = 16000

[output]
format = "markdown"

[[slots.required]]
id = "selection"

[[slots.optional]]
id = "canon.style"
```

Slot ids reference the framework's central slot registry; new
slots register through the same capability mechanism as MCP
tools. The manifest validator catches missing slots, budget
overruns from required slots alone, and vendor-feature leakage
above the agreed minimum capability profile before the manifest
reaches dispatch.

## Persistence

| Artifact | Lifetime | Location |
|---|---|---|
| Framework + extension task manifests | Pinned with the framework / extension version | Inside their package |
| Consumer-contributed task manifests | In your project repo | `.vibesmith/tasks/manifests/*.toml` |
| Per-invocation bundles | Ephemeral by default, opt-in retention | `.vibesmith/runs/tasks/<tsk_…>.json` |
| Provenance log | Append-only, shared with asset-pipeline | `.vibesmith/runs/provenance.jsonl` |
| Chat panel threads | Project-scoped | `.vibesmith/threads/<thread-id>.json` |
| Pinned invocations | Project-scoped, user-flagged | `.vibesmith/tasks/pinned/<tsk_…>.json` |

Defaults gitignore `.vibesmith/runs/`; commit
`.vibesmith/tasks/manifests/`. Non-TS consumers append events to
the JSONL provenance log directly — the format is the contract,
not the TS types.

## See also

- [`ai-assistant`](/reference/ai-assistant/) — the four-tier
  interaction model (proactive / quick / chat panel / external
  assistant) that consumes this contract
- [`scenario-driven-dev`](/reference/scenario-driven-dev/) — the
  cross-language schema pattern task manifests follow
- [`prefab-system`](/reference/prefab-system/) — the
  *prefab-extension pattern* for shipping task manifests in your
  own package's namespace
