import { describe, expect, test } from 'vitest';
import { formatAccounts, parseAccounts } from './accounts.js';
import { createClient } from './client.js';
import { loadConfig } from './config.js';

/**
 * Opt-in: runs only when a real key is present, so CI and `npm test` skip it.
 * Invoke with `npm run test:smoke`, which loads `.env.local`.
 */
const smokeKey = process.env.SENTI_SMOKE_KEY;

describe.skipIf(!smokeKey)('smoke: live Senti API', () => {
  test('GET /api/v1/accounts returns a list this server can parse and render', async () => {
    const config = loadConfig({
      SENTI_API_KEY: smokeKey,
      SENTI_API_BASE_URL: process.env.SENTI_API_BASE_URL ?? 'https://be-dev.sentitrade.xyz',
    });

    const payload = await createClient(config).get('/api/v1/accounts', {
      scope: 'accounts:read',
    });
    const accounts = parseAccounts(payload);
    const rendered = formatAccounts(accounts);

    expect(Array.isArray(accounts)).toBe(true);
    expect(rendered.length).toBeGreaterThan(0);
    // Never assert on balances — they change. Assert the contract holds.
    for (const account of accounts) {
      expect(typeof account.id).toBe('string');
      expect(rendered).toContain(account.id);
    }
  }, 30_000);
});
