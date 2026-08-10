---
id: US-2.10
title: "get_account_performance tool"
epic: EPIC-2
status: done
version_shipped: 1.1.0
priority: P1
points: 2
sprint: sprint-2026-W33
assignee: bluezdot
created: 2026-08-10
updated: 2026-08-10
---

## Goal

A user asks "how did I do this month". Today no tool can answer it: six tools enumerate
accounts, brokers, strategies, positions and orders, and none of them returns a single
performance figure. `GET /api/v1/accounts/{accountId}/performance` answers it in one
fixed-size object, and — because that object does not grow with the requested window —
it becomes the default tool for any performance question a model has, with the two
shaping-heavy performance tools reserved for questions it genuinely cannot answer.

## Background

Per the [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
§Tool surface, `get_account_performance` reads `GET /api/v1/accounts/{accountId}/performance`
under the `performance:read` scope and lands in `src/tools/performance/summary.ts` — the
first file in a new `tools/performance/` folder, which US-2.12 and US-2.13 then join.

**This is the first tool to send query parameters, and the axis is narrower than it
sounds.** `client.get`'s `query` option was built in US-2.4 and tested in
`core/client.test.ts`, but no tool has ever passed it: `grep -rn 'query:' src/tools/`
returns nothing. So the substrate exists and the wiring does not, which is exactly the
shape [US-2.7](US-2.7-list-account-strategies-tool.md) had for `accountPath` — the
cheapest story that can carry an axis is the one that carries it. Three parameters ride
it: `from`, `to`, `reporting`.

**Why the summary tool goes first among the three performance endpoints.** All three
take the same three query parameters. Whatever this story settles — what date format the
input schema accepts, what `reporting`'s members are, whether an omitted parameter is
absent or explicit — US-2.12 and US-2.13 copy rather than re-derive. Settling it in a
2-point story with a fixed-size response, instead of inside US-2.12's four payload cuts,
keeps a query-encoding defect from surfacing tangled in a shaping bug.

**The terminal distinction returns here in a different form.** `positions` and `orders`
report an offline MT5 terminal with a `409`, which is why US-2.4 built
`conflictMeans`. `performance` does not: it returns `200` with `live: null` (design spec
§Terminal state is not emptiness). So this tool needs no `conflictMeans` string, and the
null-is-not-zero invariant moves from a status-code branch into the formatter, where
`live: null` must read as "the terminal could not be reached" and never as a row of
zeroes or a silently omitted section.

Shipped as `1.1.0`, not the `0.8.0` the expansion spec's Story plan assigns — that column
predates the `1.0.0` cut. See [CONTEXT D14](../../CONTEXT.md).

## Acceptance criteria

- [x] **AC-1** — **Given** a call with `accountId`, **When** the request is built,
  **Then** the path is constructed via `accountPath`, **And** the tool is enrolled in
  `src/server.test.ts`'s table-driven traversal test by a new `TOOL_CALLS` row.
- [x] **AC-2** — **Given** a call supplying `from`, `to` and `reporting`, **When** the
  request is issued, **Then** all three reach the URL as query parameters through
  `client.get`'s `query` option — no tool-side string concatenation builds the query.
- [x] **AC-3** — **Given** a call omitting `from`, `to` or `reporting`, **When** the
  request is issued, **Then** the omitted parameter is absent from the URL entirely —
  never `from=undefined`, never `from=`.
- [x] **AC-4** — **Given** a `from` or `to` that is not a calendar date in the format the
  API documents, **When** the tool is called, **Then** the input schema rejects it before
  any HTTP request is made, **And** the returned text names the expected format.
  `reporting` is likewise validated against a closed *format*, not accepted as a free
  string. **Corrected during TASK-2.10.1**: this AC was written expecting `reporting` to
  be a closed enum of reporting periods. The live OpenAPI document declares it an
  ISO-4217 **currency code**, so it is validated by shape — `/^[A-Z]{3}$/` — rather than
  against a list this server would have invented. The protection AC-4 was written for is
  intact: `monthly`, `daily` and `usd` are all rejected before any HTTP request
  ([CONTEXT D23](../../CONTEXT.md)).
- [x] **AC-5** — **Given** a successful response whose `live` is `null`, **When** it is
  formatted, **Then** the text states that the account's terminal could not be reached
  and the live figures are unavailable, **And** it does not render them as `0` and does
  not omit the section silently — the *null is not zero* invariant in its
  performance-endpoint form.
- [x] **AC-6** — **Given** any successful response, **When** the tool returns, **Then**
  `notes` is present in the `outputSchema` and is the empty array, because this tool
  returns the response in full and cuts nothing. It exists for uniformity across
  `tools/performance/`; a non-empty `notes` from this tool is a bug.
- [x] **AC-7** — **Given** a `403` from the API, **When** the tool returns, **Then**
  `isError` is true and the text names the `performance:read` scope.
- [x] **AC-8** — **Given** a `404` from the API, **When** the tool returns, **Then** the
  text carries US-2.4's `login`-vs-`id` hint, identical to the other account-scoped
  tools.

## Tasks

- [x] **TASK-2.10.1** — Confirm the response and parameter contract against the live
  OpenAPI document before writing a schema (AC: 2, 4, 5)
  - [x] Read `https://api.sentitrade.xyz/api/v1/openapi.json` for
        `/accounts/{accountId}/performance`: the exact member names of `reporting`, the
        declared type/format of `from` and `to`, and whether `metrics`,
        `portfolioReturn`, `lifetimeIrr` and `live` are the response's whole surface.
        The design spec names those four from a 2026-08-05 read; a schema is written
        against the document, not against a spec's summary of it.
        **This task paid for itself**: `reporting` is a currency, not a period
        ([CONTEXT D23](../../CONTEXT.md)).
- [x] **TASK-2.10.2** — `src/tools/performance/summary.ts` domain module (AC: 4, 5, 6)
  - [x] `PerformanceSchema`, `parsePerformance` via `parseOrThrow`, `formatPerformance`
  - [x] Input schema: `accountId` required; `from`/`to` optional and date-validated;
        `reporting` an optional ISO-4217 currency code, shape-validated — **not** the
        Zod enum this task specified, per TASK-2.10.1's finding
  - [x] `live: null` renders as an explicit "terminal unreachable" line; every nullable
        numeric renders as `—`, never `0`
- [x] **TASK-2.10.3** — Registration and the `1.1.0` release (AC: 1, 2, 3, 7, 8)
  - [x] Register through `registerReadTool`; path via `accountPath(args.accountId,
        'performance')`; `scope: 'performance:read'`; no `conflictMeans` — this endpoint
        has no `409`
  - [x] Pass `from`/`to`/`reporting` through `client.get`'s `query`, letting the client
        drop `undefined` rather than pre-filtering at the call site
  - [x] `src/server.ts` registration; `TOOL_CALLS` row in `src/server.test.ts`
  - [x] `VERSION`, `package.json`, `package-lock.json`, `src/config.ts` `SERVER_VERSION`
        → `1.1.0` in lockstep; `docs/CHANGELOG.md` `[1.1.0]`; `README.md` tool-table row
- [x] **TASK-2.10.4** — Extend `src/smoke.test.ts` with a `get_account_performance` leg
  against the live key, and record in §Implementation notes whether the live response
  carried `live: null` or a live block (AC: 5)

## Dev notes

### Architecture constraints

- Registers through `registerReadTool` and builds its path through `accountPath` — the
  two substrate pieces [US-2.4](US-2.4-tool-substrate-and-layout.md) shipped. Neither is
  optional: `accountPath` is what enrolls this tool in the shared traversal test, and
  building the path any other way makes that test pass vacuously
  ([EPIC-2](../epics/EPIC-2.md) §Cross-cutting invariants).
- Query parameters go through `client.get`'s `query` option. The call site does not
  build a query string and does not strip `undefined` — `queryStringOf` in
  `core/client.ts` already does both, and duplicating it at a call site creates two
  places for an encoding bug to live.
- Payload policy: return in full. Per design spec §Payload policy the response is a
  fixed-size object that does not grow with the window, so there is nothing to cut and
  `notes` stays empty.
- **This story registers a read tool only.** `registerReadTool` hardcodes
  `annotations: { readOnlyHint: true }`, which is a mechanical barrier against a write
  tool reaching this server before [EPIC-3](../epics/EPIC-3.md) opens.

### Cross-story dependencies

- **Builds on** [US-2.4](US-2.4-tool-substrate-and-layout.md) — `registerReadTool`,
  `parseOrThrow`, `accountPath`, `client.get`'s `query` option, and the `404`
  `login`/`id` branch.
- **Required by** [US-2.12](US-2.12-get-performance-breakdowns-tool.md) and
  [US-2.13](US-2.13-get-equity-timeseries-tool.md) — both send the same
  `from`/`to`/`reporting` trio and reuse whatever this story's input schema settles about
  date format and the `reporting` enum, rather than declaring their own.
- **Sibling of** [US-2.11](US-2.11-list-deals-tool.md) — shipping the same sprint, no
  shared code; `list_deals` lands in `tools/trading/`.

### What we explicitly did NOT do

- **No `conflictMeans`.** This endpoint declares no `409`; an offline terminal arrives as
  `live: null` inside a `200`. Passing a `conflictMeans` string here would suggest a
  branch that cannot fire.
- **No resolution of `login` → `id`.** Rejected in the design spec §`accountId` handling:
  it adds a hidden request to every call and a cache that can go stale, to hide a mistake
  the model corrects itself in one turn from the `404` message.
- **No merging of the three performance endpoints behind a `view` parameter.** Design
  spec §Decisions taken 2 — it would force an `anyOf` output schema, weakening validation
  exactly where a model is about to report money.

### References

- [Source: design spec §Tool surface](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md) — `get_account_performance` row
- [Source: design spec §Payload policy](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md) — "Return in full … the default tool for any performance question"
- [Source: design spec §Terminal state is not emptiness](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md) — `live: null` vs the `409` path
- [Source: design spec §Substrate](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md) — `get`'s `query` signature
- [Source: CONTEXT D14](../../CONTEXT.md) — why this ships `1.1.0` and not the spec's `0.8.0`
- [Source: LESSONS 2](../../LESSONS.md) — run every Verification-commands row before trusting it
- [Senti Quant Public API](https://api.sentitrade.xyz/api/v1/openapi.json) — the authority for TASK-2.10.1

## Verification commands

> Every row below was drafted before the tests existed and **has been run and confirmed
> non-vacuous** — a `vitest -t` filter that matches nothing exits 0
> ([LESSONS 2](../../LESSONS.md)). The count after each row is what actually ran.
>
> **One drafted row was dead and is corrected.** `-t "get_account_performance.*traversal"`
> matched **nothing** — 45 skipped, exit 0 — because the traversal test is the shared
> table-driven one in `describe('invariants across every registered tool')` and carries no
> tool name in its title. That is the point of the table: this tool joins it by adding a
> `TOOL_CALLS` row, not by writing its own traversal test. Two rows replace it, and
> together they are the guard — the second proves the tool is *in* the table, the first
> proves the table's traversal assertion covers it.

| AC | Command | Ran |
|---|---|---|
| AC-4, AC-5, AC-6 | `npm test -- src/tools/performance/summary.test.ts` | 34 passed |
| AC-1 | `npm test -- src/server.test.ts -t "path-traversal"` | 1 passed |
| AC-1 | `npm test -- src/server.test.ts -t "the table lists every registered tool"` | 1 passed |
| AC-2, AC-3 | `npm test -- src/server.test.ts -t "get_account_performance.*query"` | 3 passed |
| AC-6 | `npm test -- src/server.test.ts -t "structuredContent validates"` | 1 passed |
| AC-7 | `npm test -- src/server.test.ts -t "get_account_performance.*403"` | 1 passed |
| AC-8 | `npm test -- src/server.test.ts -t "get_account_performance.*404"` | 1 passed |
| all | `npm test` · `npm run typecheck` · `npm run test:smoke` | 276 passed, 1 skipped · clean · 1 passed |

## Changelog entry

### Added
- `src/tools/performance/summary.ts` — the `get_account_performance` tool:
  `PerformanceSchema`, `parsePerformance`, `formatPerformance`. The first tool to send
  query parameters (`from`, `to`, `reporting`) through `client.get`'s `query` option, and
  the first file in `src/tools/performance/`. An offline terminal arrives as
  `live: null` and is stated as such, never rendered as zeroes.

## Implementation notes

**The axis this story carried cost almost nothing; the axis it did not expect cost the
most.** `client.get`'s `query` option worked on first use exactly as US-2.4 built it —
three parameters in, `queryStringOf` drops the undefined ones, and the URL assertion
passed without touching `core/`. What actually needed judgement was the *meaning* of the
third parameter, which no test would have caught.

**TASK-2.10.1 paid for itself.** `reporting` is an ISO-4217 currency code, not a reporting
period — the live OpenAPI document says "ISO-4217 currency the money metrics are
normalized to. Default `USD`". A Zod enum of periods, which AC-4 and TASK-2.10.2 both
specified, would have rejected every legal value the API accepts and been caught only
against the live service. It is validated by shape instead, for the reason recorded in
[CONTEXT D23](../../CONTEXT.md).

**What the live read settled** (`be-dev.sentitrade.xyz`, 2026-08-10, two windows):

| Question | Verdict |
|---|---|
| Is `live` null on the smoke account? | **No — a full live block.** `equity 165802.70`, `leverage 500`, `currency USD`. The `live: null` arm ships **unexercised against the real service**; it is covered by test only. Same gap the `409` branch has carried since W33, and for the same reason: this account's terminal is online. |
| `winRate`'s scale | **Percentage, not fraction.** 48 wins of 58 closed deals returns `82.7586…`. Rendered with a `%`. Nothing in the schema says this — the fixture in `summary.test.ts` records it. |
| `roi` / `irr` scale | **Percentages too.** Period `roi 2.12`, lifetime `irr 1581.11` (annualized over a short account life — a large value here is not a bug). |
| `earliestMs` | **Epoch milliseconds**, rendered as a `YYYY-MM-DD` day. |
| Does the window actually change the answer? | **Yes.** The default window returned 58 closed deals; `2026-07-01 → 2026-07-31` returned 391. AC-2 is proven against the real service, not only against a stub. |
| Response surface | **Exactly the four blocks the spec named**, all 25 `metrics` members present and non-null. |

**Three things the response carries that no design artifact anticipated.**
`notionalIncomplete`, `staleBalanceAccounts` and `unconvertedAccounts` are not figures but
statements *about* the figures beside them — the API saying its own total understates, or
rests on a stale sync, or excludes money it could not convert. They are rendered as a
`Caveats:` block and deliberately **not** put in `notes`: `notes` in this repo records what
*this server* cut, and this tool cuts nothing (AC-6). Quoting `totalNotionalVolume` while
dropping the API's own warning about it is exactly the "confident, wrong conclusion about
real money" the payload policy exists to prevent.

**The window is stated in the text, which the story did not ask for.** The response echoes
no window back, so a model that asked "how did I do this month" and received the API's
default 30 days had nothing telling it which period the numbers cover. The header states
the window, and an omitted one renders as "the API's default window — the 30 days ending
today" rather than being left silent.

**Date validation checks existence, not just shape.** `2026-02-31` matches `YYYY-MM-DD` and
is not a day; `Date` rolls it forward to 2026-03-03, so a value that does not survive the
round trip is refused. A model asked about February can produce a month-end it never
checked, and the API answers that with a `400` about "a query parameter" — true, unhelpful,
and about the wrong thing.

**The MCP SDK surfaces Zod's message.** AC-4 requires the returned text to name the expected
format, and it was not obvious the SDK's own input-schema rejection would carry the custom
message rather than a generic one. It does — `YYYY-MM-DD` and `ISO-4217` both reach the
model, with `fetch` never called. Asserted in `src/server.test.ts` rather than assumed.

**AC-1's enrolment was proven by mutation, not by a green test.** Replacing
`accountPath(args.accountId, 'performance')` with a template literal turned the shared
traversal test red with the label `get_account_performance` — so the new `TOOL_CALLS` row
genuinely exercises this tool, rather than passing because the loop happens to be short.
The mutation was reverted; the epic's warning that "build the path any other way and the
test will not notice" does not apply once the row exists.

### Followups, deliberately not done here

- **A third copy of `money()`.** `list-accounts.ts` and `positions.ts` each hold a
  `toLocaleString` money helper; this file adds a third, plus `percent()` and `count()`.
  Extracting `core/format.ts` would touch two shipped tools for a 2-point story. The
  trigger to revisit is [US-2.12](US-2.12-get-performance-breakdowns-tool.md) and
  [US-2.13](US-2.13-get-equity-timeseries-tool.md), which will each want the same three —
  at five copies the extraction is no longer optional. Same posture the W33 retrospective
  took on `capPositions`/`capOrders`.
- **A `503` branch.** The endpoint declares `503` "the performance warehouse is temporarily
  unavailable — retry later", which no design artifact mentions. It renders through
  `core/client.ts`'s default branch as "Senti API request failed: HTTP 503" — true, but it
  does not say the condition is transient, so a model may report a permanent failure. A
  `serviceUnavailableMeans` option mirroring `conflictMeans` is the fix; it belongs with the
  other two performance tools, not in front of them ([CONTEXT D23](../../CONTEXT.md)).

## Files modified

| File | Change |
|---|---|
| `src/tools/performance/summary.ts` | **New.** The tool: four Zod block schemas, `PerformanceSchema`, `PerformanceOutputSchema`, `PerformanceInputSchema`, `parsePerformance`, `formatPerformance`, `registerGetAccountPerformance`. First file in `src/tools/performance/`. |
| `src/tools/performance/summary.test.ts` | **New.** 34 tests — schema nullability, input validation, and every formatter branch. |
| `src/server.ts` | Registers `get_account_performance` — the seventh tool. |
| `src/server.test.ts` | An 11-test `describe` block, plus the `TOOL_CALLS` row that enrols this tool in the five shared invariant tests. |
| `src/smoke.test.ts` | A seventh leg, with an explicit window and no terminal-offline tolerance — this endpoint has no `409`. |
| `src/config.ts` | `SERVER_VERSION` → `1.1.0`. |
| `VERSION`, `package.json`, `package-lock.json` | → `1.1.0`. |
| `README.md` | Tool-table row; "all seven tools"; the `1.1.0` pin; `performance:read` moved into the exercised-scope list. |
| `docs/CHANGELOG.md` | `## [1.1.0]`, carrying this tool and EPIC-4's release tooling — `Unreleased` had to clear, and `v1.1.0` is the tag that first contains it. |
| `docs/CONTEXT.md` | [D23](../../CONTEXT.md) — `reporting` is a currency, validated by shape. |

## Cross-references

- [Epic EPIC-2](../epics/EPIC-2.md)
- [sprint-2026-W33](../sprint-2026-W33.md) — §Phase 3
- [CHANGELOG](../../CHANGELOG.md)
- [CONTEXT D14](../../CONTEXT.md)
- [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [US-2.4](US-2.4-tool-substrate-and-layout.md) · [US-2.12](US-2.12-get-performance-breakdowns-tool.md) · [US-2.13](US-2.13-get-equity-timeseries-tool.md)
