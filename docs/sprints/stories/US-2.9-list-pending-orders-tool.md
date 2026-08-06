---
id: US-2.9
title: "list_pending_orders tool"
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

- [ ] **AC-1** — **Given** a call with `accountId`, **When** the request is built,
  **Then** the path is constructed via `accountPath`.
- [ ] **AC-2** — **Given** the API returns `409`, **When** the tool returns, **Then**
  the text reports the terminal offline, **And** it explicitly distinguishes this from
  the account holding no pending orders — mirroring
  [US-2.8](US-2.8-list-positions-tool.md) AC-2.
- [ ] **AC-3** — **Given** a successful response with zero pending orders, **When** it
  is formatted, **Then** the output states that this is a real zero.
- [ ] **AC-4** — **Given** an order with `priceStopLimit` equal to `0`, **When** it is
  formatted, **Then** it renders as `—`, never as `0.00`.
- [ ] **AC-5** — **Given** more than 200 pending orders, **When** the list is
  formatted, **Then** it truncates at 200 rows, **And** `notes` records how many were
  dropped — mirroring [US-2.8](US-2.8-list-positions-tool.md) AC-5.
- [ ] **AC-6** — **Given** a `403` from the API, **When** the tool returns, **Then**
  `isError` is true and the text names the `trading:read` scope.

## Tasks

- [ ] **TASK-2.9.1** — `tools/trading/orders.ts` domain module (plan Task 18)
  (AC: 3, 4, 5)
  - [ ] `OrderSchema`, `parseOrders`, `formatOrders` — nullable `priceStopLimit`, the
        200-row cap and `notes`, mirroring `positions.ts`'s formatting shape
- [ ] **TASK-2.9.2** — Registration, the 0.7.0 release, and the sprint close
  (plan Task 19) (AC: 1, 2, 6)
  - [ ] Register through `registerReadTool`; build the path via `accountPath`;
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
| AC-1 | `npm test -- src/tools/trading/orders.test.ts -t accountPath` |
| AC-2 | `npm test -- src/server.test.ts -t "list_pending_orders.*409"` |
| AC-6 | `npm test -- src/server.test.ts -t "list_pending_orders.*403"` |

## Changelog entry

### Added
- `src/tools/trading/orders.ts` — the `list_pending_orders` tool: `OrderSchema`,
  `parseOrders`, `formatOrders`, mirroring `list_positions`'s `409`/real-zero/
  200-row-cap pattern for pending orders.

## Implementation notes

Not yet started — filled in when this story moves to `in-progress`.

## Files modified

Not yet started — filled in when this story moves to `in-progress`.

## Cross-references

- [Epic EPIC-2](../epics/EPIC-2.md)
- [sprint-2026-W33](../sprint-2026-W33.md)
- [CHANGELOG](../../CHANGELOG.md)
- [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [US-2.4](US-2.4-tool-substrate-and-layout.md) · [US-2.8](US-2.8-list-positions-tool.md)
