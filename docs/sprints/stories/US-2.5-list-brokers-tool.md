---
id: US-2.5
title: "list_brokers tool"
epic: EPIC-2
status: backlog
priority: P1
points: 2
sprint: sprint-2026-W33
assignee: bluezdot
created: 2026-08-06
updated: 2026-08-06
---

## Goal

A user, or the model acting for them, asks "which brokers does Senti support, and what
account types can I open" before ever connecting an account. `list_brokers` answers from
the platform catalog — `GET /api/v1/brokers` — so that question no longer needs a
support ticket or a guess. It is the first tool built on the substrate US-2.4 shipped,
and deliberately the simplest one: no path parameter, no query parameter, nothing to
get wrong except the registration itself.

## Background

Per the [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
§Tool surface, `list_brokers` reads `GET /api/v1/brokers` under the `brokers:read`
scope and returns `tools/brokers/list-brokers.ts`. The design spec calls out one
description risk by name: **`list_brokers` must state that it is platform-wide**,
because without that sentence a model reads it as "the brokers I use" rather than "the
brokers Senti supports," and answers confidently from the wrong premise — the same
failure mode US-2.2's `list_accounts` avoided by naming `id` over `login` in its own
description. A broker's `servers` and `accountTypes` are both nested arrays the API
returns per broker; dropping either from the text summary would silently narrow what
a model can answer about a broker it is looking at.

## Acceptance criteria

- [ ] **AC-1** — **Given** a successful call, **When** the result is returned, **Then**
  `structuredContent` is an object with a `brokers` key (never a bare array), **And**
  it validates against the tool's own `outputSchema`.
- [ ] **AC-2** — The tool description states that the catalog is platform-wide — the
  brokers Senti supports, not the user's linked accounts. Asserted on the description
  text.
- [ ] **AC-3** — **Given** a broker with `servers` and `accountTypes` arrays, **When**
  the list is formatted, **Then** both render in the text summary for that broker.
- [ ] **AC-4** — **Given** an empty broker list, **When** it is formatted, **Then** the
  output explains itself rather than returning nothing, following the precedent
  `list_accounts` set in [US-2.2](US-2.2-list-accounts-tool.md) AC-8.
- [ ] **AC-5** — **Given** a `403` from the API, **When** the tool returns, **Then**
  `isError` is true and the text names the `brokers:read` scope.

## Tasks

- [ ] **TASK-2.5.1** — `tools/brokers/list-brokers.ts` domain module (plan Task 10)
  (AC: 1, 3, 4)
  - [ ] `BrokerSchema`, `parseBrokers` (via `core/parse.ts`'s `parseOrThrow`),
        `formatBrokers`
- [ ] **TASK-2.5.2** — Registration and the 0.3.0 release (plan Task 11) (AC: 2, 5)
  - [ ] Register through `registerReadTool` in `server.ts`; `outputSchema`;
        `scope: 'brokers:read'`; platform-wide sentence in the description

## Dev notes

### Architecture constraints

- Registers through `registerReadTool` ([US-2.4](US-2.4-tool-substrate-and-layout.md))
  — no bespoke `try`/`catch`, no bespoke annotation block.
- **No path parameter.** `GET /api/v1/brokers` takes no `accountId`, so `accountPath`
  does not apply here; this story proves the substrate on the simplest possible shape
  before [US-2.7](US-2.7-list-account-strategies-tool.md) has to prove it on the
  first one that does.

### Cross-story dependencies

- **Builds on** [US-2.4](US-2.4-tool-substrate-and-layout.md) — uses
  `registerReadTool`, `core/parse.ts`'s `parseOrThrow`, and `core/client.ts`'s `get`.
- **Sibling of** [US-2.6](US-2.6-list-strategies-tool.md) — both are platform-wide
  catalog tools with no path parameter shipping the same week; the "platform-wide, not
  yours" description language should read consistently across both.

### What we explicitly did NOT do

- **No filtering or search parameters.** `GET /api/v1/brokers` takes none per the
  OpenAPI document; inventing one would produce a silently ignored argument.
- **No cross-reference to `list_accounts`.** This catalog has nothing to do with the
  user's linked accounts; unlike the account-scoped tools, there is no `login`/`id`
  confusion to guard against here.

### References

- [Source: design spec §Tool surface](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md) — `list_brokers` row
- [Source: design spec, "Two descriptions carry weight beyond documentation"](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [Source: EPIC-2 §Cross-cutting invariants](../epics/EPIC-2.md) — empty states explain themselves
- [Source: read-tools-w33 implementation plan, Tasks 10–11](../../superpowers/plans/2026-08-06-senti-read-tools-w33.md)

## Verification commands

| AC | Command |
|---|---|
| AC-1, AC-3, AC-4 | `npm test -- src/tools/brokers/list-brokers.test.ts` |
| AC-2 | `npm test -- src/server.test.ts -t list_brokers` — asserts description text |
| AC-5 | `npm test -- src/server.test.ts -t "list_brokers.*403"` |

## Changelog entry

### Added
- `src/tools/brokers/list-brokers.ts` — the `list_brokers` tool: `BrokerSchema`,
  `parseBrokers`, `formatBrokers`, registered read-only via `registerReadTool`.

## Implementation notes

Not yet started — filled in when this story moves to `in-progress`.

## Files modified

Not yet started — filled in when this story moves to `in-progress`.

## Cross-references

- [Epic EPIC-2](../epics/EPIC-2.md)
- [sprint-2026-W33](../sprint-2026-W33.md)
- [CHANGELOG](../../CHANGELOG.md)
- [read-tool expansion design spec](../../superpowers/specs/2026-08-05-senti-read-tools-expansion-design.md)
- [US-2.4](US-2.4-tool-substrate-and-layout.md)
