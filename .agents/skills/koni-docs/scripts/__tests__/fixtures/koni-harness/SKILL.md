---
name: fixture-koni-harness
description: >
  Fixture only — supplies `scripts/gates.conf` as the ground truth for the
  "N release-commit-only checks" claim, and states that count CORRECTLY. Not a real skill.
---
# fixture — gate inventory ground truth

The 2 release-commit-only checks do not fire on an ordinary commit; they run only
when the runner is invoked with `--phase release-commit`.

Two jobs, both asserted by the suite:

1. **Ground truth** — `fixtures/bad` (and `fixtures/good`) resolve their check-count
   against this directory's `scripts/gates.conf` through the sibling glob.
2. **A scanned root of its own** (self-test control 1b) — because this fixture *has*
   `scripts/gates.conf`, scanning it is the only thing that exercises the **primary**
   resolution path, and because the count above is **correct**, it is the only control
   proving a right count stays silent. It must pass with empty output.
