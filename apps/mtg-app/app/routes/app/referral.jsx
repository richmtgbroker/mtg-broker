import { useState, useEffect } from "react";
import { getUserPlan } from "../../lib/auth";

export function meta() {
  return [{ title: "Referral Program — MtgBroker" }];
}

export default function ReferralPage() {
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    setPlan(getUserPlan());
  }, []);

  const isPro = plan === "PRO";

  return (
    <div>
      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600 shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
            <polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text mb-1">Referral Program</h1>
          <p className="text-text-muted text-sm">Earn rewards by referring other loan officers to mtg.broker.</p>
          {isPro && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 mt-2 rounded-full text-xs font-semibold" style={{ background: "linear-gradient(135deg, #1a56db, #6366f1)", color: "#fff" }}>
              PRO
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      {!isPro ? (
        <div className="bg-surface border border-border-light rounded-xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-active flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-text-faint">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-text mb-2">PRO Plan Required</h2>
          <p className="text-text-muted text-sm max-w-md mx-auto mb-4">
            The Referral Program is available exclusively for PRO plan members. Upgrade to start earning rewards.
          </p>
          <a href="/pricing" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary-hover transition-colors">
            View Plans
          </a>
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
            The referral program with reward tracking and shareable invite links is in development.
          </p>
        </div>
      )}
    </div>
  );
}
