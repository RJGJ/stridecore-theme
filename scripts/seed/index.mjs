#!/usr/bin/env node
// Orchestrates the seed. Usage:
//   node scripts/seed/index.mjs --dry-run
//   node scripts/seed/index.mjs --only=products,collections
// Steps: location, metaobjects, upload, products, collections, pages, blog, menus, policies, discounts
// Download images first: node scripts/seed/images.mjs
import { parseArgs, createClient, loadCatalog, readJson, validateCatalog, log, API_VERSION } from './lib.mjs';
import { STEPS } from './steps.mjs';

const args = parseArgs();
const catalog = loadCatalog();
const manifest = readJson('images.manifest.json');

const problems = validateCatalog(catalog, manifest);
if (problems.length) {
  console.error('Catalog validation failed:\n - ' + problems.join('\n - '));
  process.exit(1);
}
const names = STEPS.map(([n]) => n);
if (args.only) for (const o of args.only) if (!names.includes(o)) { console.error(`Unknown step "${o}". Steps: ${names.join(', ')}`); process.exit(1); }

const client = createClient({ dryRun: args.dryRun });
log(`Northline seed | Admin API ${API_VERSION} | ${args.dryRun ? 'DRY RUN (no network)' : `store ${client.store}`}`);
log(`catalog valid: ${catalog.products.length} products, ${catalog.collections.length} collections, ${manifest.images.length} images`);

const ctx = { client, catalog, manifest, args };
const summary = [];
for (const [name, fn] of STEPS) {
  if (args.only && !args.only.has(name)) continue;
  const t = Date.now();
  log(`\n== ${name} ==`);
  try {
    await fn(ctx);
    summary.push([name, 'ok', Date.now() - t]);
  } catch (e) {
    summary.push([name, `FAILED: ${e.message}`, Date.now() - t]);
    console.error(`step ${name} failed: ${e.message}`);
    if (!args.flags.has('keep-going')) break;
  }
}
log('\nSummary');
for (const [n, s, ms] of summary) log(`  ${n.padEnd(12)} ${s} (${ms} ms)`);
log(`API calls: ${client.calls}`);
if (summary.some(([, s]) => s !== 'ok')) process.exit(1);
