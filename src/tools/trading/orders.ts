import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { ACCOUNT_NOT_FOUND, accountPath, type SentiClient } from '../../core/client.js';
import { parseOrThrow } from '../../core/parse.js';
import { registerReadTool } from '../../core/tool.js';

/**
 * Transcribed from `GET /api/v1/accounts/{accountId}/orders` in the live
 * OpenAPI document. Every field is required, but `sl`, `tp` and
 * `priceStopLimit` are also nullable — the live API is entitled to send
 * either `null` or `0` for "not set", and both must render identically (see
 * `price` below).
 */
export const OrderSchema = z.object({
  ticket: z.number(),
  symbol: z.string(),
  type: z.string(),
  volume: z.number(),
  priceOpen: z.number(),
  sl: z.number().nullable(),
  tp: z.number().nullable(),
  timeSetup: z.string(),
  priceStopLimit: z.number().nullable(),
  magic: z.number(),
  comment: z.string(),
});

export type Order = z.infer<typeof OrderSchema>;

/** The response envelope, as the API sends it. */
const OrdersResponseSchema = z.object({
  orders: z.array(OrderSchema),
});

/**
 * The tool's advertised output. The API returns its array wrapped in
 * `{ orders: … }`, but this server speaks both protocol eras from one
 * process: a non-object `structuredContent` reaches 2025-era clients wrapped
 * as `{ result: … }` and 2026-era clients unwrapped. Naming the field keeps
 * one shape on both.
 */
export const OrdersOutputSchema = z.object({
  orders: z.array(OrderSchema),
  /** Empty when nothing was cut. Its presence never implies truncation. */
  notes: z.array(z.string()),
});

export function parseOrders(payload: unknown): Order[] {
  return parseOrThrow(OrdersResponseSchema, payload, 'order list').orders;
}

/**
 * Defensive bound. A normal account holds a handful of pending orders; this
 * exists so a pathological one cannot flood the model's context, not because
 * the API paginates — it does not.
 */
const MAX_ROWS = 200;

/** What the account holds, before any truncation. */
export type OrderTotals = {
  count: number;
};

export type CappedOrders = {
  orders: Order[];
  notes: string[];
  /** Derived from the full list, never from the slice above. */
  totals: OrderTotals;
};

export function capOrders(orders: Order[]): CappedOrders {
  const totals: OrderTotals = { count: orders.length };

  if (orders.length <= MAX_ROWS) return { orders, notes: [], totals };

  return {
    orders: orders.slice(0, MAX_ROWS),
    notes: [
      `Truncated: showing ${MAX_ROWS} of ${orders.length} orders, ordered as the API ` +
        'returned them. Senti does not paginate this endpoint, so the remainder is not ' +
        'retrievable through this tool.',
    ],
    totals,
  };
}

/**
 * MT5 writes `0` into `sl`/`tp`/`priceStopLimit` to mean "not set"; the API
 * may also send `null` for the same thing. Zero is not a price here, and
 * null renders identically to zero — the code never needs to distinguish
 * them.
 */
const NO_VALUE = '—';

function price(value: number | null): string {
  return value === 0 || value === null ? NO_VALUE : String(value);
}

function block(order: Order): string {
  const lines = [
    `- ${order.symbol} ${order.type} ${order.volume} lots at ${order.priceOpen} — ticket ${order.ticket}`,
    `  SL ${price(order.sl)} · TP ${price(order.tp)} · placed ${order.timeSetup}`,
  ];

  // Per US-2.9 AC-4, priceStopLimit deliberately omits its line rather than
  // rendering an em dash — unlike sl/tp, this line is absent, not dashed.
  if (order.priceStopLimit !== 0 && order.priceStopLimit !== null) {
    lines.push(`  stop-limit ${order.priceStopLimit}`);
  }
  if (order.comment) lines.push(`  comment: ${order.comment}`);

  return lines.join('\n');
}

export function formatOrders(orders: Order[], notes: string[], totals: OrderTotals): string {
  const trailer = notes.length > 0 ? `\n\n${notes.join('\n')}` : '';

  if (totals.count === 0) {
    // This sentence is the whole point of the 409 branch existing. An offline
    // terminal returns 409, so reaching this line means the terminal answered
    // and the account genuinely has nothing pending.
    return (
      'No pending orders on this account. The MT5 terminal answered, so this is a real ' +
      'zero — an offline terminal would have returned an error saying so instead.' +
      trailer
    );
  }

  const noun = totals.count === 1 ? 'order' : 'orders';
  const blocks = orders.map(block).join('\n\n');
  // Said in the header rather than only in the trailing note: the note sits
  // below 200 order blocks, and the header is what gets quoted back.
  const shown = orders.length < totals.count ? ` (showing the first ${orders.length})` : '';

  return `${totals.count} pending ${noun}${shown}.\n\n${blocks}${trailer}`;
}

/** The scope this endpoint requires, quoted back in the 403 message. */
const TRADING_READ = 'trading:read';

/** The API declares 409 here as "The account terminal is offline". */
const TERMINAL_OFFLINE =
  'The MT5 terminal for this account is offline, so its pending orders cannot be read ' +
  'right now. This is NOT the same as the account having no pending orders — any ' +
  'resting orders are still resting and may still trigger.';

export function registerListPendingOrders(server: McpServer, client: SentiClient): void {
  registerReadTool(server, {
    name: 'list_pending_orders',
    title: 'List pending orders on an account',
    description:
      'List the pending limit and stop orders resting on one MT5 account, read live from ' +
      'the terminal: symbol, order type, volume, trigger price, stop loss and take profit. ' +
      'These are orders that have NOT been filled — for filled positions currently open, ' +
      'use list_positions. `accountId` is the `id` field from list_accounts, NOT `login`. ' +
      "Each order's `ticket` is the handle used to cancel it. An `sl`, `tp` or " +
      '`priceStopLimit` of 0 means that level is not set.',
    inputSchema: z.object({
      accountId: z
        .string()
        .describe('The `id` field from list_accounts. Not the `login` (MT5 account number).'),
    }),
    outputSchema: OrdersOutputSchema,
    run: async (args, signal) => {
      const payload = await client.get(accountPath(args.accountId, 'orders'), {
        signal,
        scope: TRADING_READ,
        conflictMeans: TERMINAL_OFFLINE,
        notFoundMeans: ACCOUNT_NOT_FOUND,
      });
      const { orders, notes, totals } = capOrders(parseOrders(payload));

      return { text: formatOrders(orders, notes, totals), structured: { orders, notes } };
    },
  });
}
