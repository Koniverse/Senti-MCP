#!/usr/bin/env python3
"""Mutation-test the *test suite*, not the checker.

An author-blind reviewer took `check-references.py`, regressed `SECTION_POINTER`
to backticks-only — blinding it to two of the three §-pointer syntaxes, the exact
class it was written for — and the self-test **still printed green**. Its
assertions were substrings matched against the whole report, so one surviving
form satisfied all three.

That is the failure this file exists to prevent. A suite that survives a mutant
checker is not a suite; it is a fifteenth way to print `0`.

So: break the checker on purpose, one rule at a time, and assert the suite
*notices*. If a mutant survives, the suite has a hole and the mutant names it.

    python3 skills/koni-docs/scripts/__tests__/test-mutations.py
"""
from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
CHECKER = HERE.parent / 'check-references.py'
SUITE = HERE / 'test-check-references.py'

# Each mutation is a (label, find, replace) that plausibly *narrows* the checker —
# the shape every real regression in this file's history has taken.
MUTATIONS: list[tuple[str, str, str]] = [
    (
        'SECTION_POINTER sees only the backticked form (the reviewer’s own mutant)',
        r"    r'\[?`?([A-Za-z][\w./-]*\.md)`?(?:\]\(([^)]*)\))?,?\s*§([^\n,.;()\[\]|`+]+)'",
        r"    r'`([A-Za-z][\w./-]*\.md)`()()?,?\s*§([^\n,.;()\[\]|`+]+)'",
    ),
    (
        'fences are backticks only — ~~~ blocks become phantom headings again',
        r"    for m in re.finditer(r'^[ \t]{0,3}(`{3,}|~{3,})', text, re.M):",
        r"    for m in re.finditer(r'^[ \t]{0,3}(`{3,})', text, re.M):",
    ),
    (
        'script names must be backticked — the agile-sync-up.mjs ghost slips through',
        r"SCRIPT_NAME = re.compile(r'(?<![\w.\-…*])((?:[\w.-]+/)*[\w-]+(?:\.[\w-]+)*\.(?:mjs|py|sh))(?![\w-])')",
        r"SCRIPT_NAME = re.compile(r'`([\w./-]+\.(?:mjs|py|sh))`')",
    ),
    (
        'HTML and reference-style definitions stop being scanned',
        '        for pattern in (REF_DEF, HTML_SRC):',
        '        for pattern in ():',
    ),
    (
        'a §-pointer with a wrong path is rescued by basename again',
        "                if '/' in cited:",
        "                if False:",
    ),
    (
        'the uppercase-stem exemption returns, blinding the checker to SKILL.md',
        "    if '*' in target:\n        return True          # `*.spec.ts` is a glob — a shape, not a file",
        "    if '*' in target or Path(target).stem[:1].isupper():\n        return True",
    ),
    # These five SURVIVED both suites when an author-blind reviewer planted them. Each
    # deletes a behaviour the checker's docstring claims — including, in the first case,
    # the fix shipped the round before. Nothing in the corpus pinned them, so the
    # mutation test certified a coverage it did not have. The fixtures now cover them;
    # these mutants are what keeps that true.
    (
        'the #fragment check in HTML hrefs / reference definitions is deleted (last round’s fix)',
        "                if frag and tgt.suffix in ('', '.md') and frag not in anchors:",
        "                if False:",
    ),
    (
        'in-fence anchors stop being skipped — fenced sample headings become real',
        "        for m in ANCHOR_LINK.finditer(text):\n            if in_fence(text, m.start()):",
        "        for m in ANCHOR_LINK.finditer(text):\n            if False:",
    ),
    (
        'the slugger collapses whitespace runs (GitHub does not) — em-dash + emoji anchors break',
        "    return h.replace(' ', '-')",
        "    return re.sub(r'\\s+', '-', h.strip())",
    ),
    (
        'setext headings stop emitting anchors — live links read as dead',
        '    for h in HEADING.findall(body) + SETEXT.findall(body):',
        '    for h in HEADING.findall(body):',
    ),
    (
        'the duplicate-heading -N suffix is dropped — #heading-1 becomes unreachable',
        "        out.add(slug if n == 0 else f'{slug}-{n}')",
        "        out.add(slug)",
    ),
    (
        'explicit HTML anchors stop being collected — live <a name>/id= links read as dead',
        '    out.update(HTML_ANCHOR.findall(body))',
        '    pass',
    ),
    # Seven of these survived when a reviewer planted them, each deleting a behaviour the
    # checker documents in its OWN SOURCE. The corpus had been widened to cover the last
    # report rather than the claim surface, so the hole rate never moved (63% -> 58%).
    # These are derived from the branches now, not from a memory of what someone found.
    (
        'H1 headings stop emitting anchors — `](#title)` is a legal link',
        "HEADING = re.compile(r'^#{1,6} (.+)$', re.M)",
        "HEADING = re.compile(r'^#{2,6} (.+)$', re.M)",
    ),
    (
        'HTML_ANCHOR sees name= but not id= — half the explicit anchors go missing',
        "(?:name|id)",
        "(?:name)",
    ),
    (
        'numeric §-pointer precision is dropped — §3 starts matching `## 30.`',
        "                ok = any(re.match(rf'{re.escape(named)}\\.\\s', h) or f'§{named}' in h",
        "                ok = True or any(re.match(rf'{re.escape(named)}\\.\\s', h) or f'§{named}' in h",
    ),
    (
        'a §-pointer to a file that exists nowhere is silently skipped',
        "                if not matches:",
        "                if False:",
    ),
    (
        'same-directory links stop being checked — `](sibling.md)` goes blind',
        "            if '/' not in target_raw and '.' not in target_raw:",
        "            if '/' not in target_raw:",
    ),
    (
        'HTML comment spans go greedy — everything between the first and last blinds',
        "r'<!--.*?-->'",
        "r'<!--.*-->'",
    ),

    (
        'the retired-numeric-section check is deleted — `PRD §8` ships again',
        '        for m in RETIRED_NUMERIC_SECTION.finditer(text):',
        '        for m in ():',
    ),
    (
        'the stated-count check is deleted — "12 rules" drifts again, unnoticed',
        '        for m in STATED_COUNT.finditer(text):',
        '        for m in ():',
    ),
    (
        # The exact regression this noun was added for: with `checks` out of the noun set
        # the checker still prints 0 while "six release-commit-only checks" contradicts a
        # gates.conf that has seven. The count silently stops being counted.
        'the check-count noun is dropped — a wrong "N release-commit-only checks" passes again',
        "    r'(?P<w2>release-commit-only checks|release-only checks)'",
        "    r'(?P<w2>a-noun-no-doc-ever-writes)'",
    ),
]


def run_suite(checker_source: str) -> tuple[int, str]:
    """Run the suite against a mutated checker — in a COPY, never in the working tree.

    An earlier version wrote the mutant into the live, git-tracked `check-references.py`
    and restored it in a `finally`. That runs inside a *blocking pre-commit hook*: one
    Ctrl-C, OOM, or killed hook and the working tree is left holding a deliberately
    blinded checker — one that still prints `0`. The guard would have corrupted the
    thing it guards, in exactly the silent way this whole file exists to prevent.
    """
    with tempfile.TemporaryDirectory() as tmp:
        sandbox = Path(tmp) / 'scripts'
        shutil.copytree(CHECKER.parent, sandbox)
        (sandbox / CHECKER.name).write_text(checker_source, encoding='utf-8')
        p = subprocess.run(
            [sys.executable, str(sandbox / '__tests__' / SUITE.name)],
            capture_output=True, text=True,
        )
        return p.returncode, p.stdout + p.stderr


MIN_MUTANTS = 21


def main() -> int:
    if len(MUTATIONS) < MIN_MUTANTS:
        print(f'the mutant set has shrunk to {len(MUTATIONS)} (floor: {MIN_MUTANTS}). '
              f'"All 0 mutants killed" is not a result.')
        return 1

    source = CHECKER.read_text(encoding='utf-8')
    survivors: list[str] = []

    # Sanity: the unmutated checker must pass, or every result below is noise.
    rc, out = run_suite(source)
    if rc != 0:
        print('The suite fails on the UNMUTATED checker — fix that first:\n')
        print(out)
        return 1

    for label, find, replace in MUTATIONS:
        if find not in source:
            survivors.append(f'{label}\n      (the mutation no longer applies — the '
                             f'checker was refactored; re-anchor this mutant)')
            continue
        rc, _ = run_suite(source.replace(find, replace, 1))
        if rc == 0:
            survivors.append(f'{label}\n      SURVIVED — the suite passed a checker '
                             f'that cannot do this. That hole is real.')

    if survivors:
        print('mutation test FAILED — the suite does not notice these regressions:\n')
        for s in survivors:
            print(f'  ✗ {s}')
        print(f'\n{len(survivors)} surviving mutant(s). Add a fixture that kills each one.')
        return 1

    print(f'✓ mutation test: all {len(MUTATIONS)} mutant checkers were killed by the suite')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
