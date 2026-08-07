import { describe, expect, test } from 'vitest';
import { formatAccounts, parseAccounts } from './tools/accounts/list-accounts.js';
import { formatBrokers, parseBrokers } from './tools/brokers/list-brokers.js';
import {
  formatAccountStrategies,
  parseAccountStrategies,
} from './tools/strategies/list-account-strategies.js';
import { formatStrategies, parseStrategies } from './tools/strategies/list-strategies.js';
import { capOrders, formatOrders, parseOrders } from './tools/trading/orders.js';
import { capPositions, formatPositions, parsePositions } from './tools/trading/positions.js';
import { accountPath, createClient } from './core/client.js';
import { loadConfig } from './config.js';

/**
 * Opt-in: runs only when a real key is present, so CI and `npm test` skip it.
 * Invoke with `npm run test:smoke`, which loads `.env.local`.
 */
const smokeKey = process.env.SENTI_SMOKE_KEY;

describe.skipIf(!smokeKey)('smoke: live Senti API', () => {
  test('the whole W33 read path parses and renders against the live API', async () => {
    const config = loadConfig({
      SENTI_API_KEY: smokeKey,
      SENTI_API_BASE_URL: process.env.SENTI_API_BASE_URL ?? 'https://be-dev.sentitrade.xyz',
    });
    const client = createClient(config);

    const accounts = parseAccounts(await client.get('/api/v1/accounts', { scope: 'accounts:read' }));
    expect(formatAccounts(accounts).length).toBeGreaterThan(0);

    const brokers = parseBrokers(await client.get('/api/v1/brokers', { scope: 'brokers:read' }));
    expect(formatBrokers(brokers).length).toBeGreaterThan(0);

    const strategies = parseStrategies(
      await client.get('/api/v1/strategies', { scope: 'strategies:read' }),
    );
    expect(formatStrategies(strategies).length).toBeGreaterThan(0);

    const first = accounts[0];
    if (!first) {
      // Not a failure: a key with no linked account has nothing account-scoped
      // to prove. Everything above still ran.
      return;
    }

    const deployed = parseAccountStrategies(
      await client.get(accountPath(first.id, 'strategies'), { scope: 'strategies:read' }),
    );
    expect(formatAccountStrategies(deployed).length).toBeGreaterThan(0);

    // A 409 here means the terminal is offline, which is a real state of the
    // world rather than a broken contract — so it is tolerated, and only a
    // parse or render failure fails this test.
    try {
      const positions = parsePositions(
        await client.get(accountPath(first.id, 'positions'), {
          scope: 'trading:read',
          conflictMeans: 'terminal offline',
        }),
      );
      const capped = capPositions(positions);

      expect(
        formatPositions(capped.positions, capped.notes, capped.totals).length,
      ).toBeGreaterThan(0);
    } catch (error) {
      expect(String(error)).toMatch(/409/);
    }

    // `list_pending_orders` is this task's own tool and the sixth leg of "the
    // whole W33 read path" this test claims to walk, so it is exercised here
    // too even though the task-19 brief's Step 4 code block omitted it — same
    // terminal-offline tolerance as positions above.
    try {
      const orders = parseOrders(
        await client.get(accountPath(first.id, 'orders'), {
          scope: 'trading:read',
          conflictMeans: 'terminal offline',
        }),
      );
      const cappedOrders = capOrders(orders);

      expect(
        formatOrders(cappedOrders.orders, cappedOrders.notes, cappedOrders.totals).length,
      ).toBeGreaterThan(0);
    } catch (error) {
      expect(String(error)).toMatch(/409/);
    }
  }, 60_000);
});
