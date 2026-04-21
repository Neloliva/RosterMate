"use client";

export function SavingsBanner({
  totalSavings,
  opportunities,
  onView,
}: {
  totalSavings: number;
  opportunities: number;
  onView: () => void;
}) {
  const hasSavings = opportunities > 0 && totalSavings > 0;
  const weekly = Math.round(totalSavings);
  const annual = Math.round(totalSavings * 52);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 p-4 text-white shadow-sm">
      <div>
        <div className="flex flex-wrap items-center gap-2 text-base font-semibold">
          <span aria-hidden>🎯</span>
          <span>
            {hasSavings
              ? `Save $${weekly.toLocaleString()} This Week!`
              : "Roster already optimized"}
          </span>
          {hasSavings && (
            <span className="text-sm font-medium text-emerald-50/90">
              (${annual.toLocaleString()} annually)
            </span>
          )}
        </div>
        <div className="mt-1 text-sm text-emerald-50/90">
          {hasSavings
            ? `${opportunities} optimization ${opportunities === 1 ? "opportunity" : "opportunities"} found — review to reduce penalty rates`
            : "No shifts flagged for weekend or night-loading savings."}
        </div>
      </div>
      <button
        onClick={onView}
        disabled={!hasSavings}
        className="rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur-sm transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60"
      >
        View Suggestions
      </button>
    </div>
  );
}
