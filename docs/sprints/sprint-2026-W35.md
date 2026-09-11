---
id: sprint-2026-W35
status: closed
start: 2026-08-24T00:00:00.000Z
end: 2026-08-30T00:00:00.000Z
goal: 'No committed scope at open — nothing carried from W34, and work that arises this week joins the one scope table below as a row; extended 2026-08-25 with US-2.14, correcting the API Keys dashboard host in the onboarding path'
---
## Sprint scope

| US      | Title                                                                                      | Epic   | Pri | Points | Status | Story file                                            |
| ------- | ------------------------------------------------------------------------------------------ | ------ | --- | ------ | ------ | ----------------------------------------------------- |
| US-2.14 | The API Keys dashboard host, and what the default base URL pairs with *(added 2026-08-25)* | EPIC-2 | P2  | 2      | ✅ done | [US-2.14](stories/US-2.14-api-keys-dashboard-host.md) |

**Total: 1 story / 2 points.** This sprint opened empty, and not by oversight: every
story in the corpus was `done`, so there was nothing to carry
(see §Parked / deferred from W34 below). US-2.14 was appended on 2026-08-25 as
mid-window scope, which is the documented shape rather than an exception. Scope is
not frozen ([CONTEXT D21](../CONTEXT.md) rule 1) — work that arises this week is
appended here as a row annotated `_(added YYYY-MM-DD)_`, with the sprint `goal:` extended by a clause. **One
table, one total, no second scope section** ([CONTEXT D30](../CONTEXT.md)).

> AC and Tasks live inside each story file. This table is a planning surface only.

## Sprint goal recap

[sprint-2026-W34](sprint-2026-W34.md) closed on 2026-08-21 with all 10 rows `done` and
stated plainly that nothing carries. That was true at this file's open on 2026-08-24: all
33 stories in `docs/sprints/stories/` were `done`, and [STATUS.md](STATUS.md) showed `0` at
Backlog, Ready, In Progress, Review and Blocked. There was therefore no carry-over table to
write and no `ready` story waiting for pickup.

**Since the open**, US-2.14 was added on 2026-08-25 and sits at `review` pending
[PR #9](https://github.com/Koniverse/Senti-MCP/pull/9) — 34 stories, one of them not
`done`. That is mid-window scope, not carry-over.

What is open is not stories. It is six followups from W34's retrospective and two epics with
no stories assigned — listed under §Open work, unassigned below. None of it is scope until a
story exists for it and a row appears in the table above; scheduling that is the
maintainer's ([CONTEXT D21](../CONTEXT.md) rule 2).

This is the second consecutive sprint to open with no committed scope. W34 did the same on
2026-08-17 and absorbed 10 stories across two mid-window tranches — proof that an empty open
is a starting position in this repo, not a forecast of an empty week.

## Parked / deferred from W34

**Nothing carried.** No story reached this sprint from W34. The only story in the corpus
that is not `done` is US-2.14, which was written *in* this window, not carried into it.

- ✅ **Closed in W34** — all 10 rows, 27 points: US-6.1, US-6.2 (EPIC-6);
  US-7.1 → US-7.4 (EPIC-7, closed); US-8.1 → US-8.4 (EPIC-8, closed). Eight releases,
  `2.1.0` → `2.8.0`.
- 🚧 **Carried into W35**: none.
- 🟢 **Carried into W35 as `ready`**: none.
- 🗑️ **Retired in W34**: none.

Verified at open against [STATUS.md](STATUS.md) (33 stories, 33 `done`) and against the
`status:` frontmatter of every file in [stories/](stories/), not against W34's own closing
claim.

## Open work, unassigned

**This is not scope.** It is the standing list of what is open in the repository with no
story owning it, carried forward so an empty scope table is not mistaken for an empty
backlog. Anything promoted here becomes a story first, then a row in the table above.

- **`register` — the eighth authoring write — is unimplemented and owned by no story.**
  [EPIC-8](epics/EPIC-8.md) shipped seven of the `Authoring` tag's eight writes. The eighth
  needs a story that settles the delete-asymmetry question first
  ([EPIC-8](epics/EPIC-8.md) §What this close does not claim).
- **No write tool has ever run against production.** Everything from `2.5.0` to `2.8.0` was
  measured against `be-dev.sentitrade.xyz`. The smoke key holds `authoring:write` on
  `api.sentitrade.xyz` by probe, but no draft has been created there by this server.
- **Nothing runs on a pull request — now carried a third sprint, with a merged PR behind
  it.** `.github/workflows/` still holds only `release.yml`, triggered on `v*` tags. PR #8
  carried EPIC-8's 14 points into `main` with no typecheck, test or build gate. W33 called
  this "the highest-value unbuilt thing in this repo"; W34 added the first merge commit it
  would have caught.
- **[EPIC-6](epics/EPIC-6.md) stays `in-progress` on questions 3 and 5.** Question 5 — *is
  the convention enforced by anything, or is it prose?* — is unanswered: nothing in the
  repository fails if the next sprint file grows a second scope table.
- **Ten [CONTEXT](../CONTEXT.md) entries still read `Version: (planned)` for versions that
  have shipped** — D32, D33, and D36 → D43. Whoever clears them decides once whether that
  field is metadata to complete or a record to revise under RULE-7.
- **An offline MT5 terminal and a symbol-rich account still block three recorded EPIC-2
  gaps** ([EPIC-2](epics/EPIC-2.md) §Live payload findings). Unchanged, and this is the
  sixth sprint carrying it.
- **[EPIC-3](epics/EPIC-3.md) is `backlog`** — the trading write path (deploy, stop, close,
  cancel), a placeholder epic with no stories.

## Retrospective

**One retrospective, written at the close on 2026-09-07, measuring the single row.** It is
written eight days after the window elapsed, from `git log`, the story file and the
CHANGELOG rather than from memory — which is itself the first thing it has to report.

### What went well

- **The over-claim was withdrawn before review, not after.** `b03b6ea` shipped the host
  swap and asserted alongside it that the default `SENTI_API_BASE_URL` pairs with no
  dashboard — a guaranteed `401` for anyone who never overrides it. `c6079bb`, the same
  day, withdrew that from `README.md`, `docs/SETUP.md`, the `2.8.1` CHANGELOG entry and
  PR #9's body. What killed it was probing the two API hosts directly instead of
  re-reading the bundle that suggested it: `api.sentitrade.xyz` and `be-dev.sentitrade.xyz`
  answer every unauthenticated request byte-identically, down to a 96,131-byte OpenAPI
  document ([CONTEXT D45](../CONTEXT.md)). W34's retrospective records the opposite shape —
  EPIC-7 shipping `done` and then taking two review waves to be right.
- **The story shipped what it could settle and named what it could not.**
  [US-2.14](stories/US-2.14-api-keys-dashboard-host.md) §Remaining work is one `curl`, with
  both outcomes pre-decided and explicitly placed out of scope; D45 carries an §Open field
  saying the same. Nothing was guessed into a default that every installation depends on.
- **An empty open absorbed the week's actual work, as designed.** W35 committed to nothing
  on 2026-08-24 and took US-2.14 as one row annotated `_(added 2026-08-25)_` plus a clause
  on `goal:` — one table, one total, no second section ([CONTEXT D30](../CONTEXT.md)). Third
  consecutive sprint where that held.
- **First story in the corpus authored by someone other than the maintainer.** US-2.14 is
  `jindo9986`; all 33 stories before it are `bluezdot`.

### What didn't

- **The story never left `review`, and the sprint never closed on time.** Code shipped
  `2.8.1` on 08-25 and PR #9 merged on 08-26, but the story file sat at `status: review`
  with an empty `version_shipped:` for twelve days. Nothing blocked the flip — Tasks were
  all `[x]`, the CHANGELOG entry was already in, the §3c checklist had no outstanding item.
  It was simply never made, and W36 opened on top of it and had to spend a §Parked section
  auditing the gap. Written up as [LESSONS 10](../LESSONS.md): `status:` is the one field in
  the corpus with no reader, and `npm run agile:validate` exits `0` with a shipped story
  sitting at `review`.
- **This retrospective is reconstructed, not remembered.** [CONTEXT D21](../CONTEXT.md)
  rule 2 reserves the close to the maintainer, which is why the file waited; the cost of
  waiting eight days is that every date in this section came out of `git log`.
- **Nothing still runs on a pull request — a fourth sprint carrying it.** PR #9 merged
  `2.8.1` into `main` with no typecheck, test or build gate, the second merged PR in two
  sprints that one would have caught. `.github/workflows/` still holds only `release.yml`,
  on `v*` tags. W33 called this "the highest-value unbuilt thing in this repo".
- **The one `curl` that settles D45 was not run in the window that wrote it.** It needs a
  real key and about a minute, and it decides whether a caveat gets deleted from two
  user-facing documents or `DEFAULT_BASE_URL` needs its own story.

### Followups

- **Every item in §Open work, unassigned carries forward unchanged.** None of the seven was
  touched this window.
- **D45's settling call**, still unmade — carried into [W36](sprint-2026-W36.md) and out of
  it again.
- **Ten [CONTEXT](../CONTEXT.md) entries still read `Version: (planned)` for versions that
  have shipped** — D32, D33, and D36 → D43. Unchanged for a second sprint.

## Sprint close — 2026-09-07

Closed by the maintainer on 2026-09-07, **eight days after the window elapsed on
2026-08-30**, together with [W36](sprint-2026-W36.md) and alongside the open of
[W37](sprint-2026-W37.md) ([CONTEXT D46](../CONTEXT.md)). W36 was opened over a still-live
W35 on 2026-09-04 and named that overlap as one of two open lifecycle decisions; this close
answers it.

**1 story / 2 points, `done`; one release, `2.8.1`; one decision
([CONTEXT D45](../CONTEXT.md)); five commits, all but one on 2026-08-25.** No epic opened or
closed — [EPIC-2](epics/EPIC-2.md) was already `done` and US-2.14 does not reopen it. No
tool, input schema or response shape changed, so the offline suite stands where W34 left it
at **673 passed, 2 skipped**.

**US-2.14 is credited to this sprint, not to W36.** Its `sprint:` frontmatter has read
`sprint-2026-W35` since it was written, its code shipped on 08-25 inside this window, and a
`done` story's sprint assignment is locked history. W36 deliberately kept it out of its own
scope table for that reason; the only thing this close changes is the story's own
`status:` and `version_shipped:`, which the §3c checklist had been ready for since 08-26.

§Sprint goal recap above is left as written on 2026-08-24 and 2026-08-25, including its
"sits at `review` pending PR #9" sentence. It records what was true when written; this
section is the amendment, not a rewrite of it ([CONTEXT D21](../CONTEXT.md)).

**Nothing carries as scope.** No story in the corpus sits at `backlog`, `ready`,
`in-progress`, `review` or `blocked` after this commit. What carries is §Open work,
unassigned — the seven items listed below, none owned by a story — into
[W37](sprint-2026-W37.md) by way of [W36](sprint-2026-W36.md), which closes empty. W36
carries eight: US-2.14 shipped with an open question, so D45's settling call joined the list
as this sprint's own contribution to it.

## Cross-references

- [sprint-2026-W34](sprint-2026-W34.md) — prior sprint; its §Followups are this file's §Open work
- [STATUS.md](STATUS.md) — generated kanban (RULE-5, never hand-edited)
- [CONTEXT D21](../CONTEXT.md) — scope stays open all week; only the maintainer opens or closes a sprint
- [CONTEXT D30](../CONTEXT.md) — one scope table per sprint file; mid-sprint scope is a row, not a section
- [EPIC-6](epics/EPIC-6.md) — `in-progress`, questions 3 and 5 · [EPIC-3](epics/EPIC-3.md) — `backlog`, the trading write path
- [EPIC-7](epics/EPIC-7.md) · [EPIC-8](epics/EPIC-8.md) — the authoring read and write paths, both closed in W34
- [CHANGELOG](../CHANGELOG.md) — `2.8.0` is the version this sprint opens on; it closes on `2.8.1`
- [sprint-2026-W36](sprint-2026-W36.md) — opened 2026-09-04 over this still-live window; closed empty on the same day as this file
- [sprint-2026-W37](sprint-2026-W37.md) — successor sprint, opened 2026-09-07
- [CONTEXT D45](../CONTEXT.md) — US-2.14's decision · [CONTEXT D46](../CONTEXT.md) — this close
