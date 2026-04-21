"use client";

import { useState, useTransition } from "react";
import { addStaff } from "@/app/actions";
import { initialsOf } from "@/lib/initials";
import { BUSINESS_TYPE, STAFF_DEFAULTS } from "@/lib/mock-data";
import { COMMON_ROLES, type EmploymentType } from "@/lib/types";

const EMPLOYMENT_OPTIONS: { value: EmploymentType; label: string }[] = [
  { value: "casual", label: "Casual" },
  { value: "part_time", label: "Part-time" },
  { value: "full_time", label: "Full-time" },
];

const BUSINESS_LABEL: Record<typeof BUSINESS_TYPE, string> = {
  cafe: "Cafe",
  retail: "Retail",
  hospitality: "Hospitality",
  healthcare: "Healthcare",
};

const defaults = STAFF_DEFAULTS[BUSINESS_TYPE];

export function StaffEditor({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState(defaults.role);
  const [employmentType, setEmploymentType] = useState<EmploymentType>(
    defaults.employmentType,
  );
  const [baseRate, setBaseRate] = useState(defaults.baseRate.toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  const nameTrimmed = name.trim();
  const rate = Number(baseRate);
  const invalid = !nameTrimmed || !(rate > 0);

  function reset() {
    setName("");
    setRole(defaults.role);
    setEmploymentType(defaults.employmentType);
    setBaseRate(defaults.baseRate.toFixed(2));
    setError(null);
  }

  function handleSave() {
    if (invalid) return;
    setError(null);
    startTransition(async () => {
      try {
        await addStaff({
          name: nameTrimmed,
          role,
          employmentType,
          baseRate: rate,
        });
        reset();
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add staff");
      }
    });
  }

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
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-900">
                Add staff member
              </h3>
              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-700">
                {BUSINESS_LABEL[BUSINESS_TYPE]} defaults
              </span>
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {nameTrimmed ? initialsOf(nameTrimmed) : "??"} — initials auto-generated
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

        <div className="mt-5 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Full name
            </span>
            <input
              type="text"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex Nguyen"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                Role
              </span>
              <input
                type="text"
                list="rostermate-roles"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
              <datalist id="rostermate-roles">
                {COMMON_ROLES.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                Employment
              </span>
              <select
                value={employmentType}
                onChange={(e) =>
                  setEmploymentType(e.target.value as EmploymentType)
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
              >
                {EMPLOYMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Base hourly rate
            </span>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">$</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={baseRate}
                onChange={(e) => setBaseRate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
              <span className="text-xs text-slate-500">/hr</span>
            </div>
            <span className="mt-1 block text-xs text-slate-500">
              Casual loading, penalty rates and breaks are applied automatically by the award engine.
            </span>
          </label>
        </div>

        {error && (
          <p className="mt-3 text-xs text-rose-500">{error}</p>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
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
            {pending ? "Saving…" : "Add staff"}
          </button>
        </div>
      </div>
    </div>
  );
}
