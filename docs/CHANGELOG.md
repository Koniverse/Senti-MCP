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

## [0.7.0] — 2026-08-06 — `list_pending_orders`: the last tool of sprint W33

Closes US-2.9 and closes sprint W33. `list_pending_orders` reads `GET
/api/v1/accounts/{accountId}/orders` and returns the pending limit and stop orders
resting on one MT5 account — symbol, order type, volume, trigger price, stop loss, take
profit and stop-limit price — read live from the account's MT5 terminal. It is the
order-side twin of 0.6.0's `list_positions`: filled positions are what `list_positions`
answers, unfilled resting orders are what this tool answers, and the tool's description
points each one at the other.

**The terminal-offline distinction, carried over from `list_positions` unchanged:** a
`200` with an empty `orders` array means the terminal answered and the account
genuinely has nothing pending — a real zero. A `409` means the terminal could not be
reached at all, reported as an error whose text explicitly states it is "NOT the same
as the account having no pending orders" — any resting orders are still resting and may
still trigger. `src/server.test.ts`'s `/offline/i` and `/not the same as/i` assertions
hold that distinction in place the same way they do for `list_positions`.

**One field this tool adds that `list_positions` does not have:** `priceStopLimit`. Unlike
`sl`/`tp` — which apply to every order and render an explicit `—` when `0` — a `0`
`priceStopLimit` means the field does not apply to this order's type at all, so its whole
line is omitted from the rendering rather than shown as a dash.

Like `list_positions`, this tool is account-scoped and routes its path exclusively
through `accountPath` (US-2.4) — no template literal or concatenation touches
`accountId`.

### Added
- `registerListPendingOrders` (`src/tools/trading/orders.ts`) — registered read-only via
  `registerReadTool` under the `trading:read` scope. Takes one required argument,
  `accountId`. Passes a call-site `conflictMeans` string to `client.get` so the `409`
  branch in `core/client.ts` reports the terminal-offline meaning specific to this
  endpoint.
- `src/server.test.ts` — a `list_pending_orders` invariant row in `TOOL_CALLS`
  (`successBody` is the `{ orders: [...] }` envelope, not a bare array), plus its own
  `describe` block: the account-scoped path is called correctly, a `409` is reported as
  an offline terminal distinguished from holding no pending orders, and a `403` names
  the `trading:read` scope.
- `src/smoke.test.ts` now walks the whole W33 read path in one live call:
  `list_accounts` → `list_brokers` → `list_strategies` → (if the key owns an account)
  `list_account_strategies` → `list_positions` → `list_pending_orders`, tolerating a
  `409` on the last two as a real state of the world rather than a broken contract. A
  key with no linked account still exercises every platform-wide endpoint before
  returning early — that is not a failure.

### Changed
- `src/server.ts` now registers six tools — the full W33 tool surface;
  `list_accounts`, `list_brokers`, `list_strategies`, `list_account_strategies` and
  `list_positions` are unchanged.

---

## [0.6.0] — 2026-08-06 — `list_positions`: empty is a real zero, `409` is not

Closes US-2.8. `list_positions` reads `GET /api/v1/accounts/{accountId}/positions` and
returns the positions currently open on one MT5 account — symbol, direction, volume,
open/current price, stop loss, take profit, swap, and floating profit — read live from
the account's MT5 terminal. This is the first tool this sprint where the terminal being
reachable is itself part of the answer: the endpoint's `409` means the terminal is
offline, not that the account holds nothing, and conflating the two would tell a trader
holding open risk that they hold none.

**The terminal-offline distinction, stated plainly because it is easy to misread as a
bug:** a `200` with an empty `positions` array means the terminal answered and the
account genuinely holds no open positions — a real zero. A `409` means the terminal
could not be reached at all, so the API cannot say what is held — this is reported as an
error, with text that explicitly states it is "NOT the same as the account holding no
positions." A model (or a person) reading only the two surface forms — "no positions"
text vs. an error — should never be able to mistake one for the other; that separation
is what `formatPositions`'s empty-list branch and the `409` branch's `conflictMeans`
text each say outright, and what `src/server.test.ts`'s two dedicated assertions
(`/real zero/i` and `/not the same as/i`) hold in place.

Like 0.5.0's `list_account_strategies`, this tool is account-scoped and routes its path
exclusively through `accountPath` (US-2.4) — no template literal or concatenation
touches `accountId`.

### Added
- `registerListPositions` (`src/tools/trading/positions.ts`) — registered read-only via
  `registerReadTool` under the `trading:read` scope. Takes one required argument,
  `accountId`. Passes a call-site `conflictMeans` string to `client.get` so the `409`
  branch in `core/client.ts` reports the terminal-offline meaning specific to this
  endpoint rather than a generic conflict message.
- `src/server.test.ts` — a `list_positions` invariant row in `TOOL_CALLS` (`successBody`
  is the `{ positions: [...] }` envelope, not a bare array, since this endpoint wraps its
  array unlike `list_brokers` and `list_strategies`), plus its own `describe` block: the
  account-scoped path is called correctly, a `409` is reported as an offline terminal and
  is explicitly distinguished from holding no positions, an empty `200` is presented as a
  real zero, and a `403` names the `trading:read` scope.

### Changed
- `src/server.ts` now registers five tools; `list_accounts`, `list_brokers`,
  `list_strategies` and `list_account_strategies` are unchanged.

---

## [0.5.0] — 2026-08-06 — `list_account_strategies`: the first tool with a path parameter

Closes US-2.7. `list_account_strategies` reads `GET /api/v1/accounts/{accountId}/strategies`
and returns the strategies (expert advisors) currently deployed on one MT5 account — a
different question from `list_strategies`'s platform-wide catalog of what could be
deployed. This is the first tool this sprint to take a path parameter, and so the first
to route through `accountPath` (US-2.4, shipped in 0.2.0): every segment is validated
against `/^[A-Za-z0-9_-]{1,64}$/` and `encodeURIComponent`-ed before it is joined into a
URL, and the guard runs *before* `client.get` is entered — a traversal payload such as
`../../admin` is rejected with no HTTP request made at all, not merely rejected by the
server. The description names `list_accounts`' `id` field as the source of `accountId`
and states plainly that `login` (the MT5 account number) is the wrong value; a `404`
repeats that hint via `core/client.ts`'s dedicated branch.

### Added
- `registerListAccountStrategies` (`src/tools/strategies/list-account-strategies.ts`) —
  registered read-only via `registerReadTool` under the `strategies:read` scope. Takes
  one required argument, `accountId`. Builds the request path exclusively through
  `accountPath`; no template literal or concatenation touches the parameter.
- `src/server.test.ts` — a `list_account_strategies` invariant row in `TOOL_CALLS` (the
  first row carrying `arguments`, exercising the key-leak table across all six error
  statuses for a tool that takes a parameter), plus its own `describe` block: the
  account-scoped path is called correctly, a traversal attempt is rejected with the
  stubbed `fetch` asserted **never invoked**, `accountId` is a required input, the
  description names `list_accounts` and `login`, a `404` carries the login/id hint, and
  a `403` names the `strategies:read` scope (this last test is not in the plan's Task
  15 brief; added so AC-6 has an assertion behind it, matching the "names the scope on
  403" test both `list_brokers` and `list_strategies` already carry).

### Changed
- `src/server.ts` now registers four tools; `list_accounts`, `list_brokers` and
  `list_strategies` are unchanged.

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
