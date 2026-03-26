import Navbar from "../components/Navbar";
import MarketingFooter from "../components/MarketingFooter";

export function meta() {
  return [
    { title: "Privacy Policy — MtgBroker" },
    { name: "description", content: "MtgBroker privacy policy — how we collect, use, and protect your data." },
  ];
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      <main className="flex-1 max-w-[800px] mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-text mb-2">Privacy Policy</h1>
        <p className="text-sm text-text-muted mb-8">Last updated: March 2026</p>

        <div className="prose prose-sm max-w-none text-text-secondary leading-relaxed space-y-6">
          <section>
            <h2 className="text-lg font-bold text-text mb-3">1. Information We Collect</h2>
            <p>When you create an account, we collect your name, email address, and professional information (NMLS number, company details). We also collect usage data to improve our services.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text mb-3">2. How We Use Your Information</h2>
            <p>We use your information to provide and improve our mortgage toolkit services, personalize your experience, communicate with you about your account, and comply with legal requirements.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text mb-3">3. Data Storage & Security</h2>
            <p>Your data is stored securely using industry-standard encryption. We use Outseta for authentication, Supabase for database storage, and Cloudflare for hosting — all of which employ enterprise-grade security measures.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text mb-3">4. Third-Party Services</h2>
            <p>We use the following third-party services to operate our platform:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Outseta — authentication and billing</li>
              <li>Cloudflare — hosting and content delivery</li>
              <li>Supabase — database services</li>
              <li>Anthropic Claude — AI-powered loan matching</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text mb-3">5. Your Rights</h2>
            <p>You may request access to, correction of, or deletion of your personal data at any time by contacting us at <a href="mailto:support@mtg.broker" className="text-primary-600 no-underline hover:underline">support@mtg.broker</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-text mb-3">6. Contact</h2>
            <p>For privacy-related inquiries, contact us at <a href="mailto:support@mtg.broker" className="text-primary-600 no-underline hover:underline">support@mtg.broker</a>.</p>
            <p className="mt-2">MtgBroker, LLC<br />2172 W 9 Mile Rd<br />Pensacola, FL 32534</p>
          </section>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
