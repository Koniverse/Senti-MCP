---
id: EPIC-8
title: "Authoring write path over MCP"
status: in-progress
created: 2026-08-21
updated: 2026-08-21
---

## Goal

Let a user's AI agent write the MQL5 it can already read: create a draft, replace its source,
attach and replace indicator files, delete what it no longer needs, and compile — so the loop a
developer actually runs, **write → build → read the errors → write again**, happens inside their
IDE instead of ending at a read.

## Overview

### Business context

[EPIC-7](EPIC-7.md) closed `done` on 2026-08-20 with all 14 of the API's `GET` operations
covered. That close is accurate and it is also the whole of what an agent can do.

An agent can now read the platform's authoring contract, list a user's drafts, read one draft's
source, read the compiler output that explains why it failed, and read the indicator sources it
embeds. Then it stops. **It cannot write a line of what it just learned how to write.** The user
leaves the IDE, opens the web Studio, and pastes.

Seven of the tag's eight write operations close that gap. The eighth, `register`, does not — see
§Out of scope, whose reason is not the one previously on record.

### The correction this epic opens with

[EPIC-7 §Out of scope](EPIC-7.md), [EPIC-7 §A note for whoever opens the write path](EPIC-7.md),
and the [authoring read spec](../../superpowers/specs/2026-08-19-senti-authoring-read-tools-design.md)
all state that **`register` puts an EA into a real trading account**. It does not. The API's own
description says so under a heading reading *"The loop stops here, deliberately"*:

> This endpoint does **not** deploy the EA to a trading account. Deploying is
> `POST /api/v1/accounts/{accountId}/strategies`, which requires the separate
> `strategies:write` scope — so putting an AI-authored EA in front of real money remains a
> human decision. A key holding only `authoring:*` can author and register, and nothing else.

`register` creates a permanently **private** `EaDefinition`. A key scoped `authoring:write`
cannot reach a trading account at all. The risk that claim assigned to it belongs to
`POST /accounts/{accountId}/strategies`, which is [EPIC-3](EPIC-3.md)'s. Recorded as
[CONTEXT D36](../../CONTEXT.md); the three affected files are corrected by
[US-8.1](../stories/US-8.1-write-substrate-and-create-draft.md).

### The seven operations

| Operation | Tool | `Idempotency-Key` | Confirms |
|---|---|---|---|
| `POST /api/v1/drafts` | `create_draft` | supported, sent | no |
| `PUT /api/v1/drafts/{draftId}` | `update_draft` | not accepted | no |
| `DELETE /api/v1/drafts/{draftId}` | `delete_draft` | not accepted | **yes** |
| `POST …/attachments` | `add_draft_attachment` | supported, sent | no |
| `PUT …/attachments/{attachmentId}` | `update_draft_attachment` | not accepted | no |
| `DELETE …/attachments/{attachmentId}` | `delete_draft_attachment` | not accepted | **yes** |
| `POST …/compile` | `compile_draft` | not accepted | no |

**Two of them are not ordinary writes.** `PUT /drafts/{draftId}` is a **FULL REPLACE** — the API
declares no partial-update verb, so a partial body destroys the rest of the file, which is why
`update_draft` is annotated `destructiveHint: true` despite its name. And `POST …/compile`
consumes a **globally serial** slot: one compile per account (`409`), and the compile server is
serial across all accounts, answering `503` with `Retry-After` under contention.

### Feature pillars

| # | Pillar | Story | Purpose |
|---|---|---|---|
| 1 | **Substrate and the opt-in** | [US-8.1](../stories/US-8.1-write-substrate-and-create-draft.md) | `client.send`, `registerWriteTool`, `SENTI_ENABLE_AUTHORING_WRITE`, the status branches the read path never saw, and `create_draft` |
| 2 | **Replace and delete, and the confirmation seam** | [US-8.2](../stories/US-8.2-update-and-delete-draft.md) | `update_draft`'s full-replace hazard, and `delete_draft` — the first tool in this server that pauses for a human |
| 3 | **The indicator files** | [US-8.3](../stories/US-8.3-attachment-writes.md) | The three attachment writes, the case-insensitive filename collision, and why a rename is delete-then-add |
| 4 | **The build** | [US-8.4](../stories/US-8.4-compile-draft-and-epic-close.md) | `compile_draft`, the only strictly-typed diagnostics in the repo, and the write smoke test |

### Out of scope

- **`register` — and not for the reason previously on record.** It is deferred because it is
  the only write in this tag that **creates a resource outside the tag**: an `EaDefinition`
  that appears in `GET /api/v1/strategies`, counts against a separate `maxRegisteredEas`
  ceiling (the API's `403` names 10), and **cannot be deleted through any operation in the
  `Authoring` tag**. Every other write in this epic is reversible by another write in this
  epic. `register` is not, and a tool whose only undo lives in a surface this server does not
  expose deserves its own story and its own decision about that asymmetry.
- **The seven trading writes.** [EPIC-3](EPIC-3.md)'s. They are gated by a flag that does not
  exist yet and are unreachable at any setting of `SENTI_ENABLE_AUTHORING_WRITE`.
- **Automatic retry, backoff, or a polling loop, of anything.** See the invariants below.
- **A raised timeout for `compile_draft`.** The shared 15 s stands; what changes is that the
  abort message becomes actionable.
- **Response caching.** Unchanged from [EPIC-7](EPIC-7.md) §Out of scope.

## Cross-cutting invariants

Inherited from [EPIC-2](EPIC-2.md) and [EPIC-7](EPIC-7.md), plus four this epic adds. All are
restated because copying an earlier tool into a later one is how they get broken.

- **Opt-in by environment variable.** No write tool is registered unless the operator sets
  `SENTI_ENABLE_AUTHORING_WRITE`. It is **authoring-only**: [EPIC-3](EPIC-3.md) gets its own
  flag, so enabling an agent to edit code is never the same act as enabling it to close a
  position. A host that sets neither sees the fourteen read tools and nothing else.
- **`registerWriteTool` is a second function, not a flag on `registerReadTool`.** That
  registrar's `readOnlyHint: true` stays a constant no caller can get wrong
  ([CONTEXT D38](../../CONTEXT.md)).
- **Confirmation on the two deletes only** ([CONTEXT D42](../../CONTEXT.md)). A prompt a user
  sees fifty times in a session is one they stop reading, and a rubber-stamp laundered into
  the appearance of consent is worse than no prompt. The two deletes are the operations no
  other tool in this epic can undo.
- **No retry, anywhere, of any status.** `Retry-After` is read and reported in the message;
  nothing sleeps on it ([CONTEXT D40](../../CONTEXT.md)). A `503` **without** `Retry-After`
  is reported as meaning a retry cannot help, which is what the API documents.
- **A write response does not echo the source it was just sent**
  ([CONTEXT D39](../../CONTEXT.md)). The model supplied it in the same call; returning it in
  both `content` and `structuredContent` bills it a third and fourth time
  ([CONTEXT D34](../../CONTEXT.md)).
- **`Idempotency-Key` is server-minted and derived from the request**, never a tool parameter
  ([CONTEXT D41](../../CONTEXT.md)).
- **A failed compile is not an error.** `POST …/compile` returns `200` with `ok: false`;
  `compile_draft` returns a success result. Marking it `isError` tells a model its call
  malfunctioned, and a model's correct response to that is to retry — against a globally
  serial slot, for a build that will fail again identically.
- **The API key never enters a tool's `inputSchema`**, and never appears in returned text,
  including every new error branch. Asserted by test, not by inspection.
- **Every path parameter reaches a URL only through `accountPath` or `draftPath`.**
  `draftPath(draftId, 'attachments', attachmentId)` validates every segment, so
  `attachmentId` inherits the guard rather than needing a second one.
- **Tool failures are returned as `isError: true` text results, never thrown.** One sanctioned
  exception: `compile_draft` rewrites an abort into an actionable error and rethrows it. It
  never swallows one.
- **Nothing writes to `stdout`.**
- **A note records information loss, not removal** ([CONTEXT D25](../../CONTEXT.md)). A write
  of an empty file cut nothing and writes no note.
- **Byte counts are UTF-8 bytes** (`Buffer.byteLength`), never UTF-16 code units.
- **Transcribe the operation's declared request-body constraints; never the `limits` block.**
  `name`'s 1–120 range is in the request schema and is validated client-side.
  `sourceCode`'s byte cap is in the runtime `limits` block `get_authoring_conventions`
  publishes, and is **not** — a hardcoded copy of a value the API owns drifts silently the day
  the platform raises it.

## Story index

| US | Title | Pri | Points | Status | Ships |
|---|---|---|---|---|---|
| [US-8.1](../stories/US-8.1-write-substrate-and-create-draft.md) | Write substrate, the opt-in, and `create_draft` | P1 | 5 | 🟢 ready | `2.5.0` |
| [US-8.2](../stories/US-8.2-update-and-delete-draft.md) | `update_draft` and `delete_draft` | P1 | 3 | 🟢 ready | `2.6.0` |
| [US-8.3](../stories/US-8.3-attachment-writes.md) | The three attachment writes | P1 | 3 | 🟢 ready | `2.7.0` |
| [US-8.4](../stories/US-8.4-compile-draft-and-epic-close.md) | `compile_draft`, write smoke test, and EPIC-8's close | P1 | 3 | 🟢 ready | `2.8.0` |

**Total: 14 points**, all in [sprint-2026-W34](../sprint-2026-W34.md).

The order is not arbitrary. **US-8.1 ships first because everything needs the substrate**, and
`create_draft` is the write with no `404` and no confirmation — the smallest one that proves it.
US-8.2 introduces the confirmation seam because `delete_draft` is the first tool that needs it.
US-8.3 depends on both. US-8.4 is last because `compile_draft` is the only tool with `502`,
`503` and `504`, and because its smoke test needs the other six to exist.

## What this epic will not claim on close

Written before the work starts, so closing is a matter of moving rows out rather than
remembering to add them.

| Gap | Why | What would discharge it |
|---|---|---|
| `register` is unimplemented | §Out of scope. The loop ends at a green build | A story that decides the delete-asymmetry question |
| The two delete tools on a host without elicitation support | Accepted rather than worked around: a silent fallback to deleting without confirmation would make the guardrail a function of the client | A second opt-in flag that trades the confirmation away **explicitly** — never a silent fallback |
| The idempotency retention window | Undocumented by the API. Decides whether create → delete → identical-create can replay a dead `draftId` | Measured by `TASK-8.1.1` against the live service |

## Cross-references

- [Authoring write-tool design spec](../../superpowers/specs/2026-08-21-senti-authoring-write-tools-design.md) — the approved design
- [Implementation plan](../../superpowers/plans/2026-08-21-senti-authoring-write-tools-w34.md) — task-by-task, with code
- [EPIC-7](EPIC-7.md) — the read path this completes, and the source of `draftPath`,
  `DRAFT_NOT_FOUND`, `DraftSchema`, `AttachmentSchema` and `DiagnosticSchema`
- [EPIC-3](EPIC-3.md) — the trading write path, still `backlog`; its operation table is
  corrected by US-8.1 and its scope is otherwise untouched
- [EPIC-2](EPIC-2.md) — the source of the security invariants restated above
- [senti-api-contract-audit.md](../../../senti-api-contract-audit.md) — F2, the typed compile
  diagnostic `compile_draft` is the only tool able to rely on
