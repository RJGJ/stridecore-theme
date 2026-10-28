/**
 * <stridecore-accordion> : accessible disclosure group.
 * Triggers are buttons[data-accordion-trigger] with aria-expanded + aria-controls pointing at a panel.
 * Add the `data-single` attribute to keep at most one panel open.
 */
(() => {
  if (customElements.get('stridecore-accordion')) return;

  class StridecoreAccordion extends HTMLElement {
    connectedCallback() {
      if (this._ready) return;
      this._ready = true;

      this.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-accordion-trigger]');
        if (!trigger || !this.contains(trigger)) return;
        this.toggle(trigger);
      });

      this.addEventListener('keydown', (event) => {
        const trigger = event.target.closest('[data-accordion-trigger]');
        if (!trigger) return;
        const all = [...this.querySelectorAll('[data-accordion-trigger]')];
        const i = all.indexOf(trigger);
        let next;
        if (event.key === 'ArrowDown') next = all[(i + 1) % all.length];
        else if (event.key === 'ArrowUp') next = all[(i - 1 + all.length) % all.length];
        else if (event.key === 'Home') next = all[0];
        else if (event.key === 'End') next = all[all.length - 1];
        if (next) {
          event.preventDefault();
          next.focus();
        }
      });
    }

    set(trigger, open) {
      const panel = document.getElementById(trigger.getAttribute('aria-controls'));
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (panel) panel.hidden = !open;
    }

    toggle(trigger) {
      const open = trigger.getAttribute('aria-expanded') !== 'true';
      if (open && this.hasAttribute('data-single')) {
        this.querySelectorAll('[data-accordion-trigger][aria-expanded="true"]').forEach((other) => {
          if (other !== trigger) this.set(other, false);
        });
      }
      this.set(trigger, open);
    }
  }

  customElements.define('stridecore-accordion', StridecoreAccordion);
})();
