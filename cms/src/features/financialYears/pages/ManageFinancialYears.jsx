// src/features/financialYears/pages/ManageFinancialYears.jsx
//
// Financial-year workspace. Auto-creation on donation/expense capture handles
// the common case; this page exists so admins can pre-seed FYs, adjust the
// window (label + dates) on an ACTIVE year, and close/reopen years to lock
// down the ledger. Mirrors ManageExpenseCategories in structure — server-side
// pagination, inline field errors, ConfirmDialog on destructive actions —
// with two extra actions (Close / Reopen) and a Status badge column.
//
// Permissioning:
//   - Create / edit / delete / close → PERMISSIONS.FINANCIAL_YEAR_MANAGE
//   - Reopen → role must be ADMIN or SUPERADMIN (server enforces both)

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  PencilIcon,
  TrashIcon,
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LockClosedIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/outline";

import {
  closeFinancialYear,
  createFinancialYear,
  deleteFinancialYear,
  listFinancialYears,
  reopenFinancialYear,
  updateFinancialYear,
} from "../api";
import { listFoundations } from "../../foundations/api";
import { useAuth } from "../../../context/AuthContext";
import { useFinancialYear } from "../../../context/FinancialYearContext";
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
  Select,
  PageHeader,
  FormField,
  ConfirmDialog,
  EmptyState,
} from "../../../components/ui";

const EMPTY_FORM = { label: "", startDate: "", endDate: "" };
const PAGE_SIZE = 10;

// Backend stores DateTime; the <input type="date"> control speaks YYYY-MM-DD.
// Slice off the time portion when populating the edit form; the server
// z.coerce.date() accepts either format on the way back in.
const isoToDateInput = (iso) => (iso ? String(iso).slice(0, 10) : "");
const formatDateCell = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
};

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "CLOSED", label: "Closed" },
];

const ManageFinancialYears = () => {
  const { user } = useAuth();
  const { can } = usePermissions();
  const { refresh: refreshFyContext } = useFinancialYear();
  const isSuperadmin = user?.role === ROLES.SUPERADMIN;

  // Create / edit / delete / close all fold under this single grant. Reopen
  // requires the role check below so a demoted user can't undo a close.
  const canManage = can(PERMISSIONS.FINANCIAL_YEAR_MANAGE);
  const canReopen = user?.role === ROLES.ADMIN || user?.role === ROLES.SUPERADMIN;

  // List state.
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
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

  // Row-action confirmation dialogs. Kept separate so labels/tone stay clear.
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [confirmCloseId, setConfirmCloseId] = useState(null);
  const [closeLoading, setCloseLoading] = useState(false);
  const [confirmReopenId, setConfirmReopenId] = useState(null);
  const [reopenLoading, setReopenLoading] = useState(false);

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

  const fetchYears = useCallback(async () => {
    setIsFetching(true);
    try {
      const params = {
        page,
        pageSize: PAGE_SIZE,
        q: q.trim() || undefined,
        status: statusFilter || undefined,
      };
      if (isSuperadmin && selectedFoundationId) {
        params.foundationId = selectedFoundationId;
      }
      const res = await listFinancialYears(params);
      setItems(res?.items ?? []);
      setTotal(res?.total ?? 0);
      setTotalPages(res?.totalPages ?? 1);
    } catch (err) {
      console.error("Fetch financial years error:", err);
    } finally {
      setIsFetching(false);
    }
  }, [page, q, statusFilter, isSuperadmin, selectedFoundationId]);


  // Debounced refetch on any list-input change.
  useEffect(() => {
    const t = setTimeout(fetchYears, 300);
    return () => clearTimeout(t);
  }, [fetchYears]);

  // Snap back to page 1 when filters change.
  useEffect(() => {
    setPage(1);
  }, [q, statusFilter, selectedFoundationId]);

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

  // Trim label and ship raw YYYY-MM-DD strings — server z.coerce.date() handles
  // parsing. foundationId is only sent on create (SUPERADMIN); PATCH cannot
  // move a year between foundations.
  const buildPayload = () => {
    const out = {};
    const isUpdate = Boolean(editingId);
    out.label = form.label.trim();
    out.startDate = form.startDate;
    out.endDate = form.endDate;
    if (isSuperadmin && !isUpdate) out.foundationId = selectedFoundationId;
    return out;
  };

  const validateLocally = () => {
    const errs = {};
    const label = form.label.trim();
    if (label.length < 2) {
      errs.label = ["Label must be at least 2 characters"];
    } else if (label.length > 120) {
      errs.label = ["Label must be at most 120 characters"];
    }
    if (!form.startDate) errs.startDate = ["Start date is required"];
    if (!form.endDate) errs.endDate = ["End date is required"];
    if (form.startDate && form.endDate && form.startDate >= form.endDate) {
      errs.endDate = ["End date must be after start date"];
    }
    if (isSuperadmin && !editingId && !selectedFoundationId) {
      setFormError("Pick a foundation before creating a financial year.");
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
        await updateFinancialYear(editingId, payload);
        toast.success("Financial year updated.");
      } else {
        await createFinancialYear(payload);
        toast.success("Financial year created.");
      }
      resetForm();
      await Promise.all([fetchYears(), refreshFyContext()]);
    } catch (err) {
      const envelope = err.apiError;
      if (envelope?.details?.fieldErrors) {
        setFieldErrors(envelope.details.fieldErrors);
      }
      if (envelope?.message) setFormError(envelope.message);
      console.error("Save financial year error:", err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = (year) => {
    setForm({
      label: year.label || "",
      startDate: isoToDateInput(year.startDate),
      endDate: isoToDateInput(year.endDate),
    });
    setEditingId(year.id);
    setFieldErrors({});
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleteLoading(true);
    try {
      await deleteFinancialYear(confirmDeleteId);
      toast.info("Financial year deleted.");
      if (editingId === confirmDeleteId) resetForm();
      setConfirmDeleteId(null);
      await Promise.all([fetchYears(), refreshFyContext()]);
    } catch (err) {
      console.error("Delete financial year error:", err);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleClose = async () => {
    if (!confirmCloseId) return;
    setCloseLoading(true);
    try {
      await closeFinancialYear(confirmCloseId);
      toast.success("Financial year closed. New writes are blocked.");
      setConfirmCloseId(null);
      await Promise.all([fetchYears(), refreshFyContext()]);
    } catch (err) {
      console.error("Close financial year error:", err);
    } finally {
      setCloseLoading(false);
    }
  };

  const handleReopen = async () => {
    if (!confirmReopenId) return;
    setReopenLoading(true);
    try {
      await reopenFinancialYear(confirmReopenId);
      toast.success("Financial year reopened.");
      setConfirmReopenId(null);
      await Promise.all([fetchYears(), refreshFyContext()]);
    } catch (err) {
      console.error("Reopen financial year error:", err);
    } finally {
      setReopenLoading(false);
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
  const confirmCloseTarget =
    items.find((it) => it.id === confirmCloseId) || null;
  const confirmReopenTarget =
    items.find((it) => it.id === confirmReopenId) || null;

  return (
    <div>
      <PageHeader
        title="Financial Years"
        subtitle="Define fiscal windows so donations and expenses roll up correctly. Close a year to lock its ledger; reopen only when a correction is genuinely required."
      />

      <div className="space-y-6">
        {/* Create / Edit form — gated on financialYear:manage. */}
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>
                {editingId ? "Edit Financial Year" : "Add Financial Year"}
              </CardTitle>
            </CardHeader>
            <CardBody>
              {formError && (
                <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {formError}
                </div>
              )}

              <form
                id="financial-year-form"
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
                  <FormField label="Label" required error={fieldErr("label")}>
                    <Input
                      type="text"
                      name="label"
                      placeholder="e.g. FY 2025-26"
                      value={form.label}
                      onChange={(e) => handleChange("label", e.target.value)}
                      disabled={formLoading}
                      error={!!fieldErr("label")}
                    />
                  </FormField>
                </div>

                <FormField
                  label="Start date"
                  required
                  error={fieldErr("startDate")}
                >
                  <Input
                    type="date"
                    name="startDate"
                    value={form.startDate}
                    onChange={(e) => handleChange("startDate", e.target.value)}
                    disabled={formLoading}
                    error={!!fieldErr("startDate")}
                  />
                </FormField>

                <FormField
                  label="End date"
                  required
                  error={fieldErr("endDate")}
                  hint="Exclusive upper bound — typically the day after the last day of the year."
                >
                  <Input
                    type="date"
                    name="endDate"
                    value={form.endDate}
                    onChange={(e) => handleChange("endDate", e.target.value)}
                    disabled={formLoading}
                    error={!!fieldErr("endDate")}
                  />
                </FormField>
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
                form="financial-year-form"
                loading={formLoading}
              >
                {editingId ? "Update" : "Add Year"}
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* List + filters + pagination */}
        <Card className="relative overflow-hidden">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Years ({total})</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchYears}
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
                  placeholder="Search by label"
                  leftIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
                />
              </div>
              <div className="w-40 shrink-0">
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={STATUS_OPTIONS}
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
                  <th className="px-4 py-3">Window</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="w-52 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !isFetching ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10">
                      <EmptyState
                        icon={CalendarDaysIcon}
                        title="No financial years yet"
                        description="Add one above, or capture a donation/expense — the first write auto-creates a year based on your foundation's fiscal-year start month."
                      />
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const isClosed = item.status === "CLOSED";
                    return (
                      <tr
                        key={item.id}
                        className="group border-t border-border hover:bg-muted/40"
                      >
                        <td className="px-4 py-2.5 font-medium text-foreground">
                          {item.label}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {formatDateCell(item.startDate)} —{" "}
                          {formatDateCell(item.endDate)}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge
                            variant={isClosed ? "warning" : "success"}
                            size="sm"
                          >
                            {isClosed ? "Closed" : "Active"}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            {canManage && !isClosed && (
                              <>
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
                                  onClick={() => setConfirmCloseId(item.id)}
                                  title="Close year"
                                  className="text-warning hover:bg-warning/10"
                                >
                                  <LockClosedIcon className="h-4 w-4" />
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
                            {canReopen && isClosed && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmReopenId(item.id)}
                                leftIcon={
                                  <ArrowUturnLeftIcon className="h-4 w-4" />
                                }
                                className="text-success hover:bg-success/10"
                              >
                                Reopen
                              </Button>
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
        title="Delete financial year?"
        description={
          confirmDeleteTarget
            ? `Delete "${confirmDeleteTarget.label}"? This is blocked if any donations or expenses still fall inside the window.`
            : "Delete this financial year?"
        }
        confirmLabel="Delete"
        variant="danger"
        loading={deleteLoading}
      />
      <ConfirmDialog
        open={!!confirmCloseId}
        onClose={() => !closeLoading && setConfirmCloseId(null)}
        onConfirm={handleClose}
        title="Close financial year?"
        description={
          confirmCloseTarget
            ? `Closing "${confirmCloseTarget.label}" locks its ledger — new donations, expenses, edits, and deletes inside this window will be refused. A reopen requires ADMIN or SUPERADMIN.`
            : "Close this financial year?"
        }
        confirmLabel="Close year"
        variant="warning"
        loading={closeLoading}
      />
      <ConfirmDialog
        open={!!confirmReopenId}
        onClose={() => !reopenLoading && setConfirmReopenId(null)}
        onConfirm={handleReopen}
        title="Reopen financial year?"
        description={
          confirmReopenTarget
            ? `Reopen "${confirmReopenTarget.label}"? Writes inside this window will be accepted again. This is audited.`
            : "Reopen this financial year?"
        }
        confirmLabel="Reopen"
        variant="primary"
        loading={reopenLoading}
      />
    </div>
  );
};

export default ManageFinancialYears;
