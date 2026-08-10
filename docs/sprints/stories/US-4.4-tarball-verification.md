---
id: US-4.4
title: "Verify the tarball before it is published"
epic: EPIC-4
status: done
priority: P1
points: 3
sprint: sprint-2026-W33
assignee: bluezdot
created: 2026-08-10
updated: 2026-08-10
---

## Goal

Prove that the artifact about to be published actually works, before the act that cannot be
undone. `npm pack` the package, install the resulting tarball into a clean directory, spawn
the installed binary the way a user's MCP host would, and assert `tools/list` returns the
tools the release claims. This is what [CONTEXT D20](../../CONTEXT.md) chose *instead of* a
`next` dist-tag: the same protection, one irreversible act earlier.

## Background

[CONTEXT D20](../../CONTEXT.md) rejected a pre-release channel because a channel's value is
proportional to the number of people who install from it, and this package has no
identifiable pre-release consumer. The risk a `next` tag would mitigate — a broken artifact
reaching users — is real, and this story is the mitigation that was chosen in its place. If
this story never ships, that decision is unbacked, which is why it is P1 rather than a
nice-to-have.

**The gap is specific and evidenced.** `src/index.test.ts` already spawns `dist/index.js`
and asserts both startup legs, so the built entry point is covered. What has never been
covered is the packaging step *between* `dist/` and the registry — and that is exactly
where [CONTEXT D12](../../CONTEXT.md)'s defect lived: `npm pack --dry-run` for the `1.0.0`
tarball listed `dist/client.js`, `dist/accounts.js` and `dist/errors.js`, outputs of sources
deleted in the `0.2.0` restructure. `npm run build` now starts with `rm -rf dist`, which
fixes that specific cause; it does not cover the `files` allowlist being wrong, `bin` not
resolving, `chmod +x` not surviving the pack, or a dependency missing from `dependencies`
that a local `node_modules` was quietly satisfying.

**Installing from a tarball is a genuinely different code path** from running `dist/` in
place, which is why this is a 3 and not a 1. The tarball is extracted elsewhere, `bin` is
resolved through a package manager rather than a relative path, and only `dependencies`
— not `devDependencies` — are available. Every one of those is a way to ship a package that
passes 197 tests and fails on a user's first launch.

**The suite is hermetic and must stay that way.** `npm test` is 196 passed / 1 skipped with
neither `SENTI_API_KEY` nor `SENTI_SMOKE_KEY` set. The spawned server refuses to start
without a key, so this check supplies a syntactically valid dummy key and never makes a
network call — `tools/list` is answered by the server itself.

## Acceptance criteria

- [ ] **AC-1** — **Given** the current working tree, **When** the check runs, **Then** it
  builds, runs `npm pack`, installs the resulting tarball into a **clean** temporary
  directory with no access to this repo's `node_modules`, and spawns the installed binary
  through its `bin` name rather than by a path into `dist/`.
- [ ] **AC-2** — **Given** the spawned server, **When** an MCP client completes
  initialization and calls `tools/list`, **Then** every tool the release claims is present,
  **And** the count is asserted exactly — a check that passes on a subset would not have
  caught the `0.1.0`-tarball-shipped-as-`1.0.0` class of defect.
- [ ] **AC-3** — **Given** the spawned server, **When** it reports its version over the MCP
  handshake, **Then** it equals the version being released — the fourth place the version
  string has to agree, observed from outside the package rather than read out of a file.
- [ ] **AC-4** — **Given** the tarball, **When** its contents are enumerated, **Then** the
  check asserts that no `*.test.ts` file is present and that `README.md` and `LICENSE` are,
  **And** the assertion is on the packed tarball rather than on `npm pack --dry-run` output,
  because the two can differ.
- [ ] **AC-5** — **Given** no `SENTI_API_KEY` in the ambient environment, **When** the check
  runs, **Then** it still passes, using a dummy key it supplies itself, **And** it makes no
  network request — the hermetic property that lets this run in CI is preserved.
- [ ] **AC-6** — **Given** a deliberately broken package — a tool removed from
  `src/server.ts`, or `bin` pointed at a path that does not exist — **When** the check runs,
  **Then** it fails. Demonstrated once during implementation and recorded in
  §Implementation notes, on the principle that a guard whose failure mode is silent needs
  evidence ([CONTEXT D13](../../CONTEXT.md) proved its guard by decoy).
- [ ] **AC-7** — **Given** the check finishes, **When** it exits, **Then** the temporary
  directory and the packed tarball are removed, **And** the repository working tree is
  unchanged — `git status --porcelain` is empty.

## Tasks

- [x] **TASK-4.4.1** — Decide where the check lives and how it is invoked (AC: 1, 5)
  - [x] An npm script — `release:verify-pack` — so `docs/RELEASE.md` and the workflow call
        the same thing
  - [x] Decide whether the client leg reuses `@modelcontextprotocol/client`, already a
        devDependency and already used by `src/index.test.ts`
- [x] **TASK-4.4.2** — Pack and install into a clean directory (AC: 1, 7)
  - [x] `npm pack`, then install the tarball into a fresh temp directory
  - [x] Ensure the temp install cannot resolve this repo's `node_modules`
  - [x] Clean up on both the success and the failure path
- [x] **TASK-4.4.3** — Spawn and interrogate the installed binary (AC: 2, 3, 5)
  - [x] Spawn via the installed `bin` name; supply a dummy `SENTI_API_KEY`
  - [x] Assert the tool set exactly, and the handshake version
  - [x] Assert nothing reaches stdout that is not a JSON-RPC frame — the invariant
        [AGENTS.md](../../../AGENTS.md) states for `index.ts` applies to the packaged
        artifact too
- [x] **TASK-4.4.4** — Assert the tarball's contents (AC: 4)
  - [x] No `*.test.ts`; `README.md` and `LICENSE` present
- [x] **TASK-4.4.5** — Prove it fails when it should (AC: 6)
  - [x] Break the package deliberately, watch the check fail, restore, record the evidence
        in §Implementation notes
- [x] **TASK-4.4.6** — Add the step to `docs/RELEASE.md`'s procedure, ahead of the tag push
  (AC: 1)

## Dev notes

### Architecture constraints

- **This runs before `npm publish`, never after.** The entire argument for it over a `next`
  channel ([CONTEXT D20](../../CONTEXT.md)) is that it precedes the irreversible act. A
  variant that verifies a published artifact is a different decision and needs a new CONTEXT
  entry.
- **No live Senti credential.** The check supplies a dummy key and asserts `tools/list`,
  which the server answers without calling the API. Requiring `SENTI_API_KEY` would break
  the hermetic property [EPIC-4](../epics/EPIC-4.md) lists as a cross-cutting invariant and
  would make the check unrunnable in CI.
- **`vitest.config.ts` scopes collection to `src/**/*.test.ts`** ([CONTEXT D13](../../CONTEXT.md)).
  If this check is written as a vitest file it must live under `src/`; if it is a standalone
  script it must not be collected. Either is fine — silently widening the include list is
  not.
- **Nothing writes to stdout but JSON-RPC frames.** The packaged binary is the artifact users
  actually run, so the invariant is worth asserting there and not only against `dist/`.

### Cross-story dependencies

- **Builds on** [US-4.1](US-4.1-release-contract-and-runbook.md) — the runbook is where this
  step is placed in the ordered procedure.
- **Required by** [US-4.5](US-4.5-release-workflow.md) — the workflow runs this immediately
  before `npm publish`.
- **Reuses the pattern in `src/index.test.ts`**, which already spawns the built entry point
  and drives it with an MCP client. This story changes *what* is spawned, not how.

### What we explicitly did NOT do

- **No `next` dist-tag and no post-publish verification.**
  [CONTEXT D20](../../CONTEXT.md), including the trigger that would revisit it: a second
  consumer who wants a release early, or any version reaching `latest` broken.
- **No live API call.** The smoke suite (`npm run test:smoke`) is the place a live call
  belongs, it is opt-in, and it stays opt-in.
- **No assertion about tool *behaviour*.** This check answers "is this package installable
  and does it expose what it claims", not "are the tools correct" — 197 tests already answer
  the second.

### References

- [Source: CONTEXT D20](../../CONTEXT.md) — verification instead of a `next` channel, and why
- [Source: CONTEXT D12](../../CONTEXT.md) — the dead-`dist/` defect that reached `npm pack --dry-run`
- [Source: CONTEXT D13](../../CONTEXT.md) — proving a guard by decoy; the vitest `include` allowlist
- [src/index.test.ts](../../../src/index.test.ts) — the spawn-and-drive pattern this extends
- [AGENTS.md](../../../AGENTS.md) — the stdout invariant, and the `bin` → `dist/index.js` constraint

## Verification commands

> Drafted before the check exists; every row is run and confirmed non-vacuous before this
> story closes ([LESSONS 2](../../LESSONS.md)).

| AC | Command |
|---|---|
| AC-1, AC-2, AC-3, AC-4 | `npm run release:verify-pack` |
| AC-5 | `env -u SENTI_API_KEY -u SENTI_SMOKE_KEY npm run release:verify-pack` |
| AC-6 | break `src/server.ts`, rerun, expect non-zero, restore |
| AC-7 | `npm run release:verify-pack && git status --porcelain` — expect empty |

## Changelog entry

### Added
- **`npm run release:verify-pack` — the tarball is proven before it is published.** Packs
  the package, installs it into a clean directory with no access to this repo's
  `node_modules`, spawns the installed binary through its `bin` name, and asserts over MCP
  that `tools/list` returns exactly the tools the release claims and that the handshake
  reports the right version. `src/index.test.ts` covers `dist/index.js`; this covers the
  packaging step between `dist/` and the registry — where
  [CONTEXT D12](../../CONTEXT.md)'s dead-`dist/` defect lived. Chosen over a `next` dist-tag
  because it protects the same failure one irreversible act earlier
  ([CONTEXT D20](../../CONTEXT.md)).

## Implementation notes

`scripts/release-verify-pack.mjs` builds, packs, installs the tarball into a clean
directory under the OS temp directory, spawns the installed binary **through its `bin`
name**, and reads `tools/list` over MCP with a dummy key. Confirmed passing: 42 tarball
entries, 6 tools from the build, 6 from the packaged server.

**A gap in the original design, found by testing it.** As first written the check compared
the build's tool set against the tarball's — but both come from the same source, so a tool
deleted from `src/server.ts` disappears from *both* and they still agree. AC-2 says "every
tool the release claims", and the claim that matters is the one a reader on the registry
sees. So a third comparison was added against the **packaged `README.md`'s `## Tools`
table** — the one document inside the tarball, and an independent statement of what the
release contains. `readmeTools()` parses only the first column of a table row, so a name in
prose or an `accountId` in an Input cell is not mistaken for a tool.

**AC-6, the deliberate break, on the record.** `registerListBrokers` was commented out of
`src/server.ts` and the check re-run:

```
packaged server exposes 5: list_account_strategies, list_accounts, list_pending_orders, list_positions, list_strategies
README documents 6: … list_brokers …
release:verify-pack FAILED — 1 problem(s):
  - missing from the packaged server: list_brokers (README tool table vs packaged server)
```

Source restored, `git diff src/server.ts` empty. That failure is the README cross-check
earning its place — the build-vs-tarball comparison alone would have passed.

**Why the end-to-end leg has no unit test.** The script does 30-60 seconds of real work
(build, pack, `npm install`), and `npm test` finishes in about five seconds and runs inside
`prepublishOnly`. The three pure judgements — `auditTarball`, `diffTools`, `readmeTools` —
are unit-tested test-first (13 tests), because that is where a silent-pass bug would live;
the orchestration is proven by running it and by the break above. The workflow runs it as
its own job, so it is not skipped at release time.

The script guards its own entry point, so `src/release-verify-pack.test.ts` can import the
helpers without running the pack. The specifier is computed from a `URL` so TypeScript does
not try to resolve a `.mjs` module with no declarations.

**Hermetic, as required:** the run supplies `SENTI_API_KEY=sq_live_verifypack_placeholder`
itself and makes no network call — `tools/list` is answered by the server.

## Files modified

- `scripts/release-verify-pack.mjs` — new
- `src/release-verify-pack.test.ts` — new, 13 tests over the pure helpers
- `package.json` — `release:verify-pack` script

## Cross-references

- [Epic EPIC-4](../epics/EPIC-4.md)
- [CONTEXT D12, D13, D20](../../CONTEXT.md)
- [US-4.1](US-4.1-release-contract-and-runbook.md) · [US-4.5](US-4.5-release-workflow.md)
