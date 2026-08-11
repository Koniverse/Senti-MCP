import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { ACCOUNT_NOT_FOUND, accountPath, type SentiClient } from '../../core/client.js';
import { parseOrThrow } from '../../core/parse.js';
import { registerReadTool } from '../../core/tool.js';

/**
 * Transcribed from `GET /api/v1/accounts/{accountId}/deals` in the live
 * OpenAPI document. All fifteen members are required and — unlike `positions`
 * and `orders` — not one of them is nullable, so nothing in a deal record
 * renders as an em dash.
 *
 * No field here shares the MT5 `0`-means-unset convention `positions.ts`'s
 * `price()` exists for either. A deal is a completed event: `commission`,
 * `fee`, `swap` and `profit` of 0 mean the event cost or earned nothing, which
 * is a real zero and must render as one. `magic` of 0 is the single value with
 * a second meaning — no expert advisor placed this deal — and it is rendered
 * as "manual" rather than dashed, because MT5 assigns 0 to every hand-placed
 * trade. Confirmed against a live read of 500 deals on 2026-08-11: `price` was
 * never 0, and the magic numbers present were 0, 25 and 39.
 */
export const DealSchema = z.object({
  ticket: z.number(),
  positionId: z.number(),
  orderId: z.number(),
  magic: z.number(),
  symbol: z.string(),
  type: z.string(),
  /**
   * Enumerated by the API, and left enumerated here: these four are MT5's
   * complete `DEAL_ENTRY` set, so this is the API's own closed contract rather
   * than a list this server invented — the distinction `accountPath`'s
   * `PATH_SEGMENT` comment draws. `IN` opens, `OUT` closes, `INOUT` reverses,
   * `OUT_BY` closes against an opposite position.
   *
   * Note the case: the response says `IN`/`OUT`, the `entry` query parameter
   * takes `in`/`out`. Feeding one back as the other is a 400.
   */
  entry: z.enum(['IN', 'OUT', 'INOUT', 'OUT_BY']),
  volume: z.number(),
  price: z.number(),
  commission: z.number(),
  fee: z.number(),
  swap: z.number(),
  profit: z.number(),
  comment: z.string(),
  time: z.string(),
});

export type Deal = z.infer<typeof DealSchema>;

/**
 * The response envelope, as the API sends it.
 *
 * `nextCursor` and `syncedThrough` are declared required and nullable. They are
 * accepted as absent as well: an absent cursor already means what a null one
 * means — there is no next page — so failing the whole read over a missing key
 * would turn the last page into an error.
 */
const DealsResponseSchema = z.object({
  deals: z.array(DealSchema),
  nextCursor: z.string().nullish(),
  syncedThrough: z.string().nullish(),
});

/**
 * One page, with `undefined` normalized to `null` so the rest of the module
 * has one absent-value to test against.
 */
export type DealPage = {
  deals: Deal[];
  /** Opaque. Pass it back as `cursor` for the next page; null on the last. */
  nextCursor: string | null;
  /** How far the warehouse has ingested. Null when the API does not say. */
  syncedThrough: string | null;
};

/**
 * The tool's advertised output: the page in full.
 *
 * Every other tool that can shrink a payload carries a `string[]` alongside it
 * recording what it dropped. This one carries no such field, deliberately: it
 * removes nothing from what the API returned, so it has nothing to record.
 * Its payload is bounded by `limit` — a bound the caller chose and the input
 * schema enforces, which is not a truncation the caller must be warned about.
 * Paginating is not cutting (design spec §Payload policy).
 */
export const DealsOutputSchema = z.object({
  deals: z.array(DealSchema),
  nextCursor: z.string().nullable(),
  syncedThrough: z.string().nullable(),
});

export function parseDeals(payload: unknown): DealPage {
  const page = parseOrThrow(DealsResponseSchema, payload, 'deal page');

  return {
    deals: page.deals,
    nextCursor: page.nextCursor ?? null,
    syncedThrough: page.syncedThrough ?? null,
  };
}

/**
 * This tool's default page size, not the API's — the document declares 100.
 * Fifty deals is a readable answer to "show me my trade history"; a hundred is
 * a page of context spent before the model has decided the first fifty were
 * the wrong fifty. It is sent explicitly on every call so the URL states the
 * bound rather than inheriting one that can change under us.
 */
const DEFAULT_LIMIT = 50;

/** The API's declared ceiling. Above it the API answers 400. */
const MAX_LIMIT = 500;

const ISO_FORMAT = 'ISO-8601';
const ISO_SHAPE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

/**
 * Shape *and* existence, for the reason `summary.ts`'s `isCalendarDate` gives:
 * the regex alone accepts `2026-02-31`, and the API answers that with a 400
 * about a query parameter, which sends the reader to look at the wrong thing.
 *
 * The calendar check runs on the date half alone, so it holds whatever offset
 * follows; the second check then rejects an impossible time such as `T25:00`.
 * Both a bare `2026-07-01` and a full `2026-07-01T00:00:00Z` are accepted —
 * the live API takes either.
 */
function isIsoTimestamp(value: string): boolean {
  if (!ISO_SHAPE.test(value)) return false;

  const day = value.slice(0, 10);
  const asDay = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(asDay.getTime()) || asDay.toISOString().slice(0, 10) !== day) return false;

  return !Number.isNaN(new Date(value.length === 10 ? `${value}T00:00:00Z` : value).getTime());
}

const windowBound = (bound: string) =>
  z
    .string()
    .refine(
      isIsoTimestamp,
      `must be an ${ISO_FORMAT} timestamp — for example 2026-05-01 or 2026-05-01T09:30:00Z`,
    )
    .describe(`Window ${bound} (${ISO_FORMAT}). Omit for no bound on this side.`);

export const DealsInputSchema = z.object({
  accountId: z
    .string()
    .describe('The `id` field from list_accounts. Not the `login` (MT5 account number).'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_LIMIT)
    .default(DEFAULT_LIMIT)
    .describe(
      `Deals per page, 1 to ${MAX_LIMIT}. Defaults to ${DEFAULT_LIMIT}. One call returns ` +
        'one page; it is never a total.',
    ),
  cursor: z
    .string()
    .describe(
      'The `nextCursor` from a previous call to this tool, to retrieve the page after it. ' +
        'Omit for the first page. Opaque — do not construct or edit one.',
    )
    .optional(),
  entry: z
    .enum(['in', 'out'])
    .describe(
      'Narrow to opening deals (`in`) or closing deals (`out`). Lowercase — the `entry` ' +
        'field in the response is uppercase and is not valid here. Omit for both.',
    )
    .optional(),
  from: windowBound('start').optional(),
  to: windowBound('end').optional(),
});

export type DealQuery = {
  limit: number;
  cursor?: string;
  entry?: 'in' | 'out';
  from?: string;
  to?: string;
};

function money(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * MT5 writes 0 into `magic` for a trade no expert advisor placed. Unlike an
 * unset price this is a fact worth stating, so it is named rather than hidden.
 */
function placedBy(magic: number): string {
  return magic === 0 ? 'manual' : `magic ${magic}`;
}

function block(deal: Deal): string {
  const lines = [
    `- ${deal.time} · ${deal.symbol} ${deal.type} ${deal.entry} ${deal.volume} lots ` +
      `at ${deal.price} — ticket ${deal.ticket}`,
  ];

  // Costs are printed as a group and only when the group carries a figure. All
  // three at zero says nothing a reader can act on, and this line repeats under
  // every one of up to 500 deals. `profit` is never suppressed the same way: a
  // realized 0.00 is the answer to "what did this trade make", and an opening
  // deal is genuinely 0.00 until its closing deal settles it.
  const costs =
    deal.commission !== 0 || deal.swap !== 0 || deal.fee !== 0
      ? ` · commission ${money(deal.commission)} · swap ${money(deal.swap)} · ` +
        `fee ${money(deal.fee)}`
      : '';

  lines.push(
    `  profit ${money(deal.profit)}${costs} · position ${deal.positionId} · ` +
      `order ${deal.orderId} · ${placedBy(deal.magic)}`,
  );

  if (deal.comment) lines.push(`  comment: ${deal.comment}`);

  return lines.join('\n');
}

/** What the caller asked for, said back, because the response echoes none of it. */
function filtersOf(query: DealQuery): string {
  const parts: string[] = [];

  if (query.entry === 'in') parts.push('opening deals only');
  if (query.entry === 'out') parts.push('closing deals only');
  if (query.from && query.to) parts.push(`${query.from} → ${query.to}`);
  else if (query.from) parts.push(`from ${query.from}`);
  else if (query.to) parts.push(`up to ${query.to}`);

  return parts.length > 0 ? ` — ${parts.join(', ')}` : '';
}

/**
 * The pagination sentence, and the one AC-4 and AC-5 turn on. A model that has
 * to open `structuredContent` to learn whether it saw everything will not, so
 * the two cases read differently in the text and the cursor itself is quoted:
 * many clients surface `content` alone.
 */
function pageStatus(page: DealPage, query: DealQuery): string {
  if (page.nextCursor === null) {
    // "after these" would refer to nothing on an empty page, which is the one
    // case where the two sentences have to differ.
    return page.deals.length === 0
      ? 'This is the last page — there is nothing further to request.'
      : 'This is the last page — there are no more deals after these, within the requested ' +
          'window and filter.';
  }

  return (
    `More deals are available. This tool read one page and stopped; it never follows a ` +
    `cursor on its own. To retrieve the next ${query.limit}, call list_deals again with ` +
    `cursor="${page.nextCursor}" and the same window and filter.`
  );
}

/**
 * Said whenever the API tells us. The endpoint is warehouse-backed rather than
 * a live terminal read, so a deal closed after this instant is not in the
 * answer yet — the difference between "you have no trades today" and "today
 * has not been ingested yet".
 */
function freshness(page: DealPage): string {
  return page.syncedThrough === null
    ? ''
    : ` Deal history is ingested up to ${page.syncedThrough}; anything closed after that is ` +
        'not in this answer yet.';
}

export function formatDeals(page: DealPage, query: DealQuery): string {
  const { deals } = page;
  const filters = filtersOf(query);

  if (deals.length === 0) {
    // No 409 branch exists on this endpoint — it reads a warehouse, not the
    // MT5 terminal — so unlike `positions.ts` the real-zero sentence cannot
    // lean on "an offline terminal would have said so". It leans on the 200
    // instead, and names the filter, which is the likelier cause of an empty
    // page than an account that has never traded.
    return (
      `No deals on this account${filters}. The request succeeded, so this is a real zero, ` +
      'not a failed or truncated read — the account has no matching deal history. Widen or ' +
      `drop \`from\`, \`to\` and \`entry\` to search further back.${freshness(page)}\n\n` +
      pageStatus(page, query)
    );
  }

  const noun = deals.length === 1 ? 'deal' : 'deals';
  const realized = deals.reduce((sum, deal) => sum + deal.profit, 0);

  return (
    `${deals.length} ${noun} on this page${filters}. Realized P&L across these ` +
    `${deals.length} — not the account's total, which get_account_performance reports — ` +
    `${money(realized)}.${freshness(page)}\n\n` +
    `${deals.map(block).join('\n\n')}\n\n` +
    pageStatus(page, query)
  );
}

/** The scope this endpoint requires, quoted back in the 403 message. */
const TRADING_READ = 'trading:read';

export function registerListDeals(server: McpServer, client: SentiClient): void {
  registerReadTool(server, {
    name: 'list_deals',
    title: 'List deal history for an account',
    description:
      'List the closed deal history of one MT5 account — the fills that already happened, ' +
      'newest first: symbol, direction, entry kind, volume, price, realized profit, costs ' +
      'and time. For what is open right now use list_positions, and for orders still ' +
      'resting use list_pending_orders. For totals and ratios over a period use ' +
      'get_account_performance rather than adding these rows up. `accountId` is the `id` ' +
      `field from list_accounts — NOT \`login\`. This endpoint is paginated: \`limit\` ` +
      `defaults to ${DEFAULT_LIMIT} and may not exceed ${MAX_LIMIT}, and one call returns ` +
      'exactly one page. If the answer reports that more deals are available, it also ' +
      'reports a cursor — you must call this tool again passing that value as `cursor` to ' +
      'read the next page. This tool never pages on its own. Narrow instead of paging ' +
      'where you can: `entry` takes lowercase `in` (opening) or `out` (closing), and ' +
      '`from`/`to` take ISO-8601 timestamps.',
    inputSchema: DealsInputSchema,
    outputSchema: DealsOutputSchema,
    run: async (args, signal) => {
      const payload = await client.get(accountPath(args.accountId, 'deals'), {
        signal,
        scope: TRADING_READ,
        notFoundMeans: ACCOUNT_NOT_FOUND,
        // No `conflictMeans`: this endpoint declares no 409. It reads a
        // warehouse rather than the MT5 terminal, so an offline terminal
        // costs it freshness, not availability — `syncedThrough` is where
        // that shows up. Copying US-2.8's call shape wholesale would have
        // added a branch the API never takes.
        //
        // Handed over whole; `queryStringOf` in `core/client.ts` drops the
        // undefined members. `limit` is never undefined — the input schema
        // defaults it — so it is always on the URL.
        query: {
          limit: args.limit,
          cursor: args.cursor,
          entry: args.entry,
          from: args.from,
          to: args.to,
        },
      });
      const page = parseDeals(payload);

      // One `client.get`, one page, whatever `nextCursor` holds. There is no
      // loop here and there must not be one: draining a cursor turns a single
      // question into an unbounded number of requests against a rate-limited
      // API. The model receives the cursor and decides.
      return { text: formatDeals(page, args), structured: page };
    },
  });
}
