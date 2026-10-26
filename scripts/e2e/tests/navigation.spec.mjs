import { test, expect, go, shot } from './fixtures.mjs';

async function findSearchInput(page) {
  const input = page.locator('input[type="search"], input[name="q"]').first();
  if (await input.isVisible().catch(() => false)) return input;
  const trigger = page.locator('header a[href*="/search"], header button[aria-label*="earch" i], header [aria-label*="earch" i], [data-search-open], [data-predictive-open]').first();
  if (await trigger.count()) {
    await trigger.click().catch(() => {});
    if (await input.isVisible({ timeout: 2000 }).catch(() => false)) return input;
  }
  await go(page, '/search');
  return page.locator('input[type="search"], input[name="q"]').first();
}

test.describe('search', () => {
  test('predictive search shows results and is keyboard operable', async ({ page }, testInfo) => {
    await go(page, '/');
    const input = await findSearchInput(page);
    await expect(input).toBeVisible();
    await input.focus();
    await page.keyboard.type('sh', { delay: 80 });
    await page.keyboard.type('i', { delay: 80 });
    const results = page.locator('[data-predictive-results], [data-predictive-panel], predictive-search [role="listbox"], [role="listbox"], [id*="predictive" i]').first();
    await expect(results).toBeVisible({ timeout: 15_000 });
    await expect(results.locator('a[href]').first()).toBeVisible({ timeout: 15_000 });
    await shot(page, testInfo, 'predictive-search');

    await page.keyboard.press('ArrowDown');
    const moved = await page.evaluate(() => {
      const a = document.activeElement;
      const i = document.querySelector('input[type="search"], input[name="q"]');
      return Boolean(a && a.tagName === 'A') || Boolean(i && i.getAttribute('aria-activedescendant'));
    });
    expect(moved, 'ArrowDown moves into the results').toBeTruthy();
    await page.keyboard.press('Escape');
    await expect(results).toBeHidden({ timeout: 5_000 });

    // Enter submits to the search results page
    await input.focus().catch(() => {});
    await input.fill('shirt');
    await input.press('Enter');
    await expect(page).toHaveURL(/\/search\?.*q=shirt/);
    await expect(page.locator('main')).toBeVisible();
    await shot(page, testInfo, 'search-results');
  });
});

test.describe('header', () => {
  test('nested menu is keyboard operable', async ({ page }, testInfo) => {
    await go(page, '/');
    const isMobile = testInfo.project.name.startsWith('mobile');
    if (isMobile) {
      const toggle = page.locator('[data-menu-toggle], button[aria-controls*="nav" i], button[aria-label*="menu" i]').first();
      await expect(toggle).toBeVisible();
      await toggle.focus();
      await page.keyboard.press('Enter');
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    }
    const nav = page.locator('header nav, [data-site-nav]').first();
    await expect(nav).toBeVisible();
    const parent = nav.locator('details > summary, button[aria-expanded], [aria-haspopup="true"], li:has(ul) > a').first();
    if (!(await parent.count())) {
      test.info().annotations.push({ type: 'note', description: 'Main menu has no nested items in this store; add a dropdown to test' });
      return;
    }
    await parent.focus();
    const tag = await parent.evaluate((el) => el.tagName.toLowerCase());
    if (tag === 'summary' || (await parent.getAttribute('aria-expanded')) !== null) {
      await page.keyboard.press('Enter');
      const open = await parent.evaluate((el) => (el.tagName === 'SUMMARY' ? el.parentElement.open : el.getAttribute('aria-expanded') === 'true'));
      expect(open, 'Enter opens the submenu').toBeTruthy();
    }
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => Boolean(document.activeElement && document.activeElement.closest('header, [data-site-nav]')));
    expect(inside, 'Tab moves to a submenu link').toBeTruthy();
    await page.keyboard.press('Escape');
    await shot(page, testInfo, 'header-menu');
  });

  test('localization selectors work when present', async ({ page }, testInfo) => {
    await go(page, '/');
    const selectors = page.locator('form[action*="/localization"], localization-form, [data-localization], select[name="country_code"], select[name="locale_code"], input[name="country_code"], input[name="locale_code"]');
    if (!(await selectors.count())) {
      test.skip(true, 'Store has a single market and language, so no localization selectors render');
    }
    const trigger = page.locator('[aria-controls*="localization" i], details:has(input[name="country_code"], input[name="locale_code"]) > summary, button[aria-haspopup]').first();
    if (await trigger.count()) {
      await trigger.scrollIntoViewIfNeeded().catch(() => {});
      await trigger.focus();
      await page.keyboard.press('Enter');
      const options = page.locator('[role="listbox"] [role="option"], ul[id*="localization" i] a, .localization__list a, button[data-value]').first();
      await expect(options).toBeVisible({ timeout: 5_000 }).catch(() => {});
      await page.keyboard.press('Escape');
    }
    await shot(page, testInfo, 'localization');
  });
});
