"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { fetchRangeShifts } from "@/app/actions";
import {
  addDays,
  daysForWeek,
  formatWeekLabel,
  startOfWeek,
  toIsoDate,
} from "@/lib/date";
import { computeSuggestions, type Suggestion } from "@/lib/optimize";
import {
  buildReport,
  complianceStats,
  formatCurrency,
  scoreStaffEfficiency,
  toCsv,
  trendOf,
  type EfficiencyLevel,
  type Trend,
} from "@/lib/report";
import {
  exportReportToPdf,
  exportReportToWord,
  type ReportExportContext,
} from "@/lib/report-export";
import type { Shift, Staff } from "@/lib/types";

type Mode = "weekly" | "monthly" | "custom";

const PENALTY_TARGET_PCT = 15;
const MONTHS = [
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

function snapMonday(isoDate: string): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return startOfWeek(date);
}

function listWeeks(fromMonday: string, toMonday: string): string[] {
  const out: string[] = [];
  let cursor = fromMonday;
  while (cursor <= toMonday) {
    out.push(cursor);
    cursor = addDays(cursor, 7);
  }
  return out;
}

function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function rangeLabel(mode: Mode, weekStarts: string[]): string {
  if (weekStarts.length === 0) return "No weeks selected";
  if (mode === "weekly") return formatWeekLabel(weekStarts[0]);
  const firstDays = daysForWeek(weekStarts[0]);
  const lastDays = daysForWeek(weekStarts[weekStarts.length - 1]);
  const year = weekStarts[0].slice(0, 4);
  return `${firstDays[0].date}, ${year} – ${lastDays[6].date} (${weekStarts.length} weeks)`;
}

function fileSuffix(mode: Mode, weekStarts: string[]): string {
  if (weekStarts.length === 0) return "";
  if (mode === "weekly") return weekStarts[0];
  return `${weekStarts[0]}_to_${weekStarts[weekStarts.length - 1]}`;
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function arrow(d: Trend["direction"]) {
  if (d === "up") return "↗";
  if (d === "down") return "↘";
  return "→";
}

function trendText(t: Trend, unit: string): string {
  if (!t.priorHasData) return "no prior data";
  if (t.direction === "flat") return "same as prior";
  const abs = Math.abs(t.delta);
  const pct = Math.abs(t.pct);
  const unitValue =
    unit === "$"
      ? `$${Math.round(abs).toLocaleString()}`
      : unit === "$$"
        ? `$${abs.toFixed(2)}`
        : `${Math.round(abs)}${unit}`;
  return `${unitValue} (${t.direction === "up" ? "+" : "-"}${pct.toFixed(1)}%) vs prior`;
}

function trendClass(t: Trend, invertGood = false): string {
  if (!t.priorHasData || t.direction === "flat") return "text-slate-500";
  const good = invertGood ? t.direction === "up" : t.direction === "down";
  return good ? "text-emerald-600" : "text-rose-500";
}

const levelStyles: Record<EfficiencyLevel, { dot: string; label: string }> = {
  good: { dot: "bg-emerald-500", label: "Efficient" },
  medium: { dot: "bg-amber-400", label: "Acceptable" },
  watch: { dot: "bg-rose-500", label: "Review scheduling" },
};

type SuggestionWithWeek = Suggestion & { weekStart: string };

export function ReportModal({
  open,
  weekStart: initialWeekStart,
  staff,
  shifts: initialShifts,
  priorShifts: initialPriorShifts,
  suggestions: initialSuggestions,
  onClose,
}: {
  open: boolean;
  weekStart: string;
  weekLabel: string;
  days: unknown;
  staff: Staff[];
  shifts: Shift[];
  priorShifts: Shift[];
  suggestions: Suggestion[];
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>("weekly");
  const [anchor, setAnchor] = useState(initialWeekStart);
  const [from, setFrom] = useState(() => addDays(initialWeekStart, -21));
  const [to, setTo] = useState(initialWeekStart);
  const [current, setCurrent] = useState<Record<string, Shift[]> | null>(
    null,
  );
  const [prior, setPrior] = useState<Record<string, Shift[]> | null>(null);
  const [loading, startLoad] = useTransition();
  const [downloadOpen, setDownloadOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setMode("weekly");
      setAnchor(initialWeekStart);
      setFrom(addDays(initialWeekStart, -21));
      setTo(initialWeekStart);
      setCurrent(null);
      setPrior(null);
    }
  }, [open, initialWeekStart]);

  const weekStarts = useMemo(() => {
    if (mode === "weekly") return [anchor];
    if (mode === "monthly") {
      return [0, 1, 2, 3].map((i) => addDays(anchor, i * 7));
    }
    const fromMonday = from;
    const toMonday = to;
    if (!fromMonday || !toMonday) return [];
    if (fromMonday > toMonday) return [fromMonday];
    return listWeeks(fromMonday, toMonday);
  }, [mode, anchor, from, to]);

  const priorWeekStarts = useMemo(() => {
    const n = weekStarts.length;
    if (n === 0) return [];
    const earliest = weekStarts[0];
    const priorAnchor = addDays(earliest, -7 * n);
    return Array.from({ length: n }, (_, i) => addDays(priorAnchor, i * 7));
  }, [weekStarts]);

  const scopeKey = weekStarts.join(",");
  const priorKey = priorWeekStarts.join(",");

  const canUseInitial =
    mode === "weekly" &&
    weekStarts.length === 1 &&
    weekStarts[0] === initialWeekStart;

  useEffect(() => {
    if (!open) return;
    if (canUseInitial) {
      setCurrent(null);
      setPrior(null);
      return;
    }
    const scopeWeeks = scopeKey ? scopeKey.split(",") : [];
    const priorScopeWeeks = priorKey ? priorKey.split(",") : [];
    const all = Array.from(new Set([...scopeWeeks, ...priorScopeWeeks]));
    startLoad(async () => {
      const fetched = await fetchRangeShifts(all);
      const c: Record<string, Shift[]> = {};
      const p: Record<string, Shift[]> = {};
      for (const ws of scopeWeeks) c[ws] = fetched[ws] ?? [];
      for (const ws of priorScopeWeeks) p[ws] = fetched[ws] ?? [];
      setCurrent(c);
      setPrior(p);
    });
  }, [open, canUseInitial, scopeKey, priorKey]);

  const currentShiftsByWeek: Record<string, Shift[]> = useMemo(() => {
    if (canUseInitial) return { [initialWeekStart]: initialShifts };
    if (current) return current;
    return Object.fromEntries(weekStarts.map((w) => [w, []]));
  }, [canUseInitial, current, weekStarts, initialWeekStart, initialShifts]);

  const priorShiftsByWeek: Record<string, Shift[]> = useMemo(() => {
    if (canUseInitial) {
      const priorWs = addDays(initialWeekStart, -7);
      return { [priorWs]: initialPriorShifts };
    }
    if (prior) return prior;
    return Object.fromEntries(priorWeekStarts.map((w) => [w, []]));
  }, [
    canUseInitial,
    prior,
    priorWeekStarts,
    initialWeekStart,
    initialPriorShifts,
  ]);

  const suggestions: SuggestionWithWeek[] = useMemo(() => {
    if (canUseInitial) {
      return initialSuggestions.map((s) => ({
        ...s,
        weekStart: initialWeekStart,
      }));
    }
    return weekStarts
      .flatMap((ws) => {
        const weekShifts = currentShiftsByWeek[ws] ?? [];
        return computeSuggestions(weekShifts, staff).map((s) => ({
          ...s,
          weekStart: ws,
        }));
      })
      .sort((a, b) => b.savings - a.savings);
  }, [
    canUseInitial,
    initialSuggestions,
    initialWeekStart,
    weekStarts,
    currentShiftsByWeek,
    staff,
  ]);

  const todayIso = toIsoDate(new Date());

  if (!open) return null;

  const report = buildReport(currentShiftsByWeek, staff);
  const priorReport = buildReport(priorShiftsByWeek, staff);
  const priorTotalShifts = Object.values(priorShiftsByWeek).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );
  const priorHas = priorTotalShifts > 0;
  const compliance = complianceStats(currentShiftsByWeek, staff);
  const staffWithStatus = scoreStaffEfficiency(report.byStaff);

  const numWeeks = Math.max(1, report.numWeeks);
  const penaltyPct =
    report.totalCost > 0
      ? (report.penaltyPremium / report.totalCost) * 100
      : 0;
  const avgCostPerHour =
    report.totalHours > 0 ? report.totalCost / report.totalHours : 0;
  const priorAvgCostPerHour =
    priorReport.totalHours > 0
      ? priorReport.totalCost / priorReport.totalHours
      : 0;

  const costTrend = trendOf(
    report.totalCost,
    priorReport.totalCost,
    priorHas,
  );
  const hoursTrend = trendOf(
    report.totalHours,
    priorReport.totalHours,
    priorHas,
  );
  const avgCostTrend = trendOf(
    avgCostPerHour,
    priorAvgCostPerHour,
    priorHas,
    0.01,
  );
  const priorPenaltyPct =
    priorReport.totalCost > 0
      ? (priorReport.penaltyPremium / priorReport.totalCost) * 100
      : 0;
  const penaltyPctTrend = trendOf(penaltyPct, priorPenaltyPct, priorHas, 0.1);

  const topSuggestions = suggestions.slice(0, 3);
  const totalSavings = suggestions.reduce((sum, s) => sum + s.savings, 0);
  const weeklyCostAvg = report.totalCost / numWeeks;
  const weeklySavingsAvg = totalSavings / numWeeks;
  const annualCurrent = Math.round(weeklyCostAvg * 52);
  const annualOptimized = Math.round(
    Math.max(0, weeklyCostAvg - weeklySavingsAvg) * 52,
  );
  const annualDiff = annualCurrent - annualOptimized;
  const actionsExist =
    compliance.overtimeStaff.length > 0 || topSuggestions.length > 0;
  const label = rangeLabel(mode, weekStarts);
  const reportHeading =
    mode === "weekly"
      ? "Weekly report"
      : mode === "monthly"
        ? "Monthly report"
        : "Custom range report";

  const exportCtx: ReportExportContext = {
    title: reportHeading,
    subtitle: label,
    report,
    compliance,
    staffWithStatus,
    topSuggestions,
    suggestionCount: suggestions.length,
    totalSavings,
    annualCurrent,
    annualOptimized,
    annualDiff,
    weeklySavingsAvg,
    penaltyPct,
    penaltyTargetPct: PENALTY_TARGET_PCT,
    avgCostPerHour,
    numWeeks,
  };
  const baseName = `rostermate-${fileSuffix(mode, weekStarts)}`;

  function handleDownloadCsv() {
    const csv = toCsv(currentShiftsByWeek, staff);
    downloadCsv(`${baseName}.csv`, csv);
    setDownloadOpen(false);
  }
  function handleDownloadPdf() {
    exportReportToPdf(exportCtx, `${baseName}.pdf`);
    setDownloadOpen(false);
  }
  function handleDownloadWord() {
    exportReportToWord(exportCtx, `${baseName}.doc`);
    setDownloadOpen(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {reportHeading}
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">
              {label}
              {loading && (
                <span className="ml-2 text-xs font-medium text-teal-600">
                  Loading…
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 bg-slate-50/50 px-6 py-3">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold">
            {(["weekly", "monthly", "custom"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1.5 capitalize transition ${
                  mode === m
                    ? "bg-teal-500 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {mode !== "custom" && (
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <span>
                {mode === "weekly" ? "Week of" : "4 weeks starting"}
              </span>
              <input
                type="date"
                value={anchor}
                max={todayIso}
                onChange={(e) => setAnchor(snapMonday(e.target.value))}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </label>
          )}

          {mode === "custom" && (
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
              <label className="flex items-center gap-2">
                <span>From</span>
                <input
                  type="date"
                  value={from}
                  max={todayIso}
                  onChange={(e) => setFrom(snapMonday(e.target.value))}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </label>
              <label className="flex items-center gap-2">
                <span>To</span>
                <input
                  type="date"
                  value={to}
                  max={todayIso}
                  onChange={(e) => setTo(snapMonday(e.target.value))}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </label>
              {from > to && (
                <span className="text-xs font-medium text-rose-500">
                  From must be on or before To.
                </span>
              )}
            </div>
          )}

          {!canUseInitial && (
            <button
              onClick={() => {
                setMode("weekly");
                setAnchor(initialWeekStart);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Reset
            </button>
          )}
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* Executive summary */}
          <section>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Executive summary
            </h4>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryTile
                label="Total cost"
                value={formatCurrency(report.totalCost)}
                trendValue={trendText(costTrend, "$")}
                trendClass={trendClass(costTrend)}
                trendIcon={arrow(costTrend.direction)}
              />
              <SummaryTile
                label="Hours"
                value={`${report.totalHours}`}
                trendValue={trendText(hoursTrend, "h")}
                trendClass={trendClass(hoursTrend, true)}
                trendIcon={arrow(hoursTrend.direction)}
              />
              <SummaryTile
                label="Avg $/h"
                value={`$${avgCostPerHour.toFixed(2)}`}
                trendValue={trendText(avgCostTrend, "$$")}
                trendClass={trendClass(avgCostTrend)}
                trendIcon={arrow(avgCostTrend.direction)}
              />
              <SummaryTile
                label={numWeeks > 1 ? `Shifts / ${numWeeks} wks` : "Shifts"}
                value={`${report.totalShifts}`}
                trendValue={`${report.staffScheduled} staff`}
                trendClass="text-slate-500"
                trendIcon=""
              />
            </div>

            {report.totalCost > 0 && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-baseline justify-between text-xs">
                  <div className="font-medium text-slate-700">
                    Penalty loading
                  </div>
                  <div
                    className={
                      penaltyPct > PENALTY_TARGET_PCT
                        ? "font-semibold text-rose-600"
                        : "font-semibold text-emerald-600"
                    }
                  >
                    {penaltyPct.toFixed(1)}% of total
                    {penaltyPctTrend.priorHasData &&
                      penaltyPctTrend.direction !== "flat" && (
                        <span className="ml-2 font-normal text-slate-500">
                          {arrow(penaltyPctTrend.direction)}{" "}
                          {Math.abs(penaltyPctTrend.delta).toFixed(1)}pp
                        </span>
                      )}
                  </div>
                </div>
                <ProgressBar
                  current={penaltyPct}
                  target={PENALTY_TARGET_PCT}
                />
                <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                  <span>
                    {formatCurrency(report.penaltyPremium)} weekend / night /
                    casual loading
                  </span>
                  <span>Target: {PENALTY_TARGET_PCT}%</span>
                </div>
              </div>
            )}
          </section>

          {/* Action required */}
          {actionsExist && (
            <section>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Action required
              </h4>
              <ol className="mt-2 space-y-2">
                {compliance.overtimeStaff.map((o) => (
                  <li
                    key={`ot-${o.name}`}
                    className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm"
                  >
                    <span className="mt-0.5 text-rose-500" aria-hidden>
                      🚨
                    </span>
                    <span className="text-slate-800">
                      <span className="font-semibold">{o.name}</span>{" "}
                      {o.weeks.length === 1 ? (
                        <>
                          scheduled for {o.weeks[0].hours}h during the week of{" "}
                          {shortDate(o.weeks[0].weekStart)} — exceeds the 38h
                          full-time limit.
                        </>
                      ) : (
                        <>
                          exceeded 38h in {o.weeks.length} weeks (peaked at{" "}
                          {o.maxHours}h during {shortDate(o.weeks[0].weekStart)}
                          ).
                        </>
                      )}
                    </span>
                  </li>
                ))}
                {topSuggestions.map((s, idx) => (
                  <li
                    key={s.id}
                    className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm"
                  >
                    <span className="mt-0.5 font-semibold text-slate-500">
                      {compliance.overtimeStaff.length + idx + 1}.
                    </span>
                    <span className="flex-1 text-slate-800">
                      <span className="font-semibold">{s.staffName}</span>
                      {numWeeks > 1 && (
                        <span className="text-slate-500">
                          {" "}
                          (week of {shortDate(s.weekStart)})
                        </span>
                      )}
                      : {s.headline.toLowerCase()}.
                    </span>
                    <span className="font-semibold text-emerald-600">
                      Save ${Math.round(s.savings)}
                    </span>
                  </li>
                ))}
              </ol>
              {totalSavings > 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  Applying all {suggestions.length}{" "}
                  {suggestions.length === 1 ? "suggestion" : "suggestions"}{" "}
                  saves{" "}
                  <span className="font-semibold text-emerald-600">
                    ${Math.round(totalSavings).toLocaleString()}
                  </span>{" "}
                  across this period.
                </p>
              )}
            </section>
          )}

          {/* Award compliance */}
          <section>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Award compliance
            </h4>
            <ul className="mt-2 space-y-1.5 text-sm">
              <ComplianceRow
                ok
                text={`Break requirements: ${compliance.shiftsTriggeringBreak} ${compliance.shiftsTriggeringBreak === 1 ? "shift" : "shifts"} ≥5h — auto-deducted per award.`}
              />
              {compliance.overtimeStaff.length === 0 ? (
                <ComplianceRow
                  ok
                  text={`Overtime thresholds: no staff exceed 38h in any week of this period${numWeeks > 1 ? ` (${numWeeks} weeks checked)` : ""}.`}
                />
              ) : (
                <ComplianceRow
                  ok={false}
                  text={`Overtime: ${compliance.overtimeStaff.length} ${compliance.overtimeStaff.length === 1 ? "staff member" : "staff members"} over 38h in at least one week (${compliance.overtimeStaff.map((o) => o.name).join(", ")}).`}
                />
              )}
              <ComplianceRow
                ok
                text={`Weekend loading applied to ${compliance.weekendShifts} ${compliance.weekendShifts === 1 ? "shift" : "shifts"} (Sat +25%, Sun +50%).`}
              />
              <ComplianceRow
                ok
                text={`Night loading applied to ${compliance.nightShifts} ${compliance.nightShifts === 1 ? "shift" : "shifts"} with hours in the 7pm–7am window (+15%).`}
              />
              <ComplianceRow
                ok
                text={`Casual loading (+25%) applied to ${compliance.casualShifts} ${compliance.casualShifts === 1 ? "shift" : "shifts"} across ${compliance.casualStaffCount} casual ${compliance.casualStaffCount === 1 ? "employee" : "employees"}.`}
              />
            </ul>
            <p className="mt-2 text-[10px] text-slate-400">
              Checks cover the rules RosterMate models: break deduction, 38h
              full-time cap, weekend, night, and casual loading. Public
              holidays and award-specific classifications are not modelled.
            </p>
          </section>

          {/* By staff */}
          <section>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              By staff
              {numWeeks > 1 && (
                <span className="ml-2 text-[10px] font-normal normal-case text-slate-400">
                  totals across {numWeeks} weeks
                </span>
              )}
            </h4>
            <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Staff</th>
                    <th className="px-3 py-2 font-semibold">Shifts</th>
                    <th className="px-3 py-2 font-semibold">Hours</th>
                    <th className="px-3 py-2 font-semibold">Cost</th>
                    <th className="px-3 py-2 font-semibold">$/h</th>
                  </tr>
                </thead>
                <tbody>
                  {staffWithStatus.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-4 text-center text-slate-500"
                      >
                        No shifts scheduled in this period.
                      </td>
                    </tr>
                  )}
                  {staffWithStatus.map((line) => {
                    const style = levelStyles[line.level];
                    return (
                      <tr
                        key={line.staffId}
                        className="border-t border-slate-100 text-slate-700"
                      >
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${style.dot}`}
                              title={style.label}
                              aria-label={style.label}
                            />
                            <div>
                              <div className="font-semibold text-slate-900">
                                {line.name}
                              </div>
                              <div className="text-xs text-slate-500">
                                {line.role}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2">{line.shifts}</td>
                        <td className="px-3 py-2">{line.hours}</td>
                        <td className="px-3 py-2 font-semibold text-slate-900">
                          {formatCurrency(line.cost)}
                        </td>
                        <td className="px-3 py-2">${line.avgPerHour}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] font-medium text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                Efficient $/h
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
                Acceptable
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden />
                Review scheduling
              </span>
            </div>
          </section>

          {/* By day */}
          <section>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              By day
              {numWeeks > 1 && (
                <span className="ml-2 text-[10px] font-normal normal-case text-slate-400">
                  summed across all {numWeeks} weeks
                </span>
              )}
            </h4>
            <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Day</th>
                    <th className="px-3 py-2 font-semibold">Shifts</th>
                    <th className="px-3 py-2 font-semibold">Hours</th>
                    <th className="px-3 py-2 font-semibold">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byDay.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-4 text-center text-slate-500"
                      >
                        —
                      </td>
                    </tr>
                  )}
                  {report.byDay.map((line) => (
                    <tr
                      key={line.day}
                      className="border-t border-slate-100 text-slate-700"
                    >
                      <td className="px-3 py-2">
                        <div className="font-semibold text-slate-900">
                          {line.dayName}
                        </div>
                        {line.dateLabel && (
                          <div className="text-xs text-slate-500">
                            {line.dateLabel}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">{line.shifts}</td>
                      <td className="px-3 py-2">{line.hours}</td>
                      <td className="px-3 py-2 font-semibold text-slate-900">
                        {formatCurrency(line.cost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Annualized impact */}
          {report.totalCost > 0 && (
            <section className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Annualized impact
              </h4>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    Current trajectory
                  </div>
                  <div className="mt-1 text-xl font-bold text-slate-900">
                    ${annualCurrent.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    weekly avg × 52
                  </div>
                </div>
                <div className="rounded-lg bg-emerald-50 px-3 py-2 ring-1 ring-emerald-200">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-emerald-700">
                    After optimization
                  </div>
                  <div className="mt-1 text-xl font-bold text-emerald-700">
                    ${annualOptimized.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-emerald-700/80">
                    if all suggestions applied
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    Annual savings
                  </div>
                  <div className="mt-1 text-xl font-bold text-slate-900">
                    ${annualDiff.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {weeklySavingsAvg > 0
                      ? `$${Math.round(weeklySavingsAvg)}/week × 52`
                      : "no opportunities in range"}
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Close
          </button>
          <div className="relative">
            <button
              onClick={() => setDownloadOpen((o) => !o)}
              disabled={report.totalShifts === 0}
              className="flex items-center gap-1.5 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <span>Download</span>
              <span aria-hidden className="text-xs">
                ▾
              </span>
            </button>
            {downloadOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setDownloadOpen(false)}
                  aria-hidden
                />
                <div className="absolute bottom-full right-0 z-20 mb-1 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                  <DownloadMenuItem
                    label="CSV"
                    hint="For Excel / MYOB / Xero"
                    onClick={handleDownloadCsv}
                  />
                  <DownloadMenuItem
                    label="PDF"
                    hint="Formatted, printable"
                    onClick={handleDownloadPdf}
                  />
                  <DownloadMenuItem
                    label="Word"
                    hint="Editable .doc file"
                    onClick={handleDownloadWord}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  trendValue,
  trendIcon,
  trendClass,
}: {
  label: string;
  value: string;
  trendValue: string;
  trendIcon: string;
  trendClass: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-bold text-slate-900">{value}</div>
      <div className={`mt-1 text-[10px] font-medium ${trendClass}`}>
        {trendIcon ? `${trendIcon} ` : ""}
        {trendValue}
      </div>
    </div>
  );
}

function ProgressBar({
  current,
  target,
}: {
  current: number;
  target: number;
}) {
  const clamped = Math.min(100, Math.max(0, current));
  const over = current > target;
  const fillColor = over ? "bg-rose-500" : "bg-emerald-500";
  const targetPct = Math.min(100, Math.max(0, target));
  return (
    <div className="relative mt-1 h-2 w-full rounded-full bg-slate-200">
      <div
        className={`h-2 rounded-full ${fillColor}`}
        style={{ width: `${clamped}%` }}
      />
      <div
        className="absolute top-0 h-2 w-0.5 bg-slate-700"
        style={{ left: `${targetPct}%` }}
        aria-label={`Target ${target}%`}
      />
    </div>
  );
}

function ComplianceRow({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className="flex items-start gap-2">
      <span
        className={`mt-0.5 text-sm ${ok ? "text-emerald-600" : "text-amber-600"}`}
        aria-hidden
      >
        {ok ? "✅" : "⚠️"}
      </span>
      <span className="text-slate-700">{text}</span>
    </li>
  );
}

function DownloadMenuItem({
  label,
  hint,
  onClick,
}: {
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm transition last:border-b-0 hover:bg-slate-50"
    >
      <div className="font-semibold text-slate-900">{label}</div>
      <div className="text-[11px] text-slate-500">{hint}</div>
    </button>
  );
}
