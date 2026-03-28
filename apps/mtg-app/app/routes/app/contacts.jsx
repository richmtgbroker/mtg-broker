import { Link } from "react-router";

export function meta() {
  return [{ title: "Contacts — MtgBroker" }];
}

const FEATURE_CARDS = [
  { icon: "fa-solid fa-user-group", title: "Client Contacts", desc: "Coming soon" },
  { icon: "fa-solid fa-handshake", title: "Referral Partners", desc: "Coming soon" },
  { icon: "fa-solid fa-house-user", title: "Real Estate Agents", desc: "Coming soon" },
  { icon: "fa-solid fa-building", title: "Service Providers", desc: "Coming soon" },
];

export default function ContactsPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC" }}>
      {/* Page Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
        <i
          className="fa-solid fa-address-book"
          style={{ fontSize: 24, color: "#2563EB" }}
        />
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0F172A", margin: 0 }}>
          Contact Manager
        </h1>
      </div>

      {/* Empty State Card */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #E2E8F0",
          borderRadius: 10,
          padding: "48px 32px",
          textAlign: "center",
        }}
      >
        {/* Large Icon */}
        <i
          className="fa-solid fa-address-book"
          style={{ fontSize: 48, color: "#94A3B8", display: "block", marginBottom: 16 }}
        />

        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", margin: "0 0 8px" }}>
          Contact Manager Coming Soon
        </h2>

        <p
          style={{
            fontSize: 14,
            color: "#64748B",
            maxWidth: 520,
            margin: "0 auto 32px",
            lineHeight: 1.6,
          }}
        >
          Centralize all your professional contacts in one place. Track clients,
          real estate agents, referral partners, title companies, and other key
          relationships. Sync contacts across your deals and stay organized.
        </p>

        {/* 2x2 Feature Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 16,
            maxWidth: 480,
            margin: "0 auto",
          }}
        >
          {FEATURE_CARDS.map((card) => (
            <div
              key={card.title}
              style={{
                background: "#fff",
                border: "1px solid #E2E8F0",
                borderRadius: 10,
                padding: "20px 16px",
                textAlign: "center",
              }}
            >
              <i
                className={card.icon}
                style={{ fontSize: 24, color: "#2563EB", display: "block", marginBottom: 10 }}
              />
              <div style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", marginBottom: 4 }}>
                {card.title}
              </div>
              <div style={{ fontSize: 12, color: "#64748B" }}>{card.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
