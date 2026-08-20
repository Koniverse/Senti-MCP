import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { DRAFT_NOT_FOUND, draftPath, type SentiClient } from '../../core/client.js';
import { parseOrThrow } from '../../core/parse.js';
import { registerReadTool } from '../../core/tool.js';
import {
  type Attachment,
  AttachmentSchema,
  AttachmentSummarySchema,
  byteLength,
} from './get-draft.js';

/** `maxAttachmentBytes` from GET /api/v1/authoring/conventions, measured 2026-08-19. */
export const ATTACHMENT_BUDGET_BYTES = 65_536;

const AttachmentEntrySchema = AttachmentSummarySchema.extend({
  sourceCode: z.string().nullable(),
});

export const AttachmentsOutputSchema = z.object({
  attachments: z.array(AttachmentEntrySchema),
  notes: z.array(z.string()),
});

export type ShapedAttachments = z.infer<typeof AttachmentsOutputSchema>;

type Entry = ShapedAttachments['attachments'][number];

export function parseAttachments(payload: unknown): Attachment[] {
  return parseOrThrow(z.array(AttachmentSchema), payload, 'draft attachment list');
}

function entry(attachment: Attachment, bytes: number, withSource: boolean): Entry {
  const { sourceCode, ...kept } = attachment;

  return { ...kept, sourceBytes: bytes, sourceCode: withSource ? sourceCode : null };
}

export function shapeAttachments(
  attachments: Attachment[],
  filename?: string,
): ShapedAttachments {
  if (filename !== undefined) {
    // One pass, so the count in the note and the entry that is returned cannot describe
    // different sets. The note states what was *skipped*, which is what the tool
    // description and the README promise it states — one fewer than the number that match.
    const matches = attachments.filter((a) => a.filename === filename);
    const [match] = matches;
    const skipped = matches.length - 1;

    return {
      attachments: match ? [entry(match, byteLength(match.sourceCode), true)] : [],
      notes:
        skipped > 0
          ? [
              `${matches.length} attachments on this draft share the filename ` +
                `"${filename}"; only the first is returned — ${skipped} skipped.`,
            ]
          : [],
    };
  }

  let used = 0;
  let cutting = false;

  const entries = attachments.map((attachment, index) => {
    const bytes = byteLength(attachment.sourceCode);

    // The first attachment is always returned whole, so a single oversized file is
    // readable at all; every entry after the first breach is cut, so the ceiling holds.
    if (!cutting && (index === 0 || used + bytes <= ATTACHMENT_BUDGET_BYTES)) {
      used += bytes;
      return entry(attachment, bytes, true);
    }

    cutting = true;
    return entry(attachment, bytes, false);
  });

  const cut = entries.filter((item) => item.sourceCode === null).length;

  return {
    attachments: entries,
    notes:
      cut === 0
        ? []
        : [
            // Not "these exceeded the budget": everything after the first attachment that
            // does not fit is cut regardless of its own size, so a 1-byte file can appear
            // in this count. Saying otherwise tells the model not to bother re-reading it.
            `Attachment source was cut: ${cut} of ${entries.length} attachment(s) are ` +
              'listed without their source. This tool returns source while the running ' +
              `total stays within ${Math.round(ATTACHMENT_BUDGET_BYTES / 1024)} KiB, then ` +
              'cuts every attachment after the first one that does not fit — including ' +
              'small ones. Pass `filename` to read any of them whole.',
          ],
  };
}

function attachmentBlock(item: Entry): string {
  if (item.sourceCode === null) {
    return `- ${item.filename} (${item.sourceBytes} bytes) — source not included`;
  }

  return `- ${item.filename} (${item.sourceBytes} bytes)\n${item.sourceCode}`;
}

/**
 * `available` is every filename on the draft, and it is required rather than defaulted:
 * with `filename` supplied this renders a filtered view, and a header that reports the
 * filtered count alone reads as the draft's whole attachment set to a host that surfaces
 * `content` only (CONTEXT D34).
 */
export function formatAttachments(
  shaped: ShapedAttachments,
  filename: string | undefined,
  available: string[],
): string {
  if (shaped.attachments.length === 0) {
    if (filename !== undefined) {
      const names = available.length > 0 ? available.join(', ') : 'none';
      return `No attachment named "${filename}" on this draft. Available: ${names}.`;
    }

    return (
      'This draft has no indicator attachments. Its EA embeds no `#resource` indicator ' +
      'source, which is a real empty result rather than a truncated read.'
    );
  }

  const noun = shaped.attachments.length === 1 ? 'attachment' : 'attachments';
  const blocks = shaped.attachments.map(attachmentBlock).join('\n\n');
  const notes =
    shaped.notes.length === 0
      ? ''
      : `\n\nNotes:\n${shaped.notes.map((note) => `- ${note}`).join('\n')}`;

  const head =
    filename === undefined
      ? `${shaped.attachments.length} ${noun}:`
      : `Filtered by filename "${filename}" — ${shaped.attachments.length} of ` +
        `${available.length} attachment(s) on this draft:`;

  return `${head}\n\n${blocks}${notes}`;
}

const AUTHORING_READ = 'authoring:read';

export function registerListDraftAttachments(server: McpServer, client: SentiClient): void {
  registerReadTool(server, {
    name: 'list_draft_attachments',
    title: "Read a draft's indicator sources",
    description:
      'Read the indicator source files a draft\'s EA embeds via `#resource`. `draftId` is ' +
      'the `id` field from list_drafts. Pass `filename` to read at most one attachment ' +
      'whole, by exact name — that is also how to read one the default call had to leave ' +
      'out. Filenames are not guaranteed unique within a draft: if more than one ' +
      'attachment shares the requested name, only the first is returned and `notes` says ' +
      'how many were skipped. With `filename` omitted this returns every attachment\'s ' +
      'source up to a 64 KiB budget and lists the rest by name and size only; `notes` ' +
      'says whether that happened. THE RESPONSE CAN BE LARGE — up to 64 KiB of source, ' +
      'returned in both `content` and `structuredContent` — roughly 33,000 tokens worst ' +
      'case. Use get_draft for the EA\'s own source, which this tool never returns.',
    inputSchema: z.object({ draftId: z.string(), filename: z.string().optional() }),
    outputSchema: AttachmentsOutputSchema,
    run: async (args, signal) => {
      const payload = await client.get(draftPath(args.draftId, 'attachments'), {
        signal,
        scope: AUTHORING_READ,
        notFoundMeans: DRAFT_NOT_FOUND,
      });
      const attachments = parseAttachments(payload);
      const shaped = shapeAttachments(attachments, args.filename);
      const available = attachments.map((attachment) => attachment.filename);

      return { text: formatAttachments(shaped, args.filename, available), structured: shaped };
    },
  });
}
