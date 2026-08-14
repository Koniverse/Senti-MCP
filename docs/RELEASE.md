# RELEASE.md — cutting and publishing `senti-mcp-server`

The procedure for turning a merged change into a released version. One maintainer, one
branch, a handful of releases — so this file is short, ordered, and every command in it has
been run.

> **This is not `DEPLOY.md`, and it does not bring one in.** `DEPLOY.md` in this framework
> is a production runbook for a hosted service — an environment table, deployment steps,
> rollback of a deployment. This project has no service: nothing to deploy beyond
> `npm publish` itself. Its absence stays a recorded decision
> ([docs/README.md](README.md) §What is deliberately absent, [CONTEXT D18](CONTEXT.md)).

---

## 1. What a release is

**Four artifacts, one version, always together** ([CONTEXT D15](CONTEXT.md)):

| Artifact | Where |
|---|---|
| A `## [X.Y.Z]` section | [docs/CHANGELOG.md](CHANGELOG.md) |
| An **annotated** tag `vX.Y.Z` | this repository |
| A GitHub Release | [Koniverse/Senti-MCP/releases](https://github.com/Koniverse/Senti-MCP/releases) |
| A published version | [npmjs.com/package/senti-mcp-server](https://www.npmjs.com/package/senti-mcp-server) |

A version that has some of those and not others is drift, and this repo has paid for it:
before [EPIC-4](sprints/epics/EPIC-4.md), nine versions had a CHANGELOG section, three had a
tag, two had a Release and two were on npm. `npm run release:check` exists so that cannot
happen again silently.

**Two versions are deliberate exceptions, and they stay exceptions.** `1.0.0` is tagged and
released on GitHub but never published to npm ([CONTEXT D12](CONTEXT.md)); `0.2.0` → `0.7.0`
are changelogged and tagged but have no Release and are never published
([CONTEXT D17](CONTEXT.md)). Do not "fix" either.

**The version number is a human decision.** What a change earns is argued in its story and
recorded in [CONTEXT.md](CONTEXT.md) — [D11](CONTEXT.md) cut `1.0.0` where the diff alone
earned `0.7.1`. Nothing in this file derives a version from commit messages, and nothing
should ([EPIC-4](sprints/epics/EPIC-4.md) §Out of scope).

---

## 2. Before you start

```bash
git switch main && git pull --ff-only        # the tag is a claim about a commit on main
git status --porcelain                       # must print nothing
npm ci                                       # or npm install, if you know why
```

**Read this once, then never think about it again:** npm forbids republishing a version
number **forever**, and allows unpublish only within **72 hours** of the original publish.
Every check below runs *before* `npm publish` for that reason alone. §6 is what to do when
something still gets out wrong.

---

## 3. The procedure

### Step 1 — Decide the version, and write down why

Semver against the *tool surface*, not the diff size. A new tool is a minor. A behaviour
change to an existing tool's name, arguments or `structuredContent` shape is a major. Record
the reasoning in the story and, when it is not mechanical, in [CONTEXT.md](CONTEXT.md).

### Step 2 — Bump all four version strings in one commit

```bash
VERSION_NEW=1.1.0

printf '%s\n' "$VERSION_NEW" > VERSION
npm version "$VERSION_NEW" --no-git-tag-version --allow-same-version
# then edit src/config.ts by hand: export const SERVER_VERSION = '1.1.0';
```

`npm version` is what keeps `package-lock.json`'s own `version` field in step — editing
`package.json` by hand does not, and that is exactly how the lock file sat at `0.1.0` for
eight releases while `package.json` said `1.0.1` ([LESSONS 4](LESSONS.md)).

Four files must move together. `src/config.test.ts` catches three of them on every commit;
`release:check` catches all four plus the tag at release time. koni-docs checks only
`VERSION` and `package.json`.

The **Node floor** is a second set of files that must move together — `package.json`
`engines.node`, `README.md` §Requirements and `docs/SETUP.md` §1 — and it is not a version
string, so none of the checks above sees it. `release:check` compares those three too; see
§Step 5.

### Step 3 — Write the CHANGELOG section

Copy the story's `## Changelog entry` block into [docs/CHANGELOG.md](CHANGELOG.md) under a
new `## [X.Y.Z] — YYYY-MM-DD — <headline>` heading, above the previous release and below
`## [Unreleased]`. Adjust the copied links: they are story-relative in the story file and
must be `docs/`-relative here. Move anything in `## [Unreleased]` that belongs to this
release into the new section — `release:check` fails if `Unreleased` still carries content.

No `— vX.Y.Z` suffix on the heading. It used to mark tagged versions, every version is
tagged now, and it is retired ([CONTEXT D19](CONTEXT.md)). The three older headings that
carry it are history and are not edited.

### Step 4 — Check `README.md` still describes what ships

`README.md` is **inside the tarball** and **is the npm package page** — `npm pack` ships 42
files and none of them are from `docs/`, so it is the only prose a reader on the registry
ever sees. If this release adds a tool, the tool table and any version-bearing sentence in
the install section have to move in this same commit. Publishing a package whose own front
page describes a different package is [CONTEXT D12](CONTEXT.md), and it cost a patch version
to avoid last time.

### Step 5 — Run the gate

```bash
npm run release:check          # defaults to the version in VERSION
npm run release:verify-pack    # packs, installs into a clean dir, spawns the binary
```

`release:check` verifies the five version strings agree (`VERSION`, `package.json`,
`package-lock.json`, `SERVER_VERSION`, and the tag), **the Node floor agrees across the
three artifacts that state it**, the CHANGELOG section exists, `Unreleased` is clear,
`README.md` carries no contradicting version claim, the tag does not already exist, the
tree is clean, and `HEAD` is on `main`. `release:verify-pack` proves the tarball actually
installs and answers `tools/list`. Both must exit `0`. §6 explains each failure.

**The Node floor check** ([US-5.2](sprints/stories/US-5.2-release-check-guards-the-node-floor.md))
treats `package.json` `engines.node` as canonical and compares every floor claim in
`README.md` and `docs/SETUP.md` against it — an artifact that states a *different* floor
fails, and so does one that states **no** floor at all. A floor claim is a semver
immediately preceded by `>=` or `≥` on a line mentioning Node; that operator is what
separates the floor from the other Node versions in the same prose (`AbortSignal.any`'s
20.3.0 is written "landed in 20.3.0", never ">= 20.3.0"). The practical consequence when
you next move the floor: prose *about* an old floor must not use the operator form — write
"the old 20.6.0 floor", not "the old `>= 20.6.0` floor", or the gate reads history as a
contradiction. CI pins in `.github/workflows/` are deliberately **not** checked: they bind
nobody outside CI and `publish` differs from the floor on purpose ([LESSONS 7](LESSONS.md)).

### Step 6 — Commit, then tag, then push

```bash
git add -A && git commit -m "feat: <what shipped> and release $VERSION_NEW"
git push origin main

git tag -a "v$VERSION_NEW" -m "senti-mcp-server v$VERSION_NEW — <the CHANGELOG headline>"
git push origin "v$VERSION_NEW"
```

**Push the commit before the tag.** The workflow builds from the tag; if the commit is not
on the remote yet, the tag points at something the runner cannot fetch.

### Step 7 — Watch the workflow, then confirm the registry

```bash
gh run watch                                    # or: gh run list --workflow release.yml
gh release view "v$VERSION_NEW"
npm view senti-mcp-server dist-tags             # latest must be $VERSION_NEW
npx -y "senti-mcp-server@$VERSION_NEW" --help 2>&1 | head -1   # optional last sanity check
```

**The release is not done at the tag push.** It is done when `latest` names the new version.

### Step 8 — Close the story

Flip `status: done`, set `version_shipped` to **bare** semver (`1.1.0`, never `v1.1.0` —
RULE-16), tick the remaining tasks, then `npm run agile:status` and
`npm run agile:validate`.

---

## 4. Conventions

**Annotated tags only.** `git tag -a`, never a lightweight ref. Confirm with:

```bash
git for-each-ref --format='%(refname:short) %(objecttype) %(subject)' refs/tags
```

Every row must read `tag`, not `commit`.

**Tag message form**, as the existing tags use it:

```
senti-mcp-server v1.0.1 — the six tools reach npm
senti-mcp-server v0.1.0
```

Name plus version, optionally an em dash and the CHANGELOG headline.

**Sorting tags — this one bites.** Six tags (`v0.2.0` … `v0.7.0`) were backfilled on
2026-08-10 against commits from 2026-08-06/07 ([CONTEXT D17](CONTEXT.md)), so their *tagger*
dates are all later than `v1.0.1`'s. Use:

```bash
git tag -l --sort=v:refname        # correct: semver order
git tag -l --sort=committerdate    # correct: the commits' order
git tag -l --sort=creatordate      # WRONG: backfilled tags sort last
```

**CHANGELOG heading form:** `## [X.Y.Z] — YYYY-MM-DD — <headline>`. No trailing version.

---

## 5. What the workflow does

Pushing a `v*` tag triggers [`.github/workflows/release.yml`](../.github/workflows/release.yml)
([CONTEXT D16](CONTEXT.md)):

1. **gate** — `npm run release:check <version from the tag>`. Fails here and nothing else runs.
2. **build** — `npm run typecheck`, `npm test`, `npm run build`. No Senti credential is
   present, and none is needed: the suite is hermetic and the smoke test skips.
3. **verify** — `npm run release:verify-pack` against the real tarball.
4. **publish** — `npm publish --provenance`, authenticated by **OIDC trusted publishing**.
   No `NPM_TOKEN` is stored in this repository.
5. **announce** — `gh release create` with that version's CHANGELOG section as the body.

Every third-party action is pinned to a commit SHA. The publish job requests
`id-token: write` and nothing broader.

**One-time setup, on npmjs.com, not in this repo:** the trusted publisher must be configured
for the `senti-mcp-server` package, bound to `Koniverse/Senti-MCP` and the workflow filename
`release.yml`. It is not in git and cannot be verified from a checkout — if publishing fails
with an authentication error, check this first.

---

## 6. When it goes wrong

### `release:check` failed

| Message | What it means |
|---|---|
| version mismatch | One of `VERSION` / `package.json` / `package-lock.json` / `src/config.ts` did not move. Step 2 again — and if it is the lock file, you edited `package.json` by hand instead of running `npm version`. |
| no `## [X.Y.Z]` section | Step 3 was skipped. |
| `## [Unreleased]` is not clear | Content belonging to this release is still in `Unreleased`, or work that is not part of this release is sitting in the tree. Decide which. |
| README names a different version | Step 4. This is the check standing in for [D12](CONTEXT.md); it scans version-bearing claims only and cannot tell you the prose is *accurate*, only that it is not *contradictory*. |
| Node floor — artifact states a different floor | The floor half-landed: `package.json` `engines.node` moved and `README.md` or `docs/SETUP.md` did not, or the reverse. The message names the file, the line, the value found and the value expected. Note `docs/SETUP.md` states it in three separate spots. |
| Node floor — artifact states no floor at all | A file stopped claiming the floor entirely, which the gate treats as a failure rather than a vacuous pass ([LESSONS 2](LESSONS.md)). Also fires if a *historical* mention was rewritten into the operator form — write "the old 20.6.0 floor", not "the old `>= 20.6.0` floor". |
| Node floor — no `engines.node` | `package.json` lost its `engines` block. It is the canonical floor; the other two artifacts are copies of it. |
| tag already exists | This version was already released. npm will never accept the number again — pick the next one. |
| working tree dirty / not on `main` | A tag is a claim about a commit; make it the reviewed one. |

### `release:verify-pack` failed

The tarball does not install or does not answer `tools/list`. This is the packaging step
between `dist/` and the registry — check the `files` array in `package.json`, `bin`, and
whether a runtime import landed in `devDependencies`. **This failing before a publish is the
system working**; it is the reason this repo has no `next` dist-tag ([CONTEXT D20](CONTEXT.md)).

### The workflow failed after a successful publish

The publish stands — it cannot be taken back. Re-run only the announce step, or create the
Release by hand:

```bash
gh release create "v$VERSION_NEW" --title "v$VERSION_NEW — <headline>" --notes-file <(...)
```

### A bad version reached the registry

**Do not attempt to reissue the number.** It is gone forever. Cut the next patch with the
fix. Unpublish (`npm unpublish senti-mcp-server@X.Y.Z`) is available only within 72 hours
and only makes the number unusable *and* absent — it does not give it back. If `latest` is
pointing at something broken and the fix will take time, move it back:

```bash
npm dist-tag add senti-mcp-server@<last-good> latest
```

That is a repair, not a workflow step. If it is ever needed twice, revisit
[CONTEXT D20](CONTEXT.md) — the trigger it names for adopting a `next` channel is exactly
this.

---

## 7. Deliberately absent

- **A `next` dist-tag / pre-release channel.** `latest` is the only dist-tag. A channel's
  value is proportional to the people installing from it, and this package has no
  identifiable pre-release consumer; `release:verify-pack` addresses the same risk one
  irreversible act earlier. **Trigger to revisit:** a second consumer who wants a release
  early, or any version reaching `latest` broken ([CONTEXT D20](CONTEXT.md)).
- **`DEPLOY.md`.** See the note at the top of this file.
- **Automated version bumping** (`changesets`, `semantic-release`). Such a tool would have
  assigned `0.7.1` exactly where [D11](CONTEXT.md) chose `1.0.0`.
- **CI on every push.** This repo runs one workflow, and it runs on a tag. Whether pushes
  and pull requests should also run CI is its own decision.

---

## Cross-references

- [docs/README.md](README.md) — doc hub and the pre-commit checklist Step 8 continues
- [docs/CHANGELOG.md](CHANGELOG.md) — release history
- [CONTEXT D15–D20](CONTEXT.md) — the six decisions this procedure implements
- [CONTEXT D11, D12](CONTEXT.md) — the `1.0.0` cut and the `1.0.1` publish, the two releases this file is written from
- [EPIC-4](sprints/epics/EPIC-4.md) — the epic that produced this file
- [AGENTS.md](../AGENTS.md) — project guide
