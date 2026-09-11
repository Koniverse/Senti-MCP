---
id: US-6.3
title: "Sprint file convention cleanup and automated enforcement"
epic: EPIC-6
status: done
priority: P2
points: 3
sprint: sprint-2026-W37
assignee: bluezdot
depends_on: [US-6.2]
created: 2026-09-11
updated: 2026-09-11
---

## Goal

Resolve the two remaining open questions of [EPIC-6](../epics/EPIC-6.md) (Question 3 remainder and Question 5)
in a single pass:
1. Audit and remove the native `## Phased plan` and `## Dependencies and sequencing constraints` sections
   in [sprint-2026-W32](../sprint-2026-W32.md) and [sprint-2026-W33](../sprint-2026-W33.md) after verifying
   surviving copies, bringing historical files into alignment with the W34+ standard layout.
2. Implement an automated sprint checker script (`scripts/check-sprint-files.mjs` exposed via `npm run agile:check-sprints`)
   so that all sprint files are programmatically validated against [CONTEXT D30](../../CONTEXT.md) and
   [CONTEXT D31](../../CONTEXT.md) conventions.

Closing this story resolves the remaining open questions and closes [EPIC-6](../epics/EPIC-6.md).

## Background

[US-6.1](US-6.1-one-scope-table-per-sprint-file.md) established the single-scope-table rule ([CONTEXT D30](../../CONTEXT.md)),
and [US-6.2](US-6.2-remove-the-relocated-plan-block.md) removed W33's relocated 127-line Phase 3 plan block ([CONTEXT D31](../../CONTEXT.md)).
However, two questions remained open:
- **Question 3 remainder**: W32 and W33 still contained native `## Phased plan` and `## Dependencies and sequencing constraints`
  blocks written for their respective sprints.
- **Question 5**: The structure rules remained purely prose; nothing in CI or local tooling prevented a new sprint file from
  introducing extra scope tables or forbidden narrative sections.

By combining the historical cleanup with automated validation, the newly built checker validates all files (W32 through W37)
in an end-to-end green run.

## Acceptance criteria

### Part 1: Historical Sprint Cleanup (Question 3)
- [x] **AC-1** — **Given** [sprint-2026-W32](../sprint-2026-W32.md)'s `## Phased plan` and
  `## Dependencies and sequencing constraints`, **When** audited against the corpus, **Then**
  every technical detail is confirmed to survive in [v1 implementation plan](../../superpowers/plans/2026-08-05-senti-mcp-server-v1.md),
  [EPIC-1](../epics/EPIC-1.md), [EPIC-2](../epics/EPIC-2.md), and [US-1.1](US-1.1-adopt-koni-docs-framework.md)
  through [US-2.3](US-2.3-live-smoke-test-and-readme.md).
- [x] **AC-2** — **Given** [sprint-2026-W33](../sprint-2026-W33.md)'s `## Phased plan` and
  `## Dependencies and sequencing constraints`, **When** audited against the corpus, **Then**
  every technical detail is confirmed to survive in [read-tool expansion plan](../../superpowers/plans/2026-08-06-senti-read-tools-w33.md),
  [EPIC-2](../epics/EPIC-2.md), and [US-2.4](US-2.4-tool-substrate-and-layout.md) through
  [US-2.9](US-2.9-list-pending-orders-tool.md).
- [x] **AC-3** — **Given** the audit passes, **When** both sections are removed from W32 and
  W33, **Then** neither file's `## Sprint scope`, `## Sprint goal recap`, or `## Retrospective`
  sections are modified, and both files strictly conform to the standard sprint sections.
- [x] **AC-4** — **Given** the removal deletes prose originally protected by [CONTEXT D21](../../CONTEXT.md),
  **When** completed, **Then** a new CONTEXT entry extends D31, recording the rationale, the surviving
  copies, and any day-estimate losses.

### Part 2: Automated Enforcement (Question 5)
- [x] **AC-5** — **Given** `scripts/check-sprint-files.mjs`, **When** executed, **Then** it scans
  all sprint files matching `docs/sprints/sprint-*.md` without hardcoding individual file names.
- [x] **AC-6** — **Given** any sprint file, **When** checked, **Then** it must contain exactly
  one `## Sprint scope` section with a valid markdown table, and zero secondary scope sections.
- [x] **AC-7** — **Given** any sprint file, **When** checked, **Then** it must not contain
  prohibited legacy narrative sections: `## Phased plan`, `## Dependencies and sequencing constraints`,
  or `## Risks & dependencies`.
- [x] **AC-8** — **Given** a sprint file with mid-window additions, **When** checked, **Then**
  annotated rows match the standard format `_(added YYYY-MM-DD)_` (or `*(added …)*`).
- [x] **AC-9** — **Given** a conforming repository state, **When** `node scripts/check-sprint-files.mjs`
  runs, **Then** it exits with code 0 and reports all sprint files passed.
- [x] **AC-10** — **Given** `package.json`, **When** inspected, **Then** `"agile:check-sprints"`
  is registered under `"scripts"` and runs `node scripts/check-sprint-files.mjs`.

### Part 3: Epic Closure
- [x] **AC-11** — **Given** all acceptance criteria above are satisfied, **When** documentation is finalized,
  **Then** [EPIC-6](../epics/EPIC-6.md) status flips to `done`.

## Tasks

- [x] **TASK-6.3.1** — Audit W32 native plan & dependency text against v1 plan and stories US-1.1–US-2.3.
- [x] **TASK-6.3.2** — Audit W33 native plan & dependency text against W33 plan and stories US-2.4–US-2.9.
- [x] **TASK-6.3.3** — Remove `## Phased plan` and `## Dependencies and sequencing constraints` from `sprint-2026-W32.md`.
- [x] **TASK-6.3.4** — Remove `## Phased plan` and `## Dependencies and sequencing constraints` from `sprint-2026-W33.md`.
- [x] **TASK-6.3.5** — Write `scripts/check-sprint-files.mjs` implementing AC-5 through AC-8.
- [x] **TASK-6.3.6** — Wire `"agile:check-sprints"` in `package.json`.
- [x] **TASK-6.3.7** — Record new CONTEXT entry extending D31 to resolve Question 3 & Question 5 (D47).
- [x] **TASK-6.3.8** — Run `npm run agile:check-sprints`, `npm run agile:validate`, and `npm run agile:status`.
- [x] **TASK-6.3.9** — Flip [EPIC-6](../epics/EPIC-6.md) to `done`.

## Verification commands

| AC | Command | Result |
|---|---|---|
| AC-1–3 | `grep -En "^## (Phased plan\|Dependencies)" docs/sprints/sprint-*.md` | Exit code 1 (zero occurrences) |
| AC-5–9 | `node scripts/check-sprint-files.mjs` | `check-sprint-files: all 6 sprint files conform to conventions.` |
| AC-10 | `npm run agile:check-sprints` | Command executes cleanly with code 0 |
| Docs | `npm run agile:validate` | `✓ all references resolve` |

## Changelog entry

None. Tooling and documentation enforcement; no production version bump.

## Implementation notes

### All 5 Questions of EPIC-6 Settled
- Question 1 (scope table contents): Settled by US-6.1 / D30.
- Question 2 (D21 relation): Settled by US-6.1 / D30 & US-6.2 / D31.
- Question 3 (where displaced content goes): Relocated block deleted by US-6.2 / D31; native blocks in W32 & W33 deleted by US-6.3 / D47 after verifying all technical details survive in plans and story files.
- Question 4 (retrospectives stay): Settled by US-6.1 / D30.
- Question 5 (automated enforcement): Settled by US-6.3 / D47 via `scripts/check-sprint-files.mjs` and `npm run agile:check-sprints`.

## Files modified

- `docs/sprints/stories/US-6.3-sprint-file-convention-cleanup-and-enforcement.md` — story completed
- `docs/sprints/sprint-2026-W32.md` — removed native plan and dependency sections (-29 lines)
- `docs/sprints/sprint-2026-W33.md` — removed native plan and dependency sections (-36 lines)
- `scripts/check-sprint-files.mjs` — automated convention checker script
- `package.json` — added `agile:check-sprints`
- `docs/CONTEXT.md` — recorded D47
- `docs/sprints/epics/EPIC-6.md` — flipped to `done`
- `docs/sprints/sprint-2026-W37.md` — US-6.3 row marked `done`
- `docs/sprints/STATUS.md` — regenerated

## Cross-references

- [EPIC-6](../epics/EPIC-6.md) — the epic this story resolves and closes
- [US-6.1](US-6.1-one-scope-table-per-sprint-file.md) · [US-6.2](US-6.2-remove-the-relocated-plan-block.md) — prior stories
- [CONTEXT D30](../../CONTEXT.md) · [CONTEXT D31](../../CONTEXT.md) · [CONTEXT D47](../../CONTEXT.md) — sprint layout conventions
- [sprint-2026-W32](../sprint-2026-W32.md) · [sprint-2026-W33](../sprint-2026-W33.md) · [sprint-2026-W37](../sprint-2026-W37.md)
