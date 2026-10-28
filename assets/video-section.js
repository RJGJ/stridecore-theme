/**
 * <video-embed> click-to-load wrapper for YouTube / Vimeo embeds.
 *
 * The iframe markup is kept inside a <template data-embed> and only inserted
 * after the customer presses the play button, so no third-party request is
 * made until then.
 *
 * Hooks:
 *   [data-play]      the cover button
 *   template[data-embed]  holds the iframe produced by external_video_tag
 */
if (!customElements.get('video-embed')) {
  customElements.define(
    'video-embed',
    class VideoEmbed extends HTMLElement {
      connectedCallback() {
        this.button = this.querySelector('[data-play]');
        this.template = this.querySelector('template[data-embed]');
        if (!this.button) return;
        if (!this.template) {
          this.button.disabled = true;
          return;
        }
        this.button.addEventListener('click', () => this.load());
      }

      load() {
        const content = this.template.content.cloneNode(true);
        const iframe = content.querySelector('iframe');
        this.button.remove();
        this.appendChild(content);
        if (iframe) iframe.focus();
      }
    }
  );
}
