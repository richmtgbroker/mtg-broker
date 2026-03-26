import { Link } from "react-router";
import Navbar from "../components/Navbar";

export function meta() {
  return [
    { title: "MtgBroker — Wholesale Mortgage Broker Tools" },
    { name: "description", content: "Find wholesale loan products, manage lender relationships, and grow your mortgage business." },
  ];
}

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-marketing">
      <Navbar />

      <div className="max-w-[1280px] mx-auto px-6 pt-20 pb-32 text-center">
        <h1 className="text-5xl md:text-6xl font-extrabold text-text tracking-tight leading-tight mb-6">
          The broker toolkit<br />
          <span className="text-primary-600">built for growth</span>
        </h1>
        <p className="text-xl text-text-muted max-w-2xl mx-auto mb-10 leading-relaxed">
          Find the best wholesale loan products, manage your lender relationships,
          and run your mortgage business more efficiently — all in one place.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <a
            href="https://mtgbroker.outseta.com/auth?widgetMode=register#o-anonymous"
            className="px-8 py-4 bg-primary-600 text-white rounded-xl font-bold text-lg no-underline hover:bg-primary-hover transition-colors shadow-lg"
          >
            Get Started Free
          </a>
          <Link
            to="/pricing"
            className="px-8 py-4 bg-white text-text border border-border rounded-xl font-bold text-lg no-underline hover:bg-surface-hover transition-colors"
          >
            View Pricing
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-[1280px] mx-auto px-6 pb-32">
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            title="AI Loan Finder"
            description="Describe your borrower scenario in plain English and get matched with the best wholesale loan products instantly."
            icon="sparkles"
          />
          <FeatureCard
            title="Loan Product Search"
            description="Search and filter 625+ wholesale loan products across dozens of lenders. Find exactly what you need."
            icon="search"
          />
          <FeatureCard
            title="Pipeline Management"
            description="Track your loans from application to closing. Manage tasks, documents, and pricing all in one place."
            icon="layers"
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-white py-8 px-6">
        <div className="max-w-[1280px] mx-auto text-center text-sm text-text-muted">
          &copy; {new Date().getFullYear()} mtg.broker — Built for independent mortgage loan officers.
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ title, description, icon }) {
  const icons = {
    sparkles: `<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path>`,
    search: `<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>`,
    layers: `<polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline>`,
  };

  return (
    <div className="bg-white rounded-2xl border border-border p-8 hover:shadow-lg transition-shadow">
      <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center mb-5">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-primary-600" dangerouslySetInnerHTML={{ __html: icons[icon] }} />
      </div>
      <h3 className="text-lg font-bold text-text mb-2">{title}</h3>
      <p className="text-text-muted leading-relaxed">{description}</p>
    </div>
  );
}
