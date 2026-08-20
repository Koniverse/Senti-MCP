---
id: US-7.4
title: "list_draft_attachments tool, and EPIC-7's close"
epic: EPIC-7
status: done
priority: P1
points: 2
sprint: sprint-2026-W34
assignee: bluezdot
created: 2026-08-19
updated: 2026-08-20
version_shipped: 2.4.0
---

## Goal

An EA embeds indicator source via `#resource`, and
[US-7.2](US-7.2-get-draft-tool.md) deliberately does not return it. This story ships the tool
that does — bounded by a byte budget rather than a truncation, with a `filename` filter that
is both the way to read one indicator cheaply and the way to read one the budget left out.

It is also the story that closes [EPIC-7](../epics/EPIC-7.md), which means stating plainly
what the epic's `done` does not cover.

## Background

Per the [design spec](../../superpowers/specs/2026-08-19-senti-authoring-read-tools-design.md)
§Tool surface, `list_draft_attachments` reads `GET /api/v1/drafts/{draftId}/attachments` under
`authoring:read` and lands in `src/tools/authoring/list-draft-attachments.ts`.

At `maxAttachmentsPerDraft: 5` × `maxAttachmentBytes: 65536` the endpoint's ceiling is
**320 KiB ≈ 82,000 tokens**. Bounding it is not optional.

### A budget, not a truncation

- **With `filename` supplied**, the tool returns that one attachment whole and cuts nothing.
- **With `filename` omitted**, attachments are returned whole in the API's filename order
  *while the running total including that attachment stays within 65,536 bytes*. The first
  attachment is always returned whole whatever its size. Every later one that would breach
  the budget — **and every one after it** — degrades to metadata, and the tool writes one
  note.

**Checking the total after inclusion rather than before is what makes the ceiling exact.**
A check-before-adding rule would admit 64 KiB of accumulated source plus one more 64 KiB
file, i.e. 127 KiB. This rule caps the response at 64 KiB, or one oversized first attachment.

The budget is `maxAttachmentBytes` — one attachment's worth — chosen so that a single
attachment always fits whole, which makes the common case (one indicator) never trigger a
cut. Counting both `content` and `structuredContent` — MCP returns a tool's result on both,
and both reach the model — it caps the tool at ~33,000 tokens against the endpoint's
~82,000 ceiling ([CONTEXT D34](../../CONTEXT.md)).

**A partially-returned attachment is never emitted.** Source is returned whole or not at all:
half an MQL5 file reads as a complete one to a model that did not write it, and there is no
way to signal "this compiles only because you cannot see the rest".

### Why `filename` is a client-side filter

The API has no way to request one attachment. `GET /drafts/{draftId}/attachments/{attachmentId}`
**does not exist** — though `PUT` and `DELETE` on that exact path do. So the tool fetches the
set and filters, which bounds the *model's* context even though the *HTTP response* is not
bounded. Raised with the API as an asymmetry; the workaround stands until it is fixed.

`filename` never reaches a URL, so it needs no path validation. This is stated because the
next reader may be adding one that does.

## Acceptance criteria

- [x] **AC-1** — **Given** a call with `draftId`, **When** the request is built, **Then** the
  path is `draftPath(args.draftId, 'attachments')`, **And** the tool is enrolled in
  `src/server.test.ts`'s traversal test by a `TOOL_CALLS` row carrying `arguments`.
- [x] **AC-2** — **Given** a set whose total is within the budget, **When** the tool returns,
  **Then** every attachment carries its full `sourceCode`, **And** `notes` is empty.
- [x] **AC-3** — **Given** any attachment, returned whole or not, **When** the tool returns,
  **Then** it carries `sourceBytes`, `id`, `filename` and `createdAt`.
- [x] **AC-4** — **Given** a first attachment larger than the whole budget, **When** the tool
  returns, **Then** it is still returned whole.
- [x] **AC-5** — **Given** an attachment that would take the running total past the budget,
  **When** the tool returns, **Then** its `sourceCode` is `null` and its metadata is intact,
  **And** every attachment after it is also `null` — even one small enough to fit.
- [x] **AC-6** — **Given** any cut, **When** the tool returns, **Then** no returned
  `sourceCode` is a prefix or fragment of the real one; each is the complete source or
  `null`.
- [x] **AC-7** — **Given** a cut, **When** the tool returns, **Then** `notes` states how many
  of how many attachments were cut and names `filename` as the way to read one whole, **And**
  the same sentence appears in `content`.
- [x] **AC-8** — **Given** `filename` naming an existing attachment, **When** the tool
  returns, **Then** exactly that attachment is returned whole regardless of its size, **And**
  `notes` is empty.
- [x] **AC-9** — **Given** `filename` naming no attachment, **When** the tool returns, **Then**
  the result is empty and `content` lists the filenames that **are** available.
- [x] **AC-10** — **Given** a draft with no attachments, **When** the tool returns, **Then**
  `content` explains the empty result rather than returning nothing, **And** `notes` is empty.
- [x] **AC-11** — **Given** a `404` from the API, **When** the tool returns, **Then**
  `isError` is true and the text carries `DRAFT_NOT_FOUND`'s guidance.
- [x] **AC-12** — **Given** `EPIC-7.md` at close, **When** it is read, **Then** it carries a
  §What this close does not claim listing every branch that never ran against the real
  service, with what would discharge each.
- [x] **AC-13** — **Given** `filename` naming an existing attachment on a draft that holds
  others, **When** the text is rendered, **Then** it names the filter and the draft's real
  attachment count, so `content` alone cannot be read as the draft's whole set
  ([CONTEXT D35](../../CONTEXT.md)).
- [x] **AC-14** — **Given** a cut, **When** the note is rendered, **Then** it describes the
  cut rule rather than attributing a breach to each cut file — an attachment after the
  first breach is cut regardless of its own size ([CONTEXT D35](../../CONTEXT.md)).

## Tasks

- [x] **TASK-7.4.1** — `src/tools/authoring/list-draft-attachments.ts` domain module
  (AC: 2–10)
  - [x] `ATTACHMENT_BUDGET_BYTES = 65_536`, commented with its provenance —
        `maxAttachmentBytes` from the conventions endpoint, measured 2026-08-19
  - [x] `parseAttachments` via `parseOrThrow` with subject `draft attachment list`
  - [x] `shapeAttachments(attachments, filename?)` implementing the after-inclusion budget
        check, the always-whole first attachment, and the once-cutting-stay-cutting rule
  - [x] `formatAttachments(shaped, filename?, available?)` — the `available` list is what
        AC-9 renders
- [x] **TASK-7.4.2** — Registration and the `2.4.0` release (AC: 1, 11)
  - [x] Register through `registerReadTool`; `scope: 'authoring:read'`;
        `notFoundMeans: DRAFT_NOT_FOUND`; no `conflictMeans`
  - [x] `inputSchema` is `{ draftId: string, filename?: string }`
  - [x] Tool description says `filename` is how to read one attachment whole **and** how to
        read one the budget left out, and that `get_draft` is where the EA's own source lives
  - [x] `src/server.ts` registration; `TOOL_CALLS` row **with `arguments`**
  - [x] `VERSION`, `package.json`, `src/config.ts` `SERVER_VERSION` → `2.4.0` in lockstep;
        `docs/CHANGELOG.md` `## [2.4.0]`; `README.md` tool-table row; `AGENTS.md` tool count
        13 → **14**, matching the API's 14 `GET` operations
- [x] **TASK-7.4.3** — Extend `src/smoke.test.ts` with a `list_draft_attachments` leg, guarded
  on the account holding at least one draft (AC: 10)
- [x] **TASK-7.4.4** — **Close EPIC-7 honestly** (AC: 12)
  - [x] Set `status: done` and write §What this close does not claim from the table
        [EPIC-7](../epics/EPIC-7.md) already carries
  - [x] Move a row **out** only if that branch actually ran live during implementation, and
        record the observation in its place. Do not delete a row that still stands
  - [x] State whether the open question on `lastCompileDiagnostics` was settled by
        [US-7.2](US-7.2-get-draft-tool.md)'s TASK-7.2.1 or is still open

## Dev notes

### Architecture constraints

- Imports `AttachmentSchema` and `byteLength` from
  [US-7.2](US-7.2-get-draft-tool.md)'s `get-draft.ts`. Declares only the entry schema that
  adds `sourceBytes` and makes `sourceCode` nullable.
- `sourceCode: z.string().nullable()` is the shape that carries the cut. **`null` means "not
  returned", never "empty file"** — an empty attachment is `''` with `sourceBytes: 0`. The
  distinction matters for the same reason `positions.ts` maps `0` and `null` to `—`: for a
  file, "you cannot see this" and "this is blank" are different answers.

### Performance budget

- Response capped at **65,536 bytes of source**, or one oversized first attachment —
  **≈ 33,000 tokens** counting both `content` and `structuredContent`
  ([CONTEXT D34](../../CONTEXT.md)) — against an endpoint ceiling of 320 KiB ≈ 82,000
  tokens.
- The cap is structural, not statistical — see §Background on why the check runs after
  inclusion.
- **Untestable live on the current key**, which holds zero attachments. Covered by unit test
  against synthetic sizes, and recorded as a gap in EPIC-7's close rather than claimed as
  verified.

### What we explicitly did NOT do

- **No partial source.** AC-6 asserts it. Half a file is worse than no file.
- **No `limit` or `offset` parameter.** `maxAttachmentsPerDraft` is 5; a pagination mechanism
  over at most five items is more surface than it saves, and `filename` already selects one.
- **No fuzzy or case-insensitive `filename` match.** Exact match only. A near-miss silently
  returning a different indicator's source is worse than an empty result that lists what is
  available, which is what AC-9 renders.
- **No fetch avoidance when `filename` is supplied.** The API returns the whole set either
  way; the tool cannot ask for less. The saving is in the model's context, not on the wire,
  and pretending otherwise in the tool description would be false.

### Cross-story dependencies

- **Builds on** [US-7.1](US-7.1-authoring-substrate-and-conventions-tool.md) — `draftPath`,
  `DRAFT_NOT_FOUND`, and the `maxAttachmentBytes` the budget is set from.
- **Builds on** [US-7.2](US-7.2-get-draft-tool.md) — `AttachmentSchema`, `byteLength`, and
  the boundary that makes this tool load-bearing rather than redundant.
- **Follows** [US-7.3](US-7.3-list-drafts-tool.md) — reuses its `notes` vocabulary.
- **Closes** [EPIC-7](../epics/EPIC-7.md).

### References

- [Source: design spec §Payload policy](../../superpowers/specs/2026-08-19-senti-authoring-read-tools-design.md) — the budget, and why it is checked after inclusion
- [Source: implementation plan Task 5](../../superpowers/plans/2026-08-19-senti-authoring-read-tools-w34.md)
- [Source: EPIC-7 §What this close does not claim](../epics/EPIC-7.md)
- [Source: EPIC-2 §Remaining work](../epics/EPIC-2.md) — the precedent for closing an epic while naming what is unverified

## Implementation notes

**Both defects the plan's Self-Review flagged were applied as ruled, not as first drafted.**
The implementation plan's Task 5 Step 3 prints `formatAttachments` twice — a 2-argument
version, then an amendment to a 3-argument version carrying `available: string[] = []`. Only
the amended 3-argument signature was written; the superseded 2-argument version never existed
in this file's history. Separately, the plan's own test block calls
`formatAttachments(shapeAttachments([A, B], 'Missing.mq5'), 'Missing.mq5')` with no third
argument in the "lists the available filenames" test — which, against the 3-argument
signature, defaults `available` to `[]` and asserts on text the call can never produce. That
test was written with the third argument
(`['Trend.mq5', 'Momentum.mq5']`) supplied, matching every other test in the block, which
needed no correction.

**17 tests, matching the brief's Step 4 exactly.** `npx vitest run
src/tools/authoring/list-draft-attachments.test.ts` reports 17 passed, 0 failed — 3
`describe('parseAttachments', …)` + 9 `describe('shapeAttachments', …)` + 5
`describe('formatAttachments', …)` = 17.

**Registration order in `src/server.ts`** is now `registerGetAuthoringConventions` →
`registerListDrafts` → `registerGetDraft` → `registerListDraftAttachments`, continuing the
pattern `list_drafts` established: the `authoring/` group reads conventions → list → read →
attachments. The `TOOL_CALLS` row in `src/server.test.ts` sits at the matching position,
directly after `get_draft`, and carries `arguments: { draftId: 'abc-123' }` — the key AC-1
requires for enrollment in the path-traversal test's `SEGMENT_KEYS` scan.

**Live check before closing the epic, not just before writing the smoke leg.** A one-off
script against the smoke key (`GET /api/v1/drafts`, same call `npm run test:smoke` makes)
confirmed, on 2026-08-20, immediately before EPIC-7's close was written: 4 drafts, `id`s
`9b95a542…`, `009906b6…`, `ce50257c…`, `c8619a46…`; `attachments.length` is `0` in all four;
`lastCompileStatus` is `SUCCESS` in one and `null` in the other three — none `FAILED`. This
is what backs EPIC-7's §What this close does not claim: every attachment branch and the
`DiagnosticSchema` render path stayed synthetic-only, and the `lastCompileDiagnostics` open
question is unchanged from US-7.2 — still open, not settled by this story.

**`npm run test:smoke` itself passed** with the new `list_draft_attachments` leg added
inside Task 4's `if (drafts.length > 0)` guard: it fetches `draftPath(drafts[0].id,
'attachments')`, parses it, shapes it, and asserts the rendered text is non-empty. Against
the live account that means shaping an empty array — the empty-attachments branch of
`formatAttachments`, not the budget or the `filename` filter.

**Nothing was deliberately skipped.** Every step in the brief — the 17-test red/green cycle,
registration, the smoke-test leg, the version bump across `VERSION`, `package.json`,
`src/config.ts` and the lockfile, the CHANGELOG entry, the README row, AGENTS.md's tool-count
fix, this story's status, the sprint file's status cell, and EPIC-7's close — was carried out.
No authoring write endpoint (`POST /drafts`, `/compile`, `/register`, or any attachment write)
was called, in code or in a live check, consistent with the epic-wide read-only constraint.
