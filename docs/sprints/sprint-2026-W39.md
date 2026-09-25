---
id: sprint-2026-W39
status: planned
start: 2026-09-21
end: 2026-09-27
goal: 'No committed scope at open — W38 closed on 2026-09-25, day five of this window, with all three rows done; EPIC-9''s five backlog stories are the ready candidates, and work that arises this week joins the one scope table below as a row'
---

## Sprint scope

| US | Title | Epic | Pri | Points | Status | Story file |
| -- | ----- | ---- | --- | ------ | ------ | ---------- |

**Total: 0 stories / 0 points.** This sprint opened empty.
Scope is not frozen ([CONTEXT D21](../CONTEXT.md) rule 1). Work that arises this week is
appended here as a row annotated `_(added YYYY-MM-DD)_`, and the sprint `goal:` gains a
clause for it. **One table, one total, no second scope section** ([CONTEXT D30](../CONTEXT.md)),
checked by `npm run agile:check-sprints` ([CONTEXT D47](../CONTEXT.md)).

> AC and Tasks live inside each story file. This table is a planning surface only.

## Sprint goal recap

This is the sixth consecutive sprint to open with no committed scope. Mid-window intake so
far: W34 absorbed 10 stories, W35 one, W36 none, W37 one, and
[W38](sprint-2026-W38.md) three (7 points, all shipped). An empty open is a starting
position here, not a forecast.

**This file opens late, on 2026-09-25, day five of a seven-day window.** W38's window
elapsed on 2026-09-20, but its close waited until today. Nothing reached `main` from
2026-09-16 15:34 until this commit. There is no overlap to reconcile: W38 is closed in the
same commit that opens this file, and no story's `sprint:` points at a live file.

**Unlike W38's open, this backlog has stories in it.** [EPIC-9](epics/EPIC-9.md) is
`in-progress` with five `backlog` stories, all filed on 2026-09-14 and sized:

| US | Title | Pri | Points |
| -- | ----- | --- | ------ |
| [US-9.2](stories/US-9.2-get-draft-attachment-tool.md) | get_draft_attachment, and list_draft_attachments becomes an index | P1 | 5 |
| [US-9.3](stories/US-9.3-get-draft-compile-log-tool.md) | get_draft_compile_log tool | P2 | 2 |
| [US-9.4](stories/US-9.4-typed-diagnostics-and-path-segments.md) | Typed diagnostics, and the path-segment rationale | P2 | 3 |
| [US-9.5](stories/US-9.5-forbidden-construct-contract.md) | The forbidden-construct pattern contract | P2 | 2 |
| [US-9.6](stories/US-9.6-operationid-docs-and-spec-drift-check.md) | operationId doc corrections and a spec-drift check | P3 | 2 |

That comes to 14 points, **and none of it is scope.** Promoting a story is the maintainer's call
([CONTEXT D21](../CONTEXT.md) rule 2), and this open did not do it. A promoted story becomes
a row in the table above with an `_(added …)_` annotation. Two days of the window remain.

`VERSION` reads `2.9.0`. CHANGELOG `[Unreleased]` holds the pull-request CI gate
([US-10.1](stories/US-10.1-pr-ci-gate.md)). The gate changes nothing in the package, so it
rides whichever release comes next.

## Parked / deferred from W38

**Nothing carried.** [W38](sprint-2026-W38.md) closed at `3 stories / 7 points` on 2026-09-25,
with every row `done`. This was verified at open against the `status:` frontmatter of every
file in [stories/](stories/): 43 files, 38 `done` and 5 `backlog`, the five being EPIC-9's
stories listed above, none with a `sprint:`. It was also checked against [STATUS.md](STATUS.md),
not against W38's own closing text.

- ✅ **Closed in W38**: [US-9.1](stories/US-9.1-list-drafts-summary-mode.md) (2 points,
  shipped `2.9.0`), [US-2.15](stories/US-2.15-retire-the-development-host.md) (2 points,
  shipped in `2.9.0`), and [US-10.1](stories/US-10.1-pr-ci-gate.md) (3 points, unreleased,
  closing [EPIC-10](epics/EPIC-10.md)).
- 🚧 **Carried into W39**: none.
- 🟢 **Carried into W39 as `ready`**: none. EPIC-9's five are `backlog`, not `ready`.
- 🗑️ **Retired in W38**: none.

## Open work, unassigned

**This is not scope.** It lists what is open in the repository with no story owning it,
carried forward so that an empty scope table is not mistaken for an empty backlog. Anything
promoted from here becomes a story first, then a row in the table above. W38 carried seven
items. The CI gate closed (US-10.1) and the settled D45 bullet drops out, which leaves five.
One item is new, for six in all.

- **Two Dependabot branches are unmerged: the first dependency updates since the gate went
  live.** `origin/dependabot/npm_and_yarn/vitest-5.0.0` (a major bump of a dev dependency,
  pushed 2026-09-16) and `origin/dependabot/npm_and_yarn/minor-and-patch-e0fb835b0d` (pushed
  2026-09-18). Their PRs' check results were not read at open. Whoever picks them up reads
  `verify` first; that check is why it exists ([CONTEXT D50](../CONTEXT.md)).
- **`register`, the eighth authoring write, is unimplemented and no story owns it.**
  [EPIC-8](epics/EPIC-8.md) shipped seven of the `Authoring` tag's eight writes. The eighth
  needs a story that first settles the delete-asymmetry question
  ([EPIC-8](epics/EPIC-8.md) §What this close does not claim).
- **No write tool has ever run against production.** Since [CONTEXT D48](../CONTEXT.md) the
  smoke suite defaults to production, but no `SENTI_SMOKE_WRITES=1` run has happened since:
  US-2.15 records that it did not run one, and US-9.1's smoke leg is a read. The next such
  run is still the first.
- **Ten [CONTEXT](../CONTEXT.md) entries still read `(planned)` on a version that has
  shipped:** D32, D33, and D36 → D43. Count re-checked at open: still ten.
- **An offline MT5 terminal and a symbol-rich account still block three recorded EPIC-2
  gaps** ([EPIC-2](epics/EPIC-2.md) §Live payload findings). Unchanged; this is the tenth
  sprint carrying it.
- **[EPIC-3](epics/EPIC-3.md) is `backlog`.** It covers the trading write path (deploy, stop,
  close, cancel) and is a placeholder epic with no stories. It is no longer the only epic not
  `done`, since EPIC-9 is `in-progress`.

## Retrospective

<!-- Filled on sprint close. -->

### What went well

- TBD

### What didn't

- TBD

### Followups

- TBD

## Cross-references

- [sprint-2026-W38](sprint-2026-W38.md) — prior sprint, closed 2026-09-25 with US-9.1, US-2.15 and US-10.1 `done`; its §Open work is this file's §Open work, less the CI gate and D45, plus the Dependabot branches
- [STATUS.md](STATUS.md) — generated kanban (RULE-5, never hand-edited)
- [CONTEXT D21](../CONTEXT.md) — scope stays open all week; only the maintainer opens or closes a sprint
- [CONTEXT D30](../CONTEXT.md) — one scope table per sprint file; mid-sprint scope is a row, not a section
- [CONTEXT D47](../CONTEXT.md) — the convention is checked by `npm run agile:check-sprints`
- [CONTEXT D50](../CONTEXT.md) — every PR into `main` runs `verify`, a merge requirement
- [EPIC-9](epics/EPIC-9.md) — `in-progress`, five backlog stories · [EPIC-3](epics/EPIC-3.md) — `backlog`, the trading write path
- [CHANGELOG](../CHANGELOG.md) — `2.9.0` is the version this sprint opens on; `[Unreleased]` holds the CI gate
