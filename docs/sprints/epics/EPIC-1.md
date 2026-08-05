---
id: EPIC-1
title: "Project foundation: documentation framework and repo standard"
status: done
created: 2026-08-05
updated: 2026-08-05
---

## Goal

Give this repo a durable record of what shipped and why, so that work on the Senti
Quant Public API surface — one tool today, seventeen operations eventually — leaves
behind decisions a future maintainer can reconstruct. Downstream epics get to stop
worrying about *where* a decision, a changelog entry, or an acceptance criterion
belongs.

## Overview

### Business context

Before this epic the repo held two documents and no code: a design spec and a v1
implementation plan, both produced by the Superpowers brainstorm → plan pipeline and
both sitting under `docs/superpowers/`. Useful artifacts, but a spec and a plan are
snapshots of intent at one moment. Neither records what actually shipped, neither
survives a change of mind except by being rewritten, and neither tells an agent
joining the repo what the current state of play is.

This epic adds the *governance* layer: the `koni-docs` framework, its rules, its CLI,
and a corpus with the v1 build sitting in it as forward stories. It is deliberately a
day-0 epic. The koni-docs core rule is that every code-shipping commit updates docs in
the same commit, and that can only hold from the first code commit onward — which is
why this lands before `src/` exists rather than after.

It changes no runtime behaviour, because there is no runtime yet.

### Feature pillars

| # | Pillar | Stories | Purpose |
|---|---|---|---|
| 1 | **Framework adoption** | [US-1.1](../stories/US-1.1-adopt-koni-docs-framework.md) | Vendor the skill, wire the CLI, create the corpus, wire the agent surface |

### Out of scope

- **`koni-harness` commit gate** — deferred. Its `install-gate.sh` chains git hooks
  that mechanically enforce what this epic's pre-commit checklist currently only asks
  for. Worth revisiting once `src/` exists and the checklist has something to guard;
  installing it against an empty repo guards nothing.
- **`koni-qc`** — deferred. It owns `docs/tests/` and the security-review workflow.
  Relevant later: the design spec already flags an SSRF surface arriving with the first
  path parameter, and defers all eight write operations.
- **`PRD.md` and `ARCHITECTURE.md`** — deferred, not rejected. See
  [CONTEXT D1](../../CONTEXT.md). They land when the read-tool roadmap firms up.
- **The BMAD skill pack** — `skill-inventory.md` lists it as baseline for Koniverse
  repos. Superpowers already fills the planning role here.
- **All MCP server behaviour** — owned by [EPIC-2](EPIC-2.md).

## Cross-cutting invariants

Constraints every story in this epic upholds, and that later epics inherit:

- **English only** for code, comments, errors, commits, and docs (RULE-13).
- **`STATUS.md` is generated**, never hand-edited (RULE-5).
- **`CONTEXT.md` is append-only** (RULE-7). A reversal is a new entry citing the old.
- **No commit SHA inside the commit that would contain it** (RULE-2). Backfill in a
  follow-up; never `--amend`.
- **Skill files stay byte-identical to upstream.** The vendored copy is a mirror, not
  a fork — verified by `diff -rq` against the source, not by reading it.

## Story index

| US | Title | Pri | Points | Status |
|---|---|---|---|---|
| [US-1.1](../stories/US-1.1-adopt-koni-docs-framework.md) | Adopt koni-docs as this repo's documentation framework | P1 | 3 | ✅ done (v0.1.0) |

## Cross-references

- [CONTEXT D1–D4](../../CONTEXT.md) — the four decisions this epic recorded
- [docs/README.md](../../README.md) — doc hub and pre-commit checklist
- [EPIC-2](EPIC-2.md) — the MCP server capability this foundation serves
- [sprint-2026-W32](../sprint-2026-W32.md) — the sprint this epic's story sits in
