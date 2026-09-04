---
id: sprint-2026-W36
status: planned
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

<!-- Filled on sprint close by the maintainer (CONTEXT D21 rule 2). -->

### What went well

- TBD

### What didn't

- TBD

### Followups

- TBD

## Cross-references

- [sprint-2026-W35](sprint-2026-W35.md) — prior sprint, **still `planned` and not closed**; its §Open work is this file's §Open work
- [STATUS.md](STATUS.md) — generated kanban (RULE-5, never hand-edited)
- [CONTEXT D21](../CONTEXT.md) — scope stays open all week; only the maintainer opens or closes a sprint
- [CONTEXT D30](../CONTEXT.md) — one scope table per sprint file; mid-sprint scope is a row, not a section
- [CONTEXT D45](../CONTEXT.md) — the dashboard host, and the base-URL pairing left unverified
- [US-2.14](stories/US-2.14-api-keys-dashboard-host.md) — `review`, assigned to W35, shipped as `2.8.1`
- [EPIC-6](epics/EPIC-6.md) — `in-progress`, questions 3 and 5 · [EPIC-3](epics/EPIC-3.md) — `backlog`, the trading write path
- [CHANGELOG](../CHANGELOG.md) — `2.8.1` is the version this sprint opens on
