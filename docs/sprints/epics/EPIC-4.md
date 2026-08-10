---
id: EPIC-4
title: "The package release process"
status: done
created: 2026-08-10
updated: 2026-08-10
---

## Goal

Make releasing this package something the repository *executes* rather than something a
maintainer remembers. Every version that appears in [CHANGELOG.md](../../CHANGELOG.md)
also exists as a git tag, a GitHub Release, and a package on the npm registry — and the
release path refuses to run when those disagree. Downstream, [EPIC-2](EPIC-2.md)'s four
remaining stories and every story [EPIC-3](EPIC-3.md) eventually opens get to stop
deciding what shipping means; they bump a version, write a CHANGELOG section, and push a
tag.

## Overview

### Business context

Before this epic, the release procedure for `senti-mcp-server` is undocumented. It exists
as prose scattered across [CONTEXT D11 and D12](../../CONTEXT.md) and a handful of story
Implementation notes, and nowhere as a procedure anyone could follow. There is no
`.github/` directory — `gh api repos/Koniverse/Senti-MCP/actions/runs` reports
`total_count: 0`, so no workflow has ever run here and every release so far was typed by
hand. [docs/README.md](../../README.md)'s pre-commit checklist, the closest thing to a
release procedure this repo owns, stops at `VERSION` and `CHANGELOG.md`: it contains no
`git tag`, no `gh release`, and no `npm publish` item anywhere in its thirteen lines.

**What that costs is visible in the record.** As of 2026-08-10 there are four artifact
sets and they do not nest:

| Artifact | Count | Which |
|---|---|---|
| `## [X.Y.Z]` CHANGELOG sections | **9** | `0.1.0` … `0.7.0`, `1.0.0`, `1.0.1` |
| git tags | **3** | `v0.1.0`, `v1.0.0`, `v1.0.1` |
| GitHub Releases | **2** | `v1.0.0`, `v1.0.1` — `v0.1.0` is tagged without one |
| npm versions | **2** | `0.1.0`, `1.0.1`; `latest` → `1.0.1` |

So `0.2.0` → `0.7.0` were bumped and changelogged inside sprint W33 and then never tagged
and never published, and `v0.1.0` is tagged and published with no Release announcing it.
None of that was decided; it is what happens when the procedure is prose. The concrete
damage is that [CHANGELOG.md](../../CHANGELOG.md)'s own header names *"the `## [X.Y.Z]`
anchor plus the git tag"* as the join keys for finding a release's commit, and for six of
nine versions the tag half is missing — while the documented fallback,
`git log --grep '0.6.0'`, returns **eight** commits, because `engines.node` is `>=20.6.0`
([CONTEXT D5](../../CONTEXT.md)) and every document mentioning the Node floor matches.

This epic adds the **release path**, and it is the last piece of governance
[EPIC-1](EPIC-1.md) deliberately left out: EPIC-1 gave the repo a record of what shipped
and why, and this one gives it a mechanism for shipping. It changes no runtime behaviour
and registers no tool. The architectural distinction it preserves is that **the version
number is a human decision and the release is a machine one** — what version a change
earns is argued in a story and recorded in CONTEXT ([D11](../../CONTEXT.md) chose `1.0.0`
where the diff alone earned `0.7.1`), and everything downstream of that decision is
executed rather than judged.

The urgency is [sprint-2026-W34](../sprint-2026-W34.md), which ships US-2.10 → US-2.13 as
`1.1.0`, `1.2.0`, `1.3.0` and `1.4.0` per [CONTEXT D14](../../CONTEXT.md) — four releases
in one week, each irreversible, against a procedure nobody has written down.

### Feature pillars

| # | Pillar | Stories | Purpose |
|---|---|---|---|
| 1 | **The written contract** | [US-4.1](../stories/US-4.1-release-contract-and-runbook.md) | `docs/RELEASE.md`: what a release *is*, the ordered procedure, and the doc-surface changes that make it discoverable from the checklist a maintainer already walks |
| 2 | **Mechanical gates** | [US-4.2](../stories/US-4.2-release-check-gate.md), [US-4.4](../stories/US-4.4-tarball-verification.md) | `release:check` refuses a release whose artifacts disagree; `release:verify-pack` proves the tarball works before the publish that cannot be undone |
| 3 | **Automated execution** | [US-4.5](../stories/US-4.5-release-workflow.md) | `.github/workflows/release.yml` — push a `v*` tag, and gate → build → publish → announce happens without a human in the loop |
| 4 | **Historical reconciliation** | [US-4.3](../stories/US-4.3-backfill-tags-and-releases.md) | Backfill the six missing tags and `v0.1.0`'s Release, so *every changelogged version is tagged* becomes an invariant with no exception the gate has to special-case |

### Out of scope

Each of the following is a decision taken during this epic's brainstorm, not an omission.

- **`DEPLOY.md`** — still absent, still for the reason
  [docs/README.md](../../README.md)'s absent-file table gives: it is a production runbook
  for a hosted service and this project has no service. `docs/RELEASE.md` is a different
  document with a different audience and does not replace it
  ([CONTEXT D18](../../CONTEXT.md)).
- **A `next` dist-tag or any pre-release channel** — `latest` stays the only dist-tag.
  The risk a channel would mitigate is addressed strictly earlier, by verifying the
  tarball before the irreversible publish ([CONTEXT D20](../../CONTEXT.md), which also
  records the trigger that would bring `next` in).
- **A pull-request or test CI workflow** — this epic adds `release.yml` and nothing else.
  The release workflow runs `typecheck`, `test` and `build` before publishing, so tests do
  gate a release; whether *every push* should run CI is a separate decision for a repo that
  has run zero workflows to date.
- **`changesets`, `semantic-release`, or any tool that derives the version from commit
  messages** — rejected on this repo's own evidence: such a tool would have assigned
  `0.7.1` at exactly the point [CONTEXT D11](../../CONTEXT.md) chose `1.0.0`, and `1.1.0`
  where [D14](../../CONTEXT.md) had to reconcile a spec column written before the `1.0.0`
  cut. The version is an argued decision; only its execution is automated.
- **Retroactively publishing `0.2.0` → `0.7.0` to npm** — never. No CHANGELOG entry claims
  they were released, and six permanent registry versions created to tidy a records problem
  is fresh drift bought to settle old drift ([CONTEXT D17](../../CONTEXT.md)).
- **Rewriting any shipped CHANGELOG heading** — including the three carrying the retired
  `— vX.Y.Z` suffix. Append-only in the same spirit as
  [RULE-7](../../CONTEXT.md); [CONTEXT D19](../../CONTEXT.md) is the amendment.
- **`koni-harness`** — still not wired, per [EPIC-1 §Out of scope](EPIC-1.md). The release
  gate is a release gate, not a commit gate, and adopting one does not adopt the other.
- **All MCP server behaviour** — owned by [EPIC-2](EPIC-2.md) and [EPIC-3](EPIC-3.md).
  This epic registers no tool and changes no tool's output.

## Cross-cutting invariants

The constraints every story here upholds. The first is the one the other five exist to
serve:

- **A publish is irreversible.** npm forbids republishing a version number forever and
  permits unpublish only within 72 hours. Every gate in this epic is a response to that
  single sentence, and any proposal that moves a check to *after* the publish has to
  justify itself against it.
- **The version string agrees in five places, not three.** `VERSION`, `package.json`'s
  `version`, and `src/config.ts`'s `SERVER_VERSION` are asserted equal by
  `src/config.test.ts` — koni-docs checks only the first two, and the third is this repo's
  own guard. The fourth is `package-lock.json`, which nothing was watching at all and which
  read `0.1.0` for eight releases ([LESSONS 4](../../LESSONS.md)). The fifth is the **git
  tag being pushed**, which nothing could check: it does not exist when the test suite runs.
  [US-4.2](../stories/US-4.2-release-check-gate.md) is where the fourth is checked.
- **`README.md` is the npm package page.** `npm pack --dry-run` reports 42 files carrying
  `LICENSE`, `README.md`, `package.json`, `dist/` and non-test `src/` — and **no `docs/`
  file at all**, so `docs/CHANGELOG.md` never ships and `README.md` is the only prose a
  reader on the registry ever sees. A release whose README contradicts what it ships is
  [CONTEXT D12](../../CONTEXT.md) repeated, and D12 cost a patch version to avoid.
- **`prepublishOnly` stays hermetic.** `npm test` is 196 passed / 1 skipped with neither
  `SENTI_API_KEY` nor `SENTI_SMOKE_KEY` in the environment — the smoke suite skips cleanly
  and nothing else needs a credential. That property is what makes a CI publish possible at
  all; a release path that needs a live Senti key is one CI cannot run, and adding such a
  dependency breaks this epic rather than extending it.
- **No long-lived publish credential is stored.** The workflow authenticates by OIDC
  trusted publishing and requests `id-token: write` and nothing broader; third-party
  actions are pinned by commit SHA, since the repository currently sets
  `sha_pinning_required: false` and this workflow holds publish rights to a package with a
  single maintainer.
- **Every check fails loudly and before the irreversible step.** A gate that warns, or one
  that runs after `npm publish`, is not a gate. Each check in this epic exits non-zero and
  runs ahead of the act it protects.

## Story index

| US | Title | Pri | Points | Status |
|---|---|---|---|---|
| [US-4.1](../stories/US-4.1-release-contract-and-runbook.md) | The release contract and `docs/RELEASE.md` | P1 | 3 | ✅ done (no version — ships no runtime code) |
| [US-4.2](../stories/US-4.2-release-check-gate.md) | `npm run release:check` — the pre-tag gate | P1 | 3 | ✅ done (no version — ships no runtime code) |
| [US-4.3](../stories/US-4.3-backfill-tags-and-releases.md) | Backfill the six missing tags and `v0.1.0`'s Release | P2 | 2 | ✅ done (no version — reconciles history) |
| [US-4.4](../stories/US-4.4-tarball-verification.md) | Verify the tarball before it is published | P1 | 3 | ✅ done (no version — ships no runtime code) |
| [US-4.5](../stories/US-4.5-release-workflow.md) | `.github/workflows/release.yml` — tag-triggered publish | P1 | 5 | ✅ done (gate proven on a runner) |

**Sixteen points, all delivered** in [sprint-2026-W33](../sprint-2026-W33.md) Phase 2
(2026-08-10). The release path exists, is documented, is gated, and its refusal path is
proven against a real runner; what remains is the first release to travel it.

**Sequencing.** US-4.1 → US-4.2 → US-4.4 → US-4.5 is a real dependency chain: the runbook
decides what a release is, the gate enforces it, the tarball check becomes one of the
workflow's steps, and the workflow runs all three. **US-4.3 depends on nothing** and can
land at any point; it is the only story that touches history rather than the future.

**US-4.1 alone makes a correct manual release possible**, which is the property that
matters if this epic lands after [sprint-2026-W34](../sprint-2026-W34.md) starts. The four
W34 releases can be cut by hand against a written runbook; they cannot be cut correctly
against prose scattered across a decision log.

## Still open

- ~~**Which sprint takes EPIC-4.**~~ **Settled 2026-08-10**:
  [sprint-2026-W33](../sprint-2026-W33.md), which reopened to carry this epic as its
  **Phase 2** — its window (08-10 → 08-16) had not elapsed, and this repo's rule is that a
  sprint's scope is not frozen at open ([CONTEXT D21](../../CONTEXT.md)).
  [sprint-2026-W34](../sprint-2026-W34.md) keeps its committed 11 points untouched, so
  `1.1.0` → `1.4.0` ship under US-4.5's workflow rather than by hand.
- ~~**Whether npm trusted publishing is configurable for this package.**~~ Configured by
  the maintainer 2026-08-10. It is not verifiable from a checkout, so the first
  `npm publish` is what confirms it; [CONTEXT D16](../../CONTEXT.md)'s `NPM_TOKEN` fallback
  stands if it does not.
- **The workflow's success path has never run.** Every rehearsal proves the *refusal* path
  and therefore skips everything after the gate — that is what a gate does. `build`,
  `verify`, `publish` and `announce` are discharged only by a release that passes, which is
  `1.1.0` ([US-2.10](../stories/US-2.10-get-account-performance-tool.md), sprint W34). Six
  ACs on [US-4.5](../stories/US-4.5-release-workflow.md) carry that, and a failure there is
  this epic's defect, not EPIC-2's. *Waiting on*: W34's first release.

## Cross-references

- [CONTEXT D15–D20](../../CONTEXT.md) — the six decisions this epic records: cadence, mechanism, backfill scope, runbook home, the retired heading suffix, and the absent `next` channel
- [CONTEXT D11](../../CONTEXT.md) — the `1.0.0` cut, and the first time an npm publish was deferred as its own decision
- [CONTEXT D12](../../CONTEXT.md) — what a published tarball whose README contradicts the release actually costs; the closest thing to a release post-mortem this repo has
- [docs/CHANGELOG.md](../../CHANGELOG.md) — the nine versions, and the join-key claim this epic makes true
- [docs/README.md](../../README.md) — the pre-commit checklist this epic extends, and the absent-file table `RELEASE.md` has to be reconciled against
- [EPIC-1](EPIC-1.md) — the documentation framework; this epic is the shipping half of the governance it started
- [EPIC-2](EPIC-2.md) — the read path, whose §Out of scope deferred npm publishing to exactly here
- [EPIC-3](EPIC-3.md) — the write path, which inherits this release procedure unchanged
- [sprint-2026-W34](../sprint-2026-W34.md) — the four releases that made settling this urgent
