// src/pages/ManageFoundations.jsx
//
// SUPERADMIN console for foundations. Server-side pagination + debounced
// search, soft delete with restore, and inline 422 field-error rendering.

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  PencilIcon,
  TrashIcon,
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

import {
  createFoundation,
  deleteFoundation,
  listFoundations,
  restoreFoundation,
  updateFoundation,
} from "../api";
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
  Spinner,
} from "../../../components/ui";

const EMPTY_FORM = {
  name: "",
  pan: "",
  logoUrl: "",
  isActive: true,
  cashLimit: "2000",
  hasWhatsappBusiness: false,
  whatsappBusinessNumber: "",
};

// Mirrors server/src/modules/foundations/foundations.schema.js
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const E164_REGEX = /^\+[1-9]\d{7,14}$/;
const PAGE_SIZE = 10;

// Strip trailing ".00" coming back from Prisma's Decimal serialisation so the
// input renders "2000" instead of "2000.00" — users can still type decimals.
const normaliseCashLimit = (v) => {
  if (v === null || v === undefined || v === "") return "";
  const s = String(v).trim();
  return s.endsWith(".00") ? s.slice(0, -3) : s;
};

const ManageFoundations = () => {
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

  // Confirm-delete state — id of the item awaiting confirmation, plus a
  // loading flag so the dialog button shows a spinner during the request.
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchList = useCallback(async () => {
    setIsFetching(true);
    try {
      const res = await listFoundations({
        page,
        pageSize: PAGE_SIZE,
        q: q.trim() || undefined,
        includeDeleted: includeDeleted || undefined,
      });
      setItems(res?.items ?? []);
      setTotal(res?.total ?? 0);
      setTotalPages(res?.totalPages ?? 1);
    } catch (err) {
      console.error("Fetch foundations error:", err);
    } finally {
      setIsFetching(false);
    }
  }, [page, q, includeDeleted]);

  useEffect(() => {
    const t = setTimeout(fetchList, 300);
    return () => clearTimeout(t);
  }, [fetchList]);

  useEffect(() => {
    setPage(1);
  }, [q, includeDeleted]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFieldErrors({});
    setFormError("");
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const next = type === "checkbox" ? checked : name === "pan" ? value.toUpperCase() : value;
    setForm((prev) => ({ ...prev, [name]: next }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const buildPayload = () => {
    const out = { name: form.name.trim(), pan: form.pan.trim() };
    if (form.logoUrl.trim()) out.logoUrl = form.logoUrl.trim();
    out.isActive = !!form.isActive;
    // Always send the org-config fields — server validates the WhatsApp pair
    // atomically (number is required iff the toggle is on).
    if (String(form.cashLimit).trim()) out.cashLimit = String(form.cashLimit).trim();
    out.hasWhatsappBusiness = !!form.hasWhatsappBusiness;
    out.whatsappBusinessNumber = form.hasWhatsappBusiness
      ? form.whatsappBusinessNumber.trim()
      : null;
    return out;
  };

  const validateLocally = () => {
    const errs = {};
    if (!form.name.trim() || form.name.trim().length < 2) {
      errs.name = ["Name must be at least 2 characters"];
    }
    if (!PAN_REGEX.test(form.pan.trim())) {
      errs.pan = ["PAN must match the AAAAA9999A format"];
    }
    if (form.logoUrl && !/^https?:\/\//i.test(form.logoUrl.trim())) {
      errs.logoUrl = ["Logo URL must start with http:// or https://"];
    }
    const cl = String(form.cashLimit).trim();
    if (cl && !/^\d{1,12}(\.\d{1,2})?$/.test(cl)) {
      errs.cashLimit = ["Enter a valid amount (max 12 digits, 2 decimals)"];
    }
    if (form.hasWhatsappBusiness && !E164_REGEX.test(form.whatsappBusinessNumber.trim())) {
      errs.whatsappBusinessNumber = ["Use E.164 format, e.g. +911234567890"];
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
        await updateFoundation(editingId, payload);
        toast.success("Foundation updated.");
      } else {
        await createFoundation(payload);
        toast.success("Foundation created.");
      }
      resetForm();
      await fetchList();
    } catch (err) {
      const envelope = err.apiError;
      if (envelope?.details?.fieldErrors) {
        setFieldErrors(envelope.details.fieldErrors);
      }
      if (envelope?.message) setFormError(envelope.message);
      console.error("Save foundation error:", err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = (item) => {
    setForm({
      name: item.name || "",
      pan: item.pan || "",
      logoUrl: item.logoUrl || "",
      isActive: item.isActive !== false,
      cashLimit: normaliseCashLimit(item.cashLimit) || "2000",
      hasWhatsappBusiness: !!item.hasWhatsappBusiness,
      whatsappBusinessNumber: item.whatsappBusinessNumber || "",
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
      await deleteFoundation(confirmDeleteId);
      toast.info("Foundation deleted.");
      if (editingId === confirmDeleteId) resetForm();
      await fetchList();
    } catch (err) {
      console.error("Delete foundation error:", err);
    } finally {
      setDeleteLoading(false);
      setConfirmDeleteId(null);
    }
  };

  const handleRestore = async (id) => {
    try {
      await restoreFoundation(id);
      toast.success("Foundation restored.");
      await fetchList();
    } catch (err) {
      console.error("Restore foundation error:", err);
    }
  };

  const fieldErr = (name) => fieldErrors?.[name]?.[0];

  const confirmTarget = items.find((it) => it.id === confirmDeleteId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Foundations"
        subtitle="Create, update, and restore tenant foundations."
      />

      {/* Create / Edit form */}
      <Card>
        <CardHeader>
          <CardTitle>
            {editingId ? "Edit Foundation" : "Add Foundation"}
          </CardTitle>
        </CardHeader>
        <CardBody>
          {formError && (
            <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">
              {formError}
            </div>
          )}

          <form
            id="foundation-form"
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <FormField label="Foundation name" required error={fieldErr("name")}>
              <Input
                type="text"
                name="name"
                placeholder="e.g. Youth India Foundation"
                value={form.name}
                onChange={handleChange}
                disabled={formLoading}
                error={!!fieldErr("name")}
              />
            </FormField>
            <FormField
              label="Organisation PAN"
              required
              hint="Format: AAAAA9999A"
              error={fieldErr("pan")}
            >
              <Input
                type="text"
                name="pan"
                placeholder="AAAAA9999A"
                value={form.pan}
                onChange={handleChange}
                disabled={formLoading}
                error={!!fieldErr("pan")}
                className="font-mono uppercase"
              />
            </FormField>
            <div className="md:col-span-2">
              <FormField label="Logo URL" error={fieldErr("logoUrl")}>
                <Input
                  type="text"
                  name="logoUrl"
                  placeholder="https://…"
                  value={form.logoUrl}
                  onChange={handleChange}
                  disabled={formLoading}
                  error={!!fieldErr("logoUrl")}
                />
              </FormField>
            </div>

            {/* Organisation compliance + messaging — surfaced here for Superadmins.
                Admins of a foundation manage these via Settings → Organization. */}
            <FormField
              label="Cash donation limit (₹)"
              hint="Default ₹2,000. Donations of type CASH are capped at this amount."
              error={fieldErr("cashLimit")}
            >
              <Input
                type="text"
                inputMode="decimal"
                name="cashLimit"
                placeholder="2000"
                value={form.cashLimit}
                onChange={handleChange}
                disabled={formLoading}
                error={!!fieldErr("cashLimit")}
              />
            </FormField>
            <FormField
              label="WhatsApp Business number"
              hint="E.164, e.g. +911234567890"
              error={fieldErr("whatsappBusinessNumber")}
            >
              <Input
                type="text"
                name="whatsappBusinessNumber"
                placeholder="+911234567890"
                value={form.whatsappBusinessNumber}
                onChange={handleChange}
                disabled={formLoading || !form.hasWhatsappBusiness}
                error={!!fieldErr("whatsappBusinessNumber")}
              />
            </FormField>
            <label className="md:col-span-2 flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                name="hasWhatsappBusiness"
                checked={form.hasWhatsappBusiness}
                onChange={handleChange}
                disabled={formLoading}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              This foundation has a WhatsApp Business number (enables receipt delivery)
            </label>
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
          <Button
            variant="outline"
            onClick={resetForm}
            disabled={formLoading}
          >
            {editingId ? "Cancel" : "Clear"}
          </Button>
          <Button
            type="submit"
            form="foundation-form"
            loading={formLoading}
          >
            {editingId ? "Update Foundation" : "Add Foundation"}
          </Button>
        </CardFooter>
      </Card>

      {/* List + filters + pagination */}
      <Card className="relative overflow-hidden">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Foundations ({total})</CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name or PAN"
                className="w-56"
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
                <th className="px-4 py-3">PAN</th>
                <th className="px-4 py-3">Cash limit</th>
                <th className="px-4 py-3">WhatsApp</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="w-32 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !isFetching ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No foundations match the current filters.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.id}
                    className="group border-t border-border hover:bg-muted/40"
                  >
                    <td className="px-4 py-2.5">{item.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {item.pan}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {item.cashLimit
                        ? `₹${Number(item.cashLimit).toLocaleString("en-IN")}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {item.hasWhatsappBusiness ? (
                        <Badge variant="success" title={item.whatsappBusinessNumber || ""}>
                          Enabled
                        </Badge>
                      ) : (
                        <Badge variant="default">Off</Badge>
                      )}
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
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleDateString()
                        : "—"}
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
        title="Delete foundation?"
        description={
          confirmTarget
            ? `Soft-delete "${confirmTarget.name}"? You can restore it later from the "Show deleted" filter.`
            : "Soft-delete this foundation? You can restore it later."
        }
        confirmLabel="Delete"
        variant="danger"
        loading={deleteLoading}
      />
    </div>
  );
};

export default ManageFoundations;
