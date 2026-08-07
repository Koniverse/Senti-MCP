---
id: US-2.8
title: "list_positions tool"
epic: EPIC-2
status: done
version_shipped: 0.6.0
priority: P1
points: 2
sprint: sprint-2026-W33
assignee: bluezdot
created: 2026-08-06
updated: 2026-08-07
---

## Goal

A user asks "what am I holding right now." `GET /api/v1/accounts/{accountId}/positions`
answers it — but unlike every tool shipped so far, this endpoint reads through to the
account's live MT5 terminal, which can be offline. This is the first story to make that
distinction real: "the terminal could not be reached" and "this account holds no open
positions" are different sentences, and a tool that conflates them tells a trader
holding open risk that they hold none.

## Background

Per the [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
§Tool surface, `list_positions` reads `GET /api/v1/accounts/{accountId}/positions`
under the `trading:read` scope and returns `tools/trading/positions.ts`. The design
spec's §Terminal state is not emptiness section states the mechanism precisely: *"Both
endpoints declare a `409` whose meaning is stated outright — 'The account terminal is
offline — positions are temporarily unavailable.' So the distinction is a status-code
branch, not something `formatX` has to infer: a `409` reports the offline terminal, and
reaching the empty-list path at all proves the terminal answered."* This is EPIC-2's
*null is not zero* invariant in its most consequential form yet — worse than a null
balance, because the failure mode is a trader believing they hold no risk when the
truth is unknown. Per §Payload policy, `list_positions` returns positions in full with
a defensive cap of 200 rows, recording any truncation in `notes` — the same
`notes: string[]` convention every payload-shaping tool in this expansion carries.

## Acceptance criteria

- [x] **AC-1** — **Given** a call with `accountId`, **When** the request is built,
  **Then** the path is constructed via `accountPath`.
- [x] **AC-2** — **Given** the API returns `409`, **When** the tool returns, **Then**
  the text reports the terminal offline, using the endpoint's own `conflictMeans`
  text ([US-2.4](US-2.4-tool-substrate-and-layout.md) AC-6), **And** it explicitly
  distinguishes this from the account holding no positions.
- [x] **AC-3** — **Given** a successful response with zero positions, **When** it is
  formatted, **Then** the output states that this is a real zero — the terminal
  answered and reported none — never conflated with the `409` case.
- [x] **AC-4** — **Given** a position with `sl` or `tp` equal to `0`, **When** it is
  formatted, **Then** it renders as `—`, never as `0.00`.
- [x] **AC-5** — **Given** more than 200 positions, **When** the list is formatted,
  **Then** it truncates at 200 rows, **And** `notes` records how many were dropped and
  how to ask for more.
- [x] **AC-6** — **Given** a `403` from the API, **When** the tool returns, **Then**
  `isError` is true and the text names the `trading:read` scope.

## Tasks

- [x] **TASK-2.8.1** — `tools/trading/positions.ts` domain module (plan Task 16)
  (AC: 3, 4, 5)
  - [x] `PositionSchema`, `parsePositions`, `formatPositions` — `sl`/`tp` are
        non-nullable numbers where `0` means "not set" and renders as `—`, the same
        em-dash convention `list_accounts`' `money()` uses for `null`; the 200-row
        cap and `notes`
- [x] **TASK-2.8.2** — Registration, the `409` branch, and the 0.6.0 release
  (plan Task 17) (AC: 1, 2, 6)
  - [x] Register through `registerReadTool`; build the path via `accountPath`;
        `scope: 'trading:read'`; `conflictMeans` text for the terminal-offline `409`

## Dev notes

### Architecture constraints

- Registers through `registerReadTool` and builds its path through `accountPath`,
  same as [US-2.7](US-2.7-list-account-strategies-tool.md).
- **The `409` branch is parametrized by `conflictMeans`, not hardcoded**
  ([US-2.4](US-2.4-tool-substrate-and-layout.md) AC-6) — `409` means something
  different on the eventual write path, so the client cannot hardcode "terminal
  offline" as `409`'s universal meaning; only this call site knows what its own
  conflict is.
- Payload policy: return in full, defensive cap at 200 rows, `notes: string[]` empty
  when nothing was cut. See design spec §Payload policy.

### Cross-story dependencies

- **Builds on** [US-2.4](US-2.4-tool-substrate-and-layout.md) — `accountPath` and the
  `conflictMeans`-parametrized `409` branch.
- **Builds on** [US-2.7](US-2.7-list-account-strategies-tool.md) — the `accountPath`
  wiring precedent.
- **Sibling of** [US-2.9](US-2.9-list-pending-orders-tool.md) — both terminal-backed,
  both land the same week; the `409`/`notes` pattern this story establishes is reused
  by US-2.9 for orders rather than re-derived.

### What we explicitly did NOT do

- **No retry on `409`.** A `409` is reported once, not retried. The design spec
  explicitly warns that any retry policy built for the read path must not be
  inherited by the write path's partial-close operation
  ([EPIC-3](../epics/EPIC-3.md)) — a concern this story does not need to solve, only
  not accidentally create the precedent for.
- **No automatic drain past 200 rows.** A truncated list says so in `notes`; it does
  not silently fetch more.

### References

- [Source: design spec §Tool surface](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md) — `list_positions` row
- [Source: design spec §Terminal state is not emptiness](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [Source: design spec §Payload policy](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [Source: EPIC-2 §Cross-cutting invariants](../epics/EPIC-2.md) — null is not zero
- [Source: read-tools-w33 implementation plan, Tasks 16–17](../../superpowers/plans/2026-08-06-senti-read-tools-w33.md)

## Verification commands

| AC | Command |
|---|---|
| AC-3, AC-4, AC-5 | `npm test -- src/tools/trading/positions.test.ts` |
| AC-1 | `npm test -- src/server.test.ts -t "list_positions.*account-scoped"` — the domain module (`positions.test.ts`) never calls `accountPath` itself, only `registerListPositions` does, so this AC is only meaningfully exercised at the registration level, same as AC-2's traversal test in [US-2.7](US-2.7-list-account-strategies-tool.md) |
| AC-2 | `npm test -- src/server.test.ts -t "list_positions.*409"` |
| AC-6 | `npm test -- src/server.test.ts -t "list_positions.*403"` |

## Changelog entry

### Added
- `src/tools/trading/positions.ts` — the `list_positions` tool: `PositionSchema`,
  `parsePositions`, `formatPositions`, a `409` terminal-offline branch distinguished
  from a real zero, and a 200-row truncation cap recorded in `notes`.

## Implementation notes

TASK-2.8.2 (plan Task 17) closed this story. Before any change, `npm test` was run as a
baseline: **158 passed, 1 skipped (159 total)**, all green — TASK-2.8.1's domain module
(`PositionSchema`, `parsePositions`, `capPositions`, `formatPositions`, from plan Task
16) already existed with its own 13 passing tests, including the empty-list "real zero"
wording; only registration was missing.

Following the TDD cycle: the `PositionsOutputSchema` import, the `POSITION` fixture, a
`describe('list_positions', …)` block, and a `list_positions` row in `TOOL_CALLS` (with
`successBody: { positions: [POSITION] }` — the envelope shape, not a bare array, since
this endpoint wraps its array unlike `list_brokers`/`list_strategies`) were appended to
`src/server.test.ts` first, verbatim from the brief. Running
`npx vitest run src/server.test.ts -t 'list_positions'` confirmed genuine red: **4
failed**, each with `ProtocolError: Tool list_positions not found` (the other 27 tests in
the file were skipped by the `-t` filter, not run). No test in the new describe block
could have passed before `registerListPositions` existed.

Only then was `registerListPositions` appended to `src/tools/trading/positions.ts` —
three new imports (`McpServer` type, `accountPath` + `SentiClient` type from
`core/client.js`, `registerReadTool`), the `TRADING_READ` and `TERMINAL_OFFLINE`
constants, and the function itself, verbatim per the brief, building the request path
exclusively through `accountPath(args.accountId, 'positions')` and passing
`conflictMeans: TERMINAL_OFFLINE` through to `client.get` — and wired into
`src/server.ts` alongside the four existing registrations.

`npm test` after implementation: **162 passed, 1 skipped (163 total)** — 4 new
`list_positions` tests in `src/server.test.ts` (exactly the brief's 4; no extra test was
needed this time because the brief's own block already includes a "names the
`trading:read` scope on 403" test, unlike US-2.7's brief which omitted one for AC-6).
`src/server.test.ts`'s own test count went from 27 to 31. No other file's test count
changed. `npm run typecheck` (`tsc --noEmit` against both `tsconfig.json` and
`tsconfig.test.json`) passed clean. `npx tsc --noEmit` alone (the bare compiler check
requested alongside `npm test`) also passed clean.

**No pre-existing test broke.** `npm test` after wiring `registerListPositions` into
`server.ts` passed every prior test on the first run.

**One correction while closing the story, same defect class as US-2.7's.** This story's
own pre-existing Verification-commands table pointed AC-1's command at
`src/tools/trading/positions.test.ts -t accountPath` — but that file (the domain-module
tests from Task 16) never calls `accountPath`; only `registerListPositions` does.
Running that command returns "13 skipped, 0 run" — it does not exercise AC-1. Verified
by running all four table rows before touching anything else: AC-3/4/5's row passed 13
tests genuinely; AC-1's row skipped all 13; AC-2's and AC-6's rows each passed exactly 1
test. Corrected AC-1's row to
`npm test -- src/server.test.ts -t "list_positions.*account-scoped"`, which does run
(and pass) exactly 1 test — the one asserting `calls[0]` is the expected
`accountPath`-built URL.

**The leak-test defense worked as designed, not merely as claimed.** The brief's
`TOOL_CALLS` row uses `arguments: { accountId: 'abc-123' }`, a value that passes
`accountPath`'s `/^[A-Za-z0-9_-]{1,64}$/` segment check, so the row's calls genuinely
reach `client.get` and the stubbed `fetch` on every error status — the leak tests'
`/Senti API/` and `ENOTFOUND` assertions (added in the prior commit,
`f7a3669`) held for this row without modification.

Released `0.6.0`: `VERSION`, `package.json`, and `src/config.ts`'s `SERVER_VERSION` all
moved in lockstep; `config.test.ts`'s drift check (`SERVER_VERSION` matches
`package.json` and `VERSION`) passed unmodified as part of the same `npm test` run.
`docs/CHANGELOG.md` gained the `[0.6.0]` section above `[0.5.0]`, matching that entry's
register, and states outright — as this task's instructions required — that a `200`
with an empty `positions` array is a real zero while a `409` means the terminal could
not be reached and is explicitly not the same thing. `README.md` gained a
`list_positions` row in the tool table (naming the `409`/offline-terminal behaviour
directly in the table cell), the scope-exercise sentence now names `trading:read` as
covered by `list_positions` and updates its version anchor to v0.6.0, and the "Restart
the client" sentence now names all five tools.

**Brief accuracy check.** The Task 17 brief's code blocks for `src/server.test.ts` and
`src/tools/trading/positions.ts` were applied verbatim and needed no correction, and the
brief did not contradict itself or the story doc's acceptance criteria anywhere I found.
The one defect found while closing the story was in this file's own pre-existing
Verification-commands table (AC-1's row, corrected above), not in the brief. The one
thing added beyond the brief's own checklist was the CHANGELOG's explicit
terminal-offline-vs-real-zero paragraph, which the task instructions (not the brief)
required in so many words.

## Files modified

**Modified (tool + registration):**
- `src/tools/trading/positions.ts` — appended `registerListPositions`, `TRADING_READ`,
  `TERMINAL_OFFLINE`, and three new imports (`McpServer` type, `accountPath` +
  `SentiClient` type, `registerReadTool`)
- `src/server.ts` — import and registration call for `registerListPositions`

**Modified (tests):**
- `src/server.test.ts` — `PositionsOutputSchema` import, `POSITION` fixture, the
  `describe('list_positions', …)` block (4 tests, verbatim from the brief), and the
  extended `TOOL_CALLS` table (`successBody: { positions: [POSITION] }`, the envelope
  shape)

**Modified (version):**
- `VERSION`, `package.json`, `src/config.ts` — `0.5.0` → `0.6.0`

**Modified (CHANGELOG and README):**
- `docs/CHANGELOG.md` — added the `[0.6.0]` section above `[0.5.0]`, below
  `[Unreleased]`
- `README.md` — `list_positions` row in the tool table; the scope-exercise sentence and
  the "Restart the client" sentence updated to name all five shipped tools

**Modified (story closure and Active Context):**
- `docs/sprints/stories/US-2.8-list-positions-tool.md` — this file: frontmatter
  (`status: done`, `version_shipped: 0.6.0`), all AC and task boxes, the
  Verification-commands table (AC-1 row corrected to the file that actually contains
  the test), this section
- `docs/sprints/sprint-2026-W33.md` — US-2.8's scope-table row → `✅ done`
- `docs/sprints/epics/EPIC-2.md` — US-2.8's story-index row → `✅ done (v0.6.0)`
- `CLAUDE.md` — Active Context block refreshed (US-2.8 closed, next up US-2.9, Last
  Version 0.6.0)
- `docs/sprints/STATUS.md` — regenerated by `npm run agile:status` (RULE-5, never
  hand-edited)

**Not modified:** `commit:` is deliberately absent from this story's frontmatter —
RULE-2 forbids `--amend`-ing a commit's own SHA into its own commit; a follow-up commit
backfills it later, the same precedent US-2.4 through US-2.7's closures recorded.

## Cross-references

- [Epic EPIC-2](../epics/EPIC-2.md)
- [sprint-2026-W33](../sprint-2026-W33.md)
- [CHANGELOG](../../CHANGELOG.md)
- [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [US-2.4](US-2.4-tool-substrate-and-layout.md) · [US-2.7](US-2.7-list-account-strategies-tool.md)
