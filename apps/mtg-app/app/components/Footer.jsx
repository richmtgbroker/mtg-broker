import { Link } from "react-router";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-white py-8 px-6">
      <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-text-muted">
        <div className="flex items-center gap-2">
          <span>&copy; {year} mtg.broker</span>
          <span className="text-border">|</span>
          <Link to="/pricing" className="no-underline text-text-muted hover:text-primary-600 transition-colors">
            Pricing
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <a href="mailto:support@mtg.broker" className="no-underline text-text-muted hover:text-primary-600 transition-colors">
            Support
          </a>
        </div>
      </div>
    </footer>
  );
}
