# senti-mcp-server v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an MCP server exposing one tool, `list_accounts`, that reads the caller's linked MT5 accounts from the Senti Quant Public API.

**Architecture:** Six source files. `client.ts` owns HTTP, auth, and error mapping; `accounts.ts` owns the Zod schema and text formatting; `server.ts` is the only file that imports the MCP SDK, wiring the other two into a `registerTool` call. `config.ts` turns environment variables into a frozen `Config`, `errors.ts` holds the shared error vocabulary, `index.ts` is the stdio bootstrap.

**Tech Stack:** TypeScript (NodeNext, strict), Node ≥ 20, `@modelcontextprotocol/server` v2 (stdio, serving both the 2025 and 2026 protocol eras via `serveStdio`), Zod v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-05-senti-mcp-server-design.md`

**Stories:** this plan executes three koni-docs stories under
[EPIC-2](../../sprints/epics/EPIC-2.md), in
[sprint-2026-W32](../../sprints/sprint-2026-W32.md). The story files hold the
acceptance criteria; this plan holds the code.

| Plan tasks | Story |
|---|---|
| 1–3 | [US-2.1 — Authenticated Senti API client substrate](../../sprints/stories/US-2.1-authenticated-senti-api-client.md) |
| 4–5 | [US-2.2 — `list_accounts` tool over MCP stdio](../../sprints/stories/US-2.2-list-accounts-tool.md) |
| 6 | [US-2.3 — Live smoke test, README, and the v0.1.0 release](../../sprints/stories/US-2.3-live-smoke-test-and-readme.md) |

> **Read this before Task 1.** The repo adopted koni-docs in
> [US-1.1](../../sprints/stories/US-1.1-adopt-koni-docs-framework.md), which landed
> after this plan was written. Two consequences:
>
> 1. **`package.json`, `VERSION`, `AGENTS.md` and `CLAUDE.md` already exist.** Task 1
>    Step 1 has been rewritten to *extend* `package.json` rather than create it —
>    recreating it drops the `@koniverse/koni-docs` devDependency and the `agile:*`
>    scripts.
> 2. **Every commit here updates docs in the same commit** (RULE-1). Flip the story's
>    `status:` to `in-progress` before starting it, mark its tasks `[x]` as you finish
>    them rather than all at the end (RULE-10), and walk the checklist in
>    [docs/README.md](../../README.md) before each commit. The `[0.1.0]` CHANGELOG entry
>    and the `VERSION` it describes land together in Task 6.

## Global Constraints

- Package name `senti-mcp-server`; binary name `senti-mcp-server`; `"type": "module"`; `engines.node >= 20`.
- Runtime dependencies are exactly `@modelcontextprotocol/server` and `zod`. Nothing else. No HTTP client library, no dotenv, no OpenAPI tooling.
- The API key is read from `SENTI_API_KEY` only. It must never appear in any tool's `inputSchema`, in any returned text, or in any error message. Task 3 carries the tests that enforce this.
- Base URL defaults to `https://api.sentitrade.xyz`, overridable by `SENTI_API_BASE_URL`. Stored without a trailing slash.
- Outbound fetch timeout is fixed at 15000 ms and is combined with the MCP request's `AbortSignal`.
- Tool errors are returned as `{ isError: true, content: [text] }`. Never thrown out of a tool callback. An error result carries no `structuredContent`.
- v1 registers exactly one tool. No write operations (`POST`) are implemented, wired, or stubbed.
- Nothing may write to `stdout` — that stream carries JSON-RPC frames. Diagnostics go to `stderr`.
- Every file uses `.js` extensions in relative imports (NodeNext resolution).
- Zod is imported as `import * as z from 'zod/v4'`.

### Commit discipline (added by the koni-docs adoption)

- **Every commit message carries a conventional prefix** (RULE-14): `feat:` `fix:`
  `chore:` `docs:` `style:` `refactor:` `test:`. The messages in this plan were written
  before the adoption and have been updated accordingly.
- **`VERSION` and `CHANGELOG.md` move once, in Task 6 Step 9** — not on every commit.
  RULE-1 binds a *shipping* commit: `VERSION` and its changelog entry travel together.
  Tasks 1–5 are intra-story commits, so each one marks its story's task boxes `[x]`
  (RULE-10) and leaves `VERSION` and `CHANGELOG.md` alone. Each story's
  `## Changelog entry` section is the draft that Task 6 merges into the `[0.1.0]` entry.
- **A commit never contains its own SHA** (RULE-2). Story `commit:` fields are backfilled
  by a follow-up commit, never `--amend`-ed in.
- **English only** for code, comments, errors, commits, and docs (RULE-13).

## File Structure

| File | Responsibility |
|---|---|
| `src/config.ts` | `SERVER_NAME`, `SERVER_VERSION`, `Config`, `loadConfig(env)`. Fails fast on a missing key. |
| `src/errors.ts` | `ApiError` class; `describeError(unknown): string` flattening the `cause` chain. |
| `src/client.ts` | `createClient(config, deps)` → `{ get(path, options) }`. HTTP, auth header, timeout, status → message mapping. No MCP imports. |
| `src/accounts.ts` | `AccountSchema`, `AccountsOutputSchema`, `parseAccounts`, `formatAccounts`. No MCP imports. |
| `src/server.ts` | `createServer(config, deps)` → `McpServer` with `list_accounts` registered. The only file importing the SDK. |
| `src/index.ts` | `#!/usr/bin/env node` stdio bootstrap. |
| `src/smoke.test.ts` | One opt-in test against the real development API. |

Task order follows the dependency chain: 1 → 2 → 3 → 4 → 5 → 6. Task 4 depends only on Zod and could be done in parallel with Task 3, but the plan assumes sequential execution.

---

### Task 1: Scaffolding and configuration

**Story:** [US-2.1](../../sprints/stories/US-2.1-authenticated-senti-api-client.md) —
TASK-2.1.1 and TASK-2.1.2, satisfying AC-1 and AC-2.

**Files:**
- **Modify**: `package.json` (it already exists — see Step 1)
- Create: `tsconfig.json`
- Create: `src/config.ts`
- Test: `src/config.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `SERVER_NAME: string`, `SERVER_VERSION: string`, `type Config = { baseUrl: string; apiKey: string }`, `loadConfig(env: NodeJS.ProcessEnv): Config`.

- [ ] **Step 1: Extend the existing `package.json`**

`package.json` already exists — US-1.1 created it with the project identity, the
`@koniverse/koni-docs` devDependency, and the two `agile:*` scripts. **Do not overwrite
it.** Add the runtime keys with `Edit`, leaving everything already present intact:

```jsonc
{
  // ── keep as-is: name, version, description, type, private, engines,
  //    keywords, license, author, repository ──

  // ── add ──
  "bin": {
    "senti-mcp-server": "./dist/index.js"
  },
  "files": [
    "dist"
  ],

  // ── add to the EXISTING scripts block, keeping agile:status + agile:validate ──
  "scripts": {
    "build": "tsc && chmod +x dist/index.js",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:smoke": "node --env-file=.env.local ./node_modules/vitest/vitest.mjs run src/smoke.test.ts",
    "typecheck": "tsc --noEmit"
  },

  // ── add ──
  "dependencies": {
    "@modelcontextprotocol/server": "^2.0.0",
    "zod": "^4.2.0"
  },

  // ── add to the EXISTING devDependencies, keeping @koniverse/koni-docs ──
  "devDependencies": {
    "@modelcontextprotocol/client": "^2.0.0",
    "@types/node": "^22.10.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

`"private": true` stays. v1 is not published to npm (design spec §Packaging), and the
flag is what prevents an accidental `npm publish` of a package whose `files` field is
already correct. Remove it in the commit that actually publishes.

Verify nothing was lost:

```bash
node -e "const p=require('./package.json');
  const s=Object.keys(p.scripts);
  console.log('agile scripts kept:', s.includes('agile:status') && s.includes('agile:validate'));
  console.log('koni-docs devDep kept:', '@koniverse/koni-docs' in p.devDependencies);"
```

Both must print `true`.

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["node"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts"]
}
```

- [ ] **Step 3: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, no peer-dependency errors.

- [ ] **Step 4: Write the failing test**

Create `src/config.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { loadConfig } from './config.js';

const KEY = 'sq_live_testkey';

describe('loadConfig', () => {
  test('rejects a missing API key with instructions for creating one', () => {
    expect(() => loadConfig({})).toThrow(/SENTI_API_KEY/);
    expect(() => loadConfig({})).toThrow(/api-keys/i);
  });

  test('treats a blank API key as missing', () => {
    expect(() => loadConfig({ SENTI_API_KEY: '   ' })).toThrow(/SENTI_API_KEY/);
  });

  test('defaults the base URL to production', () => {
    expect(loadConfig({ SENTI_API_KEY: KEY }).baseUrl).toBe('https://api.sentitrade.xyz');
  });

  test('honours SENTI_API_BASE_URL', () => {
    const config = loadConfig({
      SENTI_API_KEY: KEY,
      SENTI_API_BASE_URL: 'https://be-dev.sentitrade.xyz',
    });

    expect(config.baseUrl).toBe('https://be-dev.sentitrade.xyz');
  });

  test('strips trailing slashes from the base URL', () => {
    const config = loadConfig({
      SENTI_API_KEY: KEY,
      SENTI_API_BASE_URL: 'https://be-dev.sentitrade.xyz///',
    });

    expect(config.baseUrl).toBe('https://be-dev.sentitrade.xyz');
  });

  test('rejects a base URL that is not absolute', () => {
    expect(() => loadConfig({ SENTI_API_KEY: KEY, SENTI_API_BASE_URL: '/api' })).toThrow(
      /absolute URL/,
    );
  });

  test('keeps the API key verbatim', () => {
    expect(loadConfig({ SENTI_API_KEY: KEY }).apiKey).toBe(KEY);
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npm test -- src/config.test.ts`
Expected: FAIL — cannot resolve `./config.js`.

- [ ] **Step 6: Write `src/config.ts`**

```ts
/**
 * Server identity. `server.ts` and the default User-Agent both read these, so
 * they stay in one place; keep in sync with package.json on release.
 */
export const SERVER_NAME = 'senti-mcp-server';
export const SERVER_VERSION = '0.1.0';

/** The canonical host, listed first in the API's OpenAPI document. */
const DEFAULT_BASE_URL = 'https://api.sentitrade.xyz';

export type Config = {
  /** API root, without a trailing slash. */
  baseUrl: string;
  /**
   * First-party key (`sq_live_…`). It leaves this process only as an
   * `Authorization` header — never as a tool argument, never in output.
   */
  apiKey: string;
};

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const apiKey = env.SENTI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'SENTI_API_KEY is required. Create a key in the Senti API Keys dashboard ' +
        '(https://stage.sentitrade.xyz/account/api-keys) with the scopes you need, then set ' +
        'SENTI_API_KEY=sq_live_… in the MCP server\'s env block.',
    );
  }

  const rawBaseUrl = env.SENTI_API_BASE_URL?.trim() || DEFAULT_BASE_URL;

  let base: URL;
  try {
    base = new URL(rawBaseUrl);
  } catch {
    throw new Error(`SENTI_API_BASE_URL must be an absolute URL, got: ${rawBaseUrl}`);
  }

  return Object.freeze({
    baseUrl: base.href.replace(/\/+$/, ''),
    apiKey,
  });
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test -- src/config.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 8: Verify typechecking**

Run: `npm run typecheck`
Expected: exit 0, no output.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json src/config.ts src/config.test.ts \
        docs/sprints/stories/US-2.1-authenticated-senti-api-client.md
git commit -m "chore: add project scaffolding and configuration loading

The API key is an environment variable rather than a tool parameter: tool
parameters live in the model's context and from there reach transcripts and
logs. Base URL defaults to production, the host the OpenAPI document lists
first; a wrong host fails fast with 401 rather than serving wrong data."
```

---

### Task 2: Error vocabulary

**Story:** [US-2.1](../../sprints/stories/US-2.1-authenticated-senti-api-client.md) —
TASK-2.1.3, satisfying AC-3 and AC-4.

**Files:**
- Create: `src/errors.ts`
- Test: `src/errors.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `class ApiError extends Error` with `constructor(message: string, status: number, code?: string)` and readonly `status: number`, `code?: string`; `describeError(error: unknown): string`.

- [ ] **Step 1: Write the failing test**

Create `src/errors.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { ApiError, describeError } from './errors.js';

describe('ApiError', () => {
  test('carries the HTTP status and envelope code', () => {
    const error = new ApiError('nope', 403, 'FORBIDDEN');

    expect(error.message).toBe('nope');
    expect(error.status).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
    expect(error).toBeInstanceOf(Error);
  });

  test('is identifiable by name', () => {
    expect(new ApiError('nope', 500).name).toBe('ApiError');
  });
});

describe('describeError', () => {
  test('renders a plain Error', () => {
    expect(describeError(new Error('boom'))).toBe('boom');
  });

  test('renders a string', () => {
    expect(describeError('boom')).toBe('boom');
  });

  test('flattens the cause chain, which is where fetch hides the real reason', () => {
    const error = new Error('fetch failed', {
      cause: new Error('Connect Timeout Error (attempted address: api.sentitrade.xyz:443)'),
    });

    expect(describeError(error)).toBe(
      'fetch failed: Connect Timeout Error (attempted address: api.sentitrade.xyz:443)',
    );
  });

  test('reads a code off a non-Error cause', () => {
    const error = new Error('fetch failed', { cause: { code: 'ENOTFOUND' } });

    expect(describeError(error)).toBe('fetch failed: ENOTFOUND');
  });

  test('does not repeat an identical cause message', () => {
    const error = new Error('boom', { cause: new Error('boom') });

    expect(describeError(error)).toBe('boom');
  });

  test('survives a self-referencing cause chain', () => {
    const error = new Error('a');
    (error as { cause?: unknown }).cause = error;

    expect(describeError(error)).toBe('a');
  });

  test('falls back to String() when nothing carries text', () => {
    expect(describeError(42)).toBe('42');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/errors.test.ts`
Expected: FAIL — cannot resolve `./errors.js`.

- [ ] **Step 3: Write `src/errors.ts`**

```ts
/** Guard against a pathological self-referencing cause chain. */
const MAX_CAUSE_DEPTH = 4;

/**
 * A failure the Senti API reported, carrying the pieces of its error envelope
 * (`{ error: { code, message } }`) so callers can branch on status or code
 * without re-parsing a message string.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function textOf(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (value instanceof Error) return value.message.trim() || undefined;

  if (value && typeof value === 'object') {
    const record = value as { message?: unknown; code?: unknown };
    if (typeof record.message === 'string' && record.message.trim()) return record.message.trim();
    if (typeof record.code === 'string' && record.code.trim()) return record.code.trim();
  }

  return undefined;
}

/**
 * Render an error for a human, including its cause chain.
 *
 * `fetch` rejects with a bare "fetch failed" and puts the actual reason —
 * connect timeout, DNS failure, TLS error — in `cause`. Without this the tool
 * output tells the reader nothing they can act on.
 */
export function describeError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;

  for (let depth = 0; depth < MAX_CAUSE_DEPTH && current !== undefined && current !== null; depth++) {
    const text = textOf(current);
    if (text && text !== parts[parts.length - 1]) parts.push(text);

    current = current instanceof Error ? current.cause : undefined;
  }

  return parts.length > 0 ? parts.join(': ') : String(error);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/errors.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/errors.ts src/errors.test.ts \
        docs/sprints/stories/US-2.1-authenticated-senti-api-client.md
git commit -m "feat: add ApiError and cause-chain error rendering

fetch rejects with a bare 'fetch failed' and buries the real reason in cause,
so a tool error that does not flatten the chain tells the reader nothing."
```

---

### Task 3: HTTP client with auth and error mapping

**Story:** [US-2.1](../../sprints/stories/US-2.1-authenticated-senti-api-client.md) —
TASK-2.1.4 and TASK-2.1.5, satisfying AC-5 through AC-15.

**Completes US-2.1's code.** Flip its `status:` to `review`, not `done` — RULE-16 makes
`version_shipped` mandatory the moment a story reads `done`, and nothing has shipped
until Task 6 cuts 0.1.0. All three stories flip to `done` together there.

**Files:**
- Create: `src/client.ts`
- Test: `src/client.test.ts`

**Interfaces:**
- Consumes: `Config` from Task 1; `ApiError` from Task 2.
- Produces:
  - `type ClientDeps = { fetch?: typeof fetch }`
  - `type RequestOptions = { signal?: AbortSignal; scope?: string }`
  - `type SentiClient = { get(path: string, options?: RequestOptions): Promise<unknown> }`
  - `createClient(config: Config, deps?: ClientDeps): SentiClient`

`get` returns the parsed JSON body as `unknown` — validation belongs to the domain module, not here.

- [ ] **Step 1: Write the failing test**

Create `src/client.test.ts`:

```ts
import { describe, expect, test, vi } from 'vitest';
import { createClient } from './client.js';
import { ApiError } from './errors.js';
import { loadConfig } from './config.js';

const KEY = 'sq_live_supersecret';
const config = loadConfig({
  SENTI_API_KEY: KEY,
  SENTI_API_BASE_URL: 'https://be-dev.sentitrade.xyz',
});

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

const envelope = (code: string, message: string) => ({ error: { code, message } });

/** Collects the arguments fetch was called with while returning `response`. */
function stub(response: Response | (() => Promise<Response>)) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string | URL, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    return typeof response === 'function' ? response() : response;
  }) as unknown as typeof fetch;

  return { calls, fetchImpl };
}

describe('createClient', () => {
  test('sends the key as a bearer token to the configured host', async () => {
    const { calls, fetchImpl } = stub(jsonResponse([]));

    await createClient(config, { fetch: fetchImpl }).get('/api/v1/accounts');

    expect(calls[0]?.url).toBe('https://be-dev.sentitrade.xyz/api/v1/accounts');
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${KEY}`);
    expect(headers.accept).toBe('application/json');
    expect(headers['user-agent']).toMatch(/^senti-mcp-server\//);
  });

  test('returns the parsed JSON body', async () => {
    const { fetchImpl } = stub(jsonResponse([{ id: 'a' }]));

    const body = await createClient(config, { fetch: fetchImpl }).get('/api/v1/accounts');

    expect(body).toEqual([{ id: 'a' }]);
  });

  test('maps 401 to an actionable message naming the env var', async () => {
    const { fetchImpl } = stub(
      jsonResponse(envelope('UNAUTHENTICATED', 'Invalid API key.'), 401),
    );

    const promise = createClient(config, { fetch: fetchImpl }).get('/api/v1/accounts');

    await expect(promise).rejects.toThrow(/SENTI_API_KEY/);
    await expect(promise).rejects.toBeInstanceOf(ApiError);
  });

  test('maps 403 to a missing scope, not a forbidden account', async () => {
    const { fetchImpl } = stub(jsonResponse(envelope('FORBIDDEN', 'Insufficient scope.'), 403));

    const promise = createClient(config, { fetch: fetchImpl }).get('/api/v1/accounts', {
      scope: 'accounts:read',
    });

    await expect(promise).rejects.toThrow(/accounts:read/);
    await expect(promise).rejects.toThrow(/not that the account is off limits/);
  });

  test('quotes the rate-limit budget on 429', async () => {
    const { fetchImpl } = stub(
      jsonResponse(envelope('RATE_LIMITED', 'Slow down.'), 429, {
        'x-ratelimit-limit': '120',
        'x-ratelimit-remaining': '0',
      }),
    );

    const promise = createClient(config, { fetch: fetchImpl }).get('/api/v1/accounts');

    await expect(promise).rejects.toThrow(/limit 120/);
    await expect(promise).rejects.toThrow(/remaining 0/);
  });

  test('passes through the envelope message for other statuses', async () => {
    const { fetchImpl } = stub(jsonResponse(envelope('INTERNAL', 'Upstream broker down.'), 500));

    const promise = createClient(config, { fetch: fetchImpl }).get('/api/v1/accounts');

    await expect(promise).rejects.toThrow(/Upstream broker down/);
    await expect(promise).rejects.toThrow(/500/);
  });

  test('reports a non-JSON error body without crashing on the parse', async () => {
    const { fetchImpl } = stub(new Response('<html>502 Bad Gateway</html>', { status: 502 }));

    const promise = createClient(config, { fetch: fetchImpl }).get('/api/v1/accounts');

    await expect(promise).rejects.toThrow(/502/);
  });

  test('rejects a success response whose body is not JSON', async () => {
    const { fetchImpl } = stub(new Response('not json', { status: 200 }));

    const promise = createClient(config, { fetch: fetchImpl }).get('/api/v1/accounts');

    await expect(promise).rejects.toThrow(/not JSON/);
  });

  test('never leaks the API key into an error message', async () => {
    const statuses = [401, 403, 429, 500, 502];

    for (const status of statuses) {
      const { fetchImpl } = stub(jsonResponse(envelope('INTERNAL', 'boom'), status));
      const client = createClient(config, { fetch: fetchImpl });

      const message = await client
        .get('/api/v1/accounts', { scope: 'accounts:read' })
        .then(() => '', (error: unknown) => String((error as Error).message));

      expect(message).not.toContain(KEY);
      expect(message).not.toContain('supersecret');
    }
  });

  test('forwards the caller signal so a cancelled tool call aborts the request', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async (_url: string | URL, init: RequestInit = {}) => {
      expect(init.signal?.aborted).toBe(true);
      return jsonResponse([]);
    }) as unknown as typeof fetch;

    controller.abort();
    await createClient(config, { fetch: fetchImpl }).get('/api/v1/accounts', {
      signal: controller.signal,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  test('lets a network rejection through for describeError to render', async () => {
    const { fetchImpl } = stub(async () => {
      throw new Error('fetch failed', { cause: { code: 'ENOTFOUND' } });
    });

    const promise = createClient(config, { fetch: fetchImpl }).get('/api/v1/accounts');

    await expect(promise).rejects.toThrow(/fetch failed/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/client.test.ts`
Expected: FAIL — cannot resolve `./client.js`.

- [ ] **Step 3: Write `src/client.ts`**

```ts
import { SERVER_NAME, SERVER_VERSION, type Config } from './config.js';
import { ApiError } from './errors.js';

/** Single home for the server's outbound fetch policy. */
const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT = `${SERVER_NAME}/${SERVER_VERSION}`;

export type ClientDeps = { fetch?: typeof fetch };

export type RequestOptions = {
  signal?: AbortSignal;
  /**
   * The scope this endpoint requires, quoted verbatim in the 403 message. The
   * client cannot infer it — scopes are a property of the endpoint, and only
   * the caller knows which one it is asking for.
   */
  scope?: string;
};

export type SentiClient = {
  /** Returns the parsed JSON body. Validation belongs to the domain module. */
  get(path: string, options?: RequestOptions): Promise<unknown>;
};

/** Pull `{ error: { code, message } }` out of a body that may be anything. */
function envelopeOf(body: unknown): { code?: string; message?: string } {
  if (!body || typeof body !== 'object') return {};

  const error = (body as { error?: unknown }).error;
  if (!error || typeof error !== 'object') return {};

  const record = error as { code?: unknown; message?: unknown };
  return {
    code: typeof record.code === 'string' ? record.code : undefined,
    message: typeof record.message === 'string' ? record.message : undefined,
  };
}

/**
 * Turn a failed response into an error a reader can act on.
 *
 * The 403 case earns its wording. Read plainly, "Forbidden" suggests the caller
 * may not touch that account, which sends people to investigate the wrong
 * thing. On this API it always means the key lacks a scope.
 */
function failureOf(
  status: number,
  headers: Headers,
  body: unknown,
  scope: string | undefined,
): ApiError {
  const { code, message } = envelopeOf(body);
  const detail = message ? ` — ${message}` : '';

  switch (status) {
    case 401:
      return new ApiError(
        `Senti API rejected the credentials (401)${detail}. Check SENTI_API_KEY; ` +
          'first-party keys look like "sq_live_…".',
        status,
        code,
      );

    case 403: {
      const named = scope ? `the \`${scope}\` scope` : 'a scope this endpoint requires';
      return new ApiError(
        `Senti API returned 403${detail}. The API key is missing ${named} — ` +
          'not that the account is off limits. Create a key with that scope in the ' +
          'API Keys dashboard.',
        status,
        code,
      );
    }

    case 429: {
      const limit = headers.get('x-ratelimit-limit');
      const remaining = headers.get('x-ratelimit-remaining');
      const budget =
        limit !== null || remaining !== null
          ? ` (limit ${limit ?? 'unknown'}, remaining ${remaining ?? 'unknown'})`
          : '';

      return new ApiError(`Senti API rate limit exceeded (429)${budget}${detail}.`, status, code);
    }

    default:
      return new ApiError(`Senti API request failed: HTTP ${status}${detail}.`, status, code);
  }
}

export function createClient(config: Config, deps: ClientDeps = {}): SentiClient {
  const doFetch = deps.fetch ?? fetch;

  return {
    async get(path: string, options: RequestOptions = {}): Promise<unknown> {
      const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);

      const response = await doFetch(`${config.baseUrl}${path}`, {
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          accept: 'application/json',
          'user-agent': USER_AGENT,
        },
        // Whichever fires first wins: the caller cancelling the tool call, or
        // the timeout.
        signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
      });

      // Read the body once. An error page from a proxy is not JSON, and
      // `response.json()` would throw over the top of the real status.
      const raw = await response.text();
      let body: unknown;
      try {
        body = raw ? JSON.parse(raw) : undefined;
      } catch {
        body = undefined;
      }

      if (!response.ok) {
        throw failureOf(response.status, response.headers, body, options.scope);
      }

      if (body === undefined) {
        throw new ApiError(
          `Senti API returned HTTP ${response.status} with a body that is not JSON.`,
          response.status,
        );
      }

      return body;
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/client.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Verify typechecking**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/client.ts src/client.test.ts \
        docs/sprints/stories/US-2.1-authenticated-senti-api-client.md
git commit -m "feat: add Senti API client with auth and status mapping

403 on this API always means the key lacks a scope, never that the account is
off limits, so the message says so and names the scope the caller asked for.
The body is read as text and parsed defensively: a proxy error page is not
JSON, and response.json() would throw over the top of the real status.

Tests assert the key appears in no error branch's output."
```

---

### Task 4: Account schema and formatting

**Story:** [US-2.2](../../sprints/stories/US-2.2-list-accounts-tool.md) — TASK-2.2.1,
satisfying AC-1 through AC-9.

**Files:**
- Create: `src/accounts.ts`
- Test: `src/accounts.test.ts`

**Interfaces:**
- Consumes: Zod only.
- Produces:
  - `AccountSchema` (Zod object, 16 fields)
  - `AccountsOutputSchema = z.object({ accounts: z.array(AccountSchema) })`
  - `type Account = z.infer<typeof AccountSchema>`
  - `parseAccounts(payload: unknown): Account[]`
  - `formatAccounts(accounts: Account[]): string`

- [ ] **Step 1: Write the failing test**

Create `src/accounts.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { type Account, formatAccounts, parseAccounts } from './accounts.js';

const base: Account = {
  id: '8f2c1b40-3d5e-4a17-9c8b-2e1f0a6d4b93',
  login: '51234567',
  label: 'Main Live',
  broker: 'Exness',
  server: 'Exness-MT5Real',
  accountType: 'REAL',
  brokerAccountTypeName: 'MT5 Real',
  isActive: true,
  isSoftDeleted: false,
  accessMode: 'FULL',
  lastKnownBalance: 10432.11,
  lastKnownEquity: 10502,
  lastSyncAt: '2026-08-05T09:12:00Z',
  createdAt: '2026-01-02T00:00:00Z',
  terminal: { assignedPort: 5001, terminalStatus: 'RUNNING', nodeName: 'node-1' },
  activeEas: [{ name: 'TrendRider', status: 'running' }],
};

describe('parseAccounts', () => {
  test('accepts a well-formed list', () => {
    expect(parseAccounts([base])).toEqual([base]);
  });

  test('accepts every nullable field being null', () => {
    const sparse = {
      ...base,
      label: null,
      server: null,
      brokerAccountTypeName: null,
      lastKnownBalance: null,
      lastKnownEquity: null,
      lastSyncAt: null,
      terminal: null,
      activeEas: [],
    };

    expect(parseAccounts([sparse])).toEqual([sparse]);
  });

  test('strips fields the schema does not declare', () => {
    const parsed = parseAccounts([{ ...base, surpriseField: 'ignored' }]);

    expect(parsed[0]).not.toHaveProperty('surpriseField');
  });

  test('names the offending field when a required one is missing', () => {
    const { lastKnownBalance: _omitted, ...missing } = base;

    expect(() => parseAccounts([missing])).toThrow(/lastKnownBalance/);
    expect(() => parseAccounts([missing])).toThrow(/senti-mcp-server needs updating/);
  });

  test('rejects a payload that is not an array', () => {
    expect(() => parseAccounts({ accounts: [] })).toThrow(/unexpected shape/);
  });
});

describe('formatAccounts', () => {
  test('explains an empty list instead of returning nothing', () => {
    const text = formatAccounts([]);

    expect(text).toMatch(/no linked mt5 accounts/i);
    expect(text).toMatch(/different user/i);
  });

  test('leads with a count that agrees in number', () => {
    expect(formatAccounts([base])).toMatch(/^1 linked account\./m);
    expect(formatAccounts([base, base])).toMatch(/^2 linked accounts\./m);
  });

  test('shows the accountId, which is the handle other endpoints take', () => {
    expect(formatAccounts([base])).toContain(`accountId: ${base.id}`);
  });

  test('renders balances with thousands separators', () => {
    const text = formatAccounts([base]);

    expect(text).toContain('balance 10,432.11');
    expect(text).toContain('equity 10,502.00');
  });

  test('renders a null balance as an em dash, never as zero or null', () => {
    const text = formatAccounts([{ ...base, lastKnownBalance: null, lastKnownEquity: null }]);

    expect(text).toContain('balance — · equity —');
    expect(text).not.toContain('null');
    expect(text).not.toContain('0.00');
  });

  test('distinguishes never-synced from a sync timestamp', () => {
    expect(formatAccounts([base])).toContain('synced 2026-08-05T09:12:00Z');
    expect(formatAccounts([{ ...base, lastSyncAt: null }])).toContain('never synced');
  });

  test('falls back to the login when the account has no label', () => {
    expect(formatAccounts([{ ...base, label: null }])).toContain('Account 51234567');
  });

  test('lists running strategies', () => {
    expect(formatAccounts([base])).toContain('EAs: TrendRider (running)');
  });

  test('omits the EA line when nothing is running', () => {
    expect(formatAccounts([{ ...base, activeEas: [] }])).not.toContain('EAs:');
  });

  test('marks an inactive account', () => {
    expect(formatAccounts([{ ...base, isActive: false }])).toContain('inactive');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/accounts.test.ts`
Expected: FAIL — cannot resolve `./accounts.js`.

- [ ] **Step 3: Write `src/accounts.ts`**

```ts
import * as z from 'zod/v4';

const TerminalSchema = z.object({
  assignedPort: z.number().nullable(),
  terminalStatus: z.string().nullable(),
  nodeName: z.string().nullable(),
});

const ActiveEaSchema = z.object({
  name: z.string(),
  status: z.string(),
});

/**
 * Transcribed from `GET /api/v1/accounts` in the live OpenAPI document. Every
 * field is required; many are nullable — the two are different, and collapsing
 * them would hide a broken sync behind a plausible-looking zero.
 */
export const AccountSchema = z.object({
  id: z.string(),
  login: z.string(),
  label: z.string().nullable(),
  broker: z.string(),
  server: z.string().nullable(),
  accountType: z.string(),
  brokerAccountTypeName: z.string().nullable(),
  isActive: z.boolean(),
  isSoftDeleted: z.boolean(),
  accessMode: z.string(),
  lastKnownBalance: z.number().nullable(),
  lastKnownEquity: z.number().nullable(),
  lastSyncAt: z.string().nullable(),
  createdAt: z.string(),
  terminal: TerminalSchema.nullable(),
  activeEas: z.array(ActiveEaSchema),
});

export type Account = z.infer<typeof AccountSchema>;

/**
 * The tool's advertised output. The API returns a bare array, but this server
 * speaks both protocol eras from one process: a non-object `structuredContent`
 * reaches 2025-era clients wrapped as `{ result: … }` and 2026-era clients
 * unwrapped. Naming the field keeps one shape on both.
 */
export const AccountsOutputSchema = z.object({
  accounts: z.array(AccountSchema),
});

export function parseAccounts(payload: unknown): Account[] {
  const result = z.array(AccountSchema).safeParse(payload);

  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue && issue.path.length > 0 ? issue.path.join('.') : '(root)';

    throw new Error(
      `Senti API returned an unexpected shape for the account list at "${where}": ` +
        `${issue?.message ?? 'unknown issue'}. The API may have changed; ` +
        'senti-mcp-server needs updating.',
    );
  }

  return result.data;
}

/** Null numbers render as this, never as `0` or `null`. */
const NO_VALUE = '—';

function money(value: number | null): string {
  return value === null
    ? NO_VALUE
    : value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function block(account: Account): string {
  const name = account.label ?? `Account ${account.login}`;
  const kind = account.brokerAccountTypeName ?? account.accountType;
  const sync = account.lastSyncAt ? `synced ${account.lastSyncAt}` : 'never synced';

  const lines = [
    `- ${name} (login ${account.login}) — ${account.broker} · ${kind}`,
    `  accountId: ${account.id}`,
    `  balance ${money(account.lastKnownBalance)} · equity ${money(account.lastKnownEquity)} · ` +
      `${account.isActive ? 'active' : 'inactive'} · ${sync}`,
  ];

  if (account.activeEas.length > 0) {
    const running = account.activeEas.map((ea) => `${ea.name} (${ea.status})`).join(', ');
    lines.push(`  EAs: ${running}`);
  }

  return lines.join('\n');
}

export function formatAccounts(accounts: Account[]): string {
  if (accounts.length === 0) {
    return (
      'No linked MT5 accounts. Either this API key\'s owner has not linked an account yet, ' +
      'or the key belongs to a different user than expected.'
    );
  }

  const noun = accounts.length === 1 ? 'account' : 'accounts';
  const blocks = accounts.map(block).join('\n\n');

  return `${accounts.length} linked ${noun}.\n\n${blocks}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/accounts.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/accounts.ts src/accounts.test.ts \
        docs/sprints/stories/US-2.2-list-accounts-tool.md
git commit -m "feat: add account schema, validation, and text rendering

Null balances render as an em dash rather than 0. For a trading API the
difference between 'never synced' and 'balance is zero' is real, and
collapsing it would be a data error wearing formatting's clothes.

A shape mismatch names the offending field instead of passing malformed data
to the model."
```

---

### Task 5: MCP server and stdio entry point

**Story:** [US-2.2](../../sprints/stories/US-2.2-list-accounts-tool.md) — TASK-2.2.2
through TASK-2.2.4, satisfying AC-10 through AC-20. Flip US-2.2 to `review` when done,
for the same reason as Task 3.

**Files:**
- Create: `src/server.ts`
- Create: `src/index.ts`
- Test: `src/server.test.ts`

**Interfaces:**
- Consumes: `Config`/`SERVER_NAME`/`SERVER_VERSION` (Task 1), `describeError` (Task 2), `createClient` (Task 3), `AccountsOutputSchema`/`parseAccounts`/`formatAccounts` (Task 4).
- Produces: `type ServerDeps = { fetch?: typeof fetch }`; `createServer(config: Config, deps?: ServerDeps): McpServer`.

- [ ] **Step 1: Write the failing test**

Create `src/server.test.ts`:

```ts
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { describe, expect, test } from 'vitest';
import { AccountsOutputSchema } from './accounts.js';
import { loadConfig } from './config.js';
import { createServer } from './server.js';

const config = loadConfig({
  SENTI_API_KEY: 'sq_live_supersecret',
  SENTI_API_BASE_URL: 'https://be-dev.sentitrade.xyz',
});

const ACCOUNT = {
  id: '8f2c1b40-3d5e-4a17-9c8b-2e1f0a6d4b93',
  login: '51234567',
  label: 'Main Live',
  broker: 'Exness',
  server: 'Exness-MT5Real',
  accountType: 'REAL',
  brokerAccountTypeName: 'MT5 Real',
  isActive: true,
  isSoftDeleted: false,
  accessMode: 'FULL',
  lastKnownBalance: 10432.11,
  lastKnownEquity: 10502,
  lastSyncAt: '2026-08-05T09:12:00Z',
  createdAt: '2026-01-02T00:00:00Z',
  terminal: { assignedPort: 5001, terminalStatus: 'RUNNING', nodeName: 'node-1' },
  activeEas: [{ name: 'TrendRider', status: 'running' }],
};

const okFetch = (async () =>
  new Response(JSON.stringify([ACCOUNT]), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })) as unknown as typeof fetch;

type ToolResult = {
  content: { type: string; text?: string }[];
  structuredContent?: unknown;
  isError?: boolean;
};

const textOf = (result: ToolResult) =>
  result.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('\n');

async function connect(fetchImpl: typeof fetch = okFetch) {
  const server = createServer(config, { fetch: fetchImpl });
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe('MCP server', () => {
  test('exposes exactly the list_accounts tool', async () => {
    const client = await connect();

    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name)).toEqual(['list_accounts']);
  });

  test('tells the model that id, not login, is the handle other tools take', async () => {
    const client = await connect();

    const { tools } = await client.listTools();

    expect(tools[0]?.description).toMatch(/accountId/);
    expect(tools[0]?.description).toMatch(/login/);
  });

  test('takes no arguments', async () => {
    const client = await connect();

    const { tools } = await client.listTools();

    expect(tools[0]?.inputSchema.properties ?? {}).toEqual({});
  });

  test('returns a readable summary and matching structured content', async () => {
    const client = await connect();

    const result = (await client.callTool({ name: 'list_accounts' })) as ToolResult;

    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain('accountId: 8f2c1b40-3d5e-4a17-9c8b-2e1f0a6d4b93');
    expect(AccountsOutputSchema.safeParse(result.structuredContent).success).toBe(true);
  });

  test('wraps the array under an accounts key so both protocol eras agree', async () => {
    const client = await connect();

    const result = (await client.callTool({ name: 'list_accounts' })) as ToolResult;

    expect(result.structuredContent).toHaveProperty('accounts');
    expect(Array.isArray(result.structuredContent)).toBe(false);
  });

  test('surfaces a missing scope as a tool error naming the scope', async () => {
    const forbidden = (async () =>
      new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Insufficient scope.' } }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch;
    const client = await connect(forbidden);

    const result = (await client.callTool({ name: 'list_accounts' })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('accounts:read');
  });

  test('surfaces the underlying network cause', async () => {
    const throwing = (async () => {
      throw new Error('fetch failed', { cause: { code: 'ENOTFOUND' } });
    }) as unknown as typeof fetch;
    const client = await connect(throwing);

    const result = (await client.callTool({ name: 'list_accounts' })) as ToolResult;

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('ENOTFOUND');
  });

  test('never puts the API key in an error result', async () => {
    const unauthorized = (async () =>
      new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'Invalid key.' } }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch;
    const client = await connect(unauthorized);

    const result = (await client.callTool({ name: 'list_accounts' })) as ToolResult;

    expect(textOf(result)).not.toContain('supersecret');
  });

  test('keeps the session alive after a failed call', async () => {
    const throwing = (async () => {
      throw new Error('fetch failed');
    }) as unknown as typeof fetch;
    const client = await connect(throwing);

    await client.callTool({ name: 'list_accounts' });
    const { tools } = await client.listTools();

    expect(tools).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/server.test.ts`
Expected: FAIL — cannot resolve `./server.js`.

- [ ] **Step 3: Write `src/server.ts`**

```ts
import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { AccountsOutputSchema, formatAccounts, parseAccounts } from './accounts.js';
import { createClient } from './client.js';
import { SERVER_NAME, SERVER_VERSION, type Config } from './config.js';
import { describeError } from './errors.js';

export type ServerDeps = { fetch?: typeof fetch };

/**
 * The tool list is registered once and never changes for the life of the
 * process, so clients on protocol revision 2026-07-28 may cache it. Without a
 * hint the SDK emits `ttlMs: 0` and every connection re-lists.
 */
const TOOL_LIST_TTL_MS = 3_600_000;

/** The scope `GET /api/v1/accounts` requires, quoted back in the 403 message. */
const ACCOUNTS_READ = 'accounts:read';

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

  server.registerTool(
    'list_accounts',
    {
      title: 'List linked MT5 accounts',
      description:
        'List the MT5 trading accounts linked to the configured Senti Quant API key. ' +
        'Returns each account\'s id, login, broker, last known balance and equity, sync ' +
        'state, and running strategies. The `id` field is the accountId every other Senti ' +
        'endpoint takes — pass `id`, not `login`, when a tool asks for an account.',
      inputSchema: z.object({}),
      outputSchema: AccountsOutputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (_args, ctx) => {
      try {
        // Forwarding the request's signal means a cancelled tool call also
        // aborts the outbound HTTP request instead of running it to completion.
        const payload = await client.get('/api/v1/accounts', {
          signal: ctx.mcpReq.signal,
          scope: ACCOUNTS_READ,
        });
        const accounts = parseAccounts(payload);

        return {
          content: [{ type: 'text' as const, text: formatAccounts(accounts) }],
          structuredContent: { accounts },
        };
      } catch (error) {
        // An error result carries text only — there is no successful payload to
        // describe, and `structuredContent` would have to satisfy outputSchema.
        return {
          content: [{ type: 'text' as const, text: describeError(error) }],
          isError: true,
        };
      }
    },
  );

  return server;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/server.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Write `src/index.ts`**

```ts
#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { SERVER_NAME, SERVER_VERSION, loadConfig } from './config.js';
import { createServer } from './server.js';

/**
 * Nothing here may write to stdout — that stream carries the JSON-RPC frames
 * of the stdio transport, and a stray log line corrupts the protocol.
 * Diagnostics go to stderr.
 *
 * Keep startup free of I/O. A client negotiating protocol revision 2026-07-28
 * over stdio probes with `server/discover` on a short-lived sibling process
 * spawned from the same command, so this program runs twice per connection.
 */
function main(): void {
  const config = loadConfig(process.env);

  const handle = serveStdio(() => createServer(config));
  console.error(`${SERVER_NAME} ${SERVER_VERSION} ready — serving ${config.baseUrl}`);

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => void handle.close());
  }
}

try {
  main();
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
```

- [ ] **Step 6: Verify the whole suite and the build**

Run: `npm test && npm run typecheck && npm run build`
Expected: all tests pass; typecheck clean; `dist/index.js` produced and executable.

- [ ] **Step 7: Verify the server starts and refuses to start without a key**

Run: `node dist/index.js`
Expected: exits 1, printing the `SENTI_API_KEY is required…` message to stderr.

Run: `SENTI_API_KEY=sq_live_placeholder node dist/index.js`
Expected: prints `senti-mcp-server 0.1.0 ready — serving https://api.sentitrade.xyz` to stderr and stays running. Stop it with Ctrl-C.

- [ ] **Step 8: Commit**

```bash
git add src/server.ts src/index.ts src/server.test.ts \
        docs/sprints/stories/US-2.2-list-accounts-tool.md
git commit -m "feat: register the list_accounts tool and the stdio entry point

structuredContent wraps the array under an 'accounts' key. The SDK does not
reject a bare array — it wraps non-object values as {result: …} on the 2025
era and passes them through on 2026. This server speaks both from one
process, so an explicit object is what keeps the shape identical on each.

The tool description states that id, not login, is the handle other endpoints
take; without it a model reaches for the MT5 account number."
```

---

### Task 6: Smoke test against the real API, the README, and the v0.1.0 release

**Story:** [US-2.3](../../sprints/stories/US-2.3-live-smoke-test-and-readme.md) — all
tasks, satisfying AC-1 through AC-13. This task also **closes the sprint**: see Step 9.

**Files:**
- Create: `src/smoke.test.ts`
- Create: `README.md`
- Modify: `docs/CHANGELOG.md`, `docs/sprints/**` (Step 9)

**Interfaces:**
- Consumes: `loadConfig` (Task 1), `createClient` (Task 3), `parseAccounts`/`formatAccounts` (Task 4).
- Produces: nothing consumed by other tasks.

Every other test in the suite uses a stubbed `fetch`. Without this task, nothing demonstrates the code works against the actual service.

- [ ] **Step 1: Confirm the credentials file exists**

The key lives in `.env.local`, which `.gitignore` already covers. It is **not** committed and must never be pasted into a chat transcript.

Run: `test -f .env.local && echo present`
Expected: `present`. If absent, create it with:

```
SENTI_SMOKE_KEY=sq_live_...
SENTI_API_BASE_URL=https://be-dev.sentitrade.xyz
```

- [ ] **Step 2: Write the smoke test**

Create `src/smoke.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { formatAccounts, parseAccounts } from './accounts.js';
import { createClient } from './client.js';
import { loadConfig } from './config.js';

/**
 * Opt-in: runs only when a real key is present, so CI and `npm test` skip it.
 * Invoke with `npm run test:smoke`, which loads `.env.local`.
 */
const smokeKey = process.env.SENTI_SMOKE_KEY;

describe.skipIf(!smokeKey)('smoke: live Senti API', () => {
  test('GET /api/v1/accounts returns a list this server can parse and render', async () => {
    const config = loadConfig({
      SENTI_API_KEY: smokeKey,
      SENTI_API_BASE_URL: process.env.SENTI_API_BASE_URL ?? 'https://be-dev.sentitrade.xyz',
    });

    const payload = await createClient(config).get('/api/v1/accounts', {
      scope: 'accounts:read',
    });
    const accounts = parseAccounts(payload);
    const rendered = formatAccounts(accounts);

    expect(Array.isArray(accounts)).toBe(true);
    expect(rendered.length).toBeGreaterThan(0);
    // Never assert on balances — they change. Assert the contract holds.
    for (const account of accounts) {
      expect(typeof account.id).toBe('string');
      expect(rendered).toContain(account.id);
    }
  }, 30_000);
});
```

- [ ] **Step 3: Run the smoke test against the development API**

Run: `npm run test:smoke`
Expected: PASS, 1 test. If it fails with a 403, the key is missing the `accounts:read` scope — the error message says so and names it.

Do not print the key: never run `cat .env.local` or `echo $SENTI_SMOKE_KEY`.

- [ ] **Step 4: Confirm the default suite still skips it**

Run: `npm test`
Expected: all unit tests pass; the smoke suite reports as skipped (no key in `process.env`).

- [ ] **Step 5: Write `README.md`**

````markdown
# senti-mcp-server

A [Model Context Protocol](https://modelcontextprotocol.io) server that lets an AI
assistant (Claude Code, Claude Desktop, Cursor, …) read trading data from the
**Senti Quant Public API**.

## Tools

| Tool | Input | What it does |
|------|-------|--------------|
| `list_accounts` | none | Lists the MT5 accounts linked to the configured API key: id, login, broker, last known balance and equity, sync state, running strategies. |

The `id` a tool returns is the `accountId` other Senti endpoints take. `login` is
the MT5 account number, not a key.

## Requirements

- Node.js ≥ 20
- A Senti Quant API key (`sq_live_…`) with the `accounts:read` scope, from the
  [API Keys dashboard](https://stage.sentitrade.xyz/account/api-keys)

## Configuration

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `SENTI_API_KEY` | ✅ | — | First-party key. The server exits at startup without it. |
| `SENTI_API_BASE_URL` | | `https://api.sentitrade.xyz` | Set to `https://be-dev.sentitrade.xyz` for development. |

## Install & build

```bash
npm install
npm run build
```

## Use with an MCP client

```json
{
  "mcpServers": {
    "senti": {
      "command": "node",
      "args": ["/absolute/path/to/senti-mcp-server/dist/index.js"],
      "env": {
        "SENTI_API_KEY": "sq_live_..."
      }
    }
  }
}
```

Restart the client; the `list_accounts` tool should appear.

## Security

The API key is read from the environment and never appears in a tool's input
schema. A tool parameter would live in the model's context, and from there in
transcripts and logs; an environment variable does not. The test suite asserts
the key appears in no error message.

This server registers **read-only tools only**. The Senti API's write operations
— closing positions, cancelling orders, stopping strategies — are deliberately
not exposed. Adding any of them requires its own design: an opt-in switch,
`Idempotency-Key` support, and user confirmation before execution.

## Development

```bash
npm test           # unit tests (stubbed fetch)
npm run test:watch
npm run test:smoke # one live call against the dev API; needs .env.local
npm run typecheck
npm run dev        # run from source, e.g. SENTI_API_KEY=… npm run dev
```

`npm run test:smoke` reads `SENTI_SMOKE_KEY` from `.env.local`, which is
gitignored. Without that file the smoke test is skipped, not failed.

## License

MIT
````

- [ ] **Step 6: Create the LICENSE file**

Run: `curl -s https://raw.githubusercontent.com/bluezdot/read-mcp-server/main/LICENSE -o LICENSE`
Expected: an MIT license file. If the fetch fails, copy `../read-mcp-server/LICENSE` and update the year and holder.

- [ ] **Step 7: Full verification before commit**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass.

- [ ] **Step 8: Commit the smoke test and the README**

```bash
git add src/smoke.test.ts README.md LICENSE
git commit -m "test: add live smoke test and README

Every other test stubs fetch, so nothing in the suite demonstrated the code
works against the real service. This one does, gated on a key in .env.local so
CI skips rather than fails."
```

- [ ] **Step 9: Release v0.1.0 and close the sprint**

This is the commit RULE-1 governs: `VERSION` and its CHANGELOG entry land together, and
the stories flip in the same commit.

1. **`docs/CHANGELOG.md`** — add the `[0.1.0]` entry, built by merging the
   `## Changelog entry` sections of US-2.1, US-2.2 and US-2.3. Header format:
   `## [0.1.0] — <today> — First release: authenticated Senti client and list_accounts — v0.1.0`.
   **Anchor the edit on the `## [Unreleased]` header**, not on any version header — see
   [changelog.md §3](../../../.agents/skills/koni-docs/references/templates/changelog.md).
   No SHA in the entry (RULE-2).
2. **`VERSION`** already reads `0.1.0`; confirm rather than bump. US-1.1 set it as the
   unreleased target, and this is the commit that makes it true.
3. **Stories** — flip US-1.1, US-2.1, US-2.2, US-2.3 to `status: done` with
   `version_shipped: 0.1.0` (bare, no `v` — RULE-16). Every task box `[x]` (RULE-10).
   Fill each story's `## Implementation notes` and `## Files modified` sections.
4. **`docs/sprints/sprint-2026-W32.md`** — `status: closed`, scope-table statuses to
   ✅, and a real retrospective replacing the placeholder.
5. **`docs/sprints/epics/EPIC-1.md` and `EPIC-2.md`** — `status: done` for EPIC-1;
   EPIC-2 stays `in-progress` (16 read operations remain). Update both story tables.
6. **`CLAUDE.md`** Active Context — sprint closed, stories ✅, `Last Version: 0.1.0`.
7. **Regenerate and validate**: `npm run agile:status && npm run agile:validate`.
   `validate` must exit 0.
8. **Full suite**: `npm test && npm run typecheck && npm run build`.
9. **Commit**, then tag:

```bash
git add -A
git commit -m "feat: release v0.1.0 — list_accounts over MCP stdio

Ships the first tool: list_accounts reads the MT5 accounts linked to the
configured Senti Quant API key and returns them as both a text summary and
structured content under an 'accounts' key.

VERSION and the CHANGELOG entry land together (RULE-1). All four W32 stories
flip to done with version_shipped 0.1.0; EPIC-1 closes, EPIC-2 stays open for
the remaining 16 read operations."
git tag v0.1.0
```

10. **Backfill the story `commit:` fields in a follow-up commit.** A commit cannot
    contain its own SHA, and `--amend`-ing one in rewrites the commit and orphans the
    SHA you just wrote (RULE-2). Read the SHA with `git rev-parse HEAD`, write it into
    each story's `commit:` field, and commit that as
    `docs: backfill v0.1.0 story commit SHAs`.
11. **Push** — `git push && git push --tags`.

---

## Self-Review

**Spec coverage.** Each spec section maps to a task: scope and the upstream API → Tasks 3–5; architecture and file structure → the File Structure table; configuration → Task 1; authentication → Tasks 1 and 3, with the no-leak assertion in Task 3 Step 1 and Task 5 Step 1; the client and its error mapping → Task 3; the data model → Task 4; the `list_accounts` tool → Task 5; security → the read-only annotation and single tool in Task 5, plus the README section in Task 6; testing → the test file in every task, with the live case in Task 6; packaging → Task 1 (`package.json`, `tsconfig.json`) and Task 6 (README, LICENSE).

Two spec items are deliberately *not* implemented and are correct as such: the path-parameter encoding rule is a constraint on future work with no v1 code path (v1's path is a constant), and npm publishing is out of scope.

**Placeholder scan.** No TBD, TODO, "similar to Task N", or "add error handling" steps. Every code step carries the actual code.

**Amendment, 2026-08-05 — koni-docs alignment.** This plan was written before
[US-1.1](../../sprints/stories/US-1.1-adopt-koni-docs-framework.md) adopted koni-docs,
and five things in it were stale rather than wrong:

1. Task 1 Step 1 created `package.json`. It now extends the existing one, which would
   otherwise have silently lost the `@koniverse/koni-docs` devDependency and the
   `agile:*` scripts. This was the only change that would have caused real damage.
2. Every task now names the story it advances, and `git add` lines include that story
   file so a task's completion and its record land in the same commit.
3. All seven commit messages gained conventional prefixes (RULE-14).
4. Task 6 gained Step 9, the release: `VERSION` plus the `[0.1.0]` CHANGELOG entry in
   one commit (RULE-1), story flips with `version_shipped`, sprint close, and the SHA
   backfill as a *follow-up* commit rather than an `--amend` (RULE-2).
5. Tasks 3 and 5 flip their stories to `review`, not `done` — RULE-16 makes
   `version_shipped` mandatory at `done`, and nothing has shipped until Step 9.

Nothing about the design, the file layout, the schemas, or the test expectations changed.

**Type consistency.** `Config` is `{ baseUrl, apiKey }` in Task 1 and used with those names in Tasks 3, 5, 6. `SentiClient.get(path, options)` is defined in Task 3 and called with `{ signal, scope }` in Task 5 and `{ scope }` in Task 6. `parseAccounts`/`formatAccounts`/`AccountsOutputSchema` are defined in Task 4 and imported under those names in Tasks 5 and 6. `ApiError(message, status, code?)` is defined in Task 2 and constructed with that arity in Task 3. `describeError` is defined in Task 2 and called in Task 5. `ServerDeps`/`ClientDeps` both use the `{ fetch?: typeof fetch }` shape, and Task 5 passes `deps.fetch` straight through to `createClient`.
