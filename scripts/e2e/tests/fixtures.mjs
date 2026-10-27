// Shared fixtures: storefront password gate, console error capture, discovery helpers.
import fs from 'node:fs';
import path from 'node:path';
import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { CFG, ROOT, MISSING_MESSAGE, hasTarget, withPreview } from '../env.mjs';

export { expect, AxeBuilder };

const NOISE = [
  /favicon/i,
  /monorail|trekkie|shopify-perf|web-pixels|\/\.well-known\/|sentry|shop\.app|shopifycloud\/(?:checkouts|shopify-perf)/i,
  /Failed to load resource.*(40[13]|429)/i,
  /Content Security Policy/i,
  /net::ERR_(BLOCKED|ABORTED|FAILED)/i,
  /ResizeObserver loop/i,
];

/** Navigate while keeping the preview theme parameter. */
export async function go(page, url, opts = {}) {
  return page.goto(withPreview(url), { waitUntil: 'domcontentloaded', ...opts });
}

async function unlock(context) {
  const page = await context.newPage();
  try {
    const res = await page.goto(withPreview('/password'), { waitUntil: 'domcontentloaded' });
    const input = page.locator('input[type="password"], input[name="password"]').first();
    if (!res || !(await input.count())) return;
    if (!CFG.password) throw new Error('Storefront is password protected: set STOREFRONT_PASSWORD in .env.local');
    if (!(await input.isVisible())) {
      const reveal = page.getByRole('button', { name: /password/i }).or(page.getByRole('link', { name: /password/i })).or(page.locator('summary, [data-password-toggle]')).first();
      if (await reveal.count()) await reveal.click();
    }
    await input.fill(CFG.password);
    await Promise.all([page.waitForLoadState('domcontentloaded'), input.press('Enter')]);
    if (await page.locator('input[type="password"]').first().isVisible().catch(() => false)) {
      throw new Error('Storefront password was rejected');
    }
  } finally {
    await page.close();
  }
}

export const test = base.extend({
  // Skip everything with a clear message when no target store is configured.
  _guard: [async ({}, use, testInfo) => {
    testInfo.skip(!hasTarget(), MISSING_MESSAGE);
    await use();
  }, { auto: true }],

  context: async ({ context }, use) => {
    if (hasTarget()) await unlock(context);
    await use(context);
  },

  // Collects console errors and uncaught exceptions on the page.
  errors: async ({ page }, use) => {
    const errors = [];
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const text = `${m.text()} ${m.location()?.url || ''}`;
      if (NOISE.some((re) => re.test(text))) return;
      errors.push(`console.error: ${m.text()} (${m.location()?.url || ''})`);
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await use(errors);
  },

  // Discovers a collection and product from navigation, with .json fallbacks.
  site: async ({ page }, use) => {
    const cache = {};
    const site = {
      async collection() {
        if (cache.collection !== undefined) return cache.collection;
        await go(page, '/collections');
        let href = await page.locator('a[href*="/collections/"]:not([href$="/collections"]):not([href*="/collections/all"]):not([href*="/products/"])').first().getAttribute('href').catch(() => null);
        if (!href) {
          const r = await page.request.get(withPreview('/collections.json?limit=1')).catch(() => null);
          const j = r && r.ok() ? await r.json().catch(() => null) : null;
          if (j?.collections?.[0]) href = `/collections/${j.collections[0].handle}`;
        }
        cache.collection = href ? href.split('?')[0] : '/collections/all';
        return cache.collection;
      },
      async product() {
        if (cache.product !== undefined) return cache.product;
        await go(page, await site.collection());
        let href = await page.locator('a[href*="/products/"]').first().getAttribute('href').catch(() => null);
        if (!href) {
          const r = await page.request.get(withPreview('/products.json?limit=1')).catch(() => null);
          const j = r && r.ok() ? await r.json().catch(() => null) : null;
          if (j?.products?.[0]) href = `/products/${j.products[0].handle}`;
        }
        cache.product = href ? href.split('?')[0] : null;
        return cache.product;
      },
      async blogArticle() {
        if (cache.article !== undefined) return cache.article;
        await go(page, '/blogs');
        let blog = await page.locator('a[href*="/blogs/"]').evaluateAll((els) =>
          els.map((e) => e.getAttribute('href')).find((h) => h && /^\/blogs\/[^/?#]+\/?(\?.*)?$/.test(h))).catch(() => null);
        if (!blog) blog = '/blogs/news';
        blog = blog.split('?')[0].replace(/\/$/, '');
        const res = await go(page, blog);
        let article = null;
        if (res && res.status() < 400) {
          article = await page.locator('a[href*="/blogs/"]').evaluateAll((els, b) =>
            els.map((e) => e.getAttribute('href')).find((h) => h && h.startsWith(`${b}/`) && h.length > b.length + 1), blog).catch(() => null);
        }
        cache.article = { blog: res && res.status() < 400 ? blog : null, article: article ? article.split('?')[0] : null };
        return cache.article;
      },
    };
    await use(site);
  },
});

/** Saves reports/screens/<project>/<name>.png */
export async function shot(page, testInfo, name) {
  const dir = path.join(ROOT, 'reports', 'screens', testInfo.project.name);
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: false }).catch(() => {});
}

export async function noHorizontalScroll(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/** Run axe and return serious/critical violations in a printable form. */
export async function seriousViolations(page) {
  const results = await new AxeBuilder({ page }).exclude('#PBarNextFrame').exclude('.shopify-payment-button').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.length} node(s)) e.g. ${v.nodes[0]?.target?.join(' ')}`);
}

export async function addToCartViaApi(page, site) {
  const handle = await site.product();
  if (!handle) return false;
  const r = await page.request.get(withPreview(`${handle}.js`));
  if (!r.ok()) return false;
  const p = await r.json();
  const variant = p.variants.find((v) => v.available) || p.variants[0];
  const add = await page.request.post('/cart/add.js', { data: { id: variant.id, quantity: 1 } });
  return add.ok();
}
