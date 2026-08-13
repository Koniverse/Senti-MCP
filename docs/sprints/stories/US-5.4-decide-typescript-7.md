---
id: US-5.4
title: "Decide TypeScript 7, and say why either way"
epic: EPIC-5
status: backlog
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

- [ ] **AC-1** — **Given** `typescript@7.0.2` installed in a throwaway branch, **When**
  `npm run typecheck` runs, **Then** the result for **both** tsconfigs — `tsconfig.json`
  and `tsconfig.test.json` — is recorded, with the error text if any. `typecheck` runs both
  and a story that reports one has tested half the surface.
- [ ] **AC-2** — **Given** `npm run build` under 5.9.3 and under 7.0.2, **When** the two
  `dist/` trees are compared, **Then** they are byte-identical, or every difference is
  enumerated and explained. `dist/` is the published artifact; an unexplained emit
  difference is a blocking finding, not a note.
- [ ] **AC-3** — **Given** `npm test` under the candidate, **When** it runs, **Then** the
  file and test counts are recorded against the current baseline. `vitest` transpiles
  without typechecking, so a suite passing under a new compiler is weak evidence on its
  own — it is recorded because a *drop* still means something.
- [ ] **AC-4** — **Given** the evidence from AC-1 through AC-3, **When** the decision is
  made, **Then** a [CONTEXT](../../CONTEXT.md) entry records it **either way**, with what
  was run and what was found. "Not yet" is a valid close and needs the same entry as "yes".
- [ ] **AC-5** — **Given** a decision to defer, **When** it is recorded, **Then** it names
  the concrete trigger that would reopen it — a version, a date, or a capability — and the
  `dependabot.yml` `ignore` from
  [US-5.3](US-5.3-devdependency-currency-and-dependabot.md) stays, with its comment updated
  to cite this decision instead of "pending a decision".
- [ ] **AC-6** — **Given** a decision to upgrade, **When** it is applied, **Then**
  `package.json`, `package-lock.json`, and any `tsconfig` option the new compiler requires
  move in one commit, and `npm run release:verify-pack` passes. No half state where the
  range moved and the lockfile did not.

## Tasks

- [ ] **TASK-5.4.1** — Establish the baseline before installing anything (AC: 2, 3)
  - [ ] `npm run build` on 5.9.3 and keep the tree — `cp -R dist /tmp/dist-ts5` or
        equivalent. A comparison needs both sides, and the first side stops existing the
        moment `build` runs again (`rm -rf dist`).
  - [ ] Record the current test counts.
- [ ] **TASK-5.4.2** — Run the candidate (AC: 1, 3)
  - [ ] Throwaway branch, `typescript@7.0.2`, `npm run typecheck` — read both tsconfigs'
        results separately.
  - [ ] `npm test`.
- [ ] **TASK-5.4.3** — Diff the emit (AC: 2)
  - [ ] `diff -r` the two `dist/` trees. Enumerate every difference; explain each against
        `target: ES2022` / `lib: ES2023` or treat it as a blocker.
- [ ] **TASK-5.4.4** — Decide and record (AC: 4, 5, 6)
  - [ ] [CONTEXT](../../CONTEXT.md) entry either way. If deferring, name the trigger and
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

> Deliberately left empty at planning time — W33 §Phase 3 retrospective §Followups. Filled,
> run, and counted before this story closes.

| AC | Command | Count |
|---|---|---|
| AC-1 | | |
| AC-2 | | |
| AC-3 | | |
| AC-6 | | |

## Changelog entry

> Written once the decision is made. If the outcome is "defer", there is no CHANGELOG entry
> at all — the [CONTEXT](../../CONTEXT.md) entry is the whole record, and a changelog is for
> what shipped.

### Changed
- <If upgrading> `typescript` 5.9 → 7.x. Emit compared against the 5.9 build and found
  <identical / differing in the following ways>.

## Implementation notes

<!-- Filled during implementation. -->

## Files modified

<!-- Filled during implementation. -->

## Cross-references

- [Epic EPIC-5](../epics/EPIC-5.md)
- [US-5.3](US-5.3-devdependency-currency-and-dependabot.md) — the refresh that carved this out
- [US-5.1](US-5.1-node-floor-and-ci-pins.md) — the artifact-independence argument AC-2 tests
