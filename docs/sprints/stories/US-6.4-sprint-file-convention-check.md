---
id: US-6.4
title: "Automated sprint file convention check"
epic: EPIC-6
status: ready
priority: P2
points: 2
sprint: sprint-2026-W37
assignee: bluezdot
depends_on: [US-6.3]
created: 2026-09-11
updated: 2026-09-11
---

## Goal

Settle [EPIC-6](../epics/EPIC-6.md)'s question 5 — *is the convention enforced by anything,
or is it prose?* — by implementing an automated checker script that validates every sprint
file in `docs/sprints/sprint-*.md` against the structure conventions established in
[CONTEXT D30](../../CONTEXT.md) and [CONTEXT D31](../../CONTEXT.md).

## Background

[EPIC-5](../epics/EPIC-5.md) §Cross-cutting invariants stated bluntly that a requirement written
only as prose is not enforced. Prior to EPIC-6, nothing stopped sprint files from proliferating
scope tables and narrative blocks, which is how W33 reached four scope tables and 584 lines.
While US-6.1 and US-6.2 established the convention in prose and retrofitted the historical files,
question 5 remained open: without an automated gate, nothing in the repo prevents future sprint
files from regressing.

This story adds `scripts/check-sprint-files.mjs` and exposes it via `npm run agile:check-sprints`.
The script verifies that each sprint file adheres strictly to the single-scope-table rule and
carries no prohibited planning narrative sections.

## Acceptance criteria

- [ ] **AC-1** — **Given** `scripts/check-sprint-files.mjs`, **When** executed, **Then** it scans
  all sprint files matching `docs/sprints/sprint-*.md` without hardcoding individual file names.
- [ ] **AC-2** — **Given** any sprint file, **When** checked, **Then** it must contain exactly
  one `## Sprint scope` section with a valid markdown table, and zero secondary scope sections.
- [ ] **AC-3** — **Given** any sprint file, **When** checked, **Then** it must not contain
  prohibited legacy narrative sections: `## Phased plan`, `## Dependencies and sequencing constraints`,
  or `## Risks & dependencies`.
- [ ] **AC-4** — **Given** a sprint file with mid-window additions, **When** checked, **Then**
  annotated rows match the standard format `_(added YYYY-MM-DD)_` (or `*(added …)*`).
- [ ] **AC-5** — **Given** a conforming repository state, **When** `node scripts/check-sprint-files.mjs`
  runs, **Then** it exits with code 0 and reports all files passed.
- [ ] **AC-6** — **Given** a deliberately broken file (e.g. adding a second `## Sprint scope`),
  **When** checked, **Then** the script exits with non-zero code and logs the exact file and violation.
- [ ] **AC-7** — **Given** `package.json`, **When** inspected, **Then** `"agile:check-sprints"`
  is registered under `"scripts"` and runs `node scripts/check-sprint-files.mjs`.

## Tasks

- [ ] **TASK-6.4.1** — Write `scripts/check-sprint-files.mjs` implementing AC-1 through AC-4.
- [ ] **TASK-6.4.2** — Add negative test / fixture verification to ensure violations trigger exit code 1.
- [ ] **TASK-6.4.3** — Wire `"agile:check-sprints": "node scripts/check-sprint-files.mjs"` in `package.json`.
- [ ] **TASK-6.4.4** — Run `npm run agile:check-sprints` against current sprint files and ensure green run.
- [ ] **TASK-6.4.5** — Close out EPIC-6 questions 5 and update EPIC-6 status.

## Verification commands

| AC | Command | Expected Result |
|---|---|---|
| AC-1–5 | `node scripts/check-sprint-files.mjs` | Exit code 0, all files ok |
| AC-6 | Deliberate invalid header test | Exit code 1, violation reported |
| AC-7 | `npm run agile:check-sprints` | Command executes and passes |

## Changelog entry

None. Tooling and documentation enforcement; no production version bump.

## Cross-references

- [EPIC-6](../epics/EPIC-6.md) — question 5 resolution and closure
- [US-6.1](US-6.1-one-scope-table-per-sprint-file.md) · [US-6.2](US-6.2-remove-the-relocated-plan-block.md) · [US-6.3](US-6.3-resolve-native-plan-blocks-in-w32-w33.md)
- [CONTEXT D30](../../CONTEXT.md) — one scope table rule
- [package.json](../../../package.json)
