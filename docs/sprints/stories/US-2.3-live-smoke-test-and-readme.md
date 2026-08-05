---
id: US-2.3
title: "Live smoke test, README, and the v0.1.0 release"
epic: EPIC-2
status: done
version_shipped: 0.1.0
priority: P2
points: 2
sprint: sprint-2026-W32
assignee: bluezdot
commit: 11cd128
created: 2026-08-05
updated: 2026-08-05
---

## Goal

Prove the server works against the actual Senti API rather than against a stub, and give
a user everything they need to install it. Then ship v0.1.0.

## Background

Every other test in the suite injects a fake `fetch`. That is the right default — it is
fast, deterministic, and runs in CI without credentials — but it means the suite as a whole
demonstrates that the code is internally consistent, not that it works. A base URL typo, a
header the API rejects, a field renamed upstream, a scope the key does not carry: none of
those can fail a stubbed test.

One real call closes that gap. It is gated on a key in a gitignored `.env.local`, so it
skips rather than fails when the key is absent — a CI run and a fresh clone stay green
while the person with credentials gets the signal.

This story also carries the release, which is mechanical but load-bearing: RULE-1 requires
`VERSION` and the `[0.1.0]` CHANGELOG entry in the same commit, and all four stories flip
to `done` with `version_shipped` set.

## Acceptance criteria

- [x] **AC-1** — **Given** `SENTI_SMOKE_KEY` is present in `.env.local`, **When**
  `npm run test:smoke` runs, **Then** it performs one real `GET /api/v1/accounts` against
  the development API, **And** `parseAccounts` accepts the response, **And**
  `formatAccounts` renders every returned account's `id`.
- [x] **AC-2** — **Given** no `SENTI_SMOKE_KEY` in the environment, **When** `npm test`
  runs, **Then** the smoke suite reports as **skipped**, not failed, and the rest of the
  suite passes.
- [x] **AC-3** — The smoke test asserts the *contract*, never the *data*: no assertion
  references a balance, an equity, or an account count, all of which change between runs.
- [x] **AC-4** — The key never reaches the terminal or the repo. `.env.local` is gitignored
  (it already is), and no step in this story prints it — no `cat .env.local`, no
  `echo $SENTI_SMOKE_KEY`.
- [x] **AC-5** — `README.md` documents the tool table, the two environment variables with
  their defaults, install and build steps, a copy-pasteable `mcpServers` client config, and
  the development commands.
- [x] **AC-6** — `README.md` states that `id` is the `accountId` other endpoints take and
  `login` is not — the same correction the tool description carries, for the human reader.
- [x] **AC-7** — `README.md` states that the server registers read-only tools only, and that
  the write operations are deliberately unexposed pending their own design.
- [x] **AC-8** — `README.md` explains that the API key is read from the environment and
  never appears in a tool's input schema, with the reason: a tool parameter would live in
  the model's context and from there in transcripts and logs.
- [x] **AC-9** — An MIT `LICENSE` exists naming the correct holder and year.
- [x] **AC-10** — **Given** the release commit, **When** it lands, **Then** `VERSION` reads
  `0.1.0` **And** `docs/CHANGELOG.md` carries a `## [0.1.0] — 2026-08-XX … — v0.1.0` entry
  built from the three stories' `Changelog entry` sections — in the **same commit**
  (RULE-1), with no SHA in it (RULE-2).
- [x] **AC-11** — All four sprint stories read `status: done` with `version_shipped: 0.1.0`
  as bare semver (RULE-16), and every task box is `[x]`.
- [x] **AC-12** — `npm run agile:status` regenerates `STATUS.md` and
  `npm run agile:validate` exits 0 after the flips.
- [x] **AC-13** — `npm test && npm run typecheck && npm run build` all pass on the release
  commit.

## Tasks

- [x] **TASK-2.3.1** — Credentials (AC: 4)
  - [x] Confirm `.env.local` exists with `SENTI_SMOKE_KEY` and
        `SENTI_API_BASE_URL=https://be-dev.sentitrade.xyz`; create it if absent
  - [x] Confirm `.gitignore` already covers it — do not print its contents
- [x] **TASK-2.3.2** — `src/smoke.test.ts` (AC: 1, 2, 3)
  - [x] `describe.skipIf(!process.env.SENTI_SMOKE_KEY)`, 30s timeout
  - [x] Add the `test:smoke` script loading `.env.local` via `node --env-file`
- [x] **TASK-2.3.3** — Run it (AC: 1)
  - [x] `npm run test:smoke` → 1 passing. A 403 here means the key lacks `accounts:read`;
        the error message from US-2.1 says so and names the scope
  - [x] `npm test` → smoke suite skipped, everything else green
- [x] **TASK-2.3.4** — `README.md` and `LICENSE` (AC: 5–9)
- [x] **TASK-2.3.5** — Release (AC: 10, 11, 12, 13)
  - [x] `docs/CHANGELOG.md`: replace the `[Unreleased]` body with a `[0.1.0]` entry,
        anchoring the edit on the `[Unreleased]` header so the section above is not eaten
  - [x] Flip US-1.1, US-2.1, US-2.2, US-2.3 to `done` with `version_shipped: 0.1.0`
  - [x] Close `sprint-2026-W32`: `status: closed` plus a retrospective
  - [x] `npm run agile:status && npm run agile:validate`
  - [x] Full suite, then commit; `git tag v0.1.0`
  - [x] Backfill the story `commit:` fields in a **follow-up** commit — never `--amend`
        (RULE-2)

## Dev notes

### Architecture constraints

- The smoke test calls `createClient` directly rather than going through the MCP layer. It
  is verifying that the *API contract* holds; the MCP wiring is already covered by
  `server.test.ts` and adding a transport here would only widen the failure surface.
- It targets the **development** host (`https://be-dev.sentitrade.xyz`), not production.
  Keys are environment-bound, so a wrong host returns 401 immediately rather than quietly
  serving the wrong data.

### Cross-story dependencies

- **Builds on** [US-2.1](US-2.1-authenticated-senti-api-client.md) — calls `createClient`
  and `loadConfig`.
- **Builds on** [US-2.2](US-2.2-list-accounts-tool.md) — calls `parseAccounts` and
  `formatAccounts`, and documents the tool it registers.
- **Depends on an external party**: a Senti Quant API key carrying `accounts:read`. The
  story can start without it — the test skips — but cannot close.

### What we explicitly did NOT do

- **Not published to npm.** v0.1.0 runs from a local build. Trigger to revisit: enough
  tools to justify a package.
- **No CI wiring for the smoke test.** It needs a live credential; a secret in CI for one
  test is a larger decision than this story. Trigger: a second live test, or a release
  process that must not ship without one.
- **No assertions on returned data.** Balances change. A test that asserts a balance is a
  test that fails for the wrong reason.

### References

- [Source: design spec §Testing](../../superpowers/specs/2026-08-05-senti-mcp-server-design.md) — why one real test earns its place
- [Source: design spec §Packaging](../../superpowers/specs/2026-08-05-senti-mcp-server-design.md) — client configuration and the no-publish decision
- [Source: v1 implementation plan, Task 6](../../superpowers/plans/2026-08-05-senti-mcp-server-v1.md)
- [Source: CHANGELOG safe-insertion rule](../../../.agents/skills/koni-docs/references/templates/changelog.md) — anchor on `[Unreleased]`, never on the previous version header
- [Senti API Keys dashboard](https://stage.sentitrade.xyz/account/api-keys) — where a scoped key comes from

## Verification commands

| AC | Command |
|---|---|
| AC-1 | `npm run test:smoke` → 1 passing |
| AC-2 | `npm test` → smoke suite skipped, all others pass |
| AC-3 | `grep -nE 'lastKnownBalance\|lastKnownEquity\|toHaveLength' src/smoke.test.ts` → no assertions on values |
| AC-4 | `git check-ignore -v .env.local` → matched; `git log -p -- .env.local` → empty |
| AC-5–AC-8 | `grep -n 'accountId\|read-only\|SENTI_API_KEY\|mcpServers' README.md` |
| AC-9 | `head -3 LICENSE` → MIT, correct holder and year |
| AC-10 | `cat VERSION` → `0.1.0`; `grep -n '^## \[0.1.0\]' docs/CHANGELOG.md` → 1 hit; `grep -in 'commit' docs/CHANGELOG.md` → no SHA |
| AC-11 | `grep -L 'status: done' docs/sprints/stories/*.md` → no output; `grep -c '\- \[ \]' docs/sprints/stories/*.md` → 0 each |
| AC-12 | `npm run agile:status && npm run agile:validate` |
| AC-13 | `npm test && npm run typecheck && npm run build` |

AC-1 is the one that justifies the story. Everything else in the suite could pass against
an API that does not exist.

## Changelog entry

### Added
- `src/smoke.test.ts` — one opt-in live call against the development API, skipped when no
  key is present.
- `README.md` — tools, configuration, install, client config, and the read-only posture.
- MIT `LICENSE`.

## Implementation notes

`npm run test:smoke` ran against `https://be-dev.sentitrade.xyz` with the key already
present in the gitignored `.env.local` (TASK-2.3.1 needed no changes, only
confirmation). It passed on the first run: one real `GET /api/v1/accounts`, one account
returned, `parseAccounts` accepted the payload, and `formatAccounts` rendered its `id`.
No 403 — the key already carries `accounts:read`, so the scope-naming branch in
`client.ts`'s 403 mapping (US-2.1 AC-8) went unexercised by this run, as expected for a
correctly scoped key. `npm test` afterward reported the smoke suite as 1 skipped and the
other 51 tests green, confirming AC-2 without a key in `process.env`.

`LICENSE` was copied from the sibling `read-mcp-server` repo rather than fetched over
the network, since it was already MIT with the correct holder (`bluezdot`) and year
(`2026`) — no edit needed, just verification before copying.

The CHANGELOG edit merged four stories' `Changelog entry` sections into one `[0.1.0]`
entry, per the note in this story's own task list that nothing has shipped yet: the
`[Unreleased]` section's koni-docs description moved into `[0.1.0]` alongside US-2.1,
US-2.2, and this story's own entries, and `[Unreleased]` was reset to the standard
"not yet shipped" placeholder. The edit was anchored on the `## [Unreleased]` header
text, not on any version header, so the section above it could not be silently
overwritten.

### Fix wave, folded into v0.1.0 (post-review)

A whole-branch review ran after the tag was cut. The human partner's ruling was to
fold its findings into v0.1.0 and move the local tag, which had never been pushed,
rather than cut a 0.1.1. `VERSION` stays `0.1.0`; the `[0.1.0]` CHANGELOG entry was
rewritten to describe what the tag now actually contains.

Two findings landed on this story's own deliverables. **RULE-11 was broken**: the
branch introduced three environment variables and created neither `docs/SETUP.md` nor
`.env.example`, which `docs/README.md` had predicted in those exact words — both now
exist, and the absent-file table records only `DEPLOY.md` as still missing, with its
trigger. **`README.md` under-specified the runtime**: `engines.node: ">=20"` is wrong
for code that calls `AbortSignal.any()` (20.3.0) and a `test:smoke` script that uses
`node --env-file` (20.6.0), so the floor is now 20.6.0 in `package.json`, `README.md`
and `docs/SETUP.md` alike.

The API Keys dashboard URL was reviewed and **deliberately left pointing at
`stage.sentitrade.xyz`** — that is where keys are issued today. What was missing was
the warning that the default base URL is production, so a key from one environment
401s against another; `README.md`, `docs/SETUP.md` and the 401 message itself now all
say so.

The `### Changed` bullet in the `[0.1.0]` entry described an edit to the internal v1
plan rather than anything about the shipped product, and was dropped — that change is
already recorded in [CONTEXT D1](../../CONTEXT.md) and in
[US-1.1](US-1.1-adopt-koni-docs-framework.md)'s own changelog section.

One documentation-only correction rode along with this release commit: US-2.2's AC-20
said "`src/server.ts` is the only file importing from `@modelcontextprotocol/*`", which
undercounted by two files by design — `src/index.ts` imports the `/stdio` subpath
(TASK-2.2.3) and `src/server.test.ts` imports `@modelcontextprotocol/client` as its test
client (the plan's own test code). `grep -rln '@modelcontextprotocol' src/` returns
exactly those three files (`src/index.ts`, `src/server.ts`, `src/server.test.ts`) and no
others; AC-20's text and verification row in US-2.2 now describe that, with the
underlying invariant (no other file touches the SDK) unchanged.

## Files modified

**Created:**
- `src/smoke.test.ts` (33 lines) — the opt-in live test
- `README.md` (81 lines)
- `LICENSE` (21 lines) — MIT, copyright (c) 2026 bluezdot

**Modified (fix wave, folded into v0.1.0):**
- `README.md` — Node floor raised to 20.6.0 with its reason; the key/environment
  match warning; a pointer to `docs/SETUP.md`
- `docs/SETUP.md` — created: setup walkthrough, env var reference, troubleshooting
- `.env.example` — created: all three variables with placeholders (RULE-11)
- `docs/README.md` — `SETUP.md` and `.env.example` no longer listed as absent
- `docs/CONTEXT.md` — D5 (Node floor), D6 (base-URL validation)
- `package.json` — `engines.node >= 20.6.0`; `typecheck` runs both tsconfigs
- `tsconfig.test.json` — created

**Modified (this release commit):**
- `docs/CHANGELOG.md` — `[0.1.0]` entry added, anchored on `[Unreleased]`
- `docs/sprints/stories/US-1.1-…`, `US-2.1-…`, `US-2.2-…`, `US-2.3-…` — flipped to
  `status: done`, `version_shipped: 0.1.0`
- `docs/sprints/sprint-2026-W32.md` — `status: closed`, scope table, retrospective
- `docs/sprints/epics/EPIC-1.md`, `EPIC-2.md` — status and story tables
- `docs/sprints/STATUS.md` — regenerated
- `CLAUDE.md` — Active Context block refreshed

## Cross-references

- [Epic EPIC-2](../epics/EPIC-2.md)
- [sprint-2026-W32](../sprint-2026-W32.md)
- [CHANGELOG](../../CHANGELOG.md)
- [v1 design spec](../../superpowers/specs/2026-08-05-senti-mcp-server-design.md)
