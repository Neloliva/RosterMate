"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { loginWithPassword, setManagerPassword } from "./actions";

export function LoginForm({ firstRun }: { firstRun: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        if (firstRun) {
          if (password.length < 8) {
            setError("Password must be at least 8 characters");
            return;
          }
          if (password !== confirm) {
            setError("Passwords don't match");
            return;
          }
          const res = await setManagerPassword({
            newPassword: password,
            confirmPassword: confirm,
          });
          if (!res.ok) {
            setError(res.error);
            return;
          }
        } else {
          if (!password) {
            setError("Enter the manager password");
            return;
          }
          const res = await loginWithPassword({ password });
          if (!res.ok) {
            setError(res.error);
            return;
          }
        }
        router.replace("/");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't sign in");
      }
    });
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">
          {firstRun ? "New password" : "Manager password"}
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={firstRun ? "new-password" : "current-password"}
          autoFocus
          minLength={firstRun ? 8 : undefined}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
        />
      </label>
      {firstRun && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Confirm password
          </span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
          />
        </label>
      )}
      {error && (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {pending
          ? firstRun
            ? "Setting password…"
            : "Signing in…"
          : firstRun
            ? "Set password & sign in"
            : "Sign in"}
      </button>
    </form>
  );
}
