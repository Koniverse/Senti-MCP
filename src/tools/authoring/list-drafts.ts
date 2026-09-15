import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { SentiClient } from '../../core/client.js';
import { parseOrThrow } from '../../core/parse.js';
import { registerReadTool } from '../../core/tool.js';

/** Transcribed from the published `DraftAttachmentSummary` component. */
const DraftAttachmentSummarySchema = z.object({
  id: z.string(),
  filename: z.string(),
  sourceBytes: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * Transcribed from the published `DraftSummary` component, not derived from `DraftSchema`:
 * the server owns the summary, so a field Senti adds to it is transcribed here, and a field
 * added to `Draft` no longer reaches this tool (CONTEXT D49).
 */
export const DraftSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  sourceBytes: z.number().int(),
  sourceSha256: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastCompileStatus: z.enum(['SUCCESS', 'FAILED']).nullable(),
  compileLogBytes: z.number().int().nullable(),
  logTruncated: z.boolean(),
  diagnosticsCount: z.number().int(),
  compiledUpToDate: z.boolean(),
  eaDefinitionId: z.string().nullable(),
  attachments: z.array(DraftAttachmentSummarySchema),
});

export type DraftSummary = z.infer<typeof DraftSummarySchema>;

/**
 * `notes` is always empty and stays declared. A note records information this tool lost
 * (CONTEXT D25), and a summary route loses nothing the tool received; removing a published
 * output field waits for a major version (CONTEXT D49).
 */
export const DraftsOutputSchema = z.object({
  drafts: z.array(DraftSummarySchema),
  notes: z.array(z.string()),
});

export function parseDrafts(payload: unknown): DraftSummary[] {
  return parseOrThrow(z.array(DraftSummarySchema), payload, 'draft list');
}

function readiness(draft: DraftSummary): string {
  if (draft.lastCompileStatus === null) return 'never compiled';

  const upToDate = draft.compiledUpToDate ? 'source unchanged since' : 'source changed since';
  const ready =
    draft.lastCompileStatus === 'SUCCESS' && draft.compiledUpToDate
      ? ' → ready to register without recompiling'
      : '';

  return `${draft.lastCompileStatus}, ${upToDate}${ready}`;
}

function block(draft: DraftSummary): string {
  const registered = draft.eaDefinitionId ? `registered as ${draft.eaDefinitionId}` : 'not registered';
  const diagnostics = draft.diagnosticsCount > 0 ? ` · ${draft.diagnosticsCount} diagnostic(s)` : '';

  return [
    `- ${draft.name} (draftId ${draft.id})`,
    `  updated ${draft.updatedAt} · ${draft.sourceBytes} bytes · ` +
      `${draft.attachments.length} attachment(s)`,
    `  compile: ${readiness(draft)}${diagnostics} · ${registered}`,
  ].join('\n');
}

export function formatDrafts(drafts: DraftSummary[]): string {
  if (drafts.length === 0) {
    return (
      'No drafts on this API key. This is a real empty result rather than a truncated read — ' +
      'drafts are created in the Senti Quant web Studio, and this server has no write tools.'
    );
  }

  const noun = drafts.length === 1 ? 'draft' : 'drafts';

  return (
    `${drafts.length} ${noun}, most recently updated first. Source code is not ` +
    `included — call get_draft with a draftId to read one.\n\n${drafts.map(block).join('\n\n')}`
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
      const drafts = parseDrafts(payload);

      return { text: formatDrafts(drafts), structured: { drafts, notes: [] } };
    },
  });
}
