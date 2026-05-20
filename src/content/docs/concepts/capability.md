---
title: 'Capability'
description: 'A capability is a thing the framework can do — generate an image, embed a piece of text, run an LLM call — abstracted over which concrete service does it. Capabilities are the unit of "the framework does X."'
---

A **capability** is a *thing the framework can do* — for example,
*generate an image*, *embed a piece of text*, *call an LLM*. It's
the abstraction layer above any specific service.

The framework declares a capability — say,
`image.generate(prompt, params) → image` — and then **separately**
registers one or more concrete services that implement it (a local
ComfyUI workflow, an Anthropic call, an OpenAI call, …). Those
concrete services are called [providers](provider).

## Why split capability from provider?

Three reasons:

1. **The framework doesn't lock you in to one vendor.** The
   capability layer is stable; providers come and go. Your
   project code calls `capabilities.image.generate(...)`; *which*
   provider runs depends on configuration, not on the call site.
2. **Routing is policy.** "Use the local provider if it can do
   it; fall back to ComfyUI if not; fall back to an API if all
   else fails" is a routing rule expressed at the capability
   layer, not baked into every call site.
3. **Cost transparency.** A provider declares its pricing,
   throughput, and rate limits. The framework can warn before
   running an expensive job, route to a cheaper provider when
   one's available, and meter your usage.

## What capabilities exist today

The capability surface is **growing**; not every capability has a
provider yet.

- **`image.generate`** — text → image. Provider: ComfyUI (others
  pending).
- **`image.generate_with_references`** — text + reference images
  → image. Spec landed; provider pending.
- **`image.train_style_adapter`** — train a LoRA / style adapter.
  Spec landed; provider pending.
- **`image_to_3d.convert`** — image → 3D model. Spec landed;
  provider pending.
- **`llm.call`** — a single LLM call with the framework's prompt /
  budget / cache machinery. Provider: Anthropic + OpenAI + Gemini.

## Capabilities vs recipes

A capability is *the framework can do X*. A [recipe](recipe) is
*here's a curated example of doing X well*. The two work together:
recipes are retrieved + adapted, then capabilities run the
adaptation.

## The priority order

When more than one provider can do the same capability, the
framework picks in this order:

1. **Local** — the user's own machine (free, private, no rate
   limits).
2. **Free** — free API tiers, free local hosts.
3. **Pay-per-use** — explicit per-call cost.
4. **Subscription** — Claude Code Max, Copilot, etc.

This ordering is the framework's
*[no-paid-SaaS-assumption](/vibesmith-docs/positioning/)* applied
to capability routing.

## Why this is the moat

The framework's positioning calls **the canon substrate + the
capability + provider layer "the moat."** Anyone can write a
script. Building the *project-shaped layer AI tools work against*
is the durable bet — and capabilities are the AI-facing edge of
that layer.

## Next

- [Provider](provider) — the concrete services that implement
  capabilities.
- [Recipe](recipe) — the curated patterns capabilities operate on.
- [Asset catalogue](/vibesmith-docs/reference/asset-catalogue/) —
  the first capability extension instance.
