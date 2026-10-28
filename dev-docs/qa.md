# QA tooling

Everything here is read-only against the theme. Output goes to `reports/` (git-ignored).

## Static checks: `yarn qa`

Runs, in order, and prints a summary (non-zero exit if any fails):

| Script | What it checks |
| --- | --- |
| `scripts/qa/schema-rules.mjs` | Theme Store settings rules for every `{% schema %}` (sections, blocks), `config/settings_schema.json`, `settings_data.json`, JSON templates and section groups: labels, sentence case, American English, no ampersands or trailing question marks, terminology table, numbered options, select/radio/range/richtext/inline_richtext defaults, `link_list` defaults (`main-menu`/`footer`), no `shopify://` or resource handles, templates reference real section types, settings, option values and block types, `order`/`block_order` consistency, presets (allowlist `main-*`, edit `NO_PRESET_ALLOWLIST`), `theme_info`, favicon, 4+ colors. |
| `scripts/qa/banned-patterns.mjs` | `http(s):` literals, `href="/"`, external scripts, `.min.*`, `.scss`, `robots.txt.liquid`, Lorem, `content_for_header |`, Shopify links without `rel="nofollow"`, `<img>` without alt, inputs without id, `target="_blank"` without noopener, hard-coded colors (warning) outside `snippets/color-scheme-vars.liquid`, `console.log`. |
| `scripts/qa/contrast.mjs` | WCAG contrast per color scheme, using the same derivation as `snippets/color-scheme-vars.liquid` (4.5:1 text, 3:1 accent UI). |
| `shopify theme check --fail-level error` | Local CLI from `node_modules`. |

Options: `yarn qa --skip-check` (skip theme check), `--max=N` (findings shown per rule). Each script can also be run alone: `node scripts/qa/schema-rules.mjs`.

## End-to-end: `yarn e2e`

Playwright, projects: `chromium-desktop`, `firefox-desktop`, `webkit-desktop`, `mobile-iphone13`, `mobile-pixel7`.

One-time: `npx playwright install` (browsers).

Create `.env.local` (git-ignored):

```
SHOPIFY_STORE=my-store.myshopify.com   # or BASE_URL=https://...
STOREFRONT_PASSWORD=secret             # only if the storefront is password protected
PREVIEW_THEME_ID=1234567890            # optional: test an unpublished theme
```

Without `SHOPIFY_STORE`/`BASE_URL` every test skips with a message. The password gate is passed automatically. Collections, products, blogs and articles are discovered from links, so handles do not matter.

Examples:

```
yarn e2e                                   # everything
yarn e2e --project=chromium-desktop        # one project
yarn e2e -g "predictive"                   # by name
yarn e2e --list                            # compile check only
```

Covered: home (no console errors), collection sort/filter/pagination, product options/quantity/accelerated checkout/add to cart with drawer and count, cart page quantity/note/remove, predictive search with keyboard, nested header menu with keyboard, localization selectors (when present), login, 404, blog/article, empty search, axe scan (fails on serious/critical) on each page type and on the open cart drawer, 360px horizontal-scroll check, tab order, focus visibility, 24px targets and skip link. Screenshots: `reports/screens/<project>/<page>.png`. HTML report: `reports/playwright/html`. Controls the store does not render (filters, pagination, localization) are recorded as annotations or skipped, not failed.

## Lighthouse: `yarn lighthouse`

Programmatic Lighthouse (system Chrome via chrome-launcher) on home, first collection and first product, mobile and desktop, 3 runs each (`--runs=N`, `--only=mobile|desktop`, `--pages=home,product`). The password gate is handled by POSTing the password form and setting the `storefront_digest` cookie in Chrome. Writes the median run as JSON and HTML to `reports/lighthouse/` plus `summary.json`, and prints a table. Fails below performance 60 or accessibility 90; warns below 80 and 100 respectively.
