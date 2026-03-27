import { useState, useEffect, useRef } from "react";
import { Link } from "react-router";
import { getAccessToken, getUserEmail } from "../../lib/auth";
import NavIcon from "../../components/NavIcon";

const API_BASE = "https://mtg-broker-api.rich-e00.workers.dev";
const PIPELINE_API = "https://mtg-broker-pipeline.rich-e00.workers.dev";
const LENDERS_API = "https://mtg-broker-pipeline.rich-e00.workers.dev/api/lenders";

const CACHE_TTL = {
  rates: 30 * 60 * 1000,
  lenders: 10 * 60 * 1000,
  pipeline: 5 * 60 * 1000,
};

export function meta() {
  return [{ title: "Dashboard — MtgBroker" }];
}

export default function DashboardPage() {
  const [userName, setUserName] = useState("");
  const [rates, setRates] = useState(null);
  const [lenderCount, setLenderCount] = useState("--");
  const [pipelineStats, setPipelineStats] = useState({ loans: 0, volume: 0, closings: 0 });
  const [leads, setLeads] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [closings, setClosings] = useState([]);
  const [dateStr, setDateStr] = useState("");

  useEffect(() => {
    // Set date on client only to avoid SSR hydration mismatch
    setDateStr(new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }));

    async function init() {
      const email = getUserEmail();
      const token = getAccessToken();

      await Promise.allSettled([
        loadUserName(setUserName),
        loadRates(setRates),
        loadLenderCount(setLenderCount),
        loadPipelineData(email, token, setPipelineStats, setLeads, setClosings),
        loadTasks(email, token, setTasks),
      ]);
    }
    init();
  }, []);

  return (
    <div>
      {/* Header */}
      <header className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-[32px] font-extrabold tracking-[-0.5px] text-text">
            {userName ? `Welcome back, ${userName}!` : "Welcome back!"}
          </h1>
          <p className="text-text-muted text-base mt-1">Your mortgage toolkit at a glance</p>
        </div>
        <CalendarChip dateStr={dateStr} closings={closings} />
      </header>

      {/* Top Row: Quick Actions + Rates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-7 mb-7">
        <QuickActions lenderCount={lenderCount} />
        <RatesSection rates={rates} />
      </div>

      {/* Bottom Row: Tasks + Leads + Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
        <TasksSection tasks={tasks} />
        <LeadsSection leads={leads} />
        <PipelineOverview stats={pipelineStats} />
      </div>
    </div>
  );
}

// ============================================================
// QUICK ACTIONS
// ============================================================
function QuickActions({ lenderCount }) {
  const actions = [
    { href: "/app/ai-search", label: "AI Loan Finder", sub: "AI-powered search", highlight: true, icon: `<path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93L12 22"></path><path d="M12 2a4 4 0 0 0-4 4c0 1.95 1.4 3.58 3.25 3.93"></path><path d="M16 16c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"></path><path d="M8 16c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"></path>` },
    { href: "/app/loan-search", label: "Loan Search", sub: "630+ products", icon: `<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>` },
    { href: "/app/lenders", label: "Lenders", sub: `${lenderCount} in directory`, icon: `<path d="M3 21h18M5 21v-7M19 21v-7M9 21v-7M15 21v-7M3 10h18M12 3L2 10h20L12 3z"></path>` },
    { href: "/app/calculators", label: "Calculators", sub: "Mortgage tools", icon: `<rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="8" x2="16" y1="6" y2="6"></line><path d="M16 10h.01M12 10h.01M8 10h.01M16 14h.01M12 14h.01M8 14h.01M16 18h.01M12 18h.01M8 18h.01"></path>` },
    { href: "/app/contacts", label: "Contacts", sub: "Your network", icon: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path>` },
    { href: "/app/products", label: "Products", sub: "Loan types", icon: `<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>` },
  ];

  return (
    <DashSection title="Quick Actions">
      <div className="grid grid-cols-2 gap-2">
        {actions.map((a) => (
          <Link
            key={a.href}
            to={a.href}
            className={`group flex flex-col items-center text-center px-3 py-4 rounded-[16px] border no-underline transition-all ${
              a.highlight
                ? "bg-[#F0F7FF] border-2 border-[#2563EB] shadow-[0_4px_16px_rgba(37,99,235,0.2)]"
                : "bg-[#F8FAFC] border-[#E2E8F0] hover:border-text-muted"
            }`}
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-2 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all group-hover:bg-[#2563EB] group-hover:text-white group-hover:scale-105 ${a.highlight ? "bg-primary-600 text-white" : "bg-white text-text-muted"}`}>
              <NavIcon paths={a.icon} size={18} />
            </div>
            <div className="min-w-0">
              <div className={`text-[13px] font-bold ${a.highlight ? "text-primary-600" : "text-text"}`}>{a.label}</div>
              <div className="text-[11px] text-text-faint truncate">{a.sub}</div>
            </div>
          </Link>
        ))}
      </div>
    </DashSection>
  );
}

// ============================================================
// RATES
// ============================================================
function RatesSection({ rates }) {
  const rateKeys = [
    { key: "30yr", label: "30yr Fixed" },
    { key: "15yr", label: "15yr Fixed" },
    { key: "fha", label: "FHA 30yr" },
    { key: "va", label: "VA 30yr" },
    { key: "jumbo", label: "Jumbo 30yr" },
    { key: "10yr", label: "10yr Treasury" },
  ];

  return (
    <DashSection title="Today's Avg Rates" icon={`<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline>`}>
      <div className="grid grid-cols-2 gap-3">
        {rateKeys.map(({ key, label }) => {
          const data = rates?.[key];
          const change = data ? parseFloat(data.change) : 0;
          return (
            <div key={key} className="bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] rounded-[14px] p-3 shadow-[0_2px_8px_rgba(37,99,235,0.2)]">
              <div className="text-xs text-white/85 font-medium mb-1 uppercase">{label}</div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold text-white">{data ? `${data.rate}%` : "--%"}</span>
                {data && (
                  <span className={`text-xs font-semibold flex items-center gap-0.5 px-1.5 py-0.5 rounded ${change > 0 ? "bg-red-500/20 text-red-300" : change < 0 ? "bg-green-500/20 text-green-300" : "bg-white/15 text-white/70"}`}>
                    {change > 0 && <span>&#9650;</span>}
                    {change < 0 && <span>&#9660;</span>}
                    {change >= 0 ? "+" : ""}{change.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pricing Engines */}
      <div className="mt-4">
        <div className="text-[11px] font-bold text-text-faint uppercase tracking-wide mb-2">Pricing Engines</div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { name: "LenderPrice", url: "https://marketplace.digitallending.com/#/login", domain: "lenderprice.com" },
            { name: "LoanNEX", url: "https://web.loannex.com/", domain: "loannex.com" },
            { name: "LoanSifter", url: "https://loansifternow.optimalblue.com/", domain: null },
            { name: "Polly", url: "https://lx.pollyex.com/accounts/login/", domain: "polly.io" },
          ].map((engine) => (
            <a key={engine.name} href={engine.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-[10px] bg-white border border-[#E2E8F0] text-xs font-medium text-text-secondary no-underline hover:border-primary-600 hover:text-primary-600 transition-colors">
              {engine.domain ? (
                <img src={`https://www.google.com/s2/favicons?domain=${engine.domain}&sz=32`} alt="" className="w-4 h-4 rounded" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0066CC" /><text x="16" y="21" textAnchor="middle" fontFamily="Arial" fontWeight="700" fontSize="14" fill="#fff">LS</text></svg>
              )}
              <span className="flex-1">{engine.name}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 17L17 7" /><path d="M7 7h10v10" /></svg>
            </a>
          ))}
        </div>
      </div>
    </DashSection>
  );
}

// ============================================================
// TASKS
// ============================================================
function TasksSection({ tasks }) {
  return (
    <DashSection title="Tasks" icon={`<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>`} linkHref="/app/pipeline" linkText="View All">
      {tasks.length === 0 ? (
        <EmptyState icon={`<path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>`} text="No pending tasks." linkHref="/app/pipeline" linkText="Go to Pipeline" />
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.slice(0, 8).map((task, i) => {
            const isOverdue = task.dueMeta === "Overdue";
            return (
              <Link key={i} to={task.link} className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] border no-underline transition-colors hover:bg-surface-hover ${isOverdue ? "bg-red-50 border-red-200" : "bg-[#F8FAFC] border-[#E2E8F0]"}`}>
                <div className={`w-5 h-5 shrink-0 ${isOverdue ? "text-red-500" : "text-text-faint"}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /></svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-text truncate">{task.name}</div>
                  {task.meta && <div className={`text-xs ${isOverdue ? "text-[#DC2626] font-semibold" : "text-text-faint"}`}>{task.meta}</div>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </DashSection>
  );
}

// ============================================================
// LEADS
// ============================================================
function LeadsSection({ leads }) {
  return (
    <DashSection title="Leads" linkHref="/app/pipeline" linkText="View All">
      {leads.length === 0 ? (
        <EmptyState icon={`<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path>`} text="No leads in pipeline." linkHref="/app/pipeline" linkText="Add a new lead" />
      ) : (
        <div className="flex flex-col gap-2">
          {leads.slice(0, 5).map((lead, i) => (
            <Link key={i} to="/app/pipeline" className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] no-underline text-text hover:bg-surface-hover transition-colors">
              <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center shrink-0 text-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{lead.borrower}</div>
                <div className="text-xs text-text-faint">{[lead.type, lead.amount].filter(Boolean).join(" \u2022 ") || "Lead"}</div>
              </div>
              <svg className="w-4 h-4 text-text-faint shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            </Link>
          ))}
        </div>
      )}
    </DashSection>
  );
}

// ============================================================
// PIPELINE OVERVIEW
// ============================================================
function PipelineOverview({ stats }) {
  return (
    <DashSection title="Pipeline Overview" linkHref="/app/pipeline" linkText="View All">
      <div className="grid grid-cols-1 gap-3">
        {/* Pipeline Loans — highlight card */}
        <Link to="/app/pipeline" className="rounded-[10px] px-4 py-3 no-underline text-white shadow-[0_1px_3px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all" style={{ background: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)" }}>
          <div className="text-[24px] font-bold mb-0.5">{stats.loans}</div>
          <div className="text-[13px] opacity-80">Pipeline Loans</div>
        </Link>

        {/* Pipeline Volume */}
        <Link to="/app/pipeline" className="rounded-[10px] px-4 py-3 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.1)] no-underline hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all">
          <div className="text-[24px] font-bold mb-0.5 text-primary-600">{formatCurrency(stats.volume)}</div>
          <div className="text-[13px] text-text-muted opacity-80">Pipeline Volume</div>
        </Link>

        {/* Upcoming Closings */}
        <Link to="/app/pipeline" className="rounded-[10px] px-4 py-3 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.1)] no-underline hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all">
          <div className="text-[24px] font-bold mb-0.5 text-text">{stats.closings}</div>
          <div className="text-[13px] text-text-muted opacity-80">Upcoming Closings</div>
          <div className="text-xs text-text-faint mt-0.5">Next 14 days</div>
        </Link>
      </div>
    </DashSection>
  );
}

// ============================================================
// CALENDAR CHIP + POPUP
// ============================================================
function CalendarChip({ dateStr, closings }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [open]);

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const monthShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
  const closingDates = new Set(closings.map((c) => c.dateStr));

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  }

  const now = new Date(); now.setHours(0, 0, 0, 0);
  const thirtyDays = new Date(now.getTime() + 30 * 86400000);
  const upcomingClosings = closings.filter((c) => {
    const d = parseLocalDate(c.date);
    return d && d >= now && d <= thirtyDays;
  }).slice(0, 4);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface-active border border-border text-sm font-medium text-text-secondary cursor-pointer hover:bg-surface-section transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        {dateStr}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-[320px] bg-white border border-border rounded-2xl shadow-xl z-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-text">{monthNames[month]} {year}</h4>
            <div className="flex gap-1">
              <button onClick={prevMonth} className="w-7 h-7 rounded-lg border border-border bg-white flex items-center justify-center cursor-pointer hover:bg-surface-hover">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <button onClick={nextMonth} className="w-7 h-7 rounded-lg border border-border bg-white flex items-center justify-center cursor-pointer hover:bg-surface-hover">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {dayNames.map((d) => (
              <div key={d} className="text-[10px] font-semibold text-text-faint text-center py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`e-${i}`} className="w-full aspect-square" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isToday = isCurrentMonth && day === today.getDate();
              const hasClosing = closingDates.has(dateKey);
              return (
                <div key={day} className={`w-full aspect-square flex items-center justify-center text-xs rounded-lg ${isToday ? "bg-primary-600 text-white font-bold" : hasClosing ? "bg-amber-100 text-amber-800 font-semibold" : "text-text-secondary"}`}>
                  {day}
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-border">
            <div className="text-[11px] font-bold text-text-faint uppercase tracking-wide mb-2 flex items-center gap-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              Upcoming Closings
            </div>
            {upcomingClosings.length === 0 ? (
              <p className="text-xs text-text-faint">No closings in the next 30 days</p>
            ) : (
              <div className="flex flex-col gap-2">
                {upcomingClosings.map((c, i) => {
                  const d = parseLocalDate(c.date);
                  return d ? (
                    <Link key={i} to="/app/pipeline" className="flex items-center gap-3 no-underline text-text hover:bg-surface-hover rounded-lg p-1.5 -mx-1.5 transition-colors">
                      <div className="w-10 h-10 rounded-lg bg-primary-50 flex flex-col items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-primary-600 uppercase">{monthShort[d.getMonth()]}</span>
                        <span className="text-sm font-bold text-primary-600 leading-none">{d.getDate()}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{c.borrower}</div>
                        <div className="text-xs text-text-faint">{c.amount}</div>
                      </div>
                    </Link>
                  ) : null;
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SHARED COMPONENTS
// ============================================================
function DashSection({ title, icon, linkHref, linkText, children }) {
  return (
    <div className="bg-white rounded-[20px] border border-border p-7 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-text flex items-center gap-2">
          {icon && <NavIcon paths={icon} size={16} className="text-text-muted" />}
          {title}
        </h3>
        {linkHref && (
          <Link to={linkHref} className="text-xs font-medium text-primary-600 no-underline hover:underline flex items-center gap-1">
            {linkText} <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ icon, text, linkHref, linkText }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <NavIcon paths={icon} size={32} className="text-text-faint mb-3" />
      <p className="text-sm text-text-muted mb-2">{text}</p>
      {linkHref && <Link to={linkHref} className="text-sm text-primary-600 no-underline hover:underline">{linkText} &rarr;</Link>}
    </div>
  );
}

// ============================================================
// DATA FETCHING
// ============================================================
function getCached(key, ttl) {
  if (typeof window === "undefined") return null;
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < ttl) return parsed.data;
    }
  } catch {}
  return null;
}

function setCache(key, data) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
}

async function loadUserName(setName) {
  if (typeof window === "undefined") return;
  await new Promise((r) => setTimeout(r, 500));
  try {
    if (typeof window.getCachedOutsetaUser === "function") {
      const user = await window.getCachedOutsetaUser();
      if (user?.FirstName) setName(user.FirstName);
      else if (user?.FullName) setName(user.FullName.split(" ")[0]);
    }
  } catch {}
}

async function loadRates(setRates) {
  const cached = getCached("dash_mnd_rates", CACHE_TTL.rates);
  if (cached) { setRates(cached); return; }
  try {
    const res = await fetch(`${API_BASE}/api/rates`);
    if (!res.ok) return;
    const result = await res.json();
    if (result.success && result.data) {
      setCache("dash_mnd_rates", result.data);
      setRates(result.data);
    }
  } catch {}
}

async function loadLenderCount(setCount) {
  const cached = getCached("dash_lender_count", CACHE_TTL.lenders);
  if (cached) { setCount(cached); return; }
  try {
    const res = await fetch(LENDERS_API);
    if (!res.ok) return;
    const data = await res.json();
    const count = data.count ?? (Array.isArray(data) ? data.length : Array.isArray(data.lenders) ? data.lenders.length : 0);
    setCache("dash_lender_count", count);
    setCount(count);
  } catch {}
}

async function loadPipelineData(email, token, setStats, setLeads, setClosings) {
  if (!email) return;
  const cached = getCached(`dash_pipeline_${email}`, CACHE_TTL.pipeline);
  if (cached) {
    setStats(cached.stats);
    setLeads(cached.leads);
    if (cached.closings) setClosings(cached.closings);
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/api/pipeline/loans`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (!res.ok) return;
    const rawData = await res.json();
    const loans = Array.isArray(rawData) ? rawData.map((r) => ({ id: r.id, ...r.fields })) : [];

    const activeLoans = loans.filter(isActiveLoan);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const in14Days = new Date(now.getTime() + 14 * 86400000);

    const stats = {
      loans: activeLoans.length,
      volume: activeLoans.reduce((sum, l) => sum + (parseFloat(l["Loan Amount"]) || 0), 0),
      closings: activeLoans.filter((l) => {
        const d = parseLocalDate(l["Expected Close"]);
        return d && d >= now && d <= in14Days;
      }).length,
    };

    const leadLoans = loans.filter(isLeadLoan).map((l) => ({
      borrower: l["Borrower Name"] || "Unknown",
      type: l["Loan Type"] || "",
      amount: l["Loan Amount"] ? formatCurrency(l["Loan Amount"]) : "",
    }));

    const closingsList = activeLoans
      .filter((l) => l["Expected Close"] && parseLocalDate(l["Expected Close"]) >= now)
      .map((l) => {
        const d = parseLocalDate(l["Expected Close"]);
        return {
          date: l["Expected Close"],
          dateStr: d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "",
          borrower: l["Borrower Name"] || "Unknown",
          amount: l["Loan Amount"] ? formatCurrency(l["Loan Amount"]) : "",
        };
      })
      .filter((c) => c.dateStr)
      .sort((a, b) => (parseLocalDate(a.date) || 0) - (parseLocalDate(b.date) || 0));

    setCache(`dash_pipeline_${email}`, { stats, leads: leadLoans, closings: closingsList });
    setStats(stats);
    setLeads(leadLoans);
    setClosings(closingsList);
  } catch {}
}

async function loadTasks(email, token, setTasks) {
  if (!email || !token) return;
  try {
    const res = await fetch(`${PIPELINE_API}/api/pipeline/tasks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const records = await res.json();
    const pending = (Array.isArray(records) ? records : [])
      .filter((r) => !r.fields.Completed)
      .sort((a, b) => {
        const da = a.fields["Due Date"] || "";
        const db = b.fields["Due Date"] || "";
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da.localeCompare(db);
      });

    setTasks(
      pending.slice(0, 8).map((r) => {
        const name = r.fields["Task Name"] || "Untitled task";
        const dueDate = r.fields["Due Date"];
        const loanIds = r.fields.Loan || [];
        const loanId = loanIds[0] || "";

        let dueMeta = "";
        if (dueDate) {
          const d = parseLocalDate(dueDate);
          if (d) {
            const now = new Date(); now.setHours(0, 0, 0, 0);
            const diff = Math.round((d - now) / 86400000);
            if (diff < 0) dueMeta = "Overdue";
            else if (diff === 0) dueMeta = "Due today";
            else if (diff === 1) dueMeta = "Due tomorrow";
            else dueMeta = `Due ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
          }
        }

        return {
          name,
          dueMeta,
          meta: dueMeta || "",
          link: loanId ? `/app/pipeline?openLoan=${loanId}` : "/app/pipeline",
        };
      })
    );
  } catch {}
}

// ============================================================
// UTILITIES
// ============================================================
function isActiveLoan(loan) {
  const dealStatus = loan["Deal Status"] || "";
  const stage = loan.Stage || "";
  if (dealStatus === "Won" || dealStatus === "Lost") return false;
  if (stage.includes("12") || stage.toLowerCase().includes("closed")) return false;
  return true;
}

function isLeadLoan(loan) {
  const dealStatus = loan["Deal Status"] || "";
  if (dealStatus === "Won" || dealStatus === "Lost") return false;
  const stage = loan.Stage || "";
  return stage.includes("01") || stage.toLowerCase().includes("lead");
}

function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  try {
    if (dateStr.includes("-")) {
      const parts = dateStr.split("T")[0].split("-");
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    if (dateStr.includes("/")) {
      const parts = dateStr.split("/");
      return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
    }
  } catch {}
  return null;
}

function formatCurrency(num) {
  const value = parseFloat(num);
  return isNaN(value) ? "" : "$" + value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
