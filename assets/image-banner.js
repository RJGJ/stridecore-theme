/**
 * <banner-video> background video with a pause/play control.
 *
 * Hooks:
 *   video                 the Shopify-hosted <video> inside the element
 *   [data-toggle]         pause/play button; aria-pressed="true" means paused
 *   data-pause-label      accessible name while playing
 *   data-play-label       accessible name while paused
 *
 * Respects prefers-reduced-motion by pausing the video on load.
 */
if (!customElements.get('banner-video')) {
  customElements.define(
    'banner-video',
    class BannerVideo extends HTMLElement {
      connectedCallback() {
        this.video = this.querySelector('video');
        this.button = this.querySelector('[data-toggle]');
        if (!this.video || !this.button) return;

        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (reduce.matches) this.setPaused(true);

        this.button.addEventListener('click', () => this.setPaused(!this.video.paused));
      }

      setPaused(paused) {
        if (paused) {
          this.video.pause();
        } else {
          const result = this.video.play();
          if (result && typeof result.catch === 'function') result.catch(() => {});
        }
        this.button.setAttribute('aria-pressed', String(paused));
        this.button.setAttribute(
          'aria-label',
          paused ? this.dataset.playLabel : this.dataset.pauseLabel
        );
      }
    }
  );
}
