import { describe, expect, test } from 'vitest';
import { type Account, formatAccounts, parseAccounts } from './accounts.js';

const base: Account = {
  id: '8f2c1b40-3d5e-4a17-9c8b-2e1f0a6d4b93',
  login: '51234567',
  label: 'Main Live',
  broker: 'Exness',
  server: 'Exness-MT5Real',
  accountType: 'REAL',
  brokerAccountTypeName: 'MT5 Real',
  isActive: true,
  isSoftDeleted: false,
  accessMode: 'FULL',
  lastKnownBalance: 10432.11,
  lastKnownEquity: 10502,
  lastSyncAt: '2026-08-05T09:12:00Z',
  createdAt: '2026-01-02T00:00:00Z',
  terminal: { assignedPort: 5001, terminalStatus: 'RUNNING', nodeName: 'node-1' },
  activeEas: [{ name: 'TrendRider', status: 'running' }],
};

describe('parseAccounts', () => {
  test('accepts a well-formed list', () => {
    expect(parseAccounts([base])).toEqual([base]);
  });

  test('accepts every nullable field being null', () => {
    const sparse = {
      ...base,
      label: null,
      server: null,
      brokerAccountTypeName: null,
      lastKnownBalance: null,
      lastKnownEquity: null,
      lastSyncAt: null,
      terminal: null,
      activeEas: [],
    };

    expect(parseAccounts([sparse])).toEqual([sparse]);
  });

  test('strips fields the schema does not declare', () => {
    const parsed = parseAccounts([{ ...base, surpriseField: 'ignored' }]);

    expect(parsed[0]).not.toHaveProperty('surpriseField');
  });

  test('names the offending field when a required one is missing', () => {
    const { lastKnownBalance: _omitted, ...missing } = base;

    expect(() => parseAccounts([missing])).toThrow(/lastKnownBalance/);
    expect(() => parseAccounts([missing])).toThrow(/senti-mcp-server needs updating/);
  });

  test('rejects a payload that is not an array', () => {
    expect(() => parseAccounts({ accounts: [] })).toThrow(/unexpected shape/);
  });
});

describe('formatAccounts', () => {
  test('explains an empty list instead of returning nothing', () => {
    const text = formatAccounts([]);

    expect(text).toMatch(/no linked mt5 accounts/i);
    expect(text).toMatch(/different user/i);
  });

  test('leads with a count that agrees in number', () => {
    expect(formatAccounts([base])).toMatch(/^1 linked account\./m);
    expect(formatAccounts([base, base])).toMatch(/^2 linked accounts\./m);
  });

  test('shows the accountId, which is the handle other endpoints take', () => {
    expect(formatAccounts([base])).toContain(`accountId: ${base.id}`);
  });

  test('renders balances with thousands separators', () => {
    const text = formatAccounts([base]);

    expect(text).toContain('balance 10,432.11');
    expect(text).toContain('equity 10,502.00');
  });

  test('renders a null balance as an em dash, never as zero or null', () => {
    const text = formatAccounts([{ ...base, lastKnownBalance: null, lastKnownEquity: null }]);

    expect(text).toContain('balance — · equity —');
    expect(text).not.toContain('null');
    expect(text).not.toContain('0.00');
  });

  test('distinguishes never-synced from a sync timestamp', () => {
    expect(formatAccounts([base])).toContain('synced 2026-08-05T09:12:00Z');
    expect(formatAccounts([{ ...base, lastSyncAt: null }])).toContain('never synced');
  });

  test('falls back to the login when the account has no label', () => {
    expect(formatAccounts([{ ...base, label: null }])).toContain('Account 51234567');
  });

  test('lists running strategies', () => {
    expect(formatAccounts([base])).toContain('EAs: TrendRider (running)');
  });

  test('omits the EA line when nothing is running', () => {
    expect(formatAccounts([{ ...base, activeEas: [] }])).not.toContain('EAs:');
  });

  test('marks an inactive account', () => {
    expect(formatAccounts([{ ...base, isActive: false }])).toContain('inactive');
  });
});
