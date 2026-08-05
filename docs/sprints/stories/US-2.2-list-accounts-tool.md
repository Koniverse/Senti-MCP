---
id: US-2.2
title: "list_accounts tool over MCP stdio"
epic: EPIC-2
status: done
version_shipped: 0.1.0
priority: P1
points: 5
sprint: sprint-2026-W32
assignee: bluezdot
created: 2026-08-05
updated: 2026-08-05
---

## Goal

A user asks their assistant "what trading accounts do I have linked?" and gets an answer:
each account's label, broker, balance, sync state, and running strategies — plus the
`accountId` every other Senti endpoint will need. This is the first thing the server can
actually do, and the point at which the substrate stops being theoretical.

## Background

`GET /api/v1/accounts` takes no parameters, requires only the key, and returns a top-level
JSON array of 16-field objects. All 16 fields are required; many are nullable. That
distinction is the whole story of the formatting work: for a trading API the difference
between "never synced" and "balance is zero" is real, so a null balance renders as `—` and
never as `0`. Collapsing them would be a data error wearing formatting's clothes.

Two design points are easy to get wrong and are locked by acceptance criteria.

**The tool description must say that `id`, not `login`, is the handle other endpoints
take.** `login` is the MT5 account number and looks far more like an account identifier
than a UUID does. Without that sentence a model will reach for it, and the failure surfaces
later as a confusing 404 from an unrelated tool.

**`structuredContent` wraps the array under an `accounts` key.** Not because the SDK
rejects arrays — it does not. `projectCallToolResult` wraps a non-object
`structuredContent` as `{ result: … }` on the 2025 protocol era and passes it through
unchanged on the 2026 era. This server speaks both from one process via `serveStdio`, so a
bare array would reach clients as `{ result: [...] }` or as `[...]` depending on which era
the connection negotiated. An explicit object is identical on both, and names the field
while it is at it.

## Acceptance criteria

- [x] **AC-1** — `AccountSchema` accepts a well-formed account, accepts every nullable
  field being null, and strips fields it does not declare.
- [x] **AC-2** — **Given** a response missing a required field, **When** `parseAccounts`
  runs, **Then** it throws naming that field and stating the API may have changed — rather
  than passing malformed data to the model.
- [x] **AC-3** — **Given** a payload that is not an array, **When** `parseAccounts` runs,
  **Then** it throws reporting an unexpected shape.
- [x] **AC-4** — **Given** a null `lastKnownBalance` or `lastKnownEquity`, **When** the list
  is formatted, **Then** it renders as `—`, **And** the output contains neither `null` nor
  `0.00`.
- [x] **AC-5** — Non-null balances render with thousands separators and exactly two decimal
  places (`balance 10,432.11`, `equity 10,502.00`).
- [x] **AC-6** — A `lastSyncAt` timestamp renders as `synced <timestamp>`; a null one
  renders as `never synced`. The two are never conflated.
- [x] **AC-7** — Each entry shows `accountId: <id>` on its own line; an account with no
  `label` falls back to `Account <login>`; running strategies render as
  `EAs: Name (status)` and the line is omitted when none are running; an inactive account
  is marked `inactive`.
- [x] **AC-8** — **Given** an empty account list, **When** it is formatted, **Then** the
  output explains the likely reasons — nothing linked yet, or a key belonging to a
  different user — rather than returning nothing.
- [x] **AC-9** — The leading count agrees in number: `1 linked account.` / `2 linked
  accounts.`
- [x] **AC-10** — `tools/list` reports exactly one tool, `list_accounts`, with
  `readOnlyHint: true` and `openWorldHint: true`, and an empty `inputSchema.properties`.
- [x] **AC-11** — The tool description states that `id` is the `accountId` other endpoints
  take and that `login` is not. Asserted on the description text, because this is the
  sentence that prevents a whole class of downstream failure.
- [x] **AC-12** — **Given** a successful call, **When** the result is returned, **Then** it
  carries both a text `content` block and `structuredContent`, **And**
  `structuredContent` validates against `outputSchema`, **And** it is an object with an
  `accounts` key rather than a bare array.
- [x] **AC-13** — **Given** a 403 from the API, **When** the tool returns, **Then**
  `isError` is true and the text names the `accounts:read` scope.
- [x] **AC-14** — **Given** a network failure, **When** the tool returns, **Then** the
  text carries the underlying cause (e.g. `ENOTFOUND`), not a bare "fetch failed".
- [x] **AC-15** — An error result contains no API key, and carries `content` only — no
  `structuredContent`, since there is no successful payload to describe.
- [x] **AC-16** — **Given** a failed call, **When** the client lists tools again, **Then**
  the session is still alive. A tool error is returned, never thrown out of the callback.
- [x] **AC-17** — **Given** a cancelled tool call, **When** it aborts, **Then** the
  outbound HTTP request aborts too — `ctx.mcpReq.signal` is forwarded to the client.
- [x] **AC-18** — The built server starts from `dist/index.js`, prints its readiness line
  to **stderr** (never stdout, which carries JSON-RPC frames), and exits 1 with the
  `SENTI_API_KEY is required…` message when the key is absent.
- [x] **AC-19** — `npm test` passes with 24 further tests across `accounts.test.ts` (15)
  and `server.test.ts` (9); `npm run typecheck` and `npm run build` exit 0.
- [x] **AC-20** — `src/server.ts` is the only file importing the SDK's main
  `@modelcontextprotocol/server` entry; `src/index.ts` imports only the `/stdio`
  subpath; `src/server.test.ts` imports `@modelcontextprotocol/client` as a test
  client; no other file in `src/` imports from `@modelcontextprotocol/*`.

## Tasks

- [x] **TASK-2.2.1** — `src/accounts.ts` + `src/accounts.test.ts` (AC: 1–9)
  - [x] `AccountSchema` (16 fields), `AccountsOutputSchema`, `parseAccounts`, `formatAccounts`
  - [x] Null numbers via a single `money()` helper so `—` cannot drift per call site
- [x] **TASK-2.2.2** — `src/server.ts` + `src/server.test.ts` (AC: 10–17, 20)
  - [x] `createServer(config, deps)` registering `list_accounts`
  - [x] Forward `ctx.mcpReq.signal`; pass `scope: 'accounts:read'`
  - [x] Return `{ isError: true, content: [text] }` on failure, never throw
  - [x] Cache hints on `tools/list` and `server/discover`
- [x] **TASK-2.2.3** — `src/index.ts` stdio bootstrap (AC: 18)
  - [x] `serveStdio(() => createServer(config))`; diagnostics to stderr; SIGINT/SIGTERM close
  - [x] Keep startup free of I/O — a 2026-era client probes with a second short-lived process
- [x] **TASK-2.2.4** — Verify (AC: 19, 20)
  - [x] `npm test && npm run typecheck && npm run build`
  - [x] Run `node dist/index.js` with and without a key
  - [x] `grep -rln '@modelcontextprotocol' src/` returns only `src/index.ts`,
        `src/server.ts`, and `src/server.test.ts`

## Dev notes

### Architecture constraints

- **`accounts.ts` imports nothing from the MCP SDK**, so schema and formatting are tested
  by calling functions directly. Only `server.ts` and `index.ts` know the protocol exists.
- **No `tools/` directory** for a single tool. When tools multiply they split by API tag —
  `accounts.ts`, `trading.ts`, `performance.ts` — which the flat layout already
  accommodates.
- **Empty `inputSchema`.** `GET /api/v1/accounts` accepts no parameters, and inventing a
  `limit` or `filter` the API does not implement would produce silently ignored arguments.
- **No SSRF surface in this story** — the path is a constant and no part of the URL is
  model-controlled. `read-mcp-server`'s `assertInScope` guard does not apply, because that
  exists for a tool that accepts a URL from the model. This changes the moment `accountId`
  enters a path; see the EPIC-2 invariant, which is recorded now precisely because the next
  tool is where the instinct is to copy this one and drop an id into the path.
- **Zod is imported as `import * as z from 'zod/v4'`**, and relative imports carry `.js`
  extensions (NodeNext).

### Cross-story dependencies

- **Builds on** [US-2.1](US-2.1-authenticated-senti-api-client.md) — uses `createClient`
  for the request, `Config` for identity, and `describeError` to render the failure text.
- **Required by** [US-2.3](US-2.3-live-smoke-test-and-readme.md) — that story exercises
  `parseAccounts` and `formatAccounts` against a real response and documents this tool.
- **Sibling of nothing.** No other story touches these files this sprint.

### What we explicitly did NOT do

- **No write tools.** The eight `POST` operations, including `positions/close-all` and
  `orders/cancel-all`, are not registered and not written "ready to enable". A tool an LLM
  can call that closes every open position needs an opt-in switch, `Idempotency-Key`
  support, and likely elicitation for user confirmation — its own design, not an appendix
  to this one.
- **No further read tools.** Trigger to revisit: this one proven against the live API in
  [US-2.3](US-2.3-live-smoke-test-and-readme.md).
- **No `structuredContent` on error results** — it would have to satisfy `outputSchema`,
  and there is no successful payload to describe.

### References

- [Source: design spec §The `list_accounts` tool](../../superpowers/specs/2026-08-05-senti-mcp-server-design.md) — output shape and the protocol-era rationale
- [Source: design spec §Data model](../../superpowers/specs/2026-08-05-senti-mcp-server-design.md) — the 16 fields, transcribed from the live OpenAPI document
- [Source: design spec §Security](../../superpowers/specs/2026-08-05-senti-mcp-server-design.md) — the path-parameter constraint this story does not yet need
- [Source: v1 implementation plan, Tasks 4–5](../../superpowers/plans/2026-08-05-senti-mcp-server-v1.md)
- [Source: EPIC-2 §Cross-cutting invariants](../epics/EPIC-2.md)

## Verification commands

| AC | Command |
|---|---|
| AC-1–AC-9 | `npm test -- src/accounts.test.ts` → 15 passing |
| AC-10–AC-17 | `npm test -- src/server.test.ts` → 9 passing |
| AC-18 | `node dist/index.js` → exits 1 naming `SENTI_API_KEY`; `SENTI_API_KEY=sq_live_placeholder node dist/index.js` → readiness line on **stderr**, stays running |
| AC-18 (stdout clean) | `SENTI_API_KEY=sq_live_placeholder node dist/index.js 1>/tmp/out 2>/dev/null & sleep 1; kill %1; test ! -s /tmp/out` |
| AC-19 | `npm test && npm run typecheck && npm run build` |
| AC-20 | `grep -rln '@modelcontextprotocol' src/` → only `src/index.ts`, `src/server.ts`, `src/server.test.ts` |

The AC-18 stdout check matters more than it looks: a single stray `console.log` corrupts
the JSON-RPC stream, and the symptom is a client that fails to connect for no visible
reason.

## Changelog entry

### Added
- `src/accounts.ts` — Zod schema for the 16-field account object, `parseAccounts`, and a
  compact text rendering where null balances show as `—`.
- `src/server.ts` — the `list_accounts` tool, registered read-only, returning both a text
  summary and `{ accounts: [...] }` as `structuredContent`.
- `src/index.ts` — stdio bootstrap serving both the 2025 and 2026 protocol eras via
  `serveStdio`.

## Implementation notes

Built to the v1 plan's Tasks 4–5. `accounts.ts` stays free of any MCP import, so
`AccountSchema`, `parseAccounts`, and `formatAccounts` are all tested by calling them
directly — `server.ts` and `index.ts` are the only two files that know the protocol
exists. The one design point worth restating: `structuredContent` is wrapped as
`{ accounts: [...] }` rather than returned as a bare array, because
`projectCallToolResult` treats a non-object `structuredContent` differently across the
2025 and 2026 protocol eras, and this server speaks both from one `serveStdio` process.

While documenting AC-20 in this release commit ([US-2.3](US-2.3-live-smoke-test-and-readme.md)
Task 6), the original wording — "`src/server.ts` is the only file importing from
`@modelcontextprotocol/*`" — turned out to be imprecise: `src/index.ts` imports the
`/stdio` subpath by design (TASK-2.2.3), and `src/server.test.ts` imports
`@modelcontextprotocol/client` as its test client (both correct and intended). The AC
text and its verification row are corrected here to describe what the codebase actually
does — `grep -rln '@modelcontextprotocol' src/` returns exactly those three files — with
the underlying invariant (no *other* file touches the SDK) unchanged and still enforced.

`npm test` passes 24 new tests (`accounts.test.ts` 15, `server.test.ts` 9);
`npm run typecheck` and `npm run build` are both clean, and `node dist/index.js` exits 1
naming `SENTI_API_KEY` when it is absent and prints its readiness line to stderr only
when a key is present.

## Files modified

**Created:**
- `src/accounts.ts` (108 lines) — `AccountSchema`, `AccountsOutputSchema`,
  `parseAccounts`, `formatAccounts`
- `src/accounts.test.ts` (114 lines)
- `src/server.ts` (72 lines) — `createServer(config, deps)`, the `list_accounts` tool
- `src/server.test.ts` (153 lines)
- `src/index.ts` (31 lines) — stdio bootstrap

## Cross-references

- [Epic EPIC-2](../epics/EPIC-2.md)
- [sprint-2026-W32](../sprint-2026-W32.md)
- [CHANGELOG](../../CHANGELOG.md)
- [v1 design spec](../../superpowers/specs/2026-08-05-senti-mcp-server-design.md)
