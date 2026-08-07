---
id: US-2.5
title: "list_brokers tool"
epic: EPIC-2
status: done
version_shipped: 0.3.0
priority: P1
points: 2
sprint: sprint-2026-W33
assignee: bluezdot
created: 2026-08-06
updated: 2026-08-06
---

## Goal

A user, or the model acting for them, asks "which brokers does Senti support, and what
account types can I open" before ever connecting an account. `list_brokers` answers from
the platform catalog — `GET /api/v1/brokers` — so that question no longer needs a
support ticket or a guess. It is the first tool built on the substrate US-2.4 shipped,
and deliberately the simplest one: no path parameter, no query parameter, nothing to
get wrong except the registration itself.

## Background

Per the [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
§Tool surface, `list_brokers` reads `GET /api/v1/brokers` under the `brokers:read`
scope and returns `tools/brokers/list-brokers.ts`. The design spec calls out one
description risk by name: **`list_brokers` must state that it is platform-wide**,
because without that sentence a model reads it as "the brokers I use" rather than "the
brokers Senti supports," and answers confidently from the wrong premise — the same
failure mode US-2.2's `list_accounts` avoided by naming `id` over `login` in its own
description. A broker's `servers` and `accountTypes` are both nested arrays the API
returns per broker; dropping either from the text summary would silently narrow what
a model can answer about a broker it is looking at.

## Acceptance criteria

- [x] **AC-1** — **Given** a successful call, **When** the result is returned, **Then**
  `structuredContent` is an object with a `brokers` key (never a bare array), **And**
  it validates against the tool's own `outputSchema`.
- [x] **AC-2** — The tool description states that the catalog is platform-wide — the
  brokers Senti supports, not the user's linked accounts. Asserted on the description
  text.
- [x] **AC-3** — **Given** a broker with `servers` and `accountTypes` arrays, **When**
  the list is formatted, **Then** both render in the text summary for that broker.
- [x] **AC-4** — **Given** an empty broker list, **When** it is formatted, **Then** the
  output explains itself rather than returning nothing, following the precedent
  `list_accounts` set in [US-2.2](US-2.2-list-accounts-tool.md) AC-8.
- [x] **AC-5** — **Given** a `403` from the API, **When** the tool returns, **Then**
  `isError` is true and the text names the `brokers:read` scope.

## Tasks

- [x] **TASK-2.5.1** — `tools/brokers/list-brokers.ts` domain module (plan Task 10)
  (AC: 1, 3, 4)
  - [x] `BrokerSchema`, `parseBrokers` (via `core/parse.ts`'s `parseOrThrow`),
        `formatBrokers`
- [x] **TASK-2.5.2** — Registration and the 0.3.0 release (plan Task 11) (AC: 2, 5)
  - [x] Register through `registerReadTool` in `server.ts`; `outputSchema`;
        `scope: 'brokers:read'`; platform-wide sentence in the description

## Dev notes

### Architecture constraints

- Registers through `registerReadTool` ([US-2.4](US-2.4-tool-substrate-and-layout.md))
  — no bespoke `try`/`catch`, no bespoke annotation block.
- **No path parameter.** `GET /api/v1/brokers` takes no `accountId`, so `accountPath`
  does not apply here; this story proves the substrate on the simplest possible shape
  before [US-2.7](US-2.7-list-account-strategies-tool.md) has to prove it on the
  first one that does.

### Cross-story dependencies

- **Builds on** [US-2.4](US-2.4-tool-substrate-and-layout.md) — uses
  `registerReadTool`, `core/parse.ts`'s `parseOrThrow`, and `core/client.ts`'s `get`.
- **Sibling of** [US-2.6](US-2.6-list-strategies-tool.md) — both are platform-wide
  catalog tools with no path parameter shipping the same week; the "platform-wide, not
  yours" description language should read consistently across both.

### What we explicitly did NOT do

- **No filtering or search parameters.** `GET /api/v1/brokers` takes none per the
  OpenAPI document; inventing one would produce a silently ignored argument.
- **No cross-reference to `list_accounts`.** This catalog has nothing to do with the
  user's linked accounts; unlike the account-scoped tools, there is no `login`/`id`
  confusion to guard against here.

### References

- [Source: design spec §Tool surface](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md) — `list_brokers` row
- [Source: design spec, "Two descriptions carry weight beyond documentation"](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [Source: EPIC-2 §Cross-cutting invariants](../epics/EPIC-2.md) — empty states explain themselves
- [Source: read-tools-w33 implementation plan, Tasks 10–11](../../superpowers/plans/2026-08-06-senti-read-tools-w33.md)

## Verification commands

| AC | Command |
|---|---|
| AC-1, AC-3, AC-4 | `npm test -- src/tools/brokers/list-brokers.test.ts` |
| AC-2 | `npm test -- src/server.test.ts -t list_brokers` — asserts description text |
| AC-5 | `npm test -- src/server.test.ts -t "list_brokers.*403"` |

## Changelog entry

### Added
- `src/tools/brokers/list-brokers.ts` — the `list_brokers` tool: `BrokerSchema`,
  `parseBrokers`, `formatBrokers`, registered read-only via `registerReadTool`.

## Implementation notes

TASK-2.5.2 (plan Task 11) closed this story. Following the TDD cycle: a `list_brokers`
`describe` block and a `list_brokers` row in `TOOL_CALLS` were appended to
`src/server.test.ts` first, confirmed to fail (`Tool list_brokers not found`, plus two
assertions against an `undefined` tool), then `registerListBrokers` was appended to
`src/tools/brokers/list-brokers.ts` (TASK-2.5.1's domain module from Task 10) verbatim
per the plan, and wired into `src/server.ts` alongside `registerListAccounts`.

**One gap in the plan, resolved here.** Registering a second tool broke two
pre-existing single-tool assumptions in `src/server.test.ts` that neither the story nor
plan Task 11 called out: `'exposes exactly the list_accounts tool'` asserted
`tools.map(...).toEqual(['list_accounts'])`, and `'keeps the session alive after a
failed call'` asserted `tools.toHaveLength(1)`. Both are artifacts of the single-tool
v0.1.0/v0.2.0 era, now stale by construction the moment a second tool registers — not a
defect in either test's original intent. Reproduced directly: `npm test` after wiring
`registerListBrokers` into `server.ts` failed exactly these two, with `list_brokers`
correctly appearing in `tools`. Resolved by updating both to expect two tools: the
first renamed to `'exposes exactly the registered tools'` and its expectation extended
to `['list_accounts', 'list_brokers']`; the second's length assertion changed to `2`.
Neither test's actual invariant (the tool list is exhaustive; the session survives a
failed call) changed — only the now-stale cardinality.

> **Correction (Fix round 1):** the sentence originally here claimed this per-story
> test "does not need touching again as later stories in this sprint add more tools."
> That was false as written — review caught it before it could bite. `'exposes exactly
> the registered tools'` was still a hardcoded literal array, so it would have needed
> a manual edit on every one of Tasks 13/15/17/19, exactly the hand-maintenance burden
> the rest of this sprint's substrate work (`TOOL_CALLS`, the invariant tests) exists to
> avoid. See the **Fix round 1** section below for what actually shipped instead: the
> hardcoded test was deleted as a genuine duplicate of `'the table lists every
> registered tool'` (US-2.4/AC-9), which already asserts the same set,
> self-maintainingly, against `TOOL_CALLS`.

`npx vitest run src/server.test.ts -t 'list_brokers'` went from 15 passing / 4 failing
before implementation to all passing after. The full suite went from 114 passed / 1
skipped (per this task's brief) to 118 passed / 1 skipped: 4 new `list_brokers` tests,
with the two corrected pre-existing tests still counted once each (not added).

Released `0.3.0`: `VERSION`, `package.json`, and `src/config.ts`'s `SERVER_VERSION`
all moved in lockstep; `config.test.ts`'s drift check passed unmodified.
`docs/CHANGELOG.md` gained the `[0.3.0]` section above `[0.2.0]`, matching that
entry's register (a one-paragraph frame, then `### Added`/`### Changed`). `README.md`
gained a `list_brokers` row in the tool table; `brokers:read` was already listed in
the scope requirement from 0.2.0 and was left alone rather than duplicated, per the
task brief. Two README sentences that were accurate at 0.2.0 but became stale at
0.3.0 were also updated for consistency: the "only `accounts:read` is exercised"
line now names both `accounts:read`/`list_accounts` and `brokers:read`/`list_brokers`,
and the "Restart the client" line now names both tools.

### Fix round 1 (review correction)

Review on the task-11 closure confirmed both test edits above were legitimate — the
old assertions genuinely needed updating, not loosening — but flagged two
forward-looking problems with *how* they were fixed, plus the false claim quoted
above. Both fixes landed in `src/server.test.ts` only; no production code changed.

1. **`'exposes exactly the registered tools'` was a hardcoded duplicate.** It asserted
   a literal `['list_accounts', 'list_brokers']` array — a magic value that would need
   hand-editing on every one of Tasks 13/15/17/19 as more tools register, and it
   asserted nothing that `'the table lists every registered tool'`
   (`describe('invariants across every registered tool', …)`, US-2.4/AC-9) does not
   already cover: that test does a **sorted** comparison of the live tool set against
   `TOOL_CALLS`, so it proves set-equality — the same property, self-maintainingly,
   because it grows with each story's new `TOOL_CALLS` row instead of needing a
   separate hand-edit. The only thing the deleted test additionally asserted was
   **order** (an unsorted array-equality), which is not a stated invariant anywhere
   else in this repo and is not relied on by any test that isn't already independently
   fragile in the same way (`tools[0]` in three of the `describe('MCP server', …)`
   tests, pre-existing and out of this story's scope). **Chosen: delete**, not derive
   — deriving it would have produced a near-duplicate of the US-2.4 test (`tools.map(t
   => t.name)` vs. `TOOL_CALLS.map(c => c.name)`, unsorted instead of sorted) for no
   invariant not already covered.
2. **`'keeps the session alive after a failed call'` hardcoded a tool count as a proxy
   for its real intent.** The test is about the session surviving a failed call, not
   about how many tools are registered, so a literal `toHaveLength(2)` would need
   bumping on every future tool story for a reason unrelated to what the test claims
   to check. Rewritten to capture `listTools()` **before** the failing call and
   compare it against `listTools()` **after** — the assertion is now that the
   registered set is unchanged by a failed call, with no tool count anywhere in the
   test.

**Proof the rewritten assertions still bite** (both mutations applied and reverted;
`git diff` confirmed clean before proceeding — see Verification commands):
- Commenting out `registerListBrokers(server, client)` in `src/server.ts` turned
  `'the table lists every registered tool'` red:
  `AssertionError: expected [ 'list_accounts' ] to deeply equal [ 'list_accounts', 'list_brokers' ]`
  (three other tests that call `list_brokers` directly also failed, as expected).
  Restored; full suite green again.
- Removing the `try`/`catch` in `core/tool.ts` so a failing call's rejection escapes
  the handler **did not** kill the session — `@modelcontextprotocol/server`'s own
  `registerTool` wrapper catches the unhandled rejection upstream and returns a
  JSON-RPC error response, so `'keeps the session alive after a failed call'` still
  passed under this mutation. This is a useful finding in its own right (the SDK
  carries a second layer of resilience behind `registerReadTool`'s own `try`/`catch`),
  but it meant this mutation could not demonstrate the new assertion biting. Restored,
  then tried a mutation that does genuinely kill the session: calling `client.close()`
  between the failing tool call and the second `listTools()`. That turned the test red
  — `AssertionError: expected [] to deeply equal [ 'list_accounts', 'list_brokers' ]`
  (a closed client's `listTools()` resolves to `[]` with a console warning rather than
  rejecting, but the before/after comparison still catches it). Restored; full suite
  green again.

Full suite after fix round 1: **117 passed, 1 skipped** (118 total) — one test file
(`src/server.test.ts`) has 18 tests, down from 19, since one hardcoded duplicate was
deleted and no new test was added in its place. `npm run typecheck` passed clean.
Version stays `0.3.0` — this is a test-only correction to an already-shipped release,
not a new one.

## Files modified

**Modified (tool + registration):**
- `src/tools/brokers/list-brokers.ts` — appended `registerListBrokers`, `BROKERS_READ`,
  and the three new imports (`McpServer` type, `SentiClient` type, `registerReadTool`)
- `src/server.ts` — import and registration call for `registerListBrokers`

**Modified (tests):**
- `src/server.test.ts` — `BrokersOutputSchema` import, `BROKER` fixture, the
  `describe('list_brokers', …)` block (4 tests), the extended `TOOL_CALLS` table, and
  the two corrected pre-existing assertions described above
- `src/server.test.ts` (fix round 1) — `'exposes exactly the registered tools'`
  deleted as a hardcoded duplicate of the US-2.4 invariant test; `'keeps the session
  alive after a failed call'` rewritten to compare `listTools()` before/after instead
  of asserting a hardcoded tool count

**Modified (version):**
- `VERSION`, `package.json`, `src/config.ts` — `0.2.0` → `0.3.0`

**Modified (CHANGELOG and README):**
- `docs/CHANGELOG.md` — added the `[0.3.0]` section above `[0.2.0]`, below
  `[Unreleased]`
- `README.md` — `list_brokers` row in the tool table; two now-stale sentences updated
  (scope-exercise note, "Restart the client" note)

**Modified (story closure and Active Context):**
- `docs/sprints/stories/US-2.5-list-brokers-tool.md` — this file: frontmatter
  (`status: done`, `version_shipped: 0.3.0`), all AC and task boxes, this section
- `docs/sprints/sprint-2026-W33.md` — US-2.5's scope-table row → `✅ done`
- `docs/sprints/epics/EPIC-2.md` — US-2.5's story-index row → `✅ done (v0.3.0)`
- `CLAUDE.md` — Active Context block refreshed (US-2.5 closed, next up US-2.6, Last
  Version 0.3.0)
- `docs/sprints/STATUS.md` — regenerated by `npm run agile:status` (RULE-5, never
  hand-edited)

**Not modified:** `commit:` is deliberately absent from this story's frontmatter —
RULE-2 forbids `--amend`-ing a commit's own SHA into its own commit; a follow-up commit
backfills it later, the same precedent US-2.4's closure recorded.

## Cross-references

- [Epic EPIC-2](../epics/EPIC-2.md)
- [sprint-2026-W33](../sprint-2026-W33.md)
- [CHANGELOG](../../CHANGELOG.md)
- [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [US-2.4](US-2.4-tool-substrate-and-layout.md)
