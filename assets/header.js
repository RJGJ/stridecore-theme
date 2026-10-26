/**
 * KINETIC header behavior.
 *
 * 1. Mobile drawer toggle ([data-menu-toggle] controls the nav by aria-controls).
 * 2. Navigation disclosure ([data-nav-item] > [data-nav-toggle] controls [data-nav-panel]).
 *    Desktop (min-width 800px): one dropdown / mega panel open at a time; hover opens it,
 *    click on the caret button toggles it, ArrowDown on the button opens it and moves into
 *    the panel, ArrowUp/ArrowDown/Home/End move through the panel links, ArrowLeft/Right
 *    move between top-level links, Escape closes and returns focus to the button, and
 *    focus leaving the item closes it. Focus order always follows the DOM.
 *    Mobile: every caret button is an independent accordion toggle.
 * 3. Search modal: [data-search-open] opens <dialog data-search-modal> (the link still
 *    works as a normal link to the search page without JS); [data-search-close] or Escape
 *    or a click on the backdrop closes it.
 */
(() => {
  if (window.__kineticHeader) return;
  window.__kineticHeader = true;

  const desktop = window.matchMedia('(min-width: 800px)');
  const SELECTOR_FOCUSABLE = 'a[href], button:not([disabled])';

  /* ---------- Mobile drawer ---------- */

  const closeDrawer = (toggle, nav, restore) => {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', toggle.dataset.openLabel);
    toggle.querySelector('[data-icon-open]').hidden = false;
    toggle.querySelector('[data-icon-close]').hidden = true;
    nav.classList.remove('is-open');
    if (restore) toggle.focus();
  };

  const openDrawer = (toggle, nav) => {
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', toggle.dataset.closeLabel);
    toggle.querySelector('[data-icon-open]').hidden = true;
    toggle.querySelector('[data-icon-close]').hidden = false;
    nav.classList.add('is-open');
    const first = nav.querySelector(SELECTOR_FOCUSABLE);
    if (first) first.focus();
  };

  /* ---------- Disclosure panels ---------- */

  const setPanel = (toggle, open) => {
    const panel = document.getElementById(toggle.getAttribute('aria-controls'));
    if (!panel) return;
    toggle.setAttribute('aria-expanded', String(open));
    panel.classList.toggle('is-open', open);
  };

  const topToggles = (nav) => Array.from(nav.querySelectorAll('.hnav__row > .hnav__toggle:not(.hnav__toggle--sub)'));

  const closeTopLevel = (nav, except) => {
    topToggles(nav).forEach((toggle) => {
      if (toggle !== except) setPanel(toggle, false);
    });
  };

  const panelLinks = (panel) =>
    Array.from(panel.querySelectorAll(SELECTOR_FOCUSABLE)).filter((el) => el.offsetParent !== null);

  const hoverTimers = new WeakMap();

  document.addEventListener('click', (event) => {
    const menuToggle = event.target.closest('[data-menu-toggle]');
    if (menuToggle) {
      const nav = document.getElementById(menuToggle.getAttribute('aria-controls'));
      if (!nav) return;
      if (menuToggle.getAttribute('aria-expanded') === 'true') closeDrawer(menuToggle, nav);
      else openDrawer(menuToggle, nav);
      return;
    }

    const navToggle = event.target.closest('[data-nav-toggle]');
    if (navToggle) {
      const nav = navToggle.closest('[data-site-nav]');
      const open = navToggle.getAttribute('aria-expanded') !== 'true';
      if (desktop.matches && nav && !navToggle.classList.contains('hnav__toggle--sub')) closeTopLevel(nav, navToggle);
      setPanel(navToggle, open);
      return;
    }

    /* Click outside closes desktop panels. */
    document.querySelectorAll('[data-site-nav]').forEach((nav) => {
      if (desktop.matches && !nav.contains(event.target)) closeTopLevel(nav);
    });
  });

  /* Hover (mouse only) opens a top-level panel; leaving closes it after a short delay. */
  document.addEventListener('pointerover', (event) => {
    if (!desktop.matches || event.pointerType !== 'mouse') return;
    const item = event.target.closest('[data-nav-item]');
    if (!item) return;
    const toggle = item.querySelector(':scope > .hnav__row > .hnav__toggle');
    if (!toggle) return;
    clearTimeout(hoverTimers.get(item));
    const nav = item.closest('[data-site-nav]');
    closeTopLevel(nav, toggle);
    setPanel(toggle, true);
  });

  document.addEventListener('pointerout', (event) => {
    if (!desktop.matches || event.pointerType !== 'mouse') return;
    const item = event.target.closest('[data-nav-item]');
    if (!item || item.contains(event.relatedTarget)) return;
    const toggle = item.querySelector(':scope > .hnav__row > .hnav__toggle');
    if (!toggle) return;
    /* Keep the panel open while keyboard focus is inside it. */
    hoverTimers.set(
      item,
      setTimeout(() => {
        if (!item.contains(document.activeElement)) setPanel(toggle, false);
      }, 150)
    );
  });

  document.addEventListener('focusout', (event) => {
    if (!desktop.matches) return;
    const item = event.target.closest && event.target.closest('[data-nav-item]');
    if (!item || (event.relatedTarget && item.contains(event.relatedTarget))) return;
    const toggle = item.querySelector(':scope > .hnav__row > .hnav__toggle');
    if (toggle && event.relatedTarget) setPanel(toggle, false);
  });

  document.addEventListener('keydown', (event) => {
    const nav = event.target.closest && event.target.closest('[data-site-nav]');

    if (event.key === 'Escape') {
      /* 1. Search modal handles its own Escape natively (dialog cancel). */
      /* 2. Desktop: close the open panel that holds focus (or the hovered one). */
      if (nav && desktop.matches) {
        const openToggle = topToggles(nav).find((t) => t.getAttribute('aria-expanded') === 'true');
        if (openToggle) {
          event.preventDefault();
          event.stopPropagation();
          setPanel(openToggle, false);
          if (nav.contains(document.activeElement) && document.activeElement !== openToggle) openToggle.focus();
          return;
        }
      }
      /* 3. Mobile drawer. */
      document.querySelectorAll('[data-menu-toggle][aria-expanded="true"]').forEach((toggle) => {
        const drawer = document.getElementById(toggle.getAttribute('aria-controls'));
        if (drawer && !desktop.matches) closeDrawer(toggle, drawer, true);
      });
      return;
    }

    if (!nav || !desktop.matches) return;
    const target = event.target;

    /* Inside an open panel: arrow keys move through its links in DOM order. */
    const panel = target.closest('.hnav__panel');
    if (panel) {
      const links = panelLinks(panel);
      const index = links.indexOf(target);
      let next = -1;
      if (event.key === 'ArrowDown') next = Math.min(index + 1, links.length - 1);
      else if (event.key === 'ArrowUp') next = index - 1;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = links.length - 1;
      else return;
      event.preventDefault();
      if (next < 0) {
        const toggle = panel.closest('[data-nav-item]').querySelector(':scope > .hnav__row > .hnav__toggle');
        if (toggle) toggle.focus();
      } else if (links[next]) {
        links[next].focus();
      }
      return;
    }

    /* On the top level row: ArrowDown opens a panel, ArrowLeft/Right move between top links. */
    const row = target.closest('.hnav__row');
    if (!row || row.classList.contains('hnav__row--sub')) return;
    const item = row.closest('[data-nav-item]');
    const toggle = row.querySelector('.hnav__toggle');

    if (event.key === 'ArrowDown' && toggle) {
      event.preventDefault();
      closeTopLevel(nav, toggle);
      setPanel(toggle, true);
      const first = panelLinks(document.getElementById(toggle.getAttribute('aria-controls')))[0];
      if (first) first.focus();
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === 'Home' || event.key === 'End') {
      const links = Array.from(nav.querySelectorAll('.hnav__link'));
      const current = links.indexOf(item.querySelector('.hnav__link'));
      let next = current;
      if (event.key === 'ArrowRight') next = (current + 1) % links.length;
      else if (event.key === 'ArrowLeft') next = (current - 1 + links.length) % links.length;
      else if (event.key === 'Home') next = 0;
      else next = links.length - 1;
      event.preventDefault();
      closeTopLevel(nav);
      links[next].focus();
    }
  });

  desktop.addEventListener('change', () => {
    document.querySelectorAll('[data-menu-toggle]').forEach((toggle) => {
      const nav = document.getElementById(toggle.getAttribute('aria-controls'));
      if (nav) closeDrawer(toggle, nav);
    });
    document.querySelectorAll('[data-nav-toggle]').forEach((toggle) => setPanel(toggle, false));
  });

  /* ---------- Search modal ---------- */

  const lockScroll = (locked) => {
    document.documentElement.style.overflow = locked ? 'hidden' : '';
  };

  document.addEventListener('click', (event) => {
    const opener = event.target.closest('[data-search-open]');
    if (opener) {
      const modal = document.querySelector('[data-search-modal]');
      if (!modal || typeof modal.showModal !== 'function') return;
      event.preventDefault();
      if (!modal.open) modal.showModal();
      lockScroll(true);
      const input = modal.querySelector('input[name="q"]');
      if (input) input.focus();
      return;
    }

    const closer = event.target.closest('[data-search-close]');
    if (closer) {
      const modal = closer.closest('dialog');
      if (modal) modal.close();
      return;
    }

    /* Click on the backdrop (the dialog element itself) closes it. */
    if (event.target instanceof HTMLDialogElement && event.target.hasAttribute('data-search-modal')) {
      event.target.close();
    }
  });

  document.addEventListener(
    'close',
    (event) => {
      if (event.target.matches && event.target.matches('[data-search-modal]')) {
        lockScroll(false);
        const opener = document.querySelector('[data-search-open]');
        if (opener) opener.focus();
      }
    },
    true
  );
})();
