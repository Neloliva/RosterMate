"use client";

import { InfoTooltip } from "./InfoTooltip";

export function DashboardHeader({
  weekLabel,
  view,
  onChangeView,
  onPrev,
  onNext,
  onToday,
  onOpenSettings,
}: {
  weekLabel: string;
  view: "week" | "month";
  onChangeView: (view: "week" | "month") => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onOpenSettings: () => void;
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
          <span>Built for Australian award compliance</span>
          <InfoTooltip label="Why RosterMate?" align="left">
            <p className="leading-snug">
              RosterMate models a generic Australian award ruleset: weekend and
              Sunday penalty rates, night loading (7pm–7am), casual loading, and
              automatic break deduction at 5h and 9h. Full Fair Work award-rate
              coverage requires a licensed data feed — see DEFERRED.md.
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
        <button
          onClick={onOpenSettings}
          aria-label="Business settings"
          title="Business settings"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
