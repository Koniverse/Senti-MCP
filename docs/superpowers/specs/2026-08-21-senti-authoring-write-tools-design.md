# senti-mcp-server — authoring write-tool design

**Date:** 2026-08-21
**Status:** approved, ready for implementation planning
**Supersedes nothing.** The [v1 design spec](2026-08-05-senti-mcp-server-design.md), the
[read-tool expansion spec](2026-08-05-senti-read-tools-expansion-design.md) and the
[authoring read-tool spec](2026-08-19-senti-authoring-read-tools-design.md) stay as
written; this repo amends rather than edits one ([CONTEXT D1](../../CONTEXT.md),
[D5](../../CONTEXT.md)). Where they disagree, this document is current for the authoring
write path and silent on everything else.

**It does amend two factual claims** made by the third of those documents and by
[EPIC-7](../../sprints/epics/EPIC-7.md) — see §Two claims this repo makes that are wrong.

## Problem

`2.4.0` registers fourteen tools, and [EPIC-7](../../sprints/epics/EPIC-7.md) closed
`done` on the basis that **all 14 of the API's `GET` operations now have a tool**. That is
still true. It is also the whole of what an agent can do.

An agent can now read the platform's authoring contract, list a user's drafts, read one
draft's source, read the compiler output that explains why it failed, and read the
indicator sources it embeds. Then it stops. It cannot write a line of what it just
learned how to write.

The intended use is a developer working in their IDE, talking to their agent, iterating on
an MQL5 Expert Advisor. That loop is **write, build, read the errors, write again**. This
server supplies exactly one of those four steps. The other three currently require the
user to leave the IDE, open the web Studio, and paste.

## What the API actually exposes

Read from the live document at `https://api.sentitrade.xyz/api/v1/openapi.json` on
**2026-08-21**. Unchanged from the 2026-08-19 reading: **29 operations = 14 `GET` + 15
write**, of which the `Authoring` tag holds 12 — the four reads EPIC-7 shipped, and eight
writes.

### Authoring write path — 8 operations, all under `authoring:write`

| Operation | Success | Declares | `Idempotency-Key` |
|---|---|---|---|
| `POST /api/v1/drafts` | `201` full draft | 400 403 409 413 429 | supported |
| `PUT /api/v1/drafts/{draftId}` | `200` full draft | 400 403 404 409 413 429 | **not accepted** |
| `DELETE /api/v1/drafts/{draftId}` | `200` `{ id }` | 403 404 429 | **not accepted** |
| `POST /api/v1/drafts/{draftId}/attachments` | `201` attachment | 400 403 404 409 413 422 429 | supported |
| `PUT …/attachments/{attachmentId}` | `200` attachment | 400 403 404 413 422 429 | **not accepted** |
| `DELETE …/attachments/{attachmentId}` | `200` `{ id }` | 403 404 429 | **not accepted** |
| `POST /api/v1/drafts/{draftId}/compile` | `200` compile result | 403 404 409 422 429 502 503 504 | **not accepted** |
| `POST /api/v1/drafts/{draftId}/register` | `201` `{ eaDefinitionId }` | 400 403 404 409 422 429 502 503 504 | **required** |

Every one also declares `401`. Seven of the eight declare `404`; `POST /drafts` does not,
because it takes no path parameter.

**Three of these are not ordinary writes**, and the difference decides the scope below:

- **`PUT /drafts/{draftId}` is a FULL REPLACE.** The document says so in its summary:
  *"both `name` and `sourceCode` are always written, so send the complete draft. There is
  no partial-update verb on this API."* An `update` that silently truncates on a partial
  body is the single most likely way this tool surface destroys a user's work.
- **`POST …/compile` consumes a globally serial slot.** One compile per account at a time
  (`409`), and the compile server itself is serial across all accounts — under contention
  it answers `503` with `Retry-After`. A retry policy that is harmless on a read is a
  denial-of-service here.
- **`POST …/register` requires `Idempotency-Key`.** A request without the header is
  rejected `400`. It creates a strategy, a preset and a stored binary; a retry without
  deduplication would create a duplicate strategy and orphan a binary.

### Two claims this repo makes that are wrong

Both are about `register`, and both are recorded here because a wrong claim left in place
gets inherited by the next document that cites it.

**Claim 1 — "`register` puts an EA into a real trading account."** Stated in
[EPIC-7 §Out of scope](../../sprints/epics/EPIC-7.md), in
[EPIC-7 §A note for whoever opens the write path](../../sprints/epics/EPIC-7.md), and in
the [authoring read spec §Authoring write path](2026-08-19-senti-authoring-read-tools-design.md).
The API's own description says the opposite, in a section headed *"The loop stops here,
deliberately"*:

> This endpoint does **not** deploy the EA to a trading account. Deploying is
> `POST /api/v1/accounts/{accountId}/strategies`, which requires the separate
> `strategies:write` scope — so putting an AI-authored EA in front of real money remains a
> human decision. A key holding only `authoring:*` can author and register, and nothing
> else.

`register` creates a permanently **private** `EaDefinition`. It touches no trading
account, and a key scoped `authoring:write` cannot reach one. The risk EPIC-7 assigned to
it belongs to `POST /accounts/{accountId}/strategies`, which is [EPIC-3](../../sprints/epics/EPIC-3.md)'s.

**This does not put `register` in scope** — see §Scope for the reason it is still deferred,
which is a different reason than the one on record.

**Claim 2 — EPIC-3's operation table lists 7 write operations.** There are 15. EPIC-7
recorded the staleness without fixing it, deliberately, since EPIC-3 was `backlog` and
would re-read the document anyway. This design does fix it: US-8.1 corrects the table and
the `register` claim in the same commit that opens EPIC-8, because leaving a known-false
sentence in two files is worse than the churn of correcting it.

## Scope of this design

**In:** seven tools — the six CRUD writes over drafts and their attachments, plus
`compile_draft` — the substrate they need (`send`, `registerWriteTool`, the opt-in switch,
the confirmation seam), the payload cuts their responses force, and the documentation
those changes oblige.

**Out: `register`.** Not for the reason on record. It is deferred because it is the only
operation in this tag that **creates a resource outside the tag** — an `EaDefinition` that
appears in `GET /api/v1/strategies`, counts against a separate `maxRegisteredEas` ceiling
(the API's `403` names 10), and cannot be deleted through any operation in the
`Authoring` tag. Every other write in this design is reversible with another write in
this design. `register` is not, and a tool whose only undo lives in a surface this server
does not expose deserves its own story and its own decision about that asymmetry.

**Also out:** the seven trading writes. They are [EPIC-3](../../sprints/epics/EPIC-3.md)'s,
their risk model is real money, and nothing here loosens the switch that gates them.

**Also out:** automatic retry, of anything, anywhere. See §Retry policy.

## Decisions taken

**1. A new epic, not EPIC-3.** **EPIC-8 — Authoring write path over MCP** owns this work.
EPIC-3's cross-cutting invariants are written against operations that move money — a
partial position close that is not retry-safe, best-effort batches that close every open
position. Folding text-file edits under them would either force those guardrails onto
`update_draft`, or dilute them for `positions/close-all`, and it would leave EPIC-3's
`done` condition meaning two unrelated things. EPIC-3 stays `backlog`, its table corrected.

**2. `registerWriteTool` is a second function, not a flag on `registerReadTool`.**
[core/tool.ts](../../../src/core/tool.ts) documents its constant annotations as *"a
mechanical barrier against a write tool reaching this server"*. A `readOnly?: boolean`
parameter converts that barrier into a value a future caller can get wrong. Two functions,
each with its annotations fixed, keeps the property: **no call to `registerReadTool` can
ever register a write**, and the diff that would change this is a change to `core/`, not a
change to a tool file.

**3. A write response does not echo the source it was just sent.** `POST /drafts` and
`PUT /drafts/{draftId}` return the complete draft, up to 192 KiB of `sourceCode` plus five
attachments at 64 KiB each. The model supplied that source in the same call. Returning it
in both `content` and `structuredContent` bills it a third and fourth time
([CONTEXT D34](../../CONTEXT.md)). The cut is not optional, for the reason
[CONTEXT D32](../../CONTEXT.md) already gave for `list_drafts`: an opt-out here is a
footgun with a documented safety catch.

**4. Confirmation is on the two deletes only.** EPIC-3's invariant reads *"every write tool
pauses for an explicit human confirmation before the underlying `POST` fires"*. Applied
literally to this tag it fires on every iteration of an edit-compile loop, and a
confirmation a user sees fifty times in a session is a confirmation they stop reading —
the guardrail becomes worse than none, because it launders a rubber-stamp into the
appearance of consent. `delete_draft` and `delete_draft_attachment` are the two operations
no other tool in this design can undo. They confirm. The other five carry accurate
annotations and rely on the host's own tool-approval surface, which every IDE MCP client
already has.

**5. The opt-in is `SENTI_ENABLE_AUTHORING_WRITE`, and it is authoring-only.** EPIC-3 will
add `SENTI_ENABLE_TRADING_WRITE` for its own surface. Two flags rather than one, so that
enabling an agent to edit code can never be the same act as enabling it to close a
position. A host that sets neither sees the same fourteen tools it sees today.

**6. `update_draft` reports the bytes it wrote, not the bytes it replaced.** Rendering a
before/after delta would need the pre-write size, which the `PUT` response does not carry
— only a second `GET` would supply it, and a hidden read doubles the latency of every edit
and races against any concurrent writer. The tool renders the new size and the words
*full replace*, and its description carries the warning where a model reads it **before**
choosing the argument, which is the only place a warning about a destructive argument can
still help.

**7. `compile_draft` parses its diagnostics strictly.** `POST /drafts/{draftId}/compile` is
the one place in the whole document where the diagnostic shape is typed
([contract review F2](../../../senti-api-contract-audit.md)). `get_draft` and `list_drafts`
must parse `lastCompileDiagnostics` loosely because their `GET` paths declare it as an
untyped object; this tool has no such excuse and takes none. It is also, incidentally, the
observation that settles [read spec Open Question 1](2026-08-19-senti-authoring-read-tools-design.md)
— whether the two shapes match — which that spec could not settle because settling it
required calling a write.

## Tool surface

| Tool | Operation | Scope | Shaped | `destructiveHint` | `idempotentHint` | Confirms |
|---|---|---|---|---|---|---|
| `create_draft` | `POST /api/v1/drafts` | `authoring:write` | **yes** | `false` | `false` | no |
| `update_draft` | `PUT /api/v1/drafts/{draftId}` | `authoring:write` | **yes** | **`true`** | `true` | no |
| `delete_draft` | `DELETE /api/v1/drafts/{draftId}` | `authoring:write` | no | `true` | `true` | **yes** |
| `add_draft_attachment` | `POST …/attachments` | `authoring:write` | **yes** | `false` | `false` | no |
| `update_draft_attachment` | `PUT …/attachments/{attachmentId}` | `authoring:write` | **yes** | `true` | `true` | no |
| `delete_draft_attachment` | `DELETE …/attachments/{attachmentId}` | `authoring:write` | no | `true` | `true` | **yes** |
| `compile_draft` | `POST …/compile` | `authoring:write` | no | `false` | `true` | no |

`update_draft` is annotated `destructiveHint: true` despite its name. A full replace with a
partial body destroys the rest of the file, and the annotation is the only signal a host
gets before it decides how loudly to ask.

`compile_draft` is annotated `destructiveHint: false` and `idempotentHint: true` — it
mutates `lastCompile*` on the draft and nothing else, and compiling the same source twice
yields the same result. Neither annotation is a licence to call it freely; §Retry policy
covers the reason, which is contention, not correctness.

### Input schemas

| Tool | Input |
|---|---|
| `create_draft` | `{ name: string, sourceCode: string }` |
| `update_draft` | `{ draftId: string, name: string, sourceCode: string }` |
| `delete_draft` | `{ draftId: string }` |
| `add_draft_attachment` | `{ draftId: string, filename: string, sourceCode: string }` |
| `update_draft_attachment` | `{ draftId: string, attachmentId: string, sourceCode: string }` |
| `delete_draft_attachment` | `{ draftId: string, attachmentId: string }` |
| `compile_draft` | `{ draftId: string }` |

`name` and `sourceCode` are **both required** on `update_draft`, mirroring the API rather
than softening it. Making `name` optional and re-sending the current value would require
the hidden read decision 6 rejects, and making it optional and omitting it would send
`undefined` into a required field.

No tool takes an `idempotencyKey`. See §Idempotency. No tool takes a credential — the
standing [EPIC-2](../../sprints/epics/EPIC-2.md) invariant that the API key never enters an
`inputSchema` is unchanged, and `authoring:write` is a property of the key.

`update_draft_attachment` takes no `filename`. The API forbids the rename: *"an EA embeds
an indicator by name (`#resource "MyInd.ex5"`), so a rename would orphan every reference in
the EA and turn a working draft into a static-safety violation. To rename, DELETE and
re-add."* Accepting a `filename` the API would ignore is worse than not accepting one.

## Repo structure

```
src/tools/authoring/
  write-result.ts            ← DraftWriteOutputSchema, AttachmentWriteOutputSchema,
                               shapeDraftWrite, formatDraftWrite, formatDeleted.
                               Imports DraftSchema / AttachmentSchema from get-draft.ts
  write-result.test.ts
  create-draft.ts            ← create_draft
  create-draft.test.ts
  update-draft.ts            ← update_draft
  update-draft.test.ts
  delete-draft.ts            ← delete_draft. First user of the confirmation seam
  delete-draft.test.ts
  add-draft-attachment.ts
  add-draft-attachment.test.ts
  update-draft-attachment.ts
  update-draft-attachment.test.ts
  delete-draft-attachment.ts
  delete-draft-attachment.test.ts
  compile-draft.ts           ← compile_draft. Owns CompileResultSchema, the only
                               strictly-typed diagnostics in the repo
  compile-draft.test.ts
```

One file per endpoint, per the existing convention. `write-result.ts` holds what the five
body-carrying writes share; it declares no schema of its own beyond the *shaped* output
types, and imports `DraftSchema` and `AttachmentSchema` from
[get-draft.ts](../../../src/tools/authoring/get-draft.ts) — the arrangement EPIC-7 handed
forward explicitly: *"every authoring write reads back a draft, and none of them should
transcribe that schema a second time."*

`tsconfig.json` globs `src/**/*.ts` recursively; no build change.

## Substrate

### `core/client.ts` — a second verb

`SentiClient` gains one method beside `get`:

```
send(method: 'POST' | 'PUT' | 'DELETE', path: string, options?: WriteOptions): Promise<unknown>

WriteOptions = RequestOptions & {
  body?: unknown            ← JSON-serialised; sets content-type. Omitted for DELETE
                              and for POST …/compile, which declares no request body
  idempotencyKey?: string   ← sent as the Idempotency-Key header when present
}
```

`get` and `send` share the authorization header, the `user-agent`, the 15 s timeout, the
read-body-once-then-parse sequence, and `failureOf`. What `send` adds is the method, the
body, the two conditional headers, and the status branches below.

`RequestOptions` gains one field, used by both:

```
forbiddenMeans?: string   ← what a 403 means for THIS endpoint, quoted verbatim
```

**This is a correction to an existing message, not only an addition.** Today `failureOf`
hard-codes *"The API key is missing `<scope>` — **not** that the account is off limits."*
That was true of every read. On the write path, `403` also means **a cap is full**: 20
drafts, or 5 attachments on this draft. Against that cause the current advice sends the
reader to mint a key they already hold, while the actual fix is to delete something. The
read tools keep today's wording by passing nothing; the write tools pass their own.

**Two things `send` deliberately does not do.** It does not retry (§Retry policy), and it
does not treat a missing body as success: both deletes declare `200` with a JSON `{ id }`,
so the existing *"returned HTTP N with a body that is not JSON"* guard stays. If the API
ever answers `204`, that guard fires — loudly, naming the status, which is the right
failure for a contract change this server should not paper over.

### `core/tool.ts` — `registerWriteTool`

```
WriteToolSpec<Args, Structured> = ReadToolSpec<Args, Structured> & {
  destructive: boolean
  idempotent: boolean
  confirm?: (args: Args) => { message: string }
}
```

`registerReadTool` is **unchanged**, `readOnlyHint: true` still a constant. The new
function fixes `readOnlyHint: false` and `openWorldHint: true`, and takes the other two
annotations from the spec. The `try`/`catch` and the error shaping are lifted into a shared
private helper so the two registrars cannot drift.

The `confirm` seam uses the SDK's multi-round-trip flow —
`@modelcontextprotocol/server@2.0.0` exposes `inputRequired.elicit()` and
`acceptedContent()`, and documents this exact pattern as *"write-once tool requesting
confirmation"*:

```
1. tool called          → acceptedContent(ctx.mcpReq.inputResponses, 'confirm') is undefined
                        → return inputRequired({ inputRequests: { confirm: elicit(...) } })
2. host asks the human
3. tool re-entered      → acceptedContent(...) is { confirm: true }  → the request fires
                        → anything else (declined, cancelled, false) → no request fires,
                          and the tool returns a plain text refusal, not an error
```

A declined confirmation is **not** an error result. `isError: true` tells a model something
went wrong and invites a retry; a user saying no is neither.

**A host that does not support elicitation cannot use the two delete tools.** That is
accepted rather than worked around: a silent fallback to deleting without confirmation
would make the guardrail a function of the client, which is exactly the property a
guardrail must not have.

### `config.ts` — the opt-in

```
SENTI_ENABLE_AUTHORING_WRITE   ← "1" or "true" (case-insensitive) enables. Anything
                                 else, including unset, disables. No other value is
                                 truthy: "0", "false" and "no" must not be surprises
```

`Config` gains `authoringWrite: boolean`. [server.ts](../../../src/server.ts) registers the
seven tools only when it is set, and writes one line to **stderr** at startup stating
whether the write path is on — never stdout, which carries the JSON-RPC frames.

`SENTI_API_KEY` gains a seventh scope requirement, `authoring:write`. There is still no
key-introspection endpoint, so a key without it is not caught at startup: it surfaces as a
`403` naming the scope on the first write call.

### `core/parse.ts`

Unchanged. New `subject` strings: `created draft`, `updated draft`, `deleted draft`,
`created attachment`, `updated attachment`, `deleted attachment`, `compile result`.

## Payload policy

### Draft writes — one cut, one note

`create_draft` and `update_draft` parse the response with the full-fidelity `DraftSchema`,
then shape:

```
DraftWriteOutputSchema = {
  id, name, createdAt, updatedAt,
  sourceBytes,                       ← replaces sourceCode
  lastCompileStatus, compiledUpToDate, eaDefinitionId,
  attachments: [{ id, filename, sourceBytes, createdAt }],
  notes: string[]
}
```

Rendered:

```
Draft "Gold Scalper" created (draftId abc-123).
  source: 4,812 bytes written
  compile: never compiled
  attachments: none

Notes:
- Source was not returned: you just sent it. Call get_draft with draftId
  "abc-123" to read back what the server now holds.
```

`update_draft` renders `4,812 bytes written (full replace — this is now the entire draft)`
and, when a compile predates the write, the line
`compile: SUCCESS · source changed since that compile — recompile before registering`.

The note follows [CONTEXT D25](../../CONTEXT.md): it reports loss, not activity. The source
cut always loses something, so the note is always present on a draft write. The attachment
cut loses something only when an attachment has a non-empty body, so it earns a second
sentence only then — the same rule
[get-draft.ts](../../../src/tools/authoring/get-draft.ts) already applies.

### Attachment writes — one cut, one note

`add_draft_attachment` and `update_draft_attachment` parse `AttachmentSchema` and return
`{ id, filename, sourceBytes, createdAt, notes }`. Same reasoning, smaller numbers.

`add_draft_attachment` adds one line of standing guidance to its **text**, because it is
the moment the information is actionable and the API states it in the endpoint's own
description: the EA references the file as `#resource "<stem>.ex5"` and
`iCustom(_Symbol, _Period, "::<stem>.ex5", …)`. An agent that attaches an indicator and does
not wire it up has produced a draft that compiles to nothing.

### Deletes — `{ id }`, and what the id means

Both deletes return `{ id }` and nothing else, so there is nothing to cut and no note. The
text names what was removed, and `delete_draft_attachment` carries the API's own warning:
*"Remember to remove its `#resource` / `iCustom` references from the EA source too, or the
next compile will fail."* A model that deletes an attachment and immediately compiles will
otherwise read the resulting failure as a compiler problem.

`delete_draft`'s text states the thing the API states and a user will assume otherwise: an
EA already registered from this draft is **not** affected — it is a separate resource.

### `compile_draft` — no cuts

```
CompileResultSchema = {
  ok: boolean, errors: number, warnings: number,
  diagnostics: [{ severity: 'error'|'warning', file, line, column, code, message }],
  log: string, logTruncated: boolean
}
```

Returned whole. The log is capped by the API at 16 KiB and the diagnostics are the point of
the call; cutting either would leave the tool answering the question it exists to answer
with "I removed the answer". This is the same refusal `get_authoring_conventions` makes.

The diagnostics are parsed with the schema above — **strictly**, unlike the two `GET`
tools. Decision 7 covers why.

## `ok: false` is not an error

The single most important sentence in `compile_draft`'s implementation:

> Compiler errors and static-safety violations return **`200`** with `ok: false` plus
> `diagnostics`. Non-2xx statuses mean *the request* failed, not the build. Do not treat a
> red build as an outage.

The tool returns a **success** result with `isError` unset when `ok` is `false`. An
`isError: true` on a failed build tells the model its tool call malfunctioned, and the
model's correct response to that is to retry the call — against a globally serial slot,
for a build that will fail again identically. The text leads with the verdict:

```
Compile FAILED — 1 error, 0 warnings.

Diagnostics (1):
- error at GoldScalper.mq5:42:7 — undeclared identifier 'atrHandle'

Compiler log:
…
```

## Retry policy

**There is none, and the absence is the design.**

- No status is retried automatically, including `429`, `502`, `503` and `504`.
- `Retry-After` is **read and reported**, never slept on. A tool call that sleeps holds the
  host's turn open for an interval the server chose.
- **A `503` with no `Retry-After` means retrying cannot help.** The document says so:
  *"Absent when retrying cannot help (e.g. a misconfigured compile host)."* The message
  distinguishes the two cases rather than flattening them into "try again later".

**The 15 s timeout is shared with the read path and is not raised for `compile_draft`.** A
typical compile is about one second, and contention surfaces as `503` rather than as a hang.
What matters is the message when the timeout does fire, because a client-side abort **does
not cancel the server-side compile**: the account's slot stays busy and the next call
returns `409`. The abort message says exactly that, and sends the model to `get_draft` to
read `lastCompileStatus` rather than to call `compile_draft` again.

## Idempotency

`Idempotency-Key` is accepted by two of the seven operations: `POST /drafts` and
`POST …/attachments`. Both create a resource a duplicated request would duplicate.

**The key is minted by the server and derived from the request** — the first 32 hex
characters of `sha256(method + "\n" + path + "\n" + JSON.stringify(body))`, via
`node:crypto` — and never appears in an `inputSchema`. A model-supplied key is a value
that lives in the model's context, and a model that reuses one across two genuinely
different creates gets the first one's response replayed for the
second.

A random key per call would satisfy the header and buy nothing: with no automatic retry,
the only duplicate this server can emit is a *model* calling the tool twice, and two calls
with two random keys are two creates. A request-derived key makes the identical repeat
replay the original `201` instead of colliding with `409` — which is what the header is
for.

**Open risk, carried rather than resolved:** the API does not document how long an
idempotency record is retained. Under a long retention, `create_draft` → `delete_draft` →
`create_draft` with byte-identical arguments could replay the first response and hand back a
`draftId` that no longer exists. It is detectable — the next `get_draft` returns `404` — and
it is the narrow case. §Open questions carries it, and US-8.1's contract task measures it.

## Error mapping

| Status | Passed by | This tag's specifics |
|---|---|---|
| `400` | `core/client.ts` default | `INVALID_BODY`; the envelope message carries the field |
| `401` | unchanged | — |
| `403` | **`forbiddenMeans`, new** | Two causes, and the tool says which are possible: the key lacks `authoring:write`, **or** a cap is full — 20 drafts on `create_draft`, 5 attachments on `add_draft_attachment`. On the cap, retrying never succeeds; delete one |
| `404` | `notFoundMeans` | `DRAFT_NOT_FOUND` for draft-scoped tools; new `ATTACHMENT_NOT_FOUND` for the two attachment-id tools — *"does not exist, is not owned by this API key, or belongs to a different draft"*, that last clause being a distinct and easily-hit cause |
| `409` | `conflictMeans`, three wordings | `create_draft` / `update_draft`: a draft of that name already exists. `add_draft_attachment`: this draft already has an indicator with that filename **case-insensitively** — `MyInd.mq5` collides with `myind.mq5`, because the compile host writes them into one flat Windows directory. `compile_draft`: a compile or register is already running for this account; the two endpoints share one slot |
| `413` | **new branch** | The body exceeds the gateway's 1 MB limit. Distinct from `422`: this is the transport refusing, before any cap is consulted |
| `422` | **new branch** | On attachment writes: the filename is not a bare `.mq5` basename, or the source exceeds 64 KiB. On `compile_draft`: the compile server rejected the request |
| `429` | unchanged | Already reads `X-RateLimit-*` |
| `502` | **new branch** | The compile server is unreachable. `compile_draft` only |
| `503` | **new branch** | Busy or offline. Reports `Retry-After`, or states that its absence means retrying will not help |
| `504` | **new branch** | The compile request timed out **server-side**. Distinct from this server's own 15 s abort, and the two messages must not be confusable |

## Testing

Per-tool, following the shape US-2.4 established: schema tests against captured fixtures,
shaping tests asserting each cut removes what it claims and that the note is present exactly
when something was lost, traversal rows in `TOOL_CALLS`, and the standing assertion that no
error branch's text contains the API key.

Five tests exist to hold invariants rather than behaviour:

1. **`registerReadTool` still hard-codes `readOnlyHint: true`** — asserted directly, so
   decision 2's barrier fails a test rather than a review if it is ever parameterised.
2. **The opt-in gates registration** — with `SENTI_ENABLE_AUTHORING_WRITE` unset,
   `tools/list` returns exactly the fourteen read tools, asserted by name. With it set, 21.
3. **Every write tool's annotations match the §Tool surface table** — table-driven, so a new
   write tool cannot be added without appearing in it.
4. **The confirmation round-trip, for both deletes** — first call returns
   `inputRequired` and **fires no request** (asserted on the fetch stub, not merely on the
   result); re-entry with an accepted response fires exactly one; re-entry with a declined,
   cancelled or `false` response fires none and returns a non-error refusal.
5. **`compile_draft` with `ok: false` returns a success result** — `isError` unset,
   diagnostics present.

**A write smoke test**, opt-in and separate from the existing read smoke:
`create_draft` → `add_draft_attachment` → `compile_draft` → `delete_draft`, cleaning up in a
`finally` so a mid-way failure does not leave a draft against the user's cap of 20.

It is worth more than its coverage. EPIC-7 closed with two gaps it could not discharge,
both stated in the [read spec's open questions](2026-08-19-senti-authoring-read-tools-design.md):
no draft in a `FAILED` state has ever been observed, so the diagnostic render path is
untested against reality; and the smoke account holds **zero** attachments, so every
attachment branch in `list_draft_attachments` is test-covered and none is live-covered. Both
required a write. Both are discharged by this suite, without anyone opening the web Studio.

Expect the suite to move from 20 files / 429 tests to roughly 30 files.
`vitest.config.ts` stays scoped to `src/**/*.test.ts` ([CONTEXT D13](../../CONTEXT.md)); do
not widen it.

## Story plan

Four stories, each shipping its own minor — the cadence EPIC-7 used for four tools.

| US | Title | Points | Ships | Why this order |
|---|---|---|---|---|
| US-8.1 | Write substrate, the opt-in, and `create_draft` | 5 | `2.5.0` | Everything else needs `send`, `registerWriteTool`, `forbiddenMeans` and the flag. `create_draft` is the write with no `404` and no confirmation — the smallest one that proves the substrate |
| US-8.2 | `update_draft`, `delete_draft`, and the confirmation seam | 3 | `2.6.0` | `delete_draft` is the first tool that confirms, so the elicitation round-trip lands here. Pairs with `update_draft` because both are full-fidelity draft writes sharing `write-result.ts` |
| US-8.3 | The three attachment writes | 3 | `2.7.0` | Needs US-8.2's confirmation seam for `delete_draft_attachment` and US-8.1's shaping for the other two. Introduces `ATTACHMENT_NOT_FOUND` and the `422` branch |
| US-8.4 | `compile_draft`, the write smoke test, and EPIC-8's close | 3 | `2.8.0` | Last because it is the only tool with `502`/`503`/`504`, the only strict diagnostics parse, and the only one whose smoke test needs the other six to exist |

**Total: 14 points.** Each story opens with a `TASK-8.x.1` that checks its contract against
the live service before any code is written — the task that caught the `reporting`
misreading, the `syncedThrough` field, and (in this document) both false claims about
`register`. US-8.1's instance also measures the idempotency retention window §Idempotency
leaves open.

**Sprint placement is not decided here.** [sprint-2026-W34](../../sprints/sprint-2026-W34.md)
is active through 2026-08-23; four stories in the remaining window is tight, and opening or
closing a sprint is not this document's call. The default is four rows appended to W34's
single scope table with a clause added to its `goal` ([CONTEXT D30](../../CONTEXT.md)) — never
a new phase section — and whichever rows do not fit move at the author's direction.

## Documentation obligations

Every code-shipping commit updates docs in the **same** commit (RULE-1). Beyond each story's
CHANGELOG entry and `VERSION` bump:

| Artifact | Change | Story |
|---|---|---|
| `docs/sprints/epics/EPIC-8.md` | New. Goal, the seven operations, the guardrails, why `register` is out, story index | US-8.1 |
| `docs/sprints/epics/EPIC-3.md` | Operation table 7 → 15; the `register` claim corrected; a line stating EPIC-8 owns the authoring writes and EPIC-3 keeps the trading ones | US-8.1 |
| `docs/sprints/epics/EPIC-7.md` | The `register` claim corrected in both places it appears | US-8.1 |
| `docs/CONTEXT.md` | Seven entries — the decisions above that outlive this spec; decisions 5 and 6 are implementation detail and stay here rather than in the log. **D36** `register` does not deploy to a trading account. **D37** authoring writes open EPIC-8, not EPIC-3. **D38** `registerWriteTool` is a second function, not a flag. **D39** a write response does not echo the source it was sent. **D40** the write path has no retry; `Retry-After` is reported, not slept on. **D41** `Idempotency-Key` is server-minted and request-derived. **D42** confirmation is on the two deletes only | US-8.1 (D36–D41), US-8.2 (D42) |
| `AGENTS.md` | **§The read/write split rewritten.** It currently reads *"Do not register a write tool, and do not add one 'ready to enable'."* That becomes a narrower boundary — no **trading** write tool, and no authoring write tool outside the opt-in — not a deletion. Plus 14 → 21 tools, the `authoring:write` scope, `tools/authoring/`'s new files, and the `core/` substrate note | US-8.1, then per story |
| `docs/SETUP.md` + `.env.example` | `SENTI_ENABLE_AUTHORING_WRITE`, same commit (RULE-11); and the `authoring:write` scope in the existing scope paragraph | US-8.1 |
| `README.md` | Tool table gains seven rows; a section on enabling the write path and what it does and does not permit | per story |
| `docs/LESSONS.md` | If the idempotency-retention measurement surprises | US-8.1, conditional |
| `docs/sprints/STATUS.md` | `npm run agile:status` — generated, never hand-edited (RULE-5) | per story |

`scripts/release-check.mjs` needs no change: the version still lives in the same five
places.

## Open questions

Carried deliberately rather than guessed at:

1. **How long an idempotency record is retained.** Undocumented. Decides whether the
   create → delete → identical-create sequence in §Idempotency can replay a dead `draftId`.
   US-8.1's contract task measures it directly. If retention turns out to be long enough to
   matter, the fallback is a random key per call — which forfeits the dedup this design
   wants, and that trade should be made against a measurement rather than in advance.
2. **Whether `403` distinguishes its two causes in the envelope.** The `code` enum offers
   only `FORBIDDEN` for both a missing scope and a full cap, so the distinction, if any,
   lives in the free-text `message`. The `forbiddenMeans` wording names both causes because
   the server cannot currently tell them apart. If the message proves to distinguish them
   reliably, a tighter message is available later; branching on free text before observing
   it is not.
3. **Whether an elicitation-less host is common enough to matter.** The two delete tools are
   unusable without `elicitation/create` support. The design accepts that rather than
   degrade. The trigger to revisit is a real user blocked on a real host — at which point
   the answer is a second opt-in flag that trades the confirmation away explicitly, never a
   silent fallback.
4. **Whether `compile_draft` should poll.** It does not. The API's compile is synchronous,
   so there is nothing to poll in the normal case; the abnormal case is this server's own
   15 s abort, where the compile continues without a client. `get_draft` reads
   `lastCompileStatus`, at a cost of up to 528 KiB per poll — which is
   [contract review F10](../../../senti-api-contract-audit.md), an API problem this server
   should not paper over with a polling loop that hides the cost.

## EPIC-3 / trading-write boundary

This design registers no trading write tool and adds no code path that one could reach.
`SENTI_ENABLE_AUTHORING_WRITE` gates the authoring surface alone; EPIC-3's operations remain
unreachable at any setting of it, and will need their own flag.

What this design hands forward, when EPIC-3 does open: `send`, `registerWriteTool`, the
confirmation seam, `forbiddenMeans`, the request-derived idempotency key, and the rule that
`Retry-After` is reported rather than obeyed. What it explicitly does **not** hand forward is
decision 4 — confirmation on deletes only. That calculus is about text files. EPIC-3's
invariant that *every* write confirms stands untouched, and
`POST …/positions/{ticket}/close` is still not retry-safe under any policy in this document.

## Cross-references

- [EPIC-7](../../sprints/epics/EPIC-7.md) — the authoring read path this completes, and the
  source of `draftPath`, `DRAFT_NOT_FOUND`, `DraftSchema` and `AttachmentSchema`
- [EPIC-3](../../sprints/epics/EPIC-3.md) — the trading write path; its table is corrected by
  US-8.1 and its scope is otherwise untouched
- [authoring read-tool spec](2026-08-19-senti-authoring-read-tools-design.md) — the payload
  precedents this follows, and the two open questions the write smoke test discharges
- [senti-api-contract-audit.md](../../../senti-api-contract-audit.md) — F2 (the typed
  diagnostic) and F10 (polling), both load-bearing above
- [CONTEXT D25](../../CONTEXT.md) — a note records loss, not removal
- [CONTEXT D30](../../CONTEXT.md) — a sprint file carries one scope table
- [CONTEXT D32](../../CONTEXT.md) — a cut that the ceiling forces is not optional
- [CONTEXT D34](../../CONTEXT.md) — a payload is billed through `content` **and**
  `structuredContent`
- [AGENTS.md §The read/write split](../../../AGENTS.md) — the standing rule US-8.1 rewrites
