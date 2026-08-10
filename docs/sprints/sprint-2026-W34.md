---
id: sprint-2026-W34
status: planned
start: 2026-08-17
end: 2026-08-23
goal: "Ship the last four read tools — query parameters, cursor pagination, payload shaping, downsampling — and close EPIC-2's read path"
---

## Sprint scope

| US | Title | Epic | Pri | Points | Status | Story file |
|---|---|---|---|---|---|---|
| US-2.10 | `get_account_performance` tool | EPIC-2 | P1 | 2 | 🟢 ready | [link](stories/US-2.10-get-account-performance-tool.md) |
| US-2.11 | `list_deals` tool | EPIC-2 | P1 | 3 | 🟢 ready | [link](stories/US-2.11-list-deals-tool.md) |
| US-2.12 | `get_performance_breakdowns` tool | EPIC-2 | P1 | 3 | 🟢 ready | [link](stories/US-2.12-get-performance-breakdowns-tool.md) |
| US-2.13 | `get_equity_timeseries` tool | EPIC-2 | P1 | 3 | 🟢 ready | [link](stories/US-2.13-get-equity-timeseries-tool.md) |

**Total: 4 stories / 11 points.**

> AC and Tasks live inside each story file. This table is a planning surface only.

## Sprint goal recap

This sprint finishes what W33 started. Six of the API's ten `GET` operations have a
tool; the four that do not are exactly the four that open an axis W33 deliberately
refused to open in the same week it was restructuring `src/`. Closing them closes
EPIC-2's read path, and US-2.13 flips [EPIC-2](epics/EPIC-2.md) to `done`.

**The deliverable cut.** Four tools, four additive minors: `get_account_performance`
(`1.1.0`), `list_deals` (`1.2.0`), `get_performance_breakdowns` (`1.3.0`),
`get_equity_timeseries` (`1.4.0`). The [expansion spec §Story plan](../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
assigns these `0.8.0` → `0.11.0`; it was written before `1.0.0` was cut and that column
is stale. The renumber is recorded as [CONTEXT D14](../CONTEXT.md), not left as a
discrepancy a reader has to reconcile.

**Still out of scope, and not by omission:** all seven write operations ([EPIC-3](epics/EPIC-3.md)),
retry and backoff, and response caching. Each is a decision the v1 spec took on the
record.

**On the 11 points.** Below W33's delivered 15, and deliberately: three of these four
stories are 3-pointers rather than the 2-pointers W33 ran on, because each opens an axis
the substrate does not already cover. US-2.5 → US-2.9 were priced at 2 because
`registerReadTool` + `accountPath` + a scope constant was the whole registration. That
is still true of the *registration* here — the W33 retrospective measured it at +27 to
+45 lines — but `list_deals` has to design a pagination contract, and the two shaping
stories have to decide what a model is allowed not to see about its own money. Those are
not transcription.

## Phased plan

1. **Phase 1 — Query parameters** (~0.5 day): US-2.10 `get_account_performance`
   (`1.1.0`). The first tool to pass `query` to `client.get` — the option has existed
   since US-2.4 and no tool has used it (`grep -rn 'query:' src/tools/` returns nothing).
   Cheapest possible story to prove `from`/`to`/`reporting` round-trip and that
   `undefined` is dropped rather than serialized. Also the first tool in a new
   `tools/performance/` folder.
2. **Phase 2 — Cursor pagination** (~1.5 days): US-2.11 `list_deals` (`1.2.0`). The
   `cursor`/`nextCursor` contract and the no-automatic-drain rule. Independent of
   Phase 3–4: it lands in `tools/trading/`, beside `positions.ts` and `orders.ts`.
3. **Phase 3 — Payload shaping** (~1.5 days): US-2.12 `get_performance_breakdowns`
   (`1.3.0`). The four cuts from the spec's §Payload policy, and the `notes` trace that
   keeps a model from reading a truncated `daily` as a complete one. The largest payload
   in the API, and the only story this sprint whose sizing rests on a number nobody has
   measured yet.
4. **Phase 4 — Downsampling, and EPIC-2's close** (~1.5 days): US-2.13
   `get_equity_timeseries` (`1.4.0`). Downsample `portfolio` to ≤ 200 points while
   pinning the first, the last, and the deepest drawdown. Its close flips EPIC-2 to
   `done` and closes this sprint.

Phases are ordered by dependency where one exists and by cost where none does. US-2.10
is first because `query` is a precondition for both shaping stories; US-2.11 shares no
code with US-2.12 or US-2.13 and could run concurrently with either.

## Dependencies and sequencing constraints

- **US-2.10 blocks US-2.12 and US-2.13 on the `query` path only.** All three send
  `from`/`to`/`reporting`. Whatever US-2.10 settles about validating those inputs — the
  date format the input schema accepts, the `reporting` enum's members — the other two
  copy rather than re-derive. Nothing else about US-2.10 is load-bearing for them.
- **US-2.11 depends on nothing in this sprint.** It builds on US-2.4's `accountPath` and
  `registerReadTool`, both shipped, and on US-2.8/US-2.9's `tools/trading/` conventions.
  It is the story to start first if two people are working.
- **US-2.12 and US-2.13 are the shaping pair.** Both drop `perAccount` from an
  account-scoped response and both carry `notes`. US-2.12 lands first, so US-2.13 reuses
  its `notes` phrasing rather than inventing a second vocabulary for the same idea —
  the same reasoning that made US-2.9 a mirror of US-2.8.
- **US-2.13 closes the sprint and the epic.** Its Task list carries EPIC-2's status flip
  and the epic's §Remaining work removal; no other story should touch them.

## Risks & dependencies

- **`get_performance_breakdowns`'s payload weight is an estimate, not a measurement.**
  *Impact*: [CONTEXT D10](../CONTEXT.md)'s ~70,000-token figure is what sized US-2.12 at
  3 points and what justifies four separate cuts. If the live response is an order of
  magnitude smaller, the cuts are over-engineering; if larger, 10 symbols may not be
  enough. *Mitigation*: US-2.12's TASK-2.12.1 measures a real response against the smoke
  key **before** the shaping code is written, and records the number in the story. The
  story is re-pointed at that moment if the number contradicts D10, rather than at
  review. *Owner*: @bluezdot.
- **The smoke key works, but the account behind it does not cover every branch.** A
  working `SENTI_SMOKE_KEY` arrived 2026-08-10 and `npm run test:smoke` passes against
  `be-dev.sentitrade.xyz` — that discharges W33's first followup. Two gaps survive it,
  both recorded in [EPIC-2](epics/EPIC-2.md) §Live payload findings: the account holds
  **zero pending orders**, so US-2.9's `priceStopLimit` nullability is still unsettled,
  and its **terminal is online**, so the `409`/`conflictMeans` branch has still never run
  against the real service. *Impact*: neither blocks a W34 story — `list_deals` reads
  closed deals, not resting orders, and the performance endpoints signal an offline
  terminal with `live: null` rather than a `409`. What is at risk is the *claim* that
  EPIC-2's read path is live-verified when the epic closes. *Mitigation*: US-2.13's
  epic-close task states which branches shipped unexercised rather than closing the epic
  silently; if an account with deal history and a resting order becomes available
  mid-sprint, US-2.11's smoke leg picks up both opportunistically. *Owner*: @bluezdot.
- **An account with no deal history makes US-2.11's pagination untestable live.**
  *Impact*: `nextCursor` only appears when a second page exists; a smoke account with
  fewer than `limit` deals exercises the empty-cursor path and nothing else.
  *Mitigation*: the cursor contract is proven by stubbed `fetch` in
  `deals.test.ts` regardless, and the smoke leg skips cleanly rather than failing — the
  same posture `smoke.test.ts` already takes when a key owns no accounts. *Owner*:
  @bluezdot.
- **No implementation plan exists for this sprint yet.** W33 ran against
  [read-tools-w33](../superpowers/plans/2026-08-06-senti-read-tools-w33.md), a
  task-by-task plan with code, and its retrospective credits that plan for why six
  stories read as "transcription with verification". *Impact*: W34 has stories but no
  equivalent plan. *Mitigation*: write one before Phase 1 starts — Superpowers owns that
  artifact, this sprint file does not. *Owner*: @bluezdot.

## Retrospective

<!-- Filled on sprint close. -->

### What went well

- TBD

### What didn't

- TBD

### Followups

- TBD

## Cross-references

- [EPIC-2](epics/EPIC-2.md) — the epic this sprint closes · [EPIC-3](epics/EPIC-3.md) — the write path, opened after it
- [STATUS.md](STATUS.md) — generated kanban (RULE-5, never hand-edited)
- [CONTEXT D14](../CONTEXT.md) — the `1.1.0` → `1.4.0` renumber this sprint's versions follow
- [CONTEXT D10](../CONTEXT.md) — tools bind and shape their own payloads; the policy US-2.12 and US-2.13 implement
- [LESSONS 2](../LESSONS.md) — a Verification-commands row is a claim; every row in this sprint's stories is run before it is trusted
- [read-tool expansion design spec](../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md) — §Tool surface, §Payload policy, §Story plan
- [sprint-2026-W33](sprint-2026-W33.md) — prior sprint, and the retrospective whose followups this sprint discharges
