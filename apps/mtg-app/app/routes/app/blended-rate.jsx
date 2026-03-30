import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router";
import { getUserEmail, getUserPlan } from "../../lib/auth";

export function meta() {
  return [{ title: "Blended Rate Calculator — MtgBroker" }];
}

/* ================================================
   CONFIGURATION
   ================================================ */
const API_BASE = "https://mtg-broker-api.rich-e00.workers.dev";
const CALC_TYPE = "Blended Rate";
const MAX_LOANS = 10;

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

/** Empty-field yellow highlight class helper */
const emptyClass = (val) => (!String(val).trim() ? " field-empty" : "");

/* ================================================
   DEFAULT LOAN TEMPLATE
   ================================================ */
const emptyLoan = () => ({ name: "", balance: "", rate: "", origTerm: "", remaining: "" });

/* ================================================
   MAIN COMPONENT
   ================================================ */
export default function BlendedRateCalculator() {
  /* --- Auth --- */
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
  const [scenName, setScenName] = useState("");
  const [scenDate, setScenDate] = useState("");
  const [borName, setBorName] = useState("");
  const [loans, setLoans] = useState([emptyLoan(), emptyLoan()]);

  /* --- Loan CRUD --- */
  const updateLoan = useCallback((idx, field, value) => {
    setLoans((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  }, []);

  const addLoan = useCallback(() => {
    setLoans((prev) => (prev.length < MAX_LOANS ? [...prev, emptyLoan()] : prev));
  }, []);

  const removeLoan = useCallback((idx) => {
    setLoans((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  /* --- Live currency formatting for balance fields ---
     Only format if no math operators present; otherwise let
     the user type their expression freely (eval on blur/Enter) */
  const handleBalanceInput = useCallback((idx, rawValue) => {
    if (/[+\-*/]/.test(rawValue.replace(/,/g, ""))) {
      updateLoan(idx, "balance", rawValue);
    } else {
      updateLoan(idx, "balance", formatNumberString(rawValue));
    }
  }, [updateLoan]);

  /* --- Expression eval on blur for balance fields --- */
  const handleBalanceBlur = useCallback((idx) => {
    setLoans((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      const val = l.balance;
      if (val && /[+\-*/]/.test(val.replace(/,/g, ""))) {
        const result = evaluateExpression(val);
        if (!isNaN(result)) return { ...l, balance: formatNumberString(String(result)) };
      }
      return { ...l, balance: formatNumberString(val) };
    }));
  }, []);

  /* --- Rate field: format to 3 decimals on blur --- */
  const handleRateBlur = useCallback((idx) => {
    setLoans((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      const val = l.rate;
      if (val && /[+\-*/]/.test(String(val).replace(/,/g, ""))) {
        const result = evaluateExpression(String(val));
        if (!isNaN(result)) return { ...l, rate: result.toFixed(3) };
      }
      const parsed = parseFloat(val);
      return { ...l, rate: isNaN(parsed) ? val : parsed.toFixed(3) };
    }));
  }, []);

  /* --- Numeric field: expression eval on blur --- */
  const handleNumericBlur = useCallback((idx, field) => {
    setLoans((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      const val = String(l[field]);
      if (val && /[+\-*/]/.test(val.replace(/,/g, ""))) {
        const result = evaluateExpression(val);
        if (!isNaN(result)) return { ...l, [field]: String(Math.round(result)) };
      }
      return l;
    }));
  }, []);

  /* --- Enter key: evaluate expression and blur --- */
  const handleFieldKeyDown = useCallback((e, idx, field, type) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (type === "balance") handleBalanceBlur(idx);
      else if (type === "rate") handleRateBlur(idx);
      else handleNumericBlur(idx, field);
      e.target.blur();
    }
  }, [handleBalanceBlur, handleRateBlur, handleNumericBlur]);

  /* --- Calculations --- */
  const results = useMemo(() => {
    let totalBalance = 0;
    let totalWeightedExposure = 0;
    let totalWeightedRateExposure = 0;
    let totalPayment = 0;
    let validCount = 0;

    const loanResults = loans.map((loan) => {
      const balance = parseRaw(loan.balance);
      const rate = parseFloat(loan.rate) || 0;
      const origTerm = parseFloat(loan.origTerm) || 0;
      const remaining = parseFloat(loan.remaining) || 0;

      /* Payment uses ORIGINAL term (standard amortization) */
      let monthlyPI = 0;
      if (balance > 0 && rate > 0 && origTerm > 0) {
        const mr = (rate / 100) / 12;
        const n = origTerm;
        monthlyPI = (balance * mr * Math.pow(1 + mr, n)) / (Math.pow(1 + mr, n) - 1);
      } else if (balance > 0 && rate === 0 && origTerm > 0) {
        monthlyPI = balance / origTerm;
      }

      /* Blended rate weighting uses balance × remaining */
      if (balance > 0 && remaining > 0) {
        validCount++;
        totalBalance += balance;
        totalWeightedExposure += balance * remaining;
        totalWeightedRateExposure += rate * balance * remaining;
        totalPayment += monthlyPI;
      } else if (balance > 0) {
        validCount++;
        totalBalance += balance;
        totalPayment += monthlyPI;
      }

      return { ...loan, balanceNum: balance, rateNum: rate, origTermNum: origTerm, remainingNum: remaining, monthlyPI };
    });

    const blendedRate = totalWeightedExposure > 0 ? totalWeightedRateExposure / totalWeightedExposure : 0;

    return { blendedRate, totalBalance, totalPayment, validCount, loanResults, totalWeightedExposure };
  }, [loans]);

  /* --- Collect / populate form data --- */
  const collectFormData = useCallback(() => ({
    meta: { name: scenName, date: scenDate, borrower: borName },
    loans: loans.map((l) => ({ name: l.name, balance: l.balance, rate: l.rate, origTerm: l.origTerm, remaining: l.remaining })),
  }), [scenName, scenDate, borName, loans]);

  const populateForm = useCallback((data) => {
    if (!data) return;
    if (data.meta) {
      if (data.meta.name) setScenName(data.meta.name);
      if (data.meta.date) setScenDate(data.meta.date);
      if (data.meta.borrower) setBorName(data.meta.borrower);
    }
    if (data.loans && data.loans.length > 0) {
      setLoans(data.loans.map((l) => ({
        name: l.name || "", balance: l.balance || "", rate: l.rate || "",
        origTerm: l.origTerm || "", remaining: l.remaining || "",
      })));
    } else {
      setLoans([emptyLoan(), emptyLoan()]);
    }
  }, []);

  /* --- Save --- */
  const saveScenario = useCallback(async () => {
    if (!scenName.trim()) { alert("Please enter a Scenario Name."); return; }
    if (!userEmail) { alert("Please log in to save scenarios."); return; }
    if (!currentScenarioId && saveLimit !== Infinity && currentSaveCount >= saveLimit) {
      alert(saveLimit === 0 ? "Saving requires PLUS or PRO plan." : `You've reached your save limit (${saveLimit}).`);
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
    setLoans([emptyLoan(), emptyLoan()]);
    setSaveStatus({ state: "", text: "Ready" });
  }, []);

  /* --- Print --- */
  const printSummary = useCallback(() => {
    const name = scenName.trim() || "Untitled";
    const borrower = borName.trim() || "—";
    let dateDisplay = "—";
    if (scenDate) { try { dateDisplay = new Date(scenDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); } catch {} }

    const r = results;

    document.getElementById("printScenarioInfo").innerHTML =
      `<div><div class="print-info-label">Scenario</div><div class="print-info-value">${escapeHtml(name)}</div></div>` +
      `<div><div class="print-info-label">Borrower</div><div class="print-info-value">${escapeHtml(borrower)}</div></div>` +
      `<div><div class="print-info-label">Date</div><div class="print-info-value">${dateDisplay}</div></div>` +
      `<div><div class="print-info-label">Loans</div><div class="print-info-value">${r.validCount}</div></div>`;

    let tableRows = "<tr><th>Loan</th><th>Balance</th><th>Rate</th><th>Orig. Term</th><th>Remaining</th><th>Weight</th><th style='text-align:right!important;'>Monthly P&amp;I</th></tr>";
    r.loanResults.forEach((loan) => {
      if (loan.balanceNum <= 0) return;
      const exposure = loan.balanceNum * loan.remainingNum;
      const weight = r.totalWeightedExposure > 0 ? ((exposure / r.totalWeightedExposure) * 100).toFixed(1) + "%" : "—";
      const origDisplay = loan.origTermNum > 0 ? loan.origTermNum + " mo" : "—";
      const remainDisplay = loan.remainingNum > 0 ? loan.remainingNum + " mo" : "—";
      tableRows += `<tr><td>${escapeHtml(loan.name || "Loan")}</td><td>${fmt(loan.balanceNum)}</td><td>${loan.rateNum.toFixed(3)}%</td><td>${origDisplay}</td><td>${remainDisplay}</td><td>${weight}</td><td>${fmtDec(loan.monthlyPI)}</td></tr>`;
    });
    tableRows += `<tr class="print-total-row"><td>Total / Blended</td><td>${fmt(r.totalBalance)}</td><td>${r.blendedRate.toFixed(3)}%</td><td></td><td></td><td>100%</td><td>${fmtDec(r.totalPayment)}</td></tr>`;
    document.getElementById("printLoansTable").innerHTML = tableRows;

    document.getElementById("printResultsBar").innerHTML =
      `<div class="print-result-card"><div class="print-result-label">Blended Rate</div><div class="print-result-value blue">${r.blendedRate.toFixed(3)}%</div></div>` +
      `<div class="print-result-card"><div class="print-result-label">Total Balance</div><div class="print-result-value blue">${fmt(r.totalBalance)}</div></div>` +
      `<div class="print-result-card"><div class="print-result-label">Total Monthly P&amp;I</div><div class="print-result-value green">${fmtDec(r.totalPayment)}</div></div>`;

    document.getElementById("printDate").textContent = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    setTimeout(() => window.print(), 150);
  }, [scenName, scenDate, borName, results]);

  const dotClass = saveStatus.state ? `save-status-dot ${saveStatus.state}` : "save-status-dot";
  const r = results;

  return (
    <>
      {/* SCOPED CSS — matches v1.0 design */}
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
        .input-group label { display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px; }
        .calc-input { width: 100%; padding: 10px 12px; border: 1px solid #CBD5E1; border-radius: 8px; font-size: 15px; font-family: 'Host Grotesk', system-ui, sans-serif; color: #0f172a; background: #FFFFFF; transition: border-color 0.2s, box-shadow 0.2s; }
        .calc-input:focus { outline: none; border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
        .calc-input::placeholder { color: #94A3B8; }
        .calc-input.field-empty { background-color: #FFFBEB; border-color: #FDE68A; }
        .req { color: #DC2626; }
        .grid-3-compact { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
        .calc-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
        .loan-entry { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; margin-bottom: 12px; position: relative; transition: border-color 0.2s; }
        .loan-entry:hover { border-color: #CBD5E1; }
        .loan-entry-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .loan-entry-num { font-size: 13px; font-weight: 700; color: #2563EB; text-transform: uppercase; letter-spacing: 0.03em; }
        .btn-remove-loan { background: none; border: none; cursor: pointer; color: #94A3B8; font-size: 16px; padding: 4px 8px; border-radius: 6px; transition: all 0.15s; }
        .btn-remove-loan:hover { background: #FEE2E2; color: #DC2626; }
        .loan-row { display: grid; gap: 12px; margin-bottom: 12px; }
        .loan-row:last-child { margin-bottom: 0; }
        .loan-row-top { grid-template-columns: 1fr 1fr; }
        .loan-row-bottom { grid-template-columns: 1fr 1fr 1fr; }
        .loan-row .input-group { margin-bottom: 0; }
        .loan-row label { font-size: 12px; }
        .loan-row .calc-input { padding: 8px 10px; font-size: 14px; }
        .add-loan-row { display: flex; justify-content: center; margin-top: 4px; }
        .btn-add-loan { background: none; border: 2px dashed #CBD5E1; border-radius: 10px; padding: 10px 24px; cursor: pointer; color: #64748B; font-size: 13px; font-weight: 600; font-family: 'Host Grotesk', system-ui, sans-serif; transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px; width: 100%; justify-content: center; }
        .btn-add-loan:hover { border-color: #2563EB; color: #2563EB; background: #EFF6FF; }
        .result-card-main { background: #0F172A; border-radius: 16px; padding: 32px; box-shadow: 0 8px 32px rgba(15,23,42,0.2); color: white; }
        .res-label-main { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #94A3B8; margin-bottom: 4px; font-weight: 700; }
        .res-val-main { font-size: 52px; font-weight: 800; color: #38BDF8; line-height: 1; margin-bottom: 8px; letter-spacing: -0.02em; }
        .res-val-sub { font-size: 14px; color: #64748B; margin-bottom: 24px; }
        .result-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 24px; }
        .result-stat { background: rgba(255,255,255,0.06); border-radius: 10px; padding: 14px; text-align: center; }
        .result-stat-label { font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
        .result-stat-value { font-size: 20px; font-weight: 800; color: white; }
        .result-stat-value.blue { color: #38BDF8; }
        .result-stat-value.green { color: #34D399; }
        .result-card-main .divider { border: 0; border-top: 1px solid rgba(255,255,255,0.15); margin: 20px 0; }
        .breakdown-title { font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 12px; }
        .breakdown-table { width: 100%; border-collapse: collapse; }
        .breakdown-table th { font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; text-align: left; padding: 0 0 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .breakdown-table th:last-child { text-align: right; }
        .breakdown-table td { font-size: 14px; color: #E2E8F0; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .breakdown-table td:last-child { text-align: right; font-weight: 600; color: white; }
        .breakdown-table tr:last-child td { border-bottom: none; }
        .breakdown-table tr.total-row td { border-top: 2px solid rgba(255,255,255,0.2); font-weight: 700; color: #38BDF8; padding-top: 12px; }
        .weight-bar { display: inline-block; height: 6px; background: #2563EB; border-radius: 3px; vertical-align: middle; margin-left: 8px; opacity: 0.7; }
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
        @media (max-width: 768px) {
          .calc-header { flex-direction: column; align-items: flex-start; }
          .header-left { width: 100%; margin-bottom: 8px; }
          .header-actions { width: 100%; justify-content: space-between; }
          .calc-grid-2 { grid-template-columns: 1fr; gap: 0; }
          .grid-3-compact { grid-template-columns: 1fr; }
          .res-val-main { font-size: 40px; }
          .result-stats { grid-template-columns: 1fr; gap: 10px; }
          .floating-card { padding: 20px 16px; border-radius: 12px; }
        }
        @media (max-width: 480px) {
          .header-actions { flex-direction: column; gap: 12px; }
          .btn-group { width: 100%; justify-content: space-between; gap: 6px; }
          .action-btn { flex: 1; text-align: center; padding: 10px 6px; justify-content: center; font-size: 12px; }
          .save-status { width: 100%; justify-content: center; }
          .floating-card { padding: 16px 14px; }
          .loan-row-top, .loan-row-bottom { grid-template-columns: 1fr; }
        }
        .print-summary { display: none; }
        @media print {
          body * { visibility: hidden !important; }
          /* Collapse ALL non-print content to zero height so only 1 page prints */
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
          .print-table { width: 100% !important; border-collapse: collapse !important; font-size: 9pt !important; }
          .print-table tr { border-bottom: 1px solid #E2E8F0 !important; }
          .print-table td, .print-table th { padding: 5px 0 !important; }
          .print-table th { font-size: 8pt !important; font-weight: 700 !important; color: #64748B !important; text-transform: uppercase !important; text-align: left !important; }
          .print-table th:last-child, .print-table td:last-child { text-align: right !important; }
          .print-table td:first-child { color: #475569 !important; }
          .print-table td:last-child { font-weight: 700 !important; }
          .print-table tr.print-total-row { border-top: 2px solid #0F172A !important; }
          .print-table tr.print-total-row td { padding-top: 8px !important; font-size: 12pt !important; font-weight: 800 !important; }
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
          <span className="bc-current">Blended Rate Calculator</span>
        </div>

        {/* HEADER BAR */}
        <div className="calc-header">
          <div className="header-left">
            <h1 className="calc-title">Blended Rate Calculator</h1>
            <p className="calc-subtitle">Calculate the weighted average interest rate across multiple liens or loan scenarios.</p>
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
              <input type="text" className={`calc-input${emptyClass(scenName)}`} value={scenName} onChange={(e) => setScenName(e.target.value)} placeholder="e.g. Holland 1st + HELOC Blend" />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Date</label>
              <input type="date" className="calc-input" value={scenDate} onChange={(e) => setScenDate(e.target.value)} />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Borrower Name</label>
              <input type="text" className={`calc-input${emptyClass(borName)}`} value={borName} onChange={(e) => setBorName(e.target.value)} placeholder="e.g. John & Jane Smith" />
            </div>
          </div>
        </div>

        {/* TWO-COLUMN LAYOUT */}
        <div className="calc-grid-2">

          {/* LEFT: Loan Entries */}
          <div>
            <div className="floating-card">
              <h3 className="card-title"><i className="fa-solid fa-layer-group"></i> Loan Entries</h3>

              {loans.map((loan, idx) => (
                <div key={idx} className="loan-entry">
                  <div className="loan-entry-header">
                    <span className="loan-entry-num"><i className="fa-solid fa-file-contract" style={{ marginRight: 4 }}></i> Loan {idx + 1}</span>
                    {loans.length > 1 && (
                      <button className="btn-remove-loan" onClick={() => removeLoan(idx)} title="Remove this loan"><i className="fa-solid fa-xmark"></i></button>
                    )}
                  </div>
                  <div className="loan-row loan-row-top">
                    <div className="input-group">
                      <label>Loan Name</label>
                      <input type="text" className={`calc-input${emptyClass(loan.name)}`} value={loan.name} onChange={(e) => updateLoan(idx, "name", e.target.value)} placeholder="e.g. 1st Mortgage" />
                    </div>
                    <div className="input-group">
                      <label>New / Current Balance ($) <i className="fa-solid fa-circle-info" style={{ color: "#94A3B8", cursor: "help" }} title="For existing loans, enter the current remaining principal balance"></i></label>
                      <input type="text" className={`calc-input${emptyClass(loan.balance)}`} value={loan.balance} onChange={(e) => handleBalanceInput(idx, e.target.value)} onBlur={() => handleBalanceBlur(idx)} onKeyDown={(e) => handleFieldKeyDown(e, idx, "balance", "balance")} placeholder="e.g. 350,000" />
                    </div>
                  </div>
                  <div className="loan-row loan-row-bottom">
                    <div className="input-group">
                      <label>Interest Rate (%)</label>
                      <input type="text" className={`calc-input${emptyClass(loan.rate)}`} value={loan.rate} onChange={(e) => updateLoan(idx, "rate", e.target.value)} onBlur={() => handleRateBlur(idx)} onKeyDown={(e) => handleFieldKeyDown(e, idx, "rate", "rate")} step="0.125" placeholder="e.g. 6.875" />
                    </div>
                    <div className="input-group">
                      <label>Original Term (Months)</label>
                      <input type="text" className={`calc-input${emptyClass(loan.origTerm)}`} value={loan.origTerm} onChange={(e) => updateLoan(idx, "origTerm", e.target.value)} onBlur={() => handleNumericBlur(idx, "origTerm")} onKeyDown={(e) => handleFieldKeyDown(e, idx, "origTerm", "numeric")} placeholder="e.g. 360" />
                    </div>
                    <div className="input-group">
                      <label>Remaining Term (Months)</label>
                      <input type="text" className={`calc-input${emptyClass(loan.remaining)}`} value={loan.remaining} onChange={(e) => updateLoan(idx, "remaining", e.target.value)} onBlur={() => handleNumericBlur(idx, "remaining")} onKeyDown={(e) => handleFieldKeyDown(e, idx, "remaining", "numeric")} placeholder="e.g. 324" />
                    </div>
                  </div>
                </div>
              ))}

              {loans.length < MAX_LOANS && (
                <div className="add-loan-row">
                  <button className="btn-add-loan" onClick={addLoan}>
                    <i className="fa-solid fa-plus"></i> Add Another Loan
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Results */}
          <div>
            <div className="result-card-main">
              <span className="res-label-main">Blended Interest Rate</span>
              <div className="res-val-main">{r.blendedRate.toFixed(3)}%</div>
              <div className="res-val-sub">Weighted by balance × remaining term across {r.validCount} loan{r.validCount !== 1 ? "s" : ""}</div>

              <div className="result-stats">
                <div className="result-stat">
                  <div className="result-stat-label">Total Balance</div>
                  <div className="result-stat-value blue">{fmt(r.totalBalance)}</div>
                </div>
                <div className="result-stat">
                  <div className="result-stat-label">Total Payment</div>
                  <div className="result-stat-value green">{fmtDec(r.totalPayment)}</div>
                </div>
                <div className="result-stat">
                  <div className="result-stat-label">Loans</div>
                  <div className="result-stat-value">{r.validCount}</div>
                </div>
              </div>

              <hr className="divider" />

              <div className="breakdown-title">Per-Loan Breakdown</div>
              <table className="breakdown-table">
                <thead>
                  <tr>
                    <th>Loan</th>
                    <th>Balance</th>
                    <th>Rate</th>
                    <th>Remaining</th>
                    <th>Weight</th>
                    <th>Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {r.validCount === 0 ? (
                    <tr><td colSpan="6" style={{ color: "#64748B", textAlign: "center", padding: "16px 0" }}>Add loans to see breakdown</td></tr>
                  ) : (
                    <>
                      {r.loanResults.filter((l) => l.balanceNum > 0).map((loan, i) => {
                        const exposure = loan.balanceNum * loan.remainingNum;
                        const weight = r.totalWeightedExposure > 0 ? (exposure / r.totalWeightedExposure) * 100 : 0;
                        const barWidth = Math.max(2, Math.min(60, weight * 0.6));
                        const remainDisplay = loan.remainingNum > 0 ? loan.remainingNum + " mo" : "—";
                        return (
                          <tr key={i}>
                            <td>{loan.name || "Loan"}</td>
                            <td>{fmt(loan.balanceNum)}</td>
                            <td>{loan.rateNum.toFixed(3)}%</td>
                            <td>{remainDisplay}</td>
                            <td>{weight.toFixed(1)}%<span className="weight-bar" style={{ width: barWidth }}></span></td>
                            <td>{fmtDec(loan.monthlyPI)}</td>
                          </tr>
                        );
                      })}
                      <tr className="total-row">
                        <td>Total / Blended</td>
                        <td>{fmt(r.totalBalance)}</td>
                        <td>{r.blendedRate.toFixed(3)}%</td>
                        <td></td>
                        <td>100%</td>
                        <td>{fmtDec(r.totalPayment)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* PRINT SUMMARY */}
        <div id="blend-print-summary" className="print-summary">
          <div className="print-header">
            <img className="print-logo" src="https://cdn.prod.website-files.com/694e4aaf5f511ad7901b74bc/69576dcb21edb9d479222c02_Logo_Horizontal_Blue.png" alt="mtg.broker" />
            <div className="print-doc-title">Blended Rate Calculator</div>
          </div>
          <div className="print-scenario-info" id="printScenarioInfo"></div>
          <div className="print-section-title">Loan Details &amp; Breakdown</div>
          <table className="print-table" id="printLoansTable"></table>
          <div className="print-results-bar" id="printResultsBar"></div>
          <div className="print-footer">Generated from mtg.broker &mdash; <span id="printDate"></span></div>
        </div>

      </div>
    </>
  );
}
