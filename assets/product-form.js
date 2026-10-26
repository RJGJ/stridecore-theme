/**
 * <product-form> : variant picker, gallery sync and add-to-cart for the KINETIC product page.
 *
 * Expects (rendered by sections/main-product.liquid):
 *   script[data-variants]            JSON array of { id, options[], available, price, priceCents, compare, mediaId, badge }
 *   [data-option-input="<index>"]    radio inputs, one group per option
 *   input[data-variant-id]           hidden form `id` input, kept in sync
 *   [data-price] [data-compare] [data-free-shipping] [data-badge] [data-add] [data-add-label]
 *   [data-qty] [data-qty-inc] [data-qty-dec] [data-status] [data-status-text] [data-status-link]
 *   [data-media-id]                  gallery items
 *
 * Events: dispatches `variant:change` (detail: { variant }) on the element.
 * Add to cart calls KINETIC.cart.add (drawer opens when cart type is "drawer");
 * otherwise it shows the inline "Added to your cart" status. Without JS the form posts normally.
 */
(() => {
  if (customElements.get('product-form')) return;

  class ProductForm extends HTMLElement {
    connectedCallback() {
      if (this._ready) return;
      this._ready = true;

      this.form = this.querySelector('form[data-product-form]');
      const raw = this.querySelector('script[data-variants]');
      this.variants = raw ? JSON.parse(raw.textContent || '[]') : [];
      this.idInput = this.querySelector('[data-variant-id]');
      this.addBtn = this.querySelector('[data-add]');
      this.addLabel = this.querySelector('[data-add-label]');
      this.qty = this.querySelector('[data-qty]');
      this.status = this.querySelector('[data-status]');
      this.statusText = this.querySelector('[data-status-text]');
      this.statusLink = this.querySelector('[data-status-link]');
      this.threshold = Number(this.dataset.threshold || 0);
      this.strings = {
        add: this.dataset.labelAdd,
        adding: this.dataset.labelAdding,
        added: this.dataset.labelAdded,
        soldOut: this.dataset.labelSoldOut,
        unavailable: this.dataset.labelUnavailable,
        error: this.dataset.labelError,
        statusAdded: this.dataset.labelStatusAdded,
      };
      this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.current = this.findVariant();
      this.busy = false;

      this.addEventListener('change', (e) => {
        if (e.target.matches('[data-option-input]')) this.onOptionChange();
        if (e.target === this.qty) this.clampQty();
      });
      this.addEventListener('click', (e) => {
        if (e.target.closest('[data-qty-inc]')) this.stepQty(1);
        else if (e.target.closest('[data-qty-dec]')) this.stepQty(-1);
      });
      if (this.form) this.form.addEventListener('submit', (e) => this.onSubmit(e));

      this.updateOptionAvailability();
      this.updateOptionLabels();
    }

    selectedOptions() {
      const groups = {};
      this.querySelectorAll('[data-option-input]:checked').forEach((input) => {
        groups[Number(input.dataset.optionInput)] = input.value;
      });
      return Object.keys(groups)
        .sort((a, b) => a - b)
        .map((k) => groups[k]);
    }

    findVariant(options = this.selectedOptions()) {
      if (!options.length) return this.variants[0] || null;
      return this.variants.find((v) => v.options.every((value, i) => value === options[i])) || null;
    }

    onOptionChange() {
      const variant = this.findVariant();
      const previous = this.current;
      this.current = variant;
      this.updateOptionAvailability();
      this.updateOptionLabels();
      this.render(variant);
      this.hideStatus();
      if (variant && (!previous || previous.id !== variant.id)) {
        this.updateUrl(variant);
        this.showMedia(variant);
      }
      this.dispatchEvent(new CustomEvent('variant:change', { detail: { variant }, bubbles: true }));
    }

    updateOptionAvailability() {
      const selected = this.selectedOptions();
      this.querySelectorAll('.pf__option').forEach((group) => {
        const index = Number(group.dataset.optionIndex);
        group.querySelectorAll('[data-value]').forEach((label) => {
          const value = label.dataset.value;
          const matches = this.variants.filter((v) =>
            v.options.every((o, i) => (i === index ? o === value : o === selected[i]))
          );
          label.toggleAttribute('data-unavailable', !matches.some((v) => v.available));
        });
      });
    }

    updateOptionLabels() {
      this.querySelectorAll('.pf__option').forEach((group) => {
        const out = group.querySelector('[data-option-value]');
        const checked = group.querySelector('[data-option-input]:checked');
        if (out && checked) out.textContent = checked.value;
      });
    }

    render(variant) {
      const priceEl = this.querySelector('[data-price]');
      const compareEl = this.querySelector('[data-compare]');
      const freeEl = this.querySelector('[data-free-shipping]');
      const badgeEl = this.querySelector('[data-badge]');
      const dynamic = this.querySelector('[data-dynamic-checkout]');

      if (!variant) {
        this.setButton(this.strings.unavailable, true);
        if (this.idInput) this.idInput.disabled = true;
        if (dynamic) dynamic.hidden = true;
        if (freeEl) freeEl.hidden = true;
        return;
      }

      if (priceEl) priceEl.textContent = variant.price;
      if (compareEl) {
        compareEl.textContent = variant.compare;
        compareEl.hidden = !variant.compare;
      }
      if (freeEl) freeEl.hidden = !(this.threshold > 0 && variant.priceCents >= this.threshold);
      if (badgeEl) {
        badgeEl.textContent = variant.badge;
        badgeEl.hidden = !variant.badge;
      }
      if (this.idInput) {
        this.idInput.value = variant.id;
        this.idInput.disabled = !variant.available;
        this.idInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (dynamic) dynamic.hidden = !variant.available;
      this.setButton(variant.available ? this.strings.add : this.strings.soldOut, !variant.available);
    }

    setButton(label, disabled) {
      if (this.addLabel) this.addLabel.textContent = label;
      if (this.addBtn) this.addBtn.disabled = disabled;
    }

    updateUrl(variant) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', url);
      } catch (_) {
        /* ignore */
      }
    }

    showMedia(variant) {
      if (!variant.mediaId) return;
      const item = this.querySelector(`[data-media-id="${variant.mediaId}"]`);
      if (!item) return;
      item.scrollIntoView({
        behavior: this.reduceMotion.matches ? 'auto' : 'smooth',
        block: 'nearest',
      });
      item.classList.add('is-highlighted');
      clearTimeout(this._hl);
      this._hl = setTimeout(() => item.classList.remove('is-highlighted'), 1200);
    }

    clampQty() {
      if (!this.qty) return;
      const min = Number(this.qty.min || 1);
      const max = Number(this.qty.max || 99);
      let n = parseInt(this.qty.value, 10);
      if (Number.isNaN(n)) n = min;
      this.qty.value = Math.min(max, Math.max(min, n));
    }

    stepQty(delta) {
      if (!this.qty) return;
      this.qty.value = (parseInt(this.qty.value, 10) || 1) + delta;
      this.clampQty();
    }

    showStatus(text, { link = false, error = false } = {}) {
      if (!this.status) return;
      this.statusText.textContent = text;
      if (this.statusLink) this.statusLink.hidden = !link;
      this.status.classList.toggle('pf__status--error', error);
      this.status.hidden = false;
    }

    hideStatus() {
      if (this.status) this.status.hidden = true;
    }

    restoreButton() {
      const v = this.current;
      if (!v) return this.setButton(this.strings.unavailable, true);
      return this.setButton(v.available ? this.strings.add : this.strings.soldOut, !v.available);
    }

    async onSubmit(event) {
      const K = window.KINETIC;
      if (!this.current || !this.current.available) {
        event.preventDefault();
        return;
      }
      if (!K || !K.cart) return;
      event.preventDefault();
      if (this.busy) return;
      this.busy = true;
      this.clampQty();
      this.addBtn.setAttribute('aria-busy', 'true');
      this.setButton(this.strings.adding, true);
      this.hideStatus();

      try {
        await K.cart.add({
          id: Number(this.current.id),
          quantity: Number(this.qty ? this.qty.value : 1),
        });
        this.setButton(this.strings.added, true);
        if (K.cartType !== 'drawer') this.showStatus(this.strings.statusAdded, { link: true });
        setTimeout(() => this.restoreButton(), 1800);
      } catch (error) {
        this.showStatus((error && error.message) || this.strings.error, { error: true });
        this.restoreButton();
      } finally {
        this.busy = false;
        this.addBtn.removeAttribute('aria-busy');
      }
    }
  }

  customElements.define('product-form', ProductForm);
})();
