import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router";
import Logo from "../components/Logo";
import { isLoggedIn, getUserPlan } from "../lib/auth";

export function meta() {
  return [
    { title: "Login — MtgBroker" },
    { name: "description", content: "Log in to your MtgBroker account." },
  ];
}

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/app/dashboard";
  const widgetRef = useRef(null);

  useEffect(() => {
    // If already logged in, redirect immediately
    if (isLoggedIn()) {
      const plan = getUserPlan();
      window.location.href = plan ? redirectTo : "/pricing";
      return;
    }

    // Poll for login completion — Outseta sets the token in localStorage
    const timer = setInterval(() => {
      if (isLoggedIn()) {
        clearInterval(timer);
        clearInterval(initTimer);
        const plan = getUserPlan();
        // Has an active plan → go to dashboard (or redirect param)
        // No plan → go to pricing to pick one
        window.location.href = plan ? redirectTo : "/pricing";
      }
    }, 500);

    // Try to re-initialize the Outseta widget if it didn't auto-render.
    // The Outseta SDK looks for data-o-auth divs on DOMContentLoaded,
    // but since this is a client-side route transition, we may need to
    // manually trigger a re-scan.
    const initTimer = setInterval(() => {
      if (typeof window.Outseta !== "undefined") {
        // If the widget div is still empty, try to kick Outseta
        if (widgetRef.current && widgetRef.current.children.length === 0) {
          try {
            if (typeof window.Outseta.auth?.open === "function") {
              // This opens the modal — we want embed mode instead
              // Just let the SDK find the div naturally
            }
            // Force Outseta to re-scan for embed divs
            if (typeof window.Outseta.init === "function") {
              window.Outseta.init();
            }
          } catch (e) {
            // Outseta SDK not fully loaded yet
          }
        } else {
          clearInterval(initTimer);
        }
      }
    }, 300);

    // Stop polling after 30 seconds
    const cleanup = setTimeout(() => {
      clearInterval(timer);
      clearInterval(initTimer);
    }, 30000);

    return () => {
      clearInterval(timer);
      clearInterval(initTimer);
      clearTimeout(cleanup);
    };
  }, [redirectTo]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "'Host Grotesk', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Login card */}
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#fff",
          borderRadius: "16px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
          padding: "40px 32px 32px",
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <Link to="/" style={{ display: "inline-block" }}>
            <Logo height={32} />
          </Link>
        </div>

        {/* Heading */}
        <h1
          style={{
            fontSize: "22px",
            fontWeight: 700,
            color: "#0f172a",
            textAlign: "center",
            margin: "0 0 6px",
          }}
        >
          Welcome back
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "#64748b",
            textAlign: "center",
            margin: "0 0 28px",
          }}
        >
          Sign in to access your dashboard
        </p>

        {/* Outseta embedded login widget */}
        <div
          ref={widgetRef}
          data-o-auth="1"
          data-mode="embed"
          data-widget-mode="login"
          style={{ minHeight: "300px" }}
        />

        {/* Divider */}
        <div
          style={{
            borderTop: "1px solid #e5e7eb",
            marginTop: "24px",
            paddingTop: "20px",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
            Don't have an account?{" "}
            <Link
              to="/pricing"
              style={{ color: "#1a56db", fontWeight: 600, textDecoration: "none" }}
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>

      {/* Back to homepage */}
      <Link
        to="/"
        style={{
          marginTop: "24px",
          fontSize: "14px",
          color: "#64748b",
          textDecoration: "none",
        }}
      >
        &larr; Back to homepage
      </Link>
    </div>
  );
}
