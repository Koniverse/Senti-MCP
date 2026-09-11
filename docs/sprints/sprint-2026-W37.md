---
id: sprint-2026-W37
status: planned
start: 2026-09-07
end: 2026-09-13
goal: 'No committed scope at open — W35 and W36 both closed on this file''s first day and the corpus holds no open story; mid-window scope added 2026-09-11 commits to closing EPIC-6 with US-6.3 and US-6.4'
---

## Sprint scope

| US     | Title                                                                          | Epic   | Pri | Points | Status   | Story file                                                     |
| ------ | ------------------------------------------------------------------------------ | ------ | --- | ------ | -------- | -------------------------------------------------------------- |
| US-6.3 | Resolve native plan and dependency sections in W32 and W33 *(added 2026-09-11)* | EPIC-6 | P2  | 1      | 🟢 ready | [link](stories/US-6.3-resolve-native-plan-blocks-in-w32-w33.md) |
| US-6.4 | Automated sprint file convention check *(added 2026-09-11)*                    | EPIC-6 | P2  | 2      | 🟢 ready | [link](stories/US-6.4-sprint-file-convention-check.md)         |

**Total: 2 stories / 3 points.** Opened empty on 2026-09-07; two stories joined mid-window on
2026-09-11 under [CONTEXT D21](../CONTEXT.md) rule 1 to resolve the remaining open questions of
[EPIC-6](epics/EPIC-6.md). **One table, one total, no second scope section** ([CONTEXT D30](../CONTEXT.md)).

> AC and Tasks live inside each story file. This table is a planning surface only.

## Sprint goal recap

This is the fourth consecutive sprint to open with no committed scope, and the second in a
row where that is worth reading twice. W34 opened empty on 2026-08-17 and absorbed 10
stories across two mid-window tranches; W35 opened empty on 2026-08-24 and absorbed one;
[W36](sprint-2026-W36.md) opened empty on 2026-09-04 and absorbed **nothing**, closing as
the first empty sprint in the repo's history. An empty open is a starting position here, not
a forecast — but W36 is the evidence that it is not a guarantee either.

**W35 and W36 were both closed on 2026-09-07, the day this file opens**
([CONTEXT D46](../CONTEXT.md)). That clears the overlap W36 was opened into: for its whole
window two sprints described live windows at once, and [US-2.14](stories/US-2.14-api-keys-dashboard-host.md)
sat at `review` with `version_shipped:` empty although its code had shipped as `2.8.1` on
2026-08-25. Both are settled — US-2.14 is `done` under W35, which is where its `sprint:`
frontmatter always pointed. This file therefore opens against a fully reconciled corpus, and
the §Parked audit below is the first in three sprints with nothing to disclose.

The repository has been quiet since 2026-08-26. `VERSION` reads `2.8.1`, and the only commit
in the fifteen days before this one is `52da7f9`, which created W36's sprint file. Nothing
in `src/` has changed since PR #9 merged.

**What this window has to decide is whether it commits to anything at all.**
[W36 §Followups](sprint-2026-W36.md) puts it directly: three empty opens, one of which
produced nothing, against a standing backlog of eight unowned items, two of which are
epics carrying no stories at all. Promoting even one into a story would give this sprint scope at open rather than by
accident. That promotion is the maintainer's ([CONTEXT D21](../CONTEXT.md) rule 2) and has
not been asked for, so nothing below has been promoted.

## Parked / deferred from W36

**Nothing carried, and this time the audit is clean.** [W36](sprint-2026-W36.md) closed
`0 stories / 0 points` on 2026-09-07 with nothing to hand over, and
[W35](sprint-2026-W35.md) closed the same day with its one row `done`. Verified at open
against the `status:` frontmatter of every file in [stories/](stories/) — 34 files, 34
`done` — and against [STATUS.md](STATUS.md), not against either sprint's own closing text.

- ✅ **Closed in W36**: none. W36 committed to nothing and shipped nothing.
- ✅ **Closed in W35, same day**: [US-2.14](stories/US-2.14-api-keys-dashboard-host.md) —
  2 points, shipped `2.8.1` on 2026-08-25, story flipped `done` on 2026-09-07.
- 🚧 **Carried into W37**: none. Unlike W36's audit, this is a real "none" — no story is
  open in any sense, formal or informal.
- 🟢 **Carried into W37 as `ready`**: none.
- 🗑️ **Retired in W36**: none.

## Open work, unassigned

**This is not scope.** It is the standing list of what is open in the repository with no
story owning it, carried forward so an empty scope table is not mistaken for an empty
backlog. Anything promoted here becomes a story first, then a row in the table above. Every
item below was re-verified against the working tree at this file's open; all eight are
unchanged from W36's open, which is itself the point of the last bullet in
[W36 §Followups](sprint-2026-W36.md).

- **`register` — the eighth authoring write — is unimplemented and owned by no story.**
  [EPIC-8](epics/EPIC-8.md) shipped seven of the `Authoring` tag's eight writes. The eighth
  needs a story that settles the delete-asymmetry question first
  ([EPIC-8](epics/EPIC-8.md) §What this close does not claim).
- **No write tool has ever run against production.** Everything from `2.5.0` to `2.8.1` was
  measured against `be-dev.sentitrade.xyz`. The smoke key holds `authoring:write` on
  `api.sentitrade.xyz` by probe, but no draft has been created there by this server.
- **One `curl` still settles [CONTEXT D45](../CONTEXT.md).** A single authenticated call to
  `https://api.sentitrade.xyz/api/v1/accounts` decides whether the pairing caveat is deleted
  from `README.md` and `docs/SETUP.md` or whether `DEFAULT_BASE_URL` needs its own story.
  Written up in [US-2.14](stories/US-2.14-api-keys-dashboard-host.md) §Remaining work, which
  explicitly places it out of that story's scope. Either outcome supersedes D45 by revision,
  never by edit (RULE-7). Now carried a third sprint, and it needs a real key and about a
  minute.
- **Nothing runs on a pull request — now carried a fifth sprint, with two merged PRs behind
  it.** `.github/workflows/` still holds only `release.yml`, triggered on `v*` tags
  (re-checked at open). PR #8 carried EPIC-8's 14 points into `main` and PR #9 carried
  `2.8.1`, neither through a typecheck, test or build gate. W33 called this "the
  highest-value unbuilt thing in this repo".
- **[EPIC-6](epics/EPIC-6.md) remaining questions 3 and 5 are now assigned to W37 as [US-6.3](stories/US-6.3-resolve-native-plan-blocks-in-w32-w33.md) and [US-6.4](stories/US-6.4-sprint-file-convention-check.md).**
  Once both stories complete, EPIC-6 will close as `done`.
- **Ten [CONTEXT](../CONTEXT.md) entries still read `(planned)` on a version that has
  shipped** — D32, D33, and D36 → D43. Count re-checked at open: still ten. Two further
  entries read `2.4.0 (unreleased)` for a version that also shipped. Whoever clears them
  decides once whether that field is metadata to complete or a record to revise under
  RULE-7.
- **An offline MT5 terminal and a symbol-rich account still block three recorded EPIC-2
  gaps** ([EPIC-2](epics/EPIC-2.md) §Live payload findings). Unchanged, and this is the
  eighth sprint carrying it.
- **[EPIC-3](epics/EPIC-3.md) is `backlog`** — the trading write path (deploy, stop, close,
  cancel), a placeholder epic with no stories.

## Retrospective

<!-- Filled on sprint close by the maintainer (CONTEXT D21 rule 2). -->

### What went well

- TBD

### What didn't

- TBD

### Followups

- TBD

## Cross-references

- [sprint-2026-W36](sprint-2026-W36.md) — prior sprint, closed empty on 2026-09-07; its §Open work is this file's §Open work
- [sprint-2026-W35](sprint-2026-W35.md) — closed the same day, carrying US-2.14 at `2.8.1`
- [STATUS.md](STATUS.md) — generated kanban (RULE-5, never hand-edited)
- [CONTEXT D21](../CONTEXT.md) — scope stays open all week; only the maintainer opens or closes a sprint
- [CONTEXT D30](../CONTEXT.md) — one scope table per sprint file; mid-sprint scope is a row, not a section
- [CONTEXT D45](../CONTEXT.md) — the dashboard host, and the base-URL pairing left unverified
- [CONTEXT D46](../CONTEXT.md) — closing W35 and W36 together, and opening this file
- [EPIC-6](epics/EPIC-6.md) — `in-progress`, questions 3 and 5 · [EPIC-3](epics/EPIC-3.md) — `backlog`, the trading write path
- [CHANGELOG](../CHANGELOG.md) — `2.8.1` is the version this sprint opens on
