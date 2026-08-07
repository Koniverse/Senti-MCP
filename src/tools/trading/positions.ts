import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { accountPath, type SentiClient } from '../../core/client.js';
import { parseOrThrow } from '../../core/parse.js';
import { registerReadTool } from '../../core/tool.js';

/**
 * Transcribed from `GET /api/v1/accounts/{accountId}/positions` in the live
 * OpenAPI document. Every field is required, but `sl` and `tp` are also
 * nullable — the live API is entitled to send either `null` or `0` for "not
 * set", and the two must render identically (see `price` below).
 */
export const PositionSchema = z.object({
  ticket: z.number(),
  symbol: z.string(),
  type: z.string(),
  volume: z.number(),
  priceOpen: z.number(),
  priceCurrent: z.number(),
  sl: z.number().nullable(),
  tp: z.number().nullable(),
  swap: z.number(),
  profit: z.number(),
  openTime: z.string(),
  magic: z.number(),
  comment: z.string(),
});

export type Position = z.infer<typeof PositionSchema>;

/** The response envelope, as the API sends it. */
const PositionsResponseSchema = z.object({
  positions: z.array(PositionSchema),
});

/**
 * The tool's advertised output. The API returns its array wrapped in
 * `{ positions: … }`, but this server speaks both protocol eras from one
 * process: a non-object `structuredContent` reaches 2025-era clients wrapped
 * as `{ result: … }` and 2026-era clients unwrapped. Naming the field keeps
 * one shape on both.
 */
export const PositionsOutputSchema = z.object({
  positions: z.array(PositionSchema),
  /** Empty when nothing was cut. Its presence never implies truncation. */
  notes: z.array(z.string()),
});

export function parsePositions(payload: unknown): Position[] {
  return parseOrThrow(PositionsResponseSchema, payload, 'position list').positions;
}

/**
 * Defensive bound. A normal account holds a handful of positions; this exists
 * so a pathological one cannot flood the model's context, not because the API
 * paginates — it does not.
 */
const MAX_ROWS = 200;

export function capPositions(positions: Position[]): { positions: Position[]; notes: string[] } {
  if (positions.length <= MAX_ROWS) return { positions, notes: [] };

  return {
    positions: positions.slice(0, MAX_ROWS),
    notes: [
      `Truncated: showing ${MAX_ROWS} of ${positions.length} positions, ordered as the API ` +
        'returned them. Senti does not paginate this endpoint, so the remainder is not ' +
        'retrievable through this tool.',
    ],
  };
}

/**
 * MT5 writes `0` into `sl`/`tp` to mean "not set"; the API may also send
 * `null` for the same thing. Zero is not a price here, and null renders
 * identically to zero — the code never needs to distinguish them.
 */
const NO_VALUE = '—';

function price(value: number | null): string {
  return value === 0 || value === null ? NO_VALUE : String(value);
}

function money(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function block(position: Position): string {
  const lines = [
    `- ${position.symbol} ${position.type} ${position.volume} lots — ticket ${position.ticket}`,
    `  open ${position.priceOpen} → current ${position.priceCurrent} · ` +
      `SL ${price(position.sl)} · TP ${price(position.tp)}`,
    `  profit ${money(position.profit)} · swap ${money(position.swap)} · opened ${position.openTime}`,
  ];

  if (position.comment) lines.push(`  comment: ${position.comment}`);

  return lines.join('\n');
}

export function formatPositions(positions: Position[], notes: string[]): string {
  const trailer = notes.length > 0 ? `\n\n${notes.join('\n')}` : '';

  if (positions.length === 0) {
    // This sentence is the whole point of the 409 branch existing. An offline
    // terminal returns 409, so reaching this line means the terminal answered
    // and the account genuinely holds nothing.
    return (
      'No open positions on this account. The MT5 terminal answered, so this is a real ' +
      'zero — an offline terminal would have returned an error saying so instead.' +
      trailer
    );
  }

  const noun = positions.length === 1 ? 'position' : 'positions';
  const blocks = positions.map(block).join('\n\n');
  const total = positions.reduce((sum, position) => sum + position.profit, 0);

  return `${positions.length} open ${noun} · floating P&L ${money(total)}.\n\n${blocks}${trailer}`;
}

/** The scope this endpoint requires, quoted back in the 403 message. */
const TRADING_READ = 'trading:read';

/**
 * What a 409 means here. The API declares it as "The account terminal is
 * offline — positions are temporarily unavailable", which is the one failure
 * a model must not read as "no open positions".
 */
const TERMINAL_OFFLINE =
  'The MT5 terminal for this account is offline, so its live positions cannot be read ' +
  'right now. This is NOT the same as the account holding no positions — any open ' +
  'positions are still open and still carrying risk.';

export function registerListPositions(server: McpServer, client: SentiClient): void {
  registerReadTool(server, {
    name: 'list_positions',
    title: 'List open positions on an account',
    description:
      'List the positions currently open on one MT5 account, read live from the terminal: ' +
      'symbol, direction, volume, open and current price, stop loss, take profit, swap and ' +
      'floating profit. `accountId` is the `id` field from list_accounts — NOT `login`. ' +
      "Each position's `ticket` is the handle used to close it. An `sl` or `tp` of 0 means " +
      'no stop loss or take profit is set.',
    inputSchema: z.object({
      accountId: z
        .string()
        .describe('The `id` field from list_accounts. Not the `login` (MT5 account number).'),
    }),
    outputSchema: PositionsOutputSchema,
    run: async (args, signal) => {
      const payload = await client.get(accountPath(args.accountId, 'positions'), {
        signal,
        scope: TRADING_READ,
        conflictMeans: TERMINAL_OFFLINE,
      });
      const { positions, notes } = capPositions(parsePositions(payload));

      return { text: formatPositions(positions, notes), structured: { positions, notes } };
    },
  });
}
