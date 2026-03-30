import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router";

export function meta() {
  return [{ title: "NEXA Broker Compensation Calculator — MtgBroker" }];
}

/* ================================================
   HELPERS
   ================================================ */

function formatCurrency(val) {
  if (Math.abs(val) < 0.01) val = 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

function parseRaw(val) {
  if (!val && val !== 0) return 0;
  return parseFloat(String(val).replace(/[$,]/g, "")) || 0;
}

/** Format a raw numeric string with commas for currency display */
function formatNumberString(val) {
  if (!val && val !== 0) return "";
  const clean = String(val).replace(/[^\d.\-]/g, "");
  if (!clean) return "";
  const isNegative = clean.startsWith("-");
  const abs = clean.replace("-", "");
  const parts = abs.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (isNegative ? "-" : "") + parts.join(".");
}

/** Evaluate BPS math expressions: "275-25" => 250 */
function parseBpsExpression(value) {
  if (!value || String(value).trim() === "") return 0;
  const expr = String(value).trim();
  if (/^-?\d+\.?\d*$/.test(expr)) return parseFloat(expr) || 0;
  if (/^[\d\s+\-*/.()]+$/.test(expr)) {
    try {
      const result = Function('"use strict"; return (' + expr + ")")();
      return isFinite(result) ? result : 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
  "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan",
  "Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada",
  "New Hampshire","New Jersey","New Mexico","New York","North Carolina",
  "North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island",
  "South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont",
  "Virginia","Washington","West Virginia","Wisconsin","Wyoming",
];

const LOAN_TYPES = [
  "Conventional","FHA","VA","USDA","Jumbo","Non-QM","DSCR","HELOC","2nd/HELOAN","Commercial","Other",
];

const STORAGE_KEY = "nexa_broker_comp";

/* ================================================
   MAIN COMPONENT
   ================================================ */

export default function NexaBrokerCompCalc() {

  /* --- Form state (all start blank) --- */
  const [loanAmount, setLoanAmount] = useState("");
  const [dateFunded, setDateFunded] = useState("");
  const [borrowerName, setBorrowerName] = useState("");
  const [loanId, setLoanId] = useState("");
  const [ficoScore, setFicoScore] = useState("");
  const [state, setState] = useState("");

  const [compType, setCompType] = useState("LPC");
  const [compPercent, setCompPercent] = useState("");
  const [compDollar, setCompDollar] = useState("");
  const [lender, setLender] = useState("");
  const [loanType, setLoanType] = useState("");
  const [employeeType, setEmployeeType] = useState("W2");

  const [ledgerBalance, setLedgerBalance] = useState("");
  const [wireFee, setWireFee] = useState("");
  const [divvyAmount, setDivvyAmount] = useState("");

  const [bdmBps, setBdmBps] = useState("");
  const [bdmTeamBps, setBdmTeamBps] = useState("");

  const [bucketTierBps, setBucketTierBps] = useState("");
  const [notes, setNotes] = useState("");

  /* --- Save/Load state --- */
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [savedScenarios, setSavedScenarios] = useState({});

  /* --- SSR fix: set date in useEffect --- */
  useEffect(() => {
    setDateFunded(new Date().toISOString().split("T")[0]);
  }, []);

  /* --- Comp % / $ linking --- */
  const handleCompPercentChange = useCallback((val) => {
    setCompPercent(val);
    const pct = parseFloat(val) || 0;
    const amt = parseRaw(loanAmount);
    if (pct > 0 && amt > 0) {
      const gross = Math.floor(amt * (pct / 100) * 100) / 100;
      setCompDollar(formatNumberString(gross.toFixed(2)));
    } else if (pct === 0 || val === "") {
      setCompDollar("");
    }
  }, [loanAmount]);

  const handleCompDollarChange = useCallback((val) => {
    setCompDollar(val);
    const dollar = parseRaw(val);
    const amt = parseRaw(loanAmount);
    if (dollar > 0 && amt > 0) {
      const pct = (dollar / amt) * 100;
      setCompPercent(pct.toFixed(4));
    } else if (dollar === 0 || val === "") {
      setCompPercent("");
    }
  }, [loanAmount]);

  /** Format currency fields on blur */
  const handleCurrencyBlur = useCallback((val, setter) => {
    setter(formatNumberString(val));
  }, []);

  /** Resolve BPS math expression on blur or Enter */
  const handleBpsBlur = useCallback((val, setter) => {
    if (!val || String(val).trim() === "") return;
    const raw = String(val).trim();
    if (/[+\-*/]/.test(raw) && !/^-?\d+\.?\d*$/.test(raw)) {
      const result = parseBpsExpression(raw);
      setter(String(result));
    }
  }, []);

  const handleBpsKeyDown = useCallback((e, val, setter) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleBpsBlur(val, setter);
      e.target.blur();
    }
  }, [handleBpsBlur]);

  /* --- Calculations --- */
  const calc = useMemo(() => {
    const amt = parseRaw(loanAmount);
    const compDollarVal = parseRaw(compDollar);
    const compPercentVal = parseFloat(compPercent) || 0;

    let grossComp = 0;
    if (compDollarVal > 0) {
      grossComp = compDollarVal;
    } else if (compPercentVal > 0 && amt > 0) {
      grossComp = Math.floor(amt * (compPercentVal / 100) * 100) / 100;
    }

    const bdmBpsVal = parseFloat(bdmBps) || 0;
    const bdmCompVal = amt * (bdmBpsVal / 10000);
    const bdmTeamBpsVal = parseFloat(bdmTeamBps) || 0;
    const bdmTeamCompVal = amt * (bdmTeamBpsVal / 10000);

    const ledger = parseRaw(ledgerBalance);
    const wire = parseRaw(wireFee);
    const divvy = employeeType === "W2" ? parseRaw(divvyAmount) : 0;

    // Ledger breakdown
    const nexaOp = amt * 0.0025;
    const balanceAfterNexaOp = grossComp - nexaOp;
    const nexaProfit = balanceAfterNexaOp * 0.12;

    let balance = grossComp;
    const balance1 = balance;
    balance -= nexaOp;
    const balance2 = balance;
    balance -= nexaProfit;
    const balance3 = balance;
    balance -= ledger;
    const balance4 = balance;
    balance -= wire;
    const balance5 = balance;
    const subtotal = balance;

    // LPC calculations
    const bucketBpsVal = parseBpsExpression(bucketTierBps);
    const maxAllowableComp = Math.floor(amt * (bucketBpsVal / 10000) * 100) / 100;
    const lpcSubjectToAdmin = maxAllowableComp - divvy - ledger - wire - bdmCompVal - bdmTeamCompVal;
    const is1099 = employeeType === "1099";
    const lpcAdminFee = is1099 ? 0 : lpcSubjectToAdmin * 0.12;
    const lpcCompToEveree = is1099 ? lpcSubjectToAdmin : lpcSubjectToAdmin - lpcAdminFee;
    const lpcExcess = subtotal - lpcAdminFee - lpcCompToEveree - divvy - bdmCompVal - bdmTeamCompVal;

    // BPC calculations
    const bpcSubjectToAdmin = subtotal - divvy - bdmCompVal - bdmTeamCompVal;
    const bpcAdminFee = is1099 ? 0 : bpcSubjectToAdmin * 0.12;
    const bpcCompToEveree = is1099 ? bpcSubjectToAdmin : bpcSubjectToAdmin - bpcAdminFee;
    const bpcExcess = subtotal - bpcAdminFee - bpcCompToEveree - divvy - bdmCompVal - bdmTeamCompVal;

    return {
      grossComp, bdmCompVal, bdmTeamCompVal,
      nexaOp, nexaProfit,
      balance1, balance2, balance3, balance4, balance5, subtotal,
      maxAllowableComp, lpcSubjectToAdmin, lpcAdminFee, lpcCompToEveree, lpcExcess,
      bpcSubjectToAdmin, bpcAdminFee, bpcCompToEveree, bpcExcess,
      amt, ledger: parseRaw(ledgerBalance), wire: parseRaw(wireFee), divvy,
    };
  }, [loanAmount, compDollar, compPercent, bdmBps, bdmTeamBps, ledgerBalance, wireFee, divvyAmount, employeeType, bucketTierBps]);

  const is1099 = employeeType === "1099";

  /* --- Save --- */
  const saveScenario = useCallback(() => {
    if (!loanId || !loanId.trim()) {
      alert("Please enter a Loan ID# before saving.");
      return;
    }
    const saveName = borrowerName.trim()
      ? loanId.trim() + " - " + borrowerName.trim()
      : loanId.trim();
    const lib = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    lib[saveName] = {
      timestamp: new Date().toLocaleString(),
      loanAmount, dateFunded, borrowerName, loanId, ficoScore, state,
      compType, compPercent, compDollar, lender, loanType, employeeType,
      ledgerBalance, wireFee, divvyAmount,
      bdmBps, bdmTeamBps, bucketTierBps, notes,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lib));
    alert("Scenario Saved!");
  }, [loanAmount, dateFunded, borrowerName, loanId, ficoScore, state, compType, compPercent, compDollar, lender, loanType, employeeType, ledgerBalance, wireFee, divvyAmount, bdmBps, bdmTeamBps, bucketTierBps, notes]);

  /* --- Load modal --- */
  const openLoadModal = useCallback(() => {
    const lib = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    setSavedScenarios(lib);
    setShowLoadModal(true);
  }, []);

  const loadItem = useCallback((key) => {
    const lib = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const d = lib[key];
    if (!d) return;
    if (d.loanAmount !== undefined) setLoanAmount(d.loanAmount);
    if (d.dateFunded !== undefined) setDateFunded(d.dateFunded);
    if (d.borrowerName !== undefined) setBorrowerName(d.borrowerName);
    if (d.loanId !== undefined) setLoanId(d.loanId);
    if (d.ficoScore !== undefined) setFicoScore(d.ficoScore);
    if (d.state !== undefined) setState(d.state);
    if (d.compType !== undefined) setCompType(d.compType);
    if (d.compPercent !== undefined) setCompPercent(d.compPercent);
    if (d.compDollar !== undefined) setCompDollar(d.compDollar);
    if (d.lender !== undefined) setLender(d.lender);
    if (d.loanType !== undefined) setLoanType(d.loanType);
    if (d.employeeType !== undefined) setEmployeeType(d.employeeType);
    if (d.ledgerBalance !== undefined) setLedgerBalance(d.ledgerBalance);
    if (d.wireFee !== undefined) setWireFee(d.wireFee);
    if (d.divvyAmount !== undefined) setDivvyAmount(d.divvyAmount);
    if (d.bdmBps !== undefined) setBdmBps(d.bdmBps);
    if (d.bdmTeamBps !== undefined) setBdmTeamBps(d.bdmTeamBps);
    if (d.bucketTierBps !== undefined) setBucketTierBps(d.bucketTierBps);
    if (d.notes !== undefined) setNotes(d.notes);
    setShowLoadModal(false);
  }, []);

  const deleteItem = useCallback((key) => {
    if (!confirm('Delete scenario "' + key + '"?')) return;
    const lib = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    delete lib[key];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lib));
    setSavedScenarios(lib);
  }, []);

  /* --- Clear All --- */
  const clearAll = useCallback(() => {
    if (!confirm("Clear all current values?")) return;
    setLoanAmount(""); setDateFunded(new Date().toISOString().split("T")[0]);
    setBorrowerName(""); setLoanId(""); setFicoScore(""); setState("");
    setCompType("LPC"); setCompPercent(""); setCompDollar("");
    setLender(""); setLoanType(""); setEmployeeType("W2");
    setLedgerBalance(""); setWireFee(""); setDivvyAmount("");
    setBdmBps(""); setBdmTeamBps(""); setBucketTierBps("");
    setNotes("");
  }, []);

  /* --- Print --- */
  const handlePrint = useCallback(() => { window.print(); }, []);

  /* --- Yellow highlight for empty fields --- */
  const emptyClass = (val) => (!String(val).trim() ? " field-empty" : "");

  const c = calc;

  return (
    <>
      {/* ================================================
          SCOPED CSS
          ================================================ */}
      <style>{`
        @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css');

        /* --- BREADCRUMB --- */
        .calc-breadcrumb { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; font-size: 14px; color: #64748B; }
        .calc-breadcrumb a { color: #2563EB; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
        .calc-breadcrumb a:hover { color: #1D4ED8; text-decoration: underline; }
        .calc-breadcrumb .bc-sep { color: #CBD5E1; }
        .calc-breadcrumb .bc-current { color: #0F172A; font-weight: 600; }

        /* --- CONTAINER --- */
        .calc-container { width: 100%; max-width: 1280px; margin: 0 auto; font-family: 'Host Grotesk', system-ui, -apple-system, sans-serif; color: #0f172a; box-sizing: border-box; }
        .calc-container * { box-sizing: border-box; }

        /* --- HEADER BAR (all 4 corners rounded) --- */
        .calc-header { background: #0F172A; padding: 16px 20px; border-radius: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; box-shadow: 0 4px 16px rgba(15,23,42,0.12); }
        .header-left { flex: 1 1 auto; min-width: 200px; }
        .calc-title { color: white; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
        .calc-subtitle { color: #94A3B8; margin: 4px 0 0 0; font-size: 13px; font-weight: 400; }
        .header-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .btn-group { display: flex; gap: 8px; }
        .action-btn { border: none; padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; color: white; transition: filter 0.2s, transform 0.1s; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; font-family: 'Host Grotesk', system-ui, sans-serif; }
        .action-btn:hover { filter: brightness(110%); }
        .action-btn:active { transform: translateY(1px); }
        .btn-print { background: #7C3AED; }
        .btn-save { background: #059669; }
        .btn-load { background: #2563EB; }
        .btn-clear { background: #DC2626; }

        /* --- FLOATING CARD --- */
        .floating-card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); transition: box-shadow 0.2s ease; }
        .floating-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.07); }
        .card-title { font-size: 14px; font-weight: 700; color: #0F172A; text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 20px 0; padding-bottom: 10px; border-bottom: 2px solid #E2E8F0; display: flex; align-items: center; gap: 8px; }
        .card-title i { color: #2563EB; font-size: 14px; }

        /* --- FLOATING CARD WITH DARK HEADER --- */
        .floating-card-dark { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); overflow: hidden; transition: box-shadow 0.2s ease; }
        .floating-card-dark:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.07); }
        .dark-card-header { background: #1E293B; padding: 15px 24px; font-size: 14px; font-weight: 700; color: white; text-transform: uppercase; letter-spacing: 0.04em; }
        .dark-card-body { padding: 24px; }

        /* --- INPUTS --- */
        .input-group { margin-bottom: 16px; }
        .input-group:last-child { margin-bottom: 0; }
        .input-group label { display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px; }
        .calc-input { width: 100%; padding: 10px 12px; border: 1px solid #CBD5E1; border-radius: 8px; font-size: 15px; font-family: 'Host Grotesk', system-ui, sans-serif; color: #0f172a; background: #FFFFFF; transition: border-color 0.2s, box-shadow 0.2s; }
        .calc-input:focus { outline: none; border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
        .calc-input::placeholder { color: #94A3B8; }
        .calc-input.field-empty { background-color: #FFFBEB; border-color: #FDE68A; }
        .calc-input-readonly { width: 100%; padding: 10px 12px; border: 1px solid #E2E8F0; border-radius: 8px; font-size: 15px; font-family: 'Host Grotesk', system-ui, sans-serif; background: #F1F5F9; color: #64748B; cursor: not-allowed; }
        .input-with-symbol { position: relative; }
        .symbol-right { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: #64748B; font-weight: 600; pointer-events: none; font-size: 15px; }
        .calc-hint { font-size: 12px; font-weight: 400; color: #94A3B8; }
        .note-text { font-size: 13px; color: #64748B; margin: 0; line-height: 1.5; }

        /* --- GRIDS --- */
        .grid-2-sections { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 0; }
        .grid-2-compact { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .grid-3-cols { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .grid-3-cols:last-child { margin-bottom: 0; }

        /* --- TOGGLE BUTTONS --- */
        .toggle-group-inline { display: flex; gap: 8px; }
        .toggle-btn { padding: 9px 20px; border: 2px solid #CBD5E1; background: white; color: #64748B; font-size: 14px; font-weight: 600; border-radius: 8px; cursor: pointer; transition: all 0.2s; font-family: 'Host Grotesk', system-ui, sans-serif; }
        .toggle-btn:hover { border-color: #94A3B8; }
        .toggle-btn.active { background: #1E293B; color: white; border-color: #1E293B; }

        /* --- COMP ROW 1 LAYOUT --- */
        .comp-row-1 { display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 12px; align-items: flex-end; margin-bottom: 16px; }
        .comp-inline { margin-bottom: 0 !important; }
        .or-text { color: #64748B; font-size: 14px; font-weight: 600; padding-bottom: 12px; white-space: nowrap; text-align: center; }

        /* --- COMP ROW 3 (W-2/1099 + Gross Comp) --- */
        .comp-row-3 { display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: center; margin-top: 16px; }

        /* --- RESULT DISPLAY (Gross Comp) --- */
        .result-display { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; }
        .result-label { font-size: 14px; font-weight: 600; color: #64748B; }
        .result-value { font-size: 20px; font-weight: 700; color: #0F172A; }

        /* --- PAYROLL ROW 1 LAYOUT --- */
        .payroll-row-1-updated { display: grid; grid-template-columns: auto 1fr; gap: 20px; align-items: flex-start; margin-bottom: 16px; }
        .payroll-button-groups { display: flex; flex-direction: column; gap: 10px; }
        .bucket-tier-wrapper { width: 100%; }
        .payroll-inline { margin-bottom: 0 !important; }

        /* --- BREAKDOWN ROWS (3-COLUMN: label | amount | balance) --- */
        .breakdown-header-triple { display: grid; grid-template-columns: 1fr auto auto; gap: 16px; padding: 14px 18px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; margin-bottom: 12px; font-size: 16px; font-weight: 700; color: #0F172A; align-items: center; }
        .breakdown-header-label { text-align: left; }
        .breakdown-header-amount { text-align: right; }
        .breakdown-header-blank { width: 100px; }
        .breakdown-columns-header { display: grid; grid-template-columns: 1fr auto auto; gap: 16px; padding: 10px 18px; font-size: 12px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #E2E8F0; margin-bottom: 8px; }
        .breakdown-columns-header span:nth-child(2), .breakdown-columns-header span:nth-child(3) { text-align: right; width: 100px; }
        .breakdown-row-triple { display: grid; grid-template-columns: 1fr auto auto; gap: 16px; padding: 10px 18px; font-size: 15px; color: #1E293B; align-items: center; }
        .breakdown-row-triple span:nth-child(2), .breakdown-row-triple span:nth-child(3) { text-align: right; width: 100px; }
        .breakdown-row-triple.deduction { color: #64748B; }
        .breakdown-total-triple { display: grid; grid-template-columns: 1fr auto auto; gap: 16px; padding: 14px 18px; margin-top: 12px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; font-size: 16px; font-weight: 700; color: #0F172A; align-items: center; }
        .breakdown-total-triple span:nth-child(2), .breakdown-total-triple span:nth-child(3) { text-align: right; width: 100px; }

        /* --- BREAKDOWN ROWS (2-COLUMN: label | amount) --- */
        .breakdown-row-simple { display: flex; justify-content: space-between; padding: 9px 0; font-size: 14px; color: #475569; }
        .breakdown-row-simple.deduction { color: #64748B; }
        .breakdown-row-simple.total-row { padding: 12px 0; margin-top: 8px; padding-top: 12px; border-top: 1px solid #E2E8F0; font-weight: 700; color: #0F172A; }

        /* --- FINAL RESULTS --- */
        .final-results { margin-top: 24px; padding-top: 20px; border-top: 2px solid #E2E8F0; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .final-result-item { text-align: center; padding: 20px; background: #F8FAFC; border: 2px solid #E2E8F0; border-radius: 12px; }
        .final-label { display: block; font-size: 12px; font-weight: 700; color: #64748B; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
        .final-value { display: block; font-size: 28px; font-weight: 800; color: #0F172A; }

        /* --- SUBSECTION --- */
        .subsection-box { background: #F8FAFC; border: 1px solid #E2E8F0; padding: 20px; border-radius: 10px; margin-top: 16px; }
        .subsection-box:first-of-type { margin-top: 0; }
        .subsection-header { font-size: 15px; font-weight: 700; color: #1E293B; margin: 0 0 12px 0; }

        /* --- NOTES TEXTAREA --- */
        .notes-textarea { min-height: 120px; resize: vertical; font-family: inherit; line-height: 1.5; }

        /* --- MODAL --- */
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; justify-content: center; align-items: center; }
        .modal-content { background: white; width: 440px; max-width: 92%; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-height: 80vh; display: flex; flex-direction: column; }
        .modal-header { background: #0F172A; color: white; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; }
        .modal-header h3 { margin: 0; font-size: 16px; font-weight: 700; }
        .close-modal { cursor: pointer; font-size: 22px; color: #94A3B8; transition: color 0.15s; background: none; border: none; }
        .close-modal:hover { color: white; }
        .modal-list { padding: 8px; max-height: 400px; overflow-y: auto; flex: 1; }
        .save-item { padding: 12px; border-bottom: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.15s; border-radius: 8px; }
        .save-item:hover { background: #F1F5F9; }
        .save-item:last-child { border-bottom: none; }
        .save-item-info { flex: 1; min-width: 0; }
        .save-item-name { font-size: 14px; font-weight: 600; color: #1E293B; }
        .save-item-date { font-size: 12px; color: #94A3B8; margin-top: 2px; }
        .delete-btn { color: #DC2626; font-size: 12px; font-weight: 600; cursor: pointer; padding: 6px 12px; border-radius: 6px; transition: background 0.15s; background: none; border: none; flex-shrink: 0; }
        .delete-btn:hover { background: #FEE2E2; }
        .empty-state { text-align: center; padding: 30px 16px; color: #94A3B8; font-size: 13px; }

        /* --- RESPONSIVE --- */
        @media (max-width: 900px) {
          .grid-2-sections { grid-template-columns: 1fr; }
          .calc-header { flex-direction: column; align-items: flex-start; }
          .header-left { width: 100%; margin-bottom: 8px; }
          .header-actions { width: 100%; justify-content: flex-start; }
          .final-results { grid-template-columns: 1fr; }
          .breakdown-row-triple, .breakdown-total-triple, .breakdown-header-triple, .breakdown-columns-header { grid-template-columns: 1fr; gap: 6px; }
          .breakdown-row-triple span, .breakdown-total-triple span, .breakdown-columns-header span { text-align: left !important; width: 100% !important; }
          .breakdown-row-triple span:first-child, .breakdown-total-triple span:first-child { font-weight: 600; }
          .breakdown-row-triple span:nth-child(2)::before { content: 'Amount: '; font-weight: 600; }
          .breakdown-row-triple span:nth-child(3)::before { content: 'Balance: '; font-weight: 600; }
          .breakdown-total-triple span:nth-child(2)::before { content: 'Amount: '; }
          .breakdown-total-triple span:nth-child(3)::before { content: 'Balance: '; }
          .payroll-row-1-updated { grid-template-columns: 1fr; gap: 16px; }
          .payroll-button-groups { align-items: center; }
          .comp-row-3 { grid-template-columns: 1fr; gap: 14px; }
          .toggle-group-inline { justify-content: center; }
        }
        @media (max-width: 768px) {
          .grid-3-cols { grid-template-columns: 1fr; }
          .comp-row-1 { grid-template-columns: 1fr; gap: 12px; }
          .or-text { padding: 0; text-align: center; }
          .calc-title { font-size: 18px; }
          .final-value { font-size: 24px; }
          .floating-card { padding: 20px 16px; border-radius: 12px; }
          .dark-card-body { padding: 20px 16px; }
        }
        @media (max-width: 600px) {
          .grid-2-compact { grid-template-columns: 1fr; }
          .header-actions { flex-direction: column; gap: 10px; }
          .btn-group { width: 100%; justify-content: space-between; gap: 6px; flex-wrap: wrap; }
          .action-btn { flex: 1 1 calc(50% - 4px); text-align: center; padding: 10px 6px; justify-content: center; font-size: 12px; }
          .floating-card { padding: 16px 14px; }
          .dark-card-body { padding: 16px 14px; }
          .result-display { flex-direction: column; gap: 6px; text-align: center; }
          .result-value { font-size: 20px; }
          .final-result-item { padding: 14px; }
          .final-label { font-size: 11px; }
          .final-value { font-size: 22px; }
          .breakdown-row-simple { font-size: 13px; flex-wrap: wrap; gap: 4px; }
          .breakdown-row-simple span:first-child { flex: 1 1 100%; }
          .notes-textarea { min-height: 100px; }
        }
        @media (max-width: 400px) {
          .action-btn { flex: 1 1 100%; }
          .toggle-btn { padding: 8px 14px; font-size: 13px; }
        }

        /* --- PRINT --- */
        @media print {
          .calc-header .header-actions, .modal-overlay { display: none !important; }
          .calc-container { width: 100% !important; max-width: none !important; margin: 0 !important; }
          .calc-breadcrumb { display: none !important; }
          .calc-header { background: #0F172A !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; border-radius: 8px !important; }
          .dark-card-header { background: #1E293B !important; color: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .toggle-btn.active { background: #1E293B !important; color: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .final-result-item { background: #F8FAFC !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .floating-card, .floating-card-dark, .subsection-box { page-break-inside: avoid; }
          .grid-2-sections { display: grid !important; grid-template-columns: 1fr 1fr !important; }
          nav, footer, header, aside, [class*="sidebar"], [class*="navbar"], [class*="footer"] {
            display: none !important;
          }
        }
      `}</style>

      <div className="calc-container">

        {/* ==================== BREADCRUMB ==================== */}
        <div className="calc-breadcrumb">
          <Link to="/app/calculators"><i className="fa-solid fa-arrow-left" style={{ fontSize: 12 }}></i> Calculators</Link>
          <span className="bc-sep">/</span>
          <span className="bc-current">NEXA Broker Compensation</span>
        </div>

        {/* ==================== HEADER BAR ==================== */}
        <div className="calc-header">
          <div className="header-left">
            <h1 className="calc-title">NEXA Broker Compensation Calculator</h1>
            <p className="calc-subtitle">Calculate broker compensation, admin fees, and payroll breakdown.</p>
          </div>
          <div className="header-actions">
            <div className="btn-group">
              <button onClick={handlePrint} className="action-btn btn-print"><i className="fa-solid fa-print"></i> Print</button>
              <button onClick={saveScenario} className="action-btn btn-save"><i className="fa-solid fa-cloud-arrow-up"></i> Save</button>
              <button onClick={openLoadModal} className="action-btn btn-load"><i className="fa-solid fa-folder-open"></i> Load</button>
              <button onClick={clearAll} className="action-btn btn-clear"><i className="fa-solid fa-rotate-left"></i> Clear</button>
            </div>
          </div>
        </div>

        {/* ==================== LOAD MODAL ==================== */}
        {showLoadModal && (
          <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowLoadModal(false); }}>
            <div className="modal-content">
              <div className="modal-header">
                <h3>Saved Scenarios</h3>
                <button className="close-modal" onClick={() => setShowLoadModal(false)}>&times;</button>
              </div>
              <div className="modal-list">
                {Object.keys(savedScenarios).length === 0 ? (
                  <p className="empty-state">No saved scenarios found.</p>
                ) : (
                  Object.keys(savedScenarios).map((key) => (
                    <div className="save-item" key={key}>
                      <div className="save-item-info" onClick={() => loadItem(key)}>
                        <div className="save-item-name">{key}</div>
                        <div className="save-item-date">{savedScenarios[key].timestamp || ""}</div>
                      </div>
                      <button className="delete-btn" onClick={(e) => { e.stopPropagation(); deleteItem(key); }}>Delete</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== ROW 1: LOAN DETAILS + COMP DETAILS ==================== */}
        <div className="grid-2-sections" style={{ marginBottom: 20 }}>

          {/* --- LOAN DETAILS --- */}
          <div className="floating-card">
            <div className="card-title"><i className="fa-solid fa-file-invoice-dollar"></i> Loan Details</div>
            <div className="grid-3-cols">
              <div className="input-group">
                <label>Loan Amount $</label>
                <input
                  type="text"
                  className={"calc-input" + emptyClass(loanAmount)}
                  value={loanAmount}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d.\-]/g, "");
                    setLoanAmount(raw);
                  }}
                  onBlur={() => handleCurrencyBlur(loanAmount, setLoanAmount)}
                  placeholder="0"
                />
              </div>
              <div className="input-group">
                <label>Date Loan Funded</label>
                <input
                  type="date"
                  className={"calc-input" + emptyClass(dateFunded)}
                  value={dateFunded}
                  onChange={(e) => setDateFunded(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label>Borrower Name</label>
                <input
                  type="text"
                  className={"calc-input" + emptyClass(borrowerName)}
                  value={borrowerName}
                  onChange={(e) => setBorrowerName(e.target.value)}
                  placeholder="Enter name"
                />
              </div>
            </div>
            <div className="grid-3-cols">
              <div className="input-group">
                <label>Loan ID#</label>
                <input
                  type="text"
                  className={"calc-input" + emptyClass(loanId)}
                  value={loanId}
                  onChange={(e) => setLoanId(e.target.value)}
                  placeholder="Enter ID"
                />
              </div>
              <div className="input-group">
                <label>FICO Score</label>
                <input
                  type="number"
                  className={"calc-input" + emptyClass(ficoScore)}
                  value={ficoScore}
                  onChange={(e) => setFicoScore(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="input-group">
                <label>State</label>
                <select
                  className={"calc-input" + emptyClass(state)}
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                >
                  <option value="">Select State</option>
                  {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* --- COMP DETAILS --- */}
          <div className="floating-card">
            <div className="card-title"><i className="fa-solid fa-calculator"></i> Comp Details</div>

            {/* Row 1: LPC/BPC toggle | Comp % | -or- | Comp $ */}
            <div className="comp-row-1">
              <div className="toggle-group-inline">
                <button className={"toggle-btn" + (compType === "LPC" ? " active" : "")} onClick={() => setCompType("LPC")}>LPC</button>
                <button className={"toggle-btn" + (compType === "BPC" ? " active" : "")} onClick={() => setCompType("BPC")}>BPC</button>
              </div>
              <div className="input-group comp-inline">
                <label>Comp %</label>
                <div className="input-with-symbol">
                  <input
                    type="number"
                    step="0.01"
                    className={"calc-input" + emptyClass(compPercent)}
                    value={compPercent}
                    onChange={(e) => handleCompPercentChange(e.target.value)}
                    placeholder="0"
                  />
                  <span className="symbol-right">%</span>
                </div>
              </div>
              <div className="or-text">-or-</div>
              <div className="input-group comp-inline">
                <label>Comp $</label>
                <input
                  type="text"
                  className={"calc-input" + emptyClass(compDollar)}
                  value={compDollar}
                  onChange={(e) => handleCompDollarChange(e.target.value.replace(/[^\d.\-]/g, ""))}
                  onBlur={() => handleCurrencyBlur(compDollar, setCompDollar)}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Row 2: Lender + Loan Type */}
            <div className="grid-2-compact" style={{ marginBottom: 0 }}>
              <div className="input-group">
                <label>Lender</label>
                <input
                  type="text"
                  className={"calc-input" + emptyClass(lender)}
                  value={lender}
                  onChange={(e) => setLender(e.target.value)}
                  placeholder="Enter lender"
                />
              </div>
              <div className="input-group">
                <label>Loan Type</label>
                <select
                  className={"calc-input" + emptyClass(loanType)}
                  value={loanType}
                  onChange={(e) => setLoanType(e.target.value)}
                >
                  <option value="">Select Loan Type</option>
                  {LOAN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Row 3: W-2/1099 toggle + Gross Comp */}
            <div className="comp-row-3">
              <div className="toggle-group-inline">
                <button className={"toggle-btn" + (employeeType === "W2" ? " active" : "")} onClick={() => setEmployeeType("W2")}>W-2</button>
                <button className={"toggle-btn" + (employeeType === "1099" ? " active" : "")} onClick={() => setEmployeeType("1099")}>1099</button>
              </div>
              <div className="result-display">
                <span className="result-label">Gross Comp</span>
                <span className="result-value">{formatCurrency(c.grossComp)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ==================== ROW 2: OTHER ADJUSTMENTS + BDM ==================== */}
        <div className="grid-2-sections" style={{ marginBottom: 20 }}>

          {/* --- OTHER ADJUSTMENTS --- */}
          <div className="floating-card">
            <div className="card-title"><i className="fa-solid fa-sliders"></i> Other Adjustments</div>
            <div className="input-group">
              <label>Ledger Balance Owed</label>
              <input
                type="text"
                className={"calc-input" + emptyClass(ledgerBalance)}
                value={ledgerBalance}
                onChange={(e) => setLedgerBalance(e.target.value.replace(/[^\d.\-]/g, ""))}
                onBlur={() => handleCurrencyBlur(ledgerBalance, setLedgerBalance)}
                placeholder="$0"
              />
            </div>
            <div className="input-group">
              <label>Wire Fee</label>
              <input
                type="text"
                className={"calc-input" + emptyClass(wireFee)}
                value={wireFee}
                onChange={(e) => setWireFee(e.target.value.replace(/[^\d.\-]/g, ""))}
                onBlur={() => handleCurrencyBlur(wireFee, setWireFee)}
                placeholder="$0"
              />
            </div>
            {/* Divvy: hidden when 1099 */}
            {!is1099 && (
              <div className="input-group">
                <label>Amount transferred to Divvy (If any)</label>
                <input
                  type="text"
                  className={"calc-input" + emptyClass(divvyAmount)}
                  value={divvyAmount}
                  onChange={(e) => setDivvyAmount(e.target.value.replace(/[^\d.\-]/g, ""))}
                  onBlur={() => handleCurrencyBlur(divvyAmount, setDivvyAmount)}
                  placeholder="$0"
                />
              </div>
            )}
          </div>

          {/* --- BDM CALCULATION --- */}
          <div className="floating-card">
            <div className="card-title"><i className="fa-solid fa-users"></i> BDM Calculation</div>
            <div className="grid-2-compact" style={{ marginBottom: 16 }}>
              <div className="input-group">
                <label>BDM bps</label>
                <input
                  type="number"
                  className={"calc-input" + emptyClass(bdmBps)}
                  value={bdmBps}
                  onChange={(e) => setBdmBps(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="input-group">
                <label>BDM Comp $</label>
                <input
                  type="text"
                  className="calc-input-readonly"
                  value={formatCurrency(c.bdmCompVal)}
                  readOnly
                />
              </div>
            </div>
            <div className="grid-2-compact">
              <div className="input-group">
                <label>BDM Team bps</label>
                <input
                  type="number"
                  className={"calc-input" + emptyClass(bdmTeamBps)}
                  value={bdmTeamBps}
                  onChange={(e) => setBdmTeamBps(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="input-group">
                <label>BDM Team Comp $</label>
                <input
                  type="text"
                  className="calc-input-readonly"
                  value={formatCurrency(c.bdmTeamCompVal)}
                  readOnly
                />
              </div>
            </div>
          </div>
        </div>

        {/* ==================== LEDGER BREAKDOWN ==================== */}
        <div className="floating-card-dark">
          <div className="dark-card-header">
            <i className="fa-solid fa-list-check" style={{ marginRight: 8 }}></i>
            Ledger Breakdown
          </div>
          <div className="dark-card-body">
            {/* Header row */}
            <div className="breakdown-header-triple">
              <span className="breakdown-header-label">LOAN AMOUNT:</span>
              <span className="breakdown-header-amount">{formatCurrency(c.amt)}</span>
              <span className="breakdown-header-blank"></span>
            </div>

            {/* Column headers */}
            <div className="breakdown-columns-header">
              <span></span>
              <span>Amount</span>
              <span>Balance</span>
            </div>

            {/* Rows */}
            <div className="breakdown-row-triple">
              <span>Broker Check</span>
              <span>{formatCurrency(c.grossComp)}</span>
              <span>{formatCurrency(c.balance1)}</span>
            </div>
            <div className="breakdown-row-triple deduction">
              <span>- NEXA Operational (25bps)</span>
              <span>{formatCurrency(-c.nexaOp)}</span>
              <span>{formatCurrency(c.balance2)}</span>
            </div>
            <div className="breakdown-row-triple deduction">
              <span>- NEXA Profit (12%)</span>
              <span>{formatCurrency(-c.nexaProfit)}</span>
              <span>{formatCurrency(c.balance3)}</span>
            </div>
            <div className="breakdown-row-triple deduction">
              <span>- Ledger Balance Owed</span>
              <span>{formatCurrency(-c.ledger)}</span>
              <span>{formatCurrency(c.balance4)}</span>
            </div>
            <div className="breakdown-row-triple deduction">
              <span>- Wire Fee</span>
              <span>{formatCurrency(-c.wire)}</span>
              <span>{formatCurrency(c.balance5)}</span>
            </div>

            {/* Subtotal */}
            <div className="breakdown-total-triple">
              <span>= Subtotal</span>
              <span>{formatCurrency(c.subtotal)}</span>
              <span>{formatCurrency(c.subtotal)}</span>
            </div>
          </div>
        </div>

        {/* ==================== PAYROLL AND EXCESS CALCULATIONS ==================== */}
        <div className="floating-card-dark">
          <div className="dark-card-header">
            <i className="fa-solid fa-money-check-dollar" style={{ marginRight: 8 }}></i>
            Payroll and Excess Calculations
          </div>
          <div className="dark-card-body">

            {/* Row 1: Toggle buttons + Bucket Tier BPS */}
            <div className="payroll-row-1-updated">
              <div className="payroll-button-groups">
                <div className="toggle-group-inline">
                  <button className={"toggle-btn" + (compType === "LPC" ? " active" : "")} onClick={() => setCompType("LPC")}>LPC</button>
                  <button className={"toggle-btn" + (compType === "BPC" ? " active" : "")} onClick={() => setCompType("BPC")}>BPC</button>
                </div>
                <div className="toggle-group-inline">
                  <button className={"toggle-btn" + (employeeType === "W2" ? " active" : "")} onClick={() => setEmployeeType("W2")}>W-2</button>
                  <button className={"toggle-btn" + (employeeType === "1099" ? " active" : "")} onClick={() => setEmployeeType("1099")}>1099</button>
                </div>
              </div>

              {/* Bucket Tier BPS: only shown for LPC */}
              {compType === "LPC" && (
                <div className="bucket-tier-wrapper">
                  <div className="input-group payroll-inline">
                    <label>Bucket Tier BPS <span className="calc-hint">(supports math: 275-25)</span></label>
                    <input
                      type="text"
                      className={"calc-input" + emptyClass(bucketTierBps)}
                      value={bucketTierBps}
                      onChange={(e) => setBucketTierBps(e.target.value)}
                      onBlur={() => handleBpsBlur(bucketTierBps, setBucketTierBps)}
                      onKeyDown={(e) => handleBpsKeyDown(e, bucketTierBps, setBucketTierBps)}
                      placeholder="e.g. 275 or 275-25"
                    />
                  </div>
                  <p className="note-text" style={{ marginTop: 6 }}>
                    Note: LPC is subject to bucket tiers in{" "}
                    <a href="https://www.loanofficersupport.com/my-ledger#:~:text=1-,Exhibit%20A" target="_blank" rel="noopener noreferrer" style={{ color: "#2563EB", textDecoration: "underline", fontWeight: 600 }}>Exhibit A</a>
                    {" "}of your comp agreement. Enter your tier BPS above. For Figure HELOC, use BPC. It is exempt from LPC bucket tier rules.
                  </p>
                </div>
              )}
            </div>

            {/* ===== LPC SECTION ===== */}
            {compType === "LPC" && (
              <>
                {/* Admin Fee Calculation */}
                <div className="subsection-box">
                  <h4 className="subsection-header">{is1099 ? "Net Comp Calculation" : "Admin Fee Calculation"}</h4>
                  <div className="breakdown-row-simple">
                    <span>Max Allowable Comp</span>
                    <span>{formatCurrency(c.maxAllowableComp)}</span>
                  </div>
                  <div className="breakdown-row-simple deduction">
                    <span>- Ledger Balance Owed</span>
                    <span>{formatCurrency(-c.ledger)}</span>
                  </div>
                  <div className="breakdown-row-simple deduction">
                    <span>- Wire Fee</span>
                    <span>{formatCurrency(-c.wire)}</span>
                  </div>
                  {/* Divvy: hidden for 1099 */}
                  {!is1099 && (
                    <div className="breakdown-row-simple deduction">
                      <span>- Amount to Divvy</span>
                      <span>{formatCurrency(-c.divvy)}</span>
                    </div>
                  )}
                  <div className="breakdown-row-simple deduction">
                    <span>- BDM Comp</span>
                    <span>{formatCurrency(-c.bdmCompVal)}</span>
                  </div>
                  <div className="breakdown-row-simple deduction">
                    <span>- BDM Team Comp</span>
                    <span>{formatCurrency(-c.bdmTeamCompVal)}</span>
                  </div>
                  <div className="breakdown-row-simple total-row">
                    <span>{is1099 ? "= Net Comp to Everee" : "= Subject to Admin Fee"}</span>
                    <span>{formatCurrency(c.lpcSubjectToAdmin)}</span>
                  </div>

                  {/* Admin fee lines: hidden for 1099 */}
                  {!is1099 && (
                    <>
                      <div className="breakdown-row-simple" style={{ marginTop: 4 }}>
                        <span>x 12% Matching Tax</span>
                        <span></span>
                      </div>
                      <div className="breakdown-row-simple total-row">
                        <span>= Admin Fee (Matching Taxes)</span>
                        <span>{formatCurrency(c.lpcAdminFee)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Net Comp Calculation: hidden for 1099 */}
                {!is1099 && (
                  <div className="subsection-box">
                    <h4 className="subsection-header">Net Comp Calculation</h4>
                    <div className="breakdown-row-simple" style={{ marginTop: 8 }}>
                      <span>Subject to Admin Fee</span>
                      <span>{formatCurrency(c.lpcSubjectToAdmin)}</span>
                    </div>
                    <div className="breakdown-row-simple deduction">
                      <span>- Admin Fee / Matching Tax (12%)</span>
                      <span>{formatCurrency(c.lpcAdminFee)}</span>
                    </div>
                    <div className="breakdown-row-simple total-row">
                      <span>= Comp to Everee</span>
                      <span>{formatCurrency(c.lpcCompToEveree)}</span>
                    </div>
                  </div>
                )}

                {/* Final results */}
                <div className="final-results">
                  <div className="final-result-item">
                    <span className="final-label">Comp to Everee</span>
                    <span className="final-value">{formatCurrency(c.lpcCompToEveree)}</span>
                  </div>
                  <div className="final-result-item">
                    <span className="final-label">Excess to Ledger</span>
                    <span className="final-value">{formatCurrency(c.lpcExcess)}</span>
                  </div>
                </div>
              </>
            )}

            {/* ===== BPC SECTION ===== */}
            {compType === "BPC" && (
              <>
                {/* Admin Fee Calculation */}
                <div className="subsection-box">
                  <h4 className="subsection-header">{is1099 ? "Net Comp Calculation" : "Admin Fee Calculation"}</h4>
                  <div className="breakdown-row-simple">
                    <span>Subtotal</span>
                    <span>{formatCurrency(c.subtotal)}</span>
                  </div>
                  <div className="breakdown-row-simple deduction">
                    <span>- Ledger Balance Owed</span>
                    <span>{formatCurrency(-c.ledger)}</span>
                  </div>
                  <div className="breakdown-row-simple deduction">
                    <span>- Wire Fee</span>
                    <span>{formatCurrency(-c.wire)}</span>
                  </div>
                  {/* Divvy: hidden for 1099 */}
                  {!is1099 && (
                    <div className="breakdown-row-simple deduction">
                      <span>- Amount to Divvy</span>
                      <span>{formatCurrency(-c.divvy)}</span>
                    </div>
                  )}
                  <div className="breakdown-row-simple deduction">
                    <span>- BDM Comp</span>
                    <span>{formatCurrency(-c.bdmCompVal)}</span>
                  </div>
                  <div className="breakdown-row-simple deduction">
                    <span>- BDM Team Comp</span>
                    <span>{formatCurrency(-c.bdmTeamCompVal)}</span>
                  </div>
                  <div className="breakdown-row-simple total-row">
                    <span>{is1099 ? "= Net Comp to Everee" : "= Subject to Admin Fee"}</span>
                    <span>{formatCurrency(c.bpcSubjectToAdmin)}</span>
                  </div>

                  {/* Admin fee lines: hidden for 1099 */}
                  {!is1099 && (
                    <>
                      <div className="breakdown-row-simple" style={{ marginTop: 4 }}>
                        <span>x 12% Matching Tax</span>
                        <span></span>
                      </div>
                      <div className="breakdown-row-simple total-row">
                        <span>= Admin Fee (Matching Taxes)</span>
                        <span>{formatCurrency(c.bpcAdminFee)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Net Comp Calculation: hidden for 1099 */}
                {!is1099 && (
                  <div className="subsection-box">
                    <h4 className="subsection-header">Net Comp Calculation</h4>
                    <div className="breakdown-row-simple" style={{ marginTop: 8 }}>
                      <span>Subject to Admin Fee</span>
                      <span>{formatCurrency(c.bpcSubjectToAdmin)}</span>
                    </div>
                    <div className="breakdown-row-simple deduction">
                      <span>- Admin Fee / Matching Tax (12%)</span>
                      <span>{formatCurrency(c.bpcAdminFee)}</span>
                    </div>
                    <div className="breakdown-row-simple total-row">
                      <span>= Comp to Everee</span>
                      <span>{formatCurrency(c.bpcCompToEveree)}</span>
                    </div>
                  </div>
                )}

                {/* Final results */}
                <div className="final-results">
                  <div className="final-result-item">
                    <span className="final-label">Comp to Everee</span>
                    <span className="final-value">{formatCurrency(c.bpcCompToEveree)}</span>
                  </div>
                  <div className="final-result-item">
                    <span className="final-label">Excess to Ledger</span>
                    <span className="final-value">{formatCurrency(c.bpcExcess)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ==================== NOTES ==================== */}
        <div className="floating-card">
          <div className="card-title"><i className="fa-solid fa-sticky-note"></i> Notes</div>
          <textarea
            className="calc-input notes-textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Enter any additional notes here..."
          />
        </div>

      </div>
    </>
  );
}
