---
title: 'First-party chat panel — BYOK LLM chat without a coding-assistant sub'
description: 'BYOK chat panel inside the dev tooling. For users with an LLM API key but no Claude Max / Copilot Pro / Codex Plus sub. Lighter than full coding assistants; an on-ramp, not a competitor.'
---

> **Framework. Game-agnostic.** A bring-your-own-key (BYOK) chat
> panel directly inside the vibesmith editor — for the slice of
> indie devs who have an LLM API key (Anthropic /
> OpenAI / Google / OpenAI-compatible local like Ollama or
> llama.cpp) but no monthly coding-assistant subscription. The
> framework supplies the substrate — threaded conversations,
> per-thread provider selection, token meter, streaming render
> — and routes through the same LLM-call capability the cmd+P
> quick actions + proactive synthesis use. **Not** a Claude Code
> competitor; the on-ramp for people without one.

## What this is

A chat panel that lives next to the viewport. Three regions:

- **Thread list** — every persisted conversation, click to
  switch, hover to delete. Threads survive across reload via
  `.vibesmith/threads/<id>.jsonl`.
- **Active thread** — message transcript with per-message
  token meter (input / output / cached); the assistant
  response streams in as the LLM emits it; newly-arrived
  proactive tips surface beneath the response as `↳ tip:` lines.
- **Composer** — textarea + ⌘↩ to send; per-thread
  provider + model selector in the header; a settings cog
  opens the provider-config modal.

## Why a first-party panel, not "use Claude Code"

The framework's [MCP server](mcp-tiered-surface.md) + the
[`vibesmith mcp install`](../cookbook/install-mcp/) cookbook
already cover users with a paid coding-assistant sub (Claude
Code / Codex / Copilot drive the framework via MCP). But a
meaningful slice of indie devs have:

- An Anthropic / OpenAI / Google API key (or a local Ollama)
- **No** monthly coding-assistant sub

For that audience, "go buy a sub" is friction that loses
them. The first-party panel uses the key they already have,
in a UI that already knows the project's canon.

## Explicitly lighter than full coding assistants

The panel is **not** trying to match Claude Code / Cursor /
Copilot feature-for-feature. It's an on-ramp:

- No agentic loops, no multi-file refactor superpowers, no
  per-line completions
- Strong at canon-aware chat, MCP tool invocation, scenario
  authoring, recipe / provider discovery — the things the
  framework has a unique edge on
- Users who outgrow the panel migrate to a paid harness;
  exported conversation history travels with them

## Configuring providers

Open the chat panel and click the cog in the header. The
settings modal lets you add / edit / delete provider entries.
Each entry has:

| Field | Notes |
|---|---|
| **Kind** | `anthropic`, `openai-compatible`, or `gemini`. The picker shows a one-line hint per kind. |
| **Id** | Stable identifier (letters / digits / `_` / `-`). Immutable after creation — used by the per-thread provider selector + future routing chains. |
| **Label** | Friendly name for the dropdown. Falls back to the id. |
| **API key** | Your provider key. Stored in this browser's `localStorage`; never sent anywhere except the provider. Reveal toggle on the field. |
| **Base URL** | Required for `openai-compatible` (`https://openrouter.ai/api/v1`, `http://localhost:11434/v1`, etc.). |
| **Default model** | Optional. Falls back to the per-kind default (e.g. `claude-haiku-4-5`, `gemini-2.0-flash`, `gpt-4o-mini`). |

Saves take effect immediately — no reload required. The
panel's provider selector populates from the same registry.

### Today: `localStorage`. Tomorrow: `~/.config/vibesmith/config.toml`

The `localStorage` path lands end-to-end today. The long-term
shape — `[llm.providers.*]` in
`~/.config/vibesmith/config.toml` with `api_key_env`
indirection — comes in a follow-up alongside the Tauri-side
file-read + permissions plumbing.

## Per-thread provider override

Each thread carries its own `providerId` + `model`. Change
either via the header dropdown / text input on an active
thread; subsequent turns dispatch against the new selection
without affecting other threads. Leave the provider blank to
fall back to the chain's default routing.

## Token meter, no dollar conversion

Every assistant message displays its token usage inline:

```
in 1248 · out 372 · cached 980
```

The meter is **token-only**. vibesmith does **not** convert
to dollars because subscription assistants don't publish $/tok
rates honestly and don't formally disclose plan allowances —
any conversion would be misleading. The meter exists so you
can see what each turn cost, in the only currency the
framework can measure without lying about.

## Streaming render

Long responses appear as the LLM produces them — a preview
row with a pulsing caret renders the partial text. When the
stream completes, the placeholder clears and the persisted
message lands in the thread.

## Inline `↳ tip:` rendering

When you send a turn, the panel captures the current
timestamp. Any proactive tip the framework's
[proactive-advice queue](./ai-assistant.md) emits during the
turn surfaces under the assistant response as an `↳ tip:`
line. Dismissed tips don't appear (the queue already filters
them).

The framework never synthesises the tip's prose — it surfaces
the structured candidate (category, summary). To get
LLM-rendered prose for a tip, click **Synthesize advice** in
the proactive-tips panel; that dispatches the framework's
`synthesize-advice` task through the same LLM-call chain the
chat panel uses.

## When to use the chat panel vs cmd+P quick actions

| Surface | Best for |
|---|---|
| **Chat panel** | Multi-turn conversation; back-and-forth refinement; canon-aware Q&A; one-off scripted authoring tasks |
| **Cmd+P quick action** | One-shot context-aware prompt that already has a known shape — "summarize this scene", "describe this asset", "lookup pattern" |
| **External assistant via MCP** | Heavy lifting: multi-file refactors, agentic loops, full coding-assistant superpowers |

The three surfaces share the LLM-call chain, the task-context
contract, and the MCP Tier-1 tool surface. Switching between
them costs nothing.

## Persistence model

Each thread is one append-only JSONL file at
`.vibesmith/threads/<thread-id>.jsonl`:

```
{"kind":"header","id":"thr_…","title":"Tune the tavern lighting","providerId":"anthropic","model":"claude-haiku-4-5","createdAt":"2026-05-18T…"}
{"kind":"message","message":{"id":"msg_…","role":"user","text":"how do I add a directional light?","createdAt":"…","taskId":"lookup-pattern","stateRef":{"kind":"panel"}}}
{"kind":"message","message":{"id":"msg_…","role":"assistant","text":"…","createdAt":"…","tokens":{"input":1248,"output":372,"cacheRead":980}}}
```

The header is line 0; subsequent lines are messages. Partial
writes never corrupt the whole thread. Malformed lines are
skipped on load.

Persistence is **opt-in** — it requires the platform-bridge
to be wired with `fileSystem` capability (Tauri host). In the
zero-install browser host, the panel still works; threads
just don't survive a refresh.

## Privacy + key handling

- **API keys live in this browser's `localStorage` only.** No
  framework code sends them anywhere except the provider's
  API endpoint.
- **No telemetry on chat content.** The framework doesn't
  read, log, or transmit your messages.
- **No prompt persistence by us.** The JSONL files are
  yours — under your project directory, never synced anywhere
  unless you choose to commit them.

## Related

- [AI assistant](./ai-assistant.md) — the four-tier interaction
  model this panel completes.
- [MCP tiered surface](./mcp-tiered-surface.md) — the Tier-1
  tools the panel + external assistants share.
- [Task context](./task-context.md) — every chat turn is a
  task invocation against the shared context contract.
- [Install MCP into your coding assistant](../cookbook/install-mcp/) — if you have a paid harness, use that.
