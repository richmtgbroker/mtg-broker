import { Link } from "react-router";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#0F172A]">
      {/* Main row: copyright, links, equal housing — all centered */}
      <div className="max-w-[1280px] mx-auto px-6 py-4 flex flex-col items-center gap-2.5">
        <div className="flex items-center gap-3 flex-wrap justify-center text-xs" style={{ color: "#94A3B8" }}>
          <span>&copy; {year} MtgBroker, LLC</span>
          <Link to="/privacy-policy" className="no-underline hover:text-white transition-colors" style={{ color: "#94A3B8" }}>
            Privacy Policy
          </Link>
          <span style={{ color: "#334155" }}>|</span>
          <Link to="/terms-of-service" className="no-underline hover:text-white transition-colors" style={{ color: "#94A3B8" }}>
            Terms of Service
          </Link>
          <span style={{ color: "#334155" }}>|</span>
          {/* Official Equal Housing Opportunity logo */}
          <span className="inline-flex items-center gap-1.5">
            <svg width="14" height="15" viewBox="0 0 100 110" fill="#94A3B8" xmlns="http://www.w3.org/2000/svg">
              {/* Outer house outline */}
              <polygon points="50,5 5,45 5,105 95,105 95,45" fill="none" stroke="#94A3B8" strokeWidth="6" strokeLinejoin="miter" />
              {/* Roof peak fill */}
              <polygon points="50,5 5,45 95,45" fill="#94A3B8" />
              {/* Equal sign - top bar */}
              <rect x="28" y="58" width="44" height="10" fill="#94A3B8" />
              {/* Equal sign - bottom bar */}
              <rect x="28" y="76" width="44" height="10" fill="#94A3B8" />
            </svg>
            <span>Equal Housing Opportunity</span>
          </span>
        </div>
      </div>
      {/* Disclaimer row */}
      <div className="border-t border-[#1E293B]">
        <div className="max-w-[720px] mx-auto px-6 py-3">
          <p className="text-[11px] text-center leading-relaxed m-0" style={{ color: "#64748B" }}>
            MtgBroker, LLC provides informational tools for mortgage professionals and does not provide legal, tax, or financial advice. Calculator and scenario results are estimates and may not reflect final lender approval or pricing. MtgBroker, LLC is not a lender.
          </p>
        </div>
      </div>
    </footer>
  );
}
