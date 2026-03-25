/**
 * Products Page — main.js (v3.0)
 * =========================================================
 * Cloudflare Pages bundle for /app/products
 * Migrated from Webflow JS embed (Pages_App_Products_JS_v3_0.js)
 *
 * Fetches loan product types from the mtg-broker-api Worker,
 * renders a searchable/filterable A-Z product directory.
 *
 * Features: search, category pills, A-Z alphabet nav,
 * count badge, 2-column card grid, letter group headers,
 * print list button, loading skeletons, empty state.
 *
 * Product cards link to /app/products/{slug}
 * =========================================================
 */

// Import CSS as string and inject into page
// The ?inline suffix tells Vite to give us the CSS text instead of a separate file
import css from './products.css?inline';

// Inject CSS into the page
(function() {
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();

(function () {
  'use strict';

  /* ================================================
     CONFIGURATION
     ================================================ */
  var API_URL = 'https://mtg-broker-api.rich-e00.workers.dev/api/products-list';
  var CACHE_KEY = 'mtg_products_v5';
  var CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  /* ================================================
     STATE
     ================================================ */
  var allProducts = [];
  var activeCategories = [];  // AND logic: product must have ALL of these
  var activeLetter = null;
  var searchTerm = '';

  /* ================================================
     DOM REFERENCES
     ================================================ */
  var mainSection = null;
  var toolbar = null;
  var searchInput = null;
  var clearBtn = null;
  var resetBtn = null;
  var countBadge = null;
  var categoryBar = null;
  var resultsGrid = null;
  var emptyBox = null;
  var loadingEl = null;


  /* ================================================
     INIT — polls for .main-content-section
     (handles Webflow's async script injection)
     ================================================ */
  function tryInit() {
    mainSection = document.querySelector('.main-content-section');
    if (!mainSection) {
      setTimeout(tryInit, 50);
      return;
    }

    hideWebflowElements();
    insertLoadingState();
    loadProducts();
  }

  // Start on DOMContentLoaded or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInit);
  } else {
    tryInit();
  }


  /* ================================================
     HIDE WEBFLOW ELEMENTS
     ================================================ */
  function hideWebflowElements() {
    var els = mainSection.querySelectorAll(
      '.search-form-block, .empty-state-box, .w-form-done, .w-form-fail'
    );
    els.forEach(function (el) { el.style.display = 'none'; });
  }


  /* ================================================
     LOAD PRODUCTS FROM API (with localStorage cache)
     ================================================ */
  async function loadProducts() {
    // --- Try cache first ---
    try {
      var cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        var parsed = JSON.parse(cached);
        if (parsed && parsed.ts && (Date.now() - parsed.ts < CACHE_TTL)) {
          console.log('[Products] Cache hit — ' + parsed.products.length + ' products');
          onProductsLoaded(parsed.products);
          return;
        }
      }
    } catch (e) { /* ignore localStorage errors */ }

    // --- Fetch from API ---
    console.log('[Products] Fetching from API...');
    try {
      var response = await fetch(API_URL, { headers: { 'Content-Type': 'application/json' } });
      if (!response.ok) throw new Error('API returned ' + response.status);
      var data = await response.json();
      var products = data.products || [];

      // Save to localStorage
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), products: products }));
      } catch (e) { /* ignore quota errors */ }

      console.log('[Products] Loaded from API: ' + products.length + ' products');
      onProductsLoaded(products);

    } catch (err) {
      console.error('[Products] Error loading:', err);
      removeLoadingState();
      var errDiv = document.createElement('div');
      errDiv.style.cssText = 'text-align:center;padding:40px 20px;color:#ef4444;font-size:15px;';
      errDiv.textContent = 'Error loading products. Please refresh the page.';
      mainSection.appendChild(errDiv);
    }
  }

  /* Called once we have the products array (from cache or API) */
  function onProductsLoaded(products) {
    allProducts = products.map(function (p) {
      return {
        name: p.name,
        href: p.slug ? '/app/products/' + p.slug : '#',
        tags: p.categoryTags || [],
        sortName: p.sortName || p.name.toLowerCase(),
        firstLetter: p.firstLetter || getFirstLetter(p.sortName || p.name)
      };
    });

    removeLoadingState();
    buildCountBadge();
    buildPrintButton();
    buildToolbar();
    buildCategoryFilters();
    insertResultsContainer();
    renderProducts();

    console.log('[Products] Rendered ' + allProducts.length + ' products');
  }

  /* Derive the first letter (A-Z or #) from a sort name */
  function getFirstLetter(sortName) {
    var first = (sortName || '').charAt(0).toUpperCase();
    return /[A-Z]/.test(first) ? first : '#';
  }


  /* ================================================
     LOADING STATE
     ================================================ */
  function insertLoadingState() {
    loadingEl = document.createElement('div');
    loadingEl.className = 'products-loading';
    var html = '';
    for (var i = 0; i < 12; i++) html += '<div class="skeleton-card"></div>';
    loadingEl.innerHTML = html;

    var header = mainSection.querySelector('.page-header');
    if (header && header.nextSibling) {
      mainSection.insertBefore(loadingEl, header.nextSibling);
    } else {
      mainSection.appendChild(loadingEl);
    }
  }

  function removeLoadingState() {
    if (loadingEl && loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl);
  }


  /* ================================================
     COUNT BADGE
     ================================================ */
  function buildCountBadge() {
    var header = mainSection.querySelector('.page-header');
    if (!header) return;
    countBadge = document.createElement('span');
    countBadge.className = 'products-count-badge';
    countBadge.textContent = allProducts.length + ' products';
    header.appendChild(countBadge);
  }

  function updateCountBadge(count) {
    if (!countBadge) return;
    var total = allProducts.length;
    if (count === total) {
      countBadge.textContent = total + ' products';
      countBadge.classList.remove('is-filtered');
    } else {
      countBadge.textContent = count + ' of ' + total;
      countBadge.classList.add('is-filtered');
    }
  }


  /* ================================================
     PRINT BUTTON
     ================================================ */
  function buildPrintButton() {
    var header = mainSection.querySelector('.page-header');
    if (!header) return;

    var printBtn = document.createElement('button');
    printBtn.type = 'button';
    printBtn.className = 'products-print-btn';
    printBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<polyline points="6 9 6 2 18 2 18 9"></polyline>' +
        '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>' +
        '<rect x="6" y="14" width="12" height="8"></rect>' +
      '</svg>' +
      '<span>Print List</span>';

    printBtn.addEventListener('click', function () {
      handlePrintList();
    });

    header.appendChild(printBtn);
  }

  function handlePrintList() {
    var filtered = getFilteredProducts();
    if (filtered.length === 0) {
      alert('No products to print. Adjust your filters and try again.');
      return;
    }

    var existing = document.querySelector('.products-print-container');
    if (existing) existing.parentNode.removeChild(existing);

    var container = document.createElement('div');
    container.className = 'products-print-container';

    var logoUrl = 'https://cdn.prod.website-files.com/694e4aaf5f511ad7901b74bc/69576dcb21edb9d479222c02_Logo_Horizontal_Blue.png';
    var today = new Date();
    var dateStr = today.toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });

    var headerHtml =
      '<div class="print-header">' +
        '<img src="' + logoUrl + '" alt="MtgBroker">' +
        '<div class="print-header-text">' +
          'Loan Products Directory &mdash; ' + filtered.length + ' products' +
          (isFiltered() ? ' (filtered)' : '') +
        '</div>' +
      '</div>';

    var groups = {};
    filtered.forEach(function (p) {
      if (!groups[p.firstLetter]) groups[p.firstLetter] = [];
      groups[p.firstLetter].push(p);
    });

    var listHtml = '<div class="print-product-list">';
    var sortedLetters = Object.keys(groups).sort();

    sortedLetters.forEach(function (letter) {
      listHtml += '<div class="print-letter-group">';
      listHtml += '<div class="print-letter-heading">' + escapeHtml(letter) + '</div>';
      groups[letter].forEach(function (product) {
        listHtml += '<div class="print-product-name">' + escapeHtml(product.name) + '</div>';
      });
      listHtml += '</div>';
    });
    listHtml += '</div>';

    var footerHtml =
      '<div class="print-footer">' +
        'Generated from mtg.broker on ' + dateStr +
      '</div>';

    container.innerHTML = headerHtml + listHtml + footerHtml;
    document.body.appendChild(container);

    setTimeout(function () {
      window.print();
      setTimeout(function () {
        if (container.parentNode) {
          container.parentNode.removeChild(container);
        }
      }, 1000);
    }, 300);
  }

  function getFilteredProducts() {
    return allProducts.filter(function (p) {
      if (searchTerm && p.sortName.indexOf(searchTerm) === -1) return false;
      if (activeCategories.length > 0) {
        for (var i = 0; i < activeCategories.length; i++) {
          if (p.tags.indexOf(activeCategories[i]) === -1) return false;
        }
      }
      if (activeLetter && p.firstLetter !== activeLetter) return false;
      return true;
    });
  }

  function isFiltered() {
    return searchTerm.length > 0 || activeCategories.length > 0 || activeLetter !== null;
  }


  /* ================================================
     TOOLBAR (Search + Alphabet + Reset)
     ================================================ */
  function buildToolbar() {
    toolbar = document.createElement('div');
    toolbar.className = 'products-toolbar';

    // --- Search input ---
    var inputWrapper = document.createElement('div');
    inputWrapper.className = 'search-input-wrapper';

    searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'products-search-input';
    searchInput.placeholder = 'Search products...';
    searchInput.setAttribute('autocomplete', 'off');
    searchInput.setAttribute('spellcheck', 'false');

    clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'search-clear-btn';
    clearBtn.innerHTML = '\u2715';
    clearBtn.setAttribute('aria-label', 'Clear search');

    inputWrapper.appendChild(searchInput);
    inputWrapper.appendChild(clearBtn);
    toolbar.appendChild(inputWrapper);

    // --- Vertical divider ---
    var divider = document.createElement('div');
    divider.className = 'toolbar-divider';
    toolbar.appendChild(divider);

    // --- Alphabet nav ---
    var alphaNav = document.createElement('div');
    alphaNav.className = 'alpha-nav-inline';

    var lettersWithProducts = {};
    allProducts.forEach(function (p) {
      lettersWithProducts[p.firstLetter] = true;
    });

    // "All" button
    var allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'alpha-nav-letter is-active';
    allBtn.textContent = 'All';
    allBtn.style.width = 'auto';
    allBtn.style.padding = '0 8px';
    allBtn.style.fontSize = '11px';
    allBtn.setAttribute('data-letter', 'all');
    allBtn.addEventListener('click', function () { setActiveLetter(null); });
    alphaNav.appendChild(allBtn);

    // A-Z
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(function (letter) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'alpha-nav-letter';
      btn.textContent = letter;
      btn.setAttribute('data-letter', letter);
      if (!lettersWithProducts[letter]) {
        btn.classList.add('is-disabled');
      } else {
        btn.addEventListener('click', function () { setActiveLetter(letter); });
      }
      alphaNav.appendChild(btn);
    });

    // # for numbers/other
    if (lettersWithProducts['#']) {
      var hashBtn = document.createElement('button');
      hashBtn.type = 'button';
      hashBtn.className = 'alpha-nav-letter';
      hashBtn.textContent = '#';
      hashBtn.setAttribute('data-letter', '#');
      hashBtn.addEventListener('click', function () { setActiveLetter('#'); });
      alphaNav.appendChild(hashBtn);
    }

    toolbar.appendChild(alphaNav);

    // --- Reset button ---
    resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'products-reset-btn';
    resetBtn.innerHTML = '<i class="fa-solid fa-rotate-left" style="font-size:11px;"></i> Reset';
    toolbar.appendChild(resetBtn);

    // Insert toolbar after page header
    var header = mainSection.querySelector('.page-header');
    if (header && header.nextSibling) {
      mainSection.insertBefore(toolbar, header.nextSibling);
    } else {
      mainSection.appendChild(toolbar);
    }

    // --- EVENTS ---
    searchInput.addEventListener('input', function () {
      searchTerm = searchInput.value.trim().toLowerCase();
      clearBtn.classList.toggle('is-visible', searchTerm.length > 0);
      updateResetVisibility();
      renderProducts();
    });

    clearBtn.addEventListener('click', function () {
      searchInput.value = '';
      searchTerm = '';
      clearBtn.classList.remove('is-visible');
      searchInput.focus();
      updateResetVisibility();
      renderProducts();
    });

    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        searchInput.value = '';
        searchTerm = '';
        clearBtn.classList.remove('is-visible');
        updateResetVisibility();
        renderProducts();
      }
    });

    resetBtn.addEventListener('click', function () {
      resetAllFilters();
    });
  }

  function setActiveLetter(letter) {
    activeLetter = letter;
    updateAlphaNavState();
    updateResetVisibility();
    renderProducts();
    if (resultsGrid) {
      resultsGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function updateAlphaNavState() {
    if (!toolbar) return;
    toolbar.querySelectorAll('.alpha-nav-letter').forEach(function (btn) {
      var l = btn.getAttribute('data-letter');
      btn.classList.toggle('is-active',
        (activeLetter === null && l === 'all') || l === activeLetter
      );
    });
  }

  function updateResetVisibility() {
    if (!resetBtn) return;
    var active = searchTerm.length > 0 ||
                 activeCategories.length > 0 ||
                 activeLetter !== null;
    resetBtn.classList.toggle('is-visible', active);
  }


  /* ================================================
     CATEGORY FILTER PILLS (AND LOGIC)
     ================================================ */
  function buildCategoryFilters() {
    var tagCounts = {};
    allProducts.forEach(function (p) {
      p.tags.forEach(function (tag) {
        if (!tagCounts[tag]) tagCounts[tag] = 0;
        tagCounts[tag]++;
      });
    });

    var tagNames = Object.keys(tagCounts).sort();
    if (tagNames.length === 0) return;

    categoryBar = document.createElement('div');
    categoryBar.className = 'category-filter-bar';

    // "All" pill
    var allPill = createPill('All', allProducts.length);
    allPill.classList.add('is-all', 'is-active');
    allPill.addEventListener('click', function () {
      activeCategories = [];
      updateCategoryPillStates();
      updateResetVisibility();
      renderProducts();
    });
    categoryBar.appendChild(allPill);

    tagNames.forEach(function (tag) {
      var pill = createPill(tag, tagCounts[tag]);
      pill.setAttribute('data-category', tag);
      pill.addEventListener('click', function () { toggleCategory(tag); });
      categoryBar.appendChild(pill);
    });

    if (toolbar && toolbar.nextSibling) {
      mainSection.insertBefore(categoryBar, toolbar.nextSibling);
    } else {
      mainSection.appendChild(categoryBar);
    }
  }

  function createPill(label, count) {
    var pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'category-pill';
    pill.innerHTML = escapeHtml(label) +
      ' <span class="category-pill-count">' + count + '</span>';
    return pill;
  }

  function toggleCategory(tag) {
    var idx = activeCategories.indexOf(tag);
    if (idx === -1) {
      activeCategories.push(tag);
    } else {
      activeCategories.splice(idx, 1);
    }
    updateCategoryPillStates();
    updateResetVisibility();
    activeLetter = null;
    updateAlphaNavState();
    renderProducts();
  }

  function updateCategoryPillStates() {
    if (!categoryBar) return;
    categoryBar.querySelectorAll('.category-pill').forEach(function (pill) {
      if (pill.classList.contains('is-all')) {
        pill.classList.toggle('is-active', activeCategories.length === 0);
      } else {
        var cat = pill.getAttribute('data-category');
        pill.classList.toggle('is-active', activeCategories.indexOf(cat) !== -1);
      }
    });
  }


  /* ================================================
     RESULTS CONTAINER + EMPTY STATE
     ================================================ */
  function insertResultsContainer() {
    resultsGrid = document.createElement('div');
    resultsGrid.className = 'products-results-grid';

    emptyBox = document.createElement('div');
    emptyBox.className = 'products-empty-state';
    emptyBox.style.display = 'none';
    emptyBox.innerHTML =
      '<div class="empty-state-icon">&#128269;</div>' +
      '<div class="empty-title">No products found</div>' +
      '<div class="empty-sub">Try a different search or adjust your filters</div>' +
      '<span class="empty-reset-link" id="products-reset-all">Reset all filters</span>';

    var insertAfter = categoryBar || toolbar;
    if (insertAfter && insertAfter.nextSibling) {
      mainSection.insertBefore(emptyBox, insertAfter.nextSibling);
      mainSection.insertBefore(resultsGrid, emptyBox);
    } else {
      mainSection.appendChild(resultsGrid);
      mainSection.appendChild(emptyBox);
    }

    document.getElementById('products-reset-all').addEventListener('click', function () {
      resetAllFilters();
    });
  }


  /* ================================================
     RENDER PRODUCTS
     ================================================ */
  function renderProducts() {
    if (!resultsGrid) return;

    var filtered = allProducts.filter(function (p) {
      if (searchTerm && p.sortName.indexOf(searchTerm) === -1) return false;
      if (activeCategories.length > 0) {
        for (var i = 0; i < activeCategories.length; i++) {
          if (p.tags.indexOf(activeCategories[i]) === -1) return false;
        }
      }
      if (activeLetter && p.firstLetter !== activeLetter) return false;
      return true;
    });

    updateCountBadge(filtered.length);

    if (filtered.length === 0) {
      resultsGrid.style.display = 'none';
      emptyBox.style.display = 'block';
      return;
    }

    resultsGrid.style.display = 'grid';
    emptyBox.style.display = 'none';

    var html = '';
    var currentLetter = '';

    filtered.forEach(function (product) {
      if (product.firstLetter !== currentLetter) {
        currentLetter = product.firstLetter;
        html +=
          '<div class="letter-group-header" id="letter-' + escapeAttr(currentLetter) + '">' +
            '<span class="letter-group-label">' + escapeHtml(currentLetter) + '</span>' +
            '<span class="letter-group-line"></span>' +
          '</div>';
      }

      html += buildCardHtml(product);
    });

    resultsGrid.innerHTML = html;
  }


  /* ================================================
     BUILD CARD
     ================================================ */
  function buildCardHtml(product) {
    var displayName = escapeHtml(product.name);
    if (searchTerm) {
      var escapedTerm = escapeHtml(searchTerm);
      var regex = new RegExp(
        '(' + escapedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')',
        'gi'
      );
      displayName = displayName.replace(
        regex,
        '<mark style="background:#fef08a;color:#0f172a;padding:0 1px;border-radius:2px;">$1</mark>'
      );
    }

    return (
      '<a href="' + escapeAttr(product.href) + '" class="product-card">' +
        '<span class="product-card-name">' + displayName + '</span>' +
      '</a>'
    );
  }


  /* ================================================
     RESET ALL FILTERS
     ================================================ */
  function resetAllFilters() {
    if (searchInput) {
      searchInput.value = '';
      searchTerm = '';
      if (clearBtn) clearBtn.classList.remove('is-visible');
    }
    activeCategories = [];
    updateCategoryPillStates();
    activeLetter = null;
    updateAlphaNavState();
    updateResetVisibility();
    renderProducts();
  }


  /* ================================================
     UTILITIES
     ================================================ */
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
              .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;');
  }

})();
