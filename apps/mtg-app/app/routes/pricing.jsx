import Navbar from "../components/Navbar";

export function meta() {
  return [
    { title: "Pricing — MtgBroker" },
    { name: "description", content: "Compare LITE, PLUS, and PRO plans for independent mortgage loan officers." },
  ];
}

export default function Pricing() {
  return (
    <div className="min-h-screen bg-gradient-marketing">
      <Navbar />

      <div className="max-w-[1280px] mx-auto px-6 pt-16 pb-32">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold text-text mb-4">Simple, transparent pricing</h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">Choose the plan that fits your business. Upgrade or downgrade anytime.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <PlanCard
            name="LITE"
            price="Free"
            description="Get started with essential tools"
            features={["Loan product search", "Lender directory", "Basic calculators", "Community support"]}
            cta="Get Started"
            ctaHref="https://mtgbroker.outseta.com/auth?widgetMode=register&planUid=NmdnZg90#o-anonymous"
          />
          <PlanCard
            name="PLUS"
            price="$29"
            period="/mo"
            description="Everything in LITE, plus more"
            features={["AI Loan Finder", "Pipeline management", "Advanced calculators", "Social media tools", "Priority support"]}
            cta="Start Free Trial"
            ctaHref="https://mtgbroker.outseta.com/auth?widgetMode=register&planUid=Dmw8leQ4#o-anonymous"
            featured
          />
          <PlanCard
            name="PRO"
            price="$49"
            period="/mo"
            description="Everything in PLUS, plus more"
            features={["All PLUS features", "Referral program", "Goal setting", "Premium tools", "Dedicated support"]}
            cta="Start Free Trial"
            ctaHref="https://mtgbroker.outseta.com/auth?widgetMode=register&planUid=yWobBP9D#o-anonymous"
          />
        </div>
      </div>

      <footer className="border-t border-border bg-white py-8 px-6">
        <div className="max-w-[1280px] mx-auto text-center text-sm text-text-muted">
          &copy; {new Date().getFullYear()} mtg.broker
        </div>
      </footer>
    </div>
  );
}

function PlanCard({ name, price, period, description, features, cta, ctaHref, featured = false }) {
  return (
    <div className={`rounded-2xl border p-8 flex flex-col ${featured ? "border-primary-600 shadow-lg bg-white ring-2 ring-primary-100" : "border-border bg-white"}`}>
      {featured && (
        <div className="text-xs font-bold text-primary-600 uppercase tracking-wider mb-4">Most Popular</div>
      )}
      <h3 className="text-lg font-bold text-text mb-1">{name}</h3>
      <div className="mb-2">
        <span className="text-4xl font-extrabold text-text">{price}</span>
        {period && <span className="text-text-muted">{period}</span>}
      </div>
      <p className="text-sm text-text-muted mb-6">{description}</p>
      <ul className="flex-1 mb-8 space-y-3">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-text-secondary">
            <svg className="w-5 h-5 text-success shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {f}
          </li>
        ))}
      </ul>
      <a
        href={ctaHref}
        className={`block w-full py-3 rounded-xl text-center font-bold no-underline transition-colors ${
          featured
            ? "bg-primary-600 text-white hover:bg-primary-hover"
            : "bg-surface-active text-text border border-border hover:bg-surface-section"
        }`}
      >
        {cta}
      </a>
    </div>
  );
}
