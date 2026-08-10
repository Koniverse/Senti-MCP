---
id: US-4.1
title: "The release contract and docs/RELEASE.md"
epic: EPIC-4
status: backlog
priority: P1
points: 3
sprint:
assignee: bluezdot
created: 2026-08-10
updated: 2026-08-10
---

## Goal

A maintainer about to ship `1.1.0` should be able to open one file and follow it to a
released version without reconstructing the procedure from a decision log. Today that file
does not exist: the release procedure lives as prose across
[CONTEXT D11 and D12](../../CONTEXT.md), and [docs/README.md](../../README.md)'s
pre-commit checklist — the closest thing to it — stops at `VERSION` and `CHANGELOG.md`
with no `git tag`, `gh release` or `npm publish` item in any of its thirteen lines. This
story writes the procedure down and wires it into the surfaces a maintainer already reads.

## Background

This is the first story of [EPIC-4](../epics/EPIC-4.md) and the only one that can deliver
value alone: **US-4.1 by itself makes a correct manual release possible.** That matters
because [sprint-2026-W34](../sprint-2026-W34.md) ships four versions and this epic has no
sprint yet ([EPIC-4](../epics/EPIC-4.md) §Still open) — if the automation lands after those
four, the runbook is what they are cut against.

**The file is `docs/RELEASE.md`, and it is deliberately not `DEPLOY.md`.**
[docs/README.md](../../README.md)'s absent-file table records why `DEPLOY.md` does not
exist — it is a production runbook for a hosted service, and this project has no
infrastructure and nothing to deploy beyond `npm publish` itself. That reasoning is
unchanged. `RELEASE.md` answers a different question for a different reader, and
[CONTEXT D18](../../CONTEXT.md) is the entry that justifies a non-koni-docs filename
appearing in `docs/`.

**This story also retires the `— vX.Y.Z` CHANGELOG heading suffix.** Three of nine release
headings carry it, and they are exactly the three tagged versions — a 9/9 correlation
nothing documents. After [US-4.3](US-4.3-backfill-tags-and-releases.md) every changelogged
version is tagged, so a marker for tagged-ness appears on every heading and distinguishes
nothing ([CONTEXT D19](../../CONTEXT.md)). The three existing headings are **not** rewritten;
the retirement is recorded so the survivors read as history rather than inconsistency.

**What this story does not do is enforce anything.** The checks live in
[US-4.2](US-4.2-release-check-gate.md) and [US-4.4](US-4.4-tarball-verification.md), and
they run in [US-4.5](US-4.5-release-workflow.md). A runbook that is also the enforcement is
what this repo already has, and it lost six tags.

## Acceptance criteria

- [ ] **AC-1** — **Given** a maintainer holding a merged change that earns a version,
  **When** they open `docs/RELEASE.md`, **Then** it carries an ordered, copy-pasteable
  procedure from "decide the version" to "confirm `latest` moved", **And** every command in
  it has been run at least once by the author of this story rather than drafted
  ([LESSONS 2](../../LESSONS.md)).
- [ ] **AC-2** — **Given** `docs/RELEASE.md`, **When** it describes what a release *is*,
  **Then** it states the four-artifact contract explicitly — a `## [X.Y.Z]` CHANGELOG
  section, an annotated `vX.Y.Z` tag, a GitHub Release, and an npm version — and names
  [CONTEXT D15](../../CONTEXT.md) as the reason all four move together for every version.
- [ ] **AC-3** — **Given** `docs/RELEASE.md`, **When** a reader looks for the failure
  modes, **Then** it states that npm forbids republishing a version number forever and
  permits unpublish only within 72 hours, **And** it says what to do when a release goes
  out wrong — cut the next patch, never attempt to reissue the number.
- [ ] **AC-4** — **Given** `docs/RELEASE.md`, **When** a reader looks for the conventions,
  **Then** it records the annotated-tag message form the three existing tags already use
  (`senti-mcp-server vX.Y.Z`, optionally followed by the CHANGELOG headline), and that
  `git tag --sort=v:refname` or `--sort=committerdate` is the correct sort — never
  `--sort=creatordate`, which orders backfilled tags by when they were created
  ([CONTEXT D17](../../CONTEXT.md)).
- [ ] **AC-5** — **Given** [docs/README.md](../../README.md)'s pre-commit checklist,
  **When** this story lands, **Then** it carries a release item pointing at `RELEASE.md`,
  **And** the `docs/` tree in the same file lists `RELEASE.md`, **And** the `DEPLOY.md` row
  in the absent-file table is **not** retracted but gains a pointer stating that the publish
  procedure lives in `RELEASE.md` and `DEPLOY.md` remains absent because there is still no
  service.
- [ ] **AC-6** — **Given** [AGENTS.md](../../../AGENTS.md)'s Quick reference, **When** a
  reader looks up "Ship a version", **Then** the row no longer ends at `VERSION` +
  CHANGELOG but points at `RELEASE.md`, **And** the Documentation list carries
  `RELEASE.md`.
- [ ] **AC-7** — **Given** [docs/README.md](../../README.md) §Conventions, **When** a reader
  encounters a `— vX.Y.Z` suffix on one of the three older CHANGELOG headings, **Then** the
  conventions section explains what it meant, that the correlation with tagged versions was
  9/9, and that new entries do not carry it ([CONTEXT D19](../../CONTEXT.md)), **And** no
  existing CHANGELOG heading has been edited.

## Tasks

- [ ] **TASK-4.1.1** — Write `docs/RELEASE.md` (AC: 1, 2, 3, 4)
  - [ ] §What a release is — the four-artifact contract and [CONTEXT D15](../../CONTEXT.md)
  - [ ] §Procedure — ordered steps: decide the version and record why; bump `VERSION`,
        `package.json` and `src/config.ts` together; write the CHANGELOG section; run the
        gate; annotate and push the tag; confirm the workflow published; confirm `latest`
  - [ ] §Conventions — tag message form, tag sort order, CHANGELOG heading form without the
        retired suffix
  - [ ] §When it goes wrong — the 72-hour window, why the next patch is the only remedy,
        and what a failed gate means at each check
  - [ ] §What is deliberately absent — no `next` dist-tag and the trigger that would bring
        one in ([CONTEXT D20](../../CONTEXT.md)); no `DEPLOY.md`
        ([CONTEXT D18](../../CONTEXT.md))
  - [ ] Run every command in the file against the working tree before the story closes;
        a drafted command is a claim ([LESSONS 2](../../LESSONS.md))
- [ ] **TASK-4.1.2** — Wire `RELEASE.md` into [docs/README.md](../../README.md) (AC: 5, 7)
  - [ ] `docs/` tree gains the `RELEASE.md` line; Cross-references gains its link
  - [ ] Pre-commit checklist gains the release item
  - [ ] `DEPLOY.md` absent-row gains the pointer, with its existing reasoning intact
  - [ ] §Conventions records the retired `— vX.Y.Z` suffix and what it used to mean
- [ ] **TASK-4.1.3** — Update [AGENTS.md](../../../AGENTS.md) (AC: 6)
  - [ ] §Documentation gains `RELEASE.md`. The epics line already names all four — it was
        corrected in the commit that opened this epic
  - [ ] Quick reference "Ship a version" row points at `RELEASE.md`
- [ ] **TASK-4.1.4** — Confirm nothing was rewritten (AC: 7)
  - [ ] `git diff docs/CHANGELOG.md` shows only an `## [Unreleased]` addition — no existing
        heading changed

## Dev notes

### Architecture constraints

- **`docs/RELEASE.md` is not a koni-docs template filename.** Its existence is justified by
  [CONTEXT D18](../../CONTEXT.md) and nothing else; a future reader finding a non-template
  file in `docs/` is owed that link from the file itself.
- **The `DEPLOY.md` absent-row is amended, never retracted.** Its reasoning is still true —
  there is no service — and this story adds a pointer beside it, not a replacement for it.
- **No CHANGELOG heading is edited.** Append-only in the same spirit as RULE-7, and the
  precedent is [CONTEXT D12](../../CONTEXT.md)'s third rejected alternative, which refused
  to reword the `1.0.0` entry for exactly this reason.
- **This story ships no code**, so `VERSION` does not move and the change is recorded under
  `## [Unreleased]` — the same posture [CONTEXT D13](../../CONTEXT.md) took.

### Cross-story dependencies

- **Required by** [US-4.2](US-4.2-release-check-gate.md) — the gate implements the contract
  this story writes down. Building the check first would mean deciding the contract inside
  a script, where it is not reviewable as prose.
- **Required by** [US-4.5](US-4.5-release-workflow.md) — the workflow is the procedure,
  executed. A step in the workflow with no counterpart in `RELEASE.md` is a step nobody
  agreed to.
- **Independent of** [US-4.3](US-4.3-backfill-tags-and-releases.md) — though AC-7's framing
  of the retired suffix reads more naturally once the backfill has landed.

### What we explicitly did NOT do

- **No `DEPLOY.md`.** [CONTEXT D18](../../CONTEXT.md); creating it would make an already
  recorded decision false while changing nothing about the project.
- **No rewrite of the three headings carrying `— vX.Y.Z`.** They are claims about the world
  at a version.
- **No enforcement in this story.** Prose that is also the gate is what this repo already
  had, and it is why `0.2.0` → `0.7.0` are untagged.

### References

- [Source: CONTEXT D15](../../CONTEXT.md) — every version is tagged, released and published
- [Source: CONTEXT D18](../../CONTEXT.md) — why `RELEASE.md` and not `DEPLOY.md`
- [Source: CONTEXT D19](../../CONTEXT.md) — the retired heading suffix
- [Source: CONTEXT D20](../../CONTEXT.md) — no `next` dist-tag, and the trigger to revisit
- [Source: CONTEXT D12](../../CONTEXT.md) — the README-inside-the-tarball failure this runbook exists to prevent
- [Source: LESSONS 2](../../LESSONS.md) — a documented command is a claim until it is run
- [docs/README.md](../../README.md) — the checklist and absent-file table this story amends

## Verification commands

> Drafted before the file exists; every row is run and confirmed non-vacuous before this
> story closes ([LESSONS 2](../../LESSONS.md)).

| AC | Command |
|---|---|
| AC-1, AC-2, AC-3, AC-4 | `test -f docs/RELEASE.md && grep -c '' docs/RELEASE.md` — then walk the file and run each command in it |
| AC-5 | `grep -n 'RELEASE.md' docs/README.md` — expect the tree, the checklist, the `DEPLOY.md` row and Cross-references |
| AC-6 | `grep -n 'RELEASE.md\|EPIC-4' AGENTS.md` |
| AC-7 | `grep -n 'vX.Y.Z\|— v[0-9]' docs/README.md docs/CHANGELOG.md` |
| AC-7 | `git diff --stat docs/CHANGELOG.md` — additions only |

## Changelog entry

### Documentation
- **`docs/RELEASE.md` — the release runbook this repo never had.** The four-artifact
  contract (CHANGELOG section, annotated tag, GitHub Release, npm version), the ordered
  procedure, the tag-message and tag-sort conventions, what a failed gate means, and the
  72-hour unpublish window that makes every check ahead of `npm publish` load-bearing.
  Deliberately not `DEPLOY.md`, whose recorded absence is unchanged
  ([CONTEXT D18](../../CONTEXT.md)).
- [docs/README.md](../../README.md) gains the release checklist item, the `RELEASE.md` tree entry,
  a pointer on the `DEPLOY.md` absent-row, and a §Conventions note retiring the
  `— vX.Y.Z` CHANGELOG heading suffix ([CONTEXT D19](../../CONTEXT.md)) — the three headings
  already carrying it are left unchanged.
- [AGENTS.md](../../../AGENTS.md)'s "Ship a version" row no longer ends at `VERSION` + CHANGELOG,
  and its documentation map gains `RELEASE.md`, [EPIC-3](../epics/EPIC-3.md) and
  [EPIC-4](../epics/EPIC-4.md).

## Implementation notes

<!-- Filled during implementation. -->

## Files modified

<!-- Filled during implementation. -->

## Cross-references

- [Epic EPIC-4](../epics/EPIC-4.md)
- [CONTEXT D15, D18, D19, D20](../../CONTEXT.md)
- [docs/README.md](../../README.md) · [AGENTS.md](../../../AGENTS.md)
- [US-4.2](US-4.2-release-check-gate.md) · [US-4.3](US-4.3-backfill-tags-and-releases.md) · [US-4.5](US-4.5-release-workflow.md)
