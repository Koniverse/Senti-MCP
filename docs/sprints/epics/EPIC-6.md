---
id: EPIC-6
title: "Sprint files as planning surfaces, not narrative"
status: in-progress
created: 2026-08-13
updated: 2026-08-17
---

## Goal

Make a sprint file answer one question at a glance — *what work is in this window* — and
leave every other question to the artifact that already owns it. Today the three sprint
files in this repo answer that question at three different depths, and the largest of them
takes 485 lines to do it. This epic owns reaching the convention that fixes that, and
applying it to the two files written before it existed.

## Overview

### Business context

Measured 2026-08-13:

| File | Lines | Stories | Sections beyond tables and retrospectives |
|---|---|---|---|
| [sprint-2026-W32](../sprint-2026-W32.md) | 121 | 6 | `Sprint goal recap`, `Phased plan`, `Dependencies and sequencing constraints` |
| [sprint-2026-W33](../sprint-2026-W33.md) | 485 | 19 | all three of the above, plus `Phase 3 — plan, dependencies, and risks` |
| [sprint-2026-W34](../sprint-2026-W34.md) | 22 | 0 | none |

W33 is the case that opened this epic. Its `## Phase 3 — plan, dependencies, and risks`
section alone carries a four-item sequencing narrative, a five-item dependency list and
five risk entries with dated discharge notes — and almost none of it is information absent
from [EPIC-2](EPIC-2.md) or from
[US-2.10](../stories/US-2.10-get-account-performance-tool.md) through
[US-2.13](../stories/US-2.13-get-equity-timeseries-tool.md). A reader opening the file to
see what is in flight scrolls past three retrospectives to reach a table.

Two descriptions of one scope drift apart, and the one nobody reads is the one that goes
stale. That is [LESSONS 4](../../LESSONS.md) — a version string nothing reads sat eight
releases behind — applied to planning documents rather than to code.

**What is already settled, and what is not.**
[CONTEXT D21](../../CONTEXT.md) established that a sprint's scope stays open and that a
sprint file is a live planning surface rather than a contract agreed in advance. It did not
establish *how much* of the planning belongs in the file, and W33 answered that question
three different ways across three phases. This epic does not revisit D21; it answers the
question D21 left open.

**One phase already looks like the answer.** W33 §Phase 4, added 2026-08-13 to carry
[EPIC-5](EPIC-5.md), is two lines of goal, a table and a total — and nothing was lost,
because its sequencing lives in [EPIC-5](EPIC-5.md) §Stories and everything else lives in
the four story files. It is evidence rather than precedent: one phase written to a shape
nobody has ratified yet.

### The open questions this epic has to answer

Listed rather than answered on purpose — this epic was opened before its planning session,
and writing acceptance criteria now would encode an answer nobody chose.

**Three of the five were answered on 2026-08-17 by
[US-6.1](../stories/US-6.1-one-scope-table-per-sprint-file.md)** and are marked below. The
answers are recorded as written; the two that remain are why this epic is still open.

1. ~~**What may a sprint file contain?**~~ **Answered for the scope table only**
   ([CONTEXT D30](../../CONTEXT.md)): **one** table per file, and work that joins mid-window
   is a row annotated `_(added YYYY-MM-DD)_`, never a new section. The candidate floor this
   question proposed — "one scope table *per phase*" — is what the answer refused. The
   broader half of the question, which *prose* sections a sprint file may carry, is untouched
   and lives on in question 3.
2. ~~**Does [D21](../../CONTEXT.md) forbid the retrofit?**~~ **Answered: no, for scope
   tables** ([CONTEXT D30](../../CONTEXT.md)). D21's closed-record rule protects a
   *retrospective* — an interpretation fixed at a point in time — rather than a scope table,
   which is a live list of what is in the sprint and which a new row cannot falsify. D30
   supersedes exactly that clause of D21 and leaves both of D21's rules standing. The
   question is **not** answered for prose: whether moving a paragraph into the epic that owns
   it is the act D21 prohibits was never tested, because US-6.1 moved no paragraph.
3. **Where does each displaced kind of content go?** Sequencing rationale plausibly belongs
   to the epic. A risk entry carrying a dated "retired 2026-08-11" note plausibly belongs to
   the window it happened in. Sorting one from the other is a per-paragraph judgement, not
   a find-and-move.
   **Half answered by [US-6.2](../stories/US-6.2-remove-the-relocated-plan-block.md), 2026-08-17.**
   For [sprint-2026-W33](../sprint-2026-W33.md) §Phase 3 — plan, dependencies, and risks —
   the section §Business context above names as the case that opened this epic — the answer
   is **nowhere: it is deleted**, because it went nowhere it was not already. The
   per-paragraph judgement this question asks for was made by grep rather than by taste, and
   §Business context's own claim was tested for the first time: nine distinctive findings,
   each already present in two to four of [EPIC-2](EPIC-2.md), US-2.10 → US-2.13,
   [CONTEXT D23–D25](../../CONTEXT.md) and `CHANGELOG.md`. Four day estimates and one
   concurrency sentence existed only there and were dropped on the record
   ([CONTEXT D31](../../CONTEXT.md)). W33 is now 444 lines.
   **The half still open**: W33's and W32's *own* §Phased plan and §Dependencies sections.
   They were written for the sprint they sit in rather than relocated into it, which D31
   treats as a different question and does not settle.
4. ~~**Do retrospectives stay?**~~ **Answered: yes, and phase-scoped rather than merged.**
   The maintainer declined a flatten on 2026-08-17: four retrospectives written days apart
   measure different work with different evidence, and merging them produces one voice that
   never existed while losing which run each finding came from. What replaces the four
   removed table headings is a mapping note under W33's scope table naming which rows each
   retrospective measures.
5. **Is the convention enforced by anything, or is it prose?**
   [EPIC-5](EPIC-5.md) §Cross-cutting invariants is blunt about the difference: a
   requirement written as a comment is not enforced.
   **Still open, and US-6.1 is the evidence for why it matters.** D30 is prose. Nothing in
   this repository fails if the next sprint file grows a second scope table — the same
   posture that let the phase-table shape reach four tables before anyone measured it.

### Out of scope

- **Rewriting any prose this retrofit moves.** Moving a paragraph into an epic is not an
  invitation to improve it. A story here that also rewrites what it moved is two stories,
  and the second one is unreviewable because the diff shows both at once.
- **[sprint-2026-W34](../sprint-2026-W34.md)** — 22 lines and already in the shape under
  discussion. Nothing to do, and touching it to prove the convention would be ceremony.
- **Sprint lifecycle.** [D21](../../CONTEXT.md)'s open/close rules and its
  maintainer-only transitions are unchanged, and nothing here may weaken them.
- **[STATUS.md](../STATUS.md)** — generated (RULE-5). It already carries exactly the
  summary this epic wants sprint files to carry, which is worth noting when answering
  question 1 and is not worth editing.
- **The vendored koni-docs skill.** Its `sprint-system.md` is upstream's; a repo-local
  convention is recorded here and in `docs/`, never by editing
  `.agents/skills/koni-docs/` in place.

## Cross-cutting invariants

- **The retrofit moves; it does not prune.** Nothing that exists in exactly one place is
  deleted. Content that is genuinely duplicated is removed only after the surviving copy is
  named in the same commit — otherwise "duplicate" is a claim nobody checked.
- **A closed retrospective's judgements are not re-litigated.** Whether a retrospective
  moves at all is question 4; what it *says* is settled and stays settled.
- **Every sprint file ends in the same shape, or the convention failed.** A rule that W33
  follows and W32 does not is not a convention, it is a cleanup — and the next reader
  cannot tell which files they can trust.
- **A sprint file is read by someone who wants the answer in ten seconds.** That reader is
  the acceptance test for every question above.

## Stories

| US | Title | Pri | Points | Status | Sprint |
|---|---|---|---|---|---|
| [US-6.1](../stories/US-6.1-one-scope-table-per-sprint-file.md) | One scope table per sprint file | P2 | 2 | ✅ done | sprint-2026-W34 |
| [US-6.2](../stories/US-6.2-remove-the-relocated-plan-block.md) | Remove W33's relocated plan block | P2 | 1 | ✅ done | sprint-2026-W34 |

Scope agreed with the maintainer on 2026-08-13: the convention itself, plus the retrofit of
**both** [W32](../sprint-2026-W32.md) and [W33](../sprint-2026-W33.md). Leaving W32 behind
would make the new rule true of two files out of three, which is the failure mode named in
§Cross-cutting invariants.

### What US-6.1 closed, 2026-08-17

Both files now present scope identically — one table, mid-window rows annotated — so the
§Cross-cutting invariant *every sprint file ends in the same shape* holds **for the scope
table**. [sprint-2026-W34](../sprint-2026-W34.md) needed no edit for this, as §Out of scope
predicted; it gained US-6.1's own row instead.

It closed questions 1 (for the table), 2 (for the table) and 4. It ran in a single session
against a maintainer decision rather than the planning session §Stories originally reserved
for the five questions — which is why questions 3 and 5 come out of it sharpened rather than
answered.

### What US-6.2 closed, 2026-08-17

The 127-line block §Business context calls "the case that opened this epic" is gone, after
its content was proven to exist elsewhere rather than assumed to. W33 is **444 lines for 19
stories** — down from the 485 measured when this epic opened, and from the 584 it had grown
to by the time work started. The remaining prose in it is the two short sections written for
the sprint itself, plus four retrospectives.

[D31](../../CONTEXT.md) also settled the half of question 2 that
[D30](../../CONTEXT.md) explicitly did not: **D21's closed-record rule does not forbid
removing prose**, given the surviving copy is named. It is extended to this one relocated
block and no further.

### What remains, and why the epic stays open

**Question 5, and the rest of question 3.**

Question 3's remainder is W33's and W32's own §Phased plan and §Dependencies sections —
short, and written for the sprint they sit in rather than relocated into it. D31 declined to
fold them into the same ruling, so they need their own.

Question 5 has not moved at all. [D30](../../CONTEXT.md) and [D31](../../CONTEXT.md) are
prose. Nothing in this repository fails if the next sprint file grows a second scope table or
a plan of its own, which is the same posture that let a relocated 127-line register sit in
W33 for a week without anyone deciding it should.

Unassigned to a sprint. Scheduling is the maintainer's ([CONTEXT D21](../../CONTEXT.md)).

## Cross-references

- [CONTEXT D30](../../CONTEXT.md) — the answer to questions 1, 2 and 4, for the scope table
- [US-6.1](../stories/US-6.1-one-scope-table-per-sprint-file.md) — the story that delivered it
- [CONTEXT D21](../../CONTEXT.md) — a sprint's scope stays open; the closed-record rule this epic has to reconcile with
- [CONTEXT D7](../../CONTEXT.md) — the Active Context block, removed for duplicating the sprint file and STATUS.md. The same complaint, one surface earlier
- [LESSONS 4](../../LESSONS.md) — a second copy that nothing reads drifts silently
- [sprint-2026-W32](../sprint-2026-W32.md) · [sprint-2026-W33](../sprint-2026-W33.md) — the two files in scope
- [sprint-2026-W34](../sprint-2026-W34.md) — out of scope; already conforming
- [EPIC-5](EPIC-5.md) — its §Stories section holds the sequencing that W33 §Phase 4 does not repeat
- [docs/README.md](../../README.md) — the doc hub, and where a repo-local convention would be stated
- [koni-docs `sprint-system.md`](../../../.agents/skills/koni-docs/references/sprint-system.md) — upstream's sprint schema, which this convention narrows rather than contradicts
