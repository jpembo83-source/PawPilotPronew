#!/usr/bin/env node
// Phase 0.2 lint baseline (PawPilotPro remediation prompt book).
//
//   node scripts/lint-baseline.mjs record   — snapshot current per-file error counts
//   node scripts/lint-baseline.mjs check    — fail if any file got WORSE than baseline
//
// New errors block the gate; existing debt does not. Burn-down happens in
// Phase 3.3, one module per PR. Never edit eslint-baseline.json by hand —
// re-record only when a PR legitimately reduces the count.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const BASELINE = new URL('../eslint-baseline.json', import.meta.url);
const mode = process.argv[2];

function currentCounts() {
  let out;
  try {
    out = execSync('npx eslint . --format json', {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    if (!e.stdout) throw e; // real crash, not lint errors
    out = e.stdout;
  }
  const results = JSON.parse(out);
  const counts = {};
  let totalErr = 0;
  let totalWarn = 0;
  for (const f of results) {
    if (f.errorCount === 0 && f.warningCount === 0) continue;
    const rel = f.filePath.replace(process.cwd() + '/', '');
    counts[rel] = { errors: f.errorCount, warnings: f.warningCount };
    totalErr += f.errorCount;
    totalWarn += f.warningCount;
  }
  return { totals: { errors: totalErr, warnings: totalWarn }, files: counts };
}

if (mode === 'record') {
  const snap = currentCounts();
  writeFileSync(BASELINE, JSON.stringify(snap, null, 1));
  console.log(`Baseline recorded: ${snap.totals.errors} errors, ${snap.totals.warnings} warnings`);
} else if (mode === 'check') {
  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
  const now = currentCounts();
  const regressions = [];
  for (const [file, c] of Object.entries(now.files)) {
    const base = baseline.files[file] ?? { errors: 0, warnings: 0 };
    if (c.errors > base.errors) {
      regressions.push(`${file}: ${c.errors} errors (baseline ${base.errors})`);
    }
  }
  if (regressions.length) {
    console.error('Lint regressions vs baseline:\n' + regressions.join('\n'));
    process.exit(1);
  }
  console.log(
    `Lint OK vs baseline (now ${now.totals.errors} errors / baseline ${baseline.totals.errors}).`
  );
  if (now.totals.errors < baseline.totals.errors) {
    console.log('Count went DOWN — re-record the baseline in this PR to lock in the gain.');
  }
} else {
  console.error('Usage: node scripts/lint-baseline.mjs <record|check>');
  process.exit(1);
}
