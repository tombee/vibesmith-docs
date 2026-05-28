---
title: 'UI recipes (inventory, dialogue, card grid)'
description: 'Retrieve a game-agnostic UI recipe from recipe canon — inventory grid, dialogue tree, card grid — and adapt its params + fixtures + snapshot contract + accessibility probes into idiomatic React.'
---

vibesmith ships a starter set of **UI recipes** in
`@vibesmith/recipe-canon` for the ui-heavy surfaces almost every
game needs: an inventory grid, a branching dialogue presenter,
and a card-grid layout. They follow the same
*retrieve → adapt → validate* flow as the shader and VFX recipes
— your AI assistant queries the recipe canon, adapts the recipe
to your tokens + slot taxonomy, and the framework validates the
adapted surface against the accessibility probes the recipe
declares.

**These recipes are data, not React.** vibesmith does not ship a
UI runtime or a `<VibesmithButton>` / `<VibesmithPanel>` wrapper.
React stays the runtime; the recipe carries the *manifest* your
assistant reasons about — parameter knobs, fixtures, a snapshot
contract, accessibility probes, and a pointer to a reference
implementation. You write ordinary `<button>` / `<div>` JSX and
reference parts by attribute.

See [UI-heavy consumers](../reference/ui-heavy-consumers.md) for
the full discipline (HUD lifecycle, skin/theme contract,
action-map + focus, the semantic UI manifest layer).

## The three shipped recipes

| Recipe id | Family | What it is |
|---|---|---|
| `ui.inventory.grid` | inventory | cells × slots × stacks grid with drag-drop + stack split/merge |
| `ui.dialogue.tree` | dialogue | branching dialogue presenter walking a node + edge tree |
| `ui.layout.card-grid` | layout | responsive grid of uniform selectable cards (roster / shop / settings tiles) |

> **Card grid is not a card game.** "Card" here means the
> *visual rectangular-card composition* pattern in roster panels,
> shop windows, and settings tiles — not TCG mechanics. It serves
> RPG-shaped detail-card UIs.

## Retrieve a recipe

```ts
import { findRecipes, getRecipe } from '@vibesmith/recipe-canon';

// By intent — ranked, with a scoring breakdown.
const matches = findRecipes({
  category: 'ui-overlay',
  intent: 'an inventory grid I can drag items around in',
});

// Or grab one by id.
const recipe = getRecipe('ui.inventory.grid');
```

Every UI recipe carries:

- **`params`** — game-agnostic knobs (`rows`, `cols`,
  `cellSizePx`, `maxStackSize`, `allowSplit`, …). The preview
  panel renders these as live sliders; your assistant adapts
  their values to your game.
- **`fixtures`** — named example states (empty / partial /
  mixed-stack) the preview cycles through.
- **`probes`** — declared, machine-checkable accessibility
  expectations (every cell focus-reachable, keyboard-equivalent
  drag-drop, per-cell screen-reader labels).
- **`snapshot`** — the keys a deterministic capture records +
  the default state to replay from.
- **`referenceImpl`** — a pointer to the reference React
  implementation you adapt.

```ts
if (recipe?.kind === 'ui') {
  recipe.uiCategory;        // 'inventory'
  recipe.params;            // knob descriptors
  recipe.fixtures;          // example states
  recipe.probes;            // a11y expectations
  recipe.snapshot.keys;     // ['stacks', 'focusedCellIndex', 'heldStack']
  recipe.referenceImpl;     // where the reference impl lives
}
```

## Adapt into idiomatic React

The recipe is the spec; you write the component. Reference parts
by `data-ui-part` so the framework's manifest tooling can find
them without parsing JSX:

```tsx
function InventoryGrid({ rows, cols, stacks, focusedCellIndex }) {
  const cells = Array.from({ length: rows * cols });
  return (
    <div
      data-ui-part="inventory-grid"
      role="grid"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, var(--cell-size))`,
        gap: 'var(--cell-gap)',
      }}
    >
      {cells.map((_, i) => {
        const stack = stacks[i];
        return (
          <button
            key={i}
            data-ui-part="inventory-cell"
            role="gridcell"
            tabIndex={i === focusedCellIndex ? 0 : -1}
            aria-label={stack ? `${stack.itemId} ×${stack.qty}` : 'empty slot'}
          >
            {stack ? <Stack {...stack} /> : null}
          </button>
        );
      })}
    </div>
  );
}
```

Drive the knobs from the recipe's `params` defaults, tune to
feel, and let the snapshot keys (`stacks`, `focusedCellIndex`,
`heldStack`) be the state your component reads and writes — so a
captured snapshot replays deterministically.

## Validate against the probes

Each recipe declares accessibility probes as *intent* — the
framework's probe runner evaluates them against your adapted
instance. Treat them as the acceptance bar:

- **`focus-reachable`** — every part reachable from the entry
  point via `FOCUS_NEXT` / `FOCUS_PREV`.
- **`focus-cycle-returns`** — a full traversal returns to start.
- **`keyboard-equivalent`** — every drag has a pick-up →
  navigate → drop keyboard path.
- **`screen-reader-label`** — every part names its role +
  occupant.

The dialogue recipe adds a **`drag-transition-reachable`** probe
that flags orphan dialogue nodes (a node no edge points at) as a
lint, not a runtime error.

## Watch out for

- **Don't reach for a UI wrapper.** There is no
  `<VibesmithInventory>`. The recipe is data; you own the React.
  Wrapping it defeats the AI-fluency the manifest buys you.
- **Snapshot keys are the contract.** If your component holds
  inventory state somewhere the recipe's `snapshot.keys` don't
  name, replays will drift. Read/write exactly those keys.
- **Card grid ≠ card game.** If you're building TCG mechanics,
  this isn't your primitive — that shape is deferred.
- **Probes are the bar, not decoration.** A surface that fails
  `keyboard-equivalent` or `screen-reader-label` is not done,
  even if it looks right with a mouse.

## Project-local UI recipes

Author your own under `.vibesmith/recipes/` with
`kind: 'ui'` — a signature shop grid, a custom dialogue layout —
and it overrides the framework recipe of the same id for your
project. Same `defineRecipe` factory:

```ts
import { defineRecipe } from '@vibesmith/recipe-canon';
import { registerProjectRecipe } from '@vibesmith/recipe-canon/registry';

export const myShopGrid = registerProjectRecipe(
  defineRecipe({
    id: 'ui.layout.card-grid',  // overrides the framework card grid
    kind: 'ui',
    uiCategory: 'layout',
    description: 'My shop window card grid.',
    snapshot: { keys: ['selectedCardIds', 'focusedCardIndex'], defaultState: {} },
    referenceImpl: './src/ui/ShopGrid.tsx',
    // params / fixtures / probes …
  }),
);
```
