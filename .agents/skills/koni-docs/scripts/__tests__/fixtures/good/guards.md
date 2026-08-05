# Guards

Everything here must be ignored, quietly.

## Section

<!-- an html comment link: [x](gone.md) -->

[refdef-consumer]: ../../PRD.md
[refdef-noslash]: nothing
[refdef-external]: https://example.com/a.md

See `ok.md` §0–§1 for the range form.
See `PRD.md` §Functional Requirements for a consumer doc.

The 2 release-commit-only checks fire only at release — a CORRECT count, resolved
through the sibling glob to `fixtures/koni-harness/scripts/gates.conf`. It must stay
silent; if it ever reports, the count check has become a false-positive generator.

```markdown
These 99 rules apply — inside a fence, so not a claim.
PRD §8 inside a fence is sample content.
The `ghost-in-a-fence.sh` script is sample content.
<a href="gone-in-a-fence.md">also sample</a>
[refdef-in-fence]: gone.md
```

`PRD §8` quoted in a code span is a mention, not a use.

The `crypto.test.ts` naming convention is prose, not a tool.
