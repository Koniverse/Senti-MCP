---
id: US-2.12
title: "get_performance_breakdowns tool"
epic: EPIC-2
status: ready
priority: P1
points: 3
sprint: sprint-2026-W33
assignee: bluezdot
created: 2026-08-10
updated: 2026-08-10
---

## Goal

A user asks "which symbol is losing me money" or "what hour of the day do I trade
worst". `GET /api/v1/accounts/{accountId}/performance/breakdowns` holds both answers and
is the largest payload in the API — roughly 70,000 tokens for a year-long window
([CONTEXT D10](../../CONTEXT.md)). This story ships the tool *and* the four cuts that make
it answerable inside a context window, plus the `notes` trace that stops a model from
reading a shortened breakdown as a complete one and stating a confident, wrong conclusion
about real money.

## Background

Per the [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
§Tool surface, `get_performance_breakdowns` reads
`GET /api/v1/accounts/{accountId}/performance/breakdowns` under `performance:read` and
lands in `src/tools/performance/breakdowns.ts`, beside
[US-2.10](US-2.10-get-account-performance-tool.md)'s `summary.ts`.

**The new axis is payload shaping, and it is the reason [CONTEXT D10](../../CONTEXT.md)
exists.** "Return it all and let the host cope" is a decision to spend tens of thousands
of tokens on a question the user thought was small — both `content` and
`structuredContent` enter the model's context. §Payload policy specifies four cuts:

| Cut | What goes | Why it costs nothing |
|---|---|---|
| `perAccount` | the whole map | The endpoint is already scoped to one account, and the map contains that one account — six parallel row-sets restating `daily` in a wider shape |
| `cumulativePnl`, `cumulativeVolume`, `cumulativeNotional` | three columns of `daily` | Running sums of three columns already present in the same row. Halves `daily` at zero information loss |
| `perSymbol` beyond the top 10 by \|P&L\| | *columns*, not rows | Rows are keyed by `dateKey` with one numeric column per symbol, so this drops symbols, not dates |
| `heatmap` → 24 hourly buckets | per-date resolution | `dates[]` × 24 hour-named series × 2 measures ≈ 1,440 points for 30 days, growing linearly. The only question it can answer in text is "which hour do I trade worst"; per-date resolution is usable by a chart, and there is no chart here |

**Three of the four are free; the `perSymbol` cut is not, and that is what `notes` is
for.** Dropping the 11th symbol removes information a user might have wanted. Every tool
that can cut carries `notes: string[]` repeated in `content`: what was dropped, how much
remains, and how to ask for the rest. `notes` is empty when nothing was cut, so its
presence in the schema never implies a cut occurred — an always-populated `notes` would
be as misleading as no `notes` at all.

**The 70,000-token figure is an estimate and has never been measured.** [EPIC-2](../epics/EPIC-2.md)
§Live payload findings is explicit: `breakdowns`' payload weight "cannot be estimated
from the schema — it has to be measured." A working smoke key arrived 2026-08-10, so it
can be, and TASK-2.12.1 does it **before** the shaping code is written. If the real
number contradicts D10 by an order of magnitude, the cuts are re-argued then, not at
review — this is carried as the first risk in
[sprint-2026-W33](../sprint-2026-W33.md) §Phase 3 risks.

Shipped as `1.3.0` ([CONTEXT D14](../../CONTEXT.md)), not the expansion spec's `0.10.0`.

## Acceptance criteria

- [ ] **AC-1** — **Given** a call with `accountId`, **When** the request is built,
  **Then** the path is constructed via `accountPath`, **And** the tool is enrolled in
  `src/server.test.ts`'s table-driven traversal test by a new `TOOL_CALLS` row.
- [ ] **AC-2** — **Given** `from`, `to` and `reporting`, **When** the request is issued,
  **Then** all three ride `client.get`'s `query` option using the same input-schema
  shape [US-2.10](US-2.10-get-account-performance-tool.md) settled — same date
  validation, same `reporting` enum, not a second declaration of either.
- [ ] **AC-3** — **Given** a response containing `perAccount`, **When** the tool returns,
  **Then** `perAccount` appears in neither `content` nor `structuredContent`.
- [ ] **AC-4** — **Given** a `daily` row containing `cumulativePnl`, `cumulativeVolume`
  and `cumulativeNotional`, **When** the tool returns, **Then** none of the three appears
  in the output, **And** the non-cumulative columns they were running sums of are
  retained in full.
- [ ] **AC-5** — **Given** a `perSymbol` block covering more than 10 symbols, **When** the
  tool returns, **Then** exactly the 10 symbols with the largest absolute P&L are kept,
  **And** every `dateKey` row survives — the cut removes columns, not rows.
- [ ] **AC-6** — **Given** the same over-10-symbol response, **When** the tool returns,
  **Then** `notes` states how many symbols were dropped and by what criterion, **And**
  the same sentence appears in `content`, not only in `structuredContent`.
- [ ] **AC-7** — **Given** a response whose `heatmap` spans many dates, **When** the tool
  returns, **Then** it is collapsed to 24 hourly buckets totalled across the window,
  **And** `notes` records the collapse.
- [ ] **AC-8** — **Given** a response with 10 or fewer symbols and no other cut
  applicable, **When** the tool returns, **Then** `notes` is the empty array. A `notes`
  entry is never emitted for a cut that did not happen.
- [ ] **AC-9** — **Given** a `403` from the API, **When** the tool returns, **Then**
  `isError` is true and the text names the `performance:read` scope.
- [ ] **AC-10** — **Given** a `404` from the API, **When** the tool returns, **Then** the
  text carries US-2.4's `login`-vs-`id` hint.

## Tasks

- [ ] **TASK-2.12.1** — **Measure the live payload before writing any shaping code**
  (AC: 5, 6, 7)
  - [ ] With the working `SENTI_SMOKE_KEY`, fetch a real `breakdowns` response over the
        widest window the account has data for; record the byte size, an approximate
        token count, the symbol count in `perSymbol`, and the `dates[]` length in
        `heatmap`
  - [ ] Write the numbers into §Implementation notes and compare against
        [CONTEXT D10](../../CONTEXT.md)'s ~70,000-token estimate. If they disagree by an
        order of magnitude, re-argue the cuts and the story's points **before** starting
        TASK-2.12.2, and append a CONTEXT revision entry (RULE-7 — never edit D10 in
        place)
  - [ ] Confirm the response's actual field names against
        `https://api.sentitrade.xyz/api/v1/openapi.json` — `perAccount`, `daily`,
        `perSymbol`, `heatmap` and the three `cumulative*` columns come from a
        2026-08-05 read of the spec, not from the document today
- [ ] **TASK-2.12.2** — `src/tools/performance/breakdowns.ts` domain module
  (AC: 3, 4, 5, 6, 7, 8)
  - [ ] `BreakdownsSchema`, `parseBreakdowns` via `parseOrThrow`, `formatBreakdowns`
  - [ ] A shaping function per cut, each returning its own `notes` line or none, so a
        cut and its trace cannot drift apart
  - [ ] Top-10-by-|P&L| selection over `perSymbol` columns, with `dateKey` rows intact
  - [ ] `heatmap` → 24 hourly totals
- [ ] **TASK-2.12.3** — Registration and the `1.3.0` release (AC: 1, 2, 9, 10)
  - [ ] Register through `registerReadTool`; path via `accountPath(args.accountId,
        'performance', 'breakdowns')`; `scope: 'performance:read'`; no `conflictMeans`
  - [ ] Tool description states that the response is shaped and that
        `get_account_performance` is the tool for a whole-account figure — a model that
        does not know this one is shaped will reach for it by default
  - [ ] `src/server.ts` registration; `TOOL_CALLS` row in `src/server.test.ts`
  - [ ] `VERSION`, `package.json`, `src/config.ts` `SERVER_VERSION` → `1.3.0` in
        lockstep; `docs/CHANGELOG.md` `[1.3.0]`; `README.md` tool-table row
- [ ] **TASK-2.12.4** — Extend `src/smoke.test.ts` with a `get_performance_breakdowns`
  leg, and record the shaped-vs-raw size in §Implementation notes (AC: 5, 6, 7)

## Dev notes

### Architecture constraints

- Registers through `registerReadTool` and builds its path through `accountPath` — three
  segments here (`accounts/{id}/performance/breakdowns`), which `accountPath`'s
  `...rest` signature already covers; still no tool-side concatenation.
- **Every cut leaves a trace.** [CONTEXT D10](../../CONTEXT.md) and design spec §Payload
  policy: `notes: string[]` in the `outputSchema`, repeated in `content`. A model that
  reads a truncated `daily` without knowing it was truncated will state a confident,
  wrong conclusion about real money — this is the story where that risk is highest.
- Query parameters ride `client.get`'s `query`; the call site builds no query string.
- Input-schema shape for `from`/`to`/`reporting` is inherited from
  [US-2.10](US-2.10-get-account-performance-tool.md), not re-declared.
- **This story registers a read tool only** — `readOnlyHint: true` is hardcoded in
  `registerReadTool`.

### Performance budget

This story has no latency budget; its budget is **payload weight**, and it is the only
story in EPIC-2 that has one.

- Shaped response must fit comfortably inside a normal host context window — the working
  target is **≤ 5,000 tokens** for the widest window the smoke account can produce,
  against D10's ~70,000-token unshaped estimate.
- Measured by TASK-2.12.1 (raw) and TASK-2.12.4 (shaped), both recorded in
  §Implementation notes as numbers, not adjectives.
- If the shaped response misses the target, the fix is a further cut with a `notes` line
  — never a silent one.

### Cross-story dependencies

- **Builds on** [US-2.4](US-2.4-tool-substrate-and-layout.md) — `registerReadTool`,
  `parseOrThrow`, `accountPath`, `client.get`'s `query`.
- **Builds on** [US-2.10](US-2.10-get-account-performance-tool.md) — the
  `from`/`to`/`reporting` input-schema shape and the `tools/performance/` folder.
- **Sibling of** [US-2.13](US-2.13-get-equity-timeseries-tool.md) — both drop
  `perAccount` and both carry `notes`. This story lands first, and US-2.13 reuses its
  `notes` phrasing rather than inventing a second vocabulary for the same idea, the same
  way [US-2.9](US-2.9-list-pending-orders-tool.md) mirrored
  [US-2.8](US-2.8-list-positions-tool.md).

### What we explicitly did NOT do

- **No parameter to request the unshaped payload.** A `full: true` escape hatch would
  reintroduce the 70,000-token response the shaping exists to prevent, and a model with
  an escape hatch will use it. If a user genuinely needs an un-dropped symbol, the answer
  is a narrower `from`/`to` window, and `notes` says so.
- **No caching of a shaped response.** Out of scope for EPIC-2 per the v1 design spec —
  a decision, not an omission.
- **No client-side recomputation of the dropped `cumulative*` columns.** They are running
  sums the model can compute from the retained columns if it needs them; recomputing them
  in the formatter would restore the payload weight the cut removed.
- **No `view`/`section` parameter collapsing `daily`, `perSymbol` and `heatmap` into one
  selectable output.** Design spec §Decisions taken 2 rules out `anyOf` output schemas.

### References

- [Source: design spec §Tool surface](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md) — `get_performance_breakdowns` row
- [Source: design spec §Payload policy](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md) — the four cuts, and "Every cut leaves a trace"
- [Source: CONTEXT D10](../../CONTEXT.md) — tools bind and shape their own payloads
- [Source: CONTEXT D14](../../CONTEXT.md) — why this ships `1.3.0`
- [Source: EPIC-2 §Live payload findings](../epics/EPIC-2.md) — the payload weight that has to be measured
- [Source: LESSONS 2](../../LESSONS.md) — run every Verification-commands row before trusting it
- [Senti Quant Public API](https://api.sentitrade.xyz/api/v1/openapi.json) — the authority for TASK-2.12.1

## Verification commands

> Drafted before the tests exist; **every row is run and confirmed non-vacuous before
> this story closes** ([LESSONS 2](../../LESSONS.md)).

| AC | Command |
|---|---|
| AC-3, AC-4, AC-5, AC-6, AC-7, AC-8 | `npm test -- src/tools/performance/breakdowns.test.ts` |
| AC-1 | `npm test -- src/server.test.ts -t "get_performance_breakdowns.*traversal"` |
| AC-2 | `npm test -- src/server.test.ts -t "get_performance_breakdowns.*query"` |
| AC-9 | `npm test -- src/server.test.ts -t "get_performance_breakdowns.*403"` |
| AC-10 | `npm test -- src/server.test.ts -t "get_performance_breakdowns.*404"` |

## Changelog entry

### Added
- `src/tools/performance/breakdowns.ts` — the `get_performance_breakdowns` tool:
  `BreakdownsSchema`, `parseBreakdowns`, `formatBreakdowns`. The largest payload in the
  API, shaped down before it reaches the model: `perAccount` dropped, the three
  `cumulative*` columns dropped from `daily`, `perSymbol` reduced to the top 10 symbols
  by absolute P&L, and `heatmap` collapsed to 24 hourly buckets. Every cut is recorded in
  `notes` and repeated in the text, and `notes` is empty when nothing was cut.

## Implementation notes

<!-- Filled during implementation. TASK-2.12.1's measured payload numbers go here first,
     before any shaping code is written. -->

## Files modified

<!-- Filled during implementation. -->

## Cross-references

- [Epic EPIC-2](../epics/EPIC-2.md)
- [sprint-2026-W33](../sprint-2026-W33.md) — §Phase 3
- [CHANGELOG](../../CHANGELOG.md)
- [CONTEXT D10](../../CONTEXT.md) · [CONTEXT D14](../../CONTEXT.md)
- [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [US-2.4](US-2.4-tool-substrate-and-layout.md) · [US-2.10](US-2.10-get-account-performance-tool.md) · [US-2.13](US-2.13-get-equity-timeseries-tool.md)
