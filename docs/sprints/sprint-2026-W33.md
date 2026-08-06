---
id: sprint-2026-W33
status: in-progress
start: 2026-08-10
end: 2026-08-16
goal: "Restructure src/ into core/ + tools/<tag>/, add the read-tool substrate, and ship the first five of the nine unshipped read tools"
---

## Sprint scope

| US | Title | Epic | Pri | Points | Status | Story file |
|---|---|---|---|---|---|---|
| US-2.4 | Tool substrate and directory layout | EPIC-2 | P1 | 5 | 📋 backlog | [link](stories/US-2.4-tool-substrate-and-layout.md) |
| US-2.5 | `list_brokers` tool | EPIC-2 | P1 | 2 | 📋 backlog | [link](stories/US-2.5-list-brokers-tool.md) |
| US-2.6 | `list_strategies` tool | EPIC-2 | P1 | 2 | 📋 backlog | [link](stories/US-2.6-list-strategies-tool.md) |
| US-2.7 | `list_account_strategies` tool | EPIC-2 | P1 | 2 | 📋 backlog | [link](stories/US-2.7-list-account-strategies-tool.md) |
| US-2.8 | `list_positions` tool | EPIC-2 | P1 | 2 | 📋 backlog | [link](stories/US-2.8-list-positions-tool.md) |
| US-2.9 | `list_pending_orders` tool | EPIC-2 | P1 | 2 | 📋 backlog | [link](stories/US-2.9-list-pending-orders-tool.md) |

**Total: 6 stories / 15 points.**

> AC and Tasks live inside each story file. This table is a planning surface only.

## Sprint goal recap

This sprint executes the first six stories of the
[read-tool expansion plan](../superpowers/plans/2026-08-06-senti-read-tools-w33.md), which
itself implements the [read-tool expansion design spec](../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md).
That design corrected a figure this repo had carried since v0.1.0: the Senti Quant Public
API is 10 `GET` + 7 `POST` (17 operations total), so with `list_accounts` shipped, **nine**
read operations remain — not sixteen. US-2.4 lands that correction in `AGENTS.md` and
`EPIC-2.md` in the same commit it opens this sprint.

**The deliverable cut.** Five of the nine unshipped read operations ship this week —
`list_brokers`, `list_strategies`, `list_account_strategies`, `list_positions`, and
`list_pending_orders` — plus the substrate restructuring that makes adding each one close
to transcription rather than open design. The other four (`get_account_performance`,
`get_performance_breakdowns`, `get_equity_timeseries`, `list_deals`) carry to W34: they
open query parameters, payload downsampling, and cursor pagination, axes this sprint
deliberately does not open. See [EPIC-2](epics/EPIC-2.md) §Out of scope.

**Why this order.** The design spec's story plan sequences stories so each one opens
exactly one new axis, in the cheapest story that can carry it — a defect in `accountPath`
should surface in a 2-point story, not tangled inside payload shaping four stories later.
US-2.4 opens no new tool at all; it is pure substrate, the same precedent
[US-2.1](stories/US-2.1-authenticated-senti-api-client.md) set for v0.1.0.

**On the 15 points.** This matches W32's delivered velocity exactly, and for the same
reason it fit there: the design spec and plan carry every implementation decision —
schemas, error branches, payload policy — so these six stories are closer to
transcription-with-verification than to open design.

## Phased plan

1. **Phase 1 — Substrate** (~2.5 days): US-2.4. `core/` + `tools/<tag>/` layout;
   `registerReadTool` and `parseOrThrow`; `client.get`'s `query` option, `accountPath`,
   and the dedicated `404`/`409` branches; `list_accounts` migrated onto the helper with
   no behaviour change; table-driven invariant tests; the operation-count correction,
   three new `CONTEXT.md` decisions, and the five-scope documentation update. Ships
   `0.2.0`.
2. **Phase 2 — First tools on the new substrate** (~1 day): US-2.5 `list_brokers`
   (`0.3.0`), US-2.6 `list_strategies` (`0.4.0`) — neither takes a path parameter, so
   both prove `registerReadTool` before any story has to prove `accountPath` too.
3. **Phase 3 — First path parameter** (~1 day): US-2.7 `list_account_strategies`
   (`0.5.0`) — the first tool that routes through `accountPath` and the `404` login/id
   hint.
4. **Phase 4 — Terminal-backed pair** (~1 day): US-2.8 `list_positions` (`0.6.0`),
   US-2.9 `list_pending_orders` (`0.7.0`) — the first tools carrying the `409`
   terminal-offline branch, the "empty is a real zero" distinction, and the 200-row
   truncation cap. US-2.9's close is this sprint's close.

Phases are ordered by dependency, not calendar. Phase 1 cannot start before it, since
every later story consumes what it substrates.

## Dependencies and sequencing constraints

- **US-2.4 blocks all five tool stories.** Each of US-2.5 through US-2.9 registers
  through `registerReadTool` and (from US-2.7 onward) builds its path with
  `accountPath` — neither exists before US-2.4 lands.
- **US-2.5 and US-2.6 have no path parameter.** They are the cheapest possible proof
  that a tool can be registered on the new substrate at all.
- **US-2.7 is the first story with a path parameter.** It is where `accountPath`'s
  traversal-rejection and the `404` login/id hint (both built in US-2.4) are exercised
  against a live threat model for the first time.
- **US-2.8 and US-2.9 are the terminal-backed pair.** Both read through to the MT5
  terminal and both need the `409`/`conflictMeans` branch US-2.4 built for exactly this
  case; US-2.9 reuses the pattern US-2.8 establishes rather than re-deriving it.

## Retrospective

<Filled on sprint close.>

### What went well

- TBD

### What didn't

- TBD

### Followups

- TBD

## Cross-references

- [EPIC-2](epics/EPIC-2.md) · [EPIC-3](epics/EPIC-3.md)
- [STATUS.md](STATUS.md) — generated kanban
- [CONTEXT D6](../CONTEXT.md) — the most recent decision as this sprint opens
- [read-tool expansion design spec](../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [read-tools-w33 implementation plan](../superpowers/plans/2026-08-06-senti-read-tools-w33.md)
- [sprint-2026-W32](sprint-2026-W32.md) — prior sprint
