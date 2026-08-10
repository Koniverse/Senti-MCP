# LESSONS.md — Lessons Learned

> A lesson earns its keep if it saves the *next contributor* time. Delete entries that
> are no longer true — stale advice is worse than no advice.

---

## 1. A green suite after a mutation is not evidence the mutation landed

**What happened (v0.5.0 → v0.7.0, sprint-2026-W33)**: across this sprint's branch, an
edit meant to break an invariant on purpose — to prove a test actually catches it,
rather than assuming enrollment from reading the code — was made, and the edit did not
land the way it was intended to before the suite was re-run. The failure mode is subtle
precisely because its symptom (a green suite) is indistinguishable from the desired
outcome (a genuinely-undefended invariant would also show green until proven
otherwise). This entry was written after verifying US-2.9's own mutation test
(`registerListPendingOrders`'s `accountPath` call, below) landed correctly by `grep`
before trusting the red result that followed — a step worth naming explicitly because
skipping it is exactly the trap: reading a green run as "the invariant doesn't need
this test" when the real cause is narrower — the mutation never reached the file the
test ran against.

**Why**: a test suite reports on the code that is currently on disk. It has no way to
tell you "this is the code you meant to write" versus "this is the code you actually
wrote" — those are the same input to the test runner. A silently-failed-to-apply edit
and a genuinely undefended invariant produce the identical signal: green. The only way
to tell them apart is to look at the file, not at the test result.

**How to avoid**:
- After any mutation made specifically to prove a test would catch it, `grep` the
  target file for the mutated string (or its absence) *before* reading anything into
  the test result that follows. If the grep doesn't show what you expect, stop — the
  test result is meaningless until it does.
- Don't skip this step because the mutation "looks trivial" or the tool call "looked
  like it succeeded." Reported recurrences of this exact trap on this branch have all
  involved an edit that looked routine at the time — that is precisely why it went
  unnoticed until the test result was double-checked against the file.
- This is cheapest to build into the habit at the exact moment it matters most: when
  verifying that a shared, table-driven invariant (like the `accountPath`-traversal
  test every account-scoped tool enrolls in by adding one `TOOL_CALLS` row) actually
  covers a newly-added row, rather than assuming enrollment from reading the code.

**Pattern**: `src/tools/trading/orders.ts`'s `registerListPendingOrders` was
temporarily changed from `accountPath(args.accountId, 'orders')` to a raw template
literal, `grep`-confirmed to have landed, run against
`src/server.test.ts -t 'rejects a path-traversal'` (red, as expected — proving the row
was genuinely exercised), then reverted and `grep`-confirmed again before the suite was
trusted to be green for the right reason.

See [CONTEXT.md D9](CONTEXT.md) — the table-driven invariant tests this pattern most
often gets applied to.

---

## 2. A story's Verification-commands row is a claim, and `-t` that matches nothing exits 0

**What happened (v0.5.0 → v0.7.0, sprint-2026-W33)**: three stories shipped with a row
in their Verification-commands table that ran no tests at all.
[US-2.7](sprints/stories/US-2.7-list-account-strategies-tool.md)'s AC-2 row was
`list-account-strategies.test.ts -t traversal`;
[US-2.8](sprints/stories/US-2.8-list-positions-tool.md)'s and
[US-2.9](sprints/stories/US-2.9-list-pending-orders-tool.md)'s AC-1 rows were
`<domain-module>.test.ts -t accountPath`. Both filters name a behaviour that lives in
the `register*` function, not in the domain module the file selects — so the filter
matched nothing in the file it was pointed at. All three were drafted during planning,
before the tests they name existed, guessing which file and filter the AC would land in
once written. The [W33 retrospective](sprints/sprint-2026-W33.md) recorded this as
recurring and asked for it to become a checklist item; this entry is that item.

**Why**: the failure is silent by construction. A name filter that matches nothing is
not an error in vitest — it is zero selected tests, reported as skipped, and the process
**exits 0**:

```
$ npx vitest run src/tools/trading/positions.test.ts -t accountPath
 ↓ src/tools/trading/positions.test.ts (20 tests | 20 skipped)
   Test Files  1 skipped (1)
        Tests  20 skipped (20)
$ echo $?
0
```

Copy that into a story as evidence for an AC and it reads as a pass. Nothing in the
output says "the thing you meant to verify was never run" — the `↓` and the word
`skipped` are the only tell, and both are easy to skim past when the exit code agrees
with what you hoped. The deeper cause is ordering: a table written before its tests
exist can only guess, and a guess about a file path is not verifiable by rereading it.

**How to avoid**:
- **Run every row of a Verification-commands table, and read the test *count*, before
  writing the row into the story.** Not the exit code — the count. A row whose output
  says `0 passed` or `N skipped` is not evidence of anything.
- Draft the table *after* the tests exist. During planning, write the AC and leave the
  command cell empty rather than filling it with a plausible-looking guess that later
  reads as verified.
- When an invariant is enforced by a `register*` function but its subject (a helper like
  `accountPath`) is named after the domain module, the filter almost certainly belongs
  against `src/server.test.ts`, not the domain module's own test file. That mismatch is
  what produced all three instances here.

**Pattern**: [US-2.8](sprints/stories/US-2.8-list-positions-tool.md)'s corrected AC-1
row is `npm test -- src/server.test.ts -t "list_positions.*account-scoped"`, which
reports `Tests 1 passed | 33 skipped` — one selected test, genuinely run. The count is
the evidence; the exit code would have been 0 either way. Each of the three corrected
rows was executed and confirmed passing before being written back into its story, and
each now carries a note saying why the registration-level test file is the right target.

---

## 3. A gitignored worktree inside the repo is invisible to `git status` and fully visible to vitest

**What happened (v1.0.1, 2026-08-10)**: `npm test` reported **28 files / 394 tests**
where the package owns 14 files / 197 tests. The extra half came from
`.claude/worktrees/read-tools-w33/`, a git worktree left behind after
`feat/read-tools-w33` merged, pinned at `812f7e8` — a commit two releases behind `main`.
`git status` was clean and `git worktree list` was the only place the tree showed up.
The suite was green, so nothing drew attention to it; the W33 retrospective's "179 tests
total" no longer matched what `npm test` printed, and the reason was duplication rather
than new tests. `npm run prepublishOnly` ran the doubled suite too.

**Why**: two defaults compose badly. `.claude/worktrees/` is in `.gitignore` — correct,
those trees are scratch space — so git says nothing about it. Vitest's default `include`
is `**/*.test.ts` from the project root, and its default `exclude`
(`node_modules`, `dist`, `.git`, `.cache`, `.idea`, …) does not mention `.claude`. So
the one tool that would have told you the directory exists is silent, and the one tool
that reads it treats it as first-class source. The dangerous version of this is not a
doubled count: it is a stale worktree whose *older* copy of a test fails, or passes,
against code you are not editing.

**How to avoid**:
- **Scope test collection with an allowlist, not a blacklist.** `vitest.config.ts` sets
  `include: ['src/**/*.test.ts']`, anchored at the project root, so no nested tree can
  be collected whatever it is named — this fixes the class, where excluding `.claude/**`
  would only fix the one path ([CONTEXT D13](CONTEXT.md)).
- Verify a guard like that with a decoy rather than by reading the glob: drop a
  deliberately-failing test at `.claude/worktrees/decoy/src/decoy.test.ts`, confirm the
  count does not move, then delete it. A guard whose failure mode is silent needs
  evidence, not inspection — the same reasoning as entry 1.
- After merging a worktree branch, `git worktree remove <path>` and `git branch -d` it.
  `git worktree list` is the only routine command that shows the leftovers.

**Pattern**: `git worktree remove .claude/worktrees/read-tools-w33` +
`git branch -d feat/read-tools-w33` took `npm test` from 394 tests to 197, matching
`npx vitest run --exclude '**/.claude/**'` exactly — which is how the duplication was
confirmed as the cause before anything was deleted.

---

## 4. A version string that nothing reads drifts silently — `package-lock.json` was eight releases behind

**Trap**: `package-lock.json`'s top-level `version` field read `0.1.0` from the `0.2.0`
release until 2026-08-10, while `package.json` read `1.0.1`. Nine releases went out over
that span and nothing noticed, including a publish-readiness pass
([CONTEXT D12](CONTEXT.md)) that specifically went looking for stale artifacts. It was
found by accident, running `npm version 1.0.1 --allow-same-version` to check that a
command written into [RELEASE.md](RELEASE.md) actually worked — the no-op bump rewrote the
lock file and produced a two-line diff nobody expected.

**Why**: the repo has a real guard for the version string —
`src/config.test.ts` asserts `VERSION`, `package.json` and `SERVER_VERSION` agree, which
is more than koni-docs checks — and the lock file simply was not in the list. It could
not be: it was never *written* by the process. Bumps were done by editing `package.json`
directly rather than by `npm version`, which is the one command that keeps the lock in
step. And the field is informational at install time, so nothing downstream ever failed
and announced it.

**How to avoid**:
- **Enumerate every file the version appears in, then check them all in one place.**
  `npm run release:check` now verifies five: `VERSION`, `package.json`,
  `package-lock.json`, `src/config.ts`'s `SERVER_VERSION`, and the tag being pushed. A
  count that lives in prose ("the version lives in three places") is a claim that goes
  stale the moment a fourth appears.
- **Use `npm version --no-git-tag-version` to bump rather than editing `package.json`.**
  It updates the lock file in the same step. [RELEASE.md](RELEASE.md) §3 Step 2 says so.
- **Suspect the artifacts that nothing consumes.** A field whose wrongness cannot break a
  build is exactly the field that stays wrong the longest — the same shape as entry 3,
  where a green suite was what hid the duplication.

**Pattern**: the discovery method generalizes. Running a documented command *because it is
documented* — rather than trusting it was right when written — is what
[entry 2](#2-a-storys-verification-commands-row-is-a-claim-until-it-is-run) already asks
for, and it paid a second time here by turning up a defect the command was not looking for.

---

## 5. Twenty tests, and none of them ran the invocation CI uses

**Trap**: `scripts/release-check.mjs` accepts `[version] [--root <dir>] [--ci]`. Its
argument parser read

```js
const positional = args.filter((a, i) => !a.startsWith('--') && i !== rootFlag + 1);
```

which is correct when `--root` is present and wrong when it is not: `indexOf` returns
`-1`, so `rootFlag + 1` is `0`, and the filter discards **index 0 — the version
argument**. The gate then fell back to reading `VERSION` and compared it against itself.
Every version check passed by construction, on a script whose entire job is to refuse a
release when the version strings disagree.

The workflow invokes it as `npm run release:check -- "$version" --ci` — from the
repository root, with no `--root`. That is precisely the broken path, and it is the only
path that matters in production.

**Why 20 tests missed it**: every fixture-driven test points the gate at a throwaway
repository, so every one of them passes `--root`. The parameter that made the tests
possible was the parameter that hid the bug. Coverage was total over the shape the tests
could reach and zero over the shape the caller actually uses.

**It also survived a live CI rehearsal.** A deliberately-bad `v9.9.9` tag was pushed and
the workflow did fail — at the *first* guard, `The tag must be annotated`, because the
rehearsal tag was lightweight. `release:check` never executed. The run went red, the
publish job was skipped, and the evidence looked like proof; what it proved was that job
ordering works, not that the gate does.

**How to avoid**:
- **Test the caller's invocation, not just the callable.** Add one case that runs the
  command exactly as the workflow, README or npm script spells it — here, with `cwd` set
  and no test-only flags. The two cases now in `describe('release:check — argument
  parsing')` exist only for that.
- **Treat a test-only parameter as a warning sign.** `--root` exists so tests can reach a
  fixture. Any argument that only tests pass is an untested branch in the shape everyone
  else uses.
- **A red CI run is not proof the thing you care about ran.** Read *which step* failed.
  Failing earlier than expected looks identical to failing correctly — the same shape as
  [entry 2](#2-a-storys-verification-commands-row-is-a-claim-until-it-is-run), where a
  `vitest -t` filter matching nothing also exits 0.

**Pattern**: the bug was found by running `node scripts/release-check.mjs 9.9.9 --ci` by
hand — reconstructing the workflow's exact command line — while checking why the rehearsal
had stopped at the annotated-tag guard. Asking "what did the run *not* reach?" is what
turned a green-looking result into a real defect.
