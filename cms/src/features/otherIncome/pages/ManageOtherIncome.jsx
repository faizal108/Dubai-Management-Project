// src/features/otherIncome/pages/ManageOtherIncome.jsx
//
// In-kind receipts register (oil boxes, wheat bags, …). These are NOT money —
// they never post to the ledger or affect cash balances. `estimatedValue` is an
// optional informational valuation only. Built on the shared DataTable.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CubeIcon,
  PrinterIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";

import {
  listOtherIncome,
  createOtherIncome,
  updateOtherIncome,
  deleteOtherIncome,
} from "../api";
import { listCategories } from "../../categories/api";
import { listActivities } from "../../activities/api";
import { listFoundations, getMyFoundation } from "../../foundations/api";
import { printOtherIncomeReceipt, saveOtherIncomeReceiptPdf } from "../lib/receiptTemplate";
import CategorySelect from "../../categories/components/CategorySelect";
import { useAuth } from "../../../context/AuthContext";
import { usePermissions } from "../../../hooks/usePermissions";
import { ROLES } from "../../../constants/roles";
import { PERMISSIONS } from "../../../constants/permissions";
import {
  Button,
  Card,
  CardBody,
  ConfirmDialog,
  DataTable,
  actionsColumn,
  FormField,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
} from "../../../components/ui";

const EMPTY_FORM = {
  itemName: "",
  quantity: "1",
  unit: "",
  categoryId: "",
  donorName: "",
  estimatedValue: "",
  receivedOn: "",
  activityId: "",
  notes: "",
};

const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
};
const fmtAmount = (v) => {
  if (v == null) return "—";
  const n = Number(v);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "—";
};
const toDateInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

export default function ManageOtherIncome() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const isSuperadmin = user?.role === ROLES.SUPERADMIN;
  const canCreate = can(PERMISSIONS.OTHER_INCOME_CREATE);
  const canUpdate = can(PERMISSIONS.OTHER_INCOME_UPDATE);
  const canDelete = can(PERMISSIONS.OTHER_INCOME_DELETE);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState({ by: null, dir: null });
  const [search, setSearch] = useState("");
  const [colFilters, setColFilters] = useState({});

  const [categoryId, setCategoryId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedFoundationId, setSelectedFoundationId] = useState("");

  const [categories, setCategories] = useState([]);
  const [activities, setActivities] = useState([]);
  const [foundations, setFoundations] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formFoundationId, setFormFoundationId] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [foundation, setFoundation] = useState(null);
  const [printingId, setPrintingId] = useState(null);

  const scoped = isSuperadmin && selectedFoundationId ? selectedFoundationId : undefined;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getMyFoundation();
        if (!cancelled) setFoundation(res?.foundation ?? res ?? null);
      } catch (err) {
        console.warn("getMyFoundation failed:", err?.apiError?.message ?? err?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePrint = async (r) => {
    setPrintingId(r.id);
    try {
      await printOtherIncomeReceipt(r, foundation);
    } finally {
      setPrintingId(null);
    }
  };

  const handleDownloadPdf = async (r) => {
    setPrintingId(r.id);
    try {
      await saveOtherIncomeReceiptPdf(r, foundation);
    } catch (err) {
      console.error("Save in-kind receipt PDF error:", err);
      toast.error("Failed to generate PDF.");
    } finally {
      setPrintingId(null);
    }
  };

  useEffect(() => {
    if (!isSuperadmin) return;
    (async () => {
      try {
        const res = await listFoundations({ page: 1, pageSize: 100 });
        setFoundations(res?.items ?? []);
      } catch (err) {
        console.error("Fetch foundations error:", err);
      }
    })();
  }, [isSuperadmin]);

  useEffect(() => {
    (async () => {
      try {
        const params = { page: 1, pageSize: 100 };
        if (scoped) params.foundationId = scoped;
        const [cats, acts] = await Promise.all([
          listCategories({ ...params, kind: "OTHER_INCOME" }),
          listActivities(params),
        ]);
        setCategories(cats?.items ?? []);
        setActivities(acts?.items ?? []);
      } catch (err) {
        console.error("Fetch lookups error:", err);
      }
    })();
  }, [scoped]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        pageSize,
        q: search || undefined,
        sortBy: sort.by || undefined,
        sortDir: sort.by ? sort.dir : undefined,
        categoryId: categoryId || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
        ...colFilters,
      };
      if (scoped) params.foundationId = scoped;
      const res = await listOtherIncome(params);
      setItems(res?.items ?? []);
      setTotal(res?.total ?? 0);
    } catch (err) {
      console.error("Fetch other income error:", err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, sort, colFilters, categoryId, from, to, scoped]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);
  useEffect(() => {
    setPage(1);
  }, [search, colFilters, sort, categoryId, from, to, pageSize, selectedFoundationId]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormFoundationId(selectedFoundationId || "");
    setModalOpen(true);
  };
  const openEdit = (r) => {
    setEditing(r);
    setForm({
      itemName: r.itemName || "",
      quantity: r.quantity != null ? String(r.quantity) : "1",
      unit: r.unit || "",
      categoryId: r.categoryId || "",
      donorName: r.donorName || r.donorNameSnapshot || "",
      estimatedValue: r.estimatedValue != null ? String(r.estimatedValue) : "",
      receivedOn: toDateInput(r.receivedOn),
      activityId: r.activityId || "",
      notes: r.notes || "",
    });
    setModalOpen(true);
  };

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.itemName.trim() || !form.receivedOn) {
      toast.error("Item and received date are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        itemName: form.itemName.trim(),
        quantity: form.quantity || "1",
        unit: form.unit.trim() || undefined,
        categoryId: form.categoryId || undefined,
        donorName: form.donorName.trim() || undefined,
        estimatedValue: form.estimatedValue || undefined,
        receivedOn: new Date(form.receivedOn).toISOString(),
        activityId: form.activityId || undefined,
        notes: form.notes.trim() || undefined,
      };
      if (editing) {
        await updateOtherIncome(editing.id, payload);
        toast.success("In-kind receipt updated.");
      } else {
        if (isSuperadmin && formFoundationId) payload.foundationId = formFoundationId;
        await createOtherIncome(payload);
        toast.success("In-kind receipt recorded.");
      }
      setModalOpen(false);
      await fetchRows();
    } catch (err) {
      console.error("Save other income error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleting(true);
    try {
      await deleteOtherIncome(confirmDeleteId);
      toast.info("In-kind receipt deleted.");
      setConfirmDeleteId(null);
      await fetchRows();
    } catch (err) {
      console.error("Delete other income error:", err);
    } finally {
      setDeleting(false);
    }
  };

  const categoryFilterOptions = useMemo(
    () => [
      { value: "", label: "All categories" },
      ...categories.map((c) => ({ value: c.id, label: c.name })),
    ],
    [categories]
  );
  const activityOptions = useMemo(
    () => [
      { value: "", label: "— None —" },
      ...activities.filter((a) => !a.isDeleted).map((a) => ({ value: a.id, label: a.title || a.name })),
    ],
    [activities]
  );
  const foundationOptions = useMemo(
    () => [
      { value: "", label: "All foundations" },
      ...foundations.map((f) => ({ value: f.id, label: f.name })),
    ],
    [foundations]
  );
  const foundationPickOptions = useMemo(
    () => [
      { value: "", label: "— Select a foundation —" },
      ...foundations.map((f) => ({ value: f.id, label: `${f.name} (${f.pan})` })),
    ],
    [foundations]
  );

  const columns = useMemo(
    () => [
      { key: "receivedOn", header: "Date", sortable: true, width: "8rem", cell: (r) => fmtDate(r.receivedOn) },
      {
        key: "itemName",
        header: "Item",
        sortable: true,
        filter: { type: "text", placeholder: "Item…" },
        cell: (r) => <span className="font-medium">{r.itemName}</span>,
      },
      {
        key: "quantity",
        header: "Qty",
        sortable: true,
        align: "right",
        width: "7rem",
        cell: (r) => (
          <span className="tabular-nums">
            {Number(r.quantity)} {r.unit || ""}
          </span>
        ),
      },
      { key: "category", header: "Category", cell: (r) => r.categoryName || "—" },
      { key: "donor", header: "Donor", cell: (r) => r.donorName || "—" },
      {
        key: "estimatedValue",
        header: "Est. Value",
        sortable: true,
        align: "right",
        width: "8rem",
        cell: (r) =>
          r.estimatedValue != null ? (
            <span className="tabular-nums text-muted-foreground">₹{fmtAmount(r.estimatedValue)}</span>
          ) : (
            "—"
          ),
      },
      { key: "activity", header: "Activity", cell: (r) => r.activityTitle || "—" },
      actionsColumn({
        items: (r) => [
          {
            label: "Print Receipt",
            icon: <PrinterIcon className="h-4 w-4" />,
            onClick: () => handlePrint(r),
            disabled: printingId === r.id,
          },
          {
            label: "Download PDF",
            icon: <ArrowDownTrayIcon className="h-4 w-4" />,
            onClick: () => handleDownloadPdf(r),
            disabled: printingId === r.id,
          },
          { label: "Edit", icon: <PencilIcon className="h-4 w-4" />, onClick: () => openEdit(r), disabled: !canUpdate },
          {
            label: "Delete",
            icon: <TrashIcon className="h-4 w-4" />,
            danger: true,
            onClick: () => setConfirmDeleteId(r.id),
            disabled: !canDelete,
          },
        ],
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canUpdate, canDelete, printingId, foundation]
  );

  return (
    <div>
      <PageHeader
        title="Other Donation (in-kind)"
        subtitle="Record non-cash contributions like goods and materials. These are tracked separately from money and never affect cash balances."
        actions={
          canCreate && (
            <Button onClick={openCreate} leftIcon={<PlusIcon className="h-4 w-4" />}>
              Add In-kind Receipt
            </Button>
          )
        }
      />

      <Card>
        <CardBody>
          <DataTable
            columns={columns}
            rows={items}
            total={total}
            loading={loading}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            sort={sort}
            onSortChange={setSort}
            globalSearch={search}
            onGlobalSearchChange={setSearch}
            searchPlaceholder="Search item / donor / notes"
            columnFilters={colFilters}
            onColumnFiltersChange={setColFilters}
            emptyIcon={CubeIcon}
            emptyTitle="No in-kind receipts"
            emptyDescription="Record a non-cash donation with the button above."
            toolbarSlot={
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-48">
                  <Select value={categoryId} onChange={setCategoryId} options={categoryFilterOptions} />
                </div>
                {isSuperadmin && (
                  <div className="w-48">
                    <Select value={selectedFoundationId} onChange={setSelectedFoundationId} options={foundationOptions} />
                  </div>
                )}
                <div className="w-36">
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="From" />
                </div>
                <div className="w-36">
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="To" />
                </div>
              </div>
            }
          />
        </CardBody>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => (saving ? null : setModalOpen(false))}
        title={editing ? "Edit In-kind Receipt" : "Add In-kind Receipt"}
        size="2xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="oi-form" loading={saving}>
              {editing ? "Update" : "Save"}
            </Button>
          </>
        }
      >
        <form id="oi-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {isSuperadmin && !editing && (
            <div className="md:col-span-2">
              <FormField label="Foundation" required>
                <Select value={formFoundationId} onChange={setFormFoundationId} options={foundationPickOptions} disabled={saving} />
              </FormField>
            </div>
          )}
          <div className="md:col-span-2">
            <FormField label="Item" required>
              <Input
                value={form.itemName}
                onChange={(e) => setField("itemName", e.target.value)}
                placeholder="e.g. Refined oil box, Wheat bag"
                disabled={saving}
              />
            </FormField>
          </div>
          <FormField label="Quantity" required>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.quantity}
              onChange={(e) => setField("quantity", e.target.value)}
              disabled={saving}
            />
          </FormField>
          <FormField label="Unit" hint="e.g. boxes, kg, bags">
            <Input value={form.unit} onChange={(e) => setField("unit", e.target.value)} disabled={saving} />
          </FormField>
          <FormField label="Category">
            <CategorySelect
              kind="OTHER_INCOME"
              value={form.categoryId}
              onChange={(v) => setField("categoryId", v)}
              foundationId={isSuperadmin ? formFoundationId || undefined : undefined}
              disabled={saving}
              placeholder="— None —"
            />
          </FormField>
          <FormField label="Donor">
            <Input
              value={form.donorName}
              onChange={(e) => setField("donorName", e.target.value)}
              placeholder="Donor name (optional)"
              disabled={saving}
            />
          </FormField>
          <FormField label="Estimated value (₹)" hint="Optional — informational only, not counted as cash.">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.estimatedValue}
              onChange={(e) => setField("estimatedValue", e.target.value)}
              placeholder="0.00"
              disabled={saving}
            />
          </FormField>
          <FormField label="Received on" required>
            <Input
              type="date"
              value={form.receivedOn}
              onChange={(e) => setField("receivedOn", e.target.value)}
              disabled={saving}
            />
          </FormField>
          <FormField label="Activity">
            <Select value={form.activityId} onChange={(v) => setField("activityId", v)} options={activityOptions} disabled={saving} />
          </FormField>
          <div className="md:col-span-2">
            <FormField label="Notes">
              <Textarea rows={2} value={form.notes} onChange={(e) => setField("notes", e.target.value)} disabled={saving} />
            </FormField>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDeleteId}
        onClose={() => (deleting ? null : setConfirmDeleteId(null))}
        onConfirm={handleDelete}
        title="Delete in-kind receipt?"
        description="Soft-delete this record. You can restore it later."
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
}
