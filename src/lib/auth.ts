import "server-only";
import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

export { SESSION_COOKIE_NAME } from "./auth-constants";

// scrypt is Node-built-in — no npm dep for password hashing. Parameters
// below are the OWASP-recommended minimums as of 2024. We tune N=2^15 to
// keep server-side login around 50–100ms on modest hardware.
const SCRYPT_N = 32768; // cost
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
const SCRYPT_SALT_BYTES = 16;
// scrypt memory requirement is ~128 * N * r bytes (~32 MB at our settings).
// Node's default maxmem is also 32 MB and the check is strictly less-than,
// so at the default it errors "memory limit exceeded". We explicitly allow
// double that to give clear headroom.
const SCRYPT_MAXMEM = 128 * SCRYPT_N * SCRYPT_R * 2;

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/** Produces a self-describing hash: `scrypt$N$r$p$saltHex$hashHex`. */
export async function hashPassword(plain: string): Promise<string> {
  if (typeof plain !== "string" || plain.length === 0) {
    throw new Error("Password required");
  }
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const hash = await scrypt(plain, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(
  plain: string,
  encoded: string,
): Promise<boolean> {
  if (!plain || !encoded) return false;
  const parts = encoded.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
  const n = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, "hex");
    expected = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }
  const actual = await scrypt(plain, salt, expected.length, {
    N: n,
    r,
    p,
    // Scale maxmem with N so older hashes at smaller parameters still verify
    // without false "memory limit exceeded" errors.
    maxmem: 128 * n * r * 2,
  });
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/** URL-safe random token, ~43 chars for 32 bytes. Used as the session cookie. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

// 14-day default, refreshed on use. Long enough that managers aren't
// re-typing constantly; short enough that a forgotten browser doesn't stay
// authenticated forever.
export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
