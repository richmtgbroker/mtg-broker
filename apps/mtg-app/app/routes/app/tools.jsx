import { useState } from "react";

export function meta() {
  return [{ title: "Tools — MtgBroker" }];
}

/* ───────── colour tokens ───────── */
const C = {
  bg: "#F8FAFC",
  card: "#FFFFFF",
  border: "#E2E8F0",
  accent: "#2563EB",
  text: "#0F172A",
  muted: "#64748B",
  dim: "#94A3B8",
};

/* ───────── data ───────── */
const sections = [
  {
    title: "Property Search & Value Estimators",
    icon: "fa-solid fa-magnifying-glass-dollar",
    cards: [
      { name: "Zillow Property Search", url: "https://www.zillow.com/", icon: "fa-solid fa-house", desc: "Search properties, view Zestimates, and explore neighborhoods" },
      { name: "Redfin Property Search", url: "https://www.redfin.com/", icon: "fa-solid fa-magnifying-glass-location", desc: "Property search with market data and listing details" },
      { name: "Realtor.com Search", url: "https://www.realtor.com/", icon: "fa-solid fa-building", desc: "Search listings, view property details and neighborhood data" },
      { name: "PennyMac Home Value Estimator", url: "https://www.pennymac.com/home-value-estimator", icon: "fa-solid fa-chart-column", desc: "Estimate home values using PennyMac's tool" },
      { name: "UWM Home Value Estimator", url: "https://www.uwm.com/dashboard", icon: "fa-solid fa-house-user", desc: "UWM's home value estimator dashboard" },
    ],
  },
  {
    title: "Property Taxes & Flood Maps",
    icon: "fa-solid fa-map-location-dot",
    cards: [
      { name: "Property Tax Lookup", url: "https://publicrecords.netronline.com/", icon: "fa-solid fa-receipt", desc: "Look up property tax records by county" },
      { name: "FEMA Flood Map", url: "https://msc.fema.gov/portal/search", icon: "fa-solid fa-water", desc: "Check flood zones and maps for any property" },
    ],
  },
  {
    title: "Licensing",
    icon: "fa-solid fa-id-card",
    cards: [
      { name: "NMLS License Lookup", url: "https://www.nmlsconsumeraccess.org/", icon: "fa-solid fa-id-card", desc: "Look up NMLS license status for any originator" },
    ],
  },
  {
    title: "Loan Limits",
    icon: "fa-solid fa-landmark",
    cards: [
      { name: "FHFA Conforming Loan Limits", url: "https://www.fhfa.gov/data/conforming-loan-limit", icon: "fa-solid fa-landmark", desc: "Current conforming loan limits by county" },
      { name: "FHA Loan Limits Lookup", url: "https://entp.hud.gov/idapp/html/hicostlook.cfm", icon: "fa-solid fa-university", desc: "Look up FHA loan limits by county" },
    ],
  },
];

const rateSection = {
  title: "Rate & Market Resources",
  icon: "fa-solid fa-chart-line",
  cards: [
    { name: "Mortgage News Daily", url: "https://www.mortgagenewsdaily.com/mortgage-rates", icon: "fa-solid fa-newspaper", desc: "Daily mortgage rate updates and analysis" },
    { name: "Freddie Mac PMMS", url: "https://www.freddiemac.com/pmms", icon: "fa-solid fa-percent", desc: "Weekly Primary Mortgage Market Survey" },
  ],
};

const purchaseDocs = [
  "Completed Loan Application",
  "Purchase Contract",
  "Pay Stubs (last 30 days)",
  "W-2 Forms (2 years)",
  "Tax Returns (2 years)",
  "Bank Statements (2 months)",
  "Photo ID",
  "Gift Letter (if applicable)",
];

const refiDocs = [
  "Completed Loan Application",
  "Current Mortgage Statement",
  "Homeowners Insurance",
  "Pay Stubs (last 30 days)",
  "W-2 Forms (2 years)",
  "Bank Statements (2 months)",
];

/* ───────── reusable styles ───────── */
const sectionIconBox = {
  width: 40,
  height: 40,
  borderRadius: 8,
  background: C.accent,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#FFFFFF",
  fontSize: 18,
  flexShrink: 0,
};

const cardGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: 20,
};

const baseCard = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  padding: 24,
  transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
  cursor: "pointer",
  textDecoration: "none",
  color: "inherit",
  display: "block",
};

const iconBox48 = {
  width: 48,
  height: 48,
  borderRadius: 10,
  background: "linear-gradient(135deg, #2563EB, #3B82F6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#FFFFFF",
  fontSize: 20,
  flexShrink: 0,
};

const externalBadge = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 11,
  fontWeight: 600,
  color: C.accent,
  background: "#EFF6FF",
  borderRadius: 6,
  padding: "2px 8px",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  fontSize: 14,
  color: C.text,
  outline: "none",
  boxSizing: "border-box",
};

const resultBox = {
  background: "#F8FAFC",
  borderRadius: 8,
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

/* ───────── helpers ───────── */
function fmt(n) {
  if (n == null || isNaN(n)) return "--";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(n) {
  if (n == null || isNaN(n)) return "--";
  return n.toFixed(2) + "%";
}

/* ───────── sub-components ───────── */
function ToolCard({ name, url, icon, desc }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={baseCard}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = C.accent;
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(37,99,235,0.15)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = C.border;
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={iconBox48}>
          <i className={icon} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{name}</span>
            <span style={externalBadge}>
              External <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: 9 }} />
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{desc}</p>
        </div>
      </div>
    </a>
  );
}

function SectionHeader({ icon, title }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
      <div style={sectionIconBox}>
        <i className={icon} />
      </div>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.text }}>{title}</h2>
    </div>
  );
}

function ToolSection({ title, icon, cards }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <SectionHeader icon={icon} title={title} />
      <div style={cardGrid}>
        {cards.map((c) => (
          <ToolCard key={c.name} {...c} />
        ))}
      </div>
    </div>
  );
}

/* ───────── DTI Calculator ───────── */
function DtiCalc() {
  const [income, setIncome] = useState("");
  const [housing, setHousing] = useState("");
  const [debts, setDebts] = useState("");

  const inc = parseFloat(income) || 0;
  const hou = parseFloat(housing) || 0;
  const dbt = parseFloat(debts) || 0;
  const front = inc > 0 ? (hou / inc) * 100 : null;
  const back = inc > 0 ? ((hou + dbt) / inc) * 100 : null;
  const totalDebt = hou + dbt;

  function frontBadge() {
    if (front == null) return null;
    if (front <= 28) return { label: "Excellent", bg: "#DCFCE7", color: "#16A34A" };
    if (front <= 33) return { label: "Good", bg: "#DBEAFE", color: "#2563EB" };
    return { label: "High", bg: "#FEE2E2", color: "#DC2626" };
  }
  function backBadge() {
    if (back == null) return null;
    if (back <= 36) return { label: "Excellent", bg: "#DCFCE7", color: "#16A34A" };
    if (back <= 43) return { label: "Good", bg: "#DBEAFE", color: "#2563EB" };
    return { label: "High", bg: "#FEE2E2", color: "#DC2626" };
  }

  const fb = frontBadge();
  const bb = backBadge();

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
          Monthly Gross Income
          <input type="number" style={{ ...inputStyle, marginTop: 6 }} placeholder="0.00" value={income} onChange={(e) => setIncome(e.target.value)} />
        </label>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
          Proposed Housing Payment (PITI)
          <input type="number" style={{ ...inputStyle, marginTop: 6 }} placeholder="0.00" value={housing} onChange={(e) => setHousing(e.target.value)} />
        </label>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
          Other Monthly Debt Payments
          <input type="number" style={{ ...inputStyle, marginTop: 6 }} placeholder="0.00" value={debts} onChange={(e) => setDebts(e.target.value)} />
        </label>
      </div>
      <div style={resultBox}>
        <ResultRow label="Front-End DTI" value={pct(front)} badge={fb} />
        <ResultRow label="Back-End DTI" value={pct(back)} badge={bb} />
        <ResultRow label="Total Monthly Debts" value={`$${fmt(totalDebt)}`} />
      </div>
    </div>
  );
}

/* ───────── PITI Calculator ───────── */
function PitiCalc() {
  const [loanAmt, setLoanAmt] = useState("");
  const [rate, setRate] = useState("");
  const [term, setTerm] = useState("30");
  const [insurance, setInsurance] = useState("");
  const [taxes, setTaxes] = useState("");

  const la = parseFloat(loanAmt) || 0;
  const r = parseFloat(rate) || 0;
  const t = parseFloat(term) || 0;
  const ins = parseFloat(insurance) || 0;
  const tax = parseFloat(taxes) || 0;

  let pi = 0;
  if (la > 0 && r > 0 && t > 0) {
    const mr = r / 100 / 12;
    const n = t * 12;
    pi = la * (mr * Math.pow(1 + mr, n)) / (Math.pow(1 + mr, n) - 1);
  }
  const monthlyIns = ins / 12;
  const monthlyTax = tax / 12;
  const totalPiti = pi + monthlyIns + monthlyTax;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
          Loan Amount
          <input type="number" style={{ ...inputStyle, marginTop: 6 }} placeholder="0.00" value={loanAmt} onChange={(e) => setLoanAmt(e.target.value)} />
        </label>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
          Interest Rate (%)
          <input type="number" step="0.01" style={{ ...inputStyle, marginTop: 6 }} placeholder="0.00" value={rate} onChange={(e) => setRate(e.target.value)} />
        </label>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
          Loan Term (Years)
          <input type="number" style={{ ...inputStyle, marginTop: 6 }} placeholder="30" value={term} onChange={(e) => setTerm(e.target.value)} />
        </label>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
          Annual Homeowners Insurance
          <input type="number" style={{ ...inputStyle, marginTop: 6 }} placeholder="0.00" value={insurance} onChange={(e) => setInsurance(e.target.value)} />
        </label>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
          Annual Property Taxes
          <input type="number" style={{ ...inputStyle, marginTop: 6 }} placeholder="0.00" value={taxes} onChange={(e) => setTaxes(e.target.value)} />
        </label>
      </div>
      <div style={resultBox}>
        <ResultRow label="Principal & Interest" value={`$${fmt(pi)}`} />
        <ResultRow label="Monthly Insurance" value={`$${fmt(monthlyIns)}`} />
        <ResultRow label="Monthly Taxes" value={`$${fmt(monthlyTax)}`} />
        <ResultRow label="Total PITI" value={`$${fmt(totalPiti)}`} bold />
      </div>
    </div>
  );
}

/* ───────── Refinance Break-Even Calculator ───────── */
function RefiCalc() {
  const [current, setCurrent] = useState("");
  const [newPmt, setNewPmt] = useState("");
  const [costs, setCosts] = useState("");

  const cur = parseFloat(current) || 0;
  const nw = parseFloat(newPmt) || 0;
  const cc = parseFloat(costs) || 0;

  const savings = cur - nw;
  const breakEven = savings > 0 ? cc / savings : null;
  const annual = savings * 12;

  function beBadge() {
    if (breakEven == null) return null;
    if (breakEven <= 24) return { label: "Good", bg: "#DCFCE7", color: "#16A34A" };
    if (breakEven <= 36) return { label: "Consider", bg: "#FEF3C7", color: "#D97706" };
    return { label: "Long", bg: "#FEE2E2", color: "#DC2626" };
  }

  const bb = beBadge();

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
          Current Monthly Payment
          <input type="number" style={{ ...inputStyle, marginTop: 6 }} placeholder="0.00" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </label>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
          New Monthly Payment
          <input type="number" style={{ ...inputStyle, marginTop: 6 }} placeholder="0.00" value={newPmt} onChange={(e) => setNewPmt(e.target.value)} />
        </label>
        <label style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
          Total Closing Costs
          <input type="number" style={{ ...inputStyle, marginTop: 6 }} placeholder="0.00" value={costs} onChange={(e) => setCosts(e.target.value)} />
        </label>
      </div>
      <div style={resultBox}>
        <ResultRow label="Monthly Savings" value={`$${fmt(savings)}`} />
        <ResultRow label="Break-Even" value={breakEven != null ? `${Math.ceil(breakEven)} months` : "--"} badge={bb} />
        <ResultRow label="Annual Savings" value={`$${fmt(annual)}`} />
      </div>
    </div>
  );
}

/* ───────── Result row helper ───────── */
function ResultRow({ label, value, badge, bold }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 13, color: C.muted }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: bold ? 700 : 600, color: C.text }}>{value}</span>
        {badge && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 6,
              background: badge.bg,
              color: badge.color,
            }}
          >
            {badge.label}
          </span>
        )}
      </div>
    </div>
  );
}

/* ───────── Calculator Accordion ───────── */
const calculators = [
  { key: "dti", title: "DTI Calculator", icon: "fa-solid fa-percent", Component: DtiCalc },
  { key: "piti", title: "PITI Payment Calculator", icon: "fa-solid fa-house", Component: PitiCalc },
  { key: "refi", title: "Refinance Break-Even", icon: "fa-solid fa-arrows-rotate", Component: RefiCalc },
];

function CalculatorAccordion({ openCalc, setOpenCalc }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {calculators.map(({ key, title, icon, Component }) => {
        const isOpen = openCalc === key;
        return (
          <div
            key={key}
            style={{
              background: C.card,
              border: `1px solid ${isOpen ? C.accent : C.border}`,
              borderRadius: 12,
              overflow: "hidden",
              transition: "border-color 0.2s",
            }}
          >
            <button
              onClick={() => setOpenCalc(isOpen ? null : key)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "16px 20px",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #2563EB, #3B82F6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFFFFF",
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                <i className={icon} />
              </div>
              <span style={{ flex: 1, fontWeight: 600, fontSize: 15, color: C.text }}>{title}</span>
              <i
                className="fa-solid fa-chevron-down"
                style={{
                  fontSize: 14,
                  color: C.dim,
                  transition: "transform 0.2s",
                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </button>
            {isOpen && (
              <div style={{ padding: "0 20px 20px" }}>
                <Component />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ───────── Document Checklist Card ───────── */
function DocCard({ title, items }) {
  return (
    <div style={{ ...baseCard, cursor: "default" }}>
      <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700, color: C.text }}>{title}</h3>
      <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item) => (
          <li key={item} style={{ fontSize: 14, color: C.muted, lineHeight: 1.5 }}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────── Main Page ───────── */
export default function ToolsPage() {
  const [openCalc, setOpenCalc] = useState(null);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 24px 60px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: C.text }}>Tools &amp; Resources</h1>
          <p style={{ margin: "6px 0 0", fontSize: 15, color: C.muted }}>
            Useful tools and resources to streamline your mortgage workflow
          </p>
        </div>

        {/* Sections 1-4: external link grids */}
        {sections.map((s) => (
          <ToolSection key={s.title} {...s} />
        ))}

        {/* Section 5: Quick Calculators */}
        <div style={{ marginBottom: 40 }}>
          <SectionHeader icon="fa-solid fa-calculator" title="Quick Calculators" />
          <CalculatorAccordion openCalc={openCalc} setOpenCalc={setOpenCalc} />
        </div>

        {/* Section 6: Document Checklists */}
        <div style={{ marginBottom: 40 }}>
          <SectionHeader icon="fa-solid fa-clipboard-check" title="Document Checklists" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <DocCard title="Purchase Loan Documents" items={purchaseDocs} />
            <DocCard title="Refinance Loan Documents" items={refiDocs} />
          </div>
        </div>

        {/* Section 7: Rate & Market Resources */}
        <ToolSection {...rateSection} />

        {/* Footer Disclaimer */}
        <p style={{ fontSize: 12, color: C.dim, textAlign: "center", marginTop: 20, lineHeight: 1.6 }}>
          All trademarks and brand names belong to their respective owners. External links are provided for
          convenience and do not imply endorsement. MtgBroker is not affiliated with any of the listed services.
        </p>
      </div>
    </div>
  );
}
