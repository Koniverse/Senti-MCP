---
id: US-9.3
title: "get_draft_compile_log tool"
epic: EPIC-9
status: backlog
priority: P2
points: 2
sprint:
assignee: bluezdot
created: 2026-09-14
updated: 2026-09-14
---

## Goal

A model reads why a draft failed to compile without downloading the draft. Today the only way to
the last compile log is `get_draft`, which carries up to 192 KiB of EA source with it; this tool
returns the log alone — at most 16 KiB.

## Background

Senti US-46.49 — **not deployed on 2026-09-14** ([EPIC-9](../epics/EPIC-9.md) §Deploy check) —
adds `GET /api/v1/drafts/{draftId}/compile-log`, `operationId: getDraftCompileLog`, scope
`authoring:read`. As handed off, it returns `{ "log": string | null, "logTruncated": boolean }`:
the trailing 16 KiB of the last compile's output, and `null` for a draft that has never
compiled. A missing or cross-owner id is `404 NOT_FOUND`, with one identical body for both.

**That shape is the hand-off's, not the document's.** The route is not in the served document
yet; TASK-9.3.1 transcribes it when it is.

`get_draft`'s description today states the cost of reading a log its way: *"a draft may hold up
to 192 KiB of source plus 16 KiB of compiler log, and this server returns that content twice
… roughly 105,000 tokens worst case."* `get_draft` stays the way to read source and
diagnostics; this tool is the cheap way to read the log.

`lastCompileDiagnostics` is the machine-readable, never-truncated form of the same failure
(the `GET /drafts/{draftId}` description says *"parse that"*). The log is what a human reads,
and it ends with MetaEditor's `Result:` summary — which is why the server keeps the **tail**.

## Acceptance criteria

- [ ] **AC-1** — **Given** a `draftId`, **When** the tool runs, **Then** it requests
  `draftPath(draftId, 'compile-log')` under `authoring:read`, **And** returns `log` and
  `logTruncated`.
- [ ] **AC-2** — **Given** `log: null`, **When** the text renders, **Then** it says the draft has
  never been compiled, **And** the word `null` does not appear.
- [ ] **AC-3** — **Given** `logTruncated: true`, **When** the text renders, **Then** it says this
  is the tail of the log only.
- [ ] **AC-4** — **Given** a `404`, **When** the tool returns, **Then** `isError` is true with the
  `DRAFT_NOT_FOUND` guidance.
- [ ] **AC-5** — **Given** `src/server.test.ts`, **When** it runs, **Then**
  `get_draft_compile_log` is in `TOOL_CALLS` and passes the read-only-annotation, output-schema
  and key-absence assertions, **And** the read tool count is 16.
- [ ] **AC-6** — **Given** `get_draft`'s description, **When** it is read, **Then** it names
  `get_draft_compile_log` as the way to read only the log.
- [ ] **AC-7** — **Given** the served document, **When** the schema is written, **Then** it
  transcribes the published response, **And** any difference from the hand-off shape is
  recorded in §Implementation notes.
- [ ] **AC-8** — **Given** `SENTI_SMOKE_WRITES=1`, **When** the write smoke compiles its draft,
  **Then** it reads that draft's log through this tool and asserts it is not `null`.

## Tasks

- [ ] **TASK-9.3.1** — Wait for the route, then transcribe it (AC: 7)
  - [ ] [EPIC-9](../epics/EPIC-9.md) §Deploy check prints `compile-log: true` on the smoke host
  - [ ] Transcribe the `200` response — as a named component if the document publishes one
- [ ] **TASK-9.3.2** — `src/tools/authoring/get-draft-compile-log.ts` (AC: 1, 2, 3, 4)
  - [ ] `registerReadTool`, `notFoundMeans: DRAFT_NOT_FOUND`; `src/server.ts` registration
- [ ] **TASK-9.3.3** — Descriptions (AC: 6)
  - [ ] `get-draft.ts`' description names this tool; the README row for both
- [ ] **TASK-9.3.4** — Tests and smoke (AC: 2, 3, 5, 8)
  - [ ] Unit tests for each `log` / `logTruncated` combination; `src/server.test.ts` row and count
  - [ ] The write-smoke leg after `compile`
- [ ] **TASK-9.3.5** — Release (AC: all)
  - [ ] Minor bump in all five places; `docs/CHANGELOG.md`; `AGENTS.md` tool count

## Dev notes

### Architecture constraints

- `draftPath(draftId, 'compile-log')` — the literal segment passes the path guard as `compile`
  does today. If [US-9.4](US-9.4-typed-diagnostics-and-path-segments.md) makes id positions a
  UUID check, the literal segments must still pass; that story owns the distinction.
- No `notes`: the tool returns everything the route returns.

### Cross-story dependencies

- **External**: Senti US-46.49. The route does not exist until it deploys.
- **Required by** [US-9.6](US-9.6-operationid-docs-and-spec-drift-check.md) — the final counts.

### What we explicitly did NOT do

- **No diagnostics in this tool.** They are structured, never truncated, and `get_draft`
  already returns them; a second route to the same data is a second thing to keep in step.
- **No change to `compile_draft`.** Its response already carries the fresh log.

### References

- [Source: EPIC-9 §The five Senti stories](../epics/EPIC-9.md)
- [Source: US-7.2](US-7.2-get-draft-tool.md) — the tool this one relieves

## Verification commands

| AC | Command |
|---|---|
| AC-1 – AC-4 | `npx vitest run src/tools/authoring/get-draft-compile-log.test.ts` |
| AC-5 | `npx vitest run src/server.test.ts` |
| AC-6 | `grep -n "get_draft_compile_log" src/tools/authoring/get-draft.ts` prints a line |
| AC-8 | `SENTI_SMOKE_WRITES=1 npm run test:smoke` |

## Changelog entry

### Added
- `get_draft_compile_log` — reads a draft's last compile log (the trailing 16 KiB) without its
  source (Senti US-46.49).

## Implementation notes

_Empty until work starts._

## Cross-references

- [EPIC-9](../epics/EPIC-9.md) · [US-7.2](US-7.2-get-draft-tool.md) ·
  [US-8.4](US-8.4-compile-draft-and-epic-close.md)
