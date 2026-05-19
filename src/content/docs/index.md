---
title: vibesmith
description: AI-augmented framework for building WebGL games with React Three Fiber. Guides, cookbook, anti-patterns, and reference.
---

vibesmith is an editor + framework for building games that run on
the web — built on Three.js, React Three Fiber, and Vite, ships
as a desktop app that opens project folders, and designed from the
ground up to be driven by AI coding assistants working alongside a
human.

This site is the **public reference** — guides, cookbook, anti-patterns,
and a small surface of framework reference docs aimed at consumers of
the framework.

## Read this first

- [**What vibesmith is**](/vibesmith-docs/introduction/) — friendly
  intro: what you get, who it's for, what it deliberately isn't.
- [**Comparisons FAQ**](/vibesmith-docs/faq/) — vs Three.js, R3F,
  Babylon.js, native engines compiled to the web, web-native
  competitors. The honest picker.
- [**Positioning**](/vibesmith-docs/positioning/) — the deeper *why*:
  the strategic bet, the limits, and what we deliberately won't do.
- [**Quick start**](/vibesmith-docs/getting-started/quick-start/) —
  `vibesmith init` a new project and what it sets up.
- [**Cookbook**](/vibesmith-docs/cookbook/) — short, code-forward
  recipes (instancing, animations, perf debugging, writing game
  scripts).
- [**Anti-patterns**](/vibesmith-docs/anti-patterns/) — numbered list
  of recurring R3F mistakes. Worth skimming before writing per-frame code.
- [**Reference**](/vibesmith-docs/reference/) — engine patterns, WebGL
  constraints, performance budgets, adaptive rendering, materials,
  project upgrade model.

## Who this is for

- **Developers building on vibesmith.** The cookbook + reference is the
  fastest path from "I have a new project" to "I have a working,
  performant scene".
- **AI coding agents.** Both the rendered docs and a parallel agent-only
  surface (terse, fetchable) are designed to be context-rich and
  link-discoverable. See [Agent context](/vibesmith-docs/agents/) and
  the root-level [`llms.txt`](/vibesmith-docs/llms.txt).

## What's NOT here

This site covers *using* vibesmith. Docs about *building* vibesmith
itself — ADRs, internal roadmap, methodology, distribution model, the
proactive ledger — live in the private framework repo. Those are
internal architecture artifacts and intentionally not published.

## Status

Pre-MVP. Content lands as the framework matures; cookbook + reference
entries are added when real consumer projects hit specific gaps, not
speculatively.
