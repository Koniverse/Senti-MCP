import type { McpServer } from '@modelcontextprotocol/server';
import type * as z from 'zod/v4';
import { describeError } from './errors.js';

/**
 * What a read tool has to declare. Everything that varies between tools —
 * name, description, schemas, and the work itself — is a field here; nothing
 * that must not vary is.
 */
export type ReadToolSpec<Args, Structured> = {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodType<Args>;
  outputSchema: z.ZodType<Structured>;
  run: (args: Args, signal: AbortSignal) => Promise<{ text: string; structured: Structured }>;
};

/**
 * Register a read tool.
 *
 * The `try`/`catch` is the whole point: a model can read and act on a returned
 * error, but it cannot see a call that died. The annotations are constants
 * rather than parameters, which makes this a mechanical barrier against a
 * write tool reaching this server before EPIC-3 opens.
 *
 * An error result carries `content` only — `structuredContent` would have to
 * satisfy `outputSchema`, and there is no successful payload to describe.
 *
 * Imports from the SDK are `import type` and erase at build time, so
 * `src/server.ts` and `src/index.ts` remain the only files that pull a runtime
 * value out of `@modelcontextprotocol/*`.
 */
export function registerReadTool<Args, Structured>(
  server: McpServer,
  spec: ReadToolSpec<Args, Structured>,
): void {
  server.registerTool(
    spec.name,
    {
      title: spec.title,
      description: spec.description,
      inputSchema: spec.inputSchema,
      outputSchema: spec.outputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args, ctx) => {
      try {
        const { text, structured } = await spec.run(args, ctx.mcpReq.signal);

        return { content: [{ type: 'text' as const, text }], structuredContent: structured };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: describeError(error) }], isError: true };
      }
    },
  );
}
