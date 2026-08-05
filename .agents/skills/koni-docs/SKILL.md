---
name: koni-docs
description: >
  Use when working on any koni-docs artifact — PRD, ARCHITECTURE (ADRs / decision
  records), CHANGELOG (release notes), CONTEXT, LESSONS, SETUP, DESIGN, or Sprints
  (epics / stories / STATUS): update docs, create or split a story, record a
  decision, write a LESSONS entry, write release notes, run the pre-commit doc
  checklist, open or close a sprint, regenerate STATUS.md / the kanban, or run the
  koni-docs CLI (sync / status / validate). Also for a story's deadline — setting
  or moving its `due` date, "when is this due", "what's overdue or due soon". Also
  when BMad / GStack / Superpowers output needs standardizing into docs/. This
  skill WRITES the doc content; it does not set repos up (koni-setup), author test
  docs or QC (koni-qc), or run commit gates and the agentic loop (koni-harness).
---
# koni-docs — Documentation Management

> **One rule above all others**: every code-shipping commit updates docs in
> the SAME commit. Never defer documentation to a follow-up.
>
> One carve-out, and only one: a commit's own SHA cannot be inside it. If a SHA
> is recorded at all, it is backfilled by a follow-up commit — never `--amend`-ed
> in, which orphans it (RULE-2).

---

## 0. Quick orientation — what lives where

```
docs/
├── README.md          ← doc hub + pre-commit checklist
├── SETUP.md           ← dev environment (clone → npm run dev)
├── BRIEF.md           ← product brief: executive summary, problem, solution, scope, vision
├── PRD.md             ← product spec: Epics / User Stories / Tasks
├── ARCHITECTURE.md    ← system architecture: tech stack, components, data, API, infra
├── CHANGELOG.md       ← full release history (every version)
├── CONTEXT.md         ← decision log (append-only, never rewrite)
├── LESSONS.md         ← recurring traps + patterns
├── design/            ← per-story design specs (US-X.Y-<slug>-design.md)
├── okr/               ← (optional) file-native quarterly OKR ledgers (YYYY-QN.md)
├── sprints/
│   ├── README.md      ← agile schema + workflow
│   ├── STATUS.md      ← AUTO-GENERATED kanban (never hand-edit)
│   ├── epics/         ← EPIC-N.md
│   ├── stories/       ← US-X.Y-<slug>.md (canonical task source)
│   ├── sprint-YYYY-WNN.md  ← active sprint
│   └── archive/       ← closed sprints
└── tests/
    ├── test-cases/    ← EPIC-N.md (epic-level scenarios: E2E + REG + SMK + matrix)
    │   └── README.md
    └── test-reports/  ← execution history (path owned by koni-qc test-organization)
        ├── EPIC-NN/<MMDDYYYY>/report.md  ← per-execution detail (auto; report-manual.md = manual)
        └── releases/  ← vX.Y.Z.md (per-release aggregate)

DEPLOY.md              ← production runbook (repo root)
VERSION                ← current semver string (repo root)
DESIGN.md              ← design system (repo root)
.env.example           ← env var template (repo root)
```

---

## 1. Pipeline integration

Koni-docs is the **final stage** and **output standardizer** in the Koniverse product development pipeline:

```
BRAINSTORM → BRIEF → PRD → ARCH → EPIC/US → DESIGN → REVIEW → QA → IMPLEMENT → COMMIT/DOCS
   BMAD       BMAD    BMAD   BMAD     BMAD     GSTACK  GSTACK  GSTACK  SUPERPOWERS   KONI-DOCS
```

**Key principle**: Tools process content. Koni-docs standardizes output. When BMad, GStack, or Superpowers produce planning artifacts in their own directories (e.g., `_bmad-output/`), koni-docs maps them to the canonical `docs/` structure and ensures they follow Koniverse templates.

| Pipeline Phase          | Tool                | What it produces                                               |
| ----------------------- | ------------------- | -------------------------------------------------------------- |
| Brainstorm              | BMad + GStack       | Raw ideas, problem framing                                     |
| Product Brief           | BMad                | Executive brief                                                |
| PRD                     | BMad                | Full PRD content                                               |
| Architecture            | BMad                | Architecture decisions                                         |
| EPIC/US Breakdown       | BMad                | Epics + User Stories                                           |
| Design Review           | GStack              | Design review, interaction states                              |
| Plan Review             | GStack              | Architecture review, edge cases, test plan                     |
| QA                      | GStack              | Systematic testing, bug reports                                |
| Implementation          | Superpowers         | Plan → code → tests                                          |
| **docs Finalize** | **Koni-docs** | **Standardized docs, rules enforced, CLAUDE.md updated** |

---

## 2. Core rules (summary)

These 13 rules apply to ALL Koniverse projects. Full enforcement details in `references/rules.md`.

| Rule    | Summary                                                       | Group      |
| ------- | ------------------------------------------------------------- | ---------- |
| RULE-1  | VERSION + CHANGELOG in same commit                            | Pre-commit |
| RULE-2  | A recorded SHA is real + reachable — never "pending", never `--amend`-ed in | Pre-commit |
| RULE-5  | STATUS.md auto-generated, never hand-edit                     | Post-gen   |
| RULE-6  | Story id must match filename + PRD `Epics & User Stories`    | During     |
| RULE-7  | CONTEXT.md append-only, corrections via revision entry        | During     |
| RULE-10 | Mark tasks [x] as you complete them                           | During     |
| RULE-11 | New env var → SETUP + DEPLOY + .env.example in same commit   | Pre-commit |
| RULE-13 | English-only for code, comments, UI, errors, commits, docs    | During     |
| RULE-14 | Commit prefix: feat:/fix:/chore:/docs:/style:/refactor:/test: | Pre-commit |
| RULE-15 | `assignee:` is the GitHub login — never git user.name         | During     |
| RULE-16 | `version_shipped:` is bare semver — never `v`-prefixed        | During     |
| RULE-17 | Frontmatter ID fields = bare canonical IDs only, never prose  | During     |
| RULE-18 | `due` = a commitment from outside the sprint cadence — sparse, bare date, never moved silently | During |

**Technology-specific rules** (Supabase, Next.js) live in plugin skills. When a project's CLAUDE.md declares them under the `koni-docs:` block (`koni-docs:` → `plugins: [supabase, nextjs]`), load those plugin skills for the additional rules.
See [`references/plugin-pattern.md`](references/plugin-pattern.md) for how plugin skills are structured, discovered (the `plugins:` key under `koni-docs:`), and composed; `koni-nextjs` is the reference.

---

## 3. Workflow — task lifecycle

### 3a. Before writing any code

1. **Read LESSONS.md** — skim all entry titles; full-read 2-4 entries matching your domain.
2. **Read DESIGN.md** if any UI is involved.
3. **Find or create the story** in `docs/sprints/stories/`:
   - Flip `status:` → `in-progress`
   - Set `sprint:` to the active sprint id
   - Set `due:` **only** if the work owes someone a date from *outside* the
     sprint rhythm (contract, customer demo, audit, filing). "Must land this
     sprint" is not a `due` — `sprint:` already says that, and `sprint.end` is
     never inherited. When you do set it, write the date in frontmatter and the
     *reason* in the story's `## Deadline` section. See
     [`sprint-system.md` §Deadlines vs sprint cadence](references/sprint-system.md).
   - If no story exists, create a stub using the full story template ([`templates/story.md`](references/templates/story.md)) before starting.
   - **Size it.** Fibonacci only (1/2/3/5/8/13). For non-engineering work
     (sales / marketing / content / ops), invoke the domain skill to cross-check
     the estimate *before* assigning `points:` — gut-feel undersizes that work by
     30-40%, especially when it waits on external parties. `/sales-engineer` for
     B2B sales artifacts; `/marketing-ops` for lifecycle / CRO / content / ads;
     both when the story spans them; skip for pure engineering. The calibration
     scale and the evidence behind it:
     [`sprint-system.md` §Story sizing](references/sprint-system.md).
4. **Update the sprint file** — ensure the story row exists in the active sprint scope table.

### 3b. During implementation

- Mark tasks `[x]` in the story file **as you complete them**, not all at the end (RULE-10).
- If you make an architecture or scope decision, append a `CONTEXT.md` entry immediately (see [`templates/context.md`](references/templates/context.md)).
- If you encounter a trap or discover a reusable pattern, append a `LESSONS.md` entry.

### 3c. Pre-commit checklist

Run through every item before committing:

```
[ ] VERSION bumped per semver rule
[ ] CHANGELOG.md — story's "Changelog entry" section copied in, SAME commit (RULE-1). A recorded SHA is backfilled in a follow-up commit, never `--amend`-ed in (RULE-2)
[ ] PRD.md story status updated if scope changed
[ ] BRIEF.md updated if product vision, scope, or success criteria changed
[ ] CONTEXT.md has new entry if a decision was made
[ ] SETUP.md + DEPLOY.md + .env.example updated if new env var (RULE-11)
[ ] LESSONS.md has new entry if a trap or pattern was discovered
[ ] Story file: status → done, version_shipped set, Tasks all [x]
[ ] Any `due` CHANGED this commit? → CONTEXT.md entry in the SAME commit (old → new → why). Applies to a proactive push, not just an overdue story (RULE-18)
[ ] `version_shipped` is BARE semver, `assignee` is a GitHub login, ID fields are bare IDs (RULE-16, RULE-15, RULE-17)
[ ] npx koni-docs sync --docs-path docs/  (5-layer sync)
[ ] npx koni-docs status --docs-path docs/  (STATUS.md — RULE-5)
[ ] Touched a skill or its references? → python3 skills/koni-docs/scripts/check-references.py <skill-dir>  (the gate runs it, plus the two scripts that prove it still works)
[ ] CLAUDE.md Active Context block updated (see §4)
```

---

## 4. CLAUDE.md / AGENTS.md auto-update

Every project wires koni-docs into its agent files and keeps a live sprint snapshot
there. Two shapes: **Pattern A** (Active Context inline in CLAUDE.md — simplest,
fine solo) and **Pattern B** (extracted to a gitignored `.active-context.md` —
recommended for teams; it stops merge churn on a file everyone edits).

Seven trigger points (T1-T7) keep the snapshot true: story start / close, sprint
open / close, a CONTEXT decision, a LESSONS entry, a version bump.

**The block formats, both patterns end-to-end, and the T1-T7 table:
[`references/templates/integration.md`](references/templates/integration.md).** Load it when
wiring a new project or when a trigger fires; you do not need it to decide what to
document.

---

## 5. Activation — how to use this skill

Every document template lives in its own file under
[`references/templates/`](references/templates/). Load only the template
file matching the user's request.

| User request                                    | Action                                                                                    | Load                                       |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------ |
| "create a story for US-X.Y"                     | Verify US-X.Y exists in PRD `Epics & User Stories`, use full story template. For retroactive / codebase-discovered stories, resolve `assignee` to the commit author's GitHub **login** — never git `user.name`, never the session user (RULE-15 has the command) | [`templates/story.md`](references/templates/story.md) §1                    |
| "start story US-X.Y"                            | §3a flow: read LESSONS → DESIGN.md → flip `status: in-progress`                           | `rules.md` §RULE-6                         |
| "close / complete story US-X.Y"                 | §3c checklist + 5-layer check + `npx koni-docs sync` then `status`                                          | `sprint-system.md` §5-layer                |
| "log a decision" / "record architecture choice" | Find highest D`<N>`, append decision entry                                                | [`templates/context.md`](references/templates/context.md)                     |
| "revise / correct decision D`<N>`"              | Append revision entry, never edit original (RULE-7)                                       | [`templates/context.md`](references/templates/context.md) §3 (revision entry)           |
| "add a lesson" / "log a lesson"                 | Find highest entry number, append LESSONS entry                                           | [`templates/lessons.md`](references/templates/lessons.md)                     |
| "write changelog for vX.Y.Z"                    | Append CHANGELOG entry, bump VERSION simultaneously                                       | [`templates/changelog.md`](references/templates/changelog.md)                   |
| "create / update architecture"                  | Create or update ARCHITECTURE.md with tech stack, components, data flow                   | [`templates/architecture.md`](references/templates/architecture.md)                |
| "create brief" / "update brief" / "product brief" | Create or update BRIEF.md from BMad brainstorm/brief output                             | [`templates/brief.md`](references/templates/brief.md)                       |
| "update PRD for [feature]"                      | Update both the `Functional Requirements` row AND the `Epics & User Stories` entry                                              | [`templates/prd.md`](references/templates/prd.md)                         |
| "create design spec for US-X.Y"                 | Use design spec template                                                                  | [`templates/design-spec.md`](references/templates/design-spec.md)                 |
| "create an epic"                                | Use full epic template                                                                    | [`templates/epic.md`](references/templates/epic.md)                        |
| "create sprint file"                            | Use sprint template                                                                       | [`templates/sprint.md`](references/templates/sprint.md)                      |
| "create / update test-cases for EPIC-N"         | Use test-cases template (10-section layout: Scope / Stories in scope / Goals / Env / Cadence / Quick reference / Detail / Coverage matrix / Open) | [`templates/test-cases.md`](references/templates/test-cases.md)                  |
| "record a test run for EPIC-N"                  | Use per-execution sub-template — write to `test-reports/EPIC-NN/<MMDDYYYY>/report.md` (auto) / `report-manual.md` (path owned by koni-qc test-organization) | [`templates/test-report.md`](references/templates/test-report.md) §2 (sub-template A)              |
| "create release test report for vX.Y.Z"         | Use per-release sub-template — write to `releases/vX.Y.Z.md`, link from CHANGELOG          | [`templates/test-report.md`](references/templates/test-report.md) §3 (sub-template B)              |
| "update setup for new env var"                  | RULE-11: update SETUP + DEPLOY + .env.example in same commit                              | [`templates/setup.md`](references/templates/setup.md)                       |
| "create OKR ledger" / "set up quarterly OKRs"   | Use OKR template (file-native quarterly Markdown ledger)                                  | [`templates/okr.md`](references/templates/okr.md)                         |
| "wire koni-docs into project" / "refresh Active Context" | Update CLAUDE.md + AGENTS.md (+ `.active-context.md` for Pattern B) integration blocks | [`templates/integration.md`](references/templates/integration.md)        |
| "adopt active-context split" / "move active context out of CLAUDE.md" | Pattern B: create `.active-context.example.md` + `.active-context.md` + gitignore + CLAUDE.md pointer | [`templates/integration.md`](references/templates/integration.md) §2 |
| "make AGENTS.md canonical" / "slim CLAUDE.md" / "AGENTS-canonical convention" | Apply §3.1 convention: CLAUDE.md keeps only pointer + Koni-Docs Integration + Active Context; AGENTS.md absorbs project structure / docs links / conventions | [`templates/integration.md`](references/templates/integration.md) §3.1 |
| "what templates exist?"                         | Browse the index                                                                          | `templates.md` (thin index)                |
| "run doc checklist" / "pre-commit check"        | Walk §3c checklist item by item                                                           | `rules.md` + `sprint-system.md`            |
| "regenerate status"                             | `npx koni-docs status --docs-path docs/` → commit                                         | `cli.md` §4                |
| "sync stories to PRD"                           | `npx koni-docs sync --docs-path docs/`                                                    | `sprint-system.md` §5-layer                |
| "inject tasks from AC"                          | `npx koni-docs inject-tasks --docs-path docs/ --story US-X.Y`                             | `cli.md` §4                |
| "backfill changelog SHAs"                       | `npx koni-docs backfill-commits --docs-path docs/`                                        | `cli.md` §4                |
| "standardize output from [tool]"                | Map tool output to canonical docs/ structure                                              | §1 Pipeline                                |
| "fix prd_ref" / "what goes in prd_ref / arch_ref / depends_on" / "AD-N in story frontmatter" / "sync warns row not found" / "migrate frontmatter" | Apply the per-field contract; move AD-N to `arch_ref`, US-X.Y to `depends_on`, prose to body | `frontmatter-spec.md` + `rules.md` RULE-17 |

---

## 6. Reference files

Everything below is **loaded on demand** — §5 above names which one a given intent
needs. Each file opens with its own `**Contents**` line, so you can see its scope
before reading it.

| File | Load when |
|---|---|
| [`references/rules.md`](references/rules.md) | You need the enforcement detail of a rule — what / why / how to comply / the grep check |
| [`references/frontmatter-spec.md`](references/frontmatter-spec.md) | Writing or fixing any frontmatter field (the Iron Law, the ID + date contracts, the anti-pattern catalog) |
| [`references/sprint-system.md`](references/sprint-system.md) | Sprints, story sizing, deadlines vs cadence, the 5-layer consistency check, test artifacts |
| [`references/cli.md`](references/cli.md) | Installing, upgrading, or running the CLI; a subcommand, a flag, the commit loops, the typed lib |
| [`references/templates.md`](references/templates.md) | You want the index of every template, or just the frontmatter shape |
| [`references/templates/*.md`](references/templates/) | Writing the artifact itself — one file per doc type, each with a filled example; the larger ones open with a section index |
| [`references/plugin-pattern.md`](references/plugin-pattern.md) | The project sets `plugins:` under its `koni-docs:` block and you need how plugin skills compose |
| [`references/bmad-template-analysis.md`](references/bmad-template-analysis.md) | Migrating from BMad, or mapping BMad artifacts into koni-docs |
| [`evals/`](evals/) | You changed a rule, a template, or the description — run the behavioural evals. They measure what the skill *causes*: does an agent holding it produce a conformant story, resist a `due` that is really just the sprint end, write the CONTEXT entry when a date moves, refuse `--amend`, resolve an assignee to a login? The scripts below test the linter; these test the skill. |
| [`scripts/check-references.py`](scripts/check-references.py) | **Run it after editing any skill doc** — it asserts that every link, anchor, section pointer, and named script resolves. The `skill-references` gate runs it on every commit that touches a skill. |

**Plugin skills**: if the project's CLAUDE.md sets `plugins:` under its `koni-docs:` block, load those
skills for technology-specific rules that extend this rule set. `koni-nextjs` is the
worked example.

---

## 7. CLI tool — `@koniverse/koni-docs`

Every `koni-docs <cmd>` this skill tells you to run comes from the companion CLI,
installed per repo as a devDep (`npx koni-docs …`) or globally. Run
`npx koni-docs --version` to see what you actually have — this skill deliberately
pins no version number.
The seven subcommands, in one line each:

| Subcommand | Does |
|---|---|
| `status` | Regenerate `STATUS.md` — the kanban **and** the `## ⏰ Deadlines` board (RULE-5) |
| `sync` | Propagate a story's status up through Epic / PRD / Sprint |
| `validate` | ID-graph + FR-ref integrity, and `due`-date checking. Exits non-zero on error |
| `inject-tasks` | Rebuild a story's `## Tasks` from its Acceptance criteria |
| `backfill-fields` | Add missing standard frontmatter keys to story files |
| `backfill-commits` | **Repair only** — a CHANGELOG that already shipped with `pending` SHAs |
| `preview` | Astro SSR docs viewer (`--watch` for live-reload) |

**The authoritative inventory — with flags, install modes, the commit loops, the
typed lib API, and troubleshooting — is [`references/cli.md`](references/cli.md).**
The table above is a menu, not a second source: when they disagree, cli.md wins. Load it when you need to run, install,
or import the CLI; you do not need it to decide *what* to document.
