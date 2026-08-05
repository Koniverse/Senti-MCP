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
- `docs/SETUP.md` and `.env.example` — local setup, troubleshooting, and all three
  environment variables with placeholders (RULE-11).
- `tsconfig.test.json` — typecheck-only config with no exclude, so `npm run typecheck`
  covers the test files the build config deliberately keeps out of `dist/`.
- `src/index.test.ts` — spawns the built `dist/index.js` and asserts both startup
  legs, including that nothing reaches stdout.

### Changed
- **Node floor raised to 20.6.0.** `AbortSignal.any()` needs 20.3.0 and
  `test:smoke`'s `node --env-file` needs 20.6.0; on 20.0–20.2 the server started and
  then failed on every tool call ([CONTEXT D5](CONTEXT.md)).
- `SENTI_API_BASE_URL` must now be an absolute `https:` or `http:` URL. A scheme this
  client cannot fetch, or a base carrying a query string or fragment, is rejected at
  startup with the offending value named ([CONTEXT D6](CONTEXT.md)).
- A soft-deleted account is marked as such in the text summary and counted separately
  in the header, instead of reading exactly like a live one; the terminal's status is
  reported alongside it.
- The 401 message now says the key must belong to the environment
  `SENTI_API_BASE_URL` targets, rather than only pointing back at `SENTI_API_KEY`.

### Fixed
- API error messages no longer double their sentence terminator
  (`…Insufficient scope.. The API key is missing…`).
- A rejected `close()` on SIGINT/SIGTERM is reported to stderr instead of floating as
  an unhandled rejection, which under Node's defaults turned a clean shutdown into a
  crash.
- Out-of-band stdio transport errors are reported to stderr instead of being silent.
- The environment-mismatch warning in `README.md`, `docs/SETUP.md` and `.env.example`
  named three environments (production, staging, development) and resolved none of
  them, so its own logic predicted a `401` for the documented happy path. It now states
  the pairing that has actually been verified — a key issued from the staging dashboard
  works against `https://be-dev.sentitrade.xyz`, the pairing `npm run test:smoke` has
  exercised twice — and leaves the production pairing explicitly unconfirmed.

---
