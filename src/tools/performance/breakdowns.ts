import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { ACCOUNT_NOT_FOUND, accountPath, type SentiClient } from '../../core/client.js';
import { parseOrThrow } from '../../core/parse.js';
import { registerReadTool } from '../../core/tool.js';
import {
  DEFAULT_CURRENCY,
  PerformanceInputSchema,
  windowOf,
  type PerformanceWindow,
} from './summary.js';

/**
 * Transcribed from `GET /api/v1/accounts/{accountId}/performance/breakdowns`
 * in the live OpenAPI document, re-read 2026-08-11 and checked against a real
 * response on the same day (TASK-2.12.1). Every member below is required
 * there and none is nullable.
 *
 * This is the largest payload the API serves — 87,063 bytes for a 63-day
 * window on a single-symbol account, and it grows with both the window and
 * the symbol count. What the schema declares is therefore not what the tool
 * returns: `BreakdownsOutputSchema` is the shaped shape, and the distance
 * between the two is the point of this module.
 */
const DailyRowSchema = z.object({
  /** A display label — "Jun 10". `dateKey` is the machine-readable one. */
  date: z.string(),
  dateKey: z.string(),
  pnl: z.number(),
  volume: z.number(),
  notionalVolume: z.number(),
  /**
   * Running sums of `pnl`, `volume` and `notionalVolume` over the rows above.
   * Declared because the API sends them, dropped because they are derivable —
   * confirmed row by row against a live response, not assumed from the names.
   */
  cumulativePnl: z.number(),
  cumulativeVolume: z.number(),
  cumulativeNotional: z.number(),
});

/**
 * A row keyed by `dateKey` and `date`, plus one numeric column per symbol.
 * The column names are data — symbols vary by account — so this cannot be an
 * object schema, and the value union is the API's own `anyOf`.
 */
const SeriesRowSchema = z.record(z.string(), z.union([z.string(), z.number()]));

export type SeriesRow = z.infer<typeof SeriesRowSchema>;

const PerSymbolSchema = z.object({
  pnlSymbols: z.array(z.string()),
  dealsSymbols: z.array(z.string()),
  dailyPnlRows: z.array(SeriesRowSchema),
  dailyDealsRows: z.array(SeriesRowSchema),
  /** Running sums again, and dropped for the same reason. */
  cumPnlRows: z.array(SeriesRowSchema),
  cumDealsRows: z.array(SeriesRowSchema),
});

const HeatmapSeriesSchema = z.object({
  /** The hour of day this series covers, `HH:00`. */
  name: z.string(),
  data: z.array(z.object({ x: z.string(), y: z.number() })),
});

const HeatmapSchema = z.object({
  dates: z.array(z.string()),
  pnlSeries: z.array(HeatmapSeriesSchema),
  tradeCountSeries: z.array(HeatmapSeriesSchema),
});

export const BreakdownsSchema = z.object({
  daily: z.array(DailyRowSchema),
  /**
   * Six parallel row-sets restating `daily` per login, and the one block this
   * tool drops whole. Deliberately `unknown` rather than transcribed: the
   * endpoint is already scoped to one account, so this map holds that account
   * and nothing else — a live read confirmed all 32 of its `dailyPnlRows`
   * reproduce `daily.pnl` exactly, with none differing.
   *
   * `parse.ts` validates all-or-nothing so that malformed data never reaches
   * the model. Data this tool discards never reaches the model whatever shape
   * it arrives in, so validating it would only convert an upstream change in
   * a block nobody reads into an outage for the blocks everybody does.
   */
  perAccount: z.unknown(),
  perSymbol: PerSymbolSchema,
  heatmap: HeatmapSchema,
});

export type Breakdowns = z.infer<typeof BreakdownsSchema>;

/** The `daily` row as the model sees it: cut 2 has removed the running sums. */
const ShapedDailyRowSchema = DailyRowSchema.omit({
  cumulativePnl: true,
  cumulativeVolume: true,
  cumulativeNotional: true,
});

/** One hour of the day, totalled across every date in the window. */
const HourBucketSchema = z.object({
  /** `HH:00`, UTC, ascending — the API returns its series descending. */
  hour: z.string(),
  pnl: z.number(),
  deals: z.number(),
});

/**
 * The tool's advertised output, and a record of the cuts in its own right:
 * `perAccount` has no member here, `daily` has no `cumulative*` columns,
 * `perSymbol` has no `cum*Rows`, and `heatmap` has become `hourly`.
 *
 * Flat rather than wrapped, for the reason `summary.ts` gives — the API hands
 * this one an object already.
 */
export const BreakdownsOutputSchema = z.object({
  daily: z.array(ShapedDailyRowSchema),
  perSymbol: z.object({
    pnlSymbols: z.array(z.string()),
    dealsSymbols: z.array(z.string()),
    dailyPnlRows: z.array(SeriesRowSchema),
    dailyDealsRows: z.array(SeriesRowSchema),
  }),
  hourly: z.array(HourBucketSchema),
  /**
   * What was cut and how to ask for the rest — empty when nothing was.
   *
   * Only a cut that loses information earns a line. Dropping a running sum or
   * a restatement of a block already present removes bytes, not answers, and
   * a note about it would train a reader to skim past the two notes that
   * genuinely change what the numbers can be used for.
   */
  notes: z.array(z.string()),
});

export type ShapedBreakdowns = z.infer<typeof BreakdownsOutputSchema>;

export function parseBreakdowns(payload: unknown): Breakdowns {
  return parseOrThrow(BreakdownsSchema, payload, 'performance breakdowns');
}

/**
 * A cut, and the note that records it. One return value rather than two, so
 * that a cut and its trace cannot drift apart: there is no way to change what
 * a shaping function removes without passing the sentence that describes it.
 *
 * `note` is `null` for a lossless cut — see `notes` on the output schema.
 */
type Cut<T> = { value: T; note: string | null };

/**
 * Cut 2 — the three `cumulative*` columns leave `daily`, the columns they were
 * running sums of stay. Halves the block and loses nothing: a reader who wants
 * a running total can add up the column it ran over, and recomputing it here
 * would put back exactly the bytes this removed.
 */
function withoutRunningSums(daily: Breakdowns['daily']): ShapedBreakdowns['daily'] {
  return daily.map(({ cumulativePnl, cumulativeVolume, cumulativeNotional, ...kept }) => kept);
}

/** How many symbols survive cut 3. */
const TOP_SYMBOLS = 10;

/**
 * Sum each symbol's column down the rows. Over `dailyPnlRows` that is net P&L
 * over the window, which is what cut 3 ranks on; over `dailyDealsRows` it is
 * the deal count. Cut 5 drops the API's own running sums, so this is where a
 * total comes from now.
 */
function totalsBySymbol(rows: SeriesRow[], symbols: string[]): Map<string, number> {
  const totals = new Map(symbols.map((symbol) => [symbol, 0]));

  for (const row of rows) {
    for (const symbol of symbols) {
      const value = row[symbol];
      if (typeof value === 'number') totals.set(symbol, (totals.get(symbol) ?? 0) + value);
    }
  }

  return totals;
}

/**
 * Remove named columns from every row, leaving the rows themselves alone.
 *
 * Named rather than typed: filtering on "is this value a number" would also
 * drop any future numeric column that is not a symbol, which is how a cut
 * aimed at symbols quietly starts removing something else.
 */
function withoutColumns(rows: SeriesRow[], dropped: Set<string>): SeriesRow[] {
  if (dropped.size === 0) return rows;

  return rows.map((row) =>
    Object.fromEntries(Object.entries(row).filter(([column]) => !dropped.has(column))),
  );
}

/**
 * Cut 3 — `perSymbol` keeps the {@link TOP_SYMBOLS} symbols with the largest
 * absolute net P&L, and cut 5 drops its two running-sum row-sets.
 *
 * Cut 3 is the only one that loses information, which is what `notes` exists
 * for. It removes *columns*: every `dateKey` row survives, because the rows are
 * dates and the columns are symbols — dropping rows would silently shorten the
 * window the caller asked for.
 *
 * The ranking runs over the union of both symbol lists so that the P&L half
 * and the deal-count half describe the same symbols. Ranking each separately
 * would produce an answer where a symbol's P&L is present and its deal count
 * is not, which reads as "no deals" rather than "not in this answer".
 */
function shapePerSymbol(perSymbol: Breakdowns['perSymbol']): Cut<ShapedBreakdowns['perSymbol']> {
  const universe = [...new Set([...perSymbol.pnlSymbols, ...perSymbol.dealsSymbols])];
  const netPnl = totalsBySymbol(perSymbol.dailyPnlRows, universe);

  const ranked = [...universe].sort((left, right) => {
    const byMagnitude = Math.abs(netPnl.get(right) ?? 0) - Math.abs(netPnl.get(left) ?? 0);
    // Ties broken by name so the same response always yields the same ten. An
    // account whose symbols tie at zero P&L would otherwise return a different
    // ten per call, and the difference would look like data changing.
    return byMagnitude !== 0 ? byMagnitude : left.localeCompare(right);
  });

  const dropped = new Set(ranked.slice(TOP_SYMBOLS));
  const kept = (symbols: string[]) => symbols.filter((symbol) => !dropped.has(symbol));

  const note =
    dropped.size === 0
      ? null
      : `Symbol coverage was cut: this account traded ${universe.length} symbols over the ` +
        `window and the answer keeps the ${TOP_SYMBOLS} with the largest absolute net P&L, ` +
        `dropping the other ${dropped.size} (${[...dropped].sort().join(', ')}). Every date ` +
        'row is intact — the cut removed symbol columns, not dates. A dropped symbol can rank ' +
        'inside the top ten over a shorter period, so narrow `from`/`to` to see it; there is ' +
        'no option to request the unshaped response.';

  return {
    value: {
      pnlSymbols: kept(perSymbol.pnlSymbols),
      dealsSymbols: kept(perSymbol.dealsSymbols),
      dailyPnlRows: withoutColumns(perSymbol.dailyPnlRows, dropped),
      dailyDealsRows: withoutColumns(perSymbol.dailyDealsRows, dropped),
      // Cut 5. `cumPnlRows` and `cumDealsRows` are running sums of the two
      // row-sets above — verified value by value against a live response, the
      // same check cut 2 rests on — so they go for cut 2's reason and, like
      // cut 2, leave no note. They are 45% of this block.
    },
    note,
  };
}

/**
 * Cut 4 — the heatmap collapses to 24 hourly totals covering the whole window.
 *
 * `dates[] × 24 hour-named series × 2 measures` is 1,536 points for a 32-date
 * window and grows linearly; it was 47% of the raw payload when measured. The
 * only question the grid can answer in prose is "which hour do I trade worst",
 * and 24 totals answer it. Per-date resolution is for a chart, and there is no
 * chart at the other end of this — but it is genuinely gone, so it is noted.
 *
 * Totals are preserved: summed over the grid, the live response's P&L came to
 * 18,743.55, exactly what `daily` reported.
 */
function toHourlyTotals(heatmap: Breakdowns['heatmap']): Cut<ShapedBreakdowns['hourly']> {
  const totals = new Map<string, { pnl: number; deals: number }>();

  const bucketFor = (hour: string) => {
    const existing = totals.get(hour);
    if (existing) return existing;

    const created = { pnl: 0, deals: 0 };
    totals.set(hour, created);
    return created;
  };

  const total = (series: z.infer<typeof HeatmapSeriesSchema>) =>
    series.data.reduce((sum, point) => sum + point.y, 0);

  // Matched by `name`, not by index: the two series arrays are parallel today,
  // and an answer that silently pairs one hour's P&L with another's deal count
  // is worse than one that reports a bucket short.
  for (const series of heatmap.pnlSeries) bucketFor(series.name).pnl += total(series);
  for (const series of heatmap.tradeCountSeries) bucketFor(series.name).deals += total(series);

  const hourly = [...totals.entries()]
    .map(([hour, bucket]) => ({ hour, ...bucket }))
    // The API returns 23:00 first. `HH:00` sorts lexicographically as it sorts
    // chronologically, so this is the day in order.
    .sort((left, right) => left.hour.localeCompare(right.hour));

  const dates = heatmap.dates.length;
  const note =
    dates > 1
      ? `Hourly detail was cut: the API's heatmap covered ${dates} dates × ${hourly.length} ` +
        'hours and this answer totals each hour across the whole window, so it can say which ' +
        'hour of the day trades worst but not which hour of which date. The totals are ' +
        'complete — nothing was sampled or truncated.'
      : null;

  return { value: hourly, note };
}

/**
 * Every cut, in one place, and the only function that decides what the model
 * sees. Cut 1 is the absence of `perAccount` from what is returned below.
 */
export function shapeBreakdowns(breakdowns: Breakdowns): ShapedBreakdowns {
  const perSymbol = shapePerSymbol(breakdowns.perSymbol);
  const hourly = toHourlyTotals(breakdowns.heatmap);

  return {
    daily: withoutRunningSums(breakdowns.daily),
    perSymbol: perSymbol.value,
    hourly: hourly.value,
    notes: [perSymbol.note, hourly.note].filter((note): note is string => note !== null),
  };
}

const NO_VALUE = '—';

function money(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function count(value: number): string {
  return value.toLocaleString('en-US');
}

/** A signed figure, because "which symbol is losing me money" turns on the sign. */
function signed(value: number): string {
  return value > 0 ? `+${money(value)}` : money(value);
}

type Extreme = { label: string; value: number };

/** The largest and smallest of a set, or nulls when there is nothing to rank. */
function extremesOf(entries: Extreme[]): { best: Extreme | null; worst: Extreme | null } {
  if (entries.length === 0) return { best: null, worst: null };

  const sorted = [...entries].sort((left, right) => right.value - left.value);
  return { best: sorted[0] ?? null, worst: sorted[sorted.length - 1] ?? null };
}

function dailyBlock(daily: ShapedBreakdowns['daily']): string {
  if (daily.length === 0) {
    return 'Daily: no day in this window has trading activity. The request succeeded, so this ' +
      'is a real zero rather than a truncated read.';
  }

  const net = daily.reduce((sum, row) => sum + row.pnl, 0);
  const volume = daily.reduce((sum, row) => sum + row.volume, 0);
  const up = daily.filter((row) => row.pnl > 0).length;
  const down = daily.filter((row) => row.pnl < 0).length;
  const { best, worst } = extremesOf(daily.map((row) => ({ label: row.dateKey, value: row.pnl })));

  return (
    `Daily: ${count(daily.length)} day(s) with activity · net P&L ${signed(net)} · ` +
    `volume ${volume.toFixed(2)} lots · ${count(up)} up / ${count(down)} down\n` +
    `  Best day ${best?.label ?? NO_VALUE} (${best ? signed(best.value) : NO_VALUE}) · ` +
    `worst day ${worst?.label ?? NO_VALUE} (${worst ? signed(worst.value) : NO_VALUE})\n` +
    '  The full day-by-day series is in this result\'s structured content.'
  );
}

function symbolBlock(perSymbol: ShapedBreakdowns['perSymbol']): string {
  const pnl = totalsBySymbol(perSymbol.dailyPnlRows, perSymbol.pnlSymbols);
  const deals = totalsBySymbol(perSymbol.dailyDealsRows, perSymbol.dealsSymbols);

  if (perSymbol.pnlSymbols.length === 0 && perSymbol.dealsSymbols.length === 0) {
    return 'By symbol: no symbol traded in this window.';
  }

  const rows = [...new Set([...perSymbol.pnlSymbols, ...perSymbol.dealsSymbols])]
    .sort((left, right) => Math.abs(pnl.get(right) ?? 0) - Math.abs(pnl.get(left) ?? 0))
    .map(
      (symbol) =>
        `- ${symbol} — net P&L ${signed(pnl.get(symbol) ?? 0)} · ` +
        `${count(deals.get(symbol) ?? 0)} deal(s)`,
    );

  return `By symbol (${count(rows.length)} shown, largest absolute P&L first):\n${rows.join('\n')}`;
}

function hourBlock(hourly: ShapedBreakdowns['hourly']): string {
  const traded = hourly.filter((bucket) => bucket.deals !== 0 || bucket.pnl !== 0);

  if (traded.length === 0) {
    return 'By hour of day (UTC): no hour of the day has activity in this window.';
  }

  const { best, worst } = extremesOf(
    traded.map((bucket) => ({ label: bucket.hour, value: bucket.pnl })),
  );
  const rows = traded.map(
    (bucket) =>
      `- ${bucket.hour} — net P&L ${signed(bucket.pnl)} · ${count(bucket.deals)} deal(s)`,
  );
  // An hour with no trades says nothing, and printing all 24 buries the ones
  // that do. The count is still stated, so a silent hour is visibly silent
  // rather than missing — and all 24 buckets are in the structured content.
  const quiet = hourly.length - traded.length;
  const quietly = quiet === 0 ? '' : ` The other ${count(quiet)} hour(s) had no activity.`;

  return (
    `By hour of day (UTC, totalled across the window):\n${rows.join('\n')}\n` +
    `  Best hour ${best?.label ?? NO_VALUE} (${best ? signed(best.value) : NO_VALUE}) · ` +
    `worst hour ${worst?.label ?? NO_VALUE} (${worst ? signed(worst.value) : NO_VALUE}).` +
    quietly
  );
}

/**
 * `notes` reaches the model through the text as well as through
 * `structuredContent`, because many hosts surface `content` alone. A cut a
 * reader never learns about is how a shortened breakdown becomes a confident,
 * wrong conclusion about real money.
 */
export function formatBreakdowns(shaped: ShapedBreakdowns, window: PerformanceWindow): string {
  const currency = window.reporting ?? DEFAULT_CURRENCY;

  const sections = [
    `Performance breakdowns over ${windowOf(window)}, in ${currency}. This response is ` +
      'shaped — the API returns a chart-sized payload and this tool cuts it down; anything ' +
      'cut is listed under Notes below. For whole-account totals and ratios use ' +
      'get_account_performance.',
    dailyBlock(shaped.daily),
    symbolBlock(shaped.perSymbol),
    hourBlock(shaped.hourly),
  ];

  if (shaped.notes.length > 0) {
    sections.push(`Notes:\n${shaped.notes.map((note) => `- ${note}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

/** The scope this endpoint requires, quoted back in the 403 message. */
const PERFORMANCE_READ = 'performance:read';

export function registerGetPerformanceBreakdowns(server: McpServer, client: SentiClient): void {
  registerReadTool(server, {
    name: 'get_performance_breakdowns',
    title: 'Break an account down by day, symbol and hour',
    description:
      'Break one MT5 account down three ways over a date window: a day-by-day P&L, volume ' +
      'and notional series; a per-symbol P&L and deal-count series; and P&L by hour of the ' +
      'day. Use it for "which symbol is losing me money" or "what hour do I trade worst". ' +
      'For a single whole-account figure — net P&L, win rate, ROI, the live terminal — use ' +
      'get_account_performance instead: it is smaller and it is the default for a ' +
      'performance question. THIS RESPONSE IS SHAPED. The endpoint returns a chart-sized ' +
      'payload, so per-account rows and running totals are dropped, at most ten symbols are ' +
      'kept, and the hourly grid is totalled across the window. Whatever that cost is listed ' +
      'in `notes`, which is empty when nothing was cut — read it before concluding that a ' +
      'symbol was not traded. `accountId` is the `id` field from list_accounts — NOT ' +
      '`login`. Omit `from`/`to` for the last 30 days; a narrower window is also how you ' +
      'see a symbol that was cut. `reporting` is an ISO-4217 currency code (default USD), ' +
      'not a reporting period.',
    inputSchema: PerformanceInputSchema,
    outputSchema: BreakdownsOutputSchema,
    run: async (args, signal) => {
      const payload = await client.get(accountPath(args.accountId, 'performance', 'breakdowns'), {
        signal,
        scope: PERFORMANCE_READ,
        notFoundMeans: ACCOUNT_NOT_FOUND,
        // No `conflictMeans`: like `performance`, this endpoint declares no
        // 409. It reads closed history rather than the MT5 terminal, so an
        // offline terminal costs it nothing.
        //
        // Handed over whole; `queryStringOf` in `core/client.ts` drops the
        // undefined members.
        query: { from: args.from, to: args.to, reporting: args.reporting },
      });
      const shaped = shapeBreakdowns(parseBreakdowns(payload));

      return { text: formatBreakdowns(shaped, args), structured: shaped };
    },
  });
}
