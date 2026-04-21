"use client";

import { useEffect, useState } from "react";
import type { Kpi } from "@/lib/types";

const STORAGE_KEY = "rostermate:hidden-kpis";

function trendClasses(trend: Kpi["trend"], label: string) {
  // "Total Labor Cost going up" is bad; everything else up can be neutral.
  if (trend === "flat") return "text-slate-500";
  if (label === "Total Labor Cost" && trend === "up") return "text-rose-500";
  if (label === "Avg Cost/Hour" && trend === "up") return "text-rose-500";
  return "text-teal-600";
}

function trendArrow(trend: Kpi["trend"]) {
  if (trend === "up") return "↗";
  if (trend === "down") return "↘";
  return "";
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  if (hidden) {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M17.94 17.94A10.05 10.05 0 0 1 12 20c-5 0-9.27-3.11-11-8a11.94 11.94 0 0 1 4-5.94" />
        <path d="M1 1l22 22" />
        <path d="M9.88 9.88A3 3 0 1 0 14.12 14.12" />
        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c5 0 9.27 3.11 11 8a11.9 11.9 0 0 1-1.67 2.68" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function KpiCards({ kpis }: { kpis: Kpi[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const ids = JSON.parse(raw) as string[];
        setHidden(new Set(ids));
      }
    } catch {
      // ignore malformed storage
    }
    setHydrated(true);
  }, []);

  function toggle(id: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // ignore quota errors
      }
      return next;
    });
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const isHidden = hydrated && kpi.sensitive && hidden.has(kpi.id);
          return (
            <div
              key={kpi.id}
              className="relative rounded-xl border border-slate-100 bg-slate-50/60 p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium text-slate-500">
                  {kpi.label}
                </div>
                {kpi.sensitive && (
                  <button
                    type="button"
                    onClick={() => toggle(kpi.id)}
                    aria-label={
                      isHidden ? `Show ${kpi.label}` : `Hide ${kpi.label}`
                    }
                    title={
                      isHidden ? `Show ${kpi.label}` : `Hide ${kpi.label}`
                    }
                    className="rounded-md p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                  >
                    <EyeIcon hidden={!!isHidden} />
                  </button>
                )}
              </div>
              <div className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
                {isHidden ? (
                  <span className="select-none tracking-[0.25em] text-slate-400">
                    ••••
                  </span>
                ) : (
                  kpi.value
                )}
              </div>
              <div
                className={`mt-2 text-xs font-medium ${
                  isHidden
                    ? "text-slate-400"
                    : trendClasses(kpi.trend, kpi.label)
                }`}
              >
                {isHidden ? (
                  <span className="select-none">• • • •</span>
                ) : (
                  <>
                    {trendArrow(kpi.trend)} {kpi.delta}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
