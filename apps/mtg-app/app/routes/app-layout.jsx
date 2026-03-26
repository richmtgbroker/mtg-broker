import { Outlet } from "react-router";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Footer from "../components/Footer";
import MobileBottomNav from "../components/MobileBottomNav";

/**
 * App layout — wraps all /app/* routes with navbar, sidebar, footer.
 * The main content area is positioned to the right of the sidebar
 * and below the navbar, matching the current Webflow layout.
 */
export default function AppLayout() {
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
          <Outlet />
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
