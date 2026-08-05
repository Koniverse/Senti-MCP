import { describe, expect, test } from 'vitest';
import { ApiError, describeError } from './errors.js';

describe('ApiError', () => {
  test('carries the HTTP status and envelope code', () => {
    const error = new ApiError('nope', 403, 'FORBIDDEN');

    expect(error.message).toBe('nope');
    expect(error.status).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
    expect(error).toBeInstanceOf(Error);
  });

  test('is identifiable by name', () => {
    expect(new ApiError('nope', 500).name).toBe('ApiError');
  });
});

describe('describeError', () => {
  test('renders a plain Error', () => {
    expect(describeError(new Error('boom'))).toBe('boom');
  });

  test('renders a string', () => {
    expect(describeError('boom')).toBe('boom');
  });

  test('flattens the cause chain, which is where fetch hides the real reason', () => {
    const error = new Error('fetch failed', {
      cause: new Error('Connect Timeout Error (attempted address: api.sentitrade.xyz:443)'),
    });

    expect(describeError(error)).toBe(
      'fetch failed: Connect Timeout Error (attempted address: api.sentitrade.xyz:443)',
    );
  });

  test('reads a code off a non-Error cause', () => {
    const error = new Error('fetch failed', { cause: { code: 'ENOTFOUND' } });

    expect(describeError(error)).toBe('fetch failed: ENOTFOUND');
  });

  test('does not repeat an identical cause message', () => {
    const error = new Error('boom', { cause: new Error('boom') });

    expect(describeError(error)).toBe('boom');
  });

  test('survives a self-referencing cause chain', () => {
    const error = new Error('a');
    (error as { cause?: unknown }).cause = error;

    expect(describeError(error)).toBe('a');
  });

  test('falls back to String() when nothing carries text', () => {
    expect(describeError(42)).toBe('42');
  });
});
