# Changelog

All notable changes to **senti-mcp-server** are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Every code-shipping commit bumps [`VERSION`](../VERSION) and adds an entry here in
the **same commit** (RULE-1). Entries carry no commit SHA: a commit cannot contain
its own SHA, and `--amend`-ing one in orphans it (RULE-2). The `## [X.Y.Z]` anchor
plus the git tag are the join keys — `git log --grep '0.1.0'` finds the commit.

---

## [Unreleased]

(empty — track here while in dev but not yet shipped)

---

## [0.1.0] — 2026-08-05 — First release: authenticated Senti client and list_accounts — v0.1.0

First release. Adopted the `koni-docs` documentation framework, then built an
authenticated Senti Quant API client and shipped its first tool, `list_accounts`, over
MCP stdio — proven with one live call against the development API.

### Added
- `koni-docs` documentation framework: the skill vendored at `.agents/skills/koni-docs`
  with `.claude/skills/koni-docs` symlinked to it, and `skills-lock.json` recording
  source and content hash.
- `@koniverse/koni-docs@^0.12.0` as a devDependency, exposed as `npm run agile:status`
  and `npm run agile:validate`.
- `VERSION`, `docs/README.md`, `docs/CHANGELOG.md`, `docs/CONTEXT.md`.
- Sprint corpus: EPIC-1, EPIC-2, `sprint-2026-W32`, and four stories.
- `AGENTS.md` as the canonical project guide; `CLAUDE.md` with the koni-docs
  integration and Active Context blocks.
- `src/config.ts` — `loadConfig(env)` producing a frozen `Config`; fails fast with
  actionable text when `SENTI_API_KEY` is absent.
- `src/errors.ts` — `ApiError` carrying HTTP status and envelope code; `describeError`
  flattening the `cause` chain.
- `src/client.ts` — `createClient(config, deps)` owning the `Authorization` header, a
  15s timeout combined with the caller's `AbortSignal`, and status-to-message mapping.
- `src/accounts.ts` — Zod schema for the 16-field account object, `parseAccounts`, and
  a compact text rendering where null balances show as `—`.
- `src/server.ts` — the `list_accounts` tool, registered read-only, returning both a
  text summary and `{ accounts: [...] }` as `structuredContent`.
- `src/index.ts` — stdio bootstrap serving both the 2025 and 2026 protocol eras via
  `serveStdio`.
- `src/smoke.test.ts` — one opt-in live call against the development API, skipped when
  no key is present.
- `README.md` — tools, configuration, install, client config, and the read-only
  posture.
- MIT `LICENSE`.

### Changed
- The v1 implementation plan's Task 1 now extends `package.json` instead of creating
  it, and each task names the story it advances.

---
