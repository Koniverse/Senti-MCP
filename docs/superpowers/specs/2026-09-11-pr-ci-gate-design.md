# senti-mcp-server — pull-request CI gate design

**Date:** 2026-09-11
**Status:** approved in brainstorm, awaiting written-spec review
**Supersedes nothing.** [EPIC-4](../../sprints/epics/EPIC-4.md) §Out of scope left this
open on purpose — *"whether every push should run CI is a separate decision"* — and
[RELEASE.md](../../RELEASE.md) §7 repeats it. This document is that separate decision. It
revises no [CONTEXT](../../CONTEXT.md) entry: [D16](../../CONTEXT.md) chose the release
workflow and said nothing about pushes.

## Problem

`.github/workflows/` holds one file, `release.yml`, triggered by `push` of a `v*` tag and
by nothing else. Every check this repository owns — `typecheck`, `test`, `build`,
`release:verify-pack` — therefore runs for the first time on a commit that is already on
`main` and already tagged. A defect that reaches `main` is found, at the earliest, at the
moment someone tries to publish it.

That is not hypothetical, and it has been written down five sprints running:

- **Two defects reached `main` in W33** and were caught only by rehearsing a release: the
  `release:check` argument bug ([LESSONS 5](../../LESSONS.md)) and the annotated-tag guard
  that could never pass ([LESSONS 6](../../LESSONS.md)). W33 §Phase 2 retrospective names
  the gap.
- **Dependabot has opened PRs weekly since US-5.3**, and `.github/dependabot.yml`'s header
  tells whoever is about to merge one that *"a green Dependabot PR here proves almost
  nothing"* ([US-5.3](../../sprints/stories/US-5.3-devdependency-currency-and-dependabot.md)
  §AC-6).
- **TypeScript 7 is this repo's build**, not only its typechecker, and
  [D29](../../CONTEXT.md) records that an emit regression *"would not be caught before a
  tag"*.
- **PR #8 (EPIC-8, 14 points) and PR #9 (`2.8.1`) merged** without any of the four checks
  running on them.
- W33 §Phase 4 Followups called a `pull_request` workflow *"the highest-value unbuilt thing
  in this repo"*. W34, W35, W36 and W37 each carried it forward, unowned.

And `main` has no protection at all (`gh api …/branches/main/protection` → 404, no
rulesets), so even a workflow that ran would be a signal, not a gate.

## Scope of this design

**In:** one new workflow that runs the release path's `build` and `verify` checks on every
pull request into `main` and every push to it; one repository ruleset on `main` that makes
that workflow's result a merge requirement; the documentation that stops describing the
gap as open.

**Out:** see §Out of scope. Nothing here touches `release.yml`, `src/`, the tarball, or the
version.

## Decisions taken

Settled in the 2026-09-11 brainstorm, in order.

| # | Question | Decision | Rejected |
|---|---|---|---|
| 1 | What runs | `typecheck`, `test`, `build`, `release:verify-pack` — `release.yml`'s `build` and `verify` jobs, verbatim | *build only* (packaging and emit defects still surface only at a tag); *plus `agile:validate` and a version-free Node-floor check* (pulls a refactor of `release-check.mjs` into scope) |
| 2 | Signal or gate | **Gate** — a ruleset makes the check required | *signal only* (leaves "nothing gates a merge" true after the story); *a second story for enforcement* (one epic, one story is enough) |
| 3 | Where the docs live | **New [EPIC-9](../../sprints/epics/EPIC-9.md)**, EPIC-4 stays `done` | *US-4.6 under a reopened EPIC-4* — EPIC-4 excluded this deliberately, so it is a new decision, not EPIC-4's missing piece |
| 4 | Direct pushes to `main` | **Repository admins may bypass** | *no bypass* — every sprint open/close commit becomes a PR plus a CI run |
| 5 | Workflow shape | **Standalone `ci.yml`, one job** | *two jobs mirroring release* (two required checks, `npm ci` twice, and `verify-pack` rebuilds anyway); *a reusable `workflow_call` shared with `release.yml`* (edits the irreversible publish path, which only a real tag run can prove — the W33 lesson) |
| 6 | Bypass mode | **`always`** | *`pull_request` only* (blocks every direct push, contradicting #4); *demote a collaborator* (a people decision outside this story) |

**What #4 and #6 mean together, stated rather than implied:** both people with push access
— `bluezdot` and `jindo9986` — hold the `admin` role (checked 2026-09-11 via
`gh api repos/Koniverse/Senti-MCP/collaborators/<login>/permission`). So *admins may
bypass* is *everyone may bypass*. The ruleset is not a lock. What it changes:

- **Merging a red or pending PR in the UI** requires ticking *"Merge without waiting for
  requirements to be met (bypass rules)"*. It cannot happen by accident, and it is logged
  in the ruleset's insights.
- **A direct push to `main`** still lands — git prints `Bypassed rule violations` — and is
  logged. It is also verified *after* it lands, because `ci.yml` runs on `push` to `main`.
- **Dependabot** and anyone without the admin role cannot merge red at all.

That is the gate this design buys: no merge into `main` is unverified by default, and every
exception is deliberate and recorded. A lock would need a role change first.

## The workflow — `.github/workflows/ci.yml`

**Invariant:** a green `verify` on a commit means `release.yml`'s `build` and `verify` jobs
will be green on that same commit. The steps are those two jobs, concatenated, with the
same pins. `gate`, `publish` and `announce` have no counterpart — they are about a tag.

```yaml
name: ci

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  verify:
    name: verify
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5
      - uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5
        with:
          node-version: 22.11.0
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - run: npm run release:verify-pack
```

The file's own comments carry the reasons below, in the style `release.yml` set.

- **No path filter.** A required check whose workflow is skipped by `paths` or
  `paths-ignore` stays *Pending* forever and blocks the PR. A docs-only PR runs the whole
  suite; on a public repository that costs about two minutes and nothing else.
- **`push` on `main`, not only `pull_request`.** It is what verifies a bypassed direct push,
  and it gives `main`'s head a status of its own. `cancel-in-progress` is on for pull
  requests only: a newer push to a PR branch makes the older run moot, but every commit on
  `main` gets its own verdict.
- **`pull_request`, never `pull_request_target`.** The job needs no secret, so fork and
  Dependabot PRs run it with a read-only token. `pull_request_target` would run fork code
  with a write token.
- **No `SENTI_*` variable.** Same as `release.yml`'s `build`: the suite is hermetic and
  `src/smoke.test.ts` skips itself without `SENTI_SMOKE_KEY`.
- **Node `22.11.0` only, no matrix.** The floor is the claim made to consumers
  ([D27](../../CONTEXT.md)); maintainers already run newer Node locally. Trigger to add a
  matrix leg: the first defect that reproduces only above the floor.
- **SHA pins copied character for character from `release.yml`.** Two files pinning the
  same action to different SHAs is drift nobody asked for. When one moves, both move.
- **`name: verify` is load-bearing.** It is the exact string the ruleset requires. Renaming
  the job means the required check never reports and every PR blocks until the ruleset is
  updated to match — the comment on that line says so.
- **`test` before `build`**, as in `release.yml`. `src/index.test.ts` builds in its own
  `beforeAll` and `verify-pack` builds again; the redundant `tsc` runs cost seconds and buy
  step-for-step parity with the release path.

### What a green `verify` proves, and what it does not

Proves, on Node `22.11.0`, hermetically: the source typechecks under both tsconfigs, the
unit suite passes, `tsc` emits a runnable `dist/`, and the packed tarball installs into a
clean directory and serves a `tools/list` that matches both the build and the README's tool
table.

Does **not** prove: anything against the live Senti API (`test:smoke` needs a key); version
agreement across the five places the version lives, or Node-floor agreement across
`package.json`, `README.md` and `docs/SETUP.md` (`release:check`, at tag time); that a
transitive dependency's `engines` still admits the floor ([D28](../../CONTEXT.md) — still a
manual `npm ls vite --all`); behaviour on Node above the floor; or that `publish` can
authenticate. The Dependabot header keeps the parts of this list that concern it.

## The ruleset on `main`

A **repository ruleset**, not classic branch protection: rulesets take role-based bypass
actors, are readable over the API by anyone with read access, and round-trip as JSON.

```json
{
  "name": "main: verify before merge",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/main"], "exclude": [] } },
  "bypass_actors": [
    { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" }
  ],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [{ "context": "verify", "integration_id": 15368 }]
      }
    }
  ]
}
```

| Rule | Why |
|---|---|
| `pull_request`, 0 approvals | Changes arrive through a PR so `verify` has something to attach to. Required approvals would lock out a single maintainer, who cannot approve their own PR. |
| `required_status_checks`: `verify` | The gate itself. `integration_id` 15368 is the GitHub Actions app, so no other app can satisfy it by posting a status called `verify`. |
| strict policy **off** | "Branch must be up to date" forces a rebase-and-rerun on every PR behind `main`. At this repo's traffic that is pure churn; the case it covers — two PRs green apart and red together — is caught by the `push` run on `main`. |
| `non_fast_forward`, `deletion` | `release.yml`'s gate checks that a tag is an ancestor of `origin/main`. That check assumes `main`'s history only grows; these two rules make the assumption true. |
| bypass: `RepositoryRole` 5 (admin), `always` | Decision #4 and #6. |

**Source of truth is GitHub, not the repository.** No copy of this JSON is committed under
`.github/`: GitHub never reads one, and a copy that nothing compares to the live setting is
the [LESSONS 4](../../LESSONS.md) shape. The JSON is recorded in CONTEXT D47 instead, with
the command that reads the live ruleset back:

```bash
gh api repos/Koniverse/Senti-MCP/rulesets --jq '.[] | {id, name, enforcement}'
gh api repos/Koniverse/Senti-MCP/rulesets/<id>
```

Applying it is a repository-settings change and is done by an admin, deliberately, at the
step §Rollout names — not as a side effect of merging anything.

## Rollout

The order is the acceptance test. Each step proves something the next depends on.

1. **Open the PR that adds `ci.yml`.** For a `pull_request` event GitHub reads the workflow
   from the PR's merge ref, so the new file runs on its own PR. `verify` must go green here
   first — which also proves the check name exists before anything requires it.
2. **Apply the ruleset** (`gh api -X POST repos/Koniverse/Senti-MCP/rulesets --input …`).
   Read it back.
3. **Negative test.** A throwaway branch off the PR branch, with one deliberate type error,
   opened as a second PR into `main`. `verify` goes red at `typecheck`, and the merge box
   offers only the bypass path. Record the run id and a description of the merge box; close
   the PR without merging and delete the branch. This is what proves the check is *wired*,
   not just that the workflow runs.
4. **Merge the real PR** with the ruleset active — a normal merge, no bypass.
5. **Watch the `push` run on `main`'s merge commit** go green.

If step 1 fails, nothing downstream happens. If step 3 comes back green, the ruleset is
not doing what this document says and the story is not done.

## Testing

There is no unit test to write: the artifact is a workflow file and a repository setting.
The evidence is the three runs in §Rollout — step 1 green, step 3 red, step 5 green — plus
the ruleset read-back, each recorded in the story's §Implementation notes by run id or
command output. `npm run typecheck`, `npm test` and `npm run release:verify-pack` are run
locally before step 1, so a red step 1 means a CI-environment difference rather than a
broken tree.

## Story plan

One epic, one story. The workflow and the ruleset are not independently useful — a
workflow nobody requires is the status quo with extra minutes, and a ruleset requiring a
check that does not exist blocks every PR.

| Story | Title | Pri | Points |
|---|---|---|---|
| US-9.1 | A pull-request CI gate on `main` | P1 | 3 |

It joins [sprint-2026-W37](../../sprints/sprint-2026-W37.md) as a row annotated
`_(added 2026-09-11)_`, with the sprint `goal:` extended by one clause
([D21](../../CONTEXT.md) rule 1, [D30](../../CONTEXT.md)).

Acceptance criteria, in outline — the story file writes them out as Given/When/Then:

1. `ci.yml` matches §The workflow, and its SHA pins match `release.yml`'s exactly.
2. `verify` is green on the PR that introduces it; run id recorded.
3. The negative PR is red and unmergeable without bypass; run id recorded, PR closed
   unmerged.
4. The ruleset is active as specified in CONTEXT D47; read-back output recorded.
5. The `push` run on `main` after merge is green; run id recorded.
6. Every item in §Documentation obligations lands in the same story, and
   `npm run agile:validate` is clean.

## Documentation obligations

**New**

- `docs/sprints/epics/EPIC-9.md` — *Verification before merge*.
- `docs/sprints/stories/US-9.1-pr-ci-gate.md`.
- **CONTEXT D47** — the six decisions in §Decisions taken with their rejected
  alternatives, the both-admins fact, the ruleset JSON and read-back command. A new
  decision, not a revision.

**Revised — documents that describe the present**

- `.github/dependabot.yml` header — drop *"a green Dependabot PR here proves almost
  nothing"*; say what `verify` now proves for a Dependabot PR and keep what it does not
  (the transitive-`engines` check above all).
- `docs/RELEASE.md` §7 — remove *CI on every push* from *Deliberately absent*; point to
  D47.
- `docs/CHANGELOG.md` `## [Unreleased]` — an `### Added` entry. **No `VERSION` bump**: the
  tarball does not change, so this is not a code-shipping commit under RULE-1. The next
  release carries the entry, and `release:check`'s *Unreleased is clear* check will insist
  on it.
- `AGENTS.md` — `ci.yml` in the repo-structure description, and one line: a PR into `main`
  needs `verify` green.
- `docs/sprints/sprint-2026-W37.md` — the row, the goal clause, the total; the §Open work
  bullet *Nothing runs on a pull request* marked as owned by US-9.1. No new section.
- `docs/sprints/STATUS.md` — regenerated (RULE-5).

**Deliberately not revised** — EPIC-4, EPIC-5, US-5.3, D29, sprints W33–W36, and every
shipped CHANGELOG section. Each says *nothing runs on a pull request*, and each was true
when written. EPIC-9 and D47 link back to them; they are records, not the current state.

## Out of scope

- **Any change to `release.yml`**, including extracting a shared reusable workflow
  (decision #5).
- **A Node matrix** — trigger stated in §The workflow.
- **`release:check` on pull requests**, and splitting its version-free checks out so they
  could run there (decision #1). Its Node-floor check is the strongest candidate for a
  later story.
- **`agile:validate` in CI** — same reason; a candidate for the same later story.
- **Required reviews, CODEOWNERS, signed commits, merge-method restrictions.**
- **Dependabot's `github-actions` ecosystem** — US-5.3 left it to whoever next revisits the
  SHA pins; with two workflow files pinning the same SHAs it becomes more useful, not less,
  but it is not this story.
- **Changing either collaborator's role** (decision #6).
- **A lint step.** The repository has no linter configured, and adding one is a tooling
  decision, not a CI one.

## Open questions

1. **Does the rulesets API accept the JSON above as written?** The `pull_request` rule's
   parameter set has grown over time (e.g. `allowed_merge_methods`). The body is checked
   against the API at apply time; any field the API requires or rejects is recorded in
   D47 as applied, not as designed here.
2. **Is `verify` the check-run name GitHub reports?** For a job with `name: verify` it
   should be exactly `verify`. §Rollout step 1 confirms it before step 2 depends on it.

## Cross-references

- [EPIC-4](../../sprints/epics/EPIC-4.md) §Out of scope — where this was deferred
- [RELEASE.md](../../RELEASE.md) §7 — *CI on every push*, the line this retires
- [CONTEXT D16](../../CONTEXT.md) — the release workflow this mirrors
- [CONTEXT D27](../../CONTEXT.md), [D28](../../CONTEXT.md) — the Node floor and the transitive-`engines` caveat
- [CONTEXT D29](../../CONTEXT.md) — the TypeScript 7 residual risk this narrows
- [US-5.3](../../sprints/stories/US-5.3-devdependency-currency-and-dependabot.md) §AC-6 — what a green Dependabot PR did not prove
- [LESSONS 4](../../LESSONS.md), [5](../../LESSONS.md), [6](../../LESSONS.md) — an unwatched copy, and the two defects that reached `main`
- [sprint-2026-W33](../../sprints/sprint-2026-W33.md) §Phase 2 and §Phase 4 retrospectives — the evidence
