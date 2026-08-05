# Changelog

All notable changes to **senti-mcp-server** are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Every code-shipping commit bumps [`VERSION`](../VERSION) and adds an entry here in
the **same commit** (RULE-1). Entries carry no commit SHA: a commit cannot contain
its own SHA, and `--amend`-ing one in orphans it (RULE-2). The `## [X.Y.Z]` anchor
plus the git tag are the join keys — `git log --grep '0.1.0'` finds the commit.

---

## [Unreleased]

Documentation framework only — no runtime code has shipped yet. The `0.1.0` entry
lands in the commit that adds `src/`, per RULE-1.

Adopted the [`koni-docs`](../.agents/skills/koni-docs/SKILL.md) documentation
framework: the skill is vendored at `.agents/skills/koni-docs`, the
`@koniverse/koni-docs` CLI is a devDependency, and the sprint corpus tracks the v1
build as forward stories. See [CONTEXT](CONTEXT.md) D1–D4.

---
