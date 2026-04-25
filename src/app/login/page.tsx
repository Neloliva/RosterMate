import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  currentSessionIsValid,
  hasManagerPassword,
} from "./actions";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "RosterMate · Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  // Already signed in → straight to the dashboard.
  if (await currentSessionIsValid()) {
    redirect("/");
  }
  const passwordIsSet = await hasManagerPassword();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12 sm:px-8">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500 text-lg font-bold text-white shadow-sm">
          R
        </div>
        <div>
          <div className="text-lg font-semibold tracking-tight text-slate-900">
            RosterMate
          </div>
          <div className="text-xs uppercase tracking-wider text-slate-500">
            Manager sign-in
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {passwordIsSet ? (
          <>
            <h1 className="text-xl font-semibold text-slate-900">Sign in</h1>
            <p className="mt-1 text-sm text-slate-600">
              Enter the manager password to open the dashboard.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-slate-900">
              Set a manager password
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              This password protects the dashboard, all business settings,
              and any attachments staff upload. Choose at least 8 characters.
            </p>
          </>
        )}
        <LoginForm firstRun={!passwordIsSet} />
      </div>

      <p className="mt-6 text-center text-xs text-slate-500">
        Staff schedule links at{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-700">
          /staff/&lt;token&gt;
        </code>{" "}
        are unaffected — they use their own per-staff access tokens.
      </p>
    </main>
  );
}
