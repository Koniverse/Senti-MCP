import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import {
  AUTHORING_WRITE_SCOPE,
  COMPILE_SLOT_BUSY,
  COMPILE_UPSTREAM,
  DRAFT_NOT_FOUND,
  draftPath,
  type SentiClient,
} from '../../core/client.js';
import { parseOrThrow } from '../../core/parse.js';
import { registerWriteTool } from '../../core/tool.js';
import { DiagnosticSchema } from './get-draft.js';

const AUTHORING_WRITE = 'authoring:write';

/**
 * The one place the API types a diagnostic. `get_draft` and `list_drafts` parse
 * theirs loosely because their GET paths declare the array untyped; this route
 * declares the shape, so nothing here guesses.
 */
export const CompileResultSchema = z.object({
  ok: z.boolean(),
  errors: z.number(),
  warnings: z.number(),
  diagnostics: z.array(DiagnosticSchema),
  log: z.string(),
  logTruncated: z.boolean(),
});

export type CompileResult = z.infer<typeof CompileResultSchema>;

const COMPILE_REJECTED =
  'The compile server rejected the request — most often a duplicate attachment filename or a ' +
  'source size over the platform cap. See get_authoring_conventions.';

export function parseCompile(payload: unknown): CompileResult {
  return parseOrThrow(CompileResultSchema, payload, 'compile result');
}

/**
 * Aborting the fetch does not cancel the compile. The account's slot stays busy,
 * so the next call is a 409 — and a model told only "aborted" retries straight
 * into it.
 */
export function compileAbortHint(error: unknown, draftId: string): unknown {
  const name = error instanceof Error ? error.name : '';
  if (name !== 'TimeoutError' && name !== 'AbortError') return error;

  return new Error(
    'The compile request was aborted after 15 seconds. That does not cancel the compile on ' +
      "the server: this account's compile slot may still be busy, so calling compile_draft " +
      `again would return 409. Call get_draft with draftId "${draftId}" and read ` +
      'lastCompileStatus to find out how it finished.',
    { cause: error },
  );
}

export function formatCompile(result: CompileResult, draftId: string): string {
  const verdict = result.ok
    ? `Compile SUCCEEDED — 0 errors, ${result.warnings} warning(s).`
    : `Compile FAILED — ${result.errors} error(s), ${result.warnings} warning(s).`;

  const diagnostics =
    result.diagnostics.length === 0
      ? ''
      : `\n\nDiagnostics (${result.diagnostics.length}):\n${result.diagnostics
          .map(
            (entry) =>
              `- ${entry.severity} ${entry.code} at ${entry.file}:${entry.line}:${entry.column}` +
              ` — ${entry.message}`,
          )
          .join('\n')}`;

  const log =
    result.log.trim().length === 0
      ? ''
      : `\n\nCompiler log${result.logTruncated ? ' (truncated — this is the tail only)' : ''}:` +
        `\n${result.log}`;

  const next = result.ok
    ? `\n\nDraft ${draftId} builds. Registering it as a private EA is not available through ` +
      'this server.'
    : `\n\nFix the source and call update_draft — a FULL REPLACE of draft ${draftId} — then ` +
      'compile again.';

  return `${verdict}${diagnostics}${log}${next}`;
}

export function registerCompileDraft(server: McpServer, client: SentiClient): void {
  registerWriteTool(server, {
    name: 'compile_draft',
    title: 'Compile a draft',
    description:
      'Run the static-safety scan and the MQL5 compiler over a draft and every indicator ' +
      'attached to it, and return the verdict, the diagnostics and the compiler log. This is ' +
      'a CHECK ONLY — it registers and deploys nothing. A FAILED BUILD IS NOT AN ERROR: the ' +
      'tool succeeds and reports `ok: false` with diagnostics, so read the result rather than ' +
      'retrying. The compile slot is ONE PER ACCOUNT and the compile server is globally ' +
      'serial, so a second concurrent call returns 409 and contention returns 503 with a ' +
      'wait — this server never retries either on your behalf. A typical compile takes about ' +
      'a second. Call get_authoring_conventions before writing source, not after failing here.',
    inputSchema: z.object({ draftId: z.string() }),
    outputSchema: CompileResultSchema,
    destructive: false,
    idempotent: true,
    run: async (args, signal) => {
      let payload: unknown;

      // The one sanctioned try/catch outside `registerWriteTool`: it rewrites an
      // abort into something actionable and rethrows. It never swallows.
      try {
        payload = await client.send('POST', draftPath(args.draftId, 'compile'), {
          signal,
          scope: AUTHORING_WRITE,
          forbiddenMeans: AUTHORING_WRITE_SCOPE,
          notFoundMeans: DRAFT_NOT_FOUND,
          conflictMeans: COMPILE_SLOT_BUSY,
          unprocessableMeans: COMPILE_REJECTED,
          upstreamMeans: COMPILE_UPSTREAM,
        });
      } catch (error) {
        throw compileAbortHint(error, args.draftId);
      }

      const result = parseCompile(payload);

      return { text: formatCompile(result, args.draftId), structured: result };
    },
  });
}
