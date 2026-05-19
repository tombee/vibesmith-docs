---
title: 'QA + playtest strategy'
description: 'vibesmith framework reference: QA + playtest strategy.'
---

## The bet

**AI handles every bug a machine can catch. Humans are scarce; reserve
them for finding places to make the experience better and more fun.**
Players never get annoyed by obvious defects, because automated QA found
them first. Human playtest sessions are about *taste, polish, emergent
behaviour, fun discovery* — not "the dialogue panel is invisible."

This is a methodology commitment, not a tooling note. It shapes what we
build, when, and what gets gated on what.

---

## Hard learning — text beats images for AI QA

From prior work in `~/riftbound`: **image-based AI QA is limited**. LLM
vision is great for taste judgments and bad for regression detection:

- **Non-deterministic.** Same screenshot → different verdict on different
  invocations. Vision models hallucinate "looks fine" or invent flaws.
- **Imprecise.** Off-by-pixel layout, subtly-clipped text, wrong colour
  by 5% — vision can't reliably catch them. State queries can.
- **Expensive.** Vision tokens cost much more than text; round-trip is
  slower; you can't run thousands per CI build.
- **Diagnostically poor.** "Looks wrong" doesn't tell you *what* is wrong.
  A failing text assertion does.

**Text-based telemetry that captures render-state alongside game-state**
is dramatically more reliable for regression detection. Most things that
seem visual ("is the UI panel showing?", "is the building rendered?",
"does the text say the right thing?") reduce cleanly to assertions on
captured state — no pixels needed.

**Where vision still earns its cost:** subjective taste calls (does
this feel like a the target village aesthetic? is the lighting tonally right?).
Those are design-time critique, not regression detection. Different
job, different tier.

---

## Four tiers (cost × purpose)

| Tier | What | LLM? | Determinism | Cost | When | Catches |
|---|---|---|---|---|---|---|
| **0 — Static** | Pure-function assertions on composition + game-state + render-state snapshots | No | Deterministic | Free | Every PR; pre-merge gate | "Building not placed", "no overlapping buildings", "dialogue panel state.visible=false after intent", "draw calls > budget" |
| **1 — Text-judged** | LLM judges over structured text dumps (composition + state + telemetry) | Yes (text) | High (cacheable, low temperature) | Cheap | Per-milestone; or on dev request | "Village feels too uniform across seeds", "this conversation flow has dead-ends", "NPC placement clusters at edges" |
| **2 — Vision-judged** | LLM vision over rendered frames | Yes (vision) | Low | Expensive | Dev-triggered, never CI | Tonal / aesthetic critique; art-direction adherence; "does this *feel* right" |
| **3 — Human** | Live playtest | n/a | n/a | Scarce | Milestone gates | Fun, frustration, emergent behaviour, narrative resonance — things only humans recognise |

**Hard rule, carried from MyProject:** **no LLM in CI / hooks /
scheduled jobs.** Tier 1 and Tier 2 are explicit, developer-triggered,
during active development. CI runs Tier 0 only. Cost predictability,
no surprise bills, no LLM dependency on the critical merge path.

---

## Frame capture — the canonical telemetry shape

Every probe captures a single JSON blob per checkpoint. This is the
universal substrate the tiers all consume.

```ts
// packages/probes/schemas/frame-capture.ts
export const FrameCapture = z.object({
  meta: z.object({
    probeId: z.string(),
    seed: z.number(),
    timestamp: z.string(),
    gitSha: z.string(),
    checkpoint: z.string(),     // 'before-interaction' | 'after-walk' | …
  }),

  // What the renderer is doing
  render: z.object({
    drawCalls: z.number(),
    triangles: z.number(),
    geometries: z.number(),
    textures: z.number(),
    programs: z.number(),
    frameTimeMs: z.number(),
    gpuTimeMs: z.number().optional(),  // EXT_disjoint_timer_query when available
    memory: z.object({
      geometries: z.number(),
      textures: z.number(),
    }),
    pixelRatio: z.number(),
    viewport: z.object({ width: z.number(), height: z.number() }),
  }),

  // The scene tree flattened
  scene: z.object({
    nodeCount: z.number(),
    nodes: z.array(z.object({
      id: z.string(),                   // userData.entityId or generated
      name: z.string(),
      type: z.string(),                 // 'Mesh' | 'Group' | 'Light' | 'PerspectiveCamera' …
      visible: z.boolean(),
      inFrustum: z.boolean(),
      position: Vec3,
      rotation: Vec3,
      scale: Vec3,
      worldPosition: Vec3,
      boundsMin: Vec3.optional(),
      boundsMax: Vec3.optional(),
      assetKey: z.string().optional(),
      materialId: z.string().optional(),
      animationState: z.object({
        current: z.string(),
        time: z.number(),
        weight: z.number(),
      }).optional(),
      tags: z.array(z.string()),
    })),
  }),

  // Where the camera is looking
  camera: z.object({
    position: Vec3,
    rotation: Vec3,
    fov: z.number(),
    near: z.number(),
    far: z.number(),
    viewMatrix: z.array(z.number()).length(16).optional(),
  }),

  // What the player would see (frustum-culled subset of scene.nodes)
  visible: z.object({
    entityIds: z.array(z.string()),
    occluded: z.array(z.string()),      // in scene + in frustum but blocked
    nearestInteractable: z.string().optional(),
    nearestInteractableDist: z.number().optional(),
  }),

  // HUD / DOM-side state
  hud: z.object({
    panels: z.array(z.object({
      id: z.string(),
      visible: z.boolean(),
      content: z.string(),               // text content only
      computedOpacity: z.number(),
      computedBounds: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
    })),
    focusedElement: z.string().optional(),
  }),

  // Game state — Colyseus room state at this tick (filtered to relevant)
  game: z.object({
    tickNumber: z.number(),
    player: z.object({
      position: Vec3,
      rotation: Vec3,
      animationState: z.string(),
      hp: z.number(),
      inventory: z.array(z.unknown()),
    }),
    npcs: z.array(z.object({ id: z.string(), position: Vec3, state: z.string() })),
    threads: z.array(z.object({ id: z.string(), state: z.string(), currentBeat: z.string() })),
    activeDialogue: z.object({ speaker: z.string(), line: z.string() }).optional(),
  }),

  // Intent log — discrete events since last capture
  intents: z.array(z.object({
    ts: z.string(),
    type: z.string(),                    // 'click', 'interact', 'thread-beat-complete' …
    payload: z.unknown(),
  })),

  // What the test expected
  expectations: z.array(z.object({
    description: z.string(),
    predicate: z.string(),               // JSON path / expression for traceability
    expected: z.unknown(),
    actual: z.unknown().optional(),      // filled in by Tier 0
    pass: z.boolean().optional(),
  })),

  // Optional vision artifact for Tier 2 only — captured but rarely sent
  framePngPath: z.string().optional(),
});
```

**Critically: the screenshot is *optional*.** Most probes don't capture
one. Tier 0 and Tier 1 work entirely on the JSON; Tier 2 (visual
critique) is the only one that consumes pixels, and only on dev demand.

Capture is implemented as `window.__captureFrame()` exposed by the
client in dev/probe builds. Playwright calls it after triggering test
actions; result is returned as JSON, written to the probe artifact dir.

### Cross-genre note — optionality of the 3D blocks

The `render`, `scene`, `camera`, and `visible` blocks are
**3D-renderer-shaped**: they assume a GPU-bound scene-graph client
(Three.js / R3F / Babylon / similar). A TCG client, a 2D
authoritative-server game, or a card-only renderer doesn't have draw
calls, frustum culling, or perspective FOV — those blocks are
*optional* on the envelope.

Consumers declare what they're capturing via
`meta.renderingKind: 'webgl' | 'webgpu' | 'canvas2d' | 'dom-only' |
'server-only' | 'none'`; probes only populate the blocks that apply.
This shipped in framework schema v2 (`FRAME_CAPTURE_SCHEMA_VERSION`
in `@vibesmith/runtime-introspection`). Pre-v2 captures interpret as
v2 unchanged: the 3D blocks were already present, so they parse;
new non-3D consumers omit them.

The `meta.renderingKind` discriminator is the right surface for tools
to key off when deciding which assertions are applicable; tier-0
assertions that touch `render.drawCalls` should guard on
`renderingKind === 'webgl' || 'webgpu'`.

---

## Tier 0 — deterministic assertions

Pure functions on `FrameCapture`. The bulk of QA volume. Cheap, fast,
exhaustive, machine-reviewable.

**Assertion library** (`packages/probes/assertions/`):

```ts
export const sceneAssertions = {
  entityExists: (cap, id) => cap.scene.nodes.some(n => n.id === id),

  entityVisible: (cap, id) => {
    const n = cap.scene.nodes.find(x => x.id === id);
    return n?.visible && n?.inFrustum;
  },

  entityAt: (cap, id, expected, tolerance) =>
    distance(findEntity(cap, id).worldPosition, expected) <= tolerance,

  noOverlapping: (cap, ids) => {
    /* AABB intersection across pairs */
  },

  drawCallBudget: (cap, max) => cap.render.drawCalls <= max,

  triangleBudget: (cap, max) => cap.render.triangles <= max,

  frameBudget: (cap, maxMs) => cap.render.frameTimeMs <= maxMs,

  noLeakAcrossCaptures: (caps) => {
    /* memory.geometries / textures should not grow unbounded
       between zone transitions */
  },
};

export const hudAssertions = {
  panelVisible: (cap, panelId) => {
    const p = cap.hud.panels.find(x => x.id === panelId);
    return p?.visible && p?.computedOpacity > 0;
  },

  panelContains: (cap, panelId, text) => {
    const p = cap.hud.panels.find(x => x.id === panelId);
    return p?.content.includes(text);
  },

  noOverlappingPanels: (cap) => { /* compute hud bbox intersections */ },
};

export const gameAssertions = {
  playerAt: (cap, expected, tolerance) =>
    distance(cap.game.player.position, expected) <= tolerance,

  threadAtBeat: (cap, threadId, beat) =>
    cap.game.threads.find(t => t.id === threadId)?.currentBeat === beat,

  intentFired: (cap, type) => cap.intents.some(i => i.type === type),

  dialogueSpoken: (cap, speaker, snippet) =>
    cap.game.activeDialogue?.speaker === speaker &&
    cap.game.activeDialogue?.line.includes(snippet),
};
```

A probe is just a sequence: `setup → action → capture → assert →
action → capture → assert`.

```ts
// packages/probes/scenarios/example-thread.probe.ts
export default probe('example-thread', async (ctx) => {
  await ctx.loadScene('example-village', { seed: 42 });
  await ctx.capture('initial');
  ctx.assertAll([
    sceneAssertions.entityExists(ctx.last, 'npc/hella'),
    sceneAssertions.entityVisible(ctx.last, 'npc/hella'),
    hudAssertions.panelVisible(ctx.last, 'dialogue') === false,
  ]);

  await ctx.click('npc/hella');
  await ctx.waitForTick();
  await ctx.capture('after-click-hella');
  ctx.assertAll([
    gameAssertions.dialogueSpoken(ctx.last, 'example-npc', 'welcome'),
    gameAssertions.threadAtBeat(ctx.last, 'welcoming', 'intro'),
    hudAssertions.panelVisible(ctx.last, 'dialogue'),
  ]);

  await ctx.click('plot-hutB');
  await ctx.waitForPlayerArrival();
  await ctx.capture('after-reach');
  ctx.assertAll([
    gameAssertions.threadAtBeat(ctx.last, 'welcoming', 'reach-complete'),
    gameAssertions.intentFired(ctx.last, 'thread-beat-complete'),
  ]);
});
```

Each `ctx.assertAll` failure surfaces with the exact predicate and the
actual JSON slice — debuggable without rerunning.

---

## Tier 1 — LLM judge over structured text

Reserved for what Tier 0 can't catch: variance and qualitative-but-
structural judgements over generated content.

**Inputs are JSON, not pixels:**

- Composition JSON (recipe + entities + provenance)
- Multiple seeds' compositions side-by-side (variance check)
- Conversation flow as a sequence of dialogue states
- Game-state trace across a play scenario
- Asset-manifest filtered slice

**Example prompts:**

- "Given these 5 villages produced by the same recipe with different
  seeds, rate variance on a 0-5 scale across patches, anchor placement,
  building rotation, and density. Flag any seed that looks
  near-duplicate of another."
- "Trace this dialogue flow (10 turns). Mark dead-ends, repeated lines,
  out-of-character voice slips against the an example NPC voice card."
- "Given this composition and the asset manifest's tonal flags, flag
  any entity placement that mixes incongruent tonal categories."

LLM verdicts are JSON (pass / flag / fail per axis, with quoted
evidence). Cache by `(prompt, input_hash)` aggressively — same input
in a re-run gets cached verdict for free.

Inputs are usually 1-5k tokens, well below context limits with prompt
caching. Cost per verdict is in the single cents; a milestone gate of
~50 verdicts is ~$1-2.

---

## Tier 2 — Vision (dev-triggered only)

For *taste* — never for regression.

**Use cases:**

- Theme Critic visual review of newly added source assets (tonal flags)
- Director-mode "does this scene composition *feel* right" sanity check
  when the user is iterating
- Pre-release art-direction audit
- Specifically: things humans see and judge but Tier 0/1 can't capture
  in structured form

**Hard rules:**

- Never in CI
- Never on cron
- Always developer-explicit (`just probe-judge-visual <probe-id>`)
- Frame capture's `framePngPath` is populated only for Tier 2 runs
- Cost-tracked per run; warn at threshold

---

## Tier 3 — Human playtest

The expensive, scarce, irreplaceable tier. Plan it like a budget.

**What humans are for:**
- Discovering whether mechanics are fun
- Finding emergent behaviour the design didn't predict
- Tone / humour landings, especially for the the project's tonal register target
- Frustration triggers ("this menu took 3 clicks too many")
- Narrative resonance / does this make the player feel something
- Long-session feel (fatigue, repetition, late-game motivation)
- Social dynamics (when there are multiple humans in the world)

**What humans are not for:**
- Finding "the dialogue panel didn't show up"
- Finding "this tavern is missing its door"
- Finding "the NPC clipped through a building"
- Finding "draw calls jumped by 40% after the patch"

Those are Tier 0 failures. If a Tier 3 session turns up a Tier 0-class
issue, that's a gap in the probe library — fix the probe, then ship.

**Playtest feedback subsystem** ports from MyProject (`docs/framework/
playtest-feedback.md`): in-game F8 captures a bundle
(note + screenshot + log tail + structured state). Pickup via
`feedback-triage` subagent. The structured-state field is exactly the
same `FrameCapture` shape Tier 0 uses — feedback bundles can become
new probes directly.

---

## Issue feed + Director integration

Findings from any tier flow into one issue feed:

```
Tier 0 fail        ──┐
Tier 1 LLM verdict ──┼──> packages/probes/findings/*.json  ──> aggregator (dedup by hash)  ──> docs/issues/<id>.md
Tier 2 LLM verdict ──┤                                                                         │
Tier 3 playtest    ──┘                                                                         │
                                                                                               ▼
                                                                                       triaged to:
                                                                                       - fix as code change
                                                                                       - fix via Director (recipe / composition patch)
                                                                                       - new probe (so it can't recur)
                                                                                       - promote to Tier 0 deterministic check
                                                                                       - accepted issue
```

When a Tier 1 verdict says "villages cluster too uniformly", that
feeds the **scene Director** with the finding as context — director
can propose a recipe-level intervention with the LLM verdict as
justification.

The system **gets cheaper over time**: every recurring Tier 1/2
finding either gets fixed *or* gets codified as a Tier 0 check. The
LLM stops getting asked the same question.

---

## Probes catalog (initial)

These are the probes scaffolded alongside the system. Each adds Tier 0
coverage for one feature:

| Probe | Tier 0 checks | Tier 1 (when active) |
|---|---|---|
| `boot` | client mounts, server connects, no console errors | — |
| `asset-load` | each asset key in manifest loads without error; geometry/texture counts match | — |
| `composition-render` | given recipe + seed, composition renders with expected entity count and positions | — |
| `example-thread` | full thread flow (click NPC → walk → return → complete); HUD + game-state at each beat | — |
| `village-variance` | five seeds of same village recipe; bounds, patch counts, no overlapping | "variance per axis" |
| `dwelling-variance` | five seeds of same dwelling type | "variance, plausibility" |
| `dialogue-flow` | every thread's full dialogue tree reachable | "voice-card adherence" |
| `memory-leak` | enter/leave 10 zones; geometry + texture counts stable | — |
| `perf-budget` | draw calls / triangles / frame-time under threshold per scene | — |
| `mobile-perf` | as `perf-budget` but with mobile viewport + thermal-style frame budget | — |
| `safari-compat` | full boot + example-thread under WebKit | — |
| `theme-tonal` | composition tonal-flag audit | "tonal review" |
| `localization` | each locale renders without missing keys; layout doesn't break at 130% length | — |

Each probe is ~50-200 lines. They run via `just probe-tier0` (all)
or `just probe <name>` (one). Playwright sharded across cores.

---

## Comparison to MyProject's probe pipeline

MyProject established:
- Tier 0 / Tier 1 / Tier 2 / Tier 3 cost gradient
- No LLM in CI hard rule
- Two-track tests (`[Category("Probe")]` exploratory vs
  `[Category("Regression")]` golden)
- Cross-cutting concerns briefed to every LLM judge (a11y, l10n)
- Issue feed aggregator + suggested-fix-agent routing
- F8 playtest bundles

**What carries over verbatim:** the tier model, the no-LLM-in-CI rule,
the issue-feed pattern, the playtest bundle shape, the
two-track-tests philosophy, the cross-cutting domain briefings.

**What changes:**

- **Frame capture is text-first.** MyProject Tier 1+ leaned on
  ScreenCapture frames as the primary judging input. WebGL flips this:
  text dump is primary; screenshot is a Tier-2-only addendum. Riftbound
  learning embedded.
- **Tier 0 catches more.** Because composition is data and game state
  is typed Colyseus state and HUD has a structured snapshot, far more
  questions reduce to deterministic predicates. The Tier 1 surface
  shrinks correspondingly.
- **No PlayMode harness.** Playwright drives the actual browser.
  `bin/run-probes.sh` becomes `just probe-tier0` etc.
- **No "editor-only" path.** Every probe runs the same way the
  shipping client runs (just via a probe-mode route that exposes
  `window.__captureFrame`).

---

## Two-track probes: canonical vs exploratory

Probes split into two directories with different lifecycle
expectations — same model as MyProject's `Probe` vs `Regression`
category split.

### `packages/probes/src/scenarios/` — canonical Tier 0

- Long-lived, blocking on CI, reviewed, maintained
- Catches a class of regression the project actually experiences
- Earned its place per [`validation-pipeline.md`](validation-pipeline.md)
  rules (high-value pattern)
- Renaming / deleting one is a deliberate act with a reason

### `packages/probes/src/exploratory/` — temporary + deletable

- Ad-hoc probes investigating a specific question
- Tier 1 LLM-judge scaffolding (when LLM critics run dev-triggered)
- Allowed to rot; expected to be culled
- Each file starts with a required header:

```ts
/**
 * @probe exploratory
 * @author claude | <name>
 * @created YYYY-MM-DD
 * @expires YYYY-MM-DD            (or condition: "until X is fixed")
 * @intent <one sentence on what this probe is investigating>
 */
```

### `packages/probes/src/archive/` — soft-deleted

Probes that have outlived their usefulness but might be worth reading
later. Move here with a one-line reason at the top. Hard delete is
fine too; git history is the archive of last resort.

### Auto-audit (advisory, never deletes)

`just probe-audit` (or `scripts/probe-audit.sh`) walks
`exploratory/` and flags:

- Probes past their `@expires` date
- Probes unmodified for `STALE_DAYS` (default 30) without an
  `@expires`
- Probes missing the required header

Output is a human-readable triage list — never deletes automatically.
The auditor can run on a schedule (weekly), as part of mission
control's checks, or on demand.

**Promotion ritual:** an exploratory probe that catches the same
thing 3+ times graduates to `scenarios/` — rewrite as a canonical
probe with proper review, then delete the exploratory version. This
is the "system gets cheaper over time" loop from
[`validation-pipeline.md`](validation-pipeline.md) in concrete form.

---

## Shared fixtures — low-boilerplate probes

`packages/probes/src/fixtures/` holds reusable primitives both
canonical and exploratory probes consume. Goal: a typical probe is
5-15 lines of intent, not 50 lines of setup.

Planned modules (land as probes need them, per rule of three):

- `world.ts` — `spawnPlayer`, `moveTo`, `clickEntity`, `waitForTick`,
  `waitForState(predicate)`
- `capture.ts` — `captureFrame(page) → FrameCapture`,
  `assertFrameClean`
- `db.ts` — `withSeededDb(spec, fn)`, `resetDb`
- `recipes.ts` — `makeBuildingRecipe(overrides?)`, etc. —
  deterministic content factories
- `composition.ts` — `loadComposition(recipe)`, `expectEntities(spec)`
- `assertions.ts` — composable predicates on `FrameCapture`
  (`noOverlapping`, `withinDrawCallBudget`, `panelVisible`, etc.)

Discipline: don't pre-emptively populate the fixtures dir. Helpers
earn their place when 3 probes need them. Until then, inline the
setup. Three real consumers stabilise an abstraction; one or two are
guesses.

Example exploratory probe using fixtures:

```ts
/**
 * @probe exploratory
 * @author claude
 * @created 2026-05-15
 * @expires 2026-06-15
 * @intent quick check that village recipe regenerates with different seeds
 */
import { test, expect } from '@playwright/test';
import { spawnPlayer, loadComposition } from '../fixtures/world.js';
import { captureFrame } from '../fixtures/capture.js';
import { makeVillageRecipe } from '../fixtures/recipes.js';

test('village varies across seeds', async ({ page }) => {
  await spawnPlayer(page);
  await loadComposition(page, makeVillageRecipe({ seed: 42 }));
  const a = await captureFrame(page);
  await loadComposition(page, makeVillageRecipe({ seed: 43 }));
  const b = await captureFrame(page);
  expect(b.scene.nodeCount).not.toBe(a.scene.nodeCount);
});
```

Without fixtures, the same probe is 50+ lines of Playwright setup.
The fixtures pay for themselves quickly.

---

## Roadmap

1. `FrameCapture` schema + `window.__captureFrame()` implementation
2. Playwright probe harness skeleton (`just probe` runs one)
3. Tier 0 assertion library (scene / hud / game / render)
4. `boot` + `asset-load` probes (first smoke)
5. `composition-render` probe + first composition assertions
6. `memory-leak` + `perf-budget` probes
7. Tier 1 judge harness over structured dumps (when first generator
   lands and variance matters)
8. Issue-feed aggregator + dedup
9. `example-thread` end-to-end probe (when threads port over)
10. Mobile + Safari probes
11. Tier 2 vision (only when an art-direction question demands it)
12. Tier 3 playtest bundle pickup (F8 → bundle → `feedback-triage` subagent)
