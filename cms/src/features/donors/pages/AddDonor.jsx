// src/pages/AddDonor.jsx
//
// Donor management screen. Server-side pagination + debounced search, soft
// delete with restore, and inline rendering of 422 field errors. SUPERADMIN
// gets a foundation picker (required on create, optional as a list filter);
// ADMIN is scoped to their own foundation by the backend.

import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import {
  PencilIcon,
  TrashIcon,
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";

import {
  createDonor,
  deleteDonor,
  listDonors,
  restoreDonor,
  updateDonor,
} from "../api";
import { listFoundations } from "../../foundations/api";
import { useAuth } from "../../../context/AuthContext";
import { ROLES } from "../../../constants/roles";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  CardFooter,
  Input,
  Select,
  Badge,
  PageHeader,
  FormField,
  ConfirmDialog,
  EmptyState,
  Spinner,
} from "../../../components/ui";

const EMPTY_FORM = {
  fullName: "",
  pan: "",
  email: "",
  phone: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  country: "",
  pincode: "",
};

// Mirrors server/src/modules/donors/donors.schema.js
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const PINCODE_REGEX = /^\d{4,10}$/;
const PAGE_SIZE = 10;

// Field metadata for the create/edit form. [name, label, type, colSpan, required].
// PAN leads the form because donor identity is keyed by PAN throughout the
// platform (donation lookup, 80G receipts). Email is the only truly optional
// field — phone + full address are now mandatory per backend donorSchema.
const DONOR_FIELDS = [
  ["pan", "PAN (AAAAA9999A)", "text", 1, true],
  ["fullName", "Full name", "text", 1, true],
  ["phone", "Mobile", "text", 1, true],
  ["email", "Email", "email", 1, false],
  ["address1", "Address line 1", "text", 2, true],
  ["address2", "Address line 2", "text", 2, false],
  ["city", "City", "text", 1, true],
  ["state", "State", "text", 1, true],
  ["country", "Country", "text", 1, true],
  ["pincode", "Pincode", "text", 1, true],
];

const AddDonor = () => {
  const { user } = useAuth();
  const isSuperadmin = user?.role === ROLES.SUPERADMIN;

  // List state.
  const [donors, setDonors] = useState([]);
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

  // SUPERADMIN-only foundation picker (also doubles as a list filter).
  const [foundations, setFoundations] = useState([]);
  const [selectedFoundationId, setSelectedFoundationId] = useState("");

  // Delete confirmation dialog state.
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

  const fetchDonors = useCallback(async () => {
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
      const res = await listDonors(params);
      setDonors(res?.items ?? []);
      setTotal(res?.total ?? 0);
      setTotalPages(res?.totalPages ?? 1);
    } catch (err) {
      console.error("Fetch donors error:", err);
    } finally {
      setIsFetching(false);
    }
  }, [page, q, includeDeleted, isSuperadmin, selectedFoundationId]);

  // Debounced refetch on any list-input change.
  useEffect(() => {
    const t = setTimeout(fetchDonors, 300);
    return () => clearTimeout(t);
  }, [fetchDonors]);

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    // PAN is uppercased server-side; mirror that locally for parity.
    const next = name === "pan" ? value.toUpperCase() : value;
    setForm((prev) => ({ ...prev, [name]: next }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  // Drop empty strings so backend optional() fields are truly absent.
  const buildPayload = () => {
    const out = {};
    for (const [k, v] of Object.entries(form)) {
      if (typeof v === "string" && v.trim()) out[k] = v.trim();
    }
    if (isSuperadmin && !editingId) {
      out.foundationId = selectedFoundationId;
    }
    return out;
  };

  const validateLocally = () => {
    const errs = {};
    if (!PAN_REGEX.test(form.pan.trim())) {
      errs.pan = ["PAN must match the AAAAA9999A format"];
    }
    if (!form.fullName.trim() || form.fullName.trim().length < 2) {
      errs.fullName = ["Full name must be at least 2 characters"];
    }
    if (!form.phone.trim()) errs.phone = ["Mobile is required"];
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = ["Invalid email format"];
    }
    if (!form.address1.trim()) errs.address1 = ["Address line 1 is required"];
    if (!form.city.trim()) errs.city = ["City is required"];
    if (!form.state.trim()) errs.state = ["State is required"];
    if (!form.country.trim()) errs.country = ["Country is required"];
    if (!form.pincode.trim()) {
      errs.pincode = ["Pincode is required"];
    } else if (!PINCODE_REGEX.test(form.pincode.trim())) {
      errs.pincode = ["Pincode must be 4–10 digits"];
    }
    if (isSuperadmin && !editingId && !selectedFoundationId) {
      setFormError("Pick a foundation before creating a donor.");
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
        // foundationId is immutable post-create; never send on update.
        delete payload.foundationId;
        await updateDonor(editingId, payload);
        toast.success("Donor updated.");
      } else {
        await createDonor(payload);
        toast.success("Donor created.");
      }
      resetForm();
      await fetchDonors();
    } catch (err) {
      const envelope = err.apiError;
      if (envelope?.details?.fieldErrors) {
        setFieldErrors(envelope.details.fieldErrors);
      }
      if (envelope?.message) setFormError(envelope.message);
      console.error("Save donor error:", err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = (donor) => {
    setForm({
      fullName: donor.fullName || "",
      pan: donor.pan || "",
      email: donor.email || "",
      phone: donor.phone || "",
      address1: donor.address1 || "",
      address2: donor.address2 || "",
      city: donor.city || "",
      state: donor.state || "",
      country: donor.country || "",
      pincode: donor.pincode || "",
    });
    setEditingId(donor.id);
    setFieldErrors({});
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleteLoading(true);
    try {
      await deleteDonor(confirmDeleteId);
      toast.info("Donor deleted.");
      if (editingId === confirmDeleteId) resetForm();
      setConfirmDeleteId(null);
      await fetchDonors();
    } catch (err) {
      console.error("Delete donor error:", err);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRestore = async (id) => {
    try {
      await restoreDonor(id);
      toast.success("Donor restored.");
      await fetchDonors();
    } catch (err) {
      console.error("Restore donor error:", err);
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

  return (
    <div>
      <PageHeader
        title="Donors"
        subtitle="Create, search, and manage donor records."
      />

      <div className="space-y-6">
        {/* Create / Edit form */}
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Donor" : "Add Donor"}</CardTitle>
          </CardHeader>
          <CardBody>
            {formError && (
              <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                {formError}
              </div>
            )}

            <form
              id="donor-form"
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

              {DONOR_FIELDS.map(([name, label, type, colSpan, required]) => (
                <div
                  key={name}
                  className={colSpan === 2 ? "md:col-span-2" : ""}
                >
                  <FormField
                    label={label}
                    required={required}
                    error={fieldErr(name)}
                  >
                    <Input
                      type={type}
                      name={name}
                      value={form[name]}
                      onChange={handleChange}
                      disabled={formLoading}
                      error={!!fieldErr(name)}
                    />
                  </FormField>
                </div>
              ))}
            </form>
          </CardBody>
          <CardFooter className="justify-end">
            <Button
              variant="outline"
              onClick={resetForm}
              disabled={formLoading}
            >
              {editingId ? "Cancel" : "Clear"}
            </Button>
            <Button
              type="submit"
              form="donor-form"
              loading={formLoading}
            >
              {editingId ? "Update Donor" : "Add Donor"}
            </Button>
          </CardFooter>
        </Card>

        {/* List + filters + pagination */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Donors ({total})</CardTitle>
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-56">
                  <Input
                    type="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search name, email or PAN"
                    leftIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
                  />
                </div>
                {isSuperadmin && (
                  <div className="w-48">
                    <Select
                      value={selectedFoundationId}
                      onChange={setSelectedFoundationId}
                      options={foundationFilterOptions}
                    />
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={includeDeleted}
                    onChange={(e) => setIncludeDeleted(e.target.checked)}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                  />
                  Show deleted
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchDonors}
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
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Full name</th>
                    <th className="px-4 py-2.5 font-medium">PAN</th>
                    <th className="px-4 py-2.5 font-medium">Email</th>
                    <th className="px-4 py-2.5 font-medium">Mobile</th>
                    <th className="px-4 py-2.5 font-medium">City</th>
                    <th className="px-4 py-2.5 font-medium">Country</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="w-32 px-4 py-2.5 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {donors.length === 0 && !isFetching ? (
                    <tr>
                      <td colSpan="8" className="px-4 py-10 text-center">
                        <EmptyState
                          title="No donors found"
                          description="No donors match the current filters."
                        />
                      </td>
                    </tr>
                  ) : (
                    donors.map((donor) => (
                      <tr
                        key={donor.id}
                        className="group hover:bg-muted/40"
                      >
                        <td className="px-4 py-2.5">{donor.fullName}</td>
                        <td className="px-4 py-2.5 font-mono text-xs">
                          <Link
                            to={`/donor-history?donorId=${encodeURIComponent(donor.id)}`}
                            className="text-primary underline-offset-2 hover:underline focus:underline focus:outline-none"
                            title="Open donor history"
                          >
                            {donor.pan}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {donor.email || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {donor.phone || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {donor.city || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {donor.country || "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          {donor.isDeleted ? (
                            <Badge variant="danger">Deleted</Badge>
                          ) : (
                            <Badge variant="success">Active</Badge>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {donor.isDeleted ? (
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => handleRestore(donor.id)}
                              leftIcon={
                                <ArrowUturnLeftIcon className="h-4 w-4" />
                              }
                            >
                              Restore
                            </Button>
                          ) : (
                            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(donor)}
                                title="Edit"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setConfirmDeleteId(donor.id)}
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
          </CardBody>
          <CardFooter className="justify-between">
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages} · {total} total
              {isFetching && (
                <Spinner size="xs" className="ml-2 align-middle" />
              )}
            </span>
            <div className="flex gap-2">
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

      <ConfirmDialog
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete this donor?"
        description="Donor will be soft-deleted. You can restore them later."
        confirmLabel="Delete"
        loading={deleteLoading}
      />
    </div>
  );
};

export default AddDonor;
