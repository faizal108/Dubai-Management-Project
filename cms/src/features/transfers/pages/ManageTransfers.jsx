// src/features/transfers/pages/ManageTransfers.jsx
//
// Accounting → Transfer workspace. Records internal money movement between the
// foundation's own buckets and manages the fixed-deposit register:
//   • Cash → Bank   (deposit cash into a bank account)
//   • Bank → Cash   (withdraw cash from a bank account)
//   • Bank → FD     (park money into a new fixed deposit)
//   • FD → Bank     (return a matured deposit; captures interest earned)
//
// Transfers are NOT income or expense — the accounting service excludes them
// from those aggregates. Each transfer posts paired (cash<->bank) or single
// (FD) ledger legs server-side, so this page only creates/lists/reverses.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  ArrowsRightLeftIcon,
  PlusIcon,
  TrashIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
} from "@heroicons/react/24/outline";

import { listTransfers, listFixedDeposits, createTransfer, deleteTransfer } from "../api";
import { listBankAccounts } from "../../bankAccounts/api";
import { listFoundations } from "../../foundations/api";
import { useAuth } from "../../../context/AuthContext";
import { usePermissions } from "../../../hooks/usePermissions";
import { ROLES } from "../../../constants/roles";
import { PERMISSIONS } from "../../../constants/permissions";
import { formatAmount, formatDate, toIsoDate } from "../../accounting/utils";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  ConfirmDialog,
  DataTable,
  actionsColumn,
  EmptyState,
  FormField,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Tabs,
  TabsList,
  TabItem,
  TabPanels,
  TabPanel,
  Textarea,
} from "../../../components/ui";

const KIND_OPTIONS = [
  { value: "CASH_TO_BANK", label: "Cash → Bank (deposit cash)" },
  { value: "BANK_TO_CASH", label: "Bank → Cash (withdraw cash)" },
  { value: "BANK_TO_FD", label: "Bank → Fixed Deposit" },
  { value: "FD_TO_BANK", label: "Fixed Deposit → Bank (return)" },
];

const KIND_BADGE = {
  CASH_TO_BANK: { variant: "primary", label: "Cash → Bank" },
  BANK_TO_CASH: { variant: "warning", label: "Bank → Cash" },
  BANK_TO_FD: { variant: "primary", label: "Bank → FD" },
  FD_TO_BANK: { variant: "success", label: "FD → Bank" },
};

const emptyForm = {
  kind: "CASH_TO_BANK",
  bankAccountId: "",
  cashAccountId: "",
  amount: "",
  occurredAt: "",
  notes: "",
  // Bank → FD
  label: "",
  interestRate: "",
  maturityDate: "",
  fdBankName: "",
  receiptNumber: "",
  // FD → Bank
  fixedDepositId: "",
  returnAmount: "",
  closedOn: "",
};

const accountLabel = (a) => {
  const detail = a.upiId || [a.bankName, a.accountNumber].filter(Boolean).join(" · ");
  return `${a.label} · ${a.category}${detail ? ` — ${detail}` : ""}`;
};

const describeEndpoints = (t) => {
  // A readable "from → to" cell independent of which fields a kind populates.
  const from =
    t.kind === "FD_TO_BANK"
      ? t.fixedDeposit?.label
        ? `FD: ${t.fixedDeposit.label}`
        : "Fixed deposit"
      : t.fromBankAccount?.label || "—";
  const to =
    t.kind === "BANK_TO_FD"
      ? t.fixedDeposit?.label
        ? `FD: ${t.fixedDeposit.label}`
        : "Fixed deposit"
      : t.toBankAccount?.label || "—";
  return { from, to };
};

const ManageTransfers = () => {
  const { user } = useAuth();
  const { can } = usePermissions();
  const isSuperadmin = user?.role === ROLES.SUPERADMIN;
  const canManage = can(PERMISSIONS.TRANSFER_MANAGE);

  // Transfers list + table query state.
  const [transfers, setTransfers] = useState([]);
  const [tPage, setTPage] = useState(1);
  const [tPageSize, setTPageSize] = useState(25);
  const [tTotal, setTTotal] = useState(0);
  const [tLoading, setTLoading] = useState(false);
  const [tSort, setTSort] = useState({ by: null, dir: null });
  const [tColFilters, setTColFilters] = useState({});

  // Fixed-deposit register (fetched in bulk so totals are accurate).
  const [fds, setFds] = useState([]);
  const [fdLoading, setFdLoading] = useState(false);

  // Lookups.
  const [selectedFoundationId, setSelectedFoundationId] = useState("");
  const [foundations, setFoundations] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);

  // Modal + form.
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  // Reverse confirm.
  const [toReverse, setToReverse] = useState(null);
  const [reversing, setReversing] = useState(false);

  const scopedParams = useCallback(
    (extra = {}) => {
      const p = { ...extra };
      if (isSuperadmin && selectedFoundationId) p.foundationId = selectedFoundationId;
      return p;
    },
    [isSuperadmin, selectedFoundationId]
  );

  // SUPERADMIN foundation picker options.
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

  const fetchBankAccounts = useCallback(async () => {
    try {
      const res = await listBankAccounts(scopedParams({ page: 1, pageSize: 100 }));
      setBankAccounts(res?.items ?? []);
    } catch (err) {
      console.error("Fetch bank accounts error:", err);
    }
  }, [scopedParams]);

  const fetchTransfers = useCallback(async () => {
    setTLoading(true);
    try {
      const res = await listTransfers(
        scopedParams({
          page: tPage,
          pageSize: tPageSize,
          sortBy: tSort.by || undefined,
          sortDir: tSort.by ? tSort.dir : undefined,
          ...tColFilters,
        })
      );
      setTransfers(res?.items ?? []);
      setTTotal(res?.total ?? 0);
    } catch (err) {
      console.error("Fetch transfers error:", err);
    } finally {
      setTLoading(false);
    }
  }, [scopedParams, tPage, tPageSize, tSort, tColFilters]);

  const fetchFds = useCallback(async () => {
    setFdLoading(true);
    try {
      const res = await listFixedDeposits(scopedParams({ page: 1, pageSize: 100 }));
      setFds(res?.items ?? []);
    } catch (err) {
      console.error("Fetch fixed deposits error:", err);
    } finally {
      setFdLoading(false);
    }
  }, [scopedParams]);

  useEffect(() => {
    fetchBankAccounts();
  }, [fetchBankAccounts]);
  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);
  useEffect(() => {
    fetchFds();
  }, [fetchFds]);
  useEffect(() => {
    setTPage(1);
  }, [selectedFoundationId, tSort, tColFilters, tPageSize]);

  const bankOptions = useMemo(
    () => [
      { value: "", label: "— Select bank account —" },
      ...bankAccounts
        .filter((a) => a.accountNumber)
        .map((a) => ({ value: a.id, label: accountLabel(a) })),
    ],
    [bankAccounts]
  );
  const cashOptions = useMemo(
    () => [
      { value: "", label: "Cash in Hand (auto)" },
      ...bankAccounts
        .filter((a) => !a.accountNumber)
        .map((a) => ({ value: a.id, label: accountLabel(a) })),
    ],
    [bankAccounts]
  );
  const activeFdOptions = useMemo(
    () => [
      { value: "", label: "— Select fixed deposit —" },
      ...fds
        .filter((f) => f.status === "ACTIVE")
        .map((f) => ({
          value: f.id,
          label: `${f.label} · ₹${formatAmount(f.principal)}${
            f.maturityDate ? ` · matures ${formatDate(f.maturityDate)}` : ""
          }`,
        })),
    ],
    [fds]
  );
  const foundationOptions = useMemo(
    () => [
      { value: "", label: "Select foundation…" },
      ...foundations.map((f) => ({ value: f.id, label: f.name })),
    ],
    [foundations]
  );

  const fdTotals = useMemo(() => {
    let activePrincipal = 0;
    let interestEarned = 0;
    for (const f of fds) {
      if (f.status === "ACTIVE") activePrincipal += Number(f.principal) || 0;
      if (f.status === "CLOSED" && f.interestEarned != null)
        interestEarned += Number(f.interestEarned) || 0;
    }
    return { activePrincipal, interestEarned };
  }, [fds]);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const openModal = () => {
    setForm(emptyForm);
    setModalOpen(true);
  };

  const onSelectFd = (id) => {
    const fd = fds.find((f) => f.id === id);
    setForm((f) => ({
      ...f,
      fixedDepositId: id,
      // Prefill the return with the principal as a starting point.
      returnAmount: f.returnAmount || (fd ? String(fd.principal) : ""),
    }));
  };

  const buildPayload = () => {
    const { kind } = form;
    const base = {};
    if (isSuperadmin && selectedFoundationId) base.foundationId = selectedFoundationId;
    if (form.notes.trim()) base.notes = form.notes.trim();

    if (kind === "CASH_TO_BANK") {
      return {
        ...base,
        kind,
        toBankAccountId: form.bankAccountId,
        fromBankAccountId: form.cashAccountId || undefined,
        amount: form.amount,
        occurredAt: toIsoDate(form.occurredAt),
      };
    }
    if (kind === "BANK_TO_CASH") {
      return {
        ...base,
        kind,
        fromBankAccountId: form.bankAccountId,
        toBankAccountId: form.cashAccountId || undefined,
        amount: form.amount,
        occurredAt: toIsoDate(form.occurredAt),
      };
    }
    if (kind === "BANK_TO_FD") {
      return {
        ...base,
        kind,
        fromBankAccountId: form.bankAccountId,
        amount: form.amount,
        label: form.label.trim(),
        interestRate: form.interestRate || undefined,
        maturityDate: toIsoDate(form.maturityDate),
        bankName: form.fdBankName.trim() || undefined,
        receiptNumber: form.receiptNumber.trim() || undefined,
        occurredAt: toIsoDate(form.occurredAt),
      };
    }
    // FD_TO_BANK
    return {
      ...base,
      kind,
      fixedDepositId: form.fixedDepositId,
      toBankAccountId: form.bankAccountId,
      returnAmount: form.returnAmount,
      closedOn: toIsoDate(form.closedOn),
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createTransfer(buildPayload());
      toast.success("Transfer recorded");
      setModalOpen(false);
      // Balances, transfers, and FDs all change on a successful transfer.
      await Promise.all([fetchTransfers(), fetchFds(), fetchBankAccounts()]);
    } catch (err) {
      // Interceptor already surfaced the error toast.
      console.error("Create transfer error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReverse = async () => {
    if (!toReverse) return;
    setReversing(true);
    try {
      await deleteTransfer(toReverse.id);
      toast.success("Transfer reversed");
      setToReverse(null);
      await Promise.all([fetchTransfers(), fetchFds(), fetchBankAccounts()]);
    } catch (err) {
      console.error("Reverse transfer error:", err);
    } finally {
      setReversing(false);
    }
  };

  // ---- Modal field visibility per kind ----
  const kind = form.kind;
  const showCashSide = kind === "CASH_TO_BANK" || kind === "BANK_TO_CASH";
  const isFdReturn = kind === "FD_TO_BANK";
  const isFdOpen = kind === "BANK_TO_FD";
  const bankLabel =
    kind === "CASH_TO_BANK" || kind === "FD_TO_BANK"
      ? "Destination bank account"
      : "Source bank account";
  const amountLabel = isFdOpen ? "Principal amount" : "Amount";

  const submitDisabled =
    submitting ||
    (isFdReturn ? !form.fixedDepositId : false) ||
    !form.bankAccountId ||
    (isFdReturn ? !form.returnAmount : !form.amount) ||
    (isFdOpen && !form.label.trim());

  const transferColumns = useMemo(() => {
    const cols = [
      {
        key: "occurredAt",
        header: "Date",
        sortable: true,
        width: "9rem",
        cell: (t) => (
          <span className="whitespace-nowrap">{formatDate(t.occurredAt)}</span>
        ),
      },
      {
        key: "kind",
        header: "Type",
        sortable: true,
        width: "10rem",
        filter: {
          type: "select",
          options: [{ value: "", label: "All types" }, ...KIND_OPTIONS],
        },
        cell: (t) => {
          const badge = KIND_BADGE[t.kind] || { variant: "default", label: t.kind };
          return <Badge variant={badge.variant}>{badge.label}</Badge>;
        },
      },
      { key: "from", header: "From", cell: (t) => describeEndpoints(t).from },
      { key: "to", header: "To", cell: (t) => describeEndpoints(t).to },
      {
        key: "amount",
        header: "Amount",
        sortable: true,
        align: "right",
        width: "9rem",
        cell: (t) => (
          <span className="font-semibold tabular-nums">₹{formatAmount(t.amount)}</span>
        ),
      },
      {
        key: "notes",
        header: "Notes",
        filter: { type: "text", placeholder: "Search…" },
        cell: (t) => (
          <span className="text-muted-foreground">{t.notes || "—"}</span>
        ),
      },
    ];
    if (canManage) {
      cols.push(
        actionsColumn({
          items: (t) => [
            {
              label: "Reverse transfer",
              icon: <TrashIcon className="h-4 w-4" />,
              danger: true,
              onClick: () => setToReverse(t),
            },
          ],
        })
      );
    }
    return cols;
  }, [canManage]);

  return (
    <div>
      <PageHeader
        title="Transfers"
        subtitle="Move money between cash, bank accounts, and fixed deposits. Transfers are internal — they never count as income or expense."
        actions={
          <div className="flex items-center gap-2">
            {isSuperadmin && (
              <div className="w-56">
                <Select
                  value={selectedFoundationId}
                  onChange={setSelectedFoundationId}
                  options={foundationOptions}
                />
              </div>
            )}
            {canManage && (
              <Button
                leftIcon={<PlusIcon className="h-4 w-4" />}
                onClick={openModal}
              >
                New Transfer
              </Button>
            )}
          </div>
        }
      />

      <Tabs.Group>
        <TabsList>
          <TabItem>Transfers</TabItem>
          <TabItem>Fixed Deposits</TabItem>
        </TabsList>
        <TabPanels>
          {/* ---- Transfers tab ---- */}
          <TabPanel>
            <Card>
              <CardBody>
                <DataTable
                  columns={transferColumns}
                  rows={transfers}
                  total={tTotal}
                  loading={tLoading}
                  page={tPage}
                  pageSize={tPageSize}
                  onPageChange={setTPage}
                  onPageSizeChange={setTPageSize}
                  sort={tSort}
                  onSortChange={setTSort}
                  columnFilters={tColFilters}
                  onColumnFiltersChange={setTColFilters}
                  enableGlobalSearch={false}
                  emptyIcon={ArrowsRightLeftIcon}
                  emptyTitle="No transfers yet"
                  emptyDescription="Record a cash deposit, withdrawal, or fixed deposit with the New Transfer button."
                />
              </CardBody>
            </Card>
          </TabPanel>

          {/* ---- Fixed Deposits tab ---- */}
          <TabPanel>
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Card>
                <CardBody className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <BuildingLibraryIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Active principal
                    </p>
                    <p className="text-lg font-semibold tabular-nums">
                      ₹{formatAmount(fdTotals.activePrincipal)}
                    </p>
                  </div>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10 text-success">
                    <BanknotesIcon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Interest earned (returned FDs)
                    </p>
                    <p className="text-lg font-semibold tabular-nums text-success">
                      ₹{formatAmount(fdTotals.interestEarned)}
                    </p>
                  </div>
                </CardBody>
              </Card>
            </div>

            <Card className="relative">
              <CardHeader>
                <CardTitle>Fixed Deposit Register ({fds.length})</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="relative overflow-x-auto">
                  {fdLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                      <Spinner />
                    </div>
                  )}
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Deposit</th>
                        <th className="px-4 py-2.5 font-medium">Bank</th>
                        <th className="px-4 py-2.5 text-right font-medium">Principal</th>
                        <th className="px-4 py-2.5 text-right font-medium">Rate</th>
                        <th className="px-4 py-2.5 font-medium">Opened</th>
                        <th className="px-4 py-2.5 font-medium">Maturity</th>
                        <th className="px-4 py-2.5 font-medium">Status</th>
                        <th className="px-4 py-2.5 text-right font-medium">Return</th>
                        <th className="px-4 py-2.5 text-right font-medium">Interest</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-foreground">
                      {!fdLoading && fds.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-4 py-10 text-center">
                            <EmptyState
                              icon={BuildingLibraryIcon}
                              title="No fixed deposits"
                              description="Use New Transfer → Bank → Fixed Deposit to park money into an FD."
                            />
                          </td>
                        </tr>
                      )}
                      {fds.map((f) => (
                        <tr key={f.id} className="hover:bg-muted/40">
                          <td className="px-4 py-2.5">
                            <div className="flex flex-col">
                              <span className="font-medium">{f.label}</span>
                              {f.receiptNumber && (
                                <span className="text-xs text-muted-foreground">
                                  #{f.receiptNumber}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">{f.bankName || "—"}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            ₹{formatAmount(f.principal)}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {f.interestRate != null ? `${f.interestRate}%` : "—"}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {formatDate(f.openedOn)}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {f.maturityDate ? formatDate(f.maturityDate) : "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            {f.status === "ACTIVE" ? (
                              <Badge variant="primary">Active</Badge>
                            ) : (
                              <Badge variant="default">Closed</Badge>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {f.returnAmount != null ? `₹${formatAmount(f.returnAmount)}` : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-success">
                            {f.interestEarned != null ? `₹${formatAmount(f.interestEarned)}` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          </TabPanel>
        </TabPanels>
      </Tabs.Group>

      {/* ---- New Transfer modal ---- */}
      <Modal
        open={modalOpen}
        onClose={() => (submitting ? null : setModalOpen(false))}
        title="New Transfer"
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="transfer-form"
              loading={submitting}
              disabled={submitDisabled}
            >
              Record Transfer
            </Button>
          </>
        }
      >
        <form id="transfer-form" onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Transfer type">
            <Select
              value={form.kind}
              onChange={(v) => setForm({ ...emptyForm, kind: v })}
              options={KIND_OPTIONS}
            />
          </FormField>

          {isFdReturn && (
            <FormField label="Fixed deposit">
              <Select
                value={form.fixedDepositId}
                onChange={onSelectFd}
                options={activeFdOptions}
              />
            </FormField>
          )}

          <FormField label={bankLabel}>
            <Select
              value={form.bankAccountId}
              onChange={(v) => setField("bankAccountId", v)}
              options={bankOptions}
            />
          </FormField>

          {showCashSide && (
            <FormField
              label="Cash account"
              hint="Leave as auto to use (or create) the foundation's Cash in Hand account."
            >
              <Select
                value={form.cashAccountId}
                onChange={(v) => setField("cashAccountId", v)}
                options={cashOptions}
              />
            </FormField>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label={isFdReturn ? "Return amount (₹)" : `${amountLabel} (₹)`}>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={isFdReturn ? form.returnAmount : form.amount}
                onChange={(e) =>
                  setField(isFdReturn ? "returnAmount" : "amount", e.target.value)
                }
                placeholder="0.00"
              />
            </FormField>
            <FormField label={isFdOpen ? "Opened on" : isFdReturn ? "Returned on" : "Date"}>
              <Input
                type="date"
                value={isFdReturn ? form.closedOn : form.occurredAt}
                onChange={(e) =>
                  setField(isFdReturn ? "closedOn" : "occurredAt", e.target.value)
                }
              />
            </FormField>
          </div>

          {isFdOpen && (
            <div className="space-y-4 rounded-md border border-border bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Fixed deposit details
              </p>
              <FormField label="FD label / name">
                <Input
                  value={form.label}
                  onChange={(e) => setField("label", e.target.value)}
                  placeholder="e.g. SBI FD 5-year"
                />
              </FormField>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Interest rate (% p.a.)">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.interestRate}
                    onChange={(e) => setField("interestRate", e.target.value)}
                    placeholder="e.g. 6.75"
                  />
                </FormField>
                <FormField label="Maturity date">
                  <Input
                    type="date"
                    value={form.maturityDate}
                    onChange={(e) => setField("maturityDate", e.target.value)}
                  />
                </FormField>
                <FormField label="Bank name">
                  <Input
                    value={form.fdBankName}
                    onChange={(e) => setField("fdBankName", e.target.value)}
                    placeholder="Defaults to the source account's bank"
                  />
                </FormField>
                <FormField label="Receipt / FD number">
                  <Input
                    value={form.receiptNumber}
                    onChange={(e) => setField("receiptNumber", e.target.value)}
                  />
                </FormField>
              </div>
            </div>
          )}

          <FormField label="Notes">
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder="Optional"
            />
          </FormField>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toReverse}
        onClose={() => setToReverse(null)}
        onConfirm={handleReverse}
        loading={reversing}
        title="Reverse this transfer?"
        confirmLabel="Reverse"
        description={
          toReverse
            ? `This reverses the ledger entries for this ${
                KIND_BADGE[toReverse.kind]?.label || "transfer"
              } and restores the affected balances. A fixed deposit opened by it will be removed; a returned deposit will be reopened.`
            : ""
        }
      />
    </div>
  );
};

export default ManageTransfers;
