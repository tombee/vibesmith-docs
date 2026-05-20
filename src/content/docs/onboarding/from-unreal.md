---
title: 'From Unreal'
description: 'An Unreal-flavoured tour of vibesmith. AActor + BeginPlay / Tick → defineGameScript onMount / onTick. UPROPERTY → Zod-typed parameters. Blueprint → TypeScript (no visual-scripting parallel). Niagara → <Particles>. Animation Blueprint → <Animator>. The vocabulary map plus a side-by-side rotating-cube walkthrough.'
---

You've shipped Unreal projects. You know `AActor`, `BeginPlay` /
`Tick` / `EndPlay`, UPROPERTY, Blueprints, Niagara, the Animation
Blueprint state machine, Levels and the World Outliner. This page
maps that vocabulary onto vibesmith.

## Five-minute landing

Unreal is the engine vibesmith looks *least* like at first
glance — but the underlying authoring intuitions transfer better
than the syntax suggests:

- The editor opens a project folder, has a hierarchy / viewport /
  details split, surfaces Play / Pause / Step the same way the
  Unreal Editor does.
- Components attach to scene objects via the JSX tree the same
  way components attach to actors in Unreal.
- An asset pipeline + an animation runtime + a particle runtime
  + an audio runtime exist as first-class subsystems.

What's different:

- **The runtime is the web platform.** Browser / Tauri desktop /
  mobile web / Steam Deck browser are the targets. Console
  shipping isn't (see [Cross-platform](/vibesmith-docs/positioning/)
  for the explicit non-goal).
- **Game logic is TypeScript only.** There is no Blueprint
  equivalent — and never will be, per
  [Principled non-features](/vibesmith-docs/principled-non-features/).
  The AI assistant is the "visual layer"; it reads and writes
  TS for you.
- **Scenes are React component trees**, not Levels with
  serialised actor states. Your scene file is `.tsx`; git diffs
  it.
- **Scripts are factory registrations**, not subclasses of
  `AActor`. No `UCLASS` / `GENERATED_BODY` ceremony; no header
  / implementation split.
- **The renderer is Three.js (WebGL / WebGPU)**, not Unreal's
  forward / deferred clustered pipeline. Lumen / Nanite / world-
  partition equivalents do not exist; quality maps to
  [adaptive rendering tiers](/vibesmith-docs/reference/adaptive-rendering/)
  and to recipe-canon TSL shaders for the AI-difficult bits.

If those land for you, the table below is the rest of the move.

## Vocabulary map

The Rosetta data lives at
[`/vibesmith-docs/engine-rosetta.json`](/vibesmith-docs/engine-rosetta.json).
Unreal-relevant entries:

| Unreal | vibesmith | What it is in vibesmith |
| --- | --- | --- |
| `AActor` (`BeginPlay` / `Tick` / `EndPlay`) | `defineGameScript({ id, onMount, onTick, onUnmount })` | Per-node lifecycle. Mounts once, ticks per frame, unmounts when the node leaves the React tree. No `GENERATED_BODY`. See [Script](/vibesmith-docs/concepts/script/). |
| `UPrimitiveComponent` + `UPhysicsConstraintComponent` | `definePhysics` + `<RigidBody>` | Adapter contract. Rapier is the canonical engine; Cannon-es proves the second-impl. |
| `LineTraceSingleByChannel` | `ctx.physics.raycast` | Same idea, called from a script's context. |
| Blueprint Class | `definePrefab` | Generative content unit (recipe + generator + critic + AI brief + preview). Not a frozen instance; closer to "a recipe + generator pair". See [Prefab](/vibesmith-docs/concepts/prefab/). |
| Level + Outliner | Composition (`scene.json`) | A scene-tree of nodes with transforms + script attachments + child references, persisted as JSON, mounted at project open. |
| Niagara | `<Particles>` + `<Emitter>` | CPU instanced-billboards (LOW / MEDIUM tier) + WebGPU-compute (HIGH / ULTRA tier) behind one consumer API. Recipe-canon driven (`useVfxRecipe`). |
| Animation Blueprint + State Machine | `<Animator>` + `ctx.animator(id)` | State machine + blend tree over Three's `AnimationMixer`. JSON / TS-as-data graphs. |
| `AudioComponent` | `<AudioEmitter>` | Scene-tree audio source with 3D positional panning, fixed mixer bus hierarchy. Web Audio under the hood. |
| UMG (Widget Blueprint) | `defineHud` | DOM overlay rendered above the R3F canvas — pure React + Tailwind, absolute-positioned. |
| Replication graph + RPCs | `defineNetworkAdapter` | Pluggable transport. Framework owns the wire-version + intent / state-delta / reconciliation shape. |
| Custom `SaveGame` | [Snapshot](/vibesmith-docs/concepts/snapshot/) | First-class capture + replay. Launch into any captured state; HMR-preserved across script edits. |
| Data Asset / Data Table | [Recipes](/vibesmith-docs/concepts/recipe/) + [Capabilities](/vibesmith-docs/concepts/capability/) | Recipes hold curated patterns (VFX, shaders, cutscenes, mixes); capabilities abstract "things the framework can do" (image.generate, llm.call) over providers. |

## Walkthrough: rotate a cube

Unreal-101 vs vibesmith.

### Unreal (C++)

```cpp
// SpinCube.h
#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "SpinCube.generated.h"

UCLASS()
class MYPROJECT_API ASpinCube : public AActor
{
    GENERATED_BODY()
public:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Spin")
    float DegreesPerSecond = 90.f;

    virtual void Tick(float DeltaTime) override;
};
```

```cpp
// SpinCube.cpp
#include "SpinCube.h"

void ASpinCube::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);
    FRotator R = GetActorRotation();
    R.Yaw += DegreesPerSecond * DeltaTime;
    SetActorRotation(R);
}
```

You'd drop a `SpinCube` actor into the level; the Details panel
exposes `DegreesPerSecond` because of `UPROPERTY(EditAnywhere)`.

### vibesmith

```ts
// scripts/spin-cube.ts
import { defineGameScript } from '@vibesmith/runtime';
import { z } from 'zod';

export const spinCube = defineGameScript({
  id: 'spin-cube',
  parameters: z.object({
    degreesPerSecond: z.number().default(90),
  }),
  onTick(ctx, { delta, parameters }) {
    const radians = (parameters.degreesPerSecond * Math.PI) / 180;
    ctx.node.rotation.y += radians * delta;
  },
});
```

```tsx
// scenes/main.tsx
export default function MainScene() {
  return (
    <>
      <directionalLight position={[5, 10, 5]} />
      <mesh position={[0, 0.5, 0]} script="spin-cube">
        <boxGeometry />
        <meshStandardMaterial color="orange" />
      </mesh>
    </>
  );
}
```

Press Play in the editor. The cube rotates. The inspector exposes
`degreesPerSecond` because the Zod schema declared it — same
intent as `UPROPERTY(EditAnywhere)`, but the same schema also
feeds your AI assistant (see
[Inspectable parameters](/vibesmith-docs/cookbook/inspectable-parameters/)).

## What's intentionally different

- **No Blueprint visual scripting.** Game logic is TypeScript.
  The AI assistant is the visual / accessible layer; it reads and
  writes code. The full reasoning lives at
  [Principled non-features](/vibesmith-docs/principled-non-features/).
- **No header / implementation split, no `GENERATED_BODY`.**
  One file per script. No code generation step in the build.
- **No UPROPERTY / UFUNCTION macro soup.** Parameters that should
  appear in the inspector go in a Zod schema. Tooltips are
  `.describe()`, ranges are `.min().max()`, etc. — one schema,
  no separate metadata layer.
- **No GameInstance / GameMode / PlayerController / HUD class
  hierarchy.** Cross-scene state lives in React context, in
  module-level signals, or in a registered world-model store.
  Per-player state hangs off the same scripts that handle it.
- **No actor inheritance hierarchies.** Scripts compose. A node
  can carry multiple scripts; behaviour layers without
  subclassing.
- **No Lumen / Nanite / world-partition.** The renderer is
  Three.js running on the browser's WebGL 2 or WebGPU. Quality
  scales via
  [adaptive-rendering tiers](/vibesmith-docs/reference/adaptive-rendering/)
  + a [recipe-canon](/vibesmith-docs/concepts/recipe/)
  curated set for the AI-difficult bits (TSL shaders, VFX,
  cutscenes).
- **No console deployment.** The targets are browser, Tauri-
  wrapped desktop, mobile web, Steam Deck browser. If you need
  PS5 / Xbox / Switch, pick a native engine. The non-goal is
  explicit.

## Coming from Unreal, going to vibesmith — practical first steps

1. **Skim the [Concepts](/vibesmith-docs/concepts/) pages.** Pay
   attention to [Snapshot](/vibesmith-docs/concepts/snapshot/) —
   it has no direct Unreal equivalent and replaces a lot of what
   you'd otherwise build a custom `SaveGame` workflow for.
2. **Read [Positioning](/vibesmith-docs/positioning/).** The
   two-layer bet — narrow runtime (TS+R3F web target) + durable
   intelligence layer — is the framework's strategic claim;
   worth grounding before committing.
3. **Read [Performance budgets](/vibesmith-docs/reference/performance-budgets/)
   + [Adaptive rendering](/vibesmith-docs/reference/adaptive-rendering/).**
   Both calibrate expectations for what the web platform actually
   ships. Coming from Unreal, the gap is biggest here.
4. **Scaffold a project**: see
   [Quick start](/vibesmith-docs/getting-started/quick-start/).
   The scaffold's `main.tsx` already contains the rotating
   orange cube — the Unreal-101 task above is *already on screen*
   the first time you press Play.
5. **Install the [MCP integration](/vibesmith-docs/cookbook/install-mcp/)
   into your coding assistant** (Claude Code / Codex CLI /
   Copilot). The authoring loop assumes it.
6. **Read [Anti-patterns](/vibesmith-docs/anti-patterns/).** The
   12-entry list of R3F mistakes. The "re-render in `useFrame`"
   trap and the "non-memoised JSX in a hot scene" trap will land
   harder coming from Unreal than from any other engine.

## Cross-references

- [Concepts](/vibesmith-docs/concepts/) — first-principles vocabulary.
- [Engine patterns](/vibesmith-docs/reference/engine-patterns/) —
  the full reference doc.
- [Principled non-features](/vibesmith-docs/principled-non-features/)
  — patterns we deliberately won't ship + reasoning.
- [Positioning](/vibesmith-docs/positioning/) — the strategic
  bet, with explicit non-goals.
- [Cookbook](/vibesmith-docs/cookbook/) — working code.
- [`engine-rosetta.json`](/vibesmith-docs/engine-rosetta.json) —
  the raw data your AI assistant can fetch.
