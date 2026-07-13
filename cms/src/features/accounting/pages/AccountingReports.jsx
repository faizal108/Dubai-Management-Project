// src/features/accounting/pages/AccountingReports.jsx
// Per-account opening / income / expense / closing statement over a chosen
// window. from/to override the FY resolution when set; otherwise the payload
// uses the resolved FY bounds. Aggregates roll up into a Grand Total row so
// the whole statement fits into a single card.

import React, { useEffect, useState } from "react";
import { PrinterIcon } from "@heroicons/react/24/outline";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Spinner,
} from "../../../components/ui";
import { BanknotesIcon } from "@heroicons/react/24/outline";
import { useFinancialYear } from "../../../context/FinancialYearContext";
import AccountingFilters from "../components/AccountingFilters";
import { getAccountingReport } from "../api";
import { formatAmount, formatDate, toIsoDate } from "../utils";

const initialFilters = {
  foundationId: "",
  financialYearId: "",
  from: "",
  to: "",
};

const AccountingReports = () => {
  const { selectedYearId } = useFinancialYear();
  const [filters, setFilters] = useState(() => ({
    ...initialFilters,
    financialYearId: selectedYearId || "",
  }));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

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
        const from = toIsoDate(filters.from);
        const to = toIsoDate(filters.to);
        if (from) params.from = from;
        if (to) params.to = to;
        const res = await getAccountingReport(params);
        if (!cancelled) setReport(res?.report ?? null);
      } catch (err) {
        console.error("Accounting report error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    filters.foundationId,
    filters.financialYearId,
    filters.from,
    filters.to,
  ]);

  const rows = report?.accounts ?? [];
  const totals = report?.totals;
  const windowStart = report?.window?.start;
  const windowEnd = report?.window?.end;
  const fyLabel = report?.financialYear?.label;

  return (
    <>
      <PageHeader
        title="Accounting Reports"
        subtitle={
          fyLabel
            ? `Financial year ${fyLabel}`
            : "Per-account opening / closing statement"
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            leftIcon={<PrinterIcon className="h-4 w-4" />}
            onClick={() => window.print()}
          >
            Print
          </Button>
        }
      />

      <Card className="mb-4">
        <CardBody>
          <AccountingFilters
            value={filters}
            onChange={setFilters}
            showBankAccount={false}
          />
        </CardBody>
      </Card>

      <Card className="relative">
        <CardHeader>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <CardTitle>Statement</CardTitle>
            {(windowStart || windowEnd) && (
              <span className="text-sm text-muted-foreground">
                {windowStart ? formatDate(windowStart) : "—"} →{" "}
                {windowEnd ? formatDate(windowEnd) : "—"}
              </span>
            )}
          </div>
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
                  <th className="px-4 py-2.5 text-right font-medium">Opening</th>
                  <th className="px-4 py-2.5 text-right font-medium">Income</th>
                  <th className="px-4 py-2.5 text-right font-medium">Expense</th>
                  <th className="px-4 py-2.5 text-right font-medium">Net</th>
                  <th className="px-4 py-2.5 text-right font-medium">Closing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center">
                      <EmptyState
                        icon={BanknotesIcon}
                        title="No accounts to report"
                        description="Add a bank or cash account under Administration → Bank Accounts to see statements here."
                      />
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.account.id} className="hover:bg-muted/40">
                    <td className="px-4 py-2.5 font-medium">
                      {r.account.label}
                    </td>
                    <td className="px-4 py-2.5 capitalize">{r.account.kind}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      ₹{formatAmount(r.opening)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-success">
                      ₹{formatAmount(r.income)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-rose-600 dark:text-rose-400">
                      ₹{formatAmount(r.expense)}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right tabular-nums ${
                        r.net >= 0
                          ? "text-success"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      ₹{formatAmount(r.net)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                      ₹{formatAmount(r.closing)}
                    </td>
                  </tr>
                ))}
                {totals && rows.length > 0 && (
                  <tr className="bg-muted/40 font-semibold">
                    <td className="px-4 py-2.5" colSpan={2}>
                      Grand Total
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      ₹{formatAmount(totals.opening)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-success">
                      ₹{formatAmount(totals.income)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-rose-600 dark:text-rose-400">
                      ₹{formatAmount(totals.expense)}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right tabular-nums ${
                        totals.net >= 0
                          ? "text-success"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      ₹{formatAmount(totals.net)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      ₹{formatAmount(totals.closing)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </>
  );
};

export default AccountingReports;
