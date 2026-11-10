(function () {
  'use strict';

  function formatMoney(cents, format) {
    var value = cents / 100;
    function withDelimiters(number, precision, thousands, decimal) {
      var parts = number.toFixed(precision).split('.');
      var whole = parts[0].replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1' + thousands);
      return parts[1] ? whole + decimal + parts[1] : whole;
    }
    return (format || '${{amount}}').replace(/\{\{\s*(\w+)\s*\}\}/, function (match, key) {
      switch (key) {
        case 'amount_no_decimals': return withDelimiters(value, 0, ',', '.');
        case 'amount_with_comma_separator': return withDelimiters(value, 2, '.', ',');
        case 'amount_no_decimals_with_comma_separator': return withDelimiters(value, 0, '.', ',');
        case 'amount_with_apostrophe_separator': return withDelimiters(value, 2, "'", '.');
        case 'amount_no_decimals_with_space_separator': return withDelimiters(value, 0, ' ', ',');
        case 'amount_with_space_separator': return withDelimiters(value, 2, ' ', ',');
        default: return withDelimiters(value, 2, ',', '.');
      }
    });
  }

  function initProduct(section) {
    var form = section.querySelector('[data-product-form]');
    if (!form) return;

    var variants = JSON.parse(section.querySelector('[data-variants-json]').textContent);
    var strings = JSON.parse(section.querySelector('[data-product-strings]').textContent);
    var idInput = form.querySelector('[data-variant-id]');
    var qtyInput = form.querySelector('[data-quantity]');
    var addButton = form.querySelector('[data-add-button]');
    var addLabel = form.querySelector('[data-add-label]');
    var defaultLabel = addLabel ? addLabel.textContent.trim() : '';
    var stickyBar = section.querySelector('[data-sticky-atc]');
    var stickyButton = section.querySelector('[data-sticky-button]');
    var stickyLabel = stickyButton ? stickyButton.textContent.trim() : '';
    var stickyPrice = section.querySelector('[data-sticky-price]');
    var tiers = Array.prototype.slice.call(form.querySelectorAll('[data-tier]'));
    var money = function (cents) { return formatMoney(cents, strings.moneyFormat); };

    function currentVariant() {
      var id = Number(idInput.value);
      return variants.filter(function (v) { return v.id === id; })[0] || null;
    }

    function selectedTier() {
      return tiers.filter(function (t) { return t.checked; })[0] || null;
    }

    function tierTotal(variant, tier) {
      var qty = Number(tier.dataset.qty);
      var discount = Number(tier.dataset.discount);
      return Math.round(variant.price * qty * (100 - discount) / 100);
    }

    function render() {
      var variant = currentVariant();
      var available = !!(variant && variant.available);

      if (addButton) {
        addButton.disabled = !available;
        addLabel.textContent = !variant ? strings.unavailable : available ? defaultLabel : strings.soldOut;
      }
      if (stickyButton) {
        stickyButton.disabled = !available;
        stickyButton.textContent = !variant ? strings.unavailable : available ? stickyLabel : strings.soldOut;
      }
      if (!variant) return;

      var price = form.querySelector('[data-price]');
      var compare = form.querySelector('[data-compare-price]');
      if (price) price.textContent = money(variant.price);
      if (compare) {
        var onSale = variant.compare_at_price > variant.price;
        compare.hidden = !onSale;
        if (onSale) compare.textContent = money(variant.compare_at_price);
      }

      tiers.forEach(function (tier) {
        var label = form.querySelector('label[for="' + tier.id + '"]');
        var qty = Number(tier.dataset.qty);
        label.querySelector('[data-tier-total]').textContent = money(tierTotal(variant, tier));
        label.querySelector('[data-tier-full]').textContent = money(variant.price * qty);
      });

      var tier = selectedTier();
      qtyInput.value = tier ? tier.dataset.qty : 1;
      if (stickyPrice) stickyPrice.textContent = money(tier ? tierTotal(variant, tier) : variant.price);
    }

    // Variant picker
    var picker = form.querySelector('[data-variant-picker]');
    if (picker) {
      picker.addEventListener('change', function () {
        var chosen = [];
        picker.querySelectorAll('input:checked').forEach(function (input) {
          chosen[Number(input.dataset.optionPosition) - 1] = input.value;
        });
        var match = variants.filter(function (v) {
          return v.options.every(function (value, i) { return value === chosen[i]; });
        })[0];
        idInput.value = match ? match.id : '';
        if (match) {
          var url = new URL(window.location.href);
          url.searchParams.set('variant', match.id);
          window.history.replaceState({}, '', url);
          if (match.featured_media) showMedia(match.featured_media.id);
        }
        render();
      });
    }

    tiers.forEach(function (tier) { tier.addEventListener('change', render); });

    // Gallery
    var slides = section.querySelector('[data-gallery-slides]');
    var thumbs = Array.prototype.slice.call(section.querySelectorAll('[data-thumb]'));

    function goTo(index) {
      if (!slides) return;
      slides.scrollTo({ left: slides.clientWidth * index, behavior: 'smooth' });
    }
    function showMedia(mediaId) {
      if (!slides) return;
      var all = Array.prototype.slice.call(slides.children);
      var index = all.findIndex(function (el) { return el.dataset.mediaId === String(mediaId); });
      if (index > -1) goTo(index);
    }
    thumbs.forEach(function (thumb) {
      thumb.addEventListener('click', function () { goTo(Number(thumb.dataset.thumb)); });
    });
    if (slides && thumbs.length) {
      var ticking = false;
      slides.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(function () {
          var active = Math.round(slides.scrollLeft / slides.clientWidth);
          thumbs.forEach(function (thumb, i) { thumb.classList.toggle('is-active', i === active); });
          ticking = false;
        });
      });
    }

    // Sticky add-to-cart: visible once the main button has scrolled out of view
    if (stickyBar && addButton && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        var entry = entries[0];
        stickyBar.hidden = entry.isIntersecting || entry.boundingClientRect.top > 0;
      }).observe(addButton);
    }

    render();
  }

  // Only one FAQ answer open at a time
  function initFaq(faq) {
    faq.addEventListener('toggle', function (event) {
      if (!event.target.open) return;
      faq.querySelectorAll('details[open]').forEach(function (item) {
        if (item !== event.target) item.open = false;
      });
    }, true);
  }

  function init(root) {
    root.querySelectorAll('[data-product-section]').forEach(initProduct);
    root.querySelectorAll('.faq').forEach(initFaq);
  }

  document.addEventListener('DOMContentLoaded', function () { init(document); });
  document.addEventListener('shopify:section:load', function (event) { init(event.target); });
})();
