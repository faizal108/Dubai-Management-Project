// Themed image picker used for foundation branding (logo / signature). Resizes
// the chosen file client-side to a small data URL and reports it via onChange.
// The value is the data URL (or null when cleared) — the parent stores it.

import React, { useRef, useState } from "react";
import { ArrowUpTrayIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { toast } from "react-toastify";
import Button from "./Button";
import { fileToResizedDataUrl } from "../../lib/imageResize";
import { cn } from "./cn";

export default function ImageUpload({
  value,
  onChange,
  disabled = false,
  maxEdge = 400,
  accept = "image/*",
  hint,
  className,
}) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await fileToResizedDataUrl(file, { maxEdge });
      onChange?.(dataUrl);
    } catch (err) {
      toast.error(err?.message || "Could not process that image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
          {value ? (
            <img src={value} alt="preview" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-[10px] text-muted-foreground">No image</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || busy}
              loading={busy}
              leftIcon={<ArrowUpTrayIcon className="h-4 w-4" />}
            >
              {value ? "Replace" : "Upload"}
            </Button>
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange?.(null)}
                disabled={disabled}
                leftIcon={<XMarkIcon className="h-4 w-4" />}
              >
                Remove
              </Button>
            )}
          </div>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={onFile}
        disabled={disabled}
      />
    </div>
  );
}
