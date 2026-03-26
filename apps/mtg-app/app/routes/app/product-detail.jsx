import { useState, useEffect } from "react";
import { Link, useParams } from "react-router";
import { isNexaUser } from "../../lib/auth";

const API_BASE = "https://mtg-broker-api.rich-e00.workers.dev";

export function meta({ params }) {
  return [{ title: "Product Detail — MtgBroker" }];
}

export default function ProductDetailPage() {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [nexa, setNexa] = useState(false);

  useEffect(() => {
    setNexa(isNexaUser());
  }, []);

  useEffect(() => {
    if (!slug) { setError("Could not determine which product to load."); setLoading(false); return; }

    fetch(`${API_BASE}/api/loan-product-types?slug=${encodeURIComponent(slug)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.success || !data.product) {
          setError(data.error === "Product not found"
            ? "This product could not be found. It may have been removed or renamed."
            : "Could not load product data. Please refresh and try again.");
        } else {
          setProduct(data.product);
        }
        setLoading(false);
      })
      .catch(() => { setError("Could not load product data. Please refresh and try again."); setLoading(false); });
  }, [slug]);

  function handleCopyUrl() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  }

  function handleShare() {
    if (navigator.share && product) {
      navigator.share({ title: `${product.name} | mtg.broker`, text: `Check out ${product.name} on mtg.broker`, url: window.location.href }).catch(() => {});
    } else {
      handleCopyUrl();
    }
  }

  if (loading) {
    return (
      <div>
        <div className="h-5 w-48 rounded bg-surface-active animate-pulse mb-4" />
        <div className="h-24 rounded-2xl bg-surface-active animate-pulse mb-6" />
        <div className="h-48 rounded-2xl bg-surface-active animate-pulse mb-4" />
        <div className="h-36 rounded-2xl bg-surface-active animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Breadcrumb name="Not Found" />
        <div className="text-center py-16">
          <div className="text-5xl text-red-300 mb-4">&#9888;</div>
          <h3 className="text-xl font-bold text-text mb-2">Product Not Found</h3>
          <p className="text-text-muted mb-6">{error}</p>
          <Link to="/app/products" className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg no-underline font-medium hover:bg-primary-hover transition-colors">
            &larr; Back to Products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb name={product.name} />

      {/* Header */}
      <div className="bg-white rounded-2xl border border-border p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center text-white text-2xl shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-text-faint uppercase tracking-wide mb-1">Loan Product</p>
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl font-bold text-text">{product.name}</h1>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={handleCopyUrl} title="Copy link" className="w-9 h-9 rounded-lg border border-border bg-white flex items-center justify-center cursor-pointer hover:bg-surface-hover transition-colors text-text-muted">
                  {copied ? <span className="text-green-600 text-sm">&#10003;</span> : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                  )}
                </button>
                <button onClick={handleShare} title="Share" className="w-9 h-9 rounded-lg border border-border bg-white flex items-center justify-center cursor-pointer hover:bg-surface-hover transition-colors text-text-muted">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
                </button>
              </div>
            </div>
            {product.categoryTags && (
              <p className="text-sm text-text-muted mt-1">{product.categoryTags}</p>
            )}
          </div>
        </div>
      </div>

      {/* Sections */}
      {(product.sections || []).map((section, i) => {
        if (!section.fields?.length) return null;
        const isNexaSection = section.hasNexa === true;
        if (isNexaSection && !nexa) return null;

        return (
          <div key={i} className={`bg-white rounded-2xl border border-border p-6 mb-4 ${isNexaSection ? "border-primary-600 bg-gradient-to-br from-primary-50 to-white" : ""}`}>
            <h2 className="text-lg font-bold text-text mb-4 flex items-center gap-2">
              {isNexaSection && <span className="text-primary-600">&#9733;</span>}
              {section.name}
            </h2>
            {section.fields.map((field, j) => {
              if (field.nexaGated && !nexa) return null;
              return <FieldRenderer key={j} field={field} />;
            })}
          </div>
        );
      })}

      {/* Available Lenders */}
      <LendersSection product={product} />
    </div>
  );
}

// ============================================================
// BREADCRUMB
// ============================================================
function Breadcrumb({ name }) {
  return (
    <nav className="flex items-center gap-2 text-sm mb-4">
      <Link to="/app/products" className="text-primary-600 no-underline hover:underline flex items-center gap-1.5">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        </svg>
        Products
      </Link>
      <span className="text-text-faint">/</span>
      <span className="text-text-muted truncate">{name}</span>
    </nav>
  );
}

// ============================================================
// FIELD RENDERER
// ============================================================
function FieldRenderer({ field }) {
  const { renderMode = "list", value, displayName } = field;
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && (!value.trim() || value.trim() === "-")) return null;

  switch (renderMode) {
    case "pills":
      return (
        <div className="mb-2">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-active text-sm">
            <span className="font-semibold text-text-muted text-xs uppercase">{displayName}</span>
            {String(value)}
          </span>
        </div>
      );

    case "richtext":
      return (
        <div className="prose prose-sm max-w-none text-text-secondary leading-relaxed mb-4" dangerouslySetInnerHTML={{ __html: parseMarkdown(String(value)) }} />
      );

    case "notes":
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-3">
          <p className="text-xs font-semibold text-amber-800 uppercase mb-2">{displayName}</p>
          <div className="text-sm text-amber-900" dangerouslySetInnerHTML={{ __html: parseMarkdown(String(value)) }} />
        </div>
      );

    case "nexa":
    case "list":
    default: {
      const formatted = formatValue(value);
      if (!formatted) return null;
      return (
        <div className="flex items-start py-2.5 border-b border-border last:border-b-0">
          <span className="text-sm font-medium text-text-muted w-[180px] shrink-0">{displayName}</span>
          <span className="text-sm text-text flex-1" dangerouslySetInnerHTML={{ __html: formatted }} />
        </div>
      );
    }
  }
}

// ============================================================
// LENDERS SECTION
// ============================================================
function LendersSection({ product }) {
  const rollup = product.lendersRollup || "";
  if (!rollup.trim()) return null;

  const lenderNames = parseLenderCsv(rollup).sort((a, b) => a.localeCompare(b));
  if (!lenderNames.length) return null;

  return (
    <div className="bg-white rounded-2xl border border-border p-6 mb-4">
      <h2 className="text-lg font-bold text-text mb-1">Available Lenders ({lenderNames.length})</h2>
      <p className="text-sm text-text-muted mb-4">{product.name}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {lenderNames.map((name) => (
          <Link
            key={name}
            to={`/app/lenders/${toLenderSlug(name)}`}
            className="flex items-center justify-between px-4 py-3 rounded-xl border border-border no-underline text-sm font-medium text-text hover:border-primary-200 hover:bg-primary-50/30 transition-all"
          >
            {name}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-text-faint shrink-0">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// UTILITIES
// ============================================================
function formatValue(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === "boolean") return val ? "&#10003; Yes" : "&#10007; No";

  if (Array.isArray(val) && val.length > 0 && val[0]?.url) {
    return val.map((att) => {
      const filename = att.filename || "Download";
      const isImage = att.type?.startsWith("image/");
      if (isImage) return `<a href="${escapeAttr(att.url)}" target="_blank" rel="noopener"><img src="${escapeAttr(att.url)}" alt="${escapeAttr(filename)}" style="max-height:120px;border-radius:6px;margin-top:4px;" /></a>`;
      return `<a href="${escapeAttr(att.url)}" target="_blank" rel="noopener">${escapeHtml(filename)}</a>`;
    }).join("<br>");
  }

  if (Array.isArray(val)) {
    return val.map((v) => `<span style="display:inline-block;padding:2px 8px;background:#f1f5f9;border-radius:6px;font-size:13px;margin:2px 4px 2px 0;">${escapeHtml(String(v))}</span>`).join(" ");
  }

  const str = String(val).trim();
  if (!str || str === "-") return null;
  if (str.startsWith("http")) return `<a href="${escapeAttr(str)}" target="_blank" rel="noopener" style="color:#2563eb;">Open Link &#8599;</a>`;
  return escapeHtml(str).replace(/\n/g, "<br>");
}

function parseMarkdown(text) {
  if (!text) return "";
  const lines = text.split("\n");
  let output = "";
  let inUL = false, inOL = false;

  function closeList() {
    if (inUL) { output += "</ul>"; inUL = false; }
    if (inOL) { output += "</ol>"; inOL = false; }
  }

  function inline(str) {
    str = escapeHtml(str);
    str = str.replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>");
    str = str.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    str = str.replace(/\*(.*?)\*/g, "<em>$1</em>");
    str = str.replace(/_(.*?)_/g, "<em>$1</em>");
    str = str.replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:1px 5px;border-radius:3px;font-size:0.9em;">$1</code>');
    str = str.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return str;
  }

  lines.forEach((raw) => {
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(raw.trim())) { closeList(); output += '<hr style="border:none;border-top:1px solid #e2e8f0;margin:12px 0;">'; return; }
    const hm = raw.match(/^(#{1,6})\s+(.*)/);
    if (hm) { closeList(); const lvl = Math.min(hm[1].length + 2, 6); output += `<h${lvl} style="margin:14px 0 6px;font-weight:600;">${inline(hm[2])}</h${lvl}>`; return; }
    const ulm = raw.match(/^[\s]*[-*]\s+(.*)/);
    if (ulm) { if (inOL) { output += "</ol>"; inOL = false; } if (!inUL) { output += '<ul style="margin:6px 0 6px 20px;padding:0;">'; inUL = true; } output += `<li>${inline(ulm[1])}</li>`; return; }
    const olm = raw.match(/^[\s]*\d+\.\s+(.*)/);
    if (olm) { if (inUL) { output += "</ul>"; inUL = false; } if (!inOL) { output += '<ol style="margin:6px 0 6px 20px;padding:0;">'; inOL = true; } output += `<li>${inline(olm[1])}</li>`; return; }
    if (!raw.trim()) { closeList(); output += "<br>"; return; }
    closeList();
    output += `<p style="margin:4px 0;">${inline(raw)}</p>`;
  });
  closeList();
  return output;
}

function parseLenderCsv(str) {
  const results = [];
  let current = "", inQuotes = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === "," && !inQuotes) { const t = current.trim(); if (t) results.push(t); current = ""; }
    else current += ch;
  }
  const last = current.trim();
  if (last) results.push(last);
  return results;
}

function toLenderSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").trim().replace(/\s+/g, "-").replace(/-+/g, "-");
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeAttr(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
