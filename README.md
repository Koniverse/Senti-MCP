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
| `list_deals` | `accountId`, plus optional `limit` (1–500, default `50`), `cursor`, `entry` (`in` or `out`), `from` and `to` (ISO-8601) | Lists one page of an MT5 account's closed deal history — the fills that already happened: symbol, direction, entry kind, volume, price, realized profit, costs, the linked position and order. **Paginated, and it never pages on its own:** one call is exactly one request, and when more deals exist the answer reports a `cursor` you must pass back to read the next page. For totals over a period use `get_account_performance` rather than adding these rows up. |
| `get_account_performance` | `accountId`, plus optional `from`, `to` (`YYYY-MM-DD`, UTC) and `reporting` (an ISO-4217 currency code, default `USD`) | Summarizes how one MT5 account performed over a date window: net P&L, win rate, profit factor, gross profit and loss, deal counts, costs, cash flow, period ROI and IRR, lifetime IRR, and the live terminal state. Omit `from`/`to` for the last 30 days. Unlike `list_positions` and `list_pending_orders` there is no `409` — an unreachable terminal arrives as a null `live` block inside a success, and is reported as unreachable rather than as zeroes. |
| `get_performance_breakdowns` | `accountId`, plus the same optional `from`, `to` and `reporting` as `get_account_performance` | Breaks one MT5 account down three ways over a date window: a day-by-day P&L, volume and notional series; a per-symbol P&L and deal-count series; and P&L by hour of the day. Answers "which symbol is losing me money" and "what hour do I trade worst". **This response is shaped.** The endpoint is the largest the API serves — 87 KB for a 63-day window on a single-symbol account — so per-account rows and running totals are dropped, at most **10 symbols** are kept (those with the largest absolute net P&L), and the hourly grid is totalled across the window. Whatever that costs is listed in `notes` and repeated in the text; `notes` is empty when nothing was cut. For a single whole-account figure use `get_account_performance` — it is smaller and it is the default for a performance question. |

| `get_equity_timeseries` | `accountId`, plus the same optional `from`, `to` and `reporting` as `get_account_performance` | Returns the reconstructed equity curve and floating drawdown for one MT5 account over a date window, as a series of points — answers "how has my equity moved" and "what was my worst drawdown". **This response is shaped.** A wide window returns a point per interval and grows without bound, so the series is downsampled to at most **200 points** — but the **first point, the last point and the point of deepest drawdown are always retained**, so the start, the end and the worst of the curve are exact rather than sampled near. Measured live on 2026-08-12: 499 points over 63 days → 200. Every downsample is recorded in `notes`, which is empty when the series was short enough to return whole; narrow `from`/`to` for finer resolution. `caveats` and `portfolioCaveats` — the API's own statements about figures it could not fully reconstruct — are always returned in full, never shortened. |
The `id` a tool returns is the `accountId` other Senti endpoints take. `login` is
the MT5 account number, not a key.

## Requirements

- Node.js ≥ 22.11.0 — the first LTS release of the Node 22 "Jod" line, supported
  until 2027-04-30. The floor is a **support-lifetime** choice, not an API one:
  the newest runtime feature this server actually uses is `AbortSignal.any()`
  (Node 20.3.0), on the path of every tool call, and `npm run test:smoke` uses
  `node --env-file` (20.6.0). Raised from the old 20.6.0 floor in v2.0.0 because
  Node 20 reached end of life on 2026-04-30 ([CONTEXT D27](docs/CONTEXT.md))
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
  `list_pending_orders`, `list_deals`) and `performance:read`
  (`get_account_performance`, `get_performance_breakdowns`, `get_equity_timeseries`).

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

Restart the client; all ten tools should appear — every `GET` operation the
Senti Quant Public API exposes now has one. `npx -y senti-mcp-server` resolves to
whatever npm's `latest` tag points at — `2.0.0` as of this release, which carries
the same ten tools as `1.4.0` and differs from it only in requiring Node ≥ 22.11.0.
`1.4.0` is the last version declaring the old 20.6.0 floor and is the one to
pin if you are stuck on Node 20; it carries all ten tools. `1.3.0` carries nine,
without `get_equity_timeseries`; `1.2.0` carries eight, without
`get_performance_breakdowns` as well; `1.1.0` carries seven, without `list_deals`
on top of that; `1.0.1` carries six, without `get_account_performance` too;
and only `list_accounts` is reachable on `0.1.0`, which was published before the
others existed, so check `npm view senti-mcp-server dist-tags` if a tool you
expect is missing.

Pin the version in `args` if you want to hold one —
`["-y", "senti-mcp-server@2.0.0"]`. To put it on your `PATH` instead:

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
