---
id: US-9.1
title: "list_drafts adopts the drafts summary mode"
epic: EPIC-9
status: ready
priority: P0
points: 3
sprint: sprint-2026-W38
assignee: bluezdot
created: 2026-09-14
updated: 2026-09-14
---

## Goal

`list_drafts` keeps working when Senti changes `GET /api/v1/drafts` to return summaries by
default — and, once it has, stops pulling up to 10 MiB of MQL5 across the wire only to throw it
away. The tool asks for `view=summary`, returns the server's summary as its own output, and
still accepts the full shape from an environment that has not deployed, so this release is safe
whichever side lands first.

## Background

### Why it breaks

Senti US-46.49 makes `GET /api/v1/drafts` return an array of `DraftSummary` when `view` is
absent or `summary`; `view=full` returns today's `Draft` array, byte-identical to the
pre-change response. An unknown or repeated `view` is `400 INVALID_BODY`; unrelated query
parameters are ignored.

`parseDrafts` (`src/tools/authoring/list-drafts.ts:27-29`) parses the response as
`z.array(DraftSchema)` through `parseOrThrow`, which accepts everything or nothing. Two things
in a summary fail it, independently:

- `DraftSchema` (`get-draft.ts:22-35`) requires `sourceCode`, `lastCompileLog` and
  `lastCompileDiagnostics`. A summary carries none of them.
- Every `attachments[]` item is parsed by `AttachmentSchema` (`get-draft.ts:7-12`), which
  requires `sourceCode`. A summary attachment carries none.

So every call fails with the "API may have changed" message, and so does the `list_drafts` leg
of `src/smoke.test.ts:71`.

### State on 2026-09-14

**Not deployed on either host** ([EPIC-9](../epics/EPIC-9.md) §The hand-off, checked). The Senti
owner deploys first; this story is committed to W38 so it is ready when the deploy lands rather
than started after it. [EPIC-9](../epics/EPIC-9.md) §Deploy check is the command that tells.

### The summary, as handed off

```jsonc
// DraftSummary — every body replaced by its size
{
  "id": "uuid",
  "name": "string",
  "sourceBytes": 196608,            // UTF-8 bytes of sourceCode
  "sourceSha256": "hex64",          // lowercase hex SHA-256 of the UTF-8 sourceCode
  "createdAt": "ISO-8601", "updatedAt": "ISO-8601",
  "lastCompileStatus": "SUCCESS" | "FAILED" | null,
  "logTruncated": true,             // the last compile log exceeds 16 KiB
  "diagnosticsCount": 20,
  "compiledUpToDate": false,
  "eaDefinitionId": "uuid" | null,
  "attachments": [                  // DraftAttachmentSummary
    { "id": "uuid", "filename": "Ind1.mq5", "sourceBytes": 65536,
      "createdAt": "ISO-8601", "updatedAt": "ISO-8601" }
  ]
}
```

The field names match what this repo's `DraftSummarySchema` already emits (`sourceBytes`,
`diagnosticsCount`) on purpose; the server adds `sourceSha256`, `logTruncated` and
per-attachment `updatedAt`. **This shape is from the hand-off, not the served document**, which
does not carry it yet. TASK-9.1.1 transcribes the published component when it appears, and any
difference is resolved in the document's favour ([EPIC-9](../epics/EPIC-9.md) §Cross-cutting
invariants).

Senti measured, on a 20-draft account at every published cap: summary **24,221 B**, `view=full`
**10,879,661 B** — 449×. Not reproduced here; the smoke account holds 4 drafts.

### What changes in the tool's contract

[CONTEXT D32](../../CONTEXT.md) made the four cuts non-optional and reported them in one
`notes` sentence. The cut now happens on the server, so:

- **`notes` stays in the output schema and is always `[]`.** Under
  [CONTEXT D25](../../CONTEXT.md) a note records information the tool lost, and a summary
  route loses nothing the tool received. Removing the field would change a published output
  schema, which [EPIC-9](../epics/EPIC-9.md) §Semver posture reserves for a major version.
- **The input schema stays empty.** There is still no parameter that requests `view=full`, for
  D32's reason: a model with an escape hatch will use it. `get_draft` remains the way to read
  one draft whole.
- **The full shape is still accepted**, converted to the same summary, so a host that has not
  deployed US-46.49 — or a `be-dev` that lags production — still works. That adapter is all
  that remains of `shapeDrafts`.

`PENDING` never had a writer — compile is synchronous and returns the finished result — and
US-46.49 removes it from `lastCompileStatus`. It leaves `DraftSchema` (`get-draft.ts:28`) and
`DraftWriteOutputSchema` (`write-result.ts:24`) here too. That is safe in either order, because
no server sends it.

## Acceptance criteria

- [ ] **AC-1** — **Given** the tool is called, **When** it requests the collection, **Then** the
  request is `GET /api/v1/drafts?view=summary` under `authoring:read`, **And** no code path in
  `src/` requests `view=full`.
- [ ] **AC-2** — **Given** a response of `DraftSummary` items, **When** the tool returns,
  **Then** each entry in `structuredContent.drafts` carries the published `DraftSummary` fields
  and each attachment the published `DraftAttachmentSummary` fields, **And** the text renders
  them as today's does.
- [ ] **AC-3** — **Given** a response of full `Draft` items (a server that ignores `view`),
  **When** the tool returns, **Then** the output has exactly AC-2's shape: `sourceBytes` and
  every attachment's `sourceBytes` are UTF-8 byte counts, `sourceSha256` is the lowercase hex
  SHA-256 of the UTF-8 source, `diagnosticsCount` is the array's length, `logTruncated` is
  passed through, **And** no `sourceCode`, `lastCompileLog` or `lastCompileDiagnostics` appears
  in `content` or `structuredContent`.
- [ ] **AC-4** — **Given** a payload that is neither an array of summaries nor an array of full
  drafts, **When** it is parsed, **Then** the tool returns `isError: true` with the "API may
  have changed" message naming `draft list`.
- [ ] **AC-5** — **Given** any response, **When** the tool returns, **Then** `notes` is `[]`,
  **And** `DraftsOutputSchema` still declares `notes`.
- [ ] **AC-6** — **Given** the tool description and the README row, **When** they are read,
  **Then** neither describes a cut or says "There is no option to request the unshaped
  response"; both say the list carries sizes and hashes rather than bodies, and name
  `get_draft` for one draft's source.
- [ ] **AC-7** — **Given** an empty collection, **When** the text renders, **Then** it explains
  the empty result without claiming "this server has no write tools" (false since `2.5.0`).
- [ ] **AC-8** — `grep -rn PENDING src` prints nothing.
- [ ] **AC-9** — **Given** `npm run test:smoke`, **When** the live leg runs, **Then** the
  collection parses through `parseDrafts` and renders, **And** stderr records which shape the
  server returned and the raw byte size.
- [ ] **AC-10** — **Given** the tool's `inputSchema`, **When** it is inspected, **Then** it is
  empty.
- [ ] **AC-11** — **Given** US-46.49 is deployed on the smoke host, **When** it is probed,
  **Then** §Implementation notes records the summary and `view=full` byte sizes of the smoke
  account, **And** the status and envelope code returned for `view=bogus`.
- [ ] **AC-12** — **Given** `src/server.test.ts`, **When** it runs, **Then** `list_drafts` still
  passes the read-only-annotation, output-schema and key-absence assertions, with the stub
  answering `/api/v1/drafts?view=summary`.

## Tasks

- [ ] **TASK-9.1.1** — Check the deploy, and transcribe the published summary (AC: 2, 11)
  - [ ] Run [EPIC-9](../epics/EPIC-9.md) §Deploy check against both hosts; record the output
  - [ ] Deployed: transcribe `components.schemas.DraftSummary` and `DraftAttachmentSummary`
        field by field; diff against the hand-off shape above and record any difference
  - [ ] Not deployed: build against the hand-off shape, and repeat this task before the release
        commit — the release does not ship on an untranscribed schema
- [ ] **TASK-9.1.2** — Schemas and parsing in `src/tools/authoring/list-drafts.ts` (AC: 2, 3, 4)
  - [ ] Replace the derived `DraftSummarySchema` (`:8-18`) with the transcribed component, and
        its attachment item likewise
  - [ ] `parseDrafts`: `z.union([z.array(DraftSummarySchema), z.array(DraftSchema)])` through
        `parseOrThrow`, summaries first
  - [ ] `toSummary(draft: Draft)` — the full-shape adapter; SHA-256 via `node:crypto`
        `createHash('sha256')` over the UTF-8 bytes, lowercase hex
- [ ] **TASK-9.1.3** — Delete the cut accounting (AC: 5, 6, 7)
  - [ ] `shapeDrafts`' note machinery (`:52-101`) goes; `notes` is the literal `[]`
  - [ ] `formatDrafts`: drop the `Notes` branch; rewrite the empty-collection text (`:130-131`)
  - [ ] Tool description (`:154-162`) and `README.md`'s `list_drafts` row
- [ ] **TASK-9.1.4** — Ask for summaries (AC: 1, 10, 12)
  - [ ] `client.get('/api/v1/drafts', { signal, scope, query: { view: 'summary' } })`
  - [ ] The `src/server.test.ts` fetch stub answers the new URL
- [ ] **TASK-9.1.5** — Drop `PENDING` (AC: 8)
  - [ ] `get-draft.ts:28`, `write-result.ts:24`, and any test fixture that uses it
- [ ] **TASK-9.1.6** — Tests (AC: 2, 3, 4, 5, 7)
  - [ ] `list-drafts.test.ts`: the 13-test `shapeDrafts` block (`:63-167`) is replaced by tests
        over both shapes, including a non-ASCII source for the byte count and a known SHA-256
  - [ ] The two `formatDrafts` tests about notes (`:198`, `:202`) go with the branch
- [ ] **TASK-9.1.7** — Smoke (AC: 9)
  - [ ] `src/smoke.test.ts:71-72` calls the tool's path with `view: 'summary'`; logs the shape
        (`summary` / `full`) and the raw byte size to stderr
- [ ] **TASK-9.1.8** — After the deploy, measure (AC: 11)
  - [ ] Summary vs `view=full` bytes on the smoke account, and `view=bogus`'s status and
        envelope code, into §Implementation notes
- [ ] **TASK-9.1.9** — Record and release (AC: all)
  - [ ] `docs/CONTEXT.md`: the next free `D<N>` (D48 as of 2026-09-14), revising
        [D32](../../CONTEXT.md) — the cut moved to the server; `notes` stays, empty, until a
        major version removes it
  - [ ] Bump the version in all five places (`VERSION`, `package.json`, `package-lock.json`,
        `SERVER_VERSION`, the tag) — a minor, per [EPIC-9](../epics/EPIC-9.md) §Semver posture;
        `docs/CHANGELOG.md` from §Changelog entry below; `AGENTS.md` §Current state
  - [ ] Walk [docs/RELEASE.md](../../RELEASE.md)

## Dev notes

### Architecture constraints

- **The output item is the published component, transcribed — no longer derived from
  `DraftSchema`.** [US-7.3](US-7.3-list-drafts-tool.md) derived it so a field added upstream
  would have to be dealt with explicitly. That reason now points the other way: the server owns
  the summary, a field Senti adds to `DraftSummary` is transcribed here, and a field added to
  `Draft` no longer reaches `list_drafts` at all.
- **Per-payload union, not per-item.** A server returns one shape or the other. An array that
  mixes them is a server defect, and accepting it would hide one.
- **The full-shape adapter is a compatibility shim with a deletion trigger**: both hosts serve
  `DraftSummary`, and one release has shipped against them. Its removal can ride any later
  story; it does not need its own.
- `byteLength` stays in `get-draft.ts` and is imported, as today.

### Cross-story dependencies

- **Required by** [US-9.2](US-9.2-get-draft-attachment-tool.md) — its attachment index reads
  `parseDrafts`' output rather than `GET …/attachments`.
- **Sibling of** [US-9.4](US-9.4-typed-diagnostics-and-path-segments.md) — both edit
  `DraftSchema` in `get-draft.ts` (this story line 28, that one line 31). Land this one first.
- **External**: Senti US-46.49. Not blocking — AC-3 is what makes that true — but AC-11 waits
  on the deploy.

### Performance budget

- **Wire**: from the full collection (up to ~10.4 MiB) to the summary (~24 KB at every cap,
  per Senti). Parsing cost falls by the same order.
- **Output**: essentially unchanged from [US-7.3](US-7.3-list-drafts-tool.md)'s
  ~5,000–7,000 tokens at `maxDrafts`, counting both channels
  ([CONTEXT D34](../../CONTEXT.md)). `sourceSha256` adds 64 characters per draft, twice.

### What we explicitly did NOT do

- **No `view` parameter on the tool.** D32's refusal stands; AC-10 asserts it.
- **No removal of `notes`.** It is a published output field; see [EPIC-9](../epics/EPIC-9.md)
  §Semver posture.
- **No use of `sourceSha256` beyond passing it through.** Comparing it to a local file to
  answer "is my copy current" is a plausible later tool, not this story.

### References

- [Source: EPIC-9 §The hand-off, checked](../epics/EPIC-9.md)
- [Source: CONTEXT D32](../../CONTEXT.md) — the cut this story moves to the server
- [Source: CONTEXT D25](../../CONTEXT.md) — a note records loss, not removal
- [Source: US-7.3](US-7.3-list-drafts-tool.md) — the tool as shipped in `2.3.0`

## Verification commands

| AC | Command |
|---|---|
| AC-1, AC-12 | `npx vitest run src/server.test.ts` · `grep -rn "view: 'full'\|view=full" src` prints nothing |
| AC-2 – AC-7, AC-10 | `npx vitest run src/tools/authoring/list-drafts.test.ts` |
| AC-8 | `grep -rn PENDING src` prints nothing |
| AC-9 | `npm run test:smoke` — the `[smoke] drafts` line names the shape and the byte size |
| AC-11 | Read §Implementation notes |
| all | `npm run typecheck && npm test` |

## Changelog entry

### Fixed
- `list_drafts` works against a server that returns draft summaries by default (Senti
  US-46.49). Without this release it fails on every call once that deploy lands.

### Changed
- `list_drafts` requests `?view=summary`, so the server no longer sends up to 10 MiB of source
  for this tool to discard. A server that still returns full drafts is converted to the same
  output.
- `list_drafts` output adds `sourceSha256`, `logTruncated` and `attachments[].updatedAt`.
  `notes` is kept and is now always empty.

### Removed
- `PENDING` from `lastCompileStatus` in `get_draft`, `list_drafts` and the draft write tools.
  No server ever sent it.

## Implementation notes

_Empty until work starts._

## Cross-references

- [EPIC-9](../epics/EPIC-9.md)
- [sprint-2026-W38](../sprint-2026-W38.md)
- [US-7.3](US-7.3-list-drafts-tool.md) · [CONTEXT D32](../../CONTEXT.md)
