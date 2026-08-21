---
id: sprint-2026-W34
status: closed
start: 2026-08-17T00:00:00.000Z
end: 2026-08-23T00:00:00.000Z
goal: 'Give a sprint file one scope table, retrofit the two written before that was the rule, open the authoring read path with its first four MCP tools, and open the authoring write path with seven more'
---
## Sprint scope

| US     | Title                                                                      | Epic   | Pri | Points | Status | Story file                                                         |
| ------ | -------------------------------------------------------------------------- | ------ | --- | ------ | ------ | ------------------------------------------------------------------ |
| US-6.1 | One scope table per sprint file *(added 2026-08-17)*                       | EPIC-6 | P2  | 2      | ✅ done | [link](stories/US-6.1-one-scope-table-per-sprint-file.md)          |
| US-6.2 | Remove W33's relocated plan block *(added 2026-08-17)*                     | EPIC-6 | P2  | 1      | ✅ done | [link](stories/US-6.2-remove-the-relocated-plan-block.md)          |
| US-7.1 | Authoring substrate and `get_authoring_conventions` *(added 2026-08-19)*   | EPIC-7 | P1  | 3      | ✅ done | [link](stories/US-7.1-authoring-substrate-and-conventions-tool.md) |
| US-7.2 | `get_draft` tool *(added 2026-08-19)*                                      | EPIC-7 | P1  | 2      | ✅ done | [link](stories/US-7.2-get-draft-tool.md)                           |
| US-7.3 | `list_drafts` tool *(added 2026-08-19)*                                    | EPIC-7 | P1  | 3      | ✅ done | [link](stories/US-7.3-list-drafts-tool.md)                         |
| US-7.4 | `list_draft_attachments` tool *(added 2026-08-19)*                         | EPIC-7 | P1  | 2      | ✅ done | [link](stories/US-7.4-list-draft-attachments-tool.md)              |
| US-8.1 | Write substrate, the opt-in, and `create_draft` *(added 2026-08-21)*       | EPIC-8 | P1  | 5      | ✅ done | [link](stories/US-8.1-write-substrate-and-create-draft.md)         |
| US-8.2 | `update_draft` and `delete_draft` *(added 2026-08-21)*                     | EPIC-8 | P1  | 3      | ✅ done | [link](stories/US-8.2-update-and-delete-draft.md)                  |
| US-8.3 | The three attachment writes *(added 2026-08-21)*                           | EPIC-8 | P1  | 3      | ✅ done | [link](stories/US-8.3-attachment-writes.md)                        |
| US-8.4 | `compile_draft`, write smoke test, and EPIC-8's close *(added 2026-08-21)* | EPIC-8 | P1  | 3      | ✅ done | [link](stories/US-8.4-compile-draft-and-epic-close.md)             |

**Total: 10 stories / 27 points.** This sprint opened with no committed scope. US-6.1 and
US-6.2 joined it on its first day, and are the first stories written to the shape they
establish ([CONTEXT D30](../CONTEXT.md), [D31](../CONTEXT.md)). The four US-7.x rows joined
on 2026-08-19, after the Senti Quant API grew a new `Authoring` tag that
[EPIC-2](epics/EPIC-2.md)'s close could not have covered. The four US-8.x rows joined on
2026-08-21, once that tag's read path was complete and its eight writes were the only part
still unreachable — all ten under [CONTEXT D21](../CONTEXT.md) rule 1, and all as rows in
this one table rather than as a second section ([CONTEXT D30](../CONTEXT.md)).

> AC and Tasks live inside each story file. This table is a planning surface only.

## Parked / deferred from W33

Nothing carried. All 19 stories in [sprint-2026-W33](sprint-2026-W33.md) — Phases 1–4,
52 points — closed inside its window; the corpus holds no story at `backlog`, `ready`,
`in-progress`, `review`, or `blocked` as this sprint opens.

Scope is not frozen ([CONTEXT D21](../CONTEXT.md)) — work that arises this week joins the
table above rather than waiting for W35. **The four US-7.x rows are exactly that**: the API
grew from 17 operations to 29 on a schedule this repo does not control, and the four `GET`
operations in its new `Authoring` tag became reachable work mid-sprint.

## Retrospective

**One retrospective, written at the close on 2026-08-21, measuring all ten rows.**
[sprint-2026-W33](sprint-2026-W33.md) carries four because each was written days apart,
measuring work that had just finished ([CONTEXT D30](../CONTEXT.md)). Nothing below existed
before today, so splitting it by tranche would invent a provenance it does not have.

### What went well

- **The measure-first task earned its place twice in one day.** Every US-8.x story opens
  with `TASK-8.x.1` — check the contract against the live service before any code is
  written. It killed the approved design's idempotency scheme before a line of
  `create_draft` existed: an idempotency record **outlives a delete**, so a key derived from
  the request replayed a `draftId` that no longer existed ([CONTEXT D43](../CONTEXT.md)
  revising [D41](../CONTEXT.md), [LESSONS 9](../LESSONS.md)). The same task caught three
  files in this repo claiming `register` deploys to a trading account when it does not
  ([CONTEXT D36](../CONTEXT.md)). Both were errors inside documents that had been written,
  reviewed and approved.
- **The gap table written before the work turned an epic close into bookkeeping.**
  [EPIC-7](epics/EPIC-7.md) and [EPIC-8](epics/EPIC-8.md) each opened with a
  §What this close does not claim table authored before implementation started. At EPIC-7's
  close none of its five rows moved; at EPIC-8's, one did — the idempotency retention
  window, discharged by measurement. What the table buys is that an epic close has to
  *argue with* a written list rather than remember what to disclose.
- **The write path discharged the read path's debt within 24 hours.** EPIC-7 closed on
  08-20 carrying an open question and two gaps it could not reach: no live draft had ever
  had a non-empty `lastCompileDiagnostics`, and the smoke account held zero attachments.
  EPIC-8's write smoke test produces both, and answers the question — a `GET`'s diagnostic
  and the compile response's are the same six keys, and the parse stays loose anyway
  ([CONTEXT D44](../CONTEXT.md)).
- **One scope table absorbed three epics and two mid-window tranches.**
  [D30](../CONTEXT.md) was ratified on this sprint's first working day and this is the first
  file written under it from an empty scope. Ten rows, two `_(added …)_` dates, no second
  section — under exactly the pressure that produced W33's four tables.

### What didn't

- **EPIC-7 closed `done` and then took two review waves to be right.** `afa178b` added
  acceptance criteria and behaviour to all four tools *after* `2.4.0` shipped, and
  `10bda4d` landed nine findings (B1–B9) that a whole-branch review surfaced and per-story
  review had not: every published token ceiling understated cost by \~2x, because MCP returns
  a result on both `content` and `structuredContent` ([CONTEXT D34](../CONTEXT.md)) — a
  figure already copied into six artifacts; `list_draft_attachments`' `filename` filter
  could return every attachment sharing a name and bypass the byte budget entirely; a test
  compared UTF-16 code units against a UTF-8 byte count and passed only because its fixtures
  were ASCII. Each was invisible inside the story that shipped it and plain with all four
  modules on screen.
- **The hand-maintained status columns went stale inside a day.** `7bdec6e` fixed a sprint
  row and an epic row still reading 🟢 ready for a story whose own frontmatter said `done` —
  and, in the same commit, README, SETUP and `.env.example` still enumerating five read
  scopes without `authoring:read`, so a key created by following this repo's own setup
  instructions verbatim would `403` on the tool that had just shipped.
  [LESSONS 4](../LESSONS.md) is the identical failure one artifact over.
- **A design was most confident exactly where it had reasoned instead of measured.** The
  write-tool design spec argued the idempotency trade carefully, named the one measurement
  that could invalidate it, and specified the derived key anyway. The measurement reversed
  it. The reversal cost ten minutes only because the spec had pre-chosen its fallback
  ([LESSONS 9](../LESSONS.md)).
- **The live-coverage ledger was paid down and grew in the same day.** EPIC-8's write smoke
  test discharged three of [EPIC-7](epics/EPIC-7.md)'s five rows — every attachment path, the
  byte budget, and the `DiagnosticSchema` render — and left two: `DRAFT_NOT_FOUND`'s live
  `404`, and `lastCompileDiagnostics`, which `get_draft` still renders uncapped and which has
  now been observed exactly once, carrying one element. EPIC-8 then added three of its own:
  the `413` branch and both cap `403`s are test-covered only, and **no write tool has been
  called against production** — every live measurement this sprint was taken against
  `be-dev`. Both closes say so plainly; the list is still longer than it was.
- **Nothing runs on a pull request, and this sprint merged one.** PR #8 carried EPIC-8's
  fourteen points into `main` with no automated typecheck, test or build behind it, and the
  other 11 commits went straight to `main` without one either. `.github/workflows/` still
  holds exactly one file, triggered on `v*` tags — the same gap
  [W33 §Phase 4 followups](sprint-2026-W33.md) called "the highest-value unbuilt thing in
  this repo" a week ago.

### Followups

- **`register` — the eighth authoring write — is unimplemented and owned by no story.** The
  loop this sprint built ends at a green build; turning one into a private EA needs a story
  that decides the delete-asymmetry question first
  ([EPIC-8](epics/EPIC-8.md) §What this close does not claim).
- **One deliberate write run against `api.sentitrade.xyz`.** The smoke key holds
  `authoring:write` on production by probe, but no draft has ever been created there by this
  server. Everything shipped `2.5.0` → `2.8.0` is production-untested by that measure.
- **The `pull_request` workflow, now carried a second sprint — with a merged PR behind it.**
  It was already named in three places and owned by nowhere; this week added the first
  merge commit that would have run it.
- **[EPIC-6](epics/EPIC-6.md) stays `in-progress` on questions 3 and 5.** Question 5 —
  *is the convention enforced by anything, or is it prose?* — is sharper after this week:
  D30 held for a file written while D30 was being ratified. Nothing in the repository would
  fail if the next sprint file grew a second scope table.
- **Ten [CONTEXT](../CONTEXT.md) entries still mark their `Version` field `(planned)` for a
  version that has since shipped** — D32, D33, and D36 → D43. Left as written rather than
  edited during a sprint close (RULE-7); whoever clears them should decide once whether the
  field is metadata to be completed or a record to be revised.
- **An offline MT5 terminal and a symbol-rich account still block three recorded EPIC-2
  gaps.** Carried unchanged, and this is the fifth sprint carrying it.

## Sprint close — 2026-08-21

Closed by the maintainer on 2026-08-21, **two days before the window elapses**
([CONTEXT D21](../CONTEXT.md) rule 2). Every row is `done` and no work is in flight; if work
arrives on 08-22 or 08-23 it joins this sprint by reopening it, which is what D21 rule 1
already prescribes and what W33 did.

**10 stories / 27 points, all `done`; two epics closed
([EPIC-7](epics/EPIC-7.md), [EPIC-8](epics/EPIC-8.md)); eight releases, `2.1.0` → `2.8.0`,
across 29 commits.** The server went from 10 tools to **21** — all 14 `GET` operations, plus
the 7 authoring writes behind `SENTI_ENABLE_AUTHORING_WRITE`. The offline suite went from
**438 passed, 1 skipped** at W33's close to **673 passed, 2 skipped (675)** across 32 files,
one of which — the live smoke file — skips without credentials. The window also produced 15 decisions
([CONTEXT D30–D44](../CONTEXT.md)) and one lesson ([LESSONS 9](../LESSONS.md)).

Scope grew twice inside the window under [CONTEXT D21](../CONTEXT.md) rule 1 — the four
US-7.x rows on 08-19, the four US-8.x rows on 08-21 — and both times as rows in the one
scope table rather than as new sections ([CONTEXT D30](../CONTEXT.md)).

**Nothing carries.** No story in the corpus sits at `backlog`, `ready`, `in-progress`,
`review` or `blocked`. The open work is the six §Followups above plus two epics with no
stories assigned: [EPIC-6](epics/EPIC-6.md) (`in-progress`, questions 3 and 5) and
[EPIC-3](epics/EPIC-3.md) (`backlog`, the trading write path). No successor sprint file
exists — opening one is the maintainer's ([CONTEXT D21](../CONTEXT.md) rule 2).

## Cross-references

- [sprint-2026-W33](sprint-2026-W33.md) — prior sprint
- [STATUS.md](STATUS.md) — generated kanban (RULE-5, never hand-edited)
- [EPIC-6](epics/EPIC-6.md) — US-6.1's and US-6.2's epic
- [EPIC-7](epics/EPIC-7.md) — the authoring read path, opened this sprint; US-7.1 → US-7.4
- [EPIC-8](epics/EPIC-8.md) — the authoring write path, opened 2026-08-21; US-8.1 → US-8.4
- [EPIC-2](epics/EPIC-2.md) · [EPIC-3](epics/EPIC-3.md) — the read path EPIC-7 extends, and the write path it defers to
- [Authoring read-tool design spec](../superpowers/specs/2026-08-19-senti-authoring-read-tools-design.md) · [implementation plan](../superpowers/plans/2026-08-19-senti-authoring-read-tools-w34.md)
- [Authoring write-tool design spec](../superpowers/specs/2026-08-21-senti-authoring-write-tools-design.md) · [implementation plan](../superpowers/plans/2026-08-21-senti-authoring-write-tools-w34.md)
- [CONTEXT D30](../CONTEXT.md) — the single-scope-table shape this file is written in
- [CONTEXT D30–D44](../CONTEXT.md) — the fifteen decisions this window produced
- [LESSONS 9](../LESSONS.md) — the idempotency key this sprint designed, measured and reversed
- [CHANGELOG `2.1.0` → `2.8.0`](../CHANGELOG.md) — the eight releases this sprint cut
