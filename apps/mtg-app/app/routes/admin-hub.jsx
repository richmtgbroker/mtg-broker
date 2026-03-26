import { useState, useEffect } from "react";
import { Link } from "react-router";
import Navbar from "../components/Navbar";
import { isAdmin } from "../lib/auth";

export function meta() {
  return [{ title: "Admin Hub — MtgBroker" }];
}

export default function AdminHub() {
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    setAuthorized(isAdmin());
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <main className="max-w-[800px] mx-auto px-6 py-16">
        {!authorized ? (
          <div className="text-center py-16">
            <h1 className="text-2xl font-bold text-text mb-2">Access Denied</h1>
            <p className="text-text-muted mb-6">This page is restricted to administrators.</p>
            <Link to="/app/dashboard" className="text-primary-600 no-underline hover:underline">
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-text mb-2">Admin Hub</h1>
            <p className="text-text-muted mb-8">Platform administration tools.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <a
                href="https://dash.cloudflare.com"
                target="_blank"
                rel="noopener noreferrer"
                className="block p-5 bg-surface border border-border-light rounded-xl no-underline hover:border-primary-200 transition-colors"
              >
                <h3 className="text-sm font-bold text-text mb-1">Cloudflare Dashboard</h3>
                <p className="text-xs text-text-muted">Workers, Pages, DNS</p>
              </a>
              <a
                href="https://mtgbroker.outseta.com/nocode"
                target="_blank"
                rel="noopener noreferrer"
                className="block p-5 bg-surface border border-border-light rounded-xl no-underline hover:border-primary-200 transition-colors"
              >
                <h3 className="text-sm font-bold text-text mb-1">Outseta</h3>
                <p className="text-xs text-text-muted">Users, billing, auth</p>
              </a>
              <a
                href="https://supabase.com/dashboard/project/tcmahfwhdknxhhdvqpum"
                target="_blank"
                rel="noopener noreferrer"
                className="block p-5 bg-surface border border-border-light rounded-xl no-underline hover:border-primary-200 transition-colors"
              >
                <h3 className="text-sm font-bold text-text mb-1">Supabase</h3>
                <p className="text-xs text-text-muted">Database, tables, queries</p>
              </a>
              <a
                href="https://airtable.com/appuJgI9X93OLaf0u"
                target="_blank"
                rel="noopener noreferrer"
                className="block p-5 bg-surface border border-border-light rounded-xl no-underline hover:border-primary-200 transition-colors"
              >
                <h3 className="text-sm font-bold text-text mb-1">Airtable</h3>
                <p className="text-xs text-text-muted">Loan products, lenders</p>
              </a>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
