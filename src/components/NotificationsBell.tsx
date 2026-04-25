"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, Check, Download, Paperclip, X } from "lucide-react";
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

function shiftDuration(startHour: number, endHour: number): number {
  // endHour may be > 24 for overnight shifts; cap display at the actual diff.
  const h = endHour - startHour;
  return h > 0 ? h : h + 24;
}

function formatHours(h: number): string {
  if (Math.abs(h - Math.round(h)) < 0.01) return `${Math.round(h)}h`;
  return `${h.toFixed(1)}h`;
}

function formatHoursDiff(diff: number): string {
  const sign = diff >= 0 ? "+" : "−";
  const abs = Math.abs(diff);
  return `${sign}${formatHours(abs)}`;
}

function formatDollarsDiff(diff: number): string {
  const sign = diff >= 0 ? "+" : "−";
  const abs = Math.abs(diff);
  return `${sign}$${Math.round(abs).toLocaleString()}`;
}

function formatShiftDayLabel(
  weekStart: string | null | undefined,
  day: number | null | undefined,
): string {
  if (!weekStart || typeof day !== "number") return "";
  const parts = weekStart.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return "";
  const [y, m, d] = parts;
  // Day 0 = Monday (per the app's convention).
  const base = new Date(y, m - 1, d + day);
  return base.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
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

  function runApprove(
    req: StaffRequest,
    options?: { moveToStaffId?: string },
  ) {
    setBusyId(req.id);
    startTransition(async () => {
      try {
        await approveStaffRequest(req.id, options);
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
    // Approvals that actually change the roster need a confirm — unavailable
    // deletes the shift, time_change edits its hours, swap-with-agreed-and-
    // free partner reassigns the shift. Plain swap approvals stay single-
    // click because they're informational (manager reassigns manually).
    if (req.type === "unavailable" && req.impact?.shiftLabel) {
      setConfirmApprove(req);
      return;
    }
    if (
      req.type === "time_change" &&
      typeof req.proposedStartHour === "number" &&
      typeof req.proposedEndHour === "number"
    ) {
      setConfirmApprove(req);
      return;
    }
    if (
      req.type === "swap" &&
      req.partnerConfirmationStatus === "agreed" &&
      req.proposedSwapWithIsFreeThatDay
    ) {
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
        title={
          confirmApprove?.type === "time_change"
            ? "Approve and update shift?"
            : confirmApprove?.type === "swap"
              ? `Approve and move shift to ${confirmApprove.proposedSwapWithName ?? "partner"}?`
              : "Approve and remove shift?"
        }
        message={
          confirmApprove && (
            confirmApprove.type === "time_change" ? (
              <div className="space-y-2 text-sm text-slate-700">
                <p>
                  <span className="font-semibold">
                    {confirmApprove.staffName}
                  </span>
                  &apos;s shift on{" "}
                  <span className="font-semibold">
                    {WEEKDAY_NAMES[confirmApprove.day ?? -1] ?? "that day"}
                  </span>{" "}
                  will be updated from{" "}
                  <span className="font-semibold">
                    {confirmApprove.shiftLabel ?? "the current hours"}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold">
                    {formatHourShort(confirmApprove.proposedStartHour!)}–
                    {formatHourShort(confirmApprove.proposedEndHour!)}
                  </span>
                  .
                </p>
                <p className="text-xs text-slate-500">
                  Cost will be recalculated against the new hours. The staff
                  stays on the shift.
                </p>
              </div>
            ) : confirmApprove.type === "swap" ? (
              <div className="space-y-2 text-sm text-slate-700">
                <p>
                  <span className="font-semibold">
                    {confirmApprove.staffName}
                  </span>
                  &apos;s{" "}
                  <span className="font-semibold">
                    {confirmApprove.shiftLabel ?? "shift"}
                  </span>{" "}
                  on{" "}
                  <span className="font-semibold">
                    {WEEKDAY_NAMES[confirmApprove.day ?? -1] ?? "that day"}
                  </span>{" "}
                  will be reassigned to{" "}
                  <span className="font-semibold">
                    {confirmApprove.proposedSwapWithName ?? "the partner"}
                  </span>
                  .
                </p>
                <p className="text-xs text-slate-500">
                  Cost will be recalculated against{" "}
                  {confirmApprove.proposedSwapWithName ?? "their"}&apos;s pay
                  rate. Both portals refresh automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-2 text-sm text-slate-700">
                <p>
                  <span className="font-semibold">
                    {confirmApprove.staffName}
                  </span>{" "}
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
          )
        }
        confirmLabel={
          confirmApprove?.type === "time_change"
            ? "Approve & update shift"
            : confirmApprove?.type === "swap"
              ? `Approve & move to ${confirmApprove.proposedSwapWithName ?? "partner"}`
              : "Approve & remove shift"
        }
        destructive={
          confirmApprove?.type !== "time_change" &&
          confirmApprove?.type !== "swap"
        }
        pending={busyId === confirmApprove?.id}
        onConfirm={() => {
          if (!confirmApprove) return;
          if (
            confirmApprove.type === "swap" &&
            confirmApprove.proposedSwapWithName &&
            confirmApprove.partnerConfirmationStatus === "agreed"
          ) {
            // Look up the partner's staff ID via the impact panel? We don't
            // have it client-side. The server action accepts moveToStaffId
            // but we only know the partner's name on the client. Solve this
            // by passing through an extra field — see proposedSwapWithStaffId
            // on StaffRequest in the next iteration. For now we re-fetch via
            // the request itself: server uses the request's stored
            // proposedSwapWithStaffId when moveToStaffId matches.
            // Until then: rely on the server reading it from the request row.
          }
          runApprove(
            confirmApprove,
            confirmApprove.type === "swap"
              ? { moveToStaffId: confirmApprove.proposedSwapWithStaffId ?? undefined }
              : undefined,
          );
        }}
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
                  : declineFor.type === "time_change"
                    ? "time change request"
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
  const dayLabel = formatShiftDayLabel(req.weekStart, req.day);
  const header =
    req.type === "swap"
      ? `Swap — ${req.shiftLabel ?? "shift"}${dayLabel ? ` · ${dayLabel}` : ""}`
      : req.type === "time_change"
        ? `Time change — ${req.shiftLabel ?? "shift"}${dayLabel ? ` · ${dayLabel}` : ""}`
        : `Time off — ${dayLabel || "that day"}${req.weekStart ? ` · week of ${req.weekStart}` : ""}`;

  const hasProposedTime =
    req.type === "time_change" &&
    typeof req.proposedStartHour === "number" &&
    typeof req.proposedEndHour === "number";
  const hasProposedPartner =
    req.type === "swap" && !!req.proposedSwapWithName;
  // Approve gating for swaps with a named partner: block until they've
  // confirmed in their own portal. Decline stays enabled either way.
  const waitingOnPartner =
    hasProposedPartner && req.partnerConfirmationStatus === "requested";
  // When the partner has agreed AND is free that day, Approve becomes
  // "Approve & move shift to {name}" — single click reassigns.
  const willMoveOnApprove =
    hasProposedPartner &&
    req.partnerConfirmationStatus === "agreed" &&
    req.proposedSwapWithIsFreeThatDay === true;

  // Hour + cost delta for time_change
  const currentHours =
    typeof req.currentStartHour === "number" &&
    typeof req.currentEndHour === "number"
      ? shiftDuration(req.currentStartHour, req.currentEndHour)
      : null;
  const proposedHours =
    hasProposedTime && typeof req.proposedStartHour === "number" &&
    typeof req.proposedEndHour === "number"
      ? shiftDuration(req.proposedStartHour, req.proposedEndHour)
      : null;
  const hoursDiff =
    currentHours !== null && proposedHours !== null
      ? proposedHours - currentHours
      : null;
  const costDiff =
    typeof req.currentCost === "number" &&
    typeof req.proposedCost === "number"
      ? req.proposedCost - req.currentCost
      : null;

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

      {(req.reasonCategory || req.note) && (
        <div className="mt-2 rounded bg-slate-50 px-2 py-1 text-[11px] text-slate-700">
          {req.reasonCategory && (
            <div className="mb-0.5">
              <span className="font-semibold text-slate-800">Reason: </span>
              <span className="inline-flex items-center rounded-full bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-slate-200">
                {req.reasonCategory}
              </span>
            </div>
          )}
          {req.note && <div className="italic">“{req.note}”</div>}
        </div>
      )}

      {hasProposedTime && (
        <div className="mt-2 space-y-0.5 rounded bg-teal-50 px-2 py-1.5 text-[11px] text-teal-900">
          <div>
            <span className="font-semibold">Proposed new hours: </span>
            {req.shiftLabel ?? "current"}
            <span className="mx-1" aria-hidden>→</span>
            <span className="font-semibold">
              {formatHourShort(req.proposedStartHour!)}–
              {formatHourShort(req.proposedEndHour!)}
            </span>
          </div>
          {(currentHours !== null && proposedHours !== null) ||
          costDiff !== null ? (
            <div className="flex flex-wrap gap-x-3 text-[10px] text-teal-800/90">
              {currentHours !== null && proposedHours !== null && (
                <span>
                  <span className="font-medium">
                    {formatHours(currentHours)} → {formatHours(proposedHours)}
                  </span>
                  {hoursDiff !== null && Math.abs(hoursDiff) >= 0.01 && (
                    <span
                      className={
                        hoursDiff > 0
                          ? "ml-1 font-semibold text-amber-700"
                          : "ml-1 font-semibold text-emerald-700"
                      }
                    >
                      ({formatHoursDiff(hoursDiff)})
                    </span>
                  )}
                </span>
              )}
              {typeof req.currentCost === "number" &&
                typeof req.proposedCost === "number" && (
                  <span>
                    <span className="font-medium">
                      ${Math.round(req.currentCost)} → $
                      {Math.round(req.proposedCost)}
                    </span>
                    {costDiff !== null && Math.abs(costDiff) >= 0.5 && (
                      <span
                        className={
                          costDiff > 0
                            ? "ml-1 font-semibold text-amber-700"
                            : "ml-1 font-semibold text-emerald-700"
                        }
                      >
                        ({formatDollarsDiff(costDiff)})
                      </span>
                    )}
                  </span>
                )}
            </div>
          ) : null}
        </div>
      )}

      {hasProposedPartner && (
        <div className="mt-2 space-y-1 rounded bg-slate-50 px-2 py-1.5 text-[11px] text-slate-700">
          <div>
            <span className="font-semibold text-slate-800">
              Arranged with:{" "}
            </span>
            {req.proposedSwapWithName}
            {req.proposedSwapWithIsFreeThatDay ? (
              <span className="ml-1 rounded bg-emerald-50 px-1 text-[9px] font-semibold uppercase text-emerald-700">
                free that day
              </span>
            ) : (
              <span className="ml-1 rounded bg-amber-50 px-1 text-[9px] font-semibold uppercase text-amber-700">
                already rostered
              </span>
            )}
          </div>
          <PartnerConfirmationChip
            status={req.partnerConfirmationStatus ?? null}
            partnerName={req.proposedSwapWithName}
          />
        </div>
      )}

      {req.attachments && req.attachments.length > 0 && (
        <div className="mt-2 rounded bg-slate-50 px-2 py-1.5 text-[11px] text-slate-700">
          <div className="mb-1 flex items-center gap-1 font-semibold text-slate-800">
            <Paperclip aria-hidden className="h-3.5 w-3.5" />
            Attachments ({req.attachments.length})
          </div>
          <ul className="space-y-1">
            {req.attachments.map((att) => (
              <li
                key={att.id}
                className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1"
              >
                <a
                  href={`/api/request-attachments/${att.id}?inline=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 truncate font-medium text-teal-700 underline-offset-2 hover:underline"
                  title={att.filename}
                >
                  {att.filename}
                </a>
                <span className="shrink-0 text-[10px] text-slate-400">
                  {att.sizeBytes < 1024
                    ? `${att.sizeBytes} B`
                    : att.sizeBytes < 1024 * 1024
                      ? `${Math.round(att.sizeBytes / 1024)} KB`
                      : `${(att.sizeBytes / 1024 / 1024).toFixed(1)} MB`}
                </span>
                <a
                  href={`/api/request-attachments/${att.id}`}
                  download={att.filename}
                  aria-label={`Download ${att.filename}`}
                  title="Download"
                  className="shrink-0 rounded text-slate-400 transition hover:text-teal-700"
                >
                  <Download aria-hidden className="h-3.5 w-3.5" />
                </a>
              </li>
            ))}
          </ul>
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
          disabled={busy || waitingOnPartner}
          title={
            waitingOnPartner
              ? `Waiting on ${req.proposedSwapWithName ?? "partner"} to confirm`
              : undefined
          }
          className="rounded-md bg-teal-500 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy
            ? "Working…"
            : willMoveOnApprove
              ? `Approve & move to ${req.proposedSwapWithName ?? "partner"}`
              : "Approve"}
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

function PartnerConfirmationChip({
  status,
  partnerName,
}: {
  status: "requested" | "agreed" | "declined" | null;
  partnerName: string | null | undefined;
}) {
  if (!status) return null;
  const name = partnerName ?? "partner";
  if (status === "agreed") {
    return (
      <div className="flex items-center gap-1.5 text-emerald-800">
        <Check aria-hidden className="h-3 w-3" />
        <span>
          <span className="font-semibold">{name}</span> confirmed the swap
        </span>
      </div>
    );
  }
  if (status === "declined") {
    return (
      <div className="flex items-center gap-1.5 text-rose-800">
        <X aria-hidden className="h-3 w-3" />
        <span>
          <span className="font-semibold">{name}</span> declined — they can&apos;t
          cover
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-amber-800">
      <AlertTriangle aria-hidden className="h-3 w-3" />
      <span>
        Waiting on <span className="font-semibold">{name}</span> to confirm
      </span>
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
        <span className="inline-flex items-center gap-1 text-amber-700">
          <AlertTriangle aria-hidden className="h-3 w-3" />
          {flags.join(", ")}
        </span>
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

  const HeaderIcon = anyBreach ? AlertTriangle : Check;
  const headerIconClass = anyBreach ? "text-rose-700" : "text-emerald-700";

  return (
    <div
      className={`mt-1 flex flex-wrap items-center gap-x-1 gap-y-0.5 rounded px-2 py-1 text-[11px] ${wrapperClass}`}
    >
      <span className="flex items-center gap-1 font-semibold">
        <HeaderIcon
          aria-hidden
          className={`h-3.5 w-3.5 ${headerIconClass}`}
        />
        If approved:
      </span>
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-slate-400">·</span>}
          <span className={p.breaches ? "font-semibold" : ""}>{p.text}</span>
          {p.breaches && (
            <X aria-hidden className="h-3 w-3 text-rose-700" />
          )}
        </span>
      ))}
    </div>
  );
}
