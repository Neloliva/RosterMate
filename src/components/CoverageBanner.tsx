"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import type { DayCoverage } from "@/lib/coverage";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CoverageBanner({
  coverage,
  scopeLabel,
}: {
  coverage: DayCoverage[];
  scopeLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const checked = coverage.filter((c) => c.hasRule);
  if (checked.length === 0) return null; // no rules → stay out of the way

  const met = checked.filter((c) => c.met).length;
  const allMet = met === checked.length;
  const none = met === 0;

  const badgeClass = allMet
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : none
      ? "bg-rose-50 text-rose-700 ring-rose-200"
      : "bg-amber-50 text-amber-800 ring-amber-200";
  const StatusIcon = allMet ? CheckCircle2 : none ? AlertTriangle : Circle;
  const statusIconClass = allMet
    ? "text-emerald-600"
    : none
      ? "text-rose-600"
      : "text-amber-600 fill-amber-500";
  const headline = allMet
    ? `All ${checked.length} checked day${checked.length === 1 ? "" : "s"} covered`
    : `${met}/${checked.length} day${checked.length === 1 ? "" : "s"} met`;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <button
        type="button"
        onClick={() => setExpanded((o) => !o)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${badgeClass}`}
          >
            <StatusIcon
              aria-hidden
              className={`h-3.5 w-3.5 ${statusIconClass}`}
            />
            Coverage
          </span>
          <span className="text-sm font-medium text-slate-700">
            {headline}
          </span>
          <span className="text-xs text-slate-500">· {scopeLabel}</span>
        </span>
        <span className="text-xs font-medium text-slate-500">
          {expanded ? "Hide" : "View per day"} {expanded ? "▴" : "▾"}
        </span>
      </button>

      {expanded && (
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {coverage.map((c) => (
            <li
              key={c.day}
              className={`rounded-lg border px-3 py-2 text-xs ${
                !c.hasRule
                  ? "border-slate-100 bg-slate-50 text-slate-400"
                  : c.met
                    ? "border-emerald-100 bg-emerald-50/70 text-emerald-800"
                    : "border-rose-100 bg-rose-50/70 text-rose-800"
              }`}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wide">
                {DAY_NAMES[c.day]}
              </div>
              {!c.hasRule ? (
                <div className="mt-0.5 text-[11px]">No check</div>
              ) : (
                <>
                  {c.required !== null && (
                    <div className="mt-0.5">
                      Staff {c.staffed}/{c.required}
                    </div>
                  )}
                  {c.roleRequired !== null && c.roleName && (
                    <div className="text-[11px]">
                      {c.roleName} {c.roleStaffed}/{c.roleRequired}
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
