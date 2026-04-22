"use client";

// Reusable confirmation dialog for destructive actions (delete, remove, replace).
// Keep a single source of truth for the UX so every new destructive action
// lands with the same behaviour.
//
// Example:
//   <ConfirmDialog
//     open={showConfirm}
//     title="Remove shift?"
//     message="This can't be recovered."
//     confirmLabel="Remove"
//     destructive
//     onConfirm={handleDelete}
//     onCancel={() => setShowConfirm(false)}
//   />

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  const confirmClass = destructive
    ? "bg-rose-500 hover:bg-rose-600"
    : "bg-teal-500 hover:bg-teal-600";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-labelledby="confirm-dialog-title"
      >
        <h3
          id="confirm-dialog-title"
          className="text-base font-semibold text-slate-900"
        >
          {title}
        </h3>
        <div className="mt-1 text-sm text-slate-600">{message}</div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:bg-slate-300 ${confirmClass}`}
          >
            {pending ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
