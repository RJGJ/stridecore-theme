// Generates docs/reference.md (every section, block and theme setting) from the real schemas,
// so the merchant documentation cannot drift from the code. Usage: node scripts/docs/gen-reference.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const SKIP = new Set(['header', 'paragraph']);

const settingRow = (s) => {
  if (SKIP.has(s.type)) return null;
  const extra = s.options ? ` Options: ${s.options.map((o) => o.label || o.value).join(', ')}.` : '';
  const info = s.info ? ` ${s.info}` : '';
  return `| ${s.label || s.id} | ${s.type} | ${(info + extra).trim() || ''} |`;
};
const table = (settings = []) => {
  const rows = settings.map(settingRow).filter(Boolean);
  return rows.length ? ['| Setting | Type | Notes |', '| --- | --- | --- |', ...rows, ''].join('\n') : '_No settings._\n';
};

const out = ['# Settings reference', '', 'Generated from the theme schemas by `node scripts/docs/gen-reference.mjs`. Do not edit by hand.', ''];

out.push('## Theme settings', '');
const groups = JSON.parse(read('config/settings_schema.json')).filter((g) => g.name && g.name !== 'theme_info');
for (const g of groups) {
  out.push(`### ${g.name}`, '', table(g.settings));
}

out.push('## Sections', '');
const sections = fs.readdirSync(path.join(ROOT, 'sections')).filter((f) => f.endsWith('.liquid')).sort();
for (const f of sections) {
  const m = /{%-?\s*schema\s*-?%}([\s\S]*?){%-?\s*endschema\s*-?%}/.exec(read(`sections/${f}`));
  if (!m) continue;
  const schema = JSON.parse(m[1]);
  out.push(`### ${schema.name}`, '', `File: \`sections/${f}\`${schema.presets ? ' · Available in the section picker' : ''}`, '', table(schema.settings));
  if (schema.blocks?.length) {
    out.push('**Blocks**', '');
    for (const b of schema.blocks) {
      out.push(`- **${b.name || b.type}**${b.limit ? ` (max ${b.limit})` : ''}`);
    }
    out.push('');
  }
}
fs.writeFileSync(path.join(ROOT, 'docs', 'reference.md'), out.join('\n'));
console.log(`wrote docs/reference.md (${out.length} lines)`);
