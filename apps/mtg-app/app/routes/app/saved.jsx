export function meta() {
  return [{ title: "Saved Items — MtgBroker" }];
}

export default function SavedPage() {
  return (
    <div>
      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600 shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text mb-1">Saved Items</h1>
          <p className="text-text-muted text-sm">Your bookmarked products, lenders, and saved searches.</p>
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
          Save and organize your favorite loan products, lenders, and search results for quick access later.
        </p>
      </div>
    </div>
  );
}
