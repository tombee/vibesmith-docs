---
title: 'Scenario-driven development — live UX iteration against any reachable game state'
description: '> **Framework. Game-agnostic.** Specifies a first-class capability: > launch the running game into *any defined state*, hot-reload UX > code without losing...'
---

> **Framework. Game-agnostic.** Specifies a first-class capability:
> launch the running game into *any defined state*, hot-reload UX
> code without losing that state, capture / mutate / save scenarios
> as named entities. The shared substrate for UX iteration, probe
> input, bug reproduction, AI-driven state review, and the AI
> assistant's "show me the thing I'm working on" navigation.

## The pain this solves

UX iteration in a stateful game is structurally broken by default:

- **Storybook-style component isolation** strips away the surrounding
  game state. Components look right in Storybook and wrong in-game
  because the real context (turn number, opponent's hand, partial
  animations, network state) isn't there.
- **In-game scenario browsers built ad-hoc** pollute production
  code with dev-only navigation, decay over time, and each game
  builds its own from scratch.
- **Hand-recreating a bug state** is slow and unreliable. "Get me
  to turn 5 with these cards on board" via the normal play loop
  takes minutes per attempt; iteration burns out.
- **Hot module replacement loses state.** Standard Vite HMR
  reloads with empty / default game state, so iterating on
  mid-game UX means re-driving the game to that state every code
  change.

The framework's scenario-driven dev system is the first-class
answer to all four.

---

## What a scenario is

A **scenario** is an immutable named snapshot containing
everything needed to launch the running game into a specific
state and iterate from there:

```ts
// packages/runtime-introspection/src/scenario.ts
export interface Scenario {
  id: string;                       // 'tcg-turn-5-combat-step-with-blockers'
  name: string;                     // human-readable
  description: string;
  tags: string[];                   // 'tcg', 'combat', 'edge-case', 'bug-repro:#1234'
  game: GameStateSnapshot;          // the full game payload — Zod schema per project
  client: ClientStateSnapshot;      // camera, HUD panels, theme, selection, route
  rngSeed: number;                  // RNG determinism
  clockMs: number;                  // virtual game clock; -1 = "real time"
  network?: NetworkStateSnapshot;   // optional; for projects with replayable networking
  meta: {
    createdAt: string;              // ISO timestamp
    createdBy: string;              // user / agent identifier
    sourceBugId?: string;           // if derived from a bug report
    parentScenario?: string;        // if derived from another scenario (delta chain)
  };
}
```

Scenarios are **JSON files** on disk under
`packages/scenarios/<project>/<scenario-id>.json` (or wherever
each project chooses). The framework provides the **substrate +
contracts**; the project provides the `GameStateSnapshot` Zod
schema (game-specific).

The scenario is **language-agnostic** at the contract layer. A
Rust-backed game writes its server-side state into the
`game.serverState` field via the same schema; the client's
`game.clientState` is JS/TS-shaped. The framework doesn't insist
the game state be authored in TS — it insists on the schema +
file shape.

---

## The capabilities

### 1. Launch into any scenario

The dev shell's `/dev/scenarios` route is the **scenario library**.
Lists every scenario in the project, filterable by tag, with a
preview thumbnail (auto-captured on save). One click "launches"
the game into that scenario:

1. The framework writes the scenario to a known location the
   running game reads on startup.
2. If the game has a remote backend (e.g. riftbound's Rust
   server), the framework posts the scenario's `serverState`
   payload to a dev-only restore endpoint the backend exposes
   (the contract: `POST /dev/restore-state` with the scenario
   payload, returns when state is restored).
3. The client reloads or hydrates to match. The dev shell
   re-mounts with `?scenario=<id>` in the URL.
4. The game runs from that state. The user iterates.

Launch is a **named operation, idempotent, replayable**. The
same scenario always produces the same starting state (RNG seed
is part of the scenario).

### 2. HMR-preserved scenario state

Standard Vite HMR drops state on module reload. The framework's
scenario hook holds the current scenario in a level above HMR's
reach:

- Scenario state lives in a Zustand store that is **persisted to
  `sessionStorage`** on every change.
- The store is **re-hydrated on hot reload** before any other
  effect runs.
- When the user iterates on UX code (a component, a shader, a
  layout), the game state stays exactly where it was. Only the
  UX layer reloads.

When iteration needs game state changes (e.g. "this card text
needs to wrap differently with longer text — let me change a
card's text and reload"), the framework offers **scenario
mutation**:

- Edit a card in the running game via dev tooling
- The framework captures the mutation as a delta against the
  loaded scenario
- The delta is applied to a draft of the scenario in memory
- Save → write back to disk as either an update or a new
  derived scenario

This is the **author-by-direct-manipulation** pattern from
Storybook controls, but applied to *the whole game state*, not
just component props.

### 3. Capture current state as a new scenario

In the in-game dev overlay (see
[`extension-architecture.md`](extension-architecture.md) §
Baked-in dev panels), one button: **Capture scenario**.

When pressed:
- The framework collects the current `GameStateSnapshot` +
  `ClientStateSnapshot` + RNG state + clock
- If the game has a remote backend, the framework hits a
  dev-only `GET /dev/snapshot-state` endpoint to fetch the
  authoritative server state
- The user names the scenario in a modal
- A thumbnail is auto-captured via FrameCapture
- The scenario is written to `packages/scenarios/<id>.json`
- Optionally appended to a tag-filtered shortlist (e.g.
  "current-bug-repros")

Iteration loop: play → notice issue → capture → name → close →
iterate via /dev/scenarios.

### 4. Scenario authoring via the AI assistant

The AI assistant (see [`ai-assistant.md`](ai-assistant.md)) extends
into scenario construction:

User: *"Make me a scenario where I have a hand of weak cards and
the opponent is on lethal next turn."*

Assistant:
1. Reads the project's card pool / archetype rules / current
   meta.
2. Drafts the `GameStateSnapshot` (the hand, opponent board,
   opponent life total set to "lethal-by-X-damage", phase set
   to "opponent main").
3. Proposes the scenario JSON as a tier-2 intervention.
4. User reviews + approves; assistant writes the file + opens it.

This generalizes to: "Make me a scenario from this bug report"
(reads the bug, builds the matching state), "Make me a scenario
that exercises edge case Y" (reads the rules / card-coverage,
builds a synthesis), "Vary this scenario along axis Z" (mutates
an existing scenario along a parameter).

### 5. Probes consume scenarios

The existing two-track probes pattern (`qa-strategy.md`)
already implies inputs. The framework formalizes them:

- A probe declares which scenarios it runs against.
- `just probe-tier0` runs all scenarios tagged `tier0`.
- `just probe-scenario <id>` runs a single named scenario.
- A scenario's pass criteria can be declared inline (`expectations`
  field, optional) or in a sibling assertion file.

Same scenario, three lenses:
- **Probe lens**: assert frame budgets, error counts, expected
  HUD state. Pass / fail.
- **AI-vision lens**: ask a reasoning model whether the render
  + state is coherent (riftbound's `state-review` pattern;
  Tier 1 probes in our taxonomy).
- **UX-iteration lens**: human iterates UX against the scenario.

One file. Three uses.

### 6. Bug reports include their scenario

When a player files a bug via the in-game bug button (see
`bug-reporting.md`), the framework captures a **scenario alongside
the report** automatically. The bug report's payload includes a
scenario JSON file in its attachments.

In dev triage: one click "load scenario from this bug." The
developer is now in the exact state the player was in when they
hit the bug. No recreation.

### 7. Cross-project scenario interchange

Scenarios are JSON. The framework provides:

- A **scenario diff viewer** in the dev shell (compare two
  scenarios; visual + semantic diff).
- A **scenario serializer** that produces a portable bundle
  (scenario JSON + thumbnail + optional video clip + assertion
  results).
- **Scenario manifest** at the project root listing all
  scenarios + their tags + status (canonical / exploratory /
  bug-repro / archived). Generated; not hand-edited.

---

## Implementation surface

| Package | Purpose |
|---|---|
| `@framework/scenario-driven-dev` | Core: scenario schema, persistence, HMR hook, capture/launch APIs |
| `@framework/standard-extensions/scenarios` | Dev shell extension: `/dev/scenarios`, scenario library UI, scenario authoring, diff viewer, manifest browser |
| `@framework/probes-runtime` extension | Scenario-aware probe runner |
| `@framework/ai-assistant` extension | Scenario authoring tool calls |
| Per-project | Project-specific `GameStateSnapshot` Zod schema + restore/snapshot endpoint contract |

The remote-backend integration is contract-only: the framework
defines `POST /dev/restore-state` + `GET /dev/snapshot-state`
schemas; the backend (Rust, Go, Python, whatever) implements
them. The endpoints are dev-only — stripped from prod builds via
backend-side feature flags.

---

## Cross-language contract (Rust backend example)

For a project with a Rust backend:

```rust
// the backend's dev-only restore endpoint
#[cfg(feature = "dev-scenarios")]
async fn restore_state(
    Json(scenario): Json<ScenarioServerPayload>,
) -> Result<()> {
    // Replace the in-memory game state with the scenario payload
    let game_state: GameState = serde_json::from_value(scenario.server_state)?;
    SESSION_DIRECTOR.replace_state(scenario.session_id, game_state).await?;
    Ok(())
}

#[cfg(feature = "dev-scenarios")]
async fn snapshot_state(
    Path(session_id): Path<SessionId>,
) -> Result<Json<ScenarioServerPayload>> {
    let state = SESSION_DIRECTOR.get_state(session_id).await?;
    Ok(Json(ScenarioServerPayload {
        session_id,
        server_state: serde_json::to_value(state)?,
    }))
}
```

The JSON shape on the wire is defined by a shared schema
(`packages/shared-schemas/scenario.schema.json` or per-project).
Rust + TS both validate against it.

---

## What this is NOT

- **Not "save game" for players.** Scenarios are dev-time only.
  Production code paths never see scenario JSON. Backend's
  `restore-state` endpoint is feature-gated and stripped from
  release builds.
- **Not a replacement for the rules engine.** The framework
  doesn't decide what a valid game state is — the rules engine
  (whatever language it lives in) does. The framework persists
  / loads / displays states; the engine validates them.
- **Not a recording / playback system.** Recording a full match
  for replay is a related but distinct capability — scenarios
  are point-in-time snapshots, not action streams. Could
  compose: replay infrastructure could write the scenario at
  every Nth tick + the actions between them.
- **Not a fixture framework for unit tests.** Unit tests live
  where unit tests live (cargo test, vitest); they may *use*
  scenarios as input, but the scenario system isn't built for
  isolated unit-test fixtures.

---

## How this lands for projects already in flight

For a project like riftbound that already has a
`practicetool/server/`, `clientkit`, fixtures under `data/`,
`scenarios/` already implied by parts of the codebase:

1. **Adopt the scenario JSON schema** — define the project's
   `GameStateSnapshot` shape (already mostly defined by the
   engine's `Game` type; add a serde derive).
2. **Implement the two dev endpoints** — `POST /dev/restore-state`
   + `GET /dev/snapshot-state`. Feature-gated.
3. **Migrate existing fixtures** — the scenario corpus that
   already powers the project's testing harness becomes the
   initial scenario library. Probably an importer script that
   reads existing fixture files + emits scenario JSONs.
4. **Wire the dev shell extension** — `/dev/scenarios` becomes
   the entry point for UX iteration; storybook stays for true
   component-isolation work but becomes secondary.

The framework gives the project:
- HMR-preserved iteration against any reachable state
- The same scenarios powering probes / AI-state-review / bug
  repros / UX iteration (single substrate)
- AI assistant scenario authoring
- Cross-project tooling reuse (any framework consumer gets the
  same workflow)

---

## Why this is framework-level, not project-level

The "build it into each game" path means every project re-invents:

- Scenario file format + schema + versioning
- Launch into state plumbing
- HMR-preservation hook
- Capture-current-state UI
- Scenario library browsing UI
- Bug-report-to-scenario linking
- Probe-runs-scenario plumbing
- AI-assistant scenario authoring

That's ~2-3 weeks per project. Multiplied across N projects, the
framework's leverage is real.

More importantly, **the substrate is the same across genres**:
"a snapshot of game state + client state + RNG + clock" is what
*every* stateful game needs. An MMO scenario is "player at this
location with this inventory in this realm at this time"; a TCG
scenario is "this hand, this board, this phase"; a roguelike
scenario is "this dungeon seed at this floor with these items."
Same shape; different `GameStateSnapshot` payload.

---

## Cross-references

- [`qa-strategy.md`](qa-strategy.md) — two-track probes consume
  scenarios as input
- [`extension-architecture.md`](extension-architecture.md) —
  scenario browser is a standard extension; capture button lives
  in the in-game overlay
- [`ai-assistant.md`](ai-assistant.md) — scenario authoring is a
  assistant tool call
- [`bug-reporting.md`](bug-reporting.md) — bug reports include
  their scenario for one-click repro
- [`director-pattern.md`](director-pattern.md) — scenario
  mutation is an intervention shape (a scenario-patch);
  director-task-io substrate handles it
- [`distribution-model.md`](distribution-model.md) — scenario
  schema versioning follows the framework's semver discipline
- [`cross-genre-portability.md`](cross-genre-portability.md) —
  identifies this as one of the highest-value framework
  contributions to non-MMO projects (riftbound's UX iteration
  pain is the canonical example)
