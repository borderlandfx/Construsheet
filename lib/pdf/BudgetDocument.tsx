import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { BudgetRow, Project } from "@/lib/types/database.types";
import {
  PDF_COLORS as C,
  budgetStatusColor as statusColor,
  budgetStatusLabel as statusLabel,
  pdfFmtCurrency as fmtCurrency,
  pdfFmtNumber   as fmtNumber,
  pdfFmtDate     as fmtDate,
} from "@/lib/utils/pdf";

// ─── Column definitions ───────────────────────────────────────────────────────
// A4 portrait usable width = 595 - 2×30 = 535 pt

interface Col {
  key: string;
  label: Record<"es" | "en", string>;
  width: number;
  align: "left" | "center" | "right";
}

const COLS: Col[] = [
  { key: "code",        label: { es: "Código",      en: "Code"       }, width: 40,  align: "left"   },
  { key: "description", label: { es: "Descripción", en: "Description"}, width: 165, align: "left"   },
  { key: "unit",        label: { es: "Unidad",      en: "Unit"       }, width: 30,  align: "center" },
  { key: "quantity",    label: { es: "Cant.",        en: "Qty"        }, width: 40,  align: "right"  },
  { key: "unit_price",  label: { es: "P. Unit.",     en: "Unit Price" }, width: 65,  align: "right"  },
  { key: "total",       label: { es: "Total",        en: "Total"      }, width: 75,  align: "right"  },
  { key: "status",      label: { es: "Estatus",      en: "Status"     }, width: 55,  align: "center" },
  { key: "assignee",    label: { es: "Responsable",  en: "Assignee"   }, width: 65,  align: "left"   },
];
// 40+165+30+40+65+75+55+65 = 535 ✓

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 48,
    paddingHorizontal: 30,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: C.text,
    backgroundColor: "#ffffff",
  },

  // Header band
  header: {
    backgroundColor: C.orange,
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  headerLeft: { flexDirection: "column", gap: 3 },
  headerLogo: { fontFamily: "Helvetica-Bold", fontSize: 14, color: C.white },
  headerProjectName: { fontSize: 9, color: "rgba(255,255,255,0.9)" },
  headerRight: { alignItems: "flex-end" },
  headerDate: { fontSize: 7, color: "rgba(255,255,255,0.75)" },
  headerLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "rgba(255,255,255,0.85)", marginBottom: 2 },

  // Table header
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: C.orange,
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRadius: 2,
    marginBottom: 1,
  },
  tableHeaderCell: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    color: C.white,
  },

  // Section row
  sectionRow: {
    flexDirection: "row",
    backgroundColor: C.amber,
    paddingVertical: 5,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  sectionText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: C.amberText,
    flex: 1,
  },

  // Data rows
  dataRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  cell: { fontSize: 7.5, color: C.text },
  cellMuted: { fontSize: 7, color: C.muted },

  // Total row
  totalRow: {
    flexDirection: "row",
    backgroundColor: C.orange,
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginTop: 4,
    borderRadius: 2,
  },
  totalLabel: { fontFamily: "Helvetica-Bold", fontSize: 8, color: C.white, flex: 1 },
  totalAmount: { fontFamily: "Helvetica-Bold", fontSize: 8, color: C.white, textAlign: "right", width: 75 },

  // Footer
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    paddingTop: 5,
  },
  footerText: { fontSize: 7, color: C.muted },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCellText(row: BudgetRow, key: string, currency: string): string {
  switch (key) {
    case "code":        return row.code        ?? "—";
    case "description": return row.description;
    case "unit":        return row.unit        ?? "—";
    case "quantity":    return fmtNumber(row.quantity);
    case "unit_price":  return fmtCurrency(row.unit_price, currency);
    case "total":       return fmtCurrency(row.total, currency);
    case "assignee":    return row.assignee    ?? "—";
    default: return "";
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface BudgetDocumentProps {
  project: Project;
  rows: BudgetRow[];
  language: "es" | "en";
  currency: string;
}

export function BudgetDocument({ project, rows, language, currency }: BudgetDocumentProps) {
  // Group rows by section, preserving original sort order
  const sections = new Map<string, BudgetRow[]>();
  for (const row of rows) {
    if (!sections.has(row.section)) sections.set(row.section, []);
    sections.get(row.section)!.push(row);
  }

  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);
  const dateStr = fmtDate(language);
  const docLabel = language === "es" ? "PRESUPUESTO DE OBRA" : "PROJECT BUDGET";

  return (
    <Document
      title={`ConstruSheet – ${project.name}`}
      author="ConstruSheet"
      creator="ConstruSheet"
    >
      <Page size="A4" style={S.page}>
        {/* ── Header ───────────────────────────────────────── */}
        <View style={S.header}>
          <View style={S.headerLeft}>
            <Text style={S.headerLogo}>✦ ConstruSheet</Text>
            <Text style={S.headerProjectName}>{project.name}</Text>
            {project.location ? (
              <Text style={{ fontSize: 7, color: "rgba(255,255,255,0.7)" }}>{project.location}</Text>
            ) : null}
          </View>
          <View style={S.headerRight}>
            <Text style={S.headerLabel}>{docLabel}</Text>
            <Text style={S.headerDate}>{dateStr}</Text>
          </View>
        </View>

        {/* ── Table header row ─────────────────────────────── */}
        <View style={S.tableHeaderRow}>
          {COLS.map((col) => (
            <Text
              key={col.key}
              style={[S.tableHeaderCell, { width: col.width, textAlign: col.align }]}
            >
              {col.label[language]}
            </Text>
          ))}
        </View>

        {/* ── Sections ─────────────────────────────────────── */}
        {Array.from(sections.entries()).map(([section, sectionRows]) => (
          <View key={section}>
            {/* Section header */}
            <View style={S.sectionRow}>
              <Text style={S.sectionText}>{section.toUpperCase()}</Text>
            </View>

            {/* Data rows */}
            {sectionRows.map((row, idx) => (
              <View
                key={row.id}
                style={[S.dataRow, { backgroundColor: idx % 2 === 0 ? "#ffffff" : C.rowAlt }]}
              >
                {COLS.map((col) => {
                  if (col.key === "status") {
                    return (
                      <Text
                        key={col.key}
                        style={[S.cell, { width: col.width, textAlign: col.align, color: statusColor(row.status) }]}
                      >
                        {statusLabel(row.status, language)}
                      </Text>
                    );
                  }
                  return (
                    <Text
                      key={col.key}
                      style={[
                        col.key === "description" ? S.cell : S.cellMuted,
                        { width: col.width, textAlign: col.align },
                      ]}
                    >
                      {getCellText(row, col.key, currency)}
                    </Text>
                  );
                })}
              </View>
            ))}
          </View>
        ))}

        {/* ── Grand total row ───────────────────────────────── */}
        <View style={S.totalRow}>
          <Text style={S.totalLabel}>
            {language === "es" ? "TOTAL GENERAL" : "GRAND TOTAL"}
          </Text>
          <Text style={S.totalAmount}>{fmtCurrency(grandTotal, currency)}</Text>
        </View>

        {/* ── Footer (fixed — repeats on every page) ─────────── */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>ConstruSheet · construsheet.com</Text>
          <Text
            style={S.footerText}
            render={({ pageNumber, totalPages }) =>
              `${language === "es" ? "Página" : "Page"} ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
