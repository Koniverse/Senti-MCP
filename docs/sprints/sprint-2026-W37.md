---
id: sprint-2026-W37
status: closed
start: 2026-09-07
end: 2026-09-13
goal: 'No committed scope at open — W35 and W36 both closed on this file''s first day and the corpus holds no open story; mid-window scope added 2026-09-11 commits to closing EPIC-6 with US-6.3'
---

## Sprint scope

| US     | Title                                                                                   | Epic   | Pri | Points | Status   | Story file                                                              |
| ------ | --------------------------------------------------------------------------------------- | ------ | --- | ------ | -------- | ----------------------------------------------------------------------- |
| US-6.3 | Sprint file convention cleanup and automated enforcement *(added 2026-09-11)*           | EPIC-6 | P2  | 3      | ✅ done | [link](stories/US-6.3-sprint-file-convention-cleanup-and-enforcement.md) |

**Total: 1 story / 3 points.** Opened empty on 2026-09-07; one story joined mid-window on
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
- **[EPIC-6](epics/EPIC-6.md) closed `done` on 2026-09-11 via [US-6.3](stories/US-6.3-sprint-file-convention-cleanup-and-enforcement.md).**
  W32 & W33 legacy narrative sections removed and sprint file conventions automated via `npm run agile:check-sprints` ([CONTEXT D47](../CONTEXT.md)).
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

**One retrospective, written at the close on 2026-09-14, measuring one row.** Every commit
that reached `main` in this window landed on a single day, 2026-09-11, and the retrospective
is mostly about that day.

### What went well

- **[EPIC-6](epics/EPIC-6.md) closed, 29 days after it opened, and its last question was
  answered by a command rather than a paragraph.** [US-6.3](stories/US-6.3-sprint-file-convention-cleanup-and-enforcement.md)
  removed W32's and W33's native plan sections and added `npm run agile:check-sprints`
  ([CONTEXT D47](../CONTEXT.md)). The one-table convention held by hand from
  [D30](../CONTEXT.md) onward; since this window it fails loudly instead. At close it
  passes on all seven sprint files, [W38](sprint-2026-W38.md) included — so the next file
  is checked from its first commit.
- **The pull-request CI gate moved for the first time in five sprints.** The item W33 called
  "the highest-value unbuilt thing in this repo" got a design spec and a task-by-task
  implementation plan on 2026-09-11
  ([spec](../superpowers/specs/2026-09-11-pr-ci-gate-design.md),
  [plan](../superpowers/plans/2026-09-11-pr-ci-gate-w37.md)). Gate vs. signal, the ruleset,
  and admin bypass are all decided on paper, so whoever picks it up starts at Task 1, not at
  a blank page.
- **An empty open absorbed work again.** Of the four consecutive empty opens so far, three
  took scope mid-window (W34: 10 stories, W35: 1, W37: 1). W36 is still the only one that
  did not.
- **The §Parked audit's "a real none" held.** Nothing surfaced during the window that the
  open had missed.

### What didn't

- **Six of the seven days produced nothing on `main`.** All six commits in the window are
  dated 2026-09-11, and that includes this file's own creation. The open was authored on
  2026-09-07 as `17a75b9` on `docs/close-w35-w36-open-w37` but reached `main` as `255eb56`
  only on 09-11. Until then, `main` still named W36 as the active sprint and still showed
  W35 open — four days of the reconciliation [CONTEXT D46](../CONTEXT.md) describes
  existing only on a branch.
- **The CI gate stopped at the plan.** Its Task 1 — file EPIC-9 and US-9.1, append a CONTEXT
  entry, add the row here — never ran. The local `ci/pr-gate` branch carries no commits of
  its own, and this table never gained the `US-9.1` row the plan names. Dependabot's
  [PR #13](https://github.com/Koniverse/Senti-MCP/pull/13), opened the same day, shows
  0 checks — the gap the plan exists to close.
- **Two pieces of same-day work claimed the same decision number, and nothing noticed.**
  The plan (committed 14:27) files its decision as CONTEXT D47. US-6.3 (committed 18:05)
  landed a different D47 on `main`. `npm run agile:validate` passes, because each file
  resolves on its own terms. As a result the plan was stale before its first task ran.
- **US-6.3 was split into two stories and merged back 14 minutes later.** `54aadff` filed
  US-6.3 and US-6.4 separately at 16:00; `f891936` folded both into one US-6.3 at 16:14 and
  deleted the two files. No reference to US-6.4 survives (checked at close), so the only
  cost is a scope decision reversed within one sitting.
- **This file's `status:` read `planned` for the whole window**, including the three days
  after its only row flipped `done`. It is [LESSONS 10](../LESSONS.md)'s shape one artifact
  over: nothing reads a sprint's `status:` either, and `agile:check-sprints` checks
  structure, not frontmatter.
- **No release, and still no code.** `VERSION` entered and left the window at `2.8.1`, and
  `src/` has not changed since 2026-08-26 — a third sprint. Seven of the eight §Open work
  items came out unchanged.

### Followups

- **§Open work, unassigned carries to [W38](sprint-2026-W38.md)** — seven items. EPIC-6
  drops out, and the CI-gate item is rewritten to say the gate is designed but not built.
- **If the CI gate is promoted into W38, the plan needs two edits before Task 1**: its
  CONTEXT number (D47 is taken, so the next free one) and its target sprint (W37 is closed,
  so W38). It is one P1 story of 3 points.
- **Dependabot PR #13 is waiting on the same decision.** Merge it now, unchecked like every
  PR before it, or hold it as the first PR the gate runs on.
- **`agile:check-sprints` could be the reader LESSONS 10 asks for.** Flagging a sprint whose
  `end` has passed while `status:` is not `closed` would have caught W35 in August and this
  file this week. This is an idea, not scope.

## Sprint close — 2026-09-14

Closed by the maintainer on 2026-09-14, **one day after the window elapsed on 2026-09-13**,
alongside the open of [W38](sprint-2026-W38.md), so no two sprints are live at once. W35
and W36 were closed together on 2026-09-07, eight days and one day after their windows
elapsed ([CONTEXT D46](../CONTEXT.md)).

**1 story / 3 points. No release, one decision ([D47](../CONTEXT.md)), no lesson.** Six
commits reached `main` in the window, all on 2026-09-11: this file's open (`255eb56`), the
CI gate spec and plan (`354b3fa`, `071f8d7`), and US-6.3 in three (`54aadff`, `f891936`,
`891d06a`). `status:` goes straight from `planned` to `closed`; it never read
`in-progress`.

**Nothing carries as scope**, because the one row is `done`. What carries is §Open work,
unassigned — seven items — into [W38](sprint-2026-W38.md). Every section above
§Retrospective is left as authored. This section is the amendment, not a rewrite
([CONTEXT D21](../CONTEXT.md), RULE-7).

## Cross-references

- [sprint-2026-W36](sprint-2026-W36.md) — prior sprint, closed empty on 2026-09-07; its §Open work is this file's §Open work
- [sprint-2026-W35](sprint-2026-W35.md) — closed the same day, carrying US-2.14 at `2.8.1`
- [STATUS.md](STATUS.md) — generated kanban (RULE-5, never hand-edited)
- [CONTEXT D21](../CONTEXT.md) — scope stays open all week; only the maintainer opens or closes a sprint
- [CONTEXT D30](../CONTEXT.md) — one scope table per sprint file; mid-sprint scope is a row, not a section
- [CONTEXT D45](../CONTEXT.md) — the dashboard host, and the base-URL pairing left unverified
- [CONTEXT D46](../CONTEXT.md) — closing W35 and W36 together, and opening this file
- [EPIC-6](epics/EPIC-6.md) — `in-progress` at this file's open; `done` 2026-09-11 via US-6.3 · [EPIC-3](epics/EPIC-3.md) — `backlog`, the trading write path
- [CONTEXT D47](../CONTEXT.md) — W32/W33 native plan sections removed; `npm run agile:check-sprints` added
- [PR CI gate spec](../superpowers/specs/2026-09-11-pr-ci-gate-design.md) · [plan](../superpowers/plans/2026-09-11-pr-ci-gate-w37.md) — written in this window; not filed as a story, not built
- [CHANGELOG](../CHANGELOG.md) — `2.8.1` is the version this sprint opens **and** closes on
- [sprint-2026-W38](sprint-2026-W38.md) — successor sprint, opened 2026-09-14
