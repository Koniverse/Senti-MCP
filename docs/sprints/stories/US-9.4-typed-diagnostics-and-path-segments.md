---
id: US-9.4
title: "Typed diagnostics, and the path-segment rationale"
epic: EPIC-9
status: backlog
priority: P2
points: 3
sprint:
assignee: bluezdot
created: 2026-09-14
updated: 2026-09-14
---

## Goal

Two comments in `src/` defend decisions with facts about the document that stopped being true
when Senti US-46.47 deployed. This story revisits both decisions on the new facts: diagnostics
parse against the shape the document now publishes, and the path-segment guard either tightens
to what the document declares or keeps its looseness for a reason that is still true.

## Background

### Diagnostics

`get-draft.ts:16-21` keeps `lastCompileDiagnostics` as `z.array(z.unknown())` because *"the two
GET paths declare it untyped"*. [CONTEXT D44](../../CONTEXT.md) confirmed the live shape on
2026-08-21 and kept the loose parse anyway, naming exactly what would change it: *"the API
adding a shared `CompileDiagnostic` component and `$ref`-ing it from all three sites."*

**That condition is met.** On 2026-09-14 the served document publishes `CompileDiagnostic` —
`severity` (`error` | `warning`), `file`, `line` and `column` as `integer`/`int32`, `code`,
`message`, all required — and `$ref`s it from `Draft.lastCompileDiagnostics` (which both draft
`GET`s return) and from the compile response's `diagnostics`.

`DiagnosticSchema` (`get-draft.ts:40-47`) **is not a render-only duplicate**, as the hand-off
described it. It is the one local transcription of that shape, already used strictly by
`compile_draft` (`compile-draft.ts:26`) and by the write smoke (`smoke.test.ts:411`). It stays.
What goes is `diagnosticLine`'s `safeParse` fallback (`:94-112`), which renders an unreadable
entry as raw JSON.

**The cost is the one D44 named.** `DraftSchema` is parsed all-or-nothing by `get_draft`, by
`create_draft` and `update_draft` (through `parseWrittenDraft`, `write-result.ts:52-54`), and by
the `list_drafts` full-shape adapter from [US-9.1](US-9.1-list-drafts-summary-mode.md). One
malformed diagnostic will fail all of them. That is now the right trade: the document promises
the shape, so a divergence is Senti's contract breaking, reported as such — not this server's
guess failing.

### Path segments

`src/core/client.ts:293-301` argues against a UUID pattern because *"the OpenAPI document
declares both `accountId` and `draftId` as a bare `type: string` with no `format`"*. On
2026-09-14 the path parameters `accountId`, `draftId`, `attachmentId` and `activeEaId` all
declare `format: uuid`; `ticket` does not — it is an MT5 integer.

**The response side is less uniform** ([EPIC-9](../epics/EPIC-9.md) §The hand-off, checked).
`Draft.id` and `DraftAttachment.id` declare `uuid`, so a `draftId` or `attachmentId` is a UUID
at both ends: where the model reads it and where it sends it. **The account `id` that
`list_accounts` returns declares no format** — nor do the strategy ids. A model gets its
`accountId` from a field the document does not promise is a UUID.

**Planned disposition** (this repo's call, confirmed at story start and recorded in CONTEXT):

- `draftId` and `attachmentId` → a UUID check. Declared at both ends.
- `accountId` → stays on the loose segment until `Account.id` declares `format: uuid`. The
  failure the comment warns about — a UUID assumption taking every account tool down at once —
  is still possible from the response side.
- `ticket` → loose, whatever else changes. No builder takes it today; the comment records the
  rule for the day [EPIC-3](../epics/EPIC-3.md) adds one.

**It is not a one-line regex change.** `segmentPath` validates *every* segment `draftPath`
receives, literals included — `'attachments'`, `'compile'`, and `'compile-log'` after
[US-9.3](US-9.3-get-draft-compile-log-tool.md). A UUID check has to apply to the id positions
only, which means `draftPath` has to know which positions those are.

## Acceptance criteria

- [ ] **AC-1** — `DraftSchema.lastCompileDiagnostics` is `z.array(DiagnosticSchema)`, and
  `DiagnosticSchema` transcribes `CompileDiagnostic`, with `line` and `column` as integers.
- [ ] **AC-2** — **Given** a draft whose diagnostics contain a malformed entry, **When**
  `get_draft`, `create_draft` or `update_draft` parses it, **Then** each returns
  `isError: true` with the "API may have changed" message. One test per tool.
- [ ] **AC-3** — `diagnosticLine`'s fallback is gone; `get-draft.test.ts`' three tests for
  unknown-shaped, raw and `null` diagnostics (`:50`, `:151`, `:157`) are replaced by AC-2's.
- [ ] **AC-4** — The comments at `get-draft.ts:16-21` and `:39` no longer claim the `GET`
  routes are untyped.
- [ ] **AC-5** — `docs/CONTEXT.md` gains an entry revising [D44](../../CONTEXT.md), citing the
  2026-09-14 document as meeting D44's own condition, **And** linking the contract review where
  it actually lives ([US-9.6](US-9.6-operationid-docs-and-spec-drift-check.md)).
- [ ] **AC-6** — **Given** a `draftId` or `attachmentId` that is not a UUID, **When** a tool
  builds its path, **Then** it is rejected before any request, with a message that still ends
  in the caller's `Use the id field from …` hint.
- [ ] **AC-7** — **Given** the literal segments `attachments`, `compile` and `compile-log`,
  **When** a path is built, **Then** they pass unchanged.
- [ ] **AC-8** — **Given** an `accountId` that is a legal segment but not a UUID, **When**
  `accountPath` builds it, **Then** it passes, as today.
- [ ] **AC-9** — The rationale comment at `client.ts:293-301` states the 2026-09-14 facts:
  which parameters declare `uuid`, that `Account.id` does not, and that `ticket` stays loose.
- [ ] **AC-10** — The same CONTEXT entry as AC-5, or a sibling, records the path-segment
  disposition and its trigger to revisit: `Account.id` declaring `format: uuid`.

## Tasks

- [ ] **TASK-9.4.1** — Confirm the disposition before code (AC: 6, 8, 10)
  - [ ] Re-read the path parameters and the response ids in the served document; if either has
        moved since 2026-09-14, the disposition follows the document
- [ ] **TASK-9.4.2** — Diagnostics (AC: 1, 2, 3, 4)
  - [ ] `get-draft.ts`: tighten `DraftSchema`; `line`/`column` → `z.number().int()`; delete
        `diagnosticLine`'s fallback; rewrite the two comments
  - [ ] Tests in `get-draft.test.ts`, `create-draft.test.ts`, `update-draft.test.ts`
- [ ] **TASK-9.4.3** — Path segments (AC: 6, 7, 8, 9)
  - [ ] `client.ts`: a UUID check for the id positions `draftPath` builds; literals and
        `accountPath` keep `PATH_SEGMENT`; rewrite the rationale comment
  - [ ] `client.test.ts` for each case; `src/server.test.ts`' traversal test still passes
- [ ] **TASK-9.4.4** — Record and release (AC: 5, 10)
  - [ ] CONTEXT entry (next free `D<N>`), revising D44
  - [ ] Minor bump in all five places; `docs/CHANGELOG.md`, naming the stricter parse and the
        UUID check as potentially breaking

## Dev notes

### Architecture constraints

- **Transcribe the document, not the observation.** D44 kept the parse loose because *"the
  observation is about the service, and the parse is a bet on the contract."* The contract now
  says what the observation said. That — not the observation — is what licenses the change.
- **`compile_draft` is unchanged.** It already parses strictly, against the same schema.
- **The UUID check fails closed, locally.** A non-UUID id that would have reached the API and
  come back `404` now fails before the request. That is behaviour, not schema, and it is named
  in the CHANGELOG.

### Cross-story dependencies

- **Sibling of** [US-9.1](US-9.1-list-drafts-summary-mode.md) — both edit `DraftSchema`; land
  US-9.1 first.
- **Sibling of** [US-9.2](US-9.2-get-draft-attachment-tool.md) and
  [US-9.3](US-9.3-get-draft-compile-log-tool.md) — both add `draftPath` calls this story's
  check must accept.

### What we explicitly did NOT do

- **No UUID check on `accountId`** until `Account.id` declares it. Trigger: the document adds
  `format: uuid` to the account `id`.
- **No `format: date-time` validation.** The document declares it on the authoring timestamps
  only, and nothing here computes with a timestamp; it is displayed, not parsed.

### References

- [Source: CONTEXT D44](../../CONTEXT.md) — the decision this revises, and its stated condition
- [Source: EPIC-9 §The hand-off, checked](../epics/EPIC-9.md)
- [Source: EPIC-2 §Cross-cutting invariants](../epics/EPIC-2.md) — why every path parameter is
  validated at all

## Verification commands

| AC | Command |
|---|---|
| AC-1 – AC-4 | `npx vitest run src/tools/authoring/get-draft.test.ts src/tools/authoring/create-draft.test.ts src/tools/authoring/update-draft.test.ts` |
| AC-6 – AC-8 | `npx vitest run src/core/client.test.ts src/server.test.ts` |
| AC-4, AC-9 | `grep -n "no \`format\`\|declare it untyped" src/core/client.ts src/tools/authoring/get-draft.ts` prints nothing |
| AC-5, AC-10 | `npm run agile:validate` |

## Changelog entry

### Changed
- `get_draft`, `create_draft` and `update_draft` parse compile diagnostics against the shape the
  API now publishes (`CompileDiagnostic`). **Potentially breaking**: a diagnostic that does not
  match it is now an error rather than a raw line of JSON.
- A `draftId` or `attachmentId` that is not a UUID is rejected before the request. **Potentially
  breaking**: such a value used to reach the API and fail there with `404`. `accountId` is
  unchanged.

## Implementation notes

_Empty until work starts._

## Cross-references

- [EPIC-9](../epics/EPIC-9.md) · [CONTEXT D44](../../CONTEXT.md) ·
  [US-8.4](US-8.4-compile-draft-and-epic-close.md)
