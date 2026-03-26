import { useState, useEffect } from "react";
import { useSearchParams } from "react-router";
import Logo from "../components/Logo";
import { isLoggedIn, getUserPlan } from "../lib/auth";
import { OUTSETA_DOMAIN } from "../lib/constants";

export function meta() {
  return [
    { title: "Login — MtgBroker" },
    { name: "description", content: "Log in to your MtgBroker account." },
  ];
}

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/app/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // If already logged in, redirect immediately
  useEffect(() => {
    if (isLoggedIn()) {
      const plan = getUserPlan();
      window.location.href = plan ? redirectTo : "/pricing";
    }
  }, [redirectTo]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      // Authenticate via Outseta's token endpoint
      const res = await fetch(`https://${OUTSETA_DOMAIN}/tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          username: email.trim(),
          password: password,
          grant_type: "password",
          client_id: OUTSETA_DOMAIN.split(".")[0], // "mtgbroker"
        }).toString(),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 400 || res.status === 401) {
          throw new Error("Invalid email or password. Please try again.");
        }
        throw new Error(data.error_description || data.error || "Login failed. Please try again.");
      }

      const data = await res.json();
      const token = data.access_token;

      if (!token) {
        throw new Error("No access token received. Please try again.");
      }

      // Save token to localStorage (same key Outseta's NoCode SDK uses)
      localStorage.setItem("Outseta.nocode.accessToken", token);

      // Redirect to dashboard on the CURRENT domain
      const plan = getUserPlan();
      window.location.href = plan ? redirectTo : "/pricing";
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  // Shared styles
  const inputStyle = {
    width: "100%",
    padding: "12px 14px",
    fontSize: "15px",
    fontFamily: "inherit",
    border: "1.5px solid #e2e8f0",
    borderRadius: "10px",
    outline: "none",
    color: "#0f172a",
    background: "#fff",
    boxSizing: "border-box",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  };

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

        {/* Error message */}
        {error && (
          <div
            style={{
              padding: "10px 14px",
              marginBottom: "16px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              fontSize: "13px",
              color: "#dc2626",
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        {/* Login form */}
        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div style={{ marginBottom: "14px" }}>
            <label
              htmlFor="login-email"
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                color: "#374151",
                marginBottom: "6px",
              }}
            >
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              style={inputStyle}
              onFocus={(e) => {
                e.target.style.borderColor = "#1a56db";
                e.target.style.boxShadow = "0 0 0 3px rgba(26,86,219,0.1)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#e2e8f0";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: "6px" }}>
            <label
              htmlFor="login-password"
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                color: "#374151",
                marginBottom: "6px",
              }}
            >
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                style={{ ...inputStyle, paddingRight: "48px" }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#1a56db";
                  e.target.style.boxShadow = "0 0 0 3px rgba(26,86,219,0.1)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#e2e8f0";
                  e.target.style.boxShadow = "none";
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "13px",
                  color: "#64748b",
                  fontFamily: "inherit",
                  fontWeight: 500,
                  padding: "4px",
                }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* Forgot password */}
          <div style={{ textAlign: "right", marginBottom: "20px" }}>
            <a
              href={`https://${OUTSETA_DOMAIN}/auth?widgetMode=forgotPassword`}
              style={{
                fontSize: "13px",
                color: "#1a56db",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              Forgot password?
            </a>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "13px",
              fontSize: "15px",
              fontWeight: 700,
              fontFamily: "inherit",
              color: "#fff",
              background: loading ? "#93bbfd" : "#1a56db",
              border: "none",
              borderRadius: "10px",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.15s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            {loading ? (
              <>
                <span
                  style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.6s linear infinite",
                  }}
                />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

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
              Create one free
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

      {/* Spinner keyframe */}
      <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { to { transform: rotate(360deg); } }` }} />
    </div>
  );
}
