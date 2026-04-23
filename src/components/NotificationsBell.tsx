"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  approveStaffRequest,
  declineStaffRequest,
} from "@/app/actions";
import type {
  StaffRequest,
  StaffRequestCoverageDelta,
  StaffRequestImpact,
  StaffRequestImpactPerson,
} from "@/lib/types";
import { ConfirmDialog } from "./ConfirmDialog";

const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function formatAge(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

function formatHourShort(hour: number): string {
  const h24 = ((hour % 24) + 24) % 24;
  const h = Math.floor(h24);
  const m = Math.round((h24 - h) * 60);
  const period = h >= 12 ? "pm" : "am";
  const display = ((h + 11) % 12) + 1;
  return m === 0 ? `${display}${period}` : `${display}:${m.toString().padStart(2, "0")}${period}`;
}

export function NotificationsBell({
  requests,
}: {
  requests: StaffRequest[];
}) {
  const [open, setOpen] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState<StaffRequest | null>(
    null,
  );
  const [declineFor, setDeclineFor] = useState<StaffRequest | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close the popover on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const count = requests.length;

  function runApprove(req: StaffRequest) {
    setBusyId(req.id);
    startTransition(async () => {
      try {
        await approveStaffRequest(req.id);
      } finally {
        setBusyId(null);
        setConfirmApprove(null);
      }
    });
  }

  function runDecline(req: StaffRequest, reason: string) {
    setBusyId(req.id);
    startTransition(async () => {
      try {
        await declineStaffRequest(req.id, reason);
      } finally {
        setBusyId(null);
        setDeclineFor(null);
        setDeclineReason("");
      }
    });
  }

  function onApproveClick(req: StaffRequest) {
    // Unavailable approvals delete a shift — require confirmation.
    if (req.type === "unavailable" && req.impact?.shiftLabel) {
      setConfirmApprove(req);
      return;
    }
    runApprove(req);
  }

  function onDeclineClick(req: StaffRequest) {
    setDeclineReason("");
    setDeclineFor(req);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Staff requests"
        aria-expanded={open}
        title={`${count} pending request${count === 1 ? "" : "s"}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
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
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-40 w-[min(90vw,420px)] rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-baseline justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Staff requests
            </h3>
            <span className="text-xs font-medium text-slate-500">
              {count} pending
            </span>
          </div>
          <div className="max-h-[min(70vh,600px)] overflow-y-auto">
            {count === 0 ? (
              <p className="p-6 text-center text-xs text-slate-500">
                No pending swap or time-off requests.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {requests.map((req) => (
                  <RequestItem
                    key={req.id}
                    req={req}
                    busy={busyId === req.id}
                    onApprove={() => onApproveClick(req)}
                    onDecline={() => onDeclineClick(req)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmApprove}
        title="Approve and remove shift?"
        message={
          confirmApprove && (
            <div className="space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-semibold">{confirmApprove.staffName}</span>{" "}
                won&apos;t work{" "}
                <span className="font-semibold">
                  {WEEKDAY_NAMES[confirmApprove.day ?? -1] ?? "that day"}
                </span>
                {confirmApprove.impact?.shiftLabel && (
                  <>
                    . Their{" "}
                    <span className="font-semibold">
                      {confirmApprove.impact.shiftLabel}
                    </span>{" "}
                    shift will be removed from the roster
                  </>
                )}
                .
              </p>
              <p className="text-xs text-slate-500">
                You&apos;ll still need to reassign coverage manually.
              </p>
            </div>
          )
        }
        confirmLabel="Approve & remove shift"
        destructive
        pending={busyId === confirmApprove?.id}
        onConfirm={() => confirmApprove && runApprove(confirmApprove)}
        onCancel={() => setConfirmApprove(null)}
      />

      <ConfirmDialog
        open={!!declineFor}
        title="Decline this request?"
        message={
          declineFor && (
            <div className="space-y-3 text-sm text-slate-700">
              <p>
                <span className="font-semibold">{declineFor.staffName}</span>
                {"'s "}
                {declineFor.type === "swap"
                  ? "swap request"
                  : "time-off request"}{" "}
                will be declined. They&apos;ll see a note on their schedule.
              </p>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-700">
                  Reason (optional)
                </span>
                <textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="e.g. already short on Wed — can you try Thu instead?"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
                <span className="mt-1 block text-[11px] text-slate-400">
                  {declineReason.length} / 500
                </span>
              </label>
            </div>
          )
        }
        confirmLabel="Decline"
        pending={busyId === declineFor?.id}
        onConfirm={() => declineFor && runDecline(declineFor, declineReason)}
        onCancel={() => {
          setDeclineFor(null);
          setDeclineReason("");
        }}
      />
    </div>
  );
}

function RequestItem({
  req,
  busy,
  onApprove,
  onDecline,
}: {
  req: StaffRequest;
  busy: boolean;
  onApprove: () => void;
  onDecline: () => void;
}) {
  const dayLabel =
    typeof req.day === "number"
      ? WEEKDAY_NAMES[req.day] ?? `Day ${req.day + 1}`
      : "";
  const header =
    req.type === "swap"
      ? `Swap — ${req.shiftLabel ?? "shift"}${dayLabel ? ` (${dayLabel})` : ""}`
      : `Time off — ${dayLabel}${req.weekStart ? ` · week of ${req.weekStart}` : ""}`;

  return (
    <li className="p-4 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">
            {req.staffName}
          </div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-600">
            {header}
          </div>
        </div>
        <div className="text-[10px] text-slate-400">
          {formatAge(req.createdAt)}
        </div>
      </div>

      {req.note && (
        <div className="mt-2 rounded bg-slate-50 px-2 py-1 text-[11px] italic text-slate-700">
          “{req.note}”
        </div>
      )}

      {req.impact && <ImpactPanel impact={req.impact} />}

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onDecline}
          disabled={busy}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={onApprove}
          disabled={busy}
          className="rounded-md bg-teal-500 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy ? "Working…" : "Approve"}
        </button>
      </div>
    </li>
  );
}

function ImpactPanel({ impact }: { impact: StaffRequestImpact }) {
  const { othersWorking, couldCover, requesterRole, coverageIfApproved } =
    impact;
  const sameRoleCovers = couldCover.filter((p) => p.sameRole);

  return (
    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50/60 p-2 text-[11px] text-slate-700">
      <div>
        <span className="font-semibold">Others working: </span>
        {othersWorking.length === 0 ? (
          <span className="text-slate-500">nobody else scheduled</span>
        ) : (
          othersWorking
            .map(
              (o) =>
                `${o.firstName} ${formatHourShort(o.startHour)}–${formatHourShort(o.endHour)}`,
            )
            .join(", ")
        )}
      </div>
      {coverageIfApproved && <CoverageDeltaLine delta={coverageIfApproved} />}
      <div className="mt-1">
        <span className="font-semibold">Could cover: </span>
        {couldCover.length === 0 ? (
          <span className="text-rose-600">no staff free that day</span>
        ) : (
          <span>
            {couldCover.length} free
            {requesterRole && (
              <>
                {" · "}
                <span
                  className={
                    sameRoleCovers.length === 0
                      ? "text-amber-700"
                      : "text-slate-700"
                  }
                >
                  {sameRoleCovers.length} match role ({requesterRole})
                </span>
              </>
            )}
          </span>
        )}
      </div>
      {couldCover.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {couldCover.slice(0, 5).map((p) => (
            <CoverLine key={p.staffId} person={p} />
          ))}
          {couldCover.length > 5 && (
            <li className="text-[10px] text-slate-500">
              …and {couldCover.length - 5} more
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function CoverLine({ person }: { person: StaffRequestImpactPerson }) {
  const flags: string[] = [];
  if (person.prefersDayOff) flags.push("prefers day off");
  if (person.hoursThisWeek >= 38) flags.push(`${person.hoursThisWeek}h/wk`);
  return (
    <li className="flex items-center gap-1">
      <span className="text-slate-800">•</span>
      <span className="font-medium text-slate-800">{person.firstName}</span>
      <span className="text-slate-500">({person.role})</span>
      {person.sameRole && (
        <span className="rounded bg-emerald-50 px-1 text-[9px] font-semibold uppercase text-emerald-700">
          same role
        </span>
      )}
      {flags.length > 0 && (
        <span className="text-amber-700">⚠ {flags.join(", ")}</span>
      )}
    </li>
  );
}

function CoverageDeltaLine({ delta }: { delta: StaffRequestCoverageDelta }) {
  const parts: { text: string; breaches: boolean }[] = [];
  if (delta.required !== null) {
    const breaches = delta.afterStaff < delta.required;
    parts.push({
      text: `staff ${delta.currentStaff} → ${delta.afterStaff} (min ${delta.required})`,
      breaches,
    });
  }
  if (delta.roleRequired !== null && delta.roleName) {
    const breaches = delta.roleAfter < delta.roleRequired;
    parts.push({
      text: `${delta.roleName} ${delta.roleCurrent} → ${delta.roleAfter} (min ${delta.roleRequired})`,
      breaches,
    });
  }
  if (parts.length === 0) return null;

  const anyBreach = parts.some((p) => p.breaches);
  const wrapperClass = anyBreach
    ? "bg-rose-50 text-rose-800"
    : "bg-emerald-50 text-emerald-800";

  return (
    <div
      className={`mt-1 rounded px-2 py-1 text-[11px] ${wrapperClass}`}
    >
      <span className="font-semibold">
        {anyBreach ? "⚠ If approved: " : "✓ If approved: "}
      </span>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && " · "}
          <span className={p.breaches ? "font-semibold" : ""}>{p.text}</span>
          {p.breaches && <span className="ml-1">✗</span>}
        </span>
      ))}
    </div>
  );
}
