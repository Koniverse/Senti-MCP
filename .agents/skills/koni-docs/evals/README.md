# Evaluations — does an agent holding this skill actually behave correctly?

**Contents**: [Why this exists](#why-this-exists) · [How to run one](#how-to-run-one) · [The scenarios](#the-scenarios) · [Scoring](#scoring)

## Why this exists

The scripts under [`../scripts/`](../scripts/) verify **a tool this skill ships** — a
reference checker, and two layers proving the checker works. None of them verify **the
skill**, whose actual product is *behaviour in another agent*.

These evals close that. Each is a realistic request with the pressure that makes its rule
hard, given to a fresh agent holding the skill and nothing else. The failure mode being
guarded against is the one this repo hits over and over: a document that reads beautifully
and instructs wrongly. A skill can be internally consistent, fully cross-referenced, and
still cause non-conformant output — and no amount of linting its prose would reveal it.

## How to run one

Give a fresh agent **only** this skill and the scenario prompt. Do not name the rule you
are testing, do not hint at the trap. Let it work in a scratch copy of a repo that has
`docs/` and the koni-docs CLI. Then check the artifact it produced against the criteria.

An eval that tells the agent what is being measured measures nothing.

**A scenario with an empty `## Runs` table is a specification, not a test.** It has
discriminated nothing. Run it, on more than one model tier if you can — a rule that holds
only on the strongest model is a rule that will break in production, and cheaper models are
where the rationalizations actually happen.

**Fixture**: run in a scratch clone of a repo that already has `docs/` with a PRD, epics,
an open sprint, and the koni-docs CLI installed. Two runs of the same scenario against
different corpora are not comparable.

## The scenarios

| # | File | What it measures | The trap |
|---|---|---|---|
| 1 | [`01-story-from-a-vague-ask.md`](01-story-from-a-vague-ask.md) | Can the agent turn a loose feature request into a conformant story file? | Frontmatter completeness under a vague ask — the fields nobody volunteers (`prd_ref`, `assignee` as a login, bare semver, AC↔task cross-refs) |
| 2 | [`02-the-deadline-that-is-not-one.md`](02-the-deadline-that-is-not-one.md) | Does it resist `due:` when the date is just the sprint end? | RULE-18.1 — a plausible, well-meaning request to make the Deadlines board "useful" |
| 3 | [`03-moving-a-date-quietly.md`](03-moving-a-date-quietly.md) | Does it write the CONTEXT entry when a date moves *proactively*? | RULE-18.3 — the slip hasn't happened yet, so "there's nothing to record" feels true |
| 4 | [`04-the-sha-that-cannot-exist.md`](04-the-sha-that-cannot-exist.md) | Does it refuse `--amend` and use the two-commit backfill? | RULE-2 — the impossible procedure *feels* like the obvious one |
| 5 | [`05-crediting-the-wrong-person.md`](05-crediting-the-wrong-person.md) | Does it resolve `assignee` to a GitHub login, not a git name? | RULE-15 — `git log --format=%an` is right there and looks correct |
| 6 | [`06-rewriting-a-decision.md`](06-rewriting-a-decision.md) | Does it append a correction rather than edit a decision? | RULE-7 — the old entry is genuinely wrong, so fixing it feels like diligence |

## Scoring

Each scenario passes only if **every** criterion in its file is met — they are written as
observable facts about the artifact, not impressions.

A scenario that "mostly" passes is a fail. The rules these test are BLOCKERs, and a
BLOCKER that holds four times out of five is a BLOCKER that ships the fifth.

Record results in the scenario file under `## Runs`, with the model and date. A rule that
regresses on a model tier is a finding, not a footnote.
