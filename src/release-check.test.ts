import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, describe, expect, test } from 'vitest';

/**
 * `scripts/release-check.mjs` is a CLI, so it is tested as one — by running it,
 * the way `src/index.test.ts` tests the built entry point by spawning it. The
 * contract under test is the exit code and the message, which is exactly what a
 * maintainer and the release workflow both consume.
 *
 * Every case builds a throwaway git repository under the OS temp directory and
 * points the gate at it with `--root`. Nothing here reads or writes this
 * repository, so a failing case cannot leave the working tree dirty.
 *
 * This file lives in `src/` rather than beside the script because
 * `vitest.config.ts` scopes collection to `src/**\/*.test.ts` ([CONTEXT D13]),
 * and widening that allowlist is what D13 exists to prevent. The script itself
 * stays out of `src/` so it stays out of the published tarball — `files` ships
 * `dist` and non-test `src`, and the tarball's 42-file count is quoted in
 * several documents.
 */

const run = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GATE = path.join(repoRoot, 'scripts', 'release-check.mjs');

const created: string[] = [];

afterAll(async () => {
  await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

interface FixtureOptions {
  versionFile?: string;
  pkgVersion?: string;
  lockVersion?: string;
  serverVersion?: string;
  changelog?: string;
  readme?: string;
  branch?: string;
  dirty?: boolean;
  tag?: string;
}

const CHANGELOG_OK = `# Changelog

## [Unreleased]

Nothing publishable.

## [1.1.0] — 2026-08-17 — a headline

### Added
- something

## [1.0.1] — 2026-08-07 — the six tools reach npm

### Fixed
- something else
`;

const README_OK = `# senti-mcp-server

- Node.js >= 20.6.0 — \`AbortSignal.any()\` landed in 20.3.0, and
  \`npm run test:smoke\` uses \`node --env-file\`, added in 20.6.0

\`npx -y senti-mcp-server\` resolves to whatever npm's \`latest\` tag points at —
\`1.1.0\` as of this release.

Pin it with \`["-y", "senti-mcp-server@1.1.0"]\`.
`;

async function git(cwd: string, ...args: string[]): Promise<void> {
  await run('git', args, { cwd });
}

async function fixture(options: FixtureOptions = {}): Promise<string> {
  const {
    versionFile = '1.1.0',
    pkgVersion = '1.1.0',
    lockVersion = '1.1.0',
    serverVersion = '1.1.0',
    changelog = CHANGELOG_OK,
    readme = README_OK,
    branch = 'main',
    dirty = false,
    tag,
  } = options;

  const dir = await mkdtemp(path.join(tmpdir(), 'senti-gate-'));
  created.push(dir);

  await mkdir(path.join(dir, 'src'), { recursive: true });
  await mkdir(path.join(dir, 'docs'), { recursive: true });
  await writeFile(path.join(dir, 'VERSION'), `${versionFile}\n`);
  await writeFile(path.join(dir, 'package.json'), `${JSON.stringify({ name: 'senti-mcp-server', version: pkgVersion }, null, 2)}\n`);
  await writeFile(
    path.join(dir, 'package-lock.json'),
    `${JSON.stringify({ name: 'senti-mcp-server', version: lockVersion, lockfileVersion: 3, packages: { '': { name: 'senti-mcp-server', version: lockVersion } } }, null, 2)}\n`,
  );
  await writeFile(
    path.join(dir, 'src', 'config.ts'),
    `export const SERVER_NAME = 'senti-mcp-server';\nexport const SERVER_VERSION = '${serverVersion}';\n`,
  );
  await writeFile(path.join(dir, 'docs', 'CHANGELOG.md'), changelog);
  await writeFile(path.join(dir, 'README.md'), readme);

  await git(dir, 'init', '-b', branch);
  await git(dir, 'config', 'user.email', 'test@example.com');
  await git(dir, 'config', 'user.name', 'test');
  await git(dir, 'add', '-A');
  await git(dir, 'commit', '-m', 'fixture');
  if (tag) await git(dir, 'tag', '-a', tag, '-m', tag);
  if (dirty) await writeFile(path.join(dir, 'VERSION'), `${versionFile}\n\n`);

  return dir;
}

async function gate(
  root: string,
  version?: string,
  ...flags: string[]
): Promise<{ code: number; output: string }> {
  const args = [GATE, ...(version ? [version] : []), '--root', root, ...flags];
  try {
    const { stdout, stderr } = await run(process.execPath, args);
    return { code: 0, output: stdout + stderr };
  } catch (error) {
    const e = error as { code?: number; stdout?: string; stderr?: string };
    return { code: e.code ?? 1, output: (e.stdout ?? '') + (e.stderr ?? '') };
  }
}

describe('release:check — version agreement', () => {
  test('names the file and both values when package.json disagrees', async () => {
    const root = await fixture({ pkgVersion: '1.0.1' });
    const result = await gate(root, '1.1.0');

    expect(result.code).not.toBe(0);
    expect(result.output).toMatch(/package\.json/);
    expect(result.output).toMatch(/1\.0\.1/);
    expect(result.output).toMatch(/1\.1\.0/);
  });

  test('names src/config.ts when SERVER_VERSION disagrees', async () => {
    const root = await fixture({ serverVersion: '0.9.0' });
    const result = await gate(root, '1.1.0');

    expect(result.code).not.toBe(0);
    expect(result.output).toMatch(/config\.ts/);
    expect(result.output).toMatch(/0\.9\.0/);
  });

  test('names package-lock.json when its version field drifted', async () => {
    // Found by running `npm version` during US-4.2: the real lock file had said
    // 0.1.0 since the 0.2.0 release while package.json said 1.0.1. A fourth
    // place the version lives, wrong for eight releases, checked by nothing.
    const root = await fixture({ lockVersion: '0.1.0' });
    const result = await gate(root, '1.1.0');

    expect(result.code).not.toBe(0);
    expect(result.output).toMatch(/package-lock\.json/);
    expect(result.output).toMatch(/0\.1\.0/);
  });

  test('defaults the target version to VERSION and says which it checked', async () => {
    const root = await fixture();
    const result = await gate(root);

    expect(result.code).toBe(0);
    expect(result.output).toMatch(/1\.1\.0/);
  });
});

describe('release:check — CHANGELOG', () => {
  test('fails naming the missing heading when the version has no section', async () => {
    const root = await fixture({ changelog: '# Changelog\n\n## [Unreleased]\n\n## [1.0.1] — old\n' });
    const result = await gate(root, '1.1.0');

    expect(result.code).not.toBe(0);
    expect(result.output).toMatch(/\[1\.1\.0\]/);
  });

  test('fails when Unreleased still carries release content', async () => {
    const changelog = CHANGELOG_OK.replace('Nothing publishable.', '### Added\n- a tool that belongs to this release');
    const root = await fixture({ changelog });
    const result = await gate(root, '1.1.0');

    expect(result.code).not.toBe(0);
    expect(result.output).toMatch(/Unreleased/);
  });

  test('accepts an Unreleased section holding only prose', async () => {
    const root = await fixture();
    const result = await gate(root, '1.1.0');

    expect(result.code).toBe(0);
  });
});

describe('release:check — README, the only prose in the tarball', () => {
  test('quotes the line when a pin example names another version', async () => {
    const readme = README_OK.replace('senti-mcp-server@1.1.0', 'senti-mcp-server@1.0.1');
    const root = await fixture({ readme });
    const result = await gate(root, '1.1.0');

    expect(result.code).not.toBe(0);
    expect(result.output).toMatch(/README/);
    expect(result.output).toMatch(/senti-mcp-server@1\.0\.1/);
  });

  test('quotes the line when a latest/this-release claim names another version', async () => {
    const readme = README_OK.replace('`1.1.0` as of this release', '`1.0.1` as of this release');
    const root = await fixture({ readme });
    const result = await gate(root, '1.1.0');

    expect(result.code).not.toBe(0);
    expect(result.output).toMatch(/as of this release/);
  });

  test('does not flag the Node version floor', async () => {
    const root = await fixture();
    const result = await gate(root, '1.1.0');

    expect(result.code).toBe(0);
    expect(result.output).not.toMatch(/20\.6\.0/);
  });

  test('does not flag a historical claim about a past version', async () => {
    const readme = `${README_OK}\nOnly \`list_accounts\` is reachable on \`0.1.0\`, which was published first.\n`;
    const root = await fixture({ readme });
    const result = await gate(root, '1.1.0');

    expect(result.code).toBe(0);
  });
});

describe('release:check — git preconditions', () => {
  test('refuses a version whose tag already exists', async () => {
    const root = await fixture({ tag: 'v1.1.0' });
    const result = await gate(root, '1.1.0');

    expect(result.code).not.toBe(0);
    expect(result.output).toMatch(/v1\.1\.0/);
    expect(result.output).toMatch(/already/i);
  });

  test('refuses a dirty working tree', async () => {
    const root = await fixture({ dirty: true });
    const result = await gate(root, '1.1.0');

    expect(result.code).not.toBe(0);
    expect(result.output).toMatch(/clean|dirty|uncommitted/i);
  });

  test('refuses a branch that is not main', async () => {
    const root = await fixture({ branch: 'feat/something' });
    const result = await gate(root, '1.1.0');

    expect(result.code).not.toBe(0);
    expect(result.output).toMatch(/main/);
  });
});

/**
 * A tag-triggered workflow checks out a detached HEAD at a tag that already
 * exists — it is what started the run. Those two checks are local-only
 * preconditions; the workflow asserts the equivalents itself (the tag is
 * annotated, and it is an ancestor of origin/main).
 */
describe('release:check — --ci', () => {
  test('accepts the release tag already existing', async () => {
    const root = await fixture({ tag: 'v1.1.0' });
    const result = await gate(root, '1.1.0', '--ci');

    expect(result.code).toBe(0);
  });

  test('accepts a detached HEAD / non-main branch', async () => {
    const root = await fixture({ branch: 'detached-stand-in' });
    const result = await gate(root, '1.1.0', '--ci');

    expect(result.code).toBe(0);
  });

  test('still enforces every artifact check', async () => {
    const root = await fixture({ pkgVersion: '1.0.1', tag: 'v1.1.0' });
    const result = await gate(root, '1.1.0', '--ci');

    expect(result.code).not.toBe(0);
    expect(result.output).toMatch(/package\.json/);
  });

  test('says which checks it skipped rather than skipping them silently', async () => {
    const root = await fixture({ tag: 'v1.1.0' });
    const result = await gate(root, '1.1.0', '--ci');

    expect(result.output).toMatch(/skip/i);
  });
});

describe('release:check — reporting', () => {
  test('reports every failing check in one run, not just the first', async () => {
    const root = await fixture({ pkgVersion: '1.0.1', serverVersion: '0.9.0', branch: 'wip' });
    const result = await gate(root, '1.1.0');

    expect(result.code).not.toBe(0);
    expect(result.output).toMatch(/package\.json/);
    expect(result.output).toMatch(/config\.ts/);
    expect(result.output).toMatch(/main/);
  });

  test('prints the observed value for each passing check, not merely ok', async () => {
    const root = await fixture();
    const result = await gate(root, '1.1.0');

    expect(result.code).toBe(0);
    expect(result.output).toMatch(/VERSION.*1\.1\.0/);
  });
});
