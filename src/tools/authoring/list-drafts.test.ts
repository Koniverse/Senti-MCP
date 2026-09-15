import { describe, expect, test } from 'vitest';
import type { Draft } from './get-draft.js';
import { type DraftSummary, formatDrafts, parseDrafts } from './list-drafts.js';

/** A `DraftSummary` as `GET /api/v1/drafts` serves it — every published field present. */
const SUMMARY: DraftSummary = {
  id: 'd-1',
  name: 'RSI Reversal',
  sourceBytes: 1024,
  sourceSha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
  createdAt: '2026-08-14T09:22:41.318Z',
  updatedAt: '2026-08-18T04:07:55.902Z',
  lastCompileStatus: 'SUCCESS',
  compileLogBytes: 2425,
  logTruncated: false,
  diagnosticsCount: 2,
  compiledUpToDate: true,
  eaDefinitionId: 'ea-9',
  attachments: [
    {
      id: 'a-1',
      filename: 'Trend.mq5',
      sourceBytes: 512,
      createdAt: '2026-08-14T09:30:00.000Z',
      updatedAt: '2026-08-15T11:02:13.000Z',
    },
  ],
};

/** A draft that never compiled: no status, no log, nothing registered. */
const BARE: DraftSummary = {
  ...SUMMARY,
  id: 'd-2',
  name: 'Untitled',
  lastCompileStatus: null,
  compileLogBytes: null,
  diagnosticsCount: 0,
  compiledUpToDate: false,
  eaDefinitionId: null,
  attachments: [],
};

/** The shape the collection had before Senti US-46.49, and still has under `view=full`. */
const FULL: Draft = {
  id: 'd-1',
  name: 'RSI Reversal',
  sourceCode: 'x'.repeat(1024),
  createdAt: '2026-08-14T09:22:41.318Z',
  updatedAt: '2026-08-18T04:07:55.902Z',
  lastCompileStatus: 'SUCCESS',
  lastCompileLog: 'y'.repeat(2048),
  logTruncated: false,
  lastCompileDiagnostics: [],
  compiledUpToDate: true,
  eaDefinitionId: 'ea-9',
  attachments: [
    { id: 'a-1', filename: 'Trend.mq5', sourceCode: 'z'.repeat(512), createdAt: '2026-08-14T09:30:00.000Z' },
  ],
};

describe('parseDrafts', () => {
  test('keeps every field of the published summary, attachments included', () => {
    expect(parseDrafts([SUMMARY, BARE])).toEqual([SUMMARY, BARE]);
  });

  test('accepts an empty collection', () => {
    expect(parseDrafts([])).toEqual([]);
  });

  test('rejects a payload that is not an array', () => {
    expect(() => parseDrafts({ drafts: [] })).toThrow(/unexpected shape/);
  });

  test('rejects a collection of full drafts as an API change', () => {
    // No full-shape fallback: if the API ever serves full drafts by default again, the
    // honest report is that the contract moved back (US-9.1 §Story refresh).
    expect(() => parseDrafts([FULL])).toThrow(/unexpected shape for the draft list/);
    expect(() => parseDrafts([FULL])).toThrow(/API may have changed/);
  });
});

describe('formatDrafts', () => {
  test('explains an empty collection rather than returning nothing', () => {
    expect(formatDrafts([])).toMatch(/no drafts/i);
  });

  test('names create_draft as a way to make one, since this server has had write tools since 2.5.0', () => {
    expect(formatDrafts([])).toMatch(/create_draft/);
  });

  test('renders the draftId a caller needs for get_draft', () => {
    expect(formatDrafts([SUMMARY])).toContain('d-1');
  });

  test('renders the source size the server reported', () => {
    expect(formatDrafts([SUMMARY])).toContain('1024 bytes');
  });

  test('marks a draft that can be registered without recompiling', () => {
    expect(formatDrafts([SUMMARY])).toMatch(/ready to register/i);
    expect(formatDrafts([BARE])).not.toMatch(/ready to register/i);
  });

  test('says never compiled rather than printing null', () => {
    const rendered = formatDrafts([BARE]);

    expect(rendered).toMatch(/never compiled/i);
    expect(rendered).not.toContain('null');
  });

  test('renders the source hash, so a caller can tell whether its copy is current', () => {
    expect(formatDrafts([SUMMARY])).toContain(SUMMARY.sourceSha256);
  });

  test('states the compile log size and where to read it, even with no diagnostics', () => {
    // The live smoke account's case: a SUCCESS compile, a 2,425-byte log, zero diagnostics.
    // `diagnosticsCount` alone would say there is nothing to read.
    const clean: DraftSummary = { ...SUMMARY, diagnosticsCount: 0 };
    const line = formatDrafts([clean])
      .split('\n')
      .find((entry) => entry.includes('2425'));

    expect(line).toMatch(/log/i);
    expect(line).toMatch(/get_draft/);
  });

  test('says a truncated log comes back as its trailing 16 KiB only', () => {
    const truncated: DraftSummary = { ...SUMMARY, compileLogBytes: 20480, logTruncated: true };
    const line = formatDrafts([truncated])
      .split('\n')
      .find((entry) => entry.includes('20480'));

    expect(line).toMatch(/trailing 16 KiB/);
  });

  test('renders no log line for a draft with no log', () => {
    expect(formatDrafts([BARE])).not.toMatch(/log/i);
  });

  test('agrees in number', () => {
    expect(formatDrafts([SUMMARY])).toContain('1 draft');
    expect(formatDrafts([SUMMARY, BARE])).toContain('2 drafts');
  });
});
