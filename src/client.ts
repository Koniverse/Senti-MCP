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
