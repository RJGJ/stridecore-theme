#!/usr/bin/env node
// Lighthouse (programmatic) on home, first collection and first product, mobile + desktop,
// 3 runs each, median scores. Reads .env.local like the Playwright suite.
//
// Usage: yarn lighthouse [--runs=3] [--only=mobile|desktop] [--pages=home,collection,product]
import fs from 'node:fs';
import path from 'node:path';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import * as chromeLauncher from 'chrome-launcher';
import { CFG, ROOT, MISSING_MESSAGE, hasTarget, withPreview } from './env.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));
const RUNS = Number(args.runs) || 3;
const OUT = path.join(ROOT, 'reports', 'lighthouse');
const THRESH = { performance: { fail: 60, warn: 80 }, accessibility: { fail: 90, warn: 100 } };

if (!hasTarget()) {
  console.log(MISSING_MESSAGE);
  process.exit(0);
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };

/* ---------------------------- password gate cookie ---------------------------- */

function cookieHeader(jar) { return [...jar].map(([k, v]) => `${k}=${v}`).join('; '); }
function absorb(jar, res) {
  const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  for (const c of list) {
    const [pair] = c.split(';');
    const i = pair.indexOf('=');
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}
async function http(url, { jar, method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method, body, redirect: 'manual',
    headers: { cookie: cookieHeader(jar), 'user-agent': 'Mozilla/5.0 kinetic-qa', ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
  });
  absorb(jar, res);
  return res;
}

/** POST the storefront password form and return the storefront_digest cookie (or null if no gate). */
async function storefrontDigest() {
  const jar = new Map();
  let res = await http(`${CFG.baseURL}${withPreview('/password')}`, { jar });
  const html = res.status === 200 ? await res.text() : '';
  if (!/name=["']password["']|type=["']password["']/i.test(html)) return { jar, digest: null };
  if (!CFG.password) throw new Error('Storefront is password protected: set STOREFRONT_PASSWORD in .env.local');
  const token = /name=["']authenticity_token["'][^>]*value=["']([^"']+)["']/i.exec(html)?.[1];
  const form = new URLSearchParams({ form_type: 'storefront_password', utf8: '✓', password: CFG.password });
  if (token) form.set('authenticity_token', token);
  res = await http(`${CFG.baseURL}/password`, { jar, method: 'POST', body: form.toString() });
  const digest = jar.get('storefront_digest');
  if (!digest) throw new Error(`Password POST returned ${res.status} without a storefront_digest cookie (wrong password?)`);
  return { jar, digest };
}

async function discover(jar) {
  const get = async (p) => {
    const r = await http(`${CFG.baseURL}${withPreview(p)}`, { jar });
    return r.status === 200 ? r.text() : '';
  };
  const first = (html, re) => { const m = re.exec(html); return m ? m[1].split('?')[0] : null; };
  const colList = await get('/collections');
  let collection = first(colList, /href=["'](\/collections\/(?!all["'?#])[^"'?#\/]+)["'?#]/i) || '/collections/all';
  const colHtml = await get(collection);
  let product = first(colHtml, /href=["'](\/(?:collections\/[^"'/]+\/)?products\/[^"'?#]+)["'?#]/i);
  if (!product) {
    const r = await http(`${CFG.baseURL}/products.json?limit=1`, { jar });
    const j = r.status === 200 ? await r.json().catch(() => null) : null;
    if (j?.products?.[0]) product = `/products/${j.products[0].handle}`;
  }
  return { home: '/', collection, product };
}

/* --------------------------------- chrome --------------------------------- */

async function cdp(wsUrl, method, params) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method, params }));
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id === 1) { ws.close(); m.error ? reject(new Error(m.error.message)) : resolve(m.result); } };
    ws.onerror = (e) => reject(new Error(`CDP error: ${e.message || e}`));
  });
}

async function launchChrome(digest) {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'], logLevel: 'silent' });
  if (digest) {
    const v = await (await fetch(`http://127.0.0.1:${chrome.port}/json/version`)).json();
    await cdp(v.webSocketDebuggerUrl, 'Storage.setCookies', {
      cookies: [{ name: 'storefront_digest', value: digest, domain: new URL(CFG.baseURL).hostname, path: '/', secure: CFG.baseURL.startsWith('https'), httpOnly: true }],
    });
  }
  return chrome;
}

/* ---------------------------------- main ---------------------------------- */

const { jar, digest } = await storefrontDigest();
const urls = await discover(jar);
const wanted = (args.pages ? String(args.pages).split(',') : ['home', 'collection', 'product']).filter((p) => urls[p]);
const factors = args.only ? [String(args.only)] : ['mobile', 'desktop'];

console.log(`Target ${CFG.baseURL}${CFG.previewThemeId ? ` (preview theme ${CFG.previewThemeId})` : ''}${digest ? ' [password gate passed]' : ''}`);
console.log(`Pages: ${wanted.map((p) => `${p}=${urls[p]}`).join('  ')}  runs=${RUNS}\n`);
fs.mkdirSync(OUT, { recursive: true });

const rows = [];
const chrome = await launchChrome(digest);
try {
  for (const factor of factors) {
    for (const page of wanted) {
      const url = `${CFG.baseURL}${withPreview(urls[page])}`;
      const runs = [];
      for (let i = 0; i < RUNS; i++) {
        process.stdout.write(`  ${factor} ${page} run ${i + 1}/${RUNS}...\r`);
        const flags = { port: chrome.port, output: ['json', 'html'], onlyCategories: ['performance', 'accessibility'], disableStorageReset: true, logLevel: 'error' };
        const r = await lighthouse(url, flags, factor === 'desktop' ? desktopConfig : undefined);
        if (!r || r.lhr.runtimeError) { console.log(`\n  run failed: ${r?.lhr?.runtimeError?.message || 'no result'}`); continue; }
        runs.push({
          perf: Math.round((r.lhr.categories.performance.score ?? 0) * 100),
          a11y: Math.round((r.lhr.categories.accessibility.score ?? 0) * 100),
          lcp: r.lhr.audits['largest-contentful-paint']?.numericValue,
          cls: r.lhr.audits['cumulative-layout-shift']?.numericValue,
          tbt: r.lhr.audits['total-blocking-time']?.numericValue,
          report: r.report,
        });
      }
      if (!runs.length) { rows.push({ factor, page, url, error: true }); continue; }
      const perf = median(runs.map((r) => r.perf));
      const a11y = median(runs.map((r) => r.a11y));
      const rep = [...runs].sort((a, b) => Math.abs(a.perf - perf) - Math.abs(b.perf - perf))[0];
      const base = path.join(OUT, `${factor}-${page}`);
      fs.writeFileSync(`${base}.json`, rep.report[0]);
      fs.writeFileSync(`${base}.html`, rep.report[1]);
      rows.push({ factor, page, url, perf, a11y, lcp: median(runs.map((r) => r.lcp || 0)), cls: median(runs.map((r) => r.cls || 0)), tbt: median(runs.map((r) => r.tbt || 0)), n: runs.length });
    }
  }
} finally {
  await chrome.kill();
}

const grade = (v, t) => (v < t.fail ? 'FAIL' : v < t.warn ? 'warn' : 'pass');
let failed = false;
console.log('\nform factor  page        perf  a11y  LCP(ms)  TBT(ms)  CLS    result');
console.log('-----------  ----------  ----  ----  -------  -------  -----  -----------------------------');
for (const r of rows) {
  if (r.error) { failed = true; console.log(`${r.factor.padEnd(11)}  ${r.page.padEnd(10)}  no successful runs`); continue; }
  const gp = grade(r.perf, THRESH.performance), ga = grade(r.a11y, THRESH.accessibility);
  if (gp === 'FAIL' || ga === 'FAIL') failed = true;
  console.log(`${r.factor.padEnd(11)}  ${r.page.padEnd(10)}  ${String(r.perf).padEnd(4)}  ${String(r.a11y).padEnd(4)}  ${String(Math.round(r.lcp)).padEnd(7)}  ${String(Math.round(r.tbt)).padEnd(7)}  ${r.cls.toFixed(3)}  perf:${gp} a11y:${ga}`);
}
const avg = (k, f) => { const xs = rows.filter((r) => !r.error && r.factor === f).map((r) => r[k]); return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null; };
for (const f of factors) console.log(`\nAverage ${f}: performance ${avg('perf', f)} (need >= 60), accessibility ${avg('a11y', f)} (need >= 90)`);
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({ target: CFG.baseURL, runs: RUNS, rows }, null, 2));
console.log(`\nReports: ${path.relative(ROOT, OUT)}/ (json + html per page)`);
process.exit(failed ? 1 : 0);
