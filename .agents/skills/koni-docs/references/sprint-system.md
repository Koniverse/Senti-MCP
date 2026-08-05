# Sprint System — Conventions & Workflow


**Contents**: [Naming conventions (canonical — single source of truth for sprint artifact IDs)](#naming-conventions-canonical--single-source-of-truth-for-sprint-artifact-ids) · [Story status flow](#story-status-flow) · [Deadlines vs sprint cadence](#deadlines-vs-sprint-cadence) · [Story sizing](#story-sizing) · [Scripts reference](#scripts-reference) · [5-layer consistency check (before merging)](#5-layer-consistency-check-before-merging) · [Pre-commit checklist](#pre-commit-checklist) · [Test artifacts](#test-artifacts) · [How to set up in a new project](#how-to-set-up-in-a-new-project)

## Naming conventions (canonical — single source of truth for sprint artifact IDs)

| Artifact | Pattern | Example |
|---|---|---|
| Story file | `US-<EPIC>.<N>[.<SUB>]-<slug>.md` | `US-3.7-pod-project-management.md` |
| Story `id:` frontmatter | `US-<EPIC>.<N>[.<SUB>]` | `US-3.7` |
| Task ID (inside story) | `TASK-<US-id>.<n>` | `TASK-3.7.1` |
| Epic file | `EPIC-<N>.md` or `EPIC-DS.md` | `EPIC-3.md` |
| Sprint file | `sprint-YYYY-WNN.md` | `sprint-2026-W19.md` |

## Story status flow

```
backlog → ready → in-progress → review → done
                      ↓
                   blocked  ← document reason in Implementation notes
```

**WIP limit**: at most **3 stories** `in-progress` simultaneously **by default**.

The limit is team-configurable via the `Koni-Docs Integration` block in
`CLAUDE.md`:

```yaml
koni-docs:
  agile:
    wip_limit: 3      # default 3; raise for atomic-ship sprints, lower for strict flow
```

When unset, the convention defaults to 3 (best for solo / small teams).
Larger teams may raise to 5–7. Atomic single-session ships (e.g.
agent-assisted sprints that close everything in one commit) sometimes
exceed the limit transiently — `npx koni-docs status` flags WIP violations
but does not block.

**`done` requires**: `version_shipped` set + CHANGELOG entry exists + all AC `[x]`.

### Hybrid EPIC numbering (BMad legacy + post-koni-docs)

Some Koniverse projects (e.g. senti_quant) carry **zero-padded epic IDs
from the BMad era** (`EPIC-01`..`EPIC-13`) alongside **plain epic IDs
added after koni-docs adoption** (`EPIC-14`+). Both are valid; sync
scripts treat the number as an opaque identifier.

To minimize confusion:

- **New projects**: use plain `EPIC-N` (no zero-padding) for all epics.
- **Migrated projects**: keep existing padded IDs as-is for backward
  compatibility; only new epics need plain numbering. `findEpicFile`
  matches via `startsWith(${id}.)` so file naming must match frontmatter
  `id:` exactly (`EPIC-08.md` ↔ `id: EPIC-08`, not `id: EPIC-8`).
- When `npx koni-docs backfill-fields` infers epic from story id, it emits
  plain `EPIC-N`. On a padded-ID project, hand-correct after backfill.
  (`backfill-fields` does not auto-detect the padding style; on a padded-ID project,
  hand-correct after running it.)

## Deadlines vs sprint cadence

A sprint and a deadline are different kinds of time, and keeping them apart is
the whole of this section.

- **Sprint = cadence.** It repeats. `sprint.end` is where the week stops. It is
  not a promise made to anyone outside the team.
- **`due` = commitment.** A specific date imposed from *outside* the rhythm: a
  contract date, a customer demo, an audit window, a legal filing.

**Set `due` only when the date does not coincide with the sprint rhythm.** A
story that merely has to land "this sprint" already says so through `sprint:`.
Leave `due` empty. There is deliberately **no** inheritance from `sprint.end` —
if every story carried an implicit deadline, the two that carry a real one would
be buried under twenty rows of noise. Deadlines stay rare so the warning keeps
its weight.

The *reason* for the date goes in a `## Deadline` section in the story body:
who imposed it, what breaks if it slips. The frontmatter holds the bare date and
nothing else (see [`frontmatter-spec.md` §1.1](frontmatter-spec.md)).

### Derived state — never stored

Only `due` is authored. `koni-docs status` classifies it fresh on every run
against `status` and today, so it cannot go stale:

| State | Condition |
|---|---|
| 🔴 `overdue` | `due` is in the past and the story is still open |
| 🟠 `due-soon` | `due` falls within the next N days (N = 3 by default; `--due-soon-days`) |
| 🟢 `on-track` | `due` is further out than N days |
| — | story is `done` or `deprecated` — a shipped story cannot be late |

`STATUS.md` grows a `## ⏰ Deadlines` section above the kanban columns. What `validate`
errors on and what it merely warns about is specified once, in
**[RULE-18](rules.md)** — deadlines inform; they never block a commit.

### Moving a deadline leaves a trace

**[RULE-18.3](rules.md)** — every change to an existing `due` requires a CONTEXT.md entry
(old → new → why), including a proactive push before the story is late. The rule states
the obligation and its rationale; this file states only the model it rests on.

## Story sizing

For 1 assignee / 1-week sprint, ~10-15 pt capacity baseline. Tune per-team
when actuals stabilize.

| Pts | Effort | Scope signal |
|---|---|---|
| 1 | ~½ day | Single doc, 1 stakeholder, no external dep |
| 2 | 1 day | Single template/file, internal review only |
| 3 | 2 days | Multi-doc bundle OR 1 internal integration |
| 5 | 3-4 days | Production deliverable (HTML / video / email seq) OR 1 external system integration |
| 8 | 1 week | Multi-system integration OR multi-asset sales kit OR content batch ≥3 items |
| 13 | Multi-week | Cross-product, legal/compliance loop, unknown scope — **split if possible** |

**Splitting rule** — if a story estimates > 8pt, split it. A 13pt single
story is a planning anti-pattern: it blocks a whole sprint, hides milestone
risk, and cannot be paused/handed-off mid-flight. Reference split pattern from
koni-growth (CONTEXT D15): the original "Ship payment + recurring billing"
(13pt) was split into US-1.1 "payment one-shot" (8pt) + US-1.6 "recurring +
dunning state machine" (5pt), sequenced — first story unblocks revenue, second
unblocks lifecycle automation.

**External-dependency rule** — if a story waits on a third-party system,
partner, or legal review, populate the `external_deps:` frontmatter field
(see [story template](templates/story.md) §1.frontmatter). These
stories are the most commonly undersized because dev-time excludes calendar
wait time. Example values: `[payment_gateway, resend_api, legal_review,
sales_navigator_license, partner_signature]`.

**Done-story recalibration rule** — sprint assignment of a done-story is
locked history (do not move done stories across sprints), but **points may be
recalibrated** to reflect actual effort after the fact. This is the only way
to build a real velocity baseline; leaving inflated-optimistic estimates in
place mis-calibrates every future story. Recalibration must be paired with a
CONTEXT.md decision entry naming the affected stories and reasoning.

## Scripts reference

All automation is the `@koniverse/koni-docs` CLI (`npm install --save-dev @koniverse/koni-docs`).
The **authoritative subcommand inventory, flags, and commit loops live in
[`cli.md`](cli.md)**.

The two you run around every story status change:

```bash
npx koni-docs sync --docs-path docs/     # propagate status: story → epic → PRD → sprint
npx koni-docs status --docs-path docs/   # regenerate STATUS.md + the Deadlines board (RULE-5)
```

All subcommands accept `--dry-run`. **Always run `npx koni-docs status` before
committing any story status change** — STATUS.md is auto-generated and must never
be hand-edited (RULE-5).

## 5-layer consistency check (before merging)

The five layers must be consistent after every story ships. Run `npx koni-docs sync` to propagate automatically.

| Layer | File | What to verify |
|---|---|---|
| 1 — Story | `docs/sprints/stories/US-X.Y-*.md` | `status: done`, `version_shipped` set, all AC + Tasks `[x]` |
| 2 — Epic | `docs/sprints/epics/EPIC-N.md` | Story row checked off; epic `status` updated if all stories done |
| 3 — PRD | `docs/PRD.md` | `Functional Requirements` row `✅ shipped (vX.Y.Z)`; `Epics & User Stories` entry `✅ Done (vX.Y.Z)` |
| 4 — Sprint | `docs/sprints/sprint-YYYY-WNN.md` | Story row shows done + version |
| 5 — STATUS | `docs/sprints/STATUS.md` | Regenerated by `npx koni-docs status` |

Inconsistency between any two layers = documentation debt. Fix in same commit as the feature.

## Pre-commit checklist

**Single source: [SKILL.md §3c](../SKILL.md).**

## Test artifacts

Per-story Acceptance Criteria (`stories/US-X.Y-<slug>.md` §4) + Verification commands (§11) remain the source of truth for what each individual story must prove. Two additional artifact types capture what AC cannot:

| Artifact | Location | Owns |
|---|---|---|
| Test cases | `docs/tests/test-cases/EPIC-N.md` (one per epic) | End-to-end scenarios spanning ≥2 stories; regression scenarios for cross-story invariants; smoke; coverage matrix (AC → TC) |
| Test report — per-execution | `docs/tests/test-reports/EPIC-NN/<MMDDYYYY>/report.md` (auto) · `report-manual.md` (manual) — path owned by koni-qc test-organization | Execution log: who ran which TCs in which env against which commit, pass/fail per TC, failure reproduction detail |
| Test report — per-release | `docs/tests/test-reports/releases/vX.Y.Z.md` | Release-level aggregate of run files; outstanding risks; named ship-decision sign-off |

**Promotion rule** — keep a scenario inside the story file unless one of:

- it spans ≥2 stories in the same epic (E2E),
- it guards an epic-level invariant or past bug (REG),
- it runs on a different cadence than per-PR (smoke / nightly perf / security).

**Test-cases file structure (audience: tester / reviewer)** — every `EPIC-N.md` file follows this 10-section skeleton (see [`templates/test-cases.md`](templates/test-cases.md) §2 Section index):

1. Frontmatter — YAML metadata, no `status`
2. Overview — Scope (paragraph + "Out of scope" bullets)
3. Overview — Stories in scope (table `| Story | Short name | Status |` with emoji)
4. Overview — Goals (3-5 bullets stating high-level invariants the suite proves)
5. Overview — Environment & test data
6. Overview — Cadence & ownership
7. Quick reference — scenarios summary (table `| # | ID | Type | Priority | Short description | Stories | Mode |` — single-row scan of every TC)
8. Test scenarios (H3 per TC with YAML + Gherkin + Preconditions + Test data + Notes)
9. Coverage matrix (table `| Story | AC | AC description | Covered by | Type |` — Story column inlines short name, AC description distills story AC text in ≤80 chars)
10. Open / deferred scenarios

The Stories-in-scope / Goals / Quick-reference triad up front lets a tester understand scope + run sequence in ≤2 minutes without scrolling through Gherkin. The Coverage matrix's inline short name + AC description columns mean each row is self-explanatory — no story-file lookup needed.

**Lifecycle (per-TC, implicit — no frontmatter status)** — `draft` until §Coverage matrix row + `maps_to.ac` are populated → `ready`. Execution state lives only in `test-reports/EPIC-NN/<MMDDYYYY>/report.md`. Deprecate by replacing the H3 body with `**Deprecated YYYY-MM-DD** — <reason>` and keeping the ID intact.

**Append-only discipline (reports)** — an automated `report.md` is reporter-owned and re-derived each run (its history lives in git + the per-release aggregate); a manual `report-manual.md` is append-only — a re-run gets a new dated folder, never a `-runN` suffix. A release file's `ship_status` may flip `held → shipped` or `shipped → rolled-back`, recorded as a dated paragraph under §Ship decision. Reports are never deleted.

**Templates**: [`test-cases.md`](templates/test-cases.md) · [`test-report.md`](templates/test-report.md) (two sub-templates: per-execution + per-release).

**Folder layout**: the `docs/tests/` taxonomy (test-cases + test-reports) is owned by **koni-qc** — see its `references/test-organization.md`. koni-docs owns the templates that fill those folders, not the folders' shape.

**These artifacts are authored by hand today.** Automation (a test-sync script, a RULE requiring test-cases before an epic closes, a Playwright → markdown converter) is not built; koni-qc owns that roadmap.

## How to set up in a new project

1. Create the `docs/` directory structure per the orientation in SKILL.md §0
2. Add the CLAUDE.md integration block (see [`templates/integration.md`](templates/integration.md))
3. Add the AGENTS.md reference block (see [`templates/integration.md`](templates/integration.md) §3)
4. Create initial `VERSION` file (e.g., `0.1.0`)
5. Create initial `CHANGELOG.md` with `[Unreleased]` section
6. If using sprints, create `docs/sprints/` with `stories/`, `epics/`, `archive/` subdirectories
7. Run `npx koni-docs status` to generate initial STATUS.md
