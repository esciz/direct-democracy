import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import type { PasswordHash } from "@/lib/identity/types";

const KEY_LENGTH = 64;

export function generateTemporaryPassword(length = 32) {
  return randomBytes(Math.ceil(length * 0.75)).toString("base64url").slice(0, length);
}

export function hashPassword(password: string): PasswordHash {
  const salt = randomBytes(24).toString("base64url");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("base64url");
  return {
    algorithm: "scrypt",
    salt,
    hash,
    keyLength: KEY_LENGTH,
    cost: "node_crypto_scrypt",
    createdAt: new Date().toISOString(),
  };
}

export function verifyPassword(password: string, passwordHash: PasswordHash) {
  if (passwordHash.algorithm !== "scrypt") return false;
  const candidate = scryptSync(password, passwordHash.salt, passwordHash.keyLength);
  const expected = Buffer.from(passwordHash.hash, "base64url");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}
