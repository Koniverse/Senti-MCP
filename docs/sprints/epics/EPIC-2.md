---
id: EPIC-2
title: "Read-only Senti Quant access over MCP"
status: in-progress
created: 2026-08-05
updated: 2026-08-10
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
ever seen a stubbed `fetch`. Once the slice holds, the v1 design spec estimated the
second read tool at roughly thirty lines.

**That estimate held only for the part it actually described.** Measured across the five
tools that shipped in W33, the *registration* increment — the sliver the substrate made
cheap — came in at +27 to +45 lines. A whole tool file, counting its Zod schema, parser,
cap helper where present, formatter and registration, lands at **97–156 lines**
(`list_brokers` 99, `list_strategies` 113, `list_account_strategies` 97, `list_positions`
156, `list_pending_orders` 145). Quote the 30 against a registration; do not quote it
against a story estimate. See the [W33 retrospective](../sprint-2026-W33.md), which
raised this figure against this paragraph.

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
| 4 | **Tool substrate** | [US-2.4](../stories/US-2.4-tool-substrate-and-layout.md) | `core/` + `tools/<tag>/`; `registerReadTool`, `parseOrThrow`, `accountPath`, `query`, and the `404`/`409` branches every later tool consumes |
| 5 | **Account-independent reads** | [US-2.5](../stories/US-2.5-list-brokers-tool.md), [US-2.6](../stories/US-2.6-list-strategies-tool.md) | `list_brokers` and `list_strategies` — the cheapest proof a tool registers on the new substrate, neither taking a path parameter |
| 6 | **Account-scoped reads** | [US-2.7](../stories/US-2.7-list-account-strategies-tool.md), [US-2.8](../stories/US-2.8-list-positions-tool.md), [US-2.9](../stories/US-2.9-list-pending-orders-tool.md) | `list_account_strategies`, `list_positions`, `list_pending_orders` — `accountPath`'s traversal guard, the `404` login/id hint, and the terminal-backed `409` branch |
| 7 | **Query, pagination, and payload shaping** | [US-2.10](../stories/US-2.10-get-account-performance-tool.md), [US-2.11](../stories/US-2.11-list-deals-tool.md), [US-2.12](../stories/US-2.12-get-performance-breakdowns-tool.md), [US-2.13](../stories/US-2.13-get-equity-timeseries-tool.md) | The four remaining reads, each opening one axis this epic has not: query parameters, cursor pagination, breakdown shaping, downsampling. Written 2026-08-10 and scoped to [sprint-2026-W33](../sprint-2026-W33.md) §Phase 3 the same day ([CONTEXT D22](../../CONTEXT.md)) — see §Remaining work |

### Out of scope

- **All seven write operations** — deferred to [EPIC-3](EPIC-3.md), which has its own
  design spec once opened. Not registered, and not written "ready to enable".
  Rationale above and in the
  [design spec](../../superpowers/specs/2026-08-05-senti-mcp-server-design.md) §Security.
- **The other nine read operations** — deferred past v1, which shipped one tool
  deliberately: replicating a pipe before it is proven multiplies whatever is wrong with
  it by nine. **Five of the nine have since shipped** in W33 (US-2.5 → US-2.9); the
  remaining four are in scope for this epic and out of scope only for the releases so
  far — see §Remaining work.
- **Retry and backoff, response caching, npm publishing** — out of scope for v1 per the
  design spec. Each is a decision, not an omission. **npm publishing has since found its
  home**: the release procedure — cadence, tagging, publishing, and the CI that runs it —
  is owned by [EPIC-4](EPIC-4.md) ([CONTEXT D15–D20](../../CONTEXT.md)). This epic's
  stories still bump `VERSION` and write their CHANGELOG section; what happens after that
  is EPIC-4's.
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
  `encodeURIComponent` before being joined into a URL.** Recorded before any story had a
  path parameter, because `accountId` originates from the model and a value like
  `..%2F..%2Fadmin` escapes `/api/v1/accounts/` under naive concatenation. Since US-2.4
  this is `accountPath` in `core/client.ts`, and enrolment is not optional: the
  traversal test in `src/server.test.ts` is table-driven over `TOOL_CALLS`, so a new
  account-scoped tool joins by adding a row. Build the path any other way and the test
  will not notice — which is the defect, not the guard.
- **Tool failures are returned as `isError: true` text results, never thrown.** A model
  can read and act on a returned error; it cannot see a call that died.
- **Nothing writes to `stdout`.** That stream carries JSON-RPC frames. Diagnostics go to
  `stderr`.
- **Null is not zero.** A null balance renders as `—`. For a trading API the difference
  between "never synced" and "balance is zero" is real. The converse also holds and is
  live-confirmed: MT5 writes `0` into `sl`/`tp` to mean "not set", so `positions.ts`'s
  `price()` maps both `0` and `null` to `—`. All 10 positions on the smoke account carry
  `sl: 0, tp: 0` (§Live payload findings) — rendering those as `0` would tell a model
  there is a stop loss at price zero.

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
| [US-2.9](../stories/US-2.9-list-pending-orders-tool.md) | `list_pending_orders` tool | P1 | 2 | ✅ done (v0.7.0) | 18–19 |
| [US-2.10](../stories/US-2.10-get-account-performance-tool.md) | `get_account_performance` tool | P1 | 2 | ✅ done (v1.1.0) | — |
| [US-2.11](../stories/US-2.11-list-deals-tool.md) | `list_deals` tool | P1 | 3 | ✅ done (v1.2.0) | — |
| [US-2.12](../stories/US-2.12-get-performance-breakdowns-tool.md) | `get_performance_breakdowns` tool | P1 | 3 | 🟢 ready (→ 1.3.0) | — |
| [US-2.13](../stories/US-2.13-get-equity-timeseries-tool.md) | `get_equity_timeseries` tool, and EPIC-2's close | P1 | 3 | 🟢 ready (→ 1.4.0) | — |

The version in each Status cell is where that story *first* shipped — or, for the two
remaining `ready` rows, where it is planned to ship ([CONTEXT D14](../../CONTEXT.md)); their
Plan tasks column is empty because no implementation plan for them exists yet. US-2.10's is
empty for the same reason and it shipped anyway — see §Remaining work. The whole six-tool
surface was then promoted together to `1.0.0` and reached the registry as `1.0.1`
([CONTEXT D11, D12](../../CONTEXT.md)) — `0.1.0` and `1.0.1` are the only versions ever
published to npm, and `1.0.0` is deliberately git-only.

Growth path: US-2.1 → US-2.3 shipped in [sprint-2026-W32](../sprint-2026-W32.md);
US-2.4 → US-2.9 in [sprint-2026-W33](../sprint-2026-W33.md) §Phase 1, splitting `src/` by
API tag as the [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
directs (`tools/brokers/`, `tools/strategies/`, `tools/trading/`, …);
US-2.10 → US-2.13 in the **same sprint's §Phase 3**, adding `tools/performance/` and
closing the read path. The last four were written for
[sprint-2026-W34](../sprint-2026-W34.md) and pulled forward into the running window on
2026-08-10 ([CONTEXT D22](../../CONTEXT.md)), so this epic now opens and closes across
three sprints rather than four.

## Remaining work

**This epic is `in-progress`: eight of the API's ten `GET` operations have a tool.** The
two that do not are the reason the status has not flipped:

| US | Tool | New axis | Pts | Ships |
|---|---|---|---|---|
| [US-2.12](../stories/US-2.12-get-performance-breakdowns-tool.md) | `get_performance_breakdowns` | payload shaping — the ~70,000-token `breakdowns` response ([CONTEXT D10](../../CONTEXT.md)) | 3 | 1.3.0 |
| [US-2.13](../stories/US-2.13-get-equity-timeseries-tool.md) | `get_equity_timeseries` | downsampling | 3 | 1.4.0 |

Six points. **[US-2.10](../stories/US-2.10-get-account-performance-tool.md) shipped
`1.1.0` on 2026-08-10**, opening the query-parameter axis and settling for the other two
performance stories what `from`, `to` and `reporting` accept — `reporting` being an
ISO-4217 currency code rather than the reporting period its name suggests
([CONTEXT D23](../../CONTEXT.md)). `performance:read` is now the fifth of five scopes
exercised by a shipped tool. **[US-2.11](../stories/US-2.11-list-deals-tool.md) shipped
`1.2.0` on 2026-08-11**, opening the last new axis before the shaping pair — cursor
pagination — as a refusal rather than a mechanism: one tool call is exactly one HTTP
request, and `nextCursor` goes to the model as data. It binds neither remaining story,
because neither endpoint paginates ([CONTEXT D24](../../CONTEXT.md)).
**The remaining two were written 2026-08-10 and are `ready`
in [sprint-2026-W33](../sprint-2026-W33.md) §Phase 3** (2026-08-10 → 2026-08-16). The
[expansion spec §Story plan](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
planned them for W34 (08-17 → 08-23) and they were pulled forward into the running window
the same day they were written, once EPIC-4 had settled the release procedure their four
minors depend on ([CONTEXT D22](../../CONTEXT.md)). US-2.13 carries the task that flips
this epic to `done`.

Both open questions this section carried are now settled — the second by US-2.11 in code,
not only on paper:

- **The spec's stale `Ships` column** — it assigns `0.8.0` → `0.11.0`, written before
  `1.0.0` was cut. Post-`1.0.1` these are additive minors, `1.1.0` → `1.4.0`, recorded as
  [CONTEXT D14](../../CONTEXT.md). The spec itself is left unedited, per the D1/D5
  precedent for planning artifacts.
- **`capPositions`/`capOrders` generalization does not happen.** The
  [W33 retrospective](../sprint-2026-W33.md) §Followups deferred it to US-2.11 on the
  condition that `list_deals` needed a third cap helper. It does not: `list_deals` bounds
  its payload with a caller-supplied `limit` enforced by its input schema, not with a
  server-side truncation, so it emits no `notes` and needs no cap — *paginating is not
  cutting*. **Shipped that way in `1.2.0`**: `grep -n 'notes\|cap' src/tools/trading/deals.ts`
  returns nothing, which is US-2.11's AC-10. Two copies stay two copies; the trigger to
  revisit is a third tool that truncates a response the caller did not bound, and EPIC-3's
  write-path read-backs are the next plausible source. See
  [US-2.11](../stories/US-2.11-list-deals-tool.md) §What we explicitly did NOT do.

**What is still not settled is the implementation plan.** W33's Phase 1 ran against a
task-by-task plan with code, and its retrospective credits that plan for why six stories
read as transcription-with-verification. Phase 3 has stories and no equivalent plan;
writing one is Superpowers' job.

US-2.10 and US-2.11 both shipped without one, and that is now two data points rather than
a precedent. Both held for the same reason: their own TASK-x.1 forced the contract check a
plan would otherwise have carried, and in both cases that check is where the story's
specification turned out to be incomplete — `reporting`'s meaning in US-2.10, and in
US-2.11 an undeclared `syncedThrough` field, an absent `409`, and an `entry` parameter
whose case disagrees with the response field's ([CONTEXT D24](../../CONTEXT.md)). The two
that remain are the shaping stories, where the equivalent unknown is a payload weight
nobody has measured (US-2.12) and a downsampling rule that has to preserve the deepest
drawdown (US-2.13) — neither of which a contract check alone will settle. Writing the plan
before those is worth more than it was before either of these.

## Live payload findings

The [W33 retrospective](../sprint-2026-W33.md) closed with both of its open schema
questions unsettled, because the available `SENTI_SMOKE_KEY` was rejected `401` against
dev and production alike — "the credential, not the code, is what is unverified." A
working key arrived **2026-08-10**; `npm run test:smoke` passes against
`be-dev.sentitrade.xyz`. What the live payloads settle, and what they do not:

| Question | Verdict |
|---|---|
| `list_strategies`' `description`, `supportedSymbols`, `supportedTimeframes` — `.nullable().optional()` | **Present and typed in 15/15 strategies**, never absent, never null. The permissiveness is defensive only; nothing observed requires it, and nothing contradicts it either. Do not tighten on 15 rows from one key. |
| `list_strategies`' `avgRating` — `.nullable()` | **Confirmed necessary.** Null in 5 of 15. |
| `PositionSchema`'s 13 fields | **Exact.** Row keys match the schema one-for-one — no extra field, none missing. |
| `sl` / `tp` on positions — `.nullable()` | **The API sends `0`, not `null`** — 10/10 rows, typed number. `price()`'s `0 → —` mapping is the branch that actually runs; the `null` arm is untaken so far. |
| `priceStopLimit` on pending orders | **The API sends `0`, not `null`** — settled 2026-08-11 by US-2.11's smoke leg, once the account acquired a resting `ORDER_TYPE_BUY_LIMIT` it had not held on 08-10. `orders.ts` omits the stop-limit line on `0`, which is the branch that runs; the `null` arm is untaken so far, exactly as `sl`/`tp` above. |
| The `409` / `conflictMeans` terminal-offline branch | **Still unexercised live.** Positions and orders both returned `200`; the terminal is online. |
| `reporting`'s type — assumed a closed enum of reporting periods | **Wrong assumption, caught before code.** It is an ISO-4217 **currency code**, `type: string`, default `USD`. Settled from the OpenAPI document by US-2.10's TASK-2.10.1; binds US-2.12 and US-2.13 ([CONTEXT D23](../../CONTEXT.md)). |
| `winRate`, `roi`, `irr` — scale undeclared by any schema | **Percentages, not fractions.** 48 wins of 58 deals returns `82.7586…`. Recorded in `summary.test.ts`'s fixture, since nothing in the API's schema states it. |
| `performance`'s `live: null` offline branch | **Unexercised live**, for the same reason as the `409` above — the smoke account's terminal is online and returned a full live block. Covered by test only. |
| Whether `from`/`to` actually change the answer | **Yes, live-confirmed.** The default window returned 58 closed deals; `2026-07-01 → 2026-07-31` returned 391. The query option US-2.4 built and no tool had used is proven against the real service. |

So the blocker has moved again, and is now a single item: an **offline terminal**. The
credential works; the resting order arrived on 2026-08-11 and settled `priceStopLimit`.
What is still unmeasurable from the schema is `get_performance_breakdowns`'s payload
weight (D10) — US-2.12's TASK-2.12.1 has to measure it.

US-2.10 added a third item to that list without resolving either of the first two: the
offline-terminal gap now costs **two** untested branches rather than one, because
`performance` signals the same condition a different way (`live: null` inside a `200`,
no `409`). One account with an offline terminal would discharge both. US-2.13's epic-close
task is where these get stated rather than glossed.

## Cross-references

- [Design spec](../../superpowers/specs/2026-08-05-senti-mcp-server-design.md) — the approved v1 design
- [Implementation plan](../../superpowers/plans/2026-08-05-senti-mcp-server-v1.md) — task-by-task, with code
- [Read-tool expansion spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md) — the W33/W34 design, and the source of the US-2.10 → US-2.13 story plan
- [EPIC-1](EPIC-1.md) — the documentation framework this epic reports into
- [EPIC-3](EPIC-3.md) — the write path, where all seven `POST` operations live
- [sprint-2026-W32](../sprint-2026-W32.md) — US-2.1 → US-2.3
- [sprint-2026-W33](../sprint-2026-W33.md) — §Phase 1 US-2.4 → US-2.9 and the retrospective this file answers; §Phase 3 US-2.10 → US-2.13, which close this epic
- [sprint-2026-W34](../sprint-2026-W34.md) — the window the last four stories were written for, before D22 pulled them forward; now carries no scope
- [CONTEXT D14](../../CONTEXT.md) — the `1.1.0` → `1.4.0` renumber the four remaining stories follow
- [CONTEXT D22](../../CONTEXT.md) — why those four moved from W34 into W33 §Phase 3
- [Senti-Quant](https://github.com/Koniverse/Senti-Quant) — the upstream product
