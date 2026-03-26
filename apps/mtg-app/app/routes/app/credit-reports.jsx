import { useState, useEffect } from "react";
import { isNexaUser as checkNexa } from "../../lib/auth";

export function meta() {
  return [{ title: "Credit Reports — MtgBroker" }];
}

export default function CreditReportsPage() {
  const [isNexa, setIsNexa] = useState(false);

  useEffect(() => {
    setIsNexa(checkNexa());
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600 shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M9 15l2 2 4-4" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text mb-1">Credit Reports</h1>
          <p className="text-text-muted text-sm">Pull and manage credit reports for your borrowers.</p>
          {isNexa && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 mt-2 rounded-full bg-purple-600/10 text-purple-600 text-xs font-semibold">
              NEXA Exclusive
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      {!isNexa ? (
        <div className="bg-surface border border-border-light rounded-xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-active flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-text-faint">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-text mb-2">NEXA Members Only</h2>
          <p className="text-text-muted text-sm max-w-md mx-auto">
            Credit Reports is an exclusive feature for NEXA Mortgage loan officers. Contact your branch manager for access.
          </p>
        </div>
      ) : (
        <div className="bg-surface border border-border-light rounded-xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-primary-400">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-text mb-2">Coming Soon</h2>
          <p className="text-text-muted text-sm max-w-md mx-auto">
            Credit report integration for NEXA members is currently in development.
          </p>
        </div>
      )}
    </div>
  );
}
