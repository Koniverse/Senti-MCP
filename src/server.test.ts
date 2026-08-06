import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { describe, expect, test } from 'vitest';
import { AccountsOutputSchema } from './tools/accounts/list-accounts.js';
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
  test('exposes exactly the list_accounts tool', async () => {
    const client = await connect();

    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name)).toEqual(['list_accounts']);
  });

  test('tells the model that id, not login, is the handle other tools take', async () => {
    const client = await connect();

    const { tools } = await client.listTools();

    expect(tools[0]?.description).toMatch(/accountId/);
    expect(tools[0]?.description).toMatch(/login/);
  });

  test('takes no arguments', async () => {
    const client = await connect();

    const { tools } = await client.listTools();

    // No `?? {}` — that would pass whether `properties` is `{}` or absent, and
    // the wire genuinely carries `"inputSchema":{"type":"object","properties":{}}`.
    expect(tools[0]?.inputSchema.properties).toEqual({});
  });

  test('advertises itself as read-only against an open world', async () => {
    const client = await connect();

    const { tools } = await client.listTools();

    expect(tools[0]?.annotations?.readOnlyHint).toBe(true);
    expect(tools[0]?.annotations?.openWorldHint).toBe(true);
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

    await client.callTool({ name: 'list_accounts' });
    const { tools } = await client.listTools();

    expect(tools).toHaveLength(1);
  });
});

/**
 * One entry per registered tool. Later tool stories add a row here rather than
 * writing their own leak test — that is the point of the table.
 */
const TOOL_CALLS: { name: string; arguments?: Record<string, unknown> }[] = [
  { name: 'list_accounts' },
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

      expect(textOf(result), call.name).not.toContain('supersecret');
      expect(textOf(result), call.name).not.toMatch(KEY_SHAPED);
    }
  });
});
