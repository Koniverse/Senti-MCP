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
