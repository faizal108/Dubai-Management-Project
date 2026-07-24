// src/features/accounting/pages/AccountingDashboard.jsx
// Landing view for the Accounting workspace. Renders the FY-scoped income /
// expense / net tiles plus a cash-on-hand + bank-balance breakdown and a
// per-account balance table so the whole book can be scanned at a glance.

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  ScaleIcon,
  WalletIcon,
  CubeIcon,
} from "@heroicons/react/24/outline";

import { useAuth } from "../../../context/AuthContext";
import { useFinancialYear } from "../../../context/FinancialYearContext";
import { ROLES } from "../../../constants/roles";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Spinner,
} from "../../../components/ui";
import AccountingFilters from "../components/AccountingFilters";
import StatTile from "../components/StatTile";
import { getAccountingSummary } from "../api";
import { formatAmount } from "../utils";

const initialFilters = { foundationId: "", financialYearId: "" };

const AccountingDashboard = () => {
  const { user } = useAuth();
  const { selectedYearId } = useFinancialYear();
  const [filters, setFilters] = useState(() => ({
    ...initialFilters,
    financialYearId: selectedYearId || "",
  }));
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  // Keep the local FY in sync with the global picker until the user overrides
  // it via the filter dropdown. Once they pick a specific FY here we stop
  // following global changes so the workspace doesn't feel jumpy.
  useEffect(() => {
    setFilters((f) =>
      f.financialYearId ? f : { ...f, financialYearId: selectedYearId || "" }
    );
  }, [selectedYearId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params = {};
        if (filters.foundationId) params.foundationId = filters.foundationId;
        if (filters.financialYearId)
          params.financialYearId = filters.financialYearId;
        const res = await getAccountingSummary(params);
        if (!cancelled) setSummary(res?.summary ?? null);
      } catch (err) {
        console.error("Accounting summary error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filters.foundationId, filters.financialYearId]);

  const totals = summary?.totals ?? { income: 0, expense: 0, net: 0 };
  const cash = summary?.cash ?? { onHand: 0, accounts: [] };
  const bank = summary?.bank ?? { onHand: 0, accounts: [] };
  const otherIncome = summary?.otherIncome ?? { count: 0, estimatedValue: 0 };
  const fyLabel = summary?.financialYear?.label;

  const accountsCombined = useMemo(
    () => [...(cash.accounts || []), ...(bank.accounts || [])],
    [cash.accounts, bank.accounts]
  );

  return (
    <>
      <PageHeader
        title="Accounting"
        subtitle={
          fyLabel
            ? `Financial year ${fyLabel}`
            : "Financial overview and account balances"
        }
      />

      <Card className="mb-4">
        <CardBody>
          <AccountingFilters
            value={filters}
            onChange={setFilters}
            showBankAccount={false}
            showDateRange={false}
          />
        </CardBody>
      </Card>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatTile
          title="Total Income"
          value={totals.income}
          icon={ArrowTrendingUpIcon}
          tone="success"
          isCurrency
          hint={`${totals.incomeCount ?? 0} credit entries`}
        />
        <StatTile
          title="Total Expense"
          value={totals.expense}
          icon={ArrowTrendingDownIcon}
          tone="danger"
          isCurrency
          hint={`${totals.expenseCount ?? 0} debit entries`}
        />
        <StatTile
          title="Net"
          value={totals.net}
          icon={ScaleIcon}
          tone={totals.net >= 0 ? "success" : "danger"}
          isCurrency
          hint="Income − Expense"
        />
        <StatTile
          title="Cash + Bank"
          value={(cash.onHand || 0) + (bank.onHand || 0)}
          icon={BanknotesIcon}
          tone="info"
          isCurrency
          hint="Balance across all accounts"
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatTile
          title="Cash on Hand"
          value={cash.onHand}
          icon={WalletIcon}
          tone="warning"
          isCurrency
          hint={`${cash.accounts?.length ?? 0} cash accounts`}
        />
        <StatTile
          title="Bank Balance"
          value={bank.onHand}
          icon={BuildingLibraryIcon}
          tone="primary"
          isCurrency
          hint={`${bank.accounts?.length ?? 0} bank accounts`}
        />
        <StatTile
          title="Other Income (in-kind)"
          value={otherIncome.estimatedValue}
          icon={CubeIcon}
          tone="info"
          isCurrency
          hint={`${otherIncome.count} receipt(s) · est. value, not cash`}
        />
      </div>

      <Card className="relative">
        <CardHeader>
          <CardTitle>Account balances</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="relative overflow-x-auto">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                <Spinner />
              </div>
            )}
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Account</th>
                  <th className="px-4 py-2.5 font-medium">Kind</th>
                  <th className="px-4 py-2.5 font-medium">Bank</th>
                  <th className="px-4 py-2.5 font-medium">Account No.</th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    Opening
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    Current
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {!loading && accountsCombined.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center">
                      <EmptyState
                        icon={BanknotesIcon}
                        title="No bank accounts"
                        description="Add a bank or cash account under Administration → Bank Accounts to see balances here."
                      />
                    </td>
                  </tr>
                )}
                {accountsCombined.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/40">
                    <td className="px-4 py-2.5 font-medium">
                      {a.label}
                      {a.isDefault ? (
                        <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          Default
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 capitalize">{a.kind}</td>
                    <td className="px-4 py-2.5">{a.bankName || "—"}</td>
                    <td className="px-4 py-2.5">{a.accountNumber || "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      ₹{formatAmount(a.openingBalance)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                      ₹{formatAmount(a.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </>
  );
};

export default AccountingDashboard;
