"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { addStaff, deleteStaff, updateStaff } from "@/app/actions";
import { initialsOf } from "@/lib/initials";
import {
  BUSINESS_TYPE,
  BUSINESS_TYPES,
  EMPLOYMENT_TYPE_OPTIONS,
  QUALIFICATIONS,
  ROLE_CATALOG,
  STAFF_DEFAULTS,
  type BusinessType,
} from "@/lib/mock-data";
import type { EmploymentType, Staff } from "@/lib/types";
import { ConfirmDialog } from "./ConfirmDialog";

const CUSTOM_ROLE_VALUE = "__custom__";

function resolveBusinessType(value: string): BusinessType {
  const match = BUSINESS_TYPES.find((b) => b.id === value);
  return (match?.id ?? BUSINESS_TYPE) as BusinessType;
}

export function StaffEditor({
  open,
  onClose,
  businessType: businessTypeProp,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  businessType: string;
  editing?: Staff | null;
}) {
  const businessType = resolveBusinessType(businessTypeProp);
  const defaults = STAFF_DEFAULTS[businessType];
  const roleOptions = ROLE_CATALOG[businessType];
  const mode: "create" | "edit" = editing ? "edit" : "create";
  const editingId = editing?.id ?? null;

  const [name, setName] = useState("");
  const [roleMode, setRoleMode] = useState<"preset" | "custom">("preset");
  const [selectedRole, setSelectedRole] = useState<string>(defaults.role);
  const [customRole, setCustomRole] = useState<string>("");
  const [employmentType, setEmploymentType] = useState<EmploymentType>(
    defaults.employmentType,
  );
  const [baseRate, setBaseRate] = useState(defaults.baseRate.toFixed(2));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [age, setAge] = useState<string>("");
  const [isJuniorOverride, setIsJuniorOverride] = useState<boolean | null>(
    null,
  );
  const [qualifications, setQualifications] = useState<Set<string>>(
    new Set(),
  );
  const [registrationNumber, setRegistrationNumber] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedBusiness = useMemo(
    () => BUSINESS_TYPES.find((b) => b.id === businessType),
    [businessType],
  );

  // Pre-fill when opening in edit mode; reset when opening in create mode or
  // when the business type changes.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setConfirmDelete(false);
    if (editing) {
      setName(editing.name);
      const hasPreset = roleOptions.some((r) => r.role === editing.role);
      if (hasPreset) {
        setRoleMode("preset");
        setSelectedRole(editing.role);
        setCustomRole("");
      } else {
        setRoleMode("custom");
        setSelectedRole(defaults.role);
        setCustomRole(editing.role);
      }
      setEmploymentType(editing.employmentType);
      setBaseRate(editing.baseRate.toFixed(2));
      setAge(editing.age != null ? String(editing.age) : "");
      setIsJuniorOverride(
        editing.isJunior != null ? Boolean(editing.isJunior) : null,
      );
      setQualifications(new Set(editing.qualifications ?? []));
      setRegistrationNumber(editing.registrationNumber ?? "");
      setAdvancedOpen(
        Boolean(
          editing.age ||
            editing.isJunior ||
            (editing.qualifications?.length ?? 0) > 0 ||
            editing.registrationNumber,
        ),
      );
    } else {
      setName("");
      setRoleMode("preset");
      setSelectedRole(defaults.role);
      setCustomRole("");
      setEmploymentType(defaults.employmentType);
      setBaseRate(defaults.baseRate.toFixed(2));
      setAdvancedOpen(false);
      setAge("");
      setIsJuniorOverride(null);
      setQualifications(new Set());
      setRegistrationNumber("");
    }
  }, [
    open,
    editing,
    defaults.role,
    defaults.employmentType,
    defaults.baseRate,
    roleOptions,
  ]);

  if (!open) return null;

  function handleRoleChange(value: string) {
    if (value === CUSTOM_ROLE_VALUE) {
      setRoleMode("custom");
      return;
    }
    setRoleMode("preset");
    setSelectedRole(value);
    const option = roleOptions.find((r) => r.role === value);
    if (option) setBaseRate(option.baseRate.toFixed(2));
  }

  const nameTrimmed = name.trim();
  const rate = Number(baseRate);
  const ageNum = age ? Number(age) : null;
  const derivedJunior = ageNum !== null && ageNum < 21;
  const isJunior = isJuniorOverride ?? derivedJunior;
  const roleName =
    roleMode === "custom" ? customRole.trim() : selectedRole.trim();
  const invalid = !nameTrimmed || !(rate > 0) || !roleName;

  function reset() {
    const d = STAFF_DEFAULTS[businessType];
    setName("");
    setRoleMode("preset");
    setSelectedRole(d.role);
    setCustomRole("");
    setEmploymentType(d.employmentType);
    setBaseRate(d.baseRate.toFixed(2));
    setAdvancedOpen(false);
    setAge("");
    setIsJuniorOverride(null);
    setQualifications(new Set());
    setRegistrationNumber("");
    setError(null);
  }

  function toggleQualification(id: string) {
    setQualifications((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSave() {
    if (invalid) return;
    setError(null);
    startTransition(async () => {
      try {
        if (mode === "edit" && editingId) {
          await updateStaff(editingId, {
            name: nameTrimmed,
            role: roleName,
            employmentType,
            baseRate: rate,
            age: ageNum,
            isJunior,
            qualifications: [...qualifications],
            registrationNumber: registrationNumber.trim() || null,
          });
        } else {
          await addStaff({
            name: nameTrimmed,
            role: roleName,
            employmentType,
            baseRate: rate,
            businessType,
            age: ageNum,
            isJunior,
            qualifications: [...qualifications],
            registrationNumber: registrationNumber.trim() || null,
          });
        }
        reset();
        onClose();
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : mode === "edit"
              ? "Failed to update staff"
              : "Failed to add staff",
        );
      }
    });
  }

  function handleDelete() {
    if (!editingId) return;
    setConfirmDelete(true);
  }

  function handleConfirmDelete() {
    if (!editingId) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteStaff(editingId);
        setConfirmDelete(false);
        reset();
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to remove staff");
        setConfirmDelete(false);
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
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-900">
                {mode === "edit" ? "Edit staff member" : "Add staff member"}
              </h3>
              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-700">
                {selectedBusiness?.label ?? "Preset"}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {nameTrimmed ? initialsOf(nameTrimmed) : "??"} — initials
              auto-generated
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
          <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Role catalog reflects the business industry:{" "}
            <span className="font-semibold text-slate-800">
              {selectedBusiness?.label ?? "Cafe / Restaurant"}
            </span>
            <span className="ml-1 text-slate-400">
              · change in Business settings
            </span>
          </div>

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
              <select
                value={roleMode === "custom" ? CUSTOM_ROLE_VALUE : selectedRole}
                onChange={(e) => handleRoleChange(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
              >
                {roleOptions.map((r) => (
                  <option key={r.role} value={r.role}>
                    {r.role} — ${r.baseRate.toFixed(2)}/hr
                  </option>
                ))}
                <option value={CUSTOM_ROLE_VALUE}>Custom role…</option>
              </select>
              {roleMode === "custom" && (
                <input
                  type="text"
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  placeholder="Enter role name"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              )}
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
                {EMPLOYMENT_TYPE_OPTIONS.map((o) => (
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
              Casual / weekend / night loading is applied automatically by the
              award engine.
            </span>
          </label>

          <div className="rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setAdvancedOpen((o) => !o)}
              className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <span>More options</span>
              <span aria-hidden className="text-xs text-slate-400">
                {advancedOpen ? "▾" : "▸"}
              </span>
            </button>
            {advancedOpen && (
              <div className="space-y-4 border-t border-slate-200 p-4">
                <div className="grid grid-cols-2 gap-4">
                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-slate-700">
                      Age (optional)
                    </span>
                    <input
                      type="number"
                      min={14}
                      max={99}
                      value={age}
                      onChange={(e) => {
                        setAge(e.target.value);
                        setIsJuniorOverride(null);
                      }}
                      placeholder="e.g. 19"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={isJunior}
                      onChange={(e) => setIsJuniorOverride(e.target.checked)}
                      className="h-4 w-4 accent-teal-500"
                    />
                    <span>
                      <span className="font-medium text-slate-700">
                        Junior employee
                      </span>
                      <br />
                      <span className="text-xs text-slate-500">
                        {derivedJunior
                          ? "Auto-set from age under 21"
                          : "Typically under 21"}
                      </span>
                    </span>
                  </label>
                </div>
                <p className="rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                  ⚠️ Junior rate percentages are <strong>not</strong> applied
                  automatically — RosterMate doesn't ship with live award junior
                  tables. Override the base rate manually to reflect the correct
                  junior %.
                </p>

                <div>
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Qualifications
                  </span>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {QUALIFICATIONS.map((q) => (
                      <label
                        key={q.id}
                        className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs transition hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={qualifications.has(q.id)}
                          onChange={() => toggleQualification(q.id)}
                          className="h-3.5 w-3.5 accent-teal-500"
                        />
                        <span className="text-slate-700">{q.label}</span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Stored for reference only — no automatic validation.
                  </p>
                </div>

                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">
                    Professional registration # (optional)
                  </span>
                  <input
                    type="text"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    placeholder="e.g. AHPRA MED0001234567"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
                  />
                  <span className="mt-1 block text-[11px] text-slate-500">
                    Free text — no connection to AHPRA or training.gov.au yet.
                  </span>
                </label>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-rose-500">{error}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 p-4">
          <div>
            {mode === "edit" && (
              <button
                onClick={handleDelete}
                disabled={pending}
                className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Remove staff
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
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
              {pending
                ? "Saving…"
                : mode === "edit"
                  ? "Save changes"
                  : "Add staff"}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Remove ${editing?.name ?? "this staff member"}?`}
        message={
          <>
            They&apos;ll no longer appear on rosters or reports. Their
            historical shifts are kept in the database so past weeks stay
            intact — the row is deactivated, not hard-deleted.
          </>
        }
        confirmLabel="Remove staff"
        destructive
        pending={pending}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
