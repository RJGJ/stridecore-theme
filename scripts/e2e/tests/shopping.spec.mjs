import { test, expect, go, shot, addToCartViaApi } from './fixtures.mjs';

const DRAWER = '[data-cart-drawer], cart-drawer, dialog[id*="cart" i], [role="dialog"][id*="cart" i], [id*="cart-drawer" i]';
const COUNT = '[data-cart-count], .cart-count, .count-bubble, [id*="cart-count" i], [class*="cart-count" i]';

test.describe('home', () => {
  test('loads without console errors', async ({ page, errors }, testInfo) => {
    const res = await go(page, '/');
    expect(res?.status(), 'home status').toBeLessThan(400);
    await page.waitForLoadState('load');
    await expect(page).toHaveTitle(/.+/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    await expect(page.locator('h1').first()).toBeVisible();
    await page.waitForTimeout(1000);
    await shot(page, testInfo, 'home');
    expect(errors, errors.join('\n')).toEqual([]);
  });
});

test.describe('collection', () => {
  test('filter, sort and pagination', async ({ page, site }, testInfo) => {
    const href = await site.collection();
    await go(page, href);
    await expect(page.locator('h1').first()).toBeVisible();
    await shot(page, testInfo, 'collection');

    // Sort
    const sort = page.locator('select[name="sort_by"], select[id*="sort" i]').first();
    if (await sort.count()) {
      const options = await sort.locator('option').evaluateAll((os) => os.map((o) => o.value));
      const target = options.find((v) => v && v !== (options[0] || ''));
      expect(target, 'sort has a second option').toBeTruthy();
      await Promise.all([page.waitForURL(/sort_by=/, { timeout: 15_000 }).catch(() => null), sort.selectOption(target)]);
      await page.waitForLoadState('domcontentloaded');
      await expect.poll(() => page.url(), { timeout: 15_000 }).toContain('sort_by=');
    } else {
      const sortLinks = page.locator('a[href*="sort_by="]');
      if (await sortLinks.count()) {
        await sortLinks.first().click();
        await expect(page).toHaveURL(/sort_by=/);
      } else test.info().annotations.push({ type: 'note', description: 'No sort control found (empty collection?)' });
    }

    // Filters
    await go(page, href);
    const filter = page.locator('input[name^="filter."]:not([type="hidden"]), a[href*="filter."]').first();
    if (await filter.count()) {
      const panel = page.locator('summary, button[aria-controls*="filter" i], [data-filter-toggle], [data-facets-open]').filter({ hasText: /filter/i }).first();
      if (!(await filter.isVisible()) && (await panel.count())) await panel.click().catch(() => {});
      await filter.scrollIntoViewIfNeeded().catch(() => {});
      await filter.evaluate((el) => el.click());
      await expect.poll(() => page.url(), { timeout: 20_000 }).toContain('filter.');
      await expect(page.locator('a[href*="/products/"]').first()).toBeVisible({ timeout: 15_000 }).catch(() => {});
    } else test.info().annotations.push({ type: 'note', description: 'No storefront filters rendered (enable filters in Search & Discovery)' });

    // Pagination
    await go(page, href);
    const next = page.locator('a[rel="next"], nav[aria-label*="agination" i] a[href*="page="], .pagination a[href*="page="]').first();
    if (await next.count()) {
      await next.scrollIntoViewIfNeeded();
      await next.click();
      await expect(page).toHaveURL(/page=\d+/);
    } else test.info().annotations.push({ type: 'note', description: 'Single page of products; pagination not exercised' });
  });
});

test.describe('product', () => {
  test('variants, quantity and add to cart open the drawer', async ({ page, site, errors }, testInfo) => {
    const handle = await site.product();
    test.skip(!handle, 'No product found on the store');
    await go(page, handle);
    await expect(page.locator('h1').first()).toBeVisible();
    await shot(page, testInfo, 'product');

    // Swatch / option change
    const radios = page.locator('main input[type="radio"]:not([disabled])');
    const n = await radios.count();
    if (n > 1) {
      const before = page.url();
      const priceBefore = await page.locator('[data-price], .price, [class*="price" i]').first().innerText().catch(() => '');
      for (let i = 0; i < n; i++) {
        const r = radios.nth(i);
        if (!(await r.isChecked())) {
          await r.evaluate((el) => el.click());
          break;
        }
      }
      await page.waitForTimeout(1200);
      const changed = page.url() !== before || (await page.locator('[data-price], .price, [class*="price" i]').first().innerText().catch(() => '')) !== priceBefore;
      test.info().annotations.push({ type: 'note', description: `variant selection changed URL or price: ${changed}` });
    }

    // Quantity
    const qty = page.locator('input[name="quantity"]').first();
    if (await qty.count()) {
      await qty.fill('2');
      await expect(qty).toHaveValue('2');
    }

    // Accelerated checkout container
    const accelerated = page.locator('shopify-accelerated-checkout, .shopify-payment-button, [data-shopify="payment-button"], .additional-checkout-buttons');
    test.info().annotations.push({ type: 'note', description: `accelerated checkout containers: ${await accelerated.count()}` });
    expect(await accelerated.count(), 'accelerated checkout button container present on product page').toBeGreaterThan(0);

    // Add to cart
    const beforeCount = Number((await page.locator(COUNT).first().innerText().catch(() => '0')).replace(/\D/g, '') || 0);
    const add = page.locator('form[action*="/cart/add"] [type="submit"]:not([disabled]), button[name="add"]:not([disabled])').first();
    await expect(add).toBeVisible();
    await add.click();
    const drawer = page.locator(DRAWER).first();
    await expect(drawer).toBeVisible({ timeout: 15_000 });
    await expect.poll(async () => Number((await page.locator(COUNT).first().innerText().catch(() => '0')).replace(/\D/g, '') || 0), { timeout: 15_000 }).toBeGreaterThan(beforeCount);
    await shot(page, testInfo, 'cart-drawer');
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden({ timeout: 5_000 }).catch(() => {});
    expect(errors, errors.join('\n')).toEqual([]);
  });
});

test.describe('cart page', () => {
  test('quantity change, note and remove', async ({ page, site }, testInfo) => {
    const ok = await addToCartViaApi(page, site);
    test.skip(!ok, 'Could not add a product through /cart/add.js');
    await go(page, '/cart');
    await expect(page.locator('h1').first()).toBeVisible();
    await shot(page, testInfo, 'cart');

    const total = page.locator('[data-cart-total], [class*="total" i]').filter({ hasText: /\d/ }).last();
    const before = await total.innerText().catch(() => '');
    const qty = page.locator('main input[name="updates[]"], main input[name^="updates"], main input[type="number"]').first();
    await expect(qty).toBeVisible();
    await qty.fill('2');
    await qty.press('Tab');
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect.poll(async () => (await total.innerText().catch(() => '')), { timeout: 15_000 }).not.toBe(before);

    // Note
    const note = page.locator('textarea[name="note"]').first();
    if (await note.count()) {
      await note.fill('Please gift wrap');
      await note.blur();
      await expect(note).toHaveValue('Please gift wrap');
    } else test.info().annotations.push({ type: 'note', description: 'Cart note field not present' });

    // Checkout button and accelerated checkout
    await expect(page.locator('main [name="checkout"], main a[href*="/checkout"], main button[type="submit"]').first()).toBeVisible();
    test.info().annotations.push({ type: 'note', description: `cart accelerated containers: ${await page.locator('shopify-accelerated-checkout-cart, .additional-checkout-buttons, [data-shopify="payment-button"]').count()}` });

    // Remove
    const remove = page.locator('main a[href*="/cart/change"][href*="quantity=0"], main [data-cart-remove], main button[aria-label*="emove" i], main a[aria-label*="emove" i], main button:has-text("Remove"), main a:has-text("Remove")').first();
    await expect(remove).toBeVisible();
    await remove.click();
    await expect(page.locator('main').getByText(/empty|nothing|no items/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
