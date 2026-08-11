---
id: US-2.12
title: "get_performance_breakdowns tool"
epic: EPIC-2
status: review
priority: P1
points: 3
sprint: sprint-2026-W33
assignee: bluezdot
created: 2026-08-10
updated: 2026-08-11
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

> **Outcome: five cuts, not four.** TASK-2.12.1's measurement showed the four above leave
> 4,938 tokens — 1.2% inside the budget, and only because the smoke account trades one
> symbol. `perSymbol`'s two running-sum row-sets were dropped as well, under
> §Performance budget's standing instruction, taking it to 3,047. See
> §Implementation notes and [CONTEXT D25](../../CONTEXT.md). The table above is left as
> written: it is what the story was planned against.

**The 70,000-token figure is an estimate and has never been measured.** [EPIC-2](../epics/EPIC-2.md)
§Live payload findings is explicit: `breakdowns`' payload weight "cannot be estimated
from the schema — it has to be measured." A working smoke key arrived 2026-08-10, so it
can be, and TASK-2.12.1 does it **before** the shaping code is written. If the real
number contradicts D10 by an order of magnitude, the cuts are re-argued then, not at
review — this is carried as the first risk in
[sprint-2026-W33](../sprint-2026-W33.md) §Phase 3 risks.

Shipped as `1.3.0` ([CONTEXT D14](../../CONTEXT.md)), not the expansion spec's `0.10.0`.

## Acceptance criteria

- [x] **AC-1** — **Given** a call with `accountId`, **When** the request is built,
  **Then** the path is constructed via `accountPath`, **And** the tool is enrolled in
  `src/server.test.ts`'s table-driven traversal test by a new `TOOL_CALLS` row.
- [x] **AC-2** — **Given** `from`, `to` and `reporting`, **When** the request is issued,
  **Then** all three ride `client.get`'s `query` option using the same input-schema
  shape [US-2.10](US-2.10-get-account-performance-tool.md) settled — same date
  validation, same `reporting` enum, not a second declaration of either.
- [x] **AC-3** — **Given** a response containing `perAccount`, **When** the tool returns,
  **Then** `perAccount` appears in neither `content` nor `structuredContent`.
- [x] **AC-4** — **Given** a `daily` row containing `cumulativePnl`, `cumulativeVolume`
  and `cumulativeNotional`, **When** the tool returns, **Then** none of the three appears
  in the output, **And** the non-cumulative columns they were running sums of are
  retained in full.
- [x] **AC-5** — **Given** a `perSymbol` block covering more than 10 symbols, **When** the
  tool returns, **Then** exactly the 10 symbols with the largest absolute P&L are kept,
  **And** every `dateKey` row survives — the cut removes columns, not rows.
- [x] **AC-6** — **Given** the same over-10-symbol response, **When** the tool returns,
  **Then** `notes` states how many symbols were dropped and by what criterion, **And**
  the same sentence appears in `content`, not only in `structuredContent`.
- [x] **AC-7** — **Given** a response whose `heatmap` spans many dates, **When** the tool
  returns, **Then** it is collapsed to 24 hourly buckets totalled across the window,
  **And** `notes` records the collapse.
- [x] **AC-8** — **Given** a response with 10 or fewer symbols and no other cut
  applicable, **When** the tool returns, **Then** `notes` is the empty array. A `notes`
  entry is never emitted for a cut that did not happen.
- [x] **AC-9** — **Given** a `403` from the API, **When** the tool returns, **Then**
  `isError` is true and the text names the `performance:read` scope.
- [x] **AC-10** — **Given** a `404` from the API, **When** the tool returns, **Then** the
  text carries US-2.4's `login`-vs-`id` hint.

## Tasks

- [x] **TASK-2.12.1** — **Measure the live payload before writing any shaping code**
  (AC: 5, 6, 7)
  - [x] With the working `SENTI_SMOKE_KEY`, fetch a real `breakdowns` response over the
        widest window the account has data for; record the byte size, an approximate
        token count, the symbol count in `perSymbol`, and the `dates[]` length in
        `heatmap`
  - [x] Write the numbers into §Implementation notes and compare against
        [CONTEXT D10](../../CONTEXT.md)'s ~70,000-token estimate. If they disagree by an
        order of magnitude, re-argue the cuts and the story's points **before** starting
        TASK-2.12.2, and append a CONTEXT revision entry (RULE-7 — never edit D10 in
        place)
  - [x] Confirm the response's actual field names against
        `https://api.sentitrade.xyz/api/v1/openapi.json` — `perAccount`, `daily`,
        `perSymbol`, `heatmap` and the three `cumulative*` columns come from a
        2026-08-05 read of the spec, not from the document today
- [x] **TASK-2.12.2** — `src/tools/performance/breakdowns.ts` domain module
  (AC: 3, 4, 5, 6, 7, 8)
  - [x] `BreakdownsSchema`, `parseBreakdowns` via `parseOrThrow`, `formatBreakdowns`
  - [x] A shaping function per cut, each returning its own `notes` line or none, so a
        cut and its trace cannot drift apart
  - [x] Top-10-by-|P&L| selection over `perSymbol` columns, with `dateKey` rows intact
  - [x] `heatmap` → 24 hourly totals
- [x] **TASK-2.12.3** — Registration and the `1.3.0` release (AC: 1, 2, 9, 10)
  - [x] Register through `registerReadTool`; path via `accountPath(args.accountId,
        'performance', 'breakdowns')`; `scope: 'performance:read'`; no `conflictMeans`
  - [x] Tool description states that the response is shaped and that
        `get_account_performance` is the tool for a whole-account figure — a model that
        does not know this one is shaped will reach for it by default
  - [x] `src/server.ts` registration; `TOOL_CALLS` row in `src/server.test.ts`
  - [x] `VERSION`, `package.json`, `src/config.ts` `SERVER_VERSION` → `1.3.0` in
        lockstep; `docs/CHANGELOG.md` `[1.3.0]`; `README.md` tool-table row
- [x] **TASK-2.12.4** — Extend `src/smoke.test.ts` with a `get_performance_breakdowns`
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

### TASK-2.12.1 — the measurement, taken before any shaping code existed

Read 2026-08-11 against `be-dev.sentitrade.xyz`, account `413878201`, over the widest
window it has data for: **2026-06-10 → 2026-08-11, 63 calendar days**, of which 32 carry
activity. The account trades **one symbol** (`XAUUSDm`) — which is what makes the
`perSymbol` cut inert here and is the reason for the limitation recorded below.

| | Bytes | ≈ tokens @4B | Share |
|---|---|---|---|
| **Raw response** | **87,063** | **21,766** | 100% |
| `heatmap` | 40,707 | 10,177 | 47% |
| `perAccount` | 24,507 | 6,127 | 28% |
| `perSymbol` | 15,021 | 3,755 | 17% |
| `daily` | 6,780 | 1,695 | 8% |

The default 30-day window measures 34,656 bytes ≈ 8,664 tokens. `daily` holds 32 rows —
only days with activity — while `perAccount` and `perSymbol` pad all 63 calendar days.
`heatmap` was 32 dates × 24 hourly series × 2 measures = 1,536 points.

**Against [CONTEXT D10](../../CONTEXT.md)'s ~70,000-token estimate for a year:** 21,766
tokens over 63 days extrapolates to roughly **126,000 tokens over 365** — larger than the
estimate but the same order of magnitude, so the cuts were **not** re-argued and the
story's 3 points stood. Recorded as [CONTEXT D25](../../CONTEXT.md) rather than as an
edit to D10 (RULE-7).

**Field names re-confirmed against `https://api.sentitrade.xyz/api/v1/openapi.json` on
the day, not inherited from the 2026-08-05 read.** All four top-level blocks are as
assumed. Two things the spec adds that no design artifact mentioned: `perSymbol` carries
**two** symbol lists (`pnlSymbols`, `dealsSymbols`) and **four** row-sets, two of them
running sums (`cumPnlRows`, `cumDealsRows`); and `heatmap`'s series arrive **newest hour
first**, `23:00` down to `00:00`.

**Every cut's premise was verified numerically, not inferred from field names:**

| Claim | Result |
|---|---|
| `daily.cumulativePnl` / `cumulativeVolume` / `cumulativeNotional` are running sums | **Confirmed**, all three, row by row |
| `perSymbol.cumPnlRows` / `cumDealsRows` are running sums of the `daily*Rows` | **Confirmed**, value by value |
| `perAccount` restates `daily` for the one scoped account | **Confirmed** — 32/32 `dailyPnlRows` reproduce `daily.pnl` exactly, 0 differ; `logins` is `['413878201']`, the account itself |
| the 24-bucket collapse preserves totals | **Confirmed** — heatmap grid totals 18,743.55 against `daily`'s 18,743.55 |

### The fifth cut, and why the four in D10 were not enough

Simulated on the real payload, **the four cuts D10 names leave 19,751 bytes ≈ 4,938
tokens** — 77.3% removed, and 1.2% inside the ≤5,000-token budget. That margin exists
only because this account trades one symbol: `perSymbol` is then 76% of what remains.

`perSymbol.cumPnlRows` and `cumDealsRows` are exact running sums (verified above), so
they fall to cut 2's own argument. Dropping them is **cut 5**, sanctioned by
§Performance budget's "the fix is a further cut with a `notes` line — never a silent
one", and it is not silent: [CONTEXT D25](../../CONTEXT.md), the `1.3.0` CHANGELOG
section and this note. It carries **no `notes` line**, because it loses nothing — the
note policy this story settles is that a note records *information loss*, not removal,
which is what keeps AC-8's empty `notes` reachable at all.

### TASK-2.12.4 — shaped versus raw, measured live

`npm run test:smoke`, same account and same widest window, printed by the new leg:

```
[smoke] breakdowns 2026-06-10 → 2026-08-11: raw 87063 bytes (~21766 tok)
        → shaped 12187 bytes (~3047 tok), 86.0% removed
```

**3,047 tokens against a ≤5,000 budget** — met with 39% headroom, versus 1.2% at four
cuts. The smoke leg asserts the budget rather than only printing it.

### Known limitation — the budget does not hold at the top-ten cap

Neither four cuts nor five bring an account trading **ten or more symbols** over a
comparable window under 5,000 tokens: `perSymbol` scales with symbol count, projecting to
~14,900 tokens at four cuts and **~8,050 at five**. The budget as this story defines it is
"the widest window the smoke account can produce", and it is met there. Carried as a
trigger in [CONTEXT D25](../../CONTEXT.md), not fixed here — the candidate next cut is
`perSymbol`'s date rows, which pad every calendar day including days with no activity
(63 rows against `daily`'s 32 on the measured account).

### Decisions taken during implementation

- **`perAccount` is declared `z.unknown()`, not transcribed.** `parse.ts` validates
  all-or-nothing so malformed data never reaches the model; data this tool drops never
  reaches the model whatever shape it arrives in. Validating it would only convert an
  upstream change in a block nobody reads into an outage for the blocks everybody does.
- **Ranking is on absolute *net* P&L, not on churn.** `breakdowns.test.ts`'s fixture
  carries a symbol that swings +5,000 then −5,100 — the largest daily figures on the
  account, netting −100. Under the wrong criterion it ranks first of twelve; under AC-5's
  it ranks last and is dropped. A cut implementing the wrong rule fails rather than
  passes quietly.
- **The symbol universe is the union of `pnlSymbols` and `dealsSymbols`,** so the P&L
  half and the deal-count half describe the same ten. Ranking each separately would
  produce a symbol whose P&L is present and whose deal count is not, which reads as "no
  deals" rather than "not in this answer".
- **Hourly buckets are matched by series `name`, not by index,** and returned ascending.
  The API sends both series newest-hour-first; pairing by index would eventually report
  one hour's P&L against another's deal count.
- **The text summarizes and the structured channel carries the series.** Both reach the
  model's context, so a text restating every row would put back the weight the cuts
  removed. The text answers the two questions the tool exists for — best/worst day,
  symbols worst-first, best/worst hour — and repeats every note verbatim.
- **`windowOf` and `DEFAULT_CURRENCY` are now exported from `summary.ts`** rather than
  re-declared. Both are statements about the API's defaults, not formatting helpers, and
  two copies could disagree about what an omitted `from` means. `money`/`count` stay
  local, matching how `deals.ts` already carries its own.

## Files modified

- `src/tools/performance/breakdowns.ts` — **new.** The tool, its schemas, the five
  shaping functions and the formatter.
- `src/tools/performance/breakdowns.test.ts` — **new.** 40 tests over the cuts, the note
  policy and the text.
- `src/tools/performance/summary.ts` — `windowOf` and `DEFAULT_CURRENCY` exported.
- `src/server.ts` — `registerGetPerformanceBreakdowns`.
- `src/server.test.ts` — `BREAKDOWNS` fixture, a `TOOL_CALLS` row, and a
  `get_performance_breakdowns` block covering the path, query and error branches.
- `src/smoke.test.ts` — a ninth live leg, with the raw-versus-shaped measurement.
- `VERSION`, `package.json`, `package-lock.json`, `src/config.ts` — `1.3.0`.
- `docs/CHANGELOG.md` — the `[1.3.0]` section.
- `docs/CONTEXT.md` — [D25](../../CONTEXT.md).
- `README.md` — tool-table row, scope list, and the version claims in §Install.
- `AGENTS.md` — current state, tool count, and the `tools/performance/` layout note.

## Cross-references

- [Epic EPIC-2](../epics/EPIC-2.md)
- [sprint-2026-W33](../sprint-2026-W33.md) — §Phase 3
- [CHANGELOG](../../CHANGELOG.md)
- [CONTEXT D10](../../CONTEXT.md) · [CONTEXT D14](../../CONTEXT.md)
- [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [US-2.4](US-2.4-tool-substrate-and-layout.md) · [US-2.10](US-2.10-get-account-performance-tool.md) · [US-2.13](US-2.13-get-equity-timeseries-tool.md)
