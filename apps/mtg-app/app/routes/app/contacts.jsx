export function meta() {
  return [{ title: "Contacts — MtgBroker" }];
}

export default function ContactsPage() {
  return (
    <div>
      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600 shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text mb-1">Contacts</h1>
          <p className="text-text-muted text-sm">Manage your client contacts, referral partners, and professional network.</p>
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
          The Contact Manager will help you keep track of clients, real estate agents, referral partners, and other key contacts for your mortgage business.
        </p>
      </div>
    </div>
  );
}
