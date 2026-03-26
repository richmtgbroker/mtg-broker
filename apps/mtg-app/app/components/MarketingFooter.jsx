import { Link } from "react-router";
import { OUTSETA_DOMAIN } from "../lib/constants";

const LOGO_URL = "/logo.png";

export default function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#0f172a]">
      {/* Main footer content */}
      <div className="max-w-[1280px] mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Column 1: Brand */}
          <div className="lg:col-span-1">
            <Link to="/" className="inline-block mb-4">
              <img src={LOGO_URL} alt="MtgBroker" className="h-8 w-auto brightness-0 invert" />
            </Link>
            <p className="text-sm text-[#94a3b8] leading-relaxed mb-4">
              The complete toolkit for modern Loan Officers.
            </p>
            <p className="text-sm text-[#94a3b8] leading-relaxed mb-1">
              2172 W 9 Mile Rd
            </p>
            <p className="text-sm text-[#94a3b8] leading-relaxed mb-4">
              Pensacola, FL 32534
            </p>
            <a
              href="mailto:support@mtg.broker"
              className="text-sm text-primary-300 no-underline hover:text-white transition-colors"
            >
              support@mtg.broker
            </a>
          </div>

          {/* Column 2: Product */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
              Product
            </h4>
            <ul className="space-y-3 list-none p-0 m-0">
              <li>
                <a href="/#features" className="text-sm text-[#94a3b8] no-underline hover:text-white transition-colors">
                  Features
                </a>
              </li>
              <li>
                <Link to="/pricing" className="text-sm text-[#94a3b8] no-underline hover:text-white transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <a
                  href={`https://${OUTSETA_DOMAIN}/auth?widgetMode=login#o-anonymous`}
                  className="text-sm text-[#94a3b8] no-underline hover:text-white transition-colors"
                >
                  Login
                </a>
              </li>
              <li>
                <a
                  href={`https://${OUTSETA_DOMAIN}/auth?widgetMode=register#o-anonymous`}
                  className="text-sm text-[#94a3b8] no-underline hover:text-white transition-colors"
                >
                  Signup
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Company */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
              Company
            </h4>
            <ul className="space-y-3 list-none p-0 m-0">
              <li>
                <a
                  href={`https://${OUTSETA_DOMAIN}/support/kb/categories`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#94a3b8] no-underline hover:text-white transition-colors"
                >
                  Help Center
                </a>
              </li>
              <li>
                <a
                  href={`https://${OUTSETA_DOMAIN}/support/kb`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#94a3b8] no-underline hover:text-white transition-colors"
                >
                  Submit a Ticket
                </a>
              </li>
              <li>
                <a
                  href="mailto:support@mtg.broker"
                  className="text-sm text-[#94a3b8] no-underline hover:text-white transition-colors"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Legal */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
              Legal
            </h4>
            <ul className="space-y-3 list-none p-0 m-0">
              <li>
                <Link to="/privacy-policy" className="text-sm text-[#94a3b8] no-underline hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms-of-service" className="text-sm text-[#94a3b8] no-underline hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
            <p className="text-xs text-[#64748b] leading-relaxed mt-4">
              MtgBroker, LLC provides informational tools only. Results are estimates. We are not a lender.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-[#1e293b]">
        <div className="max-w-[1280px] mx-auto px-6 py-5 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Copyright + Equal Housing */}
          <div className="flex items-center gap-4 text-sm text-[#94a3b8]">
            <span>&copy; {year} MtgBroker, LLC.</span>
            <div className="flex items-center gap-1.5">
              {/* Equal Housing Opportunity icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-[#94a3b8]">
                <path d="M12 2L2 8v2h20V8L12 2zm0 2.5L18.5 8h-13L12 4.5zM4 12v10h6v-6h4v6h6V12H4zm2 2h2v2H6v-2zm8 0h2v2h-2v-2z" />
              </svg>
              <span className="text-xs">Equal Housing Opportunity</span>
            </div>
          </div>

          {/* Social links */}
          <div className="flex items-center gap-4">
            <a
              href="https://www.facebook.com/mtgbrokerllc"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#94a3b8] hover:text-white transition-colors"
              aria-label="Facebook"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </a>
            <a
              href="https://www.linkedin.com/company/108294435/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#94a3b8] hover:text-white transition-colors"
              aria-label="LinkedIn"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
            <a
              href="https://x.com/mtgbrokerllc"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#94a3b8] hover:text-white transition-colors"
              aria-label="X (Twitter)"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
