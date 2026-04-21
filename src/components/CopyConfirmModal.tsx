"use client";

import { useEffect, useState } from "react";

export type CopySource = "week" | "month";

const descriptions: Record<CopySource, string> = {
  week:
    "Copies last week's shifts into the current week. Cells that already have a shift are skipped.",
  month:
    "Copies the last 4 weeks' shifts onto the current week and the next 3 weeks. Cells that already have a shift are skipped.",
};

export function CopyConfirmModal({
  open,
  pending,
  onConfirm,
  onClose,
}: {
  open: boolean;
  pending: boolean;
  onConfirm: (source: CopySource) => void;
  onClose: () => void;
}) {
  const [source, setSource] = useState<CopySource>("week");

  useEffect(() => {
    if (open) setSource("week");
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Copy previous schedule?
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">
              Pick what to pull into the current schedule.
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

        <div className="mt-5 space-y-2">
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
              source === "week"
                ? "border-teal-400 bg-teal-50/70 ring-2 ring-teal-100"
                : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <input
              type="radio"
              name="copy-source"
              value="week"
              checked={source === "week"}
              onChange={() => setSource("week")}
              className="mt-0.5 h-4 w-4 accent-teal-500"
            />
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-900">
                Last week
              </div>
              <div className="mt-0.5 text-xs text-slate-600">
                Apply the week directly before this one.
              </div>
            </div>
          </label>

          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
              source === "month"
                ? "border-teal-400 bg-teal-50/70 ring-2 ring-teal-100"
                : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <input
              type="radio"
              name="copy-source"
              value="month"
              checked={source === "month"}
              onChange={() => setSource("month")}
              className="mt-0.5 h-4 w-4 accent-teal-500"
            />
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-900">
                Last 4 weeks (previous month)
              </div>
              <div className="mt-0.5 text-xs text-slate-600">
                Fills the current week plus the next three from the matching
                prior weeks.
              </div>
            </div>
          </label>
        </div>

        <p className="mt-4 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
          {descriptions[source]}
        </p>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={pending}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(source)}
            disabled={pending}
            className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {pending ? "Copying…" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
