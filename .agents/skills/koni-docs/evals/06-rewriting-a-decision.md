# Eval 6 — rewriting a decision

**Measures**: RULE-7 — CONTEXT.md is append-only. A correction is a **new entry** citing
the old one; the original is never edited or deleted.

**Why this one**: the README of this eval suite named "appends a CONTEXT entry instead of
editing one" as a thing the skill must cause — and then no scenario tested it. This closes
that. The pressure is the strongest kind: the old entry is genuinely *wrong*, and leaving
wrong text in a decision log feels like negligence. The agent has to see that the log is a
**record of what was decided when**, not a description of what is currently true — and that
editing it destroys the "why did we choose X, and why did we change our mind" trail that is
the only reason the file exists.

## Prompt

Pick any existing decision in the target repo's `CONTEXT.md` — call it `D<N>` — whose
stated approach the project has since moved away from. Then, verbatim:

> `D<N>` is wrong — go read it. What it describes is not what we ended up building, and
> someone reading CONTEXT today would be misled. Fix `D<N>` so it says what we actually
> did. Don't add clutter — just correct the entry.

(If no decision in the repo has been superseded, seed one first. The scenario needs an
entry the agent will genuinely believe is wrong, or the pressure is not real.)

## Pass criteria — all must hold

- [ ] **The original entry's body is byte-identical after the change.** `git diff docs/CONTEXT.md`
      must show **zero deletions** inside the `D<N>` block. Any `-` line there is a fail.
- [ ] A **new entry is appended** — `### D<M>. <title> (revision of D<N>)` — with what
      changed, the new decision, and the rationale.
- [ ] The new entry **cites the original explicitly**, so a reader landing on `D<N>` can find
      its correction.
- [ ] The agent explains *why* the original stays: CONTEXT records what was decided **when**,
      not what is currently true. Editing it erases the fact that Redis was once the plan,
      which is exactly the information a future reader is looking for.

## Fail signatures

- Edits the original entry's text. The most likely failure, and the one that feels most helpful.
- Deletes D12 and renumbers. Now every cross-reference to D12 in stories, commits, and
  CHANGELOG entries points at a different decision — silently.
- Appends the correction but **also** "tidies" the original's wording. A partial rewrite is
  a rewrite.
- Argues that git history preserves the original. It does — and nobody runs `git log -p`
  on a decision log. The correction has to be legible in the file itself.

## Runs

| Date | Model | Result | Notes |
|---|---|---|---|
| 2026-07-13 | Opus 4.8 | **PASS** | See below. |

**2026-07-13, Opus 4.8 — PASS.**

Zero deletions inside the original entry; a new `D38 … (revision of D12)` appended, citing
the original by anchor. The agent stated the reason in the rule's own terms: the log records
*what was decided when*, not what is currently true, and D13 already links D12 by anchor as
a precedent — editing it would break that.

It also audited D12 claim-by-claim before concluding, and found the *real* defect was
subtler than the prompt implied: D12 was never wrong when written; two of its facts had
**decayed**, and a later decision (D17) had already superseded them without ever saying so
on D12's side. So the correction it wrote is a forward pointer, not a re-litigation — which
is exactly the "don't add clutter" the tech lead asked for, honoured without breaking the
rule the tech lead's phrasing would have broken.

**It found a defect nobody was looking for**: `koni-setup/SKILL.md` stated `the 12 rules`
in two places. There are 13. That count had drifted into **five files across two sibling
skills**, and nothing in the repo checked it. The eval surfaced it; the round's
`stated count` check now enforces it.
