/**
 * <facet-form> : progressive enhancement for the collection filter/sort form.
 *
 * Markup contract (see sections/main-collection.liquid):
 *   <facet-form data-section-id data-label-show data-label-hide>
 *     <form data-facet-form> ... inputs / select[data-facet-sort] ...
 *       [data-facet-toggle] / [data-facet-toggle-label]   show/hide the sidebar
 *       [data-facet-sidebar]                              the filter aside
 *       [data-facet-apply]                                no-JS submit button (hidden here)
 *       [data-facet-status]                               aria-live region
 *       [data-facet-swap="key"]                           regions replaced from the Section Rendering API
 *       a[data-facet-link], .pagination a                 intercepted links
 *
 * Without JS the form is a plain GET and everything keeps working.
 */
class FacetForm extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('form[data-facet-form]');
    if (!this.form) return;
    this.sectionId = this.dataset.sectionId;
    this.controller = null;
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const apply = this.querySelector('[data-facet-apply]');
    if (apply) apply.hidden = true;

    this.onChange = (event) => {
      if (!event.target.closest('form')) return;
      this.submit();
    };
    this.onSubmit = (event) => {
      event.preventDefault();
      this.submit();
    };
    this.onClick = (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const toggle = event.target.closest('[data-facet-toggle]');
      if (toggle && this.contains(toggle)) {
        this.toggleSidebar(toggle);
        return;
      }

      const link = event.target.closest('a[data-facet-link], .pagination a');
      if (!link || !this.contains(link) || !link.href) return;
      event.preventDefault();
      const isPage = link.closest('.pagination');
      this.update(link.href, true, Boolean(isPage));
    };
    this.onPopState = () => this.update(window.location.href, false);

    this.form.addEventListener('change', this.onChange);
    this.form.addEventListener('submit', this.onSubmit);
    this.addEventListener('click', this.onClick);
    window.addEventListener('popstate', this.onPopState);
  }

  disconnectedCallback() {
    if (this.controller) this.controller.abort();
    if (!this.form) return;
    this.form.removeEventListener('change', this.onChange);
    this.form.removeEventListener('submit', this.onSubmit);
    this.removeEventListener('click', this.onClick);
    window.removeEventListener('popstate', this.onPopState);
  }

  toggleSidebar(button) {
    const sidebar = this.querySelector('[data-facet-sidebar]');
    if (!sidebar) return;
    const open = sidebar.hidden;
    sidebar.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    const label = button.querySelector('[data-facet-toggle-label]');
    if (label) label.textContent = open ? this.dataset.labelHide : this.dataset.labelShow;
  }

  buildUrl() {
    const params = new URLSearchParams();
    new FormData(this.form).forEach((value, key) => {
      if (typeof value === 'string' && value.trim() !== '') params.append(key, value);
    });
    const action = this.form.getAttribute('action') || window.location.pathname;
    const query = params.toString();
    return query ? `${action}?${query}` : action;
  }

  submit() {
    this.update(this.buildUrl(), true);
  }

  async update(url, push, scrollToTop = false) {
    if (this.controller) this.controller.abort();
    this.controller = new AbortController();
    const { signal } = this.controller;

    const target = new URL(url, window.location.origin);
    target.searchParams.delete('section_id');
    const pageUrl = target.pathname + target.search;
    const fetchUrl = new URL(target.href);
    fetchUrl.searchParams.set('section_id', this.sectionId);

    const results = this.querySelector('[data-facet-swap="results"]');
    if (results) {
      results.classList.add('is-loading');
      results.setAttribute('aria-busy', 'true');
    }

    try {
      const response = await fetch(fetchUrl.toString(), { signal, credentials: 'same-origin' });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      this.swap(doc);
      if (push) window.history.pushState({ facets: true }, '', pageUrl);
      if (scrollToTop && results) {
        results.scrollIntoView({ behavior: this.reduceMotion ? 'auto' : 'smooth', block: 'start' });
      }
    } catch (error) {
      if (error.name === 'AbortError') return;
      /* Fall back to a normal navigation so the user still gets results. */
      window.location.assign(pageUrl);
    } finally {
      if (results && !signal.aborted) {
        results.classList.remove('is-loading');
        results.removeAttribute('aria-busy');
      }
    }
  }

  swap(doc) {
    const activeId = document.activeElement && this.contains(document.activeElement) ? document.activeElement.id : '';

    doc.querySelectorAll('[data-facet-swap]').forEach((fresh) => {
      const key = fresh.getAttribute('data-facet-swap');
      const current = this.querySelector(`[data-facet-swap="${key}"]`);
      if (current) current.innerHTML = fresh.innerHTML;
    });

    /* Keep the sort select in step with the URL (back/forward). */
    const freshSort = doc.querySelector('[data-facet-sort]');
    const sort = this.querySelector('[data-facet-sort]');
    if (freshSort && sort) sort.value = freshSort.value;

    if (activeId) {
      const el = document.getElementById(activeId);
      if (el && el !== document.activeElement) el.focus({ preventScroll: true });
    }

    const status = this.querySelector('[data-facet-status]');
    const count = this.querySelector('[data-facet-swap="count-toolbar"]');
    if (status && count) status.textContent = count.textContent.trim();
  }
}

if (!customElements.get('facet-form')) customElements.define('facet-form', FacetForm);
