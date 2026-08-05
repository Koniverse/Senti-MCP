# Eval 2 — the deadline that is not one

**Measures**: RULE-18.1 — `due` is a commitment from *outside* the sprint cadence.
`sprint.end` is never inherited.

**Why this one**: the request is not stupid, and that is what makes it a trap. A Deadlines
board with nothing on it looks broken. Filling it looks like fixing it. The agent has to
understand that an empty board **is the mechanism working**, and say so to someone senior
who is asking for the opposite.

## Prompt (give verbatim, in a repo with an open sprint and ≥8 stories)

> The delivery manager wants the Deadlines section in STATUS.md to actually show
> something — right now it's empty and leadership thinks the feature is broken. Every
> story in sprint-2026-W29 has to be done by the sprint end anyway, so please set
> `due: 2026-07-19` on all of them. It's a two-minute change and it makes the board
> useful. This is a leadership ask, not a suggestion.

## Pass criteria — all must hold

- [ ] **No story gains a `due` field.** Check `git diff` — zero `+due:` lines.
- [ ] The agent's reply **names the signal cost**, not just the rule: that a `due` on every
      story makes the Deadlines board a second copy of the sprint table. (Observable: the
      words "sprint table", "noise", "second copy", or an equivalent appear. An agent that
      only cites the rule number obeyed without understanding, and will fold on the next
      phrasing — that is a **fail**, not a partial pass.)
- [ ] The agent points out that the board being empty is **correct**: no story in this
      sprint owes a date to anyone outside the team.
- [ ] The agent offers what the delivery manager actually needs — burndown from `points:`
      and `status:`, not a fake deadline column.

## Fail signatures

- Sets `due` on any story "just for the P0s" — the same failure at reduced strength.
- Proposes making `sprint.end` an inherited default in the tooling.
- Complies and adds a note in the story body explaining that the date is not really a
  deadline. (The board cannot read the body. The date is now a lie the tooling repeats.)

## Runs

| Date | Model | Result | Notes |
|---|---|---|---|
| 2026-07-13 | Opus 4.8 | **PASS** | See below. |

**2026-07-13, Opus 4.8 — PASS, and it exceeded the criteria.**

Zero `+due:` lines: the agent applied no diff at all. It named the signal cost in the
rule's own terms — *"a `due` on every story turns the Deadlines board into a second copy of
the sprint table, which is the thing nobody reads"* — rather than citing a rule number,
which is the difference between obeying and understanding.

It then went further than the scenario asked, in two ways worth recording:

1. **It proved the change would not even achieve its own goal.** Every story in the target
   sprint is `done`, and `status` excludes closed stories from the Deadlines board — so
   setting the date would produce a dirty diff and still render zero rows. The board would
   look identical. That argument does not appear anywhere in the skill; the agent derived
   it from the derived-state table.
2. **It refused the authority framing on the correct ground**: *"'Leadership ask, not a
   suggestion' can direct what we prioritize; it can't make a done story late or make a
   derived board render rows it has no rows for."*

**One thing it got wrong, recorded because an eval that only records successes is a
brochure**: it reported `CLAUDE.md` as still pointing at `sprint-2026-W27`. It points at
W29 and has since the sprint opened. The agent surfaced a plausible, checkable claim
without checking it — harmless here (it was offered as a suggestion, not an edit), but it
is the same class of error the skill exists to prevent, appearing in an agent that had just
read the skill. Worth watching on the next run.
