---
title: 'Provider'
description: 'A provider is a concrete service that implements a capability — ComfyUI for image generation, Anthropic for LLM calls, a local LoRA training script. The framework swaps providers without changing your code.'
---

A **provider** is **a concrete service that implements a
[capability](capability)**.

If `image.generate` is the capability ("the framework can turn a
prompt into an image"), then providers are *who actually does it*:

- a local ComfyUI workflow on your machine,
- an Anthropic API call,
- an OpenAI DALL·E call,
- a self-hosted Stable Diffusion server,
- a community-built adapter pointing at the next thing.

Your project code never names a provider directly — it asks the
capability. Configuration decides which provider runs.

## How a provider gets registered

A provider declares:

- **Which capability it implements.** A single provider can
  implement more than one (an LLM-with-vision provider implements
  both `llm.call` and `image.understand`).
- **Its inputs and outputs.** Provider adapters normalise to the
  capability's wire shape so consumers don't see provider-specific
  fields.
- **Cost + throughput.** Per-call cost, rate limits, latency
  estimates.
- **Auth.** API key location, OAuth flow, BYOK header, etc.

## The four-tier priority order

When multiple providers can implement the same capability, the
framework picks in this order:

1. **Local** — runs on your machine. ComfyUI, llama.cpp, a local
   embedding model. Free, private, no rate limits.
2. **Free** — API tiers with a free quota (Groq, some Hugging
   Face inference endpoints).
3. **Pay-per-use** — per-call billing (Anthropic, OpenAI, Gemini
   direct).
4. **Subscription** — Claude Code Max, GitHub Copilot,
   OpenAI Codex CLI. The framework can route through these if
   the user already pays for them, avoiding double-billing.

The framework respects the order automatically. You can override
it in `~/.config/vibesmith/config.toml` if you have a reason.

## Why this matters

You don't write your project code to "use ComfyUI" or "use
Anthropic." You write it to use the capability. That means:

- **Switching providers doesn't touch your code.** Change one
  config line; the framework re-routes.
- **A teammate without the local provider** can still run your
  project — the framework falls back to a paid provider with
  a warning.
- **The AI assistant can suggest provider swaps.** "You're
  paying $X/month on Anthropic; here's the local provider that
  would handle this capability."

## Provider adapters are pluggable

The framework ships a handful of native adapters (Anthropic,
OpenAI, Gemini, ComfyUI). Community adapters extend the set via
the same `ProviderAdapter` contract — no framework changes
required to add a new one.

If you want to write an adapter, you implement the contract for
one capability, declare your cost + throughput, and the framework
slots you into the routing tier.

## Next

- [Capability](capability) — the abstract surface providers
  implement.
- [First-party chat panel](/vibesmith-docs/reference/first-party-chat-panel/)
  — the BYOK chat surface that uses LLM providers.
- [AI assistant](/vibesmith-docs/reference/ai-assistant/) — the
  larger AI-integration story.
