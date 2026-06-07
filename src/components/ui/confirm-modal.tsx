"use client";

import { Modal } from "./modal";
import { Button } from "./button";

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message?: string;
  confirmLabel?: string;
  variant?: "danger" | "warning";
  loading?: boolean;
  children?: React.ReactNode;
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  variant = "danger",
  loading = false,
  children,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      busy={loading}
      footer={
        <div className="flex flex-col sm:flex-row justify-end gap-3">
          <Button variant="outline" type="button" onClick={onClose} disabled={loading} className="sm:flex-none flex-1">
            Cancel
          </Button>
          <Button variant={variant} type="button" onClick={onConfirm} loading={loading} className="sm:flex-none flex-1">
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {(message || children) ? (
        <div className="space-y-3">
          {message && <p className="text-sm text-slate-600 break-words">{message}</p>}
          {children}
        </div>
      ) : null}
    </Modal>
  );
}
