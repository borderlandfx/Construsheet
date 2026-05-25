"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useWorkspace } from "@/lib/context/WorkspaceContext";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const KBD_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 24,
  padding: "2px 6px",
  fontSize: 12,
  fontFamily: "monospace",
  fontWeight: 600,
  borderRadius: 4,
  background: "var(--cs-bg2, var(--cs-surface))",
  border: "1px solid var(--cs-border)",
  color: "var(--cs-text)",
};

export default function KeyboardShortcutsHelp({ isOpen, onClose }: Props) {
  const { language } = useWorkspace();
  const isEs = language === "es";

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const nav = [
    { key: "1–6", desc: isEs ? "Cambiar pestaña" : "Switch tab" },
    { key: "/", desc: isEs ? "Buscar" : "Search" },
    { key: "Esc", desc: isEs ? "Cerrar / Cancelar" : "Close / Cancel" },
  ];

  const actions = [
    { key: "N", desc: isEs ? "Nuevo elemento" : "New item" },
    { key: "?", desc: isEs ? "Mostrar atajos" : "Show shortcuts" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="flex flex-col gap-5 rounded-xl shadow-2xl w-full"
        style={{
          maxWidth: 480,
          background: "var(--cs-surface)",
          border: "1px solid var(--cs-border)",
          padding: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-dm-sans font-medium" style={{ fontSize: 16, color: "var(--cs-text)" }}>
            {isEs ? "Atajos de teclado" : "Keyboard shortcuts"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--cs-muted)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Navigation */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-dm-sans font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--cs-muted)" }}>
              {isEs ? "Navegación" : "Navigation"}
            </span>
            {nav.map(({ key, desc }) => (
              <Row key={key} kbdKey={key} desc={desc} />
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-dm-sans font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--cs-muted)" }}>
              {isEs ? "Acciones" : "Actions"}
            </span>
            {actions.map(({ key, desc }) => (
              <Row key={key} kbdKey={key} desc={desc} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ kbdKey, desc }: { kbdKey: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <kbd style={KBD_STYLE}>{kbdKey}</kbd>
      <span className="text-sm font-dm-sans" style={{ color: "var(--cs-text)" }}>{desc}</span>
    </div>
  );
}
