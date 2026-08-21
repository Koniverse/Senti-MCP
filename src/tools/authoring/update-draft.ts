import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import {
  AUTHORING_WRITE_SCOPE,
  DRAFT_NAME_TAKEN,
  DRAFT_NOT_FOUND,
  draftPath,
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

/**
 * Both `name` and `sourceCode` are required because the API requires them.
 * Making `name` optional would need the current value, which only a second
 * `GET` supplies — a hidden read that doubles the latency of every edit and
 * races any concurrent writer.
 */
const InputSchema = z.object({
  draftId: z.string(),
  name: z.string().min(1).max(120),
  sourceCode: z.string(),
});

export function registerUpdateDraft(server: McpServer, client: SentiClient): void {
  registerWriteTool(server, {
    name: 'update_draft',
    title: 'Replace an MQL5 draft',
    description:
      'Replace an existing MQL5 draft. THIS IS A FULL REPLACE, NOT A PATCH: both `name` and ' +
      '`sourceCode` are always written, so send the COMPLETE draft every time. Sending only ' +
      'the part you changed DELETES THE REST OF THE FILE — the API has no partial-update ' +
      'verb. If you do not have the current source in front of you, call get_draft first. ' +
      '`draftId` is the `id` from list_drafts. Renaming to a name another draft already ' +
      'holds is rejected. This compiles nothing: call compile_draft afterwards, because any ' +
      'previous successful compile no longer matches the new source. The response does NOT ' +
      'echo your source back.',
    inputSchema: InputSchema,
    outputSchema: DraftWriteOutputSchema,
    destructive: true,
    idempotent: true,
    run: async (args, signal) => {
      const payload = await client.send('PUT', draftPath(args.draftId), {
        signal,
        body: { name: args.name, sourceCode: args.sourceCode },
        scope: AUTHORING_WRITE,
        forbiddenMeans: AUTHORING_WRITE_SCOPE,
        notFoundMeans: DRAFT_NOT_FOUND,
        conflictMeans: DRAFT_NAME_TAKEN,
      });
      const shaped = shapeDraftWrite(parseWrittenDraft(payload, 'updated draft'));

      return { text: formatDraftWrite(shaped, 'updated'), structured: shaped };
    },
  });
}
