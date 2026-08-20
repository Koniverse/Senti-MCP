import { McpServer } from '@modelcontextprotocol/server';
import { createClient } from './core/client.js';
import { SERVER_NAME, SERVER_VERSION, type Config } from './config.js';
import { registerListAccounts } from './tools/accounts/list-accounts.js';
import { registerGetAuthoringConventions } from './tools/authoring/conventions.js';
import { registerGetDraft } from './tools/authoring/get-draft.js';
import { registerListDraftAttachments } from './tools/authoring/list-draft-attachments.js';
import { registerListDrafts } from './tools/authoring/list-drafts.js';
import { registerListBrokers } from './tools/brokers/list-brokers.js';
import { registerGetPerformanceBreakdowns } from './tools/performance/breakdowns.js';
import { registerGetAccountPerformance } from './tools/performance/summary.js';
import { registerGetEquityTimeseries } from './tools/performance/timeseries.js';
import { registerListAccountStrategies } from './tools/strategies/list-account-strategies.js';
import { registerListStrategies } from './tools/strategies/list-strategies.js';
import { registerListDeals } from './tools/trading/deals.js';
import { registerListPendingOrders } from './tools/trading/orders.js';
import { registerListPositions } from './tools/trading/positions.js';

export type ServerDeps = { fetch?: typeof fetch };

/**
 * The tool list is registered once and never changes for the life of the
 * process, so clients on protocol revision 2026-07-28 may cache it. Without a
 * hint the SDK emits `ttlMs: 0` and every connection re-lists.
 */
const TOOL_LIST_TTL_MS = 3_600_000;

export function createServer(config: Config, deps: ServerDeps = {}): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      cacheHints: {
        'tools/list': { ttlMs: TOOL_LIST_TTL_MS, cacheScope: 'private' },
        'server/discover': { ttlMs: TOOL_LIST_TTL_MS, cacheScope: 'private' },
      },
    },
  );

  const client = createClient(config, { fetch: deps.fetch });

  registerGetAuthoringConventions(server, client);
  registerListDrafts(server, client);
  registerGetDraft(server, client);
  registerListDraftAttachments(server, client);
  registerListAccounts(server, client);
  registerListBrokers(server, client);
  registerListStrategies(server, client);
  registerListAccountStrategies(server, client);
  registerListPositions(server, client);
  registerListPendingOrders(server, client);
  registerListDeals(server, client);
  registerGetAccountPerformance(server, client);
  registerGetPerformanceBreakdowns(server, client);
  registerGetEquityTimeseries(server, client);

  return server;
}
