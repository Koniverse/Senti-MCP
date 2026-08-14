---
id: sprint-2026-W33
status: active
start: 2026-08-10
end: 2026-08-16
goal: "Ship the read-tool substrate and five read tools (delivered), settle and build this repo's package release process (delivered), close EPIC-2's read path with its last four tools (delivered), then move the supported Node floor off an EOL line"
---

## Sprint scope

### Phase 1 — Read-tool substrate and five tools (closed 2026-08-07)

| US | Title | Epic | Pri | Points | Status | Story file |
|---|---|---|---|---|---|---|
| US-2.4 | Tool substrate and directory layout | EPIC-2 | P1 | 5 | ✅ done | [link](stories/US-2.4-tool-substrate-and-layout.md) |
| US-2.5 | `list_brokers` tool | EPIC-2 | P1 | 2 | ✅ done | [link](stories/US-2.5-list-brokers-tool.md) |
| US-2.6 | `list_strategies` tool | EPIC-2 | P1 | 2 | ✅ done | [link](stories/US-2.6-list-strategies-tool.md) |
| US-2.7 | `list_account_strategies` tool | EPIC-2 | P1 | 2 | ✅ done | [link](stories/US-2.7-list-account-strategies-tool.md) |
| US-2.8 | `list_positions` tool | EPIC-2 | P1 | 2 | ✅ done | [link](stories/US-2.8-list-positions-tool.md) |
| US-2.9 | `list_pending_orders` tool | EPIC-2 | P1 | 2 | ✅ done | [link](stories/US-2.9-list-pending-orders-tool.md) |

**Phase 1: 6 stories / 15 points — all delivered.** The §Retrospective below measures this
phase and only this phase.

### Phase 2 — The package release process (added 2026-08-10)

| US | Title | Epic | Pri | Points | Status | Story file |
|---|---|---|---|---|---|---|
| US-4.1 | The release contract and `docs/RELEASE.md` | EPIC-4 | P1 | 3 | ✅ done | [link](stories/US-4.1-release-contract-and-runbook.md) |
| US-4.2 | `npm run release:check` — the pre-tag gate | EPIC-4 | P1 | 3 | ✅ done | [link](stories/US-4.2-release-check-gate.md) |
| US-4.3 | Backfill the six missing tags and `v0.1.0`'s Release | EPIC-4 | P2 | 2 | ✅ done | [link](stories/US-4.3-backfill-tags-and-releases.md) |
| US-4.4 | Verify the tarball before it is published | EPIC-4 | P1 | 3 | ✅ done | [link](stories/US-4.4-tarball-verification.md) |
| US-4.5 | `.github/workflows/release.yml` — tag-triggered publish | EPIC-4 | P1 | 5 | ✅ done | [link](stories/US-4.5-release-workflow.md) |

**Phase 2: 5 stories / 16 points.**

### Phase 3 — EPIC-2's four remaining read tools (closed 2026-08-12)

| US | Title | Epic | Pri | Points | Status | Story file |
|---|---|---|---|---|---|---|
| US-2.10 | `get_account_performance` tool | EPIC-2 | P1 | 2 | ✅ done (1.1.0) | [link](stories/US-2.10-get-account-performance-tool.md) |
| US-2.11 | `list_deals` tool | EPIC-2 | P1 | 3 | ✅ done (1.2.0) | [link](stories/US-2.11-list-deals-tool.md) |
| US-2.12 | `get_performance_breakdowns` tool | EPIC-2 | P1 | 3 | ✅ done (1.3.0) | [link](stories/US-2.12-get-performance-breakdowns-tool.md) |
| US-2.13 | `get_equity_timeseries` tool, and EPIC-2's close | EPIC-2 | P1 | 3 | ✅ done (1.4.0) | [link](stories/US-2.13-get-equity-timeseries-tool.md) |

**Phase 3: 4 stories / 11 points.**

### Phase 4 — Supported runtime and dependency currency (added 2026-08-13)

Node 20 reached end of life on 2026-04-30 and the declared floor still points at it. Move
the floor, put a gate behind it, and bring the toolchain current.

| US | Title | Epic | Pri | Points | Status | Story file |
|---|---|---|---|---|---|---|
| US-5.1 | Re-decide the supported Node floor, now that Node 20 is EOL | EPIC-5 | P2 | 3 | ✅ done (2.0.0) | [link](stories/US-5.1-node-floor-and-ci-pins.md) |
| US-5.2 | `release:check` guards the Node floor across every artifact that states it | EPIC-5 | P2 | 2 | ✅ done | [link](stories/US-5.2-release-check-guards-the-node-floor.md) |
| US-5.3 | devDependency currency, and the rule that `@types/node` tracks the floor | EPIC-5 | P3 | 3 | 📋 backlog | [link](stories/US-5.3-devdependency-currency-and-dependabot.md) |
| US-5.4 | Decide TypeScript 7, and say why either way | EPIC-5 | P3 | 2 | 📋 backlog | [link](stories/US-5.4-decide-typescript-7.md) |

**Phase 4: 4 stories / 10 points.** **Sprint total: 19 stories / 52 points.**

> AC and Tasks live inside each story file. This table is a planning surface only.

## Phase 3 — plan, dependencies, and risks

Four tools, four additive minors: `get_account_performance` (`1.1.0`), `list_deals`
(`1.2.0`), `get_performance_breakdowns` (`1.3.0`), `get_equity_timeseries` (`1.4.0`) —
the versions [CONTEXT D14](../CONTEXT.md) assigns. Closing them closes EPIC-2's read path,
and US-2.13 flips [EPIC-2](epics/EPIC-2.md) to `done`.

Still out of scope: all seven write operations ([EPIC-3](epics/EPIC-3.md)), retry and
backoff, and response caching.

### Phase 3 sequencing

1. **Query parameters** (~0.5 day): US-2.10 `get_account_performance` (`1.1.0`). The first
   tool to pass `query` to `client.get` — the option has existed since US-2.4 and no tool
   has used it (`grep -rn 'query:' src/tools/` returns nothing). Cheapest possible story to
   prove `from`/`to`/`reporting` round-trip and that `undefined` is dropped rather than
   serialized. Also the first tool in a new `tools/performance/` folder.
2. **Cursor pagination** (~1.5 days): US-2.11 `list_deals` (`1.2.0`). The
   `cursor`/`nextCursor` contract and the no-automatic-drain rule. Independent of steps
   3–4: it lands in `tools/trading/`, beside `positions.ts` and `orders.ts`.
3. **Payload shaping** (~1.5 days): US-2.12 `get_performance_breakdowns` (`1.3.0`). The
   four cuts from the spec's §Payload policy, and the `notes` trace that keeps a model from
   reading a truncated `daily` as a complete one. The largest payload in the API, and the
   only story here whose sizing rests on a number nobody has measured yet.
4. **Downsampling, and EPIC-2's close** (~1.5 days): US-2.13 `get_equity_timeseries`
   (`1.4.0`). Downsample `portfolio` to ≤ 200 points while pinning the first, the last, and
   the deepest drawdown. Its close flips EPIC-2 to `done`.

Ordered by dependency where one exists and by cost where none does. US-2.10 is first
because `query` is a precondition for both shaping stories; US-2.11 shares no code with
US-2.12 or US-2.13 and could run concurrently with either.

### Phase 3 dependencies and sequencing constraints

- **US-2.10 blocks US-2.12 and US-2.13 on the `query` path only.** All three send
  `from`/`to`/`reporting`. Whatever US-2.10 settles about validating those inputs — the
  date format the input schema accepts, the `reporting` enum's members — the other two copy
  rather than re-derive. Nothing else about US-2.10 is load-bearing for them.
  **Settled, 2026-08-10** ([CONTEXT D23](../CONTEXT.md)): `from`/`to` are UTC `YYYY-MM-DD`
  and are validated for *existence*, not only shape, so `2026-02-31` is refused before any
  request. `reporting` has no enum members to copy — it is an **ISO-4217 currency code**,
  not a reporting period, validated as `/^[A-Z]{3}$/`. Both stories import the shape from
  `tools/performance/summary.ts` rather than redeclaring it.
- **US-2.11 depends on nothing else in this phase.** It builds on US-2.4's `accountPath`
  and `registerReadTool`, both shipped, and on US-2.8/US-2.9's `tools/trading/`
  conventions. It is the story to start first if two people are working.
  **Shipped 2026-08-11 as `1.2.0`**, and it bound nothing for US-2.12 or US-2.13 —
  neither endpoint paginates. What it settled is recorded in
  [CONTEXT D24](../CONTEXT.md): one request per call, no `409` branch on `deals`, and the
  `syncedThrough` field no design artifact anticipated.
- **US-2.12 and US-2.13 are the shaping pair.** Both drop `perAccount` from an
  account-scoped response and both carry `notes`. US-2.12 lands first, so US-2.13 reuses
  its `notes` phrasing rather than inventing a second vocabulary for the same idea — the
  same reasoning that made US-2.9 a mirror of US-2.8.
  **Shipped 2026-08-11 as `1.3.0`.** What US-2.13 inherits is recorded in
  [CONTEXT D25](../CONTEXT.md) and is more than the phrasing: **a note records information
  loss, not removal.** Dropping a running sum or a restatement of data still present writes
  nothing, because a note for every removal leaves `notes` permanently non-empty and trains
  a reader to skim past the lines that matter. That rule is what keeps US-2.12 AC-8's empty
  `notes` — and US-2.13's equivalent — reachable at all.
- **US-2.13 closes the epic.** Its Task list carries EPIC-2's status flip and the epic's
  §Remaining work removal; no other story should touch them.
- **Phase 3's releases are Phase 2's acceptance test.** `1.1.0` runs
  [US-4.5](stories/US-4.5-release-workflow.md)'s workflow for the first time on a version
  that is not a rehearsal. A failure in `build`, `verify`, `publish` or `announce` is
  EPIC-4's defect, not US-2.10's — see §Phase 2 retrospective §Followups.

### Phase 3 risks & dependencies

- **`get_performance_breakdowns`'s payload weight is an estimate, not a measurement.**
  *Impact*: [CONTEXT D10](../CONTEXT.md)'s ~70,000-token figure is what sized US-2.12 at 3
  points and what justifies four separate cuts. If the live response is an order of
  magnitude smaller, the cuts are over-engineering; if larger, 10 symbols may not be enough.
  *Mitigation*: US-2.12's TASK-2.12.1 measures a real response against the smoke key
  **before** the shaping code is written, and records the number in the story. The story is
  re-pointed at that moment if the number contradicts D10, rather than at review.
  *Owner*: @bluezdot.
  **Retired 2026-08-11.** Measured: **87,063 bytes ≈ 21,766 tokens** for a 63-day window,
  extrapolating to ~126,000 over a year — larger than D10's estimate but the same order of
  magnitude, so the cuts were not re-argued and the 3 points stood. The second half of the
  risk landed instead: the four cuts left 4,938 tokens against a 5,000 budget, and only
  because the smoke account trades one symbol. A **fifth** cut — `perSymbol`'s two
  running-sum row-sets, verified lossless against live data — took it to 3,047
  ([CONTEXT D25](../CONTEXT.md)). The residue is recorded, not fixed: at ten symbols
  neither four cuts nor five hold the budget.
- **The smoke key works, but the account behind it does not cover every branch.** A working
  `SENTI_SMOKE_KEY` arrived 2026-08-10 and `npm run test:smoke` passes against
  `be-dev.sentitrade.xyz` — that discharges Phase 1's first followup. Two gaps survive it,
  both recorded in [EPIC-2](epics/EPIC-2.md) §Live payload findings: the account holds
  **zero pending orders**, so US-2.9's `priceStopLimit` nullability is still unsettled, and
  its **terminal is online**, so the `409`/`conflictMeans` branch has still never run
  against the real service. *Impact*: neither blocks a Phase 3 story — `list_deals` reads
  closed deals, not resting orders, and the performance endpoints signal an offline terminal
  with `live: null` rather than a `409`. What is at risk is the *claim* that EPIC-2's read
  path is live-verified when the epic closes. *Mitigation*: US-2.13's epic-close task states
  which branches shipped unexercised rather than closing the epic silently; if an account
  with deal history and a resting order becomes available mid-week, US-2.11's smoke leg
  picks up both opportunistically. *Owner*: @bluezdot.
  **Half discharged, 2026-08-11.** The account acquired a resting `ORDER_TYPE_BUY_LIMIT`
  between 08-10 and 08-11, and it carries `priceStopLimit: 0` — not `null`. So US-2.9's
  zero case is now live-verified and only its `null` arm is test-only. The terminal is
  still online, so the `409`/`conflictMeans` branch remains unexercised against the real
  service; that half stands. **Stated at close, 2026-08-12.** US-2.13's TASK-2.13.4 wrote it
  into [EPIC-2](epics/EPIC-2.md) §Remaining work as a three-row table of branches that
  shipped unexercised, so the risk is discharged as *recorded* rather than as *resolved* —
  the terminal is still online and the `409` branch has still never run.
- **An account with no deal history makes US-2.11's pagination untestable live.** *Impact*:
  `nextCursor` only appears when a second page exists; a smoke account with fewer than
  `limit` deals exercises the empty-cursor path and nothing else. *Mitigation*: the cursor
  contract is proven by stubbed `fetch` in `deals.test.ts` regardless, and the smoke leg
  skips cleanly rather than failing — the same posture `smoke.test.ts` already takes when a
  key owns no accounts. *Owner*: @bluezdot.
  **Did not materialize, 2026-08-11.** The smoke account holds 500+ deals; at `limit: 2`
  the live first page returned a real `nextCursor`, and a second call with it returned
  different tickets. The cursor path is proven against the real service, not only against
  a stub. The skip-cleanly arm shipped and did not run.
- **No implementation plan exists for these four stories yet.** Phase 1 ran against
  [read-tools-w33](../superpowers/plans/2026-08-06-senti-read-tools-w33.md), a task-by-task
  plan with code, and the retrospective below credits that plan for why six stories read as
  "transcription with verification". *Impact*: Phase 3 has stories but no equivalent plan.
  *Mitigation*: write one before US-2.10 starts — Superpowers owns that artifact, this
  sprint file does not. It is the phase's first action. *Owner*: @bluezdot.
- **Four days of window remain, and 11 points against them.** *Impact*: a tighter run than
  a full week gives. *Mitigation*: the four stories are independent releases, not one
  deliverable — each ships its own minor, so an unfinished Phase 3 leaves shipped tools
  behind rather than a half-migration. *Owner*: @bluezdot.

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

> **Scope of this retrospective: Phase 1 only.** Written 2026-08-07 and left as written.
> Each later phase gets its own section.

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

## Phase 2 retrospective — the package release process

All five EPIC-4 stories closed on 2026-08-10, 16 points. `docs/RELEASE.md`, two gates
(`release:check`, `release:verify-pack`), this repository's first workflow, and the six
backfilled tags that make *every changelogged version is tagged* exception-free. Suite went
14 files / 197 tests to **16 / 232, 1 skipped**; `VERSION` deliberately did not move and the
tarball is unchanged at 42 entries.

### What went well

- **Every gate found something real before it was trusted.** `release:verify-pack` caught a
  removed tool through the packaged README when the build-vs-tarball comparison could not.
  `release:check` caught `package-lock.json` sitting at `0.1.0` — eight releases stale, a
  fifth place the version lives that nothing watched. Neither was in the plan.
- **Writing the workflow fed requirements back into the gate.** `--ci` exists because a
  tag-triggered checkout is a detached HEAD at a tag that already exists; it skips exactly
  those two local-only preconditions and prints that it did. Building the automation last,
  against a gate that already existed, is what surfaced that rather than a redesign.
- **Reopening this sprint cost nothing and settled a rule.** Phase 1's record is untouched
  and Phase 2 sits beside it; [CONTEXT D21](../CONTEXT.md) makes it general.

### What didn't

- **Two defects shipped into `main` and were caught only by rehearsing.** `release:check`
  discarded its version argument whenever `--root` was absent — the exact CI invocation —
  so every version check passed by construction; all 20 tests missed it because every one
  passed `--root` to reach a fixture ([LESSONS 5](../LESSONS.md)). And the workflow's
  annotated-tag guard read local git state that `actions/checkout` had already overwritten
  with the commit SHA, so it could never pass and would have blocked `1.1.0`
  ([LESSONS 6](../LESSONS.md)).
- **The first rehearsal's failure was misread as user error.** It failed at "the tag must be
  annotated" and the obvious reading — the rehearsal tag was lightweight — was wrong.
  `git ls-remote` proved the pushed tag was genuinely annotated. Three rehearsals were spent
  where one should have done.
- **Bookkeeping drifted from reality once.** A script that set story statuses matched on
  `status: in-progress`, which US-4.3 and US-4.5 had never been flipped to, so it changed
  nothing while reporting success. Only `STATUS.md` showed the disagreement — the same
  shape as the two defects above: a report of intent mistaken for a report of result.

### Followups

- **`1.1.0` is EPIC-4's acceptance test, not just EPIC-2's first W34 release.**
  [US-4.5](stories/US-4.5-release-workflow.md) AC-2, AC-3, AC-4, AC-5, AC-6 and AC-9 can
  only be discharged by a run whose gate passes. If `1.1.0` fails in `build`, `verify`,
  `publish` or `announce`, that is EPIC-4's defect — do not debug it as a
  [US-2.10](stories/US-2.10-get-account-performance-tool.md) problem. Whoever ships it
  should record the run id in US-4.5 §Implementation notes and tick those six.
- **Read *which step* failed before diagnosing any red run.** Two of this phase's three
  wrong turns came from a failure that looked correct. This is now
  [LESSONS 5](../LESSONS.md) and [LESSONS 6](../LESSONS.md); the practical form is: ask what
  the run did *not* reach.
- **A second CI workflow is still an open question.** This phase deliberately added only
  `release.yml` ([EPIC-4](epics/EPIC-4.md) §Out of scope). Both defects above reached `main`
  because nothing runs on a push or a pull request. That is now an argument with evidence
  behind it rather than a preference.

## Phase 3 retrospective — EPIC-2's four remaining read tools

All four stories closed between 2026-08-10 and 2026-08-12, 11 points, four additive minors
(`1.1.0` → `1.4.0`). **EPIC-2 is `done`: all ten `GET` operations of the Senti Quant Public
API now have a tool.** Suite went 16 files / 232 tests to **20 / 429, 1 skipped**; the
smoke walk covers all ten read tools.

### What went well

- **Every story's TASK-x.1 earned its place, four for four.** A contract check or a
  measurement before any code: `reporting` is a currency not a period (US-2.10), an
  undeclared `syncedThrough` and an absent `409` (US-2.11), 21,766 tokens that turned four
  planned cuts into five (US-2.12), and `portfolioCaveats` being a single object where
  `caveats` is a map (US-2.13). In every case the story's own specification was incomplete
  and the check is what caught it — before code, not at review.
- **The one claim that could have shipped silently wrong was attacked directly.** US-2.13's
  downsample had to keep the deepest drawdown, and the naive every-Nth stride that breaks
  it is also the obvious implementation. Rather than assume the test would catch it, the
  stride was written on purpose, `grep`-confirmed on disk, and run: 4 of 13 tests went red,
  and only then was the real implementation trusted ([LESSONS 1](../LESSONS.md)). The
  fixture is now known to discriminate rather than assumed to.
- **`notes` held its shape across two tools that cut very differently.** US-2.12 removes
  redundancy; US-2.13 removes real observations. [CONTEXT D25](../CONTEXT.md)'s rule — a
  note records information *loss*, not removal — is what let both drop `perAccount`
  silently while still emitting exactly one note when something was genuinely lost, and it
  is why an empty `notes` still means something.
- **Four stories shipped with no implementation plan and none of them wobbled.** That is a
  pattern now rather than a run of luck, and [EPIC-2](epics/EPIC-2.md) §Remaining work
  records the narrower reading: what substituted for the plan was each story's TASK-x.1.

### What didn't

- **The Verification-commands tables were still drafted before their tests existed.**
  Every US-2.13 row was written during planning, naming files and `-t` filters that did not
  yet exist — the exact setup [LESSONS 2](../LESSONS.md) was written about after Phase 1
  shipped three dead rows. They happened to be right this time, but "happened to be right"
  is not the property the lesson asks for. What actually protected the story was running
  each row and reading its *count* before closing; the counts are now recorded in the table
  itself, which is the durable half of the fix.
- **The epic closes with the same live gap it has carried since 2026-08-10.** The
  `409`/`conflictMeans` branch and `performance`'s `live: null` block have never run against
  the real service, because one smoke account with an online terminal cannot produce them.
  Three sprints of work did not move this, and no story could have — it needs an account,
  not code.
- **A payload budget is recorded as breached rather than met.** `get_performance_breakdowns`
  projects to ~8,050 tokens against a 5,000-token budget on a ten-symbol account. It was
  measured on a one-symbol account, so the cut that would matter is inert on the only data
  available. The number is honest and the budget is still wrong.

### Followups

- **An offline terminal and a symbol-rich account are now the only things blocking three
  recorded gaps.** They are not code work and no story can be pointed at them; whoever can
  produce either should run `npm run test:smoke` against it and update
  [EPIC-2](epics/EPIC-2.md) §Live payload findings. This is the third sprint carrying this
  item.
- **Draft a Verification-commands table only after its tests exist.** Leave the command cell
  empty during planning rather than filling it with a plausible guess. Recording the
  selected-test count beside each row, as US-2.13 now does, is what makes the table
  evidence instead of intent.
- **EPIC-3's write path does not inherit this phase's no-plan precedent.** Four for four is
  real, but every one of those four was a read whose worst failure is a wrong answer. A
  wrong `POST` is a trade. The precedent is recorded to be argued with, not applied.

## Cross-references

- [EPIC-2](epics/EPIC-2.md) · [EPIC-3](epics/EPIC-3.md) · [EPIC-4](epics/EPIC-4.md) — Phase 2's epic · [EPIC-5](epics/EPIC-5.md) — Phase 4's epic
- [STATUS.md](STATUS.md) — generated kanban
- [CONTEXT D6](../CONTEXT.md) — the most recent decision as this sprint opens
- [CONTEXT D21](../CONTEXT.md) · [CONTEXT D22](../CONTEXT.md) — the sprint-scope decisions behind this file's phases
- [CONTEXT D15–D20](../CONTEXT.md) — the six decisions Phase 2 implements
- [CONTEXT D14](../CONTEXT.md) — the `1.1.0` → `1.4.0` renumber Phase 3's versions follow
- [CONTEXT D10](../CONTEXT.md) — tools bind and shape their own payloads; the policy US-2.12 and US-2.13 implement
- [LESSONS 2](../LESSONS.md) — a Verification-commands row is a claim; every row in Phase 3's stories is run before it is trusted
- [read-tool expansion design spec](../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [read-tools-w33 implementation plan](../superpowers/plans/2026-08-06-senti-read-tools-w33.md)
- [sprint-2026-W32](sprint-2026-W32.md) — prior sprint
- [sprint-2026-W34](sprint-2026-W34.md) — next sprint
