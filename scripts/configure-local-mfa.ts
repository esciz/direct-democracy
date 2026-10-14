import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { decryptMfaSecret, encryptMfaSecret } from "@/lib/identity/mfa";

type Status = "configured" | "already_configured" | "invalid" | "refused";

const ROOT = process.cwd();
const ENV_FILES = [".env.local", ".env"];
const KEY_NAME = "IDENTITY_MFA_ENCRYPTION_KEY";

function isProduction() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function selectEnvFile() {
  const existing = ENV_FILES.find((filename) => existsSync(path.join(ROOT, filename)));
  return existing ?? ".env.local";
}

function isGitIgnored(filePath: string) {
  try {
    execFileSync("git", ["check-ignore", "-q", filePath], { cwd: ROOT, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function readKey(contents: string) {
  return contents.match(/^IDENTITY_MFA_ENCRYPTION_KEY=(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, "") ?? null;
}

function isKeyShapeValid(value: string) {
  try {
    return Buffer.from(value, "base64url").length >= 32 || value.length >= 32;
  } catch {
    return value.length >= 32;
  }
}

function writeReport(status: Status, details: Record<string, string | boolean | number>) {
  console.log(JSON.stringify({ status, ...details, restartRequired: status === "configured" }, null, 2));
}

if (isProduction()) {
  writeReport("refused", { reason: "production_environment" });
  process.exit(1);
}

const envFile = selectEnvFile();
const envPath = path.join(ROOT, envFile);
if (!existsSync(envPath)) writeFileSync(envPath, "", { mode: 0o600 });

if (!isGitIgnored(envFile)) {
  writeReport("refused", { reason: "env_file_not_gitignored", envFile });
  process.exit(1);
}

const contents = readFileSync(envPath, "utf8");
const existingKey = readKey(contents);
if (existingKey) {
  writeReport(isKeyShapeValid(existingKey) ? "already_configured" : "invalid", { envFile, keyPresent: true });
  process.exit(isKeyShapeValid(existingKey) ? 0 : 1);
}

const key = randomBytes(32).toString("base64url");
const newline = contents.endsWith("\n") || contents.length === 0 ? "" : "\n";
writeFileSync(envPath, `${contents}${newline}${KEY_NAME}=${key}\n`, { mode: 0o600 });
try {
  chmodSync(envPath, 0o600);
} catch {
  // Best effort on platforms that support POSIX permissions.
}

process.env.IDENTITY_MFA_ENCRYPTION_KEY = key;
const encrypted = encryptMfaSecret("disposable-validation-value");
const decrypted = decryptMfaSecret(encrypted);
if (decrypted !== "disposable-validation-value") {
  writeReport("invalid", { envFile, validation: "failed" });
  process.exit(1);
}

const mode = statSync(envPath).mode & 0o777;
writeReport("configured", { envFile, keyPresent: true, validation: "passed", restrictiveMode: mode <= 0o600 });
