---
id: sprint-2026-W33
status: closed
start: 2026-08-10T00:00:00.000Z
end: 2026-08-16T00:00:00.000Z
goal: 'Close EPIC-2''s read path — the substrate and all nine remaining GET tools — build this repo''s package release process, and move the supported Node floor off an EOL line'
---
## Sprint scope

| US      | Title                                                                                           | Epic   | Pri | Points | Status | Story file                                                      |
| ------- | ----------------------------------------------------------------------------------------------- | ------ | --- | ------ | ------ | --------------------------------------------------------------- |
| US-2.4  | Tool substrate and directory layout                                                             | EPIC-2 | P1  | 5      | ✅ done | [link](stories/US-2.4-tool-substrate-and-layout.md)             |
| US-2.5  | `list_brokers` tool                                                                             | EPIC-2 | P1  | 2      | ✅ done | [link](stories/US-2.5-list-brokers-tool.md)                     |
| US-2.6  | `list_strategies` tool                                                                          | EPIC-2 | P1  | 2      | ✅ done | [link](stories/US-2.6-list-strategies-tool.md)                  |
| US-2.7  | `list_account_strategies` tool                                                                  | EPIC-2 | P1  | 2      | ✅ done | [link](stories/US-2.7-list-account-strategies-tool.md)          |
| US-2.8  | `list_positions` tool                                                                           | EPIC-2 | P1  | 2      | ✅ done | [link](stories/US-2.8-list-positions-tool.md)                   |
| US-2.9  | `list_pending_orders` tool                                                                      | EPIC-2 | P1  | 2      | ✅ done | [link](stories/US-2.9-list-pending-orders-tool.md)              |
| US-4.1  | The release contract and `docs/RELEASE.md` *(added 2026-08-10)*                                 | EPIC-4 | P1  | 3      | ✅ done | [link](stories/US-4.1-release-contract-and-runbook.md)          |
| US-4.2  | `npm run release:check` — the pre-tag gate *(added 2026-08-10)*                                 | EPIC-4 | P1  | 3      | ✅ done | [link](stories/US-4.2-release-check-gate.md)                    |
| US-4.3  | Backfill the six missing tags and `v0.1.0`'s Release *(added 2026-08-10)*                       | EPIC-4 | P2  | 2      | ✅ done | [link](stories/US-4.3-backfill-tags-and-releases.md)            |
| US-4.4  | Verify the tarball before it is published *(added 2026-08-10)*                                  | EPIC-4 | P1  | 3      | ✅ done | [link](stories/US-4.4-tarball-verification.md)                  |
| US-4.5  | `.github/workflows/release.yml` — tag-triggered publish *(added 2026-08-10)*                    | EPIC-4 | P1  | 5      | ✅ done | [link](stories/US-4.5-release-workflow.md)                      |
| US-2.10 | `get_account_performance` tool *(added 2026-08-10)*                                             | EPIC-2 | P1  | 2      | ✅ done | [link](stories/US-2.10-get-account-performance-tool.md)         |
| US-2.11 | `list_deals` tool *(added 2026-08-10)*                                                          | EPIC-2 | P1  | 3      | ✅ done | [link](stories/US-2.11-list-deals-tool.md)                      |
| US-2.12 | `get_performance_breakdowns` tool *(added 2026-08-10)*                                          | EPIC-2 | P1  | 3      | ✅ done | [link](stories/US-2.12-get-performance-breakdowns-tool.md)      |
| US-2.13 | `get_equity_timeseries` tool, and EPIC-2's close *(added 2026-08-10)*                           | EPIC-2 | P1  | 3      | ✅ done | [link](stories/US-2.13-get-equity-timeseries-tool.md)           |
| US-5.1  | Re-decide the supported Node floor, now that Node 20 is EOL *(added 2026-08-13)*                | EPIC-5 | P2  | 3      | ✅ done | [link](stories/US-5.1-node-floor-and-ci-pins.md)                |
| US-5.2  | `release:check` guards the Node floor across every artifact that states it *(added 2026-08-13)* | EPIC-5 | P2  | 2      | ✅ done | [link](stories/US-5.2-release-check-guards-the-node-floor.md)   |
| US-5.3  | devDependency currency, and the rule that `@types/node` tracks the floor *(added 2026-08-13)*   | EPIC-5 | P3  | 3      | ✅ done | [link](stories/US-5.3-devdependency-currency-and-dependabot.md) |
| US-5.4  | Decide TypeScript 7, and say why either way *(added 2026-08-13)*                                | EPIC-5 | P3  | 2      | ✅ done | [link](stories/US-5.4-decide-typescript-7.md)                   |

**Total: 19 stories / 52 points** — 15 + 16 + 11 + 10 across the four tranches this window
absorbed. The six unannotated rows are the scope this sprint opened with, closed 2026-08-07
ahead of its own window; the `*(added …)*` rows joined it mid-window under
[CONTEXT D21](../CONTEXT.md) rule 1. The 08-13 tranche was opened by a date rather than a
design: Node 20 reached end of life on 2026-04-30 and the declared floor still pointed at it.

> AC and Tasks live inside each story file. This table is a planning surface only.
>
> **The §Retrospective sections below are tranche-scoped and left as written**
> ([CONTEXT D30](../CONTEXT.md)): US-2.4–US-2.9 → §Retrospective · US-4.1–US-4.5 →
> §Phase 2 retrospective · US-2.10–US-2.13 → §Phase 3 retrospective · US-5.1–US-5.4 →
> §Phase 4 retrospective. "Phase" in those headings is the name each tranche carried while
> it ran.
>
> The 08-10 tranche's plan, dependency list and risk register were removed on 2026-08-17
> ([CONTEXT D31](../CONTEXT.md)): they were [sprint-2026-W34](sprint-2026-W34.md)'s, moved
> here wholesale when its scope moved, and every finding in them survives in
> [EPIC-2](epics/EPIC-2.md), in US-2.10–US-2.13, and in [CONTEXT D23–D25](../CONTEXT.md).

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

1. **Phase 1 — Substrate** (\~2.5 days): US-2.4. `core/` + `tools/<tag>/` layout;
   `registerReadTool` and `parseOrThrow`; `client.get`'s `query` option, `accountPath`,
   and the dedicated `404`/`409` branches; `list_accounts` migrated onto the helper with
   no behaviour change; table-driven invariant tests; the operation-count correction,
   three new `CONTEXT.md` decisions, and the five-scope documentation update. Ships
   `0.2.0`.
2. **Phase 2 — First tools on the new substrate** (\~1 day): US-2.5 `list_brokers`
   (`0.3.0`), US-2.6 `list_strategies` (`0.4.0`) — neither takes a path parameter, so
   both prove `registerReadTool` before any story has to prove `accountPath` too.
3. **Phase 3 — First path parameter** (\~1 day): US-2.7 `list_account_strategies`
   (`0.5.0`) — the first tool that routes through `accountPath` and the `404` login/id
   hint.
4. **Phase 4 — Terminal-backed pair** (\~1 day): US-2.8 `list_positions` (`0.6.0`),
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
  \~30-line figure only ever described the registration sliver substrate made cheap, not
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

- **A working smoke key for W34.** `get_performance_breakdowns`'s \~70,000-token
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
  projects to \~8,050 tokens against a 5,000-token budget on a ten-symbol account. It was
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

## Phase 4 retrospective — supported runtime and dependency currency

All four stories closed between 2026-08-13 and 2026-08-14, 10 points, and
[EPIC-5](epics/EPIC-5.md) is `done`. **The floor moved off an EOL line: `>=20.6.0` →
`>=22.11.0`**, the first Node 22 LTS, supported to 2027-04-30 ([CONTEXT D27](../CONTEXT.md),
shipped as `2.0.0`). The other three stories cut no version of their own and were then
released together as **`2.0.1`** — a patch whose 17 `dist/**/*.js` files are byte-identical
to `2.0.0`'s. Suite went 428 passed to **438 passed, 1 skipped (439)**.

### What went well

- **EPIC-5's own invariant — *every version pinned names the constraint it satisfies* —
  paid twice beyond the incident that motivated it.** US-5.1 used it to catch that the whole
  Node 22 line bundles npm **10.x**, so a Node 22 floor cannot let all four CI jobs share one
  pin; `publish` stayed on 24.19.0 and its global `npm install` step was deleted instead of
  maintained. US-5.3 used it to find that `vite` 7 and 8 declare `engines.node`
  `>=22.12.0` — **one patch release above this epic's own floor** — inside a transitive
  dependency of `vitest` that no PR title would ever mention. Both cost seconds
  (`npm view <pkg>@<ver> engines`) and neither was visible any other way.
- **The breaking-change claim was measured rather than assumed.** `2.0.0` narrows a support
  contract, so the obvious move is to call it breaking and stop. Instead the cost was priced:
  `2.0.0` was packed, installed into a clean directory on Node **20.19.4**, and produced
  `npm warn EBADENGINE`, **exit 0**, four packages added — and the installed binary then
  spawned and answered `tools/list` with all ten tools. `engine-strict` defaults to `false`,
  so nothing a consumer runs breaks below the floor. The major was still cut, but from the
  *contract* ([D27](../CONTEXT.md)) rather than from a breakage nobody had checked for.
- **US-5.2 was sequenced so its first real exercise is the *next* floor move.** Written
  before US-5.1 the check would have been authored against a number about to change, and
  tested by the one edit whose author was already thinking about it. Written second, it was
  proven on the real repository instead: `docs/SETUP.md:20` mutated to the old floor,
  `grep`-confirmed on disk, gate red, reverted, `grep`-confirmed again, gate green,
  `git diff --stat` empty ([LESSONS 1](../LESSONS.md)). The story also records that **3 of
  its first 10 test runs passed vacuously** — asserting exit 0 against a script with no floor
  check in it — which is what a check that does nothing looks like, written down rather than
  glossed.
- **TypeScript 7 was decided on evidence, and the evidence included the part nobody looks
  at.** `tsc` *is* the build here, so an emit difference is shipped JavaScript nobody read.
  Every `dist/**/*.js` was checksummed under both compilers — 17 files byte-identical — and
  the three `.js.map` files that did differ were traced to the exact three source constructs
  behind them (two parameter defaults and one set of parameter properties) rather than waved
  past. The argument for moving was then a measured \~3.6× build and \~2.8× typecheck, not
  novelty ([D29](../CONTEXT.md)).

### What didn't

- **[LESSONS 2](../LESSONS.md)'s trap was hit again — inside the story whose whole job is to
  stop a number drifting unnoticed.** The first `-t` filter drafted for US-5.2's verification
  table, `"Node floor > fails naming"`, selected **zero** tests and **exited 0**. It was
  caught only because Phase 3's own followup demanded a *count* per row. The followup worked;
  the reflex it was meant to install did not, one day later.
- **The floor gate's strictness was paid for in prose, by two sentences written the day
  before.** US-5.1's README lines "Raised from `≥ 20.6.0` in v2.0.0" and "the last version
  declaring the old `≥ 20.6.0` floor" made the new gate fail on the real repository the
  moment it existed, and were rephrased off the operator form. The alternative — teach the
  matcher tense and intent — was rejected for good reasons, but the result is a constraint on
  how history may be written that no reader discovers until the gate fails on them.
- **This phase added Dependabot while the gap that verifies its output stayed open.**
  Nothing in this repository runs on a pull request. Weekly grouped dependency PRs now
  arrive into that, and `typescript@7.0.2` is a days-old major of a rewritten compiler. The
  phase increased the inbound volume and did not narrow the verification gap; both facts are
  recorded ([US-5.3](stories/US-5.3-devdependency-currency-and-dependabot.md) §AC-6,
  `dependabot.yml`'s header, [EPIC-5](epics/EPIC-5.md) §What this epic did not close), which
  is not the same as fixed.
- **The epic's plan said one release and produced two.** [EPIC-5](epics/EPIC-5.md) §Stories
  stated flatly that "exactly one release comes out of this epic — `2.0.0`", and three
  stories later `2.0.1` was cut to clear `[Unreleased]`. The change is recorded under
  §Closed 2026-08-14 rather than absorbed, but the plan was wrong exactly where it was most
  confident.

### Followups

- **A workflow on `pull_request` is now the highest-value unbuilt thing in this repo.** It is
  named in three places — EPIC-4's Phase 2 followups, US-5.3 §AC-6, and `dependabot.yml`'s
  header comment — and owned by no story. Two facts arriving this phase make it concrete
  rather than tidy: a bot that opens PRs weekly, and a rewritten compiler whose emit
  regression would otherwise be caught no earlier than a tag.
- **The next floor move is the first exercise of three rules that are written but untested
  together.** `release:check` must pass across `package.json`, `README.md` and `SETUP.md`;
  `@types/node`'s major moves in the *same commit* ([D28](../CONTEXT.md)); and any `vite`
  pulled in under `vitest` has its `engines.node` re-checked against the new floor. Whoever
  moves it next should expect to find which of the three is under-specified.
- **Re-run the compiler comparison, not the verdict, at the next TypeScript major.** Build
  under both, `shasum` every `.js`, enumerate any map that differs. [D29](../CONTEXT.md)'s
  durable half is the method; `7.0.2` is just what it returned this time.
- **An offline terminal and a symbol-rich account still block three recorded EPIC-2 gaps.**
  Carried unchanged from Phase 3 — no story can be pointed at it, and it is now the fourth
  sprint carrying the item.

## Sprint close — 2026-08-17

Window elapsed 2026-08-16; closed by the maintainer on 2026-08-17
([CONTEXT D21](../CONTEXT.md) rule 2).

**19 stories / 52 points, all `done`; four phases, three epics closed
([EPIC-2](epics/EPIC-2.md), [EPIC-4](epics/EPIC-4.md), [EPIC-5](epics/EPIC-5.md)); fourteen
releases, `0.2.0` → `2.0.1`.** Scope grew three times inside the window under
[CONTEXT D21](../CONTEXT.md) rule 1 — Phase 2 on 08-10, Phase 3 on 08-10, Phase 4 on 08-13 —
and every phase's table, total and retrospective is left as written rather than reconciled
into agreement.

**Nothing carries to [sprint-2026-W34](sprint-2026-W34.md).** No story in the corpus sits at
`backlog`, `ready`, `in-progress`, `review` or `blocked`. The four §Followups above are the
open work, and none of them has a story yet.

## Cross-references

- [EPIC-2](epics/EPIC-2.md) · [EPIC-3](epics/EPIC-3.md) · [EPIC-4](epics/EPIC-4.md) — Phase 2's epic · [EPIC-5](epics/EPIC-5.md) — Phase 4's epic
- [STATUS.md](STATUS.md) — generated kanban
- [CONTEXT D6](../CONTEXT.md) — the most recent decision as this sprint opens
- [CONTEXT D21](../CONTEXT.md) · [CONTEXT D22](../CONTEXT.md) — the sprint-scope decisions behind this file's four tranches
- [CONTEXT D30](../CONTEXT.md) — why those four tranches are one scope table rather than four
- [CONTEXT D15–D20](../CONTEXT.md) — the six decisions Phase 2 implements
- [CONTEXT D14](../CONTEXT.md) — the `1.1.0` → `1.4.0` renumber Phase 3's versions follow
- [CONTEXT D10](../CONTEXT.md) — tools bind and shape their own payloads; the policy US-2.12 and US-2.13 implement
- [LESSONS 2](../LESSONS.md) — a Verification-commands row is a claim; every row in Phase 3's stories is run before it is trusted
- [read-tool expansion design spec](../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [read-tools-w33 implementation plan](../superpowers/plans/2026-08-06-senti-read-tools-w33.md)
- [sprint-2026-W32](sprint-2026-W32.md) — prior sprint
- [sprint-2026-W34](sprint-2026-W34.md) — next sprint
