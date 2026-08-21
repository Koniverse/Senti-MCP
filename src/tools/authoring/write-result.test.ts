import { describe, expect, test } from 'vitest';
import type { Attachment, Draft } from './get-draft.js';
import {
  cancelledDelete,
  formatAttachmentWrite,
  formatDeleted,
  formatDraftWrite,
  parseDeleted,
  parseWrittenAttachment,
  parseWrittenDraft,
  shapeAttachmentWrite,
  shapeDraftWrite,
} from './write-result.js';

const ATTACHMENT: Attachment = {
  id: 'a-1',
  filename: 'Trend.mq5',
  sourceCode: 'abcde',
  createdAt: '2026-08-14T09:30:00.000Z',
};

const DRAFT: Draft = {
  id: 'd-1',
  name: 'Gold Scalper',
  sourceCode: 'x'.repeat(4812),
  createdAt: '2026-08-14T09:22:41.318Z',
  updatedAt: '2026-08-21T04:07:55.902Z',
  lastCompileStatus: 'SUCCESS',
  lastCompileLog: 'ok',
  logTruncated: false,
  lastCompileDiagnostics: [],
  compiledUpToDate: false,
  eaDefinitionId: null,
  attachments: [ATTACHMENT],
};

describe('shapeDraftWrite', () => {
  test('replaces the source with its byte count', () => {
    const shaped = shapeDraftWrite(DRAFT);

    expect(shaped).not.toHaveProperty('sourceCode');
    expect(shaped.sourceBytes).toBe(4812);
  });

  test('replaces every attachment source with its byte count', () => {
    const shaped = shapeDraftWrite(DRAFT);

    expect(shaped.attachments[0]).not.toHaveProperty('sourceCode');
    expect(shaped.attachments[0]?.sourceBytes).toBe(5);
  });

  test('notes the source cut, naming the draftId to read it back with', () => {
    const [first] = shapeDraftWrite(DRAFT).notes;

    expect(first).toContain('get_draft');
    expect(first).toContain('d-1');
  });

  test('notes the attachment cut only when an attachment had a body', () => {
    const empty = { ...DRAFT, attachments: [{ ...ATTACHMENT, sourceCode: '' }] };

    expect(shapeDraftWrite(DRAFT).notes).toHaveLength(2);
    expect(shapeDraftWrite(empty).notes).toHaveLength(1);
  });

  test('writes no note at all when there was nothing to cut', () => {
    const blank = { ...DRAFT, sourceCode: '', attachments: [] };

    expect(shapeDraftWrite(blank).notes).toEqual([]);
  });

  test('counts UTF-8 bytes, not UTF-16 code units', () => {
    const unicode = { ...DRAFT, sourceCode: '€', attachments: [] };

    expect(shapeDraftWrite(unicode).sourceBytes).toBe(3);
  });

  test('keeps the fields a caller needs to act on next', () => {
    const shaped = shapeDraftWrite(DRAFT);

    expect(shaped.id).toBe('d-1');
    expect(shaped.lastCompileStatus).toBe('SUCCESS');
    expect(shaped.compiledUpToDate).toBe(false);
    expect(shaped.eaDefinitionId).toBeNull();
  });
});

describe('formatDraftWrite', () => {
  test('renders the byte count with thousands separators', () => {
    expect(formatDraftWrite(shapeDraftWrite(DRAFT), 'created')).toContain('4,812 bytes');
  });

  test('says full replace on an update and not on a create', () => {
    const shaped = shapeDraftWrite(DRAFT);

    expect(formatDraftWrite(shaped, 'updated')).toContain('full replace');
    expect(formatDraftWrite(shaped, 'created')).not.toContain('full replace');
  });

  test('renders one byte figure, not a before/after delta the PUT cannot supply', () => {
    const bare = { ...DRAFT, attachments: [] };

    const text = formatDraftWrite(shapeDraftWrite(bare), 'updated');

    expect(text.match(/[\d,]+ bytes/g)).toEqual(['4,812 bytes']);
  });

  test('warns that a stale compile needs redoing', () => {
    expect(formatDraftWrite(shapeDraftWrite(DRAFT), 'updated')).toContain('recompile');
  });

  test('says never compiled rather than inventing a since', () => {
    const fresh = { ...DRAFT, lastCompileStatus: null, lastCompileLog: null };

    expect(formatDraftWrite(shapeDraftWrite(fresh), 'created')).toContain('never compiled');
  });

  test('does not claim a stale compile when the source is unchanged', () => {
    const current = { ...DRAFT, compiledUpToDate: true };

    expect(formatDraftWrite(shapeDraftWrite(current), 'created')).not.toContain('recompile');
  });

  test('says attachments: none rather than an empty list', () => {
    const bare = { ...DRAFT, attachments: [] };

    expect(formatDraftWrite(shapeDraftWrite(bare), 'created')).toContain('attachments: none');
  });

  test('carries every note into the text, not only into structuredContent', () => {
    const shaped = shapeDraftWrite(DRAFT);
    const text = formatDraftWrite(shaped, 'created');

    for (const note of shaped.notes) expect(text).toContain(note);
  });

  test('never leaks the source it cut', () => {
    const shaped = shapeDraftWrite(DRAFT);

    expect(formatDraftWrite(shaped, 'created')).not.toContain(DRAFT.sourceCode);
  });
});

describe('shapeAttachmentWrite', () => {
  test('replaces the source with its byte count and notes the cut', () => {
    const shaped = shapeAttachmentWrite(ATTACHMENT);

    expect(shaped).not.toHaveProperty('sourceCode');
    expect(shaped.sourceBytes).toBe(5);
    expect(shaped.notes[0]).toContain('list_draft_attachments');
  });

  test('writes no note for an empty file, which lost nothing', () => {
    expect(shapeAttachmentWrite({ ...ATTACHMENT, sourceCode: '' }).notes).toEqual([]);
  });
});

describe('formatAttachmentWrite', () => {
  test('names the exact resource and iCustom lines the EA still needs', () => {
    const text = formatAttachmentWrite(shapeAttachmentWrite(ATTACHMENT), 'attached to', 'd-1');

    expect(text).toContain('#resource "Trend.ex5"');
    expect(text).toContain('iCustom(_Symbol, _Period, "::Trend.ex5"');
    expect(text).toContain('update_draft');
  });

  test('says nothing about wiring on a replace, where it is already wired', () => {
    const text = formatAttachmentWrite(shapeAttachmentWrite(ATTACHMENT), 'replaced on', 'd-1');

    expect(text).not.toContain('#resource');
    expect(text).toContain('replaced on draft d-1');
  });

  test('derives the .ex5 name case-insensitively', () => {
    const upper = { ...ATTACHMENT, filename: 'Trend.MQ5' };

    expect(formatAttachmentWrite(shapeAttachmentWrite(upper), 'attached to', 'd-1')).toContain(
      '"Trend.ex5"',
    );
  });
});

describe('parseDeleted', () => {
  test('reports a real deletion', () => {
    expect(parseDeleted({ id: 'd-1' }, 'deleted draft')).toEqual({
      id: 'd-1',
      deleted: true,
      notes: [],
    });
  });

  test('names the subject when the shape is wrong', () => {
    expect(() => parseDeleted({}, 'deleted draft')).toThrow(/deleted draft/);
  });
});

describe('formatDeleted', () => {
  test('names what went and the id it had', () => {
    expect(formatDeleted(parseDeleted({ id: 'd-1' }, 'deleted draft'), 'Draft d-1')).toBe(
      'Draft d-1 deleted (id d-1).',
    );
  });
});

describe('cancelledDelete', () => {
  test('is a success that says nothing happened', () => {
    const cancelled = cancelledDelete('Draft "Gold Scalper"');

    expect(cancelled.structured.deleted).toBe(false);
    expect(cancelled.structured.id).toBeNull();
    expect(cancelled.text).toContain('nothing was deleted');
    expect(cancelled.structured.notes[0]).toContain('no request was sent');
  });
});

describe('parseWrittenDraft and parseWrittenAttachment', () => {
  test('name the subject when the API returns an unexpected shape', () => {
    expect(() => parseWrittenDraft({ id: 'd-1' }, 'created draft')).toThrow(/created draft/);
    expect(() => parseWrittenAttachment({ id: 'a-1' }, 'created attachment')).toThrow(
      /created attachment/,
    );
  });

  test('accept the real shapes whole', () => {
    expect(parseWrittenDraft(DRAFT, 'created draft')).toEqual(DRAFT);
    expect(parseWrittenAttachment(ATTACHMENT, 'created attachment')).toEqual(ATTACHMENT);
  });
});
