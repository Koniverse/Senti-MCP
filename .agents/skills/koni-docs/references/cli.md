# koni-docs CLI — `@koniverse/koni-docs`

> **Load when**: installing, upgrading, or invoking the CLI; looking up a
> subcommand or a global flag; wiring the doc loops into a commit; importing the
> typed lib. SKILL.md §7 points here — this file is the authoritative inventory.


**Contents**: [1. Install](#1-install) · [2. Update](#2-update) · [3. Global flags (every subcommand accepts these)](#3-global-flags-every-subcommand-accepts-these) · [4. Subcommand inventory](#4-subcommand-inventory) · [5. Real-world usage — the four common loops](#5-real-world-usage--the-four-common-loops) · [6. When to use which subcommand](#6-when-to-use-which-subcommand) · [7. Library API for programmatic use](#7-library-api-for-programmatic-use) · [8. Troubleshooting](#8-troubleshooting) · [9. Skill ↔ CLI relationship](#9-skill--cli-relationship)

[Global flags](#3-global-flags-every-subcommand-accepts-these) ·
[Subcommand inventory](#4-subcommand-inventory) ·
[The four common loops](#5-real-world-usage--the-four-common-loops) ·
[Intent → subcommand](#6-when-to-use-which-subcommand) ·
[Library API](#7-library-api-for-programmatic-use) ·
[Troubleshooting](#8-troubleshooting) ·
[Skill ↔ CLI](#9-skill--cli-relationship)


This skill ships with a companion CLI binary published as `@koniverse/koni-docs`. It provides 7 subcommands for the doc-maintenance work the skill prescribes, plus a reusable typed lib.

> **Source of truth**: `packages/koni-docs/package.json` in the Koni-Skills repo. When it and npm diverge, the repo is the canonical pre-release and npm is the canonical published version. Don't hardcode a version anywhere else — run `npx koni-docs --version` to see what you actually have.

## 1. Install

Pick the mode that fits the consumer repo:

| Mode | Command | When to use |
|---|---|---|
| **devDep (recommended)** | `npm install --save-dev @koniverse/koni-docs` | Most consumer repos. Pinned in `package.json`, reproducible CI. Invoke via `npx koni-docs <cmd>`. |
| **Global** | `npm install -g @koniverse/koni-docs` | Cross-project use, one-off audits, ad-hoc preview. Invoke via `koni-docs <cmd>` (no `npx`). |
| **Local-tarball (pre-publish)** | From this repo: `cd packages/koni-docs && npm run build && npm pack` then `npm install -g ./koniverse-koni-docs-<version>.tgz` (the exact filename `npm pack` printed) | Testing an unpublished version end-to-end, dogfooding a release candidate. |
| **`npm link` (active development)** | From this repo: `cd packages/koni-docs && npm run build && npm link` | Iterating on the CLI itself with a global `koni-docs` bin that always tracks `dist/`. Re-run `npm run build` after each source edit. |

> If a project's CLAUDE.md / AGENTS.md says the CLI is installed in a specific way (e.g. devDep with `npm run agile:status` aliases), match that — don't switch modes silently.

## 2. Update

| Install mode | Update command |
|---|---|
| devDep | `npm install --save-dev @koniverse/koni-docs@latest` (or pin a specific version) |
| Global | `npm install -g @koniverse/koni-docs@latest` |
| Local-tarball | Re-pack from this repo and re-install: `npm uninstall -g @koniverse/koni-docs && npm install -g ./koniverse-koni-docs-<v>.tgz` |
| npm link | `git pull && npm run build` from `packages/koni-docs/` — the linked bin picks up the new `dist/`. |

After upgrading, verify:

```bash
koni-docs --version        # global mode
npx koni-docs --version    # devDep mode
```

Should report the version you just installed. If `--version` shows an older number, the install didn't take — re-run install and re-check.

## 3. Global flags (every subcommand accepts these)

- `--docs-path <path>` — override the default `docs/` root (useful for monorepos)
- `--dry-run` — preview changes without writing files
- `--json` — machine-readable output (pipe to `jq`)
- `--verbose` — extra logging

## 4. Subcommand inventory

| Subcommand | Purpose | Example |
|---|---|---|
| `status` | Regenerate `STATUS.md` kanban from story frontmatter (RULE-5). Also renders the `## ⏰ Deadlines` section (overdue / due-soon / on-track) from each story's `due` field, above the kanban columns. `--due-soon-days <n>` (default 3) sets the due-soon window. | `koni-docs status --due-soon-days 7` |
| `sync` | Propagate story status through doc layers (Epic / PRD `Functional Requirements` / Sprint / STATUS); PRD section lookup uses the label form (`## Functional Requirements`), with a legacy `## 8.` fallback | `koni-docs sync --story US-X.Y` |
| `inject-tasks` | Regenerate `## Tasks` checklist from `## Acceptance criteria` items in a story | `koni-docs inject-tasks --story US-X.Y` |
| `backfill-fields` | Add missing standard frontmatter keys to story files via `STORY_DEFAULTS` | `koni-docs backfill-fields` |
| `backfill-commits` | **Repair only** — replaces `pending` SHAs in a CHANGELOG that already shipped broken. It is *not* a licensed step of the normal flow: RULE-2 forbids writing `pending` in the first place. | `koni-docs backfill-commits` |
| `preview` | Launch the Astro SSR docs viewer (dashboard / per-doc / `/project` tracker). `--watch` enables live-reload. | `koni-docs preview docs --port 4321 --watch` |
| `validate` | L3 ID-graph integrity check + FR-ref reachability (each story's `prd_ref` resolves to a real FR row in PRD `Functional Requirements`). Also checks `due` dates. **Error** (exit non-zero): a value that is not a real date. **Warnings** (exit code untouched — deadlines inform, they never block a commit): a story past its `due`, and a `due` that merely restates its sprint's end date (the drift that turns the Deadlines board into a second copy of the sprint table). Exits non-zero on any error. | `koni-docs validate --json` |

## 5. Real-world usage — the four common loops

**(A) After editing a story file** (start, close, change AC):

```bash
koni-docs sync --story US-X.Y    # propagate status across 5 doc layers
koni-docs status                  # regen STATUS.md (RULE-5)
```

**(B) Pre-commit checklist** (full §3c sweep):

```bash
koni-docs inject-tasks --story US-X.Y   # only if AC changed
koni-docs sync --story US-X.Y
koni-docs status
koni-docs validate                       # fails CI on broken refs
git add . && git commit -m "feat: ..."   # the release commit

# A commit cannot contain its own SHA. Do NOT --amend it in (that rewrites the
# commit, orphaning the SHA you just wrote — RULE-2). Backfill in a follow-up:
SHA=$(git rev-parse --short HEAD)
# write $SHA into the story's `commit:` field
git add docs/ && git commit -m "docs: backfill US-X.Y commit SHA ($SHA)"
```

**(C) Doc audit on a new repo or after a long pause**:

```bash
koni-docs validate --json | jq                            # find broken refs
koni-docs backfill-fields --dry-run                       # see what's missing
koni-docs backfill-fields                                 # fill defaults
koni-docs status                                          # regen kanban
```

**(D) Browse the docs visually** (dashboard + per-doc + project tracker + live-reload):

```bash
koni-docs preview docs --watch     # opens http://localhost:4321/
# /              dashboard (KPIs + epic grid)
# /docs/<slug>   any markdown doc rendered with shiki + mermaid
# /project       full story tracker (filter/group)
```

`--watch` watches `docs/**/*.md` (chokidar) and pushes SSE events to the browser; edit a story file and the open tab reloads automatically.

## 6. When to use which subcommand

**Single source: [SKILL.md §5](../SKILL.md)** — §4 above is the inventory; §5 is the
router that maps a user's phrasing to a command.

## 7. Library API for programmatic use

Other Koniverse products can import the typed lib without the CLI. Current surface:

```ts
// Corpus + I/O
import {
  loadCorpus, readDoc, writeDoc, parseDoc, serializeDoc, updateFrontmatter,
  getStories, getEpics, getSprints, getActiveSprint, resolveById,
} from '@koniverse/koni-docs/lib';

// Markdown primitives
import {
  findSection, findSectionStartingWith,    // ← prefix matcher
  replaceSection, appendToSection, removeSection,
  findTable, parseTable, findRow, updateCell, appendRow, removeRow,
  parseCheckboxes, setCheckboxState, appendCheckbox, replaceCheckboxes,
} from '@koniverse/koni-docs/lib';

// Schemas
import { Schemas } from '@koniverse/koni-docs/lib';
// → Schemas.storySchema, Schemas.epicSchema, Schemas.sprintSchema, Schemas.changelogEntrySchema

// Validators
import {
  validateRefs,        // L3 ID graph (story→epic, story→sprint, story→PRD Epics & User Stories)
  validateFrRefs,      // ← prd_ref reachability into PRD Functional Requirements
} from '@koniverse/koni-docs/lib';

// Deadlines — see sprint-system.md §Deadlines vs sprint cadence
import {
  getDeadlines,        // stories with a `due`, classified overdue / due-soon / on-track
  findMalformedDue,    // `due` values that are not a real date        → validate ERROR
  findRedundantDue,    // `due` that merely restates its sprint's end  → validate WARNING
  normalizeDue,        // raw frontmatter value → YYYY-MM-DD | null
  isValidIsoDate,
} from '@koniverse/koni-docs/lib';

// Changelog + git
import {
  parseChangelog, findEntryByVersion, formatVersionHeader, updateCommitSha,
  isGitRepo, findCommitForVersion, findCommitByTag, listVersionBumps,
} from '@koniverse/koni-docs/lib';
```

Subpath exports: `@koniverse/koni-docs/lib`, `@koniverse/koni-docs/lib/markdown`, `@koniverse/koni-docs/lib/schemas`.

The lib has zero CLI dependencies. Composes `gray-matter` (frontmatter) + `unified` / `remark-parse` / `remark-stringify` / `remark-gfm` (markdown AST) + `zod` (schemas). **Mutation contract**: every export is pure — functions starting with `update*` return a new value, never mutate inputs. Sole exception: `parseTable(...).node` returns a reference to the underlying mdast Table node (intentional, documented at call site).

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `koni-docs --version` reports an older number than `package.json` | Build/install drift after editing source | `cd packages/koni-docs && npm run build && npm pack && npm install -g ./koniverse-koni-docs-<v>.tgz` |
| `sync` warns `PRD Functional Requirements FR <id>: section "## Functional Requirements" not found` | PRD has no `## Functional Requirements` heading and no legacy `## 8.` heading either | Rename the H2 to `## Functional Requirements` (canonical label form). Legacy numbered headings (`## 8. Functional Requirements`, with or without `(FR)` suffix) are still matched by the legacy fallback, but new PRDs should use the label form |
| `validate` exits non-zero with `(not_found)` warnings | Story references a sprint / epic file that doesn't exist | Either create the missing file or fix the story's `sprint:` / `epic:` frontmatter |
| `preview` shows 500 SyntaxError on `/` | A stale `dist/` from an old build | Reinstall: `npm install -g @koniverse/koni-docs@latest` |
| `preview --watch` browser doesn't auto-reload | Browser cached page from before `--watch` was passed | Open DevTools, disable cache, reload once; afterwards SSE works |
| `writeDoc` adds/removes quotes in git diff | gray-matter normalization — fixed in a later release, which preserves the original quote style per key | Upgrade to the current release |

## 9. Skill ↔ CLI relationship

This skill (the `SKILL.md` you are reading) and the `koni-docs` CLI evolve together. **When the SKILL.md says "run X"**, X is one of the subcommands above. **When the CLI gains a new subcommand**, §4 above is where it lands — that table is
authoritative. SKILL.md §7 carries a one-line-per-command menu so a reader can see the
surface without loading this file; when the two disagree, §4 wins.

Skill files at `skills/koni-docs/` in this repo are the canonical source. Consumer projects link to this skill (preferred: symlink each agent's `.<agent>/skills/koni-docs/` → `../../skills/koni-docs`); the `skills-lock.json` `sourceType: "github"` mechanism is for projects that can't or won't host the file locally.
