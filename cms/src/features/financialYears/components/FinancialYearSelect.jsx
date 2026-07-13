// src/features/financialYears/components/FinancialYearSelect.jsx
//
// Reusable financial-year picker. Mirrors BankAccountSelect in shape so the
// two shared dropdowns feel identical (Headless UI Listbox with a themed
// pop-open panel, not the browser's native <select>).
//
// By default it consumes the app-wide FinancialYearContext, so the sidebar
// (and any other caller that already lives inside FinancialYearProvider)
// can drop it in with no props. Callers that need to drive the picker from
// local state — e.g. a form field bound to donation.financialYearId — pass
// `years`, `value`, and `onChange` explicitly.
//
// Props (all optional):
//   value        — currently selected FY id. Falls back to context.selectedYearId.
//   onChange(id) — invoked when the user picks. Falls back to context.setSelectedYearId.
//   years        — override the year list. Falls back to context.years.
//   disabled, error, placeholder, className — passthrough to the underlying Select.
//   size         — "sm" tightens the button for cramped chrome like the sidebar.
//
// Status suffixing:
//   ACTIVE years render as bare labels (they are the norm).
//   CLOSED years pick up a "(closed)" suffix so operators see at a glance
//   which windows the ledger is locked against.

import React, { useMemo } from "react";
import { Select } from "../../../components/ui";
import { useFinancialYear } from "../../../context/FinancialYearContext";

const FinancialYearSelect = ({
  value,
  onChange,
  years,
  disabled,
  error,
  placeholder = "— Select financial year —",
  className,
  buttonClassName,
}) => {
  const ctx = useFinancialYear();
  const list = years ?? ctx.years;
  // Resolve fall-throughs once so we don't fire context setters when the
  // caller intentionally passed a controlled onChange.
  const currentValue = value !== undefined ? value : ctx.selectedYearId;
  const handleChange = onChange || ctx.setSelectedYearId;

  const options = useMemo(() => {
    const opts = [];
    for (const y of list) {
      const suffix = y.status === "CLOSED" ? " (closed)" : "";
      opts.push({ value: y.id, label: `${y.label}${suffix}` });
    }
    return opts;
  }, [list]);

  return (
    <Select
      value={currentValue || ""}
      onChange={handleChange}
      options={options}
      disabled={disabled || list.length === 0}
      error={!!error}
      placeholder={placeholder}
      className={className}
      buttonClassName={buttonClassName}
    />
  );
};

export default FinancialYearSelect;
