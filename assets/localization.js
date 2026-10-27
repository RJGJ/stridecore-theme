/**
 * <localization-form> : disclosure for the country / language selectors.
 *
 * Markup contract (see snippets/localization-selector.liquid):
 *   <localization-form>
 *     <form> ... <button data-localization-button aria-expanded aria-controls>
 *                <ul data-localization-panel> <li><button type="submit" name="country_code" value="US"> ...
 *
 * Every option is a real submit button, so the form works without JavaScript
 * (the list is simply always visible then). With JS the list collapses into a
 * disclosure: click/Enter/Space or ArrowDown opens it, ArrowUp/Down/Home/End move
 * between options, Escape closes and returns focus to the button, and focus
 * leaving the component closes it.
 */
if (!customElements.get('localization-form')) {
class LocalizationForm extends HTMLElement {
  connectedCallback() {
    this.button = this.querySelector('[data-localization-button]');
    this.panel = this.querySelector('[data-localization-panel]');
    if (!this.button || !this.panel) return;

    this.panel.hidden = true;

    this.onButtonClick = () => (this.isOpen() ? this.close() : this.open());
    this.onButtonKeydown = (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.open(0);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.open(-1);
      }
    };
    this.onPanelKeydown = (event) => {
      const options = this.options();
      const index = options.indexOf(document.activeElement);
      let next = -2;
      if (event.key === 'ArrowDown') next = Math.min(index + 1, options.length - 1);
      else if (event.key === 'ArrowUp') next = Math.max(index - 1, 0);
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = options.length - 1;
      if (next === -2) return;
      event.preventDefault();
      if (options[next]) options[next].focus();
    };
    this.onKeydown = (event) => {
      if (event.key !== 'Escape' || !this.isOpen()) return;
      event.stopPropagation();
      this.close();
      this.button.focus();
    };
    this.onFocusOut = (event) => {
      if (event.relatedTarget && !this.contains(event.relatedTarget)) this.close();
    };
    this.onDocClick = (event) => {
      if (!this.contains(event.target)) this.close();
    };

    this.button.addEventListener('click', this.onButtonClick);
    this.button.addEventListener('keydown', this.onButtonKeydown);
    this.panel.addEventListener('keydown', this.onPanelKeydown);
    this.addEventListener('keydown', this.onKeydown);
    this.addEventListener('focusout', this.onFocusOut);
    document.addEventListener('click', this.onDocClick);
  }

  disconnectedCallback() {
    document.removeEventListener('click', this.onDocClick);
  }

  options() {
    return Array.from(this.panel.querySelectorAll('button'));
  }

  isOpen() {
    return !this.panel.hidden;
  }

  open(focusIndex) {
    this.panel.hidden = false;
    this.button.setAttribute('aria-expanded', 'true');
    if (focusIndex === undefined) return;
    const options = this.options();
    const target = focusIndex < 0 ? options[options.length - 1] : options[focusIndex];
    if (target) target.focus();
  }

  close() {
    this.panel.hidden = true;
    this.button.setAttribute('aria-expanded', 'false');
  }
}

  customElements.define('localization-form', LocalizationForm);
}
