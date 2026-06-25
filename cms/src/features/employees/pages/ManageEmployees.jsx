// src/features/employees/pages/ManageEmployees.jsx
//
// ADMIN/SUPERADMIN console for foundation EMPLOYEE users. Mirrors ManageAdmins
// but adds the permissions checkbox grid (PERMISSION_GROUPS) so each employee
// gets a tailored set of granular abilities (donor/donation/report/dashboard).
// SUPERADMIN sees a foundation picker; for ADMIN the foundation is implicit
// from the auth token and the picker is hidden.

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
  createEmployee,
  deleteEmployee,
  listEmployees,
  restoreEmployee,
  updateEmployee,
} from "../api";
import { listFoundations } from "../../foundations/api";
import { useAuth } from "../../../context/AuthContext";
import { ROLES } from "../../../constants/roles";
import { PERMISSION_GROUPS } from "../../../constants/permissions";
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
  permissions: [],
  isActive: true,
};

const PAGE_SIZE = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ManageEmployees = () => {
  const { user } = useAuth();
  const isSuperadmin = user?.role === ROLES.SUPERADMIN;

  // Foundations dropdown (SUPERADMIN only).
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

  // Confirm-delete.
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (!isSuperadmin) return;
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
  }, [isSuperadmin]);

  const foundationMap = useMemo(() => {
    const map = new Map();
    foundations.forEach((f) => map.set(f.id, f));
    return map;
  }, [foundations]);

  const foundationOptions = foundations.map((f) => ({
    value: f.id,
    label: f.name,
    description: f.pan || undefined,
  }));

  const fetchList = useCallback(async () => {
    setIsFetching(true);
    try {
      const res = await listEmployees({
        page,
        pageSize: PAGE_SIZE,
        q: q.trim() || undefined,
        foundationId: (isSuperadmin && foundationFilter) || undefined,
        includeDeleted: includeDeleted || undefined,
      });
      setItems(res?.items ?? []);
      setTotal(res?.total ?? 0);
      setTotalPages(res?.totalPages ?? 1);
    } catch (err) {
      console.error("Fetch employees error:", err);
    } finally {
      setIsFetching(false);
    }
  }, [page, q, foundationFilter, includeDeleted, isSuperadmin]);

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

  const togglePermission = (key) => {
    setForm((prev) => {
      const has = prev.permissions.includes(key);
      return {
        ...prev,
        permissions: has
          ? prev.permissions.filter((p) => p !== key)
          : [...prev.permissions, key],
      };
    });
    setFieldErrors((prev) => ({ ...prev, permissions: undefined }));
  };

  const buildCreatePayload = () => {
    const out = {
      email: form.email.trim().toLowerCase(),
      password: form.password,
      fullName: form.fullName.trim(),
      permissions: form.permissions,
      isActive: !!form.isActive,
    };
    if (form.username.trim()) out.username = form.username.trim();
    if (isSuperadmin && form.foundationId) out.foundationId = form.foundationId;
    return out;
  };

  const buildUpdatePayload = () => {
    const out = {};
    if (form.fullName.trim()) out.fullName = form.fullName.trim();
    out.username = form.username.trim() ? form.username.trim() : null;
    out.permissions = form.permissions;
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
      if (isSuperadmin && !form.foundationId) {
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
        await updateEmployee(editingId, buildUpdatePayload());
        toast.success("Employee updated.");
      } else {
        await createEmployee(buildCreatePayload());
        toast.success("Employee created.");
      }
      resetForm();
      await fetchList();
    } catch (err) {
      const envelope = err.apiError;
      if (envelope?.details?.fieldErrors) {
        setFieldErrors(envelope.details.fieldErrors);
      }
      if (envelope?.message) setFormError(envelope.message);
      console.error("Save employee error:", err);
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
      permissions: Array.isArray(item.permissions) ? [...item.permissions] : [],
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
      await deleteEmployee(confirmDeleteId);
      toast.info("Employee deleted.");
      if (editingId === confirmDeleteId) resetForm();
      await fetchList();
    } catch (err) {
      console.error("Delete employee error:", err);
    } finally {
      setDeleteLoading(false);
      setConfirmDeleteId(null);
    }
  };

  const handleRestore = async (id) => {
    try {
      await restoreEmployee(id);
      toast.success("Employee restored.");
      await fetchList();
    } catch (err) {
      console.error("Restore employee error:", err);
    }
  };

  const fieldErr = (name) => fieldErrors?.[name]?.[0];
  const confirmTarget = items.find((it) => it.id === confirmDeleteId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Employees"
        subtitle="Create foundation staff and tailor each user's granular permissions."
      />

      {/* Create / Edit form */}
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edit Employee" : "Add Employee"}</CardTitle>
        </CardHeader>
        <CardBody>
          {formError && (
            <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">
              {formError}
            </div>
          )}

          <form
            id="employee-form"
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
                placeholder="employee@foundation.org"
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
            {isSuperadmin && (
              <FormField
                label="Foundation"
                required={!editingId}
                error={fieldErr("foundationId")}
                hint={editingId ? "Foundation cannot be changed." : undefined}
              >
                <Select
                  name="foundationId"
                  value={form.foundationId}
                  onChange={(v) => {
                    setForm((prev) => ({ ...prev, foundationId: v }));
                    setFieldErrors((prev) => ({
                      ...prev,
                      foundationId: undefined,
                    }));
                  }}
                  options={foundationOptions}
                  placeholder="Select foundation"
                  disabled={formLoading || !!editingId}
                  error={!!fieldErr("foundationId")}
                />
              </FormField>
            )}
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

            {/* Permissions checkbox grid */}
            <div className="md:col-span-2">
              <p className="mb-2 text-sm font-medium text-foreground">
                Permissions
              </p>
              <p className="mb-3 text-xs text-muted-foreground">
                Choose exactly which actions this employee can perform. By
                default they only see donations they created themselves.
              </p>
              <div className="grid grid-cols-1 gap-4 rounded-md border border-border bg-muted/30 p-4 md:grid-cols-3">
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.label}
                    </p>
                    <ul className="space-y-1.5">
                      {group.items.map((perm) => (
                        <li key={perm.key}>
                          <label className="flex items-start gap-2 text-sm text-foreground">
                            <input
                              type="checkbox"
                              checked={form.permissions.includes(perm.key)}
                              onChange={() => togglePermission(perm.key)}
                              disabled={formLoading}
                              className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                            />
                            <span>{perm.label}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
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
          <Button type="submit" form="employee-form" loading={formLoading}>
            {editingId ? "Update Employee" : "Add Employee"}
          </Button>
        </CardFooter>
      </Card>

      {/* List + filters + pagination */}
      <Card className="relative overflow-hidden">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Employees ({total})</CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search email or name"
                className="w-56"
              />
              {isSuperadmin && (
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
              )}
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
                {isSuperadmin && <th className="px-4 py-3">Foundation</th>}
                <th className="px-4 py-3">Permissions</th>
                <th className="px-4 py-3">Status</th>
                <th className="w-32 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !isFetching ? (
                <tr>
                  <td
                    colSpan={isSuperadmin ? 6 : 5}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No employees match the current filters.
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
                    {isSuperadmin && (
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {foundationMap.get(item.foundationId)?.name ||
                          item.foundationId ||
                          "—"}
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {(item.permissions?.length ?? 0) === 0
                        ? "None"
                        : `${item.permissions.length} granted`}
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
        title="Delete employee?"
        description={
          confirmTarget
            ? `Soft-delete "${confirmTarget.fullName || confirmTarget.email}"? They can be restored later from the "Show deleted" filter.`
            : "Soft-delete this employee? They can be restored later."
        }
        confirmLabel="Delete"
        variant="danger"
        loading={deleteLoading}
      />
    </div>
  );
};

export default ManageEmployees;
