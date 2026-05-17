---
title: 'AI assistant — context-aware AI assistant for framework consumers'
description: '> **Framework. Game-agnostic.** Defines the framework''s in-browser > AI assistant: a assistant that gives any project''s developer > context-aware AI help —...'
---

> **Framework. Game-agnostic.** Defines the framework's in-browser
> AI assistant: a assistant that gives any project's developer
> context-aware AI help — modify content, write extensions, propose
> director interventions, answer questions — without leaving the
> dev tooling. The director loop, exposed as a product feature.
>
> **In flight.** This surface is being expanded into a **four-tier
> interaction model**: proactive recommendations (background), a
> cmd+P quick-action palette (one-shot context-aware prompts), a
> BYOK first-party chat panel (for users with only an LLM API
> key, no paid coding-assistant sub), and external coding
> assistants driving the framework via MCP (Claude Code,
> Copilot, Codex). Backed by a shared task-context-contract and
> a curated knowledge-pack surface that lets the framework plug
> gaps where LLMs underperform on specialised domains (shaders,
> ECS, WebGPU). All AI surfaces are token-budgeted by design:
> aggressive prompt caching, deferred-by-default tool schemas,
> visible per-call token meter (input / output / cache-hit only —
> no dollar conversion because subscription assistants don't
> publish $/tok rates). Slices roll in across 2026.

## What this is

A floating sidebar in the dev tooling (`⌘L` to focus) that talks
to an LLM, knows what the developer is currently looking at, and
can:

- **Answer questions** about the project ("why is this scene
  loading slowly?", "what does this prefab do?")
- **Propose changes** to content via director interventions (the
  director-task-io substrate — see
  [`director-pattern.md`](director-pattern.md))
- **Write extensions** for the dev shell (scaffold a new
  extension; modify an existing one)
- **Drive the framework CLI** ("upgrade to framework 0.8", "add
  the colyseus-admin extension", "scaffold a card-prefab type")
- **Trigger probes / agents** ("run the Tier 0 sweep on this
  scene", "ask theme-critic to review the latest dialogue
  output")
- **Search docs + memory** across `docs/framework/`, `docs/game/`,
  agent definitions, the proactive ledger, prior assistant
  conversations

It is the **developer-facing version** of the same director loop
we use internally — with the same critic gates and provenance
trail, surfaced as UX.

This is the framework's *killer feature for adoption*. Other game
developers using the framework get an AI assistant that has been
told everything about how the framework works.

---

## Why this is load-bearing

Three reasons it deserves first-class status, not "nice extension
we ship if we have time":

1. **The methodology bet is "AI throughout the pipeline."** A
   assistant extension makes the bet concrete at the *consumer's*
   surface. Without it, consumers experience the framework as
   "good libraries"; with it, they experience the framework as
   "AI methodology, productized."

2. **The framework's surface area is big.** Director pattern,
   prefab system, extension API, asset pipeline, networking, db
   migrations, probe pipeline, validation pipeline, mission
   control, agent fleet — a consumer can't hold all of that in
   their head. The assistant's job is to know it so they don't
   have to.

3. **It uses our existing substrate.** The director-task-io
   substrate is the same one Claude Code uses; the assistant is a
   second client on it. We're not building a parallel system.

---

## What the assistant has access to (context)

The assistant's effectiveness is proportional to the context it can
include in prompts. The framework provides:

### Project context (auto-injected)

- The project's `framework.config.ts` (game name, networking
  shape, render profile, enabled extensions, critic ensemble)
- A digest of `docs/framework/` and `docs/game/` — pulled from
  the docs-topic-index
- The current state of the proactive ledger
- Project's CLAUDE.md
- Recent commits (last N) — for "what just changed?" context
- Recent provenance log entries from the director-task-io
  substrate

### Current-surface context (which dev tooling page the user is on)

Each standard extension declares **what context the assistant gets
when the user is on its surface**. Examples:

- **On `/dev/scenes`**: current scene id, composition tree,
  selected entity, recent intervention history, applicable
  prefab types
- **On `/dev/assets`**: current asset id, manifest entry, recent
  imports, tonality-critic verdicts
- **On `/dev/probes`**: probe results browsed, recent runs, audit
  report
- **On `/dev/mission-control`**: current dashboard, time range,
  flagged anomalies
- **On `/dev/bugs`**: current bug report, related captures
- **In-game overlay**: current FrameCapture, scene state, network
  state

Extensions register this via `IntrospectionProbe` (see
[`extension-architecture.md`](extension-architecture.md)).

### Conversation context

- Recent messages in this assistant conversation
- Pinned snippets the user has marked as load-bearing for this
  session
- Optionally: snippets from prior assistant conversations the user
  has bookmarked

The assistant is **not given the entire codebase by default**. It
asks for files when it needs them — the same pattern Claude Code
uses. This keeps prompts focused and costs predictable.

### Capability context

The assistant knows about the framework's capabilities:

- Which subagents are available (writer, theme-critic, etc.)
- Which director interventions are valid for the current selection
- Which extensions are enabled and their commands
- Which probes can be triggered
- Which CLI commands are available

This is what enables it to **drive the tooling**, not just
discuss it.

---

## What the assistant can do (capabilities)

Tiered by autonomy. The user controls how much the assistant is
allowed to do without explicit confirmation.

### Tier 1 — answer + draft (default, no confirmation)

- Answer questions about the project / framework / docs / state
- Draft text (dialogue, descriptions, comments, commit messages)
- Suggest changes shown as diffs the user reviews before applying
- Generate code shown as snippets the user copy-pastes

### Tier 2 — propose interventions (per-action confirm)

- Propose a director intervention (composition-patch,
  recipe-patch, regenerate, suggest-code, clarify) — written to
  the director-task-io substrate, surfaced to the user for
  approval before apply
- Trigger a subagent (writer, theme-critic, etc.) — the user sees
  the brief + verdict before any apply
- Run a probe — read-only, but the user confirms which probe
- Run a doctor / dry-run — read-only diagnostic

### Tier 3 — apply directly (opt-in per session or per project)

- Apply approved interventions
- Run mutating CLI commands (`framework upgrade`, `db-push`,
  `add-extension`)
- Create / edit / delete files within declared roots
- Run migrations
- Commit changes

Tier 3 is **off by default**. Projects enable it explicitly via
`framework.config.ts`:

```ts
assistant: {
  autonomy: {
    tier3: 'session-prompt', // 'always' | 'session-prompt' | 'per-action' | 'never'
    allowedRoots: ['./packages/content/data', './docs/game'],
    forbidWrites: ['../framework/**', './docs/adr/*'],
  },
},
```

The forbid list is enforced *before* the assistant's tool call
fires, not as a post-hoc check.

---

## How a assistant turn flows

Mirrors the director pattern, with a UI layer:

```
1. User types prompt (or uses ⌘L to invoke from a context)
2. Assistant composes context:
   - Project-level (auto)
   - Current-surface (from active extension's probes)
   - Conversation history (last N turns + pinned)
   - Capabilities catalog (what tools are available)
3. Assistant sends prompt to the LLM
4. LLM responds with:
   - Text (rendered as markdown)
   - Tool calls (proposed interventions, agent runs, file reads, etc.)
5. For each tool call:
   - Tier 1 → execute, show result
   - Tier 2 → show preview / dry-run, ask confirm
   - Tier 3 → if allowed for this session, execute with provenance
6. User responds; loop
```

Every interaction is logged to the director-task-io provenance
log (the same JSONL stream that internal Claude sessions write
to). The user can review, undo (via git), or replay.

---

## Provider model

The assistant is **provider-pluggable**. The current default is the
**Claude Code local bridge** (see "Local Claude Code backend"
below). The interface is generic enough to slot in a direct
Anthropic adapter, OpenAI, Google, a local LLM, or future
providers.

```ts
// packages/standard-extensions/src/ai-assistant/provider.ts
export interface AssistantProvider {
  id: string;                    // 'claude-code-local' | 'anthropic' | 'openai' | 'local-ollama'
  models: string[];              // 'claude-opus-4-7' | 'gpt-5' | etc.
  send(req: AssistantRequest): AsyncIterable<AssistantEvent>;
}
```

Each project decides what provider it uses. We don't bake in a
hosted backend; either the user's API key talks directly to the
provider, or the user's local Claude Code session does. This
avoids billing through us, avoids us being a middleman, and keeps
the local-first principle clean.

### Local Claude Code backend (default)

The default assistant architecture is **MCP-canonical**: a standalone
stdio MCP server (`@vibesmith/mcp-server`) exposes the scene tool
surface to whatever MCP-speaking engine the developer uses
(`claude`, future `gemini-cli`, `codex`, etc.). A small Node hub
(`@vibesmith/assistant-bridge`) sits between the MCP server and the
browser dev shell.

```
   your terminal `claude` ──── stdio MCP ────► @vibesmith/mcp-server
                                                   │
                                                   │ WS
                                                   ▼
                                              vibesmith hub
                                              (@vibesmith/assistant-bridge)
                                                   │
                                                   │ WS
                                                   ▼
                                              browser dev shell
                                              (ai-assistant panel = activity log;
                                               window.__vibesmithSceneAccessor
                                                executes mutations)
```

Lifecycle:

1. Developer runs `just assistant-bridge` (or `vibesmith-hub --cwd .`)
   from the consumer project root. The hub:
   - Listens on `ws://127.0.0.1:7733/{shell,mcp-peer}`.
   - Writes a project-scoped `.mcp.json` registering
     `@vibesmith/mcp-server` as a stdio server pointed at the hub.
2. Developer opens `claude` in a terminal in the same directory.
   `claude` auto-discovers `.mcp.json`, spawns the vibesmith MCP
   server as a child, and the four scene tools become available.
3. Developer opens the browser dev shell. The AI Assistant panel
   connects to the hub's `/shell` endpoint.
4. Developer types in their `claude` terminal: "scale the selected
   cube 2x". `claude` decides to call `manage_object`. The MCP
   server forwards to the hub. The hub forwards to the browser.
   The browser mutates the live scene via the accessor and replies.
   The mutation is visible in the editor and undoable via the
   gizmo history.

Why this shape:

- **Engine-pluggable from day one.** Any client that speaks MCP
  works — terminal `claude`, future `gemini-cli`, future `codex`.
  The hub doesn't spawn engines; engines reach the hub through MCP.
- **CLAUDE.md is loaded automatically.** The developer's `claude`
  reads CLAUDE.md from the project root they invoked it in.
- **Credentials stay where the engine already keeps them.** No API
  keys in browser localStorage. The user's existing `claude` OAuth
  (or other engine auth) flows through.
- **Engine-agnostic on the browser side too.** The scene-tools
  contract is just `window.__vibesmithSceneAccessor` — any
  consumer that registers it plugs in. The hub doesn't know
  whether the renderer is Three.js, R3F, or something else.

#### Authoring ad-hoc tools (transient extensions)

The bridge can write a TSX file into the consumer's
`dev-shell-transients/` directory. A `<TransientExtensionsHost>`
component (exported from `@vibesmith/dev-shell`) watches that
directory via `import.meta.glob`. When Claude lands a new file,
Vite HMR re-runs the glob, the host calls
`setTransientExtensions(...)`, and the dev shell renders the new
panel alongside the baked-in ones.

This is the substrate for the "build me a tuning panel" workflow:

1. User: *"I'm tuning the bloom intensity on this material. Give
   me a slider panel with intensity / threshold / radius."*
2. Claude (Write tool): scaffolds
   `<consumer-app>/src/dev-shell-transients/<feature>-tuner.tsx`,
   default-exporting a `TransientExtension` with `origin:
   'ai-authored'`.
3. HMR refresh; the panel appears in the Window menu.
4. User iterates. When done, either:
   - keeps it (file already on disk; flip `origin` to
     `'user-authored'`, or move into
     `packages/standard-extensions` to promote across all
     consumers), or
   - asks Claude to delete the file.

Trust model: AI-authored transients are tagged so the assistant
itself can offer to wipe them at session end; user-authored
transients are durable.

### Direct Anthropic backend (alternative)

For consumers who don't want a local bridge running, the
extension can fall back to a direct browser-side Anthropic call
(the original 0.1.x behaviour, gated behind a user-pasted API
key). Used as the "no local Node process" mode. Provides Tier 1
only — file edits, Bash, and live scene mutations require the
bridge.

---

## Trust + safety

The assistant has read+write access to the project. Treat it like
any other source of mutations:

- **Provenance log**: every tier-2 / tier-3 action lands in
  `tmp/director-results/*.json` and the rotating JSONL log. Full
  audit trail.
- **Critic gates**: the same critic ensemble that gates internal
  director interventions (theme-critic, pg-critic, etc.) gates
  assistant-proposed changes when they touch critic-relevant
  content. Game-specific critics (e.g. balance critics for a
  TCG) extend this.
- **Git as the ultimate undo**: the assistant doesn't bypass git;
  every change is reviewable in `git diff`, revertable with
  `git checkout`. We never offer a "force apply" mode that
  skips this.
- **Forbid-list**: paths declared off-limits (e.g.
  `../framework/**`, `docs/adr/*`) are enforced at the tool-call
  boundary.
- **Capability declarations**: the assistant extension declares
  capabilities (`fileSystem`, `network`, `subprocessExec`) like
  any other extension; users see what it's reaching for.
- **No remote logging by default**: assistant conversations are
  local (localStorage / IndexedDB). Optional sync is an explicit
  opt-in.
- **PII discipline**: the assistant's context-builder strips
  prefixes that look like API keys / tokens / passwords before
  sending. Not a security guarantee (an LLM-proposed `git diff`
  could exfiltrate); the protection is: the user reviews diffs,
  the assistant doesn't auto-commit by default.

---

## What this is NOT

- **Not a chatbot.** The assistant's value is the *tooling integration*:
  it can propose interventions, trigger agents, run probes,
  apply migrations. A chatbot disconnected from those tools is
  the boring version.
- **Not a runtime LLM.** Players do not interact with the
  assistant. It exists only in the dev tooling. Runtime in-game
  text is still pre-baked at design-time. (See
  [`methodology.md`](methodology.md) § "No runtime LLM
  (current stage)".)
- **Not a "vibe code" generator.** The assistant lives within the
  framework's discipline: critics still gate, the prefab system
  still enforces shape, the abstraction discipline still binds.
  The assistant is a *better-informed contributor*, not a
  shortcut around quality gates.
- **Not a substitute for Claude Code.** Claude Code remains the
  primary AI development surface for the project maintainers.
  The assistant is for *consumers of the framework* who want
  in-browser AI help without setting up Claude Code, and for
  in-context interventions during a dev tooling session.

---

## Standard interventions the assistant can propose

The assistant's tool surface mirrors the director-task-io
intervention catalog (see [`director-pattern.md`](director-pattern.md)):

- **composition-patch** — JSON-patch on a composition
- **recipe-patch** — change recipe parameters and regenerate
  downstream
- **regenerate** — re-run a generator with same recipe (often
  with a different RNG seed)
- **generator-suggestion** — propose a code change to a generator
- **clarify** — ask the user a follow-up question (no mutation)

Plus assistant-specific tools:

- **trigger-agent** — invoke a subagent (writer, theme-critic,
  etc.) with a brief
- **run-probe** — run a probe (read-only)
- **run-cli** — run a framework CLI command (tier 2/3, with
  confirm)
- **read-file** — read a project file
- **write-file** — write a project file (tier 2/3, with confirm,
  scoped by allowedRoots / forbidWrites)
- **search-docs** — semantic search across framework + game docs
- **list-extensions** — what's enabled, what's available
- **inspect-state** — pull the current introspection probe set
- **search-ledger** — query the proactive ledger
- **propose-ledger-entry** — append to the proactive ledger

---

## Multi-turn flows the assistant is designed for

The assistant's UX is built around recurring flows. Each is a
multi-turn loop with critic gates:

### Flow A — Add new content via director

User: *"Make a new <prefab type> with these constraints."*

1. Assistant proposes the regenerate with a brief assembled from
   current selection + relevant docs.
2. The writer agent drafts the typed content.
3. The theme-critic gates the output (does it fit this game's
   tonal register?).
4. The asset-tonality-critic gates any visual brief.
5. The assistant surfaces the result for user approval.
6. User approves → applied via composition-patch.

### Flow B — Modify content

User: *"This dialogue feels off-register. Tighten it."*

1. Assistant reads the relevant voice cards / content.
2. Proposes a patch.
3. voice-consistency-critic verifies the new lines fit the
   established register.
4. theme-critic gates the new copy.
5. User reviews + approves.

### Flow C — Build an extension

User: "Add a balance-board extension for tuning card winrates."

1. Assistant scaffolds the extension via the framework CLI.
2. Generates the route component, command registrations,
   panel slots.
3. Wires it into `dev-shell.config.ts`.
4. Suggests the introspection probes the extension should
   expose.
5. User reviews + approves; runs `pnpm dev`; iterates inside the
   assistant.

### Flow D — Diagnose a bug

User: "FPS dropped to 30 in the demo realm. Why?"

1. Assistant pulls the current FrameCapture + performance probes.
2. Identifies which budget(s) are exceeded.
3. Proposes diagnostic next steps (run probe X, inspect entity
   Y, profile shader Z).
4. Once root cause is found, proposes a fix (composition-patch,
   asset re-bake, etc.).
5. Verifies with a re-run of the affected probe.

### Flow E — Migrate the framework version

User: "Upgrade to framework 0.8."

1. Assistant runs `pnpm framework migrate v0.7-to-v0.8 --dry-run`.
2. Surfaces the migration plan.
3. Walks through any breaking changes that need manual review.
4. Applies the migration; runs `pnpm framework doctor`; runs
   `pnpm probe`.
5. Reports green / red status.

Each flow is **documented in the assistant's onboarding** so
users discover them without prompting.

---

## Interaction model

The assistant lives as a **right-edge collapsible sidebar** in
the dev shell, default width 480px. Keyboard shortcuts:

- `⌘L` — focus assistant input (from anywhere in the dev shell)
- `⌘⇧L` — toggle sidebar visibility
- `⌘K` — open command palette (separate from assistant; commands
  are also runnable from inside assistant conversations)
- `Esc` — defocus assistant input
- `↑` in the input — recall last sent prompt
- `⌘↩` in the input — send

**In-game invocation:** the in-game overlay (see
[`extension-architecture.md`](extension-architecture.md) §
Baked-in dev panels) has a assistant quick-input. Useful for
asking questions about a running scene.

**Pinning:** any assistant response can be pinned — pinned items
appear in subsequent prompts' context. The user controls pin
budget.

**Conversation switching:** named conversations per project,
listed in the sidebar. Switchable. Searchable.

---

## Implementation phases

### Phase 0 — Read-only assistant (no tier 2/3)

Just answer questions. Context = project docs + current surface
+ conversation. No tool calls. Useful as the simplest version
that proves the context-pipeline works.

### Phase 1 — Tier 1 tools (read-only, no mutations)

Add `read-file`, `search-docs`, `inspect-state`, `search-ledger`,
`list-extensions`. Still no mutations; the user uses the
assistant's outputs to act manually.

### Phase 2 — Tier 2 tools (propose interventions)

Add `composition-patch` / `recipe-patch` / `regenerate` /
`generator-suggestion` / `clarify` proposals. The assistant writes
to the director-task-io substrate; the user approves applies.

### Phase 3 — Tier 3 tools (apply with consent)

Per-action confirm or session-prompt autonomy. Forbid-list
enforced. Critic gates active. Provenance logged.

### Phase 4 — Multi-agent orchestration

Assistant can run flows that chain agents (writer → critic →
director → user-approval) without per-step user driving. This is
the productized form of /loop. Still gated by critics + user
approval at the apply boundary.

---

## Cost + latency

Per-conversation budget set in `framework.config.ts`. Defaults
target Claude Opus 4.7 (1M context) since that's the framework's
maintainers' choice; project users can swap to Sonnet 4.6 / Haiku
4.5 for cheaper inference if response quality bears it.

The assistant uses **prompt caching** for the project context block
(the docs digest, capabilities catalog, etc.) so re-prompts within
a session don't re-pay for the static portion. Cache TTL is the
provider's (5 min for Anthropic).

Cost telemetry (tokens in/out, cache hit rate) is surfaced in the
assistant UI per-conversation so users can see what each session
costs.

---

## Reassessment triggers

Revisit this doc when:
- The first user-facing version ships and we have feedback on
  what the autonomy tiers should default to.
- Claude (or successor models) gain capabilities that change the
  flow (e.g. native tool sandboxing, native dev-environment
  awareness).
- A second provider lands and the abstraction has to grow.
- The critic-gating discipline interferes with assistant velocity
  in ways the user pushes back on — recalibration discussion.
- We open the framework publicly (phase 3 distribution) and the
  trust model needs hardening.

---

## Research notes

- [`notes/unity-mcp-research.md`](notes/unity-mcp-research.md) —
  takeaways from CoplayDev/unity-mcp that shaped the v1 tool
  surface (`manage_*` style, resource-first design, batch pattern).

## Cross-references

- [`methodology.md`](methodology.md) — AI-maximalist bet this
  productizes
- [`director-pattern.md`](director-pattern.md) — the substrate
  the assistant writes to
- [`extension-architecture.md`](extension-architecture.md) — how
  the assistant ships (one standard extension)
- [`distribution-model.md`](distribution-model.md) — how the
  assistant ships to consumers
- [`subagent-roster.md`](subagent-roster.md) — agents the
  assistant can trigger
- [`validation-pipeline.md`](validation-pipeline.md) — critic
  gates that bind assistant output
- [`mission-control.md`](mission-control.md) — assistant-cost
  metrics surface here
- [`abstraction-discipline.md`](abstraction-discipline.md) —
  provider boundary
