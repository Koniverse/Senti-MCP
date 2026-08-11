# Changelog

All notable changes to **senti-mcp-server** are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Every code-shipping commit bumps [`VERSION`](../VERSION) and adds an entry here in
the **same commit** (RULE-1). Entries carry no commit SHA: a commit cannot contain
its own SHA, and `--amend`-ing one in orphans it (RULE-2). The `## [X.Y.Z]` anchor
plus the git tag are the join keys — `git log --grep '0.1.0'` finds the commit.

---

## [Unreleased]

Nothing pending.

## [1.2.0] — 2026-08-11 — `list_deals`: the first paginated tool, and a refusal to drain

The eighth tool, and the first whose answer does not fit in one response. Positions and
pending orders say what is open right now; nothing said what already closed.
`GET /accounts/{accountId}/deals` does, and it is paginated — which is the axis
[US-2.11](sprints/stories/US-2.11-list-deals-tool.md) exists to open.

The policy for that axis is a refusal. One tool call issues **exactly one** HTTP request,
whatever `nextCursor` holds. A tool that quietly follows cursors until exhaustion turns
one question into an unbounded number of requests against a rate-limited API and spends
the user's context on data nobody asked for. The cursor goes to the model as data; the
model decides whether the next page is worth asking for.

### Added
- **`list_deals` — one page of an account's closed deal history**
  (`src/tools/trading/deals.ts`). `DealSchema`, `parseDeals`, `formatDeals`. Symbol,
  direction, entry kind, volume, price, realized profit, costs, the linked position and
  order, and the placing expert advisor. `limit` (default **50**, maximum 500), `cursor`,
  `entry`, `from` and `to` all reach the URL through `client.get`'s `query`.
  - **No automatic drain, and no `maxPages` parameter that would smuggle one in.** The
    tool is a single `client.get` with no loop, asserted by counting calls to a stubbed
    `fetch` against a page that always answers with a cursor — output inspection would
    only show which page won, not how many were read.
  - **The cursor is quoted in the text, not only in `structuredContent`.** Many clients
    surface `content` alone, and a cursor the model cannot see is a page it cannot ask
    for. The more-available and last-page cases are written to read differently without
    opening the structured channel at all.
  - **`limit` is sent explicitly on every call**, including when the caller omits it. The
    API's own default is 100, stated in no response and free to change; 50 is this
    server's, stated in the tool description and enforced by the input schema.
  - **The `entry` case asymmetry is caught before the request exists.** The query
    parameter takes lowercase `in`/`out`; the response field is uppercase
    `IN`/`OUT`/`INOUT`/`OUT_BY`. A model feeding one back as the other would get a 400
    about a query parameter — the input schema rejects it instead, and the description
    says which case goes where.
  - **A page total is labelled a page total.** The header states realized P&L across the
    rows shown and says outright that it is not the account's, pointing at
    `get_account_performance` for that — the same defect class `list_positions` guards
    against when it totals the full list rather than the surviving slice.
  - **`syncedThrough` is carried through rather than dropped.** This endpoint reads a
    warehouse, not the MT5 terminal, so a deal closed after that instant is not in the
    answer yet. That is the difference between "you have no trades today" and "today has
    not been ingested yet".
  - **No `409` branch**, unlike `list_positions` and `list_pending_orders`. The live
    OpenAPI document declares none here — an offline terminal costs this endpoint
    freshness, not availability. Copying US-2.8's call shape would have added a branch
    the API never takes.

### Notes
- **The `capPositions`/`capOrders` generalization stays deferred, and this closes the
  question rather than moving it.** The
  [W33 retrospective](sprints/sprint-2026-W33.md) parked it here on the condition that
  `list_deals` needed a third truncation helper. It does not: `limit` is a bound the
  caller chose and the input schema enforces, not a server-side cut, so this tool ships
  with no such helper and no `notes` field at all — the one deliberate exception to the
  uniformity `tools/performance/` keeps. Two copies remain two copies. The trigger to
  revisit is now a third tool that truncates a response the caller did not bound; EPIC-3's
  write-path read-backs are the next plausible source.

## [1.1.0] — 2026-08-10 — `get_account_performance`: the first tool with query parameters

The seventh tool, and the one that opens EPIC-2's last axis: query parameters. `from`,
`to` and `reporting` reach the URL through `client.get`'s `query` option, which has
existed since `0.2.0` and which no tool had ever passed — the substrate was built and
untried, the same shape `accountPath` had at [US-2.7](sprints/stories/US-2.7-list-account-strategies-tool.md).
`performance:read` becomes the fifth of five scopes exercised by a shipped tool.

This is also the tag that first carries EPIC-4's release tooling. Those entries sat under
`## [Unreleased]` because none of them reaches the tarball — `files` allowlists `dist` and
non-test `src`, so the two scripts in `scripts/` and the workflow in `.github/` are
outside it (`npm pack --dry-run`: 42 files before this release, **45** after — `summary.ts`
plus its two compiled artifacts in `dist/`). They move here because a tag is what makes
them shipped, and `1.1.0` is that tag — this release runs the tag-triggered workflow for
the first time on a version that is not a rehearsal.

### Added
- **`get_account_performance` — a fixed-size performance summary for one account**
  (`src/tools/performance/summary.ts`, the first file in `src/tools/performance/`).
  `PerformanceSchema`, `parsePerformance`, `formatPerformance`. Net P&L, win rate, profit
  factor, gross profit and loss, deal counts, costs, cash flow, period ROI and IRR,
  lifetime IRR, and the live terminal block. The response does not grow with the requested
  window, so it is returned in full and `notes` is always empty.
  - **The first tool to send query parameters.** `from`, `to` and `reporting` are handed
    to `client.get`'s `query` whole; `queryStringOf` drops the undefined ones, so an
    omitted parameter is absent from the URL rather than sent as `from=undefined` or
    `from=`. No tool-side string building.
  - **`reporting` is an ISO-4217 currency code, not a reporting period** — the name reads
    like a period and the story was written expecting a closed enum of them. The live
    OpenAPI document declares `type: string`, "ISO-4217 currency the money metrics are
    normalized to. Default `USD`". Validated by shape (`/^[A-Z]{3}$/`) rather than against
    a list this server would have invented ([CONTEXT D23](CONTEXT.md)).
  - **An unreachable terminal is stated, never rendered as zeroes.** Unlike `positions`
    and `orders` this endpoint declares no `409`: an offline terminal arrives as
    `live: null` inside a `200`, so the *null is not zero* invariant moves out of a
    status-code branch and into the formatter. A null `live` block reports that the
    terminal could not be reached and says outright that this is not an empty account.
  - **The window is stated in the text**, including when the caller supplied none. The
    response echoes no window back, so a model that asked a vague question would otherwise
    attribute the figures to whatever period it had in mind; an empty window renders as
    "the API's default window — the 30 days ending today".
  - **The API's own caveats are carried through.** `notionalIncomplete`,
    `staleBalanceAccounts` and `unconvertedAccounts` are statements about the figures
    beside them, and are rendered as caveats rather than dropped. They are not `notes`:
    `notes` records what this server cut, and this tool cuts nothing.
- **`npm run release:check` — the gate a release has to pass** (`scripts/release-check.mjs`).
  Eight checks, all reported in one run with the value each observed: the five version
  strings agree (`VERSION`, `package.json`, `package-lock.json`, `src/config.ts`'s
  `SERVER_VERSION`, and the tag about to be pushed — `src/config.test.ts` covers three of
  them on every commit, the lock file was covered by nothing, and the tag cannot exist when
  vitest runs); [CHANGELOG.md](CHANGELOG.md) has a `## [X.Y.Z]`
  section; `## [Unreleased]` no longer carries it; `README.md` — the only prose in the
  42-file tarball — names no contradicting version; the tag is free; the tree is clean; and
  `HEAD` is on `main`. A `--ci` flag skips the two local-only preconditions a tag-triggered
  checkout cannot satisfy, prints that it skipped them, and keeps every artifact check
  ([CONTEXT D16](CONTEXT.md)).
- **`npm run release:verify-pack` — the tarball is proven before it is published**
  (`scripts/release-verify-pack.mjs`). Packs, installs into a clean directory with no access
  to this repo's `node_modules`, spawns the installed binary through its `bin` name, and
  compares `tools/list` against both the build **and the packaged README's tool table** —
  the independent claim, since build and tarball share a source and a deleted tool vanishes
  from both. `src/index.test.ts` covers `dist/index.js`; this covers the packaging step
  between `dist/` and the registry, where [CONTEXT D12](CONTEXT.md)'s dead-`dist/` defect
  lived. Adopted instead of a `next` dist-tag, because it protects the same failure one
  irreversible act earlier ([CONTEXT D20](CONTEXT.md)).
- **`.github/workflows/release.yml` — this repository's first workflow, with its refusal
  path proven on a real runner.** Pushing an
  annotated `vX.Y.Z` tag runs gate → build → verify → publish → announce. The gate fails the
  workflow before anything is built; the build runs with no Senti credential in the
  environment; `npm publish --provenance` authenticates by OIDC trusted publishing with no
  `NPM_TOKEN` stored anywhere; and a GitHub Release carrying that version's CHANGELOG
  section is created only after a successful publish. Every third-party action is pinned to
  a 40-character commit SHA ([CONTEXT D16](CONTEXT.md)). Rehearsed against a deliberately
  bad `v9.9.9`: the gate reached `release:check`, reported all seven disagreements, and
  `build`, `verify`, **`publish`** and `announce` were skipped. The success path is
  discharged by the first real release — `1.1.0` — and six ACs on
  [US-4.5](sprints/stories/US-4.5-release-workflow.md) carry that handoff.
- **[docs/RELEASE.md](RELEASE.md)** — the runbook this repo never had: the four-artifact
  contract, the ordered procedure, the tag-message and tag-sort conventions, what each gate
  failure means, and the 72-hour unpublish window that puts every check ahead of
  `npm publish`. Deliberately **not** `DEPLOY.md`, whose recorded absence is unchanged and
  now carries a pointer here ([CONTEXT D18](CONTEXT.md)).
- **Six annotated git tags backfilled for `0.2.0` → `0.7.0`, and `v0.1.0`'s missing GitHub
  Release created.** `git tag -l` and the `## [X.Y.Z]` headings are now the same nine-element
  set, so *every changelogged version is tagged* has no exception left; Releases go 2 → 3.
  The six get tags only — no Release, and never an npm publish, which stays at `0.1.0` and
  `1.0.1` ([CONTEXT D17](CONTEXT.md)). Pushing six `v*` tags triggered no workflow run:
  Actions reads the workflow from the tagged commit, and all six predate `.github/`.

### Changed
- **[README.md](../README.md)**: a `get_account_performance` row on the tool table, "all
  seven tools" and the `1.1.0` pin in the install section, and the scope list now says all
  five read scopes are exercised by a shipped tool — `performance:read` was the one that
  was not.
- **`src/smoke.test.ts` walks a seventh leg**, and deliberately without the
  terminal-offline `try`/`catch` the positions and orders legs carry: `performance`
  declares no `409`, so a throw there is a real failure rather than a state of the world.
  It requests an explicit `2026-07-01 → 2026-07-31` window, because an omitted one would
  exercise the API's default and prove nothing about the query option this release wires
  up.
- [docs/README.md](README.md): `RELEASE.md` in the tree and cross-references, a release item
  on the pre-commit checklist, a pointer on the `DEPLOY.md` absent-row with its reasoning
  intact, and a §Conventions note retiring the `— vX.Y.Z` CHANGELOG heading suffix — which
  correlated 9/9 with tagged versions and was documented nowhere ([CONTEXT D19](CONTEXT.md)).
  The three headings carrying it are left exactly as shipped.
- [AGENTS.md](../AGENTS.md): `docs/RELEASE.md` in the documentation map, and the "Ship a
  version" quick-reference row no longer ends at `VERSION` + CHANGELOG.
- **[EPIC-4](sprints/epics/EPIC-4.md) closed** — all five stories done, 16 points, in
  `sprint-2026-W33` Phase 2.
- **`sprint-2026-W33` reopened** (`closed` → `active`) to carry EPIC-4 as its **Phase 2**;
  its window had not elapsed. Phase 1's scope table, its "6 stories / 15 points" total and
  its retrospective are left byte-for-byte as written, each scoped to Phase 1. New
  [CONTEXT D21](CONTEXT.md) makes the general rule: a sprint's scope is not frozen at open,
  and only the maintainer opens or closes one.
- The suite is **17 files / 277 tests, 1 skipped** (was 14 / 197): 22 tests drive
  `release:check` as a CLI against throwaway git repositories, 13 cover the pure judgements
  inside `release:verify-pack`, and 45 cover `get_account_performance` — 34 on the domain
  module, 11 through a connected MCP client.

### Fixed
- **The `publish` job could never have published, on any npm version.** It pinned
  `node-version: 20.6.0` — the floor [CONTEXT D5](CONTEXT.md) set for *consumers* — and then
  asked for an npm capable of OIDC trusted publishing. That needs npm ≥ 11.5.1, and every
  npm 11.x declares `engines.node ^20.17.0 || >=22.9.0`; 20.6.0 is below it, so the newest
  installable npm there is 10.x, which cannot do OIDC. No npm version satisfied both
  constraints. The job now runs on **Node 24.19.0**, which serves no consumer and is
  invisible in what ships (`tsc` emits per `tsconfig`, `target: ES2022`, not per host); the
  floor keeps being *proven* where it matters, by `build` running the suite on 20.6.0 and
  `verify` installing the tarball and spawning the binary on it. The `npm install -g` step
  is **pinned to `npm@11.19.0`** rather than `@latest` — this workflow SHA-pins third-party
  actions on the grounds that a mutable reference is a write path into a single-maintainer
  package, and `@latest` was that same reference in different clothes; it rolled to npm 12
  (`engines.node ^22.22.2 || …`) on the first day this step ever ran. Found by the first
  real release, exactly as [EPIC-4](sprints/epics/EPIC-4.md) said the success path would be
  — the `v9.9.9` rehearsal failed at the gate by design, so `publish` had never executed
  once. New [LESSONS 7](LESSONS.md).
- **The release workflow's annotated-tag guard could never pass.** It read
  `git cat-file -t "$GITHUB_REF_NAME"`, which is correct locally and meaningless on a
  runner: `actions/checkout` resolves the tag and then force-writes the commit SHA into
  `refs/tags/<tag>` (`git fetch --no-tags origin +<sha>:refs/tags/<tag>`), so the local ref
  is a commit whatever the remote holds. The guard reported `commit` for a tag
  `git ls-remote` proves is annotated, and it would have blocked `1.1.0` and every release
  after it. Now checked against the remote — a `^{}` peeled ref exists if and only if the
  tag is a real tag object — verified in both directions ([LESSONS 6](LESSONS.md)).
- **`release:check` silently checked the wrong version in the one invocation CI uses.**
  Its argument parser skipped `--root`'s value by comparing against `rootFlag + 1`, which
  is `0` when `indexOf` returns `-1` — so with no `--root` it discarded the *version
  argument* and fell back to reading `VERSION`, comparing it against itself. Every version
  check passed by construction, on a script whose whole job is refusing a release when the
  version strings disagree. The workflow calls it exactly that way
  (`npm run release:check -- "$version" --ci`). All 20 tests missed it because every one
  passes `--root` to reach a fixture — the parameter that made the tests possible was the
  parameter that hid the bug. Two tests now run the gate the way the workflow does
  ([LESSONS 5](LESSONS.md)).
- **`package-lock.json`'s `version` field had read `0.1.0` since the `0.2.0` release**,
  while `package.json` read `1.0.1` — wrong across nine releases, including the
  publish-readiness pass that went looking for stale artifacts ([CONTEXT D12](CONTEXT.md)).
  It is a fifth place the version lives and the only one nothing watched: bumps were done by
  editing `package.json` rather than by `npm version`, which is the command that keeps the
  lock in step. Found by running a command *because* [RELEASE.md](RELEASE.md) documents it.
  The field is corrected, `release:check` now covers it, and [LESSONS 4](LESSONS.md) records
  the shape — a value nothing consumes is the one that stays wrong longest.
- **`npm test` ran the suite twice.** It reported 28 files / 394 tests against a package
  that owns 14 / 197; the surplus was `.claude/worktrees/read-tools-w33/`, a git worktree
  left behind after `feat/read-tools-w33` merged (`66be3a4`) and still checked out at
  `812f7e8`, two releases behind `main`. `.claude/worktrees/` is gitignored so `git
  status` was silent, while vitest's default `include` of `**/*.test.ts` read the tree as
  source. The worktree and its merged branch are removed, and a new `vitest.config.ts`
  scopes collection to `src/**/*.test.ts` so no nested tree can be collected again
  ([CONTEXT D13](CONTEXT.md), [LESSONS 3](LESSONS.md)). `prepublishOnly` had been running
  the doubled suite too.

### Documentation
- **[LESSONS 7](LESSONS.md)** — a CI job pinned to the *consumer* floor could not host the
  tooling it needed, and nothing noticed for a whole epic. Sibling of 6: both are steps that
  are correct on a developer's machine and impossible on a runner, both shipped with the
  defect visible in the file, and both were found only when the branch finally executed.
- **[EPIC-5](sprints/epics/EPIC-5.md) opened** — *Supported runtime and dependency
  currency*, `backlog`. It owns the distinction LESSONS 7 turned on: `engines.node` / README
  / SETUP bind consumers, while `node-version:` in CI binds nobody and exists only to prove
  the first group true. Carries one story,
  [US-5.1](sprints/stories/US-5.1-node-floor-and-ci-pins.md) — re-decide the Node floor now
  that Node 20 reached end of life on 2026-04-30. Deliberately unscheduled: `publish` is
  unblocked as of this release, so nothing there is urgent, and scheduling is the
  maintainer's ([CONTEXT D21](CONTEXT.md)).
- Three further [LESSONS.md](LESSONS.md) entries: **6** — `actions/checkout` rewrites
  `refs/tags/<tag>` to the commit SHA, so local tag inspection in CI is meaningless; **4** — a version string nothing reads drifts
  silently (`package-lock.json` was eight releases behind); **5** — twenty tests and none of
  them ran the invocation CI uses, and a red CI run is not proof the thing you care about
  ran.
- Two [LESSONS.md](LESSONS.md) entries: **2** — a story's Verification-commands row is a
  claim, and `vitest -t` that matches nothing exits 0 (this discharges the
  [W33 retrospective](sprints/sprint-2026-W33.md)'s third followup); **3** — a gitignored
  worktree is invisible to `git status` and fully visible to vitest.
- [EPIC-2](sprints/epics/EPIC-2.md) refreshed to its post-`1.0.1` state: the Feature
  pillars table and Out-of-scope section had frozen at v0.1.0's one-tool cut, and the
  Business context's "roughly thirty lines" estimate now carries the correction the W33
  retrospective asked for. Live-payload findings from the first authenticating smoke run
  are recorded there for W34.
- **Sprint W34 opened, and EPIC-2's four remaining stories written.**
  [sprint-2026-W34](sprints/sprint-2026-W34.md) (2026-08-17 → 2026-08-23, 4 stories / 11
  points) plus [US-2.10](sprints/stories/US-2.10-get-account-performance-tool.md),
  [US-2.11](sprints/stories/US-2.11-list-deals-tool.md),
  [US-2.12](sprints/stories/US-2.12-get-performance-breakdowns-tool.md) and
  [US-2.13](sprints/stories/US-2.13-get-equity-timeseries-tool.md) — the four `GET`
  operations still without a tool, one new axis each: query parameters, cursor
  pagination, payload shaping, downsampling. US-2.13 carries EPIC-2's close.
- New [CONTEXT D14](CONTEXT.md): those four ship `1.1.0` → `1.4.0`, not the expansion
  spec's `0.8.0` → `0.11.0`, which was written before the `1.0.0` cut. The spec is left
  unedited per the D1/D5 precedent. EPIC-2 §Remaining work also records that the
  `capPositions`/`capOrders` generalization the W33 retrospective deferred to US-2.11
  does **not** fire: `list_deals` bounds its payload with a caller-supplied `limit`, not
  a truncation, so it needs no third cap helper.
- **[EPIC-4](sprints/epics/EPIC-4.md) opened — the package release process.** This repo's
  release procedure was undocumented, and the record shows the cost: **nine** versions have
  a `## [X.Y.Z]` section here, **three** have a git tag, **two** have a GitHub Release
  (`v0.1.0` is tagged without one), and **two** are on npm. Four artifact sets that do not
  nest, against a pre-commit checklist that stops at `VERSION` and `CHANGELOG.md` with no
  `git tag`, `gh release` or `npm publish` item in it, and no `.github/` directory at all
  (`total_count: 0` workflow runs, ever). Five stories / 16 points, all `backlog` with no
  sprint: [US-4.1](sprints/stories/US-4.1-release-contract-and-runbook.md) `docs/RELEASE.md`
  and the release contract, [US-4.2](sprints/stories/US-4.2-release-check-gate.md) the
  `release:check` gate, [US-4.3](sprints/stories/US-4.3-backfill-tags-and-releases.md) the
  six missing tags and `v0.1.0`'s Release,
  [US-4.4](sprints/stories/US-4.4-tarball-verification.md) tarball verification before
  publish, and [US-4.5](sprints/stories/US-4.5-release-workflow.md) the tag-triggered
  workflow. Nothing is added to [sprint-2026-W34](sprints/sprint-2026-W34.md), which stays
  at its committed 11 points.
- Six new CONTEXT entries, [D15–D20](CONTEXT.md), one per question the brainstorm settled:
  **D15** every version is tagged, released and published as it lands — W33's batching was
  reasonable while nothing was on the registry and is not now that `latest` is `1.0.1`;
  **D16** releases run from `.github/workflows/release.yml` on a `v*` tag push, gated first,
  publishing by OIDC trusted publishing with `--provenance` and no stored `NPM_TOKEN` —
  possible because `npm test` is 196 passed / 1 skipped with no Senti credential in the
  environment; **D17** backfill six annotated tags for `0.2.0` → `0.7.0` plus `v0.1.0`'s
  missing Release, and never publish the six; **D18** the runbook is `docs/RELEASE.md` and
  `DEPLOY.md` stays absent for its recorded reason; **D19** the `— vX.Y.Z` CHANGELOG heading
  suffix — which correlated 9/9 with tagged versions and was documented nowhere — is retired
  rather than promoted, with no existing heading rewritten; **D20** no `next` dist-tag, with
  the trigger that would bring one in recorded.
- [EPIC-2](sprints/epics/EPIC-2.md) §Out of scope now points its "npm publishing" deferral at
  EPIC-4 instead of leaving it homeless, and [AGENTS.md](../AGENTS.md)'s epic list names all
  four epics (it had omitted EPIC-3).
- **EPIC-2's four remaining stories moved out of W34 and into the running sprint.**
  [sprint-2026-W33](sprints/sprint-2026-W33.md) gains a **Phase 3** carrying
  [US-2.10](sprints/stories/US-2.10-get-account-performance-tool.md) →
  [US-2.13](sprints/stories/US-2.13-get-equity-timeseries-tool.md) — 11 points, the whole
  of [sprint-2026-W34](sprints/sprint-2026-W34.md)'s committed scope — so the sprint is
  now 15 stories / 42 points across three phases, 31 of them delivered. W34 keeps its file
  and its `planned` status with no stories, pointing at where its scope went and how work
  returns to it. New [CONTEXT D22](CONTEXT.md) records why: the dependency those four
  actually had was a release procedure, and Phase 2 built it that same day — what was left
  holding them at `ready` was a calendar date, which is what
  [D21](CONTEXT.md) rule 1 exists to refuse. The bullet above about W34 keeping "its
  committed 11 points" was true when written and is superseded here; W33's Phase 1 and
  Phase 2 records, including that sentence in the sprint file, are left as written.
  Neither sprint's `status:` was flipped — that stays the maintainer's ([D21](CONTEXT.md)
  rule 2).

---

## [1.0.1] — 2026-08-07 — The six tools reach npm — v1.0.1

The npm publish `1.0.0` deferred ([CONTEXT D11](CONTEXT.md)), now taken
([CONTEXT D12](CONTEXT.md)). `latest` moves `0.1.0` → `1.0.1`, so
`npx -y senti-mcp-server` reaches all six read tools instead of the lone
`list_accounts` that `0.1.0` shipped. **No tool or tool behaviour changes** — the
runtime is byte-identical to `1.0.0` in intent; what changes is the tarball and the
prose describing it.

`1.0.0` itself is deliberately left unpublished. Its CHANGELOG entry says the release
is the git tag and the GitHub Release only, and that stays true rather than being
quietly contradicted by a tarball; `1.0.1` is the version that carries the corrected
README into the registry.

### Fixed
- **`npm run build` shipped dead code.** `tsc` does not remove output whose source is
  gone, and `dist/` is gitignored, so `dist/client.js`, `dist/accounts.js` and
  `dist/errors.js` — outputs of `src/client.ts`, `src/accounts.ts` and `src/errors.ts`,
  all deleted in the `0.2.0` restructure (`0ed5e80`, `1e8becd`) — survived in every
  local `dist/` and were listed by `npm pack --dry-run` for the `1.0.0` tarball.
  Nothing imports them and `bin` points at `dist/index.js`, so no runtime path was
  affected; they would simply have been published. `build` is now
  `rm -rf dist && tsc && chmod +x dist/index.js`.
- **`README.md` would have shipped a false claim about itself.** The install section
  stated "**The published package is still v0.1.0** … `list_brokers`, `list_strategies`,
  `list_account_strategies`, `list_positions` and `list_pending_orders` are not
  available through `npx` yet", directing readers to a git checkout. `README.md` is
  inside the tarball and is the npm package page, so publishing without rewriting it
  would have put a package on the registry whose own front page told users it did not
  contain what it contains. The section now names `latest` as the thing to trust, gives
  the `npm view senti-mcp-server dist-tags` check, and shows how to pin a version.
- `docs/README.md`'s absent-file table pinned the registry state to
  `senti-mcp-server@0.1.0` and asserted a `gitHead` match against the `v0.1.0` tag —
  both stale the moment `1.0.1` publishes. The row now states the published-ness
  without pinning a version claim it cannot keep current.

---

## [1.0.0] — 2026-08-07 — The W33 read surface, declared stable — v1.0.0

Promotes the six read tools shipped across `0.2.0`–`0.7.0` to a stable major version.
**No tool is added, removed or renamed relative to `0.7.0`** — `list_accounts`,
`list_brokers`, `list_strategies`, `list_account_strategies`, `list_positions` and
`list_pending_orders` are the same six `src/server.ts` registers, and the code delta is
exactly the three review fixes below. What changes is the commitment: tool names, their
arguments, and their `structuredContent` shapes are now under semver, so breaking any of
them costs a `2.0.0` ([CONTEXT D11](CONTEXT.md)).

**Not published to npm.** `npm view senti-mcp-server dist-tags` still resolves `latest`
to `0.1.0`. This release is the git tag `v1.0.0` and its GitHub Release only — reaching
the six tools still means [a git checkout](../README.md#from-a-git-checkout), exactly as
it did at `0.7.0`.

The five read scopes an API key needs are unchanged: `accounts:read`, `brokers:read`,
`strategies:read`, `trading:read` are each exercised by a shipped tool;
`performance:read` is not yet, and its three tools carry to sprint W34 along with
`list_deals`.

### Changed
- `VERSION`, `package.json` and `src/config.ts`'s `SERVER_VERSION` move `0.7.0` →
  `1.0.0` together, as `src/config.test.ts` requires. The jump is a stability
  declaration, not new functionality — the alternative, `0.7.1`, is what the diff alone
  would have earned ([CONTEXT D11](CONTEXT.md)).

### Fixed
- `list_positions` reported the floating P&L and the position count of the **surviving**
  rows after truncation, presenting a partial figure as the account's total: an account
  holding 250 positions of `+10` rendered `200 open positions · floating P&L 2,000.00`
  against a true float of `2,500.00`, with the only disclosure sitting below 200 position
  blocks. `capPositions` now returns `totals` derived from the full list, and
  `formatPositions` takes them as a required argument, so the header quotes the account's
  own figures and appends `(showing the first 200)` when rows were cut.
  `list_pending_orders` had the same defect in its count and is fixed the same way
  (`capOrders` → `totals`, `formatOrders` third argument).
- A `404` from any endpoint claimed "the account does not exist, is not owned by this API
  key, or has been unlinked" and pointed the reader at `list_accounts` — including from
  `list_brokers`, `list_strategies` and `list_accounts`, which take no `accountId` at all,
  so a mistyped `SENTI_API_BASE_URL` sent the operator to check the one thing that could
  not be the cause. `RequestOptions` gains `notFoundMeans`, matching the existing `scope`
  (403) and `conflictMeans` (409) treatment, and the account wording moves to the exported
  `ACCOUNT_NOT_FOUND` constant that only the three account-scoped tools pass. A bare `404`
  now points at `SENTI_API_BASE_URL` and the path instead.
- `docs/CONTEXT.md` had renumbered the already-published **D7** ("No Active Context block
  in this repo") to D10 and reassigned D7–D9 to the read-tool decisions, breaking RULE-7
  append-only: `CONTEXT D7` as cited by commit `e50faab` and by `CLAUDE.md` resolved to a
  different decision. D7 is restored byte-for-byte in place, the read-tool entries are
  D8–D10 under `## Phase 3 — Read-tool expansion`, and every reference across `AGENTS.md`,
  `CLAUDE.md`, `docs/` and the W33 plan, spec and story is remapped to match.

---

## [0.7.0] — 2026-08-07 — `list_pending_orders`: the last tool of sprint W33

Closes US-2.9 and closes sprint W33. `list_pending_orders` reads `GET
/api/v1/accounts/{accountId}/orders` and returns the pending limit and stop orders
resting on one MT5 account — symbol, order type, volume, trigger price, stop loss, take
profit and stop-limit price — read live from the account's MT5 terminal. It is the
order-side twin of 0.6.0's `list_positions`: filled positions are what `list_positions`
answers, unfilled resting orders are what this tool answers, and the tool's description
points each one at the other.

**The terminal-offline distinction, carried over from `list_positions` unchanged:** a
`200` with an empty `orders` array means the terminal answered and the account
genuinely has nothing pending — a real zero. A `409` means the terminal could not be
reached at all, reported as an error whose text explicitly states it is "NOT the same
as the account having no pending orders" — any resting orders are still resting and may
still trigger. `src/server.test.ts`'s `/offline/i` and `/not the same as/i` assertions
hold that distinction in place the same way they do for `list_positions`.

**One field this tool adds that `list_positions` does not have:** `priceStopLimit`. Unlike
`sl`/`tp` — which apply to every order and render an explicit `—` when `0` — a `0`
`priceStopLimit` means the field does not apply to this order's type at all, so its whole
line is omitted from the rendering rather than shown as a dash.

Like `list_positions`, this tool is account-scoped and routes its path exclusively
through `accountPath` (US-2.4) — no template literal or concatenation touches
`accountId`.

### Added
- `registerListPendingOrders` (`src/tools/trading/orders.ts`) — registered read-only via
  `registerReadTool` under the `trading:read` scope. Takes one required argument,
  `accountId`. Passes a call-site `conflictMeans` string to `client.get` so the `409`
  branch in `core/client.ts` reports the terminal-offline meaning specific to this
  endpoint.
- `src/server.test.ts` — a `list_pending_orders` invariant row in `TOOL_CALLS`
  (`successBody` is the `{ orders: [...] }` envelope, not a bare array), plus its own
  `describe` block: the account-scoped path is called correctly, a `409` is reported as
  an offline terminal distinguished from holding no pending orders, and a `403` names
  the `trading:read` scope.
- `src/smoke.test.ts` now walks the whole W33 read path in one live call:
  `list_accounts` → `list_brokers` → `list_strategies` → (if the key owns an account)
  `list_account_strategies` → `list_positions` → `list_pending_orders`, tolerating a
  `409` on the last two as a real state of the world rather than a broken contract. A
  key with no linked account still exercises every platform-wide endpoint before
  returning early — that is not a failure.

### Changed
- `src/server.ts` now registers six tools — the full W33 tool surface;
  `list_accounts`, `list_brokers`, `list_strategies`, `list_account_strategies` and
  `list_positions` are unchanged.

---

## [0.6.0] — 2026-08-07 — `list_positions`: empty is a real zero, `409` is not

Closes US-2.8. `list_positions` reads `GET /api/v1/accounts/{accountId}/positions` and
returns the positions currently open on one MT5 account — symbol, direction, volume,
open/current price, stop loss, take profit, swap, and floating profit — read live from
the account's MT5 terminal. This is the first tool this sprint where the terminal being
reachable is itself part of the answer: the endpoint's `409` means the terminal is
offline, not that the account holds nothing, and conflating the two would tell a trader
holding open risk that they hold none.

**The terminal-offline distinction, stated plainly because it is easy to misread as a
bug:** a `200` with an empty `positions` array means the terminal answered and the
account genuinely holds no open positions — a real zero. A `409` means the terminal
could not be reached at all, so the API cannot say what is held — this is reported as an
error, with text that explicitly states it is "NOT the same as the account holding no
positions." A model (or a person) reading only the two surface forms — "no positions"
text vs. an error — should never be able to mistake one for the other; that separation
is what `formatPositions`'s empty-list branch and the `409` branch's `conflictMeans`
text each say outright, and what `src/server.test.ts`'s two dedicated assertions
(`/real zero/i` and `/not the same as/i`) hold in place.

Like 0.5.0's `list_account_strategies`, this tool is account-scoped and routes its path
exclusively through `accountPath` (US-2.4) — no template literal or concatenation
touches `accountId`.

### Added
- `registerListPositions` (`src/tools/trading/positions.ts`) — registered read-only via
  `registerReadTool` under the `trading:read` scope. Takes one required argument,
  `accountId`. Passes a call-site `conflictMeans` string to `client.get` so the `409`
  branch in `core/client.ts` reports the terminal-offline meaning specific to this
  endpoint rather than a generic conflict message.
- `src/server.test.ts` — a `list_positions` invariant row in `TOOL_CALLS` (`successBody`
  is the `{ positions: [...] }` envelope, not a bare array, since this endpoint wraps its
  array unlike `list_brokers` and `list_strategies`), plus its own `describe` block: the
  account-scoped path is called correctly, a `409` is reported as an offline terminal and
  is explicitly distinguished from holding no positions, an empty `200` is presented as a
  real zero, and a `403` names the `trading:read` scope.

### Changed
- `src/server.ts` now registers five tools; `list_accounts`, `list_brokers`,
  `list_strategies` and `list_account_strategies` are unchanged.

---

## [0.5.0] — 2026-08-06 — `list_account_strategies`: the first tool with a path parameter

Closes US-2.7. `list_account_strategies` reads `GET /api/v1/accounts/{accountId}/strategies`
and returns the strategies (expert advisors) currently deployed on one MT5 account — a
different question from `list_strategies`'s platform-wide catalog of what could be
deployed. This is the first tool this sprint to take a path parameter, and so the first
to route through `accountPath` (US-2.4, shipped in 0.2.0): every segment is validated
against `/^[A-Za-z0-9_-]{1,64}$/` and `encodeURIComponent`-ed before it is joined into a
URL, and the guard runs *before* `client.get` is entered — a traversal payload such as
`../../admin` is rejected with no HTTP request made at all, not merely rejected by the
server. The description names `list_accounts`' `id` field as the source of `accountId`
and states plainly that `login` (the MT5 account number) is the wrong value; a `404`
repeats that hint via `core/client.ts`'s dedicated branch.

### Added
- `registerListAccountStrategies` (`src/tools/strategies/list-account-strategies.ts`) —
  registered read-only via `registerReadTool` under the `strategies:read` scope. Takes
  one required argument, `accountId`. Builds the request path exclusively through
  `accountPath`; no template literal or concatenation touches the parameter.
- `src/server.test.ts` — a `list_account_strategies` invariant row in `TOOL_CALLS` (the
  first row carrying `arguments`, exercising the key-leak table across all six error
  statuses for a tool that takes a parameter), plus its own `describe` block: the
  account-scoped path is called correctly, a traversal attempt is rejected with the
  stubbed `fetch` asserted **never invoked**, `accountId` is a required input, the
  description names `list_accounts` and `login`, a `404` carries the login/id hint, and
  a `403` names the `strategies:read` scope (this last test is not in the plan's Task
  15 brief; added so AC-6 has an assertion behind it, matching the "names the scope on
  403" test both `list_brokers` and `list_strategies` already carry).

### Changed
- `src/server.ts` now registers four tools; `list_accounts`, `list_brokers` and
  `list_strategies` are unchanged.

---

## [0.4.0] — 2026-08-06 — `list_strategies`: the second tool on the new substrate

Second tool built on the `core/` + `tools/<tag>/` substrate US-2.4 shipped in 0.2.0, and
the second and last no-path-parameter, platform-wide catalog tool this sprint (sibling of
`list_brokers`). `list_strategies` reads `GET /api/v1/strategies` and returns the
platform-wide catalog of strategies (expert advisors) available to deploy — every symbol,
timeframe, rating and preset Senti offers — not the strategies currently running on any
particular account. The description says so explicitly and points at
`list_account_strategies`, US-2.7's tool, for that user-scoped question.

`description`, `supportedSymbols` and `supportedTimeframes` are optional in the upstream
schema — absent from the endpoint's `required` array, not merely nullable — so
`StrategySchema` marks them `.optional()` rather than only `.nullable()`, and a response
omitting any of the three parses cleanly. `avgRating` stays nullable-not-optional and
renders as `—`, never `0`, when a strategy has no reviews yet — the same
null-is-not-zero precedent `list_accounts` set for `lastKnownBalance`.

### Added
- `list_strategies` tool (`src/tools/strategies/list-strategies.ts`) —
  `registerListStrategies`, registered read-only via `registerReadTool` under the
  `strategies:read` scope. Takes no arguments. Points a model at `id` as the
  `eaDefinitionId` when deploying.
- `src/server.test.ts` — a `list_strategies` invariant row in `TOOL_CALLS`, plus its own
  `describe` block asserting the platform-wide description naming
  `list_account_strategies`, and the `strategies:read` scope named on a `403`.

### Changed
- `src/server.ts` now registers three tools; `list_accounts` and `list_brokers` are
  unchanged.

---

## [0.3.0] — 2026-08-06 — `list_brokers`: the first tool on the new substrate

First tool built on the `core/` + `tools/<tag>/` substrate US-2.4 shipped in 0.2.0.
`list_brokers` reads `GET /api/v1/brokers` and returns the platform-wide catalog of
brokers Senti supports — every MT5 server name and account type available to link,
not the accounts this API key already has. The description says so explicitly, since
read plainly "brokers" is easily mistaken for "the brokers I trade with."

### Added
- `list_brokers` tool (`src/tools/brokers/list-brokers.ts`) — `registerListBrokers`,
  registered read-only via `registerReadTool` under the `brokers:read` scope. Takes no
  arguments. Points a model at `accountTypes[].id` as the `brokerAccountTypeId` and a
  `servers[]` value as the `server` the account-linking endpoint takes.
- `src/server.test.ts` — a `list_brokers` invariant row in `TOOL_CALLS`, plus its own
  `describe` block asserting the platform-wide description, the empty input schema, and
  the `brokers:read` scope named on a `403`.

### Changed
- `src/server.ts` now registers two tools; `list_accounts` is unchanged.

---

## [0.2.0] — 2026-08-06 — Read-tool substrate: core/ + tools/, registerReadTool, five scopes

Substrate release — ships no new tool. Restructures `src/` into `core/`
(infrastructure) and `tools/<tag>/` (one folder per API tag), adds the
`registerReadTool`/`parseOrThrow` helpers and the client's `query`/`accountPath`/
`404`/`409` support, and migrates `list_accounts` onto all of it with no behaviour
change. This is the shape the remaining nine read tools land in over the rest of this
sprint and the next.

### Added
- `src/core/` — `client.ts`, `errors.ts`, `tool.ts`, `parse.ts`, each with a
  co-located test file. Infrastructure that never imports from `tools/` (enforced by
  grep, not review).
- `client.get`'s `query` option — drops `undefined` entries, encodes the rest via
  `URLSearchParams`.
- `accountPath` — the only function permitted to build a path carrying `accountId`.
  Validates each segment against `/^[A-Za-z0-9_-]{1,64}$/` before
  `encodeURIComponent`, rejecting `../`, percent-encoded traversal, the empty string,
  and oversized segments.
- Dedicated `404` and `409` branches in `client.get`. `404` names the three likely
  causes (account doesn't exist, isn't owned by this key, or a `login` was passed
  instead of `id`) and points at `list_accounts`. `409` takes a call-site-supplied
  `conflictMeans` string, since what a conflict means is a property of the endpoint,
  not something the client can infer.
- `registerReadTool` (`core/tool.ts`) — registers a tool with `readOnlyHint: true` and
  `openWorldHint: true` set as constants with no parameter path to override them,
  wraps `run` in the `try`/`catch` every tool needs, and returns
  `{ content, structuredContent }` on success or `{ content, isError: true }` on
  failure.
- `parseOrThrow` (`core/parse.ts`) — the `safeParse`-or-throw-naming-the-field pattern
  generalized out of `accounts.ts` so every tool shares one implementation.
- `src/tools/accounts/list-accounts.ts` — `list_accounts`, migrated from
  `src/accounts.ts` onto `registerReadTool` and `parseOrThrow` with no behaviour
  change.
- Table-driven invariant tests in `src/server.test.ts`, written once to cover every
  tool added afterwards: `readOnlyHint`/`openWorldHint` on every registered tool, no
  API key leakage on any of six error statuses or a network failure, and
  `structuredContent` validating against each tool's own `outputSchema` on a
  successful call. Later tool stories add one `TOOL_CALLS` row instead of writing new
  tests.
- `docs/sprints/epics/EPIC-3.md` — placeholder for the write path (`status: backlog`,
  no stories yet): the seven write operations and their guardrails (opt-in
  environment variable, `Idempotency-Key` on the two operations that accept it,
  elicitation before execution, the partial-close-is-not-retry-safe warning, and the
  best-effort-batch contract for the two `*-all` operations).

### Changed
- Repo layout: `src/` splits into `core/` and `tools/<tag>/` — `accounts/` today,
  `brokers/`, `strategies/`, `performance/`, and `trading/` as their tools land
  ([CONTEXT D8](CONTEXT.md)). Reverses the flat-layout rule v0.1.0 shipped with.
- `list_accounts` now registers through `registerReadTool` ([CONTEXT D9](CONTEXT.md)).
- The API key now needs five read scopes, not one: `accounts:read`, `brokers:read`,
  `strategies:read`, `performance:read`, `trading:read` — documented in
  `docs/SETUP.md`, `.env.example`, and `README.md`. There is no key-introspection
  endpoint, so a missing scope is not caught at startup; it surfaces as a `403`
  naming the scope the first time the affected tool is called, and every other tool
  keeps working. Only `accounts:read` is exercised by a shipped tool today.

### Fixed
- `AGENTS.md` and `docs/sprints/epics/EPIC-2.md` corrected: the Senti Quant Public
  API is 10 `GET` + 7 `POST` (17 operations), not "eight of 17 are POST." With
  `list_accounts` shipped, **nine** read operations remain, not sixteen.

---

## [0.1.0] — 2026-08-05 — First release: authenticated Senti client and list_accounts — v0.1.0

First release. Adopted the `koni-docs` documentation framework, then built an
authenticated Senti Quant API client and shipped its first tool, `list_accounts`, over
MCP stdio — proven with one live call against the development API.

### Added
- `koni-docs` documentation framework: the skill vendored at `.agents/skills/koni-docs`
  with `.claude/skills/koni-docs` symlinked to it, and `skills-lock.json` recording
  source and content hash.
- `@koniverse/koni-docs@^0.12.0` as a devDependency, exposed as `npm run agile:status`
  and `npm run agile:validate`.
- `VERSION`, `docs/README.md`, `docs/CHANGELOG.md`, `docs/CONTEXT.md`.
- Sprint corpus: EPIC-1, EPIC-2, `sprint-2026-W32`, and four stories.
- `AGENTS.md` as the canonical project guide; `CLAUDE.md` with the koni-docs
  integration and Active Context blocks.
- `src/config.ts` — `loadConfig(env)` producing a frozen `Config`; fails fast with
  actionable text when `SENTI_API_KEY` is absent.
- `src/errors.ts` — `ApiError` carrying HTTP status and envelope code; `describeError`
  flattening the `cause` chain.
- `src/client.ts` — `createClient(config, deps)` owning the `Authorization` header, a
  15s timeout combined with the caller's `AbortSignal`, and status-to-message mapping.
- `src/accounts.ts` — Zod schema for the 16-field account object, `parseAccounts`, and
  a compact text rendering where null balances show as `—`.
- `src/server.ts` — the `list_accounts` tool, registered read-only, returning both a
  text summary and `{ accounts: [...] }` as `structuredContent`.
- `src/index.ts` — stdio bootstrap serving both the 2025 and 2026 protocol eras via
  `serveStdio`.
- `src/smoke.test.ts` — one opt-in live call against the development API, skipped when
  no key is present.
- `README.md` — tools, configuration, install, client config, and the read-only
  posture.
- MIT `LICENSE`.
- `docs/SETUP.md` and `.env.example` — local setup, troubleshooting, and all three
  environment variables with placeholders (RULE-11).
- `tsconfig.test.json` — typecheck-only config with no exclude, so `npm run typecheck`
  covers the test files the build config deliberately keeps out of `dist/`.
- `src/index.test.ts` — spawns the built `dist/index.js` and asserts both startup
  legs, including that nothing reaches stdout.

### Changed
- **Node floor raised to 20.6.0.** `AbortSignal.any()` needs 20.3.0 and
  `test:smoke`'s `node --env-file` needs 20.6.0; on 20.0–20.2 the server started and
  then failed on every tool call ([CONTEXT D5](CONTEXT.md)).
- `SENTI_API_BASE_URL` must now be an absolute `https:` or `http:` URL. A scheme this
  client cannot fetch, or a base carrying a query string or fragment, is rejected at
  startup with the offending value named ([CONTEXT D6](CONTEXT.md)).
- A soft-deleted account is marked as such in the text summary and counted separately
  in the header, instead of reading exactly like a live one; the terminal's status is
  reported alongside it.
- The 401 message now says the key must belong to the environment
  `SENTI_API_BASE_URL` targets, rather than only pointing back at `SENTI_API_KEY`.

### Fixed
- API error messages no longer double their sentence terminator
  (`…Insufficient scope.. The API key is missing…`).
- A rejected `close()` on SIGINT/SIGTERM is reported to stderr instead of floating as
  an unhandled rejection, which under Node's defaults turned a clean shutdown into a
  crash.
- Out-of-band stdio transport errors are reported to stderr instead of being silent.
- The environment-mismatch warning in `README.md`, `docs/SETUP.md` and `.env.example`
  named three environments (production, staging, development) and resolved none of
  them, so its own logic predicted a `401` for the documented happy path. It now states
  the pairing that has actually been verified — a key issued from the staging dashboard
  works against `https://be-dev.sentitrade.xyz`, the pairing `npm run test:smoke` has
  exercised twice — and leaves the production pairing explicitly unconfirmed.

---
