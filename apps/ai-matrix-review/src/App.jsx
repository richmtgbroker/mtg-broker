import React, { useState, useEffect, useCallback, useRef } from 'react'

// ─── CONFIG ─────────────────────────────────────────────────────────────────
// API calls use relative URLs so they work on any deployment (staging, production, preview).
// In dev, Vite proxies /api to localhost:8788 (wrangler pages dev).
const API_BASE = '';

// ─── HELPERS ────────────────────────────────────────────────────────────────
function getAuthToken() {
  // Outseta stores the JWT in localStorage
  try {
    return localStorage.getItem('Outseta.nocode.accessToken') || null;
  } catch {
    return null;
  }
}

function getAuthHeaders() {
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// Status badge colors matching Airtable's
const STATUS_COLORS = {
  'Completed':      { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' },
  'Approved':       { bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' },
  'Pending Review': { bg: '#fef9c3', text: '#854d0e', border: '#fde68a' },
  'Rejected':       { bg: '#fee2e2', text: '#991b1b', border: '#fecaca' },
  'Error':          { bg: '#fee2e2', text: '#991b1b', border: '#fecaca' },
  'Processing':     { bg: '#e0e7ff', text: '#3730a3', border: '#c7d2fe' },
};

const STATUS_OPTIONS = ['Pending Review', 'Approved', 'Completed', 'Rejected', 'Error', 'Processing'];

// ─── STATUS BADGE ───────────────────────────────────────────────────────────
function StatusBadge({ status, small }) {
  const colors = STATUS_COLORS[status] || { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' };
  return (
    <span
      className={`status-badge ${small ? 'status-badge-sm' : ''}`}
      style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}
    >
      {status || '—'}
    </span>
  );
}

// ─── FIELD SECTIONS ─────────────────────────────────────────────────────────
// Organize AI fields into collapsible sections for the detail view
const FIELD_SECTIONS = [
  {
    title: 'FICO',
    icon: 'fa-solid fa-chart-line',
    fields: [
      { label: 'Min FICO', manual: 'Min FICO', ai: 'AI: Min FICO' },
      { label: 'Min FICO (Rate-Term)', ai: 'AI: Min FICO (Rate-Term)' },
      { label: 'Min FICO (Cash-Out)', ai: 'AI: Min FICO (Cash-Out)' },
      { label: 'Min FICO (MH)', manual: 'Min FICO (MH)', ai: 'AI: Min FICO (MH)' },
      { label: 'Min FICO (Investment)', ai: 'AI: Min FICO (Investment)' },
      { label: 'Min FICO (2nd Home)', ai: 'AI: Min FICO (2nd Home)' },
      { label: 'Min FICO (FTHB)', ai: 'AI: Min FICO (FTHB)' },
      { label: 'Min FICO (1st Time Investor)', ai: 'AI: Min FICO (1st Time Investor)' },
      { label: 'Min FICO (Manual UW)', ai: 'AI: Min FICO (Manual UW)' },
      { label: 'Min Blended FICO', ai: 'AI: Min Blended FICO' },
      { label: '# of Scores Required', ai: 'AI: # of Scores Required' },
      { label: 'FICO Notes', ai: 'AI: FICO Notes', wide: true },
    ],
  },
  {
    title: 'LTV / CLTV / DTI',
    icon: 'fa-solid fa-percent',
    fields: [
      { label: 'Max LTV (Purch)', manual: 'Max LTV (Purch)', ai: 'AI: Max LTV (Purch)' },
      { label: 'Max LTV (RT)', manual: 'Max LTV (RT)', ai: 'AI: Max LTV (RT)' },
      { label: 'Max LTV (Cash Out)', manual: 'Max LTV (Cash Out)', ai: 'AI: Max LTV (Cash Out)' },
      { label: 'Max LTV (MH)', ai: 'AI: Max LTV (MH)' },
      { label: 'Max LTV (2-4 Units)', ai: 'AI: Max LTV (2-4 Units)' },
      { label: 'LTV Reductions', ai: 'AI: LTV Reductions', wide: true },
      { label: 'Max CLTV', manual: 'Max CLTV', ai: 'AI: Max CLTV' },
      { label: 'Max CLTV (Investment)', ai: 'AI: Max CLTV (Investment)' },
      { label: 'Max CLTV (2nd Homes)', ai: 'AI: Max CLTV (2nd Homes)' },
      { label: 'Max DTI', manual: 'Max DTI', ai: 'AI: Max DTI' },
      { label: 'Max DTI (Manual UW)', ai: 'AI: Max DTI (Manual UW)' },
      { label: 'Manual UW Allowed?', ai: 'AI: Manual UW Allowed?' },
      { label: 'LTV and DTI Notes', ai: 'AI: LTV and DTI Notes', wide: true },
    ],
  },
  {
    title: 'Loan Amounts',
    icon: 'fa-solid fa-dollar-sign',
    fields: [
      { label: 'Min Loan Amount', manual: 'Min Loan Amount', ai: 'AI: Min Loan Amount' },
      { label: 'Max Loan Amount', ai: 'AI: Max Loan Amount' },
      { label: 'Max Cash-Out', ai: 'AI: Max Cash-Out' },
      { label: 'Max Cash-Out (2 Unit)', ai: 'AI: Max Cash-Out (2 Unit)' },
      { label: 'Max Cash Back at Closing (RT Refi)', ai: 'AI: Max Cash Back at Closing (RT Refi)' },
      { label: 'Max Loan (1st Time Investor)', ai: 'AI: Max Loan (1st Time Investor)' },
      { label: 'Loan Amounts Notes', ai: 'AI: Loan Amounts Notes', wide: true },
    ],
  },
  {
    title: 'Borrower Eligibility',
    icon: 'fa-solid fa-user-check',
    fields: [
      { label: 'FTHB Allowed?', manual: 'FTHB Allowed?', ai: 'AI: FTHB Allowed?' },
      { label: 'FTHB Required?', ai: 'AI: FTHB Required?' },
      { label: 'Homebuyer Education Reqd?', ai: 'AI: Homebuyer Education Reqd?' },
      { label: 'Cash-Out Available?', ai: 'AI: Cash-Out Available?' },
      { label: 'Vest in LLC', ai: 'AI: Vest in LLC' },
      { label: 'Gift Funds Allowed', ai: 'AI: Gift Funds Allowed' },
      { label: 'Max Seller Concessions', ai: 'AI: Max Seller Concessions' },
      { label: 'Borrower Requirements Notes', ai: 'AI: Borrower Requirements Notes', wide: true },
    ],
  },
  {
    title: 'Income & Reserves',
    icon: 'fa-solid fa-money-bill-trend-up',
    fields: [
      { label: 'Income Notes', ai: 'AI: Income Notes', wide: true },
      { label: 'Reserves Required', ai: 'AI: Reserves Required' },
      { label: 'Reserves Required (Cash-Out)', ai: 'AI: Reserves Required (Cash-Out)' },
      { label: 'Cash-Out As Reserves Allowed?', ai: 'AI: Cash-Out As Reserves Allowed?' },
      { label: 'Additional Reserves', ai: 'AI: Additional Reserves' },
      { label: 'Reserves Notes', ai: 'AI: Reserves Notes', wide: true },
    ],
  },
  {
    title: 'Investor / Special Eligibility',
    icon: 'fa-solid fa-globe',
    fields: [
      { label: 'First Time Investors Allowed?', ai: 'AI: First Time Investors Allowed?' },
      { label: 'NOCB Allowed?', ai: 'AI: NOCB Allowed?' },
      { label: 'Non-Perm Residents?', ai: 'AI: Non-Perm Residents?' },
      { label: 'Foreign National?', ai: 'AI: Foreign National?' },
      { label: 'ITIN Allowed?', ai: 'AI: ITIN Allowed?' },
      { label: 'DACA Eligible?', ai: 'AI: DACA Eligible?' },
      { label: 'Foreign Credit?', ai: 'AI: Foreign Credit?' },
      { label: 'Perm Resident Aliens', ai: 'AI: Perm Resident Aliens' },
    ],
  },
  {
    title: 'Credit Events & Seasoning',
    icon: 'fa-solid fa-clock-rotate-left',
    fields: [
      { label: 'FC | SS | DIL Seasoning', ai: 'AI: FC | SS | DIL Seasoning' },
      { label: 'Bankruptcy Seasoning', ai: 'AI: Bankruptcy Seasoning' },
      { label: 'Current Bankruptcy', ai: 'AI: Current Bankruptcy' },
      { label: 'Discharged Bankruptcy', ai: 'AI: Discharged Bankruptcy' },
      { label: 'Mortgage Lates', ai: 'AI: Mortgage Lates' },
      { label: 'Ownership Seasoning (Cash-Out)', ai: 'AI: Ownership Seasoning (Cash-Out)' },
      { label: 'Ownership Seasoning (RT)', ai: 'AI: Ownership Seasoning (RT)' },
      { label: 'Asset Seasoning', ai: 'AI: Asset Seasoning' },
      { label: 'Flip Rules', ai: 'AI: Flip Rules' },
    ],
  },
  {
    title: 'Property',
    icon: 'fa-solid fa-house',
    fields: [
      { label: 'PROPERTY TYPES Notes', ai: 'AI: PROPERTY TYPES Notes', wide: true },
      { label: 'Rural Allowed?', ai: 'AI: Rural Allowed?' },
      { label: 'Max Acres', ai: 'AI: Max Acres' },
      { label: 'Max Acres (Investment)', ai: 'AI: Max Acres (Investment)' },
      { label: 'Min Sq Ft', ai: 'AI: Min Sq Ft' },
      { label: 'Max Multi-Units', ai: 'AI: Max Multi-Units' },
      { label: 'Appraisal Transfers', ai: 'AI: Appraisal Transfers' },
      { label: 'Appraisal Waivers?', ai: 'AI: Appraisal Waivers?' },
    ],
  },
  {
    title: 'Financed Properties',
    icon: 'fa-solid fa-building',
    fields: [
      { label: 'Max Financed Properties', ai: 'AI: Max Financed Properties' },
      { label: 'Max Agency Financed', ai: 'AI: Max Agency Financed' },
      { label: 'Max Lender Financed', ai: 'AI: Max Lender Financed' },
      { label: 'Vesting Requirement', ai: 'AI: Vesting Requirement' },
      { label: 'Must Own or Rent?', ai: 'AI: Must Own or Rent?' },
    ],
  },
  {
    title: 'Loan Features',
    icon: 'fa-solid fa-sliders',
    fields: [
      { label: 'Terms Available', ai: 'AI: Terms Available' },
      { label: 'Amortization', ai: 'AI: Amortization' },
      { label: 'Interest Only?', ai: 'AI: Interest Only?' },
      { label: 'Buydowns', ai: 'AI: Buydowns' },
      { label: 'Buydowns Paid By', ai: 'AI: Buydowns Paid By' },
      { label: 'Prepayment Penalty (PPP)', ai: 'AI: Prepayment Penalty (PPP)' },
      { label: 'PPP Terms', ai: 'AI: PPP Terms' },
      { label: 'EPO Timeframe', ai: 'AI: EPO Timeframe' },
    ],
  },
  {
    title: 'Tradelines & Credit',
    icon: 'fa-solid fa-credit-card',
    fields: [
      { label: 'Tradeline Requirements', ai: 'AI: Tradeline Requirements' },
      { label: 'Tradeline Notes', ai: 'AI: Tradeline Notes', wide: true },
      { label: 'Credit Report Type', ai: 'AI: Credit Report Type' },
      { label: 'FEE Notes', ai: 'AI: FEE Notes', wide: true },
    ],
  },
  {
    title: 'DSCR',
    icon: 'fa-solid fa-calculator',
    fields: [
      { label: 'DSCR Min Ratio', ai: 'AI: DSCR Min Ratio' },
      { label: 'DSCR Min Ratio (FTI)', ai: 'AI: DSCR Min Ratio (FTI)' },
      { label: 'DSCR Min Ratio (STR)', ai: 'AI: DSCR Min Ratio (STR)' },
      { label: 'DSCR STR Income?', ai: 'AI: DSCR STR Income?' },
      { label: 'DSCR PPP Options', ai: 'AI: DSCR PPP Options' },
      { label: 'DSCR Primary Home Req', ai: 'AI: DSCR Primary Home Req' },
      { label: 'DSCR Asset Seasoning', ai: 'AI: DSCR Asset Seasoning' },
      { label: 'DSCR Lease Payment?', ai: 'AI: DSCR Lease Payment?' },
      { label: 'DSCR No License States', ai: 'AI: DSCR No License States' },
      { label: 'DSCR Notes', ai: 'AI: DSCR Notes', wide: true },
    ],
  },
  {
    title: 'Fix & Flip',
    icon: 'fa-solid fa-hammer',
    fields: [
      { label: 'FNF Max LTC', ai: 'AI: FNF Max LTC' },
      { label: 'FNF Max LTC (FTI)', ai: 'AI: FNF Max LTC (FTI)' },
      { label: 'FNF ARV', ai: 'AI: FNF ARV' },
      { label: 'FNF LTV Purchase', ai: 'AI: FNF LTV Purchase' },
      { label: 'FNF Interest Rate', ai: 'AI: FNF Interest Rate' },
      { label: 'FNF Experience Required', ai: 'AI: FNF Experience Required' },
      { label: 'FNF Asset Seasoning', ai: 'AI: FNF Asset Seasoning' },
      { label: 'FNF Self Help?', ai: 'AI: FNF Self Help?' },
      { label: 'FNF Origination Fee', ai: 'AI: FNF Origination Fee' },
      { label: 'FNF Min Value Per Property', ai: 'AI: FNF Min Value Per Property' },
      { label: 'FNF % Construction Covered', ai: 'AI: FNF % Construction Covered' },
      { label: 'FNF Vesting', ai: 'AI: FNF Vesting' },
      { label: 'FNF Notes', ai: 'AI: FNF Notes', wide: true },
    ],
  },
  {
    title: 'HELOC',
    icon: 'fa-solid fa-money-check',
    fields: [
      { label: 'HELOC Draw Period', ai: 'AI: HELOC Draw Period' },
      { label: 'HELOC Repay Period', ai: 'AI: HELOC Repay Period' },
      { label: 'HELOC Lien Positions', ai: 'AI: HELOC Lien Positions' },
      { label: 'HELOC Payoff Debt to Qualify?', ai: 'AI: HELOC Payoff Debt to Qualify?' },
      { label: 'HELOC Appraisal AVM', ai: 'AI: HELOC Appraisal AVM' },
      { label: 'HELOC AVM BPO', ai: 'AI: HELOC AVM BPO' },
      { label: 'HELOC Listed Eligible?', ai: 'AI: HELOC Listed Eligible?' },
      { label: 'HELOC Initial Draw', ai: 'AI: HELOC Initial Draw' },
      { label: 'HELOC Origination Fee', ai: 'AI: HELOC Origination Fee' },
      { label: 'HELOC Max Combined Liens', ai: 'AI: HELOC Max Combined Liens' },
      { label: 'HELOC Seasoning Listed', ai: 'AI: HELOC Seasoning Listed' },
    ],
  },
  {
    title: 'Bank Statements',
    icon: 'fa-solid fa-file-invoice',
    fields: [
      { label: 'BS Months', ai: 'AI: BS Months' },
      { label: 'BS Expense Ratio', ai: 'AI: BS Expense Ratio' },
      { label: 'BS Min Expense Ratio', ai: 'AI: BS Min Expense Ratio' },
      { label: 'BS Account Type', ai: 'AI: BS Account Type' },
      { label: 'BS % of Deposits', ai: 'AI: BS % of Deposits' },
      { label: 'BS Co-Mingled?', ai: 'AI: BS Co-Mingled?' },
      { label: 'BS Notes', ai: 'AI: BS Notes', wide: true },
    ],
  },
  {
    title: 'P&L',
    icon: 'fa-solid fa-receipt',
    fields: [
      { label: 'P&L SE Length', ai: 'AI: P&L SE Length' },
      { label: 'P&L Prepared By', ai: 'AI: P&L Prepared By' },
      { label: 'P&L Audited?', ai: 'AI: P&L Audited?' },
      { label: 'P&L Months Bank Stmts', ai: 'AI: P&L Months Bank Stmts' },
      { label: 'P&L Months of P&L', ai: 'AI: P&L Months of P&L' },
      { label: 'P&L Same Line of Work', ai: 'AI: P&L Same Line of Work' },
    ],
  },
  {
    title: 'One-Time Close (OTC)',
    icon: 'fa-solid fa-house-chimney',
    fields: [
      { label: 'OTC Self Builds?', ai: 'AI: OTC Self Builds?' },
      { label: 'OTC Rate Lock', ai: 'AI: OTC Rate Lock' },
      { label: 'OTC Construction Rate', ai: 'AI: OTC Construction Rate' },
      { label: 'OTC Construction Rate (MH)', ai: 'AI: OTC Construction Rate (MH)' },
      { label: 'OTC Construction Period', ai: 'AI: OTC Construction Period' },
      { label: 'OTC Interest During?', ai: 'AI: OTC Interest During?' },
      { label: 'OTC Draw at Closing', ai: 'AI: OTC Draw at Closing' },
      { label: 'OTC Float Down?', ai: 'AI: OTC Float Down?' },
      { label: 'OTC Payments During?', ai: 'AI: OTC Payments During?' },
      { label: 'OTC Contingency', ai: 'AI: OTC Contingency' },
    ],
  },
  {
    title: 'DPA (Down Payment Assistance)',
    icon: 'fa-solid fa-hand-holding-dollar',
    fields: [
      { label: 'DPA % Assistance', ai: 'AI: DPA % Assistance' },
      { label: 'DPA Income Restriction', ai: 'AI: DPA Income Restriction' },
      { label: 'DPA 2nd Lien Rate', ai: 'AI: DPA 2nd Lien Rate' },
      { label: 'DPA Forgivable/Repayable?', ai: 'AI: DPA Forgivable/Repayable?' },
      { label: 'DPA Forgivable After', ai: 'AI: DPA Forgivable After' },
      { label: 'DPA Monthly Payments?', ai: 'AI: DPA Monthly Payments?' },
      { label: 'DPA Term', ai: 'AI: DPA Term' },
      { label: 'DPA Notes', ai: 'AI: DPA Notes', wide: true },
    ],
  },
  {
    title: '1099 / Asset Utilization',
    icon: 'fa-solid fa-file-lines',
    fields: [
      { label: '1099 Years', ai: 'AI: 1099 Years' },
      { label: '1099 Expense Factor', ai: 'AI: 1099 Expense Factor' },
      { label: 'Asset Util Months Divided By', ai: 'AI: Asset Util Months Divided By' },
    ],
  },
];

// ─── CONFLICT DETECTION ─────────────────────────────────────────────────────
// Normalize values for comparison (strip whitespace, emoji, percent formatting)
function normalizeForCompare(val) {
  if (!val) return '';
  return String(val)
    .trim()
    .toLowerCase()
    .replace(/[🟢🟡🔴\s]+/g, ' ')  // Remove status emojis
    .replace(/\s+/g, ' ')            // Collapse whitespace
    .trim();
}

function valuesConflict(manualVal, aiVal) {
  if (!manualVal || !aiVal) return false;  // No conflict if one is missing
  return normalizeForCompare(manualVal) !== normalizeForCompare(aiVal);
}

// ─── DETAIL SECTION (side-by-side comparison table) ─────────────────────────
function DetailSection({ section, fields }) {
  const [expanded, setExpanded] = useState(true);

  // Check if any field in this section has data
  const hasData = section.fields.some(f => {
    const aiVal = f.ai ? fields[f.ai] : null;
    const manualVal = f.manual ? fields[f.manual] : null;
    return (aiVal && aiVal !== '—' && aiVal !== '') || (manualVal && manualVal !== '—' && manualVal !== '');
  });

  if (!hasData) return null;

  // Count conflicts in this section
  const conflictCount = section.fields.filter(f => {
    const aiVal = f.ai ? fields[f.ai] : null;
    const manualVal = f.manual ? fields[f.manual] : null;
    return valuesConflict(manualVal, aiVal);
  }).length;

  // Check if any field in this section has both manual and AI values
  const hasComparisons = section.fields.some(f => f.manual && f.ai);

  return (
    <div className="detail-section">
      <button className="section-header" onClick={() => setExpanded(!expanded)}>
        <span className="section-title">
          <i className={section.icon}></i>
          {section.title}
          {conflictCount > 0 && (
            <span className="conflict-badge">{conflictCount} conflict{conflictCount > 1 ? 's' : ''}</span>
          )}
        </span>
        <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'}`}></i>
      </button>
      {expanded && (
        <div className="section-fields">
          {/* Column headers for sections that have comparisons */}
          {hasComparisons && (
            <div className="compare-header">
              <div className="compare-col-label">Field</div>
              <div className="compare-col-current">Current</div>
              <div className="compare-col-ai">AI (New)</div>
            </div>
          )}
          {section.fields.map((field, idx) => {
            const aiVal = field.ai ? fields[field.ai] : null;
            const manualVal = field.manual ? fields[field.manual] : null;
            // Skip fields with no data
            if ((!aiVal || aiVal === '') && (!manualVal || manualVal === '')) return null;

            const hasConflict = valuesConflict(manualVal, aiVal);
            // If this field has a manual counterpart, always show both columns
            const isComparisonField = !!field.manual;

            return (
              <div key={idx} className={`compare-row ${hasConflict ? 'compare-conflict' : ''} ${field.wide ? 'compare-wide' : ''}`}>
                <div className="compare-label">
                  {field.label}
                  {hasConflict && <i className="fa-solid fa-triangle-exclamation conflict-icon"></i>}
                </div>
                {isComparisonField ? (
                  <>
                    <div className={`compare-current ${hasConflict ? 'conflict-cell' : manualVal && aiVal ? 'match-cell' : ''}`}>
                      {manualVal ? (
                        <span className="compare-value">{manualVal}</span>
                      ) : (
                        <span className="compare-empty">Empty</span>
                      )}
                    </div>
                    <div className={`compare-ai ${hasConflict ? 'conflict-cell' : manualVal && aiVal ? 'match-cell' : ''}`}>
                      {aiVal ? (
                        <span className="compare-value">{aiVal}</span>
                      ) : (
                        <span className="compare-empty">Empty</span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="compare-single">
                    {aiVal && (
                      <div className="single-value">
                        <span className="field-tag ai-tag">AI</span>
                        <span className="compare-value">{aiVal}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── DETAIL PANEL ───────────────────────────────────────────────────────────
function DetailPanel({ record, onStatusChange, statusUpdating }) {
  const f = record.fields;
  const productName = f['Lender and product and version'] || f['Lender Product Name | Version (Final)'] || 'Untitled';
  const status = f['AI: Review Status'] || '';
  const lastRun = f['AI: Last Run Date'];
  const confidence = f['AI: Confidence'];
  const lenderProductName = f['Lender Product Name | Version (Final)'] || f['Lender Product Name | Version'] || '';
  const analysisSummary = f['AI: Analysis Summary'] || '';
  const matrixDocs = f['Matrix Document'] || [];
  const matrixUrl = f['Matrix'];
  const productStatus = f['Product Status'] || '';
  const airtableLink = f['Link to this Airtable LOAN (Formula)'] || `https://airtable.com/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${record.id}`;

  return (
    <div className="detail-panel">
      {/* Header */}
      <div className="detail-header">
        <h1 className="detail-title">{productName}</h1>
        <div className="detail-meta">
          {productStatus && <span className="product-status">{productStatus}</span>}
          {lenderProductName && lenderProductName !== productName && (
            <span className="lender-product-name">{lenderProductName}</span>
          )}
        </div>
      </div>

      <div className="detail-divider"></div>

      {/* Top fields */}
      <div className="detail-top-fields">
        {/* AI Review Status — editable dropdown */}
        <div className="top-field">
          <label className="top-field-label">AI: Review Status</label>
          <div className="status-select-wrapper">
            <select
              className="status-select"
              value={status}
              onChange={(e) => onStatusChange(record.id, e.target.value)}
              disabled={statusUpdating}
              style={{
                backgroundColor: STATUS_COLORS[status]?.bg || '#f3f4f6',
                color: STATUS_COLORS[status]?.text || '#374151',
                borderColor: STATUS_COLORS[status]?.border || '#e5e7eb',
              }}
            >
              <option value="">—</option>
              {STATUS_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            {statusUpdating && <i className="fa-solid fa-spinner fa-spin status-spinner"></i>}
          </div>
        </div>

        {/* Matrix Document */}
        <div className="top-field">
          <label className="top-field-label">Matrix Document</label>
          {matrixDocs.length > 0 ? (
            <div className="matrix-docs">
              {matrixDocs.map((doc, idx) => (
                <a key={idx} href={doc.url} target="_blank" rel="noopener noreferrer" className="matrix-doc-link">
                  {doc.thumbnails?.small?.url && (
                    <img src={doc.thumbnails.small.url} alt={doc.filename} className="matrix-thumbnail" />
                  )}
                  <span className="matrix-filename">{doc.filename}</span>
                </a>
              ))}
            </div>
          ) : matrixUrl ? (
            <a href={matrixUrl} target="_blank" rel="noopener noreferrer" className="matrix-url-link">
              <i className="fa-solid fa-external-link-alt"></i> Open Matrix
            </a>
          ) : (
            <span className="no-data">—</span>
          )}
        </div>

        {/* Link to Airtable */}
        <div className="top-field">
          <label className="top-field-label">Link to Airtable Record</label>
          <a href={airtableLink} target="_blank" rel="noopener noreferrer" className="airtable-link">
            <i className="fa-solid fa-external-link-alt"></i> Open in Airtable
          </a>
        </div>

        {/* Last Run & Confidence */}
        <div className="top-field-row">
          <div className="top-field">
            <label className="top-field-label">AI: Last Run Date</label>
            <span className="top-field-value">
              {lastRun ? new Date(lastRun).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
            </span>
          </div>
          <div className="top-field">
            <label className="top-field-label">AI: Confidence</label>
            <span className="top-field-value">{confidence || '—'}</span>
          </div>
        </div>

        {/* Analysis Summary */}
        {analysisSummary && (
          <div className="top-field">
            <label className="top-field-label">AI: Analysis Summary</label>
            <div className="analysis-summary">{analysisSummary}</div>
          </div>
        )}
      </div>

      <div className="detail-divider"></div>

      {/* AI field sections */}
      {FIELD_SECTIONS.map((section, idx) => (
        <DetailSection key={idx} section={section} fields={f} />
      ))}

      {/* Source data (collapsed by default) */}
      {(f['Extracted Text'] || f['AI JSON Output'] || f['Notes']) && (
        <SourceDataSection fields={f} />
      )}

      {/* Links */}
      {(f['Flyer | Info Page'] || f['Pricing'] || f['Guidelines'] || f['Matrix']) && (
        <div className="detail-section">
          <div className="section-header">
            <span className="section-title">
              <i className="fa-solid fa-link"></i>
              Links
            </span>
          </div>
          <div className="section-fields links-section">
            {f['Flyer | Info Page'] && <a href={f['Flyer | Info Page']} target="_blank" rel="noopener noreferrer" className="detail-link"><i className="fa-solid fa-file"></i> Flyer / Info Page</a>}
            {f['Pricing'] && <a href={f['Pricing']} target="_blank" rel="noopener noreferrer" className="detail-link"><i className="fa-solid fa-tag"></i> Pricing</a>}
            {f['Guidelines'] && <a href={f['Guidelines']} target="_blank" rel="noopener noreferrer" className="detail-link"><i className="fa-solid fa-book"></i> Guidelines</a>}
            {f['Matrix'] && <a href={f['Matrix']} target="_blank" rel="noopener noreferrer" className="detail-link"><i className="fa-solid fa-table"></i> Matrix</a>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SOURCE DATA SECTION ────────────────────────────────────────────────────
function SourceDataSection({ fields }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="detail-section">
      <button className="section-header" onClick={() => setExpanded(!expanded)}>
        <span className="section-title">
          <i className="fa-solid fa-code"></i>
          Source Data
        </span>
        <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'}`}></i>
      </button>
      {expanded && (
        <div className="section-fields">
          {fields['Notes'] && (
            <div className="field-row field-wide">
              <div className="field-label">Notes</div>
              <div className="field-values">
                <pre className="source-data-pre">{fields['Notes']}</pre>
              </div>
            </div>
          )}
          {fields['Extracted Text'] && (
            <div className="field-row field-wide">
              <div className="field-label">Extracted Text</div>
              <div className="field-values">
                <pre className="source-data-pre">{fields['Extracted Text']}</pre>
              </div>
            </div>
          )}
          {fields['AI JSON Output'] && (
            <div className="field-row field-wide">
              <div className="field-label">AI JSON Output</div>
              <div className="field-values">
                <pre className="source-data-pre">{fields['AI JSON Output']}</pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── AIRTABLE IDs (for link building) ───────────────────────────────────────
const AIRTABLE_BASE_ID = 'appuJgI9X93OLaf0u';
const AIRTABLE_TABLE_ID = 'tblVSU5z4WSxreX7l';

// ─── MAIN APP ───────────────────────────────────────────────────────────────
export default function App() {
  // List state
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nextOffset, setNextOffset] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filter/search state
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Detail state
  const [selectedId, setSelectedId] = useState(null);
  const [detailRecord, setDetailRecord] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Debounce timer for search
  const searchTimer = useRef(null);

  // ─── FETCH LIST ─────────────────────────────────────────────────────────
  const fetchRecords = useCallback(async (offsetParam = '', append = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      let url = `${API_BASE}/api/list-records?`;
      if (statusFilter) url += `status=${encodeURIComponent(statusFilter)}&`;
      if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`;
      if (offsetParam) url += `offset=${encodeURIComponent(offsetParam)}&`;

      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      if (append) {
        setRecords(prev => [...prev, ...data.records]);
      } else {
        setRecords(data.records);
      }
      setNextOffset(data.offset);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [statusFilter, searchQuery]);

  // Initial load and when filters change
  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // ─── FETCH DETAIL ───────────────────────────────────────────────────────
  const fetchDetail = useCallback(async (recordId) => {
    setDetailLoading(true);
    try {
      const url = `${API_BASE}/api/list-records?recordId=${encodeURIComponent(recordId)}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDetailRecord(data.record);
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // When a record is selected, fetch its full detail
  useEffect(() => {
    if (selectedId) {
      fetchDetail(selectedId);
    } else {
      setDetailRecord(null);
    }
  }, [selectedId, fetchDetail]);

  // ─── UPDATE STATUS ──────────────────────────────────────────────────────
  const handleStatusChange = async (recordId, newStatus) => {
    setStatusUpdating(true);
    try {
      const res = await fetch(`${API_BASE}/api/update-record`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          recordId,
          fields: { 'AI: Review Status': newStatus },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Update the record in the list
      setRecords(prev => prev.map(r =>
        r.id === recordId
          ? { ...r, fields: { ...r.fields, 'AI: Review Status': newStatus } }
          : r
      ));

      // Update the detail record too
      if (detailRecord && detailRecord.id === recordId) {
        setDetailRecord(prev => ({
          ...prev,
          fields: { ...prev.fields, 'AI: Review Status': newStatus },
        }));
      }
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    } finally {
      setStatusUpdating(false);
    }
  };

  // ─── SEARCH DEBOUNCE ───────────────────────────────────────────────────
  const handleSearchInput = (e) => {
    const val = e.target.value;
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearchQuery(val);
    }, 400);
  };

  // ─── STATUS COUNTS ─────────────────────────────────────────────────────
  // We show counts from the current loaded records (not a separate API call)
  const statusCounts = {};
  records.forEach(r => {
    const s = r.fields['AI: Review Status'] || 'No Status';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  // ─── RENDER ─────────────────────────────────────────────────────────────
  return (
    <div className="matrix-review-app">
      {/* Header */}
      <div className="app-header">
        <h1 className="app-title">
          <i className="fa-solid fa-robot"></i>
          AI Matrix Review
        </h1>
        <p className="app-subtitle">Review and approve AI-extracted loan product data</p>
      </div>

      <div className="app-layout">
        {/* Left panel — record list */}
        <div className="list-panel">
          {/* Search bar */}
          <div className="list-search">
            <i className="fa-solid fa-magnifying-glass search-icon"></i>
            <input
              type="text"
              placeholder="Search products..."
              value={searchInput}
              onChange={handleSearchInput}
              className="search-input"
            />
          </div>

          {/* Status filter tabs */}
          <div className="status-filters">
            <button
              className={`filter-btn ${statusFilter === '' ? 'active' : ''}`}
              onClick={() => setStatusFilter('')}
            >
              All
            </button>
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt}
                className={`filter-btn ${statusFilter === opt ? 'active' : ''}`}
                onClick={() => setStatusFilter(statusFilter === opt ? '' : opt)}
              >
                {opt}
              </button>
            ))}
          </div>

          {/* Record list */}
          {loading ? (
            <div className="list-loading">
              <i className="fa-solid fa-spinner fa-spin"></i>
              <span>Loading records...</span>
            </div>
          ) : error ? (
            <div className="list-error">
              <i className="fa-solid fa-circle-exclamation"></i>
              <span>{error}</span>
              <button onClick={() => fetchRecords()} className="retry-btn">Retry</button>
            </div>
          ) : records.length === 0 ? (
            <div className="list-empty">
              <i className="fa-solid fa-inbox"></i>
              <span>No records found</span>
            </div>
          ) : (
            <>
              <div className="record-count">{records.length} records{nextOffset ? '+' : ''}</div>
              <div className="record-list">
                {records.map(record => {
                  const name = record.fields['Lender and product and version'] || 'Untitled';
                  const status = record.fields['AI: Review Status'] || '';
                  const isSelected = selectedId === record.id;

                  return (
                    <button
                      key={record.id}
                      className={`record-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedId(record.id)}
                    >
                      <div className="record-name">{name}</div>
                      {status && <StatusBadge status={status} small />}
                    </button>
                  );
                })}
              </div>

              {/* Load more */}
              {nextOffset && (
                <button
                  className="load-more-btn"
                  onClick={() => fetchRecords(nextOffset, true)}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <><i className="fa-solid fa-spinner fa-spin"></i> Loading...</>
                  ) : (
                    'Load More'
                  )}
                </button>
              )}
            </>
          )}
        </div>

        {/* Right panel — detail view */}
        <div className="detail-container">
          {!selectedId ? (
            <div className="detail-empty">
              <i className="fa-solid fa-arrow-left"></i>
              <span>Select a record to view details</span>
            </div>
          ) : detailLoading ? (
            <div className="detail-loading">
              <i className="fa-solid fa-spinner fa-spin"></i>
              <span>Loading record...</span>
            </div>
          ) : detailRecord ? (
            <DetailPanel
              record={detailRecord}
              onStatusChange={handleStatusChange}
              statusUpdating={statusUpdating}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
