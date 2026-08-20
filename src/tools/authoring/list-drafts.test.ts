import { describe, expect, test } from 'vitest';
import type { Draft } from './get-draft.js';
import { formatDrafts, parseDrafts, shapeDrafts } from './list-drafts.js';

const DRAFT: Draft = {
  id: 'd-1',
  name: 'RSI Reversal',
  sourceCode: 'x'.repeat(1024),
  createdAt: '2026-08-14T09:22:41.318Z',
  updatedAt: '2026-08-18T04:07:55.902Z',
  lastCompileStatus: 'SUCCESS',
  lastCompileLog: 'y'.repeat(2048),
  logTruncated: false,
  lastCompileDiagnostics: [{ severity: 'warning' }, { severity: 'warning' }],
  compiledUpToDate: true,
  eaDefinitionId: 'ea-9',
  attachments: [
    { id: 'a-1', filename: 'Trend.mq5', sourceCode: 'z'.repeat(512), createdAt: '2026-08-14T09:30:00.000Z' },
  ],
};

const BARE: Draft = {
  ...DRAFT,
  id: 'd-2',
  name: 'Untitled',
  lastCompileStatus: null,
  lastCompileLog: null,
  lastCompileDiagnostics: [],
  compiledUpToDate: false,
  eaDefinitionId: null,
  attachments: [],
};

describe('parseDrafts', () => {
  test('accepts a well-formed collection', () => {
    expect(parseDrafts([DRAFT, BARE])).toEqual([DRAFT, BARE]);
  });

  test('accepts an empty collection', () => {
    expect(parseDrafts([])).toEqual([]);
  });

  test('rejects a payload that is not an array', () => {
    expect(() => parseDrafts({ drafts: [] })).toThrow(/unexpected shape/);
  });
});

describe('shapeDrafts', () => {
  test('drops the EA source and reports its byte count', () => {
    const [draft] = shapeDrafts([DRAFT]).drafts;

    expect(draft).not.toHaveProperty('sourceCode');
    expect(draft?.sourceBytes).toBe(1024);
  });

  test('drops the compile log and the field describing it', () => {
    const [draft] = shapeDrafts([DRAFT]).drafts;

    expect(draft).not.toHaveProperty('lastCompileLog');
    expect(draft).not.toHaveProperty('logTruncated');
  });

  test('reduces diagnostics to a count', () => {
    const [draft] = shapeDrafts([DRAFT]).drafts;

    expect(draft).not.toHaveProperty('lastCompileDiagnostics');
    expect(draft?.diagnosticsCount).toBe(2);
  });

  test('drops attachment source and reports its byte count', () => {
    const [attachment] = shapeDrafts([DRAFT]).drafts[0]!.attachments;

    expect(attachment).not.toHaveProperty('sourceCode');
    expect(attachment?.sourceBytes).toBe(512);
  });

  test('keeps every field a caller chooses between drafts on', () => {
    const [draft] = shapeDrafts([DRAFT]).drafts;

    expect(draft?.id).toBe('d-1');
    expect(draft?.name).toBe('RSI Reversal');
    expect(draft?.updatedAt).toBe('2026-08-18T04:07:55.902Z');
    expect(draft?.lastCompileStatus).toBe('SUCCESS');
    expect(draft?.compiledUpToDate).toBe(true);
    expect(draft?.eaDefinitionId).toBe('ea-9');
  });

  test('notes what was cut and names both tools that return it', () => {
    const [note] = shapeDrafts([DRAFT]).notes;

    expect(note).toMatch(/get_draft/);
    expect(note).toMatch(/list_draft_attachments/);
  });

  test('counts the drafts and attachments the cut touched', () => {
    const [note] = shapeDrafts([DRAFT, BARE]).notes;

    expect(note).toContain('2 draft');
    expect(note).toContain('1 attachment');
  });

  test('writes no note for an empty collection', () => {
    expect(shapeDrafts([]).notes).toEqual([]);
  });
});

describe('formatDrafts', () => {
  test('explains an empty collection rather than returning nothing', () => {
    const rendered = formatDrafts(shapeDrafts([]));

    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered).toMatch(/no drafts/i);
  });

  test('renders the draftId a caller needs for get_draft', () => {
    expect(formatDrafts(shapeDrafts([DRAFT]))).toContain('d-1');
  });

  test('marks a draft that can be registered without recompiling', () => {
    expect(formatDrafts(shapeDrafts([DRAFT]))).toMatch(/ready to register/i);
    expect(formatDrafts(shapeDrafts([BARE]))).not.toMatch(/ready to register/i);
  });

  test('says never compiled rather than printing null', () => {
    const rendered = formatDrafts(shapeDrafts([BARE]));

    expect(rendered).toMatch(/never compiled/i);
    expect(rendered).not.toContain('null');
  });

  test('agrees in number', () => {
    expect(formatDrafts(shapeDrafts([DRAFT]))).toContain('1 draft');
    expect(formatDrafts(shapeDrafts([DRAFT, BARE]))).toContain('2 drafts');
  });

  test('repeats the note in the text', () => {
    expect(formatDrafts(shapeDrafts([DRAFT]))).toMatch(/get_draft/);
  });
});
