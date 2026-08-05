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

  test('names the environment as a 401 cause, not only the key', async () => {
    const { fetchImpl } = stub(jsonResponse(envelope('UNAUTHENTICATED', 'Invalid API key.'), 401));

    const promise = createClient(config, { fetch: fetchImpl }).get('/api/v1/accounts');

    await expect(promise).rejects.toThrow(/SENTI_API_BASE_URL/);
  });

  test('does not double the sentence terminator after an envelope message', async () => {
    const { fetchImpl } = stub(jsonResponse(envelope('FORBIDDEN', 'Insufficient scope.'), 403));

    const message = await createClient(config, { fetch: fetchImpl })
      .get('/api/v1/accounts', { scope: 'accounts:read' })
      .then(
        () => '',
        (error: unknown) => (error as Error).message,
      );

    expect(message).toContain('Insufficient scope. The API key is missing');
    expect(message).not.toContain('..');
  });

  test('leaves an envelope message that carries no terminator alone', async () => {
    const { fetchImpl } = stub(jsonResponse(envelope('INTERNAL', 'Upstream broker down'), 500));

    const promise = createClient(config, { fetch: fetchImpl }).get('/api/v1/accounts');

    await expect(promise).rejects.toThrow(/— Upstream broker down\./);
  });

  /**
   * The caller-signal test above proves a signal reaches `fetch`; it passes just
   * as happily with a 15 ms timeout as a 15 s one. This pins the timeout leg:
   * the delay it is created with, and that firing it rejects the in-flight
   * request. Fake timers cannot drive `AbortSignal.timeout` — Node schedules it
   * on internal timers rather than the patched global — so the signal itself is
   * substituted instead.
   */
  test('arms the 15s fetch timeout and aborts a hung request when it fires', async () => {
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);

    try {
      // Rejecting on abort is what a real `fetch` does; a stub that only hangs
      // would leave the assertion below waiting forever.
      const hanging = ((_url: string | URL, init: RequestInit = {}) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject((init.signal as AbortSignal).reason as Error);
          });
        })) as unknown as typeof fetch;

      const promise = createClient(config, { fetch: hanging }).get('/api/v1/accounts');

      expect(timeout).toHaveBeenCalledWith(15_000);

      controller.abort(new DOMException('The operation timed out.', 'TimeoutError'));

      await expect(promise).rejects.toThrow(/timed out/i);
    } finally {
      timeout.mockRestore();
    }
  });
});
