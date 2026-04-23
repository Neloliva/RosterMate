import { randomBytes } from "node:crypto";

// 32 hex chars = 128 bits of entropy. Not guessable in practice, suitable
// for "calendar subscribe" style URLs without full auth.
export function randomToken(): string {
  return randomBytes(16).toString("hex");
}
