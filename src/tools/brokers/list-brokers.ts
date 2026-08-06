import * as z from 'zod/v4';
import { parseOrThrow } from '../../core/parse.js';

const AccountTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  defaultSymbol: z.string(),
});

/**
 * Transcribed from `GET /api/v1/brokers` in the live OpenAPI document. Every
 * field is required and none is nullable — unusually simple for this API, and
 * worth stating so a future reader does not add `.nullable()` defensively.
 */
export const BrokerSchema = z.object({
  id: z.string(),
  name: z.string(),
  servers: z.array(z.string()),
  accountTypes: z.array(AccountTypeSchema),
});

export type Broker = z.infer<typeof BrokerSchema>;

/**
 * The tool's advertised output. The API returns a bare array, but this server
 * speaks both protocol eras from one process: a non-object `structuredContent`
 * reaches 2025-era clients wrapped as `{ result: … }` and 2026-era clients
 * unwrapped. Naming the field keeps one shape on both.
 */
export const BrokersOutputSchema = z.object({
  brokers: z.array(BrokerSchema),
});

export function parseBrokers(payload: unknown): Broker[] {
  return parseOrThrow(z.array(BrokerSchema), payload, 'broker list');
}

function block(broker: Broker): string {
  const servers = broker.servers.length > 0 ? broker.servers.join(', ') : '—';
  const types =
    broker.accountTypes.length > 0
      ? broker.accountTypes
          .map((type) => `${type.name} [id ${type.id}, default ${type.defaultSymbol}]`)
          .join(', ')
      : '—';

  return [
    `- ${broker.name} (brokerId ${broker.id})`,
    `  servers: ${servers}`,
    `  account types: ${types}`,
  ].join('\n');
}

export function formatBrokers(brokers: Broker[]): string {
  if (brokers.length === 0) {
    return (
      'No active brokers in the Senti catalog. This is a platform-wide list, so an empty ' +
      'result points at the service rather than at this API key.'
    );
  }

  const noun = brokers.length === 1 ? 'broker' : 'brokers';
  const blocks = brokers.map(block).join('\n\n');

  // Naming the scope of the list is load-bearing: read plainly, "brokers" is
  // easily taken for "the brokers this user trades with".
  return (
    `${brokers.length} ${noun} in the platform-wide Senti catalog — these are the brokers ` +
    'available to link, not the accounts this API key already has.\n\n' +
    blocks
  );
}
