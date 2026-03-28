import { useState, useEffect, useCallback } from "react";
import { getUserEmail, getAccessToken, getUserPlan, isProUser } from "../../lib/auth";

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
  yellowBg: "#FEF9C3",
  yellowText: "#A16207",
  redBg: "#FEE2E2",
  redText: "#DC2626",
  blueBg: "#DBEAFE",
  blueText: "#2563EB",
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
  grid3: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 },
  grid2: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 },
  flexRow: { display: "flex", alignItems: "center", gap: 12 },
  mb16: { marginBottom: 16 },
  mb24: { marginBottom: 24 },
};

// ============================================================
// HELPERS
// ============================================================
function authHeaders() {
  const token = getAccessToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function cents(v) {
  const n = (v || 0) / 100;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtDate(iso) {
  if (!iso) return "—";
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
        <div style={{ ...s.grid3, marginTop: 20 }}>
          <div style={bar("100%", 80)} />
          <div style={bar("100%", 80)} />
          <div style={bar("100%", 80)} />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PLAN GATE
// ============================================================
function PlanGate() {
  return (
    <div style={{ ...s.card, textAlign: "center", padding: 48 }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: C.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px",
          color: C.dim,
          fontSize: 28,
        }}
      >
        <i className="fa-solid fa-gift" />
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: "0 0 8px" }}>PRO Plan Required</h2>
      <p style={{ fontSize: 14, color: C.muted, maxWidth: 420, margin: "0 auto 20px", lineHeight: 1.6 }}>
        The Referral Program is available exclusively for PRO plan members. Earn commissions by sharing
        MtgBroker with other loan officers — upgrade your plan to get started.
      </p>
      <a
        href="/pricing"
        style={{
          ...s.btnPrimary,
          textDecoration: "none",
          display: "inline-flex",
        }}
      >
        <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: 13 }} />
        View Plans &amp; Upgrade
      </a>
    </div>
  );
}

// ============================================================
// ENROLLMENT CARD
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

  const highlights = [
    { icon: "fa-solid fa-percent", label: "20% Commission" },
    { icon: "fa-solid fa-calendar-check", label: "Monthly Payouts" },
    { icon: "fa-solid fa-chart-line", label: "Real-time Tracking" },
  ];

  return (
    <div style={{ ...s.card, maxWidth: 600, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: C.blueBg,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: C.blue,
            fontSize: 24,
            marginBottom: 12,
          }}
        >
          <i className="fa-solid fa-gift" />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: "0 0 6px" }}>
          Join the Referral Program
        </h2>
        <p style={{ fontSize: 14, color: C.muted, margin: 0, lineHeight: 1.6 }}>
          Earn commissions by referring new members to MtgBroker. Share your unique link and earn rewards for every signup.
        </p>
      </div>

      {/* Reward highlights */}
      <div style={{ ...s.grid3, ...s.mb24 }}>
        {highlights.map((h) => (
          <div
            key={h.label}
            style={{
              ...s.cardCompact,
              textAlign: "center",
              background: C.bg,
            }}
          >
            <i className={h.icon} style={{ fontSize: 18, color: C.blue, marginBottom: 6, display: "block" }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{h.label}</span>
          </div>
        ))}
      </div>

      {/* Enrollment form */}
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
          disabled={submitting}
          style={{ ...s.btnPrimary, opacity: submitting ? 0.6 : 1, width: "100%", justifyContent: "center" }}
        >
          {submitting ? (
            <><i className="fa-solid fa-spinner fa-spin" /> Enrolling…</>
          ) : (
            <><i className="fa-solid fa-rocket" /> Enroll Now</>
          )}
        </button>
      </form>
    </div>
  );
}

// ============================================================
// STAT CARD
// ============================================================
function StatCard({ icon, value, label }) {
  return (
    <div style={s.cardCompact}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: C.blueBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: C.blue,
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
// REFERRAL LINK CARD
// ============================================================
function LinkCard({ link }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [link]);

  return (
    <div style={s.card}>
      <h3 style={{ ...s.sectionTitle, marginBottom: 12 }}>
        <i className="fa-solid fa-link" style={{ color: C.blue, marginRight: 8 }} />
        Your Referral Link
      </h3>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: "8px 12px",
        }}
      >
        <code style={{ flex: 1, fontSize: 13, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {link}
        </code>
        <button
          onClick={copy}
          style={{
            ...s.btnPrimary,
            padding: "6px 14px",
            fontSize: 13,
            flexShrink: 0,
            background: copied ? C.green : C.blue,
          }}
        >
          <i className={copied ? "fa-solid fa-check" : "fa-regular fa-copy"} />
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// EARNINGS CARDS
// ============================================================
function EarningsRow({ pending, due, paid }) {
  return (
    <div style={s.grid3}>
      <div style={{ ...s.cardCompact, borderLeft: `3px solid #F59E0B` }}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Pending</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{cents(pending)}</div>
      </div>
      <div style={{ ...s.cardCompact, borderLeft: `3px solid ${C.blue}` }}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Due</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{cents(due)}</div>
      </div>
      <div style={{ ...s.cardCompact, borderLeft: `3px solid ${C.green}` }}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Paid</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{cents(paid)}</div>
      </div>
    </div>
  );
}

// ============================================================
// PAYOUT SETUP
// ============================================================
function PayoutSetup({ initialData, onSaved }) {
  const [editing, setEditing] = useState(!initialData.payoutSetupComplete);
  const [form, setForm] = useState({
    paypalEmail: initialData.paypalEmail || "",
    legalName: initialData.legalName || "",
    payoutMethod: initialData.payoutMethod || "paypal",
    street: "",
    city: "",
    state: "",
    zip: "",
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

  if (!editing) {
    return (
      <div style={s.card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <i className="fa-solid fa-circle-check" style={{ color: C.green, fontSize: 20 }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: C.green }}>Payout info saved</span>
          </div>
          <button onClick={() => setEditing(true)} style={s.btnOutline}>
            <i className="fa-solid fa-pen" style={{ fontSize: 12 }} /> Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.card}>
      <h3 style={s.sectionTitle}>
        <i className="fa-solid fa-building-columns" style={{ color: C.blue, marginRight: 8 }} />
        Payout Setup
      </h3>
      <form onSubmit={save}>
        <div style={{ ...s.grid2, ...s.mb16 }}>
          <div>
            <label style={s.label}>PayPal Email</label>
            <input style={s.input} value={form.paypalEmail} onChange={set("paypalEmail")} placeholder="you@email.com" />
          </div>
          <div>
            <label style={s.label}>Legal Name</label>
            <input style={s.input} value={form.legalName} onChange={set("legalName")} placeholder="Full legal name" />
          </div>
        </div>

        <div style={s.mb16}>
          <label style={s.label}>Payout Method</label>
          <select style={s.select} value={form.payoutMethod} onChange={set("payoutMethod")}>
            <option value="paypal">PayPal</option>
            <option value="wise">Wise</option>
          </select>
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
          {saving ? <><i className="fa-solid fa-spinner fa-spin" /> Saving…</> : <><i className="fa-solid fa-floppy-disk" /> Save Payout Info</>}
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
      due: { background: C.blueBg, color: C.blueText },
      paid: { background: C.greenBg, color: C.green },
      voided: { background: C.redBg, color: C.redText },
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
            </tr>
          </thead>
          <tbody>
            {commissions.map((c) => (
              <tr key={c.id}>
                <td style={td}>{fmtDate(c.createdAt)}</td>
                <td style={{ ...td, fontWeight: 600 }}>{cents(c.amount)}</td>
                <td style={td}>
                  <span style={badgeStyle(c.state)}>{c.state}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// ENROLLED DASHBOARD
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

  const handlePayoutSaved = (data) => {
    setReferral((r) => ({ ...r, payoutSetupComplete: data.payoutSetupComplete ?? true }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Stats row */}
      <div style={s.grid3}>
        <StatCard icon="fa-solid fa-eye" value={referral.visitors ?? 0} label="Visitors" />
        <StatCard icon="fa-solid fa-user-plus" value={referral.leads ?? 0} label="Leads" />
        <StatCard icon="fa-solid fa-handshake" value={referral.conversions ?? 0} label="Conversions" />
      </div>

      {/* Referral Link */}
      <LinkCard link={referral.link} />

      {/* Earnings */}
      <div>
        <h3 style={s.sectionTitle}>
          <i className="fa-solid fa-coins" style={{ color: C.blue, marginRight: 8 }} />
          Earnings
        </h3>
        <EarningsRow
          pending={earnings.totalPendingCents}
          due={earnings.totalDueCents}
          paid={earnings.totalPaidCents}
        />
      </div>

      {/* Payout Setup */}
      <PayoutSetup initialData={referral} onSaved={handlePayoutSaved} />

      {/* Commission History */}
      {loadingCommissions ? (
        <div style={{ ...s.card, textAlign: "center", padding: 32 }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 20, color: C.dim }} />
        </div>
      ) : (
        <CommissionTable commissions={commissions} />
      )}
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
    });
  };

  return (
    <div style={s.page}>
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

      {/* Content */}
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
