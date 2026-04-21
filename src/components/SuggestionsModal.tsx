"use client";

import { formatRange } from "@/lib/time";
import type { Suggestion } from "@/lib/optimize";

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function SuggestionsModal({
  open,
  suggestions,
  currentWeeklyCost,
  onAccept,
  onDismiss,
  onClose,
}: {
  open: boolean;
  suggestions: Suggestion[];
  currentWeeklyCost: number;
  onAccept: (s: Suggestion) => void;
  onDismiss: (id: string) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  const totalSavings = suggestions.reduce((sum, s) => sum + s.savings, 0);
  const optimizedCost = Math.max(0, currentWeeklyCost - totalSavings);
  const annualSavings = Math.round(totalSavings * 52);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 p-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Optimization suggestions
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">
              {suggestions.length === 0
                ? "No opportunities found for this week."
                : `${suggestions.length} opportunities — up to $${Math.round(totalSavings)} in potential savings`}
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

        <div className="max-h-[60vh] space-y-3 overflow-y-auto p-6">
          {suggestions.length > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                Impact if you accept every suggestion
              </div>
              <div className="mt-2 grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    Current
                  </div>
                  <div className="mt-1 text-lg font-bold text-slate-900">
                    ${Math.round(currentWeeklyCost).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    this week
                  </div>
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
                  <div className="text-[10px] text-slate-500">
                    saved/yr
                  </div>
                </div>
              </div>
            </div>
          )}
          {suggestions.length === 0 && (
            <p className="text-sm text-slate-500">
              Your roster is already optimized — no high-penalty shifts to
              trim or move.
            </p>
          )}
          {suggestions.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {s.staffName}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-600">
                    {s.headline}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium uppercase tracking-wide text-emerald-600">
                    Save
                  </div>
                  <div className="text-xl font-bold text-emerald-600">
                    ${Math.round(s.savings)}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    Current
                  </div>
                  <div className="mt-0.5 font-semibold text-slate-800">
                    {DAY_SHORT[s.current.day]}{" "}
                    {formatRange(s.current.startHour, s.current.endHour)}
                  </div>
                  <div className="text-slate-500">${s.current.cost}</div>
                </div>
                <div className="rounded-lg bg-teal-50 p-2 ring-1 ring-teal-200">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-teal-600">
                    Proposed
                  </div>
                  <div className="mt-0.5 font-semibold text-slate-800">
                    {DAY_SHORT[s.proposed.day]}{" "}
                    {formatRange(s.proposed.startHour, s.proposed.endHour)}
                  </div>
                  <div className="text-slate-500">${s.proposed.cost}</div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  onClick={() => onDismiss(s.id)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => onAccept(s)}
                  className="rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-600"
                >
                  Accept
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
