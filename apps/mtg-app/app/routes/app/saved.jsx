import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router";
import { getUserEmail } from "../../lib/auth";

const API_BASE = "https://mtg-broker-favorites.rich-e00.workers.dev/api/favorites";

export function meta() {
  return [{ title: "Saved Items — MtgBroker" }];
}

// ============================================================
// DESIGN TOKENS
// ============================================================
const C = {
  bg: "#F8FAFC",
  card: "#FFFFFF",
  border: "#E2E8F0",
  blue: "#2563EB",
  text: "#0F172A",
  muted: "#64748B",
  dim: "#94A3B8",
  red: "#DC2626",
  redBg: "#FEF2F2",
  radius: 10,
};

const TABS = [
  { key: "All", label: "All" },
  { key: "Lender", label: "Lenders" },
  { key: "Vendor", label: "Vendors" },
  { key: "Contact", label: "Contacts" },
];

const TYPE_ICONS = {
  Lender: "fa-solid fa-building-columns",
  Vendor: "fa-solid fa-store",
  Contact: "fa-solid fa-user",
};

const TYPE_COLORS = {
  Lender: "#2563EB",
  Vendor: "#7C3AED",
  Contact: "#059669",
};

const TYPE_DIRECTORIES = {
  Lender: "lender directory",
  Vendor: "vendor directory",
  Contact: "contacts list",
};

// ============================================================
// HELPERS
// ============================================================
function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function slugify(name) {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function itemLink(item) {
  if (item.itemType === "Lender") {
    const slug = slugify(item.itemName);
    return `/app/lenders/${slug}`;
  }
  return null;
}

// ============================================================
// SKELETON CARD
// ============================================================
function SkeletonCard() {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: C.radius,
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        marginBottom: 10,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          background: C.border,
          animation: "pulse 1.5s ease-in-out infinite",
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1 }}>
        <div
          style={{
            width: "40%",
            height: 14,
            borderRadius: 4,
            background: C.border,
            marginBottom: 8,
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
        <div
          style={{
            width: "25%",
            height: 10,
            borderRadius: 4,
            background: C.border,
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
      </div>
    </div>
  );
}

// ============================================================
// SAVED ITEM CARD
// ============================================================
function SavedItemCard({ fav, onRemove, removing }) {
  const icon = TYPE_ICONS[fav.itemType] || "fa-solid fa-star";
  const badgeColor = TYPE_COLORS[fav.itemType] || C.muted;
  const href = itemLink(fav);

  const nameElement = href ? (
    <Link
      to={href}
      style={{
        fontSize: 15,
        fontWeight: 600,
        color: C.text,
        textDecoration: "none",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => { e.target.style.color = C.blue; }}
      onMouseLeave={(e) => { e.target.style.color = C.text; }}
    >
      {fav.itemName || "Untitled"}
    </Link>
  ) : (
    <span
      style={{
        fontSize: 15,
        fontWeight: 600,
        color: C.text,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {fav.itemName || "Untitled"}
    </span>
  );

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: C.radius,
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        marginBottom: 10,
        transition: "box-shadow 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
    >
      {/* Type Icon */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: badgeColor + "14",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <i className={icon} style={{ fontSize: 16, color: badgeColor }} />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          {nameElement}
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: badgeColor,
              background: badgeColor + "14",
              padding: "2px 8px",
              borderRadius: 999,
              whiteSpace: "nowrap",
            }}
          >
            {fav.itemType}
          </span>
        </div>
        <div style={{ fontSize: 12, color: C.dim }}>
          Added {formatDate(fav.dateAdded)}
        </div>
      </div>

      {/* Remove Button */}
      <button
        onClick={() => onRemove(fav.id)}
        disabled={removing}
        title="Remove from saved"
        style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          border: `1px solid ${C.border}`,
          background: "transparent",
          color: C.dim,
          cursor: removing ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "all 0.15s",
          opacity: removing ? 0.5 : 1,
        }}
        onMouseEnter={(e) => {
          if (!removing) {
            e.currentTarget.style.color = C.red;
            e.currentTarget.style.borderColor = "#FECACA";
            e.currentTarget.style.background = C.redBg;
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = C.dim;
          e.currentTarget.style.borderColor = C.border;
          e.currentTarget.style.background = "transparent";
        }}
      >
        <i className="fa-solid fa-trash-can" style={{ fontSize: 13 }} />
      </button>
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function SavedPage() {
  const [activeTab, setActiveTab] = useState("All");
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [removing, setRemoving] = useState({});

  const email = typeof window !== "undefined" ? getUserEmail() : null;
  const loggedIn = !!email;

  const fetchFavorites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_BASE, {
        headers: { Authorization: `Bearer ${email}` },
      });
      if (!res.ok) throw new Error("Failed to load favorites");
      const data = await res.json();
      const items = (data.favorites || []).sort(
        (a, b) => new Date(b.dateAdded) - new Date(a.dateAdded)
      );
      setFavorites(items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    if (!loggedIn) {
      setLoading(false);
      return;
    }
    fetchFavorites();
  }, [loggedIn, fetchFavorites]);

  const removeFavorite = useCallback(async (favId) => {
    setRemoving((prev) => ({ ...prev, [favId]: true }));
    // Store for revert
    const prevFavorites = favorites;
    // Optimistic delete
    setFavorites((prev) => prev.filter((f) => f.id !== favId));
    try {
      const res = await fetch(`${API_BASE}/${favId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${email}` },
      });
      if (!res.ok) {
        // Revert on failure
        setFavorites(prevFavorites);
      }
    } catch {
      setFavorites(prevFavorites);
    } finally {
      setRemoving((prev) => {
        const next = { ...prev };
        delete next[favId];
        return next;
      });
    }
  }, [favorites, email]);

  const filtered =
    activeTab === "All"
      ? favorites
      : favorites.filter((f) => f.itemType === activeTab);

  // Tab pill style
  function tabStyle(key) {
    const active = key === activeTab;
    return {
      padding: "6px 16px",
      borderRadius: 999,
      border: active ? `1px solid ${C.blue}` : `1px solid ${C.border}`,
      background: active ? C.blue : C.card,
      color: active ? "#fff" : C.muted,
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer",
      transition: "all 0.15s",
    };
  }

  // Empty state messaging
  function getEmptyMessage() {
    if (activeTab === "All") {
      return {
        title: "No saved items yet",
        desc: "Bookmark your favorite lenders, vendors, and contacts to access them quickly from here.",
      };
    }
    const typeLabel = activeTab.toLowerCase() + "s";
    const directory = TYPE_DIRECTORIES[activeTab] || "directory";
    return {
      title: `No saved ${typeLabel} yet`,
      desc: `Browse the ${directory} to start saving.`,
    };
  }

  return (
    <div style={{ minHeight: "100%", fontFamily: "inherit" }}>
      {/* Pulse animation for skeletons */}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {/* Page Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "#DBEAFE",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <i className="fa-solid fa-bookmark" style={{ fontSize: 18, color: C.blue }} />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: 0 }}>
          Saved Items
        </h1>
      </div>

      {/* Not logged in */}
      {!loggedIn && (
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: C.radius,
            padding: "48px 32px",
            textAlign: "center",
          }}
        >
          <i
            className="fa-solid fa-right-to-bracket"
            style={{ fontSize: 40, color: C.dim, display: "block", marginBottom: 16 }}
          />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: "0 0 8px" }}>
            Sign in to view your saved items
          </h2>
          <p style={{ fontSize: 14, color: C.muted, margin: 0, lineHeight: 1.6 }}>
            Log in to save and access your favorite lenders, vendors, and contacts.
          </p>
        </div>
      )}

      {loggedIn && (
        <>
          {/* Tab Filters */}
          <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={tabStyle(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Loading Skeleton */}
          {loading && (
            <div>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div
              style={{
                background: C.redBg,
                border: "1px solid #FECACA",
                borderRadius: C.radius,
                padding: 20,
                color: C.red,
                fontSize: 14,
                textAlign: "center",
              }}
            >
              <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 8 }} />
              {error}
              <button
                onClick={fetchFavorites}
                style={{
                  marginLeft: 12,
                  padding: "4px 12px",
                  borderRadius: 6,
                  border: `1px solid ${C.red}`,
                  background: "transparent",
                  color: C.red,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Favorites List (full-width rows) */}
          {!loading && !error && filtered.length > 0 && (
            <div>
              {filtered.map((fav) => (
                <SavedItemCard
                  key={fav.id}
                  fav={fav}
                  onRemove={removeFavorite}
                  removing={!!removing[fav.id]}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && filtered.length === 0 && (
            <div
              style={{
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: C.radius,
                padding: "48px 32px",
                textAlign: "center",
              }}
            >
              <i
                className="fa-solid fa-bookmark"
                style={{ fontSize: 48, color: C.dim, display: "block", marginBottom: 16 }}
              />
              <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: "0 0 8px" }}>
                {getEmptyMessage().title}
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: C.muted,
                  maxWidth: 420,
                  margin: "0 auto",
                  lineHeight: 1.6,
                }}
              >
                {getEmptyMessage().desc}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
