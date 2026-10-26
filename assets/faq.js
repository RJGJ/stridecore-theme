/**
 * <faq-list>: accordion for sections/faq.liquid.
 * Markup ships fully expanded (works without JS). On connect we collapse every
 * panel except, optionally, the first, then keep one open at a time.
 */
(() => {
  if (customElements.get('faq-list')) return;

  class FaqList extends HTMLElement {
    connectedCallback() {
      this.triggers = [...this.querySelectorAll('.faq__trigger')];
      const openFirst = this.dataset.firstOpen === 'true';
      this.triggers.forEach((trigger, i) => this.set(trigger, openFirst && i === 0));

      this.addEventListener('click', (event) => {
        const trigger = event.target.closest('.faq__trigger');
        if (!trigger) return;
        const willOpen = trigger.getAttribute('aria-expanded') !== 'true';
        this.triggers.forEach((other) => this.set(other, other === trigger && willOpen));
      });

      this.addEventListener('keydown', (event) => {
        const trigger = event.target.closest('.faq__trigger');
        if (!trigger) return;
        const i = this.triggers.indexOf(trigger);
        const keys = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: this.triggers.length - 1 };
        if (!(event.key in keys)) return;
        event.preventDefault();
        const next = (keys[event.key] + this.triggers.length) % this.triggers.length;
        this.triggers[next].focus();
      });
    }

    set(trigger, open) {
      trigger.setAttribute('aria-expanded', String(open));
      const panel = document.getElementById(trigger.getAttribute('aria-controls'));
      if (panel) panel.hidden = !open;
    }
  }

  customElements.define('faq-list', FaqList);
})();
