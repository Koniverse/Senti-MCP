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

## Phase 2 — Read-tool expansion (2026-08-06)

### D7. Replace the flat `src/` layout with `core/` and `tools/<tag>/`

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

### D8. `registerReadTool` and `parseOrThrow`, not a descriptor table

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

### D9. Tools bind and shape their own payloads

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
