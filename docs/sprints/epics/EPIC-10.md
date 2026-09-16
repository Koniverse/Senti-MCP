---
id: EPIC-10
title: "Verification before merge"
status: done
created: 2026-09-16
updated: 2026-09-16
---

## Goal

Make *this commit works* something the repository establishes before a change reaches
`main`, not the first time someone tags it. The release path already defines what working
means for this package — `typecheck`, `test`, `build`, `release:verify-pack` — and this
epic runs exactly that on every pull request and makes the result a merge requirement.

## Overview

### Business context

Until this epic, `.github/workflows/` held `release.yml` alone, triggered by a `v*` tag and
by nothing else. [EPIC-4](EPIC-4.md) §Out of scope left that open on purpose — *"whether
every push should run CI is a separate decision"* — and [RELEASE.md](../../RELEASE.md) §7
repeated it. The evidence that accumulated while it stayed open:

- **Two defects reached `main` in W33** and were caught only by rehearsing a release
  ([LESSONS 5](../../LESSONS.md), [LESSONS 6](../../LESSONS.md)).
- **Dependabot has opened PRs weekly since [US-5.3](../stories/US-5.3-devdependency-currency-and-dependabot.md)**,
  under a header telling whoever merges one that a green PR *"proves almost nothing"*.
- **[CONTEXT D29](../../CONTEXT.md)** records that a TypeScript 7 emit regression *"would
  not be caught before a tag"* — and `tsc` is this repo's build, not only its typechecker.
- **Four PRs merged with none of the four checks run**: #8 (EPIC-8, 14 points), #9
  (`2.8.1`), #13 (Dependabot's grouped bump, 2026-09-11, showing **0 checks**) and #14
  (`2.9.0`, 2026-09-15).
- **Six sprint files, W33 through W38, carried it forward unowned.** W33 called it *"the
  highest-value unbuilt thing in this repo"*.

`main` had no branch protection and no ruleset, so a workflow alone would have been a
signal, not a gate.

The [2026-09-11 spec](../../superpowers/specs/2026-09-11-pr-ci-gate-design.md) designed this
as EPIC-9. That id went to the Senti API contract fixes on 2026-09-14, before this epic was
filed, so it is EPIC-10 ([W38 §Open work](../sprint-2026-W38.md)).

### Out of scope

Each is a decision from the 2026-09-11 brainstorm, not an omission
([spec §Out of scope](../../superpowers/specs/2026-09-11-pr-ci-gate-design.md)):

- **Any change to `release.yml`**, including a shared reusable workflow — it would edit the
  irreversible publish path, which only a real tag run can prove.
- **A Node matrix.** Trigger: the first defect that reproduces only above the floor.
- **`release:check` or `agile:validate` on pull requests.** `release:check`'s Node-floor
  check is version-free and the strongest candidate for a later story here.
- **Required reviews, CODEOWNERS, signed commits, merge-method restrictions.**
- **Dependabot's `github-actions` ecosystem** — more useful now that two files pin the same
  SHAs, but it is the pins' own question.
- **Changing anyone's repository role** — see [CONTEXT D50](../../CONTEXT.md) on what admin
  bypass means when every account with access is an admin.
- **A lint step.** No linter is configured; adding one is a tooling decision.

## Cross-cutting invariants

- **A green `verify` means `release.yml`'s `build` and `verify` jobs will be green on the
  same commit.** `ci.yml`'s steps are those two jobs concatenated. A change to one set of
  steps is a change to the other, in the same commit.
- **Both workflow files pin every action to the same SHA.** When one moves, both move.
- **The required check is named `verify`.** Renaming the job and updating the ruleset
  happen together, or every PR blocks.
- **No path filter on a required check.** A path-skipped required check stays *Pending*
  and blocks the PR.
- **The live ruleset is the source of truth.** No copy is committed under `.github/`;
  [CONTEXT D50](../../CONTEXT.md) records the body and the read-back command.

## Stories

| US | Title | Pri | Points | Status | Sprint |
|---|---|---|---|---|---|
| [US-10.1](../stories/US-10.1-pr-ci-gate.md) | A pull-request CI gate on `main` | P1 | 3 | ✅ done | sprint-2026-W38 |

One story. The workflow and the ruleset are not independently useful: a workflow nobody is
required to wait for is the status quo with extra minutes, and a ruleset requiring a check
that does not exist blocks every PR.

### What US-10.1 closed, 2026-09-16

Every pull request into `main` and every push to it now runs `verify`, and ruleset
`23525361` makes it a merge requirement. It was proven three ways, each recorded in
[US-10.1](../stories/US-10.1-pr-ci-gate.md) §Implementation notes: green on its own PR
([#15](https://github.com/Koniverse/Senti-MCP/pull/15), 27s), red **and `BLOCKED`** on a PR
carrying one deliberate type error ([#16](https://github.com/Koniverse/Senti-MCP/pull/16),
failing at `typecheck`, closed unmerged), and green on `main` after a merge that used no
bypass. The design's two open questions were settled by observation on the way: the rulesets
API accepted the body as designed, and the check run is named exactly `verify` from app
`15368`.

**What this close does not claim.** It is not a lock: every account with access to this
repository is an admin and can bypass ([CONTEXT D50](../../CONTEXT.md)). It does not check
the live API, version or Node-floor agreement (`release:check`, still tag-time only), a
transitive dependency's `engines`, or Node above the floor. The version-free half of
`release:check` — and `npm run agile:check-sprints`, which arrived in W37 and nothing runs
either — are the strongest candidates for this epic's next story.

## Cross-references

- [Design spec](../../superpowers/specs/2026-09-11-pr-ci-gate-design.md) and
  [plan](../../superpowers/plans/2026-09-11-pr-ci-gate-w37.md)
- [CONTEXT D50](../../CONTEXT.md) — the decision this epic implements
- [EPIC-4](EPIC-4.md) §Out of scope — where the question was deferred
- [EPIC-5](EPIC-5.md) §What this epic did not close — the same gap, seen from Dependabot
- [US-5.3](../stories/US-5.3-devdependency-currency-and-dependabot.md) §AC-6 — what a green Dependabot PR did not prove
- [sprint-2026-W38](../sprint-2026-W38.md) — where US-10.1 runs
