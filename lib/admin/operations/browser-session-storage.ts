import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

export type BrowserSessionStorageStatus =
  | "local_encrypted_development"
  | "production_storage_configured"
  | "browser_session_storage_unconfigured";

const PRIVATE_SESSION_DIR = path.join(process.cwd(), "data", "private", "browser-sessions");

function sessionKey() {
  const configured = process.env.PLAYWRIGHT_SESSION_STORAGE_KEY;
  if (!configured) throw new Error("browser_session_storage_unconfigured");
  return createHash("sha256").update(`playwright-session:${configured}`).digest();
}

export function getBrowserSessionStorageStatus(): BrowserSessionStorageStatus {
  if (process.env.PLAYWRIGHT_SESSION_STORAGE_BUCKET && process.env.PLAYWRIGHT_SESSION_STORAGE_KEY) {
    return "production_storage_configured";
  }
  if (process.env.NODE_ENV !== "production" && process.env.PLAYWRIGHT_SESSION_STORAGE_KEY) {
    return "local_encrypted_development";
  }
  return "browser_session_storage_unconfigured";
}

export function encryptBrowserSessionState(state: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sessionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(state), cipher.final()]);
  return Buffer.from(JSON.stringify({
    version: 1,
    namespace: "playwright-session",
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64url"),
    authTag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  }));
}

export function decryptBrowserSessionState(encrypted: Buffer) {
  const parsed = JSON.parse(encrypted.toString("utf8")) as {
    version: number;
    namespace: string;
    algorithm: string;
    iv: string;
    authTag: string;
    ciphertext: string;
  };
  if (parsed.version !== 1 || parsed.namespace !== "playwright-session" || parsed.algorithm !== "aes-256-gcm") {
    throw new Error("unsupported_browser_session_ciphertext");
  }
  const decipher = createDecipheriv("aes-256-gcm", sessionKey(), Buffer.from(parsed.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(parsed.authTag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(parsed.ciphertext, "base64url")), decipher.final()]);
}

function storeEncryptedBrowserSessionState(input: {
  label: string;
  state: Buffer;
  expiresAt: string;
  accessReason: string;
}) {
  if (getBrowserSessionStorageStatus() === "browser_session_storage_unconfigured") throw new Error("browser_session_storage_unconfigured");
  mkdirSync(PRIVATE_SESSION_DIR, { recursive: true, mode: 0o700 });
  const id = `browser_session_${Date.now()}_${randomBytes(8).toString("hex")}`;
  const encryptedPath = path.join(PRIVATE_SESSION_DIR, `${id}.enc`);
  const metadataPath = path.join(PRIVATE_SESSION_DIR, `${id}.metadata.json`);
  writeFileSync(encryptedPath, encryptBrowserSessionState(input.state), { mode: 0o600 });
  writeFileSync(metadataPath, `${JSON.stringify({
    id,
    labelHash: createHash("sha256").update(input.label).digest("hex"),
    createdAt: new Date().toISOString(),
    validatedAt: null,
    lastUsedAt: null,
    expiresAt: input.expiresAt,
    revokedAt: null,
    reauthenticationRequired: false,
    accessReason: input.accessReason,
    accessAudit: [{ at: new Date().toISOString(), reason: input.accessReason, action: "created" }],
    encrypted: true,
    elevatedPermissionAccessAudited: true,
    storageStateCommitted: false,
  }, null, 2)}\n`, { mode: 0o600 });
  return { id, metadataPath, encryptedPathHash: createHash("sha256").update(encryptedPath).digest("hex") };
}

export function storeLocalBrowserSessionState(input: {
  label: string;
  state: Buffer;
  expiresAt: string;
  accessReason: string;
}) {
  if (getBrowserSessionStorageStatus() !== "local_encrypted_development") throw new Error("browser_session_storage_unconfigured");
  return storeEncryptedBrowserSessionState(input);
}

export function storeConfiguredBrowserSessionStateForSmokeTest(input: {
  label: string;
  state: Buffer;
  expiresAt: string;
  accessReason: string;
}) {
  return storeEncryptedBrowserSessionState(input);
}

export function markLocalBrowserSessionValidated(metadataPath: string) {
  const resolvedRoot = path.resolve(PRIVATE_SESSION_DIR);
  const resolvedPath = path.resolve(metadataPath);
  if (!resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error("invalid_browser_session_path");
  const metadata = JSON.parse(readFileSync(resolvedPath, "utf8")) as Record<string, unknown> & { accessAudit?: unknown[] };
  metadata.validatedAt = new Date().toISOString();
  metadata.lastUsedAt = metadata.validatedAt;
  metadata.accessAudit = [...(Array.isArray(metadata.accessAudit) ? metadata.accessAudit : []), { at: metadata.validatedAt, action: "validated" }];
  writeFileSync(resolvedPath, `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o600 });
}

export function revokeLocalBrowserSession(metadataPath: string, reason: string) {
  const resolvedRoot = path.resolve(PRIVATE_SESSION_DIR);
  const resolvedPath = path.resolve(metadataPath);
  if (!resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error("invalid_browser_session_path");
  const metadata = JSON.parse(readFileSync(resolvedPath, "utf8")) as Record<string, unknown> & { accessAudit?: unknown[] };
  const revokedAt = new Date().toISOString();
  metadata.revokedAt = revokedAt;
  metadata.reauthenticationRequired = true;
  metadata.accessAudit = [...(Array.isArray(metadata.accessAudit) ? metadata.accessAudit : []), { at: revokedAt, action: "revoked", reason }];
  writeFileSync(resolvedPath, `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o600 });
}

export function inspectBrowserSessionStorage() {
  const status = getBrowserSessionStorageStatus();
  const metadataFiles = existsSync(PRIVATE_SESSION_DIR)
    ? readdirSync(PRIVATE_SESSION_DIR).filter((file) => file.endsWith(".metadata.json"))
    : [];
  const now = Date.now();
  const records = metadataFiles.map((file) => {
    const fullPath = path.join(PRIVATE_SESSION_DIR, file);
    const metadata = JSON.parse(readFileSync(fullPath, "utf8")) as { expiresAt?: string; createdAt?: string; revokedAt?: string | null; reauthenticationRequired?: boolean };
    return {
      metadataFile: file,
      createdAt: metadata.createdAt ?? null,
      expiresAt: metadata.expiresAt ?? null,
      revokedAt: metadata.revokedAt ?? null,
      reauthenticationRequired: Boolean(metadata.reauthenticationRequired),
      expired: metadata.expiresAt ? new Date(metadata.expiresAt).getTime() <= now : true,
      sizeBytes: statSync(fullPath).size,
    };
  });
  return {
    status,
    localRecords: records.length,
    expiredRecords: records.filter((record) => record.expired).length,
    revokedRecords: records.filter((record) => record.revokedAt).length,
    records,
    encrypted: status !== "browser_session_storage_unconfigured",
    separateKeyNamespace: true,
  };
}
