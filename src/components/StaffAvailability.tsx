import type { AvailabilityStatus } from "@/lib/types";
import type { StaffStats } from "@/lib/staff-stats";

const dotColor: Record<AvailabilityStatus, string> = {
  available: "bg-emerald-500",
  limited: "bg-amber-400",
  unavailable: "bg-rose-500",
};

export function StaffAvailability({
  staff,
  scopeLabel,
  onEditStaff,
}: {
  staff: StaffStats[];
  scopeLabel: string;
  onEditStaff?: (staffId: string) => void;
}) {
  const clickable = Boolean(onEditStaff);
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <h3 className="text-base font-semibold text-slate-900">
        Staff Availability
      </h3>
      <ul className="mt-4 space-y-3">
        {staff.map((person) => {
          const rowInner = (
            <>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-700">
                {person.initials}
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-semibold text-slate-900">
                  {person.name}
                </div>
                <div className="text-xs text-slate-500">
                  {person.weeklyHours} hrs {scopeLabel}
                </div>
              </div>
              <span
                className={`h-2.5 w-2.5 rounded-full ${dotColor[person.status]}`}
                title={person.statusLabel}
                aria-label={person.statusLabel}
              />
            </>
          );
          return (
            <li key={person.id}>
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onEditStaff?.(person.id)}
                  title={`Edit ${person.name}`}
                  className="flex w-full items-center gap-3 rounded-md -mx-1 px-1 py-0.5 text-left transition hover:bg-slate-50"
                >
                  {rowInner}
                </button>
              ) : (
                <div className="flex items-center gap-3">{rowInner}</div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-[10px] font-medium text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
          Healthy
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
          Watch
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden />
          Overtime / unscheduled
        </span>
      </div>
    </div>
  );
}
