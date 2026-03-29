import { type RouteConfig, route, layout } from "@react-router/dev/routes";

export default [
  // Marketing pages (no sidebar)
  route("/", "routes/home.jsx"),
  route("/pricing", "routes/pricing.jsx"),
  route("/privacy-policy", "routes/privacy-policy.jsx"),
  route("/terms-of-service", "routes/terms-of-service.jsx"),
  route("/admin-hub", "routes/admin-hub.jsx"),
  route("/login", "routes/login.jsx"),

  // SEO files
  route("/robots.txt", "routes/robots[.]txt.jsx"),
  route("/sitemap.xml", "routes/sitemap[.]xml.jsx"),

  // App pages (with navbar + sidebar + footer)
  layout("routes/app-layout.jsx", [
    route("/app/dashboard", "routes/app/dashboard.jsx"),
    route("/app/loan-search", "routes/app/loan-search.jsx"),
    route("/app/ai-search", "routes/app/ai-search.jsx"),
    route("/app/lenders", "routes/app/lenders.jsx"),
    route("/app/lenders/:slug", "routes/app/lender-detail.jsx"),
    route("/app/products", "routes/app/products.jsx"),
    route("/app/products/:slug", "routes/app/product-detail.jsx"),
    route("/app/property-types", "routes/app/property-types.jsx"),
    route("/app/property-types/:slug", "routes/app/property-type-detail.jsx"),
    route("/app/vendors", "routes/app/vendors.jsx"),
    route("/app/vendors/:slug", "routes/app/vendor-detail.jsx"),
    route("/app/contacts", "routes/app/contacts.jsx"),
    route("/app/pipeline", "routes/app/pipeline.jsx"),
    route("/app/calculators", "routes/app/calculators.jsx"),
    route("/app/closing-costs-estimate", "routes/app/closing-costs-estimate.jsx"),
    route("/app/lender-pricing-comparison", "routes/app/lender-pricing-comparison.jsx"),
    route("/app/loan-scenario-compare", "routes/app/loan-scenario-compare.jsx"),
    route("/app/rent-vs-buy", "routes/app/rent-vs-buy.jsx"),
    route("/app/goal-setting", "routes/app/goal-setting.jsx"),
    route("/app/social-media", "routes/app/social-media.jsx"),
    route("/app/tools", "routes/app/tools.jsx"),
    route("/app/credit-reports", "routes/app/credit-reports.jsx"),
    route("/app/saved", "routes/app/saved.jsx"),
    route("/app/referral", "routes/app/referral.jsx"),
    route("/app/settings", "routes/app/settings.jsx"),
  ]),
] satisfies RouteConfig;
