import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Footer from "../components/Footer";
import MobileBottomNav from "../components/MobileBottomNav";
import { isLoggedIn } from "../lib/auth";
import { goToLogin } from "../lib/constants";

/**
 * App layout — wraps all /app/* routes with navbar, sidebar, footer.
 * The main content area is positioned to the right of the sidebar
 * and below the navbar, matching the current Webflow layout.
 *
 * Auth gating: if no valid Outseta JWT is found, show login prompt
 * instead of the page content. Uses Outseta's #o-anonymous hash to
 * trigger the auth widget on the current page.
 */
export default function AppLayout() {
  const [authChecked, setAuthChecked] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setLoggedIn(isLoggedIn());
    setAuthChecked(true);
  }, [location.pathname]);

  // Listen for Outseta auth events — re-check login state when token changes
  useEffect(() => {
    function onStorageChange(e) {
      if (e.key === "Outseta.nocode.accessToken") {
        setLoggedIn(isLoggedIn());
      }
    }
    window.addEventListener("storage", onStorageChange);

    // Also poll briefly after mount in case Outseta sets the token async
    const timer = setInterval(() => {
      if (isLoggedIn()) {
        setLoggedIn(true);
        clearInterval(timer);
      }
    }, 500);
    const cleanup = setTimeout(() => clearInterval(timer), 10000);

    return () => {
      window.removeEventListener("storage", onStorageChange);
      clearInterval(timer);
      clearTimeout(cleanup);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <Sidebar />

      {/* Main content area — offset by sidebar width */}
      <main
        className="flex-1 transition-[margin] duration-300 ease-in-out max-[991px]:ml-0 pb-20 max-[991px]:pb-24"
        style={{
          marginLeft: "var(--sidebar-width)",
          paddingTop: "24px",
          paddingLeft: "32px",
          paddingRight: "32px",
        }}
      >
        <div className="max-w-[1200px] mx-auto">
          {!authChecked ? (
            /* Loading state while checking auth */
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            </div>
          ) : loggedIn ? (
            <Outlet />
          ) : (
            /* Auth gate — prompt user to log in */
            <div className="flex items-center justify-center py-20">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-5">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary-600">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-text mb-2">Sign in to continue</h2>
                <p className="text-text-muted text-sm mb-6">
                  You need to be logged in to access this page.
                </p>
                <button
                  onClick={goToLogin}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-primary-600 hover:bg-primary-hover border-none cursor-pointer transition-colors"
                  style={{ color: "#fff" }}
                >
                  Login or Sign Up
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <div
        className="transition-[margin] duration-300 ease-in-out max-[991px]:ml-0"
        style={{ marginLeft: "var(--sidebar-width)" }}
      >
        <Footer />
      </div>

      <MobileBottomNav />
    </div>
  );
}
