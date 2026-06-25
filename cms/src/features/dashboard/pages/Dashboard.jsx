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
} from "@heroicons/react/24/outline";

import { useAuth } from "../../../context/AuthContext";
import { ROLES } from "../../../constants/roles";
import { listFoundations } from "../../foundations/api";
import {
  getSummary,
  getTrends,
  getTopDonors,
  getRecentDonations,
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

const StatCard = ({ title, value, icon: Icon, tone = "primary", isCurrency }) => {
  const tones = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
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
            {isCurrency ? "₹" : ""}
            {formatCompact(value)}
          </p>
        </div>
      </CardBody>
    </Card>
  );
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

  // SUPERADMIN-only filter state. ADMIN ignores foundationId server-side.
  const [foundations, setFoundations] = useState([]);
  const [foundationId, setFoundationId] = useState("");
  const [range, setRange] = useState("6m");

  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState(null);
  const [topDonors, setTopDonors] = useState([]);
  const [recent, setRecent] = useState([]);
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

  // Refetch all four datasets whenever the foundation/range filter changes.
  useEffect(() => {
    let cancelled = false;
    const params = foundationId ? { foundationId } : {};
    setLoading(true);
    (async () => {
      try {
        const [s, t, td, rd] = await Promise.all([
          getSummary(params),
          getTrends({ ...params, range }),
          getTopDonors({ ...params, limit: 5 }),
          getRecentDonations({ ...params, limit: 5 }),
        ]);
        if (cancelled) return;
        setSummary(s?.summary ?? null);
        setTrends(t?.trends ?? null);
        setTopDonors(td?.topDonors ?? []);
        setRecent(rd?.recentDonations ?? []);
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
  }, [foundationId, range]);

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
          tension: 0.3,
        },
        {
          label: "Donors",
          data: trends.monthly.map((m) => m.donorCount),
          fill: false,
          borderColor: "#f59e0b",
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

  const cards = useMemo(() => {
    const s = summary ?? {};
    return [
      {
        title: "Total Donations",
        value: s.totalAmount ?? 0,
        icon: CurrencyRupeeIcon,
        tone: "primary",
        isCurrency: true,
      },
      {
        title: "Total Donors",
        value: s.donorCount ?? 0,
        icon: UsersIcon,
        tone: "success",
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

        {/* Stat cards */}
        <div className="grid grid-cols-1 items-stretch gap-6 sm:grid-cols-3">
          {cards.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2">
          <DashboardSection title="Donation Trends (Monthly)">
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
