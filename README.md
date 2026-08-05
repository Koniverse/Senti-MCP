# senti-mcp-server

A [Model Context Protocol](https://modelcontextprotocol.io) server that lets an AI
assistant (Claude Code, Claude Desktop, Cursor, …) read trading data from the
**Senti Quant Public API**.

## Tools

| Tool | Input | What it does |
|------|-------|--------------|
| `list_accounts` | none | Lists the MT5 accounts linked to the configured API key: id, login, broker, last known balance and equity, sync state, running strategies. |

The `id` a tool returns is the `accountId` other Senti endpoints take. `login` is
the MT5 account number, not a key.

## Requirements

- Node.js ≥ 20.6.0 — `AbortSignal.any()`, which every tool call goes through,
  landed in 20.3.0, and `npm run test:smoke` uses `node --env-file`, added in
  20.6.0
- A Senti Quant API key (`sq_live_…`) with the `accounts:read` scope, from the
  [API Keys dashboard](https://stage.sentitrade.xyz/account/api-keys)

## Configuration

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `SENTI_API_KEY` | ✅ | — | First-party key. The server exits at startup without it. |
| `SENTI_API_BASE_URL` | | `https://api.sentitrade.xyz` | Set to `https://be-dev.sentitrade.xyz` for development. |

> **The key and the base URL must belong to the same environment.** Keys are
> environment-bound, and the default base URL is **production**
> (`https://api.sentitrade.xyz`) while keys are currently issued from the
> staging dashboard. A key created in one environment returns `401` against
> another, however valid it is — so if a correct-looking key is rejected, check
> `SENTI_API_BASE_URL` before regenerating the key.
>
> **Verified pairing:** a key issued from the staging dashboard
> (`https://stage.sentitrade.xyz/account/api-keys`) works against
> `https://be-dev.sentitrade.xyz` — that is the pairing `npm run test:smoke`
> exercises, and it has passed against that pairing twice. Which base URL a
> production-issued key needs is not established; treat that pairing as
> unconfirmed until it is.

See [docs/SETUP.md](docs/SETUP.md) for a full local setup walkthrough.

## Use with an MCP client

No install step — `npx` fetches the published package on first run:

```json
{
  "mcpServers": {
    "senti": {
      "command": "npx",
      "args": ["-y", "senti-mcp-server"],
      "env": {
        "SENTI_API_KEY": "sq_live_..."
      }
    }
  }
}
```

Restart the client; the `list_accounts` tool should appear.

To pin a version, use `senti-mcp-server@0.1.0`. To put it on your `PATH`
instead:

```bash
npm install -g senti-mcp-server
```

Then the client block becomes `"command": "senti-mcp-server"` with no `args`.

### From a git checkout

Point the client at your own build — useful while developing:

```bash
npm install
npm run build
```

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

## Security

The API key is read from the environment and never appears in a tool's input
schema. A tool parameter would live in the model's context, and from there in
transcripts and logs; an environment variable does not. The test suite asserts
the key appears in no error message.

This server registers **read-only tools only**. The Senti API's write operations
— closing positions, cancelling orders, stopping strategies — are deliberately
not exposed. Adding any of them requires its own design: an opt-in switch,
`Idempotency-Key` support, and user confirmation before execution.

## Development

```bash
npm test           # unit tests (stubbed fetch)
npm run test:watch
npm run test:smoke # one live call against the dev API; needs .env.local
npm run typecheck
npm run dev        # run from source, e.g. SENTI_API_KEY=… npm run dev
```

`npm run test:smoke` reads `SENTI_SMOKE_KEY` from `.env.local`, which is
gitignored. Without that file the smoke test is skipped, not failed.

## License

MIT
