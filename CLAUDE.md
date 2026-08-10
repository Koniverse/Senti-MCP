# CLAUDE.md — senti-mcp-server

This project uses **[AGENTS.md](AGENTS.md)** as the single source of truth for all AI
instructions — project purpose, repo structure, conventions, skill catalog, security
invariants, and the documentation map. Read it first. On any conflict, AGENTS.md wins.

## Koni-Docs Integration

koni-docs:
  plugins: []
  docs_path: docs/
  active_sprint: sprint-2026-W34
  version_file: VERSION

## Repo-specific notes for Claude Code

- **This repo keeps no Active Context block. Never write one.** Do not add an
  `## Active Context` section to this file, do not create `.active-context.md`, and do
  not restore the `<!-- koni-docs:auto-update -->` markers — neither koni-docs Pattern A
  nor Pattern B is in use here ([CONTEXT D7](docs/CONTEXT.md)). This overrides the
  koni-docs skill's §4 trigger points (T1–T7) and the Active Context line in its §3c
  checklist. What is in flight lives in the sprint file and
  [docs/sprints/STATUS.md](docs/sprints/STATUS.md) — read those, and keep them current
  instead.
- **`npm run` sets cwd to the package root.** `agile:status` and `agile:validate` resolve
  `--docs-path docs/` correctly regardless of where you invoke them from — but a bare
  `npx koni-docs …` does not. Run those from the repo root.
- **`.claude/skills/koni-docs` is a symlink** into `.agents/skills/koni-docs`. Read
  through it freely; do not write through it. See AGENTS.md §Skills.
- **`docs/superpowers/` is not legacy.** Superpowers produces the spec and the plan;
  koni-docs standardizes the outcome into epics, stories, and a changelog. Both stay.
