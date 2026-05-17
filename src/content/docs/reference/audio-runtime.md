---
title: 'Audio runtime — WebAudio wrapper, scene-graph emitters, mixer buses'
description: 'The framework''s audio surface. WebAudio AudioContext / AudioBufferSourceNode / PannerNode stay underneath; Vibesmith adds a scene-graph-aware wrapper above — AudioEmitter components on Object3D, a fixed five-bus mixer, recipe-canon adapter, scenario capture + replay, deferred-init autoplay gate.'
---

The framework's audio surface. WebAudio's `AudioContext` +
`AudioBufferSourceNode` + `PannerNode` stay underneath; Vibesmith
adds a scene-graph-aware wrapper above so consumers attach sound
to nodes the same way they attach scripts. No consumer ships its
own WebAudio plumbing.

Package: `@vibesmith/audio-runtime` (re-exported by
`@vibesmith/runtime` in projects opened via the binary).

## What the framework owns vs what WebAudio owns

| Layer | Owned by |
|---|---|
| `AudioContext` lifecycle, sample rate, base latency | WebAudio |
| `AudioBuffer` decoding, scheduling, looping | WebAudio |
| `PannerNode`, `GainNode`, `BiquadFilterNode`, `ConvolverNode` | WebAudio |
| `AudioListener` position + orientation | WebAudio (driven by framework) |
| `<AudioEmitter>` scene-node component | Framework |
| Camera → listener sync | Framework |
| Mixer bus hierarchy (master / music / sfx / dialogue / ambient) | Framework |
| Per-bus volume / mute / solo / lowpass / compression persistence | Framework |
| Asset manifest → buffer cache (content-addressable) | Framework |
| Recipe parameter → audio graph mapping | Framework |
| Scenario capture / replay of emitter state | Framework |
| Autoplay-gesture gate + deferred init | Framework |
| Eject hatch to raw WebAudio nodes | Framework |

WebAudio nodes stay reachable via `emitter.raw()` —
`{ panner, gain, source, lowpass }` for the unusual cases the
wrapper doesn't cover. The framework owns the common shape; it
does not gate access to the primitive.

## Sound emitter component

A scene node carries one or more emitters the same way it
carries a script. The emitter is the unit of "this node makes
sound."

```tsx
import { AudioEmitter, ListenerSync } from '@vibesmith/audio-runtime/r3f';

function Scene() {
  return (
    <>
      <ListenerSync />
      <group position={[5, 0, -3]}>
        <AudioEmitter source="sfx.footstep.stone" bus="sfx" loop={false} />
        <AudioEmitter source="ambient.wind.loop" bus="ambient" loop autoplay />
      </group>
    </>
  );
}
```

The emitter inherits the carrying node's world position every
frame — no manual sync. Removing the node removes the emitter;
HMR preserves state via the same Zustand pattern scenarios use
for client state.

A node may carry **multiple emitters** (footsteps + breath + a
voice line). Each emitter is independent — its own bus routing,
gain, lifecycle. Composition over configuration.

## Imperative API (`useAudio()`)

Not every sound is scene-graph-shaped. HUD sounds, one-shot
notifications, music transitions live above the scene tree.

```ts
import { useAudio } from '@vibesmith/audio-runtime';

const audio = useAudio();
audio.play('ui.button.confirm', { bus: 'sfx', gainDb: -3 });
audio.music.crossfade('music.combat', { durationMs: 2000 });
audio.bus('dialogue').onPlay(() =>
  audio.bus('music').duck({ targetDb: -12, attackMs: 200, holdMs: 0, releaseMs: 600 }),
);
```

## 3D positional audio

3D emitters route through a `PannerNode` whose position matches
the carrying scene node's world transform. The camera drives the
`AudioListener` position + orientation via the `<ListenerSync />`
component.

Three named attenuation models — the WebAudio panner shapes,
surfaced verbatim:

| Model | When |
|---|---|
| `inverse` | physical realism; long-range falloff |
| `linear` | gameplay-readable; bounded range |
| `exponential` | dramatic dropoff; ambient zones |

Each carries `refDistance`, `maxDistance`, `rolloffFactor` — the
WebAudio panner parameters. The framework does not invent a
fourth model.

### Doppler (opt-in)

WebAudio dropped automatic doppler in the 2017 spec revision.
The framework ships a manual implementation behind a flag:

```tsx
<AudioEmitter
  source="vehicle.engine.loop"
  loop
  spatialization="3d"
  doppler={{ enabled: true, velocityFactor: 1 }}
/>
```

When enabled, the runtime samples emitter velocity (frame-over-
frame world-position delta) and pitches the source via `detune`.
Off by default — doppler artefacts in non-vehicular games
outweigh the realism gain.

### Occlusion

Geometry-based occlusion is a Track P authoring concern, not a
runtime concern. The runtime exposes a per-emitter `lowpassHz`
so the authoring layer can drive occlusion from above; the
runtime does not raycast on its own.

## Mixer bus model

A fixed, small hierarchy:

```
master
├── music
├── sfx
├── dialogue
└── ambient
```

Per-bus state persists in `localStorage` under
`vibesmith.audio.mixer`. The dev shell's **Audio** panel surfaces
sliders + mute / solo buttons; consumer code reads + writes via:

```ts
audio.bus('music').setGainDb(-6);
audio.bus('sfx').mute();
audio.bus('dialogue').solo();
audio.bus('music').setLowpassHz(8000);
audio.bus('master').setCompression({
  thresholdDb: -18,
  ratio: 4,
  attackMs: 5,
  releaseMs: 200,
  makeupDb: 2,
});
```

### Why these five and not more

- **music** vs **ambient** split because their typical mix
  behaviour diverges (music ducks under dialogue; ambient does
  not).
- **dialogue** is its own bus because it's the most commonly
  ducked-against bus, and consumers need a stable name to wire
  ducking against.
- **sfx** holds everything transient.
- **master** is one knob for "everything quieter."

A sixth bus (e.g., `ui`) is consumer territory — the runtime
supports custom buses via `createBus(name, parent)`. The
framework's preset is the five named above.

### Ducking

```ts
audio.bus('dialogue').onPlay(() =>
  audio.bus('music').duck({
    targetDb: -12,
    attackMs: 200,
    holdMs: 0,
    releaseMs: 600,
  }),
);
```

The implementation is a `GainNode` automation, not a real
`DynamicsCompressorNode` — ducking is a curve, not a real-time
compressor, and the curve is cheaper.

## Asset shape

The audio runtime consumes the asset pipeline's Stage 6 output
(see asset-pipeline reference) — Opus primary + Vorbis fallback,
loudness-normalised to −16 LUFS. The buffer cache is
**manifest-driven, not URL-driven**:

```ts
import { registerManifest } from '@vibesmith/audio-runtime';

registerManifest({
  assets: {
    'sfx.footstep.stone': {
      key: 'sfx.footstep.stone',
      formats: {
        primary: 'sfx/footstep_stone.webm',
        fallback: 'sfx/footstep_stone.ogg',
      },
      durationMs: 380,
      channels: 1,
      defaultBus: 'sfx',
      hash: 'a8b3c7…',
    },
  },
}, { assetBase: '/audio/' });
```

Decoded buffers are cached in-memory keyed by `hash`. Two
manifest keys pointing at the same hash share one decoded
buffer.

### Streaming vs decoded

| Asset type | Strategy |
|---|---|
| SFX (< 5 s) | Fully decoded into `AudioBuffer` |
| Music / ambient loops (> 5 s) | Streamed via `MediaElementAudioSourceNode` |
| Dialogue | Streamed (variable length, often skipped) |

The 5-second threshold is the default; overridable per-asset via
`streaming: true | false`.

## Browser autoplay policy

The runtime uses a **deferred-init pattern**: the `AudioContext`
is created lazily on the first user gesture
(`pointerdown` / `keydown` / `touchstart`), and emitters that
requested autoplay before that gesture are queued and started in
declaration order once the context is live.

```ts
import { installAutoplayGate, unlockAudio } from '@vibesmith/audio-runtime';

// Auto: install once at app startup
installAutoplayGate();

// Or explicit: tie to a "click to start" button
button.addEventListener('click', () => unlockAudio());
```

Tab-visibility resumes the context on return-to-foreground; if
Safari refuses, the gesture queue re-arms so the next user
interaction unlocks.

## Performance budget

Per-tier ceilings compose with the adaptive-rendering tier:

| Tier | Concurrent emitters | Decoded buffers | Bus filters |
|---|---|---|---|
| LOW | 16 | 32 | per-bus lowpass only |
| MEDIUM | 32 | 64 | + compressor |
| HIGH | 64 | 128 | + convolution reverb |
| ULTRA | 128 | 256 | + multi-tap delay |

`audio.stats()` returns
`{ activeEmitters, decodedBuffers, contextTimeMs, dropouts }` —
read each frame by a performance critic.

## Scenario integration

Audio state is part of every scenario snapshot. On launch, bus
state restores before any emitter starts; active emitters
re-schedule at their recorded offset (a loop captured mid-cycle
resumes mid-cycle); applied recipes re-apply in declaration
order.

```ts
import { captureAudioState, restoreAudioState } from '@vibesmith/audio-runtime';

// On scenario capture: the scenario layer reads
const snapshot = captureAudioState();

// On scenario launch: the scenario layer writes
restoreAudioState(snapshot, {
  resolveEmitter: (snap) => myEmitterRegistry.get(snap.emitterId),
});
```

Determinism: pitch jitter reads from the scenario's `rngSeed` —
two launches of the same scenario produce the same audio
sequence.

## What this is NOT

- **Not a DAW.** No sends, returns, arbitrary nesting, plugin
  chains, automation curves beyond the bus-level duck / gain.
  Consumers wanting that surface eject to raw WebAudio nodes
  via `emitter.raw()`.
- **Not a runtime LLM surface.** No model touches audio bytes
  at runtime. AI involvement is at authoring time — picking
  recipes, adapting parameters, naming buses.
- **Not a replacement for a music engine.** Interactive music
  (vertical re-orchestration, horizontal re-sequencing) is a
  consumer-side authoring concern. The runtime exposes the
  mixer + ducking primitives the authoring layer needs.
- **Not a Web Audio polyfill.** Browsers without AudioContext
  fall back silently — no sound, no errors, no synthetic
  replacement. The framework targets evergreen browsers per the
  WebGL constraints baseline.
