import { useState, useEffect, useCallback } from "react";
import { getUserEmail, isProUser, getAccessToken } from "../../lib/auth";

const API_BASE = "https://mtg-broker-api.rich-e00.workers.dev";

export function meta() {
  return [{ title: "Referral Program — MtgBroker" }];
}

// ============================================================
// DESIGN TOKENS
// ============================================================
const C = {
  bg: "#F8FAFC",
  card: "#FFFFFF",
  border: "#E2E8F0",
  blue: "#2563EB",
  blueHover: "#1D4ED8",
  text: "#0F172A",
  muted: "#64748B",
  dim: "#94A3B8",
  green: "#16A34A",
  greenBg: "#DCFCE7",
  greenText: "#065F46",
  amber: "#D97706",
  amberBg: "#FEF3C7",
  amberText: "#92400E",
  yellowBg: "#FEF3C7",
  yellowText: "#92400E",
  redBg: "#FEF2F2",
  redText: "#991B1B",
  blueBg: "#DBEAFE",
  blueText: "#1E40AF",
  radius: 10,
};

const s = {
  page: { minHeight: "100%", fontFamily: "inherit" },
  heading: { fontSize: 24, fontWeight: 700, color: C.text, margin: 0 },
  subheading: { fontSize: 14, color: C.muted, margin: "4px 0 0" },
  card: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: C.radius,
    padding: 24,
  },
  cardCompact: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: C.radius,
    padding: 16,
  },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 },
  input: {
    width: "100%",
    padding: "10px 12px",
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    fontSize: 14,
    color: C.text,
    outline: "none",
    boxSizing: "border-box",
    background: C.bg,
  },
  select: {
    width: "100%",
    padding: "10px 12px",
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    fontSize: 14,
    color: C.text,
    outline: "none",
    boxSizing: "border-box",
    background: C.bg,
    appearance: "auto",
  },
  btnPrimary: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 20px",
    background: C.blue,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background .15s",
  },
  btnOutline: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 16px",
    background: "transparent",
    color: C.blue,
    border: `1px solid ${C.blue}`,
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: C.text, margin: "0 0 16px" },
  metricValue: { fontSize: 28, fontWeight: 700, color: C.text, margin: 0 },
  metricLabel: { fontSize: 12, color: C.muted, marginTop: 4 },
  grid4: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 },
  grid3: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 },
  grid2: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 },
  flexRow: { display: "flex", alignItems: "center", gap: 12 },
  mb16: { marginBottom: 16 },
  mb24: { marginBottom: 24 },
};

// Responsive grid: 4-col on wide, 2-col on narrow
const grid4Responsive = `
@media (max-width: 768px) {
  .ref-grid4 { grid-template-columns: repeat(2, 1fr) !important; }
}
`;

// ============================================================
// PROGRAM TERMS
// ============================================================
const PROGRAM_TERMS = [
  "Commission rate is 10% recurring for the lifetime of referred members",
  "Applies to PLUS ($4.90/mo) and PRO ($7.90/mo) subscriptions",
  "Minimum payout threshold is $25.00",
  "Commissions are held pending for 30 days before becoming payable",
  "Payouts processed monthly via PayPal or Wise",
  "Self-referrals do not qualify",
  "Spam, misleading claims, or brand misuse will result in termination",
  "MtgBroker reserves the right to modify program terms with 30-day notice",
  "By enrolling, you agree to these terms and conditions",
];

// ============================================================
// HELPERS
// ============================================================
function authHeaders() {
  const email = getUserEmail();
  return {
    Authorization: `Bearer ${email}`,
    "Content-Type": "application/json",
  };
}

function cents(v) {
  const n = (v || 0) / 100;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtDate(iso) {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ============================================================
// SKELETON
// ============================================================
function Skeleton() {
  const bar = (w, h = 16) => ({
    width: w,
    height: h,
    borderRadius: 6,
    background: C.border,
    animation: "pulse 1.5s ease-in-out infinite",
  });
  return (
    <div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{ ...s.card, ...s.mb24 }}>
        <div style={bar("40%", 20)} />
        <div style={{ ...bar("70%"), marginTop: 12 }} />
        <div style={{ ...s.grid4, marginTop: 20 }}>
          <div style={bar("100%", 80)} />
          <div style={bar("100%", 80)} />
          <div style={bar("100%", 80)} />
          <div style={bar("100%", 80)} />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// COMMISSION DETAILS CARD
// ============================================================
function CommissionDetailsCard() {
  const rows = [
    { label: "Commission Rate", value: "10% recurring" },
    { label: "PLUS Subscription", value: "$4.90/mo" },
    { label: "PRO Subscription", value: "$7.90/mo" },
    { label: "Minimum Payout", value: "$25.00" },
    { label: "Pending Period", value: "30 days" },
  ];
  return (
    <div style={s.card}>
      <h3 style={s.sectionTitle}>
        <i className="fa-solid fa-file-invoice-dollar" style={{ color: C.blue, marginRight: 8 }} />
        Commission Details
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, color: C.muted }}>{r.label}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// EARNINGS POTENTIAL CARD
// ============================================================
function EarningsPotentialCard() {
  const scenarios = [
    { referrals: "10 PRO referrals", monthly: "$79.00/mo", yearly: "$948.00/yr" },
    { referrals: "25 PRO referrals", monthly: "$197.50/mo", yearly: "$2,370.00/yr" },
  ];
  return (
    <div style={s.card}>
      <h3 style={s.sectionTitle}>
        <i className="fa-solid fa-chart-line" style={{ color: C.blue, marginRight: 8 }} />
        Earnings Potential
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {scenarios.map((sc) => (
          <div
            key={sc.referrals}
            style={{
              ...s.cardCompact,
              background: C.bg,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{sc.referrals}</span>
            <div style={{ display: "flex", gap: 16 }}>
              <span style={{ fontSize: 14, color: C.blue, fontWeight: 600 }}>{sc.monthly}</span>
              <span style={{ fontSize: 14, color: C.green, fontWeight: 600 }}>{sc.yearly}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// COLLAPSIBLE PROGRAM TERMS
// ============================================================
function CollapsibleTerms() {
  const [open, setOpen] = useState(false);
  return (
    <div style={s.card}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      >
        <h3 style={{ ...s.sectionTitle, margin: 0 }}>
          <i className="fa-solid fa-scale-balanced" style={{ color: C.blue, marginRight: 8 }} />
          Program Terms
        </h3>
        <i
          className={open ? "fa-solid fa-chevron-up" : "fa-solid fa-chevron-down"}
          style={{ fontSize: 14, color: C.muted }}
        />
      </button>
      {open && (
        <ol style={{ margin: "16px 0 0", paddingLeft: 20, fontSize: 13, color: C.muted, lineHeight: 1.8 }}>
          {PROGRAM_TERMS.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ============================================================
// STATE 1: LOCKED (non-PRO)
// ============================================================
function PlanGate() {
  const features = [
    { icon: "fa-solid fa-share-nodes", title: "Share Your Link", desc: "Get a unique referral link to share" },
    { icon: "fa-solid fa-user-plus", title: "They Sign Up", desc: "Friends join MtgBroker via your link" },
    { icon: "fa-solid fa-dollar-sign", title: "You Earn 10%", desc: "Earn recurring commissions monthly" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ ...s.card, textAlign: "center", padding: 48 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #2563EB, #3B82F6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
            color: "#fff",
            fontSize: 28,
          }}
        >
          <i className="fa-solid fa-lock" />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: "0 0 8px" }}>PRO Feature</h2>
        <p style={{ fontSize: 14, color: C.muted, maxWidth: 480, margin: "0 auto 24px", lineHeight: 1.7 }}>
          The MtgBroker Referral Program is available exclusively to PRO plan members.
          Upgrade to start earning commissions.
        </p>
        <a
          href="/pricing"
          style={{
            ...s.btnPrimary,
            textDecoration: "none",
            display: "inline-flex",
            padding: "12px 28px",
            fontSize: 15,
          }}
        >
          <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: 13 }} />
          Upgrade to PRO
        </a>
      </div>

      {/* What you'll get */}
      <div style={s.card}>
        <h3 style={s.sectionTitle}>What you'll get</h3>
        <div style={s.grid3}>
          {features.map((f) => (
            <div
              key={f.title}
              style={{
                ...s.cardCompact,
                background: C.bg,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: C.blueBg,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: C.blue,
                  fontSize: 18,
                  marginBottom: 10,
                }}
              >
                <i className={f.icon} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>{f.title}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// STATE 2: ENROLLMENT
// ============================================================
function EnrollmentCard({ onEnrolled }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [terms, setTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) { setError("Please enter your full name."); return; }
    if (!terms) { setError("You must agree to the program terms."); return; }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/referral/enroll`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), termsAccepted: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Enrollment failed");
      onEnrolled(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const howItWorks = [
    { icon: "fa-solid fa-share-nodes", title: "Share Your Link", desc: "Get a unique referral link to share with colleagues" },
    { icon: "fa-solid fa-user-plus", title: "They Sign Up", desc: "Friends join MtgBroker through your link" },
    { icon: "fa-solid fa-dollar-sign", title: "You Earn 10%", desc: "Earn 10% recurring commissions on their subscription" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ ...s.card, textAlign: "center" }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: "0 0 6px" }}>
          Join the Referral Program
        </h2>
        <p style={{ fontSize: 14, color: C.muted, margin: 0, lineHeight: 1.6 }}>
          Earn commissions by referring new members to MtgBroker.
        </p>
      </div>

      {/* How It Works */}
      <div>
        <h3 style={s.sectionTitle}>How It Works</h3>
        <div style={s.grid3}>
          {howItWorks.map((h, i) => (
            <div
              key={h.title}
              style={{
                ...s.card,
                textAlign: "center",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 12,
                  left: 12,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: C.blueBg,
                  color: C.blue,
                  fontSize: 12,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {i + 1}
              </div>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: C.blueBg,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: C.blue,
                  fontSize: 20,
                  marginBottom: 12,
                }}
              >
                <i className={h.icon} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>{h.title}</div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{h.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Terms */}
      <div style={s.card}>
        <h3 style={s.sectionTitle}>
          <i className="fa-solid fa-scale-balanced" style={{ color: C.blue, marginRight: 8 }} />
          Program Terms
        </h3>
        <div
          style={{
            maxHeight: 200,
            overflowY: "auto",
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 16,
          }}
        >
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: C.muted, lineHeight: 1.9 }}>
            {PROGRAM_TERMS.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>
        </div>
      </div>

      {/* Enrollment Form */}
      <div style={{ ...s.card, maxWidth: 600 }}>
        <h3 style={s.sectionTitle}>
          <i className="fa-solid fa-rocket" style={{ color: C.blue, marginRight: 8 }} />
          Enroll Now
        </h3>
        <form onSubmit={submit}>
          <div style={{ ...s.grid2, ...s.mb16 }}>
            <div>
              <label style={s.label}>First Name</label>
              <input
                style={s.input}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
              />
            </div>
            <div>
              <label style={s.label}>Last Name</label>
              <input
                style={s.input}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Smith"
              />
            </div>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: C.muted,
              marginBottom: 20,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: C.blue }}
            />
            I agree to the program terms
          </label>

          {error && (
            <p style={{ fontSize: 13, color: C.redText, margin: "0 0 12px" }}>
              <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 6 }} />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !terms}
            style={{
              ...s.btnPrimary,
              opacity: (submitting || !terms) ? 0.5 : 1,
              cursor: (submitting || !terms) ? "not-allowed" : "pointer",
              width: "100%",
              justifyContent: "center",
            }}
          >
            {submitting ? (
              <><i className="fa-solid fa-spinner fa-spin" /> Enrolling...</>
            ) : (
              <><i className="fa-solid fa-rocket" /> Join the Program</>
            )}
          </button>
        </form>
      </div>

      {/* Commission Details + Earnings Potential */}
      <div style={s.grid2}>
        <CommissionDetailsCard />
        <EarningsPotentialCard />
      </div>
    </div>
  );
}

// ============================================================
// STAT CARD (Dashboard)
// ============================================================
function StatCard({ icon, value, label, iconBg, iconColor }) {
  return (
    <div style={s.cardCompact}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: iconBg || C.blueBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: iconColor || C.blue,
            fontSize: 15,
          }}
        >
          <i className={icon} />
        </div>
        <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>{label}</span>
      </div>
      <div style={s.metricValue}>{value}</div>
    </div>
  );
}

// ============================================================
// REFERRAL LINK CARD (dark gradient)
// ============================================================
function LinkCard({ link }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [link]);

  const encodedLink = encodeURIComponent(link);
  const shareText = encodeURIComponent("Check out MtgBroker - the ultimate toolkit for mortgage loan officers!");
  const emailSubject = encodeURIComponent("Check out MtgBroker");
  const emailBody = encodeURIComponent(`Hey, I've been using MtgBroker and thought you'd find it useful. Sign up here: ${link}`);

  const shareLinks = [
    { icon: "fa-solid fa-envelope", label: "Email", href: `mailto:?subject=${emailSubject}&body=${emailBody}`, color: "#64748B" },
    { icon: "fa-brands fa-linkedin", label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedLink}`, color: "#0A66C2" },
    { icon: "fa-brands fa-x-twitter", label: "X", href: `https://twitter.com/intent/tweet?url=${encodedLink}&text=${shareText}`, color: "#0F172A" },
    { icon: "fa-brands fa-facebook", label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodedLink}`, color: "#1877F2" },
  ];

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #0F172A, #1E293B)",
        borderRadius: C.radius,
        padding: 24,
      }}
    >
      <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: "0 0 16px" }}>
        <i className="fa-solid fa-link" style={{ marginRight: 8 }} />
        Your Referral Link
      </h3>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 16,
        }}
      >
        <code style={{ flex: 1, fontSize: 13, color: "#E2E8F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {link}
        </code>
        <button
          onClick={copy}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            background: copied ? C.green : C.blue,
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            flexShrink: 0,
            transition: "background .15s",
          }}
        >
          <i className={copied ? "fa-solid fa-check" : "fa-regular fa-copy"} />
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* Share buttons */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {shareLinks.map((sl) => (
          <a
            key={sl.label}
            href={sl.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 6,
              color: "#E2E8F0",
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
              transition: "background .15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
          >
            <i className={sl.icon} />
            {sl.label}
          </a>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// PAYOUT ACCOUNT CARD
// ============================================================
function PayoutSetup({ initialData, onSaved }) {
  const [editing, setEditing] = useState(!initialData.payoutSetupComplete);
  const [form, setForm] = useState({
    paypalEmail: initialData.paypalEmail || "",
    legalName: initialData.legalName || "",
    payoutMethod: initialData.payoutMethod || "paypal",
    street: initialData.legalAddress?.street || "",
    city: initialData.legalAddress?.city || "",
    state: initialData.legalAddress?.state || "",
    zip: initialData.legalAddress?.zip || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    if (!form.paypalEmail || !form.legalName) { setError("Email and legal name are required."); return; }
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/referral/payout-setup`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      onSaved(data);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Summary view when payout is set up
  if (!editing && initialData.payoutSetupComplete) {
    return (
      <div style={s.card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ ...s.sectionTitle, margin: 0 }}>
            <i className="fa-solid fa-building-columns" style={{ color: C.blue, marginRight: 8 }} />
            Payout Account
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 12px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                background: C.greenBg,
                color: C.greenText,
              }}
            >
              <i className="fa-solid fa-circle-check" style={{ fontSize: 11 }} />
              Active
            </span>
            <button onClick={() => setEditing(true)} style={s.btnOutline}>
              <i className="fa-solid fa-pen" style={{ fontSize: 12 }} /> Edit
            </button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>Method</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, textTransform: "capitalize" }}>{initialData.payoutMethod || "PayPal"}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>Email</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{initialData.paypalEmail || "\u2014"}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>Legal Name</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{initialData.legalName || "\u2014"}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>Address</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
              {initialData.legalAddress
                ? `${initialData.legalAddress.street || ""}, ${initialData.legalAddress.city || ""}, ${initialData.legalAddress.state || ""} ${initialData.legalAddress.zip || ""}`.replace(/^, |, $/g, "")
                : "\u2014"}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Form view
  return (
    <div style={s.card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h3 style={{ ...s.sectionTitle, margin: 0 }}>
          <i className="fa-solid fa-building-columns" style={{ color: C.blue, marginRight: 8 }} />
          Payout Account
        </h3>
        {!initialData.payoutSetupComplete && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 12px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              background: C.amberBg,
              color: C.amberText,
            }}
          >
            <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 11 }} />
            Setup Required
          </span>
        )}
      </div>

      {!initialData.payoutSetupComplete && (
        <p style={{ fontSize: 13, color: C.muted, margin: "0 0 16px", lineHeight: 1.6 }}>
          Set up your payout account to receive commission payments. You must complete this before any payouts can be processed.
        </p>
      )}

      <form onSubmit={save}>
        {/* Payout method radio */}
        <div style={s.mb16}>
          <label style={s.label}>Payout Method</label>
          <div style={{ display: "flex", gap: 12 }}>
            {["paypal", "wise"].map((m) => (
              <label
                key={m}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: `1px solid ${form.payoutMethod === m ? C.blue : C.border}`,
                  background: form.payoutMethod === m ? C.blueBg : C.card,
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 500,
                  color: form.payoutMethod === m ? C.blue : C.text,
                  transition: "all .15s",
                }}
              >
                <input
                  type="radio"
                  name="payoutMethod"
                  value={m}
                  checked={form.payoutMethod === m}
                  onChange={set("payoutMethod")}
                  style={{ accentColor: C.blue }}
                />
                {m === "paypal" ? "PayPal" : "Wise"}
              </label>
            ))}
          </div>
        </div>

        <div style={{ ...s.grid2, ...s.mb16 }}>
          <div>
            <label style={s.label}>{form.payoutMethod === "paypal" ? "PayPal Email" : "Wise Email"}</label>
            <input style={s.input} value={form.paypalEmail} onChange={set("paypalEmail")} placeholder="you@email.com" />
          </div>
          <div>
            <label style={s.label}>Legal Name</label>
            <input style={s.input} value={form.legalName} onChange={set("legalName")} placeholder="Full legal name" />
          </div>
        </div>

        <div style={s.mb16}>
          <label style={s.label}>Street Address</label>
          <input style={s.input} value={form.street} onChange={set("street")} placeholder="123 Main St" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 16, ...s.mb16 }}>
          <div>
            <label style={s.label}>City</label>
            <input style={s.input} value={form.city} onChange={set("city")} placeholder="City" />
          </div>
          <div>
            <label style={s.label}>State</label>
            <input style={s.input} value={form.state} onChange={set("state")} placeholder="CA" />
          </div>
          <div>
            <label style={s.label}>Zip</label>
            <input style={s.input} value={form.zip} onChange={set("zip")} placeholder="90210" />
          </div>
        </div>

        {error && (
          <p style={{ fontSize: 13, color: C.redText, margin: "0 0 12px" }}>
            <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 6 }} />
            {error}
          </p>
        )}

        <button type="submit" disabled={saving} style={{ ...s.btnPrimary, opacity: saving ? 0.6 : 1 }}>
          {saving ? <><i className="fa-solid fa-spinner fa-spin" /> Saving...</> : <><i className="fa-solid fa-floppy-disk" /> Save Payout Info</>}
        </button>
      </form>
    </div>
  );
}

// ============================================================
// COMMISSION HISTORY TABLE
// ============================================================
function CommissionTable({ commissions }) {
  const badgeStyle = (state) => {
    const map = {
      pending: { background: C.yellowBg, color: C.yellowText },
      due: { background: "#DBEAFE", color: "#1E40AF" },
      paid: { background: "#DCFCE7", color: "#065F46" },
      voided: { background: "#FEF2F2", color: "#991B1B" },
    };
    return {
      ...(map[state] || map.pending),
      padding: "3px 10px",
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 600,
      textTransform: "capitalize",
      display: "inline-block",
    };
  };

  if (!commissions || commissions.length === 0) {
    return (
      <div style={{ ...s.card, textAlign: "center", padding: 32 }}>
        <i className="fa-solid fa-receipt" style={{ fontSize: 28, color: C.dim, marginBottom: 8, display: "block" }} />
        <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>No commissions yet. Share your link to start earning!</p>
      </div>
    );
  }

  const th = {
    textAlign: "left",
    padding: "10px 14px",
    fontSize: 12,
    fontWeight: 600,
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    borderBottom: `2px solid ${C.border}`,
  };
  const td = {
    padding: "12px 14px",
    fontSize: 14,
    color: C.text,
    borderBottom: `1px solid ${C.border}`,
  };

  return (
    <div style={s.card}>
      <h3 style={s.sectionTitle}>
        <i className="fa-solid fa-clock-rotate-left" style={{ color: C.blue, marginRight: 8 }} />
        Commission History
      </h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Date</th>
              <th style={th}>Amount</th>
              <th style={th}>Status</th>
              <th style={th}>Paid Date</th>
            </tr>
          </thead>
          <tbody>
            {commissions.map((c, i) => (
              <tr key={c.id || i}>
                <td style={td}>{fmtDate(c.createdAt)}</td>
                <td style={{ ...td, fontWeight: 600 }}>{cents(c.amount)}</td>
                <td style={td}>
                  <span style={badgeStyle(c.state)}>{c.state}</span>
                </td>
                <td style={td}>{fmtDate(c.paidAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// STATE 3: ENROLLED DASHBOARD
// ============================================================
function Dashboard({ referral, setReferral }) {
  const [commissions, setCommissions] = useState([]);
  const [earnings, setEarnings] = useState({ totalPendingCents: 0, totalDueCents: 0, totalPaidCents: 0 });
  const [loadingCommissions, setLoadingCommissions] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/referral/commissions`, { headers: authHeaders() });
        if (res.ok) {
          const data = await res.json();
          setCommissions(data.commissions || []);
          setEarnings({
            totalPendingCents: data.totalPendingCents || 0,
            totalDueCents: data.totalDueCents || 0,
            totalPaidCents: data.totalPaidCents || 0,
          });
        }
      } catch (_) {
        /* silent */
      } finally {
        setLoadingCommissions(false);
      }
    })();
  }, []);

  const totalEarnedCents = (earnings.totalPaidCents + earnings.totalDueCents + earnings.totalPendingCents);

  const handlePayoutSaved = (data) => {
    setReferral((r) => ({ ...r, payoutSetupComplete: data.payoutSetupComplete ?? true }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <style>{grid4Responsive}</style>

      {/* Stats Grid - 4 cards */}
      <div className="ref-grid4" style={s.grid4}>
        <StatCard icon="fa-solid fa-eye" value={referral.visitors ?? 0} label="Visitors" iconBg={C.blueBg} iconColor={C.blue} />
        <StatCard icon="fa-solid fa-user-plus" value={referral.leads ?? 0} label="Leads" iconBg={C.blueBg} iconColor={C.blue} />
        <StatCard icon="fa-solid fa-handshake" value={referral.conversions ?? 0} label="Conversions" iconBg="#FEF3C7" iconColor="#D97706" />
        <StatCard icon="fa-solid fa-dollar-sign" value={cents(totalEarnedCents)} label="Total Earned" iconBg={C.greenBg} iconColor={C.green} />
      </div>

      {/* Referral Link */}
      <LinkCard link={referral.link} />

      {/* Payout Account */}
      <PayoutSetup initialData={referral} onSaved={handlePayoutSaved} />

      {/* Commission History */}
      {loadingCommissions ? (
        <div style={{ ...s.card, textAlign: "center", padding: 32 }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 20, color: C.dim }} />
        </div>
      ) : (
        <CommissionTable commissions={commissions} />
      )}

      {/* Collapsible Program Terms */}
      <CollapsibleTerms />

      {/* Commission Details + Earnings Potential at bottom */}
      <div style={s.grid2}>
        <CommissionDetailsCard />
        <EarningsPotentialCard />
      </div>
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function ReferralPage() {
  const [pro, setPro] = useState(null); // null = loading plan
  const [loading, setLoading] = useState(true);
  const [referral, setReferral] = useState(null);

  useEffect(() => {
    const userIsPro = isProUser();
    setPro(userIsPro);

    if (!userIsPro) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/referral`, { headers: authHeaders() });
        if (res.ok) {
          const data = await res.json();
          setReferral(data);
        }
      } catch (_) {
        /* silent */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleEnrolled = (data) => {
    setReferral({
      enrolled: true,
      affiliateId: data.affiliateId,
      link: data.link,
      visitors: 0,
      leads: 0,
      conversions: 0,
      termsAccepted: true,
      payoutSetupComplete: false,
      paypalEmail: null,
      legalName: null,
      payoutMethod: null,
      legalAddress: null,
    });
  };

  return (
    <div style={s.page}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 32 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: C.blueBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: C.blue,
            fontSize: 22,
            flexShrink: 0,
          }}
        >
          <i className="fa-solid fa-gift" />
        </div>
        <div>
          <h1 style={s.heading}>Referral Program</h1>
          <p style={s.subheading}>Earn rewards by referring other loan officers to MtgBroker.</p>
          {pro && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 12px",
                marginTop: 8,
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                color: "#fff",
                background: "linear-gradient(135deg, #1a56db, #6366f1)",
              }}
            >
              PRO
            </span>
          )}
        </div>
      </div>

      {/* Content based on state */}
      {pro === false && <PlanGate />}
      {pro && loading && <Skeleton />}
      {pro && !loading && referral && !referral.enrolled && <EnrollmentCard onEnrolled={handleEnrolled} />}
      {pro && !loading && referral && referral.enrolled && <Dashboard referral={referral} setReferral={setReferral} />}
      {pro && !loading && !referral && (
        <div style={{ ...s.card, textAlign: "center", padding: 32 }}>
          <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>Unable to load referral data. Please try again later.</p>
        </div>
      )}
    </div>
  );
}
