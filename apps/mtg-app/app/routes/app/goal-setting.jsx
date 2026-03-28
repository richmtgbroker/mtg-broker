import { useState, useEffect, useCallback } from "react";
import { getUserEmail } from "../../lib/auth";

export function meta() {
  return [{ title: "Goal Setting — MtgBroker" }];
}

const API_BASE = "https://mtg-broker-api.rich-e00.workers.dev/api/goal-plan";

function fmtCurrency(n) {
  if (n == null || isNaN(n)) return "$0";
  return "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function parseCurrency(str) {
  if (!str) return 0;
  var cleaned = str.replace(/[^0-9.]/g, "");
  var val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

/* ── Styles ─────────────────────────────────────────────── */

const styles = {
  page: { maxWidth: 900, margin: "0 auto" },
  header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 32 },
  title: { fontSize: 24, fontWeight: 700, color: "#0F172A", margin: 0 },
  card: {
    background: "#fff",
    border: "1px solid #E2E8F0",
    borderRadius: 10,
    padding: 24,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: 16,
    marginTop: 0,
  },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#0F172A", marginBottom: 6 },
  input: {
    width: "100%",
    padding: "10px 12px",
    fontSize: 15,
    border: "1px solid #E2E8F0",
    borderRadius: 8,
    outline: "none",
    color: "#0F172A",
    background: "#F8FAFC",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    fontSize: 15,
    border: "1px solid #E2E8F0",
    borderRadius: 8,
    outline: "none",
    color: "#0F172A",
    background: "#F8FAFC",
    boxSizing: "border-box",
    minHeight: 100,
    resize: "vertical",
    fontFamily: "inherit",
  },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  metricCard: {
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 10,
    padding: 16,
    textAlign: "center",
  },
  metricValue: { fontSize: 22, fontWeight: 700, color: "#2563EB", marginBottom: 4 },
  metricLabel: { fontSize: 12, color: "#64748B" },
  btn: {
    width: "100%",
    padding: "12px 0",
    fontSize: 15,
    fontWeight: 600,
    color: "#fff",
    background: "#2563EB",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },
  btnDisabled: {
    width: "100%",
    padding: "12px 0",
    fontSize: 15,
    fontWeight: 600,
    color: "#fff",
    background: "#93B4F5",
    border: "none",
    borderRadius: 8,
    cursor: "not-allowed",
  },
  loginCard: {
    background: "#fff",
    border: "1px solid #E2E8F0",
    borderRadius: 10,
    padding: "48px 32px",
    textAlign: "center",
  },
  toast: {
    position: "fixed",
    bottom: 24,
    right: 24,
    background: "#0F172A",
    color: "#fff",
    padding: "10px 20px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    zIndex: 9999,
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  },
  skeleton: {
    background: "linear-gradient(90deg, #E2E8F0 25%, #F1F5F9 50%, #E2E8F0 75%)",
    backgroundSize: "200% 100%",
    borderRadius: 8,
    animation: "shimmer 1.5s infinite",
  },
};

/* ── Component ──────────────────────────────────────────── */

export default function GoalSettingPage() {
  const [email, setEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);
  const [planId, setPlanId] = useState(null);

  // Form fields
  const [annualTarget, setAnnualTarget] = useState("");
  const [avgLoanSize, setAvgLoanSize] = useState("");
  const [avgBps, setAvgBps] = useState("");
  const [notes, setNotes] = useState("");

  // Derived calculations
  var annualNum = parseCurrency(annualTarget);
  var loanNum = parseCurrency(avgLoanSize);
  var bpsNum = parseFloat(avgBps) || 0;
  var monthlyTarget = annualNum / 12;
  var unitsPerMonth = loanNum > 0 ? monthlyTarget / loanNum : 0;
  var monthlyIncome = monthlyTarget * (bpsNum / 10000);

  // Load plan on mount
  useEffect(function () {
    var userEmail = getUserEmail();
    setEmail(userEmail);
    if (!userEmail) {
      setLoading(false);
      return;
    }
    fetch(API_BASE, {
      headers: { Authorization: "Bearer " + userEmail },
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.plan && data.plan.data) {
          var d = data.plan.data;
          setPlanId(data.plan.id);
          if (d.annualTarget) setAnnualTarget(fmtCurrency(d.annualTarget));
          if (d.avgLoanSize) setAvgLoanSize(fmtCurrency(d.avgLoanSize));
          if (d.avgBps) setAvgBps(String(d.avgBps));
          if (d.notes) setNotes(d.notes);
        }
      })
      .catch(function () { /* silent */ })
      .finally(function () { setLoading(false); });
  }, []);

  // Save handler
  var handleSave = useCallback(
    async function () {
      if (!email) return;
      setSaving(true);
      var planData = {
        annualTarget: annualNum,
        monthlyTarget: monthlyTarget,
        avgLoanSize: loanNum,
        unitsPerMonth: unitsPerMonth,
        avgBps: bpsNum,
        monthlyIncome: monthlyIncome,
        notes: notes,
      };
      try {
        var url = planId ? API_BASE + "/" + planId : API_BASE;
        var method = planId ? "PUT" : "POST";
        var resp = await fetch(url, {
          method: method,
          headers: {
            Authorization: "Bearer " + email,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ planData: planData }),
        });
        var data = await resp.json();
        if (data.plan && data.plan.id) {
          setPlanId(data.plan.id);
        }
        setToast(true);
        setTimeout(function () { setToast(false); }, 2500);
      } catch (e) {
        alert("Failed to save. Please try again.");
      } finally {
        setSaving(false);
      }
    },
    [email, annualNum, loanNum, bpsNum, monthlyTarget, unitsPerMonth, monthlyIncome, notes, planId]
  );

  // Currency input handler — formats as user types
  function handleCurrencyChange(setter) {
    return function (e) {
      var raw = e.target.value.replace(/[^0-9]/g, "");
      if (!raw) { setter(""); return; }
      setter("$" + Number(raw).toLocaleString("en-US"));
    };
  }

  /* ── Login prompt ──────────────────────────── */

  if (!loading && !email) {
    return (
      <div style={styles.page}>
        <div style={styles.header}>
          <i className="fa-solid fa-bullseye" style={{ fontSize: 24, color: "#2563EB" }} />
          <h1 style={styles.title}>Goal Setting</h1>
        </div>
        <div style={styles.loginCard}>
          <i className="fa-solid fa-lock" style={{ fontSize: 36, color: "#94A3B8", marginBottom: 16, display: "block" }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: "0 0 8px" }}>
            Sign in to set goals
          </h2>
          <p style={{ fontSize: 14, color: "#64748B", margin: 0 }}>
            Please log in to create and track your production goals.
          </p>
        </div>
      </div>
    );
  }

  /* ── Loading skeleton ──────────────────────── */

  if (loading) {
    return (
      <div style={styles.page}>
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        <div style={styles.header}>
          <i className="fa-solid fa-bullseye" style={{ fontSize: 24, color: "#2563EB" }} />
          <h1 style={styles.title}>Goal Setting</h1>
        </div>
        <div style={styles.card}>
          <div style={{ ...styles.skeleton, height: 20, width: 140, marginBottom: 20 }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ ...styles.skeleton, height: 44 }} />
            <div style={{ ...styles.skeleton, height: 44 }} />
          </div>
        </div>
        <div style={styles.card}>
          <div style={{ ...styles.skeleton, height: 20, width: 180, marginBottom: 20 }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <div style={{ ...styles.skeleton, height: 72 }} />
            <div style={{ ...styles.skeleton, height: 72 }} />
            <div style={{ ...styles.skeleton, height: 72 }} />
          </div>
        </div>
      </div>
    );
  }

  /* ── Main form ─────────────────────────────── */

  return (
    <div style={styles.page}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      <div style={styles.header}>
        <i className="fa-solid fa-bullseye" style={{ fontSize: 24, color: "#2563EB" }} />
        <h1 style={styles.title}>Goal Setting</h1>
      </div>

      {/* Production Goals */}
      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>Production Goals</h3>
        <div style={styles.row}>
          <div>
            <label style={styles.label}>Annual Volume Target</label>
            <input
              type="text"
              inputMode="numeric"
              style={styles.input}
              placeholder="$0"
              value={annualTarget}
              onChange={handleCurrencyChange(setAnnualTarget)}
            />
          </div>
          <div>
            <label style={styles.label}>Average Loan Size</label>
            <input
              type="text"
              inputMode="numeric"
              style={styles.input}
              placeholder="$0"
              value={avgLoanSize}
              onChange={handleCurrencyChange(setAvgLoanSize)}
            />
          </div>
        </div>
      </div>

      {/* Calculated Metrics */}
      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>Calculated Metrics</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <div style={styles.metricCard}>
            <div style={styles.metricValue}>{fmtCurrency(monthlyTarget)}</div>
            <div style={styles.metricLabel}>Monthly Volume</div>
          </div>
          <div style={styles.metricCard}>
            <div style={styles.metricValue}>
              {unitsPerMonth ? unitsPerMonth.toFixed(1) : "0"}
            </div>
            <div style={styles.metricLabel}>Units / Month</div>
          </div>
          <div style={styles.metricCard}>
            <div style={styles.metricValue}>{fmtCurrency(monthlyIncome)}</div>
            <div style={styles.metricLabel}>Monthly Income</div>
          </div>
        </div>
      </div>

      {/* Compensation */}
      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>Compensation</h3>
        <div style={{ maxWidth: 240 }}>
          <label style={styles.label}>Average BPS</label>
          <input
            type="number"
            style={styles.input}
            placeholder="0"
            value={avgBps}
            onChange={function (e) { setAvgBps(e.target.value); }}
          />
        </div>
      </div>

      {/* Strategy Notes */}
      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>Strategy Notes</h3>
        <textarea
          style={styles.textarea}
          placeholder="Add your goals, strategies, and action plans..."
          value={notes}
          onChange={function (e) { setNotes(e.target.value); }}
        />
      </div>

      {/* Save button */}
      <button
        style={saving ? styles.btnDisabled : styles.btn}
        disabled={saving}
        onClick={handleSave}
      >
        {saving ? "Saving..." : "Save Goals"}
      </button>

      {/* Toast */}
      {toast && (
        <div style={styles.toast}>
          <i className="fa-solid fa-check" style={{ marginRight: 8 }} />
          Saved!
        </div>
      )}
    </div>
  );
}
