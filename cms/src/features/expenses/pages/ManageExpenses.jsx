// src/features/expenses/pages/ManageExpenses.jsx
//
// Expense workspace. Server-side pagination + backend filters (category,
// activity, date range, amount range, search) drive a raw <table> inside a
// Card, with a ColumnsMenu for column-visibility toggling — layout mirrors
// SearchDonation. Create + edit happen in a Modal because
// the form carries 7 fields — inline card cramps the layout.
// Row actions collapse into a three-dots Dropdown, matching donations.
// ADMIN/EMPLOYEE are scoped by the backend token; SUPERADMIN gets a
// foundation filter/picker.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  EllipsisVerticalIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

import {
  createExpense,
  deleteExpense,
  listExpenses,
  listExpenseCategories,
  restoreExpense,
  updateExpense,
} from "../api";
import { listActivities } from "../../activities/api";
import { listFoundations } from "../../foundations/api";
import BankAccountSelect from "../../bankAccounts/components/BankAccountSelect";
import { useAuth } from "../../../context/AuthContext";
import { usePermissions } from "../../../hooks/usePermissions";
import { ROLES } from "../../../constants/roles";
import { PERMISSIONS } from "../../../constants/permissions";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  ColumnsMenu,
  ConfirmDialog,
  Dropdown,
  DropdownItem,
  DropdownSection,
  EmptyState,
  FormField,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Textarea,
  useColumnVisibility,
} from "../../../components/ui";
import { BanknotesIcon } from "@heroicons/react/24/outline";

const EMPTY_FORM = {
  categoryId: "",
  activityId: "",
  amount: "",
  paidTo: "",
  paidOn: "",
  referenceNo: "",
  notes: "",
  bankAccountId: "",
};
const PAGE_SIZE = 25;

const toDateInputValue = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

const formatDateCell = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
};

const formatAmount = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return v ?? "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Local guard mirroring backend regex before we hit the API. Keeps error
// messaging inline and avoids a round-trip for obvious mistakes.
const isValidAmount = (v) => /^\d{1,12}(\.\d{1,2})?$/.test(String(v).trim());

const RowActions = ({
  expense,
  canUpdate,
  canDelete,
  canRestore,
  onEdit,
  onDelete,
  onRestore,
}) => {
  const trigger = (
    <button
      type="button"
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Row actions"
    >
      <EllipsisVerticalIcon className="h-5 w-5" />
    </button>
  );
  return (
    <Dropdown trigger={trigger} align="right">
      <DropdownSection>
        {expense.isDeleted ? (
          <DropdownItem
            icon={<ArrowUturnLeftIcon className="h-4 w-4" />}
            onClick={() => onRestore(expense)}
            disabled={!canRestore}
          >
            Restore
          </DropdownItem>
        ) : (
          <>
            <DropdownItem
              icon={<PencilIcon className="h-4 w-4" />}
              onClick={() => onEdit(expense)}
              disabled={!canUpdate}
            >
              Edit
            </DropdownItem>
            <DropdownItem
              icon={<TrashIcon className="h-4 w-4" />}
              onClick={() => onDelete(expense)}
              disabled={!canDelete}
              danger
            >
              Delete
            </DropdownItem>
          </>
        )}
      </DropdownSection>
    </Dropdown>
  );
};

function ManageExpensesInner() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const isSuperadmin = user?.role === ROLES.SUPERADMIN;

  // Column visibility for the raw table; toggled from ColumnsMenu in header.
  const { hidden: hiddenCols, toggle: toggleColumn } = useColumnVisibility();

  // List + pagination state.
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isFetching, setIsFetching] = useState(false);

  // Filters.
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [activityId, setActivityId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);

  // Lookup lists.
  const [categories, setCategories] = useState([]);
  const [activities, setActivities] = useState([]);
  const [foundations, setFoundations] = useState([]);
  const [selectedFoundationId, setSelectedFoundationId] = useState("");

  // Modal + form state.
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formFoundationId, setFormFoundationId] = useState("");

  // Delete confirmation.
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const canCreate = can(PERMISSIONS.EXPENSE_CREATE);
  const canUpdate = can(PERMISSIONS.EXPENSE_UPDATE);
  const canDelete = can(PERMISSIONS.EXPENSE_DELETE);
  const canRestore = canDelete; // restore piggybacks on delete permission.

  // Load foundations once for SUPERADMIN.
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

  // Load categories + activities scoped to the current foundation view.
  // For SUPERADMIN the picker drives scope; for ADMIN/EMPLOYEE the backend
  // scopes by token.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const scopeParams = {
          page: 1,
          pageSize: 100,
          ...(isSuperadmin && selectedFoundationId
            ? { foundationId: selectedFoundationId }
            : {}),
        };
        const [catRes, actRes] = await Promise.all([
          listExpenseCategories(scopeParams),
          listActivities(scopeParams),
        ]);
        if (cancelled) return;
        setCategories(catRes?.items ?? []);
        setActivities(actRes?.items ?? []);
      } catch (err) {
        console.error("Fetch lookups error:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSuperadmin, selectedFoundationId]);

  const fetchExpenses = useCallback(async () => {
    setIsFetching(true);
    try {
      const params = {
        page,
        pageSize: PAGE_SIZE,
        q: q.trim() || undefined,
        categoryId: categoryId || undefined,
        activityId: activityId || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
        minAmount: minAmount !== "" ? Number(minAmount) : undefined,
        maxAmount: maxAmount !== "" ? Number(maxAmount) : undefined,
        includeDeleted: includeDeleted || undefined,
      };
      if (isSuperadmin && selectedFoundationId) {
        params.foundationId = selectedFoundationId;
      }
      const res = await listExpenses(params);
      setItems(res?.items ?? []);
      setTotal(res?.total ?? 0);
      setTotalPages(res?.totalPages ?? 1);
    } catch (err) {
      console.error("Fetch expenses error:", err);
    } finally {
      setIsFetching(false);
    }
  }, [
    page,
    q,
    categoryId,
    activityId,
    from,
    to,
    minAmount,
    maxAmount,
    includeDeleted,
    isSuperadmin,
    selectedFoundationId,
  ]);

  // Debounced refetch on any list-input change.
  useEffect(() => {
    const t = setTimeout(fetchExpenses, 300);
    return () => clearTimeout(t);
  }, [fetchExpenses]);

  // Snap back to page 1 when filters change.
  useEffect(() => {
    setPage(1);
  }, [
    q,
    categoryId,
    activityId,
    from,
    to,
    minAmount,
    maxAmount,
    includeDeleted,
    selectedFoundationId,
  ]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
    setFieldErrors({});
    setFormError("");
    setFormFoundationId("");
  };

  const closeModal = () => {
    if (formLoading) return;
    setModalOpen(false);
    resetForm();
  };

  const openCreate = () => {
    resetForm();
    setFormFoundationId(selectedFoundationId || "");
    setModalOpen(true);
  };

  const openEdit = (expense) => {
    setEditing(expense);
    setForm({
      categoryId: expense.categoryId || "",
      activityId: expense.activityId || "",
      amount: expense.amount != null ? String(expense.amount) : "",
      paidTo: expense.paidTo || "",
      paidOn: toDateInputValue(expense.paidOn),
      referenceNo: expense.referenceNo || "",
      notes: expense.notes || "",
      bankAccountId: expense.bankAccountId || "",
    });
    setFieldErrors({});
    setFormError("");
    setModalOpen(true);
  };

  const handleChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validateLocally = () => {
    const errs = {};
    if (!form.categoryId) errs.categoryId = ["Category is required"];
    if (!form.paidTo.trim()) errs.paidTo = ["Paid to is required"];
    if (!form.paidOn) errs.paidOn = ["Paid on date is required"];
    if (!form.amount || !isValidAmount(form.amount)) {
      errs.amount = ["Amount must be a positive number with up to 2 decimals"];
    } else if (parseFloat(form.amount) <= 0) {
      errs.amount = ["Amount must be greater than 0"];
    }
    if (isSuperadmin && !editing && !formFoundationId) {
      setFormError("Pick a foundation before creating an expense.");
      return false;
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Trim empties on create so backend optional fields are truly absent.
  // On update, send null for cleared nullable strings and null for activityId
  // when the user clears it.
  const buildPayload = () => {
    const out = {};
    const isUpdate = Boolean(editing);
    out.categoryId = form.categoryId;
    out.amount = String(form.amount).trim();
    out.paidTo = form.paidTo.trim();
    out.paidOn = new Date(form.paidOn).toISOString();

    if (form.activityId) out.activityId = form.activityId;
    else if (isUpdate) out.activityId = null;

    const ref = form.referenceNo.trim();
    if (ref) out.referenceNo = ref;
    else if (isUpdate) out.referenceNo = null;

    const notes = form.notes.trim();
    if (notes) out.notes = notes;
    else if (isUpdate) out.notes = null;

    // bankAccountId is optional on create (server falls back to the
    // foundation default). On update we only send it when the operator
    // explicitly picked one — clearing back to the auto-default isn't a
    // supported gesture (schema-level bankAccountId can't be nulled).
    if (form.bankAccountId) out.bankAccountId = form.bankAccountId;

    if (isSuperadmin && !isUpdate && formFoundationId) {
      out.foundationId = formFoundationId;
    }
    return out;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!validateLocally()) return;

    setFormLoading(true);
    try {
      const payload = buildPayload();
      if (editing) {
        await updateExpense(editing.id, payload);
        toast.success("Expense updated.");
      } else {
        await createExpense(payload);
        toast.success("Expense recorded.");
      }
      setModalOpen(false);
      resetForm();
      await fetchExpenses();
    } catch (err) {
      const envelope = err.apiError;
      if (envelope?.details?.fieldErrors) {
        setFieldErrors(envelope.details.fieldErrors);
      }
      if (envelope?.message) setFormError(envelope.message);
      console.error("Save expense error:", err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleteLoading(true);
    try {
      await deleteExpense(confirmDeleteId);
      toast.info("Expense deleted.");
      setConfirmDeleteId(null);
      await fetchExpenses();
    } catch (err) {
      console.error("Delete expense error:", err);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRestore = async (expense) => {
    try {
      await restoreExpense(expense.id);
      toast.success("Expense restored.");
      await fetchExpenses();
    } catch (err) {
      console.error("Restore expense error:", err);
    }
  };

  const fieldErr = (name) => fieldErrors?.[name]?.[0];

  const categoryOptions = useMemo(
    () => [
      { value: "", label: "— Select category —" },
      ...categories
        .filter((c) => !c.isDeleted)
        .map((c) => ({ value: c.id, label: c.name })),
    ],
    [categories]
  );
  const activityOptions = useMemo(
    () => [
      { value: "", label: "— None —" },
      ...activities
        .filter((a) => !a.isDeleted)
        .map((a) => ({ value: a.id, label: a.name })),
    ],
    [activities]
  );
  const categoryFilterOptions = useMemo(
    () => [
      { value: "", label: "All categories" },
      ...categories.map((c) => ({ value: c.id, label: c.name })),
    ],
    [categories]
  );
  const activityFilterOptions = useMemo(
    () => [
      { value: "", label: "All activities" },
      ...activities.map((a) => ({ value: a.id, label: a.name })),
    ],
    [activities]
  );
  const foundationOptions = useMemo(
    () => [
      { value: "", label: "— Select a foundation —" },
      ...foundations.map((f) => ({
        value: f.id,
        label: `${f.name} (${f.pan})`,
      })),
    ],
    [foundations]
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
        key: "paidOn",
        header: "Paid On",
        accessor: (r) => r.paidOn,
        cell: (r) => (
          <span className="whitespace-nowrap text-sm text-foreground">
            {formatDateCell(r.paidOn)}
          </span>
        ),
        sortable: true,
        className: "w-32",
      },
      {
        key: "category",
        header: "Category",
        accessor: (r) => r.category?.name || "",
        cell: (r) => (
          <span className="font-medium text-foreground">
            {r.category?.name || "—"}
          </span>
        ),
        sortable: true,
        searchable: true,
      },
      {
        key: "activity",
        header: "Activity",
        accessor: (r) => r.activity?.name || "",
        cell: (r) => (
          <span className="text-sm text-muted-foreground">
            {r.activity?.name || "—"}
          </span>
        ),
        searchable: true,
      },
      {
        key: "bankAccount",
        header: "Bank Account",
        accessor: (r) => r.bankAccount?.label || "",
        cell: (r) => {
          const acc = r.bankAccount;
          if (!acc) return <span className="text-xs text-muted-foreground">—</span>;
          const isCash = !acc.accountNumber;
          return (
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm text-foreground">
              {acc.label}
              <span
                className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                  isCash
                    ? "bg-warning/10 text-warning"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {isCash ? "Cash" : "Bank"}
              </span>
            </span>
          );
        },
        searchable: true,
      },
      {
        key: "paidTo",
        header: "Paid To",
        accessor: (r) => r.paidTo,
        cell: (r) => <span className="text-foreground">{r.paidTo}</span>,
        sortable: true,
        searchable: true,
      },
      {
        key: "amount",
        header: "Amount",
        accessor: (r) => Number(r.amount),
        cell: (r) => (
          <span className="whitespace-nowrap font-semibold tabular-nums text-foreground">
            {formatAmount(r.amount)}
          </span>
        ),
        sortable: true,
        align: "right",
      },
      {
        key: "referenceNo",
        header: "Reference",
        accessor: (r) => r.referenceNo || "",
        cell: (r) => (
          <span className="text-xs text-muted-foreground">
            {r.referenceNo || "—"}
          </span>
        ),
        searchable: true,
      },
      {
        key: "status",
        header: "Status",
        accessor: (r) => (r.isDeleted ? "Deleted" : "Active"),
        cell: (r) =>
          r.isDeleted ? (
            <span className="inline-flex items-center rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
              Deleted
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
              Active
            </span>
          ),
        className: "w-24",
      },
      {
        key: "actions",
        header: "",
        cell: (r) => (
          <RowActions
            expense={r}
            canUpdate={canUpdate}
            canDelete={canDelete}
            canRestore={canRestore}
            onEdit={openEdit}
            onDelete={(exp) => setConfirmDeleteId(exp.id)}
            onRestore={handleRestore}
          />
        ),
        exportable: false,
        className: "w-12",
        align: "right",
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canUpdate, canDelete, canRestore]
  );

  const confirmTarget = items.find((it) => it.id === confirmDeleteId) || null;

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Track foundation spending by category and activity. Filters and CSV export mirror the donations workspace."
        actions={
          canCreate && (
            <Button
              onClick={openCreate}
              leftIcon={<PlusIcon className="h-4 w-4" />}
            >
              Add Expense
            </Button>
          )
        }
      />

      <Card className="relative overflow-visible">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>All Expenses ({total})</CardTitle>
            <div className="flex items-center gap-2">
              <ColumnsMenu
                columns={columns.filter((c) => c.header)}
                hidden={hiddenCols}
                onToggle={toggleColumn}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchExpenses}
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
          {/* Filter bar */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search paid to / reference / notes"
              leftIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
            />
            <Select
              value={categoryId}
              onChange={setCategoryId}
              options={categoryFilterOptions}
            />
            <Select
              value={activityId}
              onChange={setActivityId}
              options={activityFilterOptions}
            />
            {isSuperadmin ? (
              <Select
                value={selectedFoundationId}
                onChange={setSelectedFoundationId}
                options={foundationFilterOptions}
              />
            ) : (
              <label className="flex h-9 items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={includeDeleted}
                  onChange={(e) => setIncludeDeleted(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                Show deleted
              </label>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
            <FormField label="Min Amount">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder="0.00"
              />
            </FormField>
            <FormField label="Max Amount">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder="0.00"
              />
            </FormField>
          </div>
          {isSuperadmin && (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(e) => setIncludeDeleted(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              Show deleted
            </label>
          )}

          {/* Table — matches SearchDonation layout: raw <table> in CardBody
              with an overlay spinner during refetch. Column visibility is
              driven by hiddenCols from the CardHeader ColumnsMenu. */}
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
                {!isFetching && items.length === 0 && (
                  <tr>
                    <td
                      colSpan={
                        columns.filter((c) => !hiddenCols.has(c.key)).length
                      }
                      className="px-4 py-10 text-center"
                    >
                      <EmptyState
                        icon={BanknotesIcon}
                        title="No expenses recorded"
                        description="Record your first expense using the button above so it appears in reports."
                      />
                    </td>
                  </tr>
                )}
                {items.map((row) => (
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

      {/* Create / edit modal. */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? "Edit Expense" : "Add Expense"}
        size="2xl"
        footer={
          <>
            <Button
              variant="outline"
              onClick={closeModal}
              disabled={formLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="expense-form"
              loading={formLoading}
            >
              {editing ? "Update Expense" : "Save Expense"}
            </Button>
          </>
        }
      >
        {formError && (
          <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {formError}
          </div>
        )}
        <form
          id="expense-form"
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          {isSuperadmin && !editing && (
            <div className="md:col-span-2">
              <FormField label="Foundation" required>
                <Select
                  value={formFoundationId}
                  onChange={setFormFoundationId}
                  options={foundationOptions}
                  disabled={formLoading}
                />
              </FormField>
            </div>
          )}
          <FormField label="Category" required error={fieldErr("categoryId")}>
            <Select
              value={form.categoryId}
              onChange={(v) => handleChange("categoryId", v)}
              options={categoryOptions}
              disabled={formLoading}
            />
          </FormField>
          <FormField label="Activity" error={fieldErr("activityId")}>
            <Select
              value={form.activityId}
              onChange={(v) => handleChange("activityId", v)}
              options={activityOptions}
              disabled={formLoading}
            />
          </FormField>
          <FormField label="Amount" required error={fieldErr("amount")}>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => handleChange("amount", e.target.value)}
              placeholder="0.00"
              disabled={formLoading}
              error={!!fieldErr("amount")}
            />
          </FormField>
          <FormField label="Paid On" required error={fieldErr("paidOn")}>
            <Input
              type="date"
              value={form.paidOn}
              onChange={(e) => handleChange("paidOn", e.target.value)}
              disabled={formLoading}
              error={!!fieldErr("paidOn")}
            />
          </FormField>
          <div className="md:col-span-2">
            <FormField
              label="Bank Account"
              error={fieldErr("bankAccountId")}
              hint="Pick the cash or bank account this expense debits. Leave to auto-select the foundation default."
            >
              <BankAccountSelect
                value={form.bankAccountId}
                onChange={(v) => handleChange("bankAccountId", v)}
                foundationId={
                  isSuperadmin
                    ? formFoundationId || undefined
                    : undefined
                }
                disabled={formLoading}
                error={!!fieldErr("bankAccountId")}
                autoSelectDefault={!editing}
              />
            </FormField>
          </div>
          <div className="md:col-span-2">
            <FormField label="Paid To" required error={fieldErr("paidTo")}>
              <Input
                type="text"
                value={form.paidTo}
                onChange={(e) => handleChange("paidTo", e.target.value)}
                placeholder="Vendor or beneficiary name"
                disabled={formLoading}
                error={!!fieldErr("paidTo")}
              />
            </FormField>
          </div>
          <div className="md:col-span-2">
            <FormField
              label="Reference No."
              error={fieldErr("referenceNo")}
              hint="Optional invoice / voucher number."
            >
              <Input
                type="text"
                value={form.referenceNo}
                onChange={(e) => handleChange("referenceNo", e.target.value)}
                placeholder="e.g. INV-2026-0142"
                disabled={formLoading}
                error={!!fieldErr("referenceNo")}
              />
            </FormField>
          </div>
          <div className="md:col-span-2">
            <FormField label="Notes" error={fieldErr("notes")}>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                placeholder="Optional context…"
                disabled={formLoading}
                error={!!fieldErr("notes")}
              />
            </FormField>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDeleteId}
        onClose={() => !deleteLoading && setConfirmDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete expense?"
        description={
          confirmTarget
            ? `Soft-delete this ${formatAmount(confirmTarget.amount)} expense paid to "${confirmTarget.paidTo}"? You can restore it later from the "Show deleted" filter.`
            : "Soft-delete this expense? You can restore it later."
        }
        confirmLabel="Delete"
        variant="danger"
        loading={deleteLoading}
      />
    </div>
  );
}

export default function ManageExpenses() {
  return <ManageExpensesInner />;
}
