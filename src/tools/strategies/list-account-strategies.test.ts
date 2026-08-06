import { describe, expect, test } from 'vitest';
import {
  type AccountStrategy,
  formatAccountStrategies,
  parseAccountStrategies,
} from './list-account-strategies.js';

const DEPLOYED: AccountStrategy = {
  id: 'ae1',
  mt5AccountId: '8f2c1b40-3d5e-4a17-9c8b-2e1f0a6d4b93',
  eaDefinitionId: 's1',
  symbol: 'EURUSD',
  timeframe: 'H1',
  status: 'RUNNING',
  chartId: '12345',
  eaDefinition: { name: 'TrendRider' },
  mt5Account: { id: '8f2c1b40-3d5e-4a17-9c8b-2e1f0a6d4b93', login: '51234567', label: 'Main Live' },
};

describe('parseAccountStrategies', () => {
  test('accepts a well-formed deployment list', () => {
    expect(parseAccountStrategies([DEPLOYED])).toEqual([DEPLOYED]);
  });

  test('accepts a null chartId', () => {
    expect(() => parseAccountStrategies([{ ...DEPLOYED, chartId: null }])).not.toThrow();
  });

  test('rejects a deployment missing a required field, naming it', () => {
    const { timeframe: _dropped, ...incomplete } = DEPLOYED;

    expect(() => parseAccountStrategies([incomplete])).toThrow(/timeframe/);
  });

  test('rejects a payload that is not an array', () => {
    expect(() => parseAccountStrategies({ strategies: [] })).toThrow(/unexpected shape/);
  });
});

describe('formatAccountStrategies', () => {
  test('renders the strategy name, symbol, timeframe and status', () => {
    const rendered = formatAccountStrategies([DEPLOYED]);

    expect(rendered).toContain('TrendRider');
    expect(rendered).toContain('EURUSD');
    expect(rendered).toContain('H1');
    expect(rendered).toContain('RUNNING');
  });

  test('shows the activeEaId, which is the handle for stopping a deployment', () => {
    expect(formatAccountStrategies([DEPLOYED])).toContain('activeEaId: ae1');
  });

  test('agrees in number', () => {
    expect(formatAccountStrategies([DEPLOYED])).toContain('1 strategy');
    expect(formatAccountStrategies([DEPLOYED, { ...DEPLOYED, id: 'ae2' }])).toContain(
      '2 strategies',
    );
  });

  test('explains an empty deployment list without implying an error', () => {
    const rendered = formatAccountStrategies([]);

    expect(rendered).toMatch(/no strategies/i);
    expect(rendered).toMatch(/list_strategies/);
  });
});
