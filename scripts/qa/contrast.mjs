#!/usr/bin/env node
// WCAG contrast for each color scheme in config/settings_data.json.
// Mirrors the derivation in snippets/color-scheme-vars.liquid.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseArgs } from './lib.mjs';

parseArgs();

const hex = (h) => {
  let s = String(h).trim().replace('#', '');
  if (s.length === 3) s = [...s].map((c) => c + c).join('');
  const n = parseInt(s.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
export function contrast(a, b) {
  const la = lum(hex(a)), lb = lum(hex(b));
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
// Liquid color_mix: `a | color_mix: b, pct` keeps pct% of a.
const mix = (a, b, pct) => { const A = hex(a), B = hex(b); return toHex(A.map((v, i) => (v * pct + B[i] * (100 - pct)) / 100)); };

export function derive(s) {
  const ink = '#0E0E0C', white = '#FFFFFF';
  const bg = s.background;
  let fg = s.text, onAc = s.on_accent;
  const ac = s.accent;
  if (contrast(bg, fg) < 4.5) fg = contrast(bg, '#000000') > 4.6 ? '#121210' : '#FAF9F5';
  if (contrast(ac, onAc) < 4.5) onAc = contrast(ac, ink) >= contrast(ac, white) ? ink : white;
  let muted = fg;
  for (const step of [42, 34, 26, 18, 10]) {
    const cand = mix(fg, bg, 100 - step);
    if (contrast(bg, cand) >= 5) { muted = cand; break; }
  }
  return { bg, fg, ac, onAc, muted };
}

const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'settings_data.json'), 'utf8'));
const sources = [['current', data.current?.color_schemes]];
for (const [name, p] of Object.entries(data.presets || {})) sources.push([`preset ${name}`, p.color_schemes]);

let failures = 0, warnings = 0;
const rows = [];
const seen = new Set();
for (const [src, schemes] of sources) {
  for (const [id, sch] of Object.entries(schemes || {})) {
    const s = sch.settings || sch;
    const key = JSON.stringify(s);
    if (seen.has(key)) continue;
    seen.add(key);
    const d = derive(s);
    const checks = [
      ['text/background', contrast(d.bg, s.text), contrast(d.bg, d.fg), 4.5, 'body'],
      ['muted/background', null, contrast(d.bg, d.muted), 4.5, 'body'],
      ['on accent/accent', contrast(s.accent, s.on_accent), contrast(d.ac, d.onAc), 4.5, 'body'],
      ['accent/background', null, contrast(d.bg, d.ac), 3, 'ui'],
    ];
    for (const [label, raw, eff, min, kind] of checks) {
      const ok = eff >= min;
      // accent vs fg is only needed when the theme draws accent on fg surfaces; the Liquid falls back, so warn only
      const soft = label === 'accent/text';
      if (!ok) { if (soft) warnings++; else failures++; }
      const rawBad = raw !== null && raw < min;
      if (rawBad) warnings++;
      rows.push({ src: `${src}:${id}`, check: label, authored: raw === null ? '' : raw.toFixed(2), effective: eff.toFixed(2), need: `${min}:1 (${kind})`, status: ok ? (rawBad ? 'ok (auto-corrected)' : 'ok') : soft ? 'WARN' : 'FAIL' });
    }
  }
}

const cols = ['src', 'check', 'authored', 'effective', 'need', 'status'];
const w = Object.fromEntries(cols.map((c) => [c, Math.max(c.length, ...rows.map((r) => String(r[c]).length))]));
console.log(cols.map((c) => c.padEnd(w[c])).join('  '));
console.log(cols.map((c) => '-'.repeat(w[c])).join('  '));
for (const r of rows) console.log(cols.map((c) => String(r[c]).padEnd(w[c])).join('  '));
console.log(`\nSUMMARY contrast: errors=${failures} warnings=${warnings}`);
process.exit(failures ? 1 : 0);
