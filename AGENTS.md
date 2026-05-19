# vibesmith-docs — AGENTS.md

Tool-agnostic instructions for any AI coding agent working in this
repo (Cursor / Aider / Codex CLI / Claude Code / any
AGENTS.md-aware tool).

This repo hosts the public documentation site for the
[vibesmith framework](https://github.com/tombee/vibesmith) at
<https://tombee.github.io/vibesmith-docs/>. Built with Astro
Starlight, deployed to GitHub Pages on push to `main` via
`.github/workflows/deploy.yml`.

## Working style

- Terse, no padding.
- Edit existing content before creating new.
- Game-agnostic only — vibesmith is engine + genre-agnostic.
  Generic vocabulary (entities, props, characters). Consumer
  game-specific tone / lore / asset choices belong in each
  consumer's `docs/game/`, not here.
- Code-first, caveat-driven. Recipes have a "Watch out for"
  section.
- No marketing fluff. Docs are for getting work done.

## What's canonical here vs mirrored

This site is the **public-facing** layer. Some content is
authored here as the single source of truth; some is mirrored
from the private framework repo. Know the difference before
editing.

### Canonical here (write changes only in this repo)

- `cookbook/` — recipes (instancing, animations,
  perf-debugging, …). Add new recipes here directly.
- `anti-patterns.md` — numbered list of recurring R3F mistakes.
  Append only; never renumber.
- `agents/` (in `src/content/docs/`) — agent-facing intent
  mapping.
- `public/llms.txt` — root-level agent manifest. Update when
  the page list changes.
- `getting-started/` — quickstart + intro.

### Mirrored from the framework repo (changes go in both)

These docs exist in both `tombee/vibesmith` (`docs/`) and here
(`reference/`). Pending a sync action, both copies must be
updated together when content changes:

- `reference/engine-patterns.md`
- `reference/scene-construction.md`
- `reference/prefab-system.md`
- `reference/material-system.md`
- `reference/performance-budgets.md`
- `reference/webgl-constraints.md`
- `reference/adaptive-rendering.md`
- `reference/renderer-configuration.md`
- `reference/qa-strategy.md`
- `reference/scenario-driven-dev.md`
- `reference/director-pattern.md`
- `reference/ai-assistant.md`

A sync action (so this repo is fed from the framework
automatically) is logged in the framework's
`docs/proactive-ledger.md` as a follow-up. Until that lands,
mirror by hand.

### Never lives here

Framework-internal architecture artifacts stay in
`tombee/vibesmith`:

- ADRs
- `roadmap.md` / Track docs
- `methodology.md`
- `distribution-model.md`
- `proactive-ledger.md`
- `roles-map.md`
- `cross-genre-portability.md`

These are about *building* vibesmith, not *using* it. Consumers
don't read them.

## Conventions

- Every page has frontmatter: `title:` + `description:` (~160
  chars max).
- Page slugs derive from path; keep them stable. If you rename,
  add a redirect-equivalent path or update inbound links across
  the site + framework's AGENTS.md scaffold (which links to
  these URLs).
- Cross-references between pages use relative paths
  (`../cookbook/instancing.md`) — Starlight resolves them at
  build.
- Anti-pattern entries are numbered for stable
  `#NN-slug` cross-references from cookbook recipes.
- When adding a recipe / anti-pattern / reference doc, also
  update `public/llms.txt`.

## Workflows

### Local development

```sh
pnpm install
pnpm dev      # http://localhost:4321/vibesmith-docs/
pnpm build    # verifies the production build
```

### Adding a cookbook recipe

1. Copy an existing entry (e.g. `cookbook/instancing.md`) — keep
   the shape (intro → when to use → code → caveats → when not
   to use → related).
2. Write working JSX/TS, not pseudo-code.
3. Add a "Watch out for" section enumerating failure modes.
4. Cross-link relevant anti-patterns by `#NN-slug`.
5. Update `public/llms.txt` to list the new page.

### Adding an anti-pattern

1. Append to `anti-patterns.md`. Next number; never renumber
   existing entries (cookbook recipes link by `#NN-slug`).
2. Body: symptom → mistake (code) → fix (code).
3. Cross-link cookbook recipes that route around the
   anti-pattern.
4. Update `public/llms.txt` if you want it surfaced separately
   (the section itself is already listed).

### Brand tokens — sync with the framework app

The visual register (colours, type, radius, spacing) is shared
between this docs site and the framework's desktop app. The
**source of truth** is `apps/vibesmith-app/index.html` in the
framework repo — the `<style>` block at the top of `<head>`
where the design tokens live.

This site mirrors the tokens in
[`src/styles/vibesmith-theme.css`](src/styles/vibesmith-theme.css)
(loaded via Starlight's `customCss` config). When the app's
tokens change, mirror them here in the same PR or the next
matching one. Keep the comment block at the top of the theme
file current with the token list.

The agent page (`agents/index.md`) is intentionally **omitted
from the human sidebar** but stays reachable via direct URL +
`public/llms.txt` (the agent manifest). The reasoning: agent-
focused content is reading material for AI, not navigation
material for human readers browsing the docs.

### Deploying

Pushed to `main` → `.github/workflows/deploy.yml` runs → static
build → published to GitHub Pages. No manual step. Custom domain
swap is a future option (update `site` + remove `base` in
`astro.config.mjs`).

## Doc index

- [`README.md`](README.md) — high-level overview + commands.
- [`src/content/docs/index.md`](src/content/docs/index.md) —
  site landing page.
- [`astro.config.mjs`](astro.config.mjs) — Starlight site config
  (title, sidebar, base path).
- [`public/llms.txt`](public/llms.txt) — agent-discoverable
  manifest.

## When you're stuck

This site is downstream of the framework. If you're unsure
whether content belongs here or in `tombee/vibesmith`, the
rule of thumb: "Is this something a consumer or their agent
needs to read to *use* vibesmith?" → here. "Is this about *how
the framework itself is built / extended*?" → there.
