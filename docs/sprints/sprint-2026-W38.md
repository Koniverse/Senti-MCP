---
id: sprint-2026-W38
status: planned
start: 2026-09-14
end: 2026-09-20
goal: 'No committed scope at open — W37 closed on this file''s first day with its one row done, and the corpus holds no open story, so work that arises this week joins the one scope table below as a row'
---

## Sprint scope

| US | Title | Epic | Pri | Points | Status | Story file |
| -- | ----- | ---- | --- | ------ | ------ | ---------- |

**Total: 0 stories / 0 points.** This sprint opens empty. Scope is not frozen
([CONTEXT D21](../CONTEXT.md) rule 1) — work that arises this week is appended here as a row
annotated `_(added YYYY-MM-DD)_`, with the sprint `goal:` extended by a clause. **One table,
one total, no second scope section** ([CONTEXT D30](../CONTEXT.md)), checked by
`npm run agile:check-sprints` ([CONTEXT D47](../CONTEXT.md)).

> AC and Tasks live inside each story file. This table is a planning surface only.

## Sprint goal recap

This is the fifth consecutive sprint to open with no committed scope. The record so far:
W34 absorbed 10 stories mid-window, W35 absorbed one, W36 absorbed none, and
[W37](sprint-2026-W37.md) absorbed one — [US-6.3](stories/US-6.3-sprint-file-convention-cleanup-and-enforcement.md),
3 points, which closed [EPIC-6](epics/EPIC-6.md). An empty open is a starting position here,
not a forecast.

**It is the first open in three sprints with no lifecycle debt behind it.** W37 was closed
on 2026-09-14, this file's first day, so for the first time since W35 no two sprint files
describe a live window at once and no story's `sprint:` points at a closed file while it is
still open. [STATUS.md](STATUS.md) shows 35 stories, all 35 `done`; every epic except
[EPIC-3](epics/EPIC-3.md) is `done`.

`VERSION` reads `2.8.1`, unchanged since 2026-08-25, and nothing under `src/` has changed
since PR #9 merged on 2026-08-26.

**This window has one candidate ready to commit to, and it has not been committed to.** The
pull-request CI gate got a design spec and an implementation plan on 2026-09-11
([spec](../superpowers/specs/2026-09-11-pr-ci-gate-design.md),
[plan](../superpowers/plans/2026-09-11-pr-ci-gate-w37.md)) — one epic, one 3-point story,
task by task. Neither the epic nor the story was ever filed, so it is not a row here.
Promoting it is the maintainer's call ([CONTEXT D21](../CONTEXT.md) rule 2) and was not
part of this open. See §Open work below for what has to change in the plan first.

## Parked / deferred from W37

**Nothing carried.** [W37](sprint-2026-W37.md) closed `1 story / 3 points` on 2026-09-14 with
its one row `done`. Verified at open against the `status:` frontmatter of every file in
[stories/](stories/) — 35 files, 35 `done` — and against [STATUS.md](STATUS.md), not against
W37's own closing text.

- ✅ **Closed in W37**: [US-6.3](stories/US-6.3-sprint-file-convention-cleanup-and-enforcement.md)
  — 3 points, no version cut (tooling and documentation only, [CONTEXT D47](../CONTEXT.md)),
  closing [EPIC-6](epics/EPIC-6.md).
- 🚧 **Carried into W38**: none.
- 🟢 **Carried into W38 as `ready`**: none.
- 🗑️ **Retired in W37**: none. US-6.4 existed for 14 minutes on 2026-09-11 and was folded
  into US-6.3 before the window's work landed; it was never a scope row and never shipped.

## Open work, unassigned

**This is not scope.** It is the standing list of what is open in the repository with no
story owning it, carried forward so an empty scope table is not mistaken for an empty
backlog. Anything promoted here becomes a story first, then a row in the table above. Every
item was re-verified against the working tree at this file's open. W37 carried eight; one
closed ([EPIC-6](epics/EPIC-6.md)), so seven carry.

- **Nothing runs on a pull request — now carried a sixth sprint, but for the first time with
  a plan behind it.** `.github/workflows/` still holds only `release.yml` (re-checked at
  open). What changed in W37 is that the gate is designed: the
  [spec](../superpowers/specs/2026-09-11-pr-ci-gate-design.md) settles gate-vs-signal, the
  ruleset, and admin bypass, and the [plan](../superpowers/plans/2026-09-11-pr-ci-gate-w37.md)
  breaks it into EPIC-9 / US-9.1 (P1, 3 points). None of it is built: EPIC-9 and US-9.1 do
  not exist as files, and the local `ci/pr-gate` branch carries no commits of its own. Two
  things in the plan are stale before it starts:
  - **It files its decision as CONTEXT D47, and D47 is taken.** US-6.3 landed a different
    D47 on `main` four hours after the plan was written. The plan's own rule — any change
    after D47 reaches `main` is D48 — now means its decision takes the next free number.
  - **It targets W37 as the sprint US-9.1 joins.** W37 is closed; a promotion lands here.

  The cost is concrete, not hypothetical: Dependabot's
  [PR #13](https://github.com/Koniverse/Senti-MCP/pull/13), open since 2026-09-11, shows
  **0 checks**.
- **`register` — the eighth authoring write — is unimplemented and owned by no story.**
  [EPIC-8](epics/EPIC-8.md) shipped seven of the `Authoring` tag's eight writes. The eighth
  needs a story that settles the delete-asymmetry question first
  ([EPIC-8](epics/EPIC-8.md) §What this close does not claim).
- **No write tool has ever run against production.** Everything from `2.5.0` to `2.8.1` was
  measured against `be-dev.sentitrade.xyz`. The smoke key holds `authoring:write` on
  `api.sentitrade.xyz` by probe, but no draft has been created there by this server.
- **One `curl` still settles [CONTEXT D45](../CONTEXT.md)** — now carried a fourth sprint. A
  single authenticated call to `https://api.sentitrade.xyz/api/v1/accounts` decides whether
  the pairing caveat is deleted from `README.md` and `docs/SETUP.md` (still present at
  `docs/SETUP.md` §troubleshooting, re-checked at open) or whether `DEFAULT_BASE_URL` needs
  its own story. Written up in [US-2.14](stories/US-2.14-api-keys-dashboard-host.md)
  §Remaining work. Either outcome supersedes D45 by revision, never by edit (RULE-7).
- **Ten [CONTEXT](../CONTEXT.md) entries still read `(planned)` on a version that has
  shipped** — D32, D33, and D36 → D43. Count re-checked at open: still ten. Whoever clears
  them decides once whether that field is metadata to complete or a record to revise under
  RULE-7.
- **An offline MT5 terminal and a symbol-rich account still block three recorded EPIC-2
  gaps** ([EPIC-2](epics/EPIC-2.md) §Live payload findings). Unchanged, and this is the
  ninth sprint carrying it.
- **[EPIC-3](epics/EPIC-3.md) is `backlog`** — the trading write path (deploy, stop, close,
  cancel), a placeholder epic with no stories, and now the only epic in the repo not `done`.

## Retrospective

<!-- Filled on sprint close. -->

### What went well

- TBD

### What didn't

- TBD

### Followups

- TBD

## Cross-references

- [sprint-2026-W37](sprint-2026-W37.md) — prior sprint, closed 2026-09-14 with US-6.3 `done`; its §Open work is this file's §Open work, less EPIC-6
- [STATUS.md](STATUS.md) — generated kanban (RULE-5, never hand-edited)
- [CONTEXT D21](../CONTEXT.md) — scope stays open all week; only the maintainer opens or closes a sprint
- [CONTEXT D30](../CONTEXT.md) — one scope table per sprint file; mid-sprint scope is a row, not a section
- [CONTEXT D47](../CONTEXT.md) — the convention is now checked by `npm run agile:check-sprints`
- [CONTEXT D45](../CONTEXT.md) — the dashboard host, and the base-URL pairing left unverified
- [PR CI gate spec](../superpowers/specs/2026-09-11-pr-ci-gate-design.md) · [plan](../superpowers/plans/2026-09-11-pr-ci-gate-w37.md) — designed in W37, not filed, not built
- [EPIC-3](epics/EPIC-3.md) — `backlog`, the trading write path
- [CHANGELOG](../CHANGELOG.md) — `2.8.1` is the version this sprint opens on
