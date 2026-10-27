# Third-party licenses

## In the theme package

Stridecore ships with **no third-party libraries**. All JavaScript in `assets/` is original, framework-free code, and all CSS is hand-written. Fonts are loaded from the Shopify font library through `font_picker` settings, so no font files are bundled.

Icons in `snippets/icon.liquid` and `snippets/social-icon.liquid` are original inline SVGs.

## Demo content (not in the theme package)

The demo store photographs are not part of the theme zip. They are used under the [Unsplash License](https://unsplash.com/license), which allows commercial use without permission. Author, source and photo links for each of the 30 images are in [`seed/images.attribution.md`](seed/images.attribution.md), and the machine-readable list is `seed/images.manifest.json`.

## Development tooling (not in the theme package)

Used only for testing and packaging: Shopify CLI, Playwright, axe-core, Lighthouse and archiver. See `package.json`. These are not distributed with the theme.
