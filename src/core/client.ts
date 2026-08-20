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

export type SentiClient = {
  /** Returns the parsed JSON body. Validation belongs to the domain module. */
  get(path: string, options?: RequestOptions): Promise<unknown>;
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
  options: RequestOptions,
): ApiError {
  const { scope, conflictMeans, notFoundMeans } = options;
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

  return {
    async get(path: string, options: RequestOptions = {}): Promise<unknown> {
      const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);

      const response = await doFetch(`${config.baseUrl}${path}${queryStringOf(options.query)}`, {
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
        throw failureOf(response.status, response.headers, body, options);
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
