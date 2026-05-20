---
title: 'From Unity'
description: 'A Unity-flavoured tour of vibesmith. MonoBehaviour → defineGameScript. Prefab → definePrefab. ScriptableObject → recipe + capability. Animator → <Animator>. Scene → <Canvas> tree. The vocabulary map plus a side-by-side rotating-cube walkthrough.'
---

You've shipped Unity projects before. You know `MonoBehaviour`,
prefabs, `[SerializeField]`, the Animator window, scene assets.
This page maps that vocabulary onto vibesmith so you can start
reading the framework without translating twice.

## Five-minute landing

vibesmith looks like Unity from a distance: a desktop editor that
opens a project folder, a three-pane layout (hierarchy, viewport,
inspector), a Play / Pause / Step toolbar, scenes that hold
objects, scripts attached to objects.

Under the hood it's different:

- **Scenes are React component trees**, not serialised binary
  assets. Your scene file is `.tsx`. Git diffs it.
- **Scripts are factory registrations**, not class subclasses of
  `MonoBehaviour`. No inheritance.
- **The render path is WebGL/WebGPU through Three.js +
  React Three Fiber**, not the Unity render pipeline. Hard limit
  + opportunity: browser, mobile web, Steam Deck browser — yes.
  Console builds — no.
- **AI assistance is a first-class authoring surface**, not an
  optional plugin. The framework expects you to drive it through
  Claude Code / Cursor / Codex CLI / Copilot via MCP, or via the
  in-editor BYOK chat panel.

If those four constraints land for you, the rest of this page is
the vocabulary mapping you need.

## Vocabulary map

The Rosetta data lives at
[`/vibesmith-docs/engine-rosetta.json`](/vibesmith-docs/engine-rosetta.json).
The Unity-relevant entries:

| Unity | vibesmith | What it is in vibesmith |
| --- | --- | --- |
| `MonoBehaviour` (Awake / Start / Update / OnDestroy) | `defineGameScript({ id, onMount, onTick, onUnmount })` | Per-object lifecycle attached to a scene node. No inheritance — scripts are factory registrations bound by `script="<id>"` on a node. See [Script](/vibesmith-docs/concepts/script/). |
| `Rigidbody` + `Collider` | `definePhysics` + `<RigidBody>` | Adapter contract (Rapier / Cannon-es first-class). `<RigidBody>` binds a scene node to a physics body; `ctx.physics` gives the script raycast + query access. |
| `Physics.Raycast` | `ctx.physics.raycast` | Same idea, called from a script's context. |
| `Prefab` | `definePrefab` (recipe + generator + critic + AI brief + preview) | Content unit, not a serialised frozen instance. Closer to "Godot PackedScene + a generator script". See [Prefab](/vibesmith-docs/concepts/prefab/). |
| Scene + Hierarchy | Composition (`scene.json`) | A scene-tree of nodes with transforms + script attachments + child refs, persisted as JSON, mounted at project open. Human-readable, git-diffable. |
| `ParticleSystem` | `<Particles>` + `<Emitter>` | Scene-tree components; CPU instanced-billboards (LOW / MEDIUM tier) + WebGPU-compute (HIGH / ULTRA tier) behind one consumer API. Recipe-canon driven (`useVfxRecipe`). |
| `Animator` + `AnimatorController` | `<Animator>` + `ctx.animator(id)` | State machine + blend tree over Three's `AnimationMixer`. Graphs are JSON / TS-as-data, not Unity's binary `.controller` assets. |
| `AudioSource` | `<AudioEmitter>` | Scene-tree audio source with 3D positional panning, fixed mixer bus hierarchy (master / music / sfx / dialogue / ambient). Web Audio under the hood. |
| uGUI Canvas + Canvas children | `defineHud` | DOM overlay rendered above the R3F canvas — pure React + Tailwind, absolute-positioned. |
| NetCode for GameObjects | `defineNetworkAdapter` | Pluggable contract: state-delta replication + intent dispatch + reconciliation envelope. Consumer picks Colyseus / raw WS / WebRTC. |
| Custom save system (PlayerPrefs, SaveGame asset) | [Snapshot](/vibesmith-docs/concepts/snapshot/) | First-class capture + replay of game state. Unifies dev iteration + probe inputs + bug repros. HMR-preserved. |
| ScriptableObject (curated data assets) | [Recipes](/vibesmith-docs/concepts/recipe/) + [Capabilities](/vibesmith-docs/concepts/capability/) | Recipes hold curated patterns (VFX, shaders, cutscenes, mixes); capabilities abstract "things the framework can do" (image.generate, llm.call) over providers. The AI-substrate half of the Unity ScriptableObject role; not a one-to-one drop-in. |

## Walkthrough: rotate a cube

The Unity-101 task: spawn a cube, attach a script, rotate it every
frame. Side by side:

### Unity

```csharp
// MoveCube.cs — attached to a Cube GameObject in the scene
using UnityEngine;

public class MoveCube : MonoBehaviour
{
    [SerializeField] private float degreesPerSecond = 90f;

    void Update()
    {
        transform.Rotate(0f, degreesPerSecond * Time.deltaTime, 0f);
    }
}
```

The Inspector exposes `degreesPerSecond` because of
`[SerializeField]`; you drag the cube into the scene and the
script onto the cube.

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

The inspector surfaces `degreesPerSecond` because the Zod schema
declared it — same role as `[SerializeField]`, but the schema also
feeds your AI assistant's context. See
[Inspectable parameters](/vibesmith-docs/cookbook/inspectable-parameters/).

Press Play in the editor. The cube rotates.

## What's intentionally different

vibesmith deliberately doesn't replicate parts of Unity. The
short list of *principled non-features* — patterns we won't copy
and why — lives at
[Principled non-features](/vibesmith-docs/principled-non-features/).
The Unity-flavoured highlights:

- **No `GetComponent<T>()`.** Components are React JSX; you
  *write* them in the scene tree where you can see them, not look
  them up at runtime by type. AI assistants read JSX end-to-end;
  registry-by-type lookups force them to crawl.
- **No Animator override controllers.** Variants live inside the
  parent graph; one fewer indirection layer.
- **No Blueprint-style visual scripting.** Game logic is
  TypeScript. The AI assistant *is* the visual layer — it reads
  code, suggests edits, lands them.
- **No `[SerializeField]` reflection magic.** Inspector parameters
  come from a Zod schema declared next to the script. One schema
  feeds the runtime, the inspector panel, and the AI assistant.
- **No prefab override layer that lives at the instance level.**
  Overrides happen at the script-parameters layer (see
  [Inspectable parameters](/vibesmith-docs/cookbook/inspectable-parameters/));
  prefabs themselves are generative, not frozen instances.
- **No `[Header]` / `[Tooltip]` / `[Range]` attribute soup.**
  Zod's `describe()` covers tooltips; `z.number().min().max()`
  covers ranges. The same schema is what your AI reads — no
  separate metadata layer.

## Coming from Unity, going to vibesmith — practical first steps

1. **Skim the [Concepts](/vibesmith-docs/concepts/) pages.** Each
   is ≤ 1 screen; together they replace the Unity Manual's
   first chapter.
2. **Read the [Engine patterns reference](/vibesmith-docs/reference/engine-patterns/).**
   The longer-form Rosetta — covers patterns we deliberately
   don't copy (full justification + alternatives) and patterns
   that are still owed (status callouts).
3. **Scaffold a project**: see
   [Quick start](/vibesmith-docs/getting-started/quick-start/).
   The scaffold's `main.tsx` already contains the rotating
   orange cube — the Unity-101 task above is *already on screen*
   the first time you press Play.
4. **Install the [MCP integration](/vibesmith-docs/cookbook/install-mcp/)
   into your existing coding assistant** (Claude Code / Codex
   CLI / Copilot). The framework's authoring surface assumes
   it.
5. **Read [Anti-patterns](/vibesmith-docs/anti-patterns/).** The
   12-entry list of R3F mistakes that bite first. If you've been
   doing Unity for years, several will look counter-intuitive
   until you internalise the React ownership model.

## Cross-references

- [Concepts](/vibesmith-docs/concepts/) — first-principles
  vocabulary if a term in the table felt fuzzy.
- [Engine patterns](/vibesmith-docs/reference/engine-patterns/) —
  the full reference doc with every Unity-ism's R3F mapping +
  size estimate + status.
- [Principled non-features](/vibesmith-docs/principled-non-features/)
  — the authoring affordances the framework deliberately won't
  ship + the reasoning.
- [Cookbook](/vibesmith-docs/cookbook/) — working code for the
  patterns above.
- [`engine-rosetta.json`](/vibesmith-docs/engine-rosetta.json) —
  the raw data your AI assistant can fetch.
