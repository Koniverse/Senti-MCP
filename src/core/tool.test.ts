import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { McpServer } from '@modelcontextprotocol/server';
import { describe, expect, test } from 'vitest';
import * as z from 'zod/v4';
import { registerReadTool } from './tool.js';

const EchoOutput = z.object({ echoed: z.string() });

type ToolResult = {
  content: { type: string; text?: string }[];
  structuredContent?: unknown;
  isError?: boolean;
};

async function connect(server: McpServer) {
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

function serverWithEcho() {
  const server = new McpServer({ name: 'test', version: '0.0.0' });

  registerReadTool(server, {
    name: 'echo_account',
    title: 'Echo',
    description: 'Echo the accountId back.',
    inputSchema: z.object({ accountId: z.string() }),
    outputSchema: EchoOutput,
    run: async (args) => ({
      text: `got ${args.accountId}`,
      structured: { echoed: args.accountId },
    }),
  });

  return server;
}

function serverWithFailure(error: Error) {
  const server = new McpServer({ name: 'test', version: '0.0.0' });

  registerReadTool(server, {
    name: 'boom',
    title: 'Boom',
    description: 'Always fails.',
    inputSchema: z.object({}),
    outputSchema: EchoOutput,
    run: async () => {
      throw error;
    },
  });

  return server;
}

describe('registerReadTool', () => {
  test('pins the read-only annotations as constants', async () => {
    const client = await connect(serverWithEcho());

    const { tools } = await client.listTools();

    expect(tools[0]?.annotations?.readOnlyHint).toBe(true);
    expect(tools[0]?.annotations?.openWorldHint).toBe(true);
  });

  test('advertises the declared input schema', async () => {
    const client = await connect(serverWithEcho());

    const { tools } = await client.listTools();

    expect(tools[0]?.inputSchema.properties).toHaveProperty('accountId');
  });

  test('passes typed arguments to run and returns both result channels', async () => {
    const client = await connect(serverWithEcho());

    const result = (await client.callTool({
      name: 'echo_account',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect(result.isError).toBeFalsy();
    expect(result.content[0]?.text).toBe('got abc-123');
    expect(result.structuredContent).toEqual({ echoed: 'abc-123' });
  });

  test('turns a thrown error into an isError text result with no structured content', async () => {
    const client = await connect(
      serverWithFailure(new Error('fetch failed', { cause: { code: 'ENOTFOUND' } })),
    );

    const result = (await client.callTool({ name: 'boom' })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('ENOTFOUND');
    expect(result.structuredContent).toBeUndefined();
  });

  test('keeps the session alive after a failure', async () => {
    const client = await connect(serverWithFailure(new Error('boom')));

    await client.callTool({ name: 'boom' });
    const { tools } = await client.listTools();

    expect(tools).toHaveLength(1);
  });
});
