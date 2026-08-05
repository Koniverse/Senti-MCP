# Test Report — Full Template

> **File locations** (the *path* is owned by the koni-qc **test-organization**
> standard; this template owns the *body* you write at that path):
> - Per-execution (auto): `docs/tests/test-reports/EPIC-NN/<MMDDYYYY>/report.md`
>   — the runner/reporter is the only writer (koni-qc `test-automation.md` §2).
> - Per-execution (manual run): same folder, `report-manual.md`.
> - Per-release aggregate: `docs/tests/test-reports/releases/vX.Y.Z.md`
>   (a cross-epic rollup, linked from CHANGELOG.md).
>
> This **supersedes the legacy `test-reports/runs/YYYY-MM-DD-EPIC-N-runN.md` path**
> wherever koni-qc is adopted — the run folder groups **by epic** (`EPIC-NN/`) then
> by **`MMDDYYYY`** date, never a flat `runs/` dir or ISO date. Older `runs/...`
> filenames in the examples below are illustrative of the *body*, not the path.
>
> **Use when**: A test-cases file ([template](test-cases.md)) has just been
> executed (manually or by CI), or a release is shipping and needs an
> aggregate test summary that ships alongside CHANGELOG.md.
>
> **One rule above all others**: a test report is **history, not a scratchpad** —
> never hand-edit result fields. For an **automated** `report.md` the runner is the
> sole writer and re-derives it each run (history lives in git + the per-release
> aggregate §B). For a **manual** `report-manual.md`, treat it as append-only: don't
> rewrite a recorded run — add a new dated folder for a re-run. The reason a test
> failed and was then re-run is itself a signal worth preserving.


**Contents**: [1. Two sub-templates in this file](#1-two-sub-templates-in-this-file) · [2. Sub-template A — Per-execution detail](#2-sub-template-a--per-execution-detail) · [3. Sub-template B — Per-release master](#3-sub-template-b--per-release-master) · [4. Conventions shared across both sub-templates](#4-conventions-shared-across-both-sub-templates) · [5. Filled mini-example — Per-execution](#5-filled-mini-example--per-execution) · [6. Filled mini-example — Per-release](#6-filled-mini-example--per-release) · [7. Cross-references](#7-cross-references)

---

## 1. Two sub-templates in this file

| Sub-template | Path | Purpose |
|---|---|---|
| **A. Per-execution detail** | `test-reports/EPIC-NN/<MMDDYYYY>/report.md` (auto) · `report-manual.md` (manual) | One file per test run. Captures who ran what, in which env, against which commit, and the pass/fail of each TC. |
| **B. Per-release master** | `test-reports/releases/vX.Y.Z.md` | One file per shipped version. Aggregates run files into a release-level summary, linked from CHANGELOG.md. |

Both share frontmatter conventions (date / commit / version) but differ in
body: A is granular (per-TC results + failure detail), B is aggregate
(epic-by-epic coverage + outstanding risks).

---

## 2. Sub-template A — Per-execution detail

### A.1 File location & naming

`docs/tests/test-reports/EPIC-NN/<MMDDYYYY>/report.md` (auto) · `report-manual.md` (manual)

- `EPIC-NN` groups the run by the epic whose test-cases were executed (mandatory level).
- `<MMDDYYYY>` is the run date, e.g. `07012026` — **not** ISO `YYYY-MM-DD`.
- The reporter is the only writer of `report.md`; a hand-run goes in `report-manual.md`
  in the same folder. A same-day re-run overwrites `report.md` (the run is re-derived
  from the suite); append-only history is preserved by the per-release aggregate (§B)
  and git, not by `-runN` filenames. (Legacy layout: `runs/YYYY-MM-DD-EPIC-N-runN.md`,
  now superseded — koni-qc `test-organization.md` §1.)

Examples:
- `EPIC-02/05152026/report.md` — EPIC-02 run on 2026-05-15 (re-run overwrites; git keeps history)
- `EPIC-02/05152026/report-manual.md` — a manual run of EPIC-02 the same day
- `EPIC-03/05152026/report.md` — separate epic, same day

### A.2 Full skeleton

````markdown
---
epic: EPIC-N
run_id: YYYY-MM-DD-EPIC-N-runN
run_at: YYYY-MM-DDTHH:MM:SS+07:00     # ISO 8601 with timezone
env: staging                          # local | staging | production
version: vX.Y.Z                       # release / build tag at run time
commit: <full git SHA>
executor: <name or "CI">
trigger: per-release                  # per-PR | per-release | per-sprint | nightly | on-demand
---

## Summary

| Result | Count |
|---|---|
| Pass | N |
| Fail | N |
| Skip | N |
| **Total** | N |

**Duration:** <human-readable, e.g. "12m 34s">

## Scope

<1–3 sentences: which TC IDs were in scope this run, and which were
intentionally skipped (with reason). Link to the test-cases file.>

- Source: [docs/tests/test-cases/EPIC-N.md](../../test-cases/EPIC-N.md)
- In scope: `TC-N.E2E-*`, `TC-N.SMK-*`
- Skipped: `TC-N.PRF-*` (perf budget not yet defined — see test-cases §7)

## Results per test-case

| TC ID | Result | Duration | Notes / log link |
|---|---|---|---|
| TC-N.E2E-1 | ✅ pass | 2m 15s | — |
| TC-N.E2E-2 | ❌ fail | 1m 02s | See §Failures TC-N.E2E-2 |
| TC-N.REG-1 | ✅ pass | 0m 30s | — |
| TC-N.SMK-1 | ⏭️ skip | — | env=staging; smoke runs only on local |

## Failures (detail)

<One subsection per failing TC. Include enough detail that a different
person can reproduce the failure without asking the executor. Attach
screenshots / logs via MinIO presigned URL when applicable.>

### TC-N.E2E-2

- **Expected:** <observable outcome from the Gherkin Then-clause>
- **Actual:** <what happened instead>
- **Reproduction:**
  1. <step>
  2. <step>
- **Logs:** [minio://test-artifacts/runs/<run_id>/TC-N.E2E-2.log](minio://...)
- **Screenshots:** [minio://test-artifacts/runs/<run_id>/TC-N.E2E-2.png](minio://...)
- **Suspected cause:** <hypothesis>
- **Triage status:** open / re-run scheduled / bug filed (link issue)

## Follow-up

<Actions the run surfaced. Bug tickets opened, LESSONS.md entries
appended, scenarios moved to deferred, regressions to add to the
test-cases file.>

- Bug filed: [#<issue>](<URL>) — root cause for TC-N.E2E-2.
- LESSONS.md §M appended — flaky retry pattern.
- TC-N.PRF-1 promoted from §7 deferred to §5 in test-cases file (now ready).
````

### A.3 Per-section guidance

#### Frontmatter

- `run_at` ISO 8601 with timezone — never bare local time. The run log is
  used for forensics; "what time zone was this in?" is a question we
  refuse to entertain.
- `commit` is the SHA of the deployed build, not of the test-cases file.
  These can diverge.
- `executor` is a GitHub login or `"CI"`. Never anonymous.
- `trigger` matches one of the cadence values in the test-cases file
  §Cadence & ownership.

#### Summary

- Total must equal Pass + Fail + Skip — sanity check by reviewers.
- Duration is the wall-clock end-to-end, not the sum of per-TC durations.

#### Scope

- Always link to the test-cases file. Reviewers need to navigate to the
  Gherkin scenarios without grepping.
- Skipped TCs must state WHY (env mismatch, deferred, broken fixture).
  An unexplained skip is a smell.

#### Results per test-case

- Result emojis are stable across the system: `✅ pass / ❌ fail / ⏭️ skip / ⚠️ flake`.
- Use `⚠️ flake` for tests that pass on retry — adds visibility to
  flakiness without inflating fail count.
- "Notes / log link" — for pass, leave `—`. For fail, point to §Failures.

#### Failures

- Reproducibility is non-negotiable. A failure without reproduction steps
  is not a useful report.
- Log + screenshot URLs should resolve from MinIO (preferred) or any
  durable artifact store. Avoid local file paths.

#### Follow-up

- Append-only. If the bug is later fixed, the fix goes into the NEXT run
  file's Summary, not by editing this report.

---

## 3. Sub-template B — Per-release master

### B.1 File location & naming

`docs/tests/test-reports/releases/vX.Y.Z.md`

- `vX.Y.Z` is the semver from [VERSION](../../../../VERSION) at release time.
- Created at the same commit as the CHANGELOG entry — link both ways.

### B.2 Full skeleton

````markdown
---
version: vX.Y.Z
released_at: YYYY-MM-DD
commit: <SHA of the release commit>
epics_covered: [EPIC-N, EPIC-M]
ship_status: shipped                  # shipped | held | rolled-back
---

## Release scope

<2–4 sentences naming the stories shipped in this version and the epics
they belong to. Link to CHANGELOG.md vX.Y.Z section for the canonical
list. Do not duplicate the changelog body here.>

- See [CHANGELOG.md vX.Y.Z](../../../CHANGELOG.md#vxyz)
- Stories shipped: [US-X.Y](../../../sprints/stories/US-X.Y-<slug>.md), [US-X.Z](../../../sprints/stories/US-X.Z-<slug>.md)

## Test coverage

| Epic | Total TC | Pass | Fail | Skip | Coverage % | Notes |
|---|---|---|---|---|---|---|
| [EPIC-N](../../../sprints/epics/EPIC-N.md) | N | N | 0 | N | M% | <one-line caveat> |
| [EPIC-M](../../../sprints/epics/EPIC-M.md) | N | N | 0 | N | M% | — |

> **Coverage % formula:** `pass / (total − skip)` rounded to integer.
> Skipped TCs are not counted as failures, but the Notes column must
> explain why they were skipped at release time.

## Run history (links to per-execution detail)

<Append every run that contributed to this release decision. Most
recent first.>

- [EPIC-02/05152026](../EPIC-02/05152026/report.md) — ✅ pass (re-run after fixing flake)
- [EPIC-02/05142026](../EPIC-02/05142026/report.md) — ⚠️ 1 flake (TC-02.E2E-2)
- [EPIC-03/05142026](../EPIC-03/05142026/report.md) — ✅ pass

## Outstanding risks

<Risks that DID NOT block this release but the team must track. Each
item names an owner + a target sprint or release to resolve.>

- **TC-N.E2E-2 flaked once on Safari** — owner `@qa-lead`. Target: next sprint. See LESSONS §N.
- **TC-N.PRF-1 not run** — owner `@infra-lead`. Target: v0.X+1 once perf budget defined in [EPIC-N §14](../../../sprints/epics/EPIC-N.md#performance-budgets--invariants).

## Ship decision

<One short paragraph: who signed off, what was the risk calculation,
any conditions attached to the release.>

- **Signed off by:** `<name>` (`<role>`) on YYYY-MM-DD
- **Conditions:** <e.g. "monitor EPIC-02 health dashboards for 48h, rollback trigger: >2% terminalStatus=UNREACHABLE">
````

### B.3 Per-section guidance

#### Frontmatter

- `ship_status` lifecycle: `held` while QA is running, `shipped` after
  go-decision, `rolled-back` if reverted. Never delete the file — flip
  the status.
- `epics_covered` lists ONLY the epics whose stories shipped in this
  version. Epics whose tests were re-run but had no story change do not
  belong here.

#### Test coverage

- One row per epic touched by the release.
- A row with 0 total TC indicates the epic has no test-cases file yet —
  flag in Notes (`test-cases file pending`).
- Coverage % is a directional metric, not a contract. A release can ship
  at <100% if Outstanding risks documents the gap and the ship decision
  accepts it.

#### Run history

- Append-only, most-recent-first. The history is a forensic trail.
- A re-run after a flake is fine; do not delete the flake run.

#### Outstanding risks

- This section is the most-read by stakeholders. Be specific. "Some
  tests flaky" is not a risk; "TC-02.E2E-2 flaked once on Safari due to
  Dexie race; LESSONS §6" is.

#### Ship decision

- One named person signs off. "The team decided" is not accountability.
- Conditions are runtime triggers, not promises ("we'll watch closely"
  is not a condition; "rollback if >2% terminalStatus=UNREACHABLE in 48h"
  is).

---

## 4. Conventions shared across both sub-templates

### Result symbols

| Symbol | Meaning |
|---|---|
| ✅ | pass |
| ❌ | fail (final) |
| ⏭️ | skip (with reason) |
| ⚠️ | flake (passed on retry within same run) |
| 🚫 | blocked (could not run — missing precondition, broken env) |

### Append-only discipline

- NEVER edit a past **manual** run's results — add a new dated folder. An automated
  `report.md` is reporter-owned and re-derived each run; its history lives in git + the
  per-release aggregate, not in edited fields.
- NEVER edit a past release's `ship_status` retroactively — except
  `shipped → rolled-back` (which is itself an event worth dating in the
  Ship decision paragraph).

### Cross-link contract

| From | To | Purpose |
|---|---|---|
| Run file `Scope` | `test-cases/EPIC-N.md` | Gherkin scenarios |
| Run file `Failures` | MinIO logs/screenshots | Reproducibility |
| Release file `Release scope` | `CHANGELOG.md#vX.Y.Z` | Story list |
| Release file `Run history` | Run files | Forensic trail |
| Release file `Outstanding risks` | `LESSONS.md §N`, `EPIC-N §14` | Risk context |
| `CHANGELOG.md#vX.Y.Z` | Release file | Reverse pointer (optional, phase 2) |

### English-only (RULE-13)

Both sub-templates are canonical docs and must be English-only, even
on Vietnamese-led projects.

---

## 5. Filled mini-example — Per-execution

````markdown
---
epic: EPIC-02
run_id: 2026-05-15-EPIC-02-run1
run_at: 2026-05-15T14:30:00+07:00
env: staging
version: v0.2.0
commit: 1fe8d25a4b3c2e9f6d8a1b2c3d4e5f6a7b8c9d0e
executor: bluezdot
trigger: per-release
---

## Summary

| Result | Count |
|---|---|
| Pass | 2 |
| Fail | 0 |
| Skip | 1 |
| **Total** | 3 |

**Duration:** 4m 12s

## Scope

EPIC-02 release readiness for v0.2.0. All P0 e2e + regression TCs run.
Smoke skipped (only runs in PR CI).

- Source: [docs/tests/test-cases/EPIC-02.md](../../test-cases/EPIC-02.md)
- In scope: `TC-02.E2E-1`, `TC-02.REG-1`
- Skipped: `TC-02.SMK-1` (env=staging; smoke is PR-only)

## Results per test-case

| TC ID | Result | Duration | Notes / log link |
|---|---|---|---|
| TC-02.E2E-1 | ✅ pass | 3m 42s | — |
| TC-02.REG-1 | ✅ pass | 0m 30s | — |
| TC-02.SMK-1 | ⏭️ skip | — | env mismatch (PR-only) |

## Follow-up

- None. Release proceeds.
````

---

## 6. Filled mini-example — Per-release

````markdown
---
version: v0.2.0
released_at: 2026-05-15
commit: 1fe8d25a4b3c2e9f6d8a1b2c3d4e5f6a7b8c9d0e
epics_covered: [EPIC-02]
ship_status: shipped
---

## Release scope

v0.2.0 ships the EPIC-02 MT5 account linking + terminal provisioning
slice: link with AES-256 vault, credential verification, terminal
provisioning, health badge, unlink + decommission.

- See [CHANGELOG.md v0.2.0](../../../CHANGELOG.md#v020)
- Stories shipped: [US-2.6](../../../sprints/stories/US-2.6-mt5-credential-verification.md), [US-2.7](../../../sprints/stories/US-2.7-terminal-provisioning.md), [US-2.8](../../../sprints/stories/US-2.8-mt5-account-health-status.md), [US-2.9](../../../sprints/stories/US-2.9-unlink-mt5-account.md)

## Test coverage

| Epic | Total TC | Pass | Fail | Skip | Coverage % | Notes |
|---|---|---|---|---|---|---|
| [EPIC-02](../../../sprints/epics/EPIC-02.md) | 3 | 2 | 0 | 1 | 100% | Smoke skipped (PR-only); 2 gaps tracked in test-cases §7 |

## Run history

- [EPIC-02/05152026](../EPIC-02/05152026/report.md) — ✅ pass

## Outstanding risks

- **TC-02 coverage gaps** — US-2.1/AC-5 (duplicate-login advisory) and US-2.9 (unlink flow) lack TCs. Owner `@qa-lead`. Target: sprint-2026-W21.
- **TC-02.PRF-1 deferred** — perf budget undefined. Target: EPIC-02 §14 update + sprint-2026-W22.

## Ship decision

- **Signed off by:** `bluezdot` (project owner) on 2026-05-15
- **Conditions:** Monitor `terminalStatus=UNREACHABLE` rate on Grafana for 48h post-deploy. Rollback if >2% over baseline.
````

---

## 7. Cross-references

- [Test cases template](test-cases.md) — source of scenarios run here.
- [Changelog template](changelog.md) — release file links from
  CHANGELOG.md vX.Y.Z section.
- [Lessons template](lessons.md) — outstanding risks often spawn lessons.
- [Sprint system](../sprint-system.md) §Test artifacts — workflow context.
