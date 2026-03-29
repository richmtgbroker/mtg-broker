import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router";
import { getUserEmail, getUserPlan } from "../../lib/auth";

export function meta() {
  return [{ title: "VA Entitlement Calculator — MtgBroker" }];
}

/* ================================================
   CONFIGURATION
   ================================================ */
const API_BASE = "https://mtg-broker-api.rich-e00.workers.dev";
const CALC_TYPE = "VA Entitlement";

/* ================================================
   FORMATTING HELPERS
   ================================================ */
const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function parseRaw(val) {
  if (!val) return 0;
  return parseFloat(String(val).replace(/,/g, "")) || 0;
}

/** Allows math like 832750/2 or 400000+50000 */
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

/* ================================================
   FUNDING FEE RATE LOGIC
   ================================================ */
function getAutoFeeRate(loanPurpose, loanUsage, feeExempt, dpPct) {
  if (feeExempt === "yes") return 0;
  switch (loanPurpose) {
    case "purchase":
      if (dpPct >= 10) return 1.25;
      if (dpPct >= 5) return 1.50;
      return loanUsage === "first" ? 2.15 : 3.30;
    case "cashout":
      return loanUsage === "first" ? 2.15 : 3.30;
    case "irrrl":
      return 0.50;
    case "manufactured":
      return 1.00;
    default:
      return 0;
  }
}

/* ================================================
   MAIN COMPONENT
   ================================================ */
export default function VAEntitlementCalculator() {
  /* --- Auth state --- */
  const [userEmail, setUserEmail] = useState("");
  const [userPlanName, setUserPlanName] = useState("LITE");

  useEffect(() => {
    setUserEmail(getUserEmail() || "");
    setUserPlanName(getUserPlan() || "LITE");
    setScenDate(new Date().toISOString().split("T")[0]);
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

  /* --- Form state --- */
  const [entitlementType, setEntitlementType] = useState("full");
  const [scenName, setScenName] = useState("");
  const [scenDate, setScenDate] = useState("");
  const [borName, setBorName] = useState("");
  const [countyLimit, setCountyLimit] = useState("832,750");
  const [entitlementUsed, setEntitlementUsed] = useState("0");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [downPayment, setDownPayment] = useState("0");
  const [downPaymentPct, setDownPaymentPct] = useState("0");
  const [loanUsage, setLoanUsage] = useState("first");
  const [feeExempt, setFeeExempt] = useState("no");
  const [loanPurpose, setLoanPurpose] = useState("purchase");
  const [refiLoanAmount, setRefiLoanAmount] = useState(""); /* Loan amount for non-purchase scenarios */
  const [feeRateInput, setFeeRateInput] = useState("");
  const [feeRateOverride, setFeeRateOverride] = useState(false);

  /* --- Collapsible ref state --- */
  const [showFeeRef, setShowFeeRef] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  /* ================================================
     LINKED DOWN PAYMENT LOGIC
     ================================================ */
  // When % changes -> recalculate $ from price
  const handleDownPctChange = useCallback((val) => {
    setDownPaymentPct(val);
    const price = parseRaw(purchasePrice);
    const pct = parseFloat(val) || 0;
    if (price > 0) {
      setDownPayment(formatNumberString(String(Math.round(price * pct / 100))));
    }
  }, [purchasePrice]);

  // When $ changes -> recalculate % from price
  const handleDownAmtChange = useCallback((val) => {
    // Allow math operators to pass through without formatting
    if (/[+\-*/]/.test(val.replace(/,/g, ""))) {
      setDownPayment(val);
    } else {
      setDownPayment(formatNumberString(val));
    }
    const price = parseRaw(purchasePrice);
    const amt = parseRaw(val);
    if (price > 0 && amt >= 0) {
      setDownPaymentPct(((amt / price) * 100).toFixed(2));
    }
  }, [purchasePrice]);

  // Down payment $ blur: evaluate expression, then recalc %
  const handleDownAmtBlur = useCallback(() => {
    let val = downPayment;
    if (val && /[+\-*/]/.test(val.replace(/,/g, ""))) {
      const result = evaluateExpression(val);
      if (!isNaN(result)) val = String(result);
    }
    const formatted = formatNumberString(val);
    setDownPayment(formatted);
    const price = parseRaw(purchasePrice);
    const amt = parseRaw(val);
    if (price > 0 && amt >= 0) {
      setDownPaymentPct(((amt / price) * 100).toFixed(2));
    }
  }, [downPayment, purchasePrice]);

  // When price changes -> recalculate $ from existing %
  const handlePriceChange = useCallback((val) => {
    if (/[+\-*/]/.test(val.replace(/,/g, ""))) {
      setPurchasePrice(val);
    } else {
      setPurchasePrice(formatNumberString(val));
    }
    const price = parseRaw(val);
    const pct = parseFloat(downPaymentPct) || 0;
    if (price > 0) {
      setDownPayment(formatNumberString(String(Math.round(price * pct / 100))));
    }
  }, [downPaymentPct]);

  // Price blur: evaluate expression, recalc down $
  const handlePriceBlur = useCallback(() => {
    let val = purchasePrice;
    if (val && /[+\-*/]/.test(val.replace(/,/g, ""))) {
      const result = evaluateExpression(val);
      if (!isNaN(result)) val = String(result);
    }
    const formatted = formatNumberString(val);
    setPurchasePrice(formatted);
    const price = parseRaw(val);
    const pct = parseFloat(downPaymentPct) || 0;
    if (price > 0) {
      setDownPayment(formatNumberString(String(Math.round(price * pct / 100))));
    }
  }, [purchasePrice, downPaymentPct]);

  /* ================================================
     AUTO-UPDATE FUNDING FEE RATE
     When loan purpose, usage, exempt, or DP% changes,
     auto-update the fee rate — unless user has overridden.
     ================================================ */
  useEffect(() => {
    if (!feeRateOverride) {
      const dpPct = parseFloat(downPaymentPct) || 0;
      const autoRate = getAutoFeeRate(loanPurpose, loanUsage, feeExempt, dpPct);
      setFeeRateInput(autoRate.toFixed(2));
    }
  }, [loanPurpose, loanUsage, feeExempt, downPaymentPct, feeRateOverride]);

  // Reset override flag when loan purpose or usage changes
  const handleLoanPurposeChange = useCallback((val) => {
    setLoanPurpose(val);
    setFeeRateOverride(false);
  }, []);

  const handleLoanUsageChange = useCallback((val) => {
    setLoanUsage(val);
    setFeeRateOverride(false);
  }, []);

  const handleFeeExemptChange = useCallback((val) => {
    setFeeExempt(val);
    setFeeRateOverride(false);
  }, []);

  const handleFeeRateManualChange = useCallback((val) => {
    setFeeRateInput(val);
    setFeeRateOverride(true);
  }, []);

  /* --- Calculations --- */
  const results = useMemo(() => {
    const countyVal = parseRaw(countyLimit) || 832750;
    const usedVal = parseRaw(entitlementUsed) || 0;
    const priceVal = parseRaw(purchasePrice) || 0;
    const dpVal = parseRaw(downPayment) || 0;
    const dpPct = parseFloat(downPaymentPct) || 0;
    const isFull = entitlementType === "full";
    const isExempt = feeExempt === "yes";

    /* Entitlement calculations */
    let maxGuaranty = 0;
    let remaining = 0;
    let maxZeroDown = 0;

    if (isFull) {
      /* Full entitlement: no loan limit, $0 down always */
      remaining = -1; // sentinel for "full"
      maxZeroDown = priceVal; // no limit — can buy at any price with $0 down
    } else {
      /* Partial entitlement */
      maxGuaranty = countyVal * 0.25;
      remaining = Math.max(0, maxGuaranty - usedVal);
      maxZeroDown = remaining * 4;
    }

    /* Down payment required */
    let dpRequired = 0;
    if (!isFull && priceVal > maxZeroDown) {
      dpRequired = (priceVal - maxZeroDown) * 0.25;
    }

    /* Base loan — for purchases: Price - DP. For non-purchases: user-entered loan amount */
    const isPurchase = loanPurpose === "purchase";
    const refiLoanVal = parseRaw(refiLoanAmount) || 0;
    const baseLoan = isPurchase ? Math.max(0, priceVal - dpVal) : refiLoanVal;

    /* Funding fee — use the rate from the input field */
    const feeRate = isExempt ? 0 : (parseFloat(feeRateInput) || 0);
    const feeAmount = baseLoan * (feeRate / 100);
    const totalLoan = baseLoan + feeAmount;

    return {
      isFull,
      isExempt,
      isPurchase,
      countyVal,
      usedVal,
      maxGuaranty,
      remaining,
      maxZeroDown,
      dpRequired,
      baseLoan,
      feeRate,
      feeAmount,
      totalLoan,
      priceVal,
      dpVal,
      dpPct,
      refiLoanVal,
    };
  }, [entitlementType, countyLimit, entitlementUsed, purchasePrice, downPayment, downPaymentPct, feeExempt, feeRateInput, loanPurpose, refiLoanAmount]);

  /* --- Collect / populate form data for save/load --- */
  const collectFormData = useCallback(() => ({
    meta: { name: scenName, date: scenDate, borrower: borName },
    calc: { entitlementType, countyLimit, entitlementUsed, purchasePrice, downPayment, downPaymentPct, loanUsage, feeExempt, loanPurpose, feeRateInput, feeRateOverride, refiLoanAmount },
  }), [scenName, scenDate, borName, entitlementType, countyLimit, entitlementUsed, purchasePrice, downPayment, downPaymentPct, loanUsage, feeExempt, loanPurpose, feeRateInput, feeRateOverride, refiLoanAmount]);

  const populateForm = useCallback((data) => {
    if (!data) return;
    if (data.meta) {
      if (data.meta.name) setScenName(data.meta.name);
      if (data.meta.date) setScenDate(data.meta.date);
      if (data.meta.borrower) setBorName(data.meta.borrower);
    }
    if (data.calc) {
      const c = data.calc;
      if (c.entitlementType) setEntitlementType(c.entitlementType);
      if (c.countyLimit !== undefined) setCountyLimit(c.countyLimit);
      if (c.entitlementUsed !== undefined) setEntitlementUsed(c.entitlementUsed);
      if (c.purchasePrice !== undefined) setPurchasePrice(c.purchasePrice);
      if (c.downPayment !== undefined) setDownPayment(c.downPayment);
      if (c.downPaymentPct !== undefined) setDownPaymentPct(c.downPaymentPct);
      if (c.loanUsage) setLoanUsage(c.loanUsage);
      if (c.feeExempt) setFeeExempt(c.feeExempt);
      if (c.loanPurpose) setLoanPurpose(c.loanPurpose);
      if (c.feeRateInput !== undefined) setFeeRateInput(c.feeRateInput);
      if (c.feeRateOverride !== undefined) setFeeRateOverride(c.feeRateOverride);
      if (c.refiLoanAmount !== undefined) setRefiLoanAmount(c.refiLoanAmount);
    }
  }, []);

  /* --- Save scenario --- */
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
        method,
        headers: { Authorization: "Bearer " + userEmail, "Content-Type": "application/json" },
        body: JSON.stringify({ calculatorType: CALC_TYPE, scenarioName: scenName.trim(), scenarioData: collectFormData() }),
      });
      const result = await response.json();
      if (response.ok && result.scenario) {
        setCurrentScenarioId(result.scenario.id);
        if (method === "POST") setCurrentSaveCount((c) => c + 1);
        setSaveStatus({ state: "saved", text: "Saved" });
      } else {
        setSaveStatus({ state: "error", text: result.error || "Save failed" });
      }
    } catch {
      setSaveStatus({ state: "error", text: "Connection error" });
    }
  }, [scenName, userEmail, currentScenarioId, saveLimit, currentSaveCount, collectFormData]);

  /* --- Load scenarios modal --- */
  const openLoadModal = useCallback(async () => {
    setShowLoadModal(true);
    setLoadingScenarios(true);
    if (!userEmail) { setLoadingScenarios(false); return; }
    try {
      const response = await fetch(`${API_BASE}/api/calculator-scenarios?type=${encodeURIComponent(CALC_TYPE)}`, {
        headers: { Authorization: "Bearer " + userEmail },
      });
      const data = await response.json();
      setScenarios(data.scenarios || []);
      setCurrentSaveCount((data.scenarios || []).length);
    } catch {
      setScenarios([]);
    }
    setLoadingScenarios(false);
  }, [userEmail]);

  /* --- Load a specific scenario --- */
  const loadScenario = useCallback(async (scenarioId) => {
    setSaveStatus({ state: "loading", text: "Loading..." });
    setShowLoadModal(false);
    try {
      const response = await fetch(`${API_BASE}/api/calculator-scenarios?type=${encodeURIComponent(CALC_TYPE)}`, {
        headers: { Authorization: "Bearer " + userEmail },
      });
      const data = await response.json();
      const scenario = (data.scenarios || []).find((s) => s.id === scenarioId);
      if (scenario && scenario.scenarioData) {
        setCurrentScenarioId(scenario.id);
        populateForm(scenario.scenarioData);
        setSaveStatus({ state: "saved", text: "Loaded: " + scenario.scenarioName });
      } else {
        setSaveStatus({ state: "error", text: "Scenario not found" });
      }
    } catch {
      setSaveStatus({ state: "error", text: "Error loading scenario" });
    }
  }, [userEmail, populateForm]);

  /* --- Delete scenario --- */
  const deleteScenario = useCallback(async (scenarioId, scenarioName) => {
    if (!confirm(`Delete "${scenarioName}"? This cannot be undone.`)) return;
    try {
      const response = await fetch(`${API_BASE}/api/calculator-scenarios/${scenarioId}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + userEmail },
      });
      if (response.ok) {
        if (currentScenarioId === scenarioId) { setCurrentScenarioId(null); setSaveStatus({ state: "", text: "Ready" }); }
        openLoadModal();
      } else { alert("Delete failed. Try again."); }
    } catch { alert("Delete failed. Check connection."); }
  }, [userEmail, currentScenarioId, openLoadModal]);

  /* --- Rename scenario --- */
  const startRename = useCallback((id, name) => {
    setRenameTargetId(id);
    setRenameValue(name);
    setShowRenameModal(true);
  }, []);

  const confirmRename = useCallback(async () => {
    if (!renameValue.trim()) { alert("Please enter a name."); return; }
    if (!renameTargetId) return;
    try {
      const response = await fetch(`${API_BASE}/api/calculator-scenarios/${renameTargetId}`, {
        method: "PUT",
        headers: { Authorization: "Bearer " + userEmail, "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioName: renameValue.trim() }),
      });
      if (response.ok) {
        if (currentScenarioId === renameTargetId) setScenName(renameValue.trim());
        setShowRenameModal(false);
        setRenameTargetId(null);
        openLoadModal();
      } else { alert("Rename failed. Try again."); }
    } catch { alert("Rename failed. Check connection."); }
  }, [renameValue, renameTargetId, userEmail, currentScenarioId, openLoadModal]);

  /* --- Clear form --- */
  const clearForm = useCallback(() => {
    if (!confirm("Clear all fields and start fresh?")) return;
    setCurrentScenarioId(null);
    setEntitlementType("full");
    setScenName(""); setScenDate(new Date().toISOString().split("T")[0]);
    setBorName("");
    setCountyLimit("832,750"); setEntitlementUsed("0");
    setPurchasePrice(""); setDownPayment("0"); setDownPaymentPct("0");
    setLoanUsage("first"); setFeeExempt("no");
    setLoanPurpose("purchase");
    setFeeRateInput(""); setFeeRateOverride(false);
    setRefiLoanAmount("");
    setSaveStatus({ state: "", text: "Ready" });
  }, []);

  /* --- Print --- */
  const printSummary = useCallback(() => {
    const printEl = document.getElementById("va-print-summary");
    if (!printEl) return;

    const name = scenName.trim() || "Untitled";
    const borrower = borName.trim() || "\u2014";
    let dateDisplay = "\u2014";
    if (scenDate) {
      try { dateDisplay = new Date(scenDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); } catch {}
    }
    const r = results;

    document.getElementById("vaPrintScenarioInfo").innerHTML =
      `<div><div class="print-info-label">Scenario</div><div class="print-info-value">${escapeHtml(name)}</div></div>` +
      `<div><div class="print-info-label">Borrower</div><div class="print-info-value">${escapeHtml(borrower)}</div></div>` +
      `<div><div class="print-info-label">Date</div><div class="print-info-value">${dateDisplay}</div></div>`;

    /* Entitlement Analysis table */
    let entRows = "";
    if (r.isFull) {
      entRows =
        `<tr><td>Entitlement Status</td><td>Full Entitlement</td></tr>` +
        `<tr><td>VA Loan Limit</td><td>None</td></tr>` +
        `<tr class="print-highlight"><td>Down Payment Required</td><td>$0</td></tr>`;
    } else {
      entRows =
        `<tr><td>County Loan Limit (2026)</td><td>${fmt(r.countyVal)}</td></tr>` +
        `<tr><td>Max Guaranty (25%)</td><td>${fmt(r.maxGuaranty)}</td></tr>` +
        `<tr><td>Entitlement Used</td><td>${fmt(r.usedVal)}</td></tr>` +
        `<tr class="print-highlight"><td>Remaining Entitlement</td><td>${fmt(r.remaining)}</td></tr>` +
        `<tr><td>Max $0-Down Purchase (4&times;)</td><td>${fmt(r.maxZeroDown)}</td></tr>`;
    }
    document.getElementById("vaPrintEntitlement").innerHTML = entRows;

    /* Loan Summary table */
    const purposeLabels = { purchase: "Purchase / Construction", cashout: "Cash-Out Refinance", irrrl: "IRRRL (Streamline Refi)", manufactured: "Manufactured Home" };
    let loanRows = `<tr><td>Loan Purpose</td><td>${purposeLabels[loanPurpose] || "Purchase"}</td></tr>`;
    if (r.isPurchase && r.priceVal > 0) {
      loanRows +=
        `<tr><td>Purchase Price</td><td>${fmt(r.priceVal)}</td></tr>` +
        `<tr><td>Down Payment (${r.dpPct.toFixed(1)}%)</td><td>&minus;${fmt(r.dpVal)}</td></tr>` +
        `<tr><td>Base Loan Amount</td><td>${fmt(r.baseLoan)}</td></tr>` +
        `<tr><td>VA Funding Fee (${r.isExempt ? "Exempt" : r.feeRate.toFixed(2) + "%"})</td><td>+${fmt(r.feeAmount)}</td></tr>` +
        `<tr class="print-total-row"><td>Total Loan Amount</td><td>${fmt(r.totalLoan)}</td></tr>`;
    } else if (!r.isPurchase && r.refiLoanVal > 0) {
      loanRows +=
        `<tr><td>Loan Amount</td><td>${fmt(r.refiLoanVal)}</td></tr>` +
        `<tr><td>VA Funding Fee (${r.isExempt ? "Exempt" : r.feeRate.toFixed(2) + "%"})</td><td>+${fmt(r.feeAmount)}</td></tr>` +
        `<tr class="print-total-row"><td>Total Loan Amount</td><td>${fmt(r.totalLoan)}</td></tr>`;
    } else {
      loanRows +=
        `<tr><td>Funding Fee Rate</td><td>${r.isExempt ? "Exempt" : r.feeRate.toFixed(2) + "%"}</td></tr>` +
        `<tr><td colspan="2" style="color:#94A3B8;font-style:italic">Enter loan details to see summary</td></tr>`;
    }
    document.getElementById("vaPrintLoan").innerHTML = loanRows;

    /* Results bar */
    const entLabel = r.isFull ? "Full Entitlement" : fmt(r.remaining);
    const zeroDownLabel = r.isFull ? "No Limit" : fmt(r.maxZeroDown);
    const dpLabel = r.dpRequired > 0 ? fmt(r.dpRequired) + " required" : "$0";
    document.getElementById("vaPrintResultsBar").innerHTML =
      `<div class="print-result-card"><div class="print-result-label">Remaining Entitlement</div><div class="print-result-value blue">${r.isFull ? "Full" : entLabel}</div></div>` +
      `<div class="print-result-card"><div class="print-result-label">Max $0-Down Purchase</div><div class="print-result-value blue">${zeroDownLabel}</div><div style="font-size:7pt;color:#94A3B8;margin-top:2px;">Down Payment: ${dpLabel}</div></div>` +
      `<div class="print-result-card"><div class="print-result-label">VA Funding Fee</div><div class="print-result-value green">${r.isExempt ? "Exempt" : fmt(r.feeAmount)}</div></div>`;

    document.getElementById("vaPrintDate").textContent = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    setTimeout(() => window.print(), 150);
  }, [scenName, scenDate, borName, results, loanPurpose]);

  /* --- Calc-field handler (expression eval on blur OR Enter) --- */
  const handleCalcFieldBlur = useCallback((value, setter) => {
    if (value && /[+\-*/]/.test(value.replace(/,/g, ""))) {
      const result = evaluateExpression(value);
      if (!isNaN(result)) {
        setter(formatNumberString(String(result)));
        return;
      }
    }
    setter(formatNumberString(value));
  }, []);

  /** Press Enter in a calc-field: evaluate expression + blur the input */
  const handleCalcFieldKeyDown = useCallback((e, value, setter) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCalcFieldBlur(value, setter);
      e.target.blur();
    }
  }, [handleCalcFieldBlur]);

  /** Live currency formatting — skip when math operators are present */
  const handleCurrencyChange = useCallback((val, setter) => {
    if (/[+\-*/]/.test(val.replace(/,/g, ""))) {
      setter(val);
    } else {
      setter(formatNumberString(val));
    }
  }, []);

  /* --- Empty-field class helper --- */
  const emptyClass = (val) => (!String(val).trim() ? " field-empty" : "");

  /* --- Save status dot class --- */
  const dotClass = saveStatus.state ? `save-status-dot ${saveStatus.state}` : "save-status-dot";

  const r = results;

  /* --- Loan purpose labels for reference table highlighting --- */
  const purposeLabels = { purchase: "Purchase / Construction", cashout: "Cash-Out Refinance", irrrl: "IRRRL (Streamline Refi)", manufactured: "Manufactured Home" };

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
        .card-title .addon-badge { font-size: 10px; font-weight: 700; color: #64748B; background: #F1F5F9; border: 1px solid #E2E8F0; border-radius: 4px; padding: 2px 6px; text-transform: uppercase; letter-spacing: 0.06em; margin-left: auto; }
        .input-group { margin-bottom: 16px; }
        .input-group label { display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px; }
        .calc-input { width: 100%; padding: 10px 12px; border: 1px solid #CBD5E1; border-radius: 8px; font-size: 15px; font-family: 'Host Grotesk', system-ui, sans-serif; color: #0f172a; background: #FFFFFF; transition: border-color 0.2s, box-shadow 0.2s; }
        .calc-input:focus { outline: none; border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
        .calc-input::placeholder { color: #94A3B8; }
        .calc-input.field-empty { background-color: #FFFBEB; border-color: #FDE68A; }
        .req { color: #DC2626; }
        .grid-2-compact { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .grid-3-compact { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
        .calc-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }

        /* Linked input row for DP % / $ */
        .input-with-suffix { position: relative; display: flex; align-items: center; }
        .input-with-suffix input { padding-right: 36px; }
        .input-suffix { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: #94A3B8; font-size: 13px; font-weight: 600; pointer-events: none; }
        .linked-input-row { display: grid; grid-template-columns: 100px 1fr; gap: 8px; align-items: start; }
        .linked-input-row .input-with-suffix input { text-align: center; }

        /* Entitlement Toggle */
        .entitlement-toggle { display: flex; background: #F1F5F9; border-radius: 10px; padding: 4px; gap: 4px; }
        .toggle-btn { flex: 1; padding: 10px 16px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: 'Host Grotesk', system-ui, sans-serif; background: transparent; color: #64748B; }
        .toggle-btn.active { background: #2563EB; color: white; box-shadow: 0 2px 8px rgba(37,99,235,0.3); }
        .toggle-btn:not(.active):hover { background: #E2E8F0; color: #334155; }

        /* Info Callouts */
        .info-callout { border-radius: 10px; padding: 14px 16px; font-size: 13px; line-height: 1.5; display: flex; align-items: flex-start; gap: 10px; margin-top: 16px; }
        .info-callout i { font-size: 16px; margin-top: 1px; flex-shrink: 0; }
        .info-callout.success { background: #F0FDF4; border: 1px solid #BBF7D0; color: #166534; }
        .info-callout.success i { color: #16A34A; }
        .info-callout.warning { background: #FFFBEB; border: 1px solid #FDE68A; color: #92400E; }
        .info-callout.warning i { color: #D97706; }
        .info-callout.info { background: #EFF6FF; border: 1px solid #BFDBFE; color: #1E40AF; }
        .info-callout.info i { color: #2563EB; }

        /* Preset Pills */
        .preset-pills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
        .preset-pill { padding: 6px 12px; border-radius: 20px; border: 1px solid #CBD5E1; background: #F8FAFC; font-size: 12px; font-weight: 600; color: #475569; cursor: pointer; transition: all 0.15s; font-family: 'Host Grotesk', system-ui, sans-serif; white-space: nowrap; }
        .preset-pill:hover { background: #EFF6FF; border-color: #93C5FD; color: #2563EB; }
        .preset-pill.active { background: #2563EB; border-color: #2563EB; color: white; }

        /* Reference Toggle / Box */
        .ref-toggle { display: flex; align-items: center; gap: 6px; background: none; border: none; cursor: pointer; font-size: 13px; font-weight: 600; color: #2563EB; padding: 8px 0; font-family: 'Host Grotesk', system-ui, sans-serif; transition: color 0.15s; }
        .ref-toggle:hover { color: #1D4ED8; }
        .ref-toggle i { font-size: 10px; transition: transform 0.2s; }
        .ref-toggle i.open { transform: rotate(90deg); }
        .ref-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px; margin-top: 8px; }
        .ref-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .ref-table th { text-align: left; font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.04em; padding: 6px 8px; border-bottom: 2px solid #E2E8F0; }
        .ref-table td { padding: 8px; border-bottom: 1px solid #E2E8F0; color: #334155; }
        .ref-table tr.highlight-row { background: #EFF6FF; }
        .ref-table tr.highlight-row td { font-weight: 700; color: #1E40AF; }

        /* Computed Display */
        .computed-display { background: #F1F5F9; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 12px; font-size: 15px; font-weight: 600; color: #0F172A; min-height: 42px; display: flex; align-items: center; }
        .computed-display.highlight { background: #EFF6FF; border-color: #93C5FD; color: #1E40AF; }

        /* Fee rate input with auto-calc hint */
        .fee-rate-wrapper { position: relative; }
        .fee-rate-hint { font-size: 11px; color: #94A3B8; margin-top: 4px; }
        .fee-rate-hint .auto-label { color: #2563EB; font-weight: 600; cursor: pointer; }
        .fee-rate-hint .auto-label:hover { text-decoration: underline; }

        /* Dark Results Card */
        .result-card-main { background: linear-gradient(180deg, #0F172A 0%, #1E293B 100%); border-radius: 16px; padding: 32px; box-shadow: 0 8px 32px rgba(15,23,42,0.2); color: white; position: sticky; top: 20px; }
        .res-label-main { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #94A3B8; margin-bottom: 4px; font-weight: 700; }
        .res-val-main { font-size: 48px; font-weight: 800; color: #38BDF8; line-height: 1; margin-bottom: 20px; letter-spacing: -0.02em; }
        .res-val-main.no-limit { font-size: 40px; color: #34D399; }

        /* Stat cards grid inside results */
        .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
        .stat-card { background: rgba(255,255,255,0.06); border-radius: 10px; padding: 12px; }
        .stat-card-label { font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }
        .stat-card-value { font-size: 16px; font-weight: 700; color: #E2E8F0; }
        .stat-card-value.blue { color: #38BDF8; }
        .stat-card-value.green { color: #34D399; }
        .stat-card-value.amber { color: #FBBF24; }

        .result-card-main .divider { border: 0; border-top: 1px solid rgba(255,255,255,0.15); margin: 16px 0; }

        /* Breakdown rows */
        .breakdown-section { background: rgba(255,255,255,0.06); border-radius: 10px; padding: 16px; }
        .breakdown-title { font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px; }
        .breakdown-row { display: flex; justify-content: space-between; font-size: 13px; color: #CBD5E1; padding: 6px 0; }
        .breakdown-row span:last-child { font-weight: 600; color: #E2E8F0; }
        .breakdown-row.negative span:last-child { color: #FB923C; }
        .breakdown-row.total { border-top: 2px solid rgba(255,255,255,0.2); margin-top: 4px; padding-top: 10px; font-size: 14px; font-weight: 700; color: #E2E8F0; }
        .breakdown-row.total span:last-child { color: #38BDF8; font-weight: 800; }

        /* Down Payment Alert */
        .dp-alert { background: rgba(251,191,36,0.15); border: 1px solid rgba(251,191,36,0.3); border-radius: 10px; padding: 14px 16px; margin-top: 16px; }
        .dp-alert-title { font-size: 12px; font-weight: 700; color: #FBBF24; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }
        .dp-alert-value { font-size: 20px; font-weight: 800; color: #FBBF24; }
        .dp-alert-note { font-size: 12px; color: #94A3B8; margin-top: 4px; }
        .dp-success { background: rgba(52,211,153,0.15); border: 1px solid rgba(52,211,153,0.3); border-radius: 10px; padding: 14px 16px; margin-top: 16px; display: flex; align-items: center; gap: 10px; }
        .dp-success i { color: #34D399; font-size: 18px; }
        .dp-success span { font-size: 14px; font-weight: 600; color: #34D399; }

        /* Modal styles */
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
        .modal-upgrade-btn { display: inline-block; padding: 8px 20px; background: #2563EB; color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; }
        .modal-upgrade-btn:hover { background: #1D4ED8; }

        /* Responsive */
        @media (max-width: 768px) {
          .calc-header { flex-direction: column; align-items: flex-start; }
          .header-left { width: 100%; margin-bottom: 8px; }
          .header-actions { width: 100%; justify-content: space-between; }
          .calc-grid-2 { grid-template-columns: 1fr; gap: 0; }
          .grid-2-compact { grid-template-columns: 1fr; }
          .grid-3-compact { grid-template-columns: 1fr; }
          .res-val-main { font-size: 36px; }
          .floating-card { padding: 20px 16px; border-radius: 12px; }
          .result-card-main { position: static; }
          .stat-grid { grid-template-columns: 1fr 1fr; }
          .preset-pills { gap: 4px; }
          .preset-pill { font-size: 11px; padding: 5px 10px; }
        }
        @media (max-width: 480px) {
          .header-actions { flex-direction: column; gap: 12px; }
          .btn-group { width: 100%; justify-content: space-between; gap: 6px; }
          .action-btn { flex: 1; text-align: center; padding: 10px 6px; justify-content: center; font-size: 12px; }
          .save-status { width: 100%; justify-content: center; }
          .floating-card { padding: 16px 14px; }
          .stat-grid { grid-template-columns: 1fr; }
          .linked-input-row { grid-template-columns: 90px 1fr; }
        }

        /* Print styles */
        .print-summary { display: none; }
        @media print {
          body * { visibility: hidden !important; }
          .calc-container > *:not(.print-summary),
          .calc-header, .floating-card, .calc-grid-2, .calc-breadcrumb,
          .result-card-main, .result-card-dti,
          nav, footer, header, aside, [class*="sidebar"], [class*="navbar"], [class*="footer"] {
            height: 0 !important; max-height: 0 !important; min-height: 0 !important;
            padding: 0 !important; margin: 0 !important; overflow: hidden !important;
          }
          .print-summary, .print-summary * { visibility: visible !important; }
          .print-summary { display: block !important; position: fixed !important; top: 0; left: 0; width: 100% !important; background: white !important; z-index: 99999 !important; padding: 0.4in 0.6in !important; font-family: 'Host Grotesk', system-ui, sans-serif !important; color: #0f172a !important; font-size: 11pt !important; }
          .print-header { display: flex !important; justify-content: space-between !important; align-items: center !important; border-bottom: 2px solid #0F172A !important; padding-bottom: 10px !important; margin-bottom: 16px !important; }
          .print-logo { height: 32px !important; width: auto !important; }
          .print-doc-title { font-size: 14pt !important; font-weight: 700 !important; color: #475569 !important; }
          .print-scenario-info { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 8px 24px !important; background: #F8FAFC !important; border: 1px solid #E2E8F0 !important; border-radius: 8px !important; padding: 12px 16px !important; margin-bottom: 16px !important; }
          .print-info-label { font-size: 7pt !important; font-weight: 700 !important; color: #64748B !important; text-transform: uppercase !important; }
          .print-info-value { font-size: 10pt !important; font-weight: 600 !important; color: #0F172A !important; }
          .print-body { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 24px !important; }
          .print-section-title { font-size: 11pt !important; font-weight: 700 !important; border-bottom: 1px solid #CBD5E1 !important; padding-bottom: 4px !important; margin-bottom: 8px !important; }
          .print-table { width: 100% !important; border-collapse: collapse !important; font-size: 9pt !important; }
          .print-table tr { border-bottom: 1px solid #E2E8F0 !important; }
          .print-table td { padding: 5px 0 !important; }
          .print-table td:first-child { color: #475569 !important; }
          .print-table td:last-child { text-align: right !important; font-weight: 700 !important; }
          .print-table tr.print-total-row { border-top: 2px solid #0F172A !important; }
          .print-table tr.print-total-row td { padding-top: 8px !important; font-size: 12pt !important; font-weight: 800 !important; }
          .print-table tr.print-highlight td { background: #EFF6FF !important; font-weight: 700 !important; }
          .print-table tr.print-highlight td:last-child { color: #2563EB !important; font-weight: 800 !important; }
          .print-results-bar { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 10px !important; margin-top: 16px !important; }
          .print-result-card { background: #F0F9FF !important; border: 1px solid #BAE6FD !important; border-radius: 8px !important; padding: 10px !important; text-align: center !important; }
          .print-result-label { font-size: 7pt !important; font-weight: 600 !important; color: #64748B !important; text-transform: uppercase !important; }
          .print-result-value { font-size: 12pt !important; font-weight: 800 !important; }
          .print-result-value.blue { color: #2563EB !important; }
          .print-result-value.green { color: #059669 !important; }
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
          <span className="bc-current">VA Entitlement</span>
        </div>

        {/* ============================
            HEADER BAR
            ============================ */}
        <div className="calc-header">
          <div className="header-left">
            <h1 className="calc-title">Remaining VA Entitlement Calculator</h1>
            <p className="calc-subtitle">Calculate remaining entitlement, maximum $0-down purchase price, and VA funding fee.</p>
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

        {/* ============================
            LOAD SCENARIOS MODAL
            ============================ */}
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
                  saveLimit === Infinity ? <><i className="fa-solid fa-infinity" style={{ marginRight: 4 }}></i> {scenarios.length} saved scenarios (unlimited)</> :
                  <><i className="fa-solid fa-cloud" style={{ marginRight: 4 }}></i> {scenarios.length} of {saveLimit} saves used</>
                }
              </div>
              <div className="modal-list">
                {loadingScenarios ? (
                  <div className="modal-loading"><div className="modal-spinner"></div><span>Loading scenarios...</span></div>
                ) : !userEmail ? (
                  <div className="modal-empty">
                    <div className="modal-empty-icon"><i className="fa-solid fa-lock"></i></div>
                    <p className="modal-empty-title">Log in to view saved scenarios</p>
                    <p className="modal-empty-text">Your scenarios are saved to the cloud and sync across devices.</p>
                  </div>
                ) : scenarios.length === 0 ? (
                  <>
                    <div className="modal-empty">
                      <div className="modal-empty-icon"><i className="fa-solid fa-folder-open"></i></div>
                      <p className="modal-empty-title">No saved scenarios</p>
                      <p className="modal-empty-text">Save your first scenario using the Save button above.</p>
                    </div>
                    {saveLimit === 0 && (
                      <div className="modal-upgrade">
                        <p className="modal-upgrade-text">Upgrade to save scenarios and access them on any device.</p>
                        <button className="modal-upgrade-btn" onClick={() => { setShowLoadModal(false); window.location.href = "/pricing"; }}>View Plans</button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {scenarios.map((s) => {
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
                    })}
                    {saveLimit !== Infinity && saveLimit !== 0 && currentSaveCount >= saveLimit && (
                      <div className="modal-upgrade">
                        <p className="modal-upgrade-text">You've reached your {saveLimit}-scenario limit. Upgrade to PRO for unlimited saves.</p>
                        <button className="modal-upgrade-btn" onClick={() => { setShowLoadModal(false); window.location.href = "/pricing"; }}>Upgrade to PRO</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================
            RENAME MODAL
            ============================ */}
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
                  <input
                    type="text"
                    className="calc-input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") confirmRename(); }}
                    placeholder="Enter new name..."
                    autoFocus
                  />
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => { setShowRenameModal(false); setRenameTargetId(null); }} className="action-btn" style={{ background: "#64748B" }}>Cancel</button>
                  <button onClick={confirmRename} className="action-btn btn-save">Rename</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================
            CARD 1: SCENARIO DETAILS
            ============================ */}
        <div className="floating-card">
          <h3 className="card-title"><i className="fa-solid fa-file-lines"></i> Scenario Details</h3>
          <div className="grid-3-compact">
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Scenario Name <span className="req">*</span></label>
              <input type="text" className={`calc-input${emptyClass(scenName)}`} value={scenName} onChange={(e) => setScenName(e.target.value)} placeholder="e.g. Smith VA Purchase" />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Date</label>
              <input type="date" className="calc-input" value={scenDate} onChange={(e) => setScenDate(e.target.value)} />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Borrower Name</label>
              <input type="text" className="calc-input" value={borName} onChange={(e) => setBorName(e.target.value)} placeholder="e.g. John Smith" />
            </div>
          </div>
        </div>

        {/* ============================
            TWO-COLUMN LAYOUT
            ============================ */}
        <div className="calc-grid-2">

          {/* LEFT COLUMN: All Inputs */}
          <div>

            {/* CARD 2: ENTITLEMENT STATUS — the MAIN feature */}
            <div className="floating-card">
              <h3 className="card-title"><i className="fa-solid fa-flag-usa"></i> Entitlement Status</h3>

              {/* Toggle: Full / Partial */}
              <div className="entitlement-toggle">
                <button
                  type="button"
                  className={`toggle-btn${entitlementType === "full" ? " active" : ""}`}
                  onClick={() => setEntitlementType("full")}
                >
                  Full Entitlement
                </button>
                <button
                  type="button"
                  className={`toggle-btn${entitlementType === "partial" ? " active" : ""}`}
                  onClick={() => setEntitlementType("partial")}
                >
                  Partial Entitlement
                </button>
              </div>

              {/* Full: green info callout */}
              {entitlementType === "full" && (
                <div className="info-callout success">
                  <i className="fa-solid fa-circle-check"></i>
                  <div>
                    <strong>Full entitlement = No VA loan limit.</strong> Veterans with full entitlement can purchase at any price with $0 down payment. The VA guarantees 25% of the loan amount regardless of the loan size.
                  </div>
                </div>
              )}

              {/* Partial: warning + fields */}
              {entitlementType === "partial" && (
                <>
                  <div className="info-callout warning">
                    <i className="fa-solid fa-triangle-exclamation"></i>
                    <div>
                      <strong>Partial entitlement</strong> means some entitlement is currently in use on an existing VA loan. The remaining entitlement determines the maximum $0-down purchase price.
                    </div>
                  </div>

                  <div style={{ marginTop: 20 }}>
                    <div className="input-group">
                      <label>County One-Unit Loan Limit (2026) <span className="req">*</span></label>
                      <input
                        type="text"
                        className={`calc-input${emptyClass(countyLimit)}`}
                        value={countyLimit}
                        onChange={(e) => handleCurrencyChange(e.target.value, setCountyLimit)}
                        onBlur={() => handleCalcFieldBlur(countyLimit, setCountyLimit)}
                        onKeyDown={(e) => handleCalcFieldKeyDown(e, countyLimit, setCountyLimit)}
                        placeholder="e.g. 832,750"
                      />
                    </div>

                    {/* Quick preset pills */}
                    <div className="preset-pills">
                      {[
                        { label: "Baseline ($832,750)", value: "832,750" },
                        { label: "High-Cost ($1,149,825)", value: "1,149,825" },
                        { label: "Ceiling ($1,249,125)", value: "1,249,125" },
                        { label: "AK/HI/GU/USVI ($1,873,675)", value: "1,873,675" },
                      ].map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          className={`preset-pill${countyLimit === p.value ? " active" : ""}`}
                          onClick={() => setCountyLimit(p.value)}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    <div className="input-group" style={{ marginTop: 16 }}>
                      <label>Entitlement Already Used ($) <i className="fa-solid fa-circle-info" style={{ color: "#94A3B8", cursor: "help" }} title="Found on your COE under 'Prior Loans charged to entitlement' in the 'Entitlement Charged' column."></i></label>
                      <input
                        type="text"
                        className={`calc-input${emptyClass(entitlementUsed)}`}
                        value={entitlementUsed}
                        onChange={(e) => handleCurrencyChange(e.target.value, setEntitlementUsed)}
                        onBlur={() => handleCalcFieldBlur(entitlementUsed, setEntitlementUsed)}
                        onKeyDown={(e) => handleCalcFieldKeyDown(e, entitlementUsed, setEntitlementUsed)}
                        placeholder="e.g. 50,000"
                      />
                    </div>

                    {/* REMAINING ENTITLEMENT — primary result shown inline */}
                    <div style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)", borderRadius: 12, padding: "20px 20px", marginBottom: 16 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Remaining Entitlement</div>
                          <div style={{ fontSize: 24, fontWeight: 800, color: "#38BDF8" }}>{fmt(r.remaining >= 0 ? r.remaining : 0)}</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Max $0-Down Purchase</div>
                          <div style={{ fontSize: 24, fontWeight: 800, color: "#34D399" }}>{fmt(r.maxZeroDown)}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "center", marginTop: 10, fontSize: 12, color: "#94A3B8" }}>
                        Max Guaranty: {fmt(r.maxGuaranty)} (25% of {fmt(r.countyVal)})
                      </div>
                    </div>

                    <div style={{ marginTop: 4 }}>
                      <a href="https://www.fhfa.gov/data/conforming-loan-limit" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#2563EB", fontWeight: 600, textDecoration: "none" }}>
                        <i className="fa-solid fa-arrow-up-right-from-square" style={{ marginRight: 4, fontSize: 10 }}></i>
                        Look up county limits on FHFA.gov
                      </a>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* CARD 3: VA FUNDING FEE — moved up, core to VA loans */}
            <div className="floating-card">
              <h3 className="card-title"><i className="fa-solid fa-percent"></i> VA Funding Fee</h3>

              <div className="grid-2-compact">
                <div className="input-group">
                  <label>Loan Purpose</label>
                  <select className="calc-input" value={loanPurpose} onChange={(e) => handleLoanPurposeChange(e.target.value)}>
                    <option value="purchase">Purchase / Construction</option>
                    <option value="cashout">Cash-Out Refinance</option>
                    <option value="irrrl">IRRRL (Streamline Refi)</option>
                    <option value="manufactured">Manufactured Home</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>VA Loan Usage</label>
                  <select className="calc-input" value={loanUsage} onChange={(e) => handleLoanUsageChange(e.target.value)}>
                    <option value="first">First-Time Use</option>
                    <option value="subsequent">Subsequent Use</option>
                  </select>
                </div>
              </div>

              <div className="grid-2-compact">
                <div className="input-group">
                  <label>Funding Fee Exempt?</label>
                  <select className="calc-input" value={feeExempt} onChange={(e) => handleFeeExemptChange(e.target.value)}>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Funding Fee Rate (%)</label>
                  <div className="fee-rate-wrapper">
                    <div className="input-with-suffix">
                      <input
                        type="text"
                        className={`calc-input${r.isExempt ? "" : emptyClass(feeRateInput)}`}
                        value={r.isExempt ? "0.00" : feeRateInput}
                        onChange={(e) => handleFeeRateManualChange(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } }}
                        placeholder="e.g. 2.15"
                        disabled={r.isExempt}
                        style={{ paddingRight: 28 }}
                      />
                      <span className="input-suffix">%</span>
                    </div>
                    {!r.isExempt && feeRateOverride && (
                      <div className="fee-rate-hint">
                        Auto: {getAutoFeeRate(loanPurpose, loanUsage, feeExempt, parseFloat(downPaymentPct) || 0).toFixed(2)}% &mdash; <span className="auto-label" onClick={() => setFeeRateOverride(false)}>Reset to auto</span>
                      </div>
                    )}
                    {r.isExempt && (
                      <div className="fee-rate-hint">Fee exempt &mdash; rate is 0%</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Loan Amount field — only for non-purchase scenarios */}
              {!r.isPurchase && (
                <div className="input-group">
                  <label>Loan Amount ($) <span className="req">*</span></label>
                  <input
                    type="text"
                    className={`calc-input${emptyClass(refiLoanAmount)}`}
                    value={refiLoanAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/[+\-*/]/.test(val.replace(/,/g, ""))) { setRefiLoanAmount(val); }
                      else { setRefiLoanAmount(formatNumberString(val)); }
                    }}
                    onBlur={() => {
                      if (refiLoanAmount && /[+\-*/]/.test(refiLoanAmount.replace(/,/g, ""))) {
                        const result = evaluateExpression(refiLoanAmount);
                        if (!isNaN(result)) { setRefiLoanAmount(formatNumberString(String(result))); return; }
                      }
                      setRefiLoanAmount(formatNumberString(refiLoanAmount));
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } }}
                    placeholder="e.g. 350,000"
                  />
                </div>
              )}

              <div className="grid-2-compact" style={{ marginBottom: 0 }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Funding Fee Amount</label>
                  <div className="computed-display">
                    {r.isExempt ? "$0 (Exempt)" : r.baseLoan > 0 ? fmt(r.feeAmount) : "$0"}
                  </div>
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Total Loan (w/ Fee)</label>
                  <div className="computed-display highlight">
                    {r.baseLoan > 0 ? fmt(r.totalLoan) : "$0"}
                  </div>
                </div>
              </div>

              {/* Collapsible: VA Funding Fee Reference Chart */}
              <div style={{ marginTop: 16 }}>
                <button type="button" className="ref-toggle" onClick={() => setShowFeeRef(!showFeeRef)}>
                  <i className={`fa-solid fa-chevron-right${showFeeRef ? " open" : ""}`}></i>
                  VA Funding Fee Reference Chart
                </button>
                {showFeeRef && (
                  <div className="ref-box">
                    <table className="ref-table">
                      <thead>
                        <tr>
                          <th>Loan Type</th>
                          <th>First Use</th>
                          <th>Subsequent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const dpPct = r.dpPct;
                          const isExempt = r.isExempt;
                          const rows = [
                            { label: "Purchase < 5% down", first: "2.15%", sub: "3.30%", match: !isExempt && loanPurpose === "purchase" && dpPct < 5 },
                            { label: "Purchase 5%+ down", first: "1.50%", sub: "1.50%", match: !isExempt && loanPurpose === "purchase" && dpPct >= 5 && dpPct < 10 },
                            { label: "Purchase 10%+ down", first: "1.25%", sub: "1.25%", match: !isExempt && loanPurpose === "purchase" && dpPct >= 10 },
                            { label: "Cash-Out Refinance", first: "2.15%", sub: "3.30%", match: !isExempt && loanPurpose === "cashout" },
                            { label: "IRRRL (Streamline Refi)", first: "0.50%", sub: "0.50%", match: !isExempt && loanPurpose === "irrrl" },
                            { label: "Manufactured Home", first: "1.00%", sub: "1.00%", match: !isExempt && loanPurpose === "manufactured" },
                          ];
                          return rows.map((row, i) => (
                            <tr key={i} className={row.match ? "highlight-row" : ""}>
                              <td>{row.label}</td>
                              <td>{row.first}</td>
                              <td>{row.sub}</td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                    <div style={{ marginTop: 10, fontSize: 12, color: "#64748B", lineHeight: 1.5 }}>
                      <strong>Exempt:</strong> Veterans receiving VA disability compensation, Purple Heart recipients, and surviving spouses are exempt from the funding fee.
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <a href="https://www.va.gov/housing-assistance/home-loans/funding-fee-and-closing-costs/" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#2563EB", fontWeight: 600, textDecoration: "none" }}>
                        <i className="fa-solid fa-arrow-up-right-from-square" style={{ marginRight: 4, fontSize: 10 }}></i>
                        VA.gov Funding Fee Details
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* CARD 4: PURCHASE SCENARIO — only shown for Purchase/Construction */}
            {r.isPurchase && <div className="floating-card">
              <h3 className="card-title">
                <i className="fa-solid fa-house-chimney"></i> Purchase Scenario
                <span className="addon-badge">Optional</span>
              </h3>

              <div className="info-callout info" style={{ marginTop: 0, marginBottom: 16 }}>
                <i className="fa-solid fa-circle-info"></i>
                <div>Enter a purchase price to see the full loan breakdown with funding fee. Leave blank to just calculate entitlement.</div>
              </div>

              <div className="input-group">
                <label>Purchase Price ($)</label>
                <input
                  type="text"
                  className={`calc-input${emptyClass(purchasePrice)}`}
                  value={purchasePrice}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  onBlur={handlePriceBlur}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handlePriceBlur(); e.target.blur(); } }}
                  placeholder="e.g. 500,000"
                />
              </div>

              <div className="input-group">
                <label>Down Payment</label>
                <div className="linked-input-row">
                  <div className="input-with-suffix">
                    <input
                      type="text"
                      className={`calc-input${emptyClass(downPaymentPct)}`}
                      value={downPaymentPct}
                      onChange={(e) => handleDownPctChange(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } }}
                      placeholder="0"
                      style={{ textAlign: "center", paddingRight: 28 }}
                    />
                    <span className="input-suffix">%</span>
                  </div>
                  <input
                    type="text"
                    className={`calc-input${emptyClass(downPayment)}`}
                    value={downPayment}
                    onChange={(e) => handleDownAmtChange(e.target.value)}
                    onBlur={handleDownAmtBlur}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleDownAmtBlur(); e.target.blur(); } }}
                    placeholder="e.g. 0"
                  />
                </div>
              </div>

              {/* Computed loan summary (only when purchase price is entered) */}
              {r.priceVal > 0 && (
                <div className="grid-2-compact" style={{ marginTop: 4 }}>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label>Base Loan Amount</label>
                    <div className="computed-display">{fmt(r.baseLoan)}</div>
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label>Total Loan (w/ Funding Fee)</label>
                    <div className="computed-display highlight">{fmt(r.totalLoan)}</div>
                  </div>
                </div>
              )}
            </div>}

            {/* CARD 5: HOW VA ENTITLEMENT WORKS */}
            <div className="floating-card">
              <h3 className="card-title"><i className="fa-solid fa-circle-info"></i> How VA Entitlement Works</h3>
              <button type="button" className="ref-toggle" onClick={() => setShowHowItWorks(!showHowItWorks)}>
                <i className={`fa-solid fa-chevron-right${showHowItWorks ? " open" : ""}`}></i>
                Understanding Basic, Bonus &amp; Full Entitlement
              </button>
              {showHowItWorks && (
                <div className="ref-box">
                  <div style={{ fontSize: 13, lineHeight: 1.7, color: "#334155" }}>
                    <p style={{ margin: "0 0 12px 0" }}>
                      <strong>Basic Entitlement:</strong> $36,000 — the original VA guaranty amount. This covers loans up to $144,000 ($36,000 &times; 4).
                    </p>
                    <p style={{ margin: "0 0 12px 0" }}>
                      <strong>Bonus (Tier 2) Entitlement:</strong> County Loan Limit &times; 25% &minus; $36,000. This additional entitlement covers higher-value loans.
                    </p>
                    <p style={{ margin: "0 0 12px 0" }}>
                      <strong>Full Entitlement:</strong> County Loan Limit &times; 25%. When a veteran has full entitlement available, there is <em>no loan limit</em> — the VA guarantees 25% of any loan amount.
                    </p>
                    <p style={{ margin: "0 0 12px 0" }}>
                      <strong>Partial Entitlement:</strong> When some entitlement is tied up in an existing VA loan, the remaining entitlement determines the max $0-down purchase price:
                    </p>
                    <p style={{ margin: "0 0 0 16px", fontWeight: 600, color: "#1E40AF" }}>
                      Max $0-Down Purchase = Remaining Entitlement &times; 4
                    </p>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN: Results */}
          <div>

            {/* DARK RESULTS CARD */}
            <div className="result-card-main">
              {/* Hero value — always show entitlement prominently */}
              <span className="res-label-main">Max $0-Down Purchase Price</span>
              {r.isFull ? (
                <div className="res-val-main no-limit">No Limit</div>
              ) : (
                <div className="res-val-main">{r.maxZeroDown > 0 ? fmt(r.maxZeroDown) : "$0"}</div>
              )}

              {/* 4 stat cards (2x2) */}
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-card-label">Entitlement Type</div>
                  <div className={`stat-card-value${r.isFull ? " green" : " amber"}`}>
                    {r.isFull ? "Full" : "Partial"}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">Remaining Entitlement</div>
                  <div className="stat-card-value blue">
                    {r.isFull ? "Full" : fmt(r.remaining)}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">County Max Guaranty</div>
                  <div className="stat-card-value">
                    {r.isFull ? "N/A" : fmt(r.maxGuaranty)}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-label">Funding Fee</div>
                  <div className={`stat-card-value${r.isExempt ? " green" : ""}`}>
                    {r.isExempt ? "Exempt" : r.priceVal > 0 ? fmt(r.feeAmount) : r.feeRate.toFixed(2) + "%"}
                  </div>
                </div>
              </div>

              <hr className="divider" />

              {/* Entitlement Breakdown — always shown prominently */}
              <div className="breakdown-section">
                <div className="breakdown-title">Entitlement Breakdown</div>
                {r.isFull ? (
                  <>
                    <div className="breakdown-row">
                      <span>Status</span>
                      <span>Full Entitlement</span>
                    </div>
                    <div className="breakdown-row">
                      <span>VA Loan Limit</span>
                      <span>None</span>
                    </div>
                    <div className="breakdown-row total">
                      <span>Down Payment Required</span>
                      <span>$0</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="breakdown-row">
                      <span>County Loan Limit (2026)</span>
                      <span>{fmt(r.countyVal)}</span>
                    </div>
                    <div className="breakdown-row">
                      <span>Max Guaranty (25%)</span>
                      <span>{fmt(r.maxGuaranty)}</span>
                    </div>
                    <div className="breakdown-row negative">
                      <span>Entitlement Used</span>
                      <span>&minus;{fmt(r.usedVal)}</span>
                    </div>
                    <div className="breakdown-row total">
                      <span>Remaining Entitlement</span>
                      <span>{fmt(r.remaining)}</span>
                    </div>
                    <div className="breakdown-row" style={{ marginTop: 8 }}>
                      <span>Max $0-Down Purchase (&times;4)</span>
                      <span style={{ color: "#38BDF8", fontWeight: 700 }}>{fmt(r.maxZeroDown)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Down Payment Alert — only when purchase price entered */}
              {r.priceVal > 0 && (
                <>
                  {!r.isFull && r.priceVal > r.maxZeroDown && r.dpVal < r.dpRequired ? (
                    <div className="dp-alert">
                      <div className="dp-alert-title">Down Payment Required</div>
                      <div className="dp-alert-value">{fmt(r.dpRequired)}</div>
                      <div className="dp-alert-note">Purchase price exceeds max $0-down amount. A 25% down payment is required on the difference of {fmt(r.priceVal - r.maxZeroDown)}.</div>
                    </div>
                  ) : (
                    <div className="dp-success">
                      <i className="fa-solid fa-circle-check"></i>
                      <span>No Down Payment Required</span>
                    </div>
                  )}
                </>
              )}

              {/* Loan Summary — shown when there's a loan amount (purchase or refi) */}
              {r.baseLoan > 0 && (
                <>
                  <hr className="divider" />
                  <div className="breakdown-section">
                    <div className="breakdown-title">Loan Summary</div>
                    {r.isPurchase ? (
                      <>
                        <div className="breakdown-row">
                          <span>Purchase Price</span>
                          <span>{fmt(r.priceVal)}</span>
                        </div>
                        <div className="breakdown-row negative">
                          <span>Down Payment ({r.dpPct.toFixed(1)}%)</span>
                          <span>&minus;{fmt(r.dpVal)}</span>
                        </div>
                        <div className="breakdown-row">
                          <span>Base Loan Amount</span>
                          <span>{fmt(r.baseLoan)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="breakdown-row">
                        <span>Loan Amount</span>
                        <span>{fmt(r.baseLoan)}</span>
                      </div>
                    )}
                    <div className="breakdown-row">
                      <span>VA Funding Fee ({r.isExempt ? "Exempt" : r.feeRate.toFixed(2) + "%"})</span>
                      <span>+{fmt(r.feeAmount)}</span>
                    </div>
                    <div className="breakdown-row total">
                      <span>Total Loan Amount</span>
                      <span>{fmt(r.totalLoan)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

          </div>
        </div>

        {/* ============================
            PRINT SUMMARY
            ============================ */}
        <div id="va-print-summary" className="print-summary">
          <div className="print-header">
            <img className="print-logo" src="https://cdn.prod.website-files.com/694e4aaf5f511ad7901b74bc/69576dcb21edb9d479222c02_Logo_Horizontal_Blue.png" alt="mtg.broker" />
            <div className="print-doc-title">VA Entitlement Calculator</div>
          </div>
          <div className="print-scenario-info" id="vaPrintScenarioInfo"></div>
          <div className="print-body">
            <div>
              <div className="print-section-title">Entitlement Analysis</div>
              <table className="print-table" id="vaPrintEntitlement"></table>
            </div>
            <div>
              <div className="print-section-title">Loan Summary</div>
              <table className="print-table" id="vaPrintLoan"></table>
            </div>
          </div>
          <div className="print-results-bar" id="vaPrintResultsBar"></div>
          <div className="print-footer">Generated from mtg.broker &mdash; <span id="vaPrintDate"></span></div>
        </div>

      </div>
    </>
  );
}
