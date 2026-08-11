---
id: US-2.11
title: "list_deals tool"
epic: EPIC-2
status: in-progress
priority: P1
points: 3
sprint: sprint-2026-W33
assignee: bluezdot
created: 2026-08-10
updated: 2026-08-10
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

- [ ] **AC-1** — **Given** a call with `accountId`, **When** the request is built,
  **Then** the path is constructed via `accountPath`, **And** the tool is enrolled in
  `src/server.test.ts`'s table-driven traversal test by a new `TOOL_CALLS` row.
- [ ] **AC-2** — **Given** a call that omits `limit`, **When** the request is issued,
  **Then** `limit=50` is sent explicitly — the default is this tool's, stated in its
  description, not the API's unstated one.
- [ ] **AC-3** — **Given** a call supplying `limit` above 500, **When** the tool is
  called, **Then** the input schema rejects it before any HTTP request is made and the
  text names 500 as the maximum. Below 1 is likewise rejected.
- [ ] **AC-4** — **Given** a response carrying a non-null `nextCursor`, **When** the tool
  returns, **Then** the cursor value appears in `structuredContent`, **And** the text
  states that more deals exist and that passing that `cursor` back retrieves the next
  page.
- [ ] **AC-5** — **Given** a response carrying a null or absent `nextCursor`, **When** the
  tool returns, **Then** the text states that this is the last page — distinguishable
  from AC-4's case without the model having to inspect `structuredContent`.
- [ ] **AC-6** — **Given** any single tool call, **When** it completes, **Then** exactly
  one HTTP request was issued, whatever `nextCursor` contained. Asserted by counting
  calls to the stubbed `fetch`, not by inspecting the output — **no automatic drain.**
- [ ] **AC-7** — **Given** a successful response with zero deals, **When** it is
  formatted, **Then** the output states this is a real zero — the account has no deal
  history in the requested window — rather than reading as a failed or truncated read.
- [ ] **AC-8** — **Given** `entry`, `from` or `to` are omitted, **When** the request is
  issued, **Then** each omitted parameter is absent from the URL entirely, never
  `entry=undefined`.
- [ ] **AC-9** — **Given** a `403` from the API, **When** the tool returns, **Then**
  `isError` is true and the text names the `trading:read` scope.
- [ ] **AC-10** — `src/tools/trading/deals.ts` exports no cap helper and no `notes`
  field. Declarative: `grep -n 'notes\|cap' src/tools/trading/deals.ts` returns nothing,
  because this tool bounds its payload with `limit` rather than truncating a response.

## Tasks

- [ ] **TASK-2.11.1** — Confirm the pagination and response contract against the live
  OpenAPI document before writing a schema (AC: 2, 3, 4, 8)
  - [ ] Read `https://api.sentitrade.xyz/api/v1/openapi.json` for
        `/accounts/{accountId}/deals`: whether `nextCursor` is nullable or absent when
        exhausted, `entry`'s enum members, `limit`'s declared bounds, and the deal
        record's full field list
  - [ ] Confirm whether the endpoint declares a `409`. `positions` and `orders` do,
        because they read through to the MT5 terminal; if `deals` does not, this tool
        passes no `conflictMeans` — do not copy US-2.8's call shape without checking
- [ ] **TASK-2.11.2** — `src/tools/trading/deals.ts` domain module (AC: 4, 5, 7)
  - [ ] `DealSchema`, `parseDeals` via `parseOrThrow`, `formatDeals`
  - [ ] Nullable numerics render as `—`; the MT5 `0`-means-unset convention
        `positions.ts`'s `price()` handles applies to any deal field that shares it —
        confirm per field against TASK-2.11.1's read rather than assuming
  - [ ] `formatDeals` states last-page vs more-available, and states an empty result as a
        real zero
- [ ] **TASK-2.11.3** — Registration and the `1.2.0` release (AC: 1, 2, 3, 6, 8, 9)
  - [ ] Input schema: `accountId` required; `limit` integer 1–500 default 50; `cursor`,
        `entry`, `from`, `to` optional
  - [ ] Register through `registerReadTool`; path via `accountPath(args.accountId,
        'deals')`; `scope: 'trading:read'`; all five parameters through `client.get`'s
        `query`
  - [ ] Tool description states the default `limit`, the 500 maximum, and that the caller
        must pass `cursor` back to page — the model cannot infer a policy it is not told
  - [ ] `src/server.ts` registration; `TOOL_CALLS` row in `src/server.test.ts`
  - [ ] `VERSION`, `package.json`, `src/config.ts` `SERVER_VERSION` → `1.2.0` in
        lockstep; `docs/CHANGELOG.md` `[1.2.0]`; `README.md` tool-table row
- [ ] **TASK-2.11.4** — Extend `src/smoke.test.ts` with a `list_deals` leg; record in
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

<!-- Filled during implementation. -->

## Files modified

<!-- Filled during implementation. -->

## Cross-references

- [Epic EPIC-2](../epics/EPIC-2.md)
- [sprint-2026-W33](../sprint-2026-W33.md) — §Phase 3
- [CHANGELOG](../../CHANGELOG.md)
- [CONTEXT D14](../../CONTEXT.md)
- [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [US-2.4](US-2.4-tool-substrate-and-layout.md) · [US-2.8](US-2.8-list-positions-tool.md) · [US-2.9](US-2.9-list-pending-orders-tool.md)
