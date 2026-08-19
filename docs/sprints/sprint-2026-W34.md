---
id: sprint-2026-W34
status: active
start: 2026-08-17T00:00:00.000Z
end: 2026-08-23T00:00:00.000Z
goal: 'Give a sprint file one scope table, retrofit the two written before that was the rule, and open the authoring read path with its first four MCP tools'
---
## Sprint scope

| US     | Title                                                  | Epic   | Pri | Points | Status | Story file                                                |
| ------ | ------------------------------------------------------ | ------ | --- | ------ | ------ | --------------------------------------------------------- |
| US-6.1 | One scope table per sprint file *(added 2026-08-17)*   | EPIC-6 | P2  | 2      | ✅ done | [link](stories/US-6.1-one-scope-table-per-sprint-file.md) |
| US-6.2 | Remove W33's relocated plan block *(added 2026-08-17)* | EPIC-6 | P2  | 1      | ✅ done | [link](stories/US-6.2-remove-the-relocated-plan-block.md) |
| US-7.1 | Authoring substrate and `get_authoring_conventions` *(added 2026-08-19)* | EPIC-7 | P1  | 3      | ✅ done | [link](stories/US-7.1-authoring-substrate-and-conventions-tool.md) |
| US-7.2 | `get_draft` tool *(added 2026-08-19)*                  | EPIC-7 | P1  | 2      | ✅ done | [link](stories/US-7.2-get-draft-tool.md) |
| US-7.3 | `list_drafts` tool *(added 2026-08-19)*                | EPIC-7 | P1  | 3      | 🟢 ready | [link](stories/US-7.3-list-drafts-tool.md) |
| US-7.4 | `list_draft_attachments` tool *(added 2026-08-19)*     | EPIC-7 | P1  | 2      | 🟢 ready | [link](stories/US-7.4-list-draft-attachments-tool.md) |

**Total: 6 stories / 13 points.** This sprint opened with no committed scope. US-6.1 and
US-6.2 joined it on its first day, and are the first stories written to the shape they
establish ([CONTEXT D30](../CONTEXT.md), [D31](../CONTEXT.md)). The four US-7.x rows joined
on 2026-08-19, after the Senti Quant API grew a new `Authoring` tag that
[EPIC-2](epics/EPIC-2.md)'s close could not have covered — all six under
[CONTEXT D21](../CONTEXT.md) rule 1, and all as rows in this one table rather than as a
second section ([CONTEXT D30](../CONTEXT.md)).

> AC and Tasks live inside each story file. This table is a planning surface only.

## Parked / deferred from W33

Nothing carried. All 19 stories in [sprint-2026-W33](sprint-2026-W33.md) — Phases 1–4,
52 points — closed inside its window; the corpus holds no story at `backlog`, `ready`,
`in-progress`, `review`, or `blocked` as this sprint opens.

Scope is not frozen ([CONTEXT D21](../CONTEXT.md)) — work that arises this week joins the
table above rather than waiting for W35. **The four US-7.x rows are exactly that**: the API
grew from 17 operations to 29 on a schedule this repo does not control, and the four `GET`
operations in its new `Authoring` tag became reachable work mid-sprint.

## Cross-references

- [sprint-2026-W33](sprint-2026-W33.md) — prior sprint
- [STATUS.md](STATUS.md) — generated kanban (RULE-5, never hand-edited)
- [EPIC-6](epics/EPIC-6.md) — US-6.1's and US-6.2's epic
- [EPIC-7](epics/EPIC-7.md) — the authoring read path, opened this sprint; US-7.1 → US-7.4
- [EPIC-2](epics/EPIC-2.md) · [EPIC-3](epics/EPIC-3.md) — the read path EPIC-7 extends, and the write path it defers to
- [Authoring read-tool design spec](../superpowers/specs/2026-08-19-senti-authoring-read-tools-design.md) · [implementation plan](../superpowers/plans/2026-08-19-senti-authoring-read-tools-w34.md)
- [CONTEXT D30](../CONTEXT.md) — the single-scope-table shape this file is written in
