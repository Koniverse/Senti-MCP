---
id: US-2.15
title: "Retire the development API host"
epic: EPIC-2
status: done
priority: P2
points: 2
sprint: sprint-2026-W38
assignee: bluezdot
depends_on: [US-2.14]
created: 2026-09-15
updated: 2026-09-15
---

## Goal

Stop pointing anyone — a developer following the setup docs, a test run, a model reading the
README — at an API host that is no longer in use, and close the question
[US-2.14](US-2.14-api-keys-dashboard-host.md) left open about what the default base URL pairs
with.

## Background

On 2026-09-15 the maintainer stated that the development API host this repo had used since
`0.1.0` is no longer in use; [CONTEXT D48](../../CONTEXT.md) names it. It was still wired in
four places:

| Where | How |
|---|---|
| `src/smoke.test.ts:55`, `:332` | The default `SENTI_API_BASE_URL` for both live suites |
| Ten unit-test files | The placeholder base URL behind the stubbed `fetch` |
| `AGENTS.md`, `README.md`, `docs/SETUP.md` | The value suggested for development, and the "verified pairing" caveat |
| `src/core/client.ts:121`, `src/tools/performance/summary.test.ts:11` | Comments naming where a measurement was taken |

The caveat is [US-2.14](US-2.14-api-keys-dashboard-host.md)'s. The Senti frontends were built
against the development host while `DEFAULT_BASE_URL` is `api.sentitrade.xyz`, so whether a
dashboard-issued key works against the default was recorded as unverified
([CONTEXT D45](../../CONTEXT.md)) — one authenticated call from settled, carried as an open
item for four sprints.

**Decided with the maintainer on 2026-09-15** ([CONTEXT D48](../../CONTEXT.md)):

- Remove what is **in use**; leave the **records** — the CHANGELOG entries of released
  versions, closed stories, sprints and epics, the specs and plans, and CONTEXT D1–D47, which
  RULE-7 does not allow to be edited. Each says where a measurement was taken.
- The smoke suite defaults to **production**. With `SENTI_SMOKE_WRITES=1` it writes there —
  still opt-in twice, and now said so wherever the flag is documented.

## Acceptance criteria

- [x] **AC-1** — **Given** `src/`, **When** it is searched for Senti hosts, **Then** only
  `api.sentitrade.xyz` and `app.sentitrade.xyz` appear: the smoke suite takes the config
  default, and the unit tests use `https://api.example.test`.
- [x] **AC-2** — `AGENTS.md`, `README.md`, `docs/SETUP.md` and `.env.example` suggest no
  development host; `SENTI_API_BASE_URL` is described as an override for another deployment of
  the API.
- [x] **AC-3** — **Given** a doc that describes `SENTI_SMOKE_WRITES` — `.env.example`,
  `docs/SETUP.md`, `AGENTS.md` — **When** it is read, **Then** it says the write smoke writes to
  production unless `SENTI_API_BASE_URL` says otherwise.
- [x] **AC-4** — **Given** a dashboard-issued key, **When** it reads
  `https://api.sentitrade.xyz/api/v1/accounts`, **Then** the API answers `200` — recorded in
  §Implementation notes — **And** the pairing caveat in `README.md` and `docs/SETUP.md` is
  replaced by the verified pairing.
- [x] **AC-5** — `docs/CONTEXT.md` gains D48, revising D45; D45 itself is not edited.
- [x] **AC-6** — The open planning docs — EPIC-9, US-9.1, US-9.3 and sprint-2026-W38 — name
  only `api.sentitrade.xyz`.
- [x] **AC-7** — Every file that still names the retired host is a record of the kind D48
  decision 4 lists.
- [x] **AC-8** — `npm run typecheck` and `npm test` pass.

## Tasks

- [x] **TASK-2.15.1** — Settle D45 with one authenticated read (AC: 4)
- [x] **TASK-2.15.2** — Code and tests (AC: 1)
  - [x] `src/smoke.test.ts`: both suites pass `process.env.SENTI_API_BASE_URL` through, so
        `loadConfig`'s default applies
  - [x] Ten unit-test files: the placeholder becomes `https://api.example.test`
  - [x] `src/core/client.ts:121`, `src/tools/performance/summary.test.ts:11`: the host leaves
        the comment; the date stays
- [x] **TASK-2.15.3** — Operational docs (AC: 2, 3, 4)
  - [x] `SENTI_API_BASE_URL` rows in `AGENTS.md`, `README.md`, `docs/SETUP.md`; the
        `.env.local` example in `docs/SETUP.md`; a comment on it in `.env.example`
  - [x] `SENTI_SMOKE_WRITES` in `.env.example`, `docs/SETUP.md`, `AGENTS.md` says production
  - [x] The pairing caveat in `README.md` and `docs/SETUP.md` → the verified pairing
- [x] **TASK-2.15.4** — Open planning docs (AC: 6)
  - [x] EPIC-9 (the 2026-09-14 record, the re-check, the deploy check), US-9.1, US-9.3,
        sprint-2026-W38 §Open work
- [x] **TASK-2.15.5** — Record (AC: 5, 7)
  - [x] CONTEXT D48 under a new Phase 17; `docs/CHANGELOG.md` `## [Unreleased]`
  - [x] [US-2.14](US-2.14-api-keys-dashboard-host.md) §Remaining work points here;
        [EPIC-2](../epics/EPIC-2.md) story index; the sprint-2026-W38 row
- [x] **TASK-2.15.6** — Verify (AC: 8)
  - [x] `npm run typecheck && npm test`

## Dev notes

### Architecture constraints

- **`loadConfig` owns the default.** The smoke suite passes the variable through rather than
  naming a host, so the repo holds one default, in `src/config.ts`.
- **`api.example.test` must not be the default.** `config.test.ts`'s `honours
  SENTI_API_BASE_URL` is only a test if the value differs from `DEFAULT_BASE_URL`. A `.test`
  name is reserved and never resolves, so a stub that leaks cannot reach anything.

### What we explicitly did NOT do

- **No rewrite of records** ([CONTEXT D48](../../CONTEXT.md) decision 4).
- **No change to `DEFAULT_BASE_URL`.** It was verified, not changed.
- **No run of the write smoke.** This story made production its default target; running it is
  [EPIC-8](../epics/EPIC-8.md)'s open gap, and it deserves a deliberate run of its own.

### References

- [Source: CONTEXT D45](../../CONTEXT.md) — the question this closes
- [Source: CONTEXT D48](../../CONTEXT.md) — the decision
- [Source: US-2.14](US-2.14-api-keys-dashboard-host.md) §Remaining work

## Verification commands

| AC | Command |
|---|---|
| AC-1 | `git grep -n "sentitrade\.xyz" -- src \| grep -v "api\.sentitrade\.xyz\|app\.sentitrade\.xyz"` prints nothing |
| AC-3 | `grep -n "SENTI_SMOKE_WRITES" .env.example docs/SETUP.md AGENTS.md` — each description says production |
| AC-5 | `npm run agile:validate` |
| AC-8 | `npm run typecheck && npm test` |

## Changelog entry

### Changed
- `npm run test:smoke` targets production, `https://api.sentitrade.xyz`, unless
  `SENTI_API_BASE_URL` is set. With `SENTI_SMOKE_WRITES=1` it now creates and deletes a real
  draft **on production**.
- The README and `docs/SETUP.md` no longer suggest a development value for
  `SENTI_API_BASE_URL`, and the unverified-pairing caveat is gone: a dashboard-issued key is
  verified against the default base URL.

## Implementation notes

**The D45 call**, 2026-09-15T03:07:54Z, read-only, with the smoke key:
`GET https://api.sentitrade.xyz/api/v1/accounts` → **`200`**, 4 accounts, 1,968 B. No account
data was recorded. The same key had read `GET /api/v1/drafts` on the same host earlier that day
([EPIC-9](../epics/EPIC-9.md) §Re-checked — 2026-09-15).

**The first attempt at the unit-test replacement changed nothing**, silently: the shell is
`zsh`, which does not word-split an unquoted `$files`, so `sed` received the whole newline-joined
list as one filename and the `&&` chain behind it never ran. Re-run through `xargs`, then
checked by a `git grep` that returned nothing.

**Verified** on 2026-09-15: `npm run typecheck` exits 0, and `npm test` reports 31 test files
passed and 1 skipped (the opt-in smoke suite), 673 tests passed and 2 skipped.

## Files modified

**Modified (code and tests):**
- `src/smoke.test.ts` — both suites take the config default
- `src/config.test.ts`, `src/core/client.test.ts`, `src/server.test.ts`, and seven files under
  `src/tools/authoring/` — the placeholder base URL
- `src/core/client.ts`, `src/tools/performance/summary.test.ts` — comments only

**Modified (docs):**
- `AGENTS.md`, `README.md`, `docs/SETUP.md`, `.env.example`
- `docs/CONTEXT.md` (D48), `docs/CHANGELOG.md` (`[Unreleased]`)
- `docs/sprints/epics/EPIC-2.md`, `docs/sprints/epics/EPIC-9.md`,
  `docs/sprints/stories/US-2.14-api-keys-dashboard-host.md`,
  `docs/sprints/stories/US-9.1-list-drafts-summary-mode.md`,
  `docs/sprints/stories/US-9.3-get-draft-compile-log-tool.md`,
  `docs/sprints/sprint-2026-W38.md`, `docs/sprints/STATUS.md`

## Cross-references

- [EPIC-2](../epics/EPIC-2.md) · [US-2.14](US-2.14-api-keys-dashboard-host.md) ·
  [CONTEXT D45, D48](../../CONTEXT.md) · [sprint-2026-W38](../sprint-2026-W38.md)
