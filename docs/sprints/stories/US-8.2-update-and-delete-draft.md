---
id: US-8.2
title: "update_draft and delete_draft"
epic: EPIC-8
status: done
priority: P1
points: 3
sprint: sprint-2026-W34
assignee: bluezdot
created: 2026-08-21
updated: 2026-08-21
version_shipped: 2.6.0
---

## Goal

Ship the two draft writes that can destroy work: a replace that is total, and a delete that
nothing in this server undoes. The second brings the confirmation seam with it.

## Background

Per the [design spec](../../superpowers/specs/2026-08-21-senti-authoring-write-tools-design.md)
§Tool surface and §Payload policy.

### `update_draft` is a full replace, and its name hides that

The API's summary is explicit: *"both `name` and `sourceCode` are always written, so send the
complete draft. There is no partial-update verb on this API."* A model that sends only the
function it changed deletes the rest of the file. The tool is therefore annotated
`destructiveHint: true` despite being called `update`, and its description carries the warning
where a model reads it **before** choosing the argument.

**It reports the bytes it wrote, not the bytes it replaced.** A before/after delta would need
the pre-write size, which the `PUT` response does not carry — only a second `GET` would supply
it, and a hidden read doubles the latency of every edit and races any concurrent writer.

### Why only the deletes confirm

[EPIC-3](../epics/EPIC-3.md)'s invariant reads *"every write tool pauses for an explicit human
confirmation"*. Applied literally here it fires on every iteration of an edit–compile loop, and
a confirmation seen fifty times in a session is one that gets rubber-stamped — the guardrail
becomes worse than none, because it launders assent into the appearance of consent
([CONTEXT D42](../../CONTEXT.md)).

### The seam identifies the round, not the answer

`acceptedContent()` returns `undefined` for a **declined** elicitation exactly as it does for a
**missing** one. Branching on it alone would re-ask on every decline and spin until the client's
`maxRounds` cap. The seam mints an opaque `requestState` on the first round and treats its
presence as "already asked". A forged state cannot skip the confirmation: it lands in the cancel
branch, because only *accepted* content reaches `run`.

### A declined confirmation is a success, not an error

The SDK rejects a non-error result that declares an `outputSchema` and supplies no
`structuredContent`. So `DeleteOutputSchema` is `{ id: string | null, deleted: boolean, notes:
string[] }` and a cancellation returns `{ id: null, deleted: false, … }`. `isError: true` would
tell a model something malfunctioned and invite a retry; a user saying no is neither.

## Acceptance criteria

- **AC-1** — `update_draft` `PUT`s `{ name, sourceCode }` to the draft path, sends **no**
  `Idempotency-Key` (the route does not accept one), and is annotated `destructiveHint: true`.
- **AC-2** — Its text says *full replace*, and its description says so before the arguments are
  chosen. It reports the new byte count only, with no invented before-figure.
- **AC-3** — When a compile predates the write, the text says the source has changed since it.
- **AC-4** — A traversal `draftId` is rejected before any request is made.
- **AC-5** — `delete_draft` sends **nothing** until the confirmation is accepted; asserted on
  the fetch stub's call count, not on the result alone.
- **AC-6** — A declined or `confirm: false` answer returns a **success** result carrying
  `{ id: null, deleted: false }` and a note saying no request was sent.
- **AC-7** — The confirmation is asked exactly once; a decline does not re-ask.
- **AC-8** — An accepted delete sends exactly one `DELETE` and reports the deleted id.
- **AC-9** — `delete_draft`'s text states that an EA already registered from the draft is not
  affected.
- **AC-10** — `2.6.0` ships with `VERSION`, `package.json`, `package-lock.json` and
  `SERVER_VERSION` in lockstep, and the CHANGELOG entry states that a host without elicitation
  support cannot use `delete_draft`.

## Tasks

- [x] **TASK-8.2.1** — Check the contract against the live service: confirm `PUT` rejects a body
  missing `name`, and that `DELETE` on a nonexistent id answers `404` rather than `200`
- [x] **TASK-8.2.2** — `core/tool.ts` confirmation seam (AC: 5–7)
- [x] **TASK-8.2.3** — `update_draft` (AC: 1–4)
- [x] **TASK-8.2.4** — `delete_draft` and the `2.6.0` release (AC: 5–10)

## Dev notes

### What we explicitly did NOT do

- **No silent fallback for hosts without elicitation.** A guardrail that a client can turn off
  by not implementing something is not a guardrail.
- **No confirmation on `update_draft`.** It is destructive and annotated so; the host's own
  tool-approval surface is what gates it.
- **No hidden `GET` before the `PUT`.** See §Background.

### References

- [Design spec](../../superpowers/specs/2026-08-21-senti-authoring-write-tools-design.md)
  §Decisions 4 and 6, §Payload policy
- [Implementation plan](../../superpowers/plans/2026-08-21-senti-authoring-write-tools-w34.md)
  Tasks 7–9
- [CONTEXT D42](../../CONTEXT.md)

## Implementation notes

### `TASK-8.2.1` — checked live before any code

2026-08-21, against `be-dev`. `DELETE /api/v1/drafts/<a nonexistent uuid>` answers `404` with
the standard envelope rather than a silent `200`, so `parseDeleted`'s `{ id }` shape is only
ever reached on a real deletion. The same probe run for `TASK-8.1.1` had already established
that the key holds `authoring:write` on both environments.

### The confirmation seam had a spin bug the plan did not anticipate

The obvious implementation — return `inputRequired` whenever `acceptedContent()` is
`undefined` — **loops**. `acceptedContent()` returns `undefined` for a *declined* elicitation
exactly as it does for a *missing* one, so a decline re-asks, and re-asks, until the client's
`maxRounds` cap. The seam therefore mints an opaque `requestState` on the first round and
treats its presence as "already asked".

That is safe in the direction that matters: a forged `requestState` **cannot** skip the
confirmation, because it lands in the cancel branch — only *accepted* content reaches `run`.
The test `asks exactly once — a decline does not re-ask until the round cap` is what pins it.

### The declined branch could not return bare text

Found while writing the plan, confirmed here. `validateToolOutput` in the SDK rejects a
non-error result that declares an `outputSchema` and supplies no `structuredContent`
(`isError` and input-required results are the only exemptions). So `DeleteOutputSchema` is
`{ id: string | null, deleted: boolean, notes: string[] }` rather than the spec's bare
`{ id }`, and a cancellation is a legitimate success saying nothing happened.

### A typecheck-only failure the test run could not see

`vitest` transpiles without checking, so the elicitation handler's
`content: Record<string, unknown>` passed every test and failed `tsc -p tsconfig.test.json`:
the wire shape is `Record<string, string | number | boolean | string[]>`. This is exactly what
[the `typecheck` script existing separately](../../../AGENTS.md) is for — a green suite is not
a typecheck.

### Confirmation is asked before the path is validated

A traversal `draftId` produces the elicitation first and the rejection second, so a user can
be asked to confirm deleting `../../admin` before the tool discovers it is not a legal id. It
is harmless — no request is ever sent — and the test
`rejects a traversal draftId before the confirmation is even asked` records the actual order
rather than the one its name assumes. Reordering would mean validating inside the registrar,
which is `core/`'s business rather than a tool's.
