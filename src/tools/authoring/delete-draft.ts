import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import {
  AUTHORING_WRITE_SCOPE,
  DRAFT_NOT_FOUND,
  draftPath,
  type SentiClient,
} from '../../core/client.js';
import { registerWriteTool } from '../../core/tool.js';
import { cancelledDelete, DeleteOutputSchema, formatDeleted, parseDeleted } from './write-result.js';

const AUTHORING_WRITE = 'authoring:write';

export function registerDeleteDraft(server: McpServer, client: SentiClient): void {
  registerWriteTool(server, {
    name: 'delete_draft',
    title: 'Delete an MQL5 draft',
    description:
      'Delete one MQL5 draft and every indicator attached to it. THIS CANNOT BE UNDONE and ' +
      'no tool in this server restores a deleted draft — the user is asked to confirm before ' +
      'anything is sent. An EA already registered from this draft is NOT affected; it is a ' +
      'separate resource. Use this to free a slot when create_draft reports the draft cap is ' +
      'full. `draftId` is the `id` from list_drafts — read it back with get_draft first if ' +
      'you are not certain which draft it names.',
    inputSchema: z.object({ draftId: z.string() }),
    outputSchema: DeleteOutputSchema,
    destructive: true,
    idempotent: true,
    confirm: {
      message: (args) =>
        `Delete draft ${args.draftId} and all of its attachments? This cannot be undone.`,
      cancelled: (args) => cancelledDelete(`Draft ${args.draftId}`),
    },
    run: async (args, signal) => {
      const payload = await client.send('DELETE', draftPath(args.draftId), {
        signal,
        scope: AUTHORING_WRITE,
        forbiddenMeans: AUTHORING_WRITE_SCOPE,
        notFoundMeans: DRAFT_NOT_FOUND,
      });
      const result = parseDeleted(payload, 'deleted draft');

      return {
        text:
          `${formatDeleted(result, `Draft ${args.draftId}`)}\n\n` +
          'Any EA already registered from this draft still exists — registering produces a ' +
          'separate resource, and deleting the draft does not remove it.',
        structured: result,
      };
    },
  });
}
