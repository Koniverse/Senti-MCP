# Senti read-tool expansion — sprint W33 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `src/` into `core/` + `tools/<tag>/`, add the substrate every remaining read tool needs (`query`, `accountPath`, `404`/`409` branches, `registerReadTool`), then ship the first five of the nine unshipped read tools.

**Architecture:** `core/` owns HTTP, errors, and tool registration and imports nothing from `tools/`. Each endpoint gets one file under `tools/<tag>/` exporting exactly `XSchema`, `parseX`, `formatX`, `registerX`. `server.ts` becomes wiring: build a client, call the `register*` functions. Every tool is registered through `registerReadTool`, which owns the `try`/`catch` and pins `readOnlyHint: true` as a constant.

**Tech Stack:** TypeScript 5.7 (NodeNext), Zod v4 (`import * as z from 'zod/v4'`), `@modelcontextprotocol/server` 2.0, Vitest 3.

**Scope:** sprint W33 = US-2.4 → US-2.9. The four W34 stories (`get_account_performance`, `list_deals`, `get_performance_breakdowns`, `get_equity_timeseries`) get their own plan once US-2.4 has locked the shape they copy.

**Source spec:** [2026-08-05-senti-read-tools-expansion-design.md](../specs/2026-08-05-senti-read-tools-expansion-design.md)

## Global Constraints

- **English only** in code, comments, error messages, commits, and docs (RULE-13).
- **Commit prefixes** (RULE-14): `feat:` `fix:` `chore:` `docs:` `style:` `refactor:` `test:`.
- **Every code-shipping commit updates docs in the same commit** (RULE-1). In practice: tick the story's task checkbox in the same commit that lands the code (RULE-10).
- **The version string lives in three places** — `VERSION`, `package.json`, and `SERVER_VERSION` in `src/config.ts`. `config.test.ts` fails the suite if they drift.
- **Zod is imported as `import * as z from 'zod/v4'`**; relative imports carry `.js` extensions (NodeNext).
- **`src/index.ts` must stay at the root of `src/`.** `bin` is `dist/index.js` and `rootDir` is `src`; moving it breaks `bin` and `index.test.ts`.
- **Nothing writes to stdout.** That stream carries JSON-RPC frames; diagnostics go to stderr.
- **The API key never becomes a tool parameter and never appears in returned text**, including every error branch.
- **Every path parameter goes through `accountPath`**, which validates then `encodeURIComponent`s. No tool concatenates a path.
- **Null is not zero.** A null number renders `—`. For MT5 `sl`/`tp`/`priceStopLimit`, `0` means "not set" and also renders `—`.
- **`core/` never imports from `tools/`.** One-way edge.
- **Node ≥ 20.6.0** (`AbortSignal.any`, `node --env-file`).

## Verified before planning

These were checked against the running system, not assumed:

- `registerReadTool`'s exact signature **compiles and round-trips**. A prototype was registered against a real `McpServer`, called over `InMemoryTransport` with a non-empty `inputSchema`, and asserted for typed args, `annotations.readOnlyHint`, `structuredContent`, and the error path (`isError: true`, no `structuredContent`, session survives). `npx tsc --noEmit` exits 0 with the signature in Task 6.
- `tsconfig.json` globs recursively (`src/**/*.ts`, exclude `src/**/*.test.ts`) and `package.json`'s `files` matches — **subdirectories need no build-config change**.
- The API declares **`409` = terminal offline** on `positions` and `orders`: *"The account terminal is offline — positions are temporarily unavailable."* The "terminal state is not emptiness" invariant is therefore a status-code branch, not format inference.
- `/api/v1/strategies` leaves `description`, `supportedSymbols`, and `supportedTimeframes` **out of `required`** — they are optional, not merely nullable.

---

### Task 1: Sprint W33 scaffolding and the operation-count correction

**Files:**
- Create: `docs/sprints/sprint-2026-W33.md`
- Create: `docs/sprints/stories/US-2.4-tool-substrate-and-layout.md`
- Create: `docs/sprints/stories/US-2.5-list-brokers-tool.md`
- Create: `docs/sprints/stories/US-2.6-list-strategies-tool.md`
- Create: `docs/sprints/stories/US-2.7-list-account-strategies-tool.md`
- Create: `docs/sprints/stories/US-2.8-list-positions-tool.md`
- Create: `docs/sprints/stories/US-2.9-list-pending-orders-tool.md`
- Create: `docs/sprints/epics/EPIC-3.md`
- Modify: `docs/sprints/epics/EPIC-2.md` (story index, operation counts)
- Modify: `AGENTS.md` (operation counts only — the structure section is Task 2)

**Interfaces:**
- Consumes: nothing.
- Produces: story IDs `US-2.4` … `US-2.9` and sprint id `sprint-2026-W33`, which every later task ticks checkboxes in.

- [ ] **Step 1: Load the koni-docs skill**

This repo's story, epic, and sprint formats are owned by the vendored `koni-docs` skill, not by this plan. Invoke it before authoring:

```
Skill(skill="koni-docs")
```

Follow its templates for sprint and story files. This plan supplies the frontmatter values and the acceptance criteria; the skill supplies the document shape.

- [ ] **Step 2: Create the sprint file**

`docs/sprints/sprint-2026-W33.md` frontmatter:

```yaml
---
id: sprint-2026-W33
status: in-progress
start: 2026-08-10
end: 2026-08-16
goal: "Restructure src/ into core/ + tools/<tag>/, add the read-tool substrate, and ship the first five of the nine unshipped read tools"
---
```

Scope table — 6 stories / 15 points:

| US | Title | Epic | Pri | Points | Status |
|---|---|---|---|---|---|
| US-2.4 | Tool substrate and directory layout | EPIC-2 | P1 | 5 | 📋 backlog |
| US-2.5 | `list_brokers` tool | EPIC-2 | P1 | 2 | 📋 backlog |
| US-2.6 | `list_strategies` tool | EPIC-2 | P1 | 2 | 📋 backlog |
| US-2.7 | `list_account_strategies` tool | EPIC-2 | P1 | 2 | 📋 backlog |
| US-2.8 | `list_positions` tool | EPIC-2 | P1 | 2 | 📋 backlog |
| US-2.9 | `list_pending_orders` tool | EPIC-2 | P1 | 2 | 📋 backlog |

Record the hard chain in the dependencies section: **US-2.4 blocks all five tool stories** (they consume `registerReadTool` and `accountPath`); US-2.5 → US-2.6 have no path parameter, US-2.7 is the first that does, US-2.8 → US-2.9 are the terminal-backed pair.

- [ ] **Step 3: Create the six story files**

Frontmatter for each — `epic: EPIC-2`, `sprint: sprint-2026-W33`, `assignee: bluezdot`, `status: backlog`, `created: 2026-08-06`, `updated: 2026-08-06`, and no `version_shipped` until close (RULE-16 — bare semver when set):

| id | title | priority | points | ships |
|---|---|---|---|---|
| US-2.4 | Tool substrate and directory layout | P1 | 5 | 0.2.0 |
| US-2.5 | `list_brokers` tool | P1 | 2 | 0.3.0 |
| US-2.6 | `list_strategies` tool | P1 | 2 | 0.4.0 |
| US-2.7 | `list_account_strategies` tool | P1 | 2 | 0.5.0 |
| US-2.8 | `list_positions` tool | P1 | 2 | 0.6.0 |
| US-2.9 | `list_pending_orders` tool | P1 | 2 | 0.7.0 |

Acceptance criteria, verbatim seeds — expand each into the skill's Given/When/Then form:

**US-2.4**
1. `src/core/` holds `client.ts`, `errors.ts`, `tool.ts`, `parse.ts` with their tests; `src/tools/accounts/list-accounts.ts` holds the accounts domain; `npm test`, `npm run typecheck`, `npm run build` all pass after the move with no behaviour change.
2. `core/` imports nothing from `tools/` — verified by grep.
3. `client.get` accepts `query`, drops `undefined` entries, and encodes the rest via `URLSearchParams`.
4. `accountPath` rejects `../`, `..%2F..%2Fadmin`, the empty string, and a 65-character segment; accepts a normal id; applies `encodeURIComponent`.
5. A `404` produces a message naming the three causes and telling the caller to use `list_accounts`.`id` when a `login` was passed.
6. A `409` produces the endpoint's own `conflictMeans` text when supplied.
7. `registerReadTool` sets `readOnlyHint: true` and `openWorldHint: true` as constants, returns `{ content, structuredContent }` on success and `{ content, isError: true }` with no `structuredContent` on failure, and leaves the session alive.
8. `list_accounts` behaves identically to 0.1.0 after migration — every existing `server.test.ts` assertion still passes.
9. Table-driven tests cover all registered tools for: no key leakage on any error branch, `structuredContent` validating against the tool's own `outputSchema`, and `readOnlyHint: true`.
10. No file outside `src/server.ts` and `src/index.ts` imports a **runtime value** from `@modelcontextprotocol/*`; `core/tool.ts` and every tool module use `import type` only.
11. `AGENTS.md` and `EPIC-2` state 10 `GET` + 7 `POST` and nine read operations remaining; `AGENTS.md`'s repo-structure section describes the new layout.
12. `CONTEXT.md` gains D7 (directory structure), D8 (`registerReadTool`), D9 (payload-shaping policy).
13. `SETUP.md`, `.env.example`, and `README.md` list all five read scopes.
14. `EPIC-3.md` exists with `status: planned`, the seven write operations, the guardrails, and no stories.

**US-2.5** — `list_brokers` returns `{ brokers: [...] }`; the description states the catalog is platform-wide and not the user's linked accounts; a broker's `servers` and `accountTypes` both render; an empty list explains itself; `403` names `brokers:read`.

**US-2.6** — `list_strategies` returns `{ strategies: [...] }`; `description`, `supportedSymbols` and `supportedTimeframes` are optional and their absence is not an error; a null `avgRating` renders `—` and never `0`; the description states the catalog is platform-wide; `403` names `strategies:read`.

**US-2.7** — `list_account_strategies` takes `accountId` and routes through `accountPath`; a traversal attempt fails before any HTTP call; the description names `list_accounts`.`id` and rejects `login`; a `404` returns the `login`/`id` hint; an account with no deployed strategies says so; `403` names `strategies:read`.

**US-2.8** — `list_positions` takes `accountId`; a `409` reports the terminal offline and explicitly distinguishes it from holding no positions; an empty list states that it is a real zero; `sl`/`tp` of `0` render `—`, never `0.00`; more than 200 rows truncates and records it in `notes`; `403` names `trading:read`.

**US-2.9** — `list_pending_orders` mirrors US-2.8 for orders; `priceStopLimit` of `0` renders `—`; a `409` reports the terminal offline; `403` names `trading:read`.

- [ ] **Step 4: Create EPIC-3**

`docs/sprints/epics/EPIC-3.md`, `status: backlog`, **no stories**. It must list the seven write operations, and record these guardrails as the epic's cross-cutting invariants:

> **Use the enum members the vendored templates document**, not the word that reads
> best: `epicSchema` allows `backlog | in-progress | done` and `sprintSchema` allows
> `planned | in-progress | closed`. An epic that has not started is `backlog`, and a
> sprint being worked is `in-progress`.

- Opt-in by environment variable; write tools are not registered by default.
- `Idempotency-Key` on `POST /accounts` and `POST …/strategies`, the two operations that accept it.
- Elicitation for user confirmation before execution.
- **A partial position close is not retry-safe.** `POST …/positions/{ticket}/close` carrying `volume` closes that volume *again* on retry, and the route consumes no `Idempotency-Key`. Any retry policy built for the read path must not be inherited here.
- `positions/close-all` and `orders/cancel-all` are best-effort batches returning `{ requested, succeeded, failed, results }`; one failing ticket never aborts the batch.

- [ ] **Step 5: Correct the operation counts**

In `AGENTS.md` and `docs/sprints/epics/EPIC-2.md`, replace every occurrence of the wrong figures. The API is **10 `GET` + 7 `POST`**, so **nine** read operations remain, not sixteen.

Find them first:

```bash
grep -rn "16 read\|eight of the 17\|Eight of the 17\|all 8 write\|8 write" AGENTS.md docs/sprints/epics/EPIC-2.md
```

Add US-2.4 … US-2.9 to EPIC-2's story index table with `📋 backlog`.

Leave `docs/superpowers/specs/2026-08-05-senti-mcp-server-design.md` **untouched** — it is a snapshot, amended via CONTEXT (D1, D5 precedent).

- [ ] **Step 6: Validate the doc graph**

```bash
npm run agile:validate && npm run agile:status
```

Expected: `✓ all references resolve`, exit 0; `STATUS.md` regenerates reporting 10 stories.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "docs: open sprint W33, add US-2.4..US-2.9 and EPIC-3

Corrects the operation count across AGENTS.md and EPIC-2: the API is
10 GET + 7 POST, so nine read operations remain, not sixteen."
```

---

### Task 2: Move `client` and `errors` into `src/core/`

A pure move. No behaviour changes, no new tests — if any assertion changes, something was done wrong.

**Files:**
- Move: `src/client.ts` → `src/core/client.ts`
- Move: `src/client.test.ts` → `src/core/client.test.ts`
- Move: `src/errors.ts` → `src/core/errors.ts`
- Move: `src/errors.test.ts` → `src/core/errors.test.ts`
- Modify: `src/server.ts`, `src/smoke.test.ts` (import paths)
- Modify: `AGENTS.md` (repo-structure section)

**Interfaces:**
- Consumes: Task 1's story files (tick `US-2.4` checkboxes).
- Produces: `src/core/client.js` exporting `createClient`, `type SentiClient`, `type ClientDeps`, `type RequestOptions`; `src/core/errors.js` exporting `ApiError`, `describeError`.

- [ ] **Step 1: Move the four files with git**

```bash
mkdir -p src/core
git mv src/client.ts src/core/client.ts
git mv src/client.test.ts src/core/client.test.ts
git mv src/errors.ts src/core/errors.ts
git mv src/errors.test.ts src/core/errors.test.ts
```

- [ ] **Step 2: Fix the import paths**

Exactly four edits. `errors.ts` has no intra-`src` imports and `errors.test.ts`'s `./errors.js` still resolves — neither changes.

In `src/core/client.ts` line 1:

```ts
import { SERVER_NAME, SERVER_VERSION, type Config } from '../config.js';
```

In `src/core/client.test.ts` line 4:

```ts
import { loadConfig } from '../config.js';
```

In `src/server.ts` lines 4 and 6:

```ts
import { createClient } from './core/client.js';
import { describeError } from './core/errors.js';
```

In `src/smoke.test.ts` line 3:

```ts
import { createClient } from './core/client.js';
```

- [ ] **Step 3: Run the full suite to prove nothing changed**

```bash
npm test && npm run typecheck
```

Expected: PASS, same test count as before the move. `npm test` builds `dist/` on the way through because `index.test.ts` spawns the built entry point.

- [ ] **Step 4: Confirm the one-way edge holds**

```bash
grep -rn "from '\.\./tools\|from './tools" src/core/
```

Expected: no output. `core/` importing from `tools/` is the boundary violation this guards.

- [ ] **Step 5: Update the AGENTS.md repo-structure section**

The current text says *"the six source files below, flat: tools split by API tag when they multiply, **not** into a `tools/` directory"*. Replace the whole block with the target layout from the spec, and record the three constraints: recursive tsconfig globs mean no build change; `src/index.ts` cannot move; `test:smoke` hardcodes `src/smoke.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: move client and errors into src/core/

Pure move plus import-path fixes. No behaviour change; the suite passes
with the same assertions it had before."
```

---

### Task 3: Query-parameter support in `core/client.ts`

**Files:**
- Modify: `src/core/client.ts`
- Test: `src/core/client.test.ts`

**Interfaces:**
- Consumes: `createClient` from Task 2.
- Produces: `RequestOptions.query?: QueryParams` where `type QueryParams = Record<string, string | number | undefined>`. Consumed by W34's performance and deals tools.

- [ ] **Step 1: Write the failing tests**

Append to the `describe('createClient', …)` block in `src/core/client.test.ts`:

```ts
  test('appends query parameters and drops undefined ones', async () => {
    const { calls, fetchImpl } = stub(jsonResponse([]));

    await createClient(config, { fetch: fetchImpl }).get('/api/v1/accounts/a/deals', {
      query: { limit: 50, entry: 'out', cursor: undefined },
    });

    expect(calls[0]?.url).toBe(
      'https://be-dev.sentitrade.xyz/api/v1/accounts/a/deals?limit=50&entry=out',
    );
  });

  test('omits the question mark entirely when every value is undefined', async () => {
    const { calls, fetchImpl } = stub(jsonResponse([]));

    await createClient(config, { fetch: fetchImpl }).get('/api/v1/accounts', {
      query: { from: undefined, to: undefined },
    });

    expect(calls[0]?.url).toBe('https://be-dev.sentitrade.xyz/api/v1/accounts');
  });

  test('percent-encodes query values rather than splicing them raw', async () => {
    const { calls, fetchImpl } = stub(jsonResponse([]));

    await createClient(config, { fetch: fetchImpl }).get('/api/v1/accounts', {
      query: { reporting: 'US D&x=1' },
    });

    expect(calls[0]?.url).toBe(
      'https://be-dev.sentitrade.xyz/api/v1/accounts?reporting=US+D%26x%3D1',
    );
  });
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run src/core/client.test.ts -t 'query'
```

Expected: FAIL — the URL has no query string, because `query` is ignored.

- [ ] **Step 3: Implement**

In `src/core/client.ts`, extend the option type and add the builder:

```ts
export type QueryParams = Record<string, string | number | undefined>;

export type RequestOptions = {
  signal?: AbortSignal;
  /**
   * The scope this endpoint requires, quoted verbatim in the 403 message. The
   * client cannot infer it — scopes are a property of the endpoint, and only
   * the caller knows which one it is asking for.
   */
  scope?: string;
  /** `undefined` values are dropped rather than sent as the string "undefined". */
  query?: QueryParams;
};

/** Render a query string, or the empty string when nothing survives. */
function queryStringOf(query: QueryParams | undefined): string {
  if (!query) return '';

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    params.set(key, String(value));
  }

  const rendered = params.toString();
  return rendered ? `?${rendered}` : '';
}
```

Then in `get`, replace the fetch URL expression:

```ts
      const response = await doFetch(`${config.baseUrl}${path}${queryStringOf(options.query)}`, {
```

- [ ] **Step 4: Run to verify they pass**

```bash
npx vitest run src/core/client.test.ts
```

Expected: PASS, including all pre-existing client tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/client.ts src/core/client.test.ts docs/sprints/stories/US-2.4-tool-substrate-and-layout.md
git commit -m "feat: accept query parameters in the Senti client"
```

---

### Task 4: `accountPath` — the only path builder

**Files:**
- Modify: `src/core/client.ts`
- Test: `src/core/client.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `export function accountPath(accountId: string, ...rest: string[]): string`. Every account-scoped tool from Task 14 onward calls it. Throws a plain `Error` (not `ApiError`) — a rejected argument is not something the API said.

- [ ] **Step 1: Write the failing tests**

Add a new `describe` block at the end of `src/core/client.test.ts`, and add `accountPath` to the import on line 2:

```ts
describe('accountPath', () => {
  test('builds the account-scoped path from validated segments', () => {
    expect(accountPath('8f2c1b40-3d5e-4a17-9c8b-2e1f0a6d4b93', 'positions')).toBe(
      '/api/v1/accounts/8f2c1b40-3d5e-4a17-9c8b-2e1f0a6d4b93/positions',
    );
  });

  test('supports a bare account path with no trailing segments', () => {
    expect(accountPath('abc-123')).toBe('/api/v1/accounts/abc-123');
  });

  test('supports multiple trailing segments', () => {
    expect(accountPath('abc-123', 'performance', 'breakdowns')).toBe(
      '/api/v1/accounts/abc-123/performance/breakdowns',
    );
  });

  test.each([
    ['a traversal attempt', '../../admin'],
    ['a pre-encoded traversal attempt', '..%2F..%2Fadmin'],
    ['an empty string', ''],
    ['a value with whitespace', 'abc 123'],
    ['a value with a slash', 'abc/positions'],
    ['a value with a dot', 'abc.123'],
    ['a 65-character value', 'a'.repeat(65)],
  ])('rejects %s before it reaches a URL', (_label, value) => {
    expect(() => accountPath(value, 'positions')).toThrow(/Invalid path segment/);
  });

  test('accepts a 64-character value at the boundary', () => {
    const id = 'a'.repeat(64);

    expect(accountPath(id)).toBe(`/api/v1/accounts/${id}`);
  });

  test('validates trailing segments too, not only the accountId', () => {
    expect(() => accountPath('abc-123', '../secrets')).toThrow(/Invalid path segment/);
  });

  test('names the id field a caller should have used', () => {
    expect(() => accountPath('../etc')).toThrow(/list_accounts/);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run src/core/client.test.ts -t 'accountPath'
```

Expected: FAIL — `accountPath is not a function` / import error.

- [ ] **Step 3: Implement**

Add to `src/core/client.ts`, above `createClient`:

```ts
/**
 * What a path segment may contain. Deliberately not a UUID pattern: the
 * OpenAPI document declares `accountId` as a bare `type: string` with no
 * `format` and no `pattern`, so hard-coding UUID would take every
 * account-scoped tool down at once the day Senti issues an id in another
 * shape — this server's assumption failing, not the API's contract. What this
 * does reject is everything that makes concatenation dangerous.
 */
const PATH_SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * The only function permitted to build a path containing a parameter. No tool
 * concatenates: `accountId` originates from the model, and a value such as
 * `..%2F..%2Fadmin` escapes `/api/v1/accounts/` under naive concatenation.
 *
 * Note that a `login` (the MT5 account number, e.g. `413878201`) passes this
 * check — it is a legal segment, just the wrong value. The 404 branch is what
 * catches that, and says so.
 */
export function accountPath(accountId: string, ...rest: string[]): string {
  const segments = [accountId, ...rest];

  for (const segment of segments) {
    if (!PATH_SEGMENT.test(segment)) {
      throw new Error(
        `Invalid path segment ${JSON.stringify(segment)}: expected 1-64 characters from ` +
          'A-Z, a-z, 0-9, "_" and "-". Values containing "/", ".", "%" or whitespace are ' +
          'rejected before they reach a URL. Use the `id` field from list_accounts.',
      );
    }
  }

  return `/api/v1/accounts/${segments.map(encodeURIComponent).join('/')}`;
}
```

- [ ] **Step 4: Run to verify they pass**

```bash
npx vitest run src/core/client.test.ts
```

Expected: PASS — 10 new `accountPath` assertions plus every pre-existing client test.

- [ ] **Step 5: Commit**

```bash
git add src/core/client.ts src/core/client.test.ts docs/sprints/stories/US-2.4-tool-substrate-and-layout.md
git commit -m "feat: add accountPath as the only validated path builder"
```

---

### Task 5: Dedicated `404` and `409` branches

**Files:**
- Modify: `src/core/client.ts`
- Test: `src/core/client.test.ts`

**Interfaces:**
- Consumes: `RequestOptions` from Task 3.
- Produces: `RequestOptions.conflictMeans?: string` — what a `409` means for *this* endpoint, supplied by the call site exactly as `scope` already is. Used by Tasks 17 and 19.

- [ ] **Step 1: Write the failing tests**

Append inside `describe('createClient', …)`:

```ts
  test('maps 404 to the three real causes, and points a login at list_accounts', async () => {
    const { fetchImpl } = stub(jsonResponse(envelope('NOT_FOUND', 'Account not found.'), 404));

    const promise = createClient(config, { fetch: fetchImpl }).get('/api/v1/accounts/x/positions');

    await expect(promise).rejects.toThrow(/does not exist, is not owned by this API key/);
    await expect(promise).rejects.toThrow(/list_accounts/);
    await expect(promise).rejects.toThrow(/login/);
  });

  test('gives 409 the meaning the call site supplied', async () => {
    const { fetchImpl } = stub(jsonResponse(envelope('CONFLICT', 'Terminal offline.'), 409));

    const promise = createClient(config, { fetch: fetchImpl }).get('/api/v1/accounts/x/positions', {
      conflictMeans: 'The MT5 terminal for this account is offline.',
    });

    await expect(promise).rejects.toThrow(/The MT5 terminal for this account is offline\./);
  });

  test('falls back to a bare 409 when the call site supplied no meaning', async () => {
    const { fetchImpl } = stub(jsonResponse(envelope('CONFLICT', 'Conflict.'), 409));

    const promise = createClient(config, { fetch: fetchImpl }).get('/api/v1/accounts');

    await expect(promise).rejects.toThrow(/409/);
  });
```

Extend the existing key-leak test's status list so the two new branches are covered by it too — change its first line to:

```ts
    const statuses = [401, 403, 404, 409, 429, 500, 502];
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run src/core/client.test.ts -t '404'
```

Expected: FAIL — the message is the generic `Senti API request failed: HTTP 404 …` from the default branch.

- [ ] **Step 3: Implement**

Add `conflictMeans` to `RequestOptions`:

```ts
  /**
   * What a 409 means for THIS endpoint, quoted verbatim. The client cannot
   * infer it: on account-scoped reads a 409 is "terminal offline", and on the
   * write path it will mean something else entirely. Same reasoning as `scope`.
   */
  conflictMeans?: string;
```

Change `failureOf`'s signature to take it, and add the two cases before `default`:

```ts
function failureOf(
  status: number,
  headers: Headers,
  body: unknown,
  scope: string | undefined,
  conflictMeans: string | undefined,
): ApiError {
```

```ts
    case 404:
      return new ApiError(
        `Senti API returned 404${detail}. The account does not exist, is not owned by ` +
          'this API key, or has been unlinked. If a `login` (the MT5 account number) was ' +
          'passed where an `accountId` was expected, call list_accounts and use its `id`.',
        status,
        code,
      );

    case 409: {
      const meaning = conflictMeans ? ` ${conflictMeans}` : '';

      return new ApiError(`Senti API returned 409${detail}.${meaning}`, status, code);
    }
```

Update the single call site in `get`:

```ts
        throw failureOf(response.status, response.headers, body, options.scope, options.conflictMeans);
```

- [ ] **Step 4: Run to verify they pass**

```bash
npx vitest run src/core/client.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/client.ts src/core/client.test.ts docs/sprints/stories/US-2.4-tool-substrate-and-layout.md
git commit -m "feat: give 404 and 409 their own actionable messages"
```

---

### Task 6: `core/tool.ts` and `core/parse.ts` — the registration and validation helpers

**Files:**
- Create: `src/core/tool.ts`
- Test: `src/core/tool.test.ts`
- Create: `src/core/parse.ts`
- Test: `src/core/parse.test.ts`

**Interfaces:**
- Consumes: `describeError` from `src/core/errors.js`.
- Produces: `registerReadTool<Args, Structured>(server, spec)` and `type ReadToolSpec<Args, Structured>`. Every `register*` function from Task 7 onward calls it.
- Produces: `parseOrThrow<T>(schema: z.ZodType<T>, payload: unknown, subject: string): T`. Every `parse*` function from Task 7 onward calls it instead of repeating the `safeParse`-and-throw block.

**This signature is verified.** It compiles under `npx tsc --noEmit` and round-trips over `InMemoryTransport` with a non-empty `inputSchema`. Do not "improve" the generics — the SDK constrains `registerTool` to `StandardSchemaWithJSON`, and this form is what satisfies it while still inferring `Args` in `run`.

- [ ] **Step 1: Write the failing test**

Create `src/core/tool.test.ts`:

```ts
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { McpServer } from '@modelcontextprotocol/server';
import { describe, expect, test } from 'vitest';
import * as z from 'zod/v4';
import { registerReadTool } from './tool.js';

const EchoOutput = z.object({ echoed: z.string() });

type ToolResult = {
  content: { type: string; text?: string }[];
  structuredContent?: unknown;
  isError?: boolean;
};

async function connect(server: McpServer) {
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

function serverWithEcho() {
  const server = new McpServer({ name: 'test', version: '0.0.0' });

  registerReadTool(server, {
    name: 'echo_account',
    title: 'Echo',
    description: 'Echo the accountId back.',
    inputSchema: z.object({ accountId: z.string() }),
    outputSchema: EchoOutput,
    run: async (args) => ({
      text: `got ${args.accountId}`,
      structured: { echoed: args.accountId },
    }),
  });

  return server;
}

function serverWithFailure(error: Error) {
  const server = new McpServer({ name: 'test', version: '0.0.0' });

  registerReadTool(server, {
    name: 'boom',
    title: 'Boom',
    description: 'Always fails.',
    inputSchema: z.object({}),
    outputSchema: EchoOutput,
    run: async () => {
      throw error;
    },
  });

  return server;
}

describe('registerReadTool', () => {
  test('pins the read-only annotations as constants', async () => {
    const client = await connect(serverWithEcho());

    const { tools } = await client.listTools();

    expect(tools[0]?.annotations?.readOnlyHint).toBe(true);
    expect(tools[0]?.annotations?.openWorldHint).toBe(true);
  });

  test('advertises the declared input schema', async () => {
    const client = await connect(serverWithEcho());

    const { tools } = await client.listTools();

    expect(tools[0]?.inputSchema.properties).toHaveProperty('accountId');
  });

  test('passes typed arguments to run and returns both result channels', async () => {
    const client = await connect(serverWithEcho());

    const result = (await client.callTool({
      name: 'echo_account',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect(result.isError).toBeFalsy();
    expect(result.content[0]?.text).toBe('got abc-123');
    expect(result.structuredContent).toEqual({ echoed: 'abc-123' });
  });

  test('turns a thrown error into an isError text result with no structured content', async () => {
    const client = await connect(
      serverWithFailure(new Error('fetch failed', { cause: { code: 'ENOTFOUND' } })),
    );

    const result = (await client.callTool({ name: 'boom' })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('ENOTFOUND');
    expect(result.structuredContent).toBeUndefined();
  });

  test('keeps the session alive after a failure', async () => {
    const client = await connect(serverWithFailure(new Error('boom')));

    await client.callTool({ name: 'boom' });
    const { tools } = await client.listTools();

    expect(tools).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run src/core/tool.test.ts
```

Expected: FAIL — `Cannot find module './tool.js'`.

- [ ] **Step 3: Implement**

Create `src/core/tool.ts`:

```ts
import type { McpServer } from '@modelcontextprotocol/server';
import type * as z from 'zod/v4';
import { describeError } from './errors.js';

/**
 * What a read tool has to declare. Everything that varies between tools —
 * name, description, schemas, and the work itself — is a field here; nothing
 * that must not vary is.
 */
export type ReadToolSpec<Args, Structured> = {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodType<Args>;
  outputSchema: z.ZodType<Structured>;
  run: (args: Args, signal: AbortSignal) => Promise<{ text: string; structured: Structured }>;
};

/**
 * Register a read tool.
 *
 * The `try`/`catch` is the whole point: a model can read and act on a returned
 * error, but it cannot see a call that died. The annotations are constants
 * rather than parameters, which makes this a mechanical barrier against a
 * write tool reaching this server before EPIC-3 opens.
 *
 * An error result carries `content` only — `structuredContent` would have to
 * satisfy `outputSchema`, and there is no successful payload to describe.
 *
 * Imports from the SDK are `import type` and erase at build time, so
 * `src/server.ts` and `src/index.ts` remain the only files that pull a runtime
 * value out of `@modelcontextprotocol/*`.
 */
export function registerReadTool<Args, Structured>(
  server: McpServer,
  spec: ReadToolSpec<Args, Structured>,
): void {
  server.registerTool(
    spec.name,
    {
      title: spec.title,
      description: spec.description,
      inputSchema: spec.inputSchema,
      outputSchema: spec.outputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args, ctx) => {
      try {
        const { text, structured } = await spec.run(args, ctx.mcpReq.signal);

        return { content: [{ type: 'text' as const, text }], structuredContent: structured };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: describeError(error) }], isError: true };
      }
    },
  );
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npx vitest run src/core/tool.test.ts && npm run typecheck
```

Expected: PASS, 5 tests; typecheck exits 0.

- [ ] **Step 5: Write the failing test for `parseOrThrow`**

Six `parse*` functions across this sprint would otherwise repeat one identical
`safeParse`-and-throw block, differing only in a noun. That is the same mechanical
repetition D8 exists to remove, so it is extracted here rather than copied six times.

Create `src/core/parse.test.ts`:

```ts
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
```

- [ ] **Step 6: Run to verify it fails**

```bash
npx vitest run src/core/parse.test.ts
```

Expected: FAIL — `Cannot find module './parse.js'`.

- [ ] **Step 7: Implement `parseOrThrow`**

Create `src/core/parse.ts`. The message wording is copied verbatim from the existing
`parseAccounts` so that migrating it in Task 7 changes no assertion:

```ts
import type * as z from 'zod/v4';

/**
 * Validate a payload against a schema, or throw an error naming the field that
 * failed and what a reader should do about it.
 *
 * Validation is all-or-nothing by choice: one malformed field fails the whole
 * response rather than passing malformed data to the model. The operational
 * cost is real — a single upstream field change takes down a whole tool rather
 * than one row — and that trade is right while a tool returns records a human
 * is about to act on financially. When it stops being right, the fix is
 * per-item partial parsing that keeps the valid rows and reports the rejected
 * ones, not a looser schema, which would reintroduce exactly the silent
 * corruption this guards against.
 *
 * `subject` names what failed to parse, in the caller's words — "account list",
 * "position list". It is the only thing that varies between call sites, which
 * is why they call this rather than each carrying a copy of the block.
 */
export function parseOrThrow<T>(schema: z.ZodType<T>, payload: unknown, subject: string): T {
  const result = schema.safeParse(payload);

  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue && issue.path.length > 0 ? issue.path.join('.') : '(root)';

    throw new Error(
      `Senti API returned an unexpected shape for the ${subject} at "${where}": ` +
        `${issue?.message ?? 'unknown issue'}. The API may have changed; ` +
        'senti-mcp-server needs updating.',
    );
  }

  return result.data;
}
```

- [ ] **Step 8: Run to verify it passes**

```bash
npx vitest run src/core/parse.test.ts && npm run typecheck
```

Expected: PASS, 5 tests; typecheck exits 0.

- [ ] **Step 9: Commit**

```bash
git add src/core/tool.ts src/core/tool.test.ts src/core/parse.ts src/core/parse.test.ts docs/sprints/stories/US-2.4-tool-substrate-and-layout.md
git commit -m "feat: add registerReadTool and parseOrThrow, the two core helpers"
```

---

### Task 7: Move accounts into `tools/accounts/` and migrate onto the helper

**Files:**
- Move: `src/accounts.ts` → `src/tools/accounts/list-accounts.ts`
- Move: `src/accounts.test.ts` → `src/tools/accounts/list-accounts.test.ts`
- Modify: `src/server.ts` (shrinks to wiring), `src/server.test.ts`, `src/smoke.test.ts` (import paths)

**Interfaces:**
- Consumes: `registerReadTool` (Task 6), `type SentiClient` (Task 2).
- Produces: `registerListAccounts(server: McpServer, client: SentiClient): void`, plus the existing `AccountSchema`, `AccountsOutputSchema`, `parseAccounts`, `formatAccounts`. Every later tool copies this file's four-export shape.

- [ ] **Step 1: Move the files**

```bash
mkdir -p src/tools/accounts
git mv src/accounts.ts src/tools/accounts/list-accounts.ts
git mv src/accounts.test.ts src/tools/accounts/list-accounts.test.ts
```

- [ ] **Step 2: Fix import paths in the moved test and the two other consumers**

`src/tools/accounts/list-accounts.test.ts` line 2:

```ts
import { type Account, formatAccounts, parseAccounts } from './list-accounts.js';
```

`src/server.test.ts` line 3:

```ts
import { AccountsOutputSchema } from './tools/accounts/list-accounts.js';
```

`src/smoke.test.ts` line 2:

```ts
import { formatAccounts, parseAccounts } from './tools/accounts/list-accounts.js';
```

- [ ] **Step 3: Migrate `parseAccounts` onto `parseOrThrow`**

Replace the body of `parseAccounts` in `src/tools/accounts/list-accounts.ts`. The
`subject` is `'account list'`, which reproduces the current message exactly — so
`list-accounts.test.ts` must pass unchanged, including its assertions on
`/lastKnownBalance/`, `/unexpected shape/` and `/senti-mcp-server needs updating/`.

Delete the long comment block above `parseAccounts` — its content now lives on
`parseOrThrow`, which is where the trade-off it describes is actually made.

```ts
export function parseAccounts(payload: unknown): Account[] {
  return parseOrThrow(z.array(AccountSchema), payload, 'account list');
}
```

- [ ] **Step 4: Add the registration function to the moved module**

Append to `src/tools/accounts/list-accounts.ts`, and add the three imports at the top:

```ts
import type { McpServer } from '@modelcontextprotocol/server';
import type { SentiClient } from '../../core/client.js';
import { parseOrThrow } from '../../core/parse.js';
import { registerReadTool } from '../../core/tool.js';
```

```ts
/** The scope `GET /api/v1/accounts` requires, quoted back in the 403 message. */
const ACCOUNTS_READ = 'accounts:read';

export function registerListAccounts(server: McpServer, client: SentiClient): void {
  registerReadTool(server, {
    name: 'list_accounts',
    title: 'List linked MT5 accounts',
    description:
      'List the MT5 trading accounts linked to the configured Senti Quant API key. ' +
      "Returns each account's id, login, broker, last known balance and equity, sync " +
      'state, and running strategies. The `id` field is the accountId every other Senti ' +
      'endpoint takes — pass `id`, not `login`, when a tool asks for an account.',
    inputSchema: z.object({}),
    outputSchema: AccountsOutputSchema,
    run: async (_args, signal) => {
      const payload = await client.get('/api/v1/accounts', { signal, scope: ACCOUNTS_READ });
      const accounts = parseAccounts(payload);

      return { text: formatAccounts(accounts), structured: { accounts } };
    },
  });
}
```

- [ ] **Step 5: Shrink `src/server.ts` to wiring**

Replace the whole file:

```ts
import { McpServer } from '@modelcontextprotocol/server';
import { createClient } from './core/client.js';
import { SERVER_NAME, SERVER_VERSION, type Config } from './config.js';
import { registerListAccounts } from './tools/accounts/list-accounts.js';

export type ServerDeps = { fetch?: typeof fetch };

/**
 * The tool list is registered once and never changes for the life of the
 * process, so clients on protocol revision 2026-07-28 may cache it. Without a
 * hint the SDK emits `ttlMs: 0` and every connection re-lists.
 */
const TOOL_LIST_TTL_MS = 3_600_000;

export function createServer(config: Config, deps: ServerDeps = {}): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      cacheHints: {
        'tools/list': { ttlMs: TOOL_LIST_TTL_MS, cacheScope: 'private' },
        'server/discover': { ttlMs: TOOL_LIST_TTL_MS, cacheScope: 'private' },
      },
    },
  );

  const client = createClient(config, { fetch: deps.fetch });

  registerListAccounts(server, client);

  return server;
}
```

- [ ] **Step 6: Run the full suite — every existing assertion must still pass**

```bash
npm test && npm run typecheck
```

Expected: PASS. `server.test.ts` is untouched apart from its import, and
`list-accounts.test.ts` is untouched entirely — so both the `parseOrThrow` migration and
`list_accounts` behaving identically to 0.1.0 are proven by assertions that predate this
task. If any assertion in `list-accounts.test.ts` needed changing, the migration changed
behaviour and is wrong.

- [ ] **Step 7: Confirm the SDK-import invariant**

```bash
grep -rn "^import .*from '@modelcontextprotocol" src/ --include='*.ts' | grep -v '\.test\.ts' | grep -v '^.*:import type'
```

Expected: exactly two lines — `src/index.ts` (the `/stdio` subpath) and `src/server.ts` (`McpServer`). `core/tool.ts` and every tool module must appear only under `import type`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: move accounts into tools/accounts and register via the helper

server.ts becomes wiring: build a client, call register* functions."
```

---

### Task 8: Table-driven invariant tests

Written once, and they cover every tool added afterwards — including the five later in this sprint and the four in W34. This is the task that stops tool eleven from silently dropping an invariant.

**Files:**
- Modify: `src/server.test.ts`

**Interfaces:**
- Consumes: `createServer` (Task 7).
- Produces: nothing importable. Later tool tasks add a row to `TOOL_CALLS` rather than writing new leak tests.

- [ ] **Step 1: Write the failing tests**

Append to `src/server.test.ts`. `TOOL_CALLS` grows by one entry per tool in every later task:

```ts
/**
 * One entry per registered tool. Later tool stories add a row here rather than
 * writing their own leak test — that is the point of the table.
 */
const TOOL_CALLS: { name: string; arguments?: Record<string, unknown> }[] = [
  { name: 'list_accounts' },
];
// NOTE (added after execution): Task 9 extended this type with two further
// REQUIRED fields — `outputSchema: z.ZodType` and `successBody: unknown` — when
// AC-9's second clause was generalised into this table. The shape above is what
// Task 8 shipped; every later task's rows carry all four fields.

const errorStatuses = [401, 403, 404, 409, 429, 500];

describe('invariants across every registered tool', () => {
  test('the table lists every registered tool', async () => {
    const client = await connect();

    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name).sort()).toEqual(
      TOOL_CALLS.map((call) => call.name).sort(),
    );
  });

  test('every tool advertises itself read-only against an open world', async () => {
    const client = await connect();

    const { tools } = await client.listTools();

    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint, `${tool.name} readOnlyHint`).toBe(true);
      expect(tool.annotations?.openWorldHint, `${tool.name} openWorldHint`).toBe(true);
    }
  });

  test('no tool leaks the API key on any error status', async () => {
    for (const status of errorStatuses) {
      const failing = (async () =>
        new Response(JSON.stringify({ error: { code: 'INTERNAL', message: 'boom' } }), {
          status,
          headers: { 'content-type': 'application/json' },
        })) as unknown as typeof fetch;
      const client = await connect(failing);

      for (const call of TOOL_CALLS) {
        const result = (await client.callTool(call)) as ToolResult;

        expect(result.isError, `${call.name} @ ${status}`).toBe(true);
        expect(textOf(result), `${call.name} @ ${status}`).not.toContain('supersecret');
        expect(textOf(result), `${call.name} @ ${status}`).not.toContain('sq_live_');
        expect(result.structuredContent, `${call.name} @ ${status}`).toBeUndefined();
      }
    }
  }, 30_000);

  test('no tool leaks the API key when the network fails', async () => {
    const throwing = (async () => {
      throw new Error('fetch failed', { cause: { code: 'ENOTFOUND' } });
    }) as unknown as typeof fetch;
    const client = await connect(throwing);

    for (const call of TOOL_CALLS) {
      const result = (await client.callTool(call)) as ToolResult;

      expect(textOf(result), call.name).not.toContain('supersecret');
      expect(textOf(result), call.name).not.toContain('sq_live_');
    }
  });
});
```

- [ ] **Step 2: Run to verify they pass or fail honestly**

```bash
npx vitest run src/server.test.ts -t 'invariants'
```

Expected: PASS. These assert invariants the code already upholds — they are a regression net, not a red-green cycle. If any fails now, that is a real defect in Task 7's migration and must be fixed before continuing.

- [ ] **Step 3: Commit**

```bash
git add src/server.test.ts docs/sprints/stories/US-2.4-tool-substrate-and-layout.md
git commit -m "test: assert key-leak, annotation and error-shape invariants across every tool"
```

---

### Task 9: Scope documentation, CONTEXT decisions, and the 0.2.0 release

Closes US-2.4.

**Files:**
- Modify: `VERSION`, `package.json`, `src/config.ts` (all three carry the version)
- Modify: `docs/CHANGELOG.md`, `docs/CONTEXT.md`, `docs/SETUP.md`, `.env.example`, `README.md`
- Modify: `CLAUDE.md` (Active Context), `docs/sprints/stories/US-2.4-tool-substrate-and-layout.md`, `docs/sprints/sprint-2026-W33.md`

**Interfaces:**
- Consumes: everything from Tasks 1–8.
- Produces: version `0.2.0`.

- [ ] **Step 1: Bump the version in all three places**

`VERSION` → `0.2.0` (bare, no `v` — RULE-16). `package.json` `"version": "0.2.0"`. `src/config.ts`:

```ts
export const SERVER_VERSION = '0.2.0';
```

- [ ] **Step 2: Document the five scopes**

The key now needs `accounts:read`, `brokers:read`, `strategies:read`, `performance:read`, `trading:read`. Update `docs/SETUP.md`'s env-var reference, `.env.example`, and `README.md` — all three in this commit (RULE-11 requires SETUP.md and `.env.example` together; README is the install path a user follows).

State the failure mode explicitly, because it is not obvious: **there is no key-introspection endpoint, so a missing scope cannot be detected at startup.** It surfaces as a `403` naming the scope when the affected tool is first called, and every other tool keeps working.

- [ ] **Step 3: Append three CONTEXT decisions**

Find the next number first (RULE-7 is append-only; never edit an existing entry):

```bash
grep -n "^### D[0-9]" docs/CONTEXT.md | tail -1
```

Expected: `D6`. Append `D7`, `D8`, `D9` under a new `## Phase 2 — Read-tool expansion (2026-08-06)` heading, each with the repo's Context / Decision / Rationale / Alternatives considered / Impact / Date / Version shape:

- **D7 — `core/` and `tools/<tag>/` replace the flat layout.** Reverses the AGENTS.md rule written for six source files, now at sixteen. Note the three anchors: recursive tsconfig globs, `src/index.ts` immovable, `test:smoke` hardcodes its path.
- **D8 — `registerReadTool`, not a descriptor table.** The v1 spec deferred this to "revisit when the repetition is real". It is real, and it is the mechanical `try`/`catch` — not the descriptions and schemas, which are what decide whether a model picks the right tool and which a table would swallow into data. Record that the annotations became constants, which makes the helper a barrier against a write tool landing before EPIC-3.
- **D9 — tools bound and shape their own payloads.** Record the alternative rejected (mirror the API, trust the host's context window) and why it fails: a year-long `breakdowns` window is roughly 70k tokens. Record that every cut leaves a `notes` trace.

- [ ] **Step 4: Add the CHANGELOG entry**

`docs/CHANGELOG.md`, a `## [0.2.0] — 2026-08-06` section. No commit SHA in it (RULE-2). Cover: the `core/` + `tools/` restructure; `query`, `accountPath`, `404`/`409` in the client; `registerReadTool`; the table-driven invariant tests; the five-scope requirement; the corrected operation count.

- [ ] **Step 5: Close the story and refresh Active Context**

In `US-2.4-tool-substrate-and-layout.md`: `status: done`, `version_shipped: 0.2.0` (bare), all tasks `[x]`, all AC `[x]`, and the `commit:` field left for a follow-up backfill (RULE-2 — never `--amend` it in).

In `CLAUDE.md`, refresh the Active Context block: sprint W33, US-2.4 closed, next up US-2.5, Last Version 0.2.0, and D7–D9 in Recent Decisions.

- [ ] **Step 6: Run the full gate**

```bash
npm test && npm run typecheck && npm run build && npm run agile:validate && npm run agile:status
```

Expected: all pass, `agile:validate` exits 0.

Then verify the built artifact by hand, because `dist/` layout is what the restructure could plausibly have broken:

```bash
node dist/index.js 2>&1 | head -3
SENTI_API_KEY=sq_live_placeholder node dist/index.js 1>/tmp/stdout-check 2>/dev/null &
sleep 1; kill %1; test ! -s /tmp/stdout-check && echo "stdout clean"
```

Expected: the first exits 1 naming `SENTI_API_KEY`; the second prints `stdout clean`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: restructure into core/ and tools/, add the read-tool substrate

Ships 0.2.0. No new tool: this is the shape the remaining nine read tools
are built into. Records D7 (layout), D8 (registerReadTool over a descriptor
table) and D9 (payload shaping)."
```

---

### Task 10: `list_brokers` — domain module

**Files:**
- Create: `src/tools/brokers/list-brokers.ts`
- Test: `src/tools/brokers/list-brokers.test.ts`

**Interfaces:**
- Consumes: nothing at runtime — this half imports no MCP and no client, so it is tested by direct calls.
- Produces: `BrokerSchema`, `BrokersOutputSchema`, `parseBrokers(payload): Broker[]`, `formatBrokers(brokers): string`, `type Broker`.

Transcribed from the live OpenAPI document: `GET /api/v1/brokers` returns a bare array; every field of every object is required and none is nullable.

- [ ] **Step 1: Write the failing tests**

Create `src/tools/brokers/list-brokers.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { type Broker, formatBrokers, parseBrokers } from './list-brokers.js';

const BROKER: Broker = {
  id: 'b1',
  name: 'Exness',
  servers: ['Exness-MT5Trial6', 'Exness-MT5Real'],
  accountTypes: [
    { id: 'at1', name: 'Standard', defaultSymbol: 'EURUSD' },
    { id: 'at2', name: 'Pro', defaultSymbol: 'XAUUSD' },
  ],
};

describe('parseBrokers', () => {
  test('accepts a well-formed broker list', () => {
    expect(parseBrokers([BROKER])).toEqual([BROKER]);
  });

  test('strips fields the schema does not declare', () => {
    const parsed = parseBrokers([{ ...BROKER, internalRank: 3 }]);

    expect(parsed[0]).not.toHaveProperty('internalRank');
  });

  test('rejects a broker missing a required field, naming it', () => {
    const { servers: _dropped, ...incomplete } = BROKER;

    expect(() => parseBrokers([incomplete])).toThrow(/servers/);
  });

  test('rejects a payload that is not an array', () => {
    expect(() => parseBrokers({ brokers: [] })).toThrow(/unexpected shape/);
  });
});

describe('formatBrokers', () => {
  test('states that the catalog is platform-wide rather than the linked accounts', () => {
    expect(formatBrokers([BROKER])).toMatch(/platform-wide/i);
  });

  test('renders servers and account types with the id needed to link an account', () => {
    const rendered = formatBrokers([BROKER]);

    expect(rendered).toContain('Exness');
    expect(rendered).toContain('Exness-MT5Trial6');
    expect(rendered).toContain('Standard');
    expect(rendered).toContain('at1');
    expect(rendered).toContain('EURUSD');
  });

  test('agrees in number', () => {
    expect(formatBrokers([BROKER])).toContain('1 broker');
    expect(formatBrokers([BROKER, { ...BROKER, id: 'b2', name: 'Vantage' }])).toContain(
      '2 brokers',
    );
  });

  test('explains an empty catalog rather than returning nothing', () => {
    expect(formatBrokers([]).length).toBeGreaterThan(0);
    expect(formatBrokers([])).toMatch(/no active brokers/i);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run src/tools/brokers/list-brokers.test.ts
```

Expected: FAIL — `Cannot find module './list-brokers.js'`.

- [ ] **Step 3: Implement**

Create `src/tools/brokers/list-brokers.ts`:

```ts
import * as z from 'zod/v4';
import { parseOrThrow } from '../../core/parse.js';

const AccountTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  defaultSymbol: z.string(),
});

/**
 * Transcribed from `GET /api/v1/brokers` in the live OpenAPI document. Every
 * field is required and none is nullable — unusually simple for this API, and
 * worth stating so a future reader does not add `.nullable()` defensively.
 */
export const BrokerSchema = z.object({
  id: z.string(),
  name: z.string(),
  servers: z.array(z.string()),
  accountTypes: z.array(AccountTypeSchema),
});

export type Broker = z.infer<typeof BrokerSchema>;

export const BrokersOutputSchema = z.object({
  brokers: z.array(BrokerSchema),
});

export function parseBrokers(payload: unknown): Broker[] {
  return parseOrThrow(z.array(BrokerSchema), payload, 'broker list');
}

function block(broker: Broker): string {
  const servers = broker.servers.length > 0 ? broker.servers.join(', ') : '—';
  const types =
    broker.accountTypes.length > 0
      ? broker.accountTypes
          .map((type) => `${type.name} [id ${type.id}, default ${type.defaultSymbol}]`)
          .join(', ')
      : '—';

  return [
    `- ${broker.name} (brokerId ${broker.id})`,
    `  servers: ${servers}`,
    `  account types: ${types}`,
  ].join('\n');
}

export function formatBrokers(brokers: Broker[]): string {
  if (brokers.length === 0) {
    return (
      'No active brokers in the Senti catalog. This is a platform-wide list, so an empty ' +
      'result points at the service rather than at this API key.'
    );
  }

  const noun = brokers.length === 1 ? 'broker' : 'brokers';
  const blocks = brokers.map(block).join('\n\n');

  // Naming the scope of the list is load-bearing: read plainly, "brokers" is
  // easily taken for "the brokers this user trades with".
  return (
    `${brokers.length} ${noun} in the platform-wide Senti catalog — these are the brokers ` +
    'available to link, not the accounts this API key already has.\n\n' +
    blocks
  );
}
```

- [ ] **Step 4: Run to verify they pass**

```bash
npx vitest run src/tools/brokers/list-brokers.test.ts
```

Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/tools/brokers docs/sprints/stories/US-2.5-list-brokers-tool.md
git commit -m "feat: add the brokers schema, parser and text rendering"
```

---

### Task 11: `list_brokers` — registration and the 0.3.0 release

Closes US-2.5.

**Files:**
- Modify: `src/tools/brokers/list-brokers.ts` (add `registerListBrokers`)
- Modify: `src/server.ts`, `src/server.test.ts`
- Modify: `VERSION`, `package.json`, `src/config.ts`, `docs/CHANGELOG.md`, `README.md`, `CLAUDE.md`, `docs/sprints/stories/US-2.5-list-brokers-tool.md`

**Interfaces:**
- Consumes: `registerReadTool`, `type SentiClient`, and Task 10's exports.
- Produces: `registerListBrokers(server: McpServer, client: SentiClient): void`.

- [ ] **Step 1: Write the failing test**

Append to `src/server.test.ts`, and add `list_brokers` to the `TOOL_CALLS` table so every invariant test from Task 8 starts covering it:

```ts
const BROKER = {
  id: 'b1',
  name: 'Exness',
  servers: ['Exness-MT5Trial6'],
  accountTypes: [{ id: 'at1', name: 'Standard', defaultSymbol: 'EURUSD' }],
};

describe('list_brokers', () => {
  test('returns a readable summary and matching structured content', async () => {
    const brokersFetch = (async () =>
      new Response(JSON.stringify([BROKER]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch;
    const client = await connect(brokersFetch);

    const result = (await client.callTool({ name: 'list_brokers' })) as ToolResult;

    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('Exness');
    expect(BrokersOutputSchema.safeParse(result.structuredContent).success).toBe(true);
  });

  test('tells the model the catalog is platform-wide', async () => {
    const client = await connect();

    const { tools } = await client.listTools();
    const brokers = tools.find((tool) => tool.name === 'list_brokers');

    expect(brokers?.description).toMatch(/platform-wide/i);
  });

  test('takes no arguments', async () => {
    const client = await connect();

    const { tools } = await client.listTools();
    const brokers = tools.find((tool) => tool.name === 'list_brokers');

    expect(brokers?.inputSchema.properties).toEqual({});
  });

  test('names the brokers:read scope on 403', async () => {
    const forbidden = (async () =>
      new Response(
        JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Insufficient scope.' } }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      )) as unknown as typeof fetch;
    const client = await connect(forbidden);

    const result = (await client.callTool({ name: 'list_brokers' })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('brokers:read');
  });
});
```

Add the import at the top of the file:

```ts
import { BrokersOutputSchema } from './tools/brokers/list-brokers.js';
```

And extend the table:

```ts
const TOOL_CALLS: {
  name: string;
  arguments?: Record<string, unknown>;
  outputSchema: z.ZodType;
  successBody: unknown;
}[] = [
  { name: 'list_accounts', outputSchema: AccountsOutputSchema, successBody: [ACCOUNT] },
  { name: 'list_brokers', outputSchema: BrokersOutputSchema, successBody: [BROKER] },
];
```

> **`outputSchema` and `successBody` are required row fields**, added in Task 9 when AC-9's
> second clause was generalised into this table. They are deliberately non-optional, so
> omitting either is a compile error rather than a silent gap in coverage. `successBody` is
> the raw HTTP body a stubbed `fetch` returns — the shape the real API sends, so for
> `list_brokers` that is a **bare array**, not `{ brokers: [...] }`.

Note that the default `okFetch` returns an account array for every path, which `parseBrokers` rejects — so the two description/schema tests above call `connect()` without a fetch only because they never invoke the tool. Tests that *call* `list_brokers` supply their own fetch.

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run src/server.test.ts -t 'list_brokers'
```

Expected: FAIL — `Tool list_brokers not found`.

- [ ] **Step 3: Implement**

Append to `src/tools/brokers/list-brokers.ts`, adding the three imports at the top:

```ts
import type { McpServer } from '@modelcontextprotocol/server';
import type { SentiClient } from '../../core/client.js';
import { registerReadTool } from '../../core/tool.js';
```

```ts
/** The scope `GET /api/v1/brokers` requires, quoted back in the 403 message. */
const BROKERS_READ = 'brokers:read';

export function registerListBrokers(server: McpServer, client: SentiClient): void {
  registerReadTool(server, {
    name: 'list_brokers',
    title: 'List brokers available to link',
    description:
      'List the brokers Senti Quant supports, with each broker\'s MT5 server names and ' +
      'account types. This is the platform-wide catalog of what can be linked — it is ' +
      'NOT the set of accounts this API key already has, which is `list_accounts`. Use ' +
      '`accountTypes[].id` as `brokerAccountTypeId` and a `servers[]` value as `server` ' +
      'when linking a new account.',
    inputSchema: z.object({}),
    outputSchema: BrokersOutputSchema,
    run: async (_args, signal) => {
      const payload = await client.get('/api/v1/brokers', { signal, scope: BROKERS_READ });
      const brokers = parseBrokers(payload);

      return { text: formatBrokers(brokers), structured: { brokers } };
    },
  });
}
```

In `src/server.ts`, add the import and the call:

```ts
import { registerListBrokers } from './tools/brokers/list-brokers.js';
```

```ts
  registerListAccounts(server, client);
  registerListBrokers(server, client);
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test && npm run typecheck
```

Expected: PASS. The Task 8 invariant tests now run against two tools; the "table lists every registered tool" test proves the table was not forgotten.

- [ ] **Step 5: Ship 0.3.0 and close the story**

- `VERSION`, `package.json`, `src/config.ts` → `0.3.0`
- `docs/CHANGELOG.md` → `## [0.3.0] — 2026-08-06` describing `list_brokers`
- `README.md` → add `list_brokers` to the tool list and `brokers:read` to the scope list
- `US-2.5-list-brokers-tool.md` → `status: done`, `version_shipped: 0.3.0`, all boxes `[x]`
- `CLAUDE.md` Active Context → US-2.5 closed, next up US-2.6, Last Version 0.3.0

```bash
npm run agile:validate && npm run agile:status
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add the list_brokers tool

Ships 0.3.0. First tool built on the US-2.4 substrate."
```

---

### Task 12: `list_strategies` — domain module

**Files:**
- Create: `src/tools/strategies/list-strategies.ts`
- Test: `src/tools/strategies/list-strategies.test.ts`

**Interfaces:**
- Consumes: nothing at runtime.
- Produces: `StrategySchema`, `StrategiesOutputSchema`, `parseStrategies`, `formatStrategies`, `type Strategy`.

**The one trap here:** `description`, `supportedSymbols` and `supportedTimeframes` are absent from the endpoint's `required` array. They are **optional**, not merely nullable — a response omitting them entirely is valid, and a schema that only marks them `.nullable()` would reject real data.

- [ ] **Step 1: Write the failing tests**

Create `src/tools/strategies/list-strategies.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { type Strategy, formatStrategies, parseStrategies } from './list-strategies.js';

const STRATEGY: Strategy = {
  id: 's1',
  name: 'TrendRider',
  description: 'Follows the daily trend.',
  isActive: true,
  supportedSymbols: ['EURUSD', 'XAUUSD'],
  supportedTimeframes: ['H1', 'H4'],
  avgRating: 4.5,
  reviewCount: 12,
  presets: [{ id: 'p1', name: 'Conservative' }],
};

describe('parseStrategies', () => {
  test('accepts a well-formed strategy list', () => {
    expect(parseStrategies([STRATEGY])).toEqual([STRATEGY]);
  });

  test('accepts a strategy omitting the three optional fields entirely', () => {
    const minimal = {
      id: 's2',
      name: 'Minimal',
      isActive: false,
      avgRating: null,
      reviewCount: 0,
      presets: [],
    };

    expect(() => parseStrategies([minimal])).not.toThrow();
  });

  test('accepts a null description and a null avgRating', () => {
    expect(() =>
      parseStrategies([{ ...STRATEGY, description: null, avgRating: null }]),
    ).not.toThrow();
  });

  test('rejects a strategy missing a genuinely required field, naming it', () => {
    const { presets: _dropped, ...incomplete } = STRATEGY;

    expect(() => parseStrategies([incomplete])).toThrow(/presets/);
  });

  test('rejects a payload that is not an array', () => {
    expect(() => parseStrategies({ strategies: [] })).toThrow(/unexpected shape/);
  });
});

describe('formatStrategies', () => {
  test('states that the catalog is platform-wide', () => {
    expect(formatStrategies([STRATEGY])).toMatch(/platform-wide/i);
  });

  test('renders a null avgRating as an em dash, never as zero', () => {
    const rendered = formatStrategies([{ ...STRATEGY, avgRating: null, reviewCount: 0 }]);

    expect(rendered).toContain('rating —');
    expect(rendered).not.toContain('rating 0');
  });

  test('renders a present rating with its review count', () => {
    expect(formatStrategies([STRATEGY])).toContain('rating 4.5 (12 reviews)');
  });

  test('omits the symbols line when the field is absent rather than printing undefined', () => {
    const rendered = formatStrategies([
      { id: 's2', name: 'Minimal', isActive: true, avgRating: null, reviewCount: 0, presets: [] },
    ]);

    expect(rendered).not.toContain('undefined');
    expect(rendered).not.toContain('symbols:');
  });

  test('marks an inactive strategy', () => {
    expect(formatStrategies([{ ...STRATEGY, isActive: false }])).toContain('inactive');
  });

  test('explains an empty catalog', () => {
    expect(formatStrategies([])).toMatch(/no active strategies/i);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run src/tools/strategies/list-strategies.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/tools/strategies/list-strategies.ts`:

```ts
import * as z from 'zod/v4';
import { parseOrThrow } from '../../core/parse.js';

const PresetSchema = z.object({
  id: z.string(),
  name: z.string(),
});

/**
 * Transcribed from `GET /api/v1/strategies` in the live OpenAPI document.
 *
 * `description`, `supportedSymbols` and `supportedTimeframes` are absent from
 * the endpoint's `required` array — they are optional, not merely nullable. A
 * schema marking them only `.nullable()` would reject a response that omits
 * them, which the API is entitled to send.
 */
export const StrategySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  isActive: z.boolean(),
  supportedSymbols: z.array(z.string()).optional(),
  supportedTimeframes: z.array(z.string()).optional(),
  avgRating: z.number().nullable(),
  reviewCount: z.number().int(),
  presets: z.array(PresetSchema),
});

export type Strategy = z.infer<typeof StrategySchema>;

export const StrategiesOutputSchema = z.object({
  strategies: z.array(StrategySchema),
});

export function parseStrategies(payload: unknown): Strategy[] {
  return parseOrThrow(z.array(StrategySchema), payload, 'strategy list');
}

/** A null rating renders as this, never as `0` — no reviews is not a bad score. */
const NO_VALUE = '—';

function block(strategy: Strategy): string {
  const rating =
    strategy.avgRating === null
      ? `rating ${NO_VALUE}`
      : `rating ${strategy.avgRating} (${strategy.reviewCount} reviews)`;
  const state = strategy.isActive ? 'active' : 'inactive';

  const lines = [
    `- ${strategy.name} (strategyId ${strategy.id}) — ${state} · ${rating}`,
  ];

  if (strategy.description) lines.push(`  ${strategy.description}`);
  if (strategy.supportedSymbols?.length) {
    lines.push(`  symbols: ${strategy.supportedSymbols.join(', ')}`);
  }
  if (strategy.supportedTimeframes?.length) {
    lines.push(`  timeframes: ${strategy.supportedTimeframes.join(', ')}`);
  }
  if (strategy.presets.length > 0) {
    lines.push(
      `  presets: ${strategy.presets.map((preset) => `${preset.name} [id ${preset.id}]`).join(', ')}`,
    );
  }

  return lines.join('\n');
}

export function formatStrategies(strategies: Strategy[]): string {
  if (strategies.length === 0) {
    return (
      'No active strategies in the Senti catalog. This is a platform-wide list, so an ' +
      'empty result points at the service rather than at this API key.'
    );
  }

  const noun = strategies.length === 1 ? 'strategy' : 'strategies';
  const blocks = strategies.map(block).join('\n\n');

  return (
    `${strategies.length} ${noun} in the platform-wide Senti catalog — these are the ` +
    'strategies available to deploy, NOT the ones currently running on an account. For ' +
    'that, use list_account_strategies.\n\n' +
    blocks
  );
}
```

- [ ] **Step 4: Run to verify they pass**

```bash
npx vitest run src/tools/strategies/list-strategies.test.ts
```

Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/tools/strategies docs/sprints/stories/US-2.6-list-strategies-tool.md
git commit -m "feat: add the strategies catalog schema, parser and rendering"
```

---

### Task 13: `list_strategies` — registration and the 0.4.0 release

Closes US-2.6.

**Files:**
- Modify: `src/tools/strategies/list-strategies.ts`, `src/server.ts`, `src/server.test.ts`
- Modify: `VERSION`, `package.json`, `src/config.ts`, `docs/CHANGELOG.md`, `README.md`, `CLAUDE.md`, `docs/sprints/stories/US-2.6-list-strategies-tool.md`

**Interfaces:**
- Consumes: Task 12's exports, `registerReadTool`, `type SentiClient`.
- Produces: `registerListStrategies(server: McpServer, client: SentiClient): void`.

- [ ] **Step 1: Write the failing test**

Append to `src/server.test.ts`, and add the import and table row:

```ts
import { StrategiesOutputSchema } from './tools/strategies/list-strategies.js';
```

```ts
const TOOL_CALLS: {
  name: string;
  arguments?: Record<string, unknown>;
  outputSchema: z.ZodType;
  successBody: unknown;
}[] = [
  { name: 'list_accounts', outputSchema: AccountsOutputSchema, successBody: [ACCOUNT] },
  { name: 'list_brokers', outputSchema: BrokersOutputSchema, successBody: [BROKER] },
  { name: 'list_strategies', outputSchema: StrategiesOutputSchema, successBody: [STRATEGY] },
];
```

> `successBody` is the raw HTTP body, so for `list_strategies` it is a **bare array**.

```ts
const STRATEGY = {
  id: 's1',
  name: 'TrendRider',
  description: 'Follows the daily trend.',
  isActive: true,
  supportedSymbols: ['EURUSD'],
  supportedTimeframes: ['H1'],
  avgRating: 4.5,
  reviewCount: 12,
  presets: [{ id: 'p1', name: 'Conservative' }],
};

describe('list_strategies', () => {
  test('returns a readable summary and matching structured content', async () => {
    const strategiesFetch = (async () =>
      new Response(JSON.stringify([STRATEGY]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch;
    const client = await connect(strategiesFetch);

    const result = (await client.callTool({ name: 'list_strategies' })) as ToolResult;

    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('TrendRider');
    expect(StrategiesOutputSchema.safeParse(result.structuredContent).success).toBe(true);
  });

  test('sends the model to list_account_strategies for what is actually running', async () => {
    const client = await connect();

    const { tools } = await client.listTools();
    const strategies = tools.find((tool) => tool.name === 'list_strategies');

    expect(strategies?.description).toMatch(/platform-wide/i);
    expect(strategies?.description).toMatch(/list_account_strategies/);
  });

  test('names the strategies:read scope on 403', async () => {
    const forbidden = (async () =>
      new Response(
        JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Insufficient scope.' } }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      )) as unknown as typeof fetch;
    const client = await connect(forbidden);

    const result = (await client.callTool({ name: 'list_strategies' })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('strategies:read');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run src/server.test.ts -t 'list_strategies'
```

Expected: FAIL — tool not found.

- [ ] **Step 3: Implement**

Append to `src/tools/strategies/list-strategies.ts`, adding the three imports at the top:

```ts
import type { McpServer } from '@modelcontextprotocol/server';
import type { SentiClient } from '../../core/client.js';
import { registerReadTool } from '../../core/tool.js';
```

```ts
/** The scope `GET /api/v1/strategies` requires, quoted back in the 403 message. */
const STRATEGIES_READ = 'strategies:read';

export function registerListStrategies(server: McpServer, client: SentiClient): void {
  registerReadTool(server, {
    name: 'list_strategies',
    title: 'List deployable strategies',
    description:
      'List every strategy (expert advisor) available to deploy on Senti Quant, with its ' +
      'supported symbols, timeframes, rating and presets. This is the platform-wide ' +
      'catalog of what COULD be deployed — it is NOT what is currently running on an ' +
      'account. For the strategies running on a specific account, use ' +
      'list_account_strategies. Use `id` as `eaDefinitionId` when deploying.',
    inputSchema: z.object({}),
    outputSchema: StrategiesOutputSchema,
    run: async (_args, signal) => {
      const payload = await client.get('/api/v1/strategies', { signal, scope: STRATEGIES_READ });
      const strategies = parseStrategies(payload);

      return { text: formatStrategies(strategies), structured: { strategies } };
    },
  });
}
```

In `src/server.ts`:

```ts
import { registerListStrategies } from './tools/strategies/list-strategies.js';
```

```ts
  registerListStrategies(server, client);
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test && npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Ship 0.4.0 and close the story**

- `VERSION`, `package.json`, `src/config.ts` → `0.4.0`
- `docs/CHANGELOG.md` → `## [0.4.0] — 2026-08-06` describing `list_strategies`, and noting that `description`, `supportedSymbols` and `supportedTimeframes` are optional in the upstream schema
- `README.md` → add `list_strategies` to the tool list and `strategies:read` to the scope list
- `US-2.6-list-strategies-tool.md` → `status: done`, `version_shipped: 0.4.0`, all tasks and AC `[x]`
- `CLAUDE.md` Active Context → US-2.6 closed, next up US-2.7, Last Version 0.4.0

```bash
npm run agile:validate && npm run agile:status
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add the list_strategies tool

Ships 0.4.0."
```

---

### Task 14: `list_account_strategies` — domain module

**Files:**
- Create: `src/tools/strategies/list-account-strategies.ts`
- Test: `src/tools/strategies/list-account-strategies.test.ts`

**Interfaces:**
- Consumes: nothing at runtime.
- Produces: `AccountStrategySchema`, `AccountStrategiesOutputSchema`, `parseAccountStrategies`, `formatAccountStrategies`, `type AccountStrategy`.

Every field is required; only `chartId` is nullable.

- [ ] **Step 1: Write the failing tests**

Create `src/tools/strategies/list-account-strategies.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import {
  type AccountStrategy,
  formatAccountStrategies,
  parseAccountStrategies,
} from './list-account-strategies.js';

const DEPLOYED: AccountStrategy = {
  id: 'ae1',
  mt5AccountId: '8f2c1b40-3d5e-4a17-9c8b-2e1f0a6d4b93',
  eaDefinitionId: 's1',
  symbol: 'EURUSD',
  timeframe: 'H1',
  status: 'RUNNING',
  chartId: '12345',
  eaDefinition: { name: 'TrendRider' },
  mt5Account: { id: '8f2c1b40-3d5e-4a17-9c8b-2e1f0a6d4b93', login: '51234567', label: 'Main Live' },
};

describe('parseAccountStrategies', () => {
  test('accepts a well-formed deployment list', () => {
    expect(parseAccountStrategies([DEPLOYED])).toEqual([DEPLOYED]);
  });

  test('accepts a null chartId', () => {
    expect(() => parseAccountStrategies([{ ...DEPLOYED, chartId: null }])).not.toThrow();
  });

  test('rejects a deployment missing a required field, naming it', () => {
    const { timeframe: _dropped, ...incomplete } = DEPLOYED;

    expect(() => parseAccountStrategies([incomplete])).toThrow(/timeframe/);
  });

  test('rejects a payload that is not an array', () => {
    expect(() => parseAccountStrategies({ strategies: [] })).toThrow(/unexpected shape/);
  });
});

describe('formatAccountStrategies', () => {
  test('renders the strategy name, symbol, timeframe and status', () => {
    const rendered = formatAccountStrategies([DEPLOYED]);

    expect(rendered).toContain('TrendRider');
    expect(rendered).toContain('EURUSD');
    expect(rendered).toContain('H1');
    expect(rendered).toContain('RUNNING');
  });

  test('shows the activeEaId, which is the handle for stopping a deployment', () => {
    expect(formatAccountStrategies([DEPLOYED])).toContain('activeEaId: ae1');
  });

  test('agrees in number', () => {
    expect(formatAccountStrategies([DEPLOYED])).toContain('1 strategy');
    expect(formatAccountStrategies([DEPLOYED, { ...DEPLOYED, id: 'ae2' }])).toContain(
      '2 strategies',
    );
  });

  test('explains an empty deployment list without implying an error', () => {
    const rendered = formatAccountStrategies([]);

    expect(rendered).toMatch(/no strategies/i);
    expect(rendered).toMatch(/list_strategies/);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run src/tools/strategies/list-account-strategies.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/tools/strategies/list-account-strategies.ts`:

```ts
import * as z from 'zod/v4';
import { parseOrThrow } from '../../core/parse.js';

/**
 * Transcribed from `GET /api/v1/accounts/{accountId}/strategies` in the live
 * OpenAPI document. Every field is required; only `chartId` is nullable.
 */
export const AccountStrategySchema = z.object({
  id: z.string(),
  mt5AccountId: z.string(),
  eaDefinitionId: z.string(),
  symbol: z.string(),
  timeframe: z.string(),
  status: z.string(),
  chartId: z.string().nullable(),
  eaDefinition: z.object({ name: z.string() }),
  mt5Account: z.object({
    id: z.string(),
    login: z.string(),
    label: z.string().nullable(),
  }),
});

export type AccountStrategy = z.infer<typeof AccountStrategySchema>;

export const AccountStrategiesOutputSchema = z.object({
  strategies: z.array(AccountStrategySchema),
});

export function parseAccountStrategies(payload: unknown): AccountStrategy[] {
  return parseOrThrow(z.array(AccountStrategySchema), payload, 'deployed-strategy list');
}

function block(deployed: AccountStrategy): string {
  return [
    `- ${deployed.eaDefinition.name} on ${deployed.symbol} ${deployed.timeframe} — ${deployed.status}`,
    // `id` is what POST …/strategies/{activeEaId}/stop takes. Naming it as
    // `activeEaId` here stops a model reaching for `eaDefinitionId`, which is
    // the catalog entry and cannot be stopped.
    `  activeEaId: ${deployed.id} · eaDefinitionId: ${deployed.eaDefinitionId}`,
  ].join('\n');
}

export function formatAccountStrategies(strategies: AccountStrategy[]): string {
  if (strategies.length === 0) {
    return (
      'No strategies are deployed on this account. This is a real zero rather than a ' +
      'failure — the account exists and was readable. Use list_strategies to see what ' +
      'is available to deploy.'
    );
  }

  const noun = strategies.length === 1 ? 'strategy' : 'strategies';
  const blocks = strategies.map(block).join('\n\n');

  return `${strategies.length} ${noun} deployed on this account.\n\n${blocks}`;
}
```

- [ ] **Step 4: Run to verify they pass**

```bash
npx vitest run src/tools/strategies/list-account-strategies.test.ts
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/tools/strategies docs/sprints/stories/US-2.7-list-account-strategies-tool.md
git commit -m "feat: add the deployed-strategy schema, parser and rendering"
```

---

### Task 15: `list_account_strategies` — the first path parameter, and the 0.5.0 release

Closes US-2.7. **This is the task the `accountPath` guard exists for.** Every account-scoped tool after it copies this registration.

**Files:**
- Modify: `src/tools/strategies/list-account-strategies.ts`, `src/server.ts`, `src/server.test.ts`
- Modify: `VERSION`, `package.json`, `src/config.ts`, `docs/CHANGELOG.md`, `README.md`, `CLAUDE.md`, `docs/sprints/stories/US-2.7-list-account-strategies-tool.md`

**Interfaces:**
- Consumes: Task 14's exports, `accountPath` (Task 4), `registerReadTool` (Task 6).
- Produces: `registerListAccountStrategies(server: McpServer, client: SentiClient): void`.

- [ ] **Step 1: Write the failing tests**

Append to `src/server.test.ts`; add the import and the table row (note this row carries `arguments`, which is why `TOOL_CALLS` was typed to allow them in Task 8):

```ts
import { AccountStrategiesOutputSchema } from './tools/strategies/list-account-strategies.js';
```

```ts
const TOOL_CALLS: {
  name: string;
  arguments?: Record<string, unknown>;
  outputSchema: z.ZodType;
  successBody: unknown;
}[] = [
  { name: 'list_accounts', outputSchema: AccountsOutputSchema, successBody: [ACCOUNT] },
  { name: 'list_brokers', outputSchema: BrokersOutputSchema, successBody: [BROKER] },
  { name: 'list_strategies', outputSchema: StrategiesOutputSchema, successBody: [STRATEGY] },
  {
    name: 'list_account_strategies',
    arguments: { accountId: 'abc-123' },
    outputSchema: AccountStrategiesOutputSchema,
    successBody: [DEPLOYED],
  },
];
```

> This is the first row carrying `arguments` — the table's type has allowed it since Task 8
> precisely so this row would not need a type change. `successBody` is a **bare array** here.

```ts
const DEPLOYED = {
  id: 'ae1',
  mt5AccountId: 'abc-123',
  eaDefinitionId: 's1',
  symbol: 'EURUSD',
  timeframe: 'H1',
  status: 'RUNNING',
  chartId: '12345',
  eaDefinition: { name: 'TrendRider' },
  mt5Account: { id: 'abc-123', login: '51234567', label: 'Main Live' },
};

describe('list_account_strategies', () => {
  test('calls the account-scoped path and returns both channels', async () => {
    const calls: string[] = [];
    const deployedFetch = (async (url: string | URL) => {
      calls.push(String(url));
      return new Response(JSON.stringify([DEPLOYED]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    const client = await connect(deployedFetch);

    const result = (await client.callTool({
      name: 'list_account_strategies',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect(calls[0]).toBe('https://be-dev.sentitrade.xyz/api/v1/accounts/abc-123/strategies');
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('TrendRider');
    expect(AccountStrategiesOutputSchema.safeParse(result.structuredContent).success).toBe(true);
  });

  test('rejects a traversal attempt before any HTTP call happens', async () => {
    let called = false;
    const watching = (async () => {
      called = true;
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;
    const client = await connect(watching);

    const result = (await client.callTool({
      name: 'list_account_strategies',
      arguments: { accountId: '../../admin' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/Invalid path segment/);
    expect(called).toBe(false);
  });

  test('declares accountId as a required argument', async () => {
    const client = await connect();

    const { tools } = await client.listTools();
    const tool = tools.find((entry) => entry.name === 'list_account_strategies');

    expect(tool?.inputSchema.properties).toHaveProperty('accountId');
    expect(tool?.inputSchema.required).toContain('accountId');
  });

  test('tells the model to pass id rather than login', async () => {
    const client = await connect();

    const { tools } = await client.listTools();
    const tool = tools.find((entry) => entry.name === 'list_account_strategies');

    expect(tool?.description).toMatch(/list_accounts/);
    expect(tool?.description).toMatch(/login/);
  });

  test('turns a 404 into the login-versus-id hint', async () => {
    const missing = (async () =>
      new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found.' } }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch;
    const client = await connect(missing);

    const result = (await client.callTool({
      name: 'list_account_strategies',
      arguments: { accountId: '413878201' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/list_accounts/);
    expect(textOf(result)).toMatch(/login/);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run src/server.test.ts -t 'list_account_strategies'
```

Expected: FAIL — tool not found.

- [ ] **Step 3: Implement**

Append to `src/tools/strategies/list-account-strategies.ts`, adding the imports at the top:

```ts
import type { McpServer } from '@modelcontextprotocol/server';
import { accountPath, type SentiClient } from '../../core/client.js';
import { registerReadTool } from '../../core/tool.js';
```

```ts
/** The scope this endpoint requires, quoted back in the 403 message. */
const STRATEGIES_READ = 'strategies:read';

export function registerListAccountStrategies(server: McpServer, client: SentiClient): void {
  registerReadTool(server, {
    name: 'list_account_strategies',
    title: 'List strategies deployed on an account',
    description:
      'List the strategies (expert advisors) currently deployed on one MT5 account, with ' +
      'each deployment\'s symbol, timeframe and status. `accountId` is the `id` field from ' +
      'list_accounts — NOT `login`, which is the MT5 account number and is not a valid ' +
      'accountId. For the platform-wide catalog of strategies available to deploy, use ' +
      'list_strategies instead.',
    inputSchema: z.object({
      accountId: z
        .string()
        .describe('The `id` field from list_accounts. Not the `login` (MT5 account number).'),
    }),
    outputSchema: AccountStrategiesOutputSchema,
    run: async (args, signal) => {
      const payload = await client.get(accountPath(args.accountId, 'strategies'), {
        signal,
        scope: STRATEGIES_READ,
      });
      const strategies = parseAccountStrategies(payload);

      return { text: formatAccountStrategies(strategies), structured: { strategies } };
    },
  });
}
```

`accountPath` throws before `client.get` is entered, which is what makes the "no HTTP call happened" assertion in Step 1 meaningful — the guard is not merely a validation message, it is positioned so a bad value cannot reach the network.

In `src/server.ts`:

```ts
import { registerListAccountStrategies } from './tools/strategies/list-account-strategies.js';
```

```ts
  registerListAccountStrategies(server, client);
```

- [ ] **Step 4: Run to verify they pass**

```bash
npm test && npm run typecheck
```

Expected: PASS. Note that the Task 8 key-leak table now exercises a tool with arguments across all six error statuses.

- [ ] **Step 5: Ship 0.5.0 and close the story**

- `VERSION`, `package.json`, `src/config.ts` → `0.5.0`
- `docs/CHANGELOG.md` → `## [0.5.0] — 2026-08-06` describing `list_account_strategies`, and calling out that this is the first tool taking a path parameter and that it routes through `accountPath`, which rejects a traversal attempt before any HTTP call
- `README.md` → add `list_account_strategies` to the tool list; `strategies:read` is already listed
- `US-2.7-list-account-strategies-tool.md` → `status: done`, `version_shipped: 0.5.0`, all tasks and AC `[x]`
- `CLAUDE.md` Active Context → US-2.7 closed, next up US-2.8, Last Version 0.5.0

```bash
npm run agile:validate && npm run agile:status
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add the list_account_strategies tool

Ships 0.5.0. First tool with a path parameter; routes through accountPath,
which rejects a traversal attempt before any HTTP call is made."
```

---

### Task 16: `list_positions` — domain module

**Files:**
- Create: `src/tools/trading/positions.ts`
- Test: `src/tools/trading/positions.test.ts`

**Interfaces:**
- Consumes: nothing at runtime.
- Produces: `PositionSchema`, `PositionsOutputSchema`, `parsePositions(payload): Position[]`, `formatPositions(positions, notes): string`, `capPositions(positions): { positions: Position[]; notes: string[] }`, `type Position`.

Two things differ from every earlier tool. The API wraps its array in `{ positions: [...] }`, so `parsePositions` unwraps it. And MT5 uses `0` to mean "not set" for `sl` and `tp` — which is the null-is-not-zero invariant wearing a different disguise, because a position with `sl: 0` has **no stop loss**, not a stop loss at zero.

- [ ] **Step 1: Write the failing tests**

Create `src/tools/trading/positions.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { type Position, capPositions, formatPositions, parsePositions } from './positions.js';

const POSITION: Position = {
  ticket: 123456,
  symbol: 'EURUSD',
  type: 'POSITION_TYPE_BUY',
  volume: 0.1,
  priceOpen: 1.0855,
  priceCurrent: 1.0871,
  sl: 1.08,
  tp: 1.095,
  swap: -0.12,
  profit: 16.0,
  openTime: '2026-08-05T09:12:00Z',
  magic: 0,
  comment: 'TrendRider',
};

describe('parsePositions', () => {
  test('unwraps the positions array from the response envelope', () => {
    expect(parsePositions({ positions: [POSITION] })).toEqual([POSITION]);
  });

  test('accepts an empty positions array', () => {
    expect(parsePositions({ positions: [] })).toEqual([]);
  });

  test('rejects a bare array — the envelope is part of the contract', () => {
    expect(() => parsePositions([POSITION])).toThrow(/unexpected shape/);
  });

  test('rejects a position missing a required field, naming it', () => {
    const { profit: _dropped, ...incomplete } = POSITION;

    expect(() => parsePositions({ positions: [incomplete] })).toThrow(/profit/);
  });
});

describe('capPositions', () => {
  test('leaves a normal list untouched and records no note', () => {
    const result = capPositions([POSITION]);

    expect(result.positions).toHaveLength(1);
    expect(result.notes).toEqual([]);
  });

  test('truncates beyond 200 rows and says so', () => {
    const many = Array.from({ length: 250 }, (_item, index) => ({
      ...POSITION,
      ticket: index,
    }));

    const result = capPositions(many);

    expect(result.positions).toHaveLength(200);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]).toMatch(/250/);
    expect(result.notes[0]).toMatch(/200/);
  });
});

describe('formatPositions', () => {
  test('renders an unset stop loss as an em dash, never as zero', () => {
    const rendered = formatPositions([{ ...POSITION, sl: 0, tp: 0 }], []);

    expect(rendered).toContain('SL — · TP —');
    expect(rendered).not.toContain('SL 0.00');
  });

  test('renders a set stop loss and take profit', () => {
    const rendered = formatPositions([POSITION], []);

    expect(rendered).toContain('SL 1.08');
    expect(rendered).toContain('TP 1.095');
  });

  test('shows the ticket, which is the handle for closing a position', () => {
    expect(formatPositions([POSITION], [])).toContain('ticket 123456');
  });

  test('renders profit and swap', () => {
    const rendered = formatPositions([POSITION], []);

    expect(rendered).toContain('profit 16.00');
    expect(rendered).toContain('swap -0.12');
  });

  test('states that an empty list is a real zero, not an unreadable terminal', () => {
    const rendered = formatPositions([], []);

    expect(rendered).toMatch(/no open positions/i);
    expect(rendered).toMatch(/offline/i);
  });

  test('surfaces notes in the text, not only in structured content', () => {
    const rendered = formatPositions([POSITION], ['Truncated: showing 200 of 250 positions.']);

    expect(rendered).toContain('Truncated: showing 200 of 250 positions.');
  });

  test('agrees in number', () => {
    expect(formatPositions([POSITION], [])).toContain('1 open position');
    expect(formatPositions([POSITION, { ...POSITION, ticket: 2 }], [])).toContain(
      '2 open positions',
    );
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run src/tools/trading/positions.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/tools/trading/positions.ts`:

```ts
import * as z from 'zod/v4';
import { parseOrThrow } from '../../core/parse.js';

/**
 * Transcribed from `GET /api/v1/accounts/{accountId}/positions` in the live
 * OpenAPI document. Every field is required and none is nullable.
 */
export const PositionSchema = z.object({
  ticket: z.number(),
  symbol: z.string(),
  type: z.string(),
  volume: z.number(),
  priceOpen: z.number(),
  priceCurrent: z.number(),
  sl: z.number(),
  tp: z.number(),
  swap: z.number(),
  profit: z.number(),
  openTime: z.string(),
  magic: z.number(),
  comment: z.string(),
});

export type Position = z.infer<typeof PositionSchema>;

/** The response envelope, as the API sends it. */
const PositionsResponseSchema = z.object({
  positions: z.array(PositionSchema),
});

export const PositionsOutputSchema = z.object({
  positions: z.array(PositionSchema),
  /** Empty when nothing was cut. Its presence never implies truncation. */
  notes: z.array(z.string()),
});

export function parsePositions(payload: unknown): Position[] {
  return parseOrThrow(PositionsResponseSchema, payload, 'position list').positions;
}

/**
 * Defensive bound. A normal account holds a handful of positions; this exists
 * so a pathological one cannot flood the model's context, not because the API
 * paginates — it does not.
 */
const MAX_ROWS = 200;

export function capPositions(positions: Position[]): { positions: Position[]; notes: string[] } {
  if (positions.length <= MAX_ROWS) return { positions, notes: [] };

  return {
    positions: positions.slice(0, MAX_ROWS),
    notes: [
      `Truncated: showing ${MAX_ROWS} of ${positions.length} positions, ordered as the API ` +
        'returned them. Senti does not paginate this endpoint, so the remainder is not ' +
        'retrievable through this tool.',
    ],
  };
}

/** MT5 writes `0` into `sl`/`tp` to mean "not set". Zero is not a price here. */
const NO_VALUE = '—';

function price(value: number): string {
  return value === 0 ? NO_VALUE : String(value);
}

function money(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function block(position: Position): string {
  const lines = [
    `- ${position.symbol} ${position.type} ${position.volume} lots — ticket ${position.ticket}`,
    `  open ${position.priceOpen} → current ${position.priceCurrent} · ` +
      `SL ${price(position.sl)} · TP ${price(position.tp)}`,
    `  profit ${money(position.profit)} · swap ${money(position.swap)} · opened ${position.openTime}`,
  ];

  if (position.comment) lines.push(`  comment: ${position.comment}`);

  return lines.join('\n');
}

export function formatPositions(positions: Position[], notes: string[]): string {
  const trailer = notes.length > 0 ? `\n\n${notes.join('\n')}` : '';

  if (positions.length === 0) {
    // This sentence is the whole point of the 409 branch existing. An offline
    // terminal returns 409, so reaching this line means the terminal answered
    // and the account genuinely holds nothing.
    return (
      'No open positions on this account. The MT5 terminal answered, so this is a real ' +
      'zero — an offline terminal would have returned an error saying so instead.' +
      trailer
    );
  }

  const noun = positions.length === 1 ? 'position' : 'positions';
  const blocks = positions.map(block).join('\n\n');
  const total = positions.reduce((sum, position) => sum + position.profit, 0);

  return `${positions.length} open ${noun} · floating P&L ${money(total)}.\n\n${blocks}${trailer}`;
}
```

- [ ] **Step 4: Run to verify they pass**

```bash
npx vitest run src/tools/trading/positions.test.ts
```

Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add src/tools/trading docs/sprints/stories/US-2.8-list-positions-tool.md
git commit -m "feat: add the positions schema, cap, and text rendering

An sl or tp of 0 means 'not set' in MT5 and renders as an em dash."
```

---

### Task 17: `list_positions` — registration, the 409 branch, and the 0.6.0 release

Closes US-2.8.

**Files:**
- Modify: `src/tools/trading/positions.ts`, `src/server.ts`, `src/server.test.ts`
- Modify: `VERSION`, `package.json`, `src/config.ts`, `docs/CHANGELOG.md`, `README.md`, `CLAUDE.md`, `docs/sprints/stories/US-2.8-list-positions-tool.md`

**Interfaces:**
- Consumes: Task 16's exports, `accountPath`, `registerReadTool`, and `RequestOptions.conflictMeans` (Task 5).
- Produces: `registerListPositions(server: McpServer, client: SentiClient): void`.

- [ ] **Step 1: Write the failing tests**

Append to `src/server.test.ts`; add the import and the table row:

```ts
import { PositionsOutputSchema } from './tools/trading/positions.js';
```

```ts
  {
    name: 'list_positions',
    arguments: { accountId: 'abc-123' },
    outputSchema: PositionsOutputSchema,
    successBody: { positions: [POSITION] },
  },
```

```ts
const POSITION = {
  ticket: 123456,
  symbol: 'EURUSD',
  type: 'POSITION_TYPE_BUY',
  volume: 0.1,
  priceOpen: 1.0855,
  priceCurrent: 1.0871,
  sl: 0,
  tp: 0,
  swap: -0.12,
  profit: 16.0,
  openTime: '2026-08-05T09:12:00Z',
  magic: 0,
  comment: 'TrendRider',
};

describe('list_positions', () => {
  test('calls the account-scoped path and returns both channels', async () => {
    const calls: string[] = [];
    const positionsFetch = (async (url: string | URL) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ positions: [POSITION] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    const client = await connect(positionsFetch);

    const result = (await client.callTool({
      name: 'list_positions',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect(calls[0]).toBe('https://be-dev.sentitrade.xyz/api/v1/accounts/abc-123/positions');
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('ticket 123456');
    expect(PositionsOutputSchema.safeParse(result.structuredContent).success).toBe(true);
  });

  test('reports an offline terminal on 409 and distinguishes it from holding nothing', async () => {
    const offline = (async () =>
      new Response(
        JSON.stringify({ error: { code: 'CONFLICT', message: 'Terminal offline.' } }),
        { status: 409, headers: { 'content-type': 'application/json' } },
      )) as unknown as typeof fetch;
    const client = await connect(offline);

    const result = (await client.callTool({
      name: 'list_positions',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/terminal/i);
    expect(textOf(result)).toMatch(/offline/i);
    // The sentence that stops a model reporting "you have no open positions"
    // for an account that is holding open risk.
    expect(textOf(result)).toMatch(/not the same as/i);
  });

  test('an empty list is presented as a real zero', async () => {
    const emptyFetch = (async () =>
      new Response(JSON.stringify({ positions: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch;
    const client = await connect(emptyFetch);

    const result = (await client.callTool({
      name: 'list_positions',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toMatch(/real zero/i);
  });

  test('names the trading:read scope on 403', async () => {
    const forbidden = (async () =>
      new Response(
        JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Insufficient scope.' } }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      )) as unknown as typeof fetch;
    const client = await connect(forbidden);

    const result = (await client.callTool({
      name: 'list_positions',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('trading:read');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run src/server.test.ts -t 'list_positions'
```

Expected: FAIL — tool not found.

- [ ] **Step 3: Implement**

Append to `src/tools/trading/positions.ts`, adding the imports at the top:

```ts
import type { McpServer } from '@modelcontextprotocol/server';
import { accountPath, type SentiClient } from '../../core/client.js';
import { registerReadTool } from '../../core/tool.js';
```

```ts
/** The scope this endpoint requires, quoted back in the 403 message. */
const TRADING_READ = 'trading:read';

/**
 * What a 409 means here. The API declares it as "The account terminal is
 * offline — positions are temporarily unavailable", which is the one failure
 * a model must not read as "no open positions".
 */
const TERMINAL_OFFLINE =
  'The MT5 terminal for this account is offline, so its live positions cannot be read ' +
  'right now. This is NOT the same as the account holding no positions — any open ' +
  'positions are still open and still carrying risk.';

export function registerListPositions(server: McpServer, client: SentiClient): void {
  registerReadTool(server, {
    name: 'list_positions',
    title: 'List open positions on an account',
    description:
      'List the positions currently open on one MT5 account, read live from the terminal: ' +
      'symbol, direction, volume, open and current price, stop loss, take profit, swap and ' +
      'floating profit. `accountId` is the `id` field from list_accounts — NOT `login`. ' +
      'Each position\'s `ticket` is the handle used to close it. An `sl` or `tp` of 0 means ' +
      'no stop loss or take profit is set.',
    inputSchema: z.object({
      accountId: z
        .string()
        .describe('The `id` field from list_accounts. Not the `login` (MT5 account number).'),
    }),
    outputSchema: PositionsOutputSchema,
    run: async (args, signal) => {
      const payload = await client.get(accountPath(args.accountId, 'positions'), {
        signal,
        scope: TRADING_READ,
        conflictMeans: TERMINAL_OFFLINE,
      });
      const { positions, notes } = capPositions(parsePositions(payload));

      return { text: formatPositions(positions, notes), structured: { positions, notes } };
    },
  });
}
```

In `src/server.ts`:

```ts
import { registerListPositions } from './tools/trading/positions.js';
```

```ts
  registerListPositions(server, client);
```

- [ ] **Step 4: Run to verify they pass**

```bash
npm test && npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Ship 0.6.0 and close the story**

- `VERSION`, `package.json`, `src/config.ts` → `0.6.0`
- `docs/CHANGELOG.md` → `## [0.6.0] — 2026-08-06` describing `list_positions`. It **must** record the terminal-offline distinction: a `409` is reported as an offline terminal and explicitly separated from an account holding no positions. That behaviour is the one most likely to be misread as a bug by someone who has not read the spec
- `README.md` → add `list_positions` to the tool list and `trading:read` to the scope list
- `US-2.8-list-positions-tool.md` → `status: done`, `version_shipped: 0.6.0`, all tasks and AC `[x]`
- `CLAUDE.md` Active Context → US-2.8 closed, next up US-2.9, Last Version 0.6.0

```bash
npm run agile:validate && npm run agile:status
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add the list_positions tool

Ships 0.6.0. A 409 is reported as an offline terminal and explicitly
distinguished from an account holding no positions."
```

---

### Task 18: `list_pending_orders` — domain module

**Files:**
- Create: `src/tools/trading/orders.ts`
- Test: `src/tools/trading/orders.test.ts`

**Interfaces:**
- Consumes: nothing at runtime.
- Produces: `OrderSchema`, `OrdersOutputSchema`, `parseOrders(payload): Order[]`, `formatOrders(orders, notes): string`, `capOrders(orders): { orders: Order[]; notes: string[] }`, `type Order`.

Same envelope-and-zero shape as positions, with a different field set: no `priceCurrent`, no `swap`, no `profit`; `timeSetup` instead of `openTime`; and `priceStopLimit`, which is also `0` when unused.

- [ ] **Step 1: Write the failing tests**

Create `src/tools/trading/orders.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { type Order, capOrders, formatOrders, parseOrders } from './orders.js';

const ORDER: Order = {
  ticket: 987654,
  symbol: 'XAUUSD',
  type: 'ORDER_TYPE_BUY_LIMIT',
  volume: 0.2,
  priceOpen: 2380.5,
  sl: 2370.0,
  tp: 2400.0,
  timeSetup: '2026-08-05T10:00:00Z',
  priceStopLimit: 0,
  magic: 0,
  comment: '',
};

describe('parseOrders', () => {
  test('unwraps the orders array from the response envelope', () => {
    expect(parseOrders({ orders: [ORDER] })).toEqual([ORDER]);
  });

  test('accepts an empty orders array', () => {
    expect(parseOrders({ orders: [] })).toEqual([]);
  });

  test('rejects a bare array — the envelope is part of the contract', () => {
    expect(() => parseOrders([ORDER])).toThrow(/unexpected shape/);
  });

  test('rejects an order missing a required field, naming it', () => {
    const { timeSetup: _dropped, ...incomplete } = ORDER;

    expect(() => parseOrders({ orders: [incomplete] })).toThrow(/timeSetup/);
  });
});

describe('capOrders', () => {
  test('leaves a normal list untouched and records no note', () => {
    const result = capOrders([ORDER]);

    expect(result.orders).toHaveLength(1);
    expect(result.notes).toEqual([]);
  });

  test('truncates beyond 200 rows and says so', () => {
    const many = Array.from({ length: 250 }, (_item, index) => ({ ...ORDER, ticket: index }));

    const result = capOrders(many);

    expect(result.orders).toHaveLength(200);
    expect(result.notes[0]).toMatch(/250/);
    expect(result.notes[0]).toMatch(/200/);
  });
});

describe('formatOrders', () => {
  test('renders an unused priceStopLimit as an em dash, never as zero', () => {
    const rendered = formatOrders([ORDER], []);

    expect(rendered).not.toContain('stop-limit 0');
  });

  test('renders a used priceStopLimit', () => {
    const rendered = formatOrders([{ ...ORDER, priceStopLimit: 2375.0 }], []);

    expect(rendered).toContain('stop-limit 2375');
  });

  test('renders an unset stop loss and take profit as em dashes', () => {
    const rendered = formatOrders([{ ...ORDER, sl: 0, tp: 0 }], []);

    expect(rendered).toContain('SL — · TP —');
    expect(rendered).not.toContain('SL 0.00');
  });

  test('shows the ticket, which is the handle for cancelling an order', () => {
    expect(formatOrders([ORDER], [])).toContain('ticket 987654');
  });

  test('states that an empty list is a real zero, not an unreadable terminal', () => {
    const rendered = formatOrders([], []);

    expect(rendered).toMatch(/no pending orders/i);
    expect(rendered).toMatch(/offline/i);
  });

  test('surfaces notes in the text', () => {
    expect(formatOrders([ORDER], ['Truncated: showing 200 of 250 orders.'])).toContain(
      'Truncated: showing 200 of 250 orders.',
    );
  });

  test('agrees in number', () => {
    expect(formatOrders([ORDER], [])).toContain('1 pending order');
    expect(formatOrders([ORDER, { ...ORDER, ticket: 2 }], [])).toContain('2 pending orders');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run src/tools/trading/orders.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/tools/trading/orders.ts`:

```ts
import * as z from 'zod/v4';
import { parseOrThrow } from '../../core/parse.js';

/**
 * Transcribed from `GET /api/v1/accounts/{accountId}/orders` in the live
 * OpenAPI document. Every field is required and none is nullable.
 */
export const OrderSchema = z.object({
  ticket: z.number(),
  symbol: z.string(),
  type: z.string(),
  volume: z.number(),
  priceOpen: z.number(),
  sl: z.number(),
  tp: z.number(),
  timeSetup: z.string(),
  priceStopLimit: z.number(),
  magic: z.number(),
  comment: z.string(),
});

export type Order = z.infer<typeof OrderSchema>;

/** The response envelope, as the API sends it. */
const OrdersResponseSchema = z.object({
  orders: z.array(OrderSchema),
});

export const OrdersOutputSchema = z.object({
  orders: z.array(OrderSchema),
  /** Empty when nothing was cut. Its presence never implies truncation. */
  notes: z.array(z.string()),
});

export function parseOrders(payload: unknown): Order[] {
  return parseOrThrow(OrdersResponseSchema, payload, 'order list').orders;
}

/** Defensive bound, matching `capPositions`. This endpoint does not paginate. */
const MAX_ROWS = 200;

export function capOrders(orders: Order[]): { orders: Order[]; notes: string[] } {
  if (orders.length <= MAX_ROWS) return { orders, notes: [] };

  return {
    orders: orders.slice(0, MAX_ROWS),
    notes: [
      `Truncated: showing ${MAX_ROWS} of ${orders.length} orders, ordered as the API ` +
        'returned them. Senti does not paginate this endpoint, so the remainder is not ' +
        'retrievable through this tool.',
    ],
  };
}

/** MT5 writes `0` into `sl`/`tp`/`priceStopLimit` to mean "not set". */
const NO_VALUE = '—';

function price(value: number): string {
  return value === 0 ? NO_VALUE : String(value);
}

function block(order: Order): string {
  const lines = [
    `- ${order.symbol} ${order.type} ${order.volume} lots at ${order.priceOpen} — ticket ${order.ticket}`,
    `  SL ${price(order.sl)} · TP ${price(order.tp)} · placed ${order.timeSetup}`,
  ];

  if (order.priceStopLimit !== 0) lines.push(`  stop-limit ${order.priceStopLimit}`);
  if (order.comment) lines.push(`  comment: ${order.comment}`);

  return lines.join('\n');
}

export function formatOrders(orders: Order[], notes: string[]): string {
  const trailer = notes.length > 0 ? `\n\n${notes.join('\n')}` : '';

  if (orders.length === 0) {
    return (
      'No pending orders on this account. The MT5 terminal answered, so this is a real ' +
      'zero — an offline terminal would have returned an error saying so instead.' +
      trailer
    );
  }

  const noun = orders.length === 1 ? 'order' : 'orders';
  const blocks = orders.map(block).join('\n\n');

  return `${orders.length} pending ${noun}.\n\n${blocks}${trailer}`;
}
```

- [ ] **Step 4: Run to verify they pass**

```bash
npx vitest run src/tools/trading/orders.test.ts
```

Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/tools/trading docs/sprints/stories/US-2.9-list-pending-orders-tool.md
git commit -m "feat: add the pending-order schema, cap, and text rendering"
```

---

### Task 19: `list_pending_orders` — registration, the 0.7.0 release, and the sprint close

Closes US-2.9 and sprint W33.

**Files:**
- Modify: `src/tools/trading/orders.ts`, `src/server.ts`, `src/server.test.ts`, `src/smoke.test.ts`
- Modify: `VERSION`, `package.json`, `src/config.ts`, `docs/CHANGELOG.md`, `README.md`, `CLAUDE.md`
- Modify: `docs/sprints/stories/US-2.9-list-pending-orders-tool.md`, `docs/sprints/sprint-2026-W33.md`

**Interfaces:**
- Consumes: Task 18's exports, `accountPath`, `registerReadTool`, `conflictMeans`.
- Produces: `registerListPendingOrders(server: McpServer, client: SentiClient): void`. This is the last tool in W33; W34's plan starts from `server.ts` with six `register*` calls.

- [ ] **Step 1: Write the failing tests**

Append to `src/server.test.ts`; add the import and the final table row:

```ts
import { OrdersOutputSchema } from './tools/trading/orders.js';
```

```ts
  {
    name: 'list_pending_orders',
    arguments: { accountId: 'abc-123' },
    outputSchema: OrdersOutputSchema,
    successBody: { orders: [ORDER] },
  },
```

```ts
const ORDER = {
  ticket: 987654,
  symbol: 'XAUUSD',
  type: 'ORDER_TYPE_BUY_LIMIT',
  volume: 0.2,
  priceOpen: 2380.5,
  sl: 0,
  tp: 0,
  timeSetup: '2026-08-05T10:00:00Z',
  priceStopLimit: 0,
  magic: 0,
  comment: '',
};

describe('list_pending_orders', () => {
  test('calls the account-scoped path and returns both channels', async () => {
    const calls: string[] = [];
    const ordersFetch = (async (url: string | URL) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ orders: [ORDER] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    const client = await connect(ordersFetch);

    const result = (await client.callTool({
      name: 'list_pending_orders',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect(calls[0]).toBe('https://be-dev.sentitrade.xyz/api/v1/accounts/abc-123/orders');
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('ticket 987654');
    expect(OrdersOutputSchema.safeParse(result.structuredContent).success).toBe(true);
  });

  test('reports an offline terminal on 409', async () => {
    const offline = (async () =>
      new Response(
        JSON.stringify({ error: { code: 'CONFLICT', message: 'Terminal offline.' } }),
        { status: 409, headers: { 'content-type': 'application/json' } },
      )) as unknown as typeof fetch;
    const client = await connect(offline);

    const result = (await client.callTool({
      name: 'list_pending_orders',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/offline/i);
    expect(textOf(result)).toMatch(/not the same as/i);
  });

  test('names the trading:read scope on 403', async () => {
    const forbidden = (async () =>
      new Response(
        JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Insufficient scope.' } }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      )) as unknown as typeof fetch;
    const client = await connect(forbidden);

    const result = (await client.callTool({
      name: 'list_pending_orders',
      arguments: { accountId: 'abc-123' },
    })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('trading:read');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run src/server.test.ts -t 'list_pending_orders'
```

Expected: FAIL — tool not found.

- [ ] **Step 3: Implement**

Append to `src/tools/trading/orders.ts`, adding the imports at the top:

```ts
import type { McpServer } from '@modelcontextprotocol/server';
import { accountPath, type SentiClient } from '../../core/client.js';
import { registerReadTool } from '../../core/tool.js';
```

```ts
/** The scope this endpoint requires, quoted back in the 403 message. */
const TRADING_READ = 'trading:read';

/** The API declares 409 here as "The account terminal is offline". */
const TERMINAL_OFFLINE =
  'The MT5 terminal for this account is offline, so its pending orders cannot be read ' +
  'right now. This is NOT the same as the account having no pending orders — any ' +
  'resting orders are still resting and may still trigger.';

export function registerListPendingOrders(server: McpServer, client: SentiClient): void {
  registerReadTool(server, {
    name: 'list_pending_orders',
    title: 'List pending orders on an account',
    description:
      'List the pending limit and stop orders resting on one MT5 account, read live from ' +
      'the terminal: symbol, order type, volume, trigger price, stop loss and take profit. ' +
      'These are orders that have NOT been filled — for filled positions currently open, ' +
      'use list_positions. `accountId` is the `id` field from list_accounts, NOT `login`. ' +
      'Each order\'s `ticket` is the handle used to cancel it. An `sl`, `tp` or ' +
      '`priceStopLimit` of 0 means that level is not set.',
    inputSchema: z.object({
      accountId: z
        .string()
        .describe('The `id` field from list_accounts. Not the `login` (MT5 account number).'),
    }),
    outputSchema: OrdersOutputSchema,
    run: async (args, signal) => {
      const payload = await client.get(accountPath(args.accountId, 'orders'), {
        signal,
        scope: TRADING_READ,
        conflictMeans: TERMINAL_OFFLINE,
      });
      const { orders, notes } = capOrders(parseOrders(payload));

      return { text: formatOrders(orders, notes), structured: { orders, notes } };
    },
  });
}
```

In `src/server.ts`:

```ts
import { registerListPendingOrders } from './tools/trading/orders.js';
```

```ts
  registerListPendingOrders(server, client);
```

- [ ] **Step 4: Extend the smoke test across the whole W33 read path**

Replace the body of `src/smoke.test.ts`'s `describe` with a chained walk. It skips cleanly when the key owns no accounts, which is the difference between "the API changed" and "this key has nothing to look at":

```ts
  test('the whole W33 read path parses and renders against the live API', async () => {
    const config = loadConfig({
      SENTI_API_KEY: smokeKey,
      SENTI_API_BASE_URL: process.env.SENTI_API_BASE_URL ?? 'https://be-dev.sentitrade.xyz',
    });
    const client = createClient(config);

    const accounts = parseAccounts(await client.get('/api/v1/accounts', { scope: 'accounts:read' }));
    expect(formatAccounts(accounts).length).toBeGreaterThan(0);

    const brokers = parseBrokers(await client.get('/api/v1/brokers', { scope: 'brokers:read' }));
    expect(formatBrokers(brokers).length).toBeGreaterThan(0);

    const strategies = parseStrategies(
      await client.get('/api/v1/strategies', { scope: 'strategies:read' }),
    );
    expect(formatStrategies(strategies).length).toBeGreaterThan(0);

    const first = accounts[0];
    if (!first) {
      // Not a failure: a key with no linked account has nothing account-scoped
      // to prove. Everything above still ran.
      return;
    }

    const deployed = parseAccountStrategies(
      await client.get(accountPath(first.id, 'strategies'), { scope: 'strategies:read' }),
    );
    expect(formatAccountStrategies(deployed).length).toBeGreaterThan(0);

    // A 409 here means the terminal is offline, which is a real state of the
    // world rather than a broken contract — so it is tolerated, and only a
    // parse or render failure fails this test.
    try {
      const positions = parsePositions(
        await client.get(accountPath(first.id, 'positions'), {
          scope: 'trading:read',
          conflictMeans: 'terminal offline',
        }),
      );
      const capped = capPositions(positions);

      expect(formatPositions(capped.positions, capped.notes).length).toBeGreaterThan(0);
    } catch (error) {
      expect(String(error)).toMatch(/409/);
    }
  }, 60_000);
```

Update the imports at the top of `src/smoke.test.ts` to pull `parseBrokers`/`formatBrokers`, `parseStrategies`/`formatStrategies`, `parseAccountStrategies`/`formatAccountStrategies`, `parsePositions`/`capPositions`/`formatPositions`, and `accountPath`.

Run it only if a real key is available:

```bash
npm run test:smoke
```

Expected: PASS, or SKIP when `SENTI_SMOKE_KEY` is absent from `.env.local`. **The smoke key must now carry all five read scopes** — a key with only `accounts:read` will fail this test at the brokers step, and that failure is correct.

- [ ] **Step 5: Run the full gate**

```bash
npm test && npm run typecheck && npm run build && npm run agile:validate && npm run agile:status
```

Expected: all pass. Confirm six tools are registered:

```bash
grep -c "register[A-Z]" src/server.ts
```

Expected: `12` — six imports and six calls.

- [ ] **Step 6: Ship 0.7.0, close the story and the sprint**

- `VERSION`, `package.json`, `src/config.ts` → `0.7.0`
- `docs/CHANGELOG.md` → `## [0.7.0] — 2026-08-06` for `list_pending_orders`
- `README.md` → the full six-tool list and all five scopes
- `US-2.9` → `status: done`, `version_shipped: 0.7.0`
- `sprint-2026-W33.md` → `status: closed`, plus a retrospective covering: whether the substrate story paid for itself, whether any tool needed more than the ~30 lines the v1 spec predicted, and whether the `409`-as-terminal-offline finding changed anything downstream
- `CLAUDE.md` Active Context → sprint W33 closed, Last Version 0.7.0, next up the W34 plan
- If anything in this sprint reached the bar of "a trap a future session would otherwise walk into", create `docs/LESSONS.md` with that entry — it is still deliberately absent until there is a real one

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add the list_pending_orders tool and close sprint W33

Ships 0.7.0. Six tools registered; the smoke test now walks the whole W33
read path against the live API."
```

---

## Post-sprint

W34 (`get_account_performance`, `list_deals`, `get_performance_breakdowns`, `get_equity_timeseries`) gets its own plan, written after this sprint closes. Two things from W33 should feed into it:

- **What the live payloads actually weigh.** The spec's cut policy is reasoned from the schema, not measured. The extended smoke test is the place to record real sizes before committing to the 200-point downsample and the top-10 symbol cut.
- **Whether `capPositions`/`capOrders` generalise.** If the two cap helpers turn out identical apart from a noun, W34's first task is extracting one — but only then, on the same "revisit when the repetition is real" principle that produced `registerReadTool` rather than a descriptor table.

  This was ruled on at pre-flight rather than left open. The six-fold repetition of the
  `safeParse`-and-throw block **was** extracted, as `core/parse.ts`'s `parseOrThrow` —
  six copies of purely mechanical control flow is exactly the case D8 describes. The
  two cap helpers were **not**: they are two copies, not six, they return differently
  shaped objects (`{ positions, notes }` vs `{ orders, notes }`), and a shared
  `capRows` would have to be generic over the field name — abstracting ahead of the
  third caller. Revisit in W34 when `list_deals` shows whether a third one exists.
