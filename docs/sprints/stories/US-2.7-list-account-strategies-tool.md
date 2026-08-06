---
id: US-2.7
title: "list_account_strategies tool"
epic: EPIC-2
status: backlog
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

- [ ] **AC-1** — **Given** a call with `accountId`, **When** the request is built,
  **Then** the path is constructed via `accountPath` — never by string concatenation.
- [ ] **AC-2** — **Given** a traversal payload (`../`, `..%2F..%2Fadmin`, or similar)
  passed as `accountId`, **When** the tool runs, **Then** `accountPath` rejects it and
  **no HTTP request is made**.
- [ ] **AC-3** — The tool description names `list_accounts`.`id` as the source of
  `accountId` and states that `login` is rejected.
- [ ] **AC-4** — **Given** a `404` response, **When** the tool returns, **Then** the
  error text carries the `login`/`id` hint from `core/client.ts`'s dedicated `404`
  branch ([US-2.4](US-2.4-tool-substrate-and-layout.md) AC-5).
- [ ] **AC-5** — **Given** an account with no deployed strategies, **When** the list is
  formatted, **Then** the output states this explicitly rather than returning an
  unexplained empty list.
- [ ] **AC-6** — **Given** a `403` from the API, **When** the tool returns, **Then**
  `isError` is true and the text names the `strategies:read` scope.

## Tasks

- [x] **TASK-2.7.1** — `tools/strategies/list-account-strategies.ts` domain module
  (plan Task 14) (AC: 1, 3, 5)
  - [x] `AccountStrategySchema`, `parseAccountStrategies`, `formatAccountStrategies`
- [ ] **TASK-2.7.2** — Registration, the first path parameter, and the 0.5.0 release
  (plan Task 15) (AC: 1, 2, 4, 6)
  - [ ] Register through `registerReadTool`; `inputSchema` carrying `accountId`; build
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
| AC-2 | `npm test -- src/tools/strategies/list-account-strategies.test.ts -t traversal` |
| AC-4 | `npm test -- src/server.test.ts -t "list_account_strategies.*404"` |
| AC-6 | `npm test -- src/server.test.ts -t "list_account_strategies.*403"` |

## Changelog entry

### Added
- `src/tools/strategies/list-account-strategies.ts` — the `list_account_strategies`
  tool: `AccountStrategySchema`, `parseAccountStrategies`, `formatAccountStrategies`,
  the first tool routed through `accountPath`.

## Implementation notes

Not yet started — filled in when this story moves to `in-progress`.

## Files modified

Not yet started — filled in when this story moves to `in-progress`.

## Cross-references

- [Epic EPIC-2](../epics/EPIC-2.md)
- [sprint-2026-W33](../sprint-2026-W33.md)
- [CHANGELOG](../../CHANGELOG.md)
- [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [US-2.4](US-2.4-tool-substrate-and-layout.md) · [US-2.6](US-2.6-list-strategies-tool.md)
