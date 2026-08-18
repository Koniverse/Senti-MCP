---
id: US-6.2
title: "Remove W33's relocated plan block"
epic: EPIC-6
status: done
priority: P2
points: 1
sprint: sprint-2026-W34
assignee: bluezdot
depends_on: [US-6.1]
created: 2026-08-17
updated: 2026-08-17
---

## Goal

Answer [EPIC-6](../epics/EPIC-6.md)'s question 3 for one block of prose — `## Phase 3 —
plan, dependencies, and risks` in [sprint-2026-W33](../sprint-2026-W33.md) — by establishing
where it came from, proving its content survives elsewhere, and deleting it.

## Background

[US-6.1](US-6.1-one-scope-table-per-sprint-file.md) merged W33's scope tables and left every
prose section standing, because question 3 was unanswered. The maintainer then asked the
question that answers it: neither W32 nor W33 inlines its implementation plan, so why does
one tranche carry 127 lines of plan, dependency list and risk register?

**It was never a decision.** `git log -S` puts the section's arrival at `94bb34f`, the D22
scope move. [sprint-2026-W34](../sprint-2026-W34.md) had been opened at `9591770` as a
complete sprint file for these four stories — §Phased plan, §Dependencies and sequencing
constraints, §Risks & dependencies — and when the scope moved into W33 those sections moved
with it: W34 −137 lines, W33 +129. They were renamed `## Phase 3 — plan, dependencies, and
risks` because W33's own §Phased plan and §Dependencies headings were already occupied by
its opening six stories. The asymmetry the maintainer noticed is a heading collision, not a
convention.

## Acceptance criteria

- [x] **AC-1** — **Given** the question "why does Phase 3 have this", **When** it is
  answered, **Then** the answer cites the commits rather than reasoning from the file's
  present shape: `9591770` opened W34 with the sections, `94bb34f` moved them.
- [x] **AC-2** — **Given** [EPIC-6](../epics/EPIC-6.md) §Cross-cutting invariants — *nothing
  that exists in exactly one place is deleted; content genuinely duplicated is removed only
  after the surviving copy is named in the same commit* — **When** the block is removed,
  **Then** every substantive finding in it has been located in at least one other file by
  command, and the surviving copies are named in [CONTEXT D31](../../CONTEXT.md).
- [x] **AC-3** — **Given** content that exists **only** in this block, **When** the removal
  lands, **Then** it is stated rather than glossed. Four plan-time day estimates and one
  concurrency sentence qualify; they are named in D31.
- [x] **AC-4** — **Given** the removal, **When** W33 is read, **Then** no retrospective is
  touched, including §Phase 3 retrospective, which is where the removed risks' outcomes
  already lived.
- [x] **AC-5** — **Given** the note under W33's scope table referenced the removed heading,
  **When** the block goes, **Then** the note is corrected in the same edit and says where
  the content went. A dangling §-reference is the failure this story exists to avoid
  repeating.
- [x] **AC-6** — **Given** the removal deletes prose that [D21](../../CONTEXT.md) protects,
  **When** it is recorded, **Then** a CONTEXT entry states how far D30's supersession is
  being extended and what is still out of its reach.
- [x] **AC-7** — **Given** the edit, **When** `npm run agile:validate` runs, **Then** it is
  green.

## Tasks

- [x] **TASK-6.2.1** — `git log -S` the section heading to find the commit that introduced
  it; read that commit's message and stat.
- [x] **TASK-6.2.2** — Diff `9591770:docs/sprints/sprint-2026-W34.md`'s headings against the
  block to confirm the relocation.
- [x] **TASK-6.2.3** — Grep every distinctive measurement and finding in the block against
  the rest of `docs/`, excluding W33 itself.
- [x] **TASK-6.2.4** — Delete lines 47–173; correct the scope-table note.
- [x] **TASK-6.2.5** — Write [CONTEXT D31](../../CONTEXT.md), naming the surviving copies and
  the unique losses.
- [x] **TASK-6.2.6** — Update [EPIC-6](../epics/EPIC-6.md) question 3.

## Verification commands

| AC | Command | Result |
|---|---|---|
| AC-1 | `git log --oneline -S"Phase 3 — plan, dependencies, and risks" -- docs/sprints/sprint-2026-W33.md` | `94bb34f docs: move EPIC-2's last four read tools into the running sprint` |
| AC-1 | `git show 9591770:docs/sprints/sprint-2026-W34.md \| grep -n "^## "` | W34 opened with §Phased plan, §Dependencies and sequencing constraints, §Risks & dependencies |
| AC-2 | `for p in 87,063 21,766 4,938 3,047 126,000 priceStopLimit ORDER_TYPE_BUY_LIMIT syncedThrough nextCursor; do grep -rl -- "$p" docs/ \| grep -v W33; done` | every pattern hits 2–4 other files — EPIC-2, US-2.10–2.13, CONTEXT, CHANGELOG |
| AC-3 | same loop for `"Four days of window remain"`, `"no implementation plan exists"`, `"concurrently with either"` | no hit outside W33 — recorded in D31 as the deliberate loss |
| AC-4 | `grep -n "^## " docs/sprints/sprint-2026-W33.md` | all four retrospective headings present; file 567 → 444 lines |
| AC-7 | `npm run agile:validate` | `✓ all references resolve` |

## Changelog entry

None. Documentation-only; no version is cut.

## Implementation notes

### The grep is the story

EPIC-6 §Business context asserted in 2026-08-13 that "almost none of it is information
absent from EPIC-2 or from US-2.10 → US-2.13", and [US-6.1](US-6.1-one-scope-table-per-sprint-file.md)
§What remains recorded that nothing had tested it. TASK-6.2.3 is that test, and the claim
held: nine distinctive strings, every one of them present in two to four other files. The
block was a fourth copy of findings that already had three homes.

The first run of that check was **wrong and looked right** — `grep -r --include=*.md` under
zsh expanded the glob, grep never ran, and the `||` fallback printed "ONLY in W33" for every
pattern. That is a result that would have justified *keeping* the block, produced by a
command that executed nothing. Re-run with the flag quoted, the answer inverted completely.
[LESSONS 2](../../LESSONS.md) is about a filter that selects nothing and exits 0; this is the
same shape one level out, in a shell rather than a test runner.

### What was not done

- **W33's and W32's own §Phased plan and §Dependencies sections stay.** They are short, and
  they were written for the sprint they sit in rather than relocated into it — a different
  question from a register that arrived by accident. EPIC-6 question 3 keeps that half.
- **Nothing was moved into EPIC-2.** It is `done` and already holds every finding; adding a
  duplicate to a closed epic is filing, not relocation.

## Files modified

- `docs/sprints/sprint-2026-W33.md` — §Phase 3 — plan, dependencies, and risks removed (127
  lines); scope-table note corrected
- `docs/CONTEXT.md` — **D31**
- `docs/sprints/epics/EPIC-6.md` — question 3 and §Stories
- `docs/sprints/sprint-2026-W34.md` — this story's row
- `docs/sprints/STATUS.md` — regenerated (RULE-5)

## Cross-references

- [Epic EPIC-6](../epics/EPIC-6.md) — question 3, half-answered here
- [CONTEXT D31](../../CONTEXT.md) — the decision, and the named surviving copies
- [CONTEXT D22](../../CONTEXT.md) — the scope move that relocated the block
- [US-6.1](US-6.1-one-scope-table-per-sprint-file.md) — the scope-table half
