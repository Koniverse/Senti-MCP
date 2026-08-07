---
id: US-2.7
title: "list_account_strategies tool"
epic: EPIC-2
status: done
version_shipped: 0.5.0
priority: P1
points: 2
sprint: sprint-2026-W33
assignee: bluezdot
created: 2026-08-06
updated: 2026-08-06
---

## Goal

A user asks "which EAs are running on my account" — a different question from "what
strategies does Senti offer" ([US-2.6](US-2.6-list-strategies-tool.md)). `GET
/api/v1/accounts/{accountId}/strategies` answers it: the DEPLOYING/RUNNING instances on
one account. This is the first tool this sprint to take `accountId`, and so the first
to route through `accountPath` and the `404` login/id hint US-2.4 built — the point at
which the substrate's security invariant stops being theoretical and starts being
exercised by a real tool.

## Background

Per the [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
§Tool surface, `list_account_strategies` reads
`GET /api/v1/accounts/{accountId}/strategies` under the `strategies:read` scope and
returns `tools/strategies/list-account-strategies.ts`. Two invariants converge on this
story. First, [AGENTS.md](../../../AGENTS.md) §Security conventions: "every path
parameter is format-validated and `encodeURIComponent`-ed before being joined into a
URL... this is the defect most easily introduced by copying the first tool into the
second" — this story is that second tool for path parameters, eight tools removed from
when that line was written for `list_accounts`, which had none. Second, the design
spec's `accountId` handling section: "every such tool's description names
`list_accounts`.`id` as the source and `login` as the wrong answer," because the odds
of a model reaching for the MT5 `login` number instead of the opaque `id` rise with
every tool that takes the parameter.

## Acceptance criteria

- [x] **AC-1** — **Given** a call with `accountId`, **When** the request is built,
  **Then** the path is constructed via `accountPath` — never by string concatenation.
- [x] **AC-2** — **Given** a traversal payload (`../`, `..%2F..%2Fadmin`, or similar)
  passed as `accountId`, **When** the tool runs, **Then** `accountPath` rejects it and
  **no HTTP request is made**.
- [x] **AC-3** — The tool description names `list_accounts`.`id` as the source of
  `accountId` and states that `login` is rejected.
- [x] **AC-4** — **Given** a `404` response, **When** the tool returns, **Then** the
  error text carries the `login`/`id` hint from `core/client.ts`'s dedicated `404`
  branch ([US-2.4](US-2.4-tool-substrate-and-layout.md) AC-5).
- [x] **AC-5** — **Given** an account with no deployed strategies, **When** the list is
  formatted, **Then** the output states this explicitly rather than returning an
  unexplained empty list.
- [x] **AC-6** — **Given** a `403` from the API, **When** the tool returns, **Then**
  `isError` is true and the text names the `strategies:read` scope.

## Tasks

- [x] **TASK-2.7.1** — `tools/strategies/list-account-strategies.ts` domain module
  (plan Task 14) (AC: 1, 3, 5)
  - [x] `AccountStrategySchema`, `parseAccountStrategies`, `formatAccountStrategies`
- [x] **TASK-2.7.2** — Registration, the first path parameter, and the 0.5.0 release
  (plan Task 15) (AC: 1, 2, 4, 6)
  - [x] Register through `registerReadTool`; `inputSchema` carrying `accountId`; build
        the path via `accountPath`; `scope: 'strategies:read'`; a traversal-payload
        test; a `404` hint assertion

## Dev notes

### Architecture constraints

- **`accountPath` is the only function permitted to build a path containing a
  parameter** ([US-2.4](US-2.4-tool-substrate-and-layout.md)) — this story is the
  first consumer of that rule outside `core/`'s own tests, and the first place a
  reviewer should check that no shortcut crept in.
- Registers through `registerReadTool`, same as
  [US-2.5](US-2.5-list-brokers-tool.md) and
  [US-2.6](US-2.6-list-strategies-tool.md).

### Cross-story dependencies

- **Builds on** [US-2.4](US-2.4-tool-substrate-and-layout.md) — `accountPath` and the
  `404` branch's login/id hint.
- **Builds on** [US-2.6](US-2.6-list-strategies-tool.md) — this tool's description
  explicitly contrasts itself against `list_strategies`'s platform-wide catalog
  ("the strategies deployed on this account, not the catalog `list_strategies`
  returns").
- **Sibling of** [US-2.8](US-2.8-list-positions-tool.md) and
  [US-2.9](US-2.9-list-pending-orders-tool.md) — both also take `accountId` and reuse
  the `accountPath` pattern this story is the first to exercise, though neither
  depends on this story directly.

### What we explicitly did NOT do

- **No automatic `login` → `id` resolution.** Rejected in the design spec for the
  same reason it applies to every account-scoped tool: it adds a hidden request, a
  cache that can go stale, and hides a mistake the model corrects itself once the
  `404` message names the right field.

### References

- [Source: design spec §Tool surface](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md) — `list_account_strategies` row
- [Source: design spec §`accountId` handling](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [Source: AGENTS.md §Security conventions](../../../AGENTS.md)
- [Source: EPIC-2 §Cross-cutting invariants](../epics/EPIC-2.md) — path-parameter validation
- [Source: read-tools-w33 implementation plan, Tasks 14–15](../../superpowers/plans/2026-08-06-senti-read-tools-w33.md)

## Verification commands

| AC | Command |
|---|---|
| AC-1, AC-3, AC-5 | `npm test -- src/tools/strategies/list-account-strategies.test.ts` |
| AC-2 | `npm test -- src/server.test.ts -t traversal` — the guard is only meaningfully exercised at the registration level (asserts the stubbed `fetch` was never invoked), not in the domain-module test file, which has no `accountPath` call to guard |
| AC-4 | `npm test -- src/server.test.ts -t "list_account_strategies.*404"` |
| AC-6 | `npm test -- src/server.test.ts -t "list_account_strategies.*403"` |

## Changelog entry

### Added
- `src/tools/strategies/list-account-strategies.ts` — the `list_account_strategies`
  tool: `AccountStrategySchema`, `parseAccountStrategies`, `formatAccountStrategies`,
  the first tool routed through `accountPath`.

## Implementation notes

TASK-2.7.2 (plan Task 15) closed this story. Before any change, `npm test` was run as a
baseline: **139 passed, 1 skipped (140 total)**, all green — TASK-2.7.1's domain module
(`AccountStrategySchema`, `parseAccountStrategies`, `formatAccountStrategies`, from plan
Task 14) already existed with its own 8 passing tests; only registration was missing.

Following the TDD cycle: the `AccountStrategiesOutputSchema` import, the `DEPLOYED`
fixture, a `describe('list_account_strategies', …)` block, and a
`list_account_strategies` row in `TOOL_CALLS` (the first row carrying `arguments`) were
appended to `src/server.test.ts` first, verbatim from the brief. Running
`npx vitest run src/server.test.ts -t 'list_account_strategies'` confirmed genuine red:
5 failed (`Tool list_account_strategies not found` on the three tests that call the
tool or list tools and then dereference the missing entry via `.find`; the two
description/schema assertions threw `TypeError`s — `Cannot convert undefined or null to
object` and `.toMatch() expects to receive a string, but got undefined` — because
`tools.find(...)` returned `undefined` before the tool existed). No test in this
describe block could have passed before `registerListAccountStrategies` existed.

Only then was `registerListAccountStrategies` appended to
`src/tools/strategies/list-account-strategies.ts` — three new imports (`McpServer`
type, `SentiClient` type and `accountPath` from `core/client.js`, `registerReadTool`)
plus the function itself, verbatim per the brief, building the request path exclusively
through `accountPath(args.accountId, 'strategies')` — and wired into `src/server.ts`
alongside the three existing registrations.

**Extra test added beyond the brief, to make AC-6 actually verified.** The brief's
Step 1 test block (5 tests) covers AC-1 through AC-5 but has no test asserting a `403`
names the `strategies:read` scope, unlike the parallel "names the X scope on 403" tests
`list_brokers` and `list_strategies` each carry for their own scope. AC-6 explicitly
requires this, and this story's own pre-existing Verification-commands table already
named the command `npm test -- src/server.test.ts -t "list_account_strategies.*403"`
that such a test would satisfy. Rather than checking AC-6 off with no assertion behind
it, a sixth test — `'names the strategies:read scope on 403'` — was added to the same
`describe` block, mirroring the sibling pattern exactly. It passes because
`registerListAccountStrategies` already passes `scope: STRATEGIES_READ` through to
`client.get`, and `core/client.ts`'s 403 branch names whatever scope it is given; no
implementation change was needed, only the test.

**One more correction while closing the story.** This story's own Verification-commands
table (present before this task, from earlier scaffolding) pointed AC-2's command at
`src/tools/strategies/list-account-strategies.test.ts -t traversal` — but that file (the
domain-module tests from Task 14) has no traversal test; it never calls `accountPath` at
all, only `parseAccountStrategies`/`formatAccountStrategies`. Running that command
returns "8 skipped, 0 run" — it does not exercise AC-2. The traversal-rejection test is
in `src/server.test.ts` (asserting the stubbed `fetch` is never invoked), which is where
`accountPath` is actually reached through registration. Corrected the table to point
there rather than leave a command in the story doc that silently verifies nothing.

**No pre-existing test broke.** `npm test` after wiring `registerListAccountStrategies`
into `server.ts` passed every prior test on the first run.

`npm test` after implementation: **145 passed, 1 skipped (146 total)** — 6 new
`list_account_strategies` tests in `src/server.test.ts` (the brief's 5 plus the added
403 test), no other file's test count changed. `npm run typecheck` (`tsc --noEmit`
against both `tsconfig.json` and `tsconfig.test.json`) passed clean.

Released `0.5.0`: `VERSION`, `package.json`, and `src/config.ts`'s `SERVER_VERSION` all
moved in lockstep; `config.test.ts`'s drift check passed unmodified. `docs/CHANGELOG.md`
gained the `[0.5.0]` section above `[0.4.0]`, matching that entry's register, and calls
out that this is the first tool taking a path parameter, that it routes through
`accountPath`, and that the guard runs before `client.get` is entered so a traversal
attempt never reaches the network. `README.md` gained a `list_account_strategies` row in
the tool table, the scope-exercise sentence now names `strategies:read` as covered by
both `list_strategies` and `list_account_strategies`, and the "Restart the client"
sentence now names all four tools.

## Files modified

**Modified (tool + registration):**
- `src/tools/strategies/list-account-strategies.ts` — appended
  `registerListAccountStrategies`, `STRATEGIES_READ`, and three new imports
  (`McpServer` type, `accountPath` + `SentiClient` type, `registerReadTool`)
- `src/server.ts` — import and registration call for `registerListAccountStrategies`

**Modified (tests):**
- `src/server.test.ts` — `AccountStrategiesOutputSchema` import, `DEPLOYED` fixture, the
  `describe('list_account_strategies', …)` block (6 tests — the brief's 5 plus a
  403/scope test added to give AC-6 an actual assertion), and the extended
  `TOOL_CALLS` table (first row carrying `arguments`)

**Modified (version):**
- `VERSION`, `package.json`, `src/config.ts` — `0.4.0` → `0.5.0`

**Modified (CHANGELOG and README):**
- `docs/CHANGELOG.md` — added the `[0.5.0]` section above `[0.4.0]`, below
  `[Unreleased]`
- `README.md` — `list_account_strategies` row in the tool table; the scope-exercise
  sentence and the "Restart the client" sentence updated to name all four shipped tools

**Modified (story closure and Active Context):**
- `docs/sprints/stories/US-2.7-list-account-strategies-tool.md` — this file:
  frontmatter (`status: done`, `version_shipped: 0.5.0`), all AC and task boxes, the
  Verification-commands table (AC-2 row corrected to the file that actually contains
  the traversal test), this section
- `docs/sprints/sprint-2026-W33.md` — US-2.7's scope-table row → `✅ done`
- `docs/sprints/epics/EPIC-2.md` — US-2.7's story-index row → `✅ done (v0.5.0)`
- `CLAUDE.md` — Active Context block refreshed (US-2.7 closed, next up US-2.8, Last
  Version 0.5.0)
- `docs/sprints/STATUS.md` — regenerated by `npm run agile:status` (RULE-5, never
  hand-edited)

**Not modified:** `commit:` is deliberately absent from this story's frontmatter —
RULE-2 forbids `--amend`-ing a commit's own SHA into its own commit; a follow-up commit
backfills it later, the same precedent US-2.4 through US-2.6's closures recorded.

## Cross-references

- [Epic EPIC-2](../epics/EPIC-2.md)
- [sprint-2026-W33](../sprint-2026-W33.md)
- [CHANGELOG](../../CHANGELOG.md)
- [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [US-2.4](US-2.4-tool-substrate-and-layout.md) · [US-2.6](US-2.6-list-strategies-tool.md)
