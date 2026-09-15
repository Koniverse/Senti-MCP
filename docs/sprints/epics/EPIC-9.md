---
id: EPIC-9
title: "Adopt the Senti API contract fixes"
status: backlog
created: 2026-09-14
updated: 2026-09-14
---

## Goal

Retire the workarounds this server built around the gaps its 2026-08-19 contract review
reported, now that the Senti Quant API has fixed them, and adopt the two read routes those
fixes add — so `list_drafts` survives the drafts collection changing shape under it, no tool
carries a byte budget or a disclaimer the API has made obsolete, and every `GET` operation in
the document has a tool again.

## Overview

### Business context

On 2026-08-19, while building [EPIC-7](EPIC-7.md), this repo reviewed the Senti Quant Public
API contract (reviewer `senti-mcp-server@2.0.1`) and handed off thirteen findings, F1–F13. The
tools that shipped in `2.1.0` → `2.8.0` were built *around* those gaps rather than waiting for
them:

- `list_drafts` downloads a response of up to 10.3 MiB and cuts four fields out of it
  ([CONTEXT D32](../../CONTEXT.md)).
- `list_draft_attachments` rations indicator source through a 64 KiB budget that can withhold
  a 1-byte file because a 64 KiB one came first.
- `get_draft` parses diagnostics loosely because the `GET` routes did not type them
  ([CONTEXT D44](../../CONTEXT.md)).
- `get_authoring_conventions` tells every model, on every call, that the regex dialect is
  undocumented.

The Senti side has now answered in five stories. Four are deployed. The fifth changes the
default response of `GET /api/v1/drafts` from full drafts to summaries, and **the Senti owner
has decided to deploy it before this epic ships**, because this server has few users so far.
From that deploy until [US-9.1](../stories/US-9.1-list-drafts-summary-mode.md) is released,
`list_drafts` fails on every call. That is why US-9.1 is P0, and the only reason.

This epic adds read tools and deletes workarounds. It adds no write tool and does not move
the read/write split: trading writes stay [EPIC-3](EPIC-3.md)'s, and `register` stays
deferred for the reason in [EPIC-8](EPIC-8.md) §Out of scope. Nothing here changes the Senti
repository; the Senti side bumps its submodule pointer after a release here.

### The five Senti stories

| Senti story | Review finding | Deployed (2026-09-14) | Story here |
|---|---|---|---|
| US-46.46 — `operationId` on every operation | F1 | ✅ | [US-9.6](../stories/US-9.6-operationid-docs-and-spec-drift-check.md) |
| US-46.47 — named components, tags, `format` | F2, F3, F4, F12 | ✅ | [US-9.4](../stories/US-9.4-typed-diagnostics-and-path-segments.md) |
| US-46.48 — `forbiddenConstructs[]` pattern contract | F11 | ✅ | [US-9.5](../stories/US-9.5-forbidden-construct-contract.md) |
| US-46.49 — drafts summary mode, compile-log route, `PENDING` removed | F5, F6, F10 | ❌ **not yet** | [US-9.1](../stories/US-9.1-list-drafts-summary-mode.md), [US-9.3](../stories/US-9.3-get-draft-compile-log-tool.md) |
| US-46.50 — `GET …/attachments/{attachmentId}` | F7 | ✅ | [US-9.2](../stories/US-9.2-get-draft-attachment-tool.md) |

F8 (filtering and pagination on `/drafts`), F9 (the undeclared `ETag`) and F13 (`/drafts`
outside the `/authoring` namespace) have no deployed Senti fix; see §Out of scope.

### The hand-off, checked — 2026-09-14

The hand-off that opened this epic was verified against this repo's `origin/main` (`4a0118f`,
`2.8.1`) and the served document **before any story was written**. What held and what did not
is recorded here once, so the stories cite it rather than re-derive it.

**The served document.** `https://api.sentitrade.xyz/api/v1/openapi.json` and
`https://be-dev.sentitrade.xyz/api/v1/openapi.json` were byte-identical: 105,281 bytes, sha256
`8c52928291c6f6318f2228041ad006f3ab6e433bd8b0eab0c3a0073008528faa`. 30 operations across 22
paths. Seven named components — `Draft`, `DraftAttachment`, `CompileDiagnostic`,
`AuthoringConventions`, `AuthoringLimits`, `ForbiddenConstruct`, `ErrorEnvelope`. Six tags.
**No `DraftSummary`, no `/compile-log` path, no `view` parameter, and `PENDING` still in
`Draft.lastCompileStatus`** — US-46.49 was not live on either host.

**Held**, and not repeated below: `2.8.1`'s only `src/` change since `2.8.0` is
`SERVER_VERSION` and the dashboard URL; every line reference in the hand-off except the two
corrected below; 21 of the 30 `operationId`s are the camelCase of this repo's 21 tool names,
and the other nine are exactly `linkAccount`, `deployStrategy`, `stopStrategy`,
`closePosition`, `closeAllPositions`, `cancelOrder`, `cancelAllOrders`, `registerDraftAsEa`
and `getDraftAttachment`; `ForbiddenConstruct` requires the six fields the hand-off names, and
its descriptions say what the hand-off says; the single-attachment `404` covers unknown,
cross-owner and wrong-draft ids with one description; `ticket` carries no `format`.

**Corrected**, each carried into the story that owns it:

| The hand-off said | What the document or the code shows | Owner |
|---|---|---|
| US-46.49 deploys before this epic ships | True as a plan; **not yet deployed on either host** on 2026-09-14, so `list_drafts` still works today | [US-9.1](../stories/US-9.1-list-drafts-summary-mode.md) |
| A summary lacks `sourceCode`, `lastCompileLog` and `lastCompileDiagnostics` | Also: every summary `attachments[]` item lacks `sourceCode`, which `AttachmentSchema` requires — a second, independent parse failure | [US-9.1](../stories/US-9.1-list-drafts-summary-mode.md) |
| Delete the *render-only* `DiagnosticSchema` duplication (`get-draft.ts:40`) | Not render-only: it is `compile_draft`'s strict schema (`compile-draft.ts:26`) and the smoke test's (`smoke.test.ts:411`). There is one schema, used two ways. It stays; only the `safeParse` fallback goes, and that spans `:94-112`, not `:94-102` | [US-9.4](../stories/US-9.4-typed-diagnostics-and-path-segments.md) |
| US-46.47 answers F4, F2, F12 | `format` is **F3** in the review; F12 is `tags`. US-46.47 answers F2, F3, F4 and F12 | this epic |
| `format: date-time` is set on timestamps; `format: uuid` on the ids | Only on the authoring components, `expectedUpdatedAt`, and the path parameters. `Account.createdAt`, `lastSyncAt`, positions `openTime`, deals `time` and breakdowns `date` carry no format, and ten `id` properties — the account and strategy ids among them — carry no `uuid` | [US-9.4](../stories/US-9.4-typed-diagnostics-and-path-segments.md) |
| Delete the `filename` lookup (`list-draft-attachments.ts:155-157`) | `:155-157` is the tool description. The lookup is `shapeAttachments`' filename branch, `:43-61` | [US-9.2](../stories/US-9.2-get-draft-attachment-tool.md) |
| Correct `…-design.md:47` | `:73` makes the same claim about the rejected codegen alternative | [US-9.6](../stories/US-9.6-operationid-docs-and-spec-drift-check.md) |
| *(not in the hand-off)* | Also false today: `AGENTS.md`'s "29 operations", "all 14 of the API's `GET` operations now have a tool" (there are 15; `getDraftAttachment` has none) and "Current state: `2.8.0`"; `README.md:136`; `list-drafts.ts:131`'s "this server has no write tools", false since `2.5.0`; and `get-draft.ts:86-88` and `write-result.ts:88-90, :119-120`, which send the model to `list_draft_attachments` to read attachment source | [US-9.1](../stories/US-9.1-list-drafts-summary-mode.md), [US-9.2](../stories/US-9.2-get-draft-attachment-tool.md), [US-9.6](../stories/US-9.6-operationid-docs-and-spec-drift-check.md) |
| Optional: attach a construct's `reason` to a `compile_draft` violation via `emittedRuleIds` | **No response in the document declares a `rule` field.** Scan violations come back as `200 ok:false` `diagnostics`, whose items carry `code`. The join is unverified | §Out of scope |
| Optional: compile the patterns locally | The conventions description says the server matches **logical lines** — continuations spliced, comments stripped with string and character-literal state honoured — and runs four analyses no pattern expresses. A raw-text pre-check "will disagree with the server in both directions" | §Out of scope |
| The review file, linked as `senti-api-contract-audit.md` | Not in this repo. The links from CONTEXT D44, EPIC-8, US-8.4 and the write spec resolve to a file that does not exist here | [US-9.6](../stories/US-9.6-operationid-docs-and-spec-drift-check.md) |

**Not verifiable here**, and re-measured by US-9.1 once the deploy lands: Senti's
24,221 B (summary) vs 10,879,661 B (`view=full`) on a 20-draft account, and the `400
INVALID_BODY` on an unknown `view`.

### Deploy check

The two routes US-46.49 adds are the only way to tell from outside whether it has landed.
Run from anywhere; no key needed.

```bash
for h in api.sentitrade.xyz be-dev.sentitrade.xyz; do
  curl -s "https://$h/api/v1/openapi.json" | node -e '
    let d = ""; process.stdin.on("data", (c) => (d += c)).on("end", () => {
      const s = JSON.parse(d);
      console.log(process.argv[1],
        "DraftSummary:", Boolean(s.components?.schemas?.DraftSummary),
        "compile-log:", Boolean(s.paths["/api/v1/drafts/{draftId}/compile-log"]));
    });' "$h"
done
```

On 2026-09-14 both hosts printed `DraftSummary: false compile-log: false`.

### Feature pillars

| # | Pillar | Story | Purpose |
|---|---|---|---|
| 1 | **Survive the summary default** | [US-9.1](../stories/US-9.1-list-drafts-summary-mode.md) | `list_drafts` asks for summaries, reads them as its own output, and still accepts the full shape |
| 2 | **Read one thing at a time** | [US-9.2](../stories/US-9.2-get-draft-attachment-tool.md), [US-9.3](../stories/US-9.3-get-draft-compile-log-tool.md) | One indicator by id, one compile log by draft — instead of a collection or a whole draft carrying every body |
| 3 | **Trust what the document now types** | [US-9.4](../stories/US-9.4-typed-diagnostics-and-path-segments.md), [US-9.5](../stories/US-9.5-forbidden-construct-contract.md) | Parse diagnostics strictly, settle the path-segment rationale, and publish the pattern contract instead of a disclaimer |
| 4 | **Correct the record** | [US-9.6](../stories/US-9.6-operationid-docs-and-spec-drift-check.md) | Fix the docs the fixes made false, and check the tool surface against the served document |

### Out of scope

- **Evaluating `forbiddenConstructs[]` patterns locally** — decided 2026-09-14. Doing it
  correctly means reproducing the server's logical-line reduction (continuation splicing,
  comment stripping that honours string and character-literal state), and even then it is
  necessary rather than sufficient: `#resource`, `#include` resolution, `#define` aliasing and
  `iCustom` checks run too and are not patterns. The server scan is authoritative. Trigger to
  revisit: the document publishes the reduction as data, or a user shows compile slots burnt on
  violations a pre-check would have caught.
- **Mapping `emittedRuleIds` onto `compile_draft` output.** No response declares where a
  scan's `rule` value appears. Trigger: a live compile of a deliberately violating draft shows
  that `diagnostics[].code` carries an `emittedRuleIds` value, or the document says so.
- **Anything Senti has not shipped** — filtering and pagination on `/drafts` (F8), `ETag` on
  draft reads (F9), an `/authoring` namespace for `/drafts` (F13).
- **Removing a published field.** `list_drafts`' `notes` and `list_draft_attachments`'
  `filename` input and `sourceCode` output all stay. A removal is a major version and gets its
  own decision; this epic ships none.
- **Generating tools from `operationId`s.** The first reason the v1 design gave for hand-written
  tools is gone; the second — that the model-facing descriptions cannot be generated — is not.
- **Trading writes** ([EPIC-3](EPIC-3.md)) and **`register`** ([EPIC-8](EPIC-8.md) §Out of scope).

## Cross-cutting invariants

Inherited from [EPIC-2](EPIC-2.md), [EPIC-7](EPIC-7.md) and [EPIC-8](EPIC-8.md), plus three
this epic adds.

- **Tolerate the shape an environment has not deployed yet.** Where a route's response changes
  shape, parse both the old and the new, so a release here is safe whichever order the two
  hosts deploy in. Enforced by a test per shape in [US-9.1](../stories/US-9.1-list-drafts-summary-mode.md).
- **Published tool surfaces only grow.** No tool is renamed, and no input or output field is
  removed. A field that stops meaning anything stays, documented as always empty, until a
  major version removes it deliberately.
- **Transcribe the served document, not the hand-off.** Every shape a story implements is read
  from the published component at implementation time. Where the hand-off and the document
  disagree, the document wins and the story records the difference.
- **Every path parameter reaches a URL only through `accountPath` or `draftPath`.**
  `attachmentId` joins `SEGMENT_KEYS` in `src/server.test.ts` when the first tool takes it as
  input.
- **A note records loss, not removal** ([CONTEXT D25](../../CONTEXT.md)). A route that returns
  no bodies loses nothing, so it writes no note.
- **The API key never enters a tool's `inputSchema`** or any returned text. Asserted by test.
- **No retry, anywhere** ([CONTEXT D40](../../CONTEXT.md)).
- **Byte counts are UTF-8 bytes** (`Buffer.byteLength`), never UTF-16 code units.
- **Transcribe declared constraints; never the runtime `limits` block.** `ATTACHMENT_BUDGET_BYTES`
  was exactly that kind of copy, and [US-9.2](../stories/US-9.2-get-draft-attachment-tool.md)
  deletes it.

## Story index

| US | Title | Pri | Points | Status | Ships |
|---|---|---|---|---|---|
| [US-9.1](../stories/US-9.1-list-drafts-summary-mode.md) | `list_drafts` adopts the drafts summary mode | P0 | 3 | 🟢 ready | — |
| [US-9.2](../stories/US-9.2-get-draft-attachment-tool.md) | `get_draft_attachment`, and `list_draft_attachments` becomes an index | P1 | 5 | 📋 backlog | — |
| [US-9.3](../stories/US-9.3-get-draft-compile-log-tool.md) | `get_draft_compile_log` | P2 | 2 | 📋 backlog | — |
| [US-9.4](../stories/US-9.4-typed-diagnostics-and-path-segments.md) | Typed diagnostics, and the path-segment rationale | P2 | 3 | 📋 backlog | — |
| [US-9.5](../stories/US-9.5-forbidden-construct-contract.md) | The forbidden-construct pattern contract | P2 | 2 | 📋 backlog | — |
| [US-9.6](../stories/US-9.6-operationid-docs-and-spec-drift-check.md) | `operationId` doc corrections and a spec-drift check | P3 | 2 | 📋 backlog | — |

**Total: 17 points.** Only US-9.1 is committed — to [sprint-2026-W38](../sprint-2026-W38.md),
on 2026-09-14. The other five are backlog until the maintainer promotes them
([CONTEXT D21](../../CONTEXT.md) rule 2).

The order is not arbitrary. **US-9.1 first**, because it is the only story whose absence
breaks a shipped tool. **US-9.2 depends on it**: the attachment index is read from the summary
US-9.1 parses. **US-9.3 waits on Senti**: its route does not exist until US-46.49 deploys.
US-9.4 and US-9.5 are independent cleanups. **US-9.6 goes last** so the operation and tool
counts it corrects are written once, after the two new tools exist.

After US-9.2 and US-9.3 the registered tool count goes from 21 to **23** — 16 read, 7 write —
and every `GET` in the document (16, once US-46.49 adds `getDraftCompileLog`) has a tool.

### Semver posture

Each story that changes the tarball cuts its own minor version, as EPIC-7 and EPIC-8 did; the
numbers are assigned in ship order. **None of the six is planned as breaking**, and the three
that come closest are named here so a reviewer can disagree before the work, not after.

| Story | Change to a published surface | Bump | Why not breaking |
|---|---|---|---|
| [US-9.1](../stories/US-9.1-list-drafts-summary-mode.md) | `list_drafts` output adds `sourceSha256`, `logTruncated`, `attachments[].updatedAt`; `notes` becomes always `[]`; `PENDING` leaves three enums | minor | Fields added, none removed. `PENDING` was never sent by any server |
| [US-9.2](../stories/US-9.2-get-draft-attachment-tool.md) | New tool. `list_draft_attachments`' default call returns every entry with `sourceCode: null` | minor | Both schemas stay compatible — `sourceCode` was already nullable, `filename` stays. **The behaviour change is real** and goes under `### Changed`, stated plainly |
| [US-9.3](../stories/US-9.3-get-draft-compile-log-tool.md) | New tool | minor | Additive |
| [US-9.4](../stories/US-9.4-typed-diagnostics-and-path-segments.md) | Diagnostics parse strictly; a non-UUID `draftId` / `attachmentId` is rejected locally instead of reaching the API | minor | Every value it now rejects already failed — as a `404`, or against a document that declares the shape. **Named as potentially breaking** in its CHANGELOG entry regardless |
| [US-9.5](../stories/US-9.5-forbidden-construct-contract.md) | `get_authoring_conventions` output adds three fields per construct | minor | Additive |
| [US-9.6](../stories/US-9.6-operationid-docs-and-spec-drift-check.md) | Docs and the opt-in smoke suite only | none | Nothing in the tarball changes |

## What this close does not claim

Written **before the work started**, as [EPIC-8](EPIC-8.md) did, so that closing is a matter of
moving rows out rather than remembering to add them.

| Gap | Why | What would discharge it |
|---|---|---|
| The summary's size advantage is Senti's measurement | The smoke account holds 4 drafts, not 20 at every cap | US-9.1 TASK-9.1.8 records this repo's own ratio; the 449× figure stays attributed to Senti |
| The attachment tools against real attachments | The smoke account holds none outside the write smoke's lifetime | US-9.2's write-smoke leg reads back the attachment it creates, by id |
| A truncated compile log through `get_draft_compile_log` | Needs a compile whose output exceeds 16 KiB | A deliberately noisy compile on a throwaway draft |

## Cross-references

- **The contract review** — outside this repo, at `Senti-Quant/draft/senti-api-contract-audit.md`
  (2026-08-19, reviewer `senti-mcp-server@2.0.1`). Its own header says it was written for
  hand-off and meant to be moved; [US-9.6](../stories/US-9.6-operationid-docs-and-spec-drift-check.md)
  repairs the in-repo links that assume otherwise.
- [EPIC-7](EPIC-7.md) — the read path whose workarounds this retires
- [EPIC-8](EPIC-8.md) — the write path; its `write-result.ts` pointers change in US-9.2
- [EPIC-3](EPIC-3.md) — trading writes, untouched
- [CONTEXT D25](../../CONTEXT.md), [D32](../../CONTEXT.md), [D34](../../CONTEXT.md),
  [D44](../../CONTEXT.md) — the decisions this epic revises or relies on
- [PR CI gate spec](../../superpowers/specs/2026-09-11-pr-ci-gate-design.md) and
  [plan](../../superpowers/plans/2026-09-11-pr-ci-gate-w37.md) — both named their epic
  `EPIC-9` before this one was filed. Neither was ever filed; a promotion takes the next free
  id ([sprint-2026-W38](../sprint-2026-W38.md) §Open work)
- [sprint-2026-W38](../sprint-2026-W38.md) — where US-9.1 runs
