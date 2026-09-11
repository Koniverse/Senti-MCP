#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const rootFlag = args.indexOf('--root');
const root = rootFlag === -1 ? process.cwd() : path.resolve(args[rootFlag + 1]);

const sprintsDir = path.join(root, 'docs/sprints');
const sprintFiles = readdirSync(sprintsDir)
  .filter((f) => /^sprint-\d{4}-W\d{2}\.md$/.test(f))
  .sort();

if (sprintFiles.length === 0) {
  console.error('FAIL: No sprint files found in docs/sprints/');
  process.exit(1);
}

let totalFailures = 0;

const PROHIBITED_HEADINGS = [
  /^##\s+Phased plan/i,
  /^##\s+Dependencies and sequencing constraints/i,
  /^##\s+Risks & dependencies/i,
  /^##\s+Phase\s+\d+\s*—\s*plan/i,
];

console.log(`check-sprint-files — scanning ${sprintFiles.length} sprint files`);

for (const file of sprintFiles) {
  const filePath = path.join(sprintsDir, file);
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  const fileFailures = [];

  // Check 1: Exactly one ## Sprint scope
  const scopeHeadings = lines.filter((l) => /^##\s+Sprint scope\b/i.test(l));
  if (scopeHeadings.length === 0) {
    fileFailures.push('missing "## Sprint scope" heading');
  } else if (scopeHeadings.length > 1) {
    fileFailures.push(`found ${scopeHeadings.length} "## Sprint scope" headings (expected exactly 1)`);
  }

  // Check 2: No prohibited headings
  for (const line of lines) {
    for (const pattern of PROHIBITED_HEADINGS) {
      if (pattern.test(line)) {
        fileFailures.push(`found prohibited heading: "${line.trim()}"`);
      }
    }
  }

  // Check 3: Check table presence under ## Sprint scope
  const scopeIndex = lines.findIndex((l) => /^##\s+Sprint scope\b/i.test(l));
  if (scopeIndex !== -1) {
    const nextLines = lines.slice(scopeIndex + 1, scopeIndex + 15);
    const hasTable = nextLines.some((l) => /^\|.*\|.*\|/.test(l));
    if (!hasTable) {
      fileFailures.push('no markdown table found under "## Sprint scope"');
    }
  }

  // Check 4: Mid-window additions format
  for (const [idx, line] of lines.entries()) {
    if (line.includes('added') && line.startsWith('|')) {
      const validAdded = /[_*]\(added \d{4}-\d{2}-\d{2}\)[_*]/.test(line);
      if (!validAdded) {
        fileFailures.push(`line ${idx + 1}: mid-window addition does not match format "_(added YYYY-MM-DD)_" or "*(added YYYY-MM-DD)*": ${line.trim()}`);
      }
    }
  }

  if (fileFailures.length === 0) {
    console.log(`  ok    ${file} — 1 scope table, valid structure`);
  } else {
    totalFailures += fileFailures.length;
    for (const err of fileFailures) {
      console.log(`  FAIL  ${file} — ${err}`);
    }
  }
}

if (totalFailures > 0) {
  console.error(`\ncheck-sprint-files: ${totalFailures} failure(s) found.`);
  process.exit(1);
} else {
  console.log(`\ncheck-sprint-files: all ${sprintFiles.length} sprint files conform to conventions.`);
}
