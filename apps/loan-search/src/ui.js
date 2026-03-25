// ============================================================
// LOAN SEARCH — UI Enhancements
// Extracted from the HTML embed's <script> block (v7.4.1).
// Handles: filter panel open/close, product detail modal,
// mobile backdrops, admin detection, clear/reset handlers.
// ============================================================

// ---------------------------
// DOM helpers
// ---------------------------
function $(sel, root) { return (root || document).querySelector(sel); }
function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

// ---------------------------
// Simple HTML escape
// ---------------------------
function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------------------------
// FILTER PANEL — OPEN / CLOSE / TOGGLE
// ---------------------------
function openFilterPanel() {
  var panel = document.getElementById('filter-panel');
  if (panel) panel.classList.add('open');
  var btn = document.querySelector('.filters-button');
  if (btn) btn.classList.add('active');
  var backdrop = document.getElementById('filter-panel-backdrop');
  if (backdrop && window.innerWidth <= 767) {
    backdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeFilterPanel() {
  var panel = document.getElementById('filter-panel');
  if (panel) panel.classList.remove('open');
  var btn = document.querySelector('.filters-button');
  if (btn) btn.classList.remove('active');
  var backdrop = document.getElementById('filter-panel-backdrop');
  if (backdrop) {
    backdrop.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function toggleFilterPanel() {
  var panel = document.getElementById('filter-panel');
  if (!panel) return;
  if (panel.classList.contains('open')) closeFilterPanel();
  else openFilterPanel();
}

// Expose for loan-search.js
window.openFilterPanel = openFilterPanel;
window.closeFilterPanel = closeFilterPanel;
window.toggleFilterPanel = toggleFilterPanel;

// ---------------------------
// Check if a field value is empty (used by product detail modal)
// ---------------------------
function isFieldEmpty(value) {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'boolean') return false;
  if (typeof value === 'number') return false;
  if (typeof value === 'string') {
    var trimmed = value.trim();
    if (trimmed === '') return true;
    if (/^[-\u2014\u2013]+$/.test(trimmed)) return true;
    if (/^n\/?a$/i.test(trimmed)) return true;
  }
  return false;
}

// ---------------------------
// ADMIN DETECTION
// Reads JWT from localStorage to check admin email
// ---------------------------
var ADMIN_EMAILS = ['rich@prestonlending.com'];
var _isAdmin = false;
(function detectAdmin() {
  try {
    var token = localStorage.getItem('Outseta.nocode.accessToken');
    if (!token) return;
    var parts = token.split('.');
    if (parts.length < 2) return;
    var payload = JSON.parse(atob(parts[1]));
    var email = (payload.email || payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || '').toLowerCase().trim();
    if (email && ADMIN_EMAILS.indexOf(email) !== -1) _isAdmin = true;
  } catch (e) { /* silently fail */ }
})();

// ---------------------------
// PRODUCT DETAIL MODAL
// ---------------------------
function getDetailGroupIcon(groupName) {
  var name = (groupName || '').toLowerCase();
  if (name.indexOf('loan info') !== -1 || name.indexOf('loan details') !== -1) return 'fa-file-invoice-dollar';
  if (name.indexOf('property') !== -1) return 'fa-house';
  if (name.indexOf('borrower') !== -1 || name.indexOf('credit') !== -1) return 'fa-user';
  if (name.indexOf('pricing') !== -1 || name.indexOf('rate') !== -1 || name.indexOf('comp') !== -1) return 'fa-percent';
  if (name.indexOf('ltv') !== -1 || name.indexOf('cltv') !== -1) return 'fa-chart-simple';
  if (name.indexOf('guideline') !== -1 || name.indexOf('eligible') !== -1 || name.indexOf('requirement') !== -1) return 'fa-list-check';
  if (name.indexOf('dscr') !== -1 || name.indexOf('investment') !== -1 || name.indexOf('rental') !== -1) return 'fa-building';
  if (name.indexOf('bank') !== -1 || name.indexOf('income') !== -1 || name.indexOf('p&l') !== -1 || name.indexOf('profit') !== -1) return 'fa-money-bill-wave';
  if (name.indexOf('dpa') !== -1 || name.indexOf('down payment') !== -1 || name.indexOf('assistance') !== -1) return 'fa-hand-holding-dollar';
  if (name.indexOf('heloc') !== -1 || name.indexOf('heloan') !== -1 || name.indexOf('2nd') !== -1) return 'fa-layer-group';
  if (name.indexOf('fix') !== -1 || name.indexOf('flip') !== -1 || name.indexOf('rehab') !== -1) return 'fa-hammer';
  if (name.indexOf('construction') !== -1 || name.indexOf('guc') !== -1) return 'fa-hard-hat';
  if (name.indexOf('nexa') !== -1) return 'fa-shield-halved';
  if (name.indexOf('other') !== -1) return 'fa-ellipsis';
  return 'fa-sliders';
}

function formatDetailValue(value, key) {
  if (value === null || value === undefined || value === '') return '\u2014';
  if (Array.isArray(value)) {
    if (value.length === 0) return '\u2014';
    if (typeof value[0] === 'object' && value[0] !== null && value[0].url) {
      return value.map(function(att) {
        var fname = att.filename || 'Attachment';
        var isImage = att.type && att.type.startsWith('image/');
        if (isImage && att.thumbnails && att.thumbnails.large) {
          return '<a href="' + escapeHtml(att.url) + '" target="_blank" rel="noopener" style="display:inline-block;margin:4px 4px 4px 0"><img src="' + escapeHtml(att.thumbnails.large.url) + '" alt="' + escapeHtml(fname) + '" style="max-width:200px;max-height:120px;border-radius:8px;border:1px solid #e2e8f0"></a>';
        }
        return '<a href="' + escapeHtml(att.url) + '" target="_blank" rel="noopener" class="detail-tag" style="text-decoration:none"><i class="fas fa-file" style="margin-right:4px"></i>' + escapeHtml(fname) + ' \u2197</a>';
      }).join(' ');
    }
    return '<div class="detail-tags">' + value.map(function(v) { return '<span class="detail-tag">' + escapeHtml(String(v)) + '</span>'; }).join('') + '</div>';
  }
  if (typeof value === 'string' && value.startsWith('http')) {
    var isMatrix = key.toLowerCase().includes('matrix');
    if (isMatrix) {
      return '<a href="' + escapeHtml(value) + '" target="_blank" rel="noopener" class="matrix-btn">View Matrix \u2197</a>';
    }
    return '<a href="' + escapeHtml(value) + '" target="_blank" rel="noopener">Open Link \u2197</a>';
  }
  if (typeof value === 'boolean') return value ? '\u2713 Yes' : '\u2717 No';
  var str = String(value);
  if (str.length > 100 || str.indexOf('\n') !== -1) {
    var h = escapeHtml(str);
    h = h.replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:|tel:)[^)]+)\)/g, function(m, text, url) { return '<a href="' + url + '" target="_blank" rel="noopener">' + text + '</a>'; });
    h = h.replace(/&lt;(https?:\/\/[^&]+?)&gt;/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    h = h.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/(^|[\s(>])_([^_]+?)_(?=[\s,.):<]|$)/gm, '$1<em>$2</em>');
    h = h.replace(/(^|[^"=/>])(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    h = h.replace(/\n/g, '<br>');
    return '<div style="white-space:normal;line-height:1.7;font-size:13px">' + h + '</div>';
  }
  return escapeHtml(str);
}

function openProductModal(productData, fieldMetadata) {
  var modal = document.getElementById('product-detail-modal');
  var body = modal.querySelector('.product-detail-body');
  var titleEl = modal.querySelector('.product-detail-title');
  var lenderEl = modal.querySelector('.product-detail-lender');
  var versionEl = modal.querySelector('.product-detail-version');
  if (!modal || !body) return;

  var lenderArr = productData['Lender Name (from Lender Name)'];
  var lender = Array.isArray(lenderArr) ? lenderArr[0] : (lenderArr || productData['Lender'] || productData['lender'] || '');
  var loanType = productData['Loan Product'] || productData['loan_product'] || productData['Product Name'] || 'Product Details';
  var productVersion = productData['Lender Product Name | Version (Final)'] || productData['Lender Product Name | Version'] || '';

  if (lenderEl) {
    lenderEl.textContent = lender ? lender.toUpperCase() : '';
    lenderEl.style.display = lender ? 'block' : 'none';
  }
  if (titleEl) titleEl.textContent = loanType;
  if (versionEl) {
    versionEl.textContent = productVersion;
    versionEl.style.display = productVersion ? 'block' : 'none';
  }

  var configuredFields = Object.keys(fieldMetadata || {});
  if (configuredFields.length === 0) {
    body.innerHTML = '<p style="padding:20px;color:#64748b;">No field configuration available.</p>';
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    return;
  }

  var groups = {};
  configuredFields.forEach(function(key) {
    if (key === 'id') return;
    var meta = fieldMetadata[key];
    if (!meta) return;
    var groupName = meta.groupName || 'Other Details';
    var groupOrder = meta.groupOrder || 99;
    if (!groups[groupName]) groups[groupName] = { order: groupOrder, fields: [] };
    groups[groupName].fields.push({ key: key, label: meta.label || key.replace(/_/g, ' '), value: productData[key], order: meta.fieldOrder || 99 });
  });

  var sortedGroups = Object.entries(groups).sort(function(a, b) { return a[1].order - b[1].order; });
  var html = '';

  sortedGroups.forEach(function(entry) {
    var groupName = entry[0];
    var groupData = entry[1];
    groupData.fields.sort(function(a, b) { return a.order - b.order; });
    var nonEmptyFields = groupData.fields.filter(function(field) { return !isFieldEmpty(field.value); });
    if (nonEmptyFields.length === 0) return;
    var isNexaGroup = groupName.toLowerCase().indexOf('nexa') !== -1;
    var isHowToGroup = groupName.toLowerCase().indexOf('how to') !== -1;
    var sectionClasses = 'detail-section';
    if (isNexaGroup) sectionClasses += ' nexa-detail-card nexa-only';
    if (isHowToGroup) sectionClasses += ' howto-section';
    html += '<div class="' + sectionClasses + '">';
    var iconClass = getDetailGroupIcon(groupName);
    html += '<h3 class="detail-section-title"><i class="section-icon fas ' + iconClass + '"></i>' + escapeHtml(groupName);
    if (isNexaGroup) html += ' <span class="nexa-filter-badge">NEXA</span>';
    html += '</h3><div class="detail-grid">';
    nonEmptyFields.forEach(function(field) {
      var valueHtml = formatDetailValue(field.value, field.key);
      html += '<div class="detail-item"><span class="detail-label">' + escapeHtml(field.label) + '</span><span class="detail-value">' + valueHtml + '</span></div>';
    });
    html += '</div></div>';
  });

  if (html === '') html = '<p style="padding:20px;color:#64748b;">No data available for this product.</p>';
  body.innerHTML = html;

  var existingNexaEl = document.querySelector('.nexa-only');
  if (existingNexaEl && window.getComputedStyle(existingNexaEl).display !== 'none') {
    body.querySelectorAll('.nexa-only').forEach(function(el) { el.style.display = 'block'; });
  }

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  // Show/hide admin Edit in Airtable button
  var airtableBtn = document.getElementById('admin-airtable-link');
  if (airtableBtn) {
    var airtableUrl = productData['Link to this Airtable LOAN (Formula)'] || '';
    if (_isAdmin && airtableUrl) {
      airtableBtn.href = airtableUrl;
      airtableBtn.style.display = 'inline-flex';
    } else {
      airtableBtn.style.display = 'none';
      airtableBtn.href = '#';
    }
  }
}

function closeProductModal() {
  var modal = document.getElementById('product-detail-modal');
  if (modal) { modal.style.display = 'none'; document.body.style.overflow = ''; }
  var airtableBtn = document.getElementById('admin-airtable-link');
  if (airtableBtn) { airtableBtn.style.display = 'none'; airtableBtn.href = '#'; }
}

// Expose for loan-search.js
window.MTG_LoanSearch = window.MTG_LoanSearch || {};
window.MTG_LoanSearch.openProductModal = openProductModal;
window.MTG_LoanSearch.closeProductModal = closeProductModal;

// ---------------------------
// MOBILE DROPDOWN BACKDROP MANAGER
// ---------------------------
function initMobileDropdownBackdrop() {
  var backdrop = document.getElementById('ms-mobile-backdrop');
  if (!backdrop) return;
  function isMobile() { return window.innerWidth <= 767; }
  function updateBackdrop() {
    if (!isMobile()) { backdrop.classList.remove('active'); return; }
    var anyOpen = false;
    document.querySelectorAll('body > .ms-panel').forEach(function(panel) { if (!panel.hidden) anyOpen = true; });
    if (anyOpen) backdrop.classList.add('active');
    else backdrop.classList.remove('active');
  }
  backdrop.addEventListener('click', function() {
    document.querySelectorAll('body > .ms-panel').forEach(function(panel) { panel.hidden = true; });
    backdrop.classList.remove('active');
  });
  var observer = new MutationObserver(function(mutations) {
    var shouldCheck = false;
    mutations.forEach(function(m) {
      if (m.type === 'attributes' && m.attributeName === 'hidden' && m.target.classList && m.target.classList.contains('ms-panel')) shouldCheck = true;
      if (m.type === 'childList') { m.addedNodes.forEach(function(node) { if (node.classList && node.classList.contains('ms-panel')) shouldCheck = true; }); }
    });
    if (shouldCheck) updateBackdrop();
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['hidden'], childList: true, subtree: false });
  window.addEventListener('resize', updateBackdrop);
}

// ---------------------------
// Clear filters and search (called by embed reset button)
// ---------------------------
function clearEverything() {
  var search = $all('.search-input');
  search.forEach(function(s) {
    s.value = '';
    s.dispatchEvent(new Event('input', { bubbles: true }));
    s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  var grid = $('.filters-grid');
  if (grid) {
    $all('input.filter-input', grid).forEach(function(inp) {
      inp.value = '';
      inp.classList.remove('has-value');
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    });
    $all('select.filter-select', grid).forEach(function(sel) {
      sel.selectedIndex = 0;
      sel.classList.remove('has-value');
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    $all('.ms-wrap', grid).forEach(function(msWrap, wrapIndex) {
      var allPanels = $all('body > .ms-panel');
      var panel = allPanels[wrapIndex];
      if (panel) {
        var clearBtn = panel.querySelector('.ms-mini-btn');
        if (clearBtn) clearBtn.click();
      }
    });
  }
}

// ---------------------------
// BIND ALL BUTTON HANDLERS
// ---------------------------
function bind() {
  var filtersBtn = document.querySelector('.filters-button');
  if (filtersBtn) {
    filtersBtn.addEventListener('click', function(e) { e.preventDefault(); toggleFilterPanel(); });
  }

  var resetBtn = $('.reset-button');
  if (resetBtn) {
    resetBtn.addEventListener('click', function(e) { setTimeout(clearEverything, 0); }, true);
  }

  // Clear All Filters button inside the panel
  var clearAllBtn = document.getElementById('filter-panel-clear-all');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', function(e) {
      e.preventDefault();
      clearEverything();
    });
  }

  var closeBtn = document.querySelector('.product-detail-close');
  if (closeBtn) closeBtn.addEventListener('click', closeProductModal);
  var detailBackdrop = document.querySelector('.product-detail-backdrop');
  if (detailBackdrop) detailBackdrop.addEventListener('click', closeProductModal);

  var filterCloseBtn = document.querySelector('.filter-panel-close');
  if (filterCloseBtn) filterCloseBtn.addEventListener('click', closeFilterPanel);

  var filterBackdrop = document.getElementById('filter-panel-backdrop');
  if (filterBackdrop) filterBackdrop.addEventListener('click', closeFilterPanel);

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { closeProductModal(); closeFilterPanel(); }
  });
}

// ---------------------------
// Initialize UI
// ---------------------------
export function initUI() {
  bind();
  initMobileDropdownBackdrop();
}
