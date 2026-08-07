import { describe, expect, test } from 'vitest';
import { type Order, capOrders, formatOrders, parseOrders } from './orders.js';

const ORDER: Order = {
  ticket: 987654,
  symbol: 'XAUUSD',
  type: 'ORDER_TYPE_BUY_LIMIT',
  volume: 0.2,
  priceOpen: 2380.5,
  sl: 2370.0,
  tp: 2400.0,
  timeSetup: '2026-08-05T10:00:00Z',
  priceStopLimit: 0,
  magic: 0,
  comment: '',
};

/**
 * Renders the way the tool does: capped rows, but the count taken from the
 * full list.
 */
function render(orders: Order[], notes?: string[]): string {
  const capped = capOrders(orders);

  return formatOrders(capped.orders, notes ?? capped.notes, capped.totals);
}

describe('parseOrders', () => {
  test('unwraps the orders array from the response envelope', () => {
    expect(parseOrders({ orders: [ORDER] })).toEqual([ORDER]);
  });

  test('accepts an empty orders array', () => {
    expect(parseOrders({ orders: [] })).toEqual([]);
  });

  test('rejects a bare array — the envelope is part of the contract', () => {
    expect(() => parseOrders([ORDER])).toThrow(/unexpected shape/);
  });

  test('rejects an order missing a required field, naming it', () => {
    const { timeSetup: _dropped, ...incomplete } = ORDER;

    expect(() => parseOrders({ orders: [incomplete] })).toThrow(/timeSetup/);
  });

  test('accepts a null sl, tp and priceStopLimit — the live API may send either null or 0 for "not set"', () => {
    expect(() =>
      parseOrders({ orders: [{ ...ORDER, sl: null, tp: null, priceStopLimit: null }] }),
    ).not.toThrow();
  });
});

describe('capOrders', () => {
  test('leaves a normal list untouched and records no note', () => {
    const result = capOrders([ORDER]);

    expect(result.orders).toHaveLength(1);
    expect(result.notes).toEqual([]);
  });

  test('truncates beyond 200 rows and says so', () => {
    const many = Array.from({ length: 250 }, (_item, index) => ({ ...ORDER, ticket: index }));

    const result = capOrders(many);

    expect(result.orders).toHaveLength(200);
    expect(result.notes[0]).toMatch(/250/);
    expect(result.notes[0]).toMatch(/200/);
  });

  test('counts the list it was given, not the slice it returns', () => {
    const many = Array.from({ length: 250 }, (_item, index) => ({ ...ORDER, ticket: index }));

    expect(capOrders(many).totals).toEqual({ count: 250 });
  });

  test('counts a list short enough to survive whole', () => {
    expect(capOrders([ORDER]).totals).toEqual({ count: 1 });
  });
});

describe('formatOrders', () => {
  test('omits the stop-limit line entirely when priceStopLimit is unused', () => {
    const rendered = render([ORDER]);

    expect(rendered).not.toMatch(/stop-limit/i);
  });

  test('renders a used priceStopLimit', () => {
    const rendered = render([{ ...ORDER, priceStopLimit: 2375.0 }]);

    expect(rendered).toContain('stop-limit 2375');
  });

  test('omits the stop-limit line entirely when priceStopLimit is null, same as zero', () => {
    const rendered = render([{ ...ORDER, priceStopLimit: null }]);

    expect(rendered).not.toMatch(/stop-limit/i);
  });

  test('renders an unset stop loss and take profit as em dashes', () => {
    const rendered = render([{ ...ORDER, sl: 0, tp: 0 }]);

    expect(rendered).toContain('SL — · TP —');
    expect(rendered).not.toContain('SL 0.00');
  });

  test('renders a null stop loss and take profit as em dashes, same as zero', () => {
    const rendered = render([{ ...ORDER, sl: null, tp: null }]);

    expect(rendered).toContain('SL — · TP —');
  });

  test('shows the ticket, which is the handle for cancelling an order', () => {
    expect(render([ORDER])).toContain('ticket 987654');
  });

  test('states that an empty list is a real zero, not an unreadable terminal', () => {
    const rendered = render([]);

    expect(rendered).toMatch(/no pending orders/i);
    expect(rendered).toMatch(/offline/i);
  });

  test('surfaces notes in the text', () => {
    expect(render([ORDER], ['Truncated: showing 200 of 250 orders.'])).toContain(
      'Truncated: showing 200 of 250 orders.',
    );
  });

  test('agrees in number', () => {
    expect(render([ORDER])).toContain('1 pending order');
    expect(render([ORDER, { ...ORDER, ticket: 2 }])).toContain('2 pending orders');
  });

  test('reports the account count after truncation, not the count of the survivors', () => {
    const many = Array.from({ length: 250 }, (_item, index) => ({ ...ORDER, ticket: index }));
    const capped = capOrders(many);

    const rendered = formatOrders(capped.orders, capped.notes, capped.totals);

    expect(rendered).toContain('250 pending orders');
    expect(rendered).toContain('showing the first 200');
  });

  test('does not qualify the header when nothing was cut', () => {
    const capped = capOrders([ORDER]);

    expect(formatOrders(capped.orders, capped.notes, capped.totals)).not.toContain('showing');
  });
});
