---
id: US-5.2
title: "release:check guards the Node floor across every artifact that states it"
epic: EPIC-5
status: backlog
priority: P2
points: 2
sprint: sprint-2026-W33
assignee: bluezdot
depends_on: [US-5.1]
created: 2026-08-13
updated: 2026-08-13
---

## Goal

Make the machine, not the reviewer, the thing that notices when the Node floor moves in one
file and not the others. After this story `npm run release:check` refuses to pass a
repository where `package.json` `engines.node`, `README.md` §Requirements and
`docs/SETUP.md` §1 do not all state the same number — so the next floor move cannot
half-land the way [US-5.1](US-5.1-node-floor-and-ci-pins.md) had to be walked through by
hand.

## Background

[EPIC-5](../epics/EPIC-5.md) §Cross-cutting invariants says *four files move together or
none do*, and today that sentence is enforced by nobody. The floor lives in three places —
`package.json:7`, `README.md` §Requirements, and `docs/SETUP.md` §1 in three separate spots
(the prerequisites table row, the `node --version` comment, and the `AbortSignal.any`
troubleshooting row) — and no tool compares them. Nothing would have caught a commit that
updated `package.json` and forgot `SETUP.md`.

This is precisely the shape [LESSONS 4](../../LESSONS.md) records: `package-lock.json` sat
eight releases behind its version string because nothing read it, and the fix was not
vigilance but a check. `release:check` already enforces version agreement across five
places for exactly that reason. It just does not know the floor exists.

The story runs **after** US-5.1 rather than before it on purpose. Written first, the check
would be authored against a floor that is about to change, and its first real exercise would
be the change it was supposed to guard — which tests the check against the one edit whose
author is already thinking about it. Written second, its first exercise is the *next* one.

## Acceptance criteria

- [ ] **AC-1** — **Given** `package.json` `engines.node` as the single canonical floor,
  **When** `npm run release:check` runs, **Then** it extracts every Node-floor claim from
  `README.md` and `docs/SETUP.md` and passes only if all of them state that same version.
- [ ] **AC-2** — **Given** one artifact edited to a different floor, **When** the check
  runs, **Then** it exits non-zero and the message names the file, the expected value and
  the value found — the shape every existing `fail()` in
  [scripts/release-check.mjs](../../../scripts/release-check.mjs) already uses.
- [ ] **AC-3** — **Given** an artifact that states **no** floor at all, **When** the check
  runs, **Then** that is a failure and not a silent pass. A pattern that matches nothing
  must not report success — [LESSONS 2](../../LESSONS.md) is that failure mode in a story
  table, and it is the same mistake in a gate.
- [ ] **AC-4** — **Given** the `--ci` invocation the release workflow actually uses
  (`npm run release:check -- "<version>" --ci`), **When** the check runs that way, **Then**
  it behaves identically to the local invocation. [LESSONS 5](../../LESSONS.md): twenty
  tests passed while the one invocation CI uses was broken, because every test reached for
  a fixture through `--root`.
- [ ] **AC-5** — **Given** the new tests in
  [src/release-check.test.ts](../../../src/release-check.test.ts), **When** the suite runs,
  **Then** at least one test proves the check *discriminates* — a fixture whose floors
  disagree, asserted to fail. [LESSONS 1](../../LESSONS.md): a green suite is not evidence a
  check works until it has been seen to go red.
- [ ] **AC-6** — **Given** [docs/RELEASE.md](../../RELEASE.md)'s description of what the
  gate covers, **When** this story closes, **Then** it names the floor check alongside the
  five version places, in the same commit as the code.

## Tasks

- [ ] **TASK-5.2.1** — Settle what counts as a floor claim, before writing the matcher
      (AC: 1, 3)
  - [ ] Enumerate the live claims by hand today:
        `grep -rn "20\.6\.0" README.md docs/SETUP.md` — the three `SETUP.md` spots and the
        `README.md` §Requirements bullet. Decide whether the troubleshooting row's
        `20.3.0` (the `AbortSignal.any` version, deliberately *not* the floor) is in scope
        or excluded, and write the answer down. Getting this wrong in either direction is
        the whole risk in the story.
- [ ] **TASK-5.2.2** — Implement the check in
      [scripts/release-check.mjs](../../../scripts/release-check.mjs) (AC: 1, 2)
  - [ ] Add a block beside the existing README currency check, using the same
        `read()` / `pass()` / `fail()` helpers so `--root` keeps working.
- [ ] **TASK-5.2.3** — Tests (AC: 3, 4, 5)
  - [ ] A passing fixture, a disagreeing fixture, and a fixture where one artifact states
        no floor. Run each and confirm the red ones are red before trusting the green one.
  - [ ] One test that invokes the script the way the workflow does, `--ci` and all.
- [ ] **TASK-5.2.4** — Documentation (AC: 6)
  - [ ] [docs/RELEASE.md](../../RELEASE.md) gate description; the
        [docs/README.md](../../README.md) pre-commit checklist if the wording there implies
        the gate only covers versions.

## Dev notes

### Architecture constraints

- **`scripts/` is not published.** `package.json` `files` is `dist`, `src`,
  `!src/**/*.test.ts`, so nothing in this story reaches a consumer and no version is cut.
  Phase 2 set the precedent: five EPIC-4 stories closed and `VERSION` deliberately did not
  move.
- **The test file lives in `src/`, not beside the script.** `vitest.config.ts` anchors
  `include` at `src/**/*.test.ts` ([CONTEXT D13](../../CONTEXT.md),
  [LESSONS 3](../../LESSONS.md)) — a test written next to `release-check.mjs` would never
  run. `src/release-check.test.ts` already exists for this reason; extend it.
- **`package.json` is the canonical floor and the others are copies.** The check compares
  copies against it rather than requiring a fourth file to declare the truth. `engines.node`
  is the only one of the three that a tool other than a human ever reads.
- **`AGENTS.md` is not in scope.** [EPIC-5](../epics/EPIC-5.md) AC-2 lists it as a fourth
  artifact; it does not state the floor anywhere. US-5.1 records that. Do not add a mention
  in order to have something to check.

### Cross-story dependencies

- **Builds on** [US-4.2](US-4.2-release-check-gate.md) — the gate itself, its `--root` /
  `--ci` argument handling and the `pass`/`fail`/`skip` output contract.
- **Builds on** [US-5.1](US-5.1-node-floor-and-ci-pins.md) — the floor value the check
  first runs against, and the reason the three artifacts are worth comparing at all.
- **Required by nothing.** This is a guard, not a substrate.

### What we explicitly did NOT do

- **No check on the CI pins in `release.yml`.** `node-version:` binds nobody outside CI
  ([EPIC-5](../epics/EPIC-5.md) §Business context) and is deliberately allowed to differ
  from the floor — `publish` differs on purpose. A check that demanded agreement there
  would encode exactly the conflation [LESSONS 7](../../LESSONS.md) is about.
- **No new file declaring the floor.** Three copies compared against one source is fewer
  moving parts than four copies compared against a fifth.

### References

- [Source: EPIC-5 §Cross-cutting invariants](../epics/EPIC-5.md) — "four files move together or none do"
- [Source: LESSONS 4](../../LESSONS.md) — a version string nothing reads drifts silently
- [Source: LESSONS 5](../../LESSONS.md) — test the invocation CI uses, not only the one with `--root`
- [Source: LESSONS 1](../../LESSONS.md) — see the check go red before trusting it green
- [Source: LESSONS 2](../../LESSONS.md) — a matcher that matches nothing exits 0
- [Source: US-4.2](US-4.2-release-check-gate.md) — the gate this extends
- [scripts/release-check.mjs](../../../scripts/release-check.mjs) · [src/release-check.test.ts](../../../src/release-check.test.ts)

## Verification commands

> Deliberately left empty at planning time. W33 §Phase 3 retrospective §Followups:
> *draft a Verification-commands table only after its tests exist — leave the command cell
> empty during planning rather than filling it with a plausible guess.* Each row is filled
> in, run, and its selected-test count recorded, before this story closes.

| AC | Command | Count |
|---|---|---|
| AC-1 | | |
| AC-2 | | |
| AC-3 | | |
| AC-4 | | |
| AC-5 | | |
| AC-6 | | |

## Changelog entry

> No version is cut by this story — `scripts/` is not published. The entry lands under
> whichever release next ships, or under `## [Unreleased]`.

### Added
- `release:check` now compares the Node floor across `package.json` `engines.node`,
  `README.md` §Requirements and `docs/SETUP.md` §1, and fails when they disagree. The floor
  was stated in three places and compared by nothing.

## Implementation notes

<!-- Filled during implementation. -->

## Files modified

<!-- Filled during implementation. -->

## Cross-references

- [Epic EPIC-5](../epics/EPIC-5.md)
- [US-5.1](US-5.1-node-floor-and-ci-pins.md) — sets the floor this check then guards
- [US-4.2](US-4.2-release-check-gate.md) — the gate being extended
- [docs/RELEASE.md](../../RELEASE.md) · [LESSONS 1, 2, 4, 5](../../LESSONS.md)
