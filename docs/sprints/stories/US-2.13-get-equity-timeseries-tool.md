---
id: US-2.13
title: "get_equity_timeseries tool, and EPIC-2's close"
epic: EPIC-2
status: ready
priority: P1
points: 3
sprint: sprint-2026-W34
assignee: bluezdot
created: 2026-08-10
updated: 2026-08-10
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
[sprint-2026-W34](../sprint-2026-W34.md).

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

- [ ] **AC-1** — **Given** a call with `accountId`, **When** the request is built,
  **Then** the path is constructed via `accountPath`, **And** the tool is enrolled in
  `src/server.test.ts`'s table-driven traversal test by a new `TOOL_CALLS` row.
- [ ] **AC-2** — **Given** `from`, `to` and `reporting`, **When** the request is issued,
  **Then** all three ride `client.get`'s `query` option using the input-schema shape
  [US-2.10](US-2.10-get-account-performance-tool.md) settled.
- [ ] **AC-3** — **Given** a response containing `perAccount`, **When** the tool returns,
  **Then** `perAccount` appears in neither `content` nor `structuredContent`.
- [ ] **AC-4** — **Given** a `portfolio` series longer than 200 points, **When** it is
  downsampled, **Then** the result holds at most 200 points, **And** the first point,
  the last point, and the point of deepest drawdown are all present in it — including
  when the deepest drawdown falls between two sampling strides. This AC is defended by a
  fixture built so that a naive every-Nth stride would drop the trough.
- [ ] **AC-5** — **Given** a `portfolio` series of 200 points or fewer, **When** the tool
  returns, **Then** the series passes through unmodified, **And** `notes` is the empty
  array — no downsampling note is emitted for a downsample that did not happen.
- [ ] **AC-6** — **Given** a downsampled series, **When** the tool returns, **Then**
  `notes` states how many points the original held, how many remain, and that the first,
  last and deepest-drawdown points were retained, **And** the same information appears in
  `content`, not only in `structuredContent`.
- [ ] **AC-7** — **Given** any response, **When** the tool returns, **Then** `caveats` and
  `portfolioCaveats` are present in full — never downsampled, never truncated, never
  summarized.
- [ ] **AC-8** — **Given** a `403` from the API, **When** the tool returns, **Then**
  `isError` is true and the text names the `performance:read` scope.
- [ ] **AC-9** — **Given** a `404` from the API, **When** the tool returns, **Then** the
  text carries US-2.4's `login`-vs-`id` hint.
- [ ] **AC-10** — **Given** all ten read operations now have a tool, **When**
  `src/server.test.ts`'s table-driven invariant tests run, **Then** all ten are enrolled
  in the key-leakage, `outputSchema`-validation, `readOnlyHint` and traversal tables —
  no tool is registered outside them.

## Tasks

- [ ] **TASK-2.13.1** — Confirm the response contract against the live OpenAPI document
  (AC: 3, 4, 7)
  - [ ] Read `https://api.sentitrade.xyz/api/v1/openapi.json` for
        `/accounts/{accountId}/performance/timeseries`: the shape of a `portfolio` point,
        whether `caveats` and `portfolioCaveats` are both present and their types, and
        whether `perAccount` is still returned. The design spec names these from a
        2026-08-05 read
- [ ] **TASK-2.13.2** — `src/tools/performance/timeseries.ts` domain module
  (AC: 3, 4, 5, 6, 7)
  - [ ] `TimeseriesSchema`, `parseTimeseries` via `parseOrThrow`, `formatTimeseries`
  - [ ] `downsample(points, max)` — pins first, last and deepest-drawdown, then fills the
        remaining budget evenly. Unit-tested against a fixture whose trough sits between
        strides
  - [ ] `notes` phrasing reused from [US-2.12](US-2.12-get-performance-breakdowns-tool.md)
        rather than newly invented
- [ ] **TASK-2.13.3** — Registration and the `1.4.0` release (AC: 1, 2, 8, 9)
  - [ ] Register through `registerReadTool`; path via `accountPath(args.accountId,
        'performance', 'timeseries')`; `scope: 'performance:read'`; no `conflictMeans`
  - [ ] Tool description states that long windows are downsampled and that the retained
        points include the extremes
  - [ ] `src/server.ts` registration; `TOOL_CALLS` row in `src/server.test.ts`
  - [ ] `VERSION`, `package.json`, `src/config.ts` `SERVER_VERSION` → `1.4.0` in
        lockstep; `docs/CHANGELOG.md` `[1.4.0]`; `README.md` tool-table row naming all
        ten tools
- [ ] **TASK-2.13.4** — Close EPIC-2 and sprint W34 (AC: 10)
  - [ ] Extend `src/smoke.test.ts` with a `get_equity_timeseries` leg, so the smoke walk
        covers all ten read tools
  - [ ] [EPIC-2](../epics/EPIC-2.md): `status: done`; the four story-index rows flipped;
        §Remaining work replaced with a closing statement that **names the branches
        shipped unexercised against the live service** — US-2.9's `priceStopLimit`
        nullability and the `409` terminal-offline path — rather than closing silently
  - [ ] [sprint-2026-W34](../sprint-2026-W34.md): `status: closed`, scope table flipped,
        retrospective written
  - [ ] `npm run agile:status` to regenerate [STATUS.md](../STATUS.md) (RULE-5)

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

> Drafted before the tests exist; **every row is run and confirmed non-vacuous before
> this story closes** ([LESSONS 2](../../LESSONS.md)). This is the last chance in EPIC-2
> to ship a dead row.

| AC | Command |
|---|---|
| AC-3, AC-4, AC-5, AC-6, AC-7 | `npm test -- src/tools/performance/timeseries.test.ts` |
| AC-1 | `npm test -- src/server.test.ts -t "get_equity_timeseries.*traversal"` |
| AC-2 | `npm test -- src/server.test.ts -t "get_equity_timeseries.*query"` |
| AC-8 | `npm test -- src/server.test.ts -t "get_equity_timeseries.*403"` |
| AC-9 | `npm test -- src/server.test.ts -t "get_equity_timeseries.*404"` |
| AC-10 | `npm test -- src/server.test.ts` — the four invariant tables run 10 tools each |

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

<!-- Filled during implementation. -->

## Files modified

<!-- Filled during implementation. -->

## Cross-references

- [Epic EPIC-2](../epics/EPIC-2.md) — closed by this story
- [EPIC-3](../epics/EPIC-3.md) — the write path, next
- [sprint-2026-W34](../sprint-2026-W34.md) — closed by this story
- [CHANGELOG](../../CHANGELOG.md)
- [CONTEXT D10](../../CONTEXT.md) · [CONTEXT D14](../../CONTEXT.md)
- [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [US-2.4](US-2.4-tool-substrate-and-layout.md) · [US-2.10](US-2.10-get-account-performance-tool.md) · [US-2.12](US-2.12-get-performance-breakdowns-tool.md)
