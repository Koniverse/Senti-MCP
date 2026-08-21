import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import {
  ATTACHMENT_NOT_FOUND,
  AUTHORING_WRITE_SCOPE,
  draftPath,
  type SentiClient,
} from '../../core/client.js';
import { registerWriteTool } from '../../core/tool.js';
import {
  AttachmentWriteOutputSchema,
  formatAttachmentWrite,
  parseWrittenAttachment,
  shapeAttachmentWrite,
} from './write-result.js';

const AUTHORING_WRITE = 'authoring:write';

const OVERSIZED_ATTACHMENT =
  'The source exceeds the platform cap for one attachment — see `limits.maxAttachmentBytes` ' +
  'from get_authoring_conventions.';

/** No `filename`: the API forbids the rename, and accepting one it would ignore is worse. */
const InputSchema = z.object({
  draftId: z.string(),
  attachmentId: z.string(),
  sourceCode: z.string(),
});

export function registerUpdateDraftAttachment(server: McpServer, client: SentiClient): void {
  registerWriteTool(server, {
    name: 'update_draft_attachment',
    title: 'Replace an indicator body',
    description:
      "Replace one attached indicator's source. THE FILENAME CANNOT BE CHANGED and this tool " +
      'takes no filename: the EA embeds an indicator by name via `#resource`, so a rename ' +
      'would orphan every reference and turn a working draft into a static-safety violation. ' +
      'To rename, call delete_draft_attachment then add_draft_attachment, and update the EA ' +
      "source too. This is a FULL REPLACE of that file's contents — send the complete " +
      'indicator, not a fragment. `attachmentId` is the `id` from list_draft_attachments. ' +
      'The response does NOT echo your source back.',
    inputSchema: InputSchema,
    outputSchema: AttachmentWriteOutputSchema,
    destructive: true,
    idempotent: true,
    run: async (args, signal) => {
      const payload = await client.send(
        'PUT',
        draftPath(args.draftId, 'attachments', args.attachmentId),
        {
          signal,
          body: { sourceCode: args.sourceCode },
          scope: AUTHORING_WRITE,
          forbiddenMeans: AUTHORING_WRITE_SCOPE,
          notFoundMeans: ATTACHMENT_NOT_FOUND,
          unprocessableMeans: OVERSIZED_ATTACHMENT,
        },
      );
      const shaped = shapeAttachmentWrite(parseWrittenAttachment(payload, 'updated attachment'));

      return {
        text: formatAttachmentWrite(shaped, 'replaced on', args.draftId),
        structured: shaped,
      };
    },
  });
}
