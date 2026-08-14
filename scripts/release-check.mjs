#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const rootFlag = args.indexOf('--root');
const root = rootFlag === -1 ? process.cwd() : path.resolve(args[rootFlag + 1]);

/**
 * `--root`'s value is the only flag argument to skip, and only when the flag is
 * actually present. Comparing against `rootFlag + 1` unconditionally drops
 * index 0 when `rootFlag` is -1 — which silently discarded the version argument
 * in exactly the invocation the workflow uses (`… <version> --ci`, no `--root`),
 * leaving the gate to check `VERSION` against itself and pass by construction.
 * Every test passed `--root`, so nothing caught it. See LESSONS 5.
 */
const rootValueIndex = rootFlag === -1 ? -1 : rootFlag + 1;
const positional = args.filter((a, i) => !a.startsWith('--') && i !== rootValueIndex);

const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

const versionFile = read('VERSION').trim();
const target = positional[0] ?? versionFile;

const failures = [];
const pass = (label, observed) => console.log(`  ok    ${label} — ${observed}`);
const fail = (label, message) => {
  failures.push(message);
  console.log(`  FAIL  ${label} — ${message}`);
};
const skip = (label, why) => console.log(`  skip  ${label} — ${why}`);

console.log(`release:check — ${target}`);

const pkgVersion = JSON.parse(read('package.json')).version;
const serverVersion = read('src/config.ts').match(/SERVER_VERSION\s*=\s*'([^']+)'/)?.[1];

/**
 * `package-lock.json` is the *fifth* place the version lives, and it is the one
 * nothing was watching: it read 0.1.0 from the 0.2.0 release until 2026-08-10
 * while package.json read 1.0.1, because `npm version` was never the tool used
 * to bump. It is informational rather than load-bearing at install time, which
 * is exactly why it drifts silently.
 */
const lockVersion = JSON.parse(read('package-lock.json')).version;

for (const [label, observed] of [
  ['VERSION', versionFile],
  ['package.json', pkgVersion],
  ['package-lock.json', lockVersion],
  ['src/config.ts SERVER_VERSION', serverVersion],
]) {
  if (observed === target) pass(label, observed);
  else fail(label, `expected ${target}, found ${observed ?? '(not found)'}`);
}

const changelog = read('docs/CHANGELOG.md');

if (changelog.includes(`## [${target}]`)) pass('CHANGELOG section', `## [${target}]`);
else fail('CHANGELOG section', `no "## [${target}]" heading in docs/CHANGELOG.md`);

/**
 * "Clear" is defined mechanically so the failure message can state it: the
 * `## [Unreleased]` section may hold prose, but no `###` subsection and no
 * list item. Either one means content that belongs in a release section — or
 * work that should not be in the tree at release time.
 */
const unreleased = changelog.split(/^## \[Unreleased\]/m)[1]?.split(/^## \[/m)[0] ?? '';
const residue = unreleased
  .split('\n')
  .filter((line) => /^###\s/.test(line) || /^\s*[-*]\s/.test(line));

if (residue.length === 0) pass('Unreleased is clear', 'prose only');
else
  fail(
    'Unreleased is clear',
    `${residue.length} line(s) under "## [Unreleased]" are a "###" subsection or a list item — ` +
      `move what belongs to ${target} into its section. First: ${residue[0].trim()}`,
  );

/**
 * The README check is deliberately narrow, and its limit is part of its
 * contract: it catches a *contradictory* version claim, never an inaccurate
 * description. It flags two shapes only — a `senti-mcp-server@X.Y.Z` pin
 * naming another version, and a line that both mentions a version and claims
 * currency ("latest", "as of this release"). A sentence about a past version
 * ("only list_accounts is reachable on 0.1.0") stays true across releases and
 * is not flagged; neither is the Node floor, which is a different package's
 * version entirely. See CONTEXT D12 for why this check exists at all.
 */
const CURRENCY = /latest|as of this release|this release|current(ly)? release/i;
const SEMVER = /\b\d+\.\d+\.\d+\b/g;

const readmeOffenders = read('README.md')
  .split('\n')
  .map((line, i) => ({ line, n: i + 1 }))
  .filter(({ line }) => {
    const pins = [...line.matchAll(/senti-mcp-server@(\d+\.\d+\.\d+)/g)].map((m) => m[1]);
    if (pins.some((v) => v !== target)) return true;
    if (!CURRENCY.test(line)) return false;
    return (line.match(SEMVER) ?? []).some((v) => v !== target);
  });

if (readmeOffenders.length === 0) pass('README version claims', `none contradict ${target}`);
else
  fail(
    'README version claims',
    `README.md is inside the tarball and is the npm package page. ` +
      `${readmeOffenders.length} line(s) name a version other than ${target}. ` +
      `First, line ${readmeOffenders[0].n}: ${readmeOffenders[0].line.trim()}`,
  );

/**
 * The Node floor is stated in three artifacts and, before US-5.2, was compared
 * by nothing — the LESSONS 4 shape that let `package-lock.json` sit eight
 * releases behind its version string. `package.json` `engines.node` is the
 * canonical value and the other two are copies of it, because `engines.node` is
 * the only one of the three that a tool other than a human ever reads.
 *
 * What counts as a floor claim is deliberately narrow, and the narrowness is
 * the contract: a semver immediately preceded by a floor operator (`>=` or the
 * unicode `≥`), on a line that mentions Node. Both halves earn their place.
 *
 *   - **The operator** is what separates the floor from every other Node
 *     version in the same prose. `AbortSignal.any` is always written "landed in
 *     20.3.0" or "older than 20.3.0", never ">= 20.3.0"; the floor is always
 *     written with the operator. Keying on "a Node-shaped version number"
 *     instead would make SETUP.md's prerequisites row permanently disagree with
 *     itself, since that one cell names 22.11.0, 20.3.0 and 20.6.0 together.
 *   - **The Node mention** keeps a different package's floor from being read as
 *     this one's. `publish` needs npm >= 11.5.1 (LESSONS 7); if that sentence
 *     ever reaches README or SETUP it is not a Node floor.
 *
 * The cost of that contract is that prose *about* a past floor must not use the
 * operator form — write "the old 20.6.0 floor", not "the old `>= 20.6.0`
 * floor". That is a real constraint on two sentences in README.md and it is
 * cheaper than a matcher that tries to tell history from policy.
 *
 * Not checked here, on purpose: `node-version:` in `.github/workflows/*`. Those
 * pins bind nobody outside CI and `publish` differs from the floor deliberately
 * — demanding agreement would encode the exact conflation LESSONS 7 is about.
 */
const FLOOR_CLAIM = /(?:≥|>=)\s*v?(\d+\.\d+\.\d+)/g;

const engineRange = JSON.parse(read('package.json')).engines?.node;
const floor = engineRange?.match(/\d+\.\d+\.\d+/)?.[0];

if (!floor) {
  fail(
    'Node floor',
    `package.json has no engines.node to compare against — it is the canonical floor ` +
      `and README.md / docs/SETUP.md are copies of it. Found: ${engineRange ?? '(no engines.node)'}`,
  );
} else {
  const floorProblems = [];

  for (const rel of ['README.md', 'docs/SETUP.md']) {
    const claims = [];
    read(rel)
      .split('\n')
      .forEach((line, i) => {
        if (!/node/i.test(line)) return;
        for (const m of line.matchAll(FLOOR_CLAIM)) claims.push({ n: i + 1, found: m[1], line });
      });

    /**
     * A file that states no floor at all is a failure, not a silent pass. A
     * pattern that matches nothing reports success otherwise, which is the
     * same failure mode as a `vitest -t` filter that selects zero tests and
     * still exits 0 (LESSONS 2).
     */
    if (claims.length === 0) {
      floorProblems.push(
        `${rel} states no Node floor at all — expected ${floor}. A file that quietly stopped claiming the floor is how the floor drifts.`,
      );
      continue;
    }

    for (const c of claims) {
      if (c.found !== floor) {
        floorProblems.push(`${rel}:${c.n} states ${c.found}, expected ${floor} — ${c.line.trim()}`);
      }
    }
  }

  if (floorProblems.length === 0) {
    pass('Node floor', `${floor} in package.json, README.md and docs/SETUP.md`);
  } else {
    fail(
      'Node floor',
      `package.json engines.node is "${engineRange}". ${floorProblems.length} artifact problem(s) — ` +
        `the floor must move in every file or none. First: ${floorProblems[0]}`,
    );
  }
}

const git = (...a) => {
  const r = spawnSync('git', ['-C', root, ...a], { encoding: 'utf8' });
  return { ok: r.status === 0, out: (r.stdout ?? '').trim() };
};

const tag = `v${target}`;

/**
 * `--ci` is for the tag-triggered workflow, which checks out a detached HEAD at
 * a tag that already exists — it is what started the run. Those two are
 * local-only preconditions and the workflow asserts stronger equivalents
 * itself: that the tag is annotated, and that it is an ancestor of
 * origin/main. Every artifact check still runs, and the skips are printed
 * rather than applied silently.
 */
const ci = args.includes('--ci');

if (ci) {
  skip('tag is free', 'the tag triggered this run; the workflow asserts it is annotated instead');
} else if (git('rev-parse', '-q', '--verify', `refs/tags/${tag}`).ok) {
  fail('tag is free', `${tag} already exists locally — this version was already released, and npm never accepts a version number twice. Pick the next one.`);
} else if (git('ls-remote', '--exit-code', '--tags', 'origin', tag).ok) {
  fail('tag is free', `${tag} already exists on origin — this version was already released. Pick the next one.`);
} else {
  pass('tag is free', `${tag} does not exist`);
}

const status = git('status', '--porcelain');
if (status.out === '') pass('working tree', 'clean');
else fail('working tree', `not clean — a tag is a claim about a commit, so commit or stash first. ${status.out.split('\n').length} path(s) pending.`);

const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
if (ci) skip('branch', 'detached HEAD at the tag; the workflow asserts the tag is an ancestor of origin/main instead');
else if (branch.out === 'main') pass('branch', 'main');
else fail('branch', `HEAD is on "${branch.out}", not main — release from the reviewed commit.`);

if (failures.length > 0) {
  console.error(`\nrelease:check FAILED — ${failures.length} problem(s). Not safe to tag.`);
  process.exit(1);
}
console.log('\nrelease:check passed.');
