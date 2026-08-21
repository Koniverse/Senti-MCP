import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { McpServer } from '@modelcontextprotocol/server';
import { describe, expect, test } from 'vitest';
import { loadConfig } from '../../config.js';
import { createClient } from '../../core/client.js';
import { registerUpdateDraftAttachment } from './update-draft-attachment.js';

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
  registerUpdateDraftAttachment(server, createClient(config, { fetch: fetchImpl }));

  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return client;
}

const ATTACHED = {
  id: 'a-1',
  filename: 'TrendFilter.mq5',
  sourceCode: '#property indicator_chart_window',
  createdAt: '2026-08-21T09:05:00.000Z',
};

const ARGS = { draftId: 'd-1', attachmentId: 'a-1', sourceCode: '#property y' };

describe('update_draft_attachment', () => {
  test('PUTs only the source to the attachment path', async () => {
    const { calls, fetchImpl } = stub(200, ATTACHED);
    const client = await connect(fetchImpl);

    await client.callTool({ name: 'update_draft_attachment', arguments: ARGS });

    expect(calls[0]?.url).toBe(
      'https://be-dev.sentitrade.xyz/api/v1/drafts/d-1/attachments/a-1',
    );
    expect(calls[0]?.init.method).toBe('PUT');
    expect(calls[0]?.init.body).toBe(JSON.stringify({ sourceCode: '#property y' }));
  });

  test('takes no filename, because the API forbids the rename', async () => {
    const client = await connect(stub(200, ATTACHED).fetchImpl);

    const { tools } = await client.listTools();
    const schema = tools[0]?.inputSchema as { properties?: Record<string, unknown> };

    expect(Object.keys(schema.properties ?? {}).sort()).toEqual([
      'attachmentId',
      'draftId',
      'sourceCode',
    ]);
  });

  test('says how to rename, since it cannot', async () => {
    const client = await connect(stub(200, ATTACHED).fetchImpl);

    const { tools } = await client.listTools();

    expect(tools[0]?.description).toContain('delete_draft_attachment');
    expect(tools[0]?.description).toContain('#resource');
  });

  test('sends no Idempotency-Key, which this route does not accept', async () => {
    const { calls, fetchImpl } = stub(200, ATTACHED);
    const client = await connect(fetchImpl);

    await client.callTool({ name: 'update_draft_attachment', arguments: ARGS });

    expect((calls[0]?.init.headers as Record<string, string>)['idempotency-key']).toBeUndefined();
  });

  test('reports a 404 as possibly the wrong draft, which the draft 404 does not cover', async () => {
    const { fetchImpl } = stub(404, { error: { code: 'NOT_FOUND', message: 'No attachment.' } });
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'update_draft_attachment',
      arguments: { ...ARGS, attachmentId: 'a-9' },
    })) as ToolResult;

    expect(result.content[0]?.text).toContain('belongs to a different draft');
    expect(result.content[0]?.text).toContain('list_draft_attachments');
  });

  test('reports a 422 as an oversized source', async () => {
    const { fetchImpl } = stub(422, { error: { code: 'INVALID_BODY', message: 'Too big.' } });
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'update_draft_attachment',
      arguments: ARGS,
    })) as ToolResult;

    expect(result.content[0]?.text).toContain('maxAttachmentBytes');
  });

  test('rejects a traversal attachmentId before a request is made', async () => {
    const { calls, fetchImpl } = stub(200, ATTACHED);
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'update_draft_attachment',
      arguments: { ...ARGS, attachmentId: '../../admin' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(calls).toHaveLength(0);
  });

  test('does not echo the source back, and says nothing about wiring', async () => {
    const { fetchImpl } = stub(200, ATTACHED);
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'update_draft_attachment',
      arguments: ARGS,
    })) as ToolResult;

    expect(JSON.stringify(result)).not.toContain('indicator_chart_window');
    expect(result.content[0]?.text).not.toContain('#resource');
    expect(result.content[0]?.text).toContain('replaced on draft d-1');
  });

  test('advertises itself destructive, being a full replace of that file', async () => {
    const client = await connect(stub(200, ATTACHED).fetchImpl);

    const { tools } = await client.listTools();

    expect(tools[0]?.annotations?.destructiveHint).toBe(true);
    expect(tools[0]?.annotations?.idempotentHint).toBe(true);
  });
});
