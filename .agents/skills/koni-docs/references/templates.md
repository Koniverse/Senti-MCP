# Document Templates — Index

> Each Koniverse document type has its own template file under
> [`templates/`](templates/). This index lists what exists, when to use
> each, and where the canonical content lives. Load only the template
> file the user's request needs.


**Contents**: [Template files](#template-files) · [Conventions every template follows](#conventions-every-template-follows) · [Activation](#activation) · [Frontmatter](#frontmatter)

---

## Template files

**Single source: [SKILL.md §5](../SKILL.md)** routes a user's intent to exactly one
template; **§6** says when to load each reference. Every template lives at
[`templates/`](templates/), one file per doc type.

This file exists for the two things §5 and §6 cannot carry: the **conventions every
template follows** (below), and the pointers that replaced deleted mirrors.

## Conventions every template follows

- **Frontmatter** (where applicable) lives at the top in YAML. `id` MUST
  match the filename. Status emojis are stable across the system:
  `📋 backlog / 🚧 in-progress / ✅ done / ⏪ reverted / 🗑️ deprecated`.
- **English-only** (RULE-13). Templates, prose, and generated content
  are all English even on Vietnamese-led projects.
- **Cross-references use markdown links** (`[text](path)`) — not inline
  backticks for file paths. Reviewers must be able to click through.
- **Filled examples are condensed**, not raw copies. The point is to
  show shape and tone; for a full real-world reference, link to the
  upstream repo (Koni-Finance-Final / Koni-ERP-02).
- **Templates are loaded on demand.** Never pre-load every template;
  load the single file that matches the user's intent.

---

## Activation

**Single source: [SKILL.md §5](../SKILL.md).**

## Frontmatter

**Single source: [`frontmatter-spec.md`](frontmatter-spec.md) §3** — the per-document
contract, field by field, with the pattern each value must match.
