import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
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
  const redirectedRef = useRef(false);

  // Redirect helper — only fires once
  function doRedirect() {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    const plan = getUserPlan();
    window.location.href = plan ? redirectTo : "/pricing";
  }

  useEffect(() => {
    // If already logged in, redirect immediately
    if (isLoggedIn()) {
      doRedirect();
      return;
    }

    // AGGRESSIVE polling at 100ms to detect Outseta JWT BEFORE Outseta's
    // own redirect fires. Outseta sets the token in localStorage and then
    // redirects to the hardcoded post-login URL (mtg.broker). We need to
    // detect the token and redirect ourselves first, keeping the user on
    // the current domain.
    const fastPoll = setInterval(() => {
      if (isLoggedIn()) {
        clearInterval(fastPoll);
        doRedirect();
      }
    }, 100);

    // Also intercept beforeunload to try to prevent Outseta's redirect
    function handleBeforeUnload(e) {
      if (isLoggedIn() && !redirectedRef.current) {
        doRedirect();
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Try to re-initialize the Outseta widget if it didn't auto-render
    const initTimer = setInterval(() => {
      if (typeof window.Outseta !== "undefined") {
        if (widgetRef.current && widgetRef.current.children.length === 0) {
          try {
            if (typeof window.Outseta.init === "function") {
              window.Outseta.init();
            }
          } catch (e) {}
        } else {
          clearInterval(initTimer);
        }
      }
    }, 300);

    // Stop polling after 60 seconds
    const cleanup = setTimeout(() => {
      clearInterval(fastPoll);
      clearInterval(initTimer);
    }, 60000);

    return () => {
      clearInterval(fastPoll);
      clearInterval(initTimer);
      clearTimeout(cleanup);
      window.removeEventListener("beforeunload", handleBeforeUnload);
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
          <a href="/" style={{ display: "inline-block" }}>
            <Logo height={32} />
          </a>
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
            <a
              href="/pricing"
              style={{ color: "#1a56db", fontWeight: 600, textDecoration: "none" }}
            >
              Sign up
            </a>
          </p>
        </div>
      </div>

      {/* Back to homepage */}
      <a
        href="/"
        style={{
          marginTop: "24px",
          fontSize: "14px",
          color: "#64748b",
          textDecoration: "none",
        }}
      >
        &larr; Back to homepage
      </a>
    </div>
  );
}
