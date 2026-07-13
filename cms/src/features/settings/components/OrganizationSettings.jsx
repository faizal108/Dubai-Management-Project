import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  Spinner,
} from "../../../components/ui";
import { getMyFoundation, updateMyFoundation } from "../../foundations/api";

// Mirrors the backend e164 regex in foundations.schema.js. Kept local so we
// can surface inline validation before the round-trip.
const E164_REGEX = /^\+[1-9]\d{7,14}$/;
const DEFAULT_CASH_LIMIT = "2000";

// Strip Decimal noise ("2000.00" → "2000") for display; keep raw string so
// users can type "1500.50" without React eating trailing zeros.
const normaliseCashLimit = (v) => {
  if (v === null || v === undefined || v === "") return "";
  const s = String(v).trim();
  return s.endsWith(".00") ? s.slice(0, -3) : s;
};

const EMPTY_FORM = {
  cashLimit: DEFAULT_CASH_LIMIT,
  hasWhatsappBusiness: false,
  whatsappBusinessNumber: "",
};

export default function OrganizationSettings() {
  const [foundation, setFoundation] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");

  const hydrate = useCallback((f) => {
    setForm({
      cashLimit: normaliseCashLimit(f?.cashLimit) || DEFAULT_CASH_LIMIT,
      hasWhatsappBusiness: !!f?.hasWhatsappBusiness,
      whatsappBusinessNumber: f?.whatsappBusinessNumber || "",
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await getMyFoundation();
        if (cancelled) return;
        setFoundation(res?.foundation || null);
        hydrate(res?.foundation);
      } catch (err) {
        console.error("Load foundation error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const next = type === "checkbox" ? checked : value;
    setForm((prev) => {
      const merged = { ...prev, [name]: next };
      // Clearing the WhatsApp toggle drops the number so we never POST a
      // stale value the backend would reject.
      if (name === "hasWhatsappBusiness" && next === false) {
        merged.whatsappBusinessNumber = "";
      }
      return merged;
    });
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validateLocally = () => {
    const errs = {};
    const cl = String(form.cashLimit).trim();
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(cl)) {
      errs.cashLimit = ["Enter a valid amount (max 12 digits, 2 decimals)"];
    } else if (Number(cl) < 0) {
      errs.cashLimit = ["Cash limit cannot be negative"];
    }
    if (form.hasWhatsappBusiness) {
      const num = form.whatsappBusinessNumber.trim();
      if (!E164_REGEX.test(num)) {
        errs.whatsappBusinessNumber = [
          "Use E.164 format, e.g. +911234567890",
        ];
      }
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!validateLocally()) return;

    setSaving(true);
    try {
      const payload = {
        cashLimit: String(form.cashLimit).trim(),
        hasWhatsappBusiness: !!form.hasWhatsappBusiness,
        whatsappBusinessNumber: form.hasWhatsappBusiness
          ? form.whatsappBusinessNumber.trim()
          : null,
      };
      const res = await updateMyFoundation(payload);
      setFoundation(res?.foundation || null);
      hydrate(res?.foundation);
      toast.success("Organization settings updated.");
    } catch (err) {
      const envelope = err.apiError;
      if (envelope?.details?.fieldErrors) {
        setFieldErrors(envelope.details.fieldErrors);
      }
      if (envelope?.message) setFormError(envelope.message);
      console.error("Update foundation error:", err);
    } finally {
      setSaving(false);
    }
  };

  const fieldErr = (name) => fieldErrors?.[name]?.[0];

  if (loading) {
    return (
      <Card>
        <CardBody className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </CardBody>
      </Card>
    );
  }

  if (!foundation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>
            Your account isn't bound to a foundation yet. Ask a SUPERADMIN to
            assign one before configuring these settings.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>{foundation.name}</CardTitle>
              <CardDescription>
                Org-level compliance and messaging configuration.
              </CardDescription>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              {foundation.pan}
            </Badge>
          </div>
        </CardHeader>
        <CardBody>
          {formError && (
            <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">
              {formError}
            </div>
          )}

          <form
            id="org-settings-form"
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-5 md:grid-cols-2"
          >
            <div className="md:col-span-2">
              <FormField
                label="Cash donation limit (₹)"
                required
                hint="Per Section 269ST compliance — the maximum a single CASH donation can be. Donors can pick a chip or enter a custom amount up to this cap."
                error={fieldErr("cashLimit")}
              >
                <Input
                  type="number"
                  name="cashLimit"
                  inputMode="decimal"
                  min="0"
                  step="100"
                  placeholder="2000"
                  value={form.cashLimit}
                  onChange={handleChange}
                  disabled={saving}
                  error={!!fieldErr("cashLimit")}
                />
              </FormField>
            </div>

            <div className="md:col-span-2">
              <label className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm text-foreground">
                <input
                  type="checkbox"
                  name="hasWhatsappBusiness"
                  checked={form.hasWhatsappBusiness}
                  onChange={handleChange}
                  disabled={saving}
                  className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                />
                <span className="flex flex-col">
                  <span className="font-medium">
                    We have a WhatsApp Business number
                  </span>
                  <span className="text-xs text-muted-foreground">
                    When enabled, donors get a "Send receipt on WhatsApp"
                    option at donation time. Status updates appear on the
                    donation row.
                  </span>
                </span>
              </label>
            </div>

            {form.hasWhatsappBusiness && (
              <div className="md:col-span-2">
                <FormField
                  label="WhatsApp Business Number"
                  required
                  hint="E.164 format, e.g. +911234567890."
                  error={fieldErr("whatsappBusinessNumber")}
                >
                  <Input
                    type="tel"
                    name="whatsappBusinessNumber"
                    placeholder="+911234567890"
                    value={form.whatsappBusinessNumber}
                    onChange={handleChange}
                    disabled={saving}
                    error={!!fieldErr("whatsappBusinessNumber")}
                    className="font-mono"
                  />
                </FormField>
              </div>
            )}
          </form>
        </CardBody>
        <CardFooter className="justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => hydrate(foundation)}
            disabled={saving}
          >
            Reset
          </Button>
          <Button type="submit" form="org-settings-form" loading={saving}>
            Save changes
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
