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

## [0.4.0] — 2026-08-06 — `list_strategies`: the second tool on the new substrate

Second tool built on the `core/` + `tools/<tag>/` substrate US-2.4 shipped in 0.2.0, and
the second and last no-path-parameter, platform-wide catalog tool this sprint (sibling of
`list_brokers`). `list_strategies` reads `GET /api/v1/strategies` and returns the
platform-wide catalog of strategies (expert advisors) available to deploy — every symbol,
timeframe, rating and preset Senti offers — not the strategies currently running on any
particular account. The description says so explicitly and points at
`list_account_strategies`, US-2.7's tool, for that user-scoped question.

`description`, `supportedSymbols` and `supportedTimeframes` are optional in the upstream
schema — absent from the endpoint's `required` array, not merely nullable — so
`StrategySchema` marks them `.optional()` rather than only `.nullable()`, and a response
omitting any of the three parses cleanly. `avgRating` stays nullable-not-optional and
renders as `—`, never `0`, when a strategy has no reviews yet — the same
null-is-not-zero precedent `list_accounts` set for `lastKnownBalance`.

### Added
- `list_strategies` tool (`src/tools/strategies/list-strategies.ts`) —
  `registerListStrategies`, registered read-only via `registerReadTool` under the
  `strategies:read` scope. Takes no arguments. Points a model at `id` as the
  `eaDefinitionId` when deploying.
- `src/server.test.ts` — a `list_strategies` invariant row in `TOOL_CALLS`, plus its own
  `describe` block asserting the platform-wide description naming
  `list_account_strategies`, and the `strategies:read` scope named on a `403`.

### Changed
- `src/server.ts` now registers three tools; `list_accounts` and `list_brokers` are
  unchanged.

---

## [0.3.0] — 2026-08-06 — `list_brokers`: the first tool on the new substrate

First tool built on the `core/` + `tools/<tag>/` substrate US-2.4 shipped in 0.2.0.
`list_brokers` reads `GET /api/v1/brokers` and returns the platform-wide catalog of
brokers Senti supports — every MT5 server name and account type available to link,
not the accounts this API key already has. The description says so explicitly, since
read plainly "brokers" is easily mistaken for "the brokers I trade with."

### Added
- `list_brokers` tool (`src/tools/brokers/list-brokers.ts`) — `registerListBrokers`,
  registered read-only via `registerReadTool` under the `brokers:read` scope. Takes no
  arguments. Points a model at `accountTypes[].id` as the `brokerAccountTypeId` and a
  `servers[]` value as the `server` the account-linking endpoint takes.
- `src/server.test.ts` — a `list_brokers` invariant row in `TOOL_CALLS`, plus its own
  `describe` block asserting the platform-wide description, the empty input schema, and
  the `brokers:read` scope named on a `403`.

### Changed
- `src/server.ts` now registers two tools; `list_accounts` is unchanged.

---

## [0.2.0] — 2026-08-06 — Read-tool substrate: core/ + tools/, registerReadTool, five scopes

Substrate release — ships no new tool. Restructures `src/` into `core/`
(infrastructure) and `tools/<tag>/` (one folder per API tag), adds the
`registerReadTool`/`parseOrThrow` helpers and the client's `query`/`accountPath`/
`404`/`409` support, and migrates `list_accounts` onto all of it with no behaviour
change. This is the shape the remaining nine read tools land in over the rest of this
sprint and the next.

### Added
- `src/core/` — `client.ts`, `errors.ts`, `tool.ts`, `parse.ts`, each with a
  co-located test file. Infrastructure that never imports from `tools/` (enforced by
  grep, not review).
- `client.get`'s `query` option — drops `undefined` entries, encodes the rest via
  `URLSearchParams`.
- `accountPath` — the only function permitted to build a path carrying `accountId`.
  Validates each segment against `/^[A-Za-z0-9_-]{1,64}$/` before
  `encodeURIComponent`, rejecting `../`, percent-encoded traversal, the empty string,
  and oversized segments.
- Dedicated `404` and `409` branches in `client.get`. `404` names the three likely
  causes (account doesn't exist, isn't owned by this key, or a `login` was passed
  instead of `id`) and points at `list_accounts`. `409` takes a call-site-supplied
  `conflictMeans` string, since what a conflict means is a property of the endpoint,
  not something the client can infer.
- `registerReadTool` (`core/tool.ts`) — registers a tool with `readOnlyHint: true` and
  `openWorldHint: true` set as constants with no parameter path to override them,
  wraps `run` in the `try`/`catch` every tool needs, and returns
  `{ content, structuredContent }` on success or `{ content, isError: true }` on
  failure.
- `parseOrThrow` (`core/parse.ts`) — the `safeParse`-or-throw-naming-the-field pattern
  generalized out of `accounts.ts` so every tool shares one implementation.
- `src/tools/accounts/list-accounts.ts` — `list_accounts`, migrated from
  `src/accounts.ts` onto `registerReadTool` and `parseOrThrow` with no behaviour
  change.
- Table-driven invariant tests in `src/server.test.ts`, written once to cover every
  tool added afterwards: `readOnlyHint`/`openWorldHint` on every registered tool, no
  API key leakage on any of six error statuses or a network failure, and
  `structuredContent` validating against each tool's own `outputSchema` on a
  successful call. Later tool stories add one `TOOL_CALLS` row instead of writing new
  tests.
- `docs/sprints/epics/EPIC-3.md` — placeholder for the write path (`status: backlog`,
  no stories yet): the seven write operations and their guardrails (opt-in
  environment variable, `Idempotency-Key` on the two operations that accept it,
  elicitation before execution, the partial-close-is-not-retry-safe warning, and the
  best-effort-batch contract for the two `*-all` operations).

### Changed
- Repo layout: `src/` splits into `core/` and `tools/<tag>/` — `accounts/` today,
  `brokers/`, `strategies/`, `performance/`, and `trading/` as their tools land
  ([CONTEXT D7](CONTEXT.md)). Reverses the flat-layout rule v0.1.0 shipped with.
- `list_accounts` now registers through `registerReadTool` ([CONTEXT D8](CONTEXT.md)).
- The API key now needs five read scopes, not one: `accounts:read`, `brokers:read`,
  `strategies:read`, `performance:read`, `trading:read` — documented in
  `docs/SETUP.md`, `.env.example`, and `README.md`. There is no key-introspection
  endpoint, so a missing scope is not caught at startup; it surfaces as a `403`
  naming the scope the first time the affected tool is called, and every other tool
  keeps working. Only `accounts:read` is exercised by a shipped tool today.

### Fixed
- `AGENTS.md` and `docs/sprints/epics/EPIC-2.md` corrected: the Senti Quant Public
  API is 10 `GET` + 7 `POST` (17 operations), not "eight of 17 are POST." With
  `list_accounts` shipped, **nine** read operations remain, not sixteen.

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
