import { useState, useEffect } from "react";
import { isNexaUser, checkNexaAccess } from "../../lib/auth";

export function meta() {
  return [{ title: "Credit Reports — MtgBroker" }];
}

const API_URL = "https://mtg-broker-api.rich-e00.workers.dev/api/credit-vendors";

/* ── Formatting helpers ── */

function fmt(val) {
  if (val == null) return null;
  return "$" + Number(val).toFixed(2).replace(/\.00$/, "");
}

function featureBadge(label, value) {
  const yes = value === "Yes";
  return (
    <span
      key={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 12,
        fontWeight: 600,
        padding: "4px 10px",
        borderRadius: 20,
        background: yes ? "#F0FDF4" : "#F1F5F9",
        color: yes ? "#16A34A" : "#94A3B8",
        border: `1px solid ${yes ? "#BBF7D0" : "#E2E8F0"}`,
      }}
    >
      <i
        className={yes ? "fa-solid fa-check" : "fa-solid fa-xmark"}
        style={{ fontSize: 10 }}
      />
      {label}
    </span>
  );
}

/* ── Price row ── */

function PriceRow({ label, value }) {
  if (value == null) return null;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 0",
        borderBottom: "1px solid #F1F5F9",
        fontSize: 13,
      }}
    >
      <span style={{ color: "#64748B" }}>{label}</span>
      <span style={{ color: "#0F172A", fontWeight: 600 }}>{fmt(value)}</span>
    </div>
  );
}

/* ── Pricing section ── */

function PricingSection({ pricing }) {
  if (!pricing) return null;

  const hardPull = [
    ["Trimerge Individual", pricing.trimergeIndividual],
    ["Trimerge Joint", pricing.trimergeJoint],
    ["Rescore Fee", pricing.rescoreFee],
  ];
  const softPull = [
    ["Soft Pull Individual", pricing.softPullIndividual],
    ["Soft Pull Joint", pricing.softPullJoint],
    ["Soft Pull Trimerge Individual", pricing.softPullTrimergeIndividual],
    ["Soft Pull Trimerge Joint", pricing.softPullTrimergeJoint],
    ["Soft Pull Trended Individual", pricing.softPullTrendedIndividual],
    ["Soft Pull Trended Joint", pricing.softPullTrendedJoint],
    ["Soft Pull Trended Trimerge Individual", pricing.softPullTrendedTrimergeIndividual],
    ["Soft Pull Trended Trimerge Joint", pricing.softPullTrendedTrimergeJoint],
  ];
  const other = [
    ["Tax Transcript", pricing.taxTranscriptCost],
    ["VOE / TWN", pricing.voeTwnCost],
    ["VOE Argyle", pricing.voeArgyleCost],
    ["UDN", pricing.udnCost],
  ];

  const hasHard = hardPull.some(([, v]) => v != null);
  const hasSoft = softPull.some(([, v]) => v != null);
  const hasOther = other.some(([, v]) => v != null);

  if (!hasHard && !hasSoft && !hasOther) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        {hasHard && (
          <div
            style={{
              background: "#F8FAFC",
              borderRadius: 8,
              padding: 14,
              border: "1px solid #F1F5F9",
            }}
          >
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#94A3B8",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                margin: "0 0 8px",
              }}
            >
              Hard Pull
            </p>
            {hardPull.map(([l, v]) => (
              <PriceRow key={l} label={l} value={v} />
            ))}
          </div>
        )}
        {hasSoft && (
          <div
            style={{
              background: "#F8FAFC",
              borderRadius: 8,
              padding: 14,
              border: "1px solid #F1F5F9",
            }}
          >
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#94A3B8",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                margin: "0 0 8px",
              }}
            >
              Soft Pull
            </p>
            {softPull.map(([l, v]) => (
              <PriceRow key={l} label={l} value={v} />
            ))}
          </div>
        )}
        {hasOther && (
          <div
            style={{
              background: "#F8FAFC",
              borderRadius: 8,
              padding: 14,
              border: "1px solid #F1F5F9",
            }}
          >
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#94A3B8",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                margin: "0 0 8px",
              }}
            >
              Other Fees
            </p>
            {other.map(([l, v]) => (
              <PriceRow key={l} label={l} value={v} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Contact link button ── */

function ContactBtn({ icon, label, href }) {
  if (!href) return null;
  const isExternal = href.startsWith("http");
  return (
    <a
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
        color: "#2563EB",
        background: "#EFF6FF",
        padding: "5px 12px",
        borderRadius: 6,
        textDecoration: "none",
        border: "1px solid #DBEAFE",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "#DBEAFE";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "#EFF6FF";
      }}
    >
      <i className={icon} style={{ fontSize: 11 }} />
      {label}
    </a>
  );
}

/* ── Vendor card ── */

function VendorCard({ vendor }) {
  const { features = {}, pricing, nexaDoc, pricingNote } = vendor;

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: 10,
        padding: 24,
        marginBottom: 16,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginBottom: 16,
        }}
      >
        {vendor.logo ? (
          <img
            src={vendor.logo}
            alt={vendor.name}
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              objectFit: "cover",
              border: "1px solid #E2E8F0",
            }}
          />
        ) : (
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "#EFF6FF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <i
              className="fa-solid fa-building"
              style={{ fontSize: 20, color: "#2563EB" }}
            />
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            <h3
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#0F172A",
                margin: 0,
              }}
            >
              {vendor.name}
            </h3>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: 20,
                background:
                  vendor.nexaApproved === "Yes" ? "#F0FDF4" : "#F1F5F9",
                color:
                  vendor.nexaApproved === "Yes" ? "#16A34A" : "#94A3B8",
                border: `1px solid ${
                  vendor.nexaApproved === "Yes" ? "#BBF7D0" : "#E2E8F0"
                }`,
              }}
            >
              <i
                className={
                  vendor.nexaApproved === "Yes"
                    ? "fa-solid fa-circle-check"
                    : "fa-solid fa-circle-minus"
                }
                style={{ fontSize: 10 }}
              />
              {vendor.nexaApproved === "Yes"
                ? "NEXA Approved"
                : "Not NEXA Approved"}
            </span>
          </div>
          {vendor.description && (
            <p
              style={{
                fontSize: 13,
                color: "#64748B",
                margin: "4px 0 0",
                lineHeight: 1.4,
              }}
            >
              {vendor.description}
            </p>
          )}
        </div>
      </div>

      {/* Contact row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <ContactBtn
          icon="fa-solid fa-phone"
          label={vendor.supportPhone || "Call"}
          href={vendor.supportPhone ? `tel:${vendor.supportPhone}` : null}
        />
        <ContactBtn
          icon="fa-solid fa-envelope"
          label={vendor.supportEmail || "Email"}
          href={
            vendor.supportEmail ? `mailto:${vendor.supportEmail}` : null
          }
        />
        <ContactBtn
          icon="fa-solid fa-globe"
          label="Website"
          href={vendor.website}
        />
        <ContactBtn
          icon="fa-solid fa-right-to-bracket"
          label="Login Portal"
          href={vendor.loginPortal}
        />
      </div>

      {/* Pricing */}
      <PricingSection pricing={pricing} />

      {/* Features row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginTop: 16,
        }}
      >
        {featureBadge("Score Navigator", features.scoreNavigator)}
        {featureBadge("SmartPay", features.smartPay)}
        {featureBadge("Soft Pull Trended", features.softPullTrended)}
      </div>

      {/* Score Navigator cost note */}
      {features.scoreNavigator === "Yes" &&
        features.scoreNavigatorCost != null && (
          <p
            style={{
              fontSize: 12,
              color: "#94A3B8",
              margin: "8px 0 0",
              fontStyle: "italic",
            }}
          >
            Score Navigator add-on: {fmt(features.scoreNavigatorCost)}
          </p>
        )}

      {/* NEXA Doc download */}
      {nexaDoc && nexaDoc.url && (
        <div style={{ marginTop: 16 }}>
          <a
            href={nexaDoc.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              fontWeight: 600,
              color: "#FFFFFF",
              background: "#2563EB",
              padding: "8px 16px",
              borderRadius: 8,
              textDecoration: "none",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#1D4ED8";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#2563EB";
            }}
          >
            <i className="fa-solid fa-download" style={{ fontSize: 12 }} />
            {nexaDoc.title || nexaDoc.filename || "Download NEXA Doc"}
          </a>
        </div>
      )}

      {/* Pricing note */}
      {pricingNote && (
        <div
          style={{
            marginTop: 16,
            background: "#FFFBEB",
            border: "1px solid #FDE68A",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13,
            color: "#92400E",
            lineHeight: 1.5,
          }}
        >
          <i
            className="fa-solid fa-circle-info"
            style={{ marginRight: 6, fontSize: 12 }}
          />
          {pricingNote}
        </div>
      )}
    </div>
  );
}

/* ── Loading skeleton ── */

function LoadingSkeleton() {
  return (
    <div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: 10,
            padding: 24,
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "#E2E8F0",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  width: 180,
                  height: 18,
                  borderRadius: 6,
                  background: "#E2E8F0",
                  marginBottom: 8,
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              />
              <div
                style={{
                  width: 260,
                  height: 14,
                  borderRadius: 6,
                  background: "#F1F5F9",
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {Array.from({ length: 4 }).map((_, j) => (
              <div
                key={j}
                style={{
                  width: 90,
                  height: 28,
                  borderRadius: 6,
                  background: "#F1F5F9",
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              />
            ))}
          </div>
          <div
            style={{
              height: 120,
              borderRadius: 8,
              background: "#F8FAFC",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        </div>
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

/* ── Locked card for non-NEXA users ── */

function LockedCard() {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: 10,
        padding: 48,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: "#F1F5F9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px",
        }}
      >
        <i
          className="fa-solid fa-shield-halved"
          style={{ fontSize: 28, color: "#94A3B8" }}
        />
      </div>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "#0F172A",
          margin: "0 0 8px",
        }}
      >
        NEXA Members Only
      </h2>
      <p
        style={{
          fontSize: 14,
          color: "#64748B",
          margin: "0 auto 20px",
          maxWidth: 420,
          lineHeight: 1.5,
        }}
      >
        Credit report vendor comparison is an exclusive feature for NEXA Mortgage
        loan officers. Compare pricing, features, and integrations across approved
        credit report vendors.
      </p>
      <a
        href="https://www.nexamortgage.com"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontSize: 14,
          fontWeight: 600,
          color: "#2563EB",
          textDecoration: "none",
        }}
      >
        Learn more about NEXA
        <i className="fa-solid fa-arrow-right" style={{ fontSize: 12 }} />
      </a>
    </div>
  );
}

/* ── Main page ── */

export default function CreditReportsPage() {
  const [isNexa, setIsNexa] = useState(false);
  const [nexaChecked, setNexaChecked] = useState(false);
  const [vendors, setVendors] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check NEXA access on mount
  useEffect(() => {
    let cancelled = false;
    async function check() {
      // Fast sync check first
      if (isNexaUser()) {
        if (!cancelled) {
          setIsNexa(true);
          setNexaChecked(true);
        }
        return;
      }
      // Async fallback
      const result = await checkNexaAccess();
      if (!cancelled) {
        setIsNexa(result);
        setNexaChecked(true);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch vendors once NEXA access is confirmed
  useEffect(() => {
    if (!nexaChecked || !isNexa) return;
    if (vendors) return; // already cached

    let cancelled = false;
    async function fetchVendors() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setVendors(data.vendors || []);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchVendors();
    return () => {
      cancelled = true;
    };
  }, [nexaChecked, isNexa, vendors]);

  // Still checking NEXA status
  if (!nexaChecked) {
    return (
      <div style={{ background: "#F8FAFC", minHeight: "100%" }}>
        <LoadingSkeleton />
      </div>
    );
  }

  // Non-NEXA user
  if (!isNexa) {
    return (
      <div style={{ background: "#F8FAFC", minHeight: "100%" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 16,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "#EFF6FF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <i
              className="fa-solid fa-credit-card"
              style={{ fontSize: 22, color: "#2563EB" }}
            />
          </div>
          <div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "#0F172A",
                margin: "0 0 4px",
              }}
            >
              Credit Report Vendors
            </h1>
            <p style={{ fontSize: 14, color: "#64748B", margin: 0 }}>
              Compare credit report vendors, pricing, and features.
            </p>
          </div>
        </div>
        <LockedCard />
      </div>
    );
  }

  // NEXA user - full page
  return (
    <div style={{ background: "#F8FAFC", minHeight: "100%" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: 32,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: "#EFF6FF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <i
            className="fa-solid fa-credit-card"
            style={{ fontSize: 22, color: "#2563EB" }}
          />
        </div>
        <div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "#0F172A",
              margin: "0 0 4px",
            }}
          >
            Credit Report Vendors
          </h1>
          <p style={{ fontSize: 14, color: "#64748B", margin: 0 }}>
            Compare credit report vendors, pricing, and features.
          </p>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 8,
              padding: "4px 12px",
              borderRadius: 20,
              background: "rgba(147, 51, 234, 0.1)",
              color: "#9333EA",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            NEXA Exclusive
          </span>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: 10,
            padding: 48,
            textAlign: "center",
          }}
        >
          <i
            className="fa-solid fa-triangle-exclamation"
            style={{ fontSize: 28, color: "#EF4444", marginBottom: 12 }}
          />
          <p
            style={{
              fontSize: 15,
              color: "#0F172A",
              fontWeight: 600,
              margin: "0 0 4px",
            }}
          >
            Failed to load vendors
          </p>
          <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>
            {error}
          </p>
        </div>
      ) : (
        <div>
          {vendors && vendors.length > 0 ? (
            vendors.map((v) => <VendorCard key={v.id} vendor={v} />)
          ) : (
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                padding: 48,
                textAlign: "center",
              }}
            >
              <p style={{ fontSize: 14, color: "#64748B", margin: 0 }}>
                No credit report vendors found.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
