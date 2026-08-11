---
id: US-2.11
title: "list_deals tool"
epic: EPIC-2
status: done
version_shipped: 1.2.0
priority: P1
points: 3
sprint: sprint-2026-W33
assignee: bluezdot
created: 2026-08-10
updated: 2026-08-11
---

## Goal

A user asks "show me my trade history". Positions and pending orders answer what is open
right now; nothing answers what already closed. `GET /api/v1/accounts/{accountId}/deals`
does — and it is the first endpoint in this server whose answer does not fit in one
response. This story ships the tool and the pagination contract that keeps "show me my
trade history" from silently becoming twenty HTTP requests and a context window full of
fills.

## Background

Per the [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
§Tool surface, `list_deals` reads `GET /api/v1/accounts/{accountId}/deals` under the
`trading:read` scope and lands in `src/tools/trading/deals.ts`, beside
`positions.ts` and `orders.ts`.

**The new axis is cursor pagination, and the design spec's policy for it is a refusal.**
§Payload policy gives this tool `limit` (default **50**, API maximum 500), `cursor`,
`entry`, `from` and `to`, returns `nextCursor` to the model as data, and states: **no
automatic drain.** A tool that quietly follows cursors until exhaustion turns one
question into an unbounded number of requests against a rate-limited API, and spends the
user's context on data nobody asked for. The model gets the cursor and decides.

**This is why `list_deals` carries no `notes` and no cap helper.** Every other tool that
can shrink a payload — `list_positions`, `list_pending_orders`, and the two shaping
stories later this sprint — carries `notes: string[]` recording what was dropped.
`list_deals` drops nothing: *paginating is not cutting* (design spec §Payload policy).
The payload is bounded by `limit`, which is the caller's own input and is enforced by the
input schema, not by a silent server-side truncation the model has to be told about.

That settles the question [EPIC-2](../epics/EPIC-2.md) §Remaining work and the
[W33 retrospective](../sprint-2026-W33.md) §Followups both parked here. The rule was:
`capPositions` and `capOrders` return differently-shaped objects, two copies is not the
sixfold repetition that justified extracting `parseOrThrow`, and **"if `list_deals` needs
a third cap helper, that is the point to generalize."** It does not need one, so the
trigger does not fire and the generalization stays deferred — this story records that as
a resolution, not as a further deferral. See §What we explicitly did NOT do.

**One thing this story cannot settle by itself.** EPIC-2 §Live payload findings notes the
smoke account holds zero pending orders, leaving US-2.9's `priceStopLimit` nullability
unverified. That is an *orders* gap, not a *deals* gap — `list_deals` returns closed
deals and never touches `priceStopLimit`. It is carried as a sprint-level risk in
[sprint-2026-W33](../sprint-2026-W33.md) §Phase 3 risks, and this story's smoke leg picks
it up opportunistically only if a suitable account appears.

Shipped as `1.2.0` ([CONTEXT D14](../../CONTEXT.md)), not the expansion spec's `0.9.0`.

## Acceptance criteria

- [x] **AC-1** — **Given** a call with `accountId`, **When** the request is built,
  **Then** the path is constructed via `accountPath`, **And** the tool is enrolled in
  `src/server.test.ts`'s table-driven traversal test by a new `TOOL_CALLS` row.
- [x] **AC-2** — **Given** a call that omits `limit`, **When** the request is issued,
  **Then** `limit=50` is sent explicitly — the default is this tool's, stated in its
  description, not the API's unstated one.
- [x] **AC-3** — **Given** a call supplying `limit` above 500, **When** the tool is
  called, **Then** the input schema rejects it before any HTTP request is made and the
  text names 500 as the maximum. Below 1 is likewise rejected.
- [x] **AC-4** — **Given** a response carrying a non-null `nextCursor`, **When** the tool
  returns, **Then** the cursor value appears in `structuredContent`, **And** the text
  states that more deals exist and that passing that `cursor` back retrieves the next
  page.
- [x] **AC-5** — **Given** a response carrying a null or absent `nextCursor`, **When** the
  tool returns, **Then** the text states that this is the last page — distinguishable
  from AC-4's case without the model having to inspect `structuredContent`.
- [x] **AC-6** — **Given** any single tool call, **When** it completes, **Then** exactly
  one HTTP request was issued, whatever `nextCursor` contained. Asserted by counting
  calls to the stubbed `fetch`, not by inspecting the output — **no automatic drain.**
- [x] **AC-7** — **Given** a successful response with zero deals, **When** it is
  formatted, **Then** the output states this is a real zero — the account has no deal
  history in the requested window — rather than reading as a failed or truncated read.
- [x] **AC-8** — **Given** `entry`, `from` or `to` are omitted, **When** the request is
  issued, **Then** each omitted parameter is absent from the URL entirely, never
  `entry=undefined`.
- [x] **AC-9** — **Given** a `403` from the API, **When** the tool returns, **Then**
  `isError` is true and the text names the `trading:read` scope.
- [x] **AC-10** — `src/tools/trading/deals.ts` exports no cap helper and no `notes`
  field. Declarative: `grep -n 'notes\|cap' src/tools/trading/deals.ts` returns nothing,
  because this tool bounds its payload with `limit` rather than truncating a response.

## Tasks

- [x] **TASK-2.11.1** — Confirm the pagination and response contract against the live
  OpenAPI document before writing a schema (AC: 2, 3, 4, 8)
  - [x] Read `https://api.sentitrade.xyz/api/v1/openapi.json` for
        `/accounts/{accountId}/deals`: whether `nextCursor` is nullable or absent when
        exhausted, `entry`'s enum members, `limit`'s declared bounds, and the deal
        record's full field list
  - [x] Confirm whether the endpoint declares a `409`. `positions` and `orders` do,
        because they read through to the MT5 terminal; if `deals` does not, this tool
        passes no `conflictMeans` — do not copy US-2.8's call shape without checking
- [x] **TASK-2.11.2** — `src/tools/trading/deals.ts` domain module (AC: 4, 5, 7)
  - [x] `DealSchema`, `parseDeals` via `parseOrThrow`, `formatDeals`
  - [x] Nullable numerics render as `—`; the MT5 `0`-means-unset convention
        `positions.ts`'s `price()` handles applies to any deal field that shares it —
        confirm per field against TASK-2.11.1's read rather than assuming
  - [x] `formatDeals` states last-page vs more-available, and states an empty result as a
        real zero
- [x] **TASK-2.11.3** — Registration and the `1.2.0` release (AC: 1, 2, 3, 6, 8, 9)
  - [x] Input schema: `accountId` required; `limit` integer 1–500 default 50; `cursor`,
        `entry`, `from`, `to` optional
  - [x] Register through `registerReadTool`; path via `accountPath(args.accountId,
        'deals')`; `scope: 'trading:read'`; all five parameters through `client.get`'s
        `query`
  - [x] Tool description states the default `limit`, the 500 maximum, and that the caller
        must pass `cursor` back to page — the model cannot infer a policy it is not told
  - [x] `src/server.ts` registration; `TOOL_CALLS` row in `src/server.test.ts`
  - [x] `VERSION`, `package.json`, `src/config.ts` `SERVER_VERSION` → `1.2.0` in
        lockstep; `docs/CHANGELOG.md` `[1.2.0]`; `README.md` tool-table row
- [x] **TASK-2.11.4** — Extend `src/smoke.test.ts` with a `list_deals` leg; record in
  §Implementation notes whether the live account had enough deal history to produce a
  real `nextCursor`, and skip cleanly rather than fail if it did not (AC: 4, 5)

## Dev notes

### Architecture constraints

- Registers through `registerReadTool` and builds its path through `accountPath` — same
  wiring as [US-2.8](US-2.8-list-positions-tool.md) and
  [US-2.9](US-2.9-list-pending-orders-tool.md).
- All query parameters go through `client.get`'s `query` option; the call site neither
  builds a query string nor pre-strips `undefined` (`queryStringOf` in `core/client.ts`
  does both).
- **`nextCursor` is data, not state.** This server holds no cursor between calls. It has
  no session, no cache, and adding one here would make a stateless read tool the first
  stateful thing in the process.
- **This story registers a read tool only** — `registerReadTool`'s hardcoded
  `readOnlyHint: true` keeps the write path in [EPIC-3](../epics/EPIC-3.md).

### Cross-story dependencies

- **Builds on** [US-2.4](US-2.4-tool-substrate-and-layout.md) — `registerReadTool`,
  `parseOrThrow`, `accountPath`, `client.get`'s `query` option.
- **Builds on** [US-2.8](US-2.8-list-positions-tool.md) and
  [US-2.9](US-2.9-list-pending-orders-tool.md) — `tools/trading/`'s conventions: the
  table-driven test shape of `positions.test.ts`, the real-zero phrasing, and the
  `0`-means-unset rendering in `price()`.
- **Depends on nothing else in this sprint phase.** It shares no code with US-2.10,
  US-2.12 or US-2.13, so it can start first or run concurrently
  ([sprint-2026-W33](../sprint-2026-W33.md) §Phase 3 dependencies).

### What we explicitly did NOT do

- **No automatic drain, and no `maxPages` parameter that would smuggle one in.** Design
  spec §Payload policy. One question must remain one request; the model receives
  `nextCursor` and decides whether the next page is worth asking for.
- **No cap helper, and no generalization of `capPositions`/`capOrders`.** The
  [W33 retrospective](../sprint-2026-W33.md) §Followups deferred that generalization to
  this story on the condition that `list_deals` needed a third cap. It does not: `limit`
  is a caller-supplied bound enforced by the input schema, not a server-side truncation,
  so there is nothing to record in `notes` and no third differently-shaped
  `{ x, notes }` return to unify. Two copies remain two copies. **Trigger to revisit:**
  a third tool that truncates a response the caller did not bound — the write path's
  read-backs in [EPIC-3](../epics/EPIC-3.md) are the next plausible source.
- **No `notes` field.** Adding an always-empty `notes` here would state that this tool
  can cut something. It cannot, and the design spec calls that out as the deliberate
  exception. This is the one place `tools/performance/`'s uniformity argument
  ([US-2.10](US-2.10-get-account-performance-tool.md) AC-6) does not carry over.
- **No client-side sort, filter or aggregation of deals.** The API's `entry`, `from` and
  `to` are the filters; re-implementing them in the formatter would produce a second,
  divergent definition of the same window.

### References

- [Source: design spec §Tool surface](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md) — `list_deals` row
- [Source: design spec §Payload policy](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md) — `limit`/`cursor`/`entry`/`from`/`to`, and "No automatic drain"
- [Source: design spec §Read path](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md) — "cursor pagination, `limit` ≤ 500"
- [Source: sprint-2026-W33 §Followups](../sprint-2026-W33.md) — the `capPositions`/`capOrders` deferral this story resolves
- [Source: CONTEXT D14](../../CONTEXT.md) — why this ships `1.2.0`
- [Source: LESSONS 2](../../LESSONS.md) — run every Verification-commands row before trusting it
- [Senti Quant Public API](https://api.sentitrade.xyz/api/v1/openapi.json) — the authority for TASK-2.11.1

## Verification commands

> Drafted before the tests exist; **every row is run and confirmed non-vacuous before
> this story closes** ([LESSONS 2](../../LESSONS.md)). Note that AC-1's row names
> `server.test.ts`, not `deals.test.ts` — the domain module never calls `accountPath`
> itself, only `registerListDeals` does, and pointing this row at the domain-module test
> is the exact defect three W33 stories shipped.

| AC | Command |
|---|---|
| AC-4, AC-5, AC-7 | `npm test -- src/tools/trading/deals.test.ts` |
| AC-1 | `npm test -- src/server.test.ts -t "list_deals.*traversal"` |
| AC-2, AC-3, AC-8 | `npm test -- src/server.test.ts -t "list_deals.*query"` |
| AC-6 | `npm test -- src/server.test.ts -t "list_deals.*single request"` |
| AC-9 | `npm test -- src/server.test.ts -t "list_deals.*403"` |
| AC-10 | `grep -n "notes\|cap" src/tools/trading/deals.ts` returns no matches |

## Changelog entry

### Added
- `src/tools/trading/deals.ts` — the `list_deals` tool: `DealSchema`, `parseDeals`,
  `formatDeals`. The first paginated tool in this server: `limit` (default 50, maximum
  500), `cursor`, `entry`, `from`, `to`, with `nextCursor` returned to the model as data.
  One tool call issues exactly one HTTP request — the model decides whether to page, and
  the tool never drains a cursor on its own.

## Implementation notes

**The pagination axis was the cheap part. The expensive part was everything TASK-2.11.1
found that no design artifact mentions** — which is the second story running that the
read-the-document-first task has paid for itself ([US-2.10](US-2.10-get-account-performance-tool.md)
§Implementation notes made the same observation about `reporting`).

**What the live read settled** (`be-dev.sentitrade.xyz`, 2026-08-11, one account,
500+ deals):

| Question | Verdict |
|---|---|
| Does `deals` declare a `409`? | **No.** `400/401/403/404/429/503` only. No `conflictMeans` is passed — it reads the ClickHouse warehouse, not the terminal, so an offline terminal costs freshness rather than availability. The story's instruction not to copy US-2.8's call shape was the right instinct. |
| `nextCursor` when exhausted | **Explicit `null`, always present.** Declared `["string","null"]` and required. Accepted as absent too — an absent cursor already means what a null one means, so failing the parse would turn the last page into "the API may have changed". |
| A third envelope field | **`syncedThrough`** — no design artifact names it. An ISO instant (`2026-08-10T04:23:29.000Z`) saying how far the warehouse has ingested. Rendered, not dropped ([CONTEXT D24](../../CONTEXT.md)). |
| `entry`'s enum members | **The query parameter and the response field disagree in case.** Query takes lowercase `in`/`out`; the response field is uppercase `IN`/`OUT`/`INOUT`/`OUT_BY`. Confirmed live: `entry=OUT` returns `400 Expected 'in' \| 'out', received 'OUT'`. |
| `limit`'s declared bounds | **1–500, API default 100.** Confirmed live: `limit=501` and `limit=0` both return `400`. This tool sends **50** explicitly on every call, per AC-2. |
| The deal record's fields | **Fifteen, all required, none nullable.** |
| Does the account have enough history to page? | **Yes** — see below. |

**TASK-2.11.2's second bullet did not survive the read, and the tick means the check ran,
not that em dashes were rendered.** The bullet says "nullable numerics render as `—`; the
MT5 `0`-means-unset convention applies to any deal field that shares it — confirm per
field rather than assuming." Confirmed per field: **no deal field is nullable, and none
shares the convention.** A deal is a completed event, so a `commission`, `fee`, `swap` or
`profit` of 0 means the event cost or earned nothing — a real zero that must render as
one. `deals.ts` therefore has no `price()` equivalent and no `NO_VALUE`. The one value
with a second meaning is `magic: 0`, which MT5 writes for a hand-placed trade; it renders
as `manual` rather than as a bare `0` or a dash. Live magics seen: 0, 25, 39.

**TASK-2.11.4: the live account had enough deal history, and the cursor path is proven
against the real service.** With `limit: 2` the first page returned a real `nextCursor`,
the *more-available* branch rendered, and a second call with that cursor returned
different tickets — so the cursor is not merely present but *advances*. The
skip-cleanly-instead-of-failing arm exists and is the `else` branch, but it did not run;
the [sprint risk](../sprint-2026-W33.md) §Phase 3 that anticipated an account with no deal
history did not materialize. `npm run test:smoke` passes.

**The opportunistic pickup the sprint risk described did land — for orders, not deals.**
That risk said US-2.11's smoke leg picks up US-2.9's unverified `priceStopLimit`
nullability "only if a suitable account appears". One has: the smoke account now holds a
resting `ORDER_TYPE_BUY_LIMIT` (ticket `4884576008`, `priceOpen 4200`, `tp 4500`) where it
held none on 2026-08-10. **`priceStopLimit` arrives as `0`, not `null`** — so `orders.ts`'s
handling is confirmed against the real service for the zero case, and only the `null` arm
is still test-only. Recorded in [EPIC-2](../epics/EPIC-2.md) §Live payload findings rather
than acted on here; nothing in `orders.ts` changes.

**The cursor is quoted in the text, which the story did not require.** AC-4 asks only that
the value appear in `structuredContent` and that the text say more pages exist. That is not
enough to page with: many clients surface `content` alone, and a model that is told a next
page exists but cannot see its handle is stuck. The text carries `cursor="…"` verbatim, and
`formatDeals` is where AC-4 and AC-5 are actually decided.

**A page total is stated, and labelled a page total.** "Show me my trade history" invites a
model to sum the rows it can see and report the figure as the account's. The header states
realized P&L across the rows shown, says outright that it is not the account's total, and
names `get_account_performance` as the tool that answers that instead — the same defect
class `list_positions` guards against when it totals the full list rather than the
surviving slice.

**AC-1's enrolment was proven by mutation, not by a green test.** Replacing
`accountPath(args.accountId, 'deals')` with a template literal turned **two** tests red —
the dedicated `list_deals` traversal test and the shared table-driven one, the latter
labelled `list_deals`, which is what shows the new `TOOL_CALLS` row genuinely exercises
this tool rather than passing on a short loop. Reverted; `npm test` is green at
**18 files / 324 tests, 1 skipped**.

**Every Verification-commands row was run before this story closed** ([LESSONS 2](../../LESSONS.md)),
and each `-t` pattern was checked for a non-zero selection rather than a green exit:
`traversal` selects 1, `query` 7, `single request` 2, `403` 1. The story's warning about
pointing AC-1's row at the domain-module test was well founded — `deals.test.ts` never
touches `accountPath`, a URL, or the input schema, so all three live in `server.test.ts`.

**`release:verify-pack` passes; `release:check` fails only on the uncommitted tree**, which
is the gate doing its job — a tag is a claim about a commit. The tarball goes from 45
entries to **48** (`deals.ts` plus its two compiled artifacts), and both the built and the
installed server expose **8** tools.

## Files modified

| File | Change |
|---|---|
| `src/tools/trading/deals.ts` | **New.** `DealSchema`, `DealsInputSchema`, `DealsOutputSchema`, `parseDeals`, `formatDeals`, `registerListDeals`. No truncation helper, no `notes` field (AC-10). |
| `src/tools/trading/deals.test.ts` | **New.** 31 tests over `parseDeals` and `formatDeals` (AC-4, AC-5, AC-7). |
| `src/server.ts` | `registerListDeals` import and registration — the eighth tool. |
| `src/server.test.ts` | A `list_deals` describe block (14 tests) plus the `DEAL`/`DEALS_PAGE` fixtures and the new `TOOL_CALLS` row (AC-1, AC-2, AC-3, AC-6, AC-8, AC-9). |
| `src/smoke.test.ts` | A `list_deals` leg: one live page at `limit: 2`, then a second call with the returned cursor, asserting the pages differ (TASK-2.11.4). |
| `src/config.ts` | `SERVER_VERSION` → `1.2.0`. |
| `VERSION`, `package.json`, `package-lock.json` | → `1.2.0`. |
| `docs/CHANGELOG.md` | `## [1.2.0]` section. |
| `README.md` | `list_deals` tool-table row; tool count seven → eight; version claims; `trading:read`'s tool list. |
| `docs/CONTEXT.md` | [D24](../../CONTEXT.md) — one request per call, no `409`, `syncedThrough` surfaced. |
| `docs/sprints/sprint-2026-W33.md`, `docs/sprints/epics/EPIC-2.md`, `docs/sprints/STATUS.md` | Status rows and the live-payload findings. |
| `AGENTS.md` | Current-state paragraph, `deals.ts`, and the clean-run test count. |

## Cross-references

- [Epic EPIC-2](../epics/EPIC-2.md)
- [sprint-2026-W33](../sprint-2026-W33.md) — §Phase 3
- [CHANGELOG](../../CHANGELOG.md)
- [CONTEXT D14](../../CONTEXT.md) · [CONTEXT D24](../../CONTEXT.md)
- [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [US-2.4](US-2.4-tool-substrate-and-layout.md) · [US-2.8](US-2.8-list-positions-tool.md) · [US-2.9](US-2.9-list-pending-orders-tool.md) · [US-2.10](US-2.10-get-account-performance-tool.md)
