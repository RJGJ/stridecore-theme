# Settings reference

Generated from the theme schemas by `node scripts/docs/gen-reference.mjs`. Do not edit by hand.

## Theme settings

### Colors

| Setting | Type | Notes |
| --- | --- | --- |
| color_schemes | color_scheme_group |  |
| Default color scheme | color_scheme | Sections can use a different scheme in their own settings. |

### Typography

| Setting | Type | Notes |
| --- | --- | --- |
| Heading font | font_picker |  |
| Body font | font_picker |  |
| Accent font | font_picker | Used for small labels, prices and tickers. A monospace font suits the design. |
| Use uppercase headings | checkbox |  |

### Shape

| Setting | Type | Notes |
| --- | --- | --- |
| Corner radius | range |  |
| Show offset shadows | checkbox |  |

### Cart

| Setting | Type | Notes |
| --- | --- | --- |
| Cart type | select | Options: Drawer, Page. |
| Free shipping threshold | number | Enter the amount in your store currency. Set to 0 to hide the progress bar. |

### Store details

| Setting | Type | Notes |
| --- | --- | --- |
| Favicon | image_picker | 32 x 32px .png recommended |
| Store address | textarea |  |
| Support email | text |  |
| Shipping time in business days | text |  |
| Return window in days | text |  |
| Fabric weight | text |  |
| Show payment icons | checkbox |  |

### Social media

| Setting | Type | Notes |
| --- | --- | --- |
| Facebook | url |  |
| Instagram | url |  |
| TikTok | url |  |
| YouTube | url |  |
| X | url |  |
| Pinterest | url |  |
| Snapchat | url |  |
| Tumblr | url |  |
| Vimeo | url |  |
| LinkedIn | url |  |

## Sections

### About hero

File: `sections/about-hero.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Eyebrow | text |  |
| Heading | text |  |
| Highlighted words | text |  |

### Announcement ticker

File: `sections/announcement-ticker.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Show announcement ticker | checkbox |  |

**Blocks**

- **Message**

### Blog posts

File: `sections/blog-posts.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Heading | inline_richtext |  |
| Blog | blog |  |
| Maximum posts to show | range |  |
| Columns on desktop | range |  |
| Show featured image | checkbox |  |
| Show date | checkbox |  |
| Show author | checkbox |  |
| Show excerpt | checkbox |  |
| Button label | text |  |
| Color scheme | color_scheme |  |
| Top padding | range |  |
| Bottom padding | range |  |

**Blocks**

- **@app**

### Cart drawer

File: `sections/cart-drawer.liquid`

| Setting | Type | Notes |
| --- | --- | --- |
| Color scheme | color_scheme |  |
| Show order note | checkbox |  |
| Show accelerated checkout buttons | checkbox | Displays the payment buttons enabled in your payment settings, such as Shop Pay. |

### Cart upsell

File: `sections/cart-upsell.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Color scheme | color_scheme |  |
| Heading | text |  |
| Products | select | Options: Recommendations for the first cart item, Selected collection. |
| Collection | collection | Used when products is set to selected collection. |
| Number of products | range |  |

### Category tiles

File: `sections/category-tiles.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Heading | inline_richtext |  |
| Color scheme | color_scheme |  |
| Top padding | range |  |
| Bottom padding | range |  |

**Blocks**

- **Tile**

### Collapsible content

File: `sections/collapsible-content.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Subheading | text |  |
| Heading | inline_richtext |  |
| Body text | richtext |  |
| Open first row | checkbox |  |
| Color scheme | color_scheme |  |
| Top padding | range |  |
| Bottom padding | range |  |

**Blocks**

- **Collapsible row**
- **@app**

### Complementary products

File: `sections/complementary-products.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Eyebrow text | text |  |
| Heading | text |  |
| Number of products | range |  |
| Show quick add | checkbox |  |

### Contact form

File: `sections/contact-form.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Heading | text |  |
| Intro | textarea |  |
| Response time | text | Shown after the intro, e.g. "within 24 hours". Leave blank to hide. |
| Opening hours | text |  |
| Show order number field | checkbox |  |
| Button label | text |  |

### Contact info

File: `sections/contact-info.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Heading | inline_richtext |  |
| Body text | richtext |  |
| Show store address | checkbox | Set the address in theme settings. |
| Show support email | checkbox | Set the email in theme settings. |
| Color scheme | color_scheme |  |
| Top padding | range |  |
| Bottom padding | range |  |

**Blocks**

- **Detail**
- **@app**

### Custom liquid

File: `sections/custom-liquid.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Liquid | liquid | Add app snippets or custom Liquid code to create advanced customizations. |
| Color scheme | color_scheme |  |

### FAQ

File: `sections/faq.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Heading | text |  |
| Open the first question by default | checkbox |  |

**Blocks**

- **Question**

### Featured collection

File: `sections/featured-collection.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Heading | inline_richtext |  |
| Collection | collection |  |
| Maximum products to show | range |  |
| Columns on desktop | range |  |
| Columns on mobile | select | Options: One column, Two columns. |
| Image ratio | select | Options: Portrait, Square, Landscape. |
| Show button | checkbox |  |
| Button label | text |  |
| Color scheme | color_scheme |  |
| Top padding | range |  |
| Bottom padding | range |  |

**Blocks**

- **@app**
- **Custom liquid**

### Featured collections

File: `sections/featured-collections.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Heading | inline_richtext |  |
| Columns on desktop | range |  |
| Image ratio | select | Options: Portrait, Square, Landscape. |
| Show product count | checkbox |  |
| Show button | checkbox |  |
| Button label | text |  |
| Color scheme | color_scheme |  |
| Top padding | range |  |
| Bottom padding | range |  |

**Blocks**

- **Collection**
- **@app**

### Featured product

File: `sections/featured-product.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Product | product |  |
| Color scheme | color_scheme |  |
| Gallery layout | select | Options: Stacked, Thumbnails. |
| Media ratio | select | Options: Standard, Adapt to media, Portrait, Square. |
| Enable image lightbox | checkbox |  |
| Enable video looping | checkbox |  |
| Show sale and stock badge | checkbox |  |
| Show link to full product details | checkbox |  |

**Blocks**

- **@app**
- **Vendor** (max 1)
- **Heading** (max 1)
- **Price** (max 1)
- **Description** (max 1)
- **Variant picker** (max 1)
- **Quantity** (max 1)
- **Buy buttons** (max 1)
- **Pickup availability** (max 1)
- **Accordion**
- **Perks** (max 1)
- **Share** (max 1)
- **Text**
- **Custom liquid**

### Featured products

File: `sections/featured-products.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Heading | inline_richtext |  |
| Collection | collection | Shows all products when empty. |
| Maximum products to show | range |  |
| Minimum product width | range | Smaller values fit more products per row. |
| Show filter tabs | checkbox | Builds tabs from the product types in this collection. |
| Button label | text |  |
| Color scheme | color_scheme |  |
| Top padding | range |  |
| Bottom padding | range |  |

### Footer

File: `sections/footer.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Show country and language selectors | checkbox | Appears when the store sells in more than one country or language. |
| Show large store name | checkbox |  |
| Color scheme | color_scheme |  |

**Blocks**

- **Footer menu**
- **Email signup** (max 1)
- **Social media** (max 1)
- **Store details** (max 1)
- **Text**
- **@app**

### Header

File: `sections/header.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Logo image | image_picker | Optional. Falls back to the store name. |
| Logo height | range |  |
| Main menu | link_list |  |
| Show country and language selectors | checkbox | Appears when the store sells in more than one country or language. |
| Search placeholder | text |  |
| Color scheme | color_scheme |  |

### Hero

File: `sections/hero.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Layout | select | Options: Giant type, Split. |
| Subheading | text |  |
| Heading | inline_richtext | Use italics to highlight a word. |
| Body text | richtext |  |
| Primary button label | text |  |
| Primary button link | url | Links to all products when empty. |
| Secondary button label | text |  |
| Secondary button link | url | Links to all products when empty. |
| First image | image_picker | 4:5 aspect ratio recommended |
| Second image | image_picker | 4:5 aspect ratio recommended |
| Badge text | text |  |
| Badge number | text |  |
| Image | image_picker | 1200 x 1400px .jpg recommended |
| Color scheme | color_scheme |  |
| Top padding | range |  |
| Bottom padding | range |  |

### Image banner

File: `sections/image-banner.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Image | image_picker | 2400 x 1200px .jpg recommended |
| Background video | video | Replaces the image. Plays muted without sound and can be paused. |
| Banner height | select | Options: Small, Medium, Large, Full screen. |
| Horizontal position | select | Options: Left, Center, Right. |
| Vertical position | select | Options: Top, Middle, Bottom. |
| Text alignment | select | Options: Left, Center, Right. |
| Overlay opacity | range | Darkens the media so text stays readable. |
| Color scheme | color_scheme |  |

**Blocks**

- **Heading** (max 1)
- **Text** (max 1)
- **Buttons** (max 1)
- **@app**

### Image with text

File: `sections/image-with-text.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Image | image_picker | 1200 x 1500px .jpg recommended |
| Image ratio | select | Options: Use image ratio, Portrait, Square, Landscape. |
| Image width | select | Options: Small, Medium, Large. |
| Image position | select | Options: Left, Right. |
| Text alignment | select | Options: Left, Center, Right. |
| Color scheme | color_scheme |  |
| Top padding | range |  |
| Bottom padding | range |  |

**Blocks**

- **Subheading**
- **Heading**
- **Text**
- **Button**
- **@app**

### Logo list

File: `sections/logo-list.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Heading | inline_richtext |  |
| Logo height | range |  |
| Columns on desktop | range |  |
| Color scheme | color_scheme |  |
| Top padding | range |  |
| Bottom padding | range |  |

**Blocks**

- **Logo**
- **@app**

### Lookbook

File: `sections/lookbook.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Image | image_picker | 1000 x 1200px .jpg recommended |
| Image position | select | Options: Left, Right. |
| Subheading | text |  |
| Heading | inline_richtext |  |
| Body text | richtext |  |
| Button label | text |  |
| Button link | url | Links to all products when empty. |
| Color scheme | color_scheme |  |
| Top padding | range |  |
| Bottom padding | range |  |

### 404 page

File: `sections/main-404.liquid`

| Setting | Type | Notes |
| --- | --- | --- |
| Heading | text |  |
| Text | textarea |  |
| Home button label | text |  |
| Home button link | url | Leave blank to use the home page. |
| Ticker text | text | Separate items with "|". Leave blank to hide the ticker. |

### Sign in

File: `sections/main-account.liquid`

| Setting | Type | Notes |
| --- | --- | --- |
| Heading | text |  |
| Label | text |  |
| Note | textarea |  |

**Blocks**

- **Perk**

### Activate account

File: `sections/main-activate-account.liquid`

| Setting | Type | Notes |
| --- | --- | --- |
| Heading | text |  |
| Text | textarea |  |

### Addresses

File: `sections/main-addresses.liquid`

_No settings._

### Blog post

File: `sections/main-article.liquid`

| Setting | Type | Notes |
| --- | --- | --- |
| Show featured image | checkbox |  |
| Show date | checkbox |  |
| Show author | checkbox |  |
| Show tags | checkbox |  |
| Show previous and next links | checkbox |  |
| Show comments | checkbox | Comments must also be enabled in the blog settings. |
| Comments per page | range |  |

### Blog posts

File: `sections/main-blog.liquid`

| Setting | Type | Notes |
| --- | --- | --- |
| Posts per page | range |  |
| Show featured image | checkbox |  |
| Show date | checkbox |  |
| Show author | checkbox |  |
| Show excerpt | checkbox |  |
| Excerpt length in words | range |  |
| Show tag filters | checkbox |  |

### Cart

File: `sections/main-cart.liquid`

| Setting | Type | Notes |
| --- | --- | --- |
| Color scheme | color_scheme |  |
| Show order note | checkbox |  |
| Show accelerated checkout buttons | checkbox | Displays the payment buttons enabled in your payment settings, such as Shop Pay. |
| Message | textarea |  |
| Button label | text |  |
| Button link | url | Leave blank to link to all products. |

### Collection page

File: `sections/main-collection.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Color scheme | color_scheme |  |
| Products per page | range |  |
| Card size | select | Options: Large, Medium, Small. |
| Image ratio | select | Images are cropped to fit, using the focal point you set. Options: Portrait, Square, Landscape. |
| Show vendor | checkbox |  |
| Show filters on page load | checkbox |  |
| Show collection description | checkbox |  |
| Show collection image | checkbox |  |
| Sub-collection menu | link_list | Shown as buttons under the heading. |
| Show promo tile | checkbox |  |
| Promo tile position | range | Number of products shown before the tile. |

**Blocks**

- **Promo tile** (max 1)
- **Custom liquid**
- **@app**

### Customer account

File: `sections/main-customer-account.liquid`

_No settings._

### Collection list page

File: `sections/main-list-collections.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Color scheme | color_scheme |  |
| Heading | text |  |
| Collections per page | range |  |

### Order details

File: `sections/main-order.liquid`

_No settings._

### Page

File: `sections/main-page.liquid`

_No settings._

**Blocks**

- **@app**

### Password page

File: `sections/main-password.liquid`

| Setting | Type | Notes |
| --- | --- | --- |
| Logo | image_picker | The shop name is shown when no logo is selected. |
| Heading | text |  |
| Show email signup | checkbox |  |
| Signup heading | text |  |
| Show social media icons | checkbox |  |
| Color scheme | color_scheme |  |

### Product information

File: `sections/main-product.liquid`

| Setting | Type | Notes |
| --- | --- | --- |
| Show breadcrumbs | checkbox |  |
| Gallery layout | select | Options: Stacked, Thumbnails. |
| Media ratio | select | Options: Standard, Adapt to media, Portrait, Square. |
| Enable image lightbox | checkbox |  |
| Enable video looping | checkbox |  |
| Show sale and stock badge | checkbox |  |

**Blocks**

- **@app**
- **Vendor** (max 1)
- **Heading** (max 1)
- **Price** (max 1)
- **Description** (max 1)
- **Variant picker** (max 1)
- **Quantity** (max 1)
- **Buy buttons** (max 1)
- **Pickup availability** (max 1)
- **Accordion**
- **Perks** (max 1)
- **Share** (max 1)
- **Text**
- **Custom liquid**

### Create account

File: `sections/main-register.liquid`

| Setting | Type | Notes |
| --- | --- | --- |
| Heading | text |  |
| Show email marketing opt-in | checkbox |  |
| Label | text |  |
| Note | textarea |  |

**Blocks**

- **Perk**

### Reset password

File: `sections/main-reset-password.liquid`

| Setting | Type | Notes |
| --- | --- | --- |
| Heading | text |  |
| Text | textarea |  |

### Search page

File: `sections/main-search.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Color scheme | color_scheme |  |
| Search placeholder | text |  |
| Popular searches | text | Separate terms with commas. |
| Include pages and articles in results | checkbox |  |
| Results per page | range |  |
| Show filters by default | checkbox |  |

### Big marquee

File: `sections/marquee.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Color scheme | color_scheme |  |
| Top padding | range |  |
| Bottom padding | range |  |

**Blocks**

- **Text**

### Multicolumn

File: `sections/multicolumn.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Heading | inline_richtext |  |
| Columns on desktop | range |  |
| Show images | checkbox |  |
| Image ratio | select | Options: Portrait, Square, Landscape. |
| Text alignment | select | Options: Left, Center. |
| Color scheme | color_scheme |  |
| Top padding | range |  |
| Bottom padding | range |  |

**Blocks**

- **Column**
- **@app**

### Newsletter

File: `sections/newsletter.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Heading | inline_richtext | Use italics to highlight a word. |
| Email field label | text |  |
| Button label | text |  |
| Color scheme | color_scheme |  |
| Top padding | range |  |
| Bottom padding | range |  |

### Perks

File: `sections/perks.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Heading | inline_richtext |  |
| Color scheme | color_scheme |  |
| Top padding | range |  |
| Bottom padding | range |  |

**Blocks**

- **Perk**
- **@app**

### Predictive search

File: `sections/predictive-search.liquid`

_No settings._

### Related products

File: `sections/related-products.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Eyebrow text | text |  |
| Heading | text |  |
| Number of products | range |  |
| Show quick add | checkbox |  |

### Rich text

File: `sections/rich-text.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Text alignment | select | Options: Left, Center. |
| Content width | select | Options: Narrow, Medium, Wide. |
| Color scheme | color_scheme |  |
| Top padding | range |  |
| Bottom padding | range |  |

**Blocks**

- **Subheading**
- **Heading**
- **Text**
- **Button**
- **@app**

### Slideshow

File: `sections/slideshow.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Slide height | select | Options: Small, Medium, Large. |
| Play slides automatically | checkbox | Never plays for customers who prefer reduced motion. |
| Change slides every | range |  |
| Color scheme | color_scheme |  |

**Blocks**

- **Slide**

### Story split

File: `sections/story-split.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Image | image_picker |  |
| Placeholder label | text |  |
| Image position | select | Options: Left, Right. |
| Brand story | richtext |  |
| How you make things | richtext |  |
| Button label | text |  |
| Button link | url |  |

### Testimonials

File: `sections/testimonials.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Heading | inline_richtext |  |
| Columns on desktop | range |  |
| Color scheme | color_scheme |  |
| Top padding | range |  |
| Bottom padding | range |  |

**Blocks**

- **Testimonial**
- **@app**

### Ticker band

File: `sections/ticker-band.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Items | text | Separate items with a vertical bar (|). |
| Gap | range |  |
| Reverse direction | checkbox |  |

### Video

File: `sections/video.liquid` · Available in the section picker

| Setting | Type | Notes |
| --- | --- | --- |
| Heading | inline_richtext |  |
| Video link | video_url | Paste a YouTube or Vimeo link. |
| Hosted video | video | Replaces the video link when set. |
| Cover image | image_picker | 1920 x 1080px .jpg recommended |
| Video description | text | Describe the video for customers who use screen readers. |
| Use full width | checkbox |  |
| Color scheme | color_scheme |  |
| Top padding | range |  |
| Bottom padding | range |  |
