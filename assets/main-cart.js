/**
 * <cart-page> progressive enhancement for sections/main-cart.liquid.
 *
 * Without JS the cart is a plain form (number inputs + "Update cart" + checkout).
 * With JS: stepper/remove/qty changes go through KINETIC.cart.change, and the
 * cart is re-rendered from the Section Rendering API (?sections=<id>). Any
 * kinetic:cart:updated event (drawer, quick add...) also triggers a re-render.
 *
 * Hooks: [data-qty-step], [data-qty], [data-remove], [data-line-key], [data-cart-root],
 * [data-cart-live], [data-bar-fill].
 */
(() => {
  if (customElements.get('cart-page')) return;

  class CartPage extends HTMLElement {
    connectedCallback() {
      this.setAttribute('data-js', '');
      this.sectionId = this.dataset.sectionId;
      this.live = this.querySelector('[data-cart-live]');
      this.seq = 0;
      this.pendingMessage = '';

      this.onUpdated = (event) => this.render(event.detail);
      this.onError = (event) => this.announce(event.detail?.message || this.dataset.msgError);
      window.KINETIC?.on('cart:updated', this.onUpdated);
      window.KINETIC?.on('cart:error', this.onError);

      this.addEventListener('click', (event) => this.handleClick(event));
      this.addEventListener('change', (event) => this.handleChange(event));
      this.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && event.target.matches('[data-qty]')) {
          event.preventDefault();
          event.target.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      this.addEventListener('submit', (event) => {
        const submitter = event.submitter;
        if (!submitter || submitter.name !== 'checkout') event.preventDefault();
      });
    }

    disconnectedCallback() {
      window.KINETIC?.off('cart:updated', this.onUpdated);
      window.KINETIC?.off('cart:error', this.onError);
    }

    get root() {
      return this.querySelector('[data-cart-root]');
    }

    announce(message) {
      if (!this.live || !message) return;
      this.live.textContent = '';
      // Re-set on next frame so identical consecutive messages are announced again.
      requestAnimationFrame(() => {
        this.live.textContent = message;
      });
    }

    handleClick(event) {
      const step = event.target.closest('[data-qty-step]');
      if (step) {
        const line = step.closest('[data-line-key]');
        const input = line.querySelector('[data-qty]');
        const next = Math.max(0, (parseInt(input.value, 10) || 0) + Number(step.dataset.qtyStep));
        input.value = next;
        this.update(line, next, next === 0 ? 'removed' : 'updated');
        return;
      }
      const remove = event.target.closest('[data-remove]');
      if (remove) {
        event.preventDefault();
        this.update(remove.closest('[data-line-key]'), 0, 'removed');
      }
    }

    handleChange(event) {
      const input = event.target;
      if (input.matches('[data-qty]')) {
        const next = Math.max(0, parseInt(input.value, 10) || 0);
        input.value = next;
        this.update(input.closest('[data-line-key]'), next, next === 0 ? 'removed' : 'updated');
      } else if (input.matches('textarea[name="note"]')) {
        window.KINETIC.fetchJSON(`${window.KINETIC.routes?.cartUpdate || '/cart/update'}.js`, {
          method: 'POST',
          body: JSON.stringify({ note: input.value }),
        }).catch(() => {});
      }
    }

    async update(line, quantity, kind) {
      if (!line || !window.KINETIC) return;
      this.pendingMessage = kind;
      line.setAttribute('aria-busy', 'true');
      try {
        await window.KINETIC.cart.change(line.dataset.lineKey, quantity);
        // render() runs from the kinetic:cart:updated listener.
      } catch (_) {
        // Error text arrives through kinetic:cart:error; resync the markup.
        this.render();
      }
    }

    focusToken() {
      const active = document.activeElement;
      if (!active || !this.contains(active)) return null;
      const line = active.closest('[data-line-key]');
      if (!line) return active.id ? { id: active.id } : null;
      const control = active.hasAttribute('data-remove')
        ? 'remove'
        : active.dataset.qtyStep
          ? `step${active.dataset.qtyStep}`
          : 'qty';
      return { key: line.dataset.lineKey, control, index: Number(line.dataset.line) };
    }

    restoreFocus(token) {
      if (!token) return;
      let target = null;
      if (token.id) {
        target = this.querySelector(`#${CSS.escape(token.id)}`);
      } else {
        const line = [...this.querySelectorAll('[data-line-key]')].find(
          (el) => el.dataset.lineKey === token.key
        );
        if (line) {
          target =
            token.control === 'remove'
              ? line.querySelector('[data-remove]')
              : token.control === 'qty'
                ? line.querySelector('[data-qty]')
                : line.querySelector(`[data-qty-step="${token.control.slice(4)}"]`);
        } else {
          // Line removed: move focus to the neighbouring line, or the heading.
          const lines = this.querySelectorAll('[data-line-key]');
          const neighbour = lines[Math.min(token.index - 1, lines.length - 1)];
          target = neighbour?.querySelector('[data-remove]') || this.querySelector('h1');
        }
      }
      target?.focus({ preventScroll: true });
    }

    async render(cart) {
      const seq = ++this.seq;
      const token = this.focusToken();
      const note = this.querySelector('textarea[name="note"]');
      const noteValue = note ? note.value : null;
      const oldFill = this.querySelector('[data-bar-fill]');
      const oldPct = oldFill ? oldFill.style.width : null;
      const cartUrl = window.KINETIC?.routes?.cart || '/cart';

      try {
        const res = await fetch(`${cartUrl}?sections=${encodeURIComponent(this.sectionId)}`, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`Section request failed (${res.status})`);
        const sections = await res.json();
        if (seq !== this.seq) return; // a newer render superseded this one

        const doc = new DOMParser().parseFromString(sections[this.sectionId], 'text/html');
        const fresh = doc.querySelector('[data-cart-root]');
        if (!fresh || !this.root) throw new Error('Missing cart markup');

        this.root.innerHTML = fresh.innerHTML;

        const freshNote = this.querySelector('textarea[name="note"]');
        if (freshNote && noteValue !== null) freshNote.value = noteValue;

        // Animate the shipping bar from its previous width.
        const fill = this.querySelector('[data-bar-fill]');
        if (fill && oldPct && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
          const target = fill.style.width;
          fill.style.width = oldPct;
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              fill.style.width = target;
            })
          );
        }

        this.restoreFocus(token);

        const kind = this.pendingMessage || 'updated';
        this.pendingMessage = '';
        const total = cart && window.KINETIC ? window.KINETIC.money(cart.total_price) : '';
        const template = kind === 'removed' ? this.dataset.msgRemoved : this.dataset.msgUpdated;
        this.announce((template || '').replace('{total}', total));
      } catch (error) {
        this.announce(this.dataset.msgError);
        // Last resort: a full reload always shows the true cart.
        window.location.reload();
      }
    }
  }

  customElements.define('cart-page', CartPage);
})();
