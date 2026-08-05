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

  const handle = serveStdio(() => createServer(config), {
    // Out-of-band transport failures are otherwise silent, and this is the one
    // process where a `console.log` cannot be used to investigate.
    onerror: (error: Error) => {
      console.error(`${SERVER_NAME}: transport error — ${error.message}`);
    },
  });
  console.error(`${SERVER_NAME} ${SERVER_VERSION} ready — serving ${config.baseUrl}`);

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      handle.close().catch((error: unknown) => {
        console.error(
          `${SERVER_NAME}: shutdown failed — ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    });
  }
}

try {
  main();
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
