import { useState, useEffect } from "react";
import { Link } from "react-router";
import { getUserEmail, getAccessToken } from "../../lib/auth";
import { getLenderFavorite } from "../../hooks/useUserPreferences";

export function meta() {
  return [{ title: "Saved Items — MtgBroker" }];
}

const API_BASE = "https://mtg-broker-api.rich-e00.workers.dev/api/favorites";

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
    const slug = item.itemId || slugify(item.itemName);
    return `/app/lenders/${slug}`;
  }
  return "#";
}

/* ── Skeleton loader ── */
function SkeletonCard() {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E2E8F0",
        borderRadius: 10,
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
          background: "#E2E8F0",
          animation: "pulse 1.5s ease-in-out infinite",
        }}
      />
      <div style={{ flex: 1 }}>
        <div
          style={{
            width: "40%",
            height: 14,
            borderRadius: 4,
            background: "#E2E8F0",
            marginBottom: 8,
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
        <div
          style={{
            width: "25%",
            height: 10,
            borderRadius: 4,
            background: "#E2E8F0",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
      </div>
    </div>
  );
}

export default function SavedPage() {
  const [activeTab, setActiveTab] = useState("All");
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [removing, setRemoving] = useState({});

  const email = typeof window !== "undefined" ? getUserEmail() : null;
  const loggedIn = !!email;

  useEffect(() => {
    if (!loggedIn) {
      setLoading(false);
      return;
    }
    fetchFavorites();
  }, [loggedIn]);

  async function fetchFavorites() {
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
  }

  async function removeFavorite(favId) {
    setRemoving((prev) => ({ ...prev, [favId]: true }));
    // Optimistically remove
    setFavorites((prev) => prev.filter((f) => f.id !== favId));
    try {
      const res = await fetch(`${API_BASE}/${favId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${email}` },
      });
      if (!res.ok) {
        // Revert on failure
        await fetchFavorites();
      }
    } catch {
      await fetchFavorites();
    } finally {
      setRemoving((prev) => {
        const next = { ...prev };
        delete next[favId];
        return next;
      });
    }
  }

  const filtered =
    activeTab === "All"
      ? favorites
      : favorites.filter((f) => f.itemType === activeTab);

  /* ── Tab pill style ── */
  function tabStyle(key) {
    const active = key === activeTab;
    return {
      padding: "6px 16px",
      borderRadius: 999,
      border: active ? "1px solid #2563EB" : "1px solid #E2E8F0",
      background: active ? "#2563EB" : "#fff",
      color: active ? "#fff" : "#64748B",
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer",
      transition: "all 0.15s",
    };
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC" }}>
      {/* Pulse animation for skeletons */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {/* Page Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <i className="fa-solid fa-bookmark" style={{ fontSize: 24, color: "#2563EB" }} />
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0F172A", margin: 0 }}>
          Saved Items
        </h1>
      </div>

      {/* Not logged in */}
      {!loggedIn && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #E2E8F0",
            borderRadius: 10,
            padding: "48px 32px",
            textAlign: "center",
          }}
        >
          <i
            className="fa-solid fa-right-to-bracket"
            style={{ fontSize: 40, color: "#94A3B8", display: "block", marginBottom: 16 }}
          />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: "0 0 8px" }}>
            Sign in to view your saved items
          </h2>
          <p style={{ fontSize: 14, color: "#64748B", margin: 0 }}>
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
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: 10,
                padding: 20,
                color: "#DC2626",
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
                  border: "1px solid #DC2626",
                  background: "transparent",
                  color: "#DC2626",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Favorites List */}
          {!loading && !error && filtered.length > 0 && (
            <div>
              {filtered.map((fav) => {
                const icon = TYPE_ICONS[fav.itemType] || "fa-solid fa-star";
                const badgeColor = TYPE_COLORS[fav.itemType] || "#64748B";
                const href = itemLink(fav);

                return (
                  <div
                    key={fav.id}
                    style={{
                      background: "#fff",
                      border: "1px solid #E2E8F0",
                      borderRadius: 10,
                      padding: "16px 20px",
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      marginBottom: 10,
                      transition: "box-shadow 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    {/* Type Icon */}
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 8,
                        background: badgeColor + "12",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <i className={icon} style={{ fontSize: 18, color: badgeColor }} />
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <Link
                          to={href}
                          style={{
                            fontSize: 15,
                            fontWeight: 600,
                            color: "#0F172A",
                            textDecoration: "none",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          onMouseEnter={(e) => { e.target.style.color = "#2563EB"; }}
                          onMouseLeave={(e) => { e.target.style.color = "#0F172A"; }}
                        >
                          {fav.itemName || "Untitled"}
                        </Link>
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
                      <div style={{ fontSize: 12, color: "#94A3B8" }}>
                        Added {formatDate(fav.dateAdded)}
                      </div>
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => removeFavorite(fav.id)}
                      disabled={removing[fav.id]}
                      title="Remove from saved"
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        border: "1px solid #E2E8F0",
                        background: "transparent",
                        color: "#94A3B8",
                        cursor: removing[fav.id] ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        transition: "all 0.15s",
                        opacity: removing[fav.id] ? 0.5 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!removing[fav.id]) {
                          e.currentTarget.style.color = "#DC2626";
                          e.currentTarget.style.borderColor = "#FECACA";
                          e.currentTarget.style.background = "#FEF2F2";
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "#94A3B8";
                        e.currentTarget.style.borderColor = "#E2E8F0";
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <i className="fa-solid fa-trash" style={{ fontSize: 13 }} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && filtered.length === 0 && (
            <div
              style={{
                background: "#fff",
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                padding: "48px 32px",
                textAlign: "center",
              }}
            >
              <i
                className="fa-solid fa-bookmark"
                style={{ fontSize: 48, color: "#94A3B8", display: "block", marginBottom: 16 }}
              />
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: "0 0 8px" }}>
                {activeTab === "All"
                  ? "No saved items yet"
                  : `No saved ${activeTab.toLowerCase()}s yet`}
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: "#64748B",
                  maxWidth: 420,
                  margin: "0 auto",
                  lineHeight: 1.6,
                }}
              >
                {activeTab === "All"
                  ? "Bookmark your favorite lenders, vendors, and contacts to access them quickly from here."
                  : `You haven't saved any ${activeTab.toLowerCase()}s yet. Browse and bookmark items to see them here.`}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
