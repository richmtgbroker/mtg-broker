import Navbar from "../components/Navbar";
import MarketingFooter from "../components/MarketingFooter";

export function meta() {
  return [
    { title: "Terms of Service — MtgBroker" },
    { name: "description", content: "MtgBroker terms of service — rules and guidelines for using our platform." },
  ];
}

export default function TermsOfService() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      <main className="flex-1 max-w-[800px] mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-text mb-2">Terms of Service</h1>
        <p className="text-sm text-text-muted mb-8">Last updated: March 2026</p>

        <div className="prose prose-sm max-w-none text-text-secondary leading-relaxed space-y-6">
          <section>
            <h2 className="text-lg font-bold text-text mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using MtgBroker ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text mb-3">2. Description of Service</h2>
            <p>MtgBroker provides informational tools for licensed mortgage loan officers, including loan product search, lender directories, calculators, and AI-powered scenario matching. MtgBroker is not a lender and does not make lending decisions.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text mb-3">3. User Accounts</h2>
            <p>You must provide accurate information when creating an account. You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text mb-3">4. Subscription Plans</h2>
            <p>MtgBroker offers LITE (free), PLUS, and PRO subscription plans. Paid plans are billed through Outseta. You may cancel at any time; access continues until the end of your billing period.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text mb-3">5. Acceptable Use</h2>
            <p>You agree to use the Service only for lawful purposes related to your mortgage business. You may not:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Share your account with unauthorized users</li>
              <li>Scrape, copy, or redistribute data from the platform</li>
              <li>Use the Service to mislead borrowers or violate lending regulations</li>
              <li>Attempt to circumvent usage limits or security measures</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text mb-3">6. Disclaimer</h2>
            <p>All loan product information, calculations, and AI-generated results are provided for informational purposes only. MtgBroker makes no guarantees about accuracy, completeness, or suitability. Always verify information directly with the lender before presenting to borrowers.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text mb-3">7. Limitation of Liability</h2>
            <p>MtgBroker, LLC shall not be liable for any indirect, incidental, or consequential damages arising from use of the Service. Our total liability is limited to the amount you have paid for the Service in the 12 months preceding the claim.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text mb-3">8. Changes to Terms</h2>
            <p>We may update these terms from time to time. Continued use of the Service after changes constitutes acceptance of the updated terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text mb-3">9. Contact</h2>
            <p>Questions about these terms? Contact us at <a href="mailto:support@mtg.broker" className="text-primary-600 no-underline hover:underline">support@mtg.broker</a>.</p>
            <p className="mt-2">MtgBroker, LLC<br />2172 W 9 Mile Rd<br />Pensacola, FL 32534</p>
          </section>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
