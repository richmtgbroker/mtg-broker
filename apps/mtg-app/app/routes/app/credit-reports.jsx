import { useState, useEffect } from "react";
import { isNexaUser, checkNexaAccess } from "../../lib/auth";

export function meta() {
  return [{ title: "Credit Reports — MtgBroker" }];
}

const API_URL =
  "https://mtg-broker-api.rich-e00.workers.dev/api/credit-vendors";

/* ────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────── */

function fmt(val) {
  if (val == null || val === "" || val === "--") return null;
  const n = Number(val);
  if (isNaN(n)) return null;
  return "$" + n.toFixed(2);
}

function fmtDisplay(val) {
  const f = fmt(val);
  return f || "\u2014";
}

/** Sort: approved first, then alphabetical */
function sortVendors(list) {
  return [...list].sort((a, b) => {
    const aApproved = a.nexaApproved === "Yes" ? 0 : 1;
    const bApproved = b.nexaApproved === "Yes" ? 0 : 1;
    if (aApproved !== bApproved) return aApproved - bApproved;
    return (a.name || "").localeCompare(b.name || "");
  });
}

/** Find the minimum numeric value across vendors for a given pricing key */
function findMinPrice(vendors, key) {
  let min = Infinity;
  for (const v of vendors) {
    const val = v.pricing?.[key];
    if (val != null && val !== "" && val !== "--") {
      const n = Number(val);
      if (!isNaN(n) && n < min) min = n;
    }
  }
  return min === Infinity ? null : min;
}

/** Find the minimum value across vendors for a nested path like features.scoreNavigatorCost */
function findMinFeaturePrice(vendors, featureKey) {
  let min = Infinity;
  for (const v of vendors) {
    const val = v.features?.[featureKey];
    if (val != null && val !== "" && val !== "--") {
      const n = Number(val);
      if (!isNaN(n) && n < min) min = n;
    }
  }
  return min === Infinity ? null : min;
}

/** Price cell with optional green highlight for lowest */
function PriceCell({ value, isLowest }) {
  const display = fmtDisplay(value);
  const hasValue = display !== "\u2014";
  return (
    <td
      style={{
        padding: "12px 16px",
        fontSize: 14,
        fontWeight: hasValue ? 600 : 400,
        color: hasValue
          ? isLowest
            ? "#065F46"
            : "#0F172A"
          : "#94A3B8",
        background: isLowest && hasValue ? "#ECFDF5" : "transparent",
        textAlign: "right",
        borderBottom: "1px solid #F1F5F9",
      }}
    >
      {display}
    </td>
  );
}

/** Vendor name cell with logo */
function VendorNameCell({ vendor, size = 32 }) {
  return (
    <td
      style={{
        padding: "12px 16px",
        borderBottom: "1px solid #F1F5F9",
        whiteSpace: "nowrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {vendor.logo ? (
          <img
            src={vendor.logo}
            alt={vendor.name}
            style={{
              width: size,
              height: size,
              borderRadius: "50%",
              objectFit: "cover",
              border: "1px solid #E2E8F0",
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: size,
              height: size,
              borderRadius: "50%",
              background: "#EFF6FF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: size * 0.35,
              fontWeight: 700,
              color: "#2563EB",
            }}
          >
            {(vendor.name || "?")
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
        )}
        <span style={{ fontWeight: 600, color: "#0F172A", fontSize: 14 }}>
          {vendor.name}
        </span>
      </div>
    </td>
  );
}

/** Feature badge used in Features tab */
function FeatureBadge({ value }) {
  if (value === "Yes") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 12,
          fontWeight: 600,
          padding: "3px 10px",
          borderRadius: 20,
          background: "#F0FDF4",
          color: "#16A34A",
          border: "1px solid #BBF7D0",
        }}
      >
        <i className="fa-solid fa-check" style={{ fontSize: 10 }} />
        Yes
      </span>
    );
  }
  if (value === "No") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 12,
          fontWeight: 600,
          padding: "3px 10px",
          borderRadius: 20,
          background: "#FEF2F2",
          color: "#DC2626",
          border: "1px solid #FECACA",
        }}
      >
        <i className="fa-solid fa-xmark" style={{ fontSize: 10 }} />
        No
      </span>
    );
  }
  return (
    <span style={{ color: "#94A3B8", fontSize: 13, fontWeight: 500 }}>
      {"\u2014"}
    </span>
  );
}

/** Approved badge */
function ApprovedBadge({ value }) {
  if (value === "Yes") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 11,
          fontWeight: 700,
          padding: "3px 10px",
          borderRadius: 20,
          background: "#F0FDF4",
          color: "#16A34A",
          border: "1px solid #BBF7D0",
        }}
      >
        <i className="fa-solid fa-circle-check" style={{ fontSize: 10 }} />
        Yes
      </span>
    );
  }
  return (
    <span style={{ color: "#94A3B8", fontSize: 13, fontWeight: 500 }}>
      {"\u2014"}
    </span>
  );
}

/* ────────────────────────────────────────────
   Table wrapper (horizontal scroll)
   ──────────────────────────────────────────── */

function TableWrap({ children }) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: 700,
          }}
        >
          {children}
        </table>
      </div>
    </div>
  );
}

function Th({ children, align = "right", minW }) {
  return (
    <th
      style={{
        padding: "12px 16px",
        fontSize: 11,
        fontWeight: 700,
        color: "#64748B",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        textAlign: align,
        borderBottom: "2px solid #E2E8F0",
        background: "#F8FAFC",
        whiteSpace: "nowrap",
        minWidth: minW || undefined,
      }}
    >
      {children}
    </th>
  );
}

/* ────────────────────────────────────────────
   Pricing Sub-Tab Tables
   ──────────────────────────────────────────── */

function HardPullTable({ vendors }) {
  const minTri = findMinPrice(vendors, "trimergeIndividual");
  const minJoint = findMinPrice(vendors, "trimergeJoint");
  const minRescore = findMinPrice(vendors, "rescoreFee");

  return (
    <TableWrap>
      <thead>
        <tr>
          <Th align="left" minW={180}>
            Vendor
          </Th>
          <Th>Tri-Merge (Individual)</Th>
          <Th>Tri-Merge (Joint)</Th>
          <Th>Rescore Fee</Th>
          <Th>Pricing Doc</Th>
        </tr>
      </thead>
      <tbody>
        {vendors.map((v) => (
          <tr key={v.id}>
            <VendorNameCell vendor={v} />
            <PriceCell
              value={v.pricing?.trimergeIndividual}
              isLowest={
                fmt(v.pricing?.trimergeIndividual) !== null &&
                Number(v.pricing?.trimergeIndividual) === minTri
              }
            />
            <PriceCell
              value={v.pricing?.trimergeJoint}
              isLowest={
                fmt(v.pricing?.trimergeJoint) !== null &&
                Number(v.pricing?.trimergeJoint) === minJoint
              }
            />
            <PriceCell
              value={v.pricing?.rescoreFee}
              isLowest={
                fmt(v.pricing?.rescoreFee) !== null &&
                Number(v.pricing?.rescoreFee) === minRescore
              }
            />
            <td
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid #F1F5F9",
                textAlign: "right",
              }}
            >
              {v.nexaDoc?.url ? (
                <a
                  href={v.nexaDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
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
                  }}
                >
                  <i
                    className="fa-solid fa-download"
                    style={{ fontSize: 10 }}
                  />
                  PDF
                </a>
              ) : (
                <span style={{ color: "#94A3B8" }}>{"\u2014"}</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </TableWrap>
  );
}

function SoftPullNonTrendedTable({ vendors }) {
  const minInd = findMinPrice(vendors, "softPullIndividual");
  const minJoint = findMinPrice(vendors, "softPullJoint");
  const minTriInd = findMinPrice(vendors, "softPullTrimergeIndividual");
  const minTriJoint = findMinPrice(vendors, "softPullTrimergeJoint");

  return (
    <TableWrap>
      <thead>
        <tr>
          <Th align="left" minW={180}>
            Vendor
          </Th>
          <Th>1 Bureau (Ind)</Th>
          <Th>1 Bureau (Joint)</Th>
          <Th>Tri-Merge (Ind)</Th>
          <Th>Tri-Merge (Joint)</Th>
        </tr>
      </thead>
      <tbody>
        {vendors.map((v) => (
          <tr key={v.id}>
            <VendorNameCell vendor={v} />
            <PriceCell
              value={v.pricing?.softPullIndividual}
              isLowest={
                fmt(v.pricing?.softPullIndividual) !== null &&
                Number(v.pricing?.softPullIndividual) === minInd
              }
            />
            <PriceCell
              value={v.pricing?.softPullJoint}
              isLowest={
                fmt(v.pricing?.softPullJoint) !== null &&
                Number(v.pricing?.softPullJoint) === minJoint
              }
            />
            <PriceCell
              value={v.pricing?.softPullTrimergeIndividual}
              isLowest={
                fmt(v.pricing?.softPullTrimergeIndividual) !== null &&
                Number(v.pricing?.softPullTrimergeIndividual) === minTriInd
              }
            />
            <PriceCell
              value={v.pricing?.softPullTrimergeJoint}
              isLowest={
                fmt(v.pricing?.softPullTrimergeJoint) !== null &&
                Number(v.pricing?.softPullTrimergeJoint) === minTriJoint
              }
            />
          </tr>
        ))}
      </tbody>
    </TableWrap>
  );
}

function SoftPullTrendedTable({ vendors }) {
  const minInd = findMinPrice(vendors, "softPullTrendedIndividual");
  const minJoint = findMinPrice(vendors, "softPullTrendedJoint");
  const minTriInd = findMinPrice(vendors, "softPullTrendedTrimergeIndividual");
  const minTriJoint = findMinPrice(vendors, "softPullTrendedTrimergeJoint");

  return (
    <TableWrap>
      <thead>
        <tr>
          <Th align="left" minW={180}>
            Vendor
          </Th>
          <Th>1 Bureau (Ind)</Th>
          <Th>1 Bureau (Joint)</Th>
          <Th>Tri-Merge (Ind)</Th>
          <Th>Tri-Merge (Joint)</Th>
        </tr>
      </thead>
      <tbody>
        {vendors.map((v) => (
          <tr key={v.id}>
            <VendorNameCell vendor={v} />
            <PriceCell
              value={v.pricing?.softPullTrendedIndividual}
              isLowest={
                fmt(v.pricing?.softPullTrendedIndividual) !== null &&
                Number(v.pricing?.softPullTrendedIndividual) === minInd
              }
            />
            <PriceCell
              value={v.pricing?.softPullTrendedJoint}
              isLowest={
                fmt(v.pricing?.softPullTrendedJoint) !== null &&
                Number(v.pricing?.softPullTrendedJoint) === minJoint
              }
            />
            <PriceCell
              value={v.pricing?.softPullTrendedTrimergeIndividual}
              isLowest={
                fmt(v.pricing?.softPullTrendedTrimergeIndividual) !== null &&
                Number(v.pricing?.softPullTrendedTrimergeIndividual) ===
                  minTriInd
              }
            />
            <PriceCell
              value={v.pricing?.softPullTrendedTrimergeJoint}
              isLowest={
                fmt(v.pricing?.softPullTrendedTrimergeJoint) !== null &&
                Number(v.pricing?.softPullTrendedTrimergeJoint) ===
                  minTriJoint
              }
            />
          </tr>
        ))}
      </tbody>
    </TableWrap>
  );
}

function AddlServicesTable({ vendors }) {
  const minScoreNav = findMinFeaturePrice(vendors, "scoreNavigatorCost");
  const minTax = findMinPrice(vendors, "taxTranscriptCost");
  const minTwn = findMinPrice(vendors, "voeTwnCost");
  const minArgyle = findMinPrice(vendors, "voeArgyleCost");
  const minUdn = findMinPrice(vendors, "udnCost");

  return (
    <TableWrap>
      <thead>
        <tr>
          <Th align="left" minW={180}>
            Vendor
          </Th>
          <Th>Score Navigator</Th>
          <Th>Tax Transcript</Th>
          <Th>VOE/VOI (TWN)</Th>
          <Th>VOE/VOI (Argyle)</Th>
          <Th>UDN</Th>
        </tr>
      </thead>
      <tbody>
        {vendors.map((v) => (
          <tr key={v.id}>
            <VendorNameCell vendor={v} />
            <PriceCell
              value={v.features?.scoreNavigatorCost}
              isLowest={
                fmt(v.features?.scoreNavigatorCost) !== null &&
                Number(v.features?.scoreNavigatorCost) === minScoreNav
              }
            />
            <PriceCell
              value={v.pricing?.taxTranscriptCost}
              isLowest={
                fmt(v.pricing?.taxTranscriptCost) !== null &&
                Number(v.pricing?.taxTranscriptCost) === minTax
              }
            />
            <PriceCell
              value={v.pricing?.voeTwnCost}
              isLowest={
                fmt(v.pricing?.voeTwnCost) !== null &&
                Number(v.pricing?.voeTwnCost) === minTwn
              }
            />
            <PriceCell
              value={v.pricing?.voeArgyleCost}
              isLowest={
                fmt(v.pricing?.voeArgyleCost) !== null &&
                Number(v.pricing?.voeArgyleCost) === minArgyle
              }
            />
            <PriceCell
              value={v.pricing?.udnCost}
              isLowest={
                fmt(v.pricing?.udnCost) !== null &&
                Number(v.pricing?.udnCost) === minUdn
              }
            />
          </tr>
        ))}
      </tbody>
    </TableWrap>
  );
}

/* ────────────────────────────────────────────
   Features Tab Table
   ──────────────────────────────────────────── */

function FeaturesTable({ vendors }) {
  const [tooltipOpen, setTooltipOpen] = useState(null);

  return (
    <TableWrap>
      <thead>
        <tr>
          <Th align="left" minW={180}>
            Vendor
          </Th>
          <Th align="center">Approved</Th>
          <Th align="center">Score Navigator</Th>
          <Th align="center">Soft Pull Trended</Th>
          <Th align="center">Soft Pull Non-Trended</Th>
          <Th align="center">
            <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 4 }}>
              SmartPay
              <span
                style={{ cursor: "pointer", position: "relative" }}
                onMouseEnter={() => setTooltipOpen(true)}
                onMouseLeave={() => setTooltipOpen(false)}
              >
                <i
                  className="fa-solid fa-circle-info"
                  style={{ fontSize: 10, color: "#94A3B8" }}
                />
                {tooltipOpen && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: "calc(100% + 8px)",
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "#0F172A",
                      color: "#FFFFFF",
                      fontSize: 11,
                      fontWeight: 500,
                      padding: "8px 12px",
                      borderRadius: 6,
                      whiteSpace: "normal",
                      zIndex: 50,
                      textTransform: "none",
                      letterSpacing: 0,
                      lineHeight: 1.4,
                      maxWidth: 260,
                    }}
                  >
                    The ability for a consumer to request and pay for their own
                    credit reports upfront.
                  </span>
                )}
              </span>
            </span>
          </Th>
          <Th align="center">Login Portal</Th>
        </tr>
      </thead>
      <tbody>
        {vendors.map((v) => (
          <tr key={v.id}>
            <VendorNameCell vendor={v} />
            <td
              style={{
                padding: "12px 16px",
                textAlign: "center",
                borderBottom: "1px solid #F1F5F9",
              }}
            >
              <ApprovedBadge value={v.nexaApproved} />
            </td>
            <td
              style={{
                padding: "12px 16px",
                textAlign: "center",
                borderBottom: "1px solid #F1F5F9",
              }}
            >
              <FeatureBadge value={v.features?.scoreNavigator} />
            </td>
            <td
              style={{
                padding: "12px 16px",
                textAlign: "center",
                borderBottom: "1px solid #F1F5F9",
              }}
            >
              <FeatureBadge value={v.features?.softPullTrended} />
            </td>
            <td
              style={{
                padding: "12px 16px",
                textAlign: "center",
                borderBottom: "1px solid #F1F5F9",
              }}
            >
              <FeatureBadge value={v.features?.softPullNonTrended} />
            </td>
            <td
              style={{
                padding: "12px 16px",
                textAlign: "center",
                borderBottom: "1px solid #F1F5F9",
              }}
            >
              <FeatureBadge value={v.features?.smartPay} />
            </td>
            <td
              style={{
                padding: "12px 16px",
                textAlign: "center",
                borderBottom: "1px solid #F1F5F9",
              }}
            >
              {v.loginPortal ? (
                <a
                  href={v.loginPortal}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#2563EB",
                    background: "#EFF6FF",
                    padding: "4px 12px",
                    borderRadius: 6,
                    textDecoration: "none",
                    border: "1px solid #DBEAFE",
                  }}
                >
                  <i
                    className="fa-solid fa-arrow-up-right-from-square"
                    style={{ fontSize: 10 }}
                  />
                  Open
                </a>
              ) : (
                <span style={{ color: "#94A3B8" }}>{"\u2014"}</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </TableWrap>
  );
}

/* ────────────────────────────────────────────
   Vendor Detail Cards (Tab 3)
   ──────────────────────────────────────────── */

function PriceRow({ label, value }) {
  if (value == null || value === "" || value === "--") return null;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "5px 0",
        borderBottom: "1px solid #F1F5F9",
        fontSize: 13,
      }}
    >
      <span style={{ color: "#64748B" }}>{label}</span>
      <span style={{ color: "#0F172A", fontWeight: 600 }}>{fmt(value)}</span>
    </div>
  );
}

function MiniPricingSection({ title, rows }) {
  const visibleRows = rows.filter(
    ([, v]) => v != null && v !== "" && v !== "--"
  );
  if (visibleRows.length === 0) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#94A3B8",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          margin: "0 0 6px",
        }}
      >
        {title}
      </p>
      {visibleRows.map(([l, v]) => (
        <PriceRow key={l} label={l} value={v} />
      ))}
    </div>
  );
}

function VendorDetailCard({ vendor }) {
  const [notesOpen, setNotesOpen] = useState(false);
  const p = vendor.pricing || {};
  const f = vendor.features || {};

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: 10,
        padding: 24,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Card Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 14,
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
              flexShrink: 0,
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
              fontSize: 16,
              fontWeight: 700,
              color: "#2563EB",
            }}
          >
            {(vendor.name || "?")
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <h3
              style={{
                fontSize: 16,
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
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 8px",
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
                style={{ fontSize: 9 }}
              />
              {vendor.nexaApproved === "Yes" ? "Approved" : "Not Approved"}
            </span>
          </div>
          {vendor.accountRep && (
            <p
              style={{
                fontSize: 12,
                color: "#64748B",
                margin: "2px 0 0",
              }}
            >
              Rep: {vendor.accountRep}
            </p>
          )}
        </div>
      </div>

      {/* Description */}
      {vendor.description && (
        <p
          style={{
            fontSize: 13,
            color: "#64748B",
            margin: "0 0 14px",
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {vendor.description}
        </p>
      )}

      {/* Pricing mini-sections */}
      <div
        style={{
          background: "#F8FAFC",
          borderRadius: 8,
          padding: 14,
          marginBottom: 14,
          border: "1px solid #F1F5F9",
          flex: 1,
        }}
      >
        <MiniPricingSection
          title="Hard Pull"
          rows={[
            ["Trimerge (Ind)", p.trimergeIndividual],
            ["Trimerge (Joint)", p.trimergeJoint],
            ["Rescore Fee", p.rescoreFee],
          ]}
        />
        <MiniPricingSection
          title="Soft Pull: Non-Trended"
          rows={[
            ["1 Bureau (Ind)", p.softPullIndividual],
            ["1 Bureau (Joint)", p.softPullJoint],
            ["Trimerge (Ind)", p.softPullTrimergeIndividual],
            ["Trimerge (Joint)", p.softPullTrimergeJoint],
          ]}
        />
        <MiniPricingSection
          title="Soft Pull: Trended (AUS)"
          rows={[
            ["1 Bureau (Ind)", p.softPullTrendedIndividual],
            ["1 Bureau (Joint)", p.softPullTrendedJoint],
            ["Trimerge (Ind)", p.softPullTrendedTrimergeIndividual],
            ["Trimerge (Joint)", p.softPullTrendedTrimergeJoint],
          ]}
        />
        <MiniPricingSection
          title="Add'l Services"
          rows={[
            ["Score Navigator", f.scoreNavigatorCost],
            ["Tax Transcript", p.taxTranscriptCost],
            ["VOE/VOI (TWN)", p.voeTwnCost],
            ["VOE/VOI (Argyle)", p.voeArgyleCost],
            ["UDN", p.udnCost],
          ]}
        />
        {!Object.values(p).some(
          (v) => v != null && v !== "" && v !== "--"
        ) &&
          !f.scoreNavigatorCost && (
            <p
              style={{
                fontSize: 12,
                color: "#94A3B8",
                margin: 0,
                fontStyle: "italic",
              }}
            >
              No pricing data available
            </p>
          )}
      </div>

      {/* Support */}
      {(vendor.supportPhone || vendor.supportEmail) && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 14,
          }}
        >
          {vendor.supportPhone && (
            <a
              href={`tel:${vendor.supportPhone}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                color: "#64748B",
                textDecoration: "none",
              }}
            >
              <i className="fa-solid fa-phone" style={{ fontSize: 10 }} />
              {vendor.supportPhone}
            </a>
          )}
          {vendor.supportEmail && (
            <a
              href={`mailto:${vendor.supportEmail}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                color: "#64748B",
                textDecoration: "none",
              }}
            >
              <i className="fa-solid fa-envelope" style={{ fontSize: 10 }} />
              {vendor.supportEmail}
            </a>
          )}
        </div>
      )}

      {/* Links */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: vendor.nexaNotes ? 14 : 0,
        }}
      >
        {vendor.website && (
          <a
            href={vendor.website}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              fontWeight: 600,
              color: "#2563EB",
              background: "#EFF6FF",
              padding: "5px 12px",
              borderRadius: 6,
              textDecoration: "none",
              border: "1px solid #DBEAFE",
            }}
          >
            <i className="fa-solid fa-globe" style={{ fontSize: 10 }} />
            Website
          </a>
        )}
        {vendor.loginPortal && (
          <a
            href={vendor.loginPortal}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              fontWeight: 600,
              color: "#2563EB",
              background: "#EFF6FF",
              padding: "5px 12px",
              borderRadius: 6,
              textDecoration: "none",
              border: "1px solid #DBEAFE",
            }}
          >
            <i
              className="fa-solid fa-right-to-bracket"
              style={{ fontSize: 10 }}
            />
            Login Portal
          </a>
        )}
        {vendor.nexaDoc?.url && (
          <a
            href={vendor.nexaDoc.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              fontWeight: 600,
              color: "#2563EB",
              background: "#EFF6FF",
              padding: "5px 12px",
              borderRadius: 6,
              textDecoration: "none",
              border: "1px solid #DBEAFE",
            }}
          >
            <i className="fa-solid fa-download" style={{ fontSize: 10 }} />
            Pricing Doc
          </a>
        )}
        {vendor.webflowSlug && (
          <a
            href={`/app/vendors/${vendor.webflowSlug}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              fontWeight: 600,
              color: "#2563EB",
              background: "#EFF6FF",
              padding: "5px 12px",
              borderRadius: 6,
              textDecoration: "none",
              border: "1px solid #DBEAFE",
            }}
          >
            <i
              className="fa-solid fa-arrow-up-right-from-square"
              style={{ fontSize: 10 }}
            />
            Full Vendor Page
          </a>
        )}
      </div>

      {/* NEXA Notes — collapsible */}
      {vendor.nexaNotes && (
        <div>
          <button
            onClick={() => setNotesOpen(!notesOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              color: "#64748B",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "6px 0",
            }}
          >
            <i
              className={
                notesOpen
                  ? "fa-solid fa-chevron-down"
                  : "fa-solid fa-chevron-right"
              }
              style={{ fontSize: 10 }}
            />
            NEXA Notes
          </button>
          {notesOpen && (
            <div
              style={{
                background: "#F8FAFC",
                border: "1px solid #F1F5F9",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 13,
                color: "#475569",
                lineHeight: 1.5,
              }}
            >
              {vendor.nexaNotes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────
   Loading skeleton
   ──────────────────────────────────────────── */

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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginBottom: 16,
            }}
          >
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

/* ────────────────────────────────────────────
   Locked screen for non-authorized users
   ──────────────────────────────────────────── */

function LockedScreen() {
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
            Credit Report Pricing
          </h1>
          <p style={{ fontSize: 14, color: "#64748B", margin: 0 }}>
            Compare credit report vendors, pricing, and features.
          </p>
        </div>
      </div>

      {/* Generic locked card — no org names */}
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
            className="fa-solid fa-lock"
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
          Authorization Required
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "#64748B",
            margin: "0 auto",
            maxWidth: 420,
            lineHeight: 1.6,
          }}
        >
          This feature requires additional authorization. Contact your
          administrator for access.
        </p>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────
   Pill button used for sub-tabs
   ──────────────────────────────────────────── */

function PillButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "7px 16px",
        fontSize: 13,
        fontWeight: 600,
        borderRadius: 20,
        border: active ? "1px solid #2563EB" : "1px solid #E2E8F0",
        background: active ? "#2563EB" : "#FFFFFF",
        color: active ? "#FFFFFF" : "#475569",
        cursor: "pointer",
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

/* ────────────────────────────────────────────
   Top-level tab button
   ──────────────────────────────────────────── */

function TabButton({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 20px",
        fontSize: 14,
        fontWeight: 600,
        borderRadius: 8,
        border: "none",
        background: active ? "#2563EB" : "transparent",
        color: active ? "#FFFFFF" : "#64748B",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      <i className={icon} style={{ fontSize: 14 }} />
      {label}
    </button>
  );
}

/* ────────────────────────────────────────────
   Main page component
   ──────────────────────────────────────────── */

export default function CreditReportsPage() {
  const [isNexa, setIsNexa] = useState(false);
  const [nexaChecked, setNexaChecked] = useState(false);
  const [vendors, setVendors] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Top-level tabs
  const [activeTab, setActiveTab] = useState("pricing");
  // Pricing sub-tabs
  const [pricingSubTab, setPricingSubTab] = useState("hard");

  /* ── Auth check ── */
  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (isNexaUser()) {
        if (!cancelled) {
          setIsNexa(true);
          setNexaChecked(true);
        }
        return;
      }
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

  /* ── Fetch vendors once authorized ── */
  useEffect(() => {
    if (!nexaChecked || !isNexa) return;
    if (vendors) return;

    let cancelled = false;
    async function fetchVendors() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setVendors(sortVendors(data.vendors || []));
          setLastUpdated(data.lastUpdated || null);
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

  /* ── Still checking auth ── */
  if (!nexaChecked) {
    return (
      <div style={{ background: "#F8FAFC", minHeight: "100%" }}>
        <LoadingSkeleton />
      </div>
    );
  }

  /* ── Not authorized ── */
  if (!isNexa) {
    return <LockedScreen />;
  }

  /* ── Authorized: full page ── */
  const sorted = vendors || [];

  return (
    <div style={{ background: "#F8FAFC", minHeight: "100%" }}>
      {/* ── Page header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 28,
        }}
      >
        {/* Left: title + badge */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
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
            <div
              style={{ display: "flex", alignItems: "center", gap: 10 }}
            >
              <h1
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: "#0F172A",
                  margin: 0,
                }}
              >
                Credit Report Pricing
              </h1>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 20,
                  background: "linear-gradient(135deg, #2563EB, #7C3AED)",
                  color: "#FFFFFF",
                  letterSpacing: 0.3,
                }}
              >
                <i
                  className="fa-solid fa-star"
                  style={{ fontSize: 9 }}
                />
                Exclusive
              </span>
            </div>
            <p style={{ fontSize: 14, color: "#64748B", margin: "4px 0 0" }}>
              Compare credit report vendors, pricing, and features.
            </p>
          </div>
        </div>

        {/* Right: disclaimer + last updated */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 6,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#FFFBEB",
              border: "1px solid #FDE68A",
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: 12,
              color: "#92400E",
              fontWeight: 500,
              lineHeight: 1.4,
            }}
          >
            <i
              className="fa-solid fa-circle-info"
              style={{ fontSize: 11, flexShrink: 0 }}
            />
            Negotiated rates &mdash; contact your AE for exact pricing
          </div>
          {lastUpdated && (
            <span style={{ fontSize: 11, color: "#94A3B8" }}>
              Last updated:{" "}
              {new Date(lastUpdated).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          )}
        </div>
      </div>

      {/* ── Top-level tabs ── */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 24,
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: 10,
          padding: 4,
        }}
      >
        <TabButton
          icon="fa-solid fa-dollar-sign"
          label="Pricing"
          active={activeTab === "pricing"}
          onClick={() => setActiveTab("pricing")}
        />
        <TabButton
          icon="fa-solid fa-list-check"
          label="Features"
          active={activeTab === "features"}
          onClick={() => setActiveTab("features")}
        />
        <TabButton
          icon="fa-solid fa-building"
          label="Vendor Details"
          active={activeTab === "details"}
          onClick={() => setActiveTab("details")}
        />
      </div>

      {/* ── Content ── */}
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
            style={{
              fontSize: 28,
              color: "#EF4444",
              display: "block",
              marginBottom: 12,
            }}
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
      ) : sorted.length === 0 ? (
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
      ) : (
        <>
          {/* ────── PRICING TAB ────── */}
          {activeTab === "pricing" && (
            <div>
              {/* Sub-tab pills */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 20,
                  flexWrap: "wrap",
                }}
              >
                <PillButton
                  label="Hard Pull"
                  active={pricingSubTab === "hard"}
                  onClick={() => setPricingSubTab("hard")}
                />
                <PillButton
                  label="Soft Pull: Non-Trended"
                  active={pricingSubTab === "softNonTrended"}
                  onClick={() => setPricingSubTab("softNonTrended")}
                />
                <PillButton
                  label="Soft Pull: Trended (AUS)"
                  active={pricingSubTab === "softTrended"}
                  onClick={() => setPricingSubTab("softTrended")}
                />
                <PillButton
                  label="Add'l Services & Fees"
                  active={pricingSubTab === "addl"}
                  onClick={() => setPricingSubTab("addl")}
                />
              </div>

              {pricingSubTab === "hard" && (
                <HardPullTable vendors={sorted} />
              )}
              {pricingSubTab === "softNonTrended" && (
                <SoftPullNonTrendedTable vendors={sorted} />
              )}
              {pricingSubTab === "softTrended" && (
                <SoftPullTrendedTable vendors={sorted} />
              )}
              {pricingSubTab === "addl" && (
                <AddlServicesTable vendors={sorted} />
              )}
            </div>
          )}

          {/* ────── FEATURES TAB ────── */}
          {activeTab === "features" && (
            <FeaturesTable vendors={sorted} />
          )}

          {/* ────── VENDOR DETAILS TAB ────── */}
          {activeTab === "details" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(340px, 1fr))",
                gap: 16,
              }}
            >
              {sorted.map((v) => (
                <VendorDetailCard key={v.id} vendor={v} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
