/**
 * Product Detail Page — main.js (v1.0)
 * =========================================================
 * Cloudflare Pages bundle for /app/products/{slug}
 * Migrated from Webflow embeds (Head CSS + Body JS) to a
 * single Vite IIFE bundle hosted on Cloudflare Pages.
 *
 * Fetches a single loan product type from the mtg-broker-api
 * Worker and renders the full detail page: breadcrumb, header
 * with share buttons, config-driven sections, and lender list.
 *
 * Features: markdown parser, quick-fact pills, notes callout,
 * NEXA gating, share/copy URL, loading skeletons, error state.
 *
 * Product data comes from:
 *   GET https://mtg-broker-api.rich-e00.workers.dev/api/loan-product-types?slug={slug}
 * =========================================================
 */

// Import CSS as string and inject into page
// The ?inline suffix tells Vite to give us the CSS text instead of a separate file
import css from './product-detail.css?inline';

// Inject CSS into the page
(function() {
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();

(function () {
  'use strict';

  // ============================================================
  // CONFIG
  // ============================================================
  var API_BASE = 'https://mtg-broker-api.rich-e00.workers.dev';



  // ============================================================
  // ENSURE PAGE CONTAINERS EXIST
  // If the Webflow page has no content divs (just script embeds),
  // this function auto-builds the full app layout and injects it.
  // If the containers already exist in the page, this is a no-op.
  // ============================================================
  function ensureContainers() {
    // If all three containers already exist, nothing to do
    if (
      document.querySelector('.product-detail-breadcrumb') &&
      document.querySelector('.product-detail-header') &&
      document.querySelector('.product-detail-content')
    ) {
      return;
    }

    // Find the main-content-section div (Webflow app layout container).
    // This is where we inject — it handles sidebar offset + navbar padding.
    var target = document.querySelector('.main-content-section') || document.body;

    // Build the three content containers
    var wrapper = document.createElement('div');
    wrapper.className = 'app-container';
    wrapper.innerHTML =
      // Breadcrumb row
      '<div class="product-detail-breadcrumb" ' +
           'style="margin-bottom:12px;"></div>' +
      // Header card — buildHeader injects .detail-header which has its own styling
      '<div class="product-detail-header" ' +
           'style="margin-bottom:20px;"></div>' +
      // Content sections (stacked cards)
      '<div class="product-detail-content"></div>';

    // Insert at the beginning of main-content-section (before script embeds)
    if (target.firstChild) {
      target.insertBefore(wrapper, target.firstChild);
    } else {
      target.appendChild(wrapper);
    }

    console.log('Product Detail: Auto-injected page containers into main-content-section');
  }


  // ============================================================
  // ENTRY POINT
  // ============================================================
  document.addEventListener('DOMContentLoaded', function () {
    init();
  });

  function init() {
    // Auto-create page layout if the containers don't exist in the page
    ensureContainers();

    showLoadingSkeletons();

    var slug = getSlugFromUrl();
    if (!slug) {
      showError('Could not determine which product to load.');
      return;
    }

    console.log('Product Detail v1.0 (Pages): Loading slug "' + slug + '"');

    fetch(API_BASE + '/api/loan-product-types?slug=' + encodeURIComponent(slug))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.success || !data.product) {
          showError(data.error === 'Product not found'
            ? 'This product could not be found. It may have been removed or renamed.'
            : 'Could not load product data. Please refresh and try again.');
          return;
        }

        var product = data.product;
        console.log('Product Detail v1.0 (Pages): Loaded "' + product.name + '"' +
                    ' (' + (product.sections || []).length + ' sections)' +
                    (data.cached ? ' [cached]' : ''));

        buildBreadcrumb(product);
        buildHeader(product);
        buildContent(product);
      })
      .catch(function (err) {
        console.error('Product Detail v1.0 (Pages): API error', err);
        showError('Could not load product data. Please refresh and try again.');
      });
  }


  // ============================================================
  // GET SLUG FROM URL
  // e.g. /app/products/fha-purchase-loan → "fha-purchase-loan"
  // ============================================================
  function getSlugFromUrl() {
    var parts = window.location.pathname.replace(/\/$/, '').split('/');
    return parts[parts.length - 1] || '';
  }


  // ============================================================
  // BREADCRUMB
  // ============================================================
  function buildBreadcrumb(product) {
    var container = document.querySelector('.product-detail-breadcrumb');
    if (!container) return;

    container.innerHTML =
      '<nav class="breadcrumb-nav">' +
        '<a href="/app/products" class="breadcrumb-link-item">' +
          '<i class="fa-solid fa-box-open" style="margin-right:6px;font-size:12px;"></i>Products' +
        '</a>' +
        '<span class="breadcrumb-separator">/</span>' +
        '<span class="breadcrumb-current">' + escapeHtml(product.name) + '</span>' +
      '</nav>';
  }


  // ============================================================
  // HEADER  —  Icon + Name + Category subtitle + Share buttons
  // ============================================================
  function buildHeader(product) {
    var container = document.querySelector('.product-detail-header');
    if (!container) return;

    var subtitleHtml = product.categoryTags
      ? '<p class="product-detail-subtitle">' + escapeHtml(product.categoryTags) + '</p>'
      : '';

    var shareHtml =
      '<div class="product-header-actions">' +
        '<button class="product-share-btn" id="product-copy-url-btn" title="Copy link to clipboard">' +
          '<i class="fa-solid fa-link"></i>' +
        '</button>' +
        '<button class="product-share-btn" id="product-share-btn" title="Share this product">' +
          '<i class="fa-solid fa-share-nodes"></i>' +
        '</button>' +
      '</div>';

    container.innerHTML =
      '<div class="detail-header">' +
        '<div class="product-detail-icon">' +
          '<i class="fa-solid fa-file-invoice-dollar"></i>' +
        '</div>' +
        '<div class="detail-info">' +
          '<p class="detail-emphasis">Loan Product</p>' +
          '<div class="detail-title-row">' +
            '<h1 class="detail-title">' + escapeHtml(product.name) + '</h1>' +
            shareHtml +
          '</div>' +
          subtitleHtml +
        '</div>' +
      '</div>';

    attachShareHandlers(product.name);
  }


  // ============================================================
  // CONTENT  —  All sections, then Available Lenders at the end
  // ============================================================
  function buildContent(product) {
    var container = document.querySelector('.product-detail-content');
    if (!container) return;

    var html = '';

    // Render each section from the config-driven API response
    var sections = product.sections || [];
    sections.forEach(function (section) {
      html += renderSection(section);
    });

    // Available Lenders is always rendered last, hardcoded (not in config)
    html += buildLendersSection(product);

    if (!html) {
      html =
        '<div class="empty-state-box">' +
          '<i class="fa-solid fa-circle-info" style="font-size:24px;color:#cbd5e1;margin-bottom:8px;display:block;"></i>' +
          'No details have been added for this product yet.' +
        '</div>';
    }

    container.innerHTML = html;
  }


  // ============================================================
  // RENDER SECTION
  // Renders a section title, then loops each field individually.
  // Each field uses its own renderMode from the API response.
  // Sections where any field has nexaGated=true get wrapped in the
  // dark NEXA card and the .nexa-only gating class.
  // ============================================================
  function renderSection(section) {
    if (!section.fields || section.fields.length === 0) return '';

    var isNexa = section.hasNexa === true;
    var wrapClass = isNexa ? 'detail-section nexa-only' : 'detail-section';

    // Build inner HTML by rendering each field individually
    var fieldsHtml = '';
    section.fields.forEach(function (field) {
      var fieldHtml = renderField(field);
      if (!fieldHtml) return;
      // Wrap NEXA-gated fields in their own .nexa-only div if the whole
      // section isn't already gated (mixed sections: some gated, some not)
      if (field.nexaGated && !isNexa) {
        fieldsHtml += '<div class="nexa-only">' + fieldHtml + '</div>';
      } else {
        fieldsHtml += fieldHtml;
      }
    });

    if (!fieldsHtml) return '';

    if (isNexa) {
      return (
        '<div class="' + wrapClass + '">' +
          '<div class="nexa-detail-card">' +
            '<h2 class="detail-section-title nexa-section-title">' +
              '<i class="fa-solid fa-shield-halved" style="margin-right:8px;"></i>' +
              escapeHtml(section.name) +
            '</h2>' +
            fieldsHtml +
          '</div>' +
        '</div>'
      );
    }

    return (
      '<div class="' + wrapClass + '">' +
        '<h2 class="detail-section-title">' + escapeHtml(section.name) + '</h2>' +
        fieldsHtml +
      '</div>'
    );
  }


  // ============================================================
  // RENDER FIELD  —  dispatches by field.renderMode
  // Each field carries its own renderMode from the Airtable config.
  // NEXA gating is handled at the section level (or per-field wrapper)
  // via field.nexaGated — independent of renderMode.
  // ============================================================
  function renderField(field) {
    var mode   = field.renderMode || 'list';
    var value  = field.value;
    var label  = field.displayName;

    // Skip empty / dash values regardless of mode
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' && (!value.trim() || value.trim() === '-')) return '';

    switch (mode) {

      // ----------------------------------------------------------
      // PILLS  — compact badge: "LABEL  value"
      // ----------------------------------------------------------
      case 'pills':
        return (
          '<div class="product-quick-facts" style="margin-bottom:6px;">' +
            '<span class="product-quick-fact">' +
              '<span class="product-quick-fact-label">' + escapeHtml(label) + '</span>' +
              escapeHtml(String(value)) +
            '</span>' +
          '</div>'
        );

      // ----------------------------------------------------------
      // PROSE  — markdown parsed paragraphs, no label shown
      // Supports: **bold**, *italic*, # headings, - bullets,
      //           1. numbered lists, [text](url), `code`
      // ----------------------------------------------------------
      case 'richtext': {
        var text = String(value).trim();
        if (!text) return '';
        return '<div class="product-description-content">' + parseMarkdown(text) + '</div>';
      }

      // ----------------------------------------------------------
      // NOTES  — styled callout box with label header, markdown body
      // ----------------------------------------------------------
      case 'notes':
        return (
          '<div class="product-notes-box" style="margin-bottom:12px;">' +
            '<p class="product-quick-fact-label" style="margin-bottom:6px;">' +
              escapeHtml(label) +
            '</p>' +
            '<div>' + parseMarkdown(String(value)) + '</div>' +
          '</div>'
        );

      // ----------------------------------------------------------
      // NEXA  — renders as a list row (gating handled at section level)
      // ----------------------------------------------------------
      case 'nexa':
      // ----------------------------------------------------------
      // LIST  — standard label: value row (default)
      // ----------------------------------------------------------
      case 'list':
      default: {
        var formatted = formatValue(value);
        if (!formatted || formatted === '&mdash;') return '';
        return (
          '<div class="details-row">' +
            '<span class="details-label">' + escapeHtml(label) + '</span>' +
            '<span class="details-value">' + formatted + '</span>' +
          '</div>'
        );
      }
    }
  }


  // ============================================================
  // MARKDOWN PARSER
  // Handles the markdown Airtable returns from richText fields.
  // Supports: headings, bold, italic, inline code, links,
  //           unordered lists, ordered lists, horizontal rules,
  //           and plain paragraphs with line breaks.
  // ============================================================
  function parseMarkdown(text) {
    if (!text) return '';

    var lines  = text.split('\n');
    var output = '';
    var inUL   = false;
    var inOL   = false;

    function closeList() {
      if (inUL) { output += '</ul>'; inUL = false; }
      if (inOL) { output += '</ol>'; inOL = false; }
    }

    function inlineFormat(str) {
      // Escape HTML first, then re-apply formatting tags
      str = escapeHtml(str);
      // Bold+italic ***text***
      str = str.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
      // Bold **text**
      str = str.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Italic *text* or _text_
      str = str.replace(/\*(.*?)\*/g, '<em>$1</em>');
      str = str.replace(/_(.*?)_/g, '<em>$1</em>');
      // Inline code `code`
      str = str.replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:1px 5px;border-radius:3px;font-size:0.9em;">$1</code>');
      // Links [text](url)
      str = str.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      return str;
    }

    lines.forEach(function (line) {
      var raw = line;

      // Horizontal rule
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(raw.trim())) {
        closeList();
        output += '<hr style="border:none;border-top:1px solid #e2e8f0;margin:12px 0;">';
        return;
      }

      // Headings
      var headingMatch = raw.match(/^(#{1,6})\s+(.*)/);
      if (headingMatch) {
        closeList();
        var level = Math.min(headingMatch[1].length + 2, 6); // h3–h6 to stay below page h1/h2
        output += '<h' + level + ' style="margin:14px 0 6px;font-weight:600;">' +
                  inlineFormat(headingMatch[2]) + '</h' + level + '>';
        return;
      }

      // Unordered list  (- item or * item)
      var ulMatch = raw.match(/^[\s]*[-*]\s+(.*)/);
      if (ulMatch) {
        if (inOL) { output += '</ol>'; inOL = false; }
        if (!inUL) { output += '<ul style="margin:6px 0 6px 20px;padding:0;">'; inUL = true; }
        output += '<li>' + inlineFormat(ulMatch[1]) + '</li>';
        return;
      }

      // Ordered list  (1. item)
      var olMatch = raw.match(/^[\s]*\d+\.\s+(.*)/);
      if (olMatch) {
        if (inUL) { output += '</ul>'; inUL = false; }
        if (!inOL) { output += '<ol style="margin:6px 0 6px 20px;padding:0;">'; inOL = true; }
        output += '<li>' + inlineFormat(olMatch[1]) + '</li>';
        return;
      }

      // Empty line → paragraph break
      if (!raw.trim()) {
        closeList();
        output += '<br>';
        return;
      }

      // Plain line
      closeList();
      output += '<p style="margin:4px 0;">' + inlineFormat(raw) + '</p>';
    });

    closeList();
    return output;
  }


  // ============================================================
  // AVAILABLE LENDERS SECTION  —  always shown, not in config
  // Uses the lendersRollup string from the product root level.
  //
  // FIX: Uses a CSV-aware parser so names containing commas
  //      (e.g. "Action Funding Inc (CA, TX Only)") are handled
  //      correctly instead of being split into fragments.
  //
  // Each lender card links to /app/lenders/{slug} where slug is
  // derived from the lender name.
  // ============================================================
  function buildLendersSection(product) {
    var rollup = product.lendersRollup || '';
    if (!rollup.trim()) return '';

    var lenderNames = parseLenderCsv(rollup);
    if (!lenderNames.length) return '';

    // Sort alphabetically
    lenderNames.sort(function (a, b) { return a.localeCompare(b); });

    var html =
      '<div class="detail-section">' +
        '<h2 class="detail-section-title has-subtitle">' +
          'Available Lenders (' + lenderNames.length + ')' +
        '</h2>' +
        '<p class="lender-section-subtitle">' + escapeHtml(product.name) + '</p>' +
        '<div class="lender-list">';

    lenderNames.forEach(function (name) {
      var slug = toLenderSlug(name);
      var href = '/app/lenders/' + slug;
      html +=
        '<div class="lender-list-item">' +
          '<a href="' + escapeAttr(href) + '" class="lender-card" ' +
             'style="text-decoration:none;display:flex;align-items:center;width:100%;">' +
            '<span class="lender-card-name">' + escapeHtml(name) + '</span>' +
          '</a>' +
        '</div>';
    });

    html += '</div></div>';
    return html;
  }

  /**
   * CSV-aware lender name parser.
   * Handles names like: "Action Funding Inc (CA, TX Only)", Acra Lending
   * Simple rules: quoted tokens keep their internal commas; unquoted tokens
   * are split on commas. Strips surrounding quotes and whitespace.
   */
  function parseLenderCsv(str) {
    var results = [];
    var current = '';
    var inQuotes = false;

    for (var i = 0; i < str.length; i++) {
      var ch = str[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        var trimmed = current.trim();
        if (trimmed) results.push(trimmed);
        current = '';
      } else {
        current += ch;
      }
    }
    var last = current.trim();
    if (last) results.push(last);
    return results;
  }

  /**
   * Converts a lender name to a Webflow-style URL slug.
   * e.g. "United Wholesale Mortgage (UWM)" → "united-wholesale-mortgage-uwm"
   */
  function toLenderSlug(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')  // replace special chars with space
      .trim()
      .replace(/\s+/g, '-')            // spaces → hyphens
      .replace(/-+/g, '-');            // collapse multiple hyphens
  }


  // ============================================================
  // FORMAT VALUE
  // Handles strings, booleans, arrays, attachment objects, URLs
  // ============================================================
  function formatValue(val) {
    if (val === null || val === undefined) return '&mdash;';
    if (typeof val === 'boolean') return val ? '&#10003; Yes' : '&#10007; No';

    // Attachment array (objects with .url property)
    if (Array.isArray(val) && val.length > 0 && val[0] && val[0].url) {
      return val.map(function (att) {
        var filename = att.filename || 'Download';
        var isImage = att.type && att.type.startsWith('image/');
        if (isImage) {
          return (
            '<a href="' + escapeAttr(att.url) + '" target="_blank" rel="noopener">' +
              '<img src="' + escapeAttr(att.url) + '" alt="' + escapeAttr(filename) +
              '" style="max-height:120px;border-radius:6px;margin-top:4px;" />' +
            '</a>'
          );
        }
        return (
          '<a href="' + escapeAttr(att.url) + '" target="_blank" rel="noopener" ' +
          'style="display:inline-flex;align-items:center;gap:6px;">' +
            '<i class="fa-solid fa-file-arrow-down"></i> ' + escapeHtml(filename) +
          '</a>'
        );
      }).join('<br>');
    }

    // Plain string array
    if (Array.isArray(val)) {
      return val.map(function (v) {
        return '<span class="badge-tag">' + escapeHtml(String(v)) + '</span>';
      }).join(' ');
    }

    var str = String(val).trim();
    if (!str || str === '-') return '&mdash;';

    // URLs → clickable link
    if (str.startsWith('http')) {
      return (
        '<a href="' + escapeAttr(str) + '" target="_blank" rel="noopener" ' +
        'style="display:inline-flex;align-items:center;gap:5px;">' +
          'Open Link <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:11px;"></i>' +
        '</a>'
      );
    }

    return escapeHtml(str).replace(/\n/g, '<br>');
  }


  // ============================================================
  // LOADING SKELETONS
  // ============================================================
  function showLoadingSkeletons() {
    var header  = document.querySelector('.product-detail-header');
    var content = document.querySelector('.product-detail-content');
    if (header) header.innerHTML = '<div class="product-detail-skeleton skeleton-header"></div>';
    if (content) {
      content.innerHTML =
        '<div class="product-detail-skeleton skeleton-section"></div>' +
        '<div class="product-detail-skeleton skeleton-section" style="height:160px;"></div>';
    }
  }


  // ============================================================
  // ERROR STATE
  // ============================================================
  function showError(message) {
    var header     = document.querySelector('.product-detail-header');
    var content    = document.querySelector('.product-detail-content');
    var breadcrumb = document.querySelector('.product-detail-breadcrumb');

    if (header) header.innerHTML = '';

    if (content) {
      content.innerHTML =
        '<div class="product-error-state">' +
          '<div class="error-icon"><i class="fa-solid fa-circle-exclamation"></i></div>' +
          '<h3>Product Not Found</h3>' +
          '<p>' + escapeHtml(message) + '</p>' +
          '<a href="/app/products" class="product-error-back-btn">' +
            '<i class="fa-solid fa-arrow-left"></i> Back to Products' +
          '</a>' +
        '</div>';
    }

    if (breadcrumb) {
      breadcrumb.innerHTML =
        '<nav class="breadcrumb-nav">' +
          '<a href="/app/products" class="breadcrumb-link-item">' +
            '<i class="fa-solid fa-box-open" style="margin-right:6px;font-size:12px;"></i>Products' +
          '</a>' +
          '<span class="breadcrumb-separator">/</span>' +
          '<span class="breadcrumb-current">Not Found</span>' +
        '</nav>';
    }
  }


  // ============================================================
  // SHARE / COPY URL BUTTONS
  // ============================================================
  function attachShareHandlers(productName) {
    var copyBtn  = document.getElementById('product-copy-url-btn');
    var shareBtn = document.getElementById('product-share-btn');
    var currentUrl = window.location.href;

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        navigator.clipboard.writeText(currentUrl).then(function () {
          flashBtn(copyBtn, 'fa-link');
        }).catch(function () {
          copyFallback(currentUrl);
          flashBtn(copyBtn, 'fa-link');
        });
      });
    }

    if (shareBtn) {
      shareBtn.addEventListener('click', function () {
        if (navigator.share) {
          navigator.share({
            title: productName + ' | mtg.broker',
            text: 'Check out ' + productName + ' on mtg.broker',
            url: currentUrl
          }).catch(function () {});
        } else {
          navigator.clipboard.writeText(currentUrl).then(function () {
            flashBtn(shareBtn, 'fa-share-nodes');
          });
        }
      });
    }
  }

  function flashBtn(btn, originalIcon) {
    var icon = btn.querySelector('i');
    if (icon) icon.className = 'fa-solid fa-check';
    btn.classList.add('copied');
    setTimeout(function () {
      if (icon) icon.className = 'fa-solid ' + originalIcon;
      btn.classList.remove('copied');
    }, 2000);
  }

  function copyFallback(text) {
    var tmp = document.createElement('input');
    tmp.value = text;
    document.body.appendChild(tmp);
    tmp.select();
    document.execCommand('copy');
    document.body.removeChild(tmp);
  }


  // ============================================================
  // UTILITIES
  // ============================================================
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

  function escapeAttr(str) {
    return escapeHtml(str);
  }

})();
