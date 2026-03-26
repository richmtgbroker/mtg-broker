export function meta() {
  return [{ title: "Tools — MtgBroker" }];
}

export default function ToolsPage() {
  return (
    <div>
      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600 shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text mb-1">Tools</h1>
          <p className="text-text-muted text-sm">Utility tools and resources to help you work more efficiently.</p>
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
          Additional tools and utilities to streamline your mortgage workflow are on the way.
        </p>
      </div>
    </div>
  );
}
