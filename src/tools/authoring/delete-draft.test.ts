import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { McpServer } from '@modelcontextprotocol/server';
import { describe, expect, test } from 'vitest';
import { loadConfig } from '../../config.js';
import { createClient } from '../../core/client.js';
import { registerDeleteDraft } from './delete-draft.js';

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
  registerDeleteDraft(server, createClient(config, { fetch: fetchImpl }));

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
const ARGS = { draftId: 'd-1' };

describe('delete_draft', () => {
  test('sends nothing until the confirmation is accepted', async () => {
    const { calls, fetchImpl } = stub(200, { id: 'd-1' });
    const { client } = await connectAnswering(fetchImpl, { action: 'decline' });

    const result = (await client.callTool({ name: 'delete_draft', arguments: ARGS })) as ToolResult;

    expect(calls).toHaveLength(0);
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      id: null,
      deleted: false,
      notes: ['The confirmation was declined, so no request was sent to the Senti API.'],
    });
  });

  test('names the draft in the question and says it cannot be undone', async () => {
    const { fetchImpl } = stub(200, { id: 'd-1' });
    const { client, seen } = await connectAnswering(fetchImpl, { action: 'decline' });

    await client.callTool({ name: 'delete_draft', arguments: ARGS });

    expect(seen[0]).toContain('d-1');
    expect(seen[0]).toContain('cannot be undone');
    expect(seen[0]).toContain('attachments');
  });

  test('DELETEs once when accepted, and reports the deleted id', async () => {
    const { calls, fetchImpl } = stub(200, { id: 'd-1' });
    const { client } = await connectAnswering(fetchImpl, ACCEPT);

    const result = (await client.callTool({ name: 'delete_draft', arguments: ARGS })) as ToolResult;

    expect(calls).toHaveLength(1);
    expect(calls[0]?.init.method).toBe('DELETE');
    expect(calls[0]?.url).toBe('https://be-dev.sentitrade.xyz/api/v1/drafts/d-1');
    expect(calls[0]?.init.body).toBeUndefined();
    expect(result.structuredContent).toEqual({ id: 'd-1', deleted: true, notes: [] });
  });

  test('says a registered EA survives the draft', async () => {
    const { fetchImpl } = stub(200, { id: 'd-1' });
    const { client } = await connectAnswering(fetchImpl, ACCEPT);

    const result = (await client.callTool({ name: 'delete_draft', arguments: ARGS })) as ToolResult;

    expect(result.content[0]?.text).toMatch(/registered from this draft still exists/i);
  });

  test('rejects a traversal draftId before the confirmation is even asked', async () => {
    const { calls, fetchImpl } = stub(200, { id: 'd-1' });
    const { client, seen } = await connectAnswering(fetchImpl, ACCEPT);

    const result = (await client.callTool({
      name: 'delete_draft',
      arguments: { draftId: '../../admin' },
    })) as ToolResult;

    expect(calls).toHaveLength(0);
    expect(result.isError).toBe(true);
    expect(seen).toHaveLength(1);
  });

  test('reports a 404 as a missing draft, and leaks no key', async () => {
    const { fetchImpl } = stub(404, { error: { code: 'NOT_FOUND', message: 'No draft.' } });
    const { client } = await connectAnswering(fetchImpl, ACCEPT);

    const result = (await client.callTool({
      name: 'delete_draft',
      arguments: { draftId: 'd-9' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('list_drafts');
    expect(result.content[0]?.text).not.toContain(KEY);
  });

  test('advertises itself destructive and idempotent', async () => {
    const { client } = await connectAnswering(stub(200, { id: 'd-1' }).fetchImpl, ACCEPT);

    const { tools } = await client.listTools();

    expect(tools[0]?.annotations?.readOnlyHint).toBe(false);
    expect(tools[0]?.annotations?.destructiveHint).toBe(true);
    expect(tools[0]?.annotations?.idempotentHint).toBe(true);
  });
});
