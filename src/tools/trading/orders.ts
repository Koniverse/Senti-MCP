import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { accountPath, type SentiClient } from '../../core/client.js';
import { parseOrThrow } from '../../core/parse.js';
import { registerReadTool } from '../../core/tool.js';

/**
 * Transcribed from `GET /api/v1/accounts/{accountId}/orders` in the live
 * OpenAPI document. Every field is required and none is nullable.
 */
export const OrderSchema = z.object({
  ticket: z.number(),
  symbol: z.string(),
  type: z.string(),
  volume: z.number(),
  priceOpen: z.number(),
  sl: z.number(),
  tp: z.number(),
  timeSetup: z.string(),
  priceStopLimit: z.number(),
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

export function capOrders(orders: Order[]): { orders: Order[]; notes: string[] } {
  if (orders.length <= MAX_ROWS) return { orders, notes: [] };

  return {
    orders: orders.slice(0, MAX_ROWS),
    notes: [
      `Truncated: showing ${MAX_ROWS} of ${orders.length} orders, ordered as the API ` +
        'returned them. Senti does not paginate this endpoint, so the remainder is not ' +
        'retrievable through this tool.',
    ],
  };
}

/** MT5 writes `0` into `sl`/`tp`/`priceStopLimit` to mean "not set". Zero is not a price here. */
const NO_VALUE = '—';

function price(value: number): string {
  return value === 0 ? NO_VALUE : String(value);
}

function block(order: Order): string {
  const lines = [
    `- ${order.symbol} ${order.type} ${order.volume} lots at ${order.priceOpen} — ticket ${order.ticket}`,
    `  SL ${price(order.sl)} · TP ${price(order.tp)} · placed ${order.timeSetup}`,
  ];

  if (order.priceStopLimit !== 0) lines.push(`  stop-limit ${order.priceStopLimit}`);
  if (order.comment) lines.push(`  comment: ${order.comment}`);

  return lines.join('\n');
}

export function formatOrders(orders: Order[], notes: string[]): string {
  const trailer = notes.length > 0 ? `\n\n${notes.join('\n')}` : '';

  if (orders.length === 0) {
    // This sentence is the whole point of the 409 branch existing. An offline
    // terminal returns 409, so reaching this line means the terminal answered
    // and the account genuinely has nothing pending.
    return (
      'No pending orders on this account. The MT5 terminal answered, so this is a real ' +
      'zero — an offline terminal would have returned an error saying so instead.' +
      trailer
    );
  }

  const noun = orders.length === 1 ? 'order' : 'orders';
  const blocks = orders.map(block).join('\n\n');

  return `${orders.length} pending ${noun}.\n\n${blocks}${trailer}`;
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
      });
      const { orders, notes } = capOrders(parseOrders(payload));

      return { text: formatOrders(orders, notes), structured: { orders, notes } };
    },
  });
}
