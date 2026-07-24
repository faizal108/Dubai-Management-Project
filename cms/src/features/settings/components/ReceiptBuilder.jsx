// src/features/settings/components/ReceiptBuilder.jsx
// Resume-builder-style receipt editor: pick a template + tweak options on the
// left, see a live preview (same renderer the print/PDF pipeline uses) on the
// right. Persists receiptTemplateId + receiptSettings on the foundation.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  FormField,
  Input,
  Select,
  Spinner,
  Textarea,
  cn,
} from "../../../components/ui";
import { getMyFoundation, updateMyFoundation } from "../../foundations/api";
import {
  RECEIPT_TEMPLATES,
  DEFAULT_TEMPLATE_ID,
  renderReceipt,
  resolveReceiptSettings,
  DEFAULT_RECEIPT_SETTINGS,
  FONT_OPTIONS,
  FONT_SCALE_OPTIONS,
  LOGO_SIZE_OPTIONS,
  LOGO_POSITION_OPTIONS,
  PAPER_OPTIONS,
  ORIENTATION_OPTIONS,
  DATE_FORMAT_OPTIONS,
  FIELD_TOGGLES,
  pageWidthPx,
  SAMPLE_DONATION,
} from "../../donations/receipts";

export default function ReceiptBuilder() {
  const [foundation, setFoundation] = useState(null);
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [settings, setSettings] = useState(DEFAULT_RECEIPT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const hydrate = useCallback((f) => {
    setTemplateId(f?.receiptTemplateId || DEFAULT_TEMPLATE_ID);
    setSettings(resolveReceiptSettings(f));
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

  const setField = (k, v) => setSettings((s) => ({ ...s, [k]: v }));
  const setShow = (k, v) => setSettings((s) => ({ ...s, show: { ...s.show, [k]: v } }));

  const previewHtml = useMemo(
    () => renderReceipt(templateId, { donation: SAMPLE_DONATION, foundation, settings }),
    [templateId, foundation, settings]
  );
  const previewWidth = pageWidthPx(settings);
  const previewBorder = settings.borderColor === "none" ? "none" : `8px solid ${settings.borderColor}`;
  const borderOn = settings.borderColor !== "none";

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updateMyFoundation({
        receiptTemplateId: templateId,
        receiptSettings: settings,
      });
      setFoundation(res?.foundation || null);
      hydrate(res?.foundation);
      toast.success("Receipt template saved.");
    } catch (err) {
      console.error("Save receipt template error:", err);
    } finally {
      setSaving(false);
    }
  };

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
          <CardTitle>Receipt</CardTitle>
          <CardDescription>
            Your account isn't bound to a foundation yet. Ask a SUPERADMIN to assign one first.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const colorField = (label, key) => (
    <FormField label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={settings[key]}
          onChange={(e) => setField(key, e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-border bg-background"
          aria-label={label}
        />
        <Input value={settings[key]} onChange={(e) => setField(key, e.target.value)} className="font-mono" />
      </div>
    </FormField>
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,400px)_1fr]">
      {/* Config panel */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Template</CardTitle>
            <CardDescription>Choose a layout, then tweak the options below.</CardDescription>
          </CardHeader>
          <CardBody className="space-y-2">
            {RECEIPT_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplateId(t.id)}
                className={cn(
                  "flex w-full flex-col rounded-md border p-3 text-left transition-colors",
                  templateId === t.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                )}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {t.name}
                  {templateId === t.id && <Badge variant="primary">Active</Badge>}
                </span>
                <span className="mt-0.5 text-xs text-muted-foreground">{t.description}</span>
              </button>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {colorField("Accent color", "accentColor")}
              {colorField("Text color", "textColor")}
              <FormField label="Font">
                <Select value={settings.fontFamily} onChange={(v) => setField("fontFamily", v)} options={FONT_OPTIONS} />
              </FormField>
              <FormField label="Font size">
                <Select value={settings.fontScale} onChange={(v) => setField("fontScale", v)} options={FONT_SCALE_OPTIONS} />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-4 items-end">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={borderOn}
                  onChange={(e) => setField("borderColor", e.target.checked ? "#009245" : "none")}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                Outer border
              </label>
              {borderOn && colorField("Border color", "borderColor")}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Layout</CardTitle></CardHeader>
          <CardBody className="grid grid-cols-2 gap-4">
            <FormField label="Logo size">
              <Select value={settings.logoSize} onChange={(v) => setField("logoSize", v)} options={LOGO_SIZE_OPTIONS} />
            </FormField>
            <FormField label="Logo position">
              <Select value={settings.logoPosition} onChange={(v) => setField("logoPosition", v)} options={LOGO_POSITION_OPTIONS} />
            </FormField>
            <FormField label="Paper size">
              <Select value={settings.paperSize} onChange={(v) => setField("paperSize", v)} options={PAPER_OPTIONS} />
            </FormField>
            <FormField label="Orientation">
              <Select value={settings.orientation} onChange={(v) => setField("orientation", v)} options={ORIENTATION_OPTIONS} />
            </FormField>
            <FormField label="Date format">
              <Select value={settings.dateFormat} onChange={(v) => setField("dateFormat", v)} options={DATE_FORMAT_OPTIONS} />
            </FormField>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Text</CardTitle>
            <CardDescription>Leave blank to use the defaults.</CardDescription>
          </CardHeader>
          <CardBody className="space-y-4">
            <FormField label="Header title" hint="Defaults to your foundation / receipt name.">
              <Input value={settings.headerTitle} onChange={(e) => setField("headerTitle", e.target.value)} placeholder={foundation.receiptName || foundation.name || ""} />
            </FormField>
            <FormField label="Receipt title" hint='e.g. "DONATION RECEIPT" / "80G Receipt".'>
              <Input value={settings.receiptTitle} onChange={(e) => setField("receiptTitle", e.target.value)} placeholder="Donation Receipt" />
            </FormField>
            <FormField label="Declaration / 80G line">
              <Textarea rows={2} value={settings.declarationText} onChange={(e) => setField("declarationText", e.target.value)} />
            </FormField>
            <FormField label="Signature line" hint='Text by the signature (e.g. "for, <org>").'>
              <Input value={settings.footerText} onChange={(e) => setField("footerText", e.target.value)} placeholder={`for, ${foundation.receiptName || foundation.name || ""}`} />
            </FormField>
            <FormField label="Signature caption" hint='e.g. "Authorised Signatory".'>
              <Input value={settings.signatureLabel} onChange={(e) => setField("signatureLabel", e.target.value)} placeholder="Authorised Signatory" />
            </FormField>
            <FormField label="Thank-you note">
              <Input value={settings.thankYouNote} onChange={(e) => setField("thankYouNote", e.target.value)} placeholder="Thank you for your generous support!" />
            </FormField>
            <FormField label="Footer / contact note">
              <Input value={settings.contactNote} onChange={(e) => setField("contactNote", e.target.value)} placeholder="www.example.org · +91 12345 67890" />
            </FormField>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fields</CardTitle>
            <CardDescription>Show or hide receipt elements. Logo & signature images come from Organization → branding.</CardDescription>
          </CardHeader>
          <CardBody className="grid grid-cols-2 gap-2">
            {FIELD_TOGGLES.map((f) => (
              <label key={f.key} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={settings.show?.[f.key] !== false}
                  onChange={(e) => setShow(f.key, e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                {f.label}
              </label>
            ))}
          </CardBody>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => hydrate(foundation)} disabled={saving}>Reset</Button>
          <Button onClick={handleSave} loading={saving}>Save template</Button>
        </div>
      </div>

      {/* Live preview */}
      <Card className="lg:sticky lg:top-4 self-start">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>Sample data — actual receipts use each donation's details.</CardDescription>
        </CardHeader>
        <CardBody>
          <div className="overflow-auto rounded-md bg-neutral-100 p-4" style={{ maxHeight: "72vh" }}>
            <div
              style={{
                width: previewWidth,
                border: previewBorder,
                boxSizing: "border-box",
                background: "#fff",
                zoom: 0.6,
              }}
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
