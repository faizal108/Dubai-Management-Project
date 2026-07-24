// src/features/transactions/pages/ManageTransactions.jsx
//
// Read-only ledger workspace, built on the shared DataTable. Every row is
// written server-side by the donation / expense / transfer services; reversals
// live as sibling rows (reversalOf / reversedBy). The table drives server-side
// global search, per-column filter + sort, and pagination; identity filters
// (account / FY / foundation / date window) live in the toolbar slot.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BanknotesIcon } from "@heroicons/react/24/outline";

import { listTransactions } from "../api";
import { listBankAccounts } from "../../bankAccounts/api";
import { listFinancialYears } from "../../financialYears/api";
import { listFoundations } from "../../foundations/api";
import { useAuth } from "../../../context/AuthContext";
import { usePermissions } from "../../../hooks/usePermissions";
import { ROLES } from "../../../constants/roles";
import { PERMISSIONS } from "../../../constants/permissions";
import {
  Badge,
  Card,
  CardBody,
  DataTable,
  FormField,
  Input,
  PageHeader,
  Select,
} from "../../../components/ui";

const CATEGORY_BADGE = {
  GENERAL: { variant: "primary", label: "General" },
  CSR: { variant: "warning", label: "CSR" },
};

const formatDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const formatAmount = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return v ?? "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const ManageTransactions = () => {
  const { user } = useAuth();
  const { can } = usePermissions();
  const isSuperadmin = user?.role === ROLES.SUPERADMIN;
  const canView = can(PERMISSIONS.BANK_ACCOUNT_VIEW);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Table query state.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState({ by: null, dir: null });
  const [search, setSearch] = useState("");
  const [colFilters, setColFilters] = useState({});

  // Toolbar (identity) filters.
  const [bankAccountId, setBankAccountId] = useState("");
  const [financialYearId, setFinancialYearId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedFoundationId, setSelectedFoundationId] = useState("");

  const [bankAccounts, setBankAccounts] = useState([]);
  const [financialYears, setFinancialYears] = useState([]);
  const [foundations, setFoundations] = useState([]);

  useEffect(() => {
    if (!isSuperadmin) return;
    (async () => {
      try {
        const res = await listFoundations({ page: 1, pageSize: 100 });
        setFoundations(res?.items ?? []);
      } catch (err) {
        console.error("Fetch foundations error:", err);
      }
    })();
  }, [isSuperadmin]);

  useEffect(() => {
    (async () => {
      try {
        const params = { page: 1, pageSize: 100 };
        if (isSuperadmin && selectedFoundationId) params.foundationId = selectedFoundationId;
        const [ba, fy] = await Promise.all([
          listBankAccounts(params),
          listFinancialYears(params),
        ]);
        setBankAccounts(ba?.items ?? []);
        setFinancialYears(fy?.items ?? []);
      } catch (err) {
        console.error("Fetch ledger lookups error:", err);
      }
    })();
  }, [isSuperadmin, selectedFoundationId]);

  const fetchRows = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const params = {
        page,
        pageSize,
        q: search || undefined,
        sortBy: sort.by || undefined,
        sortDir: sort.by ? sort.dir : undefined,
        bankAccountId: bankAccountId || undefined,
        financialYearId: financialYearId || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
        ...colFilters,
      };
      if (isSuperadmin && selectedFoundationId) params.foundationId = selectedFoundationId;
      const res = await listTransactions(params);
      setItems(res?.items ?? []);
      setTotal(res?.total ?? 0);
    } catch (err) {
      console.error("Fetch transactions error:", err);
    } finally {
      setLoading(false);
    }
  }, [
    canView, page, pageSize, search, sort, colFilters,
    bankAccountId, financialYearId, from, to, isSuperadmin, selectedFoundationId,
  ]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  // Reset to page 1 whenever anything that changes the result set moves.
  useEffect(() => {
    setPage(1);
  }, [search, colFilters, sort, bankAccountId, financialYearId, from, to, pageSize, selectedFoundationId]);

  const bankAccountOptions = useMemo(
    () => [
      { value: "", label: "All bank accounts" },
      ...bankAccounts.map((a) => ({
        value: a.id,
        label: `${a.label} · ${a.category}${a.isDefault ? " (default)" : ""}`,
      })),
    ],
    [bankAccounts]
  );
  const financialYearOptions = useMemo(
    () => [
      { value: "", label: "All financial years" },
      ...financialYears.map((f) => ({ value: f.id, label: f.label })),
    ],
    [financialYears]
  );
  const foundationOptions = useMemo(
    () => [
      { value: "", label: "All foundations" },
      ...foundations.map((f) => ({ value: f.id, label: f.name })),
    ],
    [foundations]
  );

  const columns = useMemo(
    () => [
      {
        key: "occurredAt",
        header: "When",
        sortable: true,
        width: "11rem",
        cell: (r) => (
          <span className="whitespace-nowrap">{formatDateTime(r.occurredAt)}</span>
        ),
      },
      {
        key: "bankAccount",
        header: "Account",
        cell: (r) => {
          const badge = CATEGORY_BADGE[r.bankAccount?.category] || {
            variant: "default",
            label: r.bankAccount?.category || "—",
          };
          return (
            <div className="flex flex-col">
              <span className="font-medium">{r.bankAccount?.label || "—"}</span>
              <Badge variant={badge.variant} className="mt-0.5 w-fit text-[10px]">
                {badge.label}
              </Badge>
            </div>
          );
        },
      },
      {
        key: "type",
        header: "Direction",
        sortable: true,
        width: "9rem",
        filter: {
          type: "select",
          options: [
            { value: "", label: "All" },
            { value: "CREDIT", label: "Credit" },
            { value: "DEBIT", label: "Debit" },
          ],
        },
        cell: (r) =>
          r.type === "CREDIT" ? (
            <Badge variant="success">Credit</Badge>
          ) : (
            <Badge variant="danger">Debit</Badge>
          ),
      },
      {
        key: "amount",
        header: "Amount",
        sortable: true,
        align: "right",
        width: "8rem",
        cell: (r) => (
          <span
            className={`whitespace-nowrap font-semibold tabular-nums ${
              r.type === "CREDIT" ? "text-success" : "text-danger"
            }`}
          >
            {r.type === "CREDIT" ? "+" : "−"}
            {formatAmount(r.amount)}
          </span>
        ),
      },
      {
        key: "balanceAfter",
        header: "Balance After",
        sortable: true,
        align: "right",
        width: "8rem",
        cell: (r) => (
          <span className="whitespace-nowrap tabular-nums">
            {formatAmount(r.balanceAfter)}
          </span>
        ),
      },
      {
        key: "entityType",
        header: "Source",
        filter: {
          type: "select",
          options: [
            { value: "", label: "All sources" },
            { value: "Donation", label: "Donation" },
            { value: "Expense", label: "Expense" },
            { value: "Transfer", label: "Transfer" },
            { value: "Manual", label: "Manual" },
          ],
        },
        cell: (r) => (
          <div className="flex flex-col">
            <span className="text-xs font-medium uppercase text-muted-foreground">
              {r.entityType}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {r.entityId?.slice(0, 12) || "—"}
              {r.entityId?.length > 12 ? "…" : ""}
            </span>
          </div>
        ),
      },
      {
        key: "description",
        header: "Description",
        filter: { type: "text", placeholder: "Search…" },
        cell: (r) => <span>{r.description || "—"}</span>,
      },
      {
        key: "reversal",
        header: "Reversal",
        width: "9rem",
        cell: (r) =>
          r.reversalOf ? (
            <Badge variant="warning">Reverses prior</Badge>
          ) : r.reversedBy ? (
            <Badge variant="default">Reversed</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
    ],
    []
  );

  return (
    <div>
      <PageHeader
        title="Ledger"
        subtitle="Immutable running record of every credit and debit posted against a foundation's bank accounts. Reversals appear as sibling rows — no line item is ever mutated in place."
      />
      <Card>
        <CardBody>
          <DataTable
            columns={columns}
            rows={items}
            total={total}
            loading={loading}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            sort={sort}
            onSortChange={setSort}
            globalSearch={search}
            onGlobalSearchChange={setSearch}
            searchPlaceholder="Search description / account…"
            columnFilters={colFilters}
            onColumnFiltersChange={setColFilters}
            emptyIcon={BanknotesIcon}
            emptyTitle="No ledger rows"
            emptyDescription="Once donations, expenses, and transfers post to bank accounts, their credits and debits appear here."
            toolbarSlot={
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-52">
                  <Select
                    value={bankAccountId}
                    onChange={setBankAccountId}
                    options={bankAccountOptions}
                  />
                </div>
                <div className="w-44">
                  <Select
                    value={financialYearId}
                    onChange={setFinancialYearId}
                    options={financialYearOptions}
                  />
                </div>
                {isSuperadmin && (
                  <div className="w-48">
                    <Select
                      value={selectedFoundationId}
                      onChange={setSelectedFoundationId}
                      options={foundationOptions}
                    />
                  </div>
                )}
                <FormField label="From" className="w-36">
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </FormField>
                <FormField label="To" className="w-36">
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </FormField>
              </div>
            }
          />
        </CardBody>
      </Card>
    </div>
  );
};

export default ManageTransactions;
