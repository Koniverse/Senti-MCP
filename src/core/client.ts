import { createHash } from 'node:crypto';
import { SERVER_NAME, SERVER_VERSION, type Config } from '../config.js';
import { ApiError } from './errors.js';

/** Single home for the server's outbound fetch policy. */
const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT = `${SERVER_NAME}/${SERVER_VERSION}`;

export type ClientDeps = { fetch?: typeof fetch };

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
  /**
   * What a 409 means for THIS endpoint, quoted verbatim. The client cannot
   * infer it: on account-scoped reads a 409 is "terminal offline", and on the
   * write path it will mean something else entirely. Same reasoning as `scope`.
   */
  conflictMeans?: string;
  /**
   * What a 404 means for THIS endpoint, quoted verbatim. Same reasoning again:
   * only the account-scoped paths can say an account is missing. `/brokers`
   * and `/strategies` take no `accountId`, so account guidance on their 404s
   * sends the reader to check the one thing that cannot be the cause.
   */
  notFoundMeans?: string;
  /**
   * What a 403 means for THIS endpoint. On a read it is always a missing
   * scope. On a write it is also a full cap — 20 drafts, 5 attachments — and
   * against that cause the default wording sends the reader to mint a key they
   * already hold, when the fix is to delete something.
   */
  forbiddenMeans?: string;
  /** What a 422 means for THIS endpoint. */
  unprocessableMeans?: string;
  /** Which upstream a 502/503/504 is about, quoted verbatim. */
  upstreamMeans?: string;
};

/**
 * What a 404 means on an account-scoped path. Lives here so the three tools
 * that build such a path share one wording, but is passed in rather than
 * assumed — see `notFoundMeans`.
 */
export const ACCOUNT_NOT_FOUND =
  'The account does not exist, is not owned by this API key, or has been unlinked. ' +
  'If a `login` (the MT5 account number) was passed where an `accountId` was expected, ' +
  'call list_accounts and use its `id`.';

export const DRAFT_NOT_FOUND =
  'The draft does not exist or is not owned by this API key. ' +
  'Call list_drafts and use its `id`.';

/**
 * A 404 on an attachment path has a cause `DRAFT_NOT_FOUND` does not cover:
 * the attachment may exist and belong to another draft.
 */
export const ATTACHMENT_NOT_FOUND =
  'The attachment does not exist, is not owned by this API key, or belongs to a different ' +
  'draft. Call list_draft_attachments with this draftId and use its `id`.';

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

export type WriteMethod = 'POST' | 'PUT' | 'DELETE';

export type WriteOptions = RequestOptions & {
  /** Serialised as JSON. Omitted entirely when undefined — DELETE and compile send none. */
  body?: unknown;
  idempotencyKey?: string;
};

export type SentiClient = {
  /** Returns the parsed JSON body. Validation belongs to the domain module. */
  get(path: string, options?: RequestOptions): Promise<unknown>;
  /** Same contract as `get`, with a method, an optional body and no retry. */
  send(method: WriteMethod, path: string, options?: WriteOptions): Promise<unknown>;
};

/**
 * A key that identifies the request, not the attempt. A random key per call
 * would satisfy the header and dedupe nothing: with no automatic retry
 * anywhere, the only duplicate this server emits is the same tool called twice
 * with the same arguments, and that is exactly what this makes replay.
 */
export function idempotencyKeyFor(method: WriteMethod, path: string, body: unknown): string {
  return createHash('sha256')
    .update(`${method}\n${path}\n${JSON.stringify(body)}`)
    .digest('hex')
    .slice(0, 32);
}

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

/** The upstream clause of a 502/503/504, or nothing when the caller named none. */
function upstream(means: string | undefined): string {
  return means ? ` ${means}` : '';
}

/**
 * Turn a failed response into an error a reader can act on.
 *
 * The 403 case earns its wording. Read plainly, "Forbidden" suggests the caller
 * may not touch that account, which sends people to investigate the wrong
 * thing. On every read it means the key lacks a scope, which is the default
 * wording; on a write it can also mean a cap is full, which is why the caller
 * may override it with `forbiddenMeans`.
 */
function failureOf(
  status: number,
  headers: Headers,
  body: unknown,
  options: RequestOptions,
): ApiError {
  const { scope, conflictMeans, notFoundMeans, forbiddenMeans, unprocessableMeans, upstreamMeans } =
    options;
  const { code, message } = envelopeOf(body);
  // Each template below ends its own sentence, so an envelope message that
  // already carries a terminator would render as "…Insufficient scope.. The API
  // key is missing…". Drop the envelope's, keep the template's.
  const trimmed = message?.trim().replace(/\.$/, '') ?? '';
  const detail = trimmed ? ` — ${trimmed}` : '';

  switch (status) {
    case 401:
      return new ApiError(
        `Senti API rejected the credentials (401)${detail}. Check SENTI_API_KEY; ` +
          'first-party keys look like "sq_live_…". The key must also belong to the ' +
          'environment SENTI_API_BASE_URL points at — a key issued in one environment ' +
          'returns 401 against another.',
        status,
        code,
      );

    case 403: {
      const named = scope ? `the \`${scope}\` scope` : 'a scope this endpoint requires';
      const meaning = forbiddenMeans
        ? ` ${forbiddenMeans}`
        : ` The API key is missing ${named} — not that the account is off limits. ` +
          'Create a key with that scope in the API Keys dashboard.';

      return new ApiError(`Senti API returned 403${detail}.${meaning}`, status, code);
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

    case 404: {
      const meaning = notFoundMeans
        ? ` ${notFoundMeans}`
        : ' Nothing is served at that path. Check that SENTI_API_BASE_URL points at the ' +
          'environment you mean, and that this API still serves the path.';

      return new ApiError(`Senti API returned 404${detail}.${meaning}`, status, code);
    }

    case 409: {
      const meaning = conflictMeans
        ? ` ${conflictMeans}`
        : ' The request conflicts with the resource\'s current state.';

      return new ApiError(`Senti API returned 409${detail}.${meaning}`, status, code);
    }

    case 413:
      return new ApiError(
        `Senti API returned 413${detail}. The request body exceeds the gateway's 1 MB ` +
          'limit — the transport refusing, before any platform cap is consulted. Send less ' +
          'in one call.',
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
        `Senti API returned 502${detail}.${upstream(upstreamMeans)} An upstream service the ` +
          'API depends on is unreachable.',
        status,
        code,
      );

    case 503: {
      // Reported, never slept on: a tool call that waits holds the host's turn
      // open for an interval the server chose. The absence of the header is
      // itself documented as meaning a retry cannot help.
      const retryAfter = headers.get('retry-after');
      const guidance = retryAfter
        ? ` Retry after ${retryAfter} second(s) — this server neither waits for you nor ` +
          'retries on your behalf.'
        : ' No Retry-After header was sent, which this API documents as meaning a retry ' +
          'cannot help.';

      return new ApiError(
        `Senti API returned 503${detail}.${upstream(upstreamMeans)}${guidance}`,
        status,
        code,
      );
    }

    case 504:
      return new ApiError(
        `Senti API returned 504${detail}.${upstream(upstreamMeans)} The API timed out ` +
          "waiting for an upstream service. This is the API's own timeout, not this " +
          "server's 15-second one.",
        status,
        code,
      );

    default:
      return new ApiError(`Senti API request failed: HTTP ${status}${detail}.`, status, code);
  }
}

/**
 * What a path segment may contain. Deliberately not a UUID pattern: the
 * OpenAPI document declares both `accountId` and `draftId` as a bare
 * `type: string` with no `format` and no `pattern`, so hard-coding UUID would
 * take every tool keyed on either one down at once the day Senti issues an id
 * in another shape — this server's assumption failing, not the API's
 * contract. What this does reject is everything that makes concatenation
 * dangerous.
 */
const PATH_SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * The only function permitted to build a path containing a parameter. No tool
 * concatenates: an id such as `accountId` or `draftId` originates from the
 * model, and a value such as `..%2F..%2Fadmin` escapes a prefix such as
 * `/api/v1/accounts/` or `/api/v1/drafts/` under naive concatenation.
 *
 * Note that a wrong-but-legal value (e.g. a `login`, the MT5 account number,
 * passed where an `accountId` was expected) passes this check — it is a legal
 * segment, just the wrong value. What catches that is the 404 message, built
 * from whichever `hint` the caller supplied (`ACCOUNT_NOT_FOUND` or
 * `DRAFT_NOT_FOUND`).
 */
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
