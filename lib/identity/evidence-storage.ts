import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

export type EvidenceStorageStatus = "local_encrypted_development" | "production_storage_configured" | "verification_evidence_storage_unconfigured";

const LOCAL_EVIDENCE_DIR = path.join(process.cwd(), "data", "private", "identity-evidence");
const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MAGIC = [
  { type: "application/pdf", bytes: Buffer.from("%PDF") },
  { type: "image/png", bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
  { type: "image/jpeg", bytes: Buffer.from([0xff, 0xd8, 0xff]) },
];

export function getEvidenceStorageStatus(): EvidenceStorageStatus {
  if (process.env.IDENTITY_EVIDENCE_STORAGE_BUCKET && process.env.IDENTITY_EVIDENCE_ENCRYPTION_KEY) {
    return "production_storage_configured";
  }
  if (process.env.NODE_ENV !== "production" && process.env.IDENTITY_EVIDENCE_ENCRYPTION_KEY) {
    return "local_encrypted_development";
  }
  return "verification_evidence_storage_unconfigured";
}

function evidenceEncryptionKey() {
  const configured = process.env.IDENTITY_EVIDENCE_ENCRYPTION_KEY;
  if (!configured) throw new Error("verification_evidence_storage_unconfigured");
  return createHash("sha256").update(configured).digest();
}

function encryptEvidenceBuffer(buffer: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", evidenceEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.from(JSON.stringify({
    version: 1,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64url"),
    authTag: authTag.toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  }));
}

export function decryptLocalEvidenceForDevelopment(encrypted: Buffer) {
  const parsed = JSON.parse(encrypted.toString("utf8")) as {
    version: number;
    algorithm: string;
    iv: string;
    authTag: string;
    ciphertext: string;
  };
  if (parsed.version !== 1 || parsed.algorithm !== "aes-256-gcm") throw new Error("unsupported_evidence_ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", evidenceEncryptionKey(), Buffer.from(parsed.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(parsed.authTag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(parsed.ciphertext, "base64url")), decipher.final()]);
}

export function validateEvidenceBuffer(buffer: Buffer, contentType: string) {
  if (buffer.byteLength > MAX_EVIDENCE_BYTES) return { ok: false as const, reason: "file_too_large" };
  const allowed = ALLOWED_MAGIC.find((entry) => entry.type === contentType && buffer.subarray(0, entry.bytes.length).equals(entry.bytes));
  if (!allowed) return { ok: false as const, reason: "unsupported_or_mismatched_content_type" };
  if (buffer.subarray(0, 256).includes(Buffer.from("<script")) || buffer.subarray(0, 256).includes(Buffer.from("MZ"))) {
    return { ok: false as const, reason: "executable_or_script_like_content" };
  }
  return { ok: true as const };
}

export function createSafeEvidenceObjectKey(accountId: string) {
  const random = randomBytes(24).toString("base64url");
  return `verification-evidence/${createHash("sha256").update(accountId).digest("hex").slice(0, 16)}/${random}`;
}

function storeEncryptedEvidenceObject(accountId: string, buffer: Buffer, contentType: string) {
  const status = getEvidenceStorageStatus();
  if (status === "verification_evidence_storage_unconfigured") throw new Error(status);
  const validation = validateEvidenceBuffer(buffer, contentType);
  if (!validation.ok) throw new Error(validation.reason);
  mkdirSync(LOCAL_EVIDENCE_DIR, { recursive: true, mode: 0o700 });
  const objectKey = createSafeEvidenceObjectKey(accountId);
  const localPath = path.join(LOCAL_EVIDENCE_DIR, `${objectKey.replaceAll("/", "_")}.bin`);
  const resolvedLocalPath = path.resolve(localPath);
  const resolvedRoot = path.resolve(LOCAL_EVIDENCE_DIR);
  if (!resolvedLocalPath.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error("invalid_evidence_path");
  writeFileSync(resolvedLocalPath, encryptEvidenceBuffer(buffer), { mode: 0o600 });
  return {
    objectRefHash: createHash("sha256").update(objectKey).digest("hex"),
    contentHash: createHash("sha256").update(buffer).digest("hex"),
    localPath: resolvedLocalPath,
    purgeAfter: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    encrypted: true,
    encryptionAlgorithm: "aes-256-gcm",
  };
}

export function storeLocalEvidenceForDevelopment(accountId: string, buffer: Buffer, contentType: string) {
  const status = getEvidenceStorageStatus();
  if (status !== "local_encrypted_development") throw new Error(status);
  return storeEncryptedEvidenceObject(accountId, buffer, contentType);
}

export function storeConfiguredEvidenceForSmokeTest(accountId: string, buffer: Buffer, contentType: string) {
  return storeEncryptedEvidenceObject(accountId, buffer, contentType);
}

export function purgeLocalEvidenceObject(localPath: string) {
  const resolvedLocalPath = path.resolve(localPath);
  const resolvedRoot = path.resolve(LOCAL_EVIDENCE_DIR);
  if (!resolvedLocalPath.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error("invalid_evidence_path");
  if (existsSync(resolvedLocalPath)) {
    readFileSync(resolvedLocalPath);
    unlinkSync(resolvedLocalPath);
    return true;
  }
  return false;
}
