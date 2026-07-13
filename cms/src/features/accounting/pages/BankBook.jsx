// src/features/accounting/pages/BankBook.jsx
// Chronological ledger for bank accounts (BankAccount.accountNumber IS NOT
// NULL). Uses the same columns as the Cash Book so switching between the two
// screens feels seamless.

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardBody } from "../../../components/ui";
import { useFinancialYear } from "../../../context/FinancialYearContext";
import AccountingFilters from "../components/AccountingFilters";
import LedgerTable from "../components/LedgerTable";
import { listBankBook } from "../api";
import { formatAmount, formatDate, toIsoDate } from "../utils";

const initialFilters = {
  foundationId: "",
  financialYearId: "",
  bankAccountId: "",
  from: "",
  to: "",
};

const BankBook = () => {
  const { selectedYearId } = useFinancialYear();
  const [filters, setFilters] = useState(() => ({
    ...initialFilters,
    financialYearId: selectedYearId || "",
  }));
  const [page, setPage] = useState(1);
  const pageSize = 25;
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
      const res = await listBankBook(params);
      setData({
        items: res?.items ?? [],
        total: res?.total ?? 0,
        totalPages: res?.totalPages ?? 1,
        totalAmount: res?.totalAmount ?? 0,
      });
    } catch (err) {
      console.error("Bank book error:", err);
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
        key: "account",
        header: "Account",
        cell: (r) => r.bankAccount?.label || "—",
      },
      {
        key: "party",
        header: "Party / Purpose",
        cell: (r) =>
          r.donation?.donorName ||
          r.expense?.paidTo ||
          r.expense?.categoryName ||
          r.description ||
          "—",
      },
      {
        key: "reference",
        header: "Reference",
        cell: (r) =>
          r.donation?.utr ||
          r.donation?.chequeNumber ||
          r.expense?.referenceNo ||
          "—",
      },
      {
        key: "debit",
        header: "Debit",
        align: "right",
        cell: (r) =>
          r.type === "DEBIT" ? (
            <span className="tabular-nums text-rose-600 dark:text-rose-400">
              ₹{formatAmount(r.amount)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "credit",
        header: "Credit",
        align: "right",
        cell: (r) =>
          r.type === "CREDIT" ? (
            <span className="tabular-nums text-success">
              ₹{formatAmount(r.amount)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        key: "balance",
        header: "Balance",
        align: "right",
        cell: (r) => (
          <span className="tabular-nums font-semibold">
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
          <AccountingFilters
            value={filters}
            onChange={setFilters}
            bankAccountKind="bank"
          />
        </CardBody>
      </Card>

      <LedgerTable
        title="Bank Book"
        totalLabel="entries in window"
        totalAmount={data.totalAmount}
        totalAmountLabel="Movement"
        columns={columns}
        rows={data.items}
        isFetching={loading}
        page={page}
        totalPages={data.totalPages || 1}
        total={data.total}
        onPageChange={setPage}
        onRefresh={load}
        emptyTitle="No bank entries"
        emptyDescription="No bank-account transactions match the current filter window."
      />
    </>
  );
};

export default BankBook;
