/**
 * Customer addresses page.
 *  - Fills the province select from the selected country's data-provinces.
 *  - Asks for confirmation before deleting an address.
 */
(() => {
  const setupCountry = (country) => {
    const province = document.getElementById(country.dataset.provinceTarget);
    if (!province) return;
    const field = province.closest('[data-province-field]');

    const selectByText = (select, text) => {
      if (!text) return;
      [...select.options].forEach((option) => {
        if (option.value === text || option.textContent === text) select.value = option.value;
      });
    };

    const update = (initial) => {
      const option = country.options[country.selectedIndex];
      let provinces = [];
      try {
        provinces = JSON.parse((option && option.dataset.provinces) || '[]');
      } catch (e) {
        provinces = [];
      }
      province.innerHTML = '';
      provinces.forEach(([value, label]) => {
        const item = document.createElement('option');
        item.value = value;
        item.textContent = label;
        province.appendChild(item);
      });
      const has = provinces.length > 0;
      if (field) field.hidden = !has;
      province.disabled = !has;
      if (has && initial) selectByText(province, province.dataset.default);
    };

    selectByText(country, country.dataset.default);
    update(true);
    country.addEventListener('change', () => update(false));
  };

  document.querySelectorAll('[data-address-country]').forEach(setupCountry);

  document.addEventListener('submit', (event) => {
    const form = event.target.closest('form[data-confirm]');
    if (form && !window.confirm(form.dataset.confirm)) event.preventDefault();
  });
})();
