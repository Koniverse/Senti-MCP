import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { DRAFT_NOT_FOUND, draftPath, type SentiClient } from '../../core/client.js';
import { parseOrThrow } from '../../core/parse.js';
import { registerReadTool } from '../../core/tool.js';

export const AttachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  sourceCode: z.string(),
  createdAt: z.string(),
});

export type Attachment = z.infer<typeof AttachmentSchema>;

/**
 * `lastCompileDiagnostics` stays `unknown`: the two GET paths declare it untyped, and
 * `parseOrThrow` is all-or-nothing, so transcribing the compile response's shape onto them
 * would take both draft tools down the day they diverge. `DiagnosticSchema` below is used
 * for rendering only.
 */
export const DraftSchema = z.object({
  id: z.string(),
  name: z.string(),
  sourceCode: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastCompileStatus: z.enum(['PENDING', 'SUCCESS', 'FAILED']).nullable(),
  lastCompileLog: z.string().nullable(),
  logTruncated: z.boolean(),
  lastCompileDiagnostics: z.array(z.unknown()),
  compiledUpToDate: z.boolean(),
  eaDefinitionId: z.string().nullable(),
  attachments: z.array(AttachmentSchema),
});

export type Draft = z.infer<typeof DraftSchema>;

/** Transcribed from `POST /drafts/{draftId}/compile`, which types what the GETs do not. */
export const DiagnosticSchema = z.object({
  severity: z.enum(['error', 'warning']),
  file: z.string(),
  line: z.number(),
  column: z.number(),
  code: z.string(),
  message: z.string(),
});

export const AttachmentSummarySchema = AttachmentSchema.omit({ sourceCode: true }).extend({
  sourceBytes: z.number(),
});

export const DraftOutputSchema = DraftSchema.omit({ attachments: true }).extend({
  attachments: z.array(AttachmentSummarySchema),
  notes: z.array(z.string()),
});

export type ShapedDraft = z.infer<typeof DraftOutputSchema>;

export function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

export function parseDraft(payload: unknown): Draft {
  return parseOrThrow(DraftSchema, payload, 'draft');
}

/**
 * A note reports what was actually lost, not what the shaping code merely touched — an
 * attachment whose source is empty had nothing to cut, and a note about it would send the
 * model to `list_draft_attachments` for a file that returns nothing (CONTEXT D25).
 * `shapeDrafts` in `list-drafts.ts` applies the same rule to the same attachments.
 */
export function shapeDraft(draft: Draft): ShapedDraft {
  const attachments = draft.attachments.map(({ sourceCode, ...kept }) => ({
    ...kept,
    sourceBytes: byteLength(sourceCode),
  }));

  const cut = attachments.filter((attachment) => attachment.sourceBytes > 0).length;

  const notes =
    cut === 0
      ? []
      : [
          `Attachment source was cut: ${cut} indicator file(s) are listed ` +
            'with their size but without their code. Call list_draft_attachments with ' +
            `draftId "${draft.id}" to read them.`,
        ];

  return { ...draft, attachments, notes };
}

function diagnosticLine(entry: unknown): string {
  const parsed = DiagnosticSchema.safeParse(entry);

  if (parsed.success) {
    const { severity, code, file, line, column, message } = parsed.data;
    return `- ${severity} ${code} at ${file}:${line}:${column} — ${message}`;
  }

  // `lastCompileDiagnostics` is `z.array(z.unknown())`, so a null element parses fine.
  // `JSON.stringify(null)` is the string "null" and `JSON.stringify(undefined)` is
  // `undefined`, which a template literal renders as "undefined" — either would print a
  // line the model reads as a diagnostic that says something.
  const raw = JSON.stringify(entry);
  if (raw === undefined || raw === 'null') {
    return '- (the API returned an empty diagnostic entry — no detail to report)';
  }

  return `- ${raw}`;
}

function compileBlock(draft: ShapedDraft): string {
  const diagnostics =
    draft.lastCompileDiagnostics.length === 0
      ? ''
      : `\nDiagnostics (${draft.lastCompileDiagnostics.length}):\n${draft.lastCompileDiagnostics
          .map(diagnosticLine)
          .join('\n')}`;

  const log = draft.lastCompileLog
    ? `\nCompiler log${draft.logTruncated ? ' (truncated — this is the tail only)' : ''}:\n${
        draft.lastCompileLog
      }`
    : '';

  // A null status means no compile ever ran, so nothing is said about whether the
  // source has changed "since" one — there is no "since" to measure from.
  if (draft.lastCompileStatus === null) {
    return `Compile: never compiled${diagnostics}${log}`;
  }

  const ready =
    draft.lastCompileStatus === 'SUCCESS' && draft.compiledUpToDate
      ? ' → ready to register without recompiling'
      : '';
  const head = `Compile: ${draft.lastCompileStatus} · source unchanged since that compile: ${
    draft.compiledUpToDate ? 'yes' : 'no'
  }${ready}`;

  return `${head}${diagnostics}${log}`;
}

function attachmentBlock(draft: ShapedDraft): string {
  if (draft.attachments.length === 0) return 'Attachments: none.';

  const rows = draft.attachments
    .map((attachment) => `- ${attachment.filename} (${attachment.sourceBytes} bytes)`)
    .join('\n');

  return `Attachments (${draft.attachments.length}, source not included):\n${rows}`;
}

export function formatDraft(draft: ShapedDraft): string {
  const registered = draft.eaDefinitionId ? `registered as ${draft.eaDefinitionId}` : 'not registered';

  const sections = [
    `Draft "${draft.name}" (draftId ${draft.id}) · ${byteLength(draft.sourceCode)} bytes of ` +
      `MQL5 · updated ${draft.updatedAt} · ${registered}`,
    compileBlock(draft),
    attachmentBlock(draft),
    `Source:\n${draft.sourceCode}`,
  ];

  if (draft.notes.length > 0) {
    sections.push(`Notes:\n${draft.notes.map((note) => `- ${note}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

const AUTHORING_READ = 'authoring:read';

export function registerGetDraft(server: McpServer, client: SentiClient): void {
  registerReadTool(server, {
    name: 'get_draft',
    title: 'Read one MQL5 draft',
    description:
      'Read one MQL5 draft the API key owns: its full source code, its compiler log, its ' +
      'diagnostics, and whether the last compile still matches the current source. Use it ' +
      'to answer "why did this fail to compile" or "show me the code". `draftId` is the ' +
      '`id` field from list_drafts. THE RESPONSE CAN BE LARGE — a draft may hold up to ' +
      '192 KiB of source plus 16 KiB of compiler log, and this server returns that ' +
      'content twice (once as text, once as structured data) — roughly 105,000 tokens ' +
      'worst case. Attachment source is NOT included; the attachments are listed with ' +
      'their size, and list_draft_attachments returns their code. For a cheap overview ' +
      'of every draft, call list_drafts instead.',
    inputSchema: z.object({ draftId: z.string() }),
    outputSchema: DraftOutputSchema,
    run: async (args, signal) => {
      const payload = await client.get(draftPath(args.draftId), {
        signal,
        scope: AUTHORING_READ,
        notFoundMeans: DRAFT_NOT_FOUND,
      });
      const shaped = shapeDraft(parseDraft(payload));

      return { text: formatDraft(shaped), structured: shaped };
    },
  });
}
