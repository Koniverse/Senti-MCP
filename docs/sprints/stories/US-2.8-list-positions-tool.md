---
id: US-2.8
title: "list_positions tool"
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

- [ ] **AC-1** — **Given** a call with `accountId`, **When** the request is built,
  **Then** the path is constructed via `accountPath`.
- [ ] **AC-2** — **Given** the API returns `409`, **When** the tool returns, **Then**
  the text reports the terminal offline, using the endpoint's own `conflictMeans`
  text ([US-2.4](US-2.4-tool-substrate-and-layout.md) AC-6), **And** it explicitly
  distinguishes this from the account holding no positions.
- [ ] **AC-3** — **Given** a successful response with zero positions, **When** it is
  formatted, **Then** the output states that this is a real zero — the terminal
  answered and reported none — never conflated with the `409` case.
- [ ] **AC-4** — **Given** a position with `sl` or `tp` equal to `0`, **When** it is
  formatted, **Then** it renders as `—`, never as `0.00`.
- [ ] **AC-5** — **Given** more than 200 positions, **When** the list is formatted,
  **Then** it truncates at 200 rows, **And** `notes` records how many were dropped and
  how to ask for more.
- [ ] **AC-6** — **Given** a `403` from the API, **When** the tool returns, **Then**
  `isError` is true and the text names the `trading:read` scope.

## Tasks

- [x] **TASK-2.8.1** — `tools/trading/positions.ts` domain module (plan Task 16)
  (AC: 3, 4, 5)
  - [x] `PositionSchema`, `parsePositions`, `formatPositions` — `sl`/`tp` are
        non-nullable numbers where `0` means "not set" and renders as `—`, the same
        em-dash convention `list_accounts`' `money()` uses for `null`; the 200-row
        cap and `notes`
- [ ] **TASK-2.8.2** — Registration, the `409` branch, and the 0.6.0 release
  (plan Task 17) (AC: 1, 2, 6)
  - [ ] Register through `registerReadTool`; build the path via `accountPath`;
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
| AC-1 | `npm test -- src/tools/trading/positions.test.ts -t accountPath` |
| AC-2 | `npm test -- src/server.test.ts -t "list_positions.*409"` |
| AC-6 | `npm test -- src/server.test.ts -t "list_positions.*403"` |

## Changelog entry

### Added
- `src/tools/trading/positions.ts` — the `list_positions` tool: `PositionSchema`,
  `parsePositions`, `formatPositions`, a `409` terminal-offline branch distinguished
  from a real zero, and a 200-row truncation cap recorded in `notes`.

## Implementation notes

Not yet started — filled in when this story moves to `in-progress`.

## Files modified

Not yet started — filled in when this story moves to `in-progress`.

## Cross-references

- [Epic EPIC-2](../epics/EPIC-2.md)
- [sprint-2026-W33](../sprint-2026-W33.md)
- [CHANGELOG](../../CHANGELOG.md)
- [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [US-2.4](US-2.4-tool-substrate-and-layout.md) · [US-2.7](US-2.7-list-account-strategies-tool.md)
