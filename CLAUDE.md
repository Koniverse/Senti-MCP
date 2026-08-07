# CLAUDE.md — senti-mcp-server

This project uses **[AGENTS.md](AGENTS.md)** as the single source of truth for all AI
instructions — project purpose, repo structure, conventions, skill catalog, security
invariants, and the documentation map. Read it first. On any conflict, AGENTS.md wins.

## Koni-Docs Integration

koni-docs:
  plugins: []
  docs_path: docs/
  active_sprint: sprint-2026-W33
  version_file: VERSION

## Active Context <!-- koni-docs:auto-update -->
- Sprint: sprint-2026-W33 (2026-08-10 → 2026-08-16) — 6 stories / 15 points — ✅ closed
- Active Stories: all six closed. ✅ US-2.4 tool substrate and directory layout — ships 0.2.0. ✅ US-2.5 `list_brokers` — ships 0.3.0. ✅ US-2.6 `list_strategies` — ships 0.4.0. ✅ US-2.7 `list_account_strategies` — ships 0.5.0. ✅ US-2.8 `list_positions` — ships 0.6.0. ✅ US-2.9 `list_pending_orders` — ships 0.7.0
- Next Up: W34's plan (not yet written) starts from `src/server.ts` with six `register*` calls already in place and covers the four remaining read operations — `get_account_performance`, `get_performance_breakdowns`, `get_equity_timeseries`, `list_deals` — per the [read-tool expansion spec](docs/superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)'s W34 split (EPIC-2 stays `in-progress`). These open query parameters, payload downsampling and cursor pagination — three axes this closed sprint deliberately kept shut. Get a working `SENTI_SMOKE_KEY` before W34's first story closes: the one available this sprint returned `401` against both the dev and production base URLs and settled neither of two open schema questions live (see sprint-2026-W33's retrospective)
- Last Version: 0.7.0 — the last tool of sprint W33 and the order-side twin of 0.6.0's `list_positions`. `list_pending_orders` reads `GET /api/v1/accounts/{accountId}/orders` and returns the pending limit/stop orders resting on one MT5 account. Reuses the `409`-terminal-offline/real-zero/`conflictMeans` pattern US-2.8 established unchanged — only the wording differs — the second use of that pattern needed zero design. Adds one field `list_positions` doesn't have: `priceStopLimit`, whose `0` means "does not apply to this order type" and is omitted from rendering entirely, unlike `sl`/`tp`'s `0` → `—`. Routes through `accountPath`; registers through `registerReadTool` under `trading:read`. `src/server.ts` now registers all six W33 tools
- Recent Decisions: D9 tools bind and shape their own payloads (a year of `breakdowns` is ~70k tokens) · D8 `registerReadTool`/`parseOrThrow` over a descriptor table — the repetition worth removing was the mechanical try/catch, not the descriptions and schemas a model picks a tool by · D7 `core/` + `tools/<tag>/` replaces the flat layout · D6 reject a base URL that is not a bare `https:`/`http:` origin · D5 Node floor raised to 20.6.0
- Recent Lessons: [LESSONS §1](docs/LESSONS.md) — a green suite after a mutation is not evidence the mutation landed; `grep` the target file to confirm an edit actually landed before trusting the test result that follows, especially when verifying a table-driven invariant's enrollment
- Watch: the version string lives in **three** places — `VERSION`, `package.json`, `SERVER_VERSION` in `src/config.ts`. koni-docs checks the first two; `config.test.ts` fails the suite if the third drifts. The API key now needs **five** read scopes (`accounts:read`, `brokers:read`, `strategies:read`, `performance:read`, `trading:read`); there is no key-introspection endpoint, so a missing one surfaces only as a 403 naming it when the affected tool is first called. Adding an env var needs `docs/SETUP.md` + `.env.example` in the same commit (RULE-11)
<!-- /koni-docs:auto-update -->

Refresh this block at the koni-docs trigger points: story start or close, sprint open or
close, a CONTEXT decision, a LESSONS entry, a version bump
([integration.md §4](.agents/skills/koni-docs/references/templates/integration.md)).

## Repo-specific notes for Claude Code

- **`npm run` sets cwd to the package root.** `agile:status` and `agile:validate` resolve
  `--docs-path docs/` correctly regardless of where you invoke them from — but a bare
  `npx koni-docs …` does not. Run those from the repo root.
- **`.claude/skills/koni-docs` is a symlink** into `.agents/skills/koni-docs`. Read
  through it freely; do not write through it. See AGENTS.md §Skills.
- **`docs/superpowers/` is not legacy.** Superpowers produces the spec and the plan;
  koni-docs standardizes the outcome into epics, stories, and a changelog. Both stay.
