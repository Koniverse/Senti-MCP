# senti-mcp-server — design

**Date:** 2026-08-05
**Status:** approved, ready for implementation planning

## Problem

An AI host (Claude Code, Claude Desktop, Cursor, …) has no way to read a user's
Senti Quant trading data. The Senti Quant Public API exposes that data over HTTP,
but an MCP host cannot call it directly: it needs a server that owns the API key,
presents typed tools, and turns API errors into something a model can act on.

## Scope

**v1 ships exactly one tool: `list_accounts`, backed by `GET /api/v1/accounts`.**

A thin vertical slice — config, auth, HTTP client, error mapping, one tool, tests,
packaging — proves the whole pipe works against the real API before it is
replicated across the remaining 16 operations. Adding the second read tool should
then cost roughly thirty lines.

### Out of scope for v1

The other 16 operations; every write operation; retry/backoff; response caching;
publishing to npm.

## The upstream API

`https://api.sentitrade.xyz` — *Senti Quant Public API*, OpenAPI 3.1.0, served at
`/api/v1/openapi.json` (the Scalar UI at `/api/docs` reads that document).

17 operations across 15 paths, tagged `Accounts`, `Brokers`, `Strategies`,
`Performance`, `Trading`. Two declared servers: production
`https://api.sentitrade.xyz/` and development `https://be-dev.sentitrade.xyz/`.

Four facts from the spec shaped this design:

1. **One auth mechanism, not two.** `securitySchemes` declares only `ApiKeyBearer`
   (`type: http`, `scheme: bearer`). The first-party API key — format `sq_live_…` —
   *is* the bearer token. There is no separate API-key header to support.
2. **Keys carry scopes.** `GET /api/v1/accounts` returns `403` when the key lacks
   `accounts:read`. This is a distinct failure from "you may not see this account",
   and the distinction has to survive into the error message.
3. **Errors share an envelope.** `{ error: { code, message } }` where `code` is one
   of `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`,
   `INVALID_BODY`, `INTERNAL`.
4. **No `operationId` anywhere.** This is why tools are hand-written rather than
   generated: codegen would have to invent every tool name, and tool names and
   descriptions are what decide whether a model calls the right tool at all.

`GET /api/v1/accounts` takes no parameters, requires only the key, and returns a
top-level JSON array. Success responses carry `X-RateLimit-Limit` and
`X-RateLimit-Remaining` headers.

## Approach

Hand-written `registerTool` calls over a single real client seam.

`client.ts` owns everything with genuine risk — base URL joining, the
`Authorization` header, timeouts, reading the error envelope, mapping status codes
to actionable messages. Each tool is a hand-written `server.registerTool` call in
the style of the existing `read-mcp-server` tools.

Two alternatives were considered and rejected:

- **A descriptor table** (`ENDPOINTS = [{ toolName, method, path, … }]` plus a
  registration loop) buys nothing at one endpoint and guesses at a shape that is
  not yet visible. Later operations vary along axes the table would have to grow
  to absorb — path params, query params, request bodies, idempotency keys,
  per-tool output formatting — at which point the config language is harder to
  read than the code it replaced. Revisit when the repetition is real.
- **Generating tools from the OpenAPI document** founders on the missing
  `operationId`s, on inline JSON Schema 3.1 (`type: ["string","null"]`) needing a
  bespoke Zod translator, and on the fact that the LLM-facing descriptions —
  the part that determines whether a tool gets called correctly — cannot be
  generated regardless. High cost, small return at 17 operations.

## Architecture

A new package, `senti-mcp-server`, in its own repository
(`https://github.com/Koniverse/Senti-MCP`), sibling to `read-mcp-server` on disk.

It is a separate package rather than a tool inside `read-mcp-server` because that
package is published as "MCP server that searches and reads documentation from a
single docs website". A trading-data client does not belong under that identity,
and nobody installing a docs reader should also receive tools pointed at their
brokerage accounts.

```
src/
  index.ts     — stdio bootstrap: loadConfig(process.env) → createServer → connect
  config.ts    — env → Config; fails fast when the key is absent
  errors.ts    — ApiError + describeError (cause-chain flattening)
  client.ts    — HTTP, auth, error mapping. Knows nothing about MCP.
  accounts.ts  — Zod schemas and formatting for the Accounts domain. Knows nothing about MCP.
  server.ts    — createServer: wires client + accounts into registerTool
```

`client.ts` and `accounts.ts` import nothing from the MCP SDK, so both are tested
by calling functions directly. Only `server.ts` knows the protocol exists.

Two structures deliberately omitted:

- **No separate `http.ts`.** In `read-mcp-server` it exists because two callers
  (`sitemap.ts`, `fetcher.ts`) share one fetch policy. Here `client.ts` is the only
  caller, so the policy lives there. Splitting it would imitate the shape of the
  other repo without addressing anything.
- **No `tools/` directory** for a single tool. When tools multiply, they split by
  tag — `accounts.ts`, `trading.ts`, `performance.ts` — which the layout above
  already accommodates.

## Configuration

Two environment variables. Nothing else.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `SENTI_API_KEY` | yes | — | First-party key, `sq_live_…`. Absent → the process exits at startup with instructions for creating one. |
| `SENTI_API_BASE_URL` | no | `https://api.sentitrade.xyz` | Point at `https://be-dev.sentitrade.xyz` for development. |

The base URL defaults to production because the OpenAPI document lists it first and
it is the canonical host. Choosing wrong is cheap to detect: keys are
environment-bound, so the wrong host returns `401` immediately rather than quietly
serving the wrong data.

`SENTI_TIMEOUT_MS` and `SENTI_USER_AGENT` are intentionally absent. The timeout is
fixed at 15s and the User-Agent at `senti-mcp-server/<version>`. For an
authenticated first-party API, neither knob addresses a problem that exists.

Base URL handling follows `read-mcp-server`'s `loadConfig`: parse as `URL`, reject
non-absolute values with a message naming the offending input, strip trailing
slashes.

## Authentication

The key is read once at startup from the environment, held in the closure created
by `client.ts`, and attached to every request as `Authorization: Bearer <key>`.

Two constraints, both enforced by tests:

- **The key never appears in any tool's `inputSchema`.** A tool parameter is part
  of the model's context, which means it reaches transcripts, logs, and anywhere
  else the host persists a conversation. The environment variable is a security
  boundary, not a convenience.
- **The key never appears in returned error text.** Every error branch is asserted
  not to contain it.

## The client

An internal `request()` joins the path to the base URL, sets `Authorization` and
`Accept: application/json`, and combines a 15s timeout with the MCP request's
`AbortSignal` so a cancelled tool call also aborts the outbound HTTP request —
matching how `read_doc` forwards `ctx.mcpReq.signal`.

### Error mapping

| HTTP | `error.code` | Message returned to the model |
|---|---|---|
| 401 | `UNAUTHENTICATED` | API key missing or invalid — check `SENTI_API_KEY`; keys look like `sq_live_…` |
| 403 | `FORBIDDEN` | **The key lacks the `accounts:read` scope** — create a new key with that scope in the API Keys dashboard |
| 429 | `RATE_LIMITED` | Rate limit exceeded, quoting `X-RateLimit-Limit` / `X-RateLimit-Remaining` when present |
| 404 / 409 / 400 / 5xx | `NOT_FOUND` / `CONFLICT` / `INVALID_BODY` / `INTERNAL` | The envelope's `message` |
| — | (network, DNS, timeout) | `describeError` flattens the `cause` chain |

The `403` case earns its special handling. Read plainly, "Forbidden" suggests the
caller may not access that account, sending anyone who hits it to investigate the
wrong thing. On this API it always means the key is missing a scope. Saying so
directly lets the model — and the operator — fix it without a detour.

Errors are returned as `isError: true` text results rather than thrown, so the
model can read and act on them instead of watching the call die silently. This
matches the `ok`/`fail` helpers in `read-mcp-server`'s `server.ts`. An error result
carries `content` only — no `structuredContent`, since there is no successful
payload to describe.

`describeError` is copied into this repository from `read-mcp-server` (the two
packages share no code): `fetch` rejects with a bare
"fetch failed" and puts the real reason — connect timeout, DNS failure, TLS error —
in `cause`, so flattening the chain is what makes network failures diagnosable.

## Data model

The response schema, transcribed from the live OpenAPI document. All sixteen
fields are required; many are nullable.

```
id, login, broker, accountType, accessMode, createdAt  → string
label, server, brokerAccountTypeName, lastSyncAt        → string | null
lastKnownBalance, lastKnownEquity                       → number | null
isActive, isSoftDeleted                                 → boolean
terminal        → { assignedPort, terminalStatus, nodeName } | null
activeEas       → { name, status }[]
```

Responses are validated with Zod. Unknown fields are stripped, which is Zod's
default for objects. A missing required field produces an error naming that field
rather than passing malformed data to the model.

## The `list_accounts` tool

**Input:** empty. `GET /api/v1/accounts` accepts no parameters, and inventing a
`limit` or `filter` the API does not implement would produce silently ignored
arguments.

**Annotations:** `readOnlyHint: true`, `openWorldHint: true`.

**Description:** must state that the returned `id` is the `accountId` used by every
other endpoint (`/accounts/{accountId}/positions`, …). Without that sentence a
model will reach for `login`, which is the MT5 account number and not a key.

**Output:** the API returns a top-level array; the tool wraps it in a named object.

```
outputSchema:      { accounts: Account[] }
structuredContent: { accounts: [...] }
```

The wrapping is not because the SDK rejects arrays — it does not. `projectCallToolResult`
handles a non-object `structuredContent` by wrapping it as `{ result: <value> }` on the
2025 era, and passing the natural value through unchanged on the 2026 era. That is
precisely the problem: this server speaks both eras from one process via `serveStdio`,
so a bare array would reach clients as `{ result: [...] }` or as `[...]` depending on
which era the connection negotiated. Returning an explicit `{ accounts: [...] }` is
identical on both, and names the field while it is at it.

Alongside it, `content` carries a compact text rendering:

```
2 linked accounts.

- Main Live (login 51234567) — Exness · MT5 Real
  accountId: 8f2c1b40-3d5e-4a17-9c8b-2e1f0a6d4b93
  balance 10,432.11 · equity 10,502.00 · active · synced 2026-08-05T09:12:00Z
  EAs: TrendRider (running)

- Demo (login 51999888) — ICMarkets · MT5 Demo
  accountId: b1a7e2c9-…
  balance — · equity — · inactive · never synced
```

Null numbers render as `—`, never as `null` or `0`. For a trading API the
difference between "never synced" and "balance is zero" is real, and collapsing
them would be a data error dressed as formatting. An empty list returns a sentence
explaining the likely reasons — no linked accounts, or a key belonging to another
user — rather than empty output.

## Security

**v1 has no SSRF surface.** The path is fixed, takes no parameters, and no part of
the URL is model-controlled. The `assertInScope` origin check that `read-mcp-server`
needs does not apply here: that guard exists because `read_doc` accepts a URL from
the model, and this tool accepts nothing.

That changes the moment `accountId` enters a path, so the constraint is recorded
now:

> Every path parameter must be passed through `encodeURIComponent` and validated
> against its expected format (UUID) **before** being joined into a URL.
> `accountId` originates from the model; a value such as `../../admin` or
> `..%2F..%2Fadmin` escapes `/api/v1/accounts/` under naive string concatenation.

This is the easiest defect to introduce when adding the second tool, where the
instinct is to copy the first and drop an id into the path.

**No write tools.** The eight `POST` operations — including
`positions/close-all` and `orders/cancel-all` — are excluded from v1: not
registered, and not written "ready to enable". A tool an LLM can call that closes
every open position needs its own design (opt-in by environment variable,
`Idempotency-Key` support, likely elicitation for user confirmation) rather than an
appendix to a spec about reading data.

## Testing

Vitest, with `fetch` injected through a `deps` parameter — the pattern already used
by `read-mcp-server`'s `ServerDeps`.

| File | Cases |
|---|---|
| `config.test.ts` | missing `SENTI_API_KEY` throws with actionable text; base URL defaults to production; trailing slashes stripped; non-absolute base URL throws |
| `client.test.ts` | 200 happy path; the `Authorization: Bearer <key>` header is actually sent; 401/403/429 produce their mapped messages (403 must name the scope); 429 quotes the rate-limit headers; malformed JSON; network failure flattens `cause`; the abort signal reaches `fetch`; **the key appears in no error branch's output** |
| `accounts.test.ts` | null `label` and null balances render as `—`; empty list; multiple `activeEas`; Zod rejects a response missing a required field |
| `server.test.ts` | the tool appears in `tools/list`; a successful call returns both `content` and `structuredContent`, and `structuredContent` validates against `outputSchema`; error branches set `isError: true` |

Plus one **real smoke test** against the development API using a real key, guarded
by `describe.skipIf(!process.env.SENTI_SMOKE_KEY)` so it runs on demand and skips
in CI. Every other test uses a stubbed `fetch`; without this one, nothing in the
suite demonstrates the code works against the actual service.

## Packaging

`package.json` (`bin: senti-mcp-server`, `type: module`, Node ≥ 20), `tsconfig.json`,
Vitest, `.gitignore`, MIT `LICENSE`, `README.md`.

Runtime dependencies are `@modelcontextprotocol/server` and `zod` only. The
`cheerio`, `turndown`, and `fast-xml-parser` dependencies in `read-mcp-server` exist
for HTML and sitemap parsing and have no counterpart here.

Client configuration:

```json
{
  "mcpServers": {
    "senti": {
      "command": "node",
      "args": ["/absolute/path/to/senti-mcp-server/dist/index.js"],
      "env": { "SENTI_API_KEY": "sq_live_..." }
    }
  }
}
```

**Not published to npm in v1.** It runs from a local build until there are enough
tools to justify a package.

`@koniverse/koni-docs` is not carried over. It is `read-mcp-server`'s convention for
tracking its own work; applying it to a repository with no sprints yet would be
ceremony. Add it later if the need appears.
