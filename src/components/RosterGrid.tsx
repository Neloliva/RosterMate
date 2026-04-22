"use client";

import { useMemo, useState } from "react";
import { itemizeShiftCost, type PenaltyLevel } from "@/lib/award";
import type { DayCell } from "@/lib/date";
import { formatRange } from "@/lib/time";
import type { Shift, Staff } from "@/lib/types";

const levelStyles: Record<
  PenaltyLevel,
  { bg: string; hover: string; dot: string; label: string }
> = {
  standard: {
    bg: "bg-teal-400/90",
    hover: "hover:bg-teal-500",
    dot: "bg-emerald-300",
    label: "Standard rate",
  },
  elevated: {
    bg: "bg-amber-400",
    hover: "hover:bg-amber-500",
    dot: "bg-amber-200",
    label: "Weekend or night penalty",
  },
  high: {
    bg: "bg-rose-500",
    hover: "hover:bg-rose-600",
    dot: "bg-rose-200",
    label: "Weekend + night penalty",
  },
};

function ShiftCell({
  shift,
  level,
  onClick,
  onDragStart,
}: {
  shift: Shift;
  level: PenaltyLevel;
  onClick: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const style = levelStyles[level];
  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      title={style.label}
      className={`relative flex min-h-[56px] w-full cursor-grab flex-col items-center justify-center rounded-md px-2 py-1.5 text-center text-[11px] font-semibold text-white shadow-sm transition active:cursor-grabbing ${style.bg} ${style.hover}`}
    >
      <span
        className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ${style.dot}`}
        aria-hidden
      />
      <div className="leading-tight">
        {formatRange(shift.startHour, shift.endHour)}
      </div>
      <div className="text-[10px] font-medium text-white/90">${shift.cost}</div>
    </button>
  );
}

export function RosterGrid({
  days,
  staff,
  shifts,
  banner,
  holidays,
  onOpenCreate,
  onOpenEdit,
  onMoveShift,
}: {
  days: DayCell[];
  staff: Staff[];
  shifts: Shift[];
  banner?: React.ReactNode;
  holidays?: Map<string, string>;
  onOpenCreate: (person: Staff, day: number) => void;
  onOpenEdit: (shift: Shift) => void;
  onMoveShift: (shiftId: string, toStaffId: string, toDay: number) => void;
}) {
  const [dragOver, setDragOver] = useState<string | null>(null);

  const shiftIndex = useMemo(() => {
    const map = new Map<string, Shift>();
    for (const s of shifts) map.set(`${s.staffId}:${s.day}`, s);
    return map;
  }, [shifts]);

  const staffById = useMemo(
    () => new Map(staff.map((s) => [s.id, s])),
    [staff],
  );
  const levelByShiftId = useMemo(() => {
    const out = new Map<string, PenaltyLevel>();
    for (const s of shifts) {
      const person = staffById.get(s.staffId);
      if (!person) continue;
      out.set(s.id, itemizeShiftCost(s, person).level);
    }
    return out;
  }, [shifts, staffById]);

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Weekly Roster</h2>
        <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-teal-400" aria-hidden />
            Standard rate
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
            Penalty rate
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden />
            High penalty
          </span>
        </div>
      </div>

      {banner && <div className="mt-4">{banner}</div>}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[960px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-48 rounded-tl-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Staff
              </th>
              {days.map((d, idx) => {
                const holiday = holidays?.get(d.iso);
                return (
                  <th
                    key={d.name}
                    className={`border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-slate-700 ${
                      idx === days.length - 1 ? "rounded-tr-lg" : ""
                    } ${holiday ? "bg-rose-50" : ""}`}
                    title={holiday ? `${holiday} — public holiday` : undefined}
                  >
                    <div>{d.name}</div>
                    <div className="mt-0.5 text-[11px] font-normal text-slate-500">
                      {d.date}
                    </div>
                    {holiday && (
                      <div
                        className="mt-0.5 inline-flex max-w-full items-center gap-1 rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-semibold normal-case tracking-wide text-rose-700"
                        title={holiday}
                      >
                        <span aria-hidden>🎉</span>
                        <span className="truncate">{holiday}</span>
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {staff.map((person) => (
              <tr key={person.id}>
                <td className="sticky left-0 z-10 border border-slate-200 bg-white px-4 py-3 align-middle">
                  <div className="font-semibold text-slate-900">
                    {person.name}
                  </div>
                  <div className="text-xs text-slate-500">{person.role}</div>
                </td>
                {days.map((_, dayIdx) => {
                  const key = `${person.id}:${dayIdx}`;
                  const shift = shiftIndex.get(key);
                  const isDragTarget = dragOver === key;
                  return (
                    <td
                      key={dayIdx}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (dragOver !== key) setDragOver(key);
                      }}
                      onDragLeave={() => {
                        if (dragOver === key) setDragOver(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const shiftId = e.dataTransfer.getData("text/shift-id");
                        if (shiftId) {
                          onMoveShift(shiftId, person.id, dayIdx);
                          setDragOver(null);
                        }
                      }}
                      onClick={() => {
                        if (!shift) onOpenCreate(person, dayIdx);
                      }}
                      className={`border border-slate-200 p-1.5 align-middle transition ${
                        isDragTarget ? "bg-teal-50" : ""
                      } ${shift ? "" : "cursor-pointer hover:bg-slate-50"}`}
                    >
                      {shift ? (
                        <ShiftCell
                          shift={shift}
                          level={levelByShiftId.get(shift.id) ?? "standard"}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenEdit(shift);
                          }}
                          onDragStart={(e) => {
                            e.dataTransfer.setData(
                              "text/shift-id",
                              shift.id,
                            );
                            e.dataTransfer.effectAllowed = "move";
                          }}
                        />
                      ) : null}
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
