---
title: 'FAQ — comparisons + common questions'
description: 'How Vibesmith differs from Three.js, React Three Fiber, Babylon.js, web-export engines, and web-native competitors — plus when you should pick one of those instead.'
---

The five most-asked questions on first contact, with honest answers.
The framework is web-native + editor-shaped + AI-maximalist; not
every project wants all three. This page is the substantive picker.

## Vibesmith vs Three.js

**Three.js is a rendering library. Vibesmith is a framework + editor
that uses Three.js.**

Three.js handles WebGL/WebGPU rendering: meshes, materials, lights,
cameras, the scene graph, GLTF loading. It does not have an editor,
a content pipeline, gizmos, an inspector, or opinions about how to
structure a project.

Vibesmith ships:

- A desktop editor that opens project folders (the binary).
- A typed project contract (`vibesmith.toml` + conventional folders).
- A plugin model for game logic (`defineGameScript`).
- An AI-aware content pipeline (directors + critics).
- Performance budgets + adaptive rendering tiers.
- An upgrade model for binaries vs customer content.

**Pick Three.js directly when:** you want raw rendering, you're
embedding 3D in a wider web app, or you have your own engine /
editor / pipeline you want to retain.

**Pick Vibesmith when:** you're building a game (not just a 3D
scene), want an editor + tooling, and the methodology fits.

## Vibesmith vs React Three Fiber

**R3F is the React binding for Three.js. Vibesmith uses R3F.**

If you already use R3F for a non-game React app, Vibesmith adds:

- An editor binary that mounts your `<Canvas>` and adds dev panels
  around it without your code knowing.
- A scene-accessor protocol so the inspector / hierarchy / future
  custom panels can read and write your live Three.js scene.
- A scripting model (`defineGameScript`) that's lighter than full
  R3F components when you only need a per-frame `onTick`.

**Pick R3F directly when:** the game-shaped affordances (editor,
plugin contract, content pipeline) aren't valuable for what you're
building.

**Pick Vibesmith when:** R3F is the right rendering choice and you
also want the game-dev surface.

## Vibesmith vs Babylon.js

**Babylon is a comprehensive WebGL engine. Vibesmith is a thinner
framework on top of Three + R3F, leaning on the React ecosystem +
AI tooling.**

What Babylon ships in the box that Vibesmith builds piecewise:

- **Inspector + Node Material Editor.** Babylon's inspector is
  excellent and represents years of polish. Vibesmith's editor is
  pre-MVP and growing slice-by-slice. Honest: today Babylon wins
  on inspector maturity.
- **Animation state machine.** Babylon has `AnimationGroup` blends
  + animation curves. Vibesmith relies on drei + manual mixer
  work + (eventually) a state-machine slice.
- **Physics (Havok / Cannon / Ammo) integrated.** Vibesmith
  expects you to pick a physics lib via the `[deps]` flow.
- **Babylon GUI.** Vibesmith puts the UI in React. Different
  paradigm.
- **WebGPU maturity.** Babylon's WebGPU path is currently more
  mature than Three's; the gap is closing.

What Vibesmith picks differently:

- **One paradigm.** Scenes, HUD, and dev tooling all live in
  React. With Babylon you'd either use Babylon's scene graph +
  React for UI (two paradigms), or pick a third-party React
  wrapper and live in the seam.
- **AI codegen accuracy.** Three.js has roughly 5–10× the
  training corpus of Babylon on public code. R3F adds another
  large corpus. When the bet is "AI writes most of the code,"
  that corpus delta compounds across every generation. Babylon's
  first-class TypeScript types narrow the gap but don't close it.
- **Composable ecosystem over batteries-included.** drei, rapier,
  leva, r3f-perf, theatre, jotai, valtio each do one thing in the
  R3F ecosystem and compose. Babylon's batteries-included model
  means each capability ships *as Babylon sees it* — fits well
  for many projects, less well for a framework that wants to fit
  its own director pattern + prefab system around it.

**Pick Babylon when:** you want a mature, batteries-included
WebGL engine with a great inspector, and React isn't a strong
preference.

**Pick Vibesmith when:** React-as-the-unifying-paradigm is
valuable, AI-augmented dev is core to your workflow, and you're
willing to accept that the editor is younger than Babylon's.

## Vibesmith vs native engines compiled to the web

**Established native game engines (the big commercial ones, plus
mature open-source alternatives) export to the web via
WebAssembly + WebGL. Vibesmith is web-native — no transpile layer,
no engine runtime to ship.**

What the heavyweight engines have that Vibesmith doesn't:

- Decades of features, asset pipeline, plugins, marketplaces.
- Mature animation, physics, VFX, audio, terrain systems.
- A massive community + tutorial corpus.
- Multiplatform: web is one target among consoles / mobile /
  desktop.

What Vibesmith has that web exports from native engines don't:

- **Small bundles.** A working Vibesmith project ships well under
  a megabyte of JS plus the rendered assets. Web exports from
  native engines start at several megabytes compressed, often
  tens of megabytes for non-trivial games.
- **Fast startup.** Vibesmith projects boot in well under a
  second. Web exports from native engines have noticeable
  engine-warmup delay.
- **Web-native memory.** WebAssembly + asm.js has overhead;
  Vibesmith runs as ordinary JS + WebGL with no transpile layer.
- **Predictable mobile / Steam-Deck behaviour.** Heavyweight web
  exports on weak mobile are unreliable; Vibesmith is designed
  mobile-first (see [Adaptive
  rendering](/vibesmith-docs/reference/adaptive-rendering/)).
- **AI-friendly project files.** TypeScript + JSON + TOML.
  Native engines tend to use proprietary scene formats + asset
  GUIDs that most AI assistants struggle with.
- **No editor licensing.** Vibesmith is open source.

**Pick a native engine (web or otherwise) when:** the feature
breadth matters and you accept the bundle / startup costs, or
you ship to multiple platforms and web is one of several
targets.

**Pick Vibesmith when:** WebGL is the primary target, bundle
size + startup matter, and you'd rather build on a thin stack
you fully understand than a heavyweight engine exported through
a transpile pipeline.

## Vibesmith vs other web-native engines (PlayCanvas etc.)

**Other web-first WebGL engines exist. The closest direct
comparison is PlayCanvas.**

Common ground with the web-native category: small bundles,
decent mobile performance, real editors.

Differences:

- **Editor model.** Most web-native competitors host the editor
  as SaaS (the Editor runs in your browser, projects live on
  their servers). Vibesmith's editor is a desktop binary that
  opens local folders — your files stay on your machine.
- **Source openness.** Vibesmith is open source end-to-end
  (framework + editor + docs). Web-native competitors typically
  ship open-source engines + proprietary editors.
- **Rendering stack.** Vibesmith leans on Three.js + R3F. Other
  web-native engines tend to write their own scene graph + engine.
- **AI surface.** Vibesmith's MCP server + scene accessor +
  project-as-files contract make AI access a first-class
  affordance. SaaS-hosted editors are harder for AI agents to
  reach into.

**Pick a browser-hosted editor when:** team collaboration in a
tab is a feature, and the SaaS-hosted model is acceptable.

**Pick Vibesmith when:** you want local files, an open editor,
and AI agents working alongside you on those files.

## "When should I not use Vibesmith?"

The honest list:

- **You ship next month** and can't afford framework gaps. Use
  a mature engine.
- **You need consoles or native mobile** as a primary target.
  WebGL has hard limits; native engines win.
- **You don't want AI in your dev loop.** The methodology
  assumes it; the framework works without it but the value
  proposition shrinks proportionally.
- **You want a no-code experience.** Vibesmith expects you to
  write TypeScript inside `scripts/`. The editor + AI make the
  loop fast; they don't remove code.
- **You need a battle-tested engine for a commercial release
  this year.** Vibesmith is pre-MVP. The contract surface is
  shaping; minor versions may break.

## "Why React, why not Vue / Svelte / Solid?"

React is the largest UI ecosystem with the largest AI training
corpus. R3F gives us Three.js in React idiomatically. The
methodology bet leans on corpus size for AI accuracy — that
choice cascades to React.

If Vue / Svelte / Solid had R3F-equivalent quality, the calc
would shift. Today React wins on the combination.

## "Is Vibesmith just R3F with extra steps?"

No. The relationship is closer to "Vibesmith uses R3F" the way
a heavyweight engine uses its scripting language. R3F provides
the rendering paradigm; Vibesmith adds an editor, a project
contract, a plugin model, a content pipeline, AI surfaces,
performance budgets, and an upgrade model.

If you only need R3F, use R3F. The "extra steps" are the
editor + AI methodology + content discipline.

## "What's the licence?"

Vibesmith is open source. The framework, the editor binary, the
public docs are all permissive-licensed (MIT-style — the LICENSE
file in the framework repo is authoritative).

## "Production-ready?"

**No.** Pre-MVP. Contracts are shaping. CHANGELOG entries flag
minor-version breaking changes. The first MVP gate is when a
first consumer game ships on Vibesmith end-to-end.

If you want to *follow* the development, the [public
roadmap](https://github.com/tombee/vibesmith) is on GitHub. If
you want to *use* Vibesmith for a real release today, wait for
the 0.1.0 cut.
