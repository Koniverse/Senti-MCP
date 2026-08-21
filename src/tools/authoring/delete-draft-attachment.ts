import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import {
  ATTACHMENT_NOT_FOUND,
  AUTHORING_WRITE_SCOPE,
  draftPath,
  type SentiClient,
} from '../../core/client.js';
import { registerWriteTool } from '../../core/tool.js';
import { cancelledDelete, DeleteOutputSchema, formatDeleted, parseDeleted } from './write-result.js';

const AUTHORING_WRITE = 'authoring:write';

export function registerDeleteDraftAttachment(server: McpServer, client: SentiClient): void {
  registerWriteTool(server, {
    name: 'delete_draft_attachment',
    title: 'Delete an indicator attachment',
    description:
      'Remove one indicator file from a draft. THIS CANNOT BE UNDONE and the user is asked ' +
      'to confirm before anything is sent. AFTERWARDS THE EA STILL REFERENCES IT: remove the ' +
      "file's `#resource` and `iCustom` lines from the draft source with update_draft, or " +
      'the next compile_draft fails on a file that is no longer there. Use this to free a ' +
      'slot when add_draft_attachment reports the attachment cap is full, and to rename a ' +
      'file, which the API allows no other way. `attachmentId` is the `id` from ' +
      'list_draft_attachments.',
    inputSchema: z.object({ draftId: z.string(), attachmentId: z.string() }),
    outputSchema: DeleteOutputSchema,
    destructive: true,
    idempotent: true,
    confirm: {
      message: (args) =>
        `Delete indicator ${args.attachmentId} from draft ${args.draftId}? ` +
        'This cannot be undone.',
      cancelled: (args) => cancelledDelete(`Indicator ${args.attachmentId}`),
    },
    run: async (args, signal) => {
      const payload = await client.send(
        'DELETE',
        draftPath(args.draftId, 'attachments', args.attachmentId),
        {
          signal,
          scope: AUTHORING_WRITE,
          forbiddenMeans: AUTHORING_WRITE_SCOPE,
          notFoundMeans: ATTACHMENT_NOT_FOUND,
        },
      );
      const result = parseDeleted(payload, 'deleted attachment');

      return {
        text:
          `${formatDeleted(result, `Indicator ${args.attachmentId}`)}\n\n` +
          "The EA source has not changed. Remove this file's `#resource` and `iCustom` lines " +
          'with update_draft before calling compile_draft, or the compile will fail on a ' +
          'reference to a file that is no longer there.',
        structured: result,
      };
    },
  });
}
