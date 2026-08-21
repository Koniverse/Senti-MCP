import { acceptedContent, inputRequired } from '@modelcontextprotocol/server';
import type { McpServer } from '@modelcontextprotocol/server';
import type * as z from 'zod/v4';
import { describeError } from './errors.js';

const CONFIRM_KEY = 'confirm';
/** Opaque, and load-bearing only against re-asking — see the seam below. */
const CONFIRM_ASKED = 'confirm-asked';

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
 * This file pulls two runtime values out of `@modelcontextprotocol/*` —
 * `inputRequired` and `acceptedContent`, for the confirmation seam — so it is
 * the third such file alongside `src/server.ts` and `src/index.ts`. Everything
 * else it imports from the SDK is `import type` and erases at build time.
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
  /**
   * Present only on operations no other tool in this server can undo
   * (CONTEXT D42). `cancelled` supplies the payload for a declined
   * confirmation, because a non-error result must still satisfy
   * `outputSchema`.
   */
  confirm?: {
    message: (args: Args) => string;
    cancelled: (args: Args) => { text: string; structured: Structured };
  };
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
    async (args, ctx) => {
      if (spec.confirm) {
        // The round is identified by the state we minted, not by the answer:
        // `acceptedContent` reports a decline and a first entry identically —
        // both `undefined` — so branching on it alone re-asks on every decline
        // and spins until the client's round cap. A forged state cannot skip
        // the confirmation; it lands in the cancel branch, because only
        // accepted content reaches `run`.
        if (ctx.mcpReq.requestState() === undefined) {
          return inputRequired({
            requestState: CONFIRM_ASKED,
            inputRequests: {
              [CONFIRM_KEY]: inputRequired.elicit({
                message: spec.confirm.message(args),
                requestedSchema: {
                  type: 'object',
                  properties: {
                    confirm: { type: 'boolean', description: 'Confirm this deletion.' },
                  },
                  required: [CONFIRM_KEY],
                },
              }),
            },
          });
        }

        const answer = acceptedContent<{ confirm?: boolean }>(
          ctx.mcpReq.inputResponses,
          CONFIRM_KEY,
        );

        if (answer?.confirm !== true) {
          // Not an error: `isError` tells a model something malfunctioned and
          // invites a retry, and a user saying no is neither.
          const { text, structured } = spec.confirm.cancelled(args);

          return { content: [{ type: 'text' as const, text }], structuredContent: structured };
        }
      }

      return resultOf(spec.run, args, ctx.mcpReq.signal);
    },
  );
}
