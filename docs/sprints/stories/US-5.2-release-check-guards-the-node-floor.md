---
id: US-5.2
title: "release:check guards the Node floor across every artifact that states it"
epic: EPIC-5
status: done
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

- [x] **AC-1** — **Given** `package.json` `engines.node` as the single canonical floor,
  **When** `npm run release:check` runs, **Then** it extracts every Node-floor claim from
  `README.md` and `docs/SETUP.md` and passes only if all of them state that same version.
- [x] **AC-2** — **Given** one artifact edited to a different floor, **When** the check
  runs, **Then** it exits non-zero and the message names the file, the expected value and
  the value found — the shape every existing `fail()` in
  [scripts/release-check.mjs](../../../scripts/release-check.mjs) already uses.
- [x] **AC-3** — **Given** an artifact that states **no** floor at all, **When** the check
  runs, **Then** that is a failure and not a silent pass. A pattern that matches nothing
  must not report success — [LESSONS 2](../../LESSONS.md) is that failure mode in a story
  table, and it is the same mistake in a gate.
- [x] **AC-4** — **Given** the `--ci` invocation the release workflow actually uses
  (`npm run release:check -- "<version>" --ci`), **When** the check runs that way, **Then**
  it behaves identically to the local invocation. [LESSONS 5](../../LESSONS.md): twenty
  tests passed while the one invocation CI uses was broken, because every test reached for
  a fixture through `--root`.
- [x] **AC-5** — **Given** the new tests in
  [src/release-check.test.ts](../../../src/release-check.test.ts), **When** the suite runs,
  **Then** at least one test proves the check *discriminates* — a fixture whose floors
  disagree, asserted to fail. [LESSONS 1](../../LESSONS.md): a green suite is not evidence a
  check works until it has been seen to go red.
- [x] **AC-6** — **Given** [docs/RELEASE.md](../../RELEASE.md)'s description of what the
  gate covers, **When** this story closes, **Then** it names the floor check alongside the
  five version places, in the same commit as the code.

## Tasks

- [x] **TASK-5.2.1** — Settle what counts as a floor claim, before writing the matcher
      (AC: 1, 3)
  - [x] Enumerate the live claims by hand today:
        `grep -rn "20\.6\.0" README.md docs/SETUP.md` — the three `SETUP.md` spots and the
        `README.md` §Requirements bullet. Decide whether the troubleshooting row's
        `20.3.0` (the `AbortSignal.any` version, deliberately *not* the floor) is in scope
        or excluded, and write the answer down. Getting this wrong in either direction is
        the whole risk in the story.
- [x] **TASK-5.2.2** — Implement the check in
      [scripts/release-check.mjs](../../../scripts/release-check.mjs) (AC: 1, 2)
  - [x] Add a block beside the existing README currency check, using the same
        `read()` / `pass()` / `fail()` helpers so `--root` keeps working.
- [x] **TASK-5.2.3** — Tests (AC: 3, 4, 5)
  - [x] A passing fixture, a disagreeing fixture, and a fixture where one artifact states
        no floor. Run each and confirm the red ones are red before trusting the green one.
  - [x] One test that invokes the script the way the workflow does, `--ci` and all.
- [x] **TASK-5.2.4** — Documentation (AC: 6)
  - [x] [docs/RELEASE.md](../../RELEASE.md) gate description; the
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

> Filled after the tests existed, as W33 §Phase 3 §Followups asks. Every row was run and
> its **count** read — not its exit code ([LESSONS 2](../../LESSONS.md)). All commands are
> prefixed `npx vitest run src/release-check.test.ts`.
>
> **One drafted filter shape was discarded because it selected nothing.** `-t "Node floor >
> fails naming"` reports `Tests 32 skipped (32)` and **exits 0** — vitest's `-t` matches the
> test name, not the `describe > test` path. It is the exact trap LESSONS 2 records, hit
> while writing this table, and it is why every row below quotes a count.

| AC | Command (after the shared prefix) | Count |
|---|---|---|
| AC-1 | `-t "all state the same floor"` | `1 passed \| 31 skipped` |
| AC-2 | `-t "expected floor and the one found\|only the prerequisites row"` | `2 passed \| 30 skipped` |
| AC-3 | `-t "states no floor at all\|no engines.node to compare"` | `3 passed \| 29 skipped` |
| AC-4 | `-t "invocation the workflow actually uses"` | `1 passed \| 31 skipped` |
| AC-5 | the AC-2 row above, plus the real-repo mutation in §Implementation notes | `2 passed \| 30 skipped` |
| AC-5 | `-t "does not read the AbortSignal\|does not read a non-Node"` — the discrimination guards | `2 passed \| 30 skipped` |
| — | `-t "unicode"` — the `≥` form the real artifacts use | `1 passed \| 31 skipped` |
| — | `-t "Node floor"` — the whole block | `10 passed \| 22 skipped` |
| AC-6 | `grep -c "Node floor" docs/RELEASE.md` | `6` |
| all | `npm run release:check` | `ok  Node floor — 22.11.0 in package.json, README.md and docs/SETUP.md` |
| all | `npm test` | `438 passed \| 1 skipped (439)`, up from 428 |

## Changelog entry

> No version is cut by this story — `scripts/` is not published. The entry lands under
> whichever release next ships, or under `## [Unreleased]`.

### Added
- `release:check` now compares the Node floor across `package.json` `engines.node`,
  `README.md` §Requirements and `docs/SETUP.md` §1, and fails when they disagree. The floor
  was stated in three places and compared by nothing.

## Implementation notes

### TASK-5.2.1 — what counts as a floor claim, decided before the matcher was written

The task called this "the whole risk in the story", so it was settled empirically first: a
scan of every semver in `README.md` and `docs/SETUP.md` alongside every floor operator.
Seven operator-shaped matches existed, and **two were false positives**.

**The decision: a floor claim is a semver immediately preceded by `>=` or `≥`, on a line
that mentions Node.** Both halves earn their place.

- **The operator is the discriminator.** It is what separates the floor from every other
  Node version in the same prose. This answers the question the task poses explicitly:
  **`20.3.0` is excluded**, and not by special-casing it. `AbortSignal.any`'s version is
  always written "landed in 20.3.0" or "older than 20.3.0" — never `>= 20.3.0`. Keying on
  "a Node-shaped version number" instead would make `SETUP.md`'s prerequisites row
  permanently self-contradictory, since that single table cell names 22.11.0, 20.3.0 and
  20.6.0 together.
- **The Node mention** stops a different package's floor being read as this one's. `publish`
  needs npm ≥ 11.5.1 ([LESSONS 7](../../LESSONS.md)); if that sentence ever migrates into
  README or SETUP it is not a Node floor. There is a test for it.

**The cost, stated rather than discovered later.** Prose *about* a past floor must not use
the operator form. Two README lines written the day before by
[US-5.1](US-5.1-node-floor-and-ci-pins.md) did — "Raised from `≥ 20.6.0` in v2.0.0" and
"the last version declaring the old `≥ 20.6.0` floor" — and the first of them made the gate
fail on the real repository the moment the check existed. Both were rephrased to drop the
operator ("the old 20.6.0 floor"). This was a deliberate choice between two designs:

| Option | Why not / why |
|---|---|
| Teach the matcher to tell history from policy | Rejected. It would need to read tense and intent from prose; every such rule is a new way to be silently wrong, in a check whose entire value is that it is not. |
| **Make the artifacts express the floor canonically, and keep the matcher strict** | **Taken.** The contract is one sentence, it is stated in the script, in `docs/RELEASE.md` §Step 5 and in its failure table, and the constraint falls on two sentences. |

### The check discriminates — proven on the real repository, not only on fixtures

[LESSONS 1](../../LESSONS.md) is that a green suite after a mutation is not evidence the
mutation landed, so the mutation was `grep`-confirmed on disk *before* the red result was
believed, and again after reverting:

```
mutate  docs/SETUP.md:20  →  # must be >= 20.6.0
grep    20:node --version    # must be >= 20.6.0          ← landed
gate    FAIL  Node floor — … First: docs/SETUP.md:20 states 20.6.0, expected 22.11.0
revert  docs/SETUP.md:20  →  # must be >= 22.11.0
grep    20:node --version    # must be >= 22.11.0         ← landed
gate    ok    Node floor — 22.11.0 in package.json, README.md and docs/SETUP.md
git diff --stat docs/SETUP.md                              ← empty
```

That is the half-landed edit this story exists to catch: `SETUP.md` states the floor in
three separate spots, and the prerequisites row was left correct while the `node --version`
comment drifted. Before this story nothing compared them.

The tests were also watched go red before the implementation existed — `7 failed | 3 passed`
on the first run. The three that "passed" did so **vacuously**: they assert exit 0, and with
no floor check in the script every fixture passed for the wrong reason. Worth naming,
because that is what a check that does nothing looks like.

### AC-4, and a LESSONS 2 trap hit while writing the verification table

`release-check.mjs` takes `--root` so tests can reach a fixture, and the release workflow is
the one caller that never passes it — the shape that produced
[LESSONS 5](../../LESSONS.md). The floor check therefore has a test that runs the gate
through `gateInCwd` with `--ci` and no `--root`, the workflow's exact invocation.

Separately, the first `-t` filter drafted for the verification table was
`"Node floor > fails naming"`, on the assumption that `-t` matches `describe > test`. It
does not — it matches the test name alone, so the filter selected **zero** tests and vitest
**exited 0**. Reading the count rather than the exit code is the only reason it was caught;
the table now quotes a count for every row, and the discarded filter is recorded there so
the next person does not re-derive it.

### What was deliberately not done

- **No check on `node-version:` in `.github/workflows/`.** Those pins bind nobody outside CI
  and `publish` differs from the floor on purpose. A check demanding agreement would encode
  the exact conflation [LESSONS 7](../../LESSONS.md) is about. Said out loud in the script's
  comment so it reads as a decision rather than an omission.
- **No new file declaring the floor.** `package.json` `engines.node` is canonical because it
  is the only one of the three a tool other than a human ever reads. Three copies compared
  against one source beats four compared against a fifth.
- **`AGENTS.md` still states no floor**, and none was added to give the check something to
  read. US-5.1 recorded that it does not state one; inventing a claim to satisfy an AC is
  the opposite of what the AC is for.
- **No version cut.** `scripts/` is not in `package.json` `files`, so nothing here reaches a
  consumer. The changelog entry sits under `## [Unreleased]` — and note that
  `release:check`'s own "Unreleased is clear" rule forbids list items there at release time,
  so whoever cuts the next version moves it into that release's section. Phase 2 set this
  precedent: five EPIC-4 stories closed and `VERSION` deliberately did not move.

## Files modified

- `scripts/release-check.mjs` — the floor check, placed beside the README currency check and
  using the same `read()` / `pass()` / `fail()` helpers so `--root` keeps working. Its
  contract, and the two things it deliberately does not check, are stated in the comment
  above it
- `src/release-check.test.ts` — `SETUP_OK` fixture (stating the floor twice, with a
  non-floor `20.3.0` on the same row), `setup` and `engines` fixture options, `docs/SETUP.md`
  written into every fixture, `engines.node` added to the fixture `package.json`, and the
  ten-test `describe('release:check — the Node floor')` block
- `README.md` — two historical mentions rephrased off the operator form, so the strict
  matcher stays correct. No claim changed meaning
- `docs/RELEASE.md` — §Step 2 gains the floor as a second set of files that must move
  together; §Step 5 describes what the check compares and the constraint on historical
  prose; §`release:check` failed gains three rows
- `docs/README.md` — a pre-commit checklist item, because a floor change is not a version
  bump and nothing else in the checklist would have caught one
- `docs/sprints/stories/US-5.2-…` — this file

## Cross-references

- [Epic EPIC-5](../epics/EPIC-5.md)
- [US-5.1](US-5.1-node-floor-and-ci-pins.md) — sets the floor this check then guards
- [US-4.2](US-4.2-release-check-gate.md) — the gate being extended
- [docs/RELEASE.md](../../RELEASE.md) · [LESSONS 1, 2, 4, 5](../../LESSONS.md)
