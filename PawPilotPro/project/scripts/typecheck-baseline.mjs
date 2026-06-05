#!/usr/bin/env node
// Phase 0.2 typecheck baseline — same contract as lint-baseline.mjs:
// new type errors block; pre-existing debt (burned down in Phase 3.3) does not.
//   node scripts/typecheck-baseline.mjs record | check
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const BASELINE = new URL('../tsc-baseline.json', import.meta.url);
const mode = process.argv[2];

function currentCounts() {
  let out = '';
  try {
    out = execSync('npx tsc --noEmit', {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    out = (e.stdout ?? '') + (e.stderr ?? '');
  }
  const counts = {};
  let total = 0;
  for (const line of out.split('\n')) {
    const m = line.match(/^(.+?)\(\d+,\d+\): error TS\d+/);
    if (!m) continue;
    counts[m[1]] = (counts[m[1]] ?? 0) + 1;
    total += 1;
  }
  return { total, files: counts };
}

if (mode === 'record') {
  const snap = currentCounts();
  writeFileSync(BASELINE, JSON.stringify(snap, null, 1));
  console.log(`Typecheck baseline recorded: ${snap.total} errors`);
} else if (mode === 'check') {
  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
  const now = currentCounts();
  const regressions = [];
  for (const [file, n] of Object.entries(now.files)) {
    const base = baseline.files[file] ?? 0;
    if (n > base) regressions.push(`${file}: ${n} errors (baseline ${base})`);
  }
  if (regressions.length) {
    console.error('Type errors vs baseline:\n' + regressions.join('\n'));
    process.exit(1);
  }
  console.log(`Typecheck OK vs baseline (now ${now.total} / baseline ${baseline.total}).`);
  if (now.total < baseline.total) {
    console.log('Count went DOWN — re-record the baseline in this PR to lock in the gain.');
  }
} else {
  console.error('Usage: node scripts/typecheck-baseline.mjs <record|check>');
  process.exit(1);
}
