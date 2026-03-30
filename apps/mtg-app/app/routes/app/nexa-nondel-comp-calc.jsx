import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router";

export function meta() {
  return [{ title: "NEXA NonDel Compensation Calculator — MtgBroker" }];
}

/* ================================================
   CONSTANTS
   ================================================ */
const STORAGE_KEY = "nexa_nondel_comp";

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
  "Conventional","FHA","VA","USDA","Jumbo","Non-QM","DSCR","HELOC",
  "2nd/HELOAN","Commercial","Other",
];

const LEAD_SOURCES = [
  "Self-generated Loans","Previous Clients","Internet","Exempt",
];

/* ================================================
   HELPERS
   ================================================ */
function formatCurrency(val) {
  if (Math.abs(val) < 0.01) val = 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(val);
}

function parseRaw(val) {
  if (!val && val !== 0) return 0;
  const v = String(val).replace(/[$,]/g, "");
  return parseFloat(v) || 0;
}

/** Live comma formatting for currency fields */
function formatNumberString(val) {
  if (!val) return "";
  const clean = String(val).replace(/[^\d.\-]/g, "");
  if (!clean) return "";
  const isNeg = clean.startsWith("-");
  const abs = clean.replace("-", "");
  const parts = abs.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (isNeg ? "-" : "") + parts.join(".");
}

/** Evaluate math expression in BPS field (e.g. "275-25") */
function parseBpsExpression(value) {
  if (!value || String(value).trim() === "") return 0;
  const expr = String(value).trim();
  if (/^-?\d+\.?\d*$/.test(expr)) return parseFloat(expr) || 0;
  if (/^[\d\s+\-*/().]+$/.test(expr)) {
    try {
      const result = Function('"use strict"; return (' + expr + ")")();
      return isFinite(result) ? result : 0;
    } catch { return 0; }
  }
  return 0;
}

function escapeHtml(s) {
  return s ? s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") : "";
}

/* Empty field yellow highlight helper */
const emptyClass = (val) => (!String(val).trim() ? " field-empty" : "");

/* ================================================
   MAIN COMPONENT
   ================================================ */
export default function NexaNonDelCompCalc() {

  /* --- Loan Details --- */
  const [loanAmount, setLoanAmount] = useState("");
  const [dateFunded, setDateFunded] = useState("");
  const [borrowerName, setBorrowerName] = useState("");
  const [loanId, setLoanId] = useState("");
  const [ficoScore, setFicoScore] = useState("");
  const [state, setState] = useState("");

  /* --- Comp Details --- */
  const [lender, setLender] = useState("");
  const [loanType, setLoanType] = useState("");
  const [leadSource, setLeadSource] = useState("");
  const [employeeType, setEmployeeType] = useState("W2");

  /* --- Other Adjustments --- */
  const [ledgerBalance, setLedgerBalance] = useState("");
  const [divvyAmount, setDivvyAmount] = useState("");

  /* --- BDM --- */
  const [bdmBps, setBdmBps] = useState("");
  const [bdmTeamBps, setBdmTeamBps] = useState("");

  /* --- Revenue fields --- */
  const [discountPointsPct, setDiscountPointsPct] = useState("");
  const [discountPointsDollar, setDiscountPointsDollar] = useState("");
  const [discountLastEdited, setDiscountLastEdited] = useState(null);

  const [originationFeePct, setOriginationFeePct] = useState("");
  const [originationFeeDollar, setOriginationFeeDollar] = useState("");
  const [originationLastEdited, setOriginationLastEdited] = useState(null);

  const [adminFeeCharged, setAdminFeeCharged] = useState("");

  const [srpPct, setSrpPct] = useState("");
  const [srpDollar, setSrpDollar] = useState("");
  const [srpLastEdited, setSrpLastEdited] = useState(null);

  const [mersFeeCharged, setMersFeeCharged] = useState("");
  const [floodCert, setFloodCert] = useState("");
  const [axenQuarterPoint, setAxenQuarterPoint] = useState("");
  const [axenHoldback, setAxenHoldback] = useState("");

  /* --- Reimbursements --- */
  const [creditReport, setCreditReport] = useState("");
  const [appraisalReimb, setAppraisalReimb] = useState("");
  const [otherReimb, setOtherReimb] = useState("");

  /* --- Credits and Charges --- */
  const [uwFeeToInvestor, setUwFeeToInvestor] = useState("");
  const [uwFeeOverageInput, setUwFeeOverageInput] = useState("");
  const [uwFeeLastEdited, setUwFeeLastEdited] = useState(null);

  const [taxServicePA, setTaxServicePA] = useState("");
  const [mersFeeDue, setMersFeeDue] = useState("");
  const [lenderCredits, setLenderCredits] = useState("");
  const [cureTolerance, setCureTolerance] = useState("");
  const [warehouseAssistFee, setWarehouseAssistFee] = useState("");

  /* --- Payroll --- */
  const [bucketTierBps, setBucketTierBps] = useState("");
  const [isNexa100, setIsNexa100] = useState(false);

  /* --- Notes --- */
  const [notes, setNotes] = useState("");

  /* --- Modal --- */
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [savedScenarios, setSavedScenarios] = useState({});

  /* --- SSR fix: set date in useEffect --- */
  useEffect(() => {
    setDateFunded(new Date().toISOString().split("T")[0]);
  }, []);

  /* ========================================
     DUAL FIELD SYNC LOGIC
     ======================================== */

  // When loan amount changes, resync all dual fields
  const loanAmountVal = parseRaw(loanAmount);

  const handleLoanAmountChange = useCallback((rawVal) => {
    setLoanAmount(rawVal);
    const la = parseRaw(rawVal);

    // Resync discount points
    setDiscountLastEdited((prev) => {
      if (prev === "pct") {
        // keep pct, recalc dollar from it — we'll read pct from current state
        return prev;
      }
      return prev;
    });
  }, []);

  // These effects handle the resync when loanAmount changes
  useEffect(() => {
    const la = parseRaw(loanAmount);
    if (discountLastEdited === "pct") {
      const pct = parseFloat(discountPointsPct) || 0;
      const dollar = la * (pct / 100);
      setDiscountPointsDollar(dollar > 0 ? formatNumberString(dollar.toFixed(2)) : "");
    } else if (discountLastEdited === "dollar") {
      const dollar = parseRaw(discountPointsDollar);
      const pct = la > 0 ? (dollar / la) * 100 : 0;
      setDiscountPointsPct(pct > 0 ? pct.toFixed(4) : "");
    }
  }, [loanAmount]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const la = parseRaw(loanAmount);
    if (originationLastEdited === "pct") {
      const pct = parseFloat(originationFeePct) || 0;
      const dollar = la * (pct / 100);
      setOriginationFeeDollar(dollar > 0 ? formatNumberString(dollar.toFixed(2)) : "");
    } else if (originationLastEdited === "dollar") {
      const dollar = parseRaw(originationFeeDollar);
      const pct = la > 0 ? (dollar / la) * 100 : 0;
      setOriginationFeePct(pct > 0 ? pct.toFixed(4) : "");
    }
  }, [loanAmount]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const la = parseRaw(loanAmount);
    if (srpLastEdited === "pct") {
      const pct = parseFloat(srpPct) || 0;
      const dollar = la * (pct / 100);
      setSrpDollar(dollar > 0 ? formatNumberString(dollar.toFixed(2)) : "");
    } else if (srpLastEdited === "dollar") {
      const dollar = parseRaw(srpDollar);
      const pct = la > 0 ? (dollar / la) * 100 : 0;
      setSrpPct(pct > 0 ? pct.toFixed(4) : "");
    }
  }, [loanAmount]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Discount points dual field handlers */
  const onDiscountPctInput = (val) => {
    setDiscountPointsPct(val);
    setDiscountLastEdited("pct");
    const la = parseRaw(loanAmount);
    const pctVal = parseFloat(val) || 0;
    const dollarVal = la * (pctVal / 100);
    setDiscountPointsDollar(dollarVal > 0 ? formatNumberString(dollarVal.toFixed(2)) : "");
  };
  const onDiscountDollarInput = (val) => {
    setDiscountPointsDollar(val);
    setDiscountLastEdited("dollar");
    const la = parseRaw(loanAmount);
    const dollarVal = parseRaw(val);
    const pctVal = la > 0 ? (dollarVal / la) * 100 : 0;
    setDiscountPointsPct(pctVal > 0 ? pctVal.toFixed(4) : "");
  };

  /* Origination fee dual field handlers */
  const onOriginationPctInput = (val) => {
    setOriginationFeePct(val);
    setOriginationLastEdited("pct");
    const la = parseRaw(loanAmount);
    const pctVal = parseFloat(val) || 0;
    const dollarVal = la * (pctVal / 100);
    setOriginationFeeDollar(dollarVal > 0 ? formatNumberString(dollarVal.toFixed(2)) : "");
  };
  const onOriginationDollarInput = (val) => {
    setOriginationFeeDollar(val);
    setOriginationLastEdited("dollar");
    const la = parseRaw(loanAmount);
    const dollarVal = parseRaw(val);
    const pctVal = la > 0 ? (dollarVal / la) * 100 : 0;
    setOriginationFeePct(pctVal > 0 ? pctVal.toFixed(4) : "");
  };

  /* SRP dual field handlers */
  const onSrpPctInput = (val) => {
    setSrpPct(val);
    setSrpLastEdited("pct");
    const la = parseRaw(loanAmount);
    const pctVal = parseFloat(val) || 0;
    const dollarVal = la * (pctVal / 100);
    setSrpDollar(dollarVal > 0 ? formatNumberString(dollarVal.toFixed(2)) : "");
  };
  const onSrpDollarInput = (val) => {
    setSrpDollar(val);
    setSrpLastEdited("dollar");
    const la = parseRaw(loanAmount);
    const dollarVal = parseRaw(val);
    const pctVal = la > 0 ? (dollarVal / la) * 100 : 0;
    setSrpPct(pctVal > 0 ? pctVal.toFixed(4) : "");
  };

  /* UW Fee linked fields: uwFeeToInvestor + uwFeeOverage = adminFeeCharged */
  const onUwFeeInvestorInput = (val) => {
    setUwFeeToInvestor(val);
    setUwFeeLastEdited("investor");
    const admin = parseRaw(adminFeeCharged);
    const investor = parseRaw(val);
    let overage = admin - investor;
    if (overage < 0) overage = 0;
    setUwFeeOverageInput(overage > 0 ? formatNumberString(overage.toFixed(2)) : "");
  };
  const onUwFeeOverageInputChange = (val) => {
    setUwFeeOverageInput(val);
    setUwFeeLastEdited("overage");
    const admin = parseRaw(adminFeeCharged);
    const overage = parseRaw(val);
    let investor = admin - overage;
    if (investor < 0) investor = 0;
    setUwFeeToInvestor(investor > 0 ? formatNumberString(investor.toFixed(2)) : "");
  };
  const onAdminFeeChargedChange = (val) => {
    setAdminFeeCharged(val);
    const admin = parseRaw(val);
    if (uwFeeLastEdited === "investor") {
      const investor = parseRaw(uwFeeToInvestor);
      let overage = admin - investor;
      if (overage < 0) overage = 0;
      setUwFeeOverageInput(overage > 0 ? formatNumberString(overage.toFixed(2)) : "");
    } else if (uwFeeLastEdited === "overage") {
      const overage = parseRaw(uwFeeOverageInput);
      let investor = admin - overage;
      if (investor < 0) investor = 0;
      setUwFeeToInvestor(investor > 0 ? formatNumberString(investor.toFixed(2)) : "");
    }
  };

  /* BPS field expression handler */
  const resolveBpsField = useCallback(() => {
    const raw = String(bucketTierBps).trim();
    if (!raw) return;
    if (/[+\-*/]/.test(raw) && !/^-?\d+\.?\d*$/.test(raw)) {
      const result = parseBpsExpression(raw);
      setBucketTierBps(String(result));
    }
  }, [bucketTierBps]);

  /* ========================================
     CALCULATIONS (matching v2.1 exactly)
     ======================================== */
  const calc = useMemo(() => {
    const la = parseRaw(loanAmount);
    const discPoints = parseRaw(discountPointsDollar);
    const origFee = parseRaw(originationFeeDollar);
    const adminFee = parseRaw(adminFeeCharged);
    const mersFee = parseRaw(mersFeeCharged);
    const flood = parseRaw(floodCert);
    const srp = parseRaw(srpDollar);
    const axenQP = parseRaw(axenQuarterPoint);
    const axenHB = parseRaw(axenHoldback);

    const totalRevenue = discPoints + origFee + adminFee + mersFee + flood + srp + axenQP + axenHB;

    const cr = parseRaw(creditReport);
    const appr = parseRaw(appraisalReimb);
    const other = parseRaw(otherReimb);
    const totalReimbursements = cr + appr + other;

    const uwInvestor = parseRaw(uwFeeToInvestor);
    let uwOverage = 0;
    const uwOverageRaw = parseRaw(uwFeeOverageInput);
    if (uwFeeLastEdited === "investor" || uwFeeLastEdited === "overage") {
      uwOverage = uwOverageRaw;
    } else {
      if (adminFee > uwInvestor && uwInvestor > 0) {
        uwOverage = adminFee - uwInvestor;
      }
    }

    const taxSvc = parseRaw(taxServicePA);
    const lendCred = parseRaw(lenderCredits);
    const mersDue = parseRaw(mersFeeDue);
    const cure = parseRaw(cureTolerance);
    const whAssist = parseRaw(warehouseAssistFee);

    // BDM
    const bdmBpsVal = parseFloat(bdmBps) || 0;
    const bdmCompValue = la * (bdmBpsVal / 10000);
    const bdmTeamBpsVal = parseFloat(bdmTeamBps) || 0;
    const bdmTeamCompValue = la * (bdmTeamBpsVal / 10000);

    // Ledger running balance
    let runBal = 0;
    runBal += discPoints;    const balPoints = runBal;
    runBal += origFee;       const balOrig = runBal;
    runBal += adminFee;      const balUwFee = runBal;
    runBal += srp;           const balSrp = runBal;
    runBal -= uwInvestor;    const balUwInvestor = runBal;
    runBal -= axenQP;        const balAxenQP = runBal;
    runBal -= lendCred;      const balLenderCredits = runBal;
    runBal -= whAssist;      const balWarehouseAssist = runBal;
    runBal -= mersDue;       const balMers = runBal;
    runBal -= uwOverage;     const balUwOverage = runBal;

    // Total Broker Check
    const totalBrokerCheck = discPoints + origFee + adminFee + srp
      - uwInvestor - axenQP - lendCred - whAssist - mersDue - uwOverage;

    // Post-broker-check
    const nexaOp = la * 0.0025;
    const afterNexaOp = totalBrokerCheck - nexaOp;
    const nexaProfit = afterNexaOp * 0.12;

    runBal -= nexaOp;        const balNexaOp = runBal;
    runBal -= nexaProfit;    const balNexaProfit = runBal;
    runBal += uwOverage;     const balUwOverageBack = runBal;

    const ledgerBal = parseRaw(ledgerBalance);
    runBal -= ledgerBal;     const balBalanceOwed = runBal;
    runBal -= taxSvc;        const balTaxService = runBal;
    runBal -= cure;          const balCure = runBal;

    // Subtotal
    const subtotal = totalBrokerCheck - nexaOp - nexaProfit + uwOverage - ledgerBal - taxSvc - cure;

    const nexa100Funds = isNexa100 ? (nexaOp + nexaProfit) : 0;

    // Payroll
    const is1099 = employeeType === "1099";
    const bucketBpsVal = parseBpsExpression(bucketTierBps);
    const maxAllowableComp = Math.floor((la * (bucketBpsVal / 10000)) * 100) / 100;
    const subjectToAdmin = maxAllowableComp - ledgerBal - cure;
    const adminFeeCalc = is1099 ? 0 : subjectToAdmin * 0.12;

    // Comp to Everee
    const rawOverage = subtotal - maxAllowableComp;
    let compToEveree = 0;
    let useOveragePath = false;

    if (subtotal >= maxAllowableComp && rawOverage >= adminFeeCalc) {
      useOveragePath = true;
      compToEveree = maxAllowableComp - cure - whAssist;
    } else {
      useOveragePath = false;
      compToEveree = is1099 ? subjectToAdmin : (subjectToAdmin - adminFeeCalc);
    }

    // Overage
    const netOverage = subtotal - adminFeeCalc - compToEveree - taxSvc;

    // Ledger overage
    const ledgerOverage = netOverage > 0 ? netOverage : 0;
    const ledgerNetSubtotal = subtotal - ledgerOverage;

    // No-overage note text
    let noOverageNote = "";
    if (!useOveragePath) {
      if (subtotal >= maxAllowableComp) {
        noOverageNote = "Subtotal exceeds Max Comp but overage cannot cover 100% of Admin Fee — Admin Fee is deducted from comp.";
      } else {
        noOverageNote = "Subtotal is below Max Comp — Admin Fee is deducted from comp.";
      }
    }

    return {
      totalRevenue, totalReimbursements,
      uwOverage, uwInvestor,
      bdmCompValue, bdmTeamCompValue,
      // Ledger amounts
      discPoints, origFee, adminFee, srp, axenQP, lendCred, whAssist, mersDue,
      // Running balances
      balPoints, balOrig, balUwFee, balSrp, balUwInvestor, balAxenQP,
      balLenderCredits, balWarehouseAssist, balMers, balUwOverage,
      totalBrokerCheck,
      nexaOp, nexaProfit,
      balNexaOp, balNexaProfit, balUwOverageBack,
      ledgerBal, balBalanceOwed, taxSvc, balTaxService, cure, balCure,
      subtotal, nexa100Funds,
      // Payroll
      maxAllowableComp, subjectToAdmin, adminFeeCalc,
      useOveragePath, compToEveree, netOverage,
      ledgerOverage, ledgerNetSubtotal, noOverageNote,
      is1099, la, cr, appr, other,
    };
  }, [
    loanAmount, discountPointsDollar, originationFeeDollar, adminFeeCharged,
    mersFeeCharged, floodCert, srpDollar, axenQuarterPoint, axenHoldback,
    creditReport, appraisalReimb, otherReimb,
    uwFeeToInvestor, uwFeeOverageInput, uwFeeLastEdited,
    taxServicePA, lenderCredits, mersFeeDue, cureTolerance, warehouseAssistFee,
    bdmBps, bdmTeamBps, ledgerBalance, employeeType, bucketTierBps, isNexa100,
  ]);

  /* ========================================
     SAVE / LOAD / CLEAR
     ======================================== */
  const collectFormData = useCallback(() => ({
    loanAmount, dateFunded, borrowerName, loanId, ficoScore, state,
    lender, loanType, leadSource, employeeType,
    ledgerBalance, divvyAmount,
    bdmBps, bdmTeamBps,
    discountPointsPct, discountPointsDollar, discountLastEdited,
    originationFeePct, originationFeeDollar, originationLastEdited,
    adminFeeCharged, srpPct, srpDollar, srpLastEdited,
    mersFeeCharged, floodCert, axenQuarterPoint, axenHoldback,
    creditReport, appraisalReimb, otherReimb,
    uwFeeToInvestor, uwFeeOverageInput, uwFeeLastEdited,
    taxServicePA, mersFeeDue, lenderCredits, cureTolerance, warehouseAssistFee,
    bucketTierBps, isNexa100, notes,
    timestamp: new Date().toLocaleString(),
  }), [
    loanAmount, dateFunded, borrowerName, loanId, ficoScore, state,
    lender, loanType, leadSource, employeeType,
    ledgerBalance, divvyAmount, bdmBps, bdmTeamBps,
    discountPointsPct, discountPointsDollar, discountLastEdited,
    originationFeePct, originationFeeDollar, originationLastEdited,
    adminFeeCharged, srpPct, srpDollar, srpLastEdited,
    mersFeeCharged, floodCert, axenQuarterPoint, axenHoldback,
    creditReport, appraisalReimb, otherReimb,
    uwFeeToInvestor, uwFeeOverageInput, uwFeeLastEdited,
    taxServicePA, mersFeeDue, lenderCredits, cureTolerance, warehouseAssistFee,
    bucketTierBps, isNexa100, notes,
  ]);

  const saveScenario = useCallback(() => {
    let defaultName = "";
    if (borrowerName && loanId) defaultName = borrowerName + " (" + loanId + ")";
    else if (borrowerName) defaultName = borrowerName;
    else if (loanId) defaultName = loanId;
    const saveName = prompt("Scenario Name:", defaultName);
    if (!saveName) return;
    const lib = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    lib[saveName] = collectFormData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lib));
    alert("Scenario Saved!");
  }, [borrowerName, loanId, collectFormData]);

  const loadFromBrowser = useCallback(() => {
    const lib = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    setSavedScenarios(lib);
    setShowLoadModal(true);
  }, []);

  const populateForm = useCallback((data) => {
    if (!data) return;
    if (data.loanAmount !== undefined) setLoanAmount(data.loanAmount);
    if (data.dateFunded !== undefined) setDateFunded(data.dateFunded);
    if (data.borrowerName !== undefined) setBorrowerName(data.borrowerName);
    if (data.loanId !== undefined) setLoanId(data.loanId);
    if (data.ficoScore !== undefined) setFicoScore(data.ficoScore);
    if (data.state !== undefined) setState(data.state);
    if (data.lender !== undefined) setLender(data.lender);
    if (data.loanType !== undefined) setLoanType(data.loanType);
    if (data.leadSource !== undefined) setLeadSource(data.leadSource);
    if (data.employeeType !== undefined) setEmployeeType(data.employeeType);
    if (data.ledgerBalance !== undefined) setLedgerBalance(data.ledgerBalance);
    if (data.divvyAmount !== undefined) setDivvyAmount(data.divvyAmount);
    if (data.bdmBps !== undefined) setBdmBps(data.bdmBps);
    if (data.bdmTeamBps !== undefined) setBdmTeamBps(data.bdmTeamBps);
    if (data.discountPointsPct !== undefined) setDiscountPointsPct(data.discountPointsPct);
    if (data.discountPointsDollar !== undefined) setDiscountPointsDollar(data.discountPointsDollar);
    if (data.discountLastEdited !== undefined) setDiscountLastEdited(data.discountLastEdited);
    if (data.originationFeePct !== undefined) setOriginationFeePct(data.originationFeePct);
    if (data.originationFeeDollar !== undefined) setOriginationFeeDollar(data.originationFeeDollar);
    if (data.originationLastEdited !== undefined) setOriginationLastEdited(data.originationLastEdited);
    if (data.adminFeeCharged !== undefined) setAdminFeeCharged(data.adminFeeCharged);
    if (data.srpPct !== undefined) setSrpPct(data.srpPct);
    if (data.srpDollar !== undefined) setSrpDollar(data.srpDollar);
    if (data.srpLastEdited !== undefined) setSrpLastEdited(data.srpLastEdited);
    if (data.mersFeeCharged !== undefined) setMersFeeCharged(data.mersFeeCharged);
    if (data.floodCert !== undefined) setFloodCert(data.floodCert);
    if (data.axenQuarterPoint !== undefined) setAxenQuarterPoint(data.axenQuarterPoint);
    if (data.axenHoldback !== undefined) setAxenHoldback(data.axenHoldback);
    if (data.creditReport !== undefined) setCreditReport(data.creditReport);
    if (data.appraisalReimb !== undefined) setAppraisalReimb(data.appraisalReimb);
    if (data.otherReimb !== undefined) setOtherReimb(data.otherReimb);
    if (data.uwFeeToInvestor !== undefined) setUwFeeToInvestor(data.uwFeeToInvestor);
    if (data.uwFeeOverageInput !== undefined) setUwFeeOverageInput(data.uwFeeOverageInput);
    if (data.uwFeeLastEdited !== undefined) setUwFeeLastEdited(data.uwFeeLastEdited);
    if (data.taxServicePA !== undefined) setTaxServicePA(data.taxServicePA);
    if (data.mersFeeDue !== undefined) setMersFeeDue(data.mersFeeDue);
    if (data.lenderCredits !== undefined) setLenderCredits(data.lenderCredits);
    if (data.cureTolerance !== undefined) setCureTolerance(data.cureTolerance);
    if (data.warehouseAssistFee !== undefined) setWarehouseAssistFee(data.warehouseAssistFee);
    if (data.bucketTierBps !== undefined) setBucketTierBps(data.bucketTierBps);
    if (data.isNexa100 !== undefined) setIsNexa100(data.isNexa100);
    if (data.notes !== undefined) setNotes(data.notes);
  }, []);

  const loadItem = useCallback((key) => {
    const lib = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const data = lib[key];
    if (data) {
      populateForm(data);
      setShowLoadModal(false);
    }
  }, [populateForm]);

  const deleteItem = useCallback((key) => {
    if (!confirm('Delete scenario "' + key + '"?')) return;
    const lib = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    delete lib[key];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lib));
    setSavedScenarios({ ...lib });
  }, []);

  const clearAll = useCallback(() => {
    if (!confirm("Clear all current values?")) return;
    setLoanAmount(""); setBorrowerName(""); setLoanId(""); setFicoScore("");
    setState(""); setLender(""); setLoanType(""); setLeadSource("");
    setEmployeeType("W2"); setLedgerBalance(""); setDivvyAmount("");
    setBdmBps(""); setBdmTeamBps("");
    setDiscountPointsPct(""); setDiscountPointsDollar(""); setDiscountLastEdited(null);
    setOriginationFeePct(""); setOriginationFeeDollar(""); setOriginationLastEdited(null);
    setAdminFeeCharged(""); setSrpPct(""); setSrpDollar(""); setSrpLastEdited(null);
    setMersFeeCharged(""); setFloodCert(""); setAxenQuarterPoint(""); setAxenHoldback("");
    setCreditReport(""); setAppraisalReimb(""); setOtherReimb("");
    setUwFeeToInvestor(""); setUwFeeOverageInput(""); setUwFeeLastEdited(null);
    setTaxServicePA(""); setMersFeeDue(""); setLenderCredits("");
    setCureTolerance(""); setWarehouseAssistFee("");
    setBucketTierBps(""); setIsNexa100(false); setNotes("");
    setDateFunded(new Date().toISOString().split("T")[0]);
  }, []);

  /* ========================================
     PRINT (new window approach)
     ======================================== */
  const printToPDF = useCallback(() => {
    const fc = formatCurrency;
    const c = calc;
    const pdfBorrower = borrowerName || "\u2014";
    const pdfLoanId = loanId || "\u2014";
    const pdfLoanAmt = fc(c.la);
    const pdfDate = dateFunded || "\u2014";
    const pdfLender = lender || "\u2014";
    const pdfLoanType = loanType || "\u2014";
    const pdfState = state || "\u2014";
    const pdfFico = ficoScore || "\u2014";
    const pdfLeadSource = leadSource || "\u2014";
    const pdfTaxDesig = employeeType;
    const pdfBucketBps = bucketTierBps || "\u2014";
    const pdfMaxComp = fc(c.maxAllowableComp);

    // Revenue items
    const revChecks = [
      ["Loan Amount Points", c.discPoints],
      ["Origination Fee", c.origFee],
      ["Admin Fee Charged", c.adminFee],
      ["SRP", parseRaw(srpDollar)],
      ["MERS Fee Charged", parseRaw(mersFeeCharged)],
      ["Flood Cert", parseRaw(floodCert)],
      ["AXEN Quarter Point", c.axenQP],
      ["AXEN Holdback", parseRaw(axenHoldback)],
    ];
    let revHtml = "";
    revChecks.forEach(([label, val]) => {
      if (val !== 0) revHtml += "<tr><td>" + escapeHtml(label) + '</td><td class="amt">' + fc(val) + "</td></tr>";
    });

    // Reimbursement items
    const reimbChecks = [["Credit Report", c.cr], ["Appraisal", c.appr], ["Other", c.other]];
    let reimbHtml = "";
    reimbChecks.forEach(([label, val]) => {
      if (val !== 0) reimbHtml += "<tr><td>" + escapeHtml(label) + '</td><td class="amt">' + fc(val) + "</td></tr>";
    });

    // Credits & Charges
    const ccChecks = [
      ["UW Fee to Investor", c.uwInvestor], ["UW Fee Overage", c.uwOverage],
      ["Cure/Tolerance", c.cure], ["Tax Service PA", c.taxSvc],
      ["MERS Fee Due", parseRaw(mersFeeDue)], ["Lender Credit(s)", c.lendCred],
      ["Warehouse Assist Fee", parseRaw(warehouseAssistFee)],
    ];
    let ccHtml = "";
    ccChecks.forEach(([label, val]) => {
      if (val !== 0) ccHtml += "<tr><td>" + escapeHtml(label) + '</td><td class="amt">' + fc(val) + "</td></tr>";
    });

    // Ledger rows
    const ledgerRows = [
      ["+", "Section A (Points)", c.discPoints, c.balPoints],
      ["+", "Section A (Origination)", c.origFee, c.balOrig],
      ["+", "Section A (UW Fee)", c.adminFee, c.balUwFee],
      ["+", "Section A (SRP)", parseRaw(srpDollar), c.balSrp],
      ["\u2212", "UW Fee to Investor", c.uwInvestor, c.balUwInvestor],
      ["\u2212", "AXEN Quarter Point", c.axenQP, c.balAxenQP],
      ["\u2212", "Lender Credit(s)", c.lendCred, c.balLenderCredits],
      ["\u2212", "Warehouse Assist Fee", parseRaw(warehouseAssistFee), c.balWarehouseAssist],
      ["\u2212", "MERS Fee", parseRaw(mersFeeDue), c.balMers],
      ["\u2212", "UW Fee Overage", c.uwOverage, c.balUwOverage],
    ];
    let ledgerHtml = "";
    ledgerRows.forEach(([sign, label, amt, bal]) => {
      if (amt !== 0) ledgerHtml += '<tr><td class="sign">' + sign + "</td><td>" + escapeHtml(label) + '</td><td class="amt">' + fc(amt) + '</td><td class="amt">' + fc(bal) + "</td></tr>";
    });

    const postRows = [
      ["\u2212", "NEXA Op Cost (25bps)", c.nexaOp, c.balNexaOp],
      ["\u2212", "NEXA/AXEN Profit (12%)", c.nexaProfit, c.balNexaProfit],
      ["+", "UW Overage Back", c.uwOverage, c.balUwOverageBack],
      ["\u2212", "Ledger Balance Owed", c.ledgerBal, c.balBalanceOwed],
      ["\u2212", "Tax Service PA", c.taxSvc, c.balTaxService],
      ["\u2212", "Cure/Tolerance", c.cure, c.balCure],
    ];
    let postHtml = "";
    postRows.forEach(([sign, label, amt, bal]) => {
      if (amt !== 0) postHtml += '<tr><td class="sign">' + sign + "</td><td>" + escapeHtml(label) + '</td><td class="amt">' + fc(amt) + '</td><td class="amt">' + fc(bal) + "</td></tr>";
    });

    let pdfName = "";
    if (pdfBorrower !== "\u2014" && pdfLoanId !== "\u2014") pdfName = pdfBorrower + " (" + pdfLoanId + ")";
    else if (pdfBorrower !== "\u2014") pdfName = pdfBorrower;
    else if (pdfLoanId !== "\u2014") pdfName = pdfLoanId;
    else pdfName = "NonDel Comp Summary";

    let html = '<!DOCTYPE html><html><head><title>' + escapeHtml(pdfName) + '</title><style>';
    html += '@page { size: portrait; margin: 0.4in 0.5in; }';
    html += "body { font-family: 'Host Grotesk', system-ui, -apple-system, sans-serif; font-size: 10px; color: #1a1a1a; margin: 0; padding: 0; line-height: 1.4; }";
    html += '.hdr { background: #0F172A; color: white; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; }';
    html += '.hdr h1 { font-size: 14px; margin: 0; font-weight: 700; }';
    html += '.hdr .date { font-size: 9px; color: #94A3B8; }';
    html += '.info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 2px 12px; padding: 8px 0; border-bottom: 1.5px solid #cbd5e1; margin-bottom: 6px; }';
    html += '.info-grid dt { font-size: 8px; color: #64748B; text-transform: uppercase; font-weight: 700; letter-spacing: 0.04em; margin: 0; }';
    html += '.info-grid dd { font-size: 10px; font-weight: 600; margin: 0 0 4px 0; color: #0F172A; }';
    html += '.cols-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 6px; }';
    html += '.sec { margin-bottom: 6px; }';
    html += '.sec-title { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #475569; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 3px; margin: 0 0 4px 0; letter-spacing: 0.04em; }';
    html += 'table { width: 100%; border-collapse: collapse; font-size: 10px; }';
    html += 'td { padding: 1.5px 0; }';
    html += 'td.amt { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }';
    html += 'td.sign { width: 12px; text-align: center; font-weight: 700; color: #64748B; }';
    html += '.total-row { border-top: 1.5px solid #1E293B; font-weight: 700; }';
    html += '.total-row td { padding-top: 4px; }';
    html += '.subtotal-row { border-top: 1px solid #cbd5e1; }';
    html += '.subtotal-row td { padding-top: 3px; font-weight: 700; }';
    html += '.results { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 8px; }';
    html += '.results-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; margin-top: 8px; }';
    html += '.result-box { border: 1.5px solid #1E293B; border-radius: 4px; padding: 6px 8px; text-align: center; }';
    html += '.result-box .lbl { font-size: 8px; text-transform: uppercase; color: #475569; font-weight: 700; letter-spacing: 0.04em; }';
    html += '.result-box .val { font-size: 16px; font-weight: 800; color: #0F172A; }';
    html += '.notes-sec { margin-top: 6px; padding: 4px 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 3px; font-size: 9px; color: #475569; }';
    html += '.notes-sec strong { color: #1E293B; }';
    html += '</style></head><body>';

    html += '<div class="hdr"><h1>NEXA NonDel Compensation Summary</h1><span class="date">Printed: ' + new Date().toLocaleDateString() + '</span></div>';
    html += '<div class="info-grid">';
    html += '<dt>Borrower</dt><dd>' + escapeHtml(pdfBorrower) + '</dd>';
    html += '<dt>Loan ID</dt><dd>' + escapeHtml(pdfLoanId) + '</dd>';
    html += '<dt>Loan Amount</dt><dd>' + pdfLoanAmt + '</dd>';
    html += '<dt>Date Funded</dt><dd>' + escapeHtml(pdfDate) + '</dd>';
    html += '<dt>Lender</dt><dd>' + escapeHtml(pdfLender) + '</dd>';
    html += '<dt>Loan Type</dt><dd>' + escapeHtml(pdfLoanType) + '</dd>';
    html += '<dt>State</dt><dd>' + escapeHtml(pdfState) + '</dd>';
    html += '<dt>FICO</dt><dd>' + escapeHtml(pdfFico) + '</dd>';
    html += '<dt>Lead Source</dt><dd>' + escapeHtml(pdfLeadSource) + '</dd>';
    html += '<dt>Tax Designation</dt><dd>' + escapeHtml(pdfTaxDesig) + '</dd>';
    html += '<dt>Bucket Tier BPS</dt><dd>' + escapeHtml(pdfBucketBps) + '</dd>';
    html += '<dt>Max Allowable Comp</dt><dd>' + pdfMaxComp + '</dd>';
    html += '</div>';

    // 3-col: Revenue + Reimbursements + Credits
    html += '<div class="cols-3">';
    html += '<div class="sec"><div class="sec-title">Revenue</div><table>';
    html += revHtml;
    html += '<tr class="total-row"><td>Total Revenue</td><td class="amt">' + fc(c.totalRevenue) + '</td></tr>';
    html += '</table></div>';
    html += '<div class="sec"><div class="sec-title">Reimbursements</div><table>';
    if (reimbHtml) {
      html += reimbHtml;
      html += '<tr class="total-row"><td>Total</td><td class="amt">' + fc(c.totalReimbursements) + '</td></tr>';
    } else {
      html += '<tr><td colspan="2" style="color:#94A3B8; font-style:italic;">None</td></tr>';
    }
    html += '</table></div>';
    html += '<div class="sec"><div class="sec-title">Credits &amp; Charges</div><table>';
    html += ccHtml || '<tr><td colspan="2" style="color:#94A3B8; font-style:italic;">None</td></tr>';
    html += '</table></div></div>';

    // Ledger Breakdown
    html += '<div class="sec"><div class="sec-title">Ledger Breakdown &nbsp;&nbsp;<span style="font-weight:400; text-transform:none; color:#64748B;">Loan Amount: ' + pdfLoanAmt + '</span></div>';
    html += '<table>';
    html += '<tr style="font-size:8px; color:#64748B; text-transform:uppercase; letter-spacing:0.04em;"><td></td><td></td><td class="amt">Amount</td><td class="amt">Balance</td></tr>';
    html += ledgerHtml;
    html += '<tr class="subtotal-row"><td></td><td>Total Broker Check</td><td class="amt">' + fc(c.totalBrokerCheck) + '</td><td></td></tr>';
    html += postHtml;
    html += '<tr class="total-row"><td></td><td>Subtotal</td><td class="amt">' + fc(c.subtotal) + '</td><td></td></tr>';
    if (c.ledgerOverage > 0) {
      html += '<tr><td class="sign">\u2212</td><td>Overage (Sent to Operational Ledger)</td><td class="amt">' + fc(c.ledgerOverage) + '</td><td></td></tr>';
    }
    html += '</table>';
    html += '<div class="results" style="margin-top:6px;">';
    html += '<div class="result-box"><div class="lbl">Net Subtotal</div><div class="val">' + fc(c.ledgerNetSubtotal) + '</div></div>';
    html += '<div class="result-box"><div class="lbl">Admin Fee</div><div class="val">' + fc(c.adminFeeCalc) + '</div></div>';
    html += '<div class="result-box"><div class="lbl">Comp to Everee</div><div class="val">' + fc(c.compToEveree) + '</div></div>';
    html += '</div></div>';

    // Payroll summary
    html += '<div class="sec"><div class="sec-title">Payroll Summary</div><table>';
    html += '<tr><td>Admin Fee (12% Matching Tax)</td><td class="amt">' + fc(c.adminFeeCalc) + '</td></tr>';
    if (c.bdmCompValue !== 0) html += '<tr><td>BDM Comp</td><td class="amt">' + fc(c.bdmCompValue) + '</td></tr>';
    if (c.bdmTeamCompValue !== 0) html += '<tr><td>BDM Team Comp</td><td class="amt">' + fc(c.bdmTeamCompValue) + '</td></tr>';
    const divvy = parseRaw(divvyAmount);
    if (divvy > 0) html += '<tr><td>Amount to Divvy</td><td class="amt">' + fc(divvy) + '</td></tr>';
    html += '</table></div>';

    // Final 4 results
    html += '<div class="results-4">';
    html += '<div class="result-box"><div class="lbl">Comp to Everee</div><div class="val">' + fc(c.compToEveree) + '</div></div>';
    html += '<div class="result-box"><div class="lbl">Remaining Balance (Overage)</div><div class="val">' + fc(c.netOverage) + '</div></div>';
    html += '<div class="result-box"><div class="lbl">NEXA \uD83D\uDCAF Funds' + (isNexa100 ? "" : " (Off)") + '</div><div class="val">' + fc(c.nexa100Funds) + '</div></div>';
    html += '<div class="result-box"><div class="lbl">Total Reimbursements</div><div class="val">' + fc(c.totalReimbursements) + '</div></div>';
    html += '</div>';

    if (notes && notes.trim()) {
      html += '<div class="notes-sec"><strong>Notes:</strong> ' + escapeHtml(notes).replace(/\n/g, "<br>") + '</div>';
    }
    html += '</body></html>';

    const w = window.open("", "_blank", "width=800,height=1000");
    w.document.write(html);
    w.document.close();
    w.focus();
    w.onafterprint = function () { w.close(); };
    setTimeout(function () { w.print(); }, 300);
  }, [calc, borrowerName, loanId, dateFunded, lender, loanType, state, ficoScore,
      leadSource, employeeType, bucketTierBps, srpDollar, mersFeeCharged, floodCert,
      axenHoldback, mersFeeDue, warehouseAssistFee, divvyAmount, isNexa100, notes]);

  /* ========================================
     RENDER
     ======================================== */
  const c = calc;

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
        .btn-save { background: #059669; }
        .btn-load { background: #2563EB; }
        .btn-print { background: #7C3AED; }
        .btn-clear { background: #DC2626; }

        .floating-card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); transition: box-shadow 0.2s ease; }
        .floating-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.07); }
        .card-title { font-size: 14px; font-weight: 700; color: #0F172A; text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 20px 0; padding-bottom: 10px; border-bottom: 2px solid #E2E8F0; display: flex; align-items: center; gap: 8px; }
        .card-title i { color: #2563EB; font-size: 14px; }

        .section-header-dark { font-size: 14px; font-weight: 700; color: white; background: #1E293B; margin: -24px -24px 20px -24px; padding: 14px 24px; border-radius: 16px 16px 0 0; text-transform: uppercase; letter-spacing: 0.04em; }

        .input-group { margin-bottom: 16px; }
        .input-group:last-child { margin-bottom: 0; }
        .input-group label { display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px; }
        .calc-input { width: 100%; padding: 10px 12px; border: 1px solid #CBD5E1; border-radius: 8px; font-size: 15px; font-family: 'Host Grotesk', system-ui, sans-serif; color: #0f172a; background: #FFFFFF; transition: border-color 0.2s, box-shadow 0.2s; }
        .calc-input:focus { outline: none; border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
        .calc-input::placeholder { color: #94A3B8; }
        .calc-input.field-empty { background-color: #FFFBEB; border-color: #FDE68A; }
        .calc-input-readonly { width: 100%; padding: 10px 12px; border: 1px solid #E2E8F0; border-radius: 8px; font-size: 15px; font-family: 'Host Grotesk', system-ui, sans-serif; background: #F1F5F9; color: #64748B; cursor: not-allowed; }

        .input-with-symbol { position: relative; }
        .symbol-left { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #64748B; font-weight: 600; pointer-events: none; font-size: 15px; }
        .symbol-right { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: #64748B; font-weight: 600; pointer-events: none; font-size: 14px; }
        .has-left-symbol { padding-left: 28px !important; }

        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
        .grid-2-compact { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

        .dual-field-row { display: flex; align-items: center; gap: 0; }
        .dual-field { flex: 1; min-width: 0; }
        .dual-field-separator { flex-shrink: 0; padding: 0 8px; font-size: 12px; font-weight: 600; color: #94A3B8; white-space: nowrap; }

        .toggle-group-inline { display: flex; gap: 8px; }
        .toggle-btn { padding: 10px 24px; border: 2px solid #CBD5E1; background: white; color: #64748B; font-size: 14px; font-weight: 600; border-radius: 6px; cursor: pointer; transition: all 0.2s; font-family: 'Host Grotesk', system-ui, sans-serif; }
        .toggle-btn:hover { border-color: #94A3B8; }
        .toggle-btn.active { background: #1E293B; color: white; border-color: #1E293B; }

        .recon-subbox { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 18px; }
        .recon-subbox-title { font-size: 13px; font-weight: 700; color: #0F172A; margin: 0 0 14px 0; padding: 0 0 10px 0; border-bottom: 2px solid #CBD5E1; text-transform: uppercase; letter-spacing: 0.03em; }
        .recon-grid-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; align-items: start; }
        .recon-grid-3col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; align-items: start; }
        .recon-column { display: flex; flex-direction: column; gap: 14px; }

        .fee-compact-group label { display: block; font-size: 13px; font-weight: 700; color: #1E293B; margin-bottom: 5px; }
        .fee-compact-group .calc-input { padding: 9px 12px; font-size: 14px; }
        .fee-compact-group .has-left-symbol { padding-left: 28px !important; }

        .total-revenue-box { background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 16px 20px; display: inline-block; margin-top: 14px; }
        .total-revenue-label { font-size: 14px; color: #1E40AF; font-weight: 500; margin-bottom: 4px; }
        .total-revenue-value { font-size: 28px; font-weight: 800; color: #0F172A; }

        .total-reimb-box { background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 16px 20px; display: inline-block; margin-top: 14px; }
        .total-reimb-label { font-size: 14px; color: #166534; font-weight: 500; margin-bottom: 4px; }
        .total-reimb-value { font-size: 28px; font-weight: 800; color: #0F172A; }

        .note-text { font-size: 13px; color: #64748B; margin: 0; line-height: 1.5; }
        .calc-hint { font-size: 12px; font-weight: 400; color: #94A3B8; }

        /* Ledger breakdown rows */
        .breakdown-row-indicator { display: grid; grid-template-columns: 1fr auto auto; gap: 12px; padding: 5px 0; font-size: 14px; color: #374151; align-items: baseline; }
        .row-label { display: flex; align-items: baseline; gap: 8px; }
        .indicator-icon { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; font-size: 13px; font-weight: 700; line-height: 1; flex-shrink: 0; }
        .indicator-icon.green { background: #16A34A; color: white; }
        .indicator-icon.red { background: #DC2626; color: white; }
        .ledger-amount { text-align: right; font-weight: 600; min-width: 100px; }
        .ledger-balance { text-align: right; font-weight: 500; color: #64748B; min-width: 100px; }
        .ledger-col-headers { display: grid; grid-template-columns: 1fr auto auto; gap: 12px; padding: 8px 0 4px 0; border-bottom: 1px solid #E2E8F0; margin-bottom: 4px; }
        .ledger-col-amt, .ledger-col-bal { text-align: right; font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.08em; min-width: 100px; }
        .loan-amount-header { padding: 16px 20px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; margin-bottom: 16px; }
        .loan-amount-header-text { font-size: 18px; font-weight: 800; color: #0F172A; }

        /* Breakdown rows (simple) */
        .breakdown-row-simple { display: flex; justify-content: space-between; align-items: baseline; padding: 5px 0; font-size: 14px; color: #374151; }
        .breakdown-row-simple.total-row { font-weight: 700; color: #0F172A; border-top: 2px solid #1E293B; margin-top: 8px; padding-top: 10px; }
        .breakdown-row-simple.payroll-deduction { color: #DC2626; }
        .breakdown-row-simple.payroll-addition { color: #16A34A; }

        /* Subtotal / Result boxes */
        .subsection-box { background: #F8FAFC; border: 1px solid #E2E8F0; padding: 18px; border-radius: 6px; margin-top: 14px; }
        .subsection-box:first-of-type { margin-top: 0; }
        .subsection-header-modern { font-size: 13px; font-weight: 700; color: #0F172A; margin: 0 0 14px 0; padding: 0 0 10px 0; border-bottom: 2px solid #CBD5E1; letter-spacing: 0.02em; text-transform: uppercase; }

        /* Final results grid */
        .final-results { margin-top: 24px; padding-top: 20px; border-top: 2px solid #E2E8F0; display: grid; gap: 16px; }
        .final-results-3col { grid-template-columns: 1fr 1fr 1fr; }
        .final-results-4col { grid-template-columns: 1fr 1fr 1fr 1fr; }
        .final-result-item { text-align: center; padding: 18px; background: #F8FAFC; border: 2px solid #E2E8F0; border-radius: 8px; }
        .final-label { display: block; font-size: 12px; font-weight: 600; color: #64748B; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
        .final-value { display: block; font-size: 28px; font-weight: 800; color: #0F172A; }

        .overage-warning-note { font-size: 12px; color: #475569; font-weight: 600; margin-top: 10px; padding-top: 8px; border-top: 1px solid #CBD5E1; line-height: 1.4; }

        /* NEXA 100 toggle */
        .toggle-switch { position: relative; width: 52px; height: 28px; flex-shrink: 0; display: inline-block; }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .toggle-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #CBD5E1; border-radius: 28px; transition: 0.3s; }
        .toggle-slider:before { position: absolute; content: ""; height: 22px; width: 22px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.3s; }
        .toggle-switch input:checked + .toggle-slider { background: #1E293B; }
        .toggle-switch input:checked + .toggle-slider:before { transform: translateX(24px); }
        .nexa100-toggle-inline { display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 12px; padding-top: 10px; border-top: 1px solid #E2E8F0; }
        .nexa100-toggle-label { font-size: 13px; font-weight: 600; color: #475569; }

        /* Notes textarea */
        .notes-textarea { min-height: 120px; resize: vertical; font-family: inherit; line-height: 1.5; }

        /* Disclaimer */
        .info-disclaimer { display: flex; align-items: center; gap: 10px; padding: 14px 18px; margin-top: 20px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; color: #64748B; font-size: 14px; }
        .info-disclaimer i { color: #94A3B8; font-size: 16px; flex-shrink: 0; }

        /* Modal */
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; justify-content: center; align-items: center; }
        .modal-content { background: white; width: 480px; max-width: 92%; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-height: 70vh; display: flex; flex-direction: column; }
        .modal-header { background: #0F172A; color: white; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; }
        .modal-header h3 { margin: 0; font-size: 16px; font-weight: 700; }
        .close-modal { cursor: pointer; font-size: 22px; color: #94A3B8; transition: color 0.15s; background: none; border: none; }
        .close-modal:hover { color: white; }
        .modal-list { padding: 8px; max-height: 360px; overflow-y: auto; flex: 1; }
        .save-item { padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #E2E8F0; cursor: pointer; transition: background 0.15s; border-radius: 8px; }
        .save-item:hover { background: #F1F5F9; }
        .save-item-info { flex: 1; }
        .save-item-name { font-size: 14px; font-weight: 600; color: #0F172A; }
        .save-item-date { font-size: 12px; color: #94A3B8; margin-top: 2px; }
        .delete-btn { color: #DC2626; font-weight: 600; cursor: pointer; font-size: 13px; padding: 4px 8px; border-radius: 4px; border: none; background: none; }
        .delete-btn:hover { background: #FEE2E2; }
        .empty-state { color: #94A3B8; font-style: italic; text-align: center; padding: 32px 20px; }

        @media (max-width: 900px) {
          .grid-2 { grid-template-columns: 1fr; }
          .grid-3 { grid-template-columns: 1fr; }
          .recon-grid-2col { grid-template-columns: 1fr; }
          .recon-grid-3col { grid-template-columns: 1fr; }
          .final-results-3col { grid-template-columns: 1fr; }
          .final-results-4col { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 768px) {
          .calc-header { flex-direction: column; align-items: flex-start; }
          .header-left { width: 100%; margin-bottom: 8px; }
          .header-actions { width: 100%; justify-content: flex-start; }
          .grid-2-compact { grid-template-columns: 1fr; }
          .floating-card { padding: 20px 16px; border-radius: 12px; }
          .section-header-dark { margin: -20px -16px 20px -16px; border-radius: 12px 12px 0 0; }
          .dual-field-row { flex-direction: column; gap: 6px; }
          .dual-field-separator { padding: 4px 0; text-align: center; }
          .final-results-4col { grid-template-columns: 1fr; }
          .final-value { font-size: 24px; }
          .ledger-col-bal, .ledger-balance { display: none; }
          .breakdown-row-indicator { grid-template-columns: 1fr auto; }
          .ledger-col-headers { grid-template-columns: 1fr auto; }
        }
        @media (max-width: 480px) {
          .header-actions { flex-direction: column; gap: 12px; }
          .btn-group { width: 100%; justify-content: space-between; gap: 6px; }
          .action-btn { flex: 1; text-align: center; padding: 10px 6px; justify-content: center; font-size: 12px; }
        }
      `}</style>

      <div className="calc-container">

        {/* BREADCRUMB */}
        <div className="calc-breadcrumb">
          <Link to="/app/calculators"><i className="fa-solid fa-arrow-left" style={{ fontSize: 12 }}></i> Calculators</Link>
          <span className="bc-sep">/</span>
          <span className="bc-current">NEXA NonDel Compensation</span>
        </div>

        {/* HEADER BAR */}
        <div className="calc-header">
          <div className="header-left">
            <h1 className="calc-title">NEXA NonDel Compensation Calculator</h1>
            <p className="calc-subtitle">Calculate non-delegated compensation, fees, credits, and payroll breakdown.</p>
          </div>
          <div className="header-actions">
            <div className="btn-group">
              <button onClick={printToPDF} className="action-btn btn-print"><i className="fa-solid fa-file-pdf"></i> Print</button>
              <button onClick={saveScenario} className="action-btn btn-save"><i className="fa-solid fa-floppy-disk"></i> Save</button>
              <button onClick={loadFromBrowser} className="action-btn btn-load"><i className="fa-solid fa-folder-open"></i> Load</button>
              <button onClick={clearAll} className="action-btn btn-clear"><i className="fa-solid fa-rotate-left"></i> Clear</button>
            </div>
          </div>
        </div>

        {/* ============================================
            TOP ROW: LOAN DETAILS + COMP DETAILS
            ============================================ */}
        <div className="grid-2">
          {/* LOAN DETAILS */}
          <div className="floating-card">
            <div className="card-title"><i className="fa-solid fa-file-lines"></i> Loan Details</div>
            <div className="grid-3" style={{ marginBottom: 16 }}>
              <div className="input-group">
                <label>Loan Amount $</label>
                <div className="input-with-symbol">
                  <span className="symbol-left">$</span>
                  <input type="text" className={"calc-input has-left-symbol" + emptyClass(loanAmount)} placeholder="0"
                    value={formatNumberString(loanAmount)}
                    onChange={(e) => setLoanAmount(e.target.value.replace(/[^\d.\-]/g, ""))} />
                </div>
              </div>
              <div className="input-group">
                <label>Date Loan Funded</label>
                <input type="date" className="calc-input" value={dateFunded} onChange={(e) => setDateFunded(e.target.value)} />
              </div>
              <div className="input-group">
                <label>Borrower Name</label>
                <input type="text" className={"calc-input" + emptyClass(borrowerName)} placeholder="Enter name"
                  value={borrowerName} onChange={(e) => setBorrowerName(e.target.value)} />
              </div>
            </div>
            <div className="grid-3">
              <div className="input-group">
                <label>Loan ID#</label>
                <input type="text" className={"calc-input" + emptyClass(loanId)} placeholder="Enter ID"
                  value={loanId} onChange={(e) => setLoanId(e.target.value)} />
              </div>
              <div className="input-group">
                <label>FICO Score</label>
                <input type="number" className={"calc-input" + emptyClass(ficoScore)} placeholder="0"
                  value={ficoScore} onChange={(e) => setFicoScore(e.target.value)} />
              </div>
              <div className="input-group">
                <label>State</label>
                <select className={"calc-input" + emptyClass(state)} value={state} onChange={(e) => setState(e.target.value)}>
                  <option value="">Select State</option>
                  {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* COMP DETAILS */}
          <div className="floating-card">
            <div className="card-title"><i className="fa-solid fa-calculator"></i> Comp Details</div>
            <div className="grid-2-compact" style={{ marginBottom: 16 }}>
              <div className="input-group">
                <label>Lender</label>
                <input type="text" className={"calc-input" + emptyClass(lender)} placeholder="Enter lender"
                  value={lender} onChange={(e) => setLender(e.target.value)} />
              </div>
              <div className="input-group">
                <label>Loan Type</label>
                <select className={"calc-input" + emptyClass(loanType)} value={loanType} onChange={(e) => setLoanType(e.target.value)}>
                  <option value="">Select Loan Type</option>
                  {LOAN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="grid-2-compact">
              <div className="input-group">
                <label>Lead Source</label>
                <select className={"calc-input" + emptyClass(leadSource)} value={leadSource} onChange={(e) => setLeadSource(e.target.value)}>
                  <option value="">-- Select --</option>
                  {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Tax Designation</label>
                <div className="toggle-group-inline">
                  <button className={"toggle-btn" + (employeeType === "W2" ? " active" : "")} onClick={() => setEmployeeType("W2")}>W-2</button>
                  <button className={"toggle-btn" + (employeeType === "1099" ? " active" : "")} onClick={() => setEmployeeType("1099")}>1099</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================
            SECOND ROW: OTHER ADJUSTMENTS + BDM
            ============================================ */}
        <div className="grid-2">
          <div className="floating-card">
            <div className="card-title"><i className="fa-solid fa-sliders"></i> Other Adjustments</div>
            <div className="input-group">
              <label>Ledger Balance Owed</label>
              <CurrencyInput value={ledgerBalance} onChange={setLedgerBalance} />
            </div>
            <div className="input-group">
              <label>Amount transferred to Divvy (If any)</label>
              <CurrencyInput value={divvyAmount} onChange={setDivvyAmount} />
            </div>
          </div>

          <div className="floating-card">
            <div className="card-title"><i className="fa-solid fa-users"></i> BDM Calculation</div>
            <div className="grid-2-compact" style={{ marginBottom: 16 }}>
              <div className="input-group">
                <label>BDM bps</label>
                <input type="number" className={"calc-input" + emptyClass(bdmBps)} placeholder="0"
                  value={bdmBps} onChange={(e) => setBdmBps(e.target.value)} />
              </div>
              <div className="input-group">
                <label>BDM Comp $</label>
                <input type="text" className="calc-input-readonly" readOnly value={formatCurrency(c.bdmCompValue)} />
              </div>
            </div>
            <div className="grid-2-compact">
              <div className="input-group">
                <label>BDM Team bps</label>
                <input type="number" className={"calc-input" + emptyClass(bdmTeamBps)} placeholder="0"
                  value={bdmTeamBps} onChange={(e) => setBdmTeamBps(e.target.value)} />
              </div>
              <div className="input-group">
                <label>BDM Team Comp $</label>
                <input type="text" className="calc-input-readonly" readOnly value={formatCurrency(c.bdmTeamCompValue)} />
              </div>
            </div>
          </div>
        </div>

        {/* ============================================
            LOAN RECONCILIATION
            ============================================ */}
        <div className="floating-card">
          <div className="section-header-dark">Loan Reconciliation</div>

          {/* Revenue + Reimbursements side-by-side */}
          <div className="recon-grid-2col">
            {/* REVENUE */}
            <div className="recon-subbox">
              <h4 className="recon-subbox-title">Revenue</h4>
              <div className="recon-grid-2col">
                {/* Revenue Column 1 */}
                <div className="recon-column">
                  <DualPctDollarField label="Loan Amount Points"
                    pctValue={discountPointsPct} onPctChange={onDiscountPctInput}
                    dollarValue={discountPointsDollar} onDollarChange={onDiscountDollarInput} />
                  <DualPctDollarField label="Origination Fee"
                    pctValue={originationFeePct} onPctChange={onOriginationPctInput}
                    dollarValue={originationFeeDollar} onDollarChange={onOriginationDollarInput} />
                  <div className="fee-compact-group">
                    <label>Admin Fee Charged</label>
                    <CurrencyInput value={adminFeeCharged} onChange={onAdminFeeChargedChange} />
                  </div>
                  <DualPctDollarField label="Servicing Release Premium (SRP)"
                    pctValue={srpPct} onPctChange={onSrpPctInput}
                    dollarValue={srpDollar} onDollarChange={onSrpDollarInput} />
                </div>
                {/* Revenue Column 2 */}
                <div className="recon-column">
                  <div className="fee-compact-group">
                    <label>MERS Fee Charged</label>
                    <CurrencyInput value={mersFeeCharged} onChange={setMersFeeCharged} />
                  </div>
                  <div className="fee-compact-group">
                    <label>Flood Cert</label>
                    <CurrencyInput value={floodCert} onChange={setFloodCert} />
                  </div>
                  <div className="fee-compact-group">
                    <label>AXEN Quarter Point</label>
                    <CurrencyInput value={axenQuarterPoint} onChange={setAxenQuarterPoint} />
                  </div>
                  <div className="fee-compact-group">
                    <label>AXEN Holdback</label>
                    <CurrencyInput value={axenHoldback} onChange={setAxenHoldback} />
                  </div>
                </div>
              </div>
              <div className="total-revenue-box">
                <div className="total-revenue-label">Total Revenue</div>
                <div className="total-revenue-value">{formatCurrency(c.totalRevenue)}</div>
              </div>
            </div>

            {/* REIMBURSEMENTS */}
            <div className="recon-subbox">
              <h4 className="recon-subbox-title">Reimbursements</h4>
              <div className="recon-column">
                <div className="fee-compact-group">
                  <label>Credit Report</label>
                  <CurrencyInput value={creditReport} onChange={setCreditReport} />
                </div>
                <div className="fee-compact-group">
                  <label>Appraisal</label>
                  <CurrencyInput value={appraisalReimb} onChange={setAppraisalReimb} />
                </div>
                <div className="fee-compact-group">
                  <label>Other</label>
                  <CurrencyInput value={otherReimb} onChange={setOtherReimb} />
                </div>
              </div>
              <div className="total-reimb-box">
                <div className="total-reimb-label">Total Reimbursements</div>
                <div className="total-reimb-value">{formatCurrency(c.totalReimbursements)}</div>
              </div>
            </div>
          </div>

          {/* Credits and Charges */}
          <div className="recon-subbox" style={{ marginTop: 18 }}>
            <h4 className="recon-subbox-title">Credits and Charges</h4>

            {/* UW Fee dual field */}
            <div className="fee-compact-group" style={{ marginBottom: 16, maxWidth: 500 }}>
              <div className="dual-field-row">
                <div className="dual-field">
                  <label>UW Fee to Investor</label>
                  <CurrencyInput value={uwFeeToInvestor} onChange={onUwFeeInvestorInput} />
                </div>
                <span className="dual-field-separator">- or -</span>
                <div className="dual-field">
                  <label>UW Fee Overage</label>
                  <CurrencyInput value={uwFeeOverageInput} onChange={onUwFeeOverageInputChange} />
                </div>
              </div>
            </div>

            {/* Remaining fields in 3-column grid */}
            <div className="recon-grid-3col">
              <div className="recon-column">
                <div className="fee-compact-group">
                  <label>Tax Service PA</label>
                  <CurrencyInput value={taxServicePA} onChange={setTaxServicePA} />
                </div>
                <div className="fee-compact-group">
                  <label>Cure/Tolerance</label>
                  <CurrencyInput value={cureTolerance} onChange={setCureTolerance} />
                </div>
              </div>
              <div className="recon-column">
                <div className="fee-compact-group">
                  <label>MERS Fee Due</label>
                  <CurrencyInput value={mersFeeDue} onChange={setMersFeeDue} />
                </div>
                <div className="fee-compact-group">
                  <label>Warehouse Assist Fee</label>
                  <CurrencyInput value={warehouseAssistFee} onChange={setWarehouseAssistFee} />
                </div>
              </div>
              <div className="recon-column">
                <div className="fee-compact-group">
                  <label>Lender Credit(s)</label>
                  <CurrencyInput value={lenderCredits} onChange={setLenderCredits} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================
            LEDGER BREAKDOWN
            ============================================ */}
        <div className="floating-card">
          <div className="section-header-dark">Ledger Breakdown</div>

          <div className="loan-amount-header">
            <div className="loan-amount-header-text">LOAN / NOTE AMOUNT:&nbsp; {formatCurrency(c.la)}</div>
          </div>

          <div className="ledger-col-headers">
            <span></span>
            <span className="ledger-col-amt">AMOUNT</span>
            <span className="ledger-col-bal">BALANCE</span>
          </div>

          <div className="subsection-box">
            <LedgerRow sign="+" label="Section A Fee (Points)" amount={c.discPoints} balance={c.balPoints} />
            <LedgerRow sign="+" label="Section A Fees (Origination)" amount={c.origFee} balance={c.balOrig} />
            <LedgerRow sign="+" label="Section A Fees (UW Fee)" amount={c.adminFee} balance={c.balUwFee} />
            <LedgerRow sign="+" label="Section A Fee (SRP)" amount={parseRaw(srpDollar)} balance={c.balSrp} />
            <LedgerRow sign="-" label="UW Fee to Investor" amount={c.uwInvestor} balance={c.balUwInvestor} />
            <LedgerRow sign="-" label="AXEN Quarter Point" amount={c.axenQP} balance={c.balAxenQP} />
            <LedgerRow sign="-" label="Lender Credit(s)" amount={c.lendCred} balance={c.balLenderCredits} />
            <LedgerRow sign="-" label="Warehouse Assist Fee" amount={parseRaw(warehouseAssistFee)} balance={c.balWarehouseAssist} />
            <LedgerRow sign="-" label="MERS Fee" amount={parseRaw(mersFeeDue)} balance={c.balMers} />
            <LedgerRow sign="-" label="UW Fee Overage" amount={c.uwOverage} balance={c.balUwOverage} />

            <div className="breakdown-row-simple total-row" style={{ padding: "14px 0" }}>
              <span>= Total Broker Check (Total Branch Comp)</span>
              <span>{formatCurrency(c.totalBrokerCheck)}</span>
            </div>

            <LedgerRow sign="-" label="NEXA Operational Cost (25bps)" amount={c.nexaOp} balance={c.balNexaOp} />
            <LedgerRow sign="-" label="NEXA / AXEN Profit (12%)" amount={c.nexaProfit} balance={c.balNexaProfit} />
            <LedgerRow sign="+" label="UW Overage Back" amount={c.uwOverage} balance={c.balUwOverageBack} />
            <LedgerRow sign="-" label="Ledger Balance Owed" amount={c.ledgerBal} balance={c.balBalanceOwed} />
            <LedgerRow sign="-" label="Tax Service PA" amount={c.taxSvc} balance={c.balTaxService} />
            <LedgerRow sign="-" label="Cure/Tolerance" amount={c.cure} balance={c.balCure} />

            <div className="breakdown-row-simple total-row" style={{ padding: "14px 0" }}>
              <span>= Subtotal</span>
              <span>{formatCurrency(c.subtotal)}</span>
            </div>

            <div className="breakdown-row-indicator" style={{ marginTop: 4, paddingTop: 10 }}>
              <span className="row-label"><span className="indicator-icon red">&minus;</span>Overage (Sent to Operational Ledger)</span>
              <span className="ledger-amount">{formatCurrency(c.ledgerOverage)}</span>
              <span className="ledger-balance"></span>
            </div>
          </div>

          <div className="final-results final-results-3col" style={{ marginTop: 16 }}>
            <div className="final-result-item">
              <span className="final-label">Net Subtotal</span>
              <span className="final-value">{formatCurrency(c.ledgerNetSubtotal)}</span>
            </div>
            <div className="final-result-item">
              <span className="final-label">Admin Fee</span>
              <span className="final-value">{formatCurrency(c.adminFeeCalc)}</span>
            </div>
            <div className="final-result-item">
              <span className="final-label">Comp to Everee</span>
              <span className="final-value">{formatCurrency(c.compToEveree)}</span>
            </div>
          </div>
        </div>

        {/* ============================================
            PAYROLL AND EXCESS CALCULATIONS
            ============================================ */}
        <div className="floating-card">
          <div className="section-header-dark">Payroll and Excess Calculations</div>

          {/* Row 1: Lead Source + Tax Designation + Bucket Tier BPS */}
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, alignItems: "flex-start", marginBottom: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 0, minWidth: 220 }}>
              <div className="input-group" style={{ marginBottom: 8 }}>
                <label>Lead Source</label>
                <select className={"calc-input" + emptyClass(leadSource)} value={leadSource} onChange={(e) => setLeadSource(e.target.value)}>
                  <option value="">-- Select --</option>
                  {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Tax Designation</label>
                <div className="toggle-group-inline">
                  <button className={"toggle-btn" + (employeeType === "W2" ? " active" : "")} onClick={() => setEmployeeType("W2")}>W-2</button>
                  <button className={"toggle-btn" + (employeeType === "1099" ? " active" : "")} onClick={() => setEmployeeType("1099")}>1099</button>
                </div>
              </div>
            </div>
            <div style={{ width: "100%" }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Bucket Tier BPS <span className="calc-hint">(supports math: 275-25)</span></label>
                <input type="text" className={"calc-input" + emptyClass(bucketTierBps)} placeholder="0"
                  value={bucketTierBps}
                  onChange={(e) => setBucketTierBps(e.target.value)}
                  onBlur={resolveBpsField}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); resolveBpsField(); e.target.blur(); } }} />
              </div>
              <p className="note-text" style={{ marginTop: 6, marginBottom: 0 }}>
                Note: Enter your bucket tier bps from{" "}
                <a href="https://www.loanofficersupport.com/my-ledger#:~:text=1-,Exhibit%20A" target="_blank" rel="noopener noreferrer" style={{ color: "#2563EB", textDecoration: "underline", fontWeight: 600 }}>Exhibit A</a>
                {" "}of your comp agreement for this lead source.
              </p>
            </div>
          </div>

          {/* Admin Fee Calculation */}
          <div className="subsection-box">
            <h4 className="subsection-header-modern">Admin Fee Calculation</h4>
            <div className="breakdown-row-simple">
              <span>Max Allowable Comp (Tier BPS)</span>
              <span>{formatCurrency(c.maxAllowableComp)}</span>
            </div>
            <div className="breakdown-row-simple payroll-deduction">
              <span>- Ledger Balance Owed</span>
              <span>{formatCurrency(c.ledgerBal)}</span>
            </div>
            {c.cure > 0 && (
              <div className="breakdown-row-simple payroll-deduction">
                <span>- Cure/Tolerance</span>
                <span>{formatCurrency(c.cure)}</span>
              </div>
            )}
            <div className="breakdown-row-simple total-row">
              <span>= Subject to Admin Fee</span>
              <span>{formatCurrency(c.subjectToAdmin)}</span>
            </div>
            {!c.is1099 && (
              <>
                <div className="breakdown-row-simple" style={{ marginTop: 4 }}>
                  <span>x 12% Matching Tax</span><span></span>
                </div>
                <div className="breakdown-row-simple total-row">
                  <span>= Admin Fee (Matching Taxes)</span>
                  <span>{formatCurrency(c.adminFeeCalc)}</span>
                </div>
              </>
            )}
          </div>

          {/* Comp to Everee */}
          <div className="subsection-box">
            <h4 className="subsection-header-modern">Comp to Everee</h4>
            {c.useOveragePath ? (
              <>
                <div className="breakdown-row-simple">
                  <span>Max Allowable Comp</span>
                  <span>{formatCurrency(c.maxAllowableComp)}</span>
                </div>
                {c.cure > 0 && (
                  <div className="breakdown-row-simple payroll-deduction">
                    <span>- Cure/Tolerance</span>
                    <span>{formatCurrency(c.cure)}</span>
                  </div>
                )}
                {parseRaw(warehouseAssistFee) > 0 && (
                  <div className="breakdown-row-simple payroll-deduction">
                    <span>- Warehouse Assist Fee</span>
                    <span>{formatCurrency(parseRaw(warehouseAssistFee))}</span>
                  </div>
                )}
                <div className="breakdown-row-simple total-row">
                  <span>= Comp to Everee</span>
                  <span>{formatCurrency(c.compToEveree)}</span>
                </div>
                <p className="note-text" style={{ marginTop: 4, marginBottom: 0, fontSize: 11, color: "#6b7280" }}>
                  Subtotal exceeds Max Comp — LO receives full Max Comp. Admin Fee is paid from excess.
                </p>
              </>
            ) : (
              <>
                <div className="breakdown-row-simple">
                  <span>Subject to Admin Fee</span>
                  <span>{formatCurrency(c.subjectToAdmin)}</span>
                </div>
                {!c.is1099 && (
                  <div className="breakdown-row-simple payroll-deduction">
                    <span>- Admin Fee</span>
                    <span>{formatCurrency(c.adminFeeCalc)}</span>
                  </div>
                )}
                <div className="breakdown-row-simple total-row">
                  <span>= Comp to Everee</span>
                  <span>{formatCurrency(c.compToEveree)}</span>
                </div>
                <p className="note-text" style={{ marginTop: 4, marginBottom: 0, fontSize: 11, color: "#6b7280" }}>
                  {c.noOverageNote}
                </p>
              </>
            )}
          </div>

          {/* Overage Calculation */}
          <div className="subsection-box">
            <h4 className="subsection-header-modern">Overage Calculation</h4>
            <div className="breakdown-row-simple">
              <span>Subtotal</span>
              <span>{formatCurrency(c.subtotal)}</span>
            </div>
            <div className="breakdown-row-simple payroll-deduction">
              <span>- Admin Fee</span>
              <span>{formatCurrency(c.adminFeeCalc)}</span>
            </div>
            <div className="breakdown-row-simple payroll-deduction">
              <span>- Comp to Everee</span>
              <span>{formatCurrency(c.compToEveree)}</span>
            </div>
            {c.taxSvc > 0 && (
              <div className="breakdown-row-simple payroll-deduction">
                <span>- Tax Service PA</span>
                <span>{formatCurrency(c.taxSvc)}</span>
              </div>
            )}
            <div className="breakdown-row-simple total-row">
              <span>= Net Overage</span>
              <span>{formatCurrency(c.netOverage)}</span>
            </div>
          </div>

          {/* Reimbursements Summary */}
          <div className="subsection-box">
            <h4 className="subsection-header-modern">Reimbursements</h4>
            {c.cr > 0 && (
              <div className="breakdown-row-simple">
                <span>Credit Report</span>
                <span>{formatCurrency(c.cr)}</span>
              </div>
            )}
            {c.appr > 0 && (
              <div className="breakdown-row-simple">
                <span>Appraisal</span>
                <span>{formatCurrency(c.appr)}</span>
              </div>
            )}
            {c.other > 0 && (
              <div className="breakdown-row-simple">
                <span>Other</span>
                <span>{formatCurrency(c.other)}</span>
              </div>
            )}
            <div className="breakdown-row-simple total-row">
              <span>= Total Reimbursements</span>
              <span>{formatCurrency(c.totalReimbursements)}</span>
            </div>
            <p className="note-text" style={{ marginTop: 4, marginBottom: 0, fontSize: 11, color: "#6b7280" }}>
              Reimbursements are handled separately from the comp ledger and paid directly to the LO.
            </p>
          </div>

          {/* Final Results — 4 columns */}
          <div className="final-results final-results-4col">
            <div className="final-result-item">
              <span className="final-label">Comp to Everee</span>
              <span className="final-value">{formatCurrency(c.compToEveree)}</span>
            </div>
            <div className="final-result-item">
              <span className="final-label">Remaining Balance (Overage)</span>
              <span className="final-value">{formatCurrency(c.netOverage)}</span>
              <p className="overage-warning-note">If this number is Negative, your bucket tier BPS is too high and you have a comp violation</p>
            </div>
            <div className="final-result-item">
              <span className="final-label">NEXA &#x1F4AF; Funds</span>
              <span className="final-value">{formatCurrency(c.nexa100Funds)}</span>
              <div className="nexa100-toggle-inline">
                <span className="nexa100-toggle-label">NEXA &#x1F4AF; Eligible</span>
                <label className="toggle-switch">
                  <input type="checkbox" checked={isNexa100} onChange={(e) => setIsNexa100(e.target.checked)} />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
            <div className="final-result-item">
              <span className="final-label">Total Reimbursements</span>
              <span className="final-value">{formatCurrency(c.totalReimbursements)}</span>
            </div>
          </div>
        </div>

        {/* ============================================
            NOTES SECTION
            ============================================ */}
        <div className="floating-card">
          <div className="card-title"><i className="fa-solid fa-note-sticky"></i> Notes</div>
          <textarea className="calc-input notes-textarea" placeholder="Enter any additional notes here..."
            value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {/* DISCLAIMER */}
        <div className="info-disclaimer">
          <i className="fa-solid fa-circle-info"></i>
          <span>This calculator is provided for convenience and does not override any official NEXA calculations or procedures.</span>
        </div>

        {/* ============================================
            LOAD MODAL
            ============================================ */}
        {showLoadModal && (
          <div className="modal-overlay" onClick={() => setShowLoadModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Saved Scenarios</h3>
                <button onClick={() => setShowLoadModal(false)} className="close-modal">&times;</button>
              </div>
              <div className="modal-list">
                {Object.keys(savedScenarios).length === 0 ? (
                  <p className="empty-state">No saved scenarios found.</p>
                ) : (
                  Object.keys(savedScenarios).map((key) => (
                    <div key={key} className="save-item">
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

      </div>
    </>
  );
}

/* ================================================
   SUB-COMPONENTS
   ================================================ */

/** Currency input with $ prefix and live comma formatting */
function CurrencyInput({ value, onChange }) {
  return (
    <div className="input-with-symbol">
      <span className="symbol-left">$</span>
      <input
        type="text"
        className={"calc-input has-left-symbol" + emptyClass(value)}
        placeholder="0"
        value={formatNumberString(value)}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.\-]/g, "");
          onChange(raw);
        }}
      />
    </div>
  );
}

/** Dual % / $ linked field pair */
function DualPctDollarField({ label, pctValue, onPctChange, dollarValue, onDollarChange }) {
  return (
    <div className="fee-compact-group">
      <label>{label}</label>
      <div className="dual-field-row">
        <div className="dual-field">
          <div className="input-with-symbol">
            <input type="number" className={"calc-input" + emptyClass(pctValue)} step="0.01" placeholder="0"
              value={pctValue} onChange={(e) => onPctChange(e.target.value)} />
            <span className="symbol-right">%</span>
          </div>
        </div>
        <span className="dual-field-separator">or</span>
        <div className="dual-field">
          <div className="input-with-symbol">
            <span className="symbol-left">$</span>
            <input type="text" className={"calc-input has-left-symbol" + emptyClass(dollarValue)} placeholder="0"
              value={formatNumberString(dollarValue)}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d.\-]/g, "");
                onDollarChange(raw);
              }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Single ledger breakdown row with +/- indicator and running balance */
function LedgerRow({ sign, label, amount, balance }) {
  const isGreen = sign === "+";
  return (
    <div className="breakdown-row-indicator">
      <span className="row-label">
        <span className={"indicator-icon " + (isGreen ? "green" : "red")}>{isGreen ? "+" : "\u2212"}</span>
        {label}
      </span>
      <span className="ledger-amount">{formatCurrency(amount)}</span>
      <span className="ledger-balance">{formatCurrency(balance)}</span>
    </div>
  );
}
