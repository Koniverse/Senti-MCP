---
id: sprint-2026-W36
status: closed
start: 2026-08-31
end: 2026-09-06
goal: 'No committed scope at open — W35 is still open behind this one and nothing has been committed since 2026-08-26, so work that arises this week joins the one scope table below as a row'
---

## Sprint scope

| US | Title | Epic | Pri | Points | Status | Story file |
| -- | ----- | ---- | --- | ------ | ------ | ---------- |

**Total: 0 stories / 0 points.** This sprint opens empty. Unlike W34 and W35 that is not
because the corpus is clean — [US-2.14](stories/US-2.14-api-keys-dashboard-host.md) sits at
`review` and belongs to [W35](sprint-2026-W35.md), which is still open (see §Parked /
deferred from W35). Scope is not frozen ([CONTEXT D21](../CONTEXT.md) rule 1) — work that
arises this week is appended here as a row annotated `_(added YYYY-MM-DD)_`, with the sprint
`goal:` extended by a clause. **One table, one total, no second scope section**
([CONTEXT D30](../CONTEXT.md)).

> AC and Tasks live inside each story file. This table is a planning surface only.

## Sprint goal recap

This is the third consecutive sprint to open with no committed scope. W34 opened that way on
2026-08-17 and absorbed 10 stories across two mid-window tranches; W35 opened that way on
2026-08-24 and absorbed one. An empty open is a starting position in this repo, not a
forecast of an empty week.

**W35 has not been closed, and this file does not close it.** Its window elapsed on
2026-08-30, but its frontmatter still reads `status: planned` and its §Retrospective still
reads `TBD`. That is deliberate: [CONTEXT D21](../CONTEXT.md) rule 2 reserves both the open
and the close of a sprint to the maintainer, and no agent flips that `status:` or writes
that retrospective on its own initiative. W36 is opened here because the maintainer asked
for it; W35's close was not asked for, so W35 stays as it is and this file states the
overlap rather than papering over it.

The repository has been quiet since. The last commit is `96eeb4b` on 2026-08-26 — the merge
of [PR #9](https://github.com/Koniverse/Senti-MCP/pull/9) — and `VERSION` reads `2.8.1`.
[STATUS.md](STATUS.md) shows 34 stories: 33 `done`, one at `review`, and `0` at Backlog,
Ready, In Progress and Blocked. There is no `ready` story waiting for pickup, so nothing
was available to commit to this window without writing a new story first.

## Parked / deferred from W35

W35 is `planned`, not `closed`, so this is an audit of state rather than a hand-off. Verified
at open against the `status:` frontmatter of every file in [stories/](stories/) and against
[STATUS.md](STATUS.md), not against W35's own text.

- ✅ **Closed in W35**: none. No story flipped to `done` in that window.
- 🚧 **Carried into W36**: [US-2.14](stories/US-2.14-api-keys-dashboard-host.md) — and only
  in the informal sense. Its `sprint:` frontmatter still reads `sprint-2026-W35`, and it is
  deliberately **not** a row in the table above, because moving it would rewrite an open
  sprint's scope. Its code shipped: `2.8.1` was cut on 2026-08-25 and PR #9 merged on
  2026-08-26. Its story file did not follow — `status:` is still `review` and
  `version_shipped:` is still empty. Reconciling that is one of the two decisions listed
  below.
- 🟢 **Carried into W36 as `ready`**: none.
- 🗑️ **Retired in W35**: none.

### The two open lifecycle decisions

Both are the maintainer's ([CONTEXT D21](../CONTEXT.md) rule 2). Neither is scope until it
becomes one.

1. **Close W35, or leave it open.** Closing it means filling its retrospective and flipping
   `status: closed`. Leaving it open means W35 and W36 both describe live windows, which
   D21's rule 1 permits but nothing in the corpus has done before.
2. **Flip US-2.14 to `done`, or keep it at `review`.** The §3c checklist is all that stands
   in the way: `version_shipped: 2.8.1`, `status: done`, Tasks already all `[x]`, CHANGELOG
   entry already present at `2.8.1`. Which sprint gets credit for it follows from decision 1.

## Open work, unassigned

**This is not scope.** It is the standing list of what is open in the repository with no
story owning it, carried forward so an empty scope table is not mistaken for an empty
backlog. Anything promoted here becomes a story first, then a row in the table above. Every
item below was re-verified against the working tree at this file's open.

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
  never by edit (RULE-7).
- **Nothing runs on a pull request — now carried a fourth sprint, with two merged PRs behind
  it.** `.github/workflows/` still holds only `release.yml`, triggered on `v*` tags. PR #8
  carried EPIC-8's 14 points into `main` and PR #9 carried `2.8.1`, neither through a
  typecheck, test or build gate. W33 called this "the highest-value unbuilt thing in this
  repo".
- **[EPIC-6](epics/EPIC-6.md) stays `in-progress` on questions 3 and 5.** Question 5 — *is
  the convention enforced by anything, or is it prose?* — is still unanswered: nothing in the
  repository fails if the next sprint file grows a second scope table.
- **Ten [CONTEXT](../CONTEXT.md) entries still read `(planned)` on a version that has
  shipped** — D32, D33, and D36 → D43. Count re-checked at open: still ten. Whoever clears
  them decides once whether that field is metadata to complete or a record to revise under
  RULE-7.
- **An offline MT5 terminal and a symbol-rich account still block three recorded EPIC-2
  gaps** ([EPIC-2](epics/EPIC-2.md) §Live payload findings). Unchanged, and this is the
  seventh sprint carrying it.
- **[EPIC-3](epics/EPIC-3.md) is `backlog`** — the trading write path (deploy, stop, close,
  cancel), a placeholder epic with no stories.

## Retrospective

**One retrospective, written at the close on 2026-09-07, measuring an empty scope table.**
It is the first sprint in this repo to close with nothing in it, and the honest version of
that is short.

### What went well

- **The file refused to paper over W35, and that is why this close needed no archaeology.**
  It stated plainly that W35's window had elapsed while its `status:` still read `planned`,
  declined to close it, and wrote the overlap down instead of smoothing it away. It then
  enumerated the two open lifecycle decisions — close W35 or leave it open; flip US-2.14 or
  keep it at `review` — with the §3c evidence for the second already gathered. Both were
  answerable on 2026-09-07 by reading this section, which is the whole value of having
  written it.
- **US-2.14 was kept out of this file's scope table on purpose.** Its `sprint:` frontmatter
  read `sprint-2026-W35` and moving it would have rewritten an open sprint's scope. That
  restraint is what let W35 close carrying its own row a week later, rather than the two
  files arguing over one story.
- **The §Parked audit was verified against story frontmatter and [STATUS.md](STATUS.md),
  not against W35's own text**, and it was right on every count — 34 stories, 33 `done`,
  one at `review`, `version_shipped:` empty. That it took a hand audit to surface is
  [LESSONS 10](../LESSONS.md) — no command in this repo reports it.

### What didn't

- **Zero stories, zero points, zero releases.** The one commit inside the window,
  `52da7f9` on 2026-09-04, is this file's own creation. Nothing else happened between
  2026-08-31 and 2026-09-06; `VERSION` entered and left the window at `2.8.1`. The repo's
  three previous empty opens each absorbed work (W34 took 10 stories, W35 took 1); this one
  did not, and calling it anything but an empty sprint would be fiction.
- **It was opened on day 5 of its own 7-day window** — the same lateness it diagnosed in
  W35 one paragraph earlier. The file described the pattern accurately and then repeated it.
- **Two sprints were live simultaneously for the entire window.**
  [CONTEXT D21](../CONTEXT.md) rule 1 permits it and nothing broke, but the cost was a
  §Parked section that had to explain a hand-off which was not one, and a reader who had to
  hold two open windows in mind to know where a story lived.
- **Every carried item came out unchanged.** All eight §Open work entries went in on 09-04
  and none moved: `register` still unowned, no write tool ever run against production,
  still nothing on a pull request, D45's one `curl` still unmade,
  [EPIC-6](epics/EPIC-6.md) still `in-progress` on questions 3 and 5, ten CONTEXT entries
  still `(planned)`, the MT5 gaps into their seventh sprint,
  [EPIC-3](epics/EPIC-3.md) still `backlog`.

### Followups

- **§Open work, unassigned carries to [W37](sprint-2026-W37.md) verbatim** — eight items,
  none owned by a story, none touched this window.
- **Three consecutive opens with no committed scope, and this one shipped nothing.** Two of
  the three worked because scope arrived mid-window; this one had none arrive. Whether that
  is a planning cadence to fix or an accurate reading of a repo whose four shipped epics are
  all closed is worth deciding once — the standing backlog is eight unowned items, two of
  which are epics carrying no stories at all ([EPIC-6](epics/EPIC-6.md) `in-progress`,
  [EPIC-3](epics/EPIC-3.md) `backlog`). Promoting even one of them into a story would give
  W37 something to commit to at open.

## Sprint close — 2026-09-07

Closed by the maintainer on 2026-09-07, **one day after the window elapsed on 2026-09-06**,
together with [W35](sprint-2026-W35.md) and alongside the open of
[W37](sprint-2026-W37.md) ([CONTEXT D46](../CONTEXT.md)).

**0 stories / 0 points. No release, no decision, no lesson, one commit — this file.** The
first sprint in the repo to close empty, and it is closed rather than merged into a
neighbour or quietly deleted: the window existed and produced nothing, and the record says
so.

**Both open lifecycle decisions above are now answered**, in the direction §Parked
anticipated. W35 is `closed` with its retrospective written and US-2.14 as its one `done`
row at `2.8.1`. This file gains no rows in the process — it recorded US-2.14 as carried
"only in the informal sense" and that is exactly how it stays.

**Nothing carries as scope**, because nothing was ever committed. What carries is §Open
work, unassigned — eight items, unchanged from the day this file opened — into
[W37](sprint-2026-W37.md).

## Cross-references

- [sprint-2026-W35](sprint-2026-W35.md) — prior sprint; `planned` and open throughout this window, closed 2026-09-07 on the same day as this file. Its §Open work is this file's §Open work
- [STATUS.md](STATUS.md) — generated kanban (RULE-5, never hand-edited)
- [CONTEXT D21](../CONTEXT.md) — scope stays open all week; only the maintainer opens or closes a sprint
- [CONTEXT D30](../CONTEXT.md) — one scope table per sprint file; mid-sprint scope is a row, not a section
- [CONTEXT D45](../CONTEXT.md) — the dashboard host, and the base-URL pairing left unverified
- [US-2.14](stories/US-2.14-api-keys-dashboard-host.md) — shipped as `2.8.1`; at `review` throughout this window, flipped `done` under W35 on 2026-09-07
- [EPIC-6](epics/EPIC-6.md) — `in-progress`, questions 3 and 5 · [EPIC-3](epics/EPIC-3.md) — `backlog`, the trading write path
- [CHANGELOG](../CHANGELOG.md) — `2.8.1` is the version this sprint opens **and** closes on
- [sprint-2026-W37](sprint-2026-W37.md) — successor sprint, opened 2026-09-07
- [CONTEXT D46](../CONTEXT.md) — closing W35 and W36 together, and where US-2.14's credit lands
