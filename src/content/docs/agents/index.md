---
title: Agent context
description: How AI coding agents should consume vibesmith knowledge. Terse, link-rich; designed for context-window efficiency.
---

This site is structured so AI coding agents working in vibesmith
projects can grab context quickly without filesystem walks into the
private framework repo.

## Quick links by intent

| If the agent needs to… | Read |
|---|---|
| Build a new feature against the framework | [Quick start](/vibesmith-docs/getting-started/quick-start/) |
| Avoid common R3F mistakes before writing code | [Anti-patterns](/vibesmith-docs/anti-patterns/) |
| Render many copies of one object | [Cookbook: instancing](/vibesmith-docs/cookbook/instancing/) |
| Add or cross-fade authored animations | [Cookbook: animations](/vibesmith-docs/cookbook/animations/) |
| Measure what's slow | [Cookbook: perf debugging](/vibesmith-docs/cookbook/perf-debugging/) |
| Understand WebGL hard limits | [Reference: webgl-constraints](/vibesmith-docs/reference/webgl-constraints/) |
| Respect performance budgets | [Reference: performance-budgets](/vibesmith-docs/reference/performance-budgets/) |
| Translate a Unity pattern to R3F | [Reference: engine-patterns](/vibesmith-docs/reference/engine-patterns/) |
| Pick a material role / understand shader sharing | [Reference: material-system](/vibesmith-docs/reference/material-system/) |
| Author or query a scene | [Reference: scene-construction](/vibesmith-docs/reference/scene-construction/) |

## Discovery surfaces

- [`llms.txt`](/vibesmith-docs/llms.txt) at site root — flat manifest
  of pages and intent, designed for agent-side indexing. Stable URL;
  follow the emerging `llms.txt` convention.
- This page (`/agents/`) — narrative index that an agent's first hit
  on the site resolves to.
- The MCP server (`@vibesmith/mcp-server`, registered via `.mcp.json`
  in scaffolded projects) will gain `read_recipe` / `read_doc` /
  `search_framework_knowledge` tools that query this site server-side.
  Until those land, agents should fetch URLs directly.

## Style conventions

- **Code first.** Snippets are working JSX/TS, not pseudo-code.
- **Caveats explicit.** Every recipe has a "Watch out for" section.
- **Game-agnostic.** Examples use generic entities (props, characters,
  particles). Consumer game vocabulary lives in each consumer's
  `docs/game/`.
- **Anti-patterns are numbered + stable.** `#NN-slug` cross-references
  in recipes link to specific anti-pattern entries. Never renumbered.

## When this page is wrong

Treat docs as a snapshot. The framework is pre-MVP and changes weekly;
the cookbook lags real practice. If a recipe contradicts what's in the
codebase, the codebase wins — but flag it as a doc bug so it gets
updated.
