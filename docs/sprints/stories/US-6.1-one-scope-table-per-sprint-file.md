---
id: US-6.1
title: "One scope table per sprint file"
epic: EPIC-6
status: done
priority: P2
points: 2
sprint: sprint-2026-W34
assignee: bluezdot
created: 2026-08-17
updated: 2026-08-17
---

## Goal

Settle the first of [EPIC-6](../epics/EPIC-6.md)'s five open questions — *what may a sprint
file contain* — for the **scope table only**, and retrofit both files written before the
answer existed. A sprint file gets one table; work that joins mid-window gets a row, not a
section.

This story deliberately does not touch the prose sections. That is EPIC-6's question 3 and
it stays open.

## Background

[CONTEXT D21](../../CONTEXT.md) §What is protected specified that each mid-sprint tranche
"gets its own scope table, its own total, and its own retrospective section". Applied three
times, that rule left [sprint-2026-W33](../sprint-2026-W33.md) at 584 lines with **four**
scope tables, four totals, and a fifth number reachable only by summing the other four.

[EPIC-6](../epics/EPIC-6.md) was opened 2026-08-13 to reach the convention that fixes this,
and listed five questions rather than answering them. The maintainer answered three of them
on 2026-08-17 — Q1 for the table, Q2, and Q4 — and directed the retrofit of both W32 and
W33 in the same session. The koni-docs sprint template already specifies the target shape:
a canonical scope table plus §Inline title annotations (`_(added YYYY-MM-DD)_`), documented
upstream as the *senti_quant pattern*. So the phase-table convention was a local divergence,
not a framework requirement.

**What makes this a 2-point story rather than the epic.** The retrofit moves no prose and
deletes no record. Every retrospective, every phase-scoped narrative, and the whole of W33
§Phase 3 — plan, dependencies, and risks survive as written; only the four table headings
are replaced, by a four-way mapping that names which rows each retrospective measures.

## Acceptance criteria

- [x] **AC-1** — **Given** [sprint-2026-W33](../sprint-2026-W33.md), **When** its scope
  section is read, **Then** it holds exactly one table, of 19 rows summing to 52 points,
  and the row count and point sum are verified by command rather than by eye.
- [x] **AC-2** — **Given** the merged table, **When** a reader asks when a row entered the
  sprint, **Then** every row that joined mid-window carries `_(added YYYY-MM-DD)_` in its
  Title cell and rows from the sprint's opening scope carry none. The dates are the ones
  the four phase headings recorded: 08-10, 08-10, 08-13.
- [x] **AC-3** — **Given** the four phase headings are gone, **When** a reader asks which
  stories a given retrospective measures, **Then** a note under the table maps all four
  retrospectives to their row ranges. Removing the headings without this note would lose
  information rather than move it — [EPIC-6](../epics/EPIC-6.md) §Cross-cutting invariants.
- [x] **AC-4** — **Given** W33's retrospectives and its §Phase 3 — plan, dependencies, and
  risks, **When** the retrofit lands, **Then** their **text** is unchanged. Verified by
  `git diff --word-diff -w`, not asserted. The bytes are not unchanged: `koni-docs sync`
  reformatted the whole file mechanically (see §Implementation notes), and the only
  difference it made inside these sections is escaping `~` to `\~`, which renders
  identically.
- [x] **AC-5** — **Given** [sprint-2026-W32](../sprint-2026-W32.md), **When** it is read
  beside W33, **Then** both files present scope the same way and W32's retrospective uses
  the template's `What went well` / `What didn't` / `Followups` headings. A rule true of
  one file out of two is a cleanup, not a convention.
- [x] **AC-6** — **Given** W32's retrospective sentences, **When** they are regrouped under
  the three headings, **Then** no sentence is rewritten. EPIC-6 §Out of scope forbids
  improving prose that a retrofit moves.
- [x] **AC-7** — **Given** this convention supersedes a clause of a recorded decision,
  **When** it is written down, **Then** a [CONTEXT](../../CONTEXT.md) entry records it in
  the same log as the decision it overrides, naming exactly which clause of D21 falls and
  which parts stand.
- [x] **AC-8** — **Given** the retrofit touches two sprint files, **When**
  `npm run agile:validate` and `npm run agile:status` run, **Then** validate is green and
  `STATUS.md` regenerates byte-identical but for its timestamp — the CLI reads story
  frontmatter, so a sprint-table edit that moved STATUS would mean something went wrong.
  Measured at that point in the work: 23 stories, timestamp-only diff. STATUS then went to
  **24** when this story's own file was created, which is this story's row arriving, not
  the retrofit's doing.
- [x] **AC-9** — **Given** a Status cell that carried a release number, **When** the merged
  table is written, **Then** the cell reads a bare `✅ done`. The version an
  already-`done` story shipped at lives in its own frontmatter, in the CHANGELOG and in its
  epic's §Stories table; repeating it in a fourth place is what `koni-docs sync` overwrites
  it for. Decided by the maintainer, 2026-08-17.

## Tasks

- [x] **TASK-6.1.1** — Read [EPIC-6](../epics/EPIC-6.md) and D21 §What is protected before
  editing anything, and decide per-question which of the five this story closes.
- [x] **TASK-6.1.2** — Merge W33's four scope tables into one, in the order the tranches
  arrived, annotating the 13 mid-window rows.
- [x] **TASK-6.1.3** — Write the total line with its addends (`15 + 16 + 11 + 10`) and the
  retrospective mapping note.
- [x] **TASK-6.1.4** — Shorten W33's `goal:` to one sentence naming the three deliverables.
- [x] **TASK-6.1.5** — Sync W32: annotation note under its total, retrospective regrouped
  under the three template headings, missing next-sprint cross-reference added.
- [x] **TASK-6.1.6** — Write [CONTEXT D30](../../CONTEXT.md).
- [x] **TASK-6.1.7** — Verify: row count, point sum, `git diff` on the retrospectives,
  `agile:validate`, `agile:status`.
- [x] **TASK-6.1.8** — Update [EPIC-6](../epics/EPIC-6.md) §Stories and §The open questions
  to record which questions this story closed and which stay open.

## Verification commands

Each row was run and its output read before this table was written.

| AC | Command | Result |
|---|---|---|
| AC-1 | `grep -c "^\| US-" docs/sprints/sprint-2026-W33.md` | `19` |
| AC-1 | `grep "^\| US-" docs/sprints/sprint-2026-W33.md \| awk -F'\|' '{s+=$6} END {print s}'` | `52` |
| AC-1 | `grep -c "^## Sprint scope" docs/sprints/sprint-2026-W33.md` | `1` |
| AC-2 | `grep -c '\*(added 2026-08-1' docs/sprints/sprint-2026-W33.md` | `13` — the marker is `*(added …)*` after `sync` normalised `_…_` to `*…*` |
| AC-4 | `git diff --word-diff=porcelain -w docs/sprints/sprint-2026-W33.md` | inside the retrospectives and §Phase 3, the only change is `~` → `\~` |
| AC-8 | `npm run agile:validate` | `✓ all references resolve` |
| AC-8 | `npm run agile:status` | `✓ wrote docs/sprints/STATUS.md (23 stories)`; diff = timestamp line only, *before* this story's own file existed |
| AC-9 | `grep -c "✅ done (" docs/sprints/sprint-2026-W33.md` | `0` — every Status cell is bare |

## Changelog entry

None. Documentation-only; no version is cut and `dist/` is untouched.

## Implementation notes

### What this story closed, and what it did not

Of [EPIC-6](../epics/EPIC-6.md)'s five open questions:

| # | Question | Outcome |
|---|---|---|
| 1 | What may a sprint file contain? | **Answered for the scope table only** — one table, mid-window scope is a row. The prose sections were left in place, so the broader question stands. |
| 2 | Does D21 forbid the retrofit? | **Answered: no**, for scope tables. [D30](../../CONTEXT.md) argues the closed-record concern attaches to the retrospective — an interpretation fixed at a point in time — not to the table, which is a live list a row cannot falsify. |
| 3 | Where does each displaced kind of content go? | **Open.** Nothing was displaced. W33 §Phase 3 — plan, dependencies, and risks, the section EPIC-6 §Business context names as the case that opened the epic, is untouched. |
| 4 | Do retrospectives stay? | **Answered: yes**, by the maintainer, and phase-scoped rather than merged. Four retrospectives written days apart measure different work with different evidence; merging them produces one voice that never existed. |
| 5 | Is the convention enforced by anything? | **Open.** D30 is prose. Nothing fails if a future sprint file grows a second table — the failure mode [EPIC-5](../epics/EPIC-5.md) §Cross-cutting invariants is blunt about. |

### The line count is the honest measure, and it is small

W33 went 584 → 567 lines. Seventeen lines, because the four table headings and three totals
are all that were removed and a five-line mapping note was added. The deliverable is *one
table*, not a shorter file — and stating that plainly is more useful than a percentage,
because the sections that actually carry W33's bulk are the ones question 3 still owns.

### The Status column is generated, so it says only `✅ done`

`npx koni-docs sync` writes each Status cell from the story's frontmatter, so the five cells
that read `✅ done (1.1.0)` through `(1.4.0)` and `(2.0.0)` came back bare the first time it
ran. The maintainer settled it rather than working around it: **a bare `✅ done` is what the
column is for.** A shipped version already lives in the story's `version_shipped`, in
`CHANGELOG.md`, and in the epic's §Stories table, and a fourth copy in a generated cell is
the drift [LESSONS 4](../../LESSONS.md) is about — not something to preserve.

Sync also reformats mechanically on first run: ISO timestamps in frontmatter, padded table
pipes, `_emphasis_` → `*emphasis*`, `~` → `\~`. All cosmetic, and it is idempotent from the
second run on.

### A prior attempt at this convention was reverted, and this one is placed differently

A CONTEXT entry for this convention was drafted on 2026-08-13 and deliberately reverted:
the convention had no decision behind it yet, and the maintainer wanted it settled inside
its own epic first. That epic is EPIC-6, and it now exists. D30 is written to CONTEXT rather
than only to the epic for one reason — it supersedes a clause of D21, and a decision that
overrides another belongs in the same log, or the reader of D21 never learns it changed.

## Files modified

- `docs/sprints/sprint-2026-W33.md` — four scope tables → one; `goal:` shortened;
  retrospective mapping note; two cross-reference lines
- `docs/sprints/sprint-2026-W32.md` — annotation note under the total; retrospective
  regrouped under the three template headings, sentences unchanged; cross-references to
  D30 and to W33
- `docs/CONTEXT.md` — **D30**
- `docs/sprints/epics/EPIC-6.md` — §Stories and §The open questions updated
- `docs/sprints/sprint-2026-W34.md` — this story's row
- `docs/sprints/STATUS.md` — regenerated (RULE-5)

No file under `src/` changed, and no version was cut.

## Cross-references

- [Epic EPIC-6](../epics/EPIC-6.md) — the four questions this story did not close
- [CONTEXT D30](../../CONTEXT.md) — the decision this story implements
- [CONTEXT D21](../../CONTEXT.md) — the clause D30 supersedes, and the two rules it leaves standing
- [sprint-2026-W33](../sprint-2026-W33.md) · [sprint-2026-W32](../sprint-2026-W32.md) — the two retrofitted files
