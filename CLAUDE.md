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
- Sprint: sprint-2026-W33 (2026-08-10 → 2026-08-16) — 6 stories / 15 points — in-progress
- Active Stories: ✅ US-2.4 tool substrate and directory layout — closed, ships 0.2.0. ✅ US-2.5 `list_brokers` — closed, ships 0.3.0. Open: US-2.6 `list_strategies`, US-2.7 `list_account_strategies`, US-2.8 `list_positions`, US-2.9 `list_pending_orders`
- Next Up: US-2.6 `list_strategies` — the second tool on the new substrate (no path parameter, sibling of US-2.5, same "platform-wide, not yours" description language), per the [read-tool expansion spec](docs/superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md). Four more read operations (`get_account_performance`, `get_performance_breakdowns`, `get_equity_timeseries`, `list_deals`) carry to sprint W34 (EPIC-2 stays `in-progress`)
- Last Version: 0.3.0 — first tool on the US-2.4 substrate. `list_brokers` reads `GET /api/v1/brokers` and returns the platform-wide catalog of brokers Senti supports (MT5 server names, account types) — explicitly not the accounts this API key already has. No path parameter; registers through `registerReadTool` with no new helper code
- Recent Decisions: D9 tools bind and shape their own payloads (a year of `breakdowns` is ~70k tokens) · D8 `registerReadTool`/`parseOrThrow` over a descriptor table — the repetition worth removing was the mechanical try/catch, not the descriptions and schemas a model picks a tool by · D7 `core/` + `tools/<tag>/` replaces the flat layout · D6 reject a base URL that is not a bare `https:`/`http:` origin · D5 Node floor raised to 20.6.0
- Recent Lessons: none — `docs/LESSONS.md` is created with its first real entry
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
