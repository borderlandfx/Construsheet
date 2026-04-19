"use client";

import { useEffect, useState } from "react";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { useToast, type ToastItem, type ToastVariant } from "@/lib/context/ToastContext";

// ─── Variant config ───────────────────────────────────────────────────────────

const VARIANT_CFG: Record<ToastVariant, {
  icon: React.ElementType;
  bg: string;
  border: string;
  iconColor: string;
}> = {
  success: {
    icon:      CheckCircle2,
    bg:        "rgba(22,163,74,0.12)",
    border:    "rgba(22,163,74,0.3)",
    iconColor: "#22c55e",
  },
  error: {
    icon:      AlertCircle,
    bg:        "rgba(239,68,68,0.12)",
    border:    "rgba(239,68,68,0.3)",
    iconColor: "#ef4444",
  },
  info: {
    icon:      Info,
    bg:        "rgba(96,165,250,0.12)",
    border:    "rgba(96,165,250,0.3)",
    iconColor: "#60a5fa",
  },
};

// ─── Single toast ───────────────────────────��───────────────────��─────────────

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  const cfg = VARIANT_CFG[item.variant];
  const Icon = cfg.icon;

  // Slide-in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 10,
        background: "var(--cs-surface)",
        border: `1px solid ${cfg.border}`,
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        minWidth: 260,
        maxWidth: 380,
        transform: visible ? "translateX(0)" : "translateX(110%)",
        opacity: visible ? 1 : 0,
        transition: "transform 240ms cubic-bezier(0.16,1,0.3,1), opacity 200ms ease",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Coloured left stripe */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: cfg.iconColor,
          borderRadius: "10px 0 0 10px",
        }}
      />

      <Icon
        className="shrink-0"
        style={{ width: 16, height: 16, color: cfg.iconColor, marginLeft: 6 }}
      />

      <span
        className="flex-1 text-sm font-dm-sans"
        style={{ color: "var(--cs-text)", lineHeight: 1.4 }}
      >
        {item.message}
      </span>

      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--cs-muted)",
          padding: 2,
          display: "flex",
          alignItems: "center",
        }}
      >
        <X style={{ width: 13, height: 13 }} />
      </button>
    </div>
  );
}

// ─── Container ───────────────────���──────────────────────────────��─────────────

export default function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      {toasts.map((item) => (
        <div key={item.id} style={{ pointerEvents: "auto" }}>
          <ToastCard item={item} onDismiss={() => dismiss(item.id)} />
        </div>
      ))}
    </div>
  );
}
