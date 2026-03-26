export function meta() {
  return [{ title: "Vendors — MtgBroker" }];
}

export default function VendorsPage() {
  return (
    <div>
      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600 shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <path d="M3 9l1.5-5h15L21 9" /><path d="M3 9v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9" /><path d="M9 21V13h6v8" /><path d="M3 9h18" /><path d="M6 9v3a3 3 0 0 0 6 0V9" /><path d="M12 9v3a3 3 0 0 0 6 0V9" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text mb-1">Vendors</h1>
          <p className="text-text-muted text-sm">Your directory of title companies, appraisers, insurance agents, and other service providers.</p>
        </div>
      </div>

      {/* Coming soon card */}
      <div className="bg-surface border border-border-light rounded-xl p-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-primary-400">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-text mb-2">Coming Soon</h2>
        <p className="text-text-muted text-sm max-w-md mx-auto">
          The Vendor Directory will let you manage your go-to service providers — title companies, appraisers, insurance agents, and more — all in one place.
        </p>
      </div>
    </div>
  );
}
