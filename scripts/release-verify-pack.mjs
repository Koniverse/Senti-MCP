#!/usr/bin/env node
/**
 * Proves the tarball works **before** the publish that cannot be undone.
 *
 * `src/index.test.ts` already spawns `dist/index.js`, so the built entry point
 * is covered. What has never been covered is the packaging step between
 * `dist/` and the registry — the `files` allowlist, `bin` resolution, the
 * executable bit surviving the pack, a runtime import that only resolved
 * because this repo's `node_modules` was next door. That gap is where CONTEXT
 * D12's defect lived: `npm pack --dry-run` listed three dead `dist/` files for
 * the 1.0.0 tarball.
 *
 * This is the check adopted *instead of* a `next` dist-tag (CONTEXT D20): the
 * same protection, one irreversible act earlier.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** A tarball entry list is enough to judge these three, so they are pure. */
export function auditTarball(paths) {
  const problems = [];
  const names = paths.map((p) => p.replace(/^package\//, ''));

  for (const name of names) {
    if (/\.test\.[cm]?[jt]s$/.test(name)) {
      problems.push(`test source reached the tarball: ${name}`);
    }
  }
  if (!names.includes('README.md')) {
    problems.push('README.md is missing — it is the npm package page, the only prose a reader on the registry sees');
  }
  if (!names.includes('LICENSE')) {
    problems.push('LICENSE is missing');
  }
  return problems;
}

/**
 * The opt-in every authoring write tool is registered behind, as of 2.5.0. The
 * README's tool table documents them, so the packaged server has to be asked
 * with the flag on before the two can be compared.
 */
const WRITES_ON = { SENTI_ENABLE_AUTHORING_WRITE: '1' };

/**
 * The tool names README.md's `## Tools` table documents — an independent claim
 * about the release, and the only one `diffTools` alone cannot check: build and
 * tarball come from the same source, so a tool deleted from `src/server.ts`
 * vanishes from both and they still agree. README is inside the tarball and is
 * the npm package page, so a table that disagrees with the server is exactly
 * the CONTEXT D12 defect.
 *
 * Only the first column of a table row counts. A name in prose, or the
 * `accountId` in an Input cell, is not a claim that a tool exists.
 */
export function readmeTools(readme) {
  const section = readme.split(/^## Tools\s*$/m)[1]?.split(/^## /m)[0] ?? '';
  return [...section.matchAll(/^\|\s*`([a-z][a-z0-9_]*)`\s*\|/gm)].map((m) => m[1]);
}

/** Set comparison, order-insensitive; an empty observed set is never a pass. */
export function diffTools(expected, observed) {
  const problems = [];
  for (const name of expected) {
    if (!observed.includes(name)) problems.push(`missing from the packaged server: ${name}`);
  }
  for (const name of observed) {
    if (!expected.includes(name)) problems.push(`unexpected in the packaged server: ${name}`);
  }
  return problems;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (!isMain) {
  // Imported for its pure helpers — run nothing.
} else {
  await main();
}

async function main() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const problems = [];
  const step = (msg) => console.log(`  ${msg}`);
  let workspace;

  console.log('release:verify-pack — proving the tarball before it is published\n');

  try {
    step('building…');
    must(spawnSync('npm', ['run', 'build'], { cwd: repoRoot, encoding: 'utf8' }), 'npm run build');

    step('listing the tools this build exposes…');
    const expected = await listTools(
      process.execPath,
      [path.join(repoRoot, 'dist', 'index.js')],
      repoRoot,
      WRITES_ON,
    );
    step(`  build exposes ${expected.length}: ${expected.join(', ')}`);
    if (expected.length === 0) problems.push('the build exposed no tools at all — nothing to compare against');

    workspace = mkdtempSync(path.join(tmpdir(), 'senti-pack-'));
    step(`packing into ${workspace}…`);
    const packed = must(
      spawnSync('npm', ['pack', '--pack-destination', workspace], { cwd: repoRoot, encoding: 'utf8' }),
      'npm pack',
    ).stdout.trim().split('\n').pop();
    const tarball = path.join(workspace, packed);

    step('auditing tarball contents…');
    const entries = must(spawnSync('tar', ['-tzf', tarball], { encoding: 'utf8' }), 'tar -tzf')
      .stdout.split('\n')
      .filter(Boolean);
    step(`  ${entries.length} entries`);
    problems.push(...auditTarball(entries));

    const consumer = path.join(workspace, 'consumer');
    step('installing the tarball into a clean directory…');
    must(spawnSync('npm', ['init', '-y'], { cwd: mkdirp(consumer), encoding: 'utf8' }), 'npm init');
    must(
      spawnSync('npm', ['install', '--no-audit', '--no-fund', tarball], { cwd: consumer, encoding: 'utf8' }),
      'npm install <tarball>',
    );

    const bin = path.join(consumer, 'node_modules', '.bin', 'senti-mcp-server');
    step('spawning the installed binary through its bin name…');
    const observed = await listTools(bin, [], consumer, WRITES_ON);
    step(`  packaged server exposes ${observed.length} with writes on: ${observed.join(', ')}`);
    problems.push(...diffTools(expected, observed));

    // The README's table documents every tool, including the ones an operator
    // has to opt into — so the comparison below has to be made against a server
    // that registered them. This second spawn is what proves the opt-in still
    // gates them *in the shipped artifact*: whether the right tools are gated is
    // asserted by `src/server.test.ts`, but whether the flag survives packing is
    // only observable here.
    step('spawning it again without the opt-in, to prove the flag still gates…');
    const readOnly = await listTools(bin, [], consumer);
    const gated = observed.filter((name) => !readOnly.includes(name));
    const leaked = readOnly.filter((name) => !observed.includes(name));
    step(`  ${readOnly.length} without the opt-in; gated by it: ${gated.join(', ') || 'none'}`);
    if (leaked.length > 0) {
      problems.push(
        `the opt-in REMOVED tool(s) instead of adding them: ${leaked.join(', ')} — ` +
          'SENTI_ENABLE_AUTHORING_WRITE must only ever add to the surface',
      );
    }
    if (gated.length === 0) {
      problems.push(
        'SENTI_ENABLE_AUTHORING_WRITE registered nothing in the packaged server — either no ' +
          'write tool shipped, or the flag is being ignored, and both are wrong from 2.5.0 on',
      );
    }

    step("checking the packaged README's tool table against the packaged server…");
    const documented = readmeTools(readFileSync(path.join(consumer, 'node_modules', 'senti-mcp-server', 'README.md'), 'utf8')).sort();
    step(`  README documents ${documented.length}: ${documented.join(', ')}`);
    if (documented.length === 0) problems.push("README.md's `## Tools` table documented nothing — the package page claims no tools");
    problems.push(...diffTools(documented, observed).map((p) => `${p} (README tool table vs packaged server)`));
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
  } finally {
    if (workspace) rmSync(workspace, { recursive: true, force: true });
  }

  if (problems.length > 0) {
    console.error(`\nrelease:verify-pack FAILED — ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    console.error('\nThis failing before a publish is the system working. Do not publish.');
    process.exit(1);
  }
  console.log('\nrelease:verify-pack passed — the tarball installs and serves what the build serves.');
}

function mkdirp(dir) {
  spawnSync('mkdir', ['-p', dir]);
  return dir;
}

function must(result, what) {
  if (result.status !== 0) {
    throw new Error(`${what} failed (exit ${result.status}): ${(result.stderr || result.stdout || '').trim().slice(-500)}`);
  }
  return result;
}

/**
 * Drives a stdio MCP server far enough to read `tools/list`. A dummy key is
 * supplied because the server exits without one; nothing here reaches the
 * network, so this stays runnable in CI with no Senti credential — the
 * hermetic property EPIC-4 lists as a cross-cutting invariant.
 */
async function listTools(command, args, cwd, extraEnv = {}) {
  const { Client } = await import('@modelcontextprotocol/client');
  const { StdioClientTransport } = await import('@modelcontextprotocol/client/stdio');

  const transport = new StdioClientTransport({
    command,
    args,
    cwd,
    env: {
      PATH: process.env.PATH ?? '',
      SENTI_API_KEY: 'sq_live_verifypack_placeholder',
      ...extraEnv,
    },
  });
  const client = new Client({ name: 'release-verify-pack', version: '1.0.0' });

  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    return tools.map((t) => t.name).sort();
  } finally {
    await client.close().catch(() => {});
  }
}
