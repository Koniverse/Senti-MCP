---
id: US-2.6
title: "list_strategies tool"
epic: EPIC-2
status: done
version_shipped: 0.4.0
priority: P1
points: 2
sprint: sprint-2026-W33
assignee: bluezdot
created: 2026-08-06
updated: 2026-08-06
---

## Goal

A user asks "what trading strategies (EAs) does Senti offer" before deploying one to an
account. `list_strategies` answers from the platform catalog — `GET /api/v1/strategies`
— the same class of question `list_brokers` answers for brokers, and the second and
last no-path-parameter tool this sprint. Getting its "platform-wide" framing right here
also protects [US-2.7](US-2.7-list-account-strategies-tool.md), which ships the
user-scoped sibling of this exact catalog next.

## Background

Per the [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
§Tool surface, `list_strategies` reads `GET /api/v1/strategies` under the
`strategies:read` scope and returns `tools/strategies/list-strategies.ts`. The design
spec names this tool explicitly alongside `list_brokers` as needing the platform-wide
sentence: **"a model reads `list_strategies` as 'the strategies I am running' and
answers confidently from the wrong catalog. The user-scoped answer is
`list_account_strategies`."** That contrast only holds if this story's description is
unambiguous about being the catalog, not the deployment list — the burden the next
story, US-2.7, does not have to carry alone. `description`, `supportedSymbols`, and
`supportedTimeframes` are optional fields per the API; `avgRating` is nullable, and
EPIC-2's *null is not zero* invariant applies here exactly as it did to
`lastKnownBalance` in `list_accounts` — a strategy with no ratings yet is not a
zero-rated strategy.

## Acceptance criteria

- [x] **AC-1** — **Given** a successful call, **When** the result is returned, **Then**
  `structuredContent` is an object with a `strategies` key, **And** it validates
  against the tool's own `outputSchema`.
- [x] **AC-2** — **Given** a strategy response omitting `description`,
  `supportedSymbols`, or `supportedTimeframes`, **When** it is parsed, **Then** the
  absence of any of the three is not a validation error.
- [x] **AC-3** — **Given** a null `avgRating`, **When** the entry is formatted,
  **Then** it renders as `—` and never as `0`.
- [x] **AC-4** — The tool description states that the catalog is platform-wide — every
  strategy Senti offers, not the ones deployed on the caller's accounts. Asserted on
  the description text.
- [x] **AC-5** — **Given** a `403` from the API, **When** the tool returns, **Then**
  `isError` is true and the text names the `strategies:read` scope.

## Tasks

- [x] **TASK-2.6.1** — `tools/strategies/list-strategies.ts` domain module
  (plan Task 12) (AC: 1, 2, 3)
  - [x] `StrategySchema` (optional `description`/`supportedSymbols`/
        `supportedTimeframes`, nullable `avgRating`), `parseStrategies`,
        `formatStrategies`
- [x] **TASK-2.6.2** — Registration and the 0.4.0 release (plan Task 13) (AC: 4, 5)
  - [x] Register through `registerReadTool`; `scope: 'strategies:read'`;
        platform-wide sentence in the description, phrased to contrast against
        `list_account_strategies`

## Dev notes

### Architecture constraints

- Registers through `registerReadTool` ([US-2.4](US-2.4-tool-substrate-and-layout.md)).
- **No path parameter**, same as [US-2.5](US-2.5-list-brokers-tool.md) — the second
  and last catalog-shaped tool before US-2.7 introduces `accountPath`.
- Null handling follows `list_accounts`'s `money()`-helper precedent: one formatting
  function decides how a null renders, so `—` cannot drift per call site.

### Cross-story dependencies

- **Builds on** [US-2.4](US-2.4-tool-substrate-and-layout.md) — `registerReadTool`,
  `parseOrThrow`, `client.get`.
- **Sibling of** [US-2.5](US-2.5-list-brokers-tool.md) — both platform-wide catalogs,
  same week.
- **Required by** [US-2.7](US-2.7-list-account-strategies-tool.md) — that story's
  description explicitly contrasts itself against this tool's catalog framing, so this
  story's wording is a dependency of US-2.7's AC, not just prose.

### What we explicitly did NOT do

- **No cross-linking or disambiguation logic between `list_strategies` and
  `list_account_strategies`.** The model reads both descriptions and picks; there is
  no server-side merge or redirect. Rejected for the same reason the design spec
  rejects automatic `login` → `id` resolution: it hides a mistake the model would
  otherwise correct itself.
- **No filtering or search parameters** — `GET /api/v1/strategies` takes none per the
  OpenAPI document.

### References

- [Source: design spec §Tool surface](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md) — `list_strategies` row
- [Source: design spec, "Two descriptions carry weight beyond documentation"](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [Source: EPIC-2 §Cross-cutting invariants](../epics/EPIC-2.md) — null is not zero
- [Source: read-tools-w33 implementation plan, Tasks 12–13](../../superpowers/plans/2026-08-06-senti-read-tools-w33.md)

## Verification commands

| AC | Command |
|---|---|
| AC-1, AC-2, AC-3 | `npm test -- src/tools/strategies/list-strategies.test.ts` |
| AC-4 | `npm test -- src/server.test.ts -t list_strategies` — asserts description text |
| AC-5 | `npm test -- src/server.test.ts -t "list_strategies.*403"` |

## Changelog entry

### Added
- `src/tools/strategies/list-strategies.ts` — the `list_strategies` tool:
  `StrategySchema`, `parseStrategies`, `formatStrategies`, registered read-only via
  `registerReadTool`.

## Implementation notes

TASK-2.6.2 (plan Task 13) closed this story. Before any change, `npm test` was run as
a baseline: **128 passed, 1 skipped (129 total)**, all green — TASK-2.6.1's domain
module (`StrategySchema`, `parseStrategies`, `formatStrategies`, from plan Task 12)
already existed and already had its own 11 passing tests in
`src/tools/strategies/list-strategies.test.ts`; only the registration was missing.

Following the TDD cycle: the `StrategiesOutputSchema` import, the `STRATEGY` fixture,
a `describe('list_strategies', …)` block (3 tests), and a `list_strategies` row in
`TOOL_CALLS` were appended to `src/server.test.ts` first. Running
`npx vitest run src/server.test.ts -t 'list_strategies'` confirmed red: 3 failed as
expected (`Tool list_strategies not found` on the two tests that call the tool, and
`.toMatch() expects to receive a string, but got undefined` on the description-text
test, since `tools.find(...)` returned `undefined`). Only then was
`registerListStrategies` appended to `src/tools/strategies/list-strategies.ts` — the
three new imports (`McpServer` type, `SentiClient` type, `registerReadTool`) plus the
function itself, verbatim per the brief and shaped exactly like
`registerListBrokers` in `src/tools/brokers/list-brokers.ts` — and wired into
`src/server.ts` alongside `registerListAccounts` and `registerListBrokers`.

**No pre-existing test broke.** Unlike US-2.5's registration (which hit two
single-tool assumptions that predated the `TOOL_CALLS` table), this task's brief noted
those were already de-hardcoded, and that held: `npm test` after wiring
`registerListStrategies` into `server.ts` passed every test on the first run, with no
edits needed to any test outside this task's own additions.

`npm test` after implementation: **131 passed, 1 skipped (132 total)** — 3 new
`list_strategies` tests in `src/server.test.ts`, no other file's test count changed.
`npm run typecheck` (`tsc --noEmit` against both `tsconfig.json` and
`tsconfig.test.json`) passed clean.

Released `0.4.0`: `VERSION`, `package.json`, and `src/config.ts`'s `SERVER_VERSION`
all moved in lockstep; `config.test.ts`'s drift check passed unmodified.
`docs/CHANGELOG.md` gained the `[0.4.0]` section above `[0.3.0]`, matching that
entry's register (a one-paragraph frame, then `### Added`/`### Changed`), and notes
that `description`, `supportedSymbols` and `supportedTimeframes` are optional in the
upstream schema per the brief. `README.md` gained a `list_strategies` row in the tool
table; the scope-exercise sentence now names all three shipped scopes
(`accounts:read`, `brokers:read`, `strategies:read`) and the two not yet exercised;
the "Restart the client" sentence now names all three tools.

## Files modified

**Modified (tool + registration):**
- `src/tools/strategies/list-strategies.ts` — appended `registerListStrategies`,
  `STRATEGIES_READ`, and the three new imports (`McpServer` type, `SentiClient` type,
  `registerReadTool`)
- `src/server.ts` — import and registration call for `registerListStrategies`

**Modified (tests):**
- `src/server.test.ts` — `StrategiesOutputSchema` import, `STRATEGY` fixture, the
  `describe('list_strategies', …)` block (3 tests), and the extended `TOOL_CALLS`
  table

**Modified (version):**
- `VERSION`, `package.json`, `src/config.ts` — `0.3.0` → `0.4.0`

**Modified (CHANGELOG and README):**
- `docs/CHANGELOG.md` — added the `[0.4.0]` section above `[0.3.0]`, below
  `[Unreleased]`
- `README.md` — `list_strategies` row in the tool table; the scope-exercise sentence
  and the "Restart the client" sentence updated to name all three shipped tools

**Modified (story closure and Active Context):**
- `docs/sprints/stories/US-2.6-list-strategies-tool.md` — this file: frontmatter
  (`status: done`, `version_shipped: 0.4.0`), all AC and task boxes, this section
- `docs/sprints/sprint-2026-W33.md` — US-2.6's scope-table row → `✅ done`
- `docs/sprints/epics/EPIC-2.md` — US-2.6's story-index row → `✅ done (v0.4.0)`
- `CLAUDE.md` — Active Context block refreshed (US-2.6 closed, next up US-2.7, Last
  Version 0.4.0)
- `docs/sprints/STATUS.md` — regenerated by `npm run agile:status` (RULE-5, never
  hand-edited)

**Not modified:** `commit:` is deliberately absent from this story's frontmatter —
RULE-2 forbids `--amend`-ing a commit's own SHA into its own commit; a follow-up
commit backfills it later, the same precedent US-2.4 and US-2.5's closures recorded.

## Cross-references

- [Epic EPIC-2](../epics/EPIC-2.md)
- [sprint-2026-W33](../sprint-2026-W33.md)
- [CHANGELOG](../../CHANGELOG.md)
- [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [US-2.4](US-2.4-tool-substrate-and-layout.md)
