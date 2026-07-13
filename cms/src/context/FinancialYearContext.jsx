// src/context/FinancialYearContext.jsx
// Global fiscal-year state. Fetches the caller's FY list once auth resolves,
// picks the FY containing today (or the newest ACTIVE window as a fallback)
// as the "active" FY, and lets any consumer override the selection.
//
// SUPERADMIN without a foundation in scope has no meaningful FY — the list
// stays empty and the sidebar selector hides itself. Per-page foundation
// filters (e.g. Dashboard) drive their own FY resolution server-side via
// stats.service, so this context intentionally does not track foundationId.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { ROLES } from "../constants/roles";
import { listFinancialYears } from "../features/financialYears/api";

const FinancialYearContext = createContext({
  years: [],
  activeYear: null,
  selectedYear: null,
  selectedYearId: "",
  setSelectedYearId: () => {},
  refresh: async () => {},
  loading: false,
});

// Pick the FY whose window contains `today`; if none matches (e.g. a gap
// between windows), fall back to the newest ACTIVE year, then the newest
// year of any status. Keeps the sidebar useful even in edge configs.
const pickActive = (years) => {
  if (!years.length) return null;
  const now = Date.now();
  const containing = years.find((y) => {
    const s = new Date(y.startDate).getTime();
    const e = new Date(y.endDate).getTime();
    return s <= now && now < e;
  });
  if (containing) return containing;
  const active = years.find((y) => y.status === "ACTIVE");
  return active ?? years[0];
};

export const FinancialYearProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [years, setYears] = useState([]);
  const [selectedYearId, setSelectedYearId] = useState("");
  const [loading, setLoading] = useState(false);

  // ADMIN/EMPLOYEE are always tenant-scoped so we can safely fetch on login.
  // SUPERADMIN has no default foundation, so the list stays empty until they
  // navigate into a foundation-scoped page that opts in explicitly (future).
  const canFetch =
    isAuthenticated &&
    (user?.role === ROLES.ADMIN || user?.role === ROLES.EMPLOYEE);

  const refresh = useCallback(async () => {
    if (!canFetch) {
      setYears([]);
      return;
    }
    setLoading(true);
    try {
      // Pull a generous page — a tenant will rarely have >20 FYs. Sorted
      // desc by startDate server-side so the newest window is index 0.
      const res = await listFinancialYears({ page: 1, pageSize: 50 });
      setYears(res?.items ?? []);
    } catch (err) {
      console.error("Load financial years error:", err);
      setYears([]);
    } finally {
      setLoading(false);
    }
  }, [canFetch]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activeYear = useMemo(() => pickActive(years), [years]);

  // Keep the user's explicit selection sticky across list refreshes; when it
  // becomes stale (FY deleted / no longer in list) or was never set, snap to
  // the auto-picked active year so downstream consumers always see a value.
  useEffect(() => {
    if (!years.length) {
      if (selectedYearId) setSelectedYearId("");
      return;
    }
    const stillPresent = years.some((y) => y.id === selectedYearId);
    if (!stillPresent) setSelectedYearId(activeYear?.id ?? "");
  }, [years, activeYear, selectedYearId]);

  const selectedYear = useMemo(
    () => years.find((y) => y.id === selectedYearId) ?? null,
    [years, selectedYearId]
  );

  const value = useMemo(
    () => ({
      years,
      activeYear,
      selectedYear,
      selectedYearId,
      setSelectedYearId,
      refresh,
      loading,
    }),
    [years, activeYear, selectedYear, selectedYearId, refresh, loading]
  );

  return (
    <FinancialYearContext.Provider value={value}>
      {children}
    </FinancialYearContext.Provider>
  );
};

export const useFinancialYear = () => useContext(FinancialYearContext);
