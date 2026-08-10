# docs/ — senti-mcp-server Documentation Hub

Canonical home for **senti-mcp-server** documentation, managed under the
[`koni-docs`](../.agents/skills/koni-docs/SKILL.md) framework. Every code-shipping
commit updates docs in the **same commit** (RULE-1 / RULE-11) — there is no "docs
follow-up" branch.

---

## What lives where

```
docs/
├── README.md            ← you are here (doc hub + pre-commit checklist)
├── SETUP.md             ← local dev setup + the env var reference (RULE-11)
├── RELEASE.md           ← how a version is cut and published (NOT a DEPLOY.md — D18)
├── CHANGELOG.md         ← release history (every version)
├── CONTEXT.md           ← decision log (append-only, never rewrite — RULE-7)
├── LESSONS.md           ← retrospective lessons (append-only; created sprint W33)
├── superpowers/         ← preserved planning artifacts
│   ├── specs/           ← design specs from the brainstorming phase
│   └── plans/           ← implementation plans
└── sprints/
    ├── STATUS.md        ← AUTO-GENERATED kanban (never hand-edit — RULE-5)
    ├── sprint-2026-W32.md   ← closed
    ├── sprint-2026-W33.md   ← most recently closed sprint; W34's file not yet written
    ├── epics/           ← EPIC-N.md
    └── stories/         ← US-X.Y-<slug>.md (canonical AC + Tasks source)

Repo root:
  .env.example               ← env var template; copy to gitignored .env.local
  VERSION                    ← current semver string, bare (no `v`)
  AGENTS.md                  ← canonical project guide
  CLAUDE.md                  ← pointer + Koni-Docs Integration (no Active Context — D7)
  skills-lock.json           ← skill provenance (source + content hash)
  .agents/skills/koni-docs/  ← the vendored skill, real files
  .claude/skills/koni-docs   → relative symlink into .agents/
```

`docs/superpowers/` and `docs/sprints/` coexist deliberately. Superpowers produces the
spec and the plan; koni-docs is the final stage that standardizes the outcome into
epics, stories, and a changelog. Neither replaces the other.

### What is deliberately absent

A missing file here is a decision, not an oversight.

| Absent | Why, and what would bring it in |
|---|---|
| `PRD.md`, `ARCHITECTURE.md` | Authored today they would describe operations that don't have a shipped tool yet — 11 of the API's 17, as of v1.0.0 (four read tools carried to sprint W34, seven write operations sitting in backlog epic [EPIC-3](sprints/epics/EPIC-3.md)). They land when the read-tool roadmap firms up — at which point every story gains `prd_ref` / `arch_ref` in the same commit ([CONTEXT D1](CONTEXT.md)). |
| `BRIEF.md` | The [design spec](superpowers/specs/2026-08-05-senti-mcp-server-design.md) already carries the problem statement and scope. |
| `DEPLOY.md` | `senti-mcp-server` is published on the public npm registry (`npm view senti-mcp-server` — `repository` matches this remote), `1.0.1` being the release that put all six tools there. But publishing a stdio MCP package to npm is not the same as operating a hosted service, and `DEPLOY.md` in this framework is a production runbook for the latter — env vars table, deployment steps ([koni-docs template](../.agents/skills/koni-docs/references/templates/setup.md) §6). This project has no service to run one against: no infrastructure, nothing to deploy beyond `npm publish` itself. It lands if that ever changes; a publish alone does not bring it in. **The publish procedure itself lives in [RELEASE.md](RELEASE.md)** — a different document for a different reader, which is why it did not become this one ([CONTEXT D18](CONTEXT.md)). |
| `DESIGN.md` | No UI. This is a stdio MCP server; output formatting lives beside the code that emits it. |
| `docs/tests/`, `docs/design/` | Owned by `koni-qc`, which is not wired. |
| `docs/sprints/README.md` | The vendored skill's [`sprint-system.md`](../.agents/skills/koni-docs/references/sprint-system.md) is the live source for the sprint schema; a copy here would drift from it. |
| Active Context — the `CLAUDE.md` block and `.active-context.md` | Removed, and not to be recreated in either form. It duplicated the sprint file and STATUS.md and went stale between refreshes ([CONTEXT D7](CONTEXT.md)). |

`LESSONS.md` is no longer on this list — it was created with its first real entry
during sprint W33; see [docs/LESSONS.md](LESSONS.md). An empty traps file teaches
nothing and invites filler, which is why it waited until there was a real one to
record.

---

## Pre-commit checklist

Walk every applicable item before committing.

```
[ ] VERSION bumped per semver — only when the commit ships code
[ ] CHANGELOG.md entry added, SAME commit (RULE-1). No SHA in it (RULE-2)
[ ] CONTEXT.md has a new D<N> entry if a decision was made (RULE-7 append-only)
[ ] Story file: tasks marked [x] as completed (RULE-10), not all at the end
[ ] Story closing: status → done, version_shipped set as BARE semver (RULE-16)
[ ] assignee is a GitHub login, never git user.name (RULE-15)
[ ] Frontmatter ID fields are bare IDs, never prose (RULE-17)
[ ] New env var → SETUP.md + .env.example in the SAME commit (RULE-11)
[ ] `due` changed? → CONTEXT.md entry in the SAME commit, old → new → why (RULE-18)
[ ] Shipping a version? → walk RELEASE.md instead of stopping here. `npm run release:check`
    and `npm run release:verify-pack` must both exit 0 BEFORE the tag is pushed
[ ] npm run agile:status    — regenerate STATUS.md (RULE-5)
[ ] npm run agile:validate  — ID graph resolves; must exit 0
[ ] Touched the skill? python3 .agents/skills/koni-docs/scripts/check-references.py .agents/skills/koni-docs
[ ] English-only: code, comments, errors, commits, docs (RULE-13)
[ ] Commit prefix: feat:/fix:/chore:/docs:/style:/refactor:/test: (RULE-14)
```

> **The skill's `CLAUDE.md Active Context block updated` item is deliberately absent
> from this list.** This repo keeps no Active Context block, in `CLAUDE.md` or in a
> `.active-context.md`, and the koni-docs T1–T7 trigger points do not apply here. See
> [CONTEXT D7](CONTEXT.md).

> **`npx koni-docs sync` is deliberately absent from this list.** It propagates story
> status up into PRD and epic tables, and at CLI 0.10.0 it over-aggregated the "Ship"
> column and corrupted curated `version_shipped` values. This repo also has no
> `PRD.md` for it to write to. See [CONTEXT D3](CONTEXT.md).

> **`STATUS.md` embeds a `Last generated:` timestamp**, so regenerating it always
> produces a one-line diff even when no story changed. That is expected — the file
> belongs in the commit that ran the checklist, not something to revert.

> **`check-references.py` reports dangling references but still exits 0**, so it
> cannot gate by exit code — read its output. On a standalone koni-docs install it
> reports **3 expected** cross-skill misses (`koni-nextjs/SKILL.md`,
> `test-automation.md`, `test-organization.md`); those files belong to `koni-nextjs`
> and `koni-qc`, neither of which is wired here. Anything beyond those three is real.

---

## Conventions

- **English only** across code, comments, error messages, commits, and docs
  (RULE-13). Vietnamese in chat and brainstorming is fine; the artifacts are English.
- **Frontmatter `id` must match the filename** for stories, epics, and sprints
  (RULE-6). Stories are `US-X.Y-<slug>.md`.
- **Status emojis** are stable system-wide:
  `📋 backlog · 🚧 in-progress · ✅ done · ⏪ reverted · 🗑️ deprecated`.
- **Cross-references are markdown links**, not bare paths.
- **`STATUS.md` is generated.** Regenerate it; never edit it (RULE-5).
- **CHANGELOG release headings are `## [X.Y.Z] — YYYY-MM-DD — <headline>`, with no
  trailing `— vX.Y.Z`.** Three older headings — `[0.1.0]`, `[1.0.0]`, `[1.0.1]` — do carry
  one, and that was not decoration: it appeared on exactly the versions that had a git tag
  and on none of the six that did not, a 9/9 correlation nothing documented. Every
  changelogged version is tagged now ([CONTEXT D17](CONTEXT.md)), so the marker would be on
  every heading and would distinguish nothing; it is retired rather than promoted, and
  where a check needs to know whether a version is tagged it asks `git`
  ([CONTEXT D19](CONTEXT.md)). The three existing headings are left exactly as shipped.

## Commands

```bash
npm run agile:status      # regenerate docs/sprints/STATUS.md
npm run agile:validate    # ID-graph + due-date integrity; exits non-zero on error
npx koni-docs --version   # confirm which CLI you actually have
```

## Cross-references

- [SETUP.md](SETUP.md) — local development setup and the environment variable reference
- [RELEASE.md](RELEASE.md) — how a version is cut, tagged, published and announced
- [CHANGELOG.md](CHANGELOG.md) — release history
- [CONTEXT.md](CONTEXT.md) — decision log
- [sprints/STATUS.md](sprints/STATUS.md) — current kanban (generated)
- [sprints/sprint-2026-W33.md](sprints/sprint-2026-W33.md) — most recently closed
  sprint; W34's sprint file is not yet written
- [superpowers/specs/2026-08-05-senti-mcp-server-design.md](superpowers/specs/2026-08-05-senti-mcp-server-design.md) — v1 design spec
- [superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md](superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md) — the W33/W34 read-tool expansion design
- [superpowers/plans/2026-08-05-senti-mcp-server-v1.md](superpowers/plans/2026-08-05-senti-mcp-server-v1.md) — v1 implementation plan
- [superpowers/plans/2026-08-06-senti-read-tools-w33.md](superpowers/plans/2026-08-06-senti-read-tools-w33.md) — W33 implementation plan
- [AGENTS.md](../AGENTS.md) · [CLAUDE.md](../CLAUDE.md) — agent guides
- [koni-docs SKILL.md](../.agents/skills/koni-docs/SKILL.md) — the framework itself
