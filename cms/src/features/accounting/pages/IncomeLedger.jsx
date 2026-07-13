// src/features/accounting/pages/IncomeLedger.jsx
// Credit-only view over the shared Transaction ledger. Each row surfaces the
// donor snapshot and reference (UTR / cheque) alongside the amount and the
// balance-after so the accountant can reconcile receipts without leaving the
// screen.

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardBody } from "../../../components/ui";
import { useFinancialYear } from "../../../context/FinancialYearContext";
import AccountingFilters from "../components/AccountingFilters";
import LedgerTable from "../components/LedgerTable";
import { listIncomeLedger } from "../api";
import { formatAmount, formatDate, toIsoDate } from "../utils";

const initialFilters = {
  foundationId: "",
  financialYearId: "",
  bankAccountId: "",
  from: "",
  to: "",
};

const IncomeLedger = () => {
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
      const res = await listIncomeLedger(params);
      setData({
        items: res?.items ?? [],
        total: res?.total ?? 0,
        totalPages: res?.totalPages ?? 1,
        totalAmount: res?.totalAmount ?? 0,
      });
    } catch (err) {
      console.error("Income ledger error:", err);
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

  // Reset to page 1 whenever the filter changes to avoid landing on an empty
  // page after narrowing the window.
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
      {
        key: "date",
        header: "Date",
        cell: (r) => formatDate(r.occurredAt),
      },
      {
        key: "donor",
        header: "Donor",
        cell: (r) => r.donation?.donorName || "—",
      },
      {
        key: "phone",
        header: "Phone",
        cell: (r) => r.donation?.donorPhone || "—",
      },
      {
        key: "account",
        header: "Account",
        cell: (r) => r.bankAccount?.label || "—",
      },
      {
        key: "category",
        header: "Category",
        cell: (r) => r.donation?.category || "—",
      },
      {
        key: "reference",
        header: "Reference",
        cell: (r) =>
          r.donation?.utr || r.donation?.chequeNumber || r.description || "—",
      },
      {
        key: "amount",
        header: "Amount",
        align: "right",
        cell: (r) => (
          <span className="tabular-nums font-semibold text-success">
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
        title="Income Ledger"
        totalLabel="credit entries in window"
        totalAmount={data.totalAmount}
        totalAmountLabel="Income"
        columns={columns}
        rows={data.items}
        isFetching={loading}
        page={page}
        totalPages={data.totalPages || 1}
        total={data.total}
        onPageChange={setPage}
        onRefresh={load}
        emptyTitle="No income entries"
        emptyDescription="No CREDIT transactions match the current filter window."
      />
    </>
  );
};

export default IncomeLedger;
