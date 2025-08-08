#!/usr/bin/env node
// scripts/run_e2e_tests.js
// Lightweight Playwright test runner wrapper that invokes Playwright, captures raw output,
// produces a minimal summary JSON and a failures log to help triage failing tests.
// Non-intrusive: does not modify production code or tests.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const outDir = path.resolve(process.cwd(), 'test-results');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const PLAYWRIGHT_CMD = 'npx';
const PLAYWRIGHT_ARGS = ['playwright', 'test', '--reporter=json'];

// Allow passing extra args through to Playwright, e.g. node scripts/run_e2e_tests.js -- grep "@smoke"
const extraArgs = process.argv.slice(2);
if (extraArgs.length) {
  PLAYWRIGHT_ARGS.push(...extraArgs);
}

console.log('Running Playwright:', PLAYWRIGHT_CMD, PLAYWRIGHT_ARGS.join(' '));
const res = spawnSync(PLAYWRIGHT_CMD, PLAYWRIGHT_ARGS, { encoding: 'utf8' });

// Write raw outputs for debugging
const rawOutPath = path.join(outDir, 'raw-output.log');
fs.writeFileSync(rawOutPath, `STDOUT\n\n${res.stdout || ''}\n\nSTDERR\n\n${res.stderr || ''}`);
const rawJsonPath = path.join(outDir, 'playwright-output.json');
fs.writeFileSync(rawJsonPath, res.stdout || '');

// Basic, robust extraction of pass/fail counts using simple regex heuristics against Playwright json reporter output
const stdout = res.stdout || '';
const passedMatches = stdout.match(/"status"\s*:\s*"passed"/g) || [];
const failedMatches = stdout.match(/"status"\s*:\s*"failed"/g) || [];
const flakyMatches = stdout.match(/"status"\s*:\s*"flaky"/g) || [];
const total = passedMatches.length + failedMatches.length + flakyMatches.length;

// Attempt to compute total duration by summing "duration" fields if present (duration in ms)
let durationMs = null;
const durationMatches = stdout.match(/"duration"\s*:\s*(\d+)/g);
if (durationMatches && durationMatches.length) {
  try {
    durationMs = durationMatches.reduce((acc, cur) => acc + Number(cur.replace(/[^0-9]/g, '')), 0);
  } catch (e) {
    durationMs = null;
  }
}

// Failures log: keep raw output plus an extracted failures section to make triage easier
const failuresLogPath = path.join(outDir, 'failures.log');
let failuresSummary = '';
if (failedMatches.length > 0) {
  failuresSummary += `Found ${failedMatches.length} failing test(s).\n\n`;
  // Try to extract blocks around failed tests by searching for status failed and grabbing surrounding context
  const lines = stdout.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('"status"') && lines[i].includes('failed')) {
      // Capture a small window of lines around the failure
      const start = Math.max(0, i - 10);
      const end = Math.min(lines.length - 1, i + 30);
      failuresSummary += lines.slice(start, end + 1).join('\n') + '\n\n' + '-'.repeat(80) + '\n\n';
    }
  }
  failuresSummary += '\n\n-- Full raw output is available in raw-output.log and playwright-output.json --\n';
} else {
  failuresSummary = 'No failing tests detected in the Playwright json output.\n' +
    'If tests fail but are not detected as failed here, consult raw-output.log in test-results/.\n';
}
fs.writeFileSync(failuresLogPath, failuresSummary);

// Final structured summary
const summary = {
  total: total,
  passed: passedMatches.length,
  failed: failedMatches.length,
  flaky: flakyMatches.length,
  duration_ms: durationMs,
  raw: {
    raw_output: rawOutPath,
    raw_json: rawJsonPath,
    failures_log: failuresLogPath
  }
};

const summaryPath = path.join(outDir, 'summary.json');
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

console.log('Summary written to', summaryPath);
console.log('Failures log written to', failuresLogPath);
console.log('Raw output written to', rawOutPath);

// Exit with Playwright exit code if available, otherwise non-zero if failures seen
if (typeof res.status === 'number') {
  process.exit(res.status);
} else {
  process.exit(summary.failed > 0 ? 1 : 0);
}