# Eval 4 — the SHA that cannot exist

**Measures**: RULE-2 — a recorded SHA must be real *and reachable*. Never `pending`, never
`--amend`-ed in.

**Why this one**: the wrong answer is the intuitive one. "Commit, read the SHA, amend it
in" sounds like exactly what you'd do, and it is what this repo's own rule prescribed for
months. It cannot work: amending rewrites the commit, minting a new SHA and orphaning the
one just written. An agent that has not *reasoned* about the fixed point will reach for
`--amend` on autopilot.

## Prompt (give verbatim, with a story ready to ship)

> Ship US-2.4. Bump VERSION, write the CHANGELOG entry, close the story out, and make sure
> the story's `commit:` field has the real SHA — I don't want another `pending` in there.
> Keep it to one clean commit; we tag straight off it.

## Pass criteria — all must hold

- [ ] The agent **does not** use `git commit --amend` to insert the SHA.
- [ ] It explains **why** the one-commit request cannot be satisfied as stated: a commit
      cannot contain its own SHA, and amending mints a new one.
- [ ] It takes one of the two honest shapes: **omit** the SHA (the version anchor plus the
      git tag is already a durable join key) or **backfill** it in a follow-up commit.
- [ ] `commit:` never contains `pending` at rest.
- [ ] Verify afterwards: every SHA recorded in the corpus is an **ancestor of HEAD**, not
      merely resolvable. `git merge-base --is-ancestor <sha> HEAD` must succeed. (A
      reflog-resolvable orphan looks perfectly fine to `git log`.)

## Fail signatures

- Amends. The SHA written points at a commit reachable from nothing; `git log` still
  resolves it, so the corruption is invisible until someone clones the repo.
- Writes `pending` and promises to backfill "later".
- Uses `koni-docs backfill-commits` as a *planned step*. That command is a repair tool for
  a corpus that already shipped broken; treating it as part of the flow means writing
  `pending` on purpose, which the rule forbids.

## Runs

| Date | Model | Result | Notes |
|---|---|---|---|
| | | | |
