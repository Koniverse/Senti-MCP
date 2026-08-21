import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import {
  DRAFT_CAP_OR_SCOPE,
  DRAFT_NAME_TAKEN,
  newIdempotencyKey,
  type SentiClient,
} from '../../core/client.js';
import { registerWriteTool } from '../../core/tool.js';
import {
  DraftWriteOutputSchema,
  formatDraftWrite,
  parseWrittenDraft,
  shapeDraftWrite,
} from './write-result.js';

const AUTHORING_WRITE = 'authoring:write';
const DRAFTS_PATH = '/api/v1/drafts';

/**
 * `name`'s 1–120 range is declared in the operation's own request schema, so it
 * is transcribed here. `sourceCode`'s byte cap is not: it lives in the runtime
 * `limits` block `get_authoring_conventions` publishes, and a hardcoded copy of
 * a value the API owns drifts silently the day the platform raises it.
 */
const InputSchema = z.object({
  name: z.string().min(1).max(120),
  sourceCode: z.string(),
});

export function registerCreateDraft(server: McpServer, client: SentiClient): void {
  registerWriteTool(server, {
    name: 'create_draft',
    title: 'Create an MQL5 draft',
    description:
      'Create a new MQL5 Expert Advisor draft on the Senti Quant platform from source you ' +
      'have written. CALL get_authoring_conventions FIRST — code that breaks the platform ' +
      'rules is rejected by a static scan before it reaches the compiler, and this tool does ' +
      'not check them for you. `name` is unique per user (1–120 characters) and also derives ' +
      'the `.mq5` filename at compile time. `sourceCode` is the complete EA source; the ' +
      'platform caps its size (see `limits.maxSourceBytes` from get_authoring_conventions) ' +
      'and rejects an oversized body rather than truncating it. The response does NOT echo ' +
      'your source back — it returns the new `id`, the byte count written, and the compile ' +
      'state. NOTHING IS COMPILED until you call compile_draft.',
    inputSchema: InputSchema,
    outputSchema: DraftWriteOutputSchema,
    destructive: false,
    idempotent: false,
    run: async (args, signal) => {
      const body = { name: args.name, sourceCode: args.sourceCode };

      const payload = await client.send('POST', DRAFTS_PATH, {
        signal,
        body,
        idempotencyKey: newIdempotencyKey(),
        scope: AUTHORING_WRITE,
        forbiddenMeans: DRAFT_CAP_OR_SCOPE,
        conflictMeans: DRAFT_NAME_TAKEN,
      });
      const shaped = shapeDraftWrite(parseWrittenDraft(payload, 'created draft'));

      return { text: formatDraftWrite(shaped, 'created'), structured: shaped };
    },
  });
}
