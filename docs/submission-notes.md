# Theme Store submission notes

Internal working notes for the Partner Dashboard submission. Not part of the theme package.

## Name

The theme is named **Stridecore** (one word, not an industry term).

Naming check on themes.shopify.com, 27 October 2026:

| Candidate | Result |
| --- | --- |
| Kinetic (original name) | Taken: preset of the Runase theme by Tapita ($100, clothing). https://themes.shopify.com/themes/runase/presets/kinetic |
| Torque | Taken: preset of the Tokyo theme. https://themes.shopify.com/themes/tokyo/presets/torque |
| Volt | Taken: preset of the Essentials theme. https://themes.shopify.com/themes/essentials/presets/volt |
| Stridecore | No Theme Store theme or preset found. Unrelated small uses outside Shopify (a staffing company page, a product collection label). |

Search results are an indication, not proof of availability. Before submitting, also search the Theme Store for "Stridecore" yourself and check trademark databases for your region.

## Uniqueness (architecture level)

What makes the theme structurally different, not just styled differently:

- **Token-driven shape system.** A single set of CSS custom properties (corner radius, offset shadow, heading case and tracking, accent edge) drives every component, so changing one setting restyles the whole store consistently.
- **Scheme-aware accents.** Every color scheme carries a background, text, accent and on-accent color. Muted, surface and line colors are derived from them (`color-mix`), so any scheme keeps its contrast.
- **Marquee and ticker components.** Reusable looping text bands (announcement ticker, big marquee, ticker band) share one snippet and respect reduced motion.
- **Card system.** Product, collection, article and promo tiles share one card structure with hard offset shadows.
- **Streetwear information design.** Monospace accent type for prices and labels, oversized uppercase headings, and large editorial blocks.
- **Dependency-free runtime.** One small `window.STRIDECORE` runtime with a cart event bus; cart drawer, search, filters and quick add all use it.

## Quality results (27 October 2026)

- `shopify theme check`: 0 errors, 7 warnings (deliberate hard-coded colors).
- Custom QA scripts (`yarn qa`): schema rules, banned patterns, contrast across all five schemes: pass.
- Browser tests (`yarn e2e`): 61 passed, 7 skipped, 0 failed across Chromium, WebKit, iPhone 13 and Pixel 7 profiles, including axe accessibility scans of every page type.
- Lighthouse (home, collection, product; 3 runs each; desktop and mobile): performance 93 to 100, accessibility 93 to 97. Requirement: 60 and 90.
- Not tested: Firefox (would not launch on the test machine), real iOS Safari, Samsung Internet, and in-app browsers (Instagram, Facebook, Pinterest).

## Listing text (draft)

Short description: A bold, high-contrast theme for sports apparel and streetwear stores.

Key features:

1. Five color schemes with sharp, bold typography you can change with Shopify font pickers
2. Slide-out cart with a free shipping progress bar, upsells and accelerated checkout
3. Predictive search, collection filtering and quick add on every product card
4. Block-based product page with swatches, pickup availability and Shop Pay Installments
5. 36 sections, including Custom Liquid, lookbook, slideshow, video and testimonials

## Before you submit (only you can do these)

- [ ] Add your support form link to `docs/support.md` (`SUPPORT_FORM_URL`), set up its auto-reply, and be ready to answer within two business days.
- [ ] Publish the docs (for example GitHub Pages from `docs/`) and set the theme documentation URL and support URL in `config/settings_schema.json`.
- [ ] Confirm the demo store: Bogus Gateway on, no apps installed, store is a client transfer store, then transfer it.
- [ ] Add store policies (refund, privacy, terms, shipping) on the demo store.
- [ ] Add photos for products still missing images, and a gift card product (activate gift cards first).
- [ ] Test on real devices: iOS Safari, Samsung Internet, and the Instagram, Facebook and Pinterest in-app browsers.
- [ ] Review the license note in `LICENSE.md` against how you plan to distribute the theme (free or paid).
- [ ] Take listing screenshots and submit in the Partner Dashboard.
