import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { accountPath, type SentiClient } from '../../core/client.js';
import { parseOrThrow } from '../../core/parse.js';
import { registerReadTool } from '../../core/tool.js';

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

/** The scope this endpoint requires, quoted back in the 403 message. */
const STRATEGIES_READ = 'strategies:read';

export function registerListAccountStrategies(server: McpServer, client: SentiClient): void {
  registerReadTool(server, {
    name: 'list_account_strategies',
    title: 'List strategies deployed on an account',
    description:
      'List the strategies (expert advisors) currently deployed on one MT5 account, with ' +
      "each deployment's symbol, timeframe and status. `accountId` is the `id` field from " +
      'list_accounts — NOT `login`, which is the MT5 account number and is not a valid ' +
      'accountId. For the platform-wide catalog of strategies available to deploy, use ' +
      'list_strategies instead.',
    inputSchema: z.object({
      accountId: z
        .string()
        .describe('The `id` field from list_accounts. Not the `login` (MT5 account number).'),
    }),
    outputSchema: AccountStrategiesOutputSchema,
    run: async (args, signal) => {
      const payload = await client.get(accountPath(args.accountId, 'strategies'), {
        signal,
        scope: STRATEGIES_READ,
      });
      const strategies = parseAccountStrategies(payload);

      return { text: formatAccountStrategies(strategies), structured: { strategies } };
    },
  });
}
