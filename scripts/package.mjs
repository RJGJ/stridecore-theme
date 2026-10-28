// Builds dist/stridecore-<version>.zip containing only theme directories.
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZipArchive } from 'archiver';

const root = fileURLToPath(new URL('..', import.meta.url));
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const dirs = ['assets', 'blocks', 'config', 'layout', 'listings', 'locales', 'sections', 'snippets', 'templates'];
const skip = new Set(['config/markets.json']);

const problems = [];
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

mkdirSync(join(root, 'dist'), { recursive: true });
const out = join(root, 'dist', `stridecore-${version}.zip`);
const archive = new ZipArchive({ zlib: { level: 9 } });
archive.pipe(createWriteStream(out));

for (const d of dirs) {
  const dir = join(root, d);
  if (!existsSync(dir)) continue;
  for (const file of walk(dir)) {
    const rel = relative(root, file).split(sep).join('/');
    if (skip.has(rel)) continue;
    if (/\.min\.(js|css)$/.test(rel) || rel.endsWith('.scss') || rel.endsWith('.scss.liquid')) problems.push(rel);
    if (/\.(env|pem|key)$/.test(rel)) problems.push(rel);
    archive.file(file, { name: rel });
  }
}

if (problems.length) {
  console.error('Refusing to package, forbidden files:\n' + problems.join('\n'));
  process.exit(1);
}
await archive.finalize();
console.log(`Wrote ${out}`);
