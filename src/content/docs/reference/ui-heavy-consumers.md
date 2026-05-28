---
title: 'UI-heavy consumers — umbrella spec for Track UI-1'
description: 'Umbrella spec for ui-heavy vibesmith consumers: HUD lifecycle, inventory grids, dialogue trees, menu / card layouts, skin / theme contract, action-map + focus. The six discipline pillars, the semantic UI manifest layer, the recipe-canon category, the preview extension, the proving-ground consumer (rpg-inventory-foundation), the reconstruction spike, and the principled non-features the framework refuses to ship.'
---

> **Framework. Game-agnostic.** Umbrella spec for the discipline a
> ui-heavy vibesmith consumer follows: HUD lifecycle, inventory
> grids, dialogue trees, menu / card layouts, skin / theme
> contract, action-map + focus. Slices 9–15 of Track UI-1
> instantiate the pillars below as recipes, preview surface,
> manifest contract, proving-ground consumer, and reconstruction
> spike.

## Why this exists

Plenty of vibesmith consumers carry significant 2D-UI weight on
top of the 3D scene the framework was first shaped around. An
action-RPG ships an inventory grid, a dialogue presenter, a skill
bar, a settings menu, a quest journal, and a pause overlay before
it ships a single boss fight. A roguelike adds an item grid + a
spell book + a run-summary screen. An MMO-shaped consumer adds
chat + party UI + a trade window on top of the same baseline.
None of these are 3D problems; all of them are framework
problems if the framework wants the AI authoring loop to apply
to UI work the way it applies to scenes.

UI-1 is the framework's answer. The track does *not* ship a UI
runtime, a JSX/CSS converter, or a port of a heavyweight engine's
UI builder. It ships the **discipline** ui-heavy consumers
follow + the **substrate** the framework's AI surfaces (cmd+P,
chat, MCP, proactive tips) need to reason about UI work without
round-tripping through React source.

> **What "ui-heavy" means.** A consumer whose UI surface area is
> a first-class part of the gameplay loop, not a thin chrome over
> a 3D viewport. RPG / action / roguelike / MMO-shaped consumers.
> Examples this spec assumes: an inventory grid where slot
> identity matters, a branching dialogue presenter, a hotbar with
> cooldown UI, a settings menu the player navigates with gamepad
> as cleanly as with mouse.

## Discipline pillars

Six pillars; slices 9–15 instantiate each.

### 1. HUD lifecycle

Spec: [HUD lifecycle](/vibesmith-docs/reference/hud-lifecycle/).

- **Scene-scoped is the default.** Player status, hotbar,
  dialogue presenter, mini-map, compass — every contextual HUD
  is a `<Hud id="…">` scene-graph node + `defineSceneHud`
  registration. Mounts when the scene loads; unmounts when it
  unloads. The cross-engine default (Unity Canvases in scenes,
  Godot CanvasLayer + Control nodes in scenes, Unreal widgets
  at the Level level) so AI assistants generate the right shape
  on first try.
- **Project-global persistent is the explicit tier.** Splash,
  cross-scene loading transitions, persistent score bars, dev
  overlays — `defineGlobalHud`. Named at the call site so a
  reader (human or AI) can answer "does this survive a scene
  change?" without crawling the registry.
- **Hierarchy panel surfaces both tiers** with `[scene-hud]` /
  `[global-hud]` badges. Selection / inspector integration
  shipped as a sibling slice.
- **HUD ids follow `<owner>/<surface>`** — framework HUDs use
  `vibesmith/<surface>`; consumer-game HUDs use
  `<game-id>/<surface>`. Regex enforced; soft-warned today,
  hard-error in a future release.

UI-1 inherits this pillar wholesale; subsequent slices don't
re-litigate it.

### 2. Inventory grids

A recipe-canon category. Spec deferred to the recipe schemas;
this section names the shape.

- **Semantic vocabulary.** Cells (the grid positions), slots
  (the typed receptacles — `weapon-main-hand`, `consumable`,
  `armor-chest`), stacks (the multi-quantity occupant of a
  slot). The vocabulary stays the same across consumers; what
  varies is the slot type taxonomy, stack-size caps, and
  drag-drop rules.
- **Drag-drop discipline.** Sources, targets, accept/reject
  predicates, on-drop side-effects (consume stack, swap, split,
  merge). Recipe-canon entries declare the predicate + side-
  effect shape, not the implementation; the framework probes
  validate the declared transitions are reachable from each
  start state.
- **Accessibility-first.** Every slot has a focus position;
  every drag operation has a keyboard equivalent (pick up →
  navigate → drop); every cell carries a screen-reader label
  that names its slot + occupant.
- **Recipe-canon category**: `ui.inventory.grid`,
  `ui.inventory.equipment-paperdoll`, `ui.inventory.stash-tab`.

### 3. Dialogue trees

A recipe-canon category. Pairs with the future quest substrate
when that lands.

- **Node + edge shape.** Nodes carry speaker + line + optional
  preconditions; edges carry choice text + postconditions +
  optional quest-state mutations. Trees serialise as JSON; AI
  assistants author them through cmd+P recipes that round-trip
  to the same shape designers edit by hand.
- **Branch resolution.** A node's outgoing edges are filtered
  by precondition evaluation against the active game state +
  the quest registry; the surviving set is what the player
  sees. Unreachable branches surface as a lint, not a runtime
  error.
- **Quest substrate integration.** A dialogue edge can carry a
  `questOp` (accept / progress / complete / fail) that resolves
  through the quest substrate's `ctx.quest` API; canon-vault
  references resolve the same way they do anywhere else.
- **Recipe-canon category**: `ui.dialogue.tree`,
  `ui.dialogue.barks` (context-tied one-liners, paired with the
  NPC substrate's bark substrate when it lands).

### 4. Menu / card layouts

A recipe-canon category. The framework ships *semantic* layout
primitives, not a JSX/CSS abstraction.

- **Anchored panels.** A panel declares its anchor (top-left,
  centre, bottom-right, …) + offset + size constraints; the
  framework probes verify the panel stays on-screen at every
  supported aspect ratio.
- **Flex rows / columns.** Familiar HTML/CSS vocabulary, named
  in the manifest so a probe can ask "what's the focus order in
  this row?" without parsing JSX.
- **Modal layers.** A modal declares its focus-trap scope + the
  surface it dims behind + the escape-key target. Stack semantics
  (one modal opens another) live in the manifest.
- **Recipe-canon category**: `ui.menu.settings`,
  `ui.menu.pause`, `ui.menu.run-summary`, `ui.layout.card-grid`,
  `ui.layout.list-detail`.

> **Card-layout note.** "Card layout" here means the *visual*
> rectangular-card composition pattern common in settings menus,
> shop windows, and party-member roster panels — not the
> mechanics of card games. The layout primitive serves
> RPG-shaped roster / detail-card UIs.

### 5. Skin / theme contract

Asset-side validation for the surfaces the previous pillars
declare. Idiomatic React + HTML, CSS-var design tokens, normal
HUD asset bytes — no in-canvas player-UI abstraction.

- **9-slice frames.** Manifest declares insets + asset address;
  validation probe verifies the address resolves + the insets
  fit within the asset bounds.
- **Icon sets.** Per-theme icon address tables (`icon:coin`,
  `icon:inventory`, …); missing-icon diagnostic surfaces in
  the editor + the capture.
- **Button states.** `enabled` / `hover` / `active` / `disabled`
  / `focus` — five-state sprite addresses per button variant
  the manifest declares; validation walks every declared
  variant.
- **Font references.** Self-hosted; manifest names the family +
  weight + variant axes.
- **Colour tokens.** CSS custom properties on `:root`; manifest
  names the tokens the surface consumes so a theme-swap probe
  can verify every referenced token resolves.

### 6. Action-map + focus

Closes the gap engine UI systems (Unity's UI Toolkit, UE's UMG)
own well — *focus + gamepad + input-mode switching* — with
**explicit data and probes**, not a runtime clone.

- **Semantic actions.** Surface declares the actions it accepts
  (`CONFIRM`, `CANCEL`, `OPEN_INVENTORY`, `FOCUS_NEXT`,
  `FOCUS_PREV`, …); manifest names default bindings per
  modality (keyboard / pointer / gamepad). Consumer-owned
  rebinding consumes the same manifest.
- **Focus graph.** Per surface, the focus-zone declarations +
  the focus-traversal edges. Probes verify every focusable
  part is reachable from the surface's entry point and that
  the traversal returns to start after a full cycle.
- **Probeable accessibility expectations.** Min touch-target,
  screen-reader label, `aria-busy` sentinel during loading
  states.
- **What it's not.** A full Unity Input System clone, a global
  rebinding UI, a gesture-recognizer suite, or an event-wrapper
  API. The manifest documents semantics; the runtime stays
  React event handlers + direct gamepad-API reads.

## The semantic UI manifest layer

The durable contract for player-facing UI is **a manifest of
meaning**, not the React component tree itself.

What it is:

- **JSON-shaped declaration** of screens / surfaces / parts /
  roles / states / tokens / fixtures / probes / input actions /
  focus graph.
- **Authored as TS-as-data** (`defineUiSurface({ … })`) so the
  consumer's TypeScript surface stays idiomatic; the JSON shape
  is what tools read.
- **AI-fluent by construction.** Field names + nesting picked
  so AI assistants can synthesise / inspect / edit consumer-side
  UI work from the manifest without round-tripping through JSX
  source.
- **The future-engine reconstruction substrate.** A native-engine
  port consumes the manifest + fixtures + skin assets + probes
  as a build spec; portability is *guided rebuild from durable
  meaning*, not mechanical JSX conversion.

What it's not:

- **Not a UI runtime.** React renders the UI; the manifest
  describes it.
- **Not a JSX/CSS converter.** Reconstruction is a guided human
  + AI workflow, not an automatic translation.
- **Not a Unity Input System / UMG / UI-Builder clone.** The
  manifest names input actions + focus edges; it does not own
  input dispatch or layout solving.
- **Not a wrapper over React/R3F.** No `<VibesmithButton>`,
  `<VibesmithPanel>`. The consumer writes ordinary
  `<button>` / `<div>` JSX; the manifest references parts by
  `data-ui-part` attribute or equivalent.

The manifest exists so the framework's cmd+P, chat panel, MCP
tools, and proactive ledger can answer:

- What screens / states exist?
- Which parts are semantic controls vs decoration?
- Which design tokens + skin assets does this surface consume?
- Which input actions + focus transitions does this surface
  expect?
- Which fixtures + probes prove this surface works?

## Recipe-canon category

Instantiates the recipe-canon retrieve-adapt-validate flow for
ui-heavy work.

Recipe families (≤ 8 starter entries across the category):

- **Inventory.** `ui.inventory.grid`,
  `ui.inventory.equipment-paperdoll`,
  `ui.inventory.stash-tab`.
- **Dialogue.** `ui.dialogue.tree`, `ui.dialogue.barks`.
- **Menus + layouts.** `ui.menu.settings`, `ui.menu.pause`,
  `ui.layout.card-grid`.
- **Drag-drop.** `ui.drag-drop.slot-to-slot`,
  `ui.drag-drop.split-stack`.
- **Accessibility patterns.** `ui.a11y.focus-trap-modal`,
  `ui.a11y.keyboard-drag-drop`,
  `ui.a11y.gamepad-radial-menu`.

Each recipe ships parameter schema + reference implementation +
quality references + acceptance probes. Consumers
retrieve-adapt-validate the same way they would for a VFX or
shader recipe — the AI assistant queries the recipe canon,
adapts to the consumer's tokens + slot taxonomy + animator
hooks, and the framework runs the validation probes against the
adapted instance.

**Shipped starter set.** `@vibesmith/recipe-canon` adds a
`kind: 'ui'` recipe variant + a game-agnostic starter set:
`ui.inventory.grid`, `ui.dialogue.tree`, `ui.layout.card-grid`.
A UI recipe is **data, not React** — it carries `params`
(game-agnostic knobs), `fixtures` (named example states),
`probes` (machine-checkable accessibility + layout
expectations), a `snapshot` contract (capture keys + default
replay state), and a `referenceImpl` *pointer* you adapt into
idiomatic React. See the
[UI recipes cookbook](../cookbook/ui-recipes.md) for the
retrieve → adapt → validate worked example.

## Preview extension

Sibling of the `tsl-preview` + `vfx-preview` standard extensions.

- **Parameter sliders.** Every recipe parameter (grid dimensions,
  slot taxonomy, focus-order, animation easing) gets a live
  slider; the preview re-renders against fixtures from the
  manifest.
- **Diff preview.** Before / after view across a parameter
  change or recipe-edit suggestion from the AI assistant.
- **Fixture switcher.** The manifest declares fixtures per
  surface (empty inventory, full inventory, mixed-stack
  inventory); the preview cycles through them.
- **Accessibility overlay.** Toggle that paints the focus
  graph + tab order + min-touch-target boxes over the rendered
  surface; probe failures surface as red callouts.

The preview extension is the human-gate the methodology's
AI-maximalist mandate demands for every AI-authored or
AI-edited UI surface.

## Proving-ground consumer

The example app that exercises every pillar end-to-end.

**Name.** `examples/rpg-inventory-foundation`. Game-agnostic
3D-leaning RPG-shaped consumer — no named realms, no character
names, no specific genre flavouring beyond "RPG with inventory,
dialogue, and a hotbar."

**Minimum surface coverage.**

- **Inventory grid.** Multi-row grid with weapon / armor /
  consumable slot types; drag-drop within the grid + to/from a
  paperdoll panel; stack splitting on shift-drag.
- **Dialogue presenter.** A questgiver NPC with a three-branch
  dialogue tree; accept-quest branch routes through the quest
  substrate's `ctx.quest` (or a substrate stub if the quest
  substrate hasn't shipped yet).
- **Hotbar / skill bar.** Eight-slot ability bar (per the
  [player-controller.ability-bar](/vibesmith-docs/reference/) recipe);
  cooldown UI; keyboard 1–8 + gamepad face-button bindings.
- **Settings menu.** A pause-menu modal with focus-trap; key
  rebinding row that consumes the action-map manifest; theme
  selector that swaps skin assets via the skin / theme contract.

The proving-ground is the canary. A pillar that doesn't ship a
surface the proving-ground exercises is not done. The consumer
exists to prove framework features are real — it is not the
design driver.

## Reconstruction spike

The portability claim UI-1 makes.

The claim: a UI-heavy surface declared through the manifest
contract is **portable to a native-engine UI system via guided
reconstruction**. Not via automatic JSX/CSS translation.

**What success looks like.** An AI assistant, given the
manifest + fixtures + skin assets + probes for one
proving-ground surface (the inventory grid is the obvious
candidate), can rebuild that surface in a native-engine UI
system (Unity UI Toolkit, Godot Control nodes, Unreal UMG —
pick one for the spike) such that:

- every declared screen / state is reachable;
- every declared part renders with the declared skin asset;
- every declared input action is bound to the equivalent
  native-engine input;
- every declared focus edge is traversable;
- every declared fixture loads;
- every declared probe passes against the rebuild.

**What success does not require.** Pixel-identical rendering.
One-to-one CSS rule translation. Automatic React-to-native
codegen. Known losses (a CSS gradient that doesn't translate
cleanly, a focus-traversal edge case the native system handles
differently) are called out explicitly in the spike's report.

This is the falsification signal for the *portability through
architecture, not abstraction* principle as it applies to
ui-heavy work.

## What ui-heavy work is NOT

Principled non-features. The framework explicitly does not ship:

- **A UI runtime.** React is the runtime. The framework adds
  intelligence around it, not abstraction on top of it.
- **A JSX/CSS-to-native converter.** Portability is guided
  reconstruction from manifest + fixtures + assets + probes.
  Mechanical translation pretends a problem is solved that
  isn't.
- **A Unity Input System / UMG / UI-Builder clone.** The
  action-map + focus manifest is *thin*: semantic actions,
  default bindings, focus edges. Input dispatch + layout
  solving stay with React + the gamepad API.
- **A card-game framework.** UI-1 serves RPG / action /
  roguelike / MMO-shaped consumers.
- **A wrapper over React / R3F primitives.** No
  `<VibesmithButton>` / `<VibesmithPanel>` / `<VibesmithModal>`
  abstraction layer. Consumers write idiomatic React; the
  manifest references parts by attribute.
- **A visual UI builder.** The dev-shell's preview extension
  is a *review* surface (parameter sliders + diff preview +
  fixture switcher), not an authoring surface that hides
  source.
- **Generic web-platform wrappers.** The framework doesn't
  re-wrap things the web platform already does well (CSS
  variables, `border-image`, `prefers-reduced-motion`, flex
  layout, `:focus-visible`). The manifest references them by
  their web-standard names.

## Cross-references

- [HUD lifecycle](/vibesmith-docs/reference/hud-lifecycle/) —
  authoritative spec for pillar 1.
- [Engine patterns](/vibesmith-docs/reference/engine-patterns/)
  — Unity / Godot / Unreal equivalence rows; UI / HUD row.
- [Scenario-driven dev](/vibesmith-docs/reference/scenario-driven-dev/)
  — the scenario substrate that captures + replays every
  ui-heavy surface's state.
