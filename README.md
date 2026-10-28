# Stridecore

A free, bold, high-contrast Shopify theme for sports apparel and streetwear stores. Built for Online Store 2.0 with original, dependency-free code.

Designed and built by [RJGJ](https://rjgjaictin.dev).

- **Documentation:** https://rjgj.github.io/stridecore-theme/
- **Support:** https://github.com/RJGJ/stridecore-theme/issues
- **License:** [MIT](LICENSE.md). Free to use, modify and resell. Please keep the copyright notice.

## Highlights

- Five color schemes, Shopify font pickers, and a token-driven shape system (corner radius, offset shadows)
- Slide-out cart drawer with free shipping progress bar, upsells and accelerated checkout
- Predictive search, collection filtering and sorting, quick add
- Block-based product page: swatches, pickup availability, Shop Pay Installments, unit prices, gift card form, app blocks
- 36 sections including Custom Liquid, slideshow, lookbook, video and testimonials
- Three-level menus, announcement ticker, country and language selectors
- Accessibility built in: skip link, visible focus, dialogs that manage focus, reduced-motion support

## Quality

| Check | Result |
| --- | --- |
| Shopify Theme Check | 0 errors |
| Lighthouse performance | 93 to 100 |
| Lighthouse accessibility | 93 to 97 |
| Browser tests (Chromium, WebKit, iPhone 13, Pixel 7) | 61 passed, 0 failed |
| axe-core scans | Every page type, no serious or critical issues |

## Install

Download `stridecore-1.0.0.zip` from the releases page, then in Shopify admin go to **Online Store > Themes > Add theme > Upload zip file**. See the [theme guide](docs/index.md) for setup.

## Develop

```bash
yarn install
yarn dev --store your-store.myshopify.com
yarn lint        # Shopify Theme Check
yarn qa          # schema, banned-pattern and contrast checks
yarn e2e         # Playwright and axe (needs .env, see .env.example)
yarn lighthouse
yarn package     # builds dist/stridecore-<version>.zip
```

Copy `.env.example` to `.env` for store tooling credentials. Never commit `.env`.

Developer notes are in [dev-docs](dev-docs/).
