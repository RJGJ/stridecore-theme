/**
 * <product-form> : variant picker, buy box sync and add to cart for the STRIDECORE product page.
 * Used by sections/main-product.liquid and sections/featured-product.liquid.
 *
 * Expects (rendered by the product-* snippets):
 *   script[data-variants]            JSON array: { id, options[], available, price, priceCents, compare, unit, mediaId,
 *                                    badge, sku, qty:{min,max,step}, plans:{[planId]:{price,compare}} }
 *   [data-option-input="<index>"]    radios or a <select>, one group per option (inside [data-option-index])
 *   input[data-variant-id]           hidden form `id` input, kept in sync
 *   [data-price] [data-compare] [data-compare-label] [data-unit] [data-unit-text] [data-free-shipping] [data-badge]
 *   [data-add] [data-add-label] [data-dynamic-checkout] [data-payment-terms]
 *   [data-qty] [data-qty-inc] [data-qty-dec] [data-qty-rules]
 *   [data-selling-plans] [data-selling-plan-input] [data-plan-id] [data-plan-price]
 *   [data-pickup]                    replaced with the pickup-availability section for the selected variant
 *   [data-recipient]                 gift card recipient form
 *   [data-share]                     share block (copy link button)
 *   [data-status] [data-status-text] [data-status-link]
 *   product-gallery                  optional, gallery.show(mediaId) is called on variant change
 *
 * Attributes on <product-form>: data-update-url="true" writes ?variant= to the URL,
 * data-root-url, data-threshold, data-label-* strings.
 *
 * Events: dispatches `variant:change` (detail: { variant }) on the element.
 * Add to cart posts the real form data (variant, quantity, selling plan, gift card properties) to the cart add
 * endpoint and opens the cart drawer when the cart type is "drawer". Without JS the form posts normally.
 */
(() => {
  if (customElements.get('product-form')) return;

  class ProductForm extends HTMLElement {
    connectedCallback() {
      if (this._ready) return;
      this._ready = true;

      this.form = this.querySelector('form[data-product-form]');
      const raw = this.querySelector('script[data-variants]');
      try {
        this.variants = raw ? JSON.parse(raw.textContent || '[]') : [];
      } catch (_) {
        this.variants = [];
      }
      this.idInput = this.querySelector('[data-variant-id]');
      this.addBtn = this.querySelector('[data-add]');
      this.addLabel = this.querySelector('[data-add-label]');
      this.qty = this.querySelector('[data-qty]');
      this.status = this.querySelector('[data-status]');
      this.statusText = this.querySelector('[data-status-text]');
      this.statusLink = this.querySelector('[data-status-link]');
      this.threshold = Number(this.dataset.threshold || 0);
      this.updateUrlEnabled = this.dataset.updateUrl === 'true';
      this.strings = {
        add: this.dataset.labelAdd,
        adding: this.dataset.labelAdding,
        added: this.dataset.labelAdded,
        soldOut: this.dataset.labelSoldOut,
        unavailable: this.dataset.labelUnavailable,
        error: this.dataset.labelError,
        statusAdded: this.dataset.labelStatusAdded,
        qtyMin: this.dataset.labelQtyMin,
        qtyMax: this.dataset.labelQtyMax,
        qtyStep: this.dataset.labelQtyStep,
      };
      this.current = this.findVariant();
      this.busy = false;
      this.pickupRequest = 0;

      this.addEventListener('change', (e) => {
        if (e.target.matches('[data-option-input]')) this.onOptionChange();
        else if (e.target.matches('[data-selling-plan-input]')) this.render(this.current);
        else if (e.target === this.qty) this.clampQty();
        else if (e.target.matches('[data-recipient-toggle]')) this.syncRecipient();
      });
      this.addEventListener('click', (e) => {
        if (e.target.closest('[data-qty-inc]')) this.stepQty(1);
        else if (e.target.closest('[data-qty-dec]')) this.stepQty(-1);
        else if (e.target.closest('[data-pickup-open]')) this.openPickup(e.target.closest('[data-pickup]'));
        else if (e.target.closest('[data-pickup-close]')) this.closePickup(e.target.closest('[data-pickup]'));
        else if (e.target.closest('[data-share-copy]')) this.copyLink(e.target.closest('[data-share]'));
        else if (e.target.matches('[data-pickup-dialog]')) e.target.close();
      });
      if (this.form) this.form.addEventListener('submit', (e) => this.onSubmit(e));

      this.updateOptionAvailability();
      this.updateOptionLabels();
      this.setupRecipient();
      this.updateSellingPlans(this.current);
    }

    /* ---------- variant selection ---------- */

    selectedOptions() {
      const groups = {};
      this.querySelectorAll('[data-option-input]').forEach((input) => {
        const index = Number(input.dataset.optionInput);
        if (input.tagName === 'SELECT') groups[index] = input.value;
        else if (input.checked) groups[index] = input.value;
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
      if (variant) {
        this.updateSellingPlans(variant);
        this.applyQuantityRule(variant);
        this.render(variant);
      }
      if (variant && (!previous || previous.id !== variant.id)) {
        if (this.updateUrlEnabled) this.updateUrl(variant);
        this.showMedia(variant);
        this.updatePickup(variant);
      }
      this.dispatchEvent(new CustomEvent('variant:change', { detail: { variant }, bubbles: true }));
    }

    updateOptionAvailability() {
      const selected = this.selectedOptions();
      this.querySelectorAll('[data-option-index]').forEach((group) => {
        const index = Number(group.dataset.optionIndex);
        group.querySelectorAll('[data-value]').forEach((el) => {
          const value = el.dataset.value;
          const matches = this.variants.filter((v) =>
            v.options.every((o, i) => (i === index ? o === value : o === selected[i]))
          );
          const soldOut = !matches.some((v) => v.available);
          el.toggleAttribute('data-unavailable', soldOut);
          if (el.tagName === 'OPTION') {
            if (!el.dataset.label) el.dataset.label = el.textContent;
            el.textContent = soldOut && this.strings.soldOut ? `${el.dataset.label} (${this.strings.soldOut})` : el.dataset.label;
          }
        });
      });
    }

    updateOptionLabels() {
      this.querySelectorAll('[data-option-index]').forEach((group) => {
        const out = group.querySelector('[data-option-value]');
        if (!out) return;
        const input = group.querySelector('[data-option-input]:checked, select[data-option-input]');
        if (input) out.textContent = input.value;
      });
    }

    selectedPlanId() {
      const input = this.querySelector('[data-selling-plan-input]:checked');
      return input && input.value ? input.value : '';
    }

    render(variant) {
      const priceEl = this.querySelector('[data-price]');
      const compareEl = this.querySelector('[data-compare]');
      const compareLabel = this.querySelector('[data-compare-label]');
      const unitEl = this.querySelector('[data-unit]');
      const unitText = this.querySelector('[data-unit-text]');
      const freeEl = this.querySelector('[data-free-shipping]');
      const dynamic = this.querySelector('[data-dynamic-checkout]');
      const terms = this.querySelector('[data-payment-terms]');

      if (!variant) {
        this.setButton(this.strings.unavailable, true);
        if (this.idInput) this.idInput.disabled = true;
        if (dynamic) dynamic.hidden = true;
        if (terms) terms.hidden = true;
        if (freeEl) freeEl.hidden = true;
        return;
      }

      const plan = variant.plans && variant.plans[this.selectedPlanId()];
      const price = plan ? plan.price : variant.price;
      const compare = plan ? plan.compare : variant.compare;

      if (priceEl) priceEl.textContent = price;
      if (compareEl) {
        compareEl.textContent = compare;
        compareEl.hidden = !compare;
      }
      if (compareLabel) compareLabel.hidden = !compare;
      if (unitEl) {
        if (unitText) unitText.textContent = variant.unit;
        unitEl.hidden = !variant.unit;
      }
      if (freeEl) freeEl.hidden = !(this.threshold > 0 && variant.priceCents >= this.threshold);
      this.querySelectorAll('[data-badge]').forEach((badge) => {
        badge.textContent = variant.badge;
        badge.hidden = !variant.badge;
      });
      if (this.idInput) {
        this.idInput.value = variant.id;
        this.idInput.disabled = !variant.available;
        this.idInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (dynamic) dynamic.hidden = !variant.available;
      if (terms) terms.hidden = !variant.available;
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
      const gallery = this.querySelector('product-gallery');
      if (gallery && typeof gallery.show === 'function') gallery.show(variant.mediaId);
    }

    /* ---------- pickup availability ---------- */

    async updatePickup(variant) {
      const pickup = this.querySelector('[data-pickup]');
      if (!pickup || !variant) return;
      const root = this.dataset.rootUrl || '/';
      const token = ++this.pickupRequest;
      try {
        const res = await fetch(`${root}variants/${variant.id}/?section_id=pickup-availability`, {
          credentials: 'same-origin',
        });
        if (!res.ok || token !== this.pickupRequest) return;
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        const fresh = doc.querySelector('[data-pickup-fetched]');
        if (fresh) pickup.innerHTML = fresh.innerHTML;
      } catch (_) {
        /* keep the previous content */
      }
    }

    openPickup(pickup) {
      const dialog = pickup && pickup.querySelector('[data-pickup-dialog]');
      if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
    }

    closePickup(pickup) {
      const dialog = pickup && pickup.querySelector('[data-pickup-dialog]');
      if (dialog) dialog.close();
    }

    /* ---------- selling plans ---------- */

    updateSellingPlans(variant) {
      const root = this.querySelector('[data-selling-plans]');
      if (!root || !variant) return;
      const plans = variant.plans || {};
      let selectedHidden = false;
      root.querySelectorAll('[data-plan-id]').forEach((label) => {
        const plan = plans[label.dataset.planId];
        label.hidden = !plan;
        const priceEl = label.querySelector('[data-plan-price]');
        if (priceEl) priceEl.textContent = plan ? plan.price : '';
        const input = label.querySelector('input');
        if (!plan && input && input.checked) selectedHidden = true;
      });
      if (selectedHidden) {
        const fallback =
          root.querySelector('input[value=""]') ||
          root.querySelector('[data-plan-id]:not([hidden]) input');
        if (fallback) fallback.checked = true;
      }
    }

    /* ---------- quantity ---------- */

    applyQuantityRule(variant) {
      if (!this.qty || !variant.qty) return;
      const { min, max, step } = variant.qty;
      this.qty.min = min;
      this.qty.step = step;
      if (max) this.qty.max = max;
      else this.qty.removeAttribute('max');
      this.clampQty();

      const rules = this.querySelector('[data-qty-rules]');
      if (!rules) return;
      const parts = [];
      const fill = (text, n) => (text || '').replace('%n', n);
      if (min > 1) parts.push(fill(this.strings.qtyMin, min));
      if (max) parts.push(fill(this.strings.qtyMax, max));
      if (step > 1) parts.push(fill(this.strings.qtyStep, step));
      rules.replaceChildren(
        ...parts.map((text) => {
          const span = document.createElement('span');
          span.textContent = text;
          return span;
        })
      );
      rules.hidden = parts.length === 0;
    }

    clampQty() {
      if (!this.qty) return;
      const min = Number(this.qty.min || 1);
      const max = this.qty.max ? Number(this.qty.max) : Infinity;
      const step = Number(this.qty.step || 1) || 1;
      let n = parseInt(this.qty.value, 10);
      if (Number.isNaN(n)) n = min;
      n = Math.max(min, n);
      if (step > 1) n = min + Math.round((n - min) / step) * step;
      while (n > max && n - step >= min) n -= step;
      this.qty.value = Math.min(max, n);
    }

    stepQty(delta) {
      if (!this.qty) return;
      const step = Number(this.qty.step || 1) || 1;
      this.qty.value = (parseInt(this.qty.value, 10) || Number(this.qty.min || 1)) + delta * step;
      this.clampQty();
    }

    /* ---------- gift card recipient ---------- */

    setupRecipient() {
      const root = this.querySelector('[data-recipient]');
      if (!root) return;
      const toggle = root.querySelector('[data-recipient-toggle]');
      if (toggle) toggle.disabled = false;
      const control = root.querySelector('[data-recipient-control]');
      if (control) control.disabled = true;
      const hasValues = [...root.querySelectorAll('[data-recipient-fields] input, [data-recipient-fields] textarea')].some(
        (el) => el.value
      );
      if (toggle && hasValues) toggle.checked = true;
      this.syncRecipient(true);
    }

    syncRecipient(initial = false) {
      const root = this.querySelector('[data-recipient]');
      if (!root) return;
      const toggle = root.querySelector('[data-recipient-toggle]');
      const fields = root.querySelector('[data-recipient-fields]');
      const offset = root.querySelector('[data-recipient-offset]');
      const on = !!(toggle && toggle.checked);
      if (fields) {
        fields.hidden = !on;
        fields.querySelectorAll('input, textarea').forEach((el) => {
          el.disabled = !on;
        });
      }
      if (offset) {
        offset.disabled = !on;
        offset.value = String(new Date().getTimezoneOffset());
      }
      const live = root.querySelector('[data-recipient-live]');
      if (live && !initial) live.textContent = on ? root.dataset.liveOn || '' : '';
    }

    /* ---------- share ---------- */

    async copyLink(share) {
      if (!share) return;
      const url = share.dataset.shareUrl || window.location.href;
      const status = share.querySelector('[data-share-status]');
      try {
        await navigator.clipboard.writeText(url);
        if (status) status.textContent = status.dataset.copiedText || '';
        const label = share.querySelector('[data-share-copy-label]');
        if (label) {
          const original = label.textContent;
          if (status && status.dataset.copiedText) label.textContent = status.dataset.copiedText;
          setTimeout(() => {
            label.textContent = original;
          }, 2000);
        }
      } catch (_) {
        /* clipboard unavailable */
      }
    }

    /* ---------- status + add to cart ---------- */

    showStatus(text, { link = false, error = false } = {}) {
      if (!this.status) return;
      this.statusText.textContent = text;
      if (this.statusLink) this.statusLink.hidden = !link;
      this.status.classList.toggle('bb__status--error', error);
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
      const K = window.STRIDECORE;
      if (!this.current || !this.current.available) {
        event.preventDefault();
        return;
      }
      if (!K || !K.cart || !window.fetch) return;
      event.preventDefault();
      if (this.busy) return;
      this.busy = true;
      this.clampQty();
      this.addBtn.setAttribute('aria-busy', 'true');
      this.setButton(this.strings.adding, true);
      this.hideStatus();

      try {
        const endpoint = `${(K.routes && K.routes.cartAdd) || this.form.getAttribute('action') || '/cart/add'}.js`;
        const res = await fetch(endpoint, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
          body: new FormData(this.form),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.description || data.message || this.strings.error);

        await K.cart.refresh();
        if (K.cartType === 'drawer') K.emit('cart:open');
        this.setButton(this.strings.added, true);
        if (K.cartType !== 'drawer') this.showStatus(this.strings.statusAdded, { link: true });
        setTimeout(() => this.restoreButton(), 1800);
      } catch (error) {
        this.showStatus((error && error.message) || this.strings.error, { error: true });
        K.emit('cart:error', { message: error && error.message });
        this.restoreButton();
      } finally {
        this.busy = false;
        this.addBtn.removeAttribute('aria-busy');
      }
    }
  }

  customElements.define('product-form', ProductForm);
})();
