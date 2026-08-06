import { describe, expect, test } from 'vitest';
import { type Broker, formatBrokers, parseBrokers } from './list-brokers.js';

const BROKER: Broker = {
  id: 'b1',
  name: 'Exness',
  servers: ['Exness-MT5Trial6', 'Exness-MT5Real'],
  accountTypes: [
    { id: 'at1', name: 'Standard', defaultSymbol: 'EURUSD' },
    { id: 'at2', name: 'Pro', defaultSymbol: 'XAUUSD' },
  ],
};

describe('parseBrokers', () => {
  test('accepts a well-formed broker list', () => {
    expect(parseBrokers([BROKER])).toEqual([BROKER]);
  });

  test('strips fields the schema does not declare', () => {
    const parsed = parseBrokers([{ ...BROKER, internalRank: 3 }]);

    expect(parsed[0]).not.toHaveProperty('internalRank');
  });

  test('rejects a broker missing a required field, naming it', () => {
    const { servers: _dropped, ...incomplete } = BROKER;

    expect(() => parseBrokers([incomplete])).toThrow(/servers/);
  });

  test('rejects a payload that is not an array', () => {
    expect(() => parseBrokers({ brokers: [] })).toThrow(/unexpected shape/);
  });
});

describe('formatBrokers', () => {
  test('states that the catalog is platform-wide rather than the linked accounts', () => {
    expect(formatBrokers([BROKER])).toMatch(/platform-wide/i);
  });

  test('renders servers and account types with the id needed to link an account', () => {
    const rendered = formatBrokers([BROKER]);

    expect(rendered).toContain('Exness');
    expect(rendered).toContain('Exness-MT5Trial6');
    expect(rendered).toContain('Standard');
    expect(rendered).toContain('at1');
    expect(rendered).toContain('EURUSD');
  });

  test('agrees in number', () => {
    expect(formatBrokers([BROKER])).toContain('1 broker');
    expect(formatBrokers([BROKER, { ...BROKER, id: 'b2', name: 'Vantage' }])).toContain(
      '2 brokers',
    );
  });

  test('explains an empty catalog rather than returning nothing', () => {
    expect(formatBrokers([]).length).toBeGreaterThan(0);
    expect(formatBrokers([])).toMatch(/no active brokers/i);
  });
});
