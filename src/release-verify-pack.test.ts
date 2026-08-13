import { describe, expect, test } from 'vitest';

/**
 * `scripts/release-verify-pack.mjs` builds, packs, installs into a clean
 * directory and drives the installed binary over MCP — 30-60 seconds of real
 * work, which does not belong inside a suite that `prepublishOnly` runs and
 * that finishes in about two seconds. The end-to-end leg is proven by running
 * the script (and by the deliberate break AC-6 records); what is unit-tested
 * here is the judgement it makes once the facts are in hand, which is where a
 * silent-pass bug would actually live.
 *
 * The specifier is computed so TypeScript does not try to resolve a `.mjs`
 * module with no declarations. The script guards its own entry point, so
 * importing it runs nothing.
 */
const mod = (await import(
  new URL('../scripts/release-verify-pack.mjs', import.meta.url).href
)) as {
  auditTarball: (paths: string[]) => string[];
  diffTools: (expected: string[], observed: string[]) => string[];
  readmeTools: (readme: string) => string[];
};

const { auditTarball, diffTools, readmeTools } = mod;

const README_TOOLS = `# senti-mcp-server

Some prose mentioning \`list_accounts\` in passing.

## Tools

| Tool | Input | What it does |
|------|-------|--------------|
| \`list_accounts\` | none | Lists the MT5 accounts. |
| \`list_positions\` | \`accountId\` (the \`id\` from \`list_accounts\`, not \`login\`) | Lists open positions. |

## Requirements

- Node.js >= 22.11.0
`;

const HEALTHY = [
  'package/package.json',
  'package/README.md',
  'package/LICENSE',
  'package/dist/index.js',
  'package/src/server.ts',
];

describe('auditTarball', () => {
  test('passes a tarball carrying README, LICENSE and no test sources', () => {
    expect(auditTarball(HEALTHY)).toEqual([]);
  });

  test('reports a test file that reached the tarball', () => {
    const problems = auditTarball([...HEALTHY, 'package/src/server.test.ts']);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/server\.test\.ts/);
  });

  test('reports a missing README, because it is the npm package page', () => {
    const problems = auditTarball(HEALTHY.filter((p) => !p.endsWith('README.md')));

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/README\.md/);
  });

  test('reports a missing LICENSE', () => {
    const problems = auditTarball(HEALTHY.filter((p) => !p.endsWith('LICENSE')));

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/LICENSE/);
  });

  test('reports every problem at once rather than the first', () => {
    const problems = auditTarball(['package/package.json', 'package/src/config.test.ts']);

    expect(problems).toHaveLength(3);
  });
});

describe('diffTools', () => {
  test('passes when the packaged server exposes exactly what the build does', () => {
    expect(diffTools(['list_accounts', 'list_brokers'], ['list_brokers', 'list_accounts'])).toEqual([]);
  });

  test('reports a tool the tarball lost', () => {
    const problems = diffTools(['list_accounts', 'list_brokers'], ['list_accounts']);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/list_brokers/);
    expect(problems[0]).toMatch(/missing/i);
  });

  test('reports a tool the tarball gained', () => {
    const problems = diffTools(['list_accounts'], ['list_accounts', 'close_all_positions']);

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/close_all_positions/);
    expect(problems[0]).toMatch(/unexpected/i);
  });

  test('an empty observed set is a failure, not a vacuous pass', () => {
    const problems = diffTools(['list_accounts'], []);

    expect(problems.length).toBeGreaterThan(0);
  });
});

/**
 * README.md is the one document inside the tarball and is the npm package
 * page, so its tool table is an independent claim about the release — the only
 * one `diffTools` cannot check, since build and tarball both come from the same
 * source and a tool deleted from `src/server.ts` disappears from both.
 */
describe('readmeTools', () => {
  test('extracts the tool names from the Tools table', () => {
    expect(readmeTools(README_TOOLS)).toEqual(['list_accounts', 'list_positions']);
  });

  test('ignores tool names mentioned in prose outside the table', () => {
    const readme = README_TOOLS.replace('Some prose', 'Prose naming `get_equity_timeseries` and');

    expect(readmeTools(readme)).toEqual(['list_accounts', 'list_positions']);
  });

  test('ignores backticked identifiers inside a row that are not the tool column', () => {
    expect(readmeTools(README_TOOLS)).not.toContain('accountId');
    expect(readmeTools(README_TOOLS)).not.toContain('login');
  });

  test('a README documenting a tool the server does not expose is a mismatch', () => {
    const documented = readmeTools(README_TOOLS);
    const problems = diffTools(documented, ['list_accounts']);

    expect(problems.some((p) => /list_positions/.test(p))).toBe(true);
  });
});
