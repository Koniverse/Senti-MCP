export const SERVER_NAME = 'senti-mcp-server';
export const SERVER_VERSION = '2.1.0';
const DEFAULT_BASE_URL = 'https://api.sentitrade.xyz';
const ALLOWED_PROTOCOLS: readonly string[] = ['https:', 'http:'];

export type Config = {
  /** API root, without a trailing slash. */
  baseUrl: string;
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

  if (base.search || base.hash) {
    throw new Error(
      `SENTI_API_BASE_URL must not carry a query string or fragment, got: ${rawBaseUrl}`,
    );
  }

  return Object.freeze({
    baseUrl: base.href.replace(/\/+$/, ''),
    apiKey,
  });
}
