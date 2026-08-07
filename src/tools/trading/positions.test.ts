import { describe, expect, test } from 'vitest';
import { type Position, capPositions, formatPositions, parsePositions } from './positions.js';

const POSITION: Position = {
  ticket: 123456,
  symbol: 'EURUSD',
  type: 'POSITION_TYPE_BUY',
  volume: 0.1,
  priceOpen: 1.0855,
  priceCurrent: 1.0871,
  sl: 1.08,
  tp: 1.095,
  swap: -0.12,
  profit: 16.0,
  openTime: '2026-08-05T09:12:00Z',
  magic: 0,
  comment: 'TrendRider',
};

/**
 * Renders the way the tool does: capped rows, but totals taken from the full
 * list. Passing totals derived from the rows would re-introduce the bug the
 * truncation tests below exist to catch.
 */
function render(positions: Position[], notes?: string[]): string {
  const capped = capPositions(positions);

  return formatPositions(capped.positions, notes ?? capped.notes, capped.totals);
}

describe('parsePositions', () => {
  test('unwraps the positions array from the response envelope', () => {
    expect(parsePositions({ positions: [POSITION] })).toEqual([POSITION]);
  });

  test('accepts an empty positions array', () => {
    expect(parsePositions({ positions: [] })).toEqual([]);
  });

  test('rejects a bare array — the envelope is part of the contract', () => {
    expect(() => parsePositions([POSITION])).toThrow(/unexpected shape/);
  });

  test('rejects a position missing a required field, naming it', () => {
    const { profit: _dropped, ...incomplete } = POSITION;

    expect(() => parsePositions({ positions: [incomplete] })).toThrow(/profit/);
  });

  test('accepts a null sl and tp — the live API may send either null or 0 for "not set"', () => {
    expect(() =>
      parsePositions({ positions: [{ ...POSITION, sl: null, tp: null }] }),
    ).not.toThrow();
  });
});

describe('capPositions', () => {
  test('leaves a normal list untouched and records no note', () => {
    const result = capPositions([POSITION]);

    expect(result.positions).toHaveLength(1);
    expect(result.notes).toEqual([]);
  });

  test('truncates beyond 200 rows and says so', () => {
    const many = Array.from({ length: 250 }, (_item, index) => ({
      ...POSITION,
      ticket: index,
    }));

    const result = capPositions(many);

    expect(result.positions).toHaveLength(200);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]).toMatch(/250/);
    expect(result.notes[0]).toMatch(/200/);
  });

  test('totals the list it was given, not the slice it returns', () => {
    const many = Array.from({ length: 250 }, (_item, index) => ({
      ...POSITION,
      ticket: index,
      profit: 10,
    }));

    expect(capPositions(many).totals).toEqual({ count: 250, floating: 2500 });
  });

  test('totals a list short enough to survive whole', () => {
    expect(capPositions([POSITION]).totals).toEqual({ count: 1, floating: 16 });
  });
});

describe('formatPositions', () => {
  test('renders an unset stop loss as an em dash, never as zero', () => {
    const rendered = render([{ ...POSITION, sl: 0, tp: 0 }]);

    expect(rendered).toContain('SL — · TP —');
    expect(rendered).not.toContain('SL 0.00');
  });

  test('renders a null stop loss and take profit as an em dash, same as zero', () => {
    const rendered = render([{ ...POSITION, sl: null, tp: null }]);

    expect(rendered).toContain('SL — · TP —');
  });

  test('renders a set stop loss and take profit', () => {
    const rendered = render([POSITION]);

    expect(rendered).toContain('SL 1.08');
    expect(rendered).toContain('TP 1.095');
  });

  test('shows the ticket, which is the handle for closing a position', () => {
    expect(render([POSITION])).toContain('ticket 123456');
  });

  test('renders profit and swap', () => {
    const rendered = render([POSITION]);

    expect(rendered).toContain('profit 16.00');
    expect(rendered).toContain('swap -0.12');
  });

  test('states that an empty list is a real zero, not an unreadable terminal', () => {
    const rendered = render([]);

    expect(rendered).toMatch(/no open positions/i);
    expect(rendered).toMatch(/offline/i);
  });

  test('surfaces notes in the text, not only in structured content', () => {
    const rendered = render([POSITION], ['Truncated: showing 200 of 250 positions.']);

    expect(rendered).toContain('Truncated: showing 200 of 250 positions.');
  });

  test('agrees in number', () => {
    expect(render([POSITION])).toContain('1 open position');
    expect(render([POSITION, { ...POSITION, ticket: 2 }])).toContain(
      '2 open positions',
    );
  });

  test('reports the account total after truncation, not the total of the survivors', () => {
    const many = Array.from({ length: 250 }, (_item, index) => ({
      ...POSITION,
      ticket: index,
      profit: 10,
    }));
    const capped = capPositions(many);

    const rendered = formatPositions(capped.positions, capped.notes, capped.totals);

    expect(rendered).toContain('250 open positions');
    expect(rendered).toContain('floating P&L 2,500.00');
    // The sum over the 200 surviving rows. Reporting it as the account's float
    // is the whole defect.
    expect(rendered).not.toContain('2,000.00');
  });

  test('says how many rows the header is actually showing when truncated', () => {
    const many = Array.from({ length: 250 }, (_item, index) => ({
      ...POSITION,
      ticket: index,
      profit: 10,
    }));
    const capped = capPositions(many);

    expect(formatPositions(capped.positions, capped.notes, capped.totals)).toContain(
      'showing the first 200',
    );
  });

  test('does not qualify the header when nothing was cut', () => {
    const capped = capPositions([POSITION]);

    expect(formatPositions(capped.positions, capped.notes, capped.totals)).not.toContain('showing');
  });
});
