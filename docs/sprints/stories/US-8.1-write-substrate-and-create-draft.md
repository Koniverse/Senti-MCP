---
id: US-8.1
title: "Write substrate, the opt-in, and create_draft"
epic: EPIC-8
status: ready
priority: P1
points: 5
sprint: sprint-2026-W34
assignee: bluezdot
created: 2026-08-21
updated: 2026-08-21
---

## Goal

Open the authoring write path: give `core/` a second verb, a second tool registrar and an
operator-set switch, then prove all three with the smallest write the tag has — `create_draft`,
the only one with no `404` and no confirmation.

## Background

Per the [design spec](../../superpowers/specs/2026-08-21-senti-authoring-write-tools-design.md)
§Substrate. `SentiClient` has only `get()`; `registerReadTool` pins `readOnlyHint: true` as a
constant; `Config` has no flag. Nothing about a write is reachable, by design, and this story is
where that changes for exactly seven operations.

### The 403 the read path gets wrong

`core/client.ts` hard-codes *"The API key is missing the `<scope>` scope — **not** that the
account is off limits."* That was true of every read. On `POST /drafts` a `403` also means **the
draft cap is full**, and against that cause the advice sends the reader to mint a key they
already hold while the actual fix is to delete something. `forbiddenMeans` is the fix; the read
tools keep today's wording by passing nothing.

### Why the idempotency key is derived rather than random

`POST /drafts` accepts `Idempotency-Key`. With no automatic retry anywhere in this epic, the
only duplicate this server can emit is a **model** calling the tool twice with the same
arguments — and two random keys make that two creates. A key derived from method, path and body
makes the identical repeat replay the original `201` instead of colliding with `409`, which is
what the header is for.

**The retention window is undocumented**, so `TASK-8.1.1` measures it: create, delete, then
re-issue the byte-identical create. If the second create replays a dead `draftId`, the fallback
is a random key per call and the dedup is forfeited — a trade to make against a measurement, not
in advance.

## Acceptance criteria

- **AC-1** — `RequestOptions` gains `forbiddenMeans`, `unprocessableMeans` and `upstreamMeans`;
  the `403` default string is byte-identical to today's, so no read-path test changes.
- **AC-2** — `failureOf` handles `413`, `422`, `502`, `503` and `504`. `503` reports
  `Retry-After` without waiting; its **absence** is reported as meaning a retry cannot help.
- **AC-3** — `504` and this server's own 15 s abort produce messages a reader cannot confuse.
- **AC-4** — `SentiClient.send(method, path, options)` exists; `get` and `send` share one
  private `request()`. `content-type` and `Idempotency-Key` are sent only when there is a body
  and a key respectively.
- **AC-5** — `idempotencyKeyFor(method, path, body)` returns 32 hex characters, is stable for
  the same request and differs when method, path or body differs.
- **AC-6** — Nothing retries. Asserted by call count on the fetch stub for a `503`.
- **AC-7** — `SENTI_ENABLE_AUTHORING_WRITE` is truthy for `1` and `true` only
  (case-insensitive, trimmed). `0`, `false`, `no`, `off`, `yes` and `''` are all off.
- **AC-8** — `registerWriteTool` pins `readOnlyHint: false` and `openWorldHint: true` and takes
  `destructiveHint` / `idempotentHint` from its spec. `registerReadTool` is unchanged and still
  pins `readOnlyHint: true`.
- **AC-9** — With the flag unset, `tools/list` returns exactly the fourteen read tools. With it
  set, it also returns every write tool registered so far.
- **AC-10** — `create_draft` `POST`s `{ name, sourceCode }` to `/api/v1/drafts` with a derived
  `Idempotency-Key`, and returns the new draft **without** echoing `sourceCode` in either
  `content` or `structuredContent`.
- **AC-11** — A `403` from `create_draft` names the draft cap and `delete_draft` as the fix; a
  `409` names the unique-name rule. Neither leaks the API key.
- **AC-12** — `name` shorter than 1 or longer than 120 characters is rejected before a request
  is made. `sourceCode`'s byte cap is **not** validated client-side.
- **AC-13** — `docs/SETUP.md` and `.env.example` both carry the new variable in this commit
  (RULE-11), and `AGENTS.md` §The read/write split is rewritten rather than deleted.

## Tasks

- [ ] **TASK-8.1.1** — Check the contract against the live service before writing code
  - [ ] Confirm the smoke key holds `authoring:write` (a `PUT` to a nonexistent draft id
        answers `404`, not `403`)
  - [ ] **Measure the idempotency retention window**: create a draft with a derived key,
        delete it, re-issue the byte-identical create with the same key, and record whether
        the response is a replay of the dead draft or a fresh `201`
  - [ ] Record both in §Implementation notes
- [ ] **TASK-8.1.2** — `core/client.ts` error branches (AC: 1–3)
- [ ] **TASK-8.1.3** — `core/client.ts` `send()` and `idempotencyKeyFor()` (AC: 4–6)
- [ ] **TASK-8.1.4** — `config.ts` opt-in (AC: 7)
- [ ] **TASK-8.1.5** — `core/tool.ts` `registerWriteTool` (AC: 8)
- [ ] **TASK-8.1.6** — `tools/authoring/write-result.ts` shaping (AC: 10)
- [ ] **TASK-8.1.7** — `create_draft`, registration and the `2.5.0` release (AC: 9–13)

## Dev notes

### What we explicitly did NOT do

- **No client-side source-size check.** The cap lives in the `limits` block the API publishes
  at runtime; a hardcoded copy drifts silently. The `413` and `422` branches report it.
- **No retry, no backoff, no sleep.** Not even on `429`.
- **No `readOnly?: boolean` on `registerReadTool`.** A parameter turns a mechanical barrier
  into a value a caller can get wrong.

### References

- [Design spec](../../superpowers/specs/2026-08-21-senti-authoring-write-tools-design.md)
  §Substrate, §Idempotency, §Error mapping
- [Implementation plan](../../superpowers/plans/2026-08-21-senti-authoring-write-tools-w34.md)
  Tasks 1–6
- [EPIC-8](../epics/EPIC-8.md) §Cross-cutting invariants

## Implementation notes

_Written during implementation._
