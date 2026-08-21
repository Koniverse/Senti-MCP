import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { McpServer } from '@modelcontextprotocol/server';
import { describe, expect, test } from 'vitest';
import { loadConfig } from '../../config.js';
import { createClient } from '../../core/client.js';
import { registerAddDraftAttachment } from './add-draft-attachment.js';

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
  registerAddDraftAttachment(server, createClient(config, { fetch: fetchImpl }));

  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return client;
}

export const ATTACHED = {
  id: 'a-1',
  filename: 'TrendFilter.mq5',
  sourceCode: '#property indicator_chart_window',
  createdAt: '2026-08-21T09:05:00.000Z',
};

const ARGS = { draftId: 'd-1', filename: 'TrendFilter.mq5', sourceCode: '#property x' };

describe('add_draft_attachment', () => {
  test('POSTs to the attachments sub-resource with an idempotency key', async () => {
    const { calls, fetchImpl } = stub(201, ATTACHED);
    const client = await connect(fetchImpl);

    await client.callTool({ name: 'add_draft_attachment', arguments: ARGS });

    expect(calls[0]?.url).toBe('https://be-dev.sentitrade.xyz/api/v1/drafts/d-1/attachments');
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.body).toBe(
      JSON.stringify({ filename: 'TrendFilter.mq5', sourceCode: '#property x' }),
    );
    expect((calls[0]?.init.headers as Record<string, string>)['idempotency-key']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-/,
    );
  });

  test('tells the model how to wire the indicator into the EA', async () => {
    const { fetchImpl } = stub(201, ATTACHED);
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'add_draft_attachment',
      arguments: ARGS,
    })) as ToolResult;

    expect(result.content[0]?.text).toContain('#resource "TrendFilter.ex5"');
    expect(result.content[0]?.text).toContain('iCustom');
    expect(result.content[0]?.text).toContain('update_draft');
  });

  test('does not echo the source back', async () => {
    const { fetchImpl } = stub(201, ATTACHED);
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'add_draft_attachment',
      arguments: ARGS,
    })) as ToolResult;

    expect(JSON.stringify(result)).not.toContain('indicator_chart_window');
    expect(result.structuredContent?.sourceBytes).toBe(32);
  });

  test('reports a filename collision as case-insensitive, with the reason', async () => {
    const { fetchImpl } = stub(409, { error: { code: 'CONFLICT', message: 'Exists.' } });
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'add_draft_attachment',
      arguments: { ...ARGS, filename: 'myind.mq5' },
    })) as ToolResult;

    expect(result.content[0]?.text).toContain('case-insensitively');
    expect(result.content[0]?.text).toContain('flat Windows directory');
  });

  test('reports a 422 as a filename or size problem, not a missing draft', async () => {
    const { fetchImpl } = stub(422, { error: { code: 'INVALID_BODY', message: 'Bad name.' } });
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'add_draft_attachment',
      arguments: { ...ARGS, filename: 'sub/dir.mq5' },
    })) as ToolResult;

    expect(result.content[0]?.text).toContain('bare');
    expect(result.content[0]?.text).not.toContain('list_drafts');
  });

  test('reports a full attachment cap as something a retry will not fix', async () => {
    const { fetchImpl } = stub(403, { error: { code: 'FORBIDDEN', message: 'Cap.' } });
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'add_draft_attachment',
      arguments: ARGS,
    })) as ToolResult;

    expect(result.content[0]?.text).toContain('delete_draft_attachment');
    expect(result.content[0]?.text).not.toContain(KEY);
  });

  test('reports a 404 against the draft, which is the only id in the path', async () => {
    const { fetchImpl } = stub(404, { error: { code: 'NOT_FOUND', message: 'No draft.' } });
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'add_draft_attachment',
      arguments: ARGS,
    })) as ToolResult;

    expect(result.content[0]?.text).toContain('list_drafts');
  });

  test('advertises itself as a non-destructive, non-idempotent write', async () => {
    const client = await connect(stub(201, ATTACHED).fetchImpl);

    const { tools } = await client.listTools();

    expect(tools[0]?.annotations?.destructiveHint).toBe(false);
    expect(tools[0]?.annotations?.idempotentHint).toBe(false);
  });
});
