---
id: US-4.2
title: "npm run release:check — the pre-tag gate"
epic: EPIC-4
status: done
priority: P1
points: 3
sprint: sprint-2026-W33
assignee: bluezdot
created: 2026-08-10
updated: 2026-08-10
---

## Goal

Turn the release contract [US-4.1](US-4.1-release-contract-and-runbook.md) writes down into
a command that exits non-zero. A maintainer runs `npm run release:check 1.1.0` before
pushing a tag and learns, in one run, whether the four version strings agree, whether the
CHANGELOG has a section for the version, whether `## [Unreleased]` still holds something
that belongs to it, and whether `README.md` — the only prose in the tarball — still
describes what is about to ship.

## Background

The defect this gate exists for is not a bad build. It is documented state and real state
disagreeing, and the evidence is that [docs/README.md](../../README.md) has carried a
pre-commit checklist listing `VERSION` and `CHANGELOG.md` since `0.1.0` and this repo still
finished with nine changelogged versions, three tags, two GitHub Releases and two npm
versions. **A human reading a checklist is the mechanism that already failed.**

**One check here cannot be a unit test, and that is the whole reason the script exists.**
`src/config.test.ts` already asserts `SERVER_VERSION === package.json.version ===
VERSION` — three of the four places the version lives, and the guard koni-docs does not
provide. The fourth is the **git tag being pushed**, which does not exist when vitest runs.
Only a command invoked with the intended version, ahead of the tag, can close that loop.

**The `README.md` check is [CONTEXT D12](../../CONTEXT.md) mechanized.** `npm pack
--dry-run` reports 42 files and **no `docs/` file at all** — `docs/CHANGELOG.md` never
ships, so `README.md` is the only prose a reader on the registry ever sees. D12 records what
happened the last time it was allowed to drift: the `1.0.0` tarball would have carried a
front page telling users the package lacked five of its six tools. That check cannot be
fully general, and this story should not pretend otherwise — see §What we explicitly did NOT
do.

This story writes the script and nothing else. [US-4.5](US-4.5-release-workflow.md) is what
makes running it unavoidable.

## Acceptance criteria

- [ ] **AC-1** — **Given** `npm run release:check 1.1.0`, **When** `VERSION`,
  `package.json`'s `version` and `src/config.ts`'s `SERVER_VERSION` all read `1.1.0`,
  **When** all the other checks pass, **Then** it exits `0` and prints one line per check
  with the value it observed — not merely "ok".
- [ ] **AC-2** — **Given** any one of the three version strings disagreeing with the
  argument, **When** the gate runs, **Then** it exits non-zero, **And** the message names
  which file disagrees and both values. A gate that says "version mismatch" without saying
  where has not saved anyone a search.
- [ ] **AC-3** — **Given** a version with no `## [1.1.0]` section in
  [docs/CHANGELOG.md](../../CHANGELOG.md), **When** the gate runs, **Then** it exits
  non-zero naming the missing heading.
- [ ] **AC-4** — **Given** a `## [Unreleased]` section containing anything other than the
  no-op placeholder, **When** the gate runs for a version, **Then** it exits non-zero, on
  the grounds that content sitting in `Unreleased` at release time is either part of this
  release and belongs in its section, or is not and should not be in the working tree.
- [ ] **AC-5** — **Given** `README.md` carrying a version-bearing claim that names a version
  other than the one being released, **When** the gate runs, **Then** it exits non-zero and
  quotes the offending line. The check is a targeted scan of README's version claims, not a
  semantic review — its stated limit is written into the failure message and into
  `RELEASE.md`.
- [ ] **AC-6** — **Given** a tag `v1.1.0` that already exists locally or on the remote,
  **When** the gate runs for `1.1.0`, **Then** it exits non-zero — the version has already
  been released and npm will never accept it again.
- [ ] **AC-7** — **Given** the gate is run with no argument, **When** it starts, **Then** it
  reads the intended version from `VERSION` and states which version it is checking, so the
  common invocation needs no argument and no invocation is ambiguous about what it verified.
- [ ] **AC-8** — **Given** a dirty working tree or `HEAD` not on `main`, **When** the gate
  runs, **Then** it exits non-zero. A tag is a claim about a commit, and a commit that is
  not the one under review is not the one being released.
- [ ] **AC-9** — **Given** the gate itself, **When** `npm test` runs, **Then** its checks
  are covered by a test file that exercises both the passing and the failing branch of every
  check, on fixture inputs rather than on the repository's live state — a gate whose failure
  path has never run is a gate nobody has tested.

## Tasks

- [x] **TASK-4.2.1** — Decide the shape before writing it (AC: 1, 9)
  - [x] A Node script under `scripts/`, run by an npm script — not a shell one-liner in
        `package.json`, because AC-9 requires it to be importable and testable
  - [x] Confirm it needs no dependency beyond what is already installed; the repo's only
        runtime deps are the MCP SDK and zod, and a release gate should not add either
- [x] **TASK-4.2.2** — Implement the version-agreement checks (AC: 1, 2, 7)
  - [x] `VERSION`, `package.json`, `src/config.ts`'s `SERVER_VERSION`, and the argument
  - [x] Default the argument to `VERSION`'s contents, and print the resolved version first
- [x] **TASK-4.2.3** — Implement the CHANGELOG checks (AC: 3, 4)
  - [x] `## [X.Y.Z]` section present
  - [x] `## [Unreleased]` empty of release content — define "empty" against the current
        placeholder wording and record the definition in the failure message
- [x] **TASK-4.2.4** — Implement the README, tag and tree checks (AC: 5, 6, 8)
  - [x] Scan `README.md` for version-bearing claims; quote the line on failure
  - [x] `git rev-parse -q --verify refs/tags/vX.Y.Z` and `git ls-remote --tags origin`
  - [x] `git status --porcelain` empty; `git rev-parse --abbrev-ref HEAD` is `main`
- [x] **TASK-4.2.5** — Test both branches of every check (AC: 9)
  - [x] Fixture-driven, one passing and one failing case per check
  - [x] Confirm the suite count moves as expected and every new test can be made to fail —
        a `vitest -t` filter matching nothing exits `0` ([LESSONS 2](../../LESSONS.md))
- [x] **TASK-4.2.6** — Add the `release:check` npm script and document it in
  `docs/RELEASE.md`'s procedure (AC: 1)

## Dev notes

### Architecture constraints

- **The gate does not duplicate `src/config.test.ts`; it extends it.** The test owns the
  three-way agreement at test time; the gate owns the four-way agreement at release time,
  including the tag. Both should keep existing — the test catches drift on every commit, the
  gate catches it once, at the only moment the tag is knowable.
- **`scripts/` is a new directory.** `tsconfig.json` globs `src/**/*.ts` and `files` in
  `package.json` allowlists `dist` and non-test `src`, so a script outside `src/` is neither
  built nor published — which is correct, and should be confirmed with
  `npm pack --dry-run` rather than assumed ([CONTEXT D13](../../CONTEXT.md) confirmed the
  same property for `vitest.config.ts`).
- **`vitest.config.ts` scopes collection to `src/**/*.test.ts`** ([CONTEXT D13](../../CONTEXT.md)).
  A test file for this gate placed under `scripts/` **will not be collected**. Either the
  test lives in `src/` or the include list widens — and widening it is what D13 exists to
  prevent, so prefer the first and state the choice in §Implementation notes.
- **Every check fails loudly and exits non-zero.** A warning is not a gate.

### Cross-story dependencies

- **Builds on** [US-4.1](US-4.1-release-contract-and-runbook.md) — the contract this script
  enforces is decided there, in prose, where it is reviewable.
- **Required by** [US-4.5](US-4.5-release-workflow.md) — the workflow's first job is this
  script. Until then it is a command a maintainer has to remember, which is a weaker version
  of the same guard and is why US-4.5 exists.
- **Independent of** [US-4.3](US-4.3-backfill-tags-and-releases.md) and
  [US-4.4](US-4.4-tarball-verification.md).

### What we explicitly did NOT do

- **No general "is the README accurate" check.** AC-5 scans for version-bearing claims,
  which catches the [D12](../../CONTEXT.md) defect class and nothing subtler. A check that
  claimed more than it verifies would be worse than none, because it would be trusted. The
  limit is stated in the failure message and in `RELEASE.md`.
- **No version bumping.** The gate verifies; it never edits. Deciding the version is a human
  act recorded in a story ([EPIC-4](../epics/EPIC-4.md) §Out of scope on `changesets`).
- **No `npm publish`.** This script is a gate, not a release command.

### References

- [Source: CONTEXT D16](../../CONTEXT.md) — the five checks this gate implements, enumerated
- [Source: CONTEXT D12](../../CONTEXT.md) — the README-in-the-tarball defect AC-5 targets
- [Source: CONTEXT D13](../../CONTEXT.md) — why a test file outside `src/` is not collected
- [Source: LESSONS 2](../../LESSONS.md) — a test filter that matches nothing exits 0
- [src/config.test.ts](../../../src/config.test.ts) — the three-way check this extends

## Verification commands

> Drafted before the script exists; every row is run and confirmed non-vacuous before this
> story closes ([LESSONS 2](../../LESSONS.md)).

| AC | Command |
|---|---|
| AC-1, AC-7 | `npm run release:check` — expect exit 0 and one line per check |
| AC-2 | `npm run release:check 9.9.9` — expect non-zero naming all three files |
| AC-3, AC-4, AC-5, AC-6, AC-8 | `npm test -- <gate test file>` |
| AC-9 | `npm test` — confirm the file count and test count both moved |
| — | `npm pack --dry-run` — confirm `scripts/` is absent from the tarball |

## Changelog entry

### Added
- **`npm run release:check` — the gate a release has to pass.** Verifies that `VERSION`,
  `package.json`, `src/config.ts`'s `SERVER_VERSION` and the tag about to be pushed all name
  the same version; that [docs/CHANGELOG.md](../../CHANGELOG.md) has a section for it and
  `## [Unreleased]` does not still hold it; that `README.md` — the only prose in the
  42-file tarball — carries no contradicting version claim; and that the tag does not
  already exist. `src/config.test.ts` covers three of the four version strings on every
  commit; the fourth is the tag, which cannot exist when the suite runs
  ([CONTEXT D16](../../CONTEXT.md)).

## Implementation notes

`scripts/release-check.mjs`, eight checks, all reported in one run (AC-1, AC-9's
one-run requirement) and each printing the value it observed rather than "ok".

**Built test-first.** Each check's failing branch was written as a test, watched fail, then
implemented — 20 tests in `src/release-check.test.ts`, every one driving the script as a
CLI against a throwaway git repository under the OS temp directory. Testing it as a
subprocess rather than importing it is the same choice `src/index.test.ts` makes about
`dist/index.js`: the contract a maintainer and the workflow both consume is the exit code
and the message.

**Where the files live, and why it is not obvious.** The script is in `scripts/`, not
`src/`, because `files` in `package.json` ships `dist` and non-test `src` — putting it in
`src/` would add it to the tarball and move the 42-file count that
[CONTEXT D13](../../CONTEXT.md), [EPIC-4](../epics/EPIC-4.md) and this story all quote.
Its test is in `src/` because `vitest.config.ts` scopes collection to `src/**/*.test.ts`
and widening that allowlist is what [CONTEXT D13](../../CONTEXT.md) exists to prevent. So
the pair is split on purpose; `npm pack --dry-run` confirms the tarball is still **42
entries**.

**Two things the plan did not anticipate.**

- **The `--ci` flag exists because writing the workflow demanded it.** A tag-triggered run
  checks out a detached HEAD at a tag that already exists — it is what started the run — so
  the "tag is free" and "branch is main" checks would fail every CI release. `--ci` skips
  exactly those two, **prints that it skipped them and why**, and keeps every artifact
  check. The workflow asserts stronger equivalents itself: the tag is annotated, and it is
  an ancestor of `origin/main`.
- **The README check needed a real corpus to design against.** Reading `README.md` first
  showed three shapes of version string: the Node floor (`20.6.0`, `20.3.0` — must never
  fire), a historical claim (`0.1.0`, "published before the other five existed" — stays
  true across releases, must never fire), and two live claims (`1.0.1` "as of this release",
  and a `senti-mcp-server@1.0.1` pin — must fire). The check flags a pin naming another
  version, or a line that both names a version and claims currency. Four tests pin those
  four cases, including the two that must **not** fire.

**Run against this repository it correctly reports four real problems** — `Unreleased`
carries content, `v1.0.1` already exists, the tree is dirty mid-work, and HEAD is not on
`main` — which is the gate working, not a defect.

**Its stated limit, repeated here because it is load-bearing:** the README check catches a
*contradictory* version claim, never an inaccurate description. It cannot tell you the
prose is right.

## Files modified

- `scripts/release-check.mjs` — new, the gate
- `src/release-check.test.ts` — new, 20 tests over fixture git repositories
- `package.json` — `release:check` script

## Cross-references

- [Epic EPIC-4](../epics/EPIC-4.md)
- [CONTEXT D12, D13, D16](../../CONTEXT.md)
- [US-4.1](US-4.1-release-contract-and-runbook.md) · [US-4.5](US-4.5-release-workflow.md)
