import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { McpServer } from '@modelcontextprotocol/server';
import { describe, expect, test } from 'vitest';
import { loadConfig } from '../../config.js';
import { createClient } from '../../core/client.js';
import { registerUpdateDraft } from './update-draft.js';

const KEY = 'sq_live_supersecret';
const config = loadConfig({
  SENTI_API_KEY: KEY,
  SENTI_API_BASE_URL: 'https://be-dev.sentitrade.xyz',
  SENTI_ENABLE_AUTHORING_WRITE: '1',
});

type ToolResult = {
  content: { type: string; text?: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

function stub(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string | URL, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;

  return { calls, fetchImpl };
}

async function connect(fetchImpl: typeof fetch) {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerUpdateDraft(server, createClient(config, { fetch: fetchImpl }));

  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return client;
}

const UPDATED = {
  id: 'd-1',
  name: 'Gold Scalper',
  sourceCode: '// v2',
  createdAt: '2026-08-14T09:22:41.318Z',
  updatedAt: '2026-08-21T10:00:00.000Z',
  lastCompileStatus: 'SUCCESS',
  lastCompileLog: 'ok',
  logTruncated: false,
  lastCompileDiagnostics: [],
  compiledUpToDate: false,
  eaDefinitionId: null,
  attachments: [],
};

const ARGS = { draftId: 'd-1', name: 'Gold Scalper', sourceCode: '// v2' };

describe('update_draft', () => {
  test('PUTs the whole draft to the id path', async () => {
    const { calls, fetchImpl } = stub(200, UPDATED);
    const client = await connect(fetchImpl);

    await client.callTool({ name: 'update_draft', arguments: ARGS });

    expect(calls[0]?.url).toBe('https://be-dev.sentitrade.xyz/api/v1/drafts/d-1');
    expect(calls[0]?.init.method).toBe('PUT');
    expect(calls[0]?.init.body).toBe(
      JSON.stringify({ name: 'Gold Scalper', sourceCode: '// v2' }),
    );
  });

  test('sends no Idempotency-Key, which this route does not accept', async () => {
    const { calls, fetchImpl } = stub(200, UPDATED);
    const client = await connect(fetchImpl);

    await client.callTool({ name: 'update_draft', arguments: ARGS });

    expect((calls[0]?.init.headers as Record<string, string>)['idempotency-key']).toBeUndefined();
  });

  test('says full replace, so a partial body is not mistaken for a patch', async () => {
    const { fetchImpl } = stub(200, UPDATED);
    const client = await connect(fetchImpl);

    const result = (await client.callTool({ name: 'update_draft', arguments: ARGS })) as ToolResult;

    expect(result.content[0]?.text).toContain('full replace');
  });

  test('warns that the previous compile no longer matches the source', async () => {
    const { fetchImpl } = stub(200, UPDATED);
    const client = await connect(fetchImpl);

    const result = (await client.callTool({ name: 'update_draft', arguments: ARGS })) as ToolResult;

    expect(result.content[0]?.text).toContain('recompile');
  });

  test('does not echo the source back', async () => {
    const { fetchImpl } = stub(200, UPDATED);
    const client = await connect(fetchImpl);

    const result = (await client.callTool({ name: 'update_draft', arguments: ARGS })) as ToolResult;

    expect(JSON.stringify(result)).not.toContain('// v2');
    expect(result.structuredContent?.sourceBytes).toBe(5);
  });

  test('rejects a traversal draftId before a request is made', async () => {
    const { calls, fetchImpl } = stub(200, UPDATED);
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'update_draft',
      arguments: { ...ARGS, draftId: '../../admin' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(calls).toHaveLength(0);
  });

  test('reports a 404 as a missing draft, not a missing route', async () => {
    const { fetchImpl } = stub(404, { error: { code: 'NOT_FOUND', message: 'No draft.' } });
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'update_draft',
      arguments: { ...ARGS, draftId: 'd-9' },
    })) as ToolResult;

    expect(result.content[0]?.text).toContain('list_drafts');
  });

  test('reports a 409 as a name another draft already holds', async () => {
    const { fetchImpl } = stub(409, { error: { code: 'CONFLICT', message: 'Name taken.' } });
    const client = await connect(fetchImpl);

    const result = (await client.callTool({ name: 'update_draft', arguments: ARGS })) as ToolResult;

    expect(result.content[0]?.text).toContain('unique per user');
  });

  test('reports a 403 as a missing scope, since this route has no cap', async () => {
    const { fetchImpl } = stub(403, { error: { code: 'FORBIDDEN', message: 'Nope.' } });
    const client = await connect(fetchImpl);

    const result = (await client.callTool({ name: 'update_draft', arguments: ARGS })) as ToolResult;

    expect(result.content[0]?.text).toContain('authoring:write');
    expect(result.content[0]?.text).not.toContain('delete_draft');
    expect(result.content[0]?.text).not.toContain(KEY);
  });

  test('advertises itself destructive, because a partial body destroys the rest', async () => {
    const client = await connect(stub(200, UPDATED).fetchImpl);

    const { tools } = await client.listTools();

    expect(tools[0]?.annotations?.destructiveHint).toBe(true);
    expect(tools[0]?.annotations?.idempotentHint).toBe(true);
  });

  test('requires both name and sourceCode, mirroring the API rather than softening it', async () => {
    const client = await connect(stub(200, UPDATED).fetchImpl);

    const { tools } = await client.listTools();
    const schema = tools[0]?.inputSchema as { required?: string[] };

    expect(schema.required?.sort()).toEqual(['draftId', 'name', 'sourceCode']);
  });
});
