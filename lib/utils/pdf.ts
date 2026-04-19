/**
 * Shared design tokens and helpers for @react-pdf/renderer documents.
 * Imported by lib/pdf/BudgetDocument.tsx and lib/pdf/GanttDocument.tsx.
 */

// ─── Color palette ────────────────────────────────────────────────────────────

export const PDF_COLORS = {
  // Brand
  orange:       "#f97316",
  orangeDark:   "#c2410c",
  // Section / grouping
  amber:        "#fef3c7",
  amberText:    "#92400e",
  // Backgrounds
  rowAlt:       "#f9fafb",
  headerDark:   "#1e293b",
  white:        "#ffffff",
  // Typography
  text:         "#111827",
  muted:        "#6b7280",
  // Borders
  border:       "#e5e7eb",
  // Status — budget rows
  approved:     "#16a34a",
  review:       "#d97706",
  pending:      "#9ca3af",
  // Status — gantt tasks
  complete:     "#14b8a6",
  inProgress:   "#f97316",
} as const;

// ─── Page geometry ────────────────────────────────────────────────────────────

export const PDF_PAGE = {
  paddingH:       30,
  paddingTop:     30,
  paddingBottom:  48,  // room for fixed footer
  /** Usable width on A4 portrait  (595 - 2×30) */
  usablePortrait:  535,
  /** Usable width on A4 landscape (842 - 2×30) */
  usableLandscape: 782,
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────

export const PDF_FONT = {
  base:        "Helvetica",
  bold:        "Helvetica-Bold",
  oblique:     "Helvetica-Oblique",
  boldOblique: "Helvetica-BoldOblique",
} as const;

// ─── Shared style fragments ───────────────────────────────────────────────────
// These are plain objects (not StyleSheet.create output) so they can be
// spread into StyleSheet definitions in each document file.

export const PDF_STYLES = {
  page: {
    paddingTop:        PDF_PAGE.paddingTop,
    paddingBottom:     PDF_PAGE.paddingBottom,
    paddingHorizontal: PDF_PAGE.paddingH,
    fontFamily:        PDF_FONT.base,
    fontSize:          8,
    color:             PDF_COLORS.text,
    backgroundColor:   PDF_COLORS.white,
  },

  header: {
    backgroundColor: PDF_COLORS.orange,
    borderRadius:    4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom:    14,
    flexDirection:   "row" as const,
    justifyContent:  "space-between" as const,
    alignItems:      "flex-end" as const,
  },

  headerLogo: {
    fontFamily: PDF_FONT.bold,
    fontSize:   14,
    color:      PDF_COLORS.white,
  },

  tableHeaderRow: {
    flexDirection:    "row" as const,
    backgroundColor:  PDF_COLORS.orange,
    paddingVertical:  5,
    paddingHorizontal: 4,
    borderRadius:     2,
    marginBottom:     1,
  },

  tableHeaderCell: {
    fontFamily: PDF_FONT.bold,
    fontSize:   7,
    color:      PDF_COLORS.white,
  },

  sectionRow: {
    flexDirection:    "row" as const,
    backgroundColor:  PDF_COLORS.amber,
    paddingVertical:  5,
    paddingHorizontal: 4,
    marginTop:        4,
  },

  sectionText: {
    fontFamily: PDF_FONT.bold,
    fontSize:   8,
    color:      PDF_COLORS.amberText,
    flex:       1,
  },

  dataRow: {
    flexDirection:     "row" as const,
    paddingVertical:   4,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_COLORS.border,
  },

  totalRow: {
    flexDirection:    "row" as const,
    backgroundColor:  PDF_COLORS.orange,
    paddingVertical:  6,
    paddingHorizontal: 4,
    marginTop:        4,
    borderRadius:     2,
  },

  footer: {
    position:          "absolute" as const,
    bottom:            20,
    left:              PDF_PAGE.paddingH,
    right:             PDF_PAGE.paddingH,
    flexDirection:     "row" as const,
    justifyContent:    "space-between" as const,
    borderTopWidth:    0.5,
    borderTopColor:    PDF_COLORS.border,
    paddingTop:        5,
  },

  footerText: {
    fontSize: 7,
    color:    PDF_COLORS.muted,
  },
} as const;

// ─── Status helpers ───────────────────────────────────────────────────────────

export function budgetStatusColor(status: string): string {
  if (status === "approved") return PDF_COLORS.approved;
  if (status === "review")   return PDF_COLORS.review;
  return PDF_COLORS.pending;
}

export function budgetStatusLabel(status: string, lang: "es" | "en"): string {
  const map: Record<string, Record<string, string>> = {
    approved: { es: "Aprobado",  en: "Approved" },
    review:   { es: "Revisión",  en: "Review"   },
    pending:  { es: "Pendiente", en: "Pending"  },
  };
  return map[status]?.[lang] ?? status;
}

export function ganttStatusColor(status: string): string {
  if (status === "complete")    return PDF_COLORS.complete;
  if (status === "in-progress") return PDF_COLORS.inProgress;
  return PDF_COLORS.pending;
}

export function ganttStatusLabel(status: string, lang: "es" | "en"): string {
  const map: Record<string, Record<string, string>> = {
    complete:      { es: "Completo",  en: "Complete"    },
    "in-progress": { es: "En curso",  en: "In progress" },
    pending:       { es: "Pendiente", en: "Pending"     },
  };
  return map[status]?.[lang] ?? status;
}

// ─── Number formatters ────────────────────────────────────────────────────────

export function pdfFmtCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style:                 "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function pdfFmtNumber(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function pdfFmtDate(language: "es" | "en"): string {
  return new Date().toLocaleDateString(language === "es" ? "es-MX" : "en-US", {
    year:  "numeric",
    month: "long",
    day:   "numeric",
  });
}
