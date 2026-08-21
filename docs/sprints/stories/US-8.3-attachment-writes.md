---
id: US-8.3
title: "The three attachment writes"
epic: EPIC-8
status: ready
priority: P1
points: 3
sprint: sprint-2026-W34
assignee: bluezdot
created: 2026-08-21
updated: 2026-08-21
---

## Goal

Let an agent manage the indicator files an EA embeds — add one, replace its body, remove it —
and say the three things about them that a model gets wrong otherwise.

## Background

Per the [design spec](../../superpowers/specs/2026-08-21-senti-authoring-write-tools-design.md)
§Tool surface. [US-7.4](US-7.4-list-draft-attachments-tool.md) shipped the read; these are the
writes on the same sub-resource, and they close a live-coverage gap as a side effect — the smoke
account has held **zero** attachments since `2.2.0`, so every attachment branch in the read path
is test-covered and none is live-covered.

### Three things the API states and a model will not infer

1. **Filenames collide case-insensitively.** `MyInd.mq5` and `myind.mq5` are the same file,
   because the compile host writes them into one flat Windows directory.
2. **The filename is immutable.** `PUT …/attachments/{attachmentId}` takes `sourceCode` and
   nothing else: an EA embeds an indicator by name via `#resource "<stem>.ex5"`, so a rename
   would orphan every reference and turn a working draft into a static-safety violation. To
   rename, delete and re-add. `update_draft_attachment` therefore takes **no** `filename` —
   accepting one the API would ignore is worse than not accepting one.
3. **Attaching does not wire up, and deleting does not unwire.** After `add_draft_attachment`
   the EA still has no reference to the file; after `delete_draft_attachment` the EA still has
   one to a file that is gone, and the next compile fails on it. Both tools say so in their
   text, because a draft that compiles to nothing reads as a success otherwise.

## Acceptance criteria

- **AC-1** — `add_draft_attachment` `POST`s `{ filename, sourceCode }` to the attachments
  sub-resource with a derived `Idempotency-Key`.
- **AC-2** — Its text names the exact `#resource` and `iCustom` lines the EA still needs,
  derived from the filename.
- **AC-3** — A `409` is reported as a **case-insensitive** filename collision, with the reason.
- **AC-4** — A `422` is reported as a filename-shape or size problem, not as a missing draft.
- **AC-5** — A `403` names the attachment cap and `delete_draft_attachment` as the fix.
- **AC-6** — `update_draft_attachment` `PUT`s `{ sourceCode }` only, and its `inputSchema` has
  exactly `draftId`, `attachmentId`, `sourceCode`.
- **AC-7** — A `404` on either attachment-id tool says the attachment may **belong to a
  different draft** — a cause `DRAFT_NOT_FOUND` does not cover.
- **AC-8** — A traversal `attachmentId` is rejected before any request is made.
- **AC-9** — `delete_draft_attachment` confirms, sends nothing when declined, and its text tells
  the model to remove the `#resource` / `iCustom` lines with `update_draft`.
- **AC-10** — Neither write echoes `sourceCode` back; a zero-byte file produces no note.
- **AC-11** — `2.7.0` ships with all four version sites in lockstep.

## Tasks

- [ ] **TASK-8.3.1** — Check the contract against the live service: attach a file, confirm the
  case-insensitive `409` by re-attaching the same name in different case, and confirm `PUT`
  rejects a `filename` field
- [ ] **TASK-8.3.2** — `add_draft_attachment` (AC: 1–5, 10)
- [ ] **TASK-8.3.3** — `update_draft_attachment` (AC: 6–8, 10)
- [ ] **TASK-8.3.4** — `delete_draft_attachment` and the `2.7.0` release (AC: 8, 9, 11)

## Dev notes

### What we explicitly did NOT do

- **No `filename` on the replace tool.** §Background 2.
- **No client-side `.mq5` basename validation.** The API's `422` says it precisely, and a
  second implementation of the rule is a second thing to keep in sync.
- **No automatic edit of the EA source.** Adding the `#resource` line for the model would be a
  hidden write to a different resource; the tool says what is needed and the model calls
  `update_draft`.

### References

- [Design spec](../../superpowers/specs/2026-08-21-senti-authoring-write-tools-design.md)
  §Tool surface, §Payload policy
- [Implementation plan](../../superpowers/plans/2026-08-21-senti-authoring-write-tools-w34.md)
  Tasks 10–12
- [US-7.4](US-7.4-list-draft-attachments-tool.md) — the read on the same sub-resource

## Implementation notes

_Written during implementation._
