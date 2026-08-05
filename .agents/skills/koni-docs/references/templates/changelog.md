# CHANGELOG Entry — Template

> **File location**: `docs/CHANGELOG.md` (or `docs/CHANGELOG.md` — match
> the project's existing casing).
>
> **Use when**: User asks to write a changelog entry, ship a version, or
> close a story.
>
> **One rule above all others**: every code-shipping commit bumps `VERSION`
> AND adds a new entry to CHANGELOG.md IN THE SAME COMMIT (RULE-1).
>
> **Do not put a commit SHA in the entry.** A commit cannot contain its own SHA,
> and `--amend`-ing one in orphans it (RULE-2, LESSONS §17). The version anchor
> `## [X.Y.Z]` plus the git tag is already a durable join key — `git log --grep`
> finds the commit without a self-reference. `pending` is never acceptable.

---

## 1. Template skeleton

```markdown
## [X.Y.Z] — YYYY-MM-DD — <short descriptive title> — vX.Y.Z

<1-3 sentence description: what shipped and why. Include root cause for bug fixes.>

### Added
- <Feature / component added>

### Changed
- <Behavior or API changed — old vs new>

### Fixed
- <Bug description + root cause in one sentence>

### Removed
- <What was dropped and why>

### Security
- <CVE or hardening detail>


```

---

## 2. Rules

- Only include sections that have content. Omit empty sections.
- **No `**Commit**:` line.** A commit cannot contain its own SHA; `--amend`-ing
  one in rewrites the commit and orphans the SHA you just wrote (RULE-2,
  LESSONS §17). The `## [X.Y.Z]` anchor + the git tag already join the entry to
  its commit. `pending` is never acceptable either. If a SHA must be recorded
  somewhere (e.g. a story's `commit:` field), backfill it in a follow-up commit.
- Entries in reverse-chronological order — newest at top.
- Never reorder or edit past entries.
- Version tag appears twice: `[X.Y.Z]` in header AND `— vX.Y.Z` inline —
  both required for `git log --grep`.

---

## 3. Safe CHANGELOG insertion

**WRONG** (eats previous version header):

```
oldString = "## [0.63.3] — ..."
newString = "## [0.63.4] ...\n\n## [0.63.3] — ..."
```

**CORRECT** — anchor on `[Unreleased]` section:

```
oldString = "## [Unreleased]\n\n(empty — track here while in dev but not yet shipped)\n\n---"
newString = "## [Unreleased]\n\n(empty...)\n\n---\n\n## [X.Y.Z] — ...\n\n...content..."
```

---

## 4. Filled example

```markdown
## [0.63.4] — 2026-01-15 — Add pod project management — v0.63.4

Shipped pod-based project grouping with drag-and-drop reordering. Users can now
organize projects into custom pods for better workspace navigation.

### Added
- Pod creation and deletion UI in workspace settings
- Drag-and-drop project-to-pod assignment
- Pod filter chips in project list

### Fixed
- Project list not updating after workspace switch (missing `revalidatePath` in
  workspace change handler)
```

> No `**Commit**:` line — deliberately. The entry ships *in* the commit it
> describes, so it cannot name it; `git log --grep '0.63.4'` and the `v0.63.4` tag
> are the join keys. RULE-2.
