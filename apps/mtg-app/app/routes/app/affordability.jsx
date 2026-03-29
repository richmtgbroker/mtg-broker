import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link } from "react-router";
import { getUserEmail, getUserPlan } from "../../lib/auth";

export function meta() {
  return [{ title: "Affordability Calculator — MtgBroker" }];
}

/* ================================================
   CONFIGURATION
   ================================================ */
const API_BASE = "https://mtg-broker-api.rich-e00.workers.dev";
const CALC_TYPE = "Affordability Calculator";

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

/** Allows math like 80000/12 or 4500+600 */
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
   MAIN COMPONENT
   ================================================ */
export default function AffordabilityCalculator() {
  /* --- Auth state --- */
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

  /* --- Form state --- */
  const [scenName, setScenName] = useState("");
  const [scenDate, setScenDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [borName, setBorName] = useState("");
  const [fico, setFico] = useState("");
  const [income, setIncome] = useState("");
  const [debts, setDebts] = useState("");
  const [loanRate, setLoanRate] = useState("");
  const [qualRate, setQualRate] = useState("");
  const [term, setTerm] = useState("");
  const [downPayPct, setDownPayPct] = useState("");
  const [maxDti, setMaxDti] = useState("");
  const [miRate, setMiRate] = useState("");
  const [ins, setIns] = useState("");
  const [tax, setTax] = useState("");
  const [suppIns, setSuppIns] = useState("");
  const [hoa, setHoa] = useState("");

  /* --- Calculations --- */
  const results = useMemo(() => {
    const incomeVal = parseRaw(income);
    const debtsVal = parseRaw(debts);
    const loanRateVal = parseFloat(loanRate) || 0;
    const qualRateVal = parseFloat(qualRate) || 0;
    const termMonths = parseFloat(term) || 0;
    const maxDtiVal = parseFloat(maxDti) || 0;
    const downPayPctVal = parseFloat(downPayPct) || 0;
    const miRateVal = parseFloat(miRate) || 0;
    const insVal = parseRaw(ins);
    const taxVal = parseRaw(tax);
    const suppInsVal = parseRaw(suppIns);
    const hoaVal = parseRaw(hoa);

    const currentDti = incomeVal > 0 ? (debtsVal / incomeVal) * 100 : 0;
    const availableDti = maxDtiVal - currentDti;
    const maxAllowableDebt = incomeVal * (maxDtiVal / 100);
    const maxHousing = maxAllowableDebt - debtsVal;

    const monthlyTax = taxVal / 12;
    const monthlyIns = (insVal + suppInsVal) / 12;
    const monthlyHOA = hoaVal / 12;
    const monthlyFixed = monthlyTax + monthlyIns + monthlyHOA;
    const availableForPIandMI = maxHousing - monthlyFixed;

    let maxLoan = 0, monthlyMI = 0, monthlyPI = 0;

    if (availableForPIandMI > 0 && qualRateVal > 0 && termMonths > 0) {
      const r = qualRateVal / 100 / 12;
      const n = termMonths;
      const piFactor = (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
      const miFactor = (miRateVal / 100) / 12;
      maxLoan = availableForPIandMI / (piFactor + miFactor);
      monthlyMI = maxLoan * miFactor;
      if (loanRateVal > 0) {
        const loanR = loanRateVal / 100 / 12;
        monthlyPI = maxLoan * ((loanR * Math.pow(1 + loanR, n)) / (Math.pow(1 + loanR, n) - 1));
      } else {
        monthlyPI = maxLoan / n;
      }
    } else if (availableForPIandMI > 0 && qualRateVal === 0 && termMonths > 0) {
      const miFactor2 = (miRateVal / 100) / 12;
      maxLoan = availableForPIandMI / (1 / termMonths + miFactor2);
      monthlyMI = maxLoan * miFactor2;
      monthlyPI = maxLoan / termMonths;
    }

    const downPayDecimal = downPayPctVal / 100;
    const maxPurchase = downPayDecimal < 1 && downPayDecimal > 0 ? maxLoan / (1 - downPayDecimal) : maxLoan;

    return {
      maxLoan: maxLoan > 0 ? maxLoan : 0,
      maxPurchase: maxPurchase > 0 ? maxPurchase : 0,
      maxHousing: maxHousing > 0 ? maxHousing : 0,
      monthlyPI, monthlyTax, monthlyIns, monthlyHOA, monthlyMI,
      maxDtiVal, currentDti, availableDti, downPayPctVal,
    };
  }, [income, debts, loanRate, qualRate, term, downPayPct, maxDti, miRate, ins, tax, suppIns, hoa]);

  /* --- Collect / populate form data for save/load --- */
  const collectFormData = useCallback(() => ({
    meta: { name: scenName, date: scenDate, borrower: borName, fico },
    calc: { income, debts, loanRate, qualRate, term, downPayPct, maxDti, miRate, ins, tax, suppIns, hoa },
  }), [scenName, scenDate, borName, fico, income, debts, loanRate, qualRate, term, downPayPct, maxDti, miRate, ins, tax, suppIns, hoa]);

  const populateForm = useCallback((data) => {
    if (!data) return;
    if (data.meta) {
      if (data.meta.name) setScenName(data.meta.name);
      if (data.meta.date) setScenDate(data.meta.date);
      if (data.meta.borrower) setBorName(data.meta.borrower);
      if (data.meta.fico !== undefined) setFico(data.meta.fico);
    }
    if (data.calc) {
      const c = data.calc;
      if (c.income) setIncome(c.income);
      if (c.debts) setDebts(c.debts);
      if (c.loanRate) setLoanRate(c.loanRate);
      if (c.qualRate) setQualRate(c.qualRate);
      if (c.term) setTerm(c.term);
      if (c.downPayPct) setDownPayPct(c.downPayPct);
      if (c.maxDti) setMaxDti(c.maxDti);
      if (c.miRate) setMiRate(c.miRate);
      if (c.ins) setIns(c.ins);
      if (c.tax) setTax(c.tax);
      if (c.suppIns !== undefined) setSuppIns(c.suppIns);
      if (c.hoa !== undefined) setHoa(c.hoa);
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
    setScenName(""); setScenDate(new Date().toISOString().split("T")[0]);
    setBorName(""); setFico("");
    setIncome(""); setDebts("");
    setLoanRate(""); setQualRate("");
    setTerm(""); setDownPayPct("");
    setMaxDti(""); setMiRate("");
    setIns(""); setTax("");
    setSuppIns(""); setHoa("");
    setSaveStatus({ state: "", text: "Ready" });
  }, []);

  /* --- Print --- */
  const printSummary = useCallback(() => {
    const printEl = document.getElementById("afford-print-summary");
    if (!printEl) return;

    const name = scenName.trim() || "Untitled";
    const borrower = borName.trim() || "—";
    let dateDisplay = "—";
    if (scenDate) {
      try { dateDisplay = new Date(scenDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); } catch {}
    }
    const ficoVal = fico || "—";
    const r = results;

    document.getElementById("printScenarioInfo").innerHTML =
      `<div><div class="print-info-label">Scenario</div><div class="print-info-value">${escapeHtml(name)}</div></div>` +
      `<div><div class="print-info-label">Borrower</div><div class="print-info-value">${escapeHtml(borrower)}</div></div>` +
      `<div><div class="print-info-label">Date</div><div class="print-info-value">${dateDisplay}</div></div>` +
      `<div><div class="print-info-label">FICO</div><div class="print-info-value">${ficoVal}</div></div>`;

    document.getElementById("printIncomeDebts").innerHTML =
      `<tr><td>Monthly Income</td><td>${fmt(parseRaw(income))}</td></tr>` +
      `<tr><td>Monthly Debts</td><td>${fmt(parseRaw(debts))}</td></tr>`;

    document.getElementById("printLoanParams").innerHTML =
      `<tr><td>Loan Interest Rate</td><td>${(parseFloat(loanRate) || 0).toFixed(3)}%</td></tr>` +
      `<tr><td>Qualifying Rate</td><td>${(parseFloat(qualRate) || 0).toFixed(3)}%</td></tr>` +
      `<tr><td>Term</td><td>${term || 0} months</td></tr>` +
      `<tr><td>Down Payment</td><td>${r.downPayPctVal.toFixed(2)}%</td></tr>` +
      `<tr><td>Max DTI</td><td>${r.maxDtiVal.toFixed(2)}%</td></tr>` +
      `<tr><td>MI Rate</td><td>${(parseFloat(miRate) || 0).toFixed(2)}%</td></tr>`;

    document.getElementById("printExpenses").innerHTML =
      `<tr><td>Home Insurance</td><td>${fmt(parseRaw(ins))}</td></tr>` +
      `<tr><td>Property Taxes</td><td>${fmt(parseRaw(tax))}</td></tr>` +
      `<tr><td>Supplemental Ins</td><td>${fmt(parseRaw(suppIns))}</td></tr>` +
      `<tr><td>HOA</td><td>${fmt(parseRaw(hoa))}</td></tr>`;

    document.getElementById("printDTI").innerHTML =
      `<tr><td>Max DTI</td><td>${r.maxDtiVal.toFixed(2)}%</td></tr>` +
      `<tr><td>Current DTI</td><td>${r.currentDti.toFixed(2)}%</td></tr>` +
      `<tr class="print-highlight"><td>Available DTI</td><td>${r.availableDti.toFixed(2)}%</td></tr>`;

    document.getElementById("printPITIA").innerHTML =
      `<tr><td>Principal &amp; Interest</td><td>${fmt(r.monthlyPI)}</td></tr>` +
      `<tr><td>Property Taxes</td><td>${fmt(r.monthlyTax)}</td></tr>` +
      `<tr><td>Insurance (Home + Supp)</td><td>${fmt(r.monthlyIns)}</td></tr>` +
      `<tr><td>HOA</td><td>${fmt(r.monthlyHOA)}</td></tr>` +
      `<tr><td>Mortgage Insurance</td><td>${fmt(r.monthlyMI)}</td></tr>` +
      `<tr class="print-total-row"><td>Max Payment (PITIA)</td><td>${fmt(r.maxHousing)}</td></tr>`;

    const downNote = `Based on ${r.downPayPctVal.toFixed(2)}% down payment`;
    document.getElementById("printResultsBar").innerHTML =
      `<div class="print-result-card"><div class="print-result-label">Max Loan Amount</div><div class="print-result-value blue">${fmt(r.maxLoan)}</div></div>` +
      `<div class="print-result-card"><div class="print-result-label">Max Purchase Price</div><div class="print-result-value blue">${fmt(r.maxPurchase)}</div><div style="font-size:7pt;color:#94A3B8;margin-top:2px;">${downNote}</div></div>` +
      `<div class="print-result-card"><div class="print-result-label">Max Monthly Payment</div><div class="print-result-value green">${fmt(r.maxHousing)}</div></div>`;

    document.getElementById("printDate").textContent = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    setTimeout(() => window.print(), 150);
  }, [scenName, scenDate, borName, fico, income, debts, loanRate, qualRate, term, miRate, ins, tax, suppIns, hoa, results]);

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

  /** Press Enter in a calc-field → evaluate expression + blur the input */
  const handleCalcFieldKeyDown = useCallback((e, value, setter) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCalcFieldBlur(value, setter);
      e.target.blur();
    }
  }, [handleCalcFieldBlur]);

  /* --- Empty-field class helper --- */
  const emptyClass = (val) => (!String(val).trim() ? " field-empty" : "");

  /* --- Save status dot class --- */
  const dotClass = saveStatus.state ? `save-status-dot ${saveStatus.state}` : "save-status-dot";

  const r = results;

  return (
    <>
      {/* ================================================
          SCOPED CSS — matches your existing v2.1 styles
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
        .input-group label { display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px; }
        .calc-input { width: 100%; padding: 10px 12px; border: 1px solid #CBD5E1; border-radius: 8px; font-size: 15px; font-family: 'Host Grotesk', system-ui, sans-serif; color: #0f172a; background: #FFFFFF; transition: border-color 0.2s, box-shadow 0.2s; }
        .calc-input:focus { outline: none; border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
        .calc-input::placeholder { color: #94A3B8; }
        .calc-input.field-empty { background-color: #FFFBEB; border-color: #FDE68A; }
        .req { color: #DC2626; }
        .grid-2-compact { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .calc-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
        .result-card-dti { background: #F8FAFC; border: 2px solid #E2E8F0; border-radius: 12px; padding: 20px; }
        .result-card-dti .card-title { border-bottom-color: #CBD5E1; }
        .dti-row { display: flex; justify-content: space-between; align-items: center; font-size: 14px; color: #475569; padding: 10px 0; border-bottom: 1px solid #E2E8F0; }
        .dti-row:last-child { border-bottom: none; }
        .dti-row .dti-val { font-weight: 700; color: #0F172A; font-size: 15px; }
        .dti-row.highlight { background: #EFF6FF; margin: 0 -16px; padding: 10px 16px; border-radius: 8px; border-bottom: none; }
        .dti-row.highlight .dti-val { color: #2563EB; font-weight: 800; }
        .result-card-main { background: #0F172A; border-radius: 16px; padding: 32px; box-shadow: 0 8px 32px rgba(15,23,42,0.2); color: white; }
        .res-label-main { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #94A3B8; margin-bottom: 4px; font-weight: 700; }
        .res-val-main { font-size: 48px; font-weight: 800; color: #38BDF8; line-height: 1; margin-bottom: 20px; letter-spacing: -0.02em; }
        .res-row-large { display: flex; justify-content: space-between; font-size: 18px; margin-bottom: 4px; color: #E2E8F0; font-weight: 600; }
        .res-row-large span:last-child { color: #38BDF8; font-weight: 700; }
        .down-payment-note { font-size: 12px; color: #94A3B8; font-style: italic; margin-bottom: 16px; }
        .result-card-main .divider { border: 0; border-top: 1px solid rgba(255,255,255,0.15); margin: 16px 0; }
        .pitia-row { display: flex; justify-content: space-between; font-size: 14px; color: #E2E8F0; padding: 8px 0; }
        .pitia-row span:last-child { font-weight: 600; color: white; }
        .pitia-total { display: flex; justify-content: space-between; font-size: 16px; font-weight: 700; color: white; padding: 12px 0 4px 0; border-top: 2px solid rgba(255,255,255,0.2); margin-top: 4px; }
        .pitia-total span:last-child { color: #38BDF8; }
        .pitia-breakdown { background: rgba(255,255,255,0.06); border-radius: 10px; padding: 16px; }
        .pitia-breakdown-title { font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
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
        @media (max-width: 768px) {
          .calc-header { flex-direction: column; align-items: flex-start; }
          .header-left { width: 100%; margin-bottom: 8px; }
          .header-actions { width: 100%; justify-content: space-between; }
          .calc-grid-2 { grid-template-columns: 1fr; gap: 0; }
          .grid-2-compact { grid-template-columns: 1fr; }
          .res-val-main { font-size: 36px; }
          .floating-card { padding: 20px 16px; border-radius: 12px; }
        }
        @media (max-width: 480px) {
          .header-actions { flex-direction: column; gap: 12px; }
          .btn-group { width: 100%; justify-content: space-between; gap: 6px; }
          .action-btn { flex: 1; text-align: center; padding: 10px 6px; justify-content: center; font-size: 12px; }
          .save-status { width: 100%; justify-content: center; }
          .floating-card { padding: 16px 14px; }
        }
        .print-summary { display: none; }
        @media print {
          body * { visibility: hidden !important; }
          /* Collapse ALL non-print content to zero height so only 1 page prints */
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
          .print-scenario-info { display: grid !important; grid-template-columns: repeat(4, 1fr) !important; gap: 8px 24px !important; background: #F8FAFC !important; border: 1px solid #E2E8F0 !important; border-radius: 8px !important; padding: 12px 16px !important; margin-bottom: 16px !important; }
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
          <span className="bc-current">Affordability Calculator</span>
        </div>

        {/* ============================
            HEADER BAR
            ============================ */}
        <div className="calc-header">
          <div className="header-left">
            <h1 className="calc-title">Affordability Calculator</h1>
            <p className="calc-subtitle">Determine maximum purchasing power based on income, debts, and loan parameters.</p>
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
          <div className="grid-2-compact">
            <div className="input-group">
              <label>Scenario Name <span className="req">*</span></label>
              <input type="text" className={`calc-input${emptyClass(scenName)}`} value={scenName} onChange={(e) => setScenName(e.target.value)} placeholder="e.g. Smith Family Purchase" />
            </div>
            <div className="input-group">
              <label>Date</label>
              <input type="date" className="calc-input" value={scenDate} onChange={(e) => setScenDate(e.target.value)} />
            </div>
          </div>
          <div className="grid-2-compact">
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Borrower Name</label>
              <input type="text" className={`calc-input${emptyClass(borName)}`} value={borName} onChange={(e) => setBorName(e.target.value)} placeholder="e.g. John & Jane Smith" />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>FICO</label>
              <input type="number" className={`calc-input${emptyClass(fico)}`} value={fico} onChange={(e) => setFico(e.target.value)} placeholder="e.g. 720" />
            </div>
          </div>
        </div>

        {/* ============================
            TWO-COLUMN LAYOUT
            ============================ */}
        <div className="calc-grid-2">

          {/* LEFT COLUMN: All Inputs */}
          <div>

            {/* CARD 2: INCOME & DEBTS */}
            <div className="floating-card">
              <h3 className="card-title"><i className="fa-solid fa-money-bill-wave"></i> Income &amp; Debts</h3>
              <div className="input-group">
                <label>Monthly Income ($)</label>
                <input
                  type="text"
                  className={`calc-input${emptyClass(income)}`}
                  value={income}
                  onChange={(e) => setIncome(e.target.value)}
                  onBlur={() => handleCalcFieldBlur(income, setIncome)}
                  onKeyDown={(e) => handleCalcFieldKeyDown(e, income, setIncome)}
                  placeholder="e.g. 8,500 or 102000/12"
                />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Monthly Debts ($)</label>
                <input
                  type="text"
                  className={`calc-input${emptyClass(debts)}`}
                  value={debts}
                  onChange={(e) => setDebts(e.target.value)}
                  onBlur={() => handleCalcFieldBlur(debts, setDebts)}
                  onKeyDown={(e) => handleCalcFieldKeyDown(e, debts, setDebts)}
                  placeholder="e.g. 1,200"
                />
              </div>
            </div>

            {/* CARD 3: LOAN PARAMETERS */}
            <div className="floating-card">
              <h3 className="card-title"><i className="fa-solid fa-sliders"></i> Loan Parameters</h3>
              <div className="grid-2-compact">
                <div className="input-group">
                  <label>Loan Interest Rate (%)</label>
                  <input type="number" className={`calc-input${emptyClass(loanRate)}`} value={loanRate} onChange={(e) => setLoanRate(e.target.value)} step="0.125" placeholder="e.g. 6.875" />
                </div>
                <div className="input-group">
                  <label>Qualifying Interest Rate (%)</label>
                  <input type="number" className={`calc-input${emptyClass(qualRate)}`} value={qualRate} onChange={(e) => setQualRate(e.target.value)} step="0.125" placeholder="e.g. 7.5" />
                </div>
              </div>
              <div className="grid-2-compact">
                <div className="input-group">
                  <label>Term (Months)</label>
                  <input type="number" className={`calc-input${emptyClass(term)}`} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="e.g. 360" />
                </div>
                <div className="input-group">
                  <label>Down Payment (%)</label>
                  <input type="number" className={`calc-input${emptyClass(downPayPct)}`} value={downPayPct} onChange={(e) => setDownPayPct(e.target.value)} step="0.5" placeholder="e.g. 5" />
                </div>
              </div>
              <div className="grid-2-compact">
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Max DTI (%)</label>
                  <input type="number" className={`calc-input${emptyClass(maxDti)}`} value={maxDti} onChange={(e) => setMaxDti(e.target.value)} placeholder="e.g. 45" />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>MI Rate (%)</label>
                  <input type="number" className={`calc-input${emptyClass(miRate)}`} value={miRate} onChange={(e) => setMiRate(e.target.value)} step="0.01" placeholder="e.g. 0.85" />
                </div>
              </div>
            </div>

            {/* CARD 4: ESTIMATED EXPENSES */}
            <div className="floating-card">
              <h3 className="card-title"><i className="fa-solid fa-house-chimney"></i> Estimated Expenses (Yearly)</h3>
              <div className="grid-2-compact">
                <div className="input-group">
                  <label>Home Insurance ($)</label>
                  <input
                    type="text"
                    className={`calc-input${emptyClass(ins)}`}
                    value={ins}
                    onChange={(e) => setIns(e.target.value)}
                    onBlur={() => handleCalcFieldBlur(ins, setIns)}
                    onKeyDown={(e) => handleCalcFieldKeyDown(e, ins, setIns)}
                    placeholder="e.g. 1,800"
                  />
                </div>
                <div className="input-group">
                  <label>Property Taxes ($)</label>
                  <input
                    type="text"
                    className={`calc-input${emptyClass(tax)}`}
                    value={tax}
                    onChange={(e) => setTax(e.target.value)}
                    onBlur={() => handleCalcFieldBlur(tax, setTax)}
                    onKeyDown={(e) => handleCalcFieldKeyDown(e, tax, setTax)}
                    placeholder="e.g. 3,000"
                  />
                </div>
              </div>
              <div className="grid-2-compact">
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Supplemental Ins ($)</label>
                  <input
                    type="text"
                    className={`calc-input${emptyClass(suppIns)}`}
                    value={suppIns}
                    onChange={(e) => setSuppIns(e.target.value)}
                    onBlur={() => handleCalcFieldBlur(suppIns, setSuppIns)}
                    onKeyDown={(e) => handleCalcFieldKeyDown(e, suppIns, setSuppIns)}
                    placeholder="e.g. 600"
                  />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>HOA ($)</label>
                  <input
                    type="text"
                    className={`calc-input${emptyClass(hoa)}`}
                    value={hoa}
                    onChange={(e) => setHoa(e.target.value)}
                    onBlur={() => handleCalcFieldBlur(hoa, setHoa)}
                    onKeyDown={(e) => handleCalcFieldKeyDown(e, hoa, setHoa)}
                    placeholder="e.g. 0"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Results */}
          <div>

            {/* CARD 5: DTI ANALYSIS */}
            <div className="floating-card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="result-card-dti">
                <h3 className="card-title"><i className="fa-solid fa-chart-pie"></i> DTI Analysis</h3>
                <div className="dti-row">
                  <span>Max DTI</span>
                  <span className="dti-val">{r.maxDtiVal.toFixed(2)}%</span>
                </div>
                <div className="dti-row">
                  <span>Current DTI</span>
                  <span className="dti-val">{r.currentDti.toFixed(2)}%</span>
                </div>
                <div className="dti-row highlight">
                  <span>Available DTI</span>
                  <span className="dti-val">{r.availableDti.toFixed(2)}%</span>
                </div>
              </div>
            </div>

            {/* CARD 6: MAIN RESULTS (dark) */}
            <div className="result-card-main">
              <span className="res-label-main">Maximum Loan Amount</span>
              <div className="res-val-main">{fmt(r.maxLoan)}</div>
              <div className="res-row-large">
                <span>Max Purchase Price</span>
                <span>{fmt(r.maxPurchase)}</span>
              </div>
              <div className="down-payment-note">Based on {r.downPayPctVal.toFixed(2)}% down payment</div>
              <hr className="divider" />
              <div className="pitia-breakdown">
                <div className="pitia-breakdown-title">Monthly PITIA Breakdown</div>
                <div className="pitia-row"><span>Principal &amp; Interest</span><span>{fmt(r.monthlyPI)}</span></div>
                <div className="pitia-row"><span>Property Taxes</span><span>{fmt(r.monthlyTax)}</span></div>
                <div className="pitia-row"><span>Insurance (Home + Supp)</span><span>{fmt(r.monthlyIns)}</span></div>
                <div className="pitia-row"><span>HOA</span><span>{fmt(r.monthlyHOA)}</span></div>
                <div className="pitia-row"><span>Mortgage Insurance</span><span>{fmt(r.monthlyMI)}</span></div>
                <div className="pitia-total"><span>Max Payment (PITIA)</span><span>{fmt(r.maxHousing)}</span></div>
              </div>
            </div>

          </div>
        </div>

        {/* ============================
            PRINT SUMMARY
            ============================ */}
        <div id="afford-print-summary" className="print-summary">
          <div className="print-header">
            <img className="print-logo" src="https://cdn.prod.website-files.com/694e4aaf5f511ad7901b74bc/69576dcb21edb9d479222c02_Logo_Horizontal_Blue.png" alt="mtg.broker" />
            <div className="print-doc-title">Affordability Calculator</div>
          </div>
          <div className="print-scenario-info" id="printScenarioInfo"></div>
          <div className="print-body">
            <div>
              <div className="print-section-title">Income &amp; Debts</div>
              <table className="print-table" id="printIncomeDebts"></table>
              <div className="print-section-title" style={{ marginTop: 12 }}>Loan Parameters</div>
              <table className="print-table" id="printLoanParams"></table>
              <div className="print-section-title" style={{ marginTop: 12 }}>Estimated Expenses (Yearly)</div>
              <table className="print-table" id="printExpenses"></table>
            </div>
            <div>
              <div className="print-section-title">DTI Analysis</div>
              <table className="print-table" id="printDTI"></table>
              <div className="print-section-title" style={{ marginTop: 12 }}>Monthly PITIA Breakdown</div>
              <table className="print-table" id="printPITIA"></table>
            </div>
          </div>
          <div className="print-results-bar" id="printResultsBar"></div>
          <div className="print-footer">Generated from mtg.broker &mdash; <span id="printDate"></span></div>
        </div>

      </div>
    </>
  );
}
