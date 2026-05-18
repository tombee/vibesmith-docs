---
title: 'Inspectable game-script parameters (data-shape coaching)'
description: 'Declare a defineGameScript parameter schema in source as a Zod object; the framework reads it for the inspector panel, your AI assistant reads it as part of the file. One schema, two consumers, zero decoration of your code.'
---

This recipe shows the framework's **data-shape coaching** pattern
in one place: declare your `defineGameScript` parameters as a Zod
object in source, get an inspector panel for free, and keep your
AI assistant fully fluent on the code because the schema lives in
the file the assistant reads.

The pattern works the same for prefab recipes
([`definePrefab`](../reference/prefab-system.md)) — same Zod
schema, same inspector binding, same AI-readable shape.

## The shape

```ts
import { defineGameScript } from '@vibesmith/runtime';
import { z } from 'zod';

defineGameScript({
  id: 'spin',
  parameters: z.object({
    speed: z.number().min(0).max(20).default(3)
      .describe('rotations per second'),
    axis: z.enum(['x', 'y', 'z']).default('y'),
    enabled: z.boolean().default(true),
  }),
  onTick: (ctx, params) => {
    if (!params.enabled) return;
    ctx.target.rotation[params.axis] += params.speed * ctx.dt;
  },
});
```

Bind the script to a scene node in your JSX:

```tsx
<group userData={{ gameScript: 'spin' }}>
  <mesh>
    <boxGeometry />
    <meshStandardMaterial color="orange" />
  </mesh>
</group>
```

## What the framework does with the schema

Three consumers read the same Zod object:

1. **The runtime** reads `parameters` to validate and provide
   defaults to `onTick`.
2. **The inspector panel** (`ScriptParametersPanel`) reads the
   schema to render controls — a 0–20 slider for `speed`, a
   dropdown for `axis`, a checkbox for `enabled`. Min / max /
   default come from the Zod constraints; the description
   becomes the tooltip.
3. **Your AI coding assistant** reads the schema *in the same
   file as the `onTick` body*. When you ask it "add an
   acceleration parameter," it has the full contract in front
   of it — no registry crawl, no schema cross-check, no
   framework-flavoured decorators to learn.

That's the test the framework uses for whether a coaching
mechanism is safe: *does the AI need to leave the file to
understand what a line does?* This pattern keeps the answer
"no."

## Editing in the inspector

When you select the node in the viewport and open the
ScriptParametersPanel:

- **Slider** edits write through to the parameter store at
  runtime; HMR preserves the edit across hot reloads while
  you're iterating.
- The panel shows a **"play-mode edit" banner** when the edit
  is runtime-only (the default — your source file does not
  change).
- For prefab instances (script bound to a prefab whose recipe
  is in `.vibesmith/recipes/`), the panel additionally offers
  a **"Bake to recipe"** action that emits a JSON patch to the
  recipe file. Your JSX is never touched. See the
  [framework's principled non-features](/vibesmith-docs/principled-non-features/)
  for why "never JSX rewrite" is a deliberate stance.

## Watch out for

- **Don't put functions in `parameters`.** A field like
  `onPlayerProximity: () => void` is procedural — it should be
  code inside `onTick`, not a parameter. The framework's
  data-shape rule: *data-shape what is naturally parametric;
  leave what is naturally procedural as code.*
- **Don't add `@param` JSDoc comments hoping the inspector
  reads them.** The inspector reads Zod schemas, not comments.
  Use Zod's `.describe()` (as in the recipe above) for tooltip
  text the inspector can pick up.
- **Don't reach for a separate `inspector-fields.json`** to
  declare controls — the framework treats external schemas
  decoupled from source as an AI-fluency violation. The Zod
  schema in the same file *is* the contract.

## Discoverability for your AI assistant

If you want your assistant to introspect the schema without
opening the file (for a multi-script reasoning task, say), it
can call the `script.inspect(id)` MCP tool — same data, JSON-
Schema shape, no file read needed. The tool surfaces under the
Tier-2 catalog (see the
[MCP tiered surface](/vibesmith-docs/reference/mcp-tiered-surface/)
reference for how Tier-2 deferral works).

## Cross-references

- [Writing a game script](writing-game-scripts.md) — the
  base `defineGameScript` lifecycle without parameters.
- [Prefab system reference](../reference/prefab-system.md) —
  same Zod-schema pattern for prefab recipes.
- [Principled non-features](/vibesmith-docs/principled-non-features/)
  — why Vibesmith never rewrites your JSX (and what it does
  instead).
- [Engine patterns](../reference/engine-patterns.md) —
  Vibesmith's `defineGameScript` parameter schema is the
  framework's analogue of Unity's `[SerializeField]` and
  Bevy's `Reflect`-derived component editing.
