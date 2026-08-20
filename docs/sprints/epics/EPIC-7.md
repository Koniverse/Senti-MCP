---
id: EPIC-7
title: "Authoring read path over MCP"
status: done
created: 2026-08-19
updated: 2026-08-20
---

## Goal

Let a user's AI agent read the MQL5 work that user is authoring — the platform's own
authoring contract, the drafts they hold, the source of one draft, the compiler output that
explains why one failed, and the indicator sources a draft embeds — without the agent
guessing at rules it could have read, and without any single read exhausting the context
window it is read into.

## Overview

### Business context

[EPIC-2](EPIC-2.md) closed `done` on 2026-08-12 with its scope stated exactly: *"all ten of
the API's `GET` operations have a tool"*. That sentence was true when it was written and is
no longer a description of the API.

**The API has grown from 17 operations to 29.** A new `Authoring` tag adds 12: four `GET`
and eight writes. None is reachable from this server, so an agent that can read a user's
positions, deals and performance cannot see the EA they are writing, cannot read why it
failed to compile, and — most consequentially — cannot read the rules it is supposed to
generate code against.

That last gap is the reason this epic is worth opening now rather than after the write path.
The `conventions` endpoint's own description states the cost of not reading it:

> Code that violates these rules is rejected by the L1 static scan before it ever reaches the
> compiler, so discovering them by trial and error costs a round-trip on a globally serial
> compile slot and still fails.

An agent with no way to read the contract discovers it by failing against a serialized,
shared resource. `get_authoring_conventions` is the cheapest tool in this epic and the one
with the largest effect on what the agent produces.

**This is a new epic rather than a reopening of EPIC-2.** Reopening a closed epic to absorb a
tag that did not exist when it closed would make its `done` mean less, and EPIC-2's close
carries a §What this close does not claim that a later reader is meant to be able to trust.

### The payload problem, which is this epic's defining constraint

`GET /api/v1/authoring/conventions` publishes the platform's own ceilings. Read live on
2026-08-19:

| Limit | Value |
|---|---|
| `maxDrafts` | 20 |
| `maxAttachmentsPerDraft` | 5 |
| `maxAttachmentBytes` | 65,536 (64 KiB) |
| `maxSourceBytes` | 196,608 (192 KiB) |
| `maxRegisteredEas` | 10 |

Those are the API's declared maxima, which makes each endpoint's worst case arithmetic rather
than guesswork:

| Endpoint | Worst-case body | ≈ tokens |
|---|---|---|
| `GET /drafts` | 20 × (192 KiB + 5 × 64 KiB + 16 KiB log) = **10.3 MiB** | ~2,700,000 |
| `GET /drafts/{draftId}` | 192 + 320 + 16 KiB = **528 KiB** | ~135,000 |
| `GET /drafts/{draftId}/attachments` | 5 × 64 KiB = **320 KiB** | ~82,000 |
| `GET /authoring/conventions` | 2,350 B measured | ~590 |

**Every draft-bearing endpoint in this tag can exceed a context window on its own.** EPIC-2
met payload weight once, in `get_performance_breakdowns`, and treated it as that story's
problem. Here it is the epic's problem, and it is why three of the four tools shape their
response and only `get_authoring_conventions` does not.

### Feature pillars

| # | Pillar | Stories | Purpose |
|---|---|---|---|
| 1 | **Substrate and the contract** | [US-7.1](../stories/US-7.1-authoring-substrate-and-conventions-tool.md) | `draftPath` extracted from `accountPath`, `tools/authoring/`, and `get_authoring_conventions` — which publishes the limits the other three stories size their cuts against |
| 2 | **Full-fidelity draft read** | [US-7.2](../stories/US-7.2-get-draft-tool.md) | `get_draft`, and the `DraftSchema` / `AttachmentSchema` its two siblings import rather than redeclare |
| 3 | **The shaped collection** | [US-7.3](../stories/US-7.3-list-drafts-tool.md) | `list_drafts`, four cuts and one note — the largest payload in the tag |
| 4 | **A budget, not a truncation** | [US-7.4](../stories/US-7.4-list-draft-attachments-tool.md) | `list_draft_attachments`, its byte budget and the `filename` filter that reads what the budget left out |

### Out of scope

- **All eight authoring write operations** — `POST /drafts`, `PUT` and `DELETE` on a draft,
  the three attachment writes, `POST …/compile` and `POST …/register`. Not registered, and
  not written "ready to enable", under the standing rule in [AGENTS.md](../../../AGENTS.md)
  §The read/write split. Two of them deserve naming now because they are not ordinary writes:
  **`register` puts an EA into a real trading account**, and **`compile` consumes a globally
  serial slot**, so a retry policy that is harmless on a read is a denial-of-service on it.
- **Response caching, including for `conventions`.** It is the one endpoint whose
  `Cache-Control: public, max-age=3600` invites it, and it already serves a weak `ETag` —
  but caching is still a mechanism this server does not have, and adding one for a single
  endpoint would be the first cache in the process with no eviction policy and no other
  consumer. A decision, not an omission.
- **Compiling or evaluating `forbiddenConstructs[].pattern`.** The values are regexes; the
  document types them as bare strings and never says which dialect. A `RegExp` built from an
  undeclared dialect is a crash or a silent mismatch. They are passed through verbatim.

### A note for whoever opens the write path

**[EPIC-3](EPIC-3.md)'s operation table is stale.** It lists 7 write operations; the API now
has 15. This epic does not edit it — EPIC-3 is `backlog` and its own design spec will re-read
the document anyway — but the staleness is recorded here so it is found rather than
discovered.

What this epic hands forward: `draftPath`, `DRAFT_NOT_FOUND`, and the full-fidelity
`DraftSchema` and `AttachmentSchema`. Every authoring write reads back a draft, and none of
them should transcribe that schema a second time.

## Cross-cutting invariants

Inherited from [EPIC-2](EPIC-2.md) and restated because copying an earlier tool into a later
one is how they get broken:

- **The API key never enters a tool's `inputSchema`**, and never appears in returned text,
  including every error branch. Asserted by test, not by inspection.
- **Every path parameter reaches a URL only through `accountPath` or `draftPath`.** `draftId`
  originates from the model. **Enrolment in the traversal test is not optional**: the
  assertions in `src/server.test.ts` are table-driven over `TOOL_CALLS`, so a draft-scoped
  tool joins by adding a row *with `arguments`*. Build the path any other way and the test
  will not notice — which is the defect, not the guard.
- **Tool failures are returned as `isError: true` text results, never thrown.**
- **Nothing writes to `stdout`.**
- **A note records information loss, not removal** ([CONTEXT D25](../../CONTEXT.md)). Every
  cut in this epic loses something, so every cut writes a note — unlike
  `get_performance_breakdowns`, where three of five cuts were free. `notes` is still empty
  when nothing was cut.
- **Source is returned whole or not at all.** No tool emits a partially-returned source file:
  half an MQL5 file reads as a complete one to a model that did not write it, and there is no
  way to signal "this compiles only because you cannot see the rest".
- **Byte counts are UTF-8 bytes** (`Buffer.byteLength`), never UTF-16 code units. MQL5 source
  carries comments and comments carry non-ASCII.

## Story index

| US | Title | Pri | Points | Status | Ships |
|---|---|---|---|---|---|
| [US-7.1](../stories/US-7.1-authoring-substrate-and-conventions-tool.md) | Authoring substrate and `get_authoring_conventions` | P1 | 3 | ✅ done | `2.1.0` |
| [US-7.2](../stories/US-7.2-get-draft-tool.md) | `get_draft` tool | P1 | 2 | ✅ done | `2.2.0` |
| [US-7.3](../stories/US-7.3-list-drafts-tool.md) | `list_drafts` tool | P1 | 3 | ✅ done | `2.3.0` |
| [US-7.4](../stories/US-7.4-list-draft-attachments-tool.md) | `list_draft_attachments` tool | P1 | 2 | ✅ done | `2.4.0` |

**Total: 10 points**, all in [sprint-2026-W34](../sprint-2026-W34.md).

The order is not arbitrary. **US-7.1 ships first because it publishes the limits** — the
`conventions.limits` block is the input that sizes US-7.3's and US-7.4's cuts, and
US-7.4's byte budget is literally `maxAttachmentBytes`. US-7.2 precedes US-7.3 because
nothing can be shaped before the unshaped shape exists.

## What this close does not claim

**This epic closed `done` on 2026-08-20: all 14 of the API's `GET` operations have a
tool**, shipped `2.4.0` by
[US-7.4](../stories/US-7.4-list-draft-attachments-tool.md). `status: done` means every
read operation over the `Authoring` tag has a tool that parses, shapes and renders the
real service's response. It does **not** mean every branch of those tools has run
against the real service. This section was written before the work started, precisely so
that closing the epic would be a matter of moving rows out rather than remembering to add
them — and none moved. Every row below is still true as of the close, checked again
against the live smoke account during US-7.4's implementation:

| Branch | Why it never ran | What would discharge it |
|---|---|---|
| Every attachment code path in all three draft tools | The smoke key holds 4 drafts and `attachments` was `[]` in 4/4 — reconfirmed live on 2026-08-20, unchanged since `2.2.0` | One attachment created in the web Studio |
| `list_draft_attachments`'s byte budget and its `filename` filter | The same condition — the budget cannot bind on an empty set | As above |
| The `DiagnosticSchema` render path in `get_draft` | `lastCompileDiagnostics` was `[]` in 4/4 drafts, including the one that compiled `SUCCESS` — same account, same 2026-08-20 check | One draft left in `FAILED` state |
| `DRAFT_NOT_FOUND`'s 404 | Never provoked live; covered by test only | A `GET` for a draft id the key does not own |

**Both of the first two are cheap to discharge** — they need a UI action, not the offline MT5
terminal that EPIC-2's equivalent gaps have been waiting on since 2026-08-10.

**The open question below on `lastCompileDiagnostics` is still open.** Nothing in US-7.1
through US-7.4 settled it: every live draft's `lastCompileDiagnostics` was empty, so the
loose-parse/tight-render pair `get_draft` ships (§Open question below) has never been
checked against a real diagnostic element. Closing this epic is not a claim that the
question closed with it.

## Open question this epic carries

**Whether a `GET`'s `lastCompileDiagnostics` element really matches the compile response's
diagnostic.** The two `GET` paths declare the array untyped (`object` with
`additionalProperties: {}`), while `POST /drafts/{draftId}/compile` in the same document
types its `diagnostics` items fully — `{ severity, file, line, column, code, message }`, all
six required — and the `GET` description directs the reader to `lastCompileDiagnostics` as
*"the machine-readable, never-truncated form — parse that"*.

The epic handles the uncertainty rather than resolving it: **parse loosely, render tightly.**
`DraftSchema` declares `z.array(z.unknown())` so a divergence cannot fail a tool call, and
`get_draft`'s formatter `safeParse`s each element against the compile response's shape,
falling back to raw output. A mismatch costs a less readable line, never a failed read.

This has been raised with the API as a contract defect. If it is fixed by a shared
`CompileDiagnostic` component, the parse can tighten and this question closes.

## Cross-references

- [Authoring read-tool design spec](../../superpowers/specs/2026-08-19-senti-authoring-read-tools-design.md) — the approved design
- [Implementation plan](../../superpowers/plans/2026-08-19-senti-authoring-read-tools-w34.md) — task-by-task, with code
- [EPIC-2](EPIC-2.md) — the read path this extends, and the source of every invariant above
- [EPIC-3](EPIC-3.md) — the write path; its operation table is stale at 7, and the real figure is 15
- [sprint-2026-W34](../sprint-2026-W34.md) — the window all four stories live in
- [CONTEXT D25](../../CONTEXT.md) — a note records loss, not removal
- [CONTEXT D30](../../CONTEXT.md) — a sprint file carries one scope table
- [CONTEXT D32](../../CONTEXT.md) — `list_drafts` returns no source, and the cut is not optional
- [CONTEXT D33](../../CONTEXT.md) — `draftPath` is extracted from `accountPath`, not copied
