---
id: US-2.4
title: "Tool substrate and directory layout"
epic: EPIC-2
status: backlog
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

- [ ] **AC-1** — **Given** the migration is complete, **Then** `src/core/` holds
  `client.ts`, `errors.ts`, `tool.ts`, and `parse.ts`, each with a co-located test file,
  **And** `src/tools/accounts/list-accounts.ts` holds the accounts domain module,
  **And** `npm test`, `npm run typecheck`, and `npm run build` all exit 0 with no
  behavioural change to `list_accounts`.
- [ ] **AC-2** — `core/` imports nothing from `tools/` — verified by grep, not by
  inspection.
- [ ] **AC-3** — **Given** a call to `client.get(path, { query })` where `query` mixes
  defined and `undefined` values, **When** the request is built, **Then** every
  `undefined` entry is dropped and the remaining entries are encoded via
  `URLSearchParams`.
- [ ] **AC-4** — **Given** `accountPath` is called with `../`, `..%2F..%2Fadmin`, the
  empty string, or a 65-character segment, **When** it validates the id, **Then** it
  throws rather than building a path. **Given** a normal id, **When** `accountPath`
  runs, **Then** it returns a path with the id passed through `encodeURIComponent`.
- [ ] **AC-5** — **Given** the API returns `404` for a request carrying an `accountId`,
  **When** `client.get` handles the response, **Then** the error message names the
  account not existing, the account not belonging to this key, and a `login` having
  been passed instead of `id` as the three possible causes, **And** it directs the
  caller to `list_accounts`'s `id` field.
- [ ] **AC-6** — **Given** the API returns `409` and the call site supplied a
  `conflictMeans` string, **When** `client.get` handles the response, **Then** the
  error message carries that endpoint-supplied text rather than a generic conflict
  message.
- [ ] **AC-7** — **Given** a tool registered through `registerReadTool`, **Then** it
  sets `readOnlyHint: true` and `openWorldHint: true` as constants (not a per-call
  parameter), **And** on success it returns `{ content, structuredContent }`, **And**
  on failure it returns `{ content, isError: true }` with no `structuredContent`,
  **And** the session is still alive after a failed call.
- [ ] **AC-8** — **Given** `list_accounts` migrated onto `registerReadTool`, **Then**
  it behaves identically to its 0.1.0 shape — every existing `server.test.ts` assertion
  still passes unmodified.
- [ ] **AC-9** — Table-driven tests cover every registered tool for: no API key
  leakage on any error branch, `structuredContent` validating against the tool's own
  `outputSchema`, and `readOnlyHint: true`.
- [ ] **AC-10** — No file outside `src/server.ts` and `src/index.ts` imports a
  **runtime value** from `@modelcontextprotocol/*`; `core/tool.ts` and every tool
  module use `import type` only.
- [ ] **AC-11** — `AGENTS.md` and `EPIC-2` state 10 `GET` + 7 `POST` and nine read
  operations remaining; `AGENTS.md`'s repo-structure section describes the new
  `core/` + `tools/<tag>/` layout.
- [ ] **AC-12** — `CONTEXT.md` gains three entries: **D7** the directory structure
  (reversing the flat-layout rule), **D8** `registerReadTool`, **D9** the
  payload-shaping policy.
- [ ] **AC-13** — `SETUP.md`, `.env.example`, and `README.md` list all five read
  scopes (`accounts:read`, `brokers:read`, `strategies:read`, `performance:read`,
  `trading:read`), not just `accounts:read`.
- [ ] **AC-14** — `EPIC-3.md` exists with `status: planned`, listing the seven write
  operations and the guardrails, and no stories.

## Tasks

- [ ] **TASK-2.4.1** — Sprint W33 scaffolding and the operation-count correction
  (plan Task 1) (AC: 11, 14)
  - [ ] Open `sprint-2026-W33.md`, this story and its five siblings, `EPIC-3.md`
  - [ ] Correct the operation count in `AGENTS.md` and `EPIC-2.md`
- [x] **TASK-2.4.2** — Move `client` and `errors` into `src/core/` (plan Task 2)
  (AC: 1, 2, 8)
- [x] **TASK-2.4.3** — Query-parameter support in `core/client.ts` (plan Task 3)
  (AC: 3)
- [ ] **TASK-2.4.4** — `accountPath` — the only path builder (plan Task 4) (AC: 4)
- [ ] **TASK-2.4.5** — Dedicated `404` and `409` branches (plan Task 5) (AC: 5, 6)
- [ ] **TASK-2.4.6** — `core/tool.ts` and `core/parse.ts` — the registration and
  validation helpers (plan Task 6) (AC: 7, 10)
- [ ] **TASK-2.4.7** — Move accounts into `tools/accounts/` and migrate onto the
  helper (plan Task 7) (AC: 1, 8, 10)
- [ ] **TASK-2.4.8** — Table-driven invariant tests (plan Task 8) (AC: 9)
- [ ] **TASK-2.4.9** — Scope documentation, CONTEXT decisions, and the 0.2.0 release
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
  as CONTEXT D7–D9 instead (AC-12).

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
| AC-9 | `npm test -- src/server.test.ts -t "table-driven"` |
| AC-10 | `grep -rln '@modelcontextprotocol' src/` returns only `src/server.ts`, `src/index.ts`, and test clients; `grep -L "^import type" src/core/tool.ts src/tools/**/*.ts` returns nothing |
| AC-11 | `grep -n "10 GET\|7 POST\|nine read" AGENTS.md docs/sprints/epics/EPIC-2.md` |
| AC-12 | `grep -c "^### D" docs/CONTEXT.md` → 9 |
| AC-13 | `grep -c "brokers:read\|strategies:read\|performance:read\|trading:read" docs/SETUP.md .env.example README.md` — each ≥ 1 |
| AC-14 | `test -f docs/sprints/epics/EPIC-3.md && grep "status: planned" docs/sprints/epics/EPIC-3.md` |

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

Not yet started — filled in when this story moves to `in-progress`.

## Files modified

Not yet started — filled in when this story moves to `in-progress`.

## Cross-references

- [Epic EPIC-2](../epics/EPIC-2.md) · [EPIC-3](../epics/EPIC-3.md)
- [sprint-2026-W33](../sprint-2026-W33.md)
- [CHANGELOG](../../CHANGELOG.md)
- [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [CONTEXT D1, D5](../../CONTEXT.md)
