---
id: US-5.3
title: "devDependency currency, and the rule that @types/node tracks the floor"
epic: EPIC-5
status: backlog
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

- [ ] **AC-1** — **Given** `vitest` at 4.x, **When** `npm test` and `npm run typecheck`
  run, **Then** both pass, and the file/test counts are recorded in §Implementation notes
  against the `20 files / 429 tests, 1 skipped` baseline `1.4.0` shipped with. A count that
  *drops* is a silently-skipped suite, not a clean upgrade.
- [ ] **AC-2** — **Given** the new Node floor, **When** `@types/node` is considered,
  **Then** it stays on the floor's major and the reason is written where the next person to
  read `npm outdated` will find it — not left as a bare pin that looks like neglect.
- [ ] **AC-3** — **Given** `tsx` inside its existing `^4.19.0` range, **When** the lockfile
  is refreshed, **Then** `package-lock.json` moves and `package.json` does not.
- [ ] **AC-4** — **Given** `.github/dependabot.yml`, **When** it is added, **Then** it runs
  weekly on the npm ecosystem, groups minor and patch updates into one PR, and carries an
  `ignore` for `@types/node` majors and for `typescript` majors — each with a comment
  naming *why*, since [EPIC-5](../epics/EPIC-5.md) §Cross-cutting invariants is explicit
  that a requirement written as a comment is not enforced, and the inverse also holds: an
  enforcement with no comment is one nobody dares change.
- [ ] **AC-5** — **Given** the `@types/node` rule, **When** this story closes, **Then** a
  [CONTEXT](../../CONTEXT.md) entry records it as a standing rule rather than a one-time
  choice — the next floor move has to move the types major with it.
- [ ] **AC-6** — **Given** that no workflow runs on a pull request, **When** Dependabot is
  enabled, **Then** the story states plainly what a green Dependabot PR does and does not
  prove, and names the W33 §Phase 2 followup that would change the answer. Enabling the bot
  without saying this ships a false signal.
- [ ] **AC-7** — **Given** every version this story pins or bumps, **When** it closes,
  **Then** each was checked against its `engines` before the bump, not after —
  `npm view <pkg>@<ver> engines`, recorded in §Implementation notes. This is
  [LESSONS 7](../../LESSONS.md)'s cheap check, and [EPIC-5](../epics/EPIC-5.md) makes it an
  invariant for every pin, not only the CI ones.

## Tasks

- [ ] **TASK-5.3.1** — Re-measure before changing anything (AC: 1, 7)
  - [ ] `npm outdated --long` and `npm view <pkg>@<ver> engines` for each candidate. The
        table in §Background is dated 2026-08-13; if this story runs later, it is evidence
        of what *was* true, not what is.
- [ ] **TASK-5.3.2** — `vitest` 3 → 4 (AC: 1)
  - [ ] Bump, run `npm test` and `npm run typecheck`, and read the *counts*, not the colour.
  - [ ] Check `vitest.config.ts` still means what it meant — its `include` anchor is
        load-bearing ([CONTEXT D13](../../CONTEXT.md)) and a major version is exactly when
        a default changes underneath it.
- [ ] **TASK-5.3.3** — `tsx` lockfile refresh (AC: 3)
- [ ] **TASK-5.3.4** — Write down the `@types/node` rule (AC: 2, 5)
  - [ ] [CONTEXT](../../CONTEXT.md) entry; the `ignore` block in `dependabot.yml` is where
        it gets enforced.
- [ ] **TASK-5.3.5** — `.github/dependabot.yml` (AC: 4, 6)
  - [ ] Weekly, grouped minor/patch, the two `ignore` entries with their reasons.
  - [ ] State the untested-PR caveat in §Implementation notes and in the file's header
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

> Deliberately left empty at planning time — W33 §Phase 3 retrospective §Followups. Filled,
> run, and counted before this story closes.

| AC | Command | Count |
|---|---|---|
| AC-1 | | |
| AC-2 | | |
| AC-3 | | |
| AC-4 | | |
| AC-7 | | |

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

<!-- Filled during implementation. -->

## Files modified

<!-- Filled during implementation. -->

## Cross-references

- [Epic EPIC-5](../epics/EPIC-5.md)
- [US-5.1](US-5.1-node-floor-and-ci-pins.md) — the floor the types major tracks
- [US-5.4](US-5.4-decide-typescript-7.md) — the `typescript` decision this story defers to
- [CONTEXT D5](../../CONTEXT.md) · [CONTEXT D13](../../CONTEXT.md) · [LESSONS 3](../../LESSONS.md) · [LESSONS 7](../../LESSONS.md)
