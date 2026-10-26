import { test, expect, go, shot } from './fixtures.mjs';

test.describe('pages', () => {
  test('account login page', async ({ page, errors }, testInfo) => {
    const res = await go(page, '/account/login');
    expect(res?.status()).toBeLessThan(400);
    // New customer accounts redirect off-site; classic accounts render a form here.
    const url = page.url();
    if (!url.includes(new URL(test.info().project.use.baseURL).host)) {
      test.info().annotations.push({ type: 'note', description: `login redirects to ${new URL(url).host} (new customer accounts)` });
      return;
    }
    await expect(page.locator('input[type="email"], input[name="customer[email]"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await shot(page, testInfo, 'login');
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('404 page states the page was not found and offers a way forward', async ({ page }, testInfo) => {
    const res = await go(page, '/pages/this-page-does-not-exist-qa-check');
    expect(res?.status()).toBe(404);
    await expect(page.locator('main')).toContainText(/not found|404|doesn.t exist|can.t be found/i);
    const way = page.locator('main a[href="/"], main a[href*="/collections"], main input[type="search"], main form[action*="/search"]');
    expect(await way.count(), 'link home/shop or search box').toBeGreaterThan(0);
    await shot(page, testInfo, '404');
  });

  test('blog and article', async ({ page, site }, testInfo) => {
    const { blog, article } = await site.blogArticle();
    test.skip(!blog, 'Store has no blog');
    await go(page, blog);
    await expect(page.locator('h1').first()).toBeVisible();
    await shot(page, testInfo, 'blog');
    test.skip(!article, 'Blog has no articles');
    await go(page, article);
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('time').first()).toBeVisible();
    await shot(page, testInfo, 'article');
  });

  test('search results page returns a message for no results', async ({ page }, testInfo) => {
    await go(page, '/search?q=zzzzqxjv-no-match&type=product');
    await expect(page.locator('main')).toContainText(/no results|no products|nothing|couldn.t find|did not match/i);
    await shot(page, testInfo, 'search-empty');
  });
});
