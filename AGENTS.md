# AGENTS.md — senti-mcp-server

> **This file is the single source of truth for all AI agent instructions in this
> project.** Cursor, Gemini, Codex CLI, Copilot CLI, and Claude Code all read it.
> [`CLAUDE.md`](CLAUDE.md) is a thin pointer back to this file plus the Koni-Docs
> Integration block; on any conflict, this file wins.

## Project purpose

An [MCP](https://modelcontextprotocol.io) server that lets a user's AI agent read and
interact with **[Senti Quant](https://github.com/Koniverse/Senti-Quant)** through its
Public API.

The API — `https://api.sentitrade.xyz`, OpenAPI 3.1 at `/api/v1/openapi.json` — exposes
17 operations across 15 paths, tagged Accounts, Brokers, Strategies, Performance, and
Trading. An MCP host cannot call it directly: something has to own the API key, present
typed tools whose descriptions let a model choose correctly, and turn API errors into
text a model can act on. This server is that something.

**Current state: v1.0.1 on npm `latest`.** `1.0.0` is the stable-surface cut and is
tagged git-only; `1.0.1` is the version that carries it to the registry
([CONTEXT D11, D12](docs/CONTEXT.md)). Six tools are registered in `src/server.ts`:
`list_accounts`, `list_brokers`, `list_strategies`, `list_account_strategies`,
`list_positions`, `list_pending_orders` — covering six of the API's 10 `GET`
operations. `list_accounts` shipped first, in v0.1.0, tracked as
[US-2.2](docs/sprints/stories/US-2.2-list-accounts-tool.md) and proven against the
live API by [US-2.3](docs/sprints/stories/US-2.3-live-smoke-test-and-readme.md); the
other five closed out [sprint-2026-W33](docs/sprints/sprint-2026-W33.md)'s Phase 1,
tracked as [US-2.4](docs/sprints/stories/US-2.4-tool-substrate-and-layout.md) through
[US-2.9](docs/sprints/stories/US-2.9-list-pending-orders-tool.md). **Four** read
operations remain — `get_account_performance`, `get_performance_breakdowns`,
`get_equity_timeseries`, `list_deals`. The
[read-tool expansion spec](docs/superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
put them in W34; they were pulled forward into the same W33 window as its **Phase 3** on
2026-08-10 ([CONTEXT D22](docs/CONTEXT.md)), and EPIC-2 stays `in-progress` until they
ship. Read the
[v1 design spec](docs/superpowers/specs/2026-08-05-senti-mcp-server-design.md) and the
expansion spec above before touching anything under `src/`.

### The read/write split

This is the project's load-bearing architectural boundary. **Only read operations are
exposed.** Seven of the 17 operations are `POST`, two of them `positions/close-all` and
`orders/cancel-all`. A tool an LLM can call that closes every open position is not a
bigger version of a tool that lists accounts — it needs an opt-in switch, an
`Idempotency-Key`, and user confirmation before execution. It gets its own epic
([EPIC-3](docs/sprints/epics/EPIC-3.md)) and its own design spec. Do not register a
write tool, and do not add one "ready to enable".

## Repo structure

```
src/
  index.ts              ← #! stdio bootstrap; serveStdio, signal handling. Imports
                          only the SDK's /stdio subpath. MUST stay at root of src/.
  index.test.ts         ← spawns the built dist/index.js
  config.ts             ← loadConfig(env) → frozen Config; SERVER_NAME/SERVER_VERSION
  config.test.ts
  server.ts             ← createServer(config, deps); registers every read tool. The
                          only file importing the SDK's main entry
  server.test.ts
  smoke.test.ts         ← opt-in, one live call; hardcoded path in package.json

  core/                 ← infrastructure; imports nothing from tools/
    client.ts           ← createClient(config, deps).get(); owns the Authorization
                          header, the 15s timeout, status→message mapping, query
                          parameters, accountPath path builder, and 404/409 branches
    client.test.ts
    errors.ts           ← ApiError (status + envelope code); describeError flattens
                          the cause chain, which is what makes fetch failures readable
    errors.test.ts
    tool.ts             ← registerReadTool helper: the try/catch, scope-naming and
                          success/error shaping every tool shares
    tool.test.ts
    parse.ts            ← parseOrThrow helper: turns a zod failure into the
                          "API may have changed" message every tool throws on
    parse.test.ts

  tools/                ← one folder per API tag, one file per endpoint
    accounts/           ← list-accounts.ts — AccountSchema (16 fields), parseAccounts,
                          formatAccounts. Imports no MCP SDK, so it is tested by direct
                          calls. Shipped in v0.1.0, relocated here in v0.2.0
    brokers/            ← list-brokers.ts (v0.3.0)
    strategies/         ← list-strategies.ts, list-account-strategies.ts (v0.4.0, v0.5.0)
    trading/            ← positions.ts, orders.ts (v0.6.0, v0.7.0). deals.ts lands in
                          W33 Phase 3
    performance/        ← not yet present. summary.ts, breakdowns.ts, timeseries.ts land
                          in W33 Phase 3

docs/                   ← all documentation (see docs/README.md)
  SETUP.md              ← local dev setup + env var reference
  LESSONS.md            ← retrospective lessons, append-only
  sprints/              ← epics, stories, active sprint, generated STATUS.md
  superpowers/           ← design specs and implementation plans
.agents/skills/koni-docs/  ← vendored koni-docs skill (real files, do not edit)
.claude/skills/koni-docs   → relative symlink into .agents/
.env.example            ← env var template (committed); .env.local is the real one
skills-lock.json        ← skill provenance: source + content hash
tsconfig.json           ← build config; EXCLUDES *.test.ts so they stay out of dist/
tsconfig.test.json      ← typecheck-only, no exclude; the only thing that typechecks
                          the tests, since vitest transpiles without checking
VERSION                 ← bare semver, no `v` prefix
```

**Architecture constraints:**

- **`src/index.ts` cannot move.** `bin` points at `dist/index.js` and `rootDir` is
  `src`, so relocating `index.ts` changes the `dist/` layout, breaks `bin`, and breaks
  `index.test.ts`, which spawns the built entry point on purpose.
- **`test:smoke` hardcodes `src/smoke.test.ts`.** Moving that file means editing
  `package.json` in the same commit.
- **`tsconfig.json` globs recursively (`src/**/*.ts`, excluding `src/**/*.test.ts`).**
  Subdirectories need no build change; the glob already reaches them.
- **The dependency edge is one-way: `core/` never imports from `tools/`.** That is
  what keeps `core/` testable without constructing a tool.

**Nothing in `index.ts` may write to stdout** — that stream carries the JSON-RPC
frames. Diagnostics go to stderr. A single stray `console.log` corrupts the protocol,
and the symptom is a client that fails to connect for no visible reason.

## Documentation

- [docs/README.md](docs/README.md) — **start here.** Doc hub, pre-commit checklist, and
  a table of which files are deliberately absent and what would bring each one in
- [docs/SETUP.md](docs/SETUP.md) — local dev setup, the env var reference, troubleshooting
- [docs/RELEASE.md](docs/RELEASE.md) — **how a version is cut and published.** The gate, the
  tag and Release conventions, the trusted-publisher setup, what each failure means, and the
  72-hour unpublish window. Not a `DEPLOY.md` — that absence is still recorded
  ([CONTEXT D18](docs/CONTEXT.md))
- [docs/CONTEXT.md](docs/CONTEXT.md) — decision log, append-only
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — release history
- [docs/sprints/STATUS.md](docs/sprints/STATUS.md) — kanban, **auto-generated**
- [docs/sprints/sprint-2026-W33.md](docs/sprints/sprint-2026-W33.md) — **the active
  sprint** (2026-08-10 → 2026-08-16, three phases): Phase 1 US-2.4 → US-2.9 and Phase 2
  EPIC-4 both delivered; Phase 3 US-2.10 → US-2.13 close EPIC-2's read path
- [docs/sprints/sprint-2026-W34.md](docs/sprints/sprint-2026-W34.md) — `planned` for
  2026-08-17 → 2026-08-23 and carrying no scope; its four stories became W33's Phase 3
  ([CONTEXT D22](docs/CONTEXT.md))
- [docs/LESSONS.md](docs/LESSONS.md) — retrospective lessons, append-only
- [docs/sprints/epics/](docs/sprints/epics/) — EPIC-1 (foundation), EPIC-2 (read path),
  EPIC-3 (write path, backlog), EPIC-4 (the package release process, backlog)
- [docs/superpowers/specs/2026-08-05-senti-mcp-server-design.md](docs/superpowers/specs/2026-08-05-senti-mcp-server-design.md) — v1 design
- [docs/superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md](docs/superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md) — the W33/W34 read-tool expansion design
- [docs/superpowers/plans/2026-08-05-senti-mcp-server-v1.md](docs/superpowers/plans/2026-08-05-senti-mcp-server-v1.md) — v1 plan, task by task
- [docs/superpowers/plans/2026-08-06-senti-read-tools-w33.md](docs/superpowers/plans/2026-08-06-senti-read-tools-w33.md) — W33 plan, task by task
- [VERSION](VERSION) — current semver

There is still no `PRD.md`, `ARCHITECTURE.md`, or `DEPLOY.md`. Each absence is a
recorded decision, not an oversight — [docs/README.md](docs/README.md) explains which
trigger brings each one in. `LESSONS.md` is no longer on that list: it was created
with its first real entry during sprint W33.

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
- **No Active Context block, anywhere.** This repo does not maintain one — not inline
  in `CLAUDE.md` (koni-docs Pattern A), not in a `.active-context.md` (Pattern B). Do
  not write, restore, or refresh one, and ignore the skill's T1–T7 trigger points and
  its `CLAUDE.md Active Context` checklist item ([CONTEXT D7](docs/CONTEXT.md)). The
  sprint file plus generated `STATUS.md` are the only in-flight snapshot.
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

npm test                  # unit tests, stubbed fetch; smoke suite skips
npm run typecheck         # BOTH tsconfig.json and tsconfig.test.json
npm run build             # tsc → dist/, then chmod +x dist/index.js
npm run dev               # run from source, e.g. SENTI_API_KEY=… npm run dev
npm run test:smoke        # one live call; needs SENTI_SMOKE_KEY in .env.local
```

`npm test` builds `dist/` on the way through — `src/index.test.ts` spawns the real
built entry point, because that is the artifact US-2.2 AC-18 is a claim about.

A clean run is **14 files / 197 tests, 1 skipped** (the opt-in smoke test). If you see
roughly double that, you have a leftover git worktree under `.claude/worktrees/` being
collected as a second copy of the suite — `git worktree list` is the only routine command
that shows it, since the path is gitignored. `vitest.config.ts` scopes collection to
`src/**/*.test.ts` to prevent exactly this ([CONTEXT D13](docs/CONTEXT.md),
[LESSONS 3](docs/LESSONS.md)); do not widen it.

| I want to… | Do this |
|---|---|
| Know what's in flight | Read the active sprint file in [docs/sprints/](docs/sprints/) and the generated [STATUS.md](docs/sprints/STATUS.md) |
| Start a story | Flip `status: in-progress`, confirm it is in the sprint scope table |
| Record a decision | Append the next `D<N>` to [docs/CONTEXT.md](docs/CONTEXT.md) |
| Add a tool | Read [EPIC-2](docs/sprints/epics/EPIC-2.md) invariants first, then the design spec |
| Ship a version | **Walk [docs/RELEASE.md](docs/RELEASE.md)** — it does not end at the bump. Bump [VERSION](VERSION) + the CHANGELOG entry in the same commit (RULE-1); the version lives in **five** places — `VERSION`, `package.json`, `package-lock.json`, `SERVER_VERSION` in `src/config.ts`, and the git tag. `src/config.test.ts` fails if the first, second and fourth drift; `release:check` covers all five. Then `npm run release:check` and `npm run release:verify-pack` must exit 0, and the annotated `vX.Y.Z` tag push is what publishes |
| Add an env var | [docs/SETUP.md](docs/SETUP.md) **and** `.env.example`, same commit (RULE-11) |
| Commit | Walk the checklist in [docs/README.md](docs/README.md) |

## Environment

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `SENTI_API_KEY` | yes | — | First-party key, `sq_live_…`. The server exits at startup without it. |
| `SENTI_API_BASE_URL` | no | `https://api.sentitrade.xyz` | Set to `https://be-dev.sentitrade.xyz` for development. Must be absolute `https:` or `http:`, with no query string or fragment. |
| `SENTI_SMOKE_KEY` | no | — | Test-only. Read from a gitignored `.env.local` by `npm run test:smoke`. If `.env.local` exists but doesn't set this, the suite skips cleanly; if `.env.local` doesn't exist at all, `node --env-file` fails to start (`node: .env.local: not found`, exit 9) rather than skipping. |

**The key must belong to the same environment `SENTI_API_BASE_URL` points at.** Keys
are environment-bound and the default base URL is production, so a key issued
elsewhere returns 401 however valid it is. That is the first thing to check on a 401,
ahead of regenerating the key.

Neither key is ever printed, logged, or committed. When adding a variable, RULE-11
requires [docs/SETUP.md](docs/SETUP.md) and `.env.example` updated in the same commit.
