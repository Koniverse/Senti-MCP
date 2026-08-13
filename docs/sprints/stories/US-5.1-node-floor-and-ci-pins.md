---
id: US-5.1
title: "Re-decide the supported Node floor, now that Node 20 is EOL"
epic: EPIC-5
status: backlog
priority: P2
points: 3
sprint: sprint-2026-W33
assignee: bluezdot
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

**What raising it would simplify.** At `>=22.9.0` or higher, all four workflow jobs can
share one pin, and the `npm install -g npm@…` step in `publish` can be deleted rather than
maintained — Node 24 bundles an npm that already satisfies OIDC. That is a real reduction
in moving parts, but it is a *consequence* of the decision, not an argument for it.

## Acceptance criteria

- [ ] **AC-1** — **Given** the Node release schedule and this package's actual API usage,
  **When** the floor is decided, **Then** a [CONTEXT](../../CONTEXT.md) entry records the
  choice, names the rejected candidates with reasons, and states explicitly that it extends
  rather than overturns [D5](../../CONTEXT.md) — D5's two APIs still set the minimum, and
  RULE-7 makes CONTEXT append-only.
- [ ] **AC-2** — **Given** a decision to raise the floor, **When** it is applied, **Then**
  `package.json` `engines.node`, `README.md` §Requirements, `docs/SETUP.md` §1 and
  `AGENTS.md` where it restates the floor all carry the same number in the **same commit**,
  and no file in the repo still asserts the old one. **Given** a decision to leave it,
  **Then** AC-2 through AC-5 are struck and the CONTEXT entry from AC-1 is the whole
  deliverable.
- [ ] **AC-3** — **Given** the new floor, **When** CI runs, **Then** at least one job runs
  the full suite on exactly that version **and** at least one installs the built tarball and
  spawns the binary on exactly that version — the pairing `build` and `verify` do today. A
  floor no job runs on is asserted, not proven.
- [ ] **AC-4** — **Given** the new floor is ≥ 22.9.0, **When** the `publish` job is
  revisited, **Then** either the `npm install -g` step is deleted because the bundled npm
  already satisfies OIDC trusted publishing, or it is kept **pinned** with a comment naming
  the ≥ 11.5.1 constraint. Never `@latest` — that is what [LESSONS 7](../../LESSONS.md)
  cost.
- [ ] **AC-5** — **Given** every version pinned in `.github/workflows/release.yml`, **When**
  this story closes, **Then** each pin has been checked against the constraint it must
  satisfy — `npm view <pkg>@<ver> engines` — and the check is recorded in §Implementation
  notes. This is [LESSONS 7](../../LESSONS.md)'s cheap check applied to every pin, not only
  the one that broke.
- [ ] **AC-6** — **Given** raising `engines.node`, **When** the release version is chosen,
  **Then** the story states whether this is a breaking change under semver for this package
  and versions accordingly, rather than defaulting to a minor because the diff looks small.

## Tasks

- [ ] **TASK-5.1.1** — Establish what the change actually costs a user (AC: 6)
  - [ ] Determine how npm enforces `engines.node` for a consumer installing this package:
        `engine-strict` defaults to `false` locally, and the failure that produced
        [LESSONS 7](../../LESSONS.md) was a hard `EBADENGINE` — but that was npm installing
        *itself* globally, which is not the same path. Test the consumer path in a clean
        directory on an under-floor Node before claiming either "it only warns" or "it
        breaks".
  - [ ] Decide the release type from that finding, and record it.
- [ ] **TASK-5.1.2** — Confirm the code's real minimum has not moved since D5 (AC: 1)
  - [ ] Re-check the two APIs D5 named and look for any newer one that has crept in since:
        the floor must not already be higher than it claims. `AbortSignal.any` (20.3.0),
        `node --env-file` (20.6.0) — plus anything added by the six tools that shipped after
        D5 was written.
- [ ] **TASK-5.1.3** — Make the decision and write it up (AC: 1)
  - [ ] CONTEXT entry: chosen floor, rejected candidates with reasons, and the explicit
        statement that D5's minimum is unchanged and this is a support-lifetime decision on
        top of it.
- [ ] **TASK-5.1.4** — Apply it across the four artifacts, if raising (AC: 2)
  - [ ] `package.json` `engines.node`; `README.md` §Requirements; `docs/SETUP.md` §1
        (including the `node --version` line and the `AbortSignal.any` troubleshooting row);
        `AGENTS.md`. One commit.
- [ ] **TASK-5.1.5** — Re-pin CI and re-verify every pin (AC: 3, 4, 5)
  - [ ] `gate`, `build`, `verify` to the new floor; `publish` per AC-4.
  - [ ] Run `npm view <pkg>@<ver> engines` for every pinned version and record the results.
  - [ ] Confirm the suite and `release:verify-pack` pass on the new floor **before** the pins
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

| AC | Command |
|---|---|
| AC-2 | `grep -rn "20\.6\.0" --include="*.md" --include="*.json" . \| grep -v node_modules \| grep -v package-lock` — expect only historical references (CHANGELOG, CONTEXT, closed stories) |
| AC-2 | `node -p "require('./package.json').engines"` |
| AC-3 | `npm test && npm run release:verify-pack` on the new floor |
| AC-5 | `npm view npm@<pinned> engines.node` for every pin in `release.yml` |
| all | `npm run release:check` |

## Changelog entry

### Changed
- **The supported Node floor is now `>=X.Y.Z`** — to be written when the decision is made.
  State the reason (support lifetime, not a new API), what it costs a user, and that
  [CONTEXT D5](CONTEXT.md)'s minimum is unchanged.

## Implementation notes

<!-- Filled during implementation. -->

## Files modified

<!-- Filled during implementation. -->

## Cross-references

- [Epic EPIC-5](../epics/EPIC-5.md)
- [CONTEXT D5](../../CONTEXT.md) · [LESSONS 7](../../LESSONS.md) · [LESSONS 4](../../LESSONS.md)
- [US-4.5](US-4.5-release-workflow.md) — the workflow this story re-pins
