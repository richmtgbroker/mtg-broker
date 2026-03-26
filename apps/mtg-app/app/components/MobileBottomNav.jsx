import { Link, useLocation } from "react-router";
import { mobileBottomNavItems } from "../lib/nav-items";

export default function MobileBottomNav() {
  const location = useLocation();
  const currentPath = location.pathname.replace(/\/$/, "");

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[9998] bg-white border-t border-border shadow-[0_-2px_10px_rgba(0,0,0,0.05)] hidden max-[991px]:flex">
      {mobileBottomNavItems.map((item) => {
        const isActive = currentPath === item.href.replace(/\/$/, "");
        return (
          <Link
            key={item.href}
            to={item.href}
            className={`flex-1 flex flex-col items-center justify-center py-2 no-underline text-[10px] font-medium gap-1 transition-colors ${
              isActive ? "text-primary-600" : "text-text-muted"
            }`}
          >
            <i className={`fas ${item.faIcon} text-base`} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
