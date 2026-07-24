// src/features/donations/pages/AddDonation.jsx
// Create / edit donations. CASH donations are auto-transitioned to RECEIVED
// immediately after creation (the backend strips donationReceived from create
// input on purpose); CHEQUE and ONLINE start PENDING and require operator
// action via SearchDonation or DonationReport to flip to RECEIVED / PRINTED.
// Already-RECEIVED donations are read-only per the backend's update guard.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  PencilIcon,
  TrashIcon,
  ArrowPathIcon,
  PaperAirplaneIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/outline";
import { toast } from "react-toastify";

import {
  listDonations,
  createDonation,
  updateDonation,
  deleteDonation,
  getDonation,
  resendDonationWhatsapp,
} from "../api";
import { getMyFoundation } from "../../foundations/api";
import DonorSearchSelect from "../components/DonorSearchSelect";
import PaymentModeFields from "../components/PaymentModeFields";
import BankAccountSelect from "../../bankAccounts/components/BankAccountSelect";
import CategorySelect from "../../categories/components/CategorySelect";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  CardFooter,
  Input,
  Select,
  Textarea,
  Badge,
  PageHeader,
  FormField,
  ConfirmDialog,
  EmptyState,
  Dropdown,
  DropdownItem,
  DropdownSection,
} from "../../../components/ui";

const DONATION_TYPES = ["CASH", "CHEQUE", "ONLINE", "UPI"];
// Mirrors the DonationCategory enum on the server. GENERAL is the platform
// default; CSR flags corporate contributions for downstream reporting.
const DONATION_CATEGORIES = [
  { value: "GENERAL", label: "General" },
  { value: "CSR", label: "CSR" },
];

const todayIso = () => new Date().toISOString().slice(0, 10);

// Chip amounts respect the foundation's configured cash ceiling (Section 269ST).
// 1000 / 2000 are operator-friendly defaults; the limit itself appears as a
// chip so a single click matches the maximum allowed value.
const buildCashChips = (limit) => {
  const max = Number(limit) || 0;
  const candidates = [1000, 2000, max];
  return Array.from(new Set(candidates.filter((v) => v > 0 && v <= max)));
};

// Donor identity is now three-tier: the operator can either link an existing
// donor (donorId set) or capture inline details for a fresh donor (Tier 1 PAN +
// details, Tier 2 mobile + details, or Tier 3 name only). Only donorFullName is
// mandatory — the resolveOrCreateDonor service dedupes on PAN → phone → name.
// Bank-account category is now purpose-based (GENERAL / CSR) and mirrors
// the donation's own category field — payment mode no longer influences
// which bucket the ledger posts to. The picker below reads form.category
// directly so a GENERAL donation always credits a GENERAL account and CSR
// a CSR account, regardless of CASH / UPI / ONLINE / CHEQUE.

const emptyForm = () => ({
  donorId: "",
  donorFullName: "",
  donorPan: "",
  donorPhone: "",
  amount: "",
  type: "CASH",
  category: "GENERAL",
  incomeCategoryId: "",
  bankName: "",
  utr: "",
  chequeNumber: "",
  ifsc: "",
  bankAccountId: "",
  donationDate: todayIso(),
  transactionDate: "",
  notes: "",
  whatsappOptIn: false,
});

const formatAmount = (amount) => {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
};

const AddDonation = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const editParam = searchParams.get("edit");

  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [donations, setDonations] = useState([]);
  const [fetching, setFetching] = useState(false);

  // Delete confirmation dialog state.
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Per-row WhatsApp resend state. A Set keyed by donation id keeps multiple
  // concurrent resends independent (each row's button disables on its own).
  const [resendingIds, setResendingIds] = useState(() => new Set());

  // Foundation-level config drives two UX details: the CASH chips (cashLimit)
  // and whether the WhatsApp receipt checkbox is rendered (hasWhatsappBusiness).
  // SUPERADMIN may not own a foundation — failures fall through silently so
  // the form still works without the org-specific affordances.
  const [foundation, setFoundation] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getMyFoundation();
        if (!cancelled) setFoundation(res?.foundation ?? res ?? null);
      } catch (err) {
        console.warn(
          "getMyFoundation failed:",
          err?.apiError?.message ?? err?.message
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Guards against re-fetching the same edit target if the component re-renders
  // before the query param is cleared.
  const editFetchedFor = useRef(null);

  const fetchDonations = async () => {
    setFetching(true);
    try {
      const page = await listDonations({ page: 1, pageSize: 10 });
      setDonations(page?.items ?? []);
    } catch (err) {
      console.error("Fetch donations error:", err);
      setDonations([]);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchDonations();
  }, []);

  // When navigated here with `?edit=ID` (e.g. from All Donations), fetch the
  // record, pre-fill the form, scroll into view, and strip the query param so
  // a refresh doesn't loop the fetch.
  useEffect(() => {
    if (!editParam) return;
    if (editFetchedFor.current === editParam) return;
    editFetchedFor.current = editParam;

    let cancelled = false;
    (async () => {
      try {
        // GET /donations/:id wraps the record as { donation }, mirroring the
        // create/update endpoints. Destructure so `row` is the donation itself,
        // otherwise every field below resolves to undefined and the form looks
        // blank after the URL is stripped in `finally`.
        const { donation: row } = await getDonation(editParam);
        if (cancelled || !row) return;
        if (row.donationReceived === "RECEIVED") {
          toast.info("RECEIVED donations cannot be edited.");
        } else {
          setForm({
            donorId: row.donor?.id ?? row.donorId ?? "",
            // Fall back to the donation-time snapshots when the row is Tier 3
            // (no donor relation) or when the linked donor has been deleted.
            donorFullName: row.donor?.fullName ?? row.donorNameSnapshot ?? "",
            donorPan: row.donor?.pan ?? "",
            donorPhone: row.donor?.phone ?? row.donorPhoneSnapshot ?? "",
            amount:
              typeof row.amount === "string"
                ? row.amount
                : String(row.amount ?? ""),
            type: row.type,
            category: row.category ?? "GENERAL",
            incomeCategoryId: row.incomeCategoryId ?? "",
            bankName: row.bankName ?? "",
            utr: row.utr ?? "",
            chequeNumber: row.chequeNumber ?? "",
            ifsc: row.ifsc ?? "",
            bankAccountId: row.bankAccountId ?? "",
            donationDate: row.donationDate
              ? row.donationDate.slice(0, 10)
              : todayIso(),
            transactionDate: row.transactionDate
              ? row.transactionDate.slice(0, 10)
              : "",
            notes: row.notes ?? "",
            whatsappOptIn: !!row.whatsappOptIn,
          });
          setEditId(row.id);
          setFieldErrors({});
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } catch (err) {
        console.error("Load donation for edit failed:", err);
      } finally {
        if (!cancelled) {
          const next = new URLSearchParams(searchParams);
          next.delete("edit");
          setSearchParams(next, { replace: true });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editParam]);

  // DonorSearchSelect lifts the full donor object on selection. Picking a
  // donor fills all identity fields; passing null (Combobox clear) wipes them
  // so the operator lands back in the quick-add state.
  const handleDonorSelect = useCallback((donor) => {
    setForm((f) => ({
      ...f,
      donorId: donor?.id ?? "",
      donorFullName: donor?.fullName ?? "",
      donorPan: donor?.pan ?? "",
      donorPhone: donor?.phone ?? "",
    }));
  }, []);

  // Unlink the picked donor and clear the identity fields so the operator can
  // type a new donor's details. Kept as a callback for the "Change donor"
  // button — never fires while editing since donorId is immutable on update.
  const handleClearPickedDonor = useCallback(() => {
    setForm((f) => ({
      ...f,
      donorId: "",
      donorFullName: "",
      donorPan: "",
      donorPhone: "",
    }));
  }, []);

  const setField = (name, value) => setForm((f) => ({ ...f, [name]: value }));

  // Resetting payment fields on type change avoids leaking stale UTR/cheque
  // references into a payload of a different type — the backend would reject
  // them, but clearing up-front is friendlier and matches the rendered shape.
  // transactionDate is reset too: CASH locks it to donationDate server-side;
  // CHEQUE/ONLINE/UPI start blank → PENDING until the operator fills it in.
  // The bank-account pick is intentionally preserved across type changes —
  // it now filters by form.category (GENERAL / CSR), so switching payment
  // mode (CASH ↔ CHEQUE ↔ ONLINE ↔ UPI) has no bearing on which account
  // the ledger credits.
  const handleTypeChange = (e) =>
    setForm((f) => ({
      ...f,
      type: e.target.value,
      bankName: "",
      utr: "",
      chequeNumber: "",
      ifsc: "",
      transactionDate: "",
    }));

  const clearForm = () => {
    setForm(emptyForm());
    setEditId(null);
    setFieldErrors({});
  };

  // Build the payload the backend createDonationSchema / updateDonationSchema
  // expects. Per-type field selection mirrors the server's superRefine.
  // Donor identity is either a linked donorId or an inline `donor` object;
  // the backend's resolveOrCreateDonor picks the right dedup tier.
  const buildPayload = () => {
    const out = {
      amount: form.amount,
      type: form.type,
      category: form.category || "GENERAL",
      donationDate: form.donationDate
        ? new Date(form.donationDate).toISOString()
        : undefined,
    };
    if (form.donorId) {
      out.donorId = form.donorId;
    } else {
      const donor = { fullName: form.donorFullName?.trim() };
      const pan = form.donorPan?.trim();
      const phone = form.donorPhone?.trim();
      if (pan) donor.pan = pan.toUpperCase();
      if (phone) donor.phone = phone;
      out.donor = donor;
    }
    if (form.notes?.trim()) out.notes = form.notes.trim();
    if (form.type === "CHEQUE") {
      out.chequeNumber = form.chequeNumber?.trim();
      out.bankName = form.bankName?.trim();
      if (form.ifsc?.trim()) out.ifsc = form.ifsc.trim();
    } else if (form.type === "ONLINE" || form.type === "UPI") {
      // UPI is identified by UTR on the backend — same payload shape as ONLINE.
      out.utr = form.utr?.trim();
      if (form.bankName?.trim()) out.bankName = form.bankName.trim();
      if (form.ifsc?.trim()) out.ifsc = form.ifsc.trim();
    }
    // CASH locks transactionDate to donationDate on the server; for the other
    // types an empty value leaves the donation PENDING.
    if (form.type !== "CASH" && form.transactionDate) {
      out.transactionDate = new Date(form.transactionDate).toISOString();
    }
    // The bank account the ledger will credit. When absent, the server
    // resolves the foundation's default for the donation's category
    // (GENERAL or CSR) and errors if none is configured.
    if (form.bankAccountId) out.bankAccountId = form.bankAccountId;
    if (form.incomeCategoryId) out.incomeCategoryId = form.incomeCategoryId;
    // Only forward whatsappOptIn when the tenant is wired for WhatsApp —
    // otherwise the server would 422 on a stray opt-in.
    if (foundation?.hasWhatsappBusiness && form.whatsappOptIn) {
      out.whatsappOptIn = true;
    }
    return out;
  };

  // Map a 422 ApiError.details.fieldErrors blob to the local fieldErrors state,
  // returning true on success so the caller knows to bail out of the toast path.
  const applyFieldErrors = (err) => {
    const fe = err?.apiError?.details?.fieldErrors;
    if (fe && typeof fe === "object") {
      setFieldErrors(fe);
      return true;
    }
    return false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFieldErrors({});

    // Donor identity gate: either an existing donor is linked OR the operator
    // has typed at least a name for inline creation. Everything else on the
    // donor is optional and dedup happens server-side.
    if (!form.donorId && !form.donorFullName?.trim()) {
      setFieldErrors({ donorFullName: ["Donor name is required"] });
      return;
    }
    if (!form.amount || Number.isNaN(parseFloat(form.amount))) {
      setFieldErrors({ amount: ["Enter a valid amount"] });
      return;
    }
    if (!form.donationDate) {
      setFieldErrors({ donationDate: ["Donation date is required"] });
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildPayload();
      if (editId) {
        await updateDonation(editId, payload);
        toast.success("Donation updated.");
      } else {
        // Server now derives donationReceived from (type, transactionDate) and
        // dispatches the WhatsApp receipt fire-and-forget — no client follow-up.
        await createDonation(payload);
        toast.success("Donation added.");
      }
      clearForm();
      await fetchDonations();
    } catch (err) {
      if (applyFieldErrors(err)) {
        // Interceptor already toasted the 422 message — no extra toast here.
        return;
      }
      console.error("Submit donation error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // The list endpoint already returns the donor relation, so editing pre-fills
  // straight from the row instead of a second GET. updateDonationSchema bans
  // donor changes, so the identity fields are locked while editing.
  const handleEdit = (row) => {
    if (row.donationReceived === "RECEIVED") {
      toast.info("RECEIVED donations cannot be edited.");
      return;
    }
    setForm({
      donorId: row.donor?.id ?? row.donorId ?? "",
      donorFullName: row.donor?.fullName ?? row.donorNameSnapshot ?? "",
      donorPan: row.donor?.pan ?? "",
      donorPhone: row.donor?.phone ?? row.donorPhoneSnapshot ?? "",
      amount: typeof row.amount === "string" ? row.amount : String(row.amount ?? ""),
      type: row.type,
      category: row.category ?? "GENERAL",
      incomeCategoryId: row.incomeCategoryId ?? "",
      bankName: row.bankName ?? "",
      utr: row.utr ?? "",
      chequeNumber: row.chequeNumber ?? "",
      ifsc: row.ifsc ?? "",
      bankAccountId: row.bankAccountId ?? "",
      donationDate: row.donationDate ? row.donationDate.slice(0, 10) : todayIso(),
      transactionDate: row.transactionDate
        ? row.transactionDate.slice(0, 10)
        : "",
      notes: row.notes ?? "",
      whatsappOptIn: !!row.whatsappOptIn,
    });
    setEditId(row.id);
    setFieldErrors({});
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleteLoading(true);
    try {
      await deleteDonation(confirmDeleteId);
      toast.info("Donation deleted.");
      setDonations((prev) => prev.filter((d) => d.id !== confirmDeleteId));
      setConfirmDeleteId(null);
    } catch (err) {
      console.error("Delete donation error:", err);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Re-trigger the WhatsApp receipt. The backend resets opt-in/sent/error and
  // fires the dispatch asynchronously, so we mirror that locally (flip the row
  // into Pending state) and then refetch once the stub provider's ~400ms send
  // has settled to surface the final Sent/Failed badge.
  const handleResendWhatsapp = async (donation) => {
    const id = donation.id;
    setResendingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setDonations((prev) =>
      prev.map((d) =>
        d.id === id
          ? { ...d, whatsappOptIn: true, whatsappSentAt: null, whatsappError: null }
          : d
      )
    );
    try {
      await resendDonationWhatsapp(id);
      toast.info("WhatsApp receipt queued.");
      // Refresh after the stub provider's simulated send completes so the
      // badge transitions Pending → Sent without a manual reload.
      setTimeout(fetchDonations, 900);
    } catch (err) {
      console.error("Resend WhatsApp error:", err);
      const message =
        err?.apiError?.message ?? "Could not resend the WhatsApp receipt.";
      toast.error(message);
      // Roll back the optimistic update by refetching the row's truth.
      fetchDonations();
    } finally {
      setResendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const err = (name) => fieldErrors?.[name]?.[0];
  const isEditing = Boolean(editId);

  const typeOptions = DONATION_TYPES.map((t) => ({ value: t, label: t }));
  const cashLimitNum = Number(foundation?.cashLimit ?? 0);
  const cashChips = buildCashChips(cashLimitNum);

  return (
    <div>
      <PageHeader
        title="Donations"
        subtitle="Record cash, cheque, and online donations and review the latest activity."
      />

      <div className="space-y-6">
        {/* ── ADD / UPDATE FORM ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {isEditing ? "Update Donation" : "Add Donation"}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearForm}
                disabled={submitting}
              >
                {isEditing ? "Cancel Edit" : "Clear Form"}
              </Button>
            </div>
          </CardHeader>
          <CardBody>
            <form
              id="donation-form"
              onSubmit={handleSubmit}
              className="grid grid-cols-1 gap-4 md:grid-cols-2"
            >
              {/* Donor block — a search combobox links an existing donor, or
                  the operator can type into the identity fields below to have
                  the server resolve/create the donor inline. When a donor is
                  picked, we render a compact summary card with a "Change"
                  button; editing is locked because updateDonationSchema does
                  not allow donor swaps. */}
              {form.donorId ? (
                <div className="md:col-span-2 rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Linked donor
                      </div>
                      <div className="truncate font-medium text-foreground">
                        {form.donorFullName || "—"}
                      </div>
                      {(form.donorPan || form.donorPhone) && (
                        <div className="font-mono text-xs text-muted-foreground">
                          {form.donorPan
                            ? form.donorPan
                            : form.donorPhone}
                        </div>
                      )}
                    </div>
                    {!isEditing && (
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={handleClearPickedDonor}
                        disabled={submitting}
                      >
                        Change donor
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <DonorSearchSelect
                  donor={null}
                  onSelect={handleDonorSelect}
                  disabled={submitting || isEditing}
                  fieldError={err("donorId")}
                />
              )}

              {/* Inline donor identity fields — only editable in quick-add
                  mode (no donorId, not editing). Full name is the sole
                  requirement; PAN unlocks Tier 1, mobile unlocks Tier 2. */}
              {!form.donorId && (
                <>
                  <div className="md:col-span-2">
                    <FormField
                      label="Donor Full Name"
                      required
                      error={err("donorFullName") || err("donor")}
                      hint="PAN and mobile are optional but help us match repeat donors."
                    >
                      <Input
                        type="text"
                        name="donorFullName"
                        value={form.donorFullName}
                        onChange={(e) =>
                          setField("donorFullName", e.target.value)
                        }
                        disabled={submitting || isEditing}
                        placeholder="e.g. Ramesh Kumar"
                        required
                        error={!!(err("donorFullName") || err("donor"))}
                      />
                    </FormField>
                  </div>

                  <FormField label="Donor PAN" error={err("donorPan")}>
                    <Input
                      type="text"
                      name="donorPan"
                      value={form.donorPan}
                      onChange={(e) =>
                        setField(
                          "donorPan",
                          e.target.value.toUpperCase()
                        )
                      }
                      disabled={submitting || isEditing}
                      placeholder="AAAAA9999A"
                      maxLength={10}
                      error={!!err("donorPan")}
                    />
                  </FormField>

                  <FormField label="Donor Mobile" error={err("donorPhone")}>
                    <Input
                      type="tel"
                      name="donorPhone"
                      value={form.donorPhone}
                      onChange={(e) => setField("donorPhone", e.target.value)}
                      disabled={submitting || isEditing}
                      placeholder="e.g. 9876543210"
                      error={!!err("donorPhone")}
                    />
                  </FormField>
                </>
              )}

              <div>
                <FormField
                  label="Amount"
                  required
                  error={err("amount")}
                  hint={
                    form.type === "CASH" && cashLimitNum > 0
                      ? `Max ₹${cashLimitNum.toLocaleString("en-IN")} per CASH donation (Section 269ST).`
                      : undefined
                  }
                >
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    name="amount"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => setField("amount", e.target.value)}
                    disabled={submitting}
                    required
                    error={!!err("amount")}
                  />
                </FormField>
                {/* Quick-fill chips for CASH only: 1000, 2000, and the
                    foundation's configured ceiling. Kept outside FormField so
                    its single-child id/aria wiring still works for the Input. */}
                {form.type === "CASH" && cashChips.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {cashChips.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setField("amount", String(amt))}
                        disabled={submitting}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          String(amt) === String(form.amount)
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        ₹{amt.toLocaleString("en-IN")}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <FormField label="Type" required error={err("type")}>
                <Select
                  value={form.type}
                  onChange={(v) =>
                    handleTypeChange({ target: { value: v } })
                  }
                  options={typeOptions}
                  disabled={submitting}
                />
              </FormField>

              {/* Donation category. Defaults to GENERAL; switch to CSR for
                  corporate-social-responsibility contributions so reporting
                  can segment 80G donations downstream. */}
              <FormField label="Category" required error={err("category")}>
                <Select
                  value={form.category}
                  onChange={(v) => setField("category", v)}
                  options={DONATION_CATEGORIES}
                  disabled={submitting}
                />
              </FormField>

              <PaymentModeFields
                type={form.type}
                form={form}
                onChange={setField}
                disabled={submitting}
                fieldErrors={fieldErrors}
              />

              {/* Bank account the ledger will post the CREDIT to. Picker
                  filters to the donation's category (GENERAL / CSR) and
                  pre-selects that category's default. */}
              <FormField
                label="Deposit into"
                error={err("bankAccountId")}
                hint="Auto-picks the default account for this donation category. Change only if the funds land elsewhere."
              >
                <BankAccountSelect
                  value={form.bankAccountId}
                  onChange={(v) => setField("bankAccountId", v)}
                  category={form.category}
                  disabled={submitting}
                  error={!!err("bankAccountId")}
                />
              </FormField>

              <FormField
                label="Income category"
                hint="Optional — e.g. Zakat, Sadaqah, Building Fund."
                error={err("incomeCategoryId")}
              >
                <CategorySelect
                  kind="INCOME"
                  value={form.incomeCategoryId}
                  onChange={(v) => setField("incomeCategoryId", v)}
                  disabled={submitting}
                  placeholder="— None —"
                />
              </FormField>

              <FormField
                label="Donation Date"
                required
                error={err("donationDate")}
              >
                <Input
                  type="date"
                  name="donationDate"
                  value={form.donationDate}
                  onChange={(e) => setField("donationDate", e.target.value)}
                  disabled={submitting}
                  required
                  error={!!err("donationDate")}
                />
              </FormField>

              {/* Transaction date only applies to non-CASH types. Leaving it
                  blank keeps the donation PENDING; filling it transitions to
                  RECEIVED server-side. CASH is auto-set to donationDate. */}
              {form.type !== "CASH" && (
                <FormField
                  label="Transaction Date"
                  error={err("transactionDate")}
                  hint="Leave blank to keep this donation Pending until the funds clear."
                >
                  <Input
                    type="date"
                    name="transactionDate"
                    value={form.transactionDate}
                    onChange={(e) =>
                      setField("transactionDate", e.target.value)
                    }
                    disabled={submitting}
                    error={!!err("transactionDate")}
                  />
                </FormField>
              )}

              <div className="md:col-span-2">
                <FormField label="Notes" error={err("notes")}>
                  <Textarea
                    name="notes"
                    value={form.notes}
                    onChange={(e) => setField("notes", e.target.value)}
                    rows={2}
                    maxLength={2000}
                    disabled={submitting}
                    placeholder="Optional"
                    error={!!err("notes")}
                  />
                </FormField>
              </div>

              {/* WhatsApp receipt opt-in. Only shown when the tenant has a
                  configured WhatsApp Business number — keeps the form clean
                  for foundations that haven't enabled the integration. */}
              {foundation?.hasWhatsappBusiness && (
                <div className="md:col-span-2">
                  <label className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground">
                    <input
                      type="checkbox"
                      name="whatsappOptIn"
                      checked={form.whatsappOptIn}
                      onChange={(e) =>
                        setField("whatsappOptIn", e.target.checked)
                      }
                      disabled={submitting}
                      className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                    />
                    <span className="flex flex-col">
                      <span className="font-medium">
                        Send receipt to donor on WhatsApp
                      </span>
                      <span className="text-xs text-muted-foreground">
                        We'll deliver the receipt to the donor's primary phone
                        number after the donation is saved.
                      </span>
                    </span>
                  </label>
                </div>
              )}
            </form>
          </CardBody>
          <CardFooter className="justify-end">
            <Button
              variant="outline"
              onClick={clearForm}
              disabled={submitting}
            >
              Clear
            </Button>
            <Button
              type="submit"
              form="donation-form"
              loading={submitting}
              disabled={
                !form.donorId && !form.donorFullName?.trim()
              }
            >
              {isEditing ? "Update Donation" : "Add Donation"}
            </Button>
          </CardFooter>
        </Card>

        {/* ── RECENT DONATIONS TABLE ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Donations</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchDonations}
                disabled={fetching}
                leftIcon={
                  <ArrowPathIcon
                    className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`}
                  />
                }
              >
                {fetching ? "Refreshing…" : "Refresh"}
              </Button>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Donor</th>
                    <th className="px-4 py-2.5 font-medium">PAN</th>
                    <th className="px-4 py-2.5 font-medium">Amount</th>
                    <th className="px-4 py-2.5 font-medium">Type</th>
                    <th className="px-4 py-2.5 font-medium">UTR / Cheque</th>
                    <th className="px-4 py-2.5 font-medium">Bank</th>
                    <th className="px-4 py-2.5 font-medium">Donation Date</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    {foundation?.hasWhatsappBusiness && (
                      <th className="px-4 py-2.5 font-medium">WhatsApp</th>
                    )}
                    <th className="w-24 px-4 py-2.5 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {donations.length === 0 && !fetching ? (
                    <tr>
                      <td
                        colSpan={foundation?.hasWhatsappBusiness ? 10 : 9}
                        className="px-4 py-10 text-center"
                      >
                        <EmptyState
                          title="No donations yet"
                          description="No donations have been recorded yet."
                        />
                      </td>
                    </tr>
                  ) : (
                    donations.map((d) => (
                      <tr
                        key={d.id}
                        className="group hover:bg-muted/40"
                      >
                        <td className="px-4 py-2.5">
                          {/* Prefer the donor relation but fall back to the
                              donation-time name snapshot so Tier 3 rows (no
                              donor) or rows whose donor was deleted still
                              read cleanly. */}
                          {d.donor?.fullName ?? d.donorNameSnapshot ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs">
                          {/* PAN has no snapshot — only Tier 1 donors carry
                              one. Absent for Tier 2/3 or if the donor row is
                              gone. */}
                          {d.donor?.pan ?? "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          ₹{formatAmount(d.amount)}
                        </td>
                        <td className="px-4 py-2.5">{d.type}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {d.type === "CHEQUE"
                            ? d.chequeNumber ?? "—"
                            : d.type === "ONLINE" || d.type === "UPI"
                            ? d.utr ?? "—"
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {d.bankName ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {d.donationDate
                            ? new Date(d.donationDate).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge
                            variant={
                              d.donationReceived === "RECEIVED"
                                ? "success"
                                : "warning"
                            }
                          >
                            {d.donationReceived}
                          </Badge>
                        </td>
                        {foundation?.hasWhatsappBusiness && (
                          <td className="px-4 py-2.5">
                            {(() => {
                              // Derive a single WhatsApp status from three
                              // backend fields plus a transient "resending"
                              // flag tracked client-side. The button label
                              // mirrors the status so operators understand
                              // whether they're sending fresh, resending a
                              // delivered message, or retrying a failure.
                              const isResending = resendingIds.has(d.id);
                              let badge;
                              let buttonLabel = null;
                              if (!d.whatsappOptIn) {
                                badge = (
                                  <span className="text-xs text-muted-foreground">
                                    —
                                  </span>
                                );
                                buttonLabel = "Send";
                              } else if (d.whatsappError) {
                                badge = (
                                  <Badge
                                    variant="danger"
                                    title={d.whatsappError}
                                  >
                                    Failed
                                  </Badge>
                                );
                                buttonLabel = "Retry";
                              } else if (d.whatsappSentAt) {
                                badge = <Badge variant="success">Sent</Badge>;
                                buttonLabel = "Resend";
                              } else {
                                badge = <Badge variant="warning">Pending</Badge>;
                                // While the original dispatch is in flight we
                                // hide the button to avoid double-sends.
                              }
                              return (
                                <div className="flex items-center gap-2">
                                  {badge}
                                  {buttonLabel && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleResendWhatsapp(d)}
                                      disabled={isResending}
                                      leftIcon={
                                        <PaperAirplaneIcon
                                          className={`h-3.5 w-3.5 ${
                                            isResending ? "animate-pulse" : ""
                                          }`}
                                        />
                                      }
                                      title={`${buttonLabel} WhatsApp receipt`}
                                      className="h-7 px-2 text-xs"
                                    >
                                      {isResending ? "Sending…" : buttonLabel}
                                    </Button>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                        )}
                        <td className="px-4 py-2.5">
                          {/* Secondary actions tucked behind a three-dots
                              menu so the row stays compact as WhatsApp /
                              status columns grow. */}
                          <Dropdown
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                title="More actions"
                                aria-label="More actions"
                              >
                                <EllipsisVerticalIcon className="h-4 w-4" />
                              </Button>
                            }
                          >
                            <DropdownSection>
                              <DropdownItem
                                icon={<PencilIcon className="h-4 w-4" />}
                                onClick={() => handleEdit(d)}
                                disabled={d.donationReceived === "RECEIVED"}
                              >
                                Edit
                              </DropdownItem>
                              <DropdownItem
                                icon={<TrashIcon className="h-4 w-4" />}
                                onClick={() => setConfirmDeleteId(d.id)}
                                danger
                              >
                                Delete
                              </DropdownItem>
                            </DropdownSection>
                          </Dropdown>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete this donation?"
        description="This will permanently delete the donation record."
        confirmLabel="Delete"
        loading={deleteLoading}
      />
    </div>
  );
};

export default AddDonation;
