// Seed steps. Each step is idempotent, keyed on handles, and supports dry-run
// (ctx.client.live === false => no network at all).
import fs from 'node:fs';
import path from 'node:path';
import { IMAGES_DIR, loadCatalog, readJson, readState, writeState, expandProduct, productHtml, log, warn, sleep } from './lib.mjs';

const dryId = (kind, handle) => `gid://dry-run/${kind}/${handle}`;

const USER_ERRORS = 'userErrors { field message }';

// ---------------------------------------------------------------- location
async function location(ctx) {
  const { client, catalog } = ctx;
  const loc = catalog.pickupLocation;
  log(`location: ensure "${loc.name}" exists, ships online orders, local pickup enabled`);
  const d = await client.gql(`query { locations(first: 20) { nodes { id name isActive } } }`, {}, { label: 'locations' });
  let nodes = d?.locations.nodes.filter((n) => n.isActive) || [];
  let found = nodes.find((n) => n.name === loc.name);
  if (client.live && !found) {
    try {
      const p = await client.mutate('locationAdd', `mutation($input: LocationAddInput!) { locationAdd(input: $input) { location { id name } ${USER_ERRORS} } }`, {
        input: { name: loc.name, fulfillsOnlineOrders: true, address: { address1: loc.address1, city: loc.city, provinceCode: loc.provinceCode, countryCode: loc.countryCode, zip: loc.zip } },
      }, 'locationAdd');
      found = p.location;
      log(`  created location ${found.name}`);
    } catch (e) {
      warn(`${e.message}\n  Location not created (plan may not allow more locations). Using the first active location instead; add the pickup location manually (see docs/seed.md).`);
    }
  } else if (!client.live) client.mutate('locationAdd', '', {}, '');
  const target = found || nodes[0];
  ctx.locationId = target?.id || dryId('Location', 'primary');
  if (found && client.live) {
    try {
      await client.mutate('locationLocalPickupEnable', `mutation($s: DeliveryLocationLocalPickupEnableInput!) { locationLocalPickupEnable(localPickupSettings: $s) { localPickupSettings { pickupTime } ${USER_ERRORS} } }`, {
        s: { locationId: found.id, pickupTime: 'ONE_HOUR', instructions: loc.pickupInstructions },
      }, 'locationLocalPickupEnable');
      log('  local pickup enabled');
    } catch (e) { warn(`${e.message}\n  Enable local pickup manually in Settings > Shipping and delivery > Local pickup.`); }
  }
  log(`  inventory location: ${target?.name || '(dry-run)'}`);
}

// ------------------------------------------------------------- metaobjects
async function metaobjects(ctx) {
  const { client, catalog } = ctx;
  log(`metaobjects: standard color metaobject (shopify--color-pattern) with ${catalog.colors.length} entries`);
  if (!client.live) { log('  [dry-run] would enable standard definition and upsert entries'); return; }
  try {
    await client.mutate('standardMetaobjectDefinitionEnable', `mutation { standardMetaobjectDefinitionEnable(type: "shopify--color-pattern") { metaobjectDefinition { id type } ${USER_ERRORS} } }`, {}, 'standardMetaobjectDefinitionEnable');
    for (const c of catalog.colors) {
      await client.mutate(`metaobjectUpsert ${c.name}`, `mutation($h: MetaobjectHandleInput!, $m: MetaobjectUpsertInput!) { metaobjectUpsert(handle: $h, metaobject: $m) { metaobject { id handle } ${USER_ERRORS} } }`, {
        h: { type: 'shopify--color-pattern', handle: c.name.toLowerCase().replace(/\s+/g, '-') },
        m: { fields: [{ key: 'label', value: c.name }, { key: 'color', value: c.hex }] },
      }, 'metaobjectUpsert');
    }
    log('  done. Linking options to these entries is a manual or --link-colors step (see docs/seed.md).');
  } catch (e) { warn(`${e.message}\n  Falling back to plain-text Color option values; swatches come from the theme color map.`); }
}

// ------------------------------------------------------------------ upload
const STAGE = `mutation($input: [StagedUploadInput!]!) { stagedUploadsCreate(input: $input) { stagedTargets { url resourceUrl parameters { name value } } ${USER_ERRORS} } }`;

export async function stageImages(ctx, images) {
  const { client } = ctx;
  const state = readState();
  state.staged ||= {};
  const fresh = Date.now() - 6 * 3600 * 1000;
  const todo = images.filter((i) => !(state.staged[i.id] && state.staged[i.id].at > fresh));
  const missing = todo.filter((i) => !fs.existsSync(path.join(IMAGES_DIR, i.file)));
  if (missing.length) throw new Error(`Images not downloaded: ${missing.map((m) => m.id).join(', ')}. Run: node scripts/seed/images.mjs`);
  for (let i = 0; i < todo.length; i += 10) {
    const batch = todo.slice(i, i + 10);
    const input = batch.map((img) => ({ filename: img.file, mimeType: 'image/jpeg', resource: 'IMAGE', httpMethod: 'POST', fileSize: String(fs.statSync(path.join(IMAGES_DIR, img.file)).size) }));
    const p = await client.mutate('stagedUploadsCreate', STAGE, { input }, 'stagedUploadsCreate');
    for (let k = 0; k < batch.length; k++) {
      const t = p.stagedTargets[k];
      const form = new FormData();
      for (const prm of t.parameters) form.append(prm.name, prm.value);
      form.append('file', await fs.openAsBlob(path.join(IMAGES_DIR, batch[k].file)), batch[k].file);
      const r = await fetch(t.url, { method: 'POST', body: form });
      if (!r.ok) throw new Error(`staged upload failed for ${batch[k].id}: HTTP ${r.status}`);
      state.staged[batch[k].id] = { resourceUrl: t.resourceUrl, at: Date.now() };
    }
    writeState(state);
  }
  return state.staged;
}

async function waitFile(client, id) {
  for (let i = 0; i < 40; i++) {
    const d = await client.gql(`query($id: ID!) { node(id: $id) { ... on MediaImage { fileStatus image { url } } } }`, { id }, { label: 'file status' });
    const n = d.node;
    if (n?.fileStatus === 'READY' && n.image?.url) return n.image.url;
    if (n?.fileStatus === 'FAILED') throw new Error(`file ${id} failed processing`);
    await sleep(1500);
  }
  throw new Error(`file ${id} not ready in time`);
}

/** Upload hero/blog images as Files, return map imageId -> CDN url. Idempotent via state. */
async function upload(ctx) {
  const { client, manifest } = ctx;
  const needFiles = manifest.images.filter((i) => i.use === 'hero' || i.use === 'article');
  log(`upload: ${manifest.images.length} images staged; ${needFiles.length} become Files (hero + blog)`);
  if (!client.live) { log('  [dry-run] would call stagedUploadsCreate + fileCreate'); ctx.fileUrls = {}; return; }
  await stageImages(ctx, manifest.images);
  const state = readState();
  state.files ||= {};
  for (const img of needFiles) {
    if (state.files[img.id]?.url) continue;
    const staged = state.staged[img.id];
    const p = await client.mutate(`fileCreate ${img.id}`, `mutation($files: [FileCreateInput!]!) { fileCreate(files: $files) { files { id } ${USER_ERRORS} } }`, {
      files: [{ originalSource: staged.resourceUrl, contentType: 'IMAGE', alt: img.alt, filename: img.file }],
    }, 'fileCreate');
    const id = p.files[0].id;
    const url = await waitFile(client, id);
    state.files[img.id] = { id, url };
    writeState(state);
  }
  ctx.fileUrls = Object.fromEntries(Object.entries(state.files).map(([k, v]) => [k, v.url]));
  log(`  files ready: ${Object.keys(ctx.fileUrls).length}`);
}

// ---------------------------------------------------------------- publish
async function onlineStorePublication(ctx) {
  if (ctx.publicationId !== undefined) return ctx.publicationId;
  const d = await ctx.client.gql(`query { publications(first: 20) { nodes { id name } } }`, {}, { label: 'publications' });
  ctx.publicationId = d?.publications.nodes.find((n) => n.name === 'Online Store')?.id || null;
  if (ctx.client.live && !ctx.publicationId) warn('Online Store publication not found; resources will not be published.');
  return ctx.publicationId;
}
async function publish(ctx, id) {
  const pub = await onlineStorePublication(ctx);
  if (!pub || !ctx.client.live) return;
  await ctx.client.mutate('publishablePublish', `mutation($id: ID!, $input: [PublicationInput!]!) { publishablePublish(id: $id, input: $input) { userErrors { field message } } }`, { id, input: [{ publicationId: pub }] }, 'publishablePublish');
}

// --------------------------------------------------------------- products
const PRODUCT_SET = `mutation($input: ProductSetInput!, $identifier: ProductSetIdentifiers) {
  productSet(input: $input, identifier: $identifier, synchronous: true) {
    product { id handle variantsCount { count } }
    ${USER_ERRORS}
  }
}`;

async function resolveCategory(ctx, term) {
  ctx.categoryCache ||= {};
  if (term in ctx.categoryCache) return ctx.categoryCache[term];
  let id = null;
  try {
    const d = await ctx.client.gql(`query($s: String!) { taxonomy { categories(first: 1, search: $s) { nodes { id fullName } } } }`, { s: term }, { label: 'taxonomy' });
    id = d?.taxonomy?.categories?.nodes?.[0]?.id || null;
    if (id) log(`  category "${term}" -> ${d.taxonomy.categories.nodes[0].fullName}`);
  } catch (e) { warn(`taxonomy lookup failed for "${term}": ${e.message}`); }
  ctx.categoryCache[term] = id;
  return id;
}
const CATEGORY_TERMS = { Tops: 'Activewear Tops', Bottoms: 'Activewear Pants', Outerwear: 'Activewear Outerwear', Accessories: 'Sports Bags', 'Gift Cards': 'Gift Cards' };

async function products(ctx) {
  const { client, catalog, manifest } = ctx;
  log(`products: ${catalog.products.length} via productSet (identifier: handle)`);
  if (!ctx.locationId) {
    const d = await client.gql(`query { locations(first: 20) { nodes { id name isActive } } }`, {}, { label: 'locations' });
    const act = d?.locations.nodes.filter((n) => n.isActive) || [];
    ctx.locationId = (act.find((n) => n.name === catalog.pickupLocation.name) || act[0])?.id || dryId('Location', 'primary');
  }
  const staged = client.live ? await stageImages(ctx, manifest.images.filter((i) => i.use === 'product')) : {};
  ctx.productIds = {};
  let variantTotal = 0;
  for (const p of catalog.products) {
    const { optionValues, variants } = expandProduct(catalog, p);
    variantTotal += variants.length;
    const exists = client.live ? (await client.gql(`query($h: String!) { productByIdentifier(identifier: {handle: $h}) { id mediaCount { count } } }`, { h: p.handle }, { label: 'productByIdentifier' })).productByIdentifier : null;
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
        compareAtPrice: v.compareAtPrice,
        sku: v.sku,
        taxable: !p.giftCard,
        inventoryPolicy: 'DENY',
        inventoryItem: { tracked: !p.giftCard, requiresShipping: !p.giftCard },
        ...(p.giftCard ? {} : { inventoryQuantities: [{ locationId: ctx.locationId, name: 'available', quantity: v.qty }] }),
        ...(v.unitPriceMeasurement ? { unitPriceMeasurement: v.unitPriceMeasurement, showUnitPrice: true } : {}),
      })),
    };
    if (p.giftCard) input.giftCard = true;
    if (!exists && imgs.length && client.live) {
      input.files = imgs.map((i) => ({ originalSource: staged[i.id].resourceUrl, contentType: 'IMAGE', alt: i.alt, filename: i.file }));
    }
    if (client.live && !ctx.args.flags.has('no-category')) {
      const cat = await resolveCategory(ctx, CATEGORY_TERMS[p.type]);
      if (cat) input.category = cat;
    }
    const res = await client.mutate(`productSet ${p.handle}`, PRODUCT_SET, { input, identifier: { handle: p.handle } }, 'productSet');
    if (res) {
      ctx.productIds[p.handle] = res.product.id;
      await publish(ctx, res.product.id);
      log(`  ${exists ? 'updated' : 'created'} ${p.handle} (${res.product.variantsCount.count} variants)`);
    } else {
      ctx.productIds[p.handle] = dryId('Product', p.handle);
      log(`  [dry-run] ${p.handle}: ${variants.length} variants, ${imgs.length} images, price ${variants[0].price}${variants[0].compareAtPrice ? ` (compare-at ${variants[0].compareAtPrice})` : ''}`);
    }
  }
  log(`  total variants: ${variantTotal}`);
}

// ------------------------------------------------------------ collections
async function collections(ctx) {
  const { client, catalog } = ctx;
  log(`collections: ${catalog.collections.length}`);
  ctx.collectionIds = {};
  if (!ctx.productIds) ctx.productIds = await loadProductIds(ctx);
  for (const c of catalog.collections) {
    const found = client.live ? (await client.gql(`query($h: String!) { collectionByIdentifier(identifier: {handle: $h}) { id products(first: 250) { nodes { id } } } }`, { h: c.handle }, { label: 'collectionByIdentifier' })).collectionByIdentifier : null;
    const input = { title: c.title, handle: c.handle, descriptionHtml: c.descriptionHtml };
    if (c.type === 'smart') input.ruleSet = { appliedDisjunctively: false, rules: c.rules };
    let id = found?.id;
    if (found) {
      await client.mutate(`collectionUpdate ${c.handle}`, `mutation($input: CollectionInput!) { collectionUpdate(input: $input) { collection { id } ${USER_ERRORS} } }`, { input: { ...input, id: found.id } }, 'collectionUpdate');
    } else {
      const p = await client.mutate(`collectionCreate ${c.handle}`, `mutation($input: CollectionInput!) { collectionCreate(input: $input) { collection { id } ${USER_ERRORS} } }`, { input }, 'collectionCreate');
      id = p?.collection.id;
    }
    if (c.type === 'manual' && c.products?.length) {
      const have = new Set(found?.products.nodes.map((n) => n.id) || []);
      const add = c.products.map((h) => ctx.productIds[h]).filter((x) => x && !have.has(x));
      if (add.length) await client.mutate(`collectionAddProducts ${c.handle}`, `mutation($id: ID!, $p: [ID!]!) { collectionAddProducts(id: $id, productIds: $p) { collection { id } ${USER_ERRORS} } }`, { id, p: add }, 'collectionAddProducts');
    }
    ctx.collectionIds[c.handle] = id || dryId('Collection', c.handle);
    if (id) await publish(ctx, id);
    log(`  ${found ? 'updated' : 'created'} ${c.handle} (${c.type})`);
  }
}

async function loadProductIds(ctx) {
  const ids = {};
  if (!ctx.client.live) return Object.fromEntries(ctx.catalog.products.map((p) => [p.handle, dryId('Product', p.handle)]));
  for (const p of ctx.catalog.products) {
    const d = await ctx.client.gql(`query($h: String!) { productByIdentifier(identifier: {handle: $h}) { id } }`, { h: p.handle }, { label: 'productByIdentifier' });
    if (d.productByIdentifier) ids[p.handle] = d.productByIdentifier.id;
  }
  return ids;
}

// ------------------------------------------------------------------ pages
async function pages(ctx) {
  const { client, catalog } = ctx;
  log(`pages: ${catalog.pages.length}`);
  ctx.pageIds = {};
  for (const pg of catalog.pages) {
    const found = client.live ? (await client.gql(`query($q: String!) { pages(first: 1, query: $q) { nodes { id handle } } }`, { q: `handle:${pg.handle}` }, { label: 'pages' })).pages.nodes.find((n) => n.handle === pg.handle) : null;
    const page = { title: pg.title, handle: pg.handle, body: pg.body, isPublished: true };
    if (pg.templateSuffix) page.templateSuffix = pg.templateSuffix;
    let id = found?.id;
    if (found) await client.mutate(`pageUpdate ${pg.handle}`, `mutation($id: ID!, $page: PageUpdateInput!) { pageUpdate(id: $id, page: $page) { page { id } ${USER_ERRORS} } }`, { id: found.id, page }, 'pageUpdate');
    else id = (await client.mutate(`pageCreate ${pg.handle}`, `mutation($page: PageCreateInput!) { pageCreate(page: $page) { page { id } ${USER_ERRORS} } }`, { page }, 'pageCreate'))?.page.id;
    ctx.pageIds[pg.handle] = id || dryId('Page', pg.handle);
    log(`  ${found ? 'updated' : 'created'} ${pg.handle}${pg.templateSuffix ? ` (template page.${pg.templateSuffix})` : ''}`);
  }
}

// ------------------------------------------------------------------- blog
async function blog(ctx) {
  const { client, catalog, manifest } = ctx;
  const b = catalog.blog;
  log(`blog: "${b.title}" with ${b.articles.length} articles`);
  const fileUrls = ctx.fileUrls || (client.live ? Object.fromEntries(Object.entries(readState().files || {}).map(([k, v]) => [k, v.url])) : {});
  const found = client.live ? (await client.gql(`query($q: String!) { blogs(first: 5, query: $q) { nodes { id handle articles(first: 100) { nodes { id handle } } } } }`, { q: `handle:${b.handle}` }, { label: 'blogs' })).blogs.nodes.find((n) => n.handle === b.handle) : null;
  let blogId = found?.id;
  if (!found) {
    blogId = (await client.mutate('blogCreate', `mutation($blog: BlogCreateInput!) { blogCreate(blog: $blog) { blog { id } ${USER_ERRORS} } }`, { blog: { title: b.title, handle: b.handle, commentPolicy: 'MODERATED' } }, 'blogCreate'))?.blog.id;
  } else {
    await client.mutate('blogUpdate', `mutation($id: ID!, $blog: BlogUpdateInput!) { blogUpdate(id: $id, blog: $blog) { blog { id } ${USER_ERRORS} } }`, { id: blogId, blog: { title: b.title } }, 'blogUpdate');
  }
  ctx.blogId = blogId || dryId('Blog', b.handle);
  for (const a of b.articles) {
    const img = manifest.images.find((i) => i.use === 'article' && i.target === a.handle);
    const existing = found?.articles.nodes.find((n) => n.handle === a.handle);
    const article = { title: a.title, handle: a.handle, body: a.body, summary: a.summary, author: { name: a.author }, tags: a.tags, isPublished: true };
    if (img && fileUrls[img.id]) article.image = { url: fileUrls[img.id], altText: img.alt };
    if (existing) await client.mutate(`articleUpdate ${a.handle}`, `mutation($id: ID!, $article: ArticleUpdateInput!) { articleUpdate(id: $id, article: $article) { article { id } ${USER_ERRORS} } }`, { id: existing.id, article }, 'articleUpdate');
    else await client.mutate(`articleCreate ${a.handle}`, `mutation($article: ArticleCreateInput!) { articleCreate(article: $article) { article { id } ${USER_ERRORS} } }`, { article: { ...article, blogId: ctx.blogId } }, 'articleCreate');
    log(`  ${existing ? 'updated' : 'created'} article ${a.handle}${img ? ` (image ${img.id})` : ''}`);
  }
}

// ------------------------------------------------------------------ menus
function buildItems(ctx, items) {
  return items.map((it) => {
    let type = it.type; let resourceId; let url = it.url;
    if (it.ref) {
      const [kind, handle] = it.ref.split(':');
      const map = { collection: ctx.collectionIds, page: ctx.pageIds, blog: { [ctx.catalog.blog.handle]: ctx.blogId } }[kind] || {};
      resourceId = map?.[handle];
      if (kind === 'collection' && handle === 'all') { type = 'HTTP'; url = '/collections/all'; resourceId = undefined; }
      else if (!resourceId) { type = 'HTTP'; url = `/${kind === 'blog' ? 'blogs' : kind + 's'}/${handle}`; }
    }
    const out = { title: it.title, type };
    if (type === 'HTTP' || type === 'SEARCH') out.url = url;
    else if (resourceId) out.resourceId = resourceId;
    if (it.items) out.items = buildItems(ctx, it.items);
    return out;
  });
}

async function menus(ctx) {
  const { client, catalog } = ctx;
  log(`menus: ${catalog.menus.length}`);
  ctx.collectionIds ||= {}; ctx.pageIds ||= {};
  if (client.live) {
    if (!Object.keys(ctx.collectionIds).length) for (const c of catalog.collections) { const d = await client.gql(`query($h: String!) { collectionByIdentifier(identifier: {handle: $h}) { id } }`, { h: c.handle }, { label: 'collection' }); if (d.collectionByIdentifier) ctx.collectionIds[c.handle] = d.collectionByIdentifier.id; }
    if (!Object.keys(ctx.pageIds).length) for (const p of catalog.pages) { const d = await client.gql(`query($q: String!) { pages(first: 1, query: $q) { nodes { id handle } } }`, { q: `handle:${p.handle}` }, { label: 'page' }); const n = d.pages.nodes[0]; if (n) ctx.pageIds[p.handle] = n.id; }
    if (!ctx.blogId) { const d = await client.gql(`query { blogs(first: 5, query: "handle:${catalog.blog.handle}") { nodes { id handle } } }`, {}, { label: 'blog' }); ctx.blogId = d.blogs.nodes[0]?.id; }
  } else { for (const c of catalog.collections) ctx.collectionIds[c.handle] = dryId('Collection', c.handle); for (const p of catalog.pages) ctx.pageIds[p.handle] = dryId('Page', p.handle); ctx.blogId = dryId('Blog', 'news'); }
  const existing = client.live ? (await client.gql(`query { menus(first: 50) { nodes { id handle } } }`, {}, { label: 'menus' })).menus.nodes : [];
  for (const m of catalog.menus) {
    const items = buildItems(ctx, m.items);
    const depth = (arr) => 1 + Math.max(0, ...arr.map((i) => (i.items ? depth(i.items) : 0)));
    const found = existing.find((e) => e.handle === m.handle);
    if (found) await client.mutate(`menuUpdate ${m.handle}`, `mutation($id: ID!, $title: String!, $handle: String, $items: [MenuItemUpdateInput!]!) { menuUpdate(id: $id, title: $title, handle: $handle, items: $items) { menu { id } ${USER_ERRORS} } }`, { id: found.id, title: m.title, handle: m.handle, items }, 'menuUpdate');
    else await client.mutate(`menuCreate ${m.handle}`, `mutation($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) { menuCreate(title: $title, handle: $handle, items: $items) { menu { id } ${USER_ERRORS} } }`, { title: m.title, handle: m.handle, items }, 'menuCreate');
    log(`  ${found ? 'updated' : 'created'} ${m.handle} (depth ${depth(items)}, ${items.length} top-level items)`);
  }
}

// --------------------------------------------------------------- policies
async function policies(ctx) {
  const { client, catalog } = ctx;
  const entries = Object.entries(catalog.policies);
  log(`policies: ${entries.length}`);
  for (const [type, body] of entries) {
    await client.mutate(`shopPolicyUpdate ${type}`, `mutation($p: ShopPolicyInput!) { shopPolicyUpdate(shopPolicy: $p) { shopPolicy { id type } ${USER_ERRORS} } }`, { p: { type, body } }, 'shopPolicyUpdate');
    log(`  set ${type}`);
  }
}

// --------------------------------------------------------------- discounts
async function discounts(ctx) {
  const { client, catalog } = ctx;
  const d = catalog.discount;
  log(`discounts: automatic "${d.title}" ${d.percentage * 100}% off, min subtotal ${d.minimumSubtotal}`);
  if (client.live) {
    const r = await client.gql(`query { discountNodes(first: 100, query: "type:automatic") { nodes { id discount { ... on DiscountAutomaticBasic { title } } } } }`, {}, { label: 'discountNodes' });
    if (r.discountNodes.nodes.some((n) => n.discount?.title === d.title)) { log('  already exists, skipping'); return; }
  }
  await client.mutate('discountAutomaticBasicCreate', `mutation($d: DiscountAutomaticBasicInput!) { discountAutomaticBasicCreate(automaticBasicDiscount: $d) { automaticDiscountNode { id } ${USER_ERRORS} } }`, {
    d: {
      title: d.title,
      startsAt: new Date().toISOString(),
      combinesWith: { productDiscounts: false, orderDiscounts: false, shippingDiscounts: true },
      minimumRequirement: { subtotal: { greaterThanOrEqualToSubtotal: d.minimumSubtotal } },
      customerGets: { value: { percentage: d.percentage }, items: { all: true } },
    },
  }, 'discountAutomaticBasicCreate');
}

export const STEPS = [
  ['location', location],
  ['metaobjects', metaobjects],
  ['upload', upload],
  ['products', products],
  ['collections', collections],
  ['pages', pages],
  ['blog', blog],
  ['menus', menus],
  ['policies', policies],
  ['discounts', discounts],
];
