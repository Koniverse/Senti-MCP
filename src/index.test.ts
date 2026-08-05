import { type ChildProcessWithoutNullStreams, execFile, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { beforeAll, describe, expect, test } from 'vitest';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entryPoint = path.join(repoRoot, 'dist', 'index.js');

/**
 * Everything else in this suite reaches the server through `InMemoryTransport`,
 * which bypasses `serveStdio`, the stdout framing, and `loadConfig(process.env)`
 * — precisely what US-2.2 AC-18 is about. So this spawns the real bootstrap.
 *
 * It builds rather than running the TypeScript through `tsx`, because AC-18 is a
 * claim about the built artifact: `dist/index.js` is what a client's `mcpServers`
 * block executes, and running the source would leave a broken `outDir`, shebang
 * or `chmod` undetected. The cost is one `tsc` run; the build must never be
 * skipped, or the test would silently prove nothing.
 */
beforeAll(async () => {
  await execFileAsync('npm', ['run', 'build'], { cwd: repoRoot });
}, 180_000);

type Capture = {
  child: ChildProcessWithoutNullStreams;
  stdout: () => string;
  stderr: () => string;
  exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
};

/**
 * `env` is built from scratch rather than spread over `process.env`, so a
 * `SENTI_API_KEY` exported in the developer's shell cannot mask the
 * missing-key case.
 */
function start(env: Record<string, string>): Capture {
  const child = spawn(process.execPath, [entryPoint], {
    cwd: repoRoot,
    env: { PATH: process.env.PATH ?? '', ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let out = '';
  let err = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    out += chunk;
  });
  child.stderr.on('data', (chunk: string) => {
    err += chunk;
  });

  // `close`, not `exit`: Node can fire `exit` before the piped stdio streams
  // have drained, so a child that wrote a stray byte to stdout immediately
  // before exiting could still race past the `stdout() === ''` assertions
  // below. `close` fires only once stdout/stderr are fully drained.
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    child.on('close', (code, signal) => resolve({ code, signal }));
  });

  return { child, stdout: () => out, stderr: () => err, exited };
}

/** Resolves once `predicate` holds, or rejects with what was seen instead. */
async function waitFor(
  predicate: () => boolean,
  describeFailure: () => string,
  timeoutMs = 15_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting: ${describeFailure()}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

describe('stdio bootstrap (dist/index.js)', () => {
  test('exits 1 with an actionable stderr message and no stdout when the key is absent', async () => {
    const run = start({});

    const { code } = await run.exited;

    expect(code).toBe(1);
    expect(run.stderr()).toMatch(/SENTI_API_KEY is required/);
    expect(run.stderr()).toMatch(/api-keys/);
    // A single stray byte on stdout corrupts the JSON-RPC stream, and the
    // symptom is a client that fails to connect for no visible reason.
    expect(run.stdout()).toBe('');
  }, 30_000);

  test('reports readiness on stderr, keeps running, and leaves stdout untouched', async () => {
    const run = start({ SENTI_API_KEY: 'sq_live_placeholder' });

    await waitFor(
      () => /ready/.test(run.stderr()),
      () => `no readiness line; stderr was ${JSON.stringify(run.stderr())}`,
    );

    expect(run.stderr()).toContain('senti-mcp-server');
    expect(run.stdout()).toBe('');
    // Still serving: a bootstrap that exits after printing would pass every
    // assertion above and still be useless.
    expect(run.child.exitCode).toBeNull();

    run.child.kill('SIGTERM');
    const { code, signal } = await run.exited;

    // The SIGTERM handler closes the transport. If `close()` rejected and the
    // rejection floated, Node would abort here instead of exiting cleanly.
    expect(run.stderr()).not.toMatch(/unhandled|UnhandledPromiseRejection/i);
    expect(code === 0 || signal === 'SIGTERM').toBe(true);
    expect(run.stdout()).toBe('');
  }, 30_000);
});
