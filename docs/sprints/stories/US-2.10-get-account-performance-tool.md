---
id: US-2.10
title: "get_account_performance tool"
epic: EPIC-2
status: ready
priority: P1
points: 2
sprint: sprint-2026-W34
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

- [ ] **AC-1** — **Given** a call with `accountId`, **When** the request is built,
  **Then** the path is constructed via `accountPath`, **And** the tool is enrolled in
  `src/server.test.ts`'s table-driven traversal test by a new `TOOL_CALLS` row.
- [ ] **AC-2** — **Given** a call supplying `from`, `to` and `reporting`, **When** the
  request is issued, **Then** all three reach the URL as query parameters through
  `client.get`'s `query` option — no tool-side string concatenation builds the query.
- [ ] **AC-3** — **Given** a call omitting `from`, `to` or `reporting`, **When** the
  request is issued, **Then** the omitted parameter is absent from the URL entirely —
  never `from=undefined`, never `from=`.
- [ ] **AC-4** — **Given** a `from` or `to` that is not a calendar date in the format the
  API documents, **When** the tool is called, **Then** the input schema rejects it before
  any HTTP request is made, **And** the returned text names the expected format.
  `reporting` is likewise a closed enum, not a free string.
- [ ] **AC-5** — **Given** a successful response whose `live` is `null`, **When** it is
  formatted, **Then** the text states that the account's terminal could not be reached
  and the live figures are unavailable, **And** it does not render them as `0` and does
  not omit the section silently — the *null is not zero* invariant in its
  performance-endpoint form.
- [ ] **AC-6** — **Given** any successful response, **When** the tool returns, **Then**
  `notes` is present in the `outputSchema` and is the empty array, because this tool
  returns the response in full and cuts nothing. It exists for uniformity across
  `tools/performance/`; a non-empty `notes` from this tool is a bug.
- [ ] **AC-7** — **Given** a `403` from the API, **When** the tool returns, **Then**
  `isError` is true and the text names the `performance:read` scope.
- [ ] **AC-8** — **Given** a `404` from the API, **When** the tool returns, **Then** the
  text carries US-2.4's `login`-vs-`id` hint, identical to the other account-scoped
  tools.

## Tasks

- [ ] **TASK-2.10.1** — Confirm the response and parameter contract against the live
  OpenAPI document before writing a schema (AC: 2, 4, 5)
  - [ ] Read `https://api.sentitrade.xyz/api/v1/openapi.json` for
        `/accounts/{accountId}/performance`: the exact member names of `reporting`, the
        declared type/format of `from` and `to`, and whether `metrics`,
        `portfolioReturn`, `lifetimeIrr` and `live` are the response's whole surface.
        The design spec names those four from a 2026-08-05 read; a schema is written
        against the document, not against a spec's summary of it.
- [ ] **TASK-2.10.2** — `src/tools/performance/summary.ts` domain module (AC: 4, 5, 6)
  - [ ] `PerformanceSchema`, `parsePerformance` via `parseOrThrow`, `formatPerformance`
  - [ ] Input schema: `accountId` required; `from`/`to` optional and date-validated;
        `reporting` an optional Zod enum
  - [ ] `live: null` renders as an explicit "terminal unreachable" line; every nullable
        numeric renders as `—`, never `0`
- [ ] **TASK-2.10.3** — Registration and the `1.1.0` release (AC: 1, 2, 3, 7, 8)
  - [ ] Register through `registerReadTool`; path via `accountPath(args.accountId,
        'performance')`; `scope: 'performance:read'`; no `conflictMeans` — this endpoint
        has no `409`
  - [ ] Pass `from`/`to`/`reporting` through `client.get`'s `query`, letting the client
        drop `undefined` rather than pre-filtering at the call site
  - [ ] `src/server.ts` registration; `TOOL_CALLS` row in `src/server.test.ts`
  - [ ] `VERSION`, `package.json`, `src/config.ts` `SERVER_VERSION` → `1.1.0` in
        lockstep; `docs/CHANGELOG.md` `[1.1.0]`; `README.md` tool-table row
- [ ] **TASK-2.10.4** — Extend `src/smoke.test.ts` with a `get_account_performance` leg
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

> Every row below is drafted before the tests exist and **must be run and confirmed
> non-vacuous before this story closes** — a `vitest -t` filter that matches nothing
> exits 0 ([LESSONS 2](../../LESSONS.md)). Three W33 stories shipped a dead row; the
> file/filter pairs here are predictions, not results.

| AC | Command |
|---|---|
| AC-4, AC-5, AC-6 | `npm test -- src/tools/performance/summary.test.ts` |
| AC-1 | `npm test -- src/server.test.ts -t "get_account_performance.*traversal"` |
| AC-2, AC-3 | `npm test -- src/server.test.ts -t "get_account_performance.*query"` |
| AC-7 | `npm test -- src/server.test.ts -t "get_account_performance.*403"` |
| AC-8 | `npm test -- src/server.test.ts -t "get_account_performance.*404"` |

## Changelog entry

### Added
- `src/tools/performance/summary.ts` — the `get_account_performance` tool:
  `PerformanceSchema`, `parsePerformance`, `formatPerformance`. The first tool to send
  query parameters (`from`, `to`, `reporting`) through `client.get`'s `query` option, and
  the first file in `src/tools/performance/`. An offline terminal arrives as
  `live: null` and is stated as such, never rendered as zeroes.

## Implementation notes

<!-- Filled during implementation. -->

## Files modified

<!-- Filled during implementation. -->

## Cross-references

- [Epic EPIC-2](../epics/EPIC-2.md)
- [sprint-2026-W34](../sprint-2026-W34.md)
- [CHANGELOG](../../CHANGELOG.md)
- [CONTEXT D14](../../CONTEXT.md)
- [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [US-2.4](US-2.4-tool-substrate-and-layout.md) · [US-2.12](US-2.12-get-performance-breakdowns-tool.md) · [US-2.13](US-2.13-get-equity-timeseries-tool.md)
