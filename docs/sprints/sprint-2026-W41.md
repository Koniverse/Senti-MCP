---
id: sprint-2026-W41
status: in-progress
start: 2026-10-05
end: 2026-10-11
goal: 'No committed scope at open — W39 closed on this file''s first day with no rows, and W40''s window passed with no sprint file; EPIC-9''s five backlog stories are the ready candidates, and work that arises this week joins the one scope table below as a row'
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

This is the seventh consecutive sprint file to open with no committed scope. Mid-window
intake so far: W34 absorbed 10 stories, W35 one, W36 none, W37 one, W38 three, and
[W39](sprint-2026-W39.md) none. An empty open is a starting position here, not a forecast.

**The sequence skips W40.** Its window (2026-09-28 → 2026-10-04) passed with no sprint file
and with nothing reaching `main`: the last commit there is `b98acf6`, from 2026-09-25. On
2026-10-05 the maintainer asked to close the current sprint and open the newest one, which
is this week's. W40 gets no file, retroactive or empty ([CONTEXT D51](../CONTEXT.md)).

**This file opens on its own first day,** which no open has done since W38. W39 is closed in
the same commit, and none of the five open stories has a `sprint:`, so no story points at a
live file. `status:` reads `in-progress` from the open. The two sprints before this one read
`planned` for their whole windows, and both retrospectives flagged it.

**The backlog is unchanged since W39's open.** [EPIC-9](epics/EPIC-9.md) is `in-progress`
with five `backlog` stories, all filed on 2026-09-14 and sized:

| US | Title | Pri | Points |
| -- | ----- | --- | ------ |
| [US-9.2](stories/US-9.2-get-draft-attachment-tool.md) | get_draft_attachment, and list_draft_attachments becomes an index | P1 | 5 |
| [US-9.3](stories/US-9.3-get-draft-compile-log-tool.md) | get_draft_compile_log tool | P2 | 2 |
| [US-9.4](stories/US-9.4-typed-diagnostics-and-path-segments.md) | Typed diagnostics, and the path-segment rationale | P2 | 3 |
| [US-9.5](stories/US-9.5-forbidden-construct-contract.md) | The forbidden-construct pattern contract | P2 | 2 |
| [US-9.6](stories/US-9.6-operationid-docs-and-spec-drift-check.md) | operationId doc corrections and a spec-drift check | P3 | 2 |

That comes to 14 points, **and none of it is scope.** Promoting a story is the maintainer's
call ([CONTEXT D21](../CONTEXT.md) rule 2), and this open did not do it. A promoted story
becomes a row in the table above with an `_(added …)_` annotation.

`VERSION` reads `2.9.0`. CHANGELOG `[Unreleased]` still holds only the pull-request CI gate
([US-10.1](stories/US-10.1-pr-ci-gate.md)), which rides whichever release comes next.

## Parked / deferred from W39

**Nothing carried.** [W39](sprint-2026-W39.md) closed at `0 stories / 0 points` on
2026-10-05. W40 has no file, so there is nothing to carry from it. This was verified at open
against the `status:` frontmatter of every file in [stories/](stories/): 43 files, 38 `done`
and 5 `backlog`. The five are EPIC-9's stories listed above, and none has a `sprint:`. It
was also checked against [STATUS.md](STATUS.md), not against W39's own closing text.

- ✅ **Closed in W39**: none.
- 🚧 **Carried into W41**: none.
- 🟢 **Carried into W41 as `ready`**: none. EPIC-9's five are `backlog`, not `ready`.
- 🗑️ **Retired in W39**: none.

## Open work, unassigned

**This is not scope.** It lists what is open in the repository with no story owning it,
carried forward so that an empty scope table is not mistaken for an empty backlog. Anything
promoted from here becomes a story first, then a row in the table above. W39 carried six
items, and all six carry. The Dependabot item is rewritten, because the branches it named
are gone and two different PRs have replaced them.

- **Two Dependabot PRs are open, one red and one green.** Each was re-read at open.
  - [PR #21](https://github.com/Koniverse/Senti-MCP/pull/21) bumps vitest 4.1.10 → 5.0.1, a
    major bump of a dev dependency, opened 2026-09-25. `verify` **fails** at test startup with
    `Cannot find native binding` / `@rolldown/binding-wasm32-wasi`, and the ruleset holds it
    at `BLOCKED`. It needs a decision between a regenerated lockfile and holding vitest at 4,
    so nobody should simply retry it.
  - [PR #22](https://github.com/Koniverse/Senti-MCP/pull/22) is the minor-and-patch group,
    four updates, opened 2026-10-02. `verify` **passes** and merge state is `CLEAN`.

  The branches W39 listed are settled. `minor-and-patch-e0fb835b0d` merged as PR #17 on
  2026-09-25, green. `vitest-5.0.0` closed as PR #18 the same day, superseded by #21.
- **`register`, the eighth authoring write, is unimplemented and no story owns it.**
  [EPIC-8](epics/EPIC-8.md) shipped seven of the `Authoring` tag's eight writes. The eighth
  needs a story that first settles the delete-asymmetry question
  ([EPIC-8](epics/EPIC-8.md) §What this close does not claim).
- **No write tool has ever run against production.** Since [CONTEXT D48](../CONTEXT.md) the
  smoke suite defaults to production, but no `SENTI_SMOKE_WRITES=1` run has happened since.
  The next such run is still the first.
- **Ten [CONTEXT](../CONTEXT.md) entries still read `(planned)` on a version that has
  shipped:** D32, D33, and D36 → D43. Count re-checked at open: still ten.
- **An offline MT5 terminal and a symbol-rich account still block three recorded EPIC-2
  gaps** ([EPIC-2](epics/EPIC-2.md) §Live payload findings). Unchanged; this is the eleventh
  sprint file carrying it.
- **[EPIC-3](epics/EPIC-3.md) is `backlog`.** It covers the trading write path (deploy, stop,
  close, cancel) and is a placeholder epic with no stories.

## Retrospective

<!-- Filled on sprint close. -->

### What went well

- TBD

### What didn't

- TBD

### Followups

- TBD

## Cross-references

- [sprint-2026-W39](sprint-2026-W39.md) — prior sprint, closed 2026-10-05 with no rows; its §Open work is this file's §Open work, with the Dependabot item rewritten
- [CONTEXT D51](../CONTEXT.md) — W40 gets no sprint file; the sequence goes W39 → W41
- [STATUS.md](STATUS.md) — generated kanban (RULE-5, never hand-edited)
- [CONTEXT D21](../CONTEXT.md) — scope stays open all week; only the maintainer opens or closes a sprint
- [CONTEXT D30](../CONTEXT.md) — one scope table per sprint file; mid-sprint scope is a row, not a section
- [CONTEXT D47](../CONTEXT.md) — the convention is checked by `npm run agile:check-sprints`
- [CONTEXT D50](../CONTEXT.md) — every PR into `main` runs `verify`, a merge requirement
- [EPIC-9](epics/EPIC-9.md) — `in-progress`, five backlog stories · [EPIC-3](epics/EPIC-3.md) — `backlog`, the trading write path
- [CHANGELOG](../CHANGELOG.md) — `2.9.0` is the version this sprint opens on; `[Unreleased]` holds the CI gate
