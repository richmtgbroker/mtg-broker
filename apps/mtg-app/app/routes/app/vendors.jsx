import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router";
import { getUserEmail, getAccessToken } from "../../lib/auth";

export function meta() {
  return [{ title: "Vendors — MtgBroker" }];
}

/* Use same-origin proxy (Pages Functions) to avoid CORS issues */
const VENDORS_API = "/api/vendors";
const FAVORITES_API = "/api/favorites";
const CACHE_KEY = "vendors_directory_v4";
const CACHE_TTL = 10 * 60 * 1000;

function getInitial(name) {
  if (!name) return "?";
  return name.trim()[0].toUpperCase();
}

/* ── Toast ── */
function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: "#0F172A",
        color: "#fff",
        padding: "10px 24px",
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 500,
        zIndex: 10000,
        boxShadow: "0 4px 20px rgba(0,0,0,.25)",
      }}
    >
      <i className="fa-solid fa-check" style={{ marginRight: 8, color: "#4ADE80" }} />
      {message}
    </div>
  );
}

/* ── Skeleton Card ── */
function SkeletonCard() {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E2E8F0",
        borderRadius: 10,
        padding: 20,
        minHeight: 200,
      }}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#E2E8F0" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 140,
            height: 80,
            borderRadius: 8,
            background: "#E2E8F0",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
        <div
          style={{
            width: "50%",
            height: 14,
            borderRadius: 4,
            background: "#E2E8F0",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
        <div
          style={{
            width: "70%",
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

/* ── Main Page ── */
export default function VendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [toastMsg, setToastMsg] = useState(null);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  const email = typeof window !== "undefined" ? getUserEmail() : null;

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm]);

  // Load vendors
  useEffect(() => {
    async function load() {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.ts && Date.now() - parsed.ts < CACHE_TTL) {
            setVendors(parsed.data);
            setLoading(false);
            return;
          }
        }
      } catch {}

      try {
        const res = await fetch(VENDORS_API);
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        if (data.success && Array.isArray(data.vendors)) {
          const sorted = data.vendors.sort((a, b) =>
            (a.name || "").localeCompare(b.name || "")
          );
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: sorted }));
          } catch {}
          setVendors(sorted);
        }
      } catch {
        setVendors([]);
      }
      setLoading(false);
    }
    load();
  }, []);

  // Load favorites
  useEffect(() => {
    if (!email) return;
    async function loadFavs() {
      try {
        const res = await fetch(`${FAVORITES_API}?type=Vendor`, {
          headers: { Authorization: `Bearer ${getAccessToken()}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const favs = Array.isArray(data.favorites) ? data.favorites : Array.isArray(data) ? data : [];
        setFavorites(favs);
        setFavoriteIds(new Set(favs.map((f) => f.itemId)));
      } catch {}
    }
    loadFavs();
  }, [email]);

  const showToast = useCallback((msg) => setToastMsg(msg), []);

  const toggleFavorite = useCallback(
    async (vendor) => {
      if (!email) return;
      const vid = vendor.id;
      const wasFav = favoriteIds.has(vid);

      if (wasFav) {
        const favEntry = favorites.find((f) => f.itemId === vid);
        setFavorites((prev) => prev.filter((f) => f.itemId !== vid));
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          next.delete(vid);
          return next;
        });
        try {
          if (favEntry?.recordId) {
            await fetch(`${FAVORITES_API}/${favEntry.recordId}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${getAccessToken()}` },
            });
          }
        } catch {
          setFavorites((prev) => [...prev, favEntry]);
          setFavoriteIds((prev) => new Set([...prev, vid]));
        }
      } else {
        const tempFav = { itemType: "Vendor", itemId: vid, itemName: vendor.name, recordId: "__temp__" };
        setFavorites((prev) => [...prev, tempFav]);
        setFavoriteIds((prev) => new Set([...prev, vid]));
        try {
          const res = await fetch(FAVORITES_API, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${getAccessToken()}`,
            },
            body: JSON.stringify({
              itemType: "Vendor",
              itemId: vid,
              itemName: vendor.name,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.favorite) {
              setFavorites((prev) =>
                prev.map((f) => (f.recordId === "__temp__" && f.itemId === vid ? data.favorite : f))
              );
            }
          }
        } catch {
          setFavorites((prev) => prev.filter((f) => !(f.recordId === "__temp__" && f.itemId === vid)));
          setFavoriteIds((prev) => {
            const next = new Set(prev);
            next.delete(vid);
            return next;
          });
        }
      }
    },
    [email, favorites, favoriteIds]
  );

  // Unique categories from all vendors
  const categories = Array.from(
    new Set(
      vendors.flatMap((v) => (Array.isArray(v.categories) ? v.categories : []))
    )
  )
    .filter(Boolean)
    .sort();

  // Filter + sort
  const filtered = vendors
    .filter((v) => {
      if (showFavoritesOnly && !favoriteIds.has(v.id)) return false;
      if (categoryFilter) {
        const cats = Array.isArray(v.categories) ? v.categories : [];
        if (!cats.includes(categoryFilter)) return false;
      }
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        const haystack = [v.name, v.categoryRaw].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const aFav = favoriteIds.has(a.id) ? 0 : 1;
      const bFav = favoriteIds.has(b.id) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      return (a.name || "").localeCompare(b.name || "");
    });

  const hasFilters = debouncedSearch || categoryFilter || showFavoritesOnly;
  const favCount = favoriteIds.size;

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC" }}>
      {/* Page Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <i className="fa-solid fa-store" style={{ fontSize: 24, color: "#2563EB" }} />
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0F172A", margin: 0 }}>
          Vendor Directory
        </h1>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #E2E8F0",
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 20,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
          <i
            className="fa-solid fa-magnifying-glass"
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#94A3B8",
              fontSize: 13,
            }}
          />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search vendors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "9px 12px 9px 36px",
              border: "1px solid #E2E8F0",
              borderRadius: 8,
              fontSize: 14,
              outline: "none",
              background: "#F8FAFC",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{
            padding: "9px 12px",
            border: "1px solid #E2E8F0",
            borderRadius: 8,
            fontSize: 14,
            background: "#F8FAFC",
            color: categoryFilter ? "#0F172A" : "#64748B",
            cursor: "pointer",
            minWidth: 160,
          }}
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        {/* Favorites Toggle */}
        <button
          onClick={() => setShowFavoritesOnly((p) => !p)}
          style={{
            padding: "9px 16px",
            borderRadius: 8,
            border: showFavoritesOnly ? "1px solid #2563EB" : "1px solid #E2E8F0",
            background: showFavoritesOnly ? "#EFF6FF" : "#F8FAFC",
            color: showFavoritesOnly ? "#2563EB" : "#64748B",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <i className={showFavoritesOnly ? "fa-solid fa-heart" : "fa-regular fa-heart"} />
          Favorites
          {favCount > 0 && (
            <span
              style={{
                background: showFavoritesOnly ? "#2563EB" : "#94A3B8",
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 10,
                padding: "1px 7px",
                minWidth: 18,
                textAlign: "center",
              }}
            >
              {favCount}
            </span>
          )}
        </button>

        {/* Clear Filters */}
        {hasFilters && (
          <button
            onClick={() => {
              setSearchTerm("");
              setDebouncedSearch("");
              setCategoryFilter("");
              setShowFavoritesOnly(false);
            }}
            style={{
              padding: "9px 14px",
              borderRadius: 8,
              border: "1px solid #FCA5A5",
              background: "#FEF2F2",
              color: "#DC2626",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <i className="fa-solid fa-xmark" />
            Clear Filters
          </button>
        )}
      </div>

      {/* Status */}
      {!loading && (
        <div style={{ fontSize: 13, color: "#64748B", marginBottom: 16 }}>
          Showing {filtered.length} of {vendors.length} vendors
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
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
            className="fa-solid fa-store"
            style={{ fontSize: 40, color: "#CBD5E1", marginBottom: 12, display: "block" }}
          />
          <div style={{ fontSize: 16, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
            No vendors found
          </div>
          <div style={{ fontSize: 14, color: "#64748B" }}>
            Try adjusting your search or filters
          </div>
        </div>
      )}

      {/* Card Grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
          {filtered.map((v) => {
            const isFav = favoriteIds.has(v.id);
            const slug = v.slug || v.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            return (
              <div
                key={v.id}
                className="relative bg-white border border-[#cbd5e1] rounded-2xl overflow-hidden shadow-[0_3px_12px_rgba(0,0,0,0.1)] hover:shadow-[0_8px_24px_rgba(37,99,235,0.15)] hover:border-[#93c5fd] transition-all hover:-translate-y-0.5 flex flex-col"
              >
                {/* Logo Area */}
                <Link
                  to={`/app/vendors/${slug}`}
                  className="relative bg-[#f8fafc] flex items-center justify-center p-5 no-underline border-b border-[#cbd5e1]"
                  style={{ minHeight: "140px" }}
                >
                  {v.logo ? (
                    <img
                      src={v.logo}
                      alt={v.name}
                      className="max-w-[90%] max-h-[105px] object-contain"
                    />
                  ) : (
                    <div className="text-3xl font-bold text-[#94a3b8]">
                      {getInitial(v.name)}
                    </div>
                  )}

                  {/* Favorite heart */}
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(v); }}
                    className="absolute top-2 right-2 bg-transparent border-none cursor-pointer p-0 transition-colors"
                    aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
                  >
                    <svg viewBox="0 0 24 24" fill={isFav ? "#ef4444" : "none"} stroke={isFav ? "#ef4444" : "#cbd5e1"} strokeWidth="2" className="w-4 h-4">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </button>
                </Link>

                {/* Vendor Name */}
                <Link
                  to={`/app/vendors/${slug}`}
                  className="flex-1 flex items-center justify-center text-center px-3 pt-3 pb-1.5 no-underline"
                >
                  <h3 className="text-[13px] font-bold text-[#0f172a] leading-snug m-0">
                    {v.name}
                  </h3>
                </Link>

                {/* Action Buttons */}
                <div className="flex items-center justify-center gap-2 px-3 py-2.5">
                  {v.website && (
                    <a
                      href={v.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 text-center py-1.5 rounded-lg border border-[#93c5fd] bg-[#f0f7ff] text-[#1a56db] text-[11px] font-semibold no-underline hover:bg-[#dbeafe] transition-colors"
                    >
                      Website
                    </a>
                  )}
                  {v.loginPortal && (
                    <a
                      href={v.loginPortal}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 text-center py-1.5 rounded-lg border border-[#93c5fd] bg-[#f0f7ff] text-[#1a56db] text-[11px] font-semibold no-underline hover:bg-[#dbeafe] transition-colors"
                    >
                      Login Portal
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Toast */}
      {toastMsg && <Toast message={toastMsg} onDone={() => setToastMsg(null)} />}
    </div>
  );
}
