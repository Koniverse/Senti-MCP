import { describe, expect, test } from 'vitest';
import { type Draft, formatDraft, parseDraft, shapeDraft } from './get-draft.js';

const DRAFT: Draft = {
  id: 'd-1',
  name: 'RSI Reversal',
  sourceCode: '// 12 bytes\n',
  createdAt: '2026-08-14T09:22:41.318Z',
  updatedAt: '2026-08-18T04:07:55.902Z',
  lastCompileStatus: 'FAILED',
  lastCompileLog: 'strategy.mq5(42,7) : error 123: undeclared identifier',
  logTruncated: false,
  lastCompileDiagnostics: [
    {
      severity: 'error',
      file: 'strategy.mq5',
      line: 42,
      column: 7,
      code: '123',
      message: 'undeclared identifier',
    },
  ],
  compiledUpToDate: false,
  eaDefinitionId: null,
  attachments: [
    { id: 'a-1', filename: 'Trend.mq5', sourceCode: 'abcde', createdAt: '2026-08-14T09:30:00.000Z' },
  ],
};

const NO_ATTACHMENTS: Draft = { ...DRAFT, attachments: [] };

describe('parseDraft', () => {
  test('accepts a well-formed draft', () => {
    expect(parseDraft(DRAFT)).toEqual(DRAFT);
  });

  test('accepts a never-compiled draft, whose status and log are null', () => {
    const fresh = { ...NO_ATTACHMENTS, lastCompileStatus: null, lastCompileLog: null };

    expect(parseDraft(fresh).lastCompileStatus).toBeNull();
  });

  test('rejects a compile status outside the declared enum', () => {
    expect(() => parseDraft({ ...DRAFT, lastCompileStatus: 'BUILDING' })).toThrow(
      /lastCompileStatus/,
    );
  });

  test('accepts a diagnostic of an unknown shape rather than failing the whole read', () => {
    const odd = { ...DRAFT, lastCompileDiagnostics: [{ unexpected: true }] };

    expect(parseDraft(odd).lastCompileDiagnostics).toEqual([{ unexpected: true }]);
  });

  test('rejects a draft missing a required field, naming it', () => {
    const { compiledUpToDate: _dropped, ...incomplete } = DRAFT;

    expect(() => parseDraft(incomplete)).toThrow(/compiledUpToDate/);
  });
});

describe('shapeDraft', () => {
  test('keeps the EA source whole', () => {
    expect(shapeDraft(DRAFT).sourceCode).toBe(DRAFT.sourceCode);
  });

  test('keeps the compile log and diagnostics whole', () => {
    const shaped = shapeDraft(DRAFT);

    expect(shaped.lastCompileLog).toBe(DRAFT.lastCompileLog);
    expect(shaped.lastCompileDiagnostics).toEqual(DRAFT.lastCompileDiagnostics);
  });

  test('replaces each attachment source with its byte count', () => {
    const [attachment] = shapeDraft(DRAFT).attachments;

    expect(attachment).not.toHaveProperty('sourceCode');
    expect(attachment?.sourceBytes).toBe(5);
    expect(attachment?.filename).toBe('Trend.mq5');
  });

  test('counts bytes rather than UTF-16 code units', () => {
    const accented = {
      ...DRAFT,
      attachments: [{ ...DRAFT.attachments[0]!, sourceCode: '// đặt lệnh' }],
    };

    expect(shapeDraft(accented).attachments[0]?.sourceBytes).toBe(
      Buffer.byteLength('// đặt lệnh', 'utf8'),
    );
  });

  test('notes the cut and names the tool that undoes it', () => {
    const [note] = shapeDraft(DRAFT).notes;

    expect(note).toMatch(/list_draft_attachments/);
    expect(note).toContain('d-1');
  });

  test('writes no note when the draft has no attachments', () => {
    expect(shapeDraft(NO_ATTACHMENTS).notes).toEqual([]);
  });
});

describe('formatDraft', () => {
  test('renders a well-formed diagnostic as a readable location', () => {
    expect(formatDraft(shapeDraft(DRAFT))).toContain('strategy.mq5:42:7');
  });

  test('falls back to raw output for a diagnostic it cannot read', () => {
    const odd = shapeDraft({ ...DRAFT, lastCompileDiagnostics: [{ unexpected: true }] });

    expect(formatDraft(odd)).toContain('unexpected');
  });

  test('composes the register-readiness question the API documents', () => {
    const ready = shapeDraft({
      ...NO_ATTACHMENTS,
      lastCompileStatus: 'SUCCESS',
      compiledUpToDate: true,
    });

    expect(formatDraft(ready)).toMatch(/ready to register/i);
    expect(formatDraft(shapeDraft(DRAFT))).not.toMatch(/ready to register/i);
  });

  test('says a truncated log is truncated', () => {
    const truncated = shapeDraft({ ...NO_ATTACHMENTS, logTruncated: true });

    expect(formatDraft(truncated)).toMatch(/truncated/i);
  });

  test('says never compiled rather than printing null, and asserts nothing about a compile that never ran', () => {
    const fresh = shapeDraft({
      ...NO_ATTACHMENTS,
      lastCompileStatus: null,
      lastCompileLog: null,
    });
    const rendered = formatDraft(fresh);

    expect(rendered).toMatch(/never compiled/i);
    expect(rendered).not.toContain('null');
    expect(rendered).not.toMatch(/unchanged since/i);
  });

  test('says not registered rather than a placeholder that reads as a value', () => {
    const unregistered = shapeDraft({ ...NO_ATTACHMENTS, eaDefinitionId: null });

    expect(formatDraft(unregistered)).toMatch(/not registered/i);
    expect(formatDraft(unregistered)).not.toMatch(/registered EA/i);
  });

  test('names the registered EA when there is one', () => {
    const registered = shapeDraft({ ...NO_ATTACHMENTS, eaDefinitionId: 'ea-42' });

    expect(formatDraft(registered)).toMatch(/registered as ea-42/i);
  });

  test('repeats the note in the text, not only in structured content', () => {
    expect(formatDraft(shapeDraft(DRAFT))).toMatch(/list_draft_attachments/);
  });
});
