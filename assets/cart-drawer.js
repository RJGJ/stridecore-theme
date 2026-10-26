/* KINETIC cart drawer: <cart-drawer> custom element. Renders from cart JSON. */
(() => {
  if (customElements.get('cart-drawer')) return;
  const K = (window.KINETIC = window.KINETIC || {});

  const esc = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const sized = (src, width) => {
    try {
      const url = new URL(src, location.origin);
      url.searchParams.set('width', width);
      return url.toString();
    } catch (_) {
      return src;
    }
  };

  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

  class CartDrawer extends HTMLElement {
    connectedCallback() {
      this.panel = this.querySelector('[data-drawer-panel]');
      this.body = this.querySelector('[data-drawer-body]');
      this.foot = this.querySelector('[data-drawer-foot]');
      this.live = this.querySelector('[data-drawer-live]');
      this.strings = JSON.parse(this.querySelector('[data-drawer-strings]').textContent);
      this.cart = null;
      this.lastFocus = null;

      this.onUpdated = (event) => this.render(event.detail);
      this.onOpen = () => this.open();
      this.onKeydown = (event) => this.keydown(event);
      K.on?.('cart:updated', this.onUpdated);
      K.on?.('cart:open', this.onOpen);

      this.addEventListener('click', (event) => {
        if (event.target.closest('[data-drawer-close]')) {
          this.close();
          return;
        }
        const action = event.target.closest('[data-action]');
        if (action) this.handleAction(action);
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

      K.cart?.get().then((cart) => this.render(cart)).catch(() => {});
    }

    disconnectedCallback() {
      K.off?.('cart:updated', this.onUpdated);
      K.off?.('cart:open', this.onOpen);
      document.removeEventListener('keydown', this.onKeydown);
      document.body.classList.remove('cart-drawer-open');
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
      K.cart?.get().then((cart) => this.render(cart)).catch(() => {});
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

    async handleAction(button) {
      const item = button.closest('[data-key]');
      if (!item) return;
      const key = item.dataset.key;
      const qty = Number(item.dataset.qty);
      const action = button.dataset.action;
      const next = action === 'inc' ? qty + 1 : action === 'dec' ? qty - 1 : 0;
      const focusKey = action === 'remove' ? null : `${key}:${action}`;
      item.classList.add('is-busy');
      try {
        await K.cart.change(key, Math.max(0, next));
        if (focusKey) {
          const [k, a] = focusKey.split(':');
          const el = this.querySelector(`[data-key="${CSS.escape(k)}"] [data-action="${a}"]`);
          el?.focus();
        } else {
          this.panel.focus();
        }
      } catch (_) {
        item.classList.remove('is-busy');
        this.announce(this.strings.error);
      }
    }

    announce(text) {
      this.live.textContent = '';
      requestAnimationFrame(() => (this.live.textContent = text));
    }

    render(cart) {
      if (!cart) return;
      this.cart = cart;
      const s = this.strings;
      const count = cart.item_count;
      this.querySelector('[data-drawer-title]').textContent = s.title.replace('__COUNT__', count);

      this.renderShipping(cart);

      if (!cart.items.length) {
        this.body.innerHTML = '';
        this.body.append(this.querySelector('[data-drawer-empty]').content.cloneNode(true));
        this.foot.hidden = true;
        this.announce(s.updated);
        return;
      }

      const placeholder = this.querySelector('[data-drawer-placeholder]').innerHTML;
      const items = cart.items
        .map((item) => {
          const title = esc(item.product_title);
          const media = item.featured_image && item.featured_image.url
            ? `<div class="media" style="aspect-ratio:4 / 5"><img src="${esc(sized(item.featured_image.url, 240))}" alt="${esc(item.featured_image.alt || item.product_title)}" width="96" height="120" loading="lazy"></div>`
            : placeholder;
          const variant = item.variant_title && item.variant_title !== 'Default Title'
            ? `<span class="cart-drawer__meta">${esc(item.variant_title)}</span>`
            : '';
          const unit = `<span class="cart-drawer__meta mono">${esc(s.each.replace('__PRICE__', K.money(item.final_price)))}</span>`;
          return `<li class="cart-drawer__item" data-key="${esc(item.key)}" data-qty="${item.quantity}">
  <a href="${esc(item.url)}" class="cart-drawer__thumb" tabindex="-1" aria-hidden="true">${media}</a>
  <div class="cart-drawer__info">
    <div class="cart-drawer__row">
      <div><a href="${esc(item.url)}" class="cart-drawer__name">${title}</a>${variant}${unit}</div>
      <span class="cart-drawer__line">${esc(K.money(item.final_line_price))}</span>
    </div>
    <div class="cart-drawer__controls">
      <div class="cart-drawer__qty" role="group" aria-label="${esc(s.quantity)}">
        <button type="button" data-action="dec" aria-label="${esc(s.decrease.replace('__TITLE__', item.product_title))}">&minus;</button>
        <span class="cart-drawer__qty-value" aria-live="polite">${item.quantity}</span>
        <button type="button" data-action="inc" aria-label="${esc(s.increase.replace('__TITLE__', item.product_title))}">+</button>
      </div>
      <button type="button" class="cart-drawer__remove" data-action="remove" aria-label="${esc(s.removeItem.replace('__TITLE__', item.product_title))}">${esc(s.remove)}</button>
    </div>
  </div>
</li>`;
        })
        .join('');
      this.body.innerHTML = `<ul class="cart-drawer__list">${items}</ul>`;
      this.querySelector('[data-drawer-subtotal]').textContent = K.money(cart.total_price);
      this.foot.hidden = false;
      this.announce(s.updated);
    }

    renderShipping(cart) {
      const wrap = this.querySelector('[data-drawer-shipping]');
      const threshold = Number(K.freeShippingThreshold) || 0;
      if (!threshold || !cart.items.length) {
        wrap.hidden = true;
        return;
      }
      const msg = wrap.querySelector('[data-drawer-shipping-msg]');
      msg.id = 'cart-drawer-shipping-msg';
      const left = Math.max(0, threshold - cart.total_price);
      const pct = Math.min(100, Math.round((cart.total_price / threshold) * 100));
      msg.textContent = left > 0 ? this.strings.away.replace('__AMOUNT__', K.money(left)) : this.strings.unlocked;
      const bar = wrap.querySelector('[data-drawer-bar]');
      bar.setAttribute('aria-valuenow', pct);
      wrap.querySelector('[data-drawer-bar-fill]').style.width = `${pct}%`;
      wrap.hidden = false;
    }
  }

  customElements.define('cart-drawer', CartDrawer);
})();
