"use client";

import { useMemo, useState } from "react";
import { itemizeShiftCost, type PenaltyLevel } from "@/lib/award";
import type { DayCell } from "@/lib/date";
import { formatRange } from "@/lib/time";
import type { Shift, Staff } from "@/lib/types";
import { ConfirmDialog } from "./ConfirmDialog";

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
  interactive = true,
  onClick,
  onDragStart,
}: {
  shift: Shift;
  level: PenaltyLevel;
  interactive?: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const style = levelStyles[level];
  const cursor = interactive
    ? "cursor-grab active:cursor-grabbing"
    : "cursor-default";
  const hover = interactive ? style.hover : "";
  const tip = interactive
    ? style.label
    : `${style.label} · removed staff (read-only)`;
  return (
    <button
      type="button"
      draggable={interactive}
      onDragStart={onDragStart}
      onClick={onClick}
      title={tip}
      className={`relative flex min-h-[56px] w-full ${cursor} flex-col items-center justify-center rounded-md px-2 py-1.5 text-center text-[11px] font-semibold text-white shadow-sm transition ${style.bg} ${hover}`}
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
  onEditStaff,
}: {
  days: DayCell[];
  staff: Staff[];
  shifts: Shift[];
  banner?: React.ReactNode;
  holidays?: Map<string, string>;
  onOpenCreate: (person: Staff, day: number) => void;
  onOpenEdit: (shift: Shift) => void;
  onMoveShift: (shiftId: string, toStaffId: string, toDay: number) => void;
  onEditStaff?: (staffId: string) => void;
}) {
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [pendingReplace, setPendingReplace] = useState<{
    shiftId: string;
    toStaff: Staff;
    toDay: number;
    existing: Shift;
  } | null>(null);

  const shiftIndex = useMemo(() => {
    const map = new Map<string, Shift>();
    for (const s of shifts) map.set(`${s.staffId}:${s.day}`, s);
    return map;
  }, [shifts]);

  const staffById = useMemo(
    () => new Map(staff.map((s) => [s.id, s])),
    [staff],
  );

  // Inactive staff only appear as rows if they have at least one shift in
  // the visible scope (historical record). Active staff always appear.
  const visibleStaff = useMemo(() => {
    const staffIdsWithShifts = new Set(shifts.map((s) => s.staffId));
    return staff.filter(
      (s) => s.isActive !== false || staffIdsWithShifts.has(s.id),
    );
  }, [staff, shifts]);
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
            {visibleStaff.map((person) => {
              const isInactive = person.isActive === false;
              return (
                <tr key={person.id} className={isInactive ? "opacity-60" : ""}>
                  <td className="sticky left-0 z-10 border border-slate-200 bg-white px-0 py-0 align-middle">
                    {onEditStaff && !isInactive ? (
                      <button
                        type="button"
                        onClick={() => onEditStaff(person.id)}
                        title={`Edit ${person.name}`}
                        className="block w-full px-4 py-3 text-left transition hover:bg-slate-50"
                      >
                        <div className="font-semibold text-slate-900">
                          {person.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {person.role}
                        </div>
                      </button>
                    ) : (
                      <div
                        className="px-4 py-3"
                        title={
                          isInactive
                            ? "Removed staff — historical record, read-only"
                            : undefined
                        }
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900">
                            {person.name}
                          </span>
                          {isInactive && (
                            <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                              Removed
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">
                          {person.role}
                        </div>
                      </div>
                    )}
                  </td>
                  {days.map((_, dayIdx) => {
                    const key = `${person.id}:${dayIdx}`;
                    const shift = shiftIndex.get(key);
                    const isDragTarget = !isInactive && dragOver === key;
                    return (
                      <td
                        key={dayIdx}
                        onDragOver={(e) => {
                          if (isInactive) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (dragOver !== key) setDragOver(key);
                        }}
                        onDragLeave={() => {
                          if (dragOver === key) setDragOver(null);
                        }}
                        onDrop={(e) => {
                          if (isInactive) return;
                          e.preventDefault();
                          const shiftId =
                            e.dataTransfer.getData("text/shift-id");
                          if (!shiftId) return;
                          setDragOver(null);
                          const existing = shiftIndex.get(key);
                          if (existing && existing.id !== shiftId) {
                            setPendingReplace({
                              shiftId,
                              toStaff: person,
                              toDay: dayIdx,
                              existing,
                            });
                            return;
                          }
                          onMoveShift(shiftId, person.id, dayIdx);
                        }}
                        onClick={() => {
                          if (isInactive) return;
                          if (!shift) onOpenCreate(person, dayIdx);
                        }}
                        className={`border border-slate-200 p-1.5 align-middle transition ${
                          isDragTarget ? "bg-teal-50" : ""
                        } ${
                          !shift && !isInactive
                            ? "cursor-pointer hover:bg-slate-50"
                            : ""
                        }`}
                      >
                        {shift ? (
                          <ShiftCell
                            shift={shift}
                            level={levelByShiftId.get(shift.id) ?? "standard"}
                            interactive={!isInactive}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isInactive) onOpenEdit(shift);
                            }}
                            onDragStart={(e) => {
                              if (isInactive) {
                                e.preventDefault();
                                return;
                              }
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
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!pendingReplace}
        title="Replace existing shift?"
        message={
          pendingReplace ? (
            <>
              {pendingReplace.toStaff.name} already has a shift on{" "}
              {days[pendingReplace.toDay]?.name ?? "this day"}{" "}
              <span className="whitespace-nowrap">
                ({formatRange(
                  pendingReplace.existing.startHour,
                  pendingReplace.existing.endHour,
                )})
              </span>
              . Dropping here removes that shift.
            </>
          ) : null
        }
        confirmLabel="Replace shift"
        destructive
        onConfirm={() => {
          if (!pendingReplace) return;
          onMoveShift(
            pendingReplace.shiftId,
            pendingReplace.toStaff.id,
            pendingReplace.toDay,
          );
          setPendingReplace(null);
        }}
        onCancel={() => setPendingReplace(null)}
      />
    </div>
  );
}
