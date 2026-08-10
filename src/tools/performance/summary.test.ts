import { describe, expect, test } from 'vitest';
import {
  PerformanceInputSchema,
  type Performance,
  formatPerformance,
  parsePerformance,
} from './summary.js';

/**
 * Transcribed from a live `GET /api/v1/accounts/{accountId}/performance` read on
 * 2026-08-10 against `be-dev.sentitrade.xyz`, not from the design spec's summary
 * of it. Two things this fixture settles that no schema states: `winRate` is a
 * percentage (48 wins of 58 closed deals renders as 82.76, not 0.83), and so are
 * `roi` and both `irr` figures.
 */
const PERFORMANCE: Performance = {
  metrics: {
    grossProfit: 3042.12,
    grossLoss: -373.32,
    winRate: 82.75862068965517,
    totalPnl: 2668.8,
    profitFactor: 8.148826743812277,
    totalBalance: 128751.31,
    totalEquity: 165873.03,
    totalVolume: 4.85,
    totalNotionalVolume: 1971479.65,
    longCount: 16,
    shortCount: 42,
    robotCount: 56,
    manualCount: 2,
    totalClosedDeals: 58,
    winCount: 48,
    lossCount: 10,
    unconvertedAccounts: [],
    notionalIncomplete: false,
    staleBalanceAccounts: [],
    deposits: 0,
    withdrawals: 0,
    netCashFlow: 0,
    commission: 0,
    swap: 0,
    fee: 0,
  },
  portfolioReturn: {
    roi: 2.1167091296009253,
    irr: 31.55911156908283,
    periodNetPnL: 2668.8,
    periodGrossDeposits: 0,
    startingBalance: 126082.51,
    endingValue: 165873.03,
    capitalBase: 126082.51,
    cashFlowCount: 0,
  },
  lifetimeIrr: {
    irr: 1581.109499644062,
    cashFlowCount: 3,
    earliestMs: 1780999200000,
    grossDeposits: 110007.76,
    grossWithdrawals: 0,
  },
  live: {
    balance: 128751.31,
    equity: 165802.7,
    profit: 37051.39,
    margin: 1159.12,
    marginFree: 164643.58,
    marginLevel: 14304.19,
    leverage: 500,
    currency: 'USD',
    name: 'Test API',
  },
};

const WINDOW = { from: '2026-05-01', to: '2026-05-31', reporting: 'USD' };

describe('parsePerformance', () => {
  test('accepts the four documented blocks', () => {
    expect(parsePerformance(PERFORMANCE)).toEqual(PERFORMANCE);
  });

  test('accepts a null live block — an offline terminal arrives inside a 200, not as an error', () => {
    expect(() => parsePerformance({ ...PERFORMANCE, live: null })).not.toThrow();
  });

  test('accepts a null roi and irr — an account with no capital base has no return', () => {
    const noReturn = {
      ...PERFORMANCE,
      portfolioReturn: { ...PERFORMANCE.portfolioReturn, roi: null, irr: null },
    };

    expect(() => parsePerformance(noReturn)).not.toThrow();
  });

  test('accepts a null lifetime irr and earliestMs — an account with no cash flow has neither', () => {
    const noHistory = {
      ...PERFORMANCE,
      lifetimeIrr: { ...PERFORMANCE.lifetimeIrr, irr: null, earliestMs: null },
    };

    expect(() => parsePerformance(noHistory)).not.toThrow();
  });

  test('rejects a response missing a required metric, naming it', () => {
    const { profitFactor: _dropped, ...metrics } = PERFORMANCE.metrics;

    expect(() => parsePerformance({ ...PERFORMANCE, metrics })).toThrow(/profitFactor/);
  });

  test('rejects a response missing a whole block, naming it', () => {
    const { lifetimeIrr: _dropped, ...partial } = PERFORMANCE;

    expect(() => parsePerformance(partial)).toThrow(/lifetimeIrr/);
  });

  test('rejects a bare array', () => {
    expect(() => parsePerformance([PERFORMANCE])).toThrow(/unexpected shape/);
  });
});

describe('PerformanceInputSchema', () => {
  const parse = (input: unknown) => PerformanceInputSchema.safeParse(input);
  const messageOf = (input: unknown) =>
    parse(input).error?.issues.map((issue) => issue.message).join(' ') ?? '';

  test('requires accountId', () => {
    expect(parse({}).success).toBe(false);
  });

  test('accepts a call that supplies nothing but accountId — all three window inputs are optional', () => {
    expect(parse({ accountId: 'abc-123' }).success).toBe(true);
  });

  test('accepts a well-formed window', () => {
    expect(parse({ accountId: 'abc-123', ...WINDOW }).success).toBe(true);
  });

  test('rejects a from that is not YYYY-MM-DD, and names the format', () => {
    expect(parse({ accountId: 'abc-123', from: '05/01/2026' }).success).toBe(false);
    expect(messageOf({ accountId: 'abc-123', from: '05/01/2026' })).toContain('YYYY-MM-DD');
  });

  test('rejects a to that is not YYYY-MM-DD, and names the format', () => {
    expect(parse({ accountId: 'abc-123', to: 'last friday' }).success).toBe(false);
    expect(messageOf({ accountId: 'abc-123', to: 'last friday' })).toContain('YYYY-MM-DD');
  });

  /**
   * The regex alone would pass this. A model asked for "February" can produce a
   * month-end it never checked, and the API answers a 400 whose text is about a
   * query parameter rather than about the day not existing.
   */
  test('rejects a date in the right shape that is not a day on the calendar', () => {
    expect(parse({ accountId: 'abc-123', from: '2026-02-31' }).success).toBe(false);
  });

  test('rejects a reporting value that is not an ISO-4217 code, and names what one looks like', () => {
    expect(parse({ accountId: 'abc-123', reporting: 'monthly' }).success).toBe(false);
    expect(messageOf({ accountId: 'abc-123', reporting: 'monthly' })).toMatch(/ISO-4217/);
  });

  test('rejects a lowercase currency rather than silently sending it', () => {
    expect(parse({ accountId: 'abc-123', reporting: 'usd' }).success).toBe(false);
  });
});

describe('formatPerformance', () => {
  const rendered = (
    performance: Performance = PERFORMANCE,
    window: { from?: string; to?: string; reporting?: string } = WINDOW,
  ) => formatPerformance(performance, window);

  test('states the window the figures cover', () => {
    expect(rendered()).toContain('2026-05-01');
    expect(rendered()).toContain('2026-05-31');
  });

  /**
   * The response echoes no window back, so an omitted `from`/`to` leaves the
   * model free to attribute the figures to whatever period it had in mind. The
   * API documents the default; the text has to say it.
   */
  test('states the API default window when the caller supplied none', () => {
    const text = rendered(PERFORMANCE, {});

    expect(text).toMatch(/30 days/i);
    expect(text).toMatch(/default/i);
  });

  test('names the reporting currency the money is normalized to', () => {
    expect(rendered()).toContain('USD');
  });

  test('renders win rate as the percentage the API sends', () => {
    expect(rendered()).toContain('82.76%');
  });

  test('renders period ROI and IRR as percentages', () => {
    expect(rendered()).toContain('2.12%');
    expect(rendered()).toContain('31.56%');
  });

  test('renders the headline P&L and the deal counts behind it', () => {
    const text = rendered();

    expect(text).toContain('2,668.80');
    expect(text).toContain('58');
    expect(text).toContain('48');
    expect(text).toContain('10');
  });

  test('renders the live terminal block when the terminal answered', () => {
    const text = rendered();

    expect(text).toMatch(/equity 165,802.70/);
    expect(text).toMatch(/free margin 164,643.58/);
    expect(text).toMatch(/leverage 500/);
    expect(text).toMatch(/37,051.39/);
  });

  /**
   * AC-5, and EPIC-2's *null is not zero* invariant in its performance form. The
   * three failures this guards against are rendering the block as zeroes,
   * dropping it silently, and letting a model read it as a flat account.
   */
  test('states that a null live block means the terminal was unreachable', () => {
    const text = rendered({ ...PERFORMANCE, live: null });

    expect(text).toMatch(/terminal/i);
    expect(text).toMatch(/could not be reached/i);
  });

  test('does not render a null live block as a row of zeroes', () => {
    const text = rendered({ ...PERFORMANCE, live: null });

    expect(text).not.toMatch(/equity 0\.00/);
    expect(text).not.toMatch(/free margin 0\.00/);
    expect(text).not.toMatch(/leverage 0/);
  });

  test('does not drop the live section silently when it is null', () => {
    expect(rendered({ ...PERFORMANCE, live: null })).toMatch(/live/i);
  });

  test('says a null live block is not the same as an empty account', () => {
    expect(rendered({ ...PERFORMANCE, live: null })).toMatch(/not/i);
  });

  test('renders a null roi and irr as an em dash, never as zero', () => {
    const text = rendered({
      ...PERFORMANCE,
      portfolioReturn: { ...PERFORMANCE.portfolioReturn, roi: null, irr: null },
    });

    expect(text).toContain('ROI —');
    expect(text).not.toContain('ROI 0.00%');
  });

  test('renders a null lifetime irr as an em dash', () => {
    const text = rendered({
      ...PERFORMANCE,
      lifetimeIrr: { ...PERFORMANCE.lifetimeIrr, irr: null },
    });

    expect(text).toMatch(/lifetime IRR —/i);
  });

  test('renders earliestMs as a date a reader can place, and a null one as an em dash', () => {
    expect(rendered()).toContain('2026-06-09');
    expect(
      rendered({ ...PERFORMANCE, lifetimeIrr: { ...PERFORMANCE.lifetimeIrr, earliestMs: null } }),
    ).not.toContain('2026-06-09');
  });

  test('renders a null live currency and name without printing the word null', () => {
    const text = rendered({
      ...PERFORMANCE,
      live: { ...PERFORMANCE.live!, currency: null, name: null },
    });

    expect(text).not.toContain('null');
  });

  /**
   * `notionalIncomplete` is the API telling the reader that
   * `totalNotionalVolume` understates the truth. Quoting the number without the
   * caveat is the defect.
   */
  test('warns when notional volume is incomplete', () => {
    const text = rendered({
      ...PERFORMANCE,
      metrics: { ...PERFORMANCE.metrics, notionalIncomplete: true },
    });

    expect(text).toMatch(/notional/i);
    expect(text).toMatch(/incomplete|understate/i);
  });

  test('warns when a balance behind the figures is stale', () => {
    const text = rendered({
      ...PERFORMANCE,
      metrics: { ...PERFORMANCE.metrics, staleBalanceAccounts: ['abc-123'] },
    });

    expect(text).toMatch(/stale/i);
  });

  test('warns when an account could not be converted to the reporting currency', () => {
    const text = rendered({
      ...PERFORMANCE,
      metrics: { ...PERFORMANCE.metrics, unconvertedAccounts: ['abc-123'] },
    });

    expect(text).toMatch(/convert/i);
  });

  test('carries no caveat section when the API flagged nothing', () => {
    expect(rendered()).not.toMatch(/caveat/i);
  });
});
