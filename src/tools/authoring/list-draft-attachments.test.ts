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
      expect(
        entry.sourceCode === null ||
          Buffer.byteLength(entry.sourceCode, 'utf8') === entry.sourceBytes,
      ).toBe(true);
    }
  });

  test('never returns a partial source, checked in UTF-8 bytes rather than UTF-16 code units', () => {
    const accented: Attachment = {
      id: 'a-3',
      filename: 'Nhan.mq5',
      sourceCode: '// đặt lệnh mua khi giá vượt đỉnh',
      createdAt: '2026-08-14T09:30:00.000Z',
    };

    const [entry] = shapeAttachments([accented]).attachments;

    expect(entry?.sourceCode).toBe(accented.sourceCode);
    expect(entry?.sourceBytes).toBe(Buffer.byteLength(accented.sourceCode, 'utf8'));
    expect(entry?.sourceBytes).not.toBe(accented.sourceCode.length);
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

  test('does not claim a cut attachment exceeded the budget when it did not', () => {
    const first = small('a-1', 'First.mq5', ATTACHMENT_BUDGET_BYTES - 10);
    const big = small('a-2', 'Big.mq5', 1000);
    const tiny = small('a-3', 'Tiny.mq5', 1);
    const [note] = shapeAttachments([first, big, tiny]).notes;

    // `tiny` is cut because it follows the first breach, not because 1 byte breached
    // anything. Telling the model it "exceeded" the budget stops it re-reading the file.
    expect(note).toContain('2 of 3');
    expect(note).not.toMatch(/exceeded/i);
    expect(note).toMatch(/after the first one that does not fit/i);
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

  test('returns only the first match when the filename is shared, and notes how many', () => {
    const first = small('a-1', 'Indicator.mq5', 100);
    const second = { ...small('a-2', 'Indicator.mq5', 200), sourceCode: 'y'.repeat(200) };
    const third = { ...small('a-3', 'Indicator.mq5', 300), sourceCode: 'z'.repeat(300) };
    const shaped = shapeAttachments([first, second, third], 'Indicator.mq5');

    expect(shaped.attachments).toHaveLength(1);
    expect(shaped.attachments[0]?.id).toBe('a-1');
    expect(shaped.attachments[0]?.sourceCode).toBe(first.sourceCode);
    expect(shaped.notes).toHaveLength(1);
    expect(shaped.notes[0]).toContain('3');
    expect(shaped.notes[0]).toMatch(/Indicator\.mq5/);
  });

  test('reports how many were skipped, which is one fewer than the number that match', () => {
    const shared = (id: string) => small(id, 'Indicator.mq5', 100);
    const [note] = shapeAttachments([shared('a-1'), shared('a-2'), shared('a-3')], 'Indicator.mq5')
      .notes;

    // The tool description and the README both promise `notes` says how many were
    // *skipped*. Three attachments share the name; two were skipped.
    expect(note).toMatch(/2 skipped/);
  });
});

describe('formatAttachments', () => {
  test('explains an empty draft rather than returning nothing', () => {
    const rendered = formatAttachments(shapeAttachments([]), undefined, []);

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
    const rendered = formatAttachments(shapeAttachments([A]), undefined, ['Trend.mq5']);

    expect(rendered).toContain('Trend.mq5');
    expect(rendered).toContain(A.sourceCode);
  });

  test('marks a cut attachment as unread rather than as empty', () => {
    const first = small('a-1', 'First.mq5', ATTACHMENT_BUDGET_BYTES - 10);
    const rendered = formatAttachments(
      shapeAttachments([first, small('a-2', 'Second.mq5', 100)]),
      undefined,
      ['First.mq5', 'Second.mq5'],
    );

    expect(rendered).toMatch(/source not included/i);
  });

  test('repeats the note in the text', () => {
    const first = small('a-1', 'First.mq5', ATTACHMENT_BUDGET_BYTES - 10);
    const rendered = formatAttachments(
      shapeAttachments([first, small('a-2', 'Second.mq5', 100)]),
      undefined,
      ['First.mq5', 'Second.mq5'],
    );

    expect(rendered).toMatch(/filename/);
  });

  test('says a filtered read is filtered, and how many the draft actually holds', () => {
    const rendered = formatAttachments(shapeAttachments([A, B], 'Trend.mq5'), 'Trend.mq5', [
      'Trend.mq5',
      'Momentum.mq5',
    ]);

    // A host that surfaces `content` only must not read "1 attachment:" as the draft
    // having one attachment.
    expect(rendered).toMatch(/1 of 2 attachment/);
    expect(rendered).toMatch(/filtered by filename "Trend\.mq5"/i);
  });

  test('counts the whole set, not the filtered one, in an unfiltered read', () => {
    expect(formatAttachments(shapeAttachments([A, B]), undefined, ['Trend.mq5', 'Momentum.mq5']))
      .toMatch(/^2 attachments:/);
  });
});
