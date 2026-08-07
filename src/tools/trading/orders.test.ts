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
});

describe('formatOrders', () => {
  test('renders an unused priceStopLimit as an em dash, never as zero', () => {
    const rendered = formatOrders([ORDER], []);

    expect(rendered).not.toContain('stop-limit 0');
  });

  test('renders a used priceStopLimit', () => {
    const rendered = formatOrders([{ ...ORDER, priceStopLimit: 2375.0 }], []);

    expect(rendered).toContain('stop-limit 2375');
  });

  test('renders an unset stop loss and take profit as em dashes', () => {
    const rendered = formatOrders([{ ...ORDER, sl: 0, tp: 0 }], []);

    expect(rendered).toContain('SL — · TP —');
    expect(rendered).not.toContain('SL 0.00');
  });

  test('shows the ticket, which is the handle for cancelling an order', () => {
    expect(formatOrders([ORDER], [])).toContain('ticket 987654');
  });

  test('states that an empty list is a real zero, not an unreadable terminal', () => {
    const rendered = formatOrders([], []);

    expect(rendered).toMatch(/no pending orders/i);
    expect(rendered).toMatch(/offline/i);
  });

  test('surfaces notes in the text', () => {
    expect(formatOrders([ORDER], ['Truncated: showing 200 of 250 orders.'])).toContain(
      'Truncated: showing 200 of 250 orders.',
    );
  });

  test('agrees in number', () => {
    expect(formatOrders([ORDER], [])).toContain('1 pending order');
    expect(formatOrders([ORDER, { ...ORDER, ticket: 2 }], [])).toContain('2 pending orders');
  });
});
