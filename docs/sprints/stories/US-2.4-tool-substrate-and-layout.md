---
id: US-2.4
title: "Tool substrate and directory layout"
epic: EPIC-2
status: done
version_shipped: 0.2.0
priority: P1
points: 5
sprint: sprint-2026-W33
assignee: bluezdot
created: 2026-08-06
updated: 2026-08-06
---

## Goal

Every read tool from here on adds one file, one test file, and one registration line —
not another hand-rolled `try`/`catch` and another copy-pasted annotation block. This
story ships no tool of its own; it restructures `src/` into `core/` (infrastructure) and
`tools/<tag>/` (one folder per API tag), builds the `registerReadTool` and
`parseOrThrow` helpers, teaches `client.get` a `query` option and the `accountPath`
path-builder, and migrates `list_accounts` onto all of it with no behaviour change. Five
tool stories this sprint, and four more in W34, get to stop worrying about the
mechanical parts of adding a tool and spend their points on what the tool actually does.

## Background

v0.1.0 shipped one tool in a flat `src/` — `accounts.ts`, `server.ts`, `index.ts` — a
layout [AGENTS.md](../../../AGENTS.md) still describes as deliberate ("flat: tools split
by API tag when they multiply, not into a `tools/` directory"). That was correct for one
tool. The [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
is outgrowing it at ten: `core/` holds the infrastructure that must never depend on any
tool (`client.ts`, `errors.ts`, `tool.ts`, `parse.ts`), and `tools/<tag>/` holds one file
per endpoint, split by API tag (`accounts/`, `brokers/`, `strategies/`, `performance/`,
`trading/`). This story rewrites the repo-structure section itself and records the
reversal as a CONTEXT decision, per that spec's §Repo structure and §Documentation
obligations.

**A pre-flight ruling folded `core/parse.ts` into this story's substrate**, alongside
`core/tool.ts`. The design spec's own text names only `client.ts`, `errors.ts`, and
`tool.ts` under `core/`; the ruling adds `parse.ts` exporting `parseOrThrow` — the
`AccountSchema`-style "parse or throw naming the field" pattern `accounts.ts` already
uses, generalized so every one of the ten tools shares one implementation instead of
re-deriving it. Every acceptance criterion and file list below already reflects that
ruling; `core/` is four files, not three.

This story is also where the operation-count defect the design spec found gets fixed.
[AGENTS.md](../../../AGENTS.md) and [EPIC-2](../epics/EPIC-2.md) both say "eight of the
17 operations are `POST`" and "the remaining 16 read operations" — the API is actually
10 `GET` + 7 `POST`, so with `list_accounts` shipped, nine read operations remain. The
[v1 design spec](../../superpowers/specs/2026-08-05-senti-mcp-server-design.md) is left
untouched, per the amend-via-CONTEXT precedent [D1](../../CONTEXT.md) and
[D5](../../CONTEXT.md) already established — it is a snapshot, not a living document.

## Acceptance criteria

- [x] **AC-1** — **Given** the migration is complete, **Then** `src/core/` holds
  `client.ts`, `errors.ts`, `tool.ts`, and `parse.ts`, each with a co-located test file,
  **And** `src/tools/accounts/list-accounts.ts` holds the accounts domain module,
  **And** `npm test`, `npm run typecheck`, and `npm run build` all exit 0 with no
  behavioural change to `list_accounts`.
- [x] **AC-2** — `core/` imports nothing from `tools/` — verified by grep, not by
  inspection.
- [x] **AC-3** — **Given** a call to `client.get(path, { query })` where `query` mixes
  defined and `undefined` values, **When** the request is built, **Then** every
  `undefined` entry is dropped and the remaining entries are encoded via
  `URLSearchParams`.
- [x] **AC-4** — **Given** `accountPath` is called with `../`, `..%2F..%2Fadmin`, the
  empty string, or a 65-character segment, **When** it validates the id, **Then** it
  throws rather than building a path. **Given** a normal id, **When** `accountPath`
  runs, **Then** it returns a path with the id passed through `encodeURIComponent`.
- [x] **AC-5** — **Given** the API returns `404` for a request carrying an `accountId`,
  **When** `client.get` handles the response, **Then** the error message names the
  account not existing, the account not belonging to this key, and a `login` having
  been passed instead of `id` as the three possible causes, **And** it directs the
  caller to `list_accounts`'s `id` field.
- [x] **AC-6** — **Given** the API returns `409` and the call site supplied a
  `conflictMeans` string, **When** `client.get` handles the response, **Then** the
  error message carries that endpoint-supplied text rather than a generic conflict
  message.
- [x] **AC-7** — **Given** a tool registered through `registerReadTool`, **Then** it
  sets `readOnlyHint: true` and `openWorldHint: true` as constants (not a per-call
  parameter), **And** on success it returns `{ content, structuredContent }`, **And**
  on failure it returns `{ content, isError: true }` with no `structuredContent`,
  **And** the session is still alive after a failed call.
- [x] **AC-8** — **Given** `list_accounts` migrated onto `registerReadTool`, **Then**
  it behaves identically to its 0.1.0 shape — every existing `server.test.ts` assertion
  still passes unmodified.
- [x] **AC-9** — Table-driven tests cover every registered tool for: no API key
  leakage on any error branch, `structuredContent` validating against the tool's own
  `outputSchema`, and `readOnlyHint: true`.
- [x] **AC-10** — No file outside `src/server.ts` and `src/index.ts` imports a
  **runtime value** from `@modelcontextprotocol/*`; `core/tool.ts` and every tool
  module use `import type` only.
- [x] **AC-11** — `AGENTS.md` and `EPIC-2` state 10 `GET` + 7 `POST` and nine read
  operations remaining; `AGENTS.md`'s repo-structure section describes the new
  `core/` + `tools/<tag>/` layout.
- [x] **AC-12** — `CONTEXT.md` gains three entries: **D8** the directory structure
  (reversing the flat-layout rule), **D9** `registerReadTool`, **D10** the
  payload-shaping policy.
- [x] **AC-13** — `SETUP.md`, `.env.example`, and `README.md` list all five read
  scopes (`accounts:read`, `brokers:read`, `strategies:read`, `performance:read`,
  `trading:read`), not just `accounts:read`.
- [x] **AC-14** — `EPIC-3.md` exists with `status: backlog`, listing the seven write
  operations and the guardrails, and no stories. (Amended from this AC's original
  `status: planned` — see Implementation notes: `planned` is not a member of this
  repo's `epicSchema`, which allows only `backlog | in-progress | done`; `backlog` is
  the schema-valid equivalent for an epic with no stories opened yet.)

## Tasks

- [x] **TASK-2.4.1** — Sprint W33 scaffolding and the operation-count correction
  (plan Task 1) (AC: 11, 14)
  - [x] Open `sprint-2026-W33.md`, this story and its five siblings, `EPIC-3.md`
  - [x] Correct the operation count in `AGENTS.md` and `EPIC-2.md`
- [x] **TASK-2.4.2** — Move `client` and `errors` into `src/core/` (plan Task 2)
  (AC: 1, 2, 8)
- [x] **TASK-2.4.3** — Query-parameter support in `core/client.ts` (plan Task 3)
  (AC: 3)
- [x] **TASK-2.4.4** — `accountPath` — the only path builder (plan Task 4) (AC: 4)
- [x] **TASK-2.4.5** — Dedicated `404` and `409` branches (plan Task 5) (AC: 5, 6)
- [x] **TASK-2.4.6** — `core/tool.ts` and `core/parse.ts` — the registration and
  validation helpers (plan Task 6) (AC: 7, 10)
- [x] **TASK-2.4.7** — Move accounts into `tools/accounts/` and migrate onto the
  helper (plan Task 7) (AC: 1, 8, 10)
- [x] **TASK-2.4.8** — Table-driven invariant tests (plan Task 8) (AC: 9)
- [x] **TASK-2.4.9** — Scope documentation, CONTEXT decisions, and the 0.2.0 release
  (plan Task 9) (AC: 11, 12, 13)

## Dev notes

### Architecture constraints

- **The dependency edge is one-way: `core/` never imports from `tools/`.** That is
  what keeps `core/` testable without constructing a tool. AC-2 is enforced by grep,
  not by review.
- **`accountPath` validates against a character class, not a UUID pattern.** The
  OpenAPI document declares `accountId` as a bare `type: string` with no `format` or
  `pattern`, so hard-coding a UUID assumption would take every account-scoped tool
  down the day Senti issues an id in another shape. The class
  `/^[A-Za-z0-9_-]{1,64}$/` rejects everything that makes concatenation dangerous —
  `/`, `.`, `%`, whitespace, the empty string — without asserting a format the API
  never promised, and `encodeURIComponent` still runs behind it. See design spec
  §Substrate.
- **`registerReadTool` sets its annotations as constants, not parameters.** That is a
  mechanical barrier against a write tool reaching this server before EPIC-3 opens —
  there is no code path through the helper that can set `readOnlyHint: false`.
- **This story does NOT introduce new AD entries** in the ARCHITECTURE.md sense (this
  repo has no `ARCHITECTURE.md` yet, per [docs/README.md](../../README.md)'s absence
  table); the directory-structure reversal and the two helper functions are recorded
  as CONTEXT D8–D10 instead (AC-12).

### Cross-story dependencies

- **Builds on** [US-2.1](US-2.1-authenticated-senti-api-client.md) — extends
  `client.ts`, `Config`, and `describeError` rather than replacing them.
- **Builds on** [US-2.2](US-2.2-list-accounts-tool.md) — `list_accounts` is the
  migration target that proves the new substrate reproduces old behaviour exactly.
- **Required by** all five tool stories this sprint —
  [US-2.5](US-2.5-list-brokers-tool.md) through
  [US-2.9](US-2.9-list-pending-orders-tool.md) — every one of them registers through
  `registerReadTool`, and from US-2.7 onward through `accountPath` and the `404`
  branch this story builds.
- **Sibling of nothing.** No other story touches `core/` this sprint.

### What we explicitly did NOT do

- **No descriptor-table abstraction.** The v1 spec deferred that decision to "when
  the repetition is real"; the repetition that turned out to be real is the
  mechanical `try`/`catch`, not the descriptions and schemas that decide whether a
  model picks the right tool — so `registerReadTool` is a thin helper, not a
  registry. See design spec, Decisions taken §4.
- **No automatic `login` → `id` resolution server-side.** Rejected in the design
  spec: it adds a hidden request to every call, a cache that can go stale, and it
  hides a mistake the model corrects itself in one turn once the `404` message says
  the right thing.
- **No further read tools land in this story.** It ships zero new tools by design,
  mirroring the precedent US-2.1 set for v0.1.0 — substrate first, tool second.

### References

- [Source: read-tool expansion design spec §Repo structure](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [Source: read-tool expansion design spec §Substrate](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [Source: read-tool expansion design spec §Documentation obligations](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [Source: EPIC-2 §Cross-cutting invariants](../epics/EPIC-2.md)
- [Source: CONTEXT D1, D5](../../CONTEXT.md) — the amend-via-CONTEXT precedent this
  story follows for the v1 design spec
- [Source: read-tools-w33 implementation plan, Tasks 1–9](../../superpowers/plans/2026-08-06-senti-read-tools-w33.md)

## Verification commands

| AC | Command |
|---|---|
| AC-1 | `npm test && npm run typecheck && npm run build` |
| AC-2 | `grep -rl "tools/" src/core/` returns no files |
| AC-3 | `npm test -- src/core/client.test.ts` |
| AC-4 | `npm test -- src/core/client.test.ts -t accountPath` |
| AC-5 | `npm test -- src/core/client.test.ts -t 404` |
| AC-6 | `npm test -- src/core/client.test.ts -t 409` |
| AC-7 | `npm test -- src/core/tool.test.ts` |
| AC-8 | `npm test -- src/server.test.ts` |
| AC-9 | `npm test -- src/server.test.ts -t "invariants"` (the describe block's actual name; covers all three clauses, including the generalized `outputSchema` test added by TASK-2.4.9 — see Implementation notes) |
| AC-10 | `grep -rln '@modelcontextprotocol' src/` returns only `src/server.ts`, `src/index.ts`, and test clients; `grep -L "^import type" src/core/tool.ts src/tools/**/*.ts` returns nothing |
| AC-11 | `grep -n "10 GET\|7 POST\|nine read" AGENTS.md docs/sprints/epics/EPIC-2.md` |
| AC-12 | `grep -c "^### D" docs/CONTEXT.md` → 9 |
| AC-13 | `grep -c "brokers:read\|strategies:read\|performance:read\|trading:read" docs/SETUP.md .env.example README.md` — each ≥ 1 |
| AC-14 | `test -f docs/sprints/epics/EPIC-3.md && grep "status: backlog" docs/sprints/epics/EPIC-3.md` (amended from `status: planned` — see AC-14 and Implementation notes) |

## Changelog entry

### Added
- `src/core/` — `client.ts`, `errors.ts`, `tool.ts`, `parse.ts`, each with its own
  test file. `client.get` gains a `query` option, `accountPath`, and dedicated `404`
  and `409` branches. `registerReadTool` absorbs the per-tool registration
  boilerplate.
- `src/tools/accounts/list-accounts.ts` — the accounts domain, migrated from
  `src/accounts.ts` onto `registerReadTool` with no behaviour change.

### Changed
- Repo layout: `src/` splits into `core/` (infrastructure, never imports `tools/`)
  and `tools/<tag>/` (one folder per API tag).
- `list_accounts` now registers through `registerReadTool`.

### Fixed
- `AGENTS.md` and `EPIC-2` corrected: the API is 10 `GET` + 7 `POST`; nine read
  operations remain, not sixteen.

## Implementation notes

This story executed as nine tasks across nine separate work sessions (Tasks 1–9 of the
[implementation plan](../../superpowers/plans/2026-08-06-senti-read-tools-w33.md)); this
final task closed the story. Two bookkeeping corrections surfaced during closure, both
resolved here rather than left as known-false ticked boxes.

### AC-9 resolution: generalized clause 2 into the table (option a)

AC-9 has three clauses: (1) no API key leakage on any error branch, (2)
`structuredContent` validating against the tool's own `outputSchema`, and (3)
`readOnlyHint: true`. TASK-2.4.8 shipped (1) and (3) as table-driven tests covering
every registered tool via `TOOL_CALLS`, but (2) existed only as a per-tool assertion in
the `describe('MCP server', …)` block —
`AccountsOutputSchema.safeParse(result.structuredContent).success` for `list_accounts`
alone. Ticking AC-9 as originally written would have been false for a third of it.

Two ways to close that gap were on the table: (a) generalize clause 2 into `TOOL_CALLS`
by giving each row an `outputSchema` and a `successBody`, and add one more table test;
or (b) amend AC-9 to state that clause 2 is per-tool by design, confirming the
`list_accounts` assertion still exists.

**Chosen: (a).** `TOOL_CALLS` in `src/server.test.ts` now carries `outputSchema` and
`successBody` per row (`successBody` is the raw HTTP JSON a stubbed `fetch` returns —
the shape the real API sends — which necessarily differs per tool, hence two new
fields rather than one shared fixture). A new test,
`"every tool's structuredContent validates against its own outputSchema"`, stubs
`fetch` to return each row's `successBody`, calls the tool, and asserts
`result.structuredContent` parses against that row's `outputSchema`. This makes clause
2 automatic for the nine tools still to land this sprint and next, the same way
TASK-2.4.8 already made clauses 1 and 3 automatic — a future tool story that forgets
to add a row fails `"the table lists every registered tool"` immediately, and one that
adds a row with the wrong `outputSchema`/`successBody` pairing fails the new test
rather than shipping unchecked. The cost is real but small: every future `TOOL_CALLS`
row needs two more fields than before, which each tool story's own fixture data
(`ACCOUNT`-style constants already exist per test file) already provides.

This does not reopen [D9](../../CONTEXT.md)'s "no descriptor table" ruling. D9 is about
*registration* — the tool's name, description, and schemas staying hand-written per
module so a model's tool-selection surface is never flattened into data a generic loop
could silently mishandle. `TOOL_CALLS` is a *test* fixture that never reaches a model
or a client; it exists purely to drive the invariant test, so extending it carries none
of D9's cost.

`npx vitest run src/server.test.ts` went from 14 to 15 passing tests
(`src/server.test.ts` alone) with this addition; the new test passes on the first run
because it asserts a property `registerReadTool` (TASK-2.4.6) and `list-accounts.ts`
(TASK-2.4.7) already upheld — a regression net, like the rest of TASK-2.4.8's suite,
not a red-green cycle.

### A second, smaller correction: AC-14's `status: planned`

TASK-2.4.1's own fix round (recorded in that task's report) already established that
`status: planned` is not a member of this repo's `epicSchema` (`backlog | in-progress |
done`), and substituted `status: backlog` for `EPIC-3.md` — the schema-valid state for
an epic with no stories opened yet. That fix landed in `EPIC-3.md` itself, but AC-14's
own text and its verification-table row were never updated to match, so ticking AC-14
as originally worded would have asserted a string (`status: planned`) that does not
exist in the file. Both are corrected above to `status: backlog`, with a one-line
pointer to the reason; `EPIC-3.md` itself is unchanged (it already reads
`status: backlog`, unmodified since Task 1).

### TASK-2.4.1's checkbox

TASK-2.4.1's work (opening the sprint file, this story and its five siblings,
`EPIC-3.md`, and correcting the operation count in `AGENTS.md` and `EPIC-2.md`) was
completed and committed in Task 1 (`335f53f`, per that task's report) — before this
story file existed to tick its own box in. The checkbox lagged the work by
construction: Task 1 authored this story from a template with the box unchecked, and
no later task revisited its own bootstrapping step. It is ticked now, alongside its two
sub-items, since the work it describes has been true since Task 1 landed.

### Version bump and doc updates (this task's own work)

`VERSION`, `package.json`, and `src/config.ts`'s `SERVER_VERSION` all moved to
`0.2.0`; `src/config.test.ts`'s drift check passed unmodified. `docs/SETUP.md`,
`.env.example`, and `README.md` were extended to name all five read scopes
(`accounts:read`, `brokers:read`, `strategies:read`, `performance:read`,
`trading:read`) and to state the failure mode explicitly — no key-introspection
endpoint means a missing scope surfaces only as a `403` naming it when the affected
tool is first called, with every other tool unaffected — and to note that only
`accounts:read` is exercised by a shipped tool today. `docs/CONTEXT.md` gained D8
(directory structure), D9 (`registerReadTool`/`parseOrThrow` over a descriptor table),
and D10 (payload shaping), each read against two existing entries (D5, D6) first to
match the register. `docs/CHANGELOG.md` gained the `[0.2.0]` section with no commit
SHA (RULE-2). `docs/sprints/epics/EPIC-2.md`'s story index row for US-2.4 was flipped
from `📋 backlog` to `✅ done (v0.2.0)` for consistency with this story's own closure —
not in Task 9's literal file list, but the same update US-2.3 made to EPIC-2 when it
closed the v0.1.0 stories, and leaving it stale would have made the epic table
contradict this story file. `sprint-2026-W33.md`'s scope table row for US-2.4 was
updated the same way; the sprint's own `status: in-progress` is unchanged since five
sibling stories remain open.

## Files modified

**Modified (version):**
- `VERSION`, `package.json`, `src/config.ts` — `0.1.0` → `0.2.0`

**Modified (AC-9 option (a)):**
- `src/server.test.ts` — `TOOL_CALLS` gained `outputSchema` and `successBody` fields;
  one new table-driven test for clause 2

**Modified (five-scope documentation):**
- `docs/SETUP.md` — prerequisites table, environment section (comment block + new
  "Five scopes, not one" note), troubleshooting table, cross-references
- `.env.example` — `SENTI_API_KEY` comment block
- `README.md` — Requirements section

**Modified (CONTEXT and CHANGELOG):**
- `docs/CONTEXT.md` — appended `## Phase 3 — Read-tool expansion (2026-08-06)` with
  D8, D9, D10
- `docs/CHANGELOG.md` — added the `[0.2.0]` section above `[0.1.0]`, below
  `[Unreleased]`

**Modified (story closure and Active Context):**
- `docs/sprints/stories/US-2.4-tool-substrate-and-layout.md` — this file: frontmatter
  (`status: done`, `version_shipped: 0.2.0`), all AC and task boxes, AC-9 and AC-14
  verification rows, this section
- `docs/sprints/sprint-2026-W33.md` — US-2.4's scope-table row → `✅ done`
- `docs/sprints/epics/EPIC-2.md` — US-2.4's story-index row → `✅ done (v0.2.0)`
- `CLAUDE.md` — Active Context block refreshed (sprint W33 in progress, US-2.4 closed,
  next up US-2.5, Last Version 0.2.0, D8–D10 in Recent Decisions)
- `docs/sprints/STATUS.md` — regenerated by `npm run agile:status` (RULE-5, never
  hand-edited)

**Not modified:** `commit:` is deliberately absent from this story's frontmatter —
RULE-2 forbids `--amend`-ing a commit's own SHA into its own commit; a follow-up commit
backfills it, the same way [US-2.3](US-2.3-live-smoke-test-and-readme.md) records
having done for US-2.1–2.3 after the v0.1.0 release.

## Cross-references

- [Epic EPIC-2](../epics/EPIC-2.md) · [EPIC-3](../epics/EPIC-3.md)
- [sprint-2026-W33](../sprint-2026-W33.md)
- [CHANGELOG](../../CHANGELOG.md)
- [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [CONTEXT D1, D5](../../CONTEXT.md)
