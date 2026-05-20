---
title: Quick start
description: Scaffold a new vibesmith project with `vibesmith init` and understand what lands on disk.
---

## Prerequisites

- Node.js 22 (recommended; the framework's pinned toolchain).
- `pnpm` (the scaffold writes a `pnpm-lock.yaml`; you can substitute
  `npm` or `yarn`).
- A sibling clone of the vibesmith framework repo at `../vibesmith/`
  (Phase-0 distribution; Phase-2 will publish to a registry).

## Scaffold

```sh
pnpm dlx @vibesmith/framework-cli init my-game
cd my-game
pnpm install
pnpm dev
```

You'll see a working R3F app with a rotating cube, a HUD overlay scene
picker, and the vibesmith dev shell (Hierarchy / Inspector / Console /
Scenarios) mounted around it in dev mode. Production builds drop the
dev shell entirely.

## What just landed

Application source (`src/`, zero framework imports):

| Path | What |
|---|---|
| `src/App.tsx` | Top-level component; mounts `<Canvas>` + DOM `<Hud>`. |
| `src/world/World.tsx` | Canvas contents; lights + active scene. |
| `src/hud/Hud.tsx` | DOM overlay with scene picker. |
| `src/scenes/MainScene.tsx` + `registry.ts` | Scene composer pattern. |
| `src/state/game-store.ts` | Zustand store; one slice per concern. |
| `src/input/use-input.ts` | Ref-based input hook (WASD + arrows + space). |
| `src/assets/preload.ts` | `useGLTF.preload` patterns for assets. |

Framework + tooling (deletable on eject):

| Path | What |
|---|---|
| `.vibesmith/config.ts` | Framework pin + project config. |
| `.vibesmith/manifest.json` | Installed vibesmith extensions. |
| `.mcp.json` | MCP server registry (auto-discovered by Cursor / Claude Code / Codex CLI). |
| `AGENTS.md` | Tool-agnostic agent instructions + reading list. |
| `agents/` | Project-specific agent prompts. |
| `vibesmith eject` (CLI) | One-way removal of vibesmith — dry-run by default; `--apply` to mutate. |

## Working in the project

| Command | What |
|---|---|
| `pnpm dev` | Vite dev server + HMR. |
| `pnpm build` | Production bundle. |
| `pnpm typecheck` | Strict TypeScript. |
| `vibesmith doctor` | Read-only project health check (manifest, compat range, deps drift, conventional folders, template baseline, …). |
| `vibesmith doctor --upgrade-project` | Bump `[project].vibesmith` in `vibesmith.toml` to satisfy the running binary. Interactive; `--yes` skips the confirm, `--dry-run` shows the planned change without writing. |
| `vibesmith doctor --json` | Machine-readable doctor output for CI / agents. |
| `vibesmith doctor --llm-providers` | Probe the three subscription-relay CLIs (`claude` / `codex` / `copilot`) for `--version` reachability and report direct providers configured in `~/.config/vibesmith/config.toml`. Combine with `--json` for the structured `schemaVersion: 1` report. Authentication is left to each host CLI — vibesmith won't spawn paid calls just to verify a login. |
| `vibesmith add-extension <id>` | Install a standard extension. |
| `vibesmith upgrade` | Pin-drift report + interactive bump. Auto-detects project shape: `vibesmith.toml` projects (caret semver pin), SHA-pinned consumers via `.vibesmith/config.ts` `frameworkRef`. Lists the commit subjects landing in the range before prompting. Flags: `--to <ref>` (target a non-HEAD ref), `--yes`, `--dry-run`, `--json`. |
| `vibesmith asset-pipeline optimize <path>` | Run the glTF optimize pipeline (drop unused channels, quantise, optionally Draco) on a single `.glb` or directory tree. Accepts `--tier LOW\|MEDIUM\|HIGH\|ULTRA` to apply the per-tier matrix (LOW/MEDIUM/HIGH add Draco; ULTRA preserves precision). `--out <path>` chooses the output; `--no-cache` reprocesses fresh outputs. |
| `vibesmith asset-pipeline compress-textures <path>` | Re-encode embedded textures to WebP via per-slot presets (`albedo` lossy, `normal`/`orm` lossless, `emissive`/`ui` lossy). `--max-axis <pixels>` applies an aspect-preserving Lanczos3 resize (useful for per-tier variants). |
| `vibesmith asset-pipeline pack-orm <dir>` | Walk `<dir>` for `<base>.{ao,rough,metal}.png` triplets and pack each into `<base>.orm.png` (R=AO, G=Roughness, B=Metalness). Accepts variant suffixes (`occlusion`/`roughness`/`metalness`/`metallic`). Sidecar `<base>.orm.json` skips or overrides per-triplet. |
| `vibesmith asset-pipeline manifest <root> --out <path>` | Emit `asset-manifest.json` from `<root>`: sha256 + real bounds + animations + tags per entry. Repeat `--variant TIER=<dir>` to attach per-tier variants (LOW/MEDIUM/HIGH/ULTRA). |

`vibesmith doctor` detects two project shapes:

- Projects scaffolded by `vibesmith init` (this guide) — checks the
  CLI surface (`STATUS.md` framework pin, sibling-vibesmith
  checkout, biome / vitest shared configs, script wrapping).
- Projects scaffolded by the vibesmith desktop binary (folders
  with `vibesmith.toml`) — checks the binary-side contract
  (manifest validity, `[project].type`, binary compat range,
  `[deps]` drift vs `.vibesmith/deps-lock.json`, runtime overlap,
  conventional folder presence, template baseline). See the
  [project upgrade model](/vibesmith-docs/reference/project-upgrade-model/)
  reference for the full surface.

## Next steps

- Browse the [**Cookbook**](/vibesmith-docs/cookbook/) for high-leverage
  recipes (instancing, animations, perf debugging).
- Skim [**Anti-patterns**](/vibesmith-docs/anti-patterns/) before
  writing scene-graph code; #1–#4 cover most stutter / leak bugs.
- Read the [**Reference**](/vibesmith-docs/reference/) for WebGL limits,
  performance budgets, and engine-pattern translation guides.

## Ejecting

If you ever want to remove vibesmith entirely:

```sh
vibesmith eject              # dry-run; prints the plan
vibesmith eject --apply      # actually mutate
vibesmith eject --apply --purge   # also remove AGENTS.md + agents/
```

The command refuses to run with a dirty git tree so the change is
reversible via `git checkout`. App code under `src/` has zero framework
imports — eject is delete-the-boundary, not rewrite-the-app.
