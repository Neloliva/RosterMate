"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  Check,
  Circle,
  Mail,
  Paperclip,
  Phone,
  RefreshCw,
  X,
} from "lucide-react";
import {
  cancelStaffRequest,
  confirmSwapAsPartner,
  declineSwapAsPartner,
  submitSwapRequest,
  submitUnavailable,
  updateStaffRequestNote,
  uploadRequestAttachment,
} from "@/app/staff/[token]/actions";
import type { DayCell } from "@/lib/date";
import {
  formatHour,
  formatRange,
  hourToTimeString,
  timeStringToHour,
} from "@/lib/time";
import type { Shift, Staff } from "@/lib/types";
import { useVisiblePolling } from "@/lib/use-visible-polling";
import { ConfirmDialog } from "./ConfirmDialog";

type MyStaff = Pick<Staff, "id" | "name" | "role" | "initials">;

type TeammateSlot = {
  id: string;
  staffFirstName: string;
  startHour: number;
  endHour: number;
};

type HeroSlot = {
  weekStart: string;
  dayIdx: number;
  iso: string;
  mine: { id: string; startHour: number; endHour: number } | null;
  others: TeammateSlot[];
};

type RecentResolution = {
  id: string;
  type: "swap" | "unavailable" | "time_change";
  status: "approved" | "declined";
  weekStart: string | null;
  day: number | null;
  reason: string | null;
  resolvedAt: string;
};

type MyRequestAttachment = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

type MyRequest = {
  id: string;
  type: "swap" | "unavailable" | "time_change";
  status: "pending" | "approved" | "declined";
  weekStart: string | null;
  day: number | null;
  note: string | null;
  reasonCategory: string | null;
  proposedStartHour: number | null;
  proposedEndHour: number | null;
  proposedSwapWithName: string | null;
  partnerConfirmationStatus: "requested" | "agreed" | "declined" | null;
  reason: string | null;
  createdAt: string;
  resolvedAt: string | null;
  attachments: MyRequestAttachment[];
};

type PartnerAwaitingRequest = {
  id: string;
  requesterName: string;
  weekStart: string;
  day: number;
  startHour: number;
  endHour: number;
  note: string | null;
  createdAt: string;
};

function formatDuration(startHour: number, endHour: number): string {
  let hours = endHour - startHour;
  if (hours <= 0) hours += 24;
  if (Math.abs(hours - Math.round(hours)) < 0.01) {
    return `${Math.round(hours)}h`;
  }
  return `${hours.toFixed(1)}h`;
}

function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function StaffPageClient({
  token,
  me,
  weekStarts,
  shiftsByWeek,
  daysByWeek,
  holidays,
  today,
  tomorrow,
  todayIso,
  pendingSwapShiftIds,
  pendingUnavailableKeys,
  declinedByKey,
  recentResolutions,
  myRequests,
  leaveCategories,
  coworkers,
  busyStaffByKey,
  partnerAwaiting,
  contactPhone,
  contactEmail,
  lastUpdatedAt,
  nowHour,
}: {
  token: string;
  businessName: string;
  me: MyStaff;
  weekStarts: string[];
  shiftsByWeek: Record<string, Shift[]>;
  daysByWeek: Record<string, DayCell[]>;
  holidays: Map<string, string>;
  today: HeroSlot;
  tomorrow: HeroSlot;
  todayIso: string;
  pendingSwapShiftIds: string[];
  pendingUnavailableKeys: string[];
  declinedByKey: Record<
    string,
    {
      type: "swap" | "unavailable" | "time_change";
      reason: string | null;
      resolvedAt: string;
    }
  >;
  recentResolutions: RecentResolution[];
  myRequests: MyRequest[];
  leaveCategories: string[];
  coworkers: { id: string; firstName: string; role: string }[];
  busyStaffByKey: Record<string, string[]>;
  partnerAwaiting: PartnerAwaitingRequest[];
  contactPhone: string | null;
  contactEmail: string | null;
  lastUpdatedAt: string | null;
  nowHour: number;
}) {
  const [swapShift, setSwapShift] = useState<
    { shift: Shift; weekStart: string } | null
  >(null);
  // Intent toggle inside the Request-swap dialog: staff can either ask for a
  // time change (stay on shift, different hours) or for someone to cover it.
  const [swapIntent, setSwapIntent] = useState<"time_change" | "cover">(
    "time_change",
  );
  const [swapStart, setSwapStart] = useState("09:00");
  const [swapEnd, setSwapEnd] = useState("17:00");
  const [swapPartnerId, setSwapPartnerId] = useState<string>("");
  const [unavailableCell, setUnavailableCell] = useState<{
    weekStart: string;
    day: number;
  } | null>(null);
  const [swapNote, setSwapNote] = useState("");
  const [unavailableNote, setUnavailableNote] = useState("");
  const [unavailableCategory, setUnavailableCategory] = useState<string>("");
  const [unavailableFiles, setUnavailableFiles] = useState<File[]>([]);
  const [unavailableFileError, setUnavailableFileError] = useState<string | null>(
    null,
  );
  const [actionPending, startActionTransition] = useTransition();
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [showFutureWeeks, setShowFutureWeeks] = useState(false);

  // Per-token "seen" set for resolution banners. We wait until localStorage
  // is hydrated before rendering banners to avoid a flash of already-seen
  // notifications on first paint.
  const seenStorageKey = `rostermate:staff:seen-resolutions:${token}`;
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [seenHydrated, setSeenHydrated] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(seenStorageKey);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        if (Array.isArray(arr)) setSeenIds(new Set(arr));
      }
    } catch {
      // ignore malformed storage
    }
    setSeenHydrated(true);
  }, [seenStorageKey]);

  function dismissResolution(id: string) {
    setSeenIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        // Cap to 200 most recent ids so localStorage doesn't grow forever.
        const arr = [...next].slice(-200);
        localStorage.setItem(seenStorageKey, JSON.stringify(arr));
      } catch {
        // ignore quota errors
      }
      return next;
    });
  }

  useVisiblePolling(15000);

  const pendingSwapIdSet = useMemo(
    () => new Set(pendingSwapShiftIds),
    [pendingSwapShiftIds],
  );
  const pendingUnavailableSet = useMemo(
    () => new Set(pendingUnavailableKeys),
    [pendingUnavailableKeys],
  );

  const totalShifts = weekStarts.reduce(
    (acc, ws) => acc + (shiftsByWeek[ws]?.length ?? 0),
    0,
  );

  const thisWeek = weekStarts[0];
  const futureWeeks = weekStarts.slice(1);

  function confirmSwap() {
    if (!swapShift) return;
    const { shift } = swapShift;
    const note = swapNote;
    const intent = swapIntent;
    // Capture form state so it persists through the async boundary
    const startStr = swapStart;
    const endStr = swapEnd;
    const partnerId = swapPartnerId;
    startActionTransition(async () => {
      try {
        if (intent === "time_change") {
          const startHour = timeStringToHour(startStr);
          const endHourRaw = timeStringToHour(endStr);
          const endHour = endHourRaw <= startHour ? endHourRaw + 24 : endHourRaw;
          if (endHour <= startHour) {
            throw new Error("End time must be after start time");
          }
          await submitSwapRequest({
            token,
            shiftId: shift.id,
            note,
            proposedStartHour: startHour,
            proposedEndHour: endHour,
          });
          setActionStatus(
            "Time change request sent. Your manager will see it in the dashboard.",
          );
        } else {
          await submitSwapRequest({
            token,
            shiftId: shift.id,
            note,
            proposedSwapWithStaffId: partnerId || null,
          });
          setActionStatus(
            "Swap request sent. Your manager will see it in the dashboard.",
          );
        }
      } catch (e) {
        setActionStatus(
          e instanceof Error ? e.message : "Couldn't submit request",
        );
      } finally {
        setSwapShift(null);
        setSwapNote("");
        setSwapIntent("time_change");
        setSwapStart("09:00");
        setSwapEnd("17:00");
        setSwapPartnerId("");
      }
    });
  }

  function confirmUnavailable() {
    if (!unavailableCell) return;
    const cell = unavailableCell;
    const note = unavailableNote;
    const reasonCategory = unavailableCategory || null;
    const filesToUpload = unavailableFiles;
    startActionTransition(async () => {
      try {
        const { id: requestId } = await submitUnavailable({
          token,
          weekStart: cell.weekStart,
          day: cell.day,
          note,
          reasonCategory,
        });

        // Chain each attachment upload sequentially against the new request
        // id. Failures don't block the success toast — the request is
        // already saved — but we surface which files didn't land.
        const failed: string[] = [];
        for (const file of filesToUpload) {
          const fd = new FormData();
          fd.append("token", token);
          fd.append("requestId", requestId);
          fd.append("file", file);
          try {
            const res = await uploadRequestAttachment(fd);
            if (!res.ok) failed.push(`${file.name} (${res.error})`);
          } catch (err) {
            failed.push(
              `${file.name} (${err instanceof Error ? err.message : "upload failed"})`,
            );
          }
        }

        if (failed.length === 0) {
          setActionStatus(
            filesToUpload.length > 0
              ? `Time off request sent with ${filesToUpload.length} attachment${filesToUpload.length === 1 ? "" : "s"}.`
              : "Time off request sent to your manager.",
          );
        } else {
          setActionStatus(
            `Request saved, but couldn't upload: ${failed.join(", ")}. Cancel and resubmit if those files are important.`,
          );
        }
      } catch (e) {
        setActionStatus(
          e instanceof Error ? e.message : "Couldn't submit request",
        );
      } finally {
        setUnavailableCell(null);
        setUnavailableNote("");
        setUnavailableCategory("");
        setUnavailableFiles([]);
        setUnavailableFileError(null);
      }
    });
  }

  function renderWeek(ws: string) {
    const days = daysByWeek[ws] ?? [];
    const shifts = shiftsByWeek[ws] ?? [];
    const weekHasAny = shifts.length > 0;
    return (
      <div
        key={ws}
        className="rounded-lg border border-slate-200 bg-slate-50/60"
      >
        <div className="flex items-baseline justify-between border-b border-slate-200 px-3 py-2">
          <div className="text-[13px] font-semibold uppercase tracking-wide text-slate-600">
            Week of {days[0]?.date}
          </div>
          <div className="text-xs text-slate-500">
            {shifts.length} shift{shifts.length === 1 ? "" : "s"}
          </div>
        </div>
        <ul className="divide-y divide-slate-100">
          {days.map((day, idx) => {
            const shift = shifts.find((s) => s.day === idx);
            const holiday = holidays.get(day.iso);
            const swapPending = shift && pendingSwapIdSet.has(shift.id);
            const unavailablePending = pendingUnavailableSet.has(
              `${ws}:${idx}`,
            );
            const declined = declinedByKey[`${ws}:${idx}`];

            // Time-based gating. Compare calendar date first (strings sort
            // correctly because they're ISO), then fall back to within-day
            // hour comparison when it's today.
            const isToday = day.iso === todayIso;
            const isPastDay = day.iso < todayIso;
            const shiftEndedToday =
              isToday && shift !== undefined && shift.endHour <= nowHour;
            const shiftStartedToday =
              isToday && shift !== undefined && shift.startHour <= nowHour;
            const isPast = isPastDay || shiftEndedToday;

            // Action availability: both buttons are shift-only. Non-rostered
            // days surface no actions — there's nothing to cancel.
            //   shift + future: both buttons (minus whatever is pending)
            //   shift + today, not started: both
            //   shift + today, in progress: can't work only
            //   shift + past: none
            //   no shift: none
            // Also hide the matching button for 48h after the manager declined
            // that same ask — avoids re-submission of a just-refused request.
            // The other-type button stays available because it's a different
            // thing to ask (swap is not the same as "can't work at all").
            const recentlyDeclinedSwap = declined?.type === "swap";
            const recentlyDeclinedUnavailable =
              declined?.type === "unavailable";
            const canRequestSwap =
              !!shift &&
              !swapPending &&
              !recentlyDeclinedSwap &&
              !isPast &&
              !(isToday && shiftStartedToday);
            const canReportUnavailable =
              !!shift &&
              !unavailablePending &&
              !recentlyDeclinedUnavailable &&
              !isPast;

            const showActions = canRequestSwap || canReportUnavailable;

            const rowTint = swapPending
              ? "bg-amber-50"
              : unavailablePending
                ? "bg-rose-50"
                : isToday
                  ? "bg-teal-50/60"
                  : "";
            const pastStyle = isPast ? "opacity-60" : "";

            return (
              <li
                key={idx}
                className={`flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between ${rowTint} ${pastStyle}`}
              >
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <div className="w-24 shrink-0">
                    <div className="text-[15px] font-semibold text-slate-900">
                      {day.name}
                    </div>
                    <div className="text-xs text-slate-500">{day.date}</div>
                  </div>
                  {shift && (
                    <div className="flex items-center gap-2 text-[15px]">
                      <span className="font-semibold text-slate-900">
                        {formatRange(shift.startHour, shift.endHour)}
                      </span>
                      <span className="text-xs text-slate-500">
                        · {formatDuration(shift.startHour, shift.endHour)}
                      </span>
                    </div>
                  )}
                  {holiday && (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                      🎉 {holiday}
                    </span>
                  )}
                  {swapPending && (
                    <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                      Swap pending
                    </span>
                  )}
                  {declined && !swapPending && !unavailablePending && (
                    <DeclinedChip
                      type={declined.type}
                      reason={declined.reason}
                    />
                  )}
                  {unavailablePending && (
                    <span className="rounded-full bg-rose-200 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
                      Time off pending
                    </span>
                  )}
                </div>
                {showActions && (
                  <div className="flex flex-wrap items-center gap-2">
                    {canRequestSwap && (
                      <button
                        type="button"
                        onClick={() => {
                          // Pre-fill the time pickers with the current
                          // rostered hours so the most common "small tweak"
                          // path is one-step.
                          setSwapStart(hourToTimeString(shift!.startHour));
                          setSwapEnd(
                            hourToTimeString(
                              shift!.endHour > 24
                                ? shift!.endHour - 24
                                : shift!.endHour,
                            ),
                          );
                          setSwapIntent("time_change");
                          setSwapPartnerId("");
                          setSwapShift({ shift: shift!, weekStart: ws });
                        }}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <RefreshCw
                          aria-hidden
                          className="h-4 w-4 text-teal-600"
                        />
                        Request swap
                      </button>
                    )}
                    {canReportUnavailable && (
                      <button
                        type="button"
                        onClick={() =>
                          setUnavailableCell({
                            weekStart: ws,
                            day: idx,
                          })
                        }
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <AlertTriangle
                          aria-hidden
                          className="h-4 w-4 text-amber-600"
                        />
                        Can&apos;t work
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          {!weekHasAny && (
            <li className="px-3 py-3 text-sm text-slate-400">
              No shifts scheduled this week.
            </li>
          )}
        </ul>
      </div>
    );
  }

  function renderHeroSlot(label: string, slot: HeroSlot) {
    const mine = slot.mine;
    const others = slot.others;
    const holiday = holidays.get(slot.iso);
    const isToday = slot.iso === todayIso;
    const wrapperClass = isToday
      ? "rounded-xl border border-teal-200 bg-teal-50/60 p-4"
      : "rounded-xl border border-slate-200 bg-white p-4";
    return (
      <div className={wrapperClass}>
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-bold uppercase tracking-wider text-teal-600">
            {label}
          </div>
          <div className="text-xs font-medium text-slate-500">
            {formatLongDate(slot.iso)}
          </div>
        </div>
        {holiday && (
          <div className="mt-2 inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
            🎉 {holiday}
          </div>
        )}
        <div className="mt-2">
          {mine ? (
            <div className="text-xl font-bold text-slate-900">
              {formatRange(mine.startHour, mine.endHour)}
              <span className="ml-2 text-sm font-medium text-slate-500">
                · {formatDuration(mine.startHour, mine.endHour)} · {me.role}
              </span>
            </div>
          ) : (
            <div className="text-xl font-bold text-slate-400">Day off</div>
          )}
        </div>
        {others.length > 0 && <AlsoWorking others={others} />}
        {others.length === 0 && !mine && (
          <div className="mt-1 text-sm text-slate-400">
            Nobody scheduled.
          </div>
        )}
      </div>
    );
  }

  const unseenResolutions = seenHydrated
    ? recentResolutions.filter((r) => !seenIds.has(r.id))
    : [];

  return (
    <div className="space-y-5">
      {unseenResolutions.length > 0 && (
        <RecentUpdates
          updates={unseenResolutions}
          daysByWeek={daysByWeek}
          onDismiss={dismissResolution}
        />
      )}
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-base font-semibold text-teal-700">
            {me.initials}
          </div>
          <div>
            <div className="text-base font-semibold text-slate-900">
              Hi {me.name.split(/\s+/)[0]}
            </div>
            <div className="text-sm text-slate-500">{me.role}</div>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          {totalShifts > 0
            ? `You have ${totalShifts} shift${totalShifts === 1 ? "" : "s"} scheduled over the next ${weekStarts.length} weeks.`
            : "No shifts scheduled over the next 4 weeks."}
        </p>
        {actionStatus && (
          <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
            {actionStatus}
          </p>
        )}
      </section>

      <QuickActionsRow
        todayAlreadyUnavailable={pendingUnavailableSet.has(
          `${today.weekStart}:${today.dayIdx}`,
        )}
        onReportSickToday={() =>
          setUnavailableCell({
            weekStart: today.weekStart,
            day: today.dayIdx,
          })
        }
        contactPhone={contactPhone}
        contactEmail={contactEmail}
      />

      {partnerAwaiting.length > 0 && (
        <PartnerAwaitingCard
          items={partnerAwaiting}
          daysByWeek={daysByWeek}
          token={token}
        />
      )}

      <MyRequestsCard
        requests={myRequests}
        daysByWeek={daysByWeek}
        token={token}
        leaveCategories={leaveCategories}
      />

      <section className="space-y-3">
        {renderHeroSlot("Today", today)}
        {renderHeroSlot("Tomorrow", tomorrow)}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <h2 className="text-base font-semibold text-slate-900">
          This week
        </h2>
        <div className="mt-3">{renderWeek(thisWeek)}</div>

        {futureWeeks.length > 0 && (
          <div className="mt-4 space-y-4">
            {showFutureWeeks ? (
              <>
                {futureWeeks.map((ws) => renderWeek(ws))}
                <button
                  type="button"
                  onClick={() => setShowFutureWeeks(false)}
                  className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Hide future weeks
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowFutureWeeks(true)}
                className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Show next {futureWeeks.length} weeks →
              </button>
            )}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={!!swapShift}
        title="Request a shift change?"
        message={
          swapShift && (
            <SwapDialogBody
              shift={swapShift.shift}
              shiftWeekStart={swapShift.weekStart}
              intent={swapIntent}
              onIntentChange={setSwapIntent}
              startTime={swapStart}
              onStartTimeChange={setSwapStart}
              endTime={swapEnd}
              onEndTimeChange={setSwapEnd}
              partnerId={swapPartnerId}
              onPartnerChange={setSwapPartnerId}
              note={swapNote}
              onNoteChange={setSwapNote}
              coworkers={coworkers}
              busyStaffByKey={busyStaffByKey}
            />
          )
        }
        confirmLabel="Send request"
        pending={actionPending}
        onConfirm={confirmSwap}
        onCancel={() => {
          setSwapShift(null);
          setSwapNote("");
          setSwapIntent("time_change");
          setSwapStart("09:00");
          setSwapEnd("17:00");
          setSwapPartnerId("");
        }}
      />

      <ConfirmDialog
        open={!!unavailableCell}
        title="Request time off?"
        message={
          <div className="space-y-3">
            {unavailableCell && (
              <div className="text-sm text-slate-600">
                Date:{" "}
                <span className="font-semibold text-slate-800">
                  {daysByWeek[unavailableCell.weekStart]?.[unavailableCell.day]
                    ?.name}
                  {", "}
                  {daysByWeek[unavailableCell.weekStart]?.[unavailableCell.day]
                    ?.date}
                </span>
              </div>
            )}
            {leaveCategories.length > 0 && (
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Reason
                </span>
                <select
                  value={unavailableCategory}
                  onChange={(e) => setUnavailableCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
                >
                  <option value="">— Choose a reason —</option>
                  {leaveCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                {leaveCategories.length > 0
                  ? "Additional details (optional)"
                  : "Optional reason"}
              </span>
              <textarea
                value={unavailableNote}
                onChange={(e) => setUnavailableNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="e.g. unwell, family commitment"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </label>
            <DialogFilePicker
              files={unavailableFiles}
              onChange={setUnavailableFiles}
              error={unavailableFileError}
              onError={setUnavailableFileError}
            />
          </div>
        }
        confirmLabel="Send request"
        pending={actionPending}
        onConfirm={confirmUnavailable}
        onCancel={() => {
          setUnavailableCell(null);
          setUnavailableNote("");
          setUnavailableCategory("");
          setUnavailableFiles([]);
          setUnavailableFileError(null);
        }}
      />

      <LastUpdatedLine iso={lastUpdatedAt} />
    </div>
  );
}

function QuickActionsRow({
  todayAlreadyUnavailable,
  onReportSickToday,
  contactPhone,
  contactEmail,
}: {
  todayAlreadyUnavailable: boolean;
  onReportSickToday: () => void;
  contactPhone: string | null;
  contactEmail: string | null;
}) {
  const hasContact = Boolean(contactPhone || contactEmail);
  if (todayAlreadyUnavailable && !hasContact) return null;

  return (
    <section className="flex flex-wrap gap-2">
      {!todayAlreadyUnavailable && (
        <button
          type="button"
          onClick={onReportSickToday}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
        >
          🚨 I&apos;m sick today
        </button>
      )}
      {contactPhone && (
        <a
          href={`tel:${contactPhone.replace(/\s+/g, "")}`}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <Phone aria-hidden className="h-4 w-4 text-teal-600" />
          Call manager
        </a>
      )}
      {contactEmail && (
        <a
          href={`mailto:${contactEmail}`}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <Mail aria-hidden className="h-4 w-4 text-teal-600" />
          Email manager
        </a>
      )}
    </section>
  );
}

function formatRelativeTime(iso: string): string {
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

function PartnerAwaitingCard({
  items,
  daysByWeek,
  token,
}: {
  items: PartnerAwaitingRequest[];
  daysByWeek: Record<string, DayCell[]>;
  token: string;
}) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-amber-900">
          <AlertTriangle aria-hidden className="h-4 w-4 text-amber-600" />
          Awaiting your confirmation
        </h2>
        <span className="text-xs font-medium text-amber-800">
          {items.length} swap {items.length === 1 ? "request" : "requests"}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-amber-900/80">
        A teammate has asked to swap one of their shifts with you. Confirm
        only if you can cover it — your manager will see your answer before
        moving anything on the roster.
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <PartnerAwaitingRow
            key={item.id}
            item={item}
            daysByWeek={daysByWeek}
            token={token}
          />
        ))}
      </ul>
    </section>
  );
}

function PartnerAwaitingRow({
  item,
  daysByWeek,
  token,
}: {
  item: PartnerAwaitingRequest;
  daysByWeek: Record<string, DayCell[]>;
  token: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const cell = daysByWeek[item.weekStart]?.[item.day] ?? null;
  const dayPart = cell ? `${cell.name}, ${cell.date}` : "that day";

  function confirm() {
    setError(null);
    startTransition(async () => {
      try {
        await confirmSwapAsPartner({ token, requestId: item.id });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't confirm");
      }
    });
  }

  function decline() {
    setError(null);
    startTransition(async () => {
      try {
        await declineSwapAsPartner({ token, requestId: item.id });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't decline");
      }
    });
  }

  return (
    <li className="rounded-lg border border-amber-200 bg-white p-3 text-sm">
      <div className="text-sm">
        <span className="font-semibold text-slate-900">
          {item.requesterName}
        </span>{" "}
        wants to swap their{" "}
        <span className="font-semibold text-slate-900">{dayPart}</span> shift
        (
        <span className="font-medium">
          {formatRange(item.startHour, item.endHour)}
        </span>
        ) with you.
      </div>
      {item.note && (
        <div className="mt-1 text-xs italic text-slate-600">
          Their note: “{item.note}”
        </div>
      )}
      <div className="mt-2 text-[11px] text-slate-500">
        Sent {formatRelativeTime(item.createdAt)}
      </div>
      {error && (
        <div className="mt-1 text-[11px] text-rose-600">{error}</div>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={decline}
          disabled={pending}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={pending}
          className="rounded-md bg-teal-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {pending ? "Working…" : "Confirm swap"}
        </button>
      </div>
    </li>
  );
}

function MyRequestsCard({
  requests,
  daysByWeek,
  token,
  leaveCategories,
}: {
  requests: MyRequest[];
  daysByWeek: Record<string, DayCell[]>;
  token: string;
  leaveCategories: string[];
}) {
  const pending = requests.filter((r) => r.status === "pending");
  const resolved = requests.filter((r) => r.status !== "pending");
  const hasPending = pending.length > 0;

  // When there's anything pending, the section is expanded by default so the
  // actionable items are glanceable. Resolved history collapses behind a
  // "+N resolved" toggle inside the same card.
  // When everything is resolved, the whole card collapses to a one-liner so
  // it doesn't dominate the page.
  const [showAllCaughtUp, setShowAllCaughtUp] = useState(false);
  const [showResolvedInline, setShowResolvedInline] = useState(false);

  if (requests.length === 0) return null;

  const headerStatus = hasPending
    ? `${pending.length} awaiting manager`
    : `all caught up · ${resolved.length} resolved`;

  // All-caught-up mode: header is the toggle; body hidden until clicked.
  if (!hasPending) {
    return (
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <button
          type="button"
          onClick={() => setShowAllCaughtUp((o) => !o)}
          aria-expanded={showAllCaughtUp}
          className="flex w-full items-baseline justify-between gap-2 text-left"
        >
          <h2 className="text-base font-semibold text-slate-900">
            My requests
          </h2>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
            {headerStatus}
            <span aria-hidden>{showAllCaughtUp ? "▴" : "▾"}</span>
          </span>
        </button>
        {showAllCaughtUp && (
          <ul className="mt-3 space-y-2">
            {resolved.map((req) => (
              <MyRequestRow
                key={req.id}
                req={req}
                daysByWeek={daysByWeek}
                token={token}
                leaveCategories={leaveCategories}
              />
            ))}
          </ul>
        )}
      </section>
    );
  }

  // Has-pending mode: pending always visible; resolved is an inline toggle.
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">My requests</h2>
        <span className="text-xs font-medium text-slate-500">
          {headerStatus}
        </span>
      </div>
      <ul className="mt-3 space-y-2">
        {pending.map((req) => (
          <MyRequestRow
            key={req.id}
            req={req}
            daysByWeek={daysByWeek}
            token={token}
            leaveCategories={leaveCategories}
          />
        ))}
      </ul>
      {resolved.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowResolvedInline((o) => !o)}
            aria-expanded={showResolvedInline}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            {showResolvedInline ? "Hide" : `Show ${resolved.length}`} resolved
            <span aria-hidden>{showResolvedInline ? "▴" : "▾"}</span>
          </button>
          {showResolvedInline && (
            <ul className="mt-2 space-y-2">
              {resolved.map((req) => (
                <MyRequestRow
                  key={req.id}
                  req={req}
                  daysByWeek={daysByWeek}
                  token={token}
                  leaveCategories={leaveCategories}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function MyRequestRow({
  req,
  daysByWeek,
  token,
  leaveCategories,
}: {
  req: MyRequest;
  daysByWeek: Record<string, DayCell[]>;
  token: string;
  leaveCategories: string[];
}) {
  const isPending = req.status === "pending";
  const showCategoryEditor =
    req.type === "unavailable" && leaveCategories.length > 0;
  const [editing, setEditing] = useState(false);
  const [noteDraft, setNoteDraft] = useState(req.note ?? "");
  const [categoryDraft, setCategoryDraft] = useState(req.reasonCategory ?? "");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [rowPending, startRowTransition] = useTransition();
  const [rowError, setRowError] = useState<string | null>(null);

  const typeLabel =
    req.type === "swap"
      ? "Swap"
      : req.type === "time_change"
        ? "Time change"
        : "Time off";
  const cell =
    req.weekStart && typeof req.day === "number"
      ? daysByWeek[req.weekStart]?.[req.day]
      : null;
  const dayPart = cell ? ` · ${cell.name}, ${cell.date}` : "";
  const activityIso = req.resolvedAt ?? req.createdAt;
  const activityLabel =
    req.status === "pending"
      ? `sent ${formatRelativeTime(req.createdAt)}`
      : `${req.status} ${formatRelativeTime(activityIso)}`;

  const chip =
    req.status === "pending"
      ? {
          class: "bg-amber-100 text-amber-800",
          Icon: Circle,
          iconClass: "fill-amber-500 text-amber-500",
          label: "Pending",
        }
      : req.status === "approved"
        ? {
            class: "bg-emerald-100 text-emerald-800",
            Icon: Check,
            iconClass: "text-emerald-700",
            label: "Approved",
          }
        : {
            class: "bg-slate-200 text-slate-700",
            Icon: X,
            iconClass: "text-slate-600",
            label: "Declined",
          };

  function saveEdit() {
    setRowError(null);
    startRowTransition(async () => {
      try {
        await updateStaffRequestNote({
          token,
          requestId: req.id,
          note: noteDraft,
          // Only send a category update for time-off requests; swap requests
          // ignore this parameter server-side anyway.
          ...(req.type === "unavailable"
            ? { reasonCategory: categoryDraft || null }
            : {}),
        });
        setEditing(false);
      } catch (e) {
        setRowError(
          e instanceof Error ? e.message : "Couldn't save the note",
        );
      }
    });
  }

  function runCancel() {
    setRowError(null);
    startRowTransition(async () => {
      try {
        await cancelStaffRequest({ token, requestId: req.id });
        setConfirmCancel(false);
      } catch (e) {
        setRowError(
          e instanceof Error ? e.message : "Couldn't cancel the request",
        );
        setConfirmCancel(false);
      }
    });
  }

  return (
    <li className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-medium text-slate-800">
          {typeLabel}
          <span className="text-slate-500">{dayPart}</span>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${chip.class}`}
        >
          <chip.Icon aria-hidden className={`h-3 w-3 ${chip.iconClass}`} />
          {chip.label}
        </span>
      </div>
      <div className="mt-1 text-xs text-slate-500">{activityLabel}</div>

      {editing ? (
        <div className="mt-2 space-y-2">
          {showCategoryEditor && (
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-600">
                Reason
              </span>
              <select
                value={categoryDraft}
                onChange={(e) => setCategoryDraft(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
              >
                <option value="">— Choose a reason —</option>
                {leaveCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          )}
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder={
              showCategoryEditor
                ? "Additional details (optional)…"
                : "Add or update your note for the manager…"
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setNoteDraft(req.note ?? "");
                setCategoryDraft(req.reasonCategory ?? "");
                setRowError(null);
              }}
              disabled={rowPending}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel edit
            </button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={rowPending}
              className="rounded-md bg-teal-500 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {rowPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      ) : (
        <>
          {req.reasonCategory && (
            <div className="mt-1">
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                {req.reasonCategory}
              </span>
            </div>
          )}
          {req.type === "time_change" &&
            typeof req.proposedStartHour === "number" &&
            typeof req.proposedEndHour === "number" && (
              <div className="mt-1 text-xs text-slate-700">
                <span className="font-medium">Asked for:</span>{" "}
                {formatHour(req.proposedStartHour).replace(":00", "")}
                –
                {formatHour(req.proposedEndHour).replace(":00", "")}
              </div>
            )}
          {req.type === "swap" && req.proposedSwapWithName && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-700">
              <span>
                <span className="font-medium">Arranged with:</span>{" "}
                {req.proposedSwapWithName}
              </span>
              {req.partnerConfirmationStatus === "agreed" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                  <Check aria-hidden className="h-3 w-3" />
                  {req.proposedSwapWithName} confirmed
                </span>
              )}
              {req.partnerConfirmationStatus === "declined" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800">
                  <X aria-hidden className="h-3 w-3" />
                  {req.proposedSwapWithName} declined
                </span>
              )}
              {req.partnerConfirmationStatus === "requested" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                  <AlertTriangle aria-hidden className="h-3 w-3" />
                  Waiting on {req.proposedSwapWithName}
                </span>
              )}
            </div>
          )}
          {req.note && (
            <div className="mt-1 text-xs italic text-slate-600">
              Your note: “{req.note}”
            </div>
          )}
          {req.status === "declined" && req.reason && (
            <div className="mt-1 text-xs italic text-slate-700">
              Manager: “{req.reason}”
            </div>
          )}
        </>
      )}

      {rowError && (
        <div className="mt-1 text-[11px] text-rose-600">{rowError}</div>
      )}

      {!editing && req.attachments.length > 0 && (
        <AttachmentListReadOnly
          attachments={req.attachments}
          token={token}
        />
      )}

      {isPending && !editing && (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setNoteDraft(req.note ?? "");
              setCategoryDraft(req.reasonCategory ?? "");
              setEditing(true);
            }}
            disabled={rowPending}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setConfirmCancel(true)}
            disabled={rowPending}
            className="rounded-md border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel request
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this request?"
        message={
          <p>
            {typeLabel} request{dayPart ? ` for ${dayPart.replace(" · ", "")}` : ""}
            {" "}will be withdrawn from the manager&apos;s queue. You can always
            send a new one if you change your mind.
          </p>
        }
        confirmLabel="Cancel request"
        destructive
        pending={rowPending}
        onConfirm={runCancel}
        onCancel={() => setConfirmCancel(false)}
      />
    </li>
  );
}

function RecentUpdates({
  updates,
  daysByWeek,
  onDismiss,
}: {
  updates: RecentResolution[];
  daysByWeek: Record<string, DayCell[]>;
  onDismiss: (id: string) => void;
}) {
  return (
    <section className="space-y-2" aria-label="Recent updates">
      {updates.map((u) => (
        <UpdateBanner
          key={u.id}
          update={u}
          daysByWeek={daysByWeek}
          onDismiss={() => onDismiss(u.id)}
        />
      ))}
    </section>
  );
}

function UpdateBanner({
  update,
  daysByWeek,
  onDismiss,
}: {
  update: RecentResolution;
  daysByWeek: Record<string, DayCell[]>;
  onDismiss: () => void;
}) {
  const approved = update.status === "approved";
  const typeLabel =
    update.type === "swap"
      ? "Swap"
      : update.type === "time_change"
        ? "Time change"
        : "Time off";
  const cell =
    update.weekStart && typeof update.day === "number"
      ? daysByWeek[update.weekStart]?.[update.day]
      : null;
  const dayPart = cell ? ` — ${cell.name}, ${cell.date}` : "";

  const wrapperClass = approved
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : "border-slate-200 bg-slate-50 text-slate-800";
  const StatusIcon = approved ? Check : X;
  const statusIconClass = approved ? "text-emerald-700" : "text-slate-600";

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-xl border p-3 ${wrapperClass}`}
      role="status"
    >
      <div className="flex-1 text-sm">
        <div className="flex items-center gap-1.5 font-semibold">
          <StatusIcon
            aria-hidden
            className={`h-4 w-4 ${statusIconClass}`}
          />
          <span>
            {typeLabel} request {approved ? "approved" : "declined"}
            {dayPart}
          </span>
        </div>
        {update.reason && (
          <div className="mt-0.5 text-xs italic opacity-80">
            “{update.reason}”
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="rounded p-1 text-sm opacity-60 transition hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}

function SwapDialogBody({
  shift,
  shiftWeekStart,
  intent,
  onIntentChange,
  startTime,
  onStartTimeChange,
  endTime,
  onEndTimeChange,
  partnerId,
  onPartnerChange,
  note,
  onNoteChange,
  coworkers,
  busyStaffByKey,
}: {
  shift: Shift;
  shiftWeekStart: string;
  intent: "time_change" | "cover";
  onIntentChange: (next: "time_change" | "cover") => void;
  startTime: string;
  onStartTimeChange: (next: string) => void;
  endTime: string;
  onEndTimeChange: (next: string) => void;
  partnerId: string;
  onPartnerChange: (next: string) => void;
  note: string;
  onNoteChange: (next: string) => void;
  coworkers: { id: string; firstName: string; role: string }[];
  busyStaffByKey: Record<string, string[]>;
}) {
  const busyThatDay = new Set(
    busyStaffByKey[`${shiftWeekStart}:${shift.day}`] ?? [],
  );
  const freeCoworkers = coworkers.filter((c) => !busyThatDay.has(c.id));
  const busyCoworkers = coworkers.filter((c) => busyThatDay.has(c.id));

  const startH = timeStringToHour(startTime);
  const endHRaw = timeStringToHour(endTime);
  const endH = endHRaw <= startH ? endHRaw + 24 : endHRaw;
  const overnight = endHRaw <= startH;
  const unchanged =
    Math.abs(startH - shift.startHour) < 0.01 &&
    Math.abs(endH - shift.endHour) < 0.01;
  const invalidTimes = endH <= startH;

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-600">
        Current shift:{" "}
        <span className="font-semibold text-slate-800">
          {formatRange(shift.startHour, shift.endHour)}
        </span>
      </div>

      <div>
        <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
          What do you need?
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onIntentChange("time_change")}
            className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
              intent === "time_change"
                ? "border-teal-400 bg-teal-50 text-teal-800 ring-1 ring-teal-200"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <div className="font-semibold">Change the time</div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              Keep me on the shift, different hours
            </div>
          </button>
          <button
            type="button"
            onClick={() => onIntentChange("cover")}
            className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
              intent === "cover"
                ? "border-teal-400 bg-teal-50 text-teal-800 ring-1 ring-teal-200"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <div className="font-semibold">Someone else covers</div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              Hand this shift to a coworker
            </div>
          </button>
        </div>
      </div>

      {intent === "time_change" ? (
        <div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                Start time
              </span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => onStartTimeChange(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
              <span className="mt-1 block text-[11px] text-slate-500">
                {formatHour(startH).toUpperCase()}
              </span>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                End time
              </span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => onEndTimeChange(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
              <span className="mt-1 block text-[11px] text-slate-500">
                {formatHour(endHRaw).toUpperCase()}
                {overnight ? " (next day)" : ""}
              </span>
            </label>
          </div>
          {invalidTimes && (
            <p className="mt-1 text-[11px] text-rose-600">
              End time must be after start time.
            </p>
          )}
          {!invalidTimes && unchanged && (
            <p className="mt-1 text-[11px] text-amber-700">
              These are the current times — change them to request an
              adjustment.
            </p>
          )}
        </div>
      ) : (
        <div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              I&apos;ve arranged with (optional)
            </span>
            <select
              value={partnerId}
              onChange={(e) => onPartnerChange(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
            >
              <option value="">— Not yet arranged —</option>
              {freeCoworkers.length > 0 && (
                <optgroup label="Free that day">
                  {freeCoworkers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} · {c.role}
                    </option>
                  ))}
                </optgroup>
              )}
              {busyCoworkers.length > 0 && (
                <optgroup label="Already rostered that day">
                  {busyCoworkers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} · {c.role}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <span className="mt-1 block text-[11px] text-slate-500">
              If you&apos;ve already talked to someone, pick their name so
              your manager knows the plan.
            </span>
          </label>
        </div>
      )}

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">
          Note for your manager (optional)
        </span>
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder={
            intent === "time_change"
              ? "e.g. bus only gets me in at 10"
              : "e.g. Mike agreed to cover"
          }
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
        />
      </label>
    </div>
  );
}

const ATTACHMENT_MIME_ALLOWLIST = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
  "application/pdf",
] as const;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS = 3;

function DialogFilePicker({
  files,
  onChange,
  error,
  onError,
}: {
  files: File[];
  onChange: (next: File[]) => void;
  error: string | null;
  onError: (err: string | null) => void;
}) {
  const hasRoom = files.length < MAX_ATTACHMENTS;

  function addFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    onError(null);
    if (
      !(ATTACHMENT_MIME_ALLOWLIST as readonly string[]).includes(file.type)
    ) {
      onError("Unsupported file type — use JPG, PNG, HEIC, WebP, or PDF.");
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      onError(
        `File exceeds the 5 MB limit (got ${Math.round(file.size / 1024)} KB).`,
      );
      return;
    }
    if (files.length >= MAX_ATTACHMENTS) {
      onError(`You can attach at most ${MAX_ATTACHMENTS} files.`);
      return;
    }
    if (files.some((f) => f.name === file.name && f.size === file.size)) {
      onError("That file is already attached.");
      return;
    }
    onChange([...files, file]);
  }

  function removeAt(idx: number) {
    onChange(files.filter((_, i) => i !== idx));
    onError(null);
  }

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-slate-700">
        Attach file (optional)
      </span>
      {files.length > 0 && (
        <ul className="mb-2 space-y-1">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
            >
              <Paperclip
                aria-hidden
                className="h-3.5 w-3.5 shrink-0 text-slate-400"
              />
              <span className="flex-1 truncate font-medium text-slate-800">
                {f.name}
              </span>
              <span className="shrink-0 text-[10px] text-slate-400">
                {formatSize(f.size)}
              </span>
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={`Remove ${f.name}`}
                className="shrink-0 rounded text-slate-400 transition hover:text-rose-600"
              >
                <X aria-hidden className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {hasRoom && (
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-teal-300 hover:text-teal-700">
          <Paperclip aria-hidden className="h-4 w-4" />
          {files.length === 0 ? "Add a file" : "Add another file"}
          <input
            type="file"
            accept={ATTACHMENT_MIME_ALLOWLIST.join(",")}
            className="hidden"
            onChange={addFile}
          />
        </label>
      )}
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
        JPG, PNG, HEIC, WebP, or PDF · up to 5 MB · max {MAX_ATTACHMENTS}{" "}
        files. Only your manager sees uploaded files.
      </p>
      {error && <p className="mt-1 text-[11px] text-rose-600">{error}</p>}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentListReadOnly({
  attachments,
  token,
}: {
  attachments: MyRequestAttachment[];
  token: string;
}) {
  return (
    <ul className="mt-2 space-y-1">
      {attachments.map((att) => (
        <li
          key={att.id}
          className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
        >
          <Paperclip
            aria-hidden
            className="h-3.5 w-3.5 shrink-0 text-slate-400"
          />
          <a
            href={`/api/request-attachments/${att.id}?token=${encodeURIComponent(token)}&inline=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 truncate font-medium text-teal-700 underline-offset-2 hover:underline"
          >
            {att.filename}
          </a>
          <span className="shrink-0 text-[10px] text-slate-400">
            {formatSize(att.sizeBytes)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function DeclinedChip({
  type,
  reason,
}: {
  type: "swap" | "unavailable" | "time_change";
  reason: string | null;
}) {
  const label =
    type === "swap"
      ? "Swap declined"
      : type === "time_change"
        ? "Time change declined"
        : "Time off declined";
  return (
    <span
      className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
      title={reason ?? undefined}
    >
      <X aria-hidden className="h-3 w-3 text-slate-600" />
      {label}
      {reason && (
        <span className="ml-1 truncate font-normal italic text-slate-600">
          “{reason}”
        </span>
      )}
    </span>
  );
}

function AlsoWorking({ others }: { others: TeammateSlot[] }) {
  const PREVIEW = 2;
  const [expanded, setExpanded] = useState(false);
  const hidden = others.length - PREVIEW;
  const visible = expanded || hidden <= 0 ? others : others.slice(0, PREVIEW);

  const names = visible.map(
    (o) =>
      `${o.staffFirstName} (${formatHour(o.startHour).replace(":00", "")}–${formatHour(o.endHour).replace(":00", "")})`,
  );

  return (
    <div className="mt-2 text-sm text-slate-600">
      <span className="font-medium text-slate-500">Also working: </span>
      {names.join(", ")}
      {hidden > 0 && !expanded && (
        <>
          {", "}
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="font-medium text-teal-700 underline-offset-2 hover:underline"
          >
            +{hidden} more
          </button>
        </>
      )}
      {hidden > 0 && expanded && (
        <>
          {" "}
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="font-medium text-slate-500 underline-offset-2 hover:underline"
          >
            show less
          </button>
        </>
      )}
    </div>
  );
}

function LastUpdatedLine({ iso }: { iso: string | null }) {
  if (!iso) {
    return (
      <p className="pt-1 text-center text-xs text-slate-400">
        Last schedule update not recorded.
      </p>
    );
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const label = sameDay
    ? `Today at ${time}`
    : d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }) + ` at ${time}`;
  return (
    <p className="pt-1 text-center text-xs text-slate-500">
      Schedule last updated: {label}
    </p>
  );
}
