---
id: US-5.4
title: "Decide TypeScript 7, and say why either way"
epic: EPIC-5
status: done
priority: P3
points: 2
sprint: sprint-2026-W33
assignee: bluezdot
depends_on: [US-5.3]
created: 2026-08-13
updated: 2026-08-13
---

## Goal

Reach a recorded decision on TypeScript 7 — upgrade it or decline it — backed by a run
rather than by a preference. The deliverable is the decision; the upgrade is only one of the
two ways this story can close.

## Background

`typescript` sits at 5.9.3 with 7.0.2 available. This is not the shape of an ordinary
`^5.7.0 → ^5.9.0` bump, which is why [US-5.3](US-5.3-devdependency-currency-and-dependabot.md)
pushes it out and `dependabot.yml` ignores its majors: TypeScript 7 is the native port of
the compiler, and a compiler rewrite arriving inside a routine devDeps refresh is how a
toolchain change ships without anyone deciding it.

**Two things make this repo's exposure narrower than it looks, and one makes it wider.**

Narrower: `engines.node` for `typescript@7.0.2` is `>=16.20.0`, so nothing here interacts
with [US-5.1](US-5.1-node-floor-and-ci-pins.md)'s floor. And the type surface is small —
two dependencies, no framework, no ambient module augmentation.

Wider: `tsc` is not only the typechecker here, it is the **build**. `npm run build` is
`rm -rf dist && tsc && chmod +x dist/index.js`, and `dist/` is what `bin` points at and what
`files` publishes. A typechecker disagreement is a red run someone fixes; an *emit*
difference is shipped JavaScript that nobody read. `tsconfig` pins `target: ES2022` /
`lib: ES2023`, which constrains what may legitimately differ — that constraint is what makes
AC-2 answerable rather than a vibe.

## Acceptance criteria

- [x] **AC-1** — **Given** `typescript@7.0.2` installed in a throwaway branch, **When**
  `npm run typecheck` runs, **Then** the result for **both** tsconfigs — `tsconfig.json`
  and `tsconfig.test.json` — is recorded, with the error text if any. `typecheck` runs both
  and a story that reports one has tested half the surface.
- [x] **AC-2** — **Given** `npm run build` under 5.9.3 and under 7.0.2, **When** the two
  `dist/` trees are compared, **Then** they are byte-identical, or every difference is
  enumerated and explained. `dist/` is the published artifact; an unexplained emit
  difference is a blocking finding, not a note.
- [x] **AC-3** — **Given** `npm test` under the candidate, **When** it runs, **Then** the
  file and test counts are recorded against the current baseline. `vitest` transpiles
  without typechecking, so a suite passing under a new compiler is weak evidence on its
  own — it is recorded because a *drop* still means something.
- [x] **AC-4** — **Given** the evidence from AC-1 through AC-3, **When** the decision is
  made, **Then** a [CONTEXT](../../CONTEXT.md) entry records it **either way**, with what
  was run and what was found. "Not yet" is a valid close and needs the same entry as "yes".
- [ ] **AC-5** — **n/a: the decision was to upgrade, so this AC's precondition never
  held.** It reads *"Given a decision to defer…"* and is the mutually-exclusive twin of
  AC-6, which is the one that applies. Left unticked deliberately rather than marked done,
  because ticking it would claim a trigger and a retained `ignore` block that do not exist —
  the `typescript` `ignore` was **removed**, per its own instructions. (Original text:
  *Given a decision to defer, When it is recorded, Then it names the concrete trigger that
  would reopen it — a version, a date, or a capability — and the `dependabot.yml` `ignore`
  from [US-5.3](US-5.3-devdependency-currency-and-dependabot.md) stays, with its comment
  updated to cite this decision instead of "pending a decision".*)
- [x] **AC-6** — **Given** a decision to upgrade, **When** it is applied, **Then**
  `package.json`, `package-lock.json`, and any `tsconfig` option the new compiler requires
  move in one commit, and `npm run release:verify-pack` passes. No half state where the
  range moved and the lockfile did not.

## Tasks

- [x] **TASK-5.4.1** — Establish the baseline before installing anything (AC: 2, 3)
  - [x] `npm run build` on 5.9.3 and keep the tree — `cp -R dist /tmp/dist-ts5` or
        equivalent. A comparison needs both sides, and the first side stops existing the
        moment `build` runs again (`rm -rf dist`).
  - [x] Record the current test counts.
- [x] **TASK-5.4.2** — Run the candidate (AC: 1, 3)
  - [x] Throwaway branch, `typescript@7.0.2`, `npm run typecheck` — read both tsconfigs'
        results separately.
  - [x] `npm test`.
- [x] **TASK-5.4.3** — Diff the emit (AC: 2)
  - [x] `diff -r` the two `dist/` trees. Enumerate every difference; explain each against
        `target: ES2022` / `lib: ES2023` or treat it as a blocker.
- [x] **TASK-5.4.4** — Decide and record (AC: 4, 5, 6)
  - [x] [CONTEXT](../../CONTEXT.md) entry either way. If deferring, name the trigger and
        update the `dependabot.yml` comment. If upgrading, land it in one commit.

## Dev notes

### Architecture constraints

- **`tsc` is the build, not just the check.** [AGENTS.md §Repo structure](../../../AGENTS.md)
  — `tsconfig.json` excludes `*.test.ts` so tests stay out of `dist/`, and
  `tsconfig.test.json` is the only thing that typechecks them. Both matter; AC-1 covers both.
- **`target: ES2022` / `lib: ES2023` bound what may legitimately change in the emit.**
  [US-5.1](US-5.1-node-floor-and-ci-pins.md) §Dev notes leans on the same fact from the
  other direction: the published artifact does not depend on the Node that built it. It
  should not depend on the compiler major either, and AC-2 is where that stops being an
  assumption.
- **This story may close with no dependency change at all.** That is a completed story, not
  an abandoned one — the same posture [US-5.1](US-5.1-node-floor-and-ci-pins.md) AC-2's
  second clause takes toward leaving the floor where it is.

### Cross-story dependencies

- **Builds on** [US-5.3](US-5.3-devdependency-currency-and-dependabot.md) — it writes the
  `typescript` `ignore` block this story either updates or removes, and it lands `vitest` 4
  first so a red run here has one candidate cause rather than two.
- **Required by nothing.**

### What we explicitly did NOT do

- **Did not treat the upgrade as the default outcome.** A compiler that emits the same
  JavaScript and typechecks the same code buys nothing on its own; the argument for moving
  has to be made, the same way [EPIC-5](../epics/EPIC-5.md) refuses a floor raised for
  tidiness.
- **Did not bundle it into the devDeps refresh.** See §Background.

### References

- [Source: US-5.3](US-5.3-devdependency-currency-and-dependabot.md) — the refresh that defers this
- [Source: EPIC-5 §Cross-cutting invariants](../epics/EPIC-5.md) — a version moves for a stated reason
- [Source: AGENTS.md §Repo structure](../../../AGENTS.md) — the two tsconfigs and what each covers
- [tsconfig.json](../../../tsconfig.json) · [tsconfig.test.json](../../../tsconfig.test.json)

## Verification commands

> Filled after the runs existed — W33 §Phase 3 retrospective §Followups. All on Node
> **22.11.0** (the floor).

| AC | Command | Result |
|---|---|---|
| AC-1 | `npx tsc --noEmit` | exit **0**, no output |
| AC-1 | `npx tsc --noEmit -p tsconfig.test.json` | exit **0**, no output — both surfaces, separately, as the AC requires |
| AC-1 | mutation: type error appended to `src/core/errors.ts` | `tsconfig.json` → `src/core/errors.ts(54,7): error TS2322` — **the check discriminates** |
| AC-1 | mutation: type error appended to `src/core/parse.test.ts` | `tsconfig.json` → clean (tests excluded, correct); `tsconfig.test.json` → `error TS2322` |
| AC-2 | `diff -rq /tmp/dist-ts5 dist` | 3 files differ, **all `.js.map`**: `core/client.js.map`, `core/errors.js.map`, `server.js.map` |
| AC-2 | `find . -name '*.js' \| xargs shasum` in both trees, then `diff` | **identical — all 17 `.js` files byte-for-byte**. This is the row AC-2 actually turns on |
| AC-2 | `find <tree> -type f \| wc -l` | 34 files both sides — nothing added or dropped |
| AC-3 | `npm test` | `19 passed \| 1 skipped (20)` files · `438 passed \| 1 skipped (439)` tests — identical to the 5.9.3 baseline taken before the install |
| AC-6 | `npm run release:verify-pack` | passed · **54 entries**, unchanged · build and packaged server both expose 10 tools |
| AC-6 | `grep '"typescript"' package.json` + lockfile | `^7.0.0` and `7.0.2` — range and lockfile moved together, no half state |
| — | timing, median of 3 (typecheck) / 2 (build) | typecheck `~1428 ms → ~503 ms`; build `~1412 ms → ~393 ms` |

## Changelog entry

> The outcome was **upgrade**, so there is an entry. It lands under `## [Unreleased]`
> beside US-5.2's and US-5.3's; no version is cut.

### Changed
- **`typescript` 5.9.3 → 7.0.2**, the native compiler port ([CONTEXT D29](CONTEXT.md)). The
  emit was compared against the 5.9.3 build before the decision: **all 17 `dist/**/*.js`
  files are byte-identical**. Three `.js.map` files differ — `core/client`, `core/errors`,
  `server`, exactly the three sources using a parameter default or a parameter property —
  and only in which source positions the generated defaults and fields are attributed to;
  the generated JavaScript at those sites is character-for-character the same. Typecheck is
  clean on **both** tsconfigs and was proven to still catch errors on each. The reason to
  move is measured rather than assumed: typecheck `~1428 ms → ~503 ms`, full build
  `~1412 ms → ~393 ms` (~3.6×).
- `.github/dependabot.yml` drops its `typescript` majors `ignore`, which
  [US-5.3](sprints/stories/US-5.3-devdependency-currency-and-dependabot.md) added with
  instructions to remove it in exactly this commit. A note in its place records why the
  next compiler major still deserves the same check.

## Implementation notes

### The decision

**Upgrade**, to `^7.0.0` (7.0.2 in the lockfile), recorded as
[CONTEXT D29](../../CONTEXT.md). The evidence came back uniformly clean *and* carried a
concrete benefit, which is what the story's bar required — §What we explicitly did NOT do
says the upgrade is not the default outcome and that "the argument for moving has to be
made". The ~3.6× build is that argument; without it the correct close would have been AC-5's
defer, because a compiler that emits the same JavaScript and typechecks the same code buys
nothing on its own.

Both outcomes were live until the numbers existed. The maintainer chose upgrade after being
shown the evidence and the residual risk.

### AC-2 — the emit, which is the part that could have blocked this

`tsc` is the **build** here, not only the typechecker: `bin` points into `dist/` and `files`
publishes it, so an unexplained emit difference is shipped JavaScript nobody read. The
5.9.3 tree was copied to `/tmp/dist-ts5` **before** installing the candidate, because
`npm run build` starts with `rm -rf dist` and the first side of the comparison stops
existing the moment it runs again.

| | 5.9.3 | 7.0.2 |
|---|---|---|
| files in `dist/` | 34 | 34 |
| `.js` files | 17 | 17, **all byte-identical** (`shasum`, then `diff`) |
| `.js.map` files | 17 | 3 differ |

`diff -rq` alone would have been weak evidence — it reports *that* files differ, and the
three that do are all maps, which is easy to skim as "only sourcemaps, fine". So the `.js`
claim was established independently by checksumming all 17 files in each tree and diffing
the checksum lists. That is the row AC-2 turns on.

**The three differing maps are fully explained, not noted.** They are `core/client.js.map`,
`core/errors.js.map` and `server.js.map` — and a scan of `src/` for parameter defaults and
parameter properties returns **exactly those three files** and no others:
`createClient(config, deps: ClientDeps = {})`, `createServer(config, deps: ServerDeps = {})`,
and `ApiError`'s `constructor(message, public status, public code)`. The generated
JavaScript at each site is character-for-character identical
(`export function createServer(config, deps = {}) {`, `constructor(message, status, code)`
with `this.status = status`); TypeScript 7 simply attributes the synthesized defaults and
field assignments to different **source positions**. Nothing about runtime behaviour or the
public API changes.

`dist/**/*.js.map` **is** inside `files`, so the published tarball genuinely changes — in
debug metadata only, and `release:verify-pack` confirms it is still 54 entries. Worth saying
plainly rather than claiming "nothing reaches a consumer": something does, it just cannot
affect what runs.

### AC-1 — two green runs are silence until they are shown to discriminate

`tsc --noEmit` exiting 0 under a new compiler proves the compiler ran, not that it checked.
[LESSONS 2](../../LESSONS.md) is that shape (a filter matching nothing also exits 0), so
both surfaces were mutation-tested under 7.0.2, each `grep`-confirmed on disk before its
result was believed ([LESSONS 1](../../LESSONS.md)):

| Mutation | `tsconfig.json` | `tsconfig.test.json` |
|---|---|---|
| type error in `src/core/errors.ts` | **`TS2322`** — caught | — |
| type error in `src/core/parse.test.ts` | clean — **correct**, `*.test.ts` is excluded from the build config | **`TS2322`** — caught |

The second row is the more interesting one: it proves the two-tsconfig split still means
what [AGENTS.md §Repo structure](../../../AGENTS.md) says it means — `tsconfig.json` keeps
tests out of `dist/`, and `tsconfig.test.json` is the only thing that typechecks them. A
compiler major is exactly when that could have quietly stopped being true. Both mutations
reverted to zero occurrences and `git status src/` is clean.

### AC-3 — the suite, and why it is weak evidence on its own

`20 files / 439 tests, 1 skipped`, identical to the baseline. Recorded because a *drop*
would have meant something, but it is not evidence the compiler is sound: `vitest`
transpiles without typechecking, so the suite would pass under a compiler whose checker did
nothing at all. AC-1's mutations are what carry that weight.

### The residual risk, and what bounds it

7.0.2 is a days-old major of a rewritten compiler, and
[US-5.3](US-5.3-devdependency-currency-and-dependabot.md) established that **nothing runs on
a pull request in this repository** — so a future emit regression would not surface until a
tag. Two things bound it, and neither is a promise that it cannot happen:

- `release:verify-pack` installs the built tarball and spawns the binary on every release.
- The method that produced this decision — build under both compilers, `shasum` every `.js`
  — costs about a minute and is written into D29 and into `dependabot.yml`'s comment, where
  the next compiler major will actually arrive.

### What was deliberately not done

- **No exact pin.** `^7.0.0` matches every other devDependency's caret style, and pinning
  exactly would refuse the 7.0.x patches most likely to fix a young compiler.
- **No `tsconfig` change.** TypeScript 7 required no new option; `target: ES2022` /
  `lib: ES2023` are untouched, which is the constraint that made AC-2 answerable in the
  first place.
- **No version cut, and no `@types/node` movement.** `@types/node` stays on the floor's
  major per [CONTEXT D28](../../CONTEXT.md); this story touches only the compiler.

## Files modified

- `package.json` — `typescript` `^5.7.0` → `^7.0.0`
- `package-lock.json` — `typescript` 5.9.3 → 7.0.2, moved in the same commit as the range
  (AC-6: no half state where one moved and the other did not)
- `.github/dependabot.yml` — the `typescript` majors `ignore` **removed**, replaced by a note
  recording why it existed and why the next compiler major still deserves the emit check
- `docs/CONTEXT.md` — **D29**, the decision with its evidence and its residual risk
- `docs/CHANGELOG.md` — entry under `## [Unreleased]`
- `docs/sprints/stories/US-5.4-…` — this file

`dist/` is rebuilt but is not tracked. No file under `src/` changed.

## Cross-references

- [Epic EPIC-5](../epics/EPIC-5.md)
- [US-5.3](US-5.3-devdependency-currency-and-dependabot.md) — the refresh that carved this out
- [US-5.1](US-5.1-node-floor-and-ci-pins.md) — the artifact-independence argument AC-2 tests
