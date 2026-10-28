#!/usr/bin/env node
// Downloads the photos listed in seed/images.manifest.json into seed/images/ (gitignored),
// validates content type and size, and writes seed/images.attribution.md.
//   node scripts/seed/images.mjs [--dry-run] [--only=<id>,<id>]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, readJson, IMAGES_DIR, SEED_DIR, log, warn, pool, loadCatalog, validateCatalog } from './lib.mjs';

const MIN = 40 * 1024;          // smaller than this is almost certainly an error page
const MAX = 15 * 1024 * 1024;   // Shopify file limit is 20 MB; keep well below
const args = parseArgs();
const manifest = readJson('images.manifest.json');

const problems = validateCatalog(loadCatalog(), manifest);
if (problems.length) { console.error('Manifest/catalog problems:\n - ' + problems.join('\n - ')); process.exit(1); }

const allowedLicences = new Set(['Unsplash License', 'Pexels License', 'Pixabay Content License', 'CC0']);
for (const i of manifest.images) if (!allowedLicences.has(i.licence)) { console.error(`image ${i.id}: licence "${i.licence}" is not permitted`); process.exit(1); }

const list = manifest.images.filter((i) => !args.only || args.only.has(i.id));
log(`images: ${list.length} of ${manifest.images.length} selected${args.dryRun ? ' (DRY RUN, nothing downloaded)' : ''}`);

function attribution() {
  const rows = manifest.images.map((i) => `| ${i.file} | ${i.use}: ${i.target} | [${i.photographer}](${i.photographerUrl}) | ${i.source} | [${i.licence}](${i.licenceUrl}) | [photo page](${i.photoPage}) |`);
  return `# Image attribution\n\nAll demo photographs are used under permissive licences that allow commercial use without permission. Attribution is not required by these licences but is given here as a courtesy.\n\n| File | Used for | Photographer | Source | Licence | Link |\n| --- | --- | --- | --- | --- | --- |\n${rows.join('\n')}\n\nThe photographs are stand-ins that show the theme's layout. They are not photographs of the listed products.\n`;
}

if (args.dryRun) {
  for (const i of list) log(`  would download ${i.file} <- ${i.downloadUrl.slice(0, 70)}...`);
  log(`  would write seed/images.attribution.md (${manifest.images.length} rows)`);
  process.exit(0);
}

fs.mkdirSync(IMAGES_DIR, { recursive: true });
let failed = 0;
await pool(list, 4, async (img) => {
  const dest = path.join(IMAGES_DIR, img.file);
  if (fs.existsSync(dest) && fs.statSync(dest).size >= MIN) { log(`  skip ${img.file} (exists)`); return; }
  try {
    const res = await fetch(img.downloadUrl, { redirect: 'follow', headers: { 'User-Agent': 'northline-seed/1.0' } });
    const type = res.headers.get('content-type') || '';
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!/^image\/(jpeg|png|webp)/.test(type)) throw new Error(`unexpected content-type ${type}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < MIN || buf.length > MAX) throw new Error(`size ${buf.length} outside ${MIN}..${MAX}`);
    fs.writeFileSync(dest, buf);
    log(`  saved ${img.file} (${Math.round(buf.length / 1024)} KB)`);
  } catch (e) { failed++; warn(`${img.file}: ${e.message}`); }
});
fs.writeFileSync(path.join(SEED_DIR, 'images.attribution.md'), attribution());
log(`wrote seed/images.attribution.md${failed ? `; ${failed} download(s) failed` : ''}`);
process.exit(failed ? 1 : 0);
