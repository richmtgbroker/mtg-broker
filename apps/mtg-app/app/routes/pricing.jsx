import { useState } from "react";
import { Link } from "react-router";
import Navbar from "../components/Navbar";
import MarketingFooter from "../components/MarketingFooter";
import { OUTSETA_DOMAIN, PLAN_UIDS, getOutsetaAuthUrl } from "../lib/constants";

export function meta() {
  return [
    { title: "Pricing | MtgBroker" },
    { name: "description", content: "Compare LITE, PLUS, and PRO plans for independent mortgage loan officers. Start free, upgrade when you're ready." },
    { property: "og:title", content: "Pricing | MtgBroker" },
    { property: "og:description", content: "Compare LITE ($0/mo), PLUS ($49/mo), and PRO ($79/mo) plans. Start free, upgrade when you're ready." },
    { property: "og:type", content: "website" },
    { property: "og:url", content: "https://mtg.broker/pricing" },
  ];
}

export default function Pricing() {
  return (
    <div className="min-h-screen bg-gradient-marketing">
      <Navbar />

      {/* ===== PRICING HERO ===== */}
      <section className="max-w-[1280px] mx-auto px-6 pt-16 pb-4 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold text-text mb-4">
          Simple, transparent pricing.
        </h1>
        <p className="text-lg text-text-muted max-w-xl mx-auto">
          Start free. Upgrade when you&apos;re ready to scale.
        </p>
      </section>

      {/* ===== PRICING CARDS ===== */}
      <section className="max-w-[1280px] mx-auto px-6 py-14">
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
      </section>

      {/* ===== STATS + TRUST BADGES ===== */}
      <section className="max-w-[1280px] mx-auto px-6 py-14">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 max-w-3xl mx-auto mb-12">
          <StatItem number="10,000+" label="Mortgage Professionals" />
          <StatItem number="300+" label="Lenders" />
          <StatItem number="1,000+" label="Loan Products" />
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-8">
          <TrustBadge
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            }
            text="Secure Checkout"
          />
          <TrustBadge
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            }
            text="Cancel Anytime"
          />
          <TrustBadge
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            }
            text="Email Support"
          />
        </div>
      </section>

      {/* ===== COMPARE PLANS TABLE ===== */}
      <section className="bg-white py-20">
        <div className="max-w-[1280px] mx-auto px-6">
          <h2 className="text-3xl font-extrabold text-text text-center mb-12">
            Compare Plans
          </h2>

          <div className="max-w-4xl mx-auto overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-primary-600 text-white">
                  <th className="text-left py-4 px-6 font-bold text-sm uppercase tracking-wider rounded-tl-xl">Feature</th>
                  <th className="text-center py-4 px-4 font-bold text-sm uppercase tracking-wider">LITE</th>
                  <th className="text-center py-4 px-4 font-bold text-sm uppercase tracking-wider">PLUS</th>
                  <th className="text-center py-4 px-4 font-bold text-sm uppercase tracking-wider rounded-tr-xl">PRO</th>
                </tr>
              </thead>
              <tbody>
                <CompareRow feature="AI Powered Loan Search" lite="Limited" plus={true} pro={true} />
                <CompareRow feature="Loan Product Search" lite="Limited" plus={true} pro={true} even />
                <CompareRow feature="Lender & Vendor Directory" lite={true} plus={true} pro={true} />
                <CompareRow feature="Number of Calculators" lite="Basic" plus="All 14+" pro="All 14+" even />
                <CompareRow feature="Saved Calculator Scenarios" lite={false} plus="10 per tool" pro="Unlimited" />
                <CompareRow feature="PDF Export" lite={false} plus={false} pro={true} even />
                <CompareRow feature="Pipeline Tracking" lite={false} plus="25 loans" pro="Unlimited" />
                <CompareRow feature="Pipeline Export" lite={false} plus={false} pro="CSV/Excel" even />
                <CompareRow feature="Saved Favorites" lite={false} plus="Unlimited" pro="Unlimited" />
                <CompareRow feature="Support" lite="Email" plus="Email" pro="Priority" even />
                <CompareRow feature="Referral Program" lite={false} plus={false} pro={true} />
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ===== FAQ ACCORDION ===== */}
      <section className="max-w-[1280px] mx-auto px-6 py-20">
        <h2 className="text-3xl font-extrabold text-text text-center mb-12">
          Frequently Asked Questions
        </h2>

        <div className="max-w-3xl mx-auto space-y-3">
          <FaqItem
            question="Can I change plans later?"
            answer="Yes! You can upgrade or downgrade your plan at any time. When you upgrade, you'll be charged the prorated difference. When you downgrade, the change takes effect at the end of your current billing period."
          />
          <FaqItem
            question="What happens after the 7-day free trial?"
            answer="After your 7-day trial ends, you'll automatically be charged the monthly rate for your chosen plan. You can cancel anytime during the trial to avoid being charged. No surprises!"
          />
          <FaqItem
            question="Can I cancel anytime?"
            answer="Absolutely. There are no long-term contracts or commitments. You can cancel your subscription at any time from your account settings, and you'll retain access until the end of your current billing period."
          />
          <FaqItem
            question="What payment methods do you accept?"
            answer="We accept all major credit cards (Visa, Mastercard, American Express, Discover) and debit cards. All payments are processed securely through our payment partner."
          />
          <FaqItem
            question="Is my data secure?"
            answer="Yes! We take data security seriously. All data is encrypted in transit and at rest. We're compliant with industry-standard security practices and never share your information with third parties."
          />
          <FaqItem
            question="Can I get a refund?"
            answer="We offer a 30-day money-back guarantee. If you're not satisfied with MTG.BROKER for any reason within your first 30 days, contact us for a full refund — no questions asked."
          />
          <FaqItem
            question="Will my saved data transfer if I upgrade?"
            answer="Absolutely! All your saved calculator scenarios, pipeline loans, and favorites are preserved when you upgrade. You'll simply unlock additional features and higher limits."
          />
        </div>
      </section>

      {/* ===== BOTTOM CTA ===== */}
      <section className="bg-[#0f172a] py-20">
        <div className="max-w-[1280px] mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
            Ready to close more loans?
          </h2>
          <p className="text-lg text-[#94a3b8] max-w-2xl mx-auto mb-8">
            Join thousands of mortgage professionals using MTG.BROKER to work smarter.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <a
              href={getOutsetaAuthUrl("register", PLAN_UIDS.PRO)}
              className="px-8 py-4 bg-white rounded-xl font-bold text-lg no-underline hover:bg-gray-100 transition-colors"
              style={{ color: "var(--color-text)" }}
            >
              Start PRO Free Trial
            </a>
            <a
              href={getOutsetaAuthUrl("register", PLAN_UIDS.LITE)}
              className="px-8 py-4 border-2 border-white/30 rounded-xl font-bold text-lg no-underline hover:bg-white/10 transition-colors"
              style={{ color: "#fff" }}
            >
              Start with Free Plan
            </a>
          </div>
          <p className="text-sm text-[#64748b] mt-6">
            No credit card required for LITE plan &bull; Cancel anytime
          </p>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <MarketingFooter />
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

/* ===== Stat Item Component ===== */
function StatItem({ number, label }) {
  return (
    <div className="text-center">
      <div className="text-3xl md:text-4xl font-extrabold text-text mb-1">{number}</div>
      <div className="text-sm text-text-muted">{label}</div>
    </div>
  );
}

/* ===== Trust Badge Component ===== */
function TrustBadge({ icon, text }) {
  return (
    <div className="flex items-center gap-2.5 text-text-secondary">
      <div className="text-primary-600">{icon}</div>
      <span className="text-sm font-semibold">{text}</span>
    </div>
  );
}

/* ===== Compare Table Row Component ===== */
function CompareRow({ feature, lite, plus, pro, even = false }) {
  const renderCell = (value) => {
    if (value === true) {
      return (
        <svg className="w-5 h-5 text-green-500 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    }
    if (value === false) {
      return <span className="text-gray-300">&mdash;</span>;
    }
    return <span className="text-sm text-text-secondary font-medium">{value}</span>;
  };

  return (
    <tr className={even ? "bg-surface-section" : "bg-white"}>
      <td className="py-4 px-6 text-sm font-medium text-text">{feature}</td>
      <td className="py-4 px-4 text-center">{renderCell(lite)}</td>
      <td className="py-4 px-4 text-center">{renderCell(plus)}</td>
      <td className="py-4 px-4 text-center">{renderCell(pro)}</td>
    </tr>
  );
}

/* ===== FAQ Accordion Item Component ===== */
function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left bg-transparent border-none cursor-pointer font-inherit"
      >
        <span className="text-base font-bold text-text">{question}</span>
        <svg
          className={`w-5 h-5 text-text-muted shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="px-6 pb-5 text-sm text-text-muted leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
}
