import * as z from 'zod/v4';
import { parseOrThrow } from '../../core/parse.js';

/**
 * Transcribed from `GET /api/v1/accounts/{accountId}/strategies` in the live
 * OpenAPI document. Every field is required; only `chartId` is nullable.
 */
export const AccountStrategySchema = z.object({
  id: z.string(),
  mt5AccountId: z.string(),
  eaDefinitionId: z.string(),
  symbol: z.string(),
  timeframe: z.string(),
  status: z.string(),
  chartId: z.string().nullable(),
  eaDefinition: z.object({ name: z.string() }),
  mt5Account: z.object({
    id: z.string(),
    login: z.string(),
    label: z.string().nullable(),
  }),
});

export type AccountStrategy = z.infer<typeof AccountStrategySchema>;

/**
 * The tool's advertised output. The API returns a bare array, but this server
 * speaks both protocol eras from one process: a non-object `structuredContent`
 * reaches 2025-era clients wrapped as `{ result: … }` and 2026-era clients
 * unwrapped. Naming the field keeps one shape on both.
 */
export const AccountStrategiesOutputSchema = z.object({
  strategies: z.array(AccountStrategySchema),
});

export function parseAccountStrategies(payload: unknown): AccountStrategy[] {
  return parseOrThrow(z.array(AccountStrategySchema), payload, 'deployed-strategy list');
}

function block(deployed: AccountStrategy): string {
  return [
    `- ${deployed.eaDefinition.name} on ${deployed.symbol} ${deployed.timeframe} — ${deployed.status}`,
    // `id` is what POST …/strategies/{activeEaId}/stop takes. Naming it as
    // `activeEaId` here stops a model reaching for `eaDefinitionId`, which is
    // the catalog entry and cannot be stopped.
    `  activeEaId: ${deployed.id} · eaDefinitionId: ${deployed.eaDefinitionId}`,
  ].join('\n');
}

export function formatAccountStrategies(strategies: AccountStrategy[]): string {
  if (strategies.length === 0) {
    return (
      'No strategies are deployed on this account. This is a real zero rather than a ' +
      'failure — the account exists and was readable. Use list_strategies to see what ' +
      'is available to deploy.'
    );
  }

  const noun = strategies.length === 1 ? 'strategy' : 'strategies';
  const blocks = strategies.map(block).join('\n\n');

  return `${strategies.length} ${noun} deployed on this account.\n\n${blocks}`;
}
