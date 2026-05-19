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
vibesmith mcp install claude-code   # ~/.claude.json
vibesmith mcp install codex         # ~/.codex/config.toml
vibesmith mcp install copilot       # ./.vscode/mcp.json
vibesmith mcp diagnose              # full status report
```

Each command is **idempotent**: running it twice produces no
diff. The install reports a unified-style diff before writing;
your other MCP servers + top-level config keys are preserved.

## Claude Code

Claude Code has the most mature MCP support of the three
first-class assistants.

```sh
vibesmith mcp install claude-code
# scope=user
# add vibesmith MCP entry to ~/.claude.json
#   + "mcpServers": { "vibesmith": { "command": "npx", "args": [...], "env": {} } }
# wrote ~/.claude.json
```

**Scope.** Default is `--scope user` (writes `~/.claude.json`).
Use `--scope project` to write `.mcp.json` next to your
`vibesmith.toml` instead — useful when you want the entry
versioned with the project repo.

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
# scope=user
# add vibesmith MCP entry to ~/.codex/config.toml
# wrote ~/.codex/config.toml
```

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
# scope=user
# remove vibesmith MCP entry from ~/.claude.json
# removed vibesmith entry from ~/.claude.json
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
