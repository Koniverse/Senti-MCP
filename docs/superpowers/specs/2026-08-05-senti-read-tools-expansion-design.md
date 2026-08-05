# senti-mcp-server — read-tool expansion design

**Date:** 2026-08-05
**Status:** approved, ready for implementation planning
**Supersedes nothing.** The [v1 design spec](2026-08-05-senti-mcp-server-design.md) stays
as written — it is a snapshot of intent, and this repo has twice chosen to amend rather
than edit one ([CONTEXT D1](../../CONTEXT.md), [D5](../../CONTEXT.md)). Where the two
disagree, this document is current for the read path.

## Problem

v0.1.0 ships one tool. `list_accounts` proves the pipe — config, auth, HTTP, error
mapping, Zod validation, formatting, stdio — but an agent that can only enumerate
accounts cannot answer a single question a trader actually asks. "How did I do this
month", "what am I holding", "is anything pending", "which EA is running" all need
endpoints that exist and are not exposed.

The goal is the full Senti Quant Public API surface, reached in two epics: this one
completes the read path, and EPIC-3 opens the write path behind its own guardrails.

## What the API actually exposes

Read from the live document at `https://api.sentitrade.xyz/api/v1/openapi.json` on
2026-08-05.

**17 operations = 10 `GET` + 7 `POST`.** This corrects a figure repeated in
[AGENTS.md](../../../AGENTS.md), [EPIC-2](../../sprints/epics/EPIC-2.md) and the v1
spec, all of which say "eight of the 17 operations are POST" and "the remaining 16 read
operations". The remaining read operations are **nine**, not sixteen. US-2.4 corrects
AGENTS.md and EPIC-2 in its own commit; the v1 spec is left alone.

### Read path — 10 operations

| Operation | Scope | Notes |
|---|---|---|
| `GET /api/v1/accounts` | `accounts:read` | shipped in v0.1.0 |
| `GET /api/v1/brokers` | `brokers:read` | platform-wide, **not** user-scoped |
| `GET /api/v1/strategies` | `strategies:read` | platform-wide EA catalog, **not** user-scoped |
| `GET /api/v1/accounts/{accountId}/strategies` | `strategies:read` | DEPLOYING/RUNNING instances on one account |
| `GET /api/v1/accounts/{accountId}/performance` | `performance:read` | `from`, `to`, `reporting` |
| `GET /api/v1/accounts/{accountId}/performance/breakdowns` | `performance:read` | `from`, `to`, `reporting`; largest payload in the API |
| `GET /api/v1/accounts/{accountId}/performance/timeseries` | `performance:read` | `from`, `to`, `reporting` |
| `GET /api/v1/accounts/{accountId}/positions` | `trading:read` | read through to the MT5 terminal |
| `GET /api/v1/accounts/{accountId}/orders` | `trading:read` | read through to the MT5 terminal |
| `GET /api/v1/accounts/{accountId}/deals` | `trading:read` | cursor pagination, `limit` ≤ 500 |

### Write path — 7 operations, out of scope here

`POST /accounts` (body carries an MT5 password), `POST …/strategies`,
`POST …/strategies/{activeEaId}/stop`, `POST …/positions/{ticket}/close`,
`POST …/positions/close-all`, `POST …/orders/{ticket}/cancel`,
`POST …/orders/cancel-all`.

Recorded here only because EPIC-3 needs the list, and because one detail must survive
into it: **a partial close is not retry-safe.** The API states that a retried
`positions/{ticket}/close` carrying `volume` closes that volume *again* from the
remaining position, and that the route consumes no `Idempotency-Key`. Any retry policy
built for the read path must not be inherited by that operation.

### Scopes

The key needs five read scopes, not one: `accounts:read`, `brokers:read`,
`strategies:read`, `performance:read`, `trading:read`. There is no key-introspection
endpoint, so scope is not checked at startup — a missing scope surfaces as a `403` at
call time, naming the scope, because `client.get()` already takes the required scope
from its call site.

## Scope of this design

**In:** the nine unshipped read operations, as nine tools; the substrate change that
makes ten tools maintainable; the payload policy that keeps them from flooding a
model's context.

**Out:** all seven write operations (EPIC-3); retry and backoff; response caching; npm
publishing. Each remains a decision rather than an omission.

## Decisions taken

Five forks were resolved during brainstorming. They are the reason the rest of this
document looks the way it does.

1. **Both epics, read first.** The destination is all 16 remaining operations, but
   EPIC-2 closes the read path before EPIC-3 opens the write path. Reads produce the
   `accountId` and `ticket` values writes consume, and the write guardrails deserve a
   design that is not competing for attention with nine ordinary read tools.
2. **One tool per endpoint.** Ten tools, ten `outputSchema`s. A `view` parameter
   collapsing the three performance endpoints would force an `anyOf` output schema,
   weakening validation exactly where a model is about to report money.
3. **Tools bound and shape their own payloads, and say so.** The alternative — mirror
   the API and trust the host's context window — fails on `breakdowns`, where a
   year-long window is roughly 70k tokens.
4. **Folders, and a thin helper.** `core/` and `tools/<tag>/`, plus a
   `registerReadTool` helper that absorbs the boilerplate. Not a descriptor table: the
   v1 spec deferred that decision to "when the repetition is real", and the repetition
   that is real is the mechanical `try/catch`, not the descriptions and schemas that
   decide whether a model picks the right tool.
5. **Nine tool stories, plus a substrate story.** One tool per story, each shipping its
   own version, mirroring the growth path EPIC-2 already records.

## Tool surface

| Tool | Endpoint | Scope | File |
|---|---|---|---|
| `list_accounts` | `GET /accounts` | `accounts:read` | `tools/accounts/list-accounts.ts` |
| `list_brokers` | `GET /brokers` | `brokers:read` | `tools/brokers/list-brokers.ts` |
| `list_strategies` | `GET /strategies` | `strategies:read` | `tools/strategies/list-strategies.ts` |
| `list_account_strategies` | `GET …/{id}/strategies` | `strategies:read` | `tools/strategies/list-account-strategies.ts` |
| `get_account_performance` | `GET …/performance` | `performance:read` | `tools/performance/summary.ts` |
| `get_performance_breakdowns` | `GET …/performance/breakdowns` | `performance:read` | `tools/performance/breakdowns.ts` |
| `get_equity_timeseries` | `GET …/performance/timeseries` | `performance:read` | `tools/performance/timeseries.ts` |
| `list_positions` | `GET …/positions` | `trading:read` | `tools/trading/positions.ts` |
| `list_pending_orders` | `GET …/orders` | `trading:read` | `tools/trading/orders.ts` |
| `list_deals` | `GET …/deals` | `trading:read` | `tools/trading/deals.ts` |

Two descriptions carry weight beyond documentation:

- **`list_brokers` and `list_strategies` must state that they are platform-wide.**
  Without that sentence a model reads `list_strategies` as "the strategies I am
  running" and answers confidently from the wrong catalog. The user-scoped answer is
  `list_account_strategies`.
- **Every tool taking `accountId` must state that the value is `id` from
  `list_accounts`, not `login`.** The v1 spec already required this of one tool; eight
  tools multiply the chance a model reaches for the MT5 account number instead.

## Repo structure

```
src/
  index.ts        index.test.ts     ← stdio bootstrap; MUST stay at the root of src/
  server.ts       server.test.ts    ← creates the client, calls ten register* functions
  config.ts       config.test.ts
  smoke.test.ts
  core/                             ← infrastructure; imports nothing from tools/
    client.ts     client.test.ts
    errors.ts     errors.test.ts
    tool.ts       tool.test.ts
  tools/                            ← one folder per API tag, one file per endpoint
    accounts/     list-accounts.ts
    brokers/      list-brokers.ts
    strategies/   list-strategies.ts, list-account-strategies.ts
    performance/  summary.ts, breakdowns.ts, timeseries.ts
    trading/      positions.ts, orders.ts, deals.ts
```

This reverses the flat layout [AGENTS.md](../../../AGENTS.md) currently states
("the six source files below, flat … not into a `tools/` directory"). That rule was
written for six source files and is being outgrown at sixteen, with a test file beside
each. US-2.4 rewrites the section and records the reversal as a CONTEXT decision.

**Three constraints the layout must respect**, verified against the current build
config:

- `tsconfig.json` already globs recursively (`src/**/*.ts`, excluding
  `src/**/*.test.ts`) and `package.json`'s `files` array matches. Subdirectories need
  no build change.
- `bin` points at `dist/index.js` and `rootDir` is `src`, so **`src/index.ts` cannot
  move**. Relocating it changes the `dist/` layout, breaks `bin`, and breaks
  `index.test.ts`, which spawns the built entry point on purpose.
- `test:smoke` hardcodes `src/smoke.test.ts`. Moving that file means editing
  `package.json` in the same commit.

**The dependency edge is one-way: `core/` never imports from `tools/`.** That is what
keeps `core/` testable without constructing a tool.

Each endpoint file exports exactly four things — `XSchema`, `parseX`, `formatX`,
`registerX` — so a story adds one file, one test file, and one line in `server.ts`.
There are no barrel `index.ts` files: `moduleResolution: NodeNext` requires the
explicit filename in every import, so a barrel buys an indirection and nothing else.

## Substrate

### `core/client.ts`

Two additions, and one of them is where EPIC-2's security invariant lives or dies.

```ts
get(path: string, options?: {
  query?: Record<string, string | number | undefined>;  // undefined dropped, then URLSearchParams
  signal?: AbortSignal;
  scope?: string;
}): Promise<unknown>

accountPath(accountId: string, ...rest: string[]): string
```

`accountPath` is **the only function permitted to build a path containing a parameter.**
No tool concatenates. It validates each segment against `/^[A-Za-z0-9_-]{1,64}$/`, then
passes it through `encodeURIComponent`.

The character class rather than a UUID pattern is deliberate. The v1 spec says path
parameters are "validated against its expected format (UUID)", but the OpenAPI document
declares `accountId` as a bare `type: string` — no `format: uuid`, no `pattern`.
Hard-coding UUID would take eight tools down at once the day Senti issues an id in any
other shape, and it would be this server's assumption failing, not the API's contract.
The character class rejects everything that makes concatenation dangerous — `/`, `.`,
`%`, whitespace, the empty string — without asserting a format the API never promised,
and `encodeURIComponent` still runs behind it.

### `core/tool.ts`

```ts
export function registerReadTool<A, S>(server: McpServer, spec: {
  name: string; title: string; description: string;
  inputSchema: z.ZodType<A>; outputSchema: z.ZodType<S>;
  run: (args: A, signal: AbortSignal) => Promise<{ text: string; structured: S }>;
}): void
```

It wraps `run` in the `try`/`catch` that every tool repeats, returns
`{ content, structuredContent }` on success and `{ content: [describeError(e)],
isError: true }` on failure, and sets `annotations: { readOnlyHint: true,
openWorldHint: true }` as a constant rather than a parameter — which makes it a
mechanical barrier against a write tool reaching this server before EPIC-3 opens.

`list_accounts` moves onto the helper in US-2.4 so the repository holds one registration
shape, not two.

## Payload policy

Both `content` and `structuredContent` enter the model's context, so "return it all and
let the host cope" is a decision to spend tens of thousands of tokens on a question the
user thought was small.

| Tool | Policy |
|---|---|
| `list_positions`, `list_pending_orders` | Return in full. Defensive cap at 200 rows so a pathological account cannot flood the context. |
| `list_deals` | `limit` (default **50**, API maximum 500), `cursor`, `entry`, `from`, `to`. `nextCursor` is returned to the model. **No automatic drain** — one "show my trade history" must not silently become twenty requests. |
| `get_account_performance` | Return in full. The response is a fixed-size object (`metrics`, `portfolioReturn`, `lifetimeIrr`, `live`) that does not grow with the window, which makes this the default tool for any performance question. |
| `get_performance_breakdowns` | Drop `perAccount`; drop the three `cumulative*` columns from `daily`; keep the top **10** symbols by \|P&L\| in `perSymbol` — whose rows are keyed by `dateKey` with one numeric column per symbol, so this drops *columns*, not rows; collapse `heatmap` to 24 hourly buckets. |
| `get_equity_timeseries` | Drop `perAccount`; downsample `portfolio` to at most **200** points, always keeping the first point, the last point, and the deepest drawdown. Keep `caveats` and `portfolioCaveats` in full. |

Three of those cuts cost nothing at all:

- **`perAccount` in an account-scoped endpoint.** Both `breakdowns` and `timeseries`
  are already scoped to one account, yet both return a `perAccount` map — containing
  that one account. It restates `daily` / `portfolio` in a wider shape. In `breakdowns`
  it is six parallel row-sets.
- **`cumulative*` in `daily`.** `cumulativePnl`, `cumulativeVolume` and
  `cumulativeNotional` are running sums of three columns already present in the same
  row. Dropping them halves `daily` with zero information loss.
- **`heatmap`.** It is `dates[]` plus `pnlSeries` and `tradeCountSeries`, each 24
  hour-named series carrying one `{x, y}` point per date — 24 × 30 × 2 ≈ 1,440 points
  for a 30-day window, and it grows linearly with the window. Collapsing it to 24
  hourly totals preserves the only question it can answer in text ("which hour of the
  day do I trade worst") at roughly 1KB. The per-date resolution is only usable by a
  chart, and there is no chart here.

**Every cut leaves a trace.** Every tool that can cut anything — the three performance
tools, plus `list_positions` and `list_pending_orders` with their 200-row cap — carries
`notes: string[]` in its `outputSchema`, repeated in `content`: what was dropped, how
much remains, and how to ask for the rest. `notes` is an empty array when nothing was
cut, so its presence in the schema never implies a cut occurred.

`list_deals` is the exception, and deliberately: paginating is not cutting. It returns
`nextCursor` as data, and its text says whether more pages exist.

A model that reads a truncated `daily` without knowing it was truncated will state a
confident, wrong conclusion about real money.

## `accountId` handling

Eight of ten tools take `accountId`, so the odds of a model passing `login` (an MT5
number such as `413878201`) rise eightfold. Two cheap layers, and deliberately no
automatic resolution:

- Every such tool's description names `list_accounts`.`id` as the source and `login` as
  the wrong answer.
- `client.ts` gains a dedicated `404` branch, split out of the current default case:
  the account does not exist or does not belong to this key — *and if `login` was passed
  instead of `id`, call `list_accounts` to get the `id`.*

Resolving `login` → `id` server-side was rejected. It adds a hidden request to every
call, a cache that can go stale, and it hides a mistake the model corrects itself in one
turn when the message says the right thing.

## Terminal state is not emptiness

`positions` and `orders` read through to the MT5 terminal; `performance` returns
`live: null` when that terminal is offline. This is EPIC-2's *null is not zero*
invariant in its most dangerous form: **"no positions could be read" and "this account
holds no positions" are different sentences**, and merging them produces "you have no
open positions" for an account that is holding open risk.

Every affected `formatX` states terminal state before it states a count.

## Testing

Per-endpoint tests sit beside each endpoint file and cover: Zod rejecting a response
missing a required field; nullable numbers rendering as `—`; terminal state stated
before counts; and `notes` present whenever a cut occurred.

Three **table-driven** tests are written once and cover every tool added afterwards:

- **No key leakage** — every tool × every error branch, asserting the API key appears in
  no output. Today this is asserted for `list_accounts` alone; as a table it also covers
  tool eleven.
- **`structuredContent` validates against the tool's own `outputSchema`.**
- **`readOnlyHint: true` on every registered tool** — cheap, and a mechanical barrier
  against a write tool landing here before EPIC-3.

`core/client.test.ts` adds: `accountPath` rejecting `../`, `..%2F..%2Fadmin`, the empty
string, and a 65-character segment; `query` dropping `undefined` and encoding the rest;
the `404` branch producing the `login`/`id` sentence.

The smoke test extends to the whole read path: `list_accounts` first, then
`accounts[0].id` fed to each account-scoped endpoint. It skips cleanly when the key owns
no accounts rather than failing.

## Story plan

Ordered so that **each story opens exactly one new axis**, and the axis is opened in the
cheapest story that can carry it. A defect in `accountPath` surfaces in a 2-point story,
not tangled inside payload shaping.

| Story | Content | New axis | Pts | Ships |
|---|---|---|---|---|
| US-2.4 | Substrate: folder layout, `registerReadTool`, `client` `query`/`accountPath`/`404`, migrate `list_accounts` | — | 5 | 0.2.0 |
| US-2.5 | `list_brokers` | first tool on the new substrate | 2 | 0.3.0 |
| US-2.6 | `list_strategies` | — | 2 | 0.4.0 |
| US-2.7 | `list_account_strategies` | first path parameter | 2 | 0.5.0 |
| US-2.8 | `list_positions` | first terminal-backed read | 2 | 0.6.0 |
| US-2.9 | `list_pending_orders` | — | 2 | 0.7.0 |
| US-2.10 | `get_account_performance` | first query parameters | 2 | 0.8.0 |
| US-2.11 | `list_deals` | cursor pagination | 3 | 0.9.0 |
| US-2.12 | `get_performance_breakdowns` | payload shaping | 3 | 0.10.0 |
| US-2.13 | `get_equity_timeseries` | downsampling | 3 | 0.11.0 |

US-2.4 ships no new tool, which follows the precedent
[US-2.1](../../sprints/stories/US-2.1-authenticated-senti-api-client.md) set for v1:
substrate first, tool second.

Two sprints: **W33** carries US-2.4 → US-2.9 (15 points, matching W32's delivered
velocity) and **W34** carries US-2.10 → US-2.13 (11 points).

## Documentation obligations

US-2.4 carries these in its own commit, per RULE-1:

- The operation count in [AGENTS.md](../../../AGENTS.md) and
  [EPIC-2](../../sprints/epics/EPIC-2.md): "8 POST" and "the remaining 16 read
  operations" become 7 `POST` / 10 `GET` / nine read operations remaining.
- The repo structure section of [AGENTS.md](../../../AGENTS.md), which currently
  asserts the opposite of the layout above.
- Three [CONTEXT.md](../../CONTEXT.md) entries: **D7** the directory structure
  (reversing the flat rule), **D8** `registerReadTool` (the resolution of the v1 spec's
  deferred "revisit when the repetition is real"), **D9** the payload-shaping policy.
- [SETUP.md](../../SETUP.md), `.env.example` and `README.md`: five scopes, not one.

The v1 design spec is not edited. It is a snapshot, and D1 and D5 both established that
this repository amends via CONTEXT rather than rewriting planning artifacts.

## EPIC-3 boundary

US-2.4 also creates `EPIC-3.md` with `status: planned`, no stories: the seven write
operations, and the guardrails already identified — an opt-in environment variable,
`Idempotency-Key` support, elicitation for user confirmation, and the explicit warning
that a partial position close is not retry-safe and the caller must dedupe it.

An empty epic with an id turns the read/write boundary from a paragraph of prose into an
artifact that stories can reference.
