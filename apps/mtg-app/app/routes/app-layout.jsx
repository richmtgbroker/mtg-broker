import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Footer from "../components/Footer";
import MobileBottomNav from "../components/MobileBottomNav";
import { isLoggedIn } from "../lib/auth";

/**
 * App layout — wraps all /app/* routes with navbar, sidebar, footer.
 * The main content area is positioned to the right of the sidebar
 * and below the navbar, matching the current Webflow layout.
 *
 * Auth gating: if no valid Outseta JWT is found, show login prompt
 * instead of the page content. Uses Outseta's #o-anonymous hash to
 * trigger the auth widget on the current page.
 */
const SIDEBAR_KEY = "sidebar-collapsed";
const MOBILE_BREAKPOINT = 991;

export default function AppLayout() {
  const [authChecked, setAuthChecked] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setLoggedIn(isLoggedIn());
    setAuthChecked(true);
    setSidebarCollapsed(localStorage.getItem(SIDEBAR_KEY) === "true");
  }, [location.pathname]);

  // Track mobile breakpoint so we can zero-out sidebar margin on small screens
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    setIsMobile(mq.matches);
    function onChange(e) { setIsMobile(e.matches); }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Listen for sidebar collapse changes via localStorage
  useEffect(() => {
    function onStorageChange(e) {
      if (e.key === "Outseta.nocode.accessToken") {
        setLoggedIn(isLoggedIn());
      }
      if (e.key === SIDEBAR_KEY) {
        setSidebarCollapsed(e.newValue === "true");
      }
    }
    window.addEventListener("storage", onStorageChange);

    // Also poll for sidebar state changes (same-tab writes don't fire storage event)
    const sidebarTimer = setInterval(() => {
      const val = localStorage.getItem(SIDEBAR_KEY) === "true";
      setSidebarCollapsed(prev => prev !== val ? val : prev);
    }, 200);

    // Poll briefly after mount for Outseta token
    const timer = setInterval(() => {
      if (isLoggedIn()) {
        setLoggedIn(true);
        clearInterval(timer);
      }
    }, 500);
    const cleanup = setTimeout(() => clearInterval(timer), 10000);

    // Listen for pipeline iframe messages to hide/show sidebar
    function onPipelineMessage(e) {
      if (e.data && e.data.type === "pipeline-modal") {
        setSidebarHidden(e.data.open);
      }
    }
    window.addEventListener("message", onPipelineMessage);

    return () => {
      window.removeEventListener("storage", onStorageChange);
      window.removeEventListener("message", onPipelineMessage);
      clearInterval(timer);
      clearInterval(sidebarTimer);
      clearTimeout(cleanup);
    };
  }, []);

  const sidebarWidth = isMobile || sidebarHidden ? "0px" : sidebarCollapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-width)";

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <Navbar />
      {!sidebarHidden && <Sidebar />}

      {/* Main content area — offset by sidebar width */}
      <main
        className="flex-1 transition-[margin] duration-300 ease-in-out max-[991px]:ml-0 pb-20 max-[991px]:pb-24 px-4 sm:px-6 lg:px-8"
        style={{
          marginLeft: sidebarWidth,
          paddingTop: "24px",
        }}
      >
        <div className="w-full">
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
                <a
                  href="/login"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-primary-600 hover:bg-primary-hover no-underline transition-colors"
                  style={{ color: "#fff" }}
                >
                  Login or Sign Up
                </a>
              </div>
            </div>
          )}
        </div>
      </main>

      <div
        className="transition-[margin] duration-300 ease-in-out max-[991px]:ml-0"
        style={{ marginLeft: sidebarWidth }}
      >
        <Footer />
      </div>

      <MobileBottomNav />
    </div>
  );
}
