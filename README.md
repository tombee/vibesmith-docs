# vibesmith-docs

Public docs for the [Vibesmith](https://github.com/tombee/vibesmith)
framework. Built with [Astro Starlight](https://starlight.astro.build).

Live site: <https://tombee.github.io/vibesmith-docs/>

## What lives here

Consumer-facing content — anyone *building on* Vibesmith should be
able to do their work without reading the framework source:

- **Cookbook** — short, code-forward recipes (instancing,
  animations, perf debugging, …).
- **Anti-patterns** — numbered list of recurring R3F mistakes.
  Stable `#NN-slug` cross-references; append-only.
- **Reference** — framework reference docs (engine patterns,
  WebGL constraints, performance budgets, adaptive rendering,
  materials, scene construction, …).
- **Agent context** — terse intent-to-doc mapping for AI coding
  agents. Backed by [`llms.txt`](public/llms.txt) at the site
  root following the [llms.txt convention](https://llmstxt.org/).

What *doesn't* live here (intentionally): ADRs, internal roadmap,
methodology, distribution model, proactive ledger. Those are
framework-internal architecture artifacts and stay in the
private framework repo.

## Local development

```sh
pnpm install
pnpm dev      # local dev server at http://localhost:4321/vibesmith-docs/
pnpm build    # static build to ./dist/
pnpm preview  # preview the built site locally
```

Content lives under `src/content/docs/`. Each `.md` / `.mdx` file
becomes a route based on its path. Frontmatter `title` + `description`
required.

## Deployment

GitHub Actions builds + deploys to GitHub Pages on every push to
`main` (see `.github/workflows/deploy.yml`). The `main` branch is
the source of truth; rendered output lives at the URL above.

A custom domain is a future option — update `site` + remove `base`
from `astro.config.mjs` when it lands.

## Adding content

- **Cookbook recipes:** copy an existing entry (e.g.
  `cookbook/instancing.md`), keep the same shape (intro → when to
  use → code → caveats → when not to use → related). Code-first;
  caveat-driven; game-agnostic.
- **Anti-patterns:** append to `anti-patterns.md` with the next
  number. Never renumber; cookbook recipes cross-link by stable
  `#NN-slug`.
- **Reference:** for new framework-reference content, add under
  `reference/`. Match the existing docs' tone.
- **Agent context:** if you change the available pages,
  also update `public/llms.txt` so the agent manifest stays in
  sync.

## Conventions

- **Game-agnostic.** Examples use generic vocabulary (entities,
  props, characters). Consumer game-specific tone / lore /
  asset-pack choices live in each consumer's `docs/game/`, not
  here.
- **No marketing fluff.** Docs are for getting work done.

## Source attribution

Most of the cookbook + reference content originated in
the private framework repo and was migrated here when this site
launched. Going forward, **this is the canonical home**; edits go
here. The framework repo's `docs/` retains only internal
architecture artifacts.
