import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { McpServer } from '@modelcontextprotocol/server';
import { describe, expect, test } from 'vitest';
import { loadConfig } from '../../config.js';
import { createClient } from '../../core/client.js';
import { registerDeleteDraftAttachment } from './delete-draft-attachment.js';

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

type ElicitAnswer =
  | { action: 'accept'; content: Record<string, string | number | boolean | string[]> }
  | { action: 'decline' };

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

async function connectAnswering(fetchImpl: typeof fetch, answer: ElicitAnswer) {
  const seen: string[] = [];
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerDeleteDraftAttachment(server, createClient(config, { fetch: fetchImpl }));

  const client = new Client(
    { name: 'test-client', version: '0.0.0' },
    { capabilities: { elicitation: {} } },
  );
  client.setRequestHandler('elicitation/create', async (request) => {
    seen.push(String((request.params as { message?: unknown }).message ?? ''));
    return answer;
  });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return { client, seen };
}

const ACCEPT: ElicitAnswer = { action: 'accept', content: { confirm: true } };
const ARGS = { draftId: 'd-1', attachmentId: 'a-1' };

describe('delete_draft_attachment', () => {
  test('sends nothing until the confirmation is accepted', async () => {
    const { calls, fetchImpl } = stub(200, { id: 'a-1' });
    const { client } = await connectAnswering(fetchImpl, { action: 'decline' });

    const result = (await client.callTool({
      name: 'delete_draft_attachment',
      arguments: ARGS,
    })) as ToolResult;

    expect(calls).toHaveLength(0);
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ id: null, deleted: false });
  });

  test('DELETEs the attachment path once when accepted', async () => {
    const { calls, fetchImpl } = stub(200, { id: 'a-1' });
    const { client } = await connectAnswering(fetchImpl, ACCEPT);

    const result = (await client.callTool({
      name: 'delete_draft_attachment',
      arguments: ARGS,
    })) as ToolResult;

    expect(calls).toHaveLength(1);
    expect(calls[0]?.init.method).toBe('DELETE');
    expect(calls[0]?.url).toBe(
      'https://be-dev.sentitrade.xyz/api/v1/drafts/d-1/attachments/a-1',
    );
    expect(result.structuredContent).toEqual({ id: 'a-1', deleted: true, notes: [] });
  });

  test('warns that the EA still references the file it just removed', async () => {
    const { fetchImpl } = stub(200, { id: 'a-1' });
    const { client } = await connectAnswering(fetchImpl, ACCEPT);

    const result = (await client.callTool({
      name: 'delete_draft_attachment',
      arguments: ARGS,
    })) as ToolResult;

    expect(result.content[0]?.text).toContain('#resource');
    expect(result.content[0]?.text).toContain('update_draft');
    expect(result.content[0]?.text).toContain('compile_draft');
  });

  test('names both ids in the question', async () => {
    const { fetchImpl } = stub(200, { id: 'a-1' });
    const { client, seen } = await connectAnswering(fetchImpl, { action: 'decline' });

    await client.callTool({ name: 'delete_draft_attachment', arguments: ARGS });

    expect(seen[0]).toContain('a-1');
    expect(seen[0]).toContain('d-1');
    expect(seen[0]).toContain('cannot be undone');
  });

  test('reports a 404 as possibly the wrong draft, and leaks no key', async () => {
    const { fetchImpl } = stub(404, { error: { code: 'NOT_FOUND', message: 'Nope.' } });
    const { client } = await connectAnswering(fetchImpl, ACCEPT);

    const result = (await client.callTool({
      name: 'delete_draft_attachment',
      arguments: ARGS,
    })) as ToolResult;

    expect(result.content[0]?.text).toContain('belongs to a different draft');
    expect(result.content[0]?.text).not.toContain(KEY);
  });

  test('advertises itself destructive and idempotent', async () => {
    const { client } = await connectAnswering(stub(200, { id: 'a-1' }).fetchImpl, ACCEPT);

    const { tools } = await client.listTools();

    expect(tools[0]?.annotations?.destructiveHint).toBe(true);
    expect(tools[0]?.annotations?.idempotentHint).toBe(true);
  });
});
