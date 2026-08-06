import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { AccountsOutputSchema, formatAccounts, parseAccounts } from './accounts.js';
import { createClient } from './core/client.js';
import { SERVER_NAME, SERVER_VERSION, type Config } from './config.js';
import { describeError } from './core/errors.js';

export type ServerDeps = { fetch?: typeof fetch };

/**
 * The tool list is registered once and never changes for the life of the
 * process, so clients on protocol revision 2026-07-28 may cache it. Without a
 * hint the SDK emits `ttlMs: 0` and every connection re-lists.
 */
const TOOL_LIST_TTL_MS = 3_600_000;

/** The scope `GET /api/v1/accounts` requires, quoted back in the 403 message. */
const ACCOUNTS_READ = 'accounts:read';

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

  server.registerTool(
    'list_accounts',
    {
      title: 'List linked MT5 accounts',
      description:
        'List the MT5 trading accounts linked to the configured Senti Quant API key. ' +
        "Returns each account's id, login, broker, last known balance and equity, sync " +
        'state, and running strategies. The `id` field is the accountId every other Senti ' +
        'endpoint takes — pass `id`, not `login`, when a tool asks for an account.',
      inputSchema: z.object({}),
      outputSchema: AccountsOutputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (_args, ctx) => {
      try {
        const payload = await client.get('/api/v1/accounts', {
          signal: ctx.mcpReq.signal,
          scope: ACCOUNTS_READ,
        });
        const accounts = parseAccounts(payload);

        return {
          content: [{ type: 'text' as const, text: formatAccounts(accounts) }],
          structuredContent: { accounts },
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: describeError(error) }],
          isError: true,
        };
      }
    },
  );

  return server;
}
