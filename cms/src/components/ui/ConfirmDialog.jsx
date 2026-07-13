import React from "react";
import Modal from "./Modal";
import Button from "./Button";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

/**
 * Confirmation dialog: ask the user before destructive or significant actions.
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  loading = false,
}) {
  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <span
          className={
            variant === "danger"
              ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger"
              : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning"
          }
        >
          <ExclamationTriangleIcon className="h-5 w-5" />
        </span>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </Modal>
  );
}
