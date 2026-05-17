---
title: 'Positioning — what we are betting on'
description: 'The strategic shape of Vibesmith. The narrow runtime bet, the broad intelligence-layer bet, and why we deliberately are not a code abstraction over multiple game engines.'
---

Vibesmith is not trying to be every framework for every game. The
target is narrow, the bet is specific, the limits are real. This
page states them in one place, so you can decide whether to bet on
the framework today, plan around it for later, or pick something
else.

For a shorter "what you get" intro, start at
[What Vibesmith is](/vibesmith-docs/introduction/). For the
honest picker against neighbouring stacks, see
the [comparisons FAQ](/vibesmith-docs/faq/). This page is the
deeper *why* underneath both.

## The two-layer bet

Vibesmith is two bets stacked.

### Bet 1 — The runtime (narrow, deliberate)

TypeScript + React Three Fiber + Three.js on WebGPU-default,
WebGL 2-fallback, delivered as a desktop editor that opens
project folders plus a Tauri / browser runtime. Web-first by
construction.

This is honestly a **narrow runtime bet** today. Browser games
are a small slice of the games market by revenue. AAA, console,
and native mobile dominate the industry's centre of mass.
WebGPU adoption is still narrow in production. Browser canvas
constrains genres — card games, roguelikes, top-down or 2.5D
RPGs, narrative games, casual multiplayer, simulation,
incremental, puzzle, tactics, and prototypes across any genre
are the natural fit. AAA shooters, open-world at native scale,
or games whose value proposition is "best-in-class rendering"
are not.

The bet is that **AI coding-assistant fluency on idiomatic
TypeScript + R3F + web standards compensates for the
engine-maturity gap** for our target audience (solo developers
and small teams shipping web-deliverable games with AI in the
loop). The corollary: every framework decision that erodes
AI-fluency defeats the reason we chose this stack.

Two tailwinds quietly expand the addressable surface without
the framework widening its bet:

- **Handheld PCs as a platform class.** Steam Deck and
  successors (ROG Ally, Legion Go, MSI Claw) are increasingly
  natural targets for web-distributable games via PWA install,
  built-in Chromium, or Tauri-wrapped Steam distribution.
- **AI-assistant capability trajectory.** If coding-assistant
  quality keeps improving, the productivity advantage of an
  AI-friendly stack widens against engines whose scripting
  layer has a smaller training corpus and more idiomatic
  burden.

If the runtime bet never widens past web, we still serve the
indies who picked it — and the deeper bet survives
independently.

### Bet 2 — The intelligence layer (broad, durable)

Canon substrate, provider abstraction, director pattern,
prefab system, asset catalogue, recipe canon, task-context
contract, MCP surface, critic fleet, scenario substrate.

All of these are **file-based, schema-based,
engine-agnostic at the contract layer.** JSON, JSON Schema,
TOML manifests, MCP tool surfaces. The TypeScript
implementations are *one* binding; the contracts speak the
lingua franca of any backend.

This is the **durable bet**. AI-augmented gamedev needs the
substrate regardless of which engine ultimately delivers the
runtime. Canon, providers, recipes, critics, context bundles
don't care whether the game underneath is React Three Fiber or
something else entirely. They care about *project shape* — and
project shape is engine-independent.

**The runtime is the short-term delivery. The intelligence
layer is the long-arc bet.** If the runtime stays competitive,
we never need to prove the intelligence layer against a second
engine and the architecture costs nothing. If the runtime ever
plateaus, the substrate is built to outlive it.

## The principle that decides everything: portability through architecture, not abstraction

**Game code stays idiomatic.** TypeScript + R3F + Three +
web standards today. Portability is a property of *how* you
structure code, not *what* framework wrappers you import.

Three corollaries follow.

### 1. Encouraged architecture, no framework class to inherit

The patterns Vibesmith documents — a world-model boundary
between game state and renderer, ECS-shape, pure-function
simulation, file/JSON-as-contract, web standards used directly
— are *consumer-side architectural disciplines*. We recommend
them, document them, and design the framework so following them
is the path of least resistance. We don't ship an ECS
framework, a Vibesmith base class, or a parallel runtime API
surface that gates access to engine features.

ECS shape (Bevy, Flecs, Unity DOTS, the Overwatch architecture
talk) is canonical in modern game dev and well-represented in
AI training corpora. Code that follows it gets *portability*
and *AI fluency* for free. We point at the pattern; you hold
the pen.

### 2. Framework APIs pass an AI-fluency test

Every framework-side API — scene-tree components, `ctx.*`
helpers, `defineGameScript`, recipes — defends itself on
**current-day idiomatic value**, not speculative cross-engine
portability.

The test: *would an idiomatic R3F user write this anyway?* If
yes, it passes; the framework is doing the integration work
that the consumer would otherwise have repeated. If the only
defence is "we wrapped this so we could swap engines later,"
it fails — that's portability theatre, and it taxes AI fluency
for no current-day benefit.

### 3. The intelligence layer is contract-shaped, not API-shaped

JSON schemas, file IO, MCP tool surfaces. The engine on the
read side doesn't matter. This is already true for canon,
task-context, scenarios, recipes, prefabs, manifests,
capability declarations, provider knowledge base, and critic
briefs. We keep it that way as the framework grows.

A consumer that adopts only the intelligence layer (and brings
their own runtime) is a first-class user, not a second-class
one.

## Why "encourage architecture" beats "abstract over engines"

Beyond AI-fluency, there's a sharper benefit worth naming:
**similar code shapes across languages enable AI-driven
cross-language translation.**

Consumer game code structured as ECS-shape + a world-model
boundary in TypeScript transfers to a Rust + ECS runtime as a
*mechanical* AI translation. Entities map to entities, systems
to systems, component schemas to component structs. The
semantic shape is preserved across the language boundary
because the structural shape is already aligned with how the
target engine thinks.

If the same code were wrapped in Vibesmith-flavoured framework
APIs (a `vibesmith.scene.spawn()`-style surface, framework base
classes, custom decorators), an AI agent would have to
translate *both* the semantics *and* the structural shape
simultaneously — much harder, much more error-prone, and the
assistant's training corpus for "Vibesmith → other engine" is
empty.

The portability story is therefore: *encourage industry-standard
architecture; let AI agents do the cross-language work.* That's
a current-day benefit for any consumer doing AI-assisted
refactoring or considering a port — not a hypothetical future
payoff.

## Who Vibesmith is for

- **Solo developers and small teams.** Cost-sensitive. Often
  already running local generative tools (ComfyUI, Blender).
  Paying for one coding assistant; unwilling to add many more.
- **TypeScript-fluent, or willing to be.** The runtime stack is
  TS + R3F + Three. AI assistants close most of the
  learning-curve gap; comfort with JavaScript-family languages
  is the floor.
- **Web-distributable targets.** Browser + PWA + Tauri-wrapped
  desktop / mobile. Steam Deck and adjacent handheld PCs are
  first-class. Closed consoles are explicitly out of scope.
- **Genres the browser canvas handles well.** Card games,
  roguelikes, top-down or 2.5D RPGs, narrative games, casual
  multiplayer, simulation, incremental / idle, puzzle, tactics,
  prototypes across any genre.
- **AI-augmented workflows.** The methodology assumes a coding
  assistant is doing meaningful work. The framework still works
  without one; the value proposition shrinks proportionally.

## Who Vibesmith is not for

- Teams shipping a commercial release this year on a stack
  that requires native console output.
- Projects where rendering fidelity ceiling is the value
  proposition.
- Studios with deep existing investment in established native
  engines and no pressure to revisit the choice.
- Developers who don't want AI in the dev loop.
- "I want a no-code experience." Game logic is TypeScript.

The shorter version of this list, plus the picker against
neighbouring stacks, lives in
[What Vibesmith is](/vibesmith-docs/introduction/) and the
[comparisons FAQ](/vibesmith-docs/faq/).

## Bevy as the canonical future engine target

Vibesmith's intelligence-layer-as-durable bet is currently an
architectural property. **Bevy is the canonical future
proving-ground** that would turn it into a demonstrated claim.

Why Bevy specifically:

- **ECS is native, not a discipline.** Bevy is ECS to its
  bones. The world-model boundary Vibesmith encourages on the
  consumer side maps directly. Game state structured as ECS in
  TypeScript transfers to Bevy as a mechanical translation —
  not a semantic rewrite.
- **AI-fluency property holds.** Rust + Bevy is well-represented
  in training corpora, idiomatic, and small-surface — the same
  property that makes TS + R3F good for AI agents makes Bevy
  good for them too.
- **No-abstraction rule holds cleanly.** A TS + R3F consumer
  writes regular TS + R3F. A hypothetical Bevy consumer writes
  regular Bevy Rust. Both would consume the *same* intelligence
  layer over MCP and file contracts. The runtimes don't get
  unified; the substrate above them does.
- **Modularity philosophy matches.** Bevy itself is
  "pick the parts you need." Same shape as Vibesmith's
  intelligence-layer-plus-runtime split.

**The pre-1.0 caveat is honest.** Bevy currently ships with
frequent breaking changes per release, ecosystem maturity is
still building, and there's no LTS story. Committing to Bevy
support now would be premature. The right posture is to **keep
the architecture so Bevy support remains possible** without
paying any cost today, **track Bevy's trajectory** as ongoing
research, and **reassess when 1.0 lands** — or when a
serious consumer surfaces wanting the intelligence layer
against a Bevy client.

This is not a roadmap commitment. It's an architectural
commitment to *stay capable of becoming* a Bevy framework
partner if the conditions arrive — without paying any tax for
that capability today.

## What we deliberately won't do

- **No engine abstraction layer.** No parallel framework API
  that wraps over Three.js / R3F / web standards so the same
  framework calls could "work on either engine."
- **No code generator that emits framework-flavoured code.**
  Scaffolding produces *vanilla* TypeScript + R3F that an
  idiomatic R3F developer would recognise as their own.
- **No proprietary scene format.** Project files are
  JSON / TOML / TypeScript — AI-readable, diff-friendly,
  human-readable.
- **No DSL where vanilla TypeScript would do.** The language
  is the framework; configuration is data; logic is code.
- **No runtime LLM dependency.** AI is design-time
  acceleration, not a runtime feature.
- **No abandoning the architectural rule even when it would
  feel convenient.** Convenience that erodes AI-fluency costs
  the central wager.

## What success and falsification look like

The bet is falsifiable, which is the point of stating it
clearly.

**Signals the bet is paying off:**

- Game code reads as idiomatic TypeScript + R3F. An outside
  reviewer can't tell which parts are "Vibesmith" without
  checking imports.
- AI coding assistants demonstrably iterate faster on Vibesmith
  consumer projects than on comparable native-engine projects.
- Framework APIs survive periodic AI-fluency audits without the
  surface accumulating wrapper layers that fail the test.
- The intelligence layer's contracts remain stable enough that
  a non-TypeScript binding is realistically possible.

**Signals the bet has gone wrong:**

- Consumer code looks "Vibesmith-flavoured" in ways that hurt
  assistant fluency.
- The intelligence layer accumulates TS-only assumptions that
  make cross-engine use impractical without rebuilding contracts.
- Framework APIs start defending themselves on portability
  theatre rather than current-day value.
- Web / handheld-PC distribution viability collapses faster
  than the intelligence-layer bet can compensate.

If you're evaluating Vibesmith for a serious project, these
are the things to watch — both ours and your own as you build.

## Where to read next

- [Introduction](/vibesmith-docs/introduction/) — the friendlier
  "what you get" intro.
- [Comparisons FAQ](/vibesmith-docs/faq/) — vs Three.js, R3F,
  Babylon.js, native engines compiled to the web, and other
  web-native frameworks.
- [Quick start](/vibesmith-docs/getting-started/quick-start/) —
  scaffold a project once positioning lines up.
- [Reference](/vibesmith-docs/reference/) — the technical surface
  the bet rests on.
