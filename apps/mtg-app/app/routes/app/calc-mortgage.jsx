import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router";
import { getUserEmail, getUserPlan } from "../../lib/auth";

export function meta() {
  return [{ title: "Mortgage Calculator — MtgBroker" }];
}

/* ================================================
   CONFIGURATION
   ================================================ */
const API_BASE = "https://mtg-broker-api.rich-e00.workers.dev";
const CALC_TYPE = "Mortgage Calculator";

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
export default function MortgageCalculator() {
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
  const [propAddress, setPropAddress] = useState("");

  /* --- Form state: Loan Information --- */
  const [loanAmount, setLoanAmount] = useState("350,000");
  const [intRate, setIntRate] = useState("6.5");
  const [loanTerm, setLoanTerm] = useState("30");
  const [annualIns, setAnnualIns] = useState("1,200");
  const [annualTax, setAnnualTax] = useState("4,500");
  const [annualSuppIns, setAnnualSuppIns] = useState("0");
  const [annualHOA, setAnnualHOA] = useState("0");
  const [pmiRate, setPmiRate] = useState("0.0");

  /* ==============================================
     CALCULATIONS
     ============================================== */
  const results = useMemo(() => {
    const amount = parseRaw(loanAmount);
    const rate = parseFloat(intRate) || 0;
    const years = parseInt(loanTerm) || 30;
    const ins = parseRaw(annualIns);
    const tax = parseRaw(annualTax);
    const suppIns = parseRaw(annualSuppIns);
    const hoa = parseRaw(annualHOA);
    const pmi = parseFloat(pmiRate) || 0;

    // P&I calculation
    let pi = 0;
    const n = years * 12;
    if (amount > 0 && rate > 0 && n > 0) {
      const r = rate / 100 / 12;
      pi = amount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    } else if (amount > 0 && rate === 0 && n > 0) {
      pi = amount / n;
    }

    const monthlyIns = ins / 12;
    const monthlyTax = tax / 12;
    const monthlySuppIns = suppIns / 12;
    const monthlyHOA = hoa / 12;
    const monthlyPMI = (amount * pmi / 100) / 12;

    const total = pi + monthlyIns + monthlyTax + monthlySuppIns + monthlyHOA + monthlyPMI;

    return { amount, rate, years, pi, monthlyIns, monthlyTax, monthlySuppIns, monthlyHOA, monthlyPMI, total };
  }, [loanAmount, intRate, loanTerm, annualIns, annualTax, annualSuppIns, annualHOA, pmiRate]);

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

  // Enter key handler for calc fields
  const handleCalcFieldKeyDown = useCallback((e, value, setter, type) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (type === "currency") {
        handleCurrencyBlur(value, setter);
      } else if (type === "rate") {
        // evaluate expression for rate fields
        if (value && /[+\-*/]/.test(String(value).replace(/,/g, ""))) {
          const result = evaluateExpression(String(value));
          if (!isNaN(result)) { setter(String(result)); e.target.blur(); return; }
        }
        e.target.blur();
        return;
      }
      e.target.blur();
    }
  }, [handleCurrencyBlur]);

  /* ==============================================
     SAVE / LOAD / DELETE / RENAME / CLEAR / PRINT
     ============================================== */
  const collectFormData = useCallback(() => ({
    meta: { name: scenName, date: scenDate, borrower: borName, address: propAddress },
    calc: { amount: loanAmount, rate: intRate, term: loanTerm, ins: annualIns, tax: annualTax, suppIns: annualSuppIns, hoa: annualHOA, pmi: pmiRate },
  }), [scenName, scenDate, borName, propAddress, loanAmount, intRate, loanTerm, annualIns, annualTax, annualSuppIns, annualHOA, pmiRate]);

  const populateForm = useCallback((data) => {
    if (!data) return;
    if (data.meta) {
      if (data.meta.name) setScenName(data.meta.name);
      if (data.meta.date) setScenDate(data.meta.date);
      if (data.meta.borrower) setBorName(data.meta.borrower);
      if (data.meta.address) setPropAddress(data.meta.address);
    }
    if (data.calc) {
      const c = data.calc;
      if (c.amount !== undefined) setLoanAmount(c.amount);
      if (c.rate !== undefined) setIntRate(c.rate);
      if (c.term !== undefined) setLoanTerm(c.term);
      if (c.ins !== undefined) setAnnualIns(c.ins);
      if (c.tax !== undefined) setAnnualTax(c.tax);
      if (c.suppIns !== undefined) setAnnualSuppIns(c.suppIns);
      if (c.hoa !== undefined) setAnnualHOA(c.hoa);
      if (c.pmi !== undefined) setPmiRate(c.pmi);
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
    setPropAddress("");
    setLoanAmount("350,000"); setIntRate("6.5"); setLoanTerm("30");
    setAnnualIns("1,200"); setAnnualTax("4,500"); setAnnualSuppIns("0"); setAnnualHOA("0"); setPmiRate("0.0");
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
      `<div><div class="print-info-label">Date</div><div class="print-info-value">${dateDisplay}</div></div>` +
      `<div><div class="print-info-label">Borrower</div><div class="print-info-value">${escapeHtml(borrower)}</div></div>` +
      `<div><div class="print-info-label">Property</div><div class="print-info-value">${escapeHtml(address)}</div></div>`;

    // Loan Information table
    document.getElementById("printLoanTable").innerHTML =
      `<tr><td>Loan Amount</td><td>${fmt(r.amount)}</td></tr>` +
      `<tr><td>Interest Rate</td><td>${r.rate}%</td></tr>` +
      `<tr><td>Loan Term</td><td>${r.years} Years</td></tr>` +
      `<tr><td>Home Insurance (HOI) / Yr</td><td>${fmt(parseRaw(annualIns))}</td></tr>` +
      `<tr><td>Property Tax / Yr</td><td>${fmt(parseRaw(annualTax))}</td></tr>` +
      `<tr><td>Supplemental Ins / Yr</td><td>${fmt(parseRaw(annualSuppIns))}</td></tr>` +
      `<tr><td>HOA / Yr</td><td>${fmt(parseRaw(annualHOA))}</td></tr>` +
      `<tr><td>Mortgage Insurance (PMI)</td><td>${parseFloat(pmiRate) || 0}%</td></tr>`;

    // Monthly Breakdown table (Insurance BEFORE Tax)
    document.getElementById("printBreakdownTable").innerHTML =
      `<tr><td>Principal &amp; Interest</td><td>${fmtDec(r.pi)}</td></tr>` +
      `<tr><td>Home Insurance (HOI)</td><td>${fmtDec(r.monthlyIns)}</td></tr>` +
      `<tr><td>Property Tax</td><td>${fmtDec(r.monthlyTax)}</td></tr>` +
      `<tr><td>Supplemental Insurance</td><td>${fmtDec(r.monthlySuppIns)}</td></tr>` +
      `<tr><td>HOA</td><td>${fmtDec(r.monthlyHOA)}</td></tr>` +
      `<tr><td>Mortgage Insurance (PMI)</td><td>${fmtDec(r.monthlyPMI)}</td></tr>` +
      `<tr class="print-total-row"><td>Total Monthly Payment</td><td>${fmtDec(r.total)}</td></tr>`;

    document.getElementById("printDate").textContent = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    setTimeout(() => window.print(), 150);
  }, [scenName, scenDate, borName, propAddress, results, annualIns, annualTax, annualSuppIns, annualHOA, pmiRate]);

  /* --- Zillow lookup --- */
  const openZillow = useCallback(() => {
    const addr = propAddress.trim();
    if (!addr) { alert("Please enter a property address first."); return; }
    const slug = addr.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9\-]/g, "");
    window.open(`https://www.zillow.com/homes/${slug}_rb/`, "_blank");
  }, [propAddress]);

  /* --- Derived --- */
  const r = results;
  const dotClass = saveStatus.state ? `save-status-dot ${saveStatus.state}` : "save-status-dot";

  return (
    <>
      {/* ================================================
          SCOPED CSS
          ================================================ */}
      <style>{`
        @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css');

        /* Breadcrumb */
        .calc-breadcrumb { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; font-size: 14px; color: #64748B; }
        .calc-breadcrumb a { color: #2563EB; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
        .calc-breadcrumb a:hover { color: #1D4ED8; text-decoration: underline; }
        .calc-breadcrumb .bc-sep { color: #CBD5E1; }
        .calc-breadcrumb .bc-current { color: #0F172A; font-weight: 600; }

        /* Container */
        .calc-container { width: 100%; max-width: 1280px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif; color: #0f172a; box-sizing: border-box; }
        .calc-container * { box-sizing: border-box; }

        /* Dark header bar — SHARP bottom corners, connected to card body */
        .calc-header { background: #0F172A; padding: 16px 20px; border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; box-shadow: 0 4px 16px rgba(15,23,42,0.12); }
        .header-left { flex: 1 1 auto; min-width: 200px; }
        .calc-title { color: white; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
        .calc-subtitle { color: #94A3B8; margin: 4px 0 0 0; font-size: 13px; font-weight: 400; }
        .header-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .btn-group { display: flex; gap: 8px; }
        .action-btn { border: none; padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; color: white; transition: filter 0.2s, transform 0.1s; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; font-family: system-ui, -apple-system, sans-serif; }
        .action-btn:hover { filter: brightness(110%); }
        .action-btn:active { transform: translateY(1px); }
        .action-btn:disabled { opacity: 0.5; cursor: not-allowed; filter: none; transform: none; }
        .btn-save { background: #059669; }
        .btn-load { background: #2563EB; }
        .btn-print { background: #7C3AED; }
        .btn-clear { background: #DC2626; }

        /* Save status */
        .save-status { display: flex; align-items: center; gap: 6px; }
        .save-status-dot { width: 8px; height: 8px; border-radius: 50%; background: #64748B; flex-shrink: 0; }
        .save-status-dot.saving { background: #F59E0B; animation: pulse-dot 1s infinite; }
        .save-status-dot.saved { background: #10B981; }
        .save-status-dot.error { background: #EF4444; }
        .save-status-dot.loading { background: #3B82F6; animation: pulse-dot 1s infinite; }
        .save-status-text { color: #94A3B8; font-size: 12px; font-weight: 500; white-space: nowrap; }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

        /* Card body — connected to header, SHARP top corners */
        .app-card-body { background: #FFFFFF; border: 1px solid #E2E8F0; border-top: none; border-radius: 0 0 12px 12px; padding: 32px; }

        /* Scenario details box */
        .standard-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 20px; margin-bottom: 28px; }
        .standard-box .mini-header { font-size: 13px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 16px 0; }

        /* Input group */
        .input-group { margin-bottom: 16px; }
        .input-group:last-child { margin-bottom: 0; }
        .input-group label { display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px; }
        .calc-input { width: 100%; padding: 10px 12px; border: 1px solid #CBD5E1; border-radius: 8px; font-size: 15px; font-family: system-ui, -apple-system, sans-serif; color: #0f172a; background: #FFFFFF; transition: border-color 0.2s, box-shadow 0.2s; }
        .calc-input:focus { outline: none; border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
        .calc-input::placeholder { color: #94A3B8; }
        .calc-input.field-empty { background-color: #FFFBEB; border-color: #FDE68A; }
        .calc-input.readonly { background: #F1F5F9; color: #64748B; cursor: not-allowed; }
        .req { color: #DC2626; }

        /* Grid layouts */
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .grid-full { display: grid; grid-template-columns: 1fr; gap: 16px; }

        /* Address row with Zillow button */
        .address-row { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: end; }
        .zillow-btn { padding: 10px 16px; border: none; border-radius: 8px; background: #2563EB; color: white; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; transition: background 0.2s; font-family: system-ui, -apple-system, sans-serif; }
        .zillow-btn:hover { background: #1D4ED8; }

        /* Calc grid — two columns */
        .calc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
        .col-inputs { padding-right: 48px; border-right: 1px solid #E2E8F0; }
        .col-results { padding-left: 48px; }
        .col-title { font-size: 14px; font-weight: 700; color: #0F172A; text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 20px 0; padding-bottom: 10px; border-bottom: 2px solid #E2E8F0; display: flex; align-items: center; gap: 8px; }
        .col-title i { color: #2563EB; font-size: 14px; }

        /* Input helper */
        .input-helper { font-size: 12px; color: #94A3B8; margin-top: 4px; }
        .input-with-suffix { position: relative; display: flex; align-items: center; }
        .input-with-suffix input { padding-right: 36px; }
        .input-suffix { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: #94A3B8; font-size: 13px; font-weight: 600; pointer-events: none; }

        /* Result box (light blue) */
        .result-box { background: #F0F9FF; border: 1px solid #BAE6FD; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px; }
        .result-label-sm { font-size: 13px; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; }
        .result-big { font-size: 42px; font-weight: 800; color: #0C4A6E; line-height: 1.1; letter-spacing: -0.02em; }

        /* Breakdown list */
        .breakdown-list { margin-top: 8px; }
        .breakdown-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #E2E8F0; }
        .breakdown-row:last-child { border-bottom: none; }
        .breakdown-row .bd-label { font-size: 14px; color: #475569; }
        .breakdown-row .bd-value { font-size: 14px; font-weight: 700; color: #0F172A; }

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

        /* Rename modal */
        .rename-input { width: 100%; padding: 10px 12px; border: 1px solid #CBD5E1; border-radius: 8px; font-size: 14px; margin: 16px 0; font-family: system-ui, -apple-system, sans-serif; }
        .rename-input:focus { outline: none; border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
        .rename-actions { display: flex; gap: 8px; justify-content: flex-end; padding: 0 20px 16px; }
        .rename-cancel { padding: 8px 16px; border: 1px solid #E2E8F0; border-radius: 6px; background: white; color: #475569; font-size: 13px; font-weight: 600; cursor: pointer; }
        .rename-cancel:hover { background: #F8FAFC; }
        .rename-confirm { padding: 8px 16px; border: none; border-radius: 6px; background: #2563EB; color: white; font-size: 13px; font-weight: 600; cursor: pointer; }
        .rename-confirm:hover { background: #1D4ED8; }

        /* Responsive */
        @media (max-width: 768px) {
          .calc-header { flex-direction: column; align-items: flex-start; }
          .header-left { width: 100%; margin-bottom: 8px; }
          .header-actions { width: 100%; justify-content: space-between; }
          .calc-grid { grid-template-columns: 1fr; }
          .col-inputs { padding-right: 0; border-right: none; border-bottom: 1px solid #E2E8F0; padding-bottom: 28px; margin-bottom: 28px; }
          .col-results { padding-left: 0; }
          .grid-2 { grid-template-columns: 1fr; }
          .address-row { grid-template-columns: 1fr; }
          .app-card-body { padding: 20px 16px; }
        }
        @media (max-width: 480px) {
          .header-actions { flex-direction: column; gap: 12px; }
          .btn-group { width: 100%; justify-content: space-between; gap: 6px; }
          .action-btn { flex: 1; text-align: center; padding: 10px 6px; justify-content: center; font-size: 12px; }
          .save-status { width: 100%; justify-content: center; }
          .app-card-body { padding: 16px 14px; }
        }

        /* Print styles */
        .print-summary { display: none; }
        @media print {
          body * { visibility: hidden !important; }
          .calc-container > *:not(.print-summary),
          .calc-header, .app-card-body, .calc-grid, .calc-breadcrumb,
          nav, footer, header, aside, [class*="sidebar"], [class*="navbar"], [class*="footer"] {
            height: 0 !important; max-height: 0 !important; min-height: 0 !important;
            padding: 0 !important; margin: 0 !important; overflow: hidden !important;
          }
          .print-summary, .print-summary * { visibility: visible !important; }
          .print-summary { display: block !important; position: fixed !important; top: 0; left: 0; width: 100% !important; background: white !important; z-index: 99999 !important; padding: 0.4in 0.6in !important; font-family: system-ui, -apple-system, sans-serif !important; color: #0f172a !important; font-size: 11pt !important; }
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
          <span className="bc-current">Mortgage Calculator</span>
        </div>

        {/* DARK HEADER BAR — connected to card body below */}
        <div className="calc-header">
          <div className="header-left">
            <h1 className="calc-title">Mortgage Calculator</h1>
            <p className="calc-subtitle">Calculate monthly mortgage payments including taxes, insurance, and PMI.</p>
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

        {/* CARD BODY — connected to header above */}
        <div className="app-card-body">

          {/* SCENARIO DETAILS BOX */}
          <div className="standard-box">
            <div className="mini-header">Scenario Details</div>
            <div className="grid-2" style={{ marginBottom: 16 }}>
              <div className="input-group">
                <label>Scenario Name <span className="req">*</span></label>
                <input
                  type="text"
                  className={"calc-input" + emptyClass(scenName)}
                  placeholder="e.g. Smith Purchase"
                  value={scenName}
                  onChange={(e) => setScenName(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label>Date</label>
                <input
                  type="date"
                  className="calc-input"
                  value={scenDate}
                  onChange={(e) => setScenDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid-full" style={{ marginBottom: 16 }}>
              <div className="input-group">
                <label>Borrower Name</label>
                <input
                  type="text"
                  className={"calc-input" + emptyClass(borName)}
                  placeholder="Full name"
                  value={borName}
                  onChange={(e) => setBorName(e.target.value)}
                />
              </div>
            </div>
            <div className="address-row">
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Property Address</label>
                <input
                  type="text"
                  className={"calc-input" + emptyClass(propAddress)}
                  placeholder="123 Main St, City, State"
                  value={propAddress}
                  onChange={(e) => setPropAddress(e.target.value)}
                />
              </div>
              <button className="zillow-btn" onClick={openZillow}>
                <i className="fa-solid fa-magnifying-glass"></i> Zillow Lookup
              </button>
            </div>
          </div>

          {/* CALC GRID — two columns */}
          <div className="calc-grid">

            {/* LEFT COLUMN — Loan Information */}
            <div className="col-inputs">
              <div className="col-title"><i className="fa-solid fa-landmark"></i> Loan Information</div>

              {/* Loan Amount */}
              <div className="input-group">
                <label>Loan Amount ($)</label>
                <input
                  type="text"
                  className={"calc-input" + emptyClass(loanAmount)}
                  placeholder="350,000"
                  value={loanAmount}
                  onChange={(e) => handleCurrencyInput(e.target.value, setLoanAmount)}
                  onBlur={() => handleCurrencyBlur(loanAmount, setLoanAmount)}
                  onKeyDown={(e) => handleCalcFieldKeyDown(e, loanAmount, setLoanAmount, "currency")}
                />
              </div>

              {/* Interest Rate + Term */}
              <div className="grid-2">
                <div className="input-group">
                  <label>Interest Rate (%)</label>
                  <div className="input-with-suffix">
                    <input
                      type="text"
                      className={"calc-input" + emptyClass(intRate)}
                      placeholder="6.5"
                      value={intRate}
                      onChange={(e) => setIntRate(e.target.value)}
                      onBlur={() => {
                        if (intRate && /[+\-*/]/.test(intRate.replace(/,/g, ""))) {
                          const result = evaluateExpression(intRate);
                          if (!isNaN(result)) { setIntRate(String(result)); return; }
                        }
                      }}
                      onKeyDown={(e) => handleCalcFieldKeyDown(e, intRate, setIntRate, "rate")}
                      step="0.125"
                    />
                    <span className="input-suffix">%</span>
                  </div>
                </div>
                <div className="input-group">
                  <label>Term (Years)</label>
                  <input
                    type="number"
                    className="calc-input"
                    value={loanTerm}
                    onChange={(e) => setLoanTerm(e.target.value)}
                    min="1"
                    max="50"
                  />
                </div>
              </div>

              {/* Home Insurance + Property Tax (Insurance BEFORE Tax!) */}
              <div className="grid-2">
                <div className="input-group">
                  <label>Home Ins (HOI) / Yr ($)</label>
                  <input
                    type="text"
                    className={"calc-input" + emptyClass(annualIns)}
                    placeholder="1,200"
                    value={annualIns}
                    onChange={(e) => handleCurrencyInput(e.target.value, setAnnualIns)}
                    onBlur={() => handleCurrencyBlur(annualIns, setAnnualIns)}
                    onKeyDown={(e) => handleCalcFieldKeyDown(e, annualIns, setAnnualIns, "currency")}
                  />
                  <div className="input-helper">{fmtDec(parseRaw(annualIns) / 12)}/mo</div>
                </div>
                <div className="input-group">
                  <label>Prop Tax / Yr ($)</label>
                  <input
                    type="text"
                    className={"calc-input" + emptyClass(annualTax)}
                    placeholder="4,500"
                    value={annualTax}
                    onChange={(e) => handleCurrencyInput(e.target.value, setAnnualTax)}
                    onBlur={() => handleCurrencyBlur(annualTax, setAnnualTax)}
                    onKeyDown={(e) => handleCalcFieldKeyDown(e, annualTax, setAnnualTax, "currency")}
                  />
                  <div className="input-helper">{fmtDec(parseRaw(annualTax) / 12)}/mo</div>
                </div>
              </div>

              {/* Supplemental Insurance + HOA */}
              <div className="grid-2">
                <div className="input-group">
                  <label>Supplemental Ins / Yr ($)</label>
                  <input
                    type="text"
                    className={"calc-input" + emptyClass(annualSuppIns)}
                    placeholder="0"
                    value={annualSuppIns}
                    onChange={(e) => handleCurrencyInput(e.target.value, setAnnualSuppIns)}
                    onBlur={() => handleCurrencyBlur(annualSuppIns, setAnnualSuppIns)}
                    onKeyDown={(e) => handleCalcFieldKeyDown(e, annualSuppIns, setAnnualSuppIns, "currency")}
                  />
                  <div className="input-helper">{fmtDec(parseRaw(annualSuppIns) / 12)}/mo</div>
                </div>
                <div className="input-group">
                  <label>HOA / Yr ($)</label>
                  <input
                    type="text"
                    className={"calc-input" + emptyClass(annualHOA)}
                    placeholder="0"
                    value={annualHOA}
                    onChange={(e) => handleCurrencyInput(e.target.value, setAnnualHOA)}
                    onBlur={() => handleCurrencyBlur(annualHOA, setAnnualHOA)}
                    onKeyDown={(e) => handleCalcFieldKeyDown(e, annualHOA, setAnnualHOA, "currency")}
                  />
                  <div className="input-helper">{fmtDec(parseRaw(annualHOA) / 12)}/mo</div>
                </div>
              </div>

              {/* PMI Rate */}
              <div className="input-group">
                <label>Mortgage Insurance (PMI) %</label>
                <div className="input-with-suffix">
                  <input
                    type="text"
                    className={"calc-input" + emptyClass(pmiRate)}
                    placeholder="0.0"
                    value={pmiRate}
                    onChange={(e) => setPmiRate(e.target.value)}
                    onBlur={() => {
                      if (pmiRate && /[+\-*/]/.test(pmiRate.replace(/,/g, ""))) {
                        const result = evaluateExpression(pmiRate);
                        if (!isNaN(result)) { setPmiRate(String(result)); return; }
                      }
                    }}
                    onKeyDown={(e) => handleCalcFieldKeyDown(e, pmiRate, setPmiRate, "rate")}
                    step="0.01"
                  />
                  <span className="input-suffix">%</span>
                </div>
                {parseFloat(pmiRate) > 0 && (
                  <div className="input-helper">{fmtDec(r.monthlyPMI)}/mo</div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN — Monthly Breakdown */}
            <div className="col-results">
              <div className="col-title"><i className="fa-solid fa-calculator"></i> Monthly Breakdown</div>

              {/* Big result box */}
              <div className="result-box">
                <div className="result-label-sm">Total Monthly Payment</div>
                <div className="result-big">{fmtDec(r.total)}</div>
              </div>

              {/* Breakdown rows — Insurance BEFORE Tax */}
              <div className="breakdown-list">
                <div className="breakdown-row">
                  <span className="bd-label">Principal & Interest</span>
                  <span className="bd-value">{fmtDec(r.pi)}</span>
                </div>
                <div className="breakdown-row">
                  <span className="bd-label">Home Insurance (HOI)</span>
                  <span className="bd-value">{fmtDec(r.monthlyIns)}</span>
                </div>
                <div className="breakdown-row">
                  <span className="bd-label">Property Tax</span>
                  <span className="bd-value">{fmtDec(r.monthlyTax)}</span>
                </div>
                <div className="breakdown-row">
                  <span className="bd-label">Supplemental Insurance</span>
                  <span className="bd-value">{fmtDec(r.monthlySuppIns)}</span>
                </div>
                <div className="breakdown-row">
                  <span className="bd-label">HOA</span>
                  <span className="bd-value">{fmtDec(r.monthlyHOA)}</span>
                </div>
                <div className="breakdown-row">
                  <span className="bd-label">Mortgage Insurance (PMI)</span>
                  <span className="bd-value">{fmtDec(r.monthlyPMI)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================
            PRINT SUMMARY (hidden on screen, shown on print)
            ================================================ */}
        <div className="print-summary">
          <div className="print-header">
            <img src="https://cdn.prod.website-files.com/694e4aaf5f511ad7901b74bc/694e4aaf5f511ad7901b7530_mtg.broker%20logo.svg" alt="mtg.broker" className="print-logo" />
            <div className="print-doc-title">Mortgage Payment Summary</div>
          </div>
          <div className="print-scenario-info" id="printScenarioInfo"></div>
          <div className="print-two-col">
            <div>
              <div className="print-section-title">Loan Information</div>
              <table className="print-table"><tbody id="printLoanTable"></tbody></table>
            </div>
            <div>
              <div className="print-section-title">Monthly Breakdown</div>
              <table className="print-table"><tbody id="printBreakdownTable"></tbody></table>
            </div>
          </div>
          <div className="print-footer">Generated from mtg.broker &middot; <span id="printDate"></span></div>
        </div>

        {/* ================================================
            LOAD MODAL
            ================================================ */}
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
                  <div className="modal-loading"><div className="modal-spinner"></div> Loading scenarios...</div>
                ) : !userEmail ? (
                  <div className="modal-empty">
                    <div className="modal-empty-icon"><i className="fa-solid fa-user-lock"></i></div>
                    <p className="modal-empty-title">Please log in</p>
                    <p className="modal-empty-text">Log in to access your saved scenarios.</p>
                  </div>
                ) : scenarios.length === 0 ? (
                  <div className="modal-empty">
                    <div className="modal-empty-icon"><i className="fa-solid fa-folder-open"></i></div>
                    <p className="modal-empty-title">No saved scenarios</p>
                    <p className="modal-empty-text">Save your first scenario using the Save button.</p>
                  </div>
                ) : (
                  scenarios.map((s) => (
                    <div key={s.id} className="scenario-item" onClick={() => loadScenario(s.id)}>
                      <div className="scenario-item-info">
                        <div className="scenario-item-name">{s.scenarioName}</div>
                        <div className="scenario-item-date">{new Date(s.updatedAt || s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                      </div>
                      <div className="scenario-item-actions">
                        <button className="scenario-action-btn" onClick={(e) => { e.stopPropagation(); startRename(s.id, s.scenarioName); }} title="Rename">
                          <i className="fa-solid fa-pen"></i>
                        </button>
                        <button className="scenario-action-btn delete" onClick={(e) => { e.stopPropagation(); deleteScenario(s.id, s.scenarioName); }} title="Delete">
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {userEmail && saveLimit === 0 && (
                <div className="modal-upgrade">
                  <p className="modal-upgrade-text">Upgrade to PLUS or PRO to save scenarios</p>
                  <a href="https://mtg.broker/pricing" target="_blank" rel="noopener noreferrer" className="modal-upgrade-btn">View Plans</a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================
            RENAME MODAL
            ================================================ */}
        {showRenameModal && (
          <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowRenameModal(false); }}>
            <div className="modal-content" style={{ width: 380 }}>
              <div className="modal-header">
                <h3>Rename Scenario</h3>
                <button onClick={() => setShowRenameModal(false)} className="close-modal">&times;</button>
              </div>
              <div style={{ padding: "0 20px" }}>
                <input
                  type="text"
                  className="rename-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") confirmRename(); }}
                  autoFocus
                />
              </div>
              <div className="rename-actions">
                <button className="rename-cancel" onClick={() => setShowRenameModal(false)}>Cancel</button>
                <button className="rename-confirm" onClick={confirmRename}>Rename</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
