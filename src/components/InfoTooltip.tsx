"use client";

import { useState } from "react";

export function InfoTooltip({
  label,
  children,
  align = "left",
}: {
  label?: string;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label ?? "Info"}
        onClick={() => setOpen((o) => !o)}
        className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600 transition hover:bg-slate-300"
      >
        ?
      </button>
      {open && (
        <span
          className={`absolute top-full z-30 mt-1 w-56 rounded-lg bg-slate-900 p-3 text-xs leading-snug text-slate-50 shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
          role="tooltip"
        >
          {children}
        </span>
      )}
    </span>
  );
}
