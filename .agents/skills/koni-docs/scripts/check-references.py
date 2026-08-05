#!/usr/bin/env python3
"""Assert every cross-reference in a skill points at something that exists.

Three defect classes, all found the hard way (LESSONS §18, §19), all invisible
to a human re-reading their own edit:

1. **Dead file links** — a doc routes to `references/migration-from-bmad.md`
   that was never written, or a moved file's link was not re-based.
2. **Dead anchors** — `](#some-heading)` where no such heading exists. The trap:
   `## ` lines *inside* a fenced code block are template skeletons, not headings,
   and GitHub emits no anchor for them. A checker that forgets this certifies
   150 dead links as green.
3. **Dead section pointers** — `See: templates.md §Story file` after
   `templates.md` became a thin index with no such section.

Run from the repo root:

    python3 skills/koni-docs/scripts/check-references.py skills/koni-docs

Exits non-zero if anything dangles. Silence means every pointer resolves.
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

HEADING = re.compile(r'^#{1,6} (.+)$', re.M)   # H1 too — `](#title)` is a legal link
# Setext form: a line underlined by === or ---. GitHub emits an anchor for it; a
# checker that only knows ATX headings calls a live link dead.
SETEXT = re.compile(r'^(?!\s*$)(?!---)([^\n|>#-][^\n]*)\n(?:=+|-+)[ \t]*$', re.M)
ANCHOR_LINK = re.compile(r'\]\(\s*#([^)\s"]+)(?:\s+"[^"]*")?\s*\)')
# Every destination form CommonMark allows, because each has hidden a dead link here:
#   ](path)   ](path#anchor)   ](path "Title")   ](<path>)   ](<path> "Title")
FILE_LINK = re.compile(
    r'\]\(\s*<?([^)>#\s"]+)>?(?:#([^)\s">]+))?(?:\s+"[^"]*")?\s*\)'
)
# Reference-style definitions: [label]: path/to/file.md
REF_DEF = re.compile(r'^\[[^\]]+\]:\s*<?([^\s>]+)>?', re.M)
# A skill's markdown renders as HTML, so <a href> and <img src> are links too.
HTML_SRC = re.compile(r'<(?:a|img|source)\b[^>]*?\b(?:href|src)\s*=\s*"([^"]+)"', re.I)
# ...and <a name="x"> / <h2 id="x"> emit REAL anchors. Not collecting them made the
# checker report a live link as dead — a false positive, which trains people to ignore
# the gate, which ends exactly where silence ends.
HTML_ANCHOR = re.compile(r'<[a-z][a-z0-9]*\b[^>]*?\b(?:name|id)\s*=\s*"([^"]+)"', re.I)
# `file.md` §Section, the linked form [`file.md`](path) §Section, and the bare form
# SKILL.md §3a-bis — all three have shipped dead in this repo.
SECTION_POINTER = re.compile(
    r'\[?`?([A-Za-z][\w./-]*\.md)`?(?:\]\(([^)]*)\))?,?\s*§([^\n,.;()\[\]|`+]+)'
)

# `PRD §8`, `ARCHITECTURE §3` — the numbered form the label-only convention retired
# (US-4.29). These docs live in the consumer's repo, so their sections cannot be resolved
# from here; but the retired *form* is the defect, and it is checkable. It survived in
# three files — including one copied verbatim into every generated story — because
# SECTION_POINTER needed a `.md` token and bare `PRD §11` has none.
# Only PRD and ARCHITECTURE are label-only. LESSONS and CONTEXT genuinely number their
# entries (`## 17.`, `### D37`), so `LESSONS §17` is a real address, not a retired one.
# Matches the label however it is dressed: bare, `.md`-suffixed, path-prefixed, bolded, or
# wrapped in a link — each of those broke adjacency and made the check structurally blind.
RETIRED_NUMERIC_SECTION = re.compile(
    r'(?:^|[\s(\[])'                        # a boundary, not a lookbehind that / and . defeat
    r'[`*_\[]{0,2}'                         # bold / italic / link-open
    r'(?:[\w./-]*/)?'                        # an optional path prefix (docs/PRD)
    r'(PRD|ARCHITECTURE)'
    r'(?:\.md)?'                             # PRD.md §8 was doubly invisible before
    r'[`*_]{0,2}'
    r'(?:\]\([^)]*\))?'                      # a link wrapper
    r'[\s,]*§\s*(\d+)',
    re.M,
)

# A count written in prose is a promise to stay in sync with something you do not control.
# "12 rules" drifted three times, in three files, across three rounds — including in the
# file rewritten to purge staleness. The floor technique was applied to the scripts' own
# counts and not to the docs'. This closes it: a stated count must match what is counted.
#
# `release-commit-only checks` joined the noun set after a second drift of exactly this
# shape: koni-harness said "six release-commit-only checks" for several versions while
# `gates.conf` had grown a seventh (`security-review`). Every gate passed — the noun
# `checks` was simply not in scope — and only a full manual re-grade caught it. A count
# this checker cannot count is a count that will drift again.
#
# Deliberately NOT covered: "N built-in checks". Its ground truth is ambiguous (does the
# `tests` passthrough count as a built-in check?), and an ambiguous count is the kind you
# de-number rather than mechanize — which is what koni-harness now does.
#
# The two nouns carry SEPARATE word-number sets, on purpose. `rules` resolves through an
# unconditional cross-skill fallback (any skill's "N rules" is measured against koni-docs'
# rules.md), so every word form added there is a new way to false-positive: this repo
# already writes "all eight rules" about koni-ea-dev's OWN rule set, and the day that
# sentence moves into `skills/` it would be scored against koni-docs' count. The new forms
# were added for `checks`; they stay on `checks`. A check that cries wolf is as useless as
# silence — the same reason SCRIPT_NAME excludes `.ts`.
STATED_COUNT = re.compile(
    r'\b(?:These |The )?(?:'
    r'(?P<n1>\d+|seven|twelve|thirteen)\s+(?:core |enforced )?(?P<w1>rules|subcommands)'
    r'|'
    r'(?P<n2>\d+|six|seven|eight|nine|ten)\s+'
    r'(?P<w2>release-commit-only checks|release-only checks)'
    r')\b',
    re.I,
)
WORD_NUM = {'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
            'twelve': 12, 'thirteen': 13}

# Backticked OR bare. The first version required backticks — so `agile-sync-up.mjs`,
# the very ghost this check was written for, would still have slipped through unquoted.
#
# Scope, stated honestly: this covers the **runnable tooling a skill tells you to
# execute** (.sh / .py / .mjs), not every source file a doc may cite. `.ts` / `.js`
# were in scope briefly and produced false positives on legitimate cross-repo
# references (koni-agent-monitoring cites Koni-ERP-02's `ingest-schema.ts`) — a check
# that cries wolf gets ignored, which ends in the same place as silence.
SCRIPT_NAME = re.compile(r'(?<![\w.\-…*])((?:[\w.-]+/)*[\w-]+(?:\.[\w-]+)*\.(?:mjs|py|sh))(?![\w-])')


def is_external(target: str) -> bool:
    """An http(s) URL is not ours to resolve."""
    return target.startswith(('http://', 'https://'))


# Docs that live in the CONSUMER's repo (docs/), not in the skill. A template may
# legitimately point a generated document at them; the skill cannot resolve them.
CONSUMER_DOCS = {
    'DESIGN.md', 'LESSONS.md', 'CONTEXT.md', 'PRD.md', 'ARCHITECTURE.md',
    'CHANGELOG.md', 'SETUP.md', 'BRIEF.md', 'DEPLOY.md', 'STATUS.md', 'VERSION',
}


def is_placeholder(target: str) -> bool:
    """`US-X.Y-<slug>.md` is a shape, not a path — it resolves in the generated
    document, not in the template that describes it. `checks/foo.sh` is an
    illustration of a file the reader would author, not a claim that it exists."""
    if '<' in target or 'X.Y' in target or 'X.Z' in target or 'EPIC-N' in target:
        return True
    if '*' in target:
        return True          # `*.spec.ts` is a glob — a shape, not a file
    stem = Path(target).stem.lower()
    return (stem in {'foo', 'bar', 'baz', 'example'}
            or stem.startswith(('your-', 'my-', 'example-', 'foo')))


def is_prose_not_a_script(name: str) -> bool:
    """Only for the SCRIPT_NAME pass — a naming convention shown in prose
    (`crypto.test.ts`) is not a tool the docs claim to ship.

    The capitalized-stem guard that used to live here (for `Next.js`) is gone: the
    coverage gate proved it unreachable, because SCRIPT_NAME matches only mjs/py/sh.
    A branch defending against inputs it cannot receive is a claim that cannot fail —
    the same class as the backtick strip a mutation test exposed. Deleted, not exempted.
    """
    return bool(re.search(r'\.(test|spec|integration|e2e|unit)$', Path(name).stem))


def strip_fences(text: str) -> str:
    """Blank out fenced blocks. A `## ` inside one is sample content, not a heading."""
    out = list(text)
    for start, end in fence_spans(text):
        for i in range(start, end):
            if out[i] != '\n':
                out[i] = ' '
    return ''.join(out)


def github_slug(heading: str) -> str:
    """GitHub's algorithm: drop backticks and punctuation, then hyphenate EACH
    remaining space — it does not collapse runs (`a — b` → `a--b`) and it does not
    trim the gap a stripped leading emoji leaves behind (`## 🚀 Deploy` → `#-deploy`)."""
    # No separate backtick strip: the punctuation class below removes them anyway.
    # (A mutation test proved that line was an equivalent mutant — dead code that looked
    # load-bearing. An assertion that cannot fail is not an assertion.)
    h = re.sub(r'[^\w\s-]', '', heading.lower())
    h = h.strip('\n\t')                 # newlines only — a leading space is significant
    return h.replace(' ', '-')


def anchors_of(text: str) -> set[str]:
    """Every anchor GitHub will actually emit for this file."""
    seen: dict[str, int] = {}
    out: set[str] = set()
    body = strip_fences(text)
    for h in HEADING.findall(body) + SETEXT.findall(body):
        slug = github_slug(h.strip())
        n = seen.get(slug, 0)
        seen[slug] = n + 1
        out.add(slug if n == 0 else f'{slug}-{n}')
    out.update(HTML_ANCHOR.findall(body))
    return out


def fence_spans(text: str) -> list[tuple[int, int]]:
    """Character ranges covered by a fenced block.

    A fence closes only on a marker of *at least* its own length, so a ``` block
    nested inside a ```` block does not close it. Counting ``` parity — which an
    earlier version of this script did — misreads exactly that case, which is the
    same defect class the script exists to catch. Fixed, not rationalized.
    """
    spans: list[tuple[int, int]] = []
    open_at: int | None = None
    open_len = 0
    open_char = ''
    for m in re.finditer(r'^[ \t]{0,3}(`{3,}|~{3,})', text, re.M):
        marker = m.group(1)
        char, length = marker[0], len(marker)
        if open_at is None:
            open_at, open_len, open_char = m.start(), length, char
        elif char == open_char and length >= open_len:
            spans.append((open_at, m.end()))
            open_at, open_len, open_char = None, 0, ''
    if open_at is not None:
        spans.append((open_at, len(text)))
    return spans


def comment_spans(text: str) -> list[tuple[int, int]]:
    """HTML comments. A link inside one is not a link."""
    return [(m.start(), m.end()) for m in re.finditer(r'<!--.*?-->', text, re.S)]


def exists_case_sensitively(path: Path) -> bool:
    """`Path.exists()` on macOS/APFS is case-blind, so `](References/ok.md)` passes
    locally and 404s on GitHub and on any Linux CI checkout. A checker whose whole
    thesis is "a link that looks fine to its author is dead in production" must not
    itself depend on the author's filesystem. Walk each component for real.
    """
    path = path.resolve()
    if not path.exists():
        return False
    cur = Path(path.anchor)
    for part in path.relative_to(cur).parts:
        try:
            if part not in os.listdir(cur):
                return False
        except OSError:
            return False
        cur = cur / part
    return True


def in_code_span(text: str, index: int) -> bool:
    """Inside a single-backtick code span on this line — i.e. quoted, not used."""
    line_start = text.rfind('\n', 0, index) + 1
    return text.count('`', line_start, index) % 2 == 1


def in_fence(text: str, index: int) -> bool:
    """A link inside a fence belongs to the *generated* document, not this one.
    A link inside an HTML comment belongs to nobody."""
    return any(start <= index < end for start, end in fence_spans(text) + comment_spans(text))


def count_of(root: Path, what: str) -> int | None:
    """The ground truth a prose count must match."""
    if what == 'rules':
        rules = root / 'references' / 'rules.md'
        if not rules.exists():
            # A sibling skill (koni-setup, koni-nextjs) states koni-docs' rule count.
            found = list(root.parent.glob('koni-docs/references/rules.md'))
            if not found:
                return None
            rules = found[0]
        return len(re.findall(r'^### RULE-\d+', rules.read_text(encoding='utf-8'), re.M))
    if what == 'subcommands':
        cli = root / 'references' / 'cli.md'
        if not cli.exists():
            return None
        body = strip_fences(cli.read_text(encoding='utf-8'))
        m = re.search(r'^## 4\..*?\n(.*?)(?=^## )', body, re.S | re.M)
        if not m:
            return None
        return len(re.findall(r'^\| `[a-z-]+` \|', m.group(1), re.M))
    if what in ('release-commit-only checks', 'release-only checks'):
        # Ground truth is the *vendored* default — the file `install-gate.sh` ships — not
        # the monorepo's own live `.koni-harness/gates.conf`. Both happen to yield the same
        # number today (the live file's extra rows are `skill-references`, two-phase, and
        # `tests`, pre-push — neither is release-commit-only), so this is a choice on
        # principle, not one the current data forces: the docs describe what a consumer
        # receives (LESSONS §30 — a repo runs two configs; document the one you hand out).
        conf = root / 'scripts' / 'gates.conf'
        if not conf.exists():
            # Only reached when a skill OTHER than koni-harness states the count. No doc
            # does today; the path exists so a sibling stating it is measured, not skipped
            # — the same fallback shape the rule count uses.
            found = list(root.parent.glob('koni-harness/scripts/gates.conf'))
            if not found:
                return None
            conf = found[0]
        n = parsed = 0
        for row in conf.read_text(encoding='utf-8').splitlines():
            row = row.strip()
            if not row or row.startswith('#'):
                continue
            field = [c.strip() for c in row.split('|')]
            # name | script | phases(csv) | severity | arg  — "release-commit only" means
            # the phase list is exactly that one phase.
            if len(field) < 3:
                continue
            parsed += 1
            if field[2] == 'release-commit':
                n += 1
        # Fail safe, not loud: a config we could not parse at all is an environment
        # problem, and reporting "there are 0" would flip every correct claim in the repo
        # into a defect — the cry-wolf failure this checker is built to avoid.
        return n if parsed else None
    return None


def check(root: Path) -> list[str]:
    problems: list[str] = []
    # Find the repo root by locating `.git`, not by counting directory levels — the old
    # `root.parent.parent` silently changed the script-search root when the checker was
    # invoked on a path of a different shape. Bounded: outside a repo (a sandbox copy,
    # a tarball) fall back to the scan root rather than walking up to `/` and rglob-ing
    # the whole filesystem.
    repo = root
    for _ in range(6):
        if (repo / '.git').exists():
            break
        if repo == repo.parent:
            break
        repo = repo.parent
    else:
        repo = root
    if not (repo / '.git').exists():
        repo = root
    cache: dict[Path, str] = {}

    def read(p: Path) -> str:
        if p not in cache:
            cache[p] = p.read_text(encoding='utf-8')
        return cache[p]

    for md in sorted(root.rglob('*.md')):
        # The self-test's fixtures are deliberately broken — that is their job. Skip
        # them when sweeping a skill, but NOT when they are themselves the target
        # (relative_to(root)), or the self-test would silently pass on garbage.
        if '__tests__' in md.relative_to(root).parts:
            continue
        text = read(md)
        own_anchors = anchors_of(text)

        for m in ANCHOR_LINK.finditer(text):
            if in_fence(text, m.start()):
                continue
            if m.group(1) not in own_anchors:
                problems.append(f'{md}: dead anchor #{m.group(1)}')

        for m in FILE_LINK.finditer(text):
            target_raw = m.group(1)
            # `](...)` / `](path)` in prose are illustrations, not links.
            if '/' not in target_raw and '.' not in target_raw:
                continue
            if set(target_raw) <= {'.'}:
                continue
            if in_fence(text, m.start()) or is_external(target_raw) or is_placeholder(target_raw):
                continue
            if Path(target_raw).name in CONSUMER_DOCS:
                continue          # lives in the consumer's docs/, not in the skill
            target = (md.parent / m.group(1)).resolve()
            if not exists_case_sensitively(target):
                problems.append(f'{md}: dead link -> {m.group(1)}')
                continue
            if m.group(2) and target.suffix == '.md':
                if m.group(2) not in anchors_of(read(target)):
                    problems.append(f'{md}: dead anchor {m.group(1)}#{m.group(2)}')

        for pattern in (REF_DEF, HTML_SRC):
            for m in pattern.finditer(text):
                t = m.group(1)
                if in_fence(text, m.start()) or is_external(t) or is_placeholder(t):
                    continue
                if '/' not in t and '.' not in t:
                    continue
                path, _, frag = t.partition('#')
                if Path(path).name in CONSUMER_DOCS:
                    continue
                tgt = md.parent / path
                if path and not exists_case_sensitively(tgt):
                    problems.append(f'{md}: dead link -> {t}')
                    continue
                # The fragment was previously split off and thrown away, so a dead
                # anchor inside an HTML href or a reference definition was invisible.
                anchors = own_anchors if not path else (
                    anchors_of(read(tgt)) if tgt.suffix == '.md' else set())
                if frag and tgt.suffix in ('', '.md') and frag not in anchors:
                    problems.append(f'{md}: dead anchor {t}')

        siblings = root.parent  # sibling skills — cross-skill pointers are legitimate
        for m in SECTION_POINTER.finditer(text):
            if is_placeholder(m.group(1)) or Path(m.group(1)).name in CONSUMER_DOCS:
                continue
            # In the linked form [`label.md`](real/path.md) §Sec, the BACKTICK is a
            # label and the HREF is the path. Resolving the label was how a correct
            # pointer got reported dead — a false positive is the same failure as a
            # false green: it teaches people to ignore the gate.
            cited = m.group(2) or m.group(1)
            cited = cited.split('#')[0]
            target = md.parent / cited
            if not exists_case_sensitively(target):
                if '/' in cited:
                    problems.append(f'{md}: §-pointer path does not resolve -> {cited}')
                    continue
                def outside_fixtures(q: Path) -> bool:
                    # Only the deliberately-FAKE files are excluded — `__tests__/fixtures`.
                    # A skill's real tests (koni-agent-monitoring ships `leak-test.mjs`)
                    # are legitimate targets; excluding all of `__tests__` reported them
                    # as ghosts. Relative to the scan root, so the fixtures still resolve
                    # normally when they are themselves the target.
                    try:
                        return 'fixtures' not in q.relative_to(root).parts
                    except ValueError:
                        return 'fixtures' not in q.parts

                matches = ([q for q in root.rglob(cited) if outside_fixtures(q)]
                           or [q for q in siblings.rglob(cited) if outside_fixtures(q)])
                if not matches:
                    problems.append(f'{md}: §-pointer to a file that does not exist -> {cited}')
                    continue
                target = matches[0]
            named = m.group(3).strip()
            if '–' in named or '—' in named:
                continue    # "§0–§1" is a range, not a heading
            # "§3 for the per-document contract" names section 3; the rest is prose.
            head = named.split()[0] if named.split() else named
            if re.fullmatch(r'\d+[a-z]?', head):
                named = head
            wanted = github_slug(named)
            headings = [h.strip() for h in HEADING.findall(strip_fences(read(target)))]
            slugs = [github_slug(h) for h in headings]
            if re.fullmatch(r'\d+[a-z]?', named):
                # "§3" means the section numbered 3 — match "## 3. Title", never "## 30.".
                # "§2b" is a sub-label a heading carries inline, e.g. "## Deadline (§2b …)".
                ok = any(re.match(rf'{re.escape(named)}\.\s', h) or f'§{named}' in h
                         for h in headings)
            else:
                # A §pointer may be shorter than the heading ("§Scripts" → "## Scripts
                # reference") or trail into prose ("§Alive for details" → "## Alive").
                # Accept either direction, on a word boundary.
                ok = any(sl == wanted
                         or sl.startswith(wanted + '-')
                         or wanted.startswith(sl + '-')
                         for sl in slugs)
            if not ok:
                problems.append(f'{md}: dead §-pointer -> {m.group(1)} §{named}')

        for m in STATED_COUNT.finditer(text):
            # A quoted count is a *mention* — a doc describing the drift, not committing it.
            # Same rule as the retired-form check: quote it, or own it.
            # Whichever alternative matched supplies the number and the noun.
            num_at = m.start('n1') if m.group('n1') else m.start('n2')
            if in_fence(text, m.start()) or in_code_span(text, num_at):
                continue
            raw = (m.group('n1') or m.group('n2')).lower()
            what = (m.group('w1') or m.group('w2')).lower()
            claimed = WORD_NUM.get(raw, int(raw) if raw.isdigit() else None)
            if claimed is None:
                continue
            actual = count_of(root, what)
            if actual is not None and claimed != actual:
                problems.append(
                    f'{md}: stated count is wrong -> claims {claimed} {what}, there are {actual}'
                )

        for m in RETIRED_NUMERIC_SECTION.finditer(text):
            if in_fence(text, m.start()):
                continue
            # The ONLY exemption is a quoted mention. A doc naming the retired form to say
            # it is retired always quotes it (`PRD §8`); prose that *uses* it never does.
            # The previous exemption was a ±160-char window looking for words like "not"
            # and "→" — ordinary English — so it exempted 15 of the 17 real §-pointers in
            # this skill. An escape hatch keyed on natural language is an open door.
            # m.start() is the boundary char BEFORE the label, which sits outside the
            # code span — measure at the label itself.
            if in_code_span(text, m.start(1)) or in_fence(text, m.start(1)):
                continue
            problems.append(
                f'{md}: retired numeric doc section -> {m.group(1)} §{m.group(2)} '
                f'(address it by label — the label-only convention)'
            )

        for m in SCRIPT_NAME.finditer(text):
            if (in_fence(text, m.start()) or is_placeholder(m.group(1))
                    or is_prose_not_a_script(m.group(1))):
                continue
            name = Path(m.group(1)).name
            def script_ok(q: Path) -> bool:
                if {'node_modules', '.git'} & set(q.parts):
                    return False
                try:
                    return 'fixtures' not in q.relative_to(root).parts
                except ValueError:
                    return 'fixtures' not in q.parts

            found = ([q for q in root.rglob(name) if script_ok(q)]
                     or [q for q in repo.rglob(name) if script_ok(q)])
            if not found:
                problems.append(f'{md}: names a script that does not exist -> {m.group(1)}')

    return problems


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else 'skills/koni-docs').resolve()
    if not root.is_dir():
        print(f'not a directory: {root}', file=sys.stderr)
        return 2
    problems = check(root)
    for p in problems:
        print(p)
    print(f'\n{len(problems)} dangling reference(s) in {root}')
    return 1 if problems else 0


if __name__ == '__main__':
    raise SystemExit(main())
