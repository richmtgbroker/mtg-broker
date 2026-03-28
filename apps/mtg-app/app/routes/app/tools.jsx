import { Link } from "react-router";

export function meta() {
  return [{ title: "Tools — MtgBroker" }];
}

const TOOLS = [
  {
    name: "Mortgage Calculators",
    icon: "fa-solid fa-calculator",
    link: "/app/calculators",
    desc: "Payment, amortization, affordability, and refinance calculators",
  },
  {
    name: "AI Loan Finder",
    icon: "fa-solid fa-robot",
    link: "/app/ai-search",
    desc: "Describe your scenario and let AI find matching loan products",
  },
  {
    name: "Loan Product Search",
    icon: "fa-solid fa-magnifying-glass-dollar",
    link: "/app/loan-search",
    desc: "Search and compare loan products across all lenders",
  },
  {
    name: "Property Types Guide",
    icon: "fa-solid fa-house",
    link: "/app/property-types",
    desc: "Explore eligible property types and their guidelines",
  },
  {
    name: "Goal Setting",
    icon: "fa-solid fa-bullseye",
    link: "/app/goal-setting",
    desc: "Set and track your production goals",
  },
  {
    name: "Social Media Kit",
    icon: "fa-solid fa-share-nodes",
    link: "/app/social-media",
    desc: "Social media templates and compliance-approved content",
  },
];

const styles = {
  page: {
    background: "#F8FAFC",
    minHeight: "100%",
  },
  headerRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 32,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    background: "#EFF6FF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerIconI: {
    fontSize: 22,
    color: "#2563EB",
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: "#0F172A",
    margin: 0,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    margin: 0,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 16,
  },
  card: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: 20,
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 10,
    textDecoration: "none",
    transition: "border-color 0.15s, background 0.15s",
    cursor: "pointer",
  },
  cardHover: {
    borderColor: "#93C5FD",
    background: "#F0F7FF",
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: "#EFF6FF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  iconCircleI: {
    fontSize: 18,
    color: "#2563EB",
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardName: {
    fontSize: 15,
    fontWeight: 600,
    color: "#0F172A",
    margin: 0,
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: 13,
    color: "#64748B",
    margin: 0,
    lineHeight: 1.4,
  },
  chevron: {
    fontSize: 14,
    color: "#94A3B8",
    flexShrink: 0,
  },
};

function ToolCard({ tool }) {
  return (
    <Link
      to={tool.link}
      style={styles.card}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#93C5FD";
        e.currentTarget.style.background = "#F0F7FF";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#E2E8F0";
        e.currentTarget.style.background = "#FFFFFF";
      }}
    >
      <div style={styles.iconCircle}>
        <i className={tool.icon} style={styles.iconCircleI} />
      </div>
      <div style={styles.cardBody}>
        <p style={styles.cardName}>{tool.name}</p>
        <p style={styles.cardDesc}>{tool.desc}</p>
      </div>
      <i className="fa-solid fa-chevron-right" style={styles.chevron} />
    </Link>
  );
}

export default function ToolsPage() {
  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.headerRow}>
        <div style={styles.headerIcon}>
          <i className="fa-solid fa-wrench" style={styles.headerIconI} />
        </div>
        <div>
          <h1 style={styles.title}>Tools & Resources</h1>
          <p style={styles.subtitle}>
            Utility tools and resources to help you work more efficiently.
          </p>
        </div>
      </div>

      {/* Tool grid */}
      <div style={styles.grid}>
        {TOOLS.map((tool) => (
          <ToolCard key={tool.link} tool={tool} />
        ))}
      </div>
    </div>
  );
}
