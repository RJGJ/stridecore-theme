/**
 * <predictive-search> : combobox dropdown backed by the Predictive Search API.
 *
 * Markup contract (see sections/main-search.liquid):
 *   <predictive-search data-section-id="predictive-search" data-url="/search/suggest" data-min-length="2">
 *     <form role="search"> <input type="search" name="q"> ... </form>
 *     <div data-predictive-panel id="..." role="listbox" hidden></div>
 *     <p data-predictive-live class="visually-hidden" role="status" aria-live="polite"></p>
 *   </predictive-search>
 *
 * The panel is filled with [data-predictive-results] from sections/predictive-search.liquid.
 * Keyboard: ArrowDown/ArrowUp move through options, Enter follows the active option
 * (otherwise submits the form), Escape closes (a second Escape clears), Tab closes.
 */
class PredictiveSearch extends HTMLElement {
  connectedCallback() {
    this.input = this.querySelector('input[name="q"]');
    this.panel = this.querySelector('[data-predictive-panel]');
    this.live = this.querySelector('[data-predictive-live]');
    if (!this.input || !this.panel) return;

    const K = window.KINETIC || {};
    const routes = K.routes || {};
    this.url = this.dataset.url || routes.predictiveSearch || '/search/suggest';
    this.sectionId = this.dataset.sectionId || 'predictive-search';
    this.minLength = Number(this.dataset.minLength || 2);
    this.cache = new Map();
    this.controller = null;
    this.activeIndex = -1;
    this.lastQuery = '';

    const debounce =
      K.debounce ||
      ((fn, ms) => {
        let t;
        return (...args) => {
          clearTimeout(t);
          t = setTimeout(() => fn(...args), ms);
        };
      });
    this.debouncedSearch = debounce((q) => this.search(q), 250);

    this.input.setAttribute('role', 'combobox');
    this.input.setAttribute('aria-autocomplete', 'list');
    this.input.setAttribute('aria-haspopup', 'listbox');
    this.input.setAttribute('aria-expanded', 'false');
    this.input.setAttribute('aria-controls', this.panel.id);
    this.input.setAttribute('autocomplete', 'off');
    this.input.setAttribute('autocapitalize', 'off');
    this.input.setAttribute('spellcheck', 'false');

    this.onInput = () => {
      const q = this.input.value.trim();
      if (q.length < this.minLength) {
        if (this.controller) this.controller.abort();
        this.close();
        return;
      }
      this.debouncedSearch(q);
    };
    this.onKeydown = (event) => this.handleKey(event);
    this.onFocus = () => {
      if (this.panel.innerHTML.trim() && this.input.value.trim() === this.lastQuery) this.open();
    };
    this.onDocClick = (event) => {
      if (!this.contains(event.target)) this.close();
    };
    this.onFocusOut = (event) => {
      if (event.relatedTarget && !this.contains(event.relatedTarget)) this.close();
    };
    this.onPanelMove = (event) => {
      const option = event.target.closest('[role="option"]');
      if (!option) return;
      const index = this.options().indexOf(option);
      if (index > -1 && index !== this.activeIndex) this.setActive(index);
    };

    this.input.addEventListener('input', this.onInput);
    this.input.addEventListener('keydown', this.onKeydown);
    this.input.addEventListener('focus', this.onFocus);
    this.panel.addEventListener('mousemove', this.onPanelMove);
    this.addEventListener('focusout', this.onFocusOut);
    document.addEventListener('click', this.onDocClick);
  }

  disconnectedCallback() {
    if (this.controller) this.controller.abort();
    document.removeEventListener('click', this.onDocClick);
  }

  options() {
    return Array.from(this.panel.querySelectorAll('[role="option"]'));
  }

  isOpen() {
    return !this.panel.hidden;
  }

  open() {
    this.panel.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
  }

  close() {
    this.panel.hidden = true;
    this.input.setAttribute('aria-expanded', 'false');
    this.setActive(-1);
  }

  setActive(index) {
    const options = this.options();
    options.forEach((option, i) => {
      const active = i === index;
      option.setAttribute('aria-selected', String(active));
      option.classList.toggle('is-active', active);
    });
    this.activeIndex = index;
    if (index > -1 && options[index]) {
      this.input.setAttribute('aria-activedescendant', options[index].id);
      options[index].scrollIntoView({ block: 'nearest' });
    } else {
      this.input.removeAttribute('aria-activedescendant');
    }
  }

  handleKey(event) {
    const options = this.options();
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        if (!options.length) return;
        event.preventDefault();
        if (!this.isOpen()) this.open();
        const last = options.length - 1;
        let next;
        if (event.key === 'ArrowDown') next = this.activeIndex >= last ? -1 : this.activeIndex + 1;
        else next = this.activeIndex <= -1 ? last : this.activeIndex - 1;
        this.setActive(next);
        break;
      }
      case 'Enter':
        if (this.isOpen() && this.activeIndex > -1 && options[this.activeIndex]) {
          event.preventDefault();
          options[this.activeIndex].click();
        }
        break;
      case 'Escape':
        if (this.isOpen()) {
          event.preventDefault();
          this.close();
        } else if (this.input.value) {
          event.preventDefault();
          this.input.value = '';
          this.lastQuery = '';
        }
        break;
      case 'Tab':
        this.close();
        break;
      default:
    }
  }

  async search(query) {
    this.lastQuery = query;
    const cached = this.cache.get(query);
    if (cached !== undefined) {
      this.render(cached);
      return;
    }

    if (this.controller) this.controller.abort();
    this.controller = new AbortController();
    const { signal } = this.controller;

    const params = new URLSearchParams({
      q: query,
      'resources[type]': 'product,collection,page,article',
      'resources[limit]': '6',
      'resources[limit_scope]': 'each',
      section_id: this.sectionId,
    });

    this.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(`${this.url}?${params.toString()}`, {
        signal,
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      const results = doc.querySelector('[data-predictive-results]');
      const markup = results ? results.outerHTML : '';
      this.cache.set(query, markup);
      if (this.input.value.trim() === query) this.render(markup);
    } catch (error) {
      if (error.name === 'AbortError') return;
      this.close();
    } finally {
      if (!signal.aborted) this.removeAttribute('aria-busy');
    }
  }

  render(markup) {
    if (!markup) {
      this.close();
      return;
    }
    this.panel.innerHTML = markup;
    this.setActive(-1);
    this.open();
    const status = this.panel.querySelector('[data-predictive-status]');
    if (this.live && status) this.live.textContent = status.textContent.trim();
  }
}

if (!customElements.get('predictive-search')) customElements.define('predictive-search', PredictiveSearch);
