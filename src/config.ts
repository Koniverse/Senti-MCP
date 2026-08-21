export const SERVER_NAME = 'senti-mcp-server';
export const SERVER_VERSION = '2.5.0';
const DEFAULT_BASE_URL = 'https://api.sentitrade.xyz';
const ALLOWED_PROTOCOLS: readonly string[] = ['https:', 'http:'];
/** Nothing else enables a write. "0", "false" and "no" must not be surprises. */
const TRUTHY: readonly string[] = ['1', 'true'];

export type Config = {
  /** API root, without a trailing slash. */
  baseUrl: string;
  apiKey: string;
  /**
   * Whether the authoring write tools are registered at all. Authoring-only by
   * design: the trading write path gets its own flag, so enabling an agent to
   * edit MQL5 is never the same act as enabling it to close a position.
   */
  authoringWrite: boolean;
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

  if (base.search || base.hash) {
    throw new Error(
      `SENTI_API_BASE_URL must not carry a query string or fragment, got: ${rawBaseUrl}`,
    );
  }

  return Object.freeze({
    baseUrl: base.href.replace(/\/+$/, ''),
    apiKey,
    authoringWrite: TRUTHY.includes((env.SENTI_ENABLE_AUTHORING_WRITE ?? '').trim().toLowerCase()),
  });
}
