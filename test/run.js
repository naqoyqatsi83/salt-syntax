#!/usr/bin/env node
// Runs every test/*.test.js (with node) and test/*.test.py (with python3),
// each in its own process, and exits non-zero if any fails.
//
//   node test/run.js            all tests
//   node test/run.js indent     only files whose name contains "indent"
//   node test/run.js -v         print every test's output, not just failures'
//
// A Python test that needs something unavailable (python3, a package, or
// network access for Salt's source) exits with code 77 to report "skipped".

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const verbose = args.includes('-v');
const filter = args.find((a) => !a.startsWith('-'));
const dir = __dirname;
const files = fs
  .readdirSync(dir)
  .filter((f) => /\.test\.(js|py)$/.test(f) && (!filter || f.includes(filter)))
  .sort();

let failed = 0;
let skipped = 0;
for (const f of files) {
  const [cmd, ...cmdArgs] = f.endsWith('.py') ? [process.env.PYTHON || 'python3', path.join(dir, f)] : [process.execPath, path.join(dir, f)];
  const started = Date.now();
  // NODE: lets a Python test call back into this same node (e.g. to read extension.js's datasets).
  const res = spawnSync(cmd, cmdArgs, { encoding: 'utf8', cwd: path.join(dir, '..'), timeout: 120000, env: { ...process.env, NODE: process.execPath } });
  const took = `${((Date.now() - started) / 1000).toFixed(1)}s`;
  const output = `${res.stdout || ''}${res.stderr || ''}${res.error ? String(res.error) : ''}`;
  if (res.status === 0) {
    console.log(`  ok    ${f} (${took})`);
    if (verbose) console.log(output.replace(/^/gm, '        '));
  } else if (res.status === 77) {
    skipped++;
    console.log(`  skip  ${f} -- ${output.trim().split('\n').pop()}`);
  } else {
    failed++;
    console.log(`  FAIL  ${f} (${took})`);
    console.log(output.replace(/^/gm, '        '));
  }
}
console.log(`\n${files.length - failed - skipped} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed ? 1 : 0);
