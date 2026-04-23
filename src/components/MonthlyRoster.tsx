"use client";

import { useMemo } from "react";
import { itemizeShiftCost, type PenaltyLevel } from "@/lib/award";
import { addDays, daysForWeek } from "@/lib/date";
import { formatHour } from "@/lib/time";
import type { Shift, Staff } from "@/lib/types";

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const levelPill: Record<PenaltyLevel, string> = {
  standard: "bg-teal-400/90 text-white",
  elevated: "bg-amber-400 text-white",
  high: "bg-rose-500 text-white",
};

type DayShift = Shift & { staff: Staff; level: PenaltyLevel };

export function MonthlyRoster({
  weekStarts,
  shiftsByWeek,
  staff,
  holidays,
  todayIso,
  onOpenWeek,
}: {
  weekStarts: string[];
  shiftsByWeek: Record<string, Shift[]>;
  staff: Staff[];
  holidays?: Map<string, string>;
  todayIso?: string;
  onOpenWeek: (weekStart: string) => void;
}) {
  const staffById = useMemo(
    () => new Map(staff.map((s) => [s.id, s])),
    [staff],
  );

  const rows = useMemo(() => {
    return weekStarts.map((ws) => {
      const dayCells = daysForWeek(ws);
      const dayDates = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
      const shifts = shiftsByWeek[ws] ?? [];
      const byDay: DayShift[][] = Array.from({ length: 7 }, () => []);
      for (const shift of shifts) {
        const person = staffById.get(shift.staffId);
        if (!person) continue;
        byDay[shift.day].push({
          ...shift,
          staff: person,
          level: itemizeShiftCost(shift, person).level,
        });
      }
      for (const list of byDay) {
        list.sort((a, b) => a.startHour - b.startHour);
      }
      const totalCost = shifts.reduce((sum, s) => sum + s.cost, 0);
      return {
        weekStart: ws,
        dayCells,
        dayDates,
        byDay,
        totalCost,
        shiftCount: shifts.length,
      };
    });
  }, [weekStarts, shiftsByWeek, staffById]);

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Monthly Roster
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Read-only overview. Click any day to edit that week.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-teal-400" aria-hidden />
            Standard
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
            Penalty
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden />
            High
          </span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[960px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="w-36 rounded-tl-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Week
              </th>
              {DAY_NAMES.map((name, idx) => (
                <th
                  key={name}
                  className={`border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-slate-700 ${
                    idx === DAY_NAMES.length - 1 ? "rounded-tr-lg" : ""
                  }`}
                >
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.weekStart}>
                <td className="border border-slate-200 bg-white px-3 py-3 align-top">
                  <button
                    onClick={() => onOpenWeek(row.weekStart)}
                    className="text-left"
                  >
                    <div className="text-sm font-semibold text-slate-900 hover:text-teal-600">
                      {row.dayCells[0].date} – {row.dayCells[6].date}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {row.shiftCount} shift{row.shiftCount === 1 ? "" : "s"}{" "}
                      · ${Math.round(row.totalCost).toLocaleString()}
                    </div>
                    <div className="mt-1 text-[11px] font-medium text-teal-600">
                      Open week →
                    </div>
                  </button>
                </td>
                {row.byDay.map((shifts, dayIdx) => {
                  const dayIso = row.dayCells[dayIdx].iso;
                  const holiday = holidays?.get(dayIso);
                  const past = Boolean(todayIso && dayIso < todayIso);
                  return (
                    <td
                      key={dayIdx}
                      onClick={() => onOpenWeek(row.weekStart)}
                      className={`cursor-pointer border border-slate-200 p-2 align-top transition hover:bg-slate-50 ${holiday ? "bg-rose-50/60" : ""} ${past ? "opacity-60" : ""}`}
                      title={
                        past
                          ? `${holiday ? holiday + " · " : ""}In the past`
                          : holiday
                            ? `${holiday} — public holiday`
                            : undefined
                      }
                    >
                      <div className="mb-1 flex items-center justify-between gap-1">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                          {row.dayCells[dayIdx].date}
                        </span>
                        {holiday && (
                          <span
                            className="rounded-full bg-rose-100 px-1.5 py-0 text-[9px] font-semibold text-rose-700"
                            title={holiday}
                          >
                            🎉
                          </span>
                        )}
                      </div>
                    <div className="space-y-1">
                      {shifts.length === 0 && (
                        <div className="text-[11px] text-slate-300">—</div>
                      )}
                      {shifts.map((s) => (
                        <div
                          key={s.id}
                          title={`${s.staff.name} — ${formatHour(s.startHour)}–${formatHour(s.endHour)} · $${s.cost}`}
                          className={`flex items-center justify-between gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${levelPill[s.level]}`}
                        >
                          <span>{s.staff.initials}</span>
                          <span className="font-normal">
                            {formatHour(s.startHour).replace(":00", "")}–
                            {formatHour(s.endHour).replace(":00", "")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
