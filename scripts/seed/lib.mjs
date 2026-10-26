// Shared helpers for the Northline Athletics seed scripts.
// Node 24, ESM, no dependencies. Never prints the Admin token.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Latest stable Admin API version as of 2026-10-26 (https://shopify.dev/docs/api/usage/versioning).
// Pinned here and nowhere else.
export const API_VERSION = '2026-10';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..', '..');
export const SEED_DIR = path.join(ROOT, 'seed');
export const IMAGES_DIR = path.join(SEED_DIR, 'images'); // gitignored
export const STATE_FILE = path.join(IMAGES_DIR, '.state.json'); // gitignored (inside seed/images/)

export function parseArgs(argv = process.argv.slice(2)) {
  const args = { dryRun: false, only: null, flags: new Set(), values: {} };
  for (const a of argv) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a.startsWith('--only=')) args.only = new Set(a.slice(7).split(',').map((s) => s.trim()).filter(Boolean));
    else if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v === undefined) args.flags.add(k);
      else args.values[k] = v;
    }
  }
  return args;
}

export function loadEnv() {
  const env = { ...process.env };
  const file = path.join(ROOT, '.env.local');
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m || line.trim().startsWith('#')) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (env[m[1]] === undefined || env[m[1]] === '') env[m[1]] = v;
    }
  }
  return env;
}

export function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(SEED_DIR, rel), 'utf8'));
}

export function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
}
export function writeState(state) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function log(...a) { console.log(...a); }
export function warn(...a) { console.warn('WARN', ...a); }

/**
 * Create a GraphQL client.
 * In dry-run mode no request is ever sent and every call returns null.
 */
export function createClient({ dryRun, env = loadEnv() }) {
  const store = (env.SHOPIFY_STORE || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const token = env.SHOPIFY_ADMIN_TOKEN || '';
  const live = !dryRun;
  if (live) {
    if (!store || !token) {
      throw new Error('Missing SHOPIFY_STORE or SHOPIFY_ADMIN_TOKEN in .env.local (use --dry-run to run without credentials).');
    }
    if (!/\.myshopify\.com$/.test(store)) throw new Error('SHOPIFY_STORE must be the *.myshopify.com domain.');
  }
  const endpoint = `https://${store}/admin/api/${API_VERSION}/graphql.json`;
  let calls = 0;

  async function gql(query, variables = {}, { label = 'query' } = {}) {
    if (!live) return null;
    for (let attempt = 0; attempt < 8; attempt++) {
      calls++;
      let res;
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
          body: JSON.stringify({ query, variables }),
        });
      } catch (e) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      if (res.status === 429 || res.status >= 500) {
        const ra = Number(res.headers.get('retry-after')) || 2 ** attempt;
        await sleep(ra * 1000);
        continue;
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error(`${label}: HTTP ${res.status} (check token and scopes)`);
      }
      const json = await res.json();
      const throttled = (json.errors || []).some((e) => e.extensions?.code === 'THROTTLED');
      if (throttled) {
        const restore = json.extensions?.cost?.throttleStatus?.restoreRate || 50;
        const need = json.extensions?.cost?.requestedQueryCost || 100;
        await sleep(Math.max(1000, Math.ceil((need / restore) * 1000)));
        continue;
      }
      if (json.errors?.length) {
        throw new Error(`${label}: GraphQL error: ${json.errors.map((e) => e.message).join('; ')}`);
      }
      // Proactive throttle: slow down when the bucket is nearly empty.
      const ts = json.extensions?.cost?.throttleStatus;
      if (ts && ts.currentlyAvailable < 150) await sleep(Math.ceil(((300 - ts.currentlyAvailable) / ts.restoreRate) * 1000));
      return json.data;
    }
    throw new Error(`${label}: gave up after repeated throttling or network errors`);
  }

  /** Run a mutation, throw on userErrors, return the payload object at `key`. */
  async function mutate(label, query, variables, key) {
    if (!live) { log(`  [dry-run] would run ${label}`); return null; }
    const data = await gql(query, variables, { label });
    const payload = data[key];
    const errs = payload?.userErrors || [];
    if (errs.length) {
      const e = new Error(`${label}: ${errs.map((u) => `${(u.field || []).join('.')}: ${u.message}`).join(' | ')}`);
      e.userErrors = errs;
      throw e;
    }
    return payload;
  }

  return { gql, mutate, live, store, get calls() { return calls; } };
}

// ---- Catalog expansion -------------------------------------------------

export function loadCatalog() { return readJson('catalog.json'); }

const abbr = (s) => s.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase();

/** Expand a compact product spec into option definitions and a variant list. */
export function expandProduct(catalog, p) {
  const optionValues = {};
  for (const opt of p.options) {
    if (p.optionValues?.[opt]) optionValues[opt] = p.optionValues[opt];
    else if (opt === 'Color') optionValues[opt] = catalog.colors.map((c) => c.name);
    else if (opt === 'Size') optionValues[opt] = catalog.sizes;
    else throw new Error(`${p.handle}: no values for option ${opt}`);
  }
  let combos = [[]];
  for (const opt of p.options) combos = combos.flatMap((c) => optionValues[opt].map((v) => [...c, { optionName: opt, name: v }]));
  const base = abbr(p.handle.split('-').map((w) => w[0]).join('') + p.handle.length);
  const variants = combos.map((ov, i) => {
    const byName = Object.fromEntries(ov.map((o) => [o.optionName, o.name]));
    const vals = ov.map((o) => o.name);
    let price = p.price;
    for (const v of vals) if (p.variantPrices?.[v]) price = p.variantPrices[v];
    if (!price) throw new Error(`${p.handle}: no price for ${vals.join('/')}`);
    for (const v of vals) {
      if (p.priceBySize?.[v]) price = p.priceBySize[v];
      if (p.priceByColor?.[v]) price = p.priceByColor[v];
    }
    let compareAt = p.compareAtPrice || null;
    for (const v of vals) if (p.compareAtByVariant?.[v]) compareAt = p.compareAtByVariant[v];
    let qty = p.soldOut ? 0 : p.lowStock ? 2 + (i % 3) : 8 + ((i * 7) % 15);
    if (!p.soldOut && !p.lowStock) qty = Math.max(qty, 6);
    for (const o of p.inventoryOverrides || []) {
      if (o.color === byName.Color && o.size === byName.Size) qty = o.qty;
    }
    const sku = ['NL', base, ...vals.map(abbr)].join('-');
    let unit = null;
    if (p.unitPrice) {
      for (const v of vals) {
        if (p.unitPrice[v]) unit = { quantityValue: p.unitPrice[v].quantity, quantityUnit: p.unitPrice.unit, referenceValue: p.unitPrice.referenceValue, referenceUnit: p.unitPrice.referenceUnit };
      }
    }
    return { optionValues: ov, price, compareAtPrice: compareAt, sku, qty, unitPriceMeasurement: unit };
  });
  return { optionValues, variants };
}

/** Static validation of the catalog and manifest. Returns an array of problems. */
export function validateCatalog(catalog, manifest) {
  const problems = [];
  const seen = new Set();
  const money = /^\d+\.\d{2}$/;
  for (const p of catalog.products) {
    if (seen.has(p.handle)) problems.push(`duplicate product handle ${p.handle}`);
    seen.add(p.handle);
    if (!p.title || !p.blurb || !p.features?.length) problems.push(`${p.handle}: missing title/blurb/features`);
    if (/lorem ipsum/i.test(JSON.stringify(p))) problems.push(`${p.handle}: contains placeholder text`);
    try {
      const { variants } = expandProduct(catalog, p);
      if (variants.length > 100) problems.push(`${p.handle}: ${variants.length} variants exceeds 100`);
      for (const v of variants) {
        if (!money.test(v.price)) problems.push(`${p.handle}: bad price ${v.price}`);
        if (v.compareAtPrice && Number(v.compareAtPrice) <= Number(v.price)) problems.push(`${p.handle}: compare-at not above price`);
      }
      const skus = new Set(variants.map((v) => v.sku));
      if (skus.size !== variants.length) problems.push(`${p.handle}: duplicate SKUs`);
    } catch (e) { problems.push(e.message); }
  }
  for (const c of catalog.collections) {
    for (const h of c.products || []) if (!seen.has(h)) problems.push(`collection ${c.handle}: unknown product ${h}`);
  }
  const articleHandles = new Set(catalog.blog.articles.map((a) => a.handle));
  for (const img of manifest.images) {
    if (!/^https:\/\//.test(img.downloadUrl)) problems.push(`image ${img.id}: bad downloadUrl`);
    for (const k of ['photoPage', 'photographer', 'licence', 'licenceUrl', 'source']) if (!img[k]) problems.push(`image ${img.id}: missing ${k}`);
    if (img.use === 'product' && !seen.has(img.target)) problems.push(`image ${img.id}: unknown product ${img.target}`);
    if (img.use === 'article' && !articleHandles.has(img.target)) problems.push(`image ${img.id}: unknown article ${img.target}`);
  }
  if (manifest.images.length < 30) problems.push(`only ${manifest.images.length} images (need 30+)`);
  return problems;
}

export function productHtml(p) {
  const lis = p.features.map((f) => `<li>${f}</li>`).join('');
  return `<p>${p.blurb}</p><ul>${lis}</ul>`;
}

/** Run an async list with limited concurrency. */
export async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}
