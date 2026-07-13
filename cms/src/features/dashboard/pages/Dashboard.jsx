// src/features/dashboard/pages/Dashboard.jsx
// Real-data dashboard. ADMIN sees their own foundation; SUPERADMIN defaults to
// platform-wide aggregates with an optional foundation picker.

import React, { useState, useEffect, useMemo } from "react";
import { Line, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import {
  CurrencyRupeeIcon,
  UsersIcon,
  ClockIcon,
  BuildingOffice2Icon,
  BanknotesIcon,
  ScaleIcon,
  CalendarDaysIcon,
  PrinterIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";

import { useAuth } from "../../../context/AuthContext";
import { useFinancialYear } from "../../../context/FinancialYearContext";
import { ROLES } from "../../../constants/roles";
import { listFoundations } from "../../foundations/api";
import {
  getSummary,
  getTrends,
  getTopDonors,
  getRecentDonations,
  getPendingDonations,
} from "../api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  PageHeader,
  Select,
  Spinner,
  EmptyState,
} from "../../../components/ui";

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  ArcElement,
  Tooltip,
  Legend
);

// Matches SearchDonation.jsx for consistent currency display across the app.
const formatAmount = (amount) => {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
};

// Compact display for stat cards (Cr / L / K / raw). Uses Indian numbering.
const formatCompact = (value) => {
  const n = Number(value) || 0;
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(2)} Cr`;
  if (n >= 100_000) return `${(n / 100_000).toFixed(2)} L`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)} K`;
  return String(n);
};

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const labelForMonth = (key) => {
  const [y, m] = String(key).split("-");
  return `${MONTH_SHORT[parseInt(m, 10) - 1] ?? m} ${y?.slice(2) ?? ""}`;
};

const TYPE_LABEL = { CASH: "Cash", CHEQUE: "Cheque", ONLINE: "Online" };
const TYPE_COLOR = { CASH: "#10b981", CHEQUE: "#f59e0b", ONLINE: "#3b82f6" };

// Rotating palette for the expense-by-category chart. Categories are dynamic
// so we can't map by key like TYPE_COLOR; index into this instead.
const EXPENSE_PALETTE = [
  "#ef4444", "#f97316", "#eab308", "#84cc16", "#14b8a6",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b",
];

// Fixed palette for the donor tier mix pie. Tier 1 (PAN-linked, 80G-eligible)
// reads as the strongest signal, Tier 2 (phone-only) as intermediate, Tier 3
// (anonymous) as the residual bucket.
const TIER_LABEL = {
  tier1: "Tier 1 (PAN)",
  tier2: "Tier 2 (Phone)",
  tier3: "Tier 3 (Anonymous)",
};
const TIER_COLOR = {
  tier1: "#10b981",
  tier2: "#3b82f6",
  tier3: "#94a3b8",
};

const StatCard = ({
  title,
  value,
  icon: Icon,
  tone = "primary",
  isCurrency,
  // When set, replaces the compact number with a pre-formatted string (used
  // by the "Printed %", "WhatsApp %" tiles which are already stringified).
  displayValue,
  // Optional secondary caption under the primary value — used for tiles that
  // want to surface both a rate and its raw count (e.g. "12 of 30 sent").
  hint,
}) => {
  const tones = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    info: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  };
  return (
    <Card className="h-full">
      <CardBody className="flex items-center gap-4">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}
        >
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </p>
          <p className="mt-1 truncate text-2xl font-semibold tracking-tight text-foreground">
            {displayValue ?? `${isCurrency ? "₹" : ""}${formatCompact(value)}`}
          </p>
          {hint ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {hint}
            </p>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
};

// Renders a percentage with a graceful "—" when the denominator is zero, so
// the fulfillment tiles don't misleadingly show 0 % on empty datasets.
const formatRate = (num, denom) => {
  const n = Number(num) || 0;
  const d = Number(denom) || 0;
  if (d === 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
};

const DashboardSection = ({ title, children }) => (
  <Card className="flex h-full flex-col">
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardBody className="flex-1 overflow-auto">{children}</CardBody>
  </Card>
);

const Loading = () => (
  <div className="flex h-full items-center justify-center py-8 text-sm text-muted-foreground">
    <Spinner size="sm" className="mr-2" />
    Loading…
  </div>
);

const Empty = ({ text }) => (
  <div className="flex h-full items-center justify-center py-8 text-sm text-muted-foreground">
    {text}
  </div>
);

const Dashboard = () => {
  const { user } = useAuth();
  const isSuper = user?.role === ROLES.SUPERADMIN;

  // Sticky FY selection — drives the FYTD tiles and the "Year to date" range.
  // SUPERADMIN without a scoped foundation will simply pass an empty id and
  // let stats.service resolve the active FY per-foundation (or platform-wide).
  const { selectedYearId } = useFinancialYear();

  // SUPERADMIN-only filter state. ADMIN ignores foundationId server-side.
  const [foundations, setFoundations] = useState([]);
  const [foundationId, setFoundationId] = useState("");
  const [range, setRange] = useState("6m");

  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState(null);
  const [topDonors, setTopDonors] = useState([]);
  const [recent, setRecent] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load foundations once for the SUPERADMIN picker. ADMIN never sees this.
  useEffect(() => {
    if (!isSuper) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await listFoundations({ page: 1, pageSize: 100 });
        if (!cancelled) setFoundations(res?.items ?? []);
      } catch (err) {
        console.error("Load foundations error:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSuper]);

  // Refetch all datasets whenever the foundation/range/FY filter changes.
  useEffect(() => {
    let cancelled = false;
    const params = {};
    if (foundationId) params.foundationId = foundationId;
    if (selectedYearId) params.financialYearId = selectedYearId;
    setLoading(true);
    (async () => {
      try {
        const [s, t, td, rd, pd] = await Promise.all([
          getSummary(params),
          getTrends({ ...params, range }),
          getTopDonors({ ...params, limit: 5 }),
          getRecentDonations({ ...params, limit: 5 }),
          getPendingDonations({ ...params, limit: 5 }),
        ]);
        if (cancelled) return;
        setSummary(s?.summary ?? null);
        setTrends(t?.trends ?? null);
        setTopDonors(td?.topDonors ?? []);
        setRecent(rd?.recentDonations ?? []);
        setPending(pd?.pendingDonations ?? []);
      } catch (err) {
        // api.js interceptor already toasts; log for debugging.
        console.error("Dashboard load error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [foundationId, range, selectedYearId]);

  const trendChart = useMemo(() => {
    if (!trends?.monthly?.length) return null;
    return {
      labels: trends.monthly.map((m) => labelForMonth(m.month)),
      datasets: [
        {
          label: "Donations (₹)",
          data: trends.monthly.map((m) => m.amount),
          fill: false,
          borderColor: "#3b82f6",
          backgroundColor: "#3b82f6",
          tension: 0.3,
        },
        {
          label: "Expenses (₹)",
          data: trends.monthly.map((m) => m.expenseAmount ?? 0),
          fill: false,
          borderColor: "#ef4444",
          backgroundColor: "#ef4444",
          tension: 0.3,
        },
        {
          label: "Donors",
          data: trends.monthly.map((m) => m.donorCount),
          fill: false,
          borderColor: "#f59e0b",
          backgroundColor: "#f59e0b",
          tension: 0.3,
        },
      ],
    };
  }, [trends]);

  const pieChart = useMemo(() => {
    const items = (trends?.byType ?? []).filter((i) => Number(i.amount) > 0);
    if (!items.length) return null;
    return {
      labels: items.map((i) => TYPE_LABEL[i.type] ?? i.type),
      datasets: [
        {
          data: items.map((i) => i.amount),
          backgroundColor: items.map((i) => TYPE_COLOR[i.type] ?? "#94a3b8"),
          hoverOffset: 4,
        },
      ],
    };
  }, [trends]);

  // Expense-by-category pie. Categories are dynamic so colors are assigned by
  // position in EXPENSE_PALETTE (wraps if categories exceed the palette).
  const expenseCategoryChart = useMemo(() => {
    const items = (trends?.byCategory ?? []).filter((i) => Number(i.amount) > 0);
    if (!items.length) return null;
    return {
      labels: items.map((i) => i.categoryName ?? "Unknown"),
      datasets: [
        {
          data: items.map((i) => i.amount),
          backgroundColor: items.map(
            (_, idx) => EXPENSE_PALETTE[idx % EXPENSE_PALETTE.length]
          ),
          hoverOffset: 4,
        },
      ],
    };
  }, [trends]);

  // Donor tier mix pie. Driven by counts (not amounts) so a single large PAN
  // donation doesn't visually swamp a long tail of phone-only donors. Amounts
  // are still surfaced in the tooltip via the ranked list below the chart.
  const tierMixChart = useMemo(() => {
    const mix = summary?.donorTierMix;
    if (!mix) return null;
    const keys = ["tier1", "tier2", "tier3"];
    const counts = keys.map((k) => Number(mix[k]?.count ?? 0));
    if (counts.reduce((a, b) => a + b, 0) === 0) return null;
    return {
      labels: keys.map((k) => TIER_LABEL[k]),
      datasets: [
        {
          data: counts,
          backgroundColor: keys.map((k) => TIER_COLOR[k]),
          hoverOffset: 4,
        },
      ],
    };
  }, [summary]);

  const cards = useMemo(() => {
    const s = summary ?? {};
    const netBalance = Number(s.netBalance ?? 0);
    return [
      {
        title: "Total Donations",
        value: s.totalAmount ?? 0,
        icon: CurrencyRupeeIcon,
        tone: "primary",
        isCurrency: true,
      },
      {
        title: "Total Expenses",
        value: s.totalExpense ?? 0,
        icon: BanknotesIcon,
        tone: "danger",
        isCurrency: true,
      },
      {
        title: "Net Balance",
        value: netBalance,
        icon: ScaleIcon,
        // Green when the foundation is net-positive; red once expenses
        // exceed received donations — reads as a quick health indicator.
        tone: netBalance >= 0 ? "success" : "danger",
        isCurrency: true,
      },
      {
        title: "Total Donors",
        value: s.donorCount ?? 0,
        icon: UsersIcon,
        tone: "info",
      },
      {
        title: "Pending Amount",
        value: s.pendingAmount ?? 0,
        icon: ClockIcon,
        tone: "warning",
        isCurrency: true,
      },
    ];
  }, [summary]);

  // Secondary KPI strip — FY-to-date momentum plus operational fulfillment
  // rates (receipts printed, WhatsApp receipts delivered). Denominators guard
  // against divide-by-zero via formatRate's "—" fallback. The FY label comes
  // from summary.financialYear so the tile clearly identifies the window in
  // play even when the sidebar selector isn't visible (e.g. SUPERADMIN).
  const secondaryCards = useMemo(() => {
    const s = summary ?? {};
    const receivedCount = Number(s.receivedCount ?? 0);
    const pendingCount = Number(s.pendingCount ?? 0);
    const donationCount = receivedCount + pendingCount;
    const printedCount = Number(s.printedCount ?? 0);
    const whatsappOptIn = Number(s.whatsappOptInCount ?? 0);
    const whatsappSent = Number(s.whatsappSentCount ?? 0);
    const fyLabel = s.financialYear?.label ? ` · ${s.financialYear.label}` : "";
    return [
      {
        title: `FYTD Donations${fyLabel}`,
        value: s.fytdAmount ?? 0,
        icon: CalendarDaysIcon,
        tone: "primary",
        isCurrency: true,
        hint: `${s.fytdCount ?? 0} donation${
          (s.fytdCount ?? 0) === 1 ? "" : "s"
        }`,
      },
      {
        title: `FYTD Expenses${fyLabel}`,
        value: s.fytdExpense ?? 0,
        icon: CalendarDaysIcon,
        tone: "danger",
        isCurrency: true,
        hint: `${s.fytdExpenseCount ?? 0} entr${
          (s.fytdExpenseCount ?? 0) === 1 ? "y" : "ies"
        }`,
      },
      {
        title: "Receipts Printed",
        displayValue: formatRate(printedCount, donationCount),
        icon: PrinterIcon,
        tone: "info",
        hint: `${printedCount} of ${donationCount}`,
      },
      {
        title: "WhatsApp Delivered",
        displayValue: formatRate(whatsappSent, whatsappOptIn),
        icon: ChatBubbleLeftRightIcon,
        tone: "success",
        hint:
          whatsappOptIn === 0
            ? "No opt-ins yet"
            : `${whatsappSent} of ${whatsappOptIn} opt-ins`,
      },
    ];
  }, [summary]);

  const rangeOptions = [
    { value: "6m", label: "Last 6 months" },
    { value: "12m", label: "Last 12 months" },
    { value: "ytd", label: "Year to date" },
  ];
  const foundationOptions = [
    { value: "", label: "All foundations" },
    ...foundations.map((f) => ({ value: f.id, label: f.name })),
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={
          isSuper
            ? "Platform-wide overview across all foundations."
            : "Overview of your foundation's activity."
        }
      />

      <div className="space-y-6">
        {/* Filter bar: foundation picker (SUPERADMIN only) + range. */}
        <Card>
          <CardBody className="flex flex-wrap items-end gap-4">
            {isSuper && (
              <div className="flex min-w-[14rem] flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Foundation
                </label>
                <Select
                  value={foundationId}
                  onChange={setFoundationId}
                  options={foundationOptions}
                />
              </div>
            )}
            <div className="flex min-w-[12rem] flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Range
              </label>
              <Select value={range} onChange={setRange} options={rangeOptions} />
            </div>
            {isSuper && !foundationId && summary?.foundationCount != null && (
              <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                <BuildingOffice2Icon className="h-5 w-5" />
                {summary.foundationCount} active foundation
                {summary.foundationCount === 1 ? "" : "s"}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Primary stat cards — lifetime totals + pending balance. */}
        <div className="grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {cards.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </div>

        {/* Secondary KPI strip — month-to-date momentum + fulfillment rates.
            Kept as its own row so the header numbers stay a clean 5-across
            while this row scales to a 4-across on wide screens. */}
        <div className="grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {secondaryCards.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2">
          <DashboardSection title="Donations vs Expenses (Monthly)">
            <div className="h-64 md:h-80">
              {loading ? (
                <Loading />
              ) : trendChart ? (
                <Line
                  data={trendChart}
                  options={{ maintainAspectRatio: false }}
                />
              ) : (
                <Empty text="No donations in this range." />
              )}
            </div>
          </DashboardSection>

          <DashboardSection title="Donation Types Distribution">
            <div className="h-64 md:h-80">
              {loading ? (
                <Loading />
              ) : pieChart ? (
                <Pie data={pieChart} options={{ maintainAspectRatio: false }} />
              ) : (
                <Empty text="No donations in this range." />
              )}
            </div>
          </DashboardSection>
        </div>

        {/* Expense breakdown row: pie chart on the left, ranked list on the
            right so the two answer "which categories?" and "how much each?"
            side-by-side without a second data fetch. */}
        <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2">
          <DashboardSection title="Expenses by Category">
            <div className="h-64 md:h-80">
              {loading ? (
                <Loading />
              ) : expenseCategoryChart ? (
                <Pie
                  data={expenseCategoryChart}
                  options={{ maintainAspectRatio: false }}
                />
              ) : (
                <Empty text="No expenses in this range." />
              )}
            </div>
          </DashboardSection>

          <DashboardSection title="Top Expense Categories">
            {loading ? (
              <Loading />
            ) : !(trends?.byCategory ?? []).length ? (
              <EmptyState
                title="No expenses yet"
                description="Expense categories will appear here once expenses are recorded."
              />
            ) : (
              <ol className="divide-y divide-border text-sm">
                {[...trends.byCategory]
                  .sort((a, b) => Number(b.amount) - Number(a.amount))
                  .slice(0, 5)
                  .map((c, i) => (
                    <li
                      key={c.categoryId}
                      className="flex justify-between gap-2 py-2 text-foreground"
                    >
                      <span className="truncate">
                        <span
                          className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                          style={{
                            backgroundColor:
                              EXPENSE_PALETTE[i % EXPENSE_PALETTE.length],
                          }}
                        />
                        {c.categoryName ?? "Unknown"}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({c.count})
                        </span>
                      </span>
                      <span className="font-medium">
                        ₹{formatAmount(c.amount)}
                      </span>
                    </li>
                  ))}
              </ol>
            )}
          </DashboardSection>
        </div>

        {/* Donor tier mix + pending donations queue. Tier mix answers "who
            gives?" (PAN-linked vs phone-only vs anonymous); the pending list
            surfaces the oldest outstanding pledges so operators can chase
            them without leaving the dashboard. */}
        <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2">
          <DashboardSection title="Donor Tier Mix">
            <div className="h-64 md:h-80">
              {loading ? (
                <Loading />
              ) : tierMixChart ? (
                <Pie
                  data={tierMixChart}
                  options={{ maintainAspectRatio: false }}
                />
              ) : (
                <Empty text="No donations yet." />
              )}
            </div>
          </DashboardSection>

          <DashboardSection title="Pending Donations">
            {loading ? (
              <Loading />
            ) : pending.length === 0 ? (
              <EmptyState
                title="Nothing pending"
                description="Committed but uncollected donations will appear here."
              />
            ) : (
              <ul className="divide-y divide-border text-sm">
                {pending.map((d) => (
                  <li
                    key={d.id}
                    className="flex justify-between gap-2 py-2 text-foreground"
                  >
                    <span className="truncate">
                      {d.donorName}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({d.type})
                      </span>
                    </span>
                    <span className="font-medium">
                      ₹{formatAmount(d.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </DashboardSection>
        </div>

        {/* Recent + top donors */}
        <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2">
          <DashboardSection title="Recent Donations">
            {loading ? (
              <Loading />
            ) : recent.length === 0 ? (
              <EmptyState
                title="No recent donations"
                description="New donations will appear here as soon as they are recorded."
              />
            ) : (
              <ul className="divide-y divide-border text-sm">
                {recent.map((d) => (
                  <li
                    key={d.id}
                    className="flex justify-between gap-2 py-2 text-foreground"
                  >
                    <span className="truncate">
                      {d.donorName}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({d.type})
                      </span>
                    </span>
                    <span className="font-medium">
                      ₹{formatAmount(d.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </DashboardSection>

          <DashboardSection title="Top Donors">
            {loading ? (
              <Loading />
            ) : topDonors.length === 0 ? (
              <EmptyState
                title="No donors yet"
                description="Top donors will appear here once donations are recorded."
              />
            ) : (
              <ol className="divide-y divide-border text-sm">
                {topDonors.map((d, i) => (
                  <li
                    key={d.donorId}
                    className="flex justify-between gap-2 py-2 text-foreground"
                  >
                    <span className="truncate">
                      <span className="mr-2 text-xs font-semibold text-muted-foreground">
                        {i + 1}.
                      </span>
                      {d.fullName}
                    </span>
                    <span className="font-medium">
                      ₹{formatAmount(d.totalAmount)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </DashboardSection>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
