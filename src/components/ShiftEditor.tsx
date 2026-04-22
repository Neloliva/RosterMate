"use client";

import { useEffect, useMemo, useState } from "react";
import { itemizeShiftCost } from "@/lib/award";
import type { DayCell } from "@/lib/date";
import {
  formatHour,
  hourToTimeString,
  timeStringToHour,
} from "@/lib/time";
import type { Shift, Staff } from "@/lib/types";

export type EditorState =
  | { mode: "create"; staff?: Staff; day?: number }
  | { mode: "edit"; shift: Shift; staff: Staff };

// If end ≤ start, assume the shift goes past midnight and add 24h.
function resolveEnd(startHour: number, endHour: number): number {
  return endHour <= startHour ? endHour + 24 : endHour;
}

export function ShiftEditor({
  state,
  days,
  staffList,
  holidays,
  onClose,
  onSave,
  onDelete,
}: {
  state: EditorState | null;
  days: DayCell[];
  staffList: Staff[];
  holidays?: Map<string, string>;
  onClose: () => void;
  onSave: (input: {
    id?: string;
    staffId: string;
    day: number;
    startHour: number;
    endHour: number;
  }) => void;
  onDelete: (id: string) => void;
}) {
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedDay, setSelectedDay] = useState(0);

  useEffect(() => {
    if (!state) return;
    if (state.mode === "edit") {
      setStartTime(hourToTimeString(state.shift.startHour));
      setEndTime(hourToTimeString(state.shift.endHour));
      setSelectedStaffId(state.staff.id);
      setSelectedDay(state.shift.day);
    } else {
      setStartTime("09:00");
      setEndTime("17:00");
      setSelectedStaffId(state.staff?.id ?? staffList[0]?.id ?? "");
      setSelectedDay(state.day ?? 0);
    }
  }, [state, staffList]);

  const startHour = timeStringToHour(startTime);
  const endHourRaw = timeStringToHour(endTime);
  const endHour = resolveEnd(startHour, endHourRaw);
  const overnight = endHourRaw <= startHour;
  const resolvedStaff = staffList.find((s) => s.id === selectedStaffId);
  const invalidTimes = endHour <= startHour;
  const invalid = invalidTimes || !resolvedStaff;
  const selectedDayIso = days[selectedDay]?.iso;
  const holidayName = selectedDayIso
    ? (holidays?.get(selectedDayIso) ?? null)
    : null;

  const breakdown = useMemo(() => {
    if (!state || invalid || !resolvedStaff) return null;
    return itemizeShiftCost(
      {
        id: "preview",
        staffId: resolvedStaff.id,
        day: selectedDay,
        startHour,
        endHour,
        cost: 0,
      },
      resolvedStaff,
    );
  }, [state, startHour, endHour, invalid, resolvedStaff, selectedDay]);

  if (!state) return null;

  const day = selectedDay;
  const editingMode = state.mode === "edit";

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
              {editingMode ? "Edit shift" : "Add shift"}
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">
              {resolvedStaff ? resolvedStaff.name : "Select a staff member"}
              {days[day] ? ` — ${days[day].name}, ${days[day].date}` : ""}
            </p>
            {holidayName && (
              <p className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                🎉 {holidayName} — public holiday
              </p>
            )}
            {!invalid && (
              <p className="mt-0.5 text-xs font-medium text-teal-600">
                {formatHour(startHour).toUpperCase()} –{" "}
                {formatHour(endHour).toUpperCase()}
                {overnight ? " (next day)" : ""}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {!editingMode && (
          <div className="mt-5 grid grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                Staff
              </span>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
              >
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.role}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                Day
              </span>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
              >
                {days.map((d, idx) => (
                  <option key={d.name} value={idx}>
                    {d.name} ({d.date})
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-4">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Start time
            </span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
            <span className="mt-1 block text-xs text-slate-500">
              {formatHour(startHour).toUpperCase()}
            </span>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              End time
            </span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
            <span className="mt-1 block text-xs text-slate-500">
              {formatHour(endHourRaw).toUpperCase()}
              {overnight ? " (next day)" : ""}
            </span>
          </label>
        </div>
        {invalidTimes && (
          <p className="mt-2 text-xs text-rose-500">
            End time must be after start time.
          </p>
        )}

        {breakdown && (
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              <span aria-hidden>💰</span>
              <span>Cost breakdown</span>
              <span className="ml-auto normal-case text-[10px] text-slate-400">
                {breakdown.hours}h worked{breakdown.breakMinutes > 0
                  ? ` · ${breakdown.breakMinutes}m break`
                  : ""}
              </span>
            </div>
            <dl className="mt-3 space-y-1.5 text-xs text-slate-700">
              {breakdown.lines.map((line) => (
                <div key={line.label} className="flex justify-between">
                  <dt>
                    <span className="font-medium text-slate-800">
                      {line.label}
                    </span>
                    <span className="ml-2 text-slate-500">{line.detail}</span>
                  </dt>
                  <dd className="font-semibold text-slate-900">
                    ${line.amount.toFixed(2)}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 flex items-baseline justify-between border-t border-slate-200 pt-3">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Total
              </span>
              <span className="text-2xl font-bold text-slate-900">
                ${breakdown.total}
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between text-[11px] text-slate-500">
              <span>Annual cost for this shift</span>
              <span className="font-semibold text-slate-700">
                ${(breakdown.total * 52).toLocaleString()}
                <span className="ml-1 font-normal text-slate-400">
                  (52 weeks)
                </span>
              </span>
            </div>
            {holidayName && (
              <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
                ⚠️ Public holiday ({holidayName}): cost above does <strong>not</strong>{" "}
                yet include the public-holiday multiplier — consult your award
                for the correct rate.
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <div>
            {editingMode && (
              <button
                onClick={() => onDelete(state.shift.id)}
                className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              disabled={invalid}
              onClick={() => {
                if (!resolvedStaff) return;
                onSave({
                  id: editingMode ? state.shift.id : undefined,
                  staffId: resolvedStaff.id,
                  day,
                  startHour,
                  endHour,
                });
              }}
              className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
