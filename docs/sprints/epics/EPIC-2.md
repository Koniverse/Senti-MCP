---
id: EPIC-2
title: "Read-only Senti Quant access over MCP"
status: in-progress
created: 2026-08-05
updated: 2026-08-07
---

## Goal

Let a user's AI agent read their Senti Quant trading data — linked accounts,
positions, orders, strategies, performance — by asking for it in conversation, without
the user pasting API keys into a chat window or the agent inventing HTTP calls. The
first tool proves the whole pipe; each later one is incremental.

## Overview

### Business context

The [Senti Quant Public API](https://api.sentitrade.xyz) exposes a user's trading data
over HTTP: 17 operations across 15 paths, tagged Accounts, Brokers, Strategies,
Performance, and Trading. An MCP host cannot call it directly. Something has to own the
API key, present typed tools with descriptions a model can choose between, and turn API
errors into text a model can act on rather than a status code it will misread.

This epic is that something, restricted to the **read path**. It starts as a thin
vertical slice — config, auth, HTTP client, error mapping, one tool, tests — because a
slice that works against the real service is worth more than five tools that have only
ever seen a stubbed `fetch`. Once the slice holds, the design spec estimates the second
read tool at roughly thirty lines.

The architectural distinction this epic preserves is **read versus write**. The API is
10 `GET` + 7 `POST`: seven of the 17 operations are `POST`, and two of those are
`positions/close-all` and `orders/cancel-all`. A tool an LLM can call that closes every open
position is not a larger version of a tool that lists accounts; it needs an opt-in switch, an
`Idempotency-Key`, and user confirmation before execution. It gets its own epic and its
own design spec, not an appendix to this one.

### Feature pillars

| # | Pillar | Stories | Purpose |
|---|---|---|---|
| 1 | **Authenticated substrate** | [US-2.1](../stories/US-2.1-authenticated-senti-api-client.md) | Config, error vocabulary, and the HTTP client that owns auth, timeouts, and status mapping |
| 2 | **First read tool** | [US-2.2](../stories/US-2.2-list-accounts-tool.md) | `list_accounts` end to end: schema, formatting, registration, stdio bootstrap |
| 3 | **Proof against the real service** | [US-2.3](../stories/US-2.3-live-smoke-test-and-readme.md) | One opt-in live call, plus the README a user installs from |

### Out of scope

- **All seven write operations** — deferred to [EPIC-3](EPIC-3.md), which has its own
  design spec once opened. Not registered, and not written "ready to enable".
  Rationale above and in the
  [design spec](../../superpowers/specs/2026-08-05-senti-mcp-server-design.md) §Security.
- **The other nine read operations** — deferred to US-2.4 and beyond. v1 ships one
  tool deliberately: replicating a pipe before it is proven multiplies whatever is
  wrong with it by nine.
- **Retry and backoff, response caching, npm publishing** — out of scope for v1 per the
  design spec. Each is a decision, not an omission.
- **Documentation tooling and repo standard** — owned by [EPIC-1](EPIC-1.md).

## Cross-cutting invariants

Constraints every story in this epic upholds. These are the ones that a later story is
most likely to break by copying an earlier one:

- **The API key never enters a tool's `inputSchema`.** A tool parameter lives in the
  model's context and from there reaches transcripts and logs. The environment variable
  is a security boundary, not a convenience.
- **The API key never appears in returned text**, including every error branch. Asserted
  by test, not by inspection.
- **Every path parameter is validated against its expected format and passed through
  `encodeURIComponent` before being joined into a URL.** No story in v1 has a path
  parameter, which is exactly why this is recorded now: `accountId` originates from the
  model, and a value like `..%2F..%2Fadmin` escapes `/api/v1/accounts/` under naive
  concatenation. This is the easiest defect to introduce when adding the second tool.
- **Tool failures are returned as `isError: true` text results, never thrown.** A model
  can read and act on a returned error; it cannot see a call that died.
- **Nothing writes to `stdout`.** That stream carries JSON-RPC frames. Diagnostics go to
  `stderr`.
- **Null is not zero.** A null balance renders as `—`. For a trading API the difference
  between "never synced" and "balance is zero" is real.

## Story index

| US | Title | Pri | Points | Status | Plan tasks |
|---|---|---|---|---|---|
| [US-2.1](../stories/US-2.1-authenticated-senti-api-client.md) | Authenticated Senti API client substrate | P1 | 5 | ✅ done (v0.1.0) | 1–3 |
| [US-2.2](../stories/US-2.2-list-accounts-tool.md) | `list_accounts` tool over MCP stdio | P1 | 5 | ✅ done (v0.1.0) | 4–5 |
| [US-2.3](../stories/US-2.3-live-smoke-test-and-readme.md) | Live smoke test and README | P2 | 2 | ✅ done (v0.1.0) | 6 |
| [US-2.4](../stories/US-2.4-tool-substrate-and-layout.md) | Tool substrate and directory layout | P1 | 5 | ✅ done (v0.2.0) | 1–9 |
| [US-2.5](../stories/US-2.5-list-brokers-tool.md) | `list_brokers` tool | P1 | 2 | ✅ done (v0.3.0) | 10–11 |
| [US-2.6](../stories/US-2.6-list-strategies-tool.md) | `list_strategies` tool | P1 | 2 | ✅ done (v0.4.0) | 12–13 |
| [US-2.7](../stories/US-2.7-list-account-strategies-tool.md) | `list_account_strategies` tool | P1 | 2 | ✅ done (v0.5.0) | 14–15 |
| [US-2.8](../stories/US-2.8-list-positions-tool.md) | `list_positions` tool | P1 | 2 | ✅ done (v0.6.0) | 16–17 |
| [US-2.9](../stories/US-2.9-list-pending-orders-tool.md) | `list_pending_orders` tool | P1 | 2 | 📋 backlog | 18–19 |

Growth path: US-2.4 through US-2.9 ship in [sprint-2026-W33](../sprint-2026-W33.md),
splitting `src/` by API tag as the [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
directs (`tools/brokers/`, `tools/strategies/`, `tools/trading/`, …). The remaining
four read operations — `get_account_performance`, `get_performance_breakdowns`,
`get_equity_timeseries`, `list_deals` — carry to sprint W34.

## Cross-references

- [Design spec](../../superpowers/specs/2026-08-05-senti-mcp-server-design.md) — the approved v1 design
- [Implementation plan](../../superpowers/plans/2026-08-05-senti-mcp-server-v1.md) — task-by-task, with code
- [EPIC-1](EPIC-1.md) — the documentation framework this epic reports into
- [sprint-2026-W32](../sprint-2026-W32.md) — the sprint these stories sit in
- [Senti-Quant](https://github.com/Koniverse/Senti-Quant) — the upstream product
