---
id: EPIC-5
title: "Supported runtime and dependency currency"
status: backlog
created: 2026-08-10
updated: 2026-08-10
---

## Goal

Keep this package's declared runtime support, and the versions its CI pins, true and
maintained — rather than correct-on-the-day-they-were-written and then quietly stale.
Today the floor is Node **20.6.0**, a line that reached end of life on **2026-04-30**;
the release workflow pins four jobs to versions chosen for four different reasons, only
three of which were ever right. This epic owns the decisions that keep those numbers
honest, and the reasoning that says which of them a user's compatibility depends on and
which are only CI's business.

## Overview

### Business context

Three separate incidents in EPIC-2 and EPIC-4 traced back to a version number that was
recorded once and never revisited, and none of them was caught by a test:

- **[CONTEXT D5](../../CONTEXT.md)** raised the floor from `>=20` to `>=20.6.0`, because
  `AbortSignal.any()` (Node 20.3.0) sits on the path of every tool call and `test:smoke`
  uses `--env-file` (20.6.0). The old floor failed in the worst available way: the server
  started, `tools/list` succeeded, and only an actual tool call produced
  `TypeError: AbortSignal.any is not a function`.
- **[LESSONS 4](../../LESSONS.md)** found `package-lock.json` eight releases behind on its
  version string, because nothing read it. `release:check` now does.
- **[LESSONS 7](../../LESSONS.md)** found the `publish` job pinned to that same consumer
  floor and therefore unable to host any npm capable of OIDC trusted publishing — an
  unsatisfiable job that shipped, passed review, and went unexecuted for a whole epic
  because the rehearsal path never reached it.

The last one is what opens this epic. It was fixed narrowly and correctly in `1.1.0` — the
`publish` job alone moved to Node 24.19.0 — but the fix deliberately left the larger
question untouched, because a CI unblock and a support-policy change are different
decisions and should not ride in one commit.

**The distinction this epic owns.** The number `20.6.0` appears in two kinds of place, and
they are not the same claim:

| Where | What it means | Who it binds |
|---|---|---|
| `package.json` `engines.node`, `README.md` §Requirements, `docs/SETUP.md` §1 | The **support floor** — what a user's machine must have | Consumers. Raising it is a breaking change for anyone below the new floor. |
| `node-version:` in `.github/workflows/release.yml` (`gate`, `build`, `verify`) | A **test choice** — run the suite and install the tarball on the exact floor, so the floor is proven rather than asserted | Nobody outside CI. Its only job is to make the row above true. |

Conflating the two is what produced LESSONS 7. A fourth job, `publish`, serves no consumer
at all and had no business on the floor.

### Out of scope

- **Anything that changes what the tools *do*.** This epic moves version numbers and the
  prose that states them. A story here that also adds a tool, changes a payload, or edits a
  formatter is two stories.
- **The MCP SDK's own version**, and dependency upgrades generally, *until* a story here
  says otherwise. Named in this epic's title as its eventual scope, but the first story is
  the Node floor and nothing else — see §Stories.
- **Re-litigating [CONTEXT D5](../../CONTEXT.md).** Its two reasons (`AbortSignal.any`,
  `--env-file`) still hold and still set the *minimum*. What this epic questions is whether
  the minimum is still the right floor now that the line behind it is unsupported — a
  different question with a different answer.

## Cross-cutting invariants

- **A floor is raised for a stated reason, never for tidiness.** D5 raised it because two
  APIs required it. An EOL date is also a reason. "Newer is better" is not, and a floor
  raised without one is a compatibility break bought with nothing.
- **Every version pinned in CI names the constraint it satisfies.** LESSONS 7's cheap check:
  for each pin, say what it has to be compatible with and confirm it is —
  `npm view <pkg>@<ver> engines` costs seconds and would have caught an unsatisfiable job
  before it merged.
- **A requirement written as a comment is not enforced.** `# npm 11.5.1+ is required for
  OIDC` sat one line above a step that could not install npm 11.5.1, for five stories.
- **The floor is proven, not asserted.** Whatever the floor becomes, at least one CI job
  runs the suite on exactly it and at least one installs the built tarball and spawns the
  binary on exactly it. That pairing is what `build` and `verify` do today and it must
  survive any change here.
- **Four files move together or none do.** `package.json` `engines.node`, `README.md`
  §Requirements, `docs/SETUP.md` §1, and the CI pins that prove them. `AGENTS.md` where it
  restates them. A floor stated in three places and enforced in one is the LESSONS 4 shape.

## Stories

| US | Title | Pri | Points | Status | Sprint |
|---|---|---|---|---|---|
| [US-5.1](../stories/US-5.1-node-floor-and-ci-pins.md) | Re-decide the supported Node floor, now that Node 20 is EOL | P2 | 3 | 📋 backlog | — |

Unassigned to a sprint deliberately. The `publish` job is unblocked as of `1.1.0`, so
nothing here is urgent, and [sprint-2026-W33](../sprint-2026-W33.md) §Phase 3 still carries
EPIC-2's last three stories against a window that closes 2026-08-16. Scheduling is the
maintainer's ([CONTEXT D21](../../CONTEXT.md)).

## Cross-references

- [CONTEXT D5](../../CONTEXT.md) — why the floor is 20.6.0, and the two APIs that set it
- [LESSONS 7](../../LESSONS.md) — the consumer floor applied to a job that serves no consumer
- [LESSONS 4](../../LESSONS.md) — a version string nothing reads drifts silently
- [EPIC-4](EPIC-4.md) — the release process, and the owner of `release.yml` before this epic
- [docs/RELEASE.md](../../RELEASE.md) — the runbook whose gate enforces version agreement
- [Node.js release schedule](https://github.com/nodejs/Release) — the authority for the EOL dates this epic reacts to
