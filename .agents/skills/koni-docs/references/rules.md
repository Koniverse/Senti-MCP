# Core Rules — Detailed Reference

> These 13 rules apply to ALL Koniverse projects regardless of technology stack.
> (RULE-3, -4, -8, -9 and -12 were retired before v0.1; the numbers are not reused,
> so cross-references in older docs keep resolving.)
> Technology-specific rules live in plugin skills (koni-nextjs (and future plugin skills), etc.)


**Contents**: [Rule Groups](#rule-groups) · [Pre-commit Rules](#pre-commit-rules) · [During-Work Rules](#during-work-rules) · [Post-Generation Rules](#post-generation-rules)

## Rule Groups

| Group | When enforced |
|-------|---------------|
| Pre-commit | Before `git commit` |
| During work | While writing code/docs |
| Post-generation | After running scripts |

---

## Pre-commit Rules

### RULE-1: VERSION + CHANGELOG in same commit

**Severity**: BLOCKER — violations block merge

**What**: Every code-shipping commit must update both the `VERSION` file AND `docs/CHANGELOG.md` in the SAME commit. Never defer documentation to a follow-up commit.

**Why**: Keeps version tracking and changelog atomically linked to the code change. A follow-up commit can be missed; a `git bisect` won't find the changelog entry.

**How to comply**:
1. Bump `VERSION` file according to semver rules
2. Add new CHANGELOG entry at top (below `[Unreleased]`)
3. Commit both together with the code changes

**Semver rules**:
| Change type | Bump |
|---|---|
| Breaking schema / public API change | MAJOR |
| New backward-compatible feature (default) | MINOR |
| Bug fix, no new feature | PATCH |

**Grep check**: `git diff --cached --name-only | grep -E "VERSION|CHANGELOG" | wc -l` — must be 2 when code files are staged.

**See**: [`templates/changelog.md`](templates/changelog.md), §3 (safe CHANGELOG insertion)

---

### RULE-2: A recorded SHA is real and reachable — never `pending`, never `--amend`-ed in

**Severity**: BLOCKER

**What**: A recorded SHA must be a **real, reachable** SHA. `pending` is NEVER acceptable, and neither is a SHA that no longer exists.

**Why**: The SHA is what lets `git log --grep` / `git show` answer "which commit shipped this version". A placeholder breaks bisectability; a *stale* SHA is worse, because it looks correct and resolves to nothing.

**The chicken-and-egg — read this before you reach for `--amend`**: a commit cannot contain its own SHA. An earlier version of this rule prescribed *"commit → read `git log -1 --format=%h` → `git commit --amend` to fill it in"*. **That procedure cannot work**: `--amend` rewrites the commit, producing a *new* SHA, so the SHA you just wrote is instantly orphaned — it resolves only via reflog and is unreachable from any branch. Verified the hard way (LESSONS §17).

**How to comply** — pick one, never `--amend`:

1. **Omit the SHA from the CHANGELOG entry** *(preferred)*. The version anchor (`## [0.39.0]`) plus the git tag is already a durable join key — `git log --grep '0.39.0'` finds the commit without a self-reference. No `**Commit**:` line at all.
2. **Two-commit backfill**, when a SHA really must be recorded (e.g. a story's `commit:` frontmatter). Ship the artifact, then fill the SHA in a *follow-up* commit:
   ```bash
   git commit -m "feat: ..."                     # the release commit
   SHA=$(git rev-parse --short HEAD)             # now it exists and is reachable
   # write $SHA into the story's `commit:` field
   git commit -m "docs: backfill US-X.Y commit SHA ($SHA)"
   ```

**Grep checks**:
- No placeholders: `grep -n "Commit.*pending" docs/CHANGELOG.md docs/sprints/stories/*.md` — must return empty *after* the backfill commit.
- Every recorded SHA is reachable:
  ```bash
  grep -hoE '^commit: [0-9a-f]{7,40}' docs/sprints/stories/*.md | awk '{print $2}' \
    | xargs -I{} sh -c 'git merge-base --is-ancestor {} HEAD 2>/dev/null && echo "{}: ok" || echo "{}: UNREACHABLE"'
  ```
  Every line must print `ok`. An `UNREACHABLE` line is the `--amend` trap above.

**Already amended? Here is the way out.** The orphaned SHA is not recoverable and
does not need to be — the *work* is in history under a new SHA. Find it and
re-record it, in a follow-up commit:

```bash
git log --oneline --grep '<the version or story id>'   # locate the real commit
sed -i '' 's/^commit: <orphan>/commit: <real>/' docs/sprints/stories/US-X.Y-*.md
git commit -am "docs: repair US-X.Y commit SHA (<orphan> was orphaned by an amend)"
```

Do not amend again to "fix" it — that mints a third SHA and orphans the second.

**See**: [`templates/changelog.md`](templates/changelog.md), [LESSONS §17](../../../docs/LESSONS.md)

---

### RULE-11: New env var → update all three files

**Severity**: BLOCKER

**What**: Adding a new environment variable requires updating ALL three files in the same commit: `docs/SETUP.md` + `DEPLOY.md` + `.env.example`.

**Why**: A missing env var in SETUP.md blocks new developers. Missing in DEPLOY.md causes production outages. Missing in .env.example makes it undiscoverable.

**How to comply** — all three in same commit:
1. `docs/SETUP.md` — add to the `.env.local` example block + one-line description
2. `DEPLOY.md` — add to the production env vars table
3. `.env.example` — add the key with placeholder value

**Format for .env.example**:
```bash
# <Category / Feature name> (added in vX.Y.Z)
# <One sentence: what this controls, where to get the value>
NEW_ENV_VAR=<placeholder_or_description>
```

**Format for SETUP.md env block**:
```markdown
# <Category name> (added in vX.Y.Z)
# <What it does — 1 line>
NEW_ENV_VAR=<example_value_or_instructions>
```

**See**: [`templates/setup.md`](templates/setup.md)

---

### RULE-14: Commit message prefix

**Severity**: WARNING

**What**: Every commit message must use a conventional prefix: `feat:`, `fix:`, `chore:`, `docs:`, `style:`, `refactor:`, `test:`.

**Why**: Enables automatic changelog generation and makes `git log --oneline` scannable by intent.

**Note**: Doc-only commits (typo, formatting) do NOT bump VERSION.

---

## During-Work Rules

### RULE-6: Story ID must match across all docs

**Severity**: BLOCKER

**What**: A story's `id:` in frontmatter must exactly match:
1. The filename prefix (e.g., `US-3.7` in `US-3.7-pod-project-management.md`)
2. The PRD `Epics & User Stories` entry identifier

One canonical ID per story across all documentation layers.

**Why**: Prevents ID drift between the story file, the sprint board, and the PRD. Mismatched IDs break the 5-layer consistency system.

**How to comply**:
1. Before creating a story, check the PRD `Epics & User Stories` table to confirm the ID
2. If the story doesn't exist in PRD `Epics & User Stories`, add it first
3. Use the exact same ID in filename, frontmatter `id:`, and PRD reference

**Grep check**: `grep -rn "US-X.Y" docs/sprints/stories/ docs/PRD.md` — all references to a story ID must be consistent.

**See**: [`templates/story.md`](templates/story.md), `sprint-system.md` §Naming conventions

---

### RULE-7: CONTEXT.md is append-only

**Severity**: BLOCKER

**What**: Never edit or delete a past CONTEXT.md entry. Corrections get a new `D<N> (revision of D<M>)` entry appended at the end of the current phase.

**Why**: The decision log is a historical record. Rewriting history destroys the "why did we choose X?" trail that future contributors depend on.

**How to comply**:
- **Correction needed?** → Append `### D<N>. <Title> (revision of D<M>)` with `What changed`, `New decision`, `Rationale`
- **Wrong entry?** → Add correction entry; never delete the original
- **Missing rationale?** → "because Y" is mandatory in every entry

**Anti-patterns**:
| Wrong | Correct |
|---|---|
| Edit body of past entry D<M> | Add new D<N> (revision of D<M>) |
| Delete a wrong decision | Add correction entry |
| Leave rationale blank | Always include "because Y" |
| One huge entry for 10 decisions | One entry per decision |

**See**: [`templates/context.md`](templates/context.md)

---

### RULE-10: Mark tasks as you complete them

**Severity**: WARNING

**What**: Mark story Tasks `[x]` individually as each task is completed, not all at once when the story finishes. Same rule applies to Acceptance Criteria checkboxes.

**Why**: Incremental checkmarks give visibility into progress. Batch-marking at the end hides blockers and makes sprint status inaccurate.

**How to comply**: After completing each Task or AC, immediately update its checkbox from `[ ]` to `[x]` using the Edit tool.

**See**: `sprint-system.md` §Story status flow

---

### Vietnamese counterpart convention (`*.vi.md`)

Some Koniverse projects (e.g. senti_quant) ship Vietnamese translations
of canonical docs as `*.vi.md` siblings — e.g. `docs/PRD.vi.md` next to
`docs/PRD.md`. **English is canonical** (per RULE-13): all sync scripts,
grep checks, and verification commands operate on `*.md` (no `.vi`
infix). The `.vi.md` files are:

- **Optional** — projects opt in per their team's language preference.
- **Never authoritative** — if `*.md` and `*.vi.md` disagree, `*.md` wins.
- **Skipped by sync scripts** — `npx koni-docs status` /
  `npx koni-docs sync` filter to `.md`-only files that DON'T match
  `*.vi.md`. Frontmatter parsing, AC counting, status propagation: all
  English-only.
- **Per-story discretion** — translate the stories that need broad
  cross-team review; leave engineering-detail stories English-only.

### RULE-13: English-only for all deliverables

**Severity**: WARNING

**What**: All code, comments, UI strings, error messages, commit messages, and documentation must be in English. Vietnamese is reserved for user chat prompts only.

**Why**: English is the lingua franca of software. Non-English strings in code or docs create barriers for international contributors and tooling.

---

### RULE-15: `assignee:` is the GitHub login — never git `user.name`, never a display name

**Severity**: BLOCKER

**What**: Every `assignee:` value in koni-docs artifacts MUST be the contributor's **GitHub login** (the `username` half of `github.com/<username>`). Not their git `user.name`. Not their display name. Not their email handle. Same convention everywhere a person is named:

- Story frontmatter `assignee:` (`docs/sprints/stories/US-*.md`)
- Sprint scope-table assignee columns (`docs/sprints/sprint-*.md`)
- Epic frontmatter / sprint frontmatter owner / lead fields (where present)
- `.active-context.md` "Local developer.GitHub login" field
- CONTEXT.md decision authorship (if recorded)
- LESSONS.md attribution (if recorded)

**Why**: GitHub login is the only identifier that survives across **@-mentions, PR reviewer assignments, `gh api users/<login>`, CODEOWNERS lookups, and audit attribution**. Git `user.name` is per-machine and per-developer — one maintainer's `user.name = AnhMTV` while their GitHub login is `saltict`, so a mismatched `assignee:` silently breaks every downstream lookup (PR ping never fires, CODEOWNERS skips them, status reports route to the wrong person).

**How to comply**:
1. **Get your own login**: `gh api user --jq .login` returns it exactly. Copy that string verbatim into `assignee:`.
2. **Get a teammate's login**: prefer the value they already use in past stories or `.active-context.example.md`. Otherwise `gh api users/<guess>` returns HTTP 200 only if `<guess>` is the real login.
3. **Set once, reuse**: write your login to `.active-context.md` `Local developer.GitHub login` field on first checkout. Every subsequent `assignee:` you set in any story copies from there.
4. **Never substitute git config**: `git config user.name` is for commit attribution, not assignee routing. They can disagree, and when they do the GitHub-side wins for every tool that matters.

**Grep checks**:
- Story files using your machine's git `user.name` instead of GitHub login:
  ```bash
  grep -lE "^assignee: $(git config user.name)$" docs/sprints/stories/*.md
  ```
  Should return zero files **unless** your git `user.name` happens to equal your GitHub login.
- Cross-check that every non-empty `assignee:` resolves via `gh`:
  ```bash
  grep -hE "^assignee: \S+$" docs/sprints/stories/*.md | awk '{print $2}' \
    | sort -u | xargs -I{} sh -c 'gh api users/{} > /dev/null 2>&1 && echo "{}: ok" || echo "{}: NOT A REAL LOGIN"'
  ```
  Every line should print `ok`.

**See**: `templates/story.md` §1 Frontmatter, `templates/sprint.md` §1 (the Sprint scope table lives in the skeleton), `templates/integration.md` §2 (`.active-context.md` Local developer block).

---

### RULE-16: `version_shipped:` is bare semver — never `v`-prefixed

**Severity**: BLOCKER

**What**: Every `version_shipped:` value in story frontmatter MUST be **bare semver** — `0.7.0`, NEVER `v0.7.0`. Same rule applies to:
- Story frontmatter `version_shipped:` (`docs/sprints/stories/US-*.md`)
- Repo-root `VERSION` file content (`0.7.0\n`, not `v0.7.0\n`)
- `docs/CHANGELOG.md` section anchors (`## [0.7.0]`, not `## [v0.7.0]`)
- Any `version:` / `released_version:` field in epic / sprint / PRD frontmatter

The `v` prefix IS still used for narrative / convention surfaces:
- Git tags (`v0.7.0` — git tradition)
- CHANGELOG narrative titles after the dash chain (`## [0.7.0] — date — title — v0.7.0`)
- Active Context summary lines (`Last Version: v0.7.0`)
- Body prose in stories / decisions / lessons (`shipped in v0.7.0`)

**Why**: Tooling that joins on version strings — `koni-docs sync` Stories-table writer, CHANGELOG-anchor lookup, semver `compare()`, sort order — needs a single canonical key. Mixing `v0.7.0` and `0.7.0` in structured fields silently breaks equality comparisons and produces double-`v` corruption like `vv0.7.0` in synced output (the script prepends `v` to the bare convention). Real-world trap: caught during Koni-Skills v0.2.0 dogfood when US-1.1's `version_shipped: v0.1.0` produced `vv0.1.0` in EPIC-1 Stories table ([LESSONS §4](../../../docs/LESSONS.md)). Same split that git itself uses: tag `v0.7.0`, but `package.json` `"version": "0.7.0"`.

**How to comply**:
1. **In story frontmatter**: `version_shipped: 0.7.0` — no `v`.
2. **In VERSION file**: bare `0.7.0` (one line, no `v`).
3. **In CHANGELOG section anchors**: `## [0.7.0] — 2026-MM-DD — title — v0.7.0` — `[0.7.0]` is the bare anchor; the trailing `v0.7.0` is narrative.
4. Prose elsewhere uses `v`-prefix freely.

**Grep checks**:
- Story frontmatter no-`v`: `grep -lE '^version_shipped: v' docs/sprints/stories/*.md` → must return zero files.
- VERSION file: `head -1 VERSION | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$'` → must match (no `v`).
- CHANGELOG anchors: `grep -E '^## \[v' docs/CHANGELOG.md` → must return zero lines.

**See**: `templates/story.md` §1 Frontmatter, `templates/changelog.md` §1 (template skeleton), [LESSONS §4](../../../docs/LESSONS.md).

---

### RULE-17: Frontmatter ID fields are bare canonical IDs only — never prose

**Severity**: BLOCKER

**What**: Every frontmatter field that holds an ID the tooling will look up — `prd_ref`, `arch_ref`, `depends_on`, `epic`, `sprint`, `version_shipped`, `id` — MUST contain only bare canonical IDs matching the regex for that namespace ([`frontmatter-spec.md`](frontmatter-spec.md) §2). Parenthetical notes, scope qualifiers ("(partial — accept path)"), dependency narratives ("extends US-1.3 …"), version ranges ("FR-28 .. FR-45"), slash-joined IDs ("FR-93 / FR-94"), and cross-namespace mixing (putting `AD-N` into `prd_ref`) are all forbidden.

The canonical YAML form is a **list of strings**: `prd_ref: [FR-04, FR-10]`. The legacy comma-string form (`prd_ref: FR-04, FR-10`) is still accepted by the parser but **must not contain anything except IDs and commas**.

**Why**: `koni-docs sync` reads ID-typed fields, splits CSV strings on `,`, then looks each fragment up in a canonical table (FR row in PRD, story row in epic, etc.). A single qualifier like `FR-94 (shared with EPIC-5)` becomes the literal lookup key `FR-94 (shared with EPIC-5)` — guaranteed table miss, surfaced as a noisy "row not found" warning every sync run. A prose-stuffed value like `ARCH §External Services (Resend, MVP) — proposes AD-33 …` shatters into half-a-dozen junk tokens. This recurring class of bug was diagnosed during the US-4.29 PRD-label cleanup on Koni-Finance-Final's 204-story corpus.

**How to comply**:
1. Use **list form** for every ID-typed field: `prd_ref: [FR-04, FR-10]`.
2. **One namespace per field**: `prd_ref` is FR / NFR only; `arch_ref` is AD only; `depends_on` is US only. See [`frontmatter-spec.md`](frontmatter-spec.md) §3 for the per-document contract.
3. **Prose moves to the body** — Background / Cross-story dependencies / Architecture constraints / Implementation notes. Frontmatter is for tooling; bodies are for humans.
4. **Enumerate ranges** — `[FR-28, FR-29, …, FR-45]`, never `FR-28 .. FR-45`. If the list is unwieldy, the owning epic / story is too broad — split it.
5. When migrating an existing project, run the audit grep from [`frontmatter-spec.md`](frontmatter-spec.md) §6 to surface offenders, then fix per-epic.

**Grep checks**:
- Story `prd_ref` is well-formed (list, flow-list, or pure CSV of IDs):
  ```bash
  rg --no-heading -n '^prd_ref:' docs/sprints/stories | \
    grep -vE '^[^:]+:\s*(\[[A-Z, 0-9-]+\]|\s*$|[A-Z]+-[0-9]+(,\s*[A-Z]+-[0-9]+)*)$'
  ```
  → must return zero matches.
- Same for `arch_ref` and `depends_on` — substitute the field name.
- `koni-docs sync --dry-run` → zero `section "..." not found` / `row with ID="<garbage>" not found` warnings.
- `koni-docs validate` → exits 0.

**See**: [`frontmatter-spec.md`](frontmatter-spec.md) (the authoritative spec — per-field contract, anti-pattern catalog, migration playbook), `templates/story.md` §1 Frontmatter, `templates/epic.md` §1 Frontmatter.

---

### RULE-18: `due` is a commitment from outside the sprint cadence — sparse, bare, and never moved silently

**Severity**: BLOCKER (format) · WARNING (usage)

**What**: three obligations on a story's `due` field.

1. **Set it only for a date imposed from OUTSIDE the sprint rhythm** — a contract,
   a customer demo, an audit window, a legal filing. "Must land this sprint" is
   *not* a `due`: `sprint:` already says that, and `sprint.end` is **never**
   inherited. A story with no `due` has no deadline.
2. **The value is a bare `YYYY-MM-DD` and nothing else.** No parentheticals, no
   "tentative", no prose. Why the date exists and what breaks if it slips go in
   the story's `## Deadline` section.
3. **Moving an existing `due` requires a CONTEXT.md entry** — old date → new date
   → why. This applies **whenever the date changes**, not only once the story is
   already late. A proactive push is exactly the case that needs the record.

**Why**: (1) is a *signal* rule — a `due` on every story turns the Deadlines board
into a second copy of the sprint table, which is the thing nobody reads; the field
earns its power by being rare. (2) is a *parser* rule — `koni-docs validate`
errors on a non-date, and a caveated value silently drops the story off the board
entirely (the caveat causes the outcome the author feared). (3) is an *honesty*
rule: editing `2026-07-10` → `2026-07-24` in silence erases the fact that the
story missed its date once, and STATUS.md will then cheerfully report it as
on-track. Record the slip; correct forward; never rewrite the past to look clean.

**How to comply**:
1. Before setting `due`, ask: *who outside this team is owed this date?* No answer
   → leave it empty.
2. Write the bare date. Put the reason, the imposing party, and the consequence in
   `## Deadline` (see the `## Deadline` section in [`templates/story.md`](templates/story.md)).
3. Changing the date? Append the CONTEXT entry **in the same commit**, and append
   the move to `## Deadline` (old → new → why → the `D<N>` that authorized it).

**Grep checks**:
- No prose in the field: `grep -hE '^due: .+' docs/sprints/stories/*.md | grep -vE '^due: [0-9]{4}-[0-9]{2}-[0-9]{2}$'` → must be empty.
- `koni-docs validate` → errors on a non-date; **warns** when a `due` merely restates its sprint's end (the machine backstop for obligation 1).
- A `due` changed with no CONTEXT entry in the same commit:
  ```bash
  git diff --cached -U0 -- docs/sprints/stories | grep -q '^+due:' && \
    git diff --cached --name-only | grep -q 'docs/CONTEXT.md' || \
    echo "due changed without a CONTEXT entry — RULE-18.3"
  ```

**See**: [`sprint-system.md`](sprint-system.md) §Deadlines vs sprint cadence, [`frontmatter-spec.md`](frontmatter-spec.md) §1.1, the `## Deadline` section of [`templates/story.md`](templates/story.md), CONTEXT D37 (in the Koni-Skills repo, where this rule was decided).

---

## Post-Generation Rules

### RULE-5: STATUS.md is auto-generated

**Severity**: BLOCKER

**What**: `docs/sprints/STATUS.md` is auto-generated by `npx koni-docs status`. Never hand-edit it.

**Why**: Hand-edits to STATUS.md will be overwritten by the next script run. The file is a derived artifact from story frontmatter — the source of truth is the story files.

**How to comply**: Always run `npx koni-docs status` before committing any story status change. If STATUS.md looks wrong, fix the story frontmatter, not STATUS.md.

**Grep check**: N/A — this is a process rule. The script regeneration is the enforcement mechanism.

**See**: [`cli.md`](cli.md) §4 (subcommand inventory)
