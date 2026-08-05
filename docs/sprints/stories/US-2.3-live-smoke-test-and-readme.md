---
id: US-2.3
title: "Live smoke test, README, and the v0.1.0 release"
epic: EPIC-2
status: backlog
priority: P2
points: 2
sprint: sprint-2026-W32
assignee: bluezdot
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

- [ ] **AC-1** — **Given** `SENTI_SMOKE_KEY` is present in `.env.local`, **When**
  `npm run test:smoke` runs, **Then** it performs one real `GET /api/v1/accounts` against
  the development API, **And** `parseAccounts` accepts the response, **And**
  `formatAccounts` renders every returned account's `id`.
- [ ] **AC-2** — **Given** no `SENTI_SMOKE_KEY` in the environment, **When** `npm test`
  runs, **Then** the smoke suite reports as **skipped**, not failed, and the rest of the
  suite passes.
- [ ] **AC-3** — The smoke test asserts the *contract*, never the *data*: no assertion
  references a balance, an equity, or an account count, all of which change between runs.
- [ ] **AC-4** — The key never reaches the terminal or the repo. `.env.local` is gitignored
  (it already is), and no step in this story prints it — no `cat .env.local`, no
  `echo $SENTI_SMOKE_KEY`.
- [ ] **AC-5** — `README.md` documents the tool table, the two environment variables with
  their defaults, install and build steps, a copy-pasteable `mcpServers` client config, and
  the development commands.
- [ ] **AC-6** — `README.md` states that `id` is the `accountId` other endpoints take and
  `login` is not — the same correction the tool description carries, for the human reader.
- [ ] **AC-7** — `README.md` states that the server registers read-only tools only, and that
  the write operations are deliberately unexposed pending their own design.
- [ ] **AC-8** — `README.md` explains that the API key is read from the environment and
  never appears in a tool's input schema, with the reason: a tool parameter would live in
  the model's context and from there in transcripts and logs.
- [ ] **AC-9** — An MIT `LICENSE` exists naming the correct holder and year.
- [ ] **AC-10** — **Given** the release commit, **When** it lands, **Then** `VERSION` reads
  `0.1.0` **And** `docs/CHANGELOG.md` carries a `## [0.1.0] — 2026-08-XX … — v0.1.0` entry
  built from the three stories' `Changelog entry` sections — in the **same commit**
  (RULE-1), with no SHA in it (RULE-2).
- [ ] **AC-11** — All four sprint stories read `status: done` with `version_shipped: 0.1.0`
  as bare semver (RULE-16), and every task box is `[x]`.
- [ ] **AC-12** — `npm run agile:status` regenerates `STATUS.md` and
  `npm run agile:validate` exits 0 after the flips.
- [ ] **AC-13** — `npm test && npm run typecheck && npm run build` all pass on the release
  commit.

## Tasks

- [ ] **TASK-2.3.1** — Credentials (AC: 4)
  - [ ] Confirm `.env.local` exists with `SENTI_SMOKE_KEY` and
        `SENTI_API_BASE_URL=https://be-dev.sentitrade.xyz`; create it if absent
  - [ ] Confirm `.gitignore` already covers it — do not print its contents
- [ ] **TASK-2.3.2** — `src/smoke.test.ts` (AC: 1, 2, 3)
  - [ ] `describe.skipIf(!process.env.SENTI_SMOKE_KEY)`, 30s timeout
  - [ ] Add the `test:smoke` script loading `.env.local` via `node --env-file`
- [ ] **TASK-2.3.3** — Run it (AC: 1)
  - [ ] `npm run test:smoke` → 1 passing. A 403 here means the key lacks `accounts:read`;
        the error message from US-2.1 says so and names the scope
  - [ ] `npm test` → smoke suite skipped, everything else green
- [ ] **TASK-2.3.4** — `README.md` and `LICENSE` (AC: 5–9)
- [ ] **TASK-2.3.5** — Release (AC: 10, 11, 12, 13)
  - [ ] `docs/CHANGELOG.md`: replace the `[Unreleased]` body with a `[0.1.0]` entry,
        anchoring the edit on the `[Unreleased]` header so the section above is not eaten
  - [ ] Flip US-1.1, US-2.1, US-2.2, US-2.3 to `done` with `version_shipped: 0.1.0`
  - [ ] Close `sprint-2026-W32`: `status: closed` plus a retrospective
  - [ ] `npm run agile:status && npm run agile:validate`
  - [ ] Full suite, then commit; `git tag v0.1.0`
  - [ ] Backfill the story `commit:` fields in a **follow-up** commit — never `--amend`
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

_Filled during implementation._

## Files modified

_Filled during implementation._

## Cross-references

- [Epic EPIC-2](../epics/EPIC-2.md)
- [sprint-2026-W32](../sprint-2026-W32.md)
- [CHANGELOG](../../CHANGELOG.md)
- [v1 design spec](../../superpowers/specs/2026-08-05-senti-mcp-server-design.md)
