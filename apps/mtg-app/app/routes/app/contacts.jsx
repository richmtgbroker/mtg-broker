import { useState, useEffect, useCallback, useRef } from "react";
import { getUserEmail, isAdmin } from "../../lib/auth";

export function meta() {
  return [{ title: "Contacts — MtgBroker" }];
}

/* Use same-origin proxy (Pages Functions) to avoid CORS issues */
const CONTACTS_API = "/api/contacts";
const FAVORITES_API = "/api/favorites";
const CACHE_KEY = "contacts_directory_v4";
const CACHE_TTL = 10 * 60 * 1000;

function formatPhone(raw) {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const num = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (num.length === 10) {
    return `(${num.slice(0, 3)}) ${num.slice(3, 6)}-${num.slice(6)}`;
  }
  return raw;
}

function rawDigits(raw) {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function copyToClipboard(text, toast) {
  navigator.clipboard.writeText(text).then(() => toast("Copied to clipboard"));
}

function buildAllContactText(c) {
  const lines = [c.name];
  if (c.jobTitle) lines.push(c.jobTitle);
  if (c.company) lines.push(c.company);
  if (c.email) lines.push(`Email: ${c.email}`);
  if (c.mobile) lines.push(`Mobile: ${formatPhone(c.mobile)}`);
  if (c.office) {
    let ph = `Office: ${formatPhone(c.office)}`;
    if (c.extension) ph += ` x${c.extension}`;
    lines.push(ph);
  }
  if (c.linkedin) lines.push(`LinkedIn: ${c.linkedin}`);
  if (c.zoomRoom) lines.push(`Zoom: ${c.zoomRoom}`);
  return lines.join("\n");
}

/* ── Toast Component ── */
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
        minHeight: 160,
      }}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#E2E8F0" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "#E2E8F0",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
        <div
          style={{
            width: "60%",
            height: 14,
            borderRadius: 4,
            background: "#E2E8F0",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
        <div
          style={{
            width: "45%",
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

/* ── Contact Modal ── */
function ContactModal({ contact, onClose, favoriteIds, onToggleFav, showToast }) {
  const c = contact;
  if (!c) return null;
  const admin = isAdmin();
  const isFav = favoriteIds.has(c.recordId);

  function ActionRow({ icon, iconBg, label, href, displayText, copyText }) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 0",
          borderBottom: "1px solid #F1F5F9",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <i className={icon} style={{ color: "#fff", fontSize: 14 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {label}
          </div>
          <a
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
            style={{ fontSize: 14, color: "#2563EB", textDecoration: "none", wordBreak: "break-all" }}
          >
            {displayText}
          </a>
        </div>
        <button
          onClick={() => copyToClipboard(copyText, showToast)}
          style={{
            background: "none",
            border: "1px solid #E2E8F0",
            borderRadius: 6,
            padding: "6px 8px",
            cursor: "pointer",
            color: "#64748B",
            flexShrink: 0,
          }}
          title="Copy"
        >
          <i className="fa-regular fa-copy" style={{ fontSize: 13 }} />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 14,
          width: "100%",
          maxWidth: 400,
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,.3)",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #0C4A6E, #1D4ED8)",
            borderRadius: "14px 14px 0 0",
            padding: "28px 24px 24px",
            textAlign: "center",
            position: "relative",
          }}
        >
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: "none",
              background: "rgba(255,255,255,.2)",
              color: "#fff",
              fontSize: 16,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <i className="fa-solid fa-xmark" />
          </button>
          {c.headshotUrl ? (
            <img
              src={c.headshotUrl}
              alt={c.name}
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                objectFit: "cover",
                border: "3px solid rgba(255,255,255,.3)",
                margin: "0 auto 12px",
                display: "block",
              }}
            />
          ) : (
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "rgba(255,255,255,.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 12px",
                fontSize: 24,
                fontWeight: 700,
                color: "#fff",
              }}
            >
              {getInitials(c.name)}
            </div>
          )}
          <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
            {c.preferredName || c.name}
          </div>
          {c.jobTitle && (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.8)" }}>{c.jobTitle}</div>
          )}
          {c.company && (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.6)", marginTop: 2 }}>
              {c.company}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: "16px 24px" }}>
          {c.email && (
            <ActionRow
              icon="fa-solid fa-envelope"
              iconBg="#2563EB"
              label="Email"
              href={`mailto:${c.email}`}
              displayText={c.email}
              copyText={c.email}
            />
          )}
          {c.mobile && (
            <ActionRow
              icon="fa-solid fa-mobile-screen"
              iconBg="#16A34A"
              label="Mobile"
              href={`tel:${rawDigits(c.mobile)}`}
              displayText={formatPhone(c.mobile)}
              copyText={formatPhone(c.mobile)}
            />
          )}
          {c.office && (
            <ActionRow
              icon="fa-solid fa-phone"
              iconBg="#7C3AED"
              label="Office"
              href={`tel:${rawDigits(c.office)}`}
              displayText={
                formatPhone(c.office) + (c.extension ? ` x${c.extension}` : "")
              }
              copyText={
                formatPhone(c.office) + (c.extension ? ` x${c.extension}` : "")
              }
            />
          )}
          {c.linkedin && (
            <ActionRow
              icon="fa-brands fa-linkedin-in"
              iconBg="#0A66C2"
              label="LinkedIn"
              href={c.linkedin}
              displayText="View Profile"
              copyText={c.linkedin}
            />
          )}
          {c.zoomRoom && (
            <ActionRow
              icon="fa-solid fa-video"
              iconBg="#DC2626"
              label="Zoom Room"
              href={c.zoomRoom}
              displayText="Join Meeting"
              copyText={c.zoomRoom}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "0 24px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={() => copyToClipboard(buildAllContactText(c), showToast)}
            style={{
              width: "100%",
              padding: "10px 0",
              borderRadius: 8,
              border: "1px solid #E2E8F0",
              background: "#F8FAFC",
              color: "#334155",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <i className="fa-regular fa-copy" />
            Copy All Contact Info
          </button>
          {admin && (
            <a
              href={`https://airtable.com/appuJgI9X93OLaf0u/tblEEDPa1vXeR6cnT/viwXP46Ml5H2RHml3/${c.recordId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                width: "100%",
                padding: "10px 0",
                borderRadius: 8,
                border: "1px solid #E2E8F0",
                background: "#fff",
                color: "#2563EB",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <i className="fa-solid fa-up-right-from-square" />
              View in Airtable
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [selectedContact, setSelectedContact] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const searchRef = useRef(null);

  const email = typeof window !== "undefined" ? getUserEmail() : null;

  // Load contacts
  useEffect(() => {
    async function load() {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.ts && Date.now() - parsed.ts < CACHE_TTL) {
            setContacts(parsed.data);
            setLoading(false);
            return;
          }
        }
      } catch {}

      try {
        const res = await fetch(CONTACTS_API);
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        if (data.success && Array.isArray(data.contacts)) {
          const sorted = data.contacts.sort((a, b) =>
            (a.name || "").localeCompare(b.name || "")
          );
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: sorted }));
          } catch {}
          setContacts(sorted);
        }
      } catch {
        setContacts([]);
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
        const res = await fetch(`${FAVORITES_API}?type=Contact`, {
          headers: { Authorization: `Bearer ${email}` },
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
    async (contact) => {
      if (!email) return;
      const rid = contact.recordId;
      const wasFav = favoriteIds.has(rid);

      if (wasFav) {
        // Optimistic remove
        const favEntry = favorites.find((f) => f.itemId === rid);
        setFavorites((prev) => prev.filter((f) => f.itemId !== rid));
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          next.delete(rid);
          return next;
        });
        try {
          if (favEntry?.recordId) {
            await fetch(`${FAVORITES_API}/${favEntry.recordId}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${email}` },
            });
          }
        } catch {
          // Revert
          setFavorites((prev) => [...prev, favEntry]);
          setFavoriteIds((prev) => new Set([...prev, rid]));
        }
      } else {
        // Optimistic add
        const tempFav = { itemType: "Contact", itemId: rid, itemName: contact.name, recordId: "__temp__" };
        setFavorites((prev) => [...prev, tempFav]);
        setFavoriteIds((prev) => new Set([...prev, rid]));
        try {
          const res = await fetch(FAVORITES_API, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${email}`,
            },
            body: JSON.stringify({
              itemType: "Contact",
              itemId: rid,
              itemName: contact.name,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.favorite) {
              setFavorites((prev) =>
                prev.map((f) => (f.recordId === "__temp__" && f.itemId === rid ? data.favorite : f))
              );
            }
          }
        } catch {
          // Revert
          setFavorites((prev) => prev.filter((f) => !(f.recordId === "__temp__" && f.itemId === rid)));
          setFavoriteIds((prev) => {
            const next = new Set(prev);
            next.delete(rid);
            return next;
          });
        }
      }
    },
    [email, favorites, favoriteIds]
  );

  // Unique companies
  const companies = Array.from(
    new Set(contacts.map((c) => c.company).filter(Boolean))
  ).sort();

  // Filter + sort
  const filtered = contacts
    .filter((c) => {
      if (showFavoritesOnly && !favoriteIds.has(c.recordId)) return false;
      if (companyFilter && c.company !== companyFilter) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const haystack = [c.name, c.preferredName, c.company, c.jobTitle]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const aFav = favoriteIds.has(a.recordId) ? 0 : 1;
      const bFav = favoriteIds.has(b.recordId) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      return (a.name || "").localeCompare(b.name || "");
    });

  const hasFilters = searchTerm || companyFilter || showFavoritesOnly;
  const favCount = favoriteIds.size;

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC" }}>
      {/* Page Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <i className="fa-solid fa-address-book" style={{ fontSize: 24, color: "#2563EB" }} />
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0F172A", margin: 0 }}>
          Contact Directory
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
            placeholder="Search contacts..."
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

        {/* Company Filter */}
        <select
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          style={{
            padding: "9px 12px",
            border: "1px solid #E2E8F0",
            borderRadius: 8,
            fontSize: 14,
            background: "#F8FAFC",
            color: companyFilter ? "#0F172A" : "#64748B",
            cursor: "pointer",
            minWidth: 160,
          }}
        >
          <option value="">All Companies</option>
          {companies.map((co) => (
            <option key={co} value={co}>
              {co}
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
              setCompanyFilter("");
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
          Showing {filtered.length} of {contacts.length} contacts
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 16,
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
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
            className="fa-solid fa-address-book"
            style={{ fontSize: 40, color: "#CBD5E1", marginBottom: 12, display: "block" }}
          />
          <div style={{ fontSize: 16, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
            No contacts found
          </div>
          <div style={{ fontSize: 14, color: "#64748B" }}>
            Try adjusting your search or filters
          </div>
        </div>
      )}

      {/* Card Grid */}
      {!loading && filtered.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 16,
          }}
        >
          {filtered.map((c) => {
            const isFav = favoriteIds.has(c.recordId);
            return (
              <div
                key={c.id || c.recordId}
                onClick={() => setSelectedContact(c)}
                style={{
                  background: "#fff",
                  border: "1px solid #E2E8F0",
                  borderRadius: 10,
                  padding: 20,
                  cursor: "pointer",
                  position: "relative",
                  transition: "box-shadow .15s, transform .15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.08)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "none";
                }}
              >
                {/* Heart */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(c);
                  }}
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 4,
                    fontSize: 16,
                    color: isFav ? "#EF4444" : "#CBD5E1",
                    lineHeight: 1,
                  }}
                  title={isFav ? "Remove from favorites" : "Add to favorites"}
                >
                  <i className={isFav ? "fa-solid fa-heart" : "fa-regular fa-heart"} />
                </button>

                {/* Photo / Initials */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  {c.headshotUrl ? (
                    <img
                      src={c.headshotUrl}
                      alt={c.name}
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: "50%",
                        objectFit: "cover",
                        marginBottom: 10,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: "50%",
                        background: "#2563EB",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 10,
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 18,
                      }}
                    >
                      {getInitials(c.name)}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#0F172A",
                      textAlign: "center",
                      lineHeight: 1.3,
                      marginBottom: 4,
                    }}
                  >
                    {c.preferredName || c.name}
                  </div>
                  {c.jobTitle && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#64748B",
                        textAlign: "center",
                        lineHeight: 1.3,
                        marginBottom: 2,
                      }}
                    >
                      {c.jobTitle}
                    </div>
                  )}
                  {c.company && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "#94A3B8",
                        textAlign: "center",
                      }}
                    >
                      {c.company}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {selectedContact && (
        <ContactModal
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          favoriteIds={favoriteIds}
          onToggleFav={toggleFavorite}
          showToast={showToast}
        />
      )}

      {/* Toast */}
      {toastMsg && <Toast message={toastMsg} onDone={() => setToastMsg(null)} />}
    </div>
  );
}
