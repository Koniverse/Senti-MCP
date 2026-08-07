---
id: sprint-2026-W33
status: closed
start: 2026-08-10
end: 2026-08-16
goal: "Restructure src/ into core/ + tools/<tag>/, add the read-tool substrate, and ship the first five of the nine unshipped read tools"
---

## Sprint scope

| US | Title | Epic | Pri | Points | Status | Story file |
|---|---|---|---|---|---|---|
| US-2.4 | Tool substrate and directory layout | EPIC-2 | P1 | 5 | ✅ done | [link](stories/US-2.4-tool-substrate-and-layout.md) |
| US-2.5 | `list_brokers` tool | EPIC-2 | P1 | 2 | ✅ done | [link](stories/US-2.5-list-brokers-tool.md) |
| US-2.6 | `list_strategies` tool | EPIC-2 | P1 | 2 | ✅ done | [link](stories/US-2.6-list-strategies-tool.md) |
| US-2.7 | `list_account_strategies` tool | EPIC-2 | P1 | 2 | ✅ done | [link](stories/US-2.7-list-account-strategies-tool.md) |
| US-2.8 | `list_positions` tool | EPIC-2 | P1 | 2 | ✅ done | [link](stories/US-2.8-list-positions-tool.md) |
| US-2.9 | `list_pending_orders` tool | EPIC-2 | P1 | 2 | ✅ done | [link](stories/US-2.9-list-pending-orders-tool.md) |

**Total: 6 stories / 15 points.**

> AC and Tasks live inside each story file. This table is a planning surface only.

## Sprint goal recap

This sprint executes the first six stories of the
[read-tool expansion plan](../superpowers/plans/2026-08-06-senti-read-tools-w33.md), which
itself implements the [read-tool expansion design spec](../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md).
That design corrected a figure this repo had carried since v0.1.0: the Senti Quant Public
API is 10 `GET` + 7 `POST` (17 operations total), so with `list_accounts` shipped, **nine**
read operations remain — not sixteen. US-2.4 lands that correction in `AGENTS.md` and
`EPIC-2.md` in the same commit it opens this sprint.

**The deliverable cut.** Five of the nine unshipped read operations ship this week —
`list_brokers`, `list_strategies`, `list_account_strategies`, `list_positions`, and
`list_pending_orders` — plus the substrate restructuring that makes adding each one close
to transcription rather than open design. The other four (`get_account_performance`,
`get_performance_breakdowns`, `get_equity_timeseries`, `list_deals`) carry to W34: they
open query parameters, payload downsampling, and cursor pagination, axes this sprint
deliberately does not open. See [EPIC-2](epics/EPIC-2.md) §Out of scope.

**Why this order.** The design spec's story plan sequences stories so each one opens
exactly one new axis, in the cheapest story that can carry it — a defect in `accountPath`
should surface in a 2-point story, not tangled inside payload shaping four stories later.
US-2.4 opens no new tool at all; it is pure substrate, the same precedent
[US-2.1](stories/US-2.1-authenticated-senti-api-client.md) set for v0.1.0.

**On the 15 points.** This matches W32's delivered velocity exactly, and for the same
reason it fit there: the design spec and plan carry every implementation decision —
schemas, error branches, payload policy — so these six stories are closer to
transcription-with-verification than to open design.

## Phased plan

1. **Phase 1 — Substrate** (~2.5 days): US-2.4. `core/` + `tools/<tag>/` layout;
   `registerReadTool` and `parseOrThrow`; `client.get`'s `query` option, `accountPath`,
   and the dedicated `404`/`409` branches; `list_accounts` migrated onto the helper with
   no behaviour change; table-driven invariant tests; the operation-count correction,
   three new `CONTEXT.md` decisions, and the five-scope documentation update. Ships
   `0.2.0`.
2. **Phase 2 — First tools on the new substrate** (~1 day): US-2.5 `list_brokers`
   (`0.3.0`), US-2.6 `list_strategies` (`0.4.0`) — neither takes a path parameter, so
   both prove `registerReadTool` before any story has to prove `accountPath` too.
3. **Phase 3 — First path parameter** (~1 day): US-2.7 `list_account_strategies`
   (`0.5.0`) — the first tool that routes through `accountPath` and the `404` login/id
   hint.
4. **Phase 4 — Terminal-backed pair** (~1 day): US-2.8 `list_positions` (`0.6.0`),
   US-2.9 `list_pending_orders` (`0.7.0`) — the first tools carrying the `409`
   terminal-offline branch, the "empty is a real zero" distinction, and the 200-row
   truncation cap. US-2.9's close is this sprint's close.

Phases are ordered by dependency, not calendar. Phase 1 cannot start before it, since
every later story consumes what it substrates.

## Dependencies and sequencing constraints

- **US-2.4 blocks all five tool stories.** Each of US-2.5 through US-2.9 registers
  through `registerReadTool` and (from US-2.7 onward) builds its path with
  `accountPath` — neither exists before US-2.4 lands.
- **US-2.5 and US-2.6 have no path parameter.** They are the cheapest possible proof
  that a tool can be registered on the new substrate at all.
- **US-2.7 is the first story with a path parameter.** It is where `accountPath`'s
  traversal-rejection and the `404` login/id hint (both built in US-2.4) are exercised
  against a live threat model for the first time.
- **US-2.8 and US-2.9 are the terminal-backed pair.** Both read through to the MT5
  terminal and both need the `409`/`conflictMeans` branch US-2.4 built for exactly this
  case; US-2.9 reuses the pattern US-2.8 establishes rather than re-deriving it.

## Retrospective

All six stories closed: US-2.4 (substrate, v0.2.0) through US-2.9 (`list_pending_orders`,
v0.7.0). 179 tests total (178 passed, 1 skipped — the smoke test, opt-in and gated on a
live key), `npm run typecheck` and `npm run build` clean at close.

### What went well

- **The substrate paid for itself, measured in lines, not just asserted.** Once US-2.4
  landed `registerReadTool`, `parseOrThrow` and `accountPath`, the *registration*
  increment for each later tool — the part substrate could actually shrink — came in
  small and uniform: `list_brokers` +27 lines, `list_strategies` +27,
  `list_account_strategies` +34, `list_positions` +45, `list_pending_orders` +42
  (`git show --stat` on each story's registration commit). None of the five needed a
  new registration pattern; each is `accountPath` + `registerReadTool` + a scope
  constant + (for the terminal-backed pair) a `conflictMeans` string. That is the
  "close to transcription" the sprint's own goal recap predicted.
- **`conflictMeans`, designed in US-2.4 (`c8c56bc`, the substrate commit predating any
  tool) and unexercised until US-2.8's `list_positions`, needed zero structural changes
  on its second use.** `list_pending_orders` reused the identical
  `client.get(path, { scope, conflictMeans })` call shape verbatim; only the
  `TERMINAL_OFFLINE` string's nouns changed to match the domain (`positions`/`holding
  no positions`/`open and still carrying risk` → `pending orders`/`having no pending
  orders`/`resting and may still trigger`). Designing the parametrized 409 branch
  before any call site needed it (US-2.4) rather than hardcoding "terminal offline" the
  first time a 409 showed up (US-2.8) is why the second use was a content edit, not a
  design question.
- **The domain-module / registration split (separate commits per story) kept the red
  phase honest.** Every registration commit had a real failing state to point at
  (`Tool <name> not found`) because the schema/parse/format code had already landed and
  compiled in a prior commit — the red phase was about wiring, not about typos in
  brand-new schema code fighting for attention at the same time.

### What didn't

- **A dead verification-table row shipped three times, but not as three copies of the
  same row.** Checked against `git show` on each story's pre-fix version, not
  memory: US-2.8 (`git show c42894c`) and US-2.9 shipped with **AC-1**'s row reading
  `<domain-module>.test.ts -t accountPath` — 0 tests run, because the domain-module
  test file never calls `accountPath` itself (only the `register*` function does).
  US-2.7 (`git show 058b518`) is a different instance, not a third copy of that one:
  its AC-1 row was `npm test -- src/tools/strategies/list-account-strategies.test.ts`
  with no `-t` filter, which runs the whole file for real and was never vacuous — the
  dead row there was **AC-2**'s, `list-account-strategies.test.ts -t traversal`,
  vacuous for the same underlying reason (no traversal test in the domain module) but
  a different AC and a different filter string. All three corrected rows were run and
  confirmed passing before being written into their stories. The shared root cause,
  true of all three: every story's Verification-commands table was drafted during
  planning, before the tests it names existed, guessing which file and filter a given
  AC would land in once written.
- **A tool's *total* size is well past "roughly thirty lines,"** the figure the original
  v1 design spec used for "the second read tool" before ten tools' worth of schema,
  cap, and format code existed to measure against. Every shipped tool file, counting
  its Zod schema, parser, (where present) cap helper, formatter, and registration
  together, lands at 97–156 lines (`list_brokers` 99, `list_strategies` 113,
  `list_account_strategies` 97, `list_positions` 156, `list_pending_orders` 145) — the
  ~30-line figure only ever described the registration sliver substrate made cheap, not
  the tool as a whole, and EPIC-2.md's Business context paragraph still repeats the
  original number without that qualification.
- **The Task 19 brief's own smoke-test extension omitted the tool the task exists to
  ship.** Its Step 4 code block walks five endpoints and stops before
  `list_pending_orders`, despite the task's own top-level instructions asking the live
  run to settle whether `sl`/`tp`/`priceStopLimit` can be `null` on *both*
  `list_positions` and `list_pending_orders`. Caught and extended during this task
  rather than left as shipped; see US-2.9's Implementation notes.
- **The one available `SENTI_SMOKE_KEY` was rejected with `401` against both the
  documented dev pairing and production**, so this sprint closes without either open
  schema question (`list_strategies`'s three optional fields; nullability of
  `sl`/`tp`/`priceStopLimit`) settled by a live payload. The credential, not the code,
  is what is unverified.

### Followups

- **A working smoke key for W34.** `get_performance_breakdowns`'s ~70,000-token
  `breakdowns` payload (D10) and `get_equity_timeseries`'s downsampling are exactly the
  cases where "what the live payload actually weighs" (this plan's own Post-sprint
  note) cannot be estimated from the schema — W34 needs a key that authenticates before
  its first story closes, not after.
- **Revisit `capPositions`/`capOrders` when `list_deals` lands in W34.** Ruled on at
  this plan's pre-flight: two copies returning differently-shaped objects
  (`{ positions, notes }` vs `{ orders, notes }`) is not yet the sixfold repetition that
  justified extracting `parseOrThrow`. If `list_deals` needs a third cap helper, that is
  the point to generalize, not before.
- **Add "run every row of a new Verification-commands table before trusting it" to
  whatever checklist a story's closure follows**, so the three-time recurrence above
  does not become a fourth.

## Cross-references

- [EPIC-2](epics/EPIC-2.md) · [EPIC-3](epics/EPIC-3.md)
- [STATUS.md](STATUS.md) — generated kanban
- [CONTEXT D6](../CONTEXT.md) — the most recent decision as this sprint opens
- [read-tool expansion design spec](../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [read-tools-w33 implementation plan](../superpowers/plans/2026-08-06-senti-read-tools-w33.md)
- [sprint-2026-W32](sprint-2026-W32.md) — prior sprint
