---
id: US-4.5
title: ".github/workflows/release.yml — tag-triggered publish"
epic: EPIC-4
status: backlog
priority: P1
points: 5
sprint: sprint-2026-W33
assignee: bluezdot
created: 2026-08-10
updated: 2026-08-10
---

## Goal

Push an annotated `vX.Y.Z` tag and have the release happen: gate, build, publish to npm with
provenance, announce on GitHub. No step a maintainer can skip, no credential stored anywhere,
and no possibility of a release whose artifacts disagree — because the workflow refuses to
proceed past its first job.

## Background

This story is [EPIC-4](../epics/EPIC-4.md)'s terminal step and its largest. It is a 5
because it is **this repository's first workflow** — `gh api
repos/Koniverse/Senti-MCP/actions/runs` reports `total_count: 0` — and because its first is
one that holds publish rights to a public package.

**Three facts make it possible now.** The suite is hermetic: `npm test` is 196 passed / 1
skipped with neither `SENTI_API_KEY` nor `SENTI_SMOKE_KEY` in the environment, so CI needs no
Senti credential and `prepublishOnly` (`typecheck && test && build`) runs unmodified. The
repository is public with Actions enabled (`allowed_actions: all`), which is what makes
`--provenance` available. And npm is actively restricting tokens that bypass 2FA for direct
publishing — it prints the warning on every authenticated command — which is what makes OIDC
trusted publishing the right authentication rather than merely the fashionable one.

**One dependency cannot be verified from a checkout**: whether trusted publishing is
configured for this package on npmjs.com. It is a one-time setup bound to this repository
and this workflow's filename. It is a task, not a blocker —
`npm view senti-mcp-server maintainers` returns `bluezdot`, this story's assignee and the
package's sole maintainer, so nobody else is in the loop.
[CONTEXT D16](../../CONTEXT.md) names the fallback in advance: a repository `NPM_TOKEN`
secret with `--provenance` dropped. Choosing the fallback is TASK-4.5.1's outcome, not an
improvisation at release time.

**The workflow is the runbook, executed.** Any step here without a counterpart in
`docs/RELEASE.md` is a step nobody agreed to, which is why
[US-4.1](US-4.1-release-contract-and-runbook.md) comes first.

## Acceptance criteria

- [ ] **AC-1** — **Given** a pushed annotated tag matching `v*`, **When** the workflow
  triggers, **Then** its first job is `npm run release:check` for the version the tag names,
  **And** a failing gate fails the workflow before anything is built and before anything is
  published.
- [ ] **AC-2** — **Given** the gate passes, **When** the build job runs, **Then** it runs
  `npm run typecheck`, `npm test` and `npm run build` with **no** Senti credential in the
  environment, **And** the run is green — the hermetic property asserted, not assumed.
- [ ] **AC-3** — **Given** the build passes, **When** the artifact is verified, **Then**
  `npm run release:verify-pack` ([US-4.4](US-4.4-tarball-verification.md)) runs and passes
  **before** `npm publish` is reached.
- [ ] **AC-4** — **Given** every prior step passed, **When** the publish step runs, **Then**
  it authenticates by OIDC trusted publishing with no `NPM_TOKEN` stored in the repository,
  **And** it publishes with `--provenance`, **And** the job requests `id-token: write` and no
  broader permission than each job needs.
- [ ] **AC-5** — **Given** trusted publishing turns out not to be configurable for this
  package, **When** TASK-4.5.1 determines that, **Then** the workflow uses a repository
  `NPM_TOKEN` secret and drops `--provenance`, **And** a CONTEXT entry revising
  [D16](../../CONTEXT.md) records it — the fallback is taken on the record or not at all.
- [ ] **AC-6** — **Given** the publish succeeded, **When** the announce step runs, **Then**
  it creates a GitHub Release for the tag whose body is that version's CHANGELOG section,
  **And** a release is never announced for a publish that did not happen.
- [ ] **AC-7** — **Given** the workflow file, **When** it is reviewed, **Then** every
  third-party action is pinned to a commit SHA, not a tag or a branch — the repository
  currently sets `sha_pinning_required: false`, so the pinning is this story's discipline
  rather than the platform's.
- [ ] **AC-8** — **Given** the workflow, **When** it is exercised before a real release,
  **Then** its gate, build and verify jobs have been proven to run and to **fail** on a
  deliberately bad input, **And** the evidence is recorded in §Implementation notes. A
  release workflow whose failure path first runs during a real release has never been tested.
- [ ] **AC-9** — **Given** the workflow has published a version, **When** the release is
  confirmed, **Then** `npm view senti-mcp-server dist-tags` shows `latest` at that version,
  **And** `docs/RELEASE.md`'s procedure ends at that confirmation rather than at the tag
  push.

## Tasks

- [x] **TASK-4.5.1** — Settle authentication before writing the workflow (AC: 4, 5)
  - [x] Determine whether npm trusted publishing can be configured for `senti-mcp-server`,
        bound to `Koniverse/Senti-MCP` and this workflow's filename
  - [x] If yes: configure it, and note the exact binding in `docs/RELEASE.md`
  - [x] If no: take the `NPM_TOKEN` fallback and write the CONTEXT entry revising D16 in the
        same commit
- [x] **TASK-4.5.2** — Write `.github/workflows/release.yml` (AC: 1, 2, 3, 4, 6, 7)
  - [x] Trigger `on: push: tags: ['v*']`
  - [x] Job 1 gate → job 2 typecheck/test/build → job 3 verify-pack → job 4 publish →
        job 5 announce, each depending on the previous
  - [x] Derive the version from the tag ref; pass it to `release:check`
  - [x] Pin every third-party action by commit SHA; grant `id-token: write` only where needed
  - [x] Extract the CHANGELOG section for the release body
- [ ] **TASK-4.5.3** — Prove it fails (AC: 8)
  - [ ] Exercise the gate job against a version whose artifacts disagree and confirm the
        workflow stops before publishing
  - [ ] Record what was run and what happened in §Implementation notes
- [x] **TASK-4.5.4** — Reconcile with the runbook (AC: 9)
  - [x] Every workflow step has a counterpart in `docs/RELEASE.md`
  - [x] The runbook's procedure ends at confirming `latest` moved, not at the tag push
  - [x] The runbook says what to do when the workflow fails *after* a successful publish —
        the publish stands, and only the announce step is re-run
- [x] **TASK-4.5.5** — Update [AGENTS.md](../../../AGENTS.md) and
  [docs/README.md](../../README.md) for the repo's first `.github/` directory (AC: 7)
  - [x] The repo-structure block in AGENTS.md gains `.github/workflows/`

## Dev notes

### Architecture constraints

- **The gate runs first, always.** A workflow that builds before it checks wastes minutes;
  one that publishes before it checks cannot be undone. Ordering is the design here.
- **No long-lived publish credential.** OIDC by default; the `NPM_TOKEN` fallback is taken on
  the record via a CONTEXT revision, never silently.
- **`prepublishOnly` is not bypassed.** `npm publish` runs it, so `typecheck && test &&
  build` execute again at publish time even though the workflow ran them; that redundancy is
  cheap and is what protects a publish invoked any other way.
- **Actions pinned by SHA.** This workflow can publish to the registry; a mutable tag on a
  third-party action is a write path into that.
- **No Senti credential in CI, ever.** If a future check needs one, that check does not
  belong in this workflow ([EPIC-4](../epics/EPIC-4.md) §Cross-cutting invariants).

### Cross-story dependencies

- **Builds on** [US-4.1](US-4.1-release-contract-and-runbook.md) — the procedure this
  automates.
- **Builds on** [US-4.2](US-4.2-release-check-gate.md) — job 1 is that script. Without it
  this workflow would embed the contract in YAML, where it is not reviewable as prose or
  runnable locally.
- **Builds on** [US-4.4](US-4.4-tarball-verification.md) — job 3 is that script, and its
  placement before the publish step is the whole of [CONTEXT D20](../../CONTEXT.md).
- **Independent of** [US-4.3](US-4.3-backfill-tags-and-releases.md).

### What we explicitly did NOT do

- **No pull-request or push CI workflow.** This epic adds `release.yml` only; whether every
  push should run CI is a separate decision for a repo that has run zero workflows
  ([EPIC-4](../epics/EPIC-4.md) §Out of scope).
- **No automated version bumping.** The tag is pushed by a human who decided the version in a
  story. A tool deriving it from commit messages would have chosen `0.7.1` exactly where
  [CONTEXT D11](../../CONTEXT.md) chose `1.0.0`.
- **No publish on merge to `main`.** The trigger is a tag, deliberately: merging is not
  releasing, and W33 merged six times without releasing anything.
- **No `next` dist-tag and no post-publish promotion step** ([CONTEXT D20](../../CONTEXT.md)).

### References

- [Source: CONTEXT D16](../../CONTEXT.md) — the workflow's shape, OIDC, `--provenance`, and the `NPM_TOKEN` fallback
- [Source: CONTEXT D15](../../CONTEXT.md) — why this runs four times in a sprint rather than once
- [Source: CONTEXT D20](../../CONTEXT.md) — why verification sits before the publish step and no `next` tag exists
- [Source: CONTEXT D12](../../CONTEXT.md) — the manual release this workflow replaces, and what it nearly shipped
- [package.json](../../../package.json) — `prepublishOnly`, `build`, and the `files` allowlist the tarball comes from

## Verification commands

> Drafted before the workflow exists; every row is run and confirmed non-vacuous before this
> story closes ([LESSONS 2](../../LESSONS.md)).

| AC | Command |
|---|---|
| AC-1, AC-2, AC-3 | `gh run list --workflow release.yml` after a rehearsal tag; then `gh run view <id>` |
| AC-2 | `gh run view <id> --log` — confirm no Senti variable is referenced |
| AC-4 | `npm view senti-mcp-server@<version> --json` — confirm the provenance attestation |
| AC-6 | `gh release view v<version>` |
| AC-7 | `grep -nE 'uses:.*@' .github/workflows/release.yml` — every ref is a 40-char SHA |
| AC-8 | the deliberate-failure run, linked from §Implementation notes |
| AC-9 | `npm view senti-mcp-server dist-tags` |

## Changelog entry

### Added
- **`.github/workflows/release.yml` — this repository's first workflow, and releases stop
  being typed by hand.** Pushing an annotated `vX.Y.Z` tag runs `release:check` first and
  fails the workflow before anything is built if the tag, `VERSION`, `package.json`,
  `SERVER_VERSION` and the CHANGELOG disagree; then `typecheck`/`test`/`build` with no Senti
  credential in the environment; then `release:verify-pack` against the real tarball; then
  `npm publish --provenance` authenticated by OIDC trusted publishing, with no `NPM_TOKEN`
  stored anywhere; then a GitHub Release carrying that version's CHANGELOG section. Every
  third-party action is pinned by commit SHA ([CONTEXT D16](../../CONTEXT.md)).

## Implementation notes

`.github/workflows/release.yml` — this repository's first workflow. Five jobs, chained:
**gate → build → verify → publish → announce**, triggered on a `v*` tag push.

**Two things the workflow forced back into other stories.**

- **`release:check --ci`.** A tag-triggered checkout is a detached HEAD at a tag that
  already exists, so the gate's "tag is free" and "branch is main" checks would fail every
  CI release. Rather than weaken them, the flag skips exactly those two, **prints that it
  did and why**, and keeps every artifact check. The workflow asserts stronger equivalents
  in their place: `git cat-file -t` proves the tag is annotated, and
  `git merge-base --is-ancestor` proves it is on `main`. Both run before `npm ci`.
- **No `environment:` on the publish job.** An environment name enters the OIDC claim and
  npm's trusted-publisher configuration must match it exactly; setting one here without
  setting it there fails the publish with an error that reads like a bad credential. The
  job carries a comment saying so, and [docs/RELEASE.md](../../RELEASE.md) §5 repeats it.

**Verified locally, without a run:** every `uses:` is pinned to a 40-character commit SHA
(`actions/checkout` `fbc6f39…`, `actions/setup-node` `a0853c2…`, both resolved through
`gh api` and confirmed to be commit objects, not tag objects); `permissions` is
`contents: read` at the top level with `id-token: write` only on publish and
`contents: write` only on announce; and the `awk` that extracts the release body was run
against the real [CHANGELOG](../../CHANGELOG.md) — it returns the 38-line `## [1.0.1]`
section, and returns nothing for a version that has no section, which is what the job's
`[ ! -s release-notes.md ]` branch turns into an error.

**AC-8 is NOT discharged, and AC-4, AC-5 and AC-9 cannot be yet.** No workflow run exists
(`gh api …/actions/runs` still reports `total_count: 0`), because triggering one means
pushing a tag and publishing a version — both outside what this session was authorised to
do. This story therefore closes as `review`, not `done`. What remains, in order:

1. **TASK-4.5.1's registry side** — configure npm trusted publishing for
   `senti-mcp-server`, bound to `Koniverse/Senti-MCP` and workflow filename `release.yml`,
   **with no environment**. If it turns out not to be configurable, take the `NPM_TOKEN`
   fallback [CONTEXT D16](../../CONTEXT.md) already names and write the revising CONTEXT
   entry in the same commit (AC-5).
2. **AC-8's rehearsal** — prove the gate job fails before publishing, against a tag whose
   artifacts disagree, and record the run here.
3. Then `1.1.0` becomes the first release this workflow actually performs.

## Files modified

- `.github/workflows/release.yml` — new; the repo's first `.github/` content

## Cross-references

- [Epic EPIC-4](../epics/EPIC-4.md)
- [CONTEXT D11, D12, D15, D16, D20](../../CONTEXT.md)
- [US-4.1](US-4.1-release-contract-and-runbook.md) · [US-4.2](US-4.2-release-check-gate.md) · [US-4.4](US-4.4-tarball-verification.md)
