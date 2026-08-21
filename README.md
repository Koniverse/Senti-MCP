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
| `get_authoring_conventions` | none | Reads the Senti Quant MQL5 authoring contract as data: hard-safety constraints, trading-safety requirements, the static analyzer's forbidden-construct list, and the platform limits on draft count and source size. Call this before generating any MQL5 source — code that breaks these rules is rejected by a static scan before it reaches the compiler, and compile slots are globally serial, so discovering a rule by failing a compile is expensive and still fails. Limits are reported exactly — a ceiling that is not a whole multiple of 1024 stays in bytes rather than being rounded into a KiB figure the API does not honour. The response is small (~2 KB) and static per deploy; `forbiddenConstructs[].pattern` values are regular expressions reported verbatim, never evaluated. |
| `get_draft` | `draftId` (the `id` field from `list_drafts`) | Reads one MQL5 draft the API key owns: its full source code, its compiler log, its diagnostics, and whether the last compile still matches the current source. Answers "why did this fail to compile" or "show me the code". **The response can be large** — a draft may hold up to 192 KiB of source plus 16 KiB of compiler log, and this server returns that content twice, once as text and once as structured data — roughly **105,000 tokens** worst case. Attachment source is NOT included; attachments are listed with their size, and `list_draft_attachments` returns their code — `notes` points there only when an attachment actually carried source to lose. |
| `list_drafts` | none | Lists the MQL5 drafts this API key owns, most recently updated first, with each draft's compile status, size, attachment count and registered-EA id. Use it to find a `draftId`, or to answer "what am I working on" and "which of my drafts are broken". **This response is shaped.** `GET /api/v1/drafts` is the largest payload the API can produce — up to 10.3 MiB across 20 drafts — so source code, compiler logs and diagnostics are ALL dropped; what was cut is listed in `notes`, and the note only ever names a category that actually lost something — with a byte figure only where bytes were measured. Measured live on 2026-08-20: 19,853 B → 1,898 B, 90.4% removed; worst case at `maxDrafts` with 5 attachments per draft is roughly **5,000–7,000 tokens**, counting both response channels. Call `get_draft` for one draft's source and compiler output, or `list_draft_attachments` for its indicator sources. There is no option to request the unshaped response. |
| `list_draft_attachments` | `draftId` (the `id` field from `list_drafts`), plus optional `filename` | Reads the indicator source files a draft's EA embeds via `#resource` — the source `get_draft` deliberately leaves out. Pass `filename` to read at most one attachment whole, by exact name; that is also how to read one a default call had to leave out — if more than one attachment shares that filename, only the first is returned and `notes` says how many were skipped. A filtered read says so in its text and names the draft's real attachment count, so `content` alone is never read as the whole set. **This response is budgeted, not truncated.** With `filename` omitted, attachments are returned whole while the running total stays within a 64 KiB budget — the first attachment is always returned whole regardless of size, and once one is cut every later one is cut too, and `notes` says exactly that rather than claiming each cut file exceeded the budget; a cut attachment keeps its metadata and reports `sourceCode: null`, never a partial source. `notes` says whether a cut happened. Worst case, counting both response channels, is roughly **33,000 tokens**. |
| `create_draft` | `name` (1–120 chars, unique per user), `sourceCode` (the complete EA) | **Write tool — registered only when `SENTI_ENABLE_AUTHORING_WRITE` is set** (see [Enabling the write path](#enabling-the-write-path)). Creates a new MQL5 draft from source you have written, and returns its `id`. Call `get_authoring_conventions` first: code that breaks the platform rules is rejected by a static scan before it reaches the compiler, and this tool does not check them for you. **The response does not echo your source back** — you just sent it — so it returns the new id, the byte count written and the compile state, and `notes` points at `get_draft` for a read-back. Nothing is compiled until you call `compile_draft`. A `409` means the name is taken; a `403` means either the key lacks `authoring:write` or your draft cap is full, and the message says both because the API does not distinguish them. |
| `update_draft` | `draftId`, `name`, `sourceCode` | **Write tool, behind the opt-in.** Replaces an existing draft. **THIS IS A FULL REPLACE, NOT A PATCH** — both fields are always written, so send the complete draft every time; sending only what you changed deletes the rest of the file, because the API has no partial-update verb. Call `get_draft` first if you do not have the current source. Annotated `destructiveHint` for exactly that reason, despite the name. Reports the bytes written, not a before/after delta — the `PUT` response carries only the new draft, and this server does not make a hidden second request to invent the missing figure. Compiles nothing; if a previous compile no longer matches, the text says so and points at `compile_draft`. |
| `delete_draft` | `draftId` | **Write tool, behind the opt-in — and it asks first.** Deletes one draft and every indicator attached to it. **Cannot be undone**, and no tool here restores one, so it pauses for an explicit human confirmation before anything is sent; declining returns a success saying nothing was deleted, not an error. An EA already registered from the draft is unaffected — a separate resource. Use it to free a slot when `create_draft` reports the draft cap is full. **Needs a host that supports MCP elicitation**; on one that does not, this tool cannot be used, and that is deliberate rather than degraded to a silent delete. |
| `add_draft_attachment` | `draftId`, `filename` (a bare `.mq5` basename), `sourceCode` | **Write tool, behind the opt-in.** Attaches one MQL5 indicator source to a draft so the EA can embed it. Filenames are unique within a draft **case-insensitively** — `MyInd.mq5` collides with `myind.mq5`, because the compile host writes them into one flat Windows directory. **Attaching does not wire it up**: the text names the exact `#resource "<stem>.ex5"` and `iCustom(…)` lines the EA still needs, which means an `update_draft` afterwards, or the file is compiled and never used. The response does not echo your source back. |
| `update_draft_attachment` | `draftId`, `attachmentId`, `sourceCode` | **Write tool, behind the opt-in.** Replaces one indicator's source. **The filename cannot be changed and this tool takes no filename** — an EA embeds an indicator by name, so a rename would orphan every reference; to rename, delete, re-add and update the EA source. A full replace of that file's contents, so send the complete indicator. A `404` here may also mean the attachment belongs to a different draft. |
| `delete_draft_attachment` | `draftId`, `attachmentId` | **Write tool, behind the opt-in — and it asks first.** Removes one indicator from a draft. **Cannot be undone.** Afterwards the EA still references it: remove its `#resource` and `iCustom` lines with `update_draft`, or the next `compile_draft` fails on a file that is no longer there — the text says so. Also how to free a slot when the attachment cap is full, and the only way to rename a file. **Needs a host that supports MCP elicitation.** |

The `id` a tool returns is the `accountId` other Senti endpoints take. `login` is
the MT5 account number, not a key.

## Requirements

- Node.js ≥ 22.11.0 — the first LTS release of the Node 22 "Jod" line, supported
  until 2027-04-30. The floor is a **support-lifetime** choice, not an API one:
  the newest runtime feature this server actually uses is `AbortSignal.any()`
  (Node 20.3.0), on the path of every tool call, and `npm run test:smoke` uses
  `node --env-file` (20.6.0). Raised from the old 20.6.0 floor in v2.0.0 because
  Node 20 reached end of life on 2026-04-30 ([CONTEXT D27](docs/CONTEXT.md))
- A Senti Quant API key (`sq_live_…`). As of v2.1.0 the tool surface needs six
  read scopes: `accounts:read`, `brokers:read`, `strategies:read`,
  `performance:read`, `trading:read`, `authoring:read` — create one with all
  six at the [API Keys dashboard](https://stage.sentitrade.xyz/account/api-keys).
  There is no key-introspection endpoint, so a missing scope isn't caught at
  startup: it surfaces as a `403` naming the scope the first time the affected
  tool is called, and every other tool keeps working. All six are exercised by
  a shipped tool: `accounts:read` (`list_accounts`), `brokers:read`
  (`list_brokers`), `strategies:read` (`list_strategies`,
  `list_account_strategies`), `trading:read` (`list_positions`,
  `list_pending_orders`, `list_deals`), `performance:read`
  (`get_account_performance`, `get_performance_breakdowns`, `get_equity_timeseries`)
  and `authoring:read` (`get_authoring_conventions`, `get_draft`, `list_drafts`,
  `list_draft_attachments`).
- **A seventh scope, `authoring:write`, only if you turn the write tools on.**
  As of v2.5.0 `SENTI_ENABLE_AUTHORING_WRITE` registers tools that create and
  change MQL5 drafts, and those need it. A key without it runs the entire read
  surface unaffected, and a key *with* it changes nothing while the flag is
  unset — no write tool is registered, so none can be called.

## Configuration

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `SENTI_API_KEY` | ✅ | — | First-party key. The server exits at startup without it. |
| `SENTI_API_BASE_URL` | | `https://api.sentitrade.xyz` | Set to `https://be-dev.sentitrade.xyz` for development. |
| `SENTI_ENABLE_AUTHORING_WRITE` | | unset (off) | `1` or `true` registers the authoring write tools. See below. |

### Enabling the write path

**Every tool is read-only unless you opt in.** Set `SENTI_ENABLE_AUTHORING_WRITE=1`
in the server's `env` block and the authoring write tools are registered; leave it
unset — or set it to `0`, `false`, `no` or `off` — and they are not. A host that
never sets it never sees one in `tools/list`, so there is nothing for a model to
call by accident.

Turning it on gives an agent the ability to **create, replace and delete MQL5
drafts and their indicator files, and to compile them**. The key must also hold
`authoring:write`.

**The two delete tools pause for a human.** `delete_draft` and
`delete_draft_attachment` ask for an explicit confirmation through MCP elicitation
before anything is sent, because they are the only operations here that no other
tool can undo. The other five do not ask: `update_draft` fires on every save in an
edit loop, and a prompt seen fifty times a session gets rubber-stamped, which is
worse than no prompt. On a host that does not support elicitation the two delete
tools cannot be used — deliberately, rather than degraded to a silent delete.

**It does not enable any trading write.** Closing a position, cancelling an order
and deploying a strategy to an account are a different surface, gated by a
different scope (`strategies:write`, `trading:write`) and by a flag that does not
exist yet — see [EPIC-3](docs/sprints/epics/EPIC-3.md). No setting of
`SENTI_ENABLE_AUTHORING_WRITE` reaches them. Registering an authored EA as a
private strategy is also **not** available: that is `POST …/register`, deliberately
left out of [EPIC-8](docs/sprints/epics/EPIC-8.md) because no operation in the
authoring surface can delete what it creates.

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

Restart the client; all fourteen tools should appear — every `GET` operation the Senti
Quant Public API exposes now has one, the last four added over the `Authoring` tag
[EPIC-7](docs/sprints/epics/EPIC-7.md) shipped.
`npx -y senti-mcp-server` resolves to whatever npm's `latest` tag points at — `2.7.0` as
of this release.
It carries `2.4.0`'s fourteen read tools plus six write tools — `create_draft`,
`update_draft`, `delete_draft`, `add_draft_attachment`, `update_draft_attachment` and
`delete_draft_attachment` — which are registered **only** when
`SENTI_ENABLE_AUTHORING_WRITE` is set, so an installation that does not set it sees the same
fourteen tools `2.4.0` did.
`2.4.0` carries the ten tools of `1.4.0` plus `get_authoring_conventions`, `get_draft`,
`list_drafts` and `list_draft_attachments`, fourteen in total, and no write tool at any
setting. `2.3.0` carries those same
ten tools plus `get_authoring_conventions`, `get_draft` and `list_drafts`, thirteen in
total. `2.2.0` carries those same ten tools plus `get_authoring_conventions` and
`get_draft`, twelve in total. `2.1.0` carries those same ten tools plus
`get_authoring_conventions` only, eleven in total. `2.0.1` and `2.0.0`
carry the same ten tools as `1.4.0` and differ from it only in
requiring Node ≥ 22.11.0; the `2.0.1` patch on top of `2.0.0` carries only
build-toolchain and documentation changes.
`1.4.0` is the last version declaring the old 20.6.0 floor and is the one to
pin if you are stuck on Node 20; it carries ten tools. `1.3.0` carries nine,
without `get_equity_timeseries`; `1.2.0` carries eight, without
`get_performance_breakdowns` as well; `1.1.0` carries seven, without `list_deals`
on top of that; `1.0.1` carries six, without `get_account_performance` too;
and only `list_accounts` is reachable on `0.1.0`, which was published before the
others existed, so check `npm view senti-mcp-server dist-tags` if a tool you
expect is missing.

Pin the version in `args` if you want to hold one —
`["-y", "senti-mcp-server@2.7.0"]`. To put it on your `PATH` instead:

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
