import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { McpServer } from '@modelcontextprotocol/server';
import { describe, expect, test } from 'vitest';
import { loadConfig } from '../../config.js';
import { createClient } from '../../core/client.js';
import { compileAbortHint, registerCompileDraft } from './compile-draft.js';

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

function stub(status: number, body: unknown, headers: Record<string, string> = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string | URL, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json', ...headers },
    });
  }) as unknown as typeof fetch;

  return { calls, fetchImpl };
}

async function connect(fetchImpl: typeof fetch) {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerCompileDraft(server, createClient(config, { fetch: fetchImpl }));

  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return client;
}

const FAILED = {
  ok: false,
  errors: 1,
  warnings: 0,
  diagnostics: [
    {
      severity: 'error',
      file: 'GoldScalper.mq5',
      line: 42,
      column: 7,
      code: 'E123',
      message: 'undeclared identifier',
    },
  ],
  log: 'GoldScalper.mq5(42,7) : error E123: undeclared identifier',
  logTruncated: false,
};

const PASSED = {
  ok: true,
  errors: 0,
  warnings: 2,
  diagnostics: [],
  log: '0 errors, 2 warnings',
  logTruncated: false,
};

const ARGS = { draftId: 'd-1' };

describe('compile_draft', () => {
  test('POSTs to the compile sub-resource with no body and no idempotency key', async () => {
    const { calls, fetchImpl } = stub(200, PASSED);
    const client = await connect(fetchImpl);

    await client.callTool({ name: 'compile_draft', arguments: ARGS });

    expect(calls[0]?.url).toBe('https://be-dev.sentitrade.xyz/api/v1/drafts/d-1/compile');
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.body).toBeUndefined();
    expect((calls[0]?.init.headers as Record<string, string>)['idempotency-key']).toBeUndefined();
  });

  test('a failed build is a SUCCESS result, not an error', async () => {
    const { fetchImpl } = stub(200, FAILED);
    const client = await connect(fetchImpl);

    const result = (await client.callTool({ name: 'compile_draft', arguments: ARGS })) as ToolResult;

    expect(result.isError).toBeFalsy();
    expect(result.content[0]?.text).toContain('Compile FAILED');
    expect(result.structuredContent).toMatchObject({ ok: false, errors: 1 });
  });

  test('a passing build says so and does not offer to register', async () => {
    const { fetchImpl } = stub(200, PASSED);
    const client = await connect(fetchImpl);

    const result = (await client.callTool({ name: 'compile_draft', arguments: ARGS })) as ToolResult;

    expect(result.content[0]?.text).toContain('Compile SUCCEEDED');
    expect(result.content[0]?.text).toContain('2 warning');
    expect(result.content[0]?.text).toContain('not available through this server');
  });

  test('renders every diagnostic with its position', async () => {
    const { fetchImpl } = stub(200, FAILED);
    const client = await connect(fetchImpl);

    const result = (await client.callTool({ name: 'compile_draft', arguments: ARGS })) as ToolResult;

    expect(result.content[0]?.text).toContain('GoldScalper.mq5:42:7');
    expect(result.content[0]?.text).toContain('undeclared identifier');
    expect(result.content[0]?.text).toContain('update_draft');
  });

  test('returns the compiler log whole, and flags a truncated one', async () => {
    const { fetchImpl } = stub(200, { ...FAILED, logTruncated: true });
    const client = await connect(fetchImpl);

    const result = (await client.callTool({ name: 'compile_draft', arguments: ARGS })) as ToolResult;

    expect(result.content[0]?.text).toContain(FAILED.log);
    expect(result.content[0]?.text).toContain('tail only');
  });

  test('rejects a diagnostic of an unexpected shape rather than rendering it wrong', async () => {
    const { fetchImpl } = stub(200, { ...FAILED, diagnostics: [{ unexpected: true }] });
    const client = await connect(fetchImpl);

    const result = (await client.callTool({ name: 'compile_draft', arguments: ARGS })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('compile result');
  });

  test('reports a 409 as the one-per-account compile slot', async () => {
    const { fetchImpl } = stub(409, { error: { code: 'CONFLICT', message: 'Busy.' } });
    const client = await connect(fetchImpl);

    const result = (await client.callTool({ name: 'compile_draft', arguments: ARGS })) as ToolResult;

    expect(result.content[0]?.text).toContain('one per account');
    expect(result.content[0]?.text).toContain('lastCompileStatus');
  });

  test('reports a 503 Retry-After without waiting and without retrying', async () => {
    const { calls, fetchImpl } = stub(
      503,
      { error: { code: 'UNAVAILABLE', message: 'Busy.' } },
      { 'retry-after': '9' },
    );
    const client = await connect(fetchImpl);
    const started = Date.now();

    const result = (await client.callTool({ name: 'compile_draft', arguments: ARGS })) as ToolResult;

    expect(calls).toHaveLength(1);
    expect(result.content[0]?.text).toContain('9 second');
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  test('reports a 502 against the compile server, not the API as a whole', async () => {
    const { fetchImpl } = stub(502, { error: { code: 'UNAVAILABLE', message: 'Down.' } });
    const client = await connect(fetchImpl);

    const result = (await client.callTool({ name: 'compile_draft', arguments: ARGS })) as ToolResult;

    expect(result.content[0]?.text).toContain('compile server');
    expect(result.content[0]?.text).not.toContain(KEY);
  });

  test('advertises itself non-destructive and idempotent', async () => {
    const client = await connect(stub(200, PASSED).fetchImpl);

    const { tools } = await client.listTools();

    expect(tools[0]?.annotations?.readOnlyHint).toBe(false);
    expect(tools[0]?.annotations?.destructiveHint).toBe(false);
    expect(tools[0]?.annotations?.idempotentHint).toBe(true);
  });
});

describe('compileAbortHint', () => {
  test('rewrites a timeout to say the compile is still running', () => {
    const timeout = new DOMException('The operation was aborted.', 'TimeoutError');

    const rewritten = compileAbortHint(timeout, 'd-1') as Error;

    expect(rewritten.message).toContain('does not cancel');
    expect(rewritten.message).toContain('get_draft');
    expect(rewritten.message).toContain('lastCompileStatus');
    expect(rewritten.message).toContain('d-1');
    expect(rewritten.cause).toBe(timeout);
  });

  test('rewrites a caller-side abort the same way', () => {
    const aborted = new DOMException('Aborted.', 'AbortError');

    expect((compileAbortHint(aborted, 'd-1') as Error).message).toContain('409');
  });

  test('leaves every other error exactly as it was', () => {
    const other = new Error('boom');

    expect(compileAbortHint(other, 'd-1')).toBe(other);
  });
});
