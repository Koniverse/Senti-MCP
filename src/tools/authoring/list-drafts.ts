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

/**
 * Keyed on `compileLogBytes`, not `diagnosticsCount`: a compile can leave a log that parsed
 * into no diagnostics, and `logTruncated` is `false` for any log under 16 KiB — so neither of
 * the other two fields says whether there is anything to read.
 */
function logLine(draft: DraftSummary): string[] {
  if (draft.compileLogBytes === null) return [];

  const where = draft.logTruncated
    ? 'get_draft returns its trailing 16 KiB only'
    : 'read it with get_draft';

  return [`  compile log: ${draft.compileLogBytes} bytes — ${where}`];
}

function block(draft: DraftSummary): string {
  const registered = draft.eaDefinitionId ? `registered as ${draft.eaDefinitionId}` : 'not registered';
  const diagnostics = draft.diagnosticsCount > 0 ? ` · ${draft.diagnosticsCount} diagnostic(s)` : '';

  return [
    `- ${draft.name} (draftId ${draft.id})`,
    `  updated ${draft.updatedAt} · ${draft.sourceBytes} bytes · sha256 ${draft.sourceSha256} · ` +
      `${draft.attachments.length} attachment(s)`,
    `  compile: ${readiness(draft)}${diagnostics} · ${registered}`,
    ...logLine(draft),
  ].join('\n');
}

export function formatDrafts(drafts: DraftSummary[]): string {
  if (drafts.length === 0) {
    return (
      'No drafts on this API key. This is a real empty result rather than a truncated read — ' +
      'drafts are created in the Senti Quant web Studio, or with create_draft where this ' +
      'server\'s authoring write tools are enabled.'
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
      'draft\'s compile status, source size and SHA-256, compile-log size, attachment sizes ' +
      'and registered-EA id. Use it to find a `draftId`, to answer "what am I working on" ' +
      'and "which of my drafts are broken", or to tell whether a copy of a draft you hold is ' +
      'current. The list carries sizes and hashes rather than bodies: no source code, ' +
      'compiler log or diagnostics. A non-null `compileLogBytes` means the last compile left ' +
      'a log to read, even when `diagnosticsCount` is 0. Call get_draft for one draft\'s ' +
      'source, compiler log and diagnostics, and list_draft_attachments for its indicator ' +
      'sources.',
    inputSchema: z.object({}),
    outputSchema: DraftsOutputSchema,
    run: async (_args, signal) => {
      const payload = await client.get('/api/v1/drafts', { signal, scope: AUTHORING_READ });
      const drafts = parseDrafts(payload);

      return { text: formatDrafts(drafts), structured: { drafts, notes: [] } };
    },
  });
}
