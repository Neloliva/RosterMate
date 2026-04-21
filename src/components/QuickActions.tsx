"use client";

import { useState, useTransition } from "react";

type RunningAction = "copy" | "undo" | null;

export function QuickActions({
  onAddShift,
  onAddStaff,
  onCopyLastWeek,
  onGenerateReport,
  onPreviewOptimize,
  canUndoOptimize,
  onUndoLastOptimize,
}: {
  onAddShift: () => void;
  onAddStaff: () => void;
  onCopyLastWeek: () => Promise<{ copied: number; available: number }>;
  onGenerateReport: () => void;
  onPreviewOptimize: () => void;
  canUndoOptimize: boolean;
  onUndoLastOptimize: () => Promise<number>;
}) {
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState<RunningAction>(null);
  const [message, setMessage] = useState<string | null>(null);

  function handleCopy() {
    setMessage(null);
    setRunning("copy");
    startTransition(async () => {
      try {
        const { copied, available } = await onCopyLastWeek();
        if (available === 0) {
          setMessage("Last week has no shifts to copy.");
        } else if (copied === 0) {
          setMessage("This week already has shifts in every matching cell.");
        } else {
          setMessage(
            `Copied ${copied} shift${copied === 1 ? "" : "s"} from last week.`,
          );
        }
      } catch (e) {
        setMessage(
          e instanceof Error ? e.message : "Couldn't copy last week.",
        );
      } finally {
        setRunning(null);
      }
    });
  }

  function handleUndo() {
    setMessage(null);
    setRunning("undo");
    startTransition(async () => {
      try {
        const reverted = await onUndoLastOptimize();
        setMessage(
          reverted > 0
            ? `Reverted ${reverted} shift${reverted === 1 ? "" : "s"} to the pre-optimize schedule.`
            : "Nothing to undo.",
        );
      } catch (e) {
        setMessage(
          e instanceof Error ? e.message : "Couldn't undo optimization.",
        );
      } finally {
        setRunning(null);
      }
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <h3 className="text-base font-semibold text-slate-900">Quick Actions</h3>
      <div className="mt-4 space-y-2">
        <button
          onClick={onAddShift}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-400 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-500"
        >
          <span aria-hidden>+</span>
          <span>Add New Shift</span>
        </button>
        <button
          onClick={onAddStaff}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-teal-300 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-700 transition hover:bg-teal-100"
        >
          <span aria-hidden>👤</span>
          <span>Add New Staff</span>
        </button>
        <button
          onClick={handleCopy}
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span aria-hidden>📋</span>
          <span>{running === "copy" ? "Copying…" : "Copy Last Week"}</span>
        </button>
        <button
          onClick={onGenerateReport}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <span aria-hidden>📊</span>
          <span>Generate Report</span>
        </button>
        <button
          onClick={onPreviewOptimize}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <span aria-hidden>✨</span>
          <span>Optimize All Shifts</span>
        </button>
      </div>

      {canUndoOptimize && (
        <button
          onClick={handleUndo}
          disabled={pending}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span aria-hidden>↶</span>
          <span>
            {running === "undo"
              ? "Restoring…"
              : "Undo last optimization"}
          </span>
        </button>
      )}

      {message && (
        <p className="mt-3 text-xs font-medium text-slate-600">{message}</p>
      )}
    </div>
  );
}
