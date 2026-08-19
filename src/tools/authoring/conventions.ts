import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { SentiClient } from '../../core/client.js';
import { parseOrThrow } from '../../core/parse.js';
import { registerReadTool } from '../../core/tool.js';

const ForbiddenConstructSchema = z.object({
  id: z.string(),
  pattern: z.string(),
  reason: z.string(),
});

const LimitsSchema = z.object({
  maxDrafts: z.number(),
  maxAttachmentsPerDraft: z.number(),
  maxAttachmentBytes: z.number(),
  maxSourceBytes: z.number(),
  maxRegisteredEas: z.number(),
});

export const ConventionsOutputSchema = z.object({
  hardSafetyConstraints: z.array(z.string()),
  tradingSafetyRequirements: z.array(z.string()),
  forbiddenConstructs: z.array(ForbiddenConstructSchema),
  limits: LimitsSchema,
});

export type Conventions = z.infer<typeof ConventionsOutputSchema>;

export function parseConventions(payload: unknown): Conventions {
  return parseOrThrow(ConventionsOutputSchema, payload, 'authoring conventions');
}

function kib(bytes: number): string {
  return `${Math.round(bytes / 1024)} KiB`;
}

function numbered(items: string[]): string {
  return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

export function formatConventions(conventions: Conventions): string {
  const { limits } = conventions;

  const forbidden = conventions.forbiddenConstructs
    .map((construct) => `- ${construct.id}\n  pattern: ${construct.pattern}\n  ${construct.reason}`)
    .join('\n');

  return [
    'Senti Quant MQL5 authoring contract. Read this before generating source: code that ' +
      'violates these rules is rejected by the L1 static scan before it reaches the ' +
      'compiler, and a compile slot is globally serial.',
    `Hard safety constraints:\n${numbered(conventions.hardSafetyConstraints)}`,
    `Trading safety requirements:\n${numbered(conventions.tradingSafetyRequirements)}`,
    'Forbidden constructs. Each `pattern` is a regular expression the static analyzer ' +
      'applies to your source. They have not been run against anything here — this tool ' +
      'reports the contract, it does not evaluate it, and the API does not document which ' +
      `regex dialect the analyzer uses.\n${forbidden}`,
    'Platform limits:\n' +
      `- at most ${limits.maxDrafts} drafts\n` +
      `- at most ${limits.maxAttachmentsPerDraft} attachments per draft\n` +
      `- at most ${kib(limits.maxAttachmentBytes)} per attachment\n` +
      `- at most ${kib(limits.maxSourceBytes)} of EA source per draft\n` +
      `- at most ${limits.maxRegisteredEas} registered EAs`,
  ].join('\n\n');
}

const AUTHORING_READ = 'authoring:read';

export function registerGetAuthoringConventions(server: McpServer, client: SentiClient): void {
  registerReadTool(server, {
    name: 'get_authoring_conventions',
    title: 'Read the MQL5 authoring rules',
    description:
      'Read the Senti Quant MQL5 authoring contract as data: the hard-safety constraints, ' +
      'the trading-safety requirements, the static analyzer\'s forbidden-construct list, ' +
      'and the platform limits on draft count and source size. CALL THIS BEFORE GENERATING ' +
      'ANY MQL5 SOURCE. Code that breaks these rules is rejected by a static scan before it ' +
      'reaches the compiler, and compile slots are globally serial, so discovering a rule ' +
      'by failing a compile is expensive and still fails. The response is small (~2 KB) and ' +
      'static per deploy. `forbiddenConstructs[].pattern` values are regular expressions ' +
      'reported verbatim — this tool does not evaluate them.',
    inputSchema: z.object({}),
    outputSchema: ConventionsOutputSchema,
    run: async (_args, signal) => {
      const payload = await client.get('/api/v1/authoring/conventions', {
        signal,
        scope: AUTHORING_READ,
      });
      const conventions = parseConventions(payload);

      return { text: formatConventions(conventions), structured: conventions };
    },
  });
}
