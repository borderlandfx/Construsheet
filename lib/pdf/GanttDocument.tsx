import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { GanttTask, Project } from "@/lib/types/database.types";
import {
  PDF_COLORS,
  ganttStatusColor as getStatusColor,
  ganttStatusLabel as getStatusLabel,
  pdfFmtDate as fmtDate,
} from "@/lib/utils/pdf";

// Alias for local brevity
const C = PDF_COLORS;

// ─── Layout constants ─────────────────────────────────────────────────────────
// A4 landscape usable width = 842 - 2×30 = 782 pt

const TOTAL_WEEKS = 12;
const COL_NAME     = 181;
const COL_ASSIGNEE = 80;
const COL_STATUS   = 65;
const COL_WEEK     = Math.floor((782 - COL_NAME - COL_ASSIGNEE - COL_STATUS) / TOTAL_WEEKS); // 38
// 181+80+65+(38×12) = 782 ✓

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

  // Header
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
  headerLogo:    { fontFamily: "Helvetica-Bold", fontSize: 14, color: C.white },
  headerSub:     { fontSize: 7.5, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  headerRight:   { alignItems: "flex-end" },
  headerDate:    { fontSize: 7, color: "rgba(255,255,255,0.75)" },
  headerLabel:   { fontSize: 9, fontFamily: "Helvetica-Bold", color: "rgba(255,255,255,0.9)", marginBottom: 2 },

  // Table header
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#1e293b",
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRadius: 2,
    marginBottom: 1,
  },
  thText: { fontFamily: "Helvetica-Bold", fontSize: 7, color: C.white },
  thWeek: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },

  // Task rows
  taskRow: {
    flexDirection: "row",
    paddingVertical: 0,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
    minHeight: 22,
    alignItems: "stretch",
  },

  // Left info cell
  cellInfo: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    justifyContent: "center",
  },
  cellText:  { fontSize: 7.5, color: C.text },
  cellMuted: { fontSize: 7,   color: C.muted },

  // Week cells
  weekCell: {
    width: COL_WEEK,
    borderLeftWidth: 0.5,
    borderLeftColor: C.border,
    justifyContent: "center",
    alignItems: "center",
  },
  weekActive: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },

  // Legend
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: C.border,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 7, color: C.muted },

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

function isActiveWeek(task: GanttTask, week: number): boolean {
  return week >= task.start_week && week < task.start_week + task.duration_weeks;
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface GanttDocumentProps {
  project: Project;
  tasks: GanttTask[];
  language: "es" | "en";
}

export function GanttDocument({ project, tasks, language }: GanttDocumentProps) {
  const dateStr = fmtDate(language);
  const docLabel = language === "es"
    ? "CRONOGRAMA DE OBRA"
    : "PROJECT SCHEDULE";

  const weeks = Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1);

  return (
    <Document
      title={`ConstruSheet – ${project.name}`}
      author="ConstruSheet"
      creator="ConstruSheet"
    >
      <Page size="A4" orientation="landscape" style={S.page}>
        {/* ── Header ───────────────────────────────────────── */}
        <View style={S.header}>
          <View>
            <Text style={S.headerLogo}>✦ ConstruSheet</Text>
            <Text style={S.headerSub}>{project.name}</Text>
          </View>
          <View style={S.headerRight}>
            <Text style={S.headerLabel}>{docLabel}</Text>
            <Text style={S.headerDate}>{dateStr}</Text>
          </View>
        </View>

        {/* ── Table header ─────────────────────────────────── */}
        <View style={S.tableHeaderRow}>
          <Text style={[S.thText, { width: COL_NAME }]}>
            {language === "es" ? "Actividad" : "Activity"}
          </Text>
          <Text style={[S.thText, { width: COL_ASSIGNEE }]}>
            {language === "es" ? "Responsable" : "Assignee"}
          </Text>
          <Text style={[S.thText, { width: COL_STATUS, textAlign: "center" }]}>
            {language === "es" ? "Estatus" : "Status"}
          </Text>
          {weeks.map((w) => (
            <Text key={w} style={[S.thWeek, { width: COL_WEEK }]}>
              {`S${w}`}
            </Text>
          ))}
        </View>

        {/* ── Task rows ────────────────────────────────────── */}
        {tasks.map((task, idx) => {
          const barColor = task.color || C.orange;
          const statusColor = getStatusColor(task.status);

          return (
            <View
              key={task.id}
              style={[S.taskRow, { backgroundColor: idx % 2 === 0 ? "#ffffff" : C.rowAlt }]}
            >
              {/* Name */}
              <View style={[S.cellInfo, { width: COL_NAME }]}>
                <Text style={S.cellText}>{task.name}</Text>
              </View>

              {/* Assignee */}
              <View style={[S.cellInfo, { width: COL_ASSIGNEE }]}>
                <Text style={S.cellMuted}>{task.assignee ?? "—"}</Text>
              </View>

              {/* Status */}
              <View style={[S.cellInfo, { width: COL_STATUS, alignItems: "center" }]}>
                <Text style={[S.cellMuted, { color: statusColor }]}>
                  {getStatusLabel(task.status, language)}
                </Text>
              </View>

              {/* Week cells */}
              {weeks.map((w) => {
                const active = isActiveWeek(task, w);
                return (
                  <View key={w} style={S.weekCell}>
                    {active ? (
                      <View
                        style={[
                          S.weekActive,
                          { backgroundColor: barColor, opacity: 0.85 },
                        ]}
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>
          );
        })}

        {/* ── Legend ───────────────────────────────────────── */}
        <View style={S.legendRow}>
          {(["complete", "in-progress", "pending"] as const).map((s) => (
            <View key={s} style={S.legendItem}>
              <View style={[S.legendDot, { backgroundColor: getStatusColor(s) }]} />
              <Text style={S.legendText}>{getStatusLabel(s, language)}</Text>
            </View>
          ))}
          <Text style={[S.legendText, { marginLeft: "auto" }]}>
            {language === "es"
              ? `Mostrando primeras ${TOTAL_WEEKS} semanas`
              : `Showing first ${TOTAL_WEEKS} weeks`}
          </Text>
        </View>

        {/* ── Footer ───────────────────────────────────────── */}
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
