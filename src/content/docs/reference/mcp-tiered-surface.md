---
title: 'MCP surface — Tier-1 router, Tier-2 deferred catalog, Resources, project-shape gating'
description: 'How an external assistant reaches a vibesmith project over MCP — the always-loaded Tier-1 router (≤ 4k schema tokens, ~10–15 tools), the Tier-2 deferred catalog whose schemas load via `tools_find`, the `vibesmith://` Resources surface for read data, and `vibesmith.toml [project].type / [capabilities] / [mcp]` project-shape gating.'
---

> **Framework. Game-agnostic.** vibesmith aspires to expose every
> framework capability via MCP so any assistant (Claude Code,
> Codex CLI, Copilot, Cursor, Cline, custom orchestrators) can
> drive the full pipeline. A flat tool list at that scope
> easily hits hundreds of tools and tens of thousands of
> always-loaded schema tokens per session — a cost the consumer's
> assistant pays every turn. The tiered surface bounds that cost
> while preserving 100% coverage.

## The two tiers

**Tier 1 — always loaded.** ~10–15 tools, hard ≤ 4k schema-token
budget, CI-enforced. These are the tools every session has at
hand:

- **Discovery + routing.** `discover(area)` (scenario-tagged
  browse), `tools_find(query, limit?)` (keyword search of the
  deferred catalog), `tools_invoke(id, args)` (call a found
  deferred tool), `capability_list` (installed extensions +
  status).
- **MCP Resources.** `resource_list(namespace?)` (enumerate
  available resources), `resource_read(uri)` (fetch a resource).
- **Scene reads.** `get_selection` (current selection),
  `find_objects` (scene search by name / uuid / type).
- **Task context (Track V0).** `context_list_tasks`,
  `context_describe`, `context_assemble`.
- **Diagnostics.** `logs.tail({ limit?, level?, since? })` — recent
  editor-shell + hub-supervisor log lines, filterable by level
  (`info` / `warn` / `error` / `all`; default `warn`) and `since`
  (ISO timestamp). The assistant can call this mid-task to detect
  failures the user hasn't pasted yet (HUD warnings, parse errors,
  context-lost). Returns `{ ts, level, source, message }[]` with
  ANSI / source-map noise stripped.
- **Agent attention routing.**
  `mcp__vibesmith__focus_panel({ panel_id, flash? })` — bring a
  non-viewport editor panel to the front and optionally flash-
  highlight its border for ~600ms. When the agent changes
  something in a panel (registers an asset, drops a snapshot,
  drives a fixture transition), this directs the user's eye to
  the affected surface. The non-viewport sibling of
  `set_active_scene` / `viewport_screenshot` — those answer
  *what should the viewport show?*; this answers *what should the
  user look at?* On unknown panel id, the response carries the
  registered-id list so the agent self-corrects on the next call.

**Tier 2 — deferred catalog.** Name + one-line description +
scenario tags only until `tools_find` resolves the JSONSchema.
Examples include `manage_object`, `scenario_author`,
`manage_extension`, and (as the framework grows) every provider
call, recipe execution, DCC bridge op, asset-pipeline stage,
QA probe, scenario authoring action, and GM tooling op.

Assistants discover Tier-2 tools through the router's two
retrieval channels:

```
tools_find("spawn entity", 5)
  → [
      { id: "scene_spawn",
        description: "Spawn a primitive entity into the scene",
        scenarioTags: ["scene", "authoring"],
        schema: { ... },
        score: 11 },
      ...
    ]

discover("authoring")
  → { area: "authoring",
      tools: [...],
      resources: [{ uri: "vibesmith://recipes/index", ... }] }
```

Once the assistant has the schema, it calls the tool through
`tools_invoke(id, args)` — args matching the resolved schema.

## Resources, not Tools, for read data

MCP supports both **Tools** (action endpoints with full schemas)
and **Resources** (read-only data with URIs + lazy fetch).
vibesmith reserves Tools for mutations + side effects; every
read flows through Resources:

| Read | Resource URI |
|---|---|
| Framework version + capabilities | `vibesmith://framework/version` |
| Task taxonomy index | `vibesmith://tasks/index` |
| Canon catalogue index | `vibesmith://canon/index` |
| Recipe canon entries | `vibesmith://recipes/<id>` |
| Provider knowledge base | `vibesmith://providers/<id>` |
| Perf telemetry snapshot | `vibesmith://perf/last` |
| Scenario library index | `vibesmith://scenarios/index` |
| Asset manifest | `vibesmith://assets/manifest` |
| Knowledge-pack lookups | `vibesmith://knowledge/<pack>/<topic>` |

Resources cost zero schema tokens — `resource_list` enumerates by
namespace; `resource_read` fetches by URI. The Tier-1 pair
carries the entire read surface.

## Project-shape gating from `vibesmith.toml`

Three blocks control what the MCP server registers:

```toml
[project]
type = "3d"                  # or "2d"
vibesmith = "^0.1"

[capabilities]
enabled = ["recipe-canon"]   # opt-in
disabled = ["audio-runtime"] # opt-out (overrides enabled)

[mcp]
expose = ["scene", "context"]   # optional positive allowlist
suppress = ["dcc-bridges"]      # absolute deny
```

**Precedence** (deny-first): `[mcp].suppress` always wins;
`[capabilities].disabled` denies even when listed in
`[mcp].expose`; when `[mcp].expose` is present it acts as a
positive allowlist; `[project].type` filters tool families
(`2d` projects never see 3D-only namespaces and vice-versa).
Anything not denied + matching the type is allowed.

Gating happens at **registration time**, not at tool-call time.
A suppressed tool is invisible to `tools_find` / `discover` /
the native MCP tool list — assistants cannot accidentally
discover it. This is a load-time configuration mechanism *and* a
defense-in-depth feature; the security boundary remains the
hub's authentication layer.

## Inspecting the active gate — `vibesmith doctor --mcp`

```
$ vibesmith doctor --mcp

vibesmith doctor --mcp

  ok  project — type=3d, enabled=[recipe-canon], disabled=[audio-runtime]
  ok  [mcp] — expose=[∅], suppress=[dcc-bridges]

  effective namespace policy:
       ok framework — allow
       ok context — allow
       ok scene — allow
       ok scenarios — allow
       ok extension — allow

mcp surface healthy
  (run `bash scripts/check-mcp-budget.sh` for the live Tier-1 budget report)
```

The subcommand reports the policy parsed from `vibesmith.toml`
+ shows which baseline namespaces would survive (or be filtered
out) under that policy. Run before opening a fresh session if
your assistant can't find an expected tool.

## CI tool-budget guard

`scripts/check-mcp-budget.sh` runs in framework CI and computes
the per-namespace schema-token count against the registered
Tier-1 tools. Limits:

| Scope | Budget |
|---|---|
| Tier-1 router (total) | 4_000 tokens |
| Per-extension always-loaded Tier-1 share | 2_000 tokens |
| Per-deferred-tool description (catalog index) | 80 tokens |
| Tier-2 schema (when fetched) | 4_000 tokens |

Current framework Tier-1 share: **~1.6k / 4k**. CI fails when a
limit is exceeded; the fix is one of: shrink the description,
split into narrower tools, move to the deferred catalog, or
bump the budget with a documented CHANGELOG note.

## See also

- [Task context](/reference/task-context/) — Track V0. The
  `context_*` tools the router hosts come from V0.
- [Project upgrade model](/reference/project-upgrade-model/) —
  the `vibesmith.toml` semver discipline the `[mcp]` block sits
  alongside.
