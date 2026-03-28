export function meta() {
  return [{ title: "Vendors — MtgBroker" }];
}

const featureCards = [
  { icon: "fa-solid fa-file-contract", title: "Title Companies" },
  { icon: "fa-solid fa-house-chimney-crack", title: "Appraisers" },
  { icon: "fa-solid fa-shield-halved", title: "Insurance" },
  { icon: "fa-solid fa-house-circle-check", title: "Home Warranty" },
];

export default function VendorsPage() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
        <i
          className="fa-solid fa-store"
          style={{ fontSize: 24, color: "#2563EB" }}
        />
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0F172A", margin: 0 }}>
          Vendor Directory
        </h1>
      </div>

      {/* Empty state card */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #E2E8F0",
          borderRadius: 10,
          padding: "48px 32px",
          textAlign: "center",
        }}
      >
        {/* Large icon */}
        <i
          className="fa-solid fa-store"
          style={{ fontSize: 48, color: "#94A3B8", marginBottom: 16, display: "block" }}
        />

        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0F172A", margin: "0 0 8px" }}>
          Vendor Directory Coming Soon
        </h2>

        <p
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: "#64748B",
            maxWidth: 540,
            margin: "0 auto 32px",
          }}
        >
          A comprehensive directory of mortgage service providers including title companies,
          appraisers, insurance agents, home warranty companies, and more. Compare services,
          view contact info, and manage your preferred vendor relationships.
        </p>

        {/* 2x2 feature preview grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 16,
            maxWidth: 480,
            margin: "0 auto",
          }}
        >
          {featureCards.map((card) => (
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
                style={{ fontSize: 24, color: "#2563EB", marginBottom: 8, display: "block" }}
              />
              <div style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", marginBottom: 4 }}>
                {card.title}
              </div>
              <div style={{ fontSize: 12, color: "#64748B" }}>Coming soon</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
