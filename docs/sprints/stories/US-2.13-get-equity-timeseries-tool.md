---
id: US-2.13
title: "get_equity_timeseries tool, and EPIC-2's close"
epic: EPIC-2
status: done
priority: P1
points: 3
sprint: sprint-2026-W33
assignee: bluezdot
created: 2026-08-10
updated: 2026-08-12
version_shipped: 1.4.0
---

## Goal

A user asks "how has my equity moved" or "what was my worst drawdown".
`GET /api/v1/accounts/{accountId}/performance/timeseries` answers both, and answers them
with a point per interval — a series that grows without bound as the requested window
widens. This story ships the tool and the downsampling that keeps a long window
answerable, under one hard constraint: the points a trader actually cares about — where
the series started, where it ended, and how deep the worst drawdown went — must survive
the downsample, not fall between two samples.

Its close is the last read tool in the API. It closes [EPIC-2](../epics/EPIC-2.md) and
ends [sprint-2026-W33](../sprint-2026-W33.md)'s Phase 3 — the sprint's own `status:` is
the maintainer's to flip ([CONTEXT D21](../../CONTEXT.md)).

## Background

Per the [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
§Tool surface, `get_equity_timeseries` reads
`GET /api/v1/accounts/{accountId}/performance/timeseries` under `performance:read` and
lands in `src/tools/performance/timeseries.ts`, the third and last file in
`tools/performance/`.

**The new axis is downsampling, which is a different operation from
[US-2.12](US-2.12-get-performance-breakdowns-tool.md)'s cutting.** US-2.12 drops fields
and columns that are redundant or chart-only; here nothing is redundant — every point is
a real observation, and the tool has to choose which ones a model sees. §Payload policy:
drop `perAccount` (the same free cut, for the same reason — an account-scoped endpoint
returning a one-entry per-account map), downsample `portfolio` to at most **200 points**,
**always keeping the first point, the last point, and the deepest drawdown**, and keep
`caveats` and `portfolioCaveats` in full.

**The three pinned points are the load-bearing requirement, and a naive stride breaks
them.** Taking every Nth point is the obvious implementation and it will, on some
windows, drop the trough of the deepest drawdown and the final point — producing a series
that reads as smoother and shallower than what actually happened. That is the same class
of error as rendering a null balance as `0`: the output is well-formed and wrong in the
direction that flatters the account. AC-4 exists to make it fail a test rather than fail
a user.

**`caveats` and `portfolioCaveats` are never touched.** They are the API's own statements
about what its numbers do not mean — precisely the content that must not be summarized by
a tool whose job is to summarize.

**This story closes the epic, so it carries the honest accounting.** [EPIC-2](../epics/EPIC-2.md)
§Live payload findings records two branches that have never run against the real service:
US-2.9's `priceStopLimit` nullability (the smoke account holds zero pending orders) and
the `409`/`conflictMeans` terminal-offline path (the terminal is online). Closing the epic
does not make those verified. TASK-2.13.4 states them in the epic's closing text rather
than letting `status: done` imply a coverage that does not exist.

Shipped as `1.4.0` ([CONTEXT D14](../../CONTEXT.md)), not the expansion spec's `0.11.0`.

## Acceptance criteria

- [x] **AC-1** — **Given** a call with `accountId`, **When** the request is built,
  **Then** the path is constructed via `accountPath`, **And** the tool is enrolled in
  `src/server.test.ts`'s table-driven traversal test by a new `TOOL_CALLS` row.
- [x] **AC-2** — **Given** `from`, `to` and `reporting`, **When** the request is issued,
  **Then** all three ride `client.get`'s `query` option using the input-schema shape
  [US-2.10](US-2.10-get-account-performance-tool.md) settled.
- [x] **AC-3** — **Given** a response containing `perAccount`, **When** the tool returns,
  **Then** `perAccount` appears in neither `content` nor `structuredContent`.
- [x] **AC-4** — **Given** a `portfolio` series longer than 200 points, **When** it is
  downsampled, **Then** the result holds at most 200 points, **And** the first point,
  the last point, and the point of deepest drawdown are all present in it — including
  when the deepest drawdown falls between two sampling strides. This AC is defended by a
  fixture built so that a naive every-Nth stride would drop the trough.
- [x] **AC-5** — **Given** a `portfolio` series of 200 points or fewer, **When** the tool
  returns, **Then** the series passes through unmodified, **And** `notes` is the empty
  array — no downsampling note is emitted for a downsample that did not happen.
- [x] **AC-6** — **Given** a downsampled series, **When** the tool returns, **Then**
  `notes` states how many points the original held, how many remain, and that the first,
  last and deepest-drawdown points were retained, **And** the same information appears in
  `content`, not only in `structuredContent`.
- [x] **AC-7** — **Given** any response, **When** the tool returns, **Then** `caveats` and
  `portfolioCaveats` are present in full — never downsampled, never truncated, never
  summarized.
- [x] **AC-8** — **Given** a `403` from the API, **When** the tool returns, **Then**
  `isError` is true and the text names the `performance:read` scope.
- [x] **AC-9** — **Given** a `404` from the API, **When** the tool returns, **Then** the
  text carries US-2.4's `login`-vs-`id` hint.
- [x] **AC-10** — **Given** all ten read operations now have a tool, **When**
  `src/server.test.ts`'s table-driven invariant tests run, **Then** all ten are enrolled
  in the key-leakage, `outputSchema`-validation, `readOnlyHint` and traversal tables —
  no tool is registered outside them.

## Tasks

- [x] **TASK-2.13.1** — Confirm the response contract against the live OpenAPI document
  (AC: 3, 4, 7)
  - [x] Read `https://api.sentitrade.xyz/api/v1/openapi.json` for
        `/accounts/{accountId}/performance/timeseries`: the shape of a `portfolio` point,
        whether `caveats` and `portfolioCaveats` are both present and their types, and
        whether `perAccount` is still returned. The design spec names these from a
        2026-08-05 read
- [x] **TASK-2.13.2** — `src/tools/performance/timeseries.ts` domain module
  (AC: 3, 4, 5, 6, 7)
  - [x] `TimeseriesSchema`, `parseTimeseries` via `parseOrThrow`, `formatTimeseries`
  - [x] `downsample(points, max)` — pins first, last and deepest-drawdown, then fills the
        remaining budget evenly. Unit-tested against a fixture whose trough sits between
        strides
  - [x] `notes` phrasing reused from [US-2.12](US-2.12-get-performance-breakdowns-tool.md)
        rather than newly invented
- [x] **TASK-2.13.3** — Registration and the `1.4.0` release (AC: 1, 2, 8, 9)
  - [x] Register through `registerReadTool`; path via `accountPath(args.accountId,
        'performance', 'timeseries')`; `scope: 'performance:read'`; no `conflictMeans`
  - [x] Tool description states that long windows are downsampled and that the retained
        points include the extremes
  - [x] `src/server.ts` registration; `TOOL_CALLS` row in `src/server.test.ts`
  - [x] `VERSION`, `package.json`, `src/config.ts` `SERVER_VERSION` → `1.4.0` in
        lockstep; `docs/CHANGELOG.md` `[1.4.0]`; `README.md` tool-table row naming all
        ten tools
- [x] **TASK-2.13.4** — Close EPIC-2 and end sprint W33's Phase 3 (AC: 10)
  - [x] Extend `src/smoke.test.ts` with a `get_equity_timeseries` leg, so the smoke walk
        covers all ten read tools
  - [x] [EPIC-2](../epics/EPIC-2.md): `status: done`; the four story-index rows flipped;
        §Remaining work replaced with a closing statement that **names the branches
        shipped unexercised against the live service** — US-2.9's `priceStopLimit`
        nullability and the `409` terminal-offline path — rather than closing silently
  - [x] [sprint-2026-W33](../sprint-2026-W33.md): Phase 3 scope table flipped, and a
        **Phase 3 retrospective** section appended beside the Phase 1 and Phase 2 ones.
        Do **not** touch the sprint's `status:` — only the maintainer closes a sprint
        ([CONTEXT D21](../../CONTEXT.md))
  - [x] `npm run agile:status` to regenerate [STATUS.md](../STATUS.md) (RULE-5)

## Dev notes

### Architecture constraints

- Registers through `registerReadTool` and builds its path through `accountPath` with
  three segments; no tool-side concatenation.
- **Every cut leaves a trace** — [CONTEXT D10](../../CONTEXT.md): `notes: string[]` in
  the `outputSchema`, repeated in `content`, empty when nothing was cut.
- Input-schema shape for `from`/`to`/`reporting` inherited from
  [US-2.10](US-2.10-get-account-performance-tool.md).
- **`caveats`/`portfolioCaveats` are exempt from every shaping rule in this file.** They
  are the API's own qualifications on its numbers; a tool that abridges them removes the
  reason a model would hedge.
- **This story registers a read tool only.** It is also the story after which every read
  operation has a tool, which makes `readOnlyHint: true` and AC-10's enrolment tables the
  standing barrier against [EPIC-3](../epics/EPIC-3.md)'s write tools arriving unguarded.

### Performance budget

- Downsampled `portfolio` is capped at **200 points** regardless of window width — the
  bound is on output size, not on the requested range.
- `downsample`'s cost is linear in the input length; it makes one pass to find the
  drawdown trough and one to sample. No sort of the full series.
- Defended by `src/tools/performance/timeseries.test.ts`.

### Cross-story dependencies

- **Builds on** [US-2.4](US-2.4-tool-substrate-and-layout.md) — `registerReadTool`,
  `parseOrThrow`, `accountPath`, `client.get`'s `query`.
- **Builds on** [US-2.10](US-2.10-get-account-performance-tool.md) — the
  `from`/`to`/`reporting` input-schema shape and `tools/performance/`.
- **Builds on** [US-2.12](US-2.12-get-performance-breakdowns-tool.md) — the `perAccount`
  drop and the `notes` vocabulary, reused rather than re-derived.
- **Required by nothing.** This is the last story in EPIC-2; the next work is
  [EPIC-3](../epics/EPIC-3.md), which needs its own design spec before it opens.

### What we explicitly did NOT do

- **No configurable point budget.** A `maxPoints` parameter lets a model ask for the
  unshaped series and reintroduces the payload weight the cap exists to prevent — the
  same rejection [US-2.12](US-2.12-get-performance-breakdowns-tool.md) makes of a
  `full: true` escape hatch. A narrower `from`/`to` is the supported way to get finer
  resolution, and `notes` says so.
- **No interpolation or smoothing.** Every returned point is a real observation. A
  synthesized point would be indistinguishable from a real one in the model's context.
- **No second downsampling strategy (LTTB, Douglas-Peucker) behind a parameter.** One
  strategy with three pinned points is enough for a text answer, and a choice of
  algorithms is a choice a model cannot make well.
- **EPIC-3 is not opened by this story.** Closing the read path does not open the write
  path; the seven `POST` operations need their own design spec first (design spec §Scope
  of this design).

### References

- [Source: design spec §Tool surface](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md) — `get_equity_timeseries` row
- [Source: design spec §Payload policy](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md) — "downsample `portfolio` to at most 200 points, always keeping the first point, the last point, and the deepest drawdown"
- [Source: design spec §Story plan](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md) — the last story of the read path
- [Source: CONTEXT D10](../../CONTEXT.md) — tools bind and shape their own payloads
- [Source: CONTEXT D14](../../CONTEXT.md) — why this ships `1.4.0`
- [Source: EPIC-2 §Live payload findings](../epics/EPIC-2.md) — the branches TASK-2.13.4 must name at close
- [Source: LESSONS 2](../../LESSONS.md) — run every Verification-commands row before trusting it
- [Senti Quant Public API](https://api.sentitrade.xyz/api/v1/openapi.json) — the authority for TASK-2.13.1

## Verification commands

> Drafted before the tests existed and **re-run row by row on 2026-08-12 before this
> story closed** ([LESSONS 2](../../LESSONS.md)). The `Selected` column is the evidence,
> not the exit code: a `-t` filter that matches nothing reports zero selected tests and
> still exits 0. Every row below selected at least one test that genuinely ran.

| AC | Command | Selected |
|---|---|---|
| AC-3, AC-4, AC-5, AC-6, AC-7 | `npm test -- src/tools/performance/timeseries.test.ts` | 42 passed |
| AC-1 | `npm test -- src/server.test.ts -t "get_equity_timeseries.*traversal"` | 1 passed / 81 skipped |
| AC-2 | `npm test -- src/server.test.ts -t "get_equity_timeseries.*query"` | 2 passed / 80 skipped |
| AC-8 | `npm test -- src/server.test.ts -t "get_equity_timeseries.*403"` | 1 passed / 81 skipped |
| AC-9 | `npm test -- src/server.test.ts -t "get_equity_timeseries.*404"` | 1 passed / 81 skipped |
| AC-10 | `npm test -- src/server.test.ts` — the four invariant tables run 10 tools each | 82 passed |
| Whole suite | `npm test` | 428 passed / 1 skipped |
| Live | `npm run test:smoke` | 1 passed — 499 raw points → 200 kept |

## Changelog entry

### Added
- `src/tools/performance/timeseries.ts` — the `get_equity_timeseries` tool:
  `TimeseriesSchema`, `parseTimeseries`, `formatTimeseries`. `perAccount` is dropped and
  `portfolio` is downsampled to at most 200 points, pinning the first point, the last
  point, and the deepest drawdown so a long window cannot read as shallower than it was.
  `caveats` and `portfolioCaveats` are returned in full. Every downsample is recorded in
  `notes`.

### Changed
- **EPIC-2's read path is complete**: all ten `GET` operations of the Senti Quant Public
  API now have a tool. The write path stays closed until EPIC-3 opens with its own design
  spec.

## Implementation notes

**The contract was re-read, and it held.** TASK-2.13.1 read the live OpenAPI document on
2026-08-12 rather than trusting the design spec's 2026-08-05 read. `perAccount` is still
returned; `portfolio` points are `{timeMs, balance, equity, drawdownPct}` with all four
required and none nullable; `caveats` is a map keyed by login and **`portfolioCaveats` is
a single object, not a map** — a difference worth naming because a schema that assumed
symmetry would have failed at parse time on every response. The endpoint declares
400/401/403/404/429/503 and **no 409**, confirming the story's assumption that no
`conflictMeans` is needed.

**`drawdownPct`'s sign is not settled by the document, so nothing depends on it.** Both
`deepestDrawdownIndex` and the text's trough lookup rank on `Math.abs`. Under either
convention a peak is 0 and a trough is the largest magnitude, so a rule that assumed the
sign would silently start pinning a *peak* the day the API flipped it. A test drives this
directly: the same fixture with every `drawdownPct` negated must select the same point.

**The naive stride was not merely avoided — it was shown to fail.** Per
[LESSONS 1](../../LESSONS.md), `downsample`'s body was temporarily replaced with
`points.filter((_, i) => i % stride === 0)`, `grep`-confirmed to have landed, and run:
**4 of 13 tests went red** — the last point, the trough, the sign-agnostic trough, and
the minimum-cap case. Reverted and `grep`-confirmed again before the green run was
trusted. AC-4's fixture is therefore known to discriminate rather than assumed to.

**The fixture had to defeat two implementations, not one.** The trough sits at index 498
of 1000. A stride of 5 misses it, and so does an even sample over `[0, 999]` —
`Math.round(i × 999 / 199)` yields 497 and 502 either side and never 498. Had the trough
landed on a stride boundary the test would have passed against the very implementation it
exists to reject.

**Live measurement (2026-08-12, smoke account, 2026-06-10 → 2026-08-12):** the API
returned **499 points** for a 63-day window; the tool kept **200**. A year would return
several thousand, which is what the cap is for. The smoke leg re-derives the trough from
the raw response and asserts all three pinned points survived — so AC-4 is now checked
against a real curve, not only against the fixture built to break a naive stride.

**One behaviour is deliberately outside the schema's guarantee.** `downsample` assumes
`max >= 3`; fewer cannot hold three pinned points. `MAX_POINTS` is the only value used in
production and the tests exercise 3 and 10 as well as 200, so the assumption is stated in
the doc comment rather than defended by an untested branch.

## Files modified

- `src/tools/performance/timeseries.ts` — **new.** `PointSchema`, `CaveatsSchema`,
  `TimeseriesSchema`, `TimeseriesOutputSchema`, `parseTimeseries`, `deepestDrawdownIndex`,
  `downsample`, `shapeTimeseries`, `formatTimeseries`, `registerGetEquityTimeseries`,
  `MAX_POINTS`.
- `src/tools/performance/timeseries.test.ts` — **new.** 42 tests across `downsample`,
  `parseTimeseries`, the two cuts, the caveats, and `formatTimeseries`.
- `src/server.ts` — `registerGetEquityTimeseries` imported and registered; the tenth and
  last read tool.
- `src/server.test.ts` — a `get_equity_timeseries` describe block (11 tests), the
  `TIMESERIES` fixture at 250 points against a cap of 200, and the tenth `TOOL_CALLS` row.
- `src/smoke.test.ts` — a `get_equity_timeseries` leg over the account's whole history.
- `src/config.ts`, `VERSION`, `package.json`, `package-lock.json` — `1.4.0` in lockstep
  ([LESSONS 4](../../LESSONS.md)); confirmed by `npm run release:check`.
- `docs/CHANGELOG.md` — `## [1.4.0]`.
- `README.md` — the tenth tool row, the five-scope list, and the version prose.
- `docs/sprints/epics/EPIC-2.md`, `docs/sprints/sprint-2026-W33.md`,
  `docs/sprints/STATUS.md` — the epic's close and Phase 3's end.

## Cross-references

- [Epic EPIC-2](../epics/EPIC-2.md) — closed by this story
- [EPIC-3](../epics/EPIC-3.md) — the write path, next
- [sprint-2026-W33](../sprint-2026-W33.md) — §Phase 3, ended by this story
- [CHANGELOG](../../CHANGELOG.md)
- [CONTEXT D10](../../CONTEXT.md) · [CONTEXT D14](../../CONTEXT.md)
- [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [US-2.4](US-2.4-tool-substrate-and-layout.md) · [US-2.10](US-2.10-get-account-performance-tool.md) · [US-2.12](US-2.12-get-performance-breakdowns-tool.md)
