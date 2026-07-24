// src/features/donations/pages/SearchDonation.jsx
// Unified donation workspace on the shared DataTable. Server-side global search
// (q), per-column search + sort, and pagination drive the list; date/amount
// windows live in the toolbar. Cross-page bulk selection (Map<id, donation>),
// the bulk action bar, inline lifecycle actions, and WhatsApp/print flows are
// preserved.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CSVLink } from "react-csv";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  PrinterIcon,
  PencilIcon,
  TrashIcon,
  PaperAirplaneIcon,
  EllipsisVerticalIcon,
  ArrowDownTrayIcon,
  DocumentArrowDownIcon,
  XMarkIcon,
  ChevronDownIcon,
  BanknotesIcon,
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
import { listCategories } from "../../categories/api";
import { buildCsvRows, printReceipts, savePdfReceipts } from "../lib/receiptTemplate";
import Can from "../../../components/Can";
import { PERMISSIONS } from "../../../constants/permissions";
import { usePermissions } from "../../../hooks/usePermissions";
import {
  Button,
  Card,
  CardBody,
  ConfirmDialog,
  Input,
  Badge,
  PageHeader,
  Spinner,
  Dropdown,
  DropdownItem,
  DropdownSection,
  DropdownLabel,
  DataTable,
  selectionColumn,
} from "../../../components/ui";

const DONATION_TYPES = ["CASH", "CHEQUE", "ONLINE", "UPI"];

const formatAmount = (amount) => {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
};

const SearchDonation = () => {
  const navigate = useNavigate();
  const { can } = usePermissions();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [isFetching, setIsFetching] = useState(false);

  // Table query state.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState({ by: null, dir: null });
  const [search, setSearch] = useState("");
  const [colFilters, setColFilters] = useState({});

  // Toolbar (window) filters.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  const [rowBusyId, setRowBusyId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [resendingIds, setResendingIds] = useState(() => new Set());

  // Cross-page selection.
  const [selectedMap, setSelectedMap] = useState(() => new Map());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [printProgress, setPrintProgress] = useState({ done: 0, total: 0 });
  const csvLinkRef = useRef(null);

  const [foundation, setFoundation] = useState(null);
  const [incomeCategories, setIncomeCategories] = useState([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getMyFoundation();
        if (!cancelled) setFoundation(res?.foundation ?? res ?? null);
      } catch (err) {
        console.warn("getMyFoundation failed:", err?.apiError?.message ?? err?.message);
      }
      try {
        const cats = await listCategories({ kind: "INCOME", page: 1, pageSize: 100 });
        if (!cancelled) setIncomeCategories(cats?.items ?? []);
      } catch (err) {
        console.warn("listCategories failed:", err?.apiError?.message ?? err?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const params = useMemo(
    () => ({
      page,
      pageSize,
      q: search || undefined,
      sortBy: sort.by || undefined,
      sortDir: sort.by ? sort.dir : undefined,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
      minAmount: minAmount !== "" ? minAmount : undefined,
      maxAmount: maxAmount !== "" ? maxAmount : undefined,
      ...colFilters,
    }),
    [page, pageSize, search, sort, colFilters, from, to, minAmount, maxAmount]
  );

  const fetchPage = async () => {
    setIsFetching(true);
    try {
      const res = await listDonations(params);
      setItems(res?.items ?? []);
      setTotal(res?.total ?? 0);
    } catch (err) {
      console.error("Fetch donations error:", err);
      setItems([]);
      setTotal(0);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(fetchPage, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    setPage(1);
  }, [search, colFilters, sort, from, to, minAmount, maxAmount, pageSize]);

  const clearAll = () => {
    setSearch("");
    setColFilters({});
    setFrom("");
    setTo("");
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

  const handleResendWhatsapp = async (d) => {
    const id = d.id;
    setResendingIds((prev) => new Set(prev).add(id));
    setItems((prev) =>
      prev.map((row) =>
        row.id === id
          ? { ...row, whatsappOptIn: true, whatsappSentAt: null, whatsappError: null }
          : row
      )
    );
    try {
      await resendDonationWhatsapp(id);
      toast.info("WhatsApp receipt queued.");
      setTimeout(fetchPage, 900);
    } catch (err) {
      console.error("Resend WhatsApp error:", err);
      toast.error(err?.apiError?.message ?? "Could not resend the WhatsApp receipt.");
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

  // ── Selection ──
  const selectedRecords = useMemo(() => Array.from(selectedMap.values()), [selectedMap]);

  const toggleRow = (d) =>
    setSelectedMap((m) => {
      const next = new Map(m);
      if (next.has(d.id)) next.delete(d.id);
      else next.set(d.id, d);
      return next;
    });

  const allOnPageSelected = items.length > 0 && items.every((d) => selectedMap.has(d.id));

  const toggleAllOnPage = (rows, checked) =>
    setSelectedMap((m) => {
      const next = new Map(m);
      if (checked) rows.forEach((d) => next.set(d.id, d));
      else rows.forEach((d) => next.delete(d.id));
      return next;
    });

  const clearSelection = () => setSelectedMap(new Map());

  const canAnyBulk =
    can(PERMISSIONS.DONATION_MARK_RECEIVED) ||
    can(PERMISSIONS.DONATION_MARK_PRINTED) ||
    can(PERMISSIONS.DONATION_UPDATE) ||
    can(PERMISSIONS.REPORT_VIEW);

  // ── Bulk fan-out ──
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

  // ── Bulk export ──
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
    const records = selectedRecords.filter((d) => d.donationReceived === "RECEIVED");
    if (records.length === 0) {
      toast.error("No RECEIVED donations selected for PDF.");
      return;
    }
    setPrintProgress({ done: 0, total: records.length });
    try {
      await savePdfReceipts(records, (done, t) => setPrintProgress({ done, total: t }), foundation);
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
    const records = selectedRecords.filter((d) => d.donationReceived === "RECEIVED");
    if (records.length === 0) {
      toast.error("No RECEIVED donations selected for printing.");
      return;
    }
    await printReceipts(records, foundation);
    toast.success("Selected receipts sent to print.");
    await markPrintedBatch(records);
  };

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
    if (failed > 0) toast.error(`${failed} donation(s) could not be marked as printed.`);
    clearSelection();
    await fetchPage();
  };

  const confirmTarget = items.find((d) => d.id === confirmDeleteId);
  const selectionCount = selectedRecords.length;
  const exportDisabled = selectionCount === 0 || bulkBusy;

  // ── Row actions cell ──
  const renderActions = (d) => {
    const isPending = d.donationReceived === "PENDING";
    const canPrint = d.donationReceived === "RECEIVED" && !d.isPrinted;
    const busy = rowBusyId === d.id;
    return (
      <div className="flex items-center justify-end gap-1">
        <Can perm={PERMISSIONS.DONATION_MARK_RECEIVED}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleMarkReceived(d.id)}
            disabled={!isPending || busy}
            title={isPending ? "Mark Received" : "Already received"}
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
            title={canPrint ? "Mark Printed" : d.isPrinted ? "Already printed" : "Donation must be RECEIVED first"}
            className="text-primary hover:bg-primary/10 disabled:text-muted-foreground/50"
          >
            <PrinterIcon className="h-4 w-4" />
          </Button>
        </Can>
        <Dropdown
          trigger={
            <Button variant="ghost" size="icon" title="More actions" aria-label="More actions">
              <EllipsisVerticalIcon className="h-4 w-4" />
            </Button>
          }
        >
          <DropdownSection>
            {can(PERMISSIONS.DONATION_UPDATE) && (
              <DropdownItem
                icon={<PencilIcon className="h-4 w-4" />}
                onClick={() => handleEdit(d)}
                disabled={busy || d.donationReceived === "RECEIVED"}
              >
                Edit
              </DropdownItem>
            )}
            {foundation?.hasWhatsappBusiness && can(PERMISSIONS.DONATION_UPDATE) && (
              <DropdownItem
                icon={<PaperAirplaneIcon className="h-4 w-4" />}
                onClick={() => handleResendWhatsapp(d)}
                disabled={busy || resendingIds.has(d.id)}
              >
                {d.whatsappError ? "Retry WhatsApp" : d.whatsappSentAt ? "Resend WhatsApp" : "Send WhatsApp"}
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
    );
  };

  const whatsappCell = (d) => {
    const isResending = resendingIds.has(d.id);
    if (isResending || (d.whatsappOptIn && !d.whatsappSentAt && !d.whatsappError)) {
      return <Badge variant="warning">Pending</Badge>;
    }
    if (d.whatsappError) return <Badge variant="danger" title={d.whatsappError}>Failed</Badge>;
    if (d.whatsappSentAt) return <Badge variant="success">Sent</Badge>;
    return <span className="text-xs text-muted-foreground">—</span>;
  };

  // Columns rebuilt each render so selection state + closures stay fresh.
  const columns = [];
  if (canAnyBulk) {
    columns.push(
      selectionColumn({
        isSelected: (d) => selectedMap.has(d.id),
        onToggleRow: toggleRow,
        pageRows: items,
        allSelected: allOnPageSelected,
        onToggleAll: toggleAllOnPage,
        disabled: bulkBusy,
      })
    );
  }
  columns.push(
    {
      key: "donor",
      header: "Donor",
      filter: { type: "text", param: "donorName", placeholder: "Name…" },
      cell: (d) => d.donor?.fullName ?? d.donorNameSnapshot ?? "—",
    },
    {
      key: "pan",
      header: "PAN",
      filter: { type: "text", param: "pan", placeholder: "PAN…" },
      cell: (d) => <span className="font-mono text-xs">{d.donor?.pan ?? "—"}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      align: "right",
      width: "8rem",
      cell: (d) => <span className="tabular-nums">₹{formatAmount(d.amount)}</span>,
    },
    {
      key: "type",
      header: "Type",
      sortable: true,
      width: "8rem",
      filter: {
        type: "select",
        options: [{ value: "", label: "All types" }, ...DONATION_TYPES.map((t) => ({ value: t, label: t }))],
      },
      cell: (d) => d.type,
    },
    {
      key: "reference",
      header: "UTR / Cheque",
      filter: { type: "text", param: "utr", placeholder: "UTR / cheque…" },
      cell: (d) =>
        d.type === "CHEQUE" ? d.chequeNumber ?? "—" : d.type === "CASH" ? "—" : d.utr ?? "—",
    },
    {
      key: "bankName",
      header: "Bank",
      filter: { type: "text", param: "bankName", placeholder: "Bank…" },
      cell: (d) => <span className="text-muted-foreground">{d.bankName ?? "—"}</span>,
    },
    {
      key: "incomeCategory",
      header: "Income Category",
      filter: {
        type: "select",
        param: "incomeCategoryId",
        options: [
          { value: "", label: "All" },
          ...incomeCategories.map((c) => ({ value: c.id, label: c.name })),
        ],
      },
      cell: (d) => (
        <span className="text-muted-foreground">{d.incomeCategory?.name ?? "—"}</span>
      ),
    },
    {
      key: "donationDate",
      header: "Donation Date",
      sortable: true,
      cell: (d) => (d.donationDate ? new Date(d.donationDate).toLocaleDateString() : "—"),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortField: "donationReceived",
      width: "8rem",
      filter: {
        type: "select",
        options: [
          { value: "", label: "All" },
          { value: "PENDING", label: "PENDING" },
          { value: "RECEIVED", label: "RECEIVED" },
        ],
      },
      cell: (d) => (
        <Badge variant={d.donationReceived === "RECEIVED" ? "success" : "warning"}>
          {d.donationReceived}
        </Badge>
      ),
    },
    {
      key: "printed",
      header: "Printed",
      cell: (d) =>
        d.isPrinted ? <Badge variant="primary">PRINTED</Badge> : <span className="text-muted-foreground">—</span>,
    }
  );
  if (foundation?.hasWhatsappBusiness) {
    columns.push({
      key: "whatsapp",
      header: "WhatsApp",
      filter: {
        type: "select",
        param: "whatsapp",
        options: [
          { value: "", label: "All" },
          { value: "SENT", label: "Sent" },
          { value: "PENDING", label: "Pending" },
          { value: "FAILED", label: "Failed" },
          { value: "NONE", label: "Not sent" },
        ],
      },
      cell: whatsappCell,
    });
  }
  columns.push({
    key: "actions",
    header: "Actions",
    hideable: false,
    align: "right",
    width: "7rem",
    cell: renderActions,
  });

  return (
    <div className="space-y-4">
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

      {canAnyBulk && selectionCount > 0 && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-4 py-2 shadow-soft">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-medium text-foreground">{selectionCount}</span>
            <span className="text-muted-foreground">selected across pages</span>
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
            {(can(PERMISSIONS.DONATION_MARK_RECEIVED) ||
              can(PERMISSIONS.DONATION_MARK_PRINTED) ||
              (foundation?.hasWhatsappBusiness && can(PERMISSIONS.DONATION_UPDATE))) && (
              <Dropdown
                trigger={
                  <Button variant="outline" size="sm" disabled={bulkBusy} rightIcon={<ChevronDownIcon className="h-4 w-4" />}>
                    Update
                  </Button>
                }
              >
                <DropdownSection>
                  <DropdownLabel>Status</DropdownLabel>
                  {can(PERMISSIONS.DONATION_MARK_RECEIVED) && (
                    <DropdownItem icon={<CheckCircleIcon className="h-4 w-4" />} onClick={bulkMarkReceived} disabled={bulkBusy}>
                      Mark as Received
                    </DropdownItem>
                  )}
                  {can(PERMISSIONS.DONATION_MARK_PRINTED) && (
                    <DropdownItem icon={<PrinterIcon className="h-4 w-4" />} onClick={bulkMarkPrinted} disabled={bulkBusy}>
                      Mark as Printed
                    </DropdownItem>
                  )}
                </DropdownSection>
                {foundation?.hasWhatsappBusiness && can(PERMISSIONS.DONATION_UPDATE) && (
                  <DropdownSection>
                    <DropdownLabel>Communications</DropdownLabel>
                    <DropdownItem icon={<PaperAirplaneIcon className="h-4 w-4" />} onClick={bulkResendWhatsapp} disabled={bulkBusy}>
                      Send WhatsApp Receipt
                    </DropdownItem>
                  </DropdownSection>
                )}
              </Dropdown>
            )}
            <Dropdown
              trigger={
                <Button variant="outline" size="sm" disabled={exportDisabled} rightIcon={<ChevronDownIcon className="h-4 w-4" />}>
                  Export
                </Button>
              }
            >
              <DropdownSection>
                <DropdownLabel>Download</DropdownLabel>
                <DropdownItem icon={<ArrowDownTrayIcon className="h-4 w-4" />} onClick={handleExportCsv} disabled={exportDisabled}>
                  Export as CSV
                </DropdownItem>
                <DropdownItem icon={<DocumentArrowDownIcon className="h-4 w-4" />} onClick={handleExportPdf} disabled={exportDisabled}>
                  Save as PDF
                </DropdownItem>
              </DropdownSection>
              <DropdownSection>
                <DropdownLabel>Print</DropdownLabel>
                <DropdownItem icon={<PrinterIcon className="h-4 w-4" />} onClick={handlePrintSelected} disabled={exportDisabled}>
                  Print Receipts
                </DropdownItem>
              </DropdownSection>
            </Dropdown>
            <CSVLink
              data={csvRows}
              filename={`donations_${new Date().toISOString().replace(/[-:T]/g, "").split(".")[0]}.csv`}
              className="hidden"
              ref={csvLinkRef}
            />
          </div>
        </div>
      )}

      <Card>
        <CardBody>
          <DataTable
            columns={columns}
            rows={items}
            total={total}
            loading={isFetching}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            sort={sort}
            onSortChange={setSort}
            globalSearch={search}
            onGlobalSearchChange={setSearch}
            searchPlaceholder="Search name / PAN / UTR / cheque / notes"
            columnFilters={colFilters}
            onColumnFiltersChange={setColFilters}
            emptyIcon={BanknotesIcon}
            emptyTitle="No donations found"
            emptyDescription="No records match the current filters."
            toolbarSlot={
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-36">
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="From" />
                </div>
                <div className="w-36">
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="To" />
                </div>
                <div className="w-24">
                  <Input
                    type="number"
                    min="0"
                    placeholder="Min ₹"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                  />
                </div>
                <div className="w-24">
                  <Input
                    type="number"
                    min="0"
                    placeholder="Max ₹"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                  />
                </div>
                <Button variant="ghost" size="sm" onClick={clearAll} disabled={isFetching}>
                  Clear
                </Button>
              </div>
            }
            toolbarEnd={
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchPage}
                disabled={isFetching}
                leftIcon={<ArrowPathIcon className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />}
              >
                Refresh
              </Button>
            }
          />
        </CardBody>
      </Card>

      <ConfirmDialog
        open={Boolean(confirmDeleteId)}
        onClose={() => (deleteLoading ? null : setConfirmDeleteId(null))}
        onConfirm={handleDeleteConfirmed}
        title="Delete this donation?"
        description={
          confirmTarget
            ? `This will permanently remove the donation of ₹${formatAmount(confirmTarget.amount)} from ${confirmTarget.donor?.fullName ?? "—"}.`
            : "This donation will be permanently removed."
        }
        confirmLabel="Delete"
        loading={deleteLoading}
      />
    </div>
  );
};

export default SearchDonation;
