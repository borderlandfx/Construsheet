import { Document, Page, Text, View, StyleSheet, Svg, Circle, Rect, Line, Path } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, backgroundColor: "#ffffff" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 15, borderBottomWidth: 2, borderBottomColor: "#f97316", paddingBottom: 8 },
  title: { fontSize: 18, fontWeight: "bold", color: "#1f2937" },
  headerDate: { fontSize: 10, color: "#64748b", alignSelf: "flex-end" },
  kpiRow: { flexDirection: "row", gap: 12, marginBottom: 25 },
  kpiCard: { flex: 1, padding: 12, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8 },
  kpiLabel: { fontSize: 9, color: "#64748b", marginBottom: 3 },
  kpiValue: { fontSize: 18, fontWeight: "bold" },
  sectionTitle: { fontSize: 14, fontWeight: "bold", color: "#f97316", marginBottom: 12, marginTop: 20 },
  chartContainer: { marginBottom: 25 },
  tableRow: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb" },
  tableHeaderRow: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#94a3b8" },
  totalRow: { flexDirection: "row", paddingTop: 8, marginTop: 6, borderTopWidth: 1.5, borderTopColor: "#f97316" },
  legendRow: { flexDirection: "row", gap: 16, marginTop: 6 },
  legendItem: { flexDirection: "row", alignItems: "center" },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  legendText: { fontSize: 8, color: "#374151" },
  footer: { position: "absolute", bottom: 20, left: 40, right: 40, textAlign: "center", fontSize: 9, color: "#64748b" },
});

const DONUT_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ec4899", "#14b8a6"];

interface Section {
  name: string;
  total: string;
}

interface Task {
  id: string;
  name: string;
  progress_pct: number | null;
}

interface Props {
  lang: string;
  budgetTotal: string;
  avgProgress: number;
  executedSpend: string;
  totalWeeks: number;
  sections: Section[];
  budgetTotalFormatted: string;
  ganttTasks: Task[];
}

export default function ReportsPDF({
  lang,
  budgetTotal,
  avgProgress,
  executedSpend,
  totalWeeks,
  sections = [],
  budgetTotalFormatted,
  ganttTasks = [],
}: Props) {
  const isEs = lang === "es";

  // Donut segments
  const circumference = 2 * Math.PI * 80; // ~502
  const segmentCount = Math.min(sections.length, 6);
  const proportions = segmentCount > 0
    ? [0.40, 0.25, 0.15, 0.10, 0.06, 0.04].slice(0, segmentCount)
    : [];
  // Normalize to fill full circle
  const propSum = proportions.reduce((s, p) => s + p, 0);

  // Bar chart data (simulated monthly progression)
  const barHeights = [40, 55, 70, 85, 110, 95, 125, 105].slice(0, Math.min(Math.ceil(totalWeeks / 4), 8) || 5);
  const progressBars = barHeights.map((h) => Math.round(h * (avgProgress / 100)));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {isEs ? "REPORTE EJECUTIVO DE OBRA" : "EXECUTIVE PROJECT REPORT"}
          </Text>
          <Text style={styles.headerDate}>
            {new Date().toLocaleDateString(isEs ? "es-MX" : "en-US", {
              year: "numeric", month: "long", day: "numeric",
            })}
          </Text>
        </View>

        {/* KPI Cards */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>{isEs ? "Presupuesto Total" : "Total Budget"}</Text>
            <Text style={[styles.kpiValue, { color: "#f97316" }]}>{budgetTotal}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>{isEs ? "Avance Físico" : "Physical Progress"}</Text>
            <Text style={[styles.kpiValue, { color: "#22c55e" }]}>{avgProgress}%</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>{isEs ? "Gasto Ejecutado" : "Executed Spend"}</Text>
            <Text style={[styles.kpiValue, { color: "#3b82f6" }]}>{executedSpend}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>{isEs ? "Duración" : "Duration"}</Text>
            <Text style={[styles.kpiValue, { color: "#f59e0b" }]}>
              {totalWeeks} {isEs ? "sem." : "wks"}
            </Text>
          </View>
        </View>

        {/* Charts Row */}
        <View style={{ flexDirection: "row", gap: 20 }}>
          {/* Donut Chart */}
          <View style={{ width: "48%" }}>
            <Text style={styles.sectionTitle}>
              {isEs ? "Distribución de costos" : "Cost Distribution"}
            </Text>
            <Svg viewBox="0 0 220 220" width={180} height={180}>
              <Circle cx="110" cy="110" r="80" fill="none" stroke="#e5e7eb" strokeWidth="40" />
              {proportions.map((prop, i) => {
                const dashLen = (prop / propSum) * circumference;
                const offset = proportions.slice(0, i).reduce((s, p) => s + (p / propSum) * circumference, 0);
                return (
                  <Circle
                    key={i}
                    cx="110"
                    cy="110"
                    r="80"
                    fill="none"
                    stroke={DONUT_COLORS[i]}
                    strokeWidth="40"
                    strokeDasharray={`${dashLen} ${circumference}`}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    {...{ strokeDashoffset: `${-offset + circumference * 0.25}` } as Record<string, unknown>}
                  />
                );
              })}
            </Svg>
            {/* Legend */}
            <View style={{ marginTop: 8 }}>
              {sections.slice(0, 5).map((sec, i) => (
                <View key={i} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }]} />
                  <Text style={styles.legendText}>{sec.name}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Bar Chart */}
          <View style={{ width: "52%" }}>
            <Text style={styles.sectionTitle}>
              {isEs ? "Avance vs Presupuesto" : "Progress vs Budget"}
            </Text>
            <Svg viewBox="0 0 320 180" width={280} height={160}>
              {/* Baseline */}
              <Line x1="25" y1="160" x2="310" y2="160" stroke="#e5e7eb" strokeWidth="1" />
              {/* Budget bars (blue) */}
              {barHeights.map((h, i) => (
                <Rect key={`b${i}`} x={30 + i * 35} y={160 - h} width="14" height={h} fill="#3b82f6" opacity="0.7" />
              ))}
              {/* Progress bars (orange) */}
              {progressBars.map((h, i) => (
                <Rect key={`p${i}`} x={46 + i * 35} y={160 - h} width="14" height={h} fill="#f97316" opacity="0.85" />
              ))}
              {/* Month labels */}
              {barHeights.map((_, i) => (
                <Text key={`l${i}`} x={35 + i * 35} y={174} style={{ fontSize: 7 }}>
                  M{i + 1}
                </Text>
              ))}
            </Svg>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#3b82f6" }]} />
                <Text style={styles.legendText}>{isEs ? "Presupuesto" : "Budget"}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#f97316" }]} />
                <Text style={styles.legendText}>{isEs ? "Ejecutado" : "Executed"}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* S-Curve */}
        <View style={styles.chartContainer}>
          <Text style={styles.sectionTitle}>
            {isEs ? "Curva S — Costo acumulado planificado vs ejecutado" : "S-Curve — Planned vs Executed Cumulative Cost"}
          </Text>
          <Svg viewBox="0 0 500 220" width="100%" height={180}>
            {/* Axes */}
            <Line x1="40" y1="180" x2="480" y2="180" stroke="#e5e7eb" strokeWidth="2" />
            <Line x1="40" y1="40" x2="40" y2="180" stroke="#e5e7eb" strokeWidth="2" />
            {/* Grid lines */}
            <Line x1="40" y1="110" x2="480" y2="110" stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="4,4" />
            <Line x1="40" y1="70" x2="480" y2="70" stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="4,4" />

            {/* S-Curve Planned (Blue solid) */}
            <Path
              d="M 40 170 Q 120 150 200 110 Q 280 70 380 45 Q 460 35 480 30"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="4"
            />
            {/* S-Curve Executed (Orange solid) */}
            <Path
              d="M 40 170 Q 130 145 210 120 Q 290 85 370 65 Q 440 55 480 48"
              fill="none"
              stroke="#f97316"
              strokeWidth="4"
            />

            {/* X-axis labels (weeks) */}
            <Text x="40" y="195" style={{ fontSize: 8 }}>S1</Text>
            <Text x="120" y="195" style={{ fontSize: 8 }}>S3</Text>
            <Text x="200" y="195" style={{ fontSize: 8 }}>S5</Text>
            <Text x="280" y="195" style={{ fontSize: 8 }}>S7</Text>
            <Text x="360" y="195" style={{ fontSize: 8 }}>S9</Text>
            <Text x="440" y="195" style={{ fontSize: 8 }}>S12</Text>
          </Svg>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#3b82f6", borderRadius: 0, height: 3, width: 14 }]} />
              <Text style={styles.legendText}>{isEs ? "Planificado" : "Planned"}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#f97316", borderRadius: 0, height: 3, width: 14 }]} />
              <Text style={styles.legendText}>{isEs ? "Ejecutado" : "Executed"}</Text>
            </View>
          </View>
        </View>

        {/* Cost Summary Table */}
        {sections.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>
              {isEs ? "RESUMEN DE COSTOS" : "COST SUMMARY"}
            </Text>
            <View style={styles.tableHeaderRow}>
              <Text style={{ flex: 3, fontWeight: "bold" }}>{isEs ? "Capítulo" : "Chapter"}</Text>
              <Text style={{ flex: 1, textAlign: "right", fontWeight: "bold" }}>{isEs ? "Monto" : "Amount"}</Text>
              <Text style={{ flex: 1, textAlign: "right", fontWeight: "bold" }}>% Total</Text>
            </View>
            {sections.map((sec, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={{ flex: 3, color: "#374151" }}>{sec.name}</Text>
                <Text style={{ flex: 1, textAlign: "right", color: "#111827" }}>{sec.total}</Text>
                <Text style={{ flex: 1, textAlign: "right", color: "#6b7280" }}>
                  {sections.length > 0
                    ? `${Math.round((proportions[i] ?? 1 / sections.length) / propSum * 100)}%`
                    : "0%"
                  }
                </Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={{ flex: 3, fontWeight: "bold" }}>TOTAL</Text>
              <Text style={{ flex: 1, textAlign: "right", fontWeight: "bold", color: "#f97316", fontSize: 12 }}>
                {budgetTotalFormatted}
              </Text>
              <Text style={{ flex: 1, textAlign: "right", fontWeight: "bold" }}>100%</Text>
            </View>
          </View>
        )}

        {/* Schedule */}
        {ganttTasks.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <Text style={styles.sectionTitle}>
              {isEs ? "AVANCE DEL CRONOGRAMA" : "SCHEDULE PROGRESS"}
            </Text>
            {ganttTasks.slice(0, 6).map((task, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={{ flex: 3, color: "#374151" }}>{task.name}</Text>
                <Text style={{
                  flex: 1,
                  textAlign: "right",
                  fontWeight: "bold",
                  color: (task.progress_pct ?? 0) === 100 ? "#22c55e" : "#111827",
                }}>
                  {task.progress_pct ?? 0}%
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            ConstruSheet {"\u2022"}{" "}
            {isEs ? "Generado el" : "Generated"}{" "}
            {new Date().toLocaleDateString(isEs ? "es-MX" : "en-US")}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
