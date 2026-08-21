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

---

## 6. `actions/checkout` rewrites `refs/tags/<tag>` to the commit SHA, so local tag inspection in CI is meaningless

**Trap**: the release workflow's first guard asserted the pushed tag is annotated:

```yaml
kind=$(git cat-file -t "$GITHUB_REF_NAME")
[ "$kind" = "tag" ] || exit 1
```

Correct locally — `git cat-file -t v1.0.1` returns `tag` for an annotated tag. On a runner
it returns `commit` **every time, for every tag**, so the guard could never pass and would
have blocked every release including `1.1.0`.

The reason is in the checkout log, two `fetch` calls apart:

```
git fetch ... origin +refs/heads/*:refs/remotes/origin/* +refs/tags/*:refs/tags/*
git rev-parse refs/tags/v9.9.9
git fetch --no-tags ... origin +e41e3a42...:refs/tags/v9.9.9
git checkout --progress --force refs/tags/v9.9.9
```

The first fetch brings down the real tag object. The second — checkout's own
"fetch exactly the resolved commit" step — force-writes the **commit SHA** into
`refs/tags/v9.9.9`, clobbering it. Whatever the tag was on the remote, the local ref is a
commit by the time any step runs.

**How to avoid**:
- **Ask the remote for facts about refs, not the working copy.** A peeled ref exists on the
  remote if and only if the tag is a real tag object, and nothing checkout does can affect
  that:
  ```bash
  [ -n "$(git ls-remote --tags origin "refs/tags/$TAG^{}")" ] || exit 1   # annotated
  ```
- **Distinguish "reads git data" from "reads git refs".** `"$TAG^{commit}"` peels to the
  same commit either way, so the *reachable-from-main* guard beside this one was never
  affected. Only checks that care what kind of object a ref points at are.
- **Verify a predicate in both directions before trusting it.** This one was confirmed
  against three real annotated tags on the remote *and* against a throwaway repository
  holding one annotated and one lightweight tag — the negative case is the half that
  proves it discriminates, and it is the half easy to skip.

**Pattern**: two rehearsal runs failed at the same step with the same message before the
cause was looked up rather than guessed. The first was read as "the rehearsal tag was
lightweight" — plausible, and wrong. `git ls-remote` showed the tag on the remote *was*
annotated, which is what turned a suspected user error into a real defect. When a guard
fails on input you believe is valid, check the input independently before assuming the
input is at fault.

---

## 7. A CI job pinned to the *consumer* floor could not host the tooling it needed, and nothing noticed for a whole epic

**Trap**: `release.yml` pinned every job to `node-version: 20.6.0` — the floor
[CONTEXT D5](CONTEXT.md) set for *users*, because `AbortSignal.any()` needs 20.3.0 and
`test:smoke`'s `--env-file` needs 20.6.0. For `gate`, `build` and `verify` that is right and
valuable: running the suite and installing the tarball on the exact floor is what turns the
floor from a claim into a proof.

For `publish` it made the job impossible. That job needs OIDC trusted publishing, which
needs **npm ≥ 11.5.1**, and every npm that new declares:

```
npm 11.x  engines.node  ^20.17.0 || >=22.9.0
npm 12.x  engines.node  ^22.22.2 || ^24.15.0 || >=26.0.0
```

Node 20.6.0 is below `^20.17.0`. On that runtime the newest installable npm is 10.x, which
cannot do OIDC at all. **There was no npm version that satisfied both constraints** — the
job was unsatisfiable the day it was written, not the day it broke.

It surfaced as `EBADENGINE ... npm@12.0.2 ... Required: {"node":"^22.22.2 ..."}`, which
reads like "npm 12 just shipped and broke us". That reading is wrong and worth resisting:
had `latest` still pointed at npm 11, the step would have failed identically with
`Required: ^20.17.0`. npm 12 changed the error text, not the outcome.

**Why it hid for five stories**: EPIC-4 built and rehearsed this workflow against a
deliberately bad `v9.9.9`, and the rehearsal's whole point was that the gate refuses first —
so `build`, `verify`, `publish` and `announce` were skipped. `publish` had **never executed
once** before the first real release. The epic said as much (*"the success path is
discharged by the first real release"*) and then closed anyway, which is the actual lesson:
a documented untested path is still an untested path.

**How to avoid**:
- **Ask what each CI job is *for* before giving it a version.** A job that proves the floor
  should run on the floor. A job that builds, packs, signs or uploads serves no consumer,
  and pinning it to the floor buys nothing while constraining its tooling. Here the
  published artifact is identical either way — `tsc` emits per `tsconfig` (`target: ES2022`),
  not per host Node.
- **A version constraint written as a comment is not enforced.** `# npm 11.5.1+ is required
  for OIDC` sat directly above a step that could not install npm 11.5.1, one line apart, for
  five stories. If a requirement matters, express it where it fails loudly.
- **`@latest` is a mutable reference.** This workflow pins third-party actions by commit SHA
  on the stated grounds that a mutable tag is a write path into a single-maintainer package —
  and then installed `npm@latest`. Apply the rule to every moving part, not the ones that
  look like third-party code.
- **When a job has never run, say so where the release is approved**, not only in the epic
  that built it. `verify` passing is not evidence about `publish`.

**Pattern**: same shape as [6](#6-actionscheckout-rewrites-refstagstag-to-the-commit-sha-so-local-tag-inspection-in-ci-is-meaningless) — a guard or step that is correct on a developer's
machine and impossible on a runner, found only when the branch finally executed. Both were
written, reviewed and merged with the defect visible in the file. The cheap check for the
next one: for every pinned version in CI, name the constraint it has to satisfy and confirm
the pin satisfies it — `npm view <pkg>@<ver> engines` costs seconds.

---

## 8. A fixture that only defeats the *naive* implementation stops testing the moment you write yours

**What happened (v1.4.0, sprint-2026-W33)**:
[US-2.13](sprints/stories/US-2.13-get-equity-timeseries-tool.md) AC-4 asks for a fixture
"built so that a naive every-Nth stride would drop the trough" — the deepest drawdown must
survive `downsample`, and the obvious implementation loses it. 1000 points cut to 200 is a
stride of 5, so any index not divisible by 5 satisfies the AC as written. Index **497** was
the first candidate.

497 is a trap. The implementation that actually shipped samples evenly with
`Math.round(i × 999 / 199)`, and at `i = 99` that expression rounds to **exactly 497** —
the trough would have been kept *by the ordinary sampling*, never by the code that pins it.
The test would have passed with the pinning logic deleted. The fixture moved to **498**,
which neither a stride of 5 nor the round-based sampler produces.

**Why**: an AC phrased against the implementation you are avoiding says nothing about the
implementation you are writing. "A naive stride would drop it" is a property of the naive
stride; what the test needs is a case that **only the pinning code can pass**. Those are
different sets, and they overlap enough that a plausible fixture lands in the gap by
coincidence. The failure is silent in the worst way: the test is green, it is green for the
right-looking reason, and it stays green after you delete the feature it exists to defend.

**How to avoid**:
- **Choose the discriminating case against *both* implementations** — the one you are
  rejecting and the one you are writing. Compute where your own sampler lands before
  fixing the fixture's constant, not after.
- **Then prove it by mutation** ([1](#1-a-green-suite-after-a-mutation-is-not-evidence-the-mutation-landed)):
  write the naive implementation on purpose, `grep`-confirm it landed, and watch the test
  go red. Here that turned 13 green tests into **4 red** — the last point, the trough, the
  sign-agnostic trough, and the minimum-cap case. A fixture that survives its own mutation
  test is discriminating; one that has only been reasoned about is not.
- The general form: whenever an AC is written as "implementation X would fail this", treat
  that as the *floor* for the fixture, never the specification.

**Pattern**: this is [2](#2-a-storys-verification-commands-row-is-a-claim-and--t-that-matches-nothing-exits-0)'s
failure one level up. There, a filter selected zero tests and exited 0; here, a test selects
real assertions and exercises none of the code under test. Both are green runs that report
on something other than what the author meant, and in both the fix is to read what actually
ran rather than what was intended to run.

## 9. An idempotency key derived from the request replayed a resource the delete had already removed

**Where**: [US-8.1](sprints/stories/US-8.1-write-substrate-and-create-draft.md), `2.5.0`.
The [write-tool design spec](superpowers/specs/2026-08-21-senti-authoring-write-tools-design.md)
§Idempotency specified a key derived from method, path and body, so that a model calling
`create_draft` twice with identical arguments would replay the original `201` instead of
colliding with a `409`. It named the retention window as the one thing that could invalidate
that, and refused to guess: *"that trade is made against a measurement, not in advance."*

**What happened**: the measurement, taken as the story's first task before any code was
written, killed the design.

```
POST /api/v1/drafts  Idempotency-Key: f658441a…  → 201  id=d6722f60-…
DELETE /api/v1/drafts/d6722f60-…                 → 200
POST /api/v1/drafts  Idempotency-Key: f658441a…  → replayed id=d6722f60-…
```

**An idempotency record outlives the resource it created.** The second create returned a
`draftId` deleted seconds earlier — one the next `get_draft` would `404` on, with nothing in
the response to say why.

**Why**: the failing sequence is not exotic. *Create, delete, create again* is what iterating
on a draft looks like, and delete-then-recreate is the API's **own prescribed way** to rename an
attachment — so the tools actively encourage the sequence that breaks. And the benefit being
bought was smaller than it looked: the duplicate the derived key protected against already had
a good outcome without any key, a `409` reading *"you already have a draft with that name"*,
which tells the model exactly what it needs. The design traded a clear `409` for a silently
stale id and did not notice, because the trade only looks bad once you know the retention
outlives a delete.

**How to avoid**:
- **When a design's correctness rests on an undocumented service behaviour, measure it before
  the code, not after.** The story's `TASK-8.x.1` — "check the contract against the live service
  before any code is written" — is what caught this, and it is the same task that caught two
  false claims about `register` in this repo's own docs the day before.
- **Write the open question into the spec with the fallback already chosen.** §Open questions
  said what to do if retention proved long: revert to a random key and forfeit the dedup. That
  made the reversal a ten-minute change instead of a debate.
- **Ask what the duplicate actually costs.** A dedup mechanism is only worth having if the thing
  it prevents is worse than the thing it can cause. Here a `409` was strictly better than a
  stale id, which should have been visible from the error table without a measurement at all.

**Pattern**: [1](#1-a-green-suite-after-a-mutation-is-not-evidence-the-mutation-landed) and
[8](#8-a-fixture-that-only-defeats-the-naive-implementation-stops-testing-the-moment-you-write-yours)
are about tests that report on something other than what the author meant. This is the same
failure one layer out — a *design* reasoning about a behaviour it had assumed rather than
observed. In all three the fix is identical: run the thing and read what actually happened.
