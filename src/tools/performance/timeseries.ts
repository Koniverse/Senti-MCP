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
 * Transcribed from `GET /api/v1/accounts/{accountId}/performance/timeseries`
 * in the live OpenAPI document, re-read 2026-08-12 (TASK-2.13.1). All four
 * members of a point are required there and none is nullable.
 *
 * `drawdownPct` is a percentage and the document does not settle its sign —
 * see {@link deepestDrawdownIndex}, which is why that matters.
 */
const PointSchema = z.object({
  /** Epoch milliseconds. */
  timeMs: z.number(),
  balance: z.number(),
  equity: z.number(),
  drawdownPct: z.number(),
});

/** One reconstructed observation of the equity curve. */
export type TimeseriesPoint = z.infer<typeof PointSchema>;

/**
 * The API's own statement about what its numbers do not mean: which account's
 * equity or drawdown could not be reconstructed, and which fell back to
 * balance-only. Every flag is required.
 */
const CaveatsSchema = z.object({
  equityUnavailable: z.boolean(),
  drawdownUnavailable: z.boolean(),
  balanceOnly: z.boolean(),
  isSoftDeleted: z.boolean(),
});

export type Caveats = z.infer<typeof CaveatsSchema>;

export const TimeseriesSchema = z.object({
  portfolio: z.array(PointSchema),
  /**
   * The one block this tool drops whole, and deliberately `unknown` rather
   * than transcribed. The endpoint is scoped to a single account, so this map
   * holds that account and nothing else — a per-account restatement of
   * `portfolio`.
   *
   * `parse.ts` validates all-or-nothing so that malformed data never reaches
   * the model. Data this tool discards never reaches the model whatever shape
   * it arrives in, so validating it would only convert an upstream change in
   * a block nobody reads into an outage for the blocks everybody does —
   * `breakdowns.ts` makes the same trade for the same block.
   */
  perAccount: z.unknown(),
  /** Keyed by account login. Returned in full — never shaped. */
  caveats: z.record(z.string(), CaveatsSchema),
  portfolioCaveats: CaveatsSchema,
});

export type Timeseries = z.infer<typeof TimeseriesSchema>;

export function parseTimeseries(payload: unknown): Timeseries {
  return parseOrThrow(TimeseriesSchema, payload, 'equity timeseries');
}

/**
 * How many points survive the cut, regardless of how wide a window was asked
 * for. The bound is on the size of the answer, not on the range of the
 * question — a year and a day both come back at 200 points or fewer.
 *
 * Not a tool parameter. A `maxPoints` argument lets a model ask for the
 * unshaped series and reintroduces exactly the payload weight this exists to
 * prevent; a narrower `from`/`to` is the supported way to get finer
 * resolution, and the note below says so.
 */
export const MAX_POINTS = 200;

/**
 * The index of the deepest drawdown, by magnitude.
 *
 * The OpenAPI document declares `drawdownPct` a bare `number` and does not
 * settle its sign, so this ranks on absolute value: under either convention a
 * peak is 0 and a trough is the largest magnitude, and a rule that assumed the
 * sign would silently pin a *peak* the day the API flipped it. Ties go to the
 * earliest point, so the same series always yields the same answer.
 */
function deepestDrawdownIndex(points: TimeseriesPoint[]): number {
  let deepest = 0;
  let depth = -1;

  for (const [index, point] of points.entries()) {
    const magnitude = Math.abs(point.drawdownPct);
    if (magnitude > depth) {
      depth = magnitude;
      deepest = index;
    }
  }

  return deepest;
}

/**
 * Reduce a series to at most `max` real observations, always keeping the first
 * point, the last point, and the deepest drawdown.
 *
 * The obvious implementation — every Nth point — is wrong in a way that reads
 * as right: on most windows it drops the trough of the deepest drawdown and the
 * final point, producing a curve that is smoother and shallower than what
 * happened. That is the same class of error as rendering a null balance as `0`,
 * and it fails in the direction that flatters the account.
 *
 * So this samples evenly and then *repairs* the sample: if the trough is not
 * already in it, the nearest interior sample is evicted to make room. The
 * perturbation is local — one neighbourhood of the curve is sampled slightly
 * off-stride — and the three points a trader actually asks about are exact.
 *
 * Every returned point is an element of `points`. Nothing is interpolated: a
 * synthesized point would be indistinguishable from a real observation once it
 * reaches a model's context.
 *
 * `max` is assumed to be at least 3 — fewer cannot hold the three pinned
 * points. {@link MAX_POINTS} is the only value used in production.
 */
export function downsample(points: TimeseriesPoint[], max: number): TimeseriesPoint[] {
  if (points.length <= max) return points;

  const last = points.length - 1;
  const kept = new Set<number>();

  // Endpoints included by construction: i = 0 gives 0 and i = max - 1 gives
  // `last`. Because `points.length > max`, the stride exceeds 1 and no two
  // rounded indices collide, so this contributes exactly `max` of them.
  for (let i = 0; i < max; i += 1) kept.add(Math.round((i * last) / (max - 1)));

  const trough = deepestDrawdownIndex(points);

  if (!kept.has(trough)) {
    const evictable = [...kept].filter((index) => index !== 0 && index !== last);
    const nearest = evictable.reduce((best, index) =>
      Math.abs(index - trough) < Math.abs(best - trough) ? index : best,
    );

    kept.delete(nearest);
    kept.add(trough);
  }

  return [...kept]
    .sort((left, right) => left - right)
    .flatMap((index) => {
      const point = points[index];
      return point ? [point] : [];
    });
}

/**
 * The tool's advertised output, and a record of the one cut it makes in its own
 * right: `perAccount` has no member here, and `portfolio` may be shorter than
 * the API sent.
 *
 * `caveats` and `portfolioCaveats` are declared exactly as the API declares
 * them. They are the API's own statements about what its numbers do not mean —
 * precisely the content a tool whose job is to summarize must not summarize.
 *
 * Flat rather than wrapped, for the reason `summary.ts` gives: the API hands
 * this one an object already.
 */
export const TimeseriesOutputSchema = z.object({
  portfolio: z.array(PointSchema),
  caveats: z.record(z.string(), CaveatsSchema),
  portfolioCaveats: CaveatsSchema,
  /**
   * What was cut and how to ask for the rest — empty when nothing was.
   *
   * Only a cut that loses information earns a line, which is why dropping
   * `perAccount` leaves none: it restated a series that is still here.
   */
  notes: z.array(z.string()),
});

export type ShapedTimeseries = z.infer<typeof TimeseriesOutputSchema>;

function count(value: number): string {
  return value.toLocaleString('en-US');
}

/**
 * Every cut, in one place, and the only function that decides what the model
 * sees. The `perAccount` cut is the absence of that member from what is
 * returned below.
 */
export function shapeTimeseries(timeseries: Timeseries): ShapedTimeseries {
  const portfolio = downsample(timeseries.portfolio, MAX_POINTS);
  const original = timeseries.portfolio.length;

  const note =
    portfolio.length === original
      ? null
      : `Resolution was cut: the API returned ${count(original)} points over this window and ` +
        `this answer keeps ${count(portfolio.length)}, sampled evenly. The first point, the ` +
        'last point and the point of deepest drawdown are retained exactly, so where the ' +
        'series started, where it ended and how deep the worst drawdown went are real ' +
        'observations rather than samples taken near them. Detail between the kept points is ' +
        'gone, and a shorter move between two of them is not visible here — narrow ' +
        '`from`/`to` for finer resolution; there is no option to request the unshaped series.';

  return {
    portfolio,
    // Untouched, on purpose. See `TimeseriesOutputSchema`.
    caveats: timeseries.caveats,
    portfolioCaveats: timeseries.portfolioCaveats,
    notes: note === null ? [] : [note],
  };
}

function money(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** A signed figure, because "did this account grow" turns on the sign. */
function signed(value: number): string {
  return value > 0 ? `+${money(value)}` : money(value);
}

function day(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

/**
 * One caveat block in prose, in full — every flag the API raised, and nothing
 * inferred from the ones it did not.
 *
 * Rendered rather than counted. These are the API's own qualifications on its
 * numbers, so a summary here ("2 accounts flagged") would leave a model quoting
 * an equity curve the API already said it could not reconstruct.
 */
function caveatPhrases(caveats: Caveats): string[] {
  const phrases: string[] = [];

  if (caveats.equityUnavailable) phrases.push('equity could not be reconstructed');
  if (caveats.drawdownUnavailable) phrases.push('drawdown could not be reconstructed');
  if (caveats.balanceOnly) phrases.push('reconstructed from balance only, without equity');
  if (caveats.isSoftDeleted) phrases.push('the account is soft-deleted');

  return phrases;
}

function caveatBlock(shaped: ShapedTimeseries): string {
  const lines: string[] = [];

  const portfolio = caveatPhrases(shaped.portfolioCaveats);
  if (portfolio.length > 0) lines.push(`- This series: ${portfolio.join('; ')}.`);

  for (const [login, caveats] of Object.entries(shaped.caveats)) {
    const phrases = caveatPhrases(caveats);
    if (phrases.length > 0) lines.push(`- Account ${login}: ${phrases.join('; ')}.`);
  }

  if (lines.length === 0) {
    return 'Caveats: none — the API flagged nothing about how these figures were reconstructed.';
  }

  return (
    "Caveats (the API's own statements about how these figures were reconstructed — they " +
    `qualify every number above):\n${lines.join('\n')}`
  );
}

function seriesBlock(portfolio: ShapedTimeseries['portfolio']): string {
  const first = portfolio[0];
  const last = portfolio[portfolio.length - 1];

  if (!first || !last) {
    return 'Series: no point in this window. The request succeeded, so this is a real absence ' +
      'of data rather than a truncated read.';
  }

  // The same rule the downsample pinned on, not a second one — and exact
  // rather than approximate, because `downsample` guarantees the real trough
  // is among the points this searches.
  const trough = portfolio[deepestDrawdownIndex(portfolio)] ?? first;

  return (
    `Series: ${count(portfolio.length)} point(s) from ${day(first.timeMs)} to ` +
    `${day(last.timeMs)}\n` +
    `  Started ${money(first.equity)} equity · ended ${money(last.equity)} · ` +
    `change ${signed(last.equity - first.equity)}\n` +
    `  Deepest drawdown ${Math.abs(trough.drawdownPct).toFixed(2)}% on ${day(trough.timeMs)} ` +
    `(equity ${money(trough.equity)}, balance ${money(trough.balance)})\n` +
    "  The point-by-point series is in this result's structured content."
  );
}

/**
 * `notes` reaches the model through the text as well as through
 * `structuredContent`, because many hosts surface `content` alone. A downsample
 * a reader never learns about is how a thinned curve becomes a confident, wrong
 * statement about how an account actually moved.
 */
export function formatTimeseries(shaped: ShapedTimeseries, window: PerformanceWindow): string {
  const currency = window.reporting ?? DEFAULT_CURRENCY;

  const sections = [
    `Equity and drawdown over ${windowOf(window)}, in ${currency}. This response is shaped — ` +
      'a wide window returns more points than an answer can carry, so the series is ' +
      'downsampled; anything cut is listed under Notes below. For whole-account totals and ' +
      'ratios use get_account_performance.',
    seriesBlock(shaped.portfolio),
    caveatBlock(shaped),
  ];

  if (shaped.notes.length > 0) {
    sections.push(`Notes:\n${shaped.notes.map((note) => `- ${note}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

/** The scope this endpoint requires, quoted back in the 403 message. */
const PERFORMANCE_READ = 'performance:read';

export function registerGetEquityTimeseries(server: McpServer, client: SentiClient): void {
  registerReadTool(server, {
    name: 'get_equity_timeseries',
    title: 'Track an account\'s equity curve and drawdown over time',
    description:
      'Return the reconstructed equity curve and floating drawdown for one MT5 account over a ' +
      'date window, as a series of points. Use it for "how has my equity moved" or "what was ' +
      'my worst drawdown". For a single whole-account figure — net P&L, win rate, ROI — use ' +
      'get_account_performance; for a breakdown by day, symbol or hour use ' +
      'get_performance_breakdowns. THIS RESPONSE IS SHAPED. A wide window holds more points ' +
      'than an answer can carry, so the series is downsampled to at most ' +
      `${MAX_POINTS} points — but the first point, the last point and the point of deepest ` +
      'drawdown are always retained, so the start, the end and the worst of the curve are ' +
      'exact rather than approximate. Every downsample is recorded in `notes`, which is empty ' +
      'when the series was short enough to return whole. A short move between two kept points ' +
      'may not be visible; narrow `from`/`to` for finer resolution. `caveats` and ' +
      '`portfolioCaveats` are the API\'s own statements about figures it could not fully ' +
      'reconstruct — read them before quoting a number. `accountId` is the `id` field from ' +
      'list_accounts — NOT `login`. Omit `from`/`to` for the last 30 days. `reporting` is an ' +
      'ISO-4217 currency code (default USD), not a reporting period.',
    inputSchema: PerformanceInputSchema,
    outputSchema: TimeseriesOutputSchema,
    run: async (args, signal) => {
      const payload = await client.get(accountPath(args.accountId, 'performance', 'timeseries'), {
        signal,
        scope: PERFORMANCE_READ,
        notFoundMeans: ACCOUNT_NOT_FOUND,
        // No `conflictMeans`: like `performance` and `breakdowns`, this
        // endpoint declares no 409. It reconstructs closed history rather than
        // reading the MT5 terminal, so an offline terminal costs it nothing.
        //
        // Handed over whole; `queryStringOf` in `core/client.ts` drops the
        // undefined members.
        query: { from: args.from, to: args.to, reporting: args.reporting },
      });
      const shaped = shapeTimeseries(parseTimeseries(payload));

      return { text: formatTimeseries(shaped, args), structured: shaped };
    },
  });
}
