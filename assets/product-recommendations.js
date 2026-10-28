/**
 * <product-recommendations> : loads related or complementary products through the
 * Product Recommendations endpoint (routes.product_recommendations_url) and swaps
 * the server-rendered markup in. data-url must include section_id, product_id, limit and intent.
 * The surrounding <section> stays hidden until products are found.
 */
(() => {
  if (customElements.get('product-recommendations')) return;

  class ProductRecommendations extends HTMLElement {
    connectedCallback() {
      if (this.dataset.loaded === 'true' || !this.dataset.url) return;
      if (!('IntersectionObserver' in window)) return this.load();
      this.observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            this.observer.disconnect();
            this.load();
          }
        },
        { rootMargin: '400px 0px' }
      );
      this.observer.observe(this);
    }

    disconnectedCallback() {
      if (this.observer) this.observer.disconnect();
    }

    async load() {
      try {
        const res = await fetch(this.dataset.url, { credentials: 'same-origin' });
        if (!res.ok) return;
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        const fresh = doc.querySelector('product-recommendations');
        const section = this.closest('section');
        if (fresh && fresh.querySelector('.card')) {
          this.innerHTML = fresh.innerHTML;
          if (section) section.hidden = false;
        }
      } catch (_) {
        /* keep the server-rendered fallback */
      }
    }
  }

  customElements.define('product-recommendations', ProductRecommendations);
})();
