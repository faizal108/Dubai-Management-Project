// src/features/accounting/pages/OtherIncomeLedger.jsx
// Read-only ledger of in-kind / non-cash receipts (Other Income). Unlike the
// income/expense ledgers this reads the OtherIncome register (not the money
// Transaction ledger) — these never affect cash balances. The header shows the
// count + total estimated value; estimated value is informational only.

import React, { useEffect, useMemo, useState } from "react";
import { CubeIcon } from "@heroicons/react/24/outline";
import { Card, CardBody, DataTable } from "../../../components/ui";
import { useFinancialYear } from "../../../context/FinancialYearContext";
import AccountingFilters from "../components/AccountingFilters";
import { listOtherIncome } from "../../otherIncome/api";
import { formatAmount, formatDate, toIsoDate } from "../utils";

const initialFilters = { foundationId: "", financialYearId: "", from: "", to: "" };

const OtherIncomeLedger = () => {
  const { selectedYearId } = useFinancialYear();
  const [filters, setFilters] = useState(() => ({
    ...initialFilters,
    financialYearId: selectedYearId || "",
  }));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState({ by: null, dir: null });
  const [colFilters, setColFilters] = useState({});
  const [data, setData] = useState({ items: [], total: 0, totalValue: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFilters((f) => (f.financialYearId ? f : { ...f, financialYearId: selectedYearId || "" }));
  }, [selectedYearId]);

  const load = async () => {
    setLoading(true);
    try {
      const params = { page, pageSize };
      if (filters.foundationId) params.foundationId = filters.foundationId;
      if (filters.financialYearId) params.financialYearId = filters.financialYearId;
      const from = toIsoDate(filters.from);
      const to = toIsoDate(filters.to);
      if (from) params.from = from;
      if (to) params.to = to;
      if (sort.by) {
        params.sortBy = sort.by;
        params.sortDir = sort.dir;
      }
      Object.assign(params, colFilters);
      const res = await listOtherIncome(params);
      setData({
        items: res?.items ?? [],
        total: res?.total ?? 0,
        totalValue: res?.totalValue ?? 0,
      });
    } catch (err) {
      console.error("Other income ledger error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, sort, colFilters, filters.foundationId, filters.financialYearId, filters.from, filters.to]);

  useEffect(() => {
    setPage(1);
  }, [sort, colFilters, pageSize, filters.foundationId, filters.financialYearId, filters.from, filters.to]);

  const columns = useMemo(
    () => [
      { key: "receivedOn", header: "Date", sortable: true, cell: (r) => formatDate(r.receivedOn) },
      {
        key: "itemName",
        header: "Item",
        sortable: true,
        filter: { type: "text", placeholder: "Item…" },
        cell: (r) => <span className="font-medium">{r.itemName}</span>,
      },
      {
        key: "quantity",
        header: "Qty",
        sortable: true,
        align: "right",
        cell: (r) => (
          <span className="tabular-nums">
            {Number(r.quantity)} {r.unit || ""}
          </span>
        ),
      },
      { key: "category", header: "Category", cell: (r) => r.categoryName || "—" },
      { key: "donor", header: "Donor", cell: (r) => r.donorName || "—" },
      {
        key: "estimatedValue",
        header: "Est. Value",
        sortable: true,
        align: "right",
        cell: (r) =>
          r.estimatedValue != null ? (
            <span className="tabular-nums text-muted-foreground">₹{formatAmount(r.estimatedValue)}</span>
          ) : (
            "—"
          ),
      },
    ],
    []
  );

  return (
    <>
      <Card className="mb-4">
        <CardBody>
          <AccountingFilters value={filters} onChange={setFilters} showBankAccount={false} />
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="mb-3 flex flex-wrap items-baseline gap-3">
            <h2 className="text-base font-semibold text-foreground">Other Donation (in-kind)</h2>
            <span className="text-sm text-muted-foreground">
              {data.total} receipt(s) · Est. value{" "}
              <span className="font-semibold tabular-nums text-foreground">
                ₹{formatAmount(data.totalValue)}
              </span>{" "}
              <span className="text-xs">(informational — not counted as cash)</span>
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
            emptyIcon={CubeIcon}
            emptyTitle="No in-kind receipts"
            emptyDescription="No non-cash receipts match the current filter window."
          />
        </CardBody>
      </Card>
    </>
  );
};

export default OtherIncomeLedger;
