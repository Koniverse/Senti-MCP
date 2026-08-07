import { describe, expect, test } from 'vitest';
import { type Strategy, formatStrategies, parseStrategies } from './list-strategies.js';

const STRATEGY: Strategy = {
  id: 's1',
  name: 'TrendRider',
  description: 'Follows the daily trend.',
  isActive: true,
  supportedSymbols: ['EURUSD', 'XAUUSD'],
  supportedTimeframes: ['H1', 'H4'],
  avgRating: 4.5,
  reviewCount: 12,
  presets: [{ id: 'p1', name: 'Conservative' }],
};

describe('parseStrategies', () => {
  test('accepts a well-formed strategy list', () => {
    expect(parseStrategies([STRATEGY])).toEqual([STRATEGY]);
  });

  test('accepts a strategy omitting the three optional fields entirely', () => {
    const minimal = {
      id: 's2',
      name: 'Minimal',
      isActive: false,
      avgRating: null,
      reviewCount: 0,
      presets: [],
    };

    expect(() => parseStrategies([minimal])).not.toThrow();
  });

  test('accepts a null description and a null avgRating', () => {
    expect(() =>
      parseStrategies([{ ...STRATEGY, description: null, avgRating: null }]),
    ).not.toThrow();
  });

  test('accepts a null supportedSymbols and supportedTimeframes — null and absent are both allowed', () => {
    expect(() =>
      parseStrategies([{ ...STRATEGY, supportedSymbols: null, supportedTimeframes: null }]),
    ).not.toThrow();
  });

  test('rejects a strategy missing a genuinely required field, naming it', () => {
    const { presets: _dropped, ...incomplete } = STRATEGY;

    expect(() => parseStrategies([incomplete])).toThrow(/presets/);
  });

  test('rejects a payload that is not an array', () => {
    expect(() => parseStrategies({ strategies: [] })).toThrow(/unexpected shape/);
  });
});

describe('formatStrategies', () => {
  test('states that the catalog is platform-wide', () => {
    expect(formatStrategies([STRATEGY])).toMatch(/platform-wide/i);
  });

  test('renders a null avgRating as an em dash, never as zero', () => {
    const rendered = formatStrategies([{ ...STRATEGY, avgRating: null, reviewCount: 0 }]);

    expect(rendered).toContain('rating —');
    expect(rendered).not.toContain('rating 0');
  });

  test('renders a present rating with its review count', () => {
    expect(formatStrategies([STRATEGY])).toContain('rating 4.5 (12 reviews)');
  });

  test('omits the symbols line when the field is absent rather than printing undefined', () => {
    const rendered = formatStrategies([
      { id: 's2', name: 'Minimal', isActive: true, avgRating: null, reviewCount: 0, presets: [] },
    ]);

    expect(rendered).not.toContain('undefined');
    expect(rendered).not.toContain('symbols:');
  });

  test('omits the symbols and timeframes lines when the fields are null, not merely absent', () => {
    const rendered = formatStrategies([
      { ...STRATEGY, supportedSymbols: null, supportedTimeframes: null },
    ]);

    expect(rendered).not.toContain('symbols:');
    expect(rendered).not.toContain('timeframes:');
  });

  test('marks an inactive strategy', () => {
    expect(formatStrategies([{ ...STRATEGY, isActive: false }])).toContain('inactive');
  });

  test('explains an empty catalog', () => {
    expect(formatStrategies([])).toMatch(/no active strategies/i);
  });
});
