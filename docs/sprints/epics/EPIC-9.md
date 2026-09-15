---
id: EPIC-9
title: "Adopt the Senti API contract fixes"
status: backlog
created: 2026-09-14
updated: 2026-09-15
---

## Goal

Retire the workarounds this server built around the gaps its 2026-08-19 contract review
reported, now that the Senti Quant API has fixed them, and adopt the two read routes those
fixes add — so `list_drafts` works against the summary-by-default drafts collection, no tool
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

The Senti side has answered in five stories, **all five now deployed**. The fifth, US-46.49,
changed the default response of `GET /api/v1/drafts` from full drafts to summaries, and — as
the Senti owner decided, because this server has few users so far — it reached both hosts
before this epic shipped: absent on 2026-09-14, live on 2026-09-15 (Senti `v0.3.6`). **Since
that deploy, `list_drafts` `2.8.1` fails on every call**, observed live on both hosts
(§Re-checked — 2026-09-15). That is why [US-9.1](../stories/US-9.1-list-drafts-summary-mode.md)
is P0, and the only reason.

This epic adds read tools and deletes workarounds. It adds no write tool and does not move
the read/write split: trading writes stay [EPIC-3](EPIC-3.md)'s, and `register` stays
deferred for the reason in [EPIC-8](EPIC-8.md) §Out of scope. Nothing here changes the Senti
repository; the Senti side bumps its submodule pointer after a release here.

### The five Senti stories

| Senti story | Review finding | Deployed | Story here |
|---|---|---|---|
| US-46.46 — `operationId` on every operation | F1 | ✅ by 2026-09-14 | [US-9.6](../stories/US-9.6-operationid-docs-and-spec-drift-check.md) |
| US-46.47 — named components, tags, `format` | F2, F3, F4, F12 | ✅ by 2026-09-14 | [US-9.4](../stories/US-9.4-typed-diagnostics-and-path-segments.md) |
| US-46.48 — `forbiddenConstructs[]` pattern contract | F11 | ✅ by 2026-09-14 | [US-9.5](../stories/US-9.5-forbidden-construct-contract.md) |
| US-46.49 — drafts summary mode, compile-log route, `PENDING` removed | F5, F6, F10 | ✅ 2026-09-15 (Senti `v0.3.6`) | [US-9.1](../stories/US-9.1-list-drafts-summary-mode.md), [US-9.3](../stories/US-9.3-get-draft-compile-log-tool.md) |
| US-46.50 — `GET …/attachments/{attachmentId}` | F7 | ✅ by 2026-09-14 | [US-9.2](../stories/US-9.2-get-draft-attachment-tool.md) |

F8 (filtering and pagination on `/drafts`), F9 (the undeclared `ETag`) and F13 (`/drafts`
outside the `/authoring` namespace) have no deployed Senti fix; see §Out of scope.

### The hand-off, checked — 2026-09-14

The hand-off that opened this epic was verified against this repo's `origin/main` (`4a0118f`,
`2.8.1`) and the served document **before any story was written**. What held and what did not
is recorded here once, so the stories cite it rather than re-derive it. This subsection is the
record of that day; §Re-checked — 2026-09-15 below supersedes it where they differ.

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
| US-46.49 deploys before this epic ships | True as a plan; not yet deployed on either host on 2026-09-14, so `list_drafts` still worked that day. It deployed by 2026-09-15 | [US-9.1](../stories/US-9.1-list-drafts-summary-mode.md) |
| A summary lacks `sourceCode`, `lastCompileLog` and `lastCompileDiagnostics` | Also: every summary `attachments[]` item lacks `sourceCode`, which `AttachmentSchema` requires — a second, independent parse failure | [US-9.1](../stories/US-9.1-list-drafts-summary-mode.md) |
| Delete the *render-only* `DiagnosticSchema` duplication (`get-draft.ts:40`) | Not render-only: it is `compile_draft`'s strict schema (`compile-draft.ts:26`) and the smoke test's (`smoke.test.ts:411`). There is one schema, used two ways. It stays; only the `safeParse` fallback goes, and that spans `:94-112`, not `:94-102` | [US-9.4](../stories/US-9.4-typed-diagnostics-and-path-segments.md) |
| US-46.47 answers F4, F2, F12 | `format` is **F3** in the review; F12 is `tags`. US-46.47 answers F2, F3, F4 and F12 | this epic |
| `format: date-time` is set on timestamps; `format: uuid` on the ids | Only on the authoring components, `expectedUpdatedAt`, and the path parameters. `Account.createdAt`, `lastSyncAt`, positions `openTime`, deals `time` and breakdowns `date` carry no format, and ten `id` properties — the account and strategy ids among them — carry no `uuid` | [US-9.4](../stories/US-9.4-typed-diagnostics-and-path-segments.md) |
| Delete the `filename` lookup (`list-draft-attachments.ts:155-157`) | `:155-157` is the tool description. The lookup is `shapeAttachments`' filename branch, `:43-61` | [US-9.2](../stories/US-9.2-get-draft-attachment-tool.md) |
| Correct `…-design.md:47` | `:73` makes the same claim about the rejected codegen alternative | [US-9.6](../stories/US-9.6-operationid-docs-and-spec-drift-check.md) |
| *(not in the hand-off)* | Also false today: `AGENTS.md`'s "29 operations", "all 14 of the API's `GET` operations now have a tool" and "Current state: `2.8.0`"; `README.md:136`; `list-drafts.ts:131`'s "this server has no write tools", false since `2.5.0`; and `get-draft.ts:86-88` and `write-result.ts:88-90, :119-120`, which send the model to `list_draft_attachments` to read attachment source | [US-9.1](../stories/US-9.1-list-drafts-summary-mode.md), [US-9.2](../stories/US-9.2-get-draft-attachment-tool.md), [US-9.6](../stories/US-9.6-operationid-docs-and-spec-drift-check.md) |
| Optional: attach a construct's `reason` to a `compile_draft` violation via `emittedRuleIds` | **No response in the document declares a `rule` field.** Scan violations come back as `200 ok:false` `diagnostics`, whose items carry `code`. The join is unverified | §Out of scope |
| Optional: compile the patterns locally | The conventions description says the server matches **logical lines** — continuations spliced, comments stripped with string and character-literal state honoured — and runs four analyses no pattern expresses. A raw-text pre-check "will disagree with the server in both directions" | §Out of scope |
| The review file, linked as `senti-api-contract-audit.md` | Not in this repo. The links from CONTEXT D44, EPIC-8, US-8.4 and the write spec resolve to a file that does not exist here | [US-9.6](../stories/US-9.6-operationid-docs-and-spec-drift-check.md) |

**Not verifiable that day**: Senti's 24,221 B (summary) vs 10,879,661 B (`view=full`) on a
20-draft account, and the `400 INVALID_BODY` on an unknown `view`. The `400` was observed on
2026-09-15; the at-cap ratio is still not reproduced here.

### Re-checked — 2026-09-15

The maintainer reported a new deploy, and the document and the live API were checked again
before any story was touched.

**The served document.** Both hosts byte-identical again: 111,004 bytes, sha256
`dd2e32275a8503bd9f7fc740c94607f9b14cabaac33b6cb2d802c348743dda80`. **31 operations across
23 paths, 16 of them `GET`s.** Nine named components — the seven above plus `DraftSummary` and
`DraftAttachmentSummary`. `PENDING` appears nowhere in it. `GET /drafts` takes `view`
(`summary` | `full`, default `summary`) and declares its `200` as `anyOf` an array of
`DraftSummary` or an array of `Draft`. `GET /drafts/{draftId}/compile-log`
(`getDraftCompileLog`, the tenth coined `operationId`) returns an inline
`{ log, logTruncated }`. **Nothing else the stories depend on moved**: `ForbiddenConstruct`,
`CompileDiagnostic`, the path-parameter formats and the formatless `Account.id` are as recorded
the day before; the new `uuid` and `date-time` occurrences are all on the two new components.

**What the hand-off did not carry.** `DraftSummary` has a required field the hand-off's shape
lacks: **`compileLogBytes`** (`int32` | `null`, *"UTF-8 size of the last compile log; `null`
when there is none"*). Senti added it in review: `logTruncated` is `false` for any log under
16 KiB, so without it a `FAILED` compile with no parsed diagnostics showed no output at all.

**Live**, with the smoke key and read-only requests — identical on both hosts, down to the
same 4 drafts:

| Request | Result |
|---|---|
| `GET /drafts` (no `view`) | `200`, 1,616 B of summaries — **and `2.8.1`'s `parseDrafts` throws** at `0.sourceCode` |
| `?view=summary` | byte-identical to the default |
| `?view=full` | `200`, 22,459 B — still parses under `2.8.1`'s schema |
| `?view=bogus` · `?view=summary&view=full` · `?view=FULL` | `400 INVALID_BODY` — the document's `400` does not name the code; the service does |
| `?foo=bar` | `200` — unrelated parameters are ignored |
| `GET /drafts/{id}/compile-log` | `200 { log, logTruncated }`, a 2,425-byte log — equal to that draft's `compileLogBytes` |
| `compile-log` on an unknown id | `404 NOT_FOUND` |

**What that changes here:**

- **The P0 is live.** Every `list_drafts` call against either host fails until
  [US-9.1](../stories/US-9.1-list-drafts-summary-mode.md) ships.
- **US-9.1 drops its full-shape fallback**, and goes from 3 points to 2. The fallback existed
  because a host might still serve full drafts; none does. It could not have been faithful
  either: a full `Draft` shows only the trailing 16 KiB of the log, so `compileLogBytes` cannot
  be computed for a truncated one.
- **US-9.1 transcribes and renders `compileLogBytes`**, and
  [US-9.3](../stories/US-9.3-get-draft-compile-log-tool.md) no longer waits on Senti.
- **The smoke account's ratio is 13.9×** (22,459 / 1,616 B, 4 drafts, no attachments). Senti's
  449× comes from a seeded account at every cap and stays theirs.

### Deploy check

The two routes US-46.49 adds are the way to tell from outside whether it has landed on a host.
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

On 2026-09-14 both hosts printed `DraftSummary: false compile-log: false`. On 2026-09-15 both
printed `DraftSummary: true compile-log: true`.

### Feature pillars

| # | Pillar | Story | Purpose |
|---|---|---|---|
| 1 | **Adopt the summary default** | [US-9.1](../stories/US-9.1-list-drafts-summary-mode.md) | `list_drafts` asks for summaries and returns the server's summary as its own output |
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

- **Tolerate an old shape only while a host still serves it.** Where a route's response changes
  shape and a host has not deployed the change, parse both, so a release here is safe in either
  order. For `/drafts` the condition lapsed on 2026-09-15 — both hosts served summaries before
  this repo released — so [US-9.1](../stories/US-9.1-list-drafts-summary-mode.md) parses the
  summary only.
- **Published tool surfaces only grow.** No tool is renamed, and no input or output field is
  removed. A field that stops meaning anything stays, documented as always empty, until a
  major version removes it deliberately.
- **Transcribe the served document, not the hand-off.** Every shape a story implements is read
  from the published component at implementation time. Where the hand-off and the document
  disagree, the document wins and the story records the difference — as `compileLogBytes`
  already showed.
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
| [US-9.1](../stories/US-9.1-list-drafts-summary-mode.md) | `list_drafts` adopts the drafts summary mode | P0 | 2 | 🟢 ready | — |
| [US-9.2](../stories/US-9.2-get-draft-attachment-tool.md) | `get_draft_attachment`, and `list_draft_attachments` becomes an index | P1 | 5 | 📋 backlog | — |
| [US-9.3](../stories/US-9.3-get-draft-compile-log-tool.md) | `get_draft_compile_log` | P2 | 2 | 📋 backlog | — |
| [US-9.4](../stories/US-9.4-typed-diagnostics-and-path-segments.md) | Typed diagnostics, and the path-segment rationale | P2 | 3 | 📋 backlog | — |
| [US-9.5](../stories/US-9.5-forbidden-construct-contract.md) | The forbidden-construct pattern contract | P2 | 2 | 📋 backlog | — |
| [US-9.6](../stories/US-9.6-operationid-docs-and-spec-drift-check.md) | `operationId` doc corrections and a spec-drift check | P3 | 2 | 📋 backlog | — |

**Total: 16 points** — 17 when filed on 2026-09-14; US-9.1 was re-sized 3 → 2 on 2026-09-15.
Only US-9.1 is committed — to [sprint-2026-W38](../sprint-2026-W38.md), on 2026-09-14. The
other five are backlog until the maintainer promotes them ([CONTEXT D21](../../CONTEXT.md)
rule 2).

The order is not arbitrary. **US-9.1 first**, because it is the only story whose absence
breaks a shipped tool — and since 2026-09-15 it is broken. **US-9.2 depends on it**: the
attachment index is read from the summary US-9.1 parses. **US-9.3 no longer waits on Senti** —
its route went live on 2026-09-15 — and builds on US-9.1 only for the `list_drafts` pointer it
repoints. US-9.4 and US-9.5 are independent cleanups. **US-9.6 goes last** so the operation and
tool counts it corrects are written once, after the two new tools exist.

After US-9.2 and US-9.3 the registered tool count goes from 21 to **23** — 16 read, 7 write —
and every `GET` in the document (16 since US-46.49 added `getDraftCompileLog`) has a tool.

### Semver posture

Each story that changes the tarball cuts its own minor version, as EPIC-7 and EPIC-8 did; the
numbers are assigned in ship order. **None of the six is planned as breaking**, and the three
that come closest are named here so a reviewer can disagree before the work, not after.

| Story | Change to a published surface | Bump | Why not breaking |
|---|---|---|---|
| [US-9.1](../stories/US-9.1-list-drafts-summary-mode.md) | `list_drafts` output adds `sourceSha256`, `compileLogBytes`, `logTruncated`, `attachments[].updatedAt`; `notes` becomes always `[]`; `PENDING` leaves three enums | minor | Fields added, none removed. `PENDING` was never sent by any server, and the API no longer declares it |
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
| The summary's size advantage at the published caps is Senti's measurement | The smoke account holds 4 drafts and no attachments; its own ratio, 13.9×, was measured on 2026-09-15 | A seeded account at every cap. Until then the 449× figure stays attributed to Senti |
| The attachment tools against real attachments | The smoke account holds none outside the write smoke's lifetime | US-9.2's write-smoke leg reads back the attachment it creates, by id |
| A truncated compile log through `get_draft_compile_log` | Needs a compile whose output exceeds 16 KiB; every log on the smoke account is 2,425 B | A deliberately noisy compile on a throwaway draft |

## Cross-references

- **The contract review** — outside this repo, at `Senti-Quant/draft/senti-api-contract-audit.md`
  (2026-08-19, reviewer `senti-mcp-server@2.0.1`). Its own header says it was written for
  hand-off and meant to be moved; [US-9.6](../stories/US-9.6-operationid-docs-and-spec-drift-check.md)
  repairs the in-repo links that assume otherwise.
- **Senti's side of US-46.49** — `Senti-Quant/docs/sprints/stories/US-46.49-drafts-collection-summary-mode.md`,
  shipped in Senti `v0.3.6`. Its §Close records the at-cap measurement and the review that
  added `compileLogBytes`; its hand-off section is what US-9.1 answers.
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
