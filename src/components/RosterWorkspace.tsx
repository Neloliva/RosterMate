"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "./DashboardHeader";
import { KpiCards } from "./KpiCards";
import { MonthlyRoster } from "./MonthlyRoster";
import { QuickActions } from "./QuickActions";
import { RosterGrid } from "./RosterGrid";
import { OptimizePreviewModal } from "./OptimizePreviewModal";
import { ReportModal } from "./ReportModal";
import { SavingsBanner } from "./SavingsBanner";
import { ShiftEditor, type EditorState } from "./ShiftEditor";
import { SmartInsights } from "./SmartInsights";
import { StaffAvailability } from "./StaffAvailability";
import { StaffEditor } from "./StaffEditor";
import { SuggestionsModal } from "./SuggestionsModal";
import {
  copyLastMonth,
  copyLastWeek,
  deleteShift as deleteShiftAction,
  moveShift,
  upsertShift,
} from "@/app/actions";
import { computeShiftCost } from "@/lib/cost";
import {
  addDays,
  daysForWeek,
  formatWeekLabel,
  startOfWeek,
} from "@/lib/date";
import {
  computeInsights,
  computeMonthlyInsights,
} from "@/lib/insights";
import { computeKpis } from "@/lib/kpis";
import { computeStaffStats } from "@/lib/staff-stats";
import { computeSuggestions, type Suggestion } from "@/lib/optimize";
import type { Shift, Staff } from "@/lib/types";

type OptimisticAction =
  | { kind: "upsert"; shift: Shift }
  | { kind: "delete"; id: string }
  | {
      kind: "move";
      id: string;
      toStaffId: string;
      toDay: number;
      newCost: number;
    };

function applyOptimistic(prev: Shift[], action: OptimisticAction): Shift[] {
  if (action.kind === "delete") {
    return prev.filter((s) => s.id !== action.id);
  }
  if (action.kind === "upsert") {
    const next = action.shift;
    const cleared = prev.filter(
      (s) =>
        s.id === next.id ||
        !(s.staffId === next.staffId && s.day === next.day),
    );
    const exists = cleared.some((s) => s.id === next.id);
    return exists
      ? cleared.map((s) => (s.id === next.id ? next : s))
      : [...cleared, next];
  }
  const moving = prev.find((s) => s.id === action.id);
  if (!moving) return prev;
  const cleared = prev.filter(
    (s) =>
      s.id === action.id ||
      !(s.staffId === action.toStaffId && s.day === action.toDay),
  );
  return cleared.map((s) =>
    s.id === action.id
      ? {
          ...s,
          staffId: action.toStaffId,
          day: action.toDay,
          cost: action.newCost,
        }
      : s,
  );
}

export function RosterWorkspace({
  view,
  weekStart,
  staff,
  shifts,
  shiftsByWeek,
  priorWeekStarts,
}: {
  view: "week" | "month";
  weekStart: string;
  staff: Staff[];
  shifts: Shift[];
  shiftsByWeek: Record<string, Shift[]>;
  priorWeekStarts: string[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [optimisticShifts, applyAction] = useOptimistic(
    shifts,
    applyOptimistic,
  );
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [staffEditorOpen, setStaffEditorOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [optimizePreviewOpen, setOptimizePreviewOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [reportOpen, setReportOpen] = useState(false);
  const [undoSnapshot, setUndoSnapshot] = useState<{
    weekStart: string;
    previous: Shift[];
  } | null>(null);

  const staffById = useMemo(
    () => new Map(staff.map((s) => [s.id, s])),
    [staff],
  );
  const days = daysForWeek(weekStart);
  const MONTH_WEEKS = 4;
  const monthWeekStarts = useMemo(
    () =>
      Array.from({ length: MONTH_WEEKS }, (_, i) => addDays(weekStart, i * 7)),
    [weekStart],
  );
  const weekLabel = useMemo(() => {
    if (view === "week") return formatWeekLabel(weekStart);
    const firstWeek = daysForWeek(monthWeekStarts[0]);
    const lastWeek = daysForWeek(monthWeekStarts[MONTH_WEEKS - 1]);
    return `${firstWeek[0].date} – ${lastWeek[6].date}`;
  }, [view, weekStart, monthWeekStarts]);
  const suggestions = useMemo(
    () =>
      computeSuggestions(optimisticShifts, staff).filter(
        (s) => !dismissed.has(s.id),
      ),
    [optimisticShifts, staff, dismissed],
  );
  const totalSavings = suggestions.reduce((sum, s) => sum + s.savings, 0);
  const insights = useMemo(() => {
    if (view === "month") {
      const bundles = monthWeekStarts.map((ws) => ({
        weekStart: ws,
        shifts:
          ws === weekStart ? optimisticShifts : (shiftsByWeek[ws] ?? []),
      }));
      return computeMonthlyInsights(bundles, staff);
    }
    return computeInsights(optimisticShifts, staff);
  }, [view, monthWeekStarts, weekStart, optimisticShifts, shiftsByWeek, staff]);

  const staffStats = useMemo(() => {
    if (view === "month") {
      const all = monthWeekStarts.flatMap((ws) =>
        ws === weekStart ? optimisticShifts : (shiftsByWeek[ws] ?? []),
      );
      return computeStaffStats(staff, all, monthWeekStarts.length);
    }
    return computeStaffStats(staff, optimisticShifts, 1);
  }, [view, monthWeekStarts, weekStart, optimisticShifts, shiftsByWeek, staff]);
  const staffScopeLabel = view === "month" ? "avg / wk" : "this week";

  const kpis = useMemo(() => {
    const currentScope =
      view === "month"
        ? monthWeekStarts.flatMap((ws) =>
            ws === weekStart ? optimisticShifts : (shiftsByWeek[ws] ?? []),
          )
        : optimisticShifts;
    const priorScope = priorWeekStarts.flatMap(
      (ws) => shiftsByWeek[ws] ?? [],
    );
    const suffix =
      view === "month" ? "vs prior 4 weeks" : "vs last week";
    return computeKpis(currentScope, priorScope, suffix);
  }, [
    view,
    monthWeekStarts,
    weekStart,
    optimisticShifts,
    shiftsByWeek,
    priorWeekStarts,
  ]);

  function navigateTo(nextWeek: string, nextView?: "week" | "month") {
    setUndoSnapshot(null);
    const v = nextView ?? view;
    const qs =
      v === "month" ? `weekStart=${nextWeek}&view=month` : `weekStart=${nextWeek}`;
    startTransition(() => {
      router.push(`/?${qs}`);
    });
  }

  function navigateStep(direction: 1 | -1) {
    const step = view === "month" ? MONTH_WEEKS * 7 : 7;
    navigateTo(addDays(weekStart, direction * step));
  }

  function saveShift(input: {
    id?: string;
    staffId: string;
    day: number;
    startHour: number;
    endHour: number;
  }) {
    const person = staffById.get(input.staffId);
    if (!person) return;
    const tempId = input.id ?? `tmp_${Date.now()}`;
    const optimisticShift: Shift = {
      id: tempId,
      staffId: input.staffId,
      day: input.day,
      startHour: input.startHour,
      endHour: input.endHour,
      cost: computeShiftCost(
        {
          id: tempId,
          staffId: input.staffId,
          day: input.day,
          startHour: input.startHour,
          endHour: input.endHour,
          cost: 0,
        },
        person,
      ),
    };
    setUndoSnapshot(null);
    startTransition(async () => {
      applyAction({ kind: "upsert", shift: optimisticShift });
      await upsertShift({ ...input, weekStart });
    });
    setEditor(null);
  }

  function deleteShift(id: string) {
    setUndoSnapshot(null);
    startTransition(async () => {
      applyAction({ kind: "delete", id });
      await deleteShiftAction(id);
    });
    setEditor(null);
  }

  async function optimizeAll(): Promise<{
    applied: number;
    skipped: number;
    totalSavings: number;
  }> {
    if (suggestions.length === 0) {
      return { applied: 0, skipped: 0, totalSavings: 0 };
    }

    // Track which cells are occupied by shifts NOT being moved in this batch.
    // Their target cell is already taken and must be preserved.
    const movingIds = new Set(suggestions.map((s) => s.shiftId));
    const occupied = new Set<string>();
    for (const shift of optimisticShifts) {
      if (!movingIds.has(shift.id)) {
        occupied.add(`${shift.staffId}:${shift.day}`);
      }
    }

    const toApply: {
      suggestion: Suggestion;
      previous: Shift;
      updated: Shift;
    }[] = [];
    let skipped = 0;
    for (const suggestion of suggestions) {
      const shift = optimisticShifts.find((x) => x.id === suggestion.shiftId);
      if (!shift) {
        skipped += 1;
        continue;
      }
      const targetCell = `${shift.staffId}:${suggestion.proposed.day}`;
      if (occupied.has(targetCell)) {
        skipped += 1;
        continue;
      }
      occupied.add(targetCell);
      toApply.push({
        suggestion,
        previous: { ...shift },
        updated: {
          ...shift,
          day: suggestion.proposed.day,
          startHour: suggestion.proposed.startHour,
          endHour: suggestion.proposed.endHour,
          cost: suggestion.proposed.cost,
        },
      });
    }

    if (toApply.length === 0) {
      return { applied: 0, skipped, totalSavings: 0 };
    }

    setDismissed((prev) => {
      const next = new Set(prev);
      for (const { suggestion } of toApply) next.add(suggestion.id);
      return next;
    });
    setUndoSnapshot({
      weekStart,
      previous: toApply.map((a) => a.previous),
    });

    startTransition(async () => {
      for (const { updated } of toApply) {
        applyAction({ kind: "upsert", shift: updated });
      }
      await Promise.all(
        toApply.map(({ suggestion, updated }) =>
          upsertShift({
            id: updated.id,
            weekStart,
            staffId: updated.staffId,
            day: suggestion.proposed.day,
            startHour: suggestion.proposed.startHour,
            endHour: suggestion.proposed.endHour,
          }),
        ),
      );
    });

    return {
      applied: toApply.length,
      skipped,
      totalSavings: toApply.reduce((sum, { suggestion }) => sum + suggestion.savings, 0),
    };
  }

  async function undoLastOptimize(): Promise<number> {
    if (!undoSnapshot || undoSnapshot.weekStart !== weekStart) return 0;
    const previous = undoSnapshot.previous;
    setUndoSnapshot(null);
    startTransition(async () => {
      for (const shift of previous) {
        applyAction({ kind: "upsert", shift });
      }
      await Promise.all(
        previous.map((shift) =>
          upsertShift({
            id: shift.id,
            weekStart,
            staffId: shift.staffId,
            day: shift.day,
            startHour: shift.startHour,
            endHour: shift.endHour,
          }),
        ),
      );
    });
    return previous.length;
  }

  function acceptSuggestion(s: Suggestion) {
    const shift = optimisticShifts.find((x) => x.id === s.shiftId);
    if (!shift) return;
    const person = staffById.get(shift.staffId);
    if (!person) return;
    const updated: Shift = {
      ...shift,
      day: s.proposed.day,
      startHour: s.proposed.startHour,
      endHour: s.proposed.endHour,
      cost: s.proposed.cost,
    };
    setDismissed((prev) => new Set(prev).add(s.id));
    setUndoSnapshot(null);
    startTransition(async () => {
      applyAction({ kind: "upsert", shift: updated });
      await upsertShift({
        id: shift.id,
        weekStart,
        staffId: shift.staffId,
        day: s.proposed.day,
        startHour: s.proposed.startHour,
        endHour: s.proposed.endHour,
      });
    });
  }

  function handleMove(shiftId: string, toStaffId: string, toDay: number) {
    const shift = optimisticShifts.find((s) => s.id === shiftId);
    if (!shift) return;
    if (shift.staffId === toStaffId && shift.day === toDay) return;
    const person = staffById.get(toStaffId);
    if (!person) return;
    const newCost = computeShiftCost(
      { ...shift, staffId: toStaffId, day: toDay },
      person,
    );
    setUndoSnapshot(null);
    startTransition(async () => {
      applyAction({
        kind: "move",
        id: shiftId,
        toStaffId,
        toDay,
        newCost,
      });
      await moveShift({ id: shiftId, weekStart, toStaffId, toDay });
    });
  }

  return (
    <div className="space-y-5">
      <DashboardHeader
        weekLabel={weekLabel}
        view={view}
        onChangeView={(next) => navigateTo(weekStart, next)}
        onPrev={() => navigateStep(-1)}
        onNext={() => navigateStep(1)}
        onToday={() => navigateTo(startOfWeek(new Date()))}
      />
      <KpiCards kpis={kpis} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {view === "week" ? (
          <RosterGrid
            days={days}
            staff={staff}
            shifts={optimisticShifts}
            banner={
              <SavingsBanner
                totalSavings={totalSavings}
                opportunities={suggestions.length}
                onView={() => setSuggestionsOpen(true)}
              />
            }
            onOpenCreate={(person, day) =>
              setEditor({ mode: "create", staff: person, day })
            }
            onOpenEdit={(shift) => {
              const person = staffById.get(shift.staffId);
              if (person) setEditor({ mode: "edit", shift, staff: person });
            }}
            onMoveShift={handleMove}
          />
        ) : (
          <MonthlyRoster
            weekStarts={monthWeekStarts}
            shiftsByWeek={shiftsByWeek}
            staff={staff}
            onOpenWeek={(ws) => navigateTo(ws, "week")}
          />
        )}
        <aside className="space-y-5">
          <StaffAvailability staff={staffStats} scopeLabel={staffScopeLabel} />
          <QuickActions
            onAddShift={() => setEditor({ mode: "create" })}
            onAddStaff={() => setStaffEditorOpen(true)}
            onCopyLastWeek={async () => {
              setUndoSnapshot(null);
              return copyLastWeek(weekStart);
            }}
            onCopyLastMonth={async () => {
              setUndoSnapshot(null);
              return copyLastMonth(weekStart);
            }}
            onGenerateReport={() => setReportOpen(true)}
            onPreviewOptimize={() => setOptimizePreviewOpen(true)}
            canUndoOptimize={
              !!undoSnapshot && undoSnapshot.weekStart === weekStart
            }
            onUndoLastOptimize={undoLastOptimize}
          />
          <SmartInsights insights={insights} />
        </aside>
      </div>

      <ShiftEditor
        state={editor}
        days={days}
        staffList={staff}
        onClose={() => setEditor(null)}
        onSave={saveShift}
        onDelete={deleteShift}
      />
      <StaffEditor
        open={staffEditorOpen}
        onClose={() => setStaffEditorOpen(false)}
      />
      <SuggestionsModal
        open={suggestionsOpen}
        suggestions={suggestions}
        currentWeeklyCost={optimisticShifts.reduce(
          (sum, s) => sum + s.cost,
          0,
        )}
        onAccept={acceptSuggestion}
        onDismiss={(id) =>
          setDismissed((prev) => new Set(prev).add(id))
        }
        onClose={() => setSuggestionsOpen(false)}
      />
      <OptimizePreviewModal
        open={optimizePreviewOpen}
        shifts={optimisticShifts}
        staff={staff}
        days={days}
        suggestions={suggestions}
        currentWeeklyCost={optimisticShifts.reduce(
          (sum, s) => sum + s.cost,
          0,
        )}
        onApplyAll={optimizeAll}
        onClose={() => setOptimizePreviewOpen(false)}
      />
      <ReportModal
        open={reportOpen}
        weekStart={weekStart}
        weekLabel={
          view === "week" ? weekLabel : formatWeekLabel(weekStart)
        }
        days={days}
        staff={staff}
        shifts={optimisticShifts}
        priorShifts={
          shiftsByWeek[addDays(weekStart, -7)] ?? []
        }
        suggestions={suggestions}
        onClose={() => setReportOpen(false)}
      />
    </div>
  );
}
