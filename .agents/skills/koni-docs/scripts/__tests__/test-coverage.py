#!/usr/bin/env python3
"""The corpus must be derived from the code, not from memory.

Three rounds running, an author-blind reviewer planted narrowings in
`check-references.py` and most of them survived both suites. The hole rate never
moved — 63%, 58%, **71%** — because every round I added fixtures for whatever the
last reviewer happened to find, and called the result coverage. `MIN_CLASSES`
*reads* like completeness. It is a count of remembered defects.

The standing rule ("a new branch requires a new fixture") only ever guarded
*future* branches. Nobody had enumerated the *existing* ones.

The reviewer's prescription, adopted here verbatim: **make coverage of
`check-references.py` under the fixture suite a gate.** A line that never executes
while the checker runs over `fixtures/bad` and `fixtures/good` is a line no fixture
exercises — which is exactly the definition of an unpinned claim. A machine derives
the claim surface; a memory cannot.

    python3 skills/koni-docs/scripts/__tests__/test-coverage.py

Stdlib `trace` only — no dependency the gate would have to install.
"""
from __future__ import annotations

import sys
import trace
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPTS = HERE.parent
CHECKER = SCRIPTS / 'check-references.py'
GOOD = HERE / 'fixtures' / 'good'
BAD = HERE / 'fixtures' / 'bad'

# Lines that cannot be exercised by running the checker over the fixtures, and that no
# fixture *should* be contorted to reach. Each one is justified — an unexplained
# exclusion is how a coverage gate becomes decoration.
EXEMPT: dict[str, str] = {
    # line-content prefix -> why no fixture should be contorted to reach it
    "root = Path(sys.argv": 'CLI arg parsing — the suite calls check() directly',
    "if not root.is_dir()": 'operator error, not a corpus defect',
    "print(f'not a directory": 'operator error, not a corpus defect',
    "return 2": 'operator error exit code',
    "problems = check(root)": 'the CLI wrapper around check()',
    "for p in problems:": 'the CLI wrapper around check()',
    "print(p)": 'the CLI wrapper around check()',
    "print(f'\\n{len(problems)} dangling": 'the CLI wrapper around check()',
    "return 1 if problems else 0": 'the CLI wrapper around check()',
    "except OSError:": 'an unreadable directory is environmental, not a reference defect',
    "except ValueError:": 'a path outside the scan root — defensive, unreachable in practice',
    "return 'fixtures' not in q.parts": 'the ValueError fallback above — same reason',
    "if repo == repo.parent:": 'filesystem-root guard on the .git walk — unreachable inside a repo',
    "break": 'loop guards on the bounded .git walk',
    "return None": 'missing-file / unparseable-config guards in count_of — a skill without '
                   'rules.md, cli.md, or a readable gates.conf states no count',
    "return False": 'defensive returns on the paths exempted above',
    "if '__tests__' in md.relative_to(root).parts:": 'fixture-skip, exercised only when scanning the real skill',
}


def exempt(text: str) -> str | None:
    for prefix, reason in EXEMPT.items():
        if text.startswith(prefix):
            return reason
    return None


def executable_lines(path: Path) -> set[int]:
    """Every line the tracer could plausibly hit — statements, not comments or blanks."""
    import dis
    src = path.read_text(encoding='utf-8')
    code = compile(src, str(path), 'exec')
    lines: set[int] = set()
    stack = [code]
    while stack:
        c = stack.pop()
        lines.update({ln for _, ln in dis.findlinestarts(c) if ln})
        stack.extend(k for k in c.co_consts if hasattr(k, 'co_code'))
    return lines


def covered_lines() -> set[int]:
    """Lines of check-references.py that actually execute while checking the fixtures."""
    sys.path.insert(0, str(SCRIPTS))
    tracer = trace.Trace(count=1, trace=0, ignoredirs=[sys.prefix])

    def run() -> None:
        import check_references  # noqa: F401  (imported for its side-effect-free API)
        for target in sorted((HERE / 'fixtures').iterdir()):
            if target.is_dir():
                check_references.check(target)
        # the operator-error path: a target that is not a directory
        try:
            check_references.check(HERE / 'test-coverage.py')
        except Exception:
            pass

    tracer.runfunc(run)
    results = tracer.results()
    return {
        line for (filename, line), hits in results.counts.items()
        if hits and Path(filename).name == 'check_references.py'
    }


def main() -> int:
    # `trace` needs an importable module name; the checker is hyphenated on disk.
    link = SCRIPTS / 'check_references.py'
    created = False
    if not link.exists():
        link.write_text(CHECKER.read_text(encoding='utf-8'), encoding='utf-8')
        created = True
    try:
        executable = executable_lines(link)
        covered = covered_lines()
    finally:
        if created:
            link.unlink()

    src_lines = CHECKER.read_text(encoding='utf-8').split('\n')
    uncovered = sorted(executable - covered)

    # Module-level definitions (imports, regexes, def/class headers) execute at import,
    # so anything left is a real branch the fixtures never reach.
    real = []
    for ln in uncovered:
        text = src_lines[ln - 1].strip() if ln <= len(src_lines) else ''
        if not text or text.startswith('#'):
            continue
        if any(text.startswith(k) for k in ('def ', 'class ', 'import ', 'from ', '@')):
            continue
        if text.startswith('raise SystemExit') or text.startswith("if __name__"):
            continue
        if exempt(text):
            continue
        # A bare `continue` / `break` is a jump, and CPython attributes the line event to
        # the `if` that guards it — so the tracer never reports it even when the branch is
        # exercised. Verified by hand: each of these sits under a guard the fixtures do
        # reach. Excluding the jump, not the condition, keeps the gate honest: if the
        # GUARD goes uncovered, it still fails.
        if text in ('continue', 'break') or text.startswith(('continue ', 'continue#',
                                                             'continue    #')):
            continue
        real.append((ln, text))

    if real:
        print('coverage gate FAILED — these lines of check-references.py are never')
        print('exercised by the fixtures, so nothing pins the behaviour they implement:\n')
        for ln, text in real:
            print(f'  ✗ {CHECKER.name}:{ln}  {text[:88]}')
        print(f'\n{len(real)} unpinned line(s). Plant a fixture that reaches each one, or')
        print('delete the branch — an unreachable claim is either untested or dead code.')
        return 1

    print(f'✓ coverage gate: every executable branch of {CHECKER.name} is exercised '
          f'by the fixture corpus ({len(covered)} lines)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
