import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import {
  ATTACHMENT_CAP_OR_SCOPE,
  ATTACHMENT_FILENAME_TAKEN,
  DRAFT_NOT_FOUND,
  draftPath,
  newIdempotencyKey,
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

/**
 * The API states the filename rule precisely in its own 422; restating it as a
 * second client-side check would be a second thing to keep in sync.
 */
const BAD_ATTACHMENT =
  'The filename must be a bare Windows-safe basename ending in `.mq5` — no folders, no path ' +
  'separators, no `.ex5` — or the source exceeds the platform cap for one attachment (see ' +
  '`limits.maxAttachmentBytes` from get_authoring_conventions).';

const InputSchema = z.object({
  draftId: z.string(),
  filename: z.string().min(1),
  sourceCode: z.string(),
});

export function registerAddDraftAttachment(server: McpServer, client: SentiClient): void {
  registerWriteTool(server, {
    name: 'add_draft_attachment',
    title: 'Attach an indicator to a draft',
    description:
      'Attach one MQL5 indicator source file to a draft, so the EA can embed it. `filename` ' +
      'must be a bare basename ending in `.mq5` — no folders, no path separators, no `.ex5` ' +
      '— and is unique within the draft CASE-INSENSITIVELY, so "MyInd.mq5" collides with ' +
      '"myind.mq5". ATTACHING DOES NOT WIRE IT UP: the EA must reference the file with ' +
      '`#resource "<stem>.ex5"` and `iCustom(_Symbol, _Period, "::<stem>.ex5", …)`, which ' +
      'means calling update_draft on the EA source afterwards, or the file is compiled and ' +
      'never used. The platform caps how many attachments one draft may hold and how large ' +
      'each may be — see get_authoring_conventions. The response does NOT echo your source ' +
      'back.',
    inputSchema: InputSchema,
    outputSchema: AttachmentWriteOutputSchema,
    destructive: false,
    idempotent: false,
    run: async (args, signal) => {
      const path = draftPath(args.draftId, 'attachments');

      const payload = await client.send('POST', path, {
        signal,
        body: { filename: args.filename, sourceCode: args.sourceCode },
        idempotencyKey: newIdempotencyKey(),
        scope: AUTHORING_WRITE,
        forbiddenMeans: ATTACHMENT_CAP_OR_SCOPE,
        notFoundMeans: DRAFT_NOT_FOUND,
        conflictMeans: ATTACHMENT_FILENAME_TAKEN,
        unprocessableMeans: BAD_ATTACHMENT,
      });
      const shaped = shapeAttachmentWrite(parseWrittenAttachment(payload, 'created attachment'));

      return {
        text: formatAttachmentWrite(shaped, 'attached to', args.draftId),
        structured: shaped,
      };
    },
  });
}
