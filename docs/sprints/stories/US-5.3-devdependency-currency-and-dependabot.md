---
id: US-5.3
title: "devDependency currency, and the rule that @types/node tracks the floor"
epic: EPIC-5
status: done
priority: P3
points: 3
sprint: sprint-2026-W33
assignee: bluezdot
depends_on: [US-5.1]
created: 2026-08-13
updated: 2026-08-13
---

## Goal

Bring the development toolchain current, and — more durably — stop currency from being a
thing someone remembers to check. After this story a bot opens the upgrade PR, and the one
dependency that must *not* simply track latest has a written reason for staying where it is.

## Background

[EPIC-5](../epics/EPIC-5.md) is named for two things and has so far owned only one. Its
§Out of scope defers dependency upgrades "until a story here says otherwise". This is that
story.

**Measured 2026-08-13**, `npm outdated`:

| Package | Installed | Latest | Verdict |
|---|---|---|---|
| `vitest` | 3.2.7 | 4.1.10 | Upgrade. `engines.node ^20.0.0 \|\| ^22.0.0 \|\| >=24.0.0` — satisfied by the new floor |
| `tsx` | 4.23.6 | 4.23.12 | In-range patch drift; the lockfile simply has not been refreshed |
| `@types/node` | 22.20.1 | 26.2.0 | **Do not upgrade** — see below |
| `typescript` | 5.9.3 | 7.0.2 | Out of scope; [US-5.4](US-5.4-decide-typescript-7.md) owns it |

`@modelcontextprotocol/server` (2.0.0) and `zod` (4.4.3) are already current — the runtime
dependencies need nothing, which is worth stating because "dependency currency" reads like
it should be mostly about them.

**The `@types/node` finding is the story's real content.** Types should track the *floor*,
not the newest release. Compiling against `@types/node@26` while `engines.node` promises
Node 22 lets `tsc` accept a call to an API that does not exist on the runtime this package
claims to support — and the failure lands on the user, at runtime, with a green build
behind it. That is the same failure shape as [CONTEXT D5](../../CONTEXT.md): the server
starts, `tools/list` succeeds, and the tool call throws. `^22.10.0` is therefore already
correct, and [US-5.1](US-5.1-node-floor-and-ci-pins.md)'s move to a Node 22 floor turns a
coincidence into a rule.

**One honest limitation, stated up front.** A Dependabot PR is worth much less in a
repository where nothing runs on a pull request. W33 §Phase 2 retrospective §Followups
already records that gap — two defects reached `main` because `release.yml` only fires on a
tag. This story does not close it and does not depend on it; AC-6 makes the reader aware
rather than leaving them to assume the bot's PRs arrive tested.

## Acceptance criteria

- [x] **AC-1** — **Given** `vitest` at 4.x, **When** `npm test` and `npm run typecheck`
  run, **Then** both pass, and the file/test counts are recorded in §Implementation notes
  against the `20 files / 429 tests, 1 skipped` baseline `1.4.0` shipped with. A count that
  *drops* is a silently-skipped suite, not a clean upgrade.
- [x] **AC-2** — **Given** the new Node floor, **When** `@types/node` is considered,
  **Then** it stays on the floor's major and the reason is written where the next person to
  read `npm outdated` will find it — not left as a bare pin that looks like neglect.
- [x] **AC-3** — **Given** `tsx` inside its existing `^4.19.0` range, **When** the lockfile
  is refreshed, **Then** `package-lock.json` moves and `package.json` does not.
- [x] **AC-4** — **Given** `.github/dependabot.yml`, **When** it is added, **Then** it runs
  weekly on the npm ecosystem, groups minor and patch updates into one PR, and carries an
  `ignore` for `@types/node` majors and for `typescript` majors — each with a comment
  naming *why*, since [EPIC-5](../epics/EPIC-5.md) §Cross-cutting invariants is explicit
  that a requirement written as a comment is not enforced, and the inverse also holds: an
  enforcement with no comment is one nobody dares change.
- [x] **AC-5** — **Given** the `@types/node` rule, **When** this story closes, **Then** a
  [CONTEXT](../../CONTEXT.md) entry records it as a standing rule rather than a one-time
  choice — the next floor move has to move the types major with it.
- [x] **AC-6** — **Given** that no workflow runs on a pull request, **When** Dependabot is
  enabled, **Then** the story states plainly what a green Dependabot PR does and does not
  prove, and names the W33 §Phase 2 followup that would change the answer. Enabling the bot
  without saying this ships a false signal.
- [x] **AC-7** — **Given** every version this story pins or bumps, **When** it closes,
  **Then** each was checked against its `engines` before the bump, not after —
  `npm view <pkg>@<ver> engines`, recorded in §Implementation notes. This is
  [LESSONS 7](../../LESSONS.md)'s cheap check, and [EPIC-5](../epics/EPIC-5.md) makes it an
  invariant for every pin, not only the CI ones.

## Tasks

- [x] **TASK-5.3.1** — Re-measure before changing anything (AC: 1, 7)
  - [x] `npm outdated --long` and `npm view <pkg>@<ver> engines` for each candidate. The
        table in §Background is dated 2026-08-13; if this story runs later, it is evidence
        of what *was* true, not what is.
- [x] **TASK-5.3.2** — `vitest` 3 → 4 (AC: 1)
  - [x] Bump, run `npm test` and `npm run typecheck`, and read the *counts*, not the colour.
  - [x] Check `vitest.config.ts` still means what it meant — its `include` anchor is
        load-bearing ([CONTEXT D13](../../CONTEXT.md)) and a major version is exactly when
        a default changes underneath it.
- [x] **TASK-5.3.3** — `tsx` lockfile refresh (AC: 3)
- [x] **TASK-5.3.4** — Write down the `@types/node` rule (AC: 2, 5)
  - [x] [CONTEXT](../../CONTEXT.md) entry; the `ignore` block in `dependabot.yml` is where
        it gets enforced.
- [x] **TASK-5.3.5** — `.github/dependabot.yml` (AC: 4, 6)
  - [x] Weekly, grouped minor/patch, the two `ignore` entries with their reasons.
  - [x] State the untested-PR caveat in §Implementation notes and in the file's header
        comment.

## Dev notes

### Architecture constraints

- **Nothing here reaches a consumer.** All four packages are `devDependencies`, and
  `.github/` is not in `files`. No version is cut; `package-lock.json` moves and the
  published tarball does not change. Confirm that last claim rather than assuming it —
  `npm run release:verify-pack` reports the tarball's entry count, which stood at 42 through
  all of Phase 2.
- **`@types/node`'s major is a support-policy artifact, not a currency one.** It is the one
  line in `npm outdated` that is *supposed* to stay behind, which is why AC-2 asks for a
  written reason: an unexplained old pin is indistinguishable from an unmaintained one, and
  the next person to run `npm outdated` will helpfully fix it.
- **`vitest` 4 is the only upgrade that can change what the suite proves.** The others move
  a runner and a type surface. If the counts move, that is the finding, not a rounding
  error.

### Cross-story dependencies

- **Builds on** [US-5.1](US-5.1-node-floor-and-ci-pins.md) — the floor's major is the input
  to the `@types/node` rule, and `vitest` 4's `engines` has to be checked against the new
  floor, not the old one.
- **Sibling** [US-5.4](US-5.4-decide-typescript-7.md) — both touch `package.json`
  `devDependencies` and `package-lock.json`. Whichever lands second rebases; the
  `dependabot.yml` `ignore` for `typescript` is written here and *removed* there if US-5.4
  decides to upgrade.

### What we explicitly did NOT do

- **No push/PR test workflow.** It is the obvious thing to want next to Dependabot, and it
  is EPIC-4's open followup, not this story's — a CI workflow is a release-process
  decision with its own scope. Trigger to revisit: the first Dependabot PR that merges
  broken.
- **No `typescript` bump.** [US-5.4](US-5.4-decide-typescript-7.md) exists so that a native
  compiler rewrite does not ride into `main` inside a routine devDeps refresh.
- **No renovate.** Dependabot needs no service, no token and no third-party app on a
  repository that holds publish rights to a single-maintainer package.

### References

- [Source: EPIC-5 §Out of scope](../epics/EPIC-5.md) — the deferral this story lifts
- [Source: CONTEXT D5](../../CONTEXT.md) — the failure shape a too-new `@types/node` reintroduces
- [Source: LESSONS 7](../../LESSONS.md) — check a version against its `engines` before pinning it
- [Source: CONTEXT D13](../../CONTEXT.md) · [LESSONS 3](../../LESSONS.md) — `vitest.config.ts`'s `include` anchor
- [Source: sprint-2026-W33 §Phase 2 retrospective §Followups](../sprint-2026-W33.md) — nothing runs on a pull request
- [Dependabot configuration reference](https://docs.github.com/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file)

## Verification commands

> Filled after the work existed — W33 §Phase 3 retrospective §Followups. Every row run on
> Node **22.11.0 exactly** (the floor), and read for its *count* rather than its colour
> ([LESSONS 2](../../LESSONS.md)).

| AC | Command | Count / result |
|---|---|---|
| AC-1 | `npm test` | `RUN v4.1.10` · `19 passed \| 1 skipped (20)` files · `438 passed \| 1 skipped (439)` tests — **identical to the vitest 3.2.7 baseline taken immediately before the bump** |
| AC-1 | `npm run typecheck` | both tsconfigs clean, no output |
| AC-2 | `node -p "require('./package.json').engines.node"` + `devDependencies['@types/node']` | `>=22.11.0` and `^22.10.0` — majors agree |
| AC-3 | `git diff --stat package.json package-lock.json` | `package.json 2 +-` (the `vitest` range only; `tsx` untouched) · `package-lock.json 939 ++--` |
| AC-3 | `node -e "…package-lock.json…['node_modules/tsx'].version"` | `4.23.12`, up from `4.23.6` — moved in the lock alone |
| AC-4 | `YAML.parse('.github/dependabot.yml')` | parses; `weekly` · group `minor-and-patch` · 2 `ignore` entries, both `version-update:semver-major` |
| AC-7 | `npm view vitest@4.1.10 engines.node` | `^20.0.0 \|\| ^22.0.0 \|\| >=24.0.0` — 22.11.0 satisfies |
| AC-7 | `npm view tsx@4.23.12 engines.node` | `>=18.0.0` — satisfies |
| AC-7 | `npm view vite@{6.4.3,7.3.6,8.2.1} engines.node` | `^18\|^20\|>=22.0.0` · `^20.19.0\|\|>=22.12.0` · `^20.19.0\|\|>=22.12.0` — **only vite 6 satisfies the floor**; see §Implementation notes |
| — | `npm ls vite --all` | `vitest@4.1.10 → vite@6.4.3`; the top-level `vite@5.4.21` is astro's, via `@koniverse/koni-docs` |
| — | `npm run release:verify-pack` | `54 entries`, unchanged — nothing reached the tarball |
| — | `npm outdated` | only `@types/node` (deliberate, D28) and `typescript` (US-5.4) remain |

## Changelog entry

> No version is cut by this story. The entry lands under whichever release next ships, or
> under `## [Unreleased]`.

### Changed
- Development toolchain brought current: `vitest` 3 → 4, `tsx` refreshed within range.
- `@types/node` deliberately stays on the Node floor's major. Types newer than the floor let
  `tsc` accept APIs the supported runtime does not have, and the failure lands on the user.

### Added
- `.github/dependabot.yml` — weekly grouped npm updates, with `@types/node` and `typescript`
  majors ignored for stated reasons.

## Implementation notes

### TASK-5.3.1 — re-measured, and the §Background table held

Re-run on 2026-08-14, a day after the table was written. Every row was still accurate:
`vitest` 3.2.7 → 4.1.10, `tsx` 4.23.6 → 4.23.12, `@types/node` 22.20.1 with 26.2.0
available, `typescript` 5.9.3 with 7.0.2 available. `@modelcontextprotocol/server` (2.0.0)
and `zod` (4.4.3) are current, so the two **runtime** dependencies needed nothing — worth
saying because "dependency currency" sounds like it should mostly be about them.

### AC-7 found something the story did not anticipate: the floor constrains a *transitive* dependency

This is the finding of the story, and it exists only because AC-7 requires checking `engines`
**before** the bump rather than after.

`vitest@4.1.10`'s own `engines.node` is `^20.0.0 || ^22.0.0 || >=24.0.0` — fine. But it
depends on `vite` at `^6.0.0 || ^7.0.0 || ^8.0.0`, and:

| vite | `engines.node` | Floor 22.11.0? |
|---|---|---|
| 6.4.3 | `^18.0.0 \|\| ^20.0.0 \|\| >=22.0.0` | ✅ |
| 7.3.6 | `^20.19.0 \|\| >=22.12.0` | ❌ |
| 8.2.1 | `^20.19.0 \|\| >=22.12.0` | ❌ |

**The floor misses vite 7's requirement by one patch release** — 22.11.0 against 22.12.0.
That is uncomfortably close to [LESSONS 7](../../LESSONS.md)'s shape: a pin whose `engines`
the runtime cannot satisfy, shipped because nobody ran the one-line check.

**What actually happened, measured rather than predicted.** I expected npm to resolve the
newest satisfying vite (8.2.1) and produce `EBADENGINE`. It did not — it resolved
**vite 6.4.3**, nested at `node_modules/vitest/node_modules/vite`, and the install printed
no engine warning at all. So the upgrade is clean today, `npm ci` is deterministic from the
lockfile, and CI's `build` job keeps running the suite on exactly the floor.

**But the margin is one patch wide and invisible.** `vite` is transitive, so it will never
appear in a Dependabot PR title; it arrives silently inside a `vitest` bump. The guard is
therefore documentation placed where the bump lands — `dependabot.yml`'s header comment says
to run `npm ls vite --all` on any PR touching `vitest` — plus the note in
[CONTEXT D28](../../CONTEXT.md). Nothing in the repository enforces it, and that is stated
rather than glossed: a check that does not exist should not be described as if it does.

This was **not** treated as a reason to raise the floor. The floor is a support-lifetime
decision ([D27](../../CONTEXT.md)) and 22.11.0 is where the 22 line became LTS; moving it to
22.12.0 to please a devDependency would invert the whole EPIC-5 argument — a floor is raised
for a stated reason, never for convenience.

### TASK-5.3.2 — vitest 3 → 4: the counts, and the D13 anchor

A baseline was taken **immediately before** the bump, on the same Node, so the comparison is
against this branch rather than against a number quoted in a doc:

| | Test files | Tests |
|---|---|---|
| vitest 3.2.7 (before) | `19 passed \| 1 skipped (20)` | `438 passed \| 1 skipped (439)` |
| vitest 4.1.10 (after) | `19 passed \| 1 skipped (20)` | `438 passed \| 1 skipped (439)` |

Identical. AC-1's real concern — a count that *drops*, meaning a silently-skipped suite
rather than a clean upgrade — did not materialise.

Note the baseline is **439**, not the `20 files / 429 tests` AC-1 quotes from `1.4.0`: US-5.2
added ten tests on this branch. The AC's number was correct when written and is simply older
than the branch.

**The `include` anchor was mutation-tested, not eyeballed.** A major version is exactly when
a default changes underneath you, and [CONTEXT D13](../../CONTEXT.md) /
[LESSONS 3](../../LESSONS.md) exist because vitest's *default* `include` once collected a
gitignored worktree as a second copy of the suite. Reading `vitest.config.ts` and seeing
`include: ['src/**/*.test.ts']` proves nothing about whether vitest 4 still honours it, and
the unchanged count proves nothing either — there are no test files outside `src/`, so the
count is identical either way.

So a decoy was planted:

```
write   .claude/worktrees/probe/decoy.test.ts   (a passing test)
ls      .claude/worktrees/probe/decoy.test.ts   ← confirmed on disk first (LESSONS 1)
vitest  Test Files 19 passed | 1 skipped (20)   ← NOT collected, count unchanged
git status --porcelain .claude/                 ← empty: invisible to git, visible to a default glob
rm -rf  .claude/worktrees/probe
```

The anchor survives the major. That is a real check; the alternative was an assumption.

### TASK-5.3.3 — tsx

`npm install` does not move an in-range dependency — it honours the lockfile — so the first
attempt left `tsx` at 4.23.6 and looked like a no-op. `npm update tsx` is the command that
moves it. AC-3 holds: `4.23.6 → 4.23.12` in `package-lock.json`, and `package.json`'s
`^4.19.0` range is untouched.

The one `package.json` change in this story is `vitest`, `^3.0.0` → **`^4.0.0`**.
`npm install -D vitest@^4` wrote `^4.1.10`; it was normalised to the round form every other
entry in that block uses. The caret range is identical in effect and the lockfile pins the
tested 4.1.10 either way.

### AC-6 — what a green Dependabot PR does not prove

Stated plainly because enabling the bot without saying it ships a false signal: **no workflow
runs on a pull request in this repository.** `release.yml` fires on `push` of a `v*` tag and
on nothing else, so a Dependabot PR gets no typecheck, no test run and no tarball
verification. Two defects already reached `main` through that gap
([sprint-2026-W33](../sprint-2026-W33.md) §Phase 2 retrospective §Followups).

The caveat is written into `dependabot.yml`'s header — where someone about to click merge
will actually see it — together with the four commands to run locally instead. Adding a
push/PR workflow is EPIC-4's open followup and deliberately not this story; the trigger to
go do it is the first Dependabot PR that merges broken.

### What was deliberately not done

- **No `github-actions` ecosystem block.** Dependabot can update the SHA-pinned actions in
  `release.yml`, and that is probably worth having — but AC-4 scopes this file to npm, and
  the SHA-pinning discipline is [US-4.5](US-4.5-release-workflow.md)'s to revisit.
- **No `typescript` bump**, and no `vite` override forcing 6.x. The first is
  [US-5.4](US-5.4-decide-typescript-7.md)'s. The second would add a moving part to solve a
  problem that is not occurring, and would itself age.
- **No version cut.** Everything here is `devDependencies` and `.github/`, neither in
  `files`. `release:verify-pack` confirms the tarball is still **54 entries** rather than
  assuming it.

## Files modified

- `package.json` — `vitest` `^3.0.0` → `^4.0.0`. The only line that changed; `tsx`,
  `@types/node` and `typescript` ranges are all untouched by design
- `package-lock.json` — `vitest` 3.2.7 → 4.1.10 (bringing `vite` 6.4.3 nested under it, and
  removing the vitest-3 tree), `tsx` 4.23.6 → 4.23.12
- `.github/dependabot.yml` — **new.** Weekly npm updates, minor+patch grouped into one PR,
  `chore` commit prefix (RULE-14, since Dependabot's default "Bump x from a to b" is not one
  of this repo's prefixes), and two `ignore` entries each carrying the reason it exists and
  the condition under which it should be removed. The header comment holds the untested-PR
  caveat and the transitive-`vite` check
- `docs/CONTEXT.md` — **D28**, the `@types/node` rule as a standing rule rather than a
  one-time pin, plus the `vite`/floor note
- `docs/CHANGELOG.md` — entry under `## [Unreleased]`, beside US-5.2's
- `docs/sprints/stories/US-5.3-…` — this file

## Cross-references

- [Epic EPIC-5](../epics/EPIC-5.md)
- [US-5.1](US-5.1-node-floor-and-ci-pins.md) — the floor the types major tracks
- [US-5.4](US-5.4-decide-typescript-7.md) — the `typescript` decision this story defers to
- [CONTEXT D5](../../CONTEXT.md) · [CONTEXT D13](../../CONTEXT.md) · [LESSONS 3](../../LESSONS.md) · [LESSONS 7](../../LESSONS.md)
