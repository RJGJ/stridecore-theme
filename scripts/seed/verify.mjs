#!/usr/bin/env node
// Re-queries the store and checks it against seed/catalog.json.
//   node scripts/seed/verify.mjs [--dry-run] [--only=products,collections,pages,blog,menus,policies,discounts]
import { parseArgs, createClient, loadCatalog, readJson, expandProduct, validateCatalog, log, API_VERSION } from './lib.mjs';

const args = parseArgs();
const catalog = loadCatalog();
const manifest = readJson('images.manifest.json');
const problems = validateCatalog(catalog, manifest);
if (problems.length) { console.error('Catalog invalid:\n - ' + problems.join('\n - ')); process.exit(1); }
const client = createClient({ dryRun: args.dryRun });
const want = (n) => !args.only || args.only.has(n);
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok }); log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`); };

log(`verify | Admin API ${API_VERSION} | ${args.dryRun ? 'DRY RUN: listing the checks that would run' : client.store}`);

const expectedSale = catalog.products.filter((p) => p.compareAtPrice).length;
const expectedVariants = Object.fromEntries(catalog.products.map((p) => [p.handle, expandProduct(catalog, p).variants.length]));

if (!client.live) {
  log(`products: ${catalog.products.length} handles, variant counts per product, ${expectedSale} on sale (compare-at), 1 sold out, 1 low stock, 1 gift card, unit price on grip-chalk, images present`);
  log(`collections: ${catalog.collections.length}; pages: ${catalog.pages.length}; blog ${catalog.blog.handle}: ${catalog.blog.articles.length} articles; menus: ${catalog.menus.map((m) => m.handle).join(', ')} (main-menu depth 3); policies: ${Object.keys(catalog.policies).length}; automatic discount: 1`);
  process.exit(0);
}

if (want('products')) {
  let onSale = 0;
  for (const p of catalog.products) {
    const d = await client.gql(`query($h: String!) { productByIdentifier(identifier: {handle: $h}) { id status tags totalInventory isGiftCard mediaCount { count } variants(first: 100) { nodes { price compareAtPrice unitPriceMeasurement { quantityValue } } } } }`, { h: p.handle }, { label: 'verify product' });
    const n = d.productByIdentifier;
    if (!n) { check(`product ${p.handle}`, false, 'missing'); continue; }
    const vc = n.variants.nodes.length;
    check(`product ${p.handle}`, vc === expectedVariants[p.handle] && n.status === 'ACTIVE', `${vc}/${expectedVariants[p.handle]} variants`);
    if (n.variants.nodes.some((v) => v.compareAtPrice)) onSale++;
    if (p.soldOut) check(`${p.handle} sold out`, n.totalInventory === 0, `inventory ${n.totalInventory}`);
    if (p.lowStock) check(`${p.handle} low stock`, n.totalInventory > 0 && n.totalInventory <= 3 * vc, `inventory ${n.totalInventory}`);
    if (p.giftCard) check(`${p.handle} is gift card`, n.isGiftCard === true);
    if (p.unitPrice) check(`${p.handle} unit price`, n.variants.nodes.every((v) => v.unitPriceMeasurement?.quantityValue));
    if (manifest.images.some((i) => i.use === 'product' && i.target === p.handle)) check(`${p.handle} has media`, n.mediaCount.count > 0, `${n.mediaCount.count}`);
  }
  check('products on sale', onSale === expectedSale, `${onSale}/${expectedSale}`);
}
if (want('collections')) {
  for (const c of catalog.collections) {
    const d = await client.gql(`query($h: String!) { collectionByIdentifier(identifier: {handle: $h}) { id productsCount { count } } }`, { h: c.handle }, { label: 'verify collection' });
    const n = d.collectionByIdentifier;
    check(`collection ${c.handle}`, !!n && n.productsCount.count > 0, n ? `${n.productsCount.count} products` : 'missing');
  }
}
if (want('pages')) {
  for (const p of catalog.pages) {
    const d = await client.gql(`query($q: String!) { pages(first: 1, query: $q) { nodes { handle templateSuffix isPublished } } }`, { q: `handle:${p.handle}` }, { label: 'verify page' });
    const n = d.pages.nodes[0];
    check(`page ${p.handle}`, !!n && n.isPublished && (n.templateSuffix || '') === (p.templateSuffix || ''), n ? `suffix "${n.templateSuffix || ''}"` : 'missing');
  }
}
if (want('blog')) {
  const d = await client.gql(`query($q: String!) { blogs(first: 5, query: $q) { nodes { handle articlesCount { count } articles(first: 50) { nodes { handle image { url } } } } } }`, { q: `handle:${catalog.blog.handle}` }, { label: 'verify blog' });
  const b = d.blogs.nodes.find((x) => x.handle === catalog.blog.handle);
  check('blog news exists', !!b);
  if (b) {
    const have = new Set(b.articles.nodes.map((a) => a.handle));
    check('blog articles', catalog.blog.articles.every((a) => have.has(a.handle)), `${b.articlesCount.count} total`);
    check('blog article images', b.articles.nodes.filter((a) => a.image?.url).length >= catalog.blog.articles.length);
  }
}
if (want('menus')) {
  const d = await client.gql(`query { menus(first: 50) { nodes { handle items { title items { title items { title } } } } } }`, {}, { label: 'verify menus' });
  for (const m of catalog.menus) {
    const n = d.menus.nodes.find((x) => x.handle === m.handle);
    check(`menu ${m.handle}`, !!n && n.items.length === m.items.length, n ? `${n.items.length} items` : 'missing');
    if (m.handle === 'main-menu' && n) check('main-menu has 3 levels', n.items.some((i) => i.items.some((j) => j.items.length > 0)));
  }
}
if (want('policies')) {
  const d = await client.gql(`query { shop { shopPolicies { type body } } }`, {}, { label: 'verify policies' });
  for (const t of Object.keys(catalog.policies)) check(`policy ${t}`, d.shop.shopPolicies.some((p) => p.type === t && p.body.length > 50));
}
if (want('discounts')) {
  const d = await client.gql(`query { discountNodes(first: 100, query: "type:automatic") { nodes { discount { ... on DiscountAutomaticBasic { title } } } } }`, {}, { label: 'verify discount' });
  check('automatic discount', d.discountNodes.nodes.some((n) => n.discount?.title === catalog.discount.title));
}
const failed = results.filter((r) => !r.ok).length;
log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
