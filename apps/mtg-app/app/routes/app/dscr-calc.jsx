import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router";
import { getUserEmail, getUserPlan } from "../../lib/auth";

export function meta() {
  return [{ title: "DSCR Calculator — MtgBroker" }];
}

/* ================================================
   CONFIGURATION
   ================================================ */
const API_BASE = "https://mtg-broker-api.rich-e00.workers.dev";
const CALC_TYPE = "DSCR Calculator";

/* ================================================
   FORMATTING HELPERS
   ================================================ */
const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtDec = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

function parseRaw(val) {
  if (!val) return 0;
  return parseFloat(String(val).replace(/,/g, "")) || 0;
}

/** Allows math like 80000/12 or 4500+600 in numeric fields */
function evaluateExpression(value) {
  if (!value || typeof value !== "string") return NaN;
  const cleaned = value.replace(/,/g, "").replace(/\$/g, "").trim();
  if (!cleaned) return NaN;
  if (!/^[\d.+\-*/() ]+$/.test(cleaned)) return NaN;
  try {
    const result = Function('"use strict"; return (' + cleaned + ")")();
    if (typeof result === "number" && isFinite(result) && result >= 0) {
      return Math.round(result * 100) / 100;
    }
  } catch {}
  return NaN;
}

/** Format a number string with commas (for currency display in inputs) */
function formatNumberString(val) {
  if (!val) return "";
  const clean = String(val).replace(/[^\d.]/g, "");
  if (!clean) return "";
  const parts = clean.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

function escapeHtml(s) {
  return s ? s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") : "";
}

/** Empty-field yellow highlight class helper */
const emptyClass = (val) => (!String(val).trim() ? " field-empty" : "");

/* ================================================
   MAIN COMPONENT
   ================================================ */
export default function DSCRCalculator() {
  /* --- Auth --- */
  const [userEmail, setUserEmail] = useState("");
  const [userPlanName, setUserPlanName] = useState("LITE");
  useEffect(() => {
    setUserEmail(getUserEmail() || "");
    setUserPlanName(getUserPlan() || "LITE");
  }, []);
  const saveLimit = useMemo(() => ({ LITE: 0, PLUS: 10, PRO: Infinity })[userPlanName] || 0, [userPlanName]);

  /* --- Save/load state --- */
  const [saveStatus, setSaveStatus] = useState({ state: "", text: "Ready" });
  const [currentScenarioId, setCurrentScenarioId] = useState(null);
  const [currentSaveCount, setCurrentSaveCount] = useState(0);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [scenarios, setScenarios] = useState([]);
  const [loadingScenarios, setLoadingScenarios] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTargetId, setRenameTargetId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  /* --- Form state: Scenario Details --- */
  const [scenName, setScenName] = useState("");
  const [scenDate, setScenDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [borName, setBorName] = useState("");

  /* --- Form state: Property & Loan Details --- */
  const [propAddress, setPropAddress] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [downPct, setDownPct] = useState("25");
  const [downAmt, setDownAmt] = useState("");
  const [intRate, setIntRate] = useState("");
  const [loanTerm, setLoanTerm] = useState("360");
  const [rateType, setRateType] = useState("Fixed");

  /* --- Form state: Rental Income --- */
  const [monthlyRent, setMonthlyRent] = useState("");
  const [rentSource, setRentSource] = useState("Market Rent (Appraisal)");

  /* --- Form state: Insurance, Taxes & HOA (Insurance BEFORE Tax!) --- */
  const [annualIns, setAnnualIns] = useState("");
  const [annualTax, setAnnualTax] = useState("");
  const [monthlyHOA, setMonthlyHOA] = useState("");
  const [monthlyFlood, setMonthlyFlood] = useState("");

  /* ==============================================
     LINKED DOWN PAYMENT LOGIC
     ============================================== */
  // When % changes -> recalculate $ from price
  const handleDownPctChange = useCallback((val) => {
    setDownPct(val);
    const price = parseRaw(purchasePrice);
    const pct = parseFloat(val) || 0;
    if (price > 0) {
      setDownAmt(formatNumberString(String(Math.round(price * pct / 100))));
    }
  }, [purchasePrice]);

  // When $ changes -> recalculate % from price
  const handleDownAmtChange = useCallback((val) => {
    // Allow math operators to pass through without formatting
    if (/[+\-*/]/.test(val.replace(/,/g, ""))) {
      setDownAmt(val);
    } else {
      setDownAmt(formatNumberString(val));
    }
    const price = parseRaw(purchasePrice);
    const amt = parseRaw(val);
    if (price > 0 && amt >= 0) {
      setDownPct(((amt / price) * 100).toFixed(2));
    }
  }, [purchasePrice]);

  // When price changes -> recalculate $ from %
  const handlePriceChange = useCallback((val) => {
    if (/[+\-*/]/.test(val.replace(/,/g, ""))) {
      setPurchasePrice(val);
    } else {
      setPurchasePrice(formatNumberString(val));
    }
    const price = parseRaw(val);
    const pct = parseFloat(downPct) || 0;
    if (price > 0) {
      setDownAmt(formatNumberString(String(Math.round(price * pct / 100))));
    }
  }, [downPct]);

  /* ==============================================
     CALCULATIONS
     ============================================== */
  const results = useMemo(() => {
    const price = parseRaw(purchasePrice);
    const dpAmt = parseRaw(downAmt);
    const loanAmount = Math.max(0, price - dpAmt);
    const rate = parseFloat(intRate) || 0;
    const termMonths = parseInt(loanTerm) || 360;
    const rent = parseRaw(monthlyRent);
    const insAnnual = parseRaw(annualIns);
    const taxAnnual = parseRaw(annualTax);
    const hoa = parseRaw(monthlyHOA);
    const flood = parseRaw(monthlyFlood);

    // P&I calculation
    let pi = 0;
    if (loanAmount > 0 && rate > 0) {
      if (rateType === "Interest Only") {
        pi = loanAmount * (rate / 100) / 12;
      } else {
        const r = (rate / 100) / 12;
        const n = termMonths;
        pi = loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
      }
    } else if (loanAmount > 0 && rate === 0 && termMonths > 0) {
      pi = loanAmount / termMonths;
    }

    const monthlyIns = insAnnual / 12;
    const monthlyTax = taxAnnual / 12;

    // PITIA = P&I + Insurance/12 + Tax/12 + HOA + Flood
    const pitia = pi + monthlyIns + monthlyTax + hoa + flood;

    // DSCR = Monthly Rent / PITIA
    const dscr = pitia > 0 ? rent / pitia : 0;

    // Cash Flow = Rent - PITIA
    const cashFlow = rent - pitia;

    // LTV
    const ltv = price > 0 ? (loanAmount / price) * 100 : 0;

    return {
      loanAmount, pi, monthlyIns, monthlyTax, hoa, flood, pitia,
      dscr, cashFlow, ltv, rent, price,
    };
  }, [purchasePrice, downAmt, intRate, loanTerm, rateType, monthlyRent, annualIns, annualTax, monthlyHOA, monthlyFlood]);

  /* ==============================================
     FIELD HANDLERS (expression eval, formatting)
     ============================================== */
  // Currency field blur: evaluate expression, then format with commas
  const handleCurrencyBlur = useCallback((value, setter) => {
    if (value && /[+\-*/]/.test(value.replace(/,/g, ""))) {
      const result = evaluateExpression(value);
      if (!isNaN(result)) { setter(formatNumberString(String(result))); return; }
    }
    setter(formatNumberString(value));
  }, []);

  // Currency input: live comma formatting (skip when math operators present)
  const handleCurrencyInput = useCallback((val, setter) => {
    if (/[+\-*/]/.test(val.replace(/,/g, ""))) {
      setter(val);
    } else {
      setter(formatNumberString(val));
    }
  }, []);

  // Rate field: format to 3 decimal places on blur
  const handleRateBlur = useCallback(() => {
    if (intRate && /[+\-*/]/.test(intRate.replace(/,/g, ""))) {
      const result = evaluateExpression(intRate);
      if (!isNaN(result)) { setIntRate(result.toFixed(3)); return; }
    }
    const parsed = parseFloat(intRate);
    if (!isNaN(parsed)) setIntRate(parsed.toFixed(3));
  }, [intRate]);

  // Enter key handler for calc fields
  const handleCalcFieldKeyDown = useCallback((e, value, setter, type) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (type === "rate") {
        handleRateBlur();
      } else if (type === "currency") {
        handleCurrencyBlur(value, setter);
      }
      e.target.blur();
    }
  }, [handleRateBlur, handleCurrencyBlur]);

  // Down payment $ blur (also recompute %)
  const handleDownAmtBlur = useCallback(() => {
    const raw = downAmt;
    let finalVal = raw;
    if (raw && /[+\-*/]/.test(raw.replace(/,/g, ""))) {
      const result = evaluateExpression(raw);
      if (!isNaN(result)) finalVal = String(result);
    }
    const formatted = formatNumberString(finalVal);
    setDownAmt(formatted);
    const price = parseRaw(purchasePrice);
    const amt = parseRaw(finalVal);
    if (price > 0 && amt >= 0) {
      setDownPct(((amt / price) * 100).toFixed(2));
    }
  }, [downAmt, purchasePrice]);

  // Price blur (also recompute down $)
  const handlePriceBlur = useCallback(() => {
    let val = purchasePrice;
    if (val && /[+\-*/]/.test(val.replace(/,/g, ""))) {
      const result = evaluateExpression(val);
      if (!isNaN(result)) val = String(result);
    }
    const formatted = formatNumberString(val);
    setPurchasePrice(formatted);
    const price = parseRaw(val);
    const pct = parseFloat(downPct) || 0;
    if (price > 0) {
      setDownAmt(formatNumberString(String(Math.round(price * pct / 100))));
    }
  }, [purchasePrice, downPct]);

  /* ==============================================
     SAVE / LOAD / DELETE / RENAME / CLEAR / PRINT
     ============================================== */
  const collectFormData = useCallback(() => ({
    meta: { name: scenName, date: scenDate, borrower: borName },
    property: { address: propAddress, purchasePrice, downPct, downAmt, intRate, loanTerm, rateType },
    income: { monthlyRent, rentSource },
    expenses: { annualIns, annualTax, monthlyHOA, monthlyFlood },
  }), [scenName, scenDate, borName, propAddress, purchasePrice, downPct, downAmt, intRate, loanTerm, rateType, monthlyRent, rentSource, annualIns, annualTax, monthlyHOA, monthlyFlood]);

  const populateForm = useCallback((data) => {
    if (!data) return;
    if (data.meta) {
      if (data.meta.name) setScenName(data.meta.name);
      if (data.meta.date) setScenDate(data.meta.date);
      if (data.meta.borrower) setBorName(data.meta.borrower);
    }
    if (data.property) {
      const p = data.property;
      if (p.address) setPropAddress(p.address);
      if (p.purchasePrice) setPurchasePrice(p.purchasePrice);
      if (p.downPct) setDownPct(p.downPct);
      if (p.downAmt) setDownAmt(p.downAmt);
      if (p.intRate) setIntRate(p.intRate);
      if (p.loanTerm) setLoanTerm(p.loanTerm);
      if (p.rateType) setRateType(p.rateType);
    }
    if (data.income) {
      if (data.income.monthlyRent) setMonthlyRent(data.income.monthlyRent);
      if (data.income.rentSource) setRentSource(data.income.rentSource);
    }
    if (data.expenses) {
      const x = data.expenses;
      if (x.annualIns) setAnnualIns(x.annualIns);
      if (x.annualTax) setAnnualTax(x.annualTax);
      if (x.monthlyHOA !== undefined) setMonthlyHOA(x.monthlyHOA);
      if (x.monthlyFlood !== undefined) setMonthlyFlood(x.monthlyFlood);
    }
  }, []);

  /* --- Save --- */
  const saveScenario = useCallback(async () => {
    if (!scenName.trim()) { alert("Please enter a Scenario Name."); return; }
    if (!userEmail) { alert("Please log in to save scenarios."); return; }
    if (!currentScenarioId && saveLimit !== Infinity && currentSaveCount >= saveLimit) {
      alert(saveLimit === 0 ? "Saving requires PLUS or PRO plan. Upgrade to start saving!" : `You've reached your save limit (${saveLimit} scenarios). Upgrade to PRO for unlimited saves.`);
      return;
    }
    setSaveStatus({ state: "saving", text: "Saving..." });
    try {
      const url = currentScenarioId ? `${API_BASE}/api/calculator-scenarios/${currentScenarioId}` : `${API_BASE}/api/calculator-scenarios`;
      const method = currentScenarioId ? "PUT" : "POST";
      const response = await fetch(url, {
        method, headers: { Authorization: "Bearer " + userEmail, "Content-Type": "application/json" },
        body: JSON.stringify({ calculatorType: CALC_TYPE, scenarioName: scenName.trim(), scenarioData: collectFormData() }),
      });
      const result = await response.json();
      if (response.ok && result.scenario) {
        setCurrentScenarioId(result.scenario.id);
        if (method === "POST") setCurrentSaveCount((c) => c + 1);
        setSaveStatus({ state: "saved", text: "Saved" });
      } else { setSaveStatus({ state: "error", text: result.error || "Save failed" }); }
    } catch { setSaveStatus({ state: "error", text: "Connection error" }); }
  }, [scenName, userEmail, currentScenarioId, saveLimit, currentSaveCount, collectFormData]);

  /* --- Load modal --- */
  const openLoadModal = useCallback(async () => {
    setShowLoadModal(true); setLoadingScenarios(true);
    if (!userEmail) { setLoadingScenarios(false); return; }
    try {
      const response = await fetch(`${API_BASE}/api/calculator-scenarios?type=${encodeURIComponent(CALC_TYPE)}`, { headers: { Authorization: "Bearer " + userEmail } });
      const data = await response.json();
      setScenarios(data.scenarios || []); setCurrentSaveCount((data.scenarios || []).length);
    } catch { setScenarios([]); }
    setLoadingScenarios(false);
  }, [userEmail]);

  const loadScenario = useCallback(async (scenarioId) => {
    setSaveStatus({ state: "loading", text: "Loading..." }); setShowLoadModal(false);
    try {
      const response = await fetch(`${API_BASE}/api/calculator-scenarios?type=${encodeURIComponent(CALC_TYPE)}`, { headers: { Authorization: "Bearer " + userEmail } });
      const data = await response.json();
      const scenario = (data.scenarios || []).find((s) => s.id === scenarioId);
      if (scenario && scenario.scenarioData) {
        setCurrentScenarioId(scenario.id); populateForm(scenario.scenarioData);
        setSaveStatus({ state: "saved", text: "Loaded: " + scenario.scenarioName });
      } else { setSaveStatus({ state: "error", text: "Scenario not found" }); }
    } catch { setSaveStatus({ state: "error", text: "Error loading scenario" }); }
  }, [userEmail, populateForm]);

  const deleteScenario = useCallback(async (scenarioId, name) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      const response = await fetch(`${API_BASE}/api/calculator-scenarios/${scenarioId}`, { method: "DELETE", headers: { Authorization: "Bearer " + userEmail } });
      if (response.ok) {
        if (currentScenarioId === scenarioId) { setCurrentScenarioId(null); setSaveStatus({ state: "", text: "Ready" }); }
        openLoadModal();
      } else { alert("Delete failed."); }
    } catch { alert("Delete failed."); }
  }, [userEmail, currentScenarioId, openLoadModal]);

  const startRename = useCallback((id, name) => { setRenameTargetId(id); setRenameValue(name); setShowRenameModal(true); }, []);
  const confirmRename = useCallback(async () => {
    if (!renameValue.trim()) { alert("Please enter a name."); return; }
    try {
      const response = await fetch(`${API_BASE}/api/calculator-scenarios/${renameTargetId}`, {
        method: "PUT", headers: { Authorization: "Bearer " + userEmail, "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioName: renameValue.trim() }),
      });
      if (response.ok) {
        if (currentScenarioId === renameTargetId) setScenName(renameValue.trim());
        setShowRenameModal(false); setRenameTargetId(null); openLoadModal();
      } else { alert("Rename failed."); }
    } catch { alert("Rename failed."); }
  }, [renameValue, renameTargetId, userEmail, currentScenarioId, openLoadModal]);

  /* --- Clear --- */
  const clearForm = useCallback(() => {
    if (!confirm("Clear all fields and start fresh?")) return;
    setCurrentScenarioId(null);
    setScenName(""); setScenDate(new Date().toISOString().split("T")[0]); setBorName("");
    setPropAddress(""); setPurchasePrice(""); setDownPct("25"); setDownAmt("");
    setIntRate(""); setLoanTerm("360"); setRateType("Fixed");
    setMonthlyRent(""); setRentSource("Market Rent (Appraisal)");
    setAnnualIns(""); setAnnualTax(""); setMonthlyHOA(""); setMonthlyFlood("");
    setSaveStatus({ state: "", text: "Ready" });
  }, []);

  /* --- Print --- */
  const printSummary = useCallback(() => {
    const name = scenName.trim() || "Untitled";
    const borrower = borName.trim() || "\u2014";
    const address = propAddress.trim() || "\u2014";
    let dateDisplay = "\u2014";
    if (scenDate) { try { dateDisplay = new Date(scenDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); } catch {} }

    const r = results;

    document.getElementById("printScenarioInfo").innerHTML =
      `<div><div class="print-info-label">Scenario</div><div class="print-info-value">${escapeHtml(name)}</div></div>` +
      `<div><div class="print-info-label">Borrower</div><div class="print-info-value">${escapeHtml(borrower)}</div></div>` +
      `<div><div class="print-info-label">Property</div><div class="print-info-value">${escapeHtml(address)}</div></div>` +
      `<div><div class="print-info-label">Date</div><div class="print-info-value">${dateDisplay}</div></div>`;

    // Property & Loan Details table
    const termLabel = { "360": "30 Years", "180": "15 Years", "240": "20 Years", "300": "25 Years", "120": "10 Years" }[loanTerm] || loanTerm + " mo";
    document.getElementById("printPropertyTable").innerHTML =
      `<tr><td>Purchase Price</td><td>${fmt(r.price)}</td></tr>` +
      `<tr><td>Down Payment</td><td>${fmt(parseRaw(downAmt))} (${parseFloat(downPct) || 0}%)</td></tr>` +
      `<tr><td>Loan Amount</td><td>${fmt(r.loanAmount)}</td></tr>` +
      `<tr><td>Interest Rate</td><td>${(parseFloat(intRate) || 0).toFixed(3)}%</td></tr>` +
      `<tr><td>Loan Term</td><td>${termLabel}</td></tr>` +
      `<tr><td>Rate Type</td><td>${rateType}</td></tr>` +
      `<tr><td>LTV</td><td>${r.ltv.toFixed(1)}%</td></tr>`;

    // PITIA breakdown (Insurance BEFORE Tax)
    document.getElementById("printPITIATable").innerHTML =
      `<tr><td>Principal &amp; Interest</td><td>${fmtDec(r.pi)}</td></tr>` +
      `<tr><td>Homeowner's Insurance</td><td>${fmtDec(r.monthlyIns)}</td></tr>` +
      `<tr><td>Property Tax</td><td>${fmtDec(r.monthlyTax)}</td></tr>` +
      `<tr><td>HOA / Condo Fees</td><td>${fmtDec(r.hoa)}</td></tr>` +
      `<tr><td>Flood Insurance</td><td>${fmtDec(r.flood)}</td></tr>` +
      `<tr class="print-total-row"><td>Total PITIA</td><td>${fmtDec(r.pitia)}</td></tr>`;

    // Results bar
    const dscrVal = r.dscr.toFixed(3);
    const cfColor = r.cashFlow >= 0 ? "green" : "red";
    document.getElementById("printResultsBar").innerHTML =
      `<div class="print-result-card"><div class="print-result-label">DSCR Ratio</div><div class="print-result-value blue">${dscrVal}x</div></div>` +
      `<div class="print-result-card"><div class="print-result-label">Monthly Rent</div><div class="print-result-value green">${fmt(r.rent)}</div></div>` +
      `<div class="print-result-card"><div class="print-result-label">Monthly PITIA</div><div class="print-result-value blue">${fmtDec(r.pitia)}</div></div>` +
      `<div class="print-result-card"><div class="print-result-label">Cash Flow</div><div class="print-result-value ${cfColor}">${fmtDec(r.cashFlow)}</div></div>`;

    document.getElementById("printDate").textContent = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    setTimeout(() => window.print(), 150);
  }, [scenName, scenDate, borName, propAddress, purchasePrice, downPct, downAmt, intRate, loanTerm, rateType, results]);

  /* ==============================================
     DSCR COLOR / STATUS LOGIC
     ============================================== */
  const r = results;
  const hasData = r.pitia > 0 && r.rent > 0;

  let dscrColorClass = "dscr-nodata";
  let dscrColor = "#64748B";
  let statusBg = "rgba(100,116,139,0.15)";
  let statusColor = "#94A3B8";
  let statusIcon = "info";
  let statusText = "Enter property details";

  if (hasData) {
    if (r.dscr >= 1.25) {
      dscrColorClass = "dscr-excellent"; dscrColor = "#34D399";
      statusBg = "rgba(52,211,153,0.15)"; statusColor = "#34D399";
      statusIcon = "check"; statusText = "Excellent \u2014 Best Rates Available";
    } else if (r.dscr >= 1.0) {
      dscrColorClass = "dscr-good"; dscrColor = "#38BDF8";
      statusBg = "rgba(56,189,248,0.15)"; statusColor = "#38BDF8";
      statusIcon = "check"; statusText = "Good \u2014 Standard Pricing";
    } else if (r.dscr >= 0.75) {
      dscrColorClass = "dscr-marginal"; dscrColor = "#FBBF24";
      statusBg = "rgba(251,191,36,0.15)"; statusColor = "#FBBF24";
      statusIcon = "warning"; statusText = "Marginal \u2014 Limited Programs, Higher Rate";
    } else {
      dscrColorClass = "dscr-poor"; dscrColor = "#F87171";
      statusBg = "rgba(248,113,113,0.15)"; statusColor = "#F87171";
      statusIcon = "x"; statusText = "Below Threshold \u2014 May Not Qualify";
    }
  }

  // LTV color
  let ltvColor = "#34D399";
  if (r.ltv > 80) ltvColor = "#FBBF24";
  else if (r.ltv > 75) ltvColor = "#38BDF8";

  // PITIA bar widths (proportional)
  const barTotal = r.pitia || 1;
  const barPct = (val) => Math.max(0, (val / barTotal) * 100);

  // Eligibility tiers
  const tiers = [
    { label: "1.25x+", desc: "Excellent \u2014 Best Rates", color: "#34D399", min: 1.25 },
    { label: "1.00\u20131.24x", desc: "Good \u2014 Standard", color: "#38BDF8", min: 1.0 },
    { label: "0.75\u20130.99x", desc: "Marginal \u2014 Limited", color: "#FBBF24", min: 0.75 },
    { label: "< 0.75x", desc: "Below Threshold", color: "#F87171", min: -Infinity },
  ];

  const dotClass = saveStatus.state ? `save-status-dot ${saveStatus.state}` : "save-status-dot";

  return (
    <>
      {/* ================================================
          SCOPED CSS
          ================================================ */}
      <style>{`
        @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css');
        .calc-breadcrumb { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; font-size: 14px; color: #64748B; }
        .calc-breadcrumb a { color: #2563EB; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
        .calc-breadcrumb a:hover { color: #1D4ED8; text-decoration: underline; }
        .calc-breadcrumb .bc-sep { color: #CBD5E1; }
        .calc-breadcrumb .bc-current { color: #0F172A; font-weight: 600; }
        .calc-container { width: 100%; max-width: 1280px; margin: 0 auto; font-family: 'Host Grotesk', system-ui, -apple-system, sans-serif; color: #0f172a; box-sizing: border-box; }
        .calc-container * { box-sizing: border-box; }
        .calc-header { background: #0F172A; padding: 16px 20px; border-radius: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; box-shadow: 0 4px 16px rgba(15,23,42,0.12); }
        .header-left { flex: 1 1 auto; min-width: 200px; }
        .calc-title { color: white; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
        .calc-subtitle { color: #94A3B8; margin: 4px 0 0 0; font-size: 13px; font-weight: 400; }
        .header-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .btn-group { display: flex; gap: 8px; }
        .action-btn { border: none; padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; color: white; transition: filter 0.2s, transform 0.1s; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; font-family: 'Host Grotesk', system-ui, sans-serif; }
        .action-btn:hover { filter: brightness(110%); }
        .action-btn:active { transform: translateY(1px); }
        .action-btn:disabled { opacity: 0.5; cursor: not-allowed; filter: none; transform: none; }
        .btn-save { background: #059669; }
        .btn-load { background: #2563EB; }
        .btn-print { background: #7C3AED; }
        .btn-clear { background: #DC2626; }
        .save-status { display: flex; align-items: center; gap: 6px; }
        .save-status-dot { width: 8px; height: 8px; border-radius: 50%; background: #64748B; flex-shrink: 0; }
        .save-status-dot.saving { background: #F59E0B; animation: pulse-dot 1s infinite; }
        .save-status-dot.saved { background: #10B981; }
        .save-status-dot.error { background: #EF4444; }
        .save-status-dot.loading { background: #3B82F6; animation: pulse-dot 1s infinite; }
        .save-status-text { color: #94A3B8; font-size: 12px; font-weight: 500; white-space: nowrap; }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .floating-card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); transition: box-shadow 0.2s ease; }
        .floating-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.07); }
        .card-title { font-size: 14px; font-weight: 700; color: #0F172A; text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 20px 0; padding-bottom: 10px; border-bottom: 2px solid #E2E8F0; display: flex; align-items: center; gap: 8px; }
        .card-title i { color: #2563EB; font-size: 14px; }
        .input-group { margin-bottom: 16px; }
        .input-group:last-child { margin-bottom: 0; }
        .input-group label { display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px; }
        .calc-input { width: 100%; padding: 10px 12px; border: 1px solid #CBD5E1; border-radius: 8px; font-size: 15px; font-family: 'Host Grotesk', system-ui, sans-serif; color: #0f172a; background: #FFFFFF; transition: border-color 0.2s, box-shadow 0.2s; }
        .calc-input:focus { outline: none; border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
        .calc-input::placeholder { color: #94A3B8; }
        .calc-input.field-empty { background-color: #FFFBEB; border-color: #FDE68A; }
        .calc-input.readonly { background: #F1F5F9; color: #64748B; cursor: not-allowed; }
        .calc-select { width: 100%; padding: 10px 12px; border: 1px solid #CBD5E1; border-radius: 8px; font-size: 15px; font-family: 'Host Grotesk', system-ui, sans-serif; color: #0f172a; background: #FFFFFF; transition: border-color 0.2s, box-shadow 0.2s; appearance: auto; }
        .calc-select:focus { outline: none; border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
        .req { color: #DC2626; }
        .input-helper { font-size: 12px; color: #94A3B8; margin-top: 4px; }
        .input-with-suffix { position: relative; display: flex; align-items: center; }
        .input-with-suffix input { padding-right: 36px; }
        .input-suffix { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: #94A3B8; font-size: 13px; font-weight: 600; pointer-events: none; }
        .linked-input-row { display: grid; grid-template-columns: 100px 1fr; gap: 8px; align-items: start; }
        .linked-input-row .input-with-suffix input { text-align: center; }
        .grid-3-compact { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
        .calc-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
        .ltv-helper { font-size: 12px; font-weight: 600; color: #2563EB; margin-top: 4px; }

        /* Result card (dark) */
        .result-card-main { background: #0F172A; border-radius: 16px; padding: 32px; box-shadow: 0 8px 32px rgba(15,23,42,0.2); color: white; position: sticky; top: 20px; }
        .res-label-main { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748B; margin-bottom: 8px; font-weight: 700; text-align: center; }
        .dscr-big { font-size: 56px; font-weight: 800; line-height: 1; text-align: center; margin-bottom: 12px; letter-spacing: -0.02em; }
        .dscr-excellent { color: #34D399; }
        .dscr-good { color: #38BDF8; }
        .dscr-marginal { color: #FBBF24; }
        .dscr-poor { color: #F87171; }
        .dscr-nodata { color: #64748B; }

        /* Status badge */
        .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; margin: 0 auto; }

        /* Stat cards (2x2) */
        .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 24px 0; }
        .stat-card { background: rgba(255,255,255,0.06); border-radius: 10px; padding: 14px; text-align: center; }
        .stat-card-label { font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
        .stat-card-value { font-size: 20px; font-weight: 800; }

        /* PITIA breakdown */
        .result-card-main .divider { border: 0; border-top: 1px solid rgba(255,255,255,0.15); margin: 20px 0; }
        .breakdown-title { font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 12px; }
        .pitia-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .pitia-row:last-child { border-bottom: none; }
        .pitia-row-left { display: flex; align-items: center; gap: 10px; }
        .pitia-bar { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
        .pitia-bar.blue { background: #3B82F6; }
        .pitia-bar.green { background: #34D399; }
        .pitia-bar.purple { background: #A78BFA; }
        .pitia-bar.yellow { background: #FBBF24; }
        .pitia-bar.cyan { background: #22D3EE; }
        .pitia-label { font-size: 13px; color: #CBD5E1; }
        .pitia-value { font-size: 14px; font-weight: 600; color: white; }
        .pitia-row.total-row { border-top: 2px solid rgba(255,255,255,0.2); padding-top: 12px; margin-top: 4px; }
        .pitia-row.total-row .pitia-label { color: #94A3B8; font-weight: 700; }
        .pitia-row.total-row .pitia-value { color: #38BDF8; font-weight: 800; }

        /* Eligibility guide */
        .elig-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; margin-top: 20px; }
        .elig-title { font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 12px; }
        .elig-tier { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; margin-bottom: 4px; transition: background 0.2s; }
        .elig-tier:last-child { margin-bottom: 0; }
        .elig-tier.active { background: rgba(255,255,255,0.08); }
        .elig-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .elig-label { font-size: 13px; font-weight: 700; color: #E2E8F0; min-width: 80px; }
        .elig-desc { font-size: 12px; color: #64748B; }

        /* Modals */
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; justify-content: center; align-items: center; }
        .modal-content { background: white; width: 440px; max-width: 92%; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-height: 80vh; display: flex; flex-direction: column; }
        .modal-header { background: #0F172A; color: white; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; }
        .modal-header h3 { margin: 0; font-size: 16px; font-weight: 700; }
        .close-modal { cursor: pointer; font-size: 22px; color: #94A3B8; transition: color 0.15s; background: none; border: none; }
        .close-modal:hover { color: white; }
        .modal-subheader { padding: 12px 20px; background: #F8FAFC; border-bottom: 1px solid #E2E8F0; font-size: 13px; color: #64748B; }
        .modal-list { padding: 8px; max-height: 360px; overflow-y: auto; flex: 1; }
        .modal-loading { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 32px; color: #64748B; font-size: 14px; }
        .modal-spinner { width: 20px; height: 20px; border: 3px solid #E2E8F0; border-top-color: #2563EB; border-radius: 50%; animation: spin 0.6s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .scenario-item { display: flex; align-items: center; padding: 12px; border-radius: 10px; cursor: pointer; transition: background 0.15s; gap: 12px; }
        .scenario-item:hover { background: #F1F5F9; }
        .scenario-item-info { flex: 1; min-width: 0; }
        .scenario-item-name { font-size: 14px; font-weight: 600; color: #0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .scenario-item-date { font-size: 12px; color: #94A3B8; margin-top: 2px; }
        .scenario-item-actions { display: flex; gap: 4px; flex-shrink: 0; }
        .scenario-action-btn { background: none; border: none; cursor: pointer; padding: 6px 8px; border-radius: 6px; font-size: 13px; color: #64748B; transition: all 0.15s; }
        .scenario-action-btn:hover { background: #E2E8F0; color: #0F172A; }
        .scenario-action-btn.delete:hover { background: #FEE2E2; color: #DC2626; }
        .modal-empty { text-align: center; padding: 32px 20px; }
        .modal-empty-icon { font-size: 32px; color: #CBD5E1; margin-bottom: 12px; }
        .modal-empty-title { font-size: 15px; font-weight: 600; color: #475569; margin: 0 0 4px 0; }
        .modal-empty-text { font-size: 13px; color: #94A3B8; margin: 0; }
        .modal-upgrade { padding: 16px 20px; background: linear-gradient(135deg, #EFF6FF 0%, #F0F9FF 100%); border-top: 1px solid #BFDBFE; text-align: center; }
        .modal-upgrade-text { font-size: 13px; color: #1E40AF; margin: 0 0 8px 0; }
        .modal-upgrade-btn { display: inline-block; padding: 8px 20px; background: #2563EB; color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .modal-upgrade-btn:hover { background: #1D4ED8; }

        /* Responsive */
        @media (max-width: 768px) {
          .calc-header { flex-direction: column; align-items: flex-start; }
          .header-left { width: 100%; margin-bottom: 8px; }
          .header-actions { width: 100%; justify-content: space-between; }
          .calc-grid-2 { grid-template-columns: 1fr; gap: 0; }
          .grid-3-compact { grid-template-columns: 1fr; }
          .dscr-big { font-size: 44px; }
          .stat-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
          .floating-card { padding: 20px 16px; border-radius: 12px; }
          .result-card-main { position: static; }
        }
        @media (max-width: 480px) {
          .header-actions { flex-direction: column; gap: 12px; }
          .btn-group { width: 100%; justify-content: space-between; gap: 6px; }
          .action-btn { flex: 1; text-align: center; padding: 10px 6px; justify-content: center; font-size: 12px; }
          .save-status { width: 100%; justify-content: center; }
          .floating-card { padding: 16px 14px; }
          .linked-input-row { grid-template-columns: 90px 1fr; }
        }

        /* Print styles */
        .print-summary { display: none; }
        @media print {
          body * { visibility: hidden !important; }
          .calc-container > *:not(.print-summary),
          .calc-header, .floating-card, .calc-grid-2, .calc-breadcrumb,
          .result-card-main,
          nav, footer, header, aside, [class*="sidebar"], [class*="navbar"], [class*="footer"] {
            height: 0 !important; max-height: 0 !important; min-height: 0 !important;
            padding: 0 !important; margin: 0 !important; overflow: hidden !important;
          }
          .print-summary, .print-summary * { visibility: visible !important; }
          .print-summary { display: block !important; position: fixed !important; top: 0; left: 0; width: 100% !important; background: white !important; z-index: 99999 !important; padding: 0.4in 0.6in !important; font-family: 'Host Grotesk', system-ui, sans-serif !important; color: #0f172a !important; font-size: 11pt !important; }
          .print-header { display: flex !important; justify-content: space-between !important; align-items: center !important; border-bottom: 2px solid #0F172A !important; padding-bottom: 10px !important; margin-bottom: 16px !important; }
          .print-logo { height: 32px !important; width: auto !important; }
          .print-doc-title { font-size: 14pt !important; font-weight: 700 !important; color: #475569 !important; }
          .print-scenario-info { display: grid !important; grid-template-columns: repeat(4, 1fr) !important; gap: 8px 24px !important; background: #F8FAFC !important; border: 1px solid #E2E8F0 !important; border-radius: 8px !important; padding: 12px 16px !important; margin-bottom: 16px !important; }
          .print-info-label { font-size: 7pt !important; font-weight: 700 !important; color: #64748B !important; text-transform: uppercase !important; }
          .print-info-value { font-size: 10pt !important; font-weight: 600 !important; color: #0F172A !important; }
          .print-section-title { font-size: 11pt !important; font-weight: 700 !important; border-bottom: 1px solid #CBD5E1 !important; padding-bottom: 4px !important; margin-bottom: 8px !important; }
          .print-table { width: 100% !important; border-collapse: collapse !important; font-size: 9pt !important; margin-bottom: 16px !important; }
          .print-table tr { border-bottom: 1px solid #E2E8F0 !important; }
          .print-table td, .print-table th { padding: 5px 0 !important; }
          .print-table th { font-size: 8pt !important; font-weight: 700 !important; color: #64748B !important; text-transform: uppercase !important; text-align: left !important; }
          .print-table th:last-child, .print-table td:last-child { text-align: right !important; }
          .print-table td:first-child { color: #475569 !important; }
          .print-table td:last-child { font-weight: 700 !important; }
          .print-table tr.print-total-row { border-top: 2px solid #0F172A !important; }
          .print-table tr.print-total-row td { padding-top: 8px !important; font-size: 12pt !important; font-weight: 800 !important; }
          .print-two-col { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 16px !important; margin-bottom: 16px !important; }
          .print-results-bar { display: grid !important; grid-template-columns: repeat(4, 1fr) !important; gap: 10px !important; margin-top: 16px !important; }
          .print-result-card { background: #F0F9FF !important; border: 1px solid #BAE6FD !important; border-radius: 8px !important; padding: 10px !important; text-align: center !important; }
          .print-result-label { font-size: 7pt !important; font-weight: 600 !important; color: #64748B !important; text-transform: uppercase !important; }
          .print-result-value { font-size: 12pt !important; font-weight: 800 !important; }
          .print-result-value.blue { color: #2563EB !important; }
          .print-result-value.green { color: #059669 !important; }
          .print-result-value.red { color: #DC2626 !important; }
          .print-footer { margin-top: 16px !important; padding-top: 8px !important; border-top: 1px solid #E2E8F0 !important; font-size: 8pt !important; color: #94A3B8 !important; text-align: center !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { size: letter portrait; margin: 0.25in; }
        }
      `}</style>

      <div className="calc-container">

        {/* BREADCRUMB */}
        <div className="calc-breadcrumb">
          <Link to="/app/calculators"><i className="fa-solid fa-arrow-left" style={{ fontSize: 12 }}></i> Calculators</Link>
          <span className="bc-sep">/</span>
          <span className="bc-current">DSCR Calculator</span>
        </div>

        {/* HEADER BAR */}
        <div className="calc-header">
          <div className="header-left">
            <h1 className="calc-title">DSCR Calculator</h1>
            <p className="calc-subtitle">Calculate Debt Service Coverage Ratio for investment property loan eligibility.</p>
          </div>
          <div className="header-actions">
            <div className="save-status">
              <span className={dotClass}></span>
              <span className="save-status-text">{saveStatus.text}</span>
            </div>
            <div className="btn-group">
              <button onClick={saveScenario} className="action-btn btn-save"><i className="fa-solid fa-cloud-arrow-up"></i> Save</button>
              <button onClick={openLoadModal} className="action-btn btn-load"><i className="fa-solid fa-folder-open"></i> Load</button>
              <button onClick={printSummary} className="action-btn btn-print"><i className="fa-solid fa-print"></i> Print</button>
              <button onClick={clearForm} className="action-btn btn-clear"><i className="fa-solid fa-rotate-left"></i> Clear</button>
            </div>
          </div>
        </div>

        {/* LOAD MODAL */}
        {showLoadModal && (
          <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowLoadModal(false); }}>
            <div className="modal-content">
              <div className="modal-header">
                <h3>Saved Scenarios</h3>
                <button onClick={() => setShowLoadModal(false)} className="close-modal">&times;</button>
              </div>
              <div className="modal-subheader">
                {!userEmail ? "" :
                  saveLimit === 0 ? <><i className="fa-solid fa-lock" style={{ marginRight: 4 }}></i> Saving is available on PLUS and PRO plans</> :
                  saveLimit === Infinity ? <><i className="fa-solid fa-infinity" style={{ marginRight: 4 }}></i> {scenarios.length} saved (unlimited)</> :
                  <><i className="fa-solid fa-cloud" style={{ marginRight: 4 }}></i> {scenarios.length} of {saveLimit} saves used</>}
              </div>
              <div className="modal-list">
                {loadingScenarios ? (
                  <div className="modal-loading"><div className="modal-spinner"></div><span>Loading scenarios...</span></div>
                ) : !userEmail ? (
                  <div className="modal-empty"><div className="modal-empty-icon"><i className="fa-solid fa-lock"></i></div><p className="modal-empty-title">Log in to view saved scenarios</p><p className="modal-empty-text">Your scenarios are saved to the cloud and sync across devices.</p></div>
                ) : scenarios.length === 0 ? (
                  <><div className="modal-empty"><div className="modal-empty-icon"><i className="fa-solid fa-folder-open"></i></div><p className="modal-empty-title">No saved scenarios</p><p className="modal-empty-text">Save your first scenario using the Save button above.</p></div>
                  {saveLimit === 0 && <div className="modal-upgrade"><p className="modal-upgrade-text">Upgrade to save scenarios and access them on any device.</p><button className="modal-upgrade-btn" onClick={() => { setShowLoadModal(false); window.location.href = "/pricing"; }}>View Plans</button></div>}</>
                ) : (
                  <>{scenarios.map((s) => {
                    let dateStr = "";
                    if (s.dateCreated) { try { dateStr = new Date(s.dateCreated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch {} }
                    return (
                      <div key={s.id} className="scenario-item">
                        <div className="scenario-item-info" onClick={() => loadScenario(s.id)}>
                          <div className="scenario-item-name">{s.scenarioName}</div>
                          {dateStr && <div className="scenario-item-date">{dateStr}</div>}
                        </div>
                        <div className="scenario-item-actions">
                          <button className="scenario-action-btn" onClick={(e) => { e.stopPropagation(); startRename(s.id, s.scenarioName); }} title="Rename"><i className="fa-solid fa-pen"></i></button>
                          <button className="scenario-action-btn delete" onClick={(e) => { e.stopPropagation(); deleteScenario(s.id, s.scenarioName); }} title="Delete"><i className="fa-solid fa-trash"></i></button>
                        </div>
                      </div>
                    );
                  })}</>
                )}
              </div>
            </div>
          </div>
        )}

        {/* RENAME MODAL */}
        {showRenameModal && (
          <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowRenameModal(false); setRenameTargetId(null); } }}>
            <div className="modal-content" style={{ width: 360 }}>
              <div className="modal-header">
                <h3>Rename Scenario</h3>
                <button onClick={() => { setShowRenameModal(false); setRenameTargetId(null); }} className="close-modal">&times;</button>
              </div>
              <div style={{ padding: 20 }}>
                <div className="input-group" style={{ marginBottom: 16 }}>
                  <label>New Name</label>
                  <input type="text" className="calc-input" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") confirmRename(); }} placeholder="Enter new name..." autoFocus />
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => { setShowRenameModal(false); setRenameTargetId(null); }} className="action-btn" style={{ background: "#64748B" }}>Cancel</button>
                  <button onClick={confirmRename} className="action-btn btn-save">Rename</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SCENARIO DETAILS */}
        <div className="floating-card">
          <h3 className="card-title"><i className="fa-solid fa-file-lines"></i> Scenario Details</h3>
          <div className="grid-3-compact">
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Scenario Name <span className="req">*</span></label>
              <input type="text" className={`calc-input${emptyClass(scenName)}`} value={scenName} onChange={(e) => setScenName(e.target.value)} placeholder="e.g. 123 Main St DSCR" />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Date</label>
              <input type="date" className="calc-input" value={scenDate} onChange={(e) => setScenDate(e.target.value)} />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Borrower Name</label>
              <input type="text" className={`calc-input${emptyClass(borName)}`} value={borName} onChange={(e) => setBorName(e.target.value)} placeholder="e.g. John Smith" />
            </div>
          </div>
        </div>

        {/* TWO-COLUMN LAYOUT */}
        <div className="calc-grid-2">

          {/* ======== LEFT: Inputs ======== */}
          <div>

            {/* Property & Loan Details */}
            <div className="floating-card">
              <h3 className="card-title"><i className="fa-solid fa-building"></i> Property & Loan Details</h3>

              <div className="input-group">
                <label>Property Address</label>
                <input type="text" className={`calc-input${emptyClass(propAddress)}`} value={propAddress} onChange={(e) => setPropAddress(e.target.value)} placeholder="e.g. 123 Main St, City, ST 12345" />
              </div>

              <div className="input-group">
                <label>Purchase Price ($)</label>
                <input type="text" className={`calc-input${emptyClass(purchasePrice)}`} value={purchasePrice} onChange={(e) => handlePriceChange(e.target.value)} onBlur={handlePriceBlur} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handlePriceBlur(); e.target.blur(); } }} placeholder="e.g. 500,000" />
              </div>

              <div className="input-group">
                <label>Down Payment</label>
                <div className="linked-input-row">
                  <div className="input-with-suffix">
                    <input type="text" className={`calc-input${emptyClass(downPct)}`} value={downPct} onChange={(e) => handleDownPctChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } }} placeholder="25" style={{ textAlign: "center", paddingRight: 28 }} />
                    <span className="input-suffix">%</span>
                  </div>
                  <input type="text" className={`calc-input${emptyClass(downAmt)}`} value={downAmt} onChange={(e) => handleDownAmtChange(e.target.value)} onBlur={handleDownAmtBlur} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleDownAmtBlur(); e.target.blur(); } }} placeholder="e.g. 125,000" />
                </div>
                <div className="ltv-helper">LTV: {r.ltv.toFixed(1)}%</div>
              </div>

              <div className="input-group">
                <label>Loan Amount ($)</label>
                <input type="text" className="calc-input readonly" value={r.loanAmount > 0 ? formatNumberString(String(Math.round(r.loanAmount))) : ""} readOnly tabIndex={-1} />
              </div>

              <div className="input-group">
                <label>Interest Rate (%)</label>
                <input type="text" className={`calc-input${emptyClass(intRate)}`} value={intRate} onChange={(e) => setIntRate(e.target.value)} onBlur={handleRateBlur} onKeyDown={(e) => handleCalcFieldKeyDown(e, intRate, setIntRate, "rate")} placeholder="e.g. 7.500" />
              </div>

              <div className="input-group">
                <label>Loan Term</label>
                <select className="calc-select" value={loanTerm} onChange={(e) => setLoanTerm(e.target.value)}>
                  <option value="360">30 Years</option>
                  <option value="180">15 Years</option>
                  <option value="240">20 Years</option>
                  <option value="300">25 Years</option>
                  <option value="120">10 Years</option>
                </select>
              </div>

              <div className="input-group">
                <label>Rate Type</label>
                <select className="calc-select" value={rateType} onChange={(e) => setRateType(e.target.value)}>
                  <option value="Fixed">Fixed</option>
                  <option value="ARM">ARM</option>
                  <option value="Interest Only">Interest Only</option>
                </select>
              </div>
            </div>

            {/* Rental Income */}
            <div className="floating-card">
              <h3 className="card-title"><i className="fa-solid fa-money-bill-trend-up"></i> Rental Income</h3>

              <div className="input-group">
                <label>Monthly Gross Rent ($)</label>
                <input type="text" className={`calc-input${emptyClass(monthlyRent)}`} value={monthlyRent} onChange={(e) => handleCurrencyInput(e.target.value, setMonthlyRent)} onBlur={() => handleCurrencyBlur(monthlyRent, setMonthlyRent)} onKeyDown={(e) => handleCalcFieldKeyDown(e, monthlyRent, setMonthlyRent, "currency")} placeholder="e.g. 3,500" />
                <div className="input-helper">Per appraisal or lease &mdash; whichever lender uses</div>
              </div>

              <div className="input-group">
                <label>Rent Source</label>
                <select className="calc-select" value={rentSource} onChange={(e) => setRentSource(e.target.value)}>
                  <option value="Market Rent (Appraisal)">Market Rent (Appraisal)</option>
                  <option value="Existing Lease">Existing Lease</option>
                  <option value="Form 1007">Form 1007</option>
                  <option value="Schedule E">Schedule E</option>
                </select>
              </div>
            </div>

            {/* Insurance, Taxes & HOA (Insurance BEFORE Tax!) */}
            <div className="floating-card">
              <h3 className="card-title"><i className="fa-solid fa-shield-halved"></i> Insurance, Taxes & HOA</h3>

              <div className="input-group">
                <label>Annual Homeowner's Insurance ($)</label>
                <input type="text" className={`calc-input${emptyClass(annualIns)}`} value={annualIns} onChange={(e) => handleCurrencyInput(e.target.value, setAnnualIns)} onBlur={() => handleCurrencyBlur(annualIns, setAnnualIns)} onKeyDown={(e) => handleCalcFieldKeyDown(e, annualIns, setAnnualIns, "currency")} placeholder="e.g. 2,400" />
                <div className="input-helper">= {fmtDec(parseRaw(annualIns) / 12)}/mo</div>
              </div>

              <div className="input-group">
                <label>Annual Property Tax ($)</label>
                <input type="text" className={`calc-input${emptyClass(annualTax)}`} value={annualTax} onChange={(e) => handleCurrencyInput(e.target.value, setAnnualTax)} onBlur={() => handleCurrencyBlur(annualTax, setAnnualTax)} onKeyDown={(e) => handleCalcFieldKeyDown(e, annualTax, setAnnualTax, "currency")} placeholder="e.g. 6,000" />
                <div className="input-helper">= {fmtDec(parseRaw(annualTax) / 12)}/mo</div>
              </div>

              <div className="input-group">
                <label>Monthly HOA / Condo Fees ($)</label>
                <input type="text" className={`calc-input${emptyClass(monthlyHOA)}`} value={monthlyHOA} onChange={(e) => handleCurrencyInput(e.target.value, setMonthlyHOA)} onBlur={() => handleCurrencyBlur(monthlyHOA, setMonthlyHOA)} onKeyDown={(e) => handleCalcFieldKeyDown(e, monthlyHOA, setMonthlyHOA, "currency")} placeholder="e.g. 350" />
              </div>

              <div className="input-group">
                <label>Monthly Flood Insurance ($)</label>
                <input type="text" className={`calc-input${emptyClass(monthlyFlood)}`} value={monthlyFlood} onChange={(e) => handleCurrencyInput(e.target.value, setMonthlyFlood)} onBlur={() => handleCurrencyBlur(monthlyFlood, setMonthlyFlood)} onKeyDown={(e) => handleCalcFieldKeyDown(e, monthlyFlood, setMonthlyFlood, "currency")} placeholder="e.g. 150" />
                <div className="input-helper">Only if in a flood zone</div>
              </div>
            </div>

          </div>

          {/* ======== RIGHT: Results (sticky) ======== */}
          <div>
            <div className="result-card-main">

              {/* DSCR Display */}
              <span className="res-label-main">DEBT SERVICE COVERAGE RATIO</span>
              <div className={`dscr-big ${dscrColorClass}`}>
                {hasData ? r.dscr.toFixed(3) + "x" : "\u2014"}
              </div>

              {/* Status Badge */}
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <span className="status-badge" style={{ background: statusBg, color: statusColor }}>
                  {statusIcon === "check" && <i className="fa-solid fa-circle-check"></i>}
                  {statusIcon === "warning" && <i className="fa-solid fa-triangle-exclamation"></i>}
                  {statusIcon === "x" && <i className="fa-solid fa-circle-xmark"></i>}
                  {statusIcon === "info" && <i className="fa-solid fa-circle-info"></i>}
                  {statusText}
                </span>
              </div>

              {/* 4 Stat Cards (2x2) */}
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-card-label">Monthly Rent</div>
                  <div className="stat-card-value" style={{ color: "#34D399" }}>{fmt(r.rent)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">Monthly PITIA</div>
                  <div className="stat-card-value" style={{ color: "#38BDF8" }}>{fmtDec(r.pitia)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">Monthly Cash Flow</div>
                  <div className="stat-card-value" style={{ color: r.cashFlow >= 0 ? "#34D399" : "#F87171" }}>{fmtDec(r.cashFlow)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">LTV</div>
                  <div className="stat-card-value" style={{ color: ltvColor }}>{r.ltv.toFixed(1)}%</div>
                </div>
              </div>

              <hr className="divider" />

              {/* PITIA Breakdown (Insurance BEFORE Tax) */}
              <div className="breakdown-title">PITIA Breakdown</div>

              <div className="pitia-row">
                <div className="pitia-row-left">
                  <span className="pitia-bar blue"></span>
                  <span className="pitia-label">P&I</span>
                </div>
                <span className="pitia-value">{fmtDec(r.pi)}</span>
              </div>
              <div className="pitia-row">
                <div className="pitia-row-left">
                  <span className="pitia-bar green"></span>
                  <span className="pitia-label">Insurance</span>
                </div>
                <span className="pitia-value">{fmtDec(r.monthlyIns)}</span>
              </div>
              <div className="pitia-row">
                <div className="pitia-row-left">
                  <span className="pitia-bar purple"></span>
                  <span className="pitia-label">Tax</span>
                </div>
                <span className="pitia-value">{fmtDec(r.monthlyTax)}</span>
              </div>
              <div className="pitia-row">
                <div className="pitia-row-left">
                  <span className="pitia-bar yellow"></span>
                  <span className="pitia-label">HOA</span>
                </div>
                <span className="pitia-value">{fmtDec(r.hoa)}</span>
              </div>
              <div className="pitia-row">
                <div className="pitia-row-left">
                  <span className="pitia-bar cyan"></span>
                  <span className="pitia-label">Flood</span>
                </div>
                <span className="pitia-value">{fmtDec(r.flood)}</span>
              </div>
              <div className="pitia-row total-row">
                <div className="pitia-row-left">
                  <span className="pitia-label">Total PITIA</span>
                </div>
                <span className="pitia-value">{fmtDec(r.pitia)}</span>
              </div>

              {/* Eligibility Guide */}
              <div className="elig-card">
                <div className="elig-title">Eligibility Guide</div>
                {tiers.map((tier, i) => {
                  const isActive = hasData && (
                    (tier.min === 1.25 && r.dscr >= 1.25) ||
                    (tier.min === 1.0 && r.dscr >= 1.0 && r.dscr < 1.25) ||
                    (tier.min === 0.75 && r.dscr >= 0.75 && r.dscr < 1.0) ||
                    (tier.min === -Infinity && r.dscr < 0.75)
                  );
                  return (
                    <div key={i} className={`elig-tier${isActive ? " active" : ""}`}>
                      <span className="elig-dot" style={{ background: tier.color }}></span>
                      <span className="elig-label">{tier.label}</span>
                      <span className="elig-desc">{tier.desc}</span>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>

        </div>

        {/* PRINT SUMMARY */}
        <div className="print-summary">
          <div className="print-header">
            <img className="print-logo" src="https://cdn.prod.website-files.com/694e4aaf5f511ad7901b74bc/69576dcb21edb9d479222c02_Logo_Horizontal_Blue.png" alt="mtg.broker" />
            <div className="print-doc-title">DSCR Calculator</div>
          </div>
          <div className="print-scenario-info" id="printScenarioInfo"></div>
          <div className="print-two-col">
            <div>
              <div className="print-section-title">Property &amp; Loan Details</div>
              <table className="print-table" id="printPropertyTable"></table>
            </div>
            <div>
              <div className="print-section-title">PITIA Breakdown</div>
              <table className="print-table" id="printPITIATable"></table>
            </div>
          </div>
          <div className="print-results-bar" id="printResultsBar"></div>
          <div className="print-footer">Generated from mtg.broker &mdash; <span id="printDate"></span></div>
        </div>

      </div>
    </>
  );
}
