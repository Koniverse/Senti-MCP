---
id: US-7.2
title: "get_draft tool"
epic: EPIC-7
status: done
priority: P1
points: 2
sprint: sprint-2026-W34
assignee: bluezdot
created: 2026-08-19
updated: 2026-08-19
version_shipped: 2.2.0
---

## Goal

A user asks "show me the code" or "why did this fail to compile". `GET /api/v1/drafts/{draftId}`
holds both answers. This story ships the tool that returns one draft's full MQL5 source, its
compiler log and its diagnostics — and the full-fidelity `DraftSchema` and `AttachmentSchema`
that [US-7.3](US-7.3-list-drafts-tool.md) and [US-7.4](US-7.4-list-draft-attachments-tool.md)
import rather than transcribe a second time.

## Background

Per the [design spec](../../superpowers/specs/2026-08-19-senti-authoring-read-tools-design.md)
§Tool surface, `get_draft` reads `GET /api/v1/drafts/{draftId}` under `authoring:read` and
lands in `src/tools/authoring/get-draft.ts`.

**This tool was designed unshaped and the measurement overturned that.** At the ceilings
[US-7.1](US-7.1-authoring-substrate-and-conventions-tool.md) publishes, one draft is worth
192 KiB of EA source + 5 × 64 KiB of attachment source + 16 KiB of compile log = **528 KiB,
roughly 135,000 tokens** — more than most context windows. One cut fixes it:

| Cut | What goes | Replaced by | Worst case after |
|---|---|---|---|
| 1 | `attachments[].sourceCode` | `attachments[].sourceBytes` | 208 KiB ≈ 52,000 tokens |

**That cut also draws the tool boundary where a reader would want it.** `get_draft` answers
"what does this EA say"; `list_draft_attachments` answers "what do its indicators say". The
fourth tool stops being a redundant view of this one.

Everything else is returned whole. This is the tool a reader calls *because* they want the
source, and truncating it here would leave no tool in the server that can return an EA's
code. 208 KiB is large, and the tool description says so, so a model can decide before asking.

### `lastCompileDiagnostics` — parse loosely, render tightly

The two `GET` paths declare the array as `object` with `additionalProperties: {}` — untyped.
**But `POST /drafts/{draftId}/compile` in the same document types it fully**:
`{ severity: 'error'|'warning', file, line: int, column: int, code, message }`, all six
required. The `GET` description directs the reader to `lastCompileDiagnostics` as *"the
machine-readable, never-truncated form — parse that"* while declining to say what parsing it
would yield.

The story handles the uncertainty rather than pretending to resolve it:

- **Parsing stays `z.array(z.unknown())`.** `parseOrThrow` is all-or-nothing by design, so
  transcribing the compile response's shape onto a `GET` that does not declare it would take
  `get_draft` and `list_drafts` down together the day they diverge — this server's inference
  failing, reported to the user as "the API may have changed".
- **Rendering uses the shape opportunistically.** `DiagnosticSchema` is transcribed from the
  compile response and `safeParse`d per element. A match renders as
  `error 123 at strategy.mq5:42:7 — undeclared identifier`; anything else falls back to the
  raw element. A mismatch costs a less readable line, never a failed tool call.

This is the same asymmetry `breakdowns.ts` uses for `perAccount` — declare `unknown` where
validation would only convert an upstream change into an outage — except that here the data
does reach the model, so the fallback has to render rather than drop.

### One derived value, rendered but not stored

The API's description spells out the register-readiness composition:
`lastCompileStatus === 'SUCCESS' && compiledUpToDate`. Both operands are in the structured
output, so a derived boolean would restate data already present — the reason
`get_performance_breakdowns` dropped its running sums. It is rendered in the **text**
instead, where a model reading `content` alone would otherwise have to compose it itself and
could compose it wrong.

## Acceptance criteria

- [x] **AC-1** — **Given** a call with `draftId`, **When** the request is built, **Then** the
  path is constructed via `draftPath`, **And** the tool is enrolled in `src/server.test.ts`'s
  table-driven traversal test by a `TOOL_CALLS` row carrying `arguments`.
- [x] **AC-2** — **Given** a well-formed draft, **When** the tool returns, **Then**
  `sourceCode`, `lastCompileLog`, `logTruncated` and `lastCompileDiagnostics` are all present
  and unmodified.
- [x] **AC-3** — **Given** a draft with attachments, **When** the tool returns, **Then** no
  `attachments[].sourceCode` appears in `content` or `structuredContent`, **And** each
  attachment carries `sourceBytes`, `id`, `filename` and `createdAt`.
- [x] **AC-4** — **Given** attachment source containing non-ASCII characters, **When**
  `sourceBytes` is computed, **Then** it is the UTF-8 byte length, not the UTF-16 code-unit
  count.
- [x] **AC-5** — **Given** a draft with at least one attachment, **When** the tool returns,
  **Then** `notes` carries one entry naming `list_draft_attachments` and the `draftId`,
  **And** the same sentence appears in `content`.
- [x] **AC-6** — **Given** a draft with no attachments, **When** the tool returns, **Then**
  `notes` is the empty array. A note is never emitted for a cut that did not happen.
- [x] **AC-7** — **Given** a `lastCompileDiagnostics` element matching the compile response's
  shape, **When** the text is rendered, **Then** it appears as a readable
  `file:line:column` location with its severity, code and message.
- [x] **AC-8** — **Given** a `lastCompileDiagnostics` element of an unrecognised shape,
  **When** the tool runs, **Then** the read succeeds, **And** the element is rendered as raw
  output rather than dropped or thrown over.
- [x] **AC-9** — **Given** `lastCompileStatus: 'SUCCESS'` and `compiledUpToDate: true`,
  **When** the text is rendered, **Then** it states the draft is ready to register without
  recompiling; **Given** either is otherwise, **Then** it does not.
- [x] **AC-10** — **Given** `logTruncated: true`, **When** the text is rendered, **Then** it
  says the log is the tail only.
- [x] **AC-11** — **Given** `lastCompileStatus: null` on a never-compiled draft, **When** the
  tool runs, **Then** it parses successfully and the text reads "never compiled" rather than
  printing `null`.
- [x] **AC-12** — **Given** a `404` from the API, **When** the tool returns, **Then**
  `isError` is true and the text carries `DRAFT_NOT_FOUND`'s guidance, which names
  `list_drafts` and does not blame the account.

## Tasks

- [x] **TASK-7.2.1** — **Check the contract against the live service before writing code**
  (AC: 2, 7, 8, 11)
  - [x] Read one draft live; record its key set and compare it field-for-field against the
        OpenAPI document's twelve
  - [ ] **Try to observe one real diagnostic.** Arrange a `FAILED` draft **by hand in the web
        Studio** — **not** by calling `POST /drafts/{draftId}/compile` from this server,
        which is a write and out of scope for this epic. Record the element's real shape in
        §Implementation notes and compare it to `DiagnosticSchema`. **Not done** — see
        §Implementation notes; no headless path to the web Studio was available and no
        `FAILED` draft existed on the live account to inspect instead.
  - [ ] If the shapes match, the render path is confirmed and the parse stays loose anyway.
        If they differ, that is a finding for the API — record it, do not tighten the schema.
        **Not applicable** — no diagnostic was observed to compare (see above); the parse
        stays `z.array(z.unknown())` regardless, per §Background.
- [x] **TASK-7.2.2** — `src/tools/authoring/get-draft.ts` domain module (AC: 2–11)
  - [x] `AttachmentSchema`, `DraftSchema`, `DiagnosticSchema`, `AttachmentSummarySchema`,
        `DraftOutputSchema`, and the `byteLength` helper the two sibling stories import
  - [x] `parseDraft` via `parseOrThrow` with subject `draft`; `shapeDraft`; `formatDraft`
  - [x] `formatDraft` renders diagnostics via `safeParse` with a raw fallback, states
        register-readiness, and marks a truncated log
- [x] **TASK-7.2.3** — Registration and the `2.2.0` release (AC: 1, 12)
  - [x] Register through `registerReadTool`; path via `draftPath(args.draftId)`;
        `scope: 'authoring:read'`; `notFoundMeans: DRAFT_NOT_FOUND`; no `conflictMeans`
  - [x] Tool description states the response can reach ~48,000 tokens of source, that
        attachment source is **not** included, and that `list_drafts` is the cheap overview
  - [x] `src/server.ts` registration; `TOOL_CALLS` row **with `arguments`** in
        `src/server.test.ts`
  - [x] `VERSION`, `package.json`, `src/config.ts` `SERVER_VERSION` → `2.2.0` in lockstep;
        `docs/CHANGELOG.md` `## [2.2.0]`; `README.md` tool-table row; `AGENTS.md` tool count
        11 → 12
- [x] **TASK-7.2.4** — Extend `src/smoke.test.ts` with a `get_draft` leg, guarded on the
  account holding at least one draft (AC: 2)

## Dev notes

### Architecture constraints

- **This module owns the schemas.** `list-drafts.ts` and `list-draft-attachments.ts` import
  `DraftSchema`, `AttachmentSchema`, `AttachmentSummarySchema` and `byteLength` from here.
  Redeclaring is how two copies of one shape drift apart — the arrangement
  `breakdowns.ts` ← `summary.ts` already uses.
- **The smoke leg is guarded on a non-empty account.** A fresh key holds no drafts, and a
  smoke test that fails on an empty account tests the account rather than the code.

### What we explicitly did NOT do

- **No parameter to include attachment source.** It would restore exactly the 135,000-token
  ceiling the cut exists to prevent, and a model with an escape hatch will use it. The answer
  is `list_draft_attachments`, and `notes` says so.
- **No truncation of the EA's own source.** Source is returned whole or not at all — half an
  MQL5 file reads as a complete one to a model that did not write it.
- **No tightening of `lastCompileDiagnostics`** on the strength of the compile response's
  schema. See §Background.

### Cross-story dependencies

- **Builds on** [US-7.1](US-7.1-authoring-substrate-and-conventions-tool.md) — `draftPath`,
  `DRAFT_NOT_FOUND`, and the `tools/authoring/` folder.
- **Blocks** [US-7.3](US-7.3-list-drafts-tool.md) and
  [US-7.4](US-7.4-list-draft-attachments-tool.md) — both import this module's schemas.

### References

- [Source: design spec §Payload policy](../../superpowers/specs/2026-08-19-senti-authoring-read-tools-design.md) — the one cut, and the diagnostics treatment
- [Source: implementation plan Task 3](../../superpowers/plans/2026-08-19-senti-authoring-read-tools-w34.md)
- [Source: EPIC-7 §Open question](../epics/EPIC-7.md) — the diagnostic shape this story cannot settle
- [Source: CONTEXT D25](../../CONTEXT.md) — a note records loss, not removal

## Implementation notes

**TASK-7.2.1's live check held — the key set matches §Background exactly.** Run 2026-08-19
against `be-dev.sentitrade.xyz` with the smoke key, before any code was written:

```
keys: attachments, compiledUpToDate, createdAt, eaDefinitionId, id, lastCompileDiagnostics,
      lastCompileLog, lastCompileStatus, logTruncated, name, sourceCode, updatedAt
```

All twelve keys are present and none are extra — an exact match against the design spec's
field list.

**No `FAILED` draft existed on the live account, so no real `lastCompileDiagnostics` element
could be observed.** The account holding drafts held four: one `SUCCESS` (13,782 bytes of
source, no diagnostics) and three never-compiled (`lastCompileStatus: null`,
`lastCompileDiagnostics: []`). None carried an attachment either, so the attachment-key shape
in the brief's Step 1 script also went unobserved live (`get-draft.test.ts`'s fixture is the
only place an attachment's shape is exercised). Per the brief and this story's own
`TASK-7.2.1`, breaking a draft in the web Studio to manufacture a `FAILED` one was the
prescribed way to get an observation — that is a manual UI action with no equivalent
headless-agent path, and out of reach for this run. **`POST /drafts/{draftId}/compile` was
never called**, consistent with the epic-wide constraint that it is a write endpoint. Net
effect: `DiagnosticSchema` is unverified against a real diagnostic as of this release, and
`lastCompileDiagnostics` parsing correctly stays `z.array(z.unknown())` regardless — that
choice was never contingent on this observation (see §Background), so the gap changes
nothing about the shipped code, only what could be double-checked.

**The traversal test in `src/server.test.ts` was generalized, not just extended.** Before
this story, `'rejects a path-traversal accountId … for every account-scoped tool'` filtered
`TOOL_CALLS` on `'accountId' in call.arguments`, so a `get_draft` row keyed on `draftId` alone
would have been registered but never exercised by that test — silently defeating the very
guarantee `AC-1` asks for. The filter and the substituted key are now generic over
`['accountId', 'draftId']` (both are built through the same private `segmentPath` guard in
`core/client.ts`), so `get_draft`'s traversal defense is asserted the same way every
`accountId`-keyed tool's is, and the same generalization is ready for `list_draft_attachments`
(US-7.4), which will also take a `draftId`.

**Where documentation went beyond the brief's literal file list.** The brief names
`docs/sprints/stories/US-7.2-get-draft-tool.md` as the only sprint/epic doc to modify;
this run also flips the Status cell in `docs/sprints/sprint-2026-W34.md` and
`docs/sprints/epics/EPIC-7.md` from 🟢 ready to ✅ done, per an explicit correction carried
into this task's instructions (US-7.2's own predecessor story was returned from review for
missing exactly that). `README.md` and `AGENTS.md` also received a few sentences beyond the
one required tool-table row / tool-count digit, so that the surrounding prose (tool counts,
version-history chain, the `authoring:read` tool list) stays internally consistent rather
than drifting the way `AGENTS.md`'s "eleven tools" language would have the moment a twelfth
tool existed.
