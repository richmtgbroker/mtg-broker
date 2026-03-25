// ============================================================
// LOAN SEARCH — HTML Template
// Generates the DOM structure that was previously in the Webflow HTML embed.
// This is injected into the #loan-search-app mount point.
// ============================================================

export function getTemplate() {
  return `
<!-- ===== LAYOUT WRAPPER — flex container for push behavior ===== -->
<div class="loan-search-layout">

<!-- ===== LEFT: Main content area ===== -->
<div class="loan-search-main">

<!-- CATEGORY BAR -->
<div class="category-bar">
  <div class="category-scroll">
    <div style="padding:8px 0;color:#94a3b8;font-size:13px;">Loading categories...</div>
  </div>
</div>

<!-- Search Controls -->
<div class="loan-search-controls">
  <div class="search-row">
    <div class="search-left">
      <div class="search-input-wrapper">
        <i class="fas fa-search search-icon"></i>
        <input type="text" class="search-input" placeholder="Search loans...">
      </div>
      <div class="search-actions">
        <button class="filters-button">
          <i class="fas fa-filter"></i>
          <span>Filters</span>
          <span class="filter-count" style="display:none;">0</span>
        </button>
        <button class="reset-button">
          <i class="fas fa-undo"></i>
          <span>Clear</span>
        </button>
      </div>
    </div>
    <div class="control-buttons">
      <button class="columns-button">
        <i class="fas fa-columns"></i>
        <span>Columns</span>
      </button>
    </div>
  </div>
  <div class="active-filters-bar" style="display:none;">
    <div class="active-filters"></div>
  </div>
  <div class="results-row">
    <span class="results-count">Loading...</span>
  </div>
</div>

<!-- Error Message -->
<div class="error-message" style="display:none;"></div>

<!-- Table Container -->
<div class="loan-table-wrapper">
  <div class="loading-overlay" style="display:flex;">
    <div class="loading-spinner"></div>
    <div class="loading-text">Loading loan products...</div>
  </div>
  <div class="loan-table-scroll">
    <div class="loan-table-header"></div>
    <div class="loan-table-body"></div>
  </div>
</div>

<!-- Pagination -->
<div class="pagination-wrapper"></div>

</div><!-- /.loan-search-main -->

<!-- ===== RIGHT: Filter Side Panel ===== -->
<div id="filter-panel" class="filter-panel">
  <div class="filter-panel-inner">
    <div class="filter-panel-header">
      <div class="filter-panel-header-left">
        <h3 class="filter-panel-title">Filters</h3>
        <span class="filter-modal-count"></span>
      </div>
      <button class="filter-panel-close" aria-label="Close filters">&times;</button>
    </div>
    <div class="filter-panel-toolbar" id="filter-panel-toolbar" style="display:none;">
      <button class="filter-panel-clear-all" id="filter-panel-clear-all">
        <i class="fas fa-undo"></i>
        Reset Filters
      </button>
    </div>
    <div class="filter-panel-body">
      <div class="filters-grid"></div>
    </div>
  </div>
</div>

<!-- COLUMNS SLIDE-IN PANEL -->
<div id="columns-panel" class="columns-panel">
  <div class="columns-panel-inner">
    <div class="columns-panel-header">
      <h3 class="columns-panel-title">Columns</h3>
      <button class="columns-panel-close" aria-label="Close columns">&times;</button>
    </div>
    <div class="columns-panel-body"></div>
  </div>
</div>

</div><!-- /.loan-search-layout -->

<!-- PRODUCT DETAIL MODAL -->
<div class="product-detail-modal" id="product-detail-modal" style="display:none;">
  <div class="product-detail-backdrop"></div>
  <div class="product-detail-content">
    <div class="product-detail-header">
      <div class="product-detail-header-text">
        <p class="product-detail-lender"></p>
        <h2 class="product-detail-title">Product Details</h2>
        <p class="product-detail-version"></p>
      </div>
      <div class="product-detail-header-actions">
        <a id="admin-airtable-link" class="admin-airtable-btn" href="#" target="_blank" rel="noopener" style="display:none;" title="Edit in Airtable (Admin)">
          <i class="fas fa-external-link-alt"></i> Edit in Airtable
        </a>
        <button class="product-detail-close" aria-label="Close modal">&times;</button>
      </div>
    </div>
    <div class="product-detail-body"></div>
  </div>
</div>

<!-- MOBILE DROPDOWN BACKDROP -->
<div id="ms-mobile-backdrop" class="ms-mobile-backdrop"></div>

<!-- MOBILE FILTER BACKDROP -->
<div class="filter-panel-backdrop" id="filter-panel-backdrop"></div>

<!-- COLUMNS PANEL BACKDROP -->
<div class="columns-panel-backdrop" id="columns-panel-backdrop"></div>
`;
}
