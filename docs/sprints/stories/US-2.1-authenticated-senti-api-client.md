---
id: US-2.1
title: "Authenticated Senti API client substrate"
epic: EPIC-2
status: done
version_shipped: 0.1.0
priority: P1
points: 5
sprint: sprint-2026-W32
assignee: bluezdot
commit: 62e399f
created: 2026-08-05
updated: 2026-08-05
---

## Goal

Give every future Senti tool one place that already knows how to reach the API: the key
is attached, the timeout is set, cancellation propagates, and a failure comes back as a
sentence someone can act on rather than a status code they will misread. Every story
after this one gets to stop worrying about HTTP entirely.

## Background

The Senti Quant Public API exposes 17 operations behind a single auth mechanism. Its
OpenAPI document declares exactly one security scheme, `ApiKeyBearer` — the first-party
key (`sq_live_…`) *is* the bearer token, so there is no separate API-key header to
support. Failures share one envelope, `{ error: { code, message } }`, with `code` drawn
from a fixed set.

Everything in this story is the part of the design with genuine risk: base-URL joining,
the `Authorization` header, timeouts, reading the error envelope, and mapping statuses to
messages. Isolating it means the domain modules and the MCP layer can be tested by calling
functions directly, and it means the next 16 tools inherit the behaviour instead of
re-deriving it.

Two mapping decisions carry most of the value. **403 always means the key lacks a scope**
on this API — never that the account is off limits — so the message says exactly that and
names the scope the caller asked for. Read plainly, "Forbidden" sends people to
investigate the wrong thing. And **`fetch` rejects with a bare "fetch failed"**, burying
the real reason (connect timeout, DNS failure, TLS error) in `cause`; flattening the chain
is what makes a network failure diagnosable at all.

Neither `client.ts` nor the modules above it import the MCP SDK. Only `server.ts`, in
[US-2.2](US-2.2-list-accounts-tool.md), knows the protocol exists.

## Acceptance criteria

- [x] **AC-1** — **Given** `SENTI_API_KEY` is absent or blank, **When** `loadConfig` runs,
  **Then** it throws a message naming the variable **And** pointing at the API Keys
  dashboard, so the reader knows how to fix it rather than only what broke.
- [x] **AC-2** — `loadConfig` defaults `baseUrl` to `https://api.sentitrade.xyz`, honours
  `SENTI_API_BASE_URL`, strips trailing slashes, and rejects a non-absolute value with a
  message quoting the offending input. The returned `Config` is frozen.
- [x] **AC-3** — `ApiError` carries `status` and the envelope's `code`, is an `instanceof
  Error`, and reports `name === 'ApiError'`, so callers can branch on status without
  re-parsing a message string.
- [x] **AC-4** — **Given** an error whose real reason sits in `cause`, **When**
  `describeError` renders it, **Then** the output joins the chain (`fetch failed: Connect
  Timeout Error …`), reads a `code` off a non-`Error` cause, does not repeat an identical
  message twice, and terminates on a self-referencing chain.
- [x] **AC-5** — **Given** any request, **When** it is sent, **Then** the headers include
  `Authorization: Bearer <key>`, `Accept: application/json`, and a `User-Agent` of
  `senti-mcp-server/<version>`, **And** the URL is the configured base joined to the path.
- [x] **AC-6** — A 200 response returns its parsed JSON body as `unknown`. Validation is
  not the client's job.
- [x] **AC-7** — **Given** a 401, **When** the client maps it, **Then** the message names
  `SENTI_API_KEY` and the `sq_live_…` key shape.
- [x] **AC-8** — **Given** a 403 and a caller-supplied `scope`, **When** the client maps
  it, **Then** the message names that scope **And** states that the account is not off
  limits — the misreading this mapping exists to prevent.
- [x] **AC-9** — **Given** a 429 carrying `X-RateLimit-Limit` / `X-RateLimit-Remaining`,
  **When** the client maps it, **Then** the message quotes both values.
- [x] **AC-10** — Other statuses pass the envelope's `message` through alongside the HTTP
  status.
- [x] **AC-11** — **Given** a response body that is not JSON — a proxy error page on a
  502, or a 200 with a malformed body — **When** the client reads it, **Then** the real
  status survives in the error rather than being masked by a JSON parse failure.
- [x] **AC-12** — **Given** a caller `AbortSignal`, **When** a request is made, **Then**
  `fetch` receives a signal combining it with the 15s timeout, so whichever fires first
  wins.
- [x] **AC-13** — **The API key appears in no error branch's output.** Asserted across
  401, 403, 429, 500 and 502.
- [x] **AC-14** — `npm test` passes with 27 tests across `config.test.ts` (7),
  `errors.test.ts` (9), and `client.test.ts` (11); `npm run typecheck` exits 0.
- [x] **AC-15** — No file in this story imports from `@modelcontextprotocol/*`.

## Tasks

- [x] **TASK-2.1.1** — Extend `package.json`, add `tsconfig.json`, install (AC: 14)
  - [x] Add `bin`, `files`, build/test/typecheck scripts, `keywords`, runtime deps
        (`@modelcontextprotocol/server`, `zod`) and remaining devDeps to the **existing**
        `package.json` — do not recreate it, it already carries the koni-docs devDependency
  - [x] `tsconfig.json`: NodeNext, strict, `noUncheckedIndexedAccess`, `outDir: dist`
- [x] **TASK-2.1.2** — `src/config.ts` + `src/config.test.ts` (AC: 1, 2)
- [x] **TASK-2.1.3** — `src/errors.ts` + `src/errors.test.ts` (AC: 3, 4)
- [x] **TASK-2.1.4** — `src/client.ts` + `src/client.test.ts` (AC: 5–13)
  - [x] `createClient(config, deps)` returning `{ get(path, options) }`
  - [x] Read the body as text, then parse defensively — never `response.json()` first
  - [x] `AbortSignal.any([callerSignal, timeout])`
- [x] **TASK-2.1.5** — Verify (AC: 14, 15)
  - [x] `npm test`, `npm run typecheck`
  - [x] Confirm no MCP import: `grep -rn '@modelcontextprotocol' src/config.ts src/errors.ts src/client.ts`

## Dev notes

### Architecture constraints

- **The API key is an environment variable, never a tool parameter.** A tool parameter
  lives in the model's context and from there reaches transcripts and logs. This is an
  [EPIC-2](../epics/EPIC-2.md) cross-cutting invariant, enforced here by AC-13.
- **No separate `http.ts`.** In `read-mcp-server` that file exists because two callers
  share one fetch policy. Here `client.ts` is the only caller, so the policy lives there.
  Splitting it would imitate the other repo's shape without addressing anything.
- **`get` returns `unknown`.** Validation belongs to the domain module in
  [US-2.2](US-2.2-list-accounts-tool.md). A client that parses is a client that has to
  change every time a schema does.
- **`scope` is a caller-supplied option**, not something the client infers. Scopes are a
  property of the endpoint; only the caller knows which one it is asking for.
- `SENTI_TIMEOUT_MS` and `SENTI_USER_AGENT` are deliberately absent. For an authenticated
  first-party API neither knob addresses a problem that exists.

### Cross-story dependencies

- **Builds on** [US-1.1](US-1.1-adopt-koni-docs-framework.md) — extends the `package.json`
  that story created. Recreating it would drop the koni-docs devDependency.
- **Required by** [US-2.2](US-2.2-list-accounts-tool.md) — consumes `createClient`,
  `Config`, and `describeError`.
- **Required by** [US-2.3](US-2.3-live-smoke-test-and-readme.md) — the smoke test calls
  `createClient` directly against the live API.

### What we explicitly did NOT do

- **No retry or backoff** — out of scope for v1. Trigger to revisit: an observed transient
  failure rate that a single attempt cannot absorb.
- **No response caching** — out of scope for v1. Balances change; a stale balance is worse
  than a slow one.
- **No descriptor table or OpenAPI codegen** — rejected in the design spec. The API
  declares no `operationId` anywhere, and the LLM-facing descriptions that decide whether
  a tool is called correctly cannot be generated regardless.

### References

- [Source: design spec §The client](../../superpowers/specs/2026-08-05-senti-mcp-server-design.md) — error-mapping table and rationale
- [Source: design spec §Authentication](../../superpowers/specs/2026-08-05-senti-mcp-server-design.md) — why the key is never a tool parameter
- [Source: v1 implementation plan, Tasks 1–3](../../superpowers/plans/2026-08-05-senti-mcp-server-v1.md) — the code this story transcribes and verifies
- [Source: EPIC-2 §Cross-cutting invariants](../epics/EPIC-2.md)
- [Senti Quant Public API](https://api.sentitrade.xyz/api/docs) — Scalar UI over the OpenAPI document

## Verification commands

| AC | Command |
|---|---|
| AC-1, AC-2 | `npm test -- src/config.test.ts` → 7 passing |
| AC-3, AC-4 | `npm test -- src/errors.test.ts` → 9 passing |
| AC-5–AC-13 | `npm test -- src/client.test.ts` → 11 passing |
| AC-14 | `npm test && npm run typecheck` |
| AC-15 | `grep -rn '@modelcontextprotocol' src/config.ts src/errors.ts src/client.ts` returns nothing |

## Changelog entry

### Added
- `src/config.ts` — `loadConfig(env)` producing a frozen `Config`; fails fast with
  actionable text when `SENTI_API_KEY` is absent.
- `src/errors.ts` — `ApiError` carrying HTTP status and envelope code; `describeError`
  flattening the `cause` chain.
- `src/client.ts` — `createClient(config, deps)` owning the `Authorization` header, a 15s
  timeout combined with the caller's `AbortSignal`, and status-to-message mapping.

## Implementation notes

Built exactly to the v1 plan's Tasks 1–3, with no deviation worth recording as a
decision. `loadConfig` rejects a blank or absent `SENTI_API_KEY` before anything else
runs, so a misconfigured host never gets far enough to make a network call. `client.ts`
reads the response body as text before attempting `JSON.parse`, which is what keeps a
502 from a proxy — HTML, not JSON — from being reported as a parse failure instead of
the real status.

The 403 mapping (AC-8) and the `cause`-chain flattening in `describeError` (AC-4) are
the two pieces of this story with genuine judgment calls, and both are exercised by
`client.test.ts` and `errors.test.ts` rather than left to manual inspection. AC-13 (the
key appears in no error branch) is asserted across 401/403/429/500/502, not just spot
checked.

`npm test` passes 27 tests across the three new files (`config.test.ts` 7,
`errors.test.ts` 9, `client.test.ts` 11); `npm run typecheck` is clean.
[US-2.3](US-2.3-live-smoke-test-and-readme.md) later exercises this client against the
live development API and confirms the contract holds outside the stubbed-fetch suite.

## Files modified

**Created:**
- `src/config.ts` (44 lines) — `loadConfig(env)`
- `src/config.test.ts` (47 lines)
- `src/errors.ts` (52 lines) — `ApiError`, `describeError`
- `src/errors.test.ts` (60 lines)
- `src/client.ts` (133 lines) — `createClient(config, deps)`
- `src/client.test.ts` (154 lines)

**Modified:**
- `package.json` — `bin`, `files`, build/test/typecheck scripts, `keywords`, runtime
  deps (`@modelcontextprotocol/server`, `zod`), remaining devDeps
- `tsconfig.json` — created: NodeNext, strict, `noUncheckedIndexedAccess`, `outDir: dist`

## Cross-references

- [Epic EPIC-2](../epics/EPIC-2.md)
- [sprint-2026-W32](../sprint-2026-W32.md)
- [CHANGELOG](../../CHANGELOG.md)
- [v1 design spec](../../superpowers/specs/2026-08-05-senti-mcp-server-design.md)
