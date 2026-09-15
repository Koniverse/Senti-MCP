---
id: US-9.1
title: "list_drafts adopts the drafts summary mode"
epic: EPIC-9
status: in-progress
priority: P0
points: 2
sprint: sprint-2026-W38
assignee: bluezdot
created: 2026-09-14
updated: 2026-09-15
---

## Story refresh — 2026-09-15

After re-checking the served document and the live API on 2026-09-15
([EPIC-9](../epics/EPIC-9.md) §Re-checked — 2026-09-15), the following were locked into this
story:

- **Senti US-46.49 is deployed, and `list_drafts` `2.8.1` is broken in production.** Observed:
  `parseDrafts` throws at `0.sourceCode` against `api.sentitrade.xyz`.
- **The published `DraftSummary` has a field the hand-off did not: `compileLogBytes`**
  (`int32` | `null`). Senti added it in review because `logTruncated` is `false` for any log
  under 16 KiB, so a `FAILED` compile with no parsed diagnostics showed no output. Transcribed
  in AC-2, rendered by AC-13.
- **The full-shape fallback is withdrawn (AC-3).** It existed so a release here would be safe
  while the API still served full drafts; it no longer does. It could not have been faithful
  either: from a full `Draft` the adapter sees only the trailing 16 KiB of the log, so it cannot
  compute `compileLogBytes` for a truncated one. Points 3 → 2.
- AC-11's measurements were taken; see §Implementation notes.

## Goal

`list_drafts` works again now that Senti returns summaries by default from `GET /api/v1/drafts`
— and stops pulling up to 10 MiB of MQL5 across the wire only to throw it away. The tool asks
for `view=summary` and returns the server's summary as its own output.

## Background

### Why it broke

Senti US-46.49 makes `GET /api/v1/drafts` return an array of `DraftSummary` when `view` is
absent or `summary`; `view=full` returns the pre-change `Draft` array. An unknown, repeated or
wrongly-cased `view` is `400 INVALID_BODY`; unrelated query parameters are ignored.

`parseDrafts` (`src/tools/authoring/list-drafts.ts:27-29`) parses the response as
`z.array(DraftSchema)` through `parseOrThrow`, which accepts everything or nothing. Two things
in a summary fail it, independently:

- `DraftSchema` (`get-draft.ts:22-35`) requires `sourceCode`, `lastCompileLog` and
  `lastCompileDiagnostics`. A summary carries none of them.
- Every `attachments[]` item is parsed by `AttachmentSchema` (`get-draft.ts:7-12`), which
  requires `sourceCode`. A summary attachment carries none.

So every call fails with the "API may have changed" message — observed live on 2026-09-15 —
and so does the `list_drafts` leg of `src/smoke.test.ts:71`.

### The published summary

Transcribed from `components.schemas.DraftSummary` and `DraftAttachmentSummary` as served on
2026-09-15. Every field is required.

```jsonc
// DraftSummary
{
  "id": "uuid",
  "name": "string",
  "sourceBytes": 196608,            // int32 — UTF-8 bytes of sourceCode
  "sourceSha256": "hex64",          // lowercase hex SHA-256 of the UTF-8 sourceCode
  "createdAt": "date-time", "updatedAt": "date-time",
  "lastCompileStatus": "SUCCESS" | "FAILED" | null,
  "compileLogBytes": 20480 | null,  // int32 — UTF-8 size of the last compile log; null when none
  "logTruncated": true,             // the log a fetch returns is only its trailing 16 KiB
  "diagnosticsCount": 20,           // int32
  "compiledUpToDate": false,
  "eaDefinitionId": "uuid" | null,
  "attachments": [                  // DraftAttachmentSummary
    { "id": "uuid", "filename": "Ind1.mq5", "sourceBytes": 65536,
      "createdAt": "date-time", "updatedAt": "date-time" }
  ]
}
```

`sourceBytes` and `diagnosticsCount` are the names this repo's `DraftSummarySchema` already
emits, on purpose. The server adds `sourceSha256`, `compileLogBytes`, `logTruncated` and
per-attachment `updatedAt`. The `listDrafts` description says what `compileLogBytes` is for:
*"A non-null `compileLogBytes` means the last compile left a log to fetch — even when
`diagnosticsCount` is 0."*

Senti measured, on a 20-draft account seeded at every published cap: summary **24,221 B**,
`view=full` **10,879,661 B** — 449× (before `compileLogBytes` added ~24 B per draft). On this
repo's smoke account — 4 drafts, no attachments — it is 1,616 B against 22,459 B, 13.9×.

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
- **`shapeDrafts` goes entirely** — the cut, the note accounting and `summarise`. The server's
  summary *is* the output.

`PENDING` never had a writer — compile is synchronous and returns the finished result — and
US-46.49 removed it from both published enums; the served document no longer contains the
string. It leaves `DraftSchema` (`get-draft.ts:28`) and `DraftWriteOutputSchema`
(`write-result.ts:24`) here too.

## Acceptance criteria

- [x] **AC-1** — **Given** the tool is called, **When** it requests the collection, **Then** the
  request is `GET /api/v1/drafts?view=summary` under `authoring:read`, **And** no code path in
  `src/` requests `view=full`.
- [x] **AC-2** — **Given** a response of `DraftSummary` items, **When** the tool returns,
  **Then** each entry in `structuredContent.drafts` carries `id`, `name`, `sourceBytes`,
  `sourceSha256`, `createdAt`, `updatedAt`, `lastCompileStatus`, `compileLogBytes`,
  `logTruncated`, `diagnosticsCount`, `compiledUpToDate` and `eaDefinitionId`, **And** each
  attachment carries `id`, `filename`, `sourceBytes`, `createdAt` and `updatedAt`.
- **AC-3** — *Withdrawn 2026-09-15* — the full-shape fallback. See §Story refresh. The number
  stays so later references hold.
- [x] **AC-4** — **Given** a payload that is not an array of summaries — an array of full drafts
  included — **When** it is parsed, **Then** the tool returns `isError: true` with the "API may
  have changed" message naming `draft list`.
- [x] **AC-5** — **Given** any response, **When** the tool returns, **Then** `notes` is `[]`,
  **And** `DraftsOutputSchema` still declares `notes`.
- [x] **AC-6** — **Given** the tool description and the README row, **When** they are read,
  **Then** neither describes a cut or says "There is no option to request the unshaped
  response"; both say the list carries sizes and hashes rather than bodies, and name
  `get_draft` for one draft's source.
- [x] **AC-7** — **Given** an empty collection, **When** the text renders, **Then** it explains
  the empty result without claiming "this server has no write tools" (false since `2.5.0`).
- [ ] **AC-8** — `grep -rn PENDING src` prints nothing.
- [ ] **AC-9** — **Given** `npm run test:smoke`, **When** the live leg runs, **Then** the
  collection parses through `parseDrafts` and renders, **And** stderr records its raw byte size.
- [x] **AC-10** — **Given** the tool's `inputSchema`, **When** it is inspected, **Then** it is
  empty.
- [x] **AC-11** — **Given** US-46.49 is deployed on the smoke host, **When** it is probed,
  **Then** §Implementation notes records the summary and `view=full` byte sizes of the smoke
  account, **And** the status and envelope code returned for `view=bogus`.
- [x] **AC-12** — **Given** `src/server.test.ts`, **When** it runs, **Then** `list_drafts` still
  passes the read-only-annotation, output-schema and key-absence assertions, with the stub
  answering `/api/v1/drafts?view=summary`.
- [x] **AC-13** — **Given** a draft whose `compileLogBytes` is not `null`, **When** the text
  renders, **Then** it states the log's size — including when `diagnosticsCount` is 0 — and names
  `get_draft` as where to read it; **Given** `null`, **Then** no log line is rendered.

## Tasks

- [x] **TASK-9.1.1** — Transcribe the published summary (AC: 2)
  - [x] Run [EPIC-9](../epics/EPIC-9.md) §Deploy check — 2026-09-15,
        `DraftSummary: true compile-log: true`
  - [x] Transcribe `DraftSummary` and `DraftAttachmentSummary` field by field; re-read the
        document on the day, in case either has moved since 2026-09-15
- [x] **TASK-9.1.2** — Schemas and parsing in `src/tools/authoring/list-drafts.ts` (AC: 2, 4)
  - [x] Replace the derived `DraftSummarySchema` (`:8-18`) with the transcription; `int32` fields
        as `z.number().int()`
  - [x] `parseDrafts`: `z.array(DraftSummarySchema)` through `parseOrThrow`
- [x] **TASK-9.1.3** — Delete the cut, and render the log size (AC: 5, 6, 7, 13)
  - [x] `summarise` and `shapeDrafts` (`:31-101`) go; `notes` is the literal `[]`
  - [x] `formatDrafts`: drop the `Notes` branch; rewrite the empty-collection text (`:130-131`);
        add the compile-log line to `block`
  - [x] Tool description (`:154-162`) and `README.md`'s `list_drafts` row
- [x] **TASK-9.1.4** — Ask for summaries (AC: 1, 10, 12)
  - [x] `client.get('/api/v1/drafts', { signal, scope, query: { view: 'summary' } })`
  - [x] The `src/server.test.ts` fetch stub answers the new URL with a summary
- [ ] **TASK-9.1.5** — Drop `PENDING` (AC: 8)
  - [ ] `get-draft.ts:28`, `write-result.ts:24`, and any test fixture that uses it
- [x] **TASK-9.1.6** — Tests (AC: 2, 4, 5, 7, 13)
  - [x] `list-drafts.test.ts`: the 13-test `shapeDrafts` block (`:63-167`) is replaced by parse
        tests over a summary fixture — `compileLogBytes` both `null` and not — and one that
        rejects a full-draft payload
  - [x] The two `formatDrafts` tests about notes (`:198`, `:202`) go with the branch
- [ ] **TASK-9.1.7** — Smoke (AC: 9)
  - [ ] `src/smoke.test.ts:71-72` requests `view: 'summary'`, parses, renders, and logs the raw
        byte size to stderr
- [x] **TASK-9.1.8** — After the deploy, measure (AC: 11)
  - [x] Summary vs `view=full` bytes on the smoke account, and `view=bogus`'s status and
        envelope code, into §Implementation notes
- [ ] **TASK-9.1.9** — Record and release (AC: all)
  - [x] `docs/CONTEXT.md`: the next free `D<N>` (D49 as of 2026-09-15), revising
        [D32](../../CONTEXT.md) — the cut moved to the server; `notes` stays, empty, until a
        major version removes it; and why no full-shape fallback ships
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
- **No full-shape fallback.** Withdrawn 2026-09-15 (§Story refresh). If the API ever serves
  full drafts by default again, the tool fails loudly with the "API may have changed" message,
  which is the honest report of a contract that moved back.
- `list_drafts` no longer imports `DraftSchema`, `AttachmentSummarySchema` or `byteLength` from
  `get-draft.ts`.

### Cross-story dependencies

- **Required by** [US-9.2](US-9.2-get-draft-attachment-tool.md) — its attachment index reads
  `parseDrafts`' output rather than `GET …/attachments`.
- **Required by** [US-9.3](US-9.3-get-draft-compile-log-tool.md) — which repoints AC-13's
  compile-log line from `get_draft` to `get_draft_compile_log`.
- **Sibling of** [US-9.4](US-9.4-typed-diagnostics-and-path-segments.md) — both edit
  `DraftSchema` in `get-draft.ts` (this story line 28, that one line 31). Land this one first.
  Once this ships, `list_drafts` no longer parses `DraftSchema`, so US-9.4's stricter parse
  cannot reach it.
- **External**: Senti US-46.49 — deployed, 2026-09-15.

### Performance budget

- **Wire**: from the full collection (10,879,661 B at every cap, per Senti) to the summary
  (~24.7 KB at every cap). Measured here: 22,459 B → 1,616 B on 4 drafts with no attachments.
- **Output**: essentially unchanged from [US-7.3](US-7.3-list-drafts-tool.md)'s
  ~5,000–7,000 tokens at `maxDrafts`, counting both channels
  ([CONTEXT D34](../../CONTEXT.md)). `sourceSha256` adds 64 characters per draft, twice.

### What we explicitly did NOT do

- **No `view` parameter on the tool.** D32's refusal stands; AC-10 asserts it.
- **No removal of `notes`.** It is a published output field; see [EPIC-9](../epics/EPIC-9.md)
  §Semver posture.
- **No full-shape fallback.** Trigger to restore one: the API serving full drafts by default
  again.
- **No use of `sourceSha256` beyond passing it through.** Comparing it to a local file to
  answer "is my copy current" is a plausible later tool, not this story.

### References

- [Source: EPIC-9 §The hand-off, checked, and §Re-checked — 2026-09-15](../epics/EPIC-9.md)
- [Source: CONTEXT D32](../../CONTEXT.md) — the cut this story moves to the server
- [Source: CONTEXT D25](../../CONTEXT.md) — a note records loss, not removal
- [Source: US-7.3](US-7.3-list-drafts-tool.md) — the tool as shipped in `2.3.0`

## Verification commands

| AC | Command |
|---|---|
| AC-1, AC-12 | `npx vitest run src/server.test.ts` · `grep -rn "view: 'full'\|view=full" src` prints nothing |
| AC-2, AC-4 – AC-7, AC-10, AC-13 | `npx vitest run src/tools/authoring/list-drafts.test.ts` |
| AC-8 | `grep -rn PENDING src` prints nothing |
| AC-9 | `npm run test:smoke` — the `[smoke] drafts` line |
| AC-11 | Read §Implementation notes |
| all | `npm run typecheck && npm test` |

## Changelog entry

### Fixed
- `list_drafts` works again. The Senti API now returns draft summaries by default (Senti
  US-46.49), and `2.8.1` failed on every call against them.

### Changed
- `list_drafts` requests `?view=summary`, so the server no longer sends up to 10 MiB of source
  for this tool to discard.
- `list_drafts` output adds `sourceSha256`, `compileLogBytes`, `logTruncated` and
  `attachments[].updatedAt`, and the text states each compile log's size. `notes` is kept and is
  now always empty.

### Removed
- `PENDING` from `lastCompileStatus` in `get_draft`, `list_drafts` and the draft write tools.
  No server ever sent it, and the API no longer declares it.

## Implementation notes

### Pre-start live check — 2026-09-15

Taken during the planning pass, before any code, with the smoke key and read-only requests
against `api.sentitrade.xyz`.

| Request | Result |
|---|---|
| `GET /api/v1/drafts` (no `view`) | `200`, **1,616 B**, 13 keys per item — the published `DraftSummary` |
| `2.8.1`'s `parseDrafts` on it | throws: *unexpected shape for the draft list at "0.sourceCode"* |
| `?view=summary` | `200`, 1,616 B, byte-identical to the default |
| `?view=full` | `200`, **22,459 B** — still parses under `2.8.1`'s schema |
| `?view=bogus` | `400 INVALID_BODY` |
| `?view=summary&view=full` | `400 INVALID_BODY` |
| `?view=FULL` | `400 INVALID_BODY` — the value is case-sensitive |
| `?foo=bar` | `200` — ignored |

Summary vs full on this account: **13.9×** (22,459 / 1,616). The account holds no attachments,
so the ratio says nothing about attachment bodies. Of its 4 drafts, 2 are `SUCCESS` with a
2,425-byte log and 2 have never compiled (`compileLogBytes: null`); every `logTruncated` is
`false` and every `diagnosticsCount` is 0 — so AC-13's "log with no diagnostics" case is the
live case here, not an edge.

The document's `400` for `listDrafts` says only *"`view` is not `summary` or `full`, or was sent
more than once"*; the envelope code `INVALID_BODY` is the service's, observed here.

## Cross-references

- [EPIC-9](../epics/EPIC-9.md)
- [sprint-2026-W38](../sprint-2026-W38.md)
- [US-7.3](US-7.3-list-drafts-tool.md) · [CONTEXT D32](../../CONTEXT.md)
