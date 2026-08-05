# Plugin-skill pattern


**Contents**: [What a plugin skill is](#what-a-plugin-skill-is) · [Where it lives](#where-it-lives) · [Discovery](#discovery) · [Composition contract](#composition-contract) · [Authoring a new plugin](#authoring-a-new-plugin) · [Reference](#reference)

How a technology-specific skill extends koni-docs without forking or
restating its rules. Read this before authoring a `koni-<tech>` plugin, and
when a project sets `plugins:` under its `koni-docs:` block and you need to know what that
loads.

---

## What a plugin skill is

A plugin skill is a tech-specific rule set that **extends** koni-docs for one
stack — Supabase, Next.js, and so on. It carries the rules that only apply to
that technology (a Next.js app's `next build` gate, Supabase's RLS
discipline) and leaves the universal concerns to koni-docs.

It **adds** rules; it never replaces the core set. The 13 core rules
(RULE-1 through RULE-18, with 3/4/8/9/12 retired) stay the single source of truth for versioning,
changelog, story/PRD wiring, env-var propagation, commit hygiene, and the
rest. A plugin layers stack-specific rules on top of that floor — it does not
re-open it.

---

## Where it lives

```
skills/koni-<tech>/
├── SKILL.md            # the plugin's rules + composition note
└── references/         # optional, only if the plugin needs depth
```

The plugin is **self-contained** (AD-1): its `SKILL.md` must stand on its own
with no cross-skill imports. It may *reference* a koni-docs `RULE-n` or the
koni-harness gate catalog by name, but it never reaches into another skill's
files to pull text in. A reader who opens only `skills/koni-<tech>/SKILL.md`
gets every plugin rule in full.

---

## Discovery

A project opts in by declaring the plugin in its CLAUDE.md `koni-docs:` block:

```yaml
koni-docs:
  plugins: [nextjs]      # loads skills/koni-nextjs alongside koni-docs
```

When the agent reads a project's CLAUDE.md and sees a non-empty
`plugins:` list, it loads each
named plugin's `SKILL.md` **alongside** koni-docs — not instead of it. Both
rule sets are then in force for that project: the core 13 plus the plugin's
namespaced rules.

---

## Composition contract

A plugin **extends and specializes**; it must never duplicate or override the
13 core rules.

- **Namespacing.** Plugin rules use their own prefix — `NX-` for Next.js,
  `SB-` for Supabase — so they never collide with `RULE-n`. A plugin rule may
  *reference* a core rule it builds on (e.g. "specializes `RULE-11`"), but it
  copies no core-rule text. If you find yourself restating what `RULE-n`
  says, stop: reference it instead.
- **No re-opening the core.** A plugin does not redefine versioning,
  changelog, or env-var rules. It points at the core rule and adds only the
  stack-specific delta.
- **The gate.** A plugin MAY plug into the existing koni-harness gate by
  prescribing a `gates.conf` row (e.g. a `passthrough` check that runs a
  stack-specific command). It does **not** build its own gate runner — the
  harness owns the gate; the plugin only declares the check.

---

## Authoring a new plugin

Checklist for a new `koni-<tech>` plugin:

1. **Name** — `koni-<tech>` (e.g. `koni-nextjs`, `koni-supabase`).
2. **Frontmatter** — `name: koni-<tech>` plus a pushy, boundary-aware
   `description` that says it extends koni-docs (never replaces it) and names
   the triggers that should load it.
3. **Namespaced rule table** — columns `Rule | Asserts | Why | How to check`,
   one row per rule, using the plugin's prefix (`NX-`, `SB-`, …). Each rule's
   "how to check" is a concrete, grep-able or review-able step.
4. **"Composes with koni-docs" section** — state the discovery key (`plugins: [<tech>]`
   under the repo's `koni-docs:` block in CLAUDE.md), affirm the plugin extends and
   never duplicates the 13 core rules, and name any koni-harness gate row it relies on.
5. **When-to-use triggers** — the stack signals that should activate the
   skill (e.g. "Next.js work in a Koni repo").
6. **Wiring** — mirror the existing skills' symlinks
   (`.agents/skills/koni-<tech>` → `../../skills/koni-<tech>`, then
   `.claude/skills/koni-<tech>` → `../../.agents/skills/koni-<tech>`), and have
   the consuming project declare `plugins: [<tech>]` under its CLAUDE.md
   `koni-docs:` block:

   ```yaml
   koni-docs:
     plugins: [<tech>]
   ```

---

## Reference

See [`../../koni-nextjs/SKILL.md`](../../koni-nextjs/SKILL.md) for the worked
example — the first reference plugin, carrying `NX-`-namespaced Next.js rules
that extend koni-docs.
