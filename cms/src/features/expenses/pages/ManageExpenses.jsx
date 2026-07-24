// src/features/expenses/pages/ManageExpenses.jsx
//
// Expense workspace on the shared DataTable. Global search (paidTo / reference /
// notes) + per-column text filters + column sort + pagination are server-side;
// category / activity / date-range / amount-range / show-deleted live in the
// toolbar slot. Create + edit happen in a Modal. ADMIN/EMPLOYEE are scoped by
// the backend token; SUPERADMIN gets a foundation filter + picker.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  ArrowUturnLeftIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";

import {
  createExpense,
  deleteExpense,
  listExpenses,
  restoreExpense,
  updateExpense,
} from "../api";
import { listCategories } from "../../categories/api";
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
  ConfirmDialog,
  DataTable,
  actionsColumn,
  FormField,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
} from "../../../components/ui";

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

const isValidAmount = (v) => /^\d{1,12}(\.\d{1,2})?$/.test(String(v).trim());

function ManageExpensesInner() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const isSuperadmin = user?.role === ROLES.SUPERADMIN;

  // List + table query state.
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState({ by: null, dir: null });
  const [search, setSearch] = useState("");
  const [colFilters, setColFilters] = useState({});

  // Toolbar filters.
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
  const canRestore = canDelete;

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
          listCategories({ ...scopeParams, kind: "EXPENSE" }),
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
        pageSize,
        q: search.trim() || undefined,
        sortBy: sort.by || undefined,
        sortDir: sort.by ? sort.dir : undefined,
        categoryId: categoryId || undefined,
        activityId: activityId || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
        minAmount: minAmount !== "" ? Number(minAmount) : undefined,
        maxAmount: maxAmount !== "" ? Number(maxAmount) : undefined,
        includeDeleted: includeDeleted || undefined,
        ...colFilters,
      };
      if (isSuperadmin && selectedFoundationId) {
        params.foundationId = selectedFoundationId;
      }
      const res = await listExpenses(params);
      setItems(res?.items ?? []);
      setTotal(res?.total ?? 0);
    } catch (err) {
      console.error("Fetch expenses error:", err);
    } finally {
      setIsFetching(false);
    }
  }, [
    page, pageSize, search, sort, colFilters, categoryId, activityId,
    from, to, minAmount, maxAmount, includeDeleted, isSuperadmin, selectedFoundationId,
  ]);

  useEffect(() => {
    const t = setTimeout(fetchExpenses, 250);
    return () => clearTimeout(t);
  }, [fetchExpenses]);

  useEffect(() => {
    setPage(1);
  }, [
    search, colFilters, sort, categoryId, activityId, from, to,
    minAmount, maxAmount, includeDeleted, pageSize, selectedFoundationId,
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
      if (envelope?.details?.fieldErrors) setFieldErrors(envelope.details.fieldErrors);
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
      ...categories.filter((c) => !c.isDeleted).map((c) => ({ value: c.id, label: c.name })),
    ],
    [categories]
  );
  const activityOptions = useMemo(
    () => [
      { value: "", label: "— None —" },
      ...activities.filter((a) => !a.isDeleted).map((a) => ({ value: a.id, label: a.name })),
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
      ...foundations.map((f) => ({ value: f.id, label: `${f.name} (${f.pan})` })),
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

  const columns = useMemo(
    () => [
      {
        key: "paidOn",
        header: "Paid On",
        sortable: true,
        width: "8rem",
        cell: (r) => (
          <span className="whitespace-nowrap">{formatDateCell(r.paidOn)}</span>
        ),
      },
      {
        key: "category",
        header: "Category",
        cell: (r) => (
          <span className="font-medium">{r.category?.name || "—"}</span>
        ),
      },
      {
        key: "activity",
        header: "Activity",
        cell: (r) => (
          <span className="text-muted-foreground">{r.activity?.name || "—"}</span>
        ),
      },
      {
        key: "bankAccount",
        header: "Bank Account",
        cell: (r) => {
          const acc = r.bankAccount;
          if (!acc) return <span className="text-xs text-muted-foreground">—</span>;
          const isCash = !acc.accountNumber;
          return (
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              {acc.label}
              <span
                className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                  isCash ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"
                }`}
              >
                {isCash ? "Cash" : "Bank"}
              </span>
            </span>
          );
        },
      },
      {
        key: "paidTo",
        header: "Paid To",
        sortable: true,
        filter: { type: "text", placeholder: "Search…" },
        cell: (r) => r.paidTo,
      },
      {
        key: "amount",
        header: "Amount",
        sortable: true,
        align: "right",
        width: "8rem",
        cell: (r) => (
          <span className="whitespace-nowrap font-semibold tabular-nums">
            {formatAmount(r.amount)}
          </span>
        ),
      },
      {
        key: "referenceNo",
        header: "Reference",
        filter: { type: "text", placeholder: "Search…" },
        cell: (r) => (
          <span className="text-xs text-muted-foreground">{r.referenceNo || "—"}</span>
        ),
      },
      {
        key: "status",
        header: "Status",
        width: "6rem",
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
      },
      actionsColumn({
        items: (r) =>
          r.isDeleted
            ? [
                {
                  label: "Restore",
                  icon: <ArrowUturnLeftIcon className="h-4 w-4" />,
                  onClick: () => handleRestore(r),
                  disabled: !canRestore,
                },
              ]
            : [
                {
                  label: "Edit",
                  icon: <PencilIcon className="h-4 w-4" />,
                  onClick: () => openEdit(r),
                  disabled: !canUpdate,
                },
                {
                  label: "Delete",
                  icon: <TrashIcon className="h-4 w-4" />,
                  onClick: () => setConfirmDeleteId(r.id),
                  disabled: !canDelete,
                  danger: true,
                },
              ],
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canUpdate, canDelete, canRestore]
  );

  const confirmTarget = items.find((it) => it.id === confirmDeleteId) || null;

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Track foundation spending by category and activity."
        actions={
          canCreate && (
            <Button onClick={openCreate} leftIcon={<PlusIcon className="h-4 w-4" />}>
              Add Expense
            </Button>
          )
        }
      />

      <Card>
        <CardBody>
          <DataTable
            columns={columns}
            rows={items}
            total={total}
            loading={isFetching}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            sort={sort}
            onSortChange={setSort}
            globalSearch={search}
            onGlobalSearchChange={setSearch}
            searchPlaceholder="Search paid to / reference / notes"
            columnFilters={colFilters}
            onColumnFiltersChange={setColFilters}
            emptyIcon={BanknotesIcon}
            emptyTitle="No expenses recorded"
            emptyDescription="Record your first expense using the button above so it appears in reports."
            toolbarSlot={
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-44">
                  <Select value={categoryId} onChange={setCategoryId} options={categoryFilterOptions} />
                </div>
                <div className="w-44">
                  <Select value={activityId} onChange={setActivityId} options={activityFilterOptions} />
                </div>
                {isSuperadmin && (
                  <div className="w-44">
                    <Select
                      value={selectedFoundationId}
                      onChange={setSelectedFoundationId}
                      options={foundationFilterOptions}
                    />
                  </div>
                )}
                <div className="w-36">
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="From" />
                </div>
                <div className="w-36">
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="To" />
                </div>
                <div className="w-24">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    placeholder="Min ₹"
                  />
                </div>
                <div className="w-24">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    placeholder="Max ₹"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={includeDeleted}
                    onChange={(e) => setIncludeDeleted(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  Show deleted
                </label>
              </div>
            }
          />
        </CardBody>
      </Card>

      {/* Create / edit modal. */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? "Edit Expense" : "Add Expense"}
        size="2xl"
        footer={
          <>
            <Button variant="outline" onClick={closeModal} disabled={formLoading}>
              Cancel
            </Button>
            <Button type="submit" form="expense-form" loading={formLoading}>
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
        <form id="expense-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                foundationId={isSuperadmin ? formFoundationId || undefined : undefined}
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
            <FormField label="Reference No." error={fieldErr("referenceNo")} hint="Optional invoice / voucher number.">
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
