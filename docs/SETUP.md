# SETUP.md — senti-mcp-server local development

Clone to a running `list_accounts` tool. This is the local development path —
building from a checkout and wiring an MCP client at `dist/index.js`'s absolute
path, distinct from the published-package path (`npx senti-mcp-server`) that
[README.md](../README.md) covers. There is no `DEPLOY.md`; see
[docs/README.md](README.md)'s absent-file table for why — it is not because
nothing was ever published.

---

## 1. Prerequisites

| Requirement | Why |
|---|---|
| **Node.js ≥ 22.11.0** | The first LTS release of the Node 22 "Jod" line, supported until 2027-04-30. This is a **support-lifetime** floor, not an API one ([CONTEXT D27](CONTEXT.md)): the newest API in use is still `AbortSignal.any()` (20.3.0), on the path of every tool call, and `npm run test:smoke` uses `node --env-file` (20.6.0). So the code runs on 20.6.0–22.10.x and npm only warns `EBADENGINE` there — but that range receives no security patches and CI does not test it. Below 20.3.0 it genuinely breaks: the server starts, `tools/list` succeeds, then every `list_accounts` call fails with `TypeError: AbortSignal.any is not a function`. |
| **A Senti Quant API key** | `sq_live_…`. As of v2.1.0 the tool surface needs six read scopes — see §3. Created in the [API Keys dashboard](https://stage.sentitrade.xyz/account/api-keys). |

```bash
node --version    # must be >= 22.11.0
```

## 2. Install

```bash
git clone https://github.com/Koniverse/Senti-MCP.git senti-mcp-server
cd senti-mcp-server
npm install
```

`npm install` also restores the vendored `koni-docs` skill at
`.claude/skills/koni-docs`; no other setup step is needed.

## 3. Environment

```bash
cp .env.example .env.local
```

`.env.local` is gitignored and is the only place a real key belongs. Fill in:

```bash
# Senti Quant API key (added in v0.1.0) — REQUIRED.
# The first-party key is itself the bearer token; the server exits at startup
# without it. As of v2.1.0 the tool surface needs six read scopes:
# accounts:read, brokers:read, strategies:read, performance:read, trading:read,
# authoring:read. Create one with all six at
# https://stage.sentitrade.xyz/account/api-keys
SENTI_API_KEY=sq_live_…

# Senti API root (added in v0.1.0) — optional.
# Defaults to production, https://api.sentitrade.xyz.
SENTI_API_BASE_URL=https://be-dev.sentitrade.xyz

# Smoke-test key (added in v0.1.0) — optional, test-only.
# Read by `npm run test:smoke`. Left unset (but this file present), that suite
# skips cleanly. If .env.local doesn't exist at all, `node --env-file` fails to
# start (`node: .env.local: not found`, exit 9) instead of skipping.
SENTI_SMOKE_KEY=sq_live_…
```

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `SENTI_API_KEY` | yes | — | First-party key, `sq_live_…`. The server exits 1 at startup without it. |
| `SENTI_API_BASE_URL` | no | `https://api.sentitrade.xyz` | API root. Set to `https://be-dev.sentitrade.xyz` for development. |
| `SENTI_SMOKE_KEY` | no | — | Test-only, read from `.env.local` by `npm run test:smoke`. |

> ### Six scopes, not one
>
> As of v2.1.0 the tool surface needs `accounts:read`, `brokers:read`,
> `strategies:read`, `performance:read`, `trading:read`, and `authoring:read`.
> Create the key with all six at once — scopes are fixed at creation, so a key
> created with fewer means going back to the dashboard later.
>
> **There is no key-introspection endpoint**, so a missing scope cannot be detected at
> startup. It surfaces as a `403` naming the missing scope the first time a tool that
> needs it is called; every other tool keeps working normally.
>
> As of v1.0.0, `accounts:read` (`list_accounts`), `brokers:read` (`list_brokers`),
> `strategies:read` (`list_strategies`, `list_account_strategies`) and `trading:read`
> (`list_positions`, `list_pending_orders`) are exercised by a shipped tool.
> `performance:read` is not yet — it arrives with the remaining read operations, which
> are [sprint-2026-W33](sprints/sprint-2026-W33.md)'s Phase 3. `authoring:read`
> (`get_authoring_conventions`) is exercised as of v2.1.0 — see
> [EPIC-7](sprints/epics/EPIC-7.md). Creating the key with all six now still saves a
> trip back to the dashboard once further authoring tools land.

> ### The key and the base URL must match environments
>
> Keys are environment-bound. The default base URL is **production**
> (`https://api.sentitrade.xyz`), while keys are currently issued from the
> **staging** dashboard at `stage.sentitrade.xyz`. A key created in one
> environment returns `401` against another no matter how valid it is.
>
> So when a key that looks correct is rejected, check `SENTI_API_BASE_URL`
> before regenerating the key — the 401 is far more often a mismatched
> environment than a bad key.
>
> **Verified pairing:** a key issued from the staging dashboard
> (`https://stage.sentitrade.xyz/account/api-keys`) works against
> `https://be-dev.sentitrade.xyz` — the pairing this walkthrough's `.env.local`
> uses, and the one `npm run test:smoke` has exercised twice, passing both
> times. Which base URL a production-issued key needs is not established;
> that pairing is unconfirmed.

`SENTI_API_BASE_URL` is validated at startup: it must be an absolute `https:` URL
(`http:` is accepted for a local API, at the cost of sending the key in cleartext).
A trailing slash is stripped. A query string or fragment is rejected, because it
cannot survive being joined to an endpoint path — `https://host?x=1` would become
`https://host/?x=1/api/v1/accounts`.

**Adding a variable later?** RULE-11 puts it in `.env.example` *and* this file in the
same commit.

## 4. Build and verify

```bash
npm run build       # tsc → dist/, then chmod +x dist/index.js
npm test            # unit tests, stubbed fetch; the smoke suite skips
npm run typecheck   # both tsconfig.json and tsconfig.test.json
```

One real authenticated call, once `SENTI_SMOKE_KEY` is set:

```bash
npm run test:smoke
```

A `403` here means the key lacks `accounts:read` — the error message names the
scope. A `401` means the key does not match the environment; see §3.

## 5. Run it

From source, without building:

```bash
SENTI_API_KEY=sq_live_… npm run dev
```

The server speaks JSON-RPC over **stdout** and prints diagnostics to **stderr**, so
a readiness line on stderr and silence on stdout is correct behaviour.

## 6. Wire it into an MCP client

`dist/index.js` needs an absolute path:

```json
{
  "mcpServers": {
    "senti": {
      "command": "node",
      "args": ["/absolute/path/to/senti-mcp-server/dist/index.js"],
      "env": {
        "SENTI_API_KEY": "sq_live_..."
      }
    }
  }
}
```

Restart the client; `list_accounts` should appear in its tool list.

## 7. Troubleshooting

| Symptom | Cause |
|---|---|
| `SENTI_API_KEY is required…`, exit 1 | No key in the environment. The MCP client's `env` block is separate from your shell. |
| `Senti API rejected the credentials (401)` | Key does not match the environment `SENTI_API_BASE_URL` targets (see §3), or it was revoked. |
| `Senti API returned 403 … missing the \`<scope>\` scope` | The key is valid but lacks that scope — `accounts:read`, `brokers:read`, `strategies:read`, `performance:read`, `trading:read`, or `authoring:read`, depending on which tool was called. There is no key-introspection endpoint, so this is caught only when the tool runs, not at startup. Create a new key with all six scopes; scopes are fixed at creation. |
| `TypeError: AbortSignal.any is not a function` | Node older than 20.3.0 — well below the ≥ 22.11.0 floor. See §1. |
| Client shows no tools / fails to connect | Something wrote to stdout and corrupted the JSON-RPC stream. Diagnostics must go to stderr only. |
| `SENTI_API_BASE_URL must not carry a query string or fragment` | Exactly that — a query or fragment cannot survive being joined to an endpoint path. |
| `SENTI_API_BASE_URL must use https: or http:` | A scheme this client cannot fetch (`file:`, `foo:bar`, …), almost always a typo. |

## Cross-references

- [README.md](../README.md) — tool table, configuration, security posture
- [docs/README.md](README.md) — doc hub and pre-commit checklist
- [CONTEXT.md](CONTEXT.md) — decision log (D5 Node floor, D6 base-URL validation, D8–D10 the read-tool substrate)
- [v1 design spec](superpowers/specs/2026-08-05-senti-mcp-server-design.md)
