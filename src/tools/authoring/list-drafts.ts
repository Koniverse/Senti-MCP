import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { SentiClient } from '../../core/client.js';
import { parseOrThrow } from '../../core/parse.js';
import { registerReadTool } from '../../core/tool.js';
import { AttachmentSummarySchema, byteLength, type Draft, DraftSchema } from './get-draft.js';

export const DraftSummarySchema = DraftSchema.omit({
  sourceCode: true,
  lastCompileLog: true,
  logTruncated: true,
  lastCompileDiagnostics: true,
  attachments: true,
}).extend({
  sourceBytes: z.number(),
  diagnosticsCount: z.number(),
  attachments: z.array(AttachmentSummarySchema),
});

export const DraftsOutputSchema = z.object({
  drafts: z.array(DraftSummarySchema),
  notes: z.array(z.string()),
});

export type ShapedDrafts = z.infer<typeof DraftsOutputSchema>;

export function parseDrafts(payload: unknown): Draft[] {
  return parseOrThrow(z.array(DraftSchema), payload, 'draft list');
}

function summarise(draft: Draft): ShapedDrafts['drafts'][number] {
  const {
    sourceCode,
    lastCompileLog: _log,
    logTruncated: _truncated,
    lastCompileDiagnostics,
    attachments,
    ...kept
  } = draft;

  return {
    ...kept,
    sourceBytes: byteLength(sourceCode),
    diagnosticsCount: lastCompileDiagnostics.length,
    attachments: attachments.map(({ sourceCode: source, ...rest }) => ({
      ...rest,
      sourceBytes: byteLength(source),
    })),
  };
}

/**
 * A note reports what was actually lost, not what the shaping code merely touched — a
 * draft with empty source and no log is not a cut just because the fields exist in the
 * schema (CONTEXT D25).
 */
export function shapeDrafts(drafts: Draft[]): ShapedDrafts {
  const summaries = drafts.map(summarise);

  const draftsWithSource = drafts.filter((draft) => byteLength(draft.sourceCode) > 0);
  const cutAttachments = drafts.flatMap((draft) =>
    draft.attachments.filter((a) => byteLength(a.sourceCode) > 0),
  );
  const draftsWithLog = drafts.filter((draft) => byteLength(draft.lastCompileLog ?? '') > 0);
  const draftsWithDiagnostics = drafts.filter((draft) => draft.lastCompileDiagnostics.length > 0);

  const clauses: string[] = [];
  if (draftsWithSource.length > 0 || cutAttachments.length > 0) {
    const parts = [
      draftsWithSource.length > 0 ? `${draftsWithSource.length} draft(s)` : undefined,
      cutAttachments.length > 0 ? `${cutAttachments.length} attachment(s)` : undefined,
    ].filter((part): part is string => part !== undefined);

    clauses.push(`${parts.join(' and ')} had source dropped`);
  }
  if (draftsWithLog.length > 0) clauses.push(`${draftsWithLog.length} compile log(s) dropped`);
  if (draftsWithDiagnostics.length > 0) {
    clauses.push(`${draftsWithDiagnostics.length} draft(s)' diagnostics dropped`);
  }

  if (clauses.length === 0) return { drafts: summaries, notes: [] };

  // Diagnostics are objects, not text, and are reduced to a count rather than measured —
  // so the byte figure covers source and log only, and is stated as such. A cut that is
  // diagnostics-only has no byte figure at all, rather than claiming "0 B in total".
  const cutBytes =
    draftsWithSource.reduce((sum, draft) => sum + byteLength(draft.sourceCode), 0) +
    cutAttachments.reduce((sum, a) => sum + byteLength(a.sourceCode), 0) +
    draftsWithLog.reduce((sum, draft) => sum + byteLength(draft.lastCompileLog ?? ''), 0);
  const size = cutBytes >= 1024 ? `${Math.round(cutBytes / 1024)} KiB` : `${cutBytes} B`;
  const total = cutBytes > 0 ? ` — ${size} of source and log in total` : '';

  return {
    drafts: summaries,
    notes: [
      `Source and compiler output were cut: ${clauses.join('; ')}${total}. ` +
        'Call get_draft for one draft\'s source, log and diagnostics, or ' +
        'list_draft_attachments for its indicator sources.',
    ],
  };
}

function readiness(draft: ShapedDrafts['drafts'][number]): string {
  if (draft.lastCompileStatus === null) return 'never compiled';

  const upToDate = draft.compiledUpToDate ? 'source unchanged since' : 'source changed since';
  const ready =
    draft.lastCompileStatus === 'SUCCESS' && draft.compiledUpToDate
      ? ' → ready to register without recompiling'
      : '';

  return `${draft.lastCompileStatus}, ${upToDate}${ready}`;
}

function block(draft: ShapedDrafts['drafts'][number]): string {
  const registered = draft.eaDefinitionId ? `registered as ${draft.eaDefinitionId}` : 'not registered';
  const diagnostics = draft.diagnosticsCount > 0 ? ` · ${draft.diagnosticsCount} diagnostic(s)` : '';

  return [
    `- ${draft.name} (draftId ${draft.id})`,
    `  updated ${draft.updatedAt} · ${draft.sourceBytes} bytes · ` +
      `${draft.attachments.length} attachment(s)`,
    `  compile: ${readiness(draft)}${diagnostics} · ${registered}`,
  ].join('\n');
}

export function formatDrafts(shaped: ShapedDrafts): string {
  if (shaped.drafts.length === 0) {
    return (
      'No drafts on this API key. This is a real empty result rather than a truncated read — ' +
      'drafts are created in the Senti Quant web Studio, and this server has no write tools.'
    );
  }

  const noun = shaped.drafts.length === 1 ? 'draft' : 'drafts';
  const blocks = shaped.drafts.map(block).join('\n\n');
  const notes =
    shaped.notes.length === 0
      ? ''
      : `\n\nNotes:\n${shaped.notes.map((note) => `- ${note}`).join('\n')}`;

  return (
    `${shaped.drafts.length} ${noun}, most recently updated first. Source code is not ` +
    `included — call get_draft with a draftId to read one.\n\n${blocks}${notes}`
  );
}

const AUTHORING_READ = 'authoring:read';

export function registerListDrafts(server: McpServer, client: SentiClient): void {
  registerReadTool(server, {
    name: 'list_drafts',
    title: 'List MQL5 authoring drafts',
    description:
      'List the MQL5 drafts this API key owns, most recently updated first, with each ' +
      'draft\'s compile status, size, attachment count and registered-EA id. Use it to ' +
      'find a `draftId`, or to answer "what am I working on" and "which of my drafts are ' +
      'broken". THIS RESPONSE IS SHAPED: source code, compiler logs and diagnostics are ' +
      'ALL dropped — the endpoint can return over 10 MB otherwise — and what was cut is ' +
      'listed in `notes`. Call get_draft for one draft\'s source and compiler output, or ' +
      'list_draft_attachments for its indicator sources. There is no option to request the ' +
      'unshaped response.',
    inputSchema: z.object({}),
    outputSchema: DraftsOutputSchema,
    run: async (_args, signal) => {
      const payload = await client.get('/api/v1/drafts', { signal, scope: AUTHORING_READ });
      const shaped = shapeDrafts(parseDrafts(payload));

      return { text: formatDrafts(shaped), structured: shaped };
    },
  });
}
