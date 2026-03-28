import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router";
import { isProUser, isNexaUser, checkNexaAccess } from "../lib/auth";
import { mainNavItems, secondaryNavItems, toolsNavItems, nexaNavItem, workspaceNavItems } from "../lib/nav-items";
import NavIcon from "./NavIcon";

const STORAGE_KEY = "sidebar-collapsed";

export default function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [pro, setPro] = useState(false);
  const [nexa, setNexa] = useState(false);

  // Load saved state on mount
  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "true");
    setPro(isProUser());
    setNexa(isNexaUser());
    // Async NEXA check via Outseta custom field
    checkNexaAccess().then(isNexa => { if (isNexa) setNexa(true); });
  }, []);

  // Re-check auth on route change
  useEffect(() => {
    setPro(isProUser());
    setNexa(isNexaUser());
    checkNexaAccess().then(isNexa => { if (isNexa) setNexa(true); });
  }, [location.pathname]);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  }

  const currentPath = location.pathname.replace(/\/$/, "");

  return (
    <nav
      className={`fixed left-0 bg-white border-r border-border z-[999] flex flex-col transition-[width] duration-300 ease-in-out overflow-hidden max-[991px]:hidden`}
      style={{
        top: "var(--navbar-height)",
        width: collapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-width)",
        height: "calc(100vh - var(--navbar-height))",
      }}
    >
      {/* Header */}
      <div className="px-5 border-b border-border flex items-center justify-between min-h-[60px] box-border gap-3">
        <span className={`text-[11px] font-bold text-text-faint uppercase tracking-wide whitespace-nowrap transition-opacity duration-200 ${collapsed ? "opacity-0 w-0 overflow-hidden" : ""}`}>
          Navigation
        </span>
        <button
          onClick={toggle}
          className="w-8 h-8 border border-border rounded-lg bg-white cursor-pointer flex items-center justify-center transition-all hover:bg-surface-section shrink-0"
          aria-label="Toggle sidebar"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`w-4 h-4 text-text-muted transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}
          >
            <polyline points="11 17 6 12 11 7" />
            <polyline points="18 17 13 12 18 7" />
          </svg>
        </button>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-4 px-3">
        {/* Main nav */}
        <div className="mb-6">
          {mainNavItems.map((item) => (
            <SidebarLink key={item.href} item={item} currentPath={currentPath} collapsed={collapsed} />
          ))}
        </div>

        {/* Divider */}
        <hr className={`border-none border-t border-border ${collapsed ? "my-1.5" : "my-3"}`} />

        {/* Secondary */}
        <div className="mb-6">
          {secondaryNavItems.map((item) => (
            <SidebarLink key={item.href} item={item} currentPath={currentPath} collapsed={collapsed} />
          ))}
        </div>

        {/* Divider */}
        <hr className={`border-none border-t border-border ${collapsed ? "my-1.5" : "my-3"}`} />

        {/* Tools */}
        <div className="mb-6">
          {toolsNavItems.map((item) => (
            <SidebarLink key={item.href} item={item} currentPath={currentPath} collapsed={collapsed} />
          ))}
        </div>

        {/* NEXA Exclusive */}
        {nexa && (
          <div className="mb-6">
            <div className={`text-[11px] font-bold text-text-faint uppercase tracking-wide px-3 pb-2 whitespace-nowrap transition-all duration-200 ${collapsed ? "opacity-0 h-0 p-0 overflow-hidden" : ""}`}>
              NEXA Exclusive
            </div>
            <SidebarLink item={nexaNavItem} currentPath={currentPath} collapsed={collapsed} isNexa />
          </div>
        )}

        {/* My Workspace */}
        <div className="mb-6">
          <div className={`text-[11px] font-bold text-text-faint uppercase tracking-wide px-3 pb-2 whitespace-nowrap transition-all duration-200 ${collapsed ? "opacity-0 h-0 p-0 overflow-hidden" : ""}`}>
            My Workspace
          </div>
          {workspaceNavItems
            .filter((item) => !item.proOnly || pro)
            .map((item) => (
              <SidebarLink key={item.href} item={item} currentPath={currentPath} collapsed={collapsed} isPro={item.proOnly} />
            ))}
        </div>
      </div>
    </nav>
  );
}

function SidebarLink({ item, currentPath, collapsed, isNexa = false, isPro = false }) {
  const isActive = currentPath === item.href.replace(/\/$/, "");

  const activeClasses = isNexa
    ? "bg-emerald-50 text-emerald-600"
    : "bg-primary-50 text-primary-600 font-semibold";

  const hoverClasses = isNexa
    ? "hover:bg-emerald-50 hover:text-emerald-800"
    : "hover:bg-surface-section hover:text-text";

  return (
    <Link
      to={item.href}
      className={`flex items-center gap-3 rounded-[10px] no-underline text-[17px] font-medium whitespace-nowrap overflow-hidden transition-all duration-150 ${
        collapsed ? "p-2.5 justify-center" : "px-3 py-2.5"
      } ${isActive ? activeClasses : hoverClasses}`}
      style={isActive ? undefined : { color: "#64748b" }}
      title={collapsed ? item.label : undefined}
    >
      <NavIcon
        paths={item.icon}
        size={20}
        className={`shrink-0 ${isActive ? (isNexa ? "text-emerald-600" : "text-primary-600") : isNexa ? "text-emerald-600" : "text-text-muted"}`}
      />
      <span className={`transition-opacity duration-200 ${collapsed ? "opacity-0 w-0 overflow-hidden inline-block" : ""}`}>
        {item.label}
      </span>
      {isPro && !collapsed && (
        <span className="text-[9px] font-bold text-primary-600 bg-primary-50 border border-primary-200 rounded px-1.5 py-px uppercase tracking-wider shrink-0">
          PRO
        </span>
      )}
    </Link>
  );
}
