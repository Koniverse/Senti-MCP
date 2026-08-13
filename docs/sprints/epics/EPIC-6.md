---
id: EPIC-6
title: "Sprint files as planning surfaces, not narrative"
status: backlog
created: 2026-08-13
updated: 2026-08-13
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

1. **What may a sprint file contain?** The candidate floor is frontmatter with a
   one-sentence goal, one scope table per phase with a short goal above it, and one
   retrospective per closed phase. Whether that is the right floor is the first question,
   not the premise.
2. **Does [D21](../../CONTEXT.md) forbid the retrofit?** D21 says *a closed phase's record
   is never rewritten to accommodate a later one*. Moving a paragraph into the epic that
   owns it may or may not be the act D21 prohibits — the answer decides whether the
   retrofit is possible at all, and it is load-bearing enough to need its own reasoning
   rather than an assumption in either direction.
3. **Where does each displaced kind of content go?** Sequencing rationale plausibly belongs
   to the epic. A risk entry carrying a dated "retired 2026-08-11" note plausibly belongs to
   the window it happened in. Sorting one from the other is a per-paragraph judgement, not
   a find-and-move.
4. **Do retrospectives stay?** They are the one section unambiguously about the window
   rather than about the work.
5. **Is the convention enforced by anything, or is it prose?**
   [EPIC-5](EPIC-5.md) §Cross-cutting invariants is blunt about the difference: a
   requirement written as a comment is not enforced.

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

No stories yet. Story planning opens in its own session, and the five questions in
§The open questions are what it has to settle first.

Scope agreed with the maintainer on 2026-08-13: the convention itself, plus the retrofit of
**both** [W32](../sprint-2026-W32.md) and [W33](../sprint-2026-W33.md). Leaving W32 behind
would make the new rule true of two files out of three, which is the failure mode named in
§Cross-cutting invariants.

Unassigned to a sprint. Scheduling is the maintainer's ([CONTEXT D21](../../CONTEXT.md)).

## Cross-references

- [CONTEXT D21](../../CONTEXT.md) — a sprint's scope stays open; the closed-record rule this epic has to reconcile with
- [CONTEXT D7](../../CONTEXT.md) — the Active Context block, removed for duplicating the sprint file and STATUS.md. The same complaint, one surface earlier
- [LESSONS 4](../../LESSONS.md) — a second copy that nothing reads drifts silently
- [sprint-2026-W32](../sprint-2026-W32.md) · [sprint-2026-W33](../sprint-2026-W33.md) — the two files in scope
- [sprint-2026-W34](../sprint-2026-W34.md) — out of scope; already conforming
- [EPIC-5](EPIC-5.md) — its §Stories section holds the sequencing that W33 §Phase 4 does not repeat
- [docs/README.md](../../README.md) — the doc hub, and where a repo-local convention would be stated
- [koni-docs `sprint-system.md`](../../../.agents/skills/koni-docs/references/sprint-system.md) — upstream's sprint schema, which this convention narrows rather than contradicts
