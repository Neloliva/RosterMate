"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  submitSwapRequest,
  submitUnavailable,
} from "@/app/staff/[token]/actions";
import type { DayCell } from "@/lib/date";
import { formatHour, formatRange } from "@/lib/time";
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
  type: "swap" | "unavailable";
  status: "approved" | "declined";
  weekStart: string | null;
  day: number | null;
  reason: string | null;
  resolvedAt: string;
};

type MyRequest = {
  id: string;
  type: "swap" | "unavailable";
  status: "pending" | "approved" | "declined";
  weekStart: string | null;
  day: number | null;
  note: string | null;
  reason: string | null;
  createdAt: string;
  resolvedAt: string | null;
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
    { type: "swap" | "unavailable"; reason: string | null; resolvedAt: string }
  >;
  recentResolutions: RecentResolution[];
  myRequests: MyRequest[];
  contactPhone: string | null;
  contactEmail: string | null;
  lastUpdatedAt: string | null;
  nowHour: number;
}) {
  const [swapShift, setSwapShift] = useState<Shift | null>(null);
  const [unavailableCell, setUnavailableCell] = useState<{
    weekStart: string;
    day: number;
  } | null>(null);
  const [swapNote, setSwapNote] = useState("");
  const [unavailableNote, setUnavailableNote] = useState("");
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
    const shift = swapShift;
    const note = swapNote;
    startActionTransition(async () => {
      try {
        await submitSwapRequest({
          token,
          shiftId: shift.id,
          note,
        });
        setActionStatus(
          "Swap request sent. Your manager will see it in the dashboard.",
        );
      } catch (e) {
        setActionStatus(
          e instanceof Error ? e.message : "Couldn't submit request",
        );
      } finally {
        setSwapShift(null);
        setSwapNote("");
      }
    });
  }

  function confirmUnavailable() {
    if (!unavailableCell) return;
    const cell = unavailableCell;
    const note = unavailableNote;
    startActionTransition(async () => {
      try {
        await submitUnavailable({
          token,
          weekStart: cell.weekStart,
          day: cell.day,
          note,
        });
        setActionStatus("Time off request sent to your manager.");
      } catch (e) {
        setActionStatus(
          e instanceof Error ? e.message : "Couldn't submit request",
        );
      } finally {
        setUnavailableCell(null);
        setUnavailableNote("");
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
                        onClick={() => setSwapShift(shift!)}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        🔄 Request swap
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
                        ⚠️ Can&apos;t work
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

      <MyRequestsCard requests={myRequests} daysByWeek={daysByWeek} />

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
        title="Request a shift swap?"
        message={
          <div className="space-y-3">
            {swapShift && (
              <div className="text-sm text-slate-600">
                Shift:{" "}
                <span className="font-semibold text-slate-800">
                  {formatRange(swapShift.startHour, swapShift.endHour)}
                </span>
              </div>
            )}
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Optional note for your manager
              </span>
              <textarea
                value={swapNote}
                onChange={(e) => setSwapNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Who are you hoping to swap with?"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </label>
          </div>
        }
        confirmLabel="Send request"
        pending={actionPending}
        onConfirm={confirmSwap}
        onCancel={() => {
          setSwapShift(null);
          setSwapNote("");
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
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Optional reason
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
          </div>
        }
        confirmLabel="Send request"
        pending={actionPending}
        onConfirm={confirmUnavailable}
        onCancel={() => {
          setUnavailableCell(null);
          setUnavailableNote("");
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
          📞 Call manager
        </a>
      )}
      {contactEmail && (
        <a
          href={`mailto:${contactEmail}`}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          ✉️ Email manager
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

function MyRequestsCard({
  requests,
  daysByWeek,
}: {
  requests: MyRequest[];
  daysByWeek: Record<string, DayCell[]>;
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
          <MyRequestRow key={req.id} req={req} daysByWeek={daysByWeek} />
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
}: {
  req: MyRequest;
  daysByWeek: Record<string, DayCell[]>;
}) {
  const typeLabel = req.type === "swap" ? "Swap" : "Time off";
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
          icon: "●",
          label: "Pending",
        }
      : req.status === "approved"
        ? {
            class: "bg-emerald-100 text-emerald-800",
            icon: "✓",
            label: "Approved",
          }
        : {
            class: "bg-slate-200 text-slate-700",
            icon: "✕",
            label: "Declined",
          };

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
          <span aria-hidden>{chip.icon}</span>
          {chip.label}
        </span>
      </div>
      <div className="mt-1 text-xs text-slate-500">{activityLabel}</div>
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
  const typeLabel = update.type === "swap" ? "Swap" : "Time off";
  const cell =
    update.weekStart && typeof update.day === "number"
      ? daysByWeek[update.weekStart]?.[update.day]
      : null;
  const dayPart = cell ? ` — ${cell.name}, ${cell.date}` : "";

  const wrapperClass = approved
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : "border-slate-200 bg-slate-50 text-slate-800";
  const iconChar = approved ? "✓" : "✕";

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-xl border p-3 ${wrapperClass}`}
      role="status"
    >
      <div className="flex-1 text-sm">
        <div className="font-semibold">
          <span className="mr-1" aria-hidden>
            {iconChar}
          </span>
          {typeLabel} request {approved ? "approved" : "declined"}
          {dayPart}
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

function DeclinedChip({
  type,
  reason,
}: {
  type: "swap" | "unavailable";
  reason: string | null;
}) {
  const label = type === "swap" ? "Swap declined" : "Time off declined";
  return (
    <span
      className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
      title={reason ?? undefined}
    >
      ✕ {label}
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
