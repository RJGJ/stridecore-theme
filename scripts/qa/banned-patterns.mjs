#!/usr/bin/env node
// Greps theme files for patterns the Theme Store review rejects.
import fs from 'node:fs';
import path from 'node:path';
import { Report, walk, rel, read, lineOfIndex, parseArgs } from './lib.mjs';

const args = parseArgs();
const R = new Report('banned-patterns');

const DIRS = ['assets', 'blocks', 'config', 'layout', 'locales', 'sections', 'snippets', 'templates'];
const files = DIRS.flatMap((d) => walk(d, (f) => /\.(liquid|css|js|mjs|json|svg|html)$/i.test(f)));
const allFiles = DIRS.flatMap((d) => walk(d));

const COLOR_FILE_ALLOW = /snippets[\\/]color-scheme-vars\.liquid$/;
const URL_ALLOW = /(www\.w3\.org|schema\.org|xmlns|cdn\.shopify\.com|fonts\.shopifycdn\.com)/i;

/** Blank out regions we should not scan, preserving offsets/line numbers. */
function mask(text, ext) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  let t = text;
  if (ext === '.liquid') {
    t = t.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, blank);
    t = t.replace(/\{%-?\s*doc\s*-?%\}[\s\S]*?\{%-?\s*enddoc\s*-?%\}/g, blank);
  }
  return t;
}
function maskSchema(text) {
  return text.replace(/\{%-?\s*schema\s*-?%\}[\s\S]*?\{%-?\s*endschema\s*-?%\}/g, (m) => m.replace(/[^\n]/g, ' '));
}
function maskComments(text, ext) {
  let t = text;
  if (ext === '.css' || ext === '.js' || ext === '.mjs' || ext === '.liquid') t = t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  if (ext === '.js' || ext === '.mjs') t = t.replace(/(^|[^:'"`])\/\/[^\n]*/g, (m, p) => p + m.slice(p.length).replace(/[^\n]/g, ' '));
  if (ext === '.liquid') t = t.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
  return t;
}

function scan(re, text, cb) {
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(text))) {
    cb(m);
    if (m[0].length === 0) re.lastIndex++;
  }
}

// ---- file-level rules ----
for (const f of allFiles) {
  const r = rel(f);
  const base = path.basename(f);
  if (/\.min\.(js|css)$/i.test(base)) R.error(r, 1, 'minified-asset', 'minified file; ship readable source (only ES6+ or third-party libraries are exempt)');
  if (/\.scss(\.liquid)?$/i.test(base)) R.error(r, 1, 'scss', 'Sass/SCSS is not allowed; use native CSS');
  if (base === 'robots.txt.liquid') R.error(r, 1, 'robots', 'robots.txt.liquid is not allowed');
}
for (const f of walk('.', (p) => /\.scss(\.liquid)?$/i.test(p))) R.error(rel(f), 1, 'scss', 'Sass/SCSS is not allowed');

// ---- content rules ----
for (const f of files) {
  const r = rel(f);
  const ext = path.extname(f).toLowerCase();
  const raw = read(f);
  const isLiquid = ext === '.liquid';
  const isCode = ['.liquid', '.css', '.js', '.mjs'].includes(ext);
  const text = mask(raw, ext);
  const ln = (i) => lineOfIndex(raw, i);

  // Lorem ipsum anywhere (including json/locales)
  scan(/lorem\s+ipsum|\blorem\b/gi, raw, (m) => R.error(r, ln(m.index), 'lorem', `placeholder text "${m[0]}"`));

  if (!isCode) {
    continue;
  }
  const code = maskComments(text, ext);

  // hard-coded http(s) URLs
  scan(/https?:\/\/[^\s"'`)<>]*/gi, code, (m) => {
    const ctxStart = Math.max(0, m.index - 40);
    const around = code.slice(ctxStart, m.index + m[0].length + 5);
    // Shopify's documented default YouTube placeholder used in video presets
    if (URL_ALLOW.test(m[0]) || /xmlns/i.test(around) || m[0].includes('_9VUPq3SxOc')) return;
    R.error(r, ln(m.index), 'hard-coded-url', `hard-coded URL ${m[0].slice(0, 80)}; use protocol-relative or Liquid objects`);
  });

  if (ext === '.css' || ext === '.js' || ext === '.mjs') {
    scan(/console\.log\s*\(/g, code, (m) => R.error(r, ln(m.index), 'console-log', 'console.log left in code'));
  }

  if (!isLiquid && ext !== '.css') {
    // JS color literals are rare; fall through to color rule below
  }

  // hard-coded colors outside color-scheme-vars
  if (!COLOR_FILE_ALLOW.test(f)) {
    const cc = isLiquid ? maskSchema(code) : code;
    scan(/(^|[\s:(,"'])(#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8}))(?![0-9a-zA-Z_-])/g, cc, (m) => {
      const pre = cc.slice(Math.max(0, m.index - 12), m.index + 1);
      if (/href\s*=\s*["']?$/i.test(pre) || /url\(\s*$/.test(pre) || /["']#$/.test(pre)) return;
      // skip if the token is an in-page anchor-ish such as #main (not hex-only length) – regex already ensures hex only.
      R.warn(r, ln(m.index + m[1].length), 'hard-coded-color', `hex color ${m[2]}; use a color scheme variable`);
    });
    scan(/\b(rgba?|hsla?)\(\s*\d/g, cc, (m) => R.warn(r, ln(m.index), 'hard-coded-color', `${m[1]}() literal color; use a color scheme variable`));
  }

  if (!isLiquid) continue;
  const html = maskSchema(code);

  // href="/" literal paths
  scan(/\b(href|action)\s*=\s*["']\/(?!\/)/gi, html, (m) => R.error(r, ln(m.index), 'routes', `${m[1]}="/..." literal; use the routes object`));

  // external scripts
  scan(/<script\b[^>]*\bsrc\s*=\s*["']?\s*https?:/gi, html, (m) => R.error(r, ln(m.index), 'external-script', 'script loaded from an absolute http(s) URL'));
  scan(/<link\b(?![^>]*\brel\s*=\s*["'](?:preconnect|dns-prefetch))[^>]*\bhref\s*=\s*["']?\s*https?:/gi, html, (m) => R.error(r, ln(m.index), 'external-script', 'stylesheet/link loaded from an absolute http(s) URL'));

  // .min references
  scan(/\.min\.(js|css)\b/gi, html, (m) => R.error(r, ln(m.index), 'minified-asset', `reference to ${m[0]}`));

  // content_for_header modification
  scan(/content_for_header\s*\|/g, html, (m) => R.error(r, ln(m.index), 'content-for-header', 'content_for_header must not be filtered or modified'));

  // links to Shopify domains need rel=nofollow
  scan(/<a\b[^>]*>/gis, html, (m) => {
    const tag = m[0];
    {
      const href = /href\s*=\s*["']([^"']*)["']/i.exec(tag);
      if (href && /shopify\.com|myshopify\.com/i.test(href[1]) && !/rel\s*=\s*["'][^"']*nofollow/i.test(tag)) {
        R.error(r, ln(m.index), 'nofollow', `link to a Shopify domain without rel="nofollow": ${href[1].slice(0, 60)}`);
      }
    }
    if (/target\s*=\s*["']_blank["']/i.test(tag) && !/rel\s*=\s*["'][^"']*noopener/i.test(tag)) {
      R.error(r, ln(m.index), 'noopener', 'target="_blank" without rel="noopener"');
    }
  });
  scan(/<form\b[^>]*target\s*=\s*["']_blank["'][^>]*>/gi, html, (m) => {
    if (!/noopener/i.test(m[0])) R.error(r, ln(m.index), 'noopener', 'form target="_blank" without rel="noopener"');
  });

  // img without alt
  scan(/<img\b[^>]*>/gis, html, (m) => {
    if (!/\balt\s*=/i.test(m[0])) R.error(r, ln(m.index), 'img-alt', '<img> without alt attribute');
  });

  // form controls without id
  scan(/<(input|textarea|select)\b[^>]*>/gis, html, (m) => {
    const tag = m[0];
    const type = /\btype\s*=\s*["']?([a-z]+)/i.exec(tag);
    if (type && ['hidden', 'submit', 'button', 'image', 'reset'].includes(type[1].toLowerCase())) return;
    if (!/\bid\s*=/i.test(tag)) R.error(r, ln(m.index), 'input-id', `<${m[1]}> without id (labels need a matching for/id pair)`);
  });
}

const { errors } = R.print({ max: Number(args.max) || 25 });
process.exit(errors ? 1 : 0);
