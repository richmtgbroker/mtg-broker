import { useState, useEffect, useCallback, useRef } from "react";
import { getUserEmail, getAccessToken } from "../../lib/auth";

export function meta() {
  return [{ title: "Goal Setting — MtgBroker" }];
}

const API_BASE = "https://mtg-broker-api.rich-e00.workers.dev";

const FIELDS = [
  "planYear","loName","grossIncome","avgLoanAmt","avgBps","conversionRatio",
  "bizDevPercent","oneGoal","strategy1","strategy2","strategy3",
  "s1t1","s1t2","s1t3","s1t4","s1t5",
  "s2t1","s2t2","s2t3","s2t4","s2t5",
  "s3t1","s3t2","s3t3","s3t4","s3t5",
  "notesField"
];

function buildEmpty() {
  var obj = {};
  FIELDS.forEach(function (k) { obj[k] = ""; });
  obj.planYear = String(new Date().getFullYear());
  return obj;
}

/* ── Formatting helpers ─────────────────────────────── */

function fmtCurrency(n) {
  if (n == null || isNaN(n)) return "$0";
  return "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function parseCurrency(str) {
  if (!str) return 0;
  var cleaned = String(str).replace(/[^0-9.]/g, "");
  var val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

function formatCurrencyInput(raw) {
  var num = parseCurrency(raw);
  if (num === 0 && !raw) return "";
  return num.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtNum(n, decimals) {
  if (n == null || isNaN(n)) return "0";
  return Number(n).toLocaleString("en-US", {
    minimumFractionDigits: decimals || 0,
    maximumFractionDigits: decimals || 0,
  });
}

/* ── Styles ─────────────────────────────────────────── */

var colors = {
  bg: "#F8FAFC",
  white: "#FFFFFF",
  border: "#E2E8F0",
  blue: "#2563EB",
  text: "#0F172A",
  muted: "#64748B",
  dim: "#94A3B8",
  highlightBg: "#EFF6FF",
  resultBg: "#F1F5F9",
};

var cardStyle = {
  background: colors.white,
  border: "1px solid " + colors.border,
  borderRadius: 16,
  padding: 24,
  marginBottom: 24,
};

var inputBase = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid " + colors.border,
  borderRadius: 8,
  fontSize: 14,
  color: colors.text,
  outline: "none",
  boxSizing: "border-box",
  background: colors.white,
};

var labelStyle = {
  fontSize: 14,
  fontWeight: 600,
  color: colors.text,
  marginBottom: 4,
  display: "block",
};

var sectionTitle = {
  fontSize: 20,
  fontWeight: 700,
  color: colors.text,
  margin: 0,
  display: "flex",
  alignItems: "center",
  gap: 10,
};

var printBtn = {
  padding: "6px 14px",
  fontSize: 13,
  fontWeight: 600,
  color: colors.blue,
  background: "transparent",
  border: "1px solid " + colors.blue,
  borderRadius: 8,
  cursor: "pointer",
};

/* ── Component ──────────────────────────────────────── */

export default function GoalSetting() {
  var [formData, setFormData] = useState(buildEmpty);
  var [recId, setRecId] = useState(null);
  var [saveStatus, setSaveStatus] = useState("loading");
  var [loading, setLoading] = useState(true);
  var emailRef = useRef(null);
  var debounceRef = useRef(null);
  var recIdRef = useRef(null);

  // Keep recIdRef in sync
  useEffect(function () { recIdRef.current = recId; }, [recId]);

  /* ── Fetch on mount ───────────────────────────────── */
  useEffect(function () {
    var email = getUserEmail();
    emailRef.current = email;
    if (!email) { setLoading(false); setSaveStatus("ready"); return; }

    fetch(API_BASE + "/api/goal-plan", {
      headers: { Authorization: "Bearer " + getAccessToken() },
    })
      .then(function (r) { return r.json(); })
      .then(function (json) {
        if (json.plan && json.plan.data) {
          var merged = buildEmpty();
          Object.keys(json.plan.data).forEach(function (k) {
            if (k in merged) merged[k] = json.plan.data[k] || "";
          });
          setFormData(merged);
          setRecId(json.plan.id);
          recIdRef.current = json.plan.id;
        }
        setSaveStatus("ready");
      })
      .catch(function () { setSaveStatus("error"); })
      .finally(function () { setLoading(false); });
  }, []);

  /* ── Save function ────────────────────────────────── */
  var save = useCallback(function (data) {
    var email = emailRef.current;
    if (!email) return;
    setSaveStatus("saving");

    var id = recIdRef.current;
    var url = id ? API_BASE + "/api/goal-plan/" + id : API_BASE + "/api/goal-plan";
    var method = id ? "PUT" : "POST";

    fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + getAccessToken(),
      },
      body: JSON.stringify({ planData: data }),
    })
      .then(function (r) { return r.json(); })
      .then(function (json) {
        if (json.plan && json.plan.id) {
          setRecId(json.plan.id);
          recIdRef.current = json.plan.id;
        }
        setSaveStatus("saved");
      })
      .catch(function () { setSaveStatus("error"); });
  }, []);

  /* ── Debounced auto-save ──────────────────────────── */
  var schedSave = useCallback(function (newData) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(function () { save(newData); }, 2000);
  }, [save]);

  function onChange(field, value) {
    setFormData(function (prev) {
      var next = Object.assign({}, prev);
      next[field] = value;
      schedSave(next);
      return next;
    });
  }

  function onCurrencyChange(field, raw) {
    var formatted = formatCurrencyInput(raw);
    onChange(field, formatted);
  }

  /* ── Reset ────────────────────────────────────────── */
  function resetAll() {
    if (!window.confirm("Reset all goal-setting data? This cannot be undone.")) return;
    var empty = buildEmpty();
    setFormData(empty);
    save(empty);
  }

  /* ── Print section ────────────────────────────────── */
  function printSection(sectionId) {
    var el = document.getElementById(sectionId);
    if (!el) return;
    var w = window.open("", "_blank");
    w.document.write(
      "<html><head><title>Print</title><style>body{font-family:system-ui,sans-serif;padding:24px;color:#0F172A}*{box-sizing:border-box}</style></head><body>" +
      el.innerHTML +
      "</body></html>"
    );
    w.document.close();
    w.print();
  }

  /* ── Calculations ─────────────────────────────────── */
  var grossIncome = parseCurrency(formData.grossIncome);
  var avgLoanAmt = parseCurrency(formData.avgLoanAmt);
  var avgBps = parseFloat(formData.avgBps) || 0;
  var conversionRatio = parseFloat(formData.conversionRatio) || 0;
  var bizDevPercent = parseFloat(formData.bizDevPercent) || 0;
  var planYear = formData.planYear || new Date().getFullYear();

  var avgCommission = (avgBps / 10000) * avgLoanAmt;
  var numFundings = avgCommission > 0 ? Math.ceil(grossIncome / avgCommission) : 0;
  var totalFundings = numFundings * avgLoanAmt;
  var fundingsPerMonth = numFundings > 0 ? (numFundings / 12) : 0;
  var leadsRequired = conversionRatio > 0 ? Math.ceil(numFundings / (conversionRatio / 100)) : 0;
  var leadsPerWeek = leadsRequired > 0 ? (leadsRequired / 48) : 0;
  var leadsPerDay = leadsPerWeek > 0 ? (leadsPerWeek / 5) : 0;
  var bizDevBudget = grossIncome * (bizDevPercent / 100);
  var netIncome = grossIncome - bizDevBudget;

  /* ── Status dot ───────────────────────────────────── */
  function statusDot() {
    var dotBase = { width: 10, height: 10, borderRadius: "50%", display: "inline-block", marginRight: 8 };
    if (saveStatus === "loading") return Object.assign({}, dotBase, { background: colors.blue, animation: "pulse 1s infinite" });
    if (saveStatus === "saving") return Object.assign({}, dotBase, { background: "#F59E0B", animation: "pulse 1s infinite" });
    if (saveStatus === "saved") return Object.assign({}, dotBase, { background: "#22C55E" });
    if (saveStatus === "error") return Object.assign({}, dotBase, { background: "#EF4444" });
    return Object.assign({}, dotBase, { background: colors.dim });
  }

  function statusText() {
    if (saveStatus === "loading") return "Loading...";
    if (saveStatus === "saving") return "Saving...";
    if (saveStatus === "saved") return "All changes saved";
    if (saveStatus === "error") return "Error saving";
    return "Ready";
  }

  /* ── Calc row builder ─────────────────────────────── */
  function calcRow(num, label, sub, content, highlight) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 14, padding: "12px 16px",
        background: highlight ? colors.highlightBg : "transparent",
        borderRadius: 10, marginBottom: 6,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%", background: colors.text,
          color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 700, flexShrink: 0,
        }}>{num}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>{label}</div>
          {sub && <small style={{ fontSize: 12, color: colors.muted }}>{sub}</small>}
        </div>
        <div style={{ width: 200, flexShrink: 0 }}>{content}</div>
      </div>
    );
  }

  function resultBox(value, highlight) {
    return (
      <div style={{
        padding: "8px 12px", borderRadius: 8, fontSize: 14, fontWeight: 700,
        textAlign: "right",
        background: highlight ? colors.blue : colors.resultBg,
        color: highlight ? "#fff" : colors.text,
      }}>{value}</div>
    );
  }

  function currencyInput(field) {
    return (
      <input
        style={inputBase}
        value={formData[field]}
        placeholder="$0"
        onChange={function (e) { onCurrencyChange(field, e.target.value); }}
      />
    );
  }

  function numInput(field, placeholder) {
    return (
      <input
        style={inputBase}
        type="number"
        value={formData[field]}
        placeholder={placeholder || "0"}
        onChange={function (e) { onChange(field, e.target.value); }}
      />
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: colors.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: colors.muted }}>Loading goal plan...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, padding: "0 16px 64px" }}>
      {/* Pulse animation */}
      <style>{"\n@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }\n@media print { .no-print{display:none!important} }\n"}</style>

      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        {/* ── Save Status Bar ──────────────────────────── */}
        <div style={{
          position: "sticky", top: 0, zIndex: 50,
          background: colors.white, borderBottom: "1px solid " + colors.border,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 20px", marginBottom: 24, borderRadius: "0 0 12px 12px",
        }} className="no-print">
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={statusDot()}></span>
            <span style={{ fontSize: 13, color: colors.muted }}>{statusText()}</span>
          </div>
          <button
            onClick={resetAll}
            style={{
              padding: "6px 14px", fontSize: 13, fontWeight: 600,
              color: "#EF4444", background: "transparent",
              border: "1px solid #EF4444", borderRadius: 8, cursor: "pointer",
            }}
          >Reset All</button>
        </div>

        {/* ═══════════════════════════════════════════════
            SECTION 1 — Take Action Business Plan Goals
            ═══════════════════════════════════════════════ */}
        <div id="print-plan" style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h2 style={sectionTitle}>
              <i className="fa fa-calculator" style={{ color: colors.blue }}></i>
              Take Action Business Plan Goals
            </h2>
            <button style={printBtn} className="no-print" onClick={function () { printSection("print-plan"); }}>
              <i className="fa fa-print" style={{ marginRight: 6 }}></i>Print
            </button>
          </div>

          {/* Info row */}
          <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Plan Year</label>
              <input
                style={inputBase}
                type="number"
                min="2020"
                max="2050"
                value={formData.planYear}
                onChange={function (e) { onChange("planYear", e.target.value); }}
              />
            </div>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>Loan Officer Name</label>
              <input
                style={inputBase}
                value={formData.loName}
                placeholder="Enter your name"
                onChange={function (e) { onChange("loName", e.target.value); }}
              />
            </div>
          </div>

          {/* Calculation rows */}
          {calcRow(1, "My " + planYear + " gross personal income will be:", null, currencyInput("grossIncome"), false)}
          {calcRow(2, "My average loan amount will be:", null, currencyInput("avgLoanAmt"), false)}
          {calcRow(3, "My average basis points (commission) earned per loan will be:", null, numInput("avgBps", "e.g. 100"), false)}
          {calcRow(4, "My average commission earned per loan will be:", null, resultBox(fmtCurrency(avgCommission), false), false)}
          {calcRow(5, "My total fundings for " + planYear + " will be:", null, resultBox(fmtCurrency(totalFundings), false), false)}
          {calcRow(6, "The number of fundings required to achieve my income goal:", null, resultBox(fmtNum(numFundings, 0), true), true)}
          {calcRow(7, "The number of fundings required per month:", null, resultBox(fmtNum(fundingsPerMonth, 1), true), true)}
          {calcRow(8, "My conversion ratio (lead to loan pull-through %):", "If you don't know for sure, put down an estimate", numInput("conversionRatio", "e.g. 35"), false)}
          {calcRow(9, "Number of leads required to achieve my goal:", null, resultBox(fmtNum(leadsRequired, 0), false), false)}
          {calcRow(10, "Number of leads required per week:", "Based on 48 weeks", resultBox(fmtNum(leadsPerWeek, 1), true), true)}
          {calcRow(11, "Percentage of annual income allocated towards business development:", "Top producers allocate 5-10%", numInput("bizDevPercent", "e.g. 7"), false)}
          {calcRow(12, "My total annual budget devoted towards business development:", null, resultBox(fmtCurrency(bizDevBudget), false), false)}
          {calcRow(13, "My net income in " + planYear + " will be:", null, resultBox(fmtCurrency(netIncome), true), true)}

          {/* Summary Grid */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginTop: 24,
          }}>
            {[
              { label: "Gross Income Goal", value: fmtCurrency(grossIncome), primary: true },
              { label: "Loans Needed", value: fmtNum(numFundings, 0), primary: false },
              { label: "Leads Per Week", value: fmtNum(leadsPerWeek, 1), primary: false },
              { label: "Leads Per Day", value: fmtNum(leadsPerDay, 1), primary: false },
              { label: "Net Income", value: fmtCurrency(netIncome), primary: true },
            ].map(function (item, i) {
              return (
                <div key={i} style={{
                  background: item.primary ? colors.blue : colors.resultBg,
                  color: item.primary ? "#fff" : colors.text,
                  borderRadius: 12, padding: 16, textAlign: "center",
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, opacity: item.primary ? 0.85 : 0.7, marginBottom: 6 }}>{item.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{item.value}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════
            SECTION 2 — 1-3-5 Goal Setting Framework
            ═══════════════════════════════════════════════ */}
        <div id="print-goals" style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h2 style={sectionTitle}>
              <i className="fa fa-bullseye" style={{ color: colors.blue }}></i>
              1-3-5 Goal Setting Framework
            </h2>
            <button style={printBtn} className="no-print" onClick={function () { printSection("print-goals"); }}>
              <i className="fa fa-print" style={{ marginRight: 6 }}></i>Print
            </button>
          </div>

          {/* ONE Goal */}
          <div style={{
            background: colors.highlightBg, borderRadius: 12, padding: 20, marginBottom: 24,
            borderLeft: "4px solid " + colors.blue,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", background: colors.blue,
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, fontWeight: 700,
              }}>1</div>
              <span style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>ONE Goal</span>
            </div>
            <p style={{ fontSize: 13, color: colors.muted, margin: "0 0 10px 0" }}>
              Define the single most important goal you want to achieve this year. Everything else should support this goal.
            </p>
            <textarea
              style={Object.assign({}, inputBase, { minHeight: 80, resize: "vertical" })}
              value={formData.oneGoal}
              placeholder="What is your #1 goal this year?"
              onChange={function (e) { onChange("oneGoal", e.target.value); }}
            />
          </div>

          {/* THREE Strategies */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", background: colors.blue,
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, fontWeight: 700,
              }}>3</div>
              <span style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>THREE Strategies</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              {[1, 2, 3].map(function (n) {
                var field = "strategy" + n;
                return (
                  <div key={n} style={{
                    background: colors.resultBg, borderRadius: 12, padding: 16, textAlign: "center",
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", background: colors.text,
                      color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700, marginBottom: 8,
                    }}>{n}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: colors.muted, marginBottom: 8 }}>Strategy</div>
                    <input
                      style={inputBase}
                      value={formData[field]}
                      placeholder={"Strategy " + n}
                      onChange={function (e) { onChange(field, e.target.value); }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* FIVE Tactics per Strategy */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", background: colors.blue,
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, fontWeight: 700,
              }}>5</div>
              <span style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>FIVE Tactics per Strategy</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              {[1, 2, 3].map(function (sn) {
                return (
                  <div key={sn} style={{
                    background: colors.resultBg, borderRadius: 12, padding: 16,
                  }}>
                    <div style={{
                      fontSize: 14, fontWeight: 700, color: colors.text, marginBottom: 12,
                      paddingBottom: 8, borderBottom: "2px solid " + colors.blue,
                    }}>
                      Strategy {sn}: {formData["strategy" + sn] || "—"}
                    </div>
                    {[1, 2, 3, 4, 5].map(function (tn) {
                      var field = "s" + sn + "t" + tn;
                      return (
                        <div key={tn} style={{ marginBottom: 8 }}>
                          <label style={{ fontSize: 12, color: colors.muted, marginBottom: 2, display: "block" }}>Tactic {tn}</label>
                          <input
                            style={inputBase}
                            value={formData[field]}
                            placeholder={"Tactic " + tn}
                            onChange={function (e) { onChange(field, e.target.value); }}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* SMART Goals Reference */}
          <div style={{
            background: colors.resultBg, borderRadius: 12, padding: 20,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: colors.text, marginBottom: 14, textAlign: "center" }}>
              SMART Goals Reference
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
              {[
                { letter: "S", word: "Specific", desc: "Clearly define what you want to accomplish" },
                { letter: "M", word: "Measurable", desc: "Include metrics to track progress" },
                { letter: "A", word: "Achievable", desc: "Set realistic and attainable goals" },
                { letter: "R", word: "Relevant", desc: "Align with your broader objectives" },
                { letter: "T", word: "Time-Bound", desc: "Set a clear deadline or timeframe" },
              ].map(function (item, i) {
                return (
                  <div key={i} style={{ textAlign: "center" }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: "50%", background: colors.blue,
                      color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20, fontWeight: 700, marginBottom: 6,
                    }}>{item.letter}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, marginBottom: 4 }}>{item.word}</div>
                    <div style={{ fontSize: 11, color: colors.muted, lineHeight: 1.4 }}>{item.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════
            SECTION 3 — Notes & Action Items
            ═══════════════════════════════════════════════ */}
        <div id="print-notes" style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h2 style={sectionTitle}>
              <i className="fa fa-sticky-note" style={{ color: colors.blue }}></i>
              Notes &amp; Action Items
            </h2>
            <button style={printBtn} className="no-print" onClick={function () { printSection("print-notes"); }}>
              <i className="fa fa-print" style={{ marginRight: 6 }}></i>Print
            </button>
          </div>
          <textarea
            style={Object.assign({}, inputBase, { minHeight: 120, resize: "vertical" })}
            value={formData.notesField}
            placeholder="Add notes, action items, reminders..."
            onChange={function (e) { onChange("notesField", e.target.value); }}
          />
        </div>

      </div>
    </div>
  );
}
