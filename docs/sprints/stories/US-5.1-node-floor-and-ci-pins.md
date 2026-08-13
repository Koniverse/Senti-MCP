---
id: US-5.1
title: "Re-decide the supported Node floor, now that Node 20 is EOL"
epic: EPIC-5
status: done
priority: P2
points: 3
sprint: sprint-2026-W33
assignee: bluezdot
version_shipped: 2.0.0
created: 2026-08-10
updated: 2026-08-13
---

## Story refresh — 2026-08-13

The maintainer settled the two open questions in a planning pass, and the registry checks
[EPIC-5](../epics/EPIC-5.md) asks for were run ahead of implementation rather than during
it. §Background and the AC numbering below are left exactly as written on 2026-08-10; this
block records what changed.

**Locked:**

- **The floor is `>=22.11.0`** — the first LTS release of the Node 22 "Jod" line, supported
  until 2027-04-30. The reason is support lifetime, not a new API:
  [CONTEXT D5](../../CONTEXT.md)'s minimum of 20.6.0 is unchanged and still true.
- **`>=22.9.0` was rejected**, though it appears in §The candidates as the smallest floor
  satisfying npm 11's `engines`. It is not itself an LTS release, and the only argument for
  it is an npm constraint that binds no consumer. 22.11.0 is above it, so the constraint is
  satisfied anyway.
- **`>=24.15.0` was rejected** — it buys runway by cutting Node 22 users, a line supported
  for another 20 months.
- **The release is `2.0.0`** (AC-6). Narrowing the declared support contract is a breaking
  change by ecosystem convention even though nothing a consumer runs actually breaks:
  `engine-strict` defaults to `false`, so `npx` on Node 20 warns `EBADENGINE` and runs. This
  does not consume a version EPIC-3 needs — write tools behind an opt-in switch are additive.
- **CI: `gate`, `build`, `verify` → 22.11.0. `publish` stays 24.19.0**, and its
  `npm install -g npm@11.19.0` step is **deleted** — AC-4's first arm. 24.19.0 bundles npm
  11.17.0, which is already ≥ 11.5.1.

**Correction to §Background.** "What raising it would simplify" claims that at `>=22.9.0`
or higher all four jobs can share one pin **and** the global npm install can be deleted.
That is wrong, and acting on it would break `publish`. The whole Node 22 line bundles npm
**10.x** — 22.9.0 ships 10.8.3, 22.11.0 ships 10.9.0, 22.22.2 ships 10.9.7. At a Node 22
floor you get one of the two, never both: either every job shares the 22.11.0 pin and
`publish` keeps a pinned global npm install, or `publish` stays on 24.x and the step goes
away. Deleting the step requires ≥ **24.15.0** (npm 11.12.1). The decision above takes the
second option. Fix this paragraph when the story is implemented.

**AC-2 counts one artifact too many.** It names four files; `AGENTS.md` does not state the
floor anywhere (`grep -n "20\.6\.0" AGENTS.md` is empty). The live set is three:
`package.json`, `README.md` §Requirements, and `docs/SETUP.md` §1 — which holds it in three
separate spots (the prerequisites table row, the `node --version` comment, and the
`AbortSignal.any` troubleshooting row). Do not add a fourth mention in order to satisfy the
AC. `AGENTS.md` is still touched by this story, for the version and for the stale
"Current state" block described below.

**AGENTS.md is stale, and this story fixes it.** Line 20 reads `Current state: 1.3.0`, line
22 says **Nine** tools, and line 41 says "**One** read operation remains —
`get_equity_timeseries`". [src/server.ts](../../../src/server.ts) registers **ten** and
`1.4.0` shipped on 2026-08-12; [US-2.13](US-2.13-get-equity-timeseries-tool.md) closed
without updating the block. Folded in here because this story has to edit that same line to
`2.0.0` regardless — scope deliberately widened, and said out loud rather than done quietly.

**Registry evidence, gathered 2026-08-13** (AC-5's check, run early):

| Checked | Result |
|---|---|
| `npm view npm@11.17.0 engines` · `npm@11.19.0` | both `^20.17.0 \|\| >=22.9.0` |
| Bundled npm per Node | 20.6.0 → 9.8.1 · 22.9.0 → 10.8.3 · **22.11.0 → 10.9.0** · 24.15.0 → 11.12.1 · **24.19.0 → 11.17.0** |
| `v22.11.0` LTS status | first `lts: "Jod"` release on the 22 line |
| Every dependency's `engines.node` | nothing demands above Node 20 — `@modelcontextprotocol/server@2.0.0` `>=20`, `vitest@3` `^18 \|\| ^20 \|\| >=22`, `typescript` `>=14.17`, `tsx` `>=18`, `zod` undeclared |

That last row largely discharges TASK-5.1.2: no dependency added since D5 has raised the
real minimum. The task still owns re-checking the *code* for a newer API than
`AbortSignal.any`, which a dependency scan cannot see.

**Scheduled** into [sprint-2026-W33](../sprint-2026-W33.md) §Phase 4, which also lifted the
"run it after EPIC-2 closes" constraint in §Cross-story dependencies — EPIC-2 closed
2026-08-12.

## Goal

Decide, with the evidence written down, whether this package still supports Node 20 — and
if not, move the floor and every artifact that states it in one commit. The current floor
of `>=20.6.0` points at a release line that stopped receiving security patches on
**2026-04-30**. That is a support decision, not a compatibility bug: nothing in the code
needs a newer runtime, so the answer is not obvious and the story is to reach one, not to
assume it.

## Background

**Why the floor is 20.6.0 today.** [CONTEXT D5](../../CONTEXT.md) set it, for two reasons
that still hold: `AbortSignal.any()` (Node 20.3.0) sits on the path of every tool call
through [client.ts:206](../../../src/core/client.ts), and `npm run test:smoke` uses
`node --env-file` (20.6.0). Those two APIs set the **minimum**. What has changed is that
the minimum now names an unsupported line — a different question from the one D5 answered,
and the reason this story exists rather than a revision to D5.

**Why it surfaced now.** [LESSONS 7](../../LESSONS.md): the release workflow's `publish`
job pinned that same consumer floor and could not host any npm capable of OIDC trusted
publishing (npm ≥ 11.5.1, whose own `engines.node` is `^20.17.0 || >=22.9.0`). The job was
unsatisfiable for every npm version, and it went unnoticed for a whole epic because the
`v9.9.9` rehearsal fails at the gate by design and never reached it. `1.1.0` fixed that
**narrowly and on purpose** — the `publish` job alone moved to Node 24.19.0 with npm pinned
to `11.19.0` — so that a CI unblock and a support-policy change did not ride in one commit.
This story is the second half.

**The candidates**, with the Node release schedule as the authority:

| Floor | Supported until | Unblocks npm 11+ | Cost |
|---|---|---|---|
| `>=20.6.0` (today) | **2026-04-30 — already past** | No | None, but the floor names a line receiving no security patches |
| `>=20.17.0` | 2026-04-30 — already past | Yes | Minimal change, and still an EOL line. Almost certainly the wrong answer; listed because it is the smallest edit that would have prevented LESSONS 7, and rejecting it should be deliberate |
| `>=22.9.0` | 2027-04-30 | Yes | Drops Node 20 and 21 users |
| `>=24.15.0` | 2028-04-30 | Yes, and Node 24 already bundles npm 11.17.0 | Drops Node 20–23 users; longest runway |

**What raising it would simplify.** *Corrected during implementation on 2026-08-13; this
paragraph originally claimed that at `>=22.9.0` or higher all four jobs could share one pin
**and** the `npm install -g npm@…` step could be deleted. That is wrong, and acting on it
would have broken `publish` — see the refresh block above.*

At a Node 22 floor you get **one of the two, never both**. The whole Node 22 line bundles
npm **10.x** (22.9.0 → 10.8.3, 22.11.0 → 10.9.0), and OIDC trusted publishing needs npm
≥ 11.5.1. So either every job shares the 22.11.0 pin and `publish` keeps a pinned global
npm install, or `publish` stays on 24.x and the step goes away; deleting the step requires
≥ **24.15.0** (npm 11.12.1). The decision takes the second option. Either way this is a
*consequence* of the floor decision, not an argument for it.

## Acceptance criteria

- [x] **AC-1** — **Given** the Node release schedule and this package's actual API usage,
  **When** the floor is decided, **Then** a [CONTEXT](../../CONTEXT.md) entry records the
  choice, names the rejected candidates with reasons, and states explicitly that it extends
  rather than overturns [D5](../../CONTEXT.md) — D5's two APIs still set the minimum, and
  RULE-7 makes CONTEXT append-only.
- [x] **AC-2** — **Given** a decision to raise the floor, **When** it is applied, **Then**
  `package.json` `engines.node`, `README.md` §Requirements, `docs/SETUP.md` §1 and
  `AGENTS.md` where it restates the floor all carry the same number in the **same commit**,
  and no file in the repo still asserts the old one. **Given** a decision to leave it,
  **Then** AC-2 through AC-5 are struck and the CONTEXT entry from AC-1 is the whole
  deliverable.
- [x] **AC-3** — **Given** the new floor, **When** CI runs, **Then** at least one job runs
  the full suite on exactly that version **and** at least one installs the built tarball and
  spawns the binary on exactly that version — the pairing `build` and `verify` do today. A
  floor no job runs on is asserted, not proven.
- [x] **AC-4** — **Given** the new floor is ≥ 22.9.0, **When** the `publish` job is
  revisited, **Then** either the `npm install -g` step is deleted because the bundled npm
  already satisfies OIDC trusted publishing, or it is kept **pinned** with a comment naming
  the ≥ 11.5.1 constraint. Never `@latest` — that is what [LESSONS 7](../../LESSONS.md)
  cost.
- [x] **AC-5** — **Given** every version pinned in `.github/workflows/release.yml`, **When**
  this story closes, **Then** each pin has been checked against the constraint it must
  satisfy — `npm view <pkg>@<ver> engines` — and the check is recorded in §Implementation
  notes. This is [LESSONS 7](../../LESSONS.md)'s cheap check applied to every pin, not only
  the one that broke.
- [x] **AC-6** — **Given** raising `engines.node`, **When** the release version is chosen,
  **Then** the story states whether this is a breaking change under semver for this package
  and versions accordingly, rather than defaulting to a minor because the diff looks small.

## Tasks

- [x] **TASK-5.1.1** — Establish what the change actually costs a user (AC: 6)
  - [x] Determine how npm enforces `engines.node` for a consumer installing this package:
        `engine-strict` defaults to `false` locally, and the failure that produced
        [LESSONS 7](../../LESSONS.md) was a hard `EBADENGINE` — but that was npm installing
        *itself* globally, which is not the same path. Test the consumer path in a clean
        directory on an under-floor Node before claiming either "it only warns" or "it
        breaks".
  - [x] Decide the release type from that finding, and record it.
- [x] **TASK-5.1.2** — Confirm the code's real minimum has not moved since D5 (AC: 1)
  - [x] Re-check the two APIs D5 named and look for any newer one that has crept in since:
        the floor must not already be higher than it claims. `AbortSignal.any` (20.3.0),
        `node --env-file` (20.6.0) — plus anything added by the six tools that shipped after
        D5 was written.
- [x] **TASK-5.1.3** — Make the decision and write it up (AC: 1)
  - [x] CONTEXT entry: chosen floor, rejected candidates with reasons, and the explicit
        statement that D5's minimum is unchanged and this is a support-lifetime decision on
        top of it.
- [x] **TASK-5.1.4** — Apply it across the four artifacts, if raising (AC: 2)
  - [x] `package.json` `engines.node`; `README.md` §Requirements; `docs/SETUP.md` §1
        (including the `node --version` line and the `AbortSignal.any` troubleshooting row);
        `AGENTS.md`. One commit.
- [x] **TASK-5.1.5** — Re-pin CI and re-verify every pin (AC: 3, 4, 5)
  - [x] `gate`, `build`, `verify` to the new floor; `publish` per AC-4.
  - [x] Run `npm view <pkg>@<ver> engines` for every pinned version and record the results.
  - [x] Confirm the suite and `release:verify-pack` pass on the new floor **before** the pins
        are pushed — a floor that CI cannot run on is discovered at tag time otherwise, which
        is exactly the [LESSONS 7](../../LESSONS.md) shape.

## Dev notes

### Architecture constraints

- **Two kinds of number, one epic.** [EPIC-5](../epics/EPIC-5.md) §Business context has the
  table: `engines.node` / README / SETUP bind consumers; `node-version:` in CI binds nobody
  and exists only to prove the first group true. A change to one is not automatically a
  change to the other — `1.1.0` moved a CI pin without touching the floor, deliberately.
- **The published artifact does not depend on the Node that built it.** `tsconfig` sets
  `target: ES2022` / `lib: ES2023`, so `tsc` emits the same JavaScript regardless of host.
  Raising the Node a CI job runs on changes nothing a user receives, which is what made
  `1.1.0`'s narrow fix safe.
- **`release:check` enforces version agreement across five files, and the Node floor is in
  none of them.** It checks `VERSION`, `package.json`, `package-lock.json`, `SERVER_VERSION`
  and the tag. A floor stated in four places with nothing comparing them is the
  [LESSONS 4](../../LESSONS.md) shape; whether to extend the gate is worth raising here even
  if the answer is no.

### Cross-story dependencies

- **Follows** [US-4.5](US-4.5-release-workflow.md) — which built `release.yml`, and whose
  `publish` job carried the defect [LESSONS 7](../../LESSONS.md) records.
- **Blocks nothing.** The `publish` job is unblocked as of `1.1.0`; this story is
  maintenance, which is why it carries no sprint.
- **Touches files [US-2.11](US-2.11-list-deals-tool.md) → [US-2.13](US-2.13-get-equity-timeseries-tool.md) also touch**
  (`package.json`, `README.md`). Cheap to sequence after EPIC-2 closes; not a hard
  dependency, but running it mid-Phase-3 buys a merge conflict for no reason.

### What we explicitly did NOT do

- **Did not fold this into `1.1.0`'s fix.** A job that could not run and a support policy
  that is out of date are different problems with different blast radii. The first blocks a
  release; the second is a decision that deserves its own CONTEXT entry and its own review.
- **Did not assume "raise it" is the answer.** Nothing in the code needs newer than 20.6.0.
  The argument is support lifetime, and the cost is real users; AC-2's second clause makes
  "leave it, and say why" a legitimate outcome of this story rather than a failure to
  deliver.

### References

- [Source: CONTEXT D5](../../CONTEXT.md) — the current floor and the two APIs behind it
- [Source: LESSONS 7](../../LESSONS.md) — the consumer floor applied to a job serving no consumer
- [Source: EPIC-5](../epics/EPIC-5.md) — the two-kinds-of-number distinction, and the invariants
- [Node.js release schedule](https://github.com/nodejs/Release) — EOL dates: v20 2026-04-30, v22 2027-04-30, v24 2028-04-30
- [docs/RELEASE.md](../../RELEASE.md) — the gate this story must not break

## Verification commands

> Drafted before the work exists. Per [LESSONS 2](../../LESSONS.md), every row is run and
> confirmed non-vacuous before this story closes, and corrected here if it turns out dead.

All five rows were run on 2026-08-13 and all five are non-vacuous. Two are **corrected**
below against what was drafted; the corrections are marked.

| AC | Command | Result |
|---|---|---|
| AC-2 | `grep -rn "22\.11\.0" --include="*.md" --include="*.json" --include="*.yml" . \| grep -v node_modules` | **Corrected.** The drafted row greps the *old* number and expects "only historical references" — but after the change, `README.md`, `docs/SETUP.md`, `CHANGELOG` and `CONTEXT` all mention `20.6.0` legitimately while *explaining* the move, so the row cannot distinguish a stale assertion from a correct explanation. Greping the **new** number and confirming it reaches all three binding artifacts plus the CI pins is the check that actually discriminates. Passes: `package.json`, `package-lock.json`, `README.md`, `docs/SETUP.md` ×3, and `release.yml`'s 3 `node-version` pins. |
| AC-2 | `node -p "require('./package.json').engines"` | `{ node: '>=22.11.0' }` |
| AC-3 | `npm test && npm run release:verify-pack` on Node 22.11.0 exactly | `19 passed \| 1 skipped (20 files)`, `428 passed \| 1 skipped (429 tests)`; verify-pack packs, installs into a clean directory, spawns the binary, and matches 10 tools against the packaged README |
| AC-5 | `npm view npm@<pinned> engines.node` for every pin | **Corrected.** After the `npm install -g` step was deleted there is no pinned *npm package* left in `release.yml` — the row as drafted has nothing to read and would exit vacuously. What the workflow now pins is Node versions and action SHAs, so the check became `curl -s https://nodejs.org/dist/index.json` for the bundled npm and LTS status of each pin. Table in §Implementation notes. |
| all | `npm run release:check` | 9 of 10 checks pass; the only failure is `working tree — not clean`, which is expected before the commit and is the gate doing its job |

## Changelog entry

### Changed
- **The supported Node floor is now `>=22.11.0`**, up from `>=20.6.0` — the first LTS
  release of the Node 22 "Jod" line, supported until 2027-04-30. The reason is **support
  lifetime, not a new API**: Node 20 reached end of life on 2026-04-30, while
  [CONTEXT D5](CONTEXT.md)'s minimum is unchanged and still true — the newest runtime APIs
  in use remain `AbortSignal.timeout` (17.3.0), `AbortSignal.any` (20.3.0) and
  `node --env-file` (20.6.0), and no dependency demands above Node 20.
  **What it costs a user, measured:** `engine-strict` defaults to `false`, so below the
  floor npm *warns and installs* — on Node 20.19.4 the `2.0.0` tarball produced
  `npm warn EBADENGINE`, exit code 0, and the installed binary served `tools/list` with all
  ten tools. Only `engine-strict=true` refuses. Pin `senti-mcp-server@1.4.0` to stay on
  Node 20; it carries the same ten tools. Released as `2.0.0` because narrowing a declared
  support contract is a breaking change by convention ([CONTEXT D27](CONTEXT.md)).
- **`gate`, `build` and `verify` re-pin to 22.11.0**, keeping the floor *proven* rather than
  asserted. **`publish` stays on 24.19.0 and its `npm install -g npm@11.19.0` step is
  deleted** — 24.19.0 bundles npm 11.17.0, already above OIDC's 11.5.1.
- `AGENTS.md`'s "Current state" block is brought current — it still read `1.3.0`, **nine**
  tools and "one read operation remains", three days after `1.4.0` shipped the tenth.

## Implementation notes

### The decision, and what actually changed

The floor is **`>=22.11.0`**, released as **`2.0.0`**, recorded as
[CONTEXT D27](../../CONTEXT.md). Everything the refresh block locked was implemented
unchanged; nothing about the plan needed revisiting during the work.

### TASK-5.1.1 — what the change costs a consumer, measured rather than assumed

The task explicitly refused to accept either "it only warns" or "it breaks" without a test,
because the failure behind [LESSONS 7](../../LESSONS.md) was npm installing **itself**
globally — a different code path from a consumer installing this package. So the real
`2.0.0` tarball was packed and installed into a clean directory on Node **20.19.4**:

| Condition | Result |
|---|---|
| `engine-strict` unset (npm's default) | `npm warn EBADENGINE Unsupported engine … required: { node: '>=22.11.0' }`, **exit 0**, 4 packages added |
| Then spawn the installed binary on 20.19.4 | **Works.** `senti-mcp-server 2.0.0 ready`, `initialize` answered, `tools/list` returned all ten tools |
| `engine-strict=true` in `.npmrc` | `npm error code EBADENGINE`, install **refused** |

So nothing a consumer runs actually breaks below the floor — the code genuinely still runs
on 20.6.0+. What changes is the **declared contract** and what CI tests. That is what makes
this a support-policy decision rather than a compatibility fix, and AC-6 is why the release
type was chosen from the contract instead of from the size of the diff: **`2.0.0`**.

### TASK-5.1.2 — the code's real minimum has not moved since D5

A scan of all of `src/` and `scripts/` for post-20.6.0 runtime APIs — `Object.groupBy`,
`Promise.withResolvers`, `Array.fromAsync`, `Set.prototype.union`, `util.styleText`,
`fs.glob`, `import.meta.dirname`/`filename`, `process.loadEnvFile`, `RegExp.escape` and the
`toSorted`/`toReversed`/`toSpliced` family — returned **no hits**. The one apparent match,
`.union(` in `breakdowns.ts:47`, is `z.union` from zod, not `Set.prototype.union`.

What the code actually uses is unchanged: `AbortSignal.timeout` (17.3.0) and
`AbortSignal.any` (20.3.0) at [client.ts:196-206](../../../src/core/client.ts), and
`node --env-file` (20.6.0) in `test:smoke`. D5's minimum stands. The dependency half of this
task was already discharged by the refresh block's registry table.

### TASK-5.1.5 — every pin re-checked against the constraint it must satisfy

[LESSONS 7](../../LESSONS.md)'s cheap check, applied to every pin rather than only the one
that broke. Verified 2026-08-13 against `https://nodejs.org/dist/index.json`, the
authoritative source, rather than against the `npm view` figures quoted in the refresh
block:

| Pin | Job | Constraint it must satisfy | Verified |
|---|---|---|---|
| Node `22.11.0` | `gate`, `build`, `verify` | ≥ the code's real minimum (20.6.0), and an LTS line still supported | ✅ `lts: "Jod"`, and confirmed the **first** LTS release on the 22 line; supported to 2027-04-30. Suite + `release:verify-pack` both green on exactly it |
| Node `24.19.0` | `publish` | Must bundle npm ≥ 11.5.1 for OIDC trusted publishing, **without** a global npm install | ✅ bundles npm **11.17.0** (`lts: "Krypton"`) — 11.17.0 ≥ 11.5.1, so the step is unnecessary |
| `actions/checkout@fbc6f39…` | all | Unchanged by this story; pinned by SHA | — not touched |
| `actions/setup-node@a0853c2…` | all | Unchanged by this story; pinned by SHA | — not touched |

Two figures from the refresh block were worth re-confirming and both held: **22.11.0 bundles
npm 10.9.0** (so the Node 22 line cannot host OIDC, which is why `publish` stays on 24.x),
and **22.9.0 is `lts: false`** — the independent confirmation of why it was rejected.

**The order matters and was followed**: the suite and `release:verify-pack` were confirmed
green on 22.11.0 *before* the pins were changed. A floor CI cannot run on is otherwise
discovered at tag time, which is exactly the LESSONS 7 shape.

### AC-4 took its first arm, and the comment block is now load-bearing

The `npm install -g npm@11.19.0` step is **deleted**, not kept-and-pinned. `publish` drops
from 5 steps to 4. This matters beyond tidiness: LESSONS 7's second bullet is that *a
requirement written as a comment is not enforced* — `# npm 11.5.1+ is required for OIDC` sat
one line above a step that could not install npm 11.5.1, for five stories. The requirement
is now satisfied by the **runtime pin itself**, so there is no longer a comment making a
claim that a step has to independently honour. The rewritten comment says what would break
it: a Node bump that drops the bundled npm below 11.5.1 would silently un-OIDC the job.

The workflow was parsed as YAML after editing to confirm the deletion did not damage
structure — 5 jobs, `gate`/`build`/`verify` on 22.11.0, `publish` on 24.19.0, and zero
`npm install -g` steps remaining.

### Scope widened twice, both said out loud

1. **`AGENTS.md`'s stale "Current state" block**, as the refresh block planned: `1.3.0` →
   `2.0.0`, **Nine** → **Ten** tools with `get_equity_timeseries` and its D26 note added,
   "One read operation remains" replaced by EPIC-2's close, and the clean-run figure
   refreshed from `19 files / 376 tests` to the measured `20 files / 429 tests, 1 skipped`.
2. **Two test fixtures** (`src/release-check.test.ts`, `src/release-verify-pack.test.ts`)
   carried `Node.js >= 20.6.0` inside synthetic README strings. They are inert — neither is
   asserted against — and they sit outside AC-2's drafted grep, which covers only `*.md` and
   `*.json`. They were updated anyway so that a floor grep over `src/` stays clean for
   [US-5.2](US-5.2-release-check-guards-the-node-floor.md), which is about to teach
   `release:check` to read the floor. Full suite re-run green afterwards.

### What was deliberately left alone

- **`docs/superpowers/plans/2026-08-06-senti-read-tools-w33.md`** still reads `Node ≥ 20.6.0`.
  Planning artifacts are snapshots of intent and are not retro-edited — the precedent D5's
  own §Impact set, and D1 before it.
- **`@types/node` stays at `^22.10.0`.** The floor's major is now 22 and the types already
  track it, but the rule that binds them is
  [US-5.3](US-5.3-devdependency-currency-and-dependabot.md)'s to state.
- **`release:check` still does not read the Node floor.** It compares five *version* strings
  and none of them is the floor, so the floor is stated in three places and enforced in one —
  the [LESSONS 4](../../LESSONS.md) shape, and now the single largest drift risk this story
  leaves behind. §Architecture constraints asked whether to extend the gate here; the answer
  is no, because [US-5.2](US-5.2-release-check-guards-the-node-floor.md) is that story and
  splitting it would put a policy change and a gate change in one commit — the same mistake
  `1.1.0` deliberately avoided.

## Files modified

**The floor — three binding artifacts, one commit** (the AC-2 set; `AGENTS.md` states no
floor, so it is not a fourth):

- `package.json` — `engines.node` `>=20.6.0` → `>=22.11.0`; `version` → `2.0.0`
- `README.md` — §Requirements rewritten to lead with the support-lifetime reason and keep
  D5's two APIs as the *minimum*; the `npx`/pin paragraph moved to `2.0.0` and now names
  `1.4.0` as the version to pin for Node 20
- `docs/SETUP.md` — §1 prerequisites row, the `node --version` comment, and the
  `AbortSignal.any` troubleshooting row (all three spots)

**CI:**

- `.github/workflows/release.yml` — `gate`, `build`, `verify` 20.6.0 → 22.11.0; `publish`
  keeps 24.19.0 and **loses** its `npm install -g npm@11.19.0` step; the publish comment
  block rewritten to explain why a Node 22 floor does not collapse the four pins into one

**The `2.0.0` release — the five places the version lives:**

- `VERSION` → `2.0.0`
- `package.json` `version` → `2.0.0` (above)
- `package-lock.json` — both `version` fields and the root `engines.node`, hand-edited to
  those three lines rather than regenerated: `npm install --package-lock-only` pulled in 69
  lines of unrelated bundled optional-dep churn, which is US-5.3's scope, not this story's
- `src/config.ts` `SERVER_VERSION` → `2.0.0`
- the `v2.0.0` git tag — cut at release time, not here

**Docs:**

- `docs/CONTEXT.md` — **D27** appended under a new `## Phase 4` heading (append-only, RULE-7)
- `docs/CHANGELOG.md` — the `## [2.0.0]` section
- `AGENTS.md` — "Current state" block and the clean-run test figure
- `docs/sprints/stories/US-5.1-…` — §Background's wrong paragraph corrected in place as the
  refresh block instructed, plus ACs, tasks, verification results and these notes

**Tests (fixture strings only, no assertion changed):**

- `src/release-check.test.ts`, `src/release-verify-pack.test.ts`

## Cross-references

- [Epic EPIC-5](../epics/EPIC-5.md)
- [CONTEXT D5](../../CONTEXT.md) · [LESSONS 7](../../LESSONS.md) · [LESSONS 4](../../LESSONS.md)
- [US-4.5](US-4.5-release-workflow.md) — the workflow this story re-pins
