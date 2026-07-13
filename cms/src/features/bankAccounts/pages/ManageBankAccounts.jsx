// src/features/bankAccounts/pages/ManageBankAccounts.jsx
//
// Bank-account workspace. Every donation / expense posts to a bank account,
// so this page is the source of truth for GENERAL / CSR balances the ledger
// will hit. Mirrors ManageFinancialYears in structure — server-side
// pagination, inline field errors, ConfirmDialog on destructive actions —
// with a couple of banking-specific twists:
//
//   - Category (GENERAL / CSR) is immutable after create so the ledger's
//     category tagging stays stable and the default-swap uniqueness holds.
//   - Opening balance is create-only. Corrections are posted as manual
//     ledger rows, not by rewriting the seed number.
//   - "Default" is a per-(foundation, category) flag. Setting it on one row
//     atomically clears every other default in the same category (the server
//     enforces this in a transaction; the UI just fires the PATCH).
//
// Permissioning:
//   - View  → PERMISSIONS.BANK_ACCOUNT_VIEW
//   - Write → PERMISSIONS.BANK_ACCOUNT_MANAGE

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  PencilIcon,
  TrashIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  StarIcon,
  BanknotesIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarSolidIcon } from "@heroicons/react/24/solid";

import {
  createBankAccount,
  deleteBankAccount,
  listBankAccounts,
  updateBankAccount,
} from "../api";
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
  Input,
  Textarea,
  Select,
  PageHeader,
  FormField,
  ConfirmDialog,
  EmptyState,
} from "../../../components/ui";

const EMPTY_FORM = {
  label: "",
  category: "GENERAL",
  openingBalance: "0",
  bankName: "",
  accountNumber: "",
  ifsc: "",
  upiId: "",
  notes: "",
  isDefault: false,
  isActive: true,
};
const PAGE_SIZE = 10;

// Purpose-based buckets. GENERAL is the operating fund; CSR segregates
// corporate-social-responsibility flows so reporting can slice by fund
// stream regardless of the payment mode (CASH / UPI / ONLINE / CHEQUE).
const CATEGORY_OPTIONS = [
  { value: "GENERAL", label: "General" },
  { value: "CSR", label: "CSR" },
];
const CATEGORY_FILTER_OPTIONS = [
  { value: "", label: "All categories" },
  ...CATEGORY_OPTIONS,
];
const ACTIVE_FILTER_OPTIONS = [
  { value: "", label: "All (active + inactive)" },
  { value: "true", label: "Active only" },
  { value: "false", label: "Inactive only" },
];

// Prisma Decimal comes back over the wire as a string like "1234.50". Format
// it with the browser locale so cells align with the rupee columns elsewhere
// in the CMS. Null-safe.
const formatMoney = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const CATEGORY_BADGE = {
  GENERAL: { variant: "success", label: "General" },
  CSR: { variant: "primary", label: "CSR" },
};

const ManageBankAccounts = () => {
  const { user } = useAuth();
  const { can } = usePermissions();
  const isSuperadmin = user?.role === ROLES.SUPERADMIN;

  const canView = can(PERMISSIONS.BANK_ACCOUNT_VIEW);
  const canManage = can(PERMISSIONS.BANK_ACCOUNT_MANAGE);

  // List state.
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [isFetching, setIsFetching] = useState(false);

  // Form state.
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // SUPERADMIN foundation picker + list filter.
  const [foundations, setFoundations] = useState([]);
  const [selectedFoundationId, setSelectedFoundationId] = useState("");

  // Row-action confirmation dialogs.
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);


  // Load foundations once for SUPERADMIN. ADMINs are scoped server-side.
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

  const fetchAccounts = useCallback(async () => {
    if (!canView) return;
    setIsFetching(true);
    try {
      const params = {
        page,
        pageSize: PAGE_SIZE,
        q: q.trim() || undefined,
        category: categoryFilter || undefined,
        isActive: activeFilter === "" ? undefined : activeFilter,
      };
      if (isSuperadmin && selectedFoundationId) {
        params.foundationId = selectedFoundationId;
      }
      const res = await listBankAccounts(params);
      setItems(res?.items ?? []);
      setTotal(res?.total ?? 0);
      setTotalPages(res?.totalPages ?? 1);
    } catch (err) {
      console.error("Fetch bank accounts error:", err);
    } finally {
      setIsFetching(false);
    }
  }, [canView, page, q, categoryFilter, activeFilter, isSuperadmin, selectedFoundationId]);

  // Debounced refetch on any list-input change.
  useEffect(() => {
    const t = setTimeout(fetchAccounts, 300);
    return () => clearTimeout(t);
  }, [fetchAccounts]);

  // Snap back to page 1 when filters change.
  useEffect(() => {
    setPage(1);
  }, [q, categoryFilter, activeFilter, selectedFoundationId]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFieldErrors({});
    setFormError("");
  };

  const handleChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  // Only send fields the server accepts on this path. Category + openingBalance
  // are create-only per the backend schema; foundationId is create-only and
  // SUPERADMIN-only. Empty optional strings become undefined so the server
  // schema's blank-to-undef transform applies cleanly.
  const buildPayload = () => {
    const isUpdate = Boolean(editingId);
    const trimOrUndef = (v) => {
      const s = (v ?? "").trim();
      return s === "" ? undefined : s;
    };
    const base = {
      label: form.label.trim(),
      bankName: trimOrUndef(form.bankName),
      accountNumber: trimOrUndef(form.accountNumber),
      ifsc: trimOrUndef(form.ifsc),
      upiId: trimOrUndef(form.upiId),
      notes: trimOrUndef(form.notes),
      isDefault: !!form.isDefault,
      isActive: !!form.isActive,
    };
    if (isUpdate) return base;
    return {
      ...base,
      category: form.category,
      openingBalance: (form.openingBalance ?? "0").toString().trim() || "0",
      ...(isSuperadmin ? { foundationId: selectedFoundationId } : {}),
    };
  };

  const validateLocally = () => {
    const errs = {};
    const label = form.label.trim();
    if (label.length < 2) errs.label = ["Label must be at least 2 characters"];
    else if (label.length > 80) errs.label = ["Label must be at most 80 characters"];

    if (!editingId) {
      if (!form.category) errs.category = ["Category is required"];
      const ob = (form.openingBalance ?? "").toString().trim();
      if (ob !== "" && !/^\d{1,12}(\.\d{1,2})?$/.test(ob)) {
        errs.openingBalance = [
          "Opening balance must be a non-negative decimal with up to 2 dp",
        ];
      }
      if (isSuperadmin && !selectedFoundationId) {
        setFormError("Pick a foundation before creating a bank account.");
        setFieldErrors(errs);
        return false;
      }
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!validateLocally()) return;

    setFormLoading(true);
    try {
      const payload = buildPayload();
      if (editingId) {
        await updateBankAccount(editingId, payload);
        toast.success("Bank account updated.");
      } else {
        await createBankAccount(payload);
        toast.success("Bank account created.");
      }
      resetForm();
      await fetchAccounts();
    } catch (err) {
      const envelope = err.apiError;
      if (envelope?.details?.fieldErrors) {
        setFieldErrors(envelope.details.fieldErrors);
      }
      if (envelope?.message) setFormError(envelope.message);
      console.error("Save bank account error:", err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = (acc) => {
    setForm({
      label: acc.label || "",
      category: acc.category || "GENERAL",
      openingBalance: acc.openingBalance?.toString() ?? "0",
      bankName: acc.bankName || "",
      accountNumber: acc.accountNumber || "",
      ifsc: acc.ifsc || "",
      upiId: acc.upiId || "",
      notes: acc.notes || "",
      isDefault: !!acc.isDefault,
      isActive: acc.isActive !== false,
    });
    setEditingId(acc.id);
    setFieldErrors({});
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleteLoading(true);
    try {
      await deleteBankAccount(confirmDeleteId);
      toast.info("Bank account deleted.");
      if (editingId === confirmDeleteId) resetForm();
      setConfirmDeleteId(null);
      await fetchAccounts();
    } catch (err) {
      console.error("Delete bank account error:", err);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Quick action: promote a row to be the default for its (foundation, category).
  // Server clears the existing default atomically inside a transaction.
  const handleSetDefault = async (acc) => {
    try {
      await updateBankAccount(acc.id, { isDefault: true });
      toast.success(`"${acc.label}" is now the default ${acc.category} account.`);
      await fetchAccounts();
    } catch (err) {
      console.error("Set default bank account error:", err);
    }
  };

  // Quick action: flip isActive without opening the edit form. Handy for
  // seasonal accounts (e.g. a temporary CASH box) that shouldn't be picked
  // during posting but still need to hang around for the ledger.
  const handleToggleActive = async (acc) => {
    try {
      await updateBankAccount(acc.id, { isActive: !acc.isActive });
      toast.success(
        acc.isActive
          ? `"${acc.label}" deactivated.`
          : `"${acc.label}" reactivated.`
      );
      await fetchAccounts();
    } catch (err) {
      console.error("Toggle active bank account error:", err);
    }
  };

  const fieldErr = (name) => fieldErrors?.[name]?.[0];

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

  const confirmDeleteTarget =
    items.find((it) => it.id === confirmDeleteId) || null;


  return (
    <div>
      <PageHeader
        title="Bank Accounts"
        subtitle="Register the General and CSR accounts every donation and expense will post to. Mark one default per category so posting works even when the form leaves the picker blank."
      />

      <div className="space-y-6">
        {/* Create / Edit form — gated on bankAccount:manage. */}
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>
                {editingId ? "Edit Bank Account" : "Add Bank Account"}
              </CardTitle>
            </CardHeader>
            <CardBody>
              {formError && (
                <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {formError}
                </div>
              )}

              <form
                id="bank-account-form"
                onSubmit={handleSubmit}
                className="grid grid-cols-1 gap-4 md:grid-cols-2"
              >
                {isSuperadmin && !editingId && (
                  <div className="md:col-span-2">
                    <FormField label="Foundation" required>
                      <Select
                        value={selectedFoundationId}
                        onChange={setSelectedFoundationId}
                        options={foundationOptions}
                        disabled={formLoading}
                      />
                    </FormField>
                  </div>
                )}

                <FormField label="Label" required error={fieldErr("label")}>
                  <Input
                    type="text"
                    name="label"
                    placeholder="e.g. Main HDFC Current"
                    value={form.label}
                    onChange={(e) => handleChange("label", e.target.value)}
                    disabled={formLoading}
                    error={!!fieldErr("label")}
                  />
                </FormField>

                <FormField
                  label="Category"
                  required
                  error={fieldErr("category")}
                  hint={
                    editingId
                      ? "Category is fixed after creation to keep ledger tagging stable."
                      : undefined
                  }
                >
                  <Select
                    value={form.category}
                    onChange={(v) => handleChange("category", v)}
                    options={CATEGORY_OPTIONS}
                    disabled={formLoading || !!editingId}
                  />
                </FormField>

                {!editingId && (
                  <FormField
                    label="Opening balance"
                    error={fieldErr("openingBalance")}
                    hint="Non-negative, up to 2 decimals. Corrections after this go through the ledger — not by editing this number."
                  >
                    <Input
                      type="text"
                      inputMode="decimal"
                      name="openingBalance"
                      placeholder="0.00"
                      value={form.openingBalance}
                      onChange={(e) =>
                        handleChange("openingBalance", e.target.value)
                      }
                      disabled={formLoading}
                      error={!!fieldErr("openingBalance")}
                    />
                  </FormField>
                )}

                <FormField label="Bank name" error={fieldErr("bankName")}>
                  <Input
                    type="text"
                    name="bankName"
                    placeholder="e.g. HDFC Bank"
                    value={form.bankName}
                    onChange={(e) => handleChange("bankName", e.target.value)}
                    disabled={formLoading}
                    error={!!fieldErr("bankName")}
                  />
                </FormField>

                <FormField
                  label="Account number"
                  error={fieldErr("accountNumber")}
                >
                  <Input
                    type="text"
                    name="accountNumber"
                    value={form.accountNumber}
                    onChange={(e) =>
                      handleChange("accountNumber", e.target.value)
                    }
                    disabled={formLoading}
                    error={!!fieldErr("accountNumber")}
                  />
                </FormField>

                <FormField label="IFSC" error={fieldErr("ifsc")}>
                  <Input
                    type="text"
                    name="ifsc"
                    placeholder="e.g. HDFC0001234"
                    value={form.ifsc}
                    onChange={(e) =>
                      handleChange("ifsc", e.target.value.toUpperCase())
                    }
                    disabled={formLoading}
                    error={!!fieldErr("ifsc")}
                  />
                </FormField>

                <FormField label="UPI ID" error={fieldErr("upiId")}>
                  <Input
                    type="text"
                    name="upiId"
                    placeholder="e.g. foundation@upi"
                    value={form.upiId}
                    onChange={(e) => handleChange("upiId", e.target.value)}
                    disabled={formLoading}
                    error={!!fieldErr("upiId")}
                  />
                </FormField>

                <div className="md:col-span-2">
                  <FormField label="Notes" error={fieldErr("notes")}>
                    <Textarea
                      name="notes"
                      rows={2}
                      value={form.notes}
                      onChange={(e) => handleChange("notes", e.target.value)}
                      disabled={formLoading}
                      error={!!fieldErr("notes")}
                    />
                  </FormField>
                </div>

                <div className="md:col-span-2 flex flex-wrap items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                      checked={form.isDefault}
                      onChange={(e) =>
                        handleChange("isDefault", e.target.checked)
                      }
                      disabled={formLoading}
                    />
                    <span>Default for this category</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                      checked={form.isActive}
                      onChange={(e) =>
                        handleChange("isActive", e.target.checked)
                      }
                      disabled={formLoading}
                    />
                    <span>Active (available for posting)</span>
                  </label>
                </div>
              </form>
            </CardBody>
            <CardFooter className="justify-end gap-2">
              <Button
                variant="outline"
                onClick={resetForm}
                disabled={formLoading}
              >
                {editingId ? "Cancel" : "Clear"}
              </Button>
              <Button
                type="submit"
                form="bank-account-form"
                loading={formLoading}
              >
                {editingId ? "Update" : "Add Account"}
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* List + filters + pagination */}
        <Card className="relative overflow-hidden">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Accounts ({total})</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchAccounts}
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
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-64 shrink-0">
                <Input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search label / bank / account #"
                  leftIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
                />
              </div>
              <div className="w-40 shrink-0">
                <Select
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  options={CATEGORY_FILTER_OPTIONS}
                />
              </div>
              <div className="w-52 shrink-0">
                <Select
                  value={activeFilter}
                  onChange={setActiveFilter}
                  options={ACTIVE_FILTER_OPTIONS}
                />
              </div>
              {isSuperadmin && (
                <div className="w-52 shrink-0">
                  <Select
                    value={selectedFoundationId}
                    onChange={setSelectedFoundationId}
                    options={foundationFilterOptions}
                  />
                </div>
              )}
            </div>
          </CardHeader>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-foreground">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Label</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="w-56 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !isFetching ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10">
                      <EmptyState
                        icon={BanknotesIcon}
                        title="No bank accounts yet"
                        description="Add at least one General or CSR account before capturing donations or expenses — the ledger needs somewhere to post."
                      />
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const cat = CATEGORY_BADGE[item.category] || {
                      variant: "default",
                      label: item.category,
                    };
                    const details = item.upiId
                      ? item.upiId
                      : [item.bankName, item.accountNumber]
                          .filter(Boolean)
                          .join(" · ");
                    return (
                      <tr
                        key={item.id}
                        className="group border-t border-border hover:bg-muted/40"
                      >
                        <td className="px-4 py-2.5 font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            {item.isDefault && (
                              <StarSolidIcon
                                className="h-4 w-4 shrink-0 text-warning"
                                title="Default for this category"
                              />
                            )}
                            <span>{item.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant={cat.variant} size="sm">
                            {cat.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {details || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                          {formatMoney(item.balance)}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge
                            variant={item.isActive ? "success" : "warning"}
                            size="sm"
                          >
                            {item.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            {canManage && (
                              <>
                                {!item.isDefault && item.isActive && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleSetDefault(item)}
                                    title="Set as default"
                                    className="text-warning hover:bg-warning/10"
                                  >
                                    <StarIcon className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleToggleActive(item)}
                                  title={
                                    item.isActive ? "Deactivate" : "Reactivate"
                                  }
                                  className={
                                    item.isActive
                                      ? "text-muted-foreground hover:bg-muted"
                                      : "text-success hover:bg-success/10"
                                  }
                                >
                                  {item.isActive ? (
                                    <XCircleIcon className="h-4 w-4" />
                                  ) : (
                                    <CheckCircleIcon className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(item)}
                                  title="Edit"
                                >
                                  <PencilIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setConfirmDeleteId(item.id)}
                                  title="Delete"
                                  className="text-danger hover:bg-danger/10"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
            <span>
              Page {page} of {totalPages} · {total} total
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isFetching}
                aria-label="Previous page"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isFetching}
                aria-label="Next page"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={!!confirmDeleteId}
        onClose={() => !deleteLoading && setConfirmDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete bank account?"
        description={
          confirmDeleteTarget
            ? `Delete "${confirmDeleteTarget.label}"? This is refused if any donations or expenses reference it — deactivate the account instead.`
            : "Delete this bank account?"
        }
        confirmLabel="Delete"
        variant="danger"
        loading={deleteLoading}
      />
    </div>
  );
};

export default ManageBankAccounts;
