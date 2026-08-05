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
