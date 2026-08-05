#!/usr/bin/env python3
"""The checker's own test suite — planted defects, asserted caught.

Why this file exists, stated plainly: `check-references.py` shipped three
consecutive false greens. Each time it was "verified" by running it on a clean
corpus and reading `0`, and each time an author-blind reviewer found a whole
syntax it could not see. **A checker that always prints 0 also prints 0.**

So the checker is no longer trusted because it is quiet. It is trusted because
this suite plants one defect per class it claims to catch and asserts it fails —
and plants a clean control and asserts it passes. A widening that relocates the
blind spot now breaks a test instead of shipping.

    python3 skills/koni-docs/scripts/__tests__/test-check-references.py
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CHECKER = HERE.parent / 'check-references.py'
GOOD = HERE / 'fixtures' / 'good'
BAD = HERE / 'fixtures' / 'bad'
# Scanned as a root of its own — see control 1b. It is also the sibling ground truth that
# `bad`/`good` resolve their check-count against.
HARNESS = HERE / 'fixtures' / 'koni-harness'

# Every defect class the checker's docstring and the gate's promise cover.
# The key is a substring that must appear in the report for that defect.
MUST_CATCH = {
    'dead file link': 'dead link -> references/gone.md',
    'dead in-page anchor': 'dead anchor #no-such-heading',
    'dead link with a title attribute': 'dead link -> references/gone2.md',
    'dead angle-bracket destination': 'dead link -> references/gone3.md',
    'dead cross-file anchor': 'dead anchor references/ok.md#not-there',
    'dead HTML href': 'dead link -> references/gone4.md',
    'dead HTML img src': 'dead link -> references/gone5.png',
    'dead reference-style definition': 'dead link -> references/gone6.md',
    # Three §-pointer SYNTAXES, three distinct needles. They shared one needle once,
    # so blinding the checker to two of the three still passed the suite — proven by an
    # author-blind reviewer who regressed SECTION_POINTER to backticks-only and watched
    # it go green. A suite whose assertions can be satisfied by a sibling line is a
    # fifteenth way to print 0.
    'dead §-pointer, backticked form': 'dead §-pointer -> ok.md §GhostBacktick',
    'dead §-pointer, linked form': 'dead §-pointer -> ok.md §GhostLinked',
    'dead §-pointer, bare form': 'dead §-pointer -> ok.md §GhostBare',
    'dead §-pointer, wrong path': '§-pointer path does not resolve -> wrong/path/ok.md',
    'named script that does not exist (backticked)': 'names a script that does not exist -> never-existed.mjs',
    'named script that does not exist (bare)': 'names a script that does not exist -> never-existed-too.mjs',
    'named helper that does not exist': 'names a script that does not exist -> ghost-lib.sh',
    'phantom anchor from a ~~~ fence': 'dead anchor #phantom-heading-in-a-tilde-fence',
    'defect after an indented closing fence (the silent-trapdoor bug)': 'dead link -> references/gone7.md',
    # The uppercase-stem exemption — added to stop `Next.js` false positives — made the
    # checker blind to SKILL.md / README.md, and therefore to `[SKILL.md §5](../SKILL.md)`:
    # the very pointer that replaced a deleted mirror. A fix that opened a bigger hole
    # than the one it closed, and the suite did not notice because nothing tested it.
    'dead anchor in an uppercase-stemmed file': 'dead anchor references/Guide.md#not-a-heading',
    'dead uppercase-stemmed file link': 'dead link -> references/GONE8.md',
    'dead §-pointer into an uppercase-stemmed file': 'dead §-pointer -> Guide.md §Ghostly',
    # These five were CLAIMED behaviours with no fixture behind them. A reviewer
    # deleted each one from the checker and both suites stayed green — including the
    # fragment check shipped the round before, which the suite existing to verify it
    # did not verify. A mutation test over an incomplete corpus certifies memory as
    # coverage (LESSONS §23).
    'dead #fragment inside an HTML href': 'dead anchor references/ok.md#no-such-fragment',
    'dead #fragment in a reference-style definition': 'dead anchor references/ok.md#also-no-such-fragment',
    'dead anchor to a nonexistent setext heading': 'dead anchor #setext-ghost',
    'dead anchor to a nonexistent duplicate-heading suffix': 'dead anchor #alive-2',
    'dead emoji anchor (GitHub keeps the gap the emoji leaves)': 'dead anchor #deploy-it',
    'wrong-case path (dead on Linux/GitHub, alive on a case-blind macOS FS)': 'dead link -> References/ok.md',
    # Derived from the CLAIM SURFACE, not from a reviewer's report. Every branch in
    # check-references.py that can append a problem, and every behaviour its source
    # documents, gets a fixture — because a corpus built from what someone happened to
    # find certifies memory as coverage (LESSONS §23). A new branch in the checker
    # requires a new entry here, in the same commit.
    'dead link in the same directory (no slash in the path)': 'dead link -> gone-sibling.md',
    'dead anchor whose heading contains a code span': 'dead anchor #a-code-heading',
    'dead anchor in a file with an H1': 'dead anchor #not-the-h1',
    'dead anchor beside an explicit id= attribute': 'dead anchor #not-that-id',
    '§-pointer to a file that exists nowhere': '§-pointer to a file that does not exist -> nowhere.md',
    'numeric §-pointer precision (§3 must not match a `## 30.` heading)': 'dead §-pointer -> ok.md §3',
    'named .py script that does not exist': 'names a script that does not exist -> ghost-script.py',
    'dead link BETWEEN two HTML comments (a greedy comment span would go blind)': 'dead link -> references/gone9.md',
    # The label-only convention (US-4.29) retired numeric PRD/ARCHITECTURE sections. The
    # rule and the template were updated; three siblings were not — including one copied
    # verbatim into every generated story. The checker could not see the class at all,
    # because bare `PRD §8` carries no `.md` token.
    'retired numeric doc section (PRD §8, the label-only convention)': 'retired numeric doc section -> PRD §8',
    # A count in prose is a promise to stay in sync with something you do not control. It
    # drifted three times, in three files, across three rounds. Now it is checked.
    'a stated count that does not match what is counted': 'stated count is wrong -> claims 99 rules, there are 2',
    # The same class, second noun. koni-harness said "six release-commit-only checks" for
    # several versions while gates.conf had grown a seventh — every gate passed, because
    # `checks` was not a counted noun. Counting it closes the hole for good.
    'a stated check-count that does not match gates.conf': 'claims 9 release-only checks, there are 2',
    # Without this, removing the in_fence guard from the ANCHOR_LINK pass broke nothing
    # the suite could see — a surviving mutant names its own hole.
    'phantom anchor from a ``` fence': 'dead anchor #a-heading-that-only-exists-inside-a-backtick-fence',
}

# Floors. A reviewer emptied MUST_CATCH and the suite reported "0 planted defect classes
# all caught" — rc=0, gate green, checker fully blind. A suite with no floor is the
# sixteenth way to print 0.
MIN_CLASSES = 38


def run(target: Path) -> tuple[int, str]:
    p = subprocess.run(
        [sys.executable, str(CHECKER), str(target)],
        capture_output=True, text=True,
    )
    return p.returncode, p.stdout + p.stderr


def main() -> int:
    failures: list[str] = []

    # An emptied corpus must not read as a clean one.
    if len(MUST_CATCH) < MIN_CLASSES:
        print(f'the corpus has shrunk to {len(MUST_CATCH)} classes (floor: {MIN_CLASSES}). '
              f'A suite that asserts nothing passes everything.')
        return 1

    # 1. The clean control must pass. A checker that cries wolf gets ignored,
    #    which is the same outcome as one that stays silent.
    rc, out = run(GOOD)
    if rc != 0:
        failures.append(f'FALSE POSITIVE — the clean fixture must pass, got:\n{out}')

    # 1b. The ground-truth fixture states its OWN check-count correctly and must pass too.
    #     This is the only scan that resolves `gates.conf` by the primary path
    #     (`root/scripts/gates.conf`) instead of the sibling glob, and the only one that
    #     asserts a *correct* count stays SILENT. Without it, a narrowing that turned the
    #     count check into a false-positive generator would survive the entire suite —
    #     every other control only proves the checker can still shout.
    rc, out = run(HARNESS)
    if rc != 0:
        failures.append(
            f'FALSE POSITIVE — the correct-count fixture must pass (primary gates.conf '
            f'path), got:\n{out}'
        )

    # 2. Every planted defect must be reported by name.
    rc, out = run(BAD)
    if rc == 0:
        failures.append('FALSE GREEN — the fixture full of dangling references passed')
    for label, needle in MUST_CATCH.items():
        if needle not in out:
            failures.append(f'MISSED [{label}] — nothing in the report mentioned "{needle}"')

    if failures:
        print('check-references self-test FAILED\n')
        for f in failures:
            print(f'  ✗ {f}')
        print(f'\n{len(failures)} failure(s). The guard is not trustworthy until these pass.')
        return 1

    print(f'✓ check-references self-test: clean fixture passes, '
          f'{len(MUST_CATCH)} planted defect classes all caught')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
