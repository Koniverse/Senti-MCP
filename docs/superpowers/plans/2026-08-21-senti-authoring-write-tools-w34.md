# Authoring Write Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register seven MCP write tools over the Senti Quant API's `Authoring` tag — create, replace and delete a draft, add, replace and delete an indicator attachment, and compile a draft — behind an operator-set opt-in, so an agent in the user's IDE can author MQL5 end to end instead of reading it and stopping.

**Architecture:** Seven tool modules under `src/tools/authoring/`, registered through a **new** `registerWriteTool` in `core/tool.ts` that fixes `readOnlyHint: false` and takes `destructiveHint` / `idempotentHint` from its spec. `registerReadTool` is untouched, so no read tool can become a write. `core/client.ts` gains `send(method, path, options)` beside `get`, sharing one request path, plus three new `…Means` options for the status codes the read path never saw. `write-result.ts` owns the shaping every body-carrying write shares, and imports `DraftSchema` / `AttachmentSchema` from `get-draft.ts` rather than redeclaring them.

**Tech Stack:** TypeScript 7, Zod v4 (`zod/v4`), `@modelcontextprotocol/server` 2.0.0, Vitest, Node ≥ 22.11.0.

**Spec:** [docs/superpowers/specs/2026-08-21-senti-authoring-write-tools-design.md](../specs/2026-08-21-senti-authoring-write-tools-design.md)

## Global Constraints

Every task's requirements implicitly include this section.

- **Comment policy overrides repo style.** Comment only where the reasoning is genuinely
  non-obvious — a measured constant, or a non-local decision a reader cannot recover from the
  code. No comment restating the next line. Rationale lives in the spec and story files.
- **The API key never enters an `inputSchema`** and never appears in returned text, including
  every new error branch.
- **Tool failures are returned as `isError: true` text results, never thrown.** Guaranteed by
  `registerWriteTool`. **One sanctioned exception:** `compile_draft` wraps its `client.send`
  call in a `try`/`catch` that *rethrows a rewritten error* (Task 13). It never swallows one.
- **Nothing writes to `stdout`.** Diagnostics go to `stderr`. This now includes the write-path
  startup line in Task 6.
- **Every path parameter reaches a URL only through `accountPath` or `draftPath`.** No tool
  concatenates a path. `draftPath(draftId, 'attachments', attachmentId)` already validates
  every segment; no new builder is needed.
- **Byte counts are `Buffer.byteLength(value, 'utf8')`**, never `String.prototype.length`.
- **Transcribe the operation's declared request-body constraints; never the `limits` block.**
  `name` is `1–120` chars in the `POST`/`PUT` request schema, so the `inputSchema` carries
  `.min(1).max(120)`. `sourceCode`'s `196608`-byte cap comes from the runtime `limits` block
  that `get_authoring_conventions` publishes — **it is not validated client-side**, because a
  hardcoded copy of a value the API owns drifts silently the day the platform raises it. The
  `413`/`422` branches from Task 1 are what report it.
- **No automatic retry, anywhere, of any status.** `Retry-After` is read and reported in the
  message; nothing ever sleeps on it.
- **`register` is not called from anywhere in this plan**, including tests and the smoke test.
- **Numbers in rendered text use `toLocaleString('en-US')`**, so a byte count reads `4,812`
  identically on every machine.
- **Docs ship in the same commit as the code that obliges them** (RULE-1). `VERSION`,
  `package.json`, `package-lock.json` and `SERVER_VERSION` in `src/config.ts` move together.
- **`docs/sprints/STATUS.md` is generated** by `npm run agile:status`, never hand-edited (RULE-5).
- **No `## Active Context` block anywhere**, and no `.active-context.md` (CLAUDE.md).
- **`vitest.config.ts` stays scoped to `src/**/*.test.ts`** ([CONTEXT D13](../../CONTEXT.md)).
- **Scope string:** `authoring:write`, declared as a file-local `const AUTHORING_WRITE` in each
  tool file, matching how `authoring:read` is declared in the four read tool files today.

## Two refinements this plan makes to the spec

Both were found while writing the code, and both are recorded here rather than silently applied.

**1. A cancelled delete returns a structured payload, not bare text.** The spec says a declined
confirmation *"returns a plain text refusal, not an error"*. The SDK forbids that shape: a
non-error result for a tool that declares an `outputSchema` and supplies no `structuredContent`
throws a `ProtocolError` (`validateToolOutput`, `mcp-DXXb3Vv3.mjs:1442` — `isError` and
input-required results are the only exemptions). So the two delete tools declare

```
DeleteOutputSchema = { id: string | null, deleted: boolean, notes: string[] }
```

and a cancellation returns `{ id: null, deleted: false, notes: [...] }` as a **success**. The
spec's intent — a user saying no is not an error — is preserved exactly; only the envelope
changes, and the spec's *"deletes return `{ id }` and nothing else"* becomes `{ id }` plus the
two fields that let "nothing happened" be stated in the schema instead of only in prose.

**2. `core/tool.ts` becomes the third file importing a runtime SDK value.** `inputRequired` and
`acceptedContent` are values, not types. Today `core/tool.ts` imports the SDK with `import type`
only, and both the file's own header comment and `AGENTS.md` §Repo structure claim `src/server.ts`
is *"the only file importing the SDK's main entry"*. Task 7 makes that false. Both statements are
corrected in the same task — the property was a consequence worth noting, not an invariant worth
contorting the confirmation seam to preserve.

## File Structure

```
src/core/client.ts        MODIFY  send() beside get(), over one shared private request().
                                  forbiddenMeans / unprocessableMeans / upstreamMeans.
                                  413, 422, 502, 503, 504 branches. idempotencyKeyFor().
                                  Five new exported 403/404/409 message constants.
src/core/tool.ts          MODIFY  registerWriteTool() + the confirmation seam.
                                  registerReadTool untouched; shared try/catch extracted.
src/config.ts             MODIFY  SENTI_ENABLE_AUTHORING_WRITE -> Config.authoringWrite.
src/server.ts             MODIFY  Registers the seven tools only when the flag is set.

src/tools/authoring/
  write-result.ts         CREATE  DraftWriteOutputSchema, AttachmentWriteOutputSchema,
                                  DeleteOutputSchema, the parse/shape/format helpers, and
                                  cancelledDelete(). Imports DraftSchema, AttachmentSchema,
                                  DiagnosticSchema and byteLength from get-draft.ts.
  create-draft.ts         CREATE  create_draft
  update-draft.ts         CREATE  update_draft
  delete-draft.ts         CREATE  delete_draft            (confirms)
  add-draft-attachment.ts CREATE  add_draft_attachment
  update-draft-attachment.ts CREATE update_draft_attachment
  delete-draft-attachment.ts CREATE delete_draft_attachment (confirms)
  compile-draft.ts        CREATE  compile_draft. Owns CompileResultSchema and
                                  compileAbortHint(); reuses DiagnosticSchema.

src/server.test.ts        MODIFY  Additive only: writeConfig, connectWithWrites,
                                  WRITE_TOOL_CALLS, and a new invariants describe block.
                                  The existing read-only assertion needs no change — see Task 6.
src/smoke.test.ts         MODIFY  A second, separately-gated live test (Task 14).
```

The existing `TOOL_CALLS` table and the `every tool advertises itself read-only` test in
`server.test.ts` both run against `connect()`, which builds a server from a config **without**
the flag. With writes off that server still registers exactly fourteen read tools, so both keep
passing untouched. Every write assertion goes through a separate `connectWithWrites()`.

## Shared test harness

Every tool test file defines its own helpers — the convention already in this repo, where
`client.test.ts`, `get-draft.test.ts` and `tool.test.ts` each carry their own. **Copy the block
below verbatim into each tool test file**, changing only the `register*` call on the marked line.
Tasks 6, 8, 10, 11 and 13 use HARNESS A; Tasks 9 and 12 use HARNESS B.

### HARNESS A — a plain write tool

```ts
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { McpServer } from '@modelcontextprotocol/server';
import { describe, expect, test } from 'vitest';
import { loadConfig } from '../../config.js';
import { createClient } from '../../core/client.js';

const config = loadConfig({
  SENTI_API_KEY: 'sq_live_supersecret',
  SENTI_API_BASE_URL: 'https://be-dev.sentitrade.xyz',
  SENTI_ENABLE_AUTHORING_WRITE: '1',
});

type ToolResult = {
  content: { type: string; text?: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

function stub(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string | URL, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;

  return { calls, fetchImpl };
}

async function connect(fetchImpl: typeof fetch) {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerCreateDraft(server, createClient(config, { fetch: fetchImpl })); // <- CHANGE THIS LINE

  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return client;
}
```

### HARNESS B — a write tool that confirms

Identical to HARNESS A except that `connect` is replaced by `connectAnswering`, which registers
an `elicitation/create` handler and declares the capability that lets the client auto-fulfil the
server's input-required round. **Not the same helper as Task 7's `connectAnswering`**, which
lives in `src/core/tool.test.ts` and takes an already-built server rather than a fetch stub:

```ts
async function connectAnswering(
  fetchImpl: typeof fetch,
  answer: { action: 'accept'; content: Record<string, unknown> } | { action: 'decline' },
) {
  const seen: string[] = [];
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerDeleteDraft(server, createClient(config, { fetch: fetchImpl })); // <- CHANGE THIS LINE

  const client = new Client(
    { name: 'test-client', version: '0.0.0' },
    { capabilities: { elicitation: {} } },
  );
  client.setRequestHandler('elicitation/create', async (request) => {
    seen.push(String((request.params as { message?: unknown }).message ?? ''));
    return answer;
  });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return { client, seen };
}
```


---

### Task 0: Documentation scaffolding — EPIC-8, four stories, sprint rows, corrections

No code. The sprint table and story files are what every later commit reports into, and RULE-1
makes each of them depend on these existing.

**Files:**
- Create: `docs/sprints/epics/EPIC-8.md`
- Create: `docs/sprints/stories/US-8.1-write-substrate-and-create-draft.md`
- Create: `docs/sprints/stories/US-8.2-update-and-delete-draft.md`
- Create: `docs/sprints/stories/US-8.3-attachment-writes.md`
- Create: `docs/sprints/stories/US-8.4-compile-draft-and-epic-close.md`
- Modify: `docs/sprints/sprint-2026-W34.md`
- Modify: `docs/sprints/epics/EPIC-3.md`
- Modify: `docs/sprints/epics/EPIC-7.md`
- Modify: `docs/CONTEXT.md` (append D36–D42)
- Regenerate: `docs/sprints/STATUS.md`

**Interfaces:**
- Consumes: nothing.
- Produces: epic id `EPIC-8` and story ids `US-8.1` … `US-8.4`, cited by every later commit
  message, CHANGELOG entry and story `version_shipped`.

- [ ] **Step 1: Write `docs/sprints/epics/EPIC-8.md`**

Front-matter `id: EPIC-8`, `title: "Authoring write path over MCP"`, `status: in-progress`,
`created: 2026-08-21`, `updated: 2026-08-21`. Sections:

- **Goal** — an agent in the user's IDE can create, edit, delete and compile MQL5 drafts, so the
  write–build–read-errors–write loop happens without leaving the editor.
- **Business context** — EPIC-7 closed with all 14 `GET` operations covered; the tag's eight
  writes are unreachable, so an agent can read the rules it must generate against and then not
  write anything. Seven of the eight are in scope.
- **Feature pillars** — substrate + `create_draft` (US-8.1); replace and delete a draft, and the
  confirmation seam (US-8.2); the three attachment writes (US-8.3); `compile_draft` and the
  write smoke test (US-8.4).
- **Out of scope — `register`.** State the real reason, from the spec §Scope: it is the only
  write in the tag that creates a resource **outside** the tag (an `EaDefinition` visible in
  `GET /api/v1/strategies`, against a separate `maxRegisteredEas` ceiling), and no operation in
  the `Authoring` tag can delete it. Every other write here is reversible by another write here.
- **Out of scope — the seven trading writes.** [EPIC-3](EPIC-3.md)'s, gated by their own future
  flag, unreachable at any setting of `SENTI_ENABLE_AUTHORING_WRITE`.
- **Cross-cutting invariants** — copy the project-wide entries from §Global Constraints above,
  plus: opt-in by environment variable; confirmation on the two deletes; no retry anywhere;
  `Idempotency-Key` server-minted and request-derived.
- **What this epic does not claim** — the idempotency retention window is unmeasured until
  US-8.1's contract task runs, and the two delete tools are unusable on a host without
  elicitation support.

- [ ] **Step 2: Write the four story files**

Each carries front-matter `id`, `title`, `epic: EPIC-8`, `status: ready`, `priority: P1`,
`points`, `sprint: sprint-2026-W34`, `assignee: bluezdot`, `created: 2026-08-21`,
`updated: 2026-08-21`. `version_shipped` is added by the story's own implementation task, not
here. Points: US-8.1 `5`, US-8.2 `3`, US-8.3 `3`, US-8.4 `3`.

Each story's `## Goal`, `## Background`, `## Acceptance Criteria` and `## Tasks` sections restate
that story's slice of the spec. Every story's first task is `TASK-8.x.1`, a **contract check
against the live service before any code is written** — the task that has already caught two
false claims about `register` in this repo. US-8.1's instance additionally measures the
idempotency retention window (spec §Open questions 1) by creating a draft, deleting it, and
re-issuing the byte-identical create with the same derived key.

- [ ] **Step 3: Add four rows to `docs/sprints/sprint-2026-W34.md`**

Append four rows to the **existing single scope table** — never a new phase section
([CONTEXT D30](../../CONTEXT.md)):

```markdown
| US-8.1 | Write substrate, the opt-in, and `create_draft` *(added 2026-08-21)* | EPIC-8 | P1  | 5      | 🟢 ready | [link](stories/US-8.1-write-substrate-and-create-draft.md)   |
| US-8.2 | `update_draft` and `delete_draft` *(added 2026-08-21)*                | EPIC-8 | P1  | 3      | 🟢 ready | [link](stories/US-8.2-update-and-delete-draft.md)            |
| US-8.3 | The three attachment writes *(added 2026-08-21)*                      | EPIC-8 | P1  | 3      | 🟢 ready | [link](stories/US-8.3-attachment-writes.md)                  |
| US-8.4 | `compile_draft`, write smoke test, and EPIC-8's close *(added 2026-08-21)* | EPIC-8 | P1 | 3 | 🟢 ready | [link](stories/US-8.4-compile-draft-and-epic-close.md)   |
```

Update the total line from `6 stories / 13 points` to `10 stories / 27 points`, and append one
clause to the file's `goal:` front-matter — for example `…, and open the authoring write path
with its first seven MCP tools`. Add `EPIC-8` to the file's `## Cross-references`.

- [ ] **Step 4: Correct `EPIC-3.md` and `EPIC-7.md`**

In `EPIC-3.md`: change the operation count from 7 to 15 in §Business context and in the table's
heading; add the eight `Authoring` writes as a second table clearly marked *owned by EPIC-8*;
delete the sentence assigning `register` a trading-account risk and replace it with the API's own
statement that registering does **not** deploy, and that deploying is
`POST /api/v1/accounts/{accountId}/strategies` under the separate `strategies:write` scope.

In `EPIC-7.md`: fix the same claim in both places it appears — §Out of scope and §A note for
whoever opens the write path — and add one line pointing at `EPIC-8`.

- [ ] **Step 5: Append D36–D42 to `docs/CONTEXT.md`**

Append-only (RULE-7), each in the file's existing `### D<N>. <sentence>` shape with **Context**,
**Decision**, **Consequences** and **Alternatives considered**:

- **D36** — `register` registers a private EA and does not deploy to a trading account; EPIC-7
  and the read spec said otherwise, and this entry records the correction and its source.
- **D37** — Authoring writes open EPIC-8 rather than joining EPIC-3, because EPIC-3's invariants
  are written against operations that move money.
- **D38** — `registerWriteTool` is a second function, not a `readOnly?: boolean` on
  `registerReadTool`, so the read registrar's annotations stay constants. Records that
  `core/tool.ts` becomes the third file importing a runtime SDK value as a consequence.
- **D39** — A write response does not echo the source it was just sent.
- **D40** — The write path has no retry; `Retry-After` is reported, never slept on.
- **D41** — `Idempotency-Key` is server-minted and derived from the request, never a tool
  parameter. Cites the unmeasured retention window as the open risk.
- **D42** — Confirmation is on the two deletes only, because a prompt seen fifty times a session
  launders a rubber-stamp into consent.

- [ ] **Step 6: Regenerate STATUS and validate**

```bash
npm run agile:status
npm run agile:validate
```
Expected: `agile:validate` prints `✓ all references resolve` and exits 0. `STATUS.md` shows 33
stories with 4 in Ready.

- [ ] **Step 7: Commit**

```bash
git add docs/
git commit -m "docs: open EPIC-8 for the authoring write path

Four stories in sprint-2026-W34's scope table, D36-D42 in CONTEXT, and the
register claim corrected in EPIC-3 and EPIC-7."
```

---

### Task 1: `core/client.ts` — the status codes the read path never saw

**Files:**
- Modify: `src/core/client.ts`
- Test: `src/core/client.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `RequestOptions` gains `forbiddenMeans?: string`, `unprocessableMeans?: string`,
  `upstreamMeans?: string`. New exported constants `AUTHORING_WRITE_SCOPE`,
  `DRAFT_CAP_OR_SCOPE`, `ATTACHMENT_CAP_OR_SCOPE`, `ATTACHMENT_NOT_FOUND`,
  `DRAFT_NAME_TAKEN`, `ATTACHMENT_FILENAME_TAKEN`, `COMPILE_SLOT_BUSY`, `COMPILE_UPSTREAM`.

- [ ] **Step 1: Write the failing tests**

Append to `src/core/client.test.ts`, inside the existing `describe('createClient', …)`:

```ts
  test('403 keeps its scope-only wording when no forbiddenMeans is passed', async () => {
    const { fetchImpl } = stub(jsonResponse(envelope('FORBIDDEN', 'Insufficient scope.'), 403));

    const promise = createClient(config, { fetch: fetchImpl }).get('/api/v1/drafts', {
      scope: 'authoring:read',
    });

    await expect(promise).rejects.toThrow(/not that the account is off limits/);
  });

  test('403 quotes forbiddenMeans instead, so a full cap is not read as a missing scope', async () => {
    const { fetchImpl } = stub(jsonResponse(envelope('FORBIDDEN', 'Draft limit reached.'), 403));

    const promise = createClient(config, { fetch: fetchImpl }).get('/api/v1/drafts', {
      scope: 'authoring:write',
      forbiddenMeans: DRAFT_CAP_OR_SCOPE,
    });

    await expect(promise).rejects.toThrow(/delete_draft/);
    await expect(promise).rejects.not.toThrow(/not that the account is off limits/);
  });

  test('413 names the gateway limit rather than a platform cap', async () => {
    const { fetchImpl } = stub(jsonResponse(envelope('INVALID_BODY', 'Payload too large.'), 413));

    const promise = createClient(config, { fetch: fetchImpl }).get('/api/v1/drafts');

    await expect(promise).rejects.toThrow(/1 MB/);
  });

  test('422 quotes unprocessableMeans', async () => {
    const { fetchImpl } = stub(jsonResponse(envelope('INVALID_BODY', 'Bad filename.'), 422));

    const promise = createClient(config, { fetch: fetchImpl }).get('/api/v1/drafts', {
      unprocessableMeans: 'The filename must be a bare `.mq5` basename.',
    });

    await expect(promise).rejects.toThrow(/bare `\.mq5` basename/);
  });

  test('503 reports Retry-After without waiting for it', async () => {
    const { fetchImpl } = stub(
      jsonResponse(envelope('UNAVAILABLE', 'Compile server busy.'), 503, { 'retry-after': '7' }),
    );

    const started = Date.now();
    const promise = createClient(config, { fetch: fetchImpl }).get('/api/v1/drafts');

    await expect(promise).rejects.toThrow(/7 second/);
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  test('503 without Retry-After says a retry cannot help', async () => {
    const { fetchImpl } = stub(jsonResponse(envelope('UNAVAILABLE', 'Offline.'), 503));

    const promise = createClient(config, { fetch: fetchImpl }).get('/api/v1/drafts');

    await expect(promise).rejects.toThrow(/retry cannot help/);
  });

  test('502 and 504 are distinguishable from this server\'s own timeout', async () => {
    const { fetchImpl: badGateway } = stub(jsonResponse(envelope('UNAVAILABLE', 'Down.'), 502));
    const { fetchImpl: gatewayTimeout } = stub(jsonResponse(envelope('UNAVAILABLE', 'Slow.'), 504));

    await expect(
      createClient(config, { fetch: badGateway }).get('/api/v1/drafts', {
        upstreamMeans: 'The compile server is unreachable.',
      }),
    ).rejects.toThrow(/unreachable/);
    await expect(
      createClient(config, { fetch: gatewayTimeout }).get('/api/v1/drafts'),
    ).rejects.toThrow(/timed out waiting for an upstream service/);
  });
```

Extend the file's existing import to pull in `DRAFT_CAP_OR_SCOPE`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/client.test.ts`
Expected: FAIL — `DRAFT_CAP_OR_SCOPE` is not exported, and the 413/422/502/503/504 assertions hit
the `default:` branch's `Senti API request failed: HTTP N` wording.

- [ ] **Step 3: Add the options, the constants and the branches**

In `src/core/client.ts`, extend `RequestOptions`:

```ts
  /**
   * What a 403 means for THIS endpoint. On a read it is always a missing
   * scope; on a write it is also a full cap, and the default wording sends a
   * reader to mint a key they already hold.
   */
  forbiddenMeans?: string;
  /** What a 422 means for THIS endpoint. */
  unprocessableMeans?: string;
  /** What a 502/503/504 means for THIS endpoint — which upstream is down. */
  upstreamMeans?: string;
```

Add beside `ACCOUNT_NOT_FOUND` and `DRAFT_NOT_FOUND`:

```ts
export const AUTHORING_WRITE_SCOPE =
  'The API key is missing the `authoring:write` scope. Create a key with that scope in the ' +
  'API Keys dashboard.';

export const DRAFT_CAP_OR_SCOPE =
  'Either the API key is missing the `authoring:write` scope, or you already hold the ' +
  'maximum number of drafts. If it is the cap, retrying will not help — call list_drafts ' +
  'and delete_draft to free a slot.';

export const ATTACHMENT_CAP_OR_SCOPE =
  'Either the API key is missing the `authoring:write` scope, or this draft already holds ' +
  'the maximum number of attachments. If it is the cap, retrying will not help — call ' +
  'list_draft_attachments and delete_draft_attachment to free a slot.';

export const ATTACHMENT_NOT_FOUND =
  'The attachment does not exist, is not owned by this API key, or belongs to a different ' +
  'draft. Call list_draft_attachments with this draftId and use its `id`.';

export const DRAFT_NAME_TAKEN =
  'You already have a draft with that name. Names are unique per user — pick another, or ' +
  'call list_drafts to see which are taken.';

export const ATTACHMENT_FILENAME_TAKEN =
  'This draft already has an indicator with that filename, compared case-insensitively — ' +
  '"MyInd.mq5" collides with "myind.mq5", because the compile host writes them into one ' +
  'flat Windows directory.';

export const COMPILE_SLOT_BUSY =
  'A compile is already running for this account. The compile slot is one per account, so ' +
  'wait for the running compile to finish — call get_draft and read lastCompileStatus.';

export const COMPILE_UPSTREAM = 'The compile server is unreachable or refused the request.';
```

Rewrite `failureOf`'s 403 case and add the five new cases. **The 403 default string must stay
byte-identical**, or the existing read-path tests fail:

```ts
    case 403: {
      const named = scope ? `the \`${scope}\` scope` : 'a scope this endpoint requires';
      const meaning = forbiddenMeans
        ? ` ${forbiddenMeans}`
        : ` The API key is missing ${named} — not that the account is off limits. ` +
          'Create a key with that scope in the API Keys dashboard.';

      return new ApiError(`Senti API returned 403${detail}.${meaning}`, status, code);
    }

    case 413:
      return new ApiError(
        `Senti API returned 413${detail}. The request body exceeds the gateway's 1 MB ` +
          'limit, which is the transport refusing before any platform cap is consulted. ' +
          'Send less in one call.',
        status,
        code,
      );

    case 422: {
      const meaning = unprocessableMeans
        ? ` ${unprocessableMeans}`
        : ' The body was well-formed but the API rejected its contents.';

      return new ApiError(`Senti API returned 422${detail}.${meaning}`, status, code);
    }

    case 502:
      return new ApiError(
        `Senti API returned 502${detail}.${upstreamMeans ? ` ${upstreamMeans}` : ''} ` +
          'An upstream service the API depends on is unreachable.',
        status,
        code,
      );

    case 503: {
      const retryAfter = headers.get('retry-after');
      const guidance = retryAfter
        ? ` Retry after ${retryAfter} second(s) — this server does not wait for you, and ` +
          'does not retry on your behalf.'
        : ' No Retry-After header was sent, which this API documents as meaning a retry ' +
          'cannot help.';

      return new ApiError(
        `Senti API returned 503${detail}.${upstreamMeans ? ` ${upstreamMeans}` : ''}${guidance}`,
        status,
        code,
      );
    }

    case 504:
      return new ApiError(
        `Senti API returned 504${detail}.${upstreamMeans ? ` ${upstreamMeans}` : ''} ` +
          'The API timed out waiting for an upstream service. This is the API\'s own ' +
          'timeout, not this server\'s 15-second one.',
        status,
        code,
      );
```

Destructure the three new fields at the top of `failureOf` alongside `scope`, `conflictMeans`
and `notFoundMeans`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/core/client.test.ts && npm run typecheck`
Expected: PASS, including every pre-existing read-path assertion.

- [ ] **Step 5: Commit**

```bash
git add src/core/client.ts src/core/client.test.ts
git commit -m "feat(core): 413/422/502/503/504 branches and forbiddenMeans

A write 403 also means a full cap, and the read path's wording sends the
reader to mint a key they already hold. Retry-After is reported, never
slept on; its absence is reported as meaning a retry cannot help."
```

---

### Task 2: `core/client.ts` — `send()` and the derived idempotency key

**Files:**
- Modify: `src/core/client.ts`
- Test: `src/core/client.test.ts`

**Interfaces:**
- Consumes: Task 1's `RequestOptions` fields.
- Produces:
  - `type WriteMethod = 'POST' | 'PUT' | 'DELETE'`
  - `type WriteOptions = RequestOptions & { body?: unknown; idempotencyKey?: string }`
  - `SentiClient.send(method: WriteMethod, path: string, options?: WriteOptions): Promise<unknown>`
  - `idempotencyKeyFor(method: WriteMethod, path: string, body: unknown): string`

- [ ] **Step 1: Write the failing tests**

```ts
describe('createClient.send', () => {
  test('sends the method, the JSON body and a content-type', async () => {
    const { calls, fetchImpl } = stub(jsonResponse({ id: 'd-1' }, 201));

    await createClient(config, { fetch: fetchImpl }).send('POST', '/api/v1/drafts', {
      body: { name: 'Gold', sourceCode: '// x' },
    });

    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.body).toBe(JSON.stringify({ name: 'Gold', sourceCode: '// x' }));
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers['content-type']).toBe('application/json');
    expect(headers.authorization).toBe(`Bearer ${KEY}`);
  });

  test('omits the body and the content-type when there is none', async () => {
    const { calls, fetchImpl } = stub(jsonResponse({ ok: true }));

    await createClient(config, { fetch: fetchImpl }).send('DELETE', '/api/v1/drafts/d-1');

    expect(calls[0]?.init.body).toBeUndefined();
    expect((calls[0]?.init.headers as Record<string, string>)['content-type']).toBeUndefined();
  });

  test('sends Idempotency-Key only when one is supplied', async () => {
    const { calls, fetchImpl } = stub(jsonResponse({ id: 'd-1' }, 201));

    await createClient(config, { fetch: fetchImpl }).send('POST', '/api/v1/drafts', {
      body: { name: 'Gold' },
      idempotencyKey: 'abc123',
    });
    await createClient(config, { fetch: fetchImpl }).send('POST', '/api/v1/drafts', {
      body: { name: 'Gold' },
    });

    expect((calls[0]?.init.headers as Record<string, string>)['idempotency-key']).toBe('abc123');
    expect((calls[1]?.init.headers as Record<string, string>)['idempotency-key']).toBeUndefined();
  });

  test('maps failures through the same table get uses', async () => {
    const { fetchImpl } = stub(jsonResponse(envelope('CONFLICT', 'Name taken.'), 409));

    const promise = createClient(config, { fetch: fetchImpl }).send('POST', '/api/v1/drafts', {
      body: {},
      conflictMeans: 'You already have a draft with that name.',
    });

    await expect(promise).rejects.toThrow(/already have a draft with that name/);
  });

  test('rejects a 200 whose body is not JSON, rather than reporting success', async () => {
    const { fetchImpl } = stub(new Response('', { status: 200 }));

    const promise = createClient(config, { fetch: fetchImpl }).send('DELETE', '/api/v1/drafts/d-1');

    await expect(promise).rejects.toThrow(/not JSON/);
  });
});

describe('idempotencyKeyFor', () => {
  test('is stable for the same request', () => {
    const body = { name: 'Gold', sourceCode: '// x' };

    expect(idempotencyKeyFor('POST', '/api/v1/drafts', body)).toBe(
      idempotencyKeyFor('POST', '/api/v1/drafts', body),
    );
  });

  test('differs when the body, the path or the method differs', () => {
    const key = idempotencyKeyFor('POST', '/api/v1/drafts', { name: 'Gold' });

    expect(idempotencyKeyFor('POST', '/api/v1/drafts', { name: 'Silver' })).not.toBe(key);
    expect(idempotencyKeyFor('POST', '/api/v1/drafts/d-1/attachments', { name: 'Gold' })).not.toBe(key);
    expect(idempotencyKeyFor('PUT', '/api/v1/drafts', { name: 'Gold' })).not.toBe(key);
  });

  test('is 32 hex characters', () => {
    expect(idempotencyKeyFor('POST', '/api/v1/drafts', {})).toMatch(/^[0-9a-f]{32}$/);
  });
});
```

Extend the file's import to pull in `idempotencyKeyFor`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/core/client.test.ts -t send`
Expected: FAIL — `client.send is not a function`, `idempotencyKeyFor` not exported.

- [ ] **Step 3: Implement `send` over a shared private `request`**

At the top of `src/core/client.ts`:

```ts
import { createHash } from 'node:crypto';
```

Add the types and the helper:

```ts
export type WriteMethod = 'POST' | 'PUT' | 'DELETE';

export type WriteOptions = RequestOptions & {
  /** Serialised as JSON. Omitted entirely when undefined — DELETE and compile send none. */
  body?: unknown;
  idempotencyKey?: string;
};

/**
 * A key that identifies the request, not the attempt. A random key per call
 * would satisfy the header and dedupe nothing: with no automatic retry, the
 * only duplicate this server emits is the same tool called twice with the
 * same arguments, and that is exactly what this makes replay.
 */
export function idempotencyKeyFor(method: WriteMethod, path: string, body: unknown): string {
  return createHash('sha256')
    .update(`${method}\n${path}\n${JSON.stringify(body)}`)
    .digest('hex')
    .slice(0, 32);
}
```

Extend `SentiClient`:

```ts
export type SentiClient = {
  get(path: string, options?: RequestOptions): Promise<unknown>;
  send(method: WriteMethod, path: string, options?: WriteOptions): Promise<unknown>;
};
```

Replace the body of `createClient` with one private `request` both methods delegate to:

```ts
export function createClient(config: Config, deps: ClientDeps = {}): SentiClient {
  const doFetch = deps.fetch ?? fetch;

  async function request(
    method: 'GET' | WriteMethod,
    path: string,
    options: WriteOptions,
  ): Promise<unknown> {
    const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);

    const headers: Record<string, string> = {
      authorization: `Bearer ${config.apiKey}`,
      accept: 'application/json',
      'user-agent': USER_AGENT,
    };
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey;

    const response = await doFetch(`${config.baseUrl}${path}${queryStringOf(options.query)}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
    });

    const raw = await response.text();
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : undefined;
    } catch {
      body = undefined;
    }

    if (!response.ok) {
      throw failureOf(response.status, response.headers, body, options);
    }

    if (body === undefined) {
      throw new ApiError(
        `Senti API returned HTTP ${response.status} with a body that is not JSON.`,
        response.status,
      );
    }

    return body;
  }

  return {
    get: (path, options = {}) => request('GET', path, options),
    send: (method, path, options = {}) => request(method, path, options),
  };
}
```

- [ ] **Step 4: Run the whole suite**

Run: `npx vitest run src/core/ && npm run typecheck`
Expected: PASS. The `get` tests still pass — adding `method: 'GET'` changes no observable
behaviour, and none of them asserts `init.method` is absent.

- [ ] **Step 5: Commit**

```bash
git add src/core/client.ts src/core/client.test.ts
git commit -m "feat(core): client.send for POST, PUT and DELETE

get and send share one private request(). The idempotency key is derived
from method, path and body, so the same tool called twice with the same
arguments replays instead of colliding."
```

---

### Task 3: `config.ts` — the opt-in switch

**Files:**
- Modify: `src/config.ts`
- Test: `src/config.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Config.authoringWrite: boolean`, read from `SENTI_ENABLE_AUTHORING_WRITE`.

- [ ] **Step 1: Write the failing tests**

```ts
describe('SENTI_ENABLE_AUTHORING_WRITE', () => {
  const base = { SENTI_API_KEY: 'sq_live_x' };

  test('is off when unset', () => {
    expect(loadConfig(base).authoringWrite).toBe(false);
  });

  test('is on for "1" and "true", case-insensitively and ignoring surrounding space', () => {
    for (const value of ['1', 'true', 'TRUE', ' True ']) {
      expect(loadConfig({ ...base, SENTI_ENABLE_AUTHORING_WRITE: value }).authoringWrite, value).toBe(true);
    }
  });

  test('is off for every other value, so "0" and "false" are not surprises', () => {
    for (const value of ['0', 'false', 'no', 'off', 'yes', '', 'enabled']) {
      expect(loadConfig({ ...base, SENTI_ENABLE_AUTHORING_WRITE: value }).authoringWrite, value).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/config.test.ts`
Expected: FAIL — `authoringWrite` is `undefined`.

- [ ] **Step 3: Implement**

```ts
const TRUTHY: readonly string[] = ['1', 'true'];

export type Config = {
  /** API root, without a trailing slash. */
  baseUrl: string;
  apiKey: string;
  /** Whether the authoring write tools are registered at all. */
  authoringWrite: boolean;
};
```

and in the returned frozen object:

```ts
    authoringWrite: TRUTHY.includes((env.SENTI_ENABLE_AUTHORING_WRITE ?? '').trim().toLowerCase()),
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/config.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config.ts src/config.test.ts
git commit -m "feat(config): SENTI_ENABLE_AUTHORING_WRITE opt-in

Authoring-only by design: EPIC-3 gets its own flag, so enabling an agent to
edit code is never the same act as enabling it to close a position."
```

---

### Task 4: `core/tool.ts` — `registerWriteTool`

Confirmation arrives in Task 7. This task ships the registrar and its annotations.

**Files:**
- Modify: `src/core/tool.ts`
- Test: `src/core/tool.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:

```ts
export type WriteToolSpec<Args, Structured> = {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodType<Args>;
  outputSchema: z.ZodType<Structured>;
  destructive: boolean;
  idempotent: boolean;
  run: (args: Args, signal: AbortSignal) => Promise<{ text: string; structured: Structured }>;
};

export function registerWriteTool<Args, Structured>(
  server: McpServer,
  spec: WriteToolSpec<Args, Structured>,
): void;
```

- [ ] **Step 1: Write the failing tests**

Append to `src/core/tool.test.ts`:

```ts
function serverWithWrite(overrides: { destructive?: boolean; idempotent?: boolean } = {}) {
  const server = new McpServer({ name: 'test', version: '0.0.0' });

  registerWriteTool(server, {
    name: 'touch_draft',
    title: 'Touch',
    description: 'Write the draftId back.',
    inputSchema: z.object({ draftId: z.string() }),
    outputSchema: EchoOutput,
    destructive: overrides.destructive ?? false,
    idempotent: overrides.idempotent ?? false,
    run: async (args) => ({ text: `wrote ${args.draftId}`, structured: { echoed: args.draftId } }),
  });

  return server;
}

describe('registerWriteTool', () => {
  test('never advertises itself read-only', async () => {
    const client = await connect(serverWithWrite());

    const { tools } = await client.listTools();

    expect(tools[0]?.annotations?.readOnlyHint).toBe(false);
    expect(tools[0]?.annotations?.openWorldHint).toBe(true);
  });

  test('takes destructiveHint and idempotentHint from the spec', async () => {
    const client = await connect(serverWithWrite({ destructive: true, idempotent: true }));

    const { tools } = await client.listTools();

    expect(tools[0]?.annotations?.destructiveHint).toBe(true);
    expect(tools[0]?.annotations?.idempotentHint).toBe(true);
  });

  test('returns text and structured content on success', async () => {
    const client = await connect(serverWithWrite());

    const result = (await client.callTool({
      name: 'touch_draft',
      arguments: { draftId: 'd-1' },
    })) as ToolResult;

    expect(result.isError).toBeFalsy();
    expect(result.content[0]?.text).toBe('wrote d-1');
    expect(result.structuredContent).toEqual({ echoed: 'd-1' });
  });

  test('returns a thrown failure as an error result rather than dying', async () => {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    registerWriteTool(server, {
      name: 'boom_write',
      title: 'Boom',
      description: 'Always fails.',
      inputSchema: z.object({}),
      outputSchema: EchoOutput,
      destructive: true,
      idempotent: false,
      run: async () => {
        throw new Error('upstream said no');
      },
    });
    const client = await connect(server);

    const result = (await client.callTool({ name: 'boom_write', arguments: {} })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('upstream said no');
    expect(result.structuredContent).toBeUndefined();
  });
});

describe('registerReadTool and registerWriteTool are separate registrars', () => {
  test('the read registrar has no way to produce a write annotation', async () => {
    const client = await connect(serverWithEcho());

    const { tools } = await client.listTools();

    expect(tools[0]?.annotations?.readOnlyHint).toBe(true);
  });
});
```

Extend the file's import to `import { registerReadTool, registerWriteTool } from './tool.js';`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/core/tool.test.ts`
Expected: FAIL — `registerWriteTool is not a function`.

- [ ] **Step 3: Implement, extracting the shared result shaping**

In `src/core/tool.ts`, add above the two registrars:

```ts
type ToolRun<Args, Structured> = (
  args: Args,
  signal: AbortSignal,
) => Promise<{ text: string; structured: Structured }>;

/**
 * The try/catch is the whole point: a model can read and act on a returned
 * error, but it cannot see a call that died. An error result carries
 * `content` only — `structuredContent` would have to satisfy `outputSchema`,
 * and there is no successful payload to describe.
 */
async function resultOf<Args, Structured>(
  run: ToolRun<Args, Structured>,
  args: Args,
  signal: AbortSignal,
) {
  try {
    const { text, structured } = await run(args, signal);

    return { content: [{ type: 'text' as const, text }], structuredContent: structured };
  } catch (error) {
    return { content: [{ type: 'text' as const, text: describeError(error) }], isError: true };
  }
}
```

Replace `registerReadTool`'s handler body with `async (args, ctx) => resultOf(spec.run, args, ctx.mcpReq.signal)`, leaving its `annotations` block exactly as it is. Then add:

```ts
export type WriteToolSpec<Args, Structured> = {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodType<Args>;
  outputSchema: z.ZodType<Structured>;
  /** A partial-body full replace destroys the rest of the file; say so. */
  destructive: boolean;
  idempotent: boolean;
  run: ToolRun<Args, Structured>;
};

/**
 * Register a write tool.
 *
 * A second function rather than a flag on `registerReadTool`, so that
 * registrar's `readOnlyHint: true` stays a constant no caller can get wrong
 * ([CONTEXT D38](../../docs/CONTEXT.md)).
 */
export function registerWriteTool<Args, Structured>(
  server: McpServer,
  spec: WriteToolSpec<Args, Structured>,
): void {
  server.registerTool(
    spec.name,
    {
      title: spec.title,
      description: spec.description,
      inputSchema: spec.inputSchema,
      outputSchema: spec.outputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: spec.destructive,
        idempotentHint: spec.idempotent,
        openWorldHint: true,
      },
    },
    async (args, ctx) => resultOf(spec.run, args, ctx.mcpReq.signal),
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/core/tool.test.ts && npm run typecheck`
Expected: PASS, including every pre-existing `registerReadTool` assertion.

- [ ] **Step 5: Commit**

```bash
git add src/core/tool.ts src/core/tool.test.ts
git commit -m "feat(core): registerWriteTool

A second registrar rather than a flag, so registerReadTool's readOnlyHint
stays a constant. The try/catch is shared; the annotations are not."
```

---

### Task 5: `write-result.ts` — the shaping every body-carrying write shares

**Files:**
- Create: `src/tools/authoring/write-result.ts`
- Test: `src/tools/authoring/write-result.test.ts`

**Interfaces:**
- Consumes: `DraftSchema`, `AttachmentSchema`, `byteLength`, `type Draft`, `type Attachment`
  from `./get-draft.js`; `parseOrThrow` from `../../core/parse.js`.
- Produces: `DraftWriteOutputSchema`, `AttachmentWriteOutputSchema`, `DeleteOutputSchema`,
  `type DraftWriteResult`, `type AttachmentWriteResult`, `type DeleteResult`,
  `parseWrittenDraft(payload, subject)`, `parseWrittenAttachment(payload, subject)`,
  `parseDeleted(payload, subject)`, `shapeDraftWrite(draft)`, `shapeAttachmentWrite(attachment)`,
  `formatDraftWrite(result, verb)`, `formatAttachmentWrite(result, verb, draftId)`,
  `formatDeleted(result, what)`, `cancelledDelete(what)`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, test } from 'vitest';
import type { Attachment, Draft } from './get-draft.js';
import {
  cancelledDelete,
  formatDraftWrite,
  parseDeleted,
  parseWrittenDraft,
  shapeAttachmentWrite,
  shapeDraftWrite,
} from './write-result.js';

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
  attachments: [
    { id: 'a-1', filename: 'Trend.mq5', sourceCode: 'abcde', createdAt: '2026-08-14T09:30:00.000Z' },
  ],
};

const ATTACHMENT: Attachment = {
  id: 'a-1',
  filename: 'Trend.mq5',
  sourceCode: 'abcde',
  createdAt: '2026-08-14T09:30:00.000Z',
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
    expect(shapeDraftWrite(DRAFT).notes[0]).toContain('get_draft');
    expect(shapeDraftWrite(DRAFT).notes[0]).toContain('d-1');
  });

  test('notes the attachment cut only when an attachment had a body', () => {
    const empty = { ...DRAFT, attachments: [{ ...ATTACHMENT, sourceCode: '' }] };

    expect(shapeDraftWrite(DRAFT).notes).toHaveLength(2);
    expect(shapeDraftWrite(empty).notes).toHaveLength(1);
  });

  test('writes no source note when there was no source to cut', () => {
    const blank = { ...DRAFT, sourceCode: '', attachments: [] };

    expect(shapeDraftWrite(blank).notes).toEqual([]);
  });

  test('counts bytes, not code units', () => {
    const unicode = { ...DRAFT, sourceCode: '€', attachments: [] };

    expect(shapeDraftWrite(unicode).sourceBytes).toBe(3);
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

  test('warns that a stale compile needs redoing', () => {
    expect(formatDraftWrite(shapeDraftWrite(DRAFT), 'updated')).toContain('recompile');
  });

  test('says never compiled rather than inventing a since', () => {
    const fresh = { ...DRAFT, lastCompileStatus: null, lastCompileLog: null };

    expect(formatDraftWrite(shapeDraftWrite(fresh), 'created')).toContain('never compiled');
  });

  test('carries every note into the text, not only into structuredContent', () => {
    const shaped = shapeDraftWrite(DRAFT);
    const text = formatDraftWrite(shaped, 'created');

    for (const note of shaped.notes) expect(text).toContain(note);
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

describe('cancelledDelete', () => {
  test('is a success that says nothing happened', () => {
    const cancelled = cancelledDelete('Draft "Gold Scalper"');

    expect(cancelled.structured.deleted).toBe(false);
    expect(cancelled.structured.id).toBeNull();
    expect(cancelled.text).toContain('nothing was deleted');
  });
});

describe('parseWrittenDraft', () => {
  test('names the subject when the API returns an unexpected shape', () => {
    expect(() => parseWrittenDraft({ id: 'd-1' }, 'created draft')).toThrow(/created draft/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/tools/authoring/write-result.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement `src/tools/authoring/write-result.ts`**

```ts
import * as z from 'zod/v4';
import { parseOrThrow } from '../../core/parse.js';
import {
  AttachmentSchema,
  byteLength,
  DraftSchema,
  type Attachment,
  type Draft,
} from './get-draft.js';

const AttachmentSizeSchema = z.object({
  id: z.string(),
  filename: z.string(),
  sourceBytes: z.number(),
  createdAt: z.string(),
});

export const DraftWriteOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sourceBytes: z.number(),
  lastCompileStatus: z.enum(['PENDING', 'SUCCESS', 'FAILED']).nullable(),
  compiledUpToDate: z.boolean(),
  eaDefinitionId: z.string().nullable(),
  attachments: z.array(AttachmentSizeSchema),
  notes: z.array(z.string()),
});

export const AttachmentWriteOutputSchema = AttachmentSizeSchema.extend({
  notes: z.array(z.string()),
});

/**
 * `id` is nullable and `deleted` exists because a declined confirmation is a
 * success that deleted nothing, and the SDK rejects a non-error result with an
 * `outputSchema` and no `structuredContent`.
 */
export const DeleteOutputSchema = z.object({
  id: z.string().nullable(),
  deleted: z.boolean(),
  notes: z.array(z.string()),
});

export type DraftWriteResult = z.infer<typeof DraftWriteOutputSchema>;
export type AttachmentWriteResult = z.infer<typeof AttachmentWriteOutputSchema>;
export type DeleteResult = z.infer<typeof DeleteOutputSchema>;

const DeletedEnvelopeSchema = z.object({ id: z.string() });

export function parseWrittenDraft(payload: unknown, subject: string): Draft {
  return parseOrThrow(DraftSchema, payload, subject);
}

export function parseWrittenAttachment(payload: unknown, subject: string): Attachment {
  return parseOrThrow(AttachmentSchema, payload, subject);
}

export function parseDeleted(payload: unknown, subject: string): DeleteResult {
  const { id } = parseOrThrow(DeletedEnvelopeSchema, payload, subject);

  return { id, deleted: true, notes: [] };
}

export function shapeDraftWrite(draft: Draft): DraftWriteResult {
  const attachments = draft.attachments.map(({ sourceCode, ...kept }) => ({
    ...kept,
    sourceBytes: byteLength(sourceCode),
  }));
  const sourceBytes = byteLength(draft.sourceCode);
  const notes: string[] = [];

  if (sourceBytes > 0) {
    notes.push(
      'Source was not returned: you just sent it. Call get_draft with draftId ' +
        `"${draft.id}" to read back what the server now holds.`,
    );
  }

  const cut = attachments.filter((attachment) => attachment.sourceBytes > 0).length;
  if (cut > 0) {
    notes.push(
      `Attachment source was cut: ${cut} indicator file(s) are listed with their size ` +
        `but without their code. Call list_draft_attachments with draftId "${draft.id}" ` +
        'to read them.',
    );
  }

  return {
    id: draft.id,
    name: draft.name,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    sourceBytes,
    lastCompileStatus: draft.lastCompileStatus,
    compiledUpToDate: draft.compiledUpToDate,
    eaDefinitionId: draft.eaDefinitionId,
    attachments,
    notes,
  };
}

export function shapeAttachmentWrite(attachment: Attachment): AttachmentWriteResult {
  const sourceBytes = byteLength(attachment.sourceCode);

  return {
    id: attachment.id,
    filename: attachment.filename,
    sourceBytes,
    createdAt: attachment.createdAt,
    notes:
      sourceBytes > 0
        ? [
            'Source was not returned: you just sent it. Call list_draft_attachments with ' +
              `filename "${attachment.filename}" to read back what the server now holds.`,
          ]
        : [],
  };
}

function bytes(count: number): string {
  return `${count.toLocaleString('en-US')} bytes`;
}

function compileLine(draft: DraftWriteResult): string {
  if (draft.lastCompileStatus === null) return 'compile: never compiled';

  return draft.compiledUpToDate
    ? `compile: ${draft.lastCompileStatus} · source unchanged since that compile`
    : `compile: ${draft.lastCompileStatus} · source changed since that compile — ` +
        'call compile_draft again before relying on it';
}

function attachmentLine(draft: DraftWriteResult): string {
  if (draft.attachments.length === 0) return 'attachments: none';

  const rows = draft.attachments
    .map((attachment) => `${attachment.filename} ${bytes(attachment.sourceBytes)}`)
    .join(' · ');

  return `attachments: ${draft.attachments.length} (${rows})`;
}

function withNotes(head: string, notes: string[]): string {
  return notes.length === 0
    ? head
    : `${head}\n\nNotes:\n${notes.map((note) => `- ${note}`).join('\n')}`;
}

export function formatDraftWrite(draft: DraftWriteResult, verb: 'created' | 'updated'): string {
  const replace = verb === 'updated' ? ' (full replace — this is now the entire draft)' : '';

  return withNotes(
    [
      `Draft "${draft.name}" ${verb} (draftId ${draft.id}).`,
      `  source: ${bytes(draft.sourceBytes)} written${replace}`,
      `  ${compileLine(draft)}`,
      `  ${attachmentLine(draft)}`,
    ].join('\n'),
    draft.notes,
  );
}

export function formatAttachmentWrite(
  attachment: AttachmentWriteResult,
  verb: 'attached to' | 'replaced on',
  draftId: string,
): string {
  const wiring =
    verb === 'attached to'
      ? '\n\nThe EA does not use this file until it references it: add ' +
        `\`#resource "${attachment.filename.replace(/\.mq5$/i, '.ex5')}"\` and an ` +
        `\`iCustom(_Symbol, _Period, "::${attachment.filename.replace(/\.mq5$/i, '.ex5')}", …)\` ` +
        'call to the draft source with update_draft, then compile_draft.'
      : '';

  return withNotes(
    `Indicator "${attachment.filename}" ${verb} draft ${draftId} ` +
      `(attachmentId ${attachment.id}).\n  source: ${bytes(attachment.sourceBytes)} written` +
      wiring,
    attachment.notes,
  );
}

export function formatDeleted(result: DeleteResult, what: string): string {
  return withNotes(`${what} deleted (id ${result.id}).`, result.notes);
}

export function cancelledDelete(what: string): { text: string; structured: DeleteResult } {
  return {
    text: `Cancelled — nothing was deleted. ${what} is unchanged.`,
    structured: {
      id: null,
      deleted: false,
      notes: ['The confirmation was declined, so no request was sent to the Senti API.'],
    },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/tools/authoring/write-result.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/authoring/write-result.ts src/tools/authoring/write-result.test.ts
git commit -m "feat(authoring): write-result shaping

A write response does not echo the source it was just sent. Notes report
loss, so an empty file produces none."
```

---

### Task 6: `create_draft`, registration, and the `2.5.0` release

Closes **US-8.1**.

**Files:**
- Create: `src/tools/authoring/create-draft.ts`
- Test: `src/tools/authoring/create-draft.test.ts`
- Modify: `src/server.ts`, `src/server.test.ts`, `src/index.ts`, `src/config.ts` (`SERVER_VERSION`)
- Modify: `VERSION`, `package.json`, `package-lock.json`, `docs/CHANGELOG.md`, `README.md`,
  `docs/SETUP.md`, `.env.example`, `AGENTS.md`, `docs/sprints/stories/US-8.1-*.md`

**Interfaces:**
- Consumes: `client.send`, `idempotencyKeyFor`, `DRAFT_CAP_OR_SCOPE`, `DRAFT_NAME_TAKEN` (Task 1–2);
  `registerWriteTool` (Task 4); `write-result.ts` (Task 5); `Config.authoringWrite` (Task 3).
- Produces: `registerCreateDraft(server, client)`, imported by `src/server.ts`.

- [ ] **Step 1: Write the failing tool test**

`src/tools/authoring/create-draft.test.ts` opens with **HARNESS A** copied verbatim; its marked
line already names `registerCreateDraft`. Add the fixture beside it:

```ts
const CREATED = {
  id: 'd-1',
  name: 'Gold Scalper',
  sourceCode: '// hello',
  createdAt: '2026-08-21T09:00:00.000Z',
  updatedAt: '2026-08-21T09:00:00.000Z',
  lastCompileStatus: null,
  lastCompileLog: null,
  logTruncated: false,
  lastCompileDiagnostics: [],
  compiledUpToDate: false,
  eaDefinitionId: null,
  attachments: [],
};

describe('create_draft', () => {
  test('POSTs name and sourceCode to /api/v1/drafts with an idempotency key', async () => {
    const { calls, fetchImpl } = stub(201, CREATED);
    const client = await connect(fetchImpl);

    await client.callTool({
      name: 'create_draft',
      arguments: { name: 'Gold Scalper', sourceCode: '// hello' },
    });

    expect(calls[0]?.url).toBe('https://be-dev.sentitrade.xyz/api/v1/drafts');
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.body).toBe(
      JSON.stringify({ name: 'Gold Scalper', sourceCode: '// hello' }),
    );
    expect((calls[0]?.init.headers as Record<string, string>)['idempotency-key']).toMatch(
      /^[0-9a-f]{32}$/,
    );
  });

  test('does not echo the source back', async () => {
    const { fetchImpl } = stub(201, CREATED);
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'create_draft',
      arguments: { name: 'Gold Scalper', sourceCode: '// hello' },
    })) as ToolResult;

    expect(JSON.stringify(result)).not.toContain('// hello');
    expect(result.structuredContent?.sourceBytes).toBe(8);
  });

  test('reports a full draft cap as something a retry will not fix', async () => {
    const { fetchImpl } = stub(403, { error: { code: 'FORBIDDEN', message: 'Draft limit.' } });
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'create_draft',
      arguments: { name: 'Gold Scalper', sourceCode: '// hello' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('delete_draft');
    expect(result.content[0]?.text).not.toContain('sq_live_supersecret');
  });

  test('reports a duplicate name as a name collision, not a missing draft', async () => {
    const { fetchImpl } = stub(409, { error: { code: 'CONFLICT', message: 'Name taken.' } });
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'create_draft',
      arguments: { name: 'Gold Scalper', sourceCode: '// hello' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('unique per user');
  });

  test('rejects an empty name before a request is made', async () => {
    const { calls, fetchImpl } = stub(201, CREATED);
    const client = await connect(fetchImpl);

    await client
      .callTool({ name: 'create_draft', arguments: { name: '', sourceCode: '// hello' } })
      .catch(() => undefined);

    expect(calls).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/tools/authoring/create-draft.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement `src/tools/authoring/create-draft.ts`**

```ts
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import {
  DRAFT_CAP_OR_SCOPE,
  DRAFT_NAME_TAKEN,
  idempotencyKeyFor,
  type SentiClient,
} from '../../core/client.js';
import { registerWriteTool } from '../../core/tool.js';
import {
  DraftWriteOutputSchema,
  formatDraftWrite,
  parseWrittenDraft,
  shapeDraftWrite,
} from './write-result.js';

const AUTHORING_WRITE = 'authoring:write';
const DRAFTS_PATH = '/api/v1/drafts';

const InputSchema = z.object({
  name: z.string().min(1).max(120),
  sourceCode: z.string(),
});

export function registerCreateDraft(server: McpServer, client: SentiClient): void {
  registerWriteTool(server, {
    name: 'create_draft',
    title: 'Create an MQL5 draft',
    description:
      'Create a new MQL5 Expert Advisor draft on the Senti Quant platform from source you ' +
      'have written. CALL get_authoring_conventions FIRST — code that breaks the platform ' +
      'rules is rejected by a static scan before it reaches the compiler, and this tool does ' +
      'not check them for you. `name` is unique per user (1–120 characters) and also derives ' +
      'the `.mq5` filename at compile time. `sourceCode` is the complete EA source; the ' +
      'platform caps it (see `limits.maxSourceBytes` from get_authoring_conventions) and ' +
      'rejects an oversized body rather than truncating it. The response does NOT echo your ' +
      'source back — it returns the new `id`, the byte count written, and the compile state. ' +
      'Nothing is compiled until you call compile_draft.',
    inputSchema: InputSchema,
    outputSchema: DraftWriteOutputSchema,
    destructive: false,
    idempotent: false,
    run: async (args, signal) => {
      const body = { name: args.name, sourceCode: args.sourceCode };

      const payload = await client.send('POST', DRAFTS_PATH, {
        signal,
        body,
        idempotencyKey: idempotencyKeyFor('POST', DRAFTS_PATH, body),
        scope: AUTHORING_WRITE,
        forbiddenMeans: DRAFT_CAP_OR_SCOPE,
        conflictMeans: DRAFT_NAME_TAKEN,
      });
      const shaped = shapeDraftWrite(parseWrittenDraft(payload, 'created draft'));

      return { text: formatDraftWrite(shaped, 'created'), structured: shaped };
    },
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/tools/authoring/create-draft.test.ts`
Expected: PASS.

- [ ] **Step 5: Register it behind the flag in `src/server.ts`**

Add the import, and after the read-tool registrations:

```ts
  // Write tools are registered only when the operator opts in. A host that
  // never sets the flag never sees one in tools/list.
  if (config.authoringWrite) {
    registerCreateDraft(server, client);
  }
```

- [ ] **Step 6: Extend `src/index.ts`'s readiness line**

```ts
  const mode = config.authoringWrite ? 'authoring writes ENABLED' : 'read-only';
  console.error(
    `${SERVER_NAME} ${SERVER_VERSION} ready — serving ${config.baseUrl} (${mode})`,
  );
```

- [ ] **Step 7: Add the server-level invariant tests**

Append to `src/server.test.ts` — **additive only**; do not touch `TOOL_CALLS`, `connect`, or the
existing `every tool advertises itself read-only` test, all of which run without the flag and
therefore still see exactly the fourteen read tools:

```ts
const writeConfig = loadConfig({
  SENTI_API_KEY: 'sq_live_supersecret',
  SENTI_API_BASE_URL: 'https://be-dev.sentitrade.xyz',
  SENTI_ENABLE_AUTHORING_WRITE: '1',
});

async function connectWithWrites(fetchImpl: typeof fetch = okFetch) {
  const server = createServer(writeConfig, { fetch: fetchImpl });
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

/** Grows by one row per write tool as EPIC-8 lands; asserted against tools/list. */
const WRITE_TOOL_ANNOTATIONS: Record<string, { destructive: boolean; idempotent: boolean }> = {
  create_draft: { destructive: false, idempotent: false },
};

describe('the authoring write opt-in', () => {
  test('registers no write tool when the flag is unset', async () => {
    const client = await connect();

    const { tools } = await client.listTools();

    expect(tools).toHaveLength(14);
    for (const name of Object.keys(WRITE_TOOL_ANNOTATIONS)) {
      expect(tools.map((tool) => tool.name)).not.toContain(name);
    }
  });

  test('registers every write tool when the flag is set', async () => {
    const client = await connectWithWrites();

    const { tools } = await client.listTools();

    expect(tools).toHaveLength(14 + Object.keys(WRITE_TOOL_ANNOTATIONS).length);
    for (const name of Object.keys(WRITE_TOOL_ANNOTATIONS)) {
      expect(tools.map((tool) => tool.name)).toContain(name);
    }
  });

  test('every write tool carries the annotations the design table states', async () => {
    const client = await connectWithWrites();

    const { tools } = await client.listTools();

    for (const [name, expected] of Object.entries(WRITE_TOOL_ANNOTATIONS)) {
      const tool = tools.find((candidate) => candidate.name === name);

      expect(tool, name).toBeDefined();
      expect(tool?.annotations?.readOnlyHint, name).toBe(false);
      expect(tool?.annotations?.destructiveHint, name).toBe(expected.destructive);
      expect(tool?.annotations?.idempotentHint, name).toBe(expected.idempotent);
      expect(tool?.annotations?.openWorldHint, name).toBe(true);
    }
  });
});
```

- [ ] **Step 8: Run the whole suite and typecheck**

Run: `npm run typecheck && npm test`
Expected: PASS, `1 skipped` (the opt-in smoke test).

- [ ] **Step 9: Bump the version in all four places and write the docs**

`VERSION` → `2.5.0`; `package.json` `version` → `2.5.0`; `SERVER_VERSION` in `src/config.ts`
→ `'2.5.0'`; then `npm install --package-lock-only` to move `package-lock.json`.

- `docs/CHANGELOG.md` — a `## [2.5.0] — 2026-08-21 — create_draft, and the write path opens`
  entry: the opt-in and why it is authoring-only; the seventh scope; that the response does
  not echo source; that the idempotency key is derived, not random.
- `README.md` — a `create_draft` row in the tool table, and a new **Enabling the write path**
  section stating the env var, the `authoring:write` scope, and that no trading write is
  reachable at any setting of it.
- `docs/SETUP.md` **and** `.env.example` — `SENTI_ENABLE_AUTHORING_WRITE` in the same commit
  (RULE-11), plus `authoring:write` in the existing scope paragraph.
- `AGENTS.md` — 14 → 15 tools; the `authoring:write` scope; `create-draft.ts` and
  `write-result.ts` in §Repo structure; `send` in the `core/client.ts` line; `registerWriteTool`
  in the `core/tool.ts` line. **Rewrite §The read/write split**: the standing rule becomes *no
  trading write tool, and no authoring write tool outside the opt-in* — a narrower boundary,
  not a deletion.
- `docs/sprints/stories/US-8.1-*.md` — `status: done`, `version_shipped: 2.5.0`, tasks `[x]`,
  and an `## Implementation notes` section recording the measured idempotency retention window.
- `npm run agile:status`

- [ ] **Step 10: Run the release gate**

Run: `npm run release:check && npm run release:verify-pack`
Expected: both exit 0.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(authoring): create_draft, and the write path opens (2.5.0)

Seven write tools land behind SENTI_ENABLE_AUTHORING_WRITE; this is the
first. The response does not echo the source it was just sent, and the
idempotency key is derived from the request rather than random.

Closes US-8.1."
```

---

### Task 7: `core/tool.ts` — the confirmation seam

**Files:**
- Modify: `src/core/tool.ts`, `AGENTS.md`
- Test: `src/core/tool.test.ts`

**Interfaces:**
- Consumes: Task 4's `registerWriteTool`.
- Produces: `WriteToolSpec.confirm?: { message: (args: Args) => string; cancelled: (args: Args) => { text: string; structured: Structured } }`.

**Why `requestState` and not just `inputResponses`.** `acceptedContent()` returns `undefined`
for a *declined* elicitation exactly as it does for a *missing* one. Branching on it alone would
re-ask on every decline and spin until the client's `maxRounds` cap. So the seam mints an opaque
`requestState` on the first round and treats its presence as "already asked". The state cannot be
used to skip the confirmation: a forged one lands in the cancel branch, because only *accepted*
content runs the request.

- [ ] **Step 1: Write the failing tests**

Append to `src/core/tool.test.ts`:

```ts
function confirmingServer(ran: { count: number }) {
  const server = new McpServer({ name: 'test', version: '0.0.0' });

  registerWriteTool(server, {
    name: 'drop_draft',
    title: 'Drop',
    description: 'Delete a draft.',
    inputSchema: z.object({ draftId: z.string() }),
    outputSchema: EchoOutput,
    destructive: true,
    idempotent: true,
    confirm: {
      message: (args) => `Delete draft ${args.draftId}? This cannot be undone.`,
      cancelled: () => ({ text: 'Cancelled — nothing was deleted.', structured: { echoed: '' } }),
    },
    run: async (args) => {
      ran.count += 1;
      return { text: `dropped ${args.draftId}`, structured: { echoed: args.draftId } };
    },
  });

  return server;
}

async function connectAnswering(
  server: McpServer,
  answer: { action: 'accept'; content: Record<string, unknown> } | { action: 'decline' },
) {
  const seen: string[] = [];
  const client = new Client(
    { name: 'test-client', version: '0.0.0' },
    { capabilities: { elicitation: {} } },
  );

  client.setRequestHandler('elicitation/create', async (request) => {
    seen.push(String((request.params as { message?: unknown }).message ?? ''));
    return answer;
  });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return { client, seen };
}

describe('registerWriteTool confirmation', () => {
  test('asks before running, quoting the arguments in the question', async () => {
    const ran = { count: 0 };
    const { client, seen } = await connectAnswering(confirmingServer(ran), {
      action: 'accept',
      content: { confirm: true },
    });

    const result = (await client.callTool({
      name: 'drop_draft',
      arguments: { draftId: 'd-1' },
    })) as ToolResult;

    expect(seen).toEqual(['Delete draft d-1? This cannot be undone.']);
    expect(ran.count).toBe(1);
    expect(result.content[0]?.text).toBe('dropped d-1');
  });

  test('runs nothing when the confirmation is declined', async () => {
    const ran = { count: 0 };
    const { client } = await connectAnswering(confirmingServer(ran), { action: 'decline' });

    const result = (await client.callTool({
      name: 'drop_draft',
      arguments: { draftId: 'd-1' },
    })) as ToolResult;

    expect(ran.count).toBe(0);
    expect(result.isError).toBeFalsy();
    expect(result.content[0]?.text).toContain('Cancelled');
    expect(result.structuredContent).toEqual({ echoed: '' });
  });

  test('runs nothing when the answer is an explicit no', async () => {
    const ran = { count: 0 };
    const { client } = await connectAnswering(confirmingServer(ran), {
      action: 'accept',
      content: { confirm: false },
    });

    const result = (await client.callTool({
      name: 'drop_draft',
      arguments: { draftId: 'd-1' },
    })) as ToolResult;

    expect(ran.count).toBe(0);
    expect(result.content[0]?.text).toContain('Cancelled');
  });

  test('asks exactly once — a decline does not re-ask until the round cap', async () => {
    const ran = { count: 0 };
    const { client, seen } = await connectAnswering(confirmingServer(ran), { action: 'decline' });

    await client.callTool({ name: 'drop_draft', arguments: { draftId: 'd-1' } });

    expect(seen).toHaveLength(1);
  });

  test('a tool with no confirm spec never elicits', async () => {
    const { client, seen } = await connectAnswering(serverWithWrite(), {
      action: 'accept',
      content: { confirm: true },
    });

    await client.callTool({ name: 'touch_draft', arguments: { draftId: 'd-1' } });

    expect(seen).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/core/tool.test.ts -t confirmation`
Expected: FAIL — `confirm` is not a known property of `WriteToolSpec`.

- [ ] **Step 3: Implement the seam**

Change the SDK import in `src/core/tool.ts` from type-only to a mixed import:

```ts
import { acceptedContent, inputRequired } from '@modelcontextprotocol/server';
import type { McpServer } from '@modelcontextprotocol/server';
```

and **update the file's header comment**: `core/tool.ts` is now the third file pulling a runtime
value out of `@modelcontextprotocol/*`, alongside `src/server.ts` and `src/index.ts`.

Extend the spec type and the handler:

```ts
const CONFIRM_KEY = 'confirm';
/** Opaque, and load-bearing only against re-asking — see the seam's comment. */
const CONFIRM_ASKED = 'confirm-asked';

export type WriteToolSpec<Args, Structured> = {
  // …name, title, description, inputSchema, outputSchema, destructive, idempotent…
  /**
   * Present only on operations no other tool in this server can undo.
   * `cancelled` supplies the payload for a declined confirmation, because a
   * non-error result must still satisfy `outputSchema`.
   */
  confirm?: {
    message: (args: Args) => string;
    cancelled: (args: Args) => { text: string; structured: Structured };
  };
  run: ToolRun<Args, Structured>;
};
```

In the handler, before `resultOf`:

```ts
      if (spec.confirm) {
        // `acceptedContent` cannot tell a decline from a first entry — both are
        // `undefined` — so the round is identified by the state we minted, not
        // by the answer. A forged state lands in the cancel branch below, since
        // only accepted content reaches `run`.
        const asked = ctx.mcpReq.requestState() !== undefined;

        if (!asked) {
          return inputRequired({
            requestState: CONFIRM_ASKED,
            inputRequests: {
              [CONFIRM_KEY]: inputRequired.elicit({
                message: spec.confirm.message(args),
                requestedSchema: {
                  type: 'object',
                  properties: {
                    confirm: { type: 'boolean', description: 'Confirm this deletion.' },
                  },
                  required: [CONFIRM_KEY],
                },
              }),
            },
          });
        }

        const answer = acceptedContent<{ confirm?: boolean }>(
          ctx.mcpReq.inputResponses,
          CONFIRM_KEY,
        );

        if (answer?.confirm !== true) {
          const { text, structured } = spec.confirm.cancelled(args);

          return { content: [{ type: 'text' as const, text }], structuredContent: structured };
        }
      }

      return resultOf(spec.run, args, ctx.mcpReq.signal);
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/core/tool.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Correct `AGENTS.md`'s SDK-import claim**

§Repo structure says `server.ts ← … The only file importing the SDK's main entry`. Change it to
name `src/server.ts` and `src/core/tool.ts`, and state that `core/tool.ts` imports
`inputRequired` and `acceptedContent` for the confirmation seam.

- [ ] **Step 6: Commit**

```bash
git add src/core/tool.ts src/core/tool.test.ts AGENTS.md
git commit -m "feat(core): confirmation seam for write tools

Identifies the round by a minted requestState rather than by the answer,
because acceptedContent cannot tell a decline from a first entry and
branching on it alone re-asks until the client's round cap."
```

---

### Task 8: `update_draft`

**Files:**
- Create: `src/tools/authoring/update-draft.ts`
- Test: `src/tools/authoring/update-draft.test.ts`
- Modify: `src/server.ts`

**Interfaces:**
- Consumes: Tasks 1, 2, 4, 5.
- Produces: `registerUpdateDraft(server, client)`.

- [ ] **Step 1: Write the failing test**

`src/tools/authoring/update-draft.test.ts` opens with **HARNESS A** copied verbatim, with the
marked line changed to `registerUpdateDraft(server, createClient(config, { fetch: fetchImpl }));`.
Then:

```ts
describe('update_draft', () => {
  test('PUTs the whole draft to the id path', async () => {
    const { calls, fetchImpl } = stub(200, UPDATED);
    const client = await connect(fetchImpl);

    await client.callTool({
      name: 'update_draft',
      arguments: { draftId: 'd-1', name: 'Gold Scalper', sourceCode: '// v2' },
    });

    expect(calls[0]?.url).toBe('https://be-dev.sentitrade.xyz/api/v1/drafts/d-1');
    expect(calls[0]?.init.method).toBe('PUT');
    expect(calls[0]?.init.body).toBe(
      JSON.stringify({ name: 'Gold Scalper', sourceCode: '// v2' }),
    );
  });

  test('sends no Idempotency-Key, which this route does not accept', async () => {
    const { calls, fetchImpl } = stub(200, UPDATED);
    const client = await connect(fetchImpl);

    await client.callTool({
      name: 'update_draft',
      arguments: { draftId: 'd-1', name: 'Gold Scalper', sourceCode: '// v2' },
    });

    expect((calls[0]?.init.headers as Record<string, string>)['idempotency-key']).toBeUndefined();
  });

  test('says full replace, so a partial body is not mistaken for a patch', async () => {
    const { fetchImpl } = stub(200, UPDATED);
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'update_draft',
      arguments: { draftId: 'd-1', name: 'Gold Scalper', sourceCode: '// v2' },
    })) as ToolResult;

    expect(result.content[0]?.text).toContain('full replace');
  });

  test('rejects a traversal draftId before a request is made', async () => {
    const { calls, fetchImpl } = stub(200, UPDATED);
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'update_draft',
      arguments: { draftId: '../../admin', name: 'x', sourceCode: '// v2' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(calls).toHaveLength(0);
  });

  test('reports a 404 as a missing draft, not a missing route', async () => {
    const { fetchImpl } = stub(404, { error: { code: 'NOT_FOUND', message: 'No draft.' } });
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'update_draft',
      arguments: { draftId: 'd-9', name: 'x', sourceCode: '// v2' },
    })) as ToolResult;

    expect(result.content[0]?.text).toContain('list_drafts');
  });
});
```

`UPDATED` is `CREATED` from Task 6 with `sourceCode: '// v2'`, `lastCompileStatus: 'SUCCESS'`,
`lastCompileLog: 'ok'` and `compiledUpToDate: false`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/tools/authoring/update-draft.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement `src/tools/authoring/update-draft.ts`**

```ts
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import {
  AUTHORING_WRITE_SCOPE,
  DRAFT_NAME_TAKEN,
  DRAFT_NOT_FOUND,
  draftPath,
  type SentiClient,
} from '../../core/client.js';
import { registerWriteTool } from '../../core/tool.js';
import {
  DraftWriteOutputSchema,
  formatDraftWrite,
  parseWrittenDraft,
  shapeDraftWrite,
} from './write-result.js';

const AUTHORING_WRITE = 'authoring:write';

const InputSchema = z.object({
  draftId: z.string(),
  name: z.string().min(1).max(120),
  sourceCode: z.string(),
});

export function registerUpdateDraft(server: McpServer, client: SentiClient): void {
  registerWriteTool(server, {
    name: 'update_draft',
    title: 'Replace an MQL5 draft',
    description:
      'Replace an existing MQL5 draft. THIS IS A FULL REPLACE, NOT A PATCH: both `name` and ' +
      '`sourceCode` are always written, so send the COMPLETE draft every time. Sending only ' +
      'the part you changed deletes the rest of the file — the API has no partial-update ' +
      'verb. If you do not have the current source in front of you, call get_draft first. ' +
      '`draftId` is the `id` from list_drafts. Renaming to a name another draft already ' +
      'holds is rejected. This does not compile anything: call compile_draft afterwards, ' +
      'because any previous successful compile no longer matches the new source.',
    inputSchema: InputSchema,
    outputSchema: DraftWriteOutputSchema,
    destructive: true,
    idempotent: true,
    run: async (args, signal) => {
      const payload = await client.send('PUT', draftPath(args.draftId), {
        signal,
        body: { name: args.name, sourceCode: args.sourceCode },
        scope: AUTHORING_WRITE,
        forbiddenMeans: AUTHORING_WRITE_SCOPE,
        notFoundMeans: DRAFT_NOT_FOUND,
        conflictMeans: DRAFT_NAME_TAKEN,
      });
      const shaped = shapeDraftWrite(parseWrittenDraft(payload, 'updated draft'));

      return { text: formatDraftWrite(shaped, 'updated'), structured: shaped };
    },
  });
}
```

- [ ] **Step 4: Register it and run**

Add `registerUpdateDraft(server, client);` inside `src/server.ts`'s `if (config.authoringWrite)`
block, and add `update_draft: { destructive: true, idempotent: true }` to
`WRITE_TOOL_ANNOTATIONS` in `src/server.test.ts`.

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/authoring/update-draft.ts src/tools/authoring/update-draft.test.ts src/server.ts src/server.test.ts
git commit -m "feat(authoring): update_draft

Annotated destructive despite its name: the API declares a full replace and
no partial-update verb, so a partial body destroys the rest of the file."
```

---

### Task 9: `delete_draft`, and the `2.6.0` release

Closes **US-8.2**.

**Files:**
- Create: `src/tools/authoring/delete-draft.ts`
- Test: `src/tools/authoring/delete-draft.test.ts`
- Modify: `src/server.ts`, `src/server.test.ts`, `src/config.ts`, `VERSION`, `package.json`,
  `package-lock.json`, `docs/CHANGELOG.md`, `README.md`, `AGENTS.md`,
  `docs/sprints/stories/US-8.2-*.md`

**Interfaces:**
- Consumes: Tasks 1, 2, 5, 7.
- Produces: `registerDeleteDraft(server, client)`.

- [ ] **Step 1: Write the failing test**

`src/tools/authoring/delete-draft.test.ts` opens with **HARNESS B** copied verbatim; its marked
line already names `registerDeleteDraft`. Then:

```ts
describe('delete_draft', () => {
  test('sends nothing until the confirmation is accepted', async () => {
    const { calls, fetchImpl } = stub(200, { id: 'd-1' });
    const { client } = await connectAnswering(fetchImpl, { action: 'decline' });

    const result = (await client.callTool({
      name: 'delete_draft',
      arguments: { draftId: 'd-1' },
    })) as ToolResult;

    expect(calls).toHaveLength(0);
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      id: null,
      deleted: false,
      notes: ['The confirmation was declined, so no request was sent to the Senti API.'],
    });
  });

  test('names the draft in the question rather than only its id', async () => {
    const { fetchImpl } = stub(200, { id: 'd-1' });
    const { client, seen } = await connectAnswering(fetchImpl, { action: 'decline' });

    await client.callTool({ name: 'delete_draft', arguments: { draftId: 'd-1' } });

    expect(seen[0]).toContain('d-1');
    expect(seen[0]).toContain('cannot be undone');
  });

  test('DELETEs once when accepted, and reports the deleted id', async () => {
    const { calls, fetchImpl } = stub(200, { id: 'd-1' });
    const { client } = await connectAnswering(fetchImpl, {
      action: 'accept',
      content: { confirm: true },
    });

    const result = (await client.callTool({
      name: 'delete_draft',
      arguments: { draftId: 'd-1' },
    })) as ToolResult;

    expect(calls).toHaveLength(1);
    expect(calls[0]?.init.method).toBe('DELETE');
    expect(calls[0]?.url).toBe('https://be-dev.sentitrade.xyz/api/v1/drafts/d-1');
    expect(result.structuredContent).toEqual({ id: 'd-1', deleted: true, notes: [] });
  });

  test('says a registered EA survives the draft', async () => {
    const { fetchImpl } = stub(200, { id: 'd-1' });
    const { client } = await connectAnswering(fetchImpl, {
      action: 'accept',
      content: { confirm: true },
    });

    const result = (await client.callTool({
      name: 'delete_draft',
      arguments: { draftId: 'd-1' },
    })) as ToolResult;

    expect(result.content[0]?.text).toMatch(/registered EA/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/tools/authoring/delete-draft.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement `src/tools/authoring/delete-draft.ts`**

```ts
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import {
  AUTHORING_WRITE_SCOPE,
  DRAFT_NOT_FOUND,
  draftPath,
  type SentiClient,
} from '../../core/client.js';
import { registerWriteTool } from '../../core/tool.js';
import { cancelledDelete, DeleteOutputSchema, formatDeleted, parseDeleted } from './write-result.js';

const AUTHORING_WRITE = 'authoring:write';

const InputSchema = z.object({ draftId: z.string() });

export function registerDeleteDraft(server: McpServer, client: SentiClient): void {
  registerWriteTool(server, {
    name: 'delete_draft',
    title: 'Delete an MQL5 draft',
    description:
      'Delete one MQL5 draft and every indicator attached to it. THIS CANNOT BE UNDONE and ' +
      'no tool in this server restores a deleted draft. The user is asked to confirm before ' +
      'anything is sent. An EA already registered from this draft is NOT affected — it is a ' +
      'separate resource. Use this to free a slot when create_draft reports the draft cap is ' +
      'full. `draftId` is the `id` from list_drafts.',
    inputSchema: InputSchema,
    outputSchema: DeleteOutputSchema,
    destructive: true,
    idempotent: true,
    confirm: {
      message: (args) =>
        `Delete draft ${args.draftId} and all of its attachments? This cannot be undone.`,
      cancelled: (args) => cancelledDelete(`Draft ${args.draftId}`),
    },
    run: async (args, signal) => {
      const payload = await client.send('DELETE', draftPath(args.draftId), {
        signal,
        scope: AUTHORING_WRITE,
        forbiddenMeans: AUTHORING_WRITE_SCOPE,
        notFoundMeans: DRAFT_NOT_FOUND,
      });
      const result = parseDeleted(payload, 'deleted draft');

      return {
        text:
          `${formatDeleted(result, `Draft ${args.draftId}`)}\n\n` +
          'Any EA already registered from this draft still exists — registering is a ' +
          'separate resource, and deleting the draft does not remove it.',
        structured: result,
      };
    },
  });
}
```

- [ ] **Step 4: Register and run the suite**

Add `registerDeleteDraft(server, client);` to `src/server.ts`, and
`delete_draft: { destructive: true, idempotent: true }` to `WRITE_TOOL_ANNOTATIONS`.

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 5: Bump to `2.6.0` and write the docs**

`VERSION`, `package.json`, `SERVER_VERSION`, then `npm install --package-lock-only`.

- `docs/CHANGELOG.md` — `## [2.6.0] — 2026-08-21 — update_draft and delete_draft`. State the
  full-replace hazard and the `destructiveHint` that flags it; state that confirmation is on the
  deletes only and why; state that a host without elicitation support cannot use `delete_draft`.
- `README.md` — two rows, plus a line in the write-path section naming the two tools that confirm.
- `AGENTS.md` — 15 → 17 tools; the two new files in §Repo structure.
- `docs/sprints/stories/US-8.2-*.md` — `status: done`, `version_shipped: 2.6.0`, tasks `[x]`.
- `npm run agile:status`

- [ ] **Step 6: Run the release gate**

Run: `npm run release:check && npm run release:verify-pack`
Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(authoring): update_draft and delete_draft (2.6.0)

delete_draft is the first tool that pauses for a human. A declined
confirmation is a success that deleted nothing, not an error — a user
saying no is not a malfunction.

Closes US-8.2."
```

---

### Task 10: `add_draft_attachment`

**Files:**
- Create: `src/tools/authoring/add-draft-attachment.ts`
- Test: `src/tools/authoring/add-draft-attachment.test.ts`
- Modify: `src/server.ts`, `src/server.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 2, 4, 5.
- Produces: `registerAddDraftAttachment(server, client)`.

- [ ] **Step 1: Write the failing test**

`src/tools/authoring/add-draft-attachment.test.ts` opens with **HARNESS A** copied verbatim,
with the marked line changed to
`registerAddDraftAttachment(server, createClient(config, { fetch: fetchImpl }));`. Then:

```ts
const ATTACHED = {
  id: 'a-1',
  filename: 'TrendFilter.mq5',
  sourceCode: '#property indicator_chart_window',
  createdAt: '2026-08-21T09:05:00.000Z',
};

describe('add_draft_attachment', () => {
  test('POSTs to the attachments sub-resource with an idempotency key', async () => {
    const { calls, fetchImpl } = stub(201, ATTACHED);
    const client = await connect(fetchImpl);

    await client.callTool({
      name: 'add_draft_attachment',
      arguments: { draftId: 'd-1', filename: 'TrendFilter.mq5', sourceCode: '#property x' },
    });

    expect(calls[0]?.url).toBe('https://be-dev.sentitrade.xyz/api/v1/drafts/d-1/attachments');
    expect(calls[0]?.init.method).toBe('POST');
    expect((calls[0]?.init.headers as Record<string, string>)['idempotency-key']).toMatch(
      /^[0-9a-f]{32}$/,
    );
  });

  test('tells the model how to wire the indicator into the EA', async () => {
    const { fetchImpl } = stub(201, ATTACHED);
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'add_draft_attachment',
      arguments: { draftId: 'd-1', filename: 'TrendFilter.mq5', sourceCode: '#property x' },
    })) as ToolResult;

    expect(result.content[0]?.text).toContain('#resource "TrendFilter.ex5"');
    expect(result.content[0]?.text).toContain('iCustom');
  });

  test('reports a filename collision as case-insensitive', async () => {
    const { fetchImpl } = stub(409, { error: { code: 'CONFLICT', message: 'Exists.' } });
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'add_draft_attachment',
      arguments: { draftId: 'd-1', filename: 'myind.mq5', sourceCode: '#property x' },
    })) as ToolResult;

    expect(result.content[0]?.text).toContain('case-insensitively');
  });

  test('reports a 422 as a filename or size problem, not a missing draft', async () => {
    const { fetchImpl } = stub(422, { error: { code: 'INVALID_BODY', message: 'Bad name.' } });
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'add_draft_attachment',
      arguments: { draftId: 'd-1', filename: 'sub/dir.mq5', sourceCode: '#property x' },
    })) as ToolResult;

    expect(result.content[0]?.text).toContain('bare');
  });

  test('reports a full attachment cap as something a retry will not fix', async () => {
    const { fetchImpl } = stub(403, { error: { code: 'FORBIDDEN', message: 'Cap.' } });
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'add_draft_attachment',
      arguments: { draftId: 'd-1', filename: 'A.mq5', sourceCode: '#property x' },
    })) as ToolResult;

    expect(result.content[0]?.text).toContain('delete_draft_attachment');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/tools/authoring/add-draft-attachment.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement `src/tools/authoring/add-draft-attachment.ts`**

```ts
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import {
  ATTACHMENT_CAP_OR_SCOPE,
  ATTACHMENT_FILENAME_TAKEN,
  DRAFT_NOT_FOUND,
  draftPath,
  idempotencyKeyFor,
  type SentiClient,
} from '../../core/client.js';
import { registerWriteTool } from '../../core/tool.js';
import {
  AttachmentWriteOutputSchema,
  formatAttachmentWrite,
  parseWrittenAttachment,
  shapeAttachmentWrite,
} from './write-result.js';

const AUTHORING_WRITE = 'authoring:write';

const BAD_ATTACHMENT =
  'The filename must be a bare Windows-safe basename ending in `.mq5` — no folders, no path ' +
  'separators, no `.ex5` — or the source exceeds the platform cap for one attachment (see ' +
  '`limits.maxAttachmentBytes` from get_authoring_conventions).';

const InputSchema = z.object({
  draftId: z.string(),
  filename: z.string().min(1),
  sourceCode: z.string(),
});

export function registerAddDraftAttachment(server: McpServer, client: SentiClient): void {
  registerWriteTool(server, {
    name: 'add_draft_attachment',
    title: 'Attach an indicator to a draft',
    description:
      'Attach one MQL5 indicator source file to a draft, so the EA can embed it. `filename` ' +
      'must be a bare basename ending in `.mq5` — no folders, no path separators, no `.ex5` ' +
      '— and is unique within the draft CASE-INSENSITIVELY, so "MyInd.mq5" collides with ' +
      '"myind.mq5". Attaching a file does NOT wire it up: the EA must reference it with ' +
      '`#resource "<stem>.ex5"` and `iCustom(_Symbol, _Period, "::<stem>.ex5", …)`, which ' +
      'means an update_draft on the EA source afterwards. The platform caps how many ' +
      'attachments one draft may hold and how large each may be — see ' +
      'get_authoring_conventions. The response does NOT echo your source back.',
    inputSchema: InputSchema,
    outputSchema: AttachmentWriteOutputSchema,
    destructive: false,
    idempotent: false,
    run: async (args, signal) => {
      const path = draftPath(args.draftId, 'attachments');
      const body = { filename: args.filename, sourceCode: args.sourceCode };

      const payload = await client.send('POST', path, {
        signal,
        body,
        idempotencyKey: idempotencyKeyFor('POST', path, body),
        scope: AUTHORING_WRITE,
        forbiddenMeans: ATTACHMENT_CAP_OR_SCOPE,
        notFoundMeans: DRAFT_NOT_FOUND,
        conflictMeans: ATTACHMENT_FILENAME_TAKEN,
        unprocessableMeans: BAD_ATTACHMENT,
      });
      const shaped = shapeAttachmentWrite(parseWrittenAttachment(payload, 'created attachment'));

      return {
        text: formatAttachmentWrite(shaped, 'attached to', args.draftId),
        structured: shaped,
      };
    },
  });
}
```

- [ ] **Step 4: Register and run**

Add `registerAddDraftAttachment(server, client);` to `src/server.ts` and
`add_draft_attachment: { destructive: false, idempotent: false }` to `WRITE_TOOL_ANNOTATIONS`.

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/authoring/add-draft-attachment.ts src/tools/authoring/add-draft-attachment.test.ts src/server.ts src/server.test.ts
git commit -m "feat(authoring): add_draft_attachment

Attaching does not wire up: the text says which #resource and iCustom
lines the EA still needs, because a draft that compiles to nothing reads
as a success otherwise."
```

---

### Task 11: `update_draft_attachment`

**Files:**
- Create: `src/tools/authoring/update-draft-attachment.ts`
- Test: `src/tools/authoring/update-draft-attachment.test.ts`
- Modify: `src/server.ts`, `src/server.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 2, 4, 5.
- Produces: `registerUpdateDraftAttachment(server, client)`.

- [ ] **Step 1: Write the failing test**

`src/tools/authoring/update-draft-attachment.test.ts` opens with **HARNESS A** copied verbatim,
with the marked line changed to
`registerUpdateDraftAttachment(server, createClient(config, { fetch: fetchImpl }));`, and reuses
Task 10's `ATTACHED` fixture. Then:

```ts
describe('update_draft_attachment', () => {
  test('PUTs only the source to the attachment path', async () => {
    const { calls, fetchImpl } = stub(200, ATTACHED);
    const client = await connect(fetchImpl);

    await client.callTool({
      name: 'update_draft_attachment',
      arguments: { draftId: 'd-1', attachmentId: 'a-1', sourceCode: '#property y' },
    });

    expect(calls[0]?.url).toBe(
      'https://be-dev.sentitrade.xyz/api/v1/drafts/d-1/attachments/a-1',
    );
    expect(calls[0]?.init.method).toBe('PUT');
    expect(calls[0]?.init.body).toBe(JSON.stringify({ sourceCode: '#property y' }));
  });

  test('takes no filename, because the API forbids the rename', async () => {
    const client = await connect(stub(200, ATTACHED).fetchImpl);

    const { tools } = await client.listTools();
    const tool = tools.find((candidate) => candidate.name === 'update_draft_attachment');

    expect(Object.keys(tool?.inputSchema?.properties ?? {})).toEqual([
      'draftId',
      'attachmentId',
      'sourceCode',
    ]);
  });

  test('reports a 404 as possibly the wrong draft, which the draft 404 does not cover', async () => {
    const { fetchImpl } = stub(404, { error: { code: 'NOT_FOUND', message: 'No attachment.' } });
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'update_draft_attachment',
      arguments: { draftId: 'd-1', attachmentId: 'a-9', sourceCode: '#property y' },
    })) as ToolResult;

    expect(result.content[0]?.text).toContain('belongs to a different draft');
  });

  test('rejects a traversal attachmentId before a request is made', async () => {
    const { calls, fetchImpl } = stub(200, ATTACHED);
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'update_draft_attachment',
      arguments: { draftId: 'd-1', attachmentId: '../../admin', sourceCode: '#property y' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(calls).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/tools/authoring/update-draft-attachment.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement `src/tools/authoring/update-draft-attachment.ts`**

```ts
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import {
  ATTACHMENT_NOT_FOUND,
  AUTHORING_WRITE_SCOPE,
  draftPath,
  type SentiClient,
} from '../../core/client.js';
import { registerWriteTool } from '../../core/tool.js';
import {
  AttachmentWriteOutputSchema,
  formatAttachmentWrite,
  parseWrittenAttachment,
  shapeAttachmentWrite,
} from './write-result.js';

const AUTHORING_WRITE = 'authoring:write';

const OVERSIZED_ATTACHMENT =
  'The source exceeds the platform cap for one attachment — see ' +
  '`limits.maxAttachmentBytes` from get_authoring_conventions.';

const InputSchema = z.object({
  draftId: z.string(),
  attachmentId: z.string(),
  sourceCode: z.string(),
});

export function registerUpdateDraftAttachment(server: McpServer, client: SentiClient): void {
  registerWriteTool(server, {
    name: 'update_draft_attachment',
    title: 'Replace an indicator body',
    description:
      "Replace one attached indicator's source. THE FILENAME CANNOT BE CHANGED and this tool " +
      'takes no filename: the EA embeds an indicator by name via `#resource`, so a rename ' +
      'would orphan every reference and turn a working draft into a static-safety violation. ' +
      'To rename, call delete_draft_attachment and add_draft_attachment, and update the EA ' +
      "source too. This is a full replace of that file's contents. `attachmentId` is the " +
      '`id` from list_draft_attachments. The response does NOT echo your source back.',
    inputSchema: InputSchema,
    outputSchema: AttachmentWriteOutputSchema,
    destructive: true,
    idempotent: true,
    run: async (args, signal) => {
      const payload = await client.send(
        'PUT',
        draftPath(args.draftId, 'attachments', args.attachmentId),
        {
          signal,
          body: { sourceCode: args.sourceCode },
          scope: AUTHORING_WRITE,
          forbiddenMeans: AUTHORING_WRITE_SCOPE,
          notFoundMeans: ATTACHMENT_NOT_FOUND,
          unprocessableMeans: OVERSIZED_ATTACHMENT,
        },
      );
      const shaped = shapeAttachmentWrite(parseWrittenAttachment(payload, 'updated attachment'));

      return {
        text: formatAttachmentWrite(shaped, 'replaced on', args.draftId),
        structured: shaped,
      };
    },
  });
}
```

- [ ] **Step 4: Register and run**

Add `registerUpdateDraftAttachment(server, client);` to `src/server.ts` and
`update_draft_attachment: { destructive: true, idempotent: true }` to `WRITE_TOOL_ANNOTATIONS`.

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/authoring/update-draft-attachment.ts src/tools/authoring/update-draft-attachment.test.ts src/server.ts src/server.test.ts
git commit -m "feat(authoring): update_draft_attachment

Takes no filename. Accepting one the API would ignore is worse than not
accepting one."
```

---

### Task 12: `delete_draft_attachment`, and the `2.7.0` release

Closes **US-8.3**.

**Files:**
- Create: `src/tools/authoring/delete-draft-attachment.ts`
- Test: `src/tools/authoring/delete-draft-attachment.test.ts`
- Modify: `src/server.ts`, `src/server.test.ts`, `src/config.ts`, `VERSION`, `package.json`,
  `package-lock.json`, `docs/CHANGELOG.md`, `README.md`, `AGENTS.md`,
  `docs/sprints/stories/US-8.3-*.md`

**Interfaces:**
- Consumes: Tasks 1, 2, 5, 7.
- Produces: `registerDeleteDraftAttachment(server, client)`.

- [ ] **Step 1: Write the failing test**

`src/tools/authoring/delete-draft-attachment.test.ts` opens with **HARNESS B** copied verbatim,
with the marked line changed to
`registerDeleteDraftAttachment(server, createClient(config, { fetch: fetchImpl }));`. Then:

```ts
describe('delete_draft_attachment', () => {
  test('sends nothing until the confirmation is accepted', async () => {
    const { calls, fetchImpl } = stub(200, { id: 'a-1' });
    const { client } = await connectAnswering(fetchImpl, { action: 'decline' });

    const result = (await client.callTool({
      name: 'delete_draft_attachment',
      arguments: { draftId: 'd-1', attachmentId: 'a-1' },
    })) as ToolResult;

    expect(calls).toHaveLength(0);
    expect(result.structuredContent).toMatchObject({ id: null, deleted: false });
  });

  test('DELETEs the attachment path once when accepted', async () => {
    const { calls, fetchImpl } = stub(200, { id: 'a-1' });
    const { client } = await connectAnswering(fetchImpl, {
      action: 'accept',
      content: { confirm: true },
    });

    const result = (await client.callTool({
      name: 'delete_draft_attachment',
      arguments: { draftId: 'd-1', attachmentId: 'a-1' },
    })) as ToolResult;

    expect(calls).toHaveLength(1);
    expect(calls[0]?.init.method).toBe('DELETE');
    expect(calls[0]?.url).toBe(
      'https://be-dev.sentitrade.xyz/api/v1/drafts/d-1/attachments/a-1',
    );
    expect(result.structuredContent).toEqual({ id: 'a-1', deleted: true, notes: [] });
  });

  test('warns that the EA still references the file it just removed', async () => {
    const { fetchImpl } = stub(200, { id: 'a-1' });
    const { client } = await connectAnswering(fetchImpl, {
      action: 'accept',
      content: { confirm: true },
    });

    const result = (await client.callTool({
      name: 'delete_draft_attachment',
      arguments: { draftId: 'd-1', attachmentId: 'a-1' },
    })) as ToolResult;

    expect(result.content[0]?.text).toContain('#resource');
    expect(result.content[0]?.text).toContain('update_draft');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/tools/authoring/delete-draft-attachment.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement `src/tools/authoring/delete-draft-attachment.ts`**

```ts
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import {
  ATTACHMENT_NOT_FOUND,
  AUTHORING_WRITE_SCOPE,
  draftPath,
  type SentiClient,
} from '../../core/client.js';
import { registerWriteTool } from '../../core/tool.js';
import { cancelledDelete, DeleteOutputSchema, formatDeleted, parseDeleted } from './write-result.js';

const AUTHORING_WRITE = 'authoring:write';

const InputSchema = z.object({ draftId: z.string(), attachmentId: z.string() });

export function registerDeleteDraftAttachment(server: McpServer, client: SentiClient): void {
  registerWriteTool(server, {
    name: 'delete_draft_attachment',
    title: 'Delete an indicator attachment',
    description:
      'Remove one indicator file from a draft. THIS CANNOT BE UNDONE and the user is asked ' +
      'to confirm before anything is sent. AFTERWARDS THE EA STILL REFERENCES IT: remove the ' +
      "file's `#resource` and `iCustom` lines from the draft source with update_draft, or " +
      'the next compile_draft fails. Use this to free a slot when add_draft_attachment ' +
      'reports the attachment cap is full, and to rename a file, which the API allows no ' +
      'other way. `attachmentId` is the `id` from list_draft_attachments.',
    inputSchema: InputSchema,
    outputSchema: DeleteOutputSchema,
    destructive: true,
    idempotent: true,
    confirm: {
      message: (args) =>
        `Delete indicator ${args.attachmentId} from draft ${args.draftId}? This cannot be undone.`,
      cancelled: (args) => cancelledDelete(`Indicator ${args.attachmentId}`),
    },
    run: async (args, signal) => {
      const payload = await client.send(
        'DELETE',
        draftPath(args.draftId, 'attachments', args.attachmentId),
        {
          signal,
          scope: AUTHORING_WRITE,
          forbiddenMeans: AUTHORING_WRITE_SCOPE,
          notFoundMeans: ATTACHMENT_NOT_FOUND,
        },
      );
      const result = parseDeleted(payload, 'deleted attachment');

      return {
        text:
          `${formatDeleted(result, `Indicator ${args.attachmentId}`)}\n\n` +
          'The EA source has not changed. Remove this file\'s `#resource` and `iCustom` ' +
          'lines with update_draft before calling compile_draft, or the compile will fail ' +
          'on a reference to a file that is no longer there.',
        structured: result,
      };
    },
  });
}
```

- [ ] **Step 4: Register and run the suite**

Add `registerDeleteDraftAttachment(server, client);` to `src/server.ts` and
`delete_draft_attachment: { destructive: true, idempotent: true }` to `WRITE_TOOL_ANNOTATIONS`.

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 5: Bump to `2.7.0` and write the docs**

`VERSION`, `package.json`, `SERVER_VERSION`, then `npm install --package-lock-only`.

- `docs/CHANGELOG.md` — `## [2.7.0] — 2026-08-21 — the three attachment writes`. State the
  case-insensitive filename collision and why (one flat Windows directory on the compile host);
  state that a rename is delete-then-add by design; state that removing an attachment leaves the
  EA referencing it, and that the tool says so.
- `README.md` — three rows.
- `AGENTS.md` — 17 → 20 tools; the three new files.
- `docs/sprints/stories/US-8.3-*.md` — `status: done`, `version_shipped: 2.7.0`, tasks `[x]`.
- `npm run agile:status`

- [ ] **Step 6: Run the release gate**

Run: `npm run release:check && npm run release:verify-pack`
Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(authoring): the three attachment writes (2.7.0)

Filenames collide case-insensitively because the compile host writes them
into one flat Windows directory, and a rename is delete-then-add because
an EA embeds an indicator by name.

Closes US-8.3."
```

---

### Task 13: `compile_draft`

**Files:**
- Create: `src/tools/authoring/compile-draft.ts`
- Test: `src/tools/authoring/compile-draft.test.ts`
- Modify: `src/server.ts`, `src/server.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 2, 4; `DiagnosticSchema` from `./get-draft.js`.
- Produces: `registerCompileDraft(server, client)`, `CompileResultSchema`,
  `formatCompile(result, draftId)`, `compileAbortHint(error, draftId)`.

- [ ] **Step 1: Write the failing test**

`src/tools/authoring/compile-draft.test.ts` opens with **HARNESS A** copied verbatim, with the
marked line changed to `registerCompileDraft(server, createClient(config, { fetch: fetchImpl }));`,
and imports `compileAbortHint` and `DiagnosticSchema`. Then:

```ts
const FAILED = {
  ok: false,
  errors: 1,
  warnings: 0,
  diagnostics: [
    {
      severity: 'error',
      file: 'GoldScalper.mq5',
      line: 42,
      column: 7,
      code: 'E123',
      message: 'undeclared identifier',
    },
  ],
  log: 'GoldScalper.mq5(42,7) : error E123: undeclared identifier',
  logTruncated: false,
};

const PASSED = { ok: true, errors: 0, warnings: 2, diagnostics: [], log: '0 errors', logTruncated: false };

describe('compile_draft', () => {
  test('POSTs to the compile sub-resource with no body and no idempotency key', async () => {
    const { calls, fetchImpl } = stub(200, PASSED);
    const client = await connect(fetchImpl);

    await client.callTool({ name: 'compile_draft', arguments: { draftId: 'd-1' } });

    expect(calls[0]?.url).toBe('https://be-dev.sentitrade.xyz/api/v1/drafts/d-1/compile');
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.body).toBeUndefined();
    expect((calls[0]?.init.headers as Record<string, string>)['idempotency-key']).toBeUndefined();
  });

  test('a failed build is a SUCCESS result, not an error', async () => {
    const { fetchImpl } = stub(200, FAILED);
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'compile_draft',
      arguments: { draftId: 'd-1' },
    })) as ToolResult;

    expect(result.isError).toBeFalsy();
    expect(result.content[0]?.text).toContain('Compile FAILED');
    expect(result.structuredContent).toMatchObject({ ok: false, errors: 1 });
  });

  test('renders every diagnostic with its position', async () => {
    const { fetchImpl } = stub(200, FAILED);
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'compile_draft',
      arguments: { draftId: 'd-1' },
    })) as ToolResult;

    expect(result.content[0]?.text).toContain('GoldScalper.mq5:42:7');
    expect(result.content[0]?.text).toContain('undeclared identifier');
  });

  test('rejects a diagnostic of an unexpected shape rather than rendering it wrong', async () => {
    const { fetchImpl } = stub(200, { ...FAILED, diagnostics: [{ unexpected: true }] });
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'compile_draft',
      arguments: { draftId: 'd-1' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('compile result');
  });

  test('reports a 409 as the one-per-account compile slot', async () => {
    const { fetchImpl } = stub(409, { error: { code: 'CONFLICT', message: 'Busy.' } });
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'compile_draft',
      arguments: { draftId: 'd-1' },
    })) as ToolResult;

    expect(result.content[0]?.text).toContain('one per account');
  });

  test('reports a 503 Retry-After without waiting and without retrying', async () => {
    const calls: unknown[] = [];
    const fetchImpl = (async () => {
      calls.push(1);
      return new Response(JSON.stringify({ error: { code: 'UNAVAILABLE', message: 'Busy.' } }), {
        status: 503,
        headers: { 'content-type': 'application/json', 'retry-after': '9' },
      });
    }) as unknown as typeof fetch;
    const client = await connect(fetchImpl);

    const result = (await client.callTool({
      name: 'compile_draft',
      arguments: { draftId: 'd-1' },
    })) as ToolResult;

    expect(calls).toHaveLength(1);
    expect(result.content[0]?.text).toContain('9 second');
  });
});

describe('compileAbortHint', () => {
  test('rewrites a timeout to say the compile is still running', () => {
    const timeout = new DOMException('The operation was aborted.', 'TimeoutError');

    const rewritten = compileAbortHint(timeout, 'd-1') as Error;

    expect(rewritten.message).toContain('does not cancel');
    expect(rewritten.message).toContain('get_draft');
    expect(rewritten.message).toContain('d-1');
    expect(rewritten.cause).toBe(timeout);
  });

  test('leaves every other error exactly as it was', () => {
    const other = new Error('boom');

    expect(compileAbortHint(other, 'd-1')).toBe(other);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/tools/authoring/compile-draft.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement `src/tools/authoring/compile-draft.ts`**

```ts
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import {
  AUTHORING_WRITE_SCOPE,
  COMPILE_SLOT_BUSY,
  COMPILE_UPSTREAM,
  DRAFT_NOT_FOUND,
  draftPath,
  type SentiClient,
} from '../../core/client.js';
import { parseOrThrow } from '../../core/parse.js';
import { registerWriteTool } from '../../core/tool.js';
import { DiagnosticSchema } from './get-draft.js';

const AUTHORING_WRITE = 'authoring:write';

/**
 * The one place the API types a diagnostic. `get_draft` and `list_drafts`
 * parse theirs loosely because their GET paths declare it untyped; this route
 * declares the shape, so nothing here guesses.
 */
export const CompileResultSchema = z.object({
  ok: z.boolean(),
  errors: z.number(),
  warnings: z.number(),
  diagnostics: z.array(DiagnosticSchema),
  log: z.string(),
  logTruncated: z.boolean(),
});

export type CompileResult = z.infer<typeof CompileResultSchema>;

const COMPILE_REJECTED =
  'The compile server rejected the request — most often a duplicate attachment filename ' +
  'or a source size over the platform cap. See get_authoring_conventions.';

export function parseCompile(payload: unknown): CompileResult {
  return parseOrThrow(CompileResultSchema, payload, 'compile result');
}

/**
 * Aborting the fetch does not cancel the compile. The account's slot stays
 * busy, so the next call is a 409 — and a model told only "aborted" retries
 * straight into it.
 */
export function compileAbortHint(error: unknown, draftId: string): unknown {
  const name = error instanceof Error ? error.name : '';
  if (name !== 'TimeoutError' && name !== 'AbortError') return error;

  return new Error(
    'The compile request was aborted after 15 seconds. That does not cancel the compile on ' +
      "the server: this account's compile slot may still be busy, so calling compile_draft " +
      `again would return 409. Call get_draft with draftId "${draftId}" and read ` +
      'lastCompileStatus to find out how it finished.',
    { cause: error },
  );
}

export function formatCompile(result: CompileResult, draftId: string): string {
  const verdict = result.ok
    ? `Compile SUCCEEDED — 0 errors, ${result.warnings} warning(s).`
    : `Compile FAILED — ${result.errors} error(s), ${result.warnings} warning(s).`;

  const diagnostics =
    result.diagnostics.length === 0
      ? ''
      : `\n\nDiagnostics (${result.diagnostics.length}):\n${result.diagnostics
          .map(
            (entry) =>
              `- ${entry.severity} ${entry.code} at ${entry.file}:${entry.line}:${entry.column}` +
              ` — ${entry.message}`,
          )
          .join('\n')}`;

  const log =
    result.log.trim().length === 0
      ? ''
      : `\n\nCompiler log${result.logTruncated ? ' (truncated — this is the tail only)' : ''}:` +
        `\n${result.log}`;

  const next = result.ok
    ? `\n\nDraft ${draftId} builds. Registering it as a private EA is not available through ` +
      'this server.'
    : `\n\nFix the source and call update_draft — a FULL REPLACE of draft ${draftId} — then ` +
      'compile again.';

  return `${verdict}${diagnostics}${log}${next}`;
}

export function registerCompileDraft(server: McpServer, client: SentiClient): void {
  registerWriteTool(server, {
    name: 'compile_draft',
    title: 'Compile a draft',
    description:
      'Run the static-safety scan and the MQL5 compiler over a draft and every indicator ' +
      'attached to it, and return the verdict, the diagnostics and the compiler log. This is ' +
      'a CHECK ONLY — it does not register or deploy anything. A FAILED BUILD IS NOT AN ' +
      'ERROR: the tool succeeds and reports `ok: false` with diagnostics, so read the result ' +
      'rather than retrying. The compile slot is ONE PER ACCOUNT and the compile server is ' +
      'globally serial, so a second concurrent call returns 409 and contention returns 503 ' +
      'with a wait — this server never retries either on your behalf. A typical compile takes ' +
      'about a second. Call get_authoring_conventions before writing source, not after ' +
      'failing here.',
    inputSchema: z.object({ draftId: z.string() }),
    outputSchema: CompileResultSchema,
    destructive: false,
    idempotent: true,
    run: async (args, signal) => {
      let payload: unknown;

      try {
        payload = await client.send('POST', draftPath(args.draftId, 'compile'), {
          signal,
          scope: AUTHORING_WRITE,
          forbiddenMeans: AUTHORING_WRITE_SCOPE,
          notFoundMeans: DRAFT_NOT_FOUND,
          conflictMeans: COMPILE_SLOT_BUSY,
          unprocessableMeans: COMPILE_REJECTED,
          upstreamMeans: COMPILE_UPSTREAM,
        });
      } catch (error) {
        throw compileAbortHint(error, args.draftId);
      }

      const result = parseCompile(payload);

      return { text: formatCompile(result, args.draftId), structured: result };
    },
  });
}
```

- [ ] **Step 4: Register and run**

Add `registerCompileDraft(server, client);` to `src/server.ts` and
`compile_draft: { destructive: false, idempotent: true }` to `WRITE_TOOL_ANNOTATIONS`.

Run: `npm run typecheck && npm test`
Expected: PASS, and the opt-in test now expects `14 + 7 = 21` tools.

- [ ] **Step 5: Commit**

```bash
git add src/tools/authoring/compile-draft.ts src/tools/authoring/compile-draft.test.ts src/server.ts src/server.test.ts
git commit -m "feat(authoring): compile_draft

A failed build returns 200 with ok: false and is reported as a success —
marking it isError invites a retry against a globally serial slot for a
build that will fail identically. The 15s abort does not cancel the
compile, and the message says so."
```

---

### Task 14: The write smoke test, EPIC-8's close, and the `2.8.0` release

Closes **US-8.4** and **EPIC-8**.

**Files:**
- Modify: `src/smoke.test.ts`, `.env.example`, `docs/SETUP.md`, `src/config.ts`, `VERSION`,
  `package.json`, `package-lock.json`, `docs/CHANGELOG.md`, `README.md`, `AGENTS.md`,
  `docs/sprints/epics/EPIC-8.md`, `docs/sprints/stories/US-8.4-*.md`, `docs/LESSONS.md`

**Interfaces:**
- Consumes: every tool module from Tasks 6, 8, 9, 10, 11, 12, 13.
- Produces: nothing further; this task closes the epic.

- [ ] **Step 1: Add the write smoke test to `src/smoke.test.ts`**

Gated by a **second** variable so that running the read smoke never creates anything:

```ts
/**
 * Opt-in twice: a real key, and an explicit acknowledgement that this test
 * creates and deletes a real draft against a real account.
 */
const writeSmoke = process.env.SENTI_SMOKE_WRITES === '1';

describe.skipIf(!smokeKey || !writeSmoke)('smoke: live Senti authoring write path', () => {
  test('creates, attaches, compiles and deletes a real draft', async () => {
    const config = loadConfig({
      SENTI_API_KEY: smokeKey,
      SENTI_API_BASE_URL: process.env.SENTI_API_BASE_URL ?? 'https://be-dev.sentitrade.xyz',
      SENTI_ENABLE_AUTHORING_WRITE: '1',
    });
    const client = createClient(config);

    // A name no human would pick, so a leaked draft is identifiable as this
    // test's. The suffix is the epoch so two runs never collide on the
    // unique-name 409.
    const name = `senti-mcp-smoke-${Date.now()}`;
    const source = '#property strict\nint OnInit(){return(INIT_SUCCEEDED);}\nvoid OnTick(){}\n';

    const created = shapeDraftWrite(
      parseWrittenDraft(
        await client.send('POST', '/api/v1/drafts', {
          body: { name, sourceCode: source },
          idempotencyKey: idempotencyKeyFor('POST', '/api/v1/drafts', {
            name,
            sourceCode: source,
          }),
          scope: 'authoring:write',
        }),
        'created draft',
      ),
    );

    try {
      expect(created.sourceBytes).toBe(Buffer.byteLength(source, 'utf8'));
      expect(formatDraftWrite(created, 'created')).toContain(created.id);

      const attachPath = draftPath(created.id, 'attachments');
      const attachBody = {
        filename: 'SmokeInd.mq5',
        sourceCode: '#property indicator_chart_window\n',
      };
      const attached = shapeAttachmentWrite(
        parseWrittenAttachment(
          await client.send('POST', attachPath, {
            body: attachBody,
            idempotencyKey: idempotencyKeyFor('POST', attachPath, attachBody),
            scope: 'authoring:write',
          }),
          'created attachment',
        ),
      );

      // EPIC-7 closed with every attachment branch test-covered and none
      // live-covered, because the smoke account held zero attachments and
      // creating one needed a write. This is that gap closing.
      expect(attached.filename).toBe('SmokeInd.mq5');
      const listed = parseAttachments(
        await client.get(attachPath, { scope: 'authoring:read' }),
      );
      expect(listed.map((entry) => entry.filename)).toContain('SmokeInd.mq5');

      const compiled = parseCompile(
        await client.send('POST', draftPath(created.id, 'compile'), {
          scope: 'authoring:write',
          conflictMeans: 'compile slot busy',
        }),
      );

      // A red build is a legitimate outcome of this leg — the assertion is
      // that the contract parses and renders, not that the EA is good.
      expect(typeof compiled.ok).toBe('boolean');
      expect(formatCompile(compiled, created.id).length).toBeGreaterThan(0);
      console.error(
        `[smoke] compile ok=${compiled.ok} errors=${compiled.errors} ` +
          `warnings=${compiled.warnings} diagnostics=${compiled.diagnostics.length}`,
      );

      // The second EPIC-7 gap: no diagnostic object had ever been observed
      // live, so the strict schema had never met real data.
      for (const entry of compiled.diagnostics) {
        expect(DiagnosticSchema.safeParse(entry).success).toBe(true);
      }
    } finally {
      // Runs even when an assertion above fails: a leaked draft counts against
      // the account's cap and the next run's unique-name check.
      const deleted = parseDeleted(
        await client.send('DELETE', draftPath(created.id), { scope: 'authoring:write' }),
        'deleted draft',
      );
      expect(deleted.id).toBe(created.id);
    }
  }, 120_000);
});
```

Extend `src/smoke.test.ts`'s imports with `idempotencyKeyFor` from `./core/client.js`, and the
`write-result.js` and `compile-draft.js` helpers used above.

- [ ] **Step 2: Run the write smoke test against the live service**

```bash
# .env.local must hold SENTI_SMOKE_KEY with authoring:read AND authoring:write
SENTI_SMOKE_WRITES=1 npm run test:smoke
```
Expected: PASS. Record the observed `compile ok/errors/warnings/diagnostics` line in US-8.4's
`## Implementation notes` — it is the first live diagnostic this repo has ever seen.

If the key lacks `authoring:write`, the run fails with a 403 naming the scope; that is the
expected failure, not a code defect. Mint a key with the scope and re-run.

- [ ] **Step 3: Document the second smoke variable**

`SENTI_SMOKE_WRITES` goes into `.env.example` **and** `docs/SETUP.md` in this commit (RULE-11),
stating plainly that setting it makes `npm run test:smoke` create and delete a real draft on the
account the key belongs to.

- [ ] **Step 4: Run the full suite and typecheck**

Run: `npm run typecheck && npm test`
Expected: PASS with **2 skipped** — both smoke suites opt out without their variables.

- [ ] **Step 5: Bump to `2.8.0` and write the docs**

`VERSION`, `package.json`, `SERVER_VERSION`, then `npm install --package-lock-only`.

- `docs/CHANGELOG.md` — `## [2.8.0] — 2026-08-21 — compile_draft, and EPIC-8's close`. State
  that a failed build is a success result; that nothing retries and `Retry-After` is reported;
  that the 15 s abort does not cancel the compile. **State what the epic does not cover**:
  `register` is unimplemented, so the loop ends at a green build, and a host without elicitation
  support cannot use the two delete tools.
- `README.md` — the `compile_draft` row; a worked example of the full loop
  (`get_authoring_conventions` → `create_draft` → `compile_draft` → `update_draft` →
  `compile_draft`).
- `AGENTS.md` — 20 → 21 tools; `compile-draft.ts` in §Repo structure; a line in §The read/write
  split recording that the authoring write path is open behind its flag and that the trading
  write path is not.
- `docs/sprints/epics/EPIC-8.md` — `status: done`, `updated: 2026-08-21`, and a §What this
  epic's `done` does not claim section: `register` deferred with its real reason; the two delete
  tools unusable without elicitation support; the idempotency retention window as measured.
- `docs/sprints/stories/US-8.4-*.md` — `status: done`, `version_shipped: 2.8.0`, tasks `[x]`,
  and the live compile observation in `## Implementation notes`.
- `docs/LESSONS.md` — one append-only entry if the live compile contradicted the transcribed
  diagnostic schema, or if the idempotency retention window forced the fallback in
  spec §Open questions 1.
- `npm run agile:status && npm run agile:validate`

- [ ] **Step 6: Run the release gate**

Run: `npm run release:check && npm run release:verify-pack`
Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(authoring): compile_draft, and EPIC-8's close (2.8.0)

Seven write tools now sit behind SENTI_ENABLE_AUTHORING_WRITE, and the
write smoke test discharges the two gaps EPIC-7 closed with: no FAILED
draft and no attachment had ever been observed live, because both needed
a write.

Closes US-8.4 and EPIC-8."
```

---

## What this plan does not cover

Stated so a reader finds it rather than discovers it:

- **`register`.** Spec §Scope. The loop ends at a green build; turning one into a private EA
  needs its own story, because no operation in the `Authoring` tag can delete what it creates.
- **The seven trading writes.** [EPIC-3](../../sprints/epics/EPIC-3.md)'s, behind a flag that
  does not exist yet.
- **Any retry, backoff, or polling loop.** Spec §Retry policy.
- **A raised timeout for `compile_draft`.** The shared 15 s stands; Task 13 makes the abort
  message actionable instead.
- **Response caching**, including for `conventions` — unchanged from the read spec's §Scope.
