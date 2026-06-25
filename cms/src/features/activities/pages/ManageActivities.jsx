// src/features/activities/pages/ManageActivities.jsx
//
// Activity workspace. Narrative log of what the foundation does with the
// money — title, description, location, dates, lifecycle status. No money
// fields by design; Phase 2 will introduce budgets/transactions linked to
// activities. Server-side pagination + debounced search, soft delete with
// restore, inline field errors. ADMIN/EMPLOYEE are scoped server-side;
// SUPERADMIN gets a foundation picker for create + a list filter.

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
  ClipboardDocumentListIcon,
} from "@heroicons/react/24/outline";

import {
  createActivity,
  deleteActivity,
  listActivities,
  restoreActivity,
  updateActivity,
} from "../api";
import { listFoundations } from "../../foundations/api";
import { useAuth } from "../../../context/AuthContext";
import { usePermissions } from "../../../hooks/usePermissions";
import { ROLES } from "../../../constants/roles";
import { PERMISSIONS } from "../../../constants/permissions";
import Can from "../../../components/Can";
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
  Badge,
  PageHeader,
  FormField,
  ConfirmDialog,
  EmptyState,
  Spinner,
} from "../../../components/ui";

const ACTIVITY_STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

const STATUS_LABELS = {
  PLANNED: "Planned",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_VARIANTS = {
  PLANNED: "outline",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  CANCELLED: "danger",
};

const EMPTY_FORM = {
  title: "",
  description: "",
  status: "PLANNED",
  location: "",
  startDate: "",
  endDate: "",
};

const PAGE_SIZE = 10;

// Format an ISO date string for an <input type="date"> value (yyyy-mm-dd).
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

const ManageActivities = () => {
  const { user } = useAuth();
  const { can } = usePermissions();
  const isSuperadmin = user?.role === ROLES.SUPERADMIN;

  // List state.
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
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

  // Permission shortcuts — the form/actions hide when not allowed.
  const canCreate = can(PERMISSIONS.ACTIVITY_CREATE);
  const canUpdate = can(PERMISSIONS.ACTIVITY_UPDATE);
  const canDelete = can(PERMISSIONS.ACTIVITY_DELETE);
  const canWriteAny = canCreate || canUpdate;

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

  const fetchActivities = useCallback(async () => {
    setIsFetching(true);
    try {
      const params = {
        page,
        pageSize: PAGE_SIZE,
        q: q.trim() || undefined,
        status: statusFilter || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
        includeDeleted: includeDeleted || undefined,
      };
      if (isSuperadmin && selectedFoundationId) {
        params.foundationId = selectedFoundationId;
      }
      const res = await listActivities(params);
      setItems(res?.items ?? []);
      setTotal(res?.total ?? 0);
      setTotalPages(res?.totalPages ?? 1);
    } catch (err) {
      console.error("Fetch activities error:", err);
    } finally {
      setIsFetching(false);
    }
  }, [
    page,
    q,
    statusFilter,
    from,
    to,
    includeDeleted,
    isSuperadmin,
    selectedFoundationId,
  ]);

  // Debounced refetch on any list-input change.
  useEffect(() => {
    const t = setTimeout(fetchActivities, 300);
    return () => clearTimeout(t);
  }, [fetchActivities]);

  // Snap back to page 1 when filters change.
  useEffect(() => {
    setPage(1);
  }, [q, statusFilter, from, to, includeDeleted, selectedFoundationId]);

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

  // Strip empty strings so backend optional() fields are truly absent on
  // create. On update, send explicit null for cleared fields so the server
  // overwrites them (description / location / dates are nullable on PATCH).
  const buildPayload = () => {
    const out = {};
    const isUpdate = Boolean(editingId);
    const setMaybeNull = (key, value) => {
      const trimmed = typeof value === "string" ? value.trim() : value;
      if (trimmed) out[key] = trimmed;
      else if (isUpdate) out[key] = null;
    };
    out.title = form.title.trim();
    out.status = form.status || "PLANNED";
    setMaybeNull("description", form.description);
    setMaybeNull("location", form.location);
    out.startDate = form.startDate
      ? new Date(form.startDate).toISOString()
      : isUpdate
      ? null
      : undefined;
    out.endDate = form.endDate
      ? new Date(form.endDate).toISOString()
      : isUpdate
      ? null
      : undefined;
    if (out.startDate === undefined) delete out.startDate;
    if (out.endDate === undefined) delete out.endDate;
    if (isSuperadmin && !isUpdate) out.foundationId = selectedFoundationId;
    return out;
  };

  const validateLocally = () => {
    const errs = {};
    if (!form.title.trim() || form.title.trim().length < 2) {
      errs.title = ["Title must be at least 2 characters"];
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      errs.endDate = ["End date must be on or after start date"];
    }
    if (isSuperadmin && !editingId && !selectedFoundationId) {
      setFormError("Pick a foundation before creating an activity.");
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
        await updateActivity(editingId, payload);
        toast.success("Activity updated.");
      } else {
        await createActivity(payload);
        toast.success("Activity created.");
      }
      resetForm();
      await fetchActivities();
    } catch (err) {
      const envelope = err.apiError;
      if (envelope?.details?.fieldErrors) {
        setFieldErrors(envelope.details.fieldErrors);
      }
      if (envelope?.message) setFormError(envelope.message);
      console.error("Save activity error:", err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = (activity) => {
    setForm({
      title: activity.title || "",
      description: activity.description || "",
      status: activity.status || "PLANNED",
      location: activity.location || "",
      startDate: toDateInputValue(activity.startDate),
      endDate: toDateInputValue(activity.endDate),
    });
    setEditingId(activity.id);
    setFieldErrors({});
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleteLoading(true);
    try {
      await deleteActivity(confirmDeleteId);
      toast.info("Activity deleted.");
      if (editingId === confirmDeleteId) resetForm();
      setConfirmDeleteId(null);
      await fetchActivities();
    } catch (err) {
      console.error("Delete activity error:", err);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRestore = async (id) => {
    try {
      await restoreActivity(id);
      toast.success("Activity restored.");
      await fetchActivities();
    } catch (err) {
      console.error("Restore activity error:", err);
    }
  };

  const fieldErr = (name) => fieldErrors?.[name]?.[0];

  const statusOptions = [
    { value: "", label: "All statuses" },
    ...ACTIVITY_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
  ];
  const formStatusOptions = ACTIVITY_STATUSES.map((s) => ({
    value: s,
    label: STATUS_LABELS[s],
  }));
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
        title="Activities"
        subtitle="Track what the foundation is doing with the money — programs, campaigns, and field operations."
      />

      <div className="space-y-6">
        {/* Create / Edit form — gated on activity:create or activity:update. */}
        {canWriteAny && (
          <Card>
            <CardHeader>
              <CardTitle>
                {editingId ? "Edit Activity" : "Add Activity"}
              </CardTitle>
            </CardHeader>
            <CardBody>
              {formError && (
                <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {formError}
                </div>
              )}

              <form
                id="activity-form"
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
                  <FormField label="Title" required error={fieldErr("title")}>
                    <Input
                      type="text"
                      name="title"
                      placeholder="e.g. Flood Relief Bihar Oct'26"
                      value={form.title}
                      onChange={(e) => handleChange("title", e.target.value)}
                      disabled={formLoading}
                      error={!!fieldErr("title")}
                    />
                  </FormField>
                </div>

                <div className="md:col-span-2">
                  <FormField
                    label="Description"
                    error={fieldErr("description")}
                    hint="What's being done, who it serves, expected outcomes."
                  >
                    <Textarea
                      name="description"
                      rows={4}
                      placeholder="Optional narrative…"
                      value={form.description}
                      onChange={(e) =>
                        handleChange("description", e.target.value)
                      }
                      disabled={formLoading}
                      error={!!fieldErr("description")}
                    />
                  </FormField>
                </div>

                <FormField label="Status" error={fieldErr("status")}>
                  <Select
                    value={form.status}
                    onChange={(v) => handleChange("status", v)}
                    options={formStatusOptions}
                    disabled={formLoading}
                  />
                </FormField>
                <FormField label="Location" error={fieldErr("location")}>
                  <Input
                    type="text"
                    name="location"
                    placeholder="e.g. Bareilly, Uttar Pradesh"
                    value={form.location}
                    onChange={(e) => handleChange("location", e.target.value)}
                    disabled={formLoading}
                    error={!!fieldErr("location")}
                  />
                </FormField>

                <FormField label="Start date" error={fieldErr("startDate")}>
                  <Input
                    type="date"
                    name="startDate"
                    value={form.startDate}
                    onChange={(e) => handleChange("startDate", e.target.value)}
                    disabled={formLoading}
                    error={!!fieldErr("startDate")}
                  />
                </FormField>
                <FormField label="End date" error={fieldErr("endDate")}>
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
              <Button type="submit" form="activity-form" loading={formLoading}>
                {editingId ? "Update Activity" : "Add Activity"}
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* List + filters + pagination */}
        <Card className="relative overflow-hidden">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Activities ({total})</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchActivities}
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
                  placeholder="Search title or location"
                  leftIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
                />
              </div>
              <div className="w-44 shrink-0">
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={statusOptions}
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
              <div className="w-40 shrink-0">
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  title="From date"
                />
              </div>
              <div className="w-40 shrink-0">
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  title="To date"
                />
              </div>
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
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Start</th>
                  <th className="px-4 py-3">End</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="w-32 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !isFetching ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10">
                      <EmptyState
                        icon={ClipboardDocumentListIcon}
                        title="No activities yet"
                        description="Activities logged here will appear in this list. Use the form above to add your first one."
                      />
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr
                      key={item.id}
                      className="group border-t border-border hover:bg-muted/40"
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-foreground">
                          {item.title}
                        </div>
                        {item.description && (
                          <div className="line-clamp-1 text-xs text-muted-foreground">
                            {item.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={STATUS_VARIANTS[item.status] || "default"}>
                          {STATUS_LABELS[item.status] || item.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">
                        {item.location || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {formatDateCell(item.startDate)}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {formatDateCell(item.endDate)}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {formatDateCell(item.createdAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        {item.isDeleted ? (
                          <Can perm={PERMISSIONS.ACTIVITY_UPDATE}>
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
                          </Can>
                        ) : (
                          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            {canUpdate && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(item)}
                                title="Edit"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setConfirmDeleteId(item.id)}
                                title="Delete"
                                className="text-danger hover:bg-danger/10"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
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
        title="Delete activity?"
        description={
          confirmTarget
            ? `Soft-delete "${confirmTarget.title}"? You can restore it later from the "Show deleted" filter.`
            : "Soft-delete this activity? You can restore it later."
        }
        confirmLabel="Delete"
        variant="danger"
        loading={deleteLoading}
      />
    </div>
  );
};

export default ManageActivities;
