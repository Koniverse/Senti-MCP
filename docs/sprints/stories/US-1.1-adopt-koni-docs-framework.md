---
id: US-1.1
title: "Adopt koni-docs as this repo's documentation framework"
epic: EPIC-1
status: review
priority: P1
points: 3
sprint: sprint-2026-W32
assignee: bluezdot
created: 2026-08-05
updated: 2026-08-05
---

## Goal

Any agent or person opening this repo should be able to find out what is being built,
what was decided, and what state the work is in — without being told where to look, and
without reading git history. Downstream stories get to stop worrying about where a
decision, a changelog entry, or an acceptance criterion belongs.

## Background

The repo held two documents and no code: a design spec and a v1 implementation plan,
both from the Superpowers brainstorm → plan pipeline. Both are snapshots of intent.
Neither records what shipped, and neither tells a newly-started agent session what is in
flight.

The v1 plan is written but unstarted, which is what makes now the moment. The koni-docs
core rule is *every code-shipping commit updates docs in the same commit*, and it can
only be honoured from the first code commit onward. Adopting after v1 would mean stories
written backwards from finished code.

This story **reverses** the design spec's closing paragraph, which judged koni-docs
"ceremony" for a repo with no sprints. That judgement was right for its premise, and the
premise changed — v1 is now a four-story sprint with 16 further read operations behind
it. The reversal is recorded as [CONTEXT D1](../../CONTEXT.md), and the spec is left as
written: rewriting it to look like it always agreed is what RULE-7's append-only
discipline exists to prevent.

Two pieces of the reference material turned out to be wrong and are not followed. Both
are documented in [CONTEXT D2 and D3](../../CONTEXT.md).

## Acceptance criteria

- [x] **AC-1** — **Given** a clone of this repo, **When** an agent session starts,
  **Then** the `koni-docs` skill is available from `.claude/skills/koni-docs`, **And**
  that path resolves to real files inside the repo rather than to any location outside
  it.
- [x] **AC-2** — The vendored skill is byte-identical to
  `Koniverse/Koni-Skills@skills/koni-docs`: `diff -rq` against a fresh upstream clone
  reports no differences. The copy is a mirror, not a fork.
- [x] **AC-3** — `skills-lock.json` records the skill's source, source type, skill path,
  and content hash, so upstream drift is detectable and `npx skills experimental_install`
  can restore it.
- [x] **AC-4** — `npx koni-docs --version` reports `0.12.0`, pinned as a devDependency
  read from npm — **not** from `Koni-Skills/VERSION`, which tracks a different release
  line (`0.67.0`).
- [x] **AC-5** — Exactly two CLI npm scripts exist, `agile:status` and `agile:validate`.
  `sync` is absent from both `package.json` and the pre-commit checklist.
- [x] **AC-6** — `docs/` contains `README.md`, `CHANGELOG.md`, and `CONTEXT.md`;
  `VERSION` at the repo root contains bare `0.1.0` with no `v` prefix (RULE-16).
- [x] **AC-7** — `CHANGELOG.md` carries an `[Unreleased]` section and **no** `[0.1.0]`
  entry: this story ships no runtime code, and `[0.1.0]` belongs in the commit that adds
  `src/` (RULE-1). No entry contains a commit SHA (RULE-2).
- [x] **AC-8** — `CONTEXT.md` records one entry per decision — D1 adoption, D2 install
  mechanism, D3 omitting `sync`, D4 Active Context pattern — each with a stated
  rationale and its rejected alternatives.
- [x] **AC-9** — `docs/sprints/` contains EPIC-1, EPIC-2, `sprint-2026-W32.md`, and four
  story files, each with `id` matching its filename (RULE-6) and stories named
  `US-X.Y-<slug>.md`.
- [x] **AC-10** — **Given** no `PRD.md` and no `ARCHITECTURE.md` exist, **When**
  `npm run agile:validate` runs, **Then** it exits 0 — achieved by omitting `prd_ref`
  and `arch_ref` entirely rather than filling them with placeholders, which RULE-17
  forbids.
- [x] **AC-11** — `npm run agile:status` generates `docs/sprints/STATUS.md` listing all
  four stories under their epics and sprint, and its content is deterministic **apart
  from the `Last generated:` timestamp line** it embeds. The file is never hand-edited
  afterwards (RULE-5).
- [x] **AC-12** — `AGENTS.md` is the canonical project guide; `CLAUDE.md` holds a
  pointer to it, the `Koni-Docs Integration` block naming `sprint-2026-W32`, and an
  Active Context block between `<!-- koni-docs:auto-update -->` markers.
- [x] **AC-13** — **Given** a fresh clone of this repo on a machine with no `Koni-Skills`
  checkout, **When** `npm install` runs, **Then** `.claude/skills/koni-docs` resolves to
  48 skill files **inside that clone**, **And** `npx koni-docs validate` exits 0 — with no
  other setup step. This is the portability claim that justified vendoring over a symlink,
  actually exercised.
  > `npx skills experimental_install` restores the `.agents/skills/koni-docs` copy from
  > the lockfile but does **not** recreate the `.claude/skills` symlink, so it is a
  > lockfile-driven refresh rather than a full restore. Git is the restore path: both the
  > vendored files and the symlink are tracked.
- [x] **AC-14** — The v1 implementation plan's Task 1 Step 1 extends `package.json`
  rather than creating it, and each of its six tasks names the story it advances.
- [x] **AC-15** — All documentation is English (RULE-13) and every commit carries a
  conventional prefix (RULE-14), including the seven commit messages inside the v1 plan.

## Tasks

- [x] **TASK-1.1.1** — Vendor the skill and wire the CLI (AC: 1, 2, 3, 4, 5)
  - [x] `npx skills add Koniverse/Koni-Skills --skill koni-docs --agent claude-code --agent universal -y`
  - [x] Verify `.agents/skills/koni-docs/` holds real files and `.claude/skills/koni-docs`
        is a relative symlink resolving inside the repo
  - [x] Confirm the mirror with `diff -rq` against a fresh upstream clone
  - [x] Create `package.json` with the `^0.12.0` devDependency and the two `agile:*` scripts
  - [x] Add `.claude/settings.local.json` and `__pycache__/` to `.gitignore`
- [x] **TASK-1.1.2** — Create the singleton docs (AC: 6, 7, 8)
  - [x] `VERSION` → `0.1.0`
  - [x] `docs/README.md` — doc hub, pre-commit checklist, and a table of what is
        deliberately absent with what would bring each file in
  - [x] `docs/CHANGELOG.md` — `[Unreleased]` only
  - [x] `docs/CONTEXT.md` — D1 through D4
- [x] **TASK-1.1.3** — Create the sprint corpus (AC: 9, 10)
  - [x] `docs/sprints/epics/EPIC-1.md`, `EPIC-2.md`
  - [x] `docs/sprints/sprint-2026-W32.md` with the 6-column scope table
  - [x] Four story files under `docs/sprints/stories/`
- [x] **TASK-1.1.4** — Wire the agent surface (AC: 12)
  - [x] `AGENTS.md` as canonical project guide
  - [x] `CLAUDE.md` as pointer + integration block + Active Context
- [x] **TASK-1.1.5** — Generate, validate, hand off (AC: 11, 13, 14)
  - [x] `npm run agile:status`, then confirm a second run differs only in its timestamp
  - [x] `npm run agile:validate` exits 0
  - [x] Exercise the restore-from-committed-state path via a fresh clone
  - [x] Amend the v1 implementation plan

## Dev notes

### Architecture constraints

- This story introduces no `AD-N` entries, because there is no `ARCHITECTURE.md` yet.
  Its four decisions live in [CONTEXT D1–D4](../../CONTEXT.md).
- The vendored skill is **read-only**. Improvements go upstream to
  `Koniverse/Koni-Skills` and arrive here through `npx skills update koni-docs`. Editing
  `.agents/skills/koni-docs/` in place forks the skill and makes the lockfile hash lie.
- `koni-docs sync` is unavailable by decision, so epic story tables and the sprint scope
  table are maintained by hand. Only `STATUS.md` is generated.

### Cross-story dependencies

- **Required by** [US-2.1](US-2.1-authenticated-senti-api-client.md) — that story extends
  the `package.json` this story creates, and its commits follow the checklist this story
  installs.
- **Blocks nothing technically.** The dependency is procedural: from here on, a code
  commit without its doc update violates RULE-1.

### What we explicitly did NOT do

- **No `PRD.md` / `ARCHITECTURE.md`** — they would describe 16 tools that do not exist.
  Trigger to revisit: the read-tool roadmap firming up, at which point every story gains
  `prd_ref` / `arch_ref` in the same commit.
- **No `koni-harness` gate** — it would enforce mechanically what the checklist asks for,
  but there is no `src/` for it to guard. Trigger: the first code commit.
- **No `koni-qc`** — trigger: the first path parameter (an SSRF surface) or the first
  write operation.
- **No `LESSONS.md`** — trigger: the first real trap. An empty traps file invites filler.
- **No `docs/sprints/README.md`** — the vendored skill's `sprint-system.md` is the live
  source; a local copy would drift from it.

### References

- [Source: CONTEXT D1–D4](../../CONTEXT.md) — adoption, install mechanism, `sync`, Active Context
- [Source: design spec §Packaging](../../superpowers/specs/2026-08-05-senti-mcp-server-design.md) — the paragraph D1 reverses
- [Source: v1 implementation plan](../../superpowers/plans/2026-08-05-senti-mcp-server-v1.md) — amended by TASK-1.1.5
- [Source: koni-docs SKILL.md](../../../.agents/skills/koni-docs/SKILL.md) — the framework
- [Source: koni-docs rules.md](../../../.agents/skills/koni-docs/references/rules.md) — rule enforcement detail
- [Koniverse/Koni-Skills](https://github.com/Koniverse/Koni-Skills) — upstream source of the skill
- [read-mcp-server koni-docs adoption](https://github.com/bluezdot/read-mcp-server) — the sibling precedent this story diverges from by installing the skill, not just the CLI

## Verification commands

| AC | Command |
|---|---|
| AC-1 | `readlink .claude/skills/koni-docs` → `../../.agents/skills/koni-docs`; `cd .claude/skills && cd -P koni-docs && pwd` is inside the repo |
| AC-2 | `git clone --depth 1 https://github.com/Koniverse/Koni-Skills.git /tmp/ks && diff -rq /tmp/ks/skills/koni-docs .agents/skills/koni-docs` → no output |
| AC-3 | `cat skills-lock.json` shows `source`, `sourceType`, `skillPath`, `computedHash` for `koni-docs` |
| AC-4 | `npx koni-docs --version` → `0.12.0` |
| AC-5 | `node -e "const s=require('./package.json').scripts;console.log(Object.keys(s).join(','))"` → `agile:status,agile:validate`; `grep -rn 'koni-docs sync' package.json docs/README.md` → no hits |
| AC-6 | `cat VERSION` → `0.1.0`; `ls docs/README.md docs/CHANGELOG.md docs/CONTEXT.md` |
| AC-7 | `grep -c '^## \[0.1.0\]' docs/CHANGELOG.md` → `0`; `grep -in 'commit.*[0-9a-f]\{7,\}' docs/CHANGELOG.md` → no hits |
| AC-8 | `grep -c '^### D[0-9]' docs/CONTEXT.md` → `4` |
| AC-9 | `for f in docs/sprints/**/*.md; do …` — every `id:` equals its basename stem (see AC-9 check below) |
| AC-10 | `grep -rn 'prd_ref\|arch_ref' docs/sprints/` → no hits; `npm run agile:validate` exits 0 |
| AC-11 | `npm run agile:status && cp docs/sprints/STATUS.md /tmp/a && npm run agile:status && diff <(grep -v 'Last generated' /tmp/a) <(grep -v 'Last generated' docs/sprints/STATUS.md)` → no output |
| AC-12 | `grep -c 'koni-docs:auto-update' CLAUDE.md` → `2`; `grep -n 'sprint-2026-W32' CLAUDE.md` |
| AC-13 | `git clone . /tmp/c && cd /tmp/c && npm install && test -f .claude/skills/koni-docs/SKILL.md && npx koni-docs validate --docs-path docs/`; then confirm the symlink target is inside the clone: `root=$(pwd -P); t=$(cd .claude/skills && cd -P koni-docs && pwd -P); case "$t" in "$root"/*) echo INSIDE;; esac` |
| AC-14 | `grep -n 'Extend' docs/superpowers/plans/2026-08-05-senti-mcp-server-v1.md` names `package.json` |
| AC-15 | `git log --format=%s | grep -cvE '^(feat|fix|chore|docs|style|refactor|test)(\(.+\))?: '` → `0` |

The AC-9 id/filename check (RULE-6):

```sh
for f in docs/sprints/sprint-*.md docs/sprints/epics/*.md docs/sprints/stories/*.md; do
  id=$(awk '/^id:/{print $2; exit}' "$f")
  base=$(basename "$f" .md)
  case "$base" in "$id"|"$id"-*) ;; *) echo "MISMATCH: $f has id $id" ;; esac
done
```

AC-2 and AC-13 are the load-bearing ones. AC-2 proves the vendored copy did not silently
diverge from upstream; AC-13 proves the mechanism chosen over a symlink actually delivers
the portability it was chosen for. Both fail loudly and neither can be satisfied by
reading the files.

## Changelog entry

### Added
- `koni-docs` documentation framework: the skill vendored at `.agents/skills/koni-docs`
  with `.claude/skills/koni-docs` symlinked to it, and `skills-lock.json` recording
  source and content hash.
- `@koniverse/koni-docs@^0.12.0` as a devDependency, exposed as `npm run agile:status`
  and `npm run agile:validate`.
- `VERSION`, `docs/README.md`, `docs/CHANGELOG.md`, `docs/CONTEXT.md`.
- Sprint corpus: EPIC-1, EPIC-2, `sprint-2026-W32`, and four stories.
- `AGENTS.md` as the canonical project guide; `CLAUDE.md` with the koni-docs integration
  and Active Context blocks.

### Changed
- The v1 implementation plan's Task 1 now extends `package.json` instead of creating it,
  and each task names the story it advances.

## Implementation notes

Three findings worth carrying forward.

**`--agent claude` is not a valid agent id.** The `skills` CLI expects `claude-code`,
and comma-separated values in one `--agent` flag are rejected — the flag has to be
repeated. Installing with `--agent claude-code --agent universal` produces exactly the
layout `koni-setup`'s `skill-wiring.md` describes: real files under `.agents/skills/`,
a relative symlink from `.claude/skills/`.

**`check-references.py` reports dangling references but exits 0**, so it cannot gate by
exit code — its output has to be read. On a standalone koni-docs install it reports three
expected misses, all cross-skill: `../../koni-nextjs/SKILL.md`, and `test-automation.md`
and `test-organization.md`, which belong to `koni-qc`. An isolated copy of pristine
upstream reports the same three, which is how they were confirmed to be inherent to
installing koni-docs alone rather than evidence of a bad copy. Anything beyond those
three is real.

**`npx skills experimental_install` is not a full restore.** It rebuilds
`.agents/skills/koni-docs` from the lockfile but leaves the `.claude/skills` symlink
missing, so an agent looking in `.claude/skills` finds nothing. Git is the actual restore
path — both the 48 vendored files and the symlink are tracked, so `git clone` plus
`npm install` is sufficient and nothing else is needed. AC-13 was rewritten around the
clone path after the `experimental_install` path was tried and came back incomplete.

**`STATUS.md` is not byte-idempotent.** It embeds a `Last generated:` timestamp, so two
runs a second apart differ on that line. AC-11 originally required "running it twice
leaves no diff", which the generator cannot satisfy; it now requires determinism apart
from that line. The practical consequence is that `STATUS.md` appears in the diff of
every commit that regenerates it, which is expected rather than churn to suppress.

**All 6 `npm audit` findings are dev-only**, arriving through koni-docs' Astro `preview`
dependency chain (astro, vite, sharp, esbuild). `npm audit --omit=dev` reports 0. Nothing
reaches a shipped artifact, and the `preview` subcommand is not used here.

## Files modified

**Created (repo root):**
- `package.json` — koni-docs devDependency and the two `agile:*` scripts
- `VERSION` — `0.1.0`
- `AGENTS.md` — canonical project guide
- `CLAUDE.md` — pointer, integration block, Active Context
- `skills-lock.json` — skill provenance

**Created (docs):**
- `docs/README.md`, `docs/CHANGELOG.md`, `docs/CONTEXT.md`
- `docs/sprints/epics/EPIC-1.md`, `docs/sprints/epics/EPIC-2.md`
- `docs/sprints/sprint-2026-W32.md`
- `docs/sprints/stories/US-1.1-…`, `US-2.1-…`, `US-2.2-…`, `US-2.3-…`
- `docs/sprints/STATUS.md` — generated

**Created (vendored, 48 files):**
- `.agents/skills/koni-docs/**` — mirror of upstream; do not edit in place
- `.claude/skills/koni-docs` — relative symlink

**Modified:**
- `.gitignore` — `.claude/settings.local.json`, `__pycache__/`, `*.pyc`
- `docs/superpowers/plans/2026-08-05-senti-mcp-server-v1.md` — Task 1 extends
  `package.json`; tasks reference their stories

## Cross-references

- [Epic EPIC-1](../epics/EPIC-1.md)
- [CONTEXT D1–D4](../../CONTEXT.md)
- [CHANGELOG](../../CHANGELOG.md)
- [sprint-2026-W32](../sprint-2026-W32.md)
- [docs/README.md](../../README.md) — the checklist this story installs
