import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { ACCOUNT_NOT_FOUND, accountPath, type SentiClient } from '../../core/client.js';
import { parseOrThrow } from '../../core/parse.js';
import { registerReadTool } from '../../core/tool.js';

/**
 * Transcribed from `GET /api/v1/accounts/{accountId}/performance` in the live
 * OpenAPI document. All 25 members are required there and all 25 were present
 * in the 2026-08-10 live read, so nothing here is optional; what varies is
 * nullability, and only where the document declares it.
 *
 * The last three of these are not figures but statements about the figures.
 * `notionalIncomplete` says `totalNotionalVolume` understates the truth;
 * `staleBalanceAccounts` and `unconvertedAccounts` say which accounts fed the
 * totals with a last-known balance or with money that never reached the
 * reporting currency. They are rendered as caveats rather than dropped —
 * quoting a total while discarding the API's own warning about it is how a
 * model states a confident, wrong number.
 */
const MetricsSchema = z.object({
  grossProfit: z.number(),
  grossLoss: z.number(),
  /** A percentage, not a fraction: 48 wins of 58 deals arrives as 82.76. */
  winRate: z.number(),
  totalPnl: z.number(),
  profitFactor: z.number(),
  totalBalance: z.number(),
  totalEquity: z.number(),
  totalVolume: z.number(),
  totalNotionalVolume: z.number(),
  longCount: z.number(),
  shortCount: z.number(),
  robotCount: z.number(),
  manualCount: z.number(),
  totalClosedDeals: z.number(),
  winCount: z.number(),
  lossCount: z.number(),
  unconvertedAccounts: z.array(z.string()),
  notionalIncomplete: z.boolean(),
  staleBalanceAccounts: z.array(z.string()),
  deposits: z.number(),
  withdrawals: z.number(),
  netCashFlow: z.number(),
  commission: z.number(),
  swap: z.number(),
  fee: z.number(),
});

/**
 * Return over the requested window. `roi` and `irr` are nullable because an
 * account with no capital base has no return — which is not a return of zero.
 * Both are percentages.
 */
const PortfolioReturnSchema = z.object({
  roi: z.number().nullable(),
  irr: z.number().nullable(),
  periodNetPnL: z.number(),
  periodGrossDeposits: z.number(),
  startingBalance: z.number(),
  endingValue: z.number(),
  capitalBase: z.number(),
  cashFlowCount: z.number(),
});

/** Return since the account's first cash flow. `earliestMs` is epoch milliseconds. */
const LifetimeIrrSchema = z.object({
  irr: z.number().nullable(),
  cashFlowCount: z.number(),
  earliestMs: z.number().nullable(),
  grossDeposits: z.number(),
  grossWithdrawals: z.number(),
});

/**
 * Read through to the MT5 terminal, and `null` for this whole block when that
 * terminal is offline. Unlike `positions` and `orders` there is no `409` here:
 * the historical KPIs are still valid, so the API answers `200` and nulls the
 * part it could not read.
 */
const LiveSchema = z.object({
  balance: z.number(),
  equity: z.number(),
  profit: z.number(),
  margin: z.number(),
  marginFree: z.number(),
  marginLevel: z.number(),
  leverage: z.number(),
  currency: z.string().nullable(),
  name: z.string().nullable(),
});

export const PerformanceSchema = z.object({
  metrics: MetricsSchema,
  portfolioReturn: PortfolioReturnSchema,
  lifetimeIrr: LifetimeIrrSchema,
  live: LiveSchema.nullable(),
});

export type Performance = z.infer<typeof PerformanceSchema>;

/**
 * The tool's advertised output: the response in full, plus `notes`.
 *
 * Flat rather than wrapped under a key, unlike the list tools. Those wrap
 * because the API hands them a bare array and a non-object `structuredContent`
 * reaches the two protocol eras in two different shapes; this response is
 * already an object, so wrapping it would add a level that describes nothing.
 *
 * `notes` is always empty here — see `NOTHING_CUT`.
 */
export const PerformanceOutputSchema = PerformanceSchema.extend({
  notes: z.array(z.string()),
});

/**
 * This tool cuts nothing: the response is a fixed-size object that does not
 * grow with the requested window, which is what makes it the default tool for
 * a performance question. `notes` is in the schema for uniformity across
 * `tools/performance/`, where the other two tools genuinely do cut. A non-empty
 * `notes` from this tool is a bug.
 *
 * Distinct from the caveats the text carries: those are the API's statements
 * about its own figures, not a record of something this server removed.
 */
const NOTHING_CUT: string[] = [];

export function parsePerformance(payload: unknown): Performance {
  return parseOrThrow(PerformanceSchema, payload, 'performance summary');
}

const DATE_FORMAT = 'YYYY-MM-DD';
const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Shape *and* existence. The regex alone accepts `2026-02-31`, and a model
 * asked about February can produce a month-end it never checked; the API
 * answers that with a 400 about a query parameter, which sends the reader to
 * look at the wrong thing. `Date` rolls an impossible day forward, so a value
 * that does not survive the round trip was never a day.
 */
function isCalendarDate(value: string): boolean {
  if (!DATE_SHAPE.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const windowDate = (bound: string) =>
  z
    .string()
    .refine(
      isCalendarDate,
      `must be a calendar date in ${DATE_FORMAT} format, UTC — for example 2026-05-01`,
    )
    .describe(`Window ${bound} (UTC, ${DATE_FORMAT}).`);

/**
 * `reporting` is an ISO-4217 currency code — NOT a reporting period, which is
 * what the name suggests and what this story was written expecting. The live
 * OpenAPI document declares it `type: string`, "ISO-4217 currency the money
 * metrics are normalized to. Default USD".
 *
 * Validated by shape rather than against a list of codes, for the reason
 * `accountPath`'s `PATH_SEGMENT` is not a UUID pattern: an enumerated set this
 * server invented, and the API never declared, fails closed on the first
 * legitimate currency nobody thought of. What this does reject is a value that
 * is not a currency code at all — `monthly`, `daily`, a lowercase `usd`.
 */
const ISO_4217 = /^[A-Z]{3}$/;

export const PerformanceInputSchema = z.object({
  accountId: z
    .string()
    .describe('The `id` field from list_accounts. Not the `login` (MT5 account number).'),
  from: windowDate('start').optional(),
  to: windowDate('end, inclusive').optional(),
  reporting: z
    .string()
    .refine(
      (value) => ISO_4217.test(value),
      'must be a three-letter uppercase ISO-4217 currency code — for example USD or EUR',
    )
    .describe('ISO-4217 currency the money figures are normalized to. Defaults to USD.')
    .optional(),
});

export type PerformanceWindow = {
  from?: string;
  to?: string;
  reporting?: string;
};

const NO_VALUE = '—';
/**
 * The API's documented default when `reporting` is omitted. Exported for the
 * same reason as `windowOf`: it is what the API does, not what this module
 * prefers, and `breakdowns.ts` reports the same currency for the same omission.
 */
export const DEFAULT_CURRENCY = 'USD';

function money(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Null is not zero: an absent return renders as a dash, never as 0.00%. */
function percent(value: number | null): string {
  return value === null ? NO_VALUE : `${value.toFixed(2)}%`;
}

function count(value: number): string {
  return value.toLocaleString('en-US');
}

function day(epochMs: number | null): string {
  return epochMs === null ? NO_VALUE : new Date(epochMs).toISOString().slice(0, 10);
}

/**
 * The response echoes no window back, so the text has to say which period the
 * figures cover — including when the caller supplied nothing and the API chose.
 * Without it a model that asked a vague question attributes the numbers to
 * whatever period it had in mind.
 *
 * Exported for `breakdowns.ts`, which takes the same three query parameters
 * against the same defaults and so makes the same statement. This is a claim
 * about the API's window semantics rather than a formatting helper — two
 * copies could disagree about what an omitted `from` means, and only one of
 * them would be right.
 */
export function windowOf({ from, to }: PerformanceWindow): string {
  if (from && to) return `${from} → ${to}`;
  if (from) return `${from} → today (the API's default end)`;
  if (to) return `the 30 days ending ${to} (the API's default start)`;

  return "the API's default window — the 30 days ending today";
}

function liveBlock(live: Performance['live']): string {
  if (live === null) {
    return (
      'Live terminal: the MT5 terminal for this account could not be reached, so its live ' +
      'equity, floating P&L, margin and leverage are unavailable. This is NOT an empty or ' +
      'flat account — the figures above are historical and unaffected, and any open ' +
      'positions are still open.'
    );
  }

  const identity = [
    live.name === null ? '' : ` · account ${live.name}`,
    live.currency === null ? '' : ` (${live.currency})`,
  ].join('');

  return (
    `Live terminal: equity ${money(live.equity)} · balance ${money(live.balance)} · ` +
    `floating P&L ${money(live.profit)} · margin ${money(live.margin)} · ` +
    `free margin ${money(live.marginFree)} · margin level ${percent(live.marginLevel)} · ` +
    `leverage ${count(live.leverage)}${identity}`
  );
}

/** The API's own statements about the figures it just returned. */
function caveatsOf(metrics: Performance['metrics'], currency: string): string[] {
  const caveats: string[] = [];

  if (metrics.notionalIncomplete) {
    caveats.push(
      '- Notional volume is incomplete: some deals lacked the contract size needed to ' +
        'compute it, so the notional figure above understates the real one.',
    );
  }

  if (metrics.staleBalanceAccounts.length > 0) {
    caveats.push(
      `- Balance is stale for ${metrics.staleBalanceAccounts.length} account(s): the ` +
        'balance and equity above come from the last known sync, not from a live read.',
    );
  }

  if (metrics.unconvertedAccounts.length > 0) {
    caveats.push(
      `- ${metrics.unconvertedAccounts.length} account(s) could not be converted to ` +
        `${currency}: money that did not convert is excluded from the totals above.`,
    );
  }

  return caveats;
}

export function formatPerformance(performance: Performance, window: PerformanceWindow): string {
  const { metrics, portfolioReturn, lifetimeIrr, live } = performance;
  const currency = window.reporting ?? DEFAULT_CURRENCY;

  const sections = [
    `Performance over ${windowOf(window)}, in ${currency}.`,

    `Net P&L ${money(metrics.totalPnl)} · ROI ${percent(portfolioReturn.roi)} · ` +
      `win rate ${percent(metrics.winRate)} · profit factor ${metrics.profitFactor.toFixed(2)}\n` +
      `Closed deals ${count(metrics.totalClosedDeals)} (${count(metrics.winCount)} won / ` +
      `${count(metrics.lossCount)} lost) · long ${count(metrics.longCount)} / ` +
      `short ${count(metrics.shortCount)} · robot ${count(metrics.robotCount)} / ` +
      `manual ${count(metrics.manualCount)}\n` +
      `Gross profit ${money(metrics.grossProfit)} · gross loss ${money(metrics.grossLoss)} · ` +
      `commission ${money(metrics.commission)} · swap ${money(metrics.swap)} · ` +
      `fee ${money(metrics.fee)}\n` +
      `Volume ${metrics.totalVolume} lots · notional ${money(metrics.totalNotionalVolume)} · ` +
      `balance ${money(metrics.totalBalance)} · equity ${money(metrics.totalEquity)}\n` +
      `Deposits ${money(metrics.deposits)} · withdrawals ${money(metrics.withdrawals)} · ` +
      `net cash flow ${money(metrics.netCashFlow)}`,

    `Period return: ROI ${percent(portfolioReturn.roi)} · IRR ${percent(portfolioReturn.irr)} · ` +
      `net P&L ${money(portfolioReturn.periodNetPnL)} · ` +
      `${money(portfolioReturn.startingBalance)} → ${money(portfolioReturn.endingValue)} on a ` +
      `capital base of ${money(portfolioReturn.capitalBase)} · ` +
      `${count(portfolioReturn.cashFlowCount)} cash flow(s)\n` +
      `Lifetime IRR ${percent(lifetimeIrr.irr)} · since ${day(lifetimeIrr.earliestMs)} · ` +
      `${count(lifetimeIrr.cashFlowCount)} cash flow(s) · ` +
      `deposits ${money(lifetimeIrr.grossDeposits)} · ` +
      `withdrawals ${money(lifetimeIrr.grossWithdrawals)}`,

    liveBlock(live),
  ];

  const caveats = caveatsOf(metrics, currency);
  if (caveats.length > 0) sections.push(`Caveats:\n${caveats.join('\n')}`);

  return sections.join('\n\n');
}

/** The scope this endpoint requires, quoted back in the 403 message. */
const PERFORMANCE_READ = 'performance:read';

export function registerGetAccountPerformance(server: McpServer, client: SentiClient): void {
  registerReadTool(server, {
    name: 'get_account_performance',
    title: 'Get an account performance summary',
    description:
      'Summarize how one MT5 account has performed over a date window: net P&L, win rate, ' +
      'profit factor, gross profit and loss, deal counts, costs, cash flow, period ROI and ' +
      'IRR, lifetime IRR, and the live terminal state. This is the default tool for any ' +
      'performance question — the response is a fixed-size summary that does not grow with ' +
      'the window. `accountId` is the `id` field from list_accounts — NOT `login`. Omit ' +
      '`from`/`to` for the last 30 days. `reporting` is an ISO-4217 currency code (default ' +
      'USD), not a reporting period. A null `live` block means the terminal was unreachable, ' +
      'not that the account is empty.',
    inputSchema: PerformanceInputSchema,
    outputSchema: PerformanceOutputSchema,
    run: async (args, signal) => {
      const payload = await client.get(accountPath(args.accountId, 'performance'), {
        signal,
        scope: PERFORMANCE_READ,
        notFoundMeans: ACCOUNT_NOT_FOUND,
        // Handed over whole. `queryStringOf` in `core/client.ts` drops the
        // undefined members; pre-filtering here would put the same rule in two
        // places, and this is the call site that proves the option works.
        query: { from: args.from, to: args.to, reporting: args.reporting },
      });
      const performance = parsePerformance(payload);

      return {
        text: formatPerformance(performance, args),
        structured: { ...performance, notes: NOTHING_CUT },
      };
    },
  });
}
