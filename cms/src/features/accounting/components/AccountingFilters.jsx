// src/features/accounting/components/AccountingFilters.jsx
// Shared filter row for the ledger / book / report pages. Handles the lookup
// fetches for bank accounts, FYs, and (for SUPERADMIN) foundations, and
// exposes a lightweight prop-driven API so pages can hide or show fields.

import React, { useEffect, useMemo, useState } from "react";
import { FormField, Input, Select } from "../../../components/ui";
import { ROLES } from "../../../constants/roles";
import { useAuth } from "../../../context/AuthContext";
import { listBankAccounts } from "../../bankAccounts/api";
import { listFinancialYears } from "../../financialYears/api";
import { listFoundations } from "../../foundations/api";

const AccountingFilters = ({
  value,
  onChange,
  showBankAccount = true,
  showDateRange = true,
  showFinancialYear = true,
  bankAccountKind, // "cash" | "bank" | undefined — restricts the account dropdown
}) => {
  const { user } = useAuth();
  const isSuperadmin = user?.role === ROLES.SUPERADMIN;

  const [bankAccounts, setBankAccounts] = useState([]);
  const [financialYears, setFinancialYears] = useState([]);
  const [foundations, setFoundations] = useState([]);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = { page: 1, pageSize: 100 };
        if (isSuperadmin && value.foundationId) {
          params.foundationId = value.foundationId;
        }
        const [ba, fy] = await Promise.all([
          listBankAccounts(params),
          listFinancialYears(params),
        ]);
        if (cancelled) return;
        setBankAccounts(ba?.items ?? []);
        setFinancialYears(fy?.items ?? []);
      } catch (err) {
        console.error("Fetch accounting lookups error:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSuperadmin, value.foundationId]);

  const bankAccountOptions = useMemo(() => {
    const filtered = bankAccounts.filter((a) => {
      if (!bankAccountKind) return true;
      const kind = a.accountNumber ? "bank" : "cash";
      return kind === bankAccountKind;
    });
    return [
      { value: "", label: "All accounts" },
      ...filtered.map((a) => ({
        value: a.id,
        label: `${a.label}${a.isDefault ? " (default)" : ""}`,
      })),
    ];
  }, [bankAccounts, bankAccountKind]);

  const financialYearOptions = useMemo(
    () => [
      { value: "", label: "Active financial year" },
      ...financialYears.map((f) => ({ value: f.id, label: f.label })),
    ],
    [financialYears]
  );
  const foundationOptions = useMemo(
    () => [
      { value: "", label: "All foundations" },
      ...foundations.map((f) => ({ value: f.id, label: f.name })),
    ],
    [foundations]
  );

  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
      {isSuperadmin && (
        <FormField label="Foundation">
          <Select
            value={value.foundationId || ""}
            onChange={(v) => set({ foundationId: v })}
            options={foundationOptions}
          />
        </FormField>
      )}
      {showFinancialYear && (
        <FormField label="Financial Year">
          <Select
            value={value.financialYearId || ""}
            onChange={(v) => set({ financialYearId: v })}
            options={financialYearOptions}
          />
        </FormField>
      )}
      {showBankAccount && (
        <FormField label="Bank Account">
          <Select
            value={value.bankAccountId || ""}
            onChange={(v) => set({ bankAccountId: v })}
            options={bankAccountOptions}
          />
        </FormField>
      )}
      {showDateRange && (
        <>
          <FormField label="From">
            <Input
              type="date"
              value={value.from || ""}
              onChange={(e) => set({ from: e.target.value })}
            />
          </FormField>
          <FormField label="To">
            <Input
              type="date"
              value={value.to || ""}
              onChange={(e) => set({ to: e.target.value })}
            />
          </FormField>
        </>
      )}
    </div>
  );
};

export default AccountingFilters;
