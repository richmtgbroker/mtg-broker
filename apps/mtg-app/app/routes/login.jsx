import { useEffect } from "react";
import Navbar from "../components/Navbar";
import { OUTSETA_DOMAIN } from "../lib/constants";
import { isLoggedIn } from "../lib/auth";

export function meta() {
  return [
    { title: "Login — MtgBroker" },
    { name: "description", content: "Log in to your MtgBroker account." },
  ];
}

export default function LoginPage() {
  useEffect(() => {
    // If already logged in, redirect to dashboard
    if (isLoggedIn()) {
      window.location.href = "/app/dashboard";
      return;
    }

    // Redirect to Outseta hosted login page with callback to dashboard
    const callbackUrl = encodeURIComponent(window.location.origin + "/app/dashboard");
    window.location.href = `https://${OUTSETA_DOMAIN}/auth?widgetMode=login&authenticationCallbackUrl=${callbackUrl}`;
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-muted text-sm">Redirecting to login...</p>
        </div>
      </div>
    </div>
  );
}
