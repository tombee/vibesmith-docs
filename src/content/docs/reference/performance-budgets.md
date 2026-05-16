---
title: 'Performance budgets'
description: 'Concrete, measurable, asserted-in-Tier-0 budgets for the running game. Without numbers, "performance matters" is a slogan; with numbers, it''s a regression test.'
---

Concrete, measurable, asserted-in-Tier-0 budgets for the running game.
Without numbers, "performance matters" is a slogan; with numbers, it's
a regression test.

**These are starting calibration targets, not gospel.** First real
probe runs on first real content tell us where the numbers should
actually be. The discipline is committing to *having* budgets and
*asserting* against them from day one; the specific numbers refine
with measurement.

---

## Why this exists from day one

The cost of adding a budget after the codebase has grown is enormous —
violations are everywhere, fixing them all is overwhelming, so the
budget gets relaxed to "where we are now" and stops being a budget.
Establish budgets while there's nothing to measure; they grow with the
project and stay enforceable.

Budgets are **Tier 0 assertions** in `qa-strategy.md`. They run in CI.
A PR that blows a budget either fixes the regression or argues for a
budget change in the PR description (gated by `perf-budget-critic`
when that agent lands).

---

## Starting targets

Two columns: desktop and mobile. "Hard cap" is the value at which the
Tier 0 assertion fails — set higher than the target to give some
breathing room.

| Metric | Desktop target | Mobile target | Hard cap |
|---|---|---|---|
| Frame time | 16.6 ms (60 FPS) | 33.3 ms (30 FPS) | 50 ms |
| Draw calls / frame | 200 | 100 | 500 |
| Triangles / frame | 500 k | 150 k | 1 M |
| Texture GPU memory | 256 MB | 128 MB | 512 MB |
| Geometry GPU memory | 64 MB | 32 MB | 128 MB |
| Startup → interactive | 3 s | 5 s | 8 s |
| Initial JS (gzipped) | 500 KB | 500 KB | 1 MB |
| Per-zone asset payload (cumulative on entry) | 20 MB | 10 MB | 50 MB |
| Network bytes / second / client | 5 KB/s | 5 KB/s | 50 KB/s |
| Server tick processing time | 50 ms | n/a | 200 ms |
| Memory drift across zone transitions | 0 | 0 | < 5 MB / 10 transitions |
| Time-to-input on click-to-move | 100 ms | 150 ms | 300 ms |
| WebSocket reconnect latency | 1 s | 2 s | 5 s |

Notes:

- **Mobile = mid-tier mobile.** Top-end phones beat desktop targets;
  we don't assert against them. Bottom-end (≥ 3 years old, low-end
  Android) won't hit the mobile target on a complex zone — that's the
  accepted trade-off for the platform.
- **Per-zone payload is cumulative** — entering a zone pulls assets;
  the cap is the total budget for one zone's full visual content.
- **Memory drift** is the leak indicator. Steady-state across zone
  transitions is the bar; anything trending up is a defect.
- **Time-to-input** is from click-event to first-server-confirmed
  action visible on-screen. Client prediction makes the *visual*
  response near-zero; this measures perceived responsiveness end-to-end.

---

## How budgets attach to scenes

Different scenes have different budgets. A single-building scene
absolutely should hit lower draw-call and triangle numbers than a
populated village. Budgets are tagged per scene-kind in
`packages/probes/budgets.ts`:

```ts
export const budgets = {
  default: { /* the table above */ },
  scenes: {
    'building-proof': {
      drawCalls: { target: 50, hardCap: 100 },
      triangles: { target: 100_000, hardCap: 200_000 },
    },
    'village-vertical-slice': {
      drawCalls: { target: 300, hardCap: 700 },
      triangles: { target: 800_000, hardCap: 1_500_000 },
    },
    'region-overview': {
      drawCalls: { target: 500, hardCap: 1_000 },
      triangles: { target: 1_500_000, hardCap: 3_000_000 },
    },
  },
};
```

Probes resolve the budget for their scene + viewport (desktop/mobile)
when asserting. Missing-scene falls back to default with a warning so
new scenes don't bypass budgets silently.

---

## Tier 0 assertion shape

Budgets are read by `packages/probes/assertions/perf.ts`:

```ts
export const perfAssertions = {
  withinFrameBudget: (cap, sceneKind, platform) => {
    const b = budgetFor(sceneKind, platform);
    return cap.render.frameTimeMs <= b.frameTime.hardCap;
  },
  withinDrawCallBudget: (cap, sceneKind, platform) => {
    const b = budgetFor(sceneKind, platform);
    return cap.render.drawCalls <= b.drawCalls.hardCap;
  },
  withinTriangleBudget: (cap, sceneKind, platform) => { /* … */ },
  withinTextureMemoryBudget: (cap, platform) => { /* … */ },
  noMemoryDrift: (caps: FrameCapture[]) => {
    /* assert geometry/texture counts don't grow across captures */
  },
  startupBelowBudget: (bootCap, platform) => {
    /* boot probe records timeToInteractive */
  },
};
```

Each is a pure function on `FrameCapture` plus context. No LLM, no
vision, no flakiness. Same probe runs catch regressions on every PR.

---

## Calibration

Budgets refine with measurement. Discipline:

1. **First probe run on first real content** — record actuals.
2. **Set targets at actuals + 20% headroom** for the project's first
   serious content.
3. **Set hard caps at actuals + 100%** to leave room without inviting
   silent regressions.
4. **Re-calibrate at milestone gates** — every release tag, review
   actuals vs budgets; if actuals have shifted, either fix the
   regression or raise the budget with documented reason in PR.

Don't let budgets drift up reflexively. A budget that only ever rises
isn't a budget.

---

## What blowing a budget means

- **Soft target exceeded but under hard cap:** Tier 0 passes, but the
  probe emits a *warning* finding into the issue feed. Visible, not
  blocking. Accumulating warnings is a signal to bring it up at the
  next milestone review.
- **Hard cap exceeded:** Tier 0 fails, PR blocked at CI. Fix the
  regression or argue for a budget change in the PR — `perf-budget-critic`
  agent reviews the argument. Default disposition is "fix the
  regression."

---

## What this doc explicitly does NOT do

- Bless specific render techniques or shaders. Budgets care about
  output (draw calls, frame time), not how it was achieved.
- Set numbers we have no measurement basis for as gospel. The starting
  targets are educated guesses calibrated against rough the chosen asset pack content
  size + a 60-FPS desktop target. First measurement matters more than
  this table.
- Cover server-side scaling budgets (concurrent connections per node,
  Postgres queries/sec, etc.). Those land when sharding lands and
  there's a real workload to size against.

---

## Roadmap

1. `packages/probes/budgets.ts` skeleton with the default table.
2. `withinFrameBudget` + `withinDrawCallBudget` + `withinTriangleBudget`
   assertions wired into the `boot` and `composition-render` probes.
3. Memory-drift probe (`memory-leak` from qa-strategy.md catalogue) —
   10 zone transitions, assert steady-state.
4. Per-scene budget overrides land as new scenes do.
5. `perf-budget-critic` agent lands when first PR shifts a budget.
6. Re-calibrate after first content milestone.
