"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { useWorkspace } from "@/lib/context/WorkspaceContext";
import { useToast } from "@/lib/context/ToastContext";
import { t } from "@/lib/utils/i18n";
import type { Locale } from "@/lib/utils/i18n";

type ExportType = "budget" | "gantt";

interface PDFExportButtonProps {
  type: ExportType;
  disabled?: boolean;
}

export default function PDFExportButton({ type, disabled = false }: PDFExportButtonProps) {
  const { projectId, language, currency } = useWorkspace();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const lang = language as Locale;

  async function handleExport() {
    if (loading || disabled) return;
    setLoading(true);

    try {
      const res = await fetch("/api/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, projectId, language: lang, currency }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Export failed" }));
        throw new Error((err as { error?: string }).error ?? "Export failed");
      }

      // Download the binary PDF
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `ConstruSheet_${type}_${date}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      toast(
        lang === "es" ? "PDF descargado correctamente" : "PDF downloaded successfully",
        "success"
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Export failed";
      toast(
        lang === "es" ? `Error al exportar: ${msg}` : `Export error: ${msg}`,
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  const label = type === "budget"
    ? (lang === "es" ? "Exportar presupuesto PDF" : "Export budget PDF")
    : (lang === "es" ? "Exportar Gantt PDF"      : "Export Gantt PDF");

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading || disabled}
      aria-label={label}
      title={label}
      className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-sm font-medium font-dm-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cs-accent)]"
      style={{
        border: "1px solid var(--cs-border)",
        background: "transparent",
        color: "var(--cs-muted)",
        cursor: loading || disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "color 150ms, border-color 150ms",
      }}
      onMouseEnter={(e) => {
        if (!loading && !disabled)
          (e.currentTarget as HTMLButtonElement).style.color = "var(--cs-text)";
      }}
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.color = "var(--cs-muted)")
      }
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <FileDown className="h-4 w-4" aria-hidden="true" />
      )}
      {loading
        ? (lang === "es" ? "Generando…" : "Generating…")
        : t("exportPdf", lang)}
    </button>
  );
}
