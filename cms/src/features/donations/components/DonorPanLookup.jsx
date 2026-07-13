// src/features/donations/components/DonorPanLookup.jsx
// Owns the PAN input + donor resolution for the donation flow. Normalizes PAN
// to uppercase, validates format locally, and only calls the backend when the
// PAN passes the regex. Lifts the resolved donor (or null) to the parent.

import React, { useEffect, useRef, useState } from "react";
import { fetchDonorByPan } from "../../donors/api";
import { FormField, Input, Spinner } from "../../../components/ui";

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const DonorPanLookup = ({ value, onChange, onResolve, disabled, fieldError }) => {
  const [status, setStatus] = useState({ kind: "idle", message: "" });
  const seqRef = useRef(0);

  useEffect(() => {
    const pan = (value || "").trim().toUpperCase();
    if (!pan) {
      setStatus({ kind: "idle", message: "" });
      onResolve(null);
      return;
    }
    if (!PAN_REGEX.test(pan)) {
      setStatus({ kind: "idle", message: "" });
      onResolve(null);
      return;
    }

    const mySeq = ++seqRef.current;
    setStatus({ kind: "loading", message: "Looking up donor…" });

    const handle = setTimeout(async () => {
      try {
        const donor = await fetchDonorByPan(pan);
        if (mySeq !== seqRef.current) return;
        if (donor) {
          onResolve(donor);
          setStatus({
            kind: "success",
            message: `Donor found: ${donor.fullName}`,
          });
        } else {
          onResolve(null);
          setStatus({
            kind: "error",
            message: "No donor with this PAN in your foundation.",
          });
        }
      } catch (err) {
        if (mySeq !== seqRef.current) return;
        onResolve(null);
        setStatus({ kind: "error", message: "Lookup failed. Try again." });
        console.error("PAN lookup error:", err);
      }
    }, 350);

    return () => clearTimeout(handle);
  }, [value, onResolve]);

  const handleChange = (e) => {
    onChange((e.target.value || "").toUpperCase().slice(0, 10));
  };

  const hint =
    !fieldError && status.kind !== "idle" ? (
      <span
        className={
          status.kind === "loading"
            ? "inline-flex items-center gap-1.5 text-muted-foreground"
            : status.kind === "success"
            ? "text-success"
            : "text-danger"
        }
      >
        {status.kind === "loading" && <Spinner size="xs" />}
        {status.message}
      </span>
    ) : null;

  return (
    <div className="md:col-span-2">
      <FormField label="PAN Number" required error={fieldError} hint={hint}>
        <Input
          type="text"
          name="pan"
          placeholder="ABCDE1234F"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          autoComplete="off"
          required
          error={!!fieldError}
        />
      </FormField>
    </div>
  );
};

export default DonorPanLookup;
