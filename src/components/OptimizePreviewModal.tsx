"use client";

import { useMemo, useState, useTransition } from "react";
import { itemizeShiftCost, type PenaltyLevel } from "@/lib/award";
import type { DayCell } from "@/lib/date";
import type { Suggestion } from "@/lib/optimize";
import { formatRange } from "@/lib/time";
import type { Shift, Staff } from "@/lib/types";

const levelStyles: Record<
  PenaltyLevel,
  { bg: string; dot: string }
> = {
  standard: { bg: "bg-teal-400/90", dot: "bg-emerald-200" },
  elevated: { bg: "bg-amber-400", dot: "bg-amber-200" },
  high: { bg: "bg-rose-500", dot: "bg-rose-200" },
};

type PreviewShift = Shift & { changed: boolean };

function buildPreview(
  shifts: Shift[],
  suggestions: Suggestion[],
): PreviewShift[] {
  const byShift = new Map(suggestions.map((s) => [s.shiftId, s]));
  return shifts.map((shift) => {
    const sugg = byShift.get(shift.id);
    if (!sugg) return { ...shift, changed: false };
    return {
      ...shift,
      day: sugg.proposed.day,
      startHour: sugg.proposed.startHour,
      endHour: sugg.proposed.endHour,
      cost: sugg.proposed.cost,
      changed: true,
    };
  });
}

export function OptimizePreviewModal({
  open,
  shifts,
  staff,
  days,
  suggestions,
  currentWeeklyCost,
  onApplyAll,
  onClose,
}: {
  open: boolean;
  shifts: Shift[];
  staff: Staff[];
  days: DayCell[];
  suggestions: Suggestion[];
  currentWeeklyCost: number;
  onApplyAll: () => Promise<{
    applied: number;
    skipped: number;
    totalSavings: number;
  }>;
  onClose: () => void;
}) {
  const [applying, startApply] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const preview = useMemo(
    () => buildPreview(shifts, suggestions),
    [shifts, suggestions],
  );
  const staffById = useMemo(
    () => new Map(staff.map((s) => [s.id, s])),
    [staff],
  );
  const previewIndex = useMemo(() => {
    const map = new Map<string, PreviewShift>();
    for (const s of preview) map.set(`${s.staffId}:${s.day}`, s);
    return map;
  }, [preview]);
  const levelByShiftId = useMemo(() => {
    const out = new Map<string, PenaltyLevel>();
    for (const s of preview) {
      const person = staffById.get(s.staffId);
      if (!person) continue;
      out.set(s.id, itemizeShiftCost(s, person).level);
    }
    return out;
  }, [preview, staffById]);

  if (!open) return null;

  const totalSavings = suggestions.reduce((sum, s) => sum + s.savings, 0);
  const optimizedCost = Math.max(0, currentWeeklyCost - totalSavings);
  const annualSavings = Math.round(totalSavings * 52);

  function handleApplyAll() {
    setMessage(null);
    startApply(async () => {
      try {
        const { applied, skipped } = await onApplyAll();
        if (applied > 0) {
          onClose();
        } else {
          setMessage(
            skipped > 0
              ? `Skipped ${skipped} — target cells are all occupied.`
              : "Nothing to apply.",
          );
        }
      } catch (e) {
        setMessage(
          e instanceof Error ? e.message : "Couldn't apply suggestions.",
        );
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Optimize all shifts — preview
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">
              {suggestions.length === 0
                ? "No opportunities found for this week."
                : `${suggestions.length} change${suggestions.length === 1 ? "" : "s"} proposed — roster below shows the result.`}
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

        <div className="flex-1 overflow-y-auto p-6">
          {suggestions.length > 0 && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                Impact if you apply every change
              </div>
              <div className="mt-2 grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    Current
                  </div>
                  <div className="mt-1 text-lg font-bold text-slate-900">
                    ${Math.round(currentWeeklyCost).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-500">this week</div>
                </div>
                <div className="rounded-lg bg-white px-2 py-1 ring-1 ring-emerald-200">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-emerald-700">
                    Optimized
                  </div>
                  <div className="mt-1 text-lg font-bold text-emerald-700">
                    ${Math.round(optimizedCost).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-emerald-700/80">
                    this week
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    Annualized
                  </div>
                  <div className="mt-1 text-lg font-bold text-slate-900">
                    ${annualSavings.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-500">saved/yr</div>
                </div>
              </div>
            </div>
          )}

          <div className="mb-3 flex items-center justify-end gap-3 text-[11px] font-medium text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-teal-400" aria-hidden />
              Standard rate
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
              Penalty rate
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden />
              High penalty
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full border-2 border-slate-900 bg-white" aria-hidden />
              Changed
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="w-44 rounded-tl-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Staff
                  </th>
                  {days.map((d, idx) => (
                    <th
                      key={d.name}
                      className={`border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-slate-700 ${
                        idx === days.length - 1 ? "rounded-tr-lg" : ""
                      }`}
                    >
                      <div>{d.name}</div>
                      <div className="mt-0.5 text-[11px] font-normal text-slate-500">
                        {d.date}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map((person) => (
                  <tr key={person.id}>
                    <td className="border border-slate-200 bg-white px-4 py-3 align-middle">
                      <div className="font-semibold text-slate-900">
                        {person.name}
                      </div>
                      <div className="text-xs text-slate-500">{person.role}</div>
                    </td>
                    {days.map((_, dayIdx) => {
                      const key = `${person.id}:${dayIdx}`;
                      const shift = previewIndex.get(key);
                      const level = shift
                        ? (levelByShiftId.get(shift.id) ?? "standard")
                        : "standard";
                      const style = shift ? levelStyles[level] : null;
                      return (
                        <td
                          key={dayIdx}
                          className="border border-slate-200 p-1.5 align-middle"
                        >
                          {shift && style ? (
                            <div
                              className={`relative flex min-h-[56px] flex-col items-center justify-center rounded-md px-2 py-1.5 text-center text-[11px] font-semibold text-white shadow-sm ${style.bg} ${shift.changed ? "ring-2 ring-slate-900 ring-offset-1 ring-offset-white" : ""}`}
                            >
                              <span
                                className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ${style.dot}`}
                                aria-hidden
                              />
                              <div className="leading-tight">
                                {formatRange(shift.startHour, shift.endHour)}
                              </div>
                              <div className="text-[10px] font-medium text-white/90">
                                ${shift.cost}
                              </div>
                            </div>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 p-4">
          <div className="text-xs text-slate-500">
            {message ??
              (suggestions.length > 0
                ? "Review the preview above, then apply when you're happy."
                : "Nothing to apply.")}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={applying}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyAll}
              disabled={applying || suggestions.length === 0}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {applying
                ? "Applying…"
                : `Apply all${suggestions.length > 0 ? ` (${suggestions.length})` : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
