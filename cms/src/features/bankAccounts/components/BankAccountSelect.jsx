// src/features/bankAccounts/components/BankAccountSelect.jsx
//
// Reusable bank-account picker used by the donation and expense forms.
// Fetches active accounts (optionally filtered by category) and auto-selects
// the default row for the current (foundation, category) tuple when the
// caller hasn't chosen one yet. This mirrors the server-side fallback in
// donations.service / expenses.service, so the UI stays in sync with what
// the ledger will actually post to.
//
// Props:
//   value            — current bankAccountId ("" for none)
//   onChange(id)     — invoked when the user picks (or when we auto-default)
//   category         — optional GENERAL / CSR filter. When set, we only
//                      show accounts in that category and re-default when it
//                      changes (e.g. donation category flips GENERAL → CSR).
//   foundationId     — optional. SUPERADMIN passes the picked foundation;
//                      ADMIN/EMPLOYEE leave undefined (server scopes on JWT).
//   disabled, error  — passthrough to the underlying Select.
//   autoSelectDefault — set false to opt out of the auto-default behaviour
//                       (e.g. on edit forms where we want to preserve the
//                       stored choice even if it doesn't match the default).

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Select } from "../../../components/ui";
import { listBankAccounts } from "../api";

const BankAccountSelect = ({
  value,
  onChange,
  category,
  foundationId,
  disabled,
  error,
  autoSelectDefault = true,
  placeholder = "— Select bank account —",
}) => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  // Tracks the (foundation|category) key we've already auto-defaulted for,
  // so switching donation-type back and forth doesn't stomp a manual pick
  // more than once per category change.
  const autoPickedFor = useRef("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params = { page: 1, pageSize: 100, isActive: "true" };
        if (category) params.category = category;
        if (foundationId) params.foundationId = foundationId;
        const res = await listBankAccounts(params);
        if (!cancelled) setAccounts(res?.items ?? []);
      } catch (err) {
        console.error("Fetch bank accounts (select) error:", err);
        if (!cancelled) setAccounts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [category, foundationId]);

  // Auto-default: only when opted in, no value chosen, options loaded. We
  // gate on the (foundation|category) key so the effect fires once per
  // category change instead of stomping every render.
  useEffect(() => {
    if (!autoSelectDefault) return;
    if (value) return;
    if (loading) return;
    const key = `${foundationId || "*"}|${category || "*"}`;
    if (autoPickedFor.current === key) return;
    const pick = accounts.find((a) => a.isDefault) || accounts[0];
    if (pick) {
      autoPickedFor.current = key;
      onChange(pick.id);
    }
  }, [
    accounts,
    loading,
    value,
    autoSelectDefault,
    category,
    foundationId,
    onChange,
  ]);

  const options = useMemo(() => {
    const opts = [{ value: "", label: placeholder }];
    for (const a of accounts) {
      const detail = a.upiId
        ? a.upiId
        : [a.bankName, a.accountNumber].filter(Boolean).join(" · ");
      const suffix = detail ? ` — ${detail}` : "";
      opts.push({
        value: a.id,
        label: `${a.label}${a.isDefault ? " (default)" : ""}${suffix}`,
      });
    }
    return opts;
  }, [accounts, placeholder]);

  return (
    <Select
      value={value || ""}
      onChange={onChange}
      options={options}
      disabled={disabled || loading}
      error={!!error}
    />
  );
};

export default BankAccountSelect;
