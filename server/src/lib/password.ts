import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);

// scrypt password hashing, zero deps. Format: scrypt$<n>$<r>$<p>$<saltHex>$<keyHex>
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = (await scrypt(password, salt, KEYLEN)) as Buffer;
  return `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltHex, keyHex] = parts;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(keyHex, "hex");
  void n; void r; void p; // format carries params; node defaults match (N=16384,r=8,p=1)
  const key = (await scrypt(password, salt, expected.length)) as Buffer;
  if (key.length !== expected.length) return false;
  return timingSafeEqual(key, expected);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}
