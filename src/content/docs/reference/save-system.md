---
title: 'Save system'
description: 'Player-facing save-game / progress persistence for vibesmith: defineSaveSchema (versioned Zod save-doc + migrate chain), named + autosave slots with atomic writes, swappable IndexedDB / filesystem backends, and defineSaveParticipant for deterministic substrate capture/restore.'
---

Player-facing save-game / progress persistence. The engine-equivalent
of Unity's `SaveGame` / `PlayerPrefs`, Godot's `Resource.save` /
`ConfigFile`, Unreal's `USaveGame`, and Bevy's `bevy_save`. Lives in
`@vibesmith/save`.

An offline single-player game has no server, and its players still need
to keep their progress between sessions — that is what the save system
is for. Server-authoritative persistence is a separate, online-only
concern; dev snapshots are a separate, developer-only concern.

## Saves are not snapshots

These two look similar (both serialise runtime state) but serve
different masters:

| | **Save** (`@vibesmith/save`) | **Snapshot** |
|---|---|---|
| Audience | the **player** | the **developer** |
| Lifetime | persists across game updates | dev-iteration, discardable |
| Versioning | explicit `version` + `migrate` chain | unversioned capture |
| Migration | required — shipped games evolve | none — re-capture instead |
| Slots | named slots + autosave, load menu | tagged captures, launch-into-state |

A consumer reaches for **snapshots** to launch the game into a specific
state during development, and for **saves** to let a player keep their
game. They never share storage.

## The three layers

```
  defineSaveSchema(...)        ← the save-document shape + version + migrate
        │
  defineSaveParticipant(...)   ← each substrate's capture/restore slice
        │
  SaveManager → ctx.save       ← slot orchestration: write/read/list/delete
        │
  SaveStore                    ← storage backend (memory / fs / IndexedDB)
```

## 1. Declare the save schema

A typed (Zod) save document with an **explicit version** and a
**migration chain**. The version + migrate let a *shipped* game change
its save format without bricking existing players' saves.

```ts
import { z } from 'zod';
import { defineSaveSchema } from '@vibesmith/save';

const SaveSchema = z.object({
  player: z.object({ x: z.number(), y: z.number(), hp: z.number() }),
  inventory: z.object({ gold: z.number(), items: z.array(z.string()) }),
});

defineSaveSchema({
  id: 'game',          // stable for the life of the game
  version: 1,
  schema: SaveSchema,
});
```

When the game ships an update that changes the save shape, bump
`version` and add a `migrate` that handles every step from the lowest
shipped version up to the current one:

```ts
defineSaveSchema({
  id: 'game',
  version: 3,
  schema: SaveSchemaV3,
  migrate(old, fromVersion) {
    switch (fromVersion) {
      case 1: return { ...(old as object), gold: 0 };                // v1 → v2
      case 2: return { ...(old as object), gold: coinsToGold(old) }; // v2 → v3
      default: return old;
    }
  },
});
```

The framework runs the chain one version at a time on read, then
validates the migrated body against the current schema. A `version > 1`
schema **must** declare a `migrate`.

## 2. Register save participants

The save document is assembled from **participants** — each substrate
(player controller, inventory, quest state, NPC state, …) contributes a
slice. When you wire a new gameplay system, register a participant so
its state automatically joins every save.

```ts
import { defineSaveParticipant } from '@vibesmith/save';

defineSaveParticipant({
  id: 'player',
  order: 0,                       // lower restores first
  capture: (ctx) => {
    const o = ctx.object3D as THREE.Object3D;
    return { x: o.position.x, y: o.position.y, hp: readHp(ctx) };
  },
  restore: (ctx, data) => {
    if (!data) return;            // old save predates this participant → no-op
    const d = data as { x: number; y: number; hp: number };
    const o = ctx.object3D as THREE.Object3D;
    o.position.set(d.x, d.y, 0);
    writeHp(ctx, d.hp);
  },
});
```

**Deterministic capture order** is guaranteed: ascending `order`, then
lexicographic `id`. This gives byte-stable round-trips and lets a
participant restore *after* another (NPCs after the terrain they stand
on) by picking a higher `order`. A `restore` that receives `undefined`
means the save predates that participant — it should no-op or apply
defaults so **old saves stay loadable**.

## 3. Use the slot API

The runtime mounts a save manager as `ctx.save` (alongside `ctx.quest`
/ `ctx.npc`):

```ts
// Write the current state to a named slot (assembled from participants):
await ctx.save?.write('slot1', undefined, {
  label: 'Chapter 2 — Outskirts',
  playtimeSeconds: 3_600,
  thumbnailDataUrl: captureThumbnail(),   // optional
});

// Read + migrate + validate a slot:
const { body, meta, migrated } = await ctx.save!.read('slot1');

// Restore a slot into the live runtime (read + participant restore):
await ctx.save?.load('slot1', ctx);

// Autosave (writes the reserved 'autosave' slot):
await ctx.save?.autosave(ctx);

// Enumerate slots for a load menu (corrupt slots flagged, never thrown):
const slots = await ctx.save!.list();

// exists / delete:
if (await ctx.save!.exists('slot1')) await ctx.save!.delete('slot1');
```

Every `write` is **atomic** — no torn saves. Each slot carries a
metadata header (label, timestamp, playtime, optional thumbnail) a load
menu renders without deserialising the full body.

## Storage backends

`SaveStore` is a four-method keyed blob store. The framework ships three
implementations behind one interface:

| Store | Host | Atomicity |
|---|---|---|
| `MemorySaveStore` | tests / default fallback | trivially atomic |
| `FsSaveStore` | desktop | temp-write + atomic rename |
| `IndexedDbSaveStore` | browser (`@vibesmith/save/browser`) | IDB transaction |

The backend is **swappable** — a server-backed adapter is a later
option you can register, not a wrapper the framework forces.

## Corrupt-save safety

A corrupt or partial save must **never crash the boot**:

- `list()` reads every slot defensively. A torn / invalid / wrong-schema
  slot is reported with `corrupt: true` (and a salvaged metadata header
  where possible) so a load menu can render it greyed-out — it is never
  thrown.
- `read()` of a corrupt slot throws a typed `SaveCorruptError` carrying
  the slot id + the underlying cause, so you surface an inline "this
  save is damaged" message rather than a stack trace.
- A failed atomic write leaves the previous slot contents intact.

## AI-accessible

The save substrate is AI-accessible so an assistant can inspect /
manage save state during authoring or QA. Three deferred MCP tools —
`vibesmith.save.list`, `vibesmith.save.inspect`, `vibesmith.save.delete`
— plus a `vibesmith://save/slots` resource holding the slot-metadata
index. `defineSaveParticipant` is the discoverable hook an assistant
uses when wiring a new gameplay system.

## Settings vs saves

Player **settings / preferences** (keybinds, audio levels, graphics
tier) are *user-level* config — they belong to the player across all
their saves, not to a save slot. **Save games** are progress state.
Don't stuff settings into a save slot, and don't stuff progress into the
settings store.
