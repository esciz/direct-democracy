import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type MfaStatus = "configured" | "mfa_encryption_unconfigured";

const IV_LENGTH = 12;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function getKey() {
  const raw = process.env.IDENTITY_MFA_ENCRYPTION_KEY ?? readLocalMfaEncryptionKey();
  if (!raw) return null;
  return createHash("sha256").update(raw).digest();
}

export function readLocalMfaEncryptionKey() {
  if (process.env.NODE_ENV === "production") return null;
  for (const filename of [".env.local", ".env"]) {
    const filePath = path.join(process.cwd(), filename);
    if (!existsSync(filePath)) continue;
    const contents = readFileSync(filePath, "utf8");
    const match = contents.match(/^IDENTITY_MFA_ENCRYPTION_KEY=(.+)$/m);
    const value = match?.[1]?.trim().replace(/^['"]|['"]$/g, "");
    if (value) return value;
  }
  return null;
}

export function getMfaConfigurationStatus(): MfaStatus {
  return getKey() ? "configured" : "mfa_encryption_unconfigured";
}

export function createTotpEnrollmentSecret() {
  const secret = randomBase32(20);
  return {
    secret,
    otpauthPlaceholder: "otpauth://totp/Direct%20Democracy:account?secret=redacted&issuer=Direct%20Democracy",
  };
}

export function randomBase32(byteLength = 20) {
  const bytes = randomBytes(byteLength);
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function buildOtpAuthUri(input: { email: string; secret: string }) {
  const issuer = "Direct Democracy";
  const label = `${issuer}:${input.email}`;
  const params = new URLSearchParams({
    secret: input.secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

function decodeBase32(value: string) {
  const clean = value.toUpperCase().replace(/=+$/g, "").replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let current = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) continue;
    current = (current << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((current >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function hotp(secret: string, counter: number) {
  const key = decodeBase32(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buffer.writeUInt32BE(counter >>> 0, 4);
  const digest = createHmac("sha1", key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) | ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

export function verifyTotpCode(input: { secret: string; code: string; now?: number; window?: number; lastAcceptedCounterHash?: string | null }) {
  const code = input.code.trim().replace(/[\s-]+/g, "");
  if (!/^\d{6}$/.test(code)) return { ok: false as const, reason: "invalid_format" as const };
  const now = input.now ?? Date.now();
  const window = input.window ?? 1;
  const currentCounter = Math.floor(now / 1000 / 30);
  for (let offset = -window; offset <= window; offset += 1) {
    const counter = currentCounter + offset;
    const expected = hotp(input.secret, counter);
    const left = Buffer.from(expected);
    const right = Buffer.from(code);
    if (left.length === right.length && timingSafeEqual(left, right)) {
      const counterHash = createHash("sha256").update(`${input.secret}:${counter}`).digest("hex");
      if (input.lastAcceptedCounterHash && input.lastAcceptedCounterHash === counterHash) {
        return { ok: false as const, reason: "replayed_code" as const };
      }
      return { ok: true as const, counter, counterHash };
    }
  }
  return { ok: false as const, reason: "invalid_code" as const };
}

export function encryptMfaSecret(secret: string) {
  const key = getKey();
  if (!key) throw new Error("mfa_encryption_unconfigured");
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptMfaSecret(encrypted: string) {
  const key = getKey();
  if (!key) throw new Error("mfa_encryption_unconfigured");
  const [ivRaw, tagRaw, ciphertextRaw] = encrypted.split(".");
  if (!ivRaw || !tagRaw || !ciphertextRaw) throw new Error("invalid_mfa_secret");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextRaw, "base64url")), decipher.final()]).toString("utf8");
}

export function hashBackupCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export function generateBackupCodes(count = 10) {
  return Array.from({ length: count }, () => `${randomBytes(5).toString("hex")}-${randomBytes(5).toString("hex")}`);
}

export function verifyRecoveryCode(code: string, hash: string) {
  const candidate = Buffer.from(hashBackupCode(code.trim()));
  const expected = Buffer.from(hash);
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function createPseudoQrSvgDataUri(payload: string) {
  const size = 33;
  const cell = 6;
  const hash = createHash("sha256").update(payload).digest();
  const isDark = (x: number, y: number) => {
    const finder =
      (x < 7 && y < 7) ||
      (x >= size - 7 && y < 7) ||
      (x < 7 && y >= size - 7);
    if (finder) {
      const lx = x < 7 ? x : x >= size - 7 ? x - (size - 7) : x;
      const ly = y < 7 ? y : y >= size - 7 ? y - (size - 7) : y;
      return lx === 0 || ly === 0 || lx === 6 || ly === 6 || (lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4);
    }
    return Boolean(hash[(x * 17 + y * 31) % hash.length] & (1 << ((x + y) % 8)));
  };
  const rects: string[] = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (isDark(x, y)) rects.push(`<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}"/>`);
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size * cell} ${size * cell}" role="img" aria-label="TOTP enrollment QR"><rect width="100%" height="100%" fill="white"/><g fill="black">${rects.join("")}</g></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
