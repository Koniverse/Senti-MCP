---
id: US-9.5
title: "The forbidden-construct pattern contract"
epic: EPIC-9
status: backlog
priority: P2
points: 2
sprint:
assignee: bluezdot
created: 2026-09-14
updated: 2026-09-14
---

## Goal

Stop printing a false sentence into every model context that reads the authoring rules, and
replace it with the contract the API now publishes. A model reading `get_authoring_conventions`
learns which regex dialect a pattern is, which flags rebuild it, whether a match is a violation
or only a directive for an allow-list, and which rule ids a violation will be reported under.

## Background

`get_authoring_conventions` (`src/tools/authoring/conventions.ts`) is the tool every model is
told to call **before generating any MQL5**. Its text says, at `:82-85`:

> *They have not been run against anything here — this tool reports the contract, it does not
> evaluate it, and the API does not document which regex dialect the analyzer uses.*

and its description repeats it at `:110-111`. Since Senti US-46.48 deployed, the last clause is
false.

On 2026-09-14 the served `ForbiddenConstruct` requires six fields — `id`, `pattern`, `flags`,
`matchIsViolation`, `emittedRuleIds`, `reason`. `ForbiddenConstructSchema` (`:7-11`) parses
three:

- **`pattern`** — ECMAScript `RegExp.source`, with no delimiters and no flags. Rebuild it as
  `new RegExp(pattern, flags)`; `pattern` alone is case-sensitive, which is wrong for most
  entries.
- **`flags`** — `RegExp.flags`: `''`, `'i'` or `'gi'`. Declared `type: string`, **not an
  enum**. Some entries are deliberately case-sensitive. With `g`, a reused RegExp carries
  `lastIndex` between calls and `.test()` alternates.
- **`matchIsViolation`** — `false` means the pattern only *detects* a directive
  (`#include <…>`, `WebRequest(`) whose real rule is an allow-list described in `reason`:
  `#include <Trade/Trade.mqh>` matches and is legal.
- **`emittedRuleIds`** — the `rule` values the scan can actually report for the entry. `id` is
  a documentation label: `NO_WEBREQUEST` is never emitted; the scanner reports
  `WEBREQUEST_NOT_ALLOWLISTED` or `WEBREQUEST_UNVERIFIABLE`.

**The operation's description adds two things the hand-off did not carry**, and both belong in
the rendered text:

- **The server does not match raw source.** It reduces the file to logical lines — line endings
  normalised, backslash continuations spliced, comments stripped while honouring string and
  character-literal state — and applies every pattern to each logical line. A client check that
  matches raw text *"will disagree with the server in both directions"*.
- **Passing every pattern is necessary, not sufficient.** Four further analyses — `#resource`,
  `#include` resolution, `#define` alias resolution, `iCustom` checking — emit rules that appear
  nowhere in the list, among them `EMPTY_SOURCE`, `ICUSTOM_RESOURCE_ONLY`,
  `NO_RESOURCE_TRAVERSAL`, `RESOURCE_MUST_BE_EX5` and `RESOURCE_MUST_MATCH_ATTACHMENT`. The
  server scan is authoritative.

**Out of scope, decided 2026-09-14** ([EPIC-9](../epics/EPIC-9.md) §Out of scope): evaluating
the patterns locally, and mapping `emittedRuleIds` onto `compile_draft` output. No response in
the document declares where a scan's `rule` value appears; scan violations come back as
`200 ok:false` `diagnostics`, which carry a `code`.

## Acceptance criteria

- [ ] **AC-1** — `ForbiddenConstructSchema` declares `id`, `pattern`, `flags`, `matchIsViolation`,
  `emittedRuleIds` and `reason`; `flags` is `z.string()`, not an enum.
- [ ] **AC-2** — **Given** a construct, **When** the text renders, **Then** it shows its flags —
  an empty value rendered as case-sensitive rather than as blank — whether a match is a violation
  or only detects a directive the `reason` decides, and its `emittedRuleIds`.
- [ ] **AC-3** — **Given** the text and the tool description, **When** they are read, **Then**
  neither says the dialect is undocumented or that patterns are reported without meaning;
  **And** the text says patterns are ECMAScript, rebuilt with their own flags, matched against
  logical lines rather than raw source, and necessary rather than sufficient.
- [ ] **AC-4** — **Given** a construct with `flags: 'gi'` and one with `flags: ''`, **When** the
  text renders, **Then** each shows its own flags. The test at `conventions.test.ts:58` is
  rewritten to assert the new framing.
- [ ] **AC-5** — **Given** a `pattern` with backslash escapes, **When** rendered, **Then** it is
  reproduced verbatim, as `conventions.test.ts:52` asserts today.
- [ ] **AC-6** — **Given** the description's "small (~2 KB)" claim, **When** the live response is
  measured with the new fields, **Then** the figure in the description matches the measurement.
- [ ] **AC-7** — **Given** `npm run test:smoke`, **When** the conventions leg runs, **Then** it
  parses with the new required fields, **And** stderr records how many entries carry each
  `flags` value and how many have `matchIsViolation: false`.

## Tasks

- [ ] **TASK-9.5.1** — Schema and rendering (AC: 1, 2, 5)
  - [ ] `conventions.ts:7-11` gains the three fields; `formatConventions`' construct line
        (`:61`) renders them
- [ ] **TASK-9.5.2** — Replace the disclaimer (AC: 3)
  - [ ] The section preamble at `:82-85`; the description at `:110-111`. Keep the added text
        short — it is printed on every call
- [ ] **TASK-9.5.3** — Tests and smoke (AC: 4, 7)
  - [ ] `conventions.test.ts` fixtures gain the new fields; the `:58` test rewritten
  - [ ] Smoke leg logs the flag and `matchIsViolation` counts
- [ ] **TASK-9.5.4** — Measure and release (AC: 6)
  - [ ] Live response size into §Implementation notes; correct the description's figure
  - [ ] Minor bump in all five places; `docs/CHANGELOG.md`; `README.md` row

## Dev notes

### Architecture constraints

- **Report the contract; do not evaluate it.** The tool still runs no pattern. What changes is
  that it now reports everything a caller needs to evaluate one correctly.
- **`flags` is a string because the document says so.** An enum of today's three values would
  fail the whole parse the day Senti adds an `m`.

### Cross-story dependencies

- None. Independent of the rest of [EPIC-9](../epics/EPIC-9.md).

### What we explicitly did NOT do

- **No local evaluation of the patterns** — [EPIC-9](../epics/EPIC-9.md) §Out of scope.
- **No `emittedRuleIds` join in `compile_draft`** — no documented key. Trigger: a live compile
  of a deliberately violating draft showing a `diagnostics[].code` that is an `emittedRuleIds`
  value.

### References

- [Source: EPIC-9 §The hand-off, checked](../epics/EPIC-9.md)
- [Source: US-7.1](US-7.1-authoring-substrate-and-conventions-tool.md) — the tool as shipped in
  `2.1.0`

## Verification commands

| AC | Command |
|---|---|
| AC-1 – AC-5 | `npx vitest run src/tools/authoring/conventions.test.ts` |
| AC-3 | `grep -n "regex dialect\|reported verbatim" src/tools/authoring/conventions.ts` prints nothing |
| AC-7 | `npm run test:smoke` — the `[smoke] conventions` line |

## Changelog entry

### Changed
- `get_authoring_conventions` reports each forbidden construct's `flags`, `matchIsViolation` and
  `emittedRuleIds` (Senti US-46.48), and says how a pattern is matched — ECMAScript, per logical
  line, with its own flags.

### Removed
- The statement that the API does not document the regex dialect. It has since Senti US-46.48.

## Implementation notes

_Empty until work starts._

## Cross-references

- [EPIC-9](../epics/EPIC-9.md) · [US-7.1](US-7.1-authoring-substrate-and-conventions-tool.md)
