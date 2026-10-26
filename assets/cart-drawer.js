/**
 * KINETIC cart drawer: <cart-drawer> custom element.
 *
 * The drawer is rendered by Liquid (sections/cart-drawer.liquid) so it shows line
 * prices, unit prices, discounts, selling plans, quantity rules and accelerated
 * checkout buttons. After any cart change (kinetic:cart:updated) the section is
 * re-fetched from the Section Rendering API and the whole content region is swapped,
 * so every line and the total are always in sync.
 *
 * Hooks: [data-drawer-close], [data-drawer-panel], [data-drawer-title],
 * [data-drawer-content], [data-drawer-error], [data-drawer-live], [data-line-key],
 * [data-qty-step], [data-qty], [data-remove], [data-bar-fill].
 */
(() => {
  if (customElements.get('cart-drawer')) return;
  const K = (window.KINETIC = window.KINETIC || {});

  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

  class CartDrawer extends HTMLElement {
    connectedCallback() {
      this.panel = this.querySelector('[data-drawer-panel]');
      this.live = this.querySelector('[data-drawer-live]');
      this.sectionId = this.dataset.sectionId;
      this.seq = 0;
      this.lastFocus = null;

      this.onUpdated = () => {
        this.showError('');
        this.refresh();
      };
      this.onError = (event) => this.showError(event.detail?.message || this.dataset.msgError);
      this.onOpen = () => this.open();
      this.onKeydown = (event) => this.keydown(event);
      K.on?.('cart:updated', this.onUpdated);
      K.on?.('cart:open', this.onOpen);
      K.on?.('cart:error', this.onError);

      this.addEventListener('click', (event) => {
        if (event.target.closest('[data-drawer-close]')) {
          this.close();
          return;
        }
        this.handleClick(event);
      });
      this.addEventListener('change', (event) => this.handleChange(event));
      this.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && event.target.matches('[data-qty]')) {
          event.preventDefault();
          event.target.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      this.addEventListener('submit', (event) => {
        if (!event.submitter || event.submitter.name !== 'checkout') event.preventDefault();
      });

      if (!CartDrawer.bound) {
        CartDrawer.bound = true;
        document.addEventListener('click', (event) => {
          const trigger = event.target.closest('[data-cart-drawer-open]');
          if (!trigger || K.cartType !== 'drawer') return;
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
          event.preventDefault();
          K.emit('cart:open');
        });
      }
    }

    disconnectedCallback() {
      K.off?.('cart:updated', this.onUpdated);
      K.off?.('cart:open', this.onOpen);
      K.off?.('cart:error', this.onError);
      document.removeEventListener('keydown', this.onKeydown);
      document.body.classList.remove('cart-drawer-open');
    }

    get content() {
      return this.querySelector('[data-drawer-content]');
    }

    open() {
      if (!this.hidden && this.classList.contains('is-open')) return;
      this.lastFocus = document.activeElement;
      this.hidden = false;
      document.body.classList.add('cart-drawer-open');
      document.addEventListener('keydown', this.onKeydown);
      // Force a frame so the transition runs.
      requestAnimationFrame(() => {
        this.classList.add('is-open');
        const first = this.panel.querySelector('[data-drawer-close].icon-btn') || this.panel;
        first.focus();
      });
      this.refresh();
    }

    close() {
      if (this.hidden) return;
      this.classList.remove('is-open');
      document.body.classList.remove('cart-drawer-open');
      document.removeEventListener('keydown', this.onKeydown);
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const done = () => {
        this.hidden = true;
        if (this.lastFocus && document.contains(this.lastFocus)) this.lastFocus.focus();
        this.lastFocus = null;
      };
      reduce ? done() : setTimeout(done, 300);
    }

    keydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.close();
        return;
      }
      if (event.key !== 'Tab') return;
      const nodes = [...this.panel.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
      if (!nodes.length) {
        event.preventDefault();
        this.panel.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === this.panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    announce(text) {
      if (!this.live || !text) return;
      this.live.textContent = '';
      requestAnimationFrame(() => {
        this.live.textContent = text;
      });
    }

    showError(message) {
      const box = this.querySelector('[data-drawer-error]');
      if (box) {
        box.textContent = message || '';
        box.hidden = !message;
      }
      if (message) this.announce(message);
    }

    /* Clamp a typed quantity to the variant quantity rule. 0 removes the line. */
    normalize(input, value) {
      const min = Number(input.dataset.min) || 1;
      const step = Number(input.dataset.step) || 1;
      const max = input.dataset.max ? Number(input.dataset.max) : Infinity;
      if (!value || value <= 0) return 0;
      if (value < min) return min;
      let next = min + Math.round((value - min) / step) * step;
      if (next > max) next = min + Math.floor((max - min) / step) * step;
      return Math.max(min, next);
    }

    handleClick(event) {
      const step = event.target.closest('[data-qty-step]');
      if (step) {
        const line = step.closest('[data-line-key]');
        const input = line.querySelector('[data-qty]');
        const current = parseInt(input.value, 10) || 0;
        const stepSize = Number(input.dataset.step) || 1;
        const direction = Number(step.dataset.qtyStep);
        const min = Number(input.dataset.min) || 1;
        let next = current + direction * stepSize;
        if (direction < 0 && next < min) next = 0;
        if (direction > 0 && input.dataset.max && next > Number(input.dataset.max)) next = current;
        if (next === current) {
          this.showError(this.dataset.msgMax || '');
          return;
        }
        input.value = next;
        this.update(line, next);
        return;
      }
      const remove = event.target.closest('[data-remove]');
      if (remove) {
        event.preventDefault();
        this.update(remove.closest('[data-line-key]'), 0);
      }
    }

    handleChange(event) {
      const input = event.target;
      if (input.matches('[data-qty]')) {
        const next = this.normalize(input, parseInt(input.value, 10) || 0);
        input.value = next;
        this.update(input.closest('[data-line-key]'), next);
      } else if (input.matches('textarea[name="note"]')) {
        K.fetchJSON(`${K.routes?.cartUpdate || '/cart/update'}.js`, {
          method: 'POST',
          body: JSON.stringify({ note: input.value }),
        }).catch(() => {});
      }
    }

    async update(line, quantity) {
      if (!line || !K.cart) return;
      line.setAttribute('aria-busy', 'true');
      try {
        await K.cart.change(line.dataset.lineKey, quantity);
        // refresh() runs from the kinetic:cart:updated listener.
      } catch (_) {
        // The message arrives through kinetic:cart:error; resync the markup.
        this.refresh();
      }
    }

    focusToken() {
      const active = document.activeElement;
      if (!active || !this.content || !this.content.contains(active)) return null;
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
        const lines = [...this.querySelectorAll('[data-line-key]')];
        const line = lines.find((el) => el.dataset.lineKey === token.key);
        if (line) {
          target =
            token.control === 'remove'
              ? line.querySelector('[data-remove]')
              : token.control === 'qty'
                ? line.querySelector('[data-qty]')
                : line.querySelector(`[data-qty-step="${token.control.slice(4)}"]`);
        } else {
          const neighbour = lines[Math.min(token.index - 1, lines.length - 1)];
          target = neighbour?.querySelector('[data-remove]') || this.panel;
        }
      }
      target?.focus({ preventScroll: true });
    }

    async refresh() {
      const seq = ++this.seq;
      const token = this.focusToken();
      const content = this.content;
      if (!content) return;
      const note = this.querySelector('textarea[name="note"]');
      const noteValue = note && document.activeElement === note ? note.value : null;
      const oldFill = this.querySelector('[data-bar-fill]');
      const oldWidth = oldFill ? oldFill.style.width : null;
      const cartUrl = K.routes?.cart || '/cart';

      try {
        const res = await fetch(`${cartUrl}?sections=${encodeURIComponent(this.sectionId)}`, {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`Section request failed (${res.status})`);
        const sections = await res.json();
        if (seq !== this.seq) return; // a newer refresh superseded this one

        const html = sections[this.sectionId];
        if (!html) throw new Error('Missing cart drawer markup');
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const freshContent = doc.querySelector('[data-drawer-content]');
        if (!freshContent) throw new Error('Missing cart drawer markup');

        content.innerHTML = freshContent.innerHTML;
        const title = this.querySelector('[data-drawer-title]');
        const freshTitle = doc.querySelector('[data-drawer-title]');
        if (title && freshTitle) title.textContent = freshTitle.textContent;

        if (noteValue !== null) {
          const freshNote = this.querySelector('textarea[name="note"]');
          if (freshNote) freshNote.value = noteValue;
        }

        const fill = this.querySelector('[data-bar-fill]');
        if (fill && oldWidth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          const target = fill.style.width;
          fill.style.width = oldWidth;
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              fill.style.width = target;
            })
          );
        }

        this.restoreFocus(token);
        this.announce(this.dataset.msgUpdated);
      } catch (_) {
        this.showError(this.dataset.msgError);
        content.querySelectorAll('[aria-busy]').forEach((el) => el.removeAttribute('aria-busy'));
      }
    }
  }

  customElements.define('cart-drawer', CartDrawer);
})();
