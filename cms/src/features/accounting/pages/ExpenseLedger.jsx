// src/features/accounting/pages/ExpenseLedger.jsx
// Debit-only view over the Transaction ledger. Surfaces the expense payee /
// category / activity join alongside the amount and the balance-after so
// disbursements can be reviewed end-to-end here.

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardBody } from "../../../components/ui";
import { useFinancialYear } from "../../../context/FinancialYearContext";
import AccountingFilters from "../components/AccountingFilters";
import LedgerTable from "../components/LedgerTable";
import { listExpenseLedger } from "../api";
import { formatAmount, formatDate, toIsoDate } from "../utils";

const initialFilters = {
  foundationId: "",
  financialYearId: "",
  bankAccountId: "",
  from: "",
  to: "",
};

const ExpenseLedger = () => {
  const { selectedYearId } = useFinancialYear();
  const [filters, setFilters] = useState(() => ({
    ...initialFilters,
    financialYearId: selectedYearId || "",
  }));
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [data, setData] = useState({
    items: [],
    total: 0,
    totalPages: 1,
    totalAmount: 0,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFilters((f) =>
      f.financialYearId ? f : { ...f, financialYearId: selectedYearId || "" }
    );
  }, [selectedYearId]);

  const load = async () => {
    setLoading(true);
    try {
      const params = { page, pageSize };
      if (filters.foundationId) params.foundationId = filters.foundationId;
      if (filters.financialYearId)
        params.financialYearId = filters.financialYearId;
      if (filters.bankAccountId) params.bankAccountId = filters.bankAccountId;
      const from = toIsoDate(filters.from);
      const to = toIsoDate(filters.to);
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await listExpenseLedger(params);
      setData({
        items: res?.items ?? [],
        total: res?.total ?? 0,
        totalPages: res?.totalPages ?? 1,
        totalAmount: res?.totalAmount ?? 0,
      });
    } catch (err) {
      console.error("Expense ledger error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    page,
    filters.foundationId,
    filters.financialYearId,
    filters.bankAccountId,
    filters.from,
    filters.to,
  ]);

  useEffect(() => {
    setPage(1);
  }, [
    filters.foundationId,
    filters.financialYearId,
    filters.bankAccountId,
    filters.from,
    filters.to,
  ]);

  const columns = useMemo(
    () => [
      { key: "date", header: "Date", cell: (r) => formatDate(r.occurredAt) },
      {
        key: "paidTo",
        header: "Paid To",
        cell: (r) => r.expense?.paidTo || "—",
      },
      {
        key: "category",
        header: "Category",
        cell: (r) => r.expense?.categoryName || "—",
      },
      {
        key: "activity",
        header: "Activity",
        cell: (r) => r.expense?.activityTitle || "—",
      },
      {
        key: "account",
        header: "Account",
        cell: (r) => r.bankAccount?.label || "—",
      },
      {
        key: "reference",
        header: "Reference",
        cell: (r) => r.expense?.referenceNo || r.description || "—",
      },
      {
        key: "amount",
        header: "Amount",
        align: "right",
        cell: (r) => (
          <span className="tabular-nums font-semibold text-rose-600 dark:text-rose-400">
            ₹{formatAmount(r.amount)}
          </span>
        ),
      },
      {
        key: "balance",
        header: "Balance",
        align: "right",
        cell: (r) => (
          <span className="tabular-nums text-muted-foreground">
            ₹{formatAmount(r.balanceAfter)}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <>
      <Card className="mb-4">
        <CardBody>
          <AccountingFilters value={filters} onChange={setFilters} />
        </CardBody>
      </Card>

      <LedgerTable
        title="Expense Ledger"
        totalLabel="debit entries in window"
        totalAmount={data.totalAmount}
        totalAmountLabel="Expense"
        columns={columns}
        rows={data.items}
        isFetching={loading}
        page={page}
        totalPages={data.totalPages || 1}
        total={data.total}
        onPageChange={setPage}
        onRefresh={load}
        emptyTitle="No expense entries"
        emptyDescription="No DEBIT transactions match the current filter window."
      />
    </>
  );
};

export default ExpenseLedger;
