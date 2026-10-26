/**
 * <product-gallery> : KINETIC product media gallery behavior.
 *
 * Rendered by snippets/product-media-gallery.liquid. Provides:
 *   - thumbnails layout: shows one media at a time, thumbnail buttons [data-thumb]
 *   - stacked layout: scrolls to and highlights a media
 *   - lightbox (<dialog data-zoom-dialog>) for images with [data-zoom] buttons
 *   - 3D model viewer + "view in your space" setup through Shopify.loadFeatures
 *
 * Public API: gallery.show(mediaId)  (called by <product-form> on variant change)
 */
(() => {
  if (customElements.get('product-gallery')) return;

  class ProductGallery extends HTMLElement {
    connectedCallback() {
      if (this._ready) return;
      this._ready = true;

      this.thumbnails = this.dataset.layout === 'thumbnails';
      this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.dialog = this.querySelector('[data-zoom-dialog]');
      this.zoomIndex = 0;

      if (this.thumbnails) this.classList.add('is-enhanced');

      this.addEventListener('click', (event) => {
        const thumb = event.target.closest('[data-thumb]');
        if (thumb) return this.activate(thumb.dataset.thumb);
        const zoom = event.target.closest('[data-zoom]');
        if (zoom) return this.openZoom(zoom);
      });

      if (this.dialog) {
        this.dialog.addEventListener('click', (event) => {
          if (event.target === this.dialog) this.dialog.close();
          else if (event.target.closest('[data-zoom-close]')) this.dialog.close();
          else if (event.target.closest('[data-zoom-prev]')) this.stepZoom(-1);
          else if (event.target.closest('[data-zoom-next]')) this.stepZoom(1);
        });
        this.dialog.addEventListener('keydown', (event) => {
          if (event.key === 'ArrowLeft') this.stepZoom(-1);
          else if (event.key === 'ArrowRight') this.stepZoom(1);
        });
        this.dialog.addEventListener('close', () => {
          if (this._opener) this._opener.focus();
        });
      }

      this.setupModels();
    }

    items() {
      return [...this.querySelectorAll('[data-media-id]')];
    }

    show(mediaId) {
      if (!mediaId) return;
      if (this.thumbnails) return this.activate(String(mediaId));
      const item = this.querySelector(`[data-media-id="${mediaId}"]`);
      if (!item) return;
      item.scrollIntoView({
        behavior: this.reduceMotion.matches ? 'auto' : 'smooth',
        block: 'nearest',
      });
      item.classList.add('is-highlighted');
      clearTimeout(this._hl);
      this._hl = setTimeout(() => item.classList.remove('is-highlighted'), 1200);
    }

    activate(mediaId) {
      this.items().forEach((item) => {
        const on = item.dataset.mediaId === String(mediaId);
        item.classList.toggle('is-active', on);
        if (!on) this.pause(item);
      });
      this.querySelectorAll('[data-thumb]').forEach((thumb) => {
        const on = thumb.dataset.thumb === String(mediaId);
        thumb.classList.toggle('is-active', on);
        thumb.setAttribute('aria-current', on ? 'true' : 'false');
      });
    }

    pause(item) {
      item.querySelectorAll('video').forEach((video) => video.pause());
      item.querySelectorAll('model-viewer').forEach((viewer) => {
        if (typeof viewer.pause === 'function') viewer.pause();
      });
      item.querySelectorAll('iframe').forEach((frame) => {
        // YouTube and Vimeo both accept postMessage commands when their JS API is enabled.
        try {
          frame.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
            '*'
          );
          frame.contentWindow.postMessage(JSON.stringify({ method: 'pause' }), '*');
        } catch (_) {
          /* cross-origin frame, ignore */
        }
      });
    }

    zoomButtons() {
      return [...this.querySelectorAll('[data-zoom]')];
    }

    openZoom(button) {
      if (!this.dialog || typeof this.dialog.showModal !== 'function') return;
      this._opener = button;
      this.zoomIndex = this.zoomButtons().indexOf(button);
      this.renderZoom();
      this.dialog.showModal();
      const close = this.dialog.querySelector('[data-zoom-close]');
      if (close) close.focus();
    }

    stepZoom(delta) {
      const total = this.zoomButtons().length;
      if (!total) return;
      this.zoomIndex = (this.zoomIndex + delta + total) % total;
      this.renderZoom();
    }

    renderZoom() {
      const button = this.zoomButtons()[this.zoomIndex];
      const img = this.dialog.querySelector('[data-zoom-img]');
      if (!button || !img) return;
      img.removeAttribute('width');
      img.removeAttribute('height');
      img.src = button.dataset.zoomSrc;
      img.alt = button.dataset.zoomAlt || '';
      this._opener = button;
    }

    setupModels() {
      const models = this.querySelectorAll('model-viewer');
      const hasXr = this.querySelector('[data-shopify-xr]');
      if (!models.length && !hasXr) return;
      const S = window.Shopify;
      if (!S || typeof S.loadFeatures !== 'function') return;

      const features = [];
      if (models.length) {
        features.push({
          name: 'model-viewer-ui',
          version: '1.0',
          onLoad: (errors) => {
            if (errors || !S.ModelViewerUI) return;
            models.forEach((viewer) => {
              viewer.modelUI = viewer.modelUI || new S.ModelViewerUI(viewer);
            });
          },
        });
      }
      if (hasXr) {
        features.push({
          name: 'shopify-xr',
          version: '1.0',
          onLoad: (errors) => this.setupXr(errors),
        });
      }
      try {
        S.loadFeatures(features);
      } catch (_) {
        /* 3D features are optional */
      }
    }

    setupXr(errors) {
      if (errors) return;
      if (!window.ShopifyXR) {
        document.addEventListener('shopify_xr_initialized', () => this.setupXr(), { once: true });
        return;
      }
      const data = this.querySelector('[data-xr-models]');
      if (!data) return;
      try {
        window.ShopifyXR.addModels(JSON.parse(data.textContent));
        window.ShopifyXR.setupXRElements();
      } catch (_) {
        /* ignore */
      }
    }
  }

  customElements.define('product-gallery', ProductGallery);
})();
