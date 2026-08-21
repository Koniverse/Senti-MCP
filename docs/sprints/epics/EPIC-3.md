---
id: EPIC-3
title: "Write-path access to Senti Quant over MCP"
status: backlog
created: 2026-08-06
updated: 2026-08-21
---

## Goal

Let a user's AI agent act on their Senti Quant account — deploy or stop a strategy,
close a position, cancel an order — the way [EPIC-2](EPIC-2.md) already lets it read
one, but only once every write carries the guardrails a read never needed: an
explicit opt-in, idempotency where the API supports it, and a human confirming the
action before it executes. This epic is a placeholder today. It exists so the
read/write boundary [AGENTS.md](../../../AGENTS.md) and EPIC-2 already describe in
prose has an artifact stories can reference, not a paragraph they have to
re-explain.

## Overview

### Business context

[EPIC-2](EPIC-2.md) is not done — five of its nine remaining read tools shipped in
[sprint-2026-W33](../sprint-2026-W33.md) §Phase 1, and the last four are that same
sprint's §Phase 3 ([CONTEXT D22](../../CONTEXT.md)) — and this epic opens no
story until it is. The [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
states the sequencing rationale directly: *"Both epics, read first... Reads produce
the `accountId` and `ticket` values writes consume, and the write guardrails deserve a
design that is not competing for attention with nine ordinary read tools."*

The architectural distinction this epic will own, once it opens, is the one
[AGENTS.md](../../../AGENTS.md) §The read/write split already states for the whole
project: a tool an LLM can call that closes every open position is not a bigger
version of a tool that lists accounts. It needs an opt-in switch, `Idempotency-Key`
support where the API accepts it, and user confirmation before execution — none of
which a read tool needs at all. Registering a write tool without those three is not a
smaller version of this epic; it is the failure this epic exists to prevent.

**This epic owns 7 of the API's 15 write operations.** The figure of "seven write
operations" below described the whole API when this file was written on 2026-08-06; the
API has since grown an `Authoring` tag whose eight writes belong to
[EPIC-8](EPIC-8.md), not here. Corrected 2026-08-21 by
[US-8.1](../stories/US-8.1-write-substrate-and-create-draft.md), which also corrects the
claim about `register` that this repo carried in two other files — **`register` creates a
private `EaDefinition` and does not deploy to a trading account**; deploying is
`POST /api/v1/accounts/{accountId}/strategies`, the second row of the table below, under
the separate `strategies:write` scope ([CONTEXT D36](../../CONTEXT.md)).

**The seven trading write operations this epic owns**, per the design spec's §Write path:

| Operation | Notes |
|---|---|
| `POST /api/v1/accounts` | Body carries an MT5 password |
| `POST /api/v1/accounts/{accountId}/strategies` | Deploy a strategy to an account; accepts `Idempotency-Key` |
| `POST /api/v1/accounts/{accountId}/strategies/{activeEaId}/stop` | Stop a deployed strategy instance |
| `POST /api/v1/accounts/{accountId}/positions/{ticket}/close` | Partial or full close; **not retry-safe** — see invariants below |
| `POST /api/v1/accounts/{accountId}/positions/close-all` | Best-effort batch |
| `POST /api/v1/accounts/{accountId}/orders/{ticket}/cancel` | Cancel one pending order |
| `POST /api/v1/accounts/{accountId}/orders/cancel-all` | Best-effort batch |

### Out of scope

- **The eight `Authoring` write operations** — owned by [EPIC-8](EPIC-8.md) as of
  2026-08-21, behind their own `SENTI_ENABLE_AUTHORING_WRITE` flag. This epic's flag is a
  separate one, so enabling an agent to edit MQL5 is never the same act as enabling it to
  close a position.
- **All ten read operations** — owned by [EPIC-2](EPIC-2.md). This epic never
  registers a read tool; it consumes the `accountId` and `ticket` values EPIC-2's
  tools produce.
- **Story planning** — deliberately deferred. This file exists as a placeholder with
  the operation list and the guardrails locked; the story breakdown, its own design
  spec, and its own points estimate come once EPIC-2 closes.

## Cross-cutting invariants

The guardrails every future story in this epic must uphold, decided before any story
is written so no story can quietly ship without one:

- **Opt-in by environment variable.** Write tools are not registered by default —
  registering one requires an explicit environment variable set by the operator, not
  a request parameter set by the model. A host that never opts in never sees a write
  tool in `tools/list`.
- **`Idempotency-Key` on the two operations that accept it** —
  `POST /api/v1/accounts` and `POST …/strategies`. Both create a resource a retried
  request would otherwise duplicate; the API-supplied header prevents that.
- **Elicitation for user confirmation before execution.** Every write tool pauses for
  an explicit human confirmation before the underlying `POST` fires — a model does
  not get to close a position or deploy a strategy on inference alone.
- **A partial position close is not retry-safe.**
  `POST …/positions/{ticket}/close` carrying a `volume` closes that volume *again*
  from the remaining position on retry, and the route consumes no
  `Idempotency-Key`. Any retry policy built for the read path — including anything
  EPIC-2 establishes for transient network failures — must not be inherited by this
  operation. This is the single most consequential guardrail in this epic: retrying
  a read costs a redundant request; retrying this write costs real position size.
- **`positions/close-all` and `orders/cancel-all` are best-effort batches.** Both
  return `{ requested, succeeded, failed, results }`; one ticket failing to close or
  cancel never aborts the batch or hides the tickets that did succeed.

## Stories

No stories yet. Story planning opens once [EPIC-2](EPIC-2.md) closes — see
§Business context above for why read comes first.

## Cross-references

- [EPIC-8](EPIC-8.md) — the authoring write path, which owns the other 8 write operations
  and hands this epic `send`, `registerWriteTool`, the confirmation seam and the no-retry rule
- [EPIC-2](EPIC-2.md) — the read-path epic this one follows, and the source of the
  `accountId` / `ticket` values every future write tool here will consume
- [Design spec §Write path](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [Design spec §EPIC-3 boundary](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [AGENTS.md §The read/write split](../../../AGENTS.md)
- [sprint-2026-W33](../sprint-2026-W33.md) — the sprint that creates this file as a
  placeholder, via [US-2.4](../stories/US-2.4-tool-substrate-and-layout.md)
