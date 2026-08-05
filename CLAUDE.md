# CLAUDE.md — senti-mcp-server

This project uses **[AGENTS.md](AGENTS.md)** as the single source of truth for all AI
instructions — project purpose, repo structure, conventions, skill catalog, security
invariants, and the documentation map. Read it first. On any conflict, AGENTS.md wins.

## Koni-Docs Integration

koni-docs:
  plugins: []
  docs_path: docs/
  active_sprint: sprint-2026-W32
  version_file: VERSION

## Active Context <!-- koni-docs:auto-update -->
- Sprint: sprint-2026-W32 (2026-08-03 → 2026-08-09) — 4 stories / 15 points — closed
- Active Stories: none — all four closed this sprint: ✅ US-1.1 koni-docs adoption, ✅ US-2.1 authenticated Senti client, ✅ US-2.2 `list_accounts` tool, ✅ US-2.3 live smoke test + README + release
- Next Up: US-2.4 onward — the remaining 16 read operations, one tool per story, split by API tag (EPIC-2 stays `in-progress`)
- Last Version: 0.1.0 — first release, tagged `v0.1.0`. Ships the authenticated Senti client and the `list_accounts` tool, proven against the live development API
- Recent Decisions: D1 adopt koni-docs (reverses the design spec's closing paragraph) · D2 vendor via skills-lock.json, not a symlink · D3 wire `status` + `validate`, omit `sync` · D4 Active Context Pattern A
- Recent Lessons: none — `docs/LESSONS.md` is created with its first real entry
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
