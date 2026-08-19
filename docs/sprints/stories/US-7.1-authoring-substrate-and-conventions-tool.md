---
id: US-7.1
title: "Authoring substrate and get_authoring_conventions tool"
epic: EPIC-7
status: done
priority: P1
points: 3
sprint: sprint-2026-W34
assignee: bluezdot
created: 2026-08-19
updated: 2026-08-19
version_shipped: 2.1.0
---

## Goal

An agent about to generate MQL5 can read the platform's authoring contract first — the
hard-safety constraints, the trading-safety requirements, the static analyzer's
forbidden-construct list, and the platform limits — instead of discovering them by failing a
compile on a globally serial slot.

This story also builds the substrate the other three stories stand on: `draftPath`, extracted
from `accountPath` rather than copied, and the `tools/authoring/` folder.

## Background

Per the [authoring read-tool design spec](../../superpowers/specs/2026-08-19-senti-authoring-read-tools-design.md)
§Tool surface, `get_authoring_conventions` reads `GET /api/v1/authoring/conventions` under
`authoring:read` and lands in `src/tools/authoring/conventions.ts`.

**This story ships first for a technical reason, not a cosmetic one.** The endpoint returns
the platform's own ceilings:

```
maxDrafts 20 · maxAttachmentsPerDraft 5 · maxAttachmentBytes 65536
maxSourceBytes 196608 · maxRegisteredEas 10
```

Those five numbers are what size the cuts in [US-7.3](US-7.3-list-drafts-tool.md) and
[US-7.4](US-7.4-list-draft-attachments-tool.md) — US-7.4's byte budget is literally
`maxAttachmentBytes`. Shipping the tool that publishes them first means the later stories
argue from a measured contract rather than from an assumption.

**The substrate half is a refactor, not an addition.** `accountPath` hard-codes
`/api/v1/accounts/` and names `list_accounts` in its error message, so it cannot serve
`/api/v1/drafts/{draftId}`. The guard itself is correct and must not be duplicated:
duplicating a traversal guard is how one copy gets fixed and the other does not
([CONTEXT D33](../../CONTEXT.md)). One private `segmentPath` owns `PATH_SEGMENT`,
`encodeURIComponent` and the loop; `accountPath` and `draftPath` are two prefixes over it,
and `accountPath`'s existing signature and error message survive byte for byte.

**`PATH_SEGMENT` is not tightened to a UUID pattern**, even though every live `draftId` is
one. The OpenAPI document declares `draftId` as a bare `type: string` with no `format` and no
`pattern`, so hard-coding UUID would take both draft tools down at once the day Senti issues
an id in another shape — this server's assumption failing, not the API's contract. The same
reasoning already recorded against `accountId` in [US-2.4](US-2.4-tool-substrate-and-layout.md).

This story also corrects a figure now repeated in three places: the API is **29 operations,
not 17**, and **14 of them are `GET`, not 10**.

## Acceptance criteria

- [x] **AC-1** — **Given** a `draftId` and optional sub-resource segments, **When**
  `draftPath` builds a path, **Then** the result is
  `/api/v1/drafts/<encoded>[/<encoded>…]`, **And** every segment has passed `PATH_SEGMENT`.
- [x] **AC-2** — **Given** a segment containing `/`, `.`, `%`, whitespace, or more than 64
  characters, **When** `draftPath` is called, **Then** it throws before any URL is built,
  **And** the message names `list_drafts` rather than `list_accounts`.
- [x] **AC-3** — **Given** the refactor onto a shared `segmentPath`, **When** the suite runs,
  **Then** every pre-existing `accountPath` test in `src/core/client.test.ts` passes
  unchanged — including the one asserting the message names `list_accounts`.
- [x] **AC-4** — **Given** a `200` from `GET /api/v1/authoring/conventions`, **When** the tool
  returns, **Then** `structuredContent` carries all four top-level members and all five
  `limits` ceilings, **And** nothing is cut.
- [x] **AC-5** — **Given** the same response, **When** the tool returns, **Then** `content`
  reproduces every constraint, every requirement, and every forbidden construct's `id`,
  `pattern` and `reason` — these are instructions the model must follow, and a summary of
  them is not a substitute.
- [x] **AC-6** — **Given** a `forbiddenConstructs[].pattern`, **When** it is rendered,
  **Then** it appears verbatim with its escapes intact, **And** the surrounding text states
  that the patterns are regular expressions this tool has not run and whose dialect the API
  does not declare.
- [x] **AC-7** — **Given** a response missing `limits` or missing one of its five ceilings,
  **When** the tool returns, **Then** `isError` is true and the text names the missing field.
- [x] **AC-8** — **Given** a `403` from the API, **When** the tool returns, **Then**
  `isError` is true and the text names the `authoring:read` scope.
- [x] **AC-9** — **Given** the tool is registered, **When** `src/server.test.ts` runs,
  **Then** `get_authoring_conventions` appears in `TOOL_CALLS`, **And** it passes the
  read-only-annotation, output-schema and key-absence assertions that table drives.
- [x] **AC-10** — **Given** `npm run release:check`, **When** it runs after the version bump,
  **Then** it passes — which requires `VERSION`, `package.json` `version` and
  `src/config.ts` `SERVER_VERSION` to agree on `2.1.0` and `docs/CHANGELOG.md` to carry a
  `## [2.1.0]` heading.

## Tasks

- [x] **TASK-7.1.1** — **Check the contract against the live service before writing code**
  (AC: 4, 5, 7)
  - [x] `GET /api/v1/authoring/conventions` with the smoke key; record the four top-level
        keys, the five `limits` values, and the response's byte size
  - [x] Write the numbers into §Implementation notes. **If `limits` differs from the five
        values in §Background, stop** — US-7.4's budget constant is derived from
        `maxAttachmentBytes`, so a change there re-argues that story before it starts
  - [x] Confirm whether `forbiddenConstructs[].pattern` values are still regexes, and record
        one verbatim as the fixture AC-6 asserts against
- [x] **TASK-7.1.2** — `draftPath` and `DRAFT_NOT_FOUND` in `src/core/client.ts`
  (AC: 1, 2, 3)
  - [x] Extract the guard loop into a private `segmentPath(prefix, segments, hint)`; move the
        existing explanatory comment onto it, since that is where the guard now lives
  - [x] Re-express `accountPath` over it with its message unchanged; add `draftPath`
  - [x] Export `DRAFT_NOT_FOUND` beside `ACCOUNT_NOT_FOUND`
  - [x] Tests: happy path, sub-resource segments, the traversal table, and the assertion that
        a bad draft id points at `list_drafts` and **not** at `list_accounts`
- [x] **TASK-7.1.3** — `src/tools/authoring/conventions.ts` domain module (AC: 4, 5, 6, 7)
  - [x] `ConventionsOutputSchema`, `parseConventions` via `parseOrThrow` with subject
        `authoring conventions`, `formatConventions`
  - [x] No cuts and no `notes` member — a tool that cannot cut must not advertise that it
        might
- [x] **TASK-7.1.4** — Registration and the `2.1.0` release (AC: 8, 9, 10)
  - [x] Register through `registerReadTool`; `scope: 'authoring:read'`; no `notFoundMeans`
        (the path takes no parameter) and no `conflictMeans` (no `409` is declared)
  - [x] Tool description tells the model to call this **before** generating source, and says
        the patterns are reported rather than evaluated
  - [x] `src/server.ts` registration; `TOOL_CALLS` row in `src/server.test.ts`
  - [x] `VERSION`, `package.json`, `src/config.ts` `SERVER_VERSION` → `2.1.0` in lockstep;
        `docs/CHANGELOG.md` `## [2.1.0]`; `README.md` tool-table row
- [x] **TASK-7.1.5** — Correct the stale API figures and extend the smoke test (AC: 5)
  - [x] `AGENTS.md`: 17 → 29 operations, 10 → 11 tools, `tools/authoring/` in the structure
        block, `authoring:read` in the scope list
  - [x] `src/smoke.test.ts` gains a `get_authoring_conventions` leg. It is the right endpoint
        for the smoke path: 2 KiB, needs no draft to exist, and is the only authoring read
        that cannot return an empty result on a fresh key

## Dev notes

### Architecture constraints

- **One traversal guard, two prefixes.** No second `PATH_SEGMENT`, no second loop, no
  tool-side concatenation.
- `AUTHORING_READ` is a file-local `const` in the tool file, not a `core/` export. A scope is
  a property of an endpoint, and `core/` never imports from `tools/` — the same arrangement
  that puts `trading:read` in three trading files today.
- **This story registers a read tool only.** `readOnlyHint: true` is hardcoded in
  `registerReadTool`; there is no parameter that could make it otherwise.

### What we explicitly did NOT do

- **No caching**, even though this is the one endpoint whose `Cache-Control: public,
  max-age=3600` invites it and which already serves a weak `ETag`. Adding a cache for one
  endpoint would be the first in the process, with no eviction policy and no other consumer.
  Recorded as a decision in [EPIC-7](../epics/EPIC-7.md) §Out of scope.
- **No compiling of `forbiddenConstructs[].pattern`.** They are regexes; the document types
  them as bare strings and never names the dialect. Building a `RegExp` from an undeclared
  dialect is a crash or a silent mismatch, and a read tool should be neither.
- **No `format: uuid` tightening of `PATH_SEGMENT`.** See §Background.
- **No edit to EPIC-3's stale operation table.** Recorded in
  [EPIC-7](../epics/EPIC-7.md) instead; EPIC-3 is `backlog` and re-reads the document when it
  opens.

### Cross-story dependencies

- **Builds on** [US-2.4](US-2.4-tool-substrate-and-layout.md) — `registerReadTool`,
  `parseOrThrow`, and the `accountPath` this story refactors.
- **Blocks** [US-7.3](US-7.3-list-drafts-tool.md) and [US-7.4](US-7.4-list-draft-attachments-tool.md)
  — both size their cuts from the `limits` this story's TASK-7.1.1 measures.
- **Blocks** [US-7.2](US-7.2-get-draft-tool.md) and US-7.4 — both build their path with
  `draftPath`.

### References

- [Source: design spec §Substrate](../../superpowers/specs/2026-08-19-senti-authoring-read-tools-design.md)
- [Source: design spec §Measured limits](../../superpowers/specs/2026-08-19-senti-authoring-read-tools-design.md)
- [Source: implementation plan Tasks 1–2](../../superpowers/plans/2026-08-19-senti-authoring-read-tools-w34.md)
- [Source: CONTEXT D33](../../CONTEXT.md) — `draftPath` is extracted, not copied
- [Source: EPIC-2 §Cross-cutting invariants](../epics/EPIC-2.md) — the path-parameter rule this inherits

## Implementation notes

**TASK-7.1.1's live check held — the contract matches §Background exactly.** Run
2026-08-19 against `be-dev.sentitrade.xyz` with the smoke key, before any code was
written:

```
200 hardSafetyConstraints, tradingSafetyRequirements, forbiddenConstructs, limits
{"maxDrafts":20,"maxAttachmentsPerDraft":5,"maxAttachmentBytes":65536,"maxSourceBytes":196608,"maxRegisteredEas":10}
```

All five `limits` values are unchanged from §Background's figures, so this is a pass,
not a stop: `maxDrafts` 20, `maxAttachmentsPerDraft` 5, `maxAttachmentBytes` 65536
(64 KiB), `maxSourceBytes` 196608 (192 KiB), `maxRegisteredEas` 10. US-7.3 and US-7.4
can size their cuts against these numbers as measured rather than as assumed.

**The full response is 2350 bytes** (`Buffer.byteLength`, UTF-8) — 3 hard-safety
constraints, 5 trading-safety requirements, 8 forbidden constructs — confirming the
tool description's "~2 KB" claim rather than merely asserting it.

**`forbiddenConstructs[].pattern` values are still regexes.** `conventions.test.ts`'s
fixture, `#(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/)*import\b`, is the live `NO_DLL_IMPORT`
entry's `pattern`, carried through verbatim (`server.test.ts`'s own `CONVENTIONS`
fixture, per the brief's Step 7, uses the simpler `#import\\b` instead — it exercises
`TOOL_CALLS`' shared assertions, not AC-6's escapes-intact claim, so it does not need
the live pattern).

**The API-figure correction landed in three places, not the two named in TASK-7.1.5.**
Fetching `/api/v1/openapi.json` directly (same date, same key) gave **22 paths, 29
operations, 14 `GET`** — confirming the brief's 17→29 and 10→14 figures exactly. Beyond
`AGENTS.md` and `docs/CHANGELOG.md`, `README.md`'s install-section prose ("all ten
tools", the `2.0.1`-pinned example, and the version-history chain) also named a stale
tool count and a stale `latest` version; `docs/RELEASE.md` §Step 4 already requires
version-bearing README prose to move in the same commit as a tool addition, and
`scripts/release-check.mjs`'s README-currency check (a `latest`/`as of this release`
line naming a non-target semver) would have failed the release gate had that prose been
left at `2.0.1`. Corrected alongside the requested tool-table row.

**`release:check`'s "branch" and "working tree" checks do not apply pre-merge.** Run
from this story's feature branch, the gate reports every artifact check clean — the
five version strings, the `## [2.1.0]` CHANGELOG heading, `Unreleased` clear, README
currency claims, the Node floor, and "tag is free" (`v2.1.0` does not exist yet) — the
load-bearing checks this task exists to pass. Only "branch" (HEAD is not `main`) and,
pre-commit, "working tree" (uncommitted changes) fail. Per
[docs/RELEASE.md](../../RELEASE.md) §2–§5 and `.github/workflows/release.yml`'s `--ci`
flag, both checks are meant to run against a merged commit on `main` at tag time, not
against an in-progress feature branch — the same two preconditions CI's `--ci` flag
exists to skip outside a tag-triggered run. Not treated as a defect in this story's
work; every content and consistency check passed.
