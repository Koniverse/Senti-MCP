import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { SentiClient } from '../../core/client.js';
import { parseOrThrow } from '../../core/parse.js';
import { registerReadTool } from '../../core/tool.js';

const TerminalSchema = z.object({
  assignedPort: z.number().nullable(),
  terminalStatus: z.string().nullable(),
  nodeName: z.string().nullable(),
});

const ActiveEaSchema = z.object({
  name: z.string(),
  status: z.string(),
});

/**
 * Transcribed from `GET /api/v1/accounts` in the live OpenAPI document. Every
 * field is required; many are nullable — the two are different, and collapsing
 * them would hide a broken sync behind a plausible-looking zero.
 */
export const AccountSchema = z.object({
  id: z.string(),
  login: z.string(),
  label: z.string().nullable(),
  broker: z.string(),
  server: z.string().nullable(),
  accountType: z.string(),
  brokerAccountTypeName: z.string().nullable(),
  isActive: z.boolean(),
  isSoftDeleted: z.boolean(),
  accessMode: z.string(),
  lastKnownBalance: z.number().nullable(),
  lastKnownEquity: z.number().nullable(),
  lastSyncAt: z.string().nullable(),
  createdAt: z.string(),
  terminal: TerminalSchema.nullable(),
  activeEas: z.array(ActiveEaSchema),
});

export type Account = z.infer<typeof AccountSchema>;

/**
 * The tool's advertised output. The API returns a bare array, but this server
 * speaks both protocol eras from one process: a non-object `structuredContent`
 * reaches 2025-era clients wrapped as `{ result: … }` and 2026-era clients
 * unwrapped. Naming the field keeps one shape on both.
 */
export const AccountsOutputSchema = z.object({
  accounts: z.array(AccountSchema),
});

export function parseAccounts(payload: unknown): Account[] {
  return parseOrThrow(z.array(AccountSchema), payload, 'account list');
}

/** Null numbers render as this, never as `0` or `null`. */
const NO_VALUE = '—';

function money(value: number | null): string {
  return value === null
    ? NO_VALUE
    : value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function block(account: Account): string {
  const name = account.label ?? `Account ${account.login}`;
  const kind = account.brokerAccountTypeName ?? account.accountType;
  const sync = account.lastSyncAt ? `synced ${account.lastSyncAt}` : 'never synced';

  const state = [account.isActive ? 'active' : 'inactive'];

  // The API still returns soft-deleted accounts, complete with a balance, so
  // without a marker one reads exactly like a live account.
  if (account.isSoftDeleted) state.push('soft-deleted');

  // Of the terminal's three fields only `terminalStatus` earns a place here: it
  // says whether the MT5 terminal that would execute a trade is actually up,
  // which `lastSyncAt` on its own does not. `assignedPort` and `nodeName` are
  // Senti's infrastructure detail — they reach `structuredContent` for a caller
  // that genuinely needs them, and would be noise in a summary a model reads.
  if (account.terminal?.terminalStatus) {
    state.push(`terminal ${account.terminal.terminalStatus}`);
  }

  const lines = [
    `- ${name} (login ${account.login}) — ${account.broker} · ${kind}`,
    `  accountId: ${account.id}`,
    `  balance ${money(account.lastKnownBalance)} · equity ${money(account.lastKnownEquity)} · ` +
      `${state.join(' · ')} · ${sync}`,
  ];

  if (account.activeEas.length > 0) {
    const running = account.activeEas.map((ea) => `${ea.name} (${ea.status})`).join(', ');
    lines.push(`  EAs: ${running}`);
  }

  return lines.join('\n');
}

export function formatAccounts(accounts: Account[]): string {
  if (accounts.length === 0) {
    return (
      "No linked MT5 accounts. Either this API key's owner has not linked an account yet, " +
      'or the key belongs to a different user than expected.'
    );
  }

  const noun = accounts.length === 1 ? 'account' : 'accounts';
  const blocks = accounts.map(block).join('\n\n');

  // Soft-deleted accounts are counted in the total because the API returns them
  // in the list, but saying so keeps the header from presenting them as live.
  const deleted = accounts.filter((account) => account.isSoftDeleted).length;
  const caveat = deleted > 0 ? ` ${deleted} of them soft-deleted.` : '';

  return `${accounts.length} linked ${noun}.${caveat}\n\n${blocks}`;
}

/** The scope `GET /api/v1/accounts` requires, quoted back in the 403 message. */
const ACCOUNTS_READ = 'accounts:read';

export function registerListAccounts(server: McpServer, client: SentiClient): void {
  registerReadTool(server, {
    name: 'list_accounts',
    title: 'List linked MT5 accounts',
    description:
      'List the MT5 trading accounts linked to the configured Senti Quant API key. ' +
      "Returns each account's id, login, broker, last known balance and equity, sync " +
      'state, and running strategies. The `id` field is the accountId every other Senti ' +
      'endpoint takes — pass `id`, not `login`, when a tool asks for an account.',
    inputSchema: z.object({}),
    outputSchema: AccountsOutputSchema,
    run: async (_args, signal) => {
      const payload = await client.get('/api/v1/accounts', { signal, scope: ACCOUNTS_READ });
      const accounts = parseAccounts(payload);

      return { text: formatAccounts(accounts), structured: { accounts } };
    },
  });
}
