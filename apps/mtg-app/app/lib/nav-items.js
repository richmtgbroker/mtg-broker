// Sidebar & mobile navigation items
// Each item has: label, href, icon (SVG path content), and optional visibility flags

export const mainNavItems = [
  {
    label: "Dashboard",
    href: "/app/dashboard",
    icon: `<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>`,
  },
  {
    label: "Loan Search",
    href: "/app/loan-search",
    icon: `<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>`,
  },
  {
    label: "AI Loan Finder",
    href: "/app/ai-search",
    icon: `<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path><path d="M20 3v4"></path><path d="M22 5h-4"></path><path d="M4 17v2"></path><path d="M5 18H3"></path>`,
  },
  {
    label: "Lenders",
    href: "/app/lenders",
    icon: `<path d="M3 21h18M5 21v-7M19 21v-7M9 21v-7M15 21v-7M3 10h18M12 3L2 10h20L12 3z"></path>`,
  },
  {
    label: "Products",
    href: "/app/products",
    icon: `<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>`,
  },
  {
    label: "Property Types",
    href: "/app/property-types",
    icon: `<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"></path><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"></path><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"></path><path d="M10 6h4"></path><path d="M10 10h4"></path><path d="M10 14h4"></path><path d="M10 18h4"></path>`,
  },
];

export const secondaryNavItems = [
  {
    label: "Vendors",
    href: "/app/vendors",
    icon: `<path d="M3 9l1.5-5h15L21 9"></path><path d="M3 9v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9"></path><path d="M9 21V13h6v8"></path><path d="M3 9h18"></path><path d="M6 9v3a3 3 0 0 0 6 0V9"></path><path d="M12 9v3a3 3 0 0 0 6 0V9"></path>`,
  },
  {
    label: "Contacts",
    href: "/app/contacts",
    icon: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>`,
  },
];

export const toolsNavItems = [
  {
    label: "Pipeline",
    href: "/app/pipeline",
    icon: `<polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline>`,
  },
  {
    label: "Calculators",
    href: "/app/calculators",
    icon: `<rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="8" x2="16" y1="6" y2="6"></line><line x1="16" x2="16" y1="14" y2="18"></line><path d="M16 10h.01"></path><path d="M12 10h.01"></path><path d="M8 10h.01"></path><path d="M12 14h.01"></path><path d="M8 14h.01"></path><path d="M12 18h.01"></path><path d="M8 18h.01"></path>`,
  },
  {
    label: "Goal Setting",
    href: "/app/goal-setting",
    icon: `<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle>`,
  },
  {
    label: "Social Media",
    href: "/app/social-media",
    icon: `<circle cx="13.5" cy="6.5" r="2.5"></circle><path d="M17.5 10.5c1.7-1 3.5 0 3.5 0"></path><path d="M3 21c0 0 1-4 4-4 1.5 0 2.3.5 3 1l2-6"></path><path d="M12.5 12L10 21"></path><path d="M3 3l18 18"></path><rect x="2" y="2" width="20" height="20" rx="2"></rect>`,
  },
  {
    label: "Tools",
    href: "/app/tools",
    icon: `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>`,
  },
];

export const nexaNavItem = {
  label: "Credit Reports",
  href: "/app/credit-reports",
  icon: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M9 15l2 2 4-4"></path>`,
};

export const workspaceNavItems = [
  {
    label: "Saved Items",
    href: "/app/saved",
    icon: `<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>`,
  },
  {
    label: "Referrals",
    href: "/app/referral",
    icon: `<polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>`,
    proOnly: true,
  },
  {
    label: "Settings",
    href: "/app/settings",
    icon: `<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>`,
  },
];

// Mobile bottom nav (subset of main nav)
export const mobileBottomNavItems = [
  { label: "Dashboard", href: "/app/dashboard", faIcon: "fa-home" },
  { label: "Lenders", href: "/app/lenders", faIcon: "fa-building" },
  { label: "Search", href: "/app/loan-search", faIcon: "fa-search" },
  { label: "Products", href: "/app/products", faIcon: "fa-box" },
  { label: "Vendors", href: "/app/vendors", faIcon: "fa-store" },
  { label: "Contacts", href: "/app/contacts", faIcon: "fa-address-book" },
];
