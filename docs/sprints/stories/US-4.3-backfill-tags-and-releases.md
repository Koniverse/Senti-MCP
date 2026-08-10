---
id: US-4.3
title: "Backfill the six missing tags and v0.1.0's GitHub Release"
epic: EPIC-4
status: backlog
priority: P2
points: 2
sprint: sprint-2026-W33
assignee: bluezdot
created: 2026-08-10
updated: 2026-08-10
---

## Goal

Make *every changelogged version has a git tag* true, so it can become an invariant rather
than a rule with six exceptions. Six versions — `0.2.0` through `0.7.0` — were bumped and
changelogged inside sprint W33 and never tagged, and `v0.1.0` is tagged and published with
no GitHub Release announcing it. This story closes both gaps and records what is
deliberately left open.

## Background

[docs/CHANGELOG.md](../../CHANGELOG.md)'s header names the join keys for finding a release's
commit: *"The `## [X.Y.Z]` anchor plus the git tag are the join keys — `git log --grep
'0.1.0'` finds the commit."* For six of nine versions the tag half does not exist, so the
`--grep` fallback is all that is left — and it is least reliable exactly there.
`git log --grep '0.6.0'` returns **eight** commits, because `engines.node` is `>=20.6.0`
([CONTEXT D5](../../CONTEXT.md)) and every document mentioning the Node floor matches; the
real `0.6.0` release commit sits fifth in that list.

**The six commits are already identified**, by walking `VERSION`'s history rather than by
searching messages:

| Version | Commit | Date | Subject |
|---|---|---|---|
| `0.2.0` | `e21be3f` | 2026-08-06 | `feat: restructure into core/ and tools/, add the read-tool substrate` |
| `0.3.0` | `62139f4` | 2026-08-06 | `feat: add the list_brokers tool` |
| `0.4.0` | `fef1f40` | 2026-08-06 | `feat: add the list_strategies tool` |
| `0.5.0` | `548acb3` | 2026-08-06 | `feat: add the list_account_strategies tool` |
| `0.6.0` | `b46b5b5` | 2026-08-07 | `feat: add the list_positions tool` |
| `0.7.0` | `8c879ea` | 2026-08-07 | `feat: add the list_pending_orders tool and close sprint W33` |

Confirming each one against `VERSION` rather than trusting this table is TASK-4.3.1 —
the table is a finding from the brainstorm, not a result this story may assume.

**Tagging an unpublished version claims nothing false.** `v1.0.0` is tagged and deliberately
unpublished in perpetuity ([CONTEXT D12](../../CONTEXT.md)), so tagged-but-unpublished is
already this repository's accepted state. A GitHub Release is different in kind — it is an
announcement — which is why the six get tags and no Releases, and why none of them is ever
published to npm ([CONTEXT D17](../../CONTEXT.md)).

**This story is the only one in [EPIC-4](../epics/EPIC-4.md) that touches history**, and the
only one whose effect is on a shared remote rather than in the working tree. It depends on
nothing and nothing depends on it.

## Acceptance criteria

- [ ] **AC-1** — **Given** the six versions, **When** each commit is identified, **Then** it
  is the commit that *introduced* that value into `VERSION`, verified with
  `git show <sha>:VERSION`, **And** not a commit found by searching messages.
- [ ] **AC-2** — **Given** each of the six, **When** the tag is created, **Then** it is an
  **annotated** tag object matching the form the three existing tags use — subject
  `senti-mcp-server vX.Y.Z`, optionally followed by that version's CHANGELOG headline —
  confirmed by `git for-each-ref --format='%(objecttype)' refs/tags/vX.Y.Z` reporting `tag`
  and not `commit`.
- [ ] **AC-3** — **Given** the backfill is complete, **When** `git tag -l` is compared with
  the `## [X.Y.Z]` headings in [docs/CHANGELOG.md](../../CHANGELOG.md), **Then** the two sets
  are identical — nine and nine, no version in either that is missing from the other.
- [ ] **AC-4** — **Given** `v0.1.0`, **When** the backfill is complete, **Then** it has a
  GitHub Release whose body is its CHANGELOG section, **And** `gh release list` shows three
  releases against three published-or-cut versions.
- [ ] **AC-5** — **Given** the six backfilled versions, **When** the backfill is complete,
  **Then** **no** GitHub Release exists for any of them and **none** is published to npm —
  `npm view senti-mcp-server versions` still returns exactly `0.1.0` and `1.0.1`.
- [ ] **AC-6** — **Given** the tagger date on a backfilled tag is 2026-08-10 while its commit
  is from 2026-08-06 or 2026-08-07, **When** anyone lists tags chronologically, **Then**
  `docs/RELEASE.md` states that `--sort=v:refname` or `--sort=committerdate` is correct and
  `--sort=creatordate` is not, **And** the consequence is recorded rather than discovered.
- [ ] **AC-7** — **Given** the tags are pushed, **When** the remote is inspected, **Then**
  `git ls-remote --tags origin` lists all nine, **And** no branch was created, moved or
  deleted by this story.

## Tasks

- [x] **TASK-4.3.1** — Verify each of the six commits independently (AC: 1)
  - [x] `git show <sha>:VERSION` returns the expected version for all six
  - [x] `git show <sha>:package.json` and `git show <sha>:src/config.ts` agree — if any
        commit predates the three-way lockstep, record it in §Implementation notes rather
        than silently tagging it
- [x] **TASK-4.3.2** — Create the six annotated tags locally (AC: 2)
  - [x] Read the message form off `git for-each-ref refs/tags` before writing new ones
  - [x] Confirm each is an annotated tag object, not a lightweight ref
- [ ] **TASK-4.3.3** — Push the tags and confirm (AC: 3, 7)
  - [ ] Push; then diff `git tag -l` against the CHANGELOG headings and confirm both sets
        are nine
  - [ ] Confirm no branch changed
- [ ] **TASK-4.3.4** — Create `v0.1.0`'s GitHub Release (AC: 4, 5)
  - [ ] Body is the `## [0.1.0]` CHANGELOG section
  - [ ] Confirm `gh release list` shows exactly three, and that none of the six appears
- [x] **TASK-4.3.5** — Confirm the registry is untouched, and record the sort consequence
  (AC: 5, 6)
  - [x] `npm view senti-mcp-server versions` unchanged
  - [x] The tag-sort note lands in `docs/RELEASE.md` — coordinate with
        [US-4.1](US-4.1-release-contract-and-runbook.md) if that file does not exist yet

## Dev notes

### Architecture constraints

- **Annotated, not lightweight.** The three existing tags are annotated tag objects with
  messages; a lightweight ref would be a different kind of artifact wearing the same name.
- **Nothing is published.** The six were never on the registry, no CHANGELOG entry claims
  they were, and putting them there now would be six permanent versions created to tidy a
  records problem ([CONTEXT D17](../../CONTEXT.md)).
- **No CHANGELOG heading is edited**, including the six that lack the `— vX.Y.Z` suffix.
  [CONTEXT D19](../../CONTEXT.md) retires the suffix rather than backfilling it.
- **This story pushes to a shared remote.** Tag pushes are visible to everyone with the
  repository and are the one action here that is awkward to reverse.

### Cross-story dependencies

- **Depends on nothing** and **blocks nothing.** It can land in any sprint, before or after
  the rest of [EPIC-4](../epics/EPIC-4.md).
- **Makes [US-4.2](US-4.2-release-check-gate.md)'s invariant exception-free** — *every
  changelogged version is tagged* holds for all nine afterwards, so nothing downstream has
  to special-case a historical gap.

### What we explicitly did NOT do

- **No GitHub Releases for `0.2.0` → `0.7.0`.** A Release is an announcement, and six
  created on 2026-08-10 would announce versions from 2026-08-06/07 that nobody can install.
- **No npm publish of any backfilled version.** Ever.
- **No amendment of the CHANGELOG header's join-key sentence.** After this story it is
  simply true.

### References

- [Source: CONTEXT D17](../../CONTEXT.md) — the backfill scope, the six commits, and the tagger-date consequence
- [Source: CONTEXT D12](../../CONTEXT.md) — `v1.0.0` tagged and unpublished in perpetuity, the precedent that makes tagging the six safe
- [Source: CONTEXT D5](../../CONTEXT.md) — the `>=20.6.0` Node floor that makes `git log --grep '0.6.0'` return eight commits
- [docs/CHANGELOG.md](../../CHANGELOG.md) — the header whose join-key claim this story makes true

## Verification commands

> Drafted before the work; every row is run and confirmed non-vacuous before this story
> closes ([LESSONS 2](../../LESSONS.md)).

| AC | Command |
|---|---|
| AC-1 | `for s in e21be3f 62139f4 fef1f40 548acb3 b46b5b5 8c879ea; do git show $s:VERSION; done` |
| AC-2 | `git for-each-ref --format='%(refname:short) %(objecttype) %(subject)' refs/tags` |
| AC-3 | `git tag -l \| sort` vs `grep -o '^## \[[0-9][^]]*\]' docs/CHANGELOG.md` |
| AC-4, AC-5 | `gh release list` — expect three, none of them `0.2.0`–`0.7.0` |
| AC-5 | `npm view senti-mcp-server versions` — expect `0.1.0`, `1.0.1` |
| AC-7 | `git ls-remote --tags origin` — expect nine |

## Changelog entry

### Fixed
- **Six released versions had no git tag.** `0.2.0` through `0.7.0` were bumped and
  changelogged during sprint W33 and never tagged, leaving
  [CHANGELOG.md](../../CHANGELOG.md)'s stated join key — the `## [X.Y.Z]` anchor *plus the git
  tag* — resolvable for only three of nine versions, with the documented `git log --grep`
  fallback returning eight commits for `0.6.0` because `engines.node` is `>=20.6.0`
  ([CONTEXT D5](../../CONTEXT.md)). Six annotated tags are backfilled at the commits that
  introduced each version, and `v0.1.0`'s missing GitHub Release is created from its
  CHANGELOG section. The six get tags only: no GitHub Release and no npm publish, now or
  ever ([CONTEXT D17](../../CONTEXT.md)).

## Implementation notes

**Six annotated tags created locally. Nothing pushed, nothing published, no GitHub Release
created** — the push and the `v0.1.0` Release are held for explicit maintainer approval,
which is where this story stops by agreement. `git ls-remote --tags origin` still lists
three; `npm view senti-mcp-server versions` still returns `0.1.0, 1.0.1`.

**AC-1 verified before tagging, and it caught more than the plan asked for.** Each commit
was confirmed with `git show <sha>:VERSION`, and `package.json` and `src/config.ts` were
checked at the same commits: all six carry the version in **all three** places, so none
predates the three-way lockstep. The table in §Background is now a result rather than a
finding.

**The placement convention was verified rather than assumed.** `v1.0.0` → `c1eb6e0` and
`v1.0.1` → `51e0e0b` both point at the commit that *introduced* the version, which is what
AC-1 specifies. (`v0.1.0` → `0ffb7d3` does not — it points at a later commit while `VERSION`
was still `0.1.0`. It is the first release and predates the convention; it is left alone.)

**AC-3 holds exactly:** `git tag -l` and the `## [X.Y.Z]` headings in
[docs/CHANGELOG.md](../../CHANGELOG.md) are now the same nine-element set, `diff` clean. The
invariant *every changelogged version is tagged* has no exception left.

**AC-6's consequence is now measured, not predicted:**

```
--sort=creatordate  v0.1.0 v1.0.0 v1.0.1 v0.2.0 v0.3.0 v0.4.0 v0.5.0 v0.6.0 v0.7.0
--sort=v:refname    v0.1.0 v0.2.0 v0.3.0 v0.4.0 v0.5.0 v0.6.0 v0.7.0 v1.0.0 v1.0.1
```

[docs/RELEASE.md](../../RELEASE.md) §4 carries both lines with the wrong one marked.

**What remains for the maintainer**, in order:

```bash
git push origin v0.2.0 v0.3.0 v0.4.0 v0.5.0 v0.6.0 v0.7.0
gh release create v0.1.0 --title "v0.1.0 — First release" --notes-file <(...)   # §0.1.0 CHANGELOG section
```

## Files modified

No files. Six local tag objects: `v0.2.0` `v0.3.0` `v0.4.0` `v0.5.0` `v0.6.0` `v0.7.0`.

## Cross-references

- [Epic EPIC-4](../epics/EPIC-4.md)
- [CONTEXT D5, D12, D17, D19](../../CONTEXT.md)
- [docs/CHANGELOG.md](../../CHANGELOG.md)
- [US-4.1](US-4.1-release-contract-and-runbook.md) · [US-4.2](US-4.2-release-check-gate.md)
