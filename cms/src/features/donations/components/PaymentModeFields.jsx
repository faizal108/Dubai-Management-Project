// src/features/donations/components/PaymentModeFields.jsx
// Renders the conditional payment-detail fields for a donation, mirroring the
// backend superRefine in donations.schema.js. CASH has no extra fields; CHEQUE
// requires chequeNumber + bankName; ONLINE / UPI require utr (UPI shares the
// ONLINE fields — both are routed through banking rails and identified by UTR).

import React from "react";
import { FormField, Input } from "../../../components/ui";

const Field = ({
  label,
  name,
  value,
  onChange,
  disabled,
  error,
  required,
  placeholder,
  autoComplete = "off",
}) => (
  <FormField label={label} required={required} error={error}>
    <Input
      type="text"
      name={name}
      value={value || ""}
      onChange={onChange}
      placeholder={placeholder}
      autoComplete={autoComplete}
      disabled={disabled}
      error={!!error}
    />
  </FormField>
);

const PaymentModeFields = ({ type, form, onChange, disabled, fieldErrors }) => {
  const err = (name) => fieldErrors?.[name]?.[0];
  const handle = (e) => onChange(e.target.name, e.target.value);
  const handleIfsc = (e) => onChange("ifsc", (e.target.value || "").toUpperCase());

  if (type === "CASH") {
    return (
      <div className="md:col-span-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
        Cash donations are automatically marked as <strong>RECEIVED</strong>.
      </div>
    );
  }

  if (type === "CHEQUE") {
    return (
      <>
        <Field
          label="Cheque Number"
          name="chequeNumber"
          value={form.chequeNumber}
          onChange={handle}
          disabled={disabled}
          error={err("chequeNumber")}
          required
        />
        <Field
          label="Bank Name"
          name="bankName"
          value={form.bankName}
          onChange={handle}
          disabled={disabled}
          error={err("bankName")}
          required
        />
        <Field
          label="IFSC"
          name="ifsc"
          value={form.ifsc}
          onChange={handleIfsc}
          disabled={disabled}
          error={err("ifsc")}
          placeholder="Optional"
        />
      </>
    );
  }

  // ONLINE or UPI — both rails identify the txn by UTR. UPI label nudges users
  // to paste the UPI ref / VPA-side txn id; the backend validation is identical.
  return (
    <>
      <Field
        label={type === "UPI" ? "UPI Transaction Ref" : "UTR / Transaction Ref"}
        name="utr"
        value={form.utr}
        onChange={handle}
        disabled={disabled}
        error={err("utr")}
        required
      />
      <Field
        label="Bank Name"
        name="bankName"
        value={form.bankName}
        onChange={handle}
        disabled={disabled}
        error={err("bankName")}
        placeholder="Optional"
      />
      <Field
        label="IFSC"
        name="ifsc"
        value={form.ifsc}
        onChange={handleIfsc}
        disabled={disabled}
        error={err("ifsc")}
        placeholder="Optional"
      />
    </>
  );
};

export default PaymentModeFields;
