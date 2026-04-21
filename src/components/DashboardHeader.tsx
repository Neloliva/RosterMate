"use client";

import { InfoTooltip } from "./InfoTooltip";

export function DashboardHeader({
  weekLabel,
  view,
  onChangeView,
  onPrev,
  onNext,
  onToday,
}: {
  weekLabel: string;
  view: "week" | "month";
  onChangeView: (view: "week" | "month") => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500 text-lg font-bold text-white shadow-sm">
            R
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            RosterMate
          </h1>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          <span aria-hidden>✅</span>
          <span>Fair Work Compliant</span>
          <span className="text-emerald-500">|</span>
          <span className="text-emerald-700/90">
            All 122 Australian Awards Supported
          </span>
          <InfoTooltip label="Why RosterMate?" align="left">
            <p className="leading-snug">
              RosterMate automatically calculates penalty rates, casual
              loading, and break requirements for all 122 Australian Modern
              Awards. No more Fair Work violations or underpayment penalties.
            </p>
          </InfoTooltip>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
          <button
            onClick={() => onChangeView("week")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              view === "week"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Week
          </button>
          <button
            onClick={() => onChangeView("month")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              view === "month"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Month
          </button>
        </div>
        <button
          onClick={onPrev}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          ← Previous
        </button>
        <div className="px-3 text-sm font-semibold text-slate-800">
          {weekLabel}
        </div>
        <button
          onClick={onNext}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Next →
        </button>
        <button
          onClick={onToday}
          className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-600"
        >
          Today
        </button>
      </div>
    </div>
  );
}
