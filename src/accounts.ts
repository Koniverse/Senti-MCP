import * as z from 'zod/v4';

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
  const result = z.array(AccountSchema).safeParse(payload);

  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue && issue.path.length > 0 ? issue.path.join('.') : '(root)';

    throw new Error(
      `Senti API returned an unexpected shape for the account list at "${where}": ` +
        `${issue?.message ?? 'unknown issue'}. The API may have changed; ` +
        'senti-mcp-server needs updating.',
    );
  }

  return result.data;
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

  const lines = [
    `- ${name} (login ${account.login}) — ${account.broker} · ${kind}`,
    `  accountId: ${account.id}`,
    `  balance ${money(account.lastKnownBalance)} · equity ${money(account.lastKnownEquity)} · ` +
      `${account.isActive ? 'active' : 'inactive'} · ${sync}`,
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
      'No linked MT5 accounts. Either this API key\'s owner has not linked an account yet, ' +
      'or the key belongs to a different user than expected.'
    );
  }

  const noun = accounts.length === 1 ? 'account' : 'accounts';
  const blocks = accounts.map(block).join('\n\n');

  return `${accounts.length} linked ${noun}.\n\n${blocks}`;
}
