"use client";

import { useEffect, useCallback } from "react";
import { Trash2 } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  warning?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  warning,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    },
    [onCancel],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      style={{
        background: "rgba(0,0,0,0.5)",
        animation: "confirm-fade-in 150ms ease-out",
      }}
      onClick={onCancel}
    >
      <style>{`@keyframes confirm-fade-in { from { opacity: 0 } to { opacity: 1 } }`}</style>
      <div
        className="flex flex-col gap-4 shadow-2xl w-full md:rounded-xl"
        style={{
          background: "var(--cs-surface)",
          border: "1px solid var(--cs-border)",
          maxWidth: 420,
          padding: 24,
          borderRadius: "16px 16px 0 0",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center md:hidden" style={{ marginTop: -8, marginBottom: -8 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--cs-muted)", opacity: 0.4 }} />
        </div>
        <div className="flex items-center gap-3">
          <Trash2 className="h-5 w-5 shrink-0" style={{ color: "#ef4444" }} />
          <h3
            className="font-dm-sans"
            style={{ fontSize: 16, fontWeight: 500, color: "var(--cs-text)" }}
          >
            {title}
          </h3>
        </div>

        <p
          className="text-sm font-dm-sans"
          style={{ color: "var(--cs-muted)", lineHeight: 1.5 }}
        >
          {message}
        </p>

        {warning && (
          <p
            className="font-dm-sans"
            style={{
              fontSize: 13,
              color: "#f59e0b",
              lineHeight: 1.5,
            }}
          >
            {warning}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-[10px] text-sm font-medium font-dm-sans"
            style={{
              border: "1px solid var(--cs-border)",
              background: "transparent",
              color: "var(--cs-muted)",
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-[10px] text-sm font-semibold font-dm-sans"
            style={{
              background: "#ef4444",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
