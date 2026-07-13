// src/features/expenses/pages/ManageExpenseCategories.jsx
//
// Expense category workspace. Categories bucket expenses (e.g. "Salaries",
// "Utilities", "Field supplies") so reporting can slice foundation spend.
// Mirrors ManageActivities: server-side pagination + debounced search,
// soft delete with restore, inline field errors. ADMIN/EMPLOYEE are scoped
// server-side; SUPERADMIN gets a foundation picker for create + list filter.

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  PencilIcon,
  TrashIcon,
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  TagIcon,
} from "@heroicons/react/24/outline";

import {
  createExpenseCategory,
  deleteExpenseCategory,
  listExpenseCategories,
  restoreExpenseCategory,
  updateExpenseCategory,
} from "../api";
import { listFoundations } from "../../foundations/api";
import { useAuth } from "../../../context/AuthContext";
import { usePermissions } from "../../../hooks/usePermissions";
import { ROLES } from "../../../constants/roles";
import { PERMISSIONS } from "../../../constants/permissions";
import {
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

const EMPTY_FORM = { name: "", description: "" };
const PAGE_SIZE = 10;

const formatDateCell = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
};

const ManageExpenseCategories = () => {
  const { user } = useAuth();
  const { can } = usePermissions();
  const isSuperadmin = user?.role === ROLES.SUPERADMIN;

  // List state.
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [q, setQ] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  // Form state.
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // SUPERADMIN-only foundation picker (doubles as a list filter).
  const [foundations, setFoundations] = useState([]);
  const [selectedFoundationId, setSelectedFoundationId] = useState("");

  // Delete confirmation dialog state.
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Any of these implies at least the manage permission — the form + row
  // actions all fold under expenseCategory:manage on the backend.
  const canManage = can(PERMISSIONS.EXPENSE_CATEGORY_MANAGE);

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

  const fetchCategories = useCallback(async () => {
    setIsFetching(true);
    try {
      const params = {
        page,
        pageSize: PAGE_SIZE,
        q: q.trim() || undefined,
        includeDeleted: includeDeleted || undefined,
      };
      if (isSuperadmin && selectedFoundationId) {
        params.foundationId = selectedFoundationId;
      }
      const res = await listExpenseCategories(params);
      setItems(res?.items ?? []);
      setTotal(res?.total ?? 0);
      setTotalPages(res?.totalPages ?? 1);
    } catch (err) {
      console.error("Fetch expense categories error:", err);
    } finally {
      setIsFetching(false);
    }
  }, [page, q, includeDeleted, isSuperadmin, selectedFoundationId]);

  // Debounced refetch on any list-input change.
  useEffect(() => {
    const t = setTimeout(fetchCategories, 300);
    return () => clearTimeout(t);
  }, [fetchCategories]);

  // Snap back to page 1 when filters change.
  useEffect(() => {
    setPage(1);
  }, [q, includeDeleted, selectedFoundationId]);

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

  // Strip empty strings on create so backend optional fields are truly absent.
  // On update, send explicit null for cleared description so the server clears
  // it (description is nullable on PATCH).
  const buildPayload = () => {
    const out = {};
    const isUpdate = Boolean(editingId);
    out.name = form.name.trim();
    const desc = form.description.trim();
    if (desc) out.description = desc;
    else if (isUpdate) out.description = null;
    if (isSuperadmin && !isUpdate) out.foundationId = selectedFoundationId;
    return out;
  };

  const validateLocally = () => {
    const errs = {};
    const name = form.name.trim();
    if (name.length < 2) {
      errs.name = ["Name must be at least 2 characters"];
    } else if (name.length > 120) {
      errs.name = ["Name must be at most 120 characters"];
    }
    if (isSuperadmin && !editingId && !selectedFoundationId) {
      setFormError("Pick a foundation before creating a category.");
      return false;
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
        delete payload.foundationId;
        await updateExpenseCategory(editingId, payload);
        toast.success("Category updated.");
      } else {
        await createExpenseCategory(payload);
        toast.success("Category created.");
      }
      resetForm();
      await fetchCategories();
    } catch (err) {
      const envelope = err.apiError;
      if (envelope?.details?.fieldErrors) {
        setFieldErrors(envelope.details.fieldErrors);
      }
      if (envelope?.message) setFormError(envelope.message);
      console.error("Save expense category error:", err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = (category) => {
    setForm({
      name: category.name || "",
      description: category.description || "",
    });
    setEditingId(category.id);
    setFieldErrors({});
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleteLoading(true);
    try {
      await deleteExpenseCategory(confirmDeleteId);
      toast.info("Category deleted.");
      if (editingId === confirmDeleteId) resetForm();
      setConfirmDeleteId(null);
      await fetchCategories();
    } catch (err) {
      console.error("Delete expense category error:", err);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRestore = async (id) => {
    try {
      await restoreExpenseCategory(id);
      toast.success("Category restored.");
      await fetchCategories();
    } catch (err) {
      console.error("Restore expense category error:", err);
    }
  };

  const fieldErr = (name) => fieldErrors?.[name]?.[0];

  const foundationOptions = [
    { value: "", label: "— Select a foundation —" },
    ...foundations.map((f) => ({
      value: f.id,
      label: `${f.name} (${f.pan})`,
    })),
  ];
  const foundationFilterOptions = [
    { value: "", label: "All foundations" },
    ...foundations.map((f) => ({ value: f.id, label: f.name })),
  ];

  const confirmTarget = items.find((it) => it.id === confirmDeleteId) || null;

  return (
    <div>
      <PageHeader
        title="Expense Categories"
        subtitle="Bucket foundation spending — salaries, utilities, field supplies. Categories power expense reports."
      />

      <div className="space-y-6">
        {/* Create / Edit form — gated on expenseCategory:manage. */}
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>
                {editingId ? "Edit Category" : "Add Category"}
              </CardTitle>
            </CardHeader>
            <CardBody>
              {formError && (
                <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {formError}
                </div>
              )}

              <form
                id="expense-category-form"
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

                <div className="md:col-span-2">
                  <FormField label="Name" required error={fieldErr("name")}>
                    <Input
                      type="text"
                      name="name"
                      placeholder="e.g. Salaries, Utilities, Field supplies"
                      value={form.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      disabled={formLoading}
                      error={!!fieldErr("name")}
                    />
                  </FormField>
                </div>

                <div className="md:col-span-2">
                  <FormField
                    label="Description"
                    error={fieldErr("description")}
                    hint="Optional context so employees pick the right bucket."
                  >
                    <Textarea
                      name="description"
                      rows={3}
                      placeholder="Optional description…"
                      value={form.description}
                      onChange={(e) =>
                        handleChange("description", e.target.value)
                      }
                      disabled={formLoading}
                      error={!!fieldErr("description")}
                    />
                  </FormField>
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
                form="expense-category-form"
                loading={formLoading}
              >
                {editingId ? "Update Category" : "Add Category"}
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* List + filters + pagination */}
        <Card className="relative overflow-hidden">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Categories ({total})</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchCategories}
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
                  placeholder="Search name or description"
                  leftIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
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
              <label className="flex h-9 shrink-0 items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={includeDeleted}
                  onChange={(e) => setIncludeDeleted(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                Show deleted
              </label>
            </div>
          </CardHeader>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-foreground">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="w-32 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !isFetching ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10">
                      <EmptyState
                        icon={TagIcon}
                        title="No categories yet"
                        description="Create your first category above so expenses can be bucketed for reporting."
                      />
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr
                      key={item.id}
                      className="group border-t border-border hover:bg-muted/40"
                    >
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        {item.name}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">
                        <span className="line-clamp-1">
                          {item.description || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {formatDateCell(item.createdAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        {item.isDeleted ? (
                          canManage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRestore(item.id)}
                              leftIcon={
                                <ArrowUturnLeftIcon className="h-4 w-4" />
                              }
                              className="text-success hover:bg-success/10"
                            >
                              Restore
                            </Button>
                          )
                        ) : (
                          canManage && (
                            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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
                            </div>
                          )
                        )}
                      </td>
                    </tr>
                  ))
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
        title="Delete category?"
        description={
          confirmTarget
            ? `Soft-delete "${confirmTarget.name}"? You can restore it later from the "Show deleted" filter. This is blocked if any active expenses still reference it.`
            : "Soft-delete this category? You can restore it later."
        }
        confirmLabel="Delete"
        variant="danger"
        loading={deleteLoading}
      />
    </div>
  );
};

export default ManageExpenseCategories;
