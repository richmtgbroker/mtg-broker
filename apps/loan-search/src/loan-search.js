// ============================================================
// Loan Search v8.0 — Cloudflare Pages Bundle
// Extracted from Worker v1.7 (loan-search.js v7.7)
// All features retained: categories, filters, sort, pagination,
// NEXA gating, lender logos, columns panel, product detail modal.
// ============================================================

export function initLoanSearch() {
  console.log('Initializing Loan Search v8.0...');

  // ---------------------------
  // Config
  // ---------------------------
  const API_BASE = 'https://mtg-broker-api.rich-e00.workers.dev';
  const API_ENDPOINT = API_BASE + '/api/loan-products';

  const PAGE_SIZE_DEFAULT = 50;

  // Numeric "threshold" filter keys (case-insensitive check)
  const NUMERIC_THRESHOLD_PATTERNS = ['min_fico', 'min fico', 'minfico'];
  function isNumericThresholdKey(key) {
    const k = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
    return NUMERIC_THRESHOLD_PATTERNS.some(p => k === p.replace(/[^a-z0-9]/g, ''));
  }

  // Range filter configs
  const RANGE_FILTER_CONFIGS = {
    'loan_amount': {
      label: 'Loan Amount',
      minField: 'min_loan_amount',
      maxField: 'max_loan_amount',
      placeholder: 'e.g. 350000',
      groupName: null,
      groupNameFallback: 'Loan Info',
      groupOrder: null,
      groupOrderFallback: 1,
      fieldOrder: null,
      fieldOrderFallback: 6
    }
  };

  function isRangeSubField(key) {
    const k = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
    return Object.values(RANGE_FILTER_CONFIGS).some(cfg => {
      const minK = String(cfg.minField).toLowerCase().replace(/[^a-z0-9]/g, '');
      const maxK = String(cfg.maxField).toLowerCase().replace(/[^a-z0-9]/g, '');
      return k === minK || k === maxK;
    });
  }

  // Fields that should NOT appear as filter controls
  const NON_FILTERABLE_PATTERNS = new Set([
    'matrix',
    'lenderproductnameversionfinal',
  ]);

  function isNonFilterable(key) {
    const k = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
    return NON_FILTERABLE_PATTERNS.has(k);
  }

  // ============================================================
  // CATEGORY CONFIGURATION
  // ============================================================
  const CATEGORY_CONFIG = [
    { id: 'all',         label: 'All Loans',                 filterValues: null, columnGroups: [] },
    { id: '1099',        label: '1099',                      filterValues: ['1099 Only'], columnGroups: [] },
    { id: 'asset-dep',   label: 'Asset Depletion',           filterValues: ['Asset Depletion | Utilization'], columnGroups: [] },
    { id: 'bank-stmt',   label: 'Bank Statement',            filterValues: ['Bank Statements Loans'], columnGroups: ['Bank Statements'] },
    { id: 'blanket',     label: 'Blanket (Portfolio)',        filterValues: ['Blanket (Portfolio)'], columnGroups: [] },
    { id: 'bridge',      label: 'Bridge Loan',               filterValues: ['Bridge Loan'], columnGroups: [] },
    { id: 'dpa',         label: 'DPA',                       filterValues: ['Down Payment Assistance (DPA)', 'Down  Payment Assistance (DPA)'], columnGroups: ['Down Payment Assistance (DPA)'] },
    { id: 'dscr',        label: 'DSCR',                      filterValues: ['Debt Service Coverage Ratio (DSCR)'], columnGroups: ['DSCR'] },
    { id: 'fha',         label: 'FHA',                       filterValues: ['FHA', 'FHA 203(b) / 203b', 'FHA 203(h)', 'FHA 203(k) / 203k Renovation', 'FHA EZ E-Z'], columnGroups: [] },
    { id: 'fnf',         label: 'Fix N Flip',                filterValues: ['Fix N Flip (FNF)'], columnGroups: ['Fix N Flip'] },
    { id: 'guc',         label: 'GUC',                       filterValues: ['Ground Up Construction (GUC)'], columnGroups: [] },
    { id: 'heloan',      label: 'HELOAN | 2NDS',              filterValues: ['HELOAN', '2nd Mortgage (Non-QM)', '2nd CES Mortgage (Standalone)'], columnGroups: [] },
    { id: 'heloan-group',label: 'HELOAN | HELOC | 2NDS',     filterValues: ['HELOAN', 'HELOC (Standalone)', '2nd Mortgage (Non-QM)', '2nd CES Mortgage (Standalone)'], columnGroups: ['HELOC'] },
    { id: 'heloc',       label: 'HELOC',                     filterValues: ['HELOC (Standalone)'], columnGroups: ['HELOC'] },
    { id: 'jumbo',       label: 'Jumbo',                     filterValues: ['Jumbo', 'Jumbo (Non-QM)'], columnGroups: [] },
    { id: 'otc',         label: 'OTC',                       filterValues: ['One-Time Close (OTC) - Conv', 'One-Time Close (OTC) - FHA', 'One-Time Close (OTC) - VA'], columnGroups: [] },
    { id: 'p-and-l',     label: 'P&L',                       filterValues: ['P&L', 'P&L (Profit and Loss) Statement'], columnGroups: ['Profit & Loss (P&L)'] },
    { id: 'usda',        label: 'USDA',                      filterValues: ['USDA', 'USDA | RD (Guaranteed)'], columnGroups: [] },
    { id: 'va',          label: 'VA',                        filterValues: ['VA'], columnGroups: [] },
  ];

  const FEATURED_CATEGORIES = [
    'all', 'bank-stmt', 'dpa', 'dscr', 'fnf', 'heloan-group',
  ];

  const CATEGORY_FIELD_PATTERN = 'Loan Product';

  function resolveFieldKey(pattern) {
    const normalized = String(pattern).toLowerCase().replace(/[^a-z0-9]/g, '');
    // Exact match
    if (allFields.includes(pattern)) return pattern;
    // Normalized key match
    for (const key of allFields) {
      const keyNorm = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (keyNorm === normalized) return key;
    }
    for (const key of Object.keys(fieldMetadata)) {
      const keyNorm = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (keyNorm === normalized) return key;
    }
    // Match by fieldMetadata label (handles Airtable field IDs like fldXXX)
    for (const key of Object.keys(fieldMetadata)) {
      const label = (fieldMetadata[key]?.label || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (label === normalized) return key;
    }
    return null;
  }

  // ---------------------------
  // DOM helpers
  // ---------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const escapeHtml = (s) => {
    const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
    return String(s ?? '').replace(/[&<>"']/g, m => map[m]);
  };

  // ---------------------------
  // State
  // ---------------------------
  let rawData = [];
  let filteredData = [];
  let allFields = [];
  let fieldMetadata = {};
  let coreColumns = [];
  let visibleColumns = [];
  let lenderLogos = {};
  let lenderFieldKey = null;

  let activeCategory = 'all';
  let categoryFieldKey = null;

  let currentPage = 1;
  let pageSize = PAGE_SIZE_DEFAULT;

  let sortState = { key: null, dir: 'asc' };

  // Debounce utility
  let _debounceTimers = {};
  function debounce(id, fn, delay) {
    clearTimeout(_debounceTimers[id]);
    _debounceTimers[id] = setTimeout(fn, delay);
  }

  let filterState = { single: {}, multi: {}, numeric: {}, range: {} };

  // ---------------------------
  // Data utilities
  // ---------------------------
  function normalizeCellValue(val) {
    if (val === null || val === undefined) return '';
    if (Array.isArray(val)) return val.map(v => String(v).trim()).filter(Boolean);
    const s = String(val).trim();
    if (s.includes('|')) {
      return s.split('|').map(x => x.trim()).filter(Boolean);
    }
    return s;
  }

  function parseNumber(val) {
    if (val === null || val === undefined) return NaN;
    if (typeof val === 'number') return val;
    const s = String(val).replace(/[^0-9.\-]/g, '');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function smartSort(a, b) {
    const aStr = String(a);
    const bStr = String(b);
    const aNum = parseFloat(aStr.replace(/[$,%\s]/g, ''));
    const bNum = parseFloat(bStr.replace(/[$,%\s]/g, ''));
    if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
      return aNum - bNum;
    }
    return aStr.localeCompare(bStr, undefined, { sensitivity: 'base' });
  }

  function buildUniqueOptions(key) {
    const set = new Set();
    rawData.forEach(item => {
      const v = normalizeCellValue(item[key]);
      if (Array.isArray(v)) v.forEach(x => x && set.add(x));
      else if (v) set.add(v);
    });
    const arr = Array.from(set);
    arr.sort(smartSort);
    return arr;
  }

  function fieldHasMultiValues(key) {
    const sampleSize = Math.min(rawData.length, 50);
    for (let i = 0; i < sampleSize; i++) {
      const raw = rawData[i][key];
      if (Array.isArray(raw) && raw.length > 1) return true;
      if (typeof raw === 'string' && raw.includes('|')) return true;
    }
    return false;
  }

  // ============================================================
  // CATEGORY BAR
  // ============================================================
  function getCategoryCounts() {
    const counts = {};
    CATEGORY_CONFIG.forEach(cat => {
      if (!cat.filterValues) {
        counts[cat.id] = rawData.length;
        return;
      }
      counts[cat.id] = rawData.filter(item => {
        const val = String(item[categoryFieldKey] || '').toLowerCase();
        return cat.filterValues.some(fv => val === fv.toLowerCase());
      }).length;
    });
    return counts;
  }

  function getCategoryColumns(catId) {
    const cat = CATEGORY_CONFIG.find(c => c.id === catId);
    if (!cat || !cat.columnGroups || !cat.columnGroups.length) {
      return coreColumns.slice();
    }
    const extraCols = allFields.filter(k => {
      const meta = fieldMetadata[k];
      if (!meta || !meta.groupName) return false;
      if (coreColumns.includes(k)) return false;
      return cat.columnGroups.includes(meta.groupName);
    });
    extraCols.sort((a, b) => {
      const aOrder = fieldMetadata[a]?.fieldOrder || 99;
      const bOrder = fieldMetadata[b]?.fieldOrder || 99;
      return aOrder - bOrder;
    });
    return [...coreColumns, ...extraCols];
  }

  function renderCategoryBar() {
    const scroll = document.querySelector('.category-scroll');
    if (!scroll) {
      console.warn('Category bar container .category-scroll not found');
      return;
    }
    scroll.innerHTML = '';

    const counts = getCategoryCounts();
    const featuredCats = [];
    const overflowCats = [];

    CATEGORY_CONFIG.forEach(cat => {
      const count = counts[cat.id] || 0;
      if (count === 0 && cat.id !== 'all') return;
      if (FEATURED_CATEGORIES.includes(cat.id)) {
        featuredCats.push({ ...cat, count });
      } else {
        overflowCats.push({ ...cat, count });
      }
    });

    featuredCats.sort((a, b) =>
      FEATURED_CATEGORIES.indexOf(a.id) - FEATURED_CATEGORIES.indexOf(b.id)
    );
    overflowCats.sort((a, b) => a.label.localeCompare(b.label));

    // Render featured pills
    featuredCats.forEach(cat => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'category-pill-btn' + (cat.id === activeCategory ? ' active' : '');
      pill.dataset.category = cat.id;

      const labelSpan = document.createElement('span');
      labelSpan.textContent = cat.label;
      pill.appendChild(labelSpan);

      const countSpan = document.createElement('span');
      countSpan.className = 'cat-count';
      countSpan.textContent = '(' + cat.count + ')';
      pill.appendChild(countSpan);

      pill.addEventListener('click', () => {
        closeMoreDropdown();
        setCategory(cat.id);
      });
      scroll.appendChild(pill);
    });

    // "More" trigger + dropdown
    if (overflowCats.length > 0) {
      const moreWrapper = document.createElement('div');
      moreWrapper.style.position = 'relative';
      moreWrapper.style.display = 'inline-flex';

      const activeInOverflow = overflowCats.some(c => c.id === activeCategory);
      const activeOverflowLabel = activeInOverflow
        ? overflowCats.find(c => c.id === activeCategory).label
        : null;

      const moreTrigger = document.createElement('button');
      moreTrigger.type = 'button';
      moreTrigger.className = 'category-more-trigger' + (activeInOverflow ? ' has-active' : '');
      moreTrigger.id = 'category-more-trigger';

      const triggerLabel = document.createElement('span');
      triggerLabel.textContent = activeInOverflow ? activeOverflowLabel : 'More';
      moreTrigger.appendChild(triggerLabel);

      const triggerArrow = document.createElement('span');
      triggerArrow.textContent = '\u25BE';
      triggerArrow.style.fontSize = '10px';
      moreTrigger.appendChild(triggerArrow);

      const dropdown = document.createElement('div');
      dropdown.className = 'category-more-dropdown';
      dropdown.id = 'category-more-dropdown';

      overflowCats.forEach(cat => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'category-dd-item' + (cat.id === activeCategory ? ' active' : '');
        item.dataset.category = cat.id;

        const itemLabel = document.createElement('span');
        itemLabel.textContent = cat.label;
        item.appendChild(itemLabel);

        const itemCount = document.createElement('span');
        itemCount.className = 'cat-count';
        itemCount.textContent = '(' + cat.count + ')';
        item.appendChild(itemCount);

        item.addEventListener('click', (e) => {
          e.stopPropagation();
          closeMoreDropdown();
          setCategory(cat.id);
        });

        dropdown.appendChild(item);
      });

      moreTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains('open');
        closeMoreDropdown();
        if (!isOpen) {
          dropdown.classList.add('open');
        }
      });

      moreWrapper.appendChild(moreTrigger);
      moreWrapper.appendChild(dropdown);
      scroll.appendChild(moreWrapper);

      document.removeEventListener('click', closeMoreDropdown);
      document.addEventListener('click', closeMoreDropdown);
    }
  }

  function closeMoreDropdown() {
    const dd = document.getElementById('category-more-dropdown');
    if (dd) dd.classList.remove('open');
  }

  function setCategory(catId) {
    activeCategory = catId;
    renderCategoryBar();
    visibleColumns = coreColumns.slice();
    buildHeader();
    if (typeof _rebuildColumnsMenu === 'function') _rebuildColumnsMenu();
    applyFilters();
  }

  // ---------------------------
  // Fetch data
  // ---------------------------
  async function fetchData() {
    console.log('Fetching data from API...');
    const res = await fetch(API_ENDPOINT, { credentials: 'include' });
    if (!res.ok) throw new Error('API error: ' + res.status);
    const json = await res.json();
    console.log('API Response:', json);

    rawData = json.products || json.data || [];

    // NEXA PRODUCT GATING
    const isNexaUser = document.body.classList.contains('nexa-user');
    if (!isNexaUser) {
      const tempMeta = json.fieldMetadata || json.meta || {};
      const tempAllFields = json.allFields || Object.keys(rawData[0] || {});
      let nexaLenderKey = null;
      for (const k of tempAllFields) {
        const label = (tempMeta[k]?.label || '').toLowerCase();
        if (label === 'lender') { nexaLenderKey = k; break; }
      }
      if (!nexaLenderKey) {
        for (const k of tempAllFields) {
          if (k.toLowerCase() === 'lender') { nexaLenderKey = k; break; }
        }
      }

      console.log('NEXA gating: lender field key resolved to:', nexaLenderKey);

      if (nexaLenderKey) {
        const beforeCount = rawData.length;
        rawData = rawData.filter(item => {
          const lenderVal = String(item[nexaLenderKey] || '').toLowerCase();
          return !lenderVal.includes('nexa');
        });
        const removed = beforeCount - rawData.length;
        if (removed > 0) console.log('NEXA gating: filtered out ' + removed + ' NEXA-only products');
      } else {
        console.warn('NEXA gating: could not resolve lender field key — scanning all fields');
        const beforeCount = rawData.length;
        rawData = rawData.filter(item => {
          for (const val of Object.values(item)) {
            if (typeof val === 'string' && val.toLowerCase().includes('nexa') && val.toLowerCase().includes('lending')) {
              return false;
            }
          }
          return true;
        });
        const removed = beforeCount - rawData.length;
        if (removed > 0) console.log('NEXA gating (fallback): filtered out ' + removed + ' NEXA-only products');
      }
    } else {
      console.log('NEXA gating: user IS NEXA — showing all products including NEXA');
    }

    fieldMetadata = json.fieldMetadata || json.meta || {};
    allFields = json.allFields || Object.keys(rawData[0] || {});
    coreColumns = json.coreColumns || [
      'lender','loan_product','lender_product_name','min_fico',
      'min_loan_amount','max_loan_amount','max_ltv','matrix_url'
    ];

    // Remove Purpose and Occupancy from default visible columns
    const HIDDEN_FROM_DEFAULTS = ['purpose', 'occupancy'];
    coreColumns = coreColumns.filter(k => {
      const label = (fieldMetadata[k]?.label || k).toLowerCase().replace(/[^a-z]/g, '');
      return !HIDDEN_FROM_DEFAULTS.includes(label);
    });

    visibleColumns = json.visibleColumns
      ? json.visibleColumns.filter(k => {
          const label = (fieldMetadata[k]?.label || k).toLowerCase().replace(/[^a-z]/g, '');
          return !HIDDEN_FROM_DEFAULTS.includes(label);
        })
      : coreColumns.slice(0, 8);

    console.log('Loaded', rawData.length, 'products with', allFields.length, 'fields');

    filteredData = rawData.slice();

    categoryFieldKey = resolveFieldKey(CATEGORY_FIELD_PATTERN);
    if (!categoryFieldKey) {
      categoryFieldKey = resolveFieldKey('loan_product') || resolveFieldKey('Loan Product');
    }
    console.log('Category field resolved to:', categoryFieldKey);

    lenderLogos = json.lenderLogos || {};
    console.log('Lender logos loaded:', Object.keys(lenderLogos).length);

    lenderFieldKey = allFields.find(k => {
      const label = (fieldMetadata[k]?.label || '').toLowerCase();
      return label === 'lender';
    }) || null;
  }

  // ---------------------------
  // Build header + table
  // ---------------------------
  function buildHeader() {
    const header = $('.loan-table-header');
    if (!header) return;
    header.innerHTML = '';

    header.style.gridTemplateColumns = visibleColumns.map(() => 'minmax(140px, 1fr)').join(' ');

    visibleColumns.forEach(col => {
      const cell = document.createElement('div');
      cell.className = 'loan-table-header-cell';
      cell.dataset.key = col;

      const rawLabel = fieldMetadata[col]?.label || col.replace(/_/g, ' ').toUpperCase();

      const isExtraCol = !coreColumns.includes(col);
      const dashIdx = rawLabel.indexOf(' - ');

      let labelHtml;
      if (isExtraCol && dashIdx > 0 && dashIdx <= 12) {
        const prefix = rawLabel.substring(0, dashIdx).trim();
        const fieldName = rawLabel.substring(dashIdx + 3).trim();
        labelHtml = '<div class="col-label-wrap">' +
                    '<span class="col-prefix">' + escapeHtml(prefix) + '</span>' +
                    '<span>' + escapeHtml(fieldName) + '</span>' +
                    '</div>';
      } else {
        labelHtml = '<span>' + escapeHtml(rawLabel) + '</span>';
      }

      cell.innerHTML = labelHtml + '<span class="sort-icon">\u2195</span>';

      cell.addEventListener('click', () => {
        if (sortState.key === col) {
          sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
        } else {
          sortState.key = col;
          sortState.dir = 'asc';
        }
        applySort();
        renderTable();
        renderPagination();
        updateHeaderSortStyles();
      });

      header.appendChild(cell);
    });

    updateHeaderSortStyles();
  }

  function updateHeaderSortStyles() {
    const header = $('.loan-table-header');
    if (!header) return;
    $$('.loan-table-header-cell', header).forEach(cell => {
      cell.classList.remove('sorted');
      const icon = $('.sort-icon', cell);
      if (!icon) return;
      if (cell.dataset.key === sortState.key) {
        cell.classList.add('sorted');
        icon.textContent = sortState.dir === 'asc' ? '\u25B2' : '\u25BC';
      } else {
        icon.textContent = '\u2195';
      }
    });
  }

  function applySort() {
    if (!sortState.key) return;
    const key = sortState.key;
    const dir = sortState.dir;

    filteredData.sort((a, b) => {
      const av = normalizeCellValue(a[key]);
      const bv = normalizeCellValue(b[key]);

      const an = parseNumber(av);
      const bn = parseNumber(bv);
      if (Number.isFinite(an) && Number.isFinite(bn)) {
        return dir === 'asc' ? an - bn : bn - an;
      }

      const as = Array.isArray(av) ? av.join(', ') : String(av || '');
      const bs = Array.isArray(bv) ? bv.join(', ') : String(bv || '');
      return dir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
    });
  }

  // ---------------------------
  // Render Table
  // ---------------------------
  function renderTable() {
    const body = $('.loan-table-body');
    if (!body) return;
    body.innerHTML = '';

    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, filteredData.length);
    const pageItems = filteredData.slice(startIdx, endIdx);

    const header = $('.loan-table-header');
    const colTemplate = visibleColumns.map(() => 'minmax(140px, 1fr)').join(' ');
    if (header) header.style.gridTemplateColumns = colTemplate;

    pageItems.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'loan-table-row';
      row.style.gridTemplateColumns = colTemplate;
      row.dataset.productIndex = startIdx + idx;

      visibleColumns.forEach(col => {
        const cell = document.createElement('div');
        cell.className = 'loan-table-cell';

        let value = item[col];

        const isMatrix =
          typeof value === 'string' &&
          value.startsWith('http') &&
          String(col).toLowerCase().includes('matrix');

        if (isMatrix) {
          cell.innerHTML = '<a href="' + escapeHtml(value) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">View Matrix</a>';
        } else if (col === lenderFieldKey && lenderFieldKey) {
          const v = normalizeCellValue(value);
          const lenderName = Array.isArray(v) ? v[0] : (v || '');
          const logoUrl = lenderLogos[lenderName];

          if (logoUrl) {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'display:flex;align-items:center;gap:8px;';
            const img = document.createElement('img');
            img.src = logoUrl;
            img.alt = '';
            img.style.cssText = 'width:22px;height:22px;border-radius:4px;object-fit:contain;flex-shrink:0;background:#f8fafc;';
            img.loading = 'lazy';
            img.onerror = function() { this.style.display = 'none'; };
            const nameSpan = document.createElement('span');
            nameSpan.textContent = lenderName || '\u2014';
            wrapper.appendChild(img);
            wrapper.appendChild(nameSpan);
            cell.appendChild(wrapper);
          } else {
            cell.textContent = lenderName || '\u2014';
          }
        } else {
          const v = normalizeCellValue(value);
          cell.textContent = Array.isArray(v) ? v.join(' | ') : (v || '\u2014');
        }

        row.appendChild(cell);
      });

      // Row click opens detail modal
      row.addEventListener('click', (e) => {
        if (e.target.tagName === 'A') return;
        const productIndex = parseInt(row.dataset.productIndex, 10);
        const product = filteredData[productIndex];
        if (product && window.MTG_LoanSearch && window.MTG_LoanSearch.openProductModal) {
          window.MTG_LoanSearch.openProductModal(product, fieldMetadata);
        }
      });

      body.appendChild(row);
    });

    const overlay = $('.loading-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  // ---------------------------
  // Pagination
  // ---------------------------
  function renderPagination() {
    const wrapper = $('.pagination-wrapper');
    if (!wrapper) return;
    wrapper.innerHTML = '';

    const total = filteredData.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    currentPage = Math.min(currentPage, totalPages);

    const info = document.createElement('div');
    info.className = 'page-info';
    const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, total);
    info.textContent = 'Showing ' + start + '-' + end + ' of ' + total + ' loans';

    const controls = document.createElement('div');
    controls.className = 'page-controls';
    controls.style.display = 'flex';
    controls.style.alignItems = 'center';
    controls.style.gap = '8px';

    const prev = document.createElement('button');
    prev.className = 'page-btn';
    prev.textContent = '\u2039';
    prev.disabled = currentPage <= 1;
    prev.addEventListener('click', () => {
      currentPage = Math.max(1, currentPage - 1);
      renderTable();
      renderPagination();
    });

    const next = document.createElement('button');
    next.className = 'page-btn';
    next.textContent = '\u203A';
    next.disabled = currentPage >= totalPages;
    next.addEventListener('click', () => {
      currentPage = Math.min(totalPages, currentPage + 1);
      renderTable();
      renderPagination();
    });

    controls.appendChild(prev);

    function addPageButton(p) {
      const btn = document.createElement('button');
      btn.className = 'page-btn' + (p === currentPage ? ' active' : '');
      btn.textContent = String(p);
      btn.addEventListener('click', () => {
        currentPage = p;
        renderTable();
        renderPagination();
      });
      controls.appendChild(btn);
    }

    function addEllipsis() {
      const span = document.createElement('span');
      span.className = 'page-ellipsis';
      span.textContent = '\u2026';
      span.style.padding = '0 4px';
      span.style.color = '#94a3b8';
      controls.appendChild(span);
    }

    const maxButtons = 7;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    startPage = Math.max(1, endPage - maxButtons + 1);

    if (startPage > 1) {
      addPageButton(1);
      if (startPage > 2) addEllipsis();
    }
    for (let p = startPage; p <= endPage; p++) {
      addPageButton(p);
    }
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) addEllipsis();
      addPageButton(totalPages);
    }
    controls.appendChild(next);

    wrapper.appendChild(info);
    wrapper.appendChild(controls);
  }

  // ---------------------------
  // Filters UI
  // ---------------------------
  function openFilterModal() {
    if (typeof window.openFilterPanel === 'function') {
      window.openFilterPanel();
      return;
    }
    const panel = document.getElementById('filter-panel');
    const btn = $('.filters-button');
    if (panel) panel.classList.add('open');
    if (btn) btn.classList.add('active');
  }

  function closeFilterModal() {
    if (typeof window.closeFilterPanel === 'function') {
      window.closeFilterPanel();
    } else {
      const panel = document.getElementById('filter-panel');
      const btn = $('.filters-button');
      if (panel) panel.classList.remove('open');
      if (btn) btn.classList.remove('active');
    }
    closeAllPanels();
  }

  function toggleFiltersPanel() {
    if (typeof window.toggleFilterPanel === 'function') {
      window.toggleFilterPanel();
      return;
    }
    const panel = document.getElementById('filter-panel');
    if (!panel) return;
    if (panel.classList.contains('open')) closeFilterModal();
    else openFilterModal();
  }

  function setFilterCountBadge() {
    const badge = $('.filter-count');
    if (!badge) return;

    let count = 0;
    Object.keys(filterState.single).forEach(k => { if (filterState.single[k]) count++; });
    Object.keys(filterState.numeric).forEach(k => { if (Number.isFinite(filterState.numeric[k])) count++; });
    Object.keys(filterState.multi).forEach(k => { if (filterState.multi[k] && filterState.multi[k].size) count++; });
    Object.keys(filterState.range).forEach(k => { if (Number.isFinite(filterState.range[k])) count++; });

    if (count > 0) {
      badge.textContent = String(count);
      badge.style.display = 'inline-flex';
    } else {
      badge.textContent = '0';
      badge.style.display = 'none';
    }

    const clearToolbar = document.getElementById('filter-panel-toolbar');
    if (clearToolbar) {
      clearToolbar.style.display = count > 0 ? 'flex' : 'none';
    }
  }

  function ensureActiveChipsDOM() {
    let bar = $('.active-filters-bar');
    let wrap = $('.active-filters');
    if (bar && wrap) return { bar, wrap };

    bar = document.createElement('div');
    bar.className = 'active-filters-bar';
    wrap = document.createElement('div');
    wrap.className = 'active-filters';
    bar.appendChild(wrap);

    const filtersBtn = document.querySelector('.filters-button');
    if (filtersBtn && filtersBtn.parentElement) {
      const row = filtersBtn.parentElement;
      row.parentElement.insertBefore(bar, row.nextSibling);
    } else {
      const preferred = document.querySelector('.main-content-section') || document.body;
      preferred.insertBefore(bar, preferred.firstChild);
    }

    return { bar, wrap };
  }

  function updateActiveChips() {
    const dom = ensureActiveChipsDOM();
    const bar = dom.bar;
    const wrap = dom.wrap;
    const chips = [];

    for (const k of Object.keys(filterState.single)) {
      const v = filterState.single[k];
      if (!v) continue;
      chips.push({ key: k, value: v, mode: 'single' });
    }
    for (const k of Object.keys(filterState.numeric)) {
      const v = filterState.numeric[k];
      if (!Number.isFinite(v)) continue;
      chips.push({ key: k, value: String(v), mode: 'numeric' });
    }
    for (const k of Object.keys(filterState.multi)) {
      const set = filterState.multi[k];
      if (!set || !set.size) continue;
      for (const v of Array.from(set)) {
        chips.push({ key: k, value: v, mode: 'multi' });
      }
    }
    for (const k of Object.keys(filterState.range)) {
      const v = filterState.range[k];
      if (!Number.isFinite(v)) continue;
      const cfg = RANGE_FILTER_CONFIGS[k];
      const formatted = '$' + v.toLocaleString();
      chips.push({ key: k, value: formatted, mode: 'range', label: cfg ? cfg.label : k });
    }

    wrap.innerHTML = '';
    chips.forEach(ch => {
      const label = ch.label || fieldMetadata[ch.key]?.label || ch.key.replace(/_/g, ' ');
      const chip = document.createElement('div');
      chip.className = 'filter-chip';
      chip.innerHTML = '<span>' + escapeHtml(label) + ': ' + escapeHtml(ch.value) + '</span>' +
        '<span class="chip-x" aria-label="Remove filter" title="Remove">\u00D7</span>';
      chip.querySelector('.chip-x').addEventListener('click', () => {
        if (ch.mode === 'single') filterState.single[ch.key] = '';
        if (ch.mode === 'numeric') delete filterState.numeric[ch.key];
        if (ch.mode === 'multi') {
          const set = filterState.multi[ch.key];
          if (set) set.delete(ch.value);
        }
        if (ch.mode === 'range') delete filterState.range[ch.key];
        syncFiltersUIFromState();
        setFilterCountBadge();
        updateActiveChips();
        applyFilters();
      });
      wrap.appendChild(chip);
    });

    bar.style.display = chips.length ? 'block' : 'none';
  }

  function closeAllPanels() {
    $$('.ms-panel').forEach(panel => { panel.hidden = true; });
  }

  // ---------------------------
  // Multi-checkbox dropdown control
  // ---------------------------
  function buildMultiCheckboxControl(key) {
    const wrap = document.createElement('div');
    wrap.className = 'ms-wrap';
    wrap.dataset.key = key;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ms-btn';
    btn.innerHTML = '<span>All</span><span class="ms-caret"></span>';

    const panel = document.createElement('div');
    panel.className = 'ms-panel';
    panel.hidden = true;

    const search = document.createElement('input');
    search.className = 'ms-search';
    search.type = 'text';
    search.placeholder = 'Search...';

    const options = document.createElement('div');
    options.className = 'ms-options';

    const footer = document.createElement('div');
    footer.className = 'ms-footer';

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'ms-mini-btn';
    clearBtn.textContent = 'Clear';

    const selectAllBtn = document.createElement('button');
    selectAllBtn.type = 'button';
    selectAllBtn.className = 'ms-mini-btn';
    selectAllBtn.textContent = 'Select all';

    footer.appendChild(clearBtn);
    footer.appendChild(selectAllBtn);

    panel.appendChild(search);
    panel.appendChild(options);
    panel.appendChild(footer);

    panel.addEventListener('click', (e) => { e.stopPropagation(); });

    wrap.appendChild(btn);
    (document.body || document.documentElement).appendChild(panel);

    const allOpts = buildUniqueOptions(key);
    const set = filterState.multi[key] || new Set();
    filterState.multi[key] = set;

    function updateButtonLabel() {
      const count = set.size;
      const labelSpan = btn.querySelector('span');
      if (!labelSpan) return;
      if (count === 0) { labelSpan.textContent = 'All'; btn.classList.remove('has-value'); }
      else if (count === 1) { labelSpan.textContent = Array.from(set)[0]; btn.classList.add('has-value'); }
      else { labelSpan.textContent = count + ' selected'; btn.classList.add('has-value'); }
    }

    function renderOptions(filterText) {
      const t = (filterText || '').trim().toLowerCase();
      options.innerHTML = '';
      const shown = t ? allOpts.filter(v => String(v).toLowerCase().includes(t)) : allOpts;

      shown.forEach(v => {
        const row = document.createElement('label');
        row.className = 'ms-opt';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = set.has(v);
        const span = document.createElement('span');
        span.textContent = v;

        cb.addEventListener('change', () => {
          if (cb.checked) set.add(v); else set.delete(v);
          updateButtonLabel();
          setFilterCountBadge();
          updateActiveChips();
          applyFilters();
        });

        row.appendChild(cb);
        row.appendChild(span);
        options.appendChild(row);
      });
    }

    function positionPanel() {
      const rect = btn.getBoundingClientRect();
      const panelW = 280;
      let left = rect.left;
      let top = rect.bottom + 4;
      if (left + panelW > window.innerWidth) left = window.innerWidth - panelW - 8;
      if (left < 4) left = 4;
      panel.style.left = left + 'px';
      panel.style.top = top + 'px';
      panel.style.width = panelW + 'px';
    }

    let rafId = null;
    function scheduleReposition() {
      if (panel.hidden) return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => { rafId = null; positionPanel(); });
    }

    window.addEventListener('scroll', scheduleReposition, true);
    window.addEventListener('resize', scheduleReposition);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = !panel.hidden;
      closeAllPanels();
      panel.hidden = isOpen ? true : false;
      if (!panel.hidden) {
        search.value = '';
        renderOptions('');
        positionPanel();
        search.focus();
      }
    });

    search.addEventListener('input', () => renderOptions(search.value));

    clearBtn.addEventListener('click', () => {
      set.clear();
      renderOptions(search.value);
      updateButtonLabel();
      setFilterCountBadge();
      ensureActiveChipsDOM();
      updateActiveChips();
      applyFilters();
    });

    selectAllBtn.addEventListener('click', () => {
      allOpts.forEach(v => set.add(v));
      renderOptions(search.value);
      updateButtonLabel();
      setFilterCountBadge();
      ensureActiveChipsDOM();
      updateActiveChips();
      applyFilters();
    });

    renderOptions('');
    updateButtonLabel();

    return wrap;
  }

  // ---------------------------
  // Single-select dropdown control
  // ---------------------------
  function buildSingleSelectControl(key) {
    const sel = document.createElement('select');
    sel.className = 'filter-select';
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = 'All';
    sel.appendChild(opt0);

    buildUniqueOptions(key).forEach(v => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = v;
      sel.appendChild(o);
    });

    sel.addEventListener('change', () => {
      filterState.single[key] = sel.value || '';
      sel.classList.toggle('has-value', !!sel.value);
      setFilterCountBadge();
      ensureActiveChipsDOM();
      updateActiveChips();
      applyFilters();
    });

    return sel;
  }

  // ---------------------------
  // Numeric threshold control
  // ---------------------------
  function buildNumericThresholdControl(key) {
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.inputMode = 'numeric';
    inp.className = 'filter-input';
    inp.placeholder = 'Enter min value...';

    inp.addEventListener('input', () => {
      const n = parseNumber(inp.value);
      if (Number.isFinite(n)) filterState.numeric[key] = n;
      else delete filterState.numeric[key];
      inp.classList.toggle('has-value', Number.isFinite(n));
      setFilterCountBadge();
      ensureActiveChipsDOM();
      updateActiveChips();
      debounce('numeric_' + key, () => applyFilters(), 300);
    });

    return inp;
  }

  // ---------------------------
  // Range input control
  // ---------------------------
  function buildRangeInputControl(rangeKey) {
    const cfg = RANGE_FILTER_CONFIGS[rangeKey];
    if (!cfg) return document.createElement('div');

    const inp = document.createElement('input');
    inp.type = 'text';
    inp.inputMode = 'numeric';
    inp.className = 'filter-input';
    inp.dataset.rangeKey = rangeKey;
    inp.placeholder = cfg.placeholder || 'Enter amount...';

    inp.addEventListener('blur', () => {
      const n = parseNumber(inp.value);
      if (Number.isFinite(n) && n > 0) inp.value = '$' + n.toLocaleString();
    });

    inp.addEventListener('focus', () => {
      const n = parseNumber(inp.value);
      if (Number.isFinite(n)) inp.value = String(n);
    });

    inp.addEventListener('input', () => {
      const n = parseNumber(inp.value);
      if (Number.isFinite(n) && n > 0) filterState.range[rangeKey] = n;
      else delete filterState.range[rangeKey];
      inp.classList.toggle('has-value', Number.isFinite(n) && n > 0);
      setFilterCountBadge();
      ensureActiveChipsDOM();
      updateActiveChips();
      debounce('range_' + rangeKey, () => applyFilters(), 300);
    });

    return inp;
  }

  // ---------------------------
  // Build filter controls (accordion layout)
  // ---------------------------
  let _activePillGroups = new Set();

  function _getGroupIcon(groupName) {
    const name = (groupName || '').toLowerCase();
    if (name.includes('loan info') || name.includes('loan details')) return 'fa-file-invoice-dollar';
    if (name.includes('property')) return 'fa-house';
    if (name.includes('borrower') || name.includes('credit')) return 'fa-user';
    if (name.includes('pricing') || name.includes('rate') || name.includes('comp')) return 'fa-percent';
    if (name.includes('guideline') || name.includes('eligible') || name.includes('requirement')) return 'fa-list-check';
    if (name.includes('dscr') || name.includes('investment') || name.includes('rental')) return 'fa-building';
    if (name.includes('bank') || name.includes('income') || name.includes('p&l') || name.includes('profit')) return 'fa-money-bill-wave';
    if (name.includes('dpa') || name.includes('down payment') || name.includes('assistance')) return 'fa-hand-holding-dollar';
    if (name.includes('heloc') || name.includes('heloan') || name.includes('2nd')) return 'fa-layer-group';
    if (name.includes('fix') || name.includes('flip') || name.includes('rehab')) return 'fa-hammer';
    if (name.includes('construction') || name.includes('guc')) return 'fa-hard-hat';
    if (name.includes('nexa')) return 'fa-shield-halved';
    if (name.includes('other')) return 'fa-ellipsis';
    return 'fa-sliders';
  }

  function buildFilterControls() {
    const grid = $('.filters-grid');
    if (grid) grid.innerHTML = '';

    // Fields shown as quick-access filters in the search bar — skip them in the panel
    const QUICK_FILTER_LABELS = ['min fico', 'purpose', 'occupancy'];
    function isQuickFilterField(key) {
      const label = (fieldMetadata[key]?.label || key).toLowerCase().replace(/[^a-z ]/g, '').trim();
      return QUICK_FILTER_LABELS.some(qf => label === qf);
    }

    const filterKeys = allFields.filter(k => (fieldMetadata[k]?.filterable !== false) && !isRangeSubField(k) && !isNonFilterable(k) && !isQuickFilterField(k));

    const groups = {};
    filterKeys.forEach(key => {
      const groupName = (fieldMetadata && fieldMetadata[key] && fieldMetadata[key].groupName)
        ? fieldMetadata[key].groupName
        : 'Other';
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(key);
    });

    const sortedGroupNames = Object.keys(groups).sort((a, b) => {
      const aOrder = fieldMetadata[groups[a][0]]?.groupOrder || 99;
      const bOrder = fieldMetadata[groups[b][0]]?.groupOrder || 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.localeCompare(b);
    });

    // Skip loan_amount range filter from panel (it's in the quick-access bar)
    const QUICK_RANGE_KEYS = new Set(['loan_amount']);
    const rangeFiltersByGroup = {};
    Object.keys(RANGE_FILTER_CONFIGS).filter(k => !QUICK_RANGE_KEYS.has(k)).forEach(rangeKey => {
      const cfg = RANGE_FILTER_CONFIGS[rangeKey];
      const minNorm = String(cfg.minField).toLowerCase().replace(/[^a-z0-9]/g, '');
      const minMetaKey = Object.keys(fieldMetadata).find(k =>
        String(k).toLowerCase().replace(/[^a-z0-9]/g, '') === minNorm
      );
      const minMeta = minMetaKey ? fieldMetadata[minMetaKey] : null;
      const resolved = {
        groupName:  cfg.groupName  || (minMeta && minMeta.groupName)  || cfg.groupNameFallback  || 'Other',
        groupOrder: cfg.groupOrder || (minMeta && minMeta.groupOrder) || cfg.groupOrderFallback || 99,
        fieldOrder: cfg.fieldOrder || (minMeta && minMeta.fieldOrder) || cfg.fieldOrderFallback || 99
      };
      const gName = resolved.groupName;
      if (!rangeFiltersByGroup[gName]) rangeFiltersByGroup[gName] = [];
      rangeFiltersByGroup[gName].push({ rangeKey, cfg, resolved });
    });

    if (_activePillGroups.size === 0 && sortedGroupNames.length > 0) {
      const loanInfoGroup = sortedGroupNames.find(gName => {
        const lower = gName.toLowerCase();
        return lower.includes('loan info') || lower.includes('loan details');
      });
      _activePillGroups.add(loanInfoGroup || sortedGroupNames[0]);
    }

    sortedGroupNames.forEach(groupName => {
      const isActive = _activePillGroups.has(groupName);
      const isNexaGroup = groupName.toLowerCase().includes('nexa');

      if (grid) {
        const section = document.createElement('div');
        let sectionClass = 'filter-group-section' + (isActive ? ' active' : '');
        if (isNexaGroup) sectionClass += ' nexa-filter-card nexa-only';
        section.className = sectionClass;
        section.setAttribute('data-group', groupName);

        const header = document.createElement('div');
        header.className = 'filter-group-section-header';

        const icon = document.createElement('i');
        icon.className = 'section-icon fas ' + _getGroupIcon(groupName);
        header.appendChild(icon);

        const headerTextSpan = document.createElement('span');
        headerTextSpan.className = 'section-header-text';
        headerTextSpan.textContent = groupName;
        header.appendChild(headerTextSpan);

        if (isNexaGroup) {
          const badge = document.createElement('span');
          badge.className = 'nexa-filter-badge';
          badge.textContent = 'NEXA';
          header.appendChild(badge);
        }

        const chevron = document.createElement('i');
        chevron.className = 'section-chevron fas fa-chevron-down';
        header.appendChild(chevron);

        header.addEventListener('click', () => {
          if (_activePillGroups.has(groupName)) {
            _activePillGroups.delete(groupName);
            section.classList.remove('active');
          } else {
            _activePillGroups.add(groupName);
            section.classList.add('active');
          }
        });

        section.appendChild(header);

        const itemsDiv = document.createElement('div');
        itemsDiv.className = 'filter-group-section-items';

        const sortedKeys = groups[groupName].sort((a, b) => {
          const aOrder = fieldMetadata[a]?.fieldOrder || 99;
          const bOrder = fieldMetadata[b]?.fieldOrder || 99;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return a.localeCompare(b);
        });

        const filterItems = [];

        sortedKeys.forEach(key => {
          const meta = fieldMetadata[key] || {};
          const group = document.createElement('div');
          group.className = 'filter-group';
          const label = document.createElement('div');
          label.className = 'filter-label';
          label.textContent = meta.label || key.replace(/_/g, ' ');
          group.appendChild(label);

          let control;
          if (isNumericThresholdKey(key)) {
            control = buildNumericThresholdControl(key);
          } else {
            control = buildMultiCheckboxControl(key);
          }

          group.appendChild(control);
          filterItems.push({ order: meta.fieldOrder || 99, element: group });
        });

        if (rangeFiltersByGroup[groupName]) {
          rangeFiltersByGroup[groupName].forEach(({ rangeKey, cfg, resolved }) => {
            const group = document.createElement('div');
            group.className = 'filter-group';
            const label = document.createElement('div');
            label.className = 'filter-label';
            label.textContent = cfg.label;
            group.appendChild(label);
            const control = buildRangeInputControl(rangeKey);
            group.appendChild(control);
            filterItems.push({ order: resolved.fieldOrder, element: group });
          });
          delete rangeFiltersByGroup[groupName];
        }

        filterItems.sort((a, b) => a.order - b.order);
        filterItems.forEach(item => itemsDiv.appendChild(item.element));

        section.appendChild(itemsDiv);
        grid.appendChild(section);
      }
    });

    if (!window._loanSearchClickListenerAdded) {
      window._loanSearchClickListenerAdded = true;
      document.addEventListener('click', (e) => {
        const withinWrap = e.target.closest('.ms-wrap');
        const withinPanel = e.target.closest('.ms-panel');
        if (!withinWrap && !withinPanel) closeAllPanels();
      });
    }
  }

  function syncFiltersUIFromState() {
    const grid = $('.filters-grid');
    if (!grid) return;

    $$('select.filter-select', grid).forEach(sel => {
      const group = sel.closest('.filter-group');
      const key = group?.querySelector('.filter-label')?.textContent;
      const metaKey = Object.keys(fieldMetadata).find(k => (fieldMetadata[k]?.label || k.replace(/_/g, ' ')) === key);
      const k = metaKey || sel.dataset.key;
      if (!k) return;
      sel.value = filterState.single[k] || '';
      sel.classList.toggle('has-value', !!sel.value);
    });

    $$('input.filter-input', grid).forEach(inp => {
      const group = inp.closest('.filter-group');
      const lbl = group?.querySelector('.filter-label')?.textContent;
      const metaKey = Object.keys(fieldMetadata).find(k => (fieldMetadata[k]?.label || k.replace(/_/g, ' ')) === lbl);
      const k = metaKey;
      if (!k) return;
      if (isNumericThresholdKey(k)) {
        const n = filterState.numeric[k];
        inp.value = Number.isFinite(n) ? String(n) : '';
        inp.classList.toggle('has-value', Number.isFinite(n));
      }
    });

    $$('input.filter-input[data-range-key]', grid).forEach(inp => {
      const rangeKey = inp.dataset.rangeKey;
      if (!rangeKey) return;
      const n = filterState.range[rangeKey];
      if (Number.isFinite(n)) {
        inp.value = '$' + n.toLocaleString();
        inp.classList.add('has-value');
      } else {
        inp.value = '';
        inp.classList.remove('has-value');
      }
    });

    $$('.ms-wrap', grid).forEach(ms => {
      const k = ms.dataset.key;
      const set = filterState.multi[k] || new Set();
      filterState.multi[k] = set;
      const btn = ms.querySelector('.ms-btn');
      const labelSpan = btn?.querySelector('span');
      const count = set.size;
      if (labelSpan) {
        if (count === 0) labelSpan.textContent = 'All';
        else if (count === 1) labelSpan.textContent = Array.from(set)[0];
        else labelSpan.textContent = count + ' selected';
      }
      btn?.classList.toggle('has-value', count > 0);
      $$('.ms-opt', ms).forEach(opt => {
        const txt = opt.querySelector('span')?.textContent;
        const cb = opt.querySelector('input[type="checkbox"]');
        if (txt && cb) cb.checked = set.has(txt);
      });
    });

    setFilterCountBadge();
    ensureActiveChipsDOM();
    updateActiveChips();
  }

  // ---------------------------
  // Filtering logic
  // ---------------------------
  function updateResultsCount() {
    const el = $('.results-count');
    const modalCount = $('.filter-modal-count');
    const filtered = filteredData.length;
    const total = rawData.length;

    const cat = CATEGORY_CONFIG.find(c => c.id === activeCategory);
    const catLabel = (cat && cat.id !== 'all') ? cat.label + ': ' : '';

    const text = (filtered === total)
      ? catLabel + total + ' products'
      : catLabel + filtered + ' of ' + total + ' products';
    if (el) el.textContent = text;
    if (modalCount) modalCount.textContent = text;
  }

  function applyFilters() {
    const searchInput = $('.search-input');
    const query = (searchInput?.value || '').trim().toLowerCase();

    let baseData = rawData;
    const cat = CATEGORY_CONFIG.find(c => c.id === activeCategory);
    if (cat && cat.filterValues && categoryFieldKey) {
      baseData = rawData.filter(item => {
        const val = String(item[categoryFieldKey] || '').toLowerCase();
        return cat.filterValues.some(fv => val === fv.toLowerCase());
      });
    }

    filteredData = baseData.filter(item => {
      if (query) {
        const hay = allFields.map(k => {
          const v = normalizeCellValue(item[k]);
          return Array.isArray(v) ? v.join(' ') : String(v || '');
        }).join(' ').toLowerCase();
        if (!hay.includes(query)) return false;
      }

      for (const k of Object.keys(filterState.single)) {
        const wanted = filterState.single[k];
        if (!wanted) continue;
        const v = normalizeCellValue(item[k]);
        const vs = Array.isArray(v) ? v.join(' | ') : String(v || '');
        if (vs !== wanted) return false;
      }

      for (const k of Object.keys(filterState.numeric)) {
        const thr = filterState.numeric[k];
        if (!Number.isFinite(thr)) continue;
        const n = parseNumber(item[k]);
        if (!Number.isFinite(n)) return false;
        if (n > thr) return false;
      }

      for (const rangeKey of Object.keys(filterState.range)) {
        const val = filterState.range[rangeKey];
        if (!Number.isFinite(val)) continue;
        const cfg = RANGE_FILTER_CONFIGS[rangeKey];
        if (!cfg) continue;
        const minKey = resolveFieldKey(cfg.minField);
        const maxKey = resolveFieldKey(cfg.maxField);
        if (minKey) {
          const minVal = parseNumber(item[minKey]);
          if (Number.isFinite(minVal) && val < minVal) return false;
        }
        if (maxKey) {
          const maxVal = parseNumber(item[maxKey]);
          if (Number.isFinite(maxVal) && val > maxVal) return false;
        }
      }

      for (const k of Object.keys(filterState.multi)) {
        const set = filterState.multi[k];
        if (!set || !set.size) continue;
        const v = normalizeCellValue(item[k]);
        if (Array.isArray(v)) {
          if (!v.some(x => set.has(x))) return false;
        } else {
          if (!set.has(String(v || ''))) return false;
        }
      }

      return true;
    });

    applySort();
    currentPage = 1;
    renderTable();
    renderPagination();
    updateResultsCount();
    updateClearButtonState();
  }

  function clearFiltersOnly() {
    const search = $('.search-input');
    if (search) search.value = '';
    closeAllPanels();
    closeColumnsPanel();
    filterState = { single: {}, multi: {}, numeric: {}, range: {} };
    activeCategory = 'all';
    visibleColumns = coreColumns.slice();

    // Reset quick-access filters
    const qfFico = document.getElementById('qf-fico-input');
    if (qfFico) { qfFico.value = ''; qfFico.classList.remove('has-value'); }
    const qfAmount = document.getElementById('qf-amount-input');
    if (qfAmount) { qfAmount.value = ''; qfAmount.classList.remove('has-value'); }
    const qfPurpose = document.getElementById('qf-purpose-select');
    if (qfPurpose) { qfPurpose.value = ''; qfPurpose.classList.remove('has-value'); }
    const qfOccupancy = document.getElementById('qf-occupancy-select');
    if (qfOccupancy) { qfOccupancy.value = ''; qfOccupancy.classList.remove('has-value'); }

    renderCategoryBar();
    buildFilterControls();
    buildHeader();
    if (typeof _rebuildColumnsMenu === 'function') _rebuildColumnsMenu();
    setFilterCountBadge();
    ensureActiveChipsDOM();
    updateActiveChips();
    filteredData = rawData.slice();
    applySort();
    currentPage = 1;
    renderTable();
    renderPagination();
    updateResultsCount();
    updateClearButtonState();
  }

  function updateClearButtonState() {
    const btn = $('.reset-button');
    if (!btn) return;
    const search = $('.search-input');
    const hasSearch = search && search.value.trim().length > 0;
    const hasFilters = Object.keys(filterState.single).length > 0 ||
      Object.keys(filterState.multi).length > 0 ||
      Object.keys(filterState.numeric).length > 0 ||
      Object.keys(filterState.range).length > 0;
    const notAllLoans = activeCategory !== 'all';
    const hasSomething = hasSearch || hasFilters || notAllLoans;
    btn.classList.toggle('has-clearable', hasSomething);
  }

  // ---------------------------
  // Columns slide-in panel
  // ---------------------------
  let _rebuildColumnsMenu = null;

  function closeColumnsPanel() {
    const panel = document.getElementById('columns-panel');
    const backdrop = document.getElementById('columns-panel-backdrop');
    if (panel) panel.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
  }

  function openColumnsPanel() {
    const panel = document.getElementById('columns-panel');
    const backdrop = document.getElementById('columns-panel-backdrop');
    if (panel) panel.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
  }

  function initColumnsMenu() {
    const btn = $('.columns-button');
    if (!btn) return;

    const panelBody = document.querySelector('#columns-panel .columns-panel-body');
    if (!panelBody) {
      console.warn('Columns panel not found in DOM');
      return;
    }

    const closeBtn = document.querySelector('#columns-panel .columns-panel-close');
    if (closeBtn) closeBtn.addEventListener('click', closeColumnsPanel);

    const backdrop = document.getElementById('columns-panel-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeColumnsPanel);

    function rebuildMenu() {
      panelBody.innerHTML = '';

      const resetRow = document.createElement('div');
      resetRow.style.cssText = 'padding:0 0 14px;';
      const resetColBtn = document.createElement('button');
      resetColBtn.innerHTML = '<i class="fas fa-undo" style="font-size:11px;"></i> Reset to Default';
      resetColBtn.className = 'columns-reset-btn';
      resetColBtn.addEventListener('click', () => {
        visibleColumns = coreColumns.slice();
        buildHeader();
        renderTable();
        rebuildMenu();
      });
      resetRow.appendChild(resetColBtn);
      panelBody.appendChild(resetRow);

      const groups = {};
      allFields.forEach(k => {
        if (fieldMetadata && fieldMetadata[k] && fieldMetadata[k].detailOnly) return;
        const groupName = (fieldMetadata && fieldMetadata[k] && fieldMetadata[k].groupName) ? fieldMetadata[k].groupName : 'Other';
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(k);
      });

      const sortedGroupNames = Object.keys(groups).sort((a, b) => {
        const aOrder = fieldMetadata[groups[a][0]]?.groupOrder || 99;
        const bOrder = fieldMetadata[groups[b][0]]?.groupOrder || 99;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.localeCompare(b);
      });

      sortedGroupNames.forEach(groupName => {
        const section = document.createElement('div');
        section.className = 'columns-group-section';
        const header = document.createElement('div');
        header.className = 'columns-group-header';
        header.textContent = groupName;
        section.appendChild(header);
        const itemsWrap = document.createElement('div');
        itemsWrap.className = 'columns-group-items';

        const sortedFields = groups[groupName].sort((a, b) => {
          const aOrder = fieldMetadata[a]?.fieldOrder || 99;
          const bOrder = fieldMetadata[b]?.fieldOrder || 99;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return a.localeCompare(b);
        });

        sortedFields.forEach(k => {
          const row = document.createElement('label');
          row.className = 'columns-menu-row';
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = visibleColumns.includes(k);
          cb.addEventListener('change', () => {
            if (cb.checked && !visibleColumns.includes(k)) visibleColumns.push(k);
            else visibleColumns = visibleColumns.filter(x => x !== k);
            buildHeader();
            renderTable();
          });
          const span = document.createElement('span');
          span.textContent = (fieldMetadata && fieldMetadata[k] && fieldMetadata[k].label) ? fieldMetadata[k].label : k;
          row.appendChild(cb);
          row.appendChild(span);
          itemsWrap.appendChild(row);
        });

        section.appendChild(itemsWrap);
        panelBody.appendChild(section);
      });
    }

    rebuildMenu();
    _rebuildColumnsMenu = rebuildMenu;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const panel = document.getElementById('columns-panel');
      if (panel && panel.classList.contains('open')) {
        closeColumnsPanel();
      } else {
        const fp = document.getElementById('filter-panel');
        if (fp && fp.classList.contains('open')) {
          fp.classList.remove('open');
          const fpBack = document.getElementById('filter-panel-backdrop');
          if (fpBack) fpBack.classList.remove('open');
        }
        openColumnsPanel();
      }
    });
  }

  // ---------------------------
  // Quick-access filters (inline in search bar)
  // These mirror the filter panel controls but are always visible.
  // ---------------------------
  function initQuickFilters() {
    // Min FICO quick filter
    const ficoInput = document.getElementById('qf-fico-input');
    if (ficoInput) {
      ficoInput.addEventListener('input', () => {
        const n = parseNumber(ficoInput.value);
        // Find the actual FICO field key
        const ficoKey = allFields.find(k => isNumericThresholdKey(k)) || resolveFieldKey('min_fico');
        if (ficoKey) {
          if (Number.isFinite(n)) filterState.numeric[ficoKey] = n;
          else delete filterState.numeric[ficoKey];
          ficoInput.classList.toggle('has-value', Number.isFinite(n));
          setFilterCountBadge();
          updateActiveChips();
          debounce('qf_fico', () => applyFilters(), 300);
        }
      });
    }

    // Loan Amount quick filter
    const amountInput = document.getElementById('qf-amount-input');
    if (amountInput) {
      amountInput.addEventListener('input', () => {
        const n = parseNumber(amountInput.value);
        if (Number.isFinite(n) && n > 0) filterState.range['loan_amount'] = n;
        else delete filterState.range['loan_amount'];
        amountInput.classList.toggle('has-value', Number.isFinite(n) && n > 0);
        setFilterCountBadge();
        updateActiveChips();
        debounce('qf_amount', () => applyFilters(), 300);
      });
      amountInput.addEventListener('blur', () => {
        const n = parseNumber(amountInput.value);
        if (Number.isFinite(n) && n > 0) amountInput.value = '$' + n.toLocaleString();
      });
      amountInput.addEventListener('focus', () => {
        const n = parseNumber(amountInput.value);
        if (Number.isFinite(n)) amountInput.value = String(n);
      });
    }

    // Purpose quick filter
    const purposeSelect = document.getElementById('qf-purpose-select');
    if (purposeSelect) {
      purposeSelect.addEventListener('change', () => {
        const purposeKey = resolveFieldKey('purpose') || resolveFieldKey('Purpose');
        if (purposeKey) {
          const val = purposeSelect.value;
          if (val) {
            if (!filterState.multi[purposeKey]) filterState.multi[purposeKey] = new Set();
            filterState.multi[purposeKey].clear();
            filterState.multi[purposeKey].add(val);
          } else {
            if (filterState.multi[purposeKey]) filterState.multi[purposeKey].clear();
          }
          purposeSelect.classList.toggle('has-value', !!val);
          setFilterCountBadge();
          updateActiveChips();
          applyFilters();
        }
      });
    }

    // Occupancy quick filter
    const occupancySelect = document.getElementById('qf-occupancy-select');
    if (occupancySelect) {
      occupancySelect.addEventListener('change', () => {
        const occKey = resolveFieldKey('occupancy') || resolveFieldKey('Occupancy');
        if (occKey) {
          const val = occupancySelect.value;
          if (val) {
            if (!filterState.multi[occKey]) filterState.multi[occKey] = new Set();
            filterState.multi[occKey].clear();
            filterState.multi[occKey].add(val);
          } else {
            if (filterState.multi[occKey]) filterState.multi[occKey].clear();
          }
          occupancySelect.classList.toggle('has-value', !!val);
          setFilterCountBadge();
          updateActiveChips();
          applyFilters();
        }
      });
    }
  }

  function populateQuickFilterDropdowns() {
    // Purpose dropdown
    const purposeKey = resolveFieldKey('purpose') || resolveFieldKey('Purpose');
    const purposeSelect = document.getElementById('qf-purpose-select');
    if (purposeKey && purposeSelect) {
      const opts = buildUniqueOptions(purposeKey);
      opts.forEach(v => {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = v;
        purposeSelect.appendChild(o);
      });
    }

    // Occupancy dropdown
    const occKey = resolveFieldKey('occupancy') || resolveFieldKey('Occupancy');
    const occupancySelect = document.getElementById('qf-occupancy-select');
    if (occKey && occupancySelect) {
      const opts = buildUniqueOptions(occKey);
      opts.forEach(v => {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = v;
        occupancySelect.appendChild(o);
      });
    }
  }

  // ---------------------------
  // Init
  // ---------------------------
  async function init() {
    try {
      const resetBtn = $('.reset-button');
      if (resetBtn) resetBtn.addEventListener('click', (e) => { e.preventDefault(); clearFiltersOnly(); });

      const clearAllBtn = document.getElementById('filter-panel-clear-all');
      if (clearAllBtn) {
        clearAllBtn.addEventListener('click', (e) => {
          e.preventDefault();
          clearFiltersOnly();
          _activePillGroups.clear();
          const grid = $('.filters-grid');
          if (grid) {
            $$('.filter-group-section', grid).forEach(section => {
              const gName = section.getAttribute('data-group') || '';
              const isLoanInfo = gName.toLowerCase().includes('loan info') || gName.toLowerCase().includes('loan details');
              if (isLoanInfo) {
                _activePillGroups.add(gName);
                section.classList.add('active');
              } else {
                section.classList.remove('active');
              }
            });
          }
        });
      }

      const search = $('.search-input');
      if (search) search.addEventListener('input', () => debounce('search', () => applyFilters(), 300));

      // Wire up quick-access filters
      initQuickFilters();

      await fetchData();

      // Populate quick-filter dropdowns after data loads
      populateQuickFilterDropdowns();

      renderCategoryBar();
      buildHeader();
      buildFilterControls();
      initColumnsMenu();

      applySort();
      renderTable();
      renderPagination();
      updateResultsCount();
      setFilterCountBadge();
      ensureActiveChipsDOM();
      updateActiveChips();
      updateClearButtonState();

      console.log('\u2705 Loan Search v8.0 loaded successfully');

      window.MTG_LoanSearch = window.MTG_LoanSearch || {};
      window.MTG_LoanSearch.resetColumns = function() {
        visibleColumns = coreColumns.slice();
        buildHeader();
        renderTable();
        if (typeof _rebuildColumnsMenu === 'function') _rebuildColumnsMenu();
      };
      window.MTG_LoanSearch.setCategory = setCategory;
    } catch (err) {
      console.error('Loan Search init failed:', err);
      const overlay = $('.loading-overlay');
      if (overlay) overlay.style.display = 'none';
      const em = $('.error-message');
      if (em) {
        em.textContent = 'Error loading loan search. Please refresh.';
        em.style.display = 'block';
      }
    }
  }

  init();
}
