# AGENTS.md — senti-mcp-server

> **This file is the single source of truth for all AI agent instructions in this
> project.** Cursor, Gemini, Codex CLI, Copilot CLI, and Claude Code all read it.
> [`CLAUDE.md`](CLAUDE.md) is a thin pointer back to this file plus the Koni-Docs
> Integration and Active Context blocks; on any conflict, this file wins.

## Project purpose

An [MCP](https://modelcontextprotocol.io) server that lets a user's AI agent read and
interact with **[Senti Quant](https://github.com/Koniverse/Senti-Quant)** through its
Public API.

The API — `https://api.sentitrade.xyz`, OpenAPI 3.1 at `/api/v1/openapi.json` — exposes
17 operations across 15 paths, tagged Accounts, Brokers, Strategies, Performance, and
Trading. An MCP host cannot call it directly: something has to own the API key, present
typed tools whose descriptions let a model choose correctly, and turn API errors into
text a model can act on. This server is that something.

**Current state: no runtime code.** v1 ships exactly one tool, `list_accounts`, and is
tracked as [US-2.2](docs/sprints/stories/US-2.2-list-accounts-tool.md). Read the
[design spec](docs/superpowers/specs/2026-08-05-senti-mcp-server-design.md) before
touching anything under `src/`.

### The read/write split

This is the project's load-bearing architectural boundary. **Only read operations are
exposed.** Eight of the 17 operations are `POST`, two of them `positions/close-all` and
`orders/cancel-all`. A tool an LLM can call that closes every open position is not a
bigger version of a tool that lists accounts — it needs an opt-in switch, an
`Idempotency-Key`, and user confirmation before execution. It gets its own epic and its
own design spec. Do not register a write tool, and do not add one "ready to enable".

## Repo structure

```
src/                    ← not created yet; see the v1 plan for the six-file layout
docs/                   ← all documentation (see docs/README.md)
  sprints/              ← epics, stories, active sprint, generated STATUS.md
  superpowers/           ← design specs and implementation plans
.agents/skills/koni-docs/  ← vendored koni-docs skill (real files, do not edit)
.claude/skills/koni-docs   → relative symlink into .agents/
skills-lock.json        ← skill provenance: source + content hash
VERSION                 ← bare semver, no `v` prefix
```

## Documentation

- [docs/README.md](docs/README.md) — **start here.** Doc hub, pre-commit checklist, and
  a table of which files are deliberately absent and what would bring each one in
- [docs/CONTEXT.md](docs/CONTEXT.md) — decision log, append-only
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — release history
- [docs/sprints/STATUS.md](docs/sprints/STATUS.md) — kanban, **auto-generated**
- [docs/sprints/sprint-2026-W32.md](docs/sprints/sprint-2026-W32.md) — active sprint
- [docs/sprints/epics/](docs/sprints/epics/) — EPIC-1 (foundation), EPIC-2 (read path)
- [docs/superpowers/specs/2026-08-05-senti-mcp-server-design.md](docs/superpowers/specs/2026-08-05-senti-mcp-server-design.md) — v1 design
- [docs/superpowers/plans/2026-08-05-senti-mcp-server-v1.md](docs/superpowers/plans/2026-08-05-senti-mcp-server-v1.md) — v1 plan, task by task
- [VERSION](VERSION) — current semver

There is no `PRD.md`, `ARCHITECTURE.md`, `LESSONS.md`, `SETUP.md`, or `.env.example`
yet. Each absence is a recorded decision, not an oversight —
[docs/README.md](docs/README.md) explains which trigger brings each one in.

## Koni-Docs

This project uses koni-docs for documentation management. All docs follow the structure
defined in [`docs/README.md`](docs/README.md). See the
[koni-docs skill](.agents/skills/koni-docs/SKILL.md) for templates, rules, and workflows.

**The one rule above all others: every code-shipping commit updates docs in the SAME
commit.** Never defer documentation to a follow-up. The single carve-out is a commit's
own SHA, which is backfilled by a later commit and never `--amend`-ed in (RULE-2).

Before writing code: read the story, flip its `status:` to `in-progress`, and mark its
tasks `[x]` as you complete them rather than all at the end (RULE-10).

### Skills

| Skill | Source | Wired how |
|---|---|---|
| `koni-docs` | `Koniverse/Koni-Skills` | Vendored at `.agents/skills/koni-docs`, symlinked into `.claude/skills/`, pinned in `skills-lock.json` |

`koni-harness` (commit gate) and `koni-qc` (QC and security review) are **not** wired —
see [EPIC-1 §Out of scope](docs/sprints/epics/EPIC-1.md). Add one with
`npx skills add Koniverse/Koni-Skills --skill <name> --agent claude-code --agent universal`.

**Do not edit `.agents/skills/koni-docs/` in place.** It is a mirror of upstream, and
the lockfile records its content hash. Improvements go to `Koniverse/Koni-Skills` and
come back via `npx skills update koni-docs`.

## Conventions

- **English only** for code, comments, error messages, commits, and docs (RULE-13).
  Vietnamese in chat is fine; the artifacts are English.
- **Commit prefixes** (RULE-14): `feat:` `fix:` `chore:` `docs:` `style:` `refactor:`
  `test:`
- **`docs/sprints/STATUS.md` is generated.** Regenerate it; never edit it (RULE-5).
- **`docs/CONTEXT.md` is append-only** (RULE-7). A changed decision is a new entry
  citing the old one by `D<N>`, never an edit to the original.
- **Frontmatter `id` matches the filename** (RULE-6). Stories are `US-X.Y-<slug>.md`.
- **`version_shipped` is bare semver** (`0.1.0`, never `v0.1.0`) — RULE-16.
- **`assignee` is a GitHub login**, never `git user.name` — RULE-15.
- **ID frontmatter fields hold bare IDs only**, never prose — RULE-17.

### Security conventions

Two invariants that outlive any single story. Both are
[EPIC-2](docs/sprints/epics/EPIC-2.md) cross-cutting concerns:

- **The API key never becomes a tool parameter.** A tool parameter lives in the model's
  context and from there reaches transcripts and logs. It is read from `SENTI_API_KEY`,
  attached as an `Authorization` header, and asserted absent from every error branch's
  output.
- **Every path parameter is format-validated and `encodeURIComponent`-ed before being
  joined into a URL.** v1 has no path parameter, which is exactly why this is written
  down: `accountId` originates from the model, and a value like `..%2F..%2Fadmin`
  escapes `/api/v1/accounts/` under naive string concatenation. This is the defect most
  easily introduced by copying the first tool into the second.

## Quick reference

```bash
npm run agile:status      # regenerate docs/sprints/STATUS.md (RULE-5)
npm run agile:validate    # ID-graph + due-date integrity; must exit 0
npx koni-docs --version   # confirm which CLI you have (expect 0.12.0)

# once src/ exists (see the v1 plan):
npm test                  # unit tests, stubbed fetch
npm run typecheck
npm run build
npm run test:smoke        # one live call; needs SENTI_SMOKE_KEY in .env.local
```

| I want to… | Do this |
|---|---|
| Know what's in flight | Read the Active Context block in [CLAUDE.md](CLAUDE.md) |
| Start a story | Flip `status: in-progress`, confirm it is in the sprint scope table |
| Record a decision | Append the next `D<N>` to [docs/CONTEXT.md](docs/CONTEXT.md) |
| Add a tool | Read [EPIC-2](docs/sprints/epics/EPIC-2.md) invariants first, then the design spec |
| Ship a version | Bump [VERSION](VERSION) + add the CHANGELOG entry in the same commit (RULE-1) |
| Commit | Walk the checklist in [docs/README.md](docs/README.md) |

## Environment

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `SENTI_API_KEY` | yes | — | First-party key, `sq_live_…`. The server exits at startup without it. |
| `SENTI_API_BASE_URL` | no | `https://api.sentitrade.xyz` | Set to `https://be-dev.sentitrade.xyz` for development. |
| `SENTI_SMOKE_KEY` | no | — | Test-only. Read from a gitignored `.env.local`; absent means the smoke test skips rather than fails. |

Neither key is ever printed, logged, or committed. When adding a variable, RULE-11
requires `SETUP.md` and `.env.example` in the same commit — both of which this repo will
create at that moment, since neither exists yet.
