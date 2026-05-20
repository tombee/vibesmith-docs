---
title: 'What vibesmith is'
description: 'A friendly introduction — what vibesmith gives you, who it is for, and what it deliberately is not.'
---

vibesmith is an **editor + framework** for building games that run on
the web. It's built on Three.js, React Three Fiber, and Vite, ships
as a desktop app that opens project folders, and is designed from
the ground up to be driven by AI coding assistants working alongside
a human.

It's pre-MVP. Read this page to decide whether to bet on it today,
plan around it for later, or pick something else.

## In one sentence

**A WebGL-first game-dev editor + content pipeline that assumes you
have an AI coding assistant in the loop, with project files that
are portable, human-readable, and AI-friendly.**

## What you get

Open a project folder in the vibesmith desktop app and you get:

- **A real editor.** Three-panel layout (hierarchy, viewport,
  inspector) following the conventions established by mature
  game / 3D editors. Click-to-select, transform gizmos (W/E/R/F
  shortcuts), inspector field edits write back to the live scene,
  hierarchy + inspector poll the scene so external changes (game
  scripts, hot reload) stay visible. See [Engine
  patterns](/vibesmith-docs/reference/engine-patterns/) for the
  translation guide from established engines to R3F.
- **A typed project contract.** Every project is a folder with
  `vibesmith.toml`, `scenes/`, `prefabs/`, `assets/`, `scripts/`,
  `scenarios/`, `agents/`. Files are JSON / TypeScript / TOML —
  diff-friendly, AI-friendly, version-control-friendly. The binary
  reads + writes through a documented schema; no proprietary
  binary blobs.
- **A plugin model for game logic.** `scripts/project.ts` calls
  `defineGameScript({ id, onTick })` and the binary runs your
  logic against the live Three.js scene every frame. See
  [Writing a game script](/vibesmith-docs/cookbook/writing-game-scripts/).
- **An AI-aware content pipeline.** Director surfaces (scene,
  asset, narrative) sit on top of generators and critics — see
  [Director pattern](/vibesmith-docs/reference/director-pattern/).
- **Performance budgets + adaptive rendering.** Tier 0/1/2 device
  matrix with auto-scaling render settings — see
  [Performance budgets](/vibesmith-docs/reference/performance-budgets/)
  and [Adaptive rendering](/vibesmith-docs/reference/adaptive-rendering/).
- **A predictable upgrade path.** Customer-owned files vs
  framework-managed state are split deliberately; binary upgrades
  never silently rewrite your content. See [Project upgrade
  model](/vibesmith-docs/reference/project-upgrade-model/).
- **An open, mirrored doc surface for AI.** Every reference doc on
  this site is also reachable via [`llms.txt`](/vibesmith-docs/llms.txt) — the agent-
  discoverable manifest. Your AI assistant doesn't have to guess.

## Who this is for

- **Solo or small-team developers** who want to ship a real WebGL
  game without owning a custom-engine project.
- **Teams running AI-augmented workflows** (Claude Code, Cursor,
  Codex, etc.). The methodology assumes an AI agent is doing
  meaningful work — the docs, the project contract, and the CLI
  surface are all shaped for it.
- **Developers who pick web-first.** If your target is a browser
  (and maybe a Tauri-wrapped desktop / mobile shell on top),
  vibesmith starts where you start.

## What it isn't

- **Not a new rendering engine.** vibesmith uses Three.js (via
  React Three Fiber) for rendering. We build the editor +
  methodology + content pipeline on top, not under.
- **Not a no-code platform.** Game logic is TypeScript inside
  `scripts/`. The editor + AI assistant make the loop fast; they
  don't remove code.
- **Not feature-complete.** The framework is pre-MVP. Networking,
  physics, animation state machines, full asset pipelines —
  contracts exist; implementations land slice by slice. Don't
  expect the breadth of a decades-old engine at this version.
- **Not a substitute for native engines** if your target is
  console builds or AAA-scale rendering. WebGL has hard limits
  (see [WebGL constraints](/vibesmith-docs/reference/webgl-constraints/));
  if you need PS5 or HDR or 8K, pick a native engine.
- **Not silent about AI.** The methodology is AI-maximalist. If
  you don't want AI in your dev loop, the framework still works
  but you'll get less out of it than the cost of adoption.

## How it fits next to what you already use

- **Three.js** — vibesmith uses it. Three is the rendering layer
  underneath everything you'll see on screen.
- **React + R3F** — vibesmith uses them for the UI and the scene
  tree. Your scenes are React components mounted inside the
  binary's `<Canvas>`.
- **Vite** — vibesmith uses it. Hot reload of your scripts +
  scenes works the way you'd expect.
- **Established native engines (or web-first competitors).**
  vibesmith is an alternative path, not a complement. See the
  [comparisons FAQ](/vibesmith-docs/faq/) for the substantive
  differences.

## When to come back later instead

- **You're shipping next month** and need every feature today.
  vibesmith is pre-MVP — picking it commits you to filling in
  framework gaps as you hit them.
- **You're targeting native consoles or native mobile** as a
  primary release. Pick a native engine. WebGL is vibesmith's
  home.
- **You're allergic to AI-touched code.** The methodology assumes
  it. The tooling assumes it. The doc surface is designed for it.

## Next steps

- [Quick start](/vibesmith-docs/getting-started/quick-start/) —
  scaffold a project and see the starter cube spin.
- [Concepts](/vibesmith-docs/concepts/) — first-principles
  explainers for the framework's vocabulary if you're a complete
  newcomer or want to ground yourself before code.
- [Cookbook](/vibesmith-docs/cookbook/) — short, code-forward
  recipes once your project is running.
- [Comparisons FAQ](/vibesmith-docs/faq/) — vs Three.js,
  Babylon.js, web-export engines, web-native competitors.
- [Positioning](/vibesmith-docs/positioning/) — the deeper *why*:
  the strategic bet, the limits, and what we deliberately won't
  do.
- [Anti-patterns](/vibesmith-docs/anti-patterns/) — the 12-entry
  list of R3F mistakes that bite first.
