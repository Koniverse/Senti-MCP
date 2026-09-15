---
id: US-9.2
title: "get_draft_attachment, and list_draft_attachments becomes an index"
epic: EPIC-9
status: backlog
priority: P1
points: 5
sprint:
depends_on: [US-9.1]
assignee: bluezdot
created: 2026-09-14
updated: 2026-09-15
---

## Goal

A model reads one indicator file by its id, whole, in one request — instead of pulling a
draft's whole attachment collection and hoping the file it wants survives a 64 KiB budget.
`list_draft_attachments` stops carrying bodies and becomes the index a model picks an
`attachmentId` from.

## Background

### The new route

Senti US-46.50, deployed: `GET /api/v1/drafts/{draftId}/attachments/{attachmentId}`,
`operationId: getDraftAttachment`, scope `authoring:read`. It returns one `DraftAttachment` —
`{ id, filename, sourceCode, createdAt, updatedAt }`, the same shape the collection and `PUT`
return — and one identical `404` for an unknown id, a draft the caller does not own, or an
attachment that belongs to a different draft. Both path parameters are declared
`format: uuid`. Its own description: *"the collection carries every source body, so reading
one 2 KiB indicator through it can transfer up to 320 KiB."*

### The workaround it retires

`list_draft_attachments` (`src/tools/authoring/list-draft-attachments.ts`) reads
`GET …/attachments`, which still returns every body — up to 5 × 64 KiB — and rations them
through `ATTACHMENT_BUDGET_BYTES = 65_536` (`:14`), a copy of the runtime `limits` block that
[EPIC-8](../epics/EPIC-8.md) §Cross-cutting invariants says must never be transcribed. The
budget is checked after inclusion and cuts everything after the first breach, so a 1-byte file
can be withheld because a 64 KiB one came first (`:88-90` says so to the model). The escape
hatch is the `filename` filter — `shapeAttachments`' first branch, `:43-61` — and filenames
were never guaranteed unique.

### The decision on shape — 2026-09-14

The maintainer chose the **schema-compatible** index over a rewrite that would remove the
`filename` input and the `sourceCode` output field (a `3.0.0`):

- **With `filename` omitted**, the tool returns every attachment's `id`, `filename`,
  `sourceBytes`, `createdAt` and `updatedAt`, with `sourceCode: null` on every entry. The output
  schema already declares `sourceCode` nullable, so nothing a client validates against changes.
- **With `filename` given**, the name is resolved against that index and the first match is read
  through the new route and returned whole. The duplicate-filename note stays.
- **The index comes from the summary** [US-9.1](US-9.1-list-drafts-summary-mode.md) parses —
  `GET /api/v1/drafts?view=summary`, about 24 KB at every cap — not from `GET …/attachments`,
  which carries every body, and not from `GET /drafts/{draftId}`, which carries the EA source
  too.

That route takes no `draftId`, so a missing or foreign draft does not produce a `404`: it is
simply absent from the list. The tool reports that absence in the same words `DRAFT_NOT_FOUND`
uses, which is correct because the summary lists only the caller's drafts — a cross-owner id is
as absent as an unknown one, matching what a `404` would have meant.

### Pointers that change with it

Three places send a model to `list_draft_attachments` to read attachment source. After this
story they send it to `get_draft_attachment`, by id:

- `get-draft.ts:86-88` — `shapeDraft`'s attachment note, and the tool description (`:186-187`)
- `write-result.ts:88-90` — `shapeDraftWrite`'s attachment note
- `write-result.ts:119-120` — `shapeAttachmentWrite`'s read-back note, which today says *"Call
  list_draft_attachments with filename"*. It needs the `draftId` it does not currently receive.

## Acceptance criteria

- [ ] **AC-1** — **Given** `get_draft_attachment` with a `draftId` and an `attachmentId`, **When**
  it runs, **Then** it requests `draftPath(draftId, 'attachments', attachmentId)` under
  `authoring:read`, **And** returns `id`, `filename`, `sourceBytes`, `createdAt`, `updatedAt`
  and the whole `sourceCode`.
- [ ] **AC-2** — **Given** a `404`, **When** the tool returns, **Then** `isError` is true and the
  text says the id may be unknown, on a draft this key does not own, or on a different draft —
  the API does not distinguish them — **And** names `list_draft_attachments` for valid ids.
- [ ] **AC-3** — **Given** a path-traversal-shaped `attachmentId`, **When** the tool runs,
  **Then** it is rejected before any request, **And** `SEGMENT_KEYS` in `src/server.test.ts`
  includes `attachmentId`.
- [ ] **AC-4** — **Given** `list_draft_attachments` with `filename` omitted, **When** it runs,
  **Then** it makes exactly one request, to `/api/v1/drafts?view=summary`, **And** returns every
  attachment of that draft with `sourceCode: null`, **And** its text names
  `get_draft_attachment` with each `attachmentId`.
- [ ] **AC-5** — **Given** a `draftId` absent from the summary, **When** `list_draft_attachments`
  runs, **Then** `isError` is true with the same guidance `DRAFT_NOT_FOUND` gives.
- [ ] **AC-6** — **Given** `filename`, **When** it matches, **Then** the first match is read
  through the single-attachment route and returned whole; **When** several match, **Then** the
  existing skipped-count note is written; **When** none match, **Then** the text lists the
  available filenames.
- [ ] **AC-7** — `grep -rn "ATTACHMENT_BUDGET_BYTES" src` prints nothing.
- [ ] **AC-8** — **Given** the 2.8.1 and new `list_draft_attachments` schemas, **When** compared,
  **Then** `filename` is still an optional input, **And** every 2.8.1 output field is still
  declared with a compatible type.
- [ ] **AC-9** — **Given** a draft with attachment source, **When** `get_draft`, `create_draft`,
  `update_draft`, `add_draft_attachment` or `update_draft_attachment` writes its note, **Then**
  the note names `get_draft_attachment` and an `attachmentId`, not `list_draft_attachments` and
  a filename.
- [ ] **AC-10** — **Given** `src/server.test.ts`, **When** it runs, **Then**
  `get_draft_attachment` is in `TOOL_CALLS` and passes the read-only-annotation, output-schema
  and key-absence assertions, **And** the read tool count is 15.
- [ ] **AC-11** — **Given** `npm run test:smoke` with `SENTI_SMOKE_WRITES=1`, **When** the write
  leg runs, **Then** it reads the attachment it created back through the new route by id and
  compares the source.
- [ ] **AC-12** — **Given** the new tool's description, **When** it is read, **Then** it states
  the worst case — one attachment at `maxAttachmentBytes`, returned in both channels
  ([CONTEXT D34](../../CONTEXT.md)) — in tokens.

## Tasks

- [ ] **TASK-9.2.1** — `src/tools/authoring/get-draft-attachment.ts` (AC: 1, 2, 3, 12)
  - [ ] Its own schema transcribed from `components.schemas.DraftAttachment`, `updatedAt`
        included; `AttachmentSchema` in `get-draft.ts` is **not** widened (see §Architecture
        constraints)
  - [ ] An `ATTACHMENT_NOT_FOUND` hint in `src/core/client.ts` beside `DRAFT_NOT_FOUND`
  - [ ] `registerReadTool`; `src/server.ts` registration after `registerListDraftAttachments`
- [ ] **TASK-9.2.2** — Rewrite `list-draft-attachments.ts` as an index (AC: 4, 5, 6, 7, 8)
  - [ ] Delete `ATTACHMENT_BUDGET_BYTES` (`:14`) and the budget branch of `shapeAttachments`
        (`:63-97`)
  - [ ] Index from `parseDrafts` over `/api/v1/drafts?view=summary`; run `draftId` through the
        segment guard first, so a traversal-shaped id fails the same way it does everywhere else
  - [ ] `filename` resolves to an id, then one request through the new route
  - [ ] Output schema: add `updatedAt`; keep every existing field
- [ ] **TASK-9.2.3** — Repoint the notes (AC: 9)
  - [ ] `get-draft.ts:86-88` and the description at `:186-187`
  - [ ] `write-result.ts:88-90`; `shapeAttachmentWrite` takes the `draftId` so `:119-120` can
        name it
- [ ] **TASK-9.2.4** — Tests (AC: 1–10)
  - [ ] `get-draft-attachment.test.ts`; `list-draft-attachments.test.ts` loses the eight budget
        tests (`:35-118`) and gains index tests; `write-result.test.ts` and `get-draft.test.ts`
        note assertions
  - [ ] `src/server.test.ts`: `TOOL_CALLS` row, `SEGMENT_KEYS += 'attachmentId'`, read count 15
- [ ] **TASK-9.2.5** — Smoke (AC: 11)
  - [ ] Read leg: when the first draft has an attachment, read it by id
  - [ ] Write leg: read `SmokeInd.mq5` back by id after the `POST`
- [ ] **TASK-9.2.6** — Release (AC: all)
  - [ ] Minor bump in all five places; `docs/CHANGELOG.md`; `README.md` rows for both tools;
        `AGENTS.md` tool count and §Repo structure
  - [ ] Walk [docs/RELEASE.md](../../RELEASE.md)

## Dev notes

### Architecture constraints

- **`AttachmentSchema` is not widened to require `updatedAt`.** It is parsed by `get_draft`
  and every attachment write. Making a field those tools never read required would let one
  lagging host take all of them down. The new tool transcribes its own schema instead.
- **`attachmentId` inherits the path guard** through `draftPath(draftId, 'attachments',
  attachmentId)` ([EPIC-8](../epics/EPIC-8.md) §Cross-cutting invariants). Whether that guard
  becomes a UUID check is [US-9.4](US-9.4-typed-diagnostics-and-path-segments.md)'s call.
- **Two requests for a filename read** — the index, then the file — rather than one. The single
  request that could answer by name is the collection route this story is leaving.

### Cross-story dependencies

- **Builds on** [US-9.1](US-9.1-list-drafts-summary-mode.md) — `parseDrafts` and the transcribed
  `DraftAttachmentSummary` item.
- **Sibling of** [US-9.4](US-9.4-typed-diagnostics-and-path-segments.md) — both touch
  `segmentPath` in `src/core/client.ts`.
- **Required by** [US-9.6](US-9.6-operationid-docs-and-spec-drift-check.md) — which writes the
  final tool and operation counts.

### What we explicitly did NOT do

- **No removal of `filename` or `sourceCode`** — decided 2026-09-14 ([EPIC-9](../epics/EPIC-9.md)
  §Semver posture).
- **No batch read of several attachments in one call.** One id, one file, one request. A model
  that wants all five makes five calls, each bounded by `maxAttachmentBytes`.
- **No `GET …/attachments` anywhere in `src/` after this story.** It carries every body, and
  nothing here needs them all at once.

### References

- [Source: EPIC-9 §The hand-off, checked](../epics/EPIC-9.md)
- [Source: US-7.4](US-7.4-list-draft-attachments-tool.md) — the budget as shipped in `2.4.0`
- [Source: CONTEXT D25](../../CONTEXT.md), [D34](../../CONTEXT.md)

## Verification commands

| AC | Command |
|---|---|
| AC-1, AC-2, AC-12 | `npx vitest run src/tools/authoring/get-draft-attachment.test.ts` |
| AC-3, AC-10 | `npx vitest run src/server.test.ts` |
| AC-4 – AC-6, AC-8 | `npx vitest run src/tools/authoring/list-draft-attachments.test.ts` |
| AC-7 | `grep -rn "ATTACHMENT_BUDGET_BYTES" src` prints nothing |
| AC-9 | `npx vitest run src/tools/authoring/get-draft.test.ts src/tools/authoring/write-result.test.ts` · `grep -rn "list_draft_attachments with filename" src` prints nothing |
| AC-11 | `SENTI_SMOKE_WRITES=1 npm run test:smoke` |

## Changelog entry

### Added
- `get_draft_attachment` — reads one indicator file by `draftId` and `attachmentId`, whole, in
  one request (Senti US-46.50).

### Changed
- `list_draft_attachments` is now an index. With `filename` omitted it returns every
  attachment's id, name, size and timestamps, with `sourceCode: null`; read a file with
  `get_draft_attachment`. With `filename` given it still returns that file whole. It no longer
  requests the attachment collection, which carries every body.
- Notes from `get_draft` and the draft write tools point at `get_draft_attachment` by id.

### Removed
- The 64 KiB attachment budget, and the cut note that could withhold a small file because a
  large one came first.

## Implementation notes

_Empty until work starts._

## Cross-references

- [EPIC-9](../epics/EPIC-9.md) · [US-9.1](US-9.1-list-drafts-summary-mode.md) ·
  [US-7.4](US-7.4-list-draft-attachments-tool.md) · [US-8.3](US-8.3-attachment-writes.md)
