import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router";
import { isLoggedIn, getUserPlan, isAdmin, isNexaUser, getUserEmail, logout } from "../lib/auth";
import { PLAN_MAP, OUTSETA_DOMAIN } from "../lib/constants";
import { mainNavItems, secondaryNavItems, toolsNavItems, nexaNavItem, workspaceNavItems } from "../lib/nav-items";
import NavIcon from "./NavIcon";

const LOGO_URL = "/logo.png";

export default function Navbar() {
  const location = useLocation();
  const [loggedIn, setLoggedIn] = useState(false);
  const [plan, setPlan] = useState(null);
  const [admin, setAdmin] = useState(false);
  const [nexa, setNexa] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const helpRef = useRef(null);

  useEffect(() => {
    setLoggedIn(isLoggedIn());
    setPlan(getUserPlan());
    setAdmin(isAdmin());
    setNexa(isNexaUser());
  }, [location.pathname]);

  // Close help dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (helpRef.current && !helpRef.current.contains(e.target)) {
        setHelpOpen(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const planColors = {
    LITE: "bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]",
    PLUS: "bg-primary-50 text-primary-600 border-primary-200",
    PRO: "bg-gradient-to-br from-primary-600 to-purple-600 text-white border-transparent",
  };

  return (
    <>
      {/* Spacer to push content below fixed navbar */}
      <div style={{ height: "var(--navbar-height)" }} aria-hidden="true" />

      <header className="fixed top-0 left-0 right-0 z-[9999] bg-white border-b border-border-light shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="w-[90%] max-w-[1280px] mx-auto py-4 flex items-center justify-between gap-4">
          {/* Brand + Plan Tags */}
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/app/dashboard" className="flex items-center h-11 no-underline min-w-[220px]" aria-label="MtgBroker dashboard">
              <img src={LOGO_URL} alt="MtgBroker" className="h-8 w-auto block" loading="eager" />
            </Link>

            {loggedIn && plan && (
              <div className="flex items-center gap-1.5 max-md:hidden">
                <span className={`text-[11px] font-bold tracking-wide uppercase px-2.5 py-0.5 rounded-md border ${planColors[plan] || planColors.LITE}`}>
                  {plan}
                </span>
                {admin && (
                  <Link to="/admin-hub" className="text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-200 no-underline">
                    Admin
                  </Link>
                )}
                {nexa && (
                  <span className="text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-md bg-gradient-to-br from-primary-600 to-primary-800 text-white border border-transparent">
                    NEXA
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 justify-end flex-none">
            {loggedIn ? (
              <>
                <Link to="/app/dashboard" className="font-extrabold text-white px-5 py-2.5 rounded-md bg-primary-600 hover:bg-primary-800 no-underline text-[15px] h-10 inline-flex items-center shadow-sm transition-all max-md:hidden">
                  Dashboard
                </Link>

                {/* Help Button */}
                <div className="relative max-md:hidden" ref={helpRef}>
                  <button
                    onClick={() => setHelpOpen(!helpOpen)}
                    className="w-10 h-10 rounded-full border border-border-light bg-white flex items-center justify-center cursor-pointer text-text-muted hover:bg-surface-hover hover:text-primary-600 hover:border-primary-200 transition-all"
                    aria-label="Help and Support"
                    aria-expanded={helpOpen}
                  >
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </button>
                  {helpOpen && (
                    <div className="absolute top-[calc(100%+10px)] right-0 w-[280px] bg-white border border-border-light rounded-2xl shadow-lg z-[10000] overflow-hidden animate-[fadeIn_0.15s_ease]">
                      <div className="px-4 pt-3.5 pb-2.5 text-[11px] font-bold text-text-faint uppercase tracking-wide">Help and Support</div>
                      <a href={`https://${OUTSETA_DOMAIN}/support/kb/categories`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-2.5 no-underline text-text hover:bg-surface-hover transition-colors">
                        <span className="w-[34px] h-[34px] rounded-[10px] bg-surface-active flex items-center justify-center shrink-0 text-text-secondary">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
                        </span>
                        <span className="flex flex-col gap-px"><span className="text-sm font-semibold">Knowledge Base</span><span className="text-xs text-text-faint">Browse help articles</span></span>
                      </a>
                      <button onClick={() => { setHelpOpen(false); setSupportOpen(true); }} className="flex items-center gap-3 px-4 py-2.5 w-full text-left bg-transparent border-none cursor-pointer font-inherit text-text hover:bg-surface-hover transition-colors">
                        <span className="w-[34px] h-[34px] rounded-[10px] bg-surface-active flex items-center justify-center shrink-0 text-text-secondary">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                        </span>
                        <span className="flex flex-col gap-px"><span className="text-sm font-semibold">Submit a Ticket</span><span className="text-xs text-text-faint">Get help from our team</span></span>
                      </button>
                      <a href="mailto:support@mtg.broker" className="flex items-center gap-3 px-4 py-2.5 no-underline text-text hover:bg-surface-hover transition-colors">
                        <span className="w-[34px] h-[34px] rounded-[10px] bg-surface-active flex items-center justify-center shrink-0 text-text-secondary">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                        </span>
                        <span className="flex flex-col gap-px"><span className="text-sm font-semibold">Email Support</span><span className="text-xs text-text-faint">support@mtg.broker</span></span>
                      </a>
                    </div>
                  )}
                </div>

                {/* Avatar */}
                <Link to="/app/settings" className="w-11 h-11 rounded-full border border-border-light bg-white flex items-center justify-center overflow-hidden no-underline text-text max-md:hidden">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Z" stroke="currentColor" strokeWidth="2" /><path d="M4.5 20.5c1.8-3.2 5-5.1 7.5-5.1s5.7 1.9 7.5 5.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </Link>
              </>
            ) : (
              <div className="flex gap-2 max-md:hidden">
                <a href="#o-anonymous" className="h-11 min-w-[110px] px-4 rounded-xl inline-flex items-center justify-center no-underline font-extrabold text-base border border-border-light bg-surface-active text-text">
                  Login
                </a>
                <a href="#o-anonymous" className="h-11 min-w-[110px] px-4 rounded-xl inline-flex items-center justify-center no-underline font-extrabold text-base bg-primary-600 text-white border border-primary-600">
                  Signup
                </a>
              </div>
            )}

            {/* Burger (mobile) */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="hidden max-[991px]:inline-block w-11 h-11 rounded-xl border border-border-light bg-white cursor-pointer p-2.5"
              aria-label="Open menu"
              aria-expanded={mobileOpen}
            >
              <span className="block h-0.5 bg-text rounded-sm my-[5px]" />
              <span className="block h-0.5 bg-text rounded-sm my-[5px]" />
              <span className="block h-0.5 bg-text rounded-sm my-[5px]" />
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="w-full bg-white border-b border-border-light shadow-lg p-5 max-h-[calc(100vh-77px)] overflow-y-auto">
            <nav className="flex flex-col gap-1">
              {[...mainNavItems, ...secondaryNavItems, ...toolsNavItems].map((item) => (
                <MobileNavLink key={item.href} item={item} currentPath={location.pathname} />
              ))}

              {nexa && (
                <div className="mt-2 pt-2">
                  <div className="text-[11px] font-bold text-text-faint uppercase tracking-wide px-3 py-2">NEXA Exclusive</div>
                  <MobileNavLink item={nexaNavItem} currentPath={location.pathname} isNexa />
                </div>
              )}

              <div className="h-px bg-border my-4" />

              {workspaceNavItems
                .filter((item) => !item.proOnly || (item.proOnly && plan === "PRO"))
                .map((item) => (
                  <MobileNavLink key={item.href} item={item} currentPath={location.pathname} />
                ))}

              <div className="h-px bg-border my-4" />

              {loggedIn ? (
                <div className="flex gap-2.5">
                  <Link to="/app/dashboard" className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] no-underline font-bold text-sm bg-primary-600 text-white">
                    Dashboard
                  </Link>
                  <button onClick={logout} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] font-bold text-sm bg-surface-active text-text-secondary border border-border-light cursor-pointer">
                    Logout
                  </button>
                </div>
              ) : (
                <div>
                  <a href="#o-anonymous" className="block w-full px-4 py-3 rounded-xl no-underline font-extrabold text-base text-center bg-primary-600 text-white mt-2.5">
                    Sign Up Free
                  </a>
                  <a href="#o-anonymous" className="block w-full px-4 py-3 rounded-xl no-underline font-extrabold text-base text-center bg-surface-active text-text border border-border-light mt-2.5">
                    Login
                  </a>
                </div>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Support Modal */}
      {supportOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-5">
          <div className="absolute inset-0 bg-black/50 animate-[fadeIn_0.2s_ease]" onClick={() => setSupportOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[560px] max-h-[85vh] overflow-hidden flex flex-col animate-[slideUp_0.25s_ease-out]">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border-light">
              <h3 className="text-lg font-bold m-0">Submit a Support Ticket</h3>
              <button onClick={() => setSupportOpen(false)} className="w-9 h-9 rounded-[10px] border-none bg-surface-active flex items-center justify-center cursor-pointer text-text-muted hover:bg-border hover:text-text transition-all">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div data-o-support="1" data-mode="embed" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MobileNavLink({ item, currentPath, isNexa = false }) {
  const isActive = currentPath.replace(/\/$/, "") === item.href.replace(/\/$/, "");
  return (
    <Link
      to={item.href}
      className={`flex items-center gap-3 px-3 py-3 rounded-xl no-underline font-semibold text-[15px] transition-colors ${
        isActive
          ? "bg-primary-50 text-primary-600"
          : isNexa
            ? "text-primary-800 hover:bg-primary-50"
            : "text-text hover:bg-surface-section"
      }`}
    >
      <NavIcon paths={item.icon} size={20} className="shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}
