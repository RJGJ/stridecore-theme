#!/usr/bin/env node
// Emits GraphQL documents (query + variables as JSON) for seeding through a
// connector that executes Admin GraphQL on your behalf, instead of an API token.
// Usage: node scripts/seed/emit.mjs <products|publish|collections|pages|blog|menus|policies|discount|location> [--batch=2]
// Reads dist/connector/ids.json (ids discovered from the store) when needed.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadCatalog, readJson, expandProduct, productHtml } from './lib.mjs';

const OUT = path.join(ROOT, 'dist', 'connector');
fs.mkdirSync(OUT, { recursive: true });
const what = process.argv[2];
const batch = Number((process.argv.find((a) => a.startsWith('--batch=')) || '--batch=2').split('=')[1]);
const catalog = loadCatalog();
// Compact demo: 4 colors and sizes S-XL keep the connector payloads small.
if (!process.argv.includes('--full')) {
  catalog.colors = catalog.colors.slice(0, 4);
  catalog.sizes = ['S', 'M', 'L', 'XL'];
}
const manifest = readJson('images.manifest.json');
const idsFile = path.join(OUT, 'ids.json');
const ids = fs.existsSync(idsFile) ? JSON.parse(fs.readFileSync(idsFile, 'utf8')) : {};
const UE = 'userErrors { field message }';
const write = (name, query, variables) => {
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify({ query, variables }));
  console.log(`wrote ${name}.json (${JSON.stringify({ query, variables }).length} bytes)`);
};
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

if (what === 'products') {
  const locationId = ids.locationId;
  if (!locationId) throw new Error('ids.locationId missing');
  const inputs = catalog.products.map((p) => {
    const { optionValues, variants } = expandProduct(catalog, p);
    const imgs = manifest.images.filter((i) => i.use === 'product' && i.target === p.handle);
    const input = {
      handle: p.handle,
      title: p.title,
      descriptionHtml: productHtml(p),
      vendor: p.vendor,
      productType: p.type,
      tags: p.tags,
      status: 'ACTIVE',
      seo: { title: p.seoTitle, description: p.seoDescription },
      productOptions: p.options.map((name, idx) => ({ name, position: idx + 1, values: optionValues[name].map((n) => ({ name: n })) })),
      variants: variants.map((v) => ({
        optionValues: v.optionValues,
        price: v.price,
        ...(v.compareAtPrice ? { compareAtPrice: v.compareAtPrice } : {}),
        ...(p.giftCard ? { taxable: false, inventoryItem: { tracked: false, requiresShipping: false } } : { inventoryItem: { tracked: true }, inventoryQuantities: [{ locationId, name: 'available', quantity: v.qty }] }),
        ...(v.unitPriceMeasurement ? { unitPriceMeasurement: v.unitPriceMeasurement, showUnitPrice: true } : {}),
      })),
    };
    if (p.giftCard) input.giftCard = true;
    if (imgs.length) input.files = imgs.map((i) => ({ originalSource: i.downloadUrl, contentType: 'IMAGE', alt: i.alt }));
    return input;
  });
  chunk(inputs, batch).forEach((group, bi) => {
    const decl = group.map((_, i) => `$i${i}: ProductSetInput!`).join(', ');
    const body = group.map((_, i) => `a${i}: productSet(input: $i${i}, synchronous: true) { product { id handle } ${UE} }`).join('\n');
    const variables = Object.fromEntries(group.map((g, i) => [`i${i}`, g]));
    write(`products-${String(bi).padStart(2, '0')}`, `mutation(${decl}) {\n${body}\n}`, variables);
  });
} else if (what === 'publish') {
  const pub = ids.onlineStorePublication;
  const productIds = Object.values(ids.products || {});
  const body = productIds.map((id, i) => `p${i}: publishablePublish(id: "${id}", input: [{publicationId: "${pub}"}]) { ${UE} }`).join('\n');
  write('publish-products', `mutation {\n${body}\n}`, {});
  const colIds = Object.values(ids.collections || {});
  if (colIds.length) {
    write('publish-collections', `mutation {\n${colIds.map((id, i) => `c${i}: publishablePublish(id: "${id}", input: [{publicationId: "${pub}"}]) { ${UE} }`).join('\n')}\n}`, {});
  }
} else if (what === 'collections') {
  const group = catalog.collections.filter((c) => c.type === 'smart');
  const decl = group.map((_, i) => `$c${i}: CollectionInput!`).join(', ');
  const body = group.map((_, i) => `a${i}: collectionCreate(input: $c${i}) { collection { id handle } ${UE} }`).join('\n');
  const variables = Object.fromEntries(group.map((c, i) => [`c${i}`, { title: c.title, handle: c.handle, descriptionHtml: c.descriptionHtml, ruleSet: { appliedDisjunctively: false, rules: c.rules } }]));
  write('collections-smart', `mutation(${decl}) {\n${body}\n}`, variables);
  const man = catalog.collections.filter((c) => c.type === 'manual');
  man.forEach((c, i) => {
    write(`collection-manual-${i}`, `mutation($input: CollectionInput!) { collectionCreate(input: $input) { collection { id handle } ${UE} } }`, {
      input: { title: c.title, handle: c.handle, descriptionHtml: c.descriptionHtml, products: (c.products || []).map((h) => ids.products?.[h]).filter(Boolean) },
    });
  });
} else if (what === 'pages') {
  const group = catalog.pages;
  const parts = [];
  const variables = {};
  group.forEach((pg, i) => {
    const page = { title: pg.title, handle: pg.handle, body: pg.body, isPublished: true, ...(pg.templateSuffix ? { templateSuffix: pg.templateSuffix } : {}) };
    const existing = ids.pages?.[pg.handle];
    if (existing) { parts.push(`a${i}: pageUpdate(id: "${existing}", page: $p${i}) { page { id handle } ${UE} }`); variables[`p${i}`] = page; }
    else { parts.push(`a${i}: pageCreate(page: $p${i}) { page { id handle } ${UE} }`); variables[`p${i}`] = page; }
  });
  const decl = group.map((pg, i) => `$p${i}: ${ids.pages?.[pg.handle] ? 'PageUpdateInput!' : 'PageCreateInput!'}`).join(', ');
  write('pages', `mutation(${decl}) {\n${parts.join('\n')}\n}`, variables);
} else if (what === 'blog') {
  const b = catalog.blog;
  const blogId = ids.blogId;
  const group = b.articles;
  chunk(group, 3).forEach((g, bi) => {
    const decl = g.map((_, i) => `$a${i}: ArticleCreateInput!`).join(', ');
    const body = g.map((_, i) => `a${i}: articleCreate(article: $a${i}) { article { id handle } ${UE} }`).join('\n');
    const variables = Object.fromEntries(g.map((a, i) => {
      const img = manifest.images.find((m) => m.use === 'article' && m.target === a.handle);
      const article = { blogId, title: a.title, handle: a.handle, body: a.body, summary: a.summary, author: { name: a.author }, tags: a.tags, isPublished: true };
      if (img) article.image = { url: img.downloadUrl, altText: img.alt };
      return [`a${i}`, article];
    }));
    write(`articles-${bi}`, `mutation(${decl}) {\n${body}\n}`, variables);
  });
} else if (what === 'menus') {
  const build = (items) => items.map((it) => {
    let type = it.type; let resourceId; let url = it.url;
    if (it.ref) {
      const [kind, handle] = it.ref.split(':');
      const map = { collection: ids.collections, page: ids.pages, blog: { [catalog.blog.handle]: ids.blogId } }[kind] || {};
      resourceId = map?.[handle];
      if (kind === 'collection' && handle === 'all') { type = 'HTTP'; url = '/collections/all'; resourceId = undefined; }
      else if (!resourceId) { type = 'HTTP'; url = `/${kind === 'blog' ? 'blogs' : kind + 's'}/${handle}`; }
    }
    const out = { title: it.title, type };
    if (type === 'HTTP' || type === 'SEARCH') out.url = url; else if (resourceId) out.resourceId = resourceId;
    if (it.items) out.items = build(it.items);
    return out;
  });
  catalog.menus.forEach((m) => {
    const existing = ids.menus?.[m.handle];
    const items = build(m.items);
    if (existing) write(`menu-${m.handle}`, `mutation($id: ID!, $title: String!, $handle: String, $items: [MenuItemUpdateInput!]!) { menuUpdate(id: $id, title: $title, handle: $handle, items: $items) { menu { id } ${UE} } }`, { id: existing, title: m.title, handle: m.handle, items });
    else write(`menu-${m.handle}`, `mutation($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) { menuCreate(title: $title, handle: $handle, items: $items) { menu { id } ${UE} } }`, { title: m.title, handle: m.handle, items });
  });
} else if (what === 'policies') {
  const entries = Object.entries(catalog.policies);
  const decl = entries.map((_, i) => `$p${i}: ShopPolicyInput!`).join(', ');
  const body = entries.map((_, i) => `a${i}: shopPolicyUpdate(shopPolicy: $p${i}) { shopPolicy { id type } ${UE} }`).join('\n');
  write('policies', `mutation(${decl}) {\n${body}\n}`, Object.fromEntries(entries.map(([type, b], i) => [`p${i}`, { type, body: b }])));
} else if (what === 'discount') {
  const d = catalog.discount;
  write('discount', `mutation($d: DiscountAutomaticBasicInput!) { discountAutomaticBasicCreate(automaticBasicDiscount: $d) { automaticDiscountNode { id } ${UE} } }`, {
    d: { title: d.title, startsAt: new Date().toISOString(), combinesWith: { productDiscounts: false, orderDiscounts: false, shippingDiscounts: true }, minimumRequirement: { subtotal: { greaterThanOrEqualToSubtotal: d.minimumSubtotal } }, customerGets: { value: { percentage: d.percentage }, items: { all: true } } },
  });
} else {
  console.error('Unknown target. See header comment.');
  process.exit(1);
}
