import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { McpServer } from '@modelcontextprotocol/server';
import { describe, expect, test } from 'vitest';
import { loadConfig } from '../../config.js';
import { createClient } from '../../core/client.js';
import { registerCreateDraft } from './create-draft.js';

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
  registerCreateDraft(server, createClient(config, { fetch: fetchImpl }));

  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return client;
}

const CREATED = {
  id: 'd-1',
  name: 'Gold Scalper',
  sourceCode: '// hello',
  createdAt: '2026-08-21T09:00:00.000Z',
  updatedAt: '2026-08-21T09:00:00.000Z',
  lastCompileStatus: null,
  lastCompileLog: null,
  logTruncated: false,
  lastCompileDiagnostics: [],
  compiledUpToDate: false,
  eaDefinitionId: null,
  attachments: [],
};

const ARGS = { name: 'Gold Scalper', sourceCode: '// hello' };

describe('create_draft', () => {
  test('POSTs name and sourceCode to /api/v1/drafts with an idempotency key', async () => {
    const { calls, fetchImpl } = stub(201, CREATED);
    const client = await connect(fetchImpl);

    await client.callTool({ name: 'create_draft', arguments: ARGS });

    expect(calls[0]?.url).toBe('https://be-dev.sentitrade.xyz/api/v1/drafts');
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.body).toBe(JSON.stringify(ARGS));
    expect((calls[0]?.init.headers as Record<string, string>)['idempotency-key']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-/,
    );
  });

  test('mints a fresh idempotency key per call, never one derived from the body', async () => {
    // A body-derived key replays the original 201 forever, and an idempotency
    // record outlives a delete — so create -> delete -> identical create would
    // hand back a draftId that no longer exists (CONTEXT D43).
    const { calls, fetchImpl } = stub(201, CREATED);
    const client = await connect(fetchImpl);

    await client.callTool({ name: 'create_draft', arguments: ARGS });
    await client.callTool({ name: 'create_draft', arguments: ARGS });

    const first = (calls[0]?.init.headers as Record<string, string>)['idempotency-key'];
    const second = (calls[1]?.init.headers as Record<string, string>)['idempotency-key'];
    expect(first).toBeDefined();
    expect(second).not.toBe(first);
  });

  test('does not echo the source back, in either half of the result', async () => {
    const { fetchImpl } = stub(201, CREATED);
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'create_draft',
      arguments: ARGS,
    })) as ToolResult;

    expect(JSON.stringify(result)).not.toContain('// hello');
    expect(result.structuredContent?.sourceBytes).toBe(8);
  });

  test('reports the new draft id, which is what every later call needs', async () => {
    const { fetchImpl } = stub(201, CREATED);
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'create_draft',
      arguments: ARGS,
    })) as ToolResult;

    expect(result.isError).toBeFalsy();
    expect(result.content[0]?.text).toContain('d-1');
    expect(result.content[0]?.text).toContain('never compiled');
  });

  test('reports a full draft cap as something a retry will not fix', async () => {
    const { fetchImpl } = stub(403, { error: { code: 'FORBIDDEN', message: 'Draft limit.' } });
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'create_draft',
      arguments: ARGS,
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('delete_draft');
    expect(result.content[0]?.text).not.toContain('not that the account is off limits');
  });

  test('reports a duplicate name as a name collision', async () => {
    const { fetchImpl } = stub(409, { error: { code: 'CONFLICT', message: 'Name taken.' } });
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'create_draft',
      arguments: ARGS,
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('unique per user');
  });

  test('reports an oversized body as the gateway limit, not a platform cap', async () => {
    const { fetchImpl } = stub(413, { error: { code: 'INVALID_BODY', message: 'Too large.' } });
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'create_draft',
      arguments: ARGS,
    })) as ToolResult;

    expect(result.content[0]?.text).toContain('1 MB');
  });

  test('leaks the API key in no error branch', async () => {
    for (const status of [401, 403, 409, 413, 422, 429, 500]) {
      const { fetchImpl } = stub(status, { error: { code: 'INTERNAL', message: 'Boom.' } });
      const client = await connect(fetchImpl);

      const result = (await client.callTool({
        name: 'create_draft',
        arguments: ARGS,
      })) as ToolResult;

      expect(result.content[0]?.text, `status ${status}`).not.toContain(KEY);
    }
  });

  test('rejects an empty name before a request is made', async () => {
    const { calls, fetchImpl } = stub(201, CREATED);
    const client = await connect(fetchImpl);

    await client
      .callTool({ name: 'create_draft', arguments: { name: '', sourceCode: '// hello' } })
      .catch(() => undefined);

    expect(calls).toHaveLength(0);
  });

  test('rejects a name over 120 characters before a request is made', async () => {
    const { calls, fetchImpl } = stub(201, CREATED);
    const client = await connect(fetchImpl);

    await client
      .callTool({ name: 'create_draft', arguments: { name: 'x'.repeat(121), sourceCode: '//' } })
      .catch(() => undefined);

    expect(calls).toHaveLength(0);
  });

  test('does not police the source size, which the API owns and publishes', async () => {
    const { calls, fetchImpl } = stub(201, CREATED);
    const client = await connect(fetchImpl);

    await client.callTool({
      name: 'create_draft',
      arguments: { name: 'Gold Scalper', sourceCode: 'x'.repeat(300_000) },
    });

    expect(calls).toHaveLength(1);
  });

  test('advertises itself as a non-destructive, non-idempotent write', async () => {
    const client = await connect(stub(201, CREATED).fetchImpl);

    const { tools } = await client.listTools();

    expect(tools[0]?.annotations?.readOnlyHint).toBe(false);
    expect(tools[0]?.annotations?.destructiveHint).toBe(false);
    expect(tools[0]?.annotations?.idempotentHint).toBe(false);
  });
});
