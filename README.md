# senti-mcp-server

A [Model Context Protocol](https://modelcontextprotocol.io) server that lets an AI
assistant (Claude Code, Claude Desktop, Cursor, …) read trading data from the
**Senti Quant Public API**.

## Tools

| Tool | Input | What it does |
|------|-------|--------------|
| `list_accounts` | none | Lists the MT5 accounts linked to the configured API key: id, login, broker, last known balance and equity, sync state, running strategies. |
| `list_brokers` | none | Lists the platform-wide catalog of brokers Senti Quant supports — not the accounts this API key already has — with each broker's MT5 server names and account types. |
| `list_strategies` | none | Lists the platform-wide catalog of strategies (expert advisors) available to deploy — not the strategies currently running on any account — with each strategy's supported symbols, timeframes, rating and presets. |
| `list_account_strategies` | `accountId` (the `id` from `list_accounts`, not `login`) | Lists the strategies currently deployed on one MT5 account, with each deployment's symbol, timeframe and status. |
| `list_positions` | `accountId` (the `id` from `list_accounts`, not `login`) | Lists the positions currently open on one MT5 account, read live from the terminal: symbol, direction, volume, open/current price, stop loss, take profit, swap and floating profit. A `409` means the account's terminal is offline — not that the account holds no positions. |
| `list_pending_orders` | `accountId` (the `id` from `list_accounts`, not `login`) | Lists the pending limit and stop orders resting on one MT5 account, read live from the terminal: symbol, order type, volume, trigger price, stop loss, take profit and stop-limit price. These are orders that have NOT been filled — for open positions, use `list_positions`. A `409` means the account's terminal is offline — not that the account has no pending orders. |
| `get_account_performance` | `accountId`, plus optional `from`, `to` (`YYYY-MM-DD`, UTC) and `reporting` (an ISO-4217 currency code, default `USD`) | Summarizes how one MT5 account performed over a date window: net P&L, win rate, profit factor, gross profit and loss, deal counts, costs, cash flow, period ROI and IRR, lifetime IRR, and the live terminal state. Omit `from`/`to` for the last 30 days. Unlike the two tools above there is no `409` — an unreachable terminal arrives as a null `live` block inside a success, and is reported as unreachable rather than as zeroes. |

The `id` a tool returns is the `accountId` other Senti endpoints take. `login` is
the MT5 account number, not a key.

## Requirements

- Node.js ≥ 20.6.0 — `AbortSignal.any()`, which every tool call goes through,
  landed in 20.3.0, and `npm run test:smoke` uses `node --env-file`, added in
  20.6.0
- A Senti Quant API key (`sq_live_…`). As of v0.2.0 the tool surface needs five
  read scopes: `accounts:read`, `brokers:read`, `strategies:read`,
  `performance:read`, `trading:read` — create one with all five at the
  [API Keys dashboard](https://stage.sentitrade.xyz/account/api-keys). There is
  no key-introspection endpoint, so a missing scope isn't caught at startup: it
  surfaces as a `403` naming the scope the first time the affected tool is
  called, and every other tool keeps working. As of v1.1.0 all five are
  exercised by a shipped tool: `accounts:read` (`list_accounts`), `brokers:read`
  (`list_brokers`), `strategies:read` (`list_strategies`,
  `list_account_strategies`), `trading:read` (`list_positions`,
  `list_pending_orders`) and `performance:read` (`get_account_performance`).

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

Restart the client; all seven tools should appear. `npx -y senti-mcp-server`
resolves to whatever npm's `latest` tag points at — `1.1.0` as of this release,
the first published version carrying all seven. `1.0.1` carries the six read
tools without `get_account_performance`, and only `list_accounts` is reachable
on `0.1.0`, which was published before the others existed, so check
`npm view senti-mcp-server dist-tags` if a tool you expect is missing.

Pin the version in `args` if you want to hold one —
`["-y", "senti-mcp-server@1.1.0"]`. To put it on your `PATH` instead:

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
gitignored. If `.env.local` exists but doesn't set `SENTI_SMOKE_KEY`, the smoke
test skips cleanly. If `.env.local` doesn't exist at all, `node --env-file` fails
to start (`node: .env.local: not found`, exit 9) rather than skipping — create
the file, even empty, to get the skip instead of the failure.

## License

MIT
