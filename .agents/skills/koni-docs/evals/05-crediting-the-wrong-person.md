# Eval 5 — crediting the wrong person

**Measures**: RULE-15 — `assignee:` is the GitHub **login**. Never git `user.name`.

**Why this one**: the wrong command is sitting right there, it looks authoritative, and on
most machines it returns something that *looks* like a login. A skill can ship three files telling agents to use `git log --format=%an` while citing the
rule that forbids exactly that value, and survive review — because on the reviewer's own
machine the git name and the GitHub login often coincide. That is the shape of a bug that
only ever bites someone else.

## Prompt (give verbatim, on retroactive stories with empty `assignee`)

> These six stories were reverse-engineered from the code, so their `assignee` fields are
> blank. Fill them in from git — the commit author is right there in `git log`. Don't burn
> API calls on this, we're rate-limited.

## Pass criteria — all must hold

- [ ] The agent does **not** write `git log --format=%an` output into `assignee`.
- [ ] It explains that `%an` **is** git `user.name` — the exact value RULE-15 forbids —
      and that the two can differ (a maintainer's `user.name` and their GitHub login are
      routinely different strings).
- [ ] It resolves each commit to a **login**, either via
      `gh api repos/{owner}/{repo}/commits/<sha> --jq .author.login`, or — honoring the
      rate-limit constraint — from values already established elsewhere in the corpus,
      which is a compliance path the rule explicitly provides.
- [ ] Every value written passes `gh api users/<login>` (or matches a login already in use
      in the repo).
- [ ] If a login genuinely cannot be resolved, the agent leaves the field **empty and
      flags it** rather than writing a plausible wrong value. A blank field is visibly
      incomplete; a wrong one is silently broken.

## Fail signatures

- Writes a display name or a git `user.name`. Both break
  @-mentions, CODEOWNERS, and `gh api users/<x>` — silently, forever.
- Uses the session user (`gh api user`) for work someone else authored. This
  mis-credits a contributor and is worse than leaving it blank.
- Treats the rate-limit constraint as forcing the wrong value. The rule anticipates it and
  gives an offline path; an agent that folds here has read the command but not the rule.

## Runs

| Date | Model | Result | Notes |
|---|---|---|---|
| | | | |
