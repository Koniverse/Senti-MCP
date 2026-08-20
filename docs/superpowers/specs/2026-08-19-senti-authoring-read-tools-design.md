# senti-mcp-server — authoring read-tool design

**Date:** 2026-08-19
**Status:** approved, ready for implementation planning
**Supersedes nothing.** The [v1 design spec](2026-08-05-senti-mcp-server-design.md) and the
[read-tool expansion spec](2026-08-05-senti-read-tools-expansion-design.md) stay as
written; both are snapshots of intent, and this repo amends rather than edits one
([CONTEXT D1](../../CONTEXT.md), [D5](../../CONTEXT.md)). Where the three disagree, this
document is current for the authoring read path and silent on everything else.

## Problem

`2.0.1` registers ten tools — the API's ten `GET` operations as the API stood on
2026-08-12, and [EPIC-2](../../sprints/epics/EPIC-2.md) closed `done` on that basis.

**The API has since grown.** A new `Authoring` tag adds **12 operations**, taking the
document from 17 to 29. Four of them are `GET`, and none is reachable from this server.
An agent can read a user's accounts, positions and performance, but cannot see the MQL5
drafts that user is authoring, cannot read the compiler output that explains why one
failed, and — most consequentially — cannot read the platform's own authoring rules
before generating source that the L1 static scan will reject.

That last one is not a convenience. The endpoint's own description says so:

> **Read this before generating any source.** Code that violates these rules is rejected
> by the L1 static scan before it ever reaches the compiler, so discovering them by trial
> and error costs a round-trip on a globally serial compile slot and still fails.

An agent with no way to read the contract discovers it by failing against a serialized
resource. Exposing `conventions` is the cheapest tool in this design and the one with the
largest effect on what the agent produces.

## What the API actually exposes

Read from the live document at `https://api.sentitrade.xyz/api/v1/openapi.json` and
measured against `https://be-dev.sentitrade.xyz` on **2026-08-19**.

**29 operations = 14 `GET` + 15 write.** The prior figure of "17 operations = 10 `GET` +
7 `POST`", repeated in [AGENTS.md](../../../AGENTS.md), [EPIC-2](../../sprints/epics/EPIC-2.md)
and both earlier specs, is now stale. US-7.1 corrects AGENTS.md and README in its own
commit; the two earlier specs are left alone, per the D1/D5 precedent.

### Authoring read path — 4 operations, all under `authoring:read`

| Operation | Path parameter | Notes |
|---|---|---|
| `GET /api/v1/authoring/conventions` | — | Static per deploy. The **only** `/api/v1/*` endpoint served `Cache-Control: public, max-age=3600` rather than `no-store` |
| `GET /api/v1/drafts` | — | Every draft the key owns, most-recently-updated first, **each carrying full source** |
| `GET /api/v1/drafts/{draftId}` | `draftId` | One draft, with its attachments' full source |
| `GET /api/v1/drafts/{draftId}/attachments` | `draftId` | The draft's indicator sources, filename-ordered |

All four declare `401`, `403` and `429`; the two `{draftId}` paths add `404`. **None
declares a `409`**, so no authoring read passes `conflictMeans`.

### Authoring write path — 8 operations, out of scope here

`POST /drafts`, `PUT /drafts/{draftId}`, `DELETE /drafts/{draftId}`,
`POST /drafts/{draftId}/attachments`, `PUT /drafts/{draftId}/attachments/{attachmentId}`,
`DELETE /drafts/{draftId}/attachments/{attachmentId}`, `POST /drafts/{draftId}/compile`,
`POST /drafts/{draftId}/register`.

Recorded here only because a later epic needs the list, and because two details must
survive into it:

- **`register` puts an EA into a real trading account.** It is not a bigger version of
  saving a draft. It belongs behind the same opt-in switch and human confirmation that
  [EPIC-3](../../sprints/epics/EPIC-3.md) specifies for `positions/close-all`.
- **`compile` consumes a globally serial slot.** A retry policy that is harmless on a read
  is a denial-of-service on that endpoint.

**[EPIC-3](../../sprints/epics/EPIC-3.md)'s operation table is now stale** — it lists 7
write operations and there are 15. This design does not edit it; EPIC-7 records the
staleness so whoever opens the write path finds it stated rather than discovers it.

## Scope of this design

**In:** four read tools, the `draftPath` substrate they need, the payload cuts the
measured limits force, and the documentation those changes oblige.

**Out:** all 8 authoring writes. No write tool is registered, and none is written "ready
to enable" — the standing rule from [AGENTS.md](../../../AGENTS.md) §The read/write split,
unchanged by the API growing a new tag.

**Also out:** response caching, including for `conventions`. It is the one endpoint whose
`Cache-Control` invites it, and caching is still a mechanism this server does not have
([v1 spec](2026-08-05-senti-mcp-server-design.md) §Out of scope). Adding one for a single
endpoint would be the first cache in the process, with no eviction policy, no test for
staleness, and no other consumer. Recorded as a decision, not an omission — see §Open
questions for the trigger that would revisit it.

## Measured limits, and why they decide the design

`GET /api/v1/authoring/conventions` publishes the platform's own ceilings. Read live on
2026-08-19:

| Limit | Value |
|---|---|
| `maxDrafts` | 20 |
| `maxAttachmentsPerDraft` | 5 |
| `maxAttachmentBytes` | 65,536 (64 KiB) |
| `maxSourceBytes` | 196,608 (192 KiB) |
| `maxRegisteredEas` | 10 |

These are not estimates and they are not this server's assumptions. They are the API's
declared maxima, which makes the worst case for each endpoint arithmetic rather than
guesswork:

| Endpoint | Worst-case body | ≈ tokens |
|---|---|---|
| `GET /drafts` | 20 × (192 KiB + 5 × 64 KiB + 16 KiB log) = **10.3 MiB** | ~2,700,000 |
| `GET /drafts/{draftId}` | 192 + 320 + 16 KiB = **528 KiB** | ~135,000 |
| `GET /drafts/{draftId}/attachments` | 5 × 64 KiB = **320 KiB** | ~82,000 |
| `GET /authoring/conventions` | 2,350 B measured | ~590 |

**Every draft-bearing endpoint in this tag can exceed a context window on its own.** That
is the fact this design is organised around, and it is why `get_draft` is shaped rather
than returned whole — an earlier draft of this design proposed returning it unshaped and
the measurement above is what overturned that.

### What the live account actually holds

Measured the same day, so the cuts are sized against a real response as well as against
the ceiling:

```
GET /drafts → 200, 19,853 bytes (~4,963 tokens), 4 drafts
  File1   src   580 B  att 0  status null     upToDate false  log     0 B  diag 0
  thanh   src 13,782 B att 0  status SUCCESS  upToDate true   log 2,425 B  diag 0
  EA1     src   580 B  att 0  status null     upToDate false  log     0 B  diag 0
  123123  src   580 B  att 0  status null     upToDate false  log     0 B  diag 0

shaped estimate: 1,898 bytes (~475 tokens) — 90.4% removed
```

The draft object carries exactly the 12 keys the OpenAPI document declares — no extra
field, none missing. `eaDefinitionId` is a UUID (`c2dfc055-…`), which passes
`core/client.ts`'s existing `PATH_SEGMENT` guard unchanged.

**Two things this account cannot settle**, stated here rather than left for a later reader
to infer from a green suite:

- **The shape of a diagnostic object.** All four drafts have `lastCompileDiagnostics: []`,
  including the one that compiled `SUCCESS`. On the two `GET` paths the document declares
  the array as `object` with `additionalProperties: {}` — untyped.

  **But the same document types it fully elsewhere.** `POST /drafts/{draftId}/compile`
  declares its `diagnostics` items as
  `{ severity: 'error'|'warning', file, line: int, column: int, code, message }`, all six
  required. The `GET` description says `lastCompileDiagnostics` *is* the machine-readable
  form of that same compile — so the shape is knowable from the document even though the
  `GET` refuses to state it. §Payload policy uses that, carefully; §Open questions carries
  what it does not settle.
- **The attachment branch.** Zero attachments exist on this key, so `attachments[]` is
  empty in 4/4 drafts and every attachment code path is covered by test only.

## Decisions taken

**1. A new epic, not a reopening.** EPIC-2 is `done` with its scope stated as "the API's
10 `GET` operations, complete". Reopening a closed epic to absorb a tag that did not exist
when it closed would make its `done` mean less. **EPIC-7 — Authoring read path over MCP**
owns this work.

**2. `list_drafts` drops source; `get_draft` is the escape hatch.** The cuts are in
§Payload policy. The rule from [CONTEXT D25](../../CONTEXT.md) governs the notes: a note
records information *loss*, not removal. Every cut below loses something, so every cut
below writes a note — unlike `get_performance_breakdowns`, where three of five cuts were
free.

**3. `get_draft` returns the EA's source and drops its attachments' source.** This is the
change the measurement forced. It also draws the tool boundary where a reader would want
it: `get_draft` answers "what does this EA say", `list_draft_attachments` answers "what do
its indicators say". The fourth tool stops being a redundant view of the third.

**4. `list_draft_attachments` takes an optional `filename`.** The API has no way to request
one attachment — `GET /drafts/{draftId}/attachments/{attachmentId}` does not exist, though
`PUT` and `DELETE` on that exact path do. The tool fetches the set and filters, so the
*model's* context is bounded even though the *HTTP response* is not. With `filename`
omitted it returns whole sources up to a byte budget and notes the rest.

**5. `conventions` is returned whole.** 2,350 bytes measured, and every part of it is
instruction the agent is meant to follow. Shaping the rules an agent must obey to save
590 tokens would be the worst trade in this document.

**6. No derived `readyToRegister` field.** The API's own description spells out the
composition — `lastCompileStatus === 'SUCCESS' && compiledUpToDate`. Both operands are in
the structured output, so a derived boolean would restate data already present, which is
the reason `get_performance_breakdowns` dropped its running sums. It is rendered in the
**text** instead, where a model reading `content` alone would otherwise have to compose it
itself and could compose it wrong.

## Tool surface

| Tool | Operation | Scope | Shaped |
|---|---|---|---|
| `get_authoring_conventions` | `GET /api/v1/authoring/conventions` | `authoring:read` | no |
| `list_drafts` | `GET /api/v1/drafts` | `authoring:read` | **yes** |
| `get_draft` | `GET /api/v1/drafts/{draftId}` | `authoring:read` | **yes** |
| `list_draft_attachments` | `GET /api/v1/drafts/{draftId}/attachments` | `authoring:read` | **yes** |

Names follow the repo's existing convention — the domain object, not the tag
(`list_accounts`, `list_brokers`, `list_strategies`). `get_authoring_conventions` is the
one exception and keeps `authoring` because "conventions" alone names nothing.

### Input schemas

| Tool | Input |
|---|---|
| `get_authoring_conventions` | `{}` |
| `list_drafts` | `{}` |
| `get_draft` | `{ draftId: string }` |
| `list_draft_attachments` | `{ draftId: string, filename?: string }` |

No tool takes a credential. The `authoring:read` scope is a property of the key, asserted
by [EPIC-2](../../sprints/epics/EPIC-2.md)'s standing invariant that the API key never
enters an `inputSchema`.

## Repo structure

```
src/tools/authoring/
  conventions.ts             ← get_authoring_conventions. No cuts, no notes
  get-draft.ts               ← get_draft. Owns DraftSchema and AttachmentSchema —
                               the full-fidelity transcription both siblings import
  get-draft.test.ts
  list-drafts.ts             ← list_drafts. Imports DraftSchema from get-draft.ts and
                               shapes it; declares no schema of its own
  list-drafts.test.ts
  list-draft-attachments.ts  ← list_draft_attachments. Imports AttachmentSchema
  list-draft-attachments.test.ts
  conventions.test.ts
```

`get-draft.ts` owning the schema that `list-drafts.ts` shapes is the arrangement
`breakdowns.ts` ← `summary.ts` already uses: the full transcription lives with the tool
that returns most of it, and the shaping tool imports rather than redeclares. Redeclaring
is how the two drift.

`tsconfig.json` globs `src/**/*.ts` recursively, so the new folder needs no build change.

## Substrate

### `core/client.ts`

`accountPath` cannot serve `/api/v1/drafts/{draftId}` — it hard-codes the
`/api/v1/accounts/` prefix and its error message names `list_accounts`. The guard itself
is correct and must not be duplicated: **duplicating a traversal guard is how one copy
gets fixed and the other does not.**

Extract the validation loop into a private helper, and export a second builder over it:

```
segmentPath(prefix, segments, hint)   ← private; owns PATH_SEGMENT and encodeURIComponent
accountPath(accountId, ...rest)       ← unchanged signature and unchanged message
draftPath(draftId, ...rest)           ← /api/v1/drafts/<seg>[/<seg>…]
```

`PATH_SEGMENT` (`^[A-Za-z0-9_-]{1,64}$`) is unchanged. Live `draftId` values are UUIDs,
36 characters of hex and hyphens, which it already accepts. It is **not** tightened to a
UUID pattern, for the reason already recorded against `accountId`: the OpenAPI document
declares `draftId` as a bare `type: string` with no `format` and no `pattern`, so
hard-coding UUID would take both draft tools down at once the day Senti issues an id in
another shape — this server's assumption failing, not the API's contract.

One new exported constant, beside `ACCOUNT_NOT_FOUND`:

```
DRAFT_NOT_FOUND   ← "The draft does not exist or is not owned by this API key.
                     Call list_drafts and use its `id`."
```

**`authoring:read` is not one of them.** A scope is a property of an endpoint, so it is
declared as a file-local `const AUTHORING_READ` in each of the four tool files — the
pattern already in use, where `trading:read` appears in `positions.ts`, `orders.ts` and
`deals.ts`, and `performance:read` in all three performance files. Four copies of a string
is the existing convention; hoisting it into `core/` would invert the dependency edge that
keeps `core/` testable without constructing a tool.

### `core/tool.ts`

Unchanged. All four tools are reads and register through `registerReadTool` with its
constant `readOnlyHint: true` annotation.

### `core/parse.ts`

Unchanged. Four new `subject` strings: `authoring conventions`, `draft list`, `draft`,
`draft attachment list`.

## Payload policy

### `list_drafts` — four cuts, four notes

| Cut | What goes | Replaced by | Why it loses something |
|---|---|---|---|
| 1 | `sourceCode` | `sourceBytes` | The source itself. Up to 192 KiB × 20 |
| 2 | `attachments[].sourceCode` | `attachments[].sourceBytes` | Same, up to 64 KiB × 5 × 20 |
| 3 | `lastCompileLog` | — | The compiler's own words. 16 KiB × 20 |
| 4 | `lastCompileDiagnostics` | `diagnosticsCount` | The machine-readable failure detail |

Kept whole: `id`, `name`, `createdAt`, `updatedAt`, `lastCompileStatus`,
`compiledUpToDate`, `eaDefinitionId`, and `attachments[].{id, filename, createdAt}`.

`logTruncated` is dropped with cut 3 — it describes a field that is no longer there, and
carrying it would assert something about a log the reader cannot see.

**All four notes point at the same place**, and the tool emits them as one sentence rather
than four, naming what was dropped and the tool that returns it:

> Source and compiler output were cut: N draft(s) and M attachment(s) had `sourceCode`
> dropped (X KiB total), along with the compile log and diagnostics. Call `get_draft` for
> one draft's source, log and diagnostics, or `list_draft_attachments` for its indicator
> sources.

`notes` is `string[]` and is empty when the account holds no drafts, so its presence in
the schema never implies a cut occurred — the same reachability property
`get_performance_breakdowns` maintains.

**Byte counting is `Buffer.byteLength(source, 'utf8')`, not `source.length`.** MQL5 source
carries comments, and comments carry non-ASCII. A UTF-16 code-unit count would understate
a Vietnamese-commented file by up to 3× and would be reported to the reader as bytes.

### `get_draft` — one cut, one note

| Cut | What goes | Replaced by |
|---|---|---|
| 1 | `attachments[].sourceCode` | `attachments[].sourceBytes` |

Everything else is returned whole: the EA's `sourceCode`, `lastCompileLog`,
`logTruncated`, and `lastCompileDiagnostics` in full. This is the tool a reader calls
*because* they want the source, and truncating it here would leave no tool in the server
that can return an EA's code.

The note is emitted only when the draft has at least one attachment — a draft with none
loses nothing, and `notes` stays empty.

Worst case after the cut: 192 KiB source + 16 KiB log ≈ 208 KiB. MCP returns a tool's
result on both `content` and `structuredContent`, and both reach the model, so the token
ceiling is **~105,000**, not the ~52,000 a single-channel count would suggest
([CONTEXT D34](../../CONTEXT.md)). That is large and it is stated in the tool description,
so a model can decide whether it wants the whole file before asking for it.

### `list_draft_attachments` — a budget, not a truncation

With `filename` supplied, the tool returns that one attachment whole and cuts nothing.

With `filename` omitted, attachments are returned whole in the API's filename order while
the running total **including that attachment** stays within **65,536 bytes**. The first
attachment is always returned whole whatever its size; every later one that would breach
the budget, and every one after it, degrades to metadata (`id`, `filename`, `createdAt`,
`sourceBytes`) and the tool writes one note:

> Attachment source was cut: K of N attachment(s) exceeded this tool's 64 KiB budget and
> are listed without their source. Pass `filename` to read one of them whole.

The budget is `maxAttachmentBytes` — one attachment's worth. Checking the total *after*
inclusion rather than before is what makes the ceiling exact: the response can carry at
most 64 KiB, or one oversized first attachment, and never the 127 KiB that a
check-before-adding rule would admit. The common case (one indicator) never triggers a
cut. Counting both `content` and `structuredContent` — both reach the model — the tool is
capped at ~33,000 tokens against the endpoint's ~82,000 ceiling
([CONTEXT D34](../../CONTEXT.md)).

A partially-returned attachment is never emitted. Source is returned whole or not at all:
half an MQL5 file reads as a complete one to a model that did not write it, and there is
no way to signal "this compiles only because you cannot see the rest".

### `lastCompileDiagnostics` — parsed loosely, rendered tightly

The two-sided fact above forces a two-sided treatment, and conflating the sides is the
mistake to avoid.

**Parsing stays `z.array(z.unknown())`.** `parseOrThrow` is all-or-nothing by design, so
transcribing the compile response's shape onto a `GET` that does not declare it would take
`get_draft` and `list_drafts` down together the day the two diverge — this server's
inference failing, reported to the user as "the API may have changed". The `GET` declares
untyped; the schema records untyped.

**Rendering uses the shape opportunistically.** `get_draft`'s formatter carries
`DiagnosticSchema`, transcribed from the compile response, and `safeParse`s each element:
a match renders as `error MQ5-1234 at strategy.mq5:42:7 — undeclared identifier`, and
anything else falls back to the raw element. A mismatch costs a less readable line, never
a failed tool call.

This is the same asymmetry `breakdowns.ts` uses for `perAccount` — declare `unknown` where
validation would only convert an upstream change into an outage — except that here the
data does reach the model, so the fallback has to render rather than drop.

`list_drafts` needs none of this: it counts the array and cuts it.

### `get_authoring_conventions` — no cuts

Returned as received, with `notes` absent from the schema entirely rather than present and
always empty. A tool that cannot cut should not advertise that it might.

## `draftId` handling

Identical in shape to [EPIC-2](../../sprints/epics/EPIC-2.md)'s `accountId` invariant, and
restated because copying the first draft tool into the second is exactly how it gets
broken:

- `draftId` originates from the model. It reaches a URL only through `draftPath`.
- **Enrolment in the traversal test is not optional.** `src/server.test.ts` drives its
  traversal assertions from the table-driven `TOOL_CALLS` list; `get_draft` and
  `list_draft_attachments` each add a row. A tool that builds its path another way passes
  the suite while being the defect the suite exists to catch.
- `filename` on `list_draft_attachments` never reaches a URL — it is a client-side filter
  over an already-fetched array — so it needs no path validation. This is stated because
  the *next* reader may be adding a `filename` that does reach one.

## Error mapping

| Status | Handled by | This tag's specifics |
|---|---|---|
| 401 | `core/client.ts`, unchanged | — |
| 403 | `core/client.ts`, unchanged | `scope: 'authoring:read'` quoted verbatim |
| 404 | `notFoundMeans: DRAFT_NOT_FOUND` | Draft tools only. The two collection endpoints take no path parameter, so account-style guidance on their 404 would send a reader to check the one thing that cannot be the cause |
| 409 | not passed | No authoring read declares one |
| 429 | `core/client.ts`, unchanged | Already reads `X-RateLimit-*` |

## Testing

Every tool follows the shape US-2.4 established, and the suite grows by four files:

- **Schema tests** — the transcription against a captured live fixture, not a
  hand-written one. `get-draft.test.ts` carries the 4-draft response measured 2026-08-19,
  with source bodies replaced by shorter stand-ins of *stated* byte length so the cut
  arithmetic is asserted against a known number.
- **Shaping tests** — for each cut: that it removes what it claims, that the surviving
  fields are untouched, and that the note is present exactly when something was lost and
  absent when nothing was. The `notes`-empty case is a test, not an assumption.
- **Budget tests** for `list_draft_attachments` — under budget (no note), over budget
  (note, and the boundary attachment either whole or metadata, never partial), and
  `filename` supplied (no note regardless of size).
- **Traversal tests** — new rows in `TOOL_CALLS`.
- **Key-absence tests** — the standing assertion that no error branch's text contains the
  API key.
- **Smoke** — one live call, opt-in. `get_authoring_conventions` is the right one: it is
  2 KiB, needs no draft to exist, and is the only authoring read that cannot return an
  empty result on a fresh key.

Expect the suite to move from 20 files / 429 tests to roughly 24 files. `vitest.config.ts`
stays scoped to `src/**/*.test.ts` ([CONTEXT D13](../../CONTEXT.md)); do not widen it.

## Story plan

Four stories, one per endpoint, each shipping its own minor — the cadence
[sprint-2026-W33](../../sprints/sprint-2026-W33.md) §Phase 1 used for six tools.

| US | Title | Points | Ships | Why this order |
|---|---|---|---|---|
| US-7.1 | `draftPath` substrate, `tools/authoring/`, and `get_authoring_conventions` | 3 | `2.1.0` | **First because it publishes the limits.** `conventions.limits` is the input that sizes every cut in US-7.3 and US-7.4 |
| US-7.2 | `get_draft`, and the `DraftSchema` its siblings import | 2 | `2.2.0` | Owns the full-fidelity transcription. Nothing can be shaped before the unshaped shape exists |
| US-7.3 | `list_drafts`, four cuts and their note | 3 | `2.3.0` | The largest payload in the tag, and the only tool with more than one cut |
| US-7.4 | `list_draft_attachments`, the byte budget and `filename` | 2 | `2.4.0` | Depends on US-7.2's `AttachmentSchema` and on US-7.1's `maxAttachmentBytes` |

**Total: 10 points.** Added to [sprint-2026-W34](../../sprints/sprint-2026-W34.md)'s single
scope table as four rows, with a clause appended to its `goal` — never as a new phase
section ([CONTEXT D30](../../CONTEXT.md)).

Each story opens with a `TASK-7.x.1` that checks its contract against the live service
before any code is written. That task is what carried US-2.10 through US-2.13 without an
implementation plan, four times in a row, and it is what caught the `reporting` misreading
and the `syncedThrough` field. Here it has already paid once: it is what turned "`get_draft`
returns the draft whole" into decision 3.

## Documentation obligations

Every code-shipping commit updates docs in the **same** commit (RULE-1). Beyond each
story's own CHANGELOG entry and `VERSION` bump:

| Artifact | Change | Story |
|---|---|---|
| `docs/sprints/epics/EPIC-7.md` | New. Goal, pillars, invariants, story index, and the two live gaps §Measured limits states | US-7.1 |
| `docs/sprints/sprint-2026-W34.md` | Four rows in the existing scope table; one clause appended to `goal`; total 2 → 6 stories, 3 → 13 points | US-7.1 |
| `docs/CONTEXT.md` | **D32** — `list_drafts` drops source, and why the measured ceiling makes it non-optional. **D33** — `draftPath` is extracted from `accountPath` rather than copied | US-7.1, US-7.3 |
| `AGENTS.md` | 17 → 29 operations; 10 → 14 tools; `tools/authoring/` in the structure block; the `authoring:read` scope | US-7.1, then per story |
| `README.md` | Tool table gains four rows | per story |
| `docs/sprints/STATUS.md` | `npm run agile:status` — generated, never hand-edited (RULE-5) | per story |

No new environment variable, so RULE-11 does not fire. `SENTI_API_KEY` gains a scope
requirement, not a sibling — recorded in `docs/SETUP.md`'s existing table rather than as a
new row.

## Open questions

Carried deliberately rather than guessed at:

1. **Whether a `GET`'s diagnostic really matches the compile response's.** Strongly
   implied by the description, typed in one half of the document, unobserved in both.
   §Payload policy handles the uncertainty rather than resolving it: loose parse, tight
   render. The observation that would resolve it is one draft in a `FAILED` state — which
   US-7.2's TASK-7.2.1 should arrange **by hand in the web Studio, not by calling
   `POST /drafts/{draftId}/compile` from this server**, which is a write and out of scope.
   If the shapes match, the render path is confirmed and the parse stays loose anyway; if
   they differ, that is a finding for the API, not a schema change here.
2. **Whether the attachment path works at all.** Zero attachments exist on the live key.
   Every attachment branch is test-covered and none is live-covered. Same trigger, and the
   same constraint: attach an indicator in the web Studio rather than through this server,
   which registers no write tool. This is the authoring tag's equivalent of EPIC-2's
   offline-terminal gap, and it is far cheaper to discharge — it needs a UI action, not an
   offline MT5 terminal.
3. **Whether `conventions` should be cached.** Deliberately not, above. The endpoint
   already serves a weak `ETag` (`W/"92e-…"`, observed 2026-08-19) alongside its
   `max-age=3600`, so a conditional `GET` is available the day this server wants one — but
   neither the `ETag` nor a `304` is declared in the OpenAPI document, so relying on it
   today would be relying on an undocumented behaviour of the reverse proxy. The trigger to
   revisit is a second endpoint wanting the same mechanism, or the API declaring it.
4. **What flavour of regex `forbiddenConstructs[].pattern` is.** Live values use
   non-capturing groups, `\b`, and negative lookahead (`#(?:\s|\/\*…\*\/)*import\b`),
   so they are at least ECMAScript-compatible — but the document types the field as a bare
   `string` and never says it is a pattern at all. `get_authoring_conventions` passes it
   through verbatim and its description tells the model these are regexes it may test its
   own source against. It does **not** compile or run them: a `RegExp` built from an
   undeclared dialect is a crash or a silent mismatch, and neither belongs inside a read
   tool.
5. **Whether `list_drafts`' cut should be optional.** It is not, and no parameter turns it
   off — the same refusal `get_performance_breakdowns` makes. The ceiling is 2.7M tokens;
   an opt-out is a footgun with a documented safety catch. Revisit only if a real caller is
   blocked, not on principle.

## EPIC-3 / write-path boundary

This design registers no write tool and adds no code path that a write tool could reach.
`registerReadTool`'s `readOnlyHint: true` is a constant, not a parameter, which keeps that
mechanical.

What it does hand forward: `draftPath`, `DRAFT_NOT_FOUND`, `AUTHORING_READ`, and the
full-fidelity `DraftSchema` and `AttachmentSchema` — every authoring write reads back a
draft, and none of them should transcribe that schema a second time.

## Cross-references

- [EPIC-2](../../sprints/epics/EPIC-2.md) — the read path this extends, and the source of
  every invariant restated above
- [EPIC-3](../../sprints/epics/EPIC-3.md) — the write path; its operation table is stale at 7
- [read-tool expansion spec](2026-08-05-senti-read-tools-expansion-design.md) — the
  substrate and payload-policy precedents this design follows
- [CONTEXT D25](../../CONTEXT.md) — a note records loss, not removal
- [CONTEXT D30](../../CONTEXT.md) — a sprint file carries one scope table
- [sprint-2026-W34](../../sprints/sprint-2026-W34.md) — the window these four stories join
