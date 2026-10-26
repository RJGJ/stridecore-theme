// Shared helpers for the QA scripts. Read-only: never writes to theme files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const THEME_DIRS = ['assets', 'blocks', 'config', 'layout', 'locales', 'sections', 'snippets', 'templates'];

export function walk(dir, filter = () => true, out = []) {
  const abs = path.isAbsolute(dir) ? dir : path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const p = path.join(abs, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      walk(p, filter, out);
    } else if (filter(p)) out.push(p);
  }
  return out;
}

export const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
export const read = (p) => fs.readFileSync(p, 'utf8');

export function lineOfIndex(text, idx) {
  let n = 1;
  for (let i = 0; i < idx && i < text.length; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

/** Extract every {% schema %} body with the offset of its JSON in the file. */
export function extractSchema(text) {
  const m = /\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/.exec(text);
  if (!m) return null;
  const start = m.index + m[0].indexOf(m[1]);
  return { raw: m[1], start, startLine: lineOfIndex(text, start) };
}

/** Collector of findings with severities. */
export class Report {
  constructor(name) {
    this.name = name;
    this.items = [];
  }
  add(sev, file, line, rule, msg) {
    this.items.push({ sev, file, line: line || 1, rule, msg });
  }
  error(file, line, rule, msg) { this.add('error', file, line, rule, msg); }
  warn(file, line, rule, msg) { this.add('warn', file, line, rule, msg); }
  print({ max = Infinity } = {}) {
    const byRule = new Map();
    for (const i of this.items) {
      if (!byRule.has(i.rule)) byRule.set(i.rule, []);
      byRule.get(i.rule).push(i);
    }
    for (const [rule, list] of [...byRule].sort()) {
      const e = list.filter((x) => x.sev === 'error').length;
      const w = list.length - e;
      console.log(`\n[${rule}] ${e} error(s), ${w} warning(s)`);
      for (const i of list.slice(0, max)) {
        console.log(`  ${i.sev === 'error' ? 'ERROR' : 'warn '} ${i.file}:${i.line}  ${i.msg}`);
      }
      if (list.length > max) console.log(`  ... ${list.length - max} more`);
    }
    const errors = this.items.filter((i) => i.sev === 'error').length;
    const warnings = this.items.length - errors;
    console.log(`\nSUMMARY ${this.name}: errors=${errors} warnings=${warnings}`);
    return { errors, warnings };
  }
}

export function parseArgs(argv = process.argv.slice(2)) {
  const o = { _: [] };
  for (const a of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (m) o[m[1]] = m[2] === undefined ? true : m[2];
    else o._.push(a);
  }
  return o;
}
