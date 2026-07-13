// src/features/transactions/pages/ManageTransactions.jsx
//
// Read-only ledger workspace. Every row is written server-side by the
// donation / expense services as part of their $transaction; reversals live
// as sibling rows (reversalOf / reversedBy) so nothing is ever mutated in
// place. This page is the closest we have to an "audit-log for money" —
// backend filters slice by account / FY / direction / source / window, and a
// raw <table> inside a Card renders the loaded page with a ColumnsMenu for
// visibility toggling. Access mirrors ManageBankAccounts (BANK_ACCOUNT_VIEW).

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowPathIcon,
  MagnifyingGlassIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";

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
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  CardFooter,
  ColumnsMenu,
  EmptyState,
  FormField,
  Input,
  PageHeader,
  Select,
  Spinner,
  useColumnVisibility,
} from "../../../components/ui";

const PAGE_SIZE = 25;

const TYPE_OPTIONS = [
  { value: "", label: "All directions" },
  { value: "CREDIT", label: "Credit (money in)" },
  { value: "DEBIT", label: "Debit (money out)" },
];
const ENTITY_TYPE_OPTIONS = [
  { value: "", label: "All sources" },
  { value: "Donation", label: "Donation" },
  { value: "Expense", label: "Expense" },
  { value: "Manual", label: "Manual" },
];

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

  // Column visibility for the raw table; toggled from ColumnsMenu in header.
  const { hidden: hiddenCols, toggle: toggleColumn } = useColumnVisibility();

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isFetching, setIsFetching] = useState(false);

  // Filters.
  const [bankAccountId, setBankAccountId] = useState("");
  const [financialYearId, setFinancialYearId] = useState("");
  const [type, setType] = useState("");
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedFoundationId, setSelectedFoundationId] = useState("");
  // Client-side filter over the loaded page (description, entityId).
  const [q, setQ] = useState("");

  // Lookup lists for the filter dropdowns.
  const [bankAccounts, setBankAccounts] = useState([]);
  const [financialYears, setFinancialYears] = useState([]);
  const [foundations, setFoundations] = useState([]);

  useEffect(() => {
    if (!isSuperadmin) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await listFoundations({ page: 1, pageSize: 100 });
        if (!cancelled) setFoundations(res?.items ?? []);
      } catch (err) {
        console.error("Fetch foundations error:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSuperadmin]);

  // Reload bank accounts / FYs when the SUPERADMIN foundation picker moves,
  // so the account + FY dropdowns stay scoped to that foundation.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = { page: 1, pageSize: 100 };
        if (isSuperadmin && selectedFoundationId) {
          params.foundationId = selectedFoundationId;
        }
        const [ba, fy] = await Promise.all([
          listBankAccounts(params),
          listFinancialYears(params),
        ]);
        if (cancelled) return;
        setBankAccounts(ba?.items ?? []);
        setFinancialYears(fy?.items ?? []);
      } catch (err) {
        console.error("Fetch ledger lookups error:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSuperadmin, selectedFoundationId]);

  const fetchRows = useCallback(async () => {
    if (!canView) return;
    setIsFetching(true);
    try {
      const params = {
        page,
        pageSize: PAGE_SIZE,
        bankAccountId: bankAccountId || undefined,
        financialYearId: financialYearId || undefined,
        type: type || undefined,
        entityType: entityType || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
      };
      if (isSuperadmin && selectedFoundationId) {
        params.foundationId = selectedFoundationId;
      }
      const res = await listTransactions(params);
      setItems(res?.items ?? []);
      setTotal(res?.total ?? 0);
      setTotalPages(res?.totalPages ?? 1);
    } catch (err) {
      console.error("Fetch transactions error:", err);
    } finally {
      setIsFetching(false);
    }
  }, [
    canView,
    page,
    bankAccountId,
    financialYearId,
    type,
    entityType,
    from,
    to,
    isSuperadmin,
    selectedFoundationId,
  ]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  // Reset page to 1 when a filter changes so we don't land on an empty tail.
  useEffect(() => {
    setPage(1);
  }, [
    bankAccountId,
    financialYearId,
    type,
    entityType,
    from,
    to,
    selectedFoundationId,
  ]);

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
  const foundationFilterOptions = useMemo(
    () => [
      { value: "", label: "All foundations" },
      ...foundations.map((f) => ({ value: f.id, label: f.name })),
    ],
    [foundations]
  );

  // Column config for the raw <table> render loop. `key`, `header`, `cell`,
  // `accessor`, `align`, `className` fields are consumed directly by the
  // <thead>/<tbody> in the JSX below and by ColumnsMenu in the CardHeader.
  const columns = useMemo(
    () => [
      {
        key: "occurredAt",
        header: "When",
        accessor: (r) => r.occurredAt,
        cell: (r) => (
          <span className="whitespace-nowrap text-sm text-foreground">
            {formatDateTime(r.occurredAt)}
          </span>
        ),
        sortable: true,
        className: "w-44",
      },
      {
        key: "bankAccount",
        header: "Account",
        accessor: (r) => r.bankAccount?.label || "",
        cell: (r) => {
          const badge = CATEGORY_BADGE[r.bankAccount?.category] || {
            variant: "default",
            label: r.bankAccount?.category || "—",
          };
          return (
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {r.bankAccount?.label || "—"}
              </span>
              <Badge variant={badge.variant} className="mt-0.5 w-fit text-[10px]">
                {badge.label}
              </Badge>
            </div>
          );
        },
        sortable: true,
        searchable: true,
      },
      {
        key: "type",
        header: "Direction",
        accessor: (r) => r.type,
        cell: (r) =>
          r.type === "CREDIT" ? (
            <Badge variant="success">Credit</Badge>
          ) : (
            <Badge variant="danger">Debit</Badge>
          ),
        sortable: true,
        className: "w-28",
      },
      {
        key: "amount",
        header: "Amount",
        accessor: (r) => (r.type === "CREDIT" ? 1 : -1) * Number(r.amount),
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
        sortable: true,
        align: "right",
        className: "w-32",
      },
      {
        key: "balanceAfter",
        header: "Balance After",
        accessor: (r) => Number(r.balanceAfter),
        cell: (r) => (
          <span className="whitespace-nowrap tabular-nums text-foreground">
            {formatAmount(r.balanceAfter)}
          </span>
        ),
        sortable: true,
        align: "right",
        className: "w-32",
      },
      {
        key: "entity",
        header: "Source",
        accessor: (r) => `${r.entityType} ${r.entityId}`,
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
        searchable: true,
      },
      {
        key: "description",
        header: "Description",
        accessor: (r) => r.description || "",
        cell: (r) => (
          <span className="text-sm text-foreground">
            {r.description || "—"}
          </span>
        ),
        searchable: true,
      },
      {
        key: "reversal",
        header: "Reversal",
        accessor: (r) => (r.reversalOf ? "Reverses" : r.reversedBy ? "Reversed" : ""),
        cell: (r) => {
          if (r.reversalOf) {
            return <Badge variant="warning">Reverses prior</Badge>;
          }
          if (r.reversedBy) {
            return <Badge variant="default">Reversed</Badge>;
          }
          return <span className="text-xs text-muted-foreground">—</span>;
        },
        className: "w-36",
      },
    ],
    []
  );

  // Client-side filter over the loaded page. Backend filters already scope
  // the query; this is just a UX affordance for grepping a big page quickly.
  const filteredItems = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((r) => {
      const haystack = [
        r.description,
        r.entityId,
        r.donationId,
        r.expenseId,
        r.bankAccount?.label,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [items, q]);

  return (
    <div>
      <PageHeader
        title="Ledger"
        subtitle="Immutable running record of every credit and debit posted against a foundation's bank accounts. Reversals appear as sibling rows — no line item is ever mutated in place."
      />

      <Card className="relative overflow-visible">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>All Transactions ({total})</CardTitle>
            <div className="flex items-center gap-2">
              <ColumnsMenu
                columns={columns.filter((c) => c.header)}
                hidden={hiddenCols}
                onToggle={toggleColumn}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchRows}
                disabled={isFetching}
                leftIcon={
                  <ArrowPathIcon
                    className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
                  />
                }
              >
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardBody className="space-y-4">
          {/* Filter row 1: identity filters. */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter loaded rows…"
              leftIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
            />
            <Select
              value={bankAccountId}
              onChange={setBankAccountId}
              options={bankAccountOptions}
            />
            <Select
              value={financialYearId}
              onChange={setFinancialYearId}
              options={financialYearOptions}
            />
            {isSuperadmin ? (
              <Select
                value={selectedFoundationId}
                onChange={setSelectedFoundationId}
                options={foundationFilterOptions}
              />
            ) : (
              <div />
            )}
          </div>

          {/* Filter row 2: type / entity / date range. */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Select
              value={type}
              onChange={setType}
              options={TYPE_OPTIONS}
            />
            <Select
              value={entityType}
              onChange={setEntityType}
              options={ENTITY_TYPE_OPTIONS}
            />
            <FormField label="From">
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </FormField>
            <FormField label="To">
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </FormField>
          </div>

          {/* Table — matches SearchDonation layout: raw <table> with an
              overlay spinner during refetch. Column visibility is driven by
              hiddenCols from the CardHeader ColumnsMenu. */}
          <div className="relative overflow-x-auto">
            {isFetching && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                <Spinner />
              </div>
            )}
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {columns
                    .filter((c) => !hiddenCols.has(c.key))
                    .map((col) => (
                      <th
                        key={col.key}
                        className={`px-4 py-2.5 font-medium ${
                          col.align === "right" ? "text-right" : ""
                        } ${col.className || ""}`}
                      >
                        {col.header}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {!isFetching && filteredItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={
                        columns.filter((c) => !hiddenCols.has(c.key)).length
                      }
                      className="px-4 py-10 text-center"
                    >
                      <EmptyState
                        icon={BanknotesIcon}
                        title="No ledger rows"
                        description="Once donations and expenses start posting to bank accounts, their credits and debits will appear here."
                      />
                    </td>
                  </tr>
                )}
                {filteredItems.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/40">
                    {columns
                      .filter((c) => !hiddenCols.has(c.key))
                      .map((col) => (
                        <td
                          key={col.key}
                          className={`px-4 py-2.5 ${
                            col.align === "right" ? "text-right" : ""
                          }`}
                        >
                          {col.cell
                            ? col.cell(row)
                            : col.accessor
                            ? col.accessor(row)
                            : "—"}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>

        <CardFooter className="justify-between">
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages} · {total} total
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isFetching}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isFetching}
            >
              Next
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ManageTransactions;
