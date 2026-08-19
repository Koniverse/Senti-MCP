# Authoring Read Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register four read-only MCP tools over the Senti Quant API's `Authoring` `GET` operations, so an agent can read the platform's MQL5 authoring rules, list a user's drafts, read one draft's source and compiler output, and read its indicator attachments — each bounded so it cannot exhaust a context window.

**Architecture:** Four tool modules under `src/tools/authoring/`, registered through the existing `registerReadTool` substrate. `get-draft.ts` owns the full-fidelity `DraftSchema` and `AttachmentSchema`; its two siblings import and shape rather than redeclare. `core/client.ts` gains `draftPath`, extracted from `accountPath` over a shared private guard so the traversal check has exactly one implementation.

**Tech Stack:** TypeScript 7, Zod v4 (`zod/v4`), `@modelcontextprotocol/server`, Vitest, Node ≥ 22.11.0.

**Spec:** [docs/superpowers/specs/2026-08-19-senti-authoring-read-tools-design.md](../specs/2026-08-19-senti-authoring-read-tools-design.md)

## Global Constraints

Every task's requirements implicitly include this section.

- **Comment policy for this plan overrides repo style.** Existing modules such as
  `src/tools/performance/breakdowns.ts` carry long explanatory comments. **Code written under
  this plan does not.** Comment only where the reasoning is genuinely non-obvious — a
  measured constant, or a non-local decision a reader cannot recover from the code. No
  comment on self-explanatory names, basic functions, or restating what the next line does.
  The rationale lives in the spec and in the story files; that is what they are for.
- **The API key never enters an `inputSchema`** and never appears in returned text, including
  every error branch.
- **Tool failures are returned as `isError: true` text results, never thrown.** Guaranteed by
  `registerReadTool`; do not add a second try/catch.
- **Nothing writes to `stdout`.** Diagnostics go to `stderr`.
- **Every path parameter reaches a URL only through `accountPath` or `draftPath`.** No tool
  concatenates a path.
- **Byte counts are `Buffer.byteLength(value, 'utf8')`**, never `String.prototype.length`.
- **Docs ship in the same commit as the code that obliges them** (RULE-1).
- **`docs/sprints/STATUS.md` is generated** by `npm run agile:status` and never hand-edited
  (RULE-5).
- **No `## Active Context` block anywhere**, and no `.active-context.md` (CLAUDE.md).
- **`vitest.config.ts` stays scoped to `src/**/*.test.ts`** ([CONTEXT D13](../../CONTEXT.md)) — do not widen it.
- **Scope string:** `authoring:read`, declared as a file-local `const AUTHORING_READ` in each
  tool file, matching how `trading:read` is declared in three trading files today.
- **No authoring write operation is called from anywhere in this plan**, including tests and
  the smoke test.

---

### Task 0: Documentation scaffolding — EPIC-7, four stories, sprint rows

No code. This task exists because the sprint table and story files are what the five
implementation tasks report into, and RULE-1 makes each later commit depend on them existing.

**Files:**
- Create: `docs/sprints/epics/EPIC-7.md`
- Create: `docs/sprints/stories/US-7.1-authoring-substrate-and-conventions-tool.md`
- Create: `docs/sprints/stories/US-7.2-get-draft-tool.md`
- Create: `docs/sprints/stories/US-7.3-list-drafts-tool.md`
- Create: `docs/sprints/stories/US-7.4-list-draft-attachments-tool.md`
- Modify: `docs/sprints/sprint-2026-W34.md`
- Modify: `docs/CONTEXT.md` (append D32, D33)
- Regenerate: `docs/sprints/STATUS.md`

**Interfaces:**
- Consumes: nothing.
- Produces: story ids `US-7.1` … `US-7.4` and epic id `EPIC-7`, referenced by every later
  task's commit message and CHANGELOG entry.

- [ ] **Step 1: Write `EPIC-7.md`**

Front-matter `id: EPIC-7`, `title: "Authoring read path over MCP"`, `status: in-progress`,
`created: 2026-08-19`. Sections, mirroring EPIC-2's shape:

- **Goal** — an agent can read the platform's authoring contract and the user's drafts.
- **Business context** — the API grew from 17 to 29 operations; EPIC-2 closed `done` scoped
  to the ten `GET`s that existed on 2026-08-12, so this is a new epic rather than a
  reopening.
- **Feature pillars** — substrate + conventions (US-7.1); full-fidelity draft read (US-7.2);
  shaped collection (US-7.3); attachment budget (US-7.4).
- **Out of scope** — all 8 authoring writes. State that **[EPIC-3](epics/EPIC-3.md)'s
  operation table is stale at 7 and the real figure is 15**, and that this epic does not edit
  it.
- **Cross-cutting invariants** — copy the Global Constraints above that are project-wide.
- **What this epic does not claim** — the two live gaps from the spec: no diagnostic object
  has ever been observed, and no attachment exists on the smoke key, so every attachment code
  path is test-covered only.
- **Story index** — the four rows with points 3 / 2 / 3 / 2 and ships `2.1.0` … `2.4.0`.

- [ ] **Step 2: Write the four story files**

Each carries front-matter `id`, `title`, `epic: EPIC-7`, `status: ready`, `priority: P1`,
`points`, `sprint: sprint-2026-W34`, `assignee: bluezdot`, `created: 2026-08-19`, and a
`version_shipped` added when it ships. Each has §Goal, §Background (pointing at the spec
section that governs it), §Acceptance criteria, and §Tasks whose first entry is the
contract check named in the matching implementation task below.

- [ ] **Step 3: Add four rows to the sprint's existing scope table**

`docs/sprints/sprint-2026-W34.md` carries **one** scope table ([CONTEXT D30](../../CONTEXT.md)).
Append four rows to it — do **not** add a phase section, and do not create a second table:

```markdown
| US-7.1 | Authoring substrate and `get_authoring_conventions` *(added 2026-08-19)* | EPIC-7 | P1 | 3 | 🟢 ready | [link](stories/US-7.1-authoring-substrate-and-conventions-tool.md) |
| US-7.2 | `get_draft` tool *(added 2026-08-19)*                                    | EPIC-7 | P1 | 2 | 🟢 ready | [link](stories/US-7.2-get-draft-tool.md) |
| US-7.3 | `list_drafts` tool *(added 2026-08-19)*                                  | EPIC-7 | P1 | 3 | 🟢 ready | [link](stories/US-7.3-list-drafts-tool.md) |
| US-7.4 | `list_draft_attachments` tool *(added 2026-08-19)*                       | EPIC-7 | P1 | 2 | 🟢 ready | [link](stories/US-7.4-list-draft-attachments-tool.md) |
```

Update the total line to **6 stories / 13 points**, and append a clause to the front-matter
`goal` so it covers the new work:

```yaml
goal: 'Give a sprint file one scope table, retrofit the two written before that was the rule, and open the authoring read path with its first four MCP tools'
```

Add `[EPIC-7](epics/EPIC-7.md)` to §Cross-references.

- [ ] **Step 4: Append D32 and D33 to `docs/CONTEXT.md`**

The last decision is D31, so these are next.

- **D32 — `list_drafts` returns no source, and the cut is not optional.** Record the measured
  ceiling (20 × (192 KiB + 5 × 64 KiB + 16 KiB) = 10.3 MiB ≈ 2.7M tokens), the live figure
  (19,853 B → 1,898 B, 90.4% removed), and the rule it inherits from
  [D25](../../CONTEXT.md): every cut here loses information, so every cut writes a note.
- **D33 — `draftPath` is extracted from `accountPath`, not copied.** One `PATH_SEGMENT`
  regex, one guard loop, two prefixes. Duplicating a traversal guard is how one copy gets
  fixed and the other does not.

- [ ] **Step 5: Regenerate STATUS and validate**

Run from the repo root:

```bash
npm run agile:status
npm run agile:validate
```

Expected: `agile:validate` reports no errors; `STATUS.md` shows 29 stories with four in
🟢 Ready.

- [ ] **Step 6: Commit**

```bash
git add docs/
git commit -m "docs(EPIC-7): open the authoring read path, four stories into W34"
```

---

### Task 1: `draftPath` — one traversal guard, two prefixes

**Files:**
- Modify: `src/core/client.ts`
- Test: `src/core/client.test.ts`

**Interfaces:**
- Consumes: `PATH_SEGMENT` (existing, unexported), `accountPath` (existing, exported).
- Produces:
  - `draftPath(draftId: string, ...rest: string[]): string` → `/api/v1/drafts/<seg>[/<seg>…]`
  - `DRAFT_NOT_FOUND: string`
  - `accountPath` keeps its exact signature and its exact error message.

- [ ] **Step 1: Write the failing tests**

Append to `src/core/client.test.ts`:

```ts
describe('draftPath', () => {
  test('builds a draft path', () => {
    expect(draftPath('c2dfc055-929d-42b8-ab33-a524a4d1e7f8')).toBe(
      '/api/v1/drafts/c2dfc055-929d-42b8-ab33-a524a4d1e7f8',
    );
  });

  test('appends sub-resource segments', () => {
    expect(draftPath('abc-123', 'attachments')).toBe('/api/v1/drafts/abc-123/attachments');
  });

  test.each(['../etc', 'a/b', 'a%2Fb', 'has space', '', 'x'.repeat(65)])(
    'rejects %j',
    (value) => {
      expect(() => draftPath(value)).toThrow(/Invalid path segment/);
    },
  );

  test('rejects a traversal in a later segment', () => {
    expect(() => draftPath('abc-123', '../secrets')).toThrow(/Invalid path segment/);
  });

  test('points a bad draft id at list_drafts, not list_accounts', () => {
    expect(() => draftPath('../etc')).toThrow(/list_drafts/);
    expect(() => draftPath('../etc')).not.toThrow(/list_accounts/);
  });
});

describe('DRAFT_NOT_FOUND', () => {
  test('names the tool that produces a valid draft id', () => {
    expect(DRAFT_NOT_FOUND).toMatch(/list_drafts/);
  });

  test('does not blame the account, which this path does not take', () => {
    expect(DRAFT_NOT_FOUND).not.toMatch(/account/i);
  });
});
```

Extend the existing import on line 2 to `import { ACCOUNT_NOT_FOUND, accountPath, createClient, DRAFT_NOT_FOUND, draftPath } from './client.js';`

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/client.test.ts`
Expected: FAIL — `draftPath` and `DRAFT_NOT_FOUND` are not exported.

- [ ] **Step 3: Refactor `accountPath` onto a shared guard and add `draftPath`**

In `src/core/client.ts`, replace the whole `accountPath` function with the three below.
`PATH_SEGMENT` and its existing comment stay exactly as they are.

```ts
function segmentPath(prefix: string, segments: string[], hint: string): string {
  for (const segment of segments) {
    if (!PATH_SEGMENT.test(segment)) {
      throw new Error(
        `Invalid path segment ${JSON.stringify(segment)}: expected 1-64 characters from ` +
          'A-Z, a-z, 0-9, "_" and "-". Values containing "/", ".", "%" or whitespace are ' +
          `rejected before they reach a URL. ${hint}`,
      );
    }
  }

  return `${prefix}${segments.map(encodeURIComponent).join('/')}`;
}

export function accountPath(accountId: string, ...rest: string[]): string {
  return segmentPath(
    '/api/v1/accounts/',
    [accountId, ...rest],
    'Use the `id` field from list_accounts.',
  );
}

export function draftPath(draftId: string, ...rest: string[]): string {
  return segmentPath('/api/v1/drafts/', [draftId, ...rest], 'Use the `id` field from list_drafts.');
}
```

Keep the existing doc comment above `accountPath` — it explains why the guard exists at all,
which is the non-obvious part. Move it above `segmentPath`, since that is now where the guard
lives.

Add beside `ACCOUNT_NOT_FOUND`:

```ts
export const DRAFT_NOT_FOUND =
  'The draft does not exist or is not owned by this API key. ' +
  'Call list_drafts and use its `id`.';
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS. The pre-existing `accountPath` tests (`src/core/client.test.ts:350-391`) must
still pass unchanged — the refactor preserves the message byte for byte, including the
`list_accounts` hint the test at line 390 asserts.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/core/client.ts src/core/client.test.ts
git commit -m "refactor(client): extract segmentPath, add draftPath and DRAFT_NOT_FOUND

US-7.1. One traversal guard, two prefixes — see CONTEXT D33."
```

---

### Task 2: `get_authoring_conventions` — ships `2.1.0`, closes US-7.1

**Files:**
- Create: `src/tools/authoring/conventions.ts`
- Create: `src/tools/authoring/conventions.test.ts`
- Modify: `src/server.ts`
- Modify: `src/server.test.ts`
- Modify: `src/smoke.test.ts`
- Modify: `VERSION`, `package.json`, `package-lock.json`, `src/config.ts`, `docs/CHANGELOG.md`, `README.md`, `AGENTS.md`
- Modify: `docs/sprints/stories/US-7.1-authoring-substrate-and-conventions-tool.md`

**Interfaces:**
- Consumes: `SentiClient`, `parseOrThrow`, `registerReadTool`.
- Produces:
  - `ConventionsOutputSchema` (Zod object)
  - `type Conventions`
  - `parseConventions(payload: unknown): Conventions`
  - `formatConventions(conventions: Conventions): string`
  - `registerGetAuthoringConventions(server: McpServer, client: SentiClient): void`

- [ ] **Step 1: Contract check against the live service (TASK-7.1.1)**

Before writing code, confirm the response still matches what the spec measured. Run from the
repo root:

```bash
node --env-file=.env.local -e '
const r = await fetch((process.env.SENTI_API_BASE_URL ?? "https://be-dev.sentitrade.xyz")
  + "/api/v1/authoring/conventions",
  { headers: { authorization: `Bearer ${process.env.SENTI_SMOKE_KEY}` } });
const j = await r.json();
console.log(r.status, Object.keys(j).join(", "));
console.log(JSON.stringify(j.limits));
'
```

Expected: `200 hardSafetyConstraints, tradingSafetyRequirements, forbiddenConstructs, limits`
and `{"maxDrafts":20,"maxAttachmentsPerDraft":5,"maxAttachmentBytes":65536,"maxSourceBytes":196608,"maxRegisteredEas":10}`.

**If `limits` differs from those five values, stop and update the spec's §Measured limits
before continuing** — Task 5's budget constant is derived from `maxAttachmentBytes`.

- [ ] **Step 2: Write the failing tests**

Create `src/tools/authoring/conventions.test.ts`:

```ts
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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/tools/authoring/conventions.test.ts`
Expected: FAIL — cannot resolve `./conventions.js`.

- [ ] **Step 4: Write `conventions.ts`**

```ts
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { SentiClient } from '../../core/client.js';
import { parseOrThrow } from '../../core/parse.js';
import { registerReadTool } from '../../core/tool.js';

const ForbiddenConstructSchema = z.object({
  id: z.string(),
  pattern: z.string(),
  reason: z.string(),
});

const LimitsSchema = z.object({
  maxDrafts: z.number(),
  maxAttachmentsPerDraft: z.number(),
  maxAttachmentBytes: z.number(),
  maxSourceBytes: z.number(),
  maxRegisteredEas: z.number(),
});

export const ConventionsOutputSchema = z.object({
  hardSafetyConstraints: z.array(z.string()),
  tradingSafetyRequirements: z.array(z.string()),
  forbiddenConstructs: z.array(ForbiddenConstructSchema),
  limits: LimitsSchema,
});

export type Conventions = z.infer<typeof ConventionsOutputSchema>;

export function parseConventions(payload: unknown): Conventions {
  return parseOrThrow(ConventionsOutputSchema, payload, 'authoring conventions');
}

function kib(bytes: number): string {
  return `${Math.round(bytes / 1024)} KiB`;
}

function numbered(items: string[]): string {
  return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

export function formatConventions(conventions: Conventions): string {
  const { limits } = conventions;

  const forbidden = conventions.forbiddenConstructs
    .map((construct) => `- ${construct.id}\n  pattern: ${construct.pattern}\n  ${construct.reason}`)
    .join('\n');

  return [
    'Senti Quant MQL5 authoring contract. Read this before generating source: code that ' +
      'violates these rules is rejected by the L1 static scan before it reaches the ' +
      'compiler, and a compile slot is globally serial.',
    `Hard safety constraints:\n${numbered(conventions.hardSafetyConstraints)}`,
    `Trading safety requirements:\n${numbered(conventions.tradingSafetyRequirements)}`,
    'Forbidden constructs. Each `pattern` is a regular expression the static analyzer ' +
      'applies to your source. They have not been run against anything here — this tool ' +
      'reports the contract, it does not evaluate it, and the API does not document which ' +
      `regex dialect the analyzer uses.\n${forbidden}`,
    'Platform limits:\n' +
      `- at most ${limits.maxDrafts} drafts\n` +
      `- at most ${limits.maxAttachmentsPerDraft} attachments per draft\n` +
      `- at most ${kib(limits.maxAttachmentBytes)} per attachment\n` +
      `- at most ${kib(limits.maxSourceBytes)} of EA source per draft\n` +
      `- at most ${limits.maxRegisteredEas} registered EAs`,
  ].join('\n\n');
}

const AUTHORING_READ = 'authoring:read';

export function registerGetAuthoringConventions(server: McpServer, client: SentiClient): void {
  registerReadTool(server, {
    name: 'get_authoring_conventions',
    title: 'Read the MQL5 authoring rules',
    description:
      'Read the Senti Quant MQL5 authoring contract as data: the hard-safety constraints, ' +
      'the trading-safety requirements, the static analyzer\'s forbidden-construct list, ' +
      'and the platform limits on draft count and source size. CALL THIS BEFORE GENERATING ' +
      'ANY MQL5 SOURCE. Code that breaks these rules is rejected by a static scan before it ' +
      'reaches the compiler, and compile slots are globally serial, so discovering a rule ' +
      'by failing a compile is expensive and still fails. The response is small (~2 KB) and ' +
      'static per deploy. `forbiddenConstructs[].pattern` values are regular expressions ' +
      'reported verbatim — this tool does not evaluate them.',
    inputSchema: z.object({}),
    outputSchema: ConventionsOutputSchema,
    run: async (_args, signal) => {
      const payload = await client.get('/api/v1/authoring/conventions', {
        signal,
        scope: AUTHORING_READ,
      });
      const conventions = parseConventions(payload);

      return { text: formatConventions(conventions), structured: conventions };
    },
  });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/tools/authoring/conventions.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Register the tool**

In `src/server.ts`, add the import beside the others (alphabetical by path — `authoring`
sorts before `brokers`):

```ts
import { registerGetAuthoringConventions } from './tools/authoring/conventions.js';
```

and the call as the first registration in the body:

```ts
  registerGetAuthoringConventions(server, client);
```

- [ ] **Step 7: Enrol the tool in the server-level table**

In `src/server.test.ts`, add the import:

```ts
import { ConventionsOutputSchema } from './tools/authoring/conventions.js';
```

Add a fixture beside `BROKER`:

```ts
const CONVENTIONS = {
  hardSafetyConstraints: ['NEVER use #import of a DLL.'],
  tradingSafetyRequirements: ['Every order must carry a stop loss.'],
  forbiddenConstructs: [{ id: 'NO_DLL_IMPORT', pattern: '#import\\b', reason: 'No DLLs.' }],
  limits: {
    maxDrafts: 20,
    maxAttachmentsPerDraft: 5,
    maxAttachmentBytes: 65536,
    maxSourceBytes: 196608,
    maxRegisteredEas: 10,
  },
};
```

Add a row to `TOOL_CALLS` (line 1536 onward):

```ts
  {
    name: 'get_authoring_conventions',
    outputSchema: ConventionsOutputSchema,
    successBody: CONVENTIONS,
  },
```

This makes the "every registered tool appears in TOOL_CALLS" assertion at line 1603 pass, and
enrols the tool in the read-only-annotation and output-schema checks.

- [ ] **Step 8: Extend the smoke test**

In `src/smoke.test.ts`, add the import:

```ts
import { formatConventions, parseConventions } from './tools/authoring/conventions.js';
```

and inside the existing live test, after the brokers assertion:

```ts
    const conventions = parseConventions(
      await client.get('/api/v1/authoring/conventions', { scope: 'authoring:read' }),
    );
    expect(conventions.limits.maxDrafts).toBeGreaterThan(0);
    expect(formatConventions(conventions)).toMatch(/authoring contract/i);
```

- [ ] **Step 9: Run the whole suite and the live smoke**

```bash
npm test
npm run typecheck
npm run test:smoke
```

Expected: `npm test` passes; `test:smoke` passes against `be-dev.sentitrade.xyz`. If
`test:smoke` reports `403`, the key lacks `authoring:read` — stop and say so rather than
removing the assertion.

- [ ] **Step 10: Version, changelog, and docs**

- **Three files carry the version and `release:check` compares all three:** `VERSION`,
  `package.json` `version`, and `src/config.ts` `SERVER_VERSION`. Set all to `2.1.0`, then
  run `npm install --package-lock-only` to sync `package-lock.json`.
- `docs/CHANGELOG.md` — a new `## [2.1.0]` section (the bracketed form is what
  `release:check` greps for): added `get_authoring_conventions`; added
  `draftPath` and `DRAFT_NOT_FOUND` to the client substrate; note that the API grew from 17
  to 29 operations.
- `README.md` — one row in the tool table.
- `AGENTS.md` — correct **17 → 29 operations** and **10 → 11 tools**, add `tools/authoring/`
  to the structure block, and add `authoring:read` to the scope list.
- `docs/sprints/stories/US-7.1-…md` — `status: done`, `version_shipped: 2.1.0`, tick its
  acceptance criteria, and add an §Implementation notes recording the live `limits` observed
  in Step 1.

- [ ] **Step 11: Regenerate STATUS, validate, and run the release gate**

```bash
npm run agile:status
npm run agile:validate
npm run release:check
```

Expected: all three clean. `release:check` is what catches a `VERSION` / `package.json` /
CHANGELOG disagreement.

- [ ] **Step 12: Commit**

```bash
git add .
git commit -m "feat(authoring): get_authoring_conventions tool (2.1.0)

US-7.1. Closes the substrate + conventions story; the limits it publishes
size the cuts in US-7.3 and US-7.4."
```

---

### Task 3: `get_draft` — ships `2.2.0`, closes US-7.2

**Files:**
- Create: `src/tools/authoring/get-draft.ts`
- Create: `src/tools/authoring/get-draft.test.ts`
- Modify: `src/server.ts`, `src/server.test.ts`, `src/smoke.test.ts`
- Modify: `VERSION`, `package.json`, `package-lock.json`, `src/config.ts`, `docs/CHANGELOG.md`, `README.md`, `AGENTS.md`
- Modify: `docs/sprints/stories/US-7.2-get-draft-tool.md`

**Interfaces:**
- Consumes: `draftPath`, `DRAFT_NOT_FOUND` (Task 1); `parseOrThrow`; `registerReadTool`.
- Produces — the two schemas the next two tasks import, so the names matter:
  - `AttachmentSchema`, `type Attachment`
  - `DraftSchema`, `type Draft`
  - `DiagnosticSchema`
  - `AttachmentSummarySchema`
  - `byteLength(value: string): number`
  - `DraftOutputSchema`, `type ShapedDraft`
  - `parseDraft(payload: unknown): Draft`
  - `shapeDraft(draft: Draft): ShapedDraft`
  - `formatDraft(shaped: ShapedDraft): string`
  - `registerGetDraft(server: McpServer, client: SentiClient): void`

- [ ] **Step 1: Contract check against the live service (TASK-7.2.1)**

```bash
node --env-file=.env.local -e '
const base = process.env.SENTI_API_BASE_URL ?? "https://be-dev.sentitrade.xyz";
const h = { authorization: `Bearer ${process.env.SENTI_SMOKE_KEY}` };
const list = await (await fetch(base + "/api/v1/drafts", { headers: h })).json();
const one = await (await fetch(base + "/api/v1/drafts/" + list[0].id, { headers: h })).json();
console.log("keys:", Object.keys(one).sort().join(", "));
console.log("status:", one.lastCompileStatus, "| diagnostics:", JSON.stringify(one.lastCompileDiagnostics));
console.log("attachment keys:", Object.keys(one.attachments[0] ?? {}).join(", ") || "(no attachments)");
'
```

Expected keys: `attachments, compiledUpToDate, createdAt, eaDefinitionId, id,
lastCompileDiagnostics, lastCompileLog, lastCompileStatus, logTruncated, name, sourceCode,
updatedAt`.

**If a draft is in `FAILED` state and `lastCompileDiagnostics` is non-empty, record the
element's real shape in the story's §Implementation notes** and compare it to
`DiagnosticSchema` below. Do not tighten the parse either way — see §Payload policy in the
spec. **Do not call `POST /drafts/{draftId}/compile` to produce one**; that is a write and is
out of scope. Break a draft in the web Studio if you want the observation.

- [ ] **Step 2: Write the failing tests**

Create `src/tools/authoring/get-draft.test.ts`:

```ts
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

  test('repeats the note in the text, not only in structured content', () => {
    expect(formatDraft(shapeDraft(DRAFT))).toMatch(/list_draft_attachments/);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/tools/authoring/get-draft.test.ts`
Expected: FAIL — cannot resolve `./get-draft.js`.

- [ ] **Step 4: Write `get-draft.ts`**

```ts
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { DRAFT_NOT_FOUND, draftPath, type SentiClient } from '../../core/client.js';
import { parseOrThrow } from '../../core/parse.js';
import { registerReadTool } from '../../core/tool.js';

export const AttachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  sourceCode: z.string(),
  createdAt: z.string(),
});

export type Attachment = z.infer<typeof AttachmentSchema>;

/**
 * `lastCompileDiagnostics` stays `unknown`: the two GET paths declare it untyped, and
 * `parseOrThrow` is all-or-nothing, so transcribing the compile response's shape onto them
 * would take both draft tools down the day they diverge. `DiagnosticSchema` below is used
 * for rendering only.
 */
export const DraftSchema = z.object({
  id: z.string(),
  name: z.string(),
  sourceCode: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastCompileStatus: z.enum(['PENDING', 'SUCCESS', 'FAILED']).nullable(),
  lastCompileLog: z.string().nullable(),
  logTruncated: z.boolean(),
  lastCompileDiagnostics: z.array(z.unknown()),
  compiledUpToDate: z.boolean(),
  eaDefinitionId: z.string().nullable(),
  attachments: z.array(AttachmentSchema),
});

export type Draft = z.infer<typeof DraftSchema>;

/** Transcribed from `POST /drafts/{draftId}/compile`, which types what the GETs do not. */
export const DiagnosticSchema = z.object({
  severity: z.enum(['error', 'warning']),
  file: z.string(),
  line: z.number(),
  column: z.number(),
  code: z.string(),
  message: z.string(),
});

export const AttachmentSummarySchema = AttachmentSchema.omit({ sourceCode: true }).extend({
  sourceBytes: z.number(),
});

export const DraftOutputSchema = DraftSchema.omit({ attachments: true }).extend({
  attachments: z.array(AttachmentSummarySchema),
  notes: z.array(z.string()),
});

export type ShapedDraft = z.infer<typeof DraftOutputSchema>;

export function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

export function parseDraft(payload: unknown): Draft {
  return parseOrThrow(DraftSchema, payload, 'draft');
}

export function shapeDraft(draft: Draft): ShapedDraft {
  const attachments = draft.attachments.map(({ sourceCode, ...kept }) => ({
    ...kept,
    sourceBytes: byteLength(sourceCode),
  }));

  const notes =
    attachments.length === 0
      ? []
      : [
          `Attachment source was cut: ${attachments.length} indicator file(s) are listed ` +
            'with their size but without their code. Call list_draft_attachments with ' +
            `draftId "${draft.id}" to read them.`,
        ];

  return { ...draft, attachments, notes };
}

const NO_VALUE = '—';

function diagnosticLine(entry: unknown): string {
  const parsed = DiagnosticSchema.safeParse(entry);

  if (!parsed.success) return `- ${JSON.stringify(entry)}`;

  const { severity, code, file, line, column, message } = parsed.data;
  return `- ${severity} ${code} at ${file}:${line}:${column} — ${message}`;
}

function compileBlock(draft: ShapedDraft): string {
  const status = draft.lastCompileStatus ?? 'never compiled';
  const ready =
    draft.lastCompileStatus === 'SUCCESS' && draft.compiledUpToDate
      ? ' → ready to register without recompiling'
      : '';
  const head = `Compile: ${status} · source unchanged since that compile: ${
    draft.compiledUpToDate ? 'yes' : 'no'
  }${ready}`;

  const diagnostics =
    draft.lastCompileDiagnostics.length === 0
      ? ''
      : `\nDiagnostics (${draft.lastCompileDiagnostics.length}):\n${draft.lastCompileDiagnostics
          .map(diagnosticLine)
          .join('\n')}`;

  const log = draft.lastCompileLog
    ? `\nCompiler log${draft.logTruncated ? ' (truncated — this is the tail only)' : ''}:\n${
        draft.lastCompileLog
      }`
    : '';

  return `${head}${diagnostics}${log}`;
}

function attachmentBlock(draft: ShapedDraft): string {
  if (draft.attachments.length === 0) return 'Attachments: none.';

  const rows = draft.attachments
    .map((attachment) => `- ${attachment.filename} (${attachment.sourceBytes} bytes)`)
    .join('\n');

  return `Attachments (${draft.attachments.length}, source not included):\n${rows}`;
}

export function formatDraft(draft: ShapedDraft): string {
  const sections = [
    `Draft "${draft.name}" (draftId ${draft.id}) · ${byteLength(draft.sourceCode)} bytes of ` +
      `MQL5 · updated ${draft.updatedAt} · registered EA ${draft.eaDefinitionId ?? NO_VALUE}`,
    compileBlock(draft),
    attachmentBlock(draft),
    `Source:\n${draft.sourceCode}`,
  ];

  if (draft.notes.length > 0) {
    sections.push(`Notes:\n${draft.notes.map((note) => `- ${note}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

const AUTHORING_READ = 'authoring:read';

export function registerGetDraft(server: McpServer, client: SentiClient): void {
  registerReadTool(server, {
    name: 'get_draft',
    title: 'Read one MQL5 draft',
    description:
      'Read one MQL5 draft the API key owns: its full source code, its compiler log, its ' +
      'diagnostics, and whether the last compile still matches the current source. Use it ' +
      'to answer "why did this fail to compile" or "show me the code". `draftId` is the ' +
      '`id` field from list_drafts. THE RESPONSE CAN BE LARGE — a draft may hold up to ' +
      '192 KiB of source, roughly 48,000 tokens. Attachment source is NOT included; the ' +
      'attachments are listed with their size, and list_draft_attachments returns their ' +
      'code. For a cheap overview of every draft, call list_drafts instead.',
    inputSchema: z.object({ draftId: z.string() }),
    outputSchema: DraftOutputSchema,
    run: async (args, signal) => {
      const payload = await client.get(draftPath(args.draftId), {
        signal,
        scope: AUTHORING_READ,
        notFoundMeans: DRAFT_NOT_FOUND,
      });
      const shaped = shapeDraft(parseDraft(payload));

      return { text: formatDraft(shaped), structured: shaped };
    },
  });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/tools/authoring/get-draft.test.ts`
Expected: PASS, 16 tests.

- [ ] **Step 6: Register and enrol**

`src/server.ts` — import `registerGetDraft` from `./tools/authoring/get-draft.js` and call it
after `registerGetAuthoringConventions`.

`src/server.test.ts` — import `DraftOutputSchema` from `./tools/authoring/get-draft.js`, add
a `DRAFT` fixture matching the shape in Step 2, and add a `TOOL_CALLS` row:

```ts
  {
    name: 'get_draft',
    arguments: { draftId: 'abc-123' },
    outputSchema: DraftOutputSchema,
    successBody: DRAFT,
  },
```

The `arguments` key is what enrols `get_draft` in the traversal assertions — without it the
tool is registered but its path guard is never exercised at the server level.

- [ ] **Step 7: Extend the smoke test**

In `src/smoke.test.ts`, after the conventions block:

```ts
    const drafts = (await client.get('/api/v1/drafts', { scope: 'authoring:read' })) as {
      id: string;
    }[];

    if (drafts.length > 0) {
      const draft = parseDraft(
        await client.get(draftPath(drafts[0]!.id), { scope: 'authoring:read' }),
      );
      expect(formatDraft(shapeDraft(draft))).toContain(draft.id);
    }
```

Import `draftPath` alongside `accountPath` on the existing `./core/client.js` import line, and
add `import { formatDraft, parseDraft, shapeDraft } from './tools/authoring/get-draft.js';`.

The `if` is deliberate: a fresh key holds no drafts, and a smoke test that fails on an empty
account tests the account rather than the code.

- [ ] **Step 8: Full suite, typecheck, smoke**

```bash
npm test
npm run typecheck
npm run test:smoke
```

- [ ] **Step 9: Version, changelog, docs**

`VERSION`, `package.json` `version` and `src/config.ts` `SERVER_VERSION` → `2.2.0`, all three
in lockstep; `npm install --package-lock-only`; a `## [2.2.0]` CHANGELOG section; one README
tool row; `AGENTS.md` tool count 11 → 12;
`US-7.2-get-draft-tool.md` → `status: done`, `version_shipped: 2.2.0`, with the Step 1
observation in §Implementation notes.

- [ ] **Step 10: Gates and commit**

```bash
npm run agile:status && npm run agile:validate && npm run release:check
git add .
git commit -m "feat(authoring): get_draft tool (2.2.0)

US-7.2. Owns DraftSchema and AttachmentSchema; attachment source is cut
to list_draft_attachments so one read cannot exceed ~52k tokens."
```

---

### Task 4: `list_drafts` — ships `2.3.0`, closes US-7.3

**Files:**
- Create: `src/tools/authoring/list-drafts.ts`
- Create: `src/tools/authoring/list-drafts.test.ts`
- Modify: `src/server.ts`, `src/server.test.ts`, `src/smoke.test.ts`
- Modify: `VERSION`, `package.json`, `package-lock.json`, `src/config.ts`, `docs/CHANGELOG.md`, `README.md`, `AGENTS.md`
- Modify: `docs/sprints/stories/US-7.3-list-drafts-tool.md`

**Interfaces:**
- Consumes: `DraftSchema`, `AttachmentSummarySchema`, `byteLength`, `type Draft` from
  `./get-draft.js`; `parseOrThrow`; `registerReadTool`.
- Produces:
  - `DraftsOutputSchema`, `type ShapedDrafts`
  - `parseDrafts(payload: unknown): Draft[]`
  - `shapeDrafts(drafts: Draft[]): ShapedDrafts`
  - `formatDrafts(shaped: ShapedDrafts): string`
  - `registerListDrafts(server: McpServer, client: SentiClient): void`

- [ ] **Step 1: Measure the live collection (TASK-7.3.1)**

```bash
node --env-file=.env.local -e '
const base = process.env.SENTI_API_BASE_URL ?? "https://be-dev.sentitrade.xyz";
const r = await fetch(base + "/api/v1/drafts", {
  headers: { authorization: `Bearer ${process.env.SENTI_SMOKE_KEY}` } });
const raw = await r.text();
const drafts = JSON.parse(raw);
const B = (s) => Buffer.byteLength(s ?? "", "utf8");
const cut = drafts.reduce((n, d) =>
  n + B(d.sourceCode) + B(d.lastCompileLog) + B(JSON.stringify(d.lastCompileDiagnostics))
    + d.attachments.reduce((m, a) => m + B(a.sourceCode), 0), 0);
console.log(`raw ${B(raw)} B → shaped ~${B(raw) - cut} B, ${(100 * cut / B(raw)).toFixed(1)}% removed`);
'
```

Record the figures in the story's §Implementation notes. The spec measured 19,853 B → 1,898 B
(90.4%) on 2026-08-19; a materially different ratio is worth a sentence explaining why, not a
change to the cuts.

- [ ] **Step 2: Write the failing tests**

Create `src/tools/authoring/list-drafts.test.ts`:

```ts
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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/tools/authoring/list-drafts.test.ts`
Expected: FAIL — cannot resolve `./list-drafts.js`.

- [ ] **Step 4: Write `list-drafts.ts`**

```ts
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { SentiClient } from '../../core/client.js';
import { parseOrThrow } from '../../core/parse.js';
import { registerReadTool } from '../../core/tool.js';
import { AttachmentSummarySchema, byteLength, type Draft, DraftSchema } from './get-draft.js';

export const DraftSummarySchema = DraftSchema.omit({
  sourceCode: true,
  lastCompileLog: true,
  logTruncated: true,
  lastCompileDiagnostics: true,
  attachments: true,
}).extend({
  sourceBytes: z.number(),
  diagnosticsCount: z.number(),
  attachments: z.array(AttachmentSummarySchema),
});

export const DraftsOutputSchema = z.object({
  drafts: z.array(DraftSummarySchema),
  notes: z.array(z.string()),
});

export type ShapedDrafts = z.infer<typeof DraftsOutputSchema>;

export function parseDrafts(payload: unknown): Draft[] {
  return parseOrThrow(z.array(DraftSchema), payload, 'draft list');
}

function summarise(draft: Draft): ShapedDrafts['drafts'][number] {
  const {
    sourceCode,
    lastCompileLog: _log,
    logTruncated: _truncated,
    lastCompileDiagnostics,
    attachments,
    ...kept
  } = draft;

  return {
    ...kept,
    sourceBytes: byteLength(sourceCode),
    diagnosticsCount: lastCompileDiagnostics.length,
    attachments: attachments.map(({ sourceCode: source, ...rest }) => ({
      ...rest,
      sourceBytes: byteLength(source),
    })),
  };
}

export function shapeDrafts(drafts: Draft[]): ShapedDrafts {
  const summaries = drafts.map(summarise);

  if (summaries.length === 0) return { drafts: summaries, notes: [] };

  const attachmentCount = summaries.reduce((sum, draft) => sum + draft.attachments.length, 0);
  const cutBytes = drafts.reduce(
    (sum, draft) =>
      sum +
      byteLength(draft.sourceCode) +
      byteLength(draft.lastCompileLog ?? '') +
      draft.attachments.reduce((inner, a) => inner + byteLength(a.sourceCode), 0),
    0,
  );

  return {
    drafts: summaries,
    notes: [
      `Source and compiler output were cut: ${summaries.length} draft(s) and ` +
        `${attachmentCount} attachment(s) had their source dropped, along with every ` +
        `compile log and every diagnostic — ${Math.round(cutBytes / 1024)} KiB in total. ` +
        'Call get_draft for one draft\'s source, log and diagnostics, or ' +
        'list_draft_attachments for its indicator sources.',
    ],
  };
}

function readiness(draft: ShapedDrafts['drafts'][number]): string {
  if (draft.lastCompileStatus === null) return 'never compiled';

  const upToDate = draft.compiledUpToDate ? 'source unchanged since' : 'source changed since';
  const ready =
    draft.lastCompileStatus === 'SUCCESS' && draft.compiledUpToDate
      ? ' → ready to register'
      : '';

  return `${draft.lastCompileStatus}, ${upToDate}${ready}`;
}

function block(draft: ShapedDrafts['drafts'][number]): string {
  const registered = draft.eaDefinitionId ? `registered as ${draft.eaDefinitionId}` : 'not registered';
  const diagnostics = draft.diagnosticsCount > 0 ? ` · ${draft.diagnosticsCount} diagnostic(s)` : '';

  return [
    `- ${draft.name} (draftId ${draft.id})`,
    `  updated ${draft.updatedAt} · ${draft.sourceBytes} bytes · ` +
      `${draft.attachments.length} attachment(s)`,
    `  compile: ${readiness(draft)}${diagnostics} · ${registered}`,
  ].join('\n');
}

export function formatDrafts(shaped: ShapedDrafts): string {
  if (shaped.drafts.length === 0) {
    return (
      'No drafts on this API key. This is a real empty result rather than a truncated read — ' +
      'drafts are created in the Senti Quant web Studio, and this server has no write tools.'
    );
  }

  const noun = shaped.drafts.length === 1 ? 'draft' : 'drafts';
  const blocks = shaped.drafts.map(block).join('\n\n');
  const notes = `Notes:\n${shaped.notes.map((note) => `- ${note}`).join('\n')}`;

  return (
    `${shaped.drafts.length} ${noun}, most recently updated first. Source code is not ` +
    `included — call get_draft with a draftId to read one.\n\n${blocks}\n\n${notes}`
  );
}

const AUTHORING_READ = 'authoring:read';

export function registerListDrafts(server: McpServer, client: SentiClient): void {
  registerReadTool(server, {
    name: 'list_drafts',
    title: 'List MQL5 authoring drafts',
    description:
      'List the MQL5 drafts this API key owns, most recently updated first, with each ' +
      'draft\'s compile status, size, attachment count and registered-EA id. Use it to ' +
      'find a `draftId`, or to answer "what am I working on" and "which of my drafts are ' +
      'broken". THIS RESPONSE IS SHAPED: source code, compiler logs and diagnostics are ' +
      'ALL dropped — the endpoint can return over 10 MB otherwise — and what was cut is ' +
      'listed in `notes`. Call get_draft for one draft\'s source and compiler output, or ' +
      'list_draft_attachments for its indicator sources. There is no option to request the ' +
      'unshaped response.',
    inputSchema: z.object({}),
    outputSchema: DraftsOutputSchema,
    run: async (_args, signal) => {
      const payload = await client.get('/api/v1/drafts', { signal, scope: AUTHORING_READ });
      const shaped = shapeDrafts(parseDrafts(payload));

      return { text: formatDrafts(shaped), structured: shaped };
    },
  });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/tools/authoring/list-drafts.test.ts`
Expected: PASS, 18 tests.

- [ ] **Step 6: Register and enrol**

`src/server.ts` — import and call `registerListDrafts` after `registerGetAuthoringConventions`
and before `registerGetDraft`, so the registration order reads list-then-read like the rest of
the file.

`src/server.test.ts` — import `DraftsOutputSchema` and add:

```ts
  { name: 'list_drafts', outputSchema: DraftsOutputSchema, successBody: [DRAFT] },
```

reusing the `DRAFT` fixture added in Task 3.

- [ ] **Step 7: Extend the smoke test**

Replace the raw `client.get('/api/v1/drafts', …)` cast added in Task 3 Step 7 with the real
parser, so the smoke test exercises the schema rather than bypassing it:

```ts
    const drafts = parseDrafts(await client.get('/api/v1/drafts', { scope: 'authoring:read' }));
    expect(formatDrafts(shapeDrafts(drafts)).length).toBeGreaterThan(0);

    if (drafts.length > 0) {
      const draft = parseDraft(
        await client.get(draftPath(drafts[0]!.id), { scope: 'authoring:read' }),
      );
      expect(formatDraft(shapeDraft(draft))).toContain(draft.id);
    }
```

Add `import { formatDrafts, parseDrafts, shapeDrafts } from './tools/authoring/list-drafts.js';`.

- [ ] **Step 8: Full suite, typecheck, smoke**

```bash
npm test
npm run typecheck
npm run test:smoke
```

- [ ] **Step 9: Version, changelog, docs**

`2.3.0` in `VERSION`, `package.json` `version` and `src/config.ts` `SERVER_VERSION`;
`npm install --package-lock-only`; a `## [2.3.0]` CHANGELOG section naming the four cuts and the measured reduction from Step 1; one README
tool row; `AGENTS.md` tool count 12 → 13; `US-7.3-list-drafts-tool.md` → `status: done`,
`version_shipped: 2.3.0`, with the Step 1 measurement in §Implementation notes.

- [ ] **Step 10: Gates and commit**

```bash
npm run agile:status && npm run agile:validate && npm run release:check
git add .
git commit -m "feat(authoring): list_drafts tool (2.3.0)

US-7.3. Four cuts and one note — see CONTEXT D32. The unshaped ceiling is
10.3 MiB; the live collection shapes 19,853 B to 1,898 B."
```

---

### Task 5: `list_draft_attachments` — ships `2.4.0`, closes US-7.4 and EPIC-7

**Files:**
- Create: `src/tools/authoring/list-draft-attachments.ts`
- Create: `src/tools/authoring/list-draft-attachments.test.ts`
- Modify: `src/server.ts`, `src/server.test.ts`, `src/smoke.test.ts`
- Modify: `VERSION`, `package.json`, `package-lock.json`, `src/config.ts`, `docs/CHANGELOG.md`, `README.md`, `AGENTS.md`
- Modify: `docs/sprints/stories/US-7.4-list-draft-attachments-tool.md`, `docs/sprints/epics/EPIC-7.md`

**Interfaces:**
- Consumes: `AttachmentSchema`, `type Attachment`, `byteLength` from `./get-draft.js`;
  `draftPath`, `DRAFT_NOT_FOUND`.
- Produces:
  - `ATTACHMENT_BUDGET_BYTES: number`
  - `AttachmentsOutputSchema`, `type ShapedAttachments`
  - `parseAttachments(payload: unknown): Attachment[]`
  - `shapeAttachments(attachments: Attachment[], filename?: string): ShapedAttachments`
  - `formatAttachments(shaped: ShapedAttachments, filename?: string): string`
  - `registerListDraftAttachments(server: McpServer, client: SentiClient): void`

- [ ] **Step 1: Write the failing tests**

Create `src/tools/authoring/list-draft-attachments.test.ts`:

```ts
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
    const rendered = formatAttachments(shapeAttachments([A, B], 'Missing.mq5'), 'Missing.mq5');

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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/tools/authoring/list-draft-attachments.test.ts`
Expected: FAIL — cannot resolve `./list-draft-attachments.js`.

- [ ] **Step 3: Write `list-draft-attachments.ts`**

```ts
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { DRAFT_NOT_FOUND, draftPath, type SentiClient } from '../../core/client.js';
import { parseOrThrow } from '../../core/parse.js';
import { registerReadTool } from '../../core/tool.js';
import { type Attachment, AttachmentSchema, byteLength } from './get-draft.js';

/** `maxAttachmentBytes` from GET /api/v1/authoring/conventions, measured 2026-08-19. */
export const ATTACHMENT_BUDGET_BYTES = 65_536;

const AttachmentEntrySchema = AttachmentSchema.omit({ sourceCode: true }).extend({
  sourceBytes: z.number(),
  sourceCode: z.string().nullable(),
});

export const AttachmentsOutputSchema = z.object({
  attachments: z.array(AttachmentEntrySchema),
  notes: z.array(z.string()),
});

export type ShapedAttachments = z.infer<typeof AttachmentsOutputSchema>;

type Entry = ShapedAttachments['attachments'][number];

export function parseAttachments(payload: unknown): Attachment[] {
  return parseOrThrow(z.array(AttachmentSchema), payload, 'draft attachment list');
}

function entry(attachment: Attachment, bytes: number, withSource: boolean): Entry {
  const { sourceCode, ...kept } = attachment;

  return { ...kept, sourceBytes: bytes, sourceCode: withSource ? sourceCode : null };
}

export function shapeAttachments(
  attachments: Attachment[],
  filename?: string,
): ShapedAttachments {
  if (filename !== undefined) {
    const matched = attachments.filter((attachment) => attachment.filename === filename);

    return {
      attachments: matched.map((a) => entry(a, byteLength(a.sourceCode), true)),
      notes: [],
    };
  }

  let used = 0;
  let cutting = false;

  const entries = attachments.map((attachment, index) => {
    const bytes = byteLength(attachment.sourceCode);

    // The first attachment is always returned whole, so a single oversized file is
    // readable at all; every entry after the first breach is cut, so the ceiling holds.
    if (!cutting && (index === 0 || used + bytes <= ATTACHMENT_BUDGET_BYTES)) {
      used += bytes;
      return entry(attachment, bytes, true);
    }

    cutting = true;
    return entry(attachment, bytes, false);
  });

  const cut = entries.filter((item) => item.sourceCode === null).length;

  return {
    attachments: entries,
    notes:
      cut === 0
        ? []
        : [
            `Attachment source was cut: ${cut} of ${entries.length} attachment(s) exceeded ` +
              `this tool's ${Math.round(ATTACHMENT_BUDGET_BYTES / 1024)} KiB budget and are ` +
              'listed without their source. Pass `filename` to read one of them whole.',
          ],
  };
}

function attachmentBlock(item: Entry): string {
  if (item.sourceCode === null) {
    return `- ${item.filename} (${item.sourceBytes} bytes) — source not included`;
  }

  return `- ${item.filename} (${item.sourceBytes} bytes)\n${item.sourceCode}`;
}

export function formatAttachments(shaped: ShapedAttachments, filename?: string): string {
  if (shaped.attachments.length === 0) {
    if (filename !== undefined) {
      return `No attachment named "${filename}" on this draft.`;
    }

    return (
      'This draft has no indicator attachments. Its EA embeds no `#resource` indicator ' +
      'source, which is a real empty result rather than a truncated read.'
    );
  }

  const noun = shaped.attachments.length === 1 ? 'attachment' : 'attachments';
  const blocks = shaped.attachments.map(attachmentBlock).join('\n\n');
  const notes =
    shaped.notes.length === 0
      ? ''
      : `\n\nNotes:\n${shaped.notes.map((note) => `- ${note}`).join('\n')}`;

  return `${shaped.attachments.length} ${noun}:\n\n${blocks}${notes}`;
}

const AUTHORING_READ = 'authoring:read';

export function registerListDraftAttachments(server: McpServer, client: SentiClient): void {
  registerReadTool(server, {
    name: 'list_draft_attachments',
    title: "Read a draft's indicator sources",
    description:
      'Read the indicator source files a draft\'s EA embeds via `#resource`. `draftId` is ' +
      'the `id` field from list_drafts. Pass `filename` to read exactly one attachment ' +
      'whole — that is also how to read one the default call had to leave out. With ' +
      '`filename` omitted this returns every attachment\'s source up to a 64 KiB budget ' +
      'and lists the rest by name and size only; `notes` says whether that happened. Use ' +
      'get_draft for the EA\'s own source, which this tool never returns.',
    inputSchema: z.object({ draftId: z.string(), filename: z.string().optional() }),
    outputSchema: AttachmentsOutputSchema,
    run: async (args, signal) => {
      const payload = await client.get(draftPath(args.draftId, 'attachments'), {
        signal,
        scope: AUTHORING_READ,
        notFoundMeans: DRAFT_NOT_FOUND,
      });
      const shaped = shapeAttachments(parseAttachments(payload), args.filename);

      return { text: formatAttachments(shaped, args.filename), structured: shaped };
    },
  });
}
```

The formatter's missing-filename branch must also list what *is* available, which the block
above does not do — the test at Step 1 asserts it. Extend `formatAttachments`'s
`filename !== undefined` branch to take the available names:

```ts
export function formatAttachments(
  shaped: ShapedAttachments,
  filename?: string,
  available: string[] = [],
): string {
```

and render:

```ts
    if (filename !== undefined) {
      const names = available.length > 0 ? available.join(', ') : 'none';
      return `No attachment named "${filename}" on this draft. Available: ${names}.`;
    }
```

Then pass the names at both call sites — in the test, `formatAttachments(shaped, 'Missing.mq5', ['Trend.mq5', 'Momentum.mq5'])`, and in `run`:

```ts
      const attachments = parseAttachments(payload);
      const shaped = shapeAttachments(attachments, args.filename);
      const available = attachments.map((attachment) => attachment.filename);

      return { text: formatAttachments(shaped, args.filename, available), structured: shaped };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/tools/authoring/list-draft-attachments.test.ts`
Expected: PASS, 17 tests.

- [ ] **Step 5: Register and enrol**

`src/server.ts` — import and call `registerListDraftAttachments` after `registerGetDraft`.

`src/server.test.ts` — import `AttachmentsOutputSchema`, add an `ATTACHMENT` fixture, and add
a `TOOL_CALLS` row **with `arguments`**, so the second draft-scoped path is covered by the
traversal assertions:

```ts
  {
    name: 'list_draft_attachments',
    arguments: { draftId: 'abc-123' },
    outputSchema: AttachmentsOutputSchema,
    successBody: [ATTACHMENT],
  },
```

- [ ] **Step 6: Extend the smoke test**

Inside the existing `if (drafts.length > 0)` block added in Task 4:

```ts
      const attachments = parseAttachments(
        await client.get(draftPath(drafts[0]!.id, 'attachments'), { scope: 'authoring:read' }),
      );
      expect(formatAttachments(shapeAttachments(attachments)).length).toBeGreaterThan(0);
```

- [ ] **Step 7: Full suite, typecheck, smoke**

```bash
npm test
npm run typecheck
npm run test:smoke
```

Expected: 24 test files pass. The smoke run will exercise the empty-attachment branch only —
see Step 9.

- [ ] **Step 8: Version, changelog, docs**

`2.4.0` in all three version files; `npm install --package-lock-only`; a `## [2.4.0]`
CHANGELOG section; one README tool row; `AGENTS.md` tool count 13 → **14**, matching the API's 14 `GET` operations;
`US-7.4-…md` → `status: done`, `version_shipped: 2.4.0`.

- [ ] **Step 9: Close EPIC-7 honestly**

Set `EPIC-7.md` `status: done` and write its §What this close does not claim, stating plainly
what never ran against the real service rather than leaving a reader to infer coverage from a
green suite:

| Branch | Why it never ran | What would discharge it |
|---|---|---|
| Every attachment code path in all three draft tools | The smoke key holds no draft with an attachment; `attachments` was `[]` in 4/4 drafts | One attachment created in the web Studio |
| `list_draft_attachments`' byte budget and its `filename` filter | The same condition — the budget cannot bind on an empty set | As above |
| The `DiagnosticSchema` render path in `get_draft` | `lastCompileDiagnostics` was `[]` in 4/4 drafts, including the one that compiled `SUCCESS` | One draft left in `FAILED` state |
| `DRAFT_NOT_FOUND`'s 404 | Never provoked live; covered by test only | A `GET` for a draft id the key does not own |

If any of these *were* discharged during implementation, move the row out and record the
observation instead. Do not delete a row that still stands.

- [ ] **Step 10: Gates and commit**

```bash
npm run agile:status && npm run agile:validate && npm run release:check
git add .
git commit -m "feat(authoring): list_draft_attachments tool (2.4.0)

US-7.4. Closes EPIC-7 — all 14 of the API's GET operations now have a tool.
The byte budget and the filename filter are test-covered only; EPIC-7 says so."
```

---

## Self-Review

Run against the spec after the plan was written.

**Spec coverage.** Every section maps to a task: §Substrate → Task 1; §Tool surface and the
four tools → Tasks 2–5; §Payload policy's three shaping rules → Tasks 3, 4, 5 Step 1 tests;
`lastCompileDiagnostics` loose-parse/tight-render → Task 3 Steps 2 and 4; §`draftId` handling
and the `TOOL_CALLS` enrolment → Tasks 3 and 5 Step 5/6; §Testing's six categories → the test
blocks in Tasks 2–5 plus the smoke extensions; §Documentation obligations → Task 0 and each
task's docs step; §Open questions → Task 3 Step 1 and Task 5 Step 9.

**Gaps found and closed.** Two, both fixed inline above:

1. The spec requires `formatAttachments` to list the available filenames when a requested one
   is missing. The first draft of Task 5's implementation did not, while its test did. Task 5
   Step 3 now carries the corrected three-argument signature and both call sites.
2. The spec's §Testing calls for a key-absence assertion. That is an existing table-driven
   test in `src/server.test.ts` that runs over `TOOL_CALLS`, so the four new rows enrol the
   new tools automatically — noted here so an implementer does not add a fifth copy of it.

**Type consistency.** `byteLength`, `AttachmentSchema`, `AttachmentSummarySchema`,
`DraftSchema` and `type Draft` are defined in Task 3 and consumed under those exact names in
Tasks 4 and 5. `ATTACHMENT_BUDGET_BYTES` is defined and consumed only in Task 5.
`shapeAttachments(attachments, filename?)` and `formatAttachments(shaped, filename?, available?)`
agree between the test block and the implementation.

**Two corrections made after checking `scripts/release-check.mjs`.** The version steps
originally named `VERSION` and `package.json` only — the gate also compares
`src/config.ts`'s `SERVER_VERSION`, and it greps the CHANGELOG for `## [X.Y.Z]`, not
`## X.Y.Z`. Both are fixed in every task above.

**One deliberate divergence from repo style**, recorded so a reviewer does not read it as
drift: the code above is sparsely commented, per this plan's Global Constraints. Existing
modules such as `breakdowns.ts` are not. The rationale that would have been comments lives in
the spec and in the story files.
