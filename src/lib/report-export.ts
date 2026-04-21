import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Suggestion } from "./optimize";
import type {
  ComplianceStats,
  ReportData,
  ScoredStaffLine,
} from "./report";

export type ReportExportContext = {
  title: string;
  subtitle: string;
  report: ReportData;
  compliance: ComplianceStats;
  staffWithStatus: ScoredStaffLine[];
  topSuggestions: Array<Suggestion & { weekStart: string }>;
  suggestionCount: number;
  totalSavings: number;
  annualCurrent: number;
  annualOptimized: number;
  annualDiff: number;
  weeklySavingsAvg: number;
  penaltyPct: number;
  penaltyTargetPct: number;
  avgCostPerHour: number;
  numWeeks: number;
};

function currency(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

function shortDate(iso: string): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const [y, m, d] = iso.split("-").map(Number);
  return `${months[m - 1]} ${d}, ${y}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ----- PDF -----------------------------------------------------------------

export function exportReportToPdf(
  ctx: ReportExportContext,
  filename: string,
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 118, 110);
  doc.text("RosterMate", margin, y);
  y += 7;

  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(ctx.title, margin, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(ctx.subtitle, margin, y);
  y += 8;

  // Executive summary tiles
  const tileLabels = [
    { label: "Total cost", value: currency(ctx.report.totalCost) },
    { label: "Hours", value: `${ctx.report.totalHours}` },
    { label: "Avg $/h", value: `$${ctx.avgCostPerHour.toFixed(2)}` },
    {
      label: ctx.numWeeks > 1 ? `Shifts / ${ctx.numWeeks} wks` : "Shifts",
      value: `${ctx.report.totalShifts}`,
    },
  ];
  const tileWidth = (pageWidth - margin * 2 - 3 * 3) / 4;
  const tileHeight = 18;
  tileLabels.forEach((tile, i) => {
    const x = margin + i * (tileWidth + 3);
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, tileWidth, tileHeight, 2, 2, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(tile.label, x + 3, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(tile.value, x + 3, y + 13);
  });
  y += tileHeight + 6;

  // Penalty line
  if (ctx.report.totalCost > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("Penalty loading", margin, y);
    const pctText = `${ctx.penaltyPct.toFixed(1)}% of total  ·  target ${ctx.penaltyTargetPct}%`;
    doc.setFont("helvetica", "normal");
    doc.text(pctText, pageWidth - margin, y, { align: "right" });
    y += 3;
    // Bar
    const barWidth = pageWidth - margin * 2;
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(226, 232, 240);
    doc.rect(margin, y, barWidth, 2, "F");
    const pctClamped = Math.min(100, Math.max(0, ctx.penaltyPct));
    const over = ctx.penaltyPct > ctx.penaltyTargetPct;
    doc.setFillColor(
      over ? 244 : 16,
      over ? 63 : 185,
      over ? 94 : 129,
    );
    doc.rect(margin, y, (barWidth * pctClamped) / 100, 2, "F");
    // Target marker
    const targetX = margin + (barWidth * ctx.penaltyTargetPct) / 100;
    doc.setFillColor(51, 65, 85);
    doc.rect(targetX, y - 0.5, 0.5, 3, "F");
    y += 7;
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `${currency(ctx.report.penaltyPremium)} weekend / night / casual loading`,
      margin,
      y,
    );
    y += 6;
  }

  // Action required
  if (ctx.compliance.overtimeStaff.length > 0 || ctx.topSuggestions.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text("Action required", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);

    for (const o of ctx.compliance.overtimeStaff) {
      const line =
        o.weeks.length === 1
          ? `• OVERTIME: ${o.name} scheduled ${o.weeks[0].hours}h during week of ${shortDate(o.weeks[0].weekStart)} (exceeds 38h).`
          : `• OVERTIME: ${o.name} exceeded 38h in ${o.weeks.length} weeks (peaked ${o.maxHours}h on ${shortDate(o.weeks[0].weekStart)}).`;
      y = writeWrapped(doc, line, margin, y, pageWidth - margin * 2, 4);
    }
    ctx.topSuggestions.forEach((s, idx) => {
      const weekLabel =
        ctx.numWeeks > 1 ? ` (week of ${shortDate(s.weekStart)})` : "";
      const line = `${idx + 1 + ctx.compliance.overtimeStaff.length}. ${s.staffName}${weekLabel}: ${s.headline.toLowerCase()}. Save $${Math.round(s.savings)}.`;
      y = writeWrapped(doc, line, margin, y, pageWidth - margin * 2, 4);
    });
    y += 2;
  }

  // Compliance checks
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text("Award compliance", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);

  const complianceLines: string[] = [
    `OK  Break requirements: ${ctx.compliance.shiftsTriggeringBreak} shifts >=5h auto-deducted.`,
    ctx.compliance.overtimeStaff.length === 0
      ? `OK  Overtime thresholds: no staff exceed 38h in any week${ctx.numWeeks > 1 ? ` (${ctx.numWeeks} weeks checked)` : ""}.`
      : `WARN  Overtime: ${ctx.compliance.overtimeStaff.map((o) => o.name).join(", ")}.`,
    `OK  Weekend loading applied to ${ctx.compliance.weekendShifts} shift(s) (Sat +25%, Sun +50%).`,
    `OK  Night loading applied to ${ctx.compliance.nightShifts} shift(s) in 7pm-7am window (+15%).`,
    `OK  Casual loading (+25%) applied to ${ctx.compliance.casualShifts} shift(s) across ${ctx.compliance.casualStaffCount} casual employee(s).`,
  ];
  for (const line of complianceLines) {
    y = writeWrapped(doc, line, margin, y, pageWidth - margin * 2, 4);
  }
  y += 3;

  // Page break if near bottom
  if (y > 240) {
    doc.addPage();
    y = margin;
  }

  // By staff table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `By staff${ctx.numWeeks > 1 ? `  (totals across ${ctx.numWeeks} weeks)` : ""}`,
    margin,
    y,
  );
  y += 2;

  autoTable(doc, {
    startY: y + 2,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [71, 85, 105],
      fontStyle: "bold",
    },
    head: [["Staff", "Role", "Shifts", "Hours", "Cost", "$/h", "Status"]],
    body: ctx.staffWithStatus.map((s) => [
      s.name,
      s.role,
      s.shifts,
      s.hours,
      currency(s.cost),
      `$${s.avgPerHour}`,
      s.level === "good"
        ? "Efficient"
        : s.level === "medium"
          ? "Acceptable"
          : "Review",
    ]),
  });
  // jspdf-autotable stashes lastAutoTable on the jsPDF instance.
  const afterStaff =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? y;
  y = afterStaff + 6;

  // By day
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `By day${ctx.numWeeks > 1 ? `  (summed across ${ctx.numWeeks} weeks)` : ""}`,
    margin,
    y,
  );
  autoTable(doc, {
    startY: y + 2,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [71, 85, 105],
      fontStyle: "bold",
    },
    head: [["Day", "Date", "Shifts", "Hours", "Cost"]],
    body: ctx.report.byDay.map((d) => [
      d.dayName,
      d.dateLabel,
      d.shifts,
      d.hours,
      currency(d.cost),
    ]),
  });
  const afterDay =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? y;
  y = afterDay + 6;

  // Annualized impact
  if (ctx.report.totalCost > 0 && y < 260) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text("Annualized impact", margin, y);
    y += 5;

    const panelHeight = 22;
    const panelWidth = pageWidth - margin * 2;
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, panelWidth, panelHeight, 2, 2, "FD");
    const colWidth = panelWidth / 3;

    const cols = [
      {
        label: "Current trajectory",
        value: currency(ctx.annualCurrent),
        sub: "weekly avg × 52",
      },
      {
        label: "After optimization",
        value: currency(ctx.annualOptimized),
        sub: "if all suggestions applied",
      },
      {
        label: "Annual savings",
        value: currency(ctx.annualDiff),
        sub:
          ctx.weeklySavingsAvg > 0
            ? `$${Math.round(ctx.weeklySavingsAvg)}/week × 52`
            : "no opportunities in range",
      },
    ];
    cols.forEach((c, i) => {
      const cx = margin + i * colWidth + 3;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(c.label, cx, y + 5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(c.value, cx, y + 12);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(c.sub, cx, y + 18);
    });
    y += panelHeight + 4;
  }

  // Footer disclaimer
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    "RosterMate award calculations are indicative only. Users remain responsible for payroll accuracy.",
    margin,
    290,
  );

  doc.save(filename);
}

function writeWrapped(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

// ----- Word (HTML blob with .doc extension) ---------------------------------

export function exportReportToWord(
  ctx: ReportExportContext,
  filename: string,
) {
  const html = buildWordHtml(ctx);
  const blob = new Blob(["﻿", html], {
    type: "application/msword",
  });
  downloadBlob(blob, filename);
}

function escapeHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildWordHtml(ctx: ReportExportContext): string {
  const actionRows: string[] = [];
  for (const o of ctx.compliance.overtimeStaff) {
    const line =
      o.weeks.length === 1
        ? `OVERTIME — <strong>${escapeHtml(o.name)}</strong> scheduled ${o.weeks[0].hours}h during the week of ${escapeHtml(shortDate(o.weeks[0].weekStart))}, exceeding the 38h full-time limit.`
        : `OVERTIME — <strong>${escapeHtml(o.name)}</strong> exceeded 38h in ${o.weeks.length} weeks (peaked at ${o.maxHours}h during ${escapeHtml(shortDate(o.weeks[0].weekStart))}).`;
    actionRows.push(`<li>${line}</li>`);
  }
  ctx.topSuggestions.forEach((s) => {
    const week =
      ctx.numWeeks > 1 ? ` (week of ${escapeHtml(shortDate(s.weekStart))})` : "";
    actionRows.push(
      `<li><strong>${escapeHtml(s.staffName)}</strong>${week}: ${escapeHtml(s.headline.toLowerCase())}. Save $${Math.round(s.savings)}.</li>`,
    );
  });

  const complianceRows = [
    `✅ Break requirements: ${ctx.compliance.shiftsTriggeringBreak} shift(s) ≥5h — auto-deducted per award.`,
    ctx.compliance.overtimeStaff.length === 0
      ? `✅ Overtime thresholds: no staff exceed 38h in any week${ctx.numWeeks > 1 ? ` (${ctx.numWeeks} weeks checked)` : ""}.`
      : `⚠️ Overtime: ${ctx.compliance.overtimeStaff.map((o) => o.name).join(", ")}.`,
    `✅ Weekend loading applied to ${ctx.compliance.weekendShifts} shift(s) (Sat +25%, Sun +50%).`,
    `✅ Night loading applied to ${ctx.compliance.nightShifts} shift(s) in the 7pm–7am window (+15%).`,
    `✅ Casual loading (+25%) applied to ${ctx.compliance.casualShifts} shift(s) across ${ctx.compliance.casualStaffCount} casual employee(s).`,
  ]
    .map((row) => `<li>${escapeHtml(row)}</li>`)
    .join("");

  const staffRows = ctx.staffWithStatus
    .map(
      (s) => `
    <tr>
      <td><strong>${escapeHtml(s.name)}</strong><br/><span style="color:#64748b;font-size:11px">${escapeHtml(s.role)}</span></td>
      <td>${s.shifts}</td>
      <td>${s.hours}</td>
      <td><strong>${escapeHtml(currency(s.cost))}</strong></td>
      <td>$${s.avgPerHour}</td>
      <td>${s.level === "good" ? "Efficient" : s.level === "medium" ? "Acceptable" : "Review"}</td>
    </tr>
  `,
    )
    .join("");

  const dayRows = ctx.report.byDay
    .map(
      (d) => `
    <tr>
      <td><strong>${escapeHtml(d.dayName)}</strong>${d.dateLabel ? `<br/><span style="color:#64748b;font-size:11px">${escapeHtml(d.dateLabel)}</span>` : ""}</td>
      <td>${d.shifts}</td>
      <td>${d.hours}</td>
      <td><strong>${escapeHtml(currency(d.cost))}</strong></td>
    </tr>
  `,
    )
    .join("");

  return `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset='utf-8'>
<title>${escapeHtml(ctx.title)}</title>
<style>
  body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; color: #0f172a; font-size: 12px; }
  h1 { color: #0f766e; margin: 0 0 4px; font-size: 22px; }
  h2 { color: #334155; margin: 16px 0 6px; font-size: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
  .subtitle { color: #64748b; margin: 0 0 12px; font-size: 12px; }
  .tiles { margin: 12px 0; }
  .tile { display: inline-block; width: 22%; margin-right: 2%; background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; vertical-align: top; }
  .tile-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
  .tile-value { font-size: 18px; font-weight: bold; color: #0f172a; margin-top: 4px; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; }
  th, td { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; font-size: 12px; vertical-align: top; }
  th { background: #f1f5f9; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  ul { margin: 6px 0 10px; padding-left: 18px; }
  li { margin: 3px 0; }
  .panel { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; margin-top: 10px; }
  .panel-col { display: inline-block; width: 32%; vertical-align: top; }
  .disclaimer { color: #94a3b8; font-size: 10px; font-style: italic; margin-top: 18px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
</style>
</head>
<body>
  <h1>${escapeHtml(ctx.title)}</h1>
  <p class="subtitle">${escapeHtml(ctx.subtitle)}</p>

  <h2>Executive summary</h2>
  <div class="tiles">
    <div class="tile"><div class="tile-label">Total cost</div><div class="tile-value">${escapeHtml(currency(ctx.report.totalCost))}</div></div>
    <div class="tile"><div class="tile-label">Hours</div><div class="tile-value">${ctx.report.totalHours}</div></div>
    <div class="tile"><div class="tile-label">Avg $/h</div><div class="tile-value">$${ctx.avgCostPerHour.toFixed(2)}</div></div>
    <div class="tile"><div class="tile-label">${escapeHtml(ctx.numWeeks > 1 ? `Shifts / ${ctx.numWeeks} wks` : "Shifts")}</div><div class="tile-value">${ctx.report.totalShifts}</div></div>
  </div>
  <p><strong>Penalty loading:</strong> ${ctx.penaltyPct.toFixed(1)}% of total cost (${escapeHtml(currency(ctx.report.penaltyPremium))}). Target: ${ctx.penaltyTargetPct}%.</p>

  ${
    actionRows.length > 0
      ? `<h2>Action required</h2><ul>${actionRows.join("")}</ul>${ctx.totalSavings > 0 ? `<p><em>Applying all ${ctx.suggestionCount} suggestion(s) saves $${Math.round(ctx.totalSavings).toLocaleString()} across this period.</em></p>` : ""}`
      : ""
  }

  <h2>Award compliance</h2>
  <ul>${complianceRows}</ul>

  <h2>By staff${ctx.numWeeks > 1 ? ` (totals across ${ctx.numWeeks} weeks)` : ""}</h2>
  <table>
    <thead><tr><th>Staff</th><th>Shifts</th><th>Hours</th><th>Cost</th><th>$/h</th><th>Status</th></tr></thead>
    <tbody>${staffRows}</tbody>
  </table>

  <h2>By day${ctx.numWeeks > 1 ? ` (summed across ${ctx.numWeeks} weeks)` : ""}</h2>
  <table>
    <thead><tr><th>Day</th><th>Shifts</th><th>Hours</th><th>Cost</th></tr></thead>
    <tbody>${dayRows}</tbody>
  </table>

  ${
    ctx.report.totalCost > 0
      ? `
  <h2>Annualized impact</h2>
  <div class="panel">
    <div class="panel-col"><div class="tile-label">Current trajectory</div><div class="tile-value">${escapeHtml(currency(ctx.annualCurrent))}</div><div style="font-size:10px;color:#64748b">weekly avg × 52</div></div>
    <div class="panel-col"><div class="tile-label" style="color:#047857">After optimization</div><div class="tile-value" style="color:#047857">${escapeHtml(currency(ctx.annualOptimized))}</div><div style="font-size:10px;color:#047857">if all suggestions applied</div></div>
    <div class="panel-col"><div class="tile-label">Annual savings</div><div class="tile-value">${escapeHtml(currency(ctx.annualDiff))}</div><div style="font-size:10px;color:#64748b">${ctx.weeklySavingsAvg > 0 ? `$${Math.round(ctx.weeklySavingsAvg)}/week × 52` : "no opportunities in range"}</div></div>
  </div>
  `
      : ""
  }

  <p class="disclaimer">RosterMate award calculations are indicative only. Users remain responsible for payroll accuracy. Consult your accountant for complex situations.</p>
</body>
</html>`;
}
