import { test, expect, go, shot, seriousViolations, noHorizontalScroll, addToCartViaApi } from './fixtures.mjs';

async function targets(site) {
  const collection = await site.collection();
  const product = await site.product();
  const { blog, article } = await site.blogArticle();
  return [
    ['home', '/'],
    ['collection', collection],
    ['list-collections', '/collections'],
    ['product', product],
    ['cart', '/cart'],
    ['search', '/search?q=a'],
    ['login', '/account/login'],
    ['404', '/pages/qa-missing-page'],
    ['blog', blog],
    ['article', article],
  ].filter(([, url]) => url);
}

test.describe('accessibility (axe, serious and critical)', () => {
  test('every page type', async ({ page, site }, testInfo) => {
    test.setTimeout(240_000);
    const failures = [];
    for (const [name, url] of await targets(site)) {
      await go(page, url);
      await page.waitForLoadState('load');
      if (!page.url().includes(new URL(testInfo.project.use.baseURL).host)) continue;
      const v = await seriousViolations(page);
      if (v.length) failures.push(`${name} (${url}):\n  ${v.join('\n  ')}`);
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  test('cart drawer open', async ({ page, site }) => {
    const handle = await site.product();
    test.skip(!handle, 'No product');
    await go(page, handle);
    const add = page.locator('form[action*="/cart/add"] [type="submit"]:not([disabled]), button[name="add"]:not([disabled])').first();
    await add.click();
    await page.locator('[data-drawer-panel]').first().waitFor({ state: 'visible', timeout: 15_000 });
    const v = await seriousViolations(page);
    expect(v, v.join('\n')).toEqual([]);
  });
});

test.describe('responsive', () => {
  test('no horizontal scroll at 360px', async ({ page, site }, testInfo) => {
    await page.setViewportSize({ width: 360, height: 800 });
    const problems = [];
    for (const [name, url] of await targets(site)) {
      await go(page, url);
      await page.waitForLoadState('load');
      const overflow = await noHorizontalScroll(page);
      if (overflow > 0) problems.push(`${name} (${url}) overflows by ${overflow}px`);
      await shot(page, testInfo, `${name}-360`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
});

test.describe('keyboard', () => {
  test('tab order follows the DOM and focus is visible', async ({ page, site }, testInfo) => {
    test.skip(testInfo.project.name.startsWith('mobile'), 'Keyboard tab order is checked on desktop projects');
    await go(page, '/');
    await page.waitForLoadState('load');
    const stops = [];
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const all = [...document.querySelectorAll('*')];
        return {
          tag: el.tagName.toLowerCase(),
          label: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('name') || '').trim().slice(0, 40),
          dom: all.indexOf(el),
          top: r.top + window.scrollY,
          left: r.left,
          width: r.width,
          height: r.height,
          outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0,
          boxShadow: cs.boxShadow !== 'none',
          focusVisible: el.matches(':focus-visible'),
          cssText: cs.outlineColor,
          hidden: r.width === 0 && r.height === 0,
        };
      });
      if (info) stops.push(info);
    }
    expect(stops.length, 'tabbable elements found').toBeGreaterThan(3);
    const noFocusStyle = stops.filter((s) => s.focusVisible && !s.outline && !s.boxShadow && !s.hidden).map((s) => `${s.tag} "${s.label}"`);
    expect(noFocusStyle, `No visible focus indicator on: ${noFocusStyle.join(', ')}`).toEqual([]);
    const backwards = stops.filter((s, i) => i > 0 && s.dom < stops[i - 1].dom && !s.hidden).map((s) => `${s.tag} "${s.label}"`);
    expect(backwards, `Focus order differs from DOM order at: ${backwards.join(', ')}`).toEqual([]);
    const small = stops.filter((s) => !s.hidden && (s.width < 24 || s.height < 24) && s.tag !== 'a').map((s) => `${s.tag} "${s.label}" ${Math.round(s.width)}x${Math.round(s.height)}`);
    expect(small, `Touch targets under 24x24: ${small.join(', ')}`).toEqual([]);
    await shot(page, testInfo, 'keyboard-focus');
  });

  test('skip link is the first focus stop', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.startsWith('mobile'), 'desktop only');
    await go(page, '/');
    await page.keyboard.press('Tab');
    const first = await page.evaluate(() => {
      const a = document.activeElement;
      return a ? { href: a.getAttribute('href'), text: (a.textContent || '').trim() } : null;
    });
    expect(first?.href, 'first focusable is an in-page skip link').toMatch(/^#/);
  });
});

test.describe('cart with items', () => {
  test('screenshot and a11y of populated cart', async ({ page, site }, testInfo) => {
    const ok = await addToCartViaApi(page, site);
    test.skip(!ok, 'Could not add to cart');
    await go(page, '/cart');
    const v = await seriousViolations(page);
    await shot(page, testInfo, 'cart-populated');
    expect(v, v.join('\n')).toEqual([]);
    await page.request.post('/cart/clear.js');
  });
});
