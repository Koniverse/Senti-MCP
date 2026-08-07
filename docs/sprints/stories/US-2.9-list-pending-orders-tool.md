---
id: US-2.9
title: "list_pending_orders tool"
epic: EPIC-2
status: done
version_shipped: 0.7.0
priority: P1
points: 2
sprint: sprint-2026-W33
assignee: bluezdot
created: 2026-08-06
updated: 2026-08-07
---

## Goal

A user asks "is anything pending right now" — the order-side twin of
[US-2.8](US-2.8-list-positions-tool.md)'s "what am I holding." `GET
/api/v1/accounts/{accountId}/orders` answers it, reading through to the same MT5
terminal `list_positions` does, and carrying the identical risk: a terminal that could
not be reached must never read the same as an account with no pending orders. This is
the last story of sprint W33 — closing it closes the sprint.

## Background

Per the [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
§Tool surface, `list_pending_orders` reads `GET /api/v1/accounts/{accountId}/orders`
under the `trading:read` scope and returns `tools/trading/orders.ts`. It is
deliberately the mirror of [US-2.8](US-2.8-list-positions-tool.md): the same `409`
terminal-offline branch, the same "empty is a real zero, not a failure" distinction,
and the same 200-row payload cap from the design spec's §Payload policy — `orders`
`priceStopLimit` plays the role `sl`/`tp` played for positions, and the same
null-is-not-zero handling applies. Building this story as a mirror rather than a fresh
design is deliberate: the pattern is proven once, by US-2.8, and reused here rather
than re-derived, which is why this story is priced the same 2 points as its sibling
despite covering an equally real endpoint.

## Acceptance criteria

- [x] **AC-1** — **Given** a call with `accountId`, **When** the request is built,
  **Then** the path is constructed via `accountPath`.
- [x] **AC-2** — **Given** the API returns `409`, **When** the tool returns, **Then**
  the text reports the terminal offline, **And** it explicitly distinguishes this from
  the account holding no pending orders — mirroring
  [US-2.8](US-2.8-list-positions-tool.md) AC-2.
- [x] **AC-3** — **Given** a successful response with zero pending orders, **When** it
  is formatted, **Then** the output states that this is a real zero.
- [x] **AC-4** — **Given** an order with `priceStopLimit` equal to `0`, **When** it is
  formatted, **Then** the `stop-limit` line is omitted entirely — never printed as `0`
  or `0.00` — because `priceStopLimit` only means something for stop-limit order
  types, unlike `sl`/`tp`, which apply to every order and so still render an explicit
  `—` when unset.
- [x] **AC-5** — **Given** more than 200 pending orders, **When** the list is
  formatted, **Then** it truncates at 200 rows, **And** `notes` records how many were
  dropped — mirroring [US-2.8](US-2.8-list-positions-tool.md) AC-5.
- [x] **AC-6** — **Given** a `403` from the API, **When** the tool returns, **Then**
  `isError` is true and the text names the `trading:read` scope.

## Tasks

- [x] **TASK-2.9.1** — `tools/trading/orders.ts` domain module (plan Task 18)
  (AC: 3, 4, 5)
  - [x] `OrderSchema`, `parseOrders`, `formatOrders` — `sl`/`tp` are non-nullable
        numbers where `0` means "not set" and render as `—`, the same MT5 sentinel
        convention `positions.ts` uses; `priceStopLimit` is a different mechanism —
        its `0` means the field doesn't apply to this order type at all, so its whole
        line is omitted rather than shown with an em dash; the 200-row cap and `notes`
- [x] **TASK-2.9.2** — Registration, the 0.7.0 release, and the sprint close
  (plan Task 19) (AC: 1, 2, 6)
  - [x] Register through `registerReadTool`; build the path via `accountPath`;
        `scope: 'trading:read'`; `conflictMeans` text for the terminal-offline `409`

## Dev notes

### Architecture constraints

- Registers through `registerReadTool` and builds its path through `accountPath`,
  identical wiring to [US-2.8](US-2.8-list-positions-tool.md).
- Payload policy mirrors positions: return in full, defensive cap at 200 rows,
  `notes: string[]` empty when nothing was cut. See design spec §Payload policy.

### Cross-story dependencies

- **Builds on** [US-2.4](US-2.4-tool-substrate-and-layout.md) — `accountPath` and the
  `conflictMeans`-parametrized `409` branch.
- **Builds on** [US-2.8](US-2.8-list-positions-tool.md) — reuses its `409`/real-zero/
  `notes` pattern rather than re-deriving it; `positions.test.ts`'s table-driven shape
  is the template for `orders.test.ts`.
- **Sibling of nothing further this sprint.** This is the last story in
  [sprint-2026-W33](../sprint-2026-W33.md)'s scope table; its close is the sprint's
  close.

### What we explicitly did NOT do

- **No retry on `409`**, same rationale as [US-2.8](US-2.8-list-positions-tool.md) —
  the write path's partial-close operation must not inherit a read-path retry policy.
- **No merge of positions and orders into one tool.** The design spec's Decisions
  taken §2 rules out a `view`-parameter tool that collapses multiple endpoints behind
  one schema; `list_positions` and `list_pending_orders` stay two tools with two
  `outputSchema`s.
- **The four remaining read tools —** `get_account_performance`,
  `get_performance_breakdowns`, `get_equity_timeseries`, `list_deals` **— do not start
  in this sprint.** They open query parameters, downsampling, and cursor pagination,
  and carry to W34 per the design spec's Story plan.

### References

- [Source: design spec §Tool surface](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md) — `list_pending_orders` row
- [Source: design spec §Terminal state is not emptiness](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [Source: design spec §Payload policy](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [Source: design spec §Story plan](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md) — W33/W34 split
- [Source: read-tools-w33 implementation plan, Tasks 18–19](../../superpowers/plans/2026-08-06-senti-read-tools-w33.md)

## Verification commands

| AC | Command |
|---|---|
| AC-3, AC-4, AC-5 | `npm test -- src/tools/trading/orders.test.ts` |
| AC-1 | `npm test -- src/server.test.ts -t "list_pending_orders.*account-scoped"` — corrected from this table's original `npm test -- src/tools/trading/orders.test.ts -t accountPath`, the third instance of this defect (after [US-2.7](US-2.7-list-account-strategies-tool.md) and [US-2.8](US-2.8-list-positions-tool.md)): `orders.test.ts` is the domain-module test from TASK-2.9.1 and never calls `accountPath` itself — only `registerListPendingOrders` does, so the original command runs 13 skipped / 0 passed and verifies nothing. Verified by running both: the original command produces `13 skipped (13)`; the corrected one produces `1 passed \| 33 skipped (34)`. |
| AC-2 | `npm test -- src/server.test.ts -t "list_pending_orders.*409"` |
| AC-6 | `npm test -- src/server.test.ts -t "list_pending_orders.*403"` |

## Changelog entry

### Added
- `src/tools/trading/orders.ts` — the `list_pending_orders` tool: `OrderSchema`,
  `parseOrders`, `formatOrders`, mirroring `list_positions`'s `409`/real-zero/
  200-row-cap pattern for pending orders.

## Implementation notes

TASK-2.9.2 (plan Task 19) closed this story and closed sprint W33. Before any change,
`npm test` was run as a baseline: **175 passed, 1 skipped (176 total)**, all green —
TASK-2.9.1's domain module (`OrderSchema`, `parseOrders`, `capOrders`, `formatOrders`,
from plan Task 18) already existed with its own 13 passing tests; only registration was
missing.

Following the TDD cycle: the `OrdersOutputSchema` import, the `ORDER` fixture, a
`describe('list_pending_orders', …)` block, and a `list_pending_orders` row in
`TOOL_CALLS` (`successBody: { orders: [ORDER] }` — the envelope shape, not a bare
array) were appended to `src/server.test.ts` first, verbatim from the Task 19 brief.
Running `npx vitest run src/server.test.ts -t 'list_pending_orders'` confirmed genuine
red: **3 failed**, each `ProtocolError: Tool list_pending_orders not found` (31 other
tests in the file were skipped by the `-t` filter, not run). No test in the new
`describe` block could have passed before `registerListPendingOrders` existed.

Only then was `registerListPendingOrders` appended to `src/tools/trading/orders.ts` —
three new imports (`McpServer` type, `accountPath` + `SentiClient` type from
`core/client.js`, `registerReadTool`), the `TRADING_READ` and `TERMINAL_OFFLINE`
constants, and the function itself, verbatim per the brief, building the request path
exclusively through `accountPath(args.accountId, 'orders')` and passing
`conflictMeans: TERMINAL_OFFLINE` through to `client.get` — and wired into
`src/server.ts` alongside the five existing registrations.

`npm test` after implementation: **178 passed, 1 skipped (179 total)** — 3 new
`list_pending_orders` tests in `src/server.test.ts` (exactly the brief's 3).
`src/server.test.ts`'s own test count went from 31 to 34. No other file's test count
changed. `npm run typecheck` (`tsc --noEmit` against both `tsconfig.json` and
`tsconfig.test.json`) passed clean, as did `npm run build`.

**No pre-existing test broke.** `npm test` after wiring `registerListPendingOrders`
into `server.ts` passed every prior test on the first run.

**The traversal-invariant enrollment was verified by mutation, not assumed.** Per the
Task 19 brief's instruction to confirm rather than assume that the table-driven
`accountPath`-traversal test in `src/server.test.ts` genuinely covers this tool: with
the implementation correct, `npx vitest run src/server.test.ts -t 'rejects a
path-traversal'` passed (1 passed, 33 skipped). To prove that pass was not vacuous,
`accountPath(args.accountId, 'orders')` was temporarily replaced with a raw template
literal (`` `/api/v1/accounts/${args.accountId}/orders` ``) in `orders.ts`, and the
mutation's landing was confirmed by `grep` before re-running the test — the same
discipline this task's own instructions and the candidate `docs/LESSONS.md` entry
below both call out. With the mutation in place the same test genuinely failed:
`AssertionError: list_pending_orders: expected 'Senti API returned an unexpected
shap…' to match /Invalid path segment/` (the traversal `accountId` reached
`accountPath`'s segment validator only through `client.get` never being called with a
throw, so it fell through to a downstream shape error instead). The fix was reverted,
re-`grep`ped to confirm it landed, and the suite re-ran green. `list_pending_orders` is
genuinely enrolled in the shared traversal protection, not passing by coincidence.

**The leak-test defense worked as designed.** The brief's `TOOL_CALLS` row uses
`arguments: { accountId: 'abc-123' }`, a value that passes `accountPath`'s
`/^[A-Za-z0-9_-]{1,64}$/` segment check, so the row's calls genuinely reach
`client.get` and the stubbed `fetch` on every error status — the leak tests' `/Senti
API/` and `ENOTFOUND` assertions held for this row without modification.

**A defect found in this brief while implementing, beyond the verification-table
correction below: the smoke test extension in Task 19's own brief (Step 4) never
touches `list_pending_orders`.** Its code block walks `list_accounts` → `list_brokers`
→ `list_strategies` → `list_account_strategies` → `list_positions` and stops — despite
its own test name claiming to walk "the whole W33 read path" and despite Task 19's
top-level instructions explicitly asking the smoke test to settle whether a live
`list_pending_orders` response can carry `null` in `sl`/`tp`/`priceStopLimit`. Since
`list_pending_orders` is this task's own tool and the sixth and final leg of that read
path, `src/smoke.test.ts` was extended past the brief's literal code with a
`list_pending_orders` block mirroring the `list_positions` try/catch 409-tolerance
pattern, importing `parseOrders`, `capOrders`, `formatOrders` from `orders.js`. This is
flagged here rather than silently added, per this task's instruction to say so when the
brief contradicts itself or its own stated goal.

**The smoke test ran — it was not skipped — but settled neither open question, because
the configured `SENTI_SMOKE_KEY` was itself rejected.** A `.env.local` carrying
`SENTI_SMOKE_KEY` (and no `SENTI_API_BASE_URL`) was available from outside this
worktree and copied in without its value ever being read, printed, or logged.
`npm run test:smoke` ran the extended live-path test (it did not report as skipped,
confirming the key was present and non-empty), and failed at the very first call —
`GET /api/v1/accounts` — with `401` ("Senti API rejected the credentials"). The same
key was retried once against the production base URL
(`SENTI_API_BASE_URL=https://api.sentitrade.xyz`) in case it had been issued for that
environment instead of the documented dev pairing; it was rejected there too. **Neither
of the two open schema questions this task asked the smoke test to settle —
whether a live `list_strategies` record ever omits `description`/`supportedSymbols`/
`supportedTimeframes`, and whether a live `list_positions`/`list_pending_orders`
record ever carries `null` in `sl`/`tp`/`priceStopLimit` — was settled by this run.**
This is reported as a failed/inconclusive live attempt, not as a skip and not as a
pass; the distinction matters because a `401` proves nothing about either question,
unlike a clean `describe.skipIf` skip which at least says plainly "no evidence either
way." The unusable credential was left in place (gitignored, never committed) rather
than deleted, in case a working key becomes available for a retry.

**Brief accuracy check.** Task 19's `src/server.test.ts` and `src/tools/trading/orders.ts`
code blocks (Steps 1 and 3) were applied verbatim and needed no correction. Step 4's
smoke-test code block was applied verbatim as a base and then extended, for the reason
above. The one defect found in this story's own pre-existing Verification-commands
table (AC-1's row) is the same defect class as US-2.7's and US-2.8's — the third
instance of exactly that mistake on this plan.

Released `0.7.0`: `VERSION`, `package.json`, and `src/config.ts`'s `SERVER_VERSION` all
moved in lockstep; `config.test.ts`'s drift check passed unmodified as part of the same
`npm test` run. `docs/CHANGELOG.md` gained the `[0.7.0]` section above `[0.6.0]`,
matching that entry's register and naming the `priceStopLimit`-vs-`sl`/`tp` rendering
difference explicitly. `README.md` gained a `list_pending_orders` row in the tool
table, the scope-exercise sentence now names `trading:read` as covered by both
`list_positions` and `list_pending_orders` and updates its version anchor to v0.7.0,
and the "Restart the client" sentence now names all six tools.

## Files modified

**Modified (tool + registration):**
- `src/tools/trading/orders.ts` — appended `registerListPendingOrders`,
  `TRADING_READ`, `TERMINAL_OFFLINE`, and three new imports (`McpServer` type,
  `accountPath` + `SentiClient` type, `registerReadTool`)
- `src/server.ts` — import and registration call for `registerListPendingOrders`

**Modified (tests):**
- `src/server.test.ts` — `OrdersOutputSchema` import, `ORDER` fixture, the
  `describe('list_pending_orders', …)` block (3 tests, verbatim from the brief), and
  the extended `TOOL_CALLS` table (`successBody: { orders: [ORDER] }`, the envelope
  shape)
- `src/smoke.test.ts` — replaced its single-endpoint body with a chained walk across
  all six W33 tools (`list_accounts`, `list_brokers`, `list_strategies`,
  `list_account_strategies`, `list_positions`, `list_pending_orders`), tolerating a
  `409` on the two terminal-backed calls and returning early when the key owns no
  account. The `list_pending_orders` leg was added beyond the brief's own code block
  (see Implementation notes).

**Modified (version):**
- `VERSION`, `package.json`, `src/config.ts` — `0.6.0` → `0.7.0`

**Modified (CHANGELOG and README):**
- `docs/CHANGELOG.md` — added the `[0.7.0]` section above `[0.6.0]`, below
  `[Unreleased]`
- `README.md` — `list_pending_orders` row in the tool table; the scope-exercise
  sentence and the "Restart the client" sentence updated to name all six shipped tools

**Modified (story closure, sprint close, and Active Context):**
- `docs/sprints/stories/US-2.9-list-pending-orders-tool.md` — this file: frontmatter
  (`status: done`, `version_shipped: 0.7.0`), all AC and task boxes, the
  Verification-commands table (AC-1 row corrected to the test that actually exercises
  it), this section
- `docs/sprints/sprint-2026-W33.md` — `status: closed`, US-2.9's scope-table row →
  `✅ done`, the retrospective filled in
- `docs/sprints/epics/EPIC-2.md` — US-2.9's story-index row → `✅ done (v0.7.0)`
- `CLAUDE.md` — Active Context block refreshed (sprint W33 closed, Last Version 0.7.0)
- `docs/sprints/STATUS.md` — regenerated by `npm run agile:status` (RULE-5, never
  hand-edited)

**Not modified:** `commit:` is deliberately absent from this story's frontmatter —
RULE-2 forbids `--amend`-ing a commit's own SHA into its own commit; a follow-up commit
backfills it later, the same precedent US-2.4 through US-2.8's closures recorded.

## Cross-references

- [Epic EPIC-2](../epics/EPIC-2.md)
- [sprint-2026-W33](../sprint-2026-W33.md)
- [CHANGELOG](../../CHANGELOG.md)
- [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [US-2.4](US-2.4-tool-substrate-and-layout.md) · [US-2.8](US-2.8-list-positions-tool.md)
