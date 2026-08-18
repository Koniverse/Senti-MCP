---
id: sprint-2026-W32
status: closed
start: 2026-08-03T00:00:00.000Z
end: 2026-08-09T00:00:00.000Z
goal: 'Adopt koni-docs, then ship v0.1.0 — a list_accounts tool reading linked MT5 accounts from the Senti Quant Public API'
---
## Sprint scope

| US     | Title                                                  | Epic   | Pri | Points | Status | Story file                                               |
| ------ | ------------------------------------------------------ | ------ | --- | ------ | ------ | -------------------------------------------------------- |
| US-1.1 | Adopt koni-docs as this repo's documentation framework | EPIC-1 | P1  | 3      | ✅ done | [link](stories/US-1.1-adopt-koni-docs-framework.md)      |
| US-2.1 | Authenticated Senti API client substrate               | EPIC-2 | P1  | 5      | ✅ done | [link](stories/US-2.1-authenticated-senti-api-client.md) |
| US-2.2 | `list_accounts` tool over MCP stdio                    | EPIC-2 | P1  | 5      | ✅ done | [link](stories/US-2.2-list-accounts-tool.md)             |
| US-2.3 | Live smoke test and README                             | EPIC-2 | P2  | 2      | ✅ done | [link](stories/US-2.3-live-smoke-test-and-readme.md)     |

**Total: 4 stories / 15 points.** No story joined this window after it opened, so no row
carries an `_(added …)_` annotation.

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

1. **Phase 1 — Documentation framework** (\~1 day): US-1.1. Skill vendored, CLI wired,
   corpus created, `AGENTS.md` / `CLAUDE.md` in place, `STATUS.md` generating and
   `validate` green.
2. **Phase 2 — Substrate** (\~1.5 days): US-2.1. `config.ts`, `errors.ts`, `client.ts`
   and their 27 tests. Nothing MCP-aware yet.
3. **Phase 3 — The tool** (\~1.5 days): US-2.2. `accounts.ts`, `server.ts`, `index.ts`
   and their 25 tests. First runnable server.
4. **Phase 4 — Proof and release** (\~1 day): US-2.3. Live smoke test against the
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

All four stories closed inside the single week, at the full 15 points, with v0.1.0
tagged locally. The phased plan held in order — koni-docs, then substrate, then the
tool, then proof and release — and nothing had to reorder.

### What went well

- **Sequencing US-1.1 before any `src/` code paid off exactly as predicted**: every
  subsequent commit had somewhere to put its doc update, instead of the alternative of
  writing four stories backwards from finished code.
- **The v1 implementation plan carrying schemas, tests, and error-mapping tables
  verbatim** made US-2.1 and US-2.2 closer to transcription-with-verification than open
  design, which is most of why the 15-point week fit.
- **The live smoke test (US-2.3) did what it exists to do.** It is the one test in the
  suite that could have failed for a reason no stub would catch — a base-URL typo, a
  renamed field, a missing scope — and it passed clean against
  `https://be-dev.sentitrade.xyz` on the first run, returning one real account.

### What didn't

- **Nothing structural. The one genuine finding was editorial, not technical.** US-2.2's
  AC-20 said "`src/server.ts` is the only file importing from `@modelcontextprotocol/*`",
  which was wrong the moment `src/index.ts` (the `/stdio` subpath, by design) and
  `src/server.test.ts` (a test client, by the plan's own code) both legitimately import
  from the SDK. It shipped that way through US-2.2's own close because nothing exercised
  the AC's exact wording against the exact `grep` until this release commit re-verified
  every AC across all four stories. The fix was narrow — reword the AC to name all three
  files and correct its verification row — and the underlying invariant (`server.ts` owns
  the SDK's main entry; nothing else does) was never actually violated.

### Followups

- **`docs/LESSONS.md` still has no real entry, which is correct rather than a gap** —
  nothing in this sprint reached the bar of "trap a future session would otherwise walk
  into" on its own; the AC-20 wording issue is recorded in
  [US-2.2](stories/US-2.2-list-accounts-tool.md)'s Implementation notes instead, since it
  is a one-story correction rather than a repo-wide trap.
- **EPIC-2 stays open**: 16 read operations remain, and the design spec estimates the
  second one at roughly thirty lines now that the client, error mapping, and formatting
  conventions are proven.
- **Next sprint**: US-2.4 onward, one read tool at a time, splitting `src/` by API tag
  (`trading.ts`, `performance.ts`, …) as the design spec anticipates.

## Cross-references

- [EPIC-1](epics/EPIC-1.md) · [EPIC-2](epics/EPIC-2.md)
- [STATUS.md](STATUS.md) — generated kanban
- [CONTEXT D1–D4](../CONTEXT.md) — decisions taken this sprint
- [CONTEXT D30](../CONTEXT.md) — the single-scope-table shape this file is written in
- [v1 design spec](../superpowers/specs/2026-08-05-senti-mcp-server-design.md)
- [v1 implementation plan](../superpowers/plans/2026-08-05-senti-mcp-server-v1.md)
- [sprint-2026-W33](sprint-2026-W33.md) — next sprint
