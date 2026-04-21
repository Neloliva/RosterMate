"use client";

import { useEffect, useState, useTransition } from "react";
import { updateBusinessSettings } from "@/app/actions";
import {
  BUSINESS_TYPES,
  INDUSTRY_SETTINGS_DEFAULTS,
  type BusinessType,
} from "@/lib/mock-data";
import type { BusinessSettings } from "@/lib/types";

function resolveBusinessType(value: string): BusinessType {
  const match = BUSINESS_TYPES.find((b) => b.id === value);
  return (match?.id ?? "cafe") as BusinessType;
}

export function BusinessSettingsModal({
  open,
  settings,
  onClose,
}: {
  open: boolean;
  settings: BusinessSettings;
  onClose: () => void;
}) {
  const [name, setName] = useState(settings.businessName);
  const [type, setType] = useState<string>(settings.businessType);
  const [penaltyTarget, setPenaltyTarget] = useState(
    settings.penaltyTargetPct.toString(),
  );
  const [overtime, setOvertime] = useState(settings.overtimeHours.toString());
  const [defaultView, setDefaultView] = useState<"week" | "month">(
    settings.defaultView,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setName(settings.businessName);
      setType(settings.businessType);
      setPenaltyTarget(settings.penaltyTargetPct.toString());
      setOvertime(settings.overtimeHours.toString());
      setDefaultView(settings.defaultView);
      setError(null);
    }
  }, [open, settings]);

  if (!open) return null;

  const resolvedType = resolveBusinessType(type);
  const industryDefault = INDUSTRY_SETTINGS_DEFAULTS[resolvedType];

  function handleIndustryChange(nextId: string) {
    const next = resolveBusinessType(nextId);
    const d = INDUSTRY_SETTINGS_DEFAULTS[next];
    setType(next);
    setPenaltyTarget(d.penaltyTargetPct.toString());
    setOvertime(d.overtimeHours.toString());
    setDefaultView(d.defaultView);
  }

  const penaltyNum = Number(penaltyTarget);
  const overtimeNum = Number(overtime);
  const nameTrimmed = name.trim();
  const invalid =
    !nameTrimmed ||
    !(penaltyNum >= 0 && penaltyNum <= 100) ||
    !Number.isInteger(overtimeNum) ||
    overtimeNum < 1;

  function handleSave() {
    if (invalid) return;
    setError(null);
    startTransition(async () => {
      try {
        await updateBusinessSettings({
          businessName: nameTrimmed,
          businessType: type,
          penaltyTargetPct: penaltyNum,
          overtimeHours: overtimeNum,
          defaultView,
        });
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save settings");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 p-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Business settings
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">
              These values drive the dashboard defaults, insights, and report
              thresholds.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Business name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Industry
            </span>
            <select
              value={type}
              onChange={(e) => handleIndustryChange(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
            >
              {BUSINESS_TYPES.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              Drives the default role catalog in Add Staff. Changing this also
              resets the other fields below to sensible defaults for that
              industry.
            </span>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                Penalty target %
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={penaltyTarget}
                  onChange={(e) => setPenaltyTarget(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
                <span className="text-slate-500">%</span>
              </div>
              <span className="mt-1 block text-[11px] text-slate-500">
                Typical range 10–25%. This industry&apos;s default: {industryDefault.penaltyTargetPct}%.
              </span>
              {penaltyNum > 40 && (
                <span className="mt-1 block rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                  ⚠️ Very high — most of your roster may be weekend or night
                  shifts.
                </span>
              )}
              {penaltyNum >= 0 && penaltyNum < 5 && (
                <span className="mt-1 block rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                  ⚠️ Very low — any weekend or night shifts will exceed this.
                </span>
              )}
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                Overtime after
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={80}
                  step={1}
                  value={overtime}
                  onChange={(e) => setOvertime(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
                <span className="text-slate-500">hrs/wk</span>
              </div>
              <span className="mt-1 block text-[11px] text-slate-500">
                Standard full-time is 38h; some awards use 40h. This industry&apos;s
                default: {industryDefault.overtimeHours}h.
              </span>
              {overtimeNum > 45 && (
                <span className="mt-1 block rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                  ⚠️ Exceeds typical full-time limits — verify against your
                  award.
                </span>
              )}
              {overtimeNum > 0 && overtimeNum < 20 && (
                <span className="mt-1 block rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                  ⚠️ Low threshold — insights will flag most staff as overtime.
                </span>
              )}
            </label>
          </div>

          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Default roster view
            </span>
            <div className="flex gap-2">
              {(["week", "month"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setDefaultView(v)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition ${
                    defaultView === v
                      ? "border-teal-400 bg-teal-50 text-teal-700 ring-2 ring-teal-100"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <span className="mt-1 block text-[11px] text-slate-500">
              Applied when no view is set in the URL.
            </span>
          </div>

          {error && <p className="text-xs text-rose-500">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            disabled={invalid || pending}
            onClick={handleSave}
            className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
