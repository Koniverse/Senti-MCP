import { describe, expect, test } from 'vitest';
import { type Conventions, formatConventions, parseConventions } from './conventions.js';

const CONVENTIONS: Conventions = {
  hardSafetyConstraints: ['NEVER use #import of a DLL, and never call any DLL/Windows-API function.'],
  tradingSafetyRequirements: ['Every order must carry a stop loss.'],
  forbiddenConstructs: [
    {
      id: 'NO_DLL_IMPORT',
      pattern: '#(?:\\s|\\/\\*(?:[^*]|\\*(?!\\/))*\\*\\/)*import\\b',
      reason: '#import is forbidden — AI-authored EAs may not import DLLs.',
    },
  ],
  limits: {
    maxDrafts: 20,
    maxAttachmentsPerDraft: 5,
    maxAttachmentBytes: 65536,
    maxSourceBytes: 196608,
    maxRegisteredEas: 10,
  },
};

describe('parseConventions', () => {
  test('accepts a well-formed document', () => {
    expect(parseConventions(CONVENTIONS)).toEqual(CONVENTIONS);
  });

  test('rejects a document missing limits, naming the field', () => {
    const { limits: _dropped, ...incomplete } = CONVENTIONS;

    expect(() => parseConventions(incomplete)).toThrow(/limits/);
  });

  test('rejects a limits block missing one ceiling', () => {
    const { maxSourceBytes: _dropped, ...partial } = CONVENTIONS.limits;

    expect(() => parseConventions({ ...CONVENTIONS, limits: partial })).toThrow(
      /maxSourceBytes/,
    );
  });
});

describe('formatConventions', () => {
  test('renders every rule, because these are instructions rather than data', () => {
    const rendered = formatConventions(CONVENTIONS);

    expect(rendered).toContain('NEVER use #import');
    expect(rendered).toContain('Every order must carry a stop loss.');
    expect(rendered).toContain('NO_DLL_IMPORT');
  });

  test('reproduces a forbidden pattern verbatim, escapes intact', () => {
    expect(formatConventions(CONVENTIONS)).toContain(
      '#(?:\\s|\\/\\*(?:[^*]|\\*(?!\\/))*\\*\\/)*import\\b',
    );
  });

  test('says the patterns are regexes and that it did not run them', () => {
    const rendered = formatConventions(CONVENTIONS);

    expect(rendered).toMatch(/regular expression/i);
    expect(rendered).toMatch(/not been (run|applied|tested)/i);
  });

  test('states the limits a caller would otherwise discover by being rejected', () => {
    const rendered = formatConventions(CONVENTIONS);

    expect(rendered).toContain('20');
    expect(rendered).toContain('192 KiB');
    expect(rendered).toContain('64 KiB');
  });
});
