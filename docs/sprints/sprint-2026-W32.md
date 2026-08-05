---
id: sprint-2026-W32
status: in-progress
start: 2026-08-03
end: 2026-08-09
goal: "Adopt koni-docs, then ship v0.1.0 — a list_accounts tool reading linked MT5 accounts from the Senti Quant Public API"
---

## Sprint scope

| US | Title | Epic | Pri | Points | Status | Story file |
|---|---|---|---|---|---|---|
| US-1.1 | Adopt koni-docs as this repo's documentation framework | EPIC-1 | P1 | 3 | 🚧 in-progress | [link](stories/US-1.1-adopt-koni-docs-framework.md) |
| US-2.1 | Authenticated Senti API client substrate | EPIC-2 | P1 | 5 | 📋 backlog | [link](stories/US-2.1-authenticated-senti-api-client.md) |
| US-2.2 | `list_accounts` tool over MCP stdio | EPIC-2 | P1 | 5 | 📋 backlog | [link](stories/US-2.2-list-accounts-tool.md) |
| US-2.3 | Live smoke test and README | EPIC-2 | P2 | 2 | 📋 backlog | [link](stories/US-2.3-live-smoke-test-and-readme.md) |

**Total: 4 stories / 15 points.**

> AC and Tasks live inside each story file. This table is a planning surface only.

## Sprint goal recap

This is the repo's first sprint, and it carries two strands that have to land in order.

US-1.1 adopts the `koni-docs` framework. It comes first for a reason that is not
sequencing convenience: the framework's core rule is that every code-shipping commit
updates docs in the same commit, and a rule like that can only hold from the first code
commit onward. Adopting after v1 would produce stories written backwards from finished
code, with acceptance criteria reverse-engineered to match whatever the implementation
happened to do. The repo has no `src/` yet, so the window is open exactly now.

US-2.1 through US-2.3 then execute the already-written
[v1 implementation plan](../superpowers/plans/2026-08-05-senti-mcp-server-v1.md) as
forward stories, tracked as they are built.

**The deliverable cut.** One tool, `list_accounts`, backed by `GET /api/v1/accounts`.
The other 16 read operations and all 8 write operations are out, per
[EPIC-2](epics/EPIC-2.md) §Out of scope. A thin vertical slice proven against the real
service is worth more than five tools that have only met a stubbed `fetch`.

**On the 15 points.** That is heavy for one week and the number is honest rather than
comfortable. The mitigating fact is that the v1 plan carries every implementation
verbatim — schemas, tests, and error-mapping tables included — so US-2.x is closer to
transcription with verification than to design. If it does not fit, US-2.3 carries to
W33; it is the only story here nothing else depends on.

## Phased plan

1. **Phase 1 — Documentation framework** (~1 day): US-1.1. Skill vendored, CLI wired,
   corpus created, `AGENTS.md` / `CLAUDE.md` in place, `STATUS.md` generating and
   `validate` green.
2. **Phase 2 — Substrate** (~1.5 days): US-2.1. `config.ts`, `errors.ts`, `client.ts`
   and their 27 tests. Nothing MCP-aware yet.
3. **Phase 3 — The tool** (~1.5 days): US-2.2. `accounts.ts`, `server.ts`, `index.ts`
   and their 25 tests. First runnable server.
4. **Phase 4 — Proof and release** (~1 day): US-2.3. Live smoke test against the
   development API, README, LICENSE, then the `[0.1.0]` CHANGELOG entry with `VERSION`
   in the same commit and all stories flipped to done.

Phases are ordered by dependency, not calendar. Phase 2 cannot start before Phase 1
without breaking the reason Phase 1 exists.

## Dependencies and sequencing constraints

- **US-2.1 → US-2.2 → US-2.3** is a hard chain. US-2.2 consumes `createClient` and
  `describeError`; US-2.3 exercises the whole stack against the live API.
- **US-1.1 blocks nothing technically** but gates the workflow: from its landing
  onward, every commit in this sprint carries its doc update.
- **US-2.3 needs a real API key** with the `accounts:read` scope in a gitignored
  `.env.local`. Without it the smoke test skips rather than fails, so the story can
  start before the key exists but cannot close.
- **`package.json` is created by US-1.1, not US-2.1.** The v1 plan's Task 1 originally
  said "create" it; US-1.1 amends that step to extend it. Reverting to "create" would
  silently drop the koni-docs devDependency.

## Retrospective

_To be filled when the sprint closes._

## Cross-references

- [EPIC-1](epics/EPIC-1.md) · [EPIC-2](epics/EPIC-2.md)
- [STATUS.md](STATUS.md) — generated kanban
- [CONTEXT D1–D4](../CONTEXT.md) — decisions taken this sprint
- [v1 design spec](../superpowers/specs/2026-08-05-senti-mcp-server-design.md)
- [v1 implementation plan](../superpowers/plans/2026-08-05-senti-mcp-server-v1.md)
