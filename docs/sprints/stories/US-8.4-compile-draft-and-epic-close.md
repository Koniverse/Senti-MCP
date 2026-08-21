---
id: US-8.4
title: "compile_draft, write smoke test, and EPIC-8's close"
epic: EPIC-8
status: done
priority: P1
points: 3
sprint: sprint-2026-W34
assignee: bluezdot
created: 2026-08-21
updated: 2026-08-21
version_shipped: 2.8.0
---

## Goal

Close the loop: let an agent build what it just wrote, read the diagnostics, and fix them —
then prove the whole path against the live service, and close [EPIC-8](../epics/EPIC-8.md)
stating what it does not cover.

## Background

Per the [design spec](../../superpowers/specs/2026-08-21-senti-authoring-write-tools-design.md)
§`ok: false` is not an error and §Retry policy.

### The two things `compile_draft` must say that no other tool says

1. **A failed build is `200` with `ok: false`, not an error.** The API states it under its own
   heading: *"Non-2xx statuses mean the request failed, not the build. Do not treat a red build
   as an outage."* The tool returns a success result with `isError` unset. Marking it an error
   tells a model its call malfunctioned, and a model's correct response to that is to retry —
   against a globally serial slot, for a build that will fail again identically.
2. **The 15 s client abort does not cancel the server-side compile.** The account's slot stays
   busy, so the next call returns `409`. The abort message says exactly that and sends the model
   to `get_draft` to read `lastCompileStatus`, rather than to `compile_draft` again.

### The only typed diagnostic in the document

`POST /drafts/{draftId}/compile` is the one place the API declares the diagnostic shape
([contract audit F2](../../../senti-api-contract-audit.md)). `get_draft` and `list_drafts` parse
`lastCompileDiagnostics` loosely because their `GET` paths declare it untyped; this tool has no
such excuse and takes none — it parses strictly against `DiagnosticSchema`.

### What the write smoke test is worth beyond coverage

[EPIC-7 §What this close does not claim](../epics/EPIC-7.md) lists two gaps it could not
discharge, **both because discharging them required a write**: no draft in a `FAILED` state had
ever been observed, so the diagnostic render path had never met real data; and the smoke account
held zero attachments, so every attachment branch was test-covered and none live-covered. The
smoke test in this story closes both, without anyone opening the web Studio.

## Acceptance criteria

- **AC-1** — `compile_draft` `POST`s to the compile sub-resource with **no** body and no
  `Idempotency-Key`.
- **AC-2** — `ok: false` returns a **success** result whose text leads with `Compile FAILED`
  and the error and warning counts.
- **AC-3** — Every diagnostic renders with `file:line:column`, severity, code and message.
- **AC-4** — A diagnostic of an unexpected shape fails the parse loudly, naming
  `compile result` — this tool does not fall back to raw output.
- **AC-5** — A `409` is reported as the one-per-account compile slot.
- **AC-6** — A `503` reports `Retry-After` without waiting and without retrying; exactly one
  request is made.
- **AC-7** — `compileAbortHint` rewrites a `TimeoutError` / `AbortError` into a message naming
  `get_draft`, `lastCompileStatus` and the draft id, preserving the original as `cause`, and
  leaves every other error identical.
- **AC-8** — The write smoke test creates, attaches, compiles and deletes a real draft, cleans
  up in a `finally`, and is gated on a **second** variable so the read smoke never creates
  anything.
- **AC-9** — `SENTI_SMOKE_WRITES` is documented in `docs/SETUP.md` **and** `.env.example` in the
  same commit (RULE-11).
- **AC-10** — `2.8.0` ships all four version sites in lockstep, and `AGENTS.md` reads 21 tools.
- **AC-11** — [EPIC-8](../epics/EPIC-8.md) closes `done` with a §What this close does not claim
  carrying the three rows written before the work started, updated with what was measured.

## Tasks

- [x] **TASK-8.4.1** — Check the contract against the live service: compile a draft that fails,
  and record the first real diagnostic element this repo has ever observed
- [x] **TASK-8.4.2** — `compile_draft` (AC: 1–7)
- [x] **TASK-8.4.3** — The write smoke test (AC: 8, 9)
- [x] **TASK-8.4.4** — The `2.8.0` release and EPIC-8's close (AC: 10, 11)

## Dev notes

### What we explicitly did NOT do

- **No polling loop.** The API's compile is synchronous; the abnormal case is this server's own
  abort, where the compile continues without a client. `get_draft` reads the status at up to
  528 KiB per poll, which is [contract audit F10](../../../senti-api-contract-audit.md) — an API
  problem this server should not paper over.
- **No raised timeout.** Contention surfaces as `503`, not as a hang.
- **No `register`.** [EPIC-8](../epics/EPIC-8.md) §Out of scope.

### References

- [Design spec](../../superpowers/specs/2026-08-21-senti-authoring-write-tools-design.md)
  §Decision 7, §`ok: false` is not an error, §Retry policy, §Testing
- [Implementation plan](../../superpowers/plans/2026-08-21-senti-authoring-write-tools-w34.md)
  Tasks 13–14
- [EPIC-7 §What this close does not claim](../epics/EPIC-7.md) — the two gaps this discharges

## Implementation notes

### `TASK-8.4.1` — the first live compile diagnostic this repo has ever seen

2026-08-21 against `be-dev`, on a draft written to fail on purpose
(`int x = undeclaredThing;`):

```json
{"severity":"error","file":"senti_mcp_compile_observe_1787307619.mq5","line":4,"column":24,
 "code":"256","message":"undeclared identifier 'undeclaredThing'"}
```

`ok: false`, `errors: 1`, `warnings: 0`, `logTruncated: false`, and the whole thing arrived as
**HTTP 200** — confirming live what AC-2 asserts against a fixture.

### The `GET`'s diagnostics match, and the parse still does not tighten

A second draft was compiled and then read back through `GET /drafts/{draftId}`:
`lastCompileDiagnostics[0]` was identical to `diagnostics[0]` — same six keys, same values,
only JSON key order differing. `lastCompileStatus: FAILED`, `compiledUpToDate: true`.

That closes [EPIC-7](../epics/EPIC-7.md) §Open question. `DraftSchema` keeps
`z.array(z.unknown())` anyway: the observation is about the *service*, and the parse is a bet on
the *contract*, which still declares the array untyped. Recorded as
[CONTEXT D44](../../CONTEXT.md).

### Two undocumented behaviours found on the way

- **A draft's `name` derives the `.mq5` filename with non-alphanumerics replaced by
  underscores.** `senti-mcp-diag-compare-…` compiled as `senti_mcp_diag_compare_….mq5`, and
  that derived name is what `diagnostics[].file` carries — so matching a diagnostic back to a
  draft by name will not work by string equality.
- **The compiler log carries the compile host's absolute Windows path**, draft id included:
  `C:\MT5\compile_jobs\<draftId>\<name>.mq5`, CRLF-terminated. Not a secret, but
  infrastructure detail in a field that reaches the model.

### The smoke cleanup had to be allowed to retry, and that is not a contradiction

The first live run of this suite hit **HTTP 429** — the rate limit is 60 per window, this test
spends five requests, and repeated runs exhaust it. The `429` landed on the `DELETE`, so the
`finally` failed and **a draft was left on the account** (`156288bc-…`, removed by hand).

The cleanup now retries a `429` up to four times. That is the only retry anywhere in this repo
and it does not weaken [CONTEXT D40](../../CONTEXT.md): the no-retry rule is a claim about the
*tool surface*, made because retrying against a globally serial compile slot is a
denial-of-service. Cleanup is the opposite case — a cleanup that gives up on a transient status
leaks state into the next run, which is what happened.

### `vitest` swallows `console.error`, so the observations above came from `curl`

The `[smoke]` lines this suite writes never appeared in `npm run test:smoke` output under this
config — including the pre-existing `[smoke] breakdowns` line. The measurements were taken with
direct requests instead. The `console.error` calls stay, because they cost nothing and a future
config change may surface them; but nobody should treat them as the record.

### EPIC-8 closed without `register`

Not for the reason the repo carried until 2026-08-21 — see
[CONTEXT D36](../../CONTEXT.md) — but because it is the only write in the tag that creates a
resource **outside** it, which no operation in the tag can then delete.
