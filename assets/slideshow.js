/**
 * <slide-show> accessible scroll-snap carousel.
 *
 * Hooks:
 *   [data-track]   scroll container
 *   [data-slide]   each slide
 *   [data-prev] [data-next]   arrow buttons
 *   [data-dot]     pagination buttons (aria-current marks the active one)
 *   [data-toggle]  pause/play button (only present when autoplay is enabled)
 *   data-autoplay="true|false", data-speed (ms), data-pause-label, data-play-label
 *
 * Autoplay never starts when prefers-reduced-motion is set, and pauses while
 * the pointer is over the slideshow or focus is inside it.
 */
if (!customElements.get('slide-show')) {
  customElements.define(
    'slide-show',
    class SlideShow extends HTMLElement {
      connectedCallback() {
        this.track = this.querySelector('[data-track]');
        this.slides = Array.from(this.querySelectorAll('[data-slide]'));
        this.dots = Array.from(this.querySelectorAll('[data-dot]'));
        this.toggle = this.querySelector('[data-toggle]');
        this.reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.current = 0;
        this.userPaused = false;
        this.hovering = false;
        this.timer = null;
        if (!this.track || this.slides.length === 0) return;

        const prev = this.querySelector('[data-prev]');
        const next = this.querySelector('[data-next]');
        if (prev) prev.addEventListener('click', () => this.go(this.current - 1));
        if (next) next.addEventListener('click', () => this.go(this.current + 1));
        this.dots.forEach((dot, index) => dot.addEventListener('click', () => this.go(index)));
        if (this.toggle) {
          this.toggle.addEventListener('click', () => {
            this.userPaused = !this.userPaused;
            this.sync();
          });
        }

        this.track.addEventListener('scroll', () => this.onScroll(), { passive: true });
        this.addEventListener('mouseenter', () => { this.hovering = true; this.sync(); });
        this.addEventListener('mouseleave', () => { this.hovering = false; this.sync(); });
        this.addEventListener('focusin', () => { this.hovering = true; this.sync(); });
        this.addEventListener('focusout', () => { this.hovering = false; this.sync(); });
        this.reduce.addEventListener('change', () => this.sync());
        this.update(0);
        this.sync();
      }

      disconnectedCallback() {
        this.stop();
      }

      get autoplayAllowed() {
        return this.dataset.autoplay === 'true' && !this.reduce.matches && this.slides.length > 1;
      }

      go(index) {
        const total = this.slides.length;
        const target = (index + total) % total;
        const slide = this.slides[target];
        this.track.scrollTo({
          left: slide.offsetLeft - this.track.offsetLeft,
          behavior: this.reduce.matches ? 'auto' : 'smooth'
        });
        this.update(target);
      }

      onScroll() {
        const width = this.track.clientWidth || 1;
        this.update(Math.round(this.track.scrollLeft / width));
      }

      update(index) {
        if (index < 0 || index >= this.slides.length) return;
        this.current = index;
        this.slides.forEach((slide, i) => {
          const active = i === index;
          if (active) slide.removeAttribute('inert');
          else slide.setAttribute('inert', '');
        });
        this.dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === index)));
      }

      sync() {
        const running = this.autoplayAllowed && !this.userPaused && !this.hovering;
        this.track.setAttribute('aria-live', running ? 'off' : 'polite');
        if (this.toggle) {
          this.toggle.hidden = !this.autoplayAllowed;
          this.toggle.setAttribute('aria-pressed', String(this.userPaused));
          this.toggle.setAttribute(
            'aria-label',
            this.userPaused ? this.dataset.playLabel : this.dataset.pauseLabel
          );
        }
        if (running) this.start();
        else this.stop();
      }

      start() {
        if (this.timer) return;
        const speed = parseInt(this.dataset.speed, 10) || 5000;
        this.timer = window.setInterval(() => this.go(this.current + 1), speed);
      }

      stop() {
        if (this.timer) window.clearInterval(this.timer);
        this.timer = null;
      }
    }
  );
}
