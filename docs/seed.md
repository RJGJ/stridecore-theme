# Demo store seed (Northline Athletics)

Node scripts that fill a Shopify dev or demo store through the Admin GraphQL API so the Kinetic theme can be shown with realistic content. Everything is original copy for a fictional brand, "Northline Athletics". No apps are installed.

API version: `2026-10` (latest stable on 2026-10-26), pinned once as `API_VERSION` in `scripts/seed/lib.mjs`.

## Setup

1. Create a custom app in the store (Dev Dashboard or Settings > Apps > Develop apps) and install it.
2. Grant these Admin API scopes: `read_products`, `write_products`, `read_inventory`, `write_inventory`, `read_locations`, `write_locations`, `read_files`, `write_files`, `read_publications`, `write_publications`, `read_content`, `write_content`, `read_online_store_navigation`, `write_online_store_navigation`, `read_metaobject_definitions`, `write_metaobject_definitions`, `read_metaobjects`, `write_metaobjects`, `read_discounts`, `write_discounts`, `read_legal_policies`, `write_legal_policies`, `read_shipping`, `write_shipping`.
3. Create `.env.local` in the repo root (gitignored):

```
SHOPIFY_STORE=your-store.myshopify.com
SHOPIFY_ADMIN_TOKEN=shpat_...
```

The token is never printed.

## Run

```
node scripts/seed/index.mjs --dry-run      # validate everything, print the plan, no network, no credentials needed
node scripts/seed/images.mjs               # download the 30 photos into seed/images/ (gitignored) and write seed/images.attribution.md
node scripts/seed/index.mjs                # run all steps against the store
node scripts/seed/index.mjs --only=products,collections
node scripts/seed/verify.mjs               # re-query the store and compare with seed/catalog.json
```

All three scripts accept `--dry-run` and `--only=`. For `images.mjs`, `--only` takes image ids from the manifest. `index.mjs` also takes `--keep-going` (continue after a failed step) and `--no-category` (skip product category lookup).

Steps run in this order: `location`, `metaobjects`, `upload`, `products`, `collections`, `pages`, `blog`, `menus`, `policies`, `discounts`. Re-running is safe. Resources are matched by handle (products via `productSet` with a handle identifier, collections, pages, blog and articles by handle, menus by handle, the discount by title) and updated in place. Product images are only attached when the product is first created, so reruns do not duplicate media. Requests are throttled and retried on `THROTTLED` and 5xx responses, and any `userErrors` fail the step with the field and message.

## What it creates

| Area | Content |
| --- | --- |
| Products | 24 across Tops, Bottoms, Outerwear, Accessories and a gift card. Options Color (6) and Size (XS to XXL). Prices, vendor, type, tags `new` and `sale`, HTML descriptions, SEO titles and descriptions |
| Merchandising cases | 3 products on sale (compare-at price), 1 fully sold out (`summit-rain-shell`), 1 low stock (`thermal-running-vest`), single sold-out variant (`studio-crop-top` Bone XS), different prices by variant (`sculpt-high-rise-leggings`), unit pricing (`grip-chalk`, per 100 g), gift card with 4 denominations |
| Collections | `featured` (manual), smart collections by type (`tops`, `bottoms`, `outerwear`, `accessories`) and by tag (`new-arrivals`, `sale`) |
| Navigation | `main-menu` with 3 levels, `footer` |
| Pages | About (`page.about`), Contact (`page.contact`), FAQ, Shipping, Returns (default `page` template) |
| Blog | `news` with 6 articles, each with an image |
| Policies | Refund, shipping, privacy, terms of service |
| Discount | Automatic 10 percent off orders over $50 |
| Images | 30 Unsplash photos, all under the Unsplash License. Product images, blog images and 3 hero images (uploaded as Files for use in sections) |

## Colors and swatches

Color is created as a normal product option with the six names. The `metaobjects` step enables the standard `shopify--color-pattern` definition and creates the six entries, so a merchant can link the option in the admin. The seed does not link them automatically. Fallback: the theme maps option value names to swatch colors from `catalog.json` (`colors[].hex`), so swatches work without linked metafields.

## Photo licences

The manifest lists, for each image, the source site, photo page, direct download URL, photographer and licence. The licence line was read from each photo page on 2026-10-26, Unsplash+ photos were rejected, and contact sheets were reviewed to drop photos with visible brand logos. Attribution is written to `seed/images.attribution.md`. The photographs are stand-ins and are not photos of the listed products. Four products have no photo (`gym-duffel-bag`, `run-cap`, `resistance-band-set`, `gift-card`) because no suitable licensed photo was found; add your own.

The theme store rules ask for rights to every demo asset and no text baked into images. Re-check the photos before submitting.

## Manual steps

- Local pickup: the script tries `locationAdd` and `locationLocalPickupEnable`. If the plan blocks extra locations, add one in Settings > Locations and enable Settings > Shipping and delivery > Local pickup.
- Payments: enable the Bogus Gateway or Shopify Payments test mode (required for the theme store demo). Not possible through the Admin API.
- Linking the Color option to the standard color metaobject entries (optional, see above).
- Online Store theme: publish or preview the Kinetic theme; set the logo, favicon, hero images (use the uploaded Files) and the header and footer menus.
- Store name, currency, markets and a storefront password if needed.
- The FAQ, Shipping and Returns pages use the default page template. Set a template suffix in `seed/catalog.json` if the theme gains dedicated templates.
- Photos for the four products listed above.

## Not verified against a live store

The scripts were checked with `node --check` and `--dry-run` only. These calls follow the 2026-10 reference but were not exercised: category lookup through `taxonomy.categories`, `standardMetaobjectDefinitionEnable` field keys (`label`, `color`), `locationLocalPickupEnable` input, article `image.url` from a processed File URL, `menuUpdate` on the default menus, `collectionByIdentifier`, `productByIdentifier` and `mediaCount` fields, and the exact `productSet` variant matching on rerun. Failures print the API error text; the category, metaobject and pickup parts degrade to warnings.
