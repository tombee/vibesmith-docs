---
title: 'R3F anti-patterns'
description: 'Mistakes that bite consumers, recurringly. Each one is *easy* to write and *hard* to catch by reading code — the symptom is usually "feels slow" or "leaks...'
---

Mistakes that bite consumers, recurringly. Each one is *easy* to
write and *hard* to catch by reading code — the symptom is
usually "feels slow" or "leaks memory" several layers away from
the cause.

Pair with the [cookbook](cookbook/README.md): cookbook recipes
route around these failure modes by construction.

Numbered for stable cross-references; never renumber, only
append.

---

## 1. Allocating per frame in `useFrame`

**Symptom:** sawtooth memory graph, periodic GC pauses, stutter
under load.

**The mistake:**

```tsx
useFrame(() => {
  const target = new Vector3(x, y, z);   // ← new Vector3 every frame
  mesh.position.lerp(target, 0.1);
});
```

`useFrame` runs 60+ times per second. Every `new Vector3()` /
`new Quaternion()` / `new Matrix4()` / `{x, y, z}` literal
allocates. GC eventually collects, freezing the frame for
tens of milliseconds.

**The fix:** hoist scratch objects to module scope.

```tsx
const tmp = new Vector3(); // module-level; created once

useFrame(() => {
  tmp.set(x, y, z);
  mesh.position.lerp(tmp, 0.1);
});
```

Same rule for `new Color()`, `new Euler()`, array literals,
object literals used as Three constructor args, `.clone()`
calls — anything that allocates.

---

## 2. Setting React state every frame

**Symptom:** React DevTools profiler shows continuous
re-renders; component tree shows commits at every animation
frame; slow at scale.

**The mistake:**

```tsx
const [x, setX] = useState(0);
useFrame(() => {
  setX((v) => v + 0.01);  // ← schedules a React re-render every frame
});
return <mesh position-x={x} />;
```

React's render loop is not the animation loop. Setting state
every frame triggers reconciliation, prop diff, commit — orders
of magnitude more work than just mutating a Three object.

**The fix:** mutate refs / direct Three properties.

```tsx
const ref = useRef<Mesh>(null!);
useFrame(() => {
  ref.current.position.x += 0.01;  // direct mutation; no React involved
});
return <mesh ref={ref} />;
```

React state is for things React renders. Three transforms are
not those things.

---

## 3. Missing `dispose` on runtime-authored resources

**Symptom:** `gl.info.memory.geometries` / `.textures` grows
over time (see [perf-debugging.md](cookbook/perf-debugging.md));
eventual GPU-memory exhaustion on long sessions.

**The mistake:**

```tsx
useEffect(() => {
  const geo = new BoxGeometry();
  const mat = new MeshStandardMaterial();
  scene.add(new Mesh(geo, mat));
  // ← never dispose anything when the effect tears down
}, []);
```

R3F auto-disposes resources declared in JSX (`<boxGeometry />`,
`<meshStandardMaterial />`). Resources you create
imperatively are *yours* — Three doesn't know to clean them up.

**The fix:**

```tsx
useEffect(() => {
  const geo = new BoxGeometry();
  const mat = new MeshStandardMaterial();
  const mesh = new Mesh(geo, mat);
  scene.add(mesh);
  return () => {
    scene.remove(mesh);
    geo.dispose();
    mat.dispose();
  };
}, []);
```

Same rule for `Texture`, `ShaderMaterial.uniforms` that wrap
textures, `RenderTarget`, `BufferGeometry`. **Prefer JSX
declaration** so R3F handles the lifecycle.

---

## 4. Multiple `<Canvas>` instances

**Symptom:** GPU memory doubles per Canvas; "context lost"
errors on mobile / older Intel chips; perf inexplicably bad on
machines that should handle the scene.

**The mistake:** mounting two `<Canvas>` instances for "main
viewport + minimap" or "two scenes side-by-side".

Each Canvas spins up its own WebGL context. Browsers cap
contexts per page (typically 8–16); context-switching cost is
nontrivial; and you pay full renderer state per Canvas.

**The fix:** one Canvas, multiple `<View>`s from drei.

```tsx
import { View } from '@react-three/drei';

<>
  <div style={{ width: '70%' }} ref={mainView} />
  <div style={{ width: '30%' }} ref={miniView} />

  <Canvas eventSource={containerRef}>
    <View track={mainView}><MainScene /></View>
    <View track={miniView}><MinimapScene /></View>
  </Canvas>
</>
```

One context, one renderer, many viewports.

---

## 5. Forgetting `Suspense` around async loaders

**Symptom:** "Hook called outside of Suspense boundary" error,
or first frame renders the fallback / crashes.

**The mistake:**

```tsx
function World() {
  const { scene } = useGLTF('/models/level.glb'); // ← suspends
  return <primitive object={scene} />;
}
// no Suspense parent
```

`useGLTF`, `useTexture`, `useFBX` all suspend while loading.
React throws a promise; without a Suspense boundary, the
component tree errors.

**The fix:** wrap loaders in `<Suspense>`.

```tsx
<Canvas>
  <Suspense fallback={null}>
    <World />
  </Suspense>
</Canvas>
```

And preload at module scope so the first render doesn't pause
on a fetch:

```ts
useGLTF.preload('/models/level.glb');
```

---

## 6. Recreating materials per instance

**Symptom:** `gl.info.programs` count grows with entity count;
first-frame shader compile stalls; high GPU CPU-side cost.

**The mistake:**

```tsx
{entities.map((e) => (
  <mesh key={e.id} position={e.position}>
    <boxGeometry />
    <meshStandardMaterial color={e.color} />  // ← new material per instance
  </mesh>
))}
```

Every distinct material is a distinct compiled shader program.
Hundreds of materials = hundreds of programs.

**The fix:** share the material; vary cheap properties on
`<mesh>` or instance-color.

```tsx
const sharedMat = useMemo(() => new MeshStandardMaterial(), []);

{entities.map((e) => (
  <mesh key={e.id} position={e.position} material={sharedMat}>
    <boxGeometry />
  </mesh>
))}
```

For per-instance color, switch to instancing — see
[cookbook/instancing.md](cookbook/instancing.md).

---

## 7. Animating via `setState` instead of refs

Same root cause as anti-pattern #2. Called out separately
because it specifically appears wrapped in `setInterval` /
`requestAnimationFrame` ad-hoc (not in `useFrame`) — easy to
miss in code review.

**The mistake:**

```tsx
useEffect(() => {
  const id = setInterval(() => setRotation((r) => r + 0.05), 16);
  return () => clearInterval(id);
}, []);
```

Same fix as #2: use a ref, mutate in `useFrame`.

---

## 8. Ignoring `useFrame` priority for ordered work

**Symptom:** subtle ordering bugs (camera updates lag entities;
post-processing reads stale uniforms; physics ticks fire after
render).

**Background:** R3F runs `useFrame` callbacks in priority order
(default 0). Negative priorities run before render; positive
priorities run after.

**The fix when you need ordering:**

```tsx
// physics step: before camera, before render
useFrame((_, dt) => world.step(dt), -2);

// camera follow: after physics, before render
useFrame((state) => updateCameraFollow(state), -1);

// render happens here (priority 0 in r3f's default loop)

// post-frame readback (e.g. screenshot, frame-capture)
useFrame((state) => capture(state.gl), 1);
```

Default to priority 0. Reach for explicit priorities only
when ordering matters.

---

## 9. Reading `gl.info` from React state

**Symptom:** stats display jitters; performance overlay itself
shows up in profiler as expensive.

**The mistake:**

```tsx
const [calls, setCalls] = useState(0);
useFrame(() => setCalls(gl.info.render.calls));  // ← state per frame
return <div>{calls}</div>;
```

You've reintroduced anti-pattern #2 while trying to *measure*
performance.

**The fix:** mutate a DOM node directly, or use drei's `<Stats>`.

```tsx
const ref = useRef<HTMLDivElement>(null!);
useFrame(() => {
  if (ref.current) ref.current.textContent = String(gl.info.render.calls);
});
return <div ref={ref}>0</div>;
```

---

## 10. `<Html>` for static text that could be in-canvas

**Symptom:** transparent overlay flickers on resize, fights with
canvas event handling, doesn't z-sort correctly with other 3D
objects.

**The mistake:** using drei's `<Html>` for things like floating
nameplates that occlude correctly with geometry.

**The fix:** for text that lives in the world (occluded by
geometry, scales with distance, z-sorts with 3D), use
`<Text>` from `troika-three-text` (via drei's `<Text>`). It's
geometry, not DOM — much faster and behaves correctly.

`<Html>` is right for DOM things (input fields, complex
HUD widgets, browser-native interactions) attached to 3D
positions. Wrong for "just text on a thing".

---

## 11. Importing all of drei

**Symptom:** dev-mode bundle balloons; production tree-shaking
inconsistent on some bundlers.

**The mistake:**

```ts
import * as drei from '@react-three/drei'; // ← pulls everything
```

drei is huge. Star imports defeat tree-shaking in some Vite /
Webpack configurations.

**The fix:** named imports.

```ts
import { OrbitControls, Grid, Text } from '@react-three/drei';
```

Check production build size after adding drei components —
some (`<Environment>` with HDR textures, `<MeshPortalMaterial>`,
postprocessing-coupled helpers) pull large dependencies.

---

## 12. Not using `dispose={null}` when caching

**Symptom:** mounting/unmounting the same cached geometry across
scene transitions causes "Cannot read property 'attributes' of
undefined" or invisible meshes.

**Context:** R3F auto-disposes JSX-declared geometries when a
component unmounts. If you cached that geometry to reuse it
elsewhere, dispose just nuked it.

**The mistake:**

```tsx
// stored in a module-level cache; reused across scenes
const cachedGeo = new BufferGeometry();

function MaybeMounted() {
  return showThing ? <mesh geometry={cachedGeo}><meshStandardMaterial /></mesh> : null;
  // when this unmounts, R3F calls cachedGeo.dispose() — and the next mount has a dead geometry
}
```

**The fix:** tell R3F not to dispose.

```tsx
<mesh geometry={cachedGeo} dispose={null}>
  <meshStandardMaterial />
</mesh>
```

`dispose={null}` opts out of R3F's auto-dispose. You're now
responsible for the geometry's lifecycle — dispose it when the
cache itself goes away.

---

## How to add an anti-pattern

When you catch a mistake more than once across consumer
projects:

1. Append a new numbered entry here (never renumber existing
   ones; cookbook recipes cross-link by `#NN-slug`).
2. Cross-link from the relevant cookbook recipe(s).
3. If the anti-pattern has a *detector* (lint rule, type guard,
   runtime warning), file a tooling-opportunity entry in
   proactive-ledger.md.

Anti-patterns drift downward: once a detector lands, the
anti-pattern entry becomes documentation for *why* the detector
exists. Don't delete entries.
