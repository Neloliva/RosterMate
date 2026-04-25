"use server";

import { and, eq, gte, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { businessSettings, managerSessions } from "@/db/schema";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  generateSessionToken,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";

async function loadSettings() {
  const rows = await db
    .select()
    .from(businessSettings)
    .where(eq(businessSettings.id, "default"));
  return rows[0] ?? null;
}

async function issueSessionCookie() {
  const token = generateSessionToken();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_MS);
  await db.insert(managerSessions).values({
    token,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  });
  // Opportunistic cleanup: sweep expired sessions so the table stays small.
  await db.delete(managerSessions).where(lt(managerSessions.expiresAt, now.toISOString()));

  const jar = await cookies();
  jar.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function hasManagerPassword(): Promise<boolean> {
  const s = await loadSettings();
  return Boolean(s?.managerPasswordHash);
}

export async function setManagerPassword(input: {
  newPassword: string;
  confirmPassword: string;
  currentPassword?: string; // required if a password is already set
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const settings = await loadSettings();
  if (!settings) {
    return { ok: false, error: "Business settings not initialised" };
  }
  if (
    typeof input.newPassword !== "string" ||
    input.newPassword.length < 8
  ) {
    return { ok: false, error: "Password must be at least 8 characters" };
  }
  if (input.newPassword !== input.confirmPassword) {
    return { ok: false, error: "Passwords don't match" };
  }
  if (settings.managerPasswordHash) {
    const current = input.currentPassword ?? "";
    const ok = await verifyPassword(current, settings.managerPasswordHash);
    if (!ok) {
      return { ok: false, error: "Current password is incorrect" };
    }
  }
  const hash = await hashPassword(input.newPassword);
  await db
    .update(businessSettings)
    .set({ managerPasswordHash: hash })
    .where(eq(businessSettings.id, "default"));
  // Invalidate any other active sessions when rotating the password.
  await db.delete(managerSessions);
  await issueSessionCookie();
  return { ok: true };
}

export async function loginWithPassword(input: {
  password: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const settings = await loadSettings();
  if (!settings || !settings.managerPasswordHash) {
    return { ok: false, error: "No password is set for this account" };
  }
  const ok = await verifyPassword(
    input.password ?? "",
    settings.managerPasswordHash,
  );
  if (!ok) return { ok: false, error: "Incorrect password" };
  await issueSessionCookie();
  return { ok: true };
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const existing = jar.get(SESSION_COOKIE_NAME)?.value;
  if (existing) {
    await db
      .delete(managerSessions)
      .where(eq(managerSessions.token, existing));
    jar.delete(SESSION_COOKIE_NAME);
  }
  redirect("/login");
}

export async function currentSessionIsValid(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return false;
  const rows = await db
    .select()
    .from(managerSessions)
    .where(
      and(
        eq(managerSessions.token, token),
        gte(managerSessions.expiresAt, new Date().toISOString()),
      ),
    );
  return rows.length > 0;
}
