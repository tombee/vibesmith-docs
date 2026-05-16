---
title: Vibesmith
description: AI-augmented framework for building WebGL games with React Three Fiber. Guides, cookbook, anti-patterns, and reference.
---

Vibesmith is a framework for building AI-augmented games on the web. It
ships methodology, agentic pipeline patterns, an in-browser dev shell,
and conventions for Vite + React + R3F + Three.js + TypeScript projects.

This site is the **public reference** — guides, cookbook, anti-patterns,
and a small surface of framework reference docs aimed at consumers of
the framework.

## Read this first

- [**Quick start**](/vibesmith-docs/getting-started/quick-start/) —
  `vibesmith init` a new project and what it sets up.
- [**Cookbook**](/vibesmith-docs/cookbook/) — short, code-forward
  recipes (instancing, animations, perf debugging, …).
- [**Anti-patterns**](/vibesmith-docs/anti-patterns/) — numbered list
  of recurring R3F mistakes. Worth skimming before writing per-frame code.
- [**Reference**](/vibesmith-docs/reference/) — engine patterns, WebGL
  constraints, performance budgets, adaptive rendering, materials.

## Who this is for

- **Developers building on Vibesmith.** The cookbook + reference is the
  fastest path from "I have a new project" to "I have a working,
  performant scene".
- **AI coding agents.** Both the rendered docs and a parallel agent-only
  surface (terse, fetchable) are designed to be context-rich and
  link-discoverable. See [Agent context](/vibesmith-docs/agents/) and
  the root-level [`llms.txt`](/vibesmith-docs/llms.txt).

## What's NOT here

This site covers *using* Vibesmith. Docs about *building* Vibesmith
itself — ADRs, internal roadmap, methodology, distribution model, the
proactive ledger — live in the private framework repo. Those are
internal architecture artifacts and intentionally not published.

## Status

Pre-MVP. Content lands as the framework matures; cookbook + reference
entries are added when real consumer projects (Vibescape, Riftbound)
hit specific gaps, not speculatively.
