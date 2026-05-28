---
title: 'Install vibesmith MCP into your coding assistant'
description: 'How to wire vibesmith into Claude Code, Codex CLI, or GitHub Copilot (VS Code Agent mode). Idempotent install via `vibesmith mcp install <assistant>`; diagnose + uninstall surfaces; auth + scope guidance per host.'
---

> **For consumers.** vibesmith does not ship its own chat agent.
> Pair the framework with the coding assistant you already pay
> for. Three subscription tiers are first-class: **Claude Max →
> Claude Code**, **GitHub Copilot Pro/Business → VS Code Agent
> mode**, **OpenAI Codex Plus → Codex CLI**. Community
> assistants (Cline, Continue, Cursor, Aider, custom
> orchestrators) reach the same MCP surface — see the
> [community adapters](#community-adapters) note at the bottom.

## TL;DR

```sh
vibesmith mcp install claude-code   # ./.mcp.json
vibesmith mcp install codex         # ./.codex/config.toml
vibesmith mcp install copilot       # ./.vscode/mcp.json
vibesmith mcp diagnose              # full status report
```

Every adapter defaults to **project scope** — the MCP entry is
written next to your `vibesmith.toml` so it travels with the
repo. Pass `--scope user` if you want the entry written to your
home-dir config instead (`~/.claude.json`, `~/.codex/config.toml`;
Copilot ignores `--scope` and is always workspace-scoped).

Each command is **idempotent**: running it twice produces no
diff. The install reports a unified-style diff before writing;
your other MCP servers + top-level config keys are preserved.

## Transport: HTTP (self-healing) vs stdio

vibesmith's MCP server speaks two transports against the **same
tool surface** — only the wire differs.

- **Streamable HTTP** (`{ "type": "http", "url":
  "http://127.0.0.1:<port>/mcp" }`) — the self-healing default a
  scaffolded project writes into `.mcp.json`. MCP clients
  auto-reconnect HTTP/SSE transports with exponential backoff, so
  an agent mid-task survives a dropped link without you typing
  `/mcp reconnect`. This matters most for autonomous, headless,
  and scheduled runs where nobody is at the keyboard. Start the
  endpoint with `pnpm mcp` (or open the project in the editor,
  which manages it for you):

  ```sh
  pnpm mcp   # vibesmith-mcp-server --http 127.0.0.1:7744
  ```

  The endpoint is **loopback-only** (`127.0.0.1`) and needs no
  token — it's unreachable from off-host. Pass a bare `--http` to
  bind an ephemeral port; the resolved URL is written into
  `.vibesmith/mcp.dev.json` so tooling can discover it.

- **stdio** (`{ "command": "pnpm", "args": ["exec",
  "vibesmith-mcp-server"] }`) — the historical default and a
  documented fallback. It works, but **MCP clients never
  auto-reconnect a stdio server**: a dropped link stalls the
  agent until you run `/mcp reconnect`. Prefer HTTP unless your
  tool can't speak HTTP MCP (rare).

The `vibesmith mcp install <assistant>` adapters below write the
stdio shape for maximum compatibility; swap the written entry for
the HTTP shape above when you want self-healing reconnects.

## Claude Code

Claude Code has the most mature MCP support of the three
first-class assistants.

```sh
vibesmith mcp install claude-code
# scope=project
# add vibesmith MCP entry to ./.mcp.json
#   + "mcpServers": { "vibesmith": { "command": "npx", "args": [...], "env": {} } }
# wrote ./.mcp.json
```

**Scope.** Default is `--scope project` (writes `.mcp.json` next
to your `vibesmith.toml` so the entry is versioned with the
repo). Pass `--scope user` to write `~/.claude.json` instead —
useful for one-off projects you don't want polluting per-repo
state, at the cost of a stale entry if the project moves or the
editor's hub URL churns.

**Auth.** Claude Code uses your Claude account if you're
signed in to Claude Max; otherwise set `ANTHROPIC_API_KEY` for
BYOK billing.

**Capability profile.** All of `tier1Router`, `deferredCatalog`,
`resources`, `structuredOutput`, `multimodal` — the full Track
V1 tiered surface, including `tools_find` deferred-schema
fetching.

## Codex CLI

Codex CLI uses a TOML config rather than JSON. vibesmith owns
the `[mcp_servers.vibesmith]` block + leaves the rest of the
file untouched.

```sh
vibesmith mcp install codex
# scope=project
# add vibesmith MCP entry to ./.codex/config.toml
# wrote ./.codex/config.toml
```

**Scope.** Default is `--scope project` (writes
`./.codex/config.toml` so the entry is versioned with the repo).
Pass `--scope user` to write `~/.codex/config.toml` instead.

**Minimum version.** Codex CLI **0.20+** for MCP support. The
adapter detects the installed version and surfaces a lag
warning in `vibesmith mcp diagnose`; install still writes the
entry on older versions because you may be staging the upgrade.

**Auth.** Set `OPENAI_API_KEY` (or `OPENAI_ORGANIZATION` for
org-scoped keys).

**Capability profile.** `tier1Router`, `deferredCatalog`,
`resources`, `structuredOutput`. **No multimodal** —
image / audio resources fall back to manifest-only references
per Track V0's redaction policy.

## GitHub Copilot (VS Code Agent mode)

Copilot's MCP support is in **VS Code Agent mode**. The
adapter writes `.vscode/mcp.json` in your project root; VS
Code reads it on workspace open + spawns the MCP server on
demand.

```sh
vibesmith mcp install copilot
# scope=project
# add vibesmith MCP entry to ./.vscode/mcp.json
# wrote ./.vscode/mcp.json
```

**Scope.** Copilot's `mcp.json` is workspace-scoped — the
adapter always writes to the project root even if you pass
`--scope user`. Multi-root workspaces get a copy per
project (run `install` from each root).

**Auth.** Copilot uses GitHub OAuth via the VS Code Copilot
extension's own auth flow. No env var needed; sign in through
the extension once.

**Capability profile.** `tier1Router`, `deferredCatalog`,
`resources`. **No structured-output, no multimodal** today —
both downgrade to text. The non-Agent Copilot Chat (inline
completions) does **not** read MCP; bridging dev-shell state
into VS Code workspace artifacts for that UX needs a VS Code
extension which is on the roadmap as a separate stream.

## Diagnose

```sh
vibesmith mcp diagnose
# vibesmith mcp diagnose
#
#   Claude Code (claude-code)
#     host: 1.5.2 — /Users/you/.claude.json
#     entry:   ok
#     claude 1.5.2 on PATH
#     vibesmith MCP entry matches the current plan
#
#   Codex CLI (codex)
#     host: 0.20.3 — /Users/you/.codex/config.toml
#     entry:   ok
#     codex 0.20.3 on PATH
#     vibesmith MCP entry matches the current plan
#
#   GitHub Copilot (copilot)
#     host not detected
#     entry: absent
#     code binary not found on PATH
```

Exit code:
- **0** — every detected adapter is compatible.
- **1** — at least one adapter is **degraded** (e.g. version
  lag, capability gap).
- **2** — at least one adapter is **unreachable**.

CI pipelines can branch on the exit code.

## Uninstall

```sh
vibesmith mcp uninstall claude-code
# scope=project
# remove vibesmith MCP entry from ./.mcp.json
# removed vibesmith entry from ./.mcp.json
```

Symmetric with install. Removes only the vibesmith server
entry; other MCP servers + top-level config keys are
preserved.

## Community adapters

Cline, Continue, Cursor, Aider, and custom Python
orchestrators all reach the same public MCP surface that the
three first-class adapters use. The framework's commitment is
to keep that surface clean enough that a community adapter
costs its author one afternoon, not one quarter.

If you write or maintain one, the cookbook is the home for the
recipe — open a PR to
[`tombee/vibesmith-docs`](https://github.com/tombee/vibesmith-docs)
adding `cookbook/install-<assistant>.md` and we'll merge it
alongside this page.

## See also

- [Tiered MCP surface](/reference/mcp-tiered-surface/) — the
  shape every adapter declares against.
- [Task context contract](/reference/task-context-contract/) —
  the call shape every AI surface routes through.
- [AI assistant](/reference/ai-assistant/) — the four-tier
  interaction model these adapters cover.
