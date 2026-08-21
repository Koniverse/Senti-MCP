import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { SERVER_VERSION, loadConfig } from './config.js';

const KEY = 'sq_live_testkey';
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

  test('returns a frozen Config', () => {
    const config = loadConfig({ SENTI_API_KEY: KEY });

    expect(Object.isFrozen(config)).toBe(true);
  });

  test('rejects a scheme this client cannot fetch, naming the value', () => {
    for (const value of ['file:///etc/passwd', 'foo:bar', 'data:text/plain,x']) {
      expect(() => loadConfig({ SENTI_API_KEY: KEY, SENTI_API_BASE_URL: value })).toThrow(
        /must use https: or http:/,
      );
      expect(() => loadConfig({ SENTI_API_KEY: KEY, SENTI_API_BASE_URL: value })).toThrow(value);
    }
  });

  test('allows http: for a local API, and says why that is the weaker choice', () => {
    const config = loadConfig({
      SENTI_API_KEY: KEY,
      SENTI_API_BASE_URL: 'http://localhost:3000',
    });

    expect(config.baseUrl).toBe('http://localhost:3000');
  });

  test('rejects a base URL carrying a query string or fragment', () => {
    // `https://host?x=1` would otherwise be joined into the unreachable
    // `https://host/?x=1/api/v1/accounts`.
    for (const value of ['https://be-dev.sentitrade.xyz?x=1', 'https://be-dev.sentitrade.xyz#frag']) {
      expect(() => loadConfig({ SENTI_API_KEY: KEY, SENTI_API_BASE_URL: value })).toThrow(
        /must not carry a query string or fragment/,
      );
      expect(() => loadConfig({ SENTI_API_KEY: KEY, SENTI_API_BASE_URL: value })).toThrow(value);
    }
  });
});

/**
 * `SERVER_VERSION` is a third copy of the version string, and koni-docs only
 * checks `VERSION` against `package.json`. Without this the three drift apart
 * silently and the server reports a version it is not.
 */
describe('SERVER_VERSION', () => {
  test('matches package.json and VERSION', () => {
    const packageVersion = (
      JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as { version: string }
    ).version;
    const versionFile = readFileSync(path.join(repoRoot, 'VERSION'), 'utf8').trim();

    expect(SERVER_VERSION).toBe(packageVersion);
    expect(SERVER_VERSION).toBe(versionFile);
  });
});

describe('SENTI_ENABLE_AUTHORING_WRITE', () => {
  const base = { SENTI_API_KEY: 'sq_live_x' };

  test('is off when unset', () => {
    expect(loadConfig(base).authoringWrite).toBe(false);
  });

  test('is on for "1" and "true", case-insensitively and ignoring surrounding space', () => {
    for (const value of ['1', 'true', 'TRUE', ' True ']) {
      expect(loadConfig({ ...base, SENTI_ENABLE_AUTHORING_WRITE: value }).authoringWrite, value).toBe(
        true,
      );
    }
  });

  test('is off for every other value, so "0" and "false" are not surprises', () => {
    for (const value of ['0', 'false', 'no', 'off', 'yes', '', 'enabled']) {
      expect(loadConfig({ ...base, SENTI_ENABLE_AUTHORING_WRITE: value }).authoringWrite, value).toBe(
        false,
      );
    }
  });
});
