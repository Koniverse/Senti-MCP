import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { describe, expect, test } from 'vitest';
import type * as z from 'zod/v4';
import { AccountsOutputSchema } from './tools/accounts/list-accounts.js';
import { ConventionsOutputSchema } from './tools/authoring/conventions.js';
import { DraftOutputSchema } from './tools/authoring/get-draft.js';
import { AttachmentsOutputSchema } from './tools/authoring/list-draft-attachments.js';
import { DraftsOutputSchema } from './tools/authoring/list-drafts.js';
import { BrokersOutputSchema } from './tools/brokers/list-brokers.js';
import { BreakdownsOutputSchema } from './tools/performance/breakdowns.js';
import { PerformanceOutputSchema } from './tools/performance/summary.js';
import { MAX_POINTS, TimeseriesOutputSchema } from './tools/performance/timeseries.js';
import { AccountStrategiesOutputSchema } from './tools/strategies/list-account-strategies.js';
import { StrategiesOutputSchema } from './tools/strategies/list-strategies.js';
import { DealsOutputSchema } from './tools/trading/deals.js';
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

const CONVENTIONS = {
  hardSafetyConstraints: ['NEVER use #import of a DLL.'],
  tradingSafetyRequirements: ['Every order must carry a stop loss.'],
  forbiddenConstructs: [{ id: 'NO_DLL_IMPORT', pattern: '#import\\b', reason: 'No DLLs.' }],
  limits: {
    maxDrafts: 20,
    maxAttachmentsPerDraft: 5,
    maxAttachmentBytes: 65536,
    maxSourceBytes: 196608,
    maxRegisteredEas: 10,
  },
};

const DRAFT = {
  id: 'd-1',
  name: 'RSI Reversal',
  sourceCode: '// 12 bytes\n',
  createdAt: '2026-08-14T09:22:41.318Z',
  updatedAt: '2026-08-18T04:07:55.902Z',
  lastCompileStatus: 'FAILED',
  lastCompileLog: 'strategy.mq5(42,7) : error 123: undeclared identifier',
  logTruncated: false,
  lastCompileDiagnostics: [
    {
      severity: 'error',
      file: 'strategy.mq5',
      line: 42,
      column: 7,
      code: '123',
      message: 'undeclared identifier',
    },
  ],
  compiledUpToDate: false,
  eaDefinitionId: null,
  attachments: [
    { id: 'a-1', filename: 'Trend.mq5', sourceCode: 'abcde', createdAt: '2026-08-14T09:30:00.000Z' },
  ],
};

const ATTACHMENT = {
  id: 'a-1',
  filename: 'Trend.mq5',
  sourceCode: 'abcde',
  createdAt: '2026-08-14T09:30:00.000Z',
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

/**
 * One describe per authoring tool. The table at the bottom of this file proves every tool
 * registers and round-trips its own `outputSchema`; it cannot prove the things only this
 * layer decides — the scope string sent to `core/client.ts`, the URL `draftPath` builds,
 * the 404 hint each tool attaches, and whether an optional argument reaches `run`.
 */
const authoringFetch = (body: unknown, calls: string[] = []) =>
  (async (url: string | URL) => {
    calls.push(String(url));
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;

const failingFetch = (status: number, code: string) =>
  (async () =>
    new Response(JSON.stringify({ error: { code, message: 'Nope.' } }), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;

describe('get_authoring_conventions', () => {
  test('calls the conventions path and returns both channels', async () => {
    const calls: string[] = [];
    const client = await connect(authoringFetch(CONVENTIONS, calls));

    const result = (await client.callTool({ name: 'get_authoring_conventions' })) as ToolResult;

    expect(calls[0]).toBe('https://be-dev.sentitrade.xyz/api/v1/authoring/conventions');
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('NO_DLL_IMPORT');
    expect(ConventionsOutputSchema.safeParse(result.structuredContent).success).toBe(true);
  });

  test('takes no arguments', async () => {
    const client = await connect();

    const { tools } = await client.listTools();
    const tool = tools.find((entry) => entry.name === 'get_authoring_conventions');

    expect(tool?.inputSchema.properties).toEqual({});
  });

  test('names the authoring:read scope on 403', async () => {
    const client = await connect(failingFetch(403, 'FORBIDDEN'));

    const result = (await client.callTool({ name: 'get_authoring_conventions' })) as ToolResult;

    expect(result.isError).toBe(true);
    // A word boundary, not `toContain`: 'authoring:reads' contains 'authoring:read',
    // so a typo in the scope constant would pass a substring check.
    expect(textOf(result)).toMatch(/\bauthoring:read\b/);
  });
});

describe('list_drafts', () => {
  test('calls the collection path and returns both channels', async () => {
    const calls: string[] = [];
    const client = await connect(authoringFetch([DRAFT], calls));

    const result = (await client.callTool({ name: 'list_drafts' })) as ToolResult;

    expect(calls[0]).toBe('https://be-dev.sentitrade.xyz/api/v1/drafts');
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('RSI Reversal');
    expect(DraftsOutputSchema.safeParse(result.structuredContent).success).toBe(true);
  });

  test('takes no arguments', async () => {
    const client = await connect();

    const { tools } = await client.listTools();
    const tool = tools.find((entry) => entry.name === 'list_drafts');

    expect(tool?.inputSchema.properties).toEqual({});
  });

  test('names the authoring:read scope on 403', async () => {
    const client = await connect(failingFetch(403, 'FORBIDDEN'));

    const result = (await client.callTool({ name: 'list_drafts' })) as ToolResult;

    expect(result.isError).toBe(true);
    // A word boundary, not `toContain`: 'authoring:reads' contains 'authoring:read',
    // so a typo in the scope constant would pass a substring check.
    expect(textOf(result)).toMatch(/\bauthoring:read\b/);
  });
});

describe('get_draft', () => {
  test('calls the draft-scoped path and returns both channels', async () => {
    const calls: string[] = [];
    const client = await connect(authoringFetch(DRAFT, calls));

    const result = (await client.callTool({
      name: 'get_draft',
      arguments: { draftId: 'd-1' },
    })) as ToolResult;

    expect(calls[0]).toBe('https://be-dev.sentitrade.xyz/api/v1/drafts/d-1');
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('RSI Reversal');
    expect(DraftOutputSchema.safeParse(result.structuredContent).success).toBe(true);
  });

  test('declares draftId as a required argument', async () => {
    const client = await connect();

    const { tools } = await client.listTools();
    const tool = tools.find((entry) => entry.name === 'get_draft');

    expect(tool?.inputSchema.properties).toHaveProperty('draftId');
    expect(tool?.inputSchema.required).toContain('draftId');
  });

  test('turns a 404 into the hint that names list_drafts', async () => {
    const client = await connect(failingFetch(404, 'NOT_FOUND'));

    const result = (await client.callTool({
      name: 'get_draft',
      arguments: { draftId: 'gone' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/list_drafts/);
  });

  test('names the authoring:read scope on 403', async () => {
    const client = await connect(failingFetch(403, 'FORBIDDEN'));

    const result = (await client.callTool({
      name: 'get_draft',
      arguments: { draftId: 'd-1' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    // A word boundary, not `toContain`: 'authoring:reads' contains 'authoring:read',
    // so a typo in the scope constant would pass a substring check.
    expect(textOf(result)).toMatch(/\bauthoring:read\b/);
  });
});

describe('list_draft_attachments', () => {
  test('calls the attachments sub-path and returns both channels', async () => {
    const calls: string[] = [];
    const client = await connect(authoringFetch([ATTACHMENT], calls));

    const result = (await client.callTool({
      name: 'list_draft_attachments',
      arguments: { draftId: 'd-1' },
    })) as ToolResult;

    expect(calls[0]).toBe('https://be-dev.sentitrade.xyz/api/v1/drafts/d-1/attachments');
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('Trend.mq5');
    expect(AttachmentsOutputSchema.safeParse(result.structuredContent).success).toBe(true);
  });

  test('declares draftId required and filename optional', async () => {
    const client = await connect();

    const { tools } = await client.listTools();
    const tool = tools.find((entry) => entry.name === 'list_draft_attachments');

    expect(Object.keys(tool?.inputSchema.properties ?? {}).sort()).toEqual([
      'draftId',
      'filename',
    ]);
    expect(tool?.inputSchema.required).toEqual(['draftId']);
  });

  test('passes filename through to the filter rather than dropping it', async () => {
    const client = await connect(
      authoringFetch([ATTACHMENT, { ...ATTACHMENT, id: 'a-2', filename: 'Other.mq5' }]),
    );

    const result = (await client.callTool({
      name: 'list_draft_attachments',
      arguments: { draftId: 'd-1', filename: 'Other.mq5' },
    })) as ToolResult;

    const structured = result.structuredContent as z.infer<typeof AttachmentsOutputSchema>;

    expect(structured.attachments.map((item) => item.filename)).toEqual(['Other.mq5']);
    // The filter is client-side, so the text must say this is a filtered view of a
    // two-attachment draft rather than reading as the draft's whole set.
    expect(textOf(result)).toMatch(/1 of 2 attachment/);
  });

  test('names every filename that does exist when the requested one does not', async () => {
    const client = await connect(authoringFetch([ATTACHMENT]));

    const result = (await client.callTool({
      name: 'list_draft_attachments',
      arguments: { draftId: 'd-1', filename: 'Missing.mq5' },
    })) as ToolResult;

    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('Trend.mq5');
  });

  test('turns a 404 into the hint that names list_drafts', async () => {
    const client = await connect(failingFetch(404, 'NOT_FOUND'));

    const result = (await client.callTool({
      name: 'list_draft_attachments',
      arguments: { draftId: 'gone' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/list_drafts/);
  });

  test('names the authoring:read scope on 403', async () => {
    const client = await connect(failingFetch(403, 'FORBIDDEN'));

    const result = (await client.callTool({
      name: 'list_draft_attachments',
      arguments: { draftId: 'd-1' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    // A word boundary, not `toContain`: 'authoring:reads' contains 'authoring:read',
    // so a typo in the scope constant would pass a substring check.
    expect(textOf(result)).toMatch(/\bauthoring:read\b/);
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

const DEAL = {
  ticket: 4207514236,
  positionId: 4884575186,
  orderId: 4884575186,
  magic: 25,
  symbol: 'XAUUSDm',
  type: 'BUY',
  entry: 'OUT',
  volume: 0.01,
  price: 4336,
  commission: -0.35,
  fee: 0,
  swap: -1.2,
  profit: 11.04,
  comment: 'AT_DCA_B_9',
  time: '2026-08-10T04:23:29.000Z',
};

const DEALS_PAGE = { deals: [DEAL], nextCursor: null, syncedThrough: '2026-08-10T04:23:29.000Z' };

const PERFORMANCE = {
  metrics: {
    grossProfit: 3042.12,
    grossLoss: -373.32,
    winRate: 82.75862068965517,
    totalPnl: 2668.8,
    profitFactor: 8.148826743812277,
    totalBalance: 128751.31,
    totalEquity: 165873.03,
    totalVolume: 4.85,
    totalNotionalVolume: 1971479.65,
    longCount: 16,
    shortCount: 42,
    robotCount: 56,
    manualCount: 2,
    totalClosedDeals: 58,
    winCount: 48,
    lossCount: 10,
    unconvertedAccounts: [],
    notionalIncomplete: false,
    staleBalanceAccounts: [],
    deposits: 0,
    withdrawals: 0,
    netCashFlow: 0,
    commission: 0,
    swap: 0,
    fee: 0,
  },
  portfolioReturn: {
    roi: 2.1167091296009253,
    irr: 31.55911156908283,
    periodNetPnL: 2668.8,
    periodGrossDeposits: 0,
    startingBalance: 126082.51,
    endingValue: 165873.03,
    capitalBase: 126082.51,
    cashFlowCount: 0,
  },
  lifetimeIrr: {
    irr: 1581.109499644062,
    cashFlowCount: 3,
    earliestMs: 1780999200000,
    grossDeposits: 110007.76,
    grossWithdrawals: 0,
  },
  live: {
    balance: 128751.31,
    equity: 165802.7,
    profit: 37051.39,
    margin: 1159.12,
    marginFree: 164643.58,
    marginLevel: 14304.19,
    leverage: 500,
    currency: 'USD',
    name: 'Test API',
  },
};

/**
 * A breakdowns response small enough to read, carrying one of everything the
 * tool cuts: a `perAccount` map, three `cumulative*` columns, eleven symbols —
 * one past the cap — and a heatmap spanning two dates. The cut rules
 * themselves are proven in `breakdowns.test.ts`; what this fixture is for is
 * the wiring, so it only has to be cuttable.
 */
const SYMBOL_ROW = (dateKey: string, scale: number) =>
  Object.fromEntries([
    ['date', dateKey.slice(5)],
    ['dateKey', dateKey],
    ...Array.from({ length: 11 }, (_, index) => [`SYM${index}`, (11 - index) * scale]),
  ]);

const BREAKDOWNS = {
  daily: [
    {
      date: 'Jul 1',
      dateKey: '2026-07-01',
      pnl: 500,
      volume: 1.5,
      notionalVolume: 150_000,
      cumulativePnl: 500,
      cumulativeVolume: 1.5,
      cumulativeNotional: 150_000,
    },
  ],
  perAccount: {
    logins: ['413878201'],
    dailyPnlRows: [{ date: 'Jul 1', dateKey: '2026-07-01', '413878201': 500 }],
    dailyVolumeRows: [],
    dailyNotionalRows: [],
    cumPnlRows: [],
    cumVolumeRows: [],
    cumNotionalRows: [],
  },
  perSymbol: {
    pnlSymbols: Array.from({ length: 11 }, (_, index) => `SYM${index}`),
    dealsSymbols: Array.from({ length: 11 }, (_, index) => `SYM${index}`),
    dailyPnlRows: [SYMBOL_ROW('2026-07-01', 100)],
    dailyDealsRows: [SYMBOL_ROW('2026-07-01', 1)],
    cumPnlRows: [SYMBOL_ROW('2026-07-01', 100)],
    cumDealsRows: [SYMBOL_ROW('2026-07-01', 1)],
  },
  heatmap: {
    dates: ['2026-07-01', '2026-07-02'],
    pnlSeries: [
      {
        name: '14:00',
        data: [
          { x: '2026-07-01', y: 300 },
          { x: '2026-07-02', y: 200 },
        ],
      },
    ],
    tradeCountSeries: [
      {
        name: '14:00',
        data: [
          { x: '2026-07-01', y: 2 },
          { x: '2026-07-02', y: 1 },
        ],
      },
    ],
  },
};

/** Records every URL the tool asks for, and answers each with the same body. */
function recordingFetch(calls: string[], body: unknown = PERFORMANCE): typeof fetch {
  return (async (url: string | URL) => {
    calls.push(String(url));
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
}

describe('get_account_performance', () => {
  test('calls the account-scoped path and returns both channels', async () => {
    const calls: string[] = [];
    const client = await connect(recordingFetch(calls));

    const result = (await client.callTool({
      name: 'get_account_performance',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect(calls[0]).toBe('https://be-dev.sentitrade.xyz/api/v1/accounts/abc-123/performance');
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('82.76%');
    expect(PerformanceOutputSchema.safeParse(result.structuredContent).success).toBe(true);
  });

  test('sends from, to and reporting to the URL as query parameters', async () => {
    const calls: string[] = [];
    const client = await connect(recordingFetch(calls));

    await client.callTool({
      name: 'get_account_performance',
      arguments: { accountId: 'abc-123', from: '2026-05-01', to: '2026-05-31', reporting: 'EUR' },
    });

    const url = new URL(calls[0] ?? '');
    expect(url.pathname).toBe('/api/v1/accounts/abc-123/performance');
    expect(url.searchParams.get('from')).toBe('2026-05-01');
    expect(url.searchParams.get('to')).toBe('2026-05-31');
    expect(url.searchParams.get('reporting')).toBe('EUR');
  });

  test('leaves an omitted parameter out of the query string entirely', async () => {
    const calls: string[] = [];
    const client = await connect(recordingFetch(calls));

    await client.callTool({
      name: 'get_account_performance',
      arguments: { accountId: 'abc-123', from: '2026-05-01' },
    });

    // Not `to=undefined`, not `to=`, not present at all. The three are different
    // requests to the API and only the third is the one that was asked for.
    expect(calls[0]).toBe(
      'https://be-dev.sentitrade.xyz/api/v1/accounts/abc-123/performance?from=2026-05-01',
    );
  });

  test('sends no query string at all when the caller supplied no window', async () => {
    const calls: string[] = [];
    const client = await connect(recordingFetch(calls));

    await client.callTool({
      name: 'get_account_performance',
      arguments: { accountId: 'abc-123' },
    });

    expect(calls[0]).not.toContain('?');
  });

  test('rejects a malformed date before any HTTP call, naming the format', async () => {
    let called = false;
    const watching = (async () => {
      called = true;
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;
    const client = await connect(watching);

    const result = (await client.callTool({
      name: 'get_account_performance',
      arguments: { accountId: 'abc-123', from: 'last month' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('YYYY-MM-DD');
    expect(called).toBe(false);
  });

  test('rejects a reporting value that is not a currency code, before any HTTP call', async () => {
    let called = false;
    const watching = (async () => {
      called = true;
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;
    const client = await connect(watching);

    const result = (await client.callTool({
      name: 'get_account_performance',
      arguments: { accountId: 'abc-123', reporting: 'monthly' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/ISO-4217/);
    expect(called).toBe(false);
  });

  test('states an unreachable terminal rather than rendering it as zeroes', async () => {
    const client = await connect(recordingFetch([], { ...PERFORMANCE, live: null }));

    const result = (await client.callTool({
      name: 'get_account_performance',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toMatch(/could not be reached/i);
    expect(textOf(result)).not.toMatch(/equity 0\.00/);
  });

  test('returns an empty notes array, because it cuts nothing', async () => {
    const client = await connect(recordingFetch([]));

    const result = (await client.callTool({
      name: 'get_account_performance',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect((result.structuredContent as { notes: string[] }).notes).toEqual([]);
  });

  test('names the performance:read scope on 403', async () => {
    const forbidden = (async () =>
      new Response(
        JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Insufficient scope.' } }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      )) as unknown as typeof fetch;
    const client = await connect(forbidden);

    const result = (await client.callTool({
      name: 'get_account_performance',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('performance:read');
  });

  test('turns a 404 into the login-versus-id hint', async () => {
    const missing = (async () =>
      new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found.' } }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch;
    const client = await connect(missing);

    const result = (await client.callTool({
      name: 'get_account_performance',
      arguments: { accountId: '413878201' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/list_accounts/);
    expect(textOf(result)).toMatch(/login/);
  });

  test('tells the model that reporting is a currency, not a period', async () => {
    const client = await connect();

    const { tools } = await client.listTools();
    const tool = tools.find((entry) => entry.name === 'get_account_performance');

    expect(tool?.description).toMatch(/ISO-4217/);
    expect(tool?.description).toMatch(/not a reporting period/i);
  });
});

/**
 * The wiring `breakdowns.test.ts` cannot reach. The domain module never calls
 * `accountPath`, never builds a URL and never sees the input schema — those
 * belong to `registerGetPerformanceBreakdowns`, so the three-segment path, the
 * query and the error branches are asserted here, through a real client over a
 * stubbed `fetch`.
 */
describe('get_performance_breakdowns', () => {
  test('builds its three-segment path through accountPath — a traversal accountId never reaches the network', async () => {
    let called = false;
    const watching = (async () => {
      called = true;
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;
    const client = await connect(watching);

    const result = (await client.callTool({
      name: 'get_performance_breakdowns',
      arguments: { accountId: '../../admin' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/Invalid path segment/);
    expect(called).toBe(false);
  });

  test('reaches performance/breakdowns under the account and returns both channels', async () => {
    const calls: string[] = [];
    const client = await connect(recordingFetch(calls, BREAKDOWNS));

    const result = (await client.callTool({
      name: 'get_performance_breakdowns',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect(calls[0]).toBe(
      'https://be-dev.sentitrade.xyz/api/v1/accounts/abc-123/performance/breakdowns',
    );
    expect(result.isError).toBeFalsy();
    expect(BreakdownsOutputSchema.safeParse(result.structuredContent).success).toBe(true);
  });

  test('sends from, to and reporting to the URL as query parameters', async () => {
    const calls: string[] = [];
    const client = await connect(recordingFetch(calls, BREAKDOWNS));

    await client.callTool({
      name: 'get_performance_breakdowns',
      arguments: { accountId: 'abc-123', from: '2026-05-01', to: '2026-05-31', reporting: 'EUR' },
    });

    const url = new URL(calls[0] ?? '');
    expect(url.pathname).toBe('/api/v1/accounts/abc-123/performance/breakdowns');
    expect(url.searchParams.get('from')).toBe('2026-05-01');
    expect(url.searchParams.get('to')).toBe('2026-05-31');
    expect(url.searchParams.get('reporting')).toBe('EUR');
  });

  test('leaves an omitted parameter out of the query string entirely', async () => {
    const calls: string[] = [];
    const client = await connect(recordingFetch(calls, BREAKDOWNS));

    await client.callTool({
      name: 'get_performance_breakdowns',
      arguments: { accountId: 'abc-123', to: '2026-05-31' },
    });

    expect(calls[0]).toBe(
      'https://be-dev.sentitrade.xyz/api/v1/accounts/abc-123/performance/breakdowns?to=2026-05-31',
    );
  });

  test('inherits US-2.10\'s date validation rather than declaring a second one', async () => {
    let called = false;
    const watching = (async () => {
      called = true;
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;
    const client = await connect(watching);

    // 2026-02-31 has the right shape and is not a day. Both tools reject it
    // with the same message because both use the same schema object.
    const result = (await client.callTool({
      name: 'get_performance_breakdowns',
      arguments: { accountId: 'abc-123', from: '2026-02-31' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('YYYY-MM-DD');
    expect(called).toBe(false);
  });

  test('inherits the same reporting rule — a period name is not a currency', async () => {
    const client = await connect(recordingFetch([], BREAKDOWNS));

    const result = (await client.callTool({
      name: 'get_performance_breakdowns',
      arguments: { accountId: 'abc-123', reporting: 'monthly' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/ISO-4217/);
  });

  test('drops perAccount from both channels', async () => {
    const client = await connect(recordingFetch([], BREAKDOWNS));

    const result = (await client.callTool({
      name: 'get_performance_breakdowns',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect(result.structuredContent).not.toHaveProperty('perAccount');
    expect(textOf(result)).not.toContain('413878201');
  });

  test('carries every note into the text, where a host that shows content alone will see it', async () => {
    const client = await connect(recordingFetch([], BREAKDOWNS));

    const result = (await client.callTool({
      name: 'get_performance_breakdowns',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    const { notes } = result.structuredContent as { notes: string[] };

    expect(notes).toHaveLength(2);
    for (const note of notes) expect(textOf(result)).toContain(note);
  });

  test('names the performance:read scope on 403', async () => {
    const forbidden = (async () =>
      new Response(
        JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Insufficient scope.' } }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      )) as unknown as typeof fetch;
    const client = await connect(forbidden);

    const result = (await client.callTool({
      name: 'get_performance_breakdowns',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('performance:read');
  });

  test('turns a 404 into the login-versus-id hint', async () => {
    const missing = (async () =>
      new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found.' } }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch;
    const client = await connect(missing);

    const result = (await client.callTool({
      name: 'get_performance_breakdowns',
      arguments: { accountId: '413878201' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/list_accounts/);
    expect(textOf(result)).toMatch(/login/);
  });

  test('warns the model that the response is shaped, and names the unshaped alternative', async () => {
    const client = await connect();

    const { tools } = await client.listTools();
    const tool = tools.find((entry) => entry.name === 'get_performance_breakdowns');

    // A model that does not know this one is cut will reach for it by default
    // and read a ten-symbol answer as the whole account.
    expect(tool?.description).toMatch(/SHAPED/);
    expect(tool?.description).toMatch(/get_account_performance/);
    expect(tool?.description).toMatch(/`notes`/);
  });
});

/**
 * A timeseries long enough that the tool has to cut it — 250 points against a
 * cap of 200. `timeseries.test.ts` proves which points survive; this fixture
 * exists so the wiring can be checked against a response that is genuinely
 * downsampled rather than one that passes straight through.
 */
const TIMESERIES_POINTS = Array.from({ length: 250 }, (_, index) => ({
  timeMs: Date.UTC(2026, 4, 1) + index * 3_600_000,
  balance: 10_000,
  equity: 10_000 - index,
  drawdownPct: index === 137 ? 31.5 : index % 3,
}));

const TIMESERIES = {
  portfolio: TIMESERIES_POINTS,
  perAccount: { '413878201': TIMESERIES_POINTS },
  caveats: {
    '413878201': {
      equityUnavailable: false,
      drawdownUnavailable: false,
      balanceOnly: true,
      isSoftDeleted: false,
    },
  },
  portfolioCaveats: {
    equityUnavailable: false,
    drawdownUnavailable: false,
    balanceOnly: false,
    isSoftDeleted: false,
  },
};

/**
 * The wiring `timeseries.test.ts` cannot reach. The domain module never calls
 * `accountPath`, never builds a URL and never sees the input schema — those
 * belong to `registerGetEquityTimeseries`, so the three-segment path, the query
 * and the error branches are asserted here, through a real client over a
 * stubbed `fetch`.
 */
describe('get_equity_timeseries', () => {
  test('builds its three-segment path through accountPath — a traversal accountId never reaches the network', async () => {
    let called = false;
    const watching = (async () => {
      called = true;
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;
    const client = await connect(watching);

    const result = (await client.callTool({
      name: 'get_equity_timeseries',
      arguments: { accountId: '../../admin' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/Invalid path segment/);
    expect(called).toBe(false);
  });

  test('reaches performance/timeseries under the account and returns both channels', async () => {
    const calls: string[] = [];
    const client = await connect(recordingFetch(calls, TIMESERIES));

    const result = (await client.callTool({
      name: 'get_equity_timeseries',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect(calls[0]).toBe(
      'https://be-dev.sentitrade.xyz/api/v1/accounts/abc-123/performance/timeseries',
    );
    expect(result.isError).toBeFalsy();
    expect(TimeseriesOutputSchema.safeParse(result.structuredContent).success).toBe(true);
  });

  test('sends from, to and reporting to the URL as query parameters', async () => {
    const calls: string[] = [];
    const client = await connect(recordingFetch(calls, TIMESERIES));

    await client.callTool({
      name: 'get_equity_timeseries',
      arguments: { accountId: 'abc-123', from: '2026-05-01', to: '2026-05-31', reporting: 'EUR' },
    });

    const url = new URL(calls[0] ?? '');
    expect(url.pathname).toBe('/api/v1/accounts/abc-123/performance/timeseries');
    expect(url.searchParams.get('from')).toBe('2026-05-01');
    expect(url.searchParams.get('to')).toBe('2026-05-31');
    expect(url.searchParams.get('reporting')).toBe('EUR');
  });

  test('leaves an omitted parameter out of the query string entirely', async () => {
    const calls: string[] = [];
    const client = await connect(recordingFetch(calls, TIMESERIES));

    await client.callTool({
      name: 'get_equity_timeseries',
      arguments: { accountId: 'abc-123', to: '2026-05-31' },
    });

    expect(calls[0]).toBe(
      'https://be-dev.sentitrade.xyz/api/v1/accounts/abc-123/performance/timeseries?to=2026-05-31',
    );
  });

  test("inherits US-2.10's date validation rather than declaring a third one", async () => {
    let called = false;
    const watching = (async () => {
      called = true;
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;
    const client = await connect(watching);

    const result = (await client.callTool({
      name: 'get_equity_timeseries',
      arguments: { accountId: 'abc-123', from: '2026-02-31' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('YYYY-MM-DD');
    expect(called).toBe(false);
  });

  test('drops perAccount from both channels', async () => {
    const client = await connect(recordingFetch([], TIMESERIES));

    const result = (await client.callTool({
      name: 'get_equity_timeseries',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect(result.structuredContent).not.toHaveProperty('perAccount');
    expect(textOf(result)).not.toMatch(/perAccount/);
  });

  test('caps the series it returns and records the cut in notes', async () => {
    const client = await connect(recordingFetch([], TIMESERIES));

    const result = (await client.callTool({
      name: 'get_equity_timeseries',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    const { portfolio, notes } = result.structuredContent as {
      portfolio: unknown[];
      notes: string[];
    };

    expect(portfolio).toHaveLength(MAX_POINTS);
    expect(notes).toHaveLength(1);
    for (const note of notes) expect(textOf(result)).toContain(note);
  });

  test('returns the API caveats through the wire untouched', async () => {
    const client = await connect(recordingFetch([], TIMESERIES));

    const result = (await client.callTool({
      name: 'get_equity_timeseries',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    const { caveats, portfolioCaveats } = result.structuredContent as Record<string, unknown>;

    expect(caveats).toEqual(TIMESERIES.caveats);
    expect(portfolioCaveats).toEqual(TIMESERIES.portfolioCaveats);
  });

  test('names the performance:read scope on 403', async () => {
    const forbidden = (async () =>
      new Response(
        JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Insufficient scope.' } }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      )) as unknown as typeof fetch;
    const client = await connect(forbidden);

    const result = (await client.callTool({
      name: 'get_equity_timeseries',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('performance:read');
  });

  test('turns a 404 into the login-versus-id hint', async () => {
    const missing = (async () =>
      new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found.' } }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch;
    const client = await connect(missing);

    const result = (await client.callTool({
      name: 'get_equity_timeseries',
      arguments: { accountId: '413878201' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/list_accounts/);
    expect(textOf(result)).toMatch(/login/);
  });

  test('tells the model the series is downsampled and which points always survive', async () => {
    const client = await connect();

    const { tools } = await client.listTools();
    const tool = tools.find((entry) => entry.name === 'get_equity_timeseries');

    // A model that does not know the curve was thinned will read a 200-point
    // answer as every observation the account has.
    expect(tool?.description).toMatch(/downsampl/i);
    expect(tool?.description).toMatch(/deepest drawdown/i);
    expect(tool?.description).toMatch(/`notes`/);
  });
});

/**
 * The wiring `deals.test.ts` cannot reach. The domain module never calls
 * `accountPath`, never builds a URL and never sees the input schema — all three
 * belong to `registerListDeals`, so the query, limit-bound and one-request
 * claims are asserted here, through a real client over a stubbed `fetch`.
 */
describe('list_deals', () => {
  test('builds its path through accountPath — a traversal accountId never reaches the network', async () => {
    let called = false;
    const watching = (async () => {
      called = true;
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;
    const client = await connect(watching);

    const result = (await client.callTool({
      name: 'list_deals',
      arguments: { accountId: '../../admin' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/Invalid path segment/);
    expect(called).toBe(false);
  });

  test('calls the account-scoped path and returns both channels', async () => {
    const calls: string[] = [];
    const client = await connect(recordingFetch(calls, DEALS_PAGE));

    const result = (await client.callTool({
      name: 'list_deals',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect(new URL(calls[0] ?? '').pathname).toBe('/api/v1/accounts/abc-123/deals');
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('ticket 4207514236');
    expect(DealsOutputSchema.safeParse(result.structuredContent).success).toBe(true);
  });

  test('sends limit=50 in the query when the caller omits it', async () => {
    const calls: string[] = [];
    const client = await connect(recordingFetch(calls, DEALS_PAGE));

    await client.callTool({ name: 'list_deals', arguments: { accountId: 'abc-123' } });

    // Explicitly on the URL, not left to the API's own default — which is 100,
    // is unstated in any response, and can change without this server knowing.
    expect(new URL(calls[0] ?? '').searchParams.get('limit')).toBe('50');
  });

  test('sends limit, cursor, entry, from and to to the URL as query parameters', async () => {
    const calls: string[] = [];
    const client = await connect(recordingFetch(calls, DEALS_PAGE));

    await client.callTool({
      name: 'list_deals',
      arguments: {
        accountId: 'abc-123',
        limit: 25,
        cursor: 'eyJ2IjoxfQ',
        entry: 'out',
        from: '2026-07-01',
        to: '2026-07-31T23:59:59Z',
      },
    });

    const url = new URL(calls[0] ?? '');
    expect(url.pathname).toBe('/api/v1/accounts/abc-123/deals');
    expect(url.searchParams.get('limit')).toBe('25');
    expect(url.searchParams.get('cursor')).toBe('eyJ2IjoxfQ');
    expect(url.searchParams.get('entry')).toBe('out');
    expect(url.searchParams.get('from')).toBe('2026-07-01');
    expect(url.searchParams.get('to')).toBe('2026-07-31T23:59:59Z');
  });

  test('leaves an omitted cursor, entry, from or to out of the query string entirely', async () => {
    const calls: string[] = [];
    const client = await connect(recordingFetch(calls, DEALS_PAGE));

    await client.callTool({ name: 'list_deals', arguments: { accountId: 'abc-123' } });

    // Not `entry=undefined`, not `entry=`, not present at all. Only `limit`
    // survives, because only `limit` has a default.
    expect(calls[0]).toBe('https://be-dev.sentitrade.xyz/api/v1/accounts/abc-123/deals?limit=50');
  });

  test('rejects a limit above 500 before the query is built, naming the maximum', async () => {
    let called = false;
    const watching = (async () => {
      called = true;
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;
    const client = await connect(watching);

    const result = (await client.callTool({
      name: 'list_deals',
      arguments: { accountId: 'abc-123', limit: 501 },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('500');
    expect(called).toBe(false);
  });

  test('rejects a limit below 1 before the query is built', async () => {
    let called = false;
    const watching = (async () => {
      called = true;
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;
    const client = await connect(watching);

    const result = (await client.callTool({
      name: 'list_deals',
      arguments: { accountId: 'abc-123', limit: 0 },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(called).toBe(false);
  });

  test('rejects an uppercase entry before the query is built — the API takes in/out', async () => {
    let called = false;
    const watching = (async () => {
      called = true;
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;
    const client = await connect(watching);

    // The response field is `OUT`; the query parameter is `out`. A model that
    // feeds one back as the other gets a 400 from the API about a query
    // parameter — caught here instead, before the request exists.
    const result = (await client.callTool({
      name: 'list_deals',
      arguments: { accountId: 'abc-123', entry: 'OUT' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(called).toBe(false);
  });

  test('rejects a malformed from before the query is built, naming the format', async () => {
    let called = false;
    const watching = (async () => {
      called = true;
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;
    const client = await connect(watching);

    const result = (await client.callTool({
      name: 'list_deals',
      arguments: { accountId: 'abc-123', from: 'last month' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('ISO-8601');
    expect(called).toBe(false);
  });

  test('makes a single request per call, whatever nextCursor holds', async () => {
    const calls: string[] = [];
    // Every page answers with a cursor, so a tool that drained would never
    // stop. Counting the stubbed `fetch` is the assertion — inspecting the
    // output would only show that the last page won, not how many were read.
    const endless = recordingFetch(calls, { ...DEALS_PAGE, nextCursor: 'always-more' });
    const client = await connect(endless);

    const result = (await client.callTool({
      name: 'list_deals',
      arguments: { accountId: 'abc-123', limit: 1 },
    })) as ToolResult;

    expect(calls).toHaveLength(1);
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toMatch(/more deals are available/i);
  });

  test('makes a single request on the last page too', async () => {
    const calls: string[] = [];
    const client = await connect(recordingFetch(calls, DEALS_PAGE));

    await client.callTool({ name: 'list_deals', arguments: { accountId: 'abc-123' } });

    expect(calls).toHaveLength(1);
  });

  test('names the trading:read scope on 403', async () => {
    const forbidden = (async () =>
      new Response(
        JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Insufficient scope.' } }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      )) as unknown as typeof fetch;
    const client = await connect(forbidden);

    const result = (await client.callTool({
      name: 'list_deals',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('trading:read');
  });

  test('turns a 404 into the login-versus-id hint', async () => {
    const missing = (async () =>
      new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found.' } }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch;
    const client = await connect(missing);

    const result = (await client.callTool({
      name: 'list_deals',
      arguments: { accountId: '413878201' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/list_accounts/);
    expect(textOf(result)).toMatch(/login/);
  });

  test('tells the model the page size, the ceiling, and that it must pass the cursor back', async () => {
    const client = await connect();

    const { tools } = await client.listTools();
    const tool = tools.find((entry) => entry.name === 'list_deals');

    // A policy the model is not told is a policy it cannot follow: nothing in
    // the payload says this tool refuses to drain, so the description must.
    expect(tool?.description).toMatch(/defaults to 50/i);
    expect(tool?.description).toMatch(/may not exceed 500/i);
    expect(tool?.description).toMatch(/`cursor`/);
    expect(tool?.description).toMatch(/never pages on its own/i);
  });

  test('declares accountId required and every other parameter optional', async () => {
    const client = await connect();

    const { tools } = await client.listTools();
    const tool = tools.find((entry) => entry.name === 'list_deals');

    expect(tool?.inputSchema.required).toEqual(['accountId']);
    expect(Object.keys(tool?.inputSchema.properties ?? {}).sort()).toEqual([
      'accountId',
      'cursor',
      'entry',
      'from',
      'limit',
      'to',
    ]);
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
  {
    name: 'get_authoring_conventions',
    outputSchema: ConventionsOutputSchema,
    successBody: CONVENTIONS,
  },
  { name: 'list_drafts', outputSchema: DraftsOutputSchema, successBody: [DRAFT] },
  {
    name: 'get_draft',
    arguments: { draftId: 'abc-123' },
    outputSchema: DraftOutputSchema,
    successBody: DRAFT,
  },
  {
    name: 'list_draft_attachments',
    arguments: { draftId: 'abc-123' },
    outputSchema: AttachmentsOutputSchema,
    successBody: [ATTACHMENT],
  },
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
  {
    name: 'list_deals',
    arguments: { accountId: 'abc-123' },
    outputSchema: DealsOutputSchema,
    successBody: DEALS_PAGE,
  },
  {
    name: 'get_account_performance',
    arguments: { accountId: 'abc-123' },
    outputSchema: PerformanceOutputSchema,
    successBody: PERFORMANCE,
  },
  {
    name: 'get_performance_breakdowns',
    arguments: { accountId: 'abc-123' },
    outputSchema: BreakdownsOutputSchema,
    successBody: BREAKDOWNS,
  },
  {
    name: 'get_equity_timeseries',
    arguments: { accountId: 'abc-123' },
    outputSchema: TimeseriesOutputSchema,
    successBody: TIMESERIES,
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

  test('rejects a path-traversal id before any HTTP call, for every account- or draft-scoped tool', async () => {
    // Both `accountPath` and `draftPath` are built over the same private
    // `segmentPath` guard (`core/client.ts`), so one hostile-value check
    // covers every tool keyed on either id.
    const SEGMENT_KEYS = ['accountId', 'draftId'] as const;

    const scopedCalls = TOOL_CALLS.flatMap((call) => {
      const key = SEGMENT_KEYS.find((candidate) => call.arguments && candidate in call.arguments);
      return key ? [{ call, key }] : [];
    });

    for (const { call, key } of scopedCalls) {
      let called = false;
      const watching = (async () => {
        called = true;
        return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
      }) as unknown as typeof fetch;
      const client = await connect(watching);

      const result = (await client.callTool({
        name: call.name,
        arguments: { ...call.arguments, [key]: '../../admin' },
      })) as ToolResult;

      expect(result.isError, call.name).toBe(true);
      expect(textOf(result), call.name).toMatch(/Invalid path segment/);
      // The load-bearing assertion: the path builder throws before
      // `client.get` is entered, so a hostile value never reaches the
      // network at all — materially stronger than a value that reaches the
      // network and is merely rejected server-side.
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

const writeConfig = loadConfig({
  SENTI_API_KEY: 'sq_live_supersecret',
  SENTI_API_BASE_URL: 'https://be-dev.sentitrade.xyz',
  SENTI_ENABLE_AUTHORING_WRITE: '1',
});

async function connectWithWrites(fetchImpl: typeof fetch = okFetch) {
  const server = createServer(writeConfig, { fetch: fetchImpl });
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

/** Grows by one row per write tool as EPIC-8 lands; asserted against tools/list. */
const WRITE_TOOL_ANNOTATIONS: Record<string, { destructive: boolean; idempotent: boolean }> = {
  create_draft: { destructive: false, idempotent: false },
  update_draft: { destructive: true, idempotent: true },
  delete_draft: { destructive: true, idempotent: true },
  add_draft_attachment: { destructive: false, idempotent: false },
  update_draft_attachment: { destructive: true, idempotent: true },
  delete_draft_attachment: { destructive: true, idempotent: true },
};

const READ_TOOL_COUNT = 14;

describe('the authoring write opt-in', () => {
  test('registers no write tool when the flag is unset', async () => {
    const client = await connect();

    const { tools } = await client.listTools();

    expect(tools).toHaveLength(READ_TOOL_COUNT);
    for (const name of Object.keys(WRITE_TOOL_ANNOTATIONS)) {
      expect(tools.map((tool) => tool.name)).not.toContain(name);
    }
  });

  test('registers every write tool when the flag is set', async () => {
    const client = await connectWithWrites();

    const { tools } = await client.listTools();

    expect(tools).toHaveLength(READ_TOOL_COUNT + Object.keys(WRITE_TOOL_ANNOTATIONS).length);
    for (const name of Object.keys(WRITE_TOOL_ANNOTATIONS)) {
      expect(tools.map((tool) => tool.name)).toContain(name);
    }
  });

  test('every write tool carries the annotations the design table states', async () => {
    const client = await connectWithWrites();

    const { tools } = await client.listTools();

    for (const [name, expected] of Object.entries(WRITE_TOOL_ANNOTATIONS)) {
      const tool = tools.find((candidate) => candidate.name === name);

      expect(tool, name).toBeDefined();
      expect(tool?.annotations?.readOnlyHint, name).toBe(false);
      expect(tool?.annotations?.destructiveHint, name).toBe(expected.destructive);
      expect(tool?.annotations?.idempotentHint, name).toBe(expected.idempotent);
      expect(tool?.annotations?.openWorldHint, name).toBe(true);
    }
  });

  test('the read tools are unchanged by the flag', async () => {
    const client = await connectWithWrites();

    const { tools } = await client.listTools();
    const reads = tools.filter((tool) => !(tool.name in WRITE_TOOL_ANNOTATIONS));

    expect(reads).toHaveLength(READ_TOOL_COUNT);
    for (const tool of reads) {
      expect(tool.annotations?.readOnlyHint, `${tool.name} readOnlyHint`).toBe(true);
    }
  });
});
