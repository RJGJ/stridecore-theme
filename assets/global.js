/**
 * KINETIC core runtime. Loaded on every page (deferred).
 *
 * Public contract (window.KINETIC):
 *   K.on(name, fn) / K.off(name, fn) / K.emit(name, detail)   event bus on document, names prefixed "kinetic:"
 *   K.fetchJSON(url, options)                                  fetch + JSON with error handling
 *   K.money(cents)                                             format minor units in the shop currency
 *   K.debounce(fn, ms)
 *   K.cart.get()                                               GET /cart.js
 *   K.cart.add({ id, quantity, properties }, { open })         POST /cart/add.js, emits kinetic:cart:updated
 *   K.cart.change(lineKey, quantity)                           POST /cart/change.js, emits kinetic:cart:updated
 *   K.cart.refresh()                                           re-read the cart and emit kinetic:cart:updated
 *
 * Events:
 *   kinetic:cart:updated   detail: cart JSON (carries item_count, total_price, items)
 *   kinetic:cart:open      ask the cart drawer to open
 *   kinetic:cart:error     detail: { message }
 *
 * DOM hooks handled here:
 *   [data-cart-count]      text is kept in sync with cart.item_count; hidden when 0
 *   [data-quick-add]       click adds data-variant-id (quantity data-quantity or 1)
 */
(() => {
  const K = (window.KINETIC = window.KINETIC || {});
  const routes = K.routes || {};

  K.on = (name, fn) => document.addEventListener(`kinetic:${name}`, fn);
  K.off = (name, fn) => document.removeEventListener(`kinetic:${name}`, fn);
  K.emit = (name, detail) =>
    document.dispatchEvent(new CustomEvent(`kinetic:${name}`, { detail }));

  K.debounce = (fn, ms = 250) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  K.fetchJSON = async (url, options = {}) => {
    const res = await fetch(url, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.description || data.message || `Request failed (${res.status})`);
    }
    return data;
  };

  const formatter = () =>
    new Intl.NumberFormat(K.locale || undefined, {
      style: 'currency',
      currency: K.currency || 'USD',
    });
  let fmt;
  K.money = (cents) => (fmt = fmt || formatter()).format((Number(cents) || 0) / 100);

  const syncCount = (cart) => {
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      el.textContent = cart.item_count;
      el.hidden = cart.item_count === 0;
    });
  };

  K.cart = {
    get: () => K.fetchJSON(`${routes.cart || '/cart'}.js`),

    async refresh() {
      const cart = await K.cart.get();
      syncCount(cart);
      K.emit('cart:updated', cart);
      return cart;
    },

    async add({ id, quantity = 1, properties } = {}, { open = true } = {}) {
      try {
        await K.fetchJSON(routes.cartAdd ? `${routes.cartAdd}.js` : '/cart/add.js', {
          method: 'POST',
          body: JSON.stringify({ items: [{ id, quantity, properties }] }),
        });
        const cart = await K.cart.refresh();
        if (open && K.cartType === 'drawer') K.emit('cart:open');
        return cart;
      } catch (error) {
        K.emit('cart:error', { message: error.message });
        throw error;
      }
    },

    async change(line, quantity) {
      const body = typeof line === 'string' ? { id: line, quantity } : { line, quantity };
      try {
        const cart = await K.fetchJSON(
          routes.cartChange ? `${routes.cartChange}.js` : '/cart/change.js',
          { method: 'POST', body: JSON.stringify(body) }
        );
        syncCount(cart);
        K.emit('cart:updated', cart);
        return cart;
      } catch (error) {
        K.emit('cart:error', { message: error.message });
        throw error;
      }
    },
  };

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-quick-add]');
    if (!button || button.disabled) return;
    event.preventDefault();
    const label = button.textContent;
    button.disabled = true;
    try {
      await K.cart.add({
        id: Number(button.dataset.variantId),
        quantity: Number(button.dataset.quantity || 1),
      });
    } catch (_) {
      /* error is surfaced through kinetic:cart:error */
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  });

  K.cart
    .get()
    .then(syncCount)
    .catch(() => {});
})();
