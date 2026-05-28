---
title: 'Project upgrade model'
description: 'How a vibesmith project survives a framework binary upgrade — customer-owned vs framework-managed split, [deps] install flow, vibesmith doctor health report, opt-in starter diff, semver upgrade ceremony.'
---

How a vibesmith project survives a framework binary upgrade.
Covers: what's customer-owned vs framework-managed inside the
project folder, the `[deps]` install flow, the `vibesmith doctor`
health surface, the opt-in starter-diff at upgrade time, and the
semver upgrade ceremony.

Companion to the [scene construction](/vibesmith-docs/reference/scene-construction/)
+ [engine patterns](/vibesmith-docs/reference/engine-patterns/)
references, which cover the steady-state project shape; this doc
covers what happens at the **transitions** between framework
versions.

## The shape of the question

A customer scaffolds a project against vibesmith `0.0.1`. They
edit scenes, write scripts, add packages via `[deps]`, configure
their AI agents. Six months later they install vibesmith `0.4.0`
and try to open the project. What happens?

The Unity reference is the right one: don't auto-migrate content,
surface compat as edit-time signals, let the customer choose when
to upgrade their own pieces. Unity opens a v2022 project in v6 by
warning loudly + offering a one-shot bump; it does not silently
rewrite the user's `.unity` scenes.

vibesmith commits to the same posture.

## In one sentence

**Customer content (scenes / scripts / assets / configs they
wrote) is never auto-modified by the binary; framework-managed
state (under `.vibesmith/`) is the only thing the binary owns and
can rewrite; everything else moves on the customer's explicit
approval.**

---

## Customer-owned vs framework-managed

Every byte inside a project folder belongs to exactly one of these
two categories. The binary's behaviour at upgrade time depends on
the category.

### Customer-owned

| Path | Contents |
|------|----------|
| `vibesmith.toml` | Project manifest. Customer edits `[project].vibesmith`, `[deps]`, etc. |
| `scenes/` | `.scene.json` files. |
| `prefabs/` | Recipes + generators + AI briefs. |
| `assets/` | Source assets + content-addressable cache. |
| `scripts/` | Plugin TypeScript scripts (`project.ts`, others). |
| `scenarios/` | Saved scenarios. |
| `agents/` | Agent prompt definitions. |
| `docs/game/` | Project-specific docs. |
| `package.json` | Customer adds it once they pull in `[deps]`. Theirs from then on. |
| `node_modules/` | Customer's installed deps. |

**Rule:** the binary may *read* any of these. The binary may not
*write* any of these without explicit customer approval (a button
click, a CLI command flag — never a silent modification).

The one exception is the *create flow* (`vibesmith init` / File →
New Project): the wizard writes a starter scene, starter entry
script, and `package.json` *once*, before the project is
customer-owned. After the first open these become customer bytes.

### Framework-managed

| Path | Contents |
|------|----------|
| `.vibesmith/` | Binary state. |
| `.vibesmith/manifest.lock` | `{ scaffolded_with, template }` baseline (planted at create). |
| `.vibesmith/deps-lock.json` | Last-installed `[deps]` fingerprint. |
| `.vibesmith/state.json` | Last-active scene, panel layout overrides. |
| `.vibesmith/cache/` | Compilation cache, derived asset variants. |

**Rule:** the binary owns `.vibesmith/` entirely. The customer
shouldn't edit it; the binary can recreate / overwrite anything
inside on every open. Source-controlling `.vibesmith/manifest.lock`
is *encouraged* (so the upgrade flow knows the project's baseline);
source-controlling `.vibesmith/cache/` is *discouraged* (per the
gitignore the wizard plants).

The split mirrors Unity's `Library/` (framework-managed) vs
`Assets/` (customer-owned) — `Library/` is recreated from
`Assets/` and never source-controlled.

---

## `[deps]` install flow

The project manifest's `[deps]` table lists script-only deps the
project pulls — typically `lodash`, `ulid`, custom math libs. The
binary doesn't install them silently — install is a
customer-visible step.

### When the binary triggers an install

The binary computes a `[deps]` fingerprint on each project open
(stable hash of the sorted `name:version` pairs). If the
fingerprint differs from the last-installed fingerprint stored in
`.vibesmith/deps-lock.json`, the binary surfaces a banner:

> *This project's dependencies changed. Install now?*

`[Install]` `[Skip]`

- **Install** runs `pnpm install` against the project's
  `package.json` (the binary writes a minimal `package.json` if
  none exists; falls back to `npm install` when pnpm isn't on
  PATH). Updates `.vibesmith/deps-lock.json` with the new
  fingerprint.
- **Skip** leaves the state alone. Banner reappears next open.

Dep removal is symmetric: if `[deps]` shrinks, the banner offers
an `[Uninstall removed]` action. Conservative — `pnpm install`
doesn't prune by default.

### Conflicts with the binary's bundled runtime

The binary's bundled runtime (React, Three, R3F, dockview,
`@vibesmith/runtime`) is the *only* copy. `[deps]` listing any of
them is an error — `vibesmith doctor` fails with:

> *Dependencies overlap with the vibesmith runtime. Remove these
> from `[deps]`: react, three. The binary's copies are the only
> copies.*

This is the same constraint Unity enforces on Asset Store packages
that try to ship duplicate `UnityEngine.dll`.

---

## `vibesmith doctor` — health check + upgrade signal

`vibesmith doctor` is the canonical "is my project alive?" command.
It runs read-only — it never mutates the project. Output is
plain-text actionable; an `--json` flag emits the same data for
agent / CI consumption.

### What it checks

For an ADR-0004 binary project (folder with `vibesmith.toml`):

- **Project manifest** — parses + has the required `[project].name`.
- **Project type** — `[project].type` is set (`"3d"` or `"2d"`).
- **Binary compat** — running binary version satisfies
  `[project].vibesmith`. Three states: match (silent ✓), newer
  range (fail with version gap message), older range (warn with
  `--upgrade-project` suggestion).
- **`[deps]` drift** — fingerprint vs `.vibesmith/deps-lock.json`.
  Warns when the lock is missing or the fingerprint differs.
- **`[deps]` overlap with bundled runtime** — fails when `[deps]`
  lists any package the binary already inlines.
- **Conventional folders** — reports which of scenes / prefabs /
  assets / scripts / scenarios / agents are present.
- **Template baseline** — reads `.vibesmith/manifest.lock`,
  reports `{ scaffolded_with, template }` so the user (or a
  triage agent) knows what version the project started at.

### Output shape

```text
$ vibesmith doctor

vibesmith doctor

  ok  project manifest — my-game (vibesmith.toml at project root)
  ok  project type — 3d
warn  binary compat — binary 0.0.0 does not satisfy "^0.1.0".
        Bump [project].vibesmith (after reading the CHANGELOG between
        versions) or install a binary matching the project's range.
  ok  deps drift — no [deps] declared
  ok  deps overlap — no overlap with bundled runtime
  ok  conventional folders — scenes, assets, scripts
  ok  template baseline — scaffolded 0.0.1, template 3d-starter@1

1 warning.
```

### `vibesmith doctor --upgrade-project`

Bumps `[project].vibesmith` in the project's `vibesmith.toml` to
a caret range against the running binary's version (`^X.Y.Z`).
Touches **only** the pin line — customer content (scenes,
scripts, configs) is untouched.

Interactive by default: prints `old → new` + a CHANGELOG warning
about pre-1.0 minor bumps, then asks for confirmation.

| Flag | Behaviour |
|---|---|
| `--upgrade-project` | Apply the pin bump (interactive). |
| `--yes` | Skip the confirm prompt. |
| `--dry-run` | Print the plan without writing. |
| `--binary-version <version>` | Override which version the new pin should satisfy (defaults to `$VIBESMITH_BINARY_VERSION` or the sibling `vibesmith/VERSION`). |

The doctor refuses to write when the rewriter can't find the
`vibesmith =` line — it never corrupts a manifest.

### `vibesmith upgrade`

The unified upgrade surface. Auto-detects project shape and
dispatches to the right writer:

- **`vibesmith.toml` projects** — delegates to the same planner /
  rewriter `--upgrade-project` uses. Same caret-against-binary
  semantics; same `--yes` / `--dry-run` ergonomics.
- **SHA-pinned consumers** (legacy `vibesmith init`–scaffolded
  shape with `.vibesmith/config.ts` `frameworkRef: '<sha>'`) —
  compares the pinned SHA to the sibling framework checkout's
  `HEAD` (or `--to <ref>`), prints the commit subjects that land
  in the range, and offers to rewrite `frameworkRef` to the new
  SHA.

| Flag | Behaviour |
|---|---|
| `--cwd <path>` | Project root (defaults to current dir). |
| `--framework <path>` | vibesmith repo root (SHA-pinned shape; defaults to `../vibesmith`). |
| `--to <ref>` | Target ref (sha / branch / tag) for SHA-pinned consumers. Defaults to `HEAD`. |
| `--yes` | Skip the confirm prompt. |
| `--dry-run` | Print the plan without writing. |
| `--json` | Emit the plan as JSON (for CI / assistant consumption). |
| `--binary-version <version>` | Override the binary version for `vibesmith.toml` projects. |
| `--refresh` (alias `--force-repack`) | Repack the bundled `.vibesmith/.cache/pkgs/<version>/` tarballs from the framework source even when the pin already satisfies the binary, then re-install. Pre-1.0 the framework's HEAD moves under a fixed `0.0.x` version, so consumers need a way to resync stale tarballs without bumping. Pairs with `--dry-run` to preview. |
| `--no-install` | Skip the post-refresh `pnpm install` (see below). Default is to run it so the refresh is self-completing; opt out for CI / scripted upgrades. |

### Self-completing refresh

`--refresh` repacks the bundled `@vibesmith/*` tarballs, then runs
`pnpm install --no-frozen-lockfile` so the upgrade leaves the
project in a consistent state: the lockfile re-integrities against
the new tarballs (a later `--frozen-lockfile` CI install passes) and
`node_modules/@vibesmith/*` re-extracts (newly-shipped files land on
disk). Without that final install the lockfile keeps the old
integrity hashes and `node_modules` runs stale code even though the
refresh reported success. Pass `--no-install` to batch the install
yourself. The bundled tarballs are self-resolving — each one's
`@vibesmith/*` deps point at sibling `file:` tarballs in the same
cache dir, so the install needs no registry access.

The commit list is capped at 25 entries; longer ranges show a
`… and N more` hint pointing the user at `git log` in the
framework repo for the full picture. Migrators proper aren't
shipped yet — the first one lands when a real breaking change
rolls out, and will hook in at the post-plan / pre-write step.

---

## Optional starter-diff at upgrade

The wizard plants `.vibesmith/manifest.lock` recording the
template id + framework version the project was scaffolded with
(e.g. `{ scaffolded_with: "0.0.1", template: "3d-starter@1" }`).
This is the **diff baseline** for an opt-in upgrade flow:

`vibesmith doctor --show-starter-diff` (planned; not shipped at
the time of writing) will:

1. Read `.vibesmith/manifest.lock` for the original template +
   version.
2. Load the framework's *current* version of that template.
3. Render a unified diff of the starter content (scenes,
   scripts) — what changed between the original template and
   the current one.
4. **Not modify any customer file.** The diff is read-only.

The customer applies the parts they want by hand. Like Unity's
*Package Manager → Reset* on a starter package — surfaces the
delta, doesn't apply it.

---

## Semver upgrade ceremony

When the binary version exceeds the project's `[project].vibesmith`
range, the open flow:

1. **Refuses to open** by default. Banner explains the version gap.
2. **Offers `--upgrade-project`** as the explicit fix.
3. **Pre-1.0 minor bumps may break consumers.** Read the CHANGELOG
   entry for the version you're bumping to, apply any per-CHANGELOG
   migrations by hand, then run `vibesmith doctor` to verify.
4. **Post-1.0 minor bumps are compatible by promise.** No
   customer-visible migration; the pin bump is the whole story.
5. **Major version bumps ship migration tooling.** A new flag
   (`vibesmith doctor --migrate 1.x-to-2.x`, planned) walks
   specific known migrations. Each migration writes a *diff* the
   customer reviews + accepts. Same rule as starter-diff: never
   silent.

This is a stricter posture than typical pnpm-ecosystem packages,
which often silent-bump on `pnpm install`. The framework's
contract surface (plugin factories, scene schema) is large enough
that silent bumps would break consumers regularly. Explicit pin
bumps make the upgrade a *decision*.

---

## See also

- [Quick start](/vibesmith-docs/getting-started/quick-start/) —
  the CLI surface (`vibesmith doctor`, `vibesmith init`, etc.).
- [Scene construction](/vibesmith-docs/reference/scene-construction/)
  — the customer-owned scene format the upgrade model preserves.
- [Engine patterns](/vibesmith-docs/reference/engine-patterns/)
  — Unity-ism translations the upgrade ceremony borrows from.
