// src/features/accounting/pages/IncomeLedger.jsx
// Credit-only view over the shared Transaction ledger, on the shared DataTable.
// Sortable date / amount / balance columns + a description column filter drive
// the server; account / FY / date-window filters live in AccountingFilters.

import React, { useEffect, useMemo, useState } from "react";
import { BanknotesIcon } from "@heroicons/react/24/outline";
import { Card, CardBody, DataTable } from "../../../components/ui";
import { useFinancialYear } from "../../../context/FinancialYearContext";
import AccountingFilters from "../components/AccountingFilters";
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
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState({ by: null, dir: null });
  const [colFilters, setColFilters] = useState({});
  const [data, setData] = useState({ items: [], total: 0, totalAmount: 0 });
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
      if (filters.financialYearId) params.financialYearId = filters.financialYearId;
      if (filters.bankAccountId) params.bankAccountId = filters.bankAccountId;
      const from = toIsoDate(filters.from);
      const to = toIsoDate(filters.to);
      if (from) params.from = from;
      if (to) params.to = to;
      if (sort.by) {
        params.sortBy = sort.by;
        params.sortDir = sort.dir;
      }
      Object.assign(params, colFilters);
      const res = await listIncomeLedger(params);
      setData({
        items: res?.items ?? [],
        total: res?.total ?? 0,
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
    page, pageSize, sort, colFilters,
    filters.foundationId, filters.financialYearId, filters.bankAccountId, filters.from, filters.to,
  ]);

  useEffect(() => {
    setPage(1);
  }, [
    sort, colFilters, pageSize,
    filters.foundationId, filters.financialYearId, filters.bankAccountId, filters.from, filters.to,
  ]);

  const columns = useMemo(
    () => [
      { key: "date", header: "Date", sortable: true, sortField: "occurredAt", cell: (r) => formatDate(r.occurredAt) },
      { key: "donor", header: "Donor", cell: (r) => r.donation?.donorName || "—" },
      { key: "phone", header: "Phone", cell: (r) => r.donation?.donorPhone || "—" },
      { key: "account", header: "Account", cell: (r) => r.bankAccount?.label || "—" },
      { key: "category", header: "Category", cell: (r) => r.donation?.category || "—" },
      {
        key: "reference",
        header: "Reference",
        filter: { type: "text", param: "description", placeholder: "Search…" },
        cell: (r) => r.donation?.utr || r.donation?.chequeNumber || r.description || "—",
      },
      {
        key: "amount",
        header: "Amount",
        align: "right",
        sortable: true,
        cell: (r) => (
          <span className="tabular-nums font-semibold text-success">₹{formatAmount(r.amount)}</span>
        ),
      },
      {
        key: "balance",
        header: "Balance",
        align: "right",
        sortable: true,
        sortField: "balanceAfter",
        cell: (r) => (
          <span className="tabular-nums text-muted-foreground">₹{formatAmount(r.balanceAfter)}</span>
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

      <Card>
        <CardBody>
          <div className="mb-3 flex flex-wrap items-baseline gap-3">
            <h2 className="text-base font-semibold text-foreground">Income Ledger</h2>
            <span className="text-sm text-muted-foreground">
              Income:{" "}
              <span className="font-semibold tabular-nums text-foreground">
                ₹{formatAmount(data.totalAmount)}
              </span>{" "}
              <span className="text-xs">· credit entries in window</span>
            </span>
          </div>
          <DataTable
            columns={columns}
            rows={data.items}
            total={data.total}
            loading={loading}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            sort={sort}
            onSortChange={setSort}
            columnFilters={colFilters}
            onColumnFiltersChange={setColFilters}
            enableGlobalSearch={false}
            emptyIcon={BanknotesIcon}
            emptyTitle="No income entries"
            emptyDescription="No CREDIT transactions match the current filter window."
          />
        </CardBody>
      </Card>
    </>
  );
};

export default IncomeLedger;
