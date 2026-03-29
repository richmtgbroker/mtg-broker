import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link } from "react-router";
import { getUserEmail, getUserPlan } from "../../lib/auth";

export function meta() {
  return [{ title: "Refinance Analysis — MtgBroker" }];
}

/* ================================================
   CONFIGURATION
   ================================================ */
const API_BASE = "https://mtg-broker-api.rich-e00.workers.dev";
const CALC_TYPE = "Refinance Analysis";

/* ================================================
   FORMATTING HELPERS
   ================================================ */
const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtDec = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const pct = (n) => n.toFixed(3) + "%";
const pctLTV = (n) => n.toFixed(2) + "%";

function parseRaw(val) {
  if (!val && val !== 0) return 0;
  return parseFloat(String(val).replace(/[^\d.\-]/g, "")) || 0;
}

/** Allows math like 300000+5000 or 80000/12 */
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

/** Format a string as comma-separated number (skip if math operators present) */
function formatNumberString(val) {
  if (!val) return "";
  const str = String(val);
  /* Skip formatting if it contains math operators */
  if (/[+\-*/]/.test(str.replace(/,/g, "").replace(/^\-/, ""))) return str;
  const clean = str.replace(/[^\d.]/g, "");
  if (!clean) return "";
  const parts = clean.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

/** Live comma formatting for currency inputs (skip when math operators detected) */
function liveFormatCurrency(val) {
  if (!val) return "";
  const str = String(val);
  /* If math operators present, return as-is so user can type expressions */
  if (/[+\-*/]/.test(str.replace(/,/g, "").replace(/^\-/, ""))) return str;
  const clean = str.replace(/[^\d.]/g, "");
  if (!clean) return "";
  const parts = clean.split(".");
  if (parts.length > 2) return str; // malformed, leave alone
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

function escapeHtml(s) {
  return s ? s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") : "";
}

/* ================================================
   MAIN COMPONENT
   ================================================ */
export default function RefiAnalysisCalculator() {
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

  /* --- Form state: Scenario Details --- */
  const [scenName, setScenName] = useState("");
  const [borName, setBorName] = useState("");
  const [refiType, setRefiType] = useState("Rate-Term");
  const [scenDate, setScenDate] = useState("");
  const [ficoScore, setFicoScore] = useState("");
  const [occupancy, setOccupancy] = useState("Primary");

  /* --- Form state: Property --- */
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [propertyValue, setPropertyValue] = useState("");

  /* --- Form state: Current Loan --- */
  const [curLoanType, setCurLoanType] = useState("Conventional");
  const [curBalance, setCurBalance] = useState("");
  const [curRate, setCurRate] = useState("");
  const [origAmount, setOrigAmount] = useState("");
  const [origTerm, setOrigTerm] = useState("");
  const [firstPayDate, setFirstPayDate] = useState("");
  const [curPI, setCurPI] = useState("");
  const [curMI, setCurMI] = useState("");

  /* --- Form state: New Loan --- */
  const [newLoanType, setNewLoanType] = useState("Conventional");
  const [maxLTV, setMaxLTV] = useState("95");
  const [cashoutAmount, setCashoutAmount] = useState("");
  const [debtPayoff, setDebtPayoff] = useState("");
  const [debtPayments, setDebtPayments] = useState("");
  const [closingCosts, setClosingCosts] = useState("");
  const [discountPoints, setDiscountPoints] = useState("");
  const [financeCosts, setFinanceCosts] = useState(true);
  const [overrideLoan, setOverrideLoan] = useState("");

  /* --- Form state: Fees & New Rate --- */
  const [fundingFeePct, setFundingFeePct] = useState("");
  const [miRate, setMiRate] = useState("");
  const [lenderName, setLenderName] = useState("");
  const [productName, setProductName] = useState("");
  const [newRate, setNewRate] = useState("");
  const [newAPR, setNewAPR] = useState("");
  const [newTerm, setNewTerm] = useState("30");

  /* --- Form state: Notes --- */
  const [borNotes, setBorNotes] = useState("");

  /* --- Reference toggle --- */
  const [showRef, setShowRef] = useState(false);

  /* ================================================
     CALCULATIONS
     ================================================ */
  const results = useMemo(() => {
    const propVal = parseRaw(propertyValue);
    const curBalVal = parseRaw(curBalance);
    const curRateVal = parseFloat(curRate) || 0;
    const curPIVal = parseRaw(curPI);
    const curMIVal = parseRaw(curMI);
    const cashOutVal = parseRaw(cashoutAmount);
    const debtPayoffVal = parseRaw(debtPayoff);
    const debtPmtsVal = parseRaw(debtPayments);
    const maxLTVVal = parseFloat(maxLTV) || 95;
    const closingVal = parseRaw(closingCosts);
    const pointsVal = parseRaw(discountPoints);
    const overrideVal = parseRaw(overrideLoan);
    const fundingPctVal = parseFloat(fundingFeePct) || 0;
    const miRateVal = parseFloat(miRate) || 0;
    const newRateVal = parseFloat(newRate) || 0;
    const newTermVal = parseFloat(newTerm) || 30;

    // --- Estimated remaining balance ---
    const origAmtVal = parseRaw(origAmount);
    const origTermVal = parseFloat(origTerm) || 0;
    let estBal = 0;
    let estBalValid = false;
    if (origAmtVal > 0 && curRateVal > 0 && origTermVal > 0 && firstPayDate) {
      const parts = firstPayDate.split("-");
      const startYear = parseInt(parts[0]), startMonth = parseInt(parts[1]);
      const now = new Date();
      let pmtsMade = ((now.getFullYear() - startYear) * 12) + (now.getMonth() + 1 - startMonth);
      if (pmtsMade < 0) pmtsMade = 0;
      if (pmtsMade > origTermVal * 12) pmtsMade = origTermVal * 12;
      const mr = curRateVal / 100 / 12, np = origTermVal * 12;
      if (mr > 0) {
        const origPI = (origAmtVal * mr * Math.pow(1 + mr, np)) / (Math.pow(1 + mr, np) - 1);
        estBal = origAmtVal * Math.pow(1 + mr, pmtsMade) - origPI * ((Math.pow(1 + mr, pmtsMade) - 1) / mr);
        if (estBal < 0) estBal = 0;
        estBalValid = true;
      }
    }

    const maxLoan = propVal * (maxLTVVal / 100);
    let desiredLoan = curBalVal + cashOutVal + debtPayoffVal;
    if (financeCosts) desiredLoan += closingVal + pointsVal;

    const calcLoan = Math.min(maxLoan, desiredLoan);
    const baseLoan = overrideVal > 0 ? overrideVal : calcLoan;
    const newLTVVal = propVal > 0 ? (baseLoan / propVal) * 100 : 0;
    const fundingFee = baseLoan * (fundingPctVal / 100);
    const totalLoan = baseLoan + fundingFee;
    const monthlyMI = (totalLoan * (miRateVal / 100)) / 12;

    // New P&I
    let newPI = 0;
    if (totalLoan > 0 && newRateVal > 0 && newTermVal > 0) {
      const mr = (newRateVal / 100) / 12, np = newTermVal * 12;
      newPI = (totalLoan * mr * Math.pow(1 + mr, np)) / (Math.pow(1 + mr, np) - 1);
    } else if (totalLoan > 0 && newRateVal === 0 && newTermVal > 0) {
      newPI = totalLoan / (newTermVal * 12);
    }

    const curTotal = curPIVal + curMIVal;
    const newTotal = newPI + monthlyMI;
    const savings = curTotal - newTotal;
    const savingsWithDebt = savings + debtPmtsVal;
    const totalCosts = closingVal + pointsVal + fundingFee;
    const recoup = savings > 0 ? totalCosts / savings : 0;
    const oop = financeCosts ? 0 : (closingVal + pointsVal);

    return {
      propVal, curBalVal, curRateVal, curPIVal, curMIVal,
      cashOutVal, debtPayoffVal, debtPmtsVal,
      maxLTVVal, closingVal, pointsVal, overrideVal,
      fundingPctVal, fundingFee, miRateVal, monthlyMI,
      newRateVal, newTermVal,
      estBal, estBalValid,
      maxLoan, desiredLoan, baseLoan, totalLoan, newLTVVal,
      newPI, curTotal, newTotal, savings, savingsWithDebt,
      totalCosts, recoup, oop,
    };
  }, [propertyValue, curBalance, curRate, curPI, curMI, cashoutAmount, debtPayoff, debtPayments,
      maxLTV, closingCosts, discountPoints, financeCosts, overrideLoan,
      fundingFeePct, miRate, newRate, newTerm, origAmount, origTerm, firstPayDate]);

  /* --- Use estimated balance --- */
  const useEstimatedBalance = useCallback(() => {
    if (results.estBal > 0) {
      setCurBalance(Math.round(results.estBal).toLocaleString("en-US"));
    }
  }, [results.estBal]);

  /* --- Zillow lookup --- */
  const lookupValue = useCallback(() => {
    if (!streetAddress.trim()) { alert("Enter a street address first."); return; }
    let addr = streetAddress.trim();
    if (city.trim()) addr += ", " + city.trim();
    if (state.trim()) addr += ", " + state.trim();
    if (zip.trim()) addr += " " + zip.trim();
    window.open("https://www.zillow.com/homes/" + encodeURIComponent(addr) + "_rb/", "_blank");
  }, [streetAddress, city, state, zip]);

  /* --- Collect / populate form data for save/load --- */
  const collectFormData = useCallback(() => ({
    "scenario-name": scenName, "borrower-name": borName, "refi-type": refiType,
    "scenario-date": scenDate, "fico-score": ficoScore, "occupancy": occupancy,
    "street-address": streetAddress, "city": city, "state": state, "zip": zip,
    "property-value": propertyValue,
    "current-loan-type": curLoanType, "current-balance": curBalance, "current-rate": curRate,
    "original-amount": origAmount, "original-term": origTerm, "first-payment-date": firstPayDate,
    "current-pi": curPI, "current-mi": curMI,
    "new-loan-type": newLoanType, "max-ltv": maxLTV, "cashout-amount": cashoutAmount,
    "debt-payoff": debtPayoff, "debt-payments": debtPayments,
    "closing-costs": closingCosts, "discount-points": discountPoints,
    "finance-costs": financeCosts, "override-loan": overrideLoan,
    "funding-fee-pct": fundingFeePct, "mi-rate": miRate,
    "expected-lender": lenderName, "expected-product": productName,
    "new-rate": newRate, "new-apr": newAPR, "new-term": newTerm,
    "borrower-notes": borNotes,
  }), [scenName, borName, refiType, scenDate, ficoScore, occupancy,
       streetAddress, city, state, zip, propertyValue,
       curLoanType, curBalance, curRate, origAmount, origTerm, firstPayDate, curPI, curMI,
       newLoanType, maxLTV, cashoutAmount, debtPayoff, debtPayments,
       closingCosts, discountPoints, financeCosts, overrideLoan,
       fundingFeePct, miRate, lenderName, productName, newRate, newAPR, newTerm, borNotes]);

  const populateForm = useCallback((d) => {
    if (!d) return;
    if (d["scenario-name"] !== undefined) setScenName(d["scenario-name"]);
    if (d["borrower-name"] !== undefined) setBorName(d["borrower-name"]);
    if (d["refi-type"] !== undefined) setRefiType(d["refi-type"]);
    if (d["scenario-date"] !== undefined) setScenDate(d["scenario-date"]);
    if (d["fico-score"] !== undefined) setFicoScore(d["fico-score"]);
    if (d["occupancy"] !== undefined) setOccupancy(d["occupancy"]);
    if (d["street-address"] !== undefined) setStreetAddress(d["street-address"]);
    if (d["city"] !== undefined) setCity(d["city"]);
    if (d["state"] !== undefined) setState(d["state"]);
    if (d["zip"] !== undefined) setZip(d["zip"]);
    if (d["property-value"] !== undefined) setPropertyValue(d["property-value"]);
    if (d["current-loan-type"] !== undefined) setCurLoanType(d["current-loan-type"]);
    if (d["current-balance"] !== undefined) setCurBalance(d["current-balance"]);
    if (d["current-rate"] !== undefined) setCurRate(d["current-rate"]);
    if (d["original-amount"] !== undefined) setOrigAmount(d["original-amount"]);
    if (d["original-term"] !== undefined) setOrigTerm(d["original-term"]);
    if (d["first-payment-date"] !== undefined) setFirstPayDate(d["first-payment-date"]);
    if (d["current-pi"] !== undefined) setCurPI(d["current-pi"]);
    if (d["current-mi"] !== undefined) setCurMI(d["current-mi"]);
    if (d["new-loan-type"] !== undefined) setNewLoanType(d["new-loan-type"]);
    if (d["max-ltv"] !== undefined) setMaxLTV(d["max-ltv"]);
    if (d["cashout-amount"] !== undefined) setCashoutAmount(d["cashout-amount"]);
    if (d["debt-payoff"] !== undefined) setDebtPayoff(d["debt-payoff"]);
    if (d["debt-payments"] !== undefined) setDebtPayments(d["debt-payments"]);
    if (d["closing-costs"] !== undefined) setClosingCosts(d["closing-costs"]);
    if (d["discount-points"] !== undefined) setDiscountPoints(d["discount-points"]);
    if (d["finance-costs"] !== undefined) setFinanceCosts(d["finance-costs"]);
    if (d["override-loan"] !== undefined) setOverrideLoan(d["override-loan"]);
    if (d["funding-fee-pct"] !== undefined) setFundingFeePct(d["funding-fee-pct"]);
    if (d["mi-rate"] !== undefined) setMiRate(d["mi-rate"]);
    if (d["expected-lender"] !== undefined) setLenderName(d["expected-lender"]);
    if (d["expected-product"] !== undefined) setProductName(d["expected-product"]);
    if (d["new-rate"] !== undefined) setNewRate(d["new-rate"]);
    if (d["new-apr"] !== undefined) setNewAPR(d["new-apr"]);
    if (d["new-term"] !== undefined) setNewTerm(d["new-term"]);
    if (d["borrower-notes"] !== undefined) setBorNotes(d["borrower-notes"]);
  }, []);

  /* --- Save scenario --- */
  const saveScenario = useCallback(async () => {
    if (!scenName.trim()) { alert("Enter a Scenario Name first."); return; }
    if (!userEmail) { alert("Please log in to save."); return; }
    if (!currentScenarioId && saveLimit !== Infinity && currentSaveCount >= saveLimit) {
      alert(saveLimit === 0 ? "Saving requires PLUS or PRO plan." : "Save limit reached (" + saveLimit + "). Upgrade to PRO.");
      return;
    }
    setSaveStatus({ state: "saving", text: "Saving..." });
    try {
      const url = currentScenarioId ? API_BASE + "/api/calculator-scenarios/" + currentScenarioId : API_BASE + "/api/calculator-scenarios";
      const method = currentScenarioId ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        headers: { Authorization: "Bearer " + userEmail, "Content-Type": "application/json" },
        body: JSON.stringify({ calculatorType: CALC_TYPE, scenarioName: scenName.trim(), scenarioData: collectFormData() }),
      });
      const res = await response.json();
      if (response.ok && res.scenario) {
        setCurrentScenarioId(res.scenario.id);
        if (method === "POST") setCurrentSaveCount((c) => c + 1);
        setSaveStatus({ state: "saved", text: "Saved" });
      } else {
        setSaveStatus({ state: "error", text: res.error || "Failed" });
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
      const response = await fetch(API_BASE + "/api/calculator-scenarios?type=" + encodeURIComponent(CALC_TYPE), {
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
      const response = await fetch(API_BASE + "/api/calculator-scenarios?type=" + encodeURIComponent(CALC_TYPE), {
        headers: { Authorization: "Bearer " + userEmail },
      });
      const data = await response.json();
      const scenario = (data.scenarios || []).find((s) => s.id === scenarioId);
      if (scenario && scenario.scenarioData) {
        setCurrentScenarioId(scenario.id);
        populateForm(scenario.scenarioData);
        setSaveStatus({ state: "saved", text: "Loaded" });
      } else {
        setSaveStatus({ state: "error", text: "Not found" });
      }
    } catch {
      setSaveStatus({ state: "error", text: "Load error" });
    }
  }, [userEmail, populateForm]);

  /* --- Delete scenario --- */
  const deleteScenario = useCallback(async (scenarioId, scenarioName) => {
    if (!confirm('Delete "' + scenarioName + '"?')) return;
    try {
      const response = await fetch(API_BASE + "/api/calculator-scenarios/" + scenarioId, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + userEmail },
      });
      if (response.ok) {
        if (currentScenarioId === scenarioId) { setCurrentScenarioId(null); setSaveStatus({ state: "", text: "Ready" }); }
        openLoadModal();
      } else { alert("Delete failed."); }
    } catch { alert("Delete failed."); }
  }, [userEmail, currentScenarioId, openLoadModal]);

  /* --- Rename scenario --- */
  const startRename = useCallback((id, name) => {
    setRenameTargetId(id);
    setRenameValue(name);
    setShowRenameModal(true);
  }, []);

  const confirmRename = useCallback(async () => {
    if (!renameValue.trim() || !renameTargetId) return;
    try {
      const response = await fetch(API_BASE + "/api/calculator-scenarios/" + renameTargetId, {
        method: "PUT",
        headers: { Authorization: "Bearer " + userEmail, "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioName: renameValue.trim() }),
      });
      if (response.ok) {
        if (currentScenarioId === renameTargetId) setScenName(renameValue.trim());
        setShowRenameModal(false);
        setRenameTargetId(null);
        openLoadModal();
      } else { alert("Rename failed."); }
    } catch { alert("Rename failed."); }
  }, [renameValue, renameTargetId, userEmail, currentScenarioId, openLoadModal]);

  /* --- Clear form --- */
  const clearForm = useCallback(() => {
    if (!confirm("Reset all fields?")) return;
    setCurrentScenarioId(null);
    setScenName(""); setBorName(""); setRefiType("Rate-Term");
    setScenDate(""); setFicoScore(""); setOccupancy("Primary");
    setStreetAddress(""); setCity(""); setState(""); setZip(""); setPropertyValue("");
    setCurLoanType("Conventional"); setCurBalance(""); setCurRate("");
    setOrigAmount(""); setOrigTerm(""); setFirstPayDate("");
    setCurPI(""); setCurMI("");
    setNewLoanType("Conventional"); setMaxLTV("95"); setCashoutAmount("");
    setDebtPayoff(""); setDebtPayments(""); setClosingCosts("");
    setDiscountPoints(""); setFinanceCosts(true); setOverrideLoan("");
    setFundingFeePct(""); setMiRate("");
    setLenderName(""); setProductName(""); setNewRate(""); setNewAPR(""); setNewTerm("30");
    setBorNotes("");
    setSaveStatus({ state: "", text: "Ready" });
  }, []);

  /* --- Print --- */
  const printSummary = useCallback(() => {
    const name = scenName.trim() || "Untitled";
    const borrower = borName.trim() || "\u2014";
    let dateDisplay = "\u2014";
    if (scenDate) { try { dateDisplay = new Date(scenDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); } catch {} }
    let addr = streetAddress.trim() || "\u2014";
    if (city.trim()) addr += ", " + city.trim();
    if (state.trim()) addr += ", " + state.trim();
    if (zip.trim()) addr += " " + zip.trim();

    const r = results;

    document.getElementById("refi-printScenarioInfo").innerHTML =
      '<div><div class="print-info-label">Scenario</div><div class="print-info-value">' + escapeHtml(name) + '</div></div>' +
      '<div><div class="print-info-label">Borrower</div><div class="print-info-value">' + escapeHtml(borrower) + '</div></div>' +
      '<div><div class="print-info-label">Date</div><div class="print-info-value">' + dateDisplay + '</div></div>' +
      '<div><div class="print-info-label">Property</div><div class="print-info-value">' + escapeHtml(addr) + '</div></div>';

    document.getElementById("refi-printCurrentLoan").innerHTML =
      '<tr><td>Type / Rate</td><td>' + curLoanType + ' @ ' + (r.curRateVal).toFixed(3) + '%</td></tr>' +
      '<tr><td>Payoff Balance</td><td>' + fmt(r.curBalVal) + '</td></tr>' +
      (parseRaw(origAmount) > 0 ? '<tr><td>Original Amount / Term</td><td>' + fmt(parseRaw(origAmount)) + ' / ' + (origTerm || 0) + ' yr</td></tr>' : '') +
      '<tr><td>Property Value</td><td>' + fmt(r.propVal) + '</td></tr>' +
      '<tr><td>Monthly P&I + MI</td><td>' + fmtDec(r.curPIVal) + ' + ' + fmtDec(r.curMIVal) + '</td></tr>';

    document.getElementById("refi-printNewLoan").innerHTML =
      '<tr><td>Type</td><td>' + newLoanType + ' \u2014 ' + refiType + '</td></tr>' +
      '<tr><td>Lender</td><td>' + (lenderName || '\u2014') + '</td></tr>' +
      '<tr><td>Rate / Term</td><td>' + (r.newRateVal).toFixed(3) + '% / ' + r.newTermVal + ' yr</td></tr>' +
      '<tr><td>Total Loan</td><td>' + fmt(r.totalLoan) + ' (LTV ' + pctLTV(r.newLTVVal) + ')</td></tr>' +
      '<tr><td>New P&I + MI</td><td>' + fmtDec(r.newPI) + ' + ' + fmtDec(r.monthlyMI) + '</td></tr>';

    document.getElementById("refi-printComparison").innerHTML =
      '<tr><td>Current P&I+MI</td><td>' + fmtDec(r.curTotal) + '</td></tr>' +
      '<tr><td>New P&I+MI</td><td>' + fmtDec(r.newTotal) + '</td></tr>' +
      '<tr class="print-total-row green"><td>Monthly Savings</td><td>' + fmtDec(r.savings) + '</td></tr>' +
      (r.debtPmtsVal > 0 ? '<tr class="green"><td>w/ Debt Payoff</td><td>' + fmtDec(r.savingsWithDebt) + '</td></tr>' : '');

    document.getElementById("refi-printCosts").innerHTML =
      '<tr><td>Closing + Points</td><td>' + fmt(r.closingVal + r.pointsVal) + '</td></tr>' +
      '<tr><td>Funding Fee</td><td>' + fmt(r.fundingFee) + '</td></tr>' +
      '<tr><td>Out of Pocket</td><td>' + fmt(r.oop) + '</td></tr>' +
      '<tr class="print-total-row"><td>Recoup</td><td>' + (r.recoup > 0 ? r.recoup.toFixed(1) + ' months' : '\u2014') + '</td></tr>';

    document.getElementById("refi-printResultsBar").innerHTML =
      '<div class="print-result-card"><div class="print-result-label">Current</div><div class="print-result-value">' + fmtDec(r.curTotal) + '</div></div>' +
      '<div class="print-result-card"><div class="print-result-label">New</div><div class="print-result-value">' + fmtDec(r.newTotal) + '</div></div>' +
      '<div class="print-result-card"><div class="print-result-label">Savings</div><div class="print-result-value green">' + fmtDec(r.savings) + '</div></div>' +
      '<div class="print-result-card"><div class="print-result-label">w/ Debt</div><div class="print-result-value green">' + fmtDec(r.savingsWithDebt) + '</div></div>' +
      '<div class="print-result-card"><div class="print-result-label">Recoup</div><div class="print-result-value blue">' + (r.recoup > 0 ? r.recoup.toFixed(1) + ' mo' : '\u2014') + '</div></div>';

    const notes = borNotes.trim();
    document.getElementById("refi-printNotes").innerHTML = notes ? '<div class="print-notes"><div class="print-notes-label">Notes to Borrower</div>' + escapeHtml(notes) + '</div>' : '';
    document.getElementById("refi-printDate").textContent = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    setTimeout(() => window.print(), 150);
  }, [scenName, borName, scenDate, streetAddress, city, state, zip, curLoanType, newLoanType, refiType, lenderName, origAmount, origTerm, borNotes, results]);

  /* --- Calc-field handler (expression eval on blur OR Enter) --- */
  const handleCalcFieldBlur = useCallback((value, setter) => {
    if (value && /[+\-*/]/.test(String(value).replace(/,/g, ""))) {
      const result = evaluateExpression(String(value));
      if (!isNaN(result)) {
        setter(formatNumberString(String(result)));
        return;
      }
    }
    setter(formatNumberString(value));
  }, []);

  const handleCalcFieldKeyDown = useCallback((e, value, setter) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCalcFieldBlur(value, setter);
      e.target.blur();
    }
  }, [handleCalcFieldBlur]);

  /* --- Currency input handler (live commas, skip math operators) --- */
  const handleCurrencyChange = useCallback((val, setter) => {
    setter(liveFormatCurrency(val));
  }, []);

  /* --- Empty-field class helper --- */
  const emptyClass = (val) => (!String(val).trim() ? " field-empty" : "");

  /* --- Save status dot class --- */
  const dotClass = saveStatus.state ? "save-status-dot " + saveStatus.state : "save-status-dot";

  const r = results;

  /* --- Savings hero class --- */
  const heroClass = r.savings > 0 ? " pos" : r.savings < 0 ? " neg" : "";

  /* --- LTV value class --- */
  const ltvClass = r.newLTVVal > 97 ? " neg" : r.newLTVVal > 80 ? " warn" : "";

  return (
    <>
      {/* ================================================
          SCOPED CSS
          ================================================ */}
      <style>{`
        @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css');

        /* === BREADCRUMB === */
        .calc-breadcrumb { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; font-size: 14px; color: #64748B; }
        .calc-breadcrumb a { color: #2563EB; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
        .calc-breadcrumb a:hover { color: #1D4ED8; text-decoration: underline; }
        .calc-breadcrumb .bc-sep { color: #CBD5E1; }
        .calc-breadcrumb .bc-current { color: #0F172A; font-weight: 600; }

        /* === CONTAINER === */
        .calc-container { width: 100%; max-width: 1280px; margin: 0 auto; font-family: 'Host Grotesk', system-ui, -apple-system, sans-serif; color: #0f172a; box-sizing: border-box; }
        .calc-container * { box-sizing: border-box; }

        /* === HEADER (dark bar, 16px all corners) === */
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

        /* === SAVE STATUS === */
        .save-status { display: flex; align-items: center; gap: 6px; }
        .save-status-dot { width: 8px; height: 8px; border-radius: 50%; background: #64748B; flex-shrink: 0; }
        .save-status-dot.saving { background: #F59E0B; animation: pulse-dot 1s infinite; }
        .save-status-dot.saved { background: #10B981; }
        .save-status-dot.error { background: #EF4444; }
        .save-status-dot.loading { background: #3B82F6; animation: pulse-dot 1s infinite; }
        .save-status-text { color: #94A3B8; font-size: 12px; font-weight: 500; white-space: nowrap; }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

        /* === FLOATING CARDS === */
        .floating-card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); transition: box-shadow 0.2s ease; }
        .floating-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.07); }
        .card-title { font-size: 14px; font-weight: 700; color: #0F172A; text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 20px 0; padding-bottom: 10px; border-bottom: 2px solid #E2E8F0; display: flex; align-items: center; gap: 8px; }
        .card-title i { color: #2563EB; font-size: 14px; }

        /* === INPUTS === */
        .input-group { margin-bottom: 16px; }
        .input-group label { display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px; }
        .calc-input { width: 100%; padding: 10px 12px; border: 1px solid #CBD5E1; border-radius: 8px; font-size: 15px; font-family: 'Host Grotesk', system-ui, sans-serif; color: #0f172a; background: #FFFFFF; transition: border-color 0.2s, box-shadow 0.2s; }
        .calc-input:focus { outline: none; border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
        .calc-input::placeholder { color: #94A3B8; }
        .calc-input.field-empty { background-color: #FFFBEB; border-color: #FDE68A; }
        .req { color: #DC2626; }
        .grid-2-compact { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .grid-3-compact { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }

        /* === REFI GRID (side-by-side loan panels) === */
        .refi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
        .refi-col:first-child { border-right: 1px solid #E2E8F0; padding-right: 48px; }
        .section-label { font-size: 16px; font-weight: 700; color: #0F172A; margin: 0 0 24px 0; }

        /* === COMPUTED DISPLAY === */
        .computed-display { width: 100%; padding: 10px 12px; border: 1px solid #BAE6FD; border-radius: 8px; font-size: 15px; font-weight: 700; color: #0369A1; background: #F0F9FF; min-height: 43px; display: flex; align-items: center; }

        /* === REFERENCE BOX === */
        .ref-toggle { font-size: 12px; color: #2563EB; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 5px; margin-bottom: 8px; background: none; border: none; font-family: 'Host Grotesk', system-ui, sans-serif; }
        .ref-toggle:hover { color: #1D4ED8; }
        .ref-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 12px; margin-bottom: 16px; font-size: 12px; line-height: 1.7; color: #475569; }
        .ref-box strong { color: #0f172a; }

        /* === USE ESTIMATE BUTTON === */
        .use-estimate-btn { display: inline-flex; align-items: center; gap: 6px; background: none; border: 1px solid #2563EB; color: #2563EB; font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 6px; cursor: pointer; margin-bottom: 16px; font-family: 'Host Grotesk', system-ui, sans-serif; transition: all 0.15s; }
        .use-estimate-btn:hover { background: #2563EB; color: white; }

        /* === RESULTS AREA === */
        .results-area { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 16px; padding: 0; margin-bottom: 20px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }

        /* Savings Hero */
        .savings-hero { padding: 28px 24px; text-align: center; border-bottom: 1px solid #E2E8F0; transition: background 0.3s; }
        .savings-hero.pos { background: linear-gradient(180deg, #ECFDF5 0%, #F8FAFC 100%); }
        .savings-hero.neg { background: linear-gradient(180deg, #FEF2F2 0%, #F8FAFC 100%); }
        .savings-hero-label { display: inline-block; font-size: 12px; font-weight: 700; color: #059669; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
        .savings-hero.neg .savings-hero-label { color: #DC2626; }
        .savings-hero-value { font-size: 48px; font-weight: 800; color: #065F46; line-height: 1; letter-spacing: -0.02em; }
        .savings-hero.neg .savings-hero-value { color: #B91C1C; }
        .savings-hero-sub { font-size: 13px; color: #64748B; margin-top: 6px; }

        /* Section headings inside results */
        .results-heading { font-size: 15px; font-weight: 700; color: #0F172A; margin: 0 0 16px 0; }

        /* Payment Comparison */
        .compare-section { padding: 24px; border-bottom: 1px solid #E2E8F0; }
        .compare-cards { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
        .compare-card { flex: 1; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; text-align: center; }
        .compare-card.highlight { border-color: #2563EB; background: #F0F9FF; }
        .compare-card-label { font-size: 13px; font-weight: 700; color: #475569; margin-bottom: 2px; }
        .compare-card-sublabel { font-size: 11px; color: #94A3B8; margin-bottom: 8px; }
        .compare-card-value { font-size: 28px; font-weight: 800; color: #0F172A; }
        .compare-card-value.accent { color: #2563EB; }
        .compare-arrow { font-size: 20px; color: #94A3B8; flex-shrink: 0; }
        .compare-details { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px 16px; }
        .compare-detail-item { text-align: center; }
        .compare-detail-label { display: block; font-size: 11px; font-weight: 600; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 2px; }
        .compare-detail-value { font-size: 15px; font-weight: 700; color: #0F172A; }
        .compare-detail-value.accent { color: #2563EB; }

        /* Key Numbers */
        .key-numbers { padding: 24px; border-bottom: 1px solid #E2E8F0; }
        .key-cards { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
        .key-card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; text-align: center; }
        .key-card-icon { font-size: 20px; color: #2563EB; margin-bottom: 8px; }
        .key-card-icon.green-icon { color: #059669; }
        .key-card-value { font-size: 24px; font-weight: 800; color: #0F172A; margin-bottom: 4px; }
        .key-card-value.green { color: #059669; }
        .key-card-value.accent { color: #2563EB; }
        .key-card-value.warn { color: #D97706; }
        .key-card-value.neg { color: #DC2626; }
        .key-card-label { font-size: 13px; font-weight: 700; color: #475569; margin-bottom: 6px; }
        .key-card-explain { font-size: 12px; color: #94A3B8; line-height: 1.4; }

        /* Detail Section */
        .detail-section { padding: 24px; }
        .detail-section .refi-grid .refi-col:first-child { padding-right: 32px; }
        .oop-note { font-size: 12px; color: #94A3B8; font-weight: 500; margin-top: 8px; display: flex; align-items: center; gap: 5px; }
        .oop-note i { font-size: 11px; }

        /* Breakdown Rows */
        .breakdown-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #E2E8F0; font-size: 14px; color: #475569; }
        .breakdown-row .val { font-weight: 700; color: #0F172A; }
        .breakdown-row.total { border-top: 2px solid #0F172A; border-bottom: none; padding-top: 14px; margin-top: 4px; }
        .breakdown-row.total span { font-weight: 800; color: #0F172A; font-size: 15px; }

        /* === MODAL === */
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

        /* === RESPONSIVE === */
        @media (max-width: 768px) {
          .calc-header { flex-direction: column; align-items: flex-start; }
          .header-left { width: 100%; margin-bottom: 8px; }
          .header-actions { width: 100%; justify-content: space-between; }
          .refi-grid { grid-template-columns: 1fr; gap: 0; }
          .refi-col:first-child { border-right: none; padding-right: 0; padding-bottom: 32px; border-bottom: 1px solid #E2E8F0; margin-bottom: 32px; }
          .grid-3-compact { grid-template-columns: 1fr; }
          .savings-hero-value { font-size: 36px; }
          .compare-cards { flex-direction: column; }
          .compare-arrow { transform: rotate(90deg); }
          .compare-details { grid-template-columns: 1fr 1fr; }
          .key-cards { grid-template-columns: 1fr; }
          .detail-section .refi-grid .refi-col:first-child { padding-right: 0; }
          .floating-card { padding: 20px 16px; border-radius: 12px; }
        }
        @media (max-width: 480px) {
          .header-actions { flex-direction: column; gap: 12px; }
          .btn-group { width: 100%; justify-content: space-between; gap: 6px; }
          .action-btn { flex: 1; text-align: center; padding: 10px 6px; justify-content: center; font-size: 12px; }
          .save-status { width: 100%; justify-content: center; }
          .grid-2-compact { grid-template-columns: 1fr; }
          .floating-card { padding: 16px 14px; }
          .compare-card-value { font-size: 22px; }
          .compare-details { grid-template-columns: 1fr; }
        }

        /* === PRINT STYLES === */
        .print-summary { display: none; }
        @media print {
          body * { visibility: hidden !important; }
          /* Collapse non-print content to zero height */
          .calc-container > *:not(.print-summary),
          .calc-header, .floating-card, .results-area, .calc-breadcrumb,
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
          .print-table tr.green td { color: #059669 !important; }
          .print-results-bar { display: grid !important; grid-template-columns: repeat(5, 1fr) !important; gap: 10px !important; margin-top: 16px !important; }
          .print-result-card { background: #F0F9FF !important; border: 1px solid #BAE6FD !important; border-radius: 8px !important; padding: 10px !important; text-align: center !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-result-label { font-size: 7pt !important; font-weight: 600 !important; color: #64748B !important; text-transform: uppercase !important; }
          .print-result-value { font-size: 12pt !important; font-weight: 800 !important; }
          .print-result-value.green { color: #059669 !important; }
          .print-result-value.blue { color: #2563EB !important; }
          .print-notes { margin-top: 14px !important; padding: 12px 16px !important; background: #F8FAFC !important; border: 1px solid #E2E8F0 !important; border-radius: 8px !important; font-size: 10pt !important; white-space: pre-wrap !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-notes-label { font-size: 8pt !important; font-weight: 700 !important; color: #64748B !important; text-transform: uppercase !important; margin-bottom: 4px !important; }
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
          <span className="bc-current">Refinance Analysis</span>
        </div>

        {/* ============================
            HEADER BAR
            ============================ */}
        <div className="calc-header">
          <div className="header-left">
            <h1 className="calc-title">Refinance Analysis</h1>
            <p className="calc-subtitle">Compare current vs. new loan scenarios.</p>
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
            LOAD MODAL
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
                  saveLimit === 0 ? <><i className="fa-solid fa-lock" style={{ marginRight: 4 }}></i> Saving requires PLUS or PRO</> :
                  saveLimit === Infinity ? <>{scenarios.length} saved (unlimited)</> :
                  <>{scenarios.length} of {saveLimit} saves used</>
                }
              </div>
              <div className="modal-list">
                {loadingScenarios ? (
                  <div className="modal-loading"><div className="modal-spinner"></div><span>Loading scenarios...</span></div>
                ) : !userEmail ? (
                  <div className="modal-empty">
                    <div className="modal-empty-icon"><i className="fa-solid fa-lock"></i></div>
                    <p className="modal-empty-title">Log in to view saved scenarios</p>
                  </div>
                ) : scenarios.length === 0 ? (
                  <div className="modal-empty">
                    <div className="modal-empty-icon"><i className="fa-solid fa-folder-open"></i></div>
                    <p className="modal-empty-title">No saved scenarios yet</p>
                    <p className="modal-empty-text">Save a scenario to see it here.</p>
                  </div>
                ) : (
                  scenarios.map((s) => {
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
                  })
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

        {/* ============================
            CARD: SCENARIO DETAILS
            ============================ */}
        <div className="floating-card">
          <h3 className="card-title"><i className="fa-solid fa-file-lines"></i> Scenario Details</h3>
          <div className="grid-3-compact">
            <div className="input-group">
              <label>Scenario Name <span className="req">*</span></label>
              <input type="text" className={`calc-input${emptyClass(scenName)}`} value={scenName} onChange={(e) => setScenName(e.target.value)} placeholder="e.g. Smith Refi Analysis" />
            </div>
            <div className="input-group">
              <label>Borrower</label>
              <input type="text" className={`calc-input${emptyClass(borName)}`} value={borName} onChange={(e) => setBorName(e.target.value)} placeholder="John & Jane Smith" />
            </div>
            <div className="input-group">
              <label>Refi Type</label>
              <select className="calc-input" value={refiType} onChange={(e) => setRefiType(e.target.value)}>
                <option value="Rate-Term">Rate-Term</option>
                <option value="Cash-Out">Cash-Out</option>
                <option value="Streamline">Streamline</option>
              </select>
            </div>
          </div>
          <div className="grid-3-compact" style={{ marginBottom: 0 }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Date</label>
              <input type="date" className="calc-input" value={scenDate} onChange={(e) => setScenDate(e.target.value)} />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>FICO</label>
              <input type="number" className={`calc-input${emptyClass(ficoScore)}`} value={ficoScore} onChange={(e) => setFicoScore(e.target.value)} placeholder="740" />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Occupancy</label>
              <select className="calc-input" value={occupancy} onChange={(e) => setOccupancy(e.target.value)}>
                <option value="Primary">Primary</option>
                <option value="Secondary">Secondary</option>
                <option value="Investment">Investment</option>
              </select>
            </div>
          </div>
        </div>

        {/* ============================
            CARD: PROPERTY
            ============================ */}
        <div className="floating-card">
          <h3 className="card-title"><i className="fa-solid fa-house"></i> Property</h3>
          <div className="input-group">
            <label>Street Address</label>
            <input type="text" className={`calc-input${emptyClass(streetAddress)}`} value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} placeholder="123 Main Street" />
          </div>
          <div className="grid-3-compact">
            <div className="input-group">
              <label>City</label>
              <input type="text" className={`calc-input${emptyClass(city)}`} value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
            </div>
            <div className="input-group">
              <label>State</label>
              <input type="text" className={`calc-input${emptyClass(state)}`} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} placeholder="AL" maxLength={2} style={{ textTransform: "uppercase" }} />
            </div>
            <div className="input-group">
              <label>Zip</label>
              <input type="text" className={`calc-input${emptyClass(zip)}`} value={zip} onChange={(e) => setZip(e.target.value)} placeholder="36609" maxLength={5} />
            </div>
          </div>
          <div className="grid-2-compact" style={{ marginBottom: 0 }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Property Value <span className="req">*</span></label>
              <input type="text" className={`calc-input${emptyClass(propertyValue)}`} value={propertyValue}
                onChange={(e) => handleCurrencyChange(e.target.value, setPropertyValue)}
                onBlur={() => handleCalcFieldBlur(propertyValue, setPropertyValue)}
                onKeyDown={(e) => handleCalcFieldKeyDown(e, propertyValue, setPropertyValue)}
                placeholder="$0" />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>&nbsp;</label>
              <button className="action-btn btn-load" type="button" onClick={lookupValue} style={{ height: 43, width: "100%", justifyContent: "center" }}>
                <i className="fa-solid fa-arrow-up-right-from-square"></i> Zillow Lookup
              </button>
            </div>
          </div>
        </div>

        {/* ============================
            CARD: LOAN COMPARISON
            ============================ */}
        <div className="floating-card">
          <h3 className="card-title"><i className="fa-solid fa-scale-balanced"></i> Loan Comparison</h3>
          <div className="refi-grid">

            {/* CURRENT LOAN */}
            <div className="refi-col">
              <h3 className="section-label">Current Loan</h3>

              <div className="input-group">
                <label>Loan Type</label>
                <select className="calc-input" value={curLoanType} onChange={(e) => setCurLoanType(e.target.value)}>
                  <option>Conventional</option><option>FHA</option><option>VA</option><option>USDA</option>
                </select>
              </div>

              <div className="input-group">
                <label>Payoff Balance</label>
                <input type="text" className={`calc-input${emptyClass(curBalance)}`} value={curBalance}
                  onChange={(e) => handleCurrencyChange(e.target.value, setCurBalance)}
                  onBlur={() => handleCalcFieldBlur(curBalance, setCurBalance)}
                  onKeyDown={(e) => handleCalcFieldKeyDown(e, curBalance, setCurBalance)}
                  placeholder="$0 (or use estimate below)" />
              </div>

              <div className="input-group">
                <label>Current Rate (%)</label>
                <input type="number" className={`calc-input${emptyClass(curRate)}`} value={curRate} onChange={(e) => setCurRate(e.target.value)} step="0.125" placeholder="6.625" />
              </div>

              <div className="grid-2-compact">
                <div className="input-group">
                  <label>Original Loan Amount</label>
                  <input type="text" className={`calc-input${emptyClass(origAmount)}`} value={origAmount}
                    onChange={(e) => handleCurrencyChange(e.target.value, setOrigAmount)}
                    onBlur={() => handleCalcFieldBlur(origAmount, setOrigAmount)}
                    onKeyDown={(e) => handleCalcFieldKeyDown(e, origAmount, setOrigAmount)}
                    placeholder="$0" />
                </div>
                <div className="input-group">
                  <label>Original Term (Years)</label>
                  <input type="number" className={`calc-input${emptyClass(origTerm)}`} value={origTerm} onChange={(e) => setOrigTerm(e.target.value)} placeholder="30" />
                </div>
              </div>

              <div className="grid-2-compact">
                <div className="input-group">
                  <label>First Payment Date</label>
                  <input type="month" className="calc-input" value={firstPayDate} onChange={(e) => setFirstPayDate(e.target.value)} />
                </div>
                <div className="input-group">
                  <label>Estimated Balance</label>
                  <div className="computed-display" style={{ color: r.estBalValid ? "#2563EB" : "#94A3B8" }}>
                    {r.estBalValid ? "\u2248 " + fmt(Math.round(r.estBal)) : "Enter loan details"}
                  </div>
                </div>
              </div>

              {/* Use estimated balance button */}
              {r.estBalValid && r.estBal > 0 && !parseRaw(curBalance) && (
                <button type="button" className="use-estimate-btn" onClick={useEstimatedBalance}>
                  <i className="fa-solid fa-arrow-up"></i> Use estimated balance
                </button>
              )}

              <div className="grid-2-compact" style={{ marginBottom: 0 }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Current P&amp;I / Mo</label>
                  <input type="text" className={`calc-input${emptyClass(curPI)}`} value={curPI}
                    onChange={(e) => handleCurrencyChange(e.target.value, setCurPI)}
                    onBlur={() => handleCalcFieldBlur(curPI, setCurPI)}
                    onKeyDown={(e) => handleCalcFieldKeyDown(e, curPI, setCurPI)}
                    placeholder="$0" />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Current MI / Mo</label>
                  <input type="text" className={`calc-input${emptyClass(curMI)}`} value={curMI}
                    onChange={(e) => handleCurrencyChange(e.target.value, setCurMI)}
                    onBlur={() => handleCalcFieldBlur(curMI, setCurMI)}
                    onKeyDown={(e) => handleCalcFieldKeyDown(e, curMI, setCurMI)}
                    placeholder="$0" />
                </div>
              </div>
            </div>

            {/* NEW LOAN */}
            <div className="refi-col">
              <h3 className="section-label">New Loan</h3>

              <div className="grid-2-compact">
                <div className="input-group">
                  <label>Loan Type</label>
                  <select className="calc-input" value={newLoanType} onChange={(e) => setNewLoanType(e.target.value)}>
                    <option>Conventional</option><option>FHA</option><option>VA</option><option>USDA</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Max LTV %</label>
                  <input type="number" className="calc-input" value={maxLTV} onChange={(e) => setMaxLTV(e.target.value)} step="0.5" />
                </div>
              </div>

              <div className="input-group">
                <label>Cash-Out Amount</label>
                <input type="text" className={`calc-input${emptyClass(cashoutAmount)}`} value={cashoutAmount}
                  onChange={(e) => handleCurrencyChange(e.target.value, setCashoutAmount)}
                  onBlur={() => handleCalcFieldBlur(cashoutAmount, setCashoutAmount)}
                  onKeyDown={(e) => handleCalcFieldKeyDown(e, cashoutAmount, setCashoutAmount)}
                  placeholder="$0" />
              </div>

              <div className="input-group">
                <label>Debt Payoff Amount</label>
                <input type="text" className={`calc-input${emptyClass(debtPayoff)}`} value={debtPayoff}
                  onChange={(e) => handleCurrencyChange(e.target.value, setDebtPayoff)}
                  onBlur={() => handleCalcFieldBlur(debtPayoff, setDebtPayoff)}
                  onKeyDown={(e) => handleCalcFieldKeyDown(e, debtPayoff, setDebtPayoff)}
                  placeholder="$0" />
              </div>

              <div className="input-group">
                <label>Monthly Debt Payments Being Eliminated</label>
                <input type="text" className={`calc-input${emptyClass(debtPayments)}`} value={debtPayments}
                  onChange={(e) => handleCurrencyChange(e.target.value, setDebtPayments)}
                  onBlur={() => handleCalcFieldBlur(debtPayments, setDebtPayments)}
                  onKeyDown={(e) => handleCalcFieldKeyDown(e, debtPayments, setDebtPayments)}
                  placeholder="$0 /mo" />
              </div>

              <div className="input-group">
                <label>Max Loan Amount</label>
                <div className="computed-display">{fmt(r.maxLoan)}</div>
              </div>

              <div className="grid-2-compact">
                <div className="input-group">
                  <label>Closing Costs</label>
                  <input type="text" className={`calc-input${emptyClass(closingCosts)}`} value={closingCosts}
                    onChange={(e) => handleCurrencyChange(e.target.value, setClosingCosts)}
                    onBlur={() => handleCalcFieldBlur(closingCosts, setClosingCosts)}
                    onKeyDown={(e) => handleCalcFieldKeyDown(e, closingCosts, setClosingCosts)}
                    placeholder="$0" />
                </div>
                <div className="input-group">
                  <label>Discount Points</label>
                  <input type="text" className={`calc-input${emptyClass(discountPoints)}`} value={discountPoints}
                    onChange={(e) => handleCurrencyChange(e.target.value, setDiscountPoints)}
                    onBlur={() => handleCalcFieldBlur(discountPoints, setDiscountPoints)}
                    onKeyDown={(e) => handleCalcFieldKeyDown(e, discountPoints, setDiscountPoints)}
                    placeholder="$0" />
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={financeCosts} onChange={(e) => setFinanceCosts(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#2563EB", cursor: "pointer" }} />
                  Roll closing costs into loan
                </label>
              </div>

              <div className="grid-2-compact" style={{ marginBottom: 0 }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Override Loan Amount</label>
                  <input type="text" className={`calc-input${emptyClass(overrideLoan)}`} value={overrideLoan}
                    onChange={(e) => handleCurrencyChange(e.target.value, setOverrideLoan)}
                    onBlur={() => handleCalcFieldBlur(overrideLoan, setOverrideLoan)}
                    onKeyDown={(e) => handleCalcFieldKeyDown(e, overrideLoan, setOverrideLoan)}
                    placeholder="Leave blank for auto" style={{ background: "#FFFBEB" }} />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Base Loan Amount</label>
                  <div className="computed-display">{fmt(r.desiredLoan)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============================
            CARD: FEES & NEW RATE
            ============================ */}
        <div className="floating-card">
          <h3 className="card-title"><i className="fa-solid fa-receipt"></i> Fees &amp; New Rate</h3>
          <div className="refi-grid">

            {/* FEES & INSURANCE */}
            <div className="refi-col">
              <h3 className="section-label">Fees &amp; Insurance</h3>

              <button type="button" className="ref-toggle" onClick={() => setShowRef(!showRef)}>
                <i className="fa-solid fa-circle-info"></i> Reference rates
              </button>
              {showRef && (
                <div className="ref-box">
                  <strong>Funding Fee:</strong> Conv 0% &middot; FHA UFMIP 1.75% &middot; USDA 1.00% &middot; VA 0.5&ndash;3.3%<br/>
                  <strong>MI:</strong> VA 0% &middot; USDA 0.35% &middot; FHA &lt;90% 0.50% / &ge;90% 0.55% &middot; Conv &lt;80% 0% / &ge;80% varies<br/>
                  <a href="https://www.va.gov/housing-assistance/home-loans/funding-fee-and-closing-costs/" target="_blank" rel="noopener noreferrer" style={{ color: "#2563EB", fontWeight: 600, textDecoration: "none" }}>VA Funding Fee Chart &rarr;</a>
                </div>
              )}

              <div className="grid-2-compact">
                <div className="input-group">
                  <label>Funding Fee %</label>
                  <input type="number" className="calc-input" value={fundingFeePct} onChange={(e) => setFundingFeePct(e.target.value)} step="0.01" placeholder="0" />
                </div>
                <div className="input-group">
                  <label>Funding Fee Amount</label>
                  <div className="computed-display">{fmt(r.fundingFee)}</div>
                </div>
              </div>

              <div className="grid-2-compact" style={{ marginBottom: 0 }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>MI Rate %</label>
                  <input type="number" className="calc-input" value={miRate} onChange={(e) => setMiRate(e.target.value)} step="0.01" placeholder="0" />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Monthly MI</label>
                  <div className="computed-display">{fmtDec(r.monthlyMI)}/mo</div>
                </div>
              </div>
            </div>

            {/* NEW RATE & TERM */}
            <div className="refi-col">
              <h3 className="section-label">New Rate &amp; Term</h3>

              <div className="grid-2-compact">
                <div className="input-group">
                  <label>Lender</label>
                  <input type="text" className={`calc-input${emptyClass(lenderName)}`} value={lenderName} onChange={(e) => setLenderName(e.target.value)} placeholder="e.g. AFR" />
                </div>
                <div className="input-group">
                  <label>Product</label>
                  <input type="text" className={`calc-input${emptyClass(productName)}`} value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="e.g. Conv 30yr" />
                </div>
              </div>

              <div className="grid-2-compact">
                <div className="input-group">
                  <label>New Rate % <span className="req">*</span></label>
                  <input type="number" className={`calc-input${emptyClass(newRate)}`} value={newRate} onChange={(e) => setNewRate(e.target.value)} step="0.125" placeholder="5.990" />
                </div>
                <div className="input-group">
                  <label>APR (optional)</label>
                  <input type="number" className="calc-input" value={newAPR} onChange={(e) => setNewAPR(e.target.value)} step="0.001" placeholder="6.125" />
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>New Term (Years)</label>
                <input type="number" className="calc-input" value={newTerm} onChange={(e) => setNewTerm(e.target.value)} placeholder="30" />
              </div>
            </div>
          </div>
        </div>

        {/* ============================
            RESULTS AREA
            ============================ */}
        <div className="results-area">

          {/* 1 - SAVINGS HERO */}
          <div className={`savings-hero${heroClass}`}>
            <span className="savings-hero-label">{r.savings >= 0 ? "Monthly Savings" : "Monthly Increase"}</span>
            <div className="savings-hero-value">{fmtDec(r.savings)}</div>
            <div className="savings-hero-sub">
              {r.curTotal === 0 && r.newTotal === 0
                ? "Enter loan details to see savings"
                : r.savings > 0
                  ? fmtDec(r.savings * 12) + " per year"
                  : r.savings < 0
                    ? "New payment is higher"
                    : "Enter loan details to see savings"}
            </div>
          </div>

          {/* 2 - PAYMENT COMPARISON */}
          <div className="compare-section">
            <h3 className="results-heading">How Your Payment Changes</h3>
            <div className="compare-cards">
              <div className="compare-card">
                <div className="compare-card-label">Current Monthly Payment</div>
                <div className="compare-card-sublabel">Principal + Interest + MI</div>
                <div className="compare-card-value">{fmtDec(r.curTotal)}</div>
              </div>
              <div className="compare-arrow"><i className="fa-solid fa-arrow-right"></i></div>
              <div className="compare-card highlight">
                <div className="compare-card-label">New Monthly Payment</div>
                <div className="compare-card-sublabel">Principal + Interest + MI</div>
                <div className="compare-card-value accent">{fmtDec(r.newTotal)}</div>
              </div>
            </div>
            <div className="compare-details">
              <div className="compare-detail-item">
                <span className="compare-detail-label">Current Rate</span>
                <span className="compare-detail-value">{r.curRateVal ? pct(r.curRateVal) : "\u2014"}</span>
              </div>
              <div className="compare-detail-item">
                <span className="compare-detail-label">New Rate</span>
                <span className="compare-detail-value accent">{r.newRateVal ? pct(r.newRateVal) : "\u2014"}</span>
              </div>
              <div className="compare-detail-item">
                <span className="compare-detail-label">Current Loan Type</span>
                <span className="compare-detail-value">{curLoanType}</span>
              </div>
              <div className="compare-detail-item">
                <span className="compare-detail-label">New Loan Type</span>
                <span className="compare-detail-value">{newLoanType}</span>
              </div>
            </div>
          </div>

          {/* 3 - KEY NUMBERS */}
          <div className="key-numbers">
            <h3 className="results-heading">Key Numbers</h3>
            <div className="key-cards">
              <div className="key-card">
                <div className="key-card-icon"><i className="fa-solid fa-calendar-check"></i></div>
                <div className="key-card-value accent">{r.recoup > 0 ? r.recoup.toFixed(1) + " months" : "\u2014"}</div>
                <div className="key-card-label">Break-Even Period</div>
                <div className="key-card-explain">How long until your savings cover the cost of refinancing</div>
              </div>
              <div className="key-card">
                <div className="key-card-icon green-icon"><i className="fa-solid fa-piggy-bank"></i></div>
                <div className="key-card-value green">{fmtDec(r.savingsWithDebt)}</div>
                <div className="key-card-label">Total Monthly Benefit</div>
                <div className="key-card-explain">Monthly savings including any debt payments you're eliminating</div>
              </div>
              <div className="key-card">
                <div className="key-card-icon"><i className="fa-solid fa-house-circle-check"></i></div>
                <div className={`key-card-value${ltvClass}`}>{pctLTV(r.newLTVVal)}</div>
                <div className="key-card-label">Loan-to-Value (LTV)</div>
                <div className="key-card-explain">How much of your home's value you're borrowing &mdash; lower is better</div>
              </div>
            </div>
          </div>

          {/* 4 - DETAIL BREAKDOWN */}
          <div className="detail-section">
            <div className="refi-grid" style={{ gap: 32 }}>
              <div>
                <h3 className="results-heading" style={{ marginBottom: 16 }}>Your New Loan</h3>
                <div className="breakdown-row"><span>Paying off current loan</span><span className="val">{fmt(r.curBalVal)}</span></div>
                <div className="breakdown-row"><span>Cash-out to borrower</span><span className="val">{fmt(r.cashOutVal)}</span></div>
                <div className="breakdown-row"><span>Debt payoff</span><span className="val">{fmt(r.debtPayoffVal)}</span></div>
                <div className="breakdown-row"><span>Closing costs rolled in</span><span className="val">{fmt(financeCosts ? (r.closingVal + r.pointsVal) : 0)}</span></div>
                <div className="breakdown-row"><span>Funding / guarantee fee</span><span className="val">{fmt(r.fundingFee)}</span></div>
                <div className="breakdown-row total"><span>New Loan Amount</span><span className="val">{fmt(r.totalLoan)}</span></div>
              </div>

              <div>
                <h3 className="results-heading" style={{ marginBottom: 16 }}>Cost to Refinance</h3>
                <div className="breakdown-row"><span>Closing costs</span><span className="val">{fmt(r.closingVal)}</span></div>
                <div className="breakdown-row"><span>Discount points</span><span className="val">{fmt(r.pointsVal)}</span></div>
                <div className="breakdown-row"><span>Funding / guarantee fee</span><span className="val">{fmt(r.fundingFee)}</span></div>
                <div className="breakdown-row total"><span>Due at Closing</span><span className="val">{fmt(r.oop)}</span></div>
                {financeCosts && r.oop === 0 && (
                  <div className="oop-note"><i className="fa-solid fa-circle-info"></i> All costs rolled into loan &mdash; nothing due at closing</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ============================
            CARD: BORROWER NOTES
            ============================ */}
        <div className="floating-card" style={{ marginBottom: 0 }}>
          <h3 className="card-title"><i className="fa-solid fa-note-sticky"></i> Borrower Notes</h3>
          <textarea className="calc-input" value={borNotes} onChange={(e) => setBorNotes(e.target.value)} style={{ minHeight: 70, resize: "vertical" }} placeholder="Notes for borrower printout..." />
        </div>

        {/* ============================
            PRINT SUMMARY
            ============================ */}
        <div id="refi-print-summary" className="print-summary">
          <div className="print-header">
            <img className="print-logo" src="https://cdn.prod.website-files.com/694e4aaf5f511ad7901b74bc/69576dcb21edb9d479222c02_Logo_Horizontal_Blue.png" alt="mtg.broker" />
            <div className="print-doc-title">Refinance Analysis</div>
          </div>
          <div className="print-scenario-info" id="refi-printScenarioInfo"></div>
          <div className="print-body">
            <div>
              <div className="print-section-title">Current Loan</div>
              <table className="print-table" id="refi-printCurrentLoan"></table>
              <div className="print-section-title" style={{ marginTop: 12 }}>New Loan</div>
              <table className="print-table" id="refi-printNewLoan"></table>
            </div>
            <div>
              <div className="print-section-title">Comparison</div>
              <table className="print-table" id="refi-printComparison"></table>
              <div className="print-section-title" style={{ marginTop: 12 }}>Costs</div>
              <table className="print-table" id="refi-printCosts"></table>
            </div>
          </div>
          <div className="print-results-bar" id="refi-printResultsBar"></div>
          <div id="refi-printNotes"></div>
          <div className="print-footer">Generated from mtg.broker &mdash; <span id="refi-printDate"></span></div>
        </div>

      </div>{/* /calc-container */}
    </>
  );
}
