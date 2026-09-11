---
id: US-6.3
title: "Resolve native plan and dependency sections in W32 and W33"
epic: EPIC-6
status: ready
priority: P2
points: 1
sprint: sprint-2026-W37
assignee: bluezdot
depends_on: [US-6.2]
created: 2026-09-11
updated: 2026-09-11
---

## Goal

Resolve the remaining half of [EPIC-6](../epics/EPIC-6.md)'s question 3 by auditing and
removing the native `## Phased plan` and `## Dependencies and sequencing constraints`
sections in [sprint-2026-W32](../sprint-2026-W32.md) and [sprint-2026-W33](../sprint-2026-W33.md),
bringing both files to the single standard sprint layout established from W34 onward.

## Background

[US-6.1](US-6.1-one-scope-table-per-sprint-file.md) established that each sprint file carries
exactly one scope table ([CONTEXT D30](../../CONTEXT.md)). [US-6.2](US-6.2-remove-the-relocated-plan-block.md)
removed the 127-line relocated Phase 3 plan block in W33 ([CONTEXT D31](../../CONTEXT.md)),
proving that its findings already lived in [EPIC-2](../epics/EPIC-2.md) and individual story files.
However, D31 left open the native `## Phased plan` and `## Dependencies and sequencing constraints`
sections in W32 (lines 48–76) and W33 (lines 80–115) because they were written for the sprint they
sit in rather than moved from elsewhere.

Every sprint file from [sprint-2026-W34](../sprint-2026-W34.md) onward omits inlined phased plans
and dependency lists — those belong in design specs, implementation plans (`docs/superpowers/plans/`),
and epic story breakdowns. W32 and W33 are the only two files retaining these legacy blocks.
Per EPIC-6 §Cross-cutting invariants, nothing that exists in exactly one place is deleted without
naming surviving copies or recording unique losses.

## Acceptance criteria

- [ ] **AC-1** — **Given** [sprint-2026-W32](../sprint-2026-W32.md)'s `## Phased plan` and
  `## Dependencies and sequencing constraints`, **When** audited against the corpus, **Then**
  every technical detail is confirmed to survive in [v1 implementation plan](../../superpowers/plans/2026-08-05-senti-mcp-server-v1.md),
  [EPIC-1](../epics/EPIC-1.md), [EPIC-2](../epics/EPIC-2.md), and [US-1.1](US-1.1-adopt-koni-docs-framework.md)
  through [US-2.3](US-2.3-live-smoke-test-and-readme.md).
- [ ] **AC-2** — **Given** [sprint-2026-W33](../sprint-2026-W33.md)'s `## Phased plan` and
  `## Dependencies and sequencing constraints`, **When** audited against the corpus, **Then**
  every technical detail is confirmed to survive in [read-tool expansion plan](../../superpowers/plans/2026-08-06-senti-read-tools-w33.md),
  [EPIC-2](../epics/EPIC-2.md), and [US-2.4](US-2.4-tool-substrate-and-layout.md) through
  [US-2.9](US-2.9-list-pending-orders-tool.md).
- [ ] **AC-3** — **Given** the audit passes, **When** both sections are removed from W32 and
  W33, **Then** neither file's `## Sprint scope`, `## Sprint goal recap`, or `## Retrospective`
  sections are modified, and both files strictly conform to the standard sprint sections.
- [ ] **AC-4** — **Given** the removal deletes prose originally protected by [CONTEXT D21](../../CONTEXT.md),
  **When** completed, **Then** a new CONTEXT entry extends D31, recording the rationale, the surviving
  copies, and any day-estimate losses.
- [ ] **AC-5** — **Given** the changes, **When** `npm run agile:validate` is run, **Then** it
  passes with zero errors.

## Tasks

- [ ] **TASK-6.3.1** — Audit W32 `## Phased plan` and `## Dependencies...` against v1 plan and US-1.1–US-2.3.
- [ ] **TASK-6.3.2** — Audit W33 `## Phased plan` and `## Dependencies...` against W33 plan and US-2.4–US-2.9.
- [ ] **TASK-6.3.3** — Remove `## Phased plan` and `## Dependencies and sequencing constraints` from `sprint-2026-W32.md`.
- [ ] **TASK-6.3.4** — Remove `## Phased plan` and `## Dependencies and sequencing constraints` from `sprint-2026-W33.md`.
- [ ] **TASK-6.3.5** — Record new CONTEXT entry extending D31.
- [ ] **TASK-6.3.6** — Run `npm run agile:validate` to verify reference integrity.

## Verification commands

| AC | Command | Expected Result |
|---|---|---|
| AC-1 | `grep -rn "Phase 1 — Documentation framework" docs/` | Matches in superpower plan / stories |
| AC-2 | `grep -rn "Phase 1 — Substrate" docs/` | Matches in superpower plan / stories |
| AC-3 | `grep -En "^## (Phased plan\|Dependencies)" docs/sprints/sprint-2026-W32.md docs/sprints/sprint-2026-W33.md` | Exit code 1 (no occurrences) |
| AC-5 | `npm run agile:validate` | `✓ all references resolve` |

## Changelog entry

None. Documentation-only; no version is cut.

## Cross-references

- [EPIC-6](../epics/EPIC-6.md) — the epic whose question 3 this resolves
- [US-6.1](US-6.1-one-scope-table-per-sprint-file.md) · [US-6.2](US-6.2-remove-the-relocated-plan-block.md) — prior stories
- [CONTEXT D30](../../CONTEXT.md) · [CONTEXT D31](../../CONTEXT.md) — scope table and prose removal precedents
- [sprint-2026-W32](../sprint-2026-W32.md) · [sprint-2026-W33](../sprint-2026-W33.md) — files being retrofitted
