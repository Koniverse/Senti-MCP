import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { describe, expect, test } from 'vitest';
import type * as z from 'zod/v4';
import { AccountsOutputSchema } from './tools/accounts/list-accounts.js';
import { BrokersOutputSchema } from './tools/brokers/list-brokers.js';
import { AccountStrategiesOutputSchema } from './tools/strategies/list-account-strategies.js';
import { StrategiesOutputSchema } from './tools/strategies/list-strategies.js';
import { OrdersOutputSchema } from './tools/trading/orders.js';
import { PositionsOutputSchema } from './tools/trading/positions.js';
import { loadConfig } from './config.js';
import { createServer } from './server.js';

const config = loadConfig({
  SENTI_API_KEY: 'sq_live_supersecret',
  SENTI_API_BASE_URL: 'https://be-dev.sentitrade.xyz',
});

const ACCOUNT = {
  id: '8f2c1b40-3d5e-4a17-9c8b-2e1f0a6d4b93',
  login: '51234567',
  label: 'Main Live',
  broker: 'Exness',
  server: 'Exness-MT5Real',
  accountType: 'REAL',
  brokerAccountTypeName: 'MT5 Real',
  isActive: true,
  isSoftDeleted: false,
  accessMode: 'FULL',
  lastKnownBalance: 10432.11,
  lastKnownEquity: 10502,
  lastSyncAt: '2026-08-05T09:12:00Z',
  createdAt: '2026-01-02T00:00:00Z',
  terminal: { assignedPort: 5001, terminalStatus: 'RUNNING', nodeName: 'node-1' },
  activeEas: [{ name: 'TrendRider', status: 'running' }],
};

const okFetch = (async () =>
  new Response(JSON.stringify([ACCOUNT]), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })) as unknown as typeof fetch;

const BROKER = {
  id: 'b1',
  name: 'Exness',
  servers: ['Exness-MT5Trial6'],
  accountTypes: [{ id: 'at1', name: 'Standard', defaultSymbol: 'EURUSD' }],
};

const STRATEGY = {
  id: 's1',
  name: 'TrendRider',
  description: 'Follows the daily trend.',
  isActive: true,
  supportedSymbols: ['EURUSD'],
  supportedTimeframes: ['H1'],
  avgRating: 4.5,
  reviewCount: 12,
  presets: [{ id: 'p1', name: 'Conservative' }],
};

type ToolResult = {
  content: { type: string; text?: string }[];
  structuredContent?: unknown;
  isError?: boolean;
};

const textOf = (result: ToolResult) =>
  result.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('\n');

async function connect(fetchImpl: typeof fetch = okFetch) {
  const server = createServer(config, { fetch: fetchImpl });
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe('MCP server', () => {
  test('tells the model that id, not login, is the handle other tools take', async () => {
    const client = await connect();

    const { tools } = await client.listTools();
    const listAccounts = tools.find((tool) => tool.name === 'list_accounts');

    expect(listAccounts?.description).toMatch(/accountId/);
    expect(listAccounts?.description).toMatch(/login/);
  });

  test('takes no arguments', async () => {
    const client = await connect();

    const { tools } = await client.listTools();
    const listAccounts = tools.find((tool) => tool.name === 'list_accounts');

    // No `?? {}` — that would pass whether `properties` is `{}` or absent, and
    // the wire genuinely carries `"inputSchema":{"type":"object","properties":{}}`.
    expect(listAccounts?.inputSchema.properties).toEqual({});
  });

  test('advertises itself as read-only against an open world', async () => {
    const client = await connect();

    const { tools } = await client.listTools();
    const listAccounts = tools.find((tool) => tool.name === 'list_accounts');

    expect(listAccounts?.annotations?.readOnlyHint).toBe(true);
    expect(listAccounts?.annotations?.openWorldHint).toBe(true);
  });

  test('returns a readable summary and matching structured content', async () => {
    const client = await connect();

    const result = (await client.callTool({ name: 'list_accounts' })) as ToolResult;

    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('accountId: 8f2c1b40-3d5e-4a17-9c8b-2e1f0a6d4b93');
    expect(AccountsOutputSchema.safeParse(result.structuredContent).success).toBe(true);
  });

  test('wraps the array under an accounts key so both protocol eras agree', async () => {
    const client = await connect();

    const result = (await client.callTool({ name: 'list_accounts' })) as ToolResult;

    expect(result.structuredContent).toHaveProperty('accounts');
    expect(Array.isArray(result.structuredContent)).toBe(false);
  });

  test('surfaces a missing scope as a tool error naming the scope', async () => {
    const forbidden = (async () =>
      new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Insufficient scope.' } }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch;
    const client = await connect(forbidden);

    const result = (await client.callTool({ name: 'list_accounts' })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('accounts:read');
    // AC-15's second clause: an error result carries text only, because
    // `structuredContent` would have to satisfy `outputSchema`.
    expect(result.structuredContent).toBeUndefined();
  });

  test('surfaces the underlying network cause', async () => {
    const throwing = (async () => {
      throw new Error('fetch failed', { cause: { code: 'ENOTFOUND' } });
    }) as unknown as typeof fetch;
    const client = await connect(throwing);

    const result = (await client.callTool({ name: 'list_accounts' })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('ENOTFOUND');
  });

  test('never puts the API key in an error result', async () => {
    const unauthorized = (async () =>
      new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'Invalid key.' } }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch;
    const client = await connect(unauthorized);

    const result = (await client.callTool({ name: 'list_accounts' })) as ToolResult;

    expect(textOf(result)).not.toContain('supersecret');
  });

  test('keeps the session alive after a failed call', async () => {
    const throwing = (async () => {
      throw new Error('fetch failed');
    }) as unknown as typeof fetch;
    const client = await connect(throwing);

    // The tool count is incidental to this test's intent — it is about the
    // session surviving a failed call, not about how many tools exist — so the
    // registered set is captured live rather than hardcoded, and re-asserted
    // unchanged after the failure. Verified by mutation: closing the client
    // between the two calls turns this red. A dead session's `listTools()`
    // resolves quietly to `[]` — it does not reject or hang — so comparing
    // against a live `before` is what catches it, not a hardcoded count.
    const before = await client.listTools();

    await client.callTool({ name: 'list_accounts' });
    const after = await client.listTools();

    expect(after.tools.map((tool) => tool.name)).toEqual(before.tools.map((tool) => tool.name));
  });
});

describe('list_brokers', () => {
  test('returns a readable summary and matching structured content', async () => {
    const brokersFetch = (async () =>
      new Response(JSON.stringify([BROKER]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch;
    const client = await connect(brokersFetch);

    const result = (await client.callTool({ name: 'list_brokers' })) as ToolResult;

    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('Exness');
    expect(BrokersOutputSchema.safeParse(result.structuredContent).success).toBe(true);
  });

  test('tells the model the catalog is platform-wide', async () => {
    const client = await connect();

    const { tools } = await client.listTools();
    const brokers = tools.find((tool) => tool.name === 'list_brokers');

    expect(brokers?.description).toMatch(/platform-wide/i);
  });

  test('takes no arguments', async () => {
    const client = await connect();

    const { tools } = await client.listTools();
    const brokers = tools.find((tool) => tool.name === 'list_brokers');

    expect(brokers?.inputSchema.properties).toEqual({});
  });

  test('names the brokers:read scope on 403', async () => {
    const forbidden = (async () =>
      new Response(
        JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Insufficient scope.' } }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      )) as unknown as typeof fetch;
    const client = await connect(forbidden);

    const result = (await client.callTool({ name: 'list_brokers' })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('brokers:read');
  });
});

describe('list_strategies', () => {
  test('returns a readable summary and matching structured content', async () => {
    const strategiesFetch = (async () =>
      new Response(JSON.stringify([STRATEGY]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch;
    const client = await connect(strategiesFetch);

    const result = (await client.callTool({ name: 'list_strategies' })) as ToolResult;

    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('TrendRider');
    expect(StrategiesOutputSchema.safeParse(result.structuredContent).success).toBe(true);
  });

  test('sends the model to list_account_strategies for what is actually running', async () => {
    const client = await connect();

    const { tools } = await client.listTools();
    const strategies = tools.find((tool) => tool.name === 'list_strategies');

    expect(strategies?.description).toMatch(/platform-wide/i);
    expect(strategies?.description).toMatch(/list_account_strategies/);
  });

  test('names the strategies:read scope on 403', async () => {
    const forbidden = (async () =>
      new Response(
        JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Insufficient scope.' } }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      )) as unknown as typeof fetch;
    const client = await connect(forbidden);

    const result = (await client.callTool({ name: 'list_strategies' })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('strategies:read');
  });
});

const DEPLOYED = {
  id: 'ae1',
  mt5AccountId: 'abc-123',
  eaDefinitionId: 's1',
  symbol: 'EURUSD',
  timeframe: 'H1',
  status: 'RUNNING',
  chartId: '12345',
  eaDefinition: { name: 'TrendRider' },
  mt5Account: { id: 'abc-123', login: '51234567', label: 'Main Live' },
};

describe('list_account_strategies', () => {
  test('calls the account-scoped path and returns both channels', async () => {
    const calls: string[] = [];
    const deployedFetch = (async (url: string | URL) => {
      calls.push(String(url));
      return new Response(JSON.stringify([DEPLOYED]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    const client = await connect(deployedFetch);

    const result = (await client.callTool({
      name: 'list_account_strategies',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect(calls[0]).toBe('https://be-dev.sentitrade.xyz/api/v1/accounts/abc-123/strategies');
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('TrendRider');
    expect(AccountStrategiesOutputSchema.safeParse(result.structuredContent).success).toBe(true);
  });

  test('declares accountId as a required argument', async () => {
    const client = await connect();

    const { tools } = await client.listTools();
    const tool = tools.find((entry) => entry.name === 'list_account_strategies');

    expect(tool?.inputSchema.properties).toHaveProperty('accountId');
    expect(tool?.inputSchema.required).toContain('accountId');
  });

  test('tells the model to pass id rather than login', async () => {
    const client = await connect();

    const { tools } = await client.listTools();
    const tool = tools.find((entry) => entry.name === 'list_account_strategies');

    expect(tool?.description).toMatch(/list_accounts/);
    expect(tool?.description).toMatch(/login/);
  });

  test('turns a 404 into the login-versus-id hint', async () => {
    const missing = (async () =>
      new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found.' } }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch;
    const client = await connect(missing);

    const result = (await client.callTool({
      name: 'list_account_strategies',
      arguments: { accountId: '413878201' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/list_accounts/);
    expect(textOf(result)).toMatch(/login/);
  });

  test('names the strategies:read scope on 403', async () => {
    const forbidden = (async () =>
      new Response(
        JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Insufficient scope.' } }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      )) as unknown as typeof fetch;
    const client = await connect(forbidden);

    const result = (await client.callTool({
      name: 'list_account_strategies',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('strategies:read');
  });
});

const POSITION = {
  ticket: 123456,
  symbol: 'EURUSD',
  type: 'POSITION_TYPE_BUY',
  volume: 0.1,
  priceOpen: 1.0855,
  priceCurrent: 1.0871,
  sl: 0,
  tp: 0,
  swap: -0.12,
  profit: 16.0,
  openTime: '2026-08-05T09:12:00Z',
  magic: 0,
  comment: 'TrendRider',
};

describe('list_positions', () => {
  test('calls the account-scoped path and returns both channels', async () => {
    const calls: string[] = [];
    const positionsFetch = (async (url: string | URL) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ positions: [POSITION] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    const client = await connect(positionsFetch);

    const result = (await client.callTool({
      name: 'list_positions',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect(calls[0]).toBe('https://be-dev.sentitrade.xyz/api/v1/accounts/abc-123/positions');
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('ticket 123456');
    expect(PositionsOutputSchema.safeParse(result.structuredContent).success).toBe(true);
  });

  test('reports an offline terminal on 409 and distinguishes it from holding nothing', async () => {
    const offline = (async () =>
      new Response(
        JSON.stringify({ error: { code: 'CONFLICT', message: 'Terminal offline.' } }),
        { status: 409, headers: { 'content-type': 'application/json' } },
      )) as unknown as typeof fetch;
    const client = await connect(offline);

    const result = (await client.callTool({
      name: 'list_positions',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/terminal/i);
    expect(textOf(result)).toMatch(/offline/i);
    // The sentence that stops a model reporting "you have no open positions"
    // for an account that is holding open risk.
    expect(textOf(result)).toMatch(/not the same as/i);
  });

  test('an empty list is presented as a real zero', async () => {
    const emptyFetch = (async () =>
      new Response(JSON.stringify({ positions: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch;
    const client = await connect(emptyFetch);

    const result = (await client.callTool({
      name: 'list_positions',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toMatch(/real zero/i);
  });

  test('names the trading:read scope on 403', async () => {
    const forbidden = (async () =>
      new Response(
        JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Insufficient scope.' } }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      )) as unknown as typeof fetch;
    const client = await connect(forbidden);

    const result = (await client.callTool({
      name: 'list_positions',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('trading:read');
  });
});

const ORDER = {
  ticket: 987654,
  symbol: 'XAUUSD',
  type: 'ORDER_TYPE_BUY_LIMIT',
  volume: 0.2,
  priceOpen: 2380.5,
  sl: 0,
  tp: 0,
  timeSetup: '2026-08-05T10:00:00Z',
  priceStopLimit: 0,
  magic: 0,
  comment: '',
};

describe('list_pending_orders', () => {
  test('calls the account-scoped path and returns both channels', async () => {
    const calls: string[] = [];
    const ordersFetch = (async (url: string | URL) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ orders: [ORDER] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    const client = await connect(ordersFetch);

    const result = (await client.callTool({
      name: 'list_pending_orders',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect(calls[0]).toBe('https://be-dev.sentitrade.xyz/api/v1/accounts/abc-123/orders');
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('ticket 987654');
    expect(OrdersOutputSchema.safeParse(result.structuredContent).success).toBe(true);
  });

  test('reports an offline terminal on 409', async () => {
    const offline = (async () =>
      new Response(
        JSON.stringify({ error: { code: 'CONFLICT', message: 'Terminal offline.' } }),
        { status: 409, headers: { 'content-type': 'application/json' } },
      )) as unknown as typeof fetch;
    const client = await connect(offline);

    const result = (await client.callTool({
      name: 'list_pending_orders',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/offline/i);
    expect(textOf(result)).toMatch(/not the same as/i);
  });

  test('names the trading:read scope on 403', async () => {
    const forbidden = (async () =>
      new Response(
        JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Insufficient scope.' } }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      )) as unknown as typeof fetch;
    const client = await connect(forbidden);

    const result = (await client.callTool({
      name: 'list_pending_orders',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('trading:read');
  });
});

/**
 * One entry per registered tool. Later tool stories add a row here rather than
 * writing their own leak test or their own `outputSchema` assertion — that is
 * the point of the table. `outputSchema` and `successBody` exist only for the
 * "structuredContent validates against its own schema" test below:
 * `successBody` is the raw HTTP response body a stubbed `fetch` returns (the
 * shape the real API sends), and `outputSchema` is the same schema the tool
 * registers with `registerReadTool` — each tool needs a different successful
 * body, so this cannot be a single shared fixture (AC-9).
 */
const TOOL_CALLS: {
  name: string;
  arguments?: Record<string, unknown>;
  outputSchema: z.ZodType;
  successBody: unknown;
}[] = [
  { name: 'list_accounts', outputSchema: AccountsOutputSchema, successBody: [ACCOUNT] },
  { name: 'list_brokers', outputSchema: BrokersOutputSchema, successBody: [BROKER] },
  { name: 'list_strategies', outputSchema: StrategiesOutputSchema, successBody: [STRATEGY] },
  {
    name: 'list_account_strategies',
    arguments: { accountId: 'abc-123' },
    outputSchema: AccountStrategiesOutputSchema,
    successBody: [DEPLOYED],
  },
  {
    name: 'list_positions',
    arguments: { accountId: 'abc-123' },
    outputSchema: PositionsOutputSchema,
    successBody: { positions: [POSITION] },
  },
  {
    name: 'list_pending_orders',
    arguments: { accountId: 'abc-123' },
    outputSchema: OrdersOutputSchema,
    successBody: { orders: [ORDER] },
  },
];

const errorStatuses = [401, 403, 404, 409, 429, 500];

/**
 * A key-shaped string, not a bare prefix. The 401 branch in `core/client.ts`
 * legitimately contains the literal text `sq_live_…` as operator guidance
 * ("first-party keys look like ..."), so `.not.toContain('sq_live_')` would
 * fire on that help text rather than on an actual leaked key. `…` (U+2026)
 * is not in `[A-Za-z0-9]`, so this pattern does not match the guidance text
 * but does match any real key, including one this test never configured.
 */
const KEY_SHAPED = /sq_live_[A-Za-z0-9]{4,}/;

describe('invariants across every registered tool', () => {
  test('the table lists every registered tool', async () => {
    const client = await connect();

    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name).sort()).toEqual(
      TOOL_CALLS.map((call) => call.name).sort(),
    );
  });

  test('every tool advertises itself read-only against an open world', async () => {
    const client = await connect();

    const { tools } = await client.listTools();

    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint, `${tool.name} readOnlyHint`).toBe(true);
      expect(tool.annotations?.openWorldHint, `${tool.name} openWorldHint`).toBe(true);
    }
  });

  test("every tool's structuredContent validates against its own outputSchema", async () => {
    for (const call of TOOL_CALLS) {
      const succeeding = (async () =>
        new Response(JSON.stringify(call.successBody), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })) as unknown as typeof fetch;
      const client = await connect(succeeding);

      const result = (await client.callTool({ name: call.name, arguments: call.arguments })) as ToolResult;

      expect(result.isError, call.name).toBeFalsy();
      expect(call.outputSchema.safeParse(result.structuredContent).success, call.name).toBe(true);
    }
  });

  test('rejects a path-traversal accountId before any HTTP call, for every account-scoped tool', async () => {
    const accountScoped = TOOL_CALLS.filter(
      (call): call is typeof call & { arguments: Record<string, unknown> } =>
        call.arguments !== undefined && 'accountId' in call.arguments,
    );

    for (const call of accountScoped) {
      let called = false;
      const watching = (async () => {
        called = true;
        return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
      }) as unknown as typeof fetch;
      const client = await connect(watching);

      const result = (await client.callTool({
        name: call.name,
        arguments: { ...call.arguments, accountId: '../../admin' },
      })) as ToolResult;

      expect(result.isError, call.name).toBe(true);
      expect(textOf(result), call.name).toMatch(/Invalid path segment/);
      // The load-bearing assertion: `accountPath` throws before `client.get`
      // is entered, so a hostile value never reaches the network at all —
      // materially stronger than a value that reaches the network and is
      // merely rejected server-side.
      expect(called, call.name).toBe(false);
    }
  });

  test('no tool leaks the API key on any error status', async () => {
    for (const status of errorStatuses) {
      const failing = (async () =>
        new Response(JSON.stringify({ error: { code: 'INTERNAL', message: 'boom' } }), {
          status,
          headers: { 'content-type': 'application/json' },
        })) as unknown as typeof fetch;
      const client = await connect(failing);

      for (const call of TOOL_CALLS) {
        const result = (await client.callTool(call)) as ToolResult;

        expect(result.isError, `${call.name} @ ${status}`).toBe(true);
        // A row whose `arguments` fail input-schema validation (missing or
        // malformed, e.g. a mistyped `accountId`) also comes back with
        // `isError: true`, but from the SDK's own schema check — `client.get`
        // is never called, so "no key leaked" would hold trivially, and a
        // row with bad `arguments` would silently disarm this test for that
        // tool. Asserting the failure text is shaped like the real
        // downstream error (`core/client.ts`'s `failureOf`, which always
        // says "Senti API") forces the call to have actually reached that
        // path before the leak assertions below mean anything.
        expect(textOf(result), `${call.name} @ ${status}`).toMatch(/Senti API/);
        expect(textOf(result), `${call.name} @ ${status}`).not.toContain('supersecret');
        expect(textOf(result), `${call.name} @ ${status}`).not.toMatch(KEY_SHAPED);
        expect(result.structuredContent, `${call.name} @ ${status}`).toBeUndefined();
      }
    }
  }, 30_000);

  test('no tool leaks the API key when the network fails', async () => {
    const throwing = (async () => {
      throw new Error('fetch failed', { cause: { code: 'ENOTFOUND' } });
    }) as unknown as typeof fetch;
    const client = await connect(throwing);

    for (const call of TOOL_CALLS) {
      const result = (await client.callTool(call)) as ToolResult;

      // Same defense as the error-status test above: a row whose `arguments`
      // fail input-schema validation never reaches the thrown `fetch`
      // rejection at all, so the leak assertions below would pass on a call
      // that was never actually made. `describeError` (`core/errors.ts`)
      // renders this stub's cause chain as "fetch failed: ENOTFOUND" — that
      // marker only appears once the call has genuinely gone through
      // `client.get` and hit the network stub.
      expect(textOf(result), call.name).toContain('ENOTFOUND');
      expect(textOf(result), call.name).not.toContain('supersecret');
      expect(textOf(result), call.name).not.toMatch(KEY_SHAPED);
    }
  });
});
