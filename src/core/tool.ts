import type { McpServer } from '@modelcontextprotocol/server';
import type * as z from 'zod/v4';
import { describeError } from './errors.js';

type ToolRun<Args, Structured> = (
  args: Args,
  signal: AbortSignal,
) => Promise<{ text: string; structured: Structured }>;

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
  run: ToolRun<Args, Structured>;
};

/**
 * The try/catch both registrars share: a model can read and act on a returned
 * error, but it cannot see a call that died. An error result carries `content`
 * only — `structuredContent` would have to satisfy `outputSchema`, and there is
 * no successful payload to describe.
 */
async function resultOf<Args, Structured>(
  run: ToolRun<Args, Structured>,
  args: Args,
  signal: AbortSignal,
) {
  try {
    const { text, structured } = await run(args, signal);

    return { content: [{ type: 'text' as const, text }], structuredContent: structured };
  } catch (error) {
    return { content: [{ type: 'text' as const, text: describeError(error) }], isError: true };
  }
}

/**
 * Register a read tool.
 *
 * The annotations are constants rather than parameters, which makes this a
 * mechanical barrier: no call to this function can register a write, whatever
 * its arguments. Write tools go through `registerWriteTool` below — a separate
 * door with its own name, not a flag on this one (CONTEXT D38).
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
    async (args, ctx) => resultOf(spec.run, args, ctx.mcpReq.signal),
  );
}

export type WriteToolSpec<Args, Structured> = {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodType<Args>;
  outputSchema: z.ZodType<Structured>;
  /**
   * A full replace with a partial body destroys the rest of the file, so this
   * is `true` for `update_draft` despite its name.
   */
  destructive: boolean;
  idempotent: boolean;
  run: ToolRun<Args, Structured>;
};

/**
 * Register a write tool.
 *
 * A second function rather than a flag on `registerReadTool`, so that
 * registrar's `readOnlyHint: true` stays a constant no caller can get wrong
 * (CONTEXT D38). The mechanical barrier is that no call to `registerReadTool`
 * can produce a write, whatever its arguments.
 */
export function registerWriteTool<Args, Structured>(
  server: McpServer,
  spec: WriteToolSpec<Args, Structured>,
): void {
  server.registerTool(
    spec.name,
    {
      title: spec.title,
      description: spec.description,
      inputSchema: spec.inputSchema,
      outputSchema: spec.outputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: spec.destructive,
        idempotentHint: spec.idempotent,
        openWorldHint: true,
      },
    },
    async (args, ctx) => resultOf(spec.run, args, ctx.mcpReq.signal),
  );
}
