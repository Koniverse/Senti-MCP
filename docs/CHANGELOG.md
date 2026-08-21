# Changelog

All notable changes to **senti-mcp-server** are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Every code-shipping commit bumps [`VERSION`](../VERSION) and adds an entry here in
the **same commit** (RULE-1). Entries carry no commit SHA: a commit cannot contain
its own SHA, and `--amend`-ing one in orphans it (RULE-2). The `## [X.Y.Z]` anchor
plus the git tag are the join keys — `git log --grep '0.1.0'` finds the commit.

---

## [Unreleased]

Nothing pending.

## [2.8.0] — 2026-08-21 — `compile_draft`, and EPIC-8's close

The tool that closes the loop. `compile_draft` runs the static-safety scan and the MQL5
compiler over a draft and every indicator attached to it, and returns the verdict, the
diagnostics and the compiler log ([US-8.4](sprints/stories/US-8.4-compile-draft-and-epic-close.md)).
It is the seventh and last tool of [EPIC-8](sprints/epics/EPIC-8.md), and like the other six it
is registered only when `SENTI_ENABLE_AUTHORING_WRITE` is set.

**A failed build is not an error.** The API returns `200` with `ok: false` and diagnostics; the
tool returns a **success** result carrying them. Marking it `isError` would tell a model its
call malfunctioned, and a model's correct response to that is to retry — against a globally
serial compile slot, for a build that will fail again identically.

**Nothing retries, and the abort message says why that matters here.** The compile slot is one
per account and the compile server is serial across all accounts, so a `409` means someone
else's compile is running and a `503` carries a wait this server reports rather than sleeps on.
The 15-second client timeout is *not* raised — but aborting the fetch **does not cancel the
compile**, so the account's slot stays busy and the next call would be a `409`. The message says
exactly that and sends the model to `get_draft` for `lastCompileStatus`.

**It is the only tool in this repo that parses diagnostics strictly**, because
`POST /drafts/{draftId}/compile` is the only route in the whole document that declares their
shape. `get_draft` and `list_drafts` parse theirs loosely and will keep doing so — see below.

### The write smoke test, and the two things it settled

`npm run test:smoke` with `SENTI_SMOKE_WRITES=1` now creates a real draft, attaches an
indicator, compiles it and deletes it, cleaning up in a `finally`. It exists to discharge two
gaps [EPIC-7](sprints/epics/EPIC-7.md) closed with, **both of which needed a write**:

**1. The `GET`'s diagnostics match the compile response's — and the parse stays loose anyway.**
No live draft had ever carried a non-empty `lastCompileDiagnostics`, so `get_draft`'s
loose-parse/tight-render pair had never met real data. Measured on a deliberately broken draft:
the two arrays are identical, same six keys, same values. The render path is confirmed. The
parse does **not** tighten, because the observation is about the service and the parse is a bet
on the contract — which still declares the array untyped ([CONTEXT D44](CONTEXT.md)).

**2. An attachment existed for the first time.** The smoke account has held zero attachments
since `2.2.0`, so every attachment branch in `list_draft_attachments` was test-covered and none
was live-covered. The write smoke creates one.

**Two undocumented behaviours found on the way**, recorded in [CONTEXT D44](CONTEXT.md): a
draft's `name` derives its `.mq5` filename with non-alphanumerics replaced by underscores — so
`diagnostics[].file` will not string-match the draft name — and the compiler log carries the
compile host's absolute Windows path, `C:\MT5\compile_jobs\<draftId>\…`, CRLF-terminated.

### EPIC-8 closes

Seven of the `Authoring` tag's eight write operations now have a tool. What the close does
**not** claim is in [EPIC-8](sprints/epics/EPIC-8.md) §What this close does not claim:
`register` is unimplemented, and the two delete tools are unusable on a host without MCP
elicitation support.

## [2.7.0] — 2026-08-21 — the three attachment writes

`add_draft_attachment`, `update_draft_attachment` and `delete_draft_attachment` complete the
indicator sub-resource ([US-8.3](sprints/stories/US-8.3-attachment-writes.md)), whose read
half [US-7.4](sprints/stories/US-7.4-list-draft-attachments-tool.md) shipped in `2.4.0`. All
three are registered only when `SENTI_ENABLE_AUTHORING_WRITE` is set.

**Filenames collide case-insensitively, and the message says why.** `MyInd.mq5` and
`myind.mq5` are the same file to this platform, because the compile host writes every
attachment into one flat Windows directory. A `409` from `add_draft_attachment` reports that
rather than a bare "already exists", so a model does not try the same name in another case.

**The filename is immutable, so `update_draft_attachment` does not accept one.** An EA embeds
an indicator by name — `#resource "MyInd.ex5"` — and a rename would orphan every reference and
turn a working draft into a static-safety violation. To rename: delete, re-add, and update the
EA source. Accepting a `filename` the API would ignore is worse than not accepting one, so the
input schema is `draftId`, `attachmentId`, `sourceCode` and nothing else.

**Attaching does not wire up, and deleting does not unwire.** `add_draft_attachment` names the
exact `#resource "<stem>.ex5"` and `iCustom(_Symbol, _Period, "::<stem>.ex5", …)` lines the EA
still needs, derived from the filename you gave it. `delete_draft_attachment` says the opposite
thing: the EA still references a file that is gone, and the next `compile_draft` fails on it
unless `update_draft` removes those lines first. A draft that compiles a file it never
references reads as a success otherwise, and one that references a file it no longer has reads
as a compiler problem.

`delete_draft_attachment` is the second and last tool in [EPIC-8](sprints/epics/EPIC-8.md)
that pauses for a human confirmation, on the same reasoning as `delete_draft`
([CONTEXT D42](CONTEXT.md)).

**A `404` on either attachment-id tool carries a cause the draft `404` does not**: the
attachment may exist and belong to a *different* draft. That is an easy mistake to make with
two ids in one path, and a message that only said "not found" would send the reader to check
the wrong one.

## [2.6.0] — 2026-08-21 — `update_draft` and `delete_draft`

The two draft writes that can destroy work, and the first tool in this server that pauses for
a human ([US-8.2](sprints/stories/US-8.2-update-and-delete-draft.md)). Both are registered
only when `SENTI_ENABLE_AUTHORING_WRITE` is set.

**`update_draft` is a FULL REPLACE, and it is annotated `destructiveHint: true` despite its
name.** The API declares no partial-update verb: `name` and `sourceCode` are both always
written, so a model that sends only the function it changed deletes the rest of the file. The
warning is in the tool's description, where a model reads it *before* choosing the argument,
which is the only place a warning about a destructive argument can still help.

**It reports the bytes it wrote, not the bytes it replaced.** A before/after delta would need
the pre-write size, and the `PUT` response carries only the new draft — a hidden `GET` would
double the latency of every edit and race any concurrent writer. When a previous compile no
longer matches the new source, the text says so and names `compile_draft`.

**`delete_draft` asks first, and a "no" is not an error.** It is one of two tools in
[EPIC-8](sprints/epics/EPIC-8.md) that pause for an explicit human confirmation; the other
five do not. That is a deliberate line, not an oversight: `update_draft` fires on every save
in an edit loop, and a confirmation a user sees fifty times in a session is one they stop
reading — a rubber-stamp laundered into the appearance of consent is worse than no prompt
([CONTEXT D42](CONTEXT.md)). The two deletes are the only operations in this epic that no
other tool in it can undo.

A declined confirmation returns a **success** carrying `{ id: null, deleted: false }` and a
note saying no request was sent. `isError: true` would tell a model something malfunctioned
and invite a retry, and a user saying no is neither.

**Two mechanics worth knowing if you build on the seam.** It identifies the round by an opaque
`requestState` it mints, not by the answer: `acceptedContent()` reports a decline and a first
entry identically — both `undefined` — so branching on the answer alone re-asks on every
decline and spins until the client's round cap. And a forged `requestState` cannot skip the
confirmation, because only *accepted* content reaches the request.

**A host without elicitation support cannot use `delete_draft`.** That is accepted rather than
worked around: a silent fallback to deleting without confirmation would make the guardrail a
function of the client, which is the one property a guardrail must not have. Every other tool
in this release works normally on such a host.

`core/tool.ts` now imports two runtime values from `@modelcontextprotocol/server`
(`inputRequired`, `acceptedContent`), so it joins `src/server.ts` and `src/index.ts` as the
third file that does. `AGENTS.md` said `server.ts` was the only one; corrected.

## [2.5.0] — 2026-08-21 — `create_draft`, and the write path opens

The first tool in this server that changes something. `create_draft` calls
`POST /api/v1/drafts` under a **seventh** scope, `authoring:write`, and is the first of
seven tools [EPIC-8](sprints/epics/EPIC-8.md) opens over the `Authoring` tag's write
operations ([US-8.1](sprints/stories/US-8.1-write-substrate-and-create-draft.md)).

**It is not registered unless you ask for it.** `SENTI_ENABLE_AUTHORING_WRITE=1` (or
`true`) registers the authoring write tools; anything else — including `0`, `false`, `no`
and `off` — leaves them unregistered, and a host that never sets it sees the same fourteen
read tools `2.4.0` shipped. **The flag is authoring-only**: it enables no trading write at
any setting, because closing a position is a different surface with a flag of its own that
does not exist yet ([EPIC-3](sprints/epics/EPIC-3.md)). Keeping them separate is the point —
enabling an agent to edit MQL5 must never be the same act as enabling it to close a
position.

**The response does not echo your source back.** `POST /drafts` returns the complete draft,
up to 192 KiB of source plus five attachments at 64 KiB each — content the model supplied in
the same call. Returning it would bill it a third and fourth time, through `content` and
`structuredContent` both ([CONTEXT D34](CONTEXT.md)). The tool returns the new `id`, the
byte count written, the compile state and an attachment summary, and `notes` points at
`get_draft` for a read-back ([CONTEXT D39](CONTEXT.md)). A note records *loss*, so creating
an empty draft writes none.

**The `Idempotency-Key` is a fresh UUID per call, not one derived from the body.** The
design specified a content-derived key so that an identical repeat would replay the original
`201` instead of colliding with a `409`, and left the retention window as the open question
that would decide it. Measured against `be-dev` on 2026-08-21: **an idempotency record
outlives a delete.** Create → delete → byte-identical create replayed the original response
and returned a `draftId` that no longer existed. Since *create, delete, create again* is what
iterating on a draft looks like — and delete-then-recreate is the API's own prescribed way to
rename an attachment — the derived key was replaced with `randomUUID()`, which still gives the
protection the header is actually for: one request delivered twice by the transport creates
one draft ([CONTEXT D43](CONTEXT.md), revising [D41](CONTEXT.md)).

**Nothing retries anything.** The write path adds `413`, `422`, `502`, `503` and `504`, and
none of them is retried. `Retry-After` is read and quoted in the message, never slept on: a
tool call that waits holds the host's turn open for an interval the server chose. A `503`
*without* `Retry-After` is reported as meaning a retry cannot help, which is what the API
documents ([CONTEXT D40](CONTEXT.md)).

**A `403` no longer assumes it is about a scope.** On every read it was; on `create_draft` it
also means the draft cap is full, and against that cause the old wording — *"the key is
missing that scope, not that the account is off limits"* — sends the reader to mint a key
they already hold. The new `forbiddenMeans` option lets each endpoint say what its `403`
means, and the read tools keep the old wording byte for byte by passing nothing.

**`registerWriteTool` is a second registrar, not a flag.** `registerReadTool` is unchanged
and still pins `readOnlyHint: true` as a constant, so no call to it can produce a write
whatever its arguments ([CONTEXT D38](CONTEXT.md)). A test asserts it directly.

**Also corrected in this release:** three files in this repo stated that
`POST /drafts/{draftId}/register` puts an EA into a real trading account. It does not — it
creates a permanently private `EaDefinition`, and deploying is
`POST /accounts/{accountId}/strategies` under the separate `strategies:write` scope. The
claim had been inferred from the operation's name rather than read from its description
([CONTEXT D36](CONTEXT.md)). `register` is still out of scope, for a different reason: it is
the only write in the tag that creates a resource the tag cannot then delete.

**What this release does not do:** compile, update, delete or attach anything. Those are
`2.6.0` through `2.8.0`. `create_draft` writes a draft and stops; nothing is compiled until
`compile_draft` exists.

## [2.4.0] — 2026-08-20 — `list_draft_attachments`: the fourteenth tool, and EPIC-7's close

`list_draft_attachments` reads `GET /api/v1/drafts/{draftId}/attachments` under
`authoring:read` and returns the indicator source files a draft's EA embeds via
`#resource` — the source [US-7.2](sprints/stories/US-7.2-get-draft-tool.md) deliberately
leaves out of `get_draft`. It is the fourth and last tool over the `Authoring` tag
([US-7.4](sprints/stories/US-7.4-list-draft-attachments-tool.md)), and this release closes
[EPIC-7](sprints/epics/EPIC-7.md): **all 14 of the Senti Quant Public API's `GET`
operations now have a tool.**

**A budget, not a truncation.** At `maxAttachmentsPerDraft: 5` × `maxAttachmentBytes:
65536` the endpoint's ceiling is 320 KiB ≈ 82,000 tokens; counting both `content` and
`structuredContent`, which both reach the model, the tool's own worst case is ≈ 33,000
tokens ([CONTEXT D34](CONTEXT.md)). With `filename` supplied, the tool returns at most one
attachment whole, whatever its size, and cuts nothing else — filenames are not guaranteed
unique within a draft, so if more than one attachment shares the requested name, only the
first is returned and `notes` says how many were skipped, rather than returning every
match and bypassing the budget entirely. The note states how many were *skipped*, one
fewer than the number that share the name. A filtered read also says it is filtered —
`Filtered by filename "X" — 1 of N attachment(s) on this draft` — so a host that surfaces
`content` alone cannot read the filtered count as the draft's whole attachment set.
With `filename` omitted, attachments are returned whole, in the API's own order, while
the running total *including* the one just added stays within 65,536 bytes — the first
attachment is always returned whole regardless of its own size, and once one attachment
is cut, every attachment after it is cut too — and the note says exactly that, rather
than claiming each cut file exceeded the budget: a 1-byte attachment that follows a breach
is cut without exceeding anything, and a model told otherwise will not re-read it.
Checking the total after inclusion rather than before is what caps the response at 64 KiB
instead of admitting 127 KiB. A cut
attachment keeps its metadata and reports `sourceCode: null`; source is never partial —
an empty file is `''` with `sourceBytes: 0`, and the two are never confused. A `filename`
that matches nothing returns an empty result and names, in the text, every filename that
does exist, which is also how to discover what a cut left out.

**The API has no way to request one attachment by id.** `GET
/drafts/{draftId}/attachments/{attachmentId}` does not exist, though `PUT` and `DELETE`
on that exact path do — raised with the API as an asymmetry. The `filename` filter is a
client-side workaround: the set is always fetched whole, so it bounds the model's
context, not the wire.

**Untested live.** The smoke account holds 4 drafts and 0 attachments in all 4 — measured
again this release, unchanged since `2.2.0` and `2.3.0` — so the budget, the cut rule and
the `filename` filter are proven only against synthetic sizes in
`list-draft-attachments.test.ts`. EPIC-7's close states this rather than letting a green
suite imply otherwise; see
[EPIC-7 §What this close does not claim](sprints/epics/EPIC-7.md).

### Added
- **`list_draft_attachments` — a byte-budgeted attachment read**
  (`src/tools/authoring/list-draft-attachments.ts`). `ATTACHMENT_BUDGET_BYTES`,
  `AttachmentsOutputSchema`, `parseAttachments`, `shapeAttachments`, `formatAttachments`.
  Registered after `get_draft` in `src/server.ts`, so the `authoring/` group reads
  conventions → list → read → attachments.

### Notes
- **EPIC-7 closes `done`.** All 14 of the API's `GET` operations have a tool. Its close
  names four branches that never ran against the live service — every attachment code
  path across all three draft tools, this tool's budget and `filename` filter, `get_draft`'s
  `DiagnosticSchema` render path, and `DRAFT_NOT_FOUND`'s 404 — and what would discharge
  each. The open question on whether a `GET`'s `lastCompileDiagnostics` element really
  matches the compile response's diagnostic shape is still open.
- **A second fix wave, C1-C9, corrected what the four authoring tools *say* about their own
  payloads** — seven sentences that were not true of the payload in hand, and the missing
  per-tool coverage in `src/server.test.ts` that let them through. See
  [CONTEXT D35](CONTEXT.md). No version moves: none of `2.1.0`-`2.4.0` has been published.

## [2.3.0] — 2026-08-20 — `list_drafts`: the thirteenth tool, and the largest payload in the API cut four ways

`list_drafts` reads `GET /api/v1/drafts` under `authoring:read` and lists every MQL5 draft
the API key owns, most recently updated first, with each draft's compile status, size,
attachment count and registered-EA id — the tool that answers "what am I working on" or
"which of my drafts are broken". It is the third tool over the `Authoring` tag
([US-7.3](sprints/stories/US-7.3-list-drafts-tool.md)), and its `DraftSummarySchema` is
derived from `2.2.0`'s `DraftSchema` by `.omit()` and `.extend()` rather than hand-written,
so a field the API adds upstream cannot silently bypass the cut.

**The largest payload the API can produce.** The route takes no query parameters at all —
no `?include=`, no `?fields=`, no pagination, no filter — and returns every draft's full
`sourceCode`, every attachment's full `sourceCode`, and every draft's `lastCompileLog`
whole. At the [US-7.1](sprints/stories/US-7.1-authoring-substrate-and-conventions-tool.md)
ceilings that arithmetic is `20 × (192 KiB source + 5 × 64 KiB attachments + 16 KiB log) =
10.3 MiB ≈ 2.7 million tokens`. Measured live on 2026-08-20 against an account holding 4
drafts and 0 attachments: **19,853 B → 1,898 B, 90.4% removed** — matching the design
spec's 2026-08-19 measurement exactly. See [CONTEXT D32](CONTEXT.md).

**Four cuts, one note.** `sourceCode` (→ `sourceBytes`), `attachments[].sourceCode` (→
`sourceBytes`), `lastCompileLog` (and `logTruncated`, which describes a field that is no
longer there), and `lastCompileDiagnostics` (→ `diagnosticsCount`). All four lose
information, so all four are reported — but as one sentence naming the draft and attachment
counts, the bytes removed, and both `get_draft` and `list_draft_attachments` as the way to
read what was cut, rather than four notes a reader would learn to skim past. `notes` stays
empty on an empty collection, so its presence never implies a cut occurred. The byte figure
covers source and log only — diagnostics are reduced to a count, never measured — so it is
stated as "of source and log in total", and a cut that dropped only diagnostics carries no
byte figure at all rather than claiming "0 B".

**No parameter turns the cut off.** The ceiling is two orders of magnitude past
`get_performance_breakdowns`', the API's next-largest payload, so an opt-out here would be a
footgun with a documented safety catch rather than a real escape hatch — `get_draft` already
is one, and it returns one draft rather than twenty.

### Added
- **`list_drafts` — every draft, shaped** (`src/tools/authoring/list-drafts.ts`).
  `DraftSummarySchema`, `DraftsOutputSchema`, `parseDrafts`, `shapeDrafts`, `formatDrafts`.
  Registered between `get_authoring_conventions` and `get_draft` in `src/server.ts`, so the
  file reads conventions → list → read. Text output marks a draft `SUCCESS`-and-up-to-date as
  "ready to register" and renders a `null` `lastCompileStatus` as "never compiled" rather
  than printing `null`.

### Notes
- **The API's `Authoring` `GET` surface is now three of four tooled.**
  `list_draft_attachments` remains, tracked in [EPIC-7](sprints/epics/EPIC-7.md).
- `src/smoke.test.ts` now parses `GET /api/v1/drafts` through `parseDrafts` rather than
  casting it, so the live smoke path exercises the schema instead of bypassing it.

## [2.2.0] — 2026-08-19 — `get_draft`: the twelfth tool, and the schemas the last two `EPIC-7` tools import

`get_draft` reads `GET /api/v1/drafts/{draftId}` under `authoring:read` and returns one MQL5
draft's full source code, its compiler log, its diagnostics, and whether the last compile still
matches the current source — the tool that answers "why did this fail to compile" or "show me
the code". It is the second tool over the `Authoring` tag
([US-7.2](sprints/stories/US-7.2-get-draft-tool.md)), and the module that owns `DraftSchema` and
`AttachmentSchema`: `list_drafts` and `list_draft_attachments` import both from here rather than
redeclaring them, so one shape drifting only breaks in one place.

**One cut.** At the [US-7.1](sprints/stories/US-7.1-authoring-substrate-and-conventions-tool.md)
ceilings, one draft is worth up to 192 KiB of EA source + 5 × 64 KiB of attachment source + 16
KiB of compile log — roughly 135,000 tokens, more than most context windows. Attachment
`sourceCode` is replaced with `sourceBytes`; everything else, including the EA's own source,
returns whole — this is the tool a caller reaches for *because* they want the source, so
truncating it here would leave no tool able to return it.

Read live on 2026-08-19 against the account holding drafts: the key set matched the design
spec's twelve exactly, four drafts existed, none `FAILED` and none carrying an attachment, so
no real `lastCompileDiagnostics` element was available to check against `DiagnosticSchema` — a
shape transcribed from `POST /drafts/{draftId}/compile`, which types that field where the two
`GET` paths do not. The parse stays `z.array(z.unknown())` regardless: `parseOrThrow` is
all-or-nothing, so transcribing the compile response's shape onto an untyped `GET` field would
take both draft tools down the day they diverge. See
[US-7.2 §Implementation notes](sprints/stories/US-7.2-get-draft-tool.md) for the observed key
set.

### Added
- **`get_draft` — one MQL5 draft, full fidelity** (`src/tools/authoring/get-draft.ts`).
  `DraftSchema`, `AttachmentSchema`, `DiagnosticSchema`, `AttachmentSummarySchema`,
  `DraftOutputSchema`, `byteLength`, `parseDraft`, `shapeDraft`, `formatDraft`. Diagnostics
  render opportunistically — `DiagnosticSchema.safeParse` per element, a readable
  `file:line:column` line on a match, the raw element otherwise — so a shape mismatch costs a
  less readable line, never a failed call. An element that carries nothing at all is stated
  as such: the field parses as `z.array(z.unknown())`, so a `null` element is legal, and
  `JSON.stringify` would otherwise print it as a line reading `- null` that a model takes
  for a diagnostic. The text also composes the API's documented
  register-readiness question (`lastCompileStatus === 'SUCCESS' && compiledUpToDate`) as a
  derived sentence rather than a stored field, since both operands are already in the output.
  - **Attachment source is cut, not truncated.** `attachments[].sourceCode` never reaches
    either channel; `sourceBytes` replaces it, and a `notes` entry — repeated in the text —
    names `list_draft_attachments` and the `draftId` that undoes the cut. The note counts
    only attachments that actually carried source: an empty attachment lost nothing, and a
    note about it would send the model to a second tool that returns nothing
    ([CONTEXT D25](CONTEXT.md)). `list_drafts` reaches the same verdict on the same draft.
  - **No parameter reopens the cut, and the EA's own source is never truncated.** Half an
    MQL5 file reads as a complete one to a model that did not write it.

### Notes
- **The API's `Authoring` `GET` surface is now two of four tooled.** `list_drafts` and
  `list_draft_attachments` remain, both importing this release's schemas rather than
  redeclaring them ([EPIC-7](sprints/epics/EPIC-7.md)).

## [2.1.0] — 2026-08-19 — `get_authoring_conventions`: the eleventh tool, and a new tag opens

The Senti Quant Public API grew a new `Authoring` tag, and with it from **17 operations to
29** — 14 of them now `GET`, not 10. `get_authoring_conventions` is the first tool over that
tag: it reads `GET /api/v1/authoring/conventions` under a new `authoring:read` scope and
publishes the platform's own MQL5 authoring contract — the hard-safety constraints, the
trading-safety requirements, the static analyzer's forbidden-construct list, and the five
`limits` ceilings the API enforces on drafts, attachments and registered EAs. Read live on
2026-08-19: `maxDrafts` 20, `maxAttachmentsPerDraft` 5, `maxAttachmentBytes` 65536 (64 KiB),
`maxSourceBytes` 196608 (192 KiB), `maxRegisteredEas` 10. A limit is rendered exactly or
not in KiB at all — a hard cap that is not a whole multiple of 1024 stays in bytes, because
rounding one *up* publishes a ceiling the API then rejects and rounding a sub-KiB one down
publishes "0 KiB". An empty rule category is stated rather than left as a bare header, so a
model cannot mistake "the platform declares none" for "this tool failed to render them".
Those numbers matter beyond this release — they are what size the cuts [EPIC-7](sprints/epics/EPIC-7.md)'s remaining three
tools make against a payload the API can otherwise grow past a context window
([US-7.1](sprints/stories/US-7.1-authoring-substrate-and-conventions-tool.md)).

This release also lands the substrate the rest of `EPIC-7` stands on:
`draftPath`/`DRAFT_NOT_FOUND` in `src/core/client.ts`, extracted from `accountPath` over a
shared private `segmentPath` guard rather than copied
([CONTEXT D33](CONTEXT.md)) — no path-traversal guard now has a second copy to drift out of
sync with the first.

### Added
- **`get_authoring_conventions` — the platform's MQL5 authoring contract, as data**
  (`src/tools/authoring/conventions.ts`). `ConventionsOutputSchema`, `parseConventions`,
  `formatConventions`. No path parameter, no `409` — `client.get` is called with a `scope`
  only, no `notFoundMeans` or `conflictMeans`. The tool description tells the model to call
  this **before generating any MQL5 source**: code that violates these rules is rejected by
  a static scan before it reaches the compiler, and compile slots are globally serial, so
  discovering a rule by failing a compile is expensive and still fails.
  - **Every rule is rendered whole, never summarized.** These are instructions a model must
    follow, not records it might skim — `formatConventions` numbers every constraint and
    requirement and reproduces every `forbiddenConstructs[].pattern` verbatim, escapes
    intact.
  - **The patterns are reported, not evaluated.** `pattern` values are regular expressions
    the API's own static analyzer applies; this tool does not compile or run them, and says
    so — the document types them as bare strings and never names the regex dialect, so
    building a `RegExp` from an undeclared dialect would be a crash or a silent mismatch.
  - **No cuts and no `notes` field.** The whole response is roughly 2 KB and static per
    deploy, so unlike `get_performance_breakdowns` and `get_equity_timeseries` there is
    nothing here to shape.
- **`draftPath` and `DRAFT_NOT_FOUND`** in `src/core/client.ts` — the substrate the other
  three `EPIC-7` tools build their paths on. A private `segmentPath(prefix, segments, hint)`
  now owns `PATH_SEGMENT`, `encodeURIComponent` and the traversal-rejection loop;
  `accountPath` is re-expressed over it with its signature and error message unchanged, and
  `draftPath` is a second prefix over the same guard rather than a second copy of it
  ([CONTEXT D33](CONTEXT.md)).

### Notes
- **The API's operation count is now 29, not 17** — a new `Authoring` tag adds 12 operations,
  four of them `GET`. `get_authoring_conventions` is the first of those four;
  [EPIC-7](sprints/epics/EPIC-7.md) tracks the remaining three (`get_draft`, `list_drafts`,
  `list_draft_attachments`).

## [2.0.1] — 2026-08-14 — the floor gets a gate, and the toolchain catches up

**Nothing that runs has changed.** All **17 `dist/**/*.js` files are byte-identical** to
what `2.0.0` published — verified by checksumming every file in both tarballs, not by
reading the diff. No tool was added, removed or altered; no payload, argument or
`structuredContent` shape moved. A consumer on `2.0.0` gains no behaviour by upgrading.

What this release actually carries is the work of
[EPIC-5](sprints/epics/EPIC-5.md)'s last three stories, none of which cut a version of its
own: a gate that stops the Node floor drifting, a dependency bot, and a compiler decision.
Against the published `2.0.0` tarball exactly four things differ — three `.js.map` files
(source-position attribution, from the new compiler), two reworded sentences in
`README.md`, and the `devDependencies` block of `package.json`, which npm does not install
for consumers.

It is a **patch** because [docs/RELEASE.md](RELEASE.md) §Step 1 measures semver against the
*tool surface* rather than the diff size, and the tool surface is untouched.

### Added
- **`release:check` now guards the Node floor.** It compares `package.json`
  `engines.node` — the canonical value — against every floor claim in `README.md` and
  `docs/SETUP.md`, and fails when they disagree **or when an artifact states no floor at
  all**. The floor was stated in three places and compared by nothing, which is the
  [LESSONS 4](LESSONS.md) shape that let `package-lock.json` sit eight releases behind its
  version string ([US-5.2](sprints/stories/US-5.2-release-check-guards-the-node-floor.md)).

  A floor claim is defined narrowly and the narrowness is the contract: a semver
  immediately preceded by `>=` or `≥`, on a line mentioning Node. The operator is what
  separates the floor from the other Node versions in the same prose — `AbortSignal.any`'s
  `20.3.0` is written "landed in 20.3.0", never ">= 20.3.0", so it is excluded without
  being special-cased. The practical consequence when the floor next moves: prose *about*
  an old floor must not use the operator form — "the old 20.6.0 floor", not "the old
  `>= 20.6.0` floor". Two README sentences were rephrased accordingly; no claim changed
  meaning. CI pins in `.github/workflows/` are deliberately not checked, because they bind
  nobody outside CI and `publish` differs from the floor on purpose
  ([LESSONS 7](LESSONS.md)).

  Ten tests, watched go red before the implementation existed, plus a mutation of the real
  `docs/SETUP.md` — `grep`-confirmed on disk before the red result was believed
  ([LESSONS 1](LESSONS.md)) — proving the gate names the exact file, line and both values.

- **`.github/dependabot.yml`** — weekly npm updates with minor and patch grouped into one
  PR, so currency stops depending on someone remembering to run `npm outdated`
  ([US-5.3](sprints/stories/US-5.3-devdependency-currency-and-dependabot.md)). Two `ignore`
  entries, each carrying the reason it exists **and** the condition under which it should be
  removed: `@types/node` majors (see below) and `typescript` majors (TypeScript 7 is a native
  compiler rewrite and gets its own decision in
  [US-5.4](sprints/stories/US-5.4-decide-typescript-7.md), rather than riding into `main`
  inside a grouped refresh).

  Its header states plainly what a green Dependabot PR does **not** prove: no workflow runs
  on a pull request here — `release.yml` fires on a `v*` tag and nothing else — so those PRs
  arrive with no typecheck, no test run and no tarball verification, and the file lists the
  commands to run locally instead. Enabling the bot without saying so would ship a false
  signal.

### Changed
- **Development toolchain brought current**: `vitest` 3.2.7 → 4.1.10 and `tsx` 4.23.6 →
  4.23.12 (in-range, lockfile only — `package.json`'s `^4.19.0` did not move). The suite is
  **unchanged at 20 files / 439 tests, 1 skipped**, measured against a baseline taken
  immediately before the bump: a count that dropped would have meant a silently-skipped
  suite rather than a clean upgrade. `vitest.config.ts`'s `src/`-anchored `include`
  ([CONTEXT D13](CONTEXT.md)) was re-proven under the major by planting a decoy test under
  `.claude/worktrees/` and confirming it is still not collected — a major version is exactly
  when a default changes underneath you.
- **`@types/node` deliberately stays on the Node floor's major** and is now a written rule
  rather than a pin that looks like neglect ([CONTEXT D28](CONTEXT.md)). Types newer than the
  floor let `tsc` accept calls to APIs the supported runtime does not have: the build stays
  green and the failure lands on the **user**, at run time — the same shape
  [CONTEXT D5](CONTEXT.md) raised the floor to fix. `npm outdated` will keep reporting
  `@types/node` as behind, and that output is now expected.
- **`typescript` 5.9.3 → 7.0.2** — the native compiler port
  ([CONTEXT D29](CONTEXT.md),
  [US-5.4](sprints/stories/US-5.4-decide-typescript-7.md)). `tsc` is this repo's **build**,
  not only its typechecker — `bin` points into `dist/` and `files` publishes it — so the
  emit was compared before the decision rather than after: **all 17 `dist/**/*.js` files are
  byte-identical** to the 5.9.3 build, verified by checksumming every file in both trees.

  Three `.js.map` files differ — `core/client`, `core/errors` and `server`, which are
  exactly the three sources using a parameter default or a parameter property — and only in
  which source positions the generated defaults and field assignments are attributed to. The
  JavaScript at those sites is character-for-character the same. `.js.map` ships, so the
  tarball does change in debug metadata; it stays at 54 entries and nothing that runs is
  affected.

  Typecheck is clean on **both** tsconfigs, and each was mutation-tested to confirm it still
  catches errors — a new compiler exiting 0 proves it ran, not that it checked. The reason
  to move is measured rather than assumed: typecheck `~1428 ms → ~503 ms`, full build
  `~1412 ms → ~393 ms` (**~3.6×**). Without a number like that the decision would have been
  to stay, since a compiler emitting the same JavaScript buys nothing on its own.
- `.github/dependabot.yml` drops the `typescript` majors `ignore` added one story earlier,
  which is what its own comment instructed the deciding commit to do.
- [docs/RELEASE.md](RELEASE.md) §Step 2 and §Step 5 describe the floor as a second set of
  files that must move together, and the `release:check` failure table gains three rows.
  [docs/README.md](README.md)'s pre-commit checklist gains a floor item — a floor change is
  not a version bump, so nothing else in that list would have caught one.

## [2.0.0] — 2026-08-13 — the supported Node floor moves off an end-of-life line

**No tool changed. No payload changed. Nothing a consumer runs behaves differently.**
This release contains one number: `engines.node` moves from `>=20.6.0` to `>=22.11.0`,
and it is a major because narrowing a declared support contract is a breaking change by
convention — not because the diff is large.

Node 20 reached end of life on **2026-04-30**. The floor
[CONTEXT D5](CONTEXT.md) set was still pointing at it, which meant this package
advertised support for a runtime nobody is patching. **22.11.0** is the first LTS
release of the Node 22 "Jod" line and is supported until **2027-04-30**.

The reason is support lifetime, **not** a new API — a floor is raised for a stated
reason, never for tidiness. Re-checked across all of `src/` and `scripts/` on
2026-08-13: the newest runtime APIs in use are still `AbortSignal.timeout` (17.3.0),
`AbortSignal.any` (20.3.0) and `node --env-file` (20.6.0), and no dependency demands
above Node 20. **D5's minimum is unchanged and still true**; this floor sits above it
for a different reason.

**What it costs you, measured rather than asserted.** `engine-strict` defaults to
`false`, so below the floor npm **warns and installs**: on Node 20.19.4 the `2.0.0`
tarball produced `npm warn EBADENGINE`, exit code 0, and the installed binary then
served `tools/list` with all ten tools. Only `engine-strict=true` turns that into
`npm error code EBADENGINE` and refuses. If you are on Node 20 and not ready to move,
**pin `senti-mcp-server@1.4.0`** — it carries the same ten tools and is the last
version declaring the old floor.

### Changed
- **The supported Node floor is now `>=22.11.0`**, up from `>=20.6.0`
  ([CONTEXT D27](CONTEXT.md),
  [US-5.1](sprints/stories/US-5.1-node-floor-and-ci-pins.md)). `package.json`
  `engines.node`, `README.md` §Requirements and [docs/SETUP.md](SETUP.md) §1 carry the
  same number in the same commit — a floor stated in three places and enforced in one is
  the [LESSONS 4](LESSONS.md) shape.
  [US-5.2](sprints/stories/US-5.2-release-check-guards-the-node-floor.md) is the story
  that puts `release:check` behind it.
- **`gate`, `build` and `verify` in `.github/workflows/release.yml` re-pin from 20.6.0
  to 22.11.0**, so the floor stays *proven* rather than asserted: the suite runs on
  exactly it, and the built tarball is installed and its binary spawned on exactly it.
  Both were confirmed green on 22.11.0 before the pins were pushed.
- **`publish` stays on Node 24.19.0 and its `npm install -g npm@11.19.0` step is
  deleted.** 24.19.0 bundles npm 11.17.0, already above OIDC trusted publishing's
  11.5.1, so the requirement is now satisfied by the runtime pin instead of being
  restated in a comment above a step — the exact shape [LESSONS 7](LESSONS.md) warns
  about. Raising the floor to Node 22 does **not** let all four jobs share one pin, as
  was first assumed: the whole Node 22 line bundles npm **10.x** (22.11.0 ships 10.9.0),
  so a Node 22 floor buys either one shared pin *or* the deleted step, never both.
- Every version pinned in `release.yml` was re-checked against the constraint it has to
  satisfy — [LESSONS 7](LESSONS.md)'s cheap `npm view <pkg>@<ver> engines`, applied to
  every pin rather than only the one that broke. The results are recorded in
  [US-5.1](sprints/stories/US-5.1-node-floor-and-ci-pins.md) §Implementation notes.
- `AGENTS.md`'s "Current state" block is brought current: it still read `1.3.0`, **nine**
  tools, and "one read operation remains", three days after `1.4.0` shipped the tenth
  and EPIC-2 closed.

## [1.4.0] — 2026-08-12 — `get_equity_timeseries`: the last read tool, and a curve that keeps its extremes

The tenth tool, and the one that **completes the read path** — every `GET` operation the
Senti Quant Public API exposes now has a tool.
`GET /accounts/{accountId}/performance/timeseries` answers "how has my equity moved" and
"what was my worst drawdown", and it answers with a point per interval: a series that
grows without bound as the window widens. Measured live on 2026-08-12, a 63-day window
returned **499 points**. A year would return several thousand.

So the series is cut to at most **200 points** — and the cut is where this tool could
have gone quietly wrong. Taking every Nth point is the obvious implementation, and on
most windows it drops the trough of the deepest drawdown and the final point, returning
a curve that reads **smoother and shallower than what actually happened**. That is the
same class of error as rendering a null balance as `0`: well-formed, and wrong in the
direction that flatters the account. `downsample` therefore samples evenly and then
repairs the sample, evicting the nearest interior point to make room for the trough, so
that **the first point, the last point and the point of deepest drawdown are exact** —
never approximated by a neighbour. A fixture whose trough sits deliberately between two
strides is what holds that claim ([US-2.13](sprints/stories/US-2.13-get-equity-timeseries-tool.md)
AC-4), and the live smoke walk re-checks it against the real curve rather than the
fixture.

`caveats` and `portfolioCaveats` are returned **in full, in both channels**. They are the
API's own statements about which figures it could not reconstruct — precisely the content
a tool whose job is to summarize must not summarize.

### Added
- **`get_equity_timeseries` — an account's equity curve and drawdown over time**
  (`src/tools/performance/timeseries.ts`). `TimeseriesSchema`, `parseTimeseries`,
  `shapeTimeseries`, `formatTimeseries`, and `downsample`. `from`, `to` and `reporting`
  reach the URL through `client.get`'s `query` using
  [US-2.10](sprints/stories/US-2.10-get-account-performance-tool.md)'s
  `PerformanceInputSchema`, so the date and ISO-4217 rules are inherited rather than
  restated for a third time. `perAccount` is dropped (an account-scoped endpoint
  returning a one-entry per-account map), `portfolio` is downsampled to at most 200
  points pinning the three extremes, and every downsample is recorded in `notes` —
  empty when the series was short enough to return whole.
- A `get_equity_timeseries` leg in `src/smoke.test.ts`, so the live walk now covers all
  ten read tools. It asks for the account's whole history rather than a convenient month
  and re-derives the trough from the raw response, so AC-4 is checked against live data
  and not only against the fixture built to defeat a naive stride.

### Changed
- **EPIC-2's read path is complete**: all ten `GET` operations of the Senti Quant Public
  API now have a tool. The write path stays closed until EPIC-3 opens with its own design
  spec — `registerReadTool`'s hard-coded `readOnlyHint: true` and `server.test.ts`'s four
  table-driven invariants (now ten rows each) are what keep it closed by construction
  rather than by intent.
- `README.md` gains the tenth tool row and now states that `1.4.0` is the first published
  version carrying all ten.
- [EPIC-2](sprints/epics/EPIC-2.md) closes with a **three-row table of branches that
  shipped unexercised against the live service** — the `409` terminal-offline path,
  `performance`'s `live: null` block, and the `null` arms of `priceStopLimit` / `sl` / `tp`
  — rather than closing in silence. `status: done` means every read operation has a tool,
  not that every branch has run against the real API.
- [CONTEXT D26](CONTEXT.md): the deepest drawdown is ranked by **magnitude**, because the
  OpenAPI document declares `drawdownPct` a bare `number` and never states its sign. Under
  either convention a peak is 0 and a trough is the largest magnitude, so the code commits
  to neither — and a test negates the whole fixture to keep it that way.
- [LESSONS 8](LESSONS.md): a fixture that only defeats the *naive* implementation stops
  testing once you write yours. AC-4's trough was nearly placed at index 497, which the
  shipped sampler produces exactly — the test would have passed with the pinning logic
  deleted. It sits at 498, and a mutation run proves it discriminates.

## [1.3.0] — 2026-08-11 — `get_performance_breakdowns`: the largest payload, cut down and traced

The ninth tool, and the first that returns materially less than the API gave it.
`GET /accounts/{accountId}/performance/breakdowns` answers "which symbol is losing me
money" and "what hour do I trade worst" — and measured live on 2026-08-11, it answers
them in **87,063 bytes (~21,766 tokens)** for a 63-day window on an account trading a
single symbol. Both `content` and `structuredContent` enter the model's context, so
returning that whole is a decision to spend a fifth of a context window on a question
the user thought was small. [US-2.12](sprints/stories/US-2.12-get-performance-breakdowns-tool.md)
is the tool and the cuts that make it answerable; the same live read brings it to
**12,187 bytes (~3,047 tokens), 86.0% removed**.

The rule those cuts follow is [CONTEXT D10](CONTEXT.md)'s: **every cut that loses
something leaves a trace.** A model reading a ten-symbol breakdown it believes is
complete will state a confident, wrong conclusion about real money. `notes` says what
went, how much remains and how to ask for the rest — and it is **empty when nothing was
cut**, so its presence never implies a cut occurred.

### Added
- **`get_performance_breakdowns` — an account broken down by day, symbol and hour**
  (`src/tools/performance/breakdowns.ts`). `BreakdownsSchema`, `parseBreakdowns`,
  `shapeBreakdowns`, `formatBreakdowns`. `from`, `to` and `reporting` reach the URL
  through `client.get`'s `query`, using
  [US-2.10](sprints/stories/US-2.10-get-account-performance-tool.md)'s input schema
  object itself rather than a second copy of its date and currency rules.
  - **Five cuts, of which two lose something and two therefore write a note.**
    `perAccount` goes whole — the endpoint is already scoped to one account, and a live
    read confirmed all 32 of its `dailyPnlRows` reproduce `daily.pnl` exactly. `daily`
    loses `cumulativePnl`, `cumulativeVolume` and `cumulativeNotional`; `perSymbol`
    loses `cumPnlRows` and `cumDealsRows`. All five running sums were verified value by
    value against the live response rather than inferred from their names
    ([CONTEXT D25](CONTEXT.md)). `perSymbol` then keeps the **10 symbols with the largest
    absolute net P&L**, and the heatmap collapses to **24 hourly buckets** totalled
    across the window. Only the last two write a note.
  - **The symbol cut removes columns, not rows.** These blocks are keyed by `dateKey`
    with one numeric column per symbol, so dropping symbols must not shorten the window
    the caller asked for. Every `dateKey` survives, and the note says so.
  - **It ranks on absolute *net* P&L, not on churn.** A symbol that wins 5,000 and loses
    5,100 has the largest daily figures on the account and nets −100; it is the 12th
    most interesting symbol, not the 1st. The unit test's fixture is built around
    exactly that pair, so a cut implementing the wrong rule fails rather than passes
    quietly.
  - **`perAccount` is `z.unknown()` rather than transcribed.** `parse.ts` validates
    all-or-nothing so malformed data never reaches the model — but data this tool drops
    never reaches the model whatever shape it arrives in, so validating it would only
    convert an upstream change in a block nobody reads into an outage for the blocks
    everybody does.
  - **The hourly buckets are matched by name and returned in order.** The API sends its
    two series newest-hour-first (`23:00` down to `00:00`); pairing them by index would
    eventually report one hour's P&L against another's deal count.
  - **The text summarizes; the structured channel carries the series.** Both reach the
    model's context, so a text that restates every row would put back the weight the
    cuts removed. The text answers the two questions the tool exists for — best and
    worst day, symbols worst-first, best and worst hour — and repeats every note
    verbatim, because many hosts surface `content` alone.
  - **No `full: true` escape hatch**, and no client-side recomputation of the dropped
    running sums. A model given a way to request the unshaped payload will use it, and
    recomputing a running total in the formatter restores exactly the bytes the cut
    removed. The answer to a symbol you needed is a narrower `from`/`to`, and the note
    says so.

### Changed
- `windowOf` and `DEFAULT_CURRENCY` are now exported from
  `src/tools/performance/summary.ts`. Both are statements about the API's window and
  currency defaults rather than formatting helpers, and two copies could disagree about
  what an omitted `from` means — with only one of them right.
- `src/smoke.test.ts` grows a ninth leg that reads the widest window the smoke account
  can produce and prints the raw-versus-shaped byte and token counts to stderr, so the
  payload budget is re-measured against a live account rather than trusted from a note.

## [1.2.0] — 2026-08-11 — `list_deals`: the first paginated tool, and a refusal to drain

The eighth tool, and the first whose answer does not fit in one response. Positions and
pending orders say what is open right now; nothing said what already closed.
`GET /accounts/{accountId}/deals` does, and it is paginated — which is the axis
[US-2.11](sprints/stories/US-2.11-list-deals-tool.md) exists to open.

The policy for that axis is a refusal. One tool call issues **exactly one** HTTP request,
whatever `nextCursor` holds. A tool that quietly follows cursors until exhaustion turns
one question into an unbounded number of requests against a rate-limited API and spends
the user's context on data nobody asked for. The cursor goes to the model as data; the
model decides whether the next page is worth asking for.

### Added
- **`list_deals` — one page of an account's closed deal history**
  (`src/tools/trading/deals.ts`). `DealSchema`, `parseDeals`, `formatDeals`. Symbol,
  direction, entry kind, volume, price, realized profit, costs, the linked position and
  order, and the placing expert advisor. `limit` (default **50**, maximum 500), `cursor`,
  `entry`, `from` and `to` all reach the URL through `client.get`'s `query`.
  - **No automatic drain, and no `maxPages` parameter that would smuggle one in.** The
    tool is a single `client.get` with no loop, asserted by counting calls to a stubbed
    `fetch` against a page that always answers with a cursor — output inspection would
    only show which page won, not how many were read.
  - **The cursor is quoted in the text, not only in `structuredContent`.** Many clients
    surface `content` alone, and a cursor the model cannot see is a page it cannot ask
    for. The more-available and last-page cases are written to read differently without
    opening the structured channel at all.
  - **`limit` is sent explicitly on every call**, including when the caller omits it. The
    API's own default is 100, stated in no response and free to change; 50 is this
    server's, stated in the tool description and enforced by the input schema.
  - **The `entry` case asymmetry is caught before the request exists.** The query
    parameter takes lowercase `in`/`out`; the response field is uppercase
    `IN`/`OUT`/`INOUT`/`OUT_BY`. A model feeding one back as the other would get a 400
    about a query parameter — the input schema rejects it instead, and the description
    says which case goes where.
  - **A page total is labelled a page total.** The header states realized P&L across the
    rows shown and says outright that it is not the account's, pointing at
    `get_account_performance` for that — the same defect class `list_positions` guards
    against when it totals the full list rather than the surviving slice.
  - **`syncedThrough` is carried through rather than dropped.** This endpoint reads a
    warehouse, not the MT5 terminal, so a deal closed after that instant is not in the
    answer yet. That is the difference between "you have no trades today" and "today has
    not been ingested yet".
  - **No `409` branch**, unlike `list_positions` and `list_pending_orders`. The live
    OpenAPI document declares none here — an offline terminal costs this endpoint
    freshness, not availability. Copying US-2.8's call shape would have added a branch
    the API never takes.

### Notes
- **The `capPositions`/`capOrders` generalization stays deferred, and this closes the
  question rather than moving it.** The
  [W33 retrospective](sprints/sprint-2026-W33.md) parked it here on the condition that
  `list_deals` needed a third truncation helper. It does not: `limit` is a bound the
  caller chose and the input schema enforces, not a server-side cut, so this tool ships
  with no such helper and no `notes` field at all — the one deliberate exception to the
  uniformity `tools/performance/` keeps. Two copies remain two copies. The trigger to
  revisit is now a third tool that truncates a response the caller did not bound; EPIC-3's
  write-path read-backs are the next plausible source.

## [1.1.0] — 2026-08-10 — `get_account_performance`: the first tool with query parameters

The seventh tool, and the one that opens EPIC-2's last axis: query parameters. `from`,
`to` and `reporting` reach the URL through `client.get`'s `query` option, which has
existed since `0.2.0` and which no tool had ever passed — the substrate was built and
untried, the same shape `accountPath` had at [US-2.7](sprints/stories/US-2.7-list-account-strategies-tool.md).
`performance:read` becomes the fifth of five scopes exercised by a shipped tool.

This is also the tag that first carries EPIC-4's release tooling. Those entries sat under
`## [Unreleased]` because none of them reaches the tarball — `files` allowlists `dist` and
non-test `src`, so the two scripts in `scripts/` and the workflow in `.github/` are
outside it (`npm pack --dry-run`: 42 files before this release, **45** after — `summary.ts`
plus its two compiled artifacts in `dist/`). They move here because a tag is what makes
them shipped, and `1.1.0` is that tag — this release runs the tag-triggered workflow for
the first time on a version that is not a rehearsal.

### Added
- **`get_account_performance` — a fixed-size performance summary for one account**
  (`src/tools/performance/summary.ts`, the first file in `src/tools/performance/`).
  `PerformanceSchema`, `parsePerformance`, `formatPerformance`. Net P&L, win rate, profit
  factor, gross profit and loss, deal counts, costs, cash flow, period ROI and IRR,
  lifetime IRR, and the live terminal block. The response does not grow with the requested
  window, so it is returned in full and `notes` is always empty.
  - **The first tool to send query parameters.** `from`, `to` and `reporting` are handed
    to `client.get`'s `query` whole; `queryStringOf` drops the undefined ones, so an
    omitted parameter is absent from the URL rather than sent as `from=undefined` or
    `from=`. No tool-side string building.
  - **`reporting` is an ISO-4217 currency code, not a reporting period** — the name reads
    like a period and the story was written expecting a closed enum of them. The live
    OpenAPI document declares `type: string`, "ISO-4217 currency the money metrics are
    normalized to. Default `USD`". Validated by shape (`/^[A-Z]{3}$/`) rather than against
    a list this server would have invented ([CONTEXT D23](CONTEXT.md)).
  - **An unreachable terminal is stated, never rendered as zeroes.** Unlike `positions`
    and `orders` this endpoint declares no `409`: an offline terminal arrives as
    `live: null` inside a `200`, so the *null is not zero* invariant moves out of a
    status-code branch and into the formatter. A null `live` block reports that the
    terminal could not be reached and says outright that this is not an empty account.
  - **The window is stated in the text**, including when the caller supplied none. The
    response echoes no window back, so a model that asked a vague question would otherwise
    attribute the figures to whatever period it had in mind; an empty window renders as
    "the API's default window — the 30 days ending today".
  - **The API's own caveats are carried through.** `notionalIncomplete`,
    `staleBalanceAccounts` and `unconvertedAccounts` are statements about the figures
    beside them, and are rendered as caveats rather than dropped. They are not `notes`:
    `notes` records what this server cut, and this tool cuts nothing.
- **`npm run release:check` — the gate a release has to pass** (`scripts/release-check.mjs`).
  Eight checks, all reported in one run with the value each observed: the five version
  strings agree (`VERSION`, `package.json`, `package-lock.json`, `src/config.ts`'s
  `SERVER_VERSION`, and the tag about to be pushed — `src/config.test.ts` covers three of
  them on every commit, the lock file was covered by nothing, and the tag cannot exist when
  vitest runs); [CHANGELOG.md](CHANGELOG.md) has a `## [X.Y.Z]`
  section; `## [Unreleased]` no longer carries it; `README.md` — the only prose in the
  42-file tarball — names no contradicting version; the tag is free; the tree is clean; and
  `HEAD` is on `main`. A `--ci` flag skips the two local-only preconditions a tag-triggered
  checkout cannot satisfy, prints that it skipped them, and keeps every artifact check
  ([CONTEXT D16](CONTEXT.md)).
- **`npm run release:verify-pack` — the tarball is proven before it is published**
  (`scripts/release-verify-pack.mjs`). Packs, installs into a clean directory with no access
  to this repo's `node_modules`, spawns the installed binary through its `bin` name, and
  compares `tools/list` against both the build **and the packaged README's tool table** —
  the independent claim, since build and tarball share a source and a deleted tool vanishes
  from both. `src/index.test.ts` covers `dist/index.js`; this covers the packaging step
  between `dist/` and the registry, where [CONTEXT D12](CONTEXT.md)'s dead-`dist/` defect
  lived. Adopted instead of a `next` dist-tag, because it protects the same failure one
  irreversible act earlier ([CONTEXT D20](CONTEXT.md)).
- **`.github/workflows/release.yml` — this repository's first workflow, with its refusal
  path proven on a real runner.** Pushing an
  annotated `vX.Y.Z` tag runs gate → build → verify → publish → announce. The gate fails the
  workflow before anything is built; the build runs with no Senti credential in the
  environment; `npm publish --provenance` authenticates by OIDC trusted publishing with no
  `NPM_TOKEN` stored anywhere; and a GitHub Release carrying that version's CHANGELOG
  section is created only after a successful publish. Every third-party action is pinned to
  a 40-character commit SHA ([CONTEXT D16](CONTEXT.md)). Rehearsed against a deliberately
  bad `v9.9.9`: the gate reached `release:check`, reported all seven disagreements, and
  `build`, `verify`, **`publish`** and `announce` were skipped. The success path is
  discharged by the first real release — `1.1.0` — and six ACs on
  [US-4.5](sprints/stories/US-4.5-release-workflow.md) carry that handoff.
- **[docs/RELEASE.md](RELEASE.md)** — the runbook this repo never had: the four-artifact
  contract, the ordered procedure, the tag-message and tag-sort conventions, what each gate
  failure means, and the 72-hour unpublish window that puts every check ahead of
  `npm publish`. Deliberately **not** `DEPLOY.md`, whose recorded absence is unchanged and
  now carries a pointer here ([CONTEXT D18](CONTEXT.md)).
- **Six annotated git tags backfilled for `0.2.0` → `0.7.0`, and `v0.1.0`'s missing GitHub
  Release created.** `git tag -l` and the `## [X.Y.Z]` headings are now the same nine-element
  set, so *every changelogged version is tagged* has no exception left; Releases go 2 → 3.
  The six get tags only — no Release, and never an npm publish, which stays at `0.1.0` and
  `1.0.1` ([CONTEXT D17](CONTEXT.md)). Pushing six `v*` tags triggered no workflow run:
  Actions reads the workflow from the tagged commit, and all six predate `.github/`.

### Changed
- **[README.md](../README.md)**: a `get_account_performance` row on the tool table, "all
  seven tools" and the `1.1.0` pin in the install section, and the scope list now says all
  five read scopes are exercised by a shipped tool — `performance:read` was the one that
  was not.
- **`src/smoke.test.ts` walks a seventh leg**, and deliberately without the
  terminal-offline `try`/`catch` the positions and orders legs carry: `performance`
  declares no `409`, so a throw there is a real failure rather than a state of the world.
  It requests an explicit `2026-07-01 → 2026-07-31` window, because an omitted one would
  exercise the API's default and prove nothing about the query option this release wires
  up.
- [docs/README.md](README.md): `RELEASE.md` in the tree and cross-references, a release item
  on the pre-commit checklist, a pointer on the `DEPLOY.md` absent-row with its reasoning
  intact, and a §Conventions note retiring the `— vX.Y.Z` CHANGELOG heading suffix — which
  correlated 9/9 with tagged versions and was documented nowhere ([CONTEXT D19](CONTEXT.md)).
  The three headings carrying it are left exactly as shipped.
- [AGENTS.md](../AGENTS.md): `docs/RELEASE.md` in the documentation map, and the "Ship a
  version" quick-reference row no longer ends at `VERSION` + CHANGELOG.
- **[EPIC-4](sprints/epics/EPIC-4.md) closed** — all five stories done, 16 points, in
  `sprint-2026-W33` Phase 2.
- **`sprint-2026-W33` reopened** (`closed` → `active`) to carry EPIC-4 as its **Phase 2**;
  its window had not elapsed. Phase 1's scope table, its "6 stories / 15 points" total and
  its retrospective are left byte-for-byte as written, each scoped to Phase 1. New
  [CONTEXT D21](CONTEXT.md) makes the general rule: a sprint's scope is not frozen at open,
  and only the maintainer opens or closes one.
- The suite is **17 files / 277 tests, 1 skipped** (was 14 / 197): 22 tests drive
  `release:check` as a CLI against throwaway git repositories, 13 cover the pure judgements
  inside `release:verify-pack`, and 45 cover `get_account_performance` — 34 on the domain
  module, 11 through a connected MCP client.

### Fixed
- **The `publish` job could never have published, on any npm version.** It pinned
  `node-version: 20.6.0` — the floor [CONTEXT D5](CONTEXT.md) set for *consumers* — and then
  asked for an npm capable of OIDC trusted publishing. That needs npm ≥ 11.5.1, and every
  npm 11.x declares `engines.node ^20.17.0 || >=22.9.0`; 20.6.0 is below it, so the newest
  installable npm there is 10.x, which cannot do OIDC. No npm version satisfied both
  constraints. The job now runs on **Node 24.19.0**, which serves no consumer and is
  invisible in what ships (`tsc` emits per `tsconfig`, `target: ES2022`, not per host); the
  floor keeps being *proven* where it matters, by `build` running the suite on 20.6.0 and
  `verify` installing the tarball and spawning the binary on it. The `npm install -g` step
  is **pinned to `npm@11.19.0`** rather than `@latest` — this workflow SHA-pins third-party
  actions on the grounds that a mutable reference is a write path into a single-maintainer
  package, and `@latest` was that same reference in different clothes; it rolled to npm 12
  (`engines.node ^22.22.2 || …`) on the first day this step ever ran. Found by the first
  real release, exactly as [EPIC-4](sprints/epics/EPIC-4.md) said the success path would be
  — the `v9.9.9` rehearsal failed at the gate by design, so `publish` had never executed
  once. New [LESSONS 7](LESSONS.md).
- **The release workflow's annotated-tag guard could never pass.** It read
  `git cat-file -t "$GITHUB_REF_NAME"`, which is correct locally and meaningless on a
  runner: `actions/checkout` resolves the tag and then force-writes the commit SHA into
  `refs/tags/<tag>` (`git fetch --no-tags origin +<sha>:refs/tags/<tag>`), so the local ref
  is a commit whatever the remote holds. The guard reported `commit` for a tag
  `git ls-remote` proves is annotated, and it would have blocked `1.1.0` and every release
  after it. Now checked against the remote — a `^{}` peeled ref exists if and only if the
  tag is a real tag object — verified in both directions ([LESSONS 6](LESSONS.md)).
- **`release:check` silently checked the wrong version in the one invocation CI uses.**
  Its argument parser skipped `--root`'s value by comparing against `rootFlag + 1`, which
  is `0` when `indexOf` returns `-1` — so with no `--root` it discarded the *version
  argument* and fell back to reading `VERSION`, comparing it against itself. Every version
  check passed by construction, on a script whose whole job is refusing a release when the
  version strings disagree. The workflow calls it exactly that way
  (`npm run release:check -- "$version" --ci`). All 20 tests missed it because every one
  passes `--root` to reach a fixture — the parameter that made the tests possible was the
  parameter that hid the bug. Two tests now run the gate the way the workflow does
  ([LESSONS 5](LESSONS.md)).
- **`package-lock.json`'s `version` field had read `0.1.0` since the `0.2.0` release**,
  while `package.json` read `1.0.1` — wrong across nine releases, including the
  publish-readiness pass that went looking for stale artifacts ([CONTEXT D12](CONTEXT.md)).
  It is a fifth place the version lives and the only one nothing watched: bumps were done by
  editing `package.json` rather than by `npm version`, which is the command that keeps the
  lock in step. Found by running a command *because* [RELEASE.md](RELEASE.md) documents it.
  The field is corrected, `release:check` now covers it, and [LESSONS 4](LESSONS.md) records
  the shape — a value nothing consumes is the one that stays wrong longest.
- **`npm test` ran the suite twice.** It reported 28 files / 394 tests against a package
  that owns 14 / 197; the surplus was `.claude/worktrees/read-tools-w33/`, a git worktree
  left behind after `feat/read-tools-w33` merged (`66be3a4`) and still checked out at
  `812f7e8`, two releases behind `main`. `.claude/worktrees/` is gitignored so `git
  status` was silent, while vitest's default `include` of `**/*.test.ts` read the tree as
  source. The worktree and its merged branch are removed, and a new `vitest.config.ts`
  scopes collection to `src/**/*.test.ts` so no nested tree can be collected again
  ([CONTEXT D13](CONTEXT.md), [LESSONS 3](LESSONS.md)). `prepublishOnly` had been running
  the doubled suite too.

### Documentation
- **[LESSONS 7](LESSONS.md)** — a CI job pinned to the *consumer* floor could not host the
  tooling it needed, and nothing noticed for a whole epic. Sibling of 6: both are steps that
  are correct on a developer's machine and impossible on a runner, both shipped with the
  defect visible in the file, and both were found only when the branch finally executed.
- **[EPIC-5](sprints/epics/EPIC-5.md) opened** — *Supported runtime and dependency
  currency*, `backlog`. It owns the distinction LESSONS 7 turned on: `engines.node` / README
  / SETUP bind consumers, while `node-version:` in CI binds nobody and exists only to prove
  the first group true. Carries one story,
  [US-5.1](sprints/stories/US-5.1-node-floor-and-ci-pins.md) — re-decide the Node floor now
  that Node 20 reached end of life on 2026-04-30. Deliberately unscheduled: `publish` is
  unblocked as of this release, so nothing there is urgent, and scheduling is the
  maintainer's ([CONTEXT D21](CONTEXT.md)).
- Three further [LESSONS.md](LESSONS.md) entries: **6** — `actions/checkout` rewrites
  `refs/tags/<tag>` to the commit SHA, so local tag inspection in CI is meaningless; **4** — a version string nothing reads drifts
  silently (`package-lock.json` was eight releases behind); **5** — twenty tests and none of
  them ran the invocation CI uses, and a red CI run is not proof the thing you care about
  ran.
- Two [LESSONS.md](LESSONS.md) entries: **2** — a story's Verification-commands row is a
  claim, and `vitest -t` that matches nothing exits 0 (this discharges the
  [W33 retrospective](sprints/sprint-2026-W33.md)'s third followup); **3** — a gitignored
  worktree is invisible to `git status` and fully visible to vitest.
- [EPIC-2](sprints/epics/EPIC-2.md) refreshed to its post-`1.0.1` state: the Feature
  pillars table and Out-of-scope section had frozen at v0.1.0's one-tool cut, and the
  Business context's "roughly thirty lines" estimate now carries the correction the W33
  retrospective asked for. Live-payload findings from the first authenticating smoke run
  are recorded there for W34.
- **Sprint W34 opened, and EPIC-2's four remaining stories written.**
  [sprint-2026-W34](sprints/sprint-2026-W34.md) (2026-08-17 → 2026-08-23, 4 stories / 11
  points) plus [US-2.10](sprints/stories/US-2.10-get-account-performance-tool.md),
  [US-2.11](sprints/stories/US-2.11-list-deals-tool.md),
  [US-2.12](sprints/stories/US-2.12-get-performance-breakdowns-tool.md) and
  [US-2.13](sprints/stories/US-2.13-get-equity-timeseries-tool.md) — the four `GET`
  operations still without a tool, one new axis each: query parameters, cursor
  pagination, payload shaping, downsampling. US-2.13 carries EPIC-2's close.
- New [CONTEXT D14](CONTEXT.md): those four ship `1.1.0` → `1.4.0`, not the expansion
  spec's `0.8.0` → `0.11.0`, which was written before the `1.0.0` cut. The spec is left
  unedited per the D1/D5 precedent. EPIC-2 §Remaining work also records that the
  `capPositions`/`capOrders` generalization the W33 retrospective deferred to US-2.11
  does **not** fire: `list_deals` bounds its payload with a caller-supplied `limit`, not
  a truncation, so it needs no third cap helper.
- **[EPIC-4](sprints/epics/EPIC-4.md) opened — the package release process.** This repo's
  release procedure was undocumented, and the record shows the cost: **nine** versions have
  a `## [X.Y.Z]` section here, **three** have a git tag, **two** have a GitHub Release
  (`v0.1.0` is tagged without one), and **two** are on npm. Four artifact sets that do not
  nest, against a pre-commit checklist that stops at `VERSION` and `CHANGELOG.md` with no
  `git tag`, `gh release` or `npm publish` item in it, and no `.github/` directory at all
  (`total_count: 0` workflow runs, ever). Five stories / 16 points, all `backlog` with no
  sprint: [US-4.1](sprints/stories/US-4.1-release-contract-and-runbook.md) `docs/RELEASE.md`
  and the release contract, [US-4.2](sprints/stories/US-4.2-release-check-gate.md) the
  `release:check` gate, [US-4.3](sprints/stories/US-4.3-backfill-tags-and-releases.md) the
  six missing tags and `v0.1.0`'s Release,
  [US-4.4](sprints/stories/US-4.4-tarball-verification.md) tarball verification before
  publish, and [US-4.5](sprints/stories/US-4.5-release-workflow.md) the tag-triggered
  workflow. Nothing is added to [sprint-2026-W34](sprints/sprint-2026-W34.md), which stays
  at its committed 11 points.
- Six new CONTEXT entries, [D15–D20](CONTEXT.md), one per question the brainstorm settled:
  **D15** every version is tagged, released and published as it lands — W33's batching was
  reasonable while nothing was on the registry and is not now that `latest` is `1.0.1`;
  **D16** releases run from `.github/workflows/release.yml` on a `v*` tag push, gated first,
  publishing by OIDC trusted publishing with `--provenance` and no stored `NPM_TOKEN` —
  possible because `npm test` is 196 passed / 1 skipped with no Senti credential in the
  environment; **D17** backfill six annotated tags for `0.2.0` → `0.7.0` plus `v0.1.0`'s
  missing Release, and never publish the six; **D18** the runbook is `docs/RELEASE.md` and
  `DEPLOY.md` stays absent for its recorded reason; **D19** the `— vX.Y.Z` CHANGELOG heading
  suffix — which correlated 9/9 with tagged versions and was documented nowhere — is retired
  rather than promoted, with no existing heading rewritten; **D20** no `next` dist-tag, with
  the trigger that would bring one in recorded.
- [EPIC-2](sprints/epics/EPIC-2.md) §Out of scope now points its "npm publishing" deferral at
  EPIC-4 instead of leaving it homeless, and [AGENTS.md](../AGENTS.md)'s epic list names all
  four epics (it had omitted EPIC-3).
- **EPIC-2's four remaining stories moved out of W34 and into the running sprint.**
  [sprint-2026-W33](sprints/sprint-2026-W33.md) gains a **Phase 3** carrying
  [US-2.10](sprints/stories/US-2.10-get-account-performance-tool.md) →
  [US-2.13](sprints/stories/US-2.13-get-equity-timeseries-tool.md) — 11 points, the whole
  of [sprint-2026-W34](sprints/sprint-2026-W34.md)'s committed scope — so the sprint is
  now 15 stories / 42 points across three phases, 31 of them delivered. W34 keeps its file
  and its `planned` status with no stories, pointing at where its scope went and how work
  returns to it. New [CONTEXT D22](CONTEXT.md) records why: the dependency those four
  actually had was a release procedure, and Phase 2 built it that same day — what was left
  holding them at `ready` was a calendar date, which is what
  [D21](CONTEXT.md) rule 1 exists to refuse. The bullet above about W34 keeping "its
  committed 11 points" was true when written and is superseded here; W33's Phase 1 and
  Phase 2 records, including that sentence in the sprint file, are left as written.
  Neither sprint's `status:` was flipped — that stays the maintainer's ([D21](CONTEXT.md)
  rule 2).

---

## [1.0.1] — 2026-08-07 — The six tools reach npm — v1.0.1

The npm publish `1.0.0` deferred ([CONTEXT D11](CONTEXT.md)), now taken
([CONTEXT D12](CONTEXT.md)). `latest` moves `0.1.0` → `1.0.1`, so
`npx -y senti-mcp-server` reaches all six read tools instead of the lone
`list_accounts` that `0.1.0` shipped. **No tool or tool behaviour changes** — the
runtime is byte-identical to `1.0.0` in intent; what changes is the tarball and the
prose describing it.

`1.0.0` itself is deliberately left unpublished. Its CHANGELOG entry says the release
is the git tag and the GitHub Release only, and that stays true rather than being
quietly contradicted by a tarball; `1.0.1` is the version that carries the corrected
README into the registry.

### Fixed
- **`npm run build` shipped dead code.** `tsc` does not remove output whose source is
  gone, and `dist/` is gitignored, so `dist/client.js`, `dist/accounts.js` and
  `dist/errors.js` — outputs of `src/client.ts`, `src/accounts.ts` and `src/errors.ts`,
  all deleted in the `0.2.0` restructure (`0ed5e80`, `1e8becd`) — survived in every
  local `dist/` and were listed by `npm pack --dry-run` for the `1.0.0` tarball.
  Nothing imports them and `bin` points at `dist/index.js`, so no runtime path was
  affected; they would simply have been published. `build` is now
  `rm -rf dist && tsc && chmod +x dist/index.js`.
- **`README.md` would have shipped a false claim about itself.** The install section
  stated "**The published package is still v0.1.0** … `list_brokers`, `list_strategies`,
  `list_account_strategies`, `list_positions` and `list_pending_orders` are not
  available through `npx` yet", directing readers to a git checkout. `README.md` is
  inside the tarball and is the npm package page, so publishing without rewriting it
  would have put a package on the registry whose own front page told users it did not
  contain what it contains. The section now names `latest` as the thing to trust, gives
  the `npm view senti-mcp-server dist-tags` check, and shows how to pin a version.
- `docs/README.md`'s absent-file table pinned the registry state to
  `senti-mcp-server@0.1.0` and asserted a `gitHead` match against the `v0.1.0` tag —
  both stale the moment `1.0.1` publishes. The row now states the published-ness
  without pinning a version claim it cannot keep current.

---

## [1.0.0] — 2026-08-07 — The W33 read surface, declared stable — v1.0.0

Promotes the six read tools shipped across `0.2.0`–`0.7.0` to a stable major version.
**No tool is added, removed or renamed relative to `0.7.0`** — `list_accounts`,
`list_brokers`, `list_strategies`, `list_account_strategies`, `list_positions` and
`list_pending_orders` are the same six `src/server.ts` registers, and the code delta is
exactly the three review fixes below. What changes is the commitment: tool names, their
arguments, and their `structuredContent` shapes are now under semver, so breaking any of
them costs a `2.0.0` ([CONTEXT D11](CONTEXT.md)).

**Not published to npm.** `npm view senti-mcp-server dist-tags` still resolves `latest`
to `0.1.0`. This release is the git tag `v1.0.0` and its GitHub Release only — reaching
the six tools still means [a git checkout](../README.md#from-a-git-checkout), exactly as
it did at `0.7.0`.

The five read scopes an API key needs are unchanged: `accounts:read`, `brokers:read`,
`strategies:read`, `trading:read` are each exercised by a shipped tool;
`performance:read` is not yet, and its three tools carry to sprint W34 along with
`list_deals`.

### Changed
- `VERSION`, `package.json` and `src/config.ts`'s `SERVER_VERSION` move `0.7.0` →
  `1.0.0` together, as `src/config.test.ts` requires. The jump is a stability
  declaration, not new functionality — the alternative, `0.7.1`, is what the diff alone
  would have earned ([CONTEXT D11](CONTEXT.md)).

### Fixed
- `list_positions` reported the floating P&L and the position count of the **surviving**
  rows after truncation, presenting a partial figure as the account's total: an account
  holding 250 positions of `+10` rendered `200 open positions · floating P&L 2,000.00`
  against a true float of `2,500.00`, with the only disclosure sitting below 200 position
  blocks. `capPositions` now returns `totals` derived from the full list, and
  `formatPositions` takes them as a required argument, so the header quotes the account's
  own figures and appends `(showing the first 200)` when rows were cut.
  `list_pending_orders` had the same defect in its count and is fixed the same way
  (`capOrders` → `totals`, `formatOrders` third argument).
- A `404` from any endpoint claimed "the account does not exist, is not owned by this API
  key, or has been unlinked" and pointed the reader at `list_accounts` — including from
  `list_brokers`, `list_strategies` and `list_accounts`, which take no `accountId` at all,
  so a mistyped `SENTI_API_BASE_URL` sent the operator to check the one thing that could
  not be the cause. `RequestOptions` gains `notFoundMeans`, matching the existing `scope`
  (403) and `conflictMeans` (409) treatment, and the account wording moves to the exported
  `ACCOUNT_NOT_FOUND` constant that only the three account-scoped tools pass. A bare `404`
  now points at `SENTI_API_BASE_URL` and the path instead.
- `docs/CONTEXT.md` had renumbered the already-published **D7** ("No Active Context block
  in this repo") to D10 and reassigned D7–D9 to the read-tool decisions, breaking RULE-7
  append-only: `CONTEXT D7` as cited by commit `e50faab` and by `CLAUDE.md` resolved to a
  different decision. D7 is restored byte-for-byte in place, the read-tool entries are
  D8–D10 under `## Phase 3 — Read-tool expansion`, and every reference across `AGENTS.md`,
  `CLAUDE.md`, `docs/` and the W33 plan, spec and story is remapped to match.

---

## [0.7.0] — 2026-08-07 — `list_pending_orders`: the last tool of sprint W33

Closes US-2.9 and closes sprint W33. `list_pending_orders` reads `GET
/api/v1/accounts/{accountId}/orders` and returns the pending limit and stop orders
resting on one MT5 account — symbol, order type, volume, trigger price, stop loss, take
profit and stop-limit price — read live from the account's MT5 terminal. It is the
order-side twin of 0.6.0's `list_positions`: filled positions are what `list_positions`
answers, unfilled resting orders are what this tool answers, and the tool's description
points each one at the other.

**The terminal-offline distinction, carried over from `list_positions` unchanged:** a
`200` with an empty `orders` array means the terminal answered and the account
genuinely has nothing pending — a real zero. A `409` means the terminal could not be
reached at all, reported as an error whose text explicitly states it is "NOT the same
as the account having no pending orders" — any resting orders are still resting and may
still trigger. `src/server.test.ts`'s `/offline/i` and `/not the same as/i` assertions
hold that distinction in place the same way they do for `list_positions`.

**One field this tool adds that `list_positions` does not have:** `priceStopLimit`. Unlike
`sl`/`tp` — which apply to every order and render an explicit `—` when `0` — a `0`
`priceStopLimit` means the field does not apply to this order's type at all, so its whole
line is omitted from the rendering rather than shown as a dash.

Like `list_positions`, this tool is account-scoped and routes its path exclusively
through `accountPath` (US-2.4) — no template literal or concatenation touches
`accountId`.

### Added
- `registerListPendingOrders` (`src/tools/trading/orders.ts`) — registered read-only via
  `registerReadTool` under the `trading:read` scope. Takes one required argument,
  `accountId`. Passes a call-site `conflictMeans` string to `client.get` so the `409`
  branch in `core/client.ts` reports the terminal-offline meaning specific to this
  endpoint.
- `src/server.test.ts` — a `list_pending_orders` invariant row in `TOOL_CALLS`
  (`successBody` is the `{ orders: [...] }` envelope, not a bare array), plus its own
  `describe` block: the account-scoped path is called correctly, a `409` is reported as
  an offline terminal distinguished from holding no pending orders, and a `403` names
  the `trading:read` scope.
- `src/smoke.test.ts` now walks the whole W33 read path in one live call:
  `list_accounts` → `list_brokers` → `list_strategies` → (if the key owns an account)
  `list_account_strategies` → `list_positions` → `list_pending_orders`, tolerating a
  `409` on the last two as a real state of the world rather than a broken contract. A
  key with no linked account still exercises every platform-wide endpoint before
  returning early — that is not a failure.

### Changed
- `src/server.ts` now registers six tools — the full W33 tool surface;
  `list_accounts`, `list_brokers`, `list_strategies`, `list_account_strategies` and
  `list_positions` are unchanged.

---

## [0.6.0] — 2026-08-07 — `list_positions`: empty is a real zero, `409` is not

Closes US-2.8. `list_positions` reads `GET /api/v1/accounts/{accountId}/positions` and
returns the positions currently open on one MT5 account — symbol, direction, volume,
open/current price, stop loss, take profit, swap, and floating profit — read live from
the account's MT5 terminal. This is the first tool this sprint where the terminal being
reachable is itself part of the answer: the endpoint's `409` means the terminal is
offline, not that the account holds nothing, and conflating the two would tell a trader
holding open risk that they hold none.

**The terminal-offline distinction, stated plainly because it is easy to misread as a
bug:** a `200` with an empty `positions` array means the terminal answered and the
account genuinely holds no open positions — a real zero. A `409` means the terminal
could not be reached at all, so the API cannot say what is held — this is reported as an
error, with text that explicitly states it is "NOT the same as the account holding no
positions." A model (or a person) reading only the two surface forms — "no positions"
text vs. an error — should never be able to mistake one for the other; that separation
is what `formatPositions`'s empty-list branch and the `409` branch's `conflictMeans`
text each say outright, and what `src/server.test.ts`'s two dedicated assertions
(`/real zero/i` and `/not the same as/i`) hold in place.

Like 0.5.0's `list_account_strategies`, this tool is account-scoped and routes its path
exclusively through `accountPath` (US-2.4) — no template literal or concatenation
touches `accountId`.

### Added
- `registerListPositions` (`src/tools/trading/positions.ts`) — registered read-only via
  `registerReadTool` under the `trading:read` scope. Takes one required argument,
  `accountId`. Passes a call-site `conflictMeans` string to `client.get` so the `409`
  branch in `core/client.ts` reports the terminal-offline meaning specific to this
  endpoint rather than a generic conflict message.
- `src/server.test.ts` — a `list_positions` invariant row in `TOOL_CALLS` (`successBody`
  is the `{ positions: [...] }` envelope, not a bare array, since this endpoint wraps its
  array unlike `list_brokers` and `list_strategies`), plus its own `describe` block: the
  account-scoped path is called correctly, a `409` is reported as an offline terminal and
  is explicitly distinguished from holding no positions, an empty `200` is presented as a
  real zero, and a `403` names the `trading:read` scope.

### Changed
- `src/server.ts` now registers five tools; `list_accounts`, `list_brokers`,
  `list_strategies` and `list_account_strategies` are unchanged.

---

## [0.5.0] — 2026-08-06 — `list_account_strategies`: the first tool with a path parameter

Closes US-2.7. `list_account_strategies` reads `GET /api/v1/accounts/{accountId}/strategies`
and returns the strategies (expert advisors) currently deployed on one MT5 account — a
different question from `list_strategies`'s platform-wide catalog of what could be
deployed. This is the first tool this sprint to take a path parameter, and so the first
to route through `accountPath` (US-2.4, shipped in 0.2.0): every segment is validated
against `/^[A-Za-z0-9_-]{1,64}$/` and `encodeURIComponent`-ed before it is joined into a
URL, and the guard runs *before* `client.get` is entered — a traversal payload such as
`../../admin` is rejected with no HTTP request made at all, not merely rejected by the
server. The description names `list_accounts`' `id` field as the source of `accountId`
and states plainly that `login` (the MT5 account number) is the wrong value; a `404`
repeats that hint via `core/client.ts`'s dedicated branch.

### Added
- `registerListAccountStrategies` (`src/tools/strategies/list-account-strategies.ts`) —
  registered read-only via `registerReadTool` under the `strategies:read` scope. Takes
  one required argument, `accountId`. Builds the request path exclusively through
  `accountPath`; no template literal or concatenation touches the parameter.
- `src/server.test.ts` — a `list_account_strategies` invariant row in `TOOL_CALLS` (the
  first row carrying `arguments`, exercising the key-leak table across all six error
  statuses for a tool that takes a parameter), plus its own `describe` block: the
  account-scoped path is called correctly, a traversal attempt is rejected with the
  stubbed `fetch` asserted **never invoked**, `accountId` is a required input, the
  description names `list_accounts` and `login`, a `404` carries the login/id hint, and
  a `403` names the `strategies:read` scope (this last test is not in the plan's Task
  15 brief; added so AC-6 has an assertion behind it, matching the "names the scope on
  403" test both `list_brokers` and `list_strategies` already carry).

### Changed
- `src/server.ts` now registers four tools; `list_accounts`, `list_brokers` and
  `list_strategies` are unchanged.

---

## [0.4.0] — 2026-08-06 — `list_strategies`: the second tool on the new substrate

Second tool built on the `core/` + `tools/<tag>/` substrate US-2.4 shipped in 0.2.0, and
the second and last no-path-parameter, platform-wide catalog tool this sprint (sibling of
`list_brokers`). `list_strategies` reads `GET /api/v1/strategies` and returns the
platform-wide catalog of strategies (expert advisors) available to deploy — every symbol,
timeframe, rating and preset Senti offers — not the strategies currently running on any
particular account. The description says so explicitly and points at
`list_account_strategies`, US-2.7's tool, for that user-scoped question.

`description`, `supportedSymbols` and `supportedTimeframes` are optional in the upstream
schema — absent from the endpoint's `required` array, not merely nullable — so
`StrategySchema` marks them `.optional()` rather than only `.nullable()`, and a response
omitting any of the three parses cleanly. `avgRating` stays nullable-not-optional and
renders as `—`, never `0`, when a strategy has no reviews yet — the same
null-is-not-zero precedent `list_accounts` set for `lastKnownBalance`.

### Added
- `list_strategies` tool (`src/tools/strategies/list-strategies.ts`) —
  `registerListStrategies`, registered read-only via `registerReadTool` under the
  `strategies:read` scope. Takes no arguments. Points a model at `id` as the
  `eaDefinitionId` when deploying.
- `src/server.test.ts` — a `list_strategies` invariant row in `TOOL_CALLS`, plus its own
  `describe` block asserting the platform-wide description naming
  `list_account_strategies`, and the `strategies:read` scope named on a `403`.

### Changed
- `src/server.ts` now registers three tools; `list_accounts` and `list_brokers` are
  unchanged.

---

## [0.3.0] — 2026-08-06 — `list_brokers`: the first tool on the new substrate

First tool built on the `core/` + `tools/<tag>/` substrate US-2.4 shipped in 0.2.0.
`list_brokers` reads `GET /api/v1/brokers` and returns the platform-wide catalog of
brokers Senti supports — every MT5 server name and account type available to link,
not the accounts this API key already has. The description says so explicitly, since
read plainly "brokers" is easily mistaken for "the brokers I trade with."

### Added
- `list_brokers` tool (`src/tools/brokers/list-brokers.ts`) — `registerListBrokers`,
  registered read-only via `registerReadTool` under the `brokers:read` scope. Takes no
  arguments. Points a model at `accountTypes[].id` as the `brokerAccountTypeId` and a
  `servers[]` value as the `server` the account-linking endpoint takes.
- `src/server.test.ts` — a `list_brokers` invariant row in `TOOL_CALLS`, plus its own
  `describe` block asserting the platform-wide description, the empty input schema, and
  the `brokers:read` scope named on a `403`.

### Changed
- `src/server.ts` now registers two tools; `list_accounts` is unchanged.

---

## [0.2.0] — 2026-08-06 — Read-tool substrate: core/ + tools/, registerReadTool, five scopes

Substrate release — ships no new tool. Restructures `src/` into `core/`
(infrastructure) and `tools/<tag>/` (one folder per API tag), adds the
`registerReadTool`/`parseOrThrow` helpers and the client's `query`/`accountPath`/
`404`/`409` support, and migrates `list_accounts` onto all of it with no behaviour
change. This is the shape the remaining nine read tools land in over the rest of this
sprint and the next.

### Added
- `src/core/` — `client.ts`, `errors.ts`, `tool.ts`, `parse.ts`, each with a
  co-located test file. Infrastructure that never imports from `tools/` (enforced by
  grep, not review).
- `client.get`'s `query` option — drops `undefined` entries, encodes the rest via
  `URLSearchParams`.
- `accountPath` — the only function permitted to build a path carrying `accountId`.
  Validates each segment against `/^[A-Za-z0-9_-]{1,64}$/` before
  `encodeURIComponent`, rejecting `../`, percent-encoded traversal, the empty string,
  and oversized segments.
- Dedicated `404` and `409` branches in `client.get`. `404` names the three likely
  causes (account doesn't exist, isn't owned by this key, or a `login` was passed
  instead of `id`) and points at `list_accounts`. `409` takes a call-site-supplied
  `conflictMeans` string, since what a conflict means is a property of the endpoint,
  not something the client can infer.
- `registerReadTool` (`core/tool.ts`) — registers a tool with `readOnlyHint: true` and
  `openWorldHint: true` set as constants with no parameter path to override them,
  wraps `run` in the `try`/`catch` every tool needs, and returns
  `{ content, structuredContent }` on success or `{ content, isError: true }` on
  failure.
- `parseOrThrow` (`core/parse.ts`) — the `safeParse`-or-throw-naming-the-field pattern
  generalized out of `accounts.ts` so every tool shares one implementation.
- `src/tools/accounts/list-accounts.ts` — `list_accounts`, migrated from
  `src/accounts.ts` onto `registerReadTool` and `parseOrThrow` with no behaviour
  change.
- Table-driven invariant tests in `src/server.test.ts`, written once to cover every
  tool added afterwards: `readOnlyHint`/`openWorldHint` on every registered tool, no
  API key leakage on any of six error statuses or a network failure, and
  `structuredContent` validating against each tool's own `outputSchema` on a
  successful call. Later tool stories add one `TOOL_CALLS` row instead of writing new
  tests.
- `docs/sprints/epics/EPIC-3.md` — placeholder for the write path (`status: backlog`,
  no stories yet): the seven write operations and their guardrails (opt-in
  environment variable, `Idempotency-Key` on the two operations that accept it,
  elicitation before execution, the partial-close-is-not-retry-safe warning, and the
  best-effort-batch contract for the two `*-all` operations).

### Changed
- Repo layout: `src/` splits into `core/` and `tools/<tag>/` — `accounts/` today,
  `brokers/`, `strategies/`, `performance/`, and `trading/` as their tools land
  ([CONTEXT D8](CONTEXT.md)). Reverses the flat-layout rule v0.1.0 shipped with.
- `list_accounts` now registers through `registerReadTool` ([CONTEXT D9](CONTEXT.md)).
- The API key now needs five read scopes, not one: `accounts:read`, `brokers:read`,
  `strategies:read`, `performance:read`, `trading:read` — documented in
  `docs/SETUP.md`, `.env.example`, and `README.md`. There is no key-introspection
  endpoint, so a missing scope is not caught at startup; it surfaces as a `403`
  naming the scope the first time the affected tool is called, and every other tool
  keeps working. Only `accounts:read` is exercised by a shipped tool today.

### Fixed
- `AGENTS.md` and `docs/sprints/epics/EPIC-2.md` corrected: the Senti Quant Public
  API is 10 `GET` + 7 `POST` (17 operations), not "eight of 17 are POST." With
  `list_accounts` shipped, **nine** read operations remain, not sixteen.

---

## [0.1.0] — 2026-08-05 — First release: authenticated Senti client and list_accounts — v0.1.0

First release. Adopted the `koni-docs` documentation framework, then built an
authenticated Senti Quant API client and shipped its first tool, `list_accounts`, over
MCP stdio — proven with one live call against the development API.

### Added
- `koni-docs` documentation framework: the skill vendored at `.agents/skills/koni-docs`
  with `.claude/skills/koni-docs` symlinked to it, and `skills-lock.json` recording
  source and content hash.
- `@koniverse/koni-docs@^0.12.0` as a devDependency, exposed as `npm run agile:status`
  and `npm run agile:validate`.
- `VERSION`, `docs/README.md`, `docs/CHANGELOG.md`, `docs/CONTEXT.md`.
- Sprint corpus: EPIC-1, EPIC-2, `sprint-2026-W32`, and four stories.
- `AGENTS.md` as the canonical project guide; `CLAUDE.md` with the koni-docs
  integration and Active Context blocks.
- `src/config.ts` — `loadConfig(env)` producing a frozen `Config`; fails fast with
  actionable text when `SENTI_API_KEY` is absent.
- `src/errors.ts` — `ApiError` carrying HTTP status and envelope code; `describeError`
  flattening the `cause` chain.
- `src/client.ts` — `createClient(config, deps)` owning the `Authorization` header, a
  15s timeout combined with the caller's `AbortSignal`, and status-to-message mapping.
- `src/accounts.ts` — Zod schema for the 16-field account object, `parseAccounts`, and
  a compact text rendering where null balances show as `—`.
- `src/server.ts` — the `list_accounts` tool, registered read-only, returning both a
  text summary and `{ accounts: [...] }` as `structuredContent`.
- `src/index.ts` — stdio bootstrap serving both the 2025 and 2026 protocol eras via
  `serveStdio`.
- `src/smoke.test.ts` — one opt-in live call against the development API, skipped when
  no key is present.
- `README.md` — tools, configuration, install, client config, and the read-only
  posture.
- MIT `LICENSE`.
- `docs/SETUP.md` and `.env.example` — local setup, troubleshooting, and all three
  environment variables with placeholders (RULE-11).
- `tsconfig.test.json` — typecheck-only config with no exclude, so `npm run typecheck`
  covers the test files the build config deliberately keeps out of `dist/`.
- `src/index.test.ts` — spawns the built `dist/index.js` and asserts both startup
  legs, including that nothing reaches stdout.

### Changed
- **Node floor raised to 20.6.0.** `AbortSignal.any()` needs 20.3.0 and
  `test:smoke`'s `node --env-file` needs 20.6.0; on 20.0–20.2 the server started and
  then failed on every tool call ([CONTEXT D5](CONTEXT.md)).
- `SENTI_API_BASE_URL` must now be an absolute `https:` or `http:` URL. A scheme this
  client cannot fetch, or a base carrying a query string or fragment, is rejected at
  startup with the offending value named ([CONTEXT D6](CONTEXT.md)).
- A soft-deleted account is marked as such in the text summary and counted separately
  in the header, instead of reading exactly like a live one; the terminal's status is
  reported alongside it.
- The 401 message now says the key must belong to the environment
  `SENTI_API_BASE_URL` targets, rather than only pointing back at `SENTI_API_KEY`.

### Fixed
- API error messages no longer double their sentence terminator
  (`…Insufficient scope.. The API key is missing…`).
- A rejected `close()` on SIGINT/SIGTERM is reported to stderr instead of floating as
  an unhandled rejection, which under Node's defaults turned a clean shutdown into a
  crash.
- Out-of-band stdio transport errors are reported to stderr instead of being silent.
- The environment-mismatch warning in `README.md`, `docs/SETUP.md` and `.env.example`
  named three environments (production, staging, development) and resolved none of
  them, so its own logic predicted a `401` for the documented happy path. It now states
  the pairing that has actually been verified — a key issued from the staging dashboard
  works against `https://be-dev.sentitrade.xyz`, the pairing `npm run test:smoke` has
  exercised twice — and leaves the production pairing explicitly unconfirmed.

---
