---
title: 'Extension'
description: 'An extension is a panel or feature that plugs into the vibesmith editor. The hierarchy, inspector, console, snapshot library, MCP server — every editor surface is an extension. Plus you can write your own.'
---

An **extension** is **a panel or feature that plugs into the
vibesmith editor**. Almost every surface you interact with in the
editor — the hierarchy panel, the inspector, the console, the
snapshot library, the chat panel, the cmd+P palette — is built as
an extension.

Extensions are how the framework stays modular: each one
contributes a panel (or a menu item, or a quick action, or an
MCP tool) without having to know about any other extension.

## What an extension contributes

An extension can contribute any of:

- **One or more panels** — React components that the editor docks
  into the layout (the inspector panel, the snapshot library
  panel).
- **Menu items** — top-of-window menu entries (`File > Open Recent
  Snapshot…`, `Window > Console`).
- **Quick actions** — `cmd+P` entries (`shader.generate-from-prompt`,
  `snapshot.capture`).
- **MCP tools** — surfaces exposed to AI assistants over the
  framework's MCP server.
- **Background services** — long-running watchers or sync loops
  (the snapshot HMR preserver, the bug-report uploader).

Most extensions contribute more than one thing. A
"snapshot-library" extension contributes the panel, the cmd+P
entry to open it, and the underlying MCP tool that lists
snapshots.

## Two kinds of extensions

The framework distinguishes:

- **Standard extensions** — ship with the vibesmith editor.
  Inspector, hierarchy, console, snapshot library, etc. You
  don't install them; they're part of the editor.
- **Capability extensions** — sit on top of the
  [capability](capability) layer and add domain-specific
  intelligence. The asset catalogue is the first one; recipe
  canon is the next.

You can also write your own extensions for project-specific
tooling, but the framework's discipline is to **upstream
generalisable patterns** rather than forking every project's
needs.

## Opt-in by default (post Track UX-2)

The editor used to mount every standard extension unconditionally
— including specialist surfaces (Sentry telemetry, mission control,
agent runner) that solo indie devs don't need on day one. Track
UX-2 changed that: extensions are opt-in via an `[extensions]`
table in `vibesmith.toml`, configurable from a Project Settings
screen.

If you don't need the Sentry panel, you don't have it. If you do,
flip a switch.

## How extensions stay simple

The framework's extension API is small on purpose. An extension:

1. Exports a `DevExtension` object — id, default-enabled flag,
   category, dependencies, contribution functions.
2. Lives in `packages/standard-extensions/src/<name>/` (or your
   project's `extensions/` directory).
3. Gets mounted by the editor at startup based on the
   `[extensions]` table.

The contract is the same for first-party extensions and
third-party extensions — the framework doesn't have privileged
APIs the standard set uses and you can't.

## Why this is load-bearing

The editor is shaped to be **opened by AI assistants as much as
by humans**. Extensions are the unit AI tooling reasons about —
"what panels are visible?", "what tools are registered?", "what's
this project's extension shape?". Keeping the contract narrow
and inspectable is the framework's bet that AI fluency on the
editor's structure is non-negotiable.

## Next

- [Extension architecture](/vibesmith-docs/reference/) —
  the full reference (owed to consumer-facing docs).
- [Quick start](/vibesmith-docs/getting-started/quick-start/) —
  scaffolds a project with the default extension set.
- [Install vibesmith MCP](/vibesmith-docs/cookbook/install-mcp/) —
  wires the MCP-tool surface extensions expose to your AI
  assistant.
