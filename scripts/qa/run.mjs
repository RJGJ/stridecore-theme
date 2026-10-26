#!/usr/bin/env node
// Runs every QA check and prints a summary. Usage: yarn qa [--skip-check] [--max=N]
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { ROOT, parseArgs } from './lib.mjs';

const args = parseArgs();
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const extra = args.max ? [`--max=${args.max}`] : [];

const steps = [
  { name: 'schema-rules', cmd: process.execPath, argv: [path.join(here, 'schema-rules.mjs'), ...extra] },
  { name: 'banned-patterns', cmd: process.execPath, argv: [path.join(here, 'banned-patterns.mjs'), ...extra] },
  { name: 'contrast', cmd: process.execPath, argv: [path.join(here, 'contrast.mjs')] },
];

if (!args['skip-check']) {
  const isWin = process.platform === 'win32';
  const bin = path.join(ROOT, 'node_modules', '.bin', isWin ? 'shopify.cmd' : 'shopify');
  if (fs.existsSync(bin)) {
    steps.push({ name: 'theme-check', cmd: bin, argv: ['theme', 'check', '--path', ROOT, '--fail-level', 'error'], shell: isWin });
  } else {
    console.log('! local Shopify CLI not found (run yarn install); skipping theme check');
  }
}

const results = [];
for (const s of steps) {
  console.log(`\n${'='.repeat(78)}\n== ${s.name}\n${'='.repeat(78)}`);
  const t0 = Date.now();
  const r = spawnSync(s.cmd, s.argv, { cwd: ROOT, encoding: 'utf8', shell: !!s.shell, maxBuffer: 64 * 1024 * 1024 });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  process.stdout.write(out);
  const m = /SUMMARY [\w-]+: errors=(\d+) warnings=(\d+)/.exec(out);
  let errors = m ? Number(m[1]) : null;
  let warnings = m ? Number(m[2]) : null;
  if (s.name === 'theme-check') {
    const t = /(\d+) offenses? found|(\d+) errors?/i.exec(out);
    const e = /(\d+)\s+errors?/i.exec(out), w = /(\d+)\s+warnings?/i.exec(out);
    errors = e ? Number(e[1]) : r.status ? 1 : 0;
    warnings = w ? Number(w[1]) : 0;
    void t;
  }
  results.push({ name: s.name, status: r.status, errors, warnings, secs: ((Date.now() - t0) / 1000).toFixed(1) });
}

console.log(`\n${'='.repeat(78)}\nQA SUMMARY\n${'='.repeat(78)}`);
for (const r of results) {
  const ok = r.status === 0;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(16)} errors=${String(r.errors ?? '?').padEnd(4)} warnings=${String(r.warnings ?? '?').padEnd(4)} (${r.secs}s)`);
}
const failed = results.filter((r) => r.status !== 0);
console.log(failed.length ? `\n${failed.length} check(s) failed` : '\nAll checks passed');
process.exit(failed.length ? 1 : 0);
