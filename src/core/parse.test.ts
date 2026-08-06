import { describe, expect, test } from 'vitest';
import * as z from 'zod/v4';
import { parseOrThrow } from './parse.js';

const Row = z.object({ id: z.string(), size: z.number() });

describe('parseOrThrow', () => {
  test('returns the parsed value on success', () => {
    expect(parseOrThrow(Row, { id: 'a', size: 1 }, 'row')).toEqual({ id: 'a', size: 1 });
  });

  test('strips fields the schema does not declare', () => {
    expect(parseOrThrow(Row, { id: 'a', size: 1, extra: true }, 'row')).not.toHaveProperty(
      'extra',
    );
  });

  test('names the offending field, the subject, and what to do about it', () => {
    expect(() => parseOrThrow(Row, { id: 'a' }, 'row list')).toThrow(/size/);
    expect(() => parseOrThrow(Row, { id: 'a' }, 'row list')).toThrow(/row list/);
    expect(() => parseOrThrow(Row, { id: 'a' }, 'row list')).toThrow(/unexpected shape/);
    expect(() => parseOrThrow(Row, { id: 'a' }, 'row list')).toThrow(
      /senti-mcp-server needs updating/,
    );
  });

  test('reports a root-level mismatch as "(root)" rather than an empty path', () => {
    expect(() => parseOrThrow(z.array(Row), { rows: [] }, 'row list')).toThrow(/\(root\)/);
  });

  test('joins a nested path with dots', () => {
    expect(() => parseOrThrow(z.array(Row), [{ id: 'a', size: 'big' }], 'row list')).toThrow(
      /0\.size/,
    );
  });
});
