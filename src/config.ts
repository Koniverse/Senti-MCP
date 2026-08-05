/**
 * Server identity. `server.ts` and the default User-Agent both read these, so
 * they stay in one place; keep in sync with package.json on release.
 */
export const SERVER_NAME = 'senti-mcp-server';
export const SERVER_VERSION = '0.1.0';

/** The canonical host, listed first in the API's OpenAPI document. */
const DEFAULT_BASE_URL = 'https://api.sentitrade.xyz';

/**
 * `new URL()` accepts `file:///etc`, `data:…` and a bare `foo:bar` just as
 * readily as an API host, and this client can fetch none of them — such a value
 * is a typo, and failing at load time names it instead of surfacing later as an
 * unreadable fetch error.
 *
 * `http:` is allowed alongside `https:` on purpose, so the server can be pointed
 * at an API running locally over plain HTTP. It is the weaker of the two: the
 * `Authorization: Bearer sq_live_…` header crosses the network in cleartext, so
 * the error text below says so and the choice stays a deliberate one.
 */
const ALLOWED_PROTOCOLS: readonly string[] = ['https:', 'http:'];

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
        "SENTI_API_KEY=sq_live_… in the MCP server's env block.",
    );
  }

  const rawBaseUrl = env.SENTI_API_BASE_URL?.trim() || DEFAULT_BASE_URL;

  let base: URL;
  try {
    base = new URL(rawBaseUrl);
  } catch {
    throw new Error(`SENTI_API_BASE_URL must be an absolute URL, got: ${rawBaseUrl}`);
  }

  if (!ALLOWED_PROTOCOLS.includes(base.protocol)) {
    throw new Error(
      `SENTI_API_BASE_URL must use https: or http:, got: ${rawBaseUrl}. ` +
        'A plain http: base sends the API key across the network in cleartext, ' +
        'so prefer https: outside local development.',
    );
  }

  // A query or fragment cannot survive being joined to an endpoint path: the
  // client concatenates, so `https://host?x=1` would produce the unreachable
  // `https://host/?x=1/api/v1/accounts`. Naming it here beats debugging a 404.
  if (base.search || base.hash) {
    throw new Error(
      'SENTI_API_BASE_URL must be a bare origin with no query string or fragment, ' +
        `got: ${rawBaseUrl}`,
    );
  }

  return Object.freeze({
    baseUrl: base.href.replace(/\/+$/, ''),
    apiKey,
  });
}
