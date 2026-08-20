---
id: US-7.3
title: "list_drafts tool"
epic: EPIC-7
status: done
priority: P1
points: 3
sprint: sprint-2026-W34
assignee: bluezdot
created: 2026-08-19
updated: 2026-08-20
version_shipped: 2.3.0
---

## Goal

A user asks "what am I working on" or "which of my drafts are broken". `GET /api/v1/drafts`
holds both answers and is **the largest payload this API can produce** — up to 10.3 MiB,
roughly 2.7 million tokens. This story ships the tool *and* the four cuts that make it
answerable inside a context window, plus the `notes` trace that stops a model from reading a
shortened list as a complete one.

## Background

Per the [design spec](../../superpowers/specs/2026-08-19-senti-authoring-read-tools-design.md)
§Tool surface, `list_drafts` reads `GET /api/v1/drafts` under `authoring:read` and lands in
`src/tools/authoring/list-drafts.ts`, beside
[US-7.2](US-7.2-get-draft-tool.md)'s `get-draft.ts`.

**The endpoint returns full source for every draft.** At the ceilings
[US-7.1](US-7.1-authoring-substrate-and-conventions-tool.md) publishes — `maxDrafts 20`,
`maxSourceBytes 196608`, `maxAttachmentsPerDraft 5`, `maxAttachmentBytes 65536` — plus a
16 KiB compile log each:

```
20 × (192 KiB + 5 × 64 KiB + 16 KiB) = 10.3 MiB ≈ 2,700,000 tokens
```

That is not a projection. It is arithmetic over limits the API publishes about itself.

### The four cuts

| Cut | What goes | Replaced by |
|---|---|---|
| 1 | `sourceCode` | `sourceBytes` |
| 2 | `attachments[].sourceCode` | `attachments[].sourceBytes` |
| 3 | `lastCompileLog` | — |
| 4 | `lastCompileDiagnostics` | `diagnosticsCount` |

Kept whole: `id`, `name`, `createdAt`, `updatedAt`, `lastCompileStatus`, `compiledUpToDate`,
`eaDefinitionId`, and `attachments[].{id, filename, createdAt}` — every field a caller
chooses *between* drafts on.

`logTruncated` is dropped with cut 3. It describes a field that is no longer there, and
carrying it would assert something about a log the reader cannot see.

**All four cuts lose information, so all four are noted** — unlike
`get_performance_breakdowns`, where three of five cuts were free
([CONTEXT D25](../../CONTEXT.md)). They are emitted as **one** sentence rather than four:
four notes describing one decision would train a reader to skim past all of them. `notes`
is still empty when the account holds no drafts, so its presence in the schema never implies
a cut occurred.

Measured live on 2026-08-19: **19,853 B → 1,898 B, 90.4% removed**, on an account holding
4 drafts and 0 attachments.

### Byte counting

`Buffer.byteLength(source, 'utf8')`, never `source.length`. MQL5 source carries comments and
comments carry non-ASCII — a UTF-16 code-unit count would understate a Vietnamese-commented
file by up to 3× and would be reported to the reader as bytes.

## Acceptance criteria

- [x] **AC-1** — **Given** a response containing `sourceCode`, **When** the tool returns,
  **Then** no draft `sourceCode` appears in `content` or `structuredContent`, **And** each
  draft carries `sourceBytes`.
- [x] **AC-2** — **Given** a response containing `attachments[].sourceCode`, **When** the
  tool returns, **Then** none appears in the output, **And** each attachment carries
  `sourceBytes`, `id`, `filename` and `createdAt`.
- [x] **AC-3** — **Given** a response containing `lastCompileLog` and `logTruncated`, **When**
  the tool returns, **Then** neither appears in the output.
- [x] **AC-4** — **Given** a response containing `lastCompileDiagnostics`, **When** the tool
  returns, **Then** the array does not appear, **And** `diagnosticsCount` carries its length.
- [x] **AC-5** — **Given** any non-empty response, **When** the tool returns, **Then** `notes`
  carries exactly one entry, **And** it states how many drafts and attachments were cut, how
  many KiB that removed, and names **both** `get_draft` and `list_draft_attachments` as the
  ways to read what was dropped, **And** the same sentence appears in `content`.
- [x] **AC-6** — **Given** an empty collection, **When** the tool returns, **Then** `notes` is
  the empty array, **And** `content` explains the empty result rather than returning nothing.
- [x] **AC-7** — **Given** attachment or source text containing non-ASCII characters, **When**
  `sourceBytes` is computed, **Then** it is the UTF-8 byte length.
- [x] **AC-8** — **Given** `lastCompileStatus: 'SUCCESS'` and `compiledUpToDate: true` on a
  draft, **When** the text is rendered, **Then** that draft is marked ready to register;
  **Given** either is otherwise, **Then** it is not.
- [x] **AC-9** — **Given** `lastCompileStatus: null`, **When** the text is rendered, **Then**
  it reads "never compiled" and the word `null` does not appear.
- [x] **AC-10** — **Given** the tool is registered, **When** `src/server.test.ts` runs,
  **Then** `list_drafts` appears in `TOOL_CALLS` and passes the read-only-annotation,
  output-schema and key-absence assertions.
- [x] **AC-11** — **Given** a `403` from the API, **When** the tool returns, **Then**
  `isError` is true and the text names the `authoring:read` scope.
- [x] **AC-12** — **Given** the tool's `inputSchema`, **When** it is inspected, **Then** it is
  empty — there is no parameter that requests the unshaped response.

## Tasks

- [x] **TASK-7.3.1** — **Measure the live collection before writing any shaping code**
  (AC: 1, 2, 3, 4, 5)
  - [x] Fetch `/api/v1/drafts` with the smoke key; record the raw byte size, the draft count,
        the attachment count, and the shaped size the four cuts would leave
  - [x] Write the numbers into §Implementation notes and compare against the 19,853 B →
        1,898 B (90.4%) the design spec measured. A materially different ratio earns a
        sentence explaining why — not a change to the cuts
  - [x] Confirm the collection's item shape still matches `DraftSchema` as
        [US-7.2](US-7.2-get-draft-tool.md) transcribed it. If the list item and the single
        read have diverged, **stop** — this story is built on them being the same object
- [x] **TASK-7.3.2** — `src/tools/authoring/list-drafts.ts` domain module (AC: 1–9, 12)
  - [x] `DraftSummarySchema` derived from `DraftSchema` by `.omit()` and `.extend()`, so a
        field added upstream cannot silently bypass the cut
  - [x] `parseDrafts` via `parseOrThrow` with subject `draft list`; `shapeDrafts`;
        `formatDrafts`
  - [x] One `notes` sentence covering all four cuts, with counts and KiB removed
  - [x] Empty-collection branch that explains itself and emits no note
- [x] **TASK-7.3.3** — Registration and the `2.3.0` release (AC: 10, 11, 12)
  - [x] Register through `registerReadTool`; path `/api/v1/drafts` (no parameter, so no
        `draftPath` and no `notFoundMeans`); `scope: 'authoring:read'`
  - [x] Tool description states that source, logs **and** diagnostics are all dropped, names
        both tools that return them, and says there is no option to request the unshaped
        response
  - [x] `src/server.ts` registration; `TOOL_CALLS` row in `src/server.test.ts`
  - [x] `VERSION`, `package.json`, `src/config.ts` `SERVER_VERSION` → `2.3.0` in lockstep;
        `docs/CHANGELOG.md` `## [2.3.0]`; `README.md` tool-table row; `AGENTS.md` tool count
        12 → 13
- [x] **TASK-7.3.4** — Append [CONTEXT D32](../../CONTEXT.md) and extend the smoke test
  (AC: 5)
  - [x] D32 records the measured ceiling, the live reduction, and that the cut is not
        optional
  - [x] `src/smoke.test.ts` parses the live collection through `parseDrafts` rather than
        casting it, so the smoke path exercises the schema instead of bypassing it

## Dev notes

### Architecture constraints

- **The summary schema is derived, not written.** `DraftSchema.omit({…}).extend({…})` means a
  field the API adds upstream appears in `DraftSchema` first and has to be dealt with
  explicitly — a hand-written summary schema would silently pass it through or silently drop
  it, and neither is visible in review.
- Imports `DraftSchema`, `AttachmentSummarySchema` and `byteLength` from
  [US-7.2](US-7.2-get-draft-tool.md)'s `get-draft.ts`. Declares no schema of its own beyond
  the derived summary and the output wrapper.

### Performance budget

This story's budget is **payload weight**, and it is the tightest in the epic.

- Shaped response must stay comfortably inside a normal host context window — working target
  **~5,000–7,000 tokens** at `maxDrafts` with 5 attachments each, against an unshaped
  ceiling of ~2,700,000. The revised figure counts both `content` and `structuredContent` —
  MCP returns a tool's result on both, and both reach the model — where the original
  ≤ 2,000-token target counted only one ([CONTEXT D34](../../CONTEXT.md)).
- The bound is structural rather than statistical: after the cuts, a draft's contribution is
  a fixed set of short scalars plus one short row per attachment. 20 drafts × 5 attachments
  cannot exceed a few thousand tokens however large the sources were.
- Measured by TASK-7.3.1 (raw and projected shaped), recorded as numbers, not adjectives.

### What we explicitly did NOT do

- **No parameter to request the unshaped payload.** The ceiling is 2.7 million tokens; an
  opt-out is a footgun with a documented safety catch. AC-12 asserts the input schema stays
  empty.
- **No source preview** — not the first N lines, not a head. A truncated MQL5 file reads as a
  complete one, and `sourceBytes` plus `get_draft` answers the same question without the
  hazard.
- **No pagination or filtering.** The API offers neither on this route; `maxDrafts: 20`
  bounds the collection, so a cursor would be a mechanism with nothing to page. Raised with
  the API instead, as a request for a summary mode.
- **No caching of a shaped response.** Out of scope for this epic, as for EPIC-2.

### Cross-story dependencies

- **Builds on** [US-7.1](US-7.1-authoring-substrate-and-conventions-tool.md) — the `limits`
  its TASK-7.1.1 measured are what the ceiling above is computed from.
- **Builds on** [US-7.2](US-7.2-get-draft-tool.md) — `DraftSchema`, `AttachmentSummarySchema`,
  `byteLength`.
- **Sibling of** [US-7.4](US-7.4-list-draft-attachments-tool.md) — both carry `notes`, and
  this story lands first, so US-7.4 reuses its phrasing rather than inventing a second
  vocabulary for the same idea.

### References

- [Source: design spec §Payload policy](../../superpowers/specs/2026-08-19-senti-authoring-read-tools-design.md) — the four cuts
- [Source: implementation plan Task 4](../../superpowers/plans/2026-08-19-senti-authoring-read-tools-w34.md)
- [Source: CONTEXT D25](../../CONTEXT.md) — a note records loss, not removal
- [Source: EPIC-7 §The payload problem](../epics/EPIC-7.md)

## Implementation notes

**TASK-7.3.1's live check held — the measurement matches the design spec exactly.** Run
2026-08-20 against `be-dev.sentitrade.xyz` with the smoke key, before any shaping code was
written:

```
raw 19853 B → shaped ~1898 B, 90.4% removed
draft count: 4
attachment count: 0
```

Byte-for-byte and percentage-for-percentage the same as the 19,853 B → 1,898 B (90.4%)
figure [CONTEXT D32](../../CONTEXT.md) already recorded on 2026-08-19 — the same account,
one day later, unchanged. No divergence to explain. The item shape was confirmed against
`DraftSchema` indirectly rather than by a standalone field-set dump: `npm run test:smoke`
now runs the live collection through `parseDrafts` (TASK-7.3.4), and that call succeeding
against the real response is the shape check TASK-7.3.1's third bullet asks for — a
schema mismatch would have failed the suite, not passed it silently.

**D32 was read, not appended.** [CONTEXT D32](../../CONTEXT.md) was written on 2026-08-19,
before this story's implementation began, and already states the four cuts and the
19,853 B → 1,898 B / 90.4% figure this run reproduced. `CONTEXT.md` is append-only and a
second `D32` would break the ID graph `npm run agile:validate` checks, so per this task's
instructions the existing entry was read and checked against what actually shipped rather
than duplicated: it matches — same four cuts, same one-note shape, same measured reduction.
No concern to raise.

**The brief's Step 5 said "PASS, 18 tests"; the test block it describes defines 17** (3
`describe('parseDrafts', …)` + 8 `describe('shapeDrafts', …)` + 6
`describe('formatDrafts', …)`). `npx vitest run src/tools/authoring/list-drafts.test.ts`
reports 17 passed, 0 failed — the test block, not the prose count, was treated as
authoritative, per this task's explicit instruction.

**Registration order in `src/server.ts`** is now `registerGetAuthoringConventions` →
`registerListDrafts` → `registerGetDraft`, so the file reads conventions → list → read
inside the `authoring/` group, ahead of the alphabetically-later domains. The
`TOOL_CALLS` row in `src/server.test.ts` was placed at the matching position (between
`get_authoring_conventions` and `get_draft`) for the same reason, and carries no
`arguments` key — `list_drafts` takes no parameters, so the path-traversal test's
`SEGMENT_KEYS` scan (`['accountId', 'draftId']`) correctly finds nothing to exercise for
this row.

**Nothing was deliberately skipped.** Every step in the brief (measurement, TDD red/green,
registration, smoke-test extension, version bump in all three files plus the lockfile,
CHANGELOG, README, AGENTS.md, story/sprint/epic status, and all six gates) was carried
out as specified. `POST /drafts/{draftId}/compile`, `POST /drafts`, and every other
authoring write endpoint were never called, consistent with the epic-wide read-only
constraint.
