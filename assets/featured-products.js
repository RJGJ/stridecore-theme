/**
 * <featured-products> filter tabs for the home page product grid.
 *
 * Hooks:
 *   [data-filter]        buttons; value is the product type ("" = all); aria-pressed reflects state
 *   [data-type]          grid items carrying their product type
 *   [data-status]        live region announcing the visible count
 *   data-status-template on the element; "__COUNT__" is replaced with the count
 */
if (!customElements.get('featured-products')) {
  customElements.define(
    'featured-products',
    class FeaturedProducts extends HTMLElement {
      connectedCallback() {
        this.buttons = Array.from(this.querySelectorAll('[data-filter]'));
        this.items = Array.from(this.querySelectorAll('[data-type]'));
        this.status = this.querySelector('[data-status]');
        this.buttons.forEach((button) => {
          button.addEventListener('click', () => this.apply(button.dataset.filter || ''));
        });
      }

      apply(type) {
        let shown = 0;
        this.items.forEach((item) => {
          const match = type === '' || item.dataset.type === type;
          item.hidden = !match;
          if (match) shown += 1;
        });
        this.buttons.forEach((button) => {
          button.setAttribute('aria-pressed', String((button.dataset.filter || '') === type));
        });
        const template = this.dataset.statusTemplate;
        if (this.status && template) {
          this.status.textContent = template.replace('__COUNT__', shown);
        }
      }
    }
  );
}
