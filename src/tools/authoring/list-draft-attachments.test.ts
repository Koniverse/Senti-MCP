import { describe, expect, test } from 'vitest';
import type { Attachment } from './get-draft.js';
import {
  ATTACHMENT_BUDGET_BYTES,
  formatAttachments,
  parseAttachments,
  shapeAttachments,
} from './list-draft-attachments.js';

const small = (id: string, filename: string, bytes: number): Attachment => ({
  id,
  filename,
  sourceCode: 'x'.repeat(bytes),
  createdAt: '2026-08-14T09:30:00.000Z',
});

const A = small('a-1', 'Trend.mq5', 100);
const B = small('a-2', 'Momentum.mq5', 200);

describe('parseAttachments', () => {
  test('accepts a well-formed list', () => {
    expect(parseAttachments([A, B])).toEqual([A, B]);
  });

  test('accepts an empty list', () => {
    expect(parseAttachments([])).toEqual([]);
  });

  test('rejects a payload that is not an array', () => {
    expect(() => parseAttachments({ attachments: [] })).toThrow(/unexpected shape/);
  });
});

describe('shapeAttachments', () => {
  test('returns every source whole when the set fits the budget', () => {
    const shaped = shapeAttachments([A, B]);

    expect(shaped.attachments.map((a) => a.sourceCode)).toEqual([A.sourceCode, B.sourceCode]);
    expect(shaped.notes).toEqual([]);
  });

  test('always reports byte size, whether or not the source survived', () => {
    expect(shapeAttachments([A]).attachments[0]?.sourceBytes).toBe(100);
  });

  test('returns the first attachment whole even when it alone exceeds the budget', () => {
    const huge = small('a-9', 'Huge.mq5', ATTACHMENT_BUDGET_BYTES + 1);

    expect(shapeAttachments([huge]).attachments[0]?.sourceCode).toBe(huge.sourceCode);
  });

  test('cuts an attachment that would breach the budget, keeping its metadata', () => {
    const first = small('a-1', 'First.mq5', ATTACHMENT_BUDGET_BYTES - 10);
    const second = small('a-2', 'Second.mq5', 100);
    const [kept, cut] = shapeAttachments([first, second]).attachments;

    expect(kept?.sourceCode).toBe(first.sourceCode);
    expect(cut?.sourceCode).toBeNull();
    expect(cut?.filename).toBe('Second.mq5');
    expect(cut?.sourceBytes).toBe(100);
  });

  test('never returns a partial source', () => {
    const first = small('a-1', 'First.mq5', ATTACHMENT_BUDGET_BYTES - 10);
    const second = small('a-2', 'Second.mq5', 100);

    for (const entry of shapeAttachments([first, second]).attachments) {
      expect(entry.sourceCode === null || entry.sourceCode.length === entry.sourceBytes).toBe(true);
    }
  });

  test('cuts everything after the first breach, even something that would fit', () => {
    const first = small('a-1', 'First.mq5', ATTACHMENT_BUDGET_BYTES - 10);
    const big = small('a-2', 'Big.mq5', 1000);
    const tiny = small('a-3', 'Tiny.mq5', 1);
    const [, cutBig, cutTiny] = shapeAttachments([first, big, tiny]).attachments;

    expect(cutBig?.sourceCode).toBeNull();
    expect(cutTiny?.sourceCode).toBeNull();
  });

  test('notes a cut, counts it, and names the way to read the rest', () => {
    const first = small('a-1', 'First.mq5', ATTACHMENT_BUDGET_BYTES - 10);
    const [note] = shapeAttachments([first, small('a-2', 'Second.mq5', 100)]).notes;

    expect(note).toContain('1 of 2');
    expect(note).toMatch(/filename/);
  });

  test('returns one named attachment whole and cuts nothing', () => {
    const huge = small('a-9', 'Huge.mq5', ATTACHMENT_BUDGET_BYTES * 2);
    const shaped = shapeAttachments([A, huge], 'Huge.mq5');

    expect(shaped.attachments).toHaveLength(1);
    expect(shaped.attachments[0]?.sourceCode).toBe(huge.sourceCode);
    expect(shaped.notes).toEqual([]);
  });

  test('returns nothing when the named filename does not exist', () => {
    expect(shapeAttachments([A, B], 'Missing.mq5').attachments).toEqual([]);
  });
});

describe('formatAttachments', () => {
  test('explains an empty draft rather than returning nothing', () => {
    const rendered = formatAttachments(shapeAttachments([]));

    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered).toMatch(/no indicator attachments/i);
  });

  test('lists the available filenames when a requested one is missing', () => {
    const rendered = formatAttachments(
      shapeAttachments([A, B], 'Missing.mq5'),
      'Missing.mq5',
      ['Trend.mq5', 'Momentum.mq5'],
    );

    expect(rendered).toContain('Missing.mq5');
    expect(rendered).toContain('Trend.mq5');
    expect(rendered).toContain('Momentum.mq5');
  });

  test('renders a returned source under its filename', () => {
    const rendered = formatAttachments(shapeAttachments([A]));

    expect(rendered).toContain('Trend.mq5');
    expect(rendered).toContain(A.sourceCode);
  });

  test('marks a cut attachment as unread rather than as empty', () => {
    const first = small('a-1', 'First.mq5', ATTACHMENT_BUDGET_BYTES - 10);
    const rendered = formatAttachments(shapeAttachments([first, small('a-2', 'Second.mq5', 100)]));

    expect(rendered).toMatch(/source not included/i);
  });

  test('repeats the note in the text', () => {
    const first = small('a-1', 'First.mq5', ATTACHMENT_BUDGET_BYTES - 10);
    const rendered = formatAttachments(shapeAttachments([first, small('a-2', 'Second.mq5', 100)]));

    expect(rendered).toMatch(/filename/);
  });
});
