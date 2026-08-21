import * as z from 'zod/v4';
import { parseOrThrow } from '../../core/parse.js';
import {
  AttachmentSchema,
  byteLength,
  DraftSchema,
  type Attachment,
  type Draft,
} from './get-draft.js';

const AttachmentSizeSchema = z.object({
  id: z.string(),
  filename: z.string(),
  sourceBytes: z.number(),
  createdAt: z.string(),
});

export const DraftWriteOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sourceBytes: z.number(),
  lastCompileStatus: z.enum(['PENDING', 'SUCCESS', 'FAILED']).nullable(),
  compiledUpToDate: z.boolean(),
  eaDefinitionId: z.string().nullable(),
  attachments: z.array(AttachmentSizeSchema),
  notes: z.array(z.string()),
});

export const AttachmentWriteOutputSchema = AttachmentSizeSchema.extend({
  notes: z.array(z.string()),
});

/**
 * `id` is nullable and `deleted` exists because a declined confirmation is a
 * success that deleted nothing, and the SDK rejects a non-error result that
 * declares an `outputSchema` and supplies no `structuredContent`.
 */
export const DeleteOutputSchema = z.object({
  id: z.string().nullable(),
  deleted: z.boolean(),
  notes: z.array(z.string()),
});

export type DraftWriteResult = z.infer<typeof DraftWriteOutputSchema>;
export type AttachmentWriteResult = z.infer<typeof AttachmentWriteOutputSchema>;
export type DeleteResult = z.infer<typeof DeleteOutputSchema>;

const DeletedEnvelopeSchema = z.object({ id: z.string() });

export function parseWrittenDraft(payload: unknown, subject: string): Draft {
  return parseOrThrow(DraftSchema, payload, subject);
}

export function parseWrittenAttachment(payload: unknown, subject: string): Attachment {
  return parseOrThrow(AttachmentSchema, payload, subject);
}

export function parseDeleted(payload: unknown, subject: string): DeleteResult {
  const { id } = parseOrThrow(DeletedEnvelopeSchema, payload, subject);

  return { id, deleted: true, notes: [] };
}

/**
 * A note records loss, not activity (CONTEXT D25) — so a write of an empty
 * file, which cut nothing, writes none.
 */
export function shapeDraftWrite(draft: Draft): DraftWriteResult {
  const attachments = draft.attachments.map(({ sourceCode, ...kept }) => ({
    ...kept,
    sourceBytes: byteLength(sourceCode),
  }));
  const sourceBytes = byteLength(draft.sourceCode);
  const notes: string[] = [];

  if (sourceBytes > 0) {
    notes.push(
      'Source was not returned: you just sent it. Call get_draft with draftId ' +
        `"${draft.id}" to read back what the server now holds.`,
    );
  }

  const cut = attachments.filter((attachment) => attachment.sourceBytes > 0).length;
  if (cut > 0) {
    notes.push(
      `Attachment source was cut: ${cut} indicator file(s) are listed with their size ` +
        `but without their code. Call list_draft_attachments with draftId "${draft.id}" ` +
        'to read them.',
    );
  }

  return {
    id: draft.id,
    name: draft.name,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    sourceBytes,
    lastCompileStatus: draft.lastCompileStatus,
    compiledUpToDate: draft.compiledUpToDate,
    eaDefinitionId: draft.eaDefinitionId,
    attachments,
    notes,
  };
}

export function shapeAttachmentWrite(attachment: Attachment): AttachmentWriteResult {
  const sourceBytes = byteLength(attachment.sourceCode);

  return {
    id: attachment.id,
    filename: attachment.filename,
    sourceBytes,
    createdAt: attachment.createdAt,
    notes:
      sourceBytes > 0
        ? [
            'Source was not returned: you just sent it. Call list_draft_attachments with ' +
              `filename "${attachment.filename}" to read back what the server now holds.`,
          ]
        : [],
  };
}

/** `en-US` rather than the host locale, so a byte count renders identically everywhere. */
function bytes(count: number): string {
  return `${count.toLocaleString('en-US')} bytes`;
}

function compileLine(draft: DraftWriteResult): string {
  // A null status means no compile ever ran, so nothing is said about whether
  // the source has changed "since" one — there is no "since" to measure from.
  if (draft.lastCompileStatus === null) return 'compile: never compiled';

  return draft.compiledUpToDate
    ? `compile: ${draft.lastCompileStatus} · source unchanged since that compile`
    : `compile: ${draft.lastCompileStatus} · source changed since that compile — recompile ` +
        'with compile_draft before relying on it';
}

function attachmentLine(draft: DraftWriteResult): string {
  if (draft.attachments.length === 0) return 'attachments: none';

  const rows = draft.attachments
    .map((attachment) => `${attachment.filename} ${bytes(attachment.sourceBytes)}`)
    .join(' · ');

  return `attachments: ${draft.attachments.length} (${rows})`;
}

function withNotes(head: string, notes: string[]): string {
  return notes.length === 0
    ? head
    : `${head}\n\nNotes:\n${notes.map((note) => `- ${note}`).join('\n')}`;
}

/**
 * `updated` renders the bytes written, never a before/after delta: the `PUT`
 * response carries only the new draft, and the pre-write size would need a
 * second `GET` — which doubles the latency of every edit and races any
 * concurrent writer.
 */
export function formatDraftWrite(draft: DraftWriteResult, verb: 'created' | 'updated'): string {
  const replace = verb === 'updated' ? ' (full replace — this is now the entire draft)' : '';

  return withNotes(
    [
      `Draft "${draft.name}" ${verb} (draftId ${draft.id}).`,
      `  source: ${bytes(draft.sourceBytes)} written${replace}`,
      `  ${compileLine(draft)}`,
      `  ${attachmentLine(draft)}`,
    ].join('\n'),
    draft.notes,
  );
}

/** `MyInd.mq5` compiles to `MyInd.ex5`, which is the name the EA references. */
function compiledName(filename: string): string {
  return filename.replace(/\.mq5$/i, '.ex5');
}

export function formatAttachmentWrite(
  attachment: AttachmentWriteResult,
  verb: 'attached to' | 'replaced on',
  draftId: string,
): string {
  const stem = compiledName(attachment.filename);
  const wiring =
    verb === 'attached to'
      ? '\n\nThe EA does not use this file until it references it. Add ' +
        `\`#resource "${stem}"\` and an \`iCustom(_Symbol, _Period, "::${stem}", …)\` call ` +
        'to the draft source with update_draft, then compile_draft.'
      : '';

  return withNotes(
    `Indicator "${attachment.filename}" ${verb} draft ${draftId} ` +
      `(attachmentId ${attachment.id}).\n  source: ${bytes(attachment.sourceBytes)} written` +
      wiring,
    attachment.notes,
  );
}

export function formatDeleted(result: DeleteResult, what: string): string {
  return withNotes(`${what} deleted (id ${result.id}).`, result.notes);
}

export function cancelledDelete(what: string): { text: string; structured: DeleteResult } {
  return {
    text: `Cancelled — nothing was deleted. ${what} is unchanged.`,
    structured: {
      id: null,
      deleted: false,
      notes: ['The confirmation was declined, so no request was sent to the Senti API.'],
    },
  };
}
