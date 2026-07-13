// src/pages/ManageAdmins.jsx
//
// SUPERADMIN console for foundation staff (ADMIN users). Server-side paging,
// foundation filter, soft-delete/restore, and password reset via PATCH.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  PencilIcon,
  TrashIcon,
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  KeyIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

import {
  createAdmin,
  deleteAdmin,
  listAdmins,
  restoreAdmin,
  updateAdmin,
} from "../api";
import { listFoundations } from "../../foundations/api";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  FormField,
  Input,
  PageHeader,
  Select,
  Spinner,
} from "../../../components/ui";

const EMPTY_FORM = {
  email: "",
  password: "",
  fullName: "",
  username: "",
  foundationId: "",
  isActive: true,
};

const PAGE_SIZE = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ManageAdmins = () => {
  // Foundations for the dropdown filter and form select.
  const [foundations, setFoundations] = useState([]);

  // List state.
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [q, setQ] = useState("");
  const [foundationFilter, setFoundationFilter] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  // Form state.
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // Confirm-delete state — id of the item awaiting confirmation, plus a
  // loading flag so the dialog button shows a spinner during the request.
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Load all active foundations once for the dropdowns.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listFoundations({ page: 1, pageSize: 100 });
        if (!cancelled) setFoundations(res?.items ?? []);
      } catch (err) {
        console.error("Load foundations error:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const foundationMap = useMemo(() => {
    const map = new Map();
    foundations.forEach((f) => map.set(f.id, f));
    return map;
  }, [foundations]);

  const fetchList = useCallback(async () => {
    setIsFetching(true);
    try {
      const res = await listAdmins({
        page,
        pageSize: PAGE_SIZE,
        q: q.trim() || undefined,
        foundationId: foundationFilter || undefined,
        includeDeleted: includeDeleted || undefined,
      });
      setItems(res?.items ?? []);
      setTotal(res?.total ?? 0);
      setTotalPages(res?.totalPages ?? 1);
    } catch (err) {
      console.error("Fetch admins error:", err);
    } finally {
      setIsFetching(false);
    }
  }, [page, q, foundationFilter, includeDeleted]);

  useEffect(() => {
    const t = setTimeout(fetchList, 300);
    return () => clearTimeout(t);
  }, [fetchList]);

  useEffect(() => {
    setPage(1);
  }, [q, foundationFilter, includeDeleted]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFieldErrors({});
    setFormError("");
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const next = type === "checkbox" ? checked : value;
    setForm((prev) => ({ ...prev, [name]: next }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const buildCreatePayload = () => {
    const out = {
      email: form.email.trim().toLowerCase(),
      password: form.password,
      fullName: form.fullName.trim(),
      foundationId: form.foundationId,
      isActive: !!form.isActive,
    };
    if (form.username.trim()) out.username = form.username.trim();
    return out;
  };

  const buildUpdatePayload = () => {
    const out = {};
    if (form.fullName.trim()) out.fullName = form.fullName.trim();
    out.username = form.username.trim() ? form.username.trim() : null;
    if (form.foundationId) out.foundationId = form.foundationId;
    out.isActive = !!form.isActive;
    if (form.password) out.password = form.password;
    return out;
  };

  const validateLocally = () => {
    const errs = {};
    if (!form.fullName.trim() || form.fullName.trim().length < 2) {
      errs.fullName = ["Full name must be at least 2 characters"];
    }
    if (form.username && form.username.trim() && form.username.trim().length < 3) {
      errs.username = ["Username must be at least 3 characters"];
    }
    if (!editingId) {
      if (!EMAIL_REGEX.test(form.email.trim())) {
        errs.email = ["Enter a valid email address"];
      }
      if (!form.password || form.password.length < 8) {
        errs.password = ["Password must be at least 8 characters"];
      }
      if (!form.foundationId) {
        errs.foundationId = ["Select a foundation"];
      }
    } else if (form.password && form.password.length < 8) {
      errs.password = ["Password must be at least 8 characters"];
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
      if (editingId) {
        await updateAdmin(editingId, buildUpdatePayload());
        toast.success("Admin updated.");
      } else {
        await createAdmin(buildCreatePayload());
        toast.success("Admin created.");
      }
      resetForm();
      await fetchList();
    } catch (err) {
      const envelope = err.apiError;
      if (envelope?.details?.fieldErrors) {
        setFieldErrors(envelope.details.fieldErrors);
      }
      if (envelope?.message) setFormError(envelope.message);
      console.error("Save admin error:", err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = (item) => {
    setForm({
      email: item.email || "",
      password: "",
      fullName: item.fullName || "",
      username: item.username || "",
      foundationId: item.foundationId || "",
      isActive: item.isActive !== false,
    });
    setEditingId(item.id);
    setFieldErrors({});
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmDeleteId) return;
    setDeleteLoading(true);
    try {
      await deleteAdmin(confirmDeleteId);
      toast.info("Admin deleted.");
      if (editingId === confirmDeleteId) resetForm();
      await fetchList();
    } catch (err) {
      console.error("Delete admin error:", err);
    } finally {
      setDeleteLoading(false);
      setConfirmDeleteId(null);
    }
  };

  const handleRestore = async (id) => {
    try {
      await restoreAdmin(id);
      toast.success("Admin restored.");
      await fetchList();
    } catch (err) {
      console.error("Restore admin error:", err);
    }
  };

  const fieldErr = (name) => fieldErrors?.[name]?.[0];

  const foundationOptions = foundations.map((f) => ({
    value: f.id,
    label: f.name,
    description: f.pan || undefined,
  }));

  const confirmTarget = items.find((it) => it.id === confirmDeleteId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Admins"
        subtitle="Provision foundation administrators and reset their credentials."
      />

      {/* Create / Edit form */}
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edit Admin" : "Add Admin"}</CardTitle>
        </CardHeader>
        <CardBody>
          {formError && (
            <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">
              {formError}
            </div>
          )}

          <form
            id="admin-form"
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <FormField
              label="Email"
              required
              error={fieldErr("email")}
              hint={editingId ? "Email cannot be changed." : undefined}
            >
              <Input
                type="email"
                name="email"
                placeholder="admin@foundation.org"
                value={form.email}
                onChange={handleChange}
                disabled={formLoading || !!editingId}
                autoComplete="off"
                error={!!fieldErr("email")}
              />
            </FormField>
            <FormField label="Full name" required error={fieldErr("fullName")}>
              <Input
                type="text"
                name="fullName"
                placeholder="Jane Doe"
                value={form.fullName}
                onChange={handleChange}
                disabled={formLoading}
                error={!!fieldErr("fullName")}
              />
            </FormField>
            <FormField label="Username" error={fieldErr("username")}>
              <Input
                type="text"
                name="username"
                placeholder="Optional"
                value={form.username}
                onChange={handleChange}
                disabled={formLoading}
                error={!!fieldErr("username")}
              />
            </FormField>
            <FormField
              label="Foundation"
              required
              error={fieldErr("foundationId")}
            >
              <Select
                name="foundationId"
                value={form.foundationId}
                onChange={(v) => {
                  setForm((prev) => ({ ...prev, foundationId: v }));
                  setFieldErrors((prev) => ({ ...prev, foundationId: undefined }));
                }}
                options={foundationOptions}
                placeholder="Select foundation"
                disabled={formLoading}
                error={!!fieldErr("foundationId")}
              />
            </FormField>
            <div className="md:col-span-2">
              <FormField
                label={editingId ? "New password" : "Password"}
                required={!editingId}
                error={fieldErr("password")}
                hint={
                  editingId
                    ? "Leave blank to keep current password."
                    : "Minimum 8 characters."
                }
              >
                <Input
                  type="password"
                  name="password"
                  placeholder={
                    editingId ? "Leave blank to keep current" : "Password"
                  }
                  value={form.password}
                  onChange={handleChange}
                  disabled={formLoading}
                  autoComplete="new-password"
                  leftIcon={<KeyIcon className="h-4 w-4" />}
                  error={!!fieldErr("password")}
                />
              </FormField>
            </div>
            <label className="md:col-span-2 flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                name="isActive"
                checked={form.isActive}
                onChange={handleChange}
                disabled={formLoading}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              Active
            </label>
          </form>
        </CardBody>
        <CardFooter className="justify-end gap-2">
          <Button variant="outline" onClick={resetForm} disabled={formLoading}>
            {editingId ? "Cancel" : "Clear"}
          </Button>
          <Button type="submit" form="admin-form" loading={formLoading}>
            {editingId ? "Update Admin" : "Add Admin"}
          </Button>
        </CardFooter>
      </Card>

      {/* List + filters + pagination */}
      <Card className="relative overflow-hidden">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Admins ({total})</CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search email or name"
                className="w-56"
              />
              <Select
                value={foundationFilter}
                onChange={(v) => setFoundationFilter(v)}
                options={[
                  { value: "", label: "All foundations" },
                  ...foundationOptions,
                ]}
                placeholder="All foundations"
                className="w-48"
              />
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={includeDeleted}
                  onChange={(e) => setIncludeDeleted(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                Show deleted
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchList}
                disabled={isFetching}
                leftIcon={
                  <ArrowPathIcon
                    className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
                  />
                }
              >
                {isFetching ? "Loading…" : "Reload"}
              </Button>
            </div>
          </div>
        </CardHeader>

        {isFetching && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/70 backdrop-blur-sm">
            <Spinner size="lg" />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-foreground">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Foundation</th>
                <th className="px-4 py-3">Status</th>
                <th className="w-32 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !isFetching ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No admins match the current filters.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.id}
                    className="group border-t border-border hover:bg-muted/40"
                  >
                    <td className="px-4 py-2.5">{item.fullName}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {item.email}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {foundationMap.get(item.foundationId)?.name ||
                        item.foundationId ||
                        "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {item.isDeleted ? (
                        <Badge variant="danger">Deleted</Badge>
                      ) : item.isActive ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="default">Inactive</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {item.isDeleted ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRestore(item.id)}
                          leftIcon={<ArrowUturnLeftIcon className="h-4 w-4" />}
                          className="text-success hover:bg-success/10"
                        >
                          Restore
                        </Button>
                      ) : (
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

      <ConfirmDialog
        open={!!confirmDeleteId}
        onClose={() => !deleteLoading && setConfirmDeleteId(null)}
        onConfirm={handleDeleteConfirmed}
        title="Delete admin?"
        description={
          confirmTarget
            ? `Soft-delete "${confirmTarget.fullName || confirmTarget.email}"? They can be restored later from the "Show deleted" filter.`
            : "Soft-delete this admin? They can be restored later."
        }
        confirmLabel="Delete"
        variant="danger"
        loading={deleteLoading}
      />
    </div>
  );
};

export default ManageAdmins;
