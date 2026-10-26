/* KINETIC header: mobile menu toggle. */
(() => {
  if (window.__kineticHeader) return;
  window.__kineticHeader = true;

  const close = (toggle, nav, restore) => {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', toggle.dataset.openLabel);
    toggle.querySelector('[data-icon-open]').hidden = false;
    toggle.querySelector('[data-icon-close]').hidden = true;
    nav.classList.remove('is-open');
    if (restore) toggle.focus();
  };

  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-menu-toggle]');
    if (!toggle) return;
    const nav = document.getElementById(toggle.getAttribute('aria-controls'));
    if (!nav) return;
    if (toggle.getAttribute('aria-expanded') === 'true') {
      close(toggle, nav);
      return;
    }
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', toggle.dataset.closeLabel);
    toggle.querySelector('[data-icon-open]').hidden = true;
    toggle.querySelector('[data-icon-close]').hidden = false;
    nav.classList.add('is-open');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('[data-menu-toggle][aria-expanded="true"]').forEach((toggle) => {
      const nav = document.getElementById(toggle.getAttribute('aria-controls'));
      if (nav) close(toggle, nav, true);
    });
  });

  window.matchMedia('(min-width: 800px)').addEventListener('change', (mq) => {
    if (!mq.matches) return;
    document.querySelectorAll('[data-menu-toggle]').forEach((toggle) => {
      const nav = document.getElementById(toggle.getAttribute('aria-controls'));
      if (nav) close(toggle, nav);
    });
  });
})();
