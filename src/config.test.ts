import { describe, expect, test } from 'vitest';
import { loadConfig } from './config.js';

const KEY = 'sq_live_testkey';

describe('loadConfig', () => {
  test('rejects a missing API key with instructions for creating one', () => {
    expect(() => loadConfig({})).toThrow(/SENTI_API_KEY/);
    expect(() => loadConfig({})).toThrow(/api-keys/i);
  });

  test('treats a blank API key as missing', () => {
    expect(() => loadConfig({ SENTI_API_KEY: '   ' })).toThrow(/SENTI_API_KEY/);
  });

  test('defaults the base URL to production', () => {
    expect(loadConfig({ SENTI_API_KEY: KEY }).baseUrl).toBe('https://api.sentitrade.xyz');
  });

  test('honours SENTI_API_BASE_URL', () => {
    const config = loadConfig({
      SENTI_API_KEY: KEY,
      SENTI_API_BASE_URL: 'https://be-dev.sentitrade.xyz',
    });

    expect(config.baseUrl).toBe('https://be-dev.sentitrade.xyz');
  });

  test('strips trailing slashes from the base URL', () => {
    const config = loadConfig({
      SENTI_API_KEY: KEY,
      SENTI_API_BASE_URL: 'https://be-dev.sentitrade.xyz///',
    });

    expect(config.baseUrl).toBe('https://be-dev.sentitrade.xyz');
  });

  test('rejects a base URL that is not absolute', () => {
    expect(() => loadConfig({ SENTI_API_KEY: KEY, SENTI_API_BASE_URL: '/api' })).toThrow(
      /absolute URL/,
    );
  });

  test('keeps the API key verbatim', () => {
    expect(loadConfig({ SENTI_API_KEY: KEY }).apiKey).toBe(KEY);
  });
});
