// src/features/donations/pages/SearchDonation.jsx
// Unified donation workspace. Combines per-row lifecycle actions (Mark
// Received, Mark Printed, Edit, Delete, WhatsApp resend) with multi-select
// bulk operations (bulk status updates, CSV/PDF export, batch print). Bulk
// selections survive page navigation via a Map<id, donation> so users can
// tick rows across multiple pages before acting on them together.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CSVLink } from "react-csv";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  PrinterIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  PaperAirplaneIcon,
  EllipsisVerticalIcon,
  ArrowDownTrayIcon,
  DocumentArrowDownIcon,
  XMarkIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { toast } from "react-toastify";

import {
  listDonations,
  markDonationReceived,
  markDonationPrinted,
  deleteDonation,
  resendDonationWhatsapp,
} from "../api";
import { getMyFoundation } from "../../foundations/api";
import {
  buildCsvRows,
  printReceipts,
  savePdfReceipts,
} from "../lib/receiptTemplate";
import Can from "../../../components/Can";
import { PERMISSIONS } from "../../../constants/permissions";
import { usePermissions } from "../../../hooks/usePermissions";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  CardFooter,
  ConfirmDialog,
  Input,
  Select,
  Badge,
  PageHeader,
  EmptyState,
  Spinner,
  Dropdown,
  DropdownItem,
  DropdownSection,
  DropdownLabel,
} from "../../../components/ui";

const DONATION_TYPES = ["CASH", "CHEQUE", "ONLINE"];
const STATUSES = ["PENDING", "RECEIVED"];

const formatAmount = (amount) => {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
};

// Debounce hook scoped to this page — search and date inputs share it so we
// don't fire a request on every keystroke.
function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return debounced;
}

const SearchDonation = () => {
  const navigate = useNavigate();
  const { can } = usePermissions();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isFetching, setIsFetching] = useState(false);

  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // Column-level filters. whatsapp narrows by delivery state, minAmount /
  // maxAmount bracket the donation amount. All optional and orthogonal to q.
  const [whatsapp, setWhatsapp] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [rowBusyId, setRowBusyId] = useState(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Per-row WhatsApp resend tracking, keyed by donation id so multiple rows
  // can be in flight independently.
  const [resendingIds, setResendingIds] = useState(() => new Set());

  // Cross-page selection: Map<id, donation> preserves the full record across
  // page navigation so bulk actions can run on selections that span multiple
  // pages without re-fetching. `bulkBusy` blocks the toolbar while any fan-out
  // is in flight; `printProgress` drives the PDF generation overlay.
  const [selectedMap, setSelectedMap] = useState(() => new Map());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [printProgress, setPrintProgress] = useState({ done: 0, total: 0 });
  const csvLinkRef = useRef(null);

  // Foundation drives whether the WhatsApp column/actions render. SUPERADMIN
  // may not own one, so failures fall through silently.
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

  // Debounce only the typed inputs; selects fire immediately.
  const dq = useDebounced(q);
  const dfrom = useDebounced(from);
  const dto = useDebounced(to);
  const dmin = useDebounced(minAmount);
  const dmax = useDebounced(maxAmount);

  // Whenever any filter changes, reset to page 1 so paging doesn't strand the
  // user on an empty page beyond the new result set.
  useEffect(() => {
    setPage(1);
  }, [dq, type, status, dfrom, dto, whatsapp, dmin, dmax, pageSize]);

  const params = useMemo(
    () => ({
      page,
      pageSize,
      q: dq || undefined,
      type: type || undefined,
      status: status || undefined,
      from: dfrom ? new Date(dfrom).toISOString() : undefined,
      to: dto ? new Date(dto).toISOString() : undefined,
      whatsapp: whatsapp || undefined,
      minAmount: dmin !== "" ? dmin : undefined,
      maxAmount: dmax !== "" ? dmax : undefined,
    }),
    [page, pageSize, dq, type, status, dfrom, dto, whatsapp, dmin, dmax]
  );

  const fetchPage = async () => {
    setIsFetching(true);
    try {
      const res = await listDonations(params);
      setItems(res?.items ?? []);
      setTotal(res?.total ?? 0);
      setTotalPages(res?.totalPages ?? 1);
    } catch (err) {
      console.error("Fetch donations error:", err);
      setItems([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const clearAll = () => {
    setQ("");
    setType("");
    setStatus("");
    setFrom("");
    setTo("");
    setWhatsapp("");
    setMinAmount("");
    setMaxAmount("");
  };

  const handleMarkReceived = async (id) => {
    setRowBusyId(id);
    try {
      await markDonationReceived(id);
      toast.success("Donation marked as RECEIVED.");
      await fetchPage();
    } catch (err) {
      console.error("Mark received error:", err);
    } finally {
      setRowBusyId(null);
    }
  };

  const handleMarkPrinted = async (id) => {
    setRowBusyId(id);
    try {
      await markDonationPrinted(id);
      toast.success("Donation marked as PRINTED.");
      await fetchPage();
    } catch (err) {
      console.error("Mark printed error:", err);
    } finally {
      setRowBusyId(null);
    }
  };

  const handleEdit = (d) => {
    if (d.donationReceived === "RECEIVED") {
      toast.info("RECEIVED donations cannot be edited.");
      return;
    }
    navigate(`/donation/add?edit=${d.id}`);
  };

  // Re-trigger the WhatsApp receipt. Mirrors AddDonation: optimistic flip into
  // Pending, then refetch after the stub's simulated send completes.
  const handleResendWhatsapp = async (d) => {
    const id = d.id;
    setResendingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setItems((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              whatsappOptIn: true,
              whatsappSentAt: null,
              whatsappError: null,
            }
          : row
      )
    );
    try {
      await resendDonationWhatsapp(id);
      toast.info("WhatsApp receipt queued.");
      setTimeout(fetchPage, 900);
    } catch (err) {
      console.error("Resend WhatsApp error:", err);
      const message =
        err?.apiError?.message ?? "Could not resend the WhatsApp receipt.";
      toast.error(message);
      fetchPage();
    } finally {
      setResendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmDeleteId) return;
    setDeleteLoading(true);
    try {
      await deleteDonation(confirmDeleteId);
      toast.info("Donation deleted.");
      setConfirmDeleteId(null);
      await fetchPage();
    } catch (err) {
      console.error("Delete donation error:", err);
    } finally {
      setDeleteLoading(false);
    }
  };

  // ───────────────────── Selection helpers ─────────────────────
  const selectedRecords = useMemo(
    () => Array.from(selectedMap.values()),
    [selectedMap]
  );

  const toggleRow = (d) =>
    setSelectedMap((m) => {
      const next = new Map(m);
      if (next.has(d.id)) next.delete(d.id);
      else next.set(d.id, d);
      return next;
    });

  const allOnPageSelected =
    items.length > 0 && items.every((d) => selectedMap.has(d.id));

  const togglePageSelection = (e) =>
    setSelectedMap((m) => {
      const next = new Map(m);
      if (e.target.checked) items.forEach((d) => next.set(d.id, d));
      else items.forEach((d) => next.delete(d.id));
      return next;
    });

  const clearSelection = () => setSelectedMap(new Map());

  // Whether at least one bulk action is permitted for the current user. Used
  // to decide whether to render the selection column at all — keeps the table
  // narrow for view-only employees.
  const canAnyBulk =
    can(PERMISSIONS.DONATION_MARK_RECEIVED) ||
    can(PERMISSIONS.DONATION_MARK_PRINTED) ||
    can(PERMISSIONS.DONATION_UPDATE) ||
    can(PERMISSIONS.REPORT_VIEW);

  // ───────────────────── Bulk fan-out ─────────────────────
  // Generic helper: filter the selection by `predicate`, call `op` on each,
  // toast successes/failures, then clear selection + refetch. Sequential so a
  // single slow row doesn't block the others' visibility but the server isn't
  // pummelled in parallel.
  const runBulk = async ({ label, predicate, op, eligibleEmpty }) => {
    const records = selectedRecords.filter(predicate);
    if (records.length === 0) {
      toast.info(eligibleEmpty);
      return;
    }
    setBulkBusy(true);
    let ok = 0;
    let failed = 0;
    for (const d of records) {
      try {
        await op(d);
        ok += 1;
      } catch (err) {
        failed += 1;
        console.error(`Bulk ${label} failed for ${d.id}:`, err);
      }
    }
    if (ok > 0) toast.success(`${ok} donation(s) ${label}.`);
    if (failed > 0) toast.error(`${failed} donation(s) failed to ${label}.`);
    clearSelection();
    setBulkBusy(false);
    await fetchPage();
  };

  const bulkMarkReceived = () =>
    runBulk({
      label: "marked as RECEIVED",
      predicate: (d) => d.donationReceived === "PENDING",
      op: (d) => markDonationReceived(d.id),
      eligibleEmpty: "No PENDING donations selected.",
    });

  const bulkMarkPrinted = () =>
    runBulk({
      label: "marked as PRINTED",
      predicate: (d) => d.donationReceived === "RECEIVED" && !d.isPrinted,
      op: (d) => markDonationPrinted(d.id),
      eligibleEmpty: "No RECEIVED-but-unprinted donations selected.",
    });

  const bulkResendWhatsapp = () =>
    runBulk({
      label: "WhatsApp queued",
      predicate: (d) => Boolean(d.donor?.phone),
      op: (d) => resendDonationWhatsapp(d.id),
      eligibleEmpty: "No donors with a mobile number selected.",
    });

  // ───────────────────── Bulk export ─────────────────────
  const csvRows = useMemo(() => buildCsvRows(selectedRecords), [selectedRecords]);

  const ensureSelected = () => {
    if (selectedRecords.length === 0) {
      toast.info("Select at least one donation first.");
      return false;
    }
    return true;
  };

  const handleExportCsv = () => {
    if (!ensureSelected()) return;
    csvLinkRef.current?.link?.click();
  };

  const handleExportPdf = async () => {
    if (!ensureSelected()) return;
    const records = selectedRecords.filter(
      (d) => d.donationReceived === "RECEIVED"
    );
    if (records.length === 0) {
      toast.error("No RECEIVED donations selected for PDF.");
      return;
    }
    setPrintProgress({ done: 0, total: records.length });
    try {
      await savePdfReceipts(records, (done, total) =>
        setPrintProgress({ done, total })
      );
      toast.success("PDF generated and downloaded.");
      await markPrintedBatch(records);
    } catch (err) {
      console.error("Bulk PDF error:", err);
      toast.error("PDF generation failed.");
    } finally {
      setPrintProgress({ done: 0, total: 0 });
    }
  };

  const handlePrintSelected = async () => {
    if (!ensureSelected()) return;
    const records = selectedRecords.filter(
      (d) => d.donationReceived === "RECEIVED"
    );
    if (records.length === 0) {
      toast.error("No RECEIVED donations selected for printing.");
      return;
    }
    await printReceipts(records);
    toast.success("Selected receipts sent to print.");
    await markPrintedBatch(records);
  };

  // After a successful batch print/PDF, flip the affected rows to PRINTED.
  // Sequential to keep server load predictable; a single failure is logged
  // but doesn't halt the others.
  const markPrintedBatch = async (records) => {
    if (!can(PERMISSIONS.DONATION_MARK_PRINTED)) {
      clearSelection();
      return;
    }
    let failed = 0;
    for (const d of records) {
      if (d.isPrinted) continue;
      try {
        await markDonationPrinted(d.id);
      } catch (err) {
        failed += 1;
        console.error(`Mark printed failed for ${d.id}:`, err);
      }
    }
    if (failed > 0) {
      toast.error(`${failed} donation(s) could not be marked as printed.`);
    }
    clearSelection();
    await fetchPage();
  };

  const confirmTarget = items.find((d) => d.id === confirmDeleteId);

  const fromShown = total > 0 ? (page - 1) * pageSize + 1 : 0;
  const toShown = Math.min(page * pageSize, total);

  const typeOptions = [
    { value: "", label: "All types" },
    ...DONATION_TYPES.map((t) => ({ value: t, label: t })),
  ];
  const statusOptions = [
    { value: "", label: "All statuses" },
    ...STATUSES.map((s) => ({ value: s, label: s })),
  ];
  // Mirrors the badge variants rendered in the WhatsApp column. NONE catches
  // donations whose donor never opted in / no attempt was made.
  const whatsappOptions = [
    { value: "", label: "All WhatsApp" },
    { value: "SENT", label: "Sent" },
    { value: "PENDING", label: "Pending" },
    { value: "FAILED", label: "Failed" },
    { value: "NONE", label: "Not sent" },
  ];
  const pageSizeOptions = [10, 20, 50, 100].map((n) => ({
    value: String(n),
    label: String(n),
  }));

  const selectionCount = selectedRecords.length;
  const exportDisabled = selectionCount === 0 || bulkBusy;

  return (
    <div className="space-y-4">
      {/* PDF generation progress overlay — pinned to the corner so it doesn't
          steal layout from the table during bulk export. */}
      {printProgress.total > 0 && printProgress.done < printProgress.total && (
        <div className="fixed bottom-4 right-4 z-50 flex w-48 flex-col items-center gap-1 rounded-lg border border-border bg-card/95 p-4 shadow-card backdrop-blur">
          <Spinner size="sm" />
          <div className="text-sm font-semibold text-foreground">
            {printProgress.done}/{printProgress.total}
          </div>
          <div className="text-xs text-muted-foreground">Rendering receipts…</div>
        </div>
      )}

      <PageHeader
        title="Manage Donations"
        subtitle={
          can(PERMISSIONS.DONATION_VIEW_ALL)
            ? "Search, edit, and run bulk updates or exports across donations."
            : "Showing donations you added. Contact your admin for broader access."
        }
      />

      {/* Bulk action bar — sticky toolbar that appears when at least one row
          is selected. Selection survives page navigation via `selectedMap`,
          so users can tick rows across multiple pages before acting. The
          Update + Export menus are dropdowns so new operations (e.g. import,
          extra export formats) can be added without crowding the toolbar. */}
      {canAnyBulk && selectionCount > 0 && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-4 py-2 shadow-soft">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-medium text-foreground">
              {selectionCount}
            </span>
            <span className="text-muted-foreground">
              selected across pages
            </span>
            <button
              type="button"
              onClick={clearSelection}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Bulk Update dropdown — gated per-action; entries vanish when
                the user doesn't have the matching permission. */}
            {(can(PERMISSIONS.DONATION_MARK_RECEIVED) ||
              can(PERMISSIONS.DONATION_MARK_PRINTED) ||
              (foundation?.hasWhatsappBusiness &&
                can(PERMISSIONS.DONATION_UPDATE))) && (
              <Dropdown
                trigger={
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={bulkBusy}
                    rightIcon={<ChevronDownIcon className="h-4 w-4" />}
                  >
                    Update
                  </Button>
                }
              >
                <DropdownSection>
                  <DropdownLabel>Status</DropdownLabel>
                  {can(PERMISSIONS.DONATION_MARK_RECEIVED) && (
                    <DropdownItem
                      icon={<CheckCircleIcon className="h-4 w-4" />}
                      onClick={bulkMarkReceived}
                      disabled={bulkBusy}
                    >
                      Mark as Received
                    </DropdownItem>
                  )}
                  {can(PERMISSIONS.DONATION_MARK_PRINTED) && (
                    <DropdownItem
                      icon={<PrinterIcon className="h-4 w-4" />}
                      onClick={bulkMarkPrinted}
                      disabled={bulkBusy}
                    >
                      Mark as Printed
                    </DropdownItem>
                  )}
                </DropdownSection>
                {foundation?.hasWhatsappBusiness &&
                  can(PERMISSIONS.DONATION_UPDATE) && (
                    <DropdownSection>
                      <DropdownLabel>Communications</DropdownLabel>
                      <DropdownItem
                        icon={<PaperAirplaneIcon className="h-4 w-4" />}
                        onClick={bulkResendWhatsapp}
                        disabled={bulkBusy}
                      >
                        Send WhatsApp Receipt
                      </DropdownItem>
                    </DropdownSection>
                  )}
              </Dropdown>
            )}

            {/* Export dropdown — CSV is always available; PDF + Print are
                only meaningful for RECEIVED records and are gated implicitly
                in their handlers. Leaving room for future formats (XLSX,
                JSON) without adding more top-level buttons. */}
            <Dropdown
              trigger={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={exportDisabled}
                  rightIcon={<ChevronDownIcon className="h-4 w-4" />}
                >
                  Export
                </Button>
              }
            >
              <DropdownSection>
                <DropdownLabel>Download</DropdownLabel>
                <DropdownItem
                  icon={<ArrowDownTrayIcon className="h-4 w-4" />}
                  onClick={handleExportCsv}
                  disabled={exportDisabled}
                >
                  Export as CSV
                </DropdownItem>
                <DropdownItem
                  icon={<DocumentArrowDownIcon className="h-4 w-4" />}
                  onClick={handleExportPdf}
                  disabled={exportDisabled}
                >
                  Save as PDF
                </DropdownItem>
              </DropdownSection>
              <DropdownSection>
                <DropdownLabel>Print</DropdownLabel>
                <DropdownItem
                  icon={<PrinterIcon className="h-4 w-4" />}
                  onClick={handlePrintSelected}
                  disabled={exportDisabled}
                >
                  Print Receipts
                </DropdownItem>
              </DropdownSection>
            </Dropdown>

            {/* Hidden CSV anchor — react-csv handles the actual download via
                ref so we can trigger it from a Dropdown item. */}
            <CSVLink
              data={csvRows}
              filename={`donations_${new Date()
                .toISOString()
                .replace(/[-:T]/g, "")
                .split(".")[0]}.csv`}
              className="hidden"
              ref={csvLinkRef}
            />
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Donations ({total})</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchPage}
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
        </CardHeader>

        <CardBody className="space-y-4">
          {/* Filter row — q matches UTR, cheque, notes, donor name, and PAN.
              WhatsApp + amount-range filters give column-level narrowing on
              top of that. */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
            <div className="md:col-span-2">
              <Input
                type="text"
                placeholder="Search name / PAN / UTR / cheque / notes"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                disabled={isFetching}
                leftIcon={<MagnifyingGlassIcon className="h-4 w-4" />}
              />
            </div>
            <Select
              value={type}
              onChange={setType}
              options={typeOptions}
              disabled={isFetching}
            />
            <Select
              value={status}
              onChange={setStatus}
              options={statusOptions}
              disabled={isFetching}
            />
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              disabled={isFetching}
              title="From"
            />
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={isFetching}
              title="To"
            />
            {foundation?.hasWhatsappBusiness && (
              <Select
                value={whatsapp}
                onChange={setWhatsapp}
                options={whatsappOptions}
                disabled={isFetching}
              />
            )}
            <Input
              type="number"
              min="0"
              step="1"
              placeholder="Min ₹"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              disabled={isFetching}
              title="Min amount"
            />
            <Input
              type="number"
              min="0"
              step="1"
              placeholder="Max ₹"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              disabled={isFetching}
              title="Max amount"
            />
            <div className="flex justify-end md:col-span-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                disabled={isFetching}
              >
                Clear filters
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="relative overflow-x-auto">
            {isFetching && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                <Spinner />
              </div>
            )}
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {canAnyBulk && (
                    <th className="w-10 px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={togglePageSelection}
                        disabled={items.length === 0 || bulkBusy}
                        aria-label="Select all rows on this page"
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                    </th>
                  )}
                  <th className="px-4 py-2.5 font-medium">Donor</th>
                  <th className="px-4 py-2.5 font-medium">PAN</th>
                  <th className="px-4 py-2.5 font-medium">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">UTR / Cheque</th>
                  <th className="px-4 py-2.5 font-medium">Bank</th>
                  <th className="px-4 py-2.5 font-medium">Donation Date</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Printed</th>
                  {foundation?.hasWhatsappBusiness && (
                    <th className="px-4 py-2.5 font-medium">WhatsApp</th>
                  )}
                  <th className="w-28 px-4 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {!isFetching && items.length === 0 && (
                  <tr>
                    <td
                      colSpan={
                        10 +
                        (canAnyBulk ? 1 : 0) +
                        (foundation?.hasWhatsappBusiness ? 1 : 0)
                      }
                      className="px-4 py-10 text-center"
                    >
                      <EmptyState
                        title="No donations found"
                        description="No records match the current filters."
                      />
                    </td>
                  </tr>
                )}
                {items.map((d) => {
                  const isPending = d.donationReceived === "PENDING";
                  const canPrint =
                    d.donationReceived === "RECEIVED" && !d.isPrinted;
                  const busy = rowBusyId === d.id;
                  const isSelected = selectedMap.has(d.id);
                  return (
                    <tr
                      key={d.id}
                      className={`hover:bg-muted/40 ${
                        isSelected ? "bg-primary/5" : ""
                      }`}
                    >
                      {canAnyBulk && (
                        <td className="px-4 py-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(d)}
                            disabled={bulkBusy}
                            aria-label={`Select donation from ${
                              d.donor?.fullName ?? "donor"
                            }`}
                            className="h-4 w-4 rounded border-border accent-primary"
                          />
                        </td>
                      )}
                      <td className="px-4 py-2.5">
                        {d.donor?.fullName ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">
                        {d.donor?.pan ?? "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        ₹{formatAmount(d.amount)}
                      </td>
                      <td className="px-4 py-2.5">{d.type}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {d.type === "CHEQUE"
                          ? d.chequeNumber ?? "—"
                          : d.type === "ONLINE"
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
                      <td className="px-4 py-2.5">
                        {d.isPrinted ? (
                          <Badge variant="primary">PRINTED</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      {foundation?.hasWhatsappBusiness && (
                        <td className="px-4 py-2.5">
                          {(() => {
                            // Derive the WhatsApp status badge from the
                            // backend fields — mirrors AddDonation so the two
                            // screens stay visually consistent. The Send /
                            // Resend / Retry button lives inside the actions
                            // Dropdown to keep the column narrow.
                            const isResending = resendingIds.has(d.id);
                            if (isResending || (d.whatsappOptIn && !d.whatsappSentAt && !d.whatsappError)) {
                              return <Badge variant="warning">Pending</Badge>;
                            }
                            if (d.whatsappError) {
                              return (
                                <Badge variant="danger" title={d.whatsappError}>
                                  Failed
                                </Badge>
                              );
                            }
                            if (d.whatsappSentAt) {
                              return <Badge variant="success">Sent</Badge>;
                            }
                            return (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            );
                          })()}
                        </td>
                      )}
                      <td className="px-4 py-2.5">
                        {/* Mark Received / Printed remain inline (primary
                            workflow actions), while Edit / Delete / WhatsApp
                            resend collapse into a three-dots Dropdown so the
                            column doesn't widen as new actions land. */}
                        <div className="flex items-center gap-1">
                          <Can perm={PERMISSIONS.DONATION_MARK_RECEIVED}>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleMarkReceived(d.id)}
                              disabled={!isPending || busy}
                              title={
                                isPending
                                  ? "Mark Received"
                                  : "Already received"
                              }
                              className="text-success hover:bg-success/10 disabled:text-muted-foreground/50"
                            >
                              <CheckCircleIcon className="h-4 w-4" />
                            </Button>
                          </Can>
                          <Can perm={PERMISSIONS.DONATION_MARK_PRINTED}>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleMarkPrinted(d.id)}
                              disabled={!canPrint || busy}
                              title={
                                canPrint
                                  ? "Mark Printed"
                                  : d.isPrinted
                                  ? "Already printed"
                                  : "Donation must be RECEIVED first"
                              }
                              className="text-primary hover:bg-primary/10 disabled:text-muted-foreground/50"
                            >
                              <PrinterIcon className="h-4 w-4" />
                            </Button>
                          </Can>
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
                              {can(PERMISSIONS.DONATION_UPDATE) && (
                                <DropdownItem
                                  icon={<PencilIcon className="h-4 w-4" />}
                                  onClick={() => handleEdit(d)}
                                  disabled={
                                    busy || d.donationReceived === "RECEIVED"
                                  }
                                >
                                  Edit
                                </DropdownItem>
                              )}
                              {foundation?.hasWhatsappBusiness &&
                                can(PERMISSIONS.DONATION_UPDATE) && (
                                  <DropdownItem
                                    icon={
                                      <PaperAirplaneIcon className="h-4 w-4" />
                                    }
                                    onClick={() => handleResendWhatsapp(d)}
                                    disabled={
                                      busy || resendingIds.has(d.id)
                                    }
                                  >
                                    {d.whatsappError
                                      ? "Retry WhatsApp"
                                      : d.whatsappSentAt
                                      ? "Resend WhatsApp"
                                      : "Send WhatsApp"}
                                  </DropdownItem>
                                )}
                              {can(PERMISSIONS.DONATION_DELETE) && (
                                <DropdownItem
                                  icon={<TrashIcon className="h-4 w-4" />}
                                  onClick={() => setConfirmDeleteId(d.id)}
                                  disabled={busy}
                                  danger
                                >
                                  Delete
                                </DropdownItem>
                              )}
                            </DropdownSection>
                          </Dropdown>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBody>

        <CardFooter className="justify-between">
          <span className="text-sm text-muted-foreground">
            Showing {fromShown}-{toShown} of {total} records
          </span>

          <div className="flex items-center gap-3">
            <label
              htmlFor="pageSize"
              className="text-sm text-muted-foreground"
            >
              Rows:
            </label>
            <div className="w-20">
              <Select
                value={String(pageSize)}
                onChange={(v) => setPageSize(Number(v))}
                options={pageSizeOptions}
              />
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isFetching}
              title="Previous"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>

            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isFetching}
              title="Next"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </CardFooter>
      </Card>

      <ConfirmDialog
        open={Boolean(confirmDeleteId)}
        onClose={() => (deleteLoading ? null : setConfirmDeleteId(null))}
        onConfirm={handleDeleteConfirmed}
        title="Delete this donation?"
        description={
          confirmTarget
            ? `This will permanently remove the donation of ₹${formatAmount(
                confirmTarget.amount
              )} from ${confirmTarget.donor?.fullName ?? "—"}.`
            : "This donation will be permanently removed."
        }
        confirmLabel="Delete"
        loading={deleteLoading}
      />
    </div>
  );
};

export default SearchDonation;
