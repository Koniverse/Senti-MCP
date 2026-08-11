import { describe, expect, test } from 'vitest';
import {
  type Deal,
  type DealPage,
  type DealQuery,
  formatDeals,
  parseDeals,
} from './deals.js';

const DEAL: Deal = {
  ticket: 4207514236,
  positionId: 4884575186,
  orderId: 4884575186,
  magic: 25,
  symbol: 'XAUUSDm',
  type: 'BUY',
  entry: 'OUT',
  volume: 0.01,
  price: 4336,
  commission: -0.35,
  fee: 0,
  swap: -1.2,
  profit: 11.04,
  comment: 'AT_DCA_B_9',
  time: '2026-08-10T04:23:29.000Z',
};

/** The default the input schema applies; the formatter always sees a number. */
const QUERY: DealQuery = { limit: 50 };

const page = (over: Partial<DealPage> = {}): DealPage => ({
  deals: [DEAL],
  nextCursor: null,
  syncedThrough: null,
  ...over,
});

const render = (over: Partial<DealPage> = {}, query: DealQuery = QUERY) =>
  formatDeals(page(over), query);

describe('parseDeals', () => {
  test('unwraps the page from the response envelope', () => {
    const parsed = parseDeals({ deals: [DEAL], nextCursor: 'abc', syncedThrough: 'sync' });

    expect(parsed).toEqual({ deals: [DEAL], nextCursor: 'abc', syncedThrough: 'sync' });
  });

  test('accepts an empty deals array', () => {
    expect(parseDeals({ deals: [], nextCursor: null, syncedThrough: null }).deals).toEqual([]);
  });

  test('rejects a bare array — the envelope is part of the contract', () => {
    expect(() => parseDeals([DEAL])).toThrow(/unexpected shape/);
  });

  test('rejects a deal missing a required field, naming it', () => {
    const { profit: _dropped, ...incomplete } = DEAL;

    expect(() => parseDeals({ deals: [incomplete], nextCursor: null })).toThrow(/profit/);
  });

  test('rejects an entry value outside the API\'s declared set', () => {
    expect(() => parseDeals({ deals: [{ ...DEAL, entry: 'out' }], nextCursor: null })).toThrow(
      /entry/,
    );
  });

  test('accepts all four MT5 entry kinds', () => {
    for (const entry of ['IN', 'OUT', 'INOUT', 'OUT_BY'] as const) {
      expect(parseDeals({ deals: [{ ...DEAL, entry }], nextCursor: null }).deals[0]?.entry).toBe(
        entry,
      );
    }
  });

  test('normalizes an absent nextCursor to null, the same as an explicit one', () => {
    // An absent cursor already means what a null cursor means. Failing here
    // would turn the last page into "the API may have changed".
    expect(parseDeals({ deals: [] }).nextCursor).toBeNull();
    expect(parseDeals({ deals: [], nextCursor: null }).nextCursor).toBeNull();
  });

  test('normalizes an absent syncedThrough to null', () => {
    expect(parseDeals({ deals: [] }).syncedThrough).toBeNull();
  });
});

describe('formatDeals — pagination status', () => {
  test('states that more deals exist and quotes the cursor to pass back', () => {
    const rendered = render({ nextCursor: 'eyJ2IjoxfQ' });

    expect(rendered).toMatch(/more deals are available/i);
    // Quoted in the text, not only in structuredContent: many clients surface
    // `content` alone, and a cursor a model cannot see is a page it cannot ask
    // for.
    expect(rendered).toContain('cursor="eyJ2IjoxfQ"');
    expect(rendered).toMatch(/call list_deals again/i);
  });

  test('says outright that it did not follow the cursor itself', () => {
    expect(render({ nextCursor: 'eyJ2IjoxfQ' })).toMatch(/never follows a cursor on its own/i);
  });

  test('states the last page when nextCursor is null', () => {
    const rendered = render({ nextCursor: null });

    expect(rendered).toMatch(/this is the last page/i);
    expect(rendered).not.toMatch(/more deals are available/i);
  });

  test('the two pagination cases are distinguishable in the text alone', () => {
    const more = render({ nextCursor: 'eyJ2IjoxfQ' });
    const last = render({ nextCursor: null });

    expect(more).not.toEqual(last);
    expect(last).not.toContain('cursor="');
  });

  test('names the page size the cursor would retrieve', () => {
    expect(render({ nextCursor: 'c' }, { limit: 10 })).toContain('next 10');
  });
});

describe('formatDeals — an empty page', () => {
  test('states a real zero rather than a failed or truncated read', () => {
    const rendered = formatDeals(page({ deals: [] }), QUERY);

    expect(rendered).toMatch(/real zero/i);
    expect(rendered).toMatch(/the request succeeded/i);
    expect(rendered).toMatch(/no deals/i);
  });

  test('does not lean on the terminal-offline sentence, which cannot apply here', () => {
    // `positions` and `orders` distinguish a real zero from a 409. This
    // endpoint declares no 409, so borrowing that wording would promise a
    // guarantee the API never made.
    expect(formatDeals(page({ deals: [] }), QUERY)).not.toMatch(/offline/i);
  });

  test('names the filter as the likelier cause than an account that never traded', () => {
    const rendered = formatDeals(page({ deals: [] }), {
      limit: 50,
      entry: 'out',
      from: '2030-01-01',
    });

    expect(rendered).toContain('closing deals only');
    expect(rendered).toContain('from 2030-01-01');
    expect(rendered).toMatch(/widen or drop/i);
  });

  test('still reports more pages when an empty page carries a cursor', () => {
    expect(formatDeals(page({ deals: [], nextCursor: 'c' }), QUERY)).toMatch(
      /more deals are available/i,
    );
  });

  test('says it is the last page without pointing at rows that are not there', () => {
    const rendered = formatDeals(page({ deals: [] }), QUERY);

    expect(rendered).toMatch(/this is the last page/i);
    // "no more deals after these" refers to nothing when there are no rows.
    expect(rendered).not.toContain('after these');
  });
});

describe('formatDeals — deal rows', () => {
  test('renders the ticket, symbol, direction, entry kind, volume and price', () => {
    const rendered = render();

    expect(rendered).toContain('XAUUSDm BUY OUT 0.01 lots at 4336');
    expect(rendered).toContain('ticket 4207514236');
  });

  test('renders realized profit, and the costs when any is non-zero', () => {
    const rendered = render();

    expect(rendered).toContain('profit 11.04');
    expect(rendered).toContain('commission -0.35');
    expect(rendered).toContain('swap -1.20');
    expect(rendered).toContain('fee 0.00');
  });

  test('drops the cost group entirely when commission, swap and fee are all zero', () => {
    const rendered = render({ deals: [{ ...DEAL, commission: 0, swap: 0, fee: 0 }] });

    expect(rendered).toContain('profit 11.04');
    expect(rendered).not.toContain('commission');
    expect(rendered).not.toContain('swap');
  });

  test('never suppresses a zero profit — a realized 0.00 is the answer, not an absence', () => {
    const rendered = render({ deals: [{ ...DEAL, entry: 'IN', profit: 0 }] });

    expect(rendered).toContain('profit 0.00');
    expect(rendered).not.toContain('profit —');
  });

  test('names a magic of 0 as manual rather than printing a bare zero', () => {
    const rendered = render({ deals: [{ ...DEAL, magic: 0 }] });

    expect(rendered).toContain('manual');
    expect(rendered).not.toContain('magic 0');
  });

  test('names the expert advisor magic when one placed the deal', () => {
    expect(render()).toContain('magic 25');
  });

  test('links the deal to its position and order', () => {
    const rendered = render();

    expect(rendered).toContain('position 4884575186');
    expect(rendered).toContain('order 4884575186');
  });

  test('renders a comment only when there is one', () => {
    expect(render()).toContain('comment: AT_DCA_B_9');
    expect(render({ deals: [{ ...DEAL, comment: '' }] })).not.toContain('comment:');
  });

  test('agrees in number', () => {
    expect(render()).toContain('1 deal on this page');
    expect(render({ deals: [DEAL, { ...DEAL, ticket: 2 }] })).toContain('2 deals on this page');
  });
});

describe('formatDeals — the header', () => {
  test('totals the page and says it is the page, not the account', () => {
    const rendered = render({ deals: [DEAL, { ...DEAL, ticket: 2, profit: 8.96 }] });

    expect(rendered).toContain('20.00');
    // The defect this guards: a model summing one page and reporting it as the
    // account's lifetime P&L.
    expect(rendered).toMatch(/not the account's total/i);
    expect(rendered).toContain('get_account_performance');
  });

  test('states the requested window and filter, which the response never echoes', () => {
    const rendered = render({}, { limit: 50, entry: 'in', from: '2026-07-01', to: '2026-07-31' });

    expect(rendered).toContain('opening deals only');
    expect(rendered).toContain('2026-07-01 → 2026-07-31');
  });

  test('says nothing about a window the caller did not ask for', () => {
    expect(render()).not.toContain('→');
  });

  test('reports how far the warehouse has ingested, when the API says', () => {
    const rendered = render({ syncedThrough: '2026-08-10T04:23:29.000Z' });

    expect(rendered).toContain('2026-08-10T04:23:29.000Z');
    expect(rendered).toMatch(/not in this answer yet/i);
  });

  test('omits the freshness sentence when the API does not say', () => {
    expect(render({ syncedThrough: null })).not.toMatch(/ingested up to/i);
  });
});
