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

/**
 * Validation is all-or-nothing by choice: one malformed field fails the whole
 * list rather than passing malformed data to the model.
 *
 * The operational consequence is worth naming before this pattern spreads to
 * the API's other 16 endpoints. A single upstream field change — one account in
 * a hundred carrying a newly-nullable value — takes down the entire tool, not
 * just the affected row. That trade is right while a tool returns a handful of
 * records a human is about to act on financially, and it gets progressively
 * worse as the endpoint's list grows. When it stops being right, the fix is
 * per-item partial parsing that keeps the valid rows and reports the rejected
 * ones — not a looser schema, which would reintroduce exactly the silent
 * corruption this guards against.
 */
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
