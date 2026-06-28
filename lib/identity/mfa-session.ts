import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readLocalMfaEncryptionKey } from "@/lib/identity/mfa";

export const MFA_SESSION_COOKIE = "dd_mfa_session";
const MFA_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function getSigningKey() {
  const key = process.env.IDENTITY_MFA_ENCRYPTION_KEY ?? readLocalMfaEncryptionKey();
  if (!key) return null;
  return key;
}

function sign(value: string) {
  const key = getSigningKey();
  if (!key) throw new Error("mfa_encryption_unconfigured");
  return createHmac("sha256", key).update(value).digest("base64url");
}

export function createMfaSessionCookieValue(userId: string) {
  const payload = JSON.stringify({
    userId,
    verifiedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + MFA_SESSION_TTL_MS).toISOString(),
    nonce: randomBytes(12).toString("base64url"),
  });
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyMfaSessionCookieValue(value: string | null | undefined, userId: string) {
  if (!value) return { ok: false as const, reason: "missing" as const };
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return { ok: false as const, reason: "malformed" as const };
  try {
    const expected = sign(encoded);
    const left = Buffer.from(expected);
    const right = Buffer.from(signature);
    if (left.length !== right.length || !timingSafeEqual(left, right)) return { ok: false as const, reason: "bad_signature" as const };
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as { userId: string; verifiedAt: string; expiresAt: string };
    if (payload.userId !== userId) return { ok: false as const, reason: "wrong_user" as const };
    if (new Date(payload.expiresAt).getTime() <= Date.now()) return { ok: false as const, reason: "expired" as const };
    return { ok: true as const, verifiedAt: payload.verifiedAt, expiresAt: payload.expiresAt };
  } catch {
    return { ok: false as const, reason: "invalid" as const };
  }
}
