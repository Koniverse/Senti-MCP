# CONTEXT.md — Decision Log

Append-only (RULE-7). A past entry is **never** rewritten; a decision that changes
gets a new entry referencing the original by `D<N>`. Future readers come here asking
"why did we pick X over Y" — silently editing history breaks that contract.

Next decision number: run `grep -n "^### D[0-9]" docs/CONTEXT.md | tail -1` and add 1.

---

## Phase 0 — Project foundation (2026-08-05, pre-v0.1.0)

### D1. Adopt koni-docs as this repo's documentation framework

**Context**: the repo held two documents and no code — a design spec and a v1
implementation plan, both under `docs/superpowers/`. The v1 plan was written but
unstarted. Work on the remaining 16 Senti Quant read operations, and later its write
operations, needs a durable record of what shipped and why.

**Decision**: adopt the `koni-docs` framework now, **before** the first `src/` file
exists. Install the skill so every agent working here loads its rules, add the
`@koniverse/koni-docs` CLI as a devDependency, and create a valid corpus with the v1
work sitting in it as forward stories.

**Rationale**: because the koni-docs core rule is *every code-shipping commit updates
docs in the same commit*, and that rule can only be honoured from the first code
commit onward. Adopting after v1 would mean stories reverse-engineered from finished
code, with acceptance criteria written to match whatever the implementation happened
to do — the opposite of a contract.

**This reverses a decision recorded in the design spec.** Its closing paragraph reads
*"`@koniverse/koni-docs` is not carried over. It is `read-mcp-server`'s convention for
tracking its own work; applying it to a repository with no sprints yet would be
ceremony."* That judgement was correct for its premise — a repo with no sprints — and
the premise has changed: v1 is now a four-story sprint with 16 further read operations
behind it and a write-operation epic after that. The spec is left as written; this
entry is the amendment.

**Alternatives considered**:
- Wiring only the skill, with no corpus — rejected: RULE-1, RULE-5, RULE-6 and RULE-7
  would have nothing to apply to, so the skill would be loaded but inert.
- The full `docs/` tree including `PRD.md` and `ARCHITECTURE.md` — rejected for now:
  authored today they would describe 16 tools that do not exist. See D5 when they land.

**Impact**: adds `VERSION`, `docs/README.md`, `docs/CHANGELOG.md`, this file, and
`docs/sprints/` with EPIC-1, EPIC-2, `sprint-2026-W32` and four stories. The v1
implementation plan is amended so its Task 1 extends `package.json` rather than
creating it.

**Date**: 2026-08-05
**Version**: pre-v0.1.0

---

### D2. Vendor the skill via `skills-lock.json` rather than symlink a local checkout

**Context**: `koni-setup`'s `references/skill-wiring.md` offers three wiring
strategies and recommends a *central relative symlink* — `.agents/skills/koni-docs`
pointing at a `Koni-Skills` checkout sitting beside this repo on disk.

**Decision**: install with
`npx skills add Koniverse/Koni-Skills --skill koni-docs --agent claude-code --agent universal`,
which vendors real files into `.agents/skills/koni-docs`, adds
`.claude/skills/koni-docs` as a **relative** symlink to them, and records source plus
content hash in `skills-lock.json`. Commit all three.

**Rationale**: because the recommended strategy is not available here. The local
`Koni-Skills` checkout lives at `~/Workspace/sw/subwallet-folder/Koni-Skills`, which
is not a sibling of this repo, so no relative link reaches it. An absolute symlink
would dangle on every other clone and in CI — `koni-setup` names dangling skill
symlinks its single most common onboarding defect. The lockfile keeps provenance
that a hand-copied directory would lose, and `npx skills experimental_install`
restores the skill on a fresh clone.

**Alternatives considered**:
- Absolute symlink to the local checkout — rejected: breaks for every consumer that
  is not this machine.
- Manual vendored copy with no lockfile — rejected: no recorded source or hash, so
  drift from upstream becomes invisible.

**Impact**: 48 skill files are tracked in git, so the repo grows by roughly 6.8k lines
of Markdown. Updating the skill is `npx skills update koni-docs`, which is a reviewable
diff rather than a silent change under a symlink.

**Note on the pinned CLI version**: `skill-wiring.md` says to read the version from
`Koni-Skills/VERSION` "because it tracks the published npm version". It does not — the
repo is at `0.67.0` and the CLI at `0.12.0`, and they have been on separate release
tracks for many versions. `^0.12.0` here comes from
`npm view @koniverse/koni-docs version`.

**Date**: 2026-08-05
**Version**: pre-v0.1.0

---

### D3. Wire `status` and `validate`; omit `sync`

**Context**: the CLI ships seven subcommands, and `SKILL.md` §3c lists
`koni-docs sync` in the pre-commit checklist.

**Decision**: expose exactly two npm scripts — `agile:status` and `agile:validate`.
`sync` is not wired, and is absent from this repo's pre-commit checklist.

**Rationale**: because `sync` propagates story status up into PRD and epic tables, and
at CLI 0.10.0 it over-aggregated the "Ship" column and corrupted curated
`version_shipped` values — the reason `Koni-Skills` excludes it from its own checklist
(their CONTEXT D39). `read-mcp-server` also wires only `status` and `validate`. There
is a second reason specific to this repo: with no `PRD.md`, `sync` has no upward
target, so it can only warn.

**Alternatives considered**:
- Wire `sync` and hand-inspect its diff each time — rejected: a command that needs
  supervision on every run is not automation.

**Impact**: epic story tables and the sprint scope table are maintained by hand.
`STATUS.md` remains fully generated (RULE-5). Revisit when a CLI release notes the
aggregation fix, or when `PRD.md` lands.

**Date**: 2026-08-05
**Version**: pre-v0.1.0

---

### D4. Active Context Pattern A — inline in CLAUDE.md

**Context**: `templates/integration.md` §0 offers Pattern A (the Active Context block
inline in `CLAUDE.md`) or Pattern B (extracted to a gitignored `.active-context.md`),
and recommends B for teams.

**Decision**: Pattern A. `CLAUDE.md` carries the block between
`<!-- koni-docs:auto-update -->` markers.

**Rationale**: because Pattern B's only benefit is eliminating merge conflicts on a
file that several contributors edit in parallel, and this repo has one contributor on
one branch. Migrating to B later is additive — create the two files, add one
gitignore line, replace the block with a pointer.

**Impact**: `AGENTS.md` is the canonical project guide per `integration.md` §3.1;
`CLAUDE.md` stays thin — a pointer, the integration block, and the Active Context
snapshot.

**Date**: 2026-08-05
**Version**: pre-v0.1.0

---

## Phase 1 — v0.1.0 review follow-up (2026-08-05)

### D5. Raise the supported Node floor to 20.6.0

**Context**: `package.json` declared `engines.node: ">=20"`, chosen before the code
existed. Two things shipped in v0.1.0 need more than that. `src/client.ts` calls
`AbortSignal.any()`, added in Node **20.3.0**, and `src/server.ts` always passes a
request signal, so the ternary that guards it always takes the `AbortSignal.any`
branch. The `test:smoke` script uses `node --env-file`, added in **20.6.0**.

**Decision**: `engines.node` is `>=20.6.0`. `README.md` §Requirements and
[SETUP.md](SETUP.md) §1 state the same floor with the same two reasons.

**Rationale**: because the old floor failed in the worst available way. On Node
20.0–20.2 the server starts, `tools/list` succeeds, and the failure appears only when
a tool is actually called — `TypeError: AbortSignal.any is not a function` — which
reads as a broken server rather than an unsupported runtime.

**Alternatives considered**:
- Polyfill `AbortSignal.any` for 20.0–20.2 — rejected: carrying a shim to widen
  support by three patch releases of an already-superseded line buys nothing.
- Floor at 20.3.0 and drop `--env-file` from `test:smoke` — rejected: that script is
  how the one live test gets its credential, and hand-rolled dotenv parsing is a
  dependency or a bug.

**Impact**: the two planning artifacts under `docs/superpowers/` still read `Node ≥ 20`.
They are deliberately **not** edited — both are snapshots of intent, on the same
principle D1 applied to the design spec. This entry is where the current floor lives;
`package.json` is where it is enforced.

**Date**: 2026-08-05
**Version**: 0.1.0

---

### D6. Validate the base URL's scheme and shape, allowing `http:`

**Context**: `loadConfig` accepted any value `new URL()` could parse. `file:///etc`,
`foo:bar` and `https://host?x=1` all passed. The last is the damaging one: the client
concatenates, so a base carrying a query became
`https://host/?x=1/api/v1/accounts` — a 404 whose cause is invisible at the call site.

**Decision**: reject any scheme that is not `https:` or `http:`, naming the offending
value, and reject a base URL carrying a query string or fragment. **`http:` stays
allowed**, so the server can be pointed at an API running locally over plain HTTP; the
error text and `.env.example` both say it sends the key in cleartext.

**Rationale**: because a scheme this client cannot fetch is always a typo, and failing
at load time names it while the reader is still looking at the variable. Forbidding
`http:` outright would block local development against a non-TLS API for a threat —
a typo'd base URL sending `Authorization: Bearer sq_live_…` over the wire — that
naming the risk addresses just as well without removing a legitimate workflow.

**Alternatives considered**:
- `https:` only — rejected: breaks `http://localhost:…` development.
- Silently strip a query and fragment — rejected: a base URL carrying one is a
  misunderstanding, and quietly repairing it teaches nothing.

**Impact**: `SENTI_API_BASE_URL` is now documented as *an absolute `https:`/`http:` URL
carrying no query string or fragment*. A path-carrying base is still accepted — the
value is joined to the endpoint path by concatenation, which a path prefix survives and
a query does not — so this rejects only what could not have worked anyway.

**Date**: 2026-08-05
**Version**: 0.1.0

---

## Phase 2 — Post-v0.1.0 doc hygiene (2026-08-07)

### D7. No Active Context block in this repo (revision of D4)

**What changed**: D4 chose Pattern A — the Active Context block inline in `CLAUDE.md`
between `<!-- koni-docs:auto-update -->` markers. It framed the choice as A vs. B and
never considered the third option: keeping no such block at all. That is the option
this repo now takes.

**New decision**: this repo maintains **no** Active Context block, in any form. The
block is removed from `CLAUDE.md`, `.active-context.md` is not created, and the markers
are not to be restored. The koni-docs T1–T7 trigger points
([`integration.md` §4](../.agents/skills/koni-docs/references/templates/integration.md))
and the `CLAUDE.md Active Context block updated` item in the skill's §3c checklist do
not apply here. The prohibition is recorded in `AGENTS.md` §Conventions, in `CLAUDE.md`,
and in this repo's own pre-commit checklist — all three override the vendored skill.

**Rationale**: because the block was a hand-maintained copy of facts that already have a
generated or canonical home — the sprint file owns scope and story status, `STATUS.md`
is generated from the stories (RULE-5), `VERSION` plus `CHANGELOG.md` own the shipped
version, and this file owns the decisions. A second copy has no authority of its own: it
can only agree with those sources or be wrong about them, and between its seven trigger
points it is routinely wrong. D4's own rationale for A over B was "one contributor, one
branch" — equally an argument that a personal snapshot buys nothing that reading the
sprint file does not.

**Alternatives considered**:
- Migrate to Pattern B (`.active-context.md`, gitignored) — rejected: it relocates the
  staleness rather than removing it, and a gitignored file is never reviewed, so no
  reader catches it drifting.
- Keep the block but refresh it only at sprint close — rejected: a snapshot known to be
  stale for most of a sprint is worse than none, because it still reads as current.

**Impact**: `CLAUDE.md` is now a pointer, the `koni-docs:` integration block, and
repo-specific notes. `AGENTS.md` §Conventions carries the prohibition, and its Quick
reference points "know what's in flight" at the sprint file and `STATUS.md`.
`docs/README.md` drops the checklist item and records the absence. The unstarted W33
plan is amended so its per-story close steps no longer recreate the block; closed
stories and the CHANGELOG keep their references, because they record what did happen.
Consequence to accept: `docs/sprints/STATUS.md` must actually be regenerated at every
story close — with the block gone it is the only in-flight snapshot left.

**Date**: 2026-08-07
**Version**: 0.1.0

---

## Phase 3 — Read-tool expansion (2026-08-06)

### D8. Replace the flat `src/` layout with `core/` and `tools/<tag>/`

**Context**: [AGENTS.md](../AGENTS.md) described a flat `src/` as deliberate — "the six
source files below, flat … tools split by API tag when they multiply, not into a
`tools/` directory." That rule was written when the six files were `index.ts`,
`config.ts`, `server.ts`, `accounts.ts`, `client.ts`, and `errors.ts`. The
[read-tool expansion design spec](superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
puts ten tools behind this server, each with a co-located test file — the layout the
rule was written for is being outgrown at sixteen files, not six.

**Decision**: `src/` splits into `core/` — infrastructure that must never depend on any
tool (`client.ts`, `errors.ts`, `tool.ts`, `parse.ts`) — and `tools/<tag>/`, one folder
per API tag (`accounts/`, `brokers/`, `strategies/`, `performance/`, `trading/`), one
file per endpoint. `list_accounts` moves from `src/accounts.ts` to
`src/tools/accounts/list-accounts.ts` as the first tenant. The dependency edge is
one-way — `core/` never imports from `tools/` — and US-2.4 enforces that by grep
(`grep -rl "tools/" src/core/` returns nothing), not by review discipline.

**Rationale**: because three things had to be checked before believing the move was
free, and all three held. `tsconfig.json` already globs recursively
(`src/**/*.ts`, excluding `src/**/*.test.ts`) and `package.json`'s `files` array
matches it, so subdirectories need no build-config change. `src/index.ts` cannot
move regardless of what else does — `bin` points at `dist/index.js` and `rootDir` is
`src`, so relocating `index.ts` would change the `dist/` layout, break `bin`, and break
`index.test.ts`, which spawns the built entry point on purpose. `test:smoke` hardcodes
`src/smoke.test.ts` in `package.json`; leaving that file at the root of `src/` avoids
having to edit `package.json` in this same commit for no functional reason.

**Alternatives considered**:
- Keep the flat layout and prefix filenames by tag (`accounts-list.ts`,
  `brokers-list.ts`, …) — rejected: it does not co-locate a tool with its test file
  any better than the status quo, and it leaves the `core`/`tools` dependency edge as
  a naming convention a reviewer has to trust rather than a directory grep can check.
- Split into `tools/` without carving out `core/` — rejected: infrastructure
  (the HTTP client, error mapping, tool registration, response parsing) would keep
  entangling with domain modules the way `accounts.ts` already showed signs of in
  v0.1.0, exactly the coupling ten tools would multiply.

**Impact**: `src/core/{client,errors,tool,parse}.ts`, each with a co-located test
file; `src/tools/accounts/list-accounts.ts` (+ test) as the migrated first tenant, with
no behaviour change to `list_accounts`. [AGENTS.md](../AGENTS.md)'s repo-structure
section is rewritten to describe the new layout in place of the flat block it
previously described.

**Date**: 2026-08-06
**Version**: 0.2.0

---

### D9. `registerReadTool` and `parseOrThrow`, not a descriptor table

**Context**: the [v1 design spec](superpowers/specs/2026-08-05-senti-mcp-server-design.md)
deferred the question of a data-driven tool registry to "revisit when the repetition is
real." One tool could not answer that question; ten tools, nine of them still to write
this quarter, can.

**Decision**: build two small helpers rather than a table. `registerReadTool<Args,
Structured>(server, spec)` in `core/tool.ts` wraps the mechanical parts of registering a
tool — the `try`/`catch` around `run`, shaping `{ content, structuredContent }` on
success and `{ content, isError: true }` on failure, and setting
`annotations: { readOnlyHint: true, openWorldHint: true }`. `parseOrThrow(schema,
payload, subject)` in `core/parse.ts` wraps the `safeParse`-or-throw-naming-the-field
pattern `accounts.ts` already used once, so all ten tools share one implementation
instead of re-deriving it. Every tool module still writes its own `name`, `title`,
`description`, `inputSchema`, and `outputSchema` in full.

**Rationale**: because the repetition that turned out to be real was the mechanical
`try`/`catch` and the `safeParse`-and-throw block — not the descriptions and schemas,
which are what decide whether a model picks the right tool among ten rather than
guessing, and which a descriptor table would flatten into inert data, losing exactly
the review surface that catches a wrong or ambiguous description. The annotations
becoming constants inside `registerReadTool`, with no field in `ReadToolSpec` that can
set `readOnlyHint: false`, is deliberate: it turns "do not register a write tool before
EPIC-3" from a convention a reviewer must remember into something the type signature
itself refuses to do.

**Alternatives considered**:
- A descriptor table — an array of `{ name, endpoint, scope, schema, … }` consumed by
  one generic registration loop — rejected: it would swallow the ten tools' natural-
  language descriptions into table cells, the opposite of what U-2.4's own design spec
  warns against, and a bug in the one generic loop would silently affect all ten tools
  identically rather than surfacing as an isolated diff in one file.

**Impact**: `core/tool.ts` (`registerReadTool`), `core/parse.ts` (`parseOrThrow`), each
with its own test file. `src/tools/accounts/list-accounts.ts` calls both today; the
nine remaining read tools this design spec covers reuse both without re-deriving
either pattern.

**Date**: 2026-08-06
**Version**: 0.2.0

---

### D10. Tools bind and shape their own payloads

**Context**: the [read-tool expansion design spec](superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)'s
§Payload policy considered mirroring the Senti API's responses verbatim into
`content`/`structuredContent` and trusting the host's context window to cope. That
fails concretely on `get_performance_breakdowns`: a year-long `breakdowns` window is
roughly 70,000 tokens, which is not a rounding error against a model's context — it is
a single tool call crowding out everything else in the conversation for one performance
question.

**Decision**: every tool decides what of the underlying API response actually reaches
the model, and states in a `notes: string[]` field — carried in `outputSchema` and
repeated in `content` — what, if anything, it cut. `notes` is an empty array when
nothing was cut, so its presence in a schema never by itself implies a cut occurred.
This decision is recorded now, while only `list_accounts` (which cuts nothing) is
shipped; it is first *implemented* in US-2.8's `list_positions` (a 200-row defensive
cap) and completed by the three W34 performance tools (`get_performance_breakdowns`
dropping `perAccount` and the `cumulative*` columns and collapsing `heatmap` to 24
hourly buckets; `get_equity_timeseries` downsampling `portfolio` to 200 points).
`list_deals` is the deliberate exception: paginating via `cursor`/`limit` is not
cutting, so it returns `nextCursor` as data instead of a truncation note.

**Rationale**: because both `content` and `structuredContent` enter the model's
context, "return it all and let the host cope" is not a neutral default — it is a
decision to spend tens of thousands of tokens on a question the user thought was
small, and a model that reads a truncated payload without being told it was truncated
states a confident, wrong conclusion about real money. Recording the cut in `notes`
rather than silently applying it is what keeps a shrink from becoming a lie by omission.

**Alternatives considered**:
- Mirror the API verbatim and trust the host's context window — rejected for the
  `breakdowns` reason above; it also means every future tool re-derives its own
  judgement call about what is safe to send, rather than inheriting one policy.
- A `view`/`granularity` request parameter that shrinks the payload on demand —
  deferred, not rejected: it opens a new axis (query parameters) this sprint
  deliberately keeps closed (see the design spec's Decisions taken §2, one tool per
  endpoint, no `view` parameter collapsing multiple endpoints into one `anyOf` output
  schema). Revisit once query parameters land with US-2.10.

**Impact**: every tool that can cut anything carries `notes: string[]` in its
`outputSchema`. `list_positions` and `list_pending_orders` (this sprint) get a 200-row
cap; the three W34 performance tools get the larger, column- and resolution-level cuts
above. `list_deals` carries `nextCursor` instead of a `notes` entry for the rows it
does not return in one page.

**Date**: 2026-08-06
**Version**: 0.2.0

---

## Phase 4 — The 1.0.0 cut (2026-08-07)

### D11. Cut `1.0.0` from `0.7.0`, not `0.7.1`

**Context**: sprint W33 closed with `0.7.0` and six registered read tools, then three
review fixes landed on `main` under `## [Unreleased]` with no version of their own. By
the diff alone that backlog is a patch — three `### Fixed` bullets, no tool added,
removed or renamed — so `0.7.1` is what semver would have assigned mechanically. The
open question was not how to number the diff but whether the tool surface underneath it
had stopped moving.

**Decision**: release it as `1.0.0`. `VERSION`, `package.json` and `src/config.ts`'s
`SERVER_VERSION` all move `0.7.0` → `1.0.0` in one commit, tagged `v1.0.0` and published
as a GitHub Release carrying the CHANGELOG entry. **The package is deliberately not
pushed to npm** — `latest` stays at `0.1.0` until a separate, explicit decision to
publish.

**Rationale**: a `0.x` version tells an integrator that any release may break them, and
that is no longer what this repo means. The six tools' names, their single `accountId`
argument, and their `structuredContent` shapes have been stable since each one shipped,
and the read-only posture means no tool can be made destructive without a new tool. `1.0.0`
states that promise where an integrator can act on it, and buys the cost of breaking it:
a `2.0.0`. Deferring to `0.7.1` would have kept a stable surface labelled unstable for
another sprint, with nothing in W34 (four remaining read tools) planning to break it.

**Alternatives considered**:
- `0.7.1` — mechanically correct for the diff, rejected: it re-affirms `0.x`'s "anything
  may break" for a surface that has not broken across six releases, and W34's remaining
  read tools are additive.
- `1.0.0` **plus** an npm publish, making the six tools reachable via `npx` — deferred,
  not rejected. Publishing changes what every existing `npx -y senti-mcp-server` config
  in the world resolves to, and `dist-tags latest: 0.1.0` has been the documented state
  in `README.md` since `0.2.0`; it is its own decision, not a side effect of numbering.

**Impact**: `VERSION`, `package.json`, `src/config.ts`; the `## [1.0.0]` CHANGELOG
section; the `As of v0.7.0` scope sentences in `README.md`, `docs/SETUP.md` and
`docs/README.md`; `AGENTS.md`'s current-state line. `README.md`'s "the published package
is still v0.1.0" paragraph stays **unchanged and true** — it is the npm claim, not the
repo version.

**Date**: 2026-08-07
**Version**: 1.0.0

---

### D12. Publish to npm as `1.0.1`, leaving `1.0.0` git-only (revision of D11)

**Context**: [D11](#d11-cut-100-from-070-not-071) deferred the npm publish as its own
decision rather than a side effect of numbering. That decision is now taken — publish.
But `1.0.0` had already shipped saying otherwise: its CHANGELOG entry reads "**Not
published to npm.** … This release is the git tag `v1.0.0` and its GitHub Release only",
CHANGELOG entries are never rewritten, and `README.md` — which is *inside* the tarball
and *is* the npm package page — told readers the published package was `0.1.0` and to
use a git checkout. A publish-readiness pass also found `dist/` carrying three outputs
whose sources were deleted in the `0.2.0` restructure, which `npm pack --dry-run`
confirmed would ship.

**Decision**: leave `1.0.0` unpublished exactly as its own entry describes, and cut
`1.0.1` as the version that reaches the registry. `1.0.1` fixes the build script to
clean `dist/` first, rewrites `README.md`'s install section around npm's `latest` tag,
and de-pins `docs/README.md`'s registry claim. `latest` moves `0.1.0` → `1.0.1`.

**Rationale**: a released CHANGELOG entry is a claim about the world at a version, and
the cheapest way to keep "not published to npm" true was to not publish that version.
The alternative — publishing a `1.0.0` tarball whose bundled CHANGELOG denies its own
existence, and whose README sends readers away from the package they just installed —
buys nothing and costs the reader's trust at the exact moment they are deciding whether
to install. A patch number is not scarce.

**Alternatives considered**:
- Publish `1.0.0` after fixing README and `dist/` in the working tree — rejected: the
  tarball would then differ from the `v1.0.0` tag it claims to be, and the entry's "git
  tag and GitHub Release only" sentence would be false in the very artifact carrying it.
- Publish `1.0.0` unchanged — rejected outright; it ships dead code and a package page
  stating the package lacks five of its six tools.
- Rewrite the `1.0.0` CHANGELOG entry to remove the "not published" wording — rejected:
  CHANGELOG entries are append-only in the same spirit as [RULE-7](#d7-no-active-context-block-in-this-repo),
  and this repo has already paid once for renumbering published history (see the
  `1.0.0` entry's third `### Fixed` bullet).

**Impact**: `VERSION`, `package.json` (`version` and the `build` script), `src/config.ts`;
the `## [1.0.1]` CHANGELOG section; `README.md`'s install section; `docs/README.md`'s
absent-file table. `v1.0.0` stays tagged and released on GitHub, unpublished on npm, in
perpetuity.

**Date**: 2026-08-07
**Version**: 1.0.1

---

## Phase 5 — Post-1.0.1 hygiene, pre-W34 (2026-08-10)

### D13. Scope vitest collection to `src/` with an `include` allowlist

**Context**: `npm test` was collecting 28 files / 394 tests against a package that owns
14 / 197. The surplus was `.claude/worktrees/read-tools-w33/`, a git worktree left after
`feat/read-tools-w33` merged at `66be3a4`, still checked out at `812f7e8` — two releases
behind `main`. `.claude/worktrees/` is gitignored, so `git status` showed nothing;
vitest's default `include` of `**/*.test.ts` from the project root, whose default
`exclude` covers `node_modules`/`dist`/`.git`/`.cache` but not `.claude`, read it as
source. The suite was green, so the duplication announced itself only as a test count
that no longer matched the W33 retrospective's. `prepublishOnly` ran the doubled suite as
well. Removing the worktree fixes today; this repo creates worktrees under that path as
its normal workflow, so it recurs by default.

**Decision**: add `vitest.config.ts` — the repo's first — setting
`include: ['src/**/*.test.ts']`. Also remove the stale worktree and its merged branch.
No `exclude` entry is added.

**Rationale**: an allowlist anchored at the project root fixes the class; a blacklist
entry for `.claude/**` fixes one path and leaves the next nested tree — a second
worktree root, a vendored checkout, an `examples/` copy — to be discovered the same way,
by noticing a number. Every test file this package owns lives in `src/` and there is no
plan for that to change, so the allowlist costs nothing in expressiveness. The guard was
verified by decoy rather than by reading the glob: a deliberately-failing
`.claude/worktrees/decoy/src/decoy.test.ts` left the count at 197 and the suite green,
then was deleted. A guard whose failure mode is silent needs evidence.

**Alternatives considered**:
- `exclude: [...defaultExclude, '**/.claude/**']` — rejected as above; it also requires
  importing and spreading `defaultExclude`, since a bare `exclude` overrides vitest's
  defaults and would silently re-admit `node_modules`.
- `--exclude '**/.claude/**'` on the `test` script — rejected: it misses `test:watch`,
  `test:smoke`, and any bare `npx vitest` an agent or contributor runs. The config file
  covers every invocation, which is the point.
- Remove the worktree and add no guard — rejected: worktree-per-feature is this repo's
  standard workflow, so the next sprint reproduces the defect, and its symptom is a
  green suite.

**Impact**: new `vitest.config.ts`; `npm test` goes 394 → 197 tests, 28 → 14 files, all
of the loss duplicate. No test or source file changes, and nothing publishable moves:
`files` in `package.json` is the allowlist `["dist", "src", "!src/**/*.test.ts"]`, which
a root-level config is not in — `npm pack --dry-run` confirms 42 files with
`vitest.config.ts` absent. So `VERSION` does not move and the change is recorded under
`## [Unreleased]` rather than as a release. New [LESSONS entry 3](LESSONS.md).

**Date**: 2026-08-10
**Version**: unreleased

---

## Phase 6 — W34 read-path completion (2026-08-10)

### D14. The last four read tools ship `1.1.0` → `1.4.0`, not the spec's `0.8.0` → `0.11.0`

**Context**: the [read-tool expansion design spec](superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
§Story plan assigns a version to every story it plans, and its last four rows read
`0.8.0`, `0.9.0`, `0.10.0`, `0.11.0`. That column was written on 2026-08-05, when the
shipped version was `0.1.0` and the growth path was one minor per tool inside a `0.x`
series. [D11](#d11-cut-100-from-070-not-071) then cut `1.0.0` from `0.7.0` and
[D12](#d12-publish-to-npm-as-101-leaving-100-git-only-revision-of-d11) published `1.0.1`,
which makes those four numbers unreachable — `0.8.0` is behind `1.0.1`, and npm's `latest`
would not move. W34 opens with four stories that each need a version in their frontmatter
and their CHANGELOG entry, so the discrepancy has to be resolved before the first one is
written rather than discovered at release time.

**Decision**: US-2.10 → US-2.13 ship `1.1.0`, `1.2.0`, `1.3.0` and `1.4.0` respectively.
The expansion spec is **not edited** — its `Ships` column stays as written, and this entry
is what a reader reconciles it against.

**Rationale**: each of the four adds a tool and changes no existing tool's behaviour,
which is the textbook additive minor under semver — the same shape `0.3.0` → `0.7.0` had
inside the `0.x` series, continued past the `1.0.0` boundary. Leaving the spec unedited
follows the precedent [D1](#d1-adopt-koni-docs-as-this-repos-documentation-framework) and
[D5](#d5-raise-the-supported-node-floor-to-2060) set twice: a planning artifact is a
snapshot of intent at a date, and this repository amends via CONTEXT rather than
rewriting one. Editing the column would also destroy the evidence that the plan predates
the `1.0.0` cut, which is the only thing that explains why it says `0.8.0` at all.

**Alternatives considered**:
- **Edit the spec's `Ships` column in place** — rejected per D1/D5: it makes the spec
  look as though it always knew about `1.0.0`, and silently discards the dating that
  makes the original numbers intelligible.
- **Ship the four as patches (`1.0.2` → `1.0.5`)** — rejected: each adds a tool, and a
  tool is a feature. A consumer pinned to `~1.0.1` would receive four new tools without
  a minor bump ever signalling that the surface grew.
- **Ship all four as a single `1.1.0` at sprint close** — rejected: it discards the
  one-version-per-story growth path EPIC-2 has followed since `0.1.0`, and it removes the
  ability to bisect a regression to one tool. The four are independently useful and
  independently revertible.

**Impact**: [sprint-2026-W34](sprints/sprint-2026-W34.md) and the four story files carry
`1.1.0` → `1.4.0` in their release tasks and Changelog entries.
[EPIC-2](sprints/epics/EPIC-2.md) §Remaining work already flagged the stale column and
now points here. No code changes; nothing ships from this entry alone.

**Date**: 2026-08-10
**Version**: unreleased
