---
id: US-9.6
title: "operationId doc corrections and a spec-drift check"
epic: EPIC-9
status: backlog
priority: P3
points: 2
sprint:
assignee: bluezdot
created: 2026-09-14
updated: 2026-09-15
---

## Goal

The docs stop saying the API has no `operationId`s, stop miscounting its operations, and stop
linking a review file that is not here. And because Senti now owns 21 of this server's tool
names as `operationId`s, a check notices the day one of them — or its path — moves.

## Background

### What the docs say that is no longer true

Senti US-46.46 put an `operationId` on every operation — 31 across 23 paths since US-46.49
added `getDraftCompileLog` (served document of 2026-09-15). 21 are the camelCase of this repo's
tool names — a deliberate choice on the Senti side, which makes those names a contract Senti
now owns. The ten it coined are `linkAccount`, `deployStrategy`, `stopStrategy`,
`closePosition`, `closeAllPositions`, `cancelOrder`, `cancelAllOrders`, `registerDraftAsEa`,
`getDraftAttachment` and `getDraftCompileLog` — the last two the camelCase of the tools
[US-9.2](US-9.2-get-draft-attachment-tool.md) and [US-9.3](US-9.3-get-draft-compile-log-tool.md)
add, so after them the count of matching names is 23.

- `docs/superpowers/specs/2026-08-05-senti-mcp-server-design.md:47` — *"No `operationId`
  anywhere."* — and `:73`, where the rejected codegen alternative *"founders on the missing
  `operationId`s"*.
- `docs/sprints/stories/US-2.1-authenticated-senti-api-client.md:142` — the same claim.
- `AGENTS.md:15` — *"29 operations across 22 paths"*; `:113` — *"15 of the 29 operations are
  writes"*; `:33` and `:79` — *"all 14 of the API's `GET` operations now have a tool"*, false
  since `getDraftAttachment` became the 15th `GET` with no tool.
- `README.md:136` — *"every `GET` operation"*.

**Specs and closed stories are records.** They were true when written. They get a dated note
saying what changed, not a rewrite that erases what the author knew.

**The design's conclusion survives.** Tools stay hand-written: the design's second reason —
that the model-facing descriptions decide whether a tool is called correctly and cannot be
generated — is untouched.

### The dead links

The 2026-08-19 contract review lives at `Senti-Quant/draft/senti-api-contract-audit.md`,
outside this repo; its header says it was written for hand-off and meant to be moved. The
links to it from [EPIC-8](../epics/EPIC-8.md), [US-8.4](US-8.4-compile-draft-and-epic-close.md)
and the [authoring write design spec](../../superpowers/specs/2026-08-21-senti-authoring-write-tools-design.md)
resolve to a file that does not exist here. So does CONTEXT D44's — but CONTEXT is append-only
(RULE-7), so that link is corrected by the D44 revision
[US-9.4](US-9.4-typed-diagnostics-and-path-segments.md) appends, not by an edit.

### The drift check

The tools are hand-written, so nothing fails when Senti moves a path or renames an
`operationId`: the first sign is a `404` in a user's session. The served document needs no key
(fetched without one on 2026-09-14), so the opt-in smoke suite can compare it to a hand-written
table of this server's tools and fail the moment they part.

## Acceptance criteria

- [ ] **AC-1** — The design spec at `:47` and `:73` carries a dated note that the API has had
  `operationId`s since Senti US-46.46, and that tools stay hand-written for the design's second
  reason. The original sentences stay.
- [ ] **AC-2** — `US-2.1:142` carries the same dated note.
- [ ] **AC-3** — `AGENTS.md` states the operation count, the write count, and the
  `GET`-to-tool coverage as they are when this story lands.
- [ ] **AC-4** — `README.md:136` states the same coverage.
- [ ] **AC-5** — The links to the contract review in EPIC-8, US-8.4 and the write spec resolve:
  to a URL in the Senti-Quant repository if the file is committed there, otherwise to a stated
  location with no link. `docs/CONTEXT.md` is not edited.
- [ ] **AC-6** — **Given** `npm run test:smoke`, **When** the drift leg runs, **Then** for every
  tool this server registers, the served document has its method and path, **And** that
  operation's `operationId` is the camelCase of the tool name.
- [ ] **AC-7** — **Given** the same run, **When** the document has a `GET` operation with no
  tool, **Then** stderr lists it. It does not fail the run: a new route is a gap to measure, not
  a broken contract.
- [ ] **AC-8** — No `VERSION` bump. Nothing in the tarball changes; the CHANGELOG entry goes
  under `## [Unreleased]`.

## Tasks

- [ ] **TASK-9.6.1** — Correct the record (AC: 1, 2, 3, 4)
  - [ ] Dated notes in the design spec and US-2.1
  - [ ] `AGENTS.md` and `README.md` counts, re-counted from the served document on the day
- [ ] **TASK-9.6.2** — The review's links (AC: 5)
  - [ ] Establish whether `senti-api-contract-audit.md` is committed in `Koniverse/Senti-Quant`;
        point the three links at it, or say where it is
- [ ] **TASK-9.6.3** — The drift leg (AC: 6, 7)
  - [ ] `src/smoke.test.ts`: fetch `${SENTI_API_BASE_URL}/api/v1/openapi.json`; a table of
        `{ tool, method, path }` for every registered tool; assert and report as above
- [ ] **TASK-9.6.4** — Close (AC: 8)
  - [ ] `docs/CHANGELOG.md` `## [Unreleased]`

## Dev notes

### Architecture constraints

- **The drift check lives in the opt-in smoke suite, not in `npm test`.** It needs the network,
  and `npm test` is hermetic by design.
- **The table is hand-written**, beside the tools, rather than read from `src/server.ts`. A
  table derived from the code it checks proves only that the code agrees with itself.
- **Write tools are included**, whether or not `SENTI_ENABLE_AUTHORING_WRITE` is set for the
  run. The check is about names and paths, and it calls nothing.

### Cross-story dependencies

- **Lands after** [US-9.2](US-9.2-get-draft-attachment-tool.md) and
  [US-9.3](US-9.3-get-draft-compile-log-tool.md), so the counts are written once and the drift
  table includes both new tools. Not a hard dependency; landing earlier means re-counting later.

### What we explicitly did NOT do

- **No codegen from `operationId`s** — [EPIC-9](../epics/EPIC-9.md) §Out of scope.
- **No schema-level drift check.** Comparing each tool's zod schema to the document's component
  is a much larger check, and `parseOrThrow` already fails loudly on the shapes the tools read.
  Trigger: a shape change that reaches users before the parse catches it.

### References

- [Source: EPIC-9 §The hand-off, checked](../epics/EPIC-9.md)
- [Source: v1 design spec §Approach](../../superpowers/specs/2026-08-05-senti-mcp-server-design.md)

## Verification commands

| AC | Command |
|---|---|
| AC-1, AC-2 | `grep -n "US-46.46" docs/superpowers/specs/2026-08-05-senti-mcp-server-design.md docs/sprints/stories/US-2.1-authenticated-senti-api-client.md` prints three lines |
| AC-3, AC-4 | `grep -n "29 operations\|all 14 of the API" AGENTS.md README.md` prints nothing |
| AC-5 | `grep -rn "senti-api-contract-audit.md" docs/sprints docs/superpowers` — every hit resolves |
| AC-6, AC-7 | `npm run test:smoke` — the `[smoke] drift` lines |
| AC-8 | `git diff --stat -- VERSION package.json src/config.ts` prints nothing |

## Changelog entry

### Added
- The opt-in smoke suite checks every tool's method, path and `operationId` against the served
  OpenAPI document.

## Implementation notes

_Empty until work starts._

## Cross-references

- [EPIC-9](../epics/EPIC-9.md) · [US-2.1](US-2.1-authenticated-senti-api-client.md)
