import { Link } from "react-router";
import Navbar from "../components/Navbar";
import MarketingFooter from "../components/MarketingFooter";
import { OUTSETA_DOMAIN, PLAN_UIDS, getOutsetaAuthUrl, goToSignup } from "../lib/constants";

export function meta() {
  return [
    { title: "MtgBroker — The Complete Toolkit for Modern Loan Officers" },
    { name: "description", content: "Stop juggling PDFs, spreadsheets, and sticky notes. Get instant access to lender guidelines, scenario answers, calculators, and vendor contacts — all in one place." },
    { property: "og:title", content: "MtgBroker — The Complete Toolkit for Modern Loan Officers" },
    { property: "og:description", content: "Find wholesale loan products, manage lender relationships, and run your mortgage business more efficiently." },
    { property: "og:type", content: "website" },
    { property: "og:url", content: "https://mtg.broker" },
    { property: "og:image", content: "https://cdn.prod.website-files.com/694e4aaf5f511ad7901b74bc/69576dcb21edb9d479222c02_Logo_Horizontal_Blue.png" },
    { name: "twitter:card", content: "summary_large_image" },
  ];
}

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-marketing">
      <Navbar />

      {/* ===== HERO SECTION ===== */}
      <section className="max-w-[1280px] mx-auto px-6 pt-16 pb-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Text + CTAs */}
          <div>
            <h1 className="text-4xl md:text-5xl lg:text-[3.4rem] font-extrabold text-text tracking-tight leading-[1.1] mb-6">
              The complete toolkit for modern{" "}
              <span className="text-primary-600">Loan Officers</span>.
            </h1>
            <p className="text-lg text-text-muted leading-relaxed mb-8 max-w-xl">
              Stop juggling PDFs, spreadsheets, and sticky notes. Get instant access to lender guidelines, scenario answers, calculators, and vendor contacts — all in one place.
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <Link
                to="/pricing"
                className="px-8 py-4 bg-primary-600 rounded-xl font-bold text-lg no-underline hover:bg-primary-hover transition-colors shadow-lg"
                style={{ color: "#fff" }}
              >
                View Plans
              </Link>
              <button
                onClick={() => goToSignup()}
                className="px-8 py-4 text-primary-600 font-bold text-lg bg-transparent border-none cursor-pointer hover:text-primary-hover transition-colors"
              >
                Create Free Account &rarr;
              </button>
            </div>
          </div>

          {/* Right: Product Preview Card */}
          <div className="bg-[#0f172a] rounded-2xl p-8 shadow-2xl">
            <div className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider mb-4">
              Active Filters
            </div>
            <div className="flex flex-wrap gap-2 mb-6">
              {["Purchase", "DSCR", "75% LTV", "640+ FICO"].map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1.5 bg-primary-600/20 text-primary-300 text-sm font-semibold rounded-full border border-primary-600/30"
                >
                  {tag} <span className="ml-1 opacity-60">&times;</span>
                </span>
              ))}
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              Pinpoint the perfect program.
            </h3>
            <p className="text-[#94a3b8] text-sm leading-relaxed">
              Don&apos;t waste time scanning endless PDF matrices. Use our advanced filters to instantly narrow down 300+ lenders.
            </p>
          </div>
        </div>
      </section>

      {/* ===== FEATURES GRID ===== */}
      <section id="features" className="max-w-[1280px] mx-auto px-6 pb-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-extrabold text-text mb-4">
            Fast Answers. Smart Solutions.
          </h2>
          <p className="text-lg text-text-muted max-w-2xl mx-auto">
            Everything you need to streamline your workflow and close more loans.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <FeatureCard
            icon="search"
            title="Scenario Search"
            description="Instant answers from lender guidelines and matrices. Stop digging through PDFs to find eligibility."
          />
          <FeatureCard
            icon="database"
            title="Lender & Product DB"
            description="Searchable database of lenders, program rules, and specific requirements for every loan type."
          />
          <FeatureCard
            icon="calculator"
            title="Smart Calculators"
            description="Run numbers fast with tools for Refinance Analysis, Cash to Close, and Leverage/DSCR estimates."
          />
          <FeatureCard
            icon="grid"
            title="Vendor Database"
            description="Find the right partners. A curated list of CRMs, credit agencies, compliance tools, and disclosure services."
          />
          <FeatureCard
            icon="contacts"
            title="Contacts Directory"
            description="Direct access to lender account reps, underwriting departments, and vendor support contacts."
          />
          <FeatureCard
            icon="book"
            title="How-to Playbooks"
            description="Step-by-step guidance for pricing and disclosing complex loan types to reduce guesswork."
          />
        </div>
      </section>

      {/* ===== PRICING PREVIEW ===== */}
      <section className="bg-white py-24">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold text-text mb-4">
              Simple, transparent pricing.
            </h2>
            <p className="text-lg text-text-muted">
              Start free. Upgrade when you&apos;re ready to scale.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* LITE */}
            <PricingCard
              name="LITE"
              price="$0"
              period="/mo"
              description="Free access to lender & vendor directories, plus core calculators."
              features={[
                { text: "Lender Directory", included: true },
                { text: "Vendor Directory", included: true },
                { text: "Loan Product Search: Limited", included: true },
                { text: "Calculators: Basic", included: true },
                { text: "Favorites and Custom Notes", included: false },
                { text: "Save Calculator Scenarios", included: false },
                { text: "Pipeline Tracker", included: false },
                { text: "Print to PDF / Export", included: false },
                { text: "Referral Program", included: false },
              ]}
              cta="Create Free Account"
              ctaHref={getOutsetaAuthUrl("register", PLAN_UIDS.LITE)}
            />

            {/* PLUS */}
            <PricingCard
              name="PLUS"
              price="$49"
              period="/mo"
              description="Full access with smart limits for growing teams."
              features={[
                { text: "Lender Directory", included: true },
                { text: "Vendor Directory", included: true },
                { text: "Loan Product Search", included: true },
                { text: "Calculators: Advanced", included: true },
                { text: "Favorites and Custom Notes", included: true },
                { text: "Save Calculator Scenarios: Limited", included: true },
                { text: "Pipeline Tracker: Limited", included: true },
                { text: "Print to PDF / Export", included: false },
                { text: "Referral Program", included: false },
              ]}
              cta="Start PLUS Trial"
              ctaHref={getOutsetaAuthUrl("register", PLAN_UIDS.PLUS)}
            />

            {/* PRO */}
            <PricingCard
              name="PRO"
              price="$79"
              period="/mo"
              description="Unlimited everything for power users."
              featured
              features={[
                { text: "Lender Directory", included: true },
                { text: "Vendor Directory", included: true },
                { text: "Loan Product Search", included: true },
                { text: "Calculators: Advanced", included: true },
                { text: "Favorites and Custom Notes", included: true },
                { text: "Save Calculator Scenarios: Unlimited", included: true },
                { text: "Pipeline Tracker: Unlimited", included: true },
                { text: "Print to PDF / Export", included: true },
                { text: "Referral Program", included: true },
              ]}
              cta="Start PRO Trial"
              ctaHref={getOutsetaAuthUrl("register", PLAN_UIDS.PRO)}
            />
          </div>
        </div>
      </section>

      {/* ===== BOTTOM CTA ===== */}
      <section className="bg-[#0f172a] py-20">
        <div className="max-w-[1280px] mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
            Instant answers for every scenario.
          </h2>
          <p className="text-lg text-[#94a3b8] max-w-2xl mx-auto mb-8">
            Stop guessing and start closing. Find the right guidelines and programs in seconds.
          </p>
          <button
            onClick={() => goToSignup()}
            className="px-8 py-4 bg-primary-600 rounded-xl font-bold text-lg border-none cursor-pointer hover:bg-primary-hover transition-colors shadow-lg"
            style={{ color: "#fff" }}
          >
            Get Started for Free
          </button>
          <p className="text-sm text-[#64748b] mt-4 flex items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            No credit card required for free account.
          </p>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <MarketingFooter />
    </div>
  );
}

/* ===== Feature Card Component ===== */
function FeatureCard({ icon, title, description }) {
  const icons = {
    search: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    database: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
    calculator: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="8" y1="10" x2="10" y2="10" /><line x1="14" y1="10" x2="16" y2="10" /><line x1="8" y1="14" x2="10" y2="14" /><line x1="14" y1="14" x2="16" y2="14" /><line x1="8" y1="18" x2="10" y2="18" /><line x1="14" y1="18" x2="16" y2="18" />
      </svg>
    ),
    grid: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
    contacts: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    book: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  };

  return (
    <div className="bg-white rounded-2xl border border-border p-8 hover:shadow-lg transition-shadow">
      <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center mb-5 text-primary-600">
        {icons[icon]}
      </div>
      <h3 className="text-lg font-bold text-text mb-2">{title}</h3>
      <p className="text-text-muted leading-relaxed">{description}</p>
    </div>
  );
}

/* ===== Pricing Card Component ===== */
function PricingCard({ name, price, period, description, features, cta, ctaHref, featured = false }) {
  return (
    <div
      className={`rounded-2xl border p-8 flex flex-col relative ${
        featured
          ? "border-primary-600 shadow-xl bg-white ring-2 ring-primary-100"
          : "border-border bg-white"
      }`}
    >
      {featured && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-primary-600 text-white text-xs font-bold uppercase tracking-wider px-4 py-1 rounded-full">
          Most Popular
        </div>
      )}

      <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">
        {name}
      </div>

      <div className="mb-2">
        <span className="text-4xl font-extrabold text-text">{price}</span>
        {period && <span className="text-text-muted text-lg">{period}</span>}
      </div>

      <p className="text-sm text-text-muted mb-6">{description}</p>

      <ul className="flex-1 mb-8 space-y-3 list-none p-0 m-0">
        {features.map((f) => (
          <li
            key={f.text}
            className={`flex items-start gap-2.5 text-sm ${
              f.included ? "text-text" : "text-text-faint"
            }`}
          >
            {f.included ? (
              <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            )}
            <span className={!f.included ? "line-through" : ""}>{f.text}</span>
          </li>
        ))}
      </ul>

      <a
        href={ctaHref}
        className={`block w-full py-3.5 rounded-xl text-center font-bold no-underline transition-colors ${
          featured
            ? "bg-primary-600 hover:bg-primary-hover"
            : "bg-surface-active border border-border hover:bg-surface-section"
        }`}
        style={{ color: featured ? "#fff" : "var(--color-text)" }}
      >
        {cta}
      </a>
    </div>
  );
}
